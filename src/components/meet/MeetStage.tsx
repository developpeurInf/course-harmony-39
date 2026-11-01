"use client";

/**
 * Salle de réunion (à l'intérieur de <LiveKitRoom>) : scène vidéo, barre d'outils, panneaux.
 * Mises en page : grille automatique, orateur, présentation (écran partagé en grand + bande).
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  RoomAudioRenderer,
  VideoTrack,
  isTrackReference,
  useConnectionQualityIndicator,
  useDataChannel,
  useIsMuted,
  useIsSpeaking,
  useLocalParticipant,
  useParticipantAttributes,
  useLocalParticipantPermissions,
  useMediaDeviceSelect,
  useParticipants,
  useRoomContext,
  useStartAudio,
  useTracks,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { ConnectionQuality, ConnectionState, RoomEvent, ScreenSharePresets, Track, VideoQuality, type Participant, type RemoteTrackPublication } from "livekit-client";
import {
  Camera,
  CameraOff,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Expand,
  Hand,
  LayoutGrid,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  MonitorOff,
  MonitorUp,
  MoreHorizontal,
  PhoneOff,
  Pin,
  PinOff,
  Settings2,
  Signal,
  SmilePlus,
  SwitchCamera,
  Users,
  Volume2,
  WifiOff,
  X,
  Presentation,
  UserSquare2,
  PenLine,
} from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  REACTIONS,
  clock,
  heartbeat,
  loadMessages,
  meetingReport,
  moderate,
  screenShareSupported,
  type MeetMessage,
  type MeetSettings,
  type ReportRow,
} from "@/lib/meet";
import { MeetChat } from "./MeetChat";
import { Avatar, MeetPeople, handOf, roleOf } from "./MeetPeople";
import { useTr } from "./useTr";
import { useWhiteboard } from "./whiteboard/useWhiteboard";
import { ScreenAnnotator, WhiteboardBoard, captureTrack } from "./whiteboard/Whiteboard";
import "./meet.css";

type Panel = "chat" | "people" | null;
type Layout = "auto" | "grid" | "speaker";

const enc = new TextEncoder();
const dec = new TextDecoder();

function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setM(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return m;
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** Nombre de colonnes qui donne les plus grandes tuiles */
function bestGrid(n: number, w: number, h: number, gap = 10) {
  if (n <= 0 || !w || !h) return { cols: 1, tileW: w, tileH: h };
  // Écran en hauteur (téléphone) : tuiles plus hautes pour tenir à 2 colonnes
  const ratio = h > w * 1.1 ? 3 / 4 : 16 / 9;
  let best = { cols: 1, tileW: 0, tileH: 0 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const maxW = (w - gap * (cols - 1)) / cols;
    const maxH = (h - gap * (rows - 1)) / rows;
    const tileW = Math.min(maxW, maxH * ratio);
    const tileH = tileW / ratio;
    if (tileW > best.tileW) best = { cols, tileW, tileH };
  }
  return best;
}

/** Petit son discret (main levée, message) */
function chime(freq = 880) {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.4);
    setTimeout(() => void ctx.close(), 600);
  } catch {
    /* pas de son */
  }
}

interface FloatingReaction {
  id: number;
  emoji: string;
  name: string;
  x: number;
}

export function MeetStage(props: {
  meetingId: string;
  title: string;
  roomName: string;
  hostId: string;
  isHost: boolean;
  me: string;
  startedAt: string | null;
  initialSettings: MeetSettings;
  onLeave: (endForAll: boolean) => void;
  onEnded: () => void;
}) {
  const { tr, locale, dir, rtl } = useTr();
  const room = useRoomContext();
  const isMobile = useIsMobile();
  const participants = useParticipants();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  const perms = useLocalParticipantPermissions();
  const [panel, setPanel] = useState<Panel>(null);
  const [layout, setLayout] = useState<Layout>("auto");
  const [pinned, setPinned] = useState<string | null>(null);
  const [settings, setSettings] = useState<MeetSettings>(props.initialSettings);
  const [messages, setMessages] = useState<MeetMessage[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [absent, setAbsent] = useState<ReportRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveData, setSaveData] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [, force] = useState(0);
  const panelRef = useRef<Panel>(null);
  panelRef.current = panel;
  const activeSpeaker = useRef<string | null>(null);
  const myHand = handOf(localParticipant) > 0;

  // Tableau blanc partagé (+ annotations de l'écran partagé)
  const wb = useWhiteboard(room, { me: props.me, myName: localParticipant.name || "", isHost: props.isHost, meetingId: props.meetingId });
  useSyncExternalStore(wb.subscribeState, wb.getStateVersion, wb.getStateVersion);
  const boardOpen = wb.state.open;
  const [boardHidden, setBoardHidden] = useState(false);
  const wasOpen = useRef(boardOpen);
  useEffect(() => {
    if (boardOpen && !wasOpen.current) {
      setBoardHidden(false);
      if (!props.isHost) toast(tr("Le professeur a ouvert le tableau blanc", "فتح الأستاذ السبورة البيضاء", "The teacher opened the whiteboard"));
    }
    wasOpen.current = boardOpen;
  }, [boardOpen, props.isHost, tr]);
  const showBoard = boardOpen && !boardHidden;
  const toggleBoard = () => {
    if (props.isHost) wb.setState({ open: !boardOpen });
    else if (boardOpen) setBoardHidden(h => !h);
  };

  // Présence (toutes les 45 s), fin de réunion détectée par la base
  useEffect(() => {
    const beat = async () => {
      const s = await heartbeat(props.meetingId);
      if (s === "ended") props.onEnded();
    };
    const t = setInterval(() => void beat(), 45_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.meetingId]);

  // Écran allumé pendant la réunion (tablettes, téléphones)
  useEffect(() => {
    let lock: any = null;
    const take = async () => {
      try {
        lock = await (navigator as any).wakeLock?.request("screen");
      } catch {
        /* refusé */
      }
    };
    void take();
    const onVis = () => document.visibilityState === "visible" && void take();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release?.();
    };
  }, []);

  // Rafraîchir quand les attributs (main levée) changent ; notifications de mains
  useEffect(() => {
    const onAttr = (changed: Record<string, string>, p: Participant) => {
      force(n => n + 1);
      if ("hand" in changed && changed.hand && p.identity !== props.me && (props.isHost || roleOf(p) === "host")) {
        if (props.isHost) {
          chime(990);
          toast(`✋ ${p.name || ""}`, { description: tr("lève la main", "يرفع يده", "raised their hand"), duration: 4000 });
        }
      }
    };
    const onSpeakers = (speakers: Participant[]) => {
      const s = speakers.find(x => x.identity !== props.me);
      if (s) activeSpeaker.current = s.identity;
    };
    const onMuted = (pub: any, p: Participant) => {
      if (p.identity === props.me && pub?.source === Track.Source.Microphone && !mutingSelf.current) {
        toast(tr("Votre micro a été coupé par le professeur", "قام الأستاذ بكتم ميكروفونك", "The teacher muted your microphone"));
      }
      force(n => n + 1);
    };
    room.on(RoomEvent.ParticipantAttributesChanged, onAttr);
    room.on(RoomEvent.ActiveSpeakersChanged, onSpeakers);
    room.on(RoomEvent.TrackMuted, onMuted);
    room.on(RoomEvent.TrackUnmuted, () => force(n => n + 1));
    return () => {
      room.off(RoomEvent.ParticipantAttributesChanged, onAttr);
      room.off(RoomEvent.ActiveSpeakersChanged, onSpeakers);
      room.off(RoomEvent.TrackMuted, onMuted);
    };
  }, [room, props.me, props.isHost, tr]);

  // Droits changés par le professeur : on coupe ce qui n'est plus permis
  const mutingSelf = useRef(false);
  const can = useMemo(() => {
    const src = perms?.canPublishSources || [];
    const all = src.length === 0 && (perms?.canPublish ?? true);
    const has = (n: number) => all || src.includes(n as any);
    // 1 caméra, 2 micro, 3 écran (TrackSource du protocole)
    return { cam: has(1), mic: has(2), share: has(3) };
  }, [perms]);

  // Chat : historique + messages en direct
  useEffect(() => {
    let alive = true;
    loadMessages(props.meetingId)
      .then(m => alive && setMessages(m))
      .catch(() => alive && setMessages([]));
    return () => {
      alive = false;
    };
  }, [props.meetingId]);
  useEffect(() => {
    const onReconnected = () => void loadMessages(props.meetingId).then(setMessages).catch(() => undefined);
    room.on(RoomEvent.Reconnected, onReconnected);
    return () => {
      room.off(RoomEvent.Reconnected, onReconnected);
    };
  }, [room, props.meetingId]);

  const broadcast = useCallback(
    (topic: string, payload: unknown) => {
      void room.localParticipant.publishData(enc.encode(JSON.stringify(payload)), { reliable: true, topic }).catch(() => undefined);
    },
    [room],
  );

  useDataChannel("chat", msg => {
    try {
      const m = JSON.parse(dec.decode(msg.payload)) as MeetMessage;
      setMessages(list => (list && list.some(x => x.id === m.id) ? list : [...(list || []), m]));
      if (panelRef.current !== "chat") {
        setUnread(n => n + 1);
        chime(660);
      }
    } catch {
      /* ignore */
    }
  });
  useDataChannel("chat-delete", msg => {
    try {
      const { id } = JSON.parse(dec.decode(msg.payload));
      setMessages(list => (list || []).map(m => (m.id === id ? { ...m, deleted_at: new Date().toISOString() } : m)));
    } catch {
      /* ignore */
    }
  });
  useDataChannel("settings", msg => {
    try {
      const s = JSON.parse(dec.decode(msg.payload)) as MeetSettings;
      setSettings(prev => {
        if (!props.isHost) {
          if (prev.chat && !s.chat) toast(tr("Le professeur a fermé le chat", "أغلق الأستاذ الدردشة", "The teacher turned off chat"));
          if (!prev.chat && s.chat) toast(tr("Le chat est ouvert", "الدردشة مفتوحة", "Chat is open"));
        }
        return s;
      });
    } catch {
      /* ignore */
    }
  });

  const spawnReaction = useCallback((emoji: string, name: string) => {
    const id = Date.now() + Math.random();
    setReactions(r => [...r.slice(-24), { id, emoji, name, x: 8 + Math.random() * 30 }]);
    setTimeout(() => setReactions(r => r.filter(x => x.id !== id)), 4200);
  }, []);
  useDataChannel("reaction", msg => {
    try {
      const { emoji } = JSON.parse(dec.decode(msg.payload));
      if (REACTIONS.includes(emoji)) spawnReaction(emoji, msg.from?.name || "");
    } catch {
      /* ignore */
    }
  });
  const react = (emoji: string) => {
    spawnReaction(emoji, tr("Vous", "أنت", "You"));
    broadcast("reaction", { emoji });
  };

  // Participants absents (professeur, panneau ouvert)
  useEffect(() => {
    if (!props.isHost || panel !== "people") return;
    let alive = true;
    const load = () => meetingReport(props.meetingId).then(r => alive && setAbsent(r)).catch(() => undefined);
    void load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [props.isHost, panel, props.meetingId]);

  useEffect(() => {
    if (panel === "chat") setUnread(0);
  }, [panel, messages?.length]);

  // Économie de données : seulement le professeur et les écrans partagés
  useEffect(() => {
    const apply = () => {
      room.remoteParticipants.forEach(p => {
        p.trackPublications.forEach(pub => {
          const rp = pub as RemoteTrackPublication;
          if (rp.kind !== Track.Kind.Video) return;
          const keep = !saveData || rp.source === Track.Source.ScreenShare || roleOf(p) === "host";
          rp.setSubscribed(keep);
        });
      });
    };
    apply();
    room.on(RoomEvent.TrackPublished, apply);
    return () => {
      room.off(RoomEvent.TrackPublished, apply);
    };
  }, [saveData, room]);

  // ------------------------------------------------------------------ actions
  const toggleMic = async () => {
    if (!can.mic && !isMicrophoneEnabled) {
      toast(tr("Le professeur a désactivé les micros des élèves", "عطل الأستاذ ميكروفونات التلاميذ", "The teacher disabled student microphones"));
      return;
    }
    mutingSelf.current = true;
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch {
      toast.error(tr("Micro indisponible", "الميكروفون غير متاح", "Microphone unavailable"));
    } finally {
      setTimeout(() => (mutingSelf.current = false), 300);
    }
  };
  const toggleCam = async () => {
    if (!can.cam && !isCameraEnabled) {
      toast(tr("Le professeur a désactivé les caméras des élèves", "عطل الأستاذ كاميرات التلاميذ", "The teacher disabled student cameras"));
      return;
    }
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled, { facingMode: facing });
    } catch {
      toast.error(tr("Caméra indisponible", "الكاميرا غير متاحة", "Camera unavailable"));
    }
  };
  const flipCam = async () => {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    const pub = localParticipant.getTrackPublication(Track.Source.Camera);
    try {
      await (pub?.videoTrack as any)?.restartTrack({ facingMode: next });
    } catch {
      /* une seule caméra */
    }
  };
  const toggleShare = async () => {
    if (!isScreenShareEnabled && !can.share) {
      toast(tr("Le partage d'écran est réservé au professeur", "مشاركة الشاشة خاصة بالأستاذ", "Screen sharing is reserved for the teacher"));
      return;
    }
    try {
      await localParticipant.setScreenShareEnabled(
        !isScreenShareEnabled,
        // Capture à la résolution native de l'écran (jusqu'à 1440p) : le texte reste net
        { audio: true, contentHint: "detail", resolution: { width: 2560, height: 1440, frameRate: 15 }, selfBrowserSurface: "exclude", surfaceSwitching: "include" } as any,
        {
          screenShareEncoding: { maxBitrate: 5_000_000, maxFramerate: 15, priority: "high" },
          screenShareSimulcastLayers: [ScreenSharePresets.h360fps3, ScreenSharePresets.h1080fps15],
          degradationPreference: "maintain-resolution",
          videoCodec: "vp9",
          backupCodec: { codec: "vp8" },
        } as any,
      );
    } catch (e: any) {
      if (e?.name !== "NotAllowedError") toast.error(tr("Partage d'écran impossible", "تعذرت مشاركة الشاشة", "Screen sharing failed"));
    }
  };
  const toggleHand = async () => {
    try {
      await localParticipant.setAttributes({ hand: myHand ? "" : String(Date.now()) });
      force(n => n + 1);
    } catch {
      /* ignore */
    }
  };

  const doModerateImpl = async (
    action: "mute" | "lower_hand" | "remove" | "mute_all" | "lower_all",
    identity?: string,
    source?: "microphone" | "camera" | "screen_share",
  ) => {
    setBusy(action);
    try {
      await moderate(props.meetingId, action, { identity, source });
      if (action === "mute_all") toast.success(tr("Tous les micros sont coupés", "تم كتم جميع الميكروفونات", "Everyone is muted"));
      if (action === "remove") toast.success(tr("Élève retiré de la réunion", "تم إخراج التلميذ", "Student removed"));
    } catch (e: any) {
      toast.error(e?.message || tr("Action impossible", "تعذر الإجراء", "Action failed"));
    } finally {
      setBusy(null);
    }
  };
  // Fonctions stables : les tuiles vidéo ne se redessinent pas pour rien
  const moderateRef = useRef(doModerateImpl);
  moderateRef.current = doModerateImpl;
  const doModerate = useCallback(
    (action: Parameters<typeof doModerateImpl>[0], identity?: string, source?: "microphone" | "camera" | "screen_share") => moderateRef.current(action, identity, source),
    [],
  );
  const togglePin = useCallback((id: string) => setPinned(p => (p === id ? null : id)), []);
  const doSetting = async (patch: Partial<MeetSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      const r = await moderate(props.meetingId, "settings", { settings: patch });
      const s = { ...next, ...(r.settings || {}) } as MeetSettings;
      setSettings(s);
      broadcast("settings", s);
    } catch (e: any) {
      setSettings(settings);
      toast.error(e?.message || tr("Réglage non enregistré", "لم يتم حفظ الإعداد", "Setting not saved"));
    }
  };

  // Raccourcis clavier : M micro, V caméra, H main, C chat, P participants
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || t?.closest("input, textarea, select, [contenteditable=true]")) return;
      const k = e.key.toLowerCase();
      if (k === "m") void toggleMic();
      else if (k === "v") void toggleCam();
      else if (k === "h") void toggleHand();
      else if (k === "c") setPanel(p => (p === "chat" ? null : "chat"));
      else if (k === "p") setPanel(p => (p === "people" ? null : "people"));
      else if (k === "b" && (props.isHost || boardOpen)) toggleBoard();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ------------------------------------------------------------------ pistes
  const cameraRefs = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], { onlySubscribed: false });
  const screenRefs = useTracks([Track.Source.ScreenShare], { onlySubscribed: false }).filter(isTrackReference);

  const sortedCams = useMemo(() => {
    return [...cameraRefs].sort((a, b) => {
      const ka = roleOf(a.participant) === "host" ? 0 : a.participant.isLocal ? 1 : 2;
      const kb = roleOf(b.participant) === "host" ? 0 : b.participant.isLocal ? 1 : 2;
      if (ka !== kb) return ka - kb;
      return (a.participant.joinedAt?.getTime() || 0) - (b.participant.joinedAt?.getTime() || 0);
    });
  }, [cameraRefs]);

  const pinnedRef = pinned ? sortedCams.find(t => t.participant.identity === pinned) || null : null;
  useEffect(() => {
    if (pinned && !participants.some(p => p.identity === pinned)) setPinned(null);
  }, [participants, pinned]);

  const screen = screenRefs[screenRefs.length - 1] || null;
  const shareKey = screen ? `${screen.participant.identity}:${screen.publication.trackSid}` : "";
  // nouveau partage ou fin du partage : les annotations de l'écran précédent disparaissent
  const lastShare = useRef(shareKey);
  useEffect(() => {
    if (lastShare.current && lastShare.current !== shareKey && props.isHost) wb.clear("screen");
    lastShare.current = shareKey;
  }, [shareKey, props.isHost, wb]);
  const screenTrackRef = useRef<MediaStreamTrack | undefined>(undefined);
  screenTrackRef.current = screen?.publication.track?.mediaStreamTrack;
  const captureScreen = useCallback(() => captureTrack(screenTrackRef.current, wb), [wb]);
  const copyScreenToBoard = useCallback(async () => {
    const img = await captureTrack(screenTrackRef.current, wb);
    if (!img) return;
    if (!wb.state.open) wb.setState({ open: true });
    setBoardHidden(false);
    // placé au centre de la vue courante du tableau (ou à l'origine)
    const v = wb.hostView;
    const k = Math.min(1, 900 / img.w);
    const w = img.w * k,
      h = img.h * k;
    const cx = v ? v.cx : 400,
      cy = v ? v.cy : 260;
    wb.add("board", [{ id: Math.random().toString(36).slice(2, 10), by: props.me, k: "image", x: cx - w / 2, y: cy - h / 2, w, h, color: "fg", size: 1, src: img.src }]);
    toast.success(tr("Écran copié sur le tableau blanc", "تم نسخ الشاشة إلى السبورة", "Screen copied to the whiteboard"));
  }, [wb, props.me, tr]);
  const mode: "grid" | "focus" =
    layout === "grid" && !pinned ? "grid" : screen || pinnedRef || (layout === "speaker" && sortedCams.length > 1) ? "focus" : "grid";
  const speakerRef =
    sortedCams.find(t => t.participant.identity === activeSpeaker.current) || sortedCams.find(t => !t.participant.isLocal) || sortedCams[0];
  const focusRef: TrackReferenceOrPlaceholder | null = pinnedRef || screen || (mode === "focus" ? speakerRef : null);
  const strip = mode === "focus" ? sortedCams.filter(t => t !== focusRef) : [];
  const hostCam = sortedCams.find(t => roleOf(t.participant) === "host" && !t.participant.isLocal) || null;

  // Grille paginée
  const pageSize = isMobile ? 6 : 16;
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(sortedCams.length / pageSize));
  useEffect(() => {
    if (page >= pages) setPage(pages - 1);
  }, [page, pages]);
  const gridItems = sortedCams.slice(page * pageSize, page * pageSize + pageSize);
  const [stageRef, stage] = useSize<HTMLDivElement>();
  const g = bestGrid(gridItems.length, stage.w, stage.h, isMobile ? 8 : 12);

  const hands = participants.filter(p => handOf(p) > 0).length;
  const { canPlayAudio, mergedProps: startAudioProps } = useStartAudio({ room, props: {} });
  const presenter = screen && !screen.participant.isLocal ? screen.participant.name : null;
  const reconnecting = room.state === ConnectionState.Reconnecting;
  const names = useMemo(() => {
    const out: Record<string, string> = {};
    participants.forEach(p => (out[p.identity] = p.name || ""));
    (absent || []).forEach(r => (out[r.user_id] = out[r.user_id] || r.name));
    return out;
  }, [participants, absent]);
  // noms des anciens messages (participants partis)
  const [knownNames, setKnownNames] = useState<Record<string, string>>({});
  useEffect(() => {
    setKnownNames(k => ({ ...k, ...Object.fromEntries(Object.entries(names).filter(([, v]) => v)) }));
  }, [names]);
  const myQuality = useConnectionQualityIndicator({ participant: localParticipant }).quality;

  const panelView = panel && (
    <aside
      className={cn(
        "meet-panel flex min-h-0 flex-col overflow-hidden bg-[#121722] ring-1 ring-white/10",
        isMobile ? "fixed inset-0 z-40" : "w-[360px] shrink-0 rounded-3xl",
      )}
      aria-label={panel === "chat" ? tr("Chat de la réunion", "دردشة الاجتماع", "Meeting chat") : tr("Participants", "المشاركون", "Participants")}
    >
      <div className="flex items-center gap-1 border-b border-white/10 p-2">
        <div className="flex flex-1 gap-1 rounded-xl bg-white/5 p-1">
          {(["chat", "people"] as const).map(k => (
            <button
              key={k}
              type="button"
              onClick={() => setPanel(k)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                panel === k ? "bg-white/15 text-white" : "text-white/60 hover:text-white",
              )}
            >
              {k === "chat" ? <MessageSquare className="h-4 w-4" /> : <Users className="h-4 w-4" />}
              {k === "chat" ? tr("Chat", "الدردشة", "Chat") : tr("Personnes", "الأشخاص", "People")}
              {k === "people" && <span className="text-xs text-white/50">{participants.length}</span>}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPanel(null)}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-white/60 hover:bg-white/10 hover:text-white"
          aria-label={tr("Fermer", "إغلاق", "Close")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {panel === "chat" ? (
          <MeetChat
            tr={tr}
            locale={locale}
            meetingId={props.meetingId}
            me={props.me}
            hostId={props.hostId}
            isHost={props.isHost}
            chatOpen={settings.chat}
            messages={messages}
            names={{ ...knownNames, ...names }}
            broadcast={broadcast}
            onLocal={m => setMessages(l => [...(l || []), m])}
            onSent={(temp, saved) =>
              setMessages(l => {
                const rest = (l || []).filter(x => x.id !== temp && (!saved || x.id !== saved.id));
                return saved ? [...rest, saved].sort((a, b) => a.created_at.localeCompare(b.created_at)) : rest;
              })
            }
            onDeleted={id => setMessages(l => (l || []).map(m => (m.id === id ? { ...m, deleted_at: new Date().toISOString() } : m)))}
          />
        ) : (
          <MeetPeople
            tr={tr}
            participants={participants}
            meId={props.me}
            isHost={props.isHost}
            settings={settings}
            absent={absent}
            onModerate={(a, id, src) => void doModerate(a, id, src)}
            onSetting={p => void doSetting(p)}
            onPin={id => {
              setPinned(id);
              if (isMobile) setPanel(null);
            }}
          />
        )}
      </div>
    </aside>
  );

  return (
    <div dir={dir} className="meet-shell relative flex h-[100dvh] flex-col overflow-hidden bg-[#0b0e14] text-white">
      <RoomAudioRenderer />

      {/* En-tête */}
      <header className="flex h-14 shrink-0 items-center gap-3 px-3 sm:px-5">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{props.title}</p>
          <p className="truncate text-[11px] text-white/50">
            {props.roomName} · <Elapsed startedAt={props.startedAt} />
          </p>
        </div>
        {myQuality === ConnectionQuality.Poor || myQuality === ConnectionQuality.Lost ? (
          <span className="hidden items-center gap-1.5 rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-medium text-amber-200 sm:inline-flex">
            <Signal className="h-3.5 w-3.5" />
            {tr("Connexion faible", "اتصال ضعيف", "Weak connection")}
          </span>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="hidden h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-white/80 ring-1 ring-white/10 hover:bg-white/10 sm:inline-flex"
            aria-label={tr("Mise en page", "التخطيط", "Layout")}
          >
            <LayoutGrid className="h-4 w-4" />
            {layout === "grid" ? tr("Grille", "شبكة", "Grid") : layout === "speaker" ? tr("Orateur", "المتحدث", "Speaker") : tr("Auto", "تلقائي", "Auto")}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setLayout("auto")}>
              <Presentation className="me-2 h-4 w-4" />
              {tr("Auto (écran partagé en grand)", "تلقائي (الشاشة المشتركة كبيرة)", "Auto (shared screen large)")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLayout("grid")}>
              <LayoutGrid className="me-2 h-4 w-4" />
              {tr("Grille", "شبكة", "Grid")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLayout("speaker")}>
              <UserSquare2 className="me-2 h-4 w-4" />
              {tr("Orateur", "المتحدث", "Speaker")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          type="button"
          onClick={() => setPanel(p => (p === "people" ? null : "people"))}
          className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-white/80 ring-1 ring-white/10 hover:bg-white/10"
          aria-label={tr("Participants", "المشاركون", "Participants")}
        >
          <Users className="h-4 w-4" />
          <span className="tabular-nums">{participants.length}</span>
          {hands > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-black">
              <Hand className="h-3 w-3" />
              {hands}
            </span>
          )}
        </button>
      </header>

      {/* Bandeaux d'état */}
      {(reconnecting || !canPlayAudio || presenter) && (
        <div className="flex shrink-0 flex-wrap justify-center gap-2 px-3 pb-2">
          {reconnecting && (
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-3 py-1.5 text-xs text-amber-200">
              <WifiOff className="h-3.5 w-3.5" />
              {tr("Connexion perdue, reconnexion…", "انقطع الاتصال، جارٍ إعادة الاتصال…", "Connection lost, reconnecting…")}
            </span>
          )}
          {!canPlayAudio && (
            <button {...startAudioProps} type="button" className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
              <Volume2 className="h-3.5 w-3.5" />
              {tr("Touchez pour activer le son", "اضغط لتشغيل الصوت", "Tap to enable sound")}
            </button>
          )}
          {presenter && (
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/80">
              <MonitorUp className="h-3.5 w-3.5" />
              {tr(`${presenter} présente son écran`, `${presenter} يعرض شاشته`, `${presenter} is presenting`)}
            </span>
          )}
        </div>
      )}

      {/* Scène + panneau */}
      <div className="flex min-h-0 flex-1 gap-3 px-2 pb-2 sm:px-4">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {showBoard ? (
            <div className="relative min-h-0 flex-1">
              <WhiteboardBoard
                store={wb}
                tr={tr}
                title={props.title}
                onClose={toggleBoard}
                captureScreen={screen && wb.canWrite ? captureScreen : null}
              />
              {!props.isHost && hostCam && <BoardCam trackRef={hostCam} isHostView={props.isHost} onPin={togglePin} onModerate={doModerate} tr={tr} />}
            </div>
          ) : mode === "grid" ? (
            <div ref={stageRef} className="relative flex min-h-0 flex-1 items-center justify-center">
              <div
                className="grid content-center justify-center"
                style={{ gridTemplateColumns: `repeat(${g.cols}, ${Math.floor(g.tileW)}px)`, gap: isMobile ? 8 : 12 }}
              >
                {gridItems.map(t => (
                  <div key={`${t.participant.identity}-${t.source}`} style={{ width: g.tileW, height: g.tileH }}>
                    <Tile trackRef={t} isHostView={props.isHost} pinned={pinned === t.participant.identity} onPin={togglePin} onModerate={doModerate} />
                  </div>
                ))}
              </div>
              {pages > 1 && (
                <>
                  <PageButton side="start" disabled={page === 0} onClick={() => setPage(p => p - 1)} rtl={rtl} />
                  <PageButton side="end" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)} rtl={rtl} />
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2 py-0.5 text-[11px] tabular-nums text-white/80">
                    {page + 1} / {pages}
                  </span>
                </>
              )}
            </div>
          ) : (
            <div className={cn("flex min-h-0 flex-1 gap-2 sm:gap-3", isMobile ? "flex-col" : "flex-row")}>
              <div className={cn("relative min-h-0 min-w-0 flex-1", isMobile && focusRef?.source === Track.Source.ScreenShare && "flex items-center")}>
                {focusRef && (
                  <div className={cn("relative h-full w-full", isMobile && focusRef.source === Track.Source.ScreenShare && "h-auto aspect-video")}>
                  <Tile
                    trackRef={focusRef}
                    isHostView={props.isHost}
                    large
                    pinned={!!pinnedRef && focusRef === pinnedRef}
                    onPin={togglePin}
                    onModerate={doModerate}
                  />
                  {focusRef.source === Track.Source.ScreenShare && (
                    <ScreenAnnotator store={wb} tr={tr} shareKey={shareKey} onCopyToBoard={props.isHost ? () => void copyScreenToBoard() : undefined} />
                  )}
                  </div>
                )}
              </div>
              {strip.length > 0 && (
                <div
                  className={cn(
                    "meet-scroll flex shrink-0 gap-2",
                    isMobile ? "h-[96px] flex-row overflow-x-auto" : "w-[220px] flex-col overflow-y-auto xl:w-[260px]",
                  )}
                >
                  {strip.map(t => (
                    <div key={`${t.participant.identity}-${t.source}`} className={cn("shrink-0", isMobile ? "h-full w-[150px]" : "aspect-video w-full")}>
                      <Tile trackRef={t} isHostView={props.isHost} small pinned={pinned === t.participant.identity} onPin={togglePin} onModerate={doModerate} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Réactions flottantes */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            {reactions.map(r => (
              <span key={r.id} className="meet-float absolute bottom-4 flex flex-col items-center" style={{ insetInlineStart: `${r.x}%` }}>
                <span className="text-4xl drop-shadow-lg">{r.emoji}</span>
                <span className="mt-0.5 max-w-[120px] truncate rounded-full bg-black/50 px-2 text-[10px] text-white/90">{r.name}</span>
              </span>
            ))}
          </div>
        </div>
        {!isMobile && panelView}
      </div>
      {isMobile && panelView}

      {/* Barre d'outils */}
      <footer className="flex shrink-0 items-center justify-center gap-2 px-2 pb-[max(12px,env(safe-area-inset-bottom))] pt-1 sm:gap-3">
        <div className="flex items-center gap-1.5 rounded-[28px] bg-[#151b27]/90 p-1.5 shadow-2xl ring-1 ring-white/10 backdrop-blur sm:gap-2 sm:p-2">
          <SplitControl
            on={isMicrophoneEnabled}
            disabled={!can.mic && !isMicrophoneEnabled}
            onClick={() => void toggleMic()}
            IconOn={Mic}
            IconOff={MicOff}
            label={isMicrophoneEnabled ? tr("Couper le micro (M)", "كتم الميكروفون (M)", "Mute (M)") : tr("Activer le micro (M)", "تشغيل الميكروفون (M)", "Unmute (M)")}
            kind="audioinput"
            tr={tr}
          />
          <SplitControl
            on={isCameraEnabled}
            disabled={!can.cam && !isCameraEnabled}
            onClick={() => void toggleCam()}
            IconOn={Camera}
            IconOff={CameraOff}
            label={isCameraEnabled ? tr("Couper la caméra (V)", "إيقاف الكاميرا (V)", "Stop camera (V)") : tr("Activer la caméra (V)", "تشغيل الكاميرا (V)", "Start camera (V)")}
            kind="videoinput"
            tr={tr}
          />
          {screenShareSupported() && !isMobile && (
            <DockButton
              active={isScreenShareEnabled}
              tone={isScreenShareEnabled ? "primary" : "default"}
              disabled={!can.share && !isScreenShareEnabled}
              onClick={() => void toggleShare()}
              label={isScreenShareEnabled ? tr("Arrêter la présentation", "إيقاف العرض", "Stop presenting") : tr("Présenter mon écran", "عرض شاشتي", "Present my screen")}
            >
              {isScreenShareEnabled ? <MonitorOff className="h-5 w-5" /> : <MonitorUp className="h-5 w-5" />}
            </DockButton>
          )}
          <DockButton active={myHand} tone={myHand ? "amber" : "default"} onClick={() => void toggleHand()} label={myHand ? tr("Baisser la main (H)", "إنزال اليد (H)", "Lower hand (H)") : tr("Lever la main (H)", "رفع اليد (H)", "Raise hand (H)")}>
            <Hand className="h-5 w-5" />
          </DockButton>
          {(props.isHost || boardOpen) && (
            <DockButton
              active={showBoard}
              tone={showBoard ? "primary" : "default"}
              onClick={toggleBoard}
              label={
                props.isHost
                  ? boardOpen
                    ? tr("Fermer le tableau blanc (B)", "إغلاق السبورة البيضاء (B)", "Close whiteboard (B)")
                    : tr("Ouvrir le tableau blanc (B)", "فتح السبورة البيضاء (B)", "Open whiteboard (B)")
                  : showBoard
                    ? tr("Revenir à la vidéo (B)", "العودة إلى الفيديو (B)", "Back to video (B)")
                    : tr("Voir le tableau blanc (B)", "عرض السبورة البيضاء (B)", "Show whiteboard (B)")
              }
            >
              <PenLine className="h-5 w-5" />
            </DockButton>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="dock-btn hidden sm:flex" aria-label={tr("Réactions", "تفاعلات", "Reactions")} title={tr("Réactions", "تفاعلات", "Reactions")}>
                <SmilePlus className="h-5 w-5" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" className="w-auto rounded-full border-white/10 bg-[#151b27] p-1.5 text-white">
              <div className="flex gap-0.5">
                {REACTIONS.map(e => (
                  <button key={e} type="button" onClick={() => react(e)} className="flex h-10 w-10 items-center justify-center rounded-full text-2xl transition hover:scale-125 hover:bg-white/10">
                    {e}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <DockButton
            active={panel === "chat"}
            onClick={() => setPanel(p => (p === "chat" ? null : "chat"))}
            label={tr("Chat (C)", "الدردشة (C)", "Chat (C)")}
            badge={unread > 0 ? (unread > 9 ? "9+" : String(unread)) : undefined}
          >
            <MessageSquare className="h-5 w-5" />
          </DockButton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="dock-btn flex" aria-label={tr("Plus d'options", "خيارات أخرى", "More options")} title={tr("Plus d'options", "خيارات أخرى", "More options")}>
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="center" className="w-64">
              {isMobile && (
                <>
                  <DropdownMenuLabel className="flex justify-between gap-1 px-1">
                    {REACTIONS.slice(0, 6).map(e => (
                      <button key={e} type="button" onClick={() => react(e)} className="flex h-9 w-9 items-center justify-center rounded-full text-xl hover:bg-muted">
                        {e}
                      </button>
                    ))}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isCameraEnabled && (
                    <DropdownMenuItem onClick={() => void flipCam()}>
                      <SwitchCamera className="me-2 h-4 w-4" />
                      {tr("Changer de caméra", "تبديل الكاميرا", "Switch camera")}
                    </DropdownMenuItem>
                  )}
                  {screenShareSupported() && can.share && (
                    <DropdownMenuItem onClick={() => void toggleShare()}>
                      <MonitorUp className="me-2 h-4 w-4" />
                      {isScreenShareEnabled ? tr("Arrêter la présentation", "إيقاف العرض", "Stop presenting") : tr("Présenter mon écran", "عرض شاشتي", "Present my screen")}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => setLayout(l => (l === "grid" ? "auto" : "grid"))}>
                    <LayoutGrid className="me-2 h-4 w-4" />
                    {layout === "grid" ? tr("Mise en page auto", "تخطيط تلقائي", "Auto layout") : tr("Afficher en grille", "عرض شبكي", "Grid view")}
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem onClick={() => setPanel("people")}>
                <Users className="me-2 h-4 w-4" />
                {tr("Participants (P)", "المشاركون (P)", "Participants (P)")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                <Settings2 className="me-2 h-4 w-4" />
                {tr("Réglages audio et vidéo", "إعدادات الصوت والصورة", "Audio & video settings")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (document.fullscreenElement) void document.exitFullscreen();
                  else void document.documentElement.requestFullscreen?.().catch(() => undefined);
                }}
              >
                <Expand className="me-2 h-4 w-4" />
                {tr("Plein écran", "ملء الشاشة", "Full screen")}
              </DropdownMenuItem>
              {props.isHost && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled={busy === "mute_all"} onClick={() => void doModerate("mute_all")}>
                    <MicOff className="me-2 h-4 w-4" />
                    {tr("Couper tous les micros", "كتم جميع الميكروفونات", "Mute everyone")}
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={hands === 0} onClick={() => void doModerate("lower_all")}>
                    <Hand className="me-2 h-4 w-4" />
                    {tr("Baisser toutes les mains", "إنزال جميع الأيدي", "Lower all hands")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <LeaveButton isHost={props.isHost} tr={tr} onLeave={props.onLeave} />
      </footer>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md" dir={dir}>
          <DialogHeader>
            <DialogTitle>{tr("Réglages audio et vidéo", "إعدادات الصوت والصورة", "Audio & video settings")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <DevicePicker kind="audioinput" label={tr("Micro", "الميكروفون", "Microphone")} />
            <DevicePicker kind="videoinput" label={tr("Caméra", "الكاميرا", "Camera")} />
            <DevicePicker kind="audiooutput" label={tr("Haut-parleur", "مكبر الصوت", "Speaker")} />
            <label className="flex items-start gap-3 rounded-lg border p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{tr("Économiser les données", "توفير البيانات", "Data saver")}</p>
                <p className="text-xs text-muted-foreground">
                  {tr(
                    "N'afficher que la vidéo du professeur et l'écran partagé (utile en 4G).",
                    "عرض فيديو الأستاذ والشاشة المشتركة فقط (مفيد مع 4G).",
                    "Only show the teacher's video and the shared screen (useful on mobile data).",
                  )}
                </p>
              </div>
              <Switch checked={saveData} onCheckedChange={setSaveData} />
            </label>
            <p className="text-xs text-muted-foreground">
              {tr("Raccourcis : M micro · V caméra · H main · C chat · P participants · B tableau blanc", "اختصارات: M ميكروفون · V كاميرا · H يد · C دردشة · P مشاركون · B السبورة", "Shortcuts: M mic · V camera · H hand · C chat · P people · B whiteboard")}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------- tuiles
const Tile = memo(function Tile({
  trackRef,
  isHostView,
  large,
  small,
  pinned,
  onPin,
  onModerate,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  isHostView: boolean;
  large?: boolean;
  small?: boolean;
  pinned?: boolean;
  onPin: (identity: string) => void;
  onModerate: (action: "mute" | "remove", identity?: string, source?: "microphone" | "camera" | "screen_share") => void;
}) {
  const { tr } = useTr();
  const p = trackRef.participant;
  const isScreen = trackRef.source === Track.Source.ScreenShare;
  const speaking = useIsSpeaking(p);
  const { quality } = useConnectionQualityIndicator({ participant: p });
  const pub = trackRef.publication;
  // Hooks abonnés : la tuile se met à jour seule (micro, main levée) sans redessiner toute la salle
  const micMuted = useIsMuted({ participant: p, source: Track.Source.Microphone } as TrackReferenceOrPlaceholder);
  const camMuted = useIsMuted(trackRef);
  useParticipantAttributes({ participant: p });
  const micOn = !micMuted;
  const hasVideo = isTrackReference(trackRef) && !!pub && !camMuted && (p.isLocal || (pub as RemoteTrackPublication).isSubscribed);
  const hand = handOf(p) > 0;
  const host = roleOf(p) === "host";
  const name = p.name || tr("Participant", "مشارك", "Participant");
  const boxRef = useRef<HTMLDivElement>(null);

  // Qualité demandée selon la taille de la tuile (adaptiveStream le fait aussi)
  useEffect(() => {
    if (p.isLocal || !pub) return;
    try {
      (pub as RemoteTrackPublication).setVideoQuality?.(large || isScreen ? VideoQuality.HIGH : small ? VideoQuality.LOW : VideoQuality.MEDIUM);
    } catch {
      /* ignore */
    }
  }, [pub, large, small, isScreen, p.isLocal]);

  return (
    <div
      ref={boxRef}
      className={cn(
        "group relative h-full w-full overflow-hidden bg-[#161c28] ring-1 transition-[box-shadow] duration-200",
        small ? "rounded-xl" : "rounded-2xl sm:rounded-3xl",
        speaking && !isScreen ? "ring-2 ring-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.15)]" : "ring-white/10",
      )}
    >
      {hasVideo ? (
        <VideoTrack
          trackRef={trackRef as any}
          className={cn("h-full w-full", isScreen ? "bg-black object-contain" : "object-cover", p.isLocal && !isScreen && "-scale-x-100")}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <div className="relative">
            {speaking && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30" />}
            <Avatar id={p.identity} name={name} size={small ? 40 : large ? 112 : 72} />
          </div>
        </div>
      )}

      {/* Haut : main, badge prof, qualité */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2">
        <div className="flex gap-1.5">
          {hand && (
            <span className="meet-wave flex h-8 items-center gap-1 rounded-full bg-amber-400 px-2.5 text-xs font-bold text-black shadow">
              <Hand className="h-4 w-4" />
              {!small && tr("Main levée", "يد مرفوعة", "Hand raised")}
            </span>
          )}
          {pinned && (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 backdrop-blur">
              <Pin className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
        {(quality === ConnectionQuality.Poor || quality === ConnectionQuality.Lost) && (
          <span className="flex h-7 items-center rounded-full bg-black/50 px-2 text-amber-300 backdrop-blur" title={tr("Connexion faible", "اتصال ضعيف", "Weak connection")}>
            <Signal className="h-3.5 w-3.5" />
          </span>
        )}
      </div>

      {/* Bas : nom */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/60 to-transparent p-2 pt-6">
        <span className={cn("flex min-w-0 items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 backdrop-blur", small ? "text-[11px]" : "text-xs")}>
          {!isScreen && (micOn ? <Mic className={cn("h-3.5 w-3.5 shrink-0", speaking && "text-emerald-400")} /> : <MicOff className="h-3.5 w-3.5 shrink-0 text-rose-400" />)}
          {isScreen && <MonitorUp className="h-3.5 w-3.5 shrink-0" />}
          <span className="truncate font-medium">
            {isScreen ? tr(`Écran de ${name}`, `شاشة ${name}`, `${name}'s screen`) : p.isLocal ? `${name} (${tr("vous", "أنت", "you")})` : name}
          </span>
          {host && !isScreen && <span className="shrink-0 rounded bg-amber-400/90 px-1 text-[9px] font-bold uppercase text-black">{tr("Prof", "أستاذ", "Teacher")}</span>}
        </span>
      </div>

      {/* Actions au survol */}
      <div className="absolute end-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
        <TileAction label={pinned ? tr("Désépingler", "إلغاء التثبيت", "Unpin") : tr("Épingler", "تثبيت", "Pin")} onClick={() => onPin(p.identity)}>
          {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        </TileAction>
        {isScreen && (
          <TileAction label={tr("Plein écran", "ملء الشاشة", "Full screen")} onClick={() => void boxRef.current?.requestFullscreen?.().catch(() => undefined)}>
            <Expand className="h-4 w-4" />
          </TileAction>
        )}
        {isHostView && !p.isLocal && micOn && !isScreen && (
          <TileAction label={tr("Couper son micro", "كتم ميكروفونه", "Mute")} onClick={() => onModerate("mute", p.identity, "microphone")}>
            <MicOff className="h-4 w-4" />
          </TileAction>
        )}
      </div>
    </div>
  );
});

/** Petite vidéo du professeur posée sur le tableau blanc (élèves) */
function BoardCam(props: {
  trackRef: TrackReferenceOrPlaceholder;
  isHostView: boolean;
  onPin: (identity: string) => void;
  onModerate: (action: "mute" | "remove", identity?: string, source?: "microphone" | "camera" | "screen_share") => void;
  tr: (fr: string, ar: string, en?: string) => string;
}) {
  const [hidden, setHidden] = useState(false);
  if (hidden)
    return (
      <button
        type="button"
        onClick={() => setHidden(false)}
        className="absolute bottom-3 end-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#151b27]/90 text-white shadow-xl ring-1 ring-white/15 max-md:bottom-[76px]"
        aria-label={props.tr("Afficher la vidéo du professeur", "عرض فيديو الأستاذ", "Show the teacher's video")}
      >
        <Camera className="h-4 w-4" />
      </button>
    );
  return (
    <div className="group/cam absolute bottom-3 end-3 z-10 aspect-video w-[150px] shadow-2xl max-md:bottom-[76px] sm:w-[220px]">
      <Tile trackRef={props.trackRef} isHostView={props.isHostView} small onPin={props.onPin} onModerate={props.onModerate} />
      <button
        type="button"
        onClick={() => setHidden(true)}
        className="absolute -top-2 start-[-8px] flex h-6 w-6 items-center justify-center rounded-full bg-[#151b27] text-white opacity-0 shadow ring-1 ring-white/20 transition group-hover/cam:opacity-100 max-md:opacity-100"
        aria-label={props.tr("Masquer", "إخفاء", "Hide")}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function TileAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur hover:bg-black/75">
      {children}
    </button>
  );
}

function PageButton({ side, disabled, onClick, rtl }: { side: "start" | "end"; disabled: boolean; onClick: () => void; rtl: boolean }) {
  const prev = side === "start";
  const Icon = prev !== rtl ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "absolute top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70 disabled:opacity-0",
        prev ? "start-1" : "end-1",
      )}
      aria-label={prev ? "‹" : "›"}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

// ---------------------------------------------------------------------- barre d'outils
function DockButton({
  active,
  tone = "default",
  disabled,
  onClick,
  label,
  badge,
  children,
}: {
  active?: boolean;
  tone?: "default" | "primary" | "amber" | "danger";
  disabled?: boolean;
  onClick: () => void;
  label: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "dock-btn relative flex",
        active && tone === "default" && "bg-white/20",
        tone === "primary" && "bg-primary text-primary-foreground hover:bg-primary",
        tone === "amber" && "bg-amber-400 text-black hover:bg-amber-300",
        tone === "danger" && "bg-rose-500 hover:bg-rose-600",
        disabled && "opacity-40",
      )}
    >
      {children}
      {badge && (
        <span className="absolute -end-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-[#151b27]">
          {badge}
        </span>
      )}
    </button>
  );
}

function SplitControl({
  on,
  disabled,
  onClick,
  IconOn,
  IconOff,
  label,
  kind,
  tr,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  IconOn: any;
  IconOff: any;
  label: string;
  kind: MediaDeviceKind;
  tr: (fr: string, ar: string, en?: string) => string;
}) {
  const Icon = on ? IconOn : IconOff;
  return (
    <div className={cn("flex items-center rounded-full", on ? "bg-white/10" : "bg-rose-500", disabled && "opacity-40")}>
      <button type="button" onClick={onClick} aria-label={label} title={label} aria-pressed={on} className="flex h-11 w-11 items-center justify-center rounded-full transition hover:bg-white/10 sm:h-12 sm:w-12">
        <Icon className="h-5 w-5" />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="hidden h-11 w-6 items-center justify-center rounded-full pe-1 text-white/70 hover:text-white sm:flex sm:h-12"
          aria-label={kind === "audioinput" ? tr("Choisir le micro", "اختيار الميكروفون", "Choose microphone") : tr("Choisir la caméra", "اختيار الكاميرا", "Choose camera")}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-72">
          <DeviceMenu kind={kind} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function DeviceMenu({ kind }: { kind: MediaDeviceKind }) {
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({ kind, requestPermissions: false });
  if (devices.length === 0) return <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">—</DropdownMenuLabel>;
  return (
    <>
      {devices.map((d, i) => (
        <DropdownMenuItem key={d.deviceId} onClick={() => void setActiveMediaDevice(d.deviceId)} className={cn(d.deviceId === activeDeviceId && "font-semibold")}>
          <span className={cn("me-2 h-2 w-2 shrink-0 rounded-full", d.deviceId === activeDeviceId ? "bg-primary" : "bg-transparent")} />
          <span className="truncate">{d.label || `${kind} ${i + 1}`}</span>
        </DropdownMenuItem>
      ))}
    </>
  );
}

function DevicePicker({ kind, label }: { kind: MediaDeviceKind; label: string }) {
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({ kind, requestPermissions: false });
  if (devices.length === 0) return null;
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      <select
        value={activeDeviceId}
        onChange={e => void setActiveMediaDevice(e.target.value)}
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
      >
        {devices.map((d, i) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `${label} ${i + 1}`}
          </option>
        ))}
      </select>
    </label>
  );
}

function LeaveButton({ isHost, tr, onLeave }: { isHost: boolean; tr: (fr: string, ar: string, en?: string) => string; onLeave: (endForAll: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const base = "flex h-12 items-center justify-center gap-2 rounded-full bg-rose-500 px-4 text-sm font-semibold text-white shadow-lg shadow-rose-900/40 transition hover:bg-rose-600 sm:h-14 sm:px-5";
  if (!isHost)
    return (
      <button type="button" onClick={() => onLeave(false)} className={base} aria-label={tr("Quitter", "مغادرة", "Leave")}>
        <PhoneOff className="h-5 w-5" />
        <span className="hidden sm:inline">{tr("Quitter", "مغادرة", "Leave")}</span>
      </button>
    );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={base} aria-label={tr("Quitter ou terminer", "مغادرة أو إنهاء", "Leave or end")}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <PhoneOff className="h-5 w-5" />}
          <span className="hidden sm:inline">{tr("Quitter", "مغادرة", "Leave")}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="w-72">
        <DropdownMenuItem
          className="flex-col items-start gap-0.5 py-2.5 text-rose-600 focus:text-rose-600"
          onClick={() => {
            setBusy(true);
            onLeave(true);
          }}
        >
          <span className="font-semibold">{tr("Terminer pour tout le monde", "إنهاء للجميع", "End for everyone")}</span>
          <span className="text-xs font-normal text-muted-foreground">{tr("Les élèves sont déconnectés, le rapport de présence est prêt.", "يتم فصل التلاميذ، وتقرير الحضور جاهز.", "Students are disconnected; the attendance report is ready.")}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="flex-col items-start gap-0.5 py-2.5" onClick={() => onLeave(false)}>
          <span className="font-semibold">{tr("Quitter seulement", "المغادرة فقط", "Just leave")}</span>
          <span className="text-xs font-normal text-muted-foreground">{tr("La réunion continue sans vous (20 min max).", "يستمر الاجتماع بدونك (20 دقيقة كحد أقصى).", "The meeting continues without you (20 min max).")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Durée de la réunion : seule cette petite étiquette se redessine chaque seconde */
function Elapsed({ startedAt }: { startedAt?: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="tabular-nums">{clock(startedAt ? now - new Date(startedAt).getTime() : 0)}</span>;
}

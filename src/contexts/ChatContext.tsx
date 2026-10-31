"use client";

/**
 * Messagerie élève ↔ professeur, partie globale (montée dans MainLayout) :
 *   • liste des contacts / discussions et total des non-lus (badge du menu)
 *   • présence (« en ligne », « vu à »)
 *   • appels vocaux WebRTC : sonnerie entrante sur toutes les pages, appel sortant,
 *     signalisation par Supabase Realtime (canal privé « call:<discussion> »)
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { db, fetchContacts, type ChatCall, type ChatContact } from "@/lib/chat";
import { openChannel } from "@/lib/chatRealtime";
import { CallOverlay } from "@/components/chat/CallOverlay";

export type CallPhase = "outgoing" | "incoming" | "connecting" | "active" | "ended";

export interface CallState {
  call: ChatCall;
  peer: { id: string; name: string; avatar_url: string | null };
  phase: CallPhase;
  outgoing: boolean;
  muted: boolean;
  speaker: boolean;
  connectedAt: number | null;
  endedReason?: string;
  minimized: boolean;
  quality?: "good" | "poor";
  /** Appel vidéo demandé à l'appel */
  video: boolean;
  /** Ma caméra allumée / celle de l'autre */
  camOn: boolean;
  remoteCam: boolean;
  facing: "user" | "environment";
}

interface ChatContextType {
  enabled: boolean;
  contacts: ChatContact[] | null;
  unread: number;
  refresh: () => Promise<void>;
  call: CallState | null;
  startCall: (contact: ChatContact, video?: boolean) => Promise<void>;
  acceptCall: (withVideo?: boolean) => Promise<void>;
  toggleCamera: () => Promise<void>;
  switchCamera: () => Promise<void>;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  declineCall: () => Promise<void>;
  hangUp: () => Promise<void>;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  setMinimized: (v: boolean) => void;
  /** Discussion ouverte à l'écran (ses messages ne comptent pas comme non lus) */
  setActiveConversation: (id: string | null) => void;
  allowCalls: boolean;
  setAllowCalls: (v: boolean) => Promise<void>;
}

const Ctx = createContext<ChatContextType | null>(null);
export const useChat = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useChat hors de ChatProvider");
  return c;
};
/** Version sûre (renvoie null hors du fournisseur, ex. espace admin) */
export const useChatOptional = () => useContext(Ctx);

const RING_TIMEOUT = 45_000;

function iceServers(): RTCIceServer[] {
  const list: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  const turn = process.env.NEXT_PUBLIC_TURN_URL;
  if (turn) {
    list.push({
      urls: turn.split(",").map(s => s.trim()).filter(Boolean),
      username: process.env.NEXT_PUBLIC_TURN_USERNAME || undefined,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || undefined,
    });
  }
  return list;
}

/** Sonneries générées (aucun fichier) : entrante = deux notes, sortante = tonalité d'attente */
class Tone {
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  start(kind: "ring" | "back") {
    this.stop();
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const beep = () => {
        const ctx = this.ctx;
        if (!ctx) return;
        const notes = kind === "ring" ? [[880, 0], [660, 0.22], [880, 0.6], [660, 0.82]] : [[425, 0]];
        notes.forEach(([f, at]) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.frequency.value = f;
          o.type = "sine";
          const len = kind === "ring" ? 0.2 : 1;
          g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
          g.gain.exponentialRampToValueAtTime(kind === "ring" ? 0.25 : 0.12, ctx.currentTime + at + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + len);
          o.connect(g).connect(ctx.destination);
          o.start(ctx.currentTime + at);
          o.stop(ctx.currentTime + at + len + 0.05);
        });
        if (kind === "ring") try { navigator.vibrate?.([300, 200, 300]); } catch { /* ignore */ }
      };
      beep();
      this.timer = setInterval(beep, kind === "ring" ? 2500 : 3000);
    } catch {
      /* son bloqué par le navigateur : l'écran d'appel suffit */
    }
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    try { void this.ctx?.close(); } catch { /* ignore */ }
    this.ctx = null;
    try { navigator.vibrate?.(0); } catch { /* ignore */ }
  }
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { feature } = useAppSettings();
  const tr = useCallback((fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr), [language]);
  const enabled = !!user && (user.role === "student" || user.role === "professor") && feature("chat");
  const uid = user?.id;

  const [contacts, setContacts] = useState<ChatContact[] | null>(null);
  const [call, setCall] = useState<CallState | null>(null);
  const [allowCalls, setAllowCallsState] = useState(true);
  const activeConv = useRef<string | null>(null);
  const contactsRef = useRef<ChatContact[] | null>(null);
  contactsRef.current = contacts;

  // ------------------------------------------------------------------ contacts
  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      setContacts(await fetchContacts());
    } catch (e) {
      // Migration pas encore passée : la messagerie reste invisible
      console.warn("chat_contacts", e);
      setContacts(prev => prev ?? []);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) { setContacts(null); return; }
    void refresh();
    void db.from("chat_settings").select("allow_calls").maybeSingle().then(({ data }: any) => {
      if (data) setAllowCallsState(data.allow_calls !== false);
    });
  }, [enabled, refresh]);

  // Présence : toutes les 60 s quand la page est visible
  useEffect(() => {
    if (!enabled) return;
    const beat = () => { if (document.visibilityState !== "hidden") void db.rpc("chat_heartbeat"); };
    beat();
    const t = setInterval(beat, 60_000);
    const onVis = () => { if (document.visibilityState === "visible") { beat(); void refresh(); } };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [enabled, refresh]);

  // ------------------------------------------------------------------ appels : moteur WebRTC
  const pc = useRef<RTCPeerConnection | null>(null);
  const local = useRef<MediaStream | null>(null);
  const remoteAudio = useRef<HTMLAudioElement | null>(null);
  const signal = useRef<{ channel: any; close: () => void } | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const videoSender = useRef<RTCRtpSender | null>(null);
  const wakeLock = useRef<any>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const tone = useRef(new Tone());
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lostTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callRef = useRef<CallState | null>(null);
  callRef.current = call;

  const patch = (p: Partial<CallState>) => setCall(c => (c ? { ...c, ...p } : c));

  const cleanup = useCallback(() => {
    tone.current.stop();
    if (ringTimer.current) clearTimeout(ringTimer.current);
    if (readyTimer.current) clearInterval(readyTimer.current);
    if (lostTimer.current) clearTimeout(lostTimer.current);
    ringTimer.current = readyTimer.current = lostTimer.current = null;
    try { pc.current?.close(); } catch { /* ignore */ }
    pc.current = null;
    local.current?.getTracks().forEach(t => t.stop());
    local.current = null;
    videoSender.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    try { void wakeLock.current?.release(); } catch { /* ignore */ }
    wakeLock.current = null;
    if (remoteAudio.current) { remoteAudio.current.srcObject = null; }
    signal.current?.close();
    signal.current = null;
    pendingIce.current = [];
  }, []);

  /** Fin d'appel affichée 2 s puis fermeture de l'écran */
  const finish = useCallback((reason: string) => {
    cleanup();
    setCall(c => (c ? { ...c, phase: "ended", endedReason: reason, minimized: false } : c));
    setTimeout(() => setCall(c => (c && c.phase === "ended" ? null : c)), 2200);
  }, [cleanup]);

  const send = (event: string, payload: Record<string, unknown> = {}) => {
    try { void signal.current?.channel.send({ type: "broadcast", event, payload: { ...payload, from: uid } }); } catch { /* ignore */ }
  };

  /** Micro (+ caméra HD si appel vidéo). Sans caméra disponible : l'appel continue en vocal. */
  const camConstraints = (facing: "user" | "environment"): MediaTrackConstraints => ({
    facingMode: facing,
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
  });
  const getMedia = async (video: boolean, facing: "user" | "environment" = "user") => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("nomic");
    const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true } as MediaTrackConstraints;
    if (video) {
      try {
        return await navigator.mediaDevices.getUserMedia({ audio, video: camConstraints(facing) });
      } catch {
        toast.error(tr("Caméra indisponible : l'appel passe en vocal.", "الكاميرا غير متاحة: المكالمة صوتية.", "Camera unavailable: voice only."));
      }
    }
    return navigator.mediaDevices.getUserMedia({ audio, video: false });
  };

  /** Haute qualité : jusqu'à 2,5 Mb/s et 30 i/s ; le navigateur baisse seul si le réseau faiblit */
  const tuneVideo = async (sender: RTCRtpSender | null, facing: "user" | "environment") => {
    if (!sender?.track) return;
    try { (sender.track as any).contentHint = facing === "environment" ? "detail" : "motion"; } catch { /* ignore */ }
    try {
      const params: any = sender.getParameters();
      if (!params.encodings || !params.encodings.length) params.encodings = [{}];
      params.encodings[0].maxBitrate = 2_500_000;
      params.encodings[0].maxFramerate = 30;
      params.degradationPreference = facing === "environment" ? "maintain-resolution" : "balanced";
      await sender.setParameters(params);
    } catch { /* navigateur ancien : réglages par défaut */ }
  };

  const makePeer = () => {
    const p = new RTCPeerConnection({ iceServers: iceServers(), bundlePolicy: "max-bundle" } as RTCConfiguration);
    pc.current = p;
    p.onicecandidate = e => { if (e.candidate) send("ice", { candidate: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate }); };
    // Un seul flux distant (son + image), quel que soit l'ordre d'arrivée des pistes
    const ms = new MediaStream();
    p.ontrack = e => {
      if (!ms.getTracks().includes(e.track)) ms.addTrack(e.track);
      setRemoteStream(new MediaStream(ms.getTracks()));
      if (e.track.kind === "video") {
        e.track.onunmute = () => { setRemoteStream(new MediaStream(ms.getTracks())); };
      }
      if (!remoteAudio.current) return;
      if (remoteAudio.current.srcObject !== ms) remoteAudio.current.srcObject = ms;
      void remoteAudio.current.play().catch(() => { /* lecture relancée au prochain geste */ });
    };
    const onState = () => {
      const s = (p as any).connectionState || p.iceConnectionState;
      if (s === "connected" || s === "completed") {
        if (lostTimer.current) { clearTimeout(lostTimer.current); lostTimer.current = null; }
        tone.current.stop();
        const cur = callRef.current;
        if (cur && cur.phase !== "active") {
          send("media", { call: cur.call.id, video: cur.camOn });
          void tuneVideo(videoSender.current, cur.facing);
          if (cur.video) { try { void (navigator as any).wakeLock?.request("screen").then((l: any) => { wakeLock.current = l; }); } catch { /* ignore */ } }
        }
        setCall(c => (c && c.phase !== "ended" ? { ...c, phase: "active", connectedAt: c.connectedAt ?? Date.now(), quality: "good" } : c));
      } else if (s === "disconnected") {
        patch({ quality: "poor" });
        if (!lostTimer.current) lostTimer.current = setTimeout(() => void endWith("failed"), 15_000);
      } else if (s === "failed") {
        void endWith("failed");
      }
    };
    p.oniceconnectionstatechange = onState;
    (p as any).onconnectionstatechange = onState;
    return p;
  };

  /** Appelant : micro + une voie vidéo toujours prévue (la caméra peut s'allumer en cours d'appel) */
  const attachCaller = (p: RTCPeerConnection) => {
    const st = local.current;
    st?.getAudioTracks().forEach(t => p.addTrack(t, st));
    const v = st?.getVideoTracks()[0];
    if (typeof p.addTransceiver === "function") {
      const tx = p.addTransceiver(v || "video", { direction: "sendrecv", streams: st ? [st] : [] } as RTCRtpTransceiverInit);
      videoSender.current = tx.sender;
    } else if (v && st) {
      videoSender.current = p.addTrack(v, st);
    }
  };
  /** Appelé : après l'offre, on réutilise les voies proposées */
  const attachCallee = (p: RTCPeerConnection) => {
    const st = local.current;
    st?.getAudioTracks().forEach(t => p.addTrack(t, st));
    const v = st?.getVideoTracks()[0] || null;
    const tx = p.getTransceivers?.().find(t => t.receiver.track?.kind === "video");
    if (tx) {
      tx.direction = "sendrecv";
      try { if (st) (tx.sender as any).setStreams?.(st); } catch { /* ignore */ }
      if (v) void tx.sender.replaceTrack(v);
      videoSender.current = tx.sender;
    } else if (v && st) {
      videoSender.current = p.addTrack(v, st);
    }
  };

  const flushIce = async () => {
    const p = pc.current;
    if (!p || !p.remoteDescription) return;
    const list = pendingIce.current.splice(0);
    for (const c of list) { try { await p.addIceCandidate(c); } catch { /* ignore */ } }
  };

  const openSignal = async (convId: string, callId: string, outgoing: boolean) => {
    signal.current = await openChannel(`call:${convId}`, ch => {
      ch.on("broadcast", { event: "ready" }, async ({ payload }: any) => {
        if (!outgoing || payload.call !== callId || pc.current) return;
        // L'appelé a décroché et écoute : on envoie l'offre
        tone.current.stop();
        patch({ phase: "connecting" });
        const p = makePeer();
        attachCaller(p);
        const offer = await p.createOffer();
        await p.setLocalDescription(offer);
        send("offer", { call: callId, sdp: p.localDescription });
      });
      ch.on("broadcast", { event: "offer" }, async ({ payload }: any) => {
        if (outgoing || payload.call !== callId || pc.current) return;
        if (readyTimer.current) { clearInterval(readyTimer.current); readyTimer.current = null; }
        const p = makePeer();
        await p.setRemoteDescription(payload.sdp);
        attachCallee(p);
        await flushIce();
        const answer = await p.createAnswer();
        await p.setLocalDescription(answer);
        send("answer", { call: callId, sdp: p.localDescription });
      });
      ch.on("broadcast", { event: "answer" }, async ({ payload }: any) => {
        if (!outgoing || payload.call !== callId || !pc.current) return;
        await pc.current.setRemoteDescription(payload.sdp);
        await flushIce();
      });
      ch.on("broadcast", { event: "ice" }, async ({ payload }: any) => {
        if (!payload?.candidate) return;
        if (pc.current?.remoteDescription) { try { await pc.current.addIceCandidate(payload.candidate); } catch { /* ignore */ } }
        else pendingIce.current.push(payload.candidate);
      });
      ch.on("broadcast", { event: "media" }, ({ payload }: any) => {
        if (payload.call === callId) patch({ remoteCam: !!payload.video });
      });
      ch.on("broadcast", { event: "hangup" }, ({ payload }: any) => {
        if (payload.call === callId && callRef.current?.call.id === callId) finish(callRef.current.phase === "active" ? "ended" : "cancelled");
      });
    });
  };

  const endWith = useCallback(async (action: "end" | "cancel" | "decline" | "missed" | "failed") => {
    const c = callRef.current;
    if (!c || c.phase === "ended") return;
    send("hangup", { call: c.call.id });
    finish(action === "end" ? "ended" : action === "cancel" ? "cancelled" : action === "decline" ? "declined" : action);
    try { await db.rpc("chat_call_update", { p_call: c.call.id, p_action: action }); } catch { /* ignore */ }
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finish, refresh]);

  const startCall = useCallback(async (contact: ChatContact, video = false) => {
    if (callRef.current) { toast.error(tr("Un appel est déjà en cours.", "مكالمة جارية بالفعل.", "A call is already in progress.")); return; }
    if (typeof RTCPeerConnection === "undefined") {
      toast.error(tr("Ce navigateur ne permet pas les appels.", "هذا المتصفح لا يدعم المكالمات.", "This browser can't make calls."));
      return;
    }
    if (!contact.conversation_id) {
      const { data, error } = await db.rpc("chat_open", { p_other: contact.user_id });
      if (error) { toast.error(error.message); return; }
      contact = { ...contact, conversation_id: data };
    }
    try {
      local.current = await getMedia(video);
      setLocalStream(local.current);
    } catch {
      toast.error(tr("Micro indisponible : autorisez le micro dans le navigateur.", "الميكروفون غير متاح: اسمح به في المتصفح.", "Microphone unavailable: allow it in your browser."));
      return;
    }
    const camOn = !!local.current.getVideoTracks().length;
    let res = await db.rpc("chat_call_start", { p_conv: contact.conversation_id, p_video: video });
    // Base pas encore à jour (sans appel vidéo) : ancienne fonction
    if (res.error && /p_video|function/i.test(res.error.message || "")) res = await db.rpc("chat_call_start", { p_conv: contact.conversation_id });
    const { data, error } = res;
    if (error || !data) {
      cleanup();
      toast.error(error?.message || tr("Appel impossible", "تعذر الاتصال", "Call failed"));
      return;
    }
    const row = data as ChatCall;
    setCall({
      call: row, peer: { id: contact.user_id, name: contact.name, avatar_url: contact.avatar_url },
      phase: "outgoing", outgoing: true, muted: false, speaker: video, connectedAt: null, minimized: false,
      video, camOn, remoteCam: false, facing: "user",
    });
    await openSignal(row.conversation_id, row.id, true);
    tone.current.start("back");
    ringTimer.current = setTimeout(() => {
      if (callRef.current?.call.id === row.id && callRef.current.phase === "outgoing") void endWith("missed");
    }, RING_TIMEOUT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tr, cleanup, endWith]);

  const acceptCall = useCallback(async (withVideo?: boolean) => {
    const c = callRef.current;
    if (!c || c.phase !== "incoming") return;
    tone.current.stop();
    if (ringTimer.current) clearTimeout(ringTimer.current);
    try {
      local.current = await getMedia(withVideo ?? c.video);
      setLocalStream(local.current);
      patch({ camOn: !!local.current.getVideoTracks().length, speaker: !!(withVideo ?? c.video) });
    } catch {
      toast.error(tr("Micro indisponible : autorisez le micro dans le navigateur.", "الميكروفون غير متاح: اسمح به في المتصفح.", "Microphone unavailable: allow it in your browser."));
      void endWith("decline");
      return;
    }
    // Débloque la lecture audio sur iOS pendant le geste
    try { void remoteAudio.current?.play().catch(() => {}); } catch { /* ignore */ }
    const { data, error } = await db.rpc("chat_call_update", { p_call: c.call.id, p_action: "accept" });
    if (error || (data && data.status !== "accepted")) {
      finish("cancelled");
      return;
    }
    patch({ phase: "connecting" });
    await openSignal(c.call.conversation_id, c.call.id, false);
    let tries = 0;
    const ready = () => {
      if (pc.current || ++tries > 15) { if (readyTimer.current) clearInterval(readyTimer.current); return; }
      send("ready", { call: c.call.id });
    };
    ready();
    readyTimer.current = setInterval(ready, 1500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tr, endWith, finish]);

  const declineCall = useCallback(() => endWith("decline"), [endWith]);
  const hangUp = useCallback(async () => {
    const c = callRef.current;
    if (!c) return;
    if (c.phase === "ended") { setCall(null); return; }
    await endWith(c.phase === "outgoing" ? "cancel" : c.phase === "incoming" ? "decline" : "end");
  }, [endWith]);

  const toggleMute = useCallback(() => {
    const c = callRef.current;
    if (!c) return;
    const muted = !c.muted;
    local.current?.getAudioTracks().forEach(t => { t.enabled = !muted; });
    patch({ muted });
  }, []);

  /** Allumer / couper ma caméra pendant l'appel (sans renégocier : la voie vidéo existe déjà) */
  const toggleCamera = useCallback(async () => {
    const c = callRef.current;
    const st = local.current;
    if (!c || !st) return;
    if (c.camOn) {
      st.getVideoTracks().forEach(t => { t.stop(); st.removeTrack(t); });
      try { await videoSender.current?.replaceTrack(null); } catch { /* ignore */ }
      patch({ camOn: false });
      setLocalStream(new MediaStream(st.getTracks()));
      send("media", { call: c.call.id, video: false });
      return;
    }
    if (!videoSender.current && c.phase === "active") {
      toast.error(tr("Ce navigateur ne peut pas ajouter la vidéo en cours d'appel.", "هذا المتصفح لا يدعم إضافة الفيديو أثناء المكالمة.", "This browser can't add video during a call."));
      return;
    }
    try {
      const cam = await navigator.mediaDevices.getUserMedia({ video: camConstraints(c.facing) });
      const track = cam.getVideoTracks()[0];
      st.addTrack(track);
      if (videoSender.current) {
        await videoSender.current.replaceTrack(track);
        void tuneVideo(videoSender.current, c.facing);
      }
      patch({ camOn: true, video: true, speaker: true });
      setLocalStream(new MediaStream(st.getTracks()));
      send("media", { call: c.call.id, video: true });
    } catch {
      toast.error(tr("Caméra indisponible : autorisez la caméra dans le navigateur.", "الكاميرا غير متاحة: اسمح بها في المتصفح.", "Camera unavailable: allow it in your browser."));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tr]);

  /** Caméra avant / arrière (montrer une feuille d'exercice, le tableau…) */
  const switchCamera = useCallback(async () => {
    const c = callRef.current;
    const st = local.current;
    if (!c || !st || !c.camOn) return;
    const facing = c.facing === "user" ? "environment" : "user";
    try {
      const old = st.getVideoTracks()[0];
      old?.stop();
      const cam = await navigator.mediaDevices.getUserMedia({ video: camConstraints(facing) });
      const track = cam.getVideoTracks()[0];
      if (old) st.removeTrack(old);
      st.addTrack(track);
      await videoSender.current?.replaceTrack(track);
      void tuneVideo(videoSender.current, facing);
      patch({ facing });
      setLocalStream(new MediaStream(st.getTracks()));
    } catch {
      toast.error(tr("Impossible de changer de caméra.", "تعذر تبديل الكاميرا.", "Couldn't switch camera."));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tr]);

  const toggleSpeaker = useCallback(() => {
    const c = callRef.current;
    if (!c) return;
    const el = remoteAudio.current as any;
    // Choix de la sortie audio quand le navigateur le permet (ordinateur, Android Chrome)
    if (el && typeof el.setSinkId === "function") {
      navigator.mediaDevices?.enumerateDevices?.().then(list => {
        const outs = list.filter(d => d.kind === "audiooutput");
        const target = !c.speaker ? outs.find(d => /speaker|haut/i.test(d.label)) || outs[0] : outs.find(d => d.deviceId === "default") || outs[0];
        if (target) void el.setSinkId(target.deviceId).catch(() => {});
      }).catch(() => {});
    }
    patch({ speaker: !c.speaker });
  }, []);

  // Appels entrants et changements d'état (toutes les pages)
  useEffect(() => {
    if (!enabled || !uid) return;
    const onRow = async (row: ChatCall, isInsert: boolean) => {
      const cur = callRef.current;
      if (isInsert && row.callee_id === uid && row.status === "ringing") {
        if (Date.now() - new Date(row.created_at).getTime() > RING_TIMEOUT) return;
        if (cur && cur.phase !== "ended") {
          // Déjà en ligne : l'appelant voit « occupé »
          void db.rpc("chat_call_update", { p_call: row.id, p_action: "decline" });
          return;
        }
        let peer = contactsRef.current?.find(c => c.user_id === row.caller_id);
        if (!peer) {
          try { const list = await fetchContacts(); setContacts(list); peer = list.find(c => c.user_id === row.caller_id); } catch { /* ignore */ }
        }
        setCall({
          call: row, peer: { id: row.caller_id, name: peer?.name || tr("Appel entrant", "مكالمة واردة", "Incoming call"), avatar_url: peer?.avatar_url || null },
          phase: "incoming", outgoing: false, muted: false, speaker: false, connectedAt: null, minimized: false,
          video: !!(row as any).video, camOn: false, remoteCam: false, facing: "user",
        });
        tone.current.start("ring");
        try {
          if (document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
            new Notification(peer?.name || tr("Appel entrant", "مكالمة واردة", "Incoming call"), { body: tr("Appel vocal entrant", "مكالمة صوتية واردة", "Incoming voice call"), tag: row.id });
          }
        } catch { /* ignore */ }
        ringTimer.current = setTimeout(() => {
          if (callRef.current?.call.id === row.id && callRef.current.phase === "incoming") finish("missed");
        }, RING_TIMEOUT);
        return;
      }
      if (!cur || cur.call.id !== row.id) return;
      if (row.status === "declined" || row.status === "missed" || row.status === "cancelled" || row.status === "ended" || row.status === "failed") {
        if (cur.phase !== "ended") finish(row.status);
      } else if (row.status === "accepted" && cur.phase === "incoming") {
        // Décroché sur un autre appareil
        cleanup();
        setCall(null);
      } else if (row.status === "accepted" && cur.outgoing && cur.phase === "outgoing") {
        tone.current.stop();
        patch({ phase: "connecting" });
      }
    };
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase.channel(`chat-calls-${uid}-${Math.random().toString(36).slice(2, 8)}`)
        .on("postgres_changes" as any, { event: "INSERT", schema: "public", table: "chat_calls", filter: `callee_id=eq.${uid}` }, (p: any) => void onRow(p.new, true))
        .on("postgres_changes" as any, { event: "UPDATE", schema: "public", table: "chat_calls", filter: `callee_id=eq.${uid}` }, (p: any) => void onRow(p.new, false))
        .on("postgres_changes" as any, { event: "UPDATE", schema: "public", table: "chat_calls", filter: `caller_id=eq.${uid}` }, (p: any) => void onRow(p.new, false))
        .on("postgres_changes" as any, { event: "*", schema: "public", table: "chat_conversations" }, () => void refresh())
        .subscribe();
    } catch (e) {
      console.error("chat realtime", e);
    }
    // Appel qui sonne déjà à l'ouverture de l'application
    void db.from("chat_calls").select("*").eq("callee_id", uid).eq("status", "ringing")
      .gt("created_at", new Date(Date.now() - RING_TIMEOUT).toISOString()).order("created_at", { ascending: false }).limit(1)
      .then(({ data }: any) => { if (data?.[0] && !callRef.current) void onRow(data[0], true); });
    return () => { if (ch) void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, uid]);

  // Fermeture de l'onglet pendant un appel
  useEffect(() => {
    const bye = () => {
      const c = callRef.current;
      if (!c || c.phase === "ended") return;
      send("hangup", { call: c.call.id });
      void db.rpc("chat_call_update", { p_call: c.call.id, p_action: c.phase === "outgoing" ? "cancel" : c.phase === "incoming" ? "decline" : "end" });
    };
    window.addEventListener("pagehide", bye);
    return () => window.removeEventListener("pagehide", bye);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const setAllowCalls = useCallback(async (v: boolean) => {
    setAllowCallsState(v);
    const { error } = await db.rpc("chat_set_allow_calls", { p_allow: v });
    if (error) { setAllowCallsState(!v); toast.error(error.message); }
  }, []);

  const unread = useMemo(() => (contacts || []).reduce((n, c) => n + (c.muted || c.conversation_id === activeConv.current ? 0 : c.unread || 0), 0), [contacts]);

  const value = useMemo<ChatContextType>(() => ({
    enabled: enabled && (contacts === null || contacts.length > 0),
    contacts, unread, refresh, call, startCall, acceptCall, declineCall, hangUp, toggleMute, toggleSpeaker,
    toggleCamera, switchCamera, localStream, remoteStream,
    setMinimized: (v: boolean) => patch({ minimized: v }),
    setActiveConversation: (id: string | null) => { activeConv.current = id; },
    allowCalls, setAllowCalls,
  }), [enabled, contacts, unread, refresh, call, startCall, acceptCall, declineCall, hangUp, toggleMute, toggleSpeaker, toggleCamera, switchCamera, localStream, remoteStream, allowCalls, setAllowCalls]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {/* Sortie audio de l'appel (toujours présente pour pouvoir être débloquée sur iOS) */}
      <audio ref={remoteAudio} autoPlay playsInline className="hidden" />
      {call && <CallOverlay />}
    </Ctx.Provider>
  );
}

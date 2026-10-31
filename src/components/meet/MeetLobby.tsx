"use client";

/**
 * Salle d'attente : aperçu caméra, niveau du micro, choix des appareils, puis « Rejoindre ».
 * Rien n'est envoyé tant que la personne n'a pas cliqué : la présence n'est notée qu'à l'entrée.
 */
import { useEffect, useRef, useState } from "react";
import { createLocalAudioTrack, createLocalVideoTrack, Room, VideoPresets, type LocalAudioTrack, type LocalVideoTrack } from "livekit-client";
import { ArrowLeft, CalendarClock, Camera, CameraOff, Loader2, Lock, Mic, MicOff, Radio, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials, personHue } from "@/lib/meet";
import { useTr } from "./useTr";
import "./meet.css";

export interface LobbyChoices {
  audio: boolean;
  video: boolean;
  audioDeviceId?: string;
  videoDeviceId?: string;
}

const PREF_KEY = "meet-lobby-choices";
export function savedChoices(): LobbyChoices {
  try {
    const v = JSON.parse(localStorage.getItem(PREF_KEY) || "null");
    if (v && typeof v === "object") return { audio: v.audio !== false, video: v.video !== false, audioDeviceId: v.audioDeviceId, videoDeviceId: v.videoDeviceId };
  } catch {
    /* stockage indisponible */
  }
  return { audio: true, video: true };
}
function saveChoices(c: LobbyChoices) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
}

export function MicMeter({ track, className }: { track: LocalAudioTrack | null; className?: string }) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!track) return;
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const src = ctx.createMediaStreamSource(new MediaStream([track.mediaStreamTrack]));
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    const buf = new Uint8Array(an.fftSize);
    let raf = 0;
    const loop = () => {
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      try {
        src.disconnect();
        void ctx.close();
      } catch {
        /* ignore */
      }
    };
  }, [track]);
  return (
    <div className={cn("flex h-4 items-end gap-[3px]", className)} aria-hidden="true">
      {[0.15, 0.3, 0.45, 0.6, 0.75].map((th, i) => (
        <span
          key={i}
          className={cn("w-[3px] rounded-full transition-all duration-75", level > th ? "bg-emerald-400" : "bg-white/25")}
          style={{ height: `${35 + i * 16}%` }}
        />
      ))}
    </div>
  );
}

export function MeetLobby(props: {
  title: string;
  roomName: string;
  hostName: string;
  isHost: boolean;
  userName: string;
  userId: string;
  status: "scheduled" | "live" | "ended" | "cancelled";
  scheduledAt: string | null;
  online: number;
  locked: boolean;
  joining: boolean;
  onJoin: (c: LobbyChoices) => void;
  onBack: () => void;
}) {
  const { tr, locale, dir } = useTr();
  const [choices, setChoices] = useState<LobbyChoices>(() => savedChoices());
  const [video, setVideo] = useState<LocalVideoTrack | null>(null);
  const [audio, setAudio] = useState<LocalAudioTrack | null>(null);
  const [devices, setDevices] = useState<{ audio: MediaDeviceInfo[]; video: MediaDeviceInfo[] }>({ audio: [], video: [] });
  const [camError, setCamError] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const videoEl = useRef<HTMLVideoElement>(null);

  // Caméra
  useEffect(() => {
    if (!choices.video) {
      setVideo(null);
      return;
    }
    let t: LocalVideoTrack | null = null;
    let alive = true;
    createLocalVideoTrack({ deviceId: choices.videoDeviceId, resolution: VideoPresets.h720.resolution, facingMode: "user" })
      .then(track => {
        if (!alive) return track.stop();
        t = track;
        setVideo(track);
        setCamError(null);
      })
      .catch(e => alive && setCamError(e?.name === "NotAllowedError" ? "denied" : "none"));
    return () => {
      alive = false;
      t?.stop();
    };
  }, [choices.video, choices.videoDeviceId]);

  // Micro
  useEffect(() => {
    if (!choices.audio) {
      setAudio(null);
      return;
    }
    let t: LocalAudioTrack | null = null;
    let alive = true;
    createLocalAudioTrack({ deviceId: choices.audioDeviceId, echoCancellation: true, noiseSuppression: true, autoGainControl: true })
      .then(track => {
        if (!alive) return track.stop();
        t = track;
        setAudio(track);
        setMicError(null);
      })
      .catch(e => alive && setMicError(e?.name === "NotAllowedError" ? "denied" : "none"));
    return () => {
      alive = false;
      t?.stop();
    };
  }, [choices.audio, choices.audioDeviceId]);

  useEffect(() => {
    if (video && videoEl.current) video.attach(videoEl.current);
    return () => {
      if (video && videoEl.current) video.detach(videoEl.current);
    };
  }, [video]);

  // Liste des appareils (les noms n'apparaissent qu'après l'autorisation)
  useEffect(() => {
    Promise.all([Room.getLocalDevices("audioinput", false), Room.getLocalDevices("videoinput", false)])
      .then(([a, v]) => setDevices({ audio: a.filter(d => d.deviceId), video: v.filter(d => d.deviceId) }))
      .catch(() => undefined);
  }, [video, audio]);

  const update = (patch: Partial<LobbyChoices>) => setChoices(c => ({ ...c, ...patch }));
  const canJoin = props.status === "live" || (props.isHost && props.status === "scheduled");
  const blocked = props.locked && !props.isHost;
  const hue = personHue(props.userId);

  const join = () => {
    const c = { ...choices, audio: choices.audio && !micError, video: choices.video && !camError };
    saveChoices(c);
    video?.stop();
    audio?.stop();
    props.onJoin(c);
  };

  const errText = (e: string | null, what: "cam" | "mic") =>
    e === "denied"
      ? what === "cam"
        ? tr("Accès à la caméra refusé : autorisez-le dans le navigateur (icône à gauche de l'adresse).", "تم رفض الوصول إلى الكاميرا: اسمح به في المتصفح.", "Camera access denied: allow it in the browser.")
        : tr("Accès au micro refusé : autorisez-le dans le navigateur.", "تم رفض الوصول إلى الميكروفون: اسمح به في المتصفح.", "Microphone access denied: allow it in the browser.")
      : what === "cam"
        ? tr("Aucune caméra trouvée.", "لم يتم العثور على كاميرا.", "No camera found.")
        : tr("Aucun micro trouvé.", "لم يتم العثور على ميكروفون.", "No microphone found.");

  return (
    <div dir={dir} className="meet-shell relative flex min-h-[100dvh] flex-col overflow-y-auto bg-[#0b0e14] text-white">
      <div className="meet-aurora pointer-events-none absolute inset-0" aria-hidden="true" />
      <header className="relative z-10 flex items-center gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={props.onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
          aria-label={tr("Retour", "رجوع", "Back")}
        >
          <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wider text-white/50">{props.roomName}</p>
          <h1 className="truncate text-base font-semibold sm:text-lg">{props.title}</h1>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-6 px-4 pb-8 sm:px-6 lg:grid-cols-[1.35fr_1fr] lg:gap-10">
        {/* Aperçu */}
        <div className="space-y-3">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl sm:aspect-video bg-[#151a24] shadow-2xl ring-1 ring-white/10">
            {video && choices.video ? (
              <video ref={videoEl} muted playsInline autoPlay className="h-full w-full -scale-x-100 object-cover" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 pb-16">
                <span
                  className="flex h-24 w-24 items-center justify-center rounded-full text-3xl font-semibold shadow-lg sm:h-28 sm:w-28"
                  style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${hue + 40} 70% 42%))` }}
                >
                  {initials(props.userName)}
                </span>
                <p className="text-sm text-white/60">
                  {camError ? tr("Caméra indisponible", "الكاميرا غير متاحة", "Camera unavailable") : tr("Caméra désactivée", "الكاميرا مطفأة", "Camera is off")}
                </p>
              </div>
            )}
            <span className="absolute start-3 top-3 max-w-[70%] truncate rounded-full bg-black/45 px-3 py-1 text-xs font-medium backdrop-blur sm:start-4 sm:top-4">{props.userName}</span>
            <div className="absolute inset-x-0 bottom-0 grid grid-cols-[1fr_auto_1fr] items-end gap-2 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-3 pb-3 pt-10 sm:px-4 sm:pb-4">
              <span />
              <div className="flex gap-3">
                <RoundToggle
                  on={choices.audio && !micError}
                  onClick={() => update({ audio: !choices.audio })}
                  IconOn={Mic}
                  IconOff={MicOff}
                  label={choices.audio ? tr("Couper le micro", "كتم الميكروفون", "Mute") : tr("Activer le micro", "تشغيل الميكروفون", "Unmute")}
                />
                <RoundToggle
                  on={choices.video && !camError}
                  onClick={() => update({ video: !choices.video })}
                  IconOn={Camera}
                  IconOff={CameraOff}
                  label={choices.video ? tr("Couper la caméra", "إيقاف الكاميرا", "Stop camera") : tr("Activer la caméra", "تشغيل الكاميرا", "Start camera")}
                />
              </div>
              <div className="justify-self-end">
                {choices.audio && audio && <MicMeter track={audio} className="rounded-full bg-black/40 px-2.5 py-1 backdrop-blur" />}
              </div>
            </div>
          </div>
          {camError && <p className="text-xs text-amber-300">{errText(camError, "cam")}</p>}
          {micError && <p className="text-xs text-amber-300">{errText(micError, "mic")}</p>}

          <div className="grid gap-2 sm:grid-cols-2">
            <DeviceSelect
              icon={Mic}
              label={tr("Micro", "الميكروفون", "Microphone")}
              devices={devices.audio}
              value={choices.audioDeviceId}
              onChange={id => update({ audioDeviceId: id })}
            />
            <DeviceSelect
              icon={Camera}
              label={tr("Caméra", "الكاميرا", "Camera")}
              devices={devices.video}
              value={choices.videoDeviceId}
              onChange={id => update({ videoDeviceId: id })}
            />
          </div>
        </div>

        {/* Entrée */}
        <div className="flex flex-col items-center text-center lg:items-start lg:text-start">
          {props.status === "live" ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-300 ring-1 ring-rose-400/30">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
              </span>
              {tr("En direct", "مباشر", "Live")}
            </span>
          ) : props.status === "scheduled" ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-300 ring-1 ring-sky-400/30">
              <CalendarClock className="h-3.5 w-3.5" />
              {props.scheduledAt
                ? new Date(props.scheduledAt).toLocaleString(locale, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
                : tr("Planifiée", "مبرمجة", "Scheduled")}
            </span>
          ) : null}

          <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
            {canJoin
              ? props.isHost
                ? props.status === "scheduled"
                  ? tr("Prêt à commencer ?", "هل أنت مستعد للبدء؟", "Ready to start?")
                  : tr("Prêt à rejoindre ?", "هل أنت مستعد للانضمام؟", "Ready to join?")
                : tr("Prêt à rejoindre ?", "هل أنت مستعد للانضمام؟", "Ready to join?")
              : props.status === "scheduled"
                ? tr("La réunion n'a pas encore commencé", "لم يبدأ الاجتماع بعد", "The meeting hasn't started yet")
                : tr("Cette réunion est terminée", "انتهى هذا الاجتماع", "This meeting has ended")}
          </h2>
          <p className="mt-2 max-w-sm text-sm text-white/60">
            {props.isHost
              ? tr(
                  "Les élèves de la classe reçoivent une notification dès que vous démarrez.",
                  "يتوصل تلاميذ القسم بإشعار بمجرد أن تبدأ.",
                  "Students in the class get a notification as soon as you start.",
                )
              : props.status === "scheduled"
                ? tr("Cette page s'ouvrira dès que votre professeur démarre.", "ستفتح هذه الصفحة بمجرد أن يبدأ أستاذك.", "This page will open as soon as your teacher starts.")
                : tr(`Avec ${props.hostName}`, `مع ${props.hostName}`, `With ${props.hostName}`)}
          </p>

          {props.status === "live" && (
            <p className="mt-4 inline-flex items-center gap-2 text-sm text-white/70">
              <Users className="h-4 w-4" />
              {props.online === 0
                ? tr("Personne n'est encore là", "لا أحد هنا بعد", "No one is here yet")
                : tr(`${props.online} déjà dans la réunion`, `${props.online} في الاجتماع`, `${props.online} already in the meeting`)}
            </p>
          )}

          {blocked ? (
            <p className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-400/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-300/20">
              <Lock className="h-4 w-4" />
              {tr("Le professeur a verrouillé la réunion.", "قام الأستاذ بإغلاق الاجتماع.", "The teacher locked the meeting.")}
            </p>
          ) : (
            <button
              type="button"
              disabled={!canJoin || props.joining}
              onClick={join}
              className="mt-6 inline-flex h-12 min-w-[200px] items-center justify-center gap-2 rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {props.joining ? <Loader2 className="h-5 w-5 animate-spin" /> : <Radio className="h-5 w-5" />}
              {props.isHost && props.status === "scheduled" ? tr("Démarrer la réunion", "بدء الاجتماع", "Start meeting") : tr("Rejoindre", "انضمام", "Join now")}
            </button>
          )}

          <p className="mt-6 inline-flex items-center gap-1.5 text-xs text-white/40">
            <ShieldCheck className="h-3.5 w-3.5" />
            {tr("Réservée au professeur et aux élèves de la classe", "خاص بالأستاذ وتلاميذ القسم", "Only for the teacher and students of this class")}
          </p>
        </div>
      </main>
    </div>
  );
}

function RoundToggle({ on, onClick, IconOn, IconOff, label }: { on: boolean; onClick: () => void; IconOn: any; IconOff: any; label: string }) {
  const Icon = on ? IconOn : IconOff;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={on}
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-full ring-1 backdrop-blur transition",
        on ? "bg-white/15 ring-white/20 hover:bg-white/25" : "bg-rose-500 ring-rose-400 hover:bg-rose-600",
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

function DeviceSelect({
  icon: Icon,
  label,
  devices,
  value,
  onChange,
}: {
  icon: any;
  label: string;
  devices: MediaDeviceInfo[];
  value?: string;
  onChange: (id: string) => void;
}) {
  if (devices.length === 0) return null;
  return (
    <label className="flex min-w-0 items-center gap-2 rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10 focus-within:ring-primary/60">
      <Icon className="h-4 w-4 shrink-0 text-white/50" aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <select
        value={value || devices[0]?.deviceId}
        onChange={e => onChange(e.target.value)}
        className="min-w-0 flex-1 truncate bg-transparent text-sm text-white outline-none [&>option]:text-black"
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

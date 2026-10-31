"use client";

/**
 * Écran d'appel : vocal ou vidéo, entrant, sortant, en cours, réduit.
 * Vidéo : image de l'autre en plein écran, ma vignette dans un coin (déplaçable d'un coin à l'autre),
 * commandes masquées après quelques secondes (toucher l'écran pour les revoir).
 */
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown, Maximize2, Mic, MicOff, Phone, PhoneOff, SwitchCamera, Video, VideoOff, Volume2, VolumeX, Wifi,
} from "lucide-react";
import { useChat } from "@/contexts/ChatContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { fmtDuration } from "@/lib/chat";
import { cn } from "@/lib/utils";
import { ChatAvatar } from "./ChatAvatar";

function useTimer(from: number | null) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!from) return;
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [from]);
  return from ? Math.max(0, Math.floor((Date.now() - from) / 1000)) : 0;
}

/** <video> relié à un flux (muet : le son passe par l'élément audio de l'appel) */
function StreamVideo({ stream, mirror, className, fit = "cover" }: { stream: MediaStream | null; mirror?: boolean; className?: string; fit?: "cover" | "contain" }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    if (stream) void el.play().catch(() => { /* lecture au prochain geste */ });
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className={cn("h-full w-full bg-black", fit === "cover" ? "object-cover" : "object-contain", mirror && "-scale-x-100", className)}
    />
  );
}

const hasLiveVideo = (s: MediaStream | null) => !!s && s.getVideoTracks().some(t => t.readyState === "live" && !t.muted);

export function CallOverlay() {
  const {
    call, acceptCall, declineCall, hangUp, toggleMute, toggleSpeaker, toggleCamera, switchCamera, setMinimized, localStream, remoteStream,
  } = useChat();
  const { language } = useLanguage();
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);
  const seconds = useTimer(call?.connectedAt ?? null);
  const [controls, setControls] = useState(true);
  const [corner, setCorner] = useState<"tr" | "tl" | "br" | "bl">("tr");
  const [fit, setFit] = useState<"cover" | "contain">("cover");
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [multiCam, setMultiCam] = useState(false);

  const remoteVideoOn = !!call?.remoteCam && hasLiveVideo(remoteStream);
  const videoMode = !!call && (call.camOn || remoteVideoOn) && call.phase !== "ended";

  // Commandes masquées après 4 s en vidéo
  const poke = () => {
    setControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (videoMode && call?.phase === "active") hideTimer.current = setTimeout(() => setControls(false), 4000);
  };
  useEffect(() => {
    poke();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [videoMode, call?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices?.().then(list => setMultiCam(list.filter(d => d.kind === "videoinput").length > 1)).catch(() => {});
  }, [call?.camOn]);

  if (!call) return null;

  const kindLabel = call.video ? tr("Appel vidéo", "مكالمة فيديو", "Video call") : tr("Appel vocal", "مكالمة صوتية", "Voice call");
  const status =
    call.phase === "incoming" ? (call.video ? tr("Appel vidéo entrant…", "مكالمة فيديو واردة…", "Incoming video call…") : tr("Appel vocal entrant…", "مكالمة صوتية واردة…", "Incoming voice call…"))
      : call.phase === "outgoing" ? tr("Sonnerie…", "يرن…", "Ringing…")
      : call.phase === "connecting" ? tr("Connexion…", "جارٍ الاتصال…", "Connecting…")
      : call.phase === "active" ? fmtDuration(seconds)
      : call.endedReason === "declined" ? tr("Appel refusé", "تم رفض المكالمة", "Call declined")
      : call.endedReason === "missed" ? tr("Pas de réponse", "لا يوجد رد", "No answer")
      : call.endedReason === "failed" ? tr("Connexion perdue", "انقطع الاتصال", "Connection lost")
      : call.endedReason === "cancelled" ? tr("Appel annulé", "تم إلغاء المكالمة", "Call cancelled")
      : tr("Appel terminé", "انتهت المكالمة", "Call ended");

  const dir = language === "ar" ? "rtl" : "ltr";

  // Pastille réduite (on peut continuer à naviguer et à écrire)
  if (call.minimized && call.phase !== "incoming" && call.phase !== "ended") {
    return (
      <div dir={dir} className="fixed inset-x-0 top-2 z-[60] flex justify-center px-3 print:hidden" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex items-center gap-2 rounded-full bg-emerald-600 py-1.5 pe-1.5 ps-1.5 text-white shadow-lg ring-1 ring-black/10">
          {remoteVideoOn ? (
            <button type="button" onClick={() => setMinimized(false)} className="h-9 w-14 overflow-hidden rounded-full"><StreamVideo stream={remoteStream} /></button>
          ) : <span className="ms-1.5 h-2 w-2 animate-pulse rounded-full bg-white" />}
          <button type="button" onClick={() => setMinimized(false)} className="flex items-center gap-2 text-sm font-medium">
            <span className="max-w-[10rem] truncate">{call.peer.name}</span>
            <span className="tabular-nums opacity-90">{status}</span>
            <Maximize2 className="h-3.5 w-3.5 opacity-80" />
          </button>
          {call.muted && <MicOff className="h-4 w-4 opacity-90" aria-label={tr("Micro coupé", "الميكروفون مكتوم", "Muted")} />}
          <button type="button" onClick={() => void hangUp()} className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 hover:bg-rose-600" aria-label={tr("Raccrocher", "إنهاء المكالمة", "Hang up")}>
            <PhoneOff className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  const ringing = call.phase === "incoming" || call.phase === "outgoing";
  const cornerCls = { tr: "top-20 end-3", tl: "top-20 start-3", br: "bottom-44 end-3", bl: "bottom-44 start-3" }[corner];
  const nextCorner = () => setCorner(c => (c === "tr" ? "br" : c === "br" ? "bl" : c === "bl" ? "tl" : "tr"));

  return (
    <div
      dir={dir}
      role="dialog"
      aria-modal="true"
      aria-label={kindLabel}
      className="fixed inset-0 z-[60] flex h-full items-center justify-center bg-black/60 backdrop-blur-sm print:hidden sm:p-6"
    >
      <div
        onClick={poke}
        className={cn(
          "relative flex h-full w-full flex-col items-center justify-between overflow-hidden px-6 text-white",
          videoMode ? "bg-black sm:max-w-5xl sm:rounded-3xl" : "bg-gradient-to-b from-slate-800 via-slate-900 to-black sm:h-auto sm:min-h-[34rem] sm:max-w-sm sm:rounded-3xl sm:shadow-2xl",
        )}
        style={{ paddingTop: "max(env(safe-area-inset-top), 1.25rem)", paddingBottom: "max(env(safe-area-inset-bottom), 1.75rem)" }}
      >
        {/* Vidéo de l'autre en plein écran */}
        {videoMode && (
          <div className="absolute inset-0" onDoubleClick={() => setFit(f => (f === "cover" ? "contain" : "cover"))}>
            {remoteVideoOn ? (
              <StreamVideo stream={remoteStream} fit={fit} />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-slate-800 to-black">
                <ChatAvatar id={call.peer.id} name={call.peer.name} url={call.peer.avatar_url} size={110} className="rounded-full" />
                {call.phase === "active" && <p className="flex items-center gap-1.5 text-sm text-white/70"><VideoOff className="h-4 w-4" />{tr("Caméra coupée", "الكاميرا متوقفة", "Camera off")}</p>}
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/70 to-transparent" />
          </div>
        )}

        {/* Ma vignette */}
        {videoMode && call.camOn && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); nextCorner(); }}
            className={cn("absolute z-10 aspect-[3/4] w-28 overflow-hidden rounded-2xl shadow-2xl ring-2 ring-white/30 transition-all sm:w-40", cornerCls)}
            aria-label={tr("Déplacer ma vidéo", "تحريك الفيديو الخاص بي", "Move my video")}
          >
            <StreamVideo stream={localStream} mirror={call.facing === "user"} />
          </button>
        )}

        {/* Barre du haut */}
        <div className={cn("relative z-10 flex w-full items-center justify-between text-xs text-white/80 transition-opacity", !controls && "pointer-events-none opacity-0")}>
          {call.phase !== "incoming" && call.phase !== "ended" ? (
            <button type="button" onClick={() => setMinimized(true)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10" aria-label={tr("Réduire", "تصغير", "Minimize")}>
              <ChevronDown className="h-5 w-5" />
            </button>
          ) : <span className="h-9 w-9" />}
          {videoMode ? (
            <span className="text-center">
              <span className="block text-sm font-semibold text-white">{call.peer.name}</span>
              <span className="tabular-nums">{status}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              {call.video ? <Video className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}{kindLabel} · {tr("chiffré", "مشفرة", "encrypted")}
            </span>
          )}
          <span className="flex h-9 w-9 items-center justify-center">
            {call.phase === "active" && <Wifi className={cn("h-4 w-4", call.quality === "poor" ? "text-amber-400" : "text-emerald-400")} aria-label={call.quality === "poor" ? tr("Réseau faible", "شبكة ضعيفة", "Weak network") : tr("Bonne connexion", "اتصال جيد", "Good connection")} />}
          </span>
        </div>

        {/* Interlocuteur (vocal, ou avant la connexion vidéo) */}
        {!videoMode ? (
          <div className="relative flex flex-col items-center gap-5 py-8">
            <div className="relative flex items-center justify-center">
              {ringing && (
                <>
                  <span className="absolute h-36 w-36 animate-ping rounded-full bg-emerald-400/20" style={{ animationDuration: "1.8s" }} />
                  <span className="absolute h-44 w-44 animate-ping rounded-full bg-emerald-400/10" style={{ animationDuration: "2.4s" }} />
                </>
              )}
              <ChatAvatar id={call.peer.id} name={call.peer.name} url={call.peer.avatar_url} size={120} className="rounded-full ring-4 ring-white/10" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-semibold">{call.peer.name}</h2>
              <p className={cn("mt-1 text-sm tabular-nums", call.phase === "ended" ? "text-rose-300" : "text-white/70")} aria-live="polite">{status}</p>
              {call.phase === "active" && call.quality === "poor" && (
                <p className="mt-1 text-xs text-amber-300">{tr("Réseau faible, reconnexion…", "شبكة ضعيفة، إعادة الاتصال…", "Weak network, reconnecting…")}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="relative flex-1">
            {call.phase === "active" && call.quality === "poor" && (
              <p className="mt-2 rounded-full bg-black/50 px-3 py-1 text-xs text-amber-300">{tr("Réseau faible : la qualité baisse un instant", "شبكة ضعيفة", "Weak network")}</p>
            )}
          </div>
        )}

        {/* Commandes */}
        {call.phase === "incoming" ? (
          <div className="relative z-10 flex w-full items-end justify-around pb-2">
            <RoundButton label={tr("Refuser", "رفض", "Decline")} onClick={() => void declineCall()} className="bg-rose-500 hover:bg-rose-600">
              <PhoneOff className="h-7 w-7" />
            </RoundButton>
            {call.video && (
              <RoundButton label={tr("Répondre en vocal", "رد صوتي", "Answer audio")} onClick={() => void acceptCall(false)} className="bg-white/15 hover:bg-white/25">
                <Phone className="h-7 w-7" />
              </RoundButton>
            )}
            <RoundButton label={call.video ? tr("Répondre en vidéo", "رد بالفيديو", "Answer video") : tr("Répondre", "رد", "Answer")} onClick={() => void acceptCall(call.video)} className="animate-bounce bg-emerald-500 hover:bg-emerald-600">
              {call.video ? <Video className="h-7 w-7" /> : <Phone className="h-7 w-7" />}
            </RoundButton>
          </div>
        ) : call.phase === "ended" ? (
          <div className="h-[92px]" />
        ) : (
          <div className={cn("relative z-10 flex w-full max-w-md flex-col items-center gap-5 pb-2 transition-opacity", !controls && "pointer-events-none opacity-0")}>
            <div className="flex w-full justify-around">
              <RoundButton small label={call.muted ? tr("Micro coupé", "مكتوم", "Muted") : tr("Micro", "الميكروفون", "Mic")} onClick={toggleMute}
                className={call.muted ? "bg-white text-slate-900" : "bg-white/15 hover:bg-white/25"} pressed={call.muted}>
                {call.muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </RoundButton>
              <RoundButton small label={call.camOn ? tr("Caméra", "الكاميرا", "Camera") : tr("Vidéo", "فيديو", "Video")} onClick={() => void toggleCamera()}
                className={call.camOn ? "bg-white/15 hover:bg-white/25" : "bg-white text-slate-900"} pressed={call.camOn}>
                {call.camOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
              </RoundButton>
              {call.camOn && multiCam ? (
                <RoundButton small label={tr("Retourner", "قلب الكاميرا", "Flip")} onClick={() => void switchCamera()} className="bg-white/15 hover:bg-white/25">
                  <SwitchCamera className="h-6 w-6" />
                </RoundButton>
              ) : (
                <RoundButton small label={tr("Haut-parleur", "مكبر الصوت", "Speaker")} onClick={toggleSpeaker}
                  className={call.speaker ? "bg-white text-slate-900" : "bg-white/15 hover:bg-white/25"} pressed={call.speaker}>
                  {call.speaker ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
                </RoundButton>
              )}
            </div>
            <RoundButton label={tr("Raccrocher", "إنهاء", "Hang up")} onClick={() => void hangUp()} className="bg-rose-500 hover:bg-rose-600">
              <PhoneOff className="h-7 w-7" />
            </RoundButton>
          </div>
        )}
      </div>
    </div>
  );
}

function RoundButton({ children, label, onClick, className, small, pressed }: {
  children: React.ReactNode; label: string; onClick: () => void; className?: string; small?: boolean; pressed?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onClick(); }}
        aria-label={label}
        aria-pressed={pressed}
        className={cn(
          "flex items-center justify-center rounded-full text-white shadow-lg backdrop-blur transition-transform active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/40",
          small ? "h-14 w-14" : "h-[68px] w-[68px]",
          className,
        )}
      >
        {children}
      </button>
      <span className="text-xs text-white/85 drop-shadow">{label}</span>
    </div>
  );
}

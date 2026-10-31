"use client";

/** Écran d'appel vocal : entrant, sortant, en cours, réduit en pastille */
import { useEffect, useState } from "react";
import { ChevronDown, Maximize2, Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX, Wifi } from "lucide-react";
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

export function CallOverlay() {
  const { call, acceptCall, declineCall, hangUp, toggleMute, toggleSpeaker, setMinimized } = useChat();
  const { language } = useLanguage();
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);
  const seconds = useTimer(call?.connectedAt ?? null);
  if (!call) return null;

  const status =
    call.phase === "incoming" ? tr("Appel vocal entrant…", "مكالمة صوتية واردة…", "Incoming voice call…")
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
        <div className="flex items-center gap-2 rounded-full bg-emerald-600 py-1.5 pe-1.5 ps-3 text-white shadow-lg ring-1 ring-black/10">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
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

  return (
    <div
      dir={dir}
      role="dialog"
      aria-modal="true"
      aria-label={tr("Appel vocal", "مكالمة صوتية", "Voice call")}
      className="fixed inset-0 z-[60] flex h-full items-center justify-center bg-black/50 backdrop-blur-sm print:hidden sm:p-6"
    >
      <div
        className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden bg-gradient-to-b from-slate-800 via-slate-900 to-black px-6 text-white sm:h-auto sm:min-h-[34rem] sm:max-w-sm sm:rounded-3xl sm:shadow-2xl"
        style={{ paddingTop: "max(env(safe-area-inset-top), 1.25rem)", paddingBottom: "max(env(safe-area-inset-bottom), 1.75rem)" }}
      >
        {/* Barre du haut */}
        <div className="flex w-full items-center justify-between text-xs text-white/70">
          {call.phase !== "incoming" && call.phase !== "ended" ? (
            <button type="button" onClick={() => setMinimized(true)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10" aria-label={tr("Réduire", "تصغير", "Minimize")}>
              <ChevronDown className="h-5 w-5" />
            </button>
          ) : <span className="h-9 w-9" />}
          <span className="inline-flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" />{tr("Appel vocal · chiffré de bout en bout", "مكالمة صوتية · مشفرة", "Voice call · end-to-end encrypted")}
          </span>
          <span className="flex h-9 w-9 items-center justify-center">
            {call.phase === "active" && <Wifi className={cn("h-4 w-4", call.quality === "poor" ? "text-amber-400" : "text-emerald-400")} aria-label={call.quality === "poor" ? tr("Réseau faible", "شبكة ضعيفة", "Weak network") : tr("Bonne connexion", "اتصال جيد", "Good connection")} />}
          </span>
        </div>

        {/* Interlocuteur */}
        <div className="flex flex-col items-center gap-5 py-8">
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

        {/* Commandes */}
        {call.phase === "incoming" ? (
          <div className="flex w-full items-end justify-around pb-2">
            <RoundButton label={tr("Refuser", "رفض", "Decline")} onClick={() => void declineCall()} className="bg-rose-500 hover:bg-rose-600">
              <PhoneOff className="h-7 w-7" />
            </RoundButton>
            <RoundButton label={tr("Répondre", "رد", "Answer")} onClick={() => void acceptCall()} className="animate-bounce bg-emerald-500 hover:bg-emerald-600" >
              <Phone className="h-7 w-7" />
            </RoundButton>
          </div>
        ) : call.phase === "ended" ? (
          <div className="h-[92px]" />
        ) : (
          <div className="flex w-full flex-col items-center gap-6 pb-2">
            <div className="flex w-full justify-around">
              <RoundButton small label={call.muted ? tr("Réactiver le micro", "تشغيل الميكروفون", "Unmute") : tr("Couper le micro", "كتم الميكروفون", "Mute")} onClick={toggleMute}
                className={call.muted ? "bg-white text-slate-900" : "bg-white/15 hover:bg-white/25"} pressed={call.muted}>
                {call.muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </RoundButton>
              <RoundButton small label={tr("Haut-parleur", "مكبر الصوت", "Speaker")} onClick={toggleSpeaker}
                className={call.speaker ? "bg-white text-slate-900" : "bg-white/15 hover:bg-white/25"} pressed={call.speaker}>
                {call.speaker ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
              </RoundButton>
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
        onClick={onClick}
        aria-label={label}
        aria-pressed={pressed}
        className={cn(
          "flex items-center justify-center rounded-full text-white shadow-lg transition-transform active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/40",
          small ? "h-14 w-14" : "h-[68px] w-[68px]",
          className,
        )}
      >
        {children}
      </button>
      <span className="text-xs text-white/80">{label}</span>
    </div>
  );
}

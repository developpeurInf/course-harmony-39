/**
 * Bandeau élève « Réunion en direct » : apparaît dès que le professeur démarre une réunion
 * dans une de ses classes (temps réel + vérification toutes les 30 s).
 */
import { useCallback, useEffect, useState } from "react";
import { Video } from "lucide-react";
import { Link, useLocation } from "@/lib/router";
import { supabase } from "@/integrations/supabase/client";
import { preloadWhenIdle, preloadMeetingRoom, debounce, listMeetings, onMeetingsCacheChange, cachedMeetings, type Meeting } from "@/lib/meet";
import "./meet.css";

export function MeetLiveBanner({ language }: { language: string }) {
  const [live, setLive] = useState<Meeting[]>(() => (cachedMeetings(null) || []).filter(m => m.status === "live"));
  const { pathname } = useLocation();
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);

  const check = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      // Partage la liste avec les autres pages (un seul appel réseau)
      setLive((await listMeetings(null, 5000)).filter(m => m.status === "live"));
    } catch {
      /* migration pas encore lancée */
    }
  }, []);

  useEffect(() => {
    void check();
    const soon = debounce(() => void check(), 400);
    const t = setInterval(() => void check(), 30000);
    const off = onMeetingsCacheChange(() => setLive((cachedMeetings(null) || []).filter(m => m.status === "live")));
    const ch = supabase
      .channel("meet-live-banner")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "meetings" }, () => soon())
      .subscribe();
    const onVis = () => !document.hidden && soon();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      soon.cancel();
      off();
      document.removeEventListener("visibilitychange", onVis);
      void supabase.removeChannel(ch);
    };
  }, [check]);

  const m = live[0];
  // Une réunion est en direct : on prépare la visio pour que le clic soit immédiat
  useEffect(() => {
    if (m) preloadWhenIdle();
  }, [m?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!m || pathname.startsWith("/meetings") || /^\/rooms\/[^/]+\/meet/.test(pathname)) return null;
  return (
    <Link
      to={`/meet/${m.id}`}
      onPointerEnter={preloadMeetingRoom}
      onTouchStart={preloadMeetingRoom}
      className="meet-live-card mb-4 flex items-center gap-3 rounded-2xl px-4 py-3 text-white shadow-sm transition hover:brightness-110 print:hidden"
    >
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
        <span className="absolute inset-0 animate-ping rounded-full bg-white/20" />
        <Video className="relative h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">
          {tr("Réunion en direct", "اجتماع مباشر", "Live meeting")} · {m.title}
        </span>
        <span className="block truncate text-xs text-white/85">
          {m.host_name} · {m.room_name}
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-white px-4 py-1.5 text-sm font-bold text-rose-700">{tr("Rejoindre", "انضمام", "Join")}</span>
    </Link>
  );
}

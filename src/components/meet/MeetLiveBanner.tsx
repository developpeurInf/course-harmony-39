/**
 * Bandeau élève « Réunion en direct » : apparaît dès que le professeur démarre une réunion
 * dans une de ses classes (temps réel + vérification toutes les 30 s).
 */
import { useCallback, useEffect, useState } from "react";
import { Video } from "lucide-react";
import { Link, useLocation } from "@/lib/router";
import { supabase } from "@/integrations/supabase/client";
import { listMeetings, type Meeting } from "@/lib/meet";
import "./meet.css";

export function MeetLiveBanner({ language }: { language: string }) {
  const [live, setLive] = useState<Meeting[]>([]);
  const { pathname } = useLocation();
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);

  const check = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      setLive((await listMeetings(null)).filter(m => m.status === "live"));
    } catch {
      /* migration pas encore lancée */
    }
  }, []);

  useEffect(() => {
    void check();
    const t = setInterval(() => void check(), 30000);
    const ch = supabase
      .channel("meet-live-banner")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "meetings" }, () => void check())
      .subscribe();
    const onVis = () => void check();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      void supabase.removeChannel(ch);
    };
  }, [check]);

  const m = live[0];
  if (!m || pathname.startsWith("/meetings") || /^\/rooms\/[^/]+\/meet/.test(pathname)) return null;
  return (
    <Link
      to={`/meet/${m.id}`}
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

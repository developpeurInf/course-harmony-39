/**
 * Bandeau élève « Quiz en direct » : apparaît dès que le professeur lance un quiz
 * en direct dans une de ses classes (rpc live_open, vérifiée toutes les 20 s
 * et à chaque changement temps réel).
 */
import { useCallback, useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { Link, useLocation } from "@/lib/router";
import { supabase } from "@/integrations/supabase/client";

export function LiveQuizBanner({ language }: { language: string }) {
  const location = useLocation();
  const [open, setOpen] = useState<{ id: string; title: string }[]>([]);
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);

  const check = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    const { data, error } = await (supabase as any).rpc("live_open");
    if (!error) setOpen((data || []) as any[]);
  }, []);

  useEffect(() => {
    void check();
    const t = setInterval(() => void check(), 20000);
    const ch = supabase
      .channel("live-open")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "live_sessions" }, () => void check())
      .subscribe();
    const onVis = () => void check();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      void supabase.removeChannel(ch);
    };
  }, [check]);

  const s = open[0];
  if (!s || location.pathname.startsWith("/live/")) return null;
  return (
    <Link
      to={`/live/${s.id}`}
      className="mb-4 flex items-center gap-3 rounded-xl bg-rose-600 px-4 py-3 text-white shadow-sm transition-colors hover:bg-rose-700 print:hidden"
    >
      <Radio className="h-5 w-5 shrink-0 animate-pulse" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{tr("Quiz en direct", "اختبار مباشر", "Live quiz")} · {s.title}</span>
        <span className="block text-xs text-white/85">{tr("Touchez pour rejoindre", "اضغط للانضمام", "Tap to join")}</span>
      </span>
    </Link>
  );
}

/** Carte élève du tableau de bord : série de jours actifs et badges, lien vers « Ma progression » */
import { useEffect, useState } from "react";
import { ArrowRight, Flame } from "lucide-react";
import { Link } from "@/lib/router";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { computeBadges, type ProgressData } from "@/lib/badges";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { useStudentFeatures } from "@/lib/studentFeatures";

const db = supabase as any;

export function StreakCard() {
  const { language } = useLanguage();
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);
  const [p, setP] = useState<ProgressData | null>(null);
  const { user } = useAuth();
  const { feature } = useAppSettings();
  const sf = useStudentFeatures(user?.id);

  useEffect(() => {
    let alive = true;
    db.rpc("my_progress").then(({ data, error }: any) => {
      if (alive && !error && data && data.streak !== undefined) setP(data as ProgressData);
    });
    return () => { alive = false; };
  }, []);

  // Carte visible si la page « Ma progression » et les badges sont ouverts à l'élève
  if (!p || !sf?.progress || !sf.badges || !feature("progress") || !feature("gamification")) return null;
  const badges = computeBadges(p);
  const earned = badges.filter((b) => b.earned);
  const next = badges.find((b) => !b.earned);

  return (
    <Link to="/progress" className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/50">
        <Flame className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {p.streak > 0
            ? tr(`${p.streak} jour(s) de suite`, `${p.streak} يوم متتالي`, `${p.streak}-day streak`)
            : tr("Commence ta série aujourd'hui", "ابدأ سلسلتك اليوم", "Start your streak today")}
        </p>
        <p className="text-xs text-muted-foreground">
          {tr(`${earned.length}/${badges.length} badges`, `${earned.length}/${badges.length} شارات`, `${earned.length}/${badges.length} badges`)}
          {next ? ` · ${tr("Prochain", "التالي", "Next")} : ${next.icon} ${tr(next.fr, next.ar, next.en)} (${next.progress})` : ""}
        </p>
      </div>
      <span className="flex gap-0.5 text-lg" aria-hidden>{earned.slice(0, 5).map((b) => <span key={b.id}>{b.icon}</span>)}</span>
      <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
        {tr("Ma progression", "تقدمي", "My progress")}<ArrowRight className="h-4 w-4 rtl:rotate-180" />
      </span>
    </Link>
  );
}

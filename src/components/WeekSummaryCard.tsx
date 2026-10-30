/**
 * « Cette semaine » : ce qui attend le professeur (réponses à corriger, copies,
 * élèves décrocheurs, absences des 7 derniers jours). Données : rpc my_week_summary.
 * Invisible tant que la migration n'est pas appliquée ou s'il n'y a rien à signaler.
 */
import { useEffect, useState } from "react";
import { CalendarCheck, ClipboardList, FileCheck2, UserX } from "lucide-react";
import { Link } from "@/lib/router";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface WeekCounts {
  short_answers: number;
  exercise_copies: number;
  inactive_students: number;
  absences: number;
  lates: number;
}

export function WeekSummaryCard({ refreshKey }: { refreshKey?: number }) {
  const { language } = useLanguage();
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);
  const [c, setC] = useState<WeekCounts | null>(null);

  useEffect(() => {
    let alive = true;
    (supabase as any).rpc("my_week_summary").then(({ data, error }: any) => {
      if (alive && !error && data) setC(data as WeekCounts);
    });
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  if (!c) return null;
  const items = [
    { n: c.short_answers, icon: ClipboardList, to: "/exams", label: tr("réponses courtes à corriger", "أجوبة قصيرة للتصحيح", "short answers to grade") },
    { n: c.exercise_copies, icon: FileCheck2, to: "/exercises", label: tr("copies d'exercices à lire", "أوراق تمارين للمراجعة", "exercise copies to review") },
    { n: c.inactive_students, icon: UserX, to: "/students", label: tr("élèves inactifs", "تلاميذ غير نشطين", "inactive students") },
    { n: c.absences + c.lates, icon: CalendarCheck, to: "/calendar", label: tr("absences et retards (7 jours)", "غيابات وتأخرات (7 أيام)", "absences and lates (7 days)") },
  ];
  if (items.every((i) => !i.n)) return null;

  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">{tr("Cette semaine", "هذا الأسبوع", "This week")}</h2>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {items.map((i) => (
          <Link
            key={i.label}
            to={i.to}
            className={cn(
              "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/60",
              !i.n && "opacity-60"
            )}
          >
            <i.icon className={cn("h-5 w-5 shrink-0", i.n ? "text-primary" : "text-muted-foreground")} />
            <span className="min-w-0">
              <span className="block text-lg font-semibold leading-none tabular-nums">{i.n}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{i.label}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

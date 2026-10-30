/** « Ma progression » (élève) : moyenne, évolution, points forts / à revoir, série de jours, badges */
import { useEffect, useMemo, useState } from "react";
import { Flame, Loader2, TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { RemediationButton } from "@/components/progress/Remediation";
import { computeBadges, on20, type ProgressData } from "@/lib/badges";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { useStudentFeatures } from "@/lib/studentFeatures";
import { cn } from "@/lib/utils";

const db = supabase as any;

export default function MyProgress() {
  const { language } = useLanguage();
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);
  const locale = language === "ar" ? "ar-MA" : language === "en" ? "en-GB" : "fr-FR";
  const [p, setP] = useState<ProgressData | null>(null);
  const [error, setError] = useState(false);
  const { user } = useAuth();
  const { feature } = useAppSettings();
  const sf = useStudentFeatures(user?.id);

  useEffect(() => {
    db.rpc("my_progress").then(({ data, error }: any) => {
      if (error || !data || data.quizzes === undefined) setError(true);
      else setP(data as ProgressData);
    });
  }, []);

  const fmt = (n: number | null) => (n === null ? "—" : String(n).replace(".", language === "en" ? "." : ","));
  const stats = useMemo(() => {
    if (!p) return null;
    const notes = p.quizzes.map(q => on20(q.score, q.total)).filter((x): x is number => x !== null);
    const avg = notes.length ? Math.round((notes.reduce((s, n) => s + n, 0) / notes.length) * 10) / 10 : null;
    const recent = notes.slice(0, 5), older = notes.slice(5, 10);
    const trend = recent.length && older.length ? (recent.reduce((s, n) => s + n, 0) / recent.length) - (older.reduce((s, n) => s + n, 0) / older.length) : null;
    const byCourse = new Map<string, number[]>();
    p.quizzes.forEach(q => {
      const n = on20(q.score, q.total);
      if (n === null) return;
      const k = q.course || tr("Autres", "أخرى", "Other");
      byCourse.set(k, [...(byCourse.get(k) || []), n]);
    });
    const courses = [...byCourse.entries()].map(([name, l]) => ({ name, avg: Math.round((l.reduce((s, n) => s + n, 0) / l.length) * 10) / 10, n: l.length }))
      .sort((a, b) => b.avg - a.avg);
    const chart = [...p.quizzes].reverse().slice(-20).map(q => ({ d: new Date(q.at).toLocaleDateString(locale, { day: "numeric", month: "short" }), note: on20(q.score, q.total), t: q.title }));
    return { avg, trend, courses, chart };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, locale]);

  if (sf && !sf.progress) return <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">{tr("Cette page n'est pas activée par ton professeur.", "هذه الصفحة غير مفعلة من طرف أستاذك.", "Your teacher hasn't enabled this page.")}</p>;
  if (error) return <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">{tr("Ta progression sera disponible très bientôt.", "سيتوفر تقدمك قريبا.", "Your progress will be available soon.")}</p>;
  if (!p || !stats) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const badges = computeBadges(p);
  const showBadges = !!sf?.badges && feature("gamification");

  return (
    <div className="space-y-5 animate-fade-in">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><TrendingUp className="h-6 w-6 text-muted-foreground" />{tr("Ma progression", "تقدمي", "My progress")}</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{tr("Ma moyenne aux quiz", "معدلي في الاختبارات", "My quiz average")}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{fmt(stats.avg)}<span className="text-sm font-normal text-muted-foreground"> / 20</span></p></div>
        <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{tr("Tendance récente", "الاتجاه الأخير", "Recent trend")}</p><p className={cn("mt-1 text-2xl font-semibold tabular-nums", stats.trend !== null && stats.trend > 0 && "text-emerald-600", stats.trend !== null && stats.trend < 0 && "text-destructive")}>{stats.trend === null ? "—" : `${stats.trend > 0 ? "+" : ""}${fmt(Math.round(stats.trend * 10) / 10)}`}</p></div>
        <div className="rounded-xl border bg-card p-4"><p className="flex items-center gap-1 text-xs text-muted-foreground"><Flame className="h-3.5 w-3.5 text-orange-500" />{tr("Série en cours", "السلسلة الحالية", "Current streak")}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{p.streak}<span className="text-sm font-normal text-muted-foreground"> {tr("jour(s)", "يوم", "day(s)")}</span></p></div>
        <div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{tr("Quiz terminés", "اختبارات منجزة", "Quizzes done")}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{p.quizzes.length}</p></div>
      </div>

      {stats.chart.length > 1 && (
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">{tr("Évolution de mes notes", "تطور نقطي", "My grades over time")}</h2>
          <div className="h-56" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.chart} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="d" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => [`${fmt(v)} / 20`, ""]} labelFormatter={(_, pl: any) => pl?.[0]?.payload?.t || ""} />
                <Line type="monotone" dataKey="note" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">{tr("Par chapitre", "حسب الفصل", "By chapter")}</h2>
          {stats.courses.length === 0 ? <p className="text-sm text-muted-foreground">{tr("Termine un quiz pour voir tes points forts.", "أنهِ اختبارا لترى نقاط قوتك.", "Finish a quiz to see your strengths.")}</p> : (
            <ul className="space-y-2">
              {stats.courses.map((c, i) => (
                <li key={c.name} className="text-sm">
                  <div className="flex justify-between gap-2"><span className="truncate">{c.name}</span><span className="font-semibold tabular-nums">{fmt(c.avg)}</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", c.avg >= 14 ? "bg-emerald-500" : c.avg >= 10 ? "bg-sky-500" : "bg-amber-500")} style={{ width: `${(c.avg / 20) * 100}%` }} /></div>
                  {i === 0 && stats.courses.length > 1 && <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-300">{tr("Point fort", "نقطة قوة", "Strength")}</p>}
                  {i === stats.courses.length - 1 && stats.courses.length > 1 && c.avg < 12 && <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">{tr("À revoir en priorité", "للمراجعة أولا", "Review first")}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        {showBadges && <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">{tr("Mes badges", "شاراتي", "My badges")}</h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {badges.map(b => (
              <li key={b.id} className={cn("rounded-lg border p-2 text-center", !b.earned && "opacity-45 grayscale")} title={b.earned ? "" : b.progress}>
                <div className="text-2xl" aria-hidden>{b.icon}</div>
                <p className="mt-1 text-xs font-medium leading-tight">{tr(b.fr, b.ar, b.en)}</p>
                {!b.earned && <p className="text-[10px] text-muted-foreground">{b.progress}</p>}
              </li>
            ))}
          </ul>
        </section>}
      </div>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold">{tr("Mes derniers quiz", "آخر اختباراتي", "My latest quizzes")}</h2>
        {p.quizzes.length === 0 ? <p className="text-sm text-muted-foreground">{tr("Aucun quiz terminé.", "لا توجد اختبارات منجزة.", "No quiz finished.")}</p> : (
          <ul className="divide-y">
            {p.quizzes.slice(0, 15).map(q => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{q.title}</span>
                  <span className="text-xs text-muted-foreground">{q.course ? `${q.course} · ` : ""}{new Date(q.at).toLocaleDateString(locale)}</span>
                </span>
                <span className="flex items-center gap-2">
                  {q.total > 0 && q.score < q.total && <RemediationButton submissionId={q.id} language={language} tr={tr} />}
                  <span className="font-semibold tabular-nums">{fmt(on20(q.score, q.total))} / 20</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {p.exercises_returned.length > 0 && (
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">{tr("Mes exercices corrigés", "تماريني المصححة", "My graded exercises")}</h2>
          <ul className="divide-y text-sm">
            {p.exercises_returned.slice(0, 10).map((x, i) => (
              <li key={i} className="flex justify-between gap-2 py-1.5"><span className="truncate">{x.title}</span><span className="font-semibold tabular-nums">{fmt(x.grade)} / {fmt(x.max)}</span></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

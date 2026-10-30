import { useEffect, useState } from "react";
import { Link } from "@/lib/router";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Bot, Repeat, UserX } from "lucide-react";
import { db, fmtMoney, PAYMENT_METHODS, useT, type Lang } from "./adminShared";

interface Stats {
  revenue_months: { month: string; amount: number; count: number }[];
  new_teachers_months: { month: string; count: number }[];
  active_7: number;
  active_30: number;
  inactive_30: number;
  renewal_rate: number | null;
  by_method: { method: string; amount: number; count: number }[];
  ai_months: { month: string; calls: number; tokens: number }[];
  ai_kinds: { kind: string; calls: number }[];
  ai_top: { teacher_id: string; name: string; calls: number; tokens: number }[];
}

const monthLabel = (ym: string, lang: Lang) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(lang === "ar" ? "ar-MA" : lang === "en" ? "en-GB" : "fr-FR", { month: "short" });
};

const AI_KIND: Record<string, [string, string, string]> = {
  quiz: ["Générateur de quiz", "مولد الاختبارات", "Quiz generator"],
  lesson_plan: ["Fiches pédagogiques", "الجذاذات", "Lesson plans"],
  omr: ["Lecture de copies", "قراءة الأوراق", "Paper reading"],
  diagnostic: ["Diagnostic", "التشخيص", "Diagnostic"],
  remediation: ["Remédiation", "الدعم", "Remediation"],
};

const axis = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };

/** Statistiques sur 12 mois : revenus, profs actifs, renouvellements, usage de l'IA */
export default function AdminStats() {
  const { L, lang } = useT();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    db.rpc("admin_stats").then(({ data, error }: any) => {
      if (error) setError(error.message);
      else setStats(data);
    });
  }, []);

  if (error) {
    return (
      <p className="mt-5 rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
        {L("Statistiques indisponibles : appliquez la migration « outils d'administration ». ", "الإحصائيات غير متاحة: طبّق ترحيل « أدوات الإدارة ». ", "Statistics unavailable: apply the “admin tools” migration. ")}
        ({error})
      </p>
    );
  }
  if (!stats) return <div className="mt-5 h-64 animate-pulse rounded-xl bg-muted" />;

  const revenue = stats.revenue_months.map(r => ({ ...r, label: monthLabel(r.month, lang) }));
  const growth = stats.new_teachers_months.map(r => ({ ...r, label: monthLabel(r.month, lang) }));
  const ai = stats.ai_months.map(r => ({ ...r, label: monthLabel(r.month, lang) }));
  const total12 = revenue.reduce((s, r) => s + Number(r.amount || 0), 0);
  const aiMonth = ai.length ? ai[ai.length - 1].calls : 0;
  const methodLabel = (m: string) => {
    const x = PAYMENT_METHODS.find(p => p.id === m);
    return x ? x[lang] : m;
  };

  const kpis = [
    { icon: Activity, label: L("Profs connectés (7 j / 30 j)", "أساتذة متصلون (7 / 30 يوما)", "Teachers active (7 d / 30 d)"), value: `${stats.active_7} / ${stats.active_30}` },
    { icon: UserX, label: L("Inactifs depuis 30 j", "غير نشطين منذ 30 يوما", "Inactive for 30 d"), value: stats.inactive_30 },
    { icon: Repeat, label: L("Taux de renouvellement (12 mois)", "نسبة التجديد (12 شهرا)", "Renewal rate (12 months)"), value: stats.renewal_rate == null ? "—" : `${stats.renewal_rate} %` },
    { icon: Bot, label: L("Appels IA ce mois", "طلبات الذكاء الاصطناعي هذا الشهر", "AI calls this month"), value: aiMonth },
  ];

  return (
    <div className="mt-5 space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map(k => (
          <div key={k.label} className="rounded-xl border bg-card p-3">
            <k.icon className="mb-1.5 h-4 w-4 text-muted-foreground" />
            <p className="text-lg font-semibold tabular-nums">{k.value}</p>
            <p className="text-xs text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="min-w-0 rounded-xl border bg-card p-4 lg:col-span-2">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">{L("Revenus par mois (MAD)", "المداخيل الشهرية (درهم)", "Revenue per month (MAD)")}</h2>
            <span className="text-xs text-muted-foreground">{L("12 mois : ", "12 شهرا: ", "12 months: ")}{fmtMoney(total12, lang)}</span>
          </div>
          <div className="h-56" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenue} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
                <YAxis tick={axis} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
                  formatter={(v: any) => [fmtMoney(v, lang), L("Encaissé", "المحصل", "Collected")]} />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="min-w-0 rounded-xl border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">{L("Encaissé cette année par moyen", "المحصل هذه السنة حسب الوسيلة", "Collected this year by method")}</h2>
          {stats.by_method.length === 0 ? (
            <p className="text-xs text-muted-foreground">{L("Aucun paiement cette année.", "لا أداء هذه السنة.", "No payment this year.")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {stats.by_method.map(m => {
                const max = Math.max(...stats.by_method.map(x => Number(x.amount)));
                return (
                  <li key={m.method}>
                    <div className="flex justify-between gap-2"><span>{methodLabel(m.method)}</span><span className="tabular-nums">{fmtMoney(m.amount, lang)}</span></div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${(Number(m.amount) / (max || 1)) * 100}%` }} /></div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="min-w-0 rounded-xl border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">{L("Nouveaux professeurs par mois", "أساتذة جدد شهريا", "New teachers per month")}</h2>
          <div className="h-44" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growth} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v: any) => [v, L("Professeurs", "الأساتذة", "Teachers")]} />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="min-w-0 rounded-xl border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">{L("Appels IA par mois", "طلبات الذكاء الاصطناعي شهريا", "AI calls per month")}</h2>
          <div className="h-44" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ai} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
                  formatter={(v: any, _k: any, p: any) => [`${v} · ${Number(p?.payload?.tokens || 0).toLocaleString()} tokens`, L("Appels", "طلبات", "Calls")]} />
                <Bar dataKey="calls" fill="hsl(var(--primary) / 0.7)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {stats.ai_kinds.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {stats.ai_kinds.map(k => `${AI_KIND[k.kind] ? AI_KIND[k.kind][lang === "ar" ? 1 : lang === "en" ? 2 : 0] : k.kind} : ${k.calls}`).join(" · ")}
            </p>
          )}
        </section>

        <section className="min-w-0 rounded-xl border bg-card">
          <h2 className="border-b px-4 py-2.5 text-sm font-semibold">{L("Plus gros usage IA ce mois", "أكثر استعمال للذكاء الاصطناعي هذا الشهر", "Top AI usage this month")}</h2>
          {stats.ai_top.length === 0 ? (
            <p className="px-4 py-3 text-xs text-muted-foreground">{L("Aucun appel ce mois.", "لا طلبات هذا الشهر.", "No call this month.")}</p>
          ) : (
            <ul className="divide-y text-sm">
              {stats.ai_top.map(t => (
                <li key={t.teacher_id} className="flex items-center justify-between gap-2 px-4 py-2">
                  <Link to={`/admin/teachers/${t.teacher_id}`} className="min-w-0 truncate font-medium hover:underline">{t.name}</Link>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{t.calls} · {Number(t.tokens).toLocaleString()} tk</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

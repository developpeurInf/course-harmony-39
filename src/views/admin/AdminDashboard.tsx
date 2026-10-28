import { useEffect, useState } from "react";
import { Link } from "@/lib/router";
import { Users, UserCheck, Hourglass, AlertTriangle, Ban, Wallet, GraduationCap, CalendarClock, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { daysLeftLabel, db, fmtDate, fmtMoney, PageTitle, StatusBadge, useT } from "./adminShared";
import { useConfirm } from "./ConfirmDialog";

interface Dash {
  teachers: number;
  active: number;
  trial: number;
  grace: number;
  expired: number;
  suspended: number;
  expiring_7: number;
  expiring_30: number;
  revenue_month: number;
  revenue_year: number;
  students: number;
  by_plan: { plan: string; count: number }[];
}

export default function AdminDashboard() {
  const { L, lang } = useT();
  const [dash, setDash] = useState<Dash | null>(null);
  const [soon, setSoon] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [handling, setHandling] = useState<string | null>(null);
  const { ask, dialog: confirmDialog } = useConfirm();

  useEffect(() => {
    (async () => {
      const { data, error } = await db.rpc("admin_dashboard");
      if (error) {
        setError(error.message);
        return;
      }
      setDash(data);
      const { data: teachers } = await db.rpc("admin_teachers");
      const list = (teachers || []) as any[];
      setSoon(
        list
          .filter(t => t.ends_at && ["active", "trial", "grace"].includes(t.sub_status))
          .sort((a, b) => new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime())
          .slice(0, 8)
      );
      setRecent([...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5));
      const m: Record<string, string> = {};
      list.forEach(t => (m[t.user_id] = t.name));
      setNames(m);
      const { data: req } = await db.from("subscription_requests").select("*, plans(name)").eq("status", "pending").order("created_at");
      setRequests(req || []);
    })();
  }, []);

  const markDone = (r: any) => ask({
    title: L("Marquer la demande comme traitée ?", "تحديد الطلب كمعالَج؟", "Mark the request as handled?"),
    description: L(
      `La demande de ${names[r.teacher_id] || "—"} disparaîtra de la liste. Pensez à attribuer ou renouveler l'offre depuis sa fiche si besoin.`,
      `سيختفي طلب ${names[r.teacher_id] || "—"} من القائمة. لا تنس منح العرض أو تجديده من بطاقته عند الحاجة.`,
      `${names[r.teacher_id] || "—"}'s request will leave the list. Remember to assign or renew the plan from their page if needed.`
    ),
    confirmLabel: L("Traitée", "تمت المعالجة", "Handled"),
    onConfirm: async () => {
      setHandling(r.id);
      const { error } = await db.from("subscription_requests").update({ status: "done", handled_at: new Date().toISOString() }).eq("id", r.id);
      setHandling(null);
      if (error) {
        toast.error(L(`Impossible de mettre à jour la demande : ${error.message}`, `تعذر تحديث الطلب: ${error.message}`, `Could not update the request: ${error.message}`));
        return false;
      }
      setRequests(list => list.filter(x => x.id !== r.id));
      toast.success(L("Demande traitée", "تمت معالجة الطلب", "Request handled"));
    },
  });

  if (error) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
        {L("Impossible de charger le tableau de bord : ", "تعذر تحميل لوحة القيادة: ", "Could not load the dashboard: ")}{error}
      </p>
    );
  }
  if (!dash) return <div className="h-40 animate-pulse rounded-xl bg-muted" />;

  const cards = [
    { icon: Users, label: L("Professeurs", "الأساتذة", "Teachers"), value: dash.teachers, tone: "text-slate-700 bg-slate-100 dark:bg-slate-800 dark:text-slate-200" },
    { icon: UserCheck, label: L("Actifs", "نشطون", "Active"), value: dash.active, tone: "text-emerald-700 bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300" },
    { icon: Hourglass, label: L("En essai", "في فترة تجريبية", "On trial"), value: dash.trial, tone: "text-primary bg-accent  " },
    { icon: AlertTriangle, label: L("En grâce", "في المهلة", "In grace"), value: dash.grace, tone: "text-amber-700 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300" },
    { icon: CalendarClock, label: L("Expirés / sans offre", "منتهية / بدون عرض", "Expired / none"), value: dash.expired, tone: "text-red-700 bg-red-100 dark:bg-red-900/40 dark:text-red-300" },
    { icon: Ban, label: L("Suspendus", "موقوفون", "Suspended"), value: dash.suspended, tone: "text-slate-700 bg-slate-200 dark:bg-slate-800 dark:text-slate-200" },
    { icon: GraduationCap, label: L("Élèves au total", "مجموع التلاميذ", "Total students"), value: dash.students, tone: "text-primary bg-accent  " },
    { icon: Wallet, label: L("Encaissé ce mois", "المحصل هذا الشهر", "Collected this month"), value: fmtMoney(dash.revenue_month, lang), tone: "text-primary bg-accent  " },
  ];

  return (
    <div>
      <PageTitle
        title={L("Tableau de bord", "لوحة القيادة", "Dashboard")}
        subtitle={L(
          `${dash.expiring_7} abonnement(s) expirent dans 7 jours, ${dash.expiring_30} dans 30 jours · ${fmtMoney(dash.revenue_year, lang)} encaissés cette année`,
          `${dash.expiring_7} اشتراك(ات) تنتهي خلال 7 أيام، ${dash.expiring_30} خلال 30 يوما · ${fmtMoney(dash.revenue_year, lang)} هذه السنة`,
          `${dash.expiring_7} subscription(s) end within 7 days, ${dash.expiring_30} within 30 days · ${fmtMoney(dash.revenue_year, lang)} collected this year`
        )}
      />

      {requests.length > 0 && (
        <section className="mb-4 overflow-hidden rounded-xl border border-primary/30 bg-accent  ">
          <h2 className="border-b border-primary/30 px-4 py-2.5 text-sm font-semibold ">
            {L(`Demandes des professeurs (${requests.length})`, `طلبات الأساتذة (${requests.length})`, `Teacher requests (${requests.length})`)}
          </h2>
          <ul className="divide-y divide-indigo-100 dark:divide-indigo-900">
            {requests.map(r => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold">{names[r.teacher_id] || "—"} · {r.plans?.name || L("renouvellement", "تجديد", "renewal")}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(r.created_at, lang)}{r.message ? ` · « ${r.message} »` : ""}</p>
                </div>
                <div className="flex gap-2">
                  <Link to={`/admin/teachers/${r.teacher_id}`} className="inline-flex h-9 items-center rounded-md border bg-background px-3 text-xs font-semibold hover:bg-muted">{L("Ouvrir la fiche", "فتح البطاقة", "Open")}</Link>
                  <button
                    type="button"
                    onClick={() => markDone(r)}
                    disabled={handling === r.id}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-xs font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-slate-900"
                  >
                    {handling === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    {L("Traitée", "تمت المعالجة", "Done")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(c => (
          <div key={c.label} className="min-w-0 rounded-xl border bg-card p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${c.tone}`}>
                <c.icon className="h-4 w-4" />
              </span>
              <span className="truncate text-xs font-medium text-muted-foreground">{c.label}</span>
            </div>
            <p className="mt-2 truncate text-xl font-semibold sm:text-2xl">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid items-start gap-4 lg:grid-cols-3">
        <section className="min-w-0 rounded-xl border bg-card lg:col-span-2">
          <header className="flex items-center justify-between border-b px-4 py-1.5">
            <h2 className="text-sm font-semibold">{L("Prochaines expirations", "الاشتراكات القريبة من الانتهاء", "Upcoming expirations")}</h2>
            <Link to="/admin/subscriptions" className="inline-flex min-h-[36px] items-center px-1 text-xs font-semibold text-primary">{L("Tout voir", "عرض الكل", "See all")}</Link>
          </header>
          {soon.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{L("Aucune expiration prévue.", "لا يوجد اشتراك سينتهي قريبا.", "No upcoming expiration.")}</p>
          ) : (
            <ul className="divide-y">
              {soon.map(t => (
                <li key={t.user_id}>
                  <Link to={`/admin/teachers/${t.user_id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{t.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{t.plan_name} · {fmtDate(t.ends_at, lang)}</p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      {t.days_left !== null && t.sub_status !== "grace" && (
                        <span className="whitespace-nowrap text-xs font-semibold text-muted-foreground">{daysLeftLabel(t.days_left, L)}</span>
                      )}
                      <StatusBadge status={t.sub_status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="min-w-0 space-y-4">
          <div className="rounded-xl border bg-card">
            <header className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold">{L("Professeurs par offre", "الأساتذة حسب العرض", "Teachers by plan")}</h2>
            </header>
            <ul className="space-y-2 p-4">
              {dash.by_plan.length === 0 && <li className="text-sm text-muted-foreground">—</li>}
              {dash.by_plan.map(p => {
                const pct = dash.teachers ? Math.round((p.count / dash.teachers) * 100) : 0;
                return (
                  <li key={p.plan}>
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold">{p.plan}</span>
                      <span className="text-muted-foreground">{p.count}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="rounded-xl border bg-card">
            <header className="flex items-center justify-between border-b px-4 py-1.5">
              <h2 className="text-sm font-semibold">{L("Derniers comptes créés", "آخر الحسابات المنشأة", "Latest accounts")}</h2>
              <Link to="/admin/teachers" className="inline-flex min-h-[36px] items-center px-1 text-xs font-semibold text-primary">{L("Professeurs", "الأساتذة", "Teachers")}</Link>
            </header>
            <ul className="divide-y">
              {recent.map(t => (
                <li key={t.user_id}>
                  <Link to={`/admin/teachers/${t.user_id}`} className="block px-4 py-2 hover:bg-muted/50">
                    <p className="truncate text-sm font-medium">{t.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{fmtDate(t.created_at, lang)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
      {confirmDialog}
    </div>
  );
}

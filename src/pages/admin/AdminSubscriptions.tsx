import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccess } from "@/contexts/AccessContext";
import { addDaysIso, db, fmtDate, PageTitle, StatusBadge, useT } from "./adminShared";
import { useConfirm } from "./ConfirmDialog";

type Filter = "all" | "7" | "30" | "grace" | "expired" | "trial";

/** Abonnement en cours d'un professeur (même règle que subscription_status) */
const currentOf = (subs: any[]) =>
  subs
    .filter(s => !s.canceled_at && new Date(s.starts_at) <= new Date())
    .sort((a, b) => (a.ends_at === null ? -1 : b.ends_at === null ? 1 : new Date(b.ends_at).getTime() - new Date(a.ends_at).getTime()))[0] || null;

export default function AdminSubscriptions() {
  const { L, lang } = useT();
  const { adminCan } = useAccess();
  const canEdit = adminCan("admin.subscriptions.manage");
  const [teachers, setTeachers] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [filter, setFilter] = useState<Filter>("30");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [days, setDays] = useState("30");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const { ask, dialog: confirmDialog } = useConfirm();

  const load = async () => {
    const [{ data: t, error }, { data: s }, { data: p }] = await Promise.all([
      db.rpc("admin_teachers"),
      db.from("subscriptions").select("*"),
      db.from("plans").select("*"),
    ]);
    setTeachers(t || []);
    setSubs(s || []);
    setPlans(p || []);
    setChecked({});
    setLoading(false);
    if (error) toast.error(error.message);
  };
  useEffect(() => {
    void load();
  }, []);

  const rows = useMemo(() => {
    const now = Date.now();
    return teachers
      .filter(t => {
        const end = t.ends_at ? new Date(t.ends_at).getTime() : null;
        switch (filter) {
          case "7": return end !== null && end >= now && end <= now + 7 * 86400000;
          case "30": return end !== null && end >= now && end <= now + 30 * 86400000;
          case "grace": return t.sub_status === "grace";
          case "expired": return t.sub_status === "expired" || t.sub_status === "none";
          case "trial": return t.sub_status === "trial";
          default: return true;
        }
      })
      .sort((a, b) => (a.ends_at ? new Date(a.ends_at).getTime() : Infinity) - (b.ends_at ? new Date(b.ends_at).getTime() : Infinity));
  }, [teachers, filter]);

  const selected = rows.filter(r => checked[r.user_id]);

  /** Bilan d'une opération groupée : « x réussis, y échecs (noms…) » */
  const report = (ok: number, failed: string[], okMsg: (n: number) => string) => {
    if (!failed.length) {
      toast.success(okMsg(ok));
      return;
    }
    const names = failed.slice(0, 5).join(", ") + (failed.length > 5 ? "…" : "");
    const msg = L(
      `${ok} réussi(s), ${failed.length} échec(s) (${names})`,
      `${ok} ناجحة، ${failed.length} فاشلة (${names})`,
      `${ok} succeeded, ${failed.length} failed (${names})`
    );
    if (ok) toast.warning(msg, { duration: 10000 });
    else toast.error(msg, { duration: 10000 });
  };

  /** Renouvelle : nouvel abonnement de la même offre (ou de la dernière) à partir de la fin actuelle */
  const doRenew = async () => {
    setBusy(true);
    let ok = 0;
    const failed: string[] = [];
    const note = L("Renouvellement groupé", "تجديد جماعي", "Bulk renewal");
    for (const t of selected) {
      const mine = subs.filter(s => s.teacher_id === t.user_id);
      const cur = currentOf(mine) || mine.slice().sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())[0];
      const plan = cur ? plans.find(p => p.id === cur.plan_id) : null;
      if (!cur || !plan) {
        failed.push(`${t.name} : ${L("aucune offre", "لا يوجد عرض", "no plan")}`);
        continue;
      }
      const start = cur.ends_at && new Date(cur.ends_at) > new Date() ? cur.ends_at : new Date().toISOString();
      const { error } = await db.from("subscriptions").insert({
        teacher_id: t.user_id, plan_id: plan.id, kind: "paid", starts_at: start,
        ends_at: plan.duration_days ? addDaysIso(start, plan.duration_days) : null, grace_days: plan.grace_days ?? 7,
        price_mad: plan.price_mad, notes: note,
      });
      if (error) failed.push(t.name);
      else ok++;
    }
    setBusy(false);
    report(ok, failed, n => L(`${n} abonnement(s) renouvelé(s)`, `تم تجديد ${n} اشتراك(ات)`, `${n} subscription(s) renewed`));
    void load();
  };
  const renew = () => {
    if (!selected.length) return;
    ask({
      title: L(`Renouveler ${selected.length} abonnement(s) ?`, `تجديد ${selected.length} اشتراك(ات)؟`, `Renew ${selected.length} subscription(s)?`),
      description: L(
        "Un nouvel abonnement payant de la même offre démarre à la fin de l'actuel (ou aujourd'hui s'il est terminé).",
        "يبدأ اشتراك مؤدى عنه جديد بنفس العرض عند نهاية الحالي (أو اليوم إذا انتهى).",
        "A new paid subscription of the same plan starts when the current one ends (or today)."
      ),
      confirmLabel: L("Renouveler", "تجديد", "Renew"),
      onConfirm: doRenew,
    });
  };

  const doExtend = async (n: number) => {
    setBusy(true);
    let ok = 0;
    const failed: string[] = [];
    for (const t of selected) {
      const cur = currentOf(subs.filter(s => s.teacher_id === t.user_id));
      if (!cur?.ends_at) {
        failed.push(`${t.name} : ${cur ? L("sans fin", "بدون نهاية", "no end") : L("aucun abonnement en cours", "لا يوجد اشتراك حالي", "no current subscription")}`);
        continue;
      }
      const base = new Date(cur.ends_at) > new Date() ? cur.ends_at : new Date().toISOString();
      const { error } = await db.from("subscriptions").update({ ends_at: addDaysIso(base, n) }).eq("id", cur.id);
      if (error) failed.push(t.name);
      else ok++;
    }
    setBusy(false);
    report(ok, failed, k => L(`${k} abonnement(s) prolongé(s)`, `تم تمديد ${k} اشتراك(ات)`, `${k} subscription(s) extended`));
    void load();
  };
  const extend = () => {
    const n = Math.floor(Number(days));
    if (!selected.length || !(n > 0)) return;
    ask({
      title: L(`Prolonger ${selected.length} abonnement(s) de ${n} jour(s) ?`, `تمديد ${selected.length} اشتراك(ات) بـ ${n} يوم؟`, `Extend ${selected.length} subscription(s) by ${n} day(s)?`),
      description: L(
        "La date de fin de chaque abonnement en cours est reportée (à partir d'aujourd'hui si elle est dépassée).",
        "يُؤجل تاريخ نهاية كل اشتراك حالي (ابتداء من اليوم إذا كان قد انتهى).",
        "Each current subscription's end date is pushed back (from today if already past)."
      ),
      confirmLabel: L("Prolonger", "تمديد", "Extend"),
      onConfirm: () => doExtend(n),
    });
  };

  const filters: { id: Filter; label: string }[] = [
    { id: "7", label: L("Expirent sous 7 j", "تنتهي خلال 7 أيام", "Ending in 7 d") },
    { id: "30", label: L("Expirent sous 30 j", "تنتهي خلال 30 يوما", "Ending in 30 d") },
    { id: "trial", label: L("En essai", "تجريبي", "Trial") },
    { id: "grace", label: L("En grâce", "في المهلة", "In grace") },
    { id: "expired", label: L("Expirés", "منتهية", "Expired") },
    { id: "all", label: L("Tous", "الكل", "All") },
  ];

  return (
    <div>
      <PageTitle
        title={L("Abonnements", "الاشتراكات", "Subscriptions")}
        subtitle={L("Suivi des dates de fin, renouvellements et prolongations, un par un ou en groupe.", "تتبع تواريخ النهاية والتجديد والتمديد، فرديا أو جماعيا.", "Track end dates, renew or extend one by one or in bulk.")}
      />
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: "touch" } as any}>
        {filters.map(f => (
          <button key={f.id} type="button" onClick={() => { setFilter(f.id); setChecked({}); }}
            aria-pressed={filter === f.id}
            className={`min-h-[36px] flex-shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${filter === f.id ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900" : "bg-background"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {canEdit && selected.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-2.5 dark:border-indigo-900 dark:bg-indigo-950/30">
          <span className="text-sm font-semibold">{selected.length} {L("sélectionné(s)", "محدد", "selected")}</span>
          <Button size="sm" className="gap-1.5" disabled={busy} onClick={renew}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}{L("Renouveler", "تجديد", "Renew")}
          </Button>
          <div className="flex items-center gap-1.5">
            <Input type="number" min="1" value={days} onChange={e => setDays(e.target.value)} className="h-9 w-20" aria-label={L("Nombre de jours", "عدد الأيام", "Number of days")} disabled={busy} />
            <Button size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={extend}><CalendarPlus className="h-3.5 w-3.5" />{L("Prolonger (jours)", "تمديد (أيام)", "Extend (days)")}</Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card">
        {loading ? (
          <div className="h-32 animate-pulse bg-muted/40" />
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">{L("Aucun abonnement dans cette liste.", "لا يوجد أي اشتراك في هذه القائمة.", "No subscription in this list.")}</p>
        ) : (
          <ul className="divide-y">
            {canEdit && (
              <li className="bg-muted/40 px-3 text-xs font-semibold text-muted-foreground">
                <label className="flex min-h-[40px] cursor-pointer items-center gap-2">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    disabled={busy || rows.length === 0}
                    checked={rows.length > 0 && selected.length === rows.length}
                    ref={el => { if (el) el.indeterminate = selected.length > 0 && selected.length < rows.length; }}
                    onChange={e => {
                      const m: Record<string, boolean> = {};
                      if (e.target.checked) rows.forEach(r => (m[r.user_id] = true));
                      setChecked(m);
                    }}
                  />
                  </span>
                  {L("Tout sélectionner", "تحديد الكل", "Select all")}
                </label>
              </li>
            )}
            {rows.map(t => (
              <li key={t.user_id} className="flex items-center gap-2 px-3 py-1.5">
                {canEdit && (
                  <label className="flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center" title={t.name}>
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      disabled={busy}
                      aria-label={L(`Sélectionner ${t.name}`, `تحديد ${t.name}`, `Select ${t.name}`)}
                      checked={!!checked[t.user_id]}
                      onChange={e => setChecked({ ...checked, [t.user_id]: e.target.checked })}
                    />
                  </label>
                )}
                <Link to={`/admin/teachers/${t.user_id}`} className="flex min-h-[40px] min-w-0 flex-1 flex-wrap items-center justify-between gap-2 py-1">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{t.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{t.plan_name || "—"} · {t.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{t.ends_at ? fmtDate(t.ends_at, lang) : L("sans fin", "بدون نهاية", "no end")}</span>
                    <StatusBadge status={t.account_status === "suspended" ? "suspended" : t.sub_status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      {confirmDialog}
    </div>
  );
}

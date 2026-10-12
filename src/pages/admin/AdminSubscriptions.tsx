import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccess } from "@/contexts/AccessContext";
import { addDaysIso, db, fmtDate, PageTitle, StatusBadge, useT } from "./adminShared";

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

  const load = async () => {
    const [{ data: t }, { data: s }, { data: p }] = await Promise.all([
      db.rpc("admin_teachers"),
      db.from("subscriptions").select("*"),
      db.from("plans").select("*"),
    ]);
    setTeachers(t || []);
    setSubs(s || []);
    setPlans(p || []);
    setChecked({});
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

  /** Renouvelle : nouvel abonnement de la même offre (ou de la dernière) à partir de la fin actuelle */
  const renew = async () => {
    if (!selected.length) return;
    if (!confirm(L(`Renouveler ${selected.length} abonnement(s) avec la même offre ?`, `تجديد ${selected.length} اشتراك(ات) بنفس العرض؟`, `Renew ${selected.length} subscription(s) with the same plan?`))) return;
    setBusy(true);
    let ok = 0;
    for (const t of selected) {
      const mine = subs.filter(s => s.teacher_id === t.user_id);
      const cur = currentOf(mine) || mine.sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())[0];
      if (!cur) continue;
      const plan = plans.find(p => p.id === cur.plan_id);
      if (!plan) continue;
      const start = cur.ends_at && new Date(cur.ends_at) > new Date() ? cur.ends_at : new Date().toISOString();
      const { error } = await db.from("subscriptions").insert({
        teacher_id: t.user_id, plan_id: plan.id, kind: "paid", starts_at: start,
        ends_at: plan.duration_days ? addDaysIso(start, plan.duration_days) : null, grace_days: plan.grace_days ?? 7,
        price_mad: plan.price_mad, notes: "Renouvellement groupé",
      });
      if (!error) ok++;
    }
    setBusy(false);
    toast.success(L(`${ok} abonnement(s) renouvelé(s)`, `تم تجديد ${ok} اشتراك(ات)`, `${ok} subscription(s) renewed`));
    void load();
  };

  const extend = async () => {
    const n = Number(days);
    if (!selected.length || !n) return;
    setBusy(true);
    let ok = 0;
    for (const t of selected) {
      const cur = currentOf(subs.filter(s => s.teacher_id === t.user_id));
      if (!cur?.ends_at) continue;
      const base = new Date(cur.ends_at) > new Date() ? cur.ends_at : new Date().toISOString();
      const { error } = await db.from("subscriptions").update({ ends_at: addDaysIso(base, n) }).eq("id", cur.id);
      if (!error) ok++;
    }
    setBusy(false);
    toast.success(L(`${ok} abonnement(s) prolongé(s)`, `تم تمديد ${ok} اشتراك(ات)`, `${ok} subscription(s) extended`));
    void load();
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
            className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${filter === f.id ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900" : "bg-background"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {canEdit && selected.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-2.5 dark:border-indigo-900 dark:bg-indigo-950/30">
          <span className="text-sm font-semibold">{selected.length} {L("sélectionné(s)", "محدد", "selected")}</span>
          <Button size="sm" className="gap-1.5" disabled={busy} onClick={renew}><RefreshCw className="h-3.5 w-3.5" />{L("Renouveler", "تجديد", "Renew")}</Button>
          <div className="flex items-center gap-1.5">
            <Input type="number" min="1" value={days} onChange={e => setDays(e.target.value)} className="h-8 w-20" />
            <Button size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={extend}><CalendarPlus className="h-3.5 w-3.5" />{L("Prolonger (jours)", "تمديد (أيام)", "Extend (days)")}</Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card">
        {rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">{L("Aucun abonnement dans cette liste.", "لا يوجد أي اشتراك في هذه القائمة.", "No subscription in this list.")}</p>
        ) : (
          <ul className="divide-y">
            {canEdit && (
              <li className="flex items-center gap-3 bg-muted/40 px-4 py-2 text-xs font-semibold text-muted-foreground">
                <input type="checkbox" checked={selected.length === rows.length} onChange={e => {
                  const m: Record<string, boolean> = {};
                  if (e.target.checked) rows.forEach(r => (m[r.user_id] = true));
                  setChecked(m);
                }} />
                {L("Tout sélectionner", "تحديد الكل", "Select all")}
              </li>
            )}
            {rows.map(t => (
              <li key={t.user_id} className="flex items-center gap-3 px-4 py-2.5">
                {canEdit && <input type="checkbox" checked={!!checked[t.user_id]} onChange={e => setChecked({ ...checked, [t.user_id]: e.target.checked })} />}
                <Link to={`/admin/teachers/${t.user_id}`} className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
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
    </div>
  );
}

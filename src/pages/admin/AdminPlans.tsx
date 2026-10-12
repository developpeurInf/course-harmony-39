import { useEffect, useMemo, useState } from "react";
import { Plus, Copy, Pencil, Archive, ArchiveRestore, Trash2, Table2, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAccess } from "@/contexts/AccessContext";
import { MODULE_LABELS } from "@/lib/permissions";
import { db, fmtMoney, moduleLabel, PageTitle, PERIODS, permLabel, useT } from "./adminShared";
import type { PlanRow } from "./AdminTeachers";

const selectCls = "h-10 w-full rounded-md border bg-background px-3 text-sm";
const COLORS: Record<string, string> = {
  slate: "bg-slate-500", indigo: "bg-indigo-500", violet: "bg-violet-500", emerald: "bg-emerald-500",
  amber: "bg-amber-500", rose: "bg-rose-500", sky: "bg-sky-500",
};

export default function AdminPlans() {
  const { L, lang } = useT();
  const { adminCan } = useAccess();
  const canEdit = adminCan("admin.plans.manage");
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [content, setContent] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<PlanRow | "new" | null>(null);
  const [view, setView] = useState<"cards" | "matrix">("cards");

  const load = async () => {
    const [{ data: p }, { data: c }, { data: cat }, { data: t }] = await Promise.all([
      db.from("plans").select("*").order("sort_order"),
      db.from("plan_permissions").select("*"),
      db.from("permissions").select("*").neq("kind", "admin").order("sort_order"),
      db.rpc("admin_teachers"),
    ]);
    setPlans(p || []);
    setContent(c || []);
    setCatalog(cat || []);
    const m: Record<string, number> = {};
    (t || []).forEach((r: any) => {
      if (r.plan_id && !["expired", "none"].includes(r.sub_status)) m[r.plan_id] = (m[r.plan_id] || 0) + 1;
    });
    setCounts(m);
  };
  useEffect(() => {
    void load();
  }, []);

  const byPlan = useMemo(() => {
    const m: Record<string, Record<string, any>> = {};
    content.forEach(c => ((m[c.plan_id] = m[c.plan_id] || {})[c.permission_key] = c));
    return m;
  }, [content]);

  const featureCount = (id: string) => catalog.filter(p => p.kind === "feature" && byPlan[id]?.[p.key]).length;
  const totalFeatures = catalog.filter(p => p.kind === "feature").length;

  const duplicate = async (p: PlanRow) => {
    const { id, ...rest } = p as any;
    delete rest.created_at;
    delete rest.updated_at;
    const { data, error } = await db.from("plans").insert({ ...rest, name: `${p.name} (${L("copie", "نسخة", "copy")})`, is_active: false, is_trial_plan: false }).select("id").single();
    if (error) return toast.error(error.message);
    const rows = content.filter(c => c.plan_id === id).map(c => ({ plan_id: data.id, permission_key: c.permission_key, limit_value: c.limit_value }));
    if (rows.length) await db.from("plan_permissions").insert(rows);
    toast.success(L("Offre dupliquée (archivée, à activer)", "تم نسخ العرض (مؤرشف)", "Plan duplicated (archived)"));
    void load();
  };
  const toggleActive = async (p: PlanRow) => {
    const { error } = await db.from("plans").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) return toast.error(error.message);
    void load();
  };
  const remove = async (p: PlanRow) => {
    const { count } = await db.from("subscriptions").select("id", { count: "exact", head: true }).eq("plan_id", p.id);
    if (count) return toast.error(L("Cette offre a déjà des abonnements : archivez-la plutôt.", "لهذا العرض اشتراكات: قم بأرشفته بدلا من ذلك.", "This plan has subscriptions: archive it instead."));
    if (!confirm(L(`Supprimer l'offre « ${p.name} » ?`, `حذف العرض « ${p.name} »؟`, `Delete plan “${p.name}”?`))) return;
    const { error } = await db.from("plans").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    void load();
  };

  const period = (id: string) => {
    const x = PERIODS.find(p => p.id === id);
    return x ? L(x.fr, x.ar, x.en) : id;
  };

  return (
    <div>
      <PageTitle
        title={L("Offres", "العروض", "Plans")}
        subtitle={L("Chaque offre définit les fonctions autorisées, les quotas et la durée.", "كل عرض يحدد الوظائف المسموح بها والحصص والمدة.", "Each plan sets allowed features, quotas and duration.")}
        actions={
          <>
            <div className="inline-flex rounded-md border p-0.5">
              <button type="button" onClick={() => setView("cards")} className={`rounded px-2 py-1 ${view === "cards" ? "bg-muted" : ""}`} aria-label="cards"><LayoutGrid className="h-4 w-4" /></button>
              <button type="button" onClick={() => setView("matrix")} className={`rounded px-2 py-1 ${view === "matrix" ? "bg-muted" : ""}`} aria-label="matrix"><Table2 className="h-4 w-4" /></button>
            </div>
            {canEdit && (
              <Button className="gap-1.5" onClick={() => setEditing("new")}><Plus className="h-4 w-4" />{L("Nouvelle offre", "عرض جديد", "New plan")}</Button>
            )}
          </>
        }
      />

      {view === "cards" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map(p => (
            <div key={p.id} className={`flex min-w-0 flex-col rounded-xl border bg-card p-4 ${p.is_active ? "" : "opacity-70"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`h-3 w-3 flex-shrink-0 rounded-full ${COLORS[p.color] || COLORS.indigo}`} />
                  <h2 className="truncate text-base font-bold">{p.name}</h2>
                </div>
                <div className="flex flex-shrink-0 gap-1">
                  {p.is_trial_plan && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">{L("ESSAI", "تجريبي", "TRIAL")}</span>}
                  {!p.is_active && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">{L("ARCHIVÉE", "مؤرشف", "ARCHIVED")}</span>}
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold">{fmtMoney(p.price_mad)}</p>
              <p className="text-xs text-muted-foreground">
                {period(p.billing_period)}
                {p.billing_period !== "unlimited" && ` · ${p.duration_days ? `${p.duration_days} ${L("jours", "يوم", "days")}` : L("sans fin", "بدون نهاية", "no end")}`}
                {p.grace_days > 0 && ` · ${L("grâce", "مهلة", "grace")} ${p.grace_days} ${L("j", "ي", "d")}`}
              </p>
              {p.description && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{p.description}</p>}
              <div className="mt-3 space-y-1 text-xs">
                <p><span className="font-semibold">{featureCount(p.id)}</span> / {totalFeatures} {L("fonctions", "وظيفة", "features")}</p>
                {catalog.filter(c => c.kind === "quota").map(c => {
                  const row = byPlan[p.id]?.[c.key];
                  return (
                    <p key={c.key} className="flex justify-between gap-2 text-muted-foreground">
                      <span className="truncate">{permLabel(c.key, lang)}</span>
                      <span className="font-semibold text-foreground">{!row || row.limit_value === null ? "∞" : row.limit_value}</span>
                    </p>
                  );
                })}
              </div>
              <p className="mt-3 text-xs font-medium">{counts[p.id] || 0} {L("abonné(s)", "مشترك", "subscriber(s)")}</p>
              {canEdit && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" />{L("Modifier", "تعديل", "Edit")}</Button>
                  <Button size="sm" variant="ghost" className="gap-1" onClick={() => duplicate(p)}><Copy className="h-3.5 w-3.5" />{L("Dupliquer", "نسخ", "Duplicate")}</Button>
                  <Button size="sm" variant="ghost" className="gap-1" onClick={() => toggleActive(p)}>
                    {p.is_active ? <Archive className="h-3.5 w-3.5" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
                    {p.is_active ? L("Archiver", "أرشفة", "Archive") : L("Activer", "تفعيل", "Activate")}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(p)} aria-label="delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="sticky top-0 bg-muted/60 text-xs">
              <tr>
                <th className="px-3 py-2 text-start font-semibold">{L("Fonction", "الوظيفة", "Feature")}</th>
                {plans.map(p => <th key={p.id} className="px-3 py-2 text-center font-semibold">{p.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {Object.keys(MODULE_LABELS).filter(m => catalog.some(c => c.module === m)).map(m => (
                <ModuleRows key={m} module={m} catalog={catalog} plans={plans} byPlan={byPlan} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PlanEditor
        plan={editing}
        onClose={() => setEditing(null)}
        catalog={catalog}
        content={editing && editing !== "new" ? byPlan[editing.id] || {} : {}}
        onSaved={load}
      />
    </div>
  );
}

function ModuleRows({ module, catalog, plans, byPlan }: any) {
  const { lang } = useT();
  const items = catalog.filter((c: any) => c.module === module);
  return (
    <>
      <tr className="bg-muted/30">
        <td colSpan={plans.length + 1} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">{moduleLabel(module, lang)}</td>
      </tr>
      {items.map((c: any) => (
        <tr key={c.key} className="border-t">
          <td className="px-3 py-1.5">{permLabel(c.key, lang)}</td>
          {plans.map((p: PlanRow) => {
            const row = byPlan[p.id]?.[c.key];
            return (
              <td key={p.id} className="px-3 py-1.5 text-center">
                {c.kind === "quota"
                  ? <span className="font-semibold">{!row || row.limit_value === null ? "∞" : row.limit_value}</span>
                  : row ? <span className="font-bold text-emerald-600">✓</span> : <span className="text-muted-foreground">—</span>}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------

function PlanEditor({ plan, onClose, catalog, content, onSaved }: {
  plan: PlanRow | "new" | null; onClose: () => void; catalog: any[]; content: Record<string, any>; onSaved: () => void;
}) {
  const { L, lang } = useT();
  const [f, setF] = useState<any>({});
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!plan) return;
    if (plan === "new") {
      setF({ name: "", description: "", price_mad: "0", billing_period: "school_year", duration_days: "300", trial_days: "14", grace_days: "7", is_active: true, is_trial_plan: false, color: "indigo", sort_order: "10" });
      const s: Record<string, boolean> = {};
      catalog.filter(c => c.kind === "feature" && !c.is_write).forEach(c => (s[c.key] = true));
      setSel(s);
      setLimits({});
    } else {
      setF({ ...plan, price_mad: String(plan.price_mad ?? 0), duration_days: plan.duration_days === null ? "" : String(plan.duration_days), trial_days: String(plan.trial_days ?? 0), grace_days: String(plan.grace_days ?? 7), sort_order: String(plan.sort_order ?? 0) });
      const s: Record<string, boolean> = {};
      const l: Record<string, string> = {};
      Object.values(content).forEach((c: any) => {
        s[c.permission_key] = true;
        l[c.permission_key] = c.limit_value === null || c.limit_value === undefined ? "" : String(c.limit_value);
      });
      setSel(s);
      setLimits(l);
    }
  }, [plan, catalog, content]);

  const modules = Object.keys(MODULE_LABELS).filter(m => m !== "admin" && catalog.some(c => c.module === m));
  const setModule = (m: string, v: boolean) => {
    const s = { ...sel };
    catalog.filter(c => c.module === m && c.kind === "feature").forEach(c => (s[c.key] = v));
    setSel(s);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const row = {
      name: f.name.trim(), description: f.description || null, price_mad: Number(f.price_mad || 0), billing_period: f.billing_period,
      duration_days: f.duration_days === "" ? null : Number(f.duration_days), trial_days: Number(f.trial_days || 0),
      grace_days: Number(f.grace_days || 0), is_active: !!f.is_active, is_trial_plan: !!f.is_trial_plan, color: f.color,
      sort_order: Number(f.sort_order || 0),
    };
    let planId = plan !== "new" && plan ? plan.id : "";
    if (plan === "new") {
      const { data, error } = await db.from("plans").insert(row).select("id").single();
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
      planId = data.id;
    } else {
      const { error } = await db.from("plans").update(row).eq("id", planId);
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
    }
    // Une seule offre d'essai par défaut
    if (row.is_trial_plan) await db.from("plans").update({ is_trial_plan: false }).neq("id", planId).eq("is_trial_plan", true);

    // Contenu : on n'écrit que les différences (journal lisible)
    const wanted: Record<string, number | null> = {};
    catalog.forEach(c => {
      if (c.kind === "feature" && sel[c.key]) wanted[c.key] = null;
      if (c.kind === "quota") {
        const v = limits[c.key];
        wanted[c.key] = v === undefined || v === "" ? null : Number(v);
      }
    });
    const existing = plan === "new" ? {} : content;
    const toDelete = Object.keys(existing).filter(k => !(k in wanted));
    const toUpsert = Object.entries(wanted)
      .filter(([k, v]) => !existing[k] || (existing[k].limit_value ?? null) !== v)
      .map(([k, v]) => ({ plan_id: planId, permission_key: k, limit_value: v }));
    if (toDelete.length) await db.from("plan_permissions").delete().eq("plan_id", planId).in("permission_key", toDelete);
    if (toUpsert.length) {
      const { error } = await db.from("plan_permissions").upsert(toUpsert, { onConflict: "plan_id,permission_key" });
      if (error) toast.error(error.message);
    }
    setSaving(false);
    toast.success(L("Offre enregistrée", "تم حفظ العرض", "Plan saved"));
    onClose();
    onSaved();
  };

  return (
    <Dialog open={!!plan} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{plan === "new" ? L("Nouvelle offre", "عرض جديد", "New plan") : L("Modifier l'offre", "تعديل العرض", "Edit plan")}</DialogTitle>
          <DialogDescription>
            {L("Les changements s'appliquent immédiatement à tous les abonnés de cette offre. Pour ne pas toucher les abonnés actuels, dupliquez l'offre et archivez l'ancienne.",
               "تطبق التغييرات فورا على جميع مشتركي هذا العرض. لعدم المساس بالمشتركين الحاليين، انسخ العرض وأرشف القديم.",
               "Changes apply immediately to all subscribers. To leave current subscribers untouched, duplicate the plan and archive the old one.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{L("Nom", "الاسم", "Name")} *</Label>
              <Input required value={f.name || ""} onChange={e => setF({ ...f, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{L("Prix (MAD)", "الثمن (درهم)", "Price (MAD)")}</Label>
              <Input type="number" min="0" step="0.01" value={f.price_mad || ""} onChange={e => setF({ ...f, price_mad: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label>{L("Description", "الوصف", "Description")}</Label>
              <Textarea rows={2} value={f.description || ""} onChange={e => setF({ ...f, description: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{L("Périodicité", "الدورية", "Billing period")}</Label>
              <select className={selectCls} value={f.billing_period} onChange={e => {
                const p = PERIODS.find(x => x.id === e.target.value);
                setF({ ...f, billing_period: e.target.value, duration_days: p?.days ? String(p.days) : e.target.value === "unlimited" ? "" : f.duration_days });
              }}>
                {PERIODS.map(p => <option key={p.id} value={p.id}>{L(p.fr, p.ar, p.en)}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{L("Durée (jours, vide = sans fin)", "المدة (أيام، فارغ = بدون نهاية)", "Duration (days, empty = none)")}</Label>
              <Input type="number" min="1" value={f.duration_days ?? ""} onChange={e => setF({ ...f, duration_days: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{L("Délai de grâce (jours)", "مهلة السماح (أيام)", "Grace period (days)")}</Label>
              <Input type="number" min="0" value={f.grace_days ?? ""} onChange={e => setF({ ...f, grace_days: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{L("Durée en essai (jours)", "مدة التجربة (أيام)", "Trial length (days)")}</Label>
              <Input type="number" min="0" value={f.trial_days ?? ""} onChange={e => setF({ ...f, trial_days: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{L("Couleur", "اللون", "Color")}</Label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {Object.entries(COLORS).map(([c, cls]) => (
                  <button key={c} type="button" onClick={() => setF({ ...f, color: c })} aria-label={c}
                    className={`h-7 w-7 rounded-full ${cls} ${f.color === c ? "ring-2 ring-offset-2 ring-foreground" : ""}`} />
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{L("Ordre d'affichage", "ترتيب العرض", "Display order")}</Label>
              <Input type="number" value={f.sort_order ?? ""} onChange={e => setF({ ...f, sort_order: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!f.is_active} onChange={e => setF({ ...f, is_active: e.target.checked })} />{L("Proposée (non archivée)", "معروض (غير مؤرشف)", "Offered (not archived)")}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!f.is_trial_plan} onChange={e => setF({ ...f, is_trial_plan: e.target.checked })} />{L("Offre d'essai par défaut pour les nouveaux comptes", "عرض تجريبي افتراضي للحسابات الجديدة", "Default trial plan for new accounts")}</label>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold">{L("Fonctions autorisées", "الوظائف المسموح بها", "Allowed features")}</h3>
            {modules.filter(m => m !== "quota").map(m => {
              const items = catalog.filter(c => c.module === m && c.kind === "feature");
              const all = items.every(c => sel[c.key]);
              return (
                <div key={m} className="rounded-lg border">
                  <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-1.5">
                    <span className="text-xs font-bold uppercase tracking-wide">{moduleLabel(m, lang)}</span>
                    <button type="button" className="text-xs font-semibold text-primary" onClick={() => setModule(m, !all)}>
                      {all ? L("Tout décocher", "إلغاء الكل", "Uncheck all") : L("Tout cocher", "تحديد الكل", "Check all")}
                    </button>
                  </div>
                  <div className="grid gap-x-4 gap-y-1 p-3 sm:grid-cols-2">
                    {items.map(c => (
                      <label key={c.key} className="flex items-start gap-2 text-sm">
                        <input type="checkbox" className="mt-0.5" checked={!!sel[c.key]} onChange={e => setSel({ ...sel, [c.key]: e.target.checked })} />
                        <span>{permLabel(c.key, lang)}{!c.is_write && <span className="text-[11px] text-muted-foreground"> · {L("lecture", "قراءة", "read")}</span>}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold">{L("Quotas (vide = illimité, 0 = aucun)", "الحصص (فارغ = غير محدود، 0 = لا شيء)", "Quotas (empty = unlimited, 0 = none)")}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {catalog.filter(c => c.kind === "quota").map(c => (
                <div key={c.key} className="space-y-1">
                  <Label className="text-xs">{permLabel(c.key, lang)}</Label>
                  <Input type="number" min="0" placeholder="∞" value={limits[c.key] ?? ""} onChange={e => setLimits({ ...limits, [c.key]: e.target.value })} />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose}>{L("Annuler", "إلغاء", "Cancel")}</Button>
            <Button type="submit" disabled={saving}>{saving ? "…" : L("Enregistrer", "حفظ", "Save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

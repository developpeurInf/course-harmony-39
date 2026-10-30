import { useEffect, useMemo, useState } from "react";
import { Plus, Copy, Pencil, Archive, ArchiveRestore, Trash2, Table2, LayoutGrid, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAccess } from "@/contexts/AccessContext";
import { MODULE_LABELS, moduleOf } from "@/lib/permissions";
import { db, fmtMoney, moduleLabel, PageTitle, PERIODS, permLabel, useT } from "./adminShared";
import type { PlanRow } from "./AdminTeachers";
import { useConfirm } from "./ConfirmDialog";

const selectCls = "h-10 w-full rounded-md border bg-background px-3 text-sm";
const COLORS: Record<string, string> = {
  slate: "bg-slate-500", indigo: "bg-primary", violet: "bg-primary", emerald: "bg-emerald-500",
  amber: "bg-amber-500", rose: "bg-rose-500", sky: "bg-primary",
};

export default function AdminPlans() {
  const { L, lang } = useT();
  const { adminCan } = useAccess();
  const canEdit = adminCan("admin.plans.manage");
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [content, setContent] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  // modules « Complet » de chaque offre (plan_modules)
  const [fullMods, setFullMods] = useState<Record<string, Set<string>>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<PlanRow | "new" | null>(null);
  const [view, setView] = useState<"cards" | "matrix">("cards");
  const [loading, setLoading] = useState(true);
  const { ask, dialog: confirmDialog } = useConfirm();

  const load = async () => {
    const [{ data: p, error }, { data: c }, { data: cat }, { data: t }, { data: pm }] = await Promise.all([
      db.from("plans").select("*").order("sort_order"),
      db.from("plan_permissions").select("*"),
      db.from("permissions").select("*").neq("kind", "admin").order("sort_order"),
      db.rpc("admin_teachers"),
      db.from("plan_modules").select("plan_id, module"), // absente avant la migration 20261104090000 : ignorée
    ]);
    if (error) toast.error(error.message);
    setLoading(false);
    setPlans(p || []);
    setContent(c || []);
    // module de l'application (catalogue du code), même si la base n'est pas encore migrée
    setCatalog((cat || []).map((x: any) => ({ ...x, module: x.kind === "quota" ? "quota" : moduleOf(x.key, x.module) })));
    const fm: Record<string, Set<string>> = {};
    ((pm || []) as any[]).forEach(r => (fm[r.plan_id] = fm[r.plan_id] || new Set()).add(r.module));
    setFullMods(fm);
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
    if (rows.length) {
      const { error: e2 } = await db.from("plan_permissions").insert(rows);
      if (e2) {
        toast.error(L(`Offre copiée mais contenu incomplet : ${e2.message}`, `تم نسخ العرض لكن المحتوى ناقص: ${e2.message}`, `Plan copied but content incomplete: ${e2.message}`));
        void load();
        return;
      }
    }
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
    ask({
      title: L(`Supprimer l'offre « ${p.name} » ?`, `حذف العرض « ${p.name} »؟`, `Delete plan “${p.name}”?`),
      description: L("Cette action est définitive.", "هذا الإجراء نهائي.", "This cannot be undone."),
      confirmLabel: L("Supprimer", "حذف", "Delete"),
      destructive: true,
      onConfirm: async () => {
        const { error } = await db.from("plans").delete().eq("id", p.id);
        if (error) {
          toast.error(error.message);
          return false;
        }
        toast.success(L("Offre supprimée", "تم حذف العرض", "Plan deleted"));
        void load();
      },
    });
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
              <button type="button" onClick={() => setView("cards")} className={`flex h-9 w-9 items-center justify-center rounded ${view === "cards" ? "bg-muted" : ""}`} aria-pressed={view === "cards"} aria-label={L("Vue en cartes", "عرض البطاقات", "Card view")} title={L("Vue en cartes", "عرض البطاقات", "Card view")}><LayoutGrid className="h-4 w-4" /></button>
              <button type="button" onClick={() => setView("matrix")} className={`flex h-9 w-9 items-center justify-center rounded ${view === "matrix" ? "bg-muted" : ""}`} aria-pressed={view === "matrix"} aria-label={L("Vue en tableau comparatif", "عرض جدول المقارنة", "Comparison table view")} title={L("Vue en tableau comparatif", "عرض جدول المقارنة", "Comparison table view")}><Table2 className="h-4 w-4" /></button>
            </div>
            {canEdit && (
              <Button className="gap-1.5" onClick={() => setEditing("new")}><Plus className="h-4 w-4" />{L("Nouvelle offre", "عرض جديد", "New plan")}</Button>
            )}
          </>
        }
      />

      {loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : view === "cards" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map(p => (
            <div key={p.id} className={`flex min-w-0 flex-col rounded-xl border bg-card p-4 ${p.is_active ? "" : "opacity-70"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`h-3 w-3 flex-shrink-0 rounded-full ${COLORS[p.color] || COLORS.indigo}`} />
                  <h2 className="truncate text-base font-semibold">{p.name}</h2>
                </div>
                <div className="flex flex-shrink-0 gap-1">
                  {p.is_trial_plan && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-primary  ">{L("ESSAI", "تجريبي", "TRIAL")}</span>}
                  {!p.is_active && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">{L("ARCHIVÉE", "مؤرشف", "ARCHIVED")}</span>}
                </div>
              </div>
              <p className="mt-2 text-2xl font-semibold">{fmtMoney(p.price_mad, lang)}</p>
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
                  <Button size="sm" variant="ghost" className="w-9 px-0 text-red-600" onClick={() => remove(p)} aria-label={L(`Supprimer l'offre ${p.name}`, `حذف العرض ${p.name}`, `Delete plan ${p.name}`)} title={L("Supprimer", "حذف", "Delete")}><Trash2 className="h-3.5 w-3.5" /></Button>
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
        fullModules={editing && editing !== "new" ? fullMods[editing.id] : undefined}
        onSaved={load}
      />
      {confirmDialog}
    </div>
  );
}

function ModuleRows({ module, catalog, plans, byPlan }: any) {
  const { lang } = useT();
  const items = catalog.filter((c: any) => c.module === module);
  return (
    <>
      <tr className="bg-muted/30">
        <td colSpan={plans.length + 1} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{moduleLabel(module, lang)}</td>
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
                  : row ? <span className="font-semibold text-emerald-600">✓</span> : <span className="text-muted-foreground">—</span>}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------

type ModuleMode = "none" | "partial" | "full";

function PlanEditor({ plan, onClose, catalog, content, fullModules, onSaved }: {
  plan: PlanRow | "new" | null; onClose: () => void; catalog: any[]; content: Record<string, any>; fullModules?: Set<string>; onSaved: () => void;
}) {
  const { L, lang } = useT();
  const [f, setF] = useState<any>({});
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [full, setFull] = useState<Set<string>>(new Set());
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const colorName = (c: string) => {
    const n: Record<string, [string, string, string]> = {
      slate: ["Ardoise", "رمادي", "Slate"], indigo: ["Indigo", "نيلي", "Indigo"], violet: ["Violet", "بنفسجي", "Violet"],
      emerald: ["Émeraude", "زمردي", "Emerald"], amber: ["Ambre", "كهرماني", "Amber"], rose: ["Rose", "وردي", "Rose"], sky: ["Ciel", "سماوي", "Sky"],
    };
    const x = n[c];
    return x ? L(x[0], x[1], x[2]) : c;
  };
  // offre créée lors d'un essai précédent qui a échoué en partie (évite un doublon au nouvel essai)
  const [createdId, setCreatedId] = useState("");
  const [needsReload, setNeedsReload] = useState(false);
  const close = () => {
    if (saving) return;
    if (needsReload) onSaved();
    setNeedsReload(false);
    onClose();
  };

  useEffect(() => {
    if (!plan) return;
    setSaveError("");
    setCreatedId("");
    setNeedsReload(false);
    if (plan === "new") {
      setF({ name: "", description: "", price_mad: "0", billing_period: "school_year", duration_days: "300", trial_days: "14", grace_days: "7", is_active: true, is_trial_plan: false, color: "indigo", sort_order: "10" });
      const s: Record<string, boolean> = {};
      catalog.filter(c => c.kind === "feature" && !c.is_write).forEach(c => (s[c.key] = true));
      setSel(s);
      setLimits({});
      setFull(new Set());
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
      setFull(new Set(fullModules || []));
    }
  }, [plan, catalog, content, fullModules]);

  const modules = Object.keys(MODULE_LABELS).filter(m => m !== "admin" && catalog.some(c => c.module === m));
  // Non inclus : masqué pour les profs de l'offre · Partiel : fonctions cochées · Complet : tout, y compris les futures fonctions
  const moduleMode = (m: string): ModuleMode => {
    const items = catalog.filter(c => c.module === m && c.kind === "feature");
    if (full.has(m)) return "full";
    return items.some(c => sel[c.key]) ? "partial" : "none";
  };
  const setModuleMode = (m: string, mode: ModuleMode) => {
    const items = catalog.filter(c => c.module === m && c.kind === "feature");
    const s = { ...sel };
    const fu = new Set(full);
    if (mode === "full") {
      items.forEach(c => (s[c.key] = true));
      fu.add(m);
    } else {
      fu.delete(m);
      if (mode === "none") items.forEach(c => (s[c.key] = false));
      // Partiel depuis « Non inclus » : la première fonction (en général « voir / ouvrir ») est cochée
      else if (!items.some(c => s[c.key]) && items[0]) s[items[0].key] = true;
    }
    setSel(s);
    setFull(fu);
  };
  const toggleKey = (m: string, key: string, v: boolean) => {
    setSel({ ...sel, [key]: v });
    if (!v && full.has(m)) {
      const fu = new Set(full);
      fu.delete(m);
      setFull(fu);
    }
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
    setSaveError("");
    let planId = plan !== "new" && plan ? plan.id : createdId;
    if (!planId) {
      const { data, error } = await db.from("plans").insert(row).select("id").single();
      if (error) {
        setSaving(false);
        setSaveError(error.message);
        return toast.error(error.message);
      }
      planId = data.id;
      setCreatedId(planId);
      setNeedsReload(true);
    } else {
      const { error } = await db.from("plans").update(row).eq("id", planId);
      if (error) {
        setSaving(false);
        setSaveError(error.message);
        return toast.error(error.message);
      }
      setNeedsReload(true);
    }
    const errors: string[] = [];
    // Une seule offre d'essai par défaut
    if (row.is_trial_plan) {
      const { error } = await db.from("plans").update({ is_trial_plan: false }).neq("id", planId).eq("is_trial_plan", true);
      if (error) errors.push(error.message);
    }

    // Contenu : on n'écrit que les différences (journal lisible)
    const wanted: Record<string, number | null> = {};
    catalog.forEach(c => {
      if (c.kind === "feature" && sel[c.key]) wanted[c.key] = null;
      if (c.kind === "quota") {
        const v = limits[c.key];
        wanted[c.key] = v === undefined || v === "" ? null : Number(v);
      }
    });
    // état réel en base (à jour même après un essai partiellement échoué)
    const { data: cur, error: curErr } = await db.from("plan_permissions").select("permission_key, limit_value").eq("plan_id", planId);
    if (curErr) errors.push(curErr.message);
    const existing: Record<string, any> = {};
    (curErr ? Object.values(plan === "new" ? {} : content) : cur || []).forEach((c: any) => (existing[c.permission_key] = c));
    const toDelete = Object.keys(existing).filter(k => !(k in wanted));
    const toUpsert = Object.entries(wanted)
      .filter(([k, v]) => !existing[k] || (existing[k].limit_value ?? null) !== v)
      .map(([k, v]) => ({ plan_id: planId, permission_key: k, limit_value: v }));
    if (toDelete.length) {
      const { error } = await db.from("plan_permissions").delete().eq("plan_id", planId).in("permission_key", toDelete);
      if (error) errors.push(error.message);
    }
    if (toUpsert.length) {
      const { error } = await db.from("plan_permissions").upsert(toUpsert, { onConflict: "plan_id,permission_key" });
      if (error) errors.push(error.message);
    }
    // Modules « Complet » (après les fonctions : un retrait de fonction fait passer le module en Partiel)
    if (!errors.length) {
      const { data: curMods, error: modErr } = await db.from("plan_modules").select("module").eq("plan_id", planId);
      if (!modErr) {
        const had = new Set(((curMods || []) as any[]).map(r => r.module));
        const add = [...full].filter(m => !had.has(m)).map(m => ({ plan_id: planId, module: m }));
        const del = [...had].filter(m => !full.has(m));
        if (add.length) {
          const { error } = await db.from("plan_modules").upsert(add, { onConflict: "plan_id,module" });
          if (error) errors.push(error.message);
        }
        if (del.length) {
          const { error } = await db.from("plan_modules").delete().eq("plan_id", planId).in("module", del);
          if (error) errors.push(error.message);
        }
      } else if (full.size) {
        errors.push(L("« Complet » nécessite la migration 20261104090000_plan_modules.sql", "« كامل » يتطلب ترحيل 20261104090000_plan_modules.sql", "“Full” requires migration 20261104090000_plan_modules.sql"));
      }
    }
    setSaving(false);
    if (errors.length) {
      // la fenêtre reste ouverte (saisie conservée) pour corriger / réessayer
      const msg = L("Enregistrement incomplet : ", "حفظ غير مكتمل: ", "Incomplete save: ") + errors.join(" · ");
      setSaveError(msg);
      toast.error(msg);
      return;
    }
    toast.success(L("Offre enregistrée", "تم حفظ العرض", "Plan saved"));
    setNeedsReload(false);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={!!plan} onOpenChange={v => !v && close()}>
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
              <Label htmlFor="plan-f-1">{L("Nom", "الاسم", "Name")} *</Label>
              <Input id="plan-f-1" required value={f.name || ""} onChange={e => setF({ ...f, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-f-2">{L("Prix (MAD)", "الثمن (درهم)", "Price (MAD)")}</Label>
              <Input id="plan-f-2" type="number" min="0" step="0.01" value={f.price_mad || ""} onChange={e => setF({ ...f, price_mad: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="plan-f-3">{L("Description", "الوصف", "Description")}</Label>
              <Textarea id="plan-f-3" rows={2} value={f.description || ""} onChange={e => setF({ ...f, description: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-f-4">{L("Périodicité", "الدورية", "Billing period")}</Label>
              <select id="plan-f-4" className={selectCls} value={f.billing_period} onChange={e => {
                const p = PERIODS.find(x => x.id === e.target.value);
                setF({ ...f, billing_period: e.target.value, duration_days: p?.days ? String(p.days) : e.target.value === "unlimited" ? "" : f.duration_days });
              }}>
                {PERIODS.map(p => <option key={p.id} value={p.id}>{L(p.fr, p.ar, p.en)}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-f-5">{L("Durée (jours, vide = sans fin)", "المدة (أيام، فارغ = بدون نهاية)", "Duration (days, empty = none)")}</Label>
              <Input id="plan-f-5" type="number" min="1" value={f.duration_days ?? ""} onChange={e => setF({ ...f, duration_days: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-f-6">{L("Délai de grâce (jours)", "مهلة السماح (أيام)", "Grace period (days)")}</Label>
              <Input id="plan-f-6" type="number" min="0" value={f.grace_days ?? ""} onChange={e => setF({ ...f, grace_days: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-f-7">{L("Durée en essai (jours)", "مدة التجربة (أيام)", "Trial length (days)")}</Label>
              <Input id="plan-f-7" type="number" min="0" value={f.trial_days ?? ""} onChange={e => setF({ ...f, trial_days: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label id="plan-color-label">{L("Couleur", "اللون", "Color")}</Label>
              <div className="flex flex-wrap gap-1.5 pt-1" role="group" aria-labelledby="plan-color-label">
                {Object.entries(COLORS).map(([c, cls]) => (
                  <button key={c} type="button" onClick={() => setF({ ...f, color: c })} aria-label={colorName(c)} title={colorName(c)} aria-pressed={f.color === c}
                    className={`h-9 w-9 rounded-full ${cls} ${f.color === c ? "ring-2 ring-offset-2 ring-foreground" : ""}`} />
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-f-8">{L("Ordre d'affichage", "ترتيب العرض", "Display order")}</Label>
              <Input id="plan-f-8" type="number" value={f.sort_order ?? ""} onChange={e => setF({ ...f, sort_order: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 text-sm">
            <label className="flex min-h-[40px] cursor-pointer items-center gap-3"><input type="checkbox" className="h-5 w-5 flex-shrink-0" checked={!!f.is_active} onChange={e => setF({ ...f, is_active: e.target.checked })} />{L("Proposée (non archivée)", "معروض (غير مؤرشف)", "Offered (not archived)")}</label>
            <label className="flex min-h-[40px] cursor-pointer items-center gap-3"><input type="checkbox" className="h-5 w-5 flex-shrink-0" checked={!!f.is_trial_plan} onChange={e => setF({ ...f, is_trial_plan: e.target.checked })} />{L("Offre d'essai par défaut pour les nouveaux comptes", "عرض تجريبي افتراضي للحسابات الجديدة", "Default trial plan for new accounts")}</label>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">{L("Modules et fonctions", "الوحدات والوظائف", "Modules and features")}</h3>
            <p className="text-xs text-muted-foreground">
              {L(
                "Non inclus : le module est masqué pour les professeurs de cette offre. Partiel : seules les fonctions cochées. Complet : toutes les fonctions, y compris celles ajoutées plus tard.",
                "غير مدرج: الوحدة مخفية عن أساتذة هذا العرض. جزئي: الوظائف المحددة فقط. كامل: كل الوظائف بما فيها التي ستضاف لاحقا.",
                "Not included: the module is hidden for this plan's teachers. Partial: only the ticked features. Full: every feature, including those added later."
              )}
            </p>
            {modules.filter(m => m !== "quota").map(m => {
              const items = catalog.filter(c => c.module === m && c.kind === "feature");
              const alwaysOn = m === "account"; // toujours visible : seulement des fonctions à cocher
              const mode: ModuleMode = alwaysOn ? "partial" : moduleMode(m);
              const modes: { id: ModuleMode; label: string }[] = [
                { id: "none", label: L("Non inclus", "غير مدرج", "Not included") },
                { id: "partial", label: L("Partiel", "جزئي", "Partial") },
                { id: "full", label: L("Complet", "كامل", "Full") },
              ];
              return (
                <div key={m} className={`rounded-lg border ${mode === "none" ? "opacity-70" : ""}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide">{moduleLabel(m, lang)}</span>
                    {!alwaysOn && (
                    <div role="radiogroup" aria-label={moduleLabel(m, lang)} className="inline-flex rounded-md border bg-background p-0.5">
                      {modes.map(o => (
                        <button
                          key={o.id}
                          type="button"
                          role="radio"
                          aria-checked={mode === o.id}
                          onClick={() => setModuleMode(m, o.id)}
                          className={`min-h-[32px] rounded px-2.5 text-xs font-semibold ${mode === o.id ? (o.id === "none" ? "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white" : "bg-primary text-primary-foreground") : "text-muted-foreground hover:bg-muted"}`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                    )}
                  </div>
                  {mode !== "none" && (
                  <div className="grid gap-x-4 px-3 py-1.5 sm:grid-cols-2">
                    {items.map(c => (
                      <label key={c.key} className="flex min-h-[40px] cursor-pointer items-center gap-3 text-sm">
                        <input type="checkbox" className="h-5 w-5 flex-shrink-0" checked={!!sel[c.key]} onChange={e => toggleKey(m, c.key, e.target.checked)} />
                        <span>{permLabel(c.key, lang)}{!c.is_write && <span className="text-[11px] text-muted-foreground"> · {L("lecture", "قراءة", "read")}</span>}</span>
                      </label>
                    ))}
                  </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">{L("Quotas (vide = illimité, 0 = aucun)", "الحصص (فارغ = غير محدود، 0 = لا شيء)", "Quotas (empty = unlimited, 0 = none)")}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {catalog.filter(c => c.kind === "quota").map(c => (
                <div key={c.key} className="space-y-1">
                  <Label htmlFor={`plan-quota-${c.key}`} className="text-xs">{permLabel(c.key, lang)}</Label>
                  <Input id={`plan-quota-${c.key}`} type="number" min="0" placeholder="∞" value={limits[c.key] ?? ""} onChange={e => setLimits({ ...limits, [c.key]: e.target.value })} />
                </div>
              ))}
            </div>
          </div>

          {saveError && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{saveError}</p>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={close} disabled={saving}>{L("Annuler", "إلغاء", "Cancel")}</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? L("Enregistrement…", "جار الحفظ…", "Saving…") : saveError ? L("Réessayer", "إعادة المحاولة", "Retry") : L("Enregistrer", "حفظ", "Save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

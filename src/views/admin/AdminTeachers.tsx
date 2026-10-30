import { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router";
import { Plus, Search, Copy, Check, UserPlus, Eye, Pencil, Ban, PlayCircle, Trash2, Download, Loader2 } from "lucide-react";
import { downloadBlob } from "@/lib/download";
import { whatsappLink } from "./AdminTeacherExtras";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAccess } from "@/contexts/AccessContext";
import {
  adminInvoke, copyWithToast, db, endDateInput, fmtDate, fromDateInput, localDateStr, PageTitle, PAYMENT_METHODS, StatusBadge, useT,
} from "./adminShared";
import { DeleteTeacherDialog, EditTeacherDialog, setTeacherSuspension, suspensionConfirm } from "./TeacherDialogs";
import { useConfirm } from "./ConfirmDialog";

export interface PlanRow {
  id: string;
  name: string;
  price_mad: number;
  duration_days: number | null;
  trial_days: number;
  grace_days: number;
  is_active: boolean;
  is_trial_plan: boolean;
  billing_period: string;
  color: string;
  sort_order: number;
  description: string | null;
  is_public?: boolean;
  compare_at_mad?: number | null;
}

const selectCls = "h-10 w-full rounded-md border bg-background px-3 text-sm";

export default function AdminTeachers() {
  const { L, lang } = useT();
  const { adminCan } = useAccess();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [plan, setPlan] = useState("all");
  const [sort, setSort] = useState("name");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [bulkBusy, setBulkBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const canManage = adminCan("admin.teachers.manage");
  const { ask, dialog: confirmDialog } = useConfirm();

  const load = async () => {
    setLoading(true);
    const { data, error } = await db.rpc("admin_teachers");
    if (error) toast.error(error.message);
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, []);

  const plans = useMemo(() => Array.from(new Set(rows.map(r => r.plan_name).filter(Boolean))) as string[], [rows]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const month = Date.now() - 30 * 86400000;
    const list = rows.filter(r => {
      if (status === "inactive") {
        if (r.last_sign_in_at && new Date(r.last_sign_in_at).getTime() > month) return false;
      } else if (status !== "all" && (r.sub_status || "none") !== status) return false;
      if (plan !== "all" && r.plan_name !== plan) return false;
      if (!s) return true;
      return [r.name, r.email, r.school, r.city, r.phone].some(v => (v || "").toLowerCase().includes(s));
    });
    const time = (v: string | null) => (v ? new Date(v).getTime() : 0);
    const by: Record<string, (a: any, b: any) => number> = {
      name: (a, b) => String(a.name || "").localeCompare(String(b.name || "")),
      created: (a, b) => time(b.created_at) - time(a.created_at),
      ends: (a, b) => (time(a.ends_at) || Infinity) - (time(b.ends_at) || Infinity),
      login: (a, b) => time(b.last_sign_in_at) - time(a.last_sign_in_at),
      students: (a, b) => (b.students_count || 0) - (a.students_count || 0),
    };
    return [...list].sort(by[sort] || by.name);
  }, [rows, q, status, plan, sort]);

  const selected = filtered.filter(r => checked[r.user_id]);

  const exportCsv = (list: any[]) => {
    const head = [L("Nom", "الاسم", "Name"), "E-mail", L("Téléphone", "الهاتف", "Phone"), L("École", "المؤسسة", "School"), L("Ville", "المدينة", "City"),
      L("Offre", "العرض", "Plan"), L("Statut", "الحالة", "Status"), L("Fin", "النهاية", "Ends"), L("Classes", "الأقسام", "Classes"), L("Élèves", "التلاميذ", "Students"),
      L("Créé le", "أنشئ في", "Created"), L("Dernière connexion", "آخر دخول", "Last login")];
    const lines = list.map(r => [r.name, r.email, r.phone || "", r.school || "", r.city || "", r.plan_name || "", r.account_status === "suspended" ? "suspended" : r.sub_status || "none",
      r.ends_at ? String(r.ends_at).slice(0, 10) : "", r.classes_count, r.students_count, String(r.created_at || "").slice(0, 10), String(r.last_sign_in_at || "").slice(0, 10)]);
    const csv = "\uFEFF" + [head, ...lines].map(l => l.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${L("professeurs", "الأساتذة", "teachers")}_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const bulkSuspend = (suspend: boolean) => ask({
    title: suspend
      ? L(`Suspendre ${selected.length} compte(s) ?`, `توقيف ${selected.length} حساب؟`, `Suspend ${selected.length} account(s)?`)
      : L(`Réactiver ${selected.length} compte(s) ?`, `إعادة تفعيل ${selected.length} حساب؟`, `Reactivate ${selected.length} account(s)?`),
    destructive: suspend,
    input: suspend ? { label: L("Motif (facultatif)", "السبب (اختياري)", "Reason (optional)") } : undefined,
    confirmLabel: suspend ? L("Suspendre", "توقيف", "Suspend") : L("Réactiver", "إعادة التفعيل", "Reactivate"),
    onConfirm: async (reason: string) => {
      setBulkBusy(true);
      for (const r of selected) await setTeacherSuspension(r, suspend, reason, L);
      setBulkBusy(false);
      setChecked({});
      void load();
    },
  });

  // Actions d'une ligne : voir, modifier, suspendre / réactiver, supprimer
  const RowActions = ({ r, labels }: { r: any; labels?: boolean }) => {
    const suspended = r.account_status === "suspended";
    const btn = `inline-flex h-9 items-center justify-center gap-1 rounded-md border bg-background text-xs font-medium hover:bg-muted ${labels ? "px-2.5" : "w-9"}`;
    const lView = L("Voir la fiche", "عرض البطاقة", "View");
    const lEdit = L("Modifier", "تعديل", "Edit");
    const lToggle = suspended ? L("Réactiver", "إعادة التفعيل", "Reactivate") : L("Suspendre", "توقيف", "Suspend");
    const lDel = L("Supprimer", "حذف", "Delete");
    const who = r.name ? ` : ${r.name}` : "";
    return (
      <div className={`flex items-center gap-1.5 ${labels ? "flex-wrap" : "justify-end"}`}>
        <Link to={`/admin/teachers/${r.user_id}`} className={btn} title={lView} aria-label={labels ? undefined : lView + who}>
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />{labels && L("Voir", "عرض", "View")}
        </Link>
        {canManage && (
          <>
            <button type="button" className={btn} onClick={() => setEditing(r)} title={lEdit} aria-label={labels ? undefined : lEdit + who}>
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />{labels && lEdit}
            </button>
            <button
              type="button"
              className={`${btn} ${suspended ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}
              onClick={() => ask(suspensionConfirm(r, L, () => void load()))}
              title={lToggle}
              aria-label={labels ? undefined : lToggle + who}
            >
              {suspended ? <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" /> : <Ban className="h-3.5 w-3.5" aria-hidden="true" />}
              {labels && lToggle}
            </button>
            <button type="button" className={`${btn} text-red-600`} onClick={() => setDeleting(r)} title={lDel} aria-label={labels ? undefined : lDel + who}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />{labels && lDel}
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div>
      <PageTitle
        title={L("Professeurs", "الأساتذة", "Teachers")}
        subtitle={L(`${rows.length} compte(s)`, `${rows.length} حساب`, `${rows.length} account(s)`)}
        actions={
          <>
            <Button variant="outline" className="gap-1.5" onClick={() => exportCsv(filtered)} disabled={!filtered.length}><Download className="h-4 w-4" />CSV</Button>
            {adminCan("admin.teachers.manage") && (
              <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
                <Plus className="h-4 w-4" />
                {L("Nouveau professeur", "أستاذ جديد", "New teacher")}
              </Button>
            )}
          </>
        }
      />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ltr:left-3 rtl:right-3" />
          <Input value={q} onChange={e => setQ(e.target.value)} aria-label={L("Rechercher", "بحث", "Search")} placeholder={L("Nom, e-mail, école, ville…", "الاسم، البريد، المؤسسة، المدينة…", "Name, email, school, city…")} className="ltr:pl-9 rtl:pr-9" />
        </div>
        <select aria-label={L("Statut", "الحالة", "Status")} value={status} onChange={e => setStatus(e.target.value)} className={`${selectCls} sm:w-44`}>
          <option value="all">{L("Tous les statuts", "كل الحالات", "All statuses")}</option>
          <option value="active">{L("Actif", "نشط", "Active")}</option>
          <option value="trial">{L("Essai", "تجريبي", "Trial")}</option>
          <option value="grace">{L("Grâce", "مهلة", "Grace")}</option>
          <option value="expired">{L("Expiré", "منتهي", "Expired")}</option>
          <option value="suspended">{L("Suspendu", "موقوف", "Suspended")}</option>
          <option value="none">{L("Sans abonnement", "بدون اشتراك", "No subscription")}</option>
          <option value="inactive">{L("Inactifs depuis 30 j", "غير نشطين منذ 30 يوما", "Inactive for 30 d")}</option>
        </select>
        <select aria-label={L("Trier", "ترتيب", "Sort")} value={sort} onChange={e => setSort(e.target.value)} className={`${selectCls} sm:w-44`}>
          <option value="name">{L("Tri : nom", "ترتيب: الاسم", "Sort: name")}</option>
          <option value="created">{L("Tri : plus récents", "ترتيب: الأحدث", "Sort: newest")}</option>
          <option value="ends">{L("Tri : fin la plus proche", "ترتيب: أقرب نهاية", "Sort: ending soonest")}</option>
          <option value="login">{L("Tri : dernière connexion", "ترتيب: آخر دخول", "Sort: last login")}</option>
          <option value="students">{L("Tri : nombre d'élèves", "ترتيب: عدد التلاميذ", "Sort: students")}</option>
        </select>
        <select aria-label={L("Offre", "العرض", "Plan")} value={plan} onChange={e => setPlan(e.target.value)} className={`${selectCls} sm:w-44`}>
          <option value="all">{L("Toutes les offres", "كل العروض", "All plans")}</option>
          {plans.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {canManage && selected.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-accent p-2.5">
          <span className="text-sm font-semibold">{selected.length} {L("sélectionné(s)", "محدد", "selected")}</span>
          <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => exportCsv(selected)} className="gap-1.5"><Download className="h-3.5 w-3.5" />CSV</Button>
          <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulkSuspend(true)} className="gap-1.5 text-amber-700">
            {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}{L("Suspendre", "توقيف", "Suspend")}
          </Button>
          <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulkSuspend(false)} className="gap-1.5 text-emerald-700"><PlayCircle className="h-3.5 w-3.5" />{L("Réactiver", "إعادة التفعيل", "Reactivate")}</Button>
          <Button size="sm" variant="ghost" onClick={() => setChecked({})}>{L("Désélectionner", "إلغاء التحديد", "Clear")}</Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card">
        {loading ? (
          <div className="h-32 animate-pulse bg-muted/40" />
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <UserPlus className="mx-auto mb-2 h-8 w-8 opacity-50" />
            {L("Aucun professeur.", "لا يوجد أي أستاذ.", "No teacher.")}
          </div>
        ) : (
          <>
            {/* Tableau (ordinateur / tablette) */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    {canManage && (
                      <th className="w-10 px-3 py-2.5">
                        <input type="checkbox" className="h-4 w-4" aria-label={L("Tout sélectionner", "تحديد الكل", "Select all")}
                          checked={filtered.length > 0 && selected.length === filtered.length}
                          onChange={e => { const m: Record<string, boolean> = {}; if (e.target.checked) filtered.forEach(r => (m[r.user_id] = true)); setChecked(m); }} />
                      </th>
                    )}
                    <th className="px-4 py-2.5 text-start font-semibold">{L("Professeur", "الأستاذ", "Teacher")}</th>
                    <th className="px-4 py-2.5 text-start font-semibold">{L("École / ville", "المؤسسة / المدينة", "School / city")}</th>
                    <th className="px-4 py-2.5 text-start font-semibold">{L("Offre", "العرض", "Plan")}</th>
                    <th className="px-4 py-2.5 text-start font-semibold">{L("Statut", "الحالة", "Status")}</th>
                    <th className="px-4 py-2.5 text-start font-semibold">{L("Fin", "النهاية", "Ends")}</th>
                    <th className="px-4 py-2.5 text-start font-semibold">{L("Connexion", "الدخول", "Login")}</th>
                    <th className="px-4 py-2.5 text-end font-semibold">{L("Classes / élèves", "الأقسام / التلاميذ", "Classes / students")}</th>
                    <th className="px-4 py-2.5 text-end font-semibold">{L("Actions", "إجراءات", "Actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map(r => (
                    <tr key={r.user_id} className="hover:bg-muted/40">
                      {canManage && (
                        <td className="px-3 py-2.5">
                          <input type="checkbox" className="h-4 w-4" aria-label={L(`Sélectionner ${r.name}`, `تحديد ${r.name}`, `Select ${r.name}`)}
                            checked={!!checked[r.user_id]} onChange={e => setChecked({ ...checked, [r.user_id]: e.target.checked })} />
                        </td>
                      )}
                      <td className="px-4 py-2.5">
                        <Link to={`/admin/teachers/${r.user_id}`} className="block">
                          <span className="font-semibold text-foreground hover:text-primary">{r.name}</span>
                          <span className="block text-xs text-muted-foreground">{r.email}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{[r.school, r.city].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="px-4 py-2.5">{r.plan_name || "—"}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={r.account_status === "suspended" ? "suspended" : r.sub_status} /></td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.ends_at ? fmtDate(r.ends_at, lang) : L("Sans fin", "بدون نهاية", "No end")}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.last_sign_in_at ? fmtDate(r.last_sign_in_at, lang) : L("jamais", "أبدا", "never")}</td>
                      <td className="px-4 py-2.5 text-end tabular-nums">{r.classes_count} / {r.students_count}</td>
                      <td className="px-4 py-2.5"><RowActions r={r} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Cartes (téléphone) */}
            <ul className="divide-y md:hidden">
              {filtered.map(r => (
                <li key={r.user_id}>
                  <Link to={`/admin/teachers/${r.user_id}`} className="block px-4 py-3 active:bg-muted/50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{r.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.email}</p>
                      </div>
                      <StatusBadge status={r.account_status === "suspended" ? "suspended" : r.sub_status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.plan_name || "—"} · {r.ends_at ? fmtDate(r.ends_at, lang) : L("Sans fin", "بدون نهاية", "No end")} · {r.classes_count} {L("classes", "أقسام", "classes")} · {r.students_count} {L("élèves", "تلاميذ", "students")}
                    </p>
                  </Link>
                  <div className="px-3 pb-2.5"><RowActions r={r} labels /></div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <CreateTeacherDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
      {editing && <EditTeacherDialog open={!!editing} onOpenChange={(v: boolean) => !v && setEditing(null)} teacher={editing} onSaved={load} />}
      <DeleteTeacherDialog teacher={deleting} onClose={() => setDeleting(null)} onDeleted={load} />
      {confirmDialog}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function CreateTeacherDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const { L } = useT();
  const { adminCan } = useAccess();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ email: string; password: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const empty = {
    name: "", email: "", phone: "", school: "", city: "", subject: "Mathématiques", password: "",
    plan_id: "", kind: "trial", starts: localDateStr(new Date()), ends: "", price: "",
    payment_amount: "", payment_method: "transfer", payment_reference: "",
  };
  const [f, setF] = useState(empty);
  const set = (k: keyof typeof empty, v: string) => setF(prev => ({ ...prev, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setF(empty);
    setResult(null);
    setCopied(false);
    db.from("plans").select("*").eq("is_active", true).order("sort_order").then(({ data }: any) => {
      const list = (data || []) as PlanRow[];
      setPlans(list);
      const trial = list.find(p => p.is_trial_plan) || list[0];
      if (trial) setF(prev => ({ ...prev, plan_id: trial.id, kind: trial.is_trial_plan ? "trial" : "paid" }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selected = plans.find(p => p.id === f.plan_id);
  // date de fin proposée automatiquement d'après l'offre
  useEffect(() => {
    if (!selected) return;
    const days = f.kind === "trial" ? selected.trial_days || selected.duration_days : selected.duration_days;
    setF(prev => ({
      ...prev,
      ends: days ? endDateInput(f.starts, days) : "",
      price: prev.price || (f.kind === "paid" ? String(selected.price_mad || "") : ""),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.plan_id, f.kind, f.starts]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data, error } = await adminInvoke("create_teacher", {
      name: f.name, email: f.email, phone: f.phone, school: f.school, city: f.city, subject: f.subject,
      password: f.password || undefined,
      plan_id: f.plan_id || undefined, kind: f.kind,
      starts_at: fromDateInput(f.starts), ends_at: f.ends ? fromDateInput(f.ends, true) : null,
      price_mad: f.kind === "paid" && f.price ? Number(f.price) : 0,
      payment_amount: f.payment_amount ? Number(f.payment_amount) : 0,
      payment_method: f.payment_method, payment_reference: f.payment_reference,
    });
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    setResult({ email: data.email, password: data.password, name: f.name });
    onCreated();
  };

  const credentials = result
    ? `${L("Adresse", "العنوان", "Address")} : ${window.location.origin}/login\n${L("E-mail", "البريد", "Email")} : ${result.email}\n${L("Mot de passe provisoire", "كلمة المرور المؤقتة", "Temporary password")} : ${result.password}`
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{result ? L("Compte créé", "تم إنشاء الحساب", "Account created") : L("Nouveau professeur", "أستاذ جديد", "New teacher")}</DialogTitle>
          <DialogDescription>
            {result
              ? L("Transmettez ces identifiants au professeur. Il devra choisir son propre mot de passe à la première connexion.",
                  "أرسل هذه المعلومات إلى الأستاذ. سيختار كلمة مرور خاصة به عند أول دخول.",
                  "Send these credentials to the teacher. They will choose their own password at first login.")
              : L("Le compte est créé directement, sans e-mail de confirmation.", "يُنشأ الحساب مباشرة دون رسالة تأكيد.", "The account is created directly, without a confirmation email.")}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <pre className="whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 text-sm" dir="ltr">{credentials}</pre>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-1.5"
                onClick={async () => {
                  if (await copyWithToast(credentials, L)) setCopied(true);
                }}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {L("Copier", "نسخ", "Copy")}
              </Button>
              {whatsappLink(f.phone, credentials) && (
                <Button asChild type="button" variant="outline" className="gap-1.5 text-emerald-700">
                  <a href={whatsappLink(f.phone, credentials) || "#"} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                </Button>
              )}
              <Button asChild type="button" variant="outline">
                <a href={`mailto:${result.email}?subject=${encodeURIComponent(L("Votre compte", "حسابك", "Your account"))}&body=${encodeURIComponent(credentials)}`}>E-mail</a>
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>{L("Terminer", "إنهاء", "Done")}</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="new-teacher-1">{L("Nom complet", "الاسم الكامل", "Full name")} *</Label>
                <Input id="new-teacher-1" required value={f.name} onChange={e => set("name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-teacher-2">{L("E-mail (identifiant)", "البريد الإلكتروني (المعرف)", "Email (login)")} *</Label>
                <Input id="new-teacher-2" required type="email" dir="ltr" value={f.email} onChange={e => set("email", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-teacher-3">{L("Mot de passe provisoire", "كلمة مرور مؤقتة", "Temporary password")}</Label>
                <Input id="new-teacher-3" dir="ltr" value={f.password} onChange={e => set("password", e.target.value)} placeholder={L("Vide = généré automatiquement", "فارغ = يُنشأ تلقائيا", "Empty = generated")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-teacher-4">{L("Téléphone", "الهاتف", "Phone")}</Label>
                <Input id="new-teacher-4" dir="ltr" value={f.phone} onChange={e => set("phone", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-teacher-5">{L("Matière", "المادة", "Subject")}</Label>
                <Input id="new-teacher-5" value={f.subject} onChange={e => set("subject", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-teacher-6">{L("Établissement", "المؤسسة", "School")}</Label>
                <Input id="new-teacher-6" value={f.school} onChange={e => set("school", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-teacher-7">{L("Ville", "المدينة", "City")}</Label>
                <Input id="new-teacher-7" value={f.city} onChange={e => set("city", e.target.value)} />
              </div>
            </fieldset>

            {adminCan("admin.subscriptions.manage") && (
              <fieldset className="space-y-3 rounded-xl border p-3">
                <legend className="px-1 text-sm font-semibold">{L("Abonnement", "الاشتراك", "Subscription")}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-teacher-8">{L("Offre", "العرض", "Plan")}</Label>
                    <select id="new-teacher-8" className={selectCls} value={f.plan_id} onChange={e => set("plan_id", e.target.value)}>
                      <option value="">{L("Aucune (plus tard)", "لا شيء (لاحقا)", "None (later)")}</option>
                      {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-teacher-9">{L("Type", "النوع", "Type")}</Label>
                    <select id="new-teacher-9" className={selectCls} value={f.kind} onChange={e => set("kind", e.target.value)} disabled={!f.plan_id}>
                      <option value="trial">{L("Essai", "تجريبي", "Trial")}</option>
                      <option value="paid">{L("Payant", "مؤدى عنه", "Paid")}</option>
                      <option value="free">{L("Offert", "مجاني", "Free")}</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-teacher-10">{L("Début", "البداية", "Start")}</Label>
                    <Input id="new-teacher-10" type="date" value={f.starts} onChange={e => set("starts", e.target.value)} disabled={!f.plan_id} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-teacher-11">{L("Fin (vide = sans fin)", "النهاية (فارغ = بدون نهاية)", "End (empty = none)")}</Label>
                    <Input id="new-teacher-11" type="date" value={f.ends} onChange={e => set("ends", e.target.value)} disabled={!f.plan_id} />
                  </div>
                  {f.kind === "paid" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="new-teacher-12">{L("Prix convenu (MAD)", "الثمن المتفق عليه (درهم)", "Agreed price (MAD)")}</Label>
                      <Input id="new-teacher-12" type="number" min="0" step="0.01" value={f.price} onChange={e => set("price", e.target.value)} />
                    </div>
                  )}
                </div>
                {f.kind === "paid" && adminCan("admin.payments.manage") && (
                  <div className="grid gap-3 border-t pt-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="new-teacher-13">{L("Montant déjà payé", "المبلغ المؤدى", "Amount paid")}</Label>
                      <Input id="new-teacher-13" type="number" min="0" step="0.01" value={f.payment_amount} onChange={e => set("payment_amount", e.target.value)} placeholder="0" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-teacher-14">{L("Moyen", "الوسيلة", "Method")}</Label>
                      <select id="new-teacher-14" className={selectCls} value={f.payment_method} onChange={e => set("payment_method", e.target.value)}>
                        {PAYMENT_METHODS.map(m => <option key={m.id} value={m.id}>{L(m.fr, m.ar, m.en)}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-teacher-15">{L("Référence", "المرجع", "Reference")}</Label>
                      <Input id="new-teacher-15" value={f.payment_reference} onChange={e => set("payment_reference", e.target.value)} />
                    </div>
                  </div>
                )}
              </fieldset>
            )}

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{L("Annuler", "إلغاء", "Cancel")}</Button>
              <Button type="submit" disabled={saving}>{saving ? L("Création…", "جارٍ الإنشاء…", "Creating…") : L("Créer le compte", "إنشاء الحساب", "Create account")}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

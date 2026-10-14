import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, KeyRound, Ban, PlayCircle, Pencil, CalendarPlus, RefreshCw, Repeat, XCircle, Plus, Printer, Copy, Check, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAccess } from "@/contexts/AccessContext";
import { MODULE_LABELS } from "@/lib/permissions";
import {
  addDaysIso, adminInvoke, copyWithToast, db, endDateInput, fmtDate, fmtMoney, fromDateInput, localDateStr, moduleLabel,
  PAYMENT_METHODS, permLabel, StatusBadge, toDateInput, useT, type Lang,
} from "./adminShared";
import type { PlanRow } from "./AdminTeachers";
import { AuditList } from "./AdminAudit";
import { DeleteTeacherDialog, EditTeacherDialog, suspensionConfirm } from "./TeacherDialogs";
import { useConfirm } from "./ConfirmDialog";

const selectCls = "h-10 w-full rounded-md border bg-background px-3 text-sm";
type Tab = "subscription" | "payments" | "permissions" | "journal";

export default function AdminTeacherDetail() {
  const { id = "" } = useParams();
  const { L, lang } = useT();
  const { adminCan } = useAccess();
  const [teacher, setTeacher] = useState<any>(null);
  const [account, setAccount] = useState<any>(null);
  const [subs, setSubs] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [tab, setTab] = useState<Tab>("subscription");
  const [editOpen, setEditOpen] = useState(false);
  const [subDialog, setSubDialog] = useState<null | "assign" | "renew">(null);
  const [payOpen, setPayOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [loadError, setLoadError] = useState("");
  const navigate = useNavigate();
  const { ask, dialog: confirmDialog } = useConfirm();

  const load = async () => {
    const [{ data: list, error: listError }, { data: acc }, { data: s }, { data: p }, { data: pl }] = await Promise.all([
      db.rpc("admin_teachers"),
      db.from("teacher_accounts").select("*").eq("user_id", id).maybeSingle(),
      db.from("subscriptions").select("*, plans(name)").eq("teacher_id", id).order("starts_at", { ascending: false }),
      db.from("payments").select("*").eq("teacher_id", id).order("paid_at", { ascending: false }),
      db.from("plans").select("*").order("sort_order"),
    ]);
    if (listError) {
      setLoadError(listError.message);
      return;
    }
    const found = (list || []).find((t: any) => t.user_id === id) || null;
    setLoadError(found ? "" : L("Professeur introuvable.", "الأستاذ غير موجود.", "Teacher not found."));
    setTeacher(found);
    setAccount(acc);
    setSubs(s || []);
    setPayments(p || []);
    setPlans(pl || []);
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loadError && !teacher) {
    return (
      <div>
        <Link to="/admin/teachers" className="mb-3 inline-flex min-h-[36px] items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {L("Professeurs", "الأساتذة", "Teachers")}
        </Link>
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {L("Impossible de charger la fiche : ", "تعذر تحميل البطاقة: ", "Could not load the record: ")}{loadError}
        </p>
      </div>
    );
  }
  if (!teacher) return <div className="h-40 animate-pulse rounded-xl bg-muted" />;

  // même règle que subscription_status() : commencé, non arrêté, la fin la plus lointaine
  const current = subs
    .filter(s => !s.canceled_at && new Date(s.starts_at) <= new Date())
    .sort((a, b) => (a.ends_at === null ? -1 : b.ends_at === null ? 1 : new Date(b.ends_at).getTime() - new Date(a.ends_at).getTime()))[0] || null;
  const suspended = teacher.account_status === "suspended";

  const resetPassword = () => ask({
    title: L("Générer un nouveau mot de passe provisoire ?", "إنشاء كلمة مرور مؤقتة جديدة؟", "Generate a new temporary password?"),
    description: L("L'ancien mot de passe ne fonctionnera plus.", "لن تعمل كلمة المرور القديمة بعد الآن.", "The old password will stop working."),
    confirmLabel: L("Générer", "إنشاء", "Generate"),
    onConfirm: async () => {
      const { data, error } = await adminInvoke("reset_password", { user_id: id });
      if (error) {
        toast.error(error);
        return false;
      }
      setSecret(data.password);
    },
  });
  const toggleSuspend = () => ask(suspensionConfirm(teacher, L, () => void load()));
  const cancelCurrent = () => {
    if (!current) return;
    ask({
      title: L("Arrêter l'abonnement en cours ?", "إيقاف الاشتراك الحالي؟", "Stop the current subscription?"),
      description: L("Il s'arrête dès maintenant. Le compte passera en lecture seule.", "يتوقف الآن. سيصبح الحساب للقراءة فقط.", "It stops now. The account becomes read-only."),
      confirmLabel: L("Arrêter", "إيقاف", "Stop"),
      destructive: true,
      onConfirm: async () => {
        const { error } = await db.from("subscriptions").update({ canceled_at: new Date().toISOString() }).eq("id", current.id);
        if (error) {
          toast.error(error.message);
          return false;
        }
        toast.success(L("Abonnement arrêté", "تم إيقاف الاشتراك", "Subscription stopped"));
        void load();
      },
    });
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "subscription", label: L("Abonnement", "الاشتراك", "Subscription") },
    { id: "payments", label: L("Paiements", "الأداءات", "Payments") },
    { id: "permissions", label: L("Habilitations & quotas", "الصلاحيات والحصص", "Permissions & quotas") },
    { id: "journal", label: L("Journal", "السجل", "Log") },
  ];

  return (
    <div>
      <Link to="/admin/teachers" className="mb-3 inline-flex min-h-[36px] items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {L("Professeurs", "الأساتذة", "Teachers")}
      </Link>

      {/* En-tête */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-bold">{teacher.name}</h1>
              <StatusBadge status={suspended ? "suspended" : teacher.sub_status} />
            </div>
            <p className="text-sm text-muted-foreground" dir="ltr">{teacher.email}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {[teacher.subject, teacher.school, teacher.city, teacher.phone].filter(Boolean).join(" · ") || "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {L("Créé le", "أنشئ في", "Created")} {fmtDate(teacher.created_at, lang)} · {L("Dernière connexion", "آخر دخول", "Last login")} {fmtDate(teacher.last_sign_in_at, lang)}
            </p>
            {suspended && account?.suspended_reason && (
              <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{L("Motif", "السبب", "Reason")} : {account.suspended_reason}</p>
            )}
          </div>
          {adminCan("admin.teachers.manage") && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5" />{L("Modifier", "تعديل", "Edit")}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={resetPassword}>
                <KeyRound className="h-3.5 w-3.5" />{L("Mot de passe", "كلمة المرور", "Password")}
              </Button>
              <Button variant={suspended ? "default" : "outline"} size="sm" className={`gap-1.5 ${suspended ? "" : "text-red-600"}`} onClick={toggleSuspend}>
                {suspended ? <PlayCircle className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                {suspended ? L("Réactiver", "إعادة التفعيل", "Reactivate") : L("Suspendre", "توقيف", "Suspend")}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-red-600" onClick={() => setDeleting(teacher)}>
                <Trash2 className="h-3.5 w-3.5" />{L("Supprimer", "حذف", "Delete")}
              </Button>
            </div>
          )}
        </div>
        {account?.notes && <p className="mt-3 rounded-lg bg-muted/50 p-2 text-xs">{account.notes}</p>}
      </div>

      {/* Onglets */}
      <div className="mt-4 flex gap-1 overflow-x-auto border-b" style={{ WebkitOverflowScrolling: "touch" } as any}>
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px min-h-[40px] flex-shrink-0 border-b-2 px-3 py-2 text-sm font-semibold ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "subscription" && (
          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L("Abonnement en cours", "الاشتراك الحالي", "Current subscription")}</p>
                  <p className="mt-1 text-lg font-bold">{teacher.plan_name || L("Aucun", "لا يوجد", "None")}</p>
                  {teacher.plan_name && (
                    <p className="text-sm text-muted-foreground">
                      {teacher.ends_at
                        ? `${L("Jusqu'au", "إلى غاية", "Until")} ${fmtDate(teacher.ends_at, lang)}${teacher.days_left !== null && teacher.sub_status !== "grace" ? ` · ${L("reste", "متبقي", "left")} ${teacher.days_left} ${L("jour(s)", "يوم", "day(s)")}` : ""}`
                        : L("Sans date de fin", "بدون تاريخ نهاية", "No end date")}
                    </p>
                  )}
                </div>
                {adminCan("admin.subscriptions.manage") && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" className="gap-1.5" onClick={() => setSubDialog("assign")}>
                      <Repeat className="h-3.5 w-3.5" />{teacher.plan_name ? L("Changer d'offre", "تغيير العرض", "Change plan") : L("Attribuer une offre", "منح عرض", "Assign a plan")}
                    </Button>
                    {current && (
                      <>
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setSubDialog("renew")}>
                          <RefreshCw className="h-3.5 w-3.5" />{L("Renouveler", "تجديد", "Renew")}
                        </Button>
                        {current.ends_at && (
                          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setExtendOpen(true)}>
                            <CalendarPlus className="h-3.5 w-3.5" />{L("Prolonger", "تمديد", "Extend")}
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="gap-1.5 text-red-600" onClick={cancelCurrent}>
                          <XCircle className="h-3.5 w-3.5" />{L("Arrêter", "إيقاف", "Stop")}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border bg-card">
              <h2 className="border-b px-4 py-3 text-sm font-bold">{L("Historique", "السجل", "History")}</h2>
              {subs.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">—</p>
              ) : (
                <ul className="divide-y">
                  {subs.map(s => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {s.plans?.name || "—"}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            ({s.kind === "trial" ? L("essai", "تجريبي", "trial") : s.kind === "free" ? L("offert", "مجاني", "free") : L("payant", "مؤدى", "paid")})
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {fmtDate(s.starts_at, lang)} {lang === "ar" ? "←" : "→"} {s.ends_at ? fmtDate(s.ends_at, lang) : L("sans fin", "بدون نهاية", "no end")}
                          {s.canceled_at ? ` · ${L("arrêté le", "أوقف في", "stopped")} ${fmtDate(s.canceled_at, lang)}` : ""}
                          {s.notes ? ` · ${s.notes}` : ""}
                        </p>
                      </div>
                      {s.price_mad ? <span className="text-xs font-semibold">{fmtMoney(s.price_mad, lang)}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {tab === "payments" && (
          <PaymentsTab teacher={teacher} payments={payments} subs={subs} onAdd={() => setPayOpen(true)} canAdd={adminCan("admin.payments.manage")} />
        )}

        {tab === "permissions" && <PermissionsTab teacherId={id} canEdit={adminCan("admin.overrides.manage")} />}

        {tab === "journal" && (adminCan("admin.audit.view")
          ? <AuditList teacherId={id} />
          : <p className="text-sm text-muted-foreground">{L("Accès au journal non autorisé.", "غير مسموح بالاطلاع على السجل.", "No access to the log.")}</p>)}
      </div>

      <EditTeacherDialog open={editOpen} onOpenChange={setEditOpen} teacher={teacher} account={account} onSaved={load} />
      <DeleteTeacherDialog teacher={deleting} onClose={() => setDeleting(null)} onDeleted={() => navigate("/admin/teachers")} />
      <SubscriptionDialog
        mode={subDialog}
        onClose={() => setSubDialog(null)}
        teacherId={id}
        plans={plans}
        current={current}
        onSaved={load}
      />
      <ExtendDialog open={extendOpen} onOpenChange={setExtendOpen} current={current} onSaved={load} />
      <PaymentDialog open={payOpen} onOpenChange={setPayOpen} teacherId={id} subs={subs} onSaved={load} />
      {confirmDialog}

      <Dialog open={!!secret} onOpenChange={v => !v && setSecret(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{L("Nouveau mot de passe provisoire", "كلمة مرور مؤقتة جديدة", "New temporary password")}</DialogTitle>
            <DialogDescription>{L("Le professeur devra le changer à sa prochaine connexion.", "سيغيرها الأستاذ عند الدخول القادم.", "The teacher must change it at next login.")}</DialogDescription>
          </DialogHeader>
          <CopyBox text={`${teacher.email}\n${secret || ""}`} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CopyBox({ text }: { text: string }) {
  const { L } = useT();
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2">
      <pre className="select-all whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 text-sm" dir="ltr" style={{ WebkitUserSelect: "text", userSelect: "text" }}>{text}</pre>
      <Button type="button" variant="outline" className="gap-1.5" onClick={async () => { if (await copyWithToast(text, L)) setCopied(true); }}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? L("Copié", "تم النسخ", "Copied") : L("Copier", "نسخ", "Copy")}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

function SubscriptionDialog({ mode, onClose, teacherId, plans, current, onSaved }: {
  mode: null | "assign" | "renew"; onClose: () => void; teacherId: string; plans: PlanRow[]; current: any; onSaved: () => void;
}) {
  const { L } = useT();
  const [f, setF] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const available = plans.filter(p => p.is_active || p.id === current?.plan_id);
  const plan = plans.find(p => p.id === f.plan_id);

  useEffect(() => {
    if (!mode) return;
    const now = new Date();
    // Renouvellement : repart le jour qui suit la fin actuelle si elle n'est pas dépassée, sinon d'aujourd'hui
    // (+1 s : une fin à 23:59:59 locale donne le lendemain, en date locale)
    const start = mode === "renew" && current?.ends_at && new Date(current.ends_at) > now ? new Date(new Date(current.ends_at).getTime() + 1000) : now;
    const pid = mode === "renew" ? current?.plan_id : (current?.plan_id && plans.find(p => p.id === current.plan_id)?.is_active ? current.plan_id : available[0]?.id);
    setF({ plan_id: pid || "", kind: "paid", starts: localDateStr(start), ends: "", price: "", notes: "", stopCurrent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (!plan) return;
    const days = f.kind === "trial" ? plan.trial_days || plan.duration_days : plan.duration_days;
    setF((prev: any) => ({ ...prev, ends: days ? endDateInput(f.starts, days) : "", price: f.kind === "paid" ? String(plan.price_mad || "") : "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.plan_id, f.kind, f.starts]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan) return;
    if (f.ends && f.starts && f.ends < f.starts) {
      return toast.error(L("La date de fin précède la date de début.", "تاريخ النهاية قبل تاريخ البداية.", "The end date is before the start date."));
    }
    setSaving(true);
    const startsAt = fromDateInput(f.starts) || new Date().toISOString();
    // Changement d'offre : l'abonnement en cours s'arrête au début du nouveau
    if (mode === "assign" && current && f.stopCurrent) {
      const stopAt = new Date(startsAt) > new Date() ? startsAt : new Date().toISOString();
      const upd: any = new Date(stopAt) <= new Date() ? { canceled_at: stopAt } : { ends_at: stopAt, grace_days: 0 };
      const { error } = await db.from("subscriptions").update(upd).eq("id", current.id);
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
    }
    const { error } = await db.from("subscriptions").insert({
      teacher_id: teacherId, plan_id: plan.id, kind: f.kind, starts_at: startsAt,
      ends_at: f.ends ? fromDateInput(f.ends, true) : null, grace_days: plan.grace_days ?? 7,
      price_mad: f.kind === "paid" && f.price ? Number(f.price) : null, notes: f.notes || (mode === "renew" ? L("Renouvellement", "تجديد", "Renewal") : null),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(L("Abonnement enregistré", "تم حفظ الاشتراك", "Subscription saved"));
    onClose();
    onSaved();
  };

  return (
    <Dialog open={!!mode} onOpenChange={v => !v && !saving && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "renew" ? L("Renouveler l'abonnement", "تجديد الاشتراك", "Renew subscription") : L("Attribuer une offre", "منح عرض", "Assign a plan")}</DialogTitle>
          <DialogDescription>
            {mode === "renew"
              ? L("Le nouvel abonnement démarre à la fin de l'actuel (ou aujourd'hui s'il est déjà terminé).", "يبدأ الاشتراك الجديد عند نهاية الحالي (أو اليوم إذا انتهى).", "The new subscription starts when the current one ends (or today).")
              : L("La date de fin est calculée d'après l'offre ; vous pouvez la modifier.", "يُحسب تاريخ النهاية حسب العرض ويمكن تعديله.", "The end date is computed from the plan; you can change it.")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sub-dlg-1">{L("Offre", "العرض", "Plan")}</Label>
              <select id="sub-dlg-1" className={selectCls} value={f.plan_id || ""} onChange={e => setF({ ...f, plan_id: e.target.value })} required>
                {available.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-dlg-2">{L("Type", "النوع", "Type")}</Label>
              <select id="sub-dlg-2" className={selectCls} value={f.kind || "paid"} onChange={e => setF({ ...f, kind: e.target.value })}>
                <option value="paid">{L("Payant", "مؤدى عنه", "Paid")}</option>
                <option value="trial">{L("Essai", "تجريبي", "Trial")}</option>
                <option value="free">{L("Offert", "مجاني", "Free")}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-dlg-3">{L("Début", "البداية", "Start")}</Label>
              <Input id="sub-dlg-3" type="date" value={f.starts || ""} onChange={e => setF({ ...f, starts: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-dlg-4">{L("Fin (vide = sans fin)", "النهاية (فارغ = بدون نهاية)", "End (empty = none)")}</Label>
              <Input id="sub-dlg-4" type="date" value={f.ends || ""} onChange={e => setF({ ...f, ends: e.target.value })} />
            </div>
            {f.kind === "paid" && (
              <div className="space-y-1.5">
                <Label htmlFor="sub-dlg-5">{L("Prix (MAD)", "الثمن (درهم)", "Price (MAD)")}</Label>
                <Input id="sub-dlg-5" type="number" min="0" step="0.01" value={f.price || ""} onChange={e => setF({ ...f, price: e.target.value })} />
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="sub-dlg-6">{L("Note", "ملاحظة", "Note")}</Label>
              <Input id="sub-dlg-6" value={f.notes || ""} onChange={e => setF({ ...f, notes: e.target.value })} />
            </div>
          </div>
          {mode === "assign" && current && (
            <label className="flex min-h-[40px] cursor-pointer items-center gap-3 text-sm">
              <input type="checkbox" className="h-5 w-5 flex-shrink-0" checked={!!f.stopCurrent} onChange={e => setF({ ...f, stopCurrent: e.target.checked })} />
              <span>{L("Arrêter l'abonnement en cours au début du nouveau", "إيقاف الاشتراك الحالي عند بداية الجديد", "Stop the current subscription when the new one starts")}</span>
            </label>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>{L("Annuler", "إلغاء", "Cancel")}</Button>
            <Button type="submit" disabled={saving || !plan}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? L("Enregistrement…", "جار الحفظ…", "Saving…") : L("Enregistrer", "حفظ", "Save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ExtendDialog({ open, onOpenChange, current, onSaved }: any) {
  const { L, lang } = useT();
  const [days, setDays] = useState("30");
  const [saving, setSaving] = useState(false);
  const n = Math.floor(Number(days));
  // base : fin actuelle si elle n'est pas dépassée, sinon maintenant ; ajout en jours calendaires locaux
  const base = current?.ends_at && new Date(current.ends_at) > new Date() ? current.ends_at : new Date().toISOString();
  const newEnd = n > 0 ? addDaysIso(base, n) : null;
  const save = async () => {
    if (!current?.ends_at || !newEnd) return;
    setSaving(true);
    const { error } = await db.from("subscriptions").update({ ends_at: newEnd }).eq("id", current.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(L("Abonnement prolongé", "تم تمديد الاشتراك", "Subscription extended"));
    onOpenChange(false);
    onSaved();
  };
  return (
    <Dialog open={open} onOpenChange={v => !saving && onOpenChange(v)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{L("Prolonger l'abonnement", "تمديد الاشتراك", "Extend subscription")}</DialogTitle>
          <DialogDescription>{L("Fin actuelle", "النهاية الحالية", "Current end")} : {fmtDate(current?.ends_at, lang)}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {[7, 15, 30, 90].map(x => (
            <button key={x} type="button" onClick={() => setDays(String(x))} aria-pressed={days === String(x)} className={`h-9 rounded-full border px-3 text-sm ${days === String(x) ? "border-primary bg-primary text-primary-foreground" : ""}`}>
              +{x} {L("j", "ي", "d")}
            </button>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="extend-days">{L("Nombre de jours", "عدد الأيام", "Number of days")}</Label>
          <Input id="extend-days" type="number" min="1" value={days} onChange={e => setDays(e.target.value)} />
          {newEnd && <p className="text-xs text-muted-foreground">{L("Nouvelle fin", "النهاية الجديدة", "New end")} : <b>{fmtDate(newEnd, lang)}</b></p>}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{L("Annuler", "إلغاء", "Cancel")}</Button>
          <Button onClick={save} disabled={saving || !newEnd}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {L("Prolonger", "تمديد", "Extend")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

function PaymentsTab({ teacher, payments, subs, onAdd, canAdd }: any) {
  const { L, lang } = useT();
  const total = payments.reduce((s: number, p: any) => s + Number(p.amount_mad || 0), 0);
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-bold">{L("Paiements", "الأداءات", "Payments")} · {fmtMoney(total, lang)}</h2>
        {canAdd && (
          <Button size="sm" className="gap-1.5" onClick={onAdd}><Plus className="h-3.5 w-3.5" />{L("Enregistrer un paiement", "تسجيل أداء", "Record a payment")}</Button>
        )}
      </div>
      {payments.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{L("Aucun paiement.", "لا يوجد أي أداء.", "No payment.")}</p>
      ) : (
        <ul className="divide-y">
          {payments.map((p: any) => {
            const sub = subs.find((s: any) => s.id === p.subscription_id);
            const method = PAYMENT_METHODS.find(m => m.id === p.method);
            return (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold">{fmtMoney(p.amount_mad, lang)} <span className="text-xs font-normal text-muted-foreground">· {method ? L(method.fr, method.ar, method.en) : p.method}</span></p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(p.paid_at, lang)}{sub ? ` · ${sub.plans?.name}` : ""}{p.reference ? ` · ${L("réf.", "مرجع", "ref.")} ${p.reference}` : ""}{p.receipt_number ? ` · ${L("reçu", "وصل", "receipt")} ${p.receipt_number}` : ""}
                  </p>
                </div>
                <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => printReceipt(p, teacher, sub, lang, L)}>
                  <Printer className="h-3.5 w-3.5" />{L("Reçu", "وصل", "Receipt")}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function printReceipt(p: any, teacher: any, sub: any, lang: Lang, L: (fr: string, ar: string, en: string) => string) {
  const w = window.open("", "_blank", "width=720,height=900");
  if (!w) {
    toast.error(L(
      "Fenêtre bloquée : autorisez les fenêtres pop-up pour imprimer le reçu.",
      "تم حظر النافذة: اسمح بالنوافذ المنبثقة لطباعة الوصل.",
      "Pop-up blocked: allow pop-ups to print the receipt."
    ));
    return;
  }
  const method = PAYMENT_METHODS.find(m => m.id === p.method);
  const esc = (s: any) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
  const locale = lang === "ar" ? "ar-MA" : lang === "en" ? "en-GB" : "fr-FR";
  const dir = lang === "ar" ? "rtl" : "ltr";
  const arrow = lang === "ar" ? "←" : "→";
  const number = p.receipt_number || String(p.id).slice(0, 8).toUpperCase();
  const period = sub ? ` (${esc(fmtDate(sub.starts_at, lang))} ${arrow} ${esc(sub.ends_at ? fmtDate(sub.ends_at, lang) : L("sans fin", "بدون نهاية", "no end"))})` : "";
  const row = (k: string, v: string, cls = "") => `<tr><td class="k">${esc(k)}</td><td${cls ? ` class="${cls}"` : ""}>${v}</td></tr>`;
  w.document.write(`<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(L("Reçu", "وصل", "Receipt"))} ${esc(number)}</title>
  <style>body{font-family:Arial,Tahoma,sans-serif;max-width:640px;margin:32px auto;padding:0 16px;color:#111;direction:${dir};text-align:${lang === "ar" ? "right" : "left"}}h1{font-size:22px;margin:0}
  .muted{color:#666;font-size:13px}table{width:100%;border-collapse:collapse;margin-top:24px}td{padding:8px;border-bottom:1px solid #ddd;vertical-align:top}
  td.k{color:#555;width:40%}.total{font-size:20px;font-weight:bold}.ltr{direction:ltr;unicode-bidi:embed}</style></head><body>
  <h1>${esc(L("Reçu de paiement", "وصل الأداء", "Payment receipt"))}</h1><p class="muted">Math infini · ${esc(new Date().toLocaleDateString(locale))}</p>
  <table>
  ${row(L("N° de reçu", "رقم الوصل", "Receipt no."), `<span class="ltr">${esc(number)}</span>`)}
  ${row(L("Professeur", "الأستاذ", "Teacher"), `${esc(teacher.name)} (<span class="ltr">${esc(teacher.email)}</span>)`)}
  ${row(L("Date du paiement", "تاريخ الأداء", "Payment date"), esc(fmtDate(p.paid_at, lang)))}
  ${row(L("Offre", "العرض", "Plan"), `${esc(sub?.plans?.name || "—")}${period}`)}
  ${row(L("Moyen de paiement", "وسيلة الأداء", "Payment method"), `${esc(method ? L(method.fr, method.ar, method.en) : p.method)}${p.reference ? ` · ${esc(L("réf.", "مرجع", "ref."))} <span class="ltr">${esc(p.reference)}</span>` : ""}`)}
  ${row(L("Montant", "المبلغ", "Amount"), esc(fmtMoney(p.amount_mad, lang)), "total")}
  </table><script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
}

function PaymentDialog({ open, onOpenChange, teacherId, subs, onSaved }: any) {
  const { L, lang } = useT();
  const [f, setF] = useState<any>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setF({ amount: "", paid_at: localDateStr(new Date()), method: "transfer", reference: "", receipt: "", notes: "", subscription_id: subs[0]?.id || "" });
  }, [open, subs]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await db.from("payments").insert({
      teacher_id: teacherId, subscription_id: f.subscription_id || null, amount_mad: Number(f.amount), paid_at: f.paid_at,
      method: f.method, reference: f.reference || null, receipt_number: f.receipt || null, notes: f.notes || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(L("Paiement enregistré", "تم تسجيل الأداء", "Payment recorded"));
    onOpenChange(false);
    onSaved();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{L("Enregistrer un paiement", "تسجيل أداء", "Record a payment")}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pay-dlg-7">{L("Montant (MAD)", "المبلغ (درهم)", "Amount (MAD)")} *</Label>
              <Input id="pay-dlg-7" required type="number" min="0.01" step="0.01" value={f.amount || ""} onChange={e => setF({ ...f, amount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-dlg-8">{L("Date", "التاريخ", "Date")}</Label>
              <Input id="pay-dlg-8" type="date" value={f.paid_at || ""} onChange={e => setF({ ...f, paid_at: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-dlg-9">{L("Moyen", "الوسيلة", "Method")}</Label>
              <select id="pay-dlg-9" className={selectCls} value={f.method} onChange={e => setF({ ...f, method: e.target.value })}>
                {PAYMENT_METHODS.map(m => <option key={m.id} value={m.id}>{L(m.fr, m.ar, m.en)}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-dlg-10">{L("Abonnement concerné", "الاشتراك المعني", "Subscription")}</Label>
              <select id="pay-dlg-10" className={selectCls} value={f.subscription_id} onChange={e => setF({ ...f, subscription_id: e.target.value })}>
                <option value="">—</option>
                {subs.map((s: any) => <option key={s.id} value={s.id}>{s.plans?.name} · {fmtDate(s.starts_at, lang)}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-dlg-11">{L("Référence (virement…)", "المرجع", "Reference")}</Label>
              <Input id="pay-dlg-11" value={f.reference || ""} onChange={e => setF({ ...f, reference: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-dlg-12">{L("N° de reçu", "رقم الوصل", "Receipt no.")}</Label>
              <Input id="pay-dlg-12" value={f.receipt || ""} onChange={e => setF({ ...f, receipt: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-dlg-13">{L("Note", "ملاحظة", "Note")}</Label>
            <Input id="pay-dlg-13" value={f.notes || ""} onChange={e => setF({ ...f, notes: e.target.value })} />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{L("Annuler", "إلغاء", "Cancel")}</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? L("Enregistrement…", "جار الحفظ…", "Saving…") : L("Enregistrer", "حفظ", "Save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

interface EffRow { key: string; allowed: boolean; source: string; limit_value: number | null; used: number | null }
/** Exception d'un professeur ; null = « Selon l'offre » (aucune exception) */
type Ov = { effect: "allow" | "deny"; limit_value: number | null; expires_at: string | null; reason?: string | null } | null;

const sameOv = (a: Ov | undefined, b: Ov | undefined) =>
  (!a && !b) || (!!a && !!b && a.effect === b.effect && (a.limit_value ?? null) === (b.limit_value ?? null)
    && (a.expires_at ? a.expires_at.slice(0, 10) : null) === (b.expires_at ? b.expires_at.slice(0, 10) : null));

function PermissionsTab({ teacherId, canEdit }: { teacherId: string; canEdit: boolean }) {
  const { L, lang } = useT();
  const [rows, setRows] = useState<EffRow[]>([]);
  const [perms, setPerms] = useState<any[]>([]);
  const [saved, setSaved] = useState<Record<string, Ov>>({});
  // modifications en attente de validation (clé → nouvelle valeur)
  const [draft, setDraft] = useState<Record<string, Ov>>({});
  const [planKeys, setPlanKeys] = useState<Set<string>>(new Set());
  const [subStatus, setSubStatus] = useState<string>("none");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [{ data: eff, error }, { data: cat }, { data: ov }, { data: st }] = await Promise.all([
      db.rpc("effective_permissions", { uid: teacherId }),
      db.from("permissions").select("*").neq("kind", "admin").order("sort_order"),
      db.from("teacher_permission_overrides").select("*").eq("teacher_id", teacherId),
      db.rpc("subscription_status", { uid: teacherId }),
    ]);
    if (error) toast.error(error.message);
    setRows(eff || []);
    setPerms(cat || []);
    const map: Record<string, Ov> = {};
    (ov || []).forEach((o: any) => (map[o.permission_key] = { effect: o.effect, limit_value: o.limit_value, expires_at: o.expires_at, reason: o.reason }));
    setSaved(map);
    const s = Array.isArray(st) ? st[0] : st;
    setSubStatus(s?.status || "none");
    if (s?.plan_id) {
      const { data: pp } = await db.from("plan_permissions").select("permission_key").eq("plan_id", s.plan_id);
      setPlanKeys(new Set((pp || []).map((x: any) => x.permission_key)));
    } else setPlanKeys(new Set());
  };
  useEffect(() => {
    setDraft({});
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId]);

  const eff = useMemo(() => Object.fromEntries(rows.map(r => [r.key, r])), [rows]);
  const permByKey = useMemo(() => Object.fromEntries(perms.map(p => [p.key, p])), [perms]);
  const modules = useMemo(() => {
    const m: Record<string, any[]> = {};
    perms.forEach(p => (m[p.module] = m[p.module] || []).push(p));
    return Object.keys(MODULE_LABELS).filter(k => m[k]).map(k => ({ key: k, items: m[k] }));
  }, [perms]);

  const current = (key: string): Ov => (key in draft ? draft[key] : saved[key] ?? null);
  const changedKeys = Object.keys(draft).filter(k => !sameOv(draft[k], saved[k] ?? null));
  const dirty = changedKeys.length > 0;

  // modification locale (pas encore enregistrée)
  const edit = (key: string, next: Ov) => {
    setDraft(d => {
      const copy = { ...d };
      if (sameOv(next, saved[key] ?? null)) delete copy[key];
      else copy[key] = next;
      return copy;
    });
  };
  const setEffect = (key: string, effect: "plan" | "allow" | "deny", limit?: number | null) => {
    if (effect === "plan") return edit(key, null);
    const prev = current(key) || saved[key] || null;
    edit(key, { effect, limit_value: limit !== undefined ? limit : prev?.limit_value ?? null, expires_at: prev?.expires_at ?? null, reason: prev?.reason ?? null });
  };

  // avertissement si on quitte la page avec des modifications non validées
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  // état autorisé / interdit prévisualisé avec le brouillon
  const previewAllowed = (key: string): boolean | undefined => {
    const r = eff[key];
    if (!(key in draft)) return r?.allowed;
    if (subStatus === "suspended" || subStatus === "deleted") return false;
    const o = draft[key];
    if (o?.effect === "deny") return false;
    if (o?.effect === "allow") return true;
    if (subStatus === "none") return false;
    if (subStatus === "expired") return !permByKey[key]?.is_write && planKeys.has(key);
    return planKeys.has(key);
  };

  const describeOv = (key: string, o: Ov) => {
    const isQuota = permByKey[key]?.kind === "quota";
    if (!o) return L("Selon l'offre", "حسب العرض", "Per plan");
    let txt = isQuota
      ? `${L("Limite", "الحد", "Limit")} ${o.limit_value ?? "∞"}`
      : o.effect === "allow" ? L("Autoriser", "سماح", "Allow") : L("Interdire", "منع", "Deny");
    if (o.expires_at) txt += ` (${L("jusqu'au", "إلى غاية", "until")} ${fmtDate(o.expires_at, lang)})`;
    return txt;
  };

  const cancel = () => setDraft({});

  const validate = async () => {
    setSaving(true);
    const errors: string[] = [];
    for (const key of changedKeys) {
      const o = draft[key];
      const { error } = o
        ? await db.from("teacher_permission_overrides").upsert({
            teacher_id: teacherId, permission_key: key, effect: o.effect,
            limit_value: o.limit_value ?? null, expires_at: o.expires_at ?? null, reason: o.reason ?? null,
          }, { onConflict: "teacher_id,permission_key" })
        : await db.from("teacher_permission_overrides").delete().eq("teacher_id", teacherId).eq("permission_key", key);
      if (error) errors.push(`${permLabel(key, lang)} : ${error.message}`);
    }
    setSaving(false);
    setConfirmOpen(false);
    if (errors.length) toast.error(errors.join("\n"));
    else toast.success(L(
      `${changedKeys.length} modification(s) enregistrée(s), appliquée(s) immédiatement au professeur`,
      `تم حفظ ${changedKeys.length} تعديل(ات)، وتطبق فورا على الأستاذ`,
      `${changedKeys.length} change(s) saved and applied to the teacher immediately`,
    ));
    setDraft({});
    await load();
  };

  const sourceLabel = (s: string) =>
    s === "override" ? L("exception", "استثناء", "override")
    : s === "plan" ? L("offre", "العرض", "plan")
    : s === "not_in_plan" ? L("hors offre", "خارج العرض", "not in plan")
    : s === "expired" ? L("expiré : lecture seule", "منتهي: قراءة فقط", "expired: read-only")
    : s === "suspended" ? L("suspendu", "موقوف", "suspended")
    : L("sans abonnement", "بدون اشتراك", "no subscription");

  return (
    <div className={`space-y-4 ${dirty ? "pb-28" : ""}`}>
      <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        {L(
          "« Selon l'offre » applique le contenu de l'offre du professeur. « Autoriser » / « Interdire » créent une exception pour lui seul (avec une date de fin si besoin). Faites vos choix puis cliquez sur « Valider » : ils s'appliquent aussitôt sur l'application du professeur, sans qu'il ait à se reconnecter. « Annuler » efface les choix non validés.",
          "« حسب العرض » يطبق محتوى عرض الأستاذ. « السماح » / « المنع » ينشئان استثناء خاصا به (مع تاريخ نهاية عند الحاجة). اختر ثم اضغط « تأكيد »: تطبق التغييرات فورا على تطبيق الأستاذ دون إعادة الاتصال. « إلغاء » يمحو الاختيارات غير المؤكدة.",
          "“Per plan” applies the teacher's plan. “Allow” / “Deny” create an exception for this teacher only (optionally until a date). Make your choices then click “Validate”: they apply at once in the teacher's app, without signing in again. “Cancel” discards unvalidated choices."
        )}
      </p>
      {modules.map(m => (
        <section key={m.key} className="overflow-hidden rounded-xl border bg-card">
          <h3 className="border-b bg-muted/40 px-4 py-2 text-sm font-bold">{moduleLabel(m.key, lang)}</h3>
          <ul className="divide-y">
            {m.items.map((p: any) => {
              const r = eff[p.key];
              const ov = current(p.key);
              const changed = changedKeys.indexOf(p.key) !== -1;
              const value = ov ? ov.effect : "plan";
              const isQuota = p.kind === "quota";
              const allowed = previewAllowed(p.key);
              const limit = changed ? (ov ? ov.limit_value : r?.source === "override" ? null : r?.limit_value ?? null) : r?.limit_value ?? null;
              const used = r?.used ?? 0;
              const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
              return (
                <li key={p.key} className={`flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between ${changed ? "border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-950/30 rtl:border-l-0 rtl:border-r-4" : ""}`}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {!isQuota && (
                        <span className={`inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${allowed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                          {allowed ? "✓" : "✕"}
                        </span>
                      )}
                      <span className="text-sm font-medium">{permLabel(p.key, lang)}</span>
                      {changed ? (
                        <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">{L("non validé", "غير مؤكد", "not saved")}</span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">{r ? sourceLabel(r.source) : ""}</span>
                      )}
                    </div>
                    {isQuota && (
                      <div className="mt-1.5 max-w-xs">
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span>{used} / {limit === null ? "∞" : limit}</span>
                          {limit !== null && <span>{pct}%</span>}
                        </div>
                        <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className={`h-full rounded-full ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${limit === null ? 4 : pct}%` }} />
                        </div>
                      </div>
                    )}
                    {ov?.expires_at && <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400">{L("Exception jusqu'au", "استثناء إلى غاية", "Override until")} {fmtDate(ov.expires_at, lang)}</p>}
                  </div>
                  {canEdit && (
                    <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                      {isQuota ? (
                        <>
                          <select
                            className="h-9 rounded-md border bg-background px-2 text-xs"
                            aria-label={permLabel(p.key, lang)}
                            value={ov ? "allow" : "plan"}
                            disabled={saving}
                            onChange={e => setEffect(p.key, e.target.value === "plan" ? "plan" : "allow", r?.limit_value ?? null)}
                          >
                            <option value="plan">{L("Selon l'offre", "حسب العرض", "Per plan")}</option>
                            <option value="allow">{L("Limite personnalisée", "حد مخصص", "Custom limit")}</option>
                          </select>
                          {ov && (
                            <Input
                              type="number"
                              min="0"
                              className="h-9 w-24 text-xs"
                              aria-label={`${permLabel(p.key, lang)} · ${L("Limite", "الحد", "Limit")}`}
                              value={ov.limit_value ?? ""}
                              placeholder="∞"
                              disabled={saving}
                              onChange={e => setEffect(p.key, "allow", e.target.value === "" ? null : Math.max(0, Number(e.target.value)))}
                            />
                          )}
                        </>
                      ) : (
                        <div className="inline-flex rounded-md border p-0.5 text-[11px]" role="group" aria-label={permLabel(p.key, lang)}>
                          {(["plan", "allow", "deny"] as const).map(v => (
                            <button
                              key={v}
                              type="button"
                              disabled={saving}
                              onClick={() => value !== v && setEffect(p.key, v)}
                              aria-pressed={value === v}
                              className={`min-h-[32px] rounded px-2 py-1 font-semibold ${value === v
                                ? v === "allow" ? "bg-emerald-600 text-white" : v === "deny" ? "bg-red-600 text-white" : "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                                : "text-muted-foreground"}`}
                            >
                              {v === "plan" ? L("Selon l'offre", "حسب العرض", "Per plan") : v === "allow" ? L("Autoriser", "سماح", "Allow") : L("Interdire", "منع", "Deny")}
                            </button>
                          ))}
                        </div>
                      )}
                      {ov && (
                        <Input
                          type="date"
                          className="h-9 w-36 text-xs"
                          title={L("Fin de l'exception (facultatif)", "نهاية الاستثناء (اختياري)", "Override end (optional)")}
                          aria-label={`${permLabel(p.key, lang)} · ${L("Fin de l'exception (facultatif)", "نهاية الاستثناء (اختياري)", "Override end (optional)")}`}
                          value={toDateInput(ov.expires_at)}
                          disabled={saving}
                          onChange={e => edit(p.key, { ...ov, expires_at: e.target.value ? fromDateInput(e.target.value, true) : null })}
                        />
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {canEdit && dirty && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t-2 border-amber-400 bg-background shadow-[0_-4px_16px_rgba(0,0,0,0.08)] ltr:lg:left-60 rtl:lg:right-60" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              {L(`${changedKeys.length} modification(s) non validée(s)`, `${changedKeys.length} تعديل(ات) غير مؤكدة`, `${changedKeys.length} unsaved change(s)`)}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={cancel} disabled={saving}>
                <XCircle className="h-4 w-4" />{L("Annuler", "إلغاء", "Cancel")}
              </Button>
              <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={saving}>
                <Check className="h-4 w-4" />{L("Valider", "تأكيد", "Validate")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={o => !saving && setConfirmOpen(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{L("Valider les modifications ?", "تأكيد التعديلات؟", "Validate the changes?")}</DialogTitle>
            <DialogDescription>
              {L("Elles s'appliqueront immédiatement sur l'application du professeur.", "ستطبق فورا على تطبيق الأستاذ.", "They will apply immediately in the teacher's app.")}
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border text-sm">
            {changedKeys.map(k => (
              <li key={k} className="px-3 py-2">
                <p className="font-medium">{permLabel(k, lang)}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="line-through">{describeOv(k, saved[k] ?? null)}</span>
                  {lang === "ar" ? "  ←  " : "  →  "}
                  <span className="font-semibold text-foreground">{describeOv(k, draft[k])}</span>
                </p>
              </li>
            ))}
          </ul>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={saving}>{L("Retour", "رجوع", "Back")}</Button>
            <Button onClick={validate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? L("Enregistrement…", "جار الحفظ…", "Saving…") : L("Confirmer", "تأكيد", "Confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

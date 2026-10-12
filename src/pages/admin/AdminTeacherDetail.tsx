import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, KeyRound, Ban, PlayCircle, Pencil, CalendarPlus, RefreshCw, Repeat, XCircle, Plus, Printer, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAccess } from "@/contexts/AccessContext";
import { MODULE_LABELS } from "@/lib/permissions";
import {
  addDaysIso, adminInvoke, db, fmtDate, fmtMoney, fromDateInput, moduleLabel, PAYMENT_METHODS, permLabel,
  StatusBadge, toDateInput, useT, type Lang,
} from "./adminShared";
import type { PlanRow } from "./AdminTeachers";
import { AuditList } from "./AdminAudit";

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

  const load = async () => {
    const [{ data: list }, { data: acc }, { data: s }, { data: p }, { data: pl }] = await Promise.all([
      db.rpc("admin_teachers"),
      db.from("teacher_accounts").select("*").eq("user_id", id).maybeSingle(),
      db.from("subscriptions").select("*, plans(name)").eq("teacher_id", id).order("starts_at", { ascending: false }),
      db.from("payments").select("*").eq("teacher_id", id).order("paid_at", { ascending: false }),
      db.from("plans").select("*").order("sort_order"),
    ]);
    setTeacher((list || []).find((t: any) => t.user_id === id) || null);
    setAccount(acc);
    setSubs(s || []);
    setPayments(p || []);
    setPlans(pl || []);
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!teacher) return <div className="h-40 animate-pulse rounded-xl bg-muted" />;

  // même règle que subscription_status() : commencé, non arrêté, la fin la plus lointaine
  const current = subs
    .filter(s => !s.canceled_at && new Date(s.starts_at) <= new Date())
    .sort((a, b) => (a.ends_at === null ? -1 : b.ends_at === null ? 1 : new Date(b.ends_at).getTime() - new Date(a.ends_at).getTime()))[0] || null;
  const suspended = teacher.account_status === "suspended";

  const resetPassword = async () => {
    if (!confirm(L("Générer un nouveau mot de passe provisoire ?", "إنشاء كلمة مرور مؤقتة جديدة؟", "Generate a new temporary password?"))) return;
    const { data, error } = await adminInvoke("reset_password", { user_id: id });
    if (error) return toast.error(error);
    setSecret(data.password);
  };
  const toggleSuspend = async () => {
    let reason = "";
    if (!suspended) {
      const r = prompt(L("Motif de la suspension (facultatif) :", "سبب التوقيف (اختياري):", "Reason (optional):"));
      if (r === null) return;
      reason = r;
    }
    const { error } = await adminInvoke("set_status", { user_id: id, status: suspended ? "active" : "suspended", reason });
    if (error) return toast.error(error);
    toast.success(suspended ? L("Compte réactivé", "تم تفعيل الحساب", "Account reactivated") : L("Compte suspendu", "تم توقيف الحساب", "Account suspended"));
    void load();
  };
  const cancelCurrent = async () => {
    if (!current) return;
    if (!confirm(L("Arrêter l'abonnement en cours dès maintenant ? Le compte passera en lecture seule.", "إيقاف الاشتراك الحالي الآن؟ سيصبح الحساب للقراءة فقط.", "Stop the current subscription now? The account becomes read-only."))) return;
    const { error } = await db.from("subscriptions").update({ canceled_at: new Date().toISOString() }).eq("id", current.id);
    if (error) return toast.error(error.message);
    void load();
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "subscription", label: L("Abonnement", "الاشتراك", "Subscription") },
    { id: "payments", label: L("Paiements", "الأداءات", "Payments") },
    { id: "permissions", label: L("Habilitations & quotas", "الصلاحيات والحصص", "Permissions & quotas") },
    { id: "journal", label: L("Journal", "السجل", "Log") },
  ];

  return (
    <div>
      <Link to="/admin/teachers" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
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
              <p className="mt-1 text-xs font-medium text-red-600">{L("Motif", "السبب", "Reason")} : {account.suspended_reason}</p>
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
            className={`-mb-px flex-shrink-0 border-b-2 px-3 py-2 text-sm font-semibold ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
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
                          {fmtDate(s.starts_at, lang)} → {s.ends_at ? fmtDate(s.ends_at, lang) : L("sans fin", "بدون نهاية", "no end")}
                          {s.canceled_at ? ` · ${L("arrêté le", "أوقف في", "stopped")} ${fmtDate(s.canceled_at, lang)}` : ""}
                          {s.notes ? ` · ${s.notes}` : ""}
                        </p>
                      </div>
                      {s.price_mad ? <span className="text-xs font-semibold">{fmtMoney(s.price_mad)}</span> : null}
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
      <pre className="whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 text-sm" dir="ltr">{text}</pre>
      <Button type="button" variant="outline" className="gap-1.5" onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true)).catch(() => undefined)}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{L("Copier", "نسخ", "Copy")}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------

function EditTeacherDialog({ open, onOpenChange, teacher, account, onSaved }: any) {
  const { L } = useT();
  const [f, setF] = useState<any>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setF({
      name: teacher.name || "", email: teacher.email || "", phone: account?.phone || "", school: account?.school || "",
      city: account?.city || "", subject: account?.subject || "", notes: account?.notes || "",
    });
  }, [open, teacher, account]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await adminInvoke("update_teacher", {
      user_id: teacher.user_id, ...f, email: f.email !== teacher.email ? f.email : undefined,
    });
    setSaving(false);
    if (error) return toast.error(error);
    toast.success(L("Enregistré", "تم الحفظ", "Saved"));
    onOpenChange(false);
    onSaved();
  };
  const field = (k: string, label: string, props: any = {}) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={f[k] || ""} onChange={e => setF({ ...f, [k]: e.target.value })} {...props} />
    </div>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{L("Modifier le professeur", "تعديل الأستاذ", "Edit teacher")}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {field("name", L("Nom complet", "الاسم الكامل", "Full name"), { required: true })}
            {field("email", L("E-mail", "البريد", "Email"), { type: "email", dir: "ltr", required: true })}
            {field("phone", L("Téléphone", "الهاتف", "Phone"), { dir: "ltr" })}
            {field("subject", L("Matière", "المادة", "Subject"))}
            {field("school", L("Établissement", "المؤسسة", "School"))}
            {field("city", L("Ville", "المدينة", "City"))}
          </div>
          <div className="space-y-1.5">
            <Label>{L("Notes internes", "ملاحظات داخلية", "Internal notes")}</Label>
            <Textarea rows={3} value={f.notes || ""} onChange={e => setF({ ...f, notes: e.target.value })} />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{L("Annuler", "إلغاء", "Cancel")}</Button>
            <Button type="submit" disabled={saving}>{L("Enregistrer", "حفظ", "Save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
    // Renouvellement : repart de la fin actuelle si elle n'est pas dépassée, sinon d'aujourd'hui
    const start = mode === "renew" && current?.ends_at && new Date(current.ends_at) > now ? new Date(current.ends_at) : now;
    const pid = mode === "renew" ? current?.plan_id : (current?.plan_id && plans.find(p => p.id === current.plan_id)?.is_active ? current.plan_id : available[0]?.id);
    setF({ plan_id: pid || "", kind: "paid", starts: toDateInput(start.toISOString()), ends: "", price: "", notes: "", stopCurrent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (!plan) return;
    const days = f.kind === "trial" ? plan.trial_days || plan.duration_days : plan.duration_days;
    const startIso = fromDateInput(f.starts) || new Date().toISOString();
    setF((prev: any) => ({ ...prev, ends: days ? toDateInput(addDaysIso(startIso, days)) : "", price: f.kind === "paid" ? String(plan.price_mad || "") : "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.plan_id, f.kind, f.starts]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan) return;
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
      price_mad: f.kind === "paid" && f.price ? Number(f.price) : null, notes: f.notes || (mode === "renew" ? "Renouvellement" : null),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(L("Abonnement enregistré", "تم حفظ الاشتراك", "Subscription saved"));
    onClose();
    onSaved();
  };

  return (
    <Dialog open={!!mode} onOpenChange={v => !v && onClose()}>
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
              <Label>{L("Offre", "العرض", "Plan")}</Label>
              <select className={selectCls} value={f.plan_id || ""} onChange={e => setF({ ...f, plan_id: e.target.value })} required>
                {available.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{L("Type", "النوع", "Type")}</Label>
              <select className={selectCls} value={f.kind || "paid"} onChange={e => setF({ ...f, kind: e.target.value })}>
                <option value="paid">{L("Payant", "مؤدى عنه", "Paid")}</option>
                <option value="trial">{L("Essai", "تجريبي", "Trial")}</option>
                <option value="free">{L("Offert", "مجاني", "Free")}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{L("Début", "البداية", "Start")}</Label>
              <Input type="date" value={f.starts || ""} onChange={e => setF({ ...f, starts: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>{L("Fin (vide = sans fin)", "النهاية (فارغ = بدون نهاية)", "End (empty = none)")}</Label>
              <Input type="date" value={f.ends || ""} onChange={e => setF({ ...f, ends: e.target.value })} />
            </div>
            {f.kind === "paid" && (
              <div className="space-y-1.5">
                <Label>{L("Prix (MAD)", "الثمن (درهم)", "Price (MAD)")}</Label>
                <Input type="number" min="0" step="0.01" value={f.price || ""} onChange={e => setF({ ...f, price: e.target.value })} />
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{L("Note", "ملاحظة", "Note")}</Label>
              <Input value={f.notes || ""} onChange={e => setF({ ...f, notes: e.target.value })} />
            </div>
          </div>
          {mode === "assign" && current && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5" checked={!!f.stopCurrent} onChange={e => setF({ ...f, stopCurrent: e.target.checked })} />
              <span>{L("Arrêter l'abonnement en cours au début du nouveau", "إيقاف الاشتراك الحالي عند بداية الجديد", "Stop the current subscription when the new one starts")}</span>
            </label>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose}>{L("Annuler", "إلغاء", "Cancel")}</Button>
            <Button type="submit" disabled={saving || !plan}>{L("Enregistrer", "حفظ", "Save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ExtendDialog({ open, onOpenChange, current, onSaved }: any) {
  const { L, lang } = useT();
  const [days, setDays] = useState("30");
  const save = async () => {
    const n = Number(days);
    if (!current?.ends_at || !n) return;
    const base = new Date(current.ends_at) > new Date() ? current.ends_at : new Date().toISOString();
    const { error } = await db.from("subscriptions").update({ ends_at: addDaysIso(base, n) }).eq("id", current.id);
    if (error) return toast.error(error.message);
    toast.success(L("Abonnement prolongé", "تم تمديد الاشتراك", "Subscription extended"));
    onOpenChange(false);
    onSaved();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{L("Prolonger l'abonnement", "تمديد الاشتراك", "Extend subscription")}</DialogTitle>
          <DialogDescription>{L("Fin actuelle", "النهاية الحالية", "Current end")} : {fmtDate(current?.ends_at, lang)}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {[7, 15, 30, 90].map(n => (
            <button key={n} type="button" onClick={() => setDays(String(n))} className={`rounded-full border px-3 py-1 text-sm ${days === String(n) ? "border-primary bg-primary text-primary-foreground" : ""}`}>
              +{n} {L("j", "ي", "d")}
            </button>
          ))}
        </div>
        <Input type="number" min="1" value={days} onChange={e => setDays(e.target.value)} />
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{L("Annuler", "إلغاء", "Cancel")}</Button>
          <Button onClick={save}>{L("Prolonger", "تمديد", "Extend")}</Button>
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
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-bold">{L("Paiements", "الأداءات", "Payments")} · {fmtMoney(total)}</h2>
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
                  <p className="font-semibold">{fmtMoney(p.amount_mad)} <span className="text-xs font-normal text-muted-foreground">· {method ? L(method.fr, method.ar, method.en) : p.method}</span></p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(p.paid_at, lang)}{sub ? ` · ${sub.plans?.name}` : ""}{p.reference ? ` · ${L("réf.", "مرجع", "ref.")} ${p.reference}` : ""}{p.receipt_number ? ` · ${L("reçu", "وصل", "receipt")} ${p.receipt_number}` : ""}
                  </p>
                </div>
                <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => printReceipt(p, teacher, sub, lang)}>
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

function printReceipt(p: any, teacher: any, sub: any, lang: Lang) {
  const w = window.open("", "_blank", "width=720,height=900");
  if (!w) return;
  const method = PAYMENT_METHODS.find(m => m.id === p.method);
  const esc = (s: any) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Reçu ${esc(p.receipt_number || "")}</title>
  <style>body{font-family:Arial,sans-serif;max-width:640px;margin:32px auto;color:#111}h1{font-size:22px;margin:0}
  .muted{color:#666;font-size:13px}table{width:100%;border-collapse:collapse;margin-top:24px}td{padding:8px;border-bottom:1px solid #ddd}
  .total{font-size:20px;font-weight:bold}</style></head><body>
  <h1>Reçu de paiement</h1><p class="muted">Math infini · ${esc(new Date().toLocaleDateString("fr-FR"))}</p>
  <table>
  <tr><td>N° de reçu</td><td>${esc(p.receipt_number || p.id.slice(0, 8).toUpperCase())}</td></tr>
  <tr><td>Professeur</td><td>${esc(teacher.name)} (${esc(teacher.email)})</td></tr>
  <tr><td>Date du paiement</td><td>${esc(fmtDate(p.paid_at, lang))}</td></tr>
  <tr><td>Offre</td><td>${esc(sub?.plans?.name || "—")}${sub ? ` (${esc(fmtDate(sub.starts_at, lang))} → ${esc(sub.ends_at ? fmtDate(sub.ends_at, lang) : "sans fin")})` : ""}</td></tr>
  <tr><td>Moyen de paiement</td><td>${esc(method?.fr || p.method)}${p.reference ? ` · réf. ${esc(p.reference)}` : ""}</td></tr>
  <tr><td>Montant</td><td class="total">${esc(fmtMoney(p.amount_mad))}</td></tr>
  </table><script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
}

function PaymentDialog({ open, onOpenChange, teacherId, subs, onSaved }: any) {
  const { L, lang } = useT();
  const [f, setF] = useState<any>({});
  useEffect(() => {
    if (open) setF({ amount: "", paid_at: toDateInput(new Date().toISOString()), method: "transfer", reference: "", receipt: "", notes: "", subscription_id: subs[0]?.id || "" });
  }, [open, subs]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await db.from("payments").insert({
      teacher_id: teacherId, subscription_id: f.subscription_id || null, amount_mad: Number(f.amount), paid_at: f.paid_at,
      method: f.method, reference: f.reference || null, receipt_number: f.receipt || null, notes: f.notes || null,
    });
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
              <Label>{L("Montant (MAD)", "المبلغ (درهم)", "Amount (MAD)")} *</Label>
              <Input required type="number" min="0.01" step="0.01" value={f.amount || ""} onChange={e => setF({ ...f, amount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{L("Date", "التاريخ", "Date")}</Label>
              <Input type="date" value={f.paid_at || ""} onChange={e => setF({ ...f, paid_at: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{L("Moyen", "الوسيلة", "Method")}</Label>
              <select className={selectCls} value={f.method} onChange={e => setF({ ...f, method: e.target.value })}>
                {PAYMENT_METHODS.map(m => <option key={m.id} value={m.id}>{L(m.fr, m.ar, m.en)}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{L("Abonnement concerné", "الاشتراك المعني", "Subscription")}</Label>
              <select className={selectCls} value={f.subscription_id} onChange={e => setF({ ...f, subscription_id: e.target.value })}>
                <option value="">—</option>
                {subs.map((s: any) => <option key={s.id} value={s.id}>{s.plans?.name} · {fmtDate(s.starts_at, lang)}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{L("Référence (virement…)", "المرجع", "Reference")}</Label>
              <Input value={f.reference || ""} onChange={e => setF({ ...f, reference: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{L("N° de reçu", "رقم الوصل", "Receipt no.")}</Label>
              <Input value={f.receipt || ""} onChange={e => setF({ ...f, receipt: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{L("Note", "ملاحظة", "Note")}</Label>
            <Input value={f.notes || ""} onChange={e => setF({ ...f, notes: e.target.value })} />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{L("Annuler", "إلغاء", "Cancel")}</Button>
            <Button type="submit">{L("Enregistrer", "حفظ", "Save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

interface EffRow { key: string; allowed: boolean; source: string; limit_value: number | null; used: number | null }

function PermissionsTab({ teacherId, canEdit }: { teacherId: string; canEdit: boolean }) {
  const { L, lang } = useT();
  const [rows, setRows] = useState<EffRow[]>([]);
  const [perms, setPerms] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const [{ data: eff, error }, { data: cat }, { data: ov }] = await Promise.all([
      db.rpc("effective_permissions", { uid: teacherId }),
      db.from("permissions").select("*").neq("kind", "admin").order("sort_order"),
      db.from("teacher_permission_overrides").select("*").eq("teacher_id", teacherId),
    ]);
    if (error) toast.error(error.message);
    setRows(eff || []);
    setPerms(cat || []);
    const map: Record<string, any> = {};
    (ov || []).forEach((o: any) => (map[o.permission_key] = o));
    setOverrides(map);
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId]);

  const eff = useMemo(() => Object.fromEntries(rows.map(r => [r.key, r])), [rows]);
  const modules = useMemo(() => {
    const m: Record<string, any[]> = {};
    perms.forEach(p => (m[p.module] = m[p.module] || []).push(p));
    return Object.keys(MODULE_LABELS).filter(k => m[k]).map(k => ({ key: k, items: m[k] }));
  }, [perms]);

  const setOverride = async (key: string, effect: "plan" | "allow" | "deny", extra: { limit?: number | null; expires?: string | null } = {}) => {
    setBusy(key);
    let error: any = null;
    if (effect === "plan") {
      ({ error } = await db.from("teacher_permission_overrides").delete().eq("teacher_id", teacherId).eq("permission_key", key));
    } else {
      const prev = overrides[key];
      ({ error } = await db.from("teacher_permission_overrides").upsert({
        teacher_id: teacherId, permission_key: key, effect,
        limit_value: extra.limit !== undefined ? extra.limit : prev?.limit_value ?? null,
        expires_at: extra.expires !== undefined ? extra.expires : prev?.expires_at ?? null,
        reason: prev?.reason ?? null,
      }, { onConflict: "teacher_id,permission_key" }));
    }
    setBusy(null);
    if (error) return toast.error(error.message);
    void load();
  };

  const sourceLabel = (s: string) =>
    s === "override" ? L("exception", "استثناء", "override")
    : s === "plan" ? L("offre", "العرض", "plan")
    : s === "not_in_plan" ? L("hors offre", "خارج العرض", "not in plan")
    : s === "expired" ? L("expiré : lecture seule", "منتهي: قراءة فقط", "expired: read-only")
    : s === "suspended" ? L("suspendu", "موقوف", "suspended")
    : L("sans abonnement", "بدون اشتراك", "no subscription");

  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        {L(
          "« Selon l'offre » applique le contenu de l'offre du professeur. « Autoriser » / « Interdire » créent une exception pour lui seul (avec une date de fin si besoin). Les changements s'appliquent immédiatement.",
          "« حسب العرض » يطبق محتوى عرض الأستاذ. « السماح » / « المنع » ينشئان استثناء خاصا به (مع تاريخ نهاية عند الحاجة). تطبق التغييرات فورا.",
          "“Per plan” applies the teacher's plan. “Allow” / “Deny” create an exception for this teacher only (optionally until a date). Changes apply immediately."
        )}
      </p>
      {modules.map(m => (
        <section key={m.key} className="overflow-hidden rounded-xl border bg-card">
          <h3 className="border-b bg-muted/40 px-4 py-2 text-sm font-bold">{moduleLabel(m.key, lang)}</h3>
          <ul className="divide-y">
            {m.items.map((p: any) => {
              const r = eff[p.key];
              const ov = overrides[p.key];
              const value = ov ? ov.effect : "plan";
              const isQuota = p.kind === "quota";
              const limit = r?.limit_value ?? null;
              const used = r?.used ?? 0;
              const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
              return (
                <li key={p.key} className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {!isQuota && (
                        <span className={`inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${r?.allowed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                          {r?.allowed ? "✓" : "✕"}
                        </span>
                      )}
                      <span className="text-sm font-medium">{permLabel(p.key, lang)}</span>
                      <span className="text-[11px] text-muted-foreground">{r ? sourceLabel(r.source) : ""}</span>
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
                    {ov?.expires_at && <p className="mt-0.5 text-[11px] text-amber-700">{L("Exception jusqu'au", "استثناء إلى غاية", "Override until")} {fmtDate(ov.expires_at, lang)}</p>}
                  </div>
                  {canEdit && (
                    <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                      {isQuota ? (
                        <>
                          <select
                            className="h-8 rounded-md border bg-background px-2 text-xs"
                            value={ov ? "allow" : "plan"}
                            disabled={busy === p.key}
                            onChange={e => setOverride(p.key, e.target.value === "plan" ? "plan" : "allow", { limit: limit })}
                          >
                            <option value="plan">{L("Selon l'offre", "حسب العرض", "Per plan")}</option>
                            <option value="allow">{L("Limite personnalisée", "حد مخصص", "Custom limit")}</option>
                          </select>
                          {ov && (
                            <Input
                              type="number"
                              min="0"
                              className="h-8 w-24 text-xs"
                              defaultValue={ov.limit_value ?? ""}
                              placeholder="∞"
                              onBlur={e => setOverride(p.key, "allow", { limit: e.target.value === "" ? null : Number(e.target.value) })}
                            />
                          )}
                        </>
                      ) : (
                        <div className="inline-flex rounded-md border p-0.5 text-[11px]">
                          {(["plan", "allow", "deny"] as const).map(v => (
                            <button
                              key={v}
                              type="button"
                              disabled={busy === p.key}
                              onClick={() => value !== v && setOverride(p.key, v)}
                              className={`rounded px-2 py-1 font-semibold ${value === v
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
                          className="h-8 w-36 text-xs"
                          title={L("Fin de l'exception (facultatif)", "نهاية الاستثناء (اختياري)", "Override end (optional)")}
                          defaultValue={toDateInput(ov.expires_at)}
                          onBlur={e => {
                            const v = e.target.value ? fromDateInput(e.target.value, true) : null;
                            if (v !== (ov.expires_at || null)) setOverride(p.key, ov.effect, { expires: v });
                          }}
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
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Copy, Check, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAccess } from "@/contexts/AccessContext";
import {
  addDaysIso, adminInvoke, db, fmtDate, fromDateInput, PageTitle, PAYMENT_METHODS, StatusBadge, toDateInput, useT,
} from "./adminShared";

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
  const [createOpen, setCreateOpen] = useState(false);

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
    return rows.filter(r => {
      if (status !== "all" && (r.sub_status || "none") !== status) return false;
      if (plan !== "all" && r.plan_name !== plan) return false;
      if (!s) return true;
      return [r.name, r.email, r.school, r.city, r.phone].some(v => (v || "").toLowerCase().includes(s));
    });
  }, [rows, q, status, plan]);

  return (
    <div>
      <PageTitle
        title={L("Professeurs", "الأساتذة", "Teachers")}
        subtitle={L(`${rows.length} compte(s)`, `${rows.length} حساب`, `${rows.length} account(s)`)}
        actions={
          adminCan("admin.teachers.manage") && (
            <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              {L("Nouveau professeur", "أستاذ جديد", "New teacher")}
            </Button>
          )
        }
      />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ltr:left-3 rtl:right-3" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder={L("Nom, e-mail, école, ville…", "الاسم، البريد، المؤسسة، المدينة…", "Name, email, school, city…")} className="ltr:pl-9 rtl:pr-9" />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} className={`${selectCls} sm:w-44`}>
          <option value="all">{L("Tous les statuts", "كل الحالات", "All statuses")}</option>
          <option value="active">{L("Actif", "نشط", "Active")}</option>
          <option value="trial">{L("Essai", "تجريبي", "Trial")}</option>
          <option value="grace">{L("Grâce", "مهلة", "Grace")}</option>
          <option value="expired">{L("Expiré", "منتهي", "Expired")}</option>
          <option value="suspended">{L("Suspendu", "موقوف", "Suspended")}</option>
          <option value="none">{L("Sans abonnement", "بدون اشتراك", "No subscription")}</option>
        </select>
        <select value={plan} onChange={e => setPlan(e.target.value)} className={`${selectCls} sm:w-44`}>
          <option value="all">{L("Toutes les offres", "كل العروض", "All plans")}</option>
          {plans.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

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
                    <th className="px-4 py-2.5 text-start font-semibold">{L("Professeur", "الأستاذ", "Teacher")}</th>
                    <th className="px-4 py-2.5 text-start font-semibold">{L("École / ville", "المؤسسة / المدينة", "School / city")}</th>
                    <th className="px-4 py-2.5 text-start font-semibold">{L("Offre", "العرض", "Plan")}</th>
                    <th className="px-4 py-2.5 text-start font-semibold">{L("Statut", "الحالة", "Status")}</th>
                    <th className="px-4 py-2.5 text-start font-semibold">{L("Fin", "النهاية", "Ends")}</th>
                    <th className="px-4 py-2.5 text-end font-semibold">{L("Classes / élèves", "الأقسام / التلاميذ", "Classes / students")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map(r => (
                    <tr key={r.user_id} className="hover:bg-muted/40">
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
                      <td className="px-4 py-2.5 text-end tabular-nums">{r.classes_count} / {r.students_count}</td>
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
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <CreateTeacherDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
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
    plan_id: "", kind: "trial", starts: toDateInput(new Date().toISOString()), ends: "", price: "",
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
    const startIso = fromDateInput(f.starts) || new Date().toISOString();
    setF(prev => ({
      ...prev,
      ends: days ? toDateInput(addDaysIso(startIso, days)) : "",
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
                onClick={() => {
                  navigator.clipboard?.writeText(credentials).then(() => setCopied(true)).catch(() => undefined);
                }}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {L("Copier", "نسخ", "Copy")}
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>{L("Terminer", "إنهاء", "Done")}</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{L("Nom complet", "الاسم الكامل", "Full name")} *</Label>
                <Input required value={f.name} onChange={e => set("name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{L("E-mail (identifiant)", "البريد الإلكتروني (المعرف)", "Email (login)")} *</Label>
                <Input required type="email" dir="ltr" value={f.email} onChange={e => set("email", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{L("Mot de passe provisoire", "كلمة مرور مؤقتة", "Temporary password")}</Label>
                <Input dir="ltr" value={f.password} onChange={e => set("password", e.target.value)} placeholder={L("Vide = généré automatiquement", "فارغ = يُنشأ تلقائيا", "Empty = generated")} />
              </div>
              <div className="space-y-1.5">
                <Label>{L("Téléphone", "الهاتف", "Phone")}</Label>
                <Input dir="ltr" value={f.phone} onChange={e => set("phone", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{L("Matière", "المادة", "Subject")}</Label>
                <Input value={f.subject} onChange={e => set("subject", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{L("Établissement", "المؤسسة", "School")}</Label>
                <Input value={f.school} onChange={e => set("school", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{L("Ville", "المدينة", "City")}</Label>
                <Input value={f.city} onChange={e => set("city", e.target.value)} />
              </div>
            </fieldset>

            {adminCan("admin.subscriptions.manage") && (
              <fieldset className="space-y-3 rounded-xl border p-3">
                <legend className="px-1 text-sm font-bold">{L("Abonnement", "الاشتراك", "Subscription")}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{L("Offre", "العرض", "Plan")}</Label>
                    <select className={selectCls} value={f.plan_id} onChange={e => set("plan_id", e.target.value)}>
                      <option value="">{L("Aucune (plus tard)", "لا شيء (لاحقا)", "None (later)")}</option>
                      {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{L("Type", "النوع", "Type")}</Label>
                    <select className={selectCls} value={f.kind} onChange={e => set("kind", e.target.value)} disabled={!f.plan_id}>
                      <option value="trial">{L("Essai", "تجريبي", "Trial")}</option>
                      <option value="paid">{L("Payant", "مؤدى عنه", "Paid")}</option>
                      <option value="free">{L("Offert", "مجاني", "Free")}</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{L("Début", "البداية", "Start")}</Label>
                    <Input type="date" value={f.starts} onChange={e => set("starts", e.target.value)} disabled={!f.plan_id} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{L("Fin (vide = sans fin)", "النهاية (فارغ = بدون نهاية)", "End (empty = none)")}</Label>
                    <Input type="date" value={f.ends} onChange={e => set("ends", e.target.value)} disabled={!f.plan_id} />
                  </div>
                  {f.kind === "paid" && (
                    <div className="space-y-1.5">
                      <Label>{L("Prix convenu (MAD)", "الثمن المتفق عليه (درهم)", "Agreed price (MAD)")}</Label>
                      <Input type="number" min="0" step="0.01" value={f.price} onChange={e => set("price", e.target.value)} />
                    </div>
                  )}
                </div>
                {f.kind === "paid" && adminCan("admin.payments.manage") && (
                  <div className="grid gap-3 border-t pt-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label>{L("Montant déjà payé", "المبلغ المؤدى", "Amount paid")}</Label>
                      <Input type="number" min="0" step="0.01" value={f.payment_amount} onChange={e => set("payment_amount", e.target.value)} placeholder="0" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{L("Moyen", "الوسيلة", "Method")}</Label>
                      <select className={selectCls} value={f.payment_method} onChange={e => set("payment_method", e.target.value)}>
                        {PAYMENT_METHODS.map(m => <option key={m.id} value={m.id}>{L(m.fr, m.ar, m.en)}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{L("Référence", "المرجع", "Reference")}</Label>
                      <Input value={f.payment_reference} onChange={e => set("payment_reference", e.target.value)} />
                    </div>
                  </div>
                )}
              </fieldset>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{L("Annuler", "إلغاء", "Cancel")}</Button>
              <Button type="submit" disabled={saving}>{saving ? L("Création…", "جارٍ الإنشاء…", "Creating…") : L("Créer le compte", "إنشاء الحساب", "Create account")}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

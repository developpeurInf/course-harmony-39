import { useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Copy, FileText, Hourglass, Landmark, Loader2, Paperclip, Send, Store, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { copyText } from "@/views/admin/adminShared";
import { openReceipt, RECEIPT_ACCEPT, RECEIPT_MAX_BYTES, uploadReceipt } from "@/lib/paymentReceipts";
import { cn } from "@/lib/utils";

const db = supabase as any;

type LFn = (fr: string, ar: string, en: string) => string;

interface Props {
  userId: string;
  plans: any[];
  currentPlanId: string | null | undefined;
  requests: any[];
  onChanged: () => void;
  L: LFn;
  lang: "fr" | "ar" | "en";
  fmt: (d: string | null | undefined) => string;
  fmtPrice: (n: unknown) => string;
}

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** « Payer mon abonnement » : choix de l'offre, coordonnées de paiement, envoi du reçu, suivi de la demande */
export default function PayPlanSection({ userId, plans, currentPlanId, requests, onChanged, L, lang, fmt, fmtPrice }: Props) {
  const { settings, text } = useAppSettings();
  const pay = settings.payments;
  const hasBank = !!pay.rib.trim();
  const hasAgency = !!(pay.agencyName.trim() || pay.agencyPhone.trim());

  // offres « sur invitation » : visibles seulement par le prof qui l'a déjà
  const payable = useMemo(() => plans.filter(p => !p.is_trial_plan && Number(p.price_mad) > 0 && (p.is_public !== false || p.id === currentPlanId)), [plans, currentPlanId]);
  const [planId, setPlanId] = useState<string>("");
  const plan = payable.find(p => p.id === planId) || payable.find(p => p.id === currentPlanId) || payable[0];
  const [method, setMethod] = useState<string>(hasBank ? "transfer" : hasAgency ? "agency" : "other");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(todayStr);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<{ code: string; plan: string; discount_mad: number; bonus_days: number; price_mad: number; referral: boolean } | null>(null);
  const [checking, setChecking] = useState(false);
  const activePromo = promo && plan && promo.plan === plan.id ? promo : null;
  const toPay = activePromo ? activePromo.price_mad : plan ? Number(plan.price_mad) : 0;

  const applyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code || !plan) return;
    setChecking(true);
    const { data, error } = await db.rpc("check_promo_code", { p_code: code, p_plan: plan.id });
    setChecking(false);
    if (error || !data?.valid) {
      setPromo(null);
      toast.error(
        data?.reason === "own_code" ? L("Vous ne pouvez pas utiliser votre propre code.", "لا يمكنك استعمال رمزك الخاص.", "You cannot use your own code.")
          : data?.reason === "other_plan" ? L("Ce code ne s'applique pas à cette offre.", "هذا الرمز لا ينطبق على هذا العرض.", "This code does not apply to this plan.")
            : L("Code invalide ou expiré.", "رمز غير صالح أو منتهي.", "Invalid or expired code.")
      );
      return;
    }
    setPromo({ code: data.code, plan: plan.id, discount_mad: Number(data.discount_mad || 0), bonus_days: Number(data.bonus_days || 0), price_mad: Number(data.price_mad), referral: !!data.referral });
    toast.success(L("Code appliqué", "تم تطبيق الرمز", "Code applied"));
  };

  const pending = requests.find(r => r.status === "pending");
  const last = requests.find(r => r.status !== "canceled");
  const planName = (id: string | null) => plans.find(p => p.id === id)?.name || "—";

  const copy = async (v: string) => {
    const ok = await copyText(v);
    if (ok) toast.success(L("Copié", "تم النسخ", "Copied"));
  };

  const pickFile = (f: File | undefined) => {
    if (fileInput.current) fileInput.current.value = "";
    if (!f) return;
    // les photos sont réduites avant l'envoi : seule la limite des PDF compte vraiment ici
    if (f.type === "application/pdf" && f.size > RECEIPT_MAX_BYTES) {
      toast.error(L("Fichier trop lourd (5 Mo au maximum).", "الملف كبير جدا (5 ميغابايت كحد أقصى).", "File too large (5 MB max)."));
      return;
    }
    setFile(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending || !plan) return;
    if (!file) {
      toast.error(L("Ajoutez la photo ou le PDF du reçu.", "أضف صورة الوصل أو ملف PDF.", "Add a photo or PDF of the receipt."));
      return;
    }
    setSending(true);
    try {
      const up = await uploadReceipt(userId, file);
      if (up.error || !up.path) {
        toast.error(
          up.error === "too_big"
            ? L("Fichier trop lourd (5 Mo au maximum).", "الملف كبير جدا (5 ميغابايت كحد أقصى).", "File too large (5 MB max).")
            : L("Impossible d'envoyer le reçu. Réessayez.", "تعذر إرسال الوصل. حاول مجددا.", "Could not upload the receipt. Try again.")
        );
        return;
      }
      const { error } = await db.from("subscription_requests").insert({
        teacher_id: userId,
        plan_id: plan.id,
        message: message.trim() || null,
        amount_mad: toPay,
        ...(activePromo ? { promo_code: activePromo.code, discount_mad: activePromo.discount_mad || null } : {}),
        pay_method: method,
        pay_reference: reference.trim() || null,
        paid_on: paidOn || null,
        receipt_path: up.path,
      });
      if (error) {
        console.error("Payment request failed", error);
        toast.error(L("Impossible d'envoyer la demande. Réessayez plus tard.", "تعذر إرسال الطلب. حاول لاحقاً.", "Could not send the request. Please try again later."));
        return;
      }
      toast.success(L("Paiement envoyé : l'administration va le vérifier.", "تم إرسال الأداء: ستتحقق منه الإدارة.", "Payment sent: the administration will check it."));
      setFile(null);
      setReference("");
      setMessage("");
      setPromo(null);
      setPromoInput("");
      onChanged();
    } finally {
      setSending(false);
    }
  };

  const cancel = async () => {
    if (!pending || canceling) return;
    setCanceling(true);
    const { error } = await db.from("subscription_requests").update({ status: "canceled" }).eq("id", pending.id);
    setCanceling(false);
    if (error) return toast.error(L("Impossible d'annuler la demande.", "تعذر إلغاء الطلب.", "Could not cancel the request."));
    toast.success(L("Demande annulée", "تم إلغاء الطلب", "Request canceled"));
    onChanged();
  };

  const showReceipt = async (path: string) => {
    const ok = await openReceipt(path);
    if (!ok) toast.error(L("Impossible d'ouvrir le reçu.", "تعذر فتح الوصل.", "Could not open the receipt."));
  };

  const methods = [
    hasBank && { id: "transfer", label: L("Virement bancaire", "تحويل بنكي", "Bank transfer") },
    hasAgency && { id: "agency", label: L("Agence (CashPlus, Wafacash…)", "وكالة (كاش بلوس، وفاكاش…)", "Agency (CashPlus, Wafacash…)") },
    { id: "cash", label: L("Espèces (remis en main propre)", "نقدا (يدا بيد)", "Cash (handed over)") },
    { id: "other", label: L("Autre", "أخرى", "Other") },
  ].filter(Boolean) as { id: string; label: string }[];

  const CopyRow = ({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) =>
    value.trim() ? (
      <div className="flex items-center justify-between gap-2 py-1">
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">{label}</p>
          <p className={cn("break-all text-sm font-semibold", ltr && "font-mono")} dir={ltr ? "ltr" : undefined}>{value}</p>
        </div>
        <button type="button" onClick={() => copy(value)} className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border hover:bg-muted" aria-label={L(`Copier : ${label}`, `نسخ: ${label}`, `Copy: ${label}`)}>
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    ) : null;

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="text-sm font-semibold">{L("Payer mon abonnement", "أداء اشتراكي", "Pay my subscription")}</h2>

      {last && last.status === "rejected" && !pending && (
        <div role="alert" className="mt-3 flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>
            {L(`Votre paiement du ${fmt(last.created_at)} n'a pas été accepté.`, `لم يُقبل أداؤك بتاريخ ${fmt(last.created_at)}.`, `Your payment of ${fmt(last.created_at)} was not accepted.`)}
            {last.reject_reason ? ` ${L("Motif", "السبب", "Reason")} : « ${last.reject_reason} ».` : ""}
            {" "}{L("Vous pouvez envoyer un nouveau reçu.", "يمكنك إرسال وصل جديد.", "You can send a new receipt.")}
          </p>
        </div>
      )}
      {last && last.status === "done" && !pending && (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          {L(`Paiement validé le ${fmt(last.handled_at)} · ${planName(last.plan_id)}`, `تمت المصادقة على الأداء في ${fmt(last.handled_at)} · ${planName(last.plan_id)}`, `Payment approved on ${fmt(last.handled_at)} · ${planName(last.plan_id)}`)}
        </p>
      )}

      {pending ? (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/30">
          <p className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200">
            <Hourglass className="h-4 w-4" />
            {L("Paiement en cours de vérification", "الأداء قيد التحقق", "Payment being checked")}
          </p>
          <p className="mt-1 text-muted-foreground">
            {planName(pending.plan_id)}{pending.amount_mad ? ` · ${fmtPrice(pending.amount_mad)}` : ""} · {L("envoyé le", "أُرسل في", "sent on")} {fmt(pending.created_at)}.
            {" "}{L("Votre abonnement s'activera dès la validation.", "سيُفعَّل اشتراكك فور المصادقة.", "Your subscription starts as soon as it is approved.")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {pending.receipt_path && (
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => showReceipt(pending.receipt_path)}>
                <FileText className="h-4 w-4" />{L("Voir mon reçu", "عرض الوصل", "View my receipt")}
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={cancel} disabled={canceling}>
              {canceling ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}{L("Annuler la demande", "إلغاء الطلب", "Cancel the request")}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-3 space-y-5">
          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-muted-foreground">1. {L("Choisissez votre offre", "اختر عرضك", "Choose your plan")}</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {payable.map(p => (
                <label
                  key={p.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm transition-colors",
                    plan?.id === p.id ? "border-primary bg-accent" : "hover:bg-muted"
                  )}
                >
                  <input type="radio" name="pay-plan" className="mt-1" checked={plan?.id === p.id} onChange={() => setPlanId(p.id)} />
                  <span className="min-w-0">
                    <span className="block font-semibold">{p.name}{p.id === currentPlanId ? ` · ${L("renouveler", "تجديد", "renew")}` : ""}</span>
                    <span className="block text-base font-bold text-primary">
                      {fmtPrice(p.price_mad)}
                      {p.compare_at_mad && Number(p.compare_at_mad) > Number(p.price_mad) && <span className="ms-1.5 text-xs font-normal text-muted-foreground line-through">{fmtPrice(p.compare_at_mad)}</span>}
                    </span>
                    {p.duration_days ? <span className="block text-xs text-muted-foreground">{L(`${p.duration_days} jours`, `${p.duration_days} يوما`, `${p.duration_days} days`)}</span> : null}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {pay.promoCodes !== false && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="pay-promo" className="text-xs">{L("Code promo ou de parrainage", "رمز التخفيض أو الإحالة", "Promo or referral code")}</Label>
                <Input id="pay-promo" value={promoInput} maxLength={32} className="w-48 font-mono uppercase" onChange={e => setPromoInput(e.target.value.toUpperCase())} />
              </div>
              <Button type="button" variant="outline" onClick={applyPromo} disabled={checking || !promoInput.trim()}>
                {checking && <Loader2 className="h-4 w-4 animate-spin" />}{L("Appliquer", "تطبيق", "Apply")}
              </Button>
              {activePromo && (
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  {activePromo.bonus_days > 0
                    ? L(`+${activePromo.bonus_days} jours offerts`, `+${activePromo.bonus_days} يوما مجانا`, `+${activePromo.bonus_days} free days`)
                    : L(`Remise de ${fmtPrice(activePromo.discount_mad)}`, `تخفيض ${fmtPrice(activePromo.discount_mad)}`, `${fmtPrice(activePromo.discount_mad)} off`)}
                </p>
              )}
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">2. {L(`Payez ${plan ? fmtPrice(toPay) : ""}`, `أدِّ ${plan ? fmtPrice(toPay) : ""}`, `Pay ${plan ? fmtPrice(toPay) : ""}`)}</p>
            <div className="grid gap-3 md:grid-cols-2">
              {hasBank && (
                <div className="rounded-lg border p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold"><Landmark className="h-4 w-4" />{L("Virement bancaire", "تحويل بنكي", "Bank transfer")}</p>
                  <CopyRow label={L("Banque", "البنك", "Bank")} value={pay.bankName} />
                  <CopyRow label={L("Titulaire", "صاحب الحساب", "Account holder")} value={pay.accountHolder} />
                  <CopyRow label="RIB" value={pay.rib} ltr />
                </div>
              )}
              {hasAgency && (
                <div className="rounded-lg border p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold"><Store className="h-4 w-4" />{L("CashPlus, Wafacash…", "كاش بلوس، وفاكاش…", "CashPlus, Wafacash…")}</p>
                  <CopyRow label={L("Bénéficiaire", "المستفيد", "Beneficiary")} value={pay.agencyName} />
                  <CopyRow label={L("Téléphone", "الهاتف", "Phone")} value={pay.agencyPhone} ltr />
                </div>
              )}
              {!hasBank && !hasAgency && (
                <p className="text-sm text-muted-foreground">{L("Contactez l'administration pour connaître les moyens de paiement.", "اتصل بالإدارة لمعرفة طرق الأداء.", "Contact the administration for payment details.")}</p>
              )}
            </div>
            {text(pay.instructions, lang) && <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">{text(pay.instructions, lang)}</p>}
          </div>

          <fieldset className="space-y-3">
            <legend className="mb-2 text-xs font-semibold text-muted-foreground">3. {L("Envoyez votre reçu", "أرسل الوصل", "Send your receipt")}</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="pay-method" className="text-xs">{L("Moyen de paiement", "طريقة الأداء", "Payment method")}</Label>
                <select id="pay-method" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={method} onChange={e => setMethod(e.target.value)}>
                  {methods.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pay-ref" className="text-xs">{L("Référence (facultatif)", "المرجع (اختياري)", "Reference (optional)")}</Label>
                <Input id="pay-ref" value={reference} maxLength={80} onChange={e => setReference(e.target.value)} placeholder={L("N° de transaction", "رقم العملية", "Transaction no.")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pay-date" className="text-xs">{L("Date du paiement", "تاريخ الأداء", "Payment date")}</Label>
                <Input id="pay-date" type="date" value={paidOn} max={todayStr()} onChange={e => setPaidOn(e.target.value)} />
              </div>
            </div>
            <div>
              <input ref={fileInput} id="pay-receipt" type="file" accept={RECEIPT_ACCEPT} className="sr-only" onChange={e => pickFile(e.target.files ? e.target.files[0] : undefined)} />
              <label htmlFor="pay-receipt" className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-3 text-sm hover:bg-muted">
                <Paperclip className="h-4 w-4 flex-shrink-0" />
                <span className="min-w-0 truncate">{file ? file.name : L("Photo ou PDF du reçu *", "صورة الوصل أو PDF *", "Photo or PDF of the receipt *")}</span>
              </label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-message" className="text-xs">{L("Message (facultatif)", "رسالة (اختياري)", "Message (optional)")}</Label>
              <Textarea id="pay-message" rows={2} value={message} maxLength={500} onChange={e => setMessage(e.target.value)} />
            </div>
            <Button type="submit" disabled={sending || !plan} className="gap-1.5">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {L("Envoyer mon paiement", "إرسال الأداء", "Send my payment")}
            </Button>
          </fieldset>
        </form>
      )}
    </section>
  );
}

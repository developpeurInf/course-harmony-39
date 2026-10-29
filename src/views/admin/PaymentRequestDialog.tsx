import { useEffect, useState } from "react";
import { Check, FileText, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { openReceipt } from "@/lib/paymentReceipts";
import { db, fmtDate, fmtMoney, PAYMENT_METHODS, useT } from "./adminShared";

/** Vérification d'un paiement envoyé par un prof : ouvrir le reçu, valider (abonnement + paiement) ou refuser */
export default function PaymentRequestDialog({ request, teacherName, onClose, onDone }: {
  request: any | null;
  teacherName: string;
  onClose: () => void;
  onDone: (id: string) => void;
}) {
  const { L, lang } = useT();
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [notes, setNotes] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!request) return;
    setAmount(request.amount_mad != null ? String(request.amount_mad) : "");
    setPaidAt(request.paid_on || "");
    setNotes("");
    setRejecting(false);
    setReason("");
  }, [request]);

  if (!request) return null;
  const method = PAYMENT_METHODS.find(m => m.id === request.pay_method);

  const showReceipt = async () => {
    const ok = await openReceipt(request.receipt_path);
    if (!ok) toast.error(L("Impossible d'ouvrir le reçu.", "تعذر فتح الوصل.", "Could not open the receipt."));
  };

  const approve = async () => {
    setBusy(true);
    const { data, error } = await db.rpc("admin_approve_subscription_request", {
      p_request: request.id,
      p_amount: amount === "" ? null : Number(amount),
      p_paid_at: paidAt || null,
      p_notes: notes.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(L(`Validation impossible : ${error.message}`, `تعذرت المصادقة: ${error.message}`, `Could not approve: ${error.message}`));
    toast.success(
      data?.receipt_number
        ? L(`Abonnement activé · reçu ${data.receipt_number}`, `تم تفعيل الاشتراك · وصل ${data.receipt_number}`, `Subscription activated · receipt ${data.receipt_number}`)
        : L("Abonnement activé", "تم تفعيل الاشتراك", "Subscription activated")
    );
    onDone(request.id);
  };

  const reject = async () => {
    setBusy(true);
    const { error } = await db.rpc("admin_reject_subscription_request", { p_request: request.id, p_reason: reason.trim() || null });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(L("Paiement refusé : le prof voit le motif.", "تم رفض الأداء: يرى الأستاذ السبب.", "Payment rejected: the teacher sees the reason."));
    onDone(request.id);
  };

  const row = (label: string, value: string | null | undefined) =>
    value ? (
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="break-words font-semibold">{value}</dd>
      </div>
    ) : null;

  return (
    <Dialog open={!!request} onOpenChange={v => !v && !busy && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{L("Vérifier le paiement", "التحقق من الأداء", "Check the payment")}</DialogTitle>
        </DialogHeader>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {row(L("Professeur", "الأستاذ", "Teacher"), teacherName)}
          {row(L("Offre", "العرض", "Plan"), request.plans?.name || L("renouvellement", "تجديد", "renewal"))}
          {row(L("Montant annoncé", "المبلغ المصرح به", "Stated amount"), request.amount_mad != null ? fmtMoney(request.amount_mad, lang) : null)}
          {row(L("Moyen", "الطريقة", "Method"), method ? L(method.fr, method.ar, method.en) : request.pay_method)}
          {row(L("Référence", "المرجع", "Reference"), request.pay_reference)}
          {row(L("Payé le", "تاريخ الأداء", "Paid on"), request.paid_on ? fmtDate(request.paid_on, lang) : null)}
          {row(L("Envoyé le", "أُرسل في", "Sent on"), fmtDate(request.created_at, lang))}
        </dl>
        {request.message && <p className="rounded-md bg-muted p-2 text-sm">« {request.message} »</p>}
        {request.receipt_path ? (
          <Button type="button" variant="outline" className="w-full gap-1.5" onClick={showReceipt}>
            <FileText className="h-4 w-4" />{L("Ouvrir le reçu", "فتح الوصل", "Open the receipt")}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">{L("Aucun reçu joint.", "لا يوجد وصل مرفق.", "No receipt attached.")}</p>
        )}

        {rejecting ? (
          <div className="space-y-2">
            <Label htmlFor="pay-reject-reason">{L("Motif du refus (visible par le prof)", "سبب الرفض (يراه الأستاذ)", "Reason (shown to the teacher)")}</Label>
            <Textarea id="pay-reject-reason" rows={2} value={reason} maxLength={300} onChange={e => setReason(e.target.value)} placeholder={L("Ex. montant incomplet, reçu illisible", "مثال: مبلغ ناقص، وصل غير واضح", "E.g. amount missing, unreadable receipt")} />
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setRejecting(false)} disabled={busy}>{L("Retour", "رجوع", "Back")}</Button>
              <Button type="button" variant="destructive" onClick={reject} disabled={busy} className="gap-1.5">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}{L("Refuser le paiement", "رفض الأداء", "Reject the payment")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pay-ok-amount">{L("Montant reçu (MAD)", "المبلغ المستلم (درهم)", "Amount received (MAD)")}</Label>
                <Input id="pay-ok-amount" type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pay-ok-date">{L("Date du paiement", "تاريخ الأداء", "Payment date")}</Label>
                <Input id="pay-ok-date" type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-ok-notes">{L("Note interne (facultatif)", "ملاحظة داخلية (اختياري)", "Internal note (optional)")}</Label>
              <Input id="pay-ok-notes" value={notes} maxLength={200} onChange={e => setNotes(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              {L(
                "Valider crée l'abonnement payant et enregistre le paiement avec un numéro de reçu. Même offre : la période s'ajoute à la suite. Autre offre : elle démarre aujourd'hui et remplace l'actuelle.",
                "المصادقة تُنشئ الاشتراك المؤدى عنه وتسجل الأداء برقم وصل. نفس العرض: تُضاف المدة بعد الحالية. عرض آخر: يبدأ اليوم ويعوض الحالي.",
                "Approving creates the paid subscription and records the payment with a receipt number. Same plan: the period is added after the current one. Other plan: it starts today and replaces the current one."
              )}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRejecting(true)} disabled={busy}>{L("Refuser", "رفض", "Reject")}</Button>
              <Button type="button" onClick={approve} disabled={busy} className="gap-1.5">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{L("Valider et activer", "المصادقة والتفعيل", "Approve and activate")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

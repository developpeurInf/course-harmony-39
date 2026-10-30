import { FileText, Gift, Landmark, Store, Wallet } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useT } from "../adminShared";
import { Card, Field, I18nField, NumberField, SwitchRow, type SectionProps } from "./shared";

/** Coordonnées affichées aux profs sur « Mon abonnement » pour payer leur offre */
export default function PaymentsSection({ draft, update }: SectionProps) {
  const { L } = useT();
  const p = draft.payments;
  const ribDigits = p.rib.replace(/\D/g, "");
  return (
    <div className="space-y-4">
      <Card
        icon={<Wallet className="h-4 w-4" />}
        title={L("Paiement des abonnements", "أداء الاشتراكات", "Subscription payments")}
        description={L(
          "Le prof choisit une offre, paie puis envoie son reçu. Vous validez la demande depuis le tableau de bord : l'abonnement et le paiement sont enregistrés.",
          "يختار الأستاذ عرضا ويؤدي ثم يرسل الوصل. تصادق على الطلب من لوحة القيادة: يُسجَّل الاشتراك والأداء.",
          "The teacher picks a plan, pays and sends the receipt. You approve the request from the dashboard: the subscription and the payment are recorded."
        )}
      >
        <SwitchRow
          id="cz-pay-enabled"
          label={L("Les profs peuvent payer depuis l'application", "يمكن للأساتذة الأداء من التطبيق", "Teachers can pay from the app")}
          description={L("Désactivé : seul le bouton « Envoyer la demande » reste.", "معطل: يبقى زر «إرسال الطلب» فقط.", "Off: only the “Send request” button remains.")}
          checked={p.enabled}
          onChange={v => update("payments", { enabled: v })}
        />
        <I18nField
          id="cz-pay-instr"
          multiline
          label={L("Consignes pour le prof", "تعليمات للأستاذ", "Instructions for teachers")}
          value={p.instructions}
          onChange={v => update("payments", { instructions: v })}
        />
      </Card>
      <Card icon={<Landmark className="h-4 w-4" />} title={L("Virement bancaire", "تحويل بنكي", "Bank transfer")} description={L("Laissez vide pour ne pas proposer le virement.", "اتركه فارغا لعدم اقتراح التحويل.", "Leave empty to hide bank transfer.")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="cz-pay-bank" label={L("Banque", "البنك", "Bank")}>
            <Input id="cz-pay-bank" value={p.bankName} maxLength={80} onChange={e => update("payments", { bankName: e.target.value })} />
          </Field>
          <Field id="cz-pay-holder" label={L("Titulaire du compte", "صاحب الحساب", "Account holder")}>
            <Input id="cz-pay-holder" value={p.accountHolder} maxLength={120} onChange={e => update("payments", { accountHolder: e.target.value })} />
          </Field>
        </div>
        <Field
          id="cz-pay-rib"
          label="RIB"
          hint={ribDigits && ribDigits.length !== 24 ? L(`${ribDigits.length} chiffres : un RIB marocain en compte 24.`, `${ribDigits.length} رقما: الرقم البنكي المغربي يتكون من 24 رقما.`, `${ribDigits.length} digits: a Moroccan RIB has 24.`) : undefined}
        >
          <Input id="cz-pay-rib" dir="ltr" inputMode="numeric" value={p.rib} maxLength={40} onChange={e => update("payments", { rib: e.target.value })} />
        </Field>
      </Card>
      <Card icon={<Store className="h-4 w-4" />} title={L("Transfert en agence (CashPlus, Wafacash…)", "تحويل عبر الوكالة (كاش بلوس، وفاكاش…)", "Agency transfer (CashPlus, Wafacash…)")} description={L("Laissez vide pour ne pas le proposer.", "اتركه فارغا لعدم اقتراحه.", "Leave empty to hide it.")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="cz-pay-agency" label={L("Nom du bénéficiaire", "اسم المستفيد", "Beneficiary name")}>
            <Input id="cz-pay-agency" value={p.agencyName} maxLength={120} onChange={e => update("payments", { agencyName: e.target.value })} />
          </Field>
          <Field id="cz-pay-phone" label={L("Téléphone du bénéficiaire", "هاتف المستفيد", "Beneficiary phone")}>
            <Input id="cz-pay-phone" dir="ltr" type="tel" value={p.agencyPhone} maxLength={30} onChange={e => update("payments", { agencyPhone: e.target.value })} />
          </Field>
        </div>
      </Card>
      <Card icon={<Gift className="h-4 w-4" />} title={L("Codes promo et parrainage", "رموز التخفيض والإحالة", "Promo codes & referrals")} description={L("Les codes se créent dans « Codes promo ». Le parrainage donne un code à chaque prof.", "تُنشأ الرموز في «رموز التخفيض». تمنح الإحالة رمزا لكل أستاذ.", "Codes are created in “Promo codes”. Referrals give each teacher a code.")}>
        <SwitchRow id="cz-pay-promo" label={L("Champ « code promo » à l'envoi du reçu", "خانة «رمز التخفيض» عند إرسال الوصل", "“Promo code” field when sending a receipt")} checked={p.promoCodes} onChange={v => update("payments", { promoCodes: v })} />
        <SwitchRow id="cz-pay-ref" label={L("Parrainage entre professeurs", "الإحالة بين الأساتذة", "Teacher referrals")} description={L("Chaque prof partage son code : le filleul a une remise, le parrain des jours offerts.", "يشارك كل أستاذ رمزه: يحصل المحال على تخفيض والمحيل على أيام مجانية.", "Each teacher shares a code: the new teacher gets a discount, the referrer free days.")} checked={p.referralEnabled} onChange={v => update("payments", { referralEnabled: v })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="cz-pay-ref-pct" label={L("Remise du filleul", "تخفيض المحال", "Referral discount")}>
            <NumberField id="cz-pay-ref-pct" value={p.referralDiscountPct} min={1} max={100} suffix="%" onChange={v => update("payments", { referralDiscountPct: v })} />
          </Field>
          <Field id="cz-pay-ref-days" label={L("Jours offerts au parrain", "أيام مجانية للمحيل", "Free days for the referrer")}>
            <NumberField id="cz-pay-ref-days" value={p.referralBonusDays} min={0} max={365} onChange={v => update("payments", { referralBonusDays: v })} />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">{L("Nouveaux codes seulement : les codes déjà créés gardent leurs valeurs.", "الرموز الجديدة فقط: تحتفظ الرموز الموجودة بقيمها.", "New codes only: existing codes keep their values.")}</p>
      </Card>
      <Card icon={<FileText className="h-4 w-4" />} title={L("Factures", "الفواتير", "Invoices")} description={L("Mentions imprimées en bas de chaque facture PDF (ICE, IF, RC, adresse…).", "بيانات تطبع أسفل كل فاتورة PDF (ICE، IF، RC، العنوان…).", "Legal details printed at the bottom of each PDF invoice (ICE, IF, RC, address…).")}>
        <Textarea id="cz-pay-legal" rows={3} value={p.invoiceLegal} maxLength={500} onChange={e => update("payments", { invoiceLegal: e.target.value })} placeholder="ICE 00000000000000 · IF 0000000 · RC 00000 · Adresse" />
      </Card>
    </div>
  );
}

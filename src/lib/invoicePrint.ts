import { toast } from "sonner";
import { getAppSettingsSnapshot } from "@/contexts/AppSettingsContext";
import { pickText } from "@/lib/appSettings";
import { fmtDate, fmtMoney, PAYMENT_METHODS, type Lang } from "@/views/admin/adminShared";

export interface InvoicePayment {
  id: string;
  amount_mad: number | string;
  paid_at: string;
  method: string;
  reference?: string | null;
  receipt_number?: string | null;
  discount_mad?: number | string | null;
  promo_code?: string | null;
  refunded_at?: string | null;
  refund_reason?: string | null;
}

export interface InvoiceTeacher {
  name: string;
  email?: string | null;
  school?: string | null;
  city?: string | null;
  phone?: string | null;
}

export interface InvoiceSubscription {
  starts_at?: string | null;
  ends_at?: string | null;
  plans?: { name?: string | null } | null;
}

/**
 * Facture / reçu de paiement, ouvert dans une fenêtre d'impression
 * (« Enregistrer en PDF » dans le navigateur ; l'arabe y est rendu correctement).
 */
export function printInvoice(p: InvoicePayment, teacher: InvoiceTeacher, sub: InvoiceSubscription | null, lang: Lang) {
  const L = (fr: string, ar: string, en: string) => (lang === "ar" ? ar : lang === "en" ? en : fr);
  const w = window.open("", "_blank", "width=760,height=960");
  if (!w) {
    toast.error(L(
      "Fenêtre bloquée : autorisez les fenêtres pop-up pour imprimer la facture.",
      "تم حظر النافذة: اسمح بالنوافذ المنبثقة لطباعة الفاتورة.",
      "Pop-up blocked: allow pop-ups to print the invoice."
    ));
    return;
  }
  const method = PAYMENT_METHODS.find(m => m.id === p.method);
  const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
  const locale = lang === "ar" ? "ar-MA" : lang === "en" ? "en-GB" : "fr-FR";
  const dir = lang === "ar" ? "rtl" : "ltr";
  const arrow = lang === "ar" ? "←" : "→";
  const number = p.receipt_number || String(p.id).slice(0, 8).toUpperCase();
  const brand = getAppSettingsSnapshot();
  const appName = brand.identity.appName || "Math infini";
  const school = brand.reports.schoolName || "";
  const logo = brand.reports.showLogo ? (brand.reports.logoUrl || brand.identity.logoUrl) : null;
  const footer = pickText(brand.reports.receiptFooter, lang);
  const legal = brand.payments?.invoiceLegal || "";
  const contact = [brand.texts.contactEmail, brand.texts.contactPhone].filter(Boolean).join(" · ");
  const amount = Number(p.amount_mad || 0);
  const discount = Number(p.discount_mad || 0);
  const planName = sub?.plans?.name || "—";
  const period = sub?.starts_at
    ? `${fmtDate(sub.starts_at, lang)} ${arrow} ${sub.ends_at ? fmtDate(sub.ends_at, lang) : L("sans fin", "بدون نهاية", "no end")}`
    : "";
  const client = [teacher.name, teacher.school, teacher.city].filter(Boolean).map(esc).join("<br>");

  w.document.write(`<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(L("Facture", "فاتورة", "Invoice"))} ${esc(number)}</title>
<style>
body{font-family:Arial,Tahoma,sans-serif;max-width:700px;margin:32px auto;padding:0 16px;color:#111;direction:${dir};text-align:${lang === "ar" ? "right" : "left"}}
.head{display:flex;justify-content:space-between;gap:24px;align-items:flex-start}
h1{font-size:24px;margin:0 0 4px}.muted{color:#666;font-size:13px}.ltr{direction:ltr;unicode-bidi:embed}
.box{border:1px solid #ddd;border-radius:8px;padding:12px;font-size:14px;line-height:1.5}
table{width:100%;border-collapse:collapse;margin-top:24px;font-size:14px}th,td{padding:10px 8px;border-bottom:1px solid #ddd;text-align:inherit}
th{background:#f5f5f5;font-weight:600}td.n{text-align:${lang === "ar" ? "left" : "right"};white-space:nowrap}
.total td{font-size:18px;font-weight:bold;border-bottom:2px solid #111}
.stamp{display:inline-block;margin-top:16px;padding:6px 14px;border:2px solid #16a34a;color:#16a34a;border-radius:6px;font-weight:bold;transform:rotate(-3deg)}
.stamp.refund{border-color:#dc2626;color:#dc2626}
@media print{body{margin:12mm auto}}
</style></head><body>
<div class="head">
  <div>
    ${logo ? `<img src="${esc(logo)}" alt="" style="max-height:56px;max-width:200px;margin-bottom:8px"><br>` : ""}
    <strong>${esc(appName)}</strong>${school ? `<br>${esc(school)}` : ""}${contact ? `<br><span class="muted ltr">${esc(contact)}</span>` : ""}
  </div>
  <div style="text-align:${lang === "ar" ? "left" : "right"}">
    <h1>${esc(L("Facture", "فاتورة", "Invoice"))}</h1>
    <div class="muted">${esc(L("N°", "رقم", "No."))} <span class="ltr">${esc(number)}</span></div>
    <div class="muted">${esc(L("Date", "التاريخ", "Date"))} : ${esc(fmtDate(p.paid_at, lang))}</div>
  </div>
</div>
<div class="box" style="margin-top:20px"><div class="muted">${esc(L("Client", "الزبون", "Billed to"))}</div>${client}${teacher.email ? `<br><span class="ltr">${esc(teacher.email)}</span>` : ""}${teacher.phone ? `<br><span class="ltr">${esc(teacher.phone)}</span>` : ""}</div>
<table>
  <thead><tr><th>${esc(L("Désignation", "البيان", "Description"))}</th><th class="n">${esc(L("Montant", "المبلغ", "Amount"))}</th></tr></thead>
  <tbody>
    <tr><td>${esc(L("Abonnement", "اشتراك", "Subscription"))} « ${esc(planName)} »${period ? `<br><span class="muted">${esc(period)}</span>` : ""}</td><td class="n">${esc(fmtMoney(amount + discount, lang))}</td></tr>
    ${discount > 0 ? `<tr><td>${esc(L("Remise", "تخفيض", "Discount"))}${p.promo_code ? ` (${esc(L("code", "رمز", "code"))} <span class="ltr">${esc(p.promo_code)}</span>)` : ""}</td><td class="n">- ${esc(fmtMoney(discount, lang))}</td></tr>` : ""}
    <tr class="total"><td>${esc(L("Total payé", "المجموع المؤدى", "Total paid"))}</td><td class="n">${esc(fmtMoney(amount, lang))}</td></tr>
  </tbody>
</table>
<p class="muted" style="margin-top:12px">${esc(L("Moyen de paiement", "وسيلة الأداء", "Payment method"))} : ${esc(method ? L(method.fr, method.ar, method.en) : p.method)}${p.reference ? ` · ${esc(L("réf.", "مرجع", "ref."))} <span class="ltr">${esc(p.reference)}</span>` : ""}</p>
${p.refunded_at
    ? `<div class="stamp refund">${esc(L("Remboursé le", "مسترجع في", "Refunded on"))} ${esc(fmtDate(p.refunded_at, lang))}</div>${p.refund_reason ? `<p class="muted">${esc(p.refund_reason)}</p>` : ""}`
    : `<div class="stamp">${esc(L("Payé", "مؤدى", "Paid"))}</div>`}
${footer ? `<p class="muted" style="margin-top:24px;white-space:pre-line">${esc(footer)}</p>` : ""}
${legal ? `<p class="muted" style="margin-top:8px;border-top:1px solid #ddd;padding-top:8px;white-space:pre-line;font-size:11px">${esc(legal)}</p>` : ""}
<p class="muted" style="font-size:11px">${esc(L("Document édité le", "حرر في", "Issued on"))} ${esc(new Date().toLocaleDateString(locale))}</p>
<script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
}

import { useEffect, useState } from "react";
import { Copy, Gift, Printer, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { copyText, PAYMENT_METHODS } from "@/views/admin/adminShared";
import { printInvoice } from "@/lib/invoicePrint";

const db = supabase as any;
type LFn = (fr: string, ar: string, en: string) => string;

/** « Mes paiements » : historique et factures à télécharger */
export function MyPayments({ user, L, lang, fmt, fmtPrice }: {
  user: { id: string; name: string; email?: string | null };
  L: LFn;
  lang: "fr" | "ar" | "en";
  fmt: (d: string | null | undefined) => string;
  fmtPrice: (n: unknown) => string;
}) {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    db.from("payments").select("*, subscriptions(starts_at, ends_at, plans(name))").eq("teacher_id", user.id).order("paid_at", { ascending: false })
      .then(({ data }: any) => setRows(data || []));
  }, [user.id]);

  if (!rows || rows.length === 0) return null;
  return (
    <section className="rounded-xl border bg-card">
      <h2 className="border-b px-5 py-3 text-sm font-semibold">{L("Mes paiements et factures", "أداءاتي وفواتيري", "My payments & invoices")}</h2>
      <ul className="divide-y">
        {rows.map(p => {
          const m = PAYMENT_METHODS.find(x => x.id === p.method);
          return (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
              <div className="min-w-0">
                <p className={`font-semibold ${p.refunded_at ? "line-through opacity-60" : ""}`}>{fmtPrice(p.amount_mad)} · {p.subscriptions?.plans?.name || "—"}</p>
                <p className="text-xs text-muted-foreground">
                  {fmt(p.paid_at)} · {m ? L(m.fr, m.ar, m.en) : p.method}{p.receipt_number ? ` · ${p.receipt_number}` : ""}
                  {p.refunded_at ? ` · ${L("remboursé", "مسترجع", "refunded")}` : ""}
                </p>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => printInvoice(p, { name: user.name, email: user.email }, p.subscriptions, lang)}>
                <Printer className="h-3.5 w-3.5" />{L("Facture", "فاتورة", "Invoice")}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** « Parrainez un collègue » : code personnel, partage WhatsApp, filleuls */
export function ReferralCard({ L, fmt }: { L: LFn; fmt: (d: string | null | undefined) => string }) {
  const { settings } = useAppSettings();
  const pay = settings.payments;
  const [code, setCode] = useState<string | null>(null);
  const [refs, setRefs] = useState<{ name: string; created_at: string; rewarded: boolean }[]>([]);

  useEffect(() => {
    if (!pay.referralEnabled) return;
    db.rpc("my_referral_code").then(({ data }: any) => setCode(data || null));
    db.rpc("my_referrals").then(({ data }: any) => setRefs(data || []));
  }, [pay.referralEnabled]);

  if (!pay.referralEnabled || !code) return null;
  const appName = settings.identity.appName || "Math infini";
  const shareText = L(
    `J'utilise ${appName} pour mes classes. Avec mon code ${code}, tu as ${pay.referralDiscountPct} % de remise sur ton abonnement : ${window.location.origin}`,
    `أستعمل ${appName} لأقسامي. برمزي ${code} تحصل على تخفيض ${pay.referralDiscountPct}٪ على اشتراكك: ${window.location.origin}`,
    `I use ${appName} for my classes. With my code ${code} you get ${pay.referralDiscountPct}% off your subscription: ${window.location.origin}`
  );
  const copy = async () => {
    if (await copyText(code)) toast.success(L("Code copié", "تم نسخ الرمز", "Code copied"));
  };

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><Gift className="h-4 w-4 text-primary" />{L("Parrainez un collègue", "ادعُ زميلا", "Refer a colleague")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {L(
          `Votre collègue a ${pay.referralDiscountPct} % de remise ; vous gagnez ${pay.referralBonusDays} jours d'abonnement quand il s'abonne.`,
          `يحصل زميلك على تخفيض ${pay.referralDiscountPct}٪؛ وتربح ${pay.referralBonusDays} يوما من الاشتراك عند اشتراكه.`,
          `Your colleague gets ${pay.referralDiscountPct}% off; you earn ${pay.referralBonusDays} days when they subscribe.`
        )}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-lg border bg-muted/40 px-3 py-2 font-mono text-base font-semibold tracking-wider" dir="ltr">{code}</span>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={copy}><Copy className="h-3.5 w-3.5" />{L("Copier", "نسخ", "Copy")}</Button>
        <Button asChild size="sm" className="gap-1.5">
          <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer"><Share2 className="h-3.5 w-3.5" />WhatsApp</a>
        </Button>
      </div>
      {refs.length > 0 && (
        <ul className="mt-3 divide-y rounded-lg border text-sm">
          {refs.map((r, i) => (
            <li key={i} className="flex justify-between gap-2 px-3 py-2">
              <span>{r.name}</span>
              <span className="text-xs text-muted-foreground">{fmt(r.created_at)} · {r.rewarded ? L("abonné ✓", "مشترك ✓", "subscribed ✓") : L("en attente", "في الانتظار", "pending")}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

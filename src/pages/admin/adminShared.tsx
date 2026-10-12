import { useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import type { SubscriptionStatus } from "@/contexts/AccessContext";
import { MODULE_LABELS, PERMISSION_LABELS } from "@/lib/permissions";

/** Client non typé pour les tables de l'administration (absentes des types générés) */
export const db = supabase as any;

export type Lang = "fr" | "ar" | "en";

export function useT() {
  const { language } = useLanguage();
  const lang = (language === "ar" || language === "en" ? language : "fr") as Lang;
  const L = useCallback((fr: string, ar: string, en: string) => (lang === "ar" ? ar : lang === "en" ? en : fr), [lang]);
  return { lang, L, rtl: lang === "ar" };
}

export const permLabel = (key: string, lang: Lang) => {
  const p = PERMISSION_LABELS[key];
  return p ? p[lang] : key;
};
export const moduleLabel = (key: string, lang: Lang) => {
  const m = MODULE_LABELS[key];
  return m ? m[lang] : key;
};

/** Appel de la fonction serveur admin-teachers : renvoie { data } ou { error } */
export async function adminInvoke(action: string, body: Record<string, unknown>): Promise<{ data?: any; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("admin-teachers", { body: { action, ...body } });
    if (error) {
      // message renvoyé par la fonction (status 4xx)
      let msg = error.message;
      try {
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === "function") {
          const j = await ctx.json();
          if (j?.error) msg = j.error;
        }
      } catch {
        /* ignore */
      }
      return { error: msg };
    }
    if (data?.error) return { error: data.error };
    return { data };
  } catch (e: any) {
    return { error: e?.message || "Erreur" };
  }
}

export const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  trial: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  grace: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  expired: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  suspended: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  none: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export function statusLabel(s: SubscriptionStatus | string | null | undefined, L: (fr: string, ar: string, en: string) => string) {
  switch (s) {
    case "active": return L("Actif", "نشط", "Active");
    case "trial": return L("Essai", "تجريبي", "Trial");
    case "grace": return L("Grâce", "مهلة", "Grace");
    case "expired": return L("Expiré", "منتهي", "Expired");
    case "suspended": return L("Suspendu", "موقوف", "Suspended");
    default: return L("Sans abonnement", "بدون اشتراك", "No subscription");
  }
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const { L } = useT();
  const s = status || "none";
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[s] || STATUS_STYLE.none}`}>
      {statusLabel(s, L)}
    </span>
  );
}

export const PERIODS: { id: string; fr: string; ar: string; en: string; days: number | null }[] = [
  { id: "month", fr: "Mensuel", ar: "شهري", en: "Monthly", days: 30 },
  { id: "quarter", fr: "Trimestriel", ar: "فصلي", en: "Quarterly", days: 91 },
  { id: "semester", fr: "Semestriel", ar: "نصف سنوي", en: "Half-yearly", days: 182 },
  { id: "school_year", fr: "Année scolaire", ar: "سنة دراسية", en: "School year", days: 300 },
  { id: "year", fr: "Annuel", ar: "سنوي", en: "Yearly", days: 365 },
  { id: "custom", fr: "Durée libre", ar: "مدة حرة", en: "Custom", days: null },
  { id: "unlimited", fr: "Sans fin", ar: "بدون نهاية", en: "Unlimited", days: null },
];

export const PAYMENT_METHODS: { id: string; fr: string; ar: string; en: string }[] = [
  { id: "transfer", fr: "Virement", ar: "تحويل بنكي", en: "Bank transfer" },
  { id: "cash", fr: "Espèces", ar: "نقدا", en: "Cash" },
  { id: "card", fr: "Carte", ar: "بطاقة", en: "Card" },
  { id: "mobile", fr: "Paiement mobile", ar: "أداء عبر الهاتف", en: "Mobile payment" },
  { id: "check", fr: "Chèque", ar: "شيك", en: "Check" },
  { id: "other", fr: "Autre", ar: "أخرى", en: "Other" },
];

export const fmtDate = (d: string | null | undefined, lang: Lang) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString(lang === "ar" ? "ar-MA" : lang === "en" ? "en-GB" : "fr-FR", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch {
    return d.slice(0, 10);
  }
};

export const fmtMoney = (n: number | string | null | undefined) => {
  const v = Number(n || 0);
  return `${v.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} MAD`;
};

/** date ISO → valeur d'un <input type="date"> */
export const toDateInput = (d: string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");
/** valeur d'un <input type="date"> → ISO (fin de journée pour une date de fin) */
export const fromDateInput = (v: string, endOfDay = false) => (v ? new Date(`${v}T${endOfDay ? "23:59:59" : "00:00:00"}`).toISOString() : null);
export const addDaysIso = (iso: string, days: number) => new Date(new Date(iso).getTime() + days * 86400000).toISOString();

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

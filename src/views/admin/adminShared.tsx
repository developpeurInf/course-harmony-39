import { useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import type { SubscriptionStatus } from "@/contexts/AccessContext";
import { MODULE_LABELS, PERMISSION_LABELS } from "@/lib/permissions";
import { toast } from "sonner";

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

/** Message d'erreur générique dans la langue courante (hors composant React) */
export const genericError = () => {
  const l = typeof document !== "undefined" ? document.documentElement.lang : "fr";
  return l === "ar" ? "خطأ" : l === "en" ? "Error" : "Erreur";
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
    return { error: e?.message || genericError() };
  }
}

export const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  trial: "bg-accent text-primary  ",
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
    // colonne « date » (AAAA-MM-JJ) : jour local, sans décalage UTC
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
    const x = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(d);
    if (isNaN(x.getTime())) return d.slice(0, 10);
    return x.toLocaleDateString(lang === "ar" ? "ar-MA" : lang === "en" ? "en-GB" : "fr-FR", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch {
    return d.slice(0, 10);
  }
};

/** Montant en dirhams, formaté selon la langue (ar : « درهم », ar-MA ; en : « MAD », en-GB ; fr : « MAD », fr-FR) */
export const fmtMoney = (n: number | string | null | undefined, lang: Lang = "fr") => {
  const v = Number(n || 0);
  const locale = lang === "ar" ? "ar-MA" : lang === "en" ? "en-GB" : "fr-FR";
  let txt: string;
  try {
    txt = v.toLocaleString(locale, { maximumFractionDigits: 2 });
  } catch {
    txt = String(Math.round(v * 100) / 100);
  }
  return lang === "ar" ? `${txt} درهم` : `${txt} MAD`;
};

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
/** Date locale → « AAAA-MM-JJ » (jour du fuseau de l'appareil, pas UTC) */
export const localDateStr = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** date ISO → valeur d'un <input type="date"> (date LOCALE, cohérente avec fromDateInput) */
export const toDateInput = (d: string | null | undefined) => {
  if (!d) return "";
  const x = new Date(d);
  return isNaN(x.getTime()) ? "" : localDateStr(x);
};
/** valeur d'un <input type="date"> → ISO (minuit local, ou fin de journée locale pour une date de fin) */
export const fromDateInput = (v: string, endOfDay = false) => {
  if (!v) return null;
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return null;
  // constructeur numérique : toujours interprété en heure locale (y compris iOS 12)
  return new Date(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0).toISOString();
};
/** Ajoute des jours CALENDAIRES en heure locale (l'heure locale est conservée, même en cas de changement d'heure) */
export const addDaysIso = (iso: string, days: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

/** Date de fin INCLUSIVE (valeur d'input) d'une durée de `days` jours commençant le jour `startInput` :
 *  30 jours à partir du 13/10 → fin le 11/11 à 23:59:59 (exactement 30 jours, pas 31) */
export const endDateInput = (startInput: string, days: number) => {
  const [y, m, d] = (startInput || "").split("-").map(Number);
  const base = y && m && d ? new Date(y, m - 1, d) : new Date();
  base.setDate(base.getDate() + Math.max(1, days) - 1);
  return localDateStr(base);
};

/** Copie dans le presse-papiers ; repli execCommand pour les navigateurs anciens / contexte non sécurisé (iOS 12) */
export async function copyText(text: string): Promise<boolean> {
  try {
    const nav: any = typeof navigator !== "undefined" ? navigator : null;
    if (nav && nav.clipboard && typeof nav.clipboard.writeText === "function" && (window as any).isSecureContext !== false) {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* repli ci-dessous */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    // hors écran mais sélectionnable (iOS exige un élément éditable, police ≥ 16px pour éviter le zoom)
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.width = "1px";
    ta.style.height = "1px";
    ta.style.opacity = "0";
    ta.style.fontSize = "16px";
    document.body.appendChild(ta);
    ta.contentEditable = "true";
    ta.readOnly = false;
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Copie + toast traduit */
export async function copyWithToast(text: string, L: (fr: string, ar: string, en: string) => string): Promise<boolean> {
  const ok = await copyText(text);
  if (ok) toast.success(L("Copié", "تم النسخ", "Copied"));
  else toast.error(L("Copie impossible : sélectionnez le texte", "تعذر النسخ: حدد النص يدويا", "Copy failed: select the text"));
  return ok;
}

/** « J-12 » traduit */
export const daysLeftLabel = (n: number, L: (fr: string, ar: string, en: string) => string) =>
  L(`J-${n}`, `متبقي ${n} يوم`, `D-${n}`);

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

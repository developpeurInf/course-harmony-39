/**
 * Personnalisation centrale de l'application (réglée par l'administration).
 *
 * Une seule ligne `public.app_settings` (id = 1, colonne `data` jsonb) contient
 * tous les réglages. Ce module définit leur forme, les valeurs par défaut (= le
 * comportement actuel de l'application), la fusion avec ce qui est enregistré,
 * et l'application du thème (variables CSS, police, favicon, titre).
 *
 * Tout est optionnel dans la base : une clé absente = valeur par défaut.
 */

export type Lang = "fr" | "ar" | "en";
export type I18nText = { fr: string; ar: string; en: string };

export type FontChoice = "system" | "inter" | "cairo" | "tajawal" | "poppins" | "nunito";
export type ThemeMode = "light" | "dark" | "system";
export type AttemptRule = "last" | "best" | "first" | "average";

export type FeatureKey =
  | "diagnostic"
  | "reports"
  | "notifications"
  | "exercises"
  | "exams"
  | "studentActivities"
  | "courses"
  | "bottomNav";

export interface AppSettings {
  identity: {
    appName: string;          // « Math infini »
    shortName: string;        // affiché sur les petits écrans / l'icône
    tagline: I18nText;        // sous-titre (barre latérale, connexion)
    logoUrl: string | null;   // logo carré (barre latérale, connexion)
    faviconUrl: string | null;
  };
  theme: {
    primary: string;          // couleur principale, hex #RRGGBB
    accent: string;           // couleur d'accent, hex
    success: string;
    danger: string;
    radius: number;           // en rem (0 à 1.5)
    font: FontChoice;
    defaultMode: ThemeMode;   // pour les nouveaux utilisateurs
  };
  texts: {
    defaultLanguage: Lang;
    loginTitle: I18nText;
    loginSubtitle: I18nText;
    loginHelpStudent: I18nText;   // aide sous le formulaire élève
    dashboardWelcome: I18nText;   // phrase sous « Bonjour, X »
    announcement: I18nText;       // bandeau d'annonce (vide = masqué)
    announcementTone: "info" | "warning" | "success";
    footer: I18nText;
    contactEmail: string;
    contactPhone: string;
    contactWhatsapp: string;
  };
  pedagogy: {
    passThreshold: number;        // sur 20
    attemptPolicy: AttemptRule;   // note retenue quand plusieurs tentatives
    gradeScale: number;           // 20 par défaut
    quizDefaults: {
      sequentialQuestions: boolean;
      allowMultipleAttempts: boolean;
      allowCorrections: boolean;
      shuffleQuestions: boolean;
      shuffleOptions: boolean;
      showResultsImmediately: boolean;
      allowReview: boolean;
      antiCheat: boolean;
      maxFocusLosses: number;
      defaultDurationMinutes: number;
    };
    teachersCanOverride: boolean; // les profs peuvent changer ces valeurs dans leurs Paramètres
  };
  reports: {
    schoolName: string;
    headerTitle: I18nText;
    headerSubtitle: I18nText;
    logoUrl: string | null;       // logo des rapports PDF et reçus (sinon logo de l'app)
    showLogo: boolean;
    footerText: I18nText;
    receiptFooter: I18nText;      // mentions des reçus de paiement
  };
  features: Record<FeatureKey, boolean>;
}

const t = (fr: string, ar: string, en: string): I18nText => ({ fr, ar, en });

export const DEFAULT_APP_SETTINGS: AppSettings = {
  identity: {
    appName: "Math infini",
    shortName: "Math ∞",
    tagline: t("Espace pédagogique", "الفضاء التربوي", "Learning space"),
    logoUrl: null,
    faviconUrl: null,
  },
  theme: {
    primary: "#2b4aca",
    accent: "#eceef9",
    success: "#208857",
    danger: "#ce2727",
    radius: 0.5,
    font: "system",
    defaultMode: "light",
  },
  texts: {
    defaultLanguage: "ar",
    loginTitle: t("Bienvenue", "مرحباً", "Welcome"),
    loginSubtitle: t("Choisissez votre type de compte pour continuer", "اختر نوع حسابك للمتابعة", "Choose your account type to continue"),
    loginHelpStudent: t(
      "Mot de passe oublié ? Demande à ton professeur de le réinitialiser.",
      "نسيت كلمة المرور؟ اطلب من أستاذك إعادة تعيينها.",
      "Forgot your password? Ask your teacher to reset it."
    ),
    dashboardWelcome: t("", "", ""),
    announcement: t("", "", ""),
    announcementTone: "info",
    footer: t("", "", ""),
    contactEmail: "",
    contactPhone: "",
    contactWhatsapp: "",
  },
  pedagogy: {
    passThreshold: 10,
    attemptPolicy: "last",
    gradeScale: 20,
    quizDefaults: {
      sequentialQuestions: false,
      allowMultipleAttempts: false,
      allowCorrections: true,
      shuffleQuestions: false,
      shuffleOptions: false,
      showResultsImmediately: true,
      allowReview: true,
      antiCheat: true,
      maxFocusLosses: 3,
      defaultDurationMinutes: 30,
    },
    teachersCanOverride: true,
  },
  reports: {
    schoolName: "",
    headerTitle: t("", "", ""),
    headerSubtitle: t("", "", ""),
    logoUrl: null,
    showLogo: true,
    footerText: t("", "", ""),
    receiptFooter: t("", "", ""),
  },
  features: {
    diagnostic: true,
    reports: true,
    notifications: true,
    exercises: true,
    exams: true,
    studentActivities: true,
    courses: true,
    bottomNav: true,
  },
};

/* ───────────── fusion (valeurs enregistrées sur les valeurs par défaut) ───────────── */

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function deepMerge<T>(base: T, patch: unknown): T {
  if (!isObj(patch) || !isObj(base)) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  Object.keys(patch).forEach((k) => {
    const b = (base as Record<string, unknown>)[k];
    const p = patch[k];
    if (p === undefined) return;
    if (isObj(b) && isObj(p)) out[k] = deepMerge(b, p);
    else if (b === undefined || p === null || typeof p === typeof b || b === null) out[k] = p;
  });
  return out as T;
}

/**
 * Valeurs par défaut de l'ancienne interface, enregistrées telles quelles quand
 * l'administration validait la page sans changer le thème : elles suivent le
 * nouveau thème par défaut au lieu de le figer.
 */
const LEGACY_THEME_DEFAULTS: Partial<Record<keyof AppSettings["theme"], unknown>> = {
  primary: "#3b82f6",
  accent: "#dbe6f5",
  success: "#16a34a",
  danger: "#dc2626",
  radius: 0.75,
};

export function mergeAppSettings(saved: unknown): AppSettings {
  const merged = deepMerge(DEFAULT_APP_SETTINGS, saved);
  const theme = { ...merged.theme };
  (Object.keys(LEGACY_THEME_DEFAULTS) as (keyof AppSettings["theme"])[]).forEach((k) => {
    const v = theme[k];
    const legacy = LEGACY_THEME_DEFAULTS[k];
    if (typeof v === "string" ? v.toLowerCase() === legacy : v === legacy) {
      (theme as Record<string, unknown>)[k] = DEFAULT_APP_SETTINGS.theme[k];
    }
  });
  return { ...merged, theme };
}

/** Texte traduit avec repli : langue demandée → français → arabe → anglais. */
export function pickText(text: I18nText | undefined | null, lang: Lang): string {
  if (!text) return "";
  return (text[lang] || text.fr || text.ar || text.en || "").trim();
}

/* ───────────── cache local (affichage immédiat au démarrage) ───────────── */

export const APP_SETTINGS_CACHE_KEY = "app-settings-cache-v1";

export function readCachedSettings(): AppSettings | null {
  try {
    const raw = localStorage.getItem(APP_SETTINGS_CACHE_KEY);
    return raw ? mergeAppSettings(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeCachedSettings(s: AppSettings) {
  try {
    localStorage.setItem(APP_SETTINGS_CACHE_KEY, JSON.stringify(s));
  } catch {
    /* stockage plein ou interdit : sans importance */
  }
}

/* ───────────── couleurs ───────────── */

export function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec((hex || "").trim());
  if (!m) return null;
  let v = m[1];
  if (v.length === 3) v = v.split("").map((c) => c + c).join("");
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

const hslStr = (c: { h: number; s: number; l: number }) => `${c.h} ${c.s}% ${c.l}%`;

/** Luminance relative WCAG d'une couleur hex (0 à 1). */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return 0.5;
  const ch = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** Contraste WCAG entre deux couleurs hex. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Texte lisible (blanc ou presque noir) sur une couleur donnée. */
export function readableOn(hex: string): string {
  return contrastRatio(hex, "#ffffff") >= 3 ? "0 0% 100%" : "222 47% 11%";
}

/* ───────────── polices ───────────── */

export const FONT_OPTIONS: Record<FontChoice, { label: string; css: string; google?: string }> = {
  system: { label: "Système", css: "" },
  inter: { label: "Inter", css: "'Inter', system-ui, sans-serif", google: "Inter:wght@400;500;600;700;800" },
  cairo: { label: "Cairo (arabe)", css: "'Cairo', system-ui, sans-serif", google: "Cairo:wght@400;500;600;700;800" },
  tajawal: { label: "Tajawal (arabe)", css: "'Tajawal', system-ui, sans-serif", google: "Tajawal:wght@400;500;700;800" },
  poppins: { label: "Poppins", css: "'Poppins', system-ui, sans-serif", google: "Poppins:wght@400;500;600;700;800" },
  nunito: { label: "Nunito", css: "'Nunito', system-ui, sans-serif", google: "Nunito:wght@400;600;700;800" },
};

/* ───────────── application du thème au document ───────────── */

const STYLE_ID = "app-settings-theme";
const FONT_LINK_ID = "app-settings-font";

export function applyAppSettings(s: AppSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const p = hexToHsl(s.theme.primary);
  const a = hexToHsl(s.theme.accent);
  const ok = hexToHsl(s.theme.success);
  const ko = hexToHsl(s.theme.danger);
  const radius = Math.max(0, Math.min(1.5, Number(s.theme.radius) || 0));

  const lines: string[] = [];
  if (p) {
    const glow = hslStr({ h: p.h, s: Math.max(0, p.s - 6), l: Math.min(92, p.l + 15) });
    const fg = readableOn(s.theme.primary);
    lines.push(
      `--primary:${hslStr(p)};--primary-foreground:${fg};--primary-glow:${glow};--ring:${hslStr(p)};`,
      `--sidebar-primary:${hslStr(p)};--sidebar-primary-foreground:${fg};--sidebar-ring:${hslStr(p)};`,
      `--gradient-primary:hsl(${hslStr(p)});`
    );
  }
  // Accent et couleurs d'état : mode clair seulement (le mode sombre garde ses teintes)
  const lightOnly: string[] = [];
  if (a) lightOnly.push(`--accent:${hslStr(a)};`);
  if (ok) lightOnly.push(`--success:${hslStr(ok)};`);
  if (ko) lightOnly.push(`--destructive:${hslStr(ko)};`);
  lines.push(`--radius:${radius}rem;`);
  const font = FONT_OPTIONS[s.theme.font] || FONT_OPTIONS.system;

  // Mode sombre : couleur principale éclaircie pour rester lisible sur fond foncé.
  const darkLines: string[] = [];
  if (p) {
    const dp = hslStr({ h: p.h, s: p.s, l: Math.min(70, Math.max(55, p.l + 6)) });
    darkLines.push(`--primary:${dp};--ring:${dp};--sidebar-primary:${dp};--sidebar-ring:${dp};`);
  }

  let css = `:root{${lines.join("")}}`;
  if (lightOnly.length) css += `:root:not(.dark){${lightOnly.join("")}}`;
  if (darkLines.length) css += `.dark{${darkLines.join("")}}`;
  if (font.css) css += `body{font-family:${font.css};}`;

  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  if (style.textContent !== css) style.textContent = css;

  // Police Google (chargée seulement si choisie)
  const existing = document.getElementById(FONT_LINK_ID) as HTMLLinkElement | null;
  if (font.google) {
    const href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`;
    if (!existing) {
      const link = document.createElement("link");
      link.id = FONT_LINK_ID;
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    } else if (existing.href !== href) existing.href = href;
  } else if (existing) existing.remove();

  // Titre de l'onglet et favicon
  if (s.identity.appName) {
    const base = s.identity.appName.trim();
    if (!document.title || /Math infini/i.test(document.title) || document.title.indexOf(base) === -1) document.title = base;
  }
  if (s.identity.faviconUrl) {
    let icon = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "icon";
      document.head.appendChild(icon);
    }
    if (icon.href !== s.identity.faviconUrl) icon.href = s.identity.faviconUrl;
  }
  root.setAttribute("data-app-font", s.theme.font);
}

/**
 * En-tête / pied des rapports imprimés et PDF (Personnalisation → Rapports).
 * Lecture hors React possible (getAppSettingsSnapshot) pour les exports.
 * Tous les champs vides = rendu d'origine (logo public/assets/header_logo.png, pas de pied).
 */
import { getAppSettingsSnapshot } from "@/contexts/AppSettingsContext";
import { DEFAULT_APP_SETTINGS, pickText, type AppSettings, type Lang } from "@/lib/appSettings";

/** Logo historique des rapports (armoiries), utilisé quand aucun logo n'est configuré. */
export const DEFAULT_REPORT_LOGO = "/assets/header_logo.png";

export interface ReportBranding {
  /** Nom de l'établissement (vide = non renseigné) */
  schoolName: string;
  /** Titre / sous-titre d'en-tête dans la langue du rapport (vides = non renseignés) */
  headerTitle: string;
  headerSubtitle: string;
  /** Logo à afficher (null = logo masqué par l'administration) */
  logoUrl: string | null;
  /** true si le logo vient de la personnalisation (et non du logo d'origine) */
  customLogo: boolean;
  /** Texte de pied de page (vide = aucun) */
  footerText: string;
}

const asLang = (l: string | null | undefined): Lang => (l === "ar" || l === "en" ? l : "fr");

export function getReportBranding(language: string | null | undefined, settings?: AppSettings): ReportBranding {
  // Hors du fournisseur (rendu détaché pour un export), useAppSettings renvoie les valeurs
  // par défaut : on lit alors la dernière personnalisation connue (cache local).
  const s = settings && settings !== DEFAULT_APP_SETTINGS ? settings : getAppSettingsSnapshot();
  const lang = asLang(language);
  const r = s.reports;
  const custom = ((r && r.logoUrl) || (s.identity && s.identity.logoUrl) || "").trim();
  const show = !r || r.showLogo !== false;
  return {
    schoolName: ((r && r.schoolName) || "").trim(),
    headerTitle: pickText(r && r.headerTitle, lang),
    headerSubtitle: pickText(r && r.headerSubtitle, lang),
    logoUrl: show ? custom || DEFAULT_REPORT_LOGO : null,
    customLogo: show && !!custom,
    footerText: pickText(r && r.footerText, lang),
  };
}

/**
 * crossOrigin à poser sur une image de rapport : « anonymous » pour une image d'un autre
 * domaine (ex. stockage Supabase, qui sert les en-têtes CORS) afin que html2canvas puisse
 * la dessiner sans « salir » le canvas ; rien pour une image du site.
 */
export function reportImgCrossOrigin(url: string | null | undefined): "anonymous" | undefined {
  if (!url) return undefined;
  if (/^(data:|blob:)/i.test(url)) return undefined;
  if (/^https?:\/\//i.test(url)) {
    try {
      if (typeof window !== "undefined" && new URL(url).origin === window.location.origin) return undefined;
    } catch {
      /* URL invalide */
    }
    return "anonymous";
  }
  return undefined;
}

/** Échappement minimal pour insérer un texte dans du HTML généré (exports en fenêtre d'impression). */
export function escapeHtml(text: string): string {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Lignes d'en-tête (établissement, titre, sous-titre) pour un export tableur ; vide = export d'origine. */
export function reportHeaderLines(b: ReportBranding): string[] {
  return [b.schoolName, b.headerTitle, b.headerSubtitle].filter((v) => !!v);
}

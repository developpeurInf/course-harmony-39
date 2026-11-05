/** Mise en page du document Word (mm) */
export interface PageSettings {
  size: "A4" | "A3" | "A5" | "Letter" | "Legal";
  orientation: "portrait" | "landscape";
  margins: { top: number; right: number; bottom: number; left: number };
  columns: 1 | 2 | 3;
  pageColor: string | null;
  watermark: string;
  header: string;
  footer: string;
  headerAlign: "left" | "center" | "right";
  footerAlign: "left" | "center" | "right";
  pageNumbers: "none" | "header" | "footer";
  defaultFont: string;
  defaultSize: number;
  lineNumbers?: boolean;
  theme?: string;
  pageBorder?: "none" | "simple" | "double" | "art";
  pageDark?: boolean;
}

export const PAGE_SIZES: Record<PageSettings["size"], { w: number; h: number; label: string }> = {
  A4: { w: 210, h: 297, label: "A4 (21 × 29,7 cm)" },
  A3: { w: 297, h: 420, label: "A3 (29,7 × 42 cm)" },
  A5: { w: 148, h: 210, label: "A5 (14,8 × 21 cm)" },
  Letter: { w: 215.9, h: 279.4, label: "Letter (21,59 × 27,94 cm)" },
  Legal: { w: 215.9, h: 355.6, label: "Legal (21,59 × 35,56 cm)" },
};

export const MARGIN_PRESETS = {
  normal: { top: 25, right: 25, bottom: 25, left: 25 },
  narrow: { top: 12.7, right: 12.7, bottom: 12.7, left: 12.7 },
  moderate: { top: 25.4, right: 19.1, bottom: 25.4, left: 19.1 },
  wide: { top: 25.4, right: 50.8, bottom: 25.4, left: 50.8 },
};

export const defaultPage = (): PageSettings => ({
  size: "A4",
  orientation: "portrait",
  margins: { ...MARGIN_PRESETS.normal },
  columns: 1,
  pageColor: null,
  watermark: "",
  header: "",
  footer: "",
  headerAlign: "center",
  footerAlign: "center",
  pageNumbers: "none",
  defaultFont: "Calibri",
  defaultSize: 11,
  theme: "office",
  pageBorder: "none",
});

/** Thèmes de document (Création → Thèmes) : polices et couleurs des titres */
export const DOC_THEMES: Record<string, { label: [string, string, string]; body: string; heading: string; h1: string; h2: string }> = {
  office: { label: ["Office", "أوفيس", "Office"], body: "Calibri", heading: "Calibri Light, Calibri", h1: "#2F5496", h2: "#2F5496" },
  classic: { label: ["Classique", "كلاسيكي", "Classic"], body: "Times New Roman", heading: "Georgia, Times New Roman", h1: "#000000", h2: "#404040" },
  modern: { label: ["Moderne", "عصري", "Modern"], body: "Segoe UI, Arial", heading: "Segoe UI Semibold, Segoe UI", h1: "#0F766E", h2: "#0D9488" },
  elegant: { label: ["Élégant", "أنيق", "Elegant"], body: "Georgia", heading: "Garamond, Georgia", h1: "#6B21A8", h2: "#7E22CE" },
  warm: { label: ["Chaleureux", "دافئ", "Warm"], body: "Verdana", heading: "Trebuchet MS, Verdana", h1: "#C2410C", h2: "#EA580C" },
  arabic: { label: ["Arabe", "عربي", "Arabic"], body: "Cairo, Tahoma", heading: "Cairo, Tahoma", h1: "#1E3A8A", h2: "#1D4ED8" },
  school: { label: ["Scolaire", "مدرسي", "School"], body: "Comic Sans MS, Arial", heading: "Arial Rounded MT Bold, Arial", h1: "#B91C1C", h2: "#15803D" },
};

export const mmToPx = (mm: number) => (mm * 96) / 25.4;

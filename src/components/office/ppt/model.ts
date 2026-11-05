/** PowerPoint : modèle de présentation, thèmes, dispositions et modèles */
import type { Tr } from "../shared/useOfficeEnv";

export type ShapeKind =
  | "rect" | "roundRect" | "ellipse" | "triangle" | "rtTriangle" | "diamond" | "pentagon" | "hexagon" | "octagon" | "star5" | "star6"
  | "rightArrow" | "leftArrow" | "upArrow" | "downArrow" | "chevron" | "heart" | "plus" | "parallelogram" | "trapezoid" | "callout" | "cloud" | "moon" | "lightning";

export type AnimType = "none" | "appear" | "fade" | "flyBottom" | "flyLeft" | "flyRight" | "zoom" | "bounce" | "spin" | "wipe" | "pulse";
export type TransType = "none" | "fade" | "push" | "wipe" | "zoom" | "cover" | "flip" | "split" | "reveal" | "morph";

export interface SlideEl {
  id: string;
  kind: "text" | "shape" | "image" | "table" | "line" | "video";
  x: number; y: number; w: number; h: number;
  rot?: number;
  html?: string;
  shape?: ShapeKind;
  fill?: string | null;
  stroke?: string | null;
  strokeW?: number;
  dash?: "solid" | "dash" | "dot";
  opacity?: number;
  shadow?: boolean;
  radius?: number;
  font?: string;
  size?: number; // pt
  color?: string;
  bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean;
  align?: "left" | "center" | "right" | "justify";
  valign?: "top" | "middle" | "bottom";
  lineHeight?: number;
  dir?: "rtl" | "ltr";
  autofit?: boolean;
  src?: string;
  crop?: "none" | "circle" | "rounded";
  table?: { rows: string[][]; header: boolean; style: string };
  arrow?: boolean;
  url?: string;
  anim?: { type: AnimType; order: number; dur: number };
  ph?: "title" | "subtitle" | "body";
  locked?: boolean;
}

export interface Slide {
  id: string;
  layout: string;
  bg?: { color?: string; gradient?: [string, string, number]; image?: string } | null;
  els: SlideEl[];
  notes: string;
  transition: { type: TransType; dur: number };
  hidden?: boolean;
}

export interface Deck {
  w: number;
  h: number;
  theme: string;
  slides: Slide[];
  footer?: { text: string; number: boolean; date: boolean };
}

export interface Theme {
  id: string;
  name: [string, string, string];
  bg: string;
  title: string;
  text: string;
  accents: string[];
  headFont: string;
  bodyFont: string;
  deco?: "bar" | "corner" | "band" | "circles" | "chalk" | "grid" | "wave" | "none";
}

export const THEMES: Theme[] = [
  { id: "white", name: ["Blanc", "أبيض", "White"], bg: "#FFFFFF", title: "#1F1F1F", text: "#404040", accents: ["#4472C4", "#ED7D31", "#A5A5A5", "#FFC000", "#5B9BD5", "#70AD47"], headFont: "Calibri Light", bodyFont: "Calibri", deco: "none" },
  { id: "office", name: ["Office", "أوفيس", "Office"], bg: "#FFFFFF", title: "#C43E1C", text: "#262626", accents: ["#C43E1C", "#2B579A", "#217346", "#FFC000", "#7030A0", "#00B0F0"], headFont: "Segoe UI Semibold", bodyFont: "Segoe UI", deco: "bar" },
  { id: "dark", name: ["Sombre", "داكن", "Dark"], bg: "#1E1E1E", title: "#FFFFFF", text: "#D9D9D9", accents: ["#4FC3F7", "#FFB74D", "#81C784", "#E57373", "#BA68C8", "#FFF176"], headFont: "Segoe UI Light", bodyFont: "Segoe UI", deco: "corner" },
  { id: "ocean", name: ["Océan", "محيط", "Ocean"], bg: "linear-gradient(135deg,#0B3D91 0%,#1E88E5 100%)", title: "#FFFFFF", text: "#E3F2FD", accents: ["#FFD54F", "#4DD0E1", "#FFFFFF", "#FF8A65", "#AED581", "#CE93D8"], headFont: "Montserrat, Segoe UI", bodyFont: "Segoe UI", deco: "wave" },
  { id: "forest", name: ["Forêt", "غابة", "Forest"], bg: "#F4F9F4", title: "#1B5E20", text: "#2E3B2E", accents: ["#2E7D32", "#8BC34A", "#FFB300", "#00897B", "#6D4C41", "#43A047"], headFont: "Georgia", bodyFont: "Verdana", deco: "band" },
  { id: "sunset", name: ["Coucher de soleil", "غروب", "Sunset"], bg: "linear-gradient(135deg,#FF7E5F 0%,#FEB47B 100%)", title: "#FFFFFF", text: "#FFF8F0", accents: ["#6A1B9A", "#FFFFFF", "#FFD54F", "#D84315", "#00838F", "#AD1457"], headFont: "Trebuchet MS", bodyFont: "Trebuchet MS", deco: "circles" },
  { id: "ion", name: ["Ion", "أيون", "Ion"], bg: "#0F4C5C", title: "#FFFFFF", text: "#E0F2F1", accents: ["#5FD3C6", "#FFB703", "#FB8500", "#8ECAE6", "#E76F51", "#FFFFFF"], headFont: "Century Gothic, Segoe UI", bodyFont: "Century Gothic, Segoe UI", deco: "bar" },
  { id: "chalk", name: ["Tableau noir", "سبورة", "Chalkboard"], bg: "#2F4F3E", title: "#FFFDE7", text: "#F1F8E9", accents: ["#FFF59D", "#80DEEA", "#F48FB1", "#FFFFFF", "#A5D6A7", "#FFCC80"], headFont: "Comic Sans MS, Segoe Print", bodyFont: "Comic Sans MS, Segoe Print", deco: "chalk" },
  { id: "paper", name: ["Papier", "ورق", "Paper"], bg: "#FBF7EF", title: "#5D4037", text: "#4E342E", accents: ["#8D6E63", "#C0A16B", "#6D8B74", "#B85C38", "#3E5C76", "#E0C097"], headFont: "Garamond, Georgia", bodyFont: "Georgia", deco: "none" },
  { id: "math", name: ["Géométrie", "هندسة", "Geometry"], bg: "#FFFFFF", title: "#283593", text: "#263238", accents: ["#3949AB", "#E53935", "#43A047", "#FB8C00", "#8E24AA", "#00ACC1"], headFont: "Cambria, Georgia", bodyFont: "Calibri", deco: "grid" },
  { id: "violet", name: ["Améthyste", "جمشت", "Amethyst"], bg: "linear-gradient(160deg,#2A0845 0%,#6441A5 100%)", title: "#FFFFFF", text: "#EDE7F6", accents: ["#F8BBD0", "#B39DDB", "#80CBC4", "#FFE082", "#FFFFFF", "#90CAF9"], headFont: "Segoe UI Light", bodyFont: "Segoe UI", deco: "circles" },
  { id: "arabic", name: ["Arabesque", "أرابيسك", "Arabesque"], bg: "#FFFDF7", title: "#004D40", text: "#263238", accents: ["#00695C", "#C9A227", "#8D1B3D", "#1565C0", "#558B2F", "#6D4C41"], headFont: "Cairo, Tahoma", bodyFont: "Cairo, Tahoma", deco: "band" },
];
export const themeOf = (id: string) => THEMES.find((t) => t.id === id) || THEMES[0];

export const uid = () => Math.random().toString(36).slice(2, 10);

export const LAYOUTS = ["title", "titleContent", "section", "twoContent", "comparison", "titleOnly", "blank", "pictureCaption", "quote", "bigNumber"] as const;
export type LayoutId = (typeof LAYOUTS)[number];

export function layoutLabel(id: string, L: Tr) {
  const m: Record<string, string> = {
    title: L("Diapositive de titre", "شريحة عنوان", "Title slide"),
    titleContent: L("Titre et contenu", "عنوان ومحتوى", "Title and content"),
    section: L("En-tête de section", "رأس مقطع", "Section header"),
    twoContent: L("Deux contenus", "محتويان", "Two content"),
    comparison: L("Comparaison", "مقارنة", "Comparison"),
    titleOnly: L("Titre seul", "عنوان فقط", "Title only"),
    blank: L("Vide", "فارغة", "Blank"),
    pictureCaption: L("Image avec légende", "صورة مع تسمية", "Picture with caption"),
    quote: L("Citation", "اقتباس", "Quote"),
    bigNumber: L("Chiffre clé", "رقم بارز", "Big number"),
  };
  return m[id] || id;
}

const txt = (p: Partial<SlideEl>): SlideEl => ({ id: uid(), kind: "text", x: 0, y: 0, w: 100, h: 50, fill: null, stroke: null, ...p });
const bullets = (items: string[]) => `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;

export function makeSlide(layout: string, deck: Pick<Deck, "w" | "h">, L: Tr, content?: { title?: string; sub?: string; body?: string[]; body2?: string[] }): Slide {
  const { w, h } = deck;
  const m = 60;
  const T = content?.title ?? "";
  const els: SlideEl[] = [];
  const ph = (p: "title" | "subtitle" | "body") => ({ ph: p });
  switch (layout) {
    case "title":
      els.push(txt({ ...ph("title"), x: m, y: h * 0.3, w: w - 2 * m, h: h * 0.22, size: 44, align: "center", valign: "bottom", html: T, bold: false }));
      els.push(txt({ ...ph("subtitle"), x: m * 2, y: h * 0.55, w: w - 4 * m, h: h * 0.14, size: 22, align: "center", valign: "top", html: content?.sub ?? "" }));
      break;
    case "section":
      els.push(txt({ ...ph("title"), x: m, y: h * 0.38, w: w - 2 * m, h: h * 0.2, size: 40, align: "left", valign: "bottom", html: T }));
      els.push(txt({ ...ph("subtitle"), x: m, y: h * 0.6, w: w - 2 * m, h: h * 0.12, size: 20, align: "left", valign: "top", html: content?.sub ?? "" }));
      break;
    case "twoContent":
    case "comparison": {
      els.push(txt({ ...ph("title"), x: m, y: 30, w: w - 2 * m, h: 90, size: 36, valign: "middle", html: T }));
      const top = layout === "comparison" ? 175 : 140;
      const colW = (w - 2 * m - 30) / 2;
      if (layout === "comparison") {
        els.push(txt({ x: m, y: 128, w: colW, h: 42, size: 22, bold: true, html: L("Avant", "قبل", "Before") }));
        els.push(txt({ x: m + colW + 30, y: 128, w: colW, h: 42, size: 22, bold: true, html: L("Après", "بعد", "After") }));
      }
      els.push(txt({ ...ph("body"), x: m, y: top, w: colW, h: h - top - 40, size: 20, html: bullets(content?.body ?? [""]) }));
      els.push(txt({ ...ph("body"), x: m + colW + 30, y: top, w: colW, h: h - top - 40, size: 20, html: bullets(content?.body2 ?? [""]) }));
      break;
    }
    case "titleOnly":
      els.push(txt({ ...ph("title"), x: m, y: 30, w: w - 2 * m, h: 90, size: 36, valign: "middle", html: T }));
      break;
    case "pictureCaption":
      els.push(txt({ ...ph("title"), x: m, y: h * 0.15, w: w * 0.32, h: 100, size: 30, valign: "bottom", html: T }));
      els.push(txt({ ...ph("body"), x: m, y: h * 0.15 + 110, w: w * 0.32, h: h * 0.5, size: 16, html: content?.sub ?? "" }));
      els.push({ id: uid(), kind: "shape", shape: "rect", x: w * 0.42, y: h * 0.1, w: w * 0.52, h: h * 0.8, fill: "#D9D9D9", stroke: null, html: `<p style="text-align:center">${L("Insérez une image", "أدرج صورة", "Insert a picture")}</p>`, color: "#7F7F7F", size: 18, valign: "middle", align: "center" });
      break;
    case "quote":
      els.push(txt({ x: m * 1.5, y: h * 0.18, w: w - 3 * m, h: h * 0.45, size: 34, italic: true, align: "center", valign: "middle", html: content?.title ?? `« ${L("Votre citation ici", "اقتباسك هنا", "Your quote here")} »` }));
      els.push(txt({ ...ph("subtitle"), x: m * 1.5, y: h * 0.68, w: w - 3 * m, h: 50, size: 20, align: "center", html: content?.sub ?? `— ${L("Auteur", "المؤلف", "Author")}` }));
      break;
    case "bigNumber":
      els.push(txt({ x: m, y: h * 0.18, w: w - 2 * m, h: h * 0.4, size: 120, bold: true, align: "center", valign: "middle", html: content?.title ?? "87 %", color: "accent" }));
      els.push(txt({ ...ph("subtitle"), x: m, y: h * 0.62, w: w - 2 * m, h: 70, size: 24, align: "center", html: content?.sub ?? L("de réussite au contrôle", "نسبة النجاح في الفرض", "pass rate") }));
      break;
    case "blank":
      break;
    default:
      els.push(txt({ ...ph("title"), x: m, y: 30, w: w - 2 * m, h: 90, size: 36, valign: "middle", html: T }));
      els.push(txt({ ...ph("body"), x: m, y: 135, w: w - 2 * m, h: h - 175, size: 22, html: bullets(content?.body ?? [""]) }));
  }
  return { id: uid(), layout, els, notes: "", transition: { type: "none", dur: 0.7 } };
}

export function phPlaceholder(el: SlideEl, L: Tr) {
  if (el.ph === "title") return L("Cliquez pour ajouter un titre", "انقر لإضافة عنوان", "Click to add title");
  if (el.ph === "subtitle") return L("Cliquez pour ajouter un sous-titre", "انقر لإضافة عنوان فرعي", "Click to add subtitle");
  if (el.ph === "body") return L("Cliquez pour ajouter du texte", "انقر لإضافة نص", "Click to add text");
  return "";
}

export function blankDeck(L: Tr, theme = "office", ratio: "16:9" | "4:3" = "16:9"): Deck {
  const d: Deck = { w: 960, h: ratio === "16:9" ? 540 : 720, theme, slides: [] };
  d.slides.push(makeSlide("title", d, L));
  return d;
}

export function pptTemplates(L: Tr) {
  return [
    { id: "blank", label: L("Présentation vide", "عرض فارغ", "Blank presentation"), theme: "white" },
    { id: "lesson", label: L("Cours de maths", "درس رياضيات", "Math lesson"), theme: "math" },
    { id: "chalk", label: L("Tableau noir", "سبورة", "Chalkboard"), theme: "chalk" },
    { id: "pitch", label: L("Présentation de projet", "عرض مشروع", "Project pitch"), theme: "ocean" },
    { id: "dark", label: L("Conférence", "محاضرة", "Talk"), theme: "dark" },
    { id: "arabic", label: L("Présentation en arabe", "عرض بالعربية", "Arabic deck"), theme: "arabic" },
    { id: "sunset", label: L("Atelier", "ورشة", "Workshop"), theme: "sunset" },
    { id: "violet", label: L("Améthyste", "جمشت", "Amethyst"), theme: "violet" },
  ];
}

export function buildPptTemplate(id: string, L: Tr): Deck {
  const t = pptTemplates(L).find((x) => x.id === id);
  const d: Deck = { w: 960, h: 540, theme: t?.theme || "white", slides: [] };
  const add = (layout: string, c?: Parameters<typeof makeSlide>[3], trans: TransType = "fade") => {
    const s = makeSlide(layout, d, L, c);
    s.transition = { type: id === "blank" ? "none" : trans, dur: 0.7 };
    d.slides.push(s);
    return s;
  };
  if (id === "blank") { add("title"); return d; }
  if (id === "lesson" || id === "chalk") {
    add("title", { title: L("Le théorème de Pythagore", "مبرهنة فيثاغورس", "Pythagorean theorem"), sub: L("3e année du collège", "السنة الثالثة إعدادي", "Grade 9") });
    add("titleContent", { title: L("Objectifs", "الأهداف", "Goals"), body: [L("Connaître l'énoncé du théorème", "معرفة نص المبرهنة", "Know the theorem"), L("Calculer une longueur", "حساب طول", "Compute a length"), L("Démontrer qu'un triangle est rectangle", "إثبات أن مثلثا قائم الزاوية", "Prove a right triangle")] });
    const s = add("titleContent", { title: L("L'énoncé", "النص", "Statement"), body: [L("Si ABC est rectangle en A, alors BC² = AB² + AC²", "إذا كان ABC قائم الزاوية في A فإن BC² = AB² + AC²", "If ABC is right-angled at A, then BC² = AB² + AC²")] });
    s.els.push({ id: uid(), kind: "shape", shape: "rtTriangle", x: 620, y: 260, w: 240, h: 180, fill: "accent2", stroke: null, opacity: 0.85, anim: { type: "zoom", order: 1, dur: 0.6 } });
    add("twoContent", { title: L("Exemple", "مثال", "Example"), body: ["AB = 3 cm", "AC = 4 cm"], body2: ["BC² = 9 + 16 = 25", "BC = 5 cm"] }, "push");
    add("bigNumber", { title: "3² + 4² = 5²", sub: L("Le triplet pythagoricien le plus célèbre", "أشهر ثلاثية فيثاغورسية", "The most famous Pythagorean triple") }, "zoom");
    add("section", { title: L("À vous de jouer !", "حان دورك!", "Your turn!"), sub: L("Exercices 1 à 4 page 112", "التمارين من 1 إلى 4 صفحة 112", "Exercises 1–4 page 112") });
    return d;
  }
  if (id === "arabic") {
    add("title", { title: "عنوان العرض التقديمي", sub: "الاسم · التاريخ" });
    add("titleContent", { title: "المحاور", body: ["المحور الأول", "المحور الثاني", "المحور الثالث"] });
    add("comparison", { title: "مقارنة", body: ["نقطة 1", "نقطة 2"], body2: ["نقطة 1", "نقطة 2"] });
    add("quote", { title: "« اطلبوا العلم من المهد إلى اللحد »", sub: "— قول مأثور" });
    d.slides.forEach((s) => s.els.forEach((e) => { if (e.kind === "text") e.dir = "rtl"; }));
    return d;
  }
  add("title", { title: L("Titre de la présentation", "عنوان العرض", "Presentation title"), sub: L("Sous-titre · Nom · Date", "عنوان فرعي · الاسم · التاريخ", "Subtitle · Name · Date") });
  add("titleContent", { title: L("Ordre du jour", "جدول الأعمال", "Agenda"), body: [L("Contexte", "السياق", "Context"), L("Proposition", "الاقتراح", "Proposal"), L("Calendrier", "الجدول الزمني", "Timeline"), L("Questions", "أسئلة", "Questions")] });
  add("bigNumber");
  add("comparison", { title: L("Avant / Après", "قبل / بعد", "Before / After"), body: ["…"], body2: ["…"] }, "push");
  add("quote");
  add("section", { title: L("Merci !", "شكرا!", "Thank you!"), sub: L("Des questions ?", "أسئلة؟", "Questions?") });
  return d;
}

/** Couleur d'un élément : « accent », « accent2 »… renvoient aux couleurs du thème */
export function resolveColor(c: string | null | undefined, theme: Theme, fallback?: string): string | undefined {
  if (!c) return fallback;
  const m = c.match(/^accent(\d)?$/);
  if (m) return theme.accents[(Number(m[1] || 1) - 1) % theme.accents.length];
  if (c === "text") return theme.text;
  if (c === "title") return theme.title;
  return c;
}

/** Contour SVG de chaque forme (repère 0..100) */
export function shapePath(k: ShapeKind | undefined, w: number, h: number, r = 12): string {
  const P = (pts: number[][]) => `M${pts.map((p) => `${(p[0] * w) / 100},${(p[1] * h) / 100}`).join("L")}Z`;
  switch (k) {
    case "roundRect": { const rr = Math.min(r, w / 2, h / 2); return `M${rr},0H${w - rr}A${rr},${rr} 0 0 1 ${w},${rr}V${h - rr}A${rr},${rr} 0 0 1 ${w - rr},${h}H${rr}A${rr},${rr} 0 0 1 0,${h - rr}V${rr}A${rr},${rr} 0 0 1 ${rr},0Z`; }
    case "ellipse": return `M0,${h / 2}A${w / 2},${h / 2} 0 1 0 ${w},${h / 2}A${w / 2},${h / 2} 0 1 0 0,${h / 2}Z`;
    case "triangle": return P([[50, 0], [100, 100], [0, 100]]);
    case "rtTriangle": return P([[0, 0], [0, 100], [100, 100]]);
    case "diamond": return P([[50, 0], [100, 50], [50, 100], [0, 50]]);
    case "pentagon": return P([[50, 0], [100, 38], [81, 100], [19, 100], [0, 38]]);
    case "hexagon": return P([[25, 0], [75, 0], [100, 50], [75, 100], [25, 100], [0, 50]]);
    case "octagon": return P([[29, 0], [71, 0], [100, 29], [100, 71], [71, 100], [29, 100], [0, 71], [0, 29]]);
    case "star5": return P([[50, 0], [61, 35], [98, 35], [68, 57], [79, 91], [50, 70], [21, 91], [32, 57], [2, 35], [39, 35]]);
    case "star6": return P([[50, 0], [62, 25], [93, 25], [75, 50], [93, 75], [62, 75], [50, 100], [38, 75], [7, 75], [25, 50], [7, 25], [38, 25]]);
    case "rightArrow": return P([[0, 25], [65, 25], [65, 0], [100, 50], [65, 100], [65, 75], [0, 75]]);
    case "leftArrow": return P([[100, 25], [35, 25], [35, 0], [0, 50], [35, 100], [35, 75], [100, 75]]);
    case "upArrow": return P([[25, 100], [25, 35], [0, 35], [50, 0], [100, 35], [75, 35], [75, 100]]);
    case "downArrow": return P([[25, 0], [75, 0], [75, 65], [100, 65], [50, 100], [0, 65], [25, 65]]);
    case "chevron": return P([[0, 0], [75, 0], [100, 50], [75, 100], [0, 100], [25, 50]]);
    case "plus": return P([[35, 0], [65, 0], [65, 35], [100, 35], [100, 65], [65, 65], [65, 100], [35, 100], [35, 65], [0, 65], [0, 35], [35, 35]]);
    case "parallelogram": return P([[25, 0], [100, 0], [75, 100], [0, 100]]);
    case "trapezoid": return P([[20, 0], [80, 0], [100, 100], [0, 100]]);
    case "callout": return P([[0, 0], [100, 0], [100, 75], [45, 75], [25, 100], [28, 75], [0, 75]]);
    case "lightning": return P([[40, 0], [75, 0], [55, 38], [85, 38], [25, 100], [40, 55], [12, 55]]);
    case "heart": return `M${w / 2},${h}C${-w * 0.1},${h * 0.55} ${w * 0.05},${-h * 0.15} ${w / 2},${h * 0.25}C${w * 0.95},${-h * 0.15} ${w * 1.1},${h * 0.55} ${w / 2},${h}Z`;
    case "moon": return `M${w * 0.65},0A${w / 2},${h / 2} 0 1 0 ${w * 0.65},${h}A${w * 0.38},${h * 0.45} 0 1 1 ${w * 0.65},0Z`;
    case "cloud": return `M${w * 0.25},${h * 0.85}A${w * 0.2},${h * 0.22} 0 0 1 ${w * 0.18},${h * 0.42}A${w * 0.22},${h * 0.25} 0 0 1 ${w * 0.5},${h * 0.2}A${w * 0.2},${h * 0.22} 0 0 1 ${w * 0.85},${h * 0.4}A${w * 0.18},${h * 0.22} 0 0 1 ${w * 0.8},${h * 0.85}Z`;
    default: return `M0,0H${w}V${h}H0Z`;
  }
}

export const SHAPES: ShapeKind[] = ["rect", "roundRect", "ellipse", "triangle", "rtTriangle", "diamond", "pentagon", "hexagon", "octagon", "star5", "star6", "rightArrow", "leftArrow", "upArrow", "downArrow", "chevron", "plus", "parallelogram", "trapezoid", "callout", "heart", "moon", "cloud", "lightning"];

export function slideBackground(slide: Slide, theme: Theme): string {
  if (slide.bg?.image) return `center / cover no-repeat url("${slide.bg.image}")`;
  if (slide.bg?.gradient) return `linear-gradient(${slide.bg.gradient[2]}deg, ${slide.bg.gradient[0]}, ${slide.bg.gradient[1]})`;
  if (slide.bg?.color) return slide.bg.color;
  return theme.bg;
}

export function slideText(s: Slide) {
  const div = typeof document !== "undefined" ? document.createElement("div") : null;
  return s.els.map((e) => { if (!div) return ""; div.innerHTML = e.html || ""; return div.textContent || ""; }).join(" ").trim();
}

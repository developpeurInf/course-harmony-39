/**
 * Modèles de scènes du Labo 3D : chaque modèle a des réglages (paramètres) avec
 * valeurs par défaut. Les réglages « élève » restent modifiables dans la visionneuse.
 */
export type ParamValue = number | string | boolean;
export type Params = Record<string, ParamValue>;
export type Tri = { fr: string; ar: string; en: string };

export type ParamDef =
  | { key: string; type: "number"; label: Tri; min: number; max: number; step: number; def: number; student?: boolean }
  | { key: string; type: "bool"; label: Tri; def: boolean; student?: boolean }
  | { key: string; type: "select"; label: Tri; def: string; options: { v: string; label: Tri }[]; student?: boolean }
  | { key: string; type: "text"; label: Tri; def: string; multiline?: boolean; placeholder?: string; student?: boolean };

export type TemplateId = string;

export interface TemplateDef {
  id: TemplateId;
  group: "solids" | "space" | "analysis" | "proba" | "physics" | "chemistry" | "svt";
  icon: string;
  label: Tri;
  desc: Tri;
  level: string;
  params: ParamDef[];
  /** scène animée (horloge, lecture / pause) */
  animated?: boolean;
}

import { SCIENCE_TEMPLATES } from "./templatesScience";

const T = (fr: string, ar: string, en: string): Tri => ({ fr, ar, en });

const common: ParamDef[] = [
  { key: "labels", type: "bool", label: T("Noms des sommets", "أسماء الرؤوس", "Vertex labels"), def: true, student: true },
  { key: "opacity", type: "number", label: T("Transparence des faces", "شفافية الأوجه", "Face transparency"), min: 0, max: 1, step: 0.05, def: 0.35, student: true },
  { key: "axes", type: "bool", label: T("Repère (x, y, z)", "المعلم (x, y, z)", "Axes (x, y, z)"), def: false, student: true },
];
const sectionH: ParamDef = { key: "sectionH", type: "number", label: T("Section horizontale à la hauteur (0 = aucune)", "مقطع أفقي على الارتفاع (0 = بدون)", "Horizontal section at height (0 = none)"), min: 0, max: 12, step: 0.1, def: 0, student: true };
const fold: ParamDef = { key: "fold", type: "number", label: T("Patron : pliage (0 = à plat, 1 = fermé)", "النشر: الطي (0 = مسطح، 1 = مغلق)", "Net: folding (0 = flat, 1 = closed)"), min: 0, max: 1, step: 0.01, def: 1, student: true };
const showNet: ParamDef = { key: "net", type: "bool", label: T("Afficher le patron", "إظهار النشر", "Show the net"), def: false, student: true };

export const TEMPLATES: TemplateDef[] = [
  {
    id: "cube", group: "solids", icon: "🧊", level: "Collège · TC · 1re Bac",
    label: T("Cube ABCDEFGH", "مكعب ABCDEFGH", "Cube ABCDEFGH"),
    desc: T("Arêtes, diagonales, sections planes (triangle, rectangle, hexagone) et patron qui se plie.", "الأحرف والأقطار والمقاطع المستوية والنشر.", "Edges, diagonals, plane sections and a folding net."),
    params: [
      { key: "a", type: "number", label: T("Arête a", "طول الحرف a", "Edge a"), min: 1, max: 10, step: 0.5, def: 4 },
      ...common,
      { key: "diagonals", type: "bool", label: T("Diagonales [AG] et [BH]", "القطران [AG] و [BH]", "Diagonals [AG] and [BH]"), def: false, student: true },
      { key: "section", type: "select", label: T("Section plane", "مقطع مستو", "Plane section"), def: "none", student: true, options: [
        { v: "none", label: T("Aucune", "بدون", "None") },
        { v: "triangle", label: T("Triangle (B, D, E)", "مثلث (B, D, E)", "Triangle (B, D, E)") },
        { v: "rectangle", label: T("Rectangle (A, B, G, H)", "مستطيل (A, B, G, H)", "Rectangle (A, B, G, H)") },
        { v: "hexagon", label: T("Hexagone (milieux)", "سداسي (المنتصفات)", "Hexagon (midpoints)") },
      ] },
      sectionH, showNet, fold,
    ],
  },
  {
    id: "cuboid", group: "solids", icon: "📦", level: "Collège · TC",
    label: T("Pavé droit", "متوازي المستطيلات", "Cuboid"),
    desc: T("Longueur, largeur, hauteur, diagonale et sections.", "الطول والعرض والارتفاع والقطر والمقاطع.", "Length, width, height, diagonal and sections."),
    params: [
      { key: "L", type: "number", label: T("Longueur", "الطول", "Length"), min: 1, max: 12, step: 0.5, def: 6 },
      { key: "l", type: "number", label: T("Largeur", "العرض", "Width"), min: 1, max: 12, step: 0.5, def: 4 },
      { key: "h", type: "number", label: T("Hauteur", "الارتفاع", "Height"), min: 1, max: 12, step: 0.5, def: 3 },
      ...common,
      { key: "diagonals", type: "bool", label: T("Diagonale [AG] et sa longueur", "القطر [AG] وطوله", "Diagonal [AG] and its length"), def: false, student: true },
      sectionH, showNet, fold,
    ],
  },
  {
    id: "pyramid", group: "solids", icon: "🔺", level: "Collège · TC · 1re Bac",
    label: T("Pyramide à base carrée SABCD", "هرم قاعدته مربع SABCD", "Square pyramid SABCD"),
    desc: T("Hauteur, apothème, section parallèle à la base (réduction) et patron.", "الارتفاع والعامد والمقطع الموازي للقاعدة والنشر.", "Height, apothem, section parallel to the base and net."),
    params: [
      { key: "a", type: "number", label: T("Côté de la base a", "ضلع القاعدة a", "Base side a"), min: 1, max: 10, step: 0.5, def: 4 },
      { key: "h", type: "number", label: T("Hauteur h", "الارتفاع h", "Height h"), min: 1, max: 12, step: 0.5, def: 5 },
      ...common,
      { key: "height", type: "bool", label: T("Hauteur [SO] et apothème", "الارتفاع [SO] والعامد", "Height [SO] and apothem"), def: true, student: true },
      sectionH, showNet, fold,
    ],
  },
  {
    id: "tetrahedron", group: "solids", icon: "◭", level: "TC · 1re Bac · 2e Bac",
    label: T("Tétraèdre régulier ABCD", "رباعي الأوجه المنتظم ABCD", "Regular tetrahedron ABCD"),
    desc: T("Hauteur, centre de gravité de la base, sections.", "الارتفاع ومركز ثقل القاعدة والمقاطع.", "Height, base centroid, sections."),
    params: [
      { key: "a", type: "number", label: T("Arête a", "طول الحرف a", "Edge a"), min: 1, max: 10, step: 0.5, def: 5 },
      ...common,
      { key: "height", type: "bool", label: T("Hauteur issue de D", "الارتفاع المار من D", "Height from D"), def: true, student: true },
      sectionH,
    ],
  },
  {
    id: "prism", group: "solids", icon: "🔷", level: "Collège",
    label: T("Prisme droit à base triangulaire", "موشور قائم قاعدته مثلث", "Triangular right prism"),
    desc: T("Base triangle équilatéral, hauteur, patron.", "قاعدة مثلث متساوي الأضلاع والارتفاع والنشر.", "Equilateral base, height, net."),
    params: [
      { key: "a", type: "number", label: T("Côté de la base", "ضلع القاعدة", "Base side"), min: 1, max: 10, step: 0.5, def: 4 },
      { key: "h", type: "number", label: T("Hauteur", "الارتفاع", "Height"), min: 1, max: 12, step: 0.5, def: 6 },
      ...common, sectionH,
    ],
  },
  {
    id: "cylinder", group: "solids", icon: "🥫", level: "Collège",
    label: T("Cylindre de révolution", "أسطوانة دورانية", "Cylinder"),
    desc: T("Rayon, hauteur, axe et patron (rectangle + deux disques).", "الشعاع والارتفاع والمحور والنشر.", "Radius, height, axis and net."),
    params: [
      { key: "r", type: "number", label: T("Rayon r", "الشعاع r", "Radius r"), min: 0.5, max: 6, step: 0.25, def: 2 },
      { key: "h", type: "number", label: T("Hauteur h", "الارتفاع h", "Height h"), min: 1, max: 12, step: 0.5, def: 5 },
      { key: "opacity", type: "number", label: T("Transparence", "الشفافية", "Transparency"), min: 0, max: 1, step: 0.05, def: 0.45, student: true },
      { key: "axes", type: "bool", label: T("Repère", "المعلم", "Axes"), def: false, student: true },
      { key: "axis", type: "bool", label: T("Axe et rayon", "المحور والشعاع", "Axis and radius"), def: true, student: true },
      sectionH,
    ],
  },
  {
    id: "cone", group: "solids", icon: "🍦", level: "Collège · TC",
    label: T("Cône de révolution", "مخروط دوراني", "Cone"),
    desc: T("Rayon, hauteur, génératrice, section parallèle (réduction).", "الشعاع والارتفاع والمولد والمقطع الموازي.", "Radius, height, slant height, parallel section."),
    params: [
      { key: "r", type: "number", label: T("Rayon r", "الشعاع r", "Radius r"), min: 0.5, max: 6, step: 0.25, def: 2.5 },
      { key: "h", type: "number", label: T("Hauteur h", "الارتفاع h", "Height h"), min: 1, max: 12, step: 0.5, def: 6 },
      { key: "opacity", type: "number", label: T("Transparence", "الشفافية", "Transparency"), min: 0, max: 1, step: 0.05, def: 0.45, student: true },
      { key: "axes", type: "bool", label: T("Repère", "المعلم", "Axes"), def: false, student: true },
      { key: "axis", type: "bool", label: T("Hauteur et génératrice", "الارتفاع والمولد", "Height and slant"), def: true, student: true },
      sectionH,
    ],
  },
  {
    id: "sphere", group: "solids", icon: "🌐", level: "Collège · 2e Bac",
    label: T("Sphère et boule", "الفلكة والكرة", "Sphere and ball"),
    desc: T("Grand cercle, section par un plan à la distance d du centre : cercle de rayon √(r² − d²).", "الدائرة الكبرى ومقطع بمستوى على بعد d من المركز.", "Great circle, section by a plane at distance d: circle of radius √(r² − d²)."),
    params: [
      { key: "r", type: "number", label: T("Rayon r", "الشعاع r", "Radius r"), min: 1, max: 6, step: 0.25, def: 3 },
      { key: "d", type: "number", label: T("Distance du plan de section au centre", "بعد مستوى المقطع عن المركز", "Distance of the cutting plane"), min: 0, max: 6, step: 0.05, def: 1.5, student: true },
      { key: "opacity", type: "number", label: T("Transparence", "الشفافية", "Transparency"), min: 0, max: 1, step: 0.05, def: 0.3, student: true },
      { key: "axes", type: "bool", label: T("Repère", "المعلم", "Axes"), def: true, student: true },
    ],
  },
  {
    id: "space", group: "space", icon: "📐", level: "1re Bac · 2e Bac",
    label: T("Géométrie analytique dans l'espace", "الهندسة التحليلية في الفضاء", "Analytic geometry in space"),
    desc: T("Points, vecteurs, droites et plan ax + by + cz + d = 0, projection orthogonale et distance d'un point au plan.", "نقط ومتجهات ومستقيمات ومستوى، والإسقاط العمودي والمسافة.", "Points, vectors, lines and a plane, orthogonal projection and distance."),
    params: [
      { key: "points", type: "text", multiline: true, label: T("Points (un par ligne)", "النقط (واحدة في كل سطر)", "Points (one per line)"), def: "A(2, 0, 1)\nB(0, 3, 1)\nC(1, 1, 4)", placeholder: "A(1, 2, 3)" },
      { key: "vectors", type: "text", multiline: true, label: T("Vecteurs : AB, ou u(1, 0, 2) depuis l'origine", "المتجهات: AB أو u(1, 0, 2)", "Vectors: AB, or u(1, 0, 2) from origin"), def: "AB\nAC", placeholder: "AB" },
      { key: "lines", type: "text", label: T("Droites passant par deux points (ex. AB, BC)", "مستقيمات تمر من نقطتين", "Lines through two points (e.g. AB, BC)"), def: "" },
      { key: "plane", type: "text", label: T("Plan : a, b, c, d pour ax + by + cz + d = 0 (vide = aucun)", "المستوى: a, b, c, d", "Plane: a, b, c, d (empty = none)"), def: "0, 0, 1, -1" },
      { key: "project", type: "text", label: T("Projeter ce point sur le plan (nom)", "إسقاط هذه النقطة على المستوى", "Project this point on the plane"), def: "C" },
      { key: "triangle", type: "bool", label: T("Remplir le triangle ABC", "تلوين المثلث ABC", "Fill triangle ABC"), def: true, student: true },
      { key: "grid", type: "bool", label: T("Quadrillage du plan (x, y)", "شبكة المستوى (x, y)", "Grid on the (x, y) plane"), def: true, student: true },
    ],
  },
  {
    id: "surface", group: "analysis", icon: "🏔️", level: "2e Bac · supérieur",
    label: T("Surface z = f(x, y)", "السطح z = f(x, y)", "Surface z = f(x, y)"),
    desc: T("Tracer une fonction de deux variables, avec un paramètre a réglable par l'élève.", "تمثيل دالة بمتغيرين مع وسيط a.", "Plot a two-variable function with an adjustable parameter a."),
    params: [
      { key: "f", type: "text", label: T("f(x, y) =", "f(x, y) =", "f(x, y) ="), def: "a*exp(-(x^2+y^2)/4)*cos(x)*cos(y)*3", placeholder: "x^2 - y^2" },
      { key: "a", type: "number", label: T("Paramètre a", "الوسيط a", "Parameter a"), min: -5, max: 5, step: 0.1, def: 1, student: true },
      { key: "range", type: "number", label: T("x et y entre −R et R", "x و y بين −R و R", "x and y between −R and R"), min: 1, max: 10, step: 0.5, def: 5 },
      { key: "zmax", type: "number", label: T("Limiter z à ±", "حصر z في ±", "Clip z to ±"), min: 1, max: 20, step: 0.5, def: 6 },
      { key: "wire", type: "bool", label: T("Maillage", "الشبكة", "Wireframe"), def: true, student: true },
      { key: "axes", type: "bool", label: T("Repère", "المعلم", "Axes"), def: true, student: true },
    ],
  },
  {
    id: "dice", group: "proba", icon: "🎲", level: "TC · 1re Bac · 2e Bac",
    label: T("Laboratoire de probabilités : dés", "مختبر الاحتمالات: النرد", "Probability lab: dice"),
    desc: T("Lancer un ou deux dés des milliers de fois : les fréquences se rapprochent des probabilités (loi des grands nombres).", "رمي نرد أو نردين آلاف المرات: الترددات تقترب من الاحتمالات.", "Roll one or two dice thousands of times: frequencies approach probabilities."),
    params: [
      { key: "dice", type: "select", label: T("Expérience", "التجربة", "Experiment"), def: "1", student: true, options: [
        { v: "1", label: T("Un dé : face obtenue", "نرد واحد: الوجه المحصل", "One die: face") },
        { v: "2", label: T("Deux dés : somme", "نردان: المجموع", "Two dice: sum") },
      ] },
      { key: "n", type: "number", label: T("Nombre de lancers", "عدد الرميات", "Number of rolls"), min: 10, max: 20000, step: 10, def: 600, student: true },
      { key: "theory", type: "bool", label: T("Montrer les probabilités théoriques", "إظهار الاحتمالات النظرية", "Show theoretical probabilities"), def: true, student: true },
      { key: "seed", type: "number", label: T("Série (changer pour relancer)", "السلسلة (غيّر لإعادة الرمي)", "Series (change to roll again)"), min: 1, max: 9999, step: 1, def: 1, student: true },
    ],
  },
];

TEMPLATES.push(...SCIENCE_TEMPLATES);

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];

export function defaultParams(id: string): Params {
  const t = templateById(id);
  return Object.fromEntries(t.params.map((p) => [p.key, p.def]));
}

/** Réglages complets : valeurs par défaut + valeurs enregistrées (bornées) */
export function normalizeParams(id: string, raw: Params | null | undefined): Params {
  const t = templateById(id);
  const out: Params = {};
  for (const p of t.params) {
    const v = raw?.[p.key];
    if (p.type === "number") {
      const n = typeof v === "number" ? v : Number(v);
      out[p.key] = Number.isFinite(n) ? Math.min(p.max, Math.max(p.min, n)) : p.def;
    } else if (p.type === "bool") out[p.key] = typeof v === "boolean" ? v : p.def;
    else if (p.type === "select") out[p.key] = typeof v === "string" && p.options.some((o) => o.v === v) ? v : p.def;
    else out[p.key] = typeof v === "string" ? v.slice(0, 2000) : p.def;
  }
  return out;
}

export const GROUP_LABELS: Record<TemplateDef["group"], Tri> = {
  solids: T("Solides", "المجسمات", "Solids"),
  space: T("Géométrie dans l'espace", "الهندسة الفضائية", "Space geometry"),
  analysis: T("Analyse", "التحليل", "Analysis"),
  proba: T("Probabilités", "الاحتمالات", "Probability"),
  physics: T("Physique", "الفيزياء", "Physics"),
  chemistry: T("Chimie", "الكيمياء", "Chemistry"),
  svt: T("SVT", "علوم الحياة والأرض", "Life & Earth sciences"),
};

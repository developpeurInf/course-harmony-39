/**
 * Palettes de l'éditeur d'équations (façon MathType) : structures, symboles,
 * formules toutes faites et raccourcis clavier propres aux profs de maths.
 *
 * Dans un modèle, « #0 » reçoit la sélection et « #? » est une case à remplir
 * (Tab passe à la case suivante).
 */
import type { Tr } from "../../shared/useOfficeEnv";

export interface PaletteItem {
  /** LaTeX inséré */
  latex: string;
  /** LaTeX affiché sur le bouton (sinon `latex`, cases remplacées par □) */
  show?: string;
  /** info-bulle */
  tip?: string;
}

export interface Palette {
  id: string;
  label: (L: Tr) => string;
  items: PaletteItem[];
  /** boutons plus larges (formules longues) */
  wide?: boolean;
}

const sym = (s: string, tip?: string): PaletteItem => ({ latex: s, tip });

export const PALETTES: Palette[] = [
  {
    id: "struct",
    label: (L) => L("Structures", "بنيات", "Structures"),
    items: [
      { latex: "\\frac{#0}{#?}", tip: "Fraction" },
      { latex: "\\dfrac{#0}{#?}", tip: "Grande fraction" },
      { latex: "\\sqrt{#0}", tip: "Racine carrée" },
      { latex: "\\sqrt[#?]{#0}", tip: "Racine n-ième" },
      { latex: "#0^{#?}", tip: "Exposant" },
      { latex: "#0_{#?}", tip: "Indice" },
      { latex: "#0_{#?}^{#?}", tip: "Indice et exposant" },
      { latex: "\\left(#0\\right)", tip: "Parenthèses" },
      { latex: "\\left[#0\\right]", tip: "Crochets" },
      { latex: "\\left\\{#0\\right\\}", tip: "Accolades" },
      { latex: "\\left|#0\\right|", tip: "Valeur absolue" },
      { latex: "\\left\\|#0\\right\\|", tip: "Norme" },
      { latex: "\\left[#?;#?\\right]", tip: "Intervalle fermé [a ; b]" },
      { latex: "\\left]#?;#?\\right[", tip: "Intervalle ouvert ]a ; b[" },
      { latex: "\\left[#?;#?\\right[", tip: "Intervalle [a ; b[" },
      { latex: "\\left]#?;#?\\right]", tip: "Intervalle ]a ; b]" },
      { latex: "\\overline{#0}", tip: "Barre" },
      { latex: "\\overrightarrow{#0}", tip: "Vecteur" },
      { latex: "\\widehat{#0}", tip: "Angle / chapeau" },
      { latex: "\\binom{#?}{#?}", tip: "Coefficient binomial" },
      { latex: "\\begin{cases}#?\\\\#?\\end{cases}", tip: "Système de 2 équations" },
      { latex: "\\begin{cases}#?\\\\#?\\\\#?\\end{cases}", tip: "Système de 3 équations" },
      { latex: "\\begin{pmatrix}#?&#?\\\\#?&#?\\end{pmatrix}", tip: "Matrice 2×2" },
      { latex: "\\begin{pmatrix}#?&#?&#?\\\\#?&#?&#?\\\\#?&#?&#?\\end{pmatrix}", tip: "Matrice 3×3" },
      { latex: "\\begin{vmatrix}#?&#?\\\\#?&#?\\end{vmatrix}", tip: "Déterminant" },
      { latex: "\\begin{pmatrix}#?\\\\#?\\end{pmatrix}", tip: "Coordonnées d'un vecteur" },
      { latex: "\\begin{pmatrix}#?\\\\#?\\\\#?\\end{pmatrix}", tip: "Coordonnées dans l'espace" },
      { latex: "\\underbrace{#0}_{#?}", tip: "Accolade dessous" },
    ],
  },
  {
    id: "ops",
    label: (L) => L("Opérations", "عمليات", "Operators"),
    items: [
      sym("+"), sym("-"), sym("\\times", "Multiplication"), sym("\\div", "Division"), sym("\\cdot", "Point"), sym("\\pm", "Plus ou moins"), sym("\\mp"),
      sym("="), sym("\\neq", "Différent"), sym("\\approx", "Environ"), sym("\\equiv", "Congru"), sym("<"), sym(">"), sym("\\leq", "Inférieur ou égal"),
      sym("\\geq", "Supérieur ou égal"), sym("\\ll"), sym("\\gg"), sym("\\propto", "Proportionnel"), sym("\\sim"), sym("\\simeq"), sym("\\cong"),
      sym("\\parallel", "Parallèle"), sym("\\perp", "Perpendiculaire"), sym("\\circ", "Composée"), sym("\\%"), sym("^{\\circ}", "Degré"),
      sym("!", "Factorielle"), sym("\\mid", "Divise"), sym("\\wedge", "Produit vectoriel"), sym("\\ldots"), sym("\\cdots"),
    ],
  },
  {
    id: "greek",
    label: (L) => L("Grec", "يونانية", "Greek"),
    items: "alpha beta gamma delta epsilon varepsilon zeta eta theta lambda mu nu xi pi rho sigma tau varphi phi chi psi omega Gamma Delta Theta Lambda Xi Pi Sigma Phi Psi Omega"
      .split(" ").map((g) => sym(`\\${g}`)),
  },
  {
    id: "sets",
    label: (L) => L("Ensembles et logique", "مجموعات ومنطق", "Sets & logic"),
    items: [
      sym("\\mathbb{N}"), sym("\\mathbb{Z}"), sym("\\mathbb{D}"), sym("\\mathbb{Q}"), sym("\\mathbb{R}"), sym("\\mathbb{C}"),
      sym("\\mathbb{R}^{*}"), sym("\\mathbb{R}_{+}"), sym("\\mathbb{R}_{-}^{*}"), sym("\\mathbb{N}^{*}"),
      sym("\\in", "Appartient"), sym("\\notin", "N'appartient pas"), sym("\\subset", "Inclus"), sym("\\not\\subset"), sym("\\subseteq"), sym("\\cup", "Union"),
      sym("\\cap", "Intersection"), sym("\\setminus", "Privé de"), sym("\\emptyset", "Ensemble vide"), { latex: "\\left\\{#?\\right\\}", tip: "Ensemble" },
      sym("\\forall", "Quel que soit"), sym("\\exists", "Il existe"), sym("\\exists!", "Il existe un unique"), sym("\\neg", "Non"), sym("\\land", "Et"), sym("\\lor", "Ou"),
      sym("\\Rightarrow", "Implique"), sym("\\Leftarrow"), sym("\\Leftrightarrow", "Équivaut"), sym("\\mathbb{1}"),
    ],
  },
  {
    id: "calc",
    label: (L) => L("Analyse", "تحليل", "Calculus"),
    items: [
      { latex: "\\lim_{x\\to #?}#0", tip: "Limite" },
      { latex: "\\lim_{x\\to+\\infty}#0", tip: "Limite en +∞" },
      { latex: "\\lim_{x\\to-\\infty}#0", tip: "Limite en −∞" },
      { latex: "\\lim_{x\\to #?^{+}}#0", tip: "Limite à droite" },
      { latex: "\\lim_{x\\to #?^{-}}#0", tip: "Limite à gauche" },
      { latex: "\\lim_{n\\to+\\infty}u_{n}", tip: "Limite d'une suite" },
      sym("\\infty", "Infini"), sym("+\\infty"), sym("-\\infty"),
      { latex: "f'(x)", tip: "Dérivée" }, { latex: "f''(x)", tip: "Dérivée seconde" },
      { latex: "\\frac{\\mathrm{d}#?}{\\mathrm{d}x}", tip: "dy/dx" }, { latex: "\\frac{\\partial #?}{\\partial #?}", tip: "Dérivée partielle" },
      { latex: "\\int #0\\,\\mathrm{d}x", tip: "Primitive" }, { latex: "\\int_{#?}^{#?}#0\\,\\mathrm{d}x", tip: "Intégrale" },
      { latex: "\\left[#0\\right]_{#?}^{#?}", tip: "Crochet d'intégration" },
      { latex: "\\sum_{k=#?}^{#?}#0", tip: "Somme" }, { latex: "\\prod_{k=#?}^{#?}#0", tip: "Produit" },
      { latex: "u_{n}", tip: "Suite" }, { latex: "u_{n+1}", tip: "Terme suivant" }, { latex: "\\left(u_{n}\\right)_{n\\in\\mathbb{N}}", tip: "Suite (uₙ)" },
      sym("\\ln"), sym("\\log"), { latex: "e^{#?}", tip: "Exponentielle" }, sym("\\exp"), sym("\\sin"), sym("\\cos"), sym("\\tan"), sym("\\arctan"),
      { latex: "\\mathrm{D}_{f}", tip: "Domaine de définition" }, { latex: "\\mathcal{C}_{f}", tip: "Courbe de f" },
    ],
  },
  {
    id: "geo",
    label: (L) => L("Géométrie", "هندسة", "Geometry"),
    items: [
      { latex: "\\overrightarrow{AB}", tip: "Vecteur AB" }, { latex: "\\vec{u}", tip: "Vecteur u" }, { latex: "\\left\\|\\vec{u}\\right\\|", tip: "Norme" },
      { latex: "\\vec{u}\\cdot\\vec{v}", tip: "Produit scalaire" }, { latex: "\\vec{u}\\wedge\\vec{v}", tip: "Produit vectoriel" },
      { latex: "\\widehat{ABC}", tip: "Angle" }, { latex: "\\left(\\overrightarrow{AB},\\overrightarrow{AC}\\right)", tip: "Angle orienté" },
      { latex: "\\left(O;\\vec{i},\\vec{j}\\right)", tip: "Repère du plan" }, { latex: "\\left(O;\\vec{i},\\vec{j},\\vec{k}\\right)", tip: "Repère de l'espace" },
      { latex: "(AB)\\parallel(CD)", tip: "Droites parallèles" }, { latex: "(AB)\\perp(CD)", tip: "Droites perpendiculaires" },
      { latex: "[AB]", tip: "Segment" }, { latex: "AB", tip: "Longueur" }, { latex: "\\triangle ABC", tip: "Triangle" }, { latex: "\\overset{\\frown}{AB}", tip: "Arc" },
      sym("^{\\circ}", "Degré"), { latex: "\\mathrm{rad}", tip: "Radian" }, { latex: "A\\left(#?;#?\\right)", tip: "Point A(x ; y)" },
      { latex: "\\mathcal{C}\\left(O;r\\right)", tip: "Cercle" }, { latex: "z=a+ib", tip: "Nombre complexe" }, { latex: "\\left|z\\right|", tip: "Module" },
      { latex: "\\arg(z)", tip: "Argument" }, { latex: "\\overline{z}", tip: "Conjugué" }, { latex: "re^{i\\theta}", tip: "Forme exponentielle" },
    ],
  },
  {
    id: "arrows",
    label: (L) => L("Flèches", "أسهم", "Arrows"),
    items: [
      sym("\\to"), sym("\\leftarrow"), sym("\\leftrightarrow"), sym("\\Rightarrow"), sym("\\Leftarrow"), sym("\\Leftrightarrow"), sym("\\mapsto", "Associe"),
      sym("\\nearrow", "Croissante"), sym("\\searrow", "Décroissante"), sym("\\uparrow"), sym("\\downarrow"), sym("\\longrightarrow"),
      { latex: "\\xrightarrow{#?}", tip: "Flèche annotée" }, { latex: "f:#?\\to#?", tip: "Fonction f : E → F" }, { latex: "x\\mapsto #?", tip: "x ↦ …" },
    ],
  },
  {
    id: "proba",
    label: (L) => L("Probabilités", "احتمالات", "Probability"),
    items: [
      { latex: "P(#?)", tip: "Probabilité" }, { latex: "P_{#?}(#?)", tip: "Probabilité conditionnelle" }, { latex: "P\\left(A\\cap B\\right)" }, { latex: "P\\left(A\\cup B\\right)" },
      { latex: "\\overline{A}", tip: "Événement contraire" }, { latex: "\\binom{n}{k}", tip: "Combinaisons" }, { latex: "C_{n}^{p}", tip: "Combinaisons (notation marocaine)" },
      { latex: "A_{n}^{p}", tip: "Arrangements" }, { latex: "n!", tip: "Factorielle" }, { latex: "E(X)", tip: "Espérance" }, { latex: "V(X)", tip: "Variance" },
      { latex: "\\sigma(X)", tip: "Écart type" }, { latex: "\\bar{x}", tip: "Moyenne" }, { latex: "\\mathcal{B}(n;p)", tip: "Loi binomiale" },
      { latex: "\\mathcal{N}\\left(\\mu;\\sigma^{2}\\right)", tip: "Loi normale" }, { latex: "\\mathrm{card}(#?)", tip: "Cardinal" },
    ],
  },
];

/** Formules complètes, par niveau, prêtes à insérer */
export const FORMULAS: { group: (L: Tr) => string; items: { label: string; latex: string }[] }[] = [
  {
    group: (L) => L("Collège", "الإعدادي", "Middle school"),
    items: [
      { label: "Pythagore", latex: "BC^{2}=AB^{2}+AC^{2}" },
      { label: "Thalès", latex: "\\frac{AM}{AB}=\\frac{AN}{AC}=\\frac{MN}{BC}" },
      { label: "Identité 1", latex: "(a+b)^{2}=a^{2}+2ab+b^{2}" },
      { label: "Identité 2", latex: "(a-b)^{2}=a^{2}-2ab+b^{2}" },
      { label: "Identité 3", latex: "(a+b)(a-b)=a^{2}-b^{2}" },
      { label: "Puissances", latex: "a^{m}\\times a^{n}=a^{m+n}" },
      { label: "Trigonométrie", latex: "\\cos\\widehat{B}=\\frac{AB}{BC}" },
      { label: "Équation de droite", latex: "y=ax+b" },
    ],
  },
  {
    group: (L) => L("Lycée", "الثانوي", "High school"),
    items: [
      { label: "Discriminant", latex: "\\Delta=b^{2}-4ac" },
      { label: "Racines", latex: "x_{1,2}=\\frac{-b\\pm\\sqrt{\\Delta}}{2a}" },
      { label: "Forme canonique", latex: "a\\left(x+\\frac{b}{2a}\\right)^{2}-\\frac{\\Delta}{4a}" },
      { label: "Tangente", latex: "y=f'(a)(x-a)+f(a)" },
      { label: "Nombre dérivé", latex: "f'(a)=\\lim_{h\\to0}\\frac{f(a+h)-f(a)}{h}" },
      { label: "Suite arithmétique", latex: "u_{n}=u_{0}+nr" },
      { label: "Suite géométrique", latex: "u_{n}=u_{0}\\times q^{n}" },
      { label: "Somme arithm.", latex: "\\sum_{k=0}^{n}u_{k}=(n+1)\\frac{u_{0}+u_{n}}{2}" },
      { label: "Somme géom.", latex: "1+q+\\cdots+q^{n}=\\frac{1-q^{n+1}}{1-q}" },
      { label: "Trigonométrie", latex: "\\cos^{2}x+\\sin^{2}x=1" },
      { label: "Produit scalaire", latex: "\\vec{u}\\cdot\\vec{v}=xx'+yy'" },
      { label: "Distance", latex: "AB=\\sqrt{(x_{B}-x_{A})^{2}+(y_{B}-y_{A})^{2}}" },
    ],
  },
  {
    group: (L) => L("Terminale / Bac", "الباكالوريا", "Final year"),
    items: [
      { label: "Intégrale", latex: "\\int_{a}^{b}f(x)\\,\\mathrm{d}x=F(b)-F(a)" },
      { label: "IPP", latex: "\\int_{a}^{b}u'v=\\left[uv\\right]_{a}^{b}-\\int_{a}^{b}uv'" },
      { label: "Exponentielle", latex: "\\lim_{x\\to+\\infty}\\frac{e^{x}}{x}=+\\infty" },
      { label: "Logarithme", latex: "\\ln(ab)=\\ln a+\\ln b" },
      { label: "Moivre", latex: "\\left(\\cos\\theta+i\\sin\\theta\\right)^{n}=\\cos(n\\theta)+i\\sin(n\\theta)" },
      { label: "Euler", latex: "e^{i\\theta}=\\cos\\theta+i\\sin\\theta" },
      { label: "Binôme", latex: "(a+b)^{n}=\\sum_{k=0}^{n}\\binom{n}{k}a^{k}b^{n-k}" },
      { label: "Loi binomiale", latex: "P(X=k)=\\binom{n}{k}p^{k}(1-p)^{n-k}" },
      { label: "Équation différentielle", latex: "y'=ay+b" },
      { label: "Bayes", latex: "P_{B}(A)=\\frac{P_{A}(B)\\,P(A)}{P(B)}" },
    ],
  },
];

/**
 * Raccourcis tapés directement dans l'éditeur d'équations (en plus de ceux de MathLive :
 * sqrt, pi, alpha, >=, <=, !=, inf…).
 */
export const MATH_SHORTCUTS: Record<string, string> = {
  RR: "\\mathbb{R}", NN: "\\mathbb{N}", ZZ: "\\mathbb{Z}", QQ: "\\mathbb{Q}", CC: "\\mathbb{C}", DD: "\\mathbb{D}",
  racine: "\\sqrt{#?}", rac: "\\sqrt{#?}", frac: "\\frac{#?}{#?}", vec: "\\overrightarrow{#?}", angle: "\\widehat{#?}",
  lim: "\\lim_{#?\\to#?}", limp: "\\lim_{x\\to+\\infty}", limm: "\\lim_{x\\to-\\infty}", int: "\\int_{#?}^{#?}", som: "\\sum_{k=#?}^{#?}",
  ssi: "\\Leftrightarrow", "<=>": "\\Leftrightarrow", "=>": "\\Rightarrow", donc: "\\Rightarrow", appartient: "\\in", inclus: "\\subset",
  union: "\\cup", inter: "\\cap", vide: "\\emptyset", pourtout: "\\forall", existe: "\\exists", "+-": "\\pm", infini: "\\infty", inf: "\\infty",
  delta: "\\Delta", ln: "\\ln", exp: "\\exp", abs: "\\left|#?\\right|", norme: "\\left\\|#?\\right\\|", sys: "\\begin{cases}#?\\\\#?\\end{cases}",
  croit: "\\nearrow", decroit: "\\searrow", para: "\\parallel", perp: "\\perp", deg: "^{\\circ}", xx: "\\times",
};

/** Raccourcis présentés dans l'aide de l'éditeur */
export const SHORTCUT_HELP: [string, string][] = [
  ["/", "fraction"], ["^", "exposant"], ["_", "indice"], ["sqrt / racine", "√"], ["RR, NN, ZZ, QQ", "ℝ ℕ ℤ ℚ"], ["vec", "vecteur"],
  ["lim, limp, limm", "limites"], ["int, som", "∫ Σ"], [">= <= !=", "≥ ≤ ≠"], ["=> ssi", "⇒ ⇔"], ["inf / infini", "∞"], ["abs", "|x|"],
  ["sys", "système"], ["croit / decroit", "↗ ↘"], ["pi, alpha, theta…", "π α θ"], ["Tab", "case suivante"],
];

/** Remplace les cases d'un modèle par des carrés pour l'aperçu */
export const previewLatex = (s: string) => s.replace(/#0|#\?/g, "\\square");

/** Nettoie le LaTeX produit par MathLive avant de le ranger dans le document */
export const cleanLatex = (s: string) =>
  s.replace(/\\placeholder(\[[^\]]*\])?\{[^}]*\}/g, "").replace(/#\?|#0/g, "").trim();

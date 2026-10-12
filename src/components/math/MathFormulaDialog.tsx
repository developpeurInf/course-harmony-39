import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sigma, AlignCenter, AlignLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { loadKatex, renderLatexToString } from "@/lib/mathRender";
import { simpleToLatex } from "@/lib/simpleMath";

/**
 * Éditeur de formules pour les professeurs (maths, physique-chimie, SVT…).
 * - Palettes de symboles et de modèles classés par thème : un clic insère le code.
 * - Mode « Simple » (par défaut) : écriture naturelle où LES PARENTHÈSES DÉLIMITENT
 *   √(32)×5 ≠ √(32×5), (x+1)/(x−2), x^(n+1)… — aucune connaissance de LaTeX.
 * - Mode LaTeX pour ceux qui connaissent.
 * - Aperçu en direct, rendu exactement comme l'élève le verra.
 * Le résultat est inséré sous la forme $…$ (dans la ligne) ou $$…$$ (centré).
 */

type Item = { l: string; s: string; latex?: boolean };
// « § » = position du curseur après insertion
const GROUPS: { id: string; label: { fr: string; ar: string; en: string }; items: Item[] }[] = [
  {
    id: "base",
    label: { fr: "Base", ar: "أساسي", en: "Basics" },
    items: [
      { l: "\\frac{a}{b}", s: "\\frac{§}{}", latex: true },
      { l: "x^{n}", s: "^{§}", latex: true },
      { l: "x_{n}", s: "_{§}", latex: true },
      { l: "\\sqrt{x}", s: "\\sqrt{§}", latex: true },
      { l: "\\sqrt[n]{x}", s: "\\sqrt[§]{}", latex: true },
      { l: "|x|", s: "\\left|§ \\right|", latex: true },
      { l: "(\\,)", s: "\\left(§ \\right)", latex: true },
      { l: "\\pm", s: "\\pm ", latex: true },
      { l: "\\times", s: "\\times ", latex: true },
      { l: "\\div", s: "\\div ", latex: true },
      { l: "\\cdot", s: "\\cdot ", latex: true },
      { l: "\\neq", s: "\\neq ", latex: true },
      { l: "\\leq", s: "\\leq ", latex: true },
      { l: "\\geq", s: "\\geq ", latex: true },
      { l: "\\approx", s: "\\approx ", latex: true },
      { l: "\\infty", s: "\\infty ", latex: true },
      { l: "\\pi", s: "\\pi ", latex: true },
      { l: "x^{\\circ}", s: "^{\\circ}", latex: true },
      { l: "\\%", s: "\\% ", latex: true },
      { l: "\\text{abc}", s: "\\text{§}", latex: true },
    ],
  },
  {
    id: "sets",
    label: { fr: "Ensembles & logique", ar: "مجموعات ومنطق", en: "Sets & logic" },
    items: [
      { l: "\\mathbb{N}", s: "\\mathbb{N}", latex: true },
      { l: "\\mathbb{Z}", s: "\\mathbb{Z}", latex: true },
      { l: "\\mathbb{Q}", s: "\\mathbb{Q}", latex: true },
      { l: "\\mathbb{R}", s: "\\mathbb{R}", latex: true },
      { l: "\\mathbb{C}", s: "\\mathbb{C}", latex: true },
      { l: "\\in", s: "\\in ", latex: true },
      { l: "\\notin", s: "\\notin ", latex: true },
      { l: "\\subset", s: "\\subset ", latex: true },
      { l: "\\cup", s: "\\cup ", latex: true },
      { l: "\\cap", s: "\\cap ", latex: true },
      { l: "\\emptyset", s: "\\emptyset ", latex: true },
      { l: "\\forall", s: "\\forall ", latex: true },
      { l: "\\exists", s: "\\exists ", latex: true },
      { l: "\\Rightarrow", s: "\\Rightarrow ", latex: true },
      { l: "\\Leftrightarrow", s: "\\Leftrightarrow ", latex: true },
      { l: "\\{\\,\\}", s: "\\{§\\}", latex: true },
      { l: "[a;b]", s: "[§\\,;\\,]", latex: true },
      { l: "]a;b[", s: "]§\\,;\\,[", latex: true },
      { l: "\\mathbb{R}^{*}_{+}", s: "\\mathbb{R}^{*}_{+}", latex: true },
      { l: "\\overline{A}", s: "\\overline{§}", latex: true },
    ],
  },
  {
    id: "analysis",
    label: { fr: "Analyse", ar: "تحليل", en: "Calculus" },
    items: [
      { l: "\\lim_{x \\to a}", s: "\\lim_{x \\to §} ", latex: true },
      { l: "\\lim_{x\\to+\\infty}", s: "\\lim_{x \\to +\\infty} ", latex: true },
      { l: "f'(x)", s: "f'(x)", latex: true },
      { l: "f''(x)", s: "f''(x)", latex: true },
      { l: "\\frac{dy}{dx}", s: "\\frac{d§}{dx}", latex: true },
      { l: "\\int_a^b", s: "\\int_{§}^{} \\, dx", latex: true },
      { l: "\\sum_{k=0}^{n}", s: "\\sum_{k=§}^{n} ", latex: true },
      { l: "\\prod", s: "\\prod_{k=§}^{n} ", latex: true },
      { l: "\\ln", s: "\\ln(§)", latex: true },
      { l: "\\log", s: "\\log(§)", latex: true },
      { l: "e^{x}", s: "e^{§}", latex: true },
      { l: "\\to", s: "\\to ", latex: true },
      { l: "\\mapsto", s: "\\mapsto ", latex: true },
      { l: "(u_n)", s: "(u_n)_{n \\in \\mathbb{N}}", latex: true },
      { l: "u_{n+1}", s: "u_{n+1}", latex: true },
      { l: "\\binom{n}{k}", s: "\\binom{§}{}", latex: true },
      { l: "n!", s: "!", latex: true },
      { l: "C_f", s: "\\mathcal{C}_f", latex: true },
    ],
  },
  {
    id: "geo",
    label: { fr: "Géométrie", ar: "هندسة", en: "Geometry" },
    items: [
      { l: "\\overrightarrow{AB}", s: "\\overrightarrow{§}", latex: true },
      { l: "\\vec{u}", s: "\\vec{§}", latex: true },
      { l: "\\|\\vec{u}\\|", s: "\\|\\vec{§}\\|", latex: true },
      { l: "\\vec{u}\\cdot\\vec{v}", s: "\\vec{u} \\cdot \\vec{v}", latex: true },
      { l: "\\widehat{ABC}", s: "\\widehat{§}", latex: true },
      { l: "(AB)", s: "(AB)", latex: true },
      { l: "[AB]", s: "[AB]", latex: true },
      { l: "\\parallel", s: "\\parallel ", latex: true },
      { l: "\\perp", s: "\\perp ", latex: true },
      { l: "\\triangle", s: "\\triangle ", latex: true },
      { l: "\\cos", s: "\\cos(§)", latex: true },
      { l: "\\sin", s: "\\sin(§)", latex: true },
      { l: "\\tan", s: "\\tan(§)", latex: true },
      { l: "(O;\\vec{i},\\vec{j})", s: "(O;\\vec{i},\\vec{j})", latex: true },
    ],
  },
  {
    id: "greek",
    label: { fr: "Grec", ar: "حروف يونانية", en: "Greek" },
    items: ["alpha", "beta", "gamma", "delta", "Delta", "epsilon", "theta", "lambda", "mu", "rho", "sigma", "tau", "varphi", "omega", "Omega"].map(g => ({ l: `\\${g}`, s: `\\${g} `, latex: true })),
  },
  {
    id: "models",
    label: { fr: "Modèles", ar: "نماذج", en: "Templates" },
    items: [
      { l: "\\Delta = b^2-4ac", s: "\\Delta = b^2 - 4ac", latex: true },
      { l: "x=\\frac{-b\\pm\\sqrt{\\Delta}}{2a}", s: "x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}", latex: true },
      { l: "\\begin{cases}x+y=1\\\\x-y=3\\end{cases}", s: "\\begin{cases} § \\\\  \\end{cases}", latex: true },
      { l: "\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}", s: "\\begin{pmatrix} § & \\\\ & \\end{pmatrix}", latex: true },
      { l: "z=a+ib", s: "z = a + ib", latex: true },
      { l: "\\overline{z}", s: "\\overline{z}", latex: true },
      { l: "e^{i\\theta}", s: "e^{i\\theta}", latex: true },
      { l: "P(A\\cap B)", s: "P(A \\cap B)", latex: true },
      { l: "P_B(A)", s: "P_{B}(A)", latex: true },
    ],
  },
  {
    id: "science",
    label: { fr: "Physique-Chimie", ar: "فيزياء وكيمياء", en: "Physics & chemistry" },
    items: [
      { l: "\\vec{F}", s: "\\vec{F}", latex: true },
      { l: "\\Delta t", s: "\\Delta t", latex: true },
      { l: "\\text{m}\\cdot\\text{s}^{-1}", s: "\\text{m}\\cdot\\text{s}^{-1}", latex: true },
      { l: "\\text{mol}\\cdot\\text{L}^{-1}", s: "\\text{mol}\\cdot\\text{L}^{-1}", latex: true },
      { l: "\\text{H}_2\\text{O}", s: "\\text{H}_2\\text{O}", latex: true },
      { l: "\\text{CO}_2", s: "\\text{CO}_2", latex: true },
      { l: "\\rightarrow", s: "\\rightarrow ", latex: true },
      { l: "\\rightleftharpoons", s: "\\rightleftharpoons ", latex: true },
      { l: "\\Omega", s: "\\Omega", latex: true },
      { l: "10^{-3}", s: "\\times 10^{§}", latex: true },
    ],
  },
];

// Palette du mode « Simple » : l = rendu du bouton (LaTeX), s = texte inséré (§ = curseur)
const SIMPLE_GROUPS: { id: string; items: Item[] }[] = [
  {
    id: "base",
    items: [
      { l: "\\sqrt{\\square}", s: "√(§)" },
      { l: "\\frac{\\square}{\\square}", s: "(§)/()" },
      { l: "x^{\\square}", s: "^(§)" },
      { l: "x_{\\square}", s: "_(§)" },
      { l: "\\sqrt[n]{\\square}", s: "√[§]()" },
      { l: "x^{2}", s: "²" },
      { l: "x^{3}", s: "³" },
      { l: "\\left|\\square\\right|", s: "|§|" },
      { l: "(\\square)", s: "(§)" },
      { l: "\\pm", s: "±" },
      { l: "\\times", s: "×" },
      { l: "\\div", s: "÷" },
      { l: "\\cdot", s: "·" },
      { l: "\\neq", s: "≠" },
      { l: "\\leq", s: "≤" },
      { l: "\\geq", s: "≥" },
      { l: "\\approx", s: "≈" },
      { l: "\\infty", s: "∞" },
      { l: "\\pi", s: "π" },
      { l: "x^{\\circ}", s: "°" },
    ],
  },
  {
    id: "sets",
    items: [
      ..."ℕℤℚℝℂ".split("").map(c => ({ l: `\\mathbb{${({ "ℕ": "N", "ℤ": "Z", "ℚ": "Q", "ℝ": "R", "ℂ": "C" } as Record<string, string>)[c]}}`, s: c })),
      { l: "\\in", s: "∈" }, { l: "\\notin", s: "∉" }, { l: "\\subset", s: "⊂" }, { l: "\\cup", s: "∪" },
      { l: "\\cap", s: "∩" }, { l: "\\emptyset", s: "∅" }, { l: "\\forall", s: "∀" }, { l: "\\exists", s: "∃" },
      { l: "\\Rightarrow", s: "⇒" }, { l: "\\Leftrightarrow", s: "⇔" },
      { l: "\\{\\square\\}", s: "{§}" },
      { l: "[a;b]", s: "[§;]" },
      { l: "]a;b[", s: "]§;[" },
      { l: "\\mathbb{R}^{*}_{+}", s: "ℝ^*_+" },
      { l: "\\overline{A}", s: "bar(§)" },
    ],
  },
  {
    id: "analysis",
    items: [
      { l: "\\lim_{x \\to a}", s: "lim(x→§) " },
      { l: "\\lim_{x\\to+\\infty}", s: "lim(x→+∞) " },
      { l: "f'(x)", s: "f′(x)" },
      { l: "\\int_a^b", s: "∫(§,) dx" },
      { l: "\\sum_{k=0}^{n}", s: "Σ(k=§,n) " },
      { l: "\\ln", s: "ln(§)" },
      { l: "\\log", s: "log(§)" },
      { l: "e^{\\square}", s: "e^(§)" },
      { l: "\\to", s: "→" },
      { l: "\\mapsto", s: "↦" },
      { l: "u_{n+1}", s: "u_(n+1)" },
      { l: "n!", s: "!" },
    ],
  },
  {
    id: "geo",
    items: [
      { l: "\\overrightarrow{AB}", s: "vec(§)" },
      { l: "\\|\\overrightarrow{u}\\|", s: "‖vec(§)‖" },
      { l: "\\perp", s: "⊥" }, { l: "\\parallel", s: "∥" }, { l: "\\angle", s: "∠" }, { l: "\\triangle", s: "△" },
      { l: "\\cos", s: "cos(§)" }, { l: "\\sin", s: "sin(§)" }, { l: "\\tan", s: "tan(§)" },
      { l: "(AB)", s: "(AB)" }, { l: "[AB]", s: "[AB]" },
    ],
  },
  {
    id: "greek",
    items: [["alpha", "α"], ["beta", "β"], ["gamma", "γ"], ["delta", "δ"], ["Delta", "Δ"], ["varepsilon", "ε"], ["theta", "θ"], ["lambda", "λ"], ["mu", "μ"], ["rho", "ρ"], ["sigma", "σ"], ["tau", "τ"], ["varphi", "φ"], ["omega", "ω"], ["Omega", "Ω"]]
      .map(([n, c]) => ({ l: `\\${n}`, s: c })),
  },
  {
    id: "models",
    items: [
      { l: "\\Delta = b^2-4ac", s: "Δ = b² − 4ac" },
      { l: "x=\\frac{-b\\pm\\sqrt{\\Delta}}{2a}", s: "x = (−b ± √(Δ))/(2a)" },
      { l: "\\sqrt{\\frac{x+1}{x-1}}", s: "√((x+1)/(x−1))" },
      { l: "\\frac{\\sqrt{x}+1}{2}", s: "(√(x)+1)/2" },
      { l: "z=a+ib", s: "z = a + ib" },
      { l: "P(A\\cap B)", s: "P(A ∩ B)" },
      { l: "P_B(A)", s: "P_(B)(A)" },
      { l: "u_{n+1}=q\\,u_n", s: "u_(n+1) = q·u_n" },
    ],
  },
  {
    id: "science",
    items: [
      { l: "\\overrightarrow{F}", s: "vec(F)" },
      { l: "\\Delta t", s: "Δt" },
      { l: "m\\cdot s^{-1}", s: "m·s^(−1)" },
      { l: "\\text{mol}\\cdot L^{-1}", s: "mol·L^(−1)" },
      { l: "H_2O", s: "H_(2)O" },
      { l: "CO_2", s: "CO_(2)" },
      { l: "\\rightarrow", s: "→" },
      { l: "\\rightleftharpoons", s: "⇌" },
      { l: "\\Omega", s: "Ω" },
      { l: "\\times 10^{\\square}", s: "×10^(§)" },
    ],
  },
];

// Exemples affichés dans l'aide du mode Simple
const SIMPLE_EXAMPLES = ["√(32)×5", "√(32×5)", "(x+1)/(x−2)", "x^(n+1)", "√((x+1)/2)"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** reçoit le texte prêt à insérer : $…$ ou $$…$$ */
  onInsert: (wrapped: string, latex: string, display: boolean) => void;
  initialLatex?: string;
  /** les réponses (options) ne proposent que le mode « dans la ligne » */
  allowDisplay?: boolean;
}

export default function MathFormulaDialog({ open, onOpenChange, onInsert, initialLatex = "", allowDisplay = true }: Props) {
  const { language } = useLanguage();
  const lang = (language === "ar" || language === "en" ? language : "fr") as "fr" | "ar" | "en";
  const L = (fr: string, ar: string, en: string) => (lang === "ar" ? ar : lang === "en" ? en : fr);
  const [mode, setMode] = useState<"simple" | "latex">(initialLatex ? "latex" : "simple");
  const [simple, setSimple] = useState("");
  const [latex, setLatex] = useState(initialLatex);
  const [display, setDisplay] = useState(false);
  const [group, setGroup] = useState("base");
  const [katex, setKatex] = useState<any>((window as any).katex || null);
  const [loadError, setLoadError] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setLatex(initialLatex);
    setSimple("");
    setMode(initialLatex ? "latex" : "simple");
    setDisplay(false);
    loadKatex().then(k => setKatex(k)).catch(() => setLoadError(true));
  }, [open, initialLatex]);

  const value = mode === "simple" ? simple : latex;
  const setValue = mode === "simple" ? setSimple : setLatex;
  const finalLatex = useMemo(() => (mode === "simple" ? simpleToLatex(simple) : latex.trim()), [mode, simple, latex]);
  const preview = useMemo(() => (katex && finalLatex ? renderLatexToString(katex, finalLatex, display) : ""), [katex, finalLatex, display]);
  const iconHtml = useMemo(() => {
    if (!katex) return {} as Record<string, string>;
    const map: Record<string, string> = {};
    [...GROUPS, ...SIMPLE_GROUPS].forEach(g => g.items.forEach(it => { if (!map[it.l]) map[it.l] = renderLatexToString(katex, it.l, false); }));
    SIMPLE_EXAMPLES.forEach(ex => { map["ex:" + ex] = renderLatexToString(katex, simpleToLatex(ex), false); });
    return map;
  }, [katex]);

  const insertSnippet = (snippet: string) => {
    const el = areaRef.current;
    const caret = snippet.indexOf("§");
    const clean = snippet.replace("§", "");
    const start = el ? el.selectionStart : value.length;
    const end = el ? el.selectionEnd : value.length;
    const next = value.slice(0, start) + clean + value.slice(end);
    setValue(next);
    const pos = start + (caret >= 0 ? caret : clean.length);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      try { el.setSelectionRange(pos, pos); } catch { /* iOS ancien */ }
    });
  };

  const doInsert = () => {
    const v = finalLatex;
    if (!v) return;
    const d = allowDisplay && display;
    onInsert(d ? `$$${v}$$` : `$${v}$`, v, d);
    onOpenChange(false);
  };

  const baseGroup = GROUPS.find(g => g.id === group) || GROUPS[0];
  const current = mode === "simple"
    ? { ...baseGroup, items: (SIMPLE_GROUPS.find(g => g.id === baseGroup.id) || SIMPLE_GROUPS[0]).items }
    : baseGroup;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" dir="ltr">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sigma className="h-5 w-5 text-indigo-600" />
            {L("Insérer une formule", "إدراج صيغة رياضية", "Insert a formula")}
          </DialogTitle>
          <DialogDescription>
            {L(
              "Cliquez sur les symboles ou tapez directement. Les parenthèses délimitent : tout ce qui est entre ( ) va sous la racine, au numérateur, en exposant…",
              "انقر على الرموز أو اكتب مباشرة. الأقواس تحدد المجال: كل ما بين ( ) يوضع تحت الجذر أو في البسط أو في الأس…",
              "Click the symbols or type directly. Parentheses set the scope: whatever is inside ( ) goes under the root, in the numerator, in the exponent…"
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Thèmes */}
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: "touch" } as any}>
          {GROUPS.map(g => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGroup(g.id)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                group === g.id ? "border-indigo-600 bg-indigo-600 text-white" : "bg-background hover:bg-muted"
              }`}
            >
              {g.label[lang]}
            </button>
          ))}
        </div>

        {/* Palette */}
        <div className={`grid gap-1.5 ${current.id === "models" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-4 sm:grid-cols-6"}`}>
          {current.items.map(it => (
            <button
              key={it.l + it.s}
              type="button"
              onClick={() => insertSnippet(it.s)}
              title={it.s.replace("§", "")}
              className="flex min-h-[44px] items-center justify-center overflow-hidden rounded-lg border bg-card px-1.5 py-1.5 text-sm hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
            >
              {iconHtml[it.l]
                ? <span className="pointer-events-none" dangerouslySetInnerHTML={{ __html: iconHtml[it.l] }} />
                : <code className="text-[11px]">{it.l}</code>}
            </button>
          ))}
        </div>

        {/* Saisie LaTeX */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex rounded-md bg-muted p-0.5 text-[11px]">
              <button type="button" onClick={() => setMode("simple")} className={`rounded px-2 py-1 font-semibold ${mode === "simple" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
                {L("Écriture simple", "كتابة مبسطة", "Simple")}
              </button>
              <button type="button" onClick={() => { if (mode === "simple" && simple.trim() && !latex.trim()) setLatex(simpleToLatex(simple)); setMode("latex"); }} className={`rounded px-2 py-1 font-semibold ${mode === "latex" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
                LaTeX
              </button>
            </div>
            {allowDisplay && (
              <div className="inline-flex rounded-md bg-muted p-0.5 text-[11px]">
                <button type="button" onClick={() => setDisplay(false)} className={`inline-flex items-center gap-1 rounded px-2 py-1 font-semibold ${!display ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
                  <AlignLeft className="h-3 w-3" />{L("Dans la ligne", "داخل السطر", "Inline")}
                </button>
                <button type="button" onClick={() => setDisplay(true)} className={`inline-flex items-center gap-1 rounded px-2 py-1 font-semibold ${display ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
                  <AlignCenter className="h-3 w-3" />{L("Centrée", "في الوسط", "Centred")}
                </button>
              </div>
            )}
          </div>
          <textarea
            ref={areaRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); doInsert(); } }}
            rows={2}
            dir="ltr"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            placeholder={mode === "simple" ? "√(32×5)   (x+1)/(x−2)   x^(n+1)" : "\\frac{1}{2} + \\sqrt{x}"}
            className="w-full rounded-lg border bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
          {mode === "simple" && (
            <div className="rounded-lg bg-indigo-50/70 px-2.5 py-2 text-[11px] text-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200">
              <p className="mb-1 font-semibold">
                {L("Les parenthèses délimitent ce qui est sous la racine, au numérateur, en exposant :", "الأقواس تحدد ما يوجد تحت الجذر أو في البسط أو في الأس:", "Parentheses set what goes under the root, in the numerator, in the exponent:")}
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {SIMPLE_EXAMPLES.map(ex => (
                  <button key={ex} type="button" onClick={() => setSimple(ex)} className="inline-flex items-center gap-1 rounded px-1 hover:bg-indigo-100 dark:hover:bg-indigo-900/40">
                    <code className="font-mono">{ex}</code>
                    <span aria-hidden>→</span>
                    {iconHtml["ex:" + ex]
                      ? <span className="pointer-events-none" dangerouslySetInnerHTML={{ __html: iconHtml["ex:" + ex] }} />
                      : <code>{simpleToLatex(ex)}</code>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Aperçu */}
        <div className="min-h-[64px] rounded-lg border border-dashed bg-muted/30 px-3 py-3 overflow-x-auto">
          {loadError ? (
            <p className="text-xs text-amber-700">{L("Aperçu indisponible (connexion internet requise).", "المعاينة غير متاحة (يلزم الاتصال بالإنترنت).", "Preview unavailable (internet connection required).")}</p>
          ) : preview ? (
            <div className={display ? "text-center text-lg" : "text-lg"} dangerouslySetInnerHTML={{ __html: preview }} />
          ) : (
            <p className="text-xs text-muted-foreground">{L("Aperçu de la formule…", "معاينة الصيغة…", "Formula preview…")}</p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{L("Annuler", "إلغاء", "Cancel")}</Button>
          <Button type="button" onClick={doInsert} disabled={!finalLatex} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {L("Insérer", "إدراج", "Insert")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

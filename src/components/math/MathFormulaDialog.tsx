import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sigma, AlignCenter, AlignLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { loadKatex, renderLatexToString } from "@/lib/mathRender";

/**
 * Éditeur de formules pour les professeurs (maths, physique-chimie, SVT…).
 * - Palettes de symboles et de modèles classés par thème : un clic insère le code.
 * - Saisie LaTeX directe possible (pour ceux qui connaissent).
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
  const [latex, setLatex] = useState(initialLatex);
  const [display, setDisplay] = useState(false);
  const [group, setGroup] = useState("base");
  const [katex, setKatex] = useState<any>((window as any).katex || null);
  const [loadError, setLoadError] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setLatex(initialLatex);
    setDisplay(false);
    loadKatex().then(k => setKatex(k)).catch(() => setLoadError(true));
  }, [open, initialLatex]);

  const preview = useMemo(() => (katex && latex.trim() ? renderLatexToString(katex, latex, display) : ""), [katex, latex, display]);
  const iconHtml = useMemo(() => {
    if (!katex) return {} as Record<string, string>;
    const map: Record<string, string> = {};
    GROUPS.forEach(g => g.items.forEach(it => { map[it.l] = renderLatexToString(katex, it.l, false); }));
    return map;
  }, [katex]);

  const insertSnippet = (snippet: string) => {
    const el = areaRef.current;
    const caret = snippet.indexOf("§");
    const clean = snippet.replace("§", "");
    const start = el ? el.selectionStart : latex.length;
    const end = el ? el.selectionEnd : latex.length;
    const next = latex.slice(0, start) + clean + latex.slice(end);
    setLatex(next);
    const pos = start + (caret >= 0 ? caret : clean.length);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      try { el.setSelectionRange(pos, pos); } catch { /* iOS ancien */ }
    });
  };

  const doInsert = () => {
    const v = latex.trim();
    if (!v) return;
    const d = allowDisplay && display;
    onInsert(d ? `$$${v}$$` : `$${v}$`, v, d);
    onOpenChange(false);
  };

  const current = GROUPS.find(g => g.id === group) || GROUPS[0];

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
              "Cliquez sur les symboles ou tapez directement en LaTeX. L'aperçu montre ce que verra l'élève.",
              "انقر على الرموز أو اكتب مباشرة بلغة LaTeX. المعاينة تُظهر ما سيراه التلميذ.",
              "Click the symbols or type LaTeX directly. The preview shows what students will see."
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
              key={it.l}
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
            <span className="text-xs font-semibold text-muted-foreground">LaTeX</span>
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
            value={latex}
            onChange={e => setLatex(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); doInsert(); } }}
            rows={2}
            dir="ltr"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="\frac{1}{2} + \sqrt{x}"
            className="w-full rounded-lg border bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
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
          <Button type="button" onClick={doInsert} disabled={!latex.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {L("Insérer", "إدراج", "Insert")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

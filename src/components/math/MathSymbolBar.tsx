import { useState } from "react";
import { Sigma, ChevronDown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Clavier de symboles pour les réponses rédigées des élèves (téléphone, iPad, PC).
 * Les touches à « portée » (racine, fraction, puissance…) insèrent un modèle avec
 * parenthèses et placent le curseur dedans : √(…)  (…)/(…)  ^(…)
 * → l'élève voit clairement ce qui est sous la racine : √(32)×5 ≠ √(32×5).
 * k = libellé de la touche, s = texte inséré (§ = position du curseur).
 */
type Key = { k: string; s?: string; wide?: boolean };
const plain = (keys: string[]): Key[] => keys.map(k => ({ k }));
const ROWS: { label: { fr: string; ar: string; en: string }; keys: Key[] }[] = [
  {
    label: { fr: "Opérations", ar: "عمليات", en: "Operations" },
    keys: [
      { k: "√( )", s: "√(§)", wide: true }, { k: "a/b", s: "(§)/()", wide: true }, { k: "xⁿ", s: "^(§)" }, { k: "xₙ", s: "_(§)" },
      { k: "ⁿ√( )", s: "√[§]()", wide: true }, { k: "|x|", s: "|§|" }, { k: "( )", s: "(§)" },
      ...plain(["²", "³", "+", "−", "×", "÷", "±", "=", "≠", "≈", "≤", "≥", "<", ">", "%", "°", "∞", "π"]),
    ],
  },
  { label: { fr: "Ensembles", ar: "مجموعات", en: "Sets" }, keys: plain(["ℕ", "ℤ", "ℚ", "ℝ", "ℂ", "∈", "∉", "⊂", "∪", "∩", "∅", "∀", "∃", "⇒", "⇔", "[", "]", ";", "{", "}"]) },
  {
    label: { fr: "Analyse & géométrie", ar: "تحليل وهندسة", en: "Calculus & geometry" },
    keys: [
      { k: "lim", s: "lim(x→§) ", wide: true }, { k: "∫", s: "∫(§,) dx" }, { k: "Σ", s: "Σ(k=§,n) " }, { k: "ln( )", s: "ln(§)", wide: true },
      { k: "eˣ", s: "e^(§)" }, { k: "f′", s: "f′(§)" }, { k: "AB⃗", s: "vec(§)", wide: true },
      ...plain(["→", "↦", "Δ", "‖", "⊥", "∥", "∠", "△", "α", "β", "θ", "λ", "μ", "ω"]),
    ],
  },
];

export default function MathSymbolBar({ onInsert, disabled }: { onInsert: (text: string, caret: number) => void; disabled?: boolean }) {
  const { language } = useLanguage();
  const lang = (language === "ar" || language === "en" ? language : "fr") as "fr" | "ar" | "en";
  const [open, setOpen] = useState(false);
  const [row, setRow] = useState(0);

  return (
    <div className="rounded-xl border bg-muted/30">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 disabled:opacity-50"
      >
        <span className="inline-flex items-center gap-1.5">
          <Sigma className="h-4 w-4" />
          {lang === "ar" ? "رموز رياضية" : lang === "en" ? "Math symbols" : "Symboles mathématiques"}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-2 border-t px-2 pb-2 pt-2">
          <div className="flex gap-1 overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" } as any}>
            {ROWS.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setRow(i)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${row === i ? "bg-indigo-600 text-white" : "bg-background text-muted-foreground"}`}
              >
                {r.label[lang]}
              </button>
            ))}
          </div>
          {row !== 1 && (
            <p className="px-1 text-[11px] text-muted-foreground">
              {lang === "ar"
                ? "الأقواس تحدد المجال: √(32)×5 ≠ √(32×5)"
                : lang === "en"
                ? "Parentheses set the scope: √(32)×5 ≠ √(32×5)"
                : "Les parenthèses délimitent : √(32)×5 ≠ √(32×5)"}
            </p>
          )}
          <div className="flex flex-wrap gap-1" dir="ltr">
            {ROWS[row].keys.map(({ k, s, wide }) => (
              <button
                key={k}
                type="button"
                disabled={disabled}
                // mousedown + preventDefault : le champ garde le focus (et le curseur) sur PC
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  const tpl = s || k;
                  const caret = tpl.indexOf("§");
                  const text = tpl.replace("§", "");
                  onInsert(text, caret >= 0 ? caret : text.length);
                }}
                className={`h-10 ${wide ? "min-w-[52px]" : "min-w-[40px]"} rounded-lg border px-2 font-serif text-base ${s ? "border-indigo-200 bg-indigo-50/60 dark:border-indigo-800 dark:bg-indigo-950/30" : "bg-background"} hover:border-indigo-400 hover:bg-indigo-50 active:scale-95 dark:hover:bg-indigo-950/40`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

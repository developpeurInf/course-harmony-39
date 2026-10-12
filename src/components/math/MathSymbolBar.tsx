import { useState } from "react";
import { Sigma, ChevronDown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Clavier de symboles pour les réponses rédigées des élèves (téléphone, iPad, PC).
 * Insère des caractères Unicode simples (√, π, ≤, ℝ, ², …) à la position du curseur :
 * aucune connaissance de LaTeX nécessaire.
 */
const ROWS: { label: { fr: string; ar: string; en: string }; keys: string[] }[] = [
  { label: { fr: "Opérations", ar: "عمليات", en: "Operations" }, keys: ["+", "−", "×", "÷", "±", "=", "≠", "≈", "≤", "≥", "<", ">", "√", "∛", "²", "³", "ⁿ", "⁻¹", "½", "%", "°", "∞", "π"] },
  { label: { fr: "Ensembles", ar: "مجموعات", en: "Sets" }, keys: ["ℕ", "ℤ", "ℚ", "ℝ", "ℂ", "∈", "∉", "⊂", "∪", "∩", "∅", "∀", "∃", "⇒", "⇔", "[", "]", ";", "{", "}"] },
  { label: { fr: "Analyse & géométrie", ar: "تحليل وهندسة", en: "Calculus & geometry" }, keys: ["→", "↦", "∫", "Σ", "Δ", "lim", "ln", "eˣ", "f′", "‖", "⃗", "⊥", "∥", "∠", "△", "α", "β", "θ", "λ", "μ", "ω"] },
];

export default function MathSymbolBar({ onInsert, disabled }: { onInsert: (s: string) => void; disabled?: boolean }) {
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
          <div className="flex flex-wrap gap-1" dir="ltr">
            {ROWS[row].keys.map(k => (
              <button
                key={k}
                type="button"
                disabled={disabled}
                // mousedown + preventDefault : le champ garde le focus (et le curseur) sur PC
                onMouseDown={e => e.preventDefault()}
                onClick={() => onInsert(k === "⃗" ? "⃗" : k)}
                className="h-10 min-w-[40px] rounded-lg border bg-background px-2 font-serif text-base hover:border-indigo-400 hover:bg-indigo-50 active:scale-95 dark:hover:bg-indigo-950/40"
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

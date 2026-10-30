import { useEffect, useRef, useState } from "react";
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
  const keysRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ row, disabled, onInsert });
  stateRef.current = { row, disabled, onInsert };

  const insertKey = (key: Key) => {
    const tpl = key.s || key.k;
    const caret = tpl.indexOf("§");
    const text = tpl.replace("§", "");
    stateRef.current.onInsert(text, caret >= 0 ? caret : text.length);
  };

  // iPhone / iPad : un « touchstart » sans preventDefault fait perdre le focus au champ
  // et ferme le clavier. Les écouteurs tactiles de React sont passifs : on passe donc par
  // un écouteur natif { passive: false } et on insère le symbole au « touchend ».
  useEffect(() => {
    const el = keysRef.current;
    if (!el) return;
    let startBtn: HTMLElement | null = null;
    let sx = 0;
    let sy = 0;
    const onStart = (e: TouchEvent) => {
      const btn = (e.target as HTMLElement | null)?.closest ? (e.target as HTMLElement).closest("button[data-key-idx]") as HTMLElement | null : null;
      if (!btn || stateRef.current.disabled) return;
      e.preventDefault();
      startBtn = btn;
      const t = e.touches[0];
      sx = t ? t.clientX : 0;
      sy = t ? t.clientY : 0;
    };
    const onEnd = (e: TouchEvent) => {
      const btn = startBtn;
      startBtn = null;
      if (!btn || stateRef.current.disabled) return;
      e.preventDefault();
      const t = e.changedTouches[0];
      if (t && (Math.abs(t.clientX - sx) > 12 || Math.abs(t.clientY - sy) > 12)) return;
      const idx = Number(btn.getAttribute("data-key-idx"));
      const key = ROWS[stateRef.current.row]?.keys[idx];
      if (key) insertKey(key);
    };
    const onCancel = () => { startBtn = null; };
    el.addEventListener("touchstart", onStart, { passive: false } as any);
    el.addEventListener("touchend", onEnd, { passive: false } as any);
    el.addEventListener("touchcancel", onCancel);
    return () => {
      el.removeEventListener("touchstart", onStart as any);
      el.removeEventListener("touchend", onEnd as any);
      el.removeEventListener("touchcancel", onCancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
          <div ref={keysRef} className="flex flex-wrap gap-1" dir="ltr">
            {ROWS[row].keys.map(({ k, s, wide }, idx) => (
              <button
                key={k}
                type="button"
                data-key-idx={idx}
                aria-label={k}
                disabled={disabled}
                // mousedown + preventDefault : le champ garde le focus (et le curseur) sur PC
                onMouseDown={e => e.preventDefault()}
                onClick={() => insertKey({ k, s, wide })}
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

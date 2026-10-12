import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { hasMath, loadKatex, renderLatexToString, renderMathInElement } from "@/lib/mathRender";
import { looksMathy, simpleToLatex } from "@/lib/simpleMath";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Affiche un contenu HTML (texte enrichi de l'éditeur) ou un texte simple
 * en remplaçant les formules $…$ / $$…$$ par leur rendu mathématique (KaTeX).
 */

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function MathHtml({ html, className, style }: { html: string; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (hasMath(html)) renderMathInElement(ref.current);
  }, [html]);
  return <div ref={ref} className={className} style={style} dangerouslySetInnerHTML={{ __html: html || "" }} />;
}

export function MathText({ text, className, as = "span" }: { text: string; className?: string; as?: "span" | "div" | "p" }) {
  const ref = useRef<HTMLElement>(null);
  const value = text || "";
  useEffect(() => {
    if (hasMath(value)) renderMathInElement(ref.current);
  }, [value]);
  const Tag = as as any;
  return <Tag ref={ref} className={className} dangerouslySetInnerHTML={{ __html: escapeHtml(value) }} />;
}

/**
 * Mise en forme d'une réponse écrite en « écriture simple » (√(32×5), (x+1)/2, x^(n+1)…).
 * N'affiche rien si le texte ne contient pas d'écriture mathématique.
 */
export function SimpleMathPreview({ text, className, compact }: { text: string; className?: string; compact?: boolean }) {
  const { language } = useLanguage();
  const [katex, setKatex] = useState<any>((window as any).katex || null);
  const mathy = looksMathy(text);
  useEffect(() => {
    if (mathy && !katex) loadKatex().then(setKatex).catch(() => undefined);
  }, [mathy, katex]);
  const html = useMemo(() => (mathy && katex ? renderLatexToString(katex, simpleToLatex(text), false) : ""), [mathy, katex, text]);
  if (!mathy || !html) return null;
  const label = language === "ar" ? "عرض الصيغة" : language === "en" ? "Formatted" : "Mise en forme";
  return (
    <div className={`rounded-xl border border-dashed bg-muted/30 ${compact ? "px-2 py-1.5" : "px-3 py-2"} ${className || ""}`}>
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="math-inline block overflow-x-auto text-base" dir="ltr" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

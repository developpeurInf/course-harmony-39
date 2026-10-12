import { useEffect, useRef, type CSSProperties } from "react";
import { hasMath, renderMathInElement } from "@/lib/mathRender";

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

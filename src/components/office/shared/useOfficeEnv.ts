import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

export type Tr = (fr: string, ar: string, en?: string) => string;

/** Langue, sens d'écriture et thème (clair / sombre) de l'application pour les Outils Office */
export function useOfficeEnv() {
  const { language } = useLanguage();
  const L: Tr = (fr, ar, en) => (language === "ar" ? ar : language === "en" ? en ?? fr : fr);
  const dir: "rtl" | "ltr" = language === "ar" ? "rtl" : "ltr";
  const [dark, setDark] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setDark(el.classList.contains("dark")));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return { L, language, dir, isRtl: dir === "rtl", dark };
}

/** Exécute fn au plus une fois toutes les `ms` millisecondes après le dernier appel */
export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | null = null;
  const d = (...a: A) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => { t = null; fn(...a); }, ms);
  };
  d.flush = (...a: A) => { if (t) clearTimeout(t); t = null; fn(...a); };
  d.cancel = () => { if (t) clearTimeout(t); t = null; };
  return d;
}

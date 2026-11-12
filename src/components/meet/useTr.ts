import { useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

/** Traduction courte FR / AR / EN + sens d'écriture */
export function useTr() {
  const { language } = useLanguage();
  const tr = useCallback(
    (fr: string, ar: string, en: string = fr) => (language === "ar" ? ar : language === "en" ? en : fr),
    [language],
  );
  const locale = language === "ar" ? "ar-MA" : language === "en" ? "en-GB" : "fr-FR";
  return { tr, lang: language as string, locale, rtl: language === "ar", dir: (language === "ar" ? "rtl" : "ltr") as "rtl" | "ltr" };
}
export type Tr = ReturnType<typeof useTr>["tr"];

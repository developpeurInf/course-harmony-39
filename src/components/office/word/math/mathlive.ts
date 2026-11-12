/**
 * Chargement à la demande de MathLive (éditeur d'équations visuel, licence MIT).
 * Rien n'est téléchargé tant que l'éditeur d'équations n'est pas ouvert.
 * Les polices sont servies par le site (public/mathlive/fonts), sans dépendre d'un CDN.
 */
import { MATH_SHORTCUTS } from "./palettes";

type MathLive = typeof import("mathlive");
let mlPromise: Promise<MathLive> | null = null;

export function loadMathLive(language: string): Promise<MathLive> {
  if (!mlPromise) {
    mlPromise = import("mathlive")
      .then((ml) => {
        const MF = ml.MathfieldElement;
        MF.fontsDirectory = "/mathlive/fonts";
        MF.soundsDirectory = null;
        MF.plonkSound = null;
        MF.keypressSound = null;
        return ml;
      })
      .catch((e) => {
        mlPromise = null;
        throw e;
      });
  }
  return mlPromise.then((ml) => {
    const MF = ml.MathfieldElement;
    MF.locale = language === "ar" ? "ar" : language === "en" ? "en" : "fr";
    // virgule décimale en France et au Maroc
    MF.decimalSeparator = language === "en" ? "." : ",";
    return ml;
  });
}

/** Réglages appliqués à chaque champ d'équation */
export function setupMathfield(mf: HTMLElement & Record<string, any>) {
  mf.smartFence = true;
  mf.smartSuperscript = true;
  mf.mathVirtualKeyboardPolicy = "auto";
  mf.inlineShortcuts = { ...mf.inlineShortcuts, ...MATH_SHORTCUTS };
}

/** Rendu statique (boutons de palette) une fois MathLive chargé */
export function latexToMarkup(ml: MathLive | null, latex: string): string {
  if (!ml) return "";
  try {
    return ml.convertLatexToMarkup(latex);
  } catch {
    return latex;
  }
}

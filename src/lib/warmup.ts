/**
 * Préchargement « à l'intention » des outils lourds (Word, Excel, PowerPoint, GeoGebra).
 *
 * Quand la souris passe sur un lien (ou qu'on le touche / le sélectionne au clavier),
 * on commence à télécharger le code de l'outil : à l'ouverture de la page il est
 * souvent déjà là, l'écran « chargement… » est beaucoup plus court.
 * Rien n'est préchargé en mode « économie de données » ni sur une connexion 2G.
 * Chaque outil n'est préchargé qu'une fois ; une erreur est ignorée (la page réessaiera).
 */

export type WarmTarget = "word" | "excel" | "ppt" | "geogebra";

const done = new Set<WarmTarget>();

function lowData(): boolean {
  try {
    const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    return !!c && (c.saveData === true || /(^|-)2g$/.test(c.effectiveType || ""));
  } catch {
    return false;
  }
}

function preconnect(href: string) {
  try {
    if (document.querySelector(`link[rel="preconnect"][href="${href}"]`)) return;
    const l = document.createElement("link");
    l.rel = "preconnect";
    l.href = href;
    l.crossOrigin = "anonymous";
    document.head.appendChild(l);
  } catch {
    /* sans effet */
  }
}

export function warm(target: WarmTarget) {
  if (typeof window === "undefined" || done.has(target) || lowData()) return;
  done.add(target);
  const fail = () => done.delete(target);
  switch (target) {
    case "word":
      void import("@/components/office/word/WordEditor").catch(fail);
      break;
    case "excel":
      void import("@/components/office/excel/ExcelEditor").catch(fail);
      break;
    case "ppt":
      void import("@/components/office/ppt/PptEditor").catch(fail);
      break;
    case "geogebra":
      void import("@/components/geogebra/loadGeogebra")
        .then((m) => {
          try {
            preconnect(new URL(m.GGB_BASE, location.href).origin);
          } catch {
            /* URL invalide : ignoré */
          }
          // petit script d'amorçage (deployggb.js) + code de la page
          return Promise.all([m.loadGeogebra().catch(() => undefined), import("@/components/geogebra/GeoGebraWorkspace")]);
        })
        .catch(fail);
      break;
  }
}

/** Props à poser sur un lien : préchargement au survol, au toucher et au focus clavier */
export const warmProps = (target: WarmTarget) => ({
  onPointerEnter: () => warm(target),
  onTouchStart: () => warm(target),
  onFocus: () => warm(target),
});

/** Préchargement quand le navigateur n'a rien d'autre à faire */
export function warmWhenIdle(target: WarmTarget, delay = 1200) {
  if (typeof window === "undefined") return () => undefined;
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  let idle: number | undefined;
  const t = window.setTimeout(() => {
    if (w.requestIdleCallback) idle = w.requestIdleCallback(() => warm(target), { timeout: 4000 });
    else warm(target);
  }, delay);
  return () => {
    window.clearTimeout(t);
    if (idle !== undefined) w.cancelIdleCallback?.(idle);
  };
}

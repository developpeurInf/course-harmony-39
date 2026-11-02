/**
 * Chargement unique du script officiel GeoGebra (deployggb.js, API « GeoGebra Apps »).
 *
 * Par défaut, tout vient de geogebra.org (toujours la dernière version).
 * Pour héberger GeoGebra soi-même (réseau d'établissement filtré, hors ligne…) :
 * décompresser le « GeoGebra Math Apps Bundle » dans public/geogebra/ puis mettre
 * NEXT_PUBLIC_GEOGEBRA_URL=/geogebra/GeoGebra/ dans .env (dossier qui contient deployggb.js et HTML5/).
 */

/** API d'une application GeoGebra chargée (sous-ensemble utilisé ici) */
export interface GgbApi {
  getBase64: (cb?: (b64: string) => void) => string;
  setBase64: (b64: string, cb?: () => void) => void;
  getPNGBase64: (exportScale: number, transparent: boolean, dpi?: number) => string;
  exportSVG?: (cb: (svg: string) => void) => void;
  newConstruction: () => void;
  setSize: (w: number, h: number) => void;
  setLanguage?: (lang: string) => void;
  setGraphicsOptions?: (view: number, opts: Record<string, unknown>) => void;
  setPerspective?: (p: string) => void;
  registerUpdateListener?: (fn: (...a: unknown[]) => void) => void;
  registerAddListener?: (fn: (...a: unknown[]) => void) => void;
  registerRemoveListener?: (fn: (...a: unknown[]) => void) => void;
  registerClearListener?: (fn: (...a: unknown[]) => void) => void;
  registerRenameListener?: (fn: (...a: unknown[]) => void) => void;
  undo?: () => void;
  redo?: () => void;
  remove?: () => void;
  getObjectNumber?: () => number;
}

interface GGBAppletInstance {
  inject: (el: string | HTMLElement) => void;
  setHTML5Codebase?: (url: string, offline?: boolean) => void;
  removeExistingApplet?: (el: string | HTMLElement, showScreenshot?: boolean) => void;
}

declare global {
  interface Window {
    GGBApplet?: new (params: Record<string, unknown>, html5NoWebSimple?: boolean | string) => GGBAppletInstance;
  }
}

export const GGB_BASE = (process.env.NEXT_PUBLIC_GEOGEBRA_URL || "https://www.geogebra.org/apps/").replace(/\/?$/, "/");
export const GGB_SELF_HOSTED = !/^https:\/\/(www\.)?geogebra\.org\//.test(GGB_BASE);

let scriptPromise: Promise<void> | null = null;

export function loadGeogebra(timeoutMs = 25000): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if (window.GGBApplet) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `${GGB_BASE}deployggb.js`;
    s.async = true;
    const timer = setTimeout(() => {
      scriptPromise = null;
      reject(new Error("timeout"));
    }, timeoutMs);
    s.onload = () => {
      clearTimeout(timer);
      if (window.GGBApplet) resolve();
      else {
        scriptPromise = null;
        reject(new Error("no GGBApplet"));
      }
    };
    s.onerror = () => {
      clearTimeout(timer);
      scriptPromise = null;
      s.remove();
      reject(new Error("network"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/** Crée l'application dans `el`. Le paramètre « appletOnLoad » reçoit l'API. */
export function injectGeogebra(el: HTMLElement, params: Record<string, unknown>) {
  const Ctor = window.GGBApplet;
  if (!Ctor) throw new Error("GGBApplet absent");
  const applet = new Ctor(params, true);
  if (GGB_SELF_HOSTED && applet.setHTML5Codebase) applet.setHTML5Codebase(`${GGB_BASE}HTML5/5.0/web3d/`);
  applet.inject(el);
  return applet;
}

/** Télécharge un Blob sous un nom de fichier (compatible iPad : lien temporaire) */
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function base64ToBlob(b64: string, type: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export function arrayBufferToBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(s);
}

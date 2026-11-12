/**
 * Droits du Labo 3D (rpc lab3d_features) et capacités AR / VR de l'appareil.
 * Avant la migration, tout est ouvert.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Lab3dFeatures { use: boolean; ar: boolean; vr: boolean; measure: boolean }
const ALL: Lab3dFeatures = { use: true, ar: true, vr: true, measure: true };
let cache: Lab3dFeatures | null = null;
let pending: Promise<Lab3dFeatures> | null = null;

export function useLab3dFeatures(): Lab3dFeatures | null {
  const [f, setF] = useState<Lab3dFeatures | null>(cache);
  useEffect(() => {
    let alive = true;
    if (!pending) {
      pending = (supabase as any).rpc("lab3d_features").then(({ data, error }: any) => {
        cache = error || !data ? ALL : { ...ALL, ...data };
        return cache;
      });
    }
    pending!.then((v) => { if (alive) setF(v); });
    return () => { alive = false; };
  }, []);
  return f;
}

export interface XrSupport { ar: boolean; vr: boolean; quickLook: boolean; ios: boolean; gyro: boolean; camera: boolean }

export function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

let xrCache: XrSupport | null = null;
export function useXrSupport(): XrSupport | null {
  const [s, setS] = useState<XrSupport | null>(xrCache);
  useEffect(() => {
    if (xrCache) return;
    let alive = true;
    const xr = (navigator as any).xr;
    const check = (mode: string) => (xr?.isSessionSupported ? xr.isSessionSupported(mode).catch(() => false) : Promise.resolve(false));
    Promise.all([check("immersive-ar"), check("immersive-vr")]).then(([ar, vr]) => {
      const a = document.createElement("a");
      xrCache = {
        ar: !!ar, vr: !!vr,
        quickLook: !!(a.relList && a.relList.supports && a.relList.supports("ar")),
        ios: isIOS(),
        gyro: typeof window !== "undefined" && "DeviceOrientationEvent" in window && (navigator.maxTouchPoints > 0),
        camera: !!navigator.mediaDevices?.getUserMedia,
      };
      if (alive) setS(xrCache);
    });
    return () => { alive = false; };
  }, []);
  return s;
}

/** iOS 13+ demande une autorisation explicite pour le gyroscope */
export async function requestOrientationPermission(): Promise<boolean> {
  const D = (window as any).DeviceOrientationEvent;
  if (D && typeof D.requestPermission === "function") {
    try { return (await D.requestPermission()) === "granted"; } catch { return false; }
  }
  return true;
}

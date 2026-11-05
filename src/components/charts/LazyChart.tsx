"use client";

import * as React from "react";

/**
 * Graphique chargé à la demande : la bibliothèque Recharts (≈ 360 Ko) n'est téléchargée
 * qu'au moment d'afficher un graphique, et non avec la page. Le reste de la page
 * s'affiche tout de suite ; un emplacement de même taille est réservé pendant le chargement.
 *
 *   <LazyChart>{(R) => (
 *     <R.ResponsiveContainer width="100%" height="100%">
 *       <R.LineChart data={…}>…</R.LineChart>
 *     </R.ResponsiveContainer>
 *   )}</LazyChart>
 */
export type Recharts = typeof import("recharts");

let cached: Recharts | null = null;
let loading: Promise<Recharts> | null = null;

export const loadRecharts = (): Promise<Recharts> => {
  if (cached) return Promise.resolve(cached);
  loading ??= import("recharts").then((m) => (cached = m as Recharts)).catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
};

export function LazyChart({ children, fallbackClassName }: { children: (R: Recharts) => React.ReactNode; fallbackClassName?: string }) {
  const [R, setR] = React.useState<Recharts | null>(cached);
  React.useEffect(() => {
    if (R) return;
    let alive = true;
    loadRecharts().then((m) => alive && setR(m), () => undefined);
    return () => {
      alive = false;
    };
  }, [R]);
  if (!R) return <div className={fallbackClassName ?? "h-full w-full animate-pulse rounded-lg bg-muted/40"} aria-hidden="true" />;
  return <>{children(R)}</>;
}

import { useEffect, useState } from "react";

/**
 * Heure courante (Date.now()) rafraîchie périodiquement (30 s par défaut) pour que les
 * statuts « à venir / disponible / expiré » changent tout seuls. En pause quand l'onglet
 * est masqué, mise à jour immédiate au retour.
 */
export function useNow(intervalMs = 30000): number {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    const tick = () => setNow(Date.now());
    const start = () => {
      if (id !== null) return;
      id = setInterval(tick, intervalMs);
    };
    const stop = () => {
      if (id !== null) {
        clearInterval(id);
        id = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        tick();
        start();
      }
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);

  return now;
}

export default useNow;

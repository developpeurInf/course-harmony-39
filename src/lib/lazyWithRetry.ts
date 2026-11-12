import { lazy, type ComponentType } from "react";

/**
 * React.lazy avec nouvelle tentative : sur une connexion mobile instable, ou juste
 * après une mise en ligne (anciens fichiers supprimés), le chargement d'une page
 * peut échouer. On réessaie une fois, puis on recharge la page une seule fois.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    const KEY = "lazy-reload-done";
    try {
      const mod = await factory();
      try { window.sessionStorage.removeItem(KEY); } catch { /* stockage indisponible */ }
      return mod;
    } catch (firstError) {
      try {
        await new Promise((r) => setTimeout(r, 800));
        return await factory();
      } catch (secondError) {
        let alreadyReloaded = false;
        try { alreadyReloaded = window.sessionStorage.getItem(KEY) === "1"; } catch { /* ignore */ }
        if (!alreadyReloaded) {
          try { window.sessionStorage.setItem(KEY, "1"); } catch { /* ignore */ }
          window.location.reload();
          return new Promise<{ default: T }>(() => { /* la page se recharge */ });
        }
        throw secondError;
      }
    }
  });
}

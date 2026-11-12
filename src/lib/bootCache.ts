/**
 * Cache de démarrage (localStorage) : dernières données connues du compte connecté
 * (profil, habilitations, cours…). Au rechargement de la page, l'application s'affiche
 * aussitôt avec ces données, puis les relit dans Supabase en arrière-plan
 * (« stale-while-revalidate »). Tout est effacé à la déconnexion (iPad partagé).
 */
const PREFIX = "mi-boot:";
const VERSION = 1;
/** Au-delà, on n'écrit pas (quota localStorage ~5 Mo, partagé avec le reste de l'appli) */
const MAX_CHARS = 1_500_000;

interface Entry<T> {
  v: number;
  at: number;
  data: T;
}

const keyOf = (name: string, userId: string) => `${PREFIX}${name}:${userId}`;

export function readBoot<T>(name: string, userId: string | null | undefined, maxAgeMs = 7 * 24 * 3600 * 1000): T | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(keyOf(name, userId));
    if (!raw) return null;
    const entry = JSON.parse(raw) as Entry<T>;
    if (!entry || entry.v !== VERSION || Date.now() - entry.at > maxAgeMs) return null;
    return entry.data;
  } catch {
    return null;
  }
}

const pending = new Map<string, number>();

/** Écriture différée (regroupe les mises à jour rapprochées, hors du chemin critique) */
export function writeBoot<T>(name: string, userId: string | null | undefined, data: T, delayMs = 400): void {
  if (!userId || typeof window === "undefined") return;
  const key = keyOf(name, userId);
  const prev = pending.get(key);
  if (prev) window.clearTimeout(prev);
  pending.set(
    key,
    window.setTimeout(() => {
      pending.delete(key);
      try {
        const raw = JSON.stringify({ v: VERSION, at: Date.now(), data } satisfies Entry<T>);
        if (raw.length > MAX_CHARS) {
          localStorage.removeItem(key);
          return;
        }
        localStorage.setItem(key, raw);
      } catch {
        // stockage plein ou indisponible : on s'en passe
        try { localStorage.removeItem(key); } catch { /* ignore */ }
      }
    }, delayMs)
  );
}

/** Efface tout le cache de démarrage (déconnexion) */
export function clearBoot(): void {
  memory.clear();
  pending.forEach((t) => window.clearTimeout(t));
  pending.clear();
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* stockage indisponible */
  }
}

/* ── Cache mémoire des pages (le temps de l'onglet) ──────────────────────────
 * Revenir sur une page déjà vue l'affiche instantanément avec les dernières données,
 * pendant qu'elles sont relues en arrière-plan. */
const memory = new Map<string, unknown>();
export const memGet = <T,>(key: string): T | undefined => memory.get(key) as T | undefined;
export const memSet = <T,>(key: string, value: T): void => {
  memory.set(key, value);
};
export const memClear = (): void => memory.clear();

/**
 * Chargement à la demande des dictionnaires de langue (P37).
 * Chaque langue est un module séparé (./fr, ./ar, ./en) importé dynamiquement avec un
 * chemin statique, pour que Vite en fasse des fichiers distincts : seul le dictionnaire
 * de la langue active est téléchargé.
 * Le chargement de la langue enregistrée démarre dès l'évaluation de ce module
 * (importé par main.tsx via toast-interceptor), donc avant le premier rendu.
 */
import { readCachedSettings } from "@/lib/appSettings";

export type Language = "en" | "fr" | "ar";

export interface LanguagePack {
  /** Clés de l'interface → texte dans la langue */
  dict: Record<string, string>;
  /** Traduction automatique d'un texte libre (anglais → langue), identité si inconnu */
  translate: (text: string) => string;
}

export const LANGUAGE_STORAGE_KEY = "maataoui-language";
/**
 * Présent quand la langue enregistrée n'a pas été choisie par l'utilisateur (simple copie
 * de la langue par défaut, lue directement par d'autres modules) : le défaut de
 * l'administration reste alors prioritaire.
 */
export const LANGUAGE_AUTO_KEY = "maataoui-language-auto";
/** Langue par défaut de l'application (inchangée) */
export const DEFAULT_LANGUAGE: Language = "ar";

export const isLanguage = (v: unknown): v is Language => v === "fr" || v === "ar" || v === "en";

/** Langue choisie explicitement par l'utilisateur (null si aucun choix enregistré). */
export function getStoredLanguage(): Language | null {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isLanguage(saved) && localStorage.getItem(LANGUAGE_AUTO_KEY) !== "1") return saved;
  } catch { /* stockage indisponible */ }
  return null;
}

/** Langue par défaut : celle fixée par l'administration (cache local), sinon DEFAULT_LANGUAGE. */
export function getDefaultLanguage(): Language {
  const cached = readCachedSettings();
  const lang = cached?.texts?.defaultLanguage;
  return isLanguage(lang) ? lang : DEFAULT_LANGUAGE;
}

export function getSavedLanguage(): Language {
  return getStoredLanguage() || getDefaultLanguage();
}

const loaded: Partial<Record<Language, LanguagePack>> = {};
const pending: Partial<Record<Language, Promise<LanguagePack>>> = {};

/** Chemins statiques par langue : Vite crée un fichier par langue. */
function importPack(lang: Language): Promise<LanguagePack> {
  switch (lang) {
    case "ar": return import("./ar");
    case "en": return import("./en");
    default: return import("./fr");
  }
}

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Pack déjà chargé (synchrone), sinon null. */
export function getLoadedPack(lang: Language): LanguagePack | null {
  return loaded[lang] || null;
}

/**
 * Charge (une seule fois) le dictionnaire d'une langue ; 2 nouvelles tentatives en cas
 * d'échec réseau. Rejette si tout échoue (le promesse suivante retentera).
 */
export function loadLanguagePack(lang: Language): Promise<LanguagePack> {
  const ready = loaded[lang];
  if (ready) return Promise.resolve(ready);
  const inFlight = pending[lang];
  if (inFlight) return inFlight;
  const p = (async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const mod = await importPack(lang);
        const pack: LanguagePack = { dict: mod.dict, translate: mod.translate };
        loaded[lang] = pack;
        return pack;
      } catch (e) {
        lastError = e;
        if (attempt < 2) await wait(500 * (attempt + 1));
      }
    }
    throw lastError;
  })();
  pending[lang] = p;
  p.then(
    () => { delete pending[lang]; },
    () => { delete pending[lang]; },
  );
  return p;
}

/**
 * Traducteur automatique de la langue s'il est déjà chargé (sinon null, et le
 * chargement est lancé pour les prochaines fois).
 */
export function getLoadedTranslator(lang: Language): ((text: string) => string) | null {
  const pack = loaded[lang];
  if (pack) return pack.translate;
  loadLanguagePack(lang).catch(() => { /* réessayé au prochain appel */ });
  return null;
}

// Démarrage immédiat : la langue enregistrée est généralement prête avant le premier rendu.
export const initialLanguagePromise: Promise<LanguagePack | null> =
  loadLanguagePack(getSavedLanguage()).catch((e) => {
    console.error("Language pack failed to load:", e);
    return null;
  });

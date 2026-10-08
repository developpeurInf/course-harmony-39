import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_QUIZ_SETTINGS, QuizSettings } from "@/contexts/CourseContext";

/**
 * Préférences de l'application (par utilisateur).
 * Enregistrées dans le compte (métadonnées Supabase Auth → synchronisées entre appareils)
 * avec un cache local pour un affichage immédiat, même hors ligne.
 */

export type AttemptPolicy = "latest" | "best" | "average";
export type FontScale = "normal" | "large" | "xlarge";
export type TableDensity = "comfortable" | "compact";

/**
 * Couleurs d'accent proposées. Volontairement SANS rouge ni vert « purs » :
 * ces couleurs restent réservées à leur sens habituel (supprimer / valider).
 * h s l = teinte, saturation, luminosité de la couleur principale (mode clair).
 */
export const ACCENT_PRESETS = {
  blue:      { h: 217, s: 91, l: 60, fr: "Bleu",      ar: "أزرق",      en: "Blue" },
  indigo:    { h: 239, s: 84, l: 62, fr: "Indigo",    ar: "نيلي",      en: "Indigo" },
  violet:    { h: 262, s: 83, l: 60, fr: "Violet",    ar: "بنفسجي",    en: "Violet" },
  pink:      { h: 330, s: 81, l: 56, fr: "Rose",      ar: "وردي",      en: "Pink" },
  fuchsia:   { h: 292, s: 70, l: 52, fr: "Fuchsia",   ar: "فوشيا",     en: "Fuchsia" },
  turquoise: { h: 187, s: 85, l: 38, fr: "Turquoise", ar: "فيروزي",    en: "Teal" },
  orange:    { h: 24,  s: 94, l: 50, fr: "Orange",    ar: "برتقالي",   en: "Orange" },
  brown:     { h: 27,  s: 45, l: 40, fr: "Chocolat",  ar: "بني",       en: "Brown" },
  slate:     { h: 215, s: 25, l: 38, fr: "Ardoise",   ar: "رمادي",     en: "Slate" },
} as const;
export type AccentColor = keyof typeof ACCENT_PRESETS;

export interface AppPreferences {
  // ── Évaluation (enseignant) ──
  /** Moyenne minimale de réussite, sur 20 */
  passThreshold: number;
  /** Seuils des niveaux, sur 20 : < struggling = en difficulté ; ≥ excellent = excellent */
  levelStruggling: number;
  levelGood: number;
  levelExcellent: number;
  /** Tentative retenue quand un quiz est repassé */
  attemptPolicy: AttemptPolicy;
  /** Alerte « inactif » après N jours sans activité */
  inactivityDays: number;

  // ── Nouveaux quiz (enseignant) ──
  quizDefaults: QuizSettings;
  defaultQuizDuration: number;
  defaultExamDuration: number;

  // ── Notifications ──
  notifyPopup: boolean;
  notifySound: boolean;
  notifyBrowser: boolean;

  // ── Affichage ──
  accentColor: AccentColor;
  reduceMotion: boolean;
  fontScale: FontScale;
  tableDensity: TableDensity;
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  passThreshold: 10,
  levelStruggling: 8,
  levelGood: 12,
  levelExcellent: 14,
  attemptPolicy: "latest",
  inactivityDays: 7,
  quizDefaults: { ...DEFAULT_QUIZ_SETTINGS },
  defaultQuizDuration: 30,
  defaultExamDuration: 60,
  notifyPopup: true,
  notifySound: false,
  notifyBrowser: false,
  accentColor: "blue",
  reduceMotion: false,
  fontScale: "normal",
  tableDensity: "comfortable",
};

/** Fusionne des préférences partielles (ex. anciennes versions) avec les valeurs par défaut et les corrige. */
export function normalizePreferences(raw: Partial<AppPreferences> | null | undefined): AppPreferences {
  const p: AppPreferences = {
    ...DEFAULT_PREFERENCES,
    ...(raw || {}),
    quizDefaults: { ...DEFAULT_QUIZ_SETTINGS, ...((raw && raw.quizDefaults) || {}) },
  };
  const clamp = (v: unknown, min: number, max: number, def: number) => {
    const n = typeof v === "number" && isFinite(v) ? v : def;
    return Math.min(max, Math.max(min, n));
  };
  p.passThreshold = clamp(p.passThreshold, 1, 20, 10);
  p.levelStruggling = clamp(p.levelStruggling, 0, 20, 8);
  p.levelGood = clamp(p.levelGood, p.levelStruggling, 20, 12);
  p.levelExcellent = clamp(p.levelExcellent, p.levelGood, 20, 14);
  p.inactivityDays = clamp(p.inactivityDays, 1, 90, 7);
  p.defaultQuizDuration = clamp(p.defaultQuizDuration, 1, 600, 30);
  p.defaultExamDuration = clamp(p.defaultExamDuration, 1, 600, 60);
  if (!["latest", "best", "average"].includes(p.attemptPolicy)) p.attemptPolicy = "latest";
  if (!["normal", "large", "xlarge"].includes(p.fontScale)) p.fontScale = "normal";
  if (!["comfortable", "compact"].includes(p.tableDensity)) p.tableDensity = "comfortable";
  if (!(p.accentColor in ACCENT_PRESETS)) p.accentColor = "blue";
  return p;
}

type SyncState = "idle" | "saving" | "saved" | "local" | "error";

interface PreferencesContextValue {
  prefs: AppPreferences;
  update: (patch: Partial<AppPreferences>) => void;
  reset: (section?: "evaluation" | "quiz" | "notifications" | "display") => void;
  syncState: SyncState;
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

const storageKey = (userId?: string) => `app-preferences-${userId || "anonymous"}`;

const readLocal = (userId?: string): AppPreferences | null => {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? normalizePreferences(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

export const PreferencesProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<AppPreferences>(() => readLocal(undefined) || DEFAULT_PREFERENCES);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chargement : cache local immédiat puis version du compte (prioritaire)
  useEffect(() => {
    if (!user?.id) return;
    const local = readLocal(user.id);
    if (local) setPrefs(local);
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const remote = (data?.user?.user_metadata as any)?.app_preferences;
      if (remote) {
        const merged = normalizePreferences(remote);
        setPrefs(merged);
        try { localStorage.setItem(storageKey(user.id), JSON.stringify(merged)); } catch { /* stockage indisponible */ }
      }
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [user?.id]);

  const persist = useCallback((next: AppPreferences) => {
    try { localStorage.setItem(storageKey(user?.id), JSON.stringify(next)); } catch { /* stockage indisponible */ }
    if (!user?.id) {
      setSyncState("local");
      return;
    }
    setSyncState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    // Regroupe les modifications rapprochées en un seul enregistrement
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase.auth.updateUser({ data: { app_preferences: next } });
      setSyncState(error ? "error" : "saved");
    }, 700);
  }, [user?.id]);

  const update = useCallback((patch: Partial<AppPreferences>) => {
    setPrefs(prev => {
      const next = normalizePreferences({ ...prev, ...patch, quizDefaults: { ...prev.quizDefaults, ...(patch.quizDefaults || {}) } });
      persist(next);
      return next;
    });
  }, [persist]);

  const reset = useCallback((section?: "evaluation" | "quiz" | "notifications" | "display") => {
    setPrefs(prev => {
      const d = DEFAULT_PREFERENCES;
      let next: AppPreferences;
      if (section === "evaluation") {
        next = { ...prev, passThreshold: d.passThreshold, levelStruggling: d.levelStruggling, levelGood: d.levelGood, levelExcellent: d.levelExcellent, attemptPolicy: d.attemptPolicy, inactivityDays: d.inactivityDays };
      } else if (section === "quiz") {
        next = { ...prev, quizDefaults: { ...d.quizDefaults }, defaultQuizDuration: d.defaultQuizDuration, defaultExamDuration: d.defaultExamDuration };
      } else if (section === "notifications") {
        next = { ...prev, notifyPopup: d.notifyPopup, notifySound: d.notifySound, notifyBrowser: d.notifyBrowser };
      } else if (section === "display") {
        next = { ...prev, reduceMotion: d.reduceMotion, fontScale: d.fontScale, tableDensity: d.tableDensity, accentColor: d.accentColor };
      } else {
        next = { ...d, quizDefaults: { ...d.quizDefaults } };
      }
      persist(next);
      return next;
    });
  }, [persist]);

  // Application des préférences d'affichage à toute l'application
  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("pref-reduce-motion", prefs.reduceMotion);
    html.classList.toggle("pref-density-compact", prefs.tableDensity === "compact");
    html.classList.remove("pref-font-large", "pref-font-xlarge");
    if (prefs.fontScale === "large") html.classList.add("pref-font-large");
    if (prefs.fontScale === "xlarge") html.classList.add("pref-font-xlarge");
  }, [prefs.reduceMotion, prefs.tableDensity, prefs.fontScale]);

  // Couleur d'accent : surcharge des variables du thème (clair + sombre)
  useEffect(() => {
    const id = "app-accent-theme";
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (prefs.accentColor === "blue") {
      el?.remove(); // couleurs d'origine définies dans index.css
      return;
    }
    if (!el) {
      el = document.createElement("style");
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = buildAccentCss(prefs.accentColor);
  }, [prefs.accentColor]);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const value = useMemo(() => ({ prefs, update, reset, syncState }), [prefs, update, reset, syncState]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
};

export const usePreferences = (): PreferencesContextValue => {
  const ctx = useContext(PreferencesContext);
  // Repli sûr si un composant est rendu hors du fournisseur (tests, aperçus)
  if (!ctx) return { prefs: DEFAULT_PREFERENCES, update: () => undefined, reset: () => undefined, syncState: "idle" };
  return ctx;
};

/** Variables CSS d'une couleur d'accent (mêmes jetons que index.css). */
export function buildAccentCss(color: AccentColor): string {
  const { h, s, l } = ACCENT_PRESETS[color];
  const ds = Math.max(30, s - 6); // mode sombre : un peu moins saturé
  const dl = Math.min(76, l + 16); // et plus clair pour rester lisible
  const glowL = Math.min(85, l + 15);
  return `
:root {
  --primary: ${h} ${s}% ${l}%;
  --primary-foreground: 0 0% 100%;
  --primary-glow: ${h} ${Math.max(40, s - 6)}% ${glowL}%;
  --ring: ${h} ${s}% ${l}%;
  --secondary: ${h} 32% 96%;
  --accent: ${h} 50% 92%;
  --sidebar-background: ${h} ${Math.min(s, 35)}% 90%;
  --sidebar-primary: ${h} ${s}% ${l}%;
  --sidebar-accent: ${h} 40% 84%;
  --sidebar-border: ${h} 25% 80%;
  --sidebar-ring: ${h} ${s}% ${l}%;
  --gradient-primary: linear-gradient(135deg, hsl(${h} ${s}% ${l}%), hsl(${h} ${Math.max(40, s - 6)}% ${glowL}%));
  --gradient-accent: linear-gradient(135deg, hsl(${h} 50% 90%), hsl(${h} 40% 95%));
}
.dark {
  --primary: ${h} ${ds}% ${dl}%;
  --primary-foreground: 215 30% 8%;
  --primary-glow: ${h} ${ds}% ${Math.min(88, dl + 10)}%;
  --ring: ${h} ${ds}% ${dl}%;
  --accent: ${h} 45% 25%;
  --sidebar-primary: ${h} ${ds}% ${dl}%;
  --sidebar-ring: ${h} ${ds}% ${dl}%;
  --gradient-primary: linear-gradient(135deg, hsl(${h} ${ds}% ${dl}%), hsl(${h} ${ds}% ${Math.min(88, dl + 10)}%));
  --gradient-accent: linear-gradient(135deg, hsl(${h} 45% 25%), hsl(${h} 35% 30%));
}`;
}

/** Petit signal sonore discret (sans fichier audio). */
export function playNotificationSound() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.12, now + i * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.3);
    });
    setTimeout(() => ctx.close?.(), 800);
  } catch {
    /* audio indisponible */
  }
}

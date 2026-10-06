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
        next = { ...prev, reduceMotion: d.reduceMotion, fontScale: d.fontScale, tableDensity: d.tableDensity };
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

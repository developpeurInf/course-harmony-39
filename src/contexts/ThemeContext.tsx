import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_APP_SETTINGS, readCachedSettings } from "@/lib/appSettings";
import { useAppSettings } from "@/contexts/AppSettingsContext";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  systemTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "maataoui-theme";
const isTheme = (v: unknown): v is Theme => v === "light" || v === "dark" || v === "system";

function readSavedTheme(): Theme | null {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(saved) ? saved : null;
  } catch {
    return null;
  }
}

/** Mode par défaut fixé par l'administration (cache local), sinon « system » (comportement d'origine). */
function adminDefaultTheme(): Theme {
  const cached = readCachedSettings();
  const mode = cached?.theme?.defaultMode;
  return isTheme(mode) ? mode : "system";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Thème choisi par l'utilisateur ; sinon le mode par défaut de l'administration
  const [theme, setThemeState] = useState<Theme>(() => readSavedTheme() || adminDefaultTheme());
  const { settings } = useAppSettings();

  // Choix explicite : enregistré (et prioritaire sur le réglage de l'administration)
  const setTheme = useCallback((next: Theme) => {
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* stockage indisponible */ }
    setThemeState(next);
  }, []);

  // Réglage central reçu / modifié : suivi seulement si l'utilisateur n'a rien choisi
  useEffect(() => {
    if (settings === DEFAULT_APP_SETTINGS) return; // fournisseur absent : on garde l'existant
    if (readSavedTheme()) return;
    const mode = settings.theme?.defaultMode;
    if (isTheme(mode)) setThemeState(mode);
  }, [settings]);

  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() => {
    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange as any);
    } else if ((mediaQuery as any).addListener) {
      (mediaQuery as any).addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange as any);
      } else if ((mediaQuery as any).removeListener) {
        (mediaQuery as any).removeListener(handleChange);
      }
    };
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    const resolved = theme === "system" ? systemTheme : theme;
    root.classList.remove(resolved === "dark" ? "light" : "dark");
    root.classList.add(resolved);
    // contrôles natifs (barres de défilement, champs) assortis au thème
    try { root.style.colorScheme = resolved; } catch { /* ancien navigateur */ }
  }, [theme, systemTheme]);

  const value = useMemo(() => ({ theme, setTheme, systemTheme }), [theme, setTheme, systemTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
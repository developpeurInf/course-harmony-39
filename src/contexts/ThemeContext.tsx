import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  systemTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    let savedTheme: string | null = null;
    try { savedTheme = localStorage.getItem("maataoui-theme"); } catch { /* stockage indisponible */ }
    return savedTheme === "light" || savedTheme === "dark" || savedTheme === "system" ? savedTheme : "system";
  });

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
    try { localStorage.setItem("maataoui-theme", theme); } catch { /* stockage indisponible */ }

    const root = window.document.documentElement;
    const resolved = theme === "system" ? systemTheme : theme;
    root.classList.remove(resolved === "dark" ? "light" : "dark");
    root.classList.add(resolved);
    // contrôles natifs (barres de défilement, champs) assortis au thème
    try { root.style.colorScheme = resolved; } catch { /* ancien navigateur */ }
  }, [theme, systemTheme]);

  const value = useMemo(() => ({ theme, setTheme, systemTheme }), [theme, systemTheme]);

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
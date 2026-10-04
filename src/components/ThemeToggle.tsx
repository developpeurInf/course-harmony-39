import { useState, useRef, useEffect } from "react";
import { Moon, Sun, Monitor, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking / touching outside (compatible with iOS 12 Safari)
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick, { passive: true });

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [isOpen]);

  const handleSelectTheme = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <Button 
        type="button"
        variant="ghost" 
        size="icon" 
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className={cn(
          "relative h-9 w-9 rounded-xl transition-all duration-200 cursor-pointer select-none",
          isOpen ? "bg-primary/15 text-primary" : "hover:bg-primary/10 hover:text-primary"
        )}
        title={t("theme.toggle")}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0 text-amber-500 pointer-events-none" />
        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100 text-blue-400 pointer-events-none" />
        <span className="sr-only">{t("theme.toggle")}</span>
      </Button>

      {isOpen && (
        <div 
          className={cn(
            "absolute top-full right-0 rtl:right-auto rtl:left-0 mt-1.5 w-36 p-1.5 rounded-xl shadow-2xl border border-border bg-card text-card-foreground z-50 animate-in fade-in-50 zoom-in-95"
          )}
          role="menu"
          aria-orientation="vertical"
        >
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSelectTheme("light");
            }}
            className={cn(
              "w-full cursor-pointer rounded-lg flex items-center justify-between gap-2.5 px-2.5 py-2 text-xs font-medium transition-colors text-left rtl:text-right select-none",
              theme === "light" ? "bg-primary/15 text-primary font-bold" : "hover:bg-muted active:bg-muted/80 text-foreground"
            )}
            role="menuitem"
          >
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-amber-500 shrink-0" />
              <span>{t("theme.light")}</span>
            </div>
            {theme === "light" && <Check className="h-3.5 w-3.5 text-primary" />}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSelectTheme("dark");
            }}
            className={cn(
              "w-full cursor-pointer rounded-lg flex items-center justify-between gap-2.5 px-2.5 py-2 text-xs font-medium transition-colors text-left rtl:text-right select-none",
              theme === "dark" ? "bg-primary/15 text-primary font-bold" : "hover:bg-muted active:bg-muted/80 text-foreground"
            )}
            role="menuitem"
          >
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-blue-400 shrink-0" />
              <span>{t("theme.dark")}</span>
            </div>
            {theme === "dark" && <Check className="h-3.5 w-3.5 text-primary" />}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSelectTheme("system");
            }}
            className={cn(
              "w-full cursor-pointer rounded-lg flex items-center justify-between gap-2.5 px-2.5 py-2 text-xs font-medium transition-colors text-left rtl:text-right select-none",
              theme === "system" ? "bg-primary/15 text-primary font-bold" : "hover:bg-muted active:bg-muted/80 text-foreground"
            )}
            role="menuitem"
          >
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-slate-500 shrink-0" />
              <span>{t("theme.system")}</span>
            </div>
            {theme === "system" && <Check className="h-3.5 w-3.5 text-primary" />}
          </button>
        </div>
      )}
    </div>
  );
}
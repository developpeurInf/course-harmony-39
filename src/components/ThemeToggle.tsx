import { useState } from "react";
import { Moon, Sun, Monitor, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePopupMenu } from "@/components/ui/use-popup-menu";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  /** Ouverture du menu : vers le bas (défaut) ou vers le haut (bas de la barre latérale). */
  placement?: "top" | "bottom";
}

type ThemeChoice = "light" | "dark" | "system";

export function ThemeToggle({ placement = "bottom" }: ThemeToggleProps = {}) {
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const { containerRef, triggerRef, menuRef, menuId, triggerProps } = usePopupMenu(isOpen, setIsOpen);

  const handleSelectTheme = (newTheme: ThemeChoice) => {
    setTheme(newTheme);
    setIsOpen(false);
    if (triggerRef.current) triggerRef.current.focus();
  };

  const options: { value: ThemeChoice; label: string; icon: JSX.Element }[] = [
    { value: "light", label: t("theme.light"), icon: <Sun className="h-4 w-4 text-amber-500 shrink-0" /> },
    { value: "dark", label: t("theme.dark"), icon: <Moon className="h-4 w-4 text-blue-400 shrink-0" /> },
    { value: "system", label: t("theme.system"), icon: <Monitor className="h-4 w-4 text-slate-500 shrink-0" /> },
  ];

  return (
    <div ref={containerRef} className="relative inline-block">
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className={cn(
          "relative h-10 w-10 rounded-xl transition-all duration-200 cursor-pointer select-none",
          isOpen ? "bg-primary/15 text-primary" : "hover:bg-primary/10 hover:text-primary"
        )}
        title={t("theme.toggle")}
        {...triggerProps}
      >
        <Sun className="h-[18px] w-[18px] rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0 text-amber-500 pointer-events-none" />
        <Moon className="absolute h-[18px] w-[18px] rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100 text-blue-400 pointer-events-none" />
        <span className="sr-only">{t("theme.toggle")}</span>
      </Button>

      {isOpen && (
        <div
          ref={menuRef}
          id={menuId}
          className={cn(
            "absolute right-0 rtl:right-auto rtl:left-0 w-40 p-1.5 rounded-xl shadow-2xl border border-border bg-card text-card-foreground z-50 animate-in fade-in-50 zoom-in-95",
            placement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
          )}
          role="menu"
          aria-orientation="vertical"
          aria-label={t("theme.toggle")}
        >
          {options.map((opt) => {
            const active = theme === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelectTheme(opt.value);
                }}
                className={cn(
                  "w-full min-h-[40px] cursor-pointer rounded-lg flex items-center justify-between gap-2.5 px-2.5 py-2 text-sm font-medium transition-colors text-start select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "bg-primary/15 text-primary font-bold" : "hover:bg-muted focus:bg-muted active:bg-muted/80 text-foreground"
                )}
                role="menuitemradio"
                aria-checked={active}
              >
                <span className="flex items-center gap-2">
                  {opt.icon}
                  <span>{opt.label}</span>
                </span>
                {active && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

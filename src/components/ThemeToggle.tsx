import type React from "react";
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
  /** Bord du bouton auquel le menu est aligné (end = côté droit en français) */
  align?: "start" | "end";
}

type ThemeChoice = "light" | "dark" | "system";

export function ThemeToggle({ placement = "bottom", align = "end" }: ThemeToggleProps = {}) {
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const { containerRef, triggerRef, menuRef, menuId, triggerProps } = usePopupMenu(isOpen, setIsOpen);

  const handleSelectTheme = (newTheme: ThemeChoice) => {
    setTheme(newTheme);
    setIsOpen(false);
    if (triggerRef.current) triggerRef.current.focus();
  };

  const options: { value: ThemeChoice; label: string; icon: React.ReactElement }[] = [
    { value: "light", label: t("theme.light"), icon: <Sun className="h-4 w-4 text-muted-foreground shrink-0" /> },
    { value: "dark", label: t("theme.dark"), icon: <Moon className="h-4 w-4 text-muted-foreground shrink-0" /> },
    { value: "system", label: t("theme.system"), icon: <Monitor className="h-4 w-4 text-muted-foreground shrink-0" /> },
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
          "relative h-8 w-8 rounded-md text-muted-foreground cursor-pointer select-none hover:text-foreground",
          isOpen && "bg-muted text-foreground"
        )}
        title={t("theme.toggle")}
        {...triggerProps}
      >
        <Sun className="h-4 w-4 dark:hidden pointer-events-none" strokeWidth={1.75} />
        <Moon className="hidden h-4 w-4 dark:block pointer-events-none" strokeWidth={1.75} />
        <span className="sr-only">{t("theme.toggle")}</span>
      </Button>

      {isOpen && (
        <div
          ref={menuRef}
          id={menuId}
          className={cn(
            "absolute w-40 p-1 rounded-lg shadow-lg border bg-popover text-popover-foreground z-50 animate-in fade-in-0 zoom-in-95",
            placement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
            align === "start" ? "start-0" : "end-0"
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
                  "w-full h-9 cursor-pointer rounded-md flex items-center justify-between gap-2 px-2 text-sm text-start select-none text-foreground hover:bg-muted focus:bg-muted focus:outline-none",
                  active && "font-medium"
                )}
                role="menuitemradio"
                aria-checked={active}
              >
                <span className="flex items-center gap-2">
                  {opt.icon}
                  <span>{opt.label}</span>
                </span>
                {active && <Check className="h-4 w-4 text-foreground" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { Globe, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePopupMenu } from "@/components/ui/use-popup-menu";
import { cn } from "@/lib/utils";

interface LanguageSelectorProps {
  /** Ouverture du menu : vers le bas (défaut) ou vers le haut (bas de la barre latérale). */
  placement?: "top" | "bottom";
  /** Bord du bouton auquel le menu est aligné (end = côté droit en français) */
  align?: "start" | "end";
}

const LANGUAGES = [
  { code: "fr" as const, name: "Français", badge: "FR" },
  { code: "ar" as const, name: "العربية", badge: "AR" },
  { code: "en" as const, name: "English", badge: "EN" },
];

export function LanguageSelector({ placement = "bottom", align = "end" }: LanguageSelectorProps = {}) {
  const { language, setLanguage, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const { containerRef, triggerRef, menuRef, menuId, triggerProps } = usePopupMenu(isOpen, setIsOpen);

  const currentBadge = language.toUpperCase();

  const handleSelectLanguage = (code: "fr" | "ar" | "en") => {
    setLanguage(code);
    setIsOpen(false);
    if (triggerRef.current) triggerRef.current.focus();
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-md px-2 text-muted-foreground cursor-pointer select-none hover:text-foreground",
          isOpen && "bg-muted text-foreground"
        )}
        title={t("app.language")}
        {...triggerProps}
      >
        <Globe className="h-4 w-4 pointer-events-none" strokeWidth={1.75} />
        <span className="pointer-events-none text-xs font-medium uppercase" aria-hidden="true">
          {currentBadge}
        </span>
        <span className="sr-only">{t("app.language")}</span>
      </Button>

      {isOpen && (
        <div
          ref={menuRef}
          id={menuId}
          className={cn(
            "absolute w-44 p-1 rounded-lg shadow-lg border bg-popover text-popover-foreground z-50 animate-in fade-in-0 zoom-in-95",
            placement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
            align === "start" ? "start-0" : "end-0"
          )}
          role="menu"
          aria-orientation="vertical"
          aria-label={t("app.language")}
        >
          {LANGUAGES.map((lang) => {
            const active = language === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                lang={lang.code}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelectLanguage(lang.code);
                }}
                className={cn(
                  "w-full h-9 cursor-pointer rounded-md flex items-center justify-between gap-2 px-2 text-sm text-start select-none text-foreground hover:bg-muted focus:bg-muted focus:outline-none",
                  active && "font-medium"
                )}
                role="menuitemradio"
                aria-checked={active}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="inline-flex w-6 justify-center font-mono text-2xs uppercase text-muted-foreground"
                    aria-hidden="true"
                  >
                    {lang.badge}
                  </span>
                  <span>{lang.name}</span>
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

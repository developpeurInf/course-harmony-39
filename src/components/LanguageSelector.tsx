import { useState } from "react";
import { Globe, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePopupMenu } from "@/components/ui/use-popup-menu";
import { cn } from "@/lib/utils";

interface LanguageSelectorProps {
  /** Ouverture du menu : vers le bas (défaut) ou vers le haut (bas de la barre latérale). */
  placement?: "top" | "bottom";
}

const LANGUAGES = [
  { code: "fr" as const, name: "Français", badge: "FR" },
  { code: "ar" as const, name: "العربية", badge: "AR" },
  { code: "en" as const, name: "English", badge: "EN" },
];

export function LanguageSelector({ placement = "bottom" }: LanguageSelectorProps = {}) {
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
          "relative flex items-center justify-center h-10 w-10 p-0 rounded-xl transition-all duration-200 cursor-pointer select-none",
          isOpen ? "bg-primary/15 text-primary" : "hover:bg-primary/10 hover:text-primary"
        )}
        title={t("app.language")}
        {...triggerProps}
      >
        <span className="relative inline-flex items-center justify-center pointer-events-none">
          <Globe className="h-[18px] w-[18px] transition-transform duration-200" />
          <span
            className="absolute -bottom-1.5 -right-2 rtl:right-auto rtl:-left-2 text-[10px] font-extrabold uppercase bg-primary text-primary-foreground px-1 rounded-full shadow-xs leading-[14px]"
            aria-hidden="true"
          >
            {currentBadge}
          </span>
        </span>
        <span className="sr-only">{t("app.language")}</span>
      </Button>

      {isOpen && (
        <div
          ref={menuRef}
          id={menuId}
          className={cn(
            "absolute right-0 rtl:right-auto rtl:left-0 w-44 p-1.5 rounded-xl shadow-2xl border border-border bg-card text-card-foreground z-50 animate-in fade-in-50 zoom-in-95",
            placement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
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
                  "w-full min-h-[40px] cursor-pointer rounded-lg flex items-center justify-between gap-2 px-2.5 py-2 text-sm transition-colors font-medium text-start select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-primary/15 text-primary font-bold"
                    : "hover:bg-muted focus:bg-muted active:bg-muted/80 text-foreground"
                )}
                role="menuitemradio"
                aria-checked={active}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex min-w-[26px] justify-center text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded-md",
                      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                    aria-hidden="true"
                  >
                    {lang.badge}
                  </span>
                  <span>{lang.name}</span>
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

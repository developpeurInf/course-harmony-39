import { useState, useRef, useEffect } from "react";
import { Globe, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

export function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const languages = [
    { code: "fr" as const, name: "Français", flag: "🇫🇷", badge: "FR" },
    { code: "ar" as const, name: "العربية", flag: "🇸🇦", badge: "AR" },
    { code: "en" as const, name: "English", flag: "🇬🇧", badge: "EN" },
  ];

  const currentBadge = language === "ar" ? "AR" : language.toUpperCase();

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

  const handleSelectLanguage = (code: "fr" | "ar" | "en") => {
    setLanguage(code);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className={cn(
          "relative flex items-center justify-center h-9 w-9 p-0 rounded-xl transition-all duration-200 cursor-pointer select-none",
          isOpen ? "bg-primary/15 text-primary" : "hover:bg-primary/10 hover:text-primary"
        )}
        title={t("app.language")}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className="relative inline-flex items-center justify-center pointer-events-none">
          <Globe className="h-4 w-4 transition-transform duration-200" />
          <span className="absolute -bottom-1 -right-1 text-[7.5px] font-black uppercase tracking-tighter bg-primary text-primary-foreground px-1 py-0 rounded-full shadow-xs leading-tight">
            {currentBadge}
          </span>
        </div>
        <span className="sr-only">{t("app.language")}</span>
      </Button>

      {isOpen && (
        <div 
          className={cn(
            "absolute top-full right-0 rtl:right-auto rtl:left-0 mt-1.5 w-44 p-1.5 rounded-xl shadow-2xl border border-border bg-card text-card-foreground z-50 animate-in fade-in-50 zoom-in-95"
          )}
          role="menu"
          aria-orientation="vertical"
        >
          {languages.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSelectLanguage(lang.code);
              }}
              className={cn(
                "w-full cursor-pointer rounded-lg flex items-center justify-between gap-2 px-2.5 py-2 text-xs transition-colors font-medium text-left rtl:text-right select-none",
                language === lang.code 
                  ? "bg-primary/15 text-primary font-bold" 
                  : "hover:bg-muted active:bg-muted/80 text-foreground"
              )}
              role="menuitem"
            >
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">{lang.flag}</span>
                <span>{lang.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded-md",
                  language === lang.code ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {lang.badge}
                </span>
                {language === lang.code && <Check className="h-3.5 w-3.5 text-primary" />}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

export function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();

  const languages = [
    { code: "fr" as const, name: "Français", flag: "🇫🇷", badge: "FR" },
    { code: "ar" as const, name: "العربية", flag: "🇸🇦", badge: "AR" },
    { code: "en" as const, name: "English", flag: "🇬🇧", badge: "EN" },
  ];

  const currentBadge = language === "ar" ? "AR" : language.toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative flex items-center justify-center h-9 w-9 p-0 hover:bg-primary/10 hover:text-primary rounded-xl transition-all duration-200"
          title={t("app.language")}
        >
          <div className="relative inline-flex items-center justify-center">
            <Globe className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
            <span className="absolute -bottom-1 -right-1 text-[7.5px] font-black uppercase tracking-tighter bg-primary text-primary-foreground px-1 py-0 rounded-full shadow-xs leading-tight select-none">
              {currentBadge}
            </span>
          </div>
          <span className="sr-only">{t("app.language")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 p-1 rounded-xl shadow-xl border-border/80 backdrop-blur-md bg-card/95">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={cn(
              "cursor-pointer rounded-lg flex items-center justify-between gap-2 px-2.5 py-2 text-xs transition-colors font-medium",
              language === lang.code 
                ? "bg-primary/10 text-primary font-bold" 
                : "hover:bg-muted"
            )}
          >
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">{lang.flag}</span>
              <span>{lang.name}</span>
            </div>
            <span className={cn(
              "text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded-md",
              language === lang.code ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              {lang.badge}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

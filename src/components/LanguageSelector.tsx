import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/contexts/LanguageContext";

export function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();

  const languages = [
    { code: "fr" as const, name: "Français", flag: "🇫🇷", badge: "FR" },
    { code: "en" as const, name: "English", flag: "🇬🇧", badge: "EN" },
    { code: "ar" as const, name: "العربية", flag: "🇸🇦", badge: "AR" },
  ];

  const currentBadge = language === "ar" ? "AR" : language.toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative flex items-center justify-center h-9 w-9 p-0 hover:bg-muted/80 rounded-md transition-colors"
          title={t("app.language")}
        >
          <div className="relative inline-flex items-center justify-center">
            <Globe className="h-5 w-5 text-foreground" />
            <span className="absolute -bottom-1 -left-1.5 text-[8.5px] font-black uppercase tracking-tighter bg-background text-foreground px-0.5 py-0 rounded leading-none border border-border/80 shadow-xs select-none">
              {currentBadge}
            </span>
          </div>
          <span className="sr-only">{t("app.language")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={`cursor-pointer flex items-center justify-between gap-3 ${
              language === lang.code ? "bg-accent font-semibold" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
            </div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground px-1 py-0.5 rounded bg-muted">
              {lang.badge}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

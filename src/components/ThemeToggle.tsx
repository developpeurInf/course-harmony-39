import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary transition-all duration-200"
          title={t("theme.toggle")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0 text-amber-500" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100 text-blue-400" />
          <span className="sr-only">{t("theme.toggle")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36 p-1 rounded-xl shadow-xl border-border/80 backdrop-blur-md bg-card/95">
        <DropdownMenuItem 
          onClick={() => setTheme("light")} 
          className={cn(
            "cursor-pointer rounded-lg flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium transition-colors",
            theme === "light" ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted"
          )}
        >
          <Sun className="h-4 w-4 text-amber-500" />
          <span>{t("theme.light")}</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme("dark")} 
          className={cn(
            "cursor-pointer rounded-lg flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium transition-colors",
            theme === "dark" ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted"
          )}
        >
          <Moon className="h-4 w-4 text-blue-400" />
          <span>{t("theme.dark")}</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme("system")} 
          className={cn(
            "cursor-pointer rounded-lg flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium transition-colors",
            theme === "system" ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted"
          )}
        >
          <Monitor className="h-4 w-4 text-slate-500" />
          <span>{t("theme.system")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
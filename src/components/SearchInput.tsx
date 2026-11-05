import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}

/** Champ de recherche avec icône, bouton d'effacement et compteur de résultats */
const SearchInput = ({ value, onChange, placeholder, className }: SearchInputProps) => {
  const { language } = useLanguage();
  const clearLabel = language === "ar" ? "مسح البحث" : language === "en" ? "Clear search" : "Effacer la recherche";
  return (
  <div className={cn("relative w-full", className)}>
    <Search className="pointer-events-none absolute top-1/2 -translate-y-1/2 left-3 rtl:left-auto rtl:right-3 h-4 w-4 text-muted-foreground" />
    <Input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      dir="auto"
      className="h-10 pl-9 pr-11 rtl:pl-11 rtl:pr-9 [&::-webkit-search-cancel-button]:hidden"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
    />
    {value ? (
      <button
        type="button"
        onClick={() => onChange("")}
        aria-label={clearLabel}
        title={clearLabel}
        className="absolute top-1/2 -translate-y-1/2 right-0.5 rtl:right-auto rtl:left-0.5 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    ) : null}
  </div>
  );
};

export default SearchInput;

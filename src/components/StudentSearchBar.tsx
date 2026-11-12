import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchInput from "@/components/SearchInput";
import { useLanguage } from "@/contexts/LanguageContext";
import type { StudentSearchMode } from "@/lib/search";

interface Props {
  query: string;
  onQueryChange: (v: string) => void;
  mode: StudentSearchMode;
  onModeChange: (m: StudentSearchMode) => void;
  resultCount?: number;
  totalCount?: number;
  className?: string;
}

/** Recherche d'élèves : par nom, prénom, nom et prénom, code Massar ou tout à la fois */
const StudentSearchBar = ({ query, onQueryChange, mode, onModeChange, resultCount, totalCount, className }: Props) => {
  const { language } = useLanguage();
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en);

  const modes: { value: StudentSearchMode; label: string; placeholder: string }[] = [
    { value: "all", label: tr("Tout (nom, prénom, Massar)", "الكل (الاسم، النسب، مسار)", "All (name, Massar)"), placeholder: tr("Rechercher par nom, prénom ou code Massar…", "ابحث بالاسم أو النسب أو رمز مسار…", "Search by name or Massar code…") },
    { value: "lastName", label: tr("Nom", "النسب", "Last name"), placeholder: tr("Rechercher par nom…", "ابحث بالنسب…", "Search by last name…") },
    { value: "firstName", label: tr("Prénom", "الاسم", "First name"), placeholder: tr("Rechercher par prénom…", "ابحث بالاسم…", "Search by first name…") },
    { value: "fullName", label: tr("Nom et prénom", "الاسم والنسب", "Full name"), placeholder: tr("Ex. : Amine Benali", "مثال: أمين بنعلي", "e.g. Amine Benali") },
    { value: "massar", label: tr("Code Massar", "رمز مسار", "Massar code"), placeholder: tr("Ex. : D130012345", "مثال: D130012345", "e.g. D130012345") },
  ];
  const current = modes.find((m) => m.value === mode) || modes[0];

  return (
    <div className={className}>
      <div className="flex flex-col sm:flex-row gap-2">
        <SearchInput value={query} onChange={onQueryChange} placeholder={current.placeholder} className="flex-1" />
        <Select value={mode} onValueChange={(v) => onModeChange(v as StudentSearchMode)}>
          <SelectTrigger className="h-10 w-full sm:w-56" aria-label={tr("Rechercher par", "البحث حسب", "Search by")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {modes.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {query.trim() && typeof resultCount === "number" && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {tr(
            `${resultCount} élève(s) trouvé(s)${typeof totalCount === "number" ? ` sur ${totalCount}` : ""}`,
            `${resultCount} تلميذ(ة)${typeof totalCount === "number" ? ` من أصل ${totalCount}` : ""}`,
            `${resultCount} student(s) found${typeof totalCount === "number" ? ` of ${totalCount}` : ""}`
          )}
        </p>
      )}
    </div>
  );
};

export default StudentSearchBar;

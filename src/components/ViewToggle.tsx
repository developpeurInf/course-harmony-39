import { LayoutGrid, List } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface ViewToggleProps {
  view: "grid" | "table";
  onViewChange: (view: "grid" | "table") => void;
}

/** Bascule cartes / liste, au style des onglets segmentés. */
const ViewToggle = ({ view, onViewChange }: ViewToggleProps) => {
  const { language } = useLanguage();
  const gridLabel = language === "ar" ? "عرض البطاقات" : language === "fr" ? "Vue en cartes" : "Card view";
  const listLabel = language === "ar" ? "عرض الجدول" : language === "fr" ? "Vue en liste" : "List view";
  const options = [
    { value: "grid" as const, label: gridLabel, Icon: LayoutGrid },
    { value: "table" as const, label: listLabel, Icon: List },
  ];
  return (
    <div className="inline-flex h-9 items-center rounded-lg bg-muted p-[3px]" role="group">
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => onViewChange(value)}
          className={cn(
            "flex h-full w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            view === value && "bg-card text-foreground shadow-sm"
          )}
          aria-label={label}
          title={label}
          aria-pressed={view === value}
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </button>
      ))}
    </div>
  );
};

export default ViewToggle;

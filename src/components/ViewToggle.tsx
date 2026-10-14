import { Button } from "@/components/ui/button";
import { Grid3X3, List } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface ViewToggleProps {
  view: "grid" | "table";
  onViewChange: (view: "grid" | "table") => void;
}

const ViewToggle = ({ view, onViewChange }: ViewToggleProps) => {
  const { language } = useLanguage();
  const gridLabel = language === "ar" ? "عرض البطاقات" : language === "fr" ? "Vue en cartes" : "Card view";
  const listLabel = language === "ar" ? "عرض الجدول" : language === "fr" ? "Vue en liste" : "List view";
  return (
    <div className="flex items-center gap-1 border rounded-lg p-0.5" role="group">
      <Button
        variant={view === "grid" ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewChange("grid")}
        className="h-10 w-10 p-0"
        aria-label={gridLabel}
        title={gridLabel}
        aria-pressed={view === "grid"}
      >
        <Grid3X3 className="h-4 w-4" />
      </Button>
      <Button
        variant={view === "table" ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewChange("table")}
        className="h-10 w-10 p-0"
        aria-label={listLabel}
        title={listLabel}
        aria-pressed={view === "table"}
      >
        <List className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default ViewToggle;
import { Button } from "@/components/ui/button";
import { Grid3X3, List } from "lucide-react";

interface ViewToggleProps {
  view: "grid" | "table";
  onViewChange: (view: "grid" | "table") => void;
}

const ViewToggle = ({ view, onViewChange }: ViewToggleProps) => {
  return (
    <div className="flex items-center space-x-1 border rounded-md p-1">
      <Button
        variant={view === "grid" ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewChange("grid")}
        className="h-8"
      >
        <Grid3X3 className="h-4 w-4" />
      </Button>
      <Button
        variant={view === "table" ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewChange("table")}
        className="h-8"
      >
        <List className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default ViewToggle;

import { File, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PdfInfoProps {
  fileName: string;
  onView?: () => void;
  onDownload?: () => void;
  className?: string;
}

const PdfInfo = ({ fileName, onView, onDownload, className = "" }: PdfInfoProps) => {
  return (
    <div className={`flex items-center rounded-md bg-muted/50 p-2 ${className}`}>
      <div className="flex items-center flex-1 min-w-0">
        <div className="bg-primary/10 p-2 rounded mr-2">
          <File className="h-4 w-4 text-primary" />
        </div>
        <span className="text-sm font-medium truncate">
          {fileName}
        </span>
      </div>
      <div className="flex gap-1">
        {onView && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onView} 
            className="h-8 w-8 p-0"
          >
            <Eye className="h-4 w-4" />
          </Button>
        )}
        {onDownload && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onDownload} 
            className="h-8 w-8 p-0"
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default PdfInfo;

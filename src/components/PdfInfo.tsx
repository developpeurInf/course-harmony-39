
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PdfInfoProps {
  fileName: string;
  onView?: () => void;
  onDownload?: () => void;
  className?: string;
}

const PdfInfo = ({ fileName, onView, onDownload, className = "" }: PdfInfoProps) => {
  if (!fileName) return null;

  return (
    <div className={`flex items-center space-x-3 p-2 bg-muted/30 rounded-md ${className}`}>
      <div className="bg-primary/10 p-2 rounded-full">
        <FileText className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{fileName}</p>
      </div>
      <div className="flex space-x-1">
        {onView && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={onView}
            className="h-8 px-2 text-xs"
          >
            View
          </Button>
        )}
        {onDownload && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onDownload}
            className="h-8 px-2 text-xs"
          >
            <Download className="h-3 w-3 mr-1" />
            Download
          </Button>
        )}
      </div>
    </div>
  );
};

export default PdfInfo;

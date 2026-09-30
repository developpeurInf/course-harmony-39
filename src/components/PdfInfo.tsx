import { FileText, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface PdfInfoProps {
  fileName: string;
  onView?: () => void;
  onDownload?: () => void;
  className?: string;
}

const PdfInfo = ({ fileName, onView, onDownload, className = "" }: PdfInfoProps) => {
  const { language } = useLanguage();

  return (
    <div className={`flex items-center justify-between rounded-lg bg-muted/40 hover:bg-muted/70 border p-2.5 transition-colors gap-2 ${className}`}>
      <div className="flex items-center flex-1 min-w-0 mr-2">
        <div className="bg-red-100 dark:bg-red-950/40 text-red-600 p-1.5 rounded-md mr-2.5 shrink-0">
          <FileText className="h-4 w-4" />
        </div>
        <span className="text-xs font-semibold truncate" title={fileName}>
          {fileName}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onView && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onView} 
            className="h-7 text-xs px-2 gap-1 text-primary hover:bg-primary/10 border-primary/30"
            title={language === "ar" ? "معاينة PDF" : language === "fr" ? "Consulter PDF" : "View PDF"}
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{language === "ar" ? "معاينة" : language === "fr" ? "Lire" : "View"}</span>
          </Button>
        )}
        {onDownload && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onDownload} 
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title={language === "ar" ? "تحميل PDF" : language === "fr" ? "Télécharger" : "Download"}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default PdfInfo;

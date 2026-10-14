import { FileText, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface PdfInfoProps {
  fileName: string;
  /** URL du PDF : si fournie, « Ouvrir » est un vrai lien (nouvel onglet, fiable sur iPad / Android) */
  href?: string | null;
  onView?: () => void;
  onDownload?: () => void;
  className?: string;
}

const PdfInfo = ({ fileName, href, onView, onDownload, className = "" }: PdfInfoProps) => {
  const { language } = useLanguage();
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en);
  const openLabel = tr("Ouvrir", "فتح", "Open");
  const openTitle = tr(`Ouvrir ${fileName}`, `فتح ${fileName}`, `Open ${fileName}`);
  const downloadLabel = tr(`Télécharger ${fileName}`, `تحميل ${fileName}`, `Download ${fileName}`);
  const openClass = "h-9 text-xs px-2.5 gap-1 text-primary hover:bg-primary/10 border-primary/30";

  return (
    <div className={`flex items-center justify-between rounded-lg bg-muted/40 hover:bg-muted/70 border p-2.5 transition-colors gap-2 ${className}`}>
      <div className="flex items-center flex-1 min-w-0 gap-2.5">
        <div className="bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 p-1.5 rounded-md shrink-0">
          <FileText className="h-4 w-4" />
        </div>
        <span className="text-xs font-semibold truncate" title={fileName}>
          {fileName}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {href ? (
          <Button asChild variant="outline" size="sm" className={openClass}>
            <a href={href} target="_blank" rel="noopener noreferrer" title={openTitle} aria-label={openTitle}>
              <Eye className="h-3.5 w-3.5" />
              <span>{openLabel}</span>
            </a>
          </Button>
        ) : onView ? (
          <Button variant="outline" size="sm" onClick={onView} className={openClass} title={openTitle} aria-label={openTitle}>
            <Eye className="h-3.5 w-3.5" />
            <span>{openLabel}</span>
          </Button>
        ) : null}
        {onDownload && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onDownload}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            title={downloadLabel}
            aria-label={downloadLabel}
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default PdfInfo;

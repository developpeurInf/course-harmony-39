import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { File, Download, Eye, ChevronDown, ChevronRight, FolderOpen, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

interface CourseMaterial {
  id: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  uploaded_at: string;
}

interface CourseMaterialsProps {
  materials: CourseMaterial[];
  compact?: boolean;
  className?: string;
}

const CourseMaterials = ({ materials, compact = false, className = "" }: CourseMaterialsProps) => {
  const [isOpen, setIsOpen] = useState(!compact);
  const { language } = useLanguage();
  
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleViewPdf = async (material: CourseMaterial) => {
    try {
      const { data } = supabase.storage
        .from('course-materials')
        .getPublicUrl(material.file_path);
      
      if (data?.publicUrl) {
        window.open(data.publicUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      toast.error(language === "ar" ? "فشل فتح ملف PDF" : "Impossible d'ouvrir le PDF");
    }
  };

  const handleDownloadPdf = async (material: CourseMaterial) => {
    try {
      const { data } = supabase.storage
        .from('course-materials')
        .getPublicUrl(material.file_path, { download: material.file_name });

      if (data?.publicUrl) {
        const link = document.createElement('a');
        link.href = data.publicUrl;
        link.download = material.file_name;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error(language === "ar" ? "فشل تحميل ملف PDF" : "Échec du téléchargement du PDF");
    }
  };

  if (!materials || materials.length === 0) return null;

  if (compact) {
    if (materials.length === 1) {
      const singleMat = materials[0];
      return (
        <div className={`flex items-center gap-1.5 ${className}`}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleViewPdf(singleMat)}
            className="h-7 px-2 text-xs font-normal gap-1.5 text-primary hover:text-primary hover:bg-primary/10 border-primary/30 max-w-[170px]"
            title={language === "ar" ? "معاينة PDF" : language === "fr" ? "Consulter PDF" : "View PDF"}
          >
            <FileText className="h-3.5 w-3.5 text-red-500 shrink-0" />
            <span className="truncate">{singleMat.file_name}</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDownloadPdf(singleMat)}
            className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
            title={language === "ar" ? "تحميل PDF" : language === "fr" ? "Télécharger" : "Download"}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      );
    }

    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 text-xs px-2 gap-1.5 border-primary/30 text-primary">
            <FolderOpen className="h-3.5 w-3.5 text-red-500" />
            <span>{materials.length} {language === "ar" ? "ملفات PDF" : language === "fr" ? "Supports PDF" : "PDFs"}</span>
            {isOpen ? (
              <ChevronDown className="h-3 w-3 opacity-60" />
            ) : (
              <ChevronRight className="h-3 w-3 opacity-60" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="space-y-1 bg-card/80 p-1.5 rounded-md border shadow-xs min-w-[200px]">
            {materials.map((material) => (
              <div
                key={material.id}
                className="flex items-center justify-between p-1.5 hover:bg-muted/50 rounded text-xs transition-colors"
              >
                <div className="flex items-center min-w-0 flex-1 mr-2">
                  <FileText className="h-3.5 w-3.5 text-red-500 mr-1.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate text-[11px]">{material.file_name}</p>
                    {material.file_size && (
                      <p className="text-[10px] text-muted-foreground">
                        {formatFileSize(material.file_size)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleViewPdf(material)}
                    className="h-6 w-6 text-primary hover:bg-primary/10"
                    title={language === "ar" ? "عرض" : "Consulter"}
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDownloadPdf(material)}
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    title={language === "ar" ? "تحميل" : "Télécharger"}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <div className={`space-y-2.5 ${className}`}>
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-red-500" />
        <span className="font-semibold text-sm">
          {language === "ar" ? "مواد ووثائق الدرس" : language === "fr" ? "Supports de cours & Documents" : "Course Materials"}
        </span>
        <Badge variant="secondary" className="h-5 text-xs px-1.5">
          {materials.length}
        </Badge>
      </div>
      <div className="space-y-2">
        {materials.map((material) => (
          <div
            key={material.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-muted/40 hover:bg-muted/70 rounded-lg border transition-colors gap-3"
          >
            <div className="flex items-center min-w-0 flex-1">
              <div className="p-2 bg-red-100 dark:bg-red-950/40 text-red-600 rounded-md mr-3 flex-shrink-0">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{material.file_name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  {material.file_size && (
                    <span>{formatFileSize(material.file_size)}</span>
                  )}
                  <span>•</span>
                  <span>
                    {new Date(material.uploaded_at).toLocaleDateString(language === "ar" ? "ar-MA" : undefined)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleViewPdf(material)}
                className="h-8 text-xs gap-1.5"
              >
                <Eye className="h-3.5 w-3.5 text-primary" />
                <span>{language === "ar" ? "معاينة" : language === "fr" ? "Consulter" : "View"}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownloadPdf(material)}
                className="h-8 text-xs gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{language === "ar" ? "تحميل" : language === "fr" ? "Télécharger" : "Download"}</span>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CourseMaterials;
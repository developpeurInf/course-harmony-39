import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { File, Download, Eye, ChevronDown, ChevronRight, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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
        window.open(data.publicUrl, '_blank');
      }
    } catch (error) {
      toast.error('Failed to open PDF');
    }
  };

  const handleDownloadPdf = async (material: CourseMaterial) => {
    try {
      const { data, error } = await supabase.storage
        .from('course-materials')
        .download(material.file_path);

      if (error) throw error;
      
      const blob = new Blob([data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = material.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Failed to download PDF');
    }
  };

  if (materials.length === 0) return null;

  if (compact) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="h-7">
            <FolderOpen className="h-3.5 w-3.5 mr-1" />
            {materials.length} {materials.length === 1 ? 'Material' : 'Materials'}
            {isOpen ? (
              <ChevronDown className="h-3.5 w-3.5 ml-1" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="space-y-1">
            {materials.map((material) => (
              <div
                key={material.id}
                className="flex items-center justify-between p-2 bg-muted/30 rounded text-xs"
              >
                <div className="flex items-center min-w-0 flex-1">
                  <File className="h-3 w-3 text-primary mr-2 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{material.file_name}</p>
                    {material.file_size && (
                      <p className="text-muted-foreground">
                        {formatFileSize(material.file_size)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 ml-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewPdf(material)}
                    className="h-6 w-6 p-0"
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownloadPdf(material)}
                    className="h-6 w-6 p-0"
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
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <File className="h-4 w-4 text-primary" />
        <span className="font-medium">Course Materials</span>
        <Badge variant="secondary" className="h-5">
          {materials.length}
        </Badge>
      </div>
      <div className="space-y-2">
        {materials.map((material) => (
          <div
            key={material.id}
            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
          >
            <div className="flex items-center min-w-0 flex-1">
              <File className="h-4 w-4 text-primary mr-3 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{material.file_name}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {material.file_size && (
                    <span>{formatFileSize(material.file_size)}</span>
                  )}
                  <span>•</span>
                  <span>
                    {new Date(material.uploaded_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 ml-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleViewPdf(material)}
                className="h-8"
              >
                <Eye className="h-4 w-4 mr-1" />
                View
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownloadPdf(material)}
                className="h-8"
              >
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CourseMaterials;
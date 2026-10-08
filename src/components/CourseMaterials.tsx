import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Film, Image as ImageIcon, Layers } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { CourseMediaGallery, CourseViewerDialog } from '@/components/CourseMediaGallery';
import { countByKind, type CourseMaterialLike } from '@/lib/courseMedia';

interface CourseMaterial extends CourseMaterialLike {
  uploaded_at: string;
}

interface CourseMaterialsProps {
  materials: CourseMaterial[];
  compact?: boolean;
  className?: string;
  /** Course title / description shown in the viewer */
  title?: string;
  description?: string | null;
}

/**
 * compact=true  → one button with per-type counters that opens the course viewer
 * compact=false → full inline gallery (videos, images with lightbox, documents)
 */
const CourseMaterials = ({ materials, compact = false, className = "", title, description }: CourseMaterialsProps) => {
  const [open, setOpen] = useState(false);
  const { language } = useLanguage();
  const tr = (ar: string, fr: string, en: string) => (language === 'ar' ? ar : language === 'fr' ? fr : en);

  if (!materials || materials.length === 0) return null;

  if (!compact) {
    return (
      <div className={className}>
        <CourseMediaGallery materials={materials} />
      </div>
    );
  }

  const c = countByKind(materials);
  const docs = c.pdf + c.other;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={`h-7 gap-2 border-primary/30 px-2 text-xs font-medium hover:bg-primary/10 ${className}`}
        title={tr('عرض مواد الدرس', 'Voir les supports du cours', 'View course materials')}
      >
        <Layers className="h-3.5 w-3.5 text-primary" />
        {c.video > 0 && <span className="inline-flex items-center gap-0.5"><Film className="h-3.5 w-3.5 text-violet-500" />{c.video}</span>}
        {c.image > 0 && <span className="inline-flex items-center gap-0.5"><ImageIcon className="h-3.5 w-3.5 text-sky-500" />{c.image}</span>}
        {docs > 0 && <span className="inline-flex items-center gap-0.5"><FileText className="h-3.5 w-3.5 text-rose-500" />{docs}</span>}
      </Button>
      <CourseViewerDialog
        open={open}
        onOpenChange={setOpen}
        title={title || tr('مواد الدرس', 'Supports du cours', 'Course materials')}
        description={description}
        materials={materials}
      />
    </>
  );
};

export default CourseMaterials;

import { Suspense } from "react";
import { Clock, Paperclip } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LEGACY_EXERCISE_MATERIAL_PREFIX, type Exercise, type ExerciseMaterial } from "@/contexts/CourseContext";
import { CourseMediaGallery, CourseViewerDialog } from "@/components/CourseMediaGallery";
import { storagePathFromPublicUrl, type CourseMaterialLike } from "@/lib/courseMedia";
import { useAuth } from "@/contexts/AuthContext";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

// Remise de la copie (élèves seulement) : chargée à la demande
const ExerciseSubmissionPanel = lazyWithRetry(() => import("@/components/ExerciseSubmissionPanel"));

const useTr = () => {
  const { language } = useLanguage();
  return (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en);
};

/**
 * Pièces jointes à afficher pour un exercice : les lignes exercise_materials, ou à défaut
 * (migration pas encore appliquée) l'ancien fichier unique exercises.pdf_url.
 */
export const exerciseAttachments = (exercise: Exercise, materials: ExerciseMaterial[]): CourseMaterialLike[] => {
  if (materials.length > 0) return materials;
  if (!exercise.pdf_url) return [];
  const path = storagePathFromPublicUrl(exercise.pdf_url) || exercise.pdf_url;
  return [{
    id: `${LEGACY_EXERCISE_MATERIAL_PREFIX}${exercise.id}`,
    file_name: /\.pdf($|[?#])/i.test(path) ? `${exercise.title || "exercice"}.pdf` : path.split("/").pop() || path,
    file_path: path,
    file_size: null,
    uploaded_at: exercise.updated_at || exercise.created_at,
  }];
};

/** Galerie des pièces jointes d'un exercice (mêmes rendus que les supports de cours) */
export const ExerciseMediaGallery = ({ materials }: { materials: CourseMaterialLike[] }) => {
  const tr = useTr();
  return (
    <CourseMediaGallery
      materials={materials}
      emptyLabel={tr("Aucune pièce jointe pour cet exercice", "لا توجد مرفقات لهذا التمرين", "No attachments for this exercise")}
    />
  );
};

/** Fenêtre « pièces jointes de l'exercice » pour les élèves et les enseignants */
export const ExerciseViewerDialog = ({
  open, onOpenChange, exercise, materials, courseTitle, dueLabel,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  exercise: Exercise | null;
  materials: CourseMaterialLike[];
  courseTitle?: string;
  /** Date limite déjà formatée */
  dueLabel?: string;
}) => {
  const tr = useTr();
  const { user } = useAuth();
  const isStudent = user?.role === "student";
  return (
    <CourseViewerDialog
      open={open && !!exercise}
      onOpenChange={onOpenChange}
      title={exercise?.title || ""}
      description={exercise?.description}
      subtitle={courseTitle}
      materials={materials}
      fallbackDescription={tr("Pièces jointes de l'exercice", "مرفقات التمرين", "Exercise attachments")}
      emptyLabel={tr("Aucune pièce jointe pour cet exercice", "لا توجد مرفقات لهذا التمرين", "No attachments for this exercise")}
      footer={isStudent && exercise ? (
        <Suspense fallback={null}>
          <ExerciseSubmissionPanel exercise={exercise} />
        </Suspense>
      ) : undefined}
      meta={
        <>
          {dueLabel && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 font-semibold text-amber-700 dark:text-amber-300">
              <Clock className="h-3.5 w-3.5" />
              {dueLabel}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 font-semibold text-muted-foreground">
            <Paperclip className="h-3.5 w-3.5" />
            {materials.length} {tr(materials.length > 1 ? "pièces jointes" : "pièce jointe", "مرفق", materials.length > 1 ? "attachments" : "attachment")}
          </span>
        </>
      }
    />
  );
};

export default ExerciseMediaGallery;

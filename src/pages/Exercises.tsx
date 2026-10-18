
import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCourses, Exercise, Course } from "@/contexts/CourseContext";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Plus, Eye, EyeOff, Edit, Trash2, BookOpen, Clock, Loader2, X, Paperclip, Film, Image as ImageIcon } from "lucide-react";
import ViewToggle from "@/components/ViewToggle";
import { formatDate, toLocalDateInput, localEndOfDayIso } from "@/lib/formatDate";
import { useNow } from "@/hooks/useNow";
import MultiPdfUpload, { type VideoLinkDraft } from "@/components/MultiPdfUpload";
import { ExerciseViewerDialog, exerciseAttachments } from "@/components/ExerciseMediaGallery";
import { countByKind, type CourseMaterialLike } from "@/lib/courseMedia";
import { toast } from "sonner";
import SearchInput from "@/components/SearchInput";
import { matchesText } from "@/lib/search";

const Exercises = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { roomId } = useParams();
  const {
    exercises, courses, addExercise, updateExercise, deleteExercise, toggleExerciseVisibility, refreshData,
    getVisibleExercisesForStudent, loading: dataLoading,
    exerciseMaterials, loadExerciseMaterials, uploadExerciseMaterials, addExerciseVideoLink, deleteExerciseMaterial,
  } = useCourses();
  const location = useLocation();
  const navigate = useNavigate();
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en);
  const nowTs = useNow();
  // Filtre « ?course=<id> » (liens depuis le tableau de bord / les cours)
  const courseFilter = new URLSearchParams(location.search).get("course");
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [exerciseToDelete, setExerciseToDelete] = useState<Exercise | null>(null);
  const [formData, setFormData] = useState({
    id: "",
    course_id: "",
    title: "",
    description: "",
    due_date: "",
    is_visible: true,
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [videoLinks, setVideoLinks] = useState<VideoLinkDraft[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  /** Pièce jointe en cours de suppression (bouton occupé) */
  const [removingAttachmentId, setRemovingAttachmentId] = useState<string | null>(null);
  /** Exercice dont on affiche les pièces jointes */
  const [viewerExerciseId, setViewerExerciseId] = useState<string | null>(null);

  // Pièces jointes regroupées par exercice (repli sur l'ancien pdf_url)
  const materialsByExercise = useMemo(() => {
    const map = new Map<string, typeof exerciseMaterials>();
    exerciseMaterials.forEach(m => {
      const list = map.get(m.exercise_id);
      if (list) list.push(m);
      else map.set(m.exercise_id, [m]);
    });
    return map;
  }, [exerciseMaterials]);
  const attachmentsOf = (exercise: Exercise): CourseMaterialLike[] =>
    exerciseAttachments(exercise, materialsByExercise.get(exercise.id) || []);
  
  const isProfessor = user?.role === "professor";
  
  // Refresh data when component mounts or when navigating between room/global views
  useEffect(() => {
    if (user && !roomId) {
      // If we're NOT in a room context (accessing /exercises directly), refresh all data
      // RoomExercises component handles refresh for room-specific context
      refreshData();
    }
  }, [user, roomId, refreshData]);
  
  const [exerciseSearch, setExerciseSearch] = useState("");
  const userExercises = useMemo(
    () => (isProfessor ? exercises : user ? getVisibleExercisesForStudent(user.id) : []),
    [isProfessor, exercises, user, getVisibleExercisesForStudent]
  );

  const dueTime = (ex: Exercise) => {
    const t = ex.due_date ? new Date(ex.due_date).getTime() : NaN;
    return isNaN(t) ? null : t;
  };

  const visibleExercises = useMemo(() => {
    let list = isProfessor ? userExercises : userExercises.filter((exercise) => exercise.is_visible);
    if (courseFilter) list = list.filter(ex => ex.course_id === courseFilter);
    list = list.filter((exercise) =>
      matchesText(
        exerciseSearch,
        exercise.title,
        exercise.description,
        (courses.find((c) => c.id === exercise.course_id) || ({} as any)).title
      )
    );
    if (!isProfessor) {
      // Élève : échéance la plus proche d'abord, sans échéance à la fin
      list = [...list].sort((a, b) => {
        const ta = dueTime(a), tb = dueTime(b);
        if (ta === null && tb === null) return 0;
        if (ta === null) return 1;
        if (tb === null) return -1;
        return ta - tb;
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userExercises, isProfessor, courseFilter, exerciseSearch, courses]);

  const formatDueDate = (dateStr: string) => formatDate(dateStr, language);

  /** Statut d'un exercice pour l'élève, d'après sa date limite */
  const dueStatus = (ex: Exercise) => {
    const t = dueTime(ex);
    if (t === null) return { label: tr("Sans échéance", "بدون موعد", "No due date"), cls: "bg-muted text-muted-foreground border-transparent" };
    if (t < nowTs) return { label: tr("En retard", "متأخر", "Overdue"), cls: "bg-rose-500/10 text-rose-700 border-rose-300 dark:text-rose-300 dark:border-rose-800" };
    if (t - nowTs <= 2 * 86400000) return { label: tr("Bientôt", "قريباً", "Due soon"), cls: "bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-300 dark:border-amber-800" };
    return { label: tr("À rendre", "للتسليم", "To do"), cls: "bg-sky-500/10 text-sky-700 border-sky-300 dark:text-sky-300 dark:border-sky-800" };
  };
  const filterCourseName = courseFilter ? (courses.find(c => c.id === courseFilter)?.title || tr("Cours inconnu", "درس غير معروف", "Unknown course")) : null;

  const [isSubmitting, setIsSubmitting] = useState(false);
  // Verrou synchrone : bloque les doubles / triples clics avant même le re-rendu
  const submitLockRef = useRef(false);

  const resetForm = () => {
    // Determine default course_id if available
    let defaultCourseId = "";
    if (courses && courses.length > 0) {
      if (roomId) {
        const roomCourse = courses.find(c => c.room_id === roomId);
        if (roomCourse) defaultCourseId = roomCourse.id;
      }
      if (!defaultCourseId && courses.length === 1) {
        defaultCourseId = courses[0].id;
      }
    }

    // Default due date: tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defaultDueDate = toLocalDateInput(tomorrow);

    setFormData({
      id: "",
      course_id: defaultCourseId,
      title: "",
      description: "",
      due_date: defaultDueDate,
      is_visible: true,
    });
    setSelectedFiles([]);
    setVideoLinks([]);
  };

  /** Envoie les fichiers et liens vidéo choisis vers les pièces jointes de l'exercice */
  const saveAttachments = async (exerciseId: string, courseId: string) => {
    if (selectedFiles.length > 0) {
      try {
        await uploadExerciseMaterials(exerciseId, selectedFiles, courseId);
      } catch (err) {
        console.error("Error uploading exercise files:", err);
      }
    }
    for (const link of videoLinks) {
      try {
        await addExerciseVideoLink(exerciseId, link.url, link.title);
      } catch (err) {
        console.error("Error adding exercise video link:", err);
      }
    }
  };

  const handleRemoveAttachment = async (materialId: string) => {
    if (removingAttachmentId) return;
    setRemovingAttachmentId(materialId);
    try {
      await deleteExerciseMaterial(materialId);
    } finally {
      setRemovingAttachmentId(null);
    }
  };

  const handleAddExercise = async () => {
    if (isSubmitting || submitLockRef.current) return;

    if (!formData.title.trim()) {
      toast.error(language === "ar" ? "يرجى إدخال عنوان التمرين" : "Veuillez entrer un titre pour l'exercice");
      return;
    }

    if (!formData.course_id) {
      toast.error(language === "ar" ? "يرجى اختيار الدرس" : "Veuillez sélectionner un cours");
      return;
    }

    if (!formData.due_date) {
      toast.error(language === "ar" ? "يرجى تحديد تاريخ التسليم" : "Veuillez indiquer une date limite");
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      const newExercise = await addExercise({
        course_id: formData.course_id,
        title: formData.title.trim(),
        description: formData.description,
        // Fin de journée locale (23:59:59) et non minuit UTC
        due_date: localEndOfDayIso(formData.due_date) || new Date(formData.due_date).toISOString(),
        is_visible: formData.is_visible,
      });

      if (newExercise) {
        await saveAttachments(newExercise.id, formData.course_id);
        resetForm();
        setIsAddDialogOpen(false);
      }
    } catch (err) {
      console.error("Error in handleAddExercise:", err);
      toast.error(language === "ar" ? "فشل إنشاء التمرين" : "Échec de création de l'exercice");
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleEditExercise = async () => {
    if (isSubmitting || submitLockRef.current || !formData.id) return;

    if (!formData.title.trim()) {
      toast.error(language === "ar" ? "يرجى إدخال عنوان التمرين" : "Veuillez entrer un titre pour l'exercice");
      return;
    }

    if (!formData.course_id) {
      toast.error(language === "ar" ? "يرجى اختيار الدرس" : "Veuillez sélectionner un cours");
      return;
    }

    if (!formData.due_date) {
      toast.error(language === "ar" ? "يرجى تحديد تاريخ التسليم" : "Veuillez indiquer une date limite");
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      const success = await updateExercise(formData.id, {
        course_id: formData.course_id,
        title: formData.title.trim(),
        description: formData.description,
        // Fin de journée locale (23:59:59) et non minuit UTC
        due_date: localEndOfDayIso(formData.due_date) || new Date(formData.due_date).toISOString(),
        is_visible: formData.is_visible,
      });

      // Nouveaux fichiers / liens : ajoutés aux pièces jointes existantes
      if (success) await saveAttachments(formData.id, formData.course_id);

      if (success) {
        resetForm();
        setIsEditDialogOpen(false);
      }
    } catch (err) {
      console.error("Error in handleEditExercise:", err);
      toast.error(language === "ar" ? "فشل تحديث التمرين" : "Échec de la mise à jour");
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (exercise: Exercise) => {
    setFormData({
      id: exercise.id,
      course_id: exercise.course_id,
      title: exercise.title,
      description: exercise.description,
      due_date: toLocalDateInput(exercise.due_date), // date locale pour le champ
      is_visible: exercise.is_visible,
    });
    setSelectedFiles([]);
    setVideoLinks([]);
    setIsEditDialogOpen(true);
    // pièces jointes à jour (ajoutées depuis un autre appareil, etc.)
    void loadExerciseMaterials([exercise.id]);
  };

  const handleDeleteExercise = (exercise: Exercise) => {
    setExerciseToDelete(exercise);
  };

  const confirmDeleteExercise = async () => {
    if (!exerciseToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      const ok = await deleteExercise(exerciseToDelete.id);
      if (ok !== false) setExerciseToDelete(null);
    } catch (err) {
      console.error("Error deleting exercise:", err);
      toast.error(tr("Échec de la suppression", "فشل الحذف", "Delete failed"));
    } finally {
      setIsDeleting(false);
    }
  };

  const findCourseName = (courseId: string): string => {
    const course = courses.find((c) => c.id === courseId);
    return course ? course.title : tr("Cours inconnu", "درس غير معروف", "Unknown course");
  };

  const editingExercise = formData.id ? exercises.find(e => e.id === formData.id) || null : null;
  const viewerExercise = viewerExerciseId ? userExercises.find(e => e.id === viewerExerciseId) || exercises.find(e => e.id === viewerExerciseId) || null : null;

  const attachmentLabel = (n: number) =>
    language === "ar" ? `${n} مرفق` : language === "fr" ? `${n} pièce${n > 1 ? "s" : ""} jointe${n > 1 ? "s" : ""}` : `${n} attachment${n > 1 ? "s" : ""}`;

  /** Badge « n pièces jointes » */
  const renderAttachmentBadge = (exercise: Exercise) => {
    const n = attachmentsOf(exercise).length;
    if (n === 0) return null;
    return (
      <Badge variant="outline" className="text-xs gap-1">
        <Paperclip className="h-3 w-3" />
        {n}
        <span className="sr-only">{attachmentLabel(n)}</span>
      </Badge>
    );
  };

  /** Bloc cliquable qui ouvre la galerie des pièces jointes */
  const renderAttachments = (exercise: Exercise) => {
    const items = attachmentsOf(exercise);
    if (items.length === 0) return null;
    const c = countByKind(items);
    const docs = c.pdf + c.other;
    return (
      <button
        type="button"
        onClick={() => setViewerExerciseId(exercise.id)}
        className="flex w-full items-center gap-3 rounded-lg border bg-muted/30 p-3 text-start transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`${tr("Voir les pièces jointes", "عرض المرفقات", "View attachments")} : ${exercise.title} (${attachmentLabel(items.length)})`}
      >
        <span className="rounded-md bg-primary/10 p-2 shrink-0">
          <Paperclip className="h-4 w-4 text-primary" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{attachmentLabel(items.length)}</span>
          <span className="block truncate text-xs text-muted-foreground" title={items.map(m => m.file_name).join(", ")}>
            {items.map(m => m.file_name).join(" · ")}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground" aria-hidden="true">
          {docs > 0 && <span className="inline-flex items-center gap-0.5"><FileText className="h-3.5 w-3.5 text-rose-500" />{docs}</span>}
          {c.image > 0 && <span className="inline-flex items-center gap-0.5"><ImageIcon className="h-3.5 w-3.5 text-sky-500" />{c.image}</span>}
          {c.video > 0 && <span className="inline-flex items-center gap-0.5"><Film className="h-3.5 w-3.5 text-violet-500" />{c.video}</span>}
        </span>
      </button>
    );
  };

  /** Zone d'envoi commune aux fenêtres de création / modification */
  const renderUploader = (existing: CourseMaterialLike[]) => (
    <MultiPdfUpload
      onFilesChange={setSelectedFiles}
      selectedFiles={selectedFiles}
      maxFiles={15}
      maxSizeMB={50}
      permissionScope="exercise"
      videoLinks={videoLinks}
      onVideoLinksChange={setVideoLinks}
      existingFiles={existing}
      onRemoveExisting={existing.length > 0 ? handleRemoveAttachment : undefined}
      removingId={removingAttachmentId}
      disabled={isSubmitting}
    />
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {language === "ar" ? "التمارين" : language === "fr" ? "Exercices" : "Exercises"}
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            {isProfessor
              ? tr("Gérer et consulter les exercices associés aux cours", "إدارة وعرض التمارين المرتبطة بالدروس", "Manage and view exercises linked to courses")
              : tr("Tes exercices à faire, du plus urgent au moins urgent", "تمارينك المطلوبة، من الأكثر استعجالاً", "Your exercises to do, most urgent first")}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
          {/* View Toggle */}
          <ViewToggle
            view={viewMode === "grid" ? "grid" : "table"}
            onViewChange={(v) => setViewMode(v === "grid" ? "grid" : "list")}
          />
          
          {isProfessor && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="shadow-elegant text-xs sm:text-sm" onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-1.5 sm:mr-2" />
                  {t("exercise.add")}
                </Button>
              </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("exercise.add")}</DialogTitle>
                <DialogDescription>
                  {language === "ar" ? "إنشاء تمرين جديد وربطه بدرس" : language === "fr" ? "Créer un nouvel exercice et le lier à un cours" : "Create a new exercise and link it to a course"}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="course">{t("nav.courses")}</Label>
                  <Select
                    value={formData.course_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, course_id: value })
                    }
                  >
                    <SelectTrigger id="course">
                      <SelectValue placeholder={t("nav.courses")} />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map((course: Course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="title">{t("form.title")}</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">{t("form.description")}</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dueDate">{t("form.dueDate")}</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) =>
                      setFormData({ ...formData, due_date: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="visible">{t("form.visible")}</Label>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="visible"
                      checked={formData.is_visible}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, is_visible: checked })
                      }
                    />
                    <Label htmlFor="visible">{formData.is_visible ? t("app.view") : t("app.view")}</Label>
                  </div>
                </div>
                
                {/* Pièces jointes (PDF, images, vidéos, liens YouTube) */}
                <div className="grid gap-2">
                  <Label>{tr("Pièces jointes", "المرفقات", "Attachments")}</Label>
                  {renderUploader([])}
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSubmitting}>
                  {t("app.cancel")}
                </Button>
                <Button 
                  onClick={handleAddExercise}
                  disabled={isSubmitting || !formData.title.trim() || !formData.course_id || !formData.due_date}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {language === "ar" ? "جاري الإنشاء..." : language === "fr" ? "Création en cours..." : "Creating..."}
                    </>
                  ) : (
                    t("form.create")
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      {/* Recherche */}
      <SearchInput
        value={exerciseSearch}
        onChange={setExerciseSearch}
        placeholder={language === "ar" ? "ابحث عن تمرين (العنوان، الوصف، الدرس…)" : language === "fr" ? "Rechercher un exercice (titre, description, cours…)" : "Search an exercise (title, description, course…)"}
        className="sm:max-w-xl"
      />

      {filterCourseName && (
        <div className="flex">
          <span className="inline-flex items-center gap-1 rounded-full border bg-primary/5 py-1 pl-3 pr-1 rtl:pl-1 rtl:pr-3 text-sm">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            {tr("Filtré :", "مصفّى:", "Filtered:")} <span className="font-semibold">{filterCourseName}</span>
            <button
              type="button"
              onClick={() => navigate(location.pathname)}
              className="ml-1 rtl:ml-0 rtl:mr-1 inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted"
              aria-label={tr("Retirer le filtre", "إزالة التصفية", "Remove filter")}
              title={tr("Retirer le filtre", "إزالة التصفية", "Remove filter")}
            >
              <X className="h-4 w-4" />
            </button>
          </span>
        </div>
      )}

      {/* Exercises Display */}
      {dataLoading && userExercises.length === 0 ? (
        <div className="space-y-4" aria-busy="true" aria-label={tr("Chargement…", "جارٍ التحميل…", "Loading…")}>
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-lg border p-6 space-y-3">
              <div className="h-5 w-1/2 rounded bg-muted motion-safe:animate-pulse" />
              <div className="h-3 w-1/4 rounded bg-muted motion-safe:animate-pulse" />
              <div className="h-3 w-full rounded bg-muted motion-safe:animate-pulse" />
            </div>
          ))}
        </div>
      ) : visibleExercises.length > 0 ? (
        viewMode === "grid" ? (
          // Grid View
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleExercises.map((exercise) => (
              <Card key={exercise.id} className="group card-hover overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-primary/10 rounded">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <CardTitle className="text-lg line-clamp-1 group-hover:text-primary transition-colors">
                          {exercise.title}
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          <BookOpen className="h-3 w-3 mr-1 rtl:mr-0 rtl:ml-1" />
                          {findCourseName(exercise.course_id)}
                        </Badge>
                        {renderAttachmentBadge(exercise)}
                        {isProfessor ? (
                          <Badge variant={exercise.is_visible ? "default" : "secondary"} className="text-xs">
                            {exercise.is_visible 
                              ? (language === "ar" ? "مرئي" : language === "fr" ? "Visible" : "Visible") 
                              : (language === "ar" ? "مخفي" : language === "fr" ? "Masqué" : "Hidden")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className={`text-xs ${dueStatus(exercise).cls}`}>
                            {dueStatus(exercise).label}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  {exercise.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {exercise.description}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
                    <Clock className="h-4 w-4" />
                    <span>{language === "ar" ? "تاريخ التسليم: " : language === "fr" ? "Date limite : " : "Due: "}{formatDueDate(exercise.due_date)}</span>
                  </div>
                  
                  {/* Pièces jointes */}
                  {renderAttachments(exercise)}
                </CardContent>
                
                {isProfessor && (
                  <CardFooter className="pt-3 flex gap-2 border-t bg-muted/30">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleExerciseVisibility(exercise.id)}
                      className="flex-1"
                    >
                      {exercise.is_visible ? (
                        <>
                          <EyeOff className="h-4 w-4 mr-1" />
                          {language === "ar" ? "إخفاء" : language === "fr" ? "Masquer" : "Hide"}
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 mr-1" />
                          {language === "ar" ? "إظهار" : language === "fr" ? "Afficher" : "Show"}
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(exercise)}
                      className="h-9 w-9 p-0"
                      aria-label={tr("Modifier", "تعديل", "Edit")}
                      title={tr("Modifier", "تعديل", "Edit")}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteExercise(exercise)}
                      className="h-9 w-9 p-0 text-destructive hover:text-destructive"
                      aria-label={tr("Supprimer", "حذف", "Delete")}
                      title={tr("Supprimer", "حذف", "Delete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                )}
              </Card>
            ))}
          </div>
        ) : (
          // List View
          <div className="space-y-4">
            {visibleExercises.map((exercise) => (
              <Card key={exercise.id} className="group card-hover overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  <div className="flex-1 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-3 mb-2">
                          <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-xl font-semibold group-hover:text-primary transition-colors">
                              {exercise.title}
                            </h3>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                <BookOpen className="h-3 w-3 mr-1 rtl:mr-0 rtl:ml-1" />
                                {findCourseName(exercise.course_id)}
                              </Badge>
                              {renderAttachmentBadge(exercise)}
                              {isProfessor ? (
                                <Badge variant={exercise.is_visible ? "default" : "secondary"} className="text-xs">
                                  {exercise.is_visible 
                                    ? (language === "ar" ? "مرئي" : language === "fr" ? "Visible" : "Visible") 
                                    : (language === "ar" ? "مخفي" : language === "fr" ? "Masqué" : "Hidden")}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className={`text-xs ${dueStatus(exercise).cls}`}>
                                  {dueStatus(exercise).label}
                                </Badge>
                              )}
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                <span>{language === "ar" ? "تاريخ التسليم: " : language === "fr" ? "Date limite : " : "Due: "}{formatDueDate(exercise.due_date)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {exercise.description && (
                          <p className="text-muted-foreground mt-3 leading-relaxed">
                            {exercise.description}
                          </p>
                        )}
                        
                        {/* Pièces jointes */}
                        {attachmentsOf(exercise).length > 0 && (
                          <div className="mt-4 max-w-xl">
                            {renderAttachments(exercise)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {isProfessor && (
                    <div className="flex md:flex-col gap-2 p-4 border-t md:border-t-0 md:border-l bg-muted/30 md:w-32 justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleExerciseVisibility(exercise.id)}
                        className="h-9 flex-1 md:flex-none"
                        aria-label={exercise.is_visible ? tr("Masquer", "إخفاء", "Hide") : tr("Afficher", "إظهار", "Show")}
                      >
                        {exercise.is_visible ? (
                          <>
                            <EyeOff className="h-4 w-4 md:mr-0 mr-1" />
                            <span className="md:hidden">{language === "ar" ? "إخفاء" : language === "fr" ? "Masquer" : "Hide"}</span>
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4 md:mr-0 mr-1" />
                            <span className="md:hidden">{language === "ar" ? "إظهار" : language === "fr" ? "Afficher" : "Show"}</span>
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(exercise)}
                        className="h-9 flex-1 md:flex-none"
                        aria-label={tr("Modifier", "تعديل", "Edit")}
                        title={tr("Modifier", "تعديل", "Edit")}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteExercise(exercise)}
                        className="h-9 flex-1 md:flex-none text-destructive hover:text-destructive"
                        aria-label={tr("Supprimer", "حذف", "Delete")}
                        title={tr("Supprimer", "حذف", "Delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 bg-primary/10 rounded-full mb-4">
              <FileText className="h-12 w-12 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{language === "ar" ? "لم يتم العثور على تمارين" : language === "fr" ? "Aucun exercice trouvé" : "No exercises found"}</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              {language === "ar"
                ? isProfessor
                  ? "لم يتم إنشاء أي تمارين بعد. أضف أول تمرين للبدء."
                  : "لا توجد تمارين متاحة حاليًا."
                : isProfessor 
                  ? (language === "fr" ? "Aucun exercice n'a encore été créé. Ajoutez votre premier exercice pour commencer." : "No exercises have been created yet. Add your first exercise to get started.")
                  : (language === "fr" ? "Aucun exercice n'est disponible pour le moment." : "No exercises are currently available.")}
            </p>
            {isProfessor && (
              <Button onClick={() => setIsAddDialogOpen(true)} className="shadow-elegant">
                <Plus className="h-4 w-4 mr-2" />
                {language === "ar" ? "أضف أول تمرين" : language === "fr" ? "Ajouter votre premier exercice" : "Add Your First Exercise"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Exercise Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("exercise.edit")}</DialogTitle>
            <DialogDescription>
              {language === "ar" ? "تحديث تفاصيل التمرين والمواد" : language === "fr" ? "Mettre à jour les détails de l'exercice et les supports" : "Update exercise details and materials"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-course">{t("nav.courses")}</Label>
              <Select
                value={formData.course_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, course_id: value })
                }
              >
                <SelectTrigger id="edit-course">
                  <SelectValue placeholder={t("nav.courses")} />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-title">{t("form.title")}</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">{t("form.description")}</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-dueDate">{t("form.dueDate")}</Label>
              <Input
                id="edit-dueDate"
                type="date"
                value={formData.due_date}
                onChange={(e) =>
                  setFormData({ ...formData, due_date: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-visible">{t("form.visible")}</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-visible"
                  checked={formData.is_visible}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_visible: checked })
                  }
                />
                <Label htmlFor="edit-visible">{formData.is_visible ? t("app.view") : t("app.view")}</Label>
              </div>
            </div>
            
            {/* Pièces jointes : existantes (supprimables) + nouvelles */}
            <div className="grid gap-2">
              <Label>{tr("Pièces jointes", "المرفقات", "Attachments")}</Label>
              {renderUploader(editingExercise ? attachmentsOf(editingExercise) : [])}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSubmitting}>
              {t("app.cancel")}
            </Button>
            <Button 
              onClick={handleEditExercise}
              disabled={isSubmitting || !formData.title.trim() || !formData.course_id || !formData.due_date}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {language === "ar" ? "جاري التحديث..." : language === "fr" ? "Mise à jour..." : "Updating..."}
                </>
              ) : (
                t("form.update")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pièces jointes d'un exercice */}
      <ExerciseViewerDialog
        open={!!viewerExercise}
        onOpenChange={(open) => { if (!open) setViewerExerciseId(null); }}
        exercise={viewerExercise}
        materials={viewerExercise ? attachmentsOf(viewerExercise) : []}
        courseTitle={viewerExercise ? findCourseName(viewerExercise.course_id) : undefined}
        dueLabel={viewerExercise?.due_date ? `${tr("Date limite :", "تاريخ التسليم:", "Due:")} ${formatDueDate(viewerExercise.due_date)}` : undefined}
      />

      {/* Delete Exercise Confirmation Dialog */}
      <Dialog open={!!exerciseToDelete} onOpenChange={(open) => { if (!open && !isDeleting) setExerciseToDelete(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "حذف التمرين" : language === "fr" ? "Supprimer l'exercice" : "Delete Exercise"}
            </DialogTitle>
            <DialogDescription>
              {language === "ar"
                ? `هل أنت متأكد من رغبتك في حذف "${exerciseToDelete?.title}"؟ لا يمكن التراجع عن هذا الإجراء.`
                : language === "fr"
                ? `Êtes-vous sûr de vouloir supprimer "${exerciseToDelete?.title}" ? Cette action est irréversible.`
                : `Are you sure you want to delete "${exerciseToDelete?.title}"? This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExerciseToDelete(null)} disabled={isDeleting}>
              {language === "ar" ? "إلغاء" : language === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={confirmDeleteExercise} disabled={isDeleting} className="gap-2">
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {language === "ar" ? "حذف التمرين" : language === "fr" ? "Supprimer l'exercice" : "Delete Exercise"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Exercises;

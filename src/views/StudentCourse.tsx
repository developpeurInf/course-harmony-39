import { useEffect, useMemo, useState } from "react";
import { BookOpen, Building, CheckCircle2, ChevronRight, ClipboardCheck, FileText, Layers } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markCourseOpened, setCourseRead, useCourseProgress } from "@/lib/courseProgress";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses, type Exercise } from "@/contexts/CourseContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useParams, Link } from "@/lib/router";
import { CourseScenes } from "@/components/lab3d/CourseScenes";
import { cn } from "@/lib/utils";
import { useNow } from "@/hooks/useNow";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/formatDate";
import { countByKind, type CourseMaterialLike } from "@/lib/courseMedia";
import { CourseMediaGallery } from "@/components/CourseMediaGallery";
import { ExerciseViewerDialog, exerciseAttachments } from "@/components/ExerciseMediaGallery";
import { ExamRow, ExerciseRow, Section, byUrgency, dueState, examState } from "@/components/student/StudentWork";
import { useExerciseSubmissions } from "@/lib/exerciseSubmissions";

/** Page d'un cours : ses ressources, ses exercices et ses évaluations au même endroit */
const StudentCourse = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const { language } = useLanguage();
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en);
  const now = useNow();
  const {
    courses, rooms, exercises, exams, refreshData, loading,
    getVisibleCoursesForStudent, getVisibleExercisesForStudent, getVisibleExamsForStudent, getStudentQuizSubmission,
    exerciseMaterials, loadExerciseMaterials,
  } = useCourses();
  const isProfessor = user?.role === "professor";

  useEffect(() => {
    if (user) void refreshData();
  }, [user, refreshData]);

  const course = useMemo(() => {
    const list = isProfessor || !user ? courses : getVisibleCoursesForStudent(user.id);
    return list.find((c) => c.id === courseId) || null;
  }, [isProfessor, user, courses, courseId, getVisibleCoursesForStudent]);

  const courseExercises = useMemo(() => {
    const list = isProfessor || !user ? exercises : getVisibleExercisesForStudent(user.id).filter((e) => e.is_visible);
    return list.filter((e) => e.course_id === courseId).sort(byUrgency);
  }, [isProfessor, user, exercises, courseId, getVisibleExercisesForStudent]);

  const courseExams = useMemo(() => {
    const list = isProfessor || !user ? exams : getVisibleExamsForStudent(user.id);
    return list
      .filter((e) => e.course_id === courseId)
      .sort((a, b) => new Date(a.available_until || a.exam_date || 0).getTime() - new Date(b.available_until || b.exam_date || 0).getTime());
  }, [isProfessor, user, exams, courseId, getVisibleExamsForStudent]);

  // Ressources du cours
  const [materials, setMaterials] = useState<CourseMaterialLike[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    setMaterialsLoading(true);
    supabase
      .from("course_materials")
      .select("*")
      .eq("course_id", courseId)
      .order("uploaded_at", { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        setMaterials(((data as (CourseMaterialLike & { course_id?: string })[]) || []).filter((m) => !m.course_id || m.course_id === courseId));
        setMaterialsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  // Progression de lecture : ouverture enregistrée, « Marquer comme lu »
  const progress = useCourseProgress(isProfessor ? undefined : user?.id);
  const [readAt, setReadAt] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (courseId && progress[courseId]) setReadAt(progress[courseId].read_at);
  }, [progress, courseId]);
  useEffect(() => {
    if (!isProfessor && user && courseId && course) void markCourseOpened(user.id, courseId);
  }, [isProfessor, user, courseId, course]);
  const toggleRead = async () => {
    if (!user || !courseId) return;
    const next = !readAt;
    if (await setCourseRead(user.id, courseId, next)) {
      setReadAt(next ? new Date().toISOString() : null);
      if (next) toast.success(tr("Chapitre marqué comme lu", "تم تعليم الدرس كمقروء", "Chapter marked as read"));
    }
  };

  // Pièces jointes des exercices
  const exerciseIds = courseExercises.map((e) => e.id).join(",");
  useEffect(() => {
    if (exerciseIds) void loadExerciseMaterials(exerciseIds.split(","));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseIds]);
  const attachmentsOf = (ex: Exercise) => exerciseAttachments(ex, exerciseMaterials.filter((m) => m.exercise_id === ex.id));
  const [viewer, setViewer] = useState<Exercise | null>(null);
  // Copies déjà rendues par l'élève (badge « Rendu » / « Corrigé »)
  const exerciseIdList = useMemo(() => (isProfessor ? [] : courseExercises.map((e) => e.id)), [isProfessor, courseExercises]);
  const { byExercise: subsByExercise } = useExerciseSubmissions(exerciseIdList);
  const mySubmission = (ex: Exercise) => {
    const s = subsByExercise.get(ex.id)?.find((x) => x.student_id === user?.id);
    return s ? { status: s.status, grade: s.grade, max_grade: s.max_grade } : undefined;
  };

  if (!course) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        {loading ? (
          <p className="text-sm text-muted-foreground">{tr("Chargement…", "جارٍ التحميل…", "Loading…")}</p>
        ) : (
          <>
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <h1 className="text-lg font-semibold">{tr("Cours introuvable", "الدرس غير موجود", "Course not found")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{tr("Ce cours n'existe pas ou n'est plus visible.", "هذا الدرس غير موجود أو لم يعد مرئياً.", "This course doesn't exist or is no longer visible.")}</p>
            <Link to="/courses" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">{tr("Retour aux cours", "العودة إلى الدروس", "Back to courses")}</Link>
          </>
        )}
      </div>
    );
  }

  const roomName = rooms.find((r) => r.id === course.room_id)?.name;
  const counts = countByKind(materials);
  const late = courseExercises.filter((e) => dueState(e, now) === "late" && !mySubmission(e)).length;
  const pending = courseExercises.filter((e) => ["late", "soon", "todo"].includes(dueState(e, now)) && !mySubmission(e)).length;

  const summary = [
    { href: "#ressources", icon: Layers, value: materials.length, label: tr("ressources", "موارد", "resources") },
    { href: "#exercices", icon: FileText, value: courseExercises.length, label: tr("exercices", "تمارين", "exercises"), note: late ? tr(`${late} en retard`, `${late} متأخر`, `${late} overdue`) : pending ? tr(`${pending} à rendre`, `${pending} للتسليم`, `${pending} to do`) : undefined, warn: late > 0 },
    { href: "#evaluations", icon: ClipboardCheck, value: courseExams.length, label: tr("examens et quiz", "امتحانات واختبارات", "exams & quizzes") },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
      {/* Fil d'Ariane */}
      <nav aria-label={tr("Fil d'Ariane", "مسار التنقل", "Breadcrumb")} className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/courses" className="hover:text-foreground">{tr("Cours", "الدروس", "Courses")}</Link>
        <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
        <span className="truncate text-foreground">{course.title}</span>
      </nav>

      {/* En-tête du cours */}
      <header className="space-y-3">
        {roomName && (
          <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Building className="h-3.5 w-3.5" />
            {roomName}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{course.title}</h1>
        {course.description && <p className="max-w-3xl whitespace-pre-line text-muted-foreground">{course.description}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-muted-foreground">{tr("Mis à jour le", "آخر تحديث", "Updated")} {formatDate(course.updated_at || course.created_at, language)}</p>
          {!isProfessor && user && (
            <Button size="sm" variant={readAt ? "secondary" : "outline"} className="h-8 gap-1.5" onClick={toggleRead}>
              <CheckCircle2 className={cn("h-3.5 w-3.5", readAt && "text-emerald-600")} />
              {readAt ? tr("Lu ✓", "مقروء ✓", "Read ✓") : tr("Marquer comme lu", "تعليم كمقروء", "Mark as read")}
            </Button>
          )}
        </div>
      </header>

      {/* Résumé : accès direct aux sections */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {summary.map(({ href, icon: Icon, value, label, note, warn }) => (
          <a key={href} href={href} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-3 transition-colors hover:border-foreground/20 sm:px-4">
            <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted sm:flex">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-semibold leading-tight tabular-nums">{value}</span>
              <span className="block text-xs text-muted-foreground">
                {label}
                {note && <span className={cn("block sm:inline", warn ? "text-rose-600 dark:text-rose-400" : "text-primary")}><span className="hidden sm:inline"> · </span>{note}</span>}
              </span>
            </span>
          </a>
        ))}
      </div>

      <Section
        id="ressources"
        icon={Layers}
        title={tr("Ressources du cours", "موارد الدرس", "Course resources")}
        count={materialsLoading ? undefined : materials.length}
        empty={tr("Le professeur n'a pas encore ajouté de ressources.", "لم يضف الأستاذ موارد بعد.", "The teacher hasn't added resources yet.")}
        action={
          materials.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {[
                counts.pdf + counts.other && tr(`${counts.pdf + counts.other} document(s)`, `${counts.pdf + counts.other} وثيقة`, `${counts.pdf + counts.other} document(s)`),
                counts.video && tr(`${counts.video} vidéo(s)`, `${counts.video} فيديو`, `${counts.video} video(s)`),
                counts.image && tr(`${counts.image} image(s)`, `${counts.image} صورة`, `${counts.image} image(s)`),
              ].filter(Boolean).join(" · ")}
            </span>
          )
        }
      >
        {materialsLoading ? (
          <div className="space-y-2 p-5">
            <div className="h-4 w-1/3 rounded bg-muted motion-safe:animate-pulse" />
            <div className="h-24 rounded bg-muted motion-safe:animate-pulse" />
          </div>
        ) : (
          <div className="p-4 sm:p-5">
            <CourseMediaGallery materials={materials} />
          </div>
        )}
      </Section>

      {courseId && <CourseScenes courseId={courseId} />}

      <Section
        id="exercices"
        icon={FileText}
        title={tr("Exercices", "التمارين", "Exercises")}
        count={courseExercises.length}
        empty={tr("Aucun exercice pour ce cours pour le moment.", "لا توجد تمارين لهذا الدرس حالياً.", "No exercises for this course yet.")}
      >
        <ul className="divide-y">
          {courseExercises.map((ex) => (
            <ExerciseRow key={ex.id} exercise={ex} attachments={attachmentsOf(ex).length} now={now} language={language} tr={tr} onOpen={() => setViewer(ex)} submission={mySubmission(ex)} />
          ))}
        </ul>
      </Section>

      <Section
        id="evaluations"
        icon={ClipboardCheck}
        title={tr("Examens et quiz", "الامتحانات والاختبارات", "Exams & quizzes")}
        count={courseExams.length}
        empty={tr("Aucun examen ni quiz pour ce cours.", "لا توجد امتحانات أو اختبارات لهذا الدرس.", "No exams or quizzes for this course.")}
      >
        <ul className="divide-y">
          {courseExams.map((exam) => {
            const submitted = !!(user && getStudentQuizSubmission(exam.id, user.id));
            return (
              <ExamRow
                key={exam.id}
                exam={exam}
                state={examState(exam, now, submitted)}
                language={language}
                tr={tr}
                href={exam.type === "quiz" && !isProfessor ? `/exams?quiz=${exam.id}` : `/exams?course=${course.id}`}
              />
            );
          })}
        </ul>
      </Section>

      <ExerciseViewerDialog
        open={!!viewer}
        onOpenChange={(o) => !o && setViewer(null)}
        exercise={viewer}
        materials={viewer ? attachmentsOf(viewer) : []}
        courseTitle={course.title}
        dueLabel={viewer?.due_date ? `${tr("Date limite :", "آخر أجل:", "Due:")} ${formatDate(viewer.due_date, language)}` : undefined}
      />
    </div>
  );
};

export default StudentCourse;

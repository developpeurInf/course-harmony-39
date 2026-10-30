import { accessStore } from "@/contexts/AccessContext";
import { PublishToLibraryButton } from "@/components/library/LibraryShared";
import { RequirePermission } from "@/components/access/AccessUi";
import { CopyToDialog, type CopySource } from "@/components/CopyToDialog";

import { useState, useEffect, useRef, useMemo, useDeferredValue, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses, Exam } from "@/contexts/CourseContext";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter,
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Calendar, 
  Eye, 
  EyeOff, 
  Edit, 
  Trash, 
  Trash2,
  Plus,
  PlusCircle,
  Clock,
  LayoutGrid,
  LayoutList,
  BookOpen,
  Settings,
  Play,
  Trophy,
  Loader2,
  AlertCircle,
  CheckCircle,
  CheckCircle2,
  Copy,
  Timer,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import QuizTaker, { type QuizPhase } from "@/components/QuizTaker";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { useNow } from "@/hooks/useNow";
import { toLocalDateInput, toLocalTimeInput, formatDecimal } from "@/lib/formatDate";
import { format } from "date-fns";
import { useLocation, useNavigate, useParams } from "@/lib/router";
import ViewToggle from "@/components/ViewToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { toast } from "sonner";
import SearchInput from "@/components/SearchInput";
import { matchesText } from "@/lib/search";

// Outils enseignant chargés à la demande : les élèves ne les téléchargent jamais
const QuizBuilder = lazyWithRetry(() => import("@/components/QuizBuilder"));
const QuizResults = lazyWithRetry(() => import("@/components/QuizResults"));
const QuizDetails = lazyWithRetry(() => import("@/components/QuizDetails"));

const LazyFallback = () => (
  <div className="flex items-center justify-center py-16" role="status" aria-live="polite">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const Exams = () => {
  const { t, language } = useLanguage();
  const { prefs } = usePreferences();
  const { user } = useAuth();
  const { roomId } = useParams();
  const { 
    courses, 
    exams, 
    enrollments,
    addExam, 
    updateExam, 
    deleteExam, 
    toggleExamVisibility,
    getVisibleExamsForStudent,
    refreshData,
    rooms,
    quizQuestions,
    quizSubmissions,
    loading: dataLoading
  } = useCourses();

  // Nombre de questions et total des points de chaque quiz
  const quizStats = useMemo(() => {
    const m: Record<string, { count: number; points: number }> = {};
    (quizQuestions || []).forEach(q => {
      const e = (m[q.exam_id] = m[q.exam_id] || { count: 0, points: 0 });
      e.count += 1;
      e.points += q.points || 1;
    });
    return m;
  }, [quizQuestions]);

  // Note retenue de l'élève connecté pour chaque quiz : même règle que le tableau de bord
  // (Paramètres → « tentative retenue » : dernière, meilleure ou moyenne)
  const mySubmissions = useMemo(() => {
    const m: Record<string, { score: number; total: number; count: number }> = {};
    if (!user) return m;
    const groups = new Map<string, any[]>();
    (quizSubmissions || []).filter(sub => sub.student_id === user.id).forEach((sub: any) => {
      groups.set(sub.exam_id, [...(groups.get(sub.exam_id) || []), sub]);
    });
    const time = (x: any) => new Date(x.submitted_at || 0).getTime() || 0;
    const pct = (x: any) => (Number(x.total_points) > 0 ? (Number(x.score) || 0) / Number(x.total_points) : 0);
    groups.forEach((list, examId) => {
      const sorted = [...list].sort((a, b) => time(b) - time(a)); // plus récente d'abord
      const latest = sorted[0];
      let score = Number(latest.score) || 0;
      let total = Number(latest.total_points) || 0;
      if (prefs.attemptPolicy === "best") {
        const best = sorted.reduce((acc, x) => (pct(x) > pct(acc) ? x : acc), latest);
        score = Number(best.score) || 0;
        total = Number(best.total_points) || 0;
      } else if (prefs.attemptPolicy === "average" && total > 0) {
        const avg = sorted.reduce((a, x) => a + pct(x), 0) / sorted.length;
        score = Math.round(avg * total * 100) / 100;
      }
      m[examId] = { score, total, count: sorted.length };
    });
    return m;
  }, [quizSubmissions, user, prefs.attemptPolicy]);

  const dateLocale = language === "ar" ? "ar-MA" : language === "fr" ? "fr-FR" : "en-GB";
  const fmtScore = (sc: number, tot: number) => `${formatDecimal(sc, language, 2)}/${tot}`;
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en);
  // Statuts (à venir / disponible / expiré) recalculés toutes les 30 s
  const nowTs = useNow();
  
  const location = useLocation();
  const navigate = useNavigate();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  // Cartes par défaut pour les élèves et sur tablette / téléphone (< 1024 px), tableau sinon
  const [viewMode, setViewMode] = useState<"grid" | "table">(() => {
    if (user?.role !== "professor") return "grid";
    try {
      return typeof window !== "undefined" && window.innerWidth < 1024 ? "grid" : "table";
    } catch {
      return "table";
    }
  });
  const [isDeleting, setIsDeleting] = useState(false);
  // Copie d'un quiz / examen vers un autre cours (questions comprises)
  const [copySource, setCopySource] = useState<CopySource | null>(null);
  const [quizPhase, setQuizPhase] = useState<QuizPhase>("loading");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Verrou synchrone : bloque les doubles / triples clics avant même le re-rendu
  const submitLockRef = useRef(false);
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState("");
  const [examDate, setExamDate] = useState("");
  const [examTime, setExamTime] = useState("");
  const [availableUntilDate, setAvailableUntilDate] = useState("");
  const [availableUntilTime, setAvailableUntilTime] = useState("");
  const [duration, setDuration] = useState(prefs.defaultExamDuration);
  const [isVisible, setIsVisible] = useState(true);
  const [examType, setExamType] = useState<"exam" | "quiz">("exam");
  const [currentExam, setCurrentExam] = useState<Exam | null>(null);
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>("all");
  const [showQuizBuilder, setShowQuizBuilder] = useState<string | null>(null);
  const [showQuizTaker, setShowQuizTaker] = useState<Exam | null>(null);
  const [showQuizResults, setShowQuizResults] = useState<string | null>(null);
  
  const isProfessor = user?.role === "professor";
  
  // Refresh data when component mounts or when navigating between room/global views
  useEffect(() => {
    if (user) {
      if (!roomId) {
        refreshData();
      }
    }
  }, [user, roomId, refreshData]);
  
  // Parse course ID from URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const courseParam = params.get('course');
    if (courseParam && courses.some(c => c.id === courseParam)) {
      setSelectedCourseFilter(courseParam);
    }
  }, [location.search, courses]);

  
  // Update URL when filter changes
  const updateUrlWithFilter = (courseId: string) => {
    if (courseId === "all") {
      navigate('/exams');
    } else {
      navigate(`/exams?course=${courseId}`);
    }
  };
  
  const [examSearch, setExamSearch] = useState("");
  const deferredSearch = useDeferredValue(examSearch);
  // Filter exams based on user role and selected course
  const userExams = useMemo(() => {
    const list = isProfessor ? exams : user ? getVisibleExamsForStudent(user.id) : [];
    if (!roomId) return list;
    // Page d'une classe : uniquement les évaluations de ses cours
    const roomCourseIds = new Set(courses.filter((c) => c.room_id === roomId).map((c) => c.id));
    return list.filter((e) => roomCourseIds.has(e.course_id));
  }, [isProfessor, exams, user, getVisibleExamsForStudent, roomId, courses]);
  // Index : cours par id, nombre d'élèves ayant rendu chaque quiz
  const courseById = useMemo(() => new Map(courses.map(c => [c.id, c] as [string, typeof c])), [courses]);
  const submittersByExam = useMemo(() => {
    const m = new Map<string, Set<string>>();
    (quizSubmissions || []).forEach(x => {
      const set = m.get(x.exam_id) || new Set<string>();
      set.add(x.student_id);
      m.set(x.exam_id, set);
    });
    return m;
  }, [quizSubmissions]);

  // Lien direct « ?quiz=<id> » (carte « À faire maintenant » du tableau de bord élève)
  const openedQuizRef = useRef<string | null>(null);
  useEffect(() => {
    if (isProfessor) return;
    const quizParam = new URLSearchParams(location.search).get('quiz');
    if (!quizParam || openedQuizRef.current === quizParam) return;
    const target = userExams.find(e => e.id === quizParam);
    if (target) {
      openedQuizRef.current = quizParam;
      setShowQuizTaker(target);
    }
  }, [location.search, userExams, isProfessor]);
  const displayedExams = useMemo(() => {
    const byCourse = selectedCourseFilter === "all"
      ? userExams
      : userExams.filter(exam => exam.course_id === selectedCourseFilter);
    return byCourse.filter(exam =>
      matchesText(deferredSearch, exam.title, (exam.description || "").replace(/<!--[\s\S]*?-->/g, ""), (courseById.get(exam.course_id) || ({} as any)).title, exam.type === "quiz" ? "quiz" : "examen exam امتحان")
    );
  }, [userExams, selectedCourseFilter, deferredSearch, courseById]);

  // Filter courses based on user role for the course dropdown (both room & enrollments)
  const availableCourses = isProfessor 
    ? courses 
    : courses.filter(course => 
        course.is_visible && user && (
          (user.room_id && course.room_id === user.room_id) ||
          enrollments.some(e => e.course_id === course.id && e.student_id === user.id)
        )
      );

  // Reset form with smart defaults
  const resetForm = () => {
    let defaultCourseId = "";
    if (courses && courses.length > 0) {
      if (selectedCourseFilter !== "all" && courses.some(c => c.id === selectedCourseFilter)) {
        defaultCourseId = selectedCourseFilter;
      } else if (roomId) {
        const roomCourse = courses.find(c => c.room_id === roomId);
        if (roomCourse) defaultCourseId = roomCourse.id;
      } else if (courses.length === 1) {
        defaultCourseId = courses[0].id;
      }
    }

    const todayStr = toLocalDateInput(new Date());

    setTitle("");
    setDescription("");
    setCourseId(defaultCourseId);
    setExamDate(todayStr);
    setExamTime("01:00");
    setAvailableUntilDate(todayStr);
    setAvailableUntilTime("03:00");
    setDuration(prefs.defaultExamDuration);
    setIsVisible(true);
    setExamType("exam");
    setCurrentExam(null);
  };

  // Date locale (yyyy-MM-dd) pour <input type="date"> — jamais via toISOString (UTC)
  const formatDateForInput = (dateString: string) => toLocalDateInput(dateString);

  // Heure locale (HH:mm) pour <input type="time">
  const formatTimeForInput = (dateString: string) => toLocalTimeInput(dateString);

  // Combine date and time to ISO string
  const combineDateTime = (date: string, time: string) => {
    const timeVal = time || "00:00";
    // Construction par composants (heure locale) : Safari ≤ 13 (iPad iOS 12) lit
    // "AAAA-MM-JJTHH:mm:ss" comme de l'UTC, ce qui décalait l'heure des examens.
    const [y, mo, d] = date.split("-").map(Number);
    const [h, mi] = timeVal.split(":").map(Number);
    if ([y, mo, d].every((n) => Number.isFinite(n))) {
      return new Date(y, mo - 1, d, h || 0, mi || 0, 0).toISOString();
    }
    return new Date(`${date}T${timeVal}:00`).toISOString();
  };

  // Helper to determine dynamic Quiz availability and time window
  const getQuizStatus = (exam: Exam) => {
    const now = nowTs;
    const fromTime = exam.available_from ? new Date(exam.available_from).getTime() : new Date(exam.exam_date).getTime();
    const untilTime = exam.available_until ? new Date(exam.available_until).getTime() : null;

    if (fromTime && now < fromTime) {
      return {
        status: 'upcoming' as const,
        from: new Date(fromTime),
        until: untilTime ? new Date(untilTime) : null,
        label: language === 'ar' ? 'غير متاح بعد' : language === 'fr' ? 'Pas encore disponible' : 'Not available yet',
        badgeVariant: 'secondary' as const
      };
    }

    if (untilTime && now > untilTime) {
      return {
        status: 'expired' as const,
        from: new Date(fromTime),
        until: new Date(untilTime),
        label: language === 'ar' ? 'منتهي' : language === 'fr' ? 'Expiré' : 'Expired',
        badgeVariant: 'outline' as const
      };
    }

    return {
      status: 'available' as const,
      from: new Date(fromTime),
      until: untilTime ? new Date(untilTime) : null,
      label: language === 'ar' ? 'متاح الآن' : language === 'fr' ? 'Disponible maintenant' : 'Available now',
      badgeVariant: 'default' as const
    };
  };

  // Check if exam is in the past
  const isPastExam = (dateString: string, examObj?: Exam) => {
    if (examObj && examObj.type === 'quiz') {
      return getQuizStatus(examObj).status === 'expired';
    }
    return new Date(dateString).getTime() < nowTs;
  };

  // Add new exam
  const handleAddExam = async () => {
    if (isSubmitting || submitLockRef.current) return;

    if (!title.trim()) {
      toast.error(language === "ar" ? "يرجى إدخال عنوان الامتحان" : "Veuillez entrer un titre pour l'examen");
      return;
    }

    if (!courseId) {
      toast.error(language === "ar" ? "يرجى اختيار الدرس" : "Veuillez sélectionner un cours");
      return;
    }

    if (!examDate || !examTime) {
      toast.error(language === "ar" ? "يرجى تحديد التاريخ والوقت" : "Veuillez définir la date et l'heure");
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      const startIso = combineDateTime(examDate, examTime);
      const endIso = examType === "quiz" && availableUntilTime 
        ? combineDateTime(availableUntilDate || examDate, availableUntilTime) 
        : null;

      const newExam = await addExam({
        title: title.trim(),
        description,
        course_id: courseId,
        exam_date: startIso,
        duration_minutes: duration,
        is_visible: isVisible,
        type: examType,
        available_from: startIso,
        available_until: endIso,
        ...(examType === "quiz" ? { quiz_settings: prefs.quizDefaults } : {})
      } as any);
      
      if (newExam) {
        setIsAddDialogOpen(false);
        resetForm();
        if (examType === "quiz") {
          setShowQuizBuilder(newExam.id);
        }
      }
    } catch (err) {
      console.error("Error adding exam:", err);
      toast.error(language === "ar" ? "فشل إنشاء الامتحان" : "Échec de création de l'examen");
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Edit exam
  const handleEditExam = async () => {
    if (isSubmitting || submitLockRef.current || !currentExam) return;

    if (!title.trim()) {
      toast.error(language === "ar" ? "يرجى إدخال عنوان الامتحان" : "Veuillez entrer un titre pour l'examen");
      return;
    }

    if (!courseId) {
      toast.error(language === "ar" ? "يرجى اختيار الدرس" : "Veuillez sélectionner un cours");
      return;
    }

    if (!examDate || !examTime) {
      toast.error(language === "ar" ? "يرجى تحديد التاريخ والوقت" : "Veuillez définir la date et l'heure");
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      const startIso = combineDateTime(examDate, examTime);
      const endIso = examType === "quiz" && availableUntilTime 
        ? combineDateTime(availableUntilDate || examDate, availableUntilTime) 
        : null;

      const success = await updateExam(currentExam.id, {
        title: title.trim(),
        description,
        course_id: courseId,
        exam_date: startIso,
        duration_minutes: duration,
        is_visible: isVisible,
        type: examType,
        available_from: startIso,
        available_until: endIso
      });
      
      if (success) {
        setIsEditDialogOpen(false);
        resetForm();
      }
    } catch (err) {
      console.error("Error updating exam:", err);
      toast.error(language === "ar" ? "فشل تعديل الامتحان" : "Échec de modification de l'examen");
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Delete exam
  const handleDeleteExam = async () => {
    if (!currentExam || isDeleting) return;
    setIsDeleting(true);
    try {
      const ok = await deleteExam(currentExam.id);
      if (ok !== false) {
        setIsDeleteDialogOpen(false);
        resetForm();
      }
    } catch (err) {
      console.error("Error deleting exam:", err);
      toast.error(tr("Échec de la suppression", "فشل الحذف", "Delete failed"));
    } finally {
      setIsDeleting(false);
    }
  };

  const openCopyDialog = (exam: Exam) => {
    if (!accessStore.guard(exam.type === "quiz" ? "quiz.edit" : "exam.edit")) return;
    setCopySource({ kind: "exam", id: exam.id, title: exam.title, parentId: exam.course_id, examType: exam.type });
  };

  // Open edit dialog with exam data
  const openEditDialog = (exam: Exam) => {
    setCurrentExam(exam);
    setTitle(exam.title);
    setDescription(exam.description);
    setCourseId(exam.course_id);
    
    const startDate = exam.available_from || exam.exam_date;
    setExamDate(formatDateForInput(startDate));
    setExamTime(formatTimeForInput(startDate));
    
    if (exam.available_until) {
      setAvailableUntilDate(formatDateForInput(exam.available_until));
      setAvailableUntilTime(formatTimeForInput(exam.available_until));
    } else {
      setAvailableUntilDate(formatDateForInput(startDate));
      setAvailableUntilTime("");
    }
    
    setDuration(exam.duration_minutes);
    setIsVisible(exam.is_visible);
    setExamType(exam.type);
    setIsEditDialogOpen(true);
  };

  // Open delete confirmation dialog
  const openDeleteDialog = (exam: Exam) => {
    setCurrentExam(exam);
    setIsDeleteDialogOpen(true);
  };

  // Toggle exam visibility
  const handleToggleVisibility = (examId: string) => {
    toggleExamVisibility(examId);
  };

  // Get course name from ID
  const getCourseName = (courseId: string) => {
    const course = courseById.get(courseId);
    return course ? course.title : tr("Cours inconnu", "درس غير معروف", "Unknown course");
  };

  // Format exam date and time
  const formatExamDateTime = (dateString: string) => {
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleString(dateLocale, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (error) {
      return "Invalid date";
    }
  };

  // Format duration in hours and minutes
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (language === "fr") {
      if (hours > 0 && mins > 0) {
        return `${hours} h ${mins} min`;
      } else if (hours > 0) {
        return `${hours} h`;
      } else {
        return `${mins} min`;
      }
    } else if (language === "ar") {
      if (hours > 0 && mins > 0) {
        return `${hours} ساعة و ${mins} دقيقة`;
      } else if (hours > 0) {
        return `${hours} ساعة`;
      } else {
        return `${mins} دقيقة`;
      }
    } else {
      if (hours > 0 && mins > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''} ${mins} minute${mins > 1 ? 's' : ''}`;
      } else if (hours > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''}`;
      } else {
        return `${mins} minute${mins > 1 ? 's' : ''}`;
      }
    }
  };



  // Handle course filter change
  const handleCourseFilterChange = (courseId: string) => {
    setSelectedCourseFilter(courseId);
    updateUrlWithFilter(courseId);
  };

  // Set initial courseId for new exam form if a course is selected
  useEffect(() => {
    if (selectedCourseFilter !== "all" && selectedCourseFilter && isAddDialogOpen) {
      setCourseId(selectedCourseFilter);
    }
  }, [selectedCourseFilter, isAddDialogOpen]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{language === "ar" ? "الامتحانات" : language === "fr" ? "Examens" : "Exams"}</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            {isProfessor 
              ? (language === "ar" ? "إدارة الامتحانات والاختبارات الخاصة بدروسك" : language === "fr" ? "Gérer les examens et évaluations de vos cours" : "Manage exams and tests for your courses") 
              : (language === "ar" ? "عرض امتحاناتك القادمة والماضية" : language === "fr" ? "Consulter vos examens à venir et passés" : "View your upcoming and past exams")}
          </p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <ViewToggle
            view={viewMode}
            onViewChange={(view) => setViewMode(view)}
          />
          
          {isProfessor && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="text-xs sm:text-sm font-semibold">
                  <Plus className="h-4 w-4 mr-1.5 sm:mr-2" />
                  {language === "ar" ? "إضافة امتحان" : language === "fr" ? "Ajouter un examen" : "Add Exam"}
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {language === "ar" ? "جدولة امتحان جديد" : language === "fr" ? "Planifier un nouvel examen" : "Schedule New Exam"}
                  </DialogTitle>
                  <DialogDescription>
                    {language === "ar" ? "إنشاء امتحان جديد لأحد دروسك." : language === "fr" ? "Créer un nouvel examen pour l'un de vos cours." : "Create a new exam for one of your courses."}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="course">{language === "ar" ? "الدرس" : language === "fr" ? "Cours" : "Course"}</Label>
                    <Select value={courseId} onValueChange={setCourseId}>
                      <SelectTrigger>
                        <SelectValue placeholder={language === "ar" ? "اختر درساً" : language === "fr" ? "Sélectionner un cours" : "Select a course"} />
                      </SelectTrigger>
                      <SelectContent>
                        {courses.map(course => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="title">{language === "ar" ? "عنوان الامتحان" : language === "fr" ? "Titre de l'examen" : "Exam Title"}</Label>
                    <Input
                      id="title"
                      placeholder={language === "ar" ? "مثال: الامتحان الفصلي" : language === "fr" ? "ex: Examen semestriel" : "e.g., Midterm Exam"}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">{language === "ar" ? "الوصف" : language === "fr" ? "Description" : "Description"}</Label>
                    <Textarea
                      id="description"
                      placeholder={language === "ar" ? "أدخل وصف الامتحان والمحاور المقررة" : language === "fr" ? "Entrez la description de l'examen et les sujets abordés" : "Enter exam description and topics covered"}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="examType">{language === "ar" ? "النوع" : language === "fr" ? "Type" : "Type"}</Label>
                    <Select value={examType} onValueChange={(value: "exam" | "quiz") => {
                      setExamType(value);
                      // Durée par défaut selon le type (Paramètres → Nouveaux quiz)
                      setDuration(value === "quiz" ? prefs.defaultQuizDuration : prefs.defaultExamDuration);
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="exam" disabled={!accessStore.can("exam.edit")}>{language === "ar" ? "امتحان عادي" : language === "fr" ? "Examen régulier" : "Regular Exam"}{!accessStore.can("exam.edit") ? (language === "ar" ? " (غير مدرج في عرضك)" : language === "fr" ? " (non inclus dans votre offre)" : " (not in your plan)") : ""}</SelectItem>
                        <SelectItem value="quiz">{language === "ar" ? "اختبار قصير (Quiz)" : language === "fr" ? "Quiz" : "Quiz"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {examType === "quiz" ? (
                    <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                        <Timer className="h-4 w-4" />
                        <span>
                          {language === "ar" ? "فترة إتاحة الاختبار (Quiz)" : language === "fr" ? "Période de disponibilité du Quiz" : "Quiz Availability Window"}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {language === "ar"
                          ? "حدد فترة بدء وانتهاء إتاحة الاختبار. خلال هذه الفترة يمكن للتلميذ بدء الإجابة، وبعد وقت الانتهاء ينتهي الاختبار تلقائياً."
                          : language === "fr"
                          ? "Définissez la plage horaire durant laquelle le quiz est accessible (ex. 01h00 à 03h00). Après l'heure de fin, le quiz expire automatiquement."
                          : "Set when students can access the quiz. After the end time, the quiz automatically expires."}
                      </p>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1.5">
                          <Label htmlFor="examDate" className="text-xs">
                            {language === "ar" ? "تاريخ البداية" : language === "fr" ? "Date de début" : "Start Date"}
                          </Label>
                          <Input
                            id="examDate"
                            type="date"
                            value={examDate}
                            onChange={(e) => setExamDate(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="examTime" className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            {language === "ar" ? "وقت البداية (متاح من)" : language === "fr" ? "Heure de début (Dès)" : "Start Time"}
                          </Label>
                          <Input
                            id="examTime"
                            type="time"
                            value={examTime}
                            onChange={(e) => setExamTime(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="availableUntilDate" className="text-xs">
                            {language === "ar" ? "تاريخ النهاية" : language === "fr" ? "Date de fin" : "End Date"}
                          </Label>
                          <Input
                            id="availableUntilDate"
                            type="date"
                            value={availableUntilDate || examDate}
                            onChange={(e) => setAvailableUntilDate(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="availableUntilTime" className="text-xs font-medium text-rose-600 dark:text-rose-400">
                            {language === "ar" ? "وقت الانتهاء (حتى)" : language === "fr" ? "Heure de fin (Jusqu'à)" : "End Time"}
                          </Label>
                          <Input
                            id="availableUntilTime"
                            type="time"
                            value={availableUntilTime}
                            onChange={(e) => setAvailableUntilTime(e.target.value)}
                            placeholder="ex: 03:00"
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="examDate">{language === "ar" ? "تاريخ الامتحان" : language === "fr" ? "Date de l'examen" : "Exam Date"}</Label>
                        <Input
                          id="examDate"
                          type="date"
                          value={examDate}
                          onChange={(e) => setExamDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="examTime">{language === "ar" ? "وقت البداية" : language === "fr" ? "Heure de début" : "Start Time"}</Label>
                        <Input
                          id="examTime"
                          type="time"
                          value={examTime}
                          onChange={(e) => setExamTime(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="duration">
                      {examType === "quiz" 
                        ? (language === "ar" ? "مدة الاختبار للتلميذ بعد البدء (بالدقائق)" : language === "fr" ? "Durée de passage par élève (minutes)" : "Quiz Duration per attempt (minutes)")
                        : (language === "ar" ? "المدة (بالدقائق)" : language === "fr" ? "Durée (minutes)" : "Duration (minutes)")}
                    </Label>
                    <Input
                      id="duration"
                      type="number"
                      min="5"
                      step="5"
                      value={duration}
                      onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="visibility"
                      checked={isVisible}
                      onCheckedChange={setIsVisible}
                    />
                    <Label htmlFor="visibility" className="cursor-pointer">
                      {language === "ar" ? "مرئي للتلاميذ" : language === "fr" ? "Visible par les élèves" : "Visible to students"}
                    </Label>
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSubmitting}>
                    {language === "ar" ? "إلغاء" : language === "fr" ? "Annuler" : "Cancel"}
                  </Button>
                  <Button 
                    onClick={handleAddExam}
                    disabled={isSubmitting || !title.trim() || !courseId || !examDate || !examTime}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        {language === "ar" ? "جاري الإنشاء..." : language === "fr" ? "Création en cours..." : "Creating..."}
                      </>
                    ) : (
                      examType === 'quiz' 
                        ? (language === 'ar' ? 'إنشاء الاختبار' : language === 'fr' ? 'Créer le quiz' : 'Create Quiz') 
                        : (language === 'ar' ? 'جدولة الامتحان' : language === 'fr' ? "Planifier l'examen" : 'Schedule Exam')
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Quiz Builder */}
      {showQuizBuilder && (
        <Suspense fallback={<LazyFallback />}>
          <QuizBuilder examId={showQuizBuilder} onClose={() => setShowQuizBuilder(null)} />
        </Suspense>
      )}

      {/* Quiz Taker Modal */}
      {showQuizTaker && (
        <Dialog
          open={!!showQuizTaker}
          onOpenChange={(open) => {
            // Pendant le quiz, seule la confirmation « Quitter » ferme la fenêtre
            if (!open && quizPhase !== "running") setShowQuizTaker(null);
          }}
        >
          <DialogContent
            className="w-[96vw] max-w-6xl max-h-[92vh] overflow-hidden p-0 flex flex-col"
            // Pendant le quiz : pas de croix (bouton « Quitter » avec confirmation dans le quiz)
            hideClose={quizPhase === "running"}
            // Évite de perdre le quiz en cours par un clic à l'extérieur ou la touche Échap
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <DialogHeader className="sr-only">
              <DialogTitle>{showQuizTaker.title}</DialogTitle>
              <DialogDescription>
                {language === "fr" ? "Passer le quiz" : language === "ar" ? "تأدية الاختبار" : "Take the quiz"}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-3 sm:p-6">
              <QuizTaker exam={showQuizTaker} onClose={() => setShowQuizTaker(null)} onPhaseChange={setQuizPhase} />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Quiz Results Modal */}
      {showQuizResults && (
        <Dialog open={!!showQuizResults} onOpenChange={() => setShowQuizResults(null)}>
          <DialogContent
            className={`w-[96vw] ${isProfessor ? "max-w-6xl" : "max-w-4xl"} max-h-[92vh] overflow-hidden p-0 flex flex-col`}
            // Croix par défaut masquée : bouton de fermeture explicite dans l'en-tête ci-dessous
            hideClose
          >
            <DialogHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b px-4 py-2.5 sm:px-6 text-start">
              <div className="min-w-0">
                <DialogTitle className="truncate text-base">
                  {language === "fr" ? "Résultats du quiz" : language === "ar" ? "نتائج الاختبار" : "Quiz Results"}
                  {(() => {
                    const ex = exams.find(e => e.id === showQuizResults);
                    return ex ? <span className="font-normal text-muted-foreground"> · {ex.title}</span> : null;
                  })()}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  {language === "fr" ? "Détails des résultats" : language === "ar" ? "تفاصيل النتائج" : "Detailed quiz results"}
                </DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => setShowQuizResults(null)}
                aria-label={tr("Fermer", "إغلاق", "Close")}
                title={tr("Fermer", "إغلاق", "Close")}
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-3 sm:p-6">
              <Suspense fallback={<LazyFallback />}>
                {isProfessor ? (
                  <RequirePermission perm="quiz.results_view"><QuizDetails examId={showQuizResults} /></RequirePermission>
                ) : (
                  <QuizResults examId={showQuizResults} onClose={() => setShowQuizResults(null)} />
                )}
              </Suspense>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Recherche */}
      <SearchInput
        value={examSearch}
        onChange={setExamSearch}
        placeholder={language === "ar" ? "ابحث عن امتحان أو اختبار (العنوان، الدرس…)" : language === "fr" ? "Rechercher un examen ou un quiz (titre, cours…)" : "Search an exam or quiz (title, course…)"}
        className="sm:max-w-xl"
      />

      {/* Course filter */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
        <div className="w-full sm:w-64">
          <Select value={selectedCourseFilter} onValueChange={handleCourseFilterChange}>
            <SelectTrigger>
              <SelectValue placeholder={language === "ar" ? "تصفية حسب الدرس" : language === "fr" ? "Filtrer par cours" : "Filter by course"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === "ar" ? "جميع الدروس" : language === "fr" ? "Tous les cours" : "All Courses"}</SelectItem>
              {availableCourses.map(course => (
                <SelectItem key={course.id} value={course.id}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">
          {language === "ar" 
            ? `عرض ${displayedExams.length} من الامتحانات${selectedCourseFilter !== "all" ? " لـ " + getCourseName(selectedCourseFilter) : ""}`
            : language === "fr"
            ? `Affichage de ${displayedExams.length} examen${displayedExams.length > 1 ? "s" : ""}${selectedCourseFilter !== "all" ? " pour " + getCourseName(selectedCourseFilter) : ""}`
            : `Showing ${displayedExams.length} ${displayedExams.length === 1 ? "exam" : "exams"}${selectedCourseFilter !== "all" ? " for " + getCourseName(selectedCourseFilter) : ""}`}
        </p>
      </div>

      {dataLoading && userExams.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-busy="true" aria-label={tr("Chargement…", "جارٍ التحميل…", "Loading…")}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="rounded-lg border p-4 space-y-3">
              <div className="h-4 w-2/3 rounded bg-muted motion-safe:animate-pulse" />
              <div className="h-3 w-1/3 rounded bg-muted motion-safe:animate-pulse" />
              <div className="h-3 w-full rounded bg-muted motion-safe:animate-pulse" />
              <div className="h-8 w-1/2 rounded bg-muted motion-safe:animate-pulse" />
            </div>
          ))}
        </div>
      ) : displayedExams.length > 0 ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedExams.map((exam) => {
              const quizStatus = getQuizStatus(exam);
              return (
                <Card key={exam.id} className="overflow-hidden card-hover flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-base font-semibold truncate" title={exam.title}>
                          {isProfessor && exam.type === 'quiz' ? (
                            <button
                              type="button"
                              onClick={() => setShowQuizResults(exam.id)}
                              className="truncate max-w-full text-start hover:text-primary hover:underline underline-offset-4"
                            >
                              {exam.title}
                            </button>
                          ) : (
                            exam.title
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1 text-xs">
                          {getCourseName(exam.course_id)}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge variant={exam.type === 'quiz' ? 'default' : 'secondary'} className="text-[11px]">
                          {exam.type === 'quiz' ? (language === 'ar' ? 'اختبار' : 'Quiz') : (language === 'ar' ? 'امتحان' : language === 'fr' ? 'Examen' : 'Exam')}
                        </Badge>
                        {!exam.is_visible && (
                          <Badge variant="outline" className="text-[11px] text-amber-600 border-amber-300">
                            {language === "ar" ? "مخفي" : language === "fr" ? "Masqué" : "Hidden"}
                          </Badge>
                        )}
                        {exam.type === 'quiz' ? (
                          <Badge 
                            variant="outline"
                            className={`text-[11px] font-medium ${
                              quizStatus.status === 'available'
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-300'
                                : quizStatus.status === 'upcoming'
                                ? 'bg-amber-500/10 text-amber-600 border-amber-300'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {quizStatus.label}
                          </Badge>
                        ) : (
                          isPastExam(exam.exam_date, exam) ? (
                            <Badge variant="secondary" className="text-[11px]">{language === "ar" ? "منتهي" : language === "fr" ? "Terminé" : "Past"}</Badge>
                          ) : (
                            <Badge className="text-[11px]">{language === "ar" ? "قادم" : language === "fr" ? "À venir" : "Upcoming"}</Badge>
                          )
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-3 space-y-2.5 flex-1">
                    {exam.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{exam.description}</p>
                    )}
                    {isProfessor && exam.type === 'quiz' && (
                      (quizStats[exam.id]?.count || 0) > 0 ? (
                        <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary ">
                            {quizStats[exam.id].count} {language === "ar" ? "سؤال" : "questions"}
                          </span>
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary ">
                            {quizStats[exam.id].points} {language === "ar" ? "نقطة" : "pts"}
                          </span>
                          {(() => {
                            const n = submittersByExam.get(exam.id)?.size || 0;
                            return n > 0 ? (
                              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
                                {n} {language === "ar" ? "ورقة" : language === "fr" ? "copie(s)" : "submission(s)"}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowQuizBuilder(exam.id)}
                          className="w-full rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-start text-[11px] font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                        >
                          {language === "ar"
                            ? "لا يوجد أي سؤال بعد: الاختبار غير ظاهر للتلاميذ. أضف الأسئلة."
                            : language === "fr"
                            ? "Aucune question : les élèves ne voient pas encore ce quiz. Ajoutez des questions."
                            : "No questions yet: students can't see this quiz. Add questions."}
                        </button>
                      )
                    )}
                    {!isProfessor && exam.type === 'quiz' && mySubmissions[exam.id] && (
                      <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 px-3 py-2 text-emerald-800 dark:text-emerald-300">
                        <span className="text-xs font-semibold">{language === "ar" ? "نقطتي" : language === "fr" ? "Ma note" : "My score"}</span>
                        <span className="text-sm font-semibold tabular-nums" dir="ltr">
                          {fmtScore(mySubmissions[exam.id].score, mySubmissions[exam.id].total)}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5 text-xs text-muted-foreground pt-1 border-t">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-primary" />
                        <span>{formatExamDateTime(exam.available_from || exam.exam_date)}</span>
                      </div>
                      {exam.available_until && (
                        <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                          <Timer className="h-3.5 w-3.5" />
                          <span>
                            {language === "ar" ? "متاح حتى: " : language === "fr" ? "Fermeture : " : "Closes: "}
                            {formatExamDateTime(exam.available_until)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{language === "ar" ? "المدة: " : language === "fr" ? "Durée : " : "Duration: "}{formatDuration(exam.duration_minutes)}</span>
                      </div>
                      {(exam as any).quiz_mode === 'sequential_timed' && (
                        <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                          <Timer className="h-3.5 w-3.5" />
                          <span className="font-semibold text-[11px]">
                            {language === "fr" ? "Mode séquentiel minuté" : language === "ar" ? "وضع ترتيب موقوت" : "Sequential timed mode"}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="border-t bg-muted/30 px-4 py-2.5">
                    <div className="flex justify-between items-center w-full">
                      {isProfessor ? (
                        <>
                           <div className="flex gap-1.5 items-center">
                             {exam.type === 'quiz' && (
                               <Button 
                                 variant="outline" 
                                 size="sm"
                                 className="h-8 text-xs font-semibold gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                                 onClick={() => setShowQuizBuilder(exam.id)}
                               >
                                 <PlusCircle className="h-3.5 w-3.5" />
                                 <span>{language === "ar" ? "الأسئلة" : language === "fr" ? "Questions" : "Questions"}</span>
                               </Button>
                             )}
                             {exam.type === 'quiz' && (
                               <Button 
                                 variant="ghost" 
                                 size="icon"
                                 className="h-9 w-9 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                                 onClick={() => setShowQuizResults(exam.id)}
                                 title={language === "ar" ? "التفاصيل والنتائج" : language === "fr" ? "Détails et résultats" : "Details & results"}
                                 aria-label={language === "ar" ? "التفاصيل والنتائج" : language === "fr" ? "Détails et résultats" : "Details & results"}
                               >
                                 <Trophy className="h-4 w-4" />
                               </Button>
                             )}
                             <Button 
                               variant="ghost" 
                               size="icon"
                               className="h-9 w-9"
                               onClick={() => handleToggleVisibility(exam.id)}
                               title={exam.is_visible 
                                 ? (language === "ar" ? "إخفاء عن التلاميذ" : language === "fr" ? "Masquer aux élèves" : "Hide from students")
                                 : (language === "ar" ? "إظهار للتلاميذ" : language === "fr" ? "Rendre visible aux élèves" : "Make visible to students")}
                               aria-label={exam.is_visible 
                                 ? (language === "ar" ? "إخفاء عن التلاميذ" : language === "fr" ? "Masquer aux élèves" : "Hide from students")
                                 : (language === "ar" ? "إظهار للتلاميذ" : language === "fr" ? "Rendre visible aux élèves" : "Make visible to students")}
                             >
                               {exam.is_visible ? (
                                 <EyeOff className="h-4 w-4" />
                               ) : (
                                 <Eye className="h-4 w-4 text-muted-foreground" />
                               )}
                             </Button>
                           </div>
                           <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => openCopyDialog(exam)}
                              title={tr("Copier vers une autre classe", "نسخ إلى قسم آخر", "Copy to another class")}
                              aria-label={tr("Copier vers une autre classe", "نسخ إلى قسم آخر", "Copy to another class")}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <PublishToLibraryButton kind="quiz" sourceId={exam.id} tr={tr} iconOnly />
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => openEditDialog(exam)}
                              title={language === "ar" ? "تعديل" : language === "fr" ? "Modifier" : "Edit"}
                              aria-label={language === "ar" ? "تعديل" : language === "fr" ? "Modifier" : "Edit"}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-9 w-9 text-destructive"
                              onClick={() => openDeleteDialog(exam)}
                              title={language === "ar" ? "حذف" : language === "fr" ? "Supprimer" : "Delete"}
                              aria-label={language === "ar" ? "حذف" : language === "fr" ? "Supprimer" : "Delete"}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        </>
                      ) : exam.type === 'quiz' ? (
                        <div className="flex justify-end w-full items-center gap-2">
                          {mySubmissions[exam.id] ? (
                            <>
                              <Badge variant="outline" className="mr-auto rtl:mr-0 rtl:ml-auto border-emerald-300 bg-emerald-500/10 text-[11px] text-emerald-700">
                                <CheckCircle2 className="h-3 w-3 mr-1 rtl:mr-0 rtl:ml-1" />
                                {language === "ar" ? "تم الاجتياز" : language === "fr" ? "Terminé" : "Done"}
                              </Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowQuizTaker(exam)}
                                className="h-8 gap-1.5 text-xs font-medium"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                {language === "ar" ? "عرض نتيجتي" : language === "fr" ? "Voir mon résultat" : "See my result"}
                              </Button>
                            </>
                          ) : quizStatus.status === 'available' ? (
                            <Button 
                              size="sm"
                              onClick={() => setShowQuizTaker(exam)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-8 gap-1.5"
                            >
                              <Play className="h-3.5 w-3.5" />
                              {language === "ar" ? "اجتياز الاختبار" : language === "fr" ? "Passer le Quiz" : "Take Quiz"}
                            </Button>
                          ) : quizStatus.status === 'upcoming' ? (
                            <Button 
                              size="sm"
                              variant="outline"
                              disabled
                              className="text-xs h-8 gap-1.5 opacity-70 text-amber-600 border-amber-300"
                            >
                              <Clock className="h-3.5 w-3.5" />
                              {language === "ar" ? "غير متاح بعد" : language === "fr" ? "Pas encore disponible" : "Not available yet"}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              {language === "ar" ? "انتهت فترة الاختبار" : language === "fr" ? "Période expirée" : "Quiz expired"}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          {isPastExam(exam.exam_date, exam) ? (
                            tr("Examen terminé", "امتحان منتهي", "Exam finished")
                          ) : (
                            tr("Examen programmé", "امتحان حضوري مجدول", "Exam scheduled")
                          )}
                        </div>
                      )}
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="app-table-wrap">
            <table className="app-table w-full text-xs min-w-[760px]">
              <thead>
                <tr>
                  <th className="p-3 text-start font-medium">{language === "ar" ? "الامتحان" : language === "fr" ? "Examen" : "Exam"}</th>
                  <th className="p-3 text-start font-medium">{language === "ar" ? "الدرس" : language === "fr" ? "Cours" : "Course"}</th>
                  <th className="p-3 text-start font-medium">{language === "ar" ? "فترة الإتاحة" : language === "fr" ? "Disponibilité / Date" : "Availability"}</th>
                  <th className="p-3 text-start font-medium">{language === "ar" ? "المدة" : language === "fr" ? "Durée" : "Duration"}</th>
                  <th className="p-3 text-start font-medium">{language === "ar" ? "النوع" : language === "fr" ? "Type" : "Type"}</th>
                  <th className="p-3 text-start font-medium">{language === "ar" ? "الحالة" : language === "fr" ? "Statut" : "Status"}</th>
                  <th className="p-3 text-start font-medium">{language === "ar" ? "الإجراءات" : language === "fr" ? "Actions" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {displayedExams.map((exam) => {
                  const quizStatus = getQuizStatus(exam);
                  return (
                    <tr key={exam.id}>
                      <td className="p-3">
                        <div>
                          <h3 className="font-semibold text-sm">
                            {isProfessor && exam.type === 'quiz' ? (
                              <button
                                type="button"
                                onClick={() => setShowQuizResults(exam.id)}
                                className="text-start hover:text-primary hover:underline underline-offset-4"
                              >
                                {exam.title}
                              </button>
                            ) : (
                              exam.title
                            )}
                          </h3>
                          {exam.description && <p className="text-xs text-muted-foreground line-clamp-1">{exam.description}</p>}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="truncate max-w-[140px]">{getCourseName(exam.course_id)}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="text-xs">
                          <div className="font-medium">{new Date(exam.available_from || exam.exam_date).toLocaleDateString(dateLocale, { day: "2-digit", month: "short", year: "numeric" })}</div>
                          <div className="text-muted-foreground">
                            {format(new Date(exam.available_from || exam.exam_date), "HH:mm")}
                            {exam.available_until && ` → ${format(new Date(exam.available_until), "HH:mm")}`}
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{exam.duration_minutes} min</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <Badge variant={exam.type === 'quiz' ? 'default' : 'secondary'} className="text-[11px] w-fit">
                            {exam.type === 'quiz' ? (language === 'ar' ? 'اختبار' : 'Quiz') : (language === 'ar' ? 'امتحان' : language === 'fr' ? 'Examen' : 'Exam')}
                          </Badge>
                          {exam.type === 'quiz' && (exam as any).quiz_mode === 'sequential_timed' && (
                            <Badge variant="outline" className="text-[11px] w-fit border-amber-300 text-amber-700 dark:text-amber-400">
                              <Timer className="h-2.5 w-2.5 mr-0.5" />
                              {language === "fr" ? "Séquentiel" : language === "ar" ? "ترتيب موقوت" : "Sequential"}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          {exam.type === 'quiz' ? (
                            <Badge 
                              variant="outline"
                              className={`text-[11px] w-fit ${
                                quizStatus.status === 'available'
                                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-300'
                                  : quizStatus.status === 'upcoming'
                                  ? 'bg-amber-500/10 text-amber-600 border-amber-300'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {quizStatus.label}
                            </Badge>
                          ) : (
                            isPastExam(exam.exam_date, exam) ? (
                              <Badge variant="outline" className="w-fit text-[11px]">{language === "ar" ? "منتهي" : language === "fr" ? "Terminé" : "Past"}</Badge>
                            ) : (
                              <Badge variant="default" className="w-fit text-[11px]">{language === "ar" ? "قادم" : language === "fr" ? "À venir" : "Upcoming"}</Badge>
                            )
                          )}
                          {!exam.is_visible && (
                            <Badge variant="outline" className="w-fit text-[11px] text-amber-600 border-amber-300">
                              {language === "ar" ? "مخفي" : language === "fr" ? "Masqué" : "Hidden"}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        {isProfessor ? (
                          <div className="flex gap-1 items-center">
                            {exam.type === 'quiz' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-primary hover:bg-primary/10"
                                onClick={() => setShowQuizBuilder(exam.id)}
                                title={language === "ar" ? "الأسئلة" : language === "fr" ? "Créateur de Quiz" : "Quiz Builder"}
                                aria-label={language === "ar" ? "الأسئلة" : language === "fr" ? "Créateur de Quiz" : "Quiz Builder"}
                              >
                                <PlusCircle className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {exam.type === 'quiz' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                                onClick={() => setShowQuizResults(exam.id)}
                                title={language === "ar" ? "التفاصيل والنتائج" : language === "fr" ? "Détails et résultats" : "Details & results"}
                                aria-label={language === "ar" ? "التفاصيل والنتائج" : language === "fr" ? "Détails et résultats" : "Details & results"}
                              >
                                <Trophy className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => openCopyDialog(exam)}
                              title={tr("Copier vers une autre classe", "نسخ إلى قسم آخر", "Copy to another class")}
                              aria-label={tr("Copier vers une autre classe", "نسخ إلى قسم آخر", "Copy to another class")}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <PublishToLibraryButton kind="quiz" sourceId={exam.id} tr={tr} iconOnly />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => openEditDialog(exam)}
                              title={language === "ar" ? "تعديل" : language === "fr" ? "Modifier" : "Edit"}
                              aria-label={language === "ar" ? "تعديل" : language === "fr" ? "Modifier" : "Edit"}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-destructive"
                              onClick={() => openDeleteDialog(exam)}
                              title={language === "ar" ? "حذف" : language === "fr" ? "Supprimer" : "Delete"}
                              aria-label={language === "ar" ? "حذف" : language === "fr" ? "Supprimer" : "Delete"}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          exam.type === 'quiz' && (
                            mySubmissions[exam.id] ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowQuizTaker(exam)}
                                className="h-7 gap-1 text-xs"
                              >
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                <span dir="ltr">{fmtScore(mySubmissions[exam.id].score, mySubmissions[exam.id].total)}</span>
                              </Button>
                            ) : quizStatus.status === 'available' ? (
                              <Button
                                size="sm"
                                onClick={() => setShowQuizTaker(exam)}
                                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                              >
                                <Play className="h-3 w-3" />
                                {language === "ar" ? "اجتياز" : language === "fr" ? "Passer" : "Take"}
                              </Button>
                            ) : quizStatus.status === 'upcoming' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled
                                className="h-7 text-xs opacity-70 text-amber-600 border-amber-300"
                              >
                                <Clock className="h-3 w-3 mr-1" />
                                {language === "ar" ? "قادم" : language === "fr" ? "Bientôt" : "Soon"}
                              </Button>
                            ) : (
                              <span className="text-[11px] text-muted-foreground italic">
                                {language === "ar" ? "منتهي" : language === "fr" ? "Expiré" : "Expired"}
                              </span>
                            )
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center py-12 border rounded-lg bg-muted/30">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-medium">{language === "ar" ? "لم يتم العثور على امتحانات" : language === "fr" ? "Aucun examen trouvé" : "No exams found"}</h3>
          <p className="text-muted-foreground text-center max-w-md mt-2">
            {language === "ar"
              ? isProfessor 
                ? selectedCourseFilter !== "all" 
                  ? `لم تقم بجدولة أي امتحانات لـ ${getCourseName(selectedCourseFilter)} بعد.`
                  : "لم تقم بجدولة أي امتحانات بعد. أضف امتحانك الأول للبدء."
                : selectedCourseFilter !== "all"
                  ? `لا توجد امتحانات مجدولة حاليًا لـ ${getCourseName(selectedCourseFilter)}.`
                  : "لا توجد امتحانات مجدولة لك بعد."
              : isProfessor 
                ? selectedCourseFilter !== "all" 
                  ? (language === "fr" ? `Vous n'avez pas encore planifié d'examens pour ${getCourseName(selectedCourseFilter)}.` : `You haven't scheduled any exams for ${getCourseName(selectedCourseFilter)} yet.`)
                  : (language === "fr" ? "Vous n'avez pas encore planifié d'examens. Ajoutez votre premier examen pour commencer." : "You haven't scheduled any exams yet. Add your first exam to get started.")
                : selectedCourseFilter !== "all"
                  ? (language === "fr" ? `Aucun examen n'est actuellement planifié pour ${getCourseName(selectedCourseFilter)}.` : `No exams are currently scheduled for ${getCourseName(selectedCourseFilter)}.`)
                  : (language === "fr" ? "Vous n'avez pas encore d'examens planifiés." : "You don't have any exams scheduled yet.")}
          </p>
          {isProfessor && (
            <Button className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {language === "ar"
                ? selectedCourseFilter !== "all" 
                  ? `جدولة امتحان لـ ${getCourseName(selectedCourseFilter)}`
                  : "جدولة أول امتحان"
                : selectedCourseFilter !== "all" 
                  ? (language === "fr" ? `Planifier un examen pour ${getCourseName(selectedCourseFilter)}` : `Schedule Exam for ${getCourseName(selectedCourseFilter)}`)
                  : (language === "fr" ? "Planifier votre premier examen" : "Schedule Your First Exam")}
            </Button>
          )}
        </div>
      )}
      
      {/* Edit Exam Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "تعديل الامتحان" : language === "fr" ? "Modifier l'examen" : "Edit Exam"}</DialogTitle>
            <DialogDescription>
              {language === "ar" ? "تحديث تفاصيل الامتحان والجدول الزمني." : language === "fr" ? "Mettre à jour les détails et la planification de l'examen." : "Update the exam details and schedule."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-course">{language === "ar" ? "الدرس" : language === "fr" ? "Cours" : "Course"}</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger>
                  <SelectValue placeholder={language === "ar" ? "اختر درساً" : language === "fr" ? "Sélectionner un cours" : "Select a course"} />
                </SelectTrigger>
                <SelectContent>
                  {courses.map(course => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-title">{language === "ar" ? "عنوان الامتحان" : language === "fr" ? "Titre de l'examen" : "Exam Title"}</Label>
              <Input
                id="edit-title"
                placeholder={language === "ar" ? "عنوان الامتحان" : language === "fr" ? "Titre de l'examen" : "Exam title"}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">{language === "ar" ? "الوصف" : language === "fr" ? "Description" : "Description"}</Label>
              <Textarea
                id="edit-description"
                placeholder={language === "ar" ? "وصف الامتحان" : language === "fr" ? "Description de l'examen" : "Exam description"}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-examType">{language === "ar" ? "النوع" : language === "fr" ? "Type" : "Type"}</Label>
              <Select value={examType} onValueChange={(value: "exam" | "quiz") => setExamType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exam" disabled={!accessStore.can("exam.edit")}>{language === "ar" ? "امتحان عادي" : language === "fr" ? "Examen régulier" : "Regular Exam"}{!accessStore.can("exam.edit") ? (language === "ar" ? " (غير مدرج في عرضك)" : language === "fr" ? " (non inclus dans votre offre)" : " (not in your plan)") : ""}</SelectItem>
                  <SelectItem value="quiz">{language === "ar" ? "اختبار قصير (Quiz)" : language === "fr" ? "Quiz" : "Quiz"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {examType === "quiz" ? (
              <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                  <Timer className="h-4 w-4" />
                  <span>
                    {language === "ar" ? "فترة إتاحة الاختبار (Quiz)" : language === "fr" ? "Période de disponibilité du Quiz" : "Quiz Availability Window"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {language === "ar"
                    ? "حدد فترة بدء وانتهاء إتاحة الاختبار. خلال هذه الفترة يمكن للتلميذ بدء الإجابة، وبعد وقت الانتهاء ينتهي الاختبار تلقائياً."
                    : language === "fr"
                    ? "Définissez la plage horaire durant laquelle le quiz est accessible (ex. 01h00 à 03h00). Après l'heure de fin, le quiz expire automatiquement."
                    : "Set when students can access the quiz. After the end time, the quiz automatically expires."}
                </p>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-examDate" className="text-xs">
                      {language === "ar" ? "تاريخ البداية" : language === "fr" ? "Date de début" : "Start Date"}
                    </Label>
                    <Input
                      id="edit-examDate"
                      type="date"
                      value={examDate}
                      onChange={(e) => setExamDate(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-examTime" className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      {language === "ar" ? "وقت البداية (متاح من)" : language === "fr" ? "Heure de début (Dès)" : "Start Time"}
                    </Label>
                    <Input
                      id="edit-examTime"
                      type="time"
                      value={examTime}
                      onChange={(e) => setExamTime(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-availableUntilDate" className="text-xs">
                      {language === "ar" ? "تاريخ النهاية" : language === "fr" ? "Date de fin" : "End Date"}
                    </Label>
                    <Input
                      id="edit-availableUntilDate"
                      type="date"
                      value={availableUntilDate || examDate}
                      onChange={(e) => setAvailableUntilDate(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-availableUntilTime" className="text-xs font-medium text-rose-600 dark:text-rose-400">
                      {language === "ar" ? "وقت الانتهاء (حتى)" : language === "fr" ? "Heure de fin (Jusqu'à)" : "End Time"}
                    </Label>
                    <Input
                      id="edit-availableUntilTime"
                      type="time"
                      value={availableUntilTime}
                      onChange={(e) => setAvailableUntilTime(e.target.value)}
                      placeholder="ex: 03:00"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-examDate">{language === "ar" ? "تاريخ الامتحان" : language === "fr" ? "Date de l'examen" : "Exam Date"}</Label>
                  <Input
                    id="edit-examDate"
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-examTime">{language === "ar" ? "وقت البداية" : language === "fr" ? "Heure de début" : "Start Time"}</Label>
                  <Input
                    id="edit-examTime"
                    type="time"
                    value={examTime}
                    onChange={(e) => setExamTime(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-duration">
                {examType === "quiz" 
                  ? (language === "ar" ? "مدة الاختبار للتلميذ بعد البدء (بالدقائق)" : language === "fr" ? "Durée de passage par élève (minutes)" : "Quiz Duration per attempt (minutes)")
                  : (language === "ar" ? "المدة (بالدقائق)" : language === "fr" ? "Durée (minutes)" : "Duration (minutes)")}
              </Label>
              <Input
                id="edit-duration"
                type="number"
                min="5"
                step="5"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-visibility"
                checked={isVisible}
                onCheckedChange={setIsVisible}
              />
              <Label htmlFor="edit-visibility" className="cursor-pointer">
                {language === "ar" ? "مرئي للتلاميذ" : language === "fr" ? "Visible par les élèves" : "Visible to students"}
              </Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSubmitting}>
              {language === "ar" ? "إلغاء" : language === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button 
              onClick={handleEditExam}
              disabled={isSubmitting || !title.trim() || !courseId || !examDate || !examTime}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {language === "ar" ? "جاري الحفظ..." : language === "fr" ? "Sauvegarde..." : "Saving..."}
                </>
              ) : (
                language === "ar" ? "حفظ التغييرات" : language === "fr" ? "Sauvegarder les modifications" : "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copier un quiz / examen vers un autre cours (toutes classes) */}
      <CopyToDialog source={copySource} onClose={() => setCopySource(null)} onDone={() => refreshData(roomId, { force: true })} tr={tr} />

      {/* Delete Exam Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={(o) => { if (!isDeleting) setIsDeleteDialogOpen(o); }}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "حذف الامتحان" : language === "fr" ? "Supprimer l'examen" : "Delete Exam"}</DialogTitle>
            <DialogDescription>
              {language === "ar" 
                ? `هل أنت متأكد من رغبتك في حذف ${currentExam?.title}؟ ستُحذف أيضاً جميع أوراق التلاميذ ونتائجهم المرتبطة به. لا يمكن التراجع عن هذا الإجراء.` 
                : language === "fr"
                ? `Êtes-vous sûr de vouloir supprimer ${currentExam?.title} ? Toutes les copies et notes des élèves liées seront aussi supprimées. Cette action est irréversible.`
                : `Are you sure you want to delete ${currentExam?.title}? All related student submissions and scores will also be deleted. This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
              {language === "ar" ? "إلغاء" : language === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={handleDeleteExam} disabled={isDeleting} className="gap-2">
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {language === "ar" ? "حذف الامتحان" : language === "fr" ? "Supprimer l'examen" : "Delete Exam"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Exams;


import { useState, useEffect } from "react";
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
  Trophy
} from "lucide-react";
import QuizBuilder from "@/components/QuizBuilder";
import QuizTaker from "@/components/QuizTaker";
import QuizResults from "@/components/QuizResults";
import { format } from "date-fns";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ViewToggle from "@/components/ViewToggle";
import { useLanguage } from "@/contexts/LanguageContext";

const Exams = () => {
  const { t, language } = useLanguage();
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
    refreshData
  } = useCourses();
  
  const location = useLocation();
  const navigate = useNavigate();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState("");
  const [examDate, setExamDate] = useState("");
  const [examTime, setExamTime] = useState("");
  const [duration, setDuration] = useState(60);
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
      // If we're NOT in a room context (accessing /exams directly), refresh all data
      // RoomExams component handles refresh for room-specific context
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
  
  // Filter exams based on user role and selected course
  const userExams = isProfessor ? exams : (user ? getVisibleExamsForStudent(user.id) : []);
  const displayedExams = selectedCourseFilter === "all" 
    ? userExams 
    : userExams.filter(exam => exam.course_id === selectedCourseFilter);

  // Filter courses based on user role for the course dropdown
  const availableCourses = isProfessor 
    ? courses 
    : courses.filter(course => 
        course.is_visible && user && enrollments.some(e => e.course_id === course.id && e.student_id === user.id)
      );

  // Reset form
  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCourseId("");
    setExamDate("");
    setExamTime("");
    setDuration(60);
    setIsVisible(true);
    setExamType("exam");
    setCurrentExam(null);
  };

  // Format date for input field
  const formatDateForInput = (dateString: string) => {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  // Format time for input field
  const formatTimeForInput = (dateString: string) => {
    const date = new Date(dateString);
    return date.toISOString().split('T')[1].substring(0, 5);
  };

  // Combine date and time to ISO string
  const combineDateTime = (date: string, time: string) => {
    return new Date(`${date}T${time}:00`).toISOString();
  };

  // Add new exam
  const handleAddExam = async () => {
    const newExam = await addExam({
      title,
      description,
      course_id: courseId,
      exam_date: combineDateTime(examDate, examTime),
      duration_minutes: duration,
      is_visible: isVisible,
      type: examType
    });
    
    if (newExam) {
      setIsAddDialogOpen(false);
      resetForm();
      if (examType === "quiz") {
        setShowQuizBuilder(newExam.id);
      }
    }
  };

  // Edit exam
  const handleEditExam = async () => {
    if (currentExam) {
      const success = await updateExam(currentExam.id, {
        title,
        description,
        course_id: courseId,
        exam_date: combineDateTime(examDate, examTime),
        duration_minutes: duration,
        is_visible: isVisible,
        type: examType
      });
      
      if (success) {
        setIsEditDialogOpen(false);
        resetForm();
      }
    }
  };

  // Delete exam
  const handleDeleteExam = () => {
    if (currentExam) {
      deleteExam(currentExam.id);
      setIsDeleteDialogOpen(false);
      resetForm();
    }
  };

  // Open edit dialog with exam data
  const openEditDialog = (exam: Exam) => {
    setCurrentExam(exam);
    setTitle(exam.title);
    setDescription(exam.description);
    setCourseId(exam.course_id);
    setExamDate(formatDateForInput(exam.exam_date));
    setExamTime(formatTimeForInput(exam.exam_date));
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
    const course = courses.find(c => c.id === courseId);
    return course ? course.title : "Unknown Course";
  };

  // Format exam date and time
  const formatExamDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), "PPP 'at' p");
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

  // Check if exam date is in the past
  const isPastExam = (dateString: string) => {
    const now = new Date();
    const examDate = new Date(dateString);
    return examDate < now;
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{language === "ar" ? "الامتحانات" : language === "fr" ? "Examens" : "Exams"}</h1>
          <p className="text-muted-foreground mt-1">
            {isProfessor 
              ? (language === "ar" ? "إدارة الامتحانات والاختبارات الخاصة بدروسك" : language === "fr" ? "Gérer les examens et évaluations de vos cours" : "Manage exams and tests for your courses") 
              : (language === "ar" ? "عرض امتحاناتك القادمة والماضية" : language === "fr" ? "Consulter vos examens à venir et passés" : "View your upcoming and past exams")}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <ViewToggle
            view={viewMode}
            onViewChange={(view) => setViewMode(view)}
          />
          
          {isProfessor && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  {language === "ar" ? "إضافة امتحان" : language === "fr" ? "Ajouter un examen" : "Add Exam"}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
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
                  <div className="space-y-2">
                    <Label htmlFor="examType">{language === "ar" ? "النوع" : language === "fr" ? "Type" : "Type"}</Label>
                    <Select value={examType} onValueChange={(value: "exam" | "quiz") => setExamType(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="exam">{language === "ar" ? "امتحان عادي" : language === "fr" ? "Examen régulier" : "Regular Exam"}</SelectItem>
                        <SelectItem value="quiz">{language === "ar" ? "اختبار قصير (Quiz)" : language === "fr" ? "Quiz" : "Quiz"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration">{language === "ar" ? "المدة (بالدقائق)" : language === "fr" ? "Durée (minutes)" : "Duration (minutes)"}</Label>
                    <Input
                      id="duration"
                      type="number"
                      min="15"
                      step="15"
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
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    {language === "ar" ? "إلغاء" : language === "fr" ? "Annuler" : "Cancel"}
                  </Button>
                  <Button 
                    onClick={handleAddExam}
                    disabled={!title || !courseId || !examDate || !examTime}
                  >
                    {examType === 'quiz' 
                      ? (language === 'ar' ? 'إنشاء الاختبار' : language === 'fr' ? 'Créer le quiz' : 'Create Quiz') 
                      : (language === 'ar' ? 'جدولة الامتحان' : language === 'fr' ? "Planifier l'examen" : 'Schedule Exam')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Quiz Builder */}
      {showQuizBuilder && (
        <QuizBuilder examId={showQuizBuilder} onClose={() => setShowQuizBuilder(null)} />
      )}

      {/* Quiz Taker Modal */}
      {showQuizTaker && (
        <Dialog open={!!showQuizTaker} onOpenChange={() => setShowQuizTaker(null)}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden p-0">
            <div className="h-full overflow-y-auto p-6">
              <QuizTaker exam={showQuizTaker} onClose={() => setShowQuizTaker(null)} />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Quiz Results Modal */}
      {showQuizResults && (
        <Dialog open={!!showQuizResults} onOpenChange={() => setShowQuizResults(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
            <div className="h-full overflow-y-auto p-6">
              <QuizResults examId={showQuizResults} onClose={() => setShowQuizResults(null)} />
            </div>
          </DialogContent>
        </Dialog>
      )}

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

      {displayedExams.length > 0 ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedExams.map((exam) => (
              <Card key={exam.id} className="overflow-hidden card-hover">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle>{exam.title}</CardTitle>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={exam.type === 'quiz' ? 'default' : 'secondary'}>
                        {exam.type === 'quiz' ? (language === 'ar' ? 'اختبار' : 'Quiz') : (language === 'ar' ? 'امتحان' : language === 'fr' ? 'Examen' : 'Exam')}
                      </Badge>
                      {!exam.is_visible && (
                        <Badge variant="outline">{language === "ar" ? "مخفي" : language === "fr" ? "Masqué" : "Hidden"}</Badge>
                      )}
                      {isPastExam(exam.exam_date) ? (
                        <Badge variant="secondary">{language === "ar" ? "منتهي" : language === "fr" ? "Terminé" : "Past"}</Badge>
                      ) : (
                        <Badge>{language === "ar" ? "قادم" : language === "fr" ? "À venir" : "Upcoming"}</Badge>
                      )}
                    </div>
                  </div>
                  <CardDescription className="mt-1">
                    {getCourseName(exam.course_id)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-3">
                  <p className="text-sm mb-3">{exam.description}</p>
                  <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      <span>{formatExamDateTime(exam.exam_date)}</span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      <span>{language === "ar" ? "المدة: " : language === "fr" ? "Durée : " : "Duration: "}{formatDuration(exam.duration_minutes)}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="border-t bg-muted/30 px-6 py-3">
                  <div className="flex justify-between w-full">
                    {isProfessor ? (
                      <>
                         <div className="flex gap-2 items-center">
                           {exam.type === 'quiz' && (
                             <Button 
                               variant="outline" 
                               size="sm"
                               className="h-8 text-xs font-semibold gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                               onClick={() => setShowQuizBuilder(exam.id)}
                             >
                               <PlusCircle className="h-3.5 w-3.5" />
                               <span>{language === "ar" ? "محرر الأسئلة" : language === "fr" ? "Créateur de Quiz" : "Quiz Builder"}</span>
                             </Button>
                           )}
                           {exam.type === 'quiz' && (
                             <Button 
                               variant="ghost" 
                               size="icon"
                               className="h-8 w-8 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                               onClick={() => setShowQuizResults(exam.id)}
                               title={language === "ar" ? "عرض النتائج" : language === "fr" ? "Voir les résultats" : "View Results"}
                             >
                               <Trophy className="h-4 w-4" />
                             </Button>
                           )}
                           <Button 
                             variant="ghost" 
                             size="icon"
                             onClick={() => handleToggleVisibility(exam.id)}
                             title={exam.is_visible 
                               ? (language === "ar" ? "إخفاء عن التلاميذ" : language === "fr" ? "Masquer aux élèves" : "Hide from students")
                               : (language === "ar" ? "إظهار للتلاميذ" : language === "fr" ? "Rendre visible aux élèves" : "Make visible to students")}
                           >
                             {exam.is_visible ? (
                               <EyeOff className="h-4 w-4" />
                             ) : (
                               <Eye className="h-4 w-4" />
                             )}
                           </Button>
                         </div>
                         <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => openEditDialog(exam)}
                            title={language === "ar" ? "تعديل الامتحان" : language === "fr" ? "Modifier l'examen" : "Edit exam"}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => openDeleteDialog(exam)}
                            title={language === "ar" ? "حذف الامتحان" : language === "fr" ? "Supprimer l'examen" : "Delete exam"}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    ) : exam.type === 'quiz' && !isPastExam(exam.exam_date) && (
                      <div className="flex justify-end w-full">
                        <Button 
                          size="sm"
                          onClick={() => setShowQuizTaker(exam)}
                          className="flex items-center gap-2"
                        >
                          <Play className="h-4 w-4" />
                          {language === "ar" ? "اجتياز الاختبار" : language === "fr" ? "Passer le Quiz" : "Take Quiz"}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="border rounded-lg">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-4 text-left font-medium">{language === "ar" ? "الامتحان" : language === "fr" ? "Examen" : "Exam"}</th>
                  <th className="p-4 text-left font-medium">{language === "ar" ? "الدرس" : language === "fr" ? "Cours" : "Course"}</th>
                  <th className="p-4 text-left font-medium">{language === "ar" ? "التاريخ والوقت" : language === "fr" ? "Date et Heure" : "Date & Time"}</th>
                  <th className="p-4 text-left font-medium">{language === "ar" ? "المدة" : language === "fr" ? "Durée" : "Duration"}</th>
                  <th className="p-4 text-left font-medium">{language === "ar" ? "النوع" : language === "fr" ? "Type" : "Type"}</th>
                  <th className="p-4 text-left font-medium">{language === "ar" ? "الحالة" : language === "fr" ? "Statut" : "Status"}</th>
                  {isProfessor && <th className="p-4 text-left font-medium">{language === "ar" ? "الإجراءات" : language === "fr" ? "Actions" : "Actions"}</th>}
                </tr>
              </thead>
              <tbody>
                {displayedExams.map((exam) => (
                  <tr key={exam.id} className="border-t">
                    <td className="p-4">
                      <div>
                        <h3 className="font-medium">{exam.title}</h3>
                        <p className="text-sm text-muted-foreground">{exam.description}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <BookOpen className="h-4 w-4 text-blue-600" />
                        <span className="text-sm">{getCourseName(exam.course_id)}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        <div>{format(new Date(exam.exam_date), "PPP")}</div>
                        <div className="text-muted-foreground">{format(new Date(exam.exam_date), "p")}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{exam.duration_minutes} min</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant={exam.type === 'quiz' ? 'default' : 'secondary'}>
                        {exam.type === 'quiz' ? (language === 'ar' ? 'اختبار' : 'Quiz') : (language === 'ar' ? 'امتحان' : language === 'fr' ? 'Examen' : 'Exam')}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        {isPastExam(exam.exam_date) ? (
                          <Badge variant="outline" className="w-fit">{language === "ar" ? "منتهي" : language === "fr" ? "Terminé" : "Past"}</Badge>
                        ) : (
                          <Badge variant="default" className="w-fit">{language === "ar" ? "قادم" : language === "fr" ? "À venir" : "Upcoming"}</Badge>
                        )}
                        {!exam.is_visible && (
                          <Badge variant="outline" className="w-fit">{language === "ar" ? "مخفي" : language === "fr" ? "Masqué" : "Hidden"}</Badge>
                        )}
                      </div>
                    </td>
                    {isProfessor && (
                      <td className="p-4">
                        <div className="flex gap-1">
                          {exam.type === 'quiz' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-primary hover:bg-primary/10"
                              onClick={() => setShowQuizBuilder(exam.id)}
                              title={language === "ar" ? "محرر الأسئلة" : language === "fr" ? "Créateur de Quiz" : "Quiz Builder"}
                            >
                              <PlusCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEditDialog(exam)}
                            title={language === "ar" ? "تعديل" : language === "fr" ? "Modifier" : "Edit"}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => openDeleteDialog(exam)}
                            title={language === "ar" ? "حذف" : language === "fr" ? "Supprimer" : "Delete"}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
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
        <DialogContent className="max-w-lg">
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
            <div className="space-y-2">
              <Label htmlFor="edit-examType">{language === "ar" ? "النوع" : language === "fr" ? "Type" : "Type"}</Label>
              <Select value={examType} onValueChange={(value: "exam" | "quiz") => setExamType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exam">{language === "ar" ? "امتحان عادي" : language === "fr" ? "Examen régulier" : "Regular Exam"}</SelectItem>
                  <SelectItem value="quiz">{language === "ar" ? "اختبار قصير (Quiz)" : language === "fr" ? "Quiz" : "Quiz"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-duration">{language === "ar" ? "المدة (بالدقائق)" : language === "fr" ? "Durée (minutes)" : "Duration (minutes)"}</Label>
              <Input
                id="edit-duration"
                type="number"
                min="15"
                step="15"
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
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : language === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button 
              onClick={handleEditExam}
              disabled={!title || !courseId || !examDate || !examTime}
            >
              {language === "ar" ? "حفظ التغييرات" : language === "fr" ? "Sauvegarder les modifications" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Exam Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "حذف الامتحان" : language === "fr" ? "Supprimer l'examen" : "Delete Exam"}</DialogTitle>
            <DialogDescription>
              {language === "ar" 
                ? `هل أنت متأكد من رغبتك في حذف ${currentExam?.title}؟ لا يمكن التراجع عن هذا الإجراء.` 
                : language === "fr"
                ? `Êtes-vous sûr de vouloir supprimer ${currentExam?.title} ? Cette action est irréversible.`
                : `Are you sure you want to delete ${currentExam?.title}? This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : language === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={handleDeleteExam}>
              {language === "ar" ? "حذف الامتحان" : language === "fr" ? "Supprimer l'examen" : "Delete Exam"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Exams;

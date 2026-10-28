import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses } from "@/contexts/CourseContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Users, 
  Search, 
  Plus, 
  Mail, 
  BookOpen,
  UserPlus,
  UserMinus,
  Loader2
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ViewToggle from "@/components/ViewToggle";
import { useNavigate, useParams, Navigate } from "@/lib/router";
import { toast } from "sonner";
import { StudentExcelManager } from "@/components/StudentExcelManager";
import StudentSearchBar from "@/components/StudentSearchBar";
import { matchesStudent, type StudentSearchMode } from "@/lib/search";
import { isSmallScreen } from "@/lib/device";

/** Mot de passe aléatoire (crypto.getRandomValues, repli Math.random). */
const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const makePassword = (len = 8) => {
  let out = '';
  try {
    const c: Crypto | undefined = (window as any).crypto || (window as any).msCrypto;
    if (c && c.getRandomValues) {
      const buf = new Uint32Array(len);
      c.getRandomValues(buf);
      for (let i = 0; i < len; i++) out += PASSWORD_CHARS.charAt(buf[i] % PASSWORD_CHARS.length);
      return out;
    }
  } catch { /* repli */ }
  for (let i = 0; i < len; i++) out += PASSWORD_CHARS.charAt(Math.floor(Math.random() * PASSWORD_CHARS.length));
  return out;
};

const Students = () => {
  const { roomId } = useParams();
  const { user, getStudents, addStudent } = useAuth();
  const { courses, enrollments, enrollStudent, removeEnrollment, refreshData, rooms } = useCourses();
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchMode, setSearchMode] = useState<StudentSearchMode>("all");
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">(() => (isSmallScreen() ? "grid" : "table"));
  const [isEnrollDialogOpen, setIsEnrollDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [enrollCourseId, setEnrollCourseId] = useState("");
  const [isAddStudentDialogOpen, setIsAddStudentDialogOpen] = useState(false);
  const [newStudentData, setNewStudentData] = useState({
    name: "",
    email: "",
    password: ""
  });
  const [addingStudent, setAddingStudent] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [unenrollTarget, setUnenrollTarget] = useState<{ student: any; course: { id: string; title: string } } | null>(null);
  const [unenrolling, setUnenrolling] = useState(false);
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en);

  // Fetch students
  useEffect(() => {
    const fetchStudents = async () => {
      if (students.length === 0) setLoading(true);
      try {
        const studentsList = await getStudents();
        setStudents(studentsList);
      } catch (error) {
        console.error("Failed to fetch students:", error);
        toast.error(tr("Impossible de charger les élèves", "تعذر تحميل التلاميذ", "Failed to load students"));
      } finally {
        setLoading(false);
      }
    };

    if (user?.role === "professor") {
      fetchStudents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, getStudents]);

  // Redirect to dashboard if not a professor or no roomId (après les hooks)
  if (!user || user.role !== "professor" || !roomId) {
    return <Navigate to="/dashboard" replace />;
  }

  // Filter students by professor's courses
  const professorCourses = courses.filter(c => c.professor_id === user?.id);
  const professorCourseIds = professorCourses.map(c => c.id);

  // Get students enrolled in professor's courses
  const enrolledStudents = students.filter(student => 
    enrollments.some(e => 
      e.student_id === student.id && 
      professorCourseIds.includes(e.course_id)
    )
  );

  // Get professor's rooms to show students imported to those rooms
  const professorRooms = rooms.filter(r => r.professor_id === user?.id);
  
  // Get all students that belong to the professor (either enrolled in courses or imported to their rooms)
  // For now, show all students since students are created through the professor's room context
  const professorStudents = user?.role === 'professor' ? students : enrolledStudents;

  // Filter students based on search and course selection
  const filteredStudents = professorStudents.filter(student => {
    const matchesSearch = matchesStudent(student as any, searchTerm, searchMode);
    
    if (selectedCourse === "all") return matchesSearch;
    
    return matchesSearch && enrollments.some(e => 
      e.student_id === student.id && 
      e.course_id === selectedCourse
    );
  });

  // Get student's enrolled courses count
  const getStudentCourseCount = (studentId: string): number => {
    return enrollments.filter(e => 
      e.student_id === studentId && 
      professorCourseIds.includes(e.course_id)
    ).length;
  };

  // Get courses a student is enrolled in
  const getStudentCourses = (studentId: string) => {
    const studentEnrollments = enrollments.filter(e => e.student_id === studentId);
    return professorCourses.filter(course => 
      studentEnrollments.some(e => e.course_id === course.id)
    );
  };

  // Handle student enrollment
  const handleEnrollStudent = async () => {
    if (!selectedStudent || !enrollCourseId || enrolling) return;

    // Check if already enrolled
    const alreadyEnrolled = enrollments.some(e => 
      e.student_id === selectedStudent.id && 
      e.course_id === enrollCourseId
    );

    if (alreadyEnrolled) {
      toast.error(tr("L'élève est déjà inscrit à ce cours", "التلميذ مسجل بالفعل في هذا الدرس", "Student is already enrolled in this course"));
      return;
    }

    setEnrolling(true);
    const success = await enrollStudent(enrollCourseId, selectedStudent.id).finally(() => setEnrolling(false));
    if (success) {
      setIsEnrollDialogOpen(false);
      setSelectedStudent(null);
      setEnrollCourseId("");
    }
  };

  // Handle remove enrollment
  const handleRemoveEnrollment = async (studentId: string, courseId: string) => {
    const enrollment = enrollments.find(e => 
      e.student_id === studentId && 
      e.course_id === courseId
    );
    
    if (!enrollment || unenrolling) return;

    // Le contexte affiche lui-même le message de succès / d'erreur
    setUnenrolling(true);
    try {
      const success = await removeEnrollment(enrollment.id);
      if (success) setUnenrollTarget(null);
    } finally {
      setUnenrolling(false);
    }
  };

  const openEnrollDialog = (student: any) => {
    setSelectedStudent(student);
    setIsEnrollDialogOpen(true);
  };


  const handleAddStudent = async () => {
    if (addingStudent) return;
    if (!newStudentData.name.trim() || !newStudentData.email.trim() || !newStudentData.password.trim()) {
      toast.error(tr("Veuillez remplir tous les champs", "يرجى ملء جميع الحقول", "Please fill in all fields"));
      return;
    }

    setAddingStudent(true);
    try {
      const success = await addStudent(newStudentData.email.trim(), newStudentData.password.trim(), newStudentData.name.trim());
      if (success) {
        setIsAddStudentDialogOpen(false);
        setNewStudentData({ name: "", email: "", password: "" });
        // Refresh students list
        const updatedStudents = await getStudents();
        setStudents(updatedStudents);
      }
    } finally {
      setAddingStudent(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-foreground/70" />
          <p>{t("students.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            
            <span>{t("students.management")}</span>
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            {t("students.manage.desc")}
          </p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <ViewToggle view={viewMode} onViewChange={setViewMode} />
          <Button 
            onClick={() => { setNewStudentData({ name: "", email: "", password: makePassword(8) }); setIsAddStudentDialogOpen(true); }}
            className="text-xs sm:text-sm font-semibold"
          >
            <Plus className="h-4 w-4" />
            {t("students.add")}
          </Button>
        </div>
      </div>

      {/* Student Excel Manager */}
      <StudentExcelManager 
        roomId={roomId} 
        onStudentsImported={async () => {
          const updatedStudents = await getStudents();
          setStudents(updatedStudents);
          // Also refresh enrollments data to show newly imported students
          await refreshData(roomId);
        }}
        existingStudents={students.map(s => {
          const parts = (s.name || '').trim().split(/\s+/);
          return {
            prenom: parts[0] || '',
            nom: parts.slice(1).join(' ') || s.name || '',
            codeMassar: s.username || '',
            username: s.username || '',
            temporaryPassword: (s as any).temporary_password || ''
          };
        })}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <StudentSearchBar
          query={searchTerm}
          onQueryChange={setSearchTerm}
          mode={searchMode}
          onModeChange={setSearchMode}
          resultCount={filteredStudents.length}
          totalCount={professorStudents.length}
          className="flex-1"
        />
        
        <Select value={selectedCourse} onValueChange={setSelectedCourse}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder={t("students.filter.course")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("students.all.courses")}</SelectItem>
            {professorCourses.map(course => (
              <SelectItem key={course.id} value={course.id}>
                {course.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Students Display */}
      {filteredStudents.length > 0 ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStudents.map((student) => (
              <Card key={student.id} className="overflow-hidden card-hover">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={student.avatar_url} alt={student.name} />
                      <AvatarFallback>
                        {student.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <CardTitle className="text-base">{student.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <Mail className="h-3 w-3" />
                        {student.email}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t("students.enrolled.courses")}</span>
                    <Badge variant="secondary">
                      {getStudentCourseCount(student.id)}
                    </Badge>
                  </div>
                  
                  {/* Course List */}
                  <div className="space-y-1">
                    {getStudentCourses(student.id).slice(0, 3).map(course => (
                      <div key={course.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate min-w-0">{course.title}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => setUnenrollTarget({ student, course })}
                          title={tr("Désinscrire du cours", "إلغاء التسجيل من الدرس", "Remove from course")}
                          aria-label={tr(`Désinscrire ${student.name} du cours ${course.title}`, `إلغاء تسجيل ${student.name} من درس ${course.title}`, `Remove ${student.name} from ${course.title}`)}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {getStudentCourses(student.id).length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{getStudentCourses(student.id).length - 3} {t("students.more.courses")}
                      </p>
                    )}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => openEnrollDialog(student)}
                  >
                    <UserPlus className="h-4 w-4" />
                    {t("students.enroll.in.course")}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table flat className="min-w-[620px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "ar" ? "التلميذ" : language === "fr" ? "Élève" : "Student"}</TableHead>
                    <TableHead>{language === "ar" ? "البريد الإلكتروني" : language === "fr" ? "E-mail" : "Email"}</TableHead>
                    <TableHead>{language === "ar" ? "عدد الدروس" : language === "fr" ? "Nb de cours" : "Courses"}</TableHead>
                    <TableHead>{language === "ar" ? "الدروس المسجلة" : language === "fr" ? "Cours inscrits" : "Enrolled courses"}</TableHead>
                    <TableHead className="text-end">{language === "ar" ? "الإجراءات" : language === "fr" ? "Actions" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={student.avatar_url} alt={student.name} />
                            <AvatarFallback>
                              {student.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium truncate max-w-[140px]">{student.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 min-w-0">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs sm:text-sm truncate max-w-[160px]">{student.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {getStudentCourseCount(student.id)} {t("students.courses")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {getStudentCourses(student.id).slice(0, 2).map(course => (
                            <div key={course.id} className="flex items-center justify-between">
                              <span className="truncate max-w-[130px] text-xs">{course.title}</span>
                            </div>
                          ))}
                          {getStudentCourses(student.id).length > 2 && (
                            <span className="text-muted-foreground text-xs">
                              +{getStudentCourses(student.id).length - 2} {t("students.more")}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => openEnrollDialog(student)}
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          {t("students.enroll")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">{t("students.no.found")}</h3>
            <p className="text-muted-foreground text-center">
              {searchTerm || selectedCourse !== "all" 
                ? t("students.no.match")
                : t("students.no.enrolled")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Enrollment Dialog */}
      <Dialog open={isEnrollDialogOpen} onOpenChange={setIsEnrollDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("students.enroll.title")}</DialogTitle>
            <DialogDescription>
              {t("students.enroll.desc")} {selectedStudent?.name}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="course">{t("students.course")}</Label>
              <Select value={enrollCourseId} onValueChange={setEnrollCourseId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("students.select.course")} />
                </SelectTrigger>
                <SelectContent>
                  {professorCourses.map(course => {
                    const isEnrolled = selectedStudent && enrollments.some(e => 
                      e.student_id === selectedStudent.id && 
                      e.course_id === course.id
                    );
                    
                    return (
                      <SelectItem 
                        key={course.id} 
                        value={course.id}
                        disabled={isEnrolled}
                      >
                        {course.title} {isEnrolled && `(${t("students.already.enrolled")})`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEnrollDialogOpen(false)}>
              {t("app.cancel")}
            </Button>
            <Button 
              onClick={handleEnrollStudent}
              disabled={!enrollCourseId || enrolling}
            >
              {enrolling && <Loader2 className="h-4 w-4 animate-spin" />}
              {tr("Inscrire l'élève", "تسجيل التلميذ", "Enroll student")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unenroll confirmation */}
      <AlertDialog open={!!unenrollTarget} onOpenChange={(o) => { if (!o && !unenrolling) setUnenrollTarget(null); }}>
        <AlertDialogContent className="w-[95vw] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{tr("Désinscrire l'élève ?", "إلغاء تسجيل التلميذ؟", "Remove student from course?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tr(
                `${unenrollTarget?.student?.name || ""} ne sera plus inscrit au cours « ${unenrollTarget?.course.title || ""} ».`,
                `لن يبقى ${unenrollTarget?.student?.name || ""} مسجلاً في درس « ${unenrollTarget?.course.title || ""} ».`,
                `${unenrollTarget?.student?.name || ""} will no longer be enrolled in "${unenrollTarget?.course.title || ""}".`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unenrolling}>{tr("Annuler", "إلغاء", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={unenrolling}
              onClick={(e) => { e.preventDefault(); if (unenrollTarget) void handleRemoveEnrollment(unenrollTarget.student.id, unenrollTarget.course.id); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {unenrolling && <Loader2 className="h-4 w-4 animate-spin" />}
              {tr("Désinscrire", "إلغاء التسجيل", "Remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Student Dialog */}
      <Dialog open={isAddStudentDialogOpen} onOpenChange={(o) => { if (!addingStudent) setIsAddStudentDialogOpen(o); }}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tr("Ajouter un élève", "إضافة تلميذ", "Add New Student")}</DialogTitle>
            <DialogDescription>
              {tr(
                "Créez le compte de l'élève puis communiquez-lui son e-mail et son mot de passe temporaire.",
                "أنشئ حساب التلميذ ثم أبلغه ببريده الإلكتروني وكلمة المرور المؤقتة.",
                "Create the student's account, then give them their email and temporary password."
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{tr("Nom complet", "الاسم الكامل", "Full Name")}</Label>
              <Input
                id="name"
                placeholder={tr("Nom et prénom de l'élève", "اسم التلميذ الكامل", "Student's full name")}
                value={newStudentData.name}
                onChange={(e) => setNewStudentData(prev => ({ ...prev, name: e.target.value }))}
                disabled={addingStudent}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{tr("E-mail", "البريد الإلكتروني", "Email")}</Label>
              <Input
                id="email"
                type="email"
                dir="ltr"
                placeholder={tr("E-mail de l'élève", "البريد الإلكتروني للتلميذ", "Student's email")}
                value={newStudentData.email}
                onChange={(e) => setNewStudentData(prev => ({ ...prev, email: e.target.value }))}
                disabled={addingStudent}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{tr("Mot de passe temporaire", "كلمة المرور المؤقتة", "Temporary Password")}</Label>
              <div className="flex gap-2">
                <Input
                  id="password"
                  type="text"
                  dir="ltr"
                  autoComplete="off"
                  className="font-mono"
                  placeholder={tr("Mot de passe temporaire", "كلمة المرور المؤقتة", "Temporary password")}
                  value={newStudentData.password}
                  onChange={(e) => setNewStudentData(prev => ({ ...prev, password: e.target.value }))}
                  disabled={addingStudent}
                />
                <Button type="button" variant="outline" onClick={() => setNewStudentData(prev => ({ ...prev, password: makePassword(8) }))} disabled={addingStudent}>
                  {tr("Générer", "توليد", "Generate")}
                </Button>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddStudentDialogOpen(false)} disabled={addingStudent}>
              {tr("Annuler", "إلغاء", "Cancel")}
            </Button>
            <Button 
              onClick={handleAddStudent}
              disabled={addingStudent || !newStudentData.name.trim() || !newStudentData.email.trim() || !newStudentData.password.trim()}
            >
              {addingStudent && <Loader2 className="h-4 w-4 animate-spin" />}
              {addingStudent ? tr("Création…", "جارٍ الإنشاء…", "Creating…") : tr("Ajouter l'élève", "إضافة التلميذ", "Add Student")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Students;
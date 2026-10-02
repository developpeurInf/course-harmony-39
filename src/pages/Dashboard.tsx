import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useCourses, Course, Exercise, Exam } from "@/contexts/CourseContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate, Link } from "react-router-dom";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  BookOpen, 
  FileText, 
  Calendar, 
  Users, 
  Building, 
  TrendingUp, 
  Award, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  BarChart3,
  RefreshCw,
  FileSpreadsheet,
  ArrowRight
} from "lucide-react";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area
} from "recharts";

interface RecentSubmission {
  id: string;
  exam_id: string;
  exam_title: string;
  student_id: string;
  student_name: string;
  student_avatar?: string;
  score: number | null;
  total_points: number | null;
  submitted_at: string;
}

interface ActivityPoint {
  date: string;
  submissions: number;
  activeStudents: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { 
    courses, 
    exercises, 
    exams, 
    enrollments, 
    rooms, 
    refreshData,
    getVisibleCoursesForStudent,
    getVisibleExercisesForStudent,
    getVisibleExamsForStudent
  } = useCourses();

  const isProfessor = user?.role === "professor";
  const [selectedRoomId, setSelectedRoomId] = useState<string>("all");
  const [loading, setLoading] = useState<boolean>(false);
  const [totalStudents, setTotalStudents] = useState<number>(0);
  const [recentSubmissions, setRecentSubmissions] = useState<RecentSubmission[]>([]);
  const [avgScore, setAvgScore] = useState<number>(0);
  const [totalSubmissionsCount, setTotalSubmissionsCount] = useState<number>(0);
  const [activityHistory, setActivityHistory] = useState<ActivityPoint[]>([]);

  // Filter professor rooms
  const professorRooms = useMemo(() => {
    if (!user) return [];
    if (isProfessor) {
      return rooms.filter(r => r.professor_id === user.id);
    }
    const studentEnrollments = enrollments.filter(e => e.student_id === user.id);
    const enrolledRoomIds = [...new Set(studentEnrollments.map(e => e.room_id).filter(Boolean))];
    return rooms.filter(r => r.is_visible && enrolledRoomIds.includes(r.id));
  }, [rooms, user, isProfessor, enrollments]);

  // Filtered courses based on selected room
  const displayCourses = useMemo(() => {
    if (isProfessor) {
      let list = courses.filter(c => 
        c.professor_id === user?.id || professorRooms.some(r => r.id === c.room_id)
      );
      if (selectedRoomId !== "all") {
        list = list.filter(c => c.room_id === selectedRoomId);
      }
      return list;
    } else if (user?.id) {
      return getVisibleCoursesForStudent(user.id);
    }
    return [];
  }, [courses, user, isProfessor, professorRooms, selectedRoomId, getVisibleCoursesForStudent]);

  const displayCourseIds = useMemo(() => displayCourses.map(c => c.id), [displayCourses]);

  // Filtered exercises
  const displayExercises = useMemo(() => {
    if (isProfessor) {
      return exercises.filter(ex => displayCourseIds.includes(ex.course_id));
    } else if (user?.id) {
      return getVisibleExercisesForStudent(user.id);
    }
    return [];
  }, [exercises, displayCourseIds, isProfessor, user, getVisibleExercisesForStudent]);

  // Filtered exams
  const displayExams = useMemo(() => {
    if (isProfessor) {
      return exams.filter(ex => displayCourseIds.includes(ex.course_id));
    } else if (user?.id) {
      return getVisibleExamsForStudent(user.id);
    }
    return [];
  }, [exams, displayCourseIds, isProfessor, user, getVisibleExamsForStudent]);

  // Upcoming exercises & exams (in next 14 days)
  const now = new Date();
  const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const upcomingExercises = useMemo(() => {
    return displayExercises
      .filter(ex => {
        try {
          const d = new Date(ex.due_date);
          return d >= now && d <= twoWeeksFromNow;
        } catch {
          return false;
        }
      })
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  }, [displayExercises, now, twoWeeksFromNow]);

  const upcomingExams = useMemo(() => {
    return displayExams
      .filter(ex => {
        try {
          const d = new Date(ex.exam_date);
          return d >= now && d <= twoWeeksFromNow;
        } catch {
          return false;
        }
      })
      .sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime());
  }, [displayExams, now, twoWeeksFromNow]);

  // Load dynamic submissions and metrics from Supabase
  const loadDynamicMetrics = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      if (isProfessor) {
        // 1. Total unique students
        const roomIds = selectedRoomId === "all" 
          ? professorRooms.map(r => r.id) 
          : [selectedRoomId];

        if (roomIds.length > 0) {
          const { data: studentsData } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'student')
            .in('room_id', roomIds);

          const { data: enrollData } = await supabase
            .from('enrollments')
            .select('student_id')
            .in('room_id', roomIds);

          const studentSet = new Set<string>();
          studentsData?.forEach(s => studentSet.add(s.id));
          enrollData?.forEach(e => studentSet.add(e.student_id));
          setTotalStudents(studentSet.size);
        } else {
          setTotalStudents(0);
        }

        // 2. Quiz Submissions & Average Score
        const relevantExamIds = displayExams.map(e => e.id);
        if (relevantExamIds.length > 0) {
          const { data: subsData } = await supabase
            .from('quiz_submissions')
            .select(`
              id,
              exam_id,
              student_id,
              score,
              total_points,
              submitted_at
            `)
            .in('exam_id', relevantExamIds)
            .order('submitted_at', { ascending: false })
            .limit(20);

          if (subsData && subsData.length > 0) {
            setTotalSubmissionsCount(subsData.length);
            const validScores = subsData.filter(s => s.score !== null).map(s => s.score as number);
            if (validScores.length > 0) {
              const sum = validScores.reduce((a, b) => a + b, 0);
              setAvgScore(Math.round(sum / validScores.length));
            }

            // Fetch student profiles for recent submissions
            const studentIds = [...new Set(subsData.map(s => s.student_id))];
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, name, avatar_url')
              .in('id', studentIds);

            const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
            const examMap = new Map(displayExams.map(e => [e.id, e.title]));

            const formattedRecent: RecentSubmission[] = subsData.slice(0, 5).map(s => {
              const profile = profileMap.get(s.student_id);
              return {
                id: s.id,
                exam_id: s.exam_id,
                exam_title: examMap.get(s.exam_id) || "Quiz",
                student_id: s.student_id,
                student_name: profile?.name || (language === "ar" ? "تلميذ" : "Élève"),
                student_avatar: profile?.avatar_url,
                score: s.score,
                total_points: s.total_points || 100,
                submitted_at: s.submitted_at
              };
            });
            setRecentSubmissions(formattedRecent);
          } else {
            setTotalSubmissionsCount(0);
            setAvgScore(0);
            setRecentSubmissions([]);
          }
        } else {
          setTotalSubmissionsCount(0);
          setAvgScore(0);
          setRecentSubmissions([]);
        }

        // 3. Weekly activity points filtered by selected room
        const activityList: ActivityPoint[] = [];
        const today = new Date();
        const currentDayIndex = today.getDay();

        // Start of current week on Sunday
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - currentDayIndex);

        // Build list of student IDs for the selected room(s)
        const roomStudentIds: string[] = [];
        if (roomIds.length > 0) {
          const { data: rStudents } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'student')
            .in('room_id', roomIds);
          const { data: rEnrollments } = await supabase
            .from('enrollments')
            .select('student_id')
            .in('room_id', roomIds);
          const rSet = new Set<string>();
          rStudents?.forEach(s => rSet.add(s.id));
          rEnrollments?.forEach(e => rSet.add(e.student_id));
          roomStudentIds.push(...Array.from(rSet));
        }

        // Exam IDs for the selected room (already computed above as relevantExamIds)
        const weeklyExamIds = relevantExamIds.length > 0 ? relevantExamIds : [];

        for (let i = 0; i < 7; i++) {
          const day = new Date(startOfWeek);
          day.setDate(startOfWeek.getDate() + i);
          const start = new Date(day);
          start.setHours(0, 0, 0, 0);
          const end = new Date(day);
          end.setHours(23, 59, 59, 999);

          const dayName = day.toLocaleDateString(
            language === "ar" ? "ar-MA" : language === "fr" ? "fr-FR" : "en-US",
            { weekday: "short" }
          );

          // If we have no students in the room at all, just push zeros
          if (roomIds.length > 0 && roomStudentIds.length === 0) {
            activityList.push({ date: dayName, activeStudents: 0, submissions: 0 });
            continue;
          }

          // Activities: filter by room student IDs
          let dayActQuery = supabase
            .from('student_activities')
            .select('student_id')
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString());
          if (roomStudentIds.length > 0) {
            dayActQuery = dayActQuery.in('student_id', roomStudentIds);
          }
          const { data: dayActivities } = await dayActQuery;

          // Submissions: filter by room exam IDs
          let daySubCount = 0;
          if (weeklyExamIds.length > 0) {
            const { data: daySubmissions } = await supabase
              .from('quiz_submissions')
              .select('id')
              .in('exam_id', weeklyExamIds)
              .gte('submitted_at', start.toISOString())
              .lte('submitted_at', end.toISOString());
            daySubCount = daySubmissions?.length || 0;
          }

          activityList.push({
            date: dayName,
            activeStudents: new Set(dayActivities?.map(a => a.student_id) || []).size,
            submissions: daySubCount
          });
        }
        setActivityHistory(activityList);

      } else {
        // Student Mode: Fetch personal submissions
        const { data: studentSubs } = await supabase
          .from('quiz_submissions')
          .select('*')
          .eq('student_id', user.id)
          .order('submitted_at', { ascending: false });

        if (studentSubs && studentSubs.length > 0) {
          setTotalSubmissionsCount(studentSubs.length);
          const validScores = studentSubs.filter(s => s.score !== null).map(s => s.score as number);
          if (validScores.length > 0) {
            const sum = validScores.reduce((a, b) => a + b, 0);
            setAvgScore(Math.round(sum / validScores.length));
          }
        }
      }
    } catch (err) {
      console.error("Failed to load dashboard dynamic metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDynamicMetrics();
  }, [user, selectedRoomId, displayExams.length, professorRooms.length]);

  const handleRefresh = () => {
    refreshData();
    loadDynamicMetrics();
  };

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {t("dashboard.welcome")}, {user?.name}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isProfessor
              ? (language === "ar"
                  ? "لوحة تحكم الأستاذ - متابعة تفاعلية للأقسام والأنشطة والامتحانات"
                  : language === "fr"
                  ? "Tableau de bord enseignant - Suivi en temps réel des classes, activités et quiz"
                  : "Teacher Dashboard - Real-time overview of classes, activities and exams")
              : (language === "ar"
                  ? "مساحتك التعليمية - تتبع الدروس والتمارين والامتحانات"
                  : language === "fr"
                  ? "Votre espace d'apprentissage - Suivez vos cours, exercices et examens"
                  : "Your learning space - Track your courses, exercises and exams")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isProfessor && professorRooms.length > 0 && (
            <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
              <SelectTrigger className="w-[180px] h-9 text-xs">
                <SelectValue placeholder={language === "ar" ? "كل الأقسام" : language === "fr" ? "Toutes les classes" : "All Classes"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {language === "ar" ? "🏫 كل الأقسام" : language === "fr" ? "🏫 Toutes les classes" : "🏫 All Classes"}
                </SelectItem>
                {professorRooms.map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh} 
            disabled={loading}
            className="h-9 px-3 text-xs gap-1.5"
            title={language === "ar" ? "تحديث البيانات" : language === "fr" ? "Actualiser" : "Refresh"}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">
              {language === "ar" ? "تحديث" : language === "fr" ? "Actualiser" : "Refresh"}
            </span>
          </Button>
        </div>
      </div>

      {/* No rooms prompt for professors */}
      {isProfessor && professorRooms.length === 0 && (
        <Card className="p-8 text-center border-dashed bg-card/60">
          <CardHeader>
            <Building className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-80" />
            <CardTitle>{t("dashboard.welcome.platform")}</CardTitle>
            <CardDescription className="text-base max-w-md mx-auto">
              {language === "ar"
                ? "ابدأ بإنشاء قسم دراسي لتنظيم التلاميذ والدروس والامتحانات."
                : language === "fr"
                ? "Commencez par créer une salle / classe pour organiser vos élèves, cours et examens."
                : "Get started by creating a classroom to organize students, courses, and exams."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate('/class-management')} 
              size="lg" 
              className="mt-2 gap-2"
            >
              <Building className="h-4 w-4" />
              {language === "ar" ? "إنشاء قسمك الأول" : language === "fr" ? "Créer votre première classe" : "Create your first room"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dynamic Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        {/* Classes/Rooms */}
        {isProfessor && (
          <Card className="shadow-sm border-l-4 border-l-primary hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {language === "ar" ? "الأقسام" : language === "fr" ? "Classes" : "Classes"}
              </CardTitle>
              <Building className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-2xl font-bold">{professorRooms.length}</div>
              <p className="text-[10px] text-muted-foreground">
                {language === "ar" ? "نشطة" : language === "fr" ? "actives" : "active"}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Courses */}
        <Card className="shadow-sm border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">{t("nav.courses")}</CardTitle>
            <BookOpen className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-2xl font-bold">{displayCourses.length}</div>
            <p className="text-[10px] text-muted-foreground">
              {isProfessor 
                ? (language === "ar" ? "متاح للتدريس" : language === "fr" ? "cours créés" : "courses created")
                : (language === "ar" ? "مسجل به" : language === "fr" ? "inscrits" : "enrolled")}
            </p>
          </CardContent>
        </Card>

        {/* Exercises */}
        <Card className="shadow-sm border-l-4 border-l-indigo-500 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">{t("nav.exercises")}</CardTitle>
            <FileText className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-2xl font-bold">{displayExercises.length}</div>
            <p className="text-[10px] text-muted-foreground">
              {language === "ar" ? "تمارين وواجبات" : language === "fr" ? "exercices publiés" : "exercises"}
            </p>
          </CardContent>
        </Card>

        {/* Exams & Quizzes */}
        <Card className="shadow-sm border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">{t("nav.exams")}</CardTitle>
            <Calendar className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-2xl font-bold">{displayExams.length}</div>
            <p className="text-[10px] text-muted-foreground">
              {language === "ar" ? "امتحانات وكويزات" : language === "fr" ? "évaluations" : "exams & quizzes"}
            </p>
          </CardContent>
        </Card>

        {/* Students */}
        {isProfessor && (
          <Card className="shadow-sm border-l-4 border-l-amber-500 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">{t("nav.students")}</CardTitle>
              <Users className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-2xl font-bold">{totalStudents}</div>
              <p className="text-[10px] text-muted-foreground">
                {language === "ar" ? "تلميذ مسجل" : language === "fr" ? "élèves inscrits" : "students"}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Average Score / Submissions */}
        <Card className="shadow-sm border-l-4 border-l-rose-500 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {language === "ar" ? "معدل النقاط" : language === "fr" ? "Moyenne Quiz" : "Avg Score"}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-2xl font-bold">{avgScore}%</div>
            <p className="text-[10px] text-muted-foreground">
              {totalSubmissionsCount} {language === "ar" ? "مشاركة" : language === "fr" ? "participations" : "submissions"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid: Activity Chart & Recent Submissions */}
      {isProfessor && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Weekly Activity Mini Chart */}
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  {language === "ar" ? "نشاط الأسبوع الحالي" : language === "fr" ? "Activité hebdomadaire" : "Weekly Activity"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {language === "ar"
                    ? "تتبع تفاعل التلاميذ والواجبات المقدمة خلال آخر 7 أيام"
                    : language === "fr"
                    ? "Taux de participation des élèves et soumissions de quiz sur 7 jours"
                    : "Student engagement and quiz submissions over the last 7 days"}
                </CardDescription>
              </div>
              <Link to="/reports">
                <Button variant="ghost" size="sm" className="text-xs gap-1">
                  <span>{language === "ar" ? "تقارير مفصلة" : language === "fr" ? "Voir rapports" : "View reports"}</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activityHistory}>
                    <defs>
                      <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorSubs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderRadius: "8px", borderColor: "hsl(var(--border))" }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="activeStudents" 
                      name={language === "ar" ? "تلاميذ متفاعلون" : language === "fr" ? "Élèves actifs" : "Active Students"} 
                      stroke="#3b82f6" 
                      fillOpacity={1} 
                      fill="url(#colorActive)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="submissions" 
                      name={language === "ar" ? "إجابات Quiz" : language === "fr" ? "Soumissions Quiz" : "Quiz Submissions"} 
                      stroke="#10b981" 
                      fillOpacity={1} 
                      fill="url(#colorSubs)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Recent Quiz Submissions Feed */}
          <Card className="shadow-sm flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center justify-between">
                <span>
                  {language === "ar" ? "آخر مشاركات Quiz" : language === "fr" ? "Dernières soumissions Quiz" : "Recent Submissions"}
                </span>
                <Award className="h-4 w-4 text-amber-500" />
              </CardTitle>
              <CardDescription className="text-xs">
                {language === "ar" ? "نتائج التلاميذ المباشرة" : language === "fr" ? "Résultats récents des élèves" : "Latest student results"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 flex-1 overflow-y-auto max-h-[230px] custom-scrollbar">
              {recentSubmissions.length > 0 ? (
                recentSubmissions.map((sub) => {
                  const scorePercent = sub.score !== null ? Math.round(sub.score) : 0;
                  return (
                    <div key={sub.id} className="flex items-center justify-between p-2 rounded-lg border bg-card hover:bg-muted/40 transition-colors text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarImage src={sub.student_avatar} />
                          <AvatarFallback className="text-[10px]">
                            {sub.student_name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="truncate">
                          <p className="font-medium truncate">{sub.student_name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{sub.exam_title}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge 
                          variant={scorePercent >= 80 ? "default" : scorePercent >= 50 ? "secondary" : "destructive"}
                          className="text-[10px] font-semibold"
                        >
                          {scorePercent}%
                        </Badge>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-muted-foreground text-xs flex flex-col items-center justify-center h-full">
                  <CheckCircle2 className="h-8 w-8 mb-2 opacity-40 text-muted-foreground" />
                  <p>{language === "ar" ? "لا توجد مشاركات حديثة بعد" : language === "fr" ? "Aucune soumission récente" : "No recent submissions"}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Deadlines & Upcoming Exams Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Deadlines (Exercises) */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">{t("dashboard.deadlines")}</CardTitle>
              <CardDescription className="text-xs">
                {t("dashboard.deadlines.desc")}
              </CardDescription>
            </div>
            <Clock className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            {upcomingExercises.length > 0 ? (
              <ul className="space-y-2.5">
                {upcomingExercises.slice(0, 5).map(exercise => {
                  const course = courses.find(c => c.id === exercise.course_id);
                  return (
                    <li 
                      key={exercise.id} 
                      className="flex justify-between items-center p-2.5 border rounded-lg hover:bg-muted/40 transition-colors text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold truncate">{exercise.title}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{course?.title}</div>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px] border-indigo-200 text-indigo-700 dark:text-indigo-400">
                        {t("dashboard.due")} {format(new Date(exercise.due_date), "dd MMM")}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-xs">
                <CheckCircle2 className="h-6 w-6 mx-auto mb-2 opacity-40 text-emerald-500" />
                {t("dashboard.no.deadlines")}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Exams & Quizzes */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">{t("dashboard.upcoming.exams")}</CardTitle>
              <CardDescription className="text-xs">
                {t("dashboard.upcoming.exams.desc")}
              </CardDescription>
            </div>
            <Calendar className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {upcomingExams.length > 0 ? (
              <ul className="space-y-2.5">
                {upcomingExams.slice(0, 5).map(exam => {
                  const course = courses.find(c => c.id === exam.course_id);
                  return (
                    <li 
                      key={exam.id} 
                      className="flex justify-between items-center p-2.5 border rounded-lg hover:bg-muted/40 transition-colors text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold truncate flex items-center gap-1.5">
                          <span>{exam.title}</span>
                          <Badge variant="secondary" className="text-[9px] py-0 px-1 font-normal">
                            {exam.type === 'quiz' ? 'Quiz' : 'Exam'}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">{course?.title}</div>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px] border-emerald-200 text-emerald-700 dark:text-emerald-400">
                        {format(new Date(exam.exam_date), "dd MMM, HH:mm")}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-xs">
                <Calendar className="h-6 w-6 mx-auto mb-2 opacity-40 text-muted-foreground" />
                {t("dashboard.no.exams")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Classes / Courses Overview Grid */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">{t("dashboard.your.courses")}</CardTitle>
            <CardDescription className="text-xs">
              {isProfessor 
                ? (language === "ar" ? "قائمة الدروس والمحتويات التعليمية النشطة" : language === "fr" ? "Vos cours actifs et leur nombre d'élèves" : "Active courses and student enrollments")
                : t("dashboard.your.courses.student")}
            </CardDescription>
          </div>
          {isProfessor && (
            <Link to="/courses">
              <Button variant="outline" size="sm" className="text-xs gap-1">
                <span>{language === "ar" ? "إدارة الدروس" : language === "fr" ? "Gérer les cours" : "Manage Courses"}</span>
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {displayCourses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayCourses.map(course => {
                const courseStudentsCount = enrollments.filter(e => e.course_id === course.id).length;
                const courseExercisesCount = exercises.filter(e => e.course_id === course.id).length;
                const courseExamsCount = exams.filter(e => e.course_id === course.id).length;

                return (
                  <Card key={course.id} className="card-hover border overflow-hidden">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex justify-between items-start gap-2">
                        <CardTitle className="text-sm font-semibold truncate" title={course.title}>
                          {course.title}
                        </CardTitle>
                        {!course.is_visible && (
                          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 shrink-0">
                            {t("dashboard.hidden")}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-1 space-y-2">
                      <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">
                        {course.description || (language === "ar" ? "لا يوجد وصف" : "Aucune description")}
                      </p>
                      
                      <div className="flex items-center justify-between pt-2 border-t text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span>{courseStudentsCount} {language === "ar" ? "تلميذ" : "élèves"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>{courseExercisesCount} ex.</span>
                          <span>•</span>
                          <span>{courseExamsCount} quiz</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-xs">
              <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>
                {user?.role === "student" 
                  ? t("dashboard.no.courses.student") 
                  : t("dashboard.no.courses.professor")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;

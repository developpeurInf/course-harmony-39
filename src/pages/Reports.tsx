import { Link } from "react-router-dom";
import { downloadExcelFile } from '@/lib/download';
import * as XLSX from 'xlsx';
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from "recharts";
import { 
  BookOpen, 
  FileText, 
  GraduationCap, 
  Users, 
  TrendingUp, 
  Calendar, 
  Download, 
  Filter, 
  BarChart3, 
  FileSpreadsheet, 
  Search, 
  RefreshCw,
  Award,
  CheckCircle,
  Clock
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

const MONTHS_AR: Record<string, string> = {
  "Jan": "يناير", "Feb": "فبراير", "Mar": "مارس", "Apr": "أبريل",
  "May": "مايو", "Jun": "يونيو", "Jul": "يوليو", "Aug": "أغسطس",
  "Sep": "سبتمبر", "Oct": "أكتوبر", "Nov": "نوفمبر", "Dec": "ديسمبر"
};

interface Room {
  id: string;
  name: string;
}

interface StudentReport {
  id: string;
  name: string;
  username?: string;
  avatar_url?: string;
  courses_enrolled: number;
  exercises_completed: number;
  exams_taken: number;
  average_score: number;
  last_activity: string;
}

interface CourseReport {
  id: string;
  title: string;
  students_enrolled: number;
  exercises_count: number;
  exams_count: number;
  completion_rate: number;
}

interface ActivityData {
  date: string;
  students_active: number;
  exercises_submitted: number;
  exams_taken: number;
}

const Reports = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>("all");
  const [studentReports, setStudentReports] = useState<StudentReport[]>([]);
  const [courseReports, setCourseReports] = useState<CourseReport[]>([]);
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [studentSearch, setStudentSearch] = useState("");
  
  // Overview data
  const [overviewData, setOverviewData] = useState({
    totalStudents: 0,
    totalCourses: 0,
    totalExams: 0,
    averageScore: 0,
    totalSubmissions: 0
  });

  useEffect(() => {
    if (user?.role === 'professor') {
      loadRooms();
    }
  }, [user]);

  useEffect(() => {
    loadReports();
  }, [selectedRoom, user]);

  const loadRooms = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('id, name')
        .eq('professor_id', user.id)
        .order('name');

      if (error) {
        console.error('Error loading rooms:', error);
        return;
      }

      setRooms(data || []);
    } catch (error) {
      console.error('Error loading rooms:', error);
    }
  };

  const loadReports = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      await Promise.all([
        loadStudentReports(),
        loadCourseReports(),
        loadActivityData(),
        loadOverviewData()
      ]);
    } catch (error) {
      console.error('Error loading reports:', error);
      toast.error(language === "ar" ? "تعذر تحميل التقارير" : "Erreur de chargement des rapports");
    } finally {
      setLoading(false);
    }
  };

  const loadStudentReports = async () => {
    if (!user?.id) return;
    try {
      // 1. Get room IDs to filter
      let targetRoomIds: string[] = [];
      if (selectedRoom === "all") {
        const { data: profRooms } = await supabase
          .from('rooms')
          .select('id')
          .eq('professor_id', user.id);
        targetRoomIds = profRooms?.map(r => r.id) || [];
      } else {
        targetRoomIds = [selectedRoom];
      }

      if (targetRoomIds.length === 0) {
        setStudentReports([]);
        return;
      }

      // 2. Get students in these rooms via profiles and enrollments
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url')
        .eq('role', 'student')
        .in('room_id', targetRoomIds);

      const { data: enrollmentsData } = await supabase
        .from('enrollments')
        .select('student_id')
        .in('room_id', targetRoomIds);

      const studentIds = [
        ...new Set([
          ...(profilesData?.map(p => p.id) || []),
          ...(enrollmentsData?.map(e => e.student_id) || [])
        ])
      ];

      if (studentIds.length === 0) {
        setStudentReports([]);
        return;
      }

      // Fetch full profile info for students
      const { data: fullProfiles } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url')
        .in('id', studentIds);

      // Fetch quiz submissions for all these students
      const { data: allSubmissions } = await supabase
        .from('quiz_submissions')
        .select('student_id, score, submitted_at')
        .in('student_id', studentIds);

      // Fetch enrollments counts
      const { data: allStudentEnrollments } = await supabase
        .from('enrollments')
        .select('student_id, course_id')
        .in('student_id', studentIds);

      const reports: StudentReport[] = (fullProfiles || []).map(profile => {
        const studentSubs = allSubmissions?.filter(s => s.student_id === profile.id) || [];
        const studentEnrolls = allStudentEnrollments?.filter(e => e.student_id === profile.id) || [];

        const validScores = studentSubs.filter(s => s.score !== null).map(s => s.score as number);
        const avg = validScores.length > 0
          ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
          : 0;

        const lastSubTime = studentSubs.length > 0
          ? Math.max(...studentSubs.map(s => new Date(s.submitted_at).getTime()))
          : 0;

        return {
          id: profile.id,
          name: profile.name,
          username: profile.username,
          avatar_url: profile.avatar_url,
          courses_enrolled: studentEnrolls.length,
          exercises_completed: 0,
          exams_taken: studentSubs.length,
          average_score: avg,
          last_activity: lastSubTime > 0 ? new Date(lastSubTime).toISOString() : new Date().toISOString()
        };
      });

      setStudentReports(reports);
    } catch (err) {
      console.error("Error loading student reports:", err);
    }
  };

  const loadCourseReports = async () => {
    if (!user?.id) return;
    try {
      let query = supabase
        .from('courses')
        .select('id, title, room_id')
        .eq('professor_id', user.id);

      if (selectedRoom !== "all") {
        query = query.eq('room_id', selectedRoom);
      }

      const { data: coursesData, error } = await query;
      if (error) throw error;

      const reports: CourseReport[] = [];
      for (const course of coursesData || []) {
        // Count enrollments
        const { count: enrollCount } = await supabase
          .from('enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', course.id);

        // Count exercises
        const { count: exCount } = await supabase
          .from('exercises')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', course.id);

        // Count exams
        const { data: courseExams, count: examCount } = await supabase
          .from('exams')
          .select('id', { count: 'exact' })
          .eq('course_id', course.id);

        // Calculate completion rate based on quiz submissions
        let completionRate = 0;
        const examIds = courseExams?.map(e => e.id) || [];
        if (examIds.length > 0 && enrollCount && enrollCount > 0) {
          const { data: submissions } = await supabase
            .from('quiz_submissions')
            .select('student_id')
            .in('exam_id', examIds);

          const uniqueStudents = new Set(submissions?.map(s => s.student_id) || []);
          completionRate = Math.min(100, Math.round((uniqueStudents.size / enrollCount) * 100));
        }

        reports.push({
          id: course.id,
          title: course.title,
          students_enrolled: enrollCount || 0,
          exercises_count: exCount || 0,
          exams_count: examCount || 0,
          completion_rate: completionRate
        });
      }

      setCourseReports(reports);
    } catch (err) {
      console.error("Error loading course reports:", err);
    }
  };

  const loadActivityData = async () => {
    if (!user?.id) return;
    try {
      const data: ActivityData[] = [];
      const today = new Date();
      const currentDayIndex = today.getDay(); // 0 = Sunday

      // Start of current week on Sunday
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - currentDayIndex);

      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        let actQuery = supabase
          .from('student_activities')
          .select('student_id')
          .gte('created_at', startOfDay.toISOString())
          .lte('created_at', endOfDay.toISOString());

        if (selectedRoom !== "all") {
          actQuery = actQuery.eq('room_id', selectedRoom);
        }

        const { data: activities } = await actQuery;
        const activeStudents = new Set(activities?.map(a => a.student_id) || []);

        const { data: submissions } = await supabase
          .from('quiz_submissions')
          .select('id')
          .gte('submitted_at', startOfDay.toISOString())
          .lte('submitted_at', endOfDay.toISOString());

        const dayShort = date.toLocaleDateString(
          language === "ar" ? "ar-MA" : language === "fr" ? "fr-FR" : "en-US",
          { weekday: "short" }
        );
        const dayNum = date.getDate();
        const dateLabel = `${dayShort} ${dayNum}`;

        data.push({
          date: dateLabel,
          students_active: activeStudents.size,
          exercises_submitted: 0,
          exams_taken: submissions?.length || 0
        });
      }

      setActivityData(data);
    } catch (err) {
      console.error("Error loading activity data:", err);
    }
  };

  const loadOverviewData = async () => {
    if (!user?.id) return;
    try {
      let targetRoomIds: string[] = [];
      if (selectedRoom === "all") {
        const { data: profRooms } = await supabase
          .from('rooms')
          .select('id')
          .eq('professor_id', user.id);
        targetRoomIds = profRooms?.map(r => r.id) || [];
      } else {
        targetRoomIds = [selectedRoom];
      }

      // 1. Total Courses
      let courseQuery = supabase
        .from('courses')
        .select('id')
        .eq('professor_id', user.id);

      if (selectedRoom !== "all") {
        courseQuery = courseQuery.eq('room_id', selectedRoom);
      }

      const { data: coursesData } = await courseQuery;
      const courseIds = coursesData?.map(c => c.id) || [];

      // 2. Total Students
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'student')
        .in('room_id', targetRoomIds);

      const { data: enrollData } = await supabase
        .from('enrollments')
        .select('student_id')
        .in('room_id', targetRoomIds);

      const studentSet = new Set<string>();
      profilesData?.forEach(p => studentSet.add(p.id));
      enrollData?.forEach(e => studentSet.add(e.student_id));

      // 3. Total Exams
      let totalExams = 0;
      if (courseIds.length > 0) {
        const { count } = await supabase
          .from('exams')
          .select('*', { count: 'exact', head: true })
          .in('course_id', courseIds);
        totalExams = count || 0;
      }

      // 4. Submissions & Average Score
      let avg = 0;
      let subsCount = 0;
      if (studentSet.size > 0) {
        const { data: subs } = await supabase
          .from('quiz_submissions')
          .select('score')
          .in('student_id', Array.from(studentSet));

        subsCount = subs?.length || 0;
        const valid = subs?.filter(s => s.score !== null).map(s => s.score as number) || [];
        if (valid.length > 0) {
          avg = Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
        }
      }

      setOverviewData({
        totalStudents: studentSet.size,
        totalCourses: courseIds.length,
        totalExams: totalExams,
        averageScore: avg,
        totalSubmissions: subsCount
      });
    } catch (err) {
      console.error("Error loading overview data:", err);
    }
  };

  const exportReport = async () => {
    try {
      const reportData = studentReports.map(student => ({
        [language === "ar" ? "اسم التلميذ" : language === "fr" ? "Nom de l'élève" : "Student Name"]: student.name,
        [language === "ar" ? "اسم المستخدم" : language === "fr" ? "Identifiant" : "Username"]: student.username || '',
        [language === "ar" ? "الدروس المسجلة" : language === "fr" ? "Cours inscrits" : "Enrolled Courses"]: student.courses_enrolled,
        [language === "ar" ? "الامتحانات المنجزة" : language === "fr" ? "Examens passés" : "Exams Taken"]: student.exams_taken,
        [language === "ar" ? "المعدل العام %" : language === "fr" ? "Note moyenne (%)" : "Average Score (%)"]: student.average_score
      }));

      const ws = XLSX.utils.json_to_sheet(reportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Rapports");
      const filename = `rapport_eleves_${new Date().toISOString().split('T')[0]}.xlsx`;

      await downloadExcelFile(wb, filename);
      toast.success(
        language === "ar" 
          ? "تم تصدير التقرير بصيغة Excel بنجاح" 
          : language === "fr" 
          ? "Rapport exporté en Excel avec succès" 
          : "Report exported to Excel successfully"
      );
    } catch (error) {
      console.error('Export error:', error);
      toast.error(language === "ar" ? "فشل تصدير التقرير" : "Échec de l'exportation");
    }
  };

  const filteredStudentReports = useMemo(() => {
    if (!studentSearch.trim()) return studentReports;
    const q = studentSearch.toLowerCase();
    return studentReports.filter(s => 
      s.name.toLowerCase().includes(q) || 
      (s.username && s.username.toLowerCase().includes(q))
    );
  }, [studentReports, studentSearch]);

  const pieChartData = useMemo(() => [
    { 
      name: language === "ar" ? "ممتاز (90-100)" : language === "fr" ? "Excellent (90-100)" : "Excellent (90-100)", 
      value: studentReports.filter(s => s.average_score >= 90).length, 
      color: '#10B981' 
    },
    { 
      name: language === "ar" ? "جيد جدا (80-89)" : language === "fr" ? "Très bien (80-89)" : "Good (80-89)", 
      value: studentReports.filter(s => s.average_score >= 80 && s.average_score < 90).length, 
      color: '#3B82F6' 
    },
    { 
      name: language === "ar" ? "مستحسن (70-79)" : language === "fr" ? "Moyen (70-79)" : "Average (70-79)", 
      value: studentReports.filter(s => s.average_score >= 70 && s.average_score < 80).length, 
      color: '#F59E0B' 
    },
    { 
      name: language === "ar" ? "يحتاج دعم (<70)" : language === "fr" ? "À renforcer (<70)" : "Below Average (<70)", 
      value: studentReports.filter(s => s.average_score < 70 && s.exams_taken > 0).length, 
      color: '#EF4444' 
    }
  ], [studentReports, language]);

  if (user?.role !== 'professor') {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              {language === "ar" 
                ? "التقارير متاحة للأساتذة فقط." 
                : language === "fr" 
                ? "Les rapports sont réservés aux enseignants." 
                : "Reports are only available for professors."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header and Filter */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {language === "ar" ? "التقارير والإحصائيات" : language === "fr" ? "Rapports & Statistiques" : "Reports & Analytics"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {language === "ar" 
              ? "تحليل شامل ومفصل لأداء التلاميذ ونسب النجاح والأنشطة" 
              : language === "fr" 
              ? "Analyses détaillées des performances des élèves et taux de participation" 
              : "Comprehensive insights into student performance and engagement"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedRoom} onValueChange={setSelectedRoom}>
            <SelectTrigger className="w-[190px] h-9 text-xs">
              <SelectValue placeholder={language === "ar" ? "كل الأقسام" : language === "fr" ? "Toutes les classes" : "All classes"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {language === "ar" ? "🏫 كل الأقسام" : language === "fr" ? "🏫 Toutes les classes" : "🏫 All Classes"}
              </SelectItem>
              {rooms.map((room) => (
                <SelectItem key={room.id} value={room.id}>
                  {room.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={exportReport} variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            <span>{language === "ar" ? "تصدير Excel" : language === "fr" ? "Exporter Excel" : "Export Excel"}</span>
          </Button>

          <Button 
            onClick={loadReports} 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 shrink-0" 
            title={language === "ar" ? "تحديث" : "Actualiser"}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Banner Évaluation Diagnostique (Maroc) */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-slate-900 border border-indigo-200 dark:border-indigo-900 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white dark:bg-indigo-900/60 border border-indigo-100 dark:border-indigo-800 rounded-xl flex items-center justify-center p-2 shadow-sm shrink-0">
            <img src="/assets/header_logo.png" alt="Royaume du Maroc" className="max-h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm md:text-base font-bold text-slate-900 dark:text-white">
                {language === "ar" ? "التقويم التشخيصي والتقرير الرسمي (وزارة التربية الوطنية)" : "Évaluation Diagnostique & Rapport Officiel (Édition Maroc)"}
              </h3>
              <Badge className="bg-indigo-600 text-white text-[10px]">Article 08</Badge>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              {language === "ar"
                ? "إصدار التقرير الرسمي للتقويم التشخيصي حسب الفئات الأربع المعتمدة وزارياً مع التصدير لـ PDF واستيراد نقط مسار."
                : "Générez votre rapport officiel d'évaluation diagnostique conforme aux 4 tranches ministérielles avec export PDF et import Excel Massar."}
            </p>
          </div>
        </div>
        <Link to="/diagnostic">
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-2 shrink-0">
            <FileSpreadsheet className="w-4 h-4" />
            <span>{language === "ar" ? "فتح فضاء التقويم التشخيصي" : "Ouvrir DiagEval Pro"}</span>
          </Button>
        </Link>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 h-10">
          <TabsTrigger value="overview" className="text-xs md:text-sm">
            {language === "ar" ? "📊 نظرة عامة" : language === "fr" ? "📊 Vue d'ensemble" : "📊 Overview"}
          </TabsTrigger>
          <TabsTrigger value="students" className="text-xs md:text-sm">
            {language === "ar" ? "👥 التلاميذ" : language === "fr" ? "👥 Élèves" : "👥 Students"}
          </TabsTrigger>
          <TabsTrigger value="courses" className="text-xs md:text-sm">
            {language === "ar" ? "📚 الدروس" : language === "fr" ? "📚 Cours" : "📚 Courses"}
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-xs md:text-sm">
            {language === "ar" ? "📈 النشاط" : language === "fr" ? "📈 Activité" : "📈 Activity"}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card className="shadow-sm border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {language === "ar" ? "إجمالي التلاميذ" : language === "fr" ? "Total Élèves" : "Total Students"}
                </CardTitle>
                <Users className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{overviewData.totalStudents}</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {selectedRoom === "all" 
                    ? (language === "ar" ? "في جميع الأقسام" : "Toutes les classes") 
                    : (language === "ar" ? "في هذا القسم" : "Dans cette classe")}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-indigo-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {language === "ar" ? "إجمالي الدروس" : language === "fr" ? "Total Cours" : "Total Courses"}
                </CardTitle>
                <BookOpen className="h-4 w-4 text-indigo-500" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{overviewData.totalCourses}</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {language === "ar" ? "مقررات منشورة" : "cours actifs"}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-emerald-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {language === "ar" ? "معدل النقاط" : language === "fr" ? "Note moyenne" : "Average Score"}
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{overviewData.averageScore}%</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {overviewData.totalSubmissions} {language === "ar" ? "مشاركة" : "soumissions"}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-l-4 border-l-amber-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {language === "ar" ? "الامتحانات & Quiz" : language === "fr" ? "Examens & Quiz" : "Exams & Quizzes"}
                </CardTitle>
                <GraduationCap className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{overviewData.totalExams}</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {language === "ar" ? "إجمالي التقييمات" : "évaluations créées"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Performance Distribution */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">
                  {language === "ar" ? "توزيع مستويات التلاميذ" : language === "fr" ? "Répartition des performances" : "Performance Distribution"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {language === "ar" ? "حسب نسب النجاح والمعدلات" : "Répartition des élèves par tranche de note"}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={45}
                        dataKey="value"
                        label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Weekly Activity Line Chart */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">
                  {language === "ar" ? "النشاط الأسبوعي" : language === "fr" ? "Activité sur 7 jours" : "Weekly Activity"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {language === "ar" ? "متابعة الحضور وإنجاز الامتحانات" : "Évolution des élèves actifs et soumissions"}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={activityData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderRadius: "8px", borderColor: "hsl(var(--border))" }}
                      />
                      <Legend verticalAlign="bottom" height={36} />
                      <Line 
                        type="monotone" 
                        dataKey="students_active" 
                        name={language === "ar" ? "تلاميذ نشطون" : language === "fr" ? "Élèves actifs" : "Active Students"} 
                        stroke="#3B82F6" 
                        strokeWidth={2.5} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="exams_taken" 
                        name={language === "ar" ? "إجابات Quiz" : language === "fr" ? "Quiz passés" : "Exams Taken"} 
                        stroke="#10B981" 
                        strokeWidth={2.5} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Students */}
        <TabsContent value="students" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3">
              <div>
                <CardTitle className="text-base font-semibold">
                  {language === "ar" ? "تقرير أداء التلاميذ" : language === "fr" ? "Rapport de performance des élèves" : "Student Performance Report"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {language === "ar" ? "تفاصيل إنجازات ودرجات كل تلميذ" : "Détails des notes, quiz et cours suivis par élève"}
                </CardDescription>
              </div>

              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder={language === "ar" ? "بحث عن تلميذ..." : language === "fr" ? "Rechercher un élève..." : "Search student..."}
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center py-8 text-muted-foreground text-xs animate-pulse">
                  {language === "ar" ? "جاري تحميل بيانات التلاميذ..." : "Chargement des données élèves..."}
                </p>
              ) : filteredStudentReports.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-xs">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>{language === "ar" ? "لم يتم العثور على تلاميذ" : "Aucun élève trouvé"}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredStudentReports.map((student) => (
                    <div 
                      key={student.id} 
                      className="p-3.5 rounded-lg border bg-card hover:bg-muted/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border shadow-xs">
                          <AvatarImage src={student.avatar_url} />
                          <AvatarFallback className="font-semibold text-xs bg-primary/10 text-primary">
                            {student.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-semibold text-sm">{student.name}</h4>
                          {student.username && (
                            <p className="text-xs text-muted-foreground">@{student.username}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 md:grid-cols-4 gap-4 text-center md:text-right">
                        <div>
                          <p className="text-[11px] text-muted-foreground">
                            {language === "ar" ? "الدروس" : "Cours"}
                          </p>
                          <p className="text-sm font-semibold">{student.courses_enrolled}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">
                            {language === "ar" ? "Quiz منجزة" : "Quiz passés"}
                          </p>
                          <p className="text-sm font-semibold">{student.exams_taken}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">
                            {language === "ar" ? "المعدل" : "Moyenne"}
                          </p>
                          <div className="flex items-center justify-center md:justify-end gap-1.5 mt-0.5">
                            <span className="text-sm font-bold">{student.average_score}%</span>
                            <Badge 
                              variant={
                                student.average_score >= 90 ? "default" :
                                student.average_score >= 80 ? "secondary" :
                                student.average_score >= 70 ? "outline" : "destructive"
                              }
                              className="text-[9px] px-1 py-0"
                            >
                              {student.average_score >= 90 ? (language === "ar" ? "ممتاز" : "Excellent") :
                               student.average_score >= 80 ? (language === "ar" ? "جيد جدا" : "Très bien") :
                               student.average_score >= 70 ? (language === "ar" ? "مستحسن" : "Moyen") : 
                               (language === "ar" ? "دعم" : "Soutien")}
                            </Badge>
                          </div>
                        </div>
                        <div className="hidden md:block">
                          <p className="text-[11px] text-muted-foreground">
                            {language === "ar" ? "آخر نشاط" : "Dernière act."}
                          </p>
                          <p className="text-xs mt-0.5">
                            {new Date(student.last_activity).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Courses */}
        <TabsContent value="courses" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                {language === "ar" ? "تحليلات الدروس" : language === "fr" ? "Analyses par cours" : "Course Analytics"}
              </CardTitle>
              <CardDescription className="text-xs">
                {language === "ar" ? "نسبة إتمام الدروس وإقبال التلاميذ" : "Taux d'engagement et de complétion par cours"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center py-8 text-muted-foreground text-xs animate-pulse">
                  {language === "ar" ? "جاري تحميل بيانات الدروس..." : "Chargement des cours..."}
                </p>
              ) : courseReports.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-xs">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>{language === "ar" ? "لم يتم العثور على دروس" : "Aucun cours trouvé"}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {courseReports.map((course) => (
                    <Card key={course.id} className="p-4 shadow-xs">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-sm md:text-base">{course.title}</h4>
                        <Badge variant="outline" className="text-xs gap-1">
                          <Users className="h-3 w-3" />
                          <span>{course.students_enrolled} {language === "ar" ? "تلميذ" : "élèves"}</span>
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
                        <div>
                          <p className="text-xs text-muted-foreground">{language === "ar" ? "التمارين" : "Exercices"}</p>
                          <p className="text-lg font-bold">{course.exercises_count}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{language === "ar" ? "الامتحانات" : "Examens / Quiz"}</p>
                          <p className="text-lg font-bold">{course.exams_count}</p>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">{language === "ar" ? "نسبة المشاركة" : "Taux de complétion"}</span>
                            <span className="font-bold">{course.completion_rate}%</span>
                          </div>
                          <Progress value={course.completion_rate} className="h-2" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Activity Timeline */}
        <TabsContent value="activity" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                {language === "ar" ? "المخطط الزمني لنشاط التلاميذ" : language === "fr" ? "Chronologie d'activité des élèves" : "Activity Timeline"}
              </CardTitle>
              <CardDescription className="text-xs">
                {language === "ar" ? "إحصائيات التفاعل اليومي" : "Activité journalière et passages de quiz"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activityData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderRadius: "8px", borderColor: "hsl(var(--border))" }}
                    />
                    <Legend verticalAlign="bottom" height={36} />
                    <Bar 
                      dataKey="students_active" 
                      fill="#3B82F6" 
                      radius={[4, 4, 0, 0]}
                      name={language === "ar" ? "تلاميذ نشطون" : language === "fr" ? "Élèves actifs" : "Active Students"} 
                    />
                    <Bar 
                      dataKey="exams_taken" 
                      fill="#10B981" 
                      radius={[4, 4, 0, 0]}
                      name={language === "ar" ? "إجابات Quiz" : language === "fr" ? "Quiz complétés" : "Exams Taken"} 
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;
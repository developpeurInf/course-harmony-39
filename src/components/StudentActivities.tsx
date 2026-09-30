import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Clock, Download, Eye, User, Activity, Calendar, TrendingUp,
  Trophy, Wifi, WifiOff, LogIn, LogOut, Star, Flame, BarChart2,
  ChevronDown, ChevronUp, RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { format, formatDistanceToNow, isToday } from "date-fns";
import { fr, ar, enUS } from "date-fns/locale";

// ─────────────────────────── interfaces ───────────────────────────

interface StudentProfile {
  id: string;
  name: string;
  email: string;
  username: string;
  avatar_url?: string;
}

interface StudentActivity {
  id: string;
  student_id: string;
  activity_type: string;
  activity_data: any;
  created_at: string;
  session_id: string;
}

interface StudentSession {
  id: string;
  student_id: string;
  session_start: string;
  session_end?: string;
  duration_minutes?: number;
  is_active: boolean;
  last_activity: string;
}

interface QuizSubmission {
  id: string;
  student_id: string;
  score: number;
  total_points: number;
  submitted_at: string;
}

// Per-student aggregated stats for the Ranking tab
interface StudentStat {
  student: StudentProfile;
  totalMinutes: number;
  sessionCount: number;
  activityCount: number;
  quizCount: number;
  avgScore: number | null;
  lastSeen: string | null;
  isOnline: boolean;
  engagementScore: number; // 0-100 composite
}

interface StudentActivityProps {
  roomId: string;
}

// ────────────────────── helpers ───────────────────────────────────

const ONLINE_THRESHOLD_MS = 90 * 1000; // 90 seconds

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function activityIcon(type: string) {
  switch (type) {
    case "login":  return <LogIn className="h-3.5 w-3.5 text-green-600" />;
    case "logout": return <LogOut className="h-3.5 w-3.5 text-red-500" />;
    default:       return <Activity className="h-3.5 w-3.5 text-blue-500" />;
  }
}

function activityLabel(type: string, lang: string) {
  const labels: Record<string, Record<string, string>> = {
    login:       { en: "Login",    fr: "Connexion",     ar: "دخول" },
    logout:      { en: "Logout",   fr: "Déconnexion",   ar: "خروج" },
    page_view:   { en: "Page view",fr: "Vue de page",   ar: "عرض صفحة" },
    quiz_attempt:{ en: "Quiz",     fr: "Quiz",          ar: "اختبار" },
  };
  return labels[type]?.[lang] ?? type;
}

// ─────────────────────── component ────────────────────────────────

const StudentActivities = ({ roomId }: StudentActivityProps) => {
  const { user } = useAuth();
  const { t, language } = useLanguage();

  // raw data
  const [students, setStudents]               = useState<StudentProfile[]>([]);
  const [activities, setActivities]           = useState<StudentActivity[]>([]);
  const [sessions, setSessions]               = useState<StudentSession[]>([]);
  const [allActiveSessions, setAllActiveSessions] = useState<StudentSession[]>([]);
  const [quizSubmissions, setQuizSubmissions] = useState<QuizSubmission[]>([]);

  // ui state
  const [loading, setLoading]             = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<string>("all");
  const [dateRange, setDateRange]         = useState<string>("7");
  const [searchTerm, setSearchTerm]       = useState("");
  const [sortKey, setSortKey]             = useState<keyof StudentStat>("engagementScore");
  const [sortAsc, setSortAsc]             = useState(false);
  const [refreshing, setRefreshing]       = useState(false);
  const [activeTab, setActiveTab]         = useState("ranking");

  const dateFnsLocale = language === "fr" ? fr : language === "ar" ? ar : enUS;

  // ── initial load + filter changes ──────────────────────────────
  useEffect(() => {
    if (user && roomId) {
      loadAll();
    }
  }, [user, roomId, selectedStudent, dateRange]);

  // ── realtime: sessions table ───────────────────────────────────
  useEffect(() => {
    if (!user || !roomId) return;

    const channel = supabase
      .channel("student-sessions-realtime-v2")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "student_sessions",
        filter: `room_id=eq.${roomId}`,
      }, () => {
        loadSessions();
        loadAllActiveSessions();
      })
      .subscribe();

    // Also realtime on activities for instant feed update
    const actChannel = supabase
      .channel("student-activities-realtime-v2")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "student_activities",
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        const newAct = payload.new as StudentActivity;
        setActivities((prev) => [newAct, ...prev].slice(0, 200));
      })
      .subscribe();

    const interval = setInterval(() => {
      loadSessions();
      loadAllActiveSessions();
    }, 30_000);

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(actChannel);
      clearInterval(interval);
    };
  }, [user, roomId]);

  // ── loaders ────────────────────────────────────────────────────

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([
      loadStudents(),
      loadActivities(),
      loadSessions(),
      loadAllActiveSessions(),
      loadQuizSubmissions(),
    ]);
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
    toast.success(language === "fr" ? "Données actualisées" : language === "ar" ? "تم تحديث البيانات" : "Data refreshed");
  };

  const loadStudents = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, email, username, avatar_url")
      .eq("role", "student")
      .eq("room_id", roomId);
    if (!error) setStudents(data ?? []);
  };

  const loadActivities = async () => {
    const daysAgo = parseInt(dateRange);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    let query = supabase
      .from("student_activities")
      .select("id, student_id, activity_type, activity_data, created_at, session_id")
      .eq("room_id", roomId)
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: false })
      .limit(200);

    if (selectedStudent !== "all") {
      query = query.eq("student_id", selectedStudent);
    }

    const { data, error } = await query;
    if (!error) setActivities(data ?? []);
  };

  const loadSessions = async () => {
    const daysAgo = parseInt(dateRange);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    let query = supabase
      .from("student_sessions")
      .select("id, student_id, session_start, session_end, duration_minutes, is_active, last_activity")
      .eq("room_id", roomId)
      .gte("session_start", startDate.toISOString())
      .order("session_start", { ascending: false })
      .limit(200);

    if (selectedStudent !== "all") {
      query = query.eq("student_id", selectedStudent);
    }

    const { data, error } = await query;
    if (!error) setSessions(data ?? []);
  };

  const loadAllActiveSessions = async () => {
    // clean stale sessions silently
    try { await supabase.rpc("close_stale_sessions"); } catch { /* ignore */ }

    const { data, error } = await supabase
      .from("student_sessions")
      .select("id, student_id, session_start, session_end, duration_minutes, is_active, last_activity")
      .eq("room_id", roomId)
      .eq("is_active", true)
      .order("last_activity", { ascending: false });

    if (!error) setAllActiveSessions(data ?? []);
  };

  const loadQuizSubmissions = async () => {
    // We fetch ALL quiz submissions for students in this room
    const { data: profileIds } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "student")
      .eq("room_id", roomId);

    if (!profileIds || profileIds.length === 0) return;

    const ids = profileIds.map((p) => p.id);
    const { data, error } = await supabase
      .from("quiz_submissions")
      .select("id, student_id, score, total_points, submitted_at")
      .in("student_id", ids)
      .order("submitted_at", { ascending: false });

    if (!error) setQuizSubmissions(data ?? []);
  };

  // ── derived: online students ────────────────────────────────────

  const onlineStudentsMap = useMemo(() => {
    const now = Date.now();
    const threshold = now - ONLINE_THRESHOLD_MS;
    const map = new Map<string, StudentSession>();
    for (const s of allActiveSessions) {
      if (!s.is_active) continue;
      const lastAct = new Date(s.last_activity).getTime();
      if (lastAct < threshold) continue;
      const existing = map.get(s.student_id);
      if (!existing || lastAct > new Date(existing.last_activity).getTime()) {
        map.set(s.student_id, s);
      }
    }
    return map;
  }, [allActiveSessions]);

  // ── derived: per-student stats ──────────────────────────────────

  const studentStats = useMemo<StudentStat[]>(() => {
    return students.map((student) => {
      const stuSessions = sessions.filter((s) => s.student_id === student.id);
      const stuActivities = activities.filter((a) => a.student_id === student.id);
      const stuQuizzes = quizSubmissions.filter((q) => q.student_id === student.id);

      const totalMinutes = stuSessions.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0);
      const sessionCount = stuSessions.length;
      const activityCount = stuActivities.length;
      const quizCount = stuQuizzes.length;

      const avgScore =
        quizCount > 0
          ? stuQuizzes.reduce((sum, q) => {
              const pct = q.total_points > 0 ? (q.score / q.total_points) * 100 : 0;
              return sum + pct;
            }, 0) / quizCount
          : null;

      // last seen: max of session last_activity or activity created_at
      const sessionTimes = stuSessions.map((s) => new Date(s.last_activity).getTime());
      const actTimes = stuActivities.map((a) => new Date(a.created_at).getTime());
      const allTimes = [...sessionTimes, ...actTimes].filter(Boolean);
      const lastSeen = allTimes.length > 0 ? new Date(Math.max(...allTimes)).toISOString() : null;

      const isOnline = onlineStudentsMap.has(student.id);

      // Engagement score: weighted composite (0-100)
      // 40% time, 30% activity count, 20% quiz, 10% recency
      const maxMinutes = 480; // 8h cap
      const timeScore    = Math.min(totalMinutes / maxMinutes, 1) * 40;
      const actScore     = Math.min(activityCount / 50, 1) * 30;
      const quizScore    = quizCount > 0 ? Math.min(quizCount / 10, 1) * 20 : 0;
      const recencyScore = lastSeen && isToday(new Date(lastSeen)) ? 10 : 0;
      const engagementScore = Math.round(timeScore + actScore + quizScore + recencyScore);

      return {
        student,
        totalMinutes,
        sessionCount,
        activityCount,
        quizCount,
        avgScore,
        lastSeen,
        isOnline,
        engagementScore,
      };
    });
  }, [students, sessions, activities, quizSubmissions, onlineStudentsMap]);

  // ── derived: sorted + filtered student stats ────────────────────

  const sortedStats = useMemo(() => {
    const filtered = studentStats.filter((s) => {
      const q = searchTerm.toLowerCase();
      return (
        s.student.name.toLowerCase().includes(q) ||
        s.student.username.toLowerCase().includes(q) ||
        s.student.email.toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;
      const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
      return sortAsc ? cmp : -cmp;
    });
  }, [studentStats, searchTerm, sortKey, sortAsc]);

  // ── derived: filtered activity feed ────────────────────────────

  const filteredActivities = useMemo(() => {
    const studentsMap = new Map(students.map((s) => [s.id, s]));
    return activities.filter((a) => {
      if (searchTerm) {
        const student = studentsMap.get(a.student_id);
        const name = student?.name?.toLowerCase() ?? "";
        const type = a.activity_type.toLowerCase();
        const q = searchTerm.toLowerCase();
        if (!name.includes(q) && !type.includes(q)) return false;
      }
      return true;
    });
  }, [activities, students, searchTerm]);

  // ── derived: filtered sessions ─────────────────────────────────

  const filteredSessions = useMemo(() => {
    const studentsMap = new Map(students.map((s) => [s.id, s]));
    return sessions.filter((s) => {
      if (searchTerm) {
        const student = studentsMap.get(s.student_id);
        const name = student?.name?.toLowerCase() ?? "";
        if (!name.includes(searchTerm.toLowerCase())) return false;
      }
      return true;
    });
  }, [sessions, students, searchTerm]);

  // ── aggregate stat cards ────────────────────────────────────────

  const totalStudyTime = useMemo(
    () => sessions.reduce((sum, s) => sum + (s.duration_minutes ?? 0), 0),
    [sessions]
  );

  const activitiesToday = useMemo(
    () => activities.filter((a) => isToday(new Date(a.created_at))).length,
    [activities]
  );

  // ── export ─────────────────────────────────────────────────────

  const exportActivities = async () => {
    try {
      const studentsMap = new Map(students.map((s) => [s.id, s]));
      const { data, error } = await supabase
        .from("student_activities")
        .select("created_at, activity_type, activity_data, student_id")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false });

      if (error || !data?.length) {
        toast.error(language === "fr" ? "Aucune activité à exporter" : "No activities to export");
        return;
      }

      const rows = [
        ["Date", "Student", "Username", "Email", "Activity", "Details"],
        ...data.map((a) => {
          const s = studentsMap.get(a.student_id);
          return [
            format(new Date(a.created_at), "yyyy-MM-dd HH:mm:ss"),
            s?.name ?? "Unknown",
            s?.username ?? "",
            s?.email ?? "",
            a.activity_type,
            JSON.stringify(a.activity_data ?? {}),
          ];
        }),
      ];

      const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `student-activities-${format(new Date(), "yyyy-MM-dd")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(language === "fr" ? "Exporté avec succès" : "Exported successfully");
    } catch {
      toast.error("Export failed");
    }
  };

  // ── sort handler ────────────────────────────────────────────────

  const handleSort = (key: keyof StudentStat) => {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const SortIcon = ({ col }: { col: keyof StudentStat }) =>
    sortKey === col ? (
      sortAsc ? <ChevronUp className="h-3 w-3 inline ml-1" /> : <ChevronDown className="h-3 w-3 inline ml-1" />
    ) : null;

  const studentsMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  if (user?.role !== "professor") return null;

  // ── JSX ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">{t("activities.student.activities")}</h2>
          <p className="text-muted-foreground">{t("activities.monitor")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            {language === "fr" ? "Actualiser" : language === "ar" ? "تحديث" : "Refresh"}
          </Button>
          <Button onClick={exportActivities} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            {t("activities.export")}
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("activities.total.students")}</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{students.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("activities.online.now")}</CardTitle>
            <Wifi className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{onlineStudentsMap.size}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("activities.total.study.time")}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalStudyTime < 60
                ? `${totalStudyTime}m`
                : `${Math.floor(totalStudyTime / 60)}h${totalStudyTime % 60 > 0 ? `${totalStudyTime % 60}m` : ""}`}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("activities.today")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activitiesToday}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <Label htmlFor="search">{t("activities.search")}</Label>
          <Input
            id="search"
            placeholder={t("activities.search.placeholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="min-w-[160px]">
          <Label htmlFor="student-filter">{t("activities.student.filter")}</Label>
          <Select value={selectedStudent} onValueChange={setSelectedStudent}>
            <SelectTrigger>
              <SelectValue placeholder={t("activities.select.student")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("activities.all.students")}</SelectItem>
              {students.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[140px]">
          <Label htmlFor="date-range">{t("activities.date.range")}</Label>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">{language === "fr" ? "Aujourd'hui" : language === "ar" ? "اليوم" : "Today"}</SelectItem>
              <SelectItem value="7">{t("activities.last.week")}</SelectItem>
              <SelectItem value="30">{t("activities.last.month")}</SelectItem>
              <SelectItem value="90">{t("activities.last.3.months")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="ranking">
            <Trophy className="h-4 w-4 mr-1.5" />
            {language === "fr" ? "Classement" : language === "ar" ? "الترتيب" : "Ranking"}
          </TabsTrigger>
          <TabsTrigger value="activities">
            <Activity className="h-4 w-4 mr-1.5" />
            {t("activities.activities")}
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <Calendar className="h-4 w-4 mr-1.5" />
            {t("activities.sessions")}
          </TabsTrigger>
          <TabsTrigger value="online">
            <Wifi className="h-4 w-4 mr-1.5" />
            {t("activities.online.students")}
            {onlineStudentsMap.size > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-xs bg-green-100 text-green-700">
                {onlineStudentsMap.size}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── RANKING TAB ── */}
        <TabsContent value="ranking" className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">{t("students.loading")}</div>
          ) : sortedStats.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">
                  {language === "fr" ? "Aucun étudiant trouvé" : language === "ar" ? "لا يوجد طلاب" : "No students found"}
                </h3>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart2 className="h-5 w-5" />
                  {language === "fr" ? "Classement des étudiants par engagement" : language === "ar" ? "ترتيب الطلاب حسب المشاركة" : "Student Engagement Ranking"}
                </CardTitle>
                <CardDescription>
                  {language === "fr"
                    ? "Score basé sur le temps d'étude, les activités, les quiz et la récence."
                    : language === "ar"
                    ? "النتيجة مبنية على وقت الدراسة والأنشطة والاختبارات والحداثة"
                    : "Score based on study time, activities, quizzes and recency."}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>
                          {language === "fr" ? "Étudiant" : language === "ar" ? "الطالب" : "Student"}
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none whitespace-nowrap"
                          onClick={() => handleSort("engagementScore")}
                        >
                          {language === "fr" ? "Score" : language === "ar" ? "النتيجة" : "Score"}
                          <SortIcon col="engagementScore" />
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none whitespace-nowrap"
                          onClick={() => handleSort("totalMinutes")}
                        >
                          {language === "fr" ? "Temps" : language === "ar" ? "الوقت" : "Time"}
                          <SortIcon col="totalMinutes" />
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none whitespace-nowrap"
                          onClick={() => handleSort("sessionCount")}
                        >
                          {t("activities.sessions")}
                          <SortIcon col="sessionCount" />
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none whitespace-nowrap"
                          onClick={() => handleSort("activityCount")}
                        >
                          {t("activities.activities")}
                          <SortIcon col="activityCount" />
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none whitespace-nowrap"
                          onClick={() => handleSort("quizCount")}
                        >
                          {language === "fr" ? "Quiz" : language === "ar" ? "الاختبارات" : "Quizzes"}
                          <SortIcon col="quizCount" />
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none whitespace-nowrap"
                          onClick={() => handleSort("avgScore")}
                        >
                          {language === "fr" ? "Moy. quiz" : language === "ar" ? "متوسط الاختبار" : "Avg quiz"}
                          <SortIcon col="avgScore" />
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none whitespace-nowrap"
                          onClick={() => handleSort("lastSeen")}
                        >
                          {t("activities.last.active")}
                          <SortIcon col="lastSeen" />
                        </TableHead>
                        <TableHead>{language === "fr" ? "Statut" : language === "ar" ? "الحالة" : "Status"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedStats.map((stat, idx) => (
                        <TableRow key={stat.student.id} className="hover:bg-muted/40 transition-colors">
                          <TableCell className="font-bold text-muted-foreground">
                            {idx === 0 && <Trophy className="h-4 w-4 text-yellow-500 inline" />}
                            {idx === 1 && <Star className="h-4 w-4 text-slate-400 inline" />}
                            {idx === 2 && <Star className="h-4 w-4 text-amber-700 inline" />}
                            {idx > 2 && <span className="text-xs">{idx + 1}</span>}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={stat.student.avatar_url} />
                                  <AvatarFallback className="text-xs">{getInitials(stat.student.name)}</AvatarFallback>
                                </Avatar>
                                {stat.isOnline && (
                                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-sm leading-tight">{stat.student.name}</p>
                                <p className="text-xs text-muted-foreground">@{stat.student.username}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{ width: `${stat.engagementScore}%` }}
                                />
                              </div>
                              <span className="text-sm font-semibold">{stat.engagementScore}</span>
                              {stat.engagementScore >= 70 && <Flame className="h-3.5 w-3.5 text-orange-500" />}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {stat.totalMinutes === 0
                              ? "—"
                              : stat.totalMinutes < 60
                              ? `${stat.totalMinutes}m`
                              : `${Math.floor(stat.totalMinutes / 60)}h${stat.totalMinutes % 60 > 0 ? `${stat.totalMinutes % 60}m` : ""}`}
                          </TableCell>
                          <TableCell className="text-sm">{stat.sessionCount}</TableCell>
                          <TableCell className="text-sm">{stat.activityCount}</TableCell>
                          <TableCell className="text-sm">{stat.quizCount}</TableCell>
                          <TableCell className="text-sm">
                            {stat.avgScore != null ? `${Math.round(stat.avgScore)}%` : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {stat.lastSeen
                              ? formatDistanceToNow(new Date(stat.lastSeen), { addSuffix: true, locale: dateFnsLocale })
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {stat.isOnline ? (
                              <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                                <Wifi className="h-3 w-3 mr-1" />
                                {language === "fr" ? "En ligne" : language === "ar" ? "متصل" : "Online"}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                <WifiOff className="h-3 w-3 mr-1" />
                                {language === "fr" ? "Hors ligne" : language === "ar" ? "غير متصل" : "Offline"}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── ACTIVITIES TAB ── */}
        <TabsContent value="activities" className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">{t("students.loading")}</div>
          ) : filteredActivities.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-1">{t("activities.no.activities")}</h3>
                <p className="text-muted-foreground text-sm">{t("activities.tracking.desc")}</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {language === "fr" ? "Journal des activités" : language === "ar" ? "سجل الأنشطة" : "Activity Feed"}
                  <Badge variant="secondary" className="ml-2">{filteredActivities.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y max-h-[520px] overflow-y-auto">
                  {filteredActivities.map((act) => {
                    const student = studentsMap.get(act.student_id);
                    return (
                      <div key={act.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                        <div className="mt-0.5">{activityIcon(act.activity_type)}</div>
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarImage src={student?.avatar_url} />
                          <AvatarFallback className="text-xs">{student ? getInitials(student.name) : "?"}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight">
                            {student?.name ?? (language === "fr" ? "Étudiant inconnu" : "Unknown student")}
                            <span className="font-normal text-muted-foreground ml-1.5">
                              — {activityLabel(act.activity_type, language)}
                            </span>
                          </p>
                          {act.activity_data && Object.keys(act.activity_data).length > 0 && (
                            <p className="text-xs text-muted-foreground truncate">
                              {JSON.stringify(act.activity_data)}
                            </p>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                          {formatDistanceToNow(new Date(act.created_at), { addSuffix: true, locale: dateFnsLocale })}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── SESSIONS TAB ── */}
        <TabsContent value="sessions" className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">{t("students.loading")}</div>
          ) : filteredSessions.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-1">{t("activities.no.sessions")}</h3>
                <p className="text-muted-foreground text-sm">{t("activities.tracking.desc")}</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {language === "fr" ? "Historique des sessions" : language === "ar" ? "سجل الجلسات" : "Session History"}
                  <Badge variant="secondary" className="ml-2">{filteredSessions.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{language === "fr" ? "Étudiant" : language === "ar" ? "الطالب" : "Student"}</TableHead>
                        <TableHead>{t("activities.session.started")}</TableHead>
                        <TableHead>{language === "fr" ? "Fin" : language === "ar" ? "النهاية" : "Ended"}</TableHead>
                        <TableHead>{t("activities.duration")}</TableHead>
                        <TableHead>{language === "fr" ? "Statut" : language === "ar" ? "الحالة" : "Status"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSessions.map((s) => {
                        const student = studentsMap.get(s.student_id);
                        return (
                          <TableRow key={s.id} className="hover:bg-muted/40 transition-colors">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7">
                                  <AvatarImage src={student?.avatar_url} />
                                  <AvatarFallback className="text-xs">{student ? getInitials(student.name) : "?"}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium leading-tight">{student?.name ?? "—"}</p>
                                  <p className="text-xs text-muted-foreground">@{student?.username ?? "—"}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm whitespace-nowrap">
                              {format(new Date(s.session_start), "dd/MM/yyyy HH:mm")}
                            </TableCell>
                            <TableCell className="text-sm whitespace-nowrap">
                              {s.session_end ? format(new Date(s.session_end), "dd/MM/yyyy HH:mm") : "—"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {s.duration_minutes != null
                                ? s.duration_minutes < 60
                                  ? `${s.duration_minutes} ${t("activities.minutes")}`
                                  : `${Math.floor(s.duration_minutes / 60)}h${s.duration_minutes % 60 > 0 ? `${s.duration_minutes % 60}m` : ""}`
                                : "—"}
                            </TableCell>
                            <TableCell>
                              {s.is_active ? (
                                <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                                  {t("activities.active")}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  {t("activities.ended")}
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── ONLINE STUDENTS TAB ── */}
        <TabsContent value="online" className="space-y-4">
          {onlineStudentsMap.size === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <WifiOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-1">{t("activities.online.students")}</h3>
                <p className="text-muted-foreground text-sm">{t("activities.no.online")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from(onlineStudentsMap.values()).map((sess) => {
                const student = studentsMap.get(sess.student_id);
                if (!student) return null;
                return (
                  <Card key={sess.student_id} className="border-green-200 bg-green-50/30 dark:bg-green-900/10">
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-11 w-11">
                            <AvatarImage src={student.avatar_url} />
                            <AvatarFallback>{getInitials(student.name)}</AvatarFallback>
                          </Avatar>
                          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-background animate-pulse" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{student.name}</p>
                          <p className="text-sm text-muted-foreground">@{student.username}</p>
                          <p className="text-xs text-green-600 mt-0.5">
                            {t("activities.active.for")}{" "}
                            {formatDistanceToNow(new Date(sess.last_activity), { addSuffix: true, locale: dateFnsLocale })}
                          </p>
                        </div>
                        <Wifi className="h-5 w-5 text-green-500 shrink-0" />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>
                          <span className="font-medium text-foreground">
                            {language === "fr" ? "Session depuis" : language === "ar" ? "منذ" : "Since"}:
                          </span>{" "}
                          {format(new Date(sess.session_start), "HH:mm")}
                        </div>
                        <div>
                          <span className="font-medium text-foreground">
                            {t("activities.duration")}:
                          </span>{" "}
                          {sess.duration_minutes != null
                            ? `${sess.duration_minutes}m`
                            : `${Math.round((Date.now() - new Date(sess.session_start).getTime()) / 60000)}m`}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentActivities;
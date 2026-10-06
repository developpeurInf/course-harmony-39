import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useCourses } from "@/contexts/CourseContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePreferences, AttemptPolicy } from "@/contexts/PreferencesContext";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatCard } from "@/components/ui/stat-card";
import {
  BookOpen, FileText, Calendar, Users, Building, Award, Clock, CheckCircle2,
  RefreshCw, ArrowRight, GraduationCap, Target, Sparkles, Trophy, Activity, EyeOff, ClipboardList
} from "lucide-react";

interface RecentSubmission {
  id: string;
  exam_id: string;
  exam_title: string;
  student_id: string;
  student_name: string;
  student_avatar?: string | null;
  score: number;
  total_points: number;
  pct: number;
  submitted_at: string;
}

interface DayPoint {
  label: string;
  isToday: boolean;
  activeStudents: number;
  submissions: number;
}

const pctOf = (score: number | null, total: number | null) =>
  total && total > 0 ? Math.max(0, Math.min(100, ((score || 0) / total) * 100)) : 0;

/** Couleurs du badge de note selon le pourcentage */
const scoreTone = (pct: number, pass = 50) =>
  pct >= Math.max(70, pass + 10)
    ? { pill: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30", ring: "#059669" }
    : pct >= pass
    ? { pill: "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/30", ring: "#d97706" }
    : { pill: "bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-rose-500/30", ring: "#e11d48" };

/** Pourcentages retenus par (élève, quiz) selon la règle de tentative choisie dans les paramètres. */
function retainedPcts(
  subs: { student_id: string; exam_id: string; score: number | null; total_points: number | null }[],
  policy: AttemptPolicy
): number[] {
  const groups = new Map<string, number[]>(); // subs triées de la plus récente à la plus ancienne
  subs.filter(s => (s.total_points || 0) > 0).forEach(s => {
    const k = `${s.student_id}|${s.exam_id}`;
    groups.set(k, [...(groups.get(k) || []), pctOf(s.score, s.total_points)]);
  });
  return Array.from(groups.values()).map(list =>
    policy === "best" ? Math.max(...list) : policy === "average" ? list.reduce((a, b) => a + b, 0) / list.length : list[0]
  );
}

const initials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  // Écriture arabe : une seule lettre (les lettres isolées de deux mots se lisent mal)
  if (/[\u0600-\u06FF]/.test(name)) return (words[0] || "").replace(/^ال/, "").charAt(0) || "؟";
  return words.map(n => n[0]).join("").toUpperCase().slice(0, 2);
};

const Dashboard = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const {
    courses, exercises, exams, enrollments, rooms, refreshData,
    getVisibleCoursesForStudent, getVisibleExercisesForStudent, getVisibleExamsForStudent
  } = useCourses();

  const isRtl = language === "ar";
  const { prefs } = usePreferences();
  const passPct = prefs.passThreshold * 5;
  const passLabel = String(prefs.passThreshold).replace(".", language === "en" ? "." : ",");
  const tr = useCallback((fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en), [language]);
  const locale = language === "ar" ? "ar-MA" : language === "fr" ? "fr-FR" : "en-GB";

  const isProfessor = user?.role === "professor";
  const [selectedRoomId, setSelectedRoomId] = useState<string>("all");
  const [loading, setLoading] = useState<boolean>(false);
  const [totalStudents, setTotalStudents] = useState<number>(0);
  const [recentSubmissions, setRecentSubmissions] = useState<RecentSubmission[]>([]);
  const [avgPct, setAvgPct] = useState<number | null>(null);
  const [passRate, setPassRate] = useState<number | null>(null);
  const [submissionsCount, setSubmissionsCount] = useState<number>(0);
  const [week, setWeek] = useState<DayPoint[]>([]);

  /* ───────────── listes filtrées ───────────── */

  const professorRooms = useMemo(() => {
    if (!user) return [];
    if (isProfessor) return rooms.filter(r => r.professor_id === user.id);
    const ids = new Set(enrollments.filter(e => e.student_id === user.id).map(e => e.room_id).filter(Boolean));
    return rooms.filter(r => r.is_visible && ids.has(r.id));
  }, [rooms, user, isProfessor, enrollments]);

  const displayCourses = useMemo(() => {
    if (isProfessor) {
      let list = courses.filter(c => c.professor_id === user?.id || professorRooms.some(r => r.id === c.room_id));
      if (selectedRoomId !== "all") list = list.filter(c => c.room_id === selectedRoomId);
      return list;
    }
    return user?.id ? getVisibleCoursesForStudent(user.id) : [];
  }, [courses, user, isProfessor, professorRooms, selectedRoomId, getVisibleCoursesForStudent]);

  const displayCourseIds = useMemo(() => new Set(displayCourses.map(c => c.id)), [displayCourses]);

  const displayExercises = useMemo(() => {
    if (isProfessor) return exercises.filter(ex => displayCourseIds.has(ex.course_id));
    return user?.id ? getVisibleExercisesForStudent(user.id) : [];
  }, [exercises, displayCourseIds, isProfessor, user, getVisibleExercisesForStudent]);

  const displayExams = useMemo(() => {
    if (isProfessor) return exams.filter(ex => displayCourseIds.has(ex.course_id));
    return user?.id ? getVisibleExamsForStudent(user.id) : [];
  }, [exams, displayCourseIds, isProfessor, user, getVisibleExamsForStudent]);

  const examIdsKey = displayExams.map(e => e.id).sort().join(",");

  const upcomingExercises = useMemo(() => {
    const now = Date.now(), limit = now + 14 * 86400000;
    return displayExercises
      .filter(ex => { const d = new Date(ex.due_date).getTime(); return d >= now && d <= limit; })
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  }, [displayExercises]);

  const upcomingExams = useMemo(() => {
    const now = Date.now(), limit = now + 14 * 86400000;
    return displayExams
      .filter(ex => { const d = new Date(ex.exam_date).getTime(); return d >= now && d <= limit; })
      .sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime());
  }, [displayExams]);

  /* ───────────── indicateurs dynamiques ───────────── */

  const loadDynamicMetrics = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const examTitle = new Map(displayExams.map(e => [e.id, e.title]));

      if (isProfessor) {
        const roomIds = selectedRoomId === "all" ? professorRooms.map(r => r.id) : [selectedRoomId];

        // 1. Élèves (profil rattaché à la classe OU inscription)
        const studentSet = new Set<string>();
        if (roomIds.length > 0) {
          const [{ data: s1 }, { data: s2 }] = await Promise.all([
            supabase.from("profiles").select("id").eq("role", "student").in("room_id", roomIds),
            supabase.from("enrollments").select("student_id").in("room_id", roomIds),
          ]);
          s1?.forEach(s => studentSet.add(s.id));
          s2?.forEach(e => studentSet.add(e.student_id));
        }
        setTotalStudents(studentSet.size);

        // 2. Toutes les copies de quiz (pas seulement les 20 dernières)
        const examIds = displayExams.map(e => e.id);
        let subs: { id: string; exam_id: string; student_id: string; score: number | null; total_points: number | null; submitted_at: string }[] = [];
        if (examIds.length > 0) {
          const { data } = await supabase
            .from("quiz_submissions")
            .select("id, exam_id, student_id, score, total_points, submitted_at")
            .in("exam_id", examIds)
            .eq("is_completed", true)
            .order("submitted_at", { ascending: false });
          subs = data || [];
        }
        setSubmissionsCount(subs.length);

        // Moyenne = moyenne des POURCENTAGES (score / total), une note retenue par élève et par quiz
        const pcts = retainedPcts(subs, prefs.attemptPolicy);
        setAvgPct(pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null);
        setPassRate(pcts.length ? (pcts.filter(p => p >= passPct).length / pcts.length) * 100 : null);

        // 3. Dernières copies avec noms
        const recent = subs.slice(0, 6);
        const ids = Array.from(new Set(recent.map(s => s.student_id)));
        const { data: profiles } = ids.length
          ? await supabase.from("profiles").select("id, name, avatar_url").in("id", ids)
          : { data: [] as any[] };
        const pmap = new Map((profiles || []).map((p: any) => [p.id, p]));
        setRecentSubmissions(recent.map(s => {
          const p: any = pmap.get(s.student_id);
          return {
            id: s.id,
            exam_id: s.exam_id,
            exam_title: examTitle.get(s.exam_id) || "Quiz",
            student_id: s.student_id,
            student_name: p?.name || tr("Élève", "تلميذ", "Student"),
            student_avatar: p?.avatar_url,
            score: s.score || 0,
            total_points: s.total_points || 0,
            pct: pctOf(s.score, s.total_points),
            submitted_at: s.submitted_at,
          };
        }));

        // 4. Activité des 7 derniers jours (2 requêtes au lieu de 14)
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - 6);
        const days: DayPoint[] = [];
        const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        const index = new Map<string, { students: Set<string>; subs: number }>();
        for (let i = 0; i < 7; i++) {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          index.set(dayKey(d), { students: new Set(), subs: 0 });
          days.push({ label: d.toLocaleDateString(locale, { weekday: "short" }), isToday: i === 6, activeStudents: 0, submissions: 0 });
        }
        if (studentSet.size > 0) {
          const { data: acts } = await supabase
            .from("student_activities")
            .select("student_id, created_at")
            .in("student_id", Array.from(studentSet))
            .gte("created_at", start.toISOString());
          acts?.forEach(a => index.get(dayKey(new Date(a.created_at)))?.students.add(a.student_id));
        }
        subs.forEach(s => {
          const d = new Date(s.submitted_at);
          if (d >= start) {
            const slot = index.get(dayKey(d));
            if (slot) slot.subs++;
          }
        });
        Array.from(index.values()).forEach((v, i) => {
          days[i].activeStudents = v.students.size;
          days[i].submissions = v.subs;
        });
        setWeek(days);
      } else {
        // Élève : ses propres résultats
        const { data } = await supabase
          .from("quiz_submissions")
          .select("id, exam_id, student_id, score, total_points, submitted_at")
          .eq("student_id", user.id)
          .eq("is_completed", true)
          .order("submitted_at", { ascending: false });
        const subs = data || [];
        setSubmissionsCount(subs.length);
        const latest = new Map<string, (typeof subs)[number]>();
        subs.forEach(s => { if (!latest.has(s.exam_id)) latest.set(s.exam_id, s); });
        const pcts = retainedPcts(subs, prefs.attemptPolicy);
        setAvgPct(pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null);
        setPassRate(pcts.length ? (pcts.filter(p => p >= passPct).length / pcts.length) * 100 : null);
        setRecentSubmissions(Array.from(latest.values()).slice(0, 6).map(s => ({
          id: s.id,
          exam_id: s.exam_id,
          exam_title: examTitle.get(s.exam_id) || exams.find(e => e.id === s.exam_id)?.title || "Quiz",
          student_id: s.student_id,
          student_name: user.name || "",
          score: s.score || 0,
          total_points: s.total_points || 0,
          pct: pctOf(s.score, s.total_points),
          submitted_at: s.submitted_at,
        })));
      }
    } catch (err) {
      console.error("Failed to load dashboard dynamic metrics:", err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isProfessor, selectedRoomId, examIdsKey, professorRooms.length, locale, prefs.attemptPolicy, passPct]);

  useEffect(() => {
    loadDynamicMetrics();
  }, [loadDynamicMetrics]);

  const handleRefresh = () => {
    refreshData();
    loadDynamicMetrics();
  };

  /* ───────────── helpers d'affichage ───────────── */

  const fmtNote20 = (pct: number | null) => {
    if (pct === null) return "—";
    const v = (Math.round((pct / 5) * 10) / 10).toFixed(1);
    return language === "en" ? v : v.replace(".", ",");
  };

  const relative = (iso: string) => {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 60) return rtf.format(-Math.max(0, m), "minute");
    const h = Math.round(m / 60);
    if (h < 24) return rtf.format(-h, "hour");
    return rtf.format(-Math.round(h / 24), "day");
  };

  const until = (iso: string) => {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    const ms = new Date(iso).getTime() - Date.now();
    const h = Math.round(ms / 3600000);
    if (h < 24) return rtf.format(Math.max(0, h), "hour");
    return rtf.format(Math.round(h / 24), "day");
  };

  const today = new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const trackingLink = selectedRoomId !== "all"
    ? `/rooms/${selectedRoomId}/students-activities`
    : professorRooms[0] ? `/rooms/${professorRooms[0].id}/students-activities` : "/reports";

  const DateTile = ({ iso, tone }: { iso: string; tone: "indigo" | "emerald" }) => {
    const d = new Date(iso);
    const c = tone === "indigo" ? "from-indigo-500 to-violet-500" : "from-emerald-500 to-teal-500";
    return (
      <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br ${c} text-white shadow-sm`}>
        <span className="text-lg font-extrabold leading-none">{d.getDate()}</span>
        <span className="text-[10px] font-semibold uppercase leading-tight opacity-90">{d.toLocaleDateString(locale, { month: "short" })}</span>
      </div>
    );
  };

  const maxWeek = Math.max(1, ...week.map(d => Math.max(d.activeStudents, d.submissions)));

  /* ═══════════════════════════════ RENDU ═══════════════════════════════ */

  return (
    <div className="space-y-6 animate-fade-in pb-8" dir={isRtl ? "rtl" : "ltr"}>
      {/* ── Bandeau d'accueil ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-indigo-600 to-violet-600 p-6 sm:p-8 text-white shadow-lg">
        <div className="pointer-events-none absolute -top-24 -end-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 start-1/3 h-64 w-64 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70 first-letter:uppercase">{today}</p>
            <h1 className="mt-1.5 text-2xl sm:text-3xl font-extrabold tracking-tight">
              {t("dashboard.welcome")}, {user?.name} 👋
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-white/80">
              {isProfessor
                ? tr("Voici l'essentiel de vos classes : résultats, activité et échéances.", "إليك أهم مستجدات أقسامك: النتائج والنشاط والمواعيد.", "Here is the essentials of your classes: results, activity and deadlines.")
                : tr("Suivez vos cours, vos résultats et vos prochaines échéances.", "تابع دروسك ونتائجك ومواعيدك القادمة.", "Track your courses, results and upcoming deadlines.")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isProfessor && professorRooms.length > 0 && (
              <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
                <SelectTrigger className="h-10 w-[200px] border-white/25 bg-white/10 text-white backdrop-blur hover:bg-white/15 [&>svg]:text-white">
                  <Building className="h-4 w-4 me-2 opacity-80" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr("Toutes les classes", "كل الأقسام", "All classes")}</SelectItem>
                  {professorRooms.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Button onClick={handleRefresh} disabled={loading} className="h-10 gap-2 border border-white/25 bg-white/15 text-white hover:bg-white/25">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{tr("Actualiser", "تحديث", "Refresh")}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Aucune classe ── */}
      {isProfessor && professorRooms.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Building className="h-8 w-8" /></div>
            <CardTitle className="text-xl">{t("dashboard.welcome.platform")}</CardTitle>
            <CardDescription className="mt-2 max-w-md text-base">
              {tr("Commencez par créer une classe pour organiser vos élèves, cours et évaluations.", "ابدأ بإنشاء قسم لتنظيم التلاميذ والدروس والتقويمات.", "Start by creating a class to organise students, courses and assessments.")}
            </CardDescription>
            <Button onClick={() => navigate("/class-management")} size="lg" className="mt-5 gap-2">
              <Building className="h-4 w-4" />
              {tr("Créer ma première classe", "إنشاء قسمي الأول", "Create my first class")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Indicateurs ── */}
      <div className={`grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 ${isProfessor ? "xl:grid-cols-6" : "xl:grid-cols-5"}`}>
        {isProfessor && (
          <StatCard tone="indigo" icon={<Building className="h-5 w-5" />} label={tr("Classes", "الأقسام", "Classes")} value={selectedRoomId === "all" ? professorRooms.length : 1} hint={tr("classes actives", "أقسام نشطة", "active classes")} onClick={() => navigate("/class-management")} />
        )}
        {isProfessor && (
          <StatCard tone="amber" icon={<Users className="h-5 w-5" />} label={tr("Élèves", "التلاميذ", "Students")} value={totalStudents} hint={tr("élèves inscrits", "تلميذ مسجل", "enrolled students")} />
        )}
        <StatCard tone="blue" icon={<BookOpen className="h-5 w-5" />} label={tr("Cours", "الدروس", "Courses")} value={displayCourses.length} hint={isProfessor ? tr("cours publiés", "دروس منشورة", "published courses") : tr("cours suivis", "دروس متابعة", "courses followed")} onClick={() => navigate("/courses")} />
        <StatCard tone="violet" icon={<FileText className="h-5 w-5" />} label={tr("Exercices", "التمارين", "Exercises")} value={displayExercises.length} hint={tr(`${upcomingExercises.length} à rendre sous 14 j`, `${upcomingExercises.length} للتسليم خلال 14 يوماً`, `${upcomingExercises.length} due within 14 days`)} onClick={() => navigate("/exercises")} />
        <StatCard tone="cyan" icon={<ClipboardList className="h-5 w-5" />} label={tr("Évaluations", "التقويمات", "Assessments")} value={displayExams.length} hint={tr(`${submissionsCount} copie(s) rendue(s)`, `${submissionsCount} ورقة مسلَّمة`, `${submissionsCount} submission(s)`)} onClick={() => navigate("/exams")} />
        <StatCard
          tone="emerald"
          icon={<GraduationCap className="h-5 w-5" />}
          label={isProfessor ? tr("Moyenne aux quiz", "معدل الاختبارات", "Quiz average") : tr("Ma moyenne", "معدلي", "My average")}
          value={<span dir="ltr" className="inline-block">{fmtNote20(avgPct)}<span className="text-base font-bold text-muted-foreground"> /20</span></span>}
          hint={passRate === null ? tr("aucune copie pour l'instant", "لا توجد أوراق بعد", "no submissions yet") : tr(`${Math.round(passRate)} % de notes ≥ ${passLabel}/20`, `${Math.round(passRate)}% من النقط ≥ ${passLabel}/20`, `${Math.round(passRate)}% of grades ≥ ${passLabel}/20`)}
          progress={avgPct}
        />
      </div>

      {/* ── Activité & dernières copies ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {isProfessor && (
          <Card className="lg:col-span-3">
            <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />{tr("Activité des 7 derniers jours", "نشاط آخر 7 أيام", "Last 7 days activity")}</CardTitle>
                <CardDescription className="mt-1.5">{tr("Élèves actifs et copies de quiz rendues chaque jour", "التلاميذ النشطون والأوراق المسلمة يومياً", "Active students and quiz submissions per day")}</CardDescription>
              </div>
              <Link to="/reports"><Button variant="ghost" size="sm" className="gap-1 text-xs">{tr("Rapports", "التقارير", "Reports")}<ArrowRight className={`h-3.5 w-3.5 ${isRtl ? "rotate-180" : ""}`} /></Button></Link>
            </CardHeader>
            <CardContent>
              <div className="flex h-[200px] items-end gap-2 sm:gap-4 border-b pb-1">
                {week.map((d, i) => (
                  <div key={i} className="group flex h-full flex-1 flex-col justify-end">
                    <div className="relative flex flex-1 items-end justify-center gap-1">
                      <div className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-popover px-2 py-1 text-[11px] shadow-md ring-1 ring-border opacity-0 transition-opacity group-hover:opacity-100">
                        <b>{d.activeStudents}</b> {tr("actifs", "نشطون", "active")} · <b>{d.submissions}</b> {tr("copies", "أوراق", "subs")}
                      </div>
                      <div className="w-1/2 max-w-[22px] rounded-t-md bg-gradient-to-t from-blue-600 to-blue-400 transition-all duration-700 group-hover:opacity-90" style={{ height: `${(d.activeStudents / maxWeek) * 100}%`, minHeight: d.activeStudents ? 4 : 0 }} />
                      <div className="w-1/2 max-w-[22px] rounded-t-md bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all duration-700 group-hover:opacity-90" style={{ height: `${(d.submissions / maxWeek) * 100}%`, minHeight: d.submissions ? 4 : 0 }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2 sm:gap-4">
                {week.map((d, i) => (
                  <span key={i} className={`flex-1 text-center text-[11px] capitalize ${d.isToday ? "font-bold text-primary" : "text-muted-foreground"}`}>{d.label}</span>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-500" />{tr("Élèves actifs", "تلاميذ نشطون", "Active students")}</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />{tr("Copies de quiz", "أوراق الاختبارات", "Quiz submissions")}</span>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className={isProfessor ? "lg:col-span-2" : "lg:col-span-5"}>
          <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><Award className="h-5 w-5 text-amber-500" />{isProfessor ? tr("Dernières copies de quiz", "آخر أوراق الاختبارات", "Latest quiz submissions") : tr("Mes derniers résultats", "آخر نتائجي", "My latest results")}</CardTitle>
              <CardDescription className="mt-1.5">{tr("Note obtenue sur le total de points du quiz", "النقطة المحصل عليها من مجموع نقط الاختبار", "Score out of the quiz total points")}</CardDescription>
            </div>
            {isProfessor && professorRooms.length > 0 && (
              <Link to={trackingLink}><Button variant="ghost" size="sm" className="gap-1 text-xs">{tr("Suivi", "التتبع", "Tracking")}<ArrowRight className={`h-3.5 w-3.5 ${isRtl ? "rotate-180" : ""}`} /></Button></Link>
            )}
          </CardHeader>
          <CardContent className={isProfessor ? "space-y-2" : "grid gap-2 sm:grid-cols-2 lg:grid-cols-3"}>
            {recentSubmissions.length > 0 ? recentSubmissions.map(sub => {
              const tone = scoreTone(sub.pct, passPct);
              return (
                <div key={sub.id} className="group flex items-center gap-3 rounded-2xl border p-3 transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md">
                  {isProfessor ? (
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={sub.student_avatar || undefined} />
                      <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">{initials(sub.student_name)}</AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600"><Trophy className="h-5 w-5" /></div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{isProfessor ? sub.student_name : sub.exam_title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{isProfessor ? `${sub.exam_title} · ` : ""}{relative(sub.submitted_at)}</p>
                  </div>
                  <div className="shrink-0 text-end">
                    <span dir="ltr" className={`inline-flex items-baseline gap-0.5 rounded-xl px-2.5 py-1 text-sm font-extrabold tabular-nums ring-1 ${tone.pill}`}>
                      {sub.score}<span className="text-[11px] font-semibold opacity-70">/{sub.total_points}</span>
                    </span>
                    <p dir="ltr" className="mt-1 text-[11px] font-medium text-muted-foreground tabular-nums">{Math.round(sub.pct)} % · {fmtNote20(sub.pct)}/20</p>
                  </div>
                </div>
              );
            }) : (
              <div className="col-span-full flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted"><CheckCircle2 className="h-6 w-6 opacity-60" /></div>
                <p className="text-sm">{tr("Aucune copie pour l'instant", "لا توجد أوراق بعد", "No submissions yet")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Échéances ── */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {[
          {
            key: "ex",
            title: t("dashboard.deadlines"),
            desc: t("dashboard.deadlines.desc"),
            icon: <Clock className="h-5 w-5 text-indigo-500" />,
            items: upcomingExercises.slice(0, 5).map(ex => ({ id: ex.id, title: ex.title, course: courses.find(c => c.id === ex.course_id)?.title, date: ex.due_date, badge: null as string | null })),
            empty: t("dashboard.no.deadlines"),
            tone: "indigo" as const,
          },
          {
            key: "exam",
            title: t("dashboard.upcoming.exams"),
            desc: t("dashboard.upcoming.exams.desc"),
            icon: <Calendar className="h-5 w-5 text-emerald-500" />,
            items: upcomingExams.slice(0, 5).map(ex => ({ id: ex.id, title: ex.title, course: courses.find(c => c.id === ex.course_id)?.title, date: ex.exam_date, badge: ex.type === "quiz" ? "Quiz" : tr("Examen", "امتحان", "Exam") })),
            empty: t("dashboard.no.exams"),
            tone: "emerald" as const,
          },
        ].map(block => (
          <Card key={block.key}>
            <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="text-base">{block.title}</CardTitle>
                <CardDescription className="mt-1.5">{block.desc}</CardDescription>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">{block.icon}</span>
            </CardHeader>
            <CardContent>
              {block.items.length > 0 ? (
                <ul className="space-y-2">
                  {block.items.map(it => (
                    <li key={it.id} className="flex items-center gap-3 rounded-2xl border p-2.5 transition-all hover:-translate-y-0.5 hover:shadow-md">
                      <DateTile iso={it.date} tone={block.tone} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                          <span className="truncate">{it.title}</span>
                          {it.badge && <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{it.badge}</span>}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">{it.course}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                        {until(it.date)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center py-8 text-center text-sm text-muted-foreground">
                  <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10"><CheckCircle2 className="h-5 w-5 text-emerald-500" /></div>
                  {block.empty}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Cours ── */}
      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />{t("dashboard.your.courses")}</CardTitle>
            <CardDescription className="mt-1.5">
              {isProfessor ? tr("Vos cours actifs, leurs élèves et leurs évaluations", "دروسك النشطة وتلاميذها وتقويماتها", "Your active courses, students and assessments") : t("dashboard.your.courses.student")}
            </CardDescription>
          </div>
          {isProfessor && (
            <Link to="/courses"><Button variant="outline" size="sm" className="gap-1 text-xs">{tr("Gérer les cours", "إدارة الدروس", "Manage courses")}<ArrowRight className={`h-3.5 w-3.5 ${isRtl ? "rotate-180" : ""}`} /></Button></Link>
          )}
        </CardHeader>
        <CardContent>
          {displayCourses.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {displayCourses.map((course, i) => {
                const nStudents = enrollments.filter(e => e.course_id === course.id).length;
                const nEx = exercises.filter(e => e.course_id === course.id).length;
                const nExams = exams.filter(e => e.course_id === course.id).length;
                const grads = ["from-blue-500 to-indigo-500", "from-violet-500 to-fuchsia-500", "from-emerald-500 to-teal-500", "from-amber-500 to-orange-500", "from-rose-500 to-pink-500", "from-cyan-500 to-sky-500"];
                return (
                  <Card key={course.id} className="card-hover overflow-hidden cursor-pointer" onClick={() => navigate(isProfessor ? "/courses" : `/courses`)}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${grads[i % grads.length]} text-white shadow-sm`}>
                          <BookOpen className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate font-semibold" title={course.title}>{course.title}</p>
                            {!course.is_visible && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                                <EyeOff className="h-3 w-3" />{t("dashboard.hidden")}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 line-clamp-2 min-h-[32px] text-xs text-muted-foreground">
                            {course.description || tr("Aucune description", "لا يوجد وصف", "No description")}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3 text-[11px] font-medium">
                        {isProfessor && <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5"><Users className="h-3 w-3" />{nStudents} {tr("élèves", "تلميذ", "students")}</span>}
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5"><FileText className="h-3 w-3" />{nEx} {tr("exercices", "تمارين", "exercises")}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5"><Target className="h-3 w-3" />{nExams} {tr("évaluations", "تقويمات", "assessments")}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center py-10 text-center text-sm text-muted-foreground">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted"><BookOpen className="h-6 w-6 opacity-60" /></div>
              {user?.role === "student" ? t("dashboard.no.courses.student") : t("dashboard.no.courses.professor")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;

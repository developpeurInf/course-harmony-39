import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Award,
  BarChart3,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  FileQuestion,
  GraduationCap,
  Lightbulb,
  Loader2,
  LogOut,
  Minus,
  RefreshCw,
  School,
  ShieldAlert,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserX,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StudentSearchBar from "@/components/StudentSearchBar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { downloadExcelFile } from "@/lib/download";
import { matchesStudent, studentMassar, type StudentSearchMode } from "@/lib/search";
import {
  computeClassAnalytics,
  formatMinutes,
  pctOf,
  type AAnswer,
  type AQuestion,
  type AQuiz,
  type ASession,
  type ASubmission,
  type AStudent,
  type ClassAnalytics,
  type Level,
  type StudentAnalytics,
} from "@/lib/classAnalytics";

/* ═══════════════════════════════ Types ═══════════════════════════════ */

interface Room { id: string; name: string }
interface Course { id: string; title: string; room_id: string | null }
interface ExamRow {
  id: string; title: string; type: string; course_id: string; is_visible: boolean;
  exam_date: string | null; available_from: string | null; available_until: string | null; created_at: string;
}
interface ExerciseRow { id: string; title: string; course_id: string; due_date: string | null; is_visible: boolean }
interface SubRow extends ASubmission { anti_cheat_events?: number | null; anti_cheat_log?: { type: string; durationMs?: number }[] | null }
interface SessionRow extends ASession { room_id: string | null }

interface RawData {
  rooms: Room[];
  students: (AStudent & { roomId: string | null })[];
  courses: Course[];
  exams: ExamRow[];
  exercises: ExerciseRow[];
  subs: SubRow[];
  questions: AQuestion[];
  answers: AAnswer[];
  sessions: SessionRow[];
}

type Period = "30" | "90" | "180" | "365" | "all";

interface RoomReport {
  room: Room;
  analytics: ClassAnalytics;
  studentsCount: number;
  incidents: number;
  exitsStudents: number;
  coursesCount: number;
  exercisesCount: number;
  quizzesCount: number;
  examsCount: number;
}

const DAY = 86400000;
const LEVEL_COLORS: Record<Exclude<Level, "none">, string> = {
  struggling: "#dc2626",
  progress: "#d97706",
  good: "#2563eb",
  excellent: "#059669",
};

const examDate = (e: ExamRow) => e.available_from || e.exam_date || e.created_at;

/* ═══════════════════════════════ Page ═══════════════════════════════ */

const Reports = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { prefs } = usePreferences();
  const tr = useCallback((fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en), [language]);
  const locale = language === "ar" ? "ar-MA" : language === "fr" ? "fr-FR" : "en-GB";
  const num = (v: number | null | undefined, d = 1) =>
    v === null || v === undefined || isNaN(v) ? "—" : v.toLocaleString(locale, { maximumFractionDigits: d, minimumFractionDigits: 0 });
  const isRtl = language === "ar";

  const opts = useMemo(() => ({
    passThreshold: prefs.passThreshold,
    levelStruggling: prefs.levelStruggling,
    levelGood: prefs.levelGood,
    levelExcellent: prefs.levelExcellent,
    attemptPolicy: prefs.attemptPolicy,
    inactivityDays: prefs.inactivityDays,
  }), [prefs.passThreshold, prefs.levelStruggling, prefs.levelGood, prefs.levelExcellent, prefs.attemptPolicy, prefs.inactivityDays]);

  const [data, setData] = useState<RawData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [roomFilter, setRoomFilter] = useState<string>("all");
  const [period, setPeriod] = useState<Period>("90");
  const [studentQuery, setStudentQuery] = useState("");
  const [studentMode, setStudentMode] = useState<StudentSearchMode>("all");
  const [levelFilter, setLevelFilter] = useState<"all" | "support" | Level>("all");
  const [studentLimit, setStudentLimit] = useState(50);

  /* ───────────── Chargement (requêtes groupées) ───────────── */

  const load = useCallback(async () => {
    if (!user?.id) return;
    const inChunks = async <T,>(ids: string[], fetcher: (chunk: string[]) => Promise<T[]>) => {
      const out: T[] = [];
      for (let i = 0; i < ids.length; i += 150) out.push(...(await fetcher(ids.slice(i, i + 150))));
      return out;
    };
    try {
      const { data: rooms } = await supabase.from("rooms").select("id, name").eq("professor_id", user.id).order("name");
      const roomList = (rooms || []) as Room[];
      const roomIds = roomList.map((r) => r.id);

      const [{ data: courses }, profiles, enrollments, sessions] = await Promise.all([
        supabase.from("courses").select("id, title, room_id").eq("professor_id", user.id),
        roomIds.length ? inChunks(roomIds, async (c) => ((await supabase.from("profiles").select("id, name, email, username, avatar_url, room_id").eq("role", "student").in("room_id", c)).data || []) as any[]) : Promise.resolve([] as any[]),
        roomIds.length ? inChunks(roomIds, async (c) => ((await supabase.from("enrollments").select("student_id, room_id").in("room_id", c)).data || []) as any[]) : Promise.resolve([] as any[]),
        roomIds.length ? inChunks(roomIds, async (c) => ((await supabase.from("student_sessions").select("student_id, session_start, last_activity, duration_minutes, is_active, room_id").in("room_id", c).order("session_start", { ascending: false }).limit(10000)).data || []) as any[]) : Promise.resolve([] as any[]),
      ]);

      // Élèves : room_id du profil, sinon classe d'inscription
      const studentMap = new Map<string, AStudent & { roomId: string | null }>();
      profiles.forEach((p: any) => studentMap.set(p.id, { id: p.id, name: p.name, email: p.email, username: p.username, avatar_url: p.avatar_url, roomId: p.room_id }));
      const missing = Array.from(new Set(enrollments.map((e: any) => e.student_id))).filter((id) => !studentMap.has(id as string)) as string[];
      if (missing.length) {
        const extra = await inChunks(missing, async (c) => ((await supabase.from("profiles").select("id, name, email, username, avatar_url, role").in("id", c)).data || []) as any[]);
        extra.filter((p: any) => p.role === "student").forEach((p: any) => {
          const enr = enrollments.find((e: any) => e.student_id === p.id);
          studentMap.set(p.id, { id: p.id, name: p.name, email: p.email, username: p.username, avatar_url: p.avatar_url, roomId: enr?.room_id || null });
        });
      }

      const courseList = (courses || []) as Course[];
      const courseIds = courseList.map((c) => c.id);
      const [exams, exercises] = await Promise.all([
        courseIds.length ? inChunks(courseIds, async (c) => ((await supabase.from("exams").select("id, title, type, course_id, is_visible, exam_date, available_from, available_until, created_at").in("course_id", c)).data || []) as any[]) : Promise.resolve([] as any[]),
        courseIds.length ? inChunks(courseIds, async (c) => ((await supabase.from("exercises").select("id, title, course_id, due_date, is_visible").in("course_id", c)).data || []) as any[]) : Promise.resolve([] as any[]),
      ]);
      const quizIds = (exams as ExamRow[]).filter((e) => e.type === "quiz").map((e) => e.id);
      const [subs, questions] = await Promise.all([
        quizIds.length ? inChunks(quizIds, async (c) => ((await supabase.from("quiz_submissions").select("*").in("exam_id", c).eq("is_completed", true)).data || []) as any[]) : Promise.resolve([] as any[]),
        quizIds.length ? inChunks(quizIds, async (c) => ((await supabase.from("quiz_questions").select("id, exam_id, question, question_order, points, question_type").in("exam_id", c)).data || []) as any[]) : Promise.resolve([] as any[]),
      ]);
      const answers = subs.length
        ? await inChunks(subs.map((s: any) => s.id), async (c) => ((await supabase.from("quiz_answers").select("submission_id, question_id, is_correct").in("submission_id", c)).data || []) as any[])
        : [];

      setData({
        rooms: roomList,
        students: Array.from(studentMap.values()).sort((a, b) => (a.name || "").localeCompare(b.name || "")),
        courses: courseList,
        exams: exams as ExamRow[],
        exercises: exercises as ExerciseRow[],
        subs: subs as SubRow[],
        questions: questions as AQuestion[],
        answers: answers as AAnswer[],
        sessions: sessions as SessionRow[],
      });
    } catch (e) {
      console.error("Reports load error:", e);
      toast.error(tr("Impossible de charger les statistiques.", "تعذر تحميل الإحصائيات.", "Unable to load statistics."));
    }
  }, [user?.id, tr]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  /* ───────────── Analyses ───────────── */

  const since = period === "all" ? 0 : Date.now() - parseInt(period, 10) * DAY;
  const periodMs = period === "all" ? 0 : parseInt(period, 10) * DAY;

  const courseRoom = useMemo(() => new Map((data?.courses || []).map((c) => [c.id, c.room_id])), [data]);
  const roomName = useCallback((id: string | null | undefined) => data?.rooms.find((r) => r.id === id)?.name || "—", [data]);

  const visibleRooms = useMemo(
    () => (data ? (roomFilter === "all" ? data.rooms : data.rooms.filter((r) => r.id === roomFilter)) : []),
    [data, roomFilter]
  );

  const roomReports = useMemo<RoomReport[]>(() => {
    if (!data) return [];
    return visibleRooms.map((room) => {
      const students = data.students.filter((s) => s.roomId === room.id);
      const roomCourses = data.courses.filter((c) => c.room_id === room.id).map((c) => c.id);
      const roomExams = data.exams.filter((e) => roomCourses.includes(e.course_id));
      const allQuizzes: AQuiz[] = roomExams.filter((e) => e.type === "quiz").map((e) => ({ id: e.id, title: e.title, date: examDate(e), course_id: e.course_id }));
      const quizIds = new Set(allQuizzes.map((q) => q.id));
      const subsP = data.subs.filter((s) => quizIds.has(s.exam_id) && new Date(s.submitted_at).getTime() >= since);
      const withSubs = new Set(subsP.map((s) => s.exam_id));
      const quizzesP = period === "all" ? allQuizzes : allQuizzes.filter((q) => withSubs.has(q.id) || (new Date(q.date).getTime() >= since && new Date(q.date).getTime() <= Date.now()));
      const sessP = data.sessions.filter((s) => s.room_id === room.id && new Date(s.session_start).getTime() >= since);
      const analytics = computeClassAnalytics({
        students, quizzes: quizzesP, submissions: subsP, questions: data.questions, answers: data.answers, sessions: sessP, options: opts,
      });
      const studentIds = new Set(students.map((s) => s.id));
      const subsInRoom = subsP.filter((s) => studentIds.has(s.student_id));
      const incidents = subsInRoom.reduce((n, s) => n + (s.anti_cheat_events || 0), 0);
      const exitsStudents = new Set(subsInRoom.filter((s) => (s.anti_cheat_log || []).some((e) => e.type === "left_quiz")).map((s) => s.student_id)).size;
      return {
        room,
        analytics,
        studentsCount: students.length,
        incidents,
        exitsStudents,
        coursesCount: roomCourses.length,
        exercisesCount: data.exercises.filter((e) => roomCourses.includes(e.course_id)).length,
        quizzesCount: roomExams.filter((e) => e.type === "quiz").length,
        examsCount: roomExams.filter((e) => e.type !== "quiz").length,
      };
    });
  }, [data, visibleRooms, since, period, opts]);

  const allStudents = useMemo(
    () => roomReports.flatMap((r) => r.analytics.students.map((s) => ({ ...s, roomId: r.room.id, roomName: r.room.name }))),
    [roomReports]
  );

  const kpis = useMemo(() => {
    const evaluated = allStudents.filter((s) => s.note20 !== null);
    const avg20 = evaluated.length ? evaluated.reduce((a, s) => a + (s.note20 as number), 0) / evaluated.length : null;
    const pass = evaluated.length ? (evaluated.filter((s) => (s.note20 as number) >= opts.passThreshold).length / evaluated.length) * 100 : null;
    const totalSlots = roomReports.reduce((a, r) => a + r.studentsCount * r.analytics.quizzes.length, 0);
    const taken = allStudents.reduce((a, s) => a + s.quizzesTaken, 0);
    const participation = totalSlots ? (taken / totalSlots) * 100 : null;
    const study = allStudents.length ? allStudents.reduce((a, s) => a + s.studyMinutes, 0) / allStudents.length : 0;
    const active = allStudents.filter((s) => s.lastSeen && Date.now() - new Date(s.lastSeen).getTime() <= opts.inactivityDays * DAY).length;
    const toSupport = allStudents.filter((s) => s.alerts.length > 0).length;
    const incidents = roomReports.reduce((a, r) => a + r.incidents, 0);

    // Moyenne de la période précédente (même durée) pour la tendance
    let prevAvg: number | null = null;
    if (data && periodMs) {
      const visibleIds = new Set(allStudents.map((s) => s.student.id));
      const prev = data.subs.filter((s) => {
        const t = new Date(s.submitted_at).getTime();
        return visibleIds.has(s.student_id) && t < since && t >= since - periodMs;
      });
      if (prev.length) prevAvg = prev.reduce((a, s) => a + pctOf(s), 0) / prev.length / 5;
    }
    const visible = new Set(allStudents.map((st) => st.student.id));
    const curSubs = data ? data.subs.filter((s) => new Date(s.submitted_at).getTime() >= since && visible.has(s.student_id)) : [];
    const curAvg = curSubs.length ? curSubs.reduce((a, s) => a + pctOf(s), 0) / curSubs.length / 5 : null;

    return {
      students: allStudents.length, evaluated: evaluated.length, avg20, pass, participation, study, active, toSupport, incidents,
      delta: prevAvg !== null && curAvg !== null ? curAvg - prevAvg : null, submissions: curSubs.length,
    };
  }, [allStudents, roomReports, opts, data, since, periodMs]);

  // Évolution hebdomadaire (moyenne /20 et nombre de copies)
  const weekly = useMemo(() => {
    if (!data) return [];
    const ids = new Set(allStudents.map((s) => s.student.id));
    const subs = data.subs.filter((s) => ids.has(s.student_id) && new Date(s.submitted_at).getTime() >= since);
    const weekStart = (d: Date) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
      return x.getTime();
    };
    const map = new Map<number, number[]>();
    subs.forEach((s) => {
      const k = weekStart(new Date(s.submitted_at));
      map.set(k, [...(map.get(k) || []), pctOf(s)]);
    });
    const keys = Array.from(map.keys()).sort((a, b) => a - b).slice(-20);
    return keys.map((k) => {
      const v = map.get(k) as number[];
      return {
        label: new Date(k).toLocaleDateString(locale, { day: "2-digit", month: "short" }),
        moyenne: Math.round((v.reduce((a, b) => a + b, 0) / v.length / 5) * 10) / 10,
        copies: v.length,
      };
    });
  }, [data, allStudents, since, locale]);

  // Questions les moins réussies (toutes classes)
  const hardestQuestions = useMemo(() => {
    const rows: { text: string; quiz: string; room: string; rate: number; answered: number }[] = [];
    roomReports.forEach((r) =>
      r.analytics.quizzes.forEach((q) =>
        q.questions.forEach((qs) => {
          if (qs.successRate === null || qs.answered < 3) return;
          const div = document.createElement("div");
          div.innerHTML = (qs.question.question || "").replace(/<!--[\s\S]*?-->/g, "");
          rows.push({ text: (div.textContent || "").replace(/\s+/g, " ").trim() || "—", quiz: q.quiz.title, room: r.room.name, rate: qs.successRate, answered: qs.answered });
        })
      )
    );
    return rows.sort((a, b) => a.rate - b.rate).slice(0, 10);
  }, [roomReports]);

  const quizRows = useMemo(
    () => roomReports.flatMap((r) => r.analytics.quizzes.map((q) => ({ ...q, roomName: r.room.name })))
      .sort((a, b) => new Date(b.quiz.date).getTime() - new Date(a.quiz.date).getTime()),
    [roomReports]
  );

  // Engagement : jours et heures de travail (sessions)
  const engagement = useMemo(() => {
    const days = Array.from({ length: 7 }, () => 0);
    const hours = Array.from({ length: 24 }, () => 0);
    if (!data) return { days, hours, total: 0 };
    const ids = new Set(allStudents.map((s) => s.student.id));
    let total = 0;
    data.sessions.forEach((s) => {
      const t = new Date(s.session_start);
      if (!ids.has(s.student_id) || t.getTime() < since) return;
      const m = Math.max(1, s.duration_minutes || 1);
      days[(t.getDay() + 6) % 7] += m;
      hours[t.getHours()] += m;
      total += m;
    });
    return { days, hours, total };
  }, [data, allStudents, since]);

  // Échéances des 14 prochains jours
  const upcoming = useMemo(() => {
    if (!data) return [];
    const now = Date.now();
    const roomIds = new Set(visibleRooms.map((r) => r.id));
    const items: { title: string; kind: "quiz" | "exam" | "exercise"; date: string; room: string }[] = [];
    data.exams.forEach((e) => {
      const room = courseRoom.get(e.course_id);
      if (!room || !roomIds.has(room)) return;
      const d = new Date(examDate(e)).getTime();
      if (d >= now && d <= now + 14 * DAY) items.push({ title: e.title, kind: e.type === "quiz" ? "quiz" : "exam", date: examDate(e), room: roomName(room) });
    });
    data.exercises.forEach((e) => {
      const room = courseRoom.get(e.course_id);
      if (!room || !roomIds.has(room) || !e.due_date) return;
      const d = new Date(e.due_date).getTime();
      if (d >= now && d <= now + 14 * DAY) items.push({ title: e.title, kind: "exercise", date: e.due_date, room: roomName(room) });
    });
    return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data, visibleRooms, courseRoom, roomName]);

  // Constats automatiques
  const insights = useMemo(() => {
    const out: { tone: "good" | "warn" | "bad" | "info"; icon: any; text: string }[] = [];
    const ranked = roomReports.filter((r) => r.analytics.classNote20 !== null).sort((a, b) => (b.analytics.classNote20 as number) - (a.analytics.classNote20 as number));
    if (ranked.length >= 2) {
      const best = ranked[0];
      const worst = ranked[ranked.length - 1];
      out.push({ tone: "good", icon: Trophy, text: tr(
        `${best.room.name} a la meilleure moyenne : ${num(best.analytics.classNote20)}/20.`,
        `${best.room.name} صاحب أعلى معدل: ${num(best.analytics.classNote20)}/20.`,
        `${best.room.name} has the best average: ${num(best.analytics.classNote20)}/20.`) });
      if ((best.analytics.classNote20 as number) - (worst.analytics.classNote20 as number) >= 2) {
        out.push({ tone: "warn", icon: TrendingDown, text: tr(
          `${worst.room.name} est en retrait (${num(worst.analytics.classNote20)}/20, soit ${num((best.analytics.classNote20 as number) - (worst.analytics.classNote20 as number))} pt de moins que ${best.room.name}).`,
          `${worst.room.name} متأخر (${num(worst.analytics.classNote20)}/20، أي أقل بـ ${num((best.analytics.classNote20 as number) - (worst.analytics.classNote20 as number))} نقطة من ${best.room.name}).`,
          `${worst.room.name} is behind (${num(worst.analytics.classNote20)}/20, ${num((best.analytics.classNote20 as number) - (worst.analytics.classNote20 as number))} pts below ${best.room.name}).`) });
      }
    }
    if (kpis.delta !== null && Math.abs(kpis.delta) >= 0.5) {
      out.push({ tone: kpis.delta > 0 ? "good" : "bad", icon: kpis.delta > 0 ? TrendingUp : TrendingDown, text: tr(
        `La moyenne des copies ${kpis.delta > 0 ? "progresse" : "recule"} de ${num(Math.abs(kpis.delta))} pt par rapport à la période précédente.`,
        `معدل الأوراق ${kpis.delta > 0 ? "تحسن" : "تراجع"} بـ ${num(Math.abs(kpis.delta))} نقطة مقارنة بالفترة السابقة.`,
        `The average ${kpis.delta > 0 ? "rose" : "fell"} by ${num(Math.abs(kpis.delta))} pts compared with the previous period.`) });
    }
    if (hardestQuestions[0]) {
      const h = hardestQuestions[0];
      out.push({ tone: "bad", icon: FileQuestion, text: tr(
        `Notion la moins maîtrisée : « ${h.text.slice(0, 80)}${h.text.length > 80 ? "…" : ""} » (${Math.round(h.rate)} % de réussite, ${h.quiz}).`,
        `أضعف مفهوم: « ${h.text.slice(0, 80)}${h.text.length > 80 ? "…" : ""} » (${Math.round(h.rate)}٪ نجاح، ${h.quiz}).`,
        `Least mastered: “${h.text.slice(0, 80)}${h.text.length > 80 ? "…" : ""}” (${Math.round(h.rate)}% success, ${h.quiz}).`) });
    }
    const declining = allStudents.filter((s) => s.alerts.includes("declining")).length;
    if (declining) out.push({ tone: "warn", icon: ArrowDownRight, text: tr(
      `${declining} élève(s) en baisse marquée (≥ 2 pt sur 20) : à revoir en priorité.`,
      `${declining} تلميذ(ة) في تراجع واضح (≥ 2 نقط): أولوية للمتابعة.`,
      `${declining} student(s) with a sharp drop (≥ 2 pts): follow up first.`) });
    const inactive = allStudents.filter((s) => s.alerts.includes("inactive") || s.alerts.includes("never_connected")).length;
    if (inactive) out.push({ tone: "warn", icon: UserX, text: tr(
      `${inactive} élève(s) sans activité depuis plus de ${opts.inactivityDays} jours (ou jamais connectés).`,
      `${inactive} تلميذ(ة) بدون نشاط منذ أكثر من ${opts.inactivityDays} أيام (أو لم يتصلوا أبداً).`,
      `${inactive} student(s) inactive for over ${opts.inactivityDays} days (or never connected).`) });
    const lowPart = quizRows.filter((q) => q.participation < 50 && new Date(q.quiz.date).getTime() < Date.now() - 2 * DAY);
    if (lowPart.length) out.push({ tone: "warn", icon: Users, text: tr(
      `${lowPart.length} quiz avec moins de la moitié de la classe (ex. : ${lowPart[0].quiz.title}, ${lowPart[0].roomName}).`,
      `${lowPart.length} اختبار بمشاركة أقل من نصف القسم (مثال: ${lowPart[0].quiz.title}، ${lowPart[0].roomName}).`,
      `${lowPart.length} quiz(zes) taken by less than half the class (e.g. ${lowPart[0].quiz.title}, ${lowPart[0].roomName}).`) });
    const exitsStudents = roomReports.reduce((a, r) => a + r.exitsStudents, 0);
    if (exitsStudents) out.push({ tone: "info", icon: ShieldAlert, text: tr(
      `${exitsStudents} élève(s) ont quitté la page pendant un quiz (détail dans les résultats de chaque quiz).`,
      `${exitsStudents} تلميذ(ة) غادروا الصفحة أثناء اختبار (التفاصيل في نتائج كل اختبار).`,
      `${exitsStudents} student(s) left the page during a quiz (details in each quiz's results).`) });
    if (upcoming.length) out.push({ tone: "info", icon: CalendarClock, text: tr(
      `${upcoming.length} échéance(s) dans les 14 prochains jours (prochaine : ${upcoming[0].title}).`,
      `${upcoming.length} موعد(ا) خلال 14 يوماً القادمة (الأقرب: ${upcoming[0].title}).`,
      `${upcoming.length} deadline(s) in the next 14 days (next: ${upcoming[0].title}).`) });
    if (!out.length) out.push({ tone: "info", icon: Lightbulb, text: tr(
      "Pas encore assez de données sur la période : publiez des quiz pour obtenir des constats.",
      "لا توجد بيانات كافية في هذه الفترة: انشر اختبارات للحصول على ملاحظات.",
      "Not enough data for this period yet: publish quizzes to get insights.") });
    return out;
  }, [roomReports, kpis.delta, hardestQuestions, allStudents, quizRows, upcoming, opts.inactivityDays, tr]);

  const filteredStudents = useMemo(() => {
    return allStudents
      .filter((s) => matchesStudent(s.student, studentQuery, studentMode))
      .filter((s) => levelFilter === "all" ? true : levelFilter === "support" ? s.alerts.length > 0 : s.level === levelFilter)
      .sort((a, b) => (b.note20 ?? -1) - (a.note20 ?? -1));
  }, [allStudents, studentQuery, studentMode, levelFilter]);

  /* ───────────── Libellés ───────────── */

  const levelLabel = (l: Level) => ({
    excellent: tr("Excellent", "متميز", "Excellent"),
    good: tr("Bon", "جيد", "Good"),
    progress: tr("En progrès", "في تقدم", "Progressing"),
    struggling: tr("En difficulté", "متعثر", "Struggling"),
    none: tr("Non évalué", "غير مقيم", "Not assessed"),
  }[l]);
  const alertLabel = (a: string) => ({
    low_average: tr("Moyenne faible", "معدل ضعيف", "Low average"),
    low_participation: tr("Peu de quiz", "مشاركة ضعيفة", "Low participation"),
    declining: tr("En baisse", "في تراجع", "Declining"),
    inactive: tr("Inactif", "غير نشيط", "Inactive"),
    never_connected: tr("Jamais connecté", "لم يتصل أبداً", "Never connected"),
    no_quiz: tr("Aucun quiz", "بدون اختبار", "No quiz"),
  } as Record<string, string>)[a] || a;
  const tone = (n: number | null) =>
    n === null ? "text-muted-foreground" : n >= opts.levelGood ? "text-emerald-600 dark:text-emerald-400" : n >= opts.passThreshold ? "text-sky-600 dark:text-sky-400" : "text-rose-600 dark:text-rose-400";
  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" }) : "—");
  const relDays = (iso: string | null) => {
    if (!iso) return tr("Jamais", "أبداً", "Never");
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
    return d <= 0 ? tr("Aujourd'hui", "اليوم", "Today") : d === 1 ? tr("Hier", "أمس", "Yesterday") : tr(`Il y a ${d} j`, `منذ ${d} يوم`, `${d} d ago`);
  };
  const dayNames = [tr("Lun", "الإثنين", "Mon"), tr("Mar", "الثلاثاء", "Tue"), tr("Mer", "الأربعاء", "Wed"), tr("Jeu", "الخميس", "Thu"), tr("Ven", "الجمعة", "Fri"), tr("Sam", "السبت", "Sat"), tr("Dim", "الأحد", "Sun")];

  /* ───────────── Export Excel ───────────── */

  const exportExcel = async () => {
    try {
      const wb = XLSX.utils.book_new();
      const classes = roomReports.map((r) => ({
        [tr("Classe", "القسم", "Class")]: r.room.name,
        [tr("Élèves", "التلاميذ", "Students")]: r.studentsCount,
        [tr("Évalués", "المقيمون", "Assessed")]: r.analytics.evaluatedCount,
        [tr("Moyenne /20", "المعدل /20", "Average /20")]: r.analytics.classNote20 === null ? "" : Math.round(r.analytics.classNote20 * 100) / 100,
        [tr("Réussite %", "النجاح %", "Pass %")]: r.analytics.successRate === null ? "" : Math.round(r.analytics.successRate),
        [tr("Participation %", "المشاركة %", "Participation %")]: Math.round(r.analytics.participationRate),
        [tr("Temps d'étude moyen (min)", "متوسط وقت المراجعة (د)", "Avg study (min)")]: Math.round(r.analytics.avgStudyMinutes),
        [tr("À accompagner", "للمواكبة", "To support")]: r.analytics.toSupport.length,
        [tr("Incidents quiz", "مخالفات الاختبارات", "Quiz incidents")]: r.incidents,
        [tr("Cours", "الدروس", "Courses")]: r.coursesCount,
        [tr("Exercices", "التمارين", "Exercises")]: r.exercisesCount,
        [tr("Quiz", "الاختبارات", "Quizzes")]: r.quizzesCount,
        [tr("Examens", "الامتحانات", "Exams")]: r.examsCount,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(classes), tr("Classes", "الأقسام", "Classes"));
      const studs = allStudents.map((s) => ({
        [tr("Classe", "القسم", "Class")]: s.roomName,
        [tr("Rang", "الرتبة", "Rank")]: s.rank ?? "",
        [tr("Élève", "التلميذ", "Student")]: s.student.name,
        Massar: studentMassar(s.student),
        [tr("Moyenne /20", "المعدل /20", "Average /20")]: s.note20 === null ? "" : Math.round(s.note20 * 100) / 100,
        [tr("Niveau", "المستوى", "Level")]: levelLabel(s.level),
        [tr("Quiz passés", "الاختبارات المنجزة", "Quizzes taken")]: s.quizzesTaken,
        [tr("Participation %", "المشاركة %", "Participation %")]: Math.round(s.participation),
        [tr("Évolution (pts %)", "التطور", "Trend (pts)")]: s.trendDelta === null ? "" : Math.round(s.trendDelta),
        [tr("Temps d'étude (min)", "وقت المراجعة (د)", "Study (min)")]: Math.round(s.studyMinutes),
        [tr("Dernière activité", "آخر نشاط", "Last activity")]: s.lastSeen ? fmtDate(s.lastSeen) : "",
        [tr("Alertes", "تنبيهات", "Alerts")]: s.alerts.map(alertLabel).join(" / "),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(studs), tr("Élèves", "التلاميذ", "Students"));
      const quizzes = quizRows.map((q) => ({
        Quiz: q.quiz.title,
        [tr("Classe", "القسم", "Class")]: q.roomName,
        Date: fmtDate(q.quiz.date),
        [tr("Participants", "المشاركون", "Participants")]: q.participants,
        [tr("Participation %", "المشاركة %", "Participation %")]: Math.round(q.participation),
        [tr("Moyenne /20", "المعدل /20", "Average /20")]: q.mean === null ? "" : Math.round((q.mean / 5) * 100) / 100,
        [tr("Réussite %", "النجاح %", "Pass %")]: q.successRate === null ? "" : Math.round(q.successRate),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(quizzes), "Quiz");
      const qs = hardestQuestions.map((h) => ({
        Question: h.text, Quiz: h.quiz, [tr("Classe", "القسم", "Class")]: h.room,
        [tr("Réussite %", "النجاح %", "Success %")]: Math.round(h.rate), [tr("Réponses", "الإجابات", "Answers")]: h.answered,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(qs), tr("Questions difficiles", "أسئلة صعبة", "Hard questions"));
      await downloadExcelFile(wb, `rapport_statistiques_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(tr("Rapport exporté", "تم تصدير التقرير", "Report exported"));
    } catch (e) {
      console.error(e);
      toast.error(tr("Échec de l'export", "فشل التصدير", "Export failed"));
    }
  };

  /* ═══════════════════════════════ Rendu ═══════════════════════════════ */

  if (user?.role !== "professor") {
    return (
      <div className="py-16 text-center text-muted-foreground">
        {tr("Cette page est réservée aux enseignants.", "هذه الصفحة مخصصة للأساتذة.", "This page is for teachers only.")}
      </div>
    );
  }

  const Kpi = ({ icon: Icon, label, value, sub, valueClass, extra }: { icon: any; label: string; value: string; sub?: string; valueClass?: string; extra?: ReactNode }) => (
    <Card className="stat-card-in">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className={`text-2xl font-bold tabular-nums ${valueClass || ""}`}>{value}</span>
          {extra}
        </div>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );

  const toneClasses = {
    good: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200",
    warn: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
    bad: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200",
    info: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200",
  };

  const maxDay = Math.max(1, ...engagement.days);
  const maxHour = Math.max(1, ...engagement.hours);
  const levelKeys: Exclude<Level, "none">[] = ["struggling", "progress", "good", "excellent"];

  return (
    <div className="space-y-5" dir={isRtl ? "rtl" : "ltr"}>
      {/* ───── En-tête & filtres ───── */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" />
            {tr("Rapports & statistiques", "التقارير والإحصائيات", "Reports & statistics")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr("Pilotage de vos classes : résultats, progression, participation et élèves à accompagner.",
                "تتبع أقسامك: النتائج، التطور، المشاركة والتلاميذ الذين يحتاجون مواكبة.",
                "Steer your classes: results, progress, participation and students to support.")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={roomFilter} onValueChange={setRoomFilter}>
            <SelectTrigger className="h-10 w-full sm:w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tr("Toutes les classes", "جميع الأقسام", "All classes")}</SelectItem>
              {(data?.rooms || []).map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="h-10 w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">{tr("30 derniers jours", "آخر 30 يوماً", "Last 30 days")}</SelectItem>
              <SelectItem value="90">{tr("3 derniers mois", "آخر 3 أشهر", "Last 3 months")}</SelectItem>
              <SelectItem value="180">{tr("6 derniers mois", "آخر 6 أشهر", "Last 6 months")}</SelectItem>
              <SelectItem value="365">{tr("12 derniers mois", "آخر 12 شهراً", "Last 12 months")}</SelectItem>
              <SelectItem value="all">{tr("Depuis le début", "منذ البداية", "All time")}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={refresh} disabled={refreshing || loading} className="h-10 gap-2">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {tr("Actualiser", "تحديث", "Refresh")}
          </Button>
          <Button onClick={exportExcel} disabled={loading || !allStudents.length} className="h-10 gap-2">
            <Download className="h-4 w-4" />
            Excel
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
          {tr("Calcul des statistiques…", "جارٍ حساب الإحصائيات…", "Computing statistics…")}
        </div>
      ) : !data || !data.rooms.length ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">
          {tr("Créez une classe et des quiz pour voir vos statistiques.", "أنشئ قسماً واختبارات لعرض الإحصائيات.", "Create a class and quizzes to see statistics.")}
        </CardContent></Card>
      ) : (
        <>
          {/* ───── Indicateurs clés ───── */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <Kpi icon={Users} label={tr("Élèves", "التلاميذ", "Students")} value={String(kpis.students)}
              sub={tr(`${kpis.active} actifs (${opts.inactivityDays} j)`, `${kpis.active} نشيط (${opts.inactivityDays} أيام)`, `${kpis.active} active (${opts.inactivityDays} d)`)} />
            <Kpi icon={Target} label={tr("Moyenne générale", "المعدل العام", "Overall average")} value={kpis.avg20 === null ? "—" : `${num(kpis.avg20)}/20`} valueClass={tone(kpis.avg20)}
              extra={kpis.delta !== null ? (
                <span className={`inline-flex items-center text-xs font-semibold ${kpis.delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {kpis.delta > 0.05 ? <ArrowUpRight className="h-3.5 w-3.5" /> : kpis.delta < -0.05 ? <ArrowDownRight className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                  {num(Math.abs(kpis.delta))}
                </span>
              ) : undefined}
              sub={tr(`${kpis.evaluated} élève(s) évalué(s)`, `${kpis.evaluated} تلميذ(ة) مقيم`, `${kpis.evaluated} assessed`)} />
            <Kpi icon={Award} label={tr(`Réussite (≥ ${opts.passThreshold}/20)`, `النجاح (≥ ${opts.passThreshold}/20)`, `Pass (≥ ${opts.passThreshold}/20)`)} value={kpis.pass === null ? "—" : `${Math.round(kpis.pass)} %`} />
            <Kpi icon={CheckCircle2} label={tr("Participation aux quiz", "المشاركة في الاختبارات", "Quiz participation")} value={kpis.participation === null ? "—" : `${Math.round(kpis.participation)} %`}
              sub={tr(`${kpis.submissions} copie(s)`, `${kpis.submissions} ورقة`, `${kpis.submissions} submission(s)`)} />
            <Kpi icon={Clock} label={tr("Temps d'étude / élève", "وقت المراجعة / تلميذ", "Study time / student")} value={formatMinutes(kpis.study)} />
            <Kpi icon={AlertTriangle} label={tr("À accompagner", "للمواكبة", "To support")} value={String(kpis.toSupport)} valueClass={kpis.toSupport ? "text-rose-600 dark:text-rose-400" : ""}
              sub={kpis.incidents ? tr(`${kpis.incidents} incident(s) en quiz`, `${kpis.incidents} مخالفة في الاختبارات`, `${kpis.incidents} quiz incident(s)`) : undefined} />
          </div>

          {/* ───── Constats ───── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Lightbulb className="h-5 w-5 text-amber-500" />{tr("À retenir", "أهم الملاحظات", "Key takeaways")}</CardTitle>
              <CardDescription>{tr("Constats calculés automatiquement sur la période choisie.", "ملاحظات محسوبة تلقائياً للفترة المختارة.", "Automatically computed for the selected period.")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 md:grid-cols-2">
              {insights.map((ins, i) => (
                <div key={i} className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm ${toneClasses[ins.tone]}`}>
                  <ins.icon className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{ins.text}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Tabs defaultValue="classes" className="w-full">
            <TabsList className="flex flex-wrap h-auto w-full sm:w-auto">
              <TabsTrigger value="classes" className="gap-1.5"><School className="h-4 w-4" />{tr("Classes", "الأقسام", "Classes")}</TabsTrigger>
              <TabsTrigger value="students" className="gap-1.5"><GraduationCap className="h-4 w-4" />{tr("Élèves", "التلاميذ", "Students")}</TabsTrigger>
              <TabsTrigger value="quizzes" className="gap-1.5"><FileQuestion className="h-4 w-4" />{tr("Évaluations", "التقويمات", "Assessments")}</TabsTrigger>
              <TabsTrigger value="engagement" className="gap-1.5"><Activity className="h-4 w-4" />{tr("Engagement", "الانخراط", "Engagement")}</TabsTrigger>
            </TabsList>

            {/* ═════ Classes ═════ */}
            <TabsContent value="classes" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{tr("Évolution des résultats", "تطور النتائج", "Results over time")}</CardTitle>
                  <CardDescription>{tr("Moyenne des copies par semaine (/20) et nombre de copies rendues.", "معدل الأوراق أسبوعياً (/20) وعدد الأوراق.", "Weekly average (/20) and number of submissions.")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {weekly.length < 2 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">{tr("Pas assez de copies sur la période.", "لا توجد أوراق كافية في هذه الفترة.", "Not enough submissions in this period.")}</p>
                  ) : (
                    <div className="h-64" dir="ltr">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={weekly} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                          <YAxis yAxisId="note" domain={[0, 20]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                          <YAxis yAxisId="count" hide />
                          <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v: any, k: any) => [k === "moyenne" ? `${num(v)}/20` : v, k === "moyenne" ? tr("Moyenne", "المعدل", "Average") : tr("Copies", "الأوراق", "Submissions")]} />
                          <Bar yAxisId="count" dataKey="copies" fill="hsl(var(--muted-foreground) / 0.25)" radius={[4, 4, 0, 0]} barSize={18} />
                          <Line yAxisId="note" type="monotone" dataKey="moyenne" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 5 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{tr("Comparaison des classes", "مقارنة الأقسام", "Class comparison")}</CardTitle>
                  <CardDescription>{tr("Cliquez sur une classe pour ouvrir son suivi détaillé.", "انقر على قسم لفتح تتبعه المفصل.", "Click a class to open its detailed tracking.")}</CardDescription>
                </CardHeader>
                <CardContent className="p-0 sm:p-6 sm:pt-0">
                  <div className="app-table-wrap app-table-flat overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
                    <table className="app-table w-full text-sm">
                      <thead>
                        <tr>
                          <th>{tr("Classe", "القسم", "Class")}</th>
                          <th className="text-center">{tr("Élèves", "التلاميذ", "Students")}</th>
                          <th className="text-center">{tr("Moyenne", "المعدل", "Average")}</th>
                          <th className="text-center">{tr("Réussite", "النجاح", "Pass")}</th>
                          <th className="text-center">{tr("Participation", "المشاركة", "Participation")}</th>
                          <th className="text-center">{tr("Étude / élève", "مراجعة / تلميذ", "Study / student")}</th>
                          <th>{tr("Niveaux", "المستويات", "Levels")}</th>
                          <th className="text-center">{tr("À accompagner", "للمواكبة", "To support")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roomReports.map((r) => {
                          const a = r.analytics;
                          const total = a.distribution.reduce((x, y) => x + y, 0);
                          return (
                            <tr key={r.room.id}>
                              <td className="font-semibold">
                                <Link to={`/rooms/${r.room.id}/students-activities`} className="hover:text-primary hover:underline underline-offset-4">{r.room.name}</Link>
                              </td>
                              <td className="text-center tabular-nums">{r.studentsCount}</td>
                              <td className={`text-center font-bold tabular-nums ${tone(a.classNote20)}`}>{a.classNote20 === null ? "—" : `${num(a.classNote20)}/20`}</td>
                              <td className="text-center tabular-nums">{a.successRate === null ? "—" : `${Math.round(a.successRate)} %`}</td>
                              <td className="text-center tabular-nums">{a.quizzes.length ? `${Math.round(a.participationRate)} %` : "—"}</td>
                              <td className="text-center tabular-nums text-xs">{formatMinutes(a.avgStudyMinutes)}</td>
                              <td style={{ minWidth: 140 }}>
                                {total ? (
                                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" title={levelKeys.map((k, i) => `${levelLabel(k)} : ${a.distribution[i]}`).join(" · ")}>
                                    {levelKeys.map((k, i) => a.distribution[i] ? (
                                      <div key={k} style={{ width: `${(a.distribution[i] / total) * 100}%`, background: LEVEL_COLORS[k], borderRight: "2px solid hsl(var(--card))" }} />
                                    ) : null)}
                                  </div>
                                ) : <span className="text-xs text-muted-foreground">—</span>}
                              </td>
                              <td className="text-center">
                                {a.toSupport.length ? <Badge variant="destructive" className="tabular-nums">{a.toSupport.length}</Badge> : <span className="text-xs text-emerald-600">0</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap gap-3 px-4 pb-4 sm:px-0 sm:pb-0 pt-3 text-xs text-muted-foreground">
                    {levelKeys.map((k) => (
                      <span key={k} className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: LEVEL_COLORS[k] }} />{levelLabel(k)}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {roomReports.length > 1 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{tr("Moyenne par classe (/20)", "المعدل حسب القسم (/20)", "Average by class (/20)")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-56" dir="ltr">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={roomReports.map((r) => ({ name: r.room.name, moyenne: r.analytics.classNote20 === null ? 0 : Math.round(r.analytics.classNote20 * 10) / 10 }))} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval={0} />
                          <YAxis domain={[0, 20]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v: any) => [`${num(v)}/20`, tr("Moyenne", "المعدل", "Average")]} cursor={{ fill: "hsl(var(--muted) / 0.5)" }} />
                          <Bar dataKey="moyenne" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={48} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ═════ Élèves ═════ */}
            <TabsContent value="students" className="space-y-4 mt-4">
              <div className="flex flex-col lg:flex-row gap-2">
                <StudentSearchBar
                  query={studentQuery}
                  onQueryChange={(v) => { setStudentQuery(v); setStudentLimit(50); }}
                  mode={studentMode}
                  onModeChange={setStudentMode}
                  resultCount={filteredStudents.length}
                  totalCount={allStudents.length}
                  className="flex-1"
                />
                <Select value={levelFilter} onValueChange={(v) => { setLevelFilter(v as any); setStudentLimit(50); }}>
                  <SelectTrigger className="h-10 w-full lg:w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tr("Tous les niveaux", "جميع المستويات", "All levels")}</SelectItem>
                    <SelectItem value="support">{tr("À accompagner uniquement", "للمواكبة فقط", "To support only")}</SelectItem>
                    {(["excellent", "good", "progress", "struggling", "none"] as Level[]).map((l) => <SelectItem key={l} value={l}>{levelLabel(l)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="app-table-wrap" style={{ WebkitOverflowScrolling: "touch" }}>
                <table className="app-table w-full text-sm">
                  <thead>
                    <tr>
                      <th>{tr("Élève", "التلميذ", "Student")}</th>
                      <th>{tr("Classe", "القسم", "Class")}</th>
                      <th className="text-center">{tr("Moyenne", "المعدل", "Average")}</th>
                      <th className="text-center">{tr("Rang", "الرتبة", "Rank")}</th>
                      <th className="text-center">{tr("Quiz", "الاختبارات", "Quizzes")}</th>
                      <th className="text-center">{tr("Évolution", "التطور", "Trend")}</th>
                      <th className="text-center">{tr("Étude", "المراجعة", "Study")}</th>
                      <th>{tr("Dernière activité", "آخر نشاط", "Last activity")}</th>
                      <th>{tr("Alertes", "تنبيهات", "Alerts")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.slice(0, studentLimit).map((s) => (
                      <tr key={`${s.roomId}-${s.student.id}`}>
                        <td>
                          <div className="font-semibold">{s.student.name}</div>
                          {studentMassar(s.student) && <div className="text-xs text-muted-foreground font-mono">{studentMassar(s.student)}</div>}
                        </td>
                        <td className="text-xs">{s.roomName}</td>
                        <td className={`text-center font-bold tabular-nums ${tone(s.note20)}`}>
                          {s.note20 === null ? "—" : `${num(s.note20)}/20`}
                          <div className="text-[11px] font-medium text-muted-foreground">{levelLabel(s.level)}</div>
                        </td>
                        <td className="text-center tabular-nums">{s.rank ?? "—"}</td>
                        <td className="text-center tabular-nums text-xs">{s.quizzesTaken} · {Math.round(s.participation)} %</td>
                        <td className="text-center">
                          {s.trend === "up" ? <TrendingUp className="h-4 w-4 text-emerald-600 inline" />
                            : s.trend === "down" ? <TrendingDown className="h-4 w-4 text-rose-600 inline" />
                            : s.trend === "stable" ? <Minus className="h-4 w-4 text-muted-foreground inline" />
                            : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="text-center text-xs tabular-nums">{formatMinutes(s.studyMinutes)}</td>
                        <td className="text-xs whitespace-nowrap">{relDays(s.lastSeen)}</td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {s.alerts.length ? s.alerts.map((a) => (
                              <span key={a} className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:text-rose-300">{alertLabel(a)}</span>
                            )) : <span className="text-[11px] text-emerald-600">✓</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredStudents.length === 0 && (
                      <tr><td colSpan={9} className="py-10 text-center text-muted-foreground">{tr("Aucun élève ne correspond.", "لا يوجد تلميذ مطابق.", "No matching student.")}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {filteredStudents.length > studentLimit && (
                <div className="text-center">
                  <Button variant="outline" onClick={() => setStudentLimit((n) => n + 50)}>
                    {tr(`Afficher plus (${filteredStudents.length - studentLimit} restants)`, `عرض المزيد (${filteredStudents.length - studentLimit})`, `Show more (${filteredStudents.length - studentLimit} left)`)}
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* ═════ Évaluations ═════ */}
            <TabsContent value="quizzes" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2"><FileQuestion className="h-5 w-5 text-rose-500" />{tr("Notions les moins maîtrisées", "المفاهيم الأقل تحكماً", "Least mastered topics")}</CardTitle>
                  <CardDescription>{tr("Questions de quiz avec le plus faible taux de bonnes réponses (au moins 3 réponses) : à reprendre en classe.", "أسئلة الاختبارات بأضعف نسبة إجابات صحيحة (3 إجابات على الأقل): للمراجعة في القسم.", "Quiz questions with the lowest success rate (at least 3 answers): revisit them in class.")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {hardestQuestions.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">{tr("Pas encore assez de réponses.", "لا توجد إجابات كافية بعد.", "Not enough answers yet.")}</p>
                  ) : hardestQuestions.map((h, i) => (
                    <div key={i} className="flex items-center gap-3" title={`${h.answered} ${tr("réponses", "إجابة", "answers")}`}>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{h.text}</div>
                        <div className="text-xs text-muted-foreground truncate">{h.quiz} · {h.room}</div>
                      </div>
                      <div className="w-28 sm:w-40 h-2.5 rounded-full bg-muted overflow-hidden shrink-0">
                        <div className="h-full rounded-full" style={{ width: `${h.rate}%`, background: h.rate < 40 ? "#dc2626" : h.rate < 60 ? "#d97706" : "#2563eb" }} />
                      </div>
                      <span className="w-12 text-end text-sm font-bold tabular-nums">{Math.round(h.rate)}%</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{tr("Résultats par quiz", "النتائج حسب الاختبار", "Results by quiz")}</CardTitle>
                </CardHeader>
                <CardContent className="p-0 sm:p-6 sm:pt-0">
                  <div className="app-table-wrap app-table-flat overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
                    <table className="app-table w-full text-sm">
                      <thead>
                        <tr>
                          <th>Quiz</th>
                          <th>{tr("Classe", "القسم", "Class")}</th>
                          <th>Date</th>
                          <th className="text-center">{tr("Participation", "المشاركة", "Participation")}</th>
                          <th className="text-center">{tr("Moyenne", "المعدل", "Average")}</th>
                          <th className="text-center">{tr("Min – max", "الأدنى – الأعلى", "Min – max")}</th>
                          <th className="text-center">{tr("Réussite", "النجاح", "Pass")}</th>
                          <th className="text-center">{tr("Durée moy.", "متوسط المدة", "Avg time")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quizRows.map((q) => (
                          <tr key={q.quiz.id}>
                            <td className="font-semibold">{q.quiz.title}</td>
                            <td className="text-xs">{q.roomName}</td>
                            <td className="text-xs whitespace-nowrap">{fmtDate(q.quiz.date)}</td>
                            <td className="text-center tabular-nums">
                              <span className={q.participation < 50 ? "text-rose-600 font-semibold" : ""}>{q.participants} · {Math.round(q.participation)} %</span>
                            </td>
                            <td className={`text-center font-bold tabular-nums ${tone(q.mean === null ? null : q.mean / 5)}`}>{q.mean === null ? "—" : `${num(q.mean / 5)}/20`}</td>
                            <td className="text-center tabular-nums text-xs">{q.min === null ? "—" : `${num((q.min as number) / 5)} – ${num((q.max as number) / 5)}`}</td>
                            <td className="text-center tabular-nums">{q.successRate === null ? "—" : `${Math.round(q.successRate)} %`}</td>
                            <td className="text-center tabular-nums text-xs">{q.avgMinutes === null ? "—" : `${Math.round(q.avgMinutes)} min`}</td>
                          </tr>
                        ))}
                        {quizRows.length === 0 && (
                          <tr><td colSpan={8} className="py-10 text-center text-muted-foreground">{tr("Aucun quiz sur la période.", "لا توجد اختبارات في هذه الفترة.", "No quiz in this period.")}</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ═════ Engagement ═════ */}
            <TabsContent value="engagement" className="space-y-4 mt-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{tr("Jours de travail", "أيام العمل", "Study days")}</CardTitle>
                    <CardDescription>{tr("Temps passé sur la plateforme par jour de la semaine.", "الوقت المستغرق في المنصة حسب أيام الأسبوع.", "Time spent on the platform by weekday.")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {engagement.days.map((m, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm" title={formatMinutes(m)}>
                        <span className="w-20 shrink-0 text-muted-foreground">{dayNames[i]}</span>
                        <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${(m / maxDay) * 100}%` }} />
                        </div>
                        <span className="w-16 text-end text-xs tabular-nums">{formatMinutes(m)}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{tr("Heures de connexion", "ساعات الاتصال", "Connection hours")}</CardTitle>
                    <CardDescription>{tr("À quelle heure vos élèves révisent (début des sessions).", "متى يراجع تلاميذك (بداية الجلسات).", "When your students study (session start).")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-[3px] h-40" dir="ltr">
                      {engagement.hours.map((m, h) => (
                        <div key={h} className="flex-1 flex flex-col items-center justify-end h-full" title={`${h}h : ${formatMinutes(m)}`}>
                          <div className="w-full rounded-t-[4px] bg-primary" style={{ height: `${(m / maxHour) * 100}%`, minHeight: m ? 3 : 0, opacity: m ? 1 : 0 }} />
                        </div>
                      ))}
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-muted-foreground" dir="ltr">
                      <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" />{tr("Échéances (14 jours)", "المواعيد (14 يوماً)", "Deadlines (14 days)")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {upcoming.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">{tr("Aucune échéance prochaine.", "لا توجد مواعيد قريبة.", "No upcoming deadline.")}</p>
                    ) : upcoming.slice(0, 10).map((u, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {u.kind === "quiz" ? "Quiz" : u.kind === "exam" ? tr("Examen", "امتحان", "Exam") : tr("Exercice", "تمرين", "Exercise")}
                        </Badge>
                        <span className="min-w-0 flex-1 truncate font-medium">{u.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{u.room} · {fmtDate(u.date)}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" />{tr("Contenus publiés", "المحتويات المنشورة", "Published content")}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 sm:p-6 sm:pt-0">
                    <div className="app-table-wrap app-table-flat overflow-x-auto">
                      <table className="app-table w-full text-sm">
                        <thead>
                          <tr>
                            <th>{tr("Classe", "القسم", "Class")}</th>
                            <th className="text-center">{tr("Cours", "الدروس", "Courses")}</th>
                            <th className="text-center">{tr("Exercices", "التمارين", "Exercises")}</th>
                            <th className="text-center">Quiz</th>
                            <th className="text-center">{tr("Examens", "الامتحانات", "Exams")}</th>
                            <th className="text-center"><LogOut className="h-3.5 w-3.5 inline" /></th>
                          </tr>
                        </thead>
                        <tbody>
                          {roomReports.map((r) => (
                            <tr key={r.room.id}>
                              <td className="font-semibold">{r.room.name}</td>
                              <td className="text-center tabular-nums">{r.coursesCount}</td>
                              <td className="text-center tabular-nums">{r.exercisesCount}</td>
                              <td className="text-center tabular-nums">{r.quizzesCount}</td>
                              <td className="text-center tabular-nums">{r.examsCount}</td>
                              <td className="text-center tabular-nums" title={tr("Élèves ayant quitté un quiz", "تلاميذ غادروا اختباراً", "Students who left a quiz")}>{r.exitsStudents}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default Reports;

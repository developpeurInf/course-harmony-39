import { useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatCard } from "@/components/ui/stat-card";
import {
  Download, RefreshCw, Trophy, Medal, Users, Target, TrendingUp, TrendingDown, Minus, Clock,
  AlertTriangle, Wifi, GraduationCap, BarChart3, ListChecks, Search, ChevronUp, ChevronDown,
  FileQuestion, Sparkles, UserX, CalendarClock, LineChart, HeartHandshake, Eye, CheckCircle2, XCircle
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCourses } from "@/contexts/CourseContext";
import {
  computeClassAnalytics, formatMinutes, fmtNote,
  AStudent, AQuiz, ASubmission, AQuestion, AAnswer, ASession,
  StudentAnalytics, QuizAnalytics, Level, AlertReason
} from "@/lib/classAnalytics";

interface StudentActivityProps {
  roomId: string;
}

type Period = "all" | "90" | "30" | "7";
type SortKey = "rank" | "name" | "note" | "participation" | "success" | "trend" | "study" | "lastSeen";

/* ───────────────────────────── helpers d'affichage ───────────────────────────── */

const LEVEL_STYLE: Record<Level, string> = {
  excellent: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  good: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30",
  progress: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  struggling: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
  none: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30",
};

const BUCKET_COLORS = ["#e11d48", "#d97706", "#0284c7", "#059669"];

const noteColor = (n: number | null) =>
  n === null ? "text-muted-foreground" : n >= 14 ? "text-emerald-600" : n >= 12 ? "text-sky-600" : n >= 10 ? "text-amber-600" : n >= 8 ? "text-orange-600" : "text-rose-600";

const barColor = (pct: number | null) =>
  pct === null ? "bg-muted" : pct >= 70 ? "bg-emerald-500" : pct >= 60 ? "bg-sky-500" : pct >= 50 ? "bg-amber-500" : pct >= 40 ? "bg-orange-500" : "bg-rose-500";

const initials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  // Écriture arabe : une seule lettre (les lettres isolées de deux mots se lisent mal)
  if (/[\u0600-\u06FF]/.test(name)) return (words[0] || "").replace(/^ال/, "").charAt(0) || "؟";
  return words.map(n => n[0]).join("").toUpperCase().slice(0, 2);
};

const stripHtml = (html: string) =>
  (html || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<img[^>]*>/gi, " [image] ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

/* ─────────────────────────── mini-graphiques SVG ─────────────────────────── */

/** Courbe d'évolution (une ou deux séries, valeurs 0–100). */
function TrendChart({
  labels, series, height = 200, emptyLabel,
}: {
  labels: string[];
  series: { name: string; color: string; values: (number | null)[]; dashed?: boolean }[];
  height?: number;
  emptyLabel: string;
}) {
  const W = 640, H = height, padL = 34, padR = 14, padT = 14, padB = 30;
  const n = labels.length;
  if (n === 0) {
    return <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">{emptyLabel}</div>;
  }
  const x = (i: number) => (n === 1 ? (padL + W - padR) / 2 : padL + (i * (W - padL - padR)) / (n - 1));
  const y = (v: number) => padT + (1 - v / 100) * (H - padT - padB);
  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img">
        {[0, 25, 50, 75, 100].map(v => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="currentColor" className="text-border" strokeDasharray={v === 0 ? undefined : "3 4"} />
            <text x={padL - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" className="fill-muted-foreground">{v}</text>
          </g>
        ))}
        <line x1={padL} x2={W - padR} y1={y(50)} y2={y(50)} stroke="#f59e0b" strokeOpacity="0.45" strokeWidth="1.2" />
        {series.map(s => {
          const pts = s.values.map((v, i) => (v === null ? null : [x(i), y(v)] as [number, number]));
          const valid = pts.filter((p): p is [number, number] => p !== null);
          const d = valid.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
          const area = valid.length > 1 ? `${d} L${valid[valid.length - 1][0]},${y(0)} L${valid[0][0]},${y(0)} Z` : "";
          return (
            <g key={s.name}>
              {!s.dashed && area && <path d={area} fill={s.color} opacity="0.08" />}
              {valid.length > 1 && <path d={d} fill="none" stroke={s.color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? "6 5" : undefined} />}
              {valid.map((p, i) => (
                <circle key={i} cx={p[0]} cy={p[1]} r={s.dashed ? 3 : 4.2} fill="hsl(var(--card))" stroke={s.color} strokeWidth="2.2" />
              ))}
            </g>
          );
        })}
        {labels.map((l, i) => (
          <text key={i} x={x(i)} y={H - 10} textAnchor="middle" fontSize="10" className="fill-muted-foreground">
            {l.length > 14 ? l.slice(0, 13) + "…" : l}
          </text>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        {series.map(s => (
          <span key={s.name} className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-5 rounded" style={{ background: s.color, opacity: s.dashed ? 0.6 : 1 }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Barres horizontales de répartition (4 tranches). */
function DistributionBars({ counts, labels, total }: { counts: number[]; labels: string[]; total: number }) {
  const max = Math.max(1, ...counts);
  return (
    <div className="space-y-3">
      {counts.map((c, i) => {
        const pct = total ? Math.round((c / total) * 100) : 0;
        return (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: BUCKET_COLORS[i] }} />
                {labels[i]}
              </span>
              <span className="tabular-nums text-muted-foreground"><b className="text-foreground">{c}</b> · {pct}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${(c / max) * 100}%`, background: BUCKET_COLORS[i] }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Barre empilée compacte des 4 tranches. */
function StackedBar({ counts }: { counts: number[] }) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return <div className="h-2 w-full rounded-full bg-muted" />;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
      {counts.map((c, i) => c > 0 && <div key={i} style={{ width: `${(c / total) * 100}%`, background: BUCKET_COLORS[i] }} />)}
    </div>
  );
}

/* ─────────────────────────────── composant ─────────────────────────────── */

const StudentActivities = ({ roomId }: StudentActivityProps) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { rooms } = useCourses();
  const isRtl = language === "ar";
  const tr = useCallback((fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en), [language]);
  const locale = language === "ar" ? "ar-MA" : language === "fr" ? "fr-FR" : "en-GB";

  // données brutes
  const [students, setStudents] = useState<AStudent[]>([]);
  const [quizzes, setQuizzes] = useState<AQuiz[]>([]);
  const [submissions, setSubmissions] = useState<ASubmission[]>([]);
  const [questions, setQuestions] = useState<AQuestion[]>([]);
  const [answers, setAnswers] = useState<AAnswer[]>([]);
  const [sessions, setSessions] = useState<ASession[]>([]);
  const [activeSessions, setActiveSessions] = useState<ASession[]>([]);

  // interface
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>("all");
  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<"all" | Level | "alerts">("all");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const room = rooms.find(r => r.id === roomId);

  /* ───────────── chargement ───────────── */

  const loadActiveSessions = useCallback(async () => {
    try { await supabase.rpc("close_stale_sessions"); } catch { /* ignore */ }
    const { data } = await supabase
      .from("student_sessions")
      .select("student_id, session_start, last_activity, duration_minutes, is_active")
      .eq("room_id", roomId)
      .eq("is_active", true);
    setActiveSessions((data || []) as ASession[]);
  }, [roomId]);

  const loadAll = useCallback(async () => {
    if (!roomId) return;
    try {
      // 1) Élèves de la classe (profil rattaché OU inscription dans la classe)
      const [{ data: direct }, { data: enr }] = await Promise.all([
        supabase.from("profiles").select("id, name, email, username, avatar_url").eq("role", "student").eq("room_id", roomId),
        supabase.from("enrollments").select("student_id").eq("room_id", roomId),
      ]);
      const map = new Map<string, AStudent>();
      (direct || []).forEach((p: any) => map.set(p.id, p));
      const missing = Array.from(new Set<string>((enr || []).map((e: any) => e.student_id as string))).filter(id => !map.has(id));
      if (missing.length) {
        const { data: extra } = await supabase.from("profiles").select("id, name, email, username, avatar_url, role").in("id", missing);
        (extra || []).filter((p: any) => p.role === "student").forEach((p: any) => map.set(p.id, p));
      }
      const studentList = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
      setStudents(studentList);

      // 2) Quiz de la classe
      const { data: roomCourses } = await supabase.from("courses").select("id").eq("room_id", roomId);
      const courseIds = (roomCourses || []).map((c: any) => c.id);
      let quizList: AQuiz[] = [];
      if (courseIds.length) {
        const { data: ex } = await supabase
          .from("exams")
          .select("id, title, exam_date, created_at, course_id, type")
          .in("course_id", courseIds)
          .eq("type", "quiz");
        quizList = (ex || []).map((e: any) => ({ id: e.id, title: e.title, date: e.exam_date || e.created_at, course_id: e.course_id }));
      }
      setQuizzes(quizList);

      // 3) Soumissions, questions et réponses
      const quizIds = quizList.map(q => q.id);
      let subs: ASubmission[] = [];
      let qs: AQuestion[] = [];
      if (quizIds.length) {
        const [{ data: s }, { data: q }] = await Promise.all([
          supabase.from("quiz_submissions")
            .select("id, exam_id, student_id, score, total_points, submitted_at, time_taken_minutes")
            .in("exam_id", quizIds)
            .eq("is_completed", true),
          supabase.from("quiz_questions")
            .select("id, exam_id, question, question_order, points, question_type")
            .in("exam_id", quizIds),
        ]);
        subs = (s || []) as ASubmission[];
        qs = (q || []) as AQuestion[];
      }
      setSubmissions(subs);
      setQuestions(qs);

      const subIds = subs.map(s => s.id);
      const ans: AAnswer[] = [];
      for (let i = 0; i < subIds.length; i += 150) {
        const { data: a } = await supabase
          .from("quiz_answers")
          .select("submission_id, question_id, is_correct")
          .in("submission_id", subIds.slice(i, i + 150));
        ans.push(...((a || []) as AAnswer[]));
      }
      setAnswers(ans);

      // 4) Sessions (temps d'étude, dernière activité)
      const { data: sess } = await supabase
        .from("student_sessions")
        .select("student_id, session_start, last_activity, duration_minutes, is_active")
        .eq("room_id", roomId)
        .order("session_start", { ascending: false })
        .limit(5000);
      setSessions((sess || []) as ASession[]);

      await loadActiveSessions();
    } catch (err) {
      console.error("Error loading class analytics:", err);
      toast.error(tr("Erreur de chargement des données", "خطأ في تحميل البيانات", "Failed to load data"));
    }
  }, [roomId, loadActiveSessions, tr]);

  useEffect(() => {
    if (!user || !roomId) return;
    setLoading(true);
    loadAll().finally(() => setLoading(false));
  }, [user, roomId, loadAll]);

  // « En ligne » : rafraîchi toutes les 30 s et lors des connexions
  useEffect(() => {
    if (!user || !roomId) return;
    const channel = supabase
      .channel(`class-analytics-${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "student_sessions", filter: `room_id=eq.${roomId}` }, () => loadActiveSessions())
      .subscribe();
    const id = setInterval(loadActiveSessions, 30_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(id);
    };
  }, [user, roomId, loadActiveSessions]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
    toast.success(tr("Données actualisées", "تم تحديث البيانات", "Data refreshed"));
  };

  /* ───────────── analyse ───────────── */

  const analytics = useMemo(() => {
    const since = period === "all" ? 0 : Date.now() - parseInt(period) * 86400000;
    const subsP = submissions.filter(s => new Date(s.submitted_at).getTime() >= since);
    const quizIdsWithSubs = new Set(subsP.map(s => s.exam_id));
    const quizzesP = period === "all"
      ? quizzes
      : quizzes.filter(q => quizIdsWithSubs.has(q.id) || new Date(q.date).getTime() >= since);
    const sessP = sessions.filter(s => new Date(s.session_start).getTime() >= since);
    return computeClassAnalytics({
      students, quizzes: quizzesP, submissions: subsP, questions, answers, sessions: sessP, activeSessions,
    });
  }, [students, quizzes, submissions, questions, answers, sessions, activeSessions, period]);

  const levelLabel = (l: Level) =>
    ({
      excellent: tr("Excellent", "ممتاز", "Excellent"),
      good: tr("Satisfaisant", "جيد", "Good"),
      progress: tr("En progression", "في تقدم", "Progressing"),
      struggling: tr("En difficulté", "متعثر", "Struggling"),
      none: tr("Non évalué", "غير مقيَّم", "Not assessed"),
    })[l];

  const alertLabel = (a: AlertReason) =>
    ({
      low_average: tr("Moyenne < 10/20", "معدل أقل من 10/20", "Average < 10/20"),
      low_participation: tr("Participation faible", "مشاركة ضعيفة", "Low participation"),
      declining: tr("Résultats en baisse", "نتائج في تراجع", "Declining results"),
      inactive: tr("Inactif depuis 7 j+", "غير نشط منذ 7 أيام+", "Inactive 7+ days"),
      never_connected: tr("Jamais connecté", "لم يتصل أبداً", "Never connected"),
      no_quiz: tr("Aucun quiz passé", "لم يجتز أي اختبار", "No quiz taken"),
    })[a];

  const bucketLabels = [
    tr("En difficulté  [0 – 8[", "متعثرون  [0 – 8[", "Struggling  [0 – 8["),
    tr("En progression  [8 – 12[", "في تقدم  [8 – 12[", "Progressing  [8 – 12["),
    tr("Satisfaisant  [12 – 14[", "جيد  [12 – 14[", "Good  [12 – 14["),
    tr("Excellent  [14 – 20]", "ممتاز  [14 – 20]", "Excellent  [14 – 20]"),
  ];

  const fmtDate = (iso: string | null, withTime = false) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString(locale, withTime ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "short", year: "numeric" });
  };

  const relative = (iso: string | null) => {
    if (!iso) return tr("Jamais", "أبداً", "Never");
    const diff = Date.now() - new Date(iso).getTime();
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    const m = Math.round(diff / 60000);
    if (m < 60) return rtf.format(-Math.max(m, 0), "minute");
    const h = Math.round(m / 60);
    if (h < 24) return rtf.format(-h, "hour");
    const d = Math.round(h / 24);
    if (d < 31) return rtf.format(-d, "day");
    return fmtDate(iso);
  };

  const pctTxt = (v: number | null) => (v === null ? "—" : `${Math.round(v)} %`);

  /* ───────────── classement filtré / trié ───────────── */

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = analytics.students.filter(s =>
      !q || s.student.name.toLowerCase().includes(q) || (s.student.email || "").toLowerCase().includes(q) || (s.student.username || "").toLowerCase().includes(q)
    );
    if (levelFilter === "alerts") list = list.filter(s => s.alerts.length > 0);
    else if (levelFilter !== "all") list = list.filter(s => s.level === levelFilter);

    const val = (s: StudentAnalytics): number | string | null => {
      switch (sortKey) {
        case "rank": return s.rank;
        case "name": return s.student.name.toLowerCase();
        case "note": return s.note20;
        case "participation": return s.participation;
        case "success": return s.successRate;
        case "trend": return s.trendDelta;
        case "study": return s.studyMinutes;
        case "lastSeen": return s.lastSeen ? new Date(s.lastSeen).getTime() : null;
      }
    };
    return [...list].sort((a, b) => {
      const va = val(a), vb = val(b);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      const c = va < vb ? -1 : va > vb ? 1 : 0;
      return sortAsc ? c : -c;
    });
  }, [analytics.students, search, levelFilter, sortKey, sortAsc]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortAsc(v => !v);
    else {
      setSortKey(k);
      setSortAsc(k === "rank" || k === "name");
    }
  };

  const SortHead = ({ k, children, className = "" }: { k: SortKey; children: ReactNode; className?: string }) => (
    <TableHead className={`cursor-pointer select-none whitespace-nowrap hover:text-foreground ${className}`} onClick={() => toggleSort(k)}>
      <span className="inline-flex items-center gap-1">
        {children}
        {sortKey === k ? (sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <span className="w-3" />}
      </span>
    </TableHead>
  );

  /* ───────────── export ───────────── */

  const exportCsv = () => {
    const quizCols = analytics.quizzes.map(q => q.quiz.title);
    const header = [
      tr("Rang", "الرتبة", "Rank"), tr("Élève", "التلميذ", "Student"), tr("E-mail", "البريد الإلكتروني", "Email"),
      tr("Moyenne /20", "المعدل /20", "Average /20"), tr("Quiz passés", "الاختبارات المنجزة", "Quizzes taken"),
      tr("Participation (%)", "المشاركة (%)", "Participation (%)"), tr("Réussite (%)", "النجاح (%)", "Success (%)"),
      tr("Progression (pts /20)", "التطور (نقط /20)", "Trend (pts /20)"), tr("Temps d'étude (min)", "وقت الدراسة (د)", "Study time (min)"),
      tr("Dernière activité", "آخر نشاط", "Last activity"), tr("Niveau", "المستوى", "Level"), tr("Points de vigilance", "نقط الانتباه", "Alerts"),
      ...quizCols.map(c => `${c} (/20)`),
    ];
    const lines = analytics.students.map(s => {
      const byQuiz = new Map(s.results.map(r => [r.quiz.id, r.pct / 5]));
      return [
        s.rank ?? "", s.student.name, s.student.email || "",
        s.note20 === null ? "" : fmtNote(s.note20, language), `${s.quizzesTaken}/${analytics.quizzes.length}`,
        Math.round(s.participation), s.successRate === null ? "" : Math.round(s.successRate),
        s.trendDelta === null ? "" : fmtNote(s.trendDelta / 5, language), Math.round(s.studyMinutes),
        s.lastSeen ? fmtDate(s.lastSeen, true) : "", levelLabel(s.level), s.alerts.map(alertLabel).join(" / "),
        ...analytics.quizzes.map(q => (byQuiz.has(q.quiz.id) ? fmtNote(byQuiz.get(q.quiz.id) as number, language) : "")),
      ];
    });
    const csv = "﻿" + [header, ...lines].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `suivi-${(room?.name || "classe").replace(/[^\w-]+/g, "_")}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(tr("Export réussi (ouvrable dans Excel)", "تم التصدير بنجاح", "Exported successfully"));
  };

  if (user?.role !== "professor") return null;

  /* ═══════════════════════════════ RENDU ═══════════════════════════════ */

  const A = analytics;
  const total = students.length;
  const selected = selectedId ? A.students.find(s => s.student.id === selectedId) || null : null;

  const TrendBadge = ({ s }: { s: StudentAnalytics }) => {
    if (s.trend === "na") return <span className="text-xs text-muted-foreground">—</span>;
    const d = (s.trendDelta || 0) / 5; // en points sur 20
    const cls = s.trend === "up" ? "text-emerald-600 bg-emerald-500/10" : s.trend === "down" ? "text-rose-600 bg-rose-500/10" : "text-slate-600 bg-slate-500/10";
    const Icon = s.trend === "up" ? TrendingUp : s.trend === "down" ? TrendingDown : Minus;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${cls}`}>
        <Icon className="h-3.5 w-3.5" />
        {d > 0 ? "+" : ""}{fmtNote(d, language)}
      </span>
    );
  };

  const RankBadge = ({ rank }: { rank: number | null }) => {
    if (rank === null) return <span className="text-muted-foreground">—</span>;
    const medal = rank === 1 ? "from-amber-300 to-yellow-500 text-amber-950" : rank === 2 ? "from-slate-200 to-slate-400 text-slate-800" : rank === 3 ? "from-orange-300 to-amber-600 text-orange-950" : null;
    if (medal) {
      return <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${medal} text-sm font-extrabold shadow-sm`}>{rank}</span>;
    }
    return <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">{rank}</span>;
  };

  const StudentCell = ({ s }: { s: StudentAnalytics }) => (
    <div className="flex items-center gap-3 min-w-0">
      <div className="relative shrink-0">
        <Avatar className="h-9 w-9 ring-2 ring-background">
          <AvatarImage src={s.student.avatar_url || undefined} />
          <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">{initials(s.student.name)}</AvatarFallback>
        </Avatar>
        {s.online && <span className="absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full border-2 border-background bg-emerald-500" />}
      </div>
      <div className="min-w-0">
        <p className="font-semibold truncate max-w-[190px]">{s.student.name}</p>
        <p className="text-[11px] text-muted-foreground truncate max-w-[190px]">{s.student.username || s.student.email}</p>
      </div>
    </div>
  );

  const Empty = ({ icon, title, desc }: { icon: ReactNode; title: string; desc?: string }) => (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">{icon}</div>
      <p className="font-semibold">{title}</p>
      {desc && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{desc}</p>}
    </div>
  );

  const quizLabels = A.quizzes.map(q => q.quiz.title);

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* ── Bandeau ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-indigo-600 to-violet-600 p-6 sm:p-7 text-white shadow-lg">
        <div className="pointer-events-none absolute -top-20 -end-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 start-10 h-56 w-56 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
              {tr("Suivi pédagogique", "التتبع التربوي", "Learning analytics")}
            </p>
            <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold leading-tight">
              {room?.name || tr("Classe", "القسم", "Class")}
            </h2>
            <p className="mt-1.5 text-sm text-white/80">
              {tr(
                `${total} élève(s) · ${A.quizzes.length} quiz analysé(s) · résultats de la dernière tentative`,
                `${total} تلميذ · ${A.quizzes.length} اختبار · نتائج آخر محاولة`,
                `${total} student(s) · ${A.quizzes.length} quiz(zes) · latest attempt results`
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onValueChange={v => setPeriod(v as Period)}>
              <SelectTrigger className="h-10 w-[180px] border-white/25 bg-white/10 text-white backdrop-blur hover:bg-white/15 [&>svg]:text-white">
                <CalendarClock className="h-4 w-4 me-2 opacity-80" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr("Toute l'année", "طوال السنة", "All time")}</SelectItem>
                <SelectItem value="90">{tr("3 derniers mois", "آخر 3 أشهر", "Last 3 months")}</SelectItem>
                <SelectItem value="30">{tr("30 derniers jours", "آخر 30 يوماً", "Last 30 days")}</SelectItem>
                <SelectItem value="7">{tr("7 derniers jours", "آخر 7 أيام", "Last 7 days")}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="secondary" onClick={handleRefresh} disabled={refreshing} className="h-10 gap-2 bg-white/15 text-white hover:bg-white/25 border border-white/25">
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {tr("Actualiser", "تحديث", "Refresh")}
            </Button>
            <Button onClick={exportCsv} disabled={loading || total === 0} className="h-10 gap-2 bg-white text-primary hover:bg-white/90 font-semibold">
              <Download className="h-4 w-4" />
              {tr("Exporter (Excel)", "تصدير (Excel)", "Export (Excel)")}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Indicateurs ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          tone="indigo"
          icon={<GraduationCap className="h-5 w-5" />}
          label={tr("Moyenne de la classe", "معدل القسم", "Class average")}
          value={<span dir="ltr" className={`inline-block ${noteColor(A.classNote20)}`}>{fmtNote(A.classNote20, language)}<span className="text-base text-muted-foreground font-bold"> /20</span></span>}
          hint={tr(`${A.evaluatedCount} élève(s) évalué(s)`, `${A.evaluatedCount} تلميذ مقيَّم`, `${A.evaluatedCount} assessed`)}
          progress={A.classAvgPct}
        />
        <StatCard
          tone="emerald"
          icon={<Target className="h-5 w-5" />}
          label={tr("Taux de réussite", "نسبة النجاح", "Pass rate")}
          value={pctTxt(A.successRate)}
          hint={tr("élèves avec une moyenne ≥ 10/20", "تلاميذ بمعدل ≥ 10/20", "students averaging ≥ 10/20")}
          progress={A.successRate}
        />
        <StatCard
          tone="blue"
          icon={<ListChecks className="h-5 w-5" />}
          label={tr("Participation aux quiz", "المشاركة في الاختبارات", "Quiz participation")}
          value={`${Math.round(A.participationRate)} %`}
          hint={tr("des copies attendues ont été rendues", "من الأوراق المنتظرة تم تسليمها", "of expected submissions")}
          progress={A.participationRate}
        />
        <StatCard
          tone="rose"
          icon={<HeartHandshake className="h-5 w-5" />}
          label={tr("À accompagner", "يحتاجون للدعم", "Need support")}
          value={A.toSupport.length}
          hint={tr("élèves avec au moins une alerte", "تلاميذ لديهم تنبيه واحد على الأقل", "students with alerts")}
          onClick={() => { setTab("ranking"); setLevelFilter("alerts"); }}
        />
        <StatCard
          tone="cyan"
          icon={<Clock className="h-5 w-5" />}
          label={tr("Temps d'étude moyen", "متوسط وقت الدراسة", "Avg study time")}
          value={formatMinutes(A.avgStudyMinutes)}
          hint={tr("par élève sur la période", "لكل تلميذ خلال الفترة", "per student in period")}
        />
        <StatCard
          tone="violet"
          icon={<Wifi className="h-5 w-5" />}
          label={tr("En ligne maintenant", "متصلون الآن", "Online now")}
          value={<span dir="ltr" className="inline-block">{A.onlineCount}<span className="text-base text-muted-foreground font-bold"> / {total}</span></span>}
          hint={tr("actualisé toutes les 30 s", "يُحدَّث كل 30 ثانية", "refreshed every 30 s")}
          aside={A.onlineCount > 0 ? <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" /></span> : undefined}
        />
      </div>

      {/* ── Onglets ── */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="h-auto flex-wrap gap-1 rounded-2xl bg-muted/60 p-1.5">
          <TabsTrigger value="overview" className="gap-2 rounded-xl px-4 py-2 data-[state=active]:shadow-md">
            <Sparkles className="h-4 w-4" />{tr("Vue d'ensemble", "نظرة عامة", "Overview")}
          </TabsTrigger>
          <TabsTrigger value="ranking" className="gap-2 rounded-xl px-4 py-2 data-[state=active]:shadow-md">
            <Trophy className="h-4 w-4" />{tr("Classement", "الترتيب", "Ranking")}
          </TabsTrigger>
          <TabsTrigger value="quizzes" className="gap-2 rounded-xl px-4 py-2 data-[state=active]:shadow-md">
            <FileQuestion className="h-4 w-4" />{tr("Analyse par quiz", "تحليل الاختبارات", "Quiz analysis")}
          </TabsTrigger>
        </TabsList>

        {loading ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">
            <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin" />
            {tr("Analyse des données de la classe…", "جارٍ تحليل بيانات القسم…", "Analysing class data…")}
          </CardContent></Card>
        ) : (
          <>
            {/* ═════════ VUE D'ENSEMBLE ═════════ */}
            <TabsContent value="overview" className="space-y-5 m-0">
              <div className="grid gap-5 lg:grid-cols-5">
                <Card className="lg:col-span-3">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2"><LineChart className="h-5 w-5 text-primary" />{tr("Évolution des résultats", "تطور النتائج", "Results over time")}</CardTitle>
                    <CardDescription>{tr("Moyenne de la classe et participation à chaque quiz (en %)", "معدل القسم والمشاركة في كل اختبار (%)", "Class average and participation per quiz (%)")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TrendChart
                      labels={quizLabels}
                      emptyLabel={tr("Aucun quiz sur la période", "لا توجد اختبارات في هذه الفترة", "No quiz in this period")}
                      series={[
                        { name: tr("Moyenne de la classe", "معدل القسم", "Class average"), color: "#4f46e5", values: A.quizzes.map(q => q.mean) },
                        { name: tr("Participation", "المشاركة", "Participation"), color: "#10b981", values: A.quizzes.map(q => q.participation), dashed: true },
                      ]}
                    />
                  </CardContent>
                </Card>
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />{tr("Répartition des niveaux", "توزيع المستويات", "Level distribution")}</CardTitle>
                    <CardDescription>{tr("Moyenne de chaque élève sur 20", "معدل كل تلميذ على 20", "Each student's average out of 20")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {A.evaluatedCount === 0
                      ? <Empty icon={<BarChart3 className="h-6 w-6" />} title={tr("Pas encore de résultats", "لا توجد نتائج بعد", "No results yet")} />
                      : <DistributionBars counts={A.distribution} labels={bucketLabels} total={A.evaluatedCount} />}
                    {total - A.evaluatedCount > 0 && (
                      <p className="mt-4 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                        {tr(`${total - A.evaluatedCount} élève(s) sans aucun quiz passé`, `${total - A.evaluatedCount} تلميذ بدون أي اختبار`, `${total - A.evaluatedCount} student(s) without any quiz`)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-5 lg:grid-cols-5">
                {/* Podium */}
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2"><Medal className="h-5 w-5 text-amber-500" />{tr("Meilleurs élèves", "أفضل التلاميذ", "Top students")}</CardTitle>
                    <CardDescription>{tr("Classement selon la moyenne aux quiz", "الترتيب حسب معدل الاختبارات", "Ranked by quiz average")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    {A.students.filter(s => s.rank !== null).slice(0, 5).map(s => (
                      <button key={s.student.id} onClick={() => setSelectedId(s.student.id)} className="flex w-full items-center gap-3 rounded-2xl border p-3 text-start transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                        <RankBadge rank={s.rank} />
                        <StudentCell s={s} />
                        <div className="ms-auto text-end">
                          <p className={`text-lg font-extrabold tabular-nums ${noteColor(s.note20)}`}>{fmtNote(s.note20, language)}</p>
                          <p className="text-[10px] text-muted-foreground">/20</p>
                        </div>
                      </button>
                    ))}
                    {A.evaluatedCount === 0 && <Empty icon={<Trophy className="h-6 w-6" />} title={tr("Classement disponible après le premier quiz", "الترتيب متاح بعد أول اختبار", "Ranking available after the first quiz")} />}
                  </CardContent>
                </Card>

                {/* À accompagner */}
                <Card className="lg:col-span-3">
                  <CardHeader className="pb-2 flex-row items-start justify-between space-y-0">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-rose-500" />{tr("Élèves à accompagner", "تلاميذ يحتاجون للدعم", "Students needing support")}</CardTitle>
                      <CardDescription className="mt-1.5">{tr("Priorisés selon la gravité : moyenne, participation, tendance, assiduité", "مرتبون حسب الأولوية: المعدل، المشاركة، التطور، المواظبة", "Prioritised by severity")}</CardDescription>
                    </div>
                    {A.toSupport.length > 6 && (
                      <Button variant="ghost" size="sm" onClick={() => { setTab("ranking"); setLevelFilter("alerts"); }} className="text-xs">
                        {tr("Tout voir", "عرض الكل", "See all")} ({A.toSupport.length})
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    {A.toSupport.length === 0 ? (
                      <Empty icon={<CheckCircle2 className="h-6 w-6 text-emerald-500" />} title={tr("Aucun élève en alerte", "لا يوجد تلميذ في وضعية تنبيه", "No student flagged")} desc={tr("Tous les élèves suivent bien. Bravo !", "جميع التلاميذ يسيرون بشكل جيد.", "Everyone is on track.")} />
                    ) : A.toSupport.slice(0, 6).map(s => (
                      <div key={s.student.id} className="flex flex-col gap-2 rounded-2xl border border-rose-500/15 bg-rose-500/[0.03] p-3 sm:flex-row sm:items-center">
                        <StudentCell s={s} />
                        <div className="flex flex-1 flex-wrap gap-1.5 sm:justify-end">
                          {s.alerts.map(a => (
                            <span key={a} className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${a === "low_average" || a === "no_quiz" ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300" : a === "declining" ? "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300" : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>
                              {alertLabel(a)}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 sm:ms-2">
                          <span className={`text-sm font-extrabold tabular-nums ${noteColor(s.note20)}`}>{fmtNote(s.note20, language)}{s.note20 !== null && <span className="text-[10px] text-muted-foreground">/20</span>}</span>
                          <Button size="sm" variant="outline" className="h-8 gap-1 rounded-lg" onClick={() => setSelectedId(s.student.id)}>
                            <Eye className="h-3.5 w-3.5" />{tr("Fiche", "البطاقة", "Profile")}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Questions les plus difficiles (toutes classes de quiz confondues) */}
              {(() => {
                const hard = A.quizzes
                  .flatMap(q => q.questions.map(x => ({ q, x })))
                  .filter(({ x }) => x.successRate !== null && x.answered >= 2)
                  .sort((a, b) => (a.x.successRate as number) - (b.x.successRate as number))
                  .slice(0, 5);
                if (!hard.length) return null;
                return (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2"><FileQuestion className="h-5 w-5 text-orange-500" />{tr("Notions à retravailler", "مفاهيم تحتاج إلى مراجعة", "Topics to revisit")}</CardTitle>
                      <CardDescription>{tr("Questions avec le plus faible taux de bonnes réponses", "الأسئلة ذات أدنى نسبة إجابات صحيحة", "Questions with the lowest success rate")}</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                      {hard.map(({ q, x }) => (
                        <div key={x.question.id} className="rounded-2xl border p-3.5 transition-shadow hover:shadow-md">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="truncate text-[11px] font-semibold text-muted-foreground">{q.quiz.title} · Q{x.question.question_order}</span>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${(x.successRate as number) < 50 ? "bg-rose-500/10 text-rose-600" : "bg-amber-500/10 text-amber-600"}`}>{Math.round(x.successRate as number)} %</span>
                          </div>
                          <p className="line-clamp-2 text-sm font-medium">{stripHtml(x.question.question) || "—"}</p>
                          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div className={`h-full rounded-full ${barColor(x.successRate)}`} style={{ width: `${x.successRate}%` }} />
                          </div>
                          <p className="mt-1.5 text-[11px] text-muted-foreground">{tr(`${x.correct} bonne(s) réponse(s) sur ${x.answered}`, `${x.correct} إجابة صحيحة من ${x.answered}`, `${x.correct} correct out of ${x.answered}`)}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })()}
            </TabsContent>

            {/* ═════════ CLASSEMENT ═════════ */}
            <TabsContent value="ranking" className="space-y-4 m-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={tr("Rechercher un élève…", "ابحث عن تلميذ…", "Search a student…")} className="h-10 rounded-xl ps-9" />
                </div>
                <Select value={levelFilter} onValueChange={v => setLevelFilter(v as any)}>
                  <SelectTrigger className="h-10 w-full rounded-xl sm:w-[220px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tr("Tous les niveaux", "جميع المستويات", "All levels")}</SelectItem>
                    <SelectItem value="alerts">{tr("⚠ À accompagner", "⚠ يحتاجون للدعم", "⚠ Need support")}</SelectItem>
                    <SelectItem value="excellent">{levelLabel("excellent")}</SelectItem>
                    <SelectItem value="good">{levelLabel("good")}</SelectItem>
                    <SelectItem value="progress">{levelLabel("progress")}</SelectItem>
                    <SelectItem value="struggling">{levelLabel("struggling")}</SelectItem>
                    <SelectItem value="none">{levelLabel("none")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {rows.length === 0 ? (
                <Card><CardContent className="p-0"><Empty icon={<UserX className="h-6 w-6" />} title={tr("Aucun élève trouvé", "لم يتم العثور على أي تلميذ", "No student found")} /></CardContent></Card>
              ) : (
                <Table className="min-w-[1020px]">
                  <TableHeader>
                    <TableRow>
                      <SortHead k="rank" className="w-16">{tr("Rang", "الرتبة", "Rank")}</SortHead>
                      <SortHead k="name">{tr("Élève", "التلميذ", "Student")}</SortHead>
                      <SortHead k="note">{tr("Moyenne /20", "المعدل /20", "Average /20")}</SortHead>
                      <SortHead k="participation">{tr("Quiz passés", "الاختبارات", "Quizzes")}</SortHead>
                      <SortHead k="success">{tr("Réussite", "النجاح", "Success")}</SortHead>
                      <SortHead k="trend">{tr("Progression", "التطور", "Trend")}</SortHead>
                      <SortHead k="study">{tr("Temps d'étude", "وقت الدراسة", "Study time")}</SortHead>
                      <SortHead k="lastSeen">{tr("Dernière activité", "آخر نشاط", "Last activity")}</SortHead>
                      <TableHead>{tr("Niveau", "المستوى", "Level")}</TableHead>
                      <TableHead className="text-end">{tr("Fiche", "البطاقة", "Profile")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map(s => (
                      <TableRow key={s.student.id} className="cursor-pointer" onClick={() => setSelectedId(s.student.id)}>
                        <TableCell><RankBadge rank={s.rank} /></TableCell>
                        <TableCell><StudentCell s={s} /></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <span className={`w-11 text-base font-extrabold tabular-nums ${noteColor(s.note20)}`}>{fmtNote(s.note20, language)}</span>
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                              <div className={`h-full rounded-full ${barColor(s.avgPct)}`} style={{ width: `${s.avgPct ?? 0}%` }} />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span dir="ltr" className="inline-block"><span className="font-semibold tabular-nums">{s.quizzesTaken}</span>
                          <span className="text-muted-foreground tabular-nums"> / {A.quizzes.length}</span></span>
                          <p className="text-[11px] text-muted-foreground">{Math.round(s.participation)} %</p>
                        </TableCell>
                        <TableCell className="tabular-nums">{pctTxt(s.successRate)}</TableCell>
                        <TableCell><TrendBadge s={s} /></TableCell>
                        <TableCell className="tabular-nums whitespace-nowrap">{formatMinutes(s.studyMinutes)}<p className="text-[11px] text-muted-foreground">{s.sessionsCount} {tr("session(s)", "جلسة", "session(s)")}</p></TableCell>
                        <TableCell className="whitespace-nowrap">
                          {s.online
                            ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600"><span className="h-2 w-2 rounded-full bg-emerald-500" />{tr("En ligne", "متصل", "Online")}</span>
                            : <span className="text-xs text-muted-foreground">{relative(s.lastSeen)}</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${LEVEL_STYLE[s.level]}`}>{levelLabel(s.level)}</span>
                            {s.alerts.length > 0 && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600"><AlertTriangle className="h-3 w-3" />{s.alerts.length} {tr("alerte(s)", "تنبيه", "alert(s)")}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-end">
                          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={e => { e.stopPropagation(); setSelectedId(s.student.id); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <p className="text-[11px] text-muted-foreground">
                {tr(
                  "Rang établi selon la moyenne aux quiz (dernière tentative de chaque quiz), puis la participation. Les élèves ex aequo partagent le même rang.",
                  "الترتيب حسب معدل الاختبارات (آخر محاولة لكل اختبار) ثم المشاركة. التلاميذ المتساوون يتقاسمون نفس الرتبة.",
                  "Rank based on quiz average (latest attempt per quiz), then participation. Ties share the same rank."
                )}
              </p>
            </TabsContent>

            {/* ═════════ ANALYSE PAR QUIZ ═════════ */}
            <TabsContent value="quizzes" className="space-y-4 m-0">
              {A.quizzes.length === 0 ? (
                <Card><CardContent className="p-0"><Empty icon={<FileQuestion className="h-6 w-6" />} title={tr("Aucun quiz pour cette classe", "لا توجد اختبارات لهذا القسم", "No quiz for this class")} desc={tr("Créez un quiz dans la page Examens pour voir son analyse ici.", "أنشئ اختباراً في صفحة الامتحانات لرؤية تحليله هنا.", "Create a quiz in the Exams page to see its analysis here.")} /></CardContent></Card>
              ) : [...A.quizzes].reverse().map((q: QuizAnalytics) => (
                <Card key={q.quiz.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <CardTitle className="text-lg truncate">{q.quiz.title}</CardTitle>
                        <CardDescription className="mt-1">{fmtDate(q.quiz.date)} · {tr(`${q.participants} copie(s) sur ${total}`, `${q.participants} ورقة من ${total}`, `${q.participants} of ${total} submitted`)}</CardDescription>
                      </div>
                      <div className="w-full md:w-64">
                        <div className="mb-1 flex justify-between text-[11px] text-muted-foreground"><span>{tr("Participation", "المشاركة", "Participation")}</span><span className="font-semibold tabular-nums text-foreground">{Math.round(q.participation)} %</span></div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500" style={{ width: `${q.participation}%` }} /></div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                      {[
                        { l: tr("Moyenne", "المعدل", "Mean"), v: q.mean === null ? "—" : `${fmtNote(q.mean / 5, language)}/20`, c: noteColor(q.mean === null ? null : q.mean / 5) },
                        { l: tr("Médiane", "الوسيط", "Median"), v: q.median === null ? "—" : `${fmtNote(q.median / 5, language)}/20`, c: "" },
                        { l: tr("Note min.", "أدنى نقطة", "Min"), v: q.min === null ? "—" : `${fmtNote(q.min / 5, language)}/20`, c: "text-rose-600" },
                        { l: tr("Note max.", "أعلى نقطة", "Max"), v: q.max === null ? "—" : `${fmtNote(q.max / 5, language)}/20`, c: "text-emerald-600" },
                        { l: tr("Réussite (≥ 50 %)", "النجاح (≥ 50%)", "Pass (≥ 50%)"), v: pctTxt(q.successRate), c: "" },
                        { l: tr("Durée moyenne", "متوسط المدة", "Avg time"), v: q.avgMinutes === null ? "—" : formatMinutes(q.avgMinutes), c: "" },
                      ].map((k, i) => (
                        <div key={i} className="rounded-xl border bg-muted/30 px-3 py-2.5">
                          <p className="text-[11px] font-medium text-muted-foreground">{k.l}</p>
                          <p className={`mt-0.5 text-base font-extrabold tabular-nums ${k.c}`}>{k.v}</p>
                        </div>
                      ))}
                    </div>

                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{tr("Répartition des notes", "توزيع النقط", "Score distribution")}</span>
                        <span className="flex gap-3">{q.distribution.map((c, i) => <span key={i} className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: BUCKET_COLORS[i] }} />{c}</span>)}</span>
                      </div>
                      <StackedBar counts={q.distribution} />
                    </div>

                    {q.questions.length > 0 && (
                      <div className="rounded-2xl border">
                        <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2.5">
                          <p className="text-xs font-bold">{tr("Taux de réussite par question", "نسبة النجاح لكل سؤال", "Success rate per question")}</p>
                          <p className="text-[11px] text-muted-foreground">{tr("en rouge : à retravailler", "بالأحمر: يحتاج إلى مراجعة", "red: needs review")}</p>
                        </div>
                        <div className="divide-y">
                          {q.questions.map(x => (
                            <div key={x.question.id} className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-4 py-2.5 sm:grid-cols-[2.5rem_1fr_12rem_3.5rem]">
                              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-xs font-bold">Q{x.question.question_order}</span>
                              <p className="truncate text-sm">{stripHtml(x.question.question) || "—"}</p>
                              <div className="hidden h-2 w-full overflow-hidden rounded-full bg-muted sm:block">
                                {x.successRate !== null && <div className={`h-full rounded-full ${barColor(x.successRate)}`} style={{ width: `${x.successRate}%` }} />}
                              </div>
                              <span className={`text-end text-sm font-bold tabular-nums ${x.successRate === null ? "text-muted-foreground" : x.successRate < 50 ? "text-rose-600" : "text-foreground"}`}>
                                {x.successRate === null ? (x.question.question_type === "short_answer" ? tr("libre", "حر", "open") : "—") : `${Math.round(x.successRate)} %`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* ═════════ FICHE ÉLÈVE ═════════ */}
      <Dialog open={!!selected} onOpenChange={o => !o && setSelectedId(null)}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0" dir={isRtl ? "rtl" : "ltr"}>
          {selected && (() => {
            const s = selected;
            const classByQuiz = new Map(A.quizzes.map(q => [q.quiz.id, q.mean]));
            const missed = A.quizzes.filter(q => !s.results.some(r => r.quiz.id === q.quiz.id));
            const appreciation = (() => {
              if (s.note20 === null) return tr("Aucun quiz passé pour le moment : il est conseillé de relancer l'élève.", "لم يجتز أي اختبار بعد: يُنصح بتحفيز التلميذ.", "No quiz taken yet: consider following up.");
              const parts: string[] = [];
              parts.push(
                s.note20 >= 14 ? tr("Excellents résultats", "نتائج ممتازة", "Excellent results")
                : s.note20 >= 12 ? tr("Bons résultats", "نتائج جيدة", "Good results")
                : s.note20 >= 10 ? tr("Résultats corrects mais fragiles", "نتائج مقبولة لكنها هشة", "Fair but fragile results")
                : s.note20 >= 8 ? tr("Résultats insuffisants", "نتائج غير كافية", "Insufficient results")
                : tr("Grandes difficultés", "صعوبات كبيرة", "Serious difficulties")
              );
              if (s.trend === "up") parts.push(tr("en nette progression", "في تحسن واضح", "clearly improving"));
              if (s.trend === "down") parts.push(tr("en baisse sur les derniers quiz", "في تراجع خلال الاختبارات الأخيرة", "declining recently"));
              if (s.participation < 50 && A.quizzes.length > 1) parts.push(tr("participation à renforcer", "مشاركة يجب تعزيزها", "participation to improve"));
              return parts.join(", ") + ".";
            })();
            return (
              <>
                <div className="relative overflow-hidden bg-gradient-to-br from-primary via-indigo-600 to-violet-600 p-6 text-white">
                  <div className="pointer-events-none absolute -top-16 -end-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
                  <DialogHeader className="relative space-y-0 text-start">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16 ring-4 ring-white/25">
                        <AvatarImage src={s.student.avatar_url || undefined} />
                        <AvatarFallback className="bg-white/20 text-lg font-bold text-white">{initials(s.student.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <DialogTitle className="truncate text-2xl font-extrabold">{s.student.name}</DialogTitle>
                        <DialogDescription className="truncate text-white/75">{s.student.email || s.student.username}</DialogDescription>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold">{levelLabel(s.level)}</span>
                          {s.rank !== null && <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold">{tr(`Rang ${s.rank} / ${A.evaluatedCount}`, `الرتبة ${s.rank} / ${A.evaluatedCount}`, `Rank ${s.rank} / ${A.evaluatedCount}`)}</span>}
                          {s.online && <span className="rounded-full bg-emerald-400/30 px-2.5 py-0.5 text-xs font-semibold">● {tr("En ligne", "متصل", "Online")}</span>}
                        </div>
                      </div>
                    </div>
                  </DialogHeader>
                </div>

                <div className="space-y-5 p-6">
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {[
                      { l: tr("Moyenne", "المعدل", "Average"), v: <span dir="ltr" className={`inline-block ${noteColor(s.note20)}`}>{fmtNote(s.note20, language)}<span className="text-xs text-muted-foreground">/20</span></span> },
                      { l: tr("Quiz passés", "الاختبارات", "Quizzes"), v: `${s.quizzesTaken} / ${A.quizzes.length}` },
                      { l: tr("Réussite", "النجاح", "Success"), v: pctTxt(s.successRate) },
                      { l: tr("Temps d'étude", "وقت الدراسة", "Study time"), v: formatMinutes(s.studyMinutes) },
                    ].map((k, i) => (
                      <div key={i} className="rounded-2xl border p-3">
                        <p className="text-[11px] font-medium text-muted-foreground">{k.l}</p>
                        <p className="mt-0.5 text-xl font-extrabold tabular-nums">{k.v}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border bg-muted/30 p-4">
                    <p className="mb-1 flex items-center gap-2 text-xs font-bold text-muted-foreground"><Sparkles className="h-3.5 w-3.5 text-primary" />{tr("Appréciation générée", "ملاحظة تلقائية", "Generated feedback")}</p>
                    <p className="text-sm font-medium">{appreciation}</p>
                    {s.alerts.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {s.alerts.map(a => <span key={a} className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:text-rose-300">{alertLabel(a)}</span>)}
                      </div>
                    )}
                  </div>

                  {s.results.length > 0 && (
                    <div className="rounded-2xl border p-4">
                      <p className="mb-2 text-sm font-bold">{tr("Évolution comparée à la classe", "التطور مقارنة بالقسم", "Progress vs class")}</p>
                      <TrendChart
                        height={180}
                        labels={s.results.map(r => r.quiz.title)}
                        emptyLabel=""
                        series={[
                          { name: s.student.name, color: "#4f46e5", values: s.results.map(r => r.pct) },
                          { name: tr("Moyenne de la classe", "معدل القسم", "Class average"), color: "#94a3b8", values: s.results.map(r => classByQuiz.get(r.quiz.id) ?? null), dashed: true },
                        ]}
                      />
                    </div>
                  )}

                  <div>
                    <p className="mb-2 text-sm font-bold">{tr("Détail des quiz", "تفاصيل الاختبارات", "Quiz details")}</p>
                    {s.results.length === 0 ? (
                      <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">{tr("Aucun résultat.", "لا توجد نتائج.", "No results.")}</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{tr("Quiz", "الاختبار", "Quiz")}</TableHead>
                            <TableHead>{tr("Date", "التاريخ", "Date")}</TableHead>
                            <TableHead>{tr("Score", "النتيجة", "Score")}</TableHead>
                            <TableHead>{tr("Note /20", "النقطة /20", "Grade /20")}</TableHead>
                            <TableHead>{tr("Classe", "القسم", "Class")}</TableHead>
                            <TableHead>{tr("Écart", "الفرق", "Gap")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...s.results].reverse().map(r => {
                            const cm = classByQuiz.get(r.quiz.id) ?? null;
                            const gap = cm === null ? null : (r.pct - cm) / 5;
                            return (
                              <TableRow key={r.quiz.id}>
                                <TableCell className="font-medium max-w-[180px] truncate">
                                  {r.quiz.title}
                                  {r.attempts > 1 && <span className="ms-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{r.attempts} {tr("tent.", "محاولات", "att.")}</span>}
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{fmtDate(r.submission.submitted_at)}</TableCell>
                                <TableCell className="tabular-nums"><span dir="ltr">{r.submission.score ?? 0} / {r.submission.total_points ?? 0}</span></TableCell>
                                <TableCell className={`font-extrabold tabular-nums ${noteColor(r.pct / 5)}`}>{fmtNote(r.pct / 5, language)}</TableCell>
                                <TableCell className="tabular-nums text-muted-foreground">{cm === null ? "—" : fmtNote(cm / 5, language)}</TableCell>
                                <TableCell>
                                  {gap === null ? "—" : (
                                    <span className={`inline-flex items-center gap-0.5 text-xs font-bold tabular-nums ${gap >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                      {gap >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                                      {gap >= 0 ? "+" : ""}{fmtNote(gap, language)}
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                    {missed.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                        <XCircle className="h-4 w-4 text-amber-600" />
                        <span className="font-semibold text-amber-700 dark:text-amber-300">{tr("Quiz non passés :", "اختبارات لم يجتزها:", "Missed quizzes:")}</span>
                        {missed.map(q => <span key={q.quiz.id} className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-800 dark:text-amber-200">{q.quiz.title}</span>)}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 text-xs text-muted-foreground sm:grid-cols-3">
                    <div className="flex items-center gap-2 rounded-xl bg-muted/40 p-3"><Users className="h-4 w-4" />{s.sessionsCount} {tr("session(s) de travail", "جلسة عمل", "work session(s)")}</div>
                    <div className="flex items-center gap-2 rounded-xl bg-muted/40 p-3"><Clock className="h-4 w-4" />{tr("Dernière activité :", "آخر نشاط:", "Last activity:")} {relative(s.lastSeen)}</div>
                    <div className="flex items-center gap-2 rounded-xl bg-muted/40 p-3"><Trophy className="h-4 w-4" />{tr("Meilleure note :", "أفضل نقطة:", "Best grade:")} {s.bestPct === null ? "—" : `${fmtNote(s.bestPct / 5, language)}/20`}</div>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentActivities;

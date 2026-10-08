import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Eye,
  FileQuestion,
  Hourglass,
  ListChecks,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Shuffle,
  Target,
  Timer,
  Trophy,
  UserX,
  Users,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  DEFAULT_QUIZ_SETTINGS,
  parseExamAvailability,
  parseQuestionText,
  type QuizSettings,
} from "@/contexts/CourseContext";
import { downloadBlob } from "@/lib/download";

/* ═══════════════════════════════ Types ═══════════════════════════════ */

interface CheatEvent {
  type: string;
  at: string;
  detail?: string;
  durationMs?: number;
  returnedAt?: string;
  counted?: boolean;
  question?: number;
}

interface Submission {
  id: string;
  student_id: string;
  score: number | null;
  total_points: number | null;
  time_taken_minutes: number | null;
  submitted_at: string;
  anti_cheat_events?: number | null;
  anti_cheat_log?: CheatEvent[] | null;
}

interface Student {
  id: string;
  name: string;
  email: string | null;
  username: string | null;
}

interface Question {
  id: string;
  question: string;
  question_order: number;
  question_type: string;
  points: number;
}

interface Option {
  id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean;
  option_order: number;
}

interface Answer {
  submission_id: string;
  question_id: string;
  is_correct: boolean | null;
  selected_option_id: string | null;
  text_answer: string | null;
}

interface Props {
  examId: string;
}

/* ═══════════════════════════════ Helpers ═══════════════════════════════ */

const pct = (score: number | null, total: number | null) => (total ? ((score || 0) / total) * 100 : 0);
const to20 = (p: number) => Math.round((p / 5) * 10) / 10;
const stripHtml = (html: string) => {
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || div.innerText || "").replace(/\s+/g, " ").trim();
};
const median = (values: number[]) => {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const exitDuration = (e: CheatEvent) => {
  if (typeof e.durationMs === "number") return e.durationMs;
  const m = /(\d+)\s*s/.exec(e.detail || ""); // anciens enregistrements : "45 s"
  return m ? parseInt(m[1], 10) * 1000 : 0;
};

/* ═══════════════════════════════ Composant ═══════════════════════════════ */

const QuizDetails = ({ examId }: Props) => {
  const { language } = useLanguage();
  const tr = useCallback(
    (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en),
    [language]
  );
  const locale = language === "ar" ? "ar-MA" : language === "fr" ? "fr-FR" : "en-GB";
  const num = (v: number, d = 1) => v.toLocaleString(locale, { maximumFractionDigits: d });
  const fmtDate = (iso?: string | null, withTime = true) =>
    iso
      ? new Date(iso).toLocaleString(locale, withTime
          ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
          : { day: "2-digit", month: "short", year: "numeric" })
      : "—";
  const fmtTime = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
  const fmtDur = (ms: number) => {
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s} s`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    if (m < 60) return `${m} min ${String(r).padStart(2, "0")} s`;
    return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exam, setExam] = useState<any>(null);
  const [settings, setSettings] = useState<QuizSettings>(DEFAULT_QUIZ_SETTINGS);
  const [courseTitle, setCourseTitle] = useState("");
  const [roomName, setRoomName] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [openRow, setOpenRow] = useState<string | null>(null);

  /* ───────────── Chargement ───────────── */

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: ex, error: exErr } = await supabase.from("exams").select("*").eq("id", examId).maybeSingle();
      if (exErr) throw exErr;
      if (!ex) throw new Error("not found");
      const parsed = parseExamAvailability(ex) as any;
      setExam(parsed);
      const s: QuizSettings = { ...DEFAULT_QUIZ_SETTINGS, ...(parsed.quiz_settings || {}) };
      if (parsed.quiz_mode === "sequential_timed") s.sequentialQuestions = true;
      setSettings(s);

      // Cours et classe → élèves concernés
      let roomId: string | null = null;
      if (ex.course_id) {
        const { data: course } = await supabase.from("courses").select("title, room_id").eq("id", ex.course_id).maybeSingle();
        setCourseTitle(course?.title || "");
        roomId = course?.room_id || null;
      }
      const studentMap = new Map<string, Student>();
      if (roomId) {
        const [{ data: room }, { data: byRoom }, { data: enr }] = await Promise.all([
          supabase.from("rooms").select("name").eq("id", roomId).maybeSingle(),
          supabase.from("profiles").select("id, name, email, username").eq("role", "student").eq("room_id", roomId),
          supabase.from("enrollments").select("student_id").eq("room_id", roomId),
        ]);
        setRoomName((room as any)?.name || "");
        (byRoom || []).forEach((p: any) => studentMap.set(p.id, p));
        const missing = (enr || []).map((e: any) => e.student_id).filter((id: string) => !studentMap.has(id));
        if (missing.length) {
          const { data: extra } = await supabase.from("profiles").select("id, name, email, username, role").in("id", missing);
          (extra || []).filter((p: any) => p.role === "student").forEach((p: any) => studentMap.set(p.id, p));
        }
      }

      // Soumissions, questions, options
      const [{ data: sData, error: sErr }, { data: qData }] = await Promise.all([
        supabase.from("quiz_submissions").select("*").eq("exam_id", examId).eq("is_completed", true).order("submitted_at", { ascending: true }),
        supabase.from("quiz_questions").select("id, question, question_order, question_type, points").eq("exam_id", examId).order("question_order", { ascending: true }),
      ]);
      if (sErr) throw sErr;
      const subList = (sData || []) as Submission[];
      const qList = (qData || []) as Question[];
      let oList: Option[] = [];
      if (qList.length) {
        const { data: oData } = await supabase
          .from("quiz_options")
          .select("id, question_id, option_text, is_correct, option_order")
          .in("question_id", qList.map((q) => q.id))
          .order("option_order", { ascending: true });
        oList = (oData || []) as Option[];
      }

      // Élèves ayant rendu le quiz sans être (plus) dans la classe
      const unknown = Array.from(new Set(subList.map((s) => s.student_id))).filter((id) => !studentMap.has(id));
      if (unknown.length) {
        const { data: extra } = await supabase.from("profiles").select("id, name, email, username").in("id", unknown);
        (extra || []).forEach((p: any) => studentMap.set(p.id, p));
      }

      // Réponses (par lots)
      const ans: Answer[] = [];
      const ids = subList.map((s) => s.id);
      for (let i = 0; i < ids.length; i += 150) {
        const { data: a } = await supabase
          .from("quiz_answers")
          .select("submission_id, question_id, is_correct, selected_option_id, text_answer")
          .in("submission_id", ids.slice(i, i + 150));
        ans.push(...((a || []) as Answer[]));
      }

      setStudents(Array.from(studentMap.values()).sort((a, b) => (a.name || "").localeCompare(b.name || "")));
      setSubs(subList);
      setQuestions(qList);
      setOptions(oList);
      setAnswers(ans);
    } catch (e) {
      console.error("QuizDetails load error:", e);
      setError(tr("Impossible de charger les détails du quiz.", "تعذر تحميل تفاصيل الاختبار.", "Unable to load quiz details."));
    } finally {
      setLoading(false);
    }
  }, [examId, tr]);

  useEffect(() => {
    load();
  }, [load]);

  /* ───────────── Calculs ───────────── */

  const totalPoints = useMemo(() => questions.reduce((s, q) => s + (q.points || 1), 0), [questions]);

  const rows = useMemo(() => {
    const byStudent = new Map<string, Submission[]>();
    subs.forEach((s) => {
      const l = byStudent.get(s.student_id) || [];
      l.push(s);
      byStudent.set(s.student_id, l);
    });
    const list = Array.from(byStudent.entries()).map(([studentId, attempts]) => {
      const sorted = [...attempts].sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime());
      const latest = sorted[sorted.length - 1];
      const best = sorted.reduce((b, s) => (pct(s.score, s.total_points) > pct(b.score, b.total_points) ? s : b), sorted[0]);
      const log = (latest.anti_cheat_log || []) as CheatEvent[];
      const exits = log.filter((e) => e.type === "left_quiz");
      const others = log.filter((e) => e.type !== "left_quiz");
      const awayMs = exits.reduce((s, e) => s + exitDuration(e), 0);
      const student = students.find((st) => st.id === studentId);
      return {
        studentId,
        name: student?.name || tr("Élève inconnu", "تلميذ غير معروف", "Unknown student"),
        email: student?.email || student?.username || "",
        latest,
        best,
        attempts: sorted.length,
        percent: pct(latest.score, latest.total_points),
        exits,
        others,
        awayMs,
        longestExit: exits.reduce((m, e) => Math.max(m, exitDuration(e)), 0),
        log,
      };
    });
    list.sort((a, b) => b.percent - a.percent || (a.latest.time_taken_minutes || 0) - (b.latest.time_taken_minutes || 0));
    return list.map((r, i) => ({ ...r, rank: i + 1 }));
  }, [subs, students, tr]);

  const notSubmitted = useMemo(
    () => students.filter((s) => !rows.some((r) => r.studentId === s.id)),
    [students, rows]
  );

  const stats = useMemo(() => {
    const p = rows.map((r) => r.percent);
    const times = rows.map((r) => r.latest.time_taken_minutes || 0).filter((t) => t > 0);
    const allExits = rows.flatMap((r) => r.exits);
    const incidentsByType: Record<string, number> = {};
    rows.forEach((r) => r.log.forEach((e) => { incidentsByType[e.type] = (incidentsByType[e.type] || 0) + 1; }));
    return {
      count: rows.length,
      enrolled: students.length,
      avg: p.length ? p.reduce((a, b) => a + b, 0) / p.length : 0,
      med: median(p),
      max: p.length ? Math.max(...p) : 0,
      min: p.length ? Math.min(...p) : 0,
      passRate: p.length ? (p.filter((v) => v >= 50).length / p.length) * 100 : 0,
      avgTime: times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0,
      studentsWithExits: rows.filter((r) => r.exits.length > 0).length,
      totalExits: allExits.length,
      totalAway: allExits.reduce((s, e) => s + exitDuration(e), 0),
      longestExit: allExits.reduce((m, e) => Math.max(m, exitDuration(e)), 0),
      studentsWithIncidents: rows.filter((r) => r.log.length > 0).length,
      incidentsByType,
    };
  }, [rows, students]);

  const buckets = useMemo(() => {
    const defs = [
      { label: "0 – 4,9", min: 0, max: 5 },
      { label: "5 – 9,9", min: 5, max: 10 },
      { label: "10 – 11,9", min: 10, max: 12 },
      { label: "12 – 13,9", min: 12, max: 14 },
      { label: "14 – 15,9", min: 14, max: 16 },
      { label: "16 – 20", min: 16, max: 20.01 },
    ];
    return defs.map((d) => ({ ...d, count: rows.filter((r) => to20(r.percent) >= d.min && to20(r.percent) < d.max).length }));
  }, [rows]);

  const questionStats = useMemo(() => {
    const latestIds = new Set(rows.map((r) => r.latest.id));
    const latestAnswers = answers.filter((a) => latestIds.has(a.submission_id));
    return questions.map((q, i) => {
      const qa = latestAnswers.filter((a) => a.question_id === q.id);
      const answered = qa.filter((a) => a.selected_option_id || (a.text_answer && a.text_answer.trim()));
      const correct = qa.filter((a) => a.is_correct).length;
      const opts = options.filter((o) => o.question_id === q.id);
      const optionCounts = opts.map((o) => ({
        ...o,
        count: qa.filter((a) => a.selected_option_id === o.id).length,
      }));
      return {
        q,
        index: i + 1,
        text: stripHtml(parseQuestionText(q.question).cleanText) || tr("(question sans texte)", "(سؤال بدون نص)", "(no text)"),
        timeLimit: parseQuestionText(q.question).timeLimitSeconds,
        total: rows.length,
        answered: answered.length,
        correct,
        rate: rows.length ? (correct / rows.length) * 100 : 0,
        optionCounts,
        textAnswers: q.question_type === "short_answer" ? qa.filter((a) => a.text_answer) : [],
      };
    });
  }, [questions, options, answers, rows, tr]);

  /* ───────────── Libellés ───────────── */

  const typeLabel = (t: string) =>
    t === "multiple_choice" ? tr("QCM", "اختيار من متعدد", "Multiple choice")
      : t === "true_false" ? tr("Vrai / Faux", "صحيح / خطأ", "True / False")
      : tr("Réponse libre", "إجابة حرة", "Short answer");

  const incidentLabel = (t: string) => {
    const map: Record<string, [string, string, string]> = {
      left_quiz: ["Sortie du quiz", "مغادرة الاختبار", "Left the quiz"],
      copy: ["Tentative de copie", "محاولة نسخ", "Copy attempt"],
      cut: ["Tentative de couper", "محاولة قص", "Cut attempt"],
      paste: ["Tentative de collage", "محاولة لصق", "Paste attempt"],
      drop: ["Glisser-déposer", "سحب وإفلات", "Drag & drop"],
      context_menu: ["Clic droit", "نقر أيمن", "Right-click"],
      shortcut: ["Raccourci clavier bloqué", "اختصار محظور", "Blocked shortcut"],
      screenshot_key: ["Touche capture d'écran", "زر لقطة الشاشة", "Screenshot key"],
      print: ["Tentative d'impression", "محاولة طباعة", "Print attempt"],
    };
    const v = map[t] || [t, t, t];
    return tr(v[0], v[1], v[2]);
  };

  const gradeTone = (p: number) =>
    p >= 80 ? "text-emerald-600 dark:text-emerald-400"
      : p >= 50 ? "text-sky-600 dark:text-sky-400"
      : "text-rose-600 dark:text-rose-400";

  /* ───────────── Export CSV ───────────── */

  const exportCsv = () => {
    const header = [
      tr("Rang", "الرتبة", "Rank"), tr("Élève", "التلميذ", "Student"), "Email",
      tr("Score", "النقطة", "Score"), "/20", "%", tr("Temps (min)", "الوقت (د)", "Time (min)"),
      tr("Tentatives", "المحاولات", "Attempts"), tr("Rendu le", "تاريخ الإرسال", "Submitted"),
      tr("Sorties", "المغادرات", "Exits"), tr("Temps hors quiz (s)", "الوقت خارج الاختبار (ث)", "Time away (s)"),
      tr("Plus longue sortie (s)", "أطول مغادرة (ث)", "Longest exit (s)"), tr("Autres incidents", "مخالفات أخرى", "Other incidents"),
    ];
    const lines = rows.map((r) => [
      r.rank, r.name, r.email, `${r.latest.score ?? 0}/${r.latest.total_points ?? totalPoints}`,
      num(to20(r.percent)), Math.round(r.percent), r.latest.time_taken_minutes ?? "", r.attempts,
      fmtDate(r.latest.submitted_at), r.exits.length, Math.round(r.awayMs / 1000), Math.round(r.longestExit / 1000),
      r.others.map((e) => incidentLabel(e.type)).join(" / "),
    ]);
    notSubmitted.forEach((s) => lines.push(["", s.name, s.email || s.username || "", tr("Non rendu", "لم يُرسل", "Not submitted"), "", "", "", 0, "", "", "", "", ""]));
    const csv = "﻿" + [header, ...lines].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const safe = (exam?.title || "quiz").replace(/[^\w-]+/g, "_");
    void downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `resultats-${safe}.csv`);
  };

  /* ═══════════════════════════════ Rendu ═══════════════════════════════ */

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        {tr("Chargement des résultats…", "جارٍ تحميل النتائج…", "Loading results…")}
      </div>
    );
  }
  if (error || !exam) {
    return (
      <div className="py-16 text-center space-y-3">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={load} className="gap-2"><RefreshCw className="h-4 w-4" />{tr("Réessayer", "إعادة المحاولة", "Retry")}</Button>
      </div>
    );
  }

  const now = Date.now();
  const from = exam.available_from || exam.exam_date;
  const until = exam.available_until;
  const status =
    from && now < new Date(from).getTime() ? { label: tr("Pas encore ouvert", "لم يُفتح بعد", "Not open yet"), cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300" }
      : until && now > new Date(until).getTime() ? { label: tr("Terminé", "منتهي", "Closed"), cls: "bg-muted text-muted-foreground" }
      : { label: tr("Ouvert", "مفتوح", "Open"), cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" };

  const participation = stats.enrolled ? (stats.count / stats.enrolled) * 100 : 0;
  const maxBucket = Math.max(1, ...buckets.map((b) => b.count));
  const description = (exam.description || "").replace(/<!--[\s\S]*?-->/g, "").trim();

  const Kpi = ({ icon: Icon, label, value, sub, tone }: { icon: any; label: string; value: string; sub?: string; tone?: string }) => (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className={`mt-1.5 text-2xl font-bold tabular-nums ${tone || "text-foreground"}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );

  const settingChips: { icon: any; label: string; on: boolean }[] = [
    { icon: ShieldCheck, label: settings.antiCheat ? tr(`Anti-triche (envoi auto après ${settings.maxFocusLosses || "∞"} sorties)`, `مكافحة الغش (إرسال تلقائي بعد ${settings.maxFocusLosses || "∞"} مغادرات)`, `Anti-cheat (auto-submit after ${settings.maxFocusLosses || "∞"} exits)`) : tr("Anti-triche désactivé", "مكافحة الغش معطلة", "Anti-cheat off"), on: settings.antiCheat },
    { icon: ListChecks, label: tr("Questions dans l'ordre imposé", "أسئلة متسلسلة", "Sequential questions"), on: settings.sequentialQuestions },
    { icon: Shuffle, label: tr("Questions mélangées", "أسئلة عشوائية", "Shuffled questions"), on: settings.shuffleQuestions },
    { icon: Shuffle, label: tr("Réponses mélangées", "خيارات عشوائية", "Shuffled options"), on: settings.shuffleOptions },
    { icon: RefreshCw, label: tr("Plusieurs tentatives", "عدة محاولات", "Multiple attempts"), on: settings.allowMultipleAttempts },
    { icon: Eye, label: tr("Note affichée à l'élève", "النقطة تظهر للتلميذ", "Score shown to student"), on: settings.showResultsImmediately },
    { icon: CheckCircle2, label: tr("Corrigé consultable", "التصحيح متاح", "Answer review"), on: settings.allowReview && settings.showResultsImmediately },
  ];

  return (
    <div className="space-y-5" dir={language === "ar" ? "rtl" : "ltr"}>
      {/* ───── En-tête ───── */}
      <div className="rounded-3xl border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Badge className="text-[10px]">Quiz</Badge>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${status.cls}`}>{status.label}</span>
              {!exam.is_visible && <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">{tr("Masqué", "مخفي", "Hidden")}</Badge>}
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold leading-tight">{exam.title}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {[courseTitle, roomName].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} className="gap-1.5 rounded-xl"><RefreshCw className="h-4 w-4" />{tr("Actualiser", "تحديث", "Refresh")}</Button>
            <Button size="sm" onClick={exportCsv} disabled={!rows.length} className="gap-1.5 rounded-xl"><Download className="h-4 w-4" />{tr("Exporter", "تصدير", "Export")}</Button>
          </div>
        </div>

        {description && <p className="mt-3 text-sm text-foreground/80 whitespace-pre-line">{description}</p>}

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="flex items-start gap-2"><CalendarClock className="h-4 w-4 mt-0.5 text-primary shrink-0" /><div><div className="text-xs text-muted-foreground">{tr("Ouverture", "الفتح", "Opens")}</div><div className="font-medium">{fmtDate(from)}</div></div></div>
          <div className="flex items-start gap-2"><Timer className="h-4 w-4 mt-0.5 text-rose-500 shrink-0" /><div><div className="text-xs text-muted-foreground">{tr("Fermeture", "الإغلاق", "Closes")}</div><div className="font-medium">{until ? fmtDate(until) : tr("Aucune", "بدون", "None")}</div></div></div>
          <div className="flex items-start gap-2"><Clock className="h-4 w-4 mt-0.5 text-primary shrink-0" /><div><div className="text-xs text-muted-foreground">{tr("Durée", "المدة", "Duration")}</div><div className="font-medium">{exam.duration_minutes ? `${exam.duration_minutes} min` : "—"}</div></div></div>
          <div className="flex items-start gap-2"><FileQuestion className="h-4 w-4 mt-0.5 text-primary shrink-0" /><div><div className="text-xs text-muted-foreground">{tr("Questions", "الأسئلة", "Questions")}</div><div className="font-medium">{questions.length} · {totalPoints} {tr("pts", "نقطة", "pts")}</div></div></div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {settingChips.map((c, i) => (
            <span key={i} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${c.on ? "bg-background text-foreground" : "bg-muted/40 text-muted-foreground line-through decoration-muted-foreground/40"}`}>
              <c.icon className="h-3 w-3" />{c.label}
            </span>
          ))}
        </div>
      </div>

      {/* ───── Indicateurs ───── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Users} label={tr("Participation", "المشاركة", "Participation")} value={`${stats.count}/${stats.enrolled || stats.count}`} sub={stats.enrolled ? `${Math.round(participation)} % ${tr("de la classe", "من القسم", "of the class")}` : undefined} />
        <Kpi icon={Target} label={tr("Moyenne", "المعدل", "Average")} value={stats.count ? `${num(to20(stats.avg))}/20` : "—"} sub={stats.count ? `${Math.round(stats.avg)} % · ${tr("médiane", "الوسيط", "median")} ${num(to20(stats.med))}/20` : undefined} tone={stats.count ? gradeTone(stats.avg) : undefined} />
        <Kpi icon={Trophy} label={tr("Réussite (≥ 10/20)", "النجاح (≥ 10/20)", "Pass rate (≥ 10/20)")} value={stats.count ? `${Math.round(stats.passRate)} %` : "—"} sub={stats.count ? `${tr("max", "الأعلى", "max")} ${num(to20(stats.max))} · ${tr("min", "الأدنى", "min")} ${num(to20(stats.min))}` : undefined} />
        <Kpi icon={LogOut} label={tr("Sorties du quiz", "مغادرات الاختبار", "Quiz exits")} value={String(stats.totalExits)} sub={`${stats.studentsWithExits} ${tr("élève(s) · hors quiz", "تلميذ · خارج الاختبار", "student(s) · away")} ${fmtDur(stats.totalAway)}`} tone={stats.totalExits ? "text-rose-600 dark:text-rose-400" : undefined} />
      </div>

      <Tabs defaultValue="students" className="w-full">
        <TabsList className="w-full sm:w-auto flex flex-wrap h-auto">
          <TabsTrigger value="students" className="gap-1.5"><Users className="h-4 w-4" />{tr("Élèves", "التلاميذ", "Students")}</TabsTrigger>
          <TabsTrigger value="questions" className="gap-1.5"><FileQuestion className="h-4 w-4" />{tr("Questions", "الأسئلة", "Questions")}</TabsTrigger>
          <TabsTrigger value="stats" className="gap-1.5"><BarChart3 className="h-4 w-4" />{tr("Statistiques", "الإحصائيات", "Statistics")}</TabsTrigger>
          <TabsTrigger value="integrity" className="gap-1.5"><ShieldAlert className="h-4 w-4" />{tr("Surveillance", "المراقبة", "Monitoring")}</TabsTrigger>
        </TabsList>

        {/* ═════ Élèves ═════ */}
        <TabsContent value="students" className="space-y-4 mt-4">
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              {tr("Aucun élève n'a encore rendu ce quiz.", "لم يُرسل أي تلميذ هذا الاختبار بعد.", "No student has submitted this quiz yet.")}
            </div>
          ) : (
            <div className="app-table-wrap" style={{ WebkitOverflowScrolling: "touch" }}>
              <table className="app-table w-full text-sm">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{tr("Élève", "التلميذ", "Student")}</th>
                    <th className="text-center">{tr("Note", "النقطة", "Grade")}</th>
                    <th className="text-center">{tr("Temps", "الوقت", "Time")}</th>
                    <th className="text-center">{tr("Sorties", "المغادرات", "Exits")}</th>
                    <th className="text-center">{tr("Hors quiz", "خارج الاختبار", "Away")}</th>
                    <th className="text-center">{tr("Incidents", "مخالفات", "Incidents")}</th>
                    <th>{tr("Rendu le", "أُرسل في", "Submitted")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const open = openRow === r.studentId;
                    return (
                      <Fragment key={r.studentId}>
                        <tr className="cursor-pointer" onClick={() => setOpenRow(open ? null : r.studentId)}>
                          <td className="font-semibold text-muted-foreground tabular-nums">{r.rank}</td>
                          <td>
                            <div className="font-semibold">{r.name}</div>
                            {r.email && <div className="text-xs text-muted-foreground">{r.email}</div>}
                          </td>
                          <td className="text-center">
                            <div className={`font-bold tabular-nums ${gradeTone(r.percent)}`}>{num(to20(r.percent))}/20</div>
                            <div className="text-xs text-muted-foreground tabular-nums">{r.latest.score ?? 0}/{r.latest.total_points ?? totalPoints} · {Math.round(r.percent)} %</div>
                          </td>
                          <td className="text-center tabular-nums">{r.latest.time_taken_minutes ?? "—"} min</td>
                          <td className="text-center">
                            {r.exits.length ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-bold text-rose-600 dark:text-rose-400"><LogOut className="h-3 w-3" />{r.exits.length}</span>
                            ) : (
                              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">0</span>
                            )}
                          </td>
                          <td className="text-center tabular-nums text-xs">{r.exits.length ? fmtDur(r.awayMs) : "—"}</td>
                          <td className="text-center">
                            {r.others.length ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300"><AlertTriangle className="h-3 w-3" />{r.others.length}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">0</span>
                            )}
                          </td>
                          <td className="text-xs whitespace-nowrap">
                            {fmtDate(r.latest.submitted_at)}
                            {r.attempts > 1 && <div className="text-muted-foreground">{r.attempts} {tr("tentatives", "محاولات", "attempts")}</div>}
                          </td>
                          <td><ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} /></td>
                        </tr>
                        {open && (
                          <tr>
                            <td colSpan={9} className="bg-muted/30">
                              <StudentTimeline
                                row={r}
                                tr={tr}
                                fmtTime={fmtTime}
                                fmtDur={fmtDur}
                                incidentLabel={incidentLabel}
                                num={num}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {notSubmitted.length > 0 && (
            <div className="rounded-2xl border bg-card p-4">
              <div className="flex items-center gap-2 font-semibold text-sm mb-2">
                <UserX className="h-4 w-4 text-muted-foreground" />
                {tr(`N'ont pas rendu le quiz (${notSubmitted.length})`, `لم يُرسلوا الاختبار (${notSubmitted.length})`, `Not submitted (${notSubmitted.length})`)}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {notSubmitted.map((s) => (
                  <span key={s.id} className="rounded-full border bg-muted/40 px-2.5 py-1 text-xs">{s.name}</span>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ═════ Questions ═════ */}
        <TabsContent value="questions" className="space-y-3 mt-4">
          {questionStats.length === 0 && (
            <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              {tr("Ce quiz ne contient aucune question.", "لا يحتوي هذا الاختبار على أسئلة.", "This quiz has no questions.")}
            </div>
          )}
          {questionStats.map((qs) => (
            <div key={qs.q.id} className="rounded-2xl border bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                    <span className="rounded-lg bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">Q{qs.index}</span>
                    <span className="rounded-lg border px-2 py-0.5 text-[11px] text-muted-foreground">{typeLabel(qs.q.question_type)}</span>
                    <span className="rounded-lg border px-2 py-0.5 text-[11px] text-muted-foreground">{qs.q.points || 1} {tr("pt", "نقطة", "pt")}</span>
                    {qs.timeLimit && <span className="rounded-lg border px-2 py-0.5 text-[11px] text-muted-foreground">{qs.timeLimit} s</span>}
                  </div>
                  <p className="text-sm font-medium leading-relaxed">{qs.text}</p>
                </div>
                <div className="text-end shrink-0">
                  <div className={`text-2xl font-bold tabular-nums ${qs.total ? gradeTone(qs.rate) : "text-muted-foreground"}`}>{qs.total ? `${Math.round(qs.rate)} %` : "—"}</div>
                  <div className="text-xs text-muted-foreground">{qs.correct}/{qs.total} {tr("bonnes réponses", "إجابات صحيحة", "correct")}</div>
                </div>
              </div>

              {qs.total > 0 && (
                <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden" title={`${Math.round(qs.rate)} %`}>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${qs.rate}%` }} />
                </div>
              )}

              {qs.optionCounts.length > 0 && qs.total > 0 && (
                <div className="mt-4 space-y-1.5">
                  {qs.optionCounts.map((o) => {
                    const share = qs.total ? (o.count / qs.total) * 100 : 0;
                    return (
                      <div key={o.id} className="flex items-center gap-2 text-xs" title={`${o.count} ${tr("élève(s)", "تلميذ", "student(s)")} · ${Math.round(share)} %`}>
                        <span className={`w-5 shrink-0 ${o.is_correct ? "text-emerald-600" : "text-muted-foreground"}`}>
                          {o.is_correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4 opacity-40" />}
                        </span>
                        <span className={`w-2/5 truncate ${o.is_correct ? "font-semibold" : ""}`}>{o.option_text}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${o.is_correct ? "bg-emerald-500" : "bg-muted-foreground/40"}`} style={{ width: `${share}%` }} />
                        </div>
                        <span className="w-14 text-end tabular-nums text-muted-foreground">{o.count} · {Math.round(share)}%</span>
                      </div>
                    );
                  })}
                  {qs.total - qs.answered > 0 && (
                    <div className="text-[11px] text-muted-foreground ps-7">{qs.total - qs.answered} {tr("sans réponse", "بدون إجابة", "unanswered")}</div>
                  )}
                </div>
              )}

              {qs.textAnswers.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-primary">{tr("Voir les réponses rédigées", "عرض الإجابات المكتوبة", "Show written answers")} ({qs.textAnswers.length})</summary>
                  <div className="mt-2 space-y-1.5">
                    {qs.textAnswers.map((a, i) => {
                      const r = rows.find((row) => row.latest.id === a.submission_id);
                      return (
                        <div key={i} className="rounded-lg border bg-muted/30 px-3 py-2 text-xs">
                          <span className="font-semibold">{r?.name || "—"}</span>
                          <span className={`ms-2 ${a.is_correct ? "text-emerald-600" : "text-rose-600"}`}>{a.is_correct ? "✓" : "✗"}</span>
                          <div className="mt-0.5 whitespace-pre-wrap text-foreground/80">{a.text_answer}</div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}
            </div>
          ))}
        </TabsContent>

        {/* ═════ Statistiques ═════ */}
        <TabsContent value="stats" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={Target} label={tr("Médiane", "الوسيط", "Median")} value={stats.count ? `${num(to20(stats.med))}/20` : "—"} />
            <Kpi icon={Trophy} label={tr("Meilleure note", "أعلى نقطة", "Best grade")} value={stats.count ? `${num(to20(stats.max))}/20` : "—"} />
            <Kpi icon={XCircle} label={tr("Note la plus basse", "أدنى نقطة", "Lowest grade")} value={stats.count ? `${num(to20(stats.min))}/20` : "—"} />
            <Kpi icon={Hourglass} label={tr("Temps moyen", "متوسط الوقت", "Average time")} value={stats.avgTime ? `${num(stats.avgTime)} min` : "—"} sub={exam.duration_minutes ? `${tr("sur", "من", "of")} ${exam.duration_minutes} min` : undefined} />
          </div>

          <div className="rounded-2xl border bg-card p-4 sm:p-5">
            <h3 className="font-semibold text-sm mb-1">{tr("Répartition des notes (/20)", "توزيع النقط (/20)", "Grade distribution (/20)")}</h3>
            <p className="text-xs text-muted-foreground mb-4">{tr("Nombre d'élèves par tranche de note", "عدد التلاميذ حسب فئة النقطة", "Number of students per grade band")}</p>
            {stats.count === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <div className="flex items-end gap-3 h-44" role="img" aria-label={tr("Histogramme des notes", "مدرج النقط", "Grade histogram")}>
                {buckets.map((b) => (
                  <div key={b.label} className="flex-1 flex flex-col items-center justify-end h-full" title={`${b.label} : ${b.count} ${tr("élève(s)", "تلميذ", "student(s)")}`}>
                    <span className="text-xs font-semibold tabular-nums mb-1">{b.count || ""}</span>
                    <div className="w-full max-w-[56px] rounded-t-md bg-primary" style={{ height: `${(b.count / maxBucket) * 100}%`, minHeight: b.count ? 4 : 0 }} />
                    <span className="mt-2 text-[10px] text-muted-foreground text-center leading-tight">{b.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-card p-4 sm:p-5">
            <h3 className="font-semibold text-sm mb-1">{tr("Taux de réussite par question", "نسبة النجاح حسب السؤال", "Success rate per question")}</h3>
            <p className="text-xs text-muted-foreground mb-4">{tr("Les questions les plus difficiles apparaissent en premier", "الأسئلة الأصعب تظهر أولاً", "Hardest questions first")}</p>
            <div className="space-y-2">
              {[...questionStats].sort((a, b) => a.rate - b.rate).map((qs) => (
                <div key={qs.q.id} className="flex items-center gap-3 text-xs" title={`Q${qs.index} : ${qs.correct}/${qs.total}`}>
                  <span className="w-9 font-bold">Q{qs.index}</span>
                  <span className="w-1/3 truncate text-muted-foreground">{qs.text}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${qs.rate}%` }} />
                  </div>
                  <span className="w-10 text-end tabular-nums font-semibold">{qs.total ? `${Math.round(qs.rate)}%` : "—"}</span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ═════ Surveillance ═════ */}
        <TabsContent value="integrity" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={LogOut} label={tr("Sorties au total", "مجموع المغادرات", "Total exits")} value={String(stats.totalExits)} sub={`${stats.studentsWithExits} ${tr("élève(s)", "تلميذ", "student(s)")}`} />
            <Kpi icon={Hourglass} label={tr("Temps total hors quiz", "مجموع الوقت خارج الاختبار", "Total time away")} value={fmtDur(stats.totalAway)} />
            <Kpi icon={Timer} label={tr("Plus longue sortie", "أطول مغادرة", "Longest exit")} value={stats.longestExit ? fmtDur(stats.longestExit) : "—"} />
            <Kpi icon={ShieldAlert} label={tr("Élèves avec incident", "تلاميذ لديهم مخالفات", "Students with incidents")} value={`${stats.studentsWithIncidents}/${stats.count}`} />
          </div>

          {Object.keys(stats.incidentsByType).length > 0 && (
            <div className="rounded-2xl border bg-card p-4">
              <h3 className="font-semibold text-sm mb-3">{tr("Incidents par type", "المخالفات حسب النوع", "Incidents by type")}</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.incidentsByType).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
                  <span key={t} className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs">
                    {t === "left_quiz" ? <LogOut className="h-3.5 w-3.5 text-rose-500" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                    {incidentLabel(t)} <b className="tabular-nums">×{n}</b>
                  </span>
                ))}
              </div>
            </div>
          )}

          {rows.filter((r) => r.log.length > 0).length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
              {tr("Aucun incident enregistré pour ce quiz.", "لم تُسجل أي مخالفة في هذا الاختبار.", "No incident recorded for this quiz.")}
            </div>
          ) : (
            rows
              .filter((r) => r.log.length > 0)
              .sort((a, b) => b.awayMs - a.awayMs || b.log.length - a.log.length)
              .map((r) => (
                <div key={r.studentId} className="rounded-2xl border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div>
                      <div className="font-semibold">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.exits.length} {tr("sortie(s)", "مغادرة", "exit(s)")} · {tr("hors quiz", "خارج الاختبار", "away")} {fmtDur(r.awayMs)} · {r.others.length} {tr("autre(s) incident(s)", "مخالفة أخرى", "other incident(s)")}
                      </div>
                    </div>
                    <div className={`font-bold tabular-nums ${gradeTone(r.percent)}`}>{num(to20(r.percent))}/20</div>
                  </div>
                  <StudentTimeline row={r} tr={tr} fmtTime={fmtTime} fmtDur={fmtDur} incidentLabel={incidentLabel} num={num} />
                </div>
              ))
          )}

          <p className="text-[11px] text-muted-foreground">
            {tr(
              "Une « sortie » = l'élève a quitté la page du quiz (autre onglet, autre application, écran verrouillé…). Les sorties de moins de 1,5 s sont affichées mais ne comptent pas pour l'envoi automatique. Les quiz rendus avant l'activation de la surveillance n'ont pas de données.",
              "« المغادرة » = غادر التلميذ صفحة الاختبار (صفحة أخرى، تطبيق آخر، قفل الشاشة…). المغادرات الأقل من 1,5 ث تُعرض لكنها لا تُحتسب للإرسال التلقائي.",
              "An “exit” = the student left the quiz page (another tab, another app, locked screen…). Exits under 1.5 s are shown but don't count toward auto-submit."
            )}
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
};

/* ───────────── Chronologie d'un élève ───────────── */

const StudentTimeline = ({
  row,
  tr,
  fmtTime,
  fmtDur,
  incidentLabel,
}: {
  row: { log: CheatEvent[]; exits: CheatEvent[]; awayMs: number; latest: Submission };
  tr: (fr: string, ar: string, en: string) => string;
  fmtTime: (iso?: string | null) => string;
  fmtDur: (ms: number) => string;
  incidentLabel: (t: string) => string;
  num: (v: number, d?: number) => string;
}) => {
  if (!row.log.length) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-emerald-600 dark:text-emerald-400">
        <ShieldCheck className="h-4 w-4" />
        {tr("Aucun incident : l'élève est resté sur le quiz du début à la fin.", "لا توجد مخالفات: بقي التلميذ في الاختبار من البداية إلى النهاية.", "No incident: the student stayed on the quiz the whole time.")}
      </div>
    );
  }
  const events = [...row.log].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  let exitNo = 0;
  return (
    <ol className="relative space-y-2 py-2 ps-5 before:absolute before:top-3 before:bottom-3 before:left-[7px] rtl:before:left-auto rtl:before:right-[7px] before:w-px before:bg-border">
      {events.map((e, i) => {
        const isExit = e.type === "left_quiz";
        if (isExit) exitNo += 1;
        const d = isExit ? (typeof e.durationMs === "number" ? e.durationMs : 0) : 0;
        return (
          <li key={i} className="relative text-xs">
            <span className={`absolute -left-5 rtl:left-auto rtl:-right-5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-2 ring-card ${isExit ? "bg-rose-500" : "bg-amber-500"}`} />
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono tabular-nums text-muted-foreground">{fmtTime(e.at)}</span>
              <span className="font-semibold">
                {isExit ? `${tr("Sortie", "مغادرة", "Exit")} ${exitNo}` : incidentLabel(e.type)}
              </span>
              {typeof e.question === "number" && (
                <span className="text-muted-foreground">· {tr("question", "السؤال", "question")} {e.question}</span>
              )}
              {isExit && (
                <span className={`rounded px-1.5 py-0.5 font-semibold ${d >= 30000 ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-muted text-foreground"}`}>
                  {d ? `${tr("absent", "غائب", "away")} ${fmtDur(d)}` : e.detail || ""}
                </span>
              )}
              {isExit && e.returnedAt && (
                <span className="text-muted-foreground">→ {tr("retour à", "عاد في", "back at")} {fmtTime(e.returnedAt)}</span>
              )}
              {isExit && !e.returnedAt && e.detail && typeof e.durationMs === "number" && (
                <span className="text-rose-600 dark:text-rose-400">{tr("non revenu avant l'envoi", "لم يعد قبل الإرسال", "did not come back before submission")}</span>
              )}
              {isExit && e.counted === false && (
                <span className="text-muted-foreground italic">({tr("< 1,5 s, non comptée", "< 1,5 ث، غير محتسبة", "< 1.5 s, not counted")})</span>
              )}
              {!isExit && e.detail && <span className="text-muted-foreground">{e.detail}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default QuizDetails;

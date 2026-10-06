/**
 * Moteur d'analyse pédagogique d'une classe : résultats aux quiz, classement,
 * progression, participation, élèves à accompagner et difficulté des questions.
 *
 * Toutes les fonctions sont pures (aucun accès réseau) pour être facilement testées.
 * Convention : pour chaque quiz, on retient la DERNIÈRE tentative de chaque élève.
 */

export interface AStudent {
  id: string;
  name: string;
  email?: string | null;
  username?: string | null;
  avatar_url?: string | null;
}

export interface AQuiz {
  id: string;
  title: string;
  /** Date de référence pour l'ordre chronologique */
  date: string;
  course_id?: string;
}

export interface ASubmission {
  id: string;
  exam_id: string;
  student_id: string;
  score: number | null;
  total_points: number | null;
  submitted_at: string;
  time_taken_minutes?: number | null;
}

export interface AQuestion {
  id: string;
  exam_id: string;
  question: string;
  question_order: number;
  points: number;
  question_type: string;
}

export interface AAnswer {
  submission_id: string;
  question_id: string;
  is_correct: boolean | null;
}

export interface ASession {
  student_id: string;
  session_start: string;
  last_activity: string;
  duration_minutes: number | null;
  is_active: boolean;
}

export type Level = "excellent" | "good" | "progress" | "struggling" | "none";
export type Trend = "up" | "down" | "stable" | "na";

export interface QuizResult {
  quiz: AQuiz;
  submission: ASubmission;
  pct: number;
  attempts: number;
}

export interface StudentAnalytics {
  student: AStudent;
  rank: number | null;
  results: QuizResult[]; // ordre chronologique
  quizzesTaken: number;
  participation: number; // 0–100
  avgPct: number | null; // moyenne des pourcentages
  note20: number | null; // moyenne sur 20
  successRate: number | null; // % de quiz ≥ 50 %
  bestPct: number | null;
  worstPct: number | null;
  trend: Trend;
  trendDelta: number | null; // points de % (récent – ancien)
  studyMinutes: number;
  sessionsCount: number;
  lastSeen: string | null;
  online: boolean;
  level: Level;
  alerts: AlertReason[];
}

export type AlertReason = "low_average" | "low_participation" | "declining" | "inactive" | "never_connected" | "no_quiz";

export interface QuestionStat {
  question: AQuestion;
  answered: number;
  correct: number;
  successRate: number | null;
}

export interface QuizAnalytics {
  quiz: AQuiz;
  participants: number;
  participation: number;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  successRate: number | null;
  avgMinutes: number | null;
  distribution: [number, number, number, number]; // [<8, 8–12, 12–14, ≥14] sur 20
  questions: QuestionStat[];
}

export interface ClassAnalytics {
  students: StudentAnalytics[]; // triés par rang
  quizzes: QuizAnalytics[]; // ordre chronologique
  classAvgPct: number | null;
  classNote20: number | null;
  participationRate: number;
  successRate: number | null; // % d'élèves évalués avec moyenne ≥ 10/20
  evaluatedCount: number;
  distribution: [number, number, number, number];
  toSupport: StudentAnalytics[];
  onlineCount: number;
  avgStudyMinutes: number;
}

const ONLINE_MS = 90 * 1000;
const INACTIVE_DAYS = 7;

export const pctOf = (s: { score: number | null; total_points: number | null }): number => {
  const total = s.total_points || 0;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, ((s.score || 0) / total) * 100));
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const levelOf = (note20: number | null): Level => {
  if (note20 === null) return "none";
  if (note20 >= 14) return "excellent";
  if (note20 >= 12) return "good";
  if (note20 >= 8) return "progress";
  return "struggling";
};

const bucketOf = (note20: number) => (note20 < 8 ? 0 : note20 < 12 ? 1 : note20 < 14 ? 2 : 3);

export function computeClassAnalytics(input: {
  students: AStudent[];
  quizzes: AQuiz[];
  submissions: ASubmission[];
  questions: AQuestion[];
  answers: AAnswer[];
  sessions: ASession[];
  activeSessions?: ASession[];
  now?: number;
}): ClassAnalytics {
  const now = input.now ?? Date.now();
  const studentIds = new Set(input.students.map(s => s.id));
  const quizzes = [...input.quizzes].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const quizById = new Map(quizzes.map(q => [q.id, q]));
  const subs = input.submissions.filter(s => studentIds.has(s.student_id) && quizById.has(s.exam_id));

  // Dernière tentative par (élève, quiz) + nombre de tentatives
  const latest = new Map<string, ASubmission>();
  const attempts = new Map<string, number>();
  for (const s of subs) {
    const key = `${s.student_id}|${s.exam_id}`;
    attempts.set(key, (attempts.get(key) || 0) + 1);
    const prev = latest.get(key);
    if (!prev || new Date(s.submitted_at) > new Date(prev.submitted_at)) latest.set(key, s);
  }
  const retainedIds = new Set(Array.from(latest.values()).map(s => s.id));

  // ── Par élève ──
  const totalQuizzes = quizzes.length;
  const onlineSet = new Set(
    (input.activeSessions || [])
      .filter(s => s.is_active && now - new Date(s.last_activity).getTime() < ONLINE_MS)
      .map(s => s.student_id)
  );

  const students: StudentAnalytics[] = input.students.map(student => {
    const results: QuizResult[] = [];
    for (const q of quizzes) {
      const s = latest.get(`${student.id}|${q.id}`);
      if (s) results.push({ quiz: q, submission: s, pct: pctOf(s), attempts: attempts.get(`${student.id}|${q.id}`) || 1 });
    }
    const pcts = results.map(r => r.pct);
    const avgPct = mean(pcts);
    const note20 = avgPct === null ? null : avgPct / 5;

    let trend: Trend = "na";
    let trendDelta: number | null = null;
    if (pcts.length >= 2) {
      const k = Math.min(2, Math.floor(pcts.length / 2)) || 1;
      const early = mean(pcts.slice(0, k))!;
      const recent = mean(pcts.slice(-k))!;
      trendDelta = recent - early;
      trend = trendDelta >= 5 ? "up" : trendDelta <= -5 ? "down" : "stable";
    }

    const stuSessions = input.sessions.filter(s => s.student_id === student.id);
    const studyMinutes = stuSessions.reduce((a, s) => a + (s.duration_minutes || 0), 0);
    const times = [
      ...stuSessions.map(s => new Date(s.last_activity).getTime()),
      ...results.map(r => new Date(r.submission.submitted_at).getTime()),
      ...(input.activeSessions || []).filter(s => s.student_id === student.id).map(s => new Date(s.last_activity).getTime()),
    ].filter(n => !isNaN(n));
    const lastSeen = times.length ? new Date(Math.max(...times)).toISOString() : null;

    const level = levelOf(note20);
    const participation = totalQuizzes > 0 ? (results.length / totalQuizzes) * 100 : 0;

    const alerts: AlertReason[] = [];
    if (note20 !== null && note20 < 10) alerts.push("low_average");
    if (totalQuizzes > 0 && results.length === 0) alerts.push("no_quiz");
    else if (totalQuizzes > 1 && participation < 50) alerts.push("low_participation");
    // Alerte seulement pour une baisse marquée (≥ 2 points sur 20)
    if (trendDelta !== null && trendDelta <= -10) alerts.push("declining");
    if (!lastSeen) alerts.push("never_connected");
    else if (now - new Date(lastSeen).getTime() > INACTIVE_DAYS * 86400000) alerts.push("inactive");

    return {
      student,
      rank: null,
      results,
      quizzesTaken: results.length,
      participation,
      avgPct,
      note20,
      successRate: results.length ? (results.filter(r => r.pct >= 50).length / results.length) * 100 : null,
      bestPct: pcts.length ? Math.max(...pcts) : null,
      worstPct: pcts.length ? Math.min(...pcts) : null,
      trend,
      trendDelta,
      studyMinutes,
      sessionsCount: stuSessions.length,
      lastSeen,
      online: onlineSet.has(student.id),
      level,
      alerts,
    };
  });

  // Classement : moyenne, puis participation, puis temps d'étude
  students.sort((a, b) => {
    if (a.note20 === null && b.note20 !== null) return 1;
    if (b.note20 === null && a.note20 !== null) return -1;
    if (a.note20 !== null && b.note20 !== null && Math.abs(b.note20 - a.note20) > 1e-9) return b.note20 - a.note20;
    if (b.participation !== a.participation) return b.participation - a.participation;
    if (b.studyMinutes !== a.studyMinutes) return b.studyMinutes - a.studyMinutes;
    return a.student.name.localeCompare(b.student.name);
  });
  let rank = 0;
  let prevNote: number | null = null;
  students.forEach((s, i) => {
    if (s.note20 === null) return;
    if (prevNote === null || Math.abs(s.note20 - prevNote) > 1e-9) rank = i + 1; // ex aequo = même rang
    prevNote = s.note20;
    s.rank = rank;
  });

  // ── Par quiz ──
  const answersBySub = new Map<string, AAnswer[]>();
  for (const a of input.answers) {
    if (!retainedIds.has(a.submission_id)) continue;
    const arr = answersBySub.get(a.submission_id) || [];
    arr.push(a);
    answersBySub.set(a.submission_id, arr);
  }

  const quizStats: QuizAnalytics[] = quizzes.map(q => {
    const qSubs = Array.from(latest.values()).filter(s => s.exam_id === q.id);
    const pcts = qSubs.map(pctOf);
    const dist: [number, number, number, number] = [0, 0, 0, 0];
    pcts.forEach(p => dist[bucketOf(p / 5)]++);
    const mins = qSubs.map(s => s.time_taken_minutes).filter((m): m is number => typeof m === "number" && m > 0);

    const qQuestions = input.questions.filter(x => x.exam_id === q.id).sort((a, b) => a.question_order - b.question_order);
    const questions: QuestionStat[] = qQuestions.map(question => {
      let answered = 0;
      let correct = 0;
      for (const s of qSubs) {
        const a = (answersBySub.get(s.id) || []).find(x => x.question_id === question.id);
        if (!a) continue;
        answered++;
        if (a.is_correct) correct++;
      }
      const gradable = question.question_type !== "short_answer";
      return { question, answered, correct, successRate: gradable && answered > 0 ? (correct / answered) * 100 : null };
    });

    return {
      quiz: q,
      participants: qSubs.length,
      participation: input.students.length ? (qSubs.length / input.students.length) * 100 : 0,
      mean: mean(pcts),
      median: median(pcts),
      min: pcts.length ? Math.min(...pcts) : null,
      max: pcts.length ? Math.max(...pcts) : null,
      successRate: pcts.length ? (pcts.filter(p => p >= 50).length / pcts.length) * 100 : null,
      avgMinutes: mean(mins),
      distribution: dist,
      questions,
    };
  });

  // ── Classe ──
  const evaluated = students.filter(s => s.note20 !== null);
  const classAvgPct = mean(evaluated.map(s => s.avgPct as number));
  const distribution: [number, number, number, number] = [0, 0, 0, 0];
  evaluated.forEach(s => distribution[bucketOf(s.note20 as number)]++);
  const participationRate = students.length && totalQuizzes
    ? (students.reduce((a, s) => a + s.quizzesTaken, 0) / (students.length * totalQuizzes)) * 100
    : 0;

  const severity = (s: StudentAnalytics) =>
    (s.alerts.includes("low_average") ? 4 : 0) +
    (s.alerts.includes("no_quiz") ? 3 : 0) +
    (s.alerts.includes("declining") ? 2 : 0) +
    (s.alerts.includes("low_participation") ? 2 : 0) +
    (s.alerts.includes("inactive") || s.alerts.includes("never_connected") ? 1 : 0);

  const toSupport = students
    .filter(s => s.alerts.length > 0)
    .sort((a, b) => severity(b) - severity(a) || (a.note20 ?? -1) - (b.note20 ?? -1));

  return {
    students,
    quizzes: quizStats,
    classAvgPct,
    classNote20: classAvgPct === null ? null : classAvgPct / 5,
    participationRate,
    successRate: evaluated.length ? (evaluated.filter(s => (s.note20 as number) >= 10).length / evaluated.length) * 100 : null,
    evaluatedCount: evaluated.length,
    distribution,
    toSupport,
    onlineCount: onlineSet.size,
    avgStudyMinutes: students.length ? students.reduce((a, s) => a + s.studyMinutes, 0) / students.length : 0,
  };
}

/** Formate une durée en minutes : « 45 min », « 2 h 05 ». */
export const formatMinutes = (m: number): string => {
  const mins = Math.round(m);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
};

/** Note sur 20 avec une décimale à la française (« 12,5 »). */
export const fmtNote = (n: number | null, lang: string): string => {
  if (n === null || isNaN(n)) return "—";
  const v = Math.round(n * 10) / 10;
  return lang === "en" ? v.toFixed(1) : v.toFixed(1).replace(".", ",");
};

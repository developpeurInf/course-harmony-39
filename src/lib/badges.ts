/** Badges de l'élève, calculés à partir de sa progression (rpc my_progress) */
export interface ProgressData {
  streak: number;
  active_days: number;
  quizzes: { id: string; exam_id: string; title: string; course: string | null; score: number; total: number; at: string }[];
  exercises_submitted: number;
  exercises_returned: { title: string; grade: number; max: number; at: string }[];
  courses_read: number;
  perfect_quizzes: number;
}

export interface Badge {
  id: string;
  icon: string;
  fr: string;
  ar: string;
  en: string;
  earned: boolean;
  progress: string;
}

export function computeBadges(p: ProgressData): Badge[] {
  const q = p.quizzes.length;
  const best = Math.max(0, ...p.quizzes.map((x) => (x.total > 0 ? x.score / x.total : 0)));
  const mk = (id: string, icon: string, fr: string, ar: string, en: string, value: number, goal: number): Badge => ({
    id, icon, fr, ar, en, earned: value >= goal, progress: `${Math.min(value, goal)}/${goal}`,
  });
  return [
    mk("first-quiz", "🎯", "Premier quiz", "أول اختبار", "First quiz", q, 1),
    mk("ten-quizzes", "📚", "10 quiz terminés", "10 اختبارات", "10 quizzes done", q, 10),
    mk("perfect", "🏆", "Sans faute", "بدون خطأ", "Perfect score", p.perfect_quizzes, 1),
    mk("streak-3", "🔥", "3 jours de suite", "3 أيام متتالية", "3-day streak", p.streak, 3),
    mk("streak-7", "⚡", "7 jours de suite", "7 أيام متتالية", "7-day streak", p.streak, 7),
    mk("reader", "📖", "5 chapitres lus", "5 فصول مقروءة", "5 chapters read", p.courses_read, 5),
    mk("worker", "✍️", "5 copies rendues", "5 أوراق مسلمة", "5 works handed in", p.exercises_submitted, 5),
    mk("above-avg", "⭐", "Une note ≥ 16/20", "نقطة ≥ 16/20", "A grade ≥ 16/20", Math.round(best * 20), 16),
  ];
}

/** Note sur 20 */
export const on20 = (score: number, total: number) => (total > 0 ? Math.round((score / total) * 200) / 10 : null);

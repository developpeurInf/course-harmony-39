import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Award,
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Timer,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  Lock,
  ListChecks,
  Shuffle,
  Sparkles,
  Trophy,
  Target,
  HelpCircle,
  Send,
  Loader2,
  Layers,
  MinusCircle,
  PenLine,
  ShieldAlert
} from "lucide-react";
import {
  useCourses,
  QuizQuestion,
  QuizOption,
  Exam,
  parseQuestionText,
  parseExamAvailability,
  QuizSettings,
  DEFAULT_QUIZ_SETTINGS
} from "@/contexts/CourseContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuizAntiCheat, type CheatEventType } from "@/hooks/useQuizAntiCheat";

interface QuizTakerProps {
  exam: Exam;
  onClose: () => void;
}

/* ─────────────────────────────── Types internes ─────────────────────────────── */

interface QuizItem {
  question: QuizQuestion;
  html: string;
  timeLimitSeconds: number | null;
  options: QuizOption[];
  /** QCM avec plusieurs bonnes réponses → sélection multiple */
  multi: boolean;
}

interface StudentAnswer {
  selected: string[];
  text: string;
}

interface QuestionResult {
  item: QuizItem;
  answer: StudentAnswer | undefined;
  isCorrect: boolean;
  earned: number;
  /** false pour les réponses libres (corrigées par l'enseignant) */
  gradable: boolean;
  answered: boolean;
}

type Phase = "loading" | "blocked" | "intro" | "running" | "result";

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/* ─────────────────────────────── Utilitaires ─────────────────────────────── */

/** Mélange équitable (Fisher–Yates) — sort(Math.random) est biaisé. */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const isTrueText = (t: string) => /^(true|vrai|صحيح)$/i.test((t || "").trim());
const isFalseText = (t: string) => /^(false|faux|خطأ)$/i.test((t || "").trim());

function isAnswered(item: QuizItem, ans?: StudentAnswer): boolean {
  if (!ans) return false;
  if (item.question.question_type === "short_answer") return ans.text.trim().length > 0;
  return ans.selected.length > 0;
}

function gradeQuestion(item: QuizItem, ans?: StudentAnswer): QuestionResult {
  const points = item.question.points || 1;
  const answered = isAnswered(item, ans);

  if (item.question.question_type === "short_answer") {
    return { item, answer: ans, isCorrect: false, earned: 0, gradable: false, answered };
  }

  const correctIds = item.options.filter(o => o.is_correct).map(o => o.id);
  if (correctIds.length === 0) {
    // Question mal configurée (aucune bonne réponse) : non notée automatiquement
    return { item, answer: ans, isCorrect: false, earned: 0, gradable: false, answered };
  }

  const selected = ans?.selected || [];
  const isCorrect =
    selected.length === correctIds.length && correctIds.every(id => selected.includes(id));

  return { item, answer: ans, isCorrect, earned: isCorrect ? points : 0, gradable: true, answered };
}

/* ─────────────────────────────── Composant ─────────────────────────────── */

const QuizTaker: React.FC<QuizTakerProps> = ({ exam, onClose }) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { submitQuiz } = useCourses();
  const isRtl = language === "ar";
  const tr = useCallback(
    (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en),
    [language]
  );

  const [phase, setPhase] = useState<Phase>("loading");
  const [settings, setSettings] = useState<QuizSettings>(DEFAULT_QUIZ_SETTINGS);
  const [examDescription, setExamDescription] = useState<string>("");
  const [durationMinutes, setDurationMinutes] = useState<number>(exam.duration_minutes || 30);

  // Questions telles que chargées (ordre enseignant) ; l'ordre affiché est recalculé à chaque tentative
  const [baseItems, setBaseItems] = useState<QuizItem[]>([]);
  const [items, setItems] = useState<QuizItem[]>([]);

  const [answers, setAnswers] = useState<Record<string, StudentAnswer>>({});
  const [locked, setLocked] = useState<Record<string, boolean>>({});
  const [index, setIndex] = useState(0);

  // Chronomètres basés sur des échéances absolues (précis même si l'onglet est en arrière-plan)
  const [deadline, setDeadline] = useState<number | null>(null);
  const [questionDeadline, setQuestionDeadline] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const startTimeRef = useRef<number>(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [results, setResults] = useState<QuestionResult[] | null>(null);
  const [finalScore, setFinalScore] = useState<{ score: number; total: number; minutes: number } | null>(null);
  const [previousSubmission, setPreviousSubmission] = useState<any>(null);
  const [attemptsCount, setAttemptsCount] = useState(0);
  const [showReview, setShowReview] = useState(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [autoReason, setAutoReason] = useState<"time" | "cheat" | null>(null);

  // Refs pour éviter les closures périmées dans les minuteurs
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const submittingRef = useRef(false);
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  const indexRef = useRef(index);
  indexRef.current = index;

  const isSequential = settings.sequentialQuestions;

  /* ───────────── Anti-triche ───────────── */

  const antiCheatOn = phase === "running" && settings.antiCheat !== false;
  const maxFocusLosses = typeof settings.maxFocusLosses === "number" ? settings.maxFocusLosses : 3;
  const submitRef = useRef<(auto?: boolean, reason?: "time" | "cheat") => void>(() => undefined);
  const lastBlockToastRef = useRef(0);
  const blockedMessage = (type: CheatEventType) => {
    switch (type) {
      case "copy":
      case "cut":
        return tr("La copie est désactivée pendant le quiz.", "النسخ معطل أثناء الاختبار.", "Copying is disabled during the quiz.");
      case "paste":
      case "drop":
        return tr("Le collage est désactivé : écrivez votre réponse vous-même.", "اللصق معطل: اكتب إجابتك بنفسك.", "Pasting is disabled: type your answer yourself.");
      case "screenshot_key":
        return tr("Capture d'écran détectée et signalée à l'enseignant.", "تم رصد لقطة شاشة وإبلاغ الأستاذ.", "Screenshot detected and reported to the teacher.");
      case "print":
        return tr("L'impression est désactivée pendant le quiz.", "الطباعة معطلة أثناء الاختبار.", "Printing is disabled during the quiz.");
      default:
        return tr("Action non autorisée pendant le quiz.", "إجراء غير مسموح به أثناء الاختبار.", "Action not allowed during the quiz.");
    }
  };
  const antiCheat = useQuizAntiCheat({
    active: antiCheatOn,
    maxFocusLosses,
    onBlocked: (type) => {
      // un seul message toutes les 2 s (évite une avalanche de notifications)
      const t = Date.now();
      if (t - lastBlockToastRef.current < 2000) return;
      lastBlockToastRef.current = t;
      toast.warning(blockedMessage(type));
    },
    onFocusLoss: () => undefined,
    onLimitReached: () => {
      toast.error(
        tr(
          "Vous avez quitté le quiz trop de fois : il a été envoyé automatiquement.",
          "غادرت الاختبار عدة مرات: تم إرساله تلقائياً.",
          "You left the quiz too many times: it was submitted automatically."
        )
      );
      submitRef.current(true, "cheat");
    },
  });
  const antiCheatRef = useRef(antiCheat);
  antiCheatRef.current = antiCheat;
  const totalPoints = useMemo(() => baseItems.reduce((s, it) => s + (it.question.points || 1), 0), [baseItems]);

  /* ───────────── Chargement ───────────── */

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setPhase("loading");
      try {
        // 1) Paramètres à jour, lus directement depuis la base (l'enseignant a pu les modifier)
        let parsed = parseExamAvailability(exam) as any;
        const { data: freshExam } = await supabase.from("exams").select("*").eq("id", exam.id).maybeSingle();
        if (freshExam) parsed = parseExamAvailability(freshExam) as any;
        const s: QuizSettings = { ...DEFAULT_QUIZ_SETTINGS, ...(parsed.quiz_settings || {}) };
        if (parsed.quiz_mode === "sequential_timed") s.sequentialQuestions = true;
        if (cancelled) return;
        setSettings(s);
        setExamDescription(parsed.description || "");
        setDurationMinutes(parsed.duration_minutes || exam.duration_minutes || 30);

        // 2) Tentatives précédentes
        let latest: any = null;
        if (user?.id) {
          const { data: subData } = await supabase
            .from("quiz_submissions")
            .select("*")
            .eq("exam_id", exam.id)
            .eq("student_id", user.id)
            .order("submitted_at", { ascending: false });
          if (subData && subData.length > 0) {
            latest = subData[0];
            if (!cancelled) {
              setPreviousSubmission(latest);
              setAttemptsCount(subData.length);
            }
          }
        }

        // 3) Questions + options
        const { data: qData } = await supabase
          .from("quiz_questions")
          .select("*")
          .eq("exam_id", exam.id)
          .order("question_order", { ascending: true });
        const qList = (qData || []) as QuizQuestion[];

        let oList: QuizOption[] = [];
        if (qList.length > 0) {
          const { data: oData } = await supabase
            .from("quiz_options")
            .select("*")
            .in("question_id", qList.map(q => q.id))
            .order("option_order", { ascending: true });
          oList = (oData || []) as QuizOption[];
        }

        const built: QuizItem[] = qList.map(q => {
          const { cleanText, timeLimitSeconds } = parseQuestionText(q.question);
          let opts = oList.filter(o => o.question_id === q.id);
          if (q.question_type === "true_false") {
            // Toujours « Vrai » puis « Faux »
            opts = [...opts].sort((a, b) => (isTrueText(a.option_text) ? -1 : isTrueText(b.option_text) ? 1 : 0));
          }
          const correctCount = opts.filter(o => o.is_correct).length;
          return {
            question: q,
            html: cleanText,
            timeLimitSeconds,
            options: opts,
            multi: q.question_type === "multiple_choice" && correctCount > 1
          };
        });

        if (cancelled) return;
        setBaseItems(built);
        setItems(built);
        setPhase(latest && !s.allowMultipleAttempts ? "blocked" : "intro");
      } catch (err) {
        console.error("Error loading quiz data:", err);
        if (!cancelled) {
          toast.error(tr("Impossible de charger le quiz.", "تعذر تحميل الاختبار.", "Unable to load the quiz."));
          setPhase("intro");
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam.id, user?.id]);

  /* ───────────── Démarrage d'une tentative ───────────── */

  const startQuiz = () => {
    let ordered = settings.shuffleQuestions ? shuffle(baseItems) : [...baseItems];
    if (settings.shuffleOptions) {
      ordered = ordered.map(it =>
        it.question.question_type === "multiple_choice" ? { ...it, options: shuffle(it.options) } : it
      );
    }
    setItems(ordered);
    setAnswers({});
    setLocked({});
    indexRef.current = 0;
    setIndex(0);
    setResults(null);
    setFinalScore(null);
    setShowReview(false);
    setAutoSubmitted(false);
    setAutoReason(null);
    antiCheatRef.current.reset();
    submittingRef.current = false;

    const start = Date.now();
    startTimeRef.current = start;
    setNow(start);
    setDeadline(durationMinutes > 0 ? start + durationMinutes * 60_000 : null);
    const first = ordered[0];
    setQuestionDeadline(isSequential && first?.timeLimitSeconds ? start + first.timeLimitSeconds * 1000 : null);
    setPhase("running");
  };

  /* ───────────── Horloge ───────────── */

  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [phase]);

  // Empêcher de quitter la page par erreur pendant le quiz
  useEffect(() => {
    if (phase !== "running") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  const timeLeft = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
  const questionTimeLeft = questionDeadline ? Math.max(0, Math.ceil((questionDeadline - now) / 1000)) : null;

  /* ───────────── Navigation & verrouillage ───────────── */

  const lockIfNeeded = useCallback(
    (idx: number) => {
      if (settings.allowCorrections) return;
      const it = itemsRef.current[idx];
      if (it && isAnswered(it, answersRef.current[it.question.id])) {
        setLocked(prev => ({ ...prev, [it.question.id]: true }));
      }
    },
    [settings.allowCorrections]
  );

  const goTo = useCallback(
    (target: number) => {
      const list = itemsRef.current;
      const current = indexRef.current;
      if (target < 0 || target >= list.length || target === current) return;
      lockIfNeeded(current);
      indexRef.current = target;
      setIndex(target);
      if (isSequential) {
        const it = list[target];
        setQuestionDeadline(it?.timeLimitSeconds ? Date.now() + it.timeLimitSeconds * 1000 : null);
      }
    },
    [isSequential, lockIfNeeded]
  );

  const goNext = () => goTo(index + 1);
  const goPrev = () => {
    if (isSequential) return;
    goTo(index - 1);
  };

  /* ───────────── Saisie des réponses ───────────── */

  const notifyLocked = () =>
    toast.info(
      tr(
        "Les corrections ne sont pas autorisées : cette réponse est définitive.",
        "غير مسموح بتعديل الإجابات: هذه الإجابة نهائية.",
        "Corrections are not allowed: this answer is final."
      )
    );

  const selectOption = (item: QuizItem, optionId: string) => {
    const qid = item.question.id;
    if (locked[qid]) {
      notifyLocked();
      return;
    }
    setAnswers(prev => {
      const current = prev[qid]?.selected || [];
      let selected: string[];
      if (item.multi) {
        selected = current.includes(optionId) ? current.filter(id => id !== optionId) : [...current, optionId];
      } else {
        selected = [optionId];
      }
      return { ...prev, [qid]: { selected, text: "" } };
    });
    // Choix unique sans correction autorisée → verrouillé immédiatement
    if (!settings.allowCorrections && !item.multi) {
      setLocked(prev => ({ ...prev, [qid]: true }));
    }
  };

  const setTextAnswer = (item: QuizItem, text: string) => {
    const qid = item.question.id;
    if (locked[qid]) return;
    // Anti-triche : un bloc de texte inséré d'un coup = collage (presse-papiers du clavier Android…)
    if (antiCheatOn) {
      const prevLen = (answersRef.current[qid]?.text || "").length;
      if (text.length - prevLen > 40) {
        antiCheatRef.current.recordSuspiciousInput(`+${text.length - prevLen} caractères`);
        return;
      }
    }
    setAnswers(prev => ({ ...prev, [qid]: { selected: [], text } }));
  };

  /* ───────────── Soumission ───────────── */

  const handleSubmit = useCallback(
    async (auto = false, reason: "time" | "cheat" = "time") => {
      if (submittingRef.current || phaseRef.current !== "running") return;
      if (!user) {
        toast.error(tr("Vous devez être connecté.", "يجب تسجيل الدخول.", "You must be logged in."));
        return;
      }
      submittingRef.current = true;
      setIsSubmitting(true);
      setConfirmOpen(false);

      const list = itemsRef.current;
      const ans = answersRef.current;
      const graded = list.map(it => gradeQuestion(it, ans[it.question.id]));
      const earned = graded.reduce((s, r) => s + r.earned, 0);
      const total = list.reduce((s, it) => s + (it.question.points || 1), 0);
      const minutes = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 60000));

      const answerRecords = graded.map(r => {
        const a = r.answer;
        const firstSel = a?.selected?.[0];
        let text: string | null = null;
        if (r.item.question.question_type === "short_answer") {
          text = a?.text?.trim() || null;
        } else if (r.item.multi && a && a.selected.length > 0) {
          // Sélection multiple : on garde la trace complète pour l'enseignant
          text = r.item.options
            .filter(o => a.selected.includes(o.id))
            .map(o => o.option_text)
            .join(" ; ");
        }
        return {
          question_id: r.item.question.id,
          selected_option_id: firstSel && UUID_RE.test(firstSel) ? firstSel : null,
          text_answer: text,
          is_correct: r.isCorrect,
          points_earned: r.earned
        };
      });

      try {
        const success = await submitQuiz(
          {
            student_id: user.id,
            exam_id: exam.id,
            score: earned,
            total_points: total,
            time_taken_minutes: minutes,
            is_completed: true,
            ...(() => {
              const events = antiCheatRef.current.getEvents();
              return events.length > 0 ? { anti_cheat_events: events.length, anti_cheat_log: events } : {};
            })()
          } as any,
          answerRecords as any
        );

        if (success) {
          setResults(graded);
          setFinalScore({ score: earned, total, minutes });
          setPreviousSubmission({ score: earned, total_points: total, submitted_at: new Date().toISOString() });
          setAttemptsCount(c => c + 1);
          setAutoSubmitted(auto);
          setAutoReason(auto ? reason : null);
          setDeadline(null);
          setQuestionDeadline(null);
          setPhase("result");
          toast.success(tr("Quiz envoyé avec succès", "تم إرسال الاختبار بنجاح", "Quiz submitted successfully"));
        } else {
          submittingRef.current = false;
        }
      } catch (err) {
        console.error("Error submitting quiz:", err);
        toast.error(tr("Échec de l'envoi du quiz", "فشل إرسال الاختبار", "Failed to submit quiz"));
        submittingRef.current = false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [user, exam.id, submitQuiz, tr]
  );
  submitRef.current = (auto = false, reason: "time" | "cheat" = "time") => {
    void handleSubmit(auto, reason);
  };

  // Fin du temps global → envoi automatique
  useEffect(() => {
    if (phase === "running" && timeLeft === 0) {
      toast.warning(tr("Temps écoulé ! Envoi automatique…", "انتهى الوقت! جارٍ الإرسال التلقائي…", "Time is up! Submitting…"));
      handleSubmit(true);
    }
  }, [phase, timeLeft, handleSubmit, tr]);

  // Fin du temps d'une question (mode séquentiel) → question suivante ou envoi
  const expiredRef = useRef<string | null>(null);
  useEffect(() => {
    if (phase !== "running" || !isSequential || questionTimeLeft !== 0) return;
    const key = `${index}-${questionDeadline}`;
    if (expiredRef.current === key) return;
    expiredRef.current = key;
    if (index < items.length - 1) {
      goTo(index + 1);
    } else {
      handleSubmit(true);
    }
  }, [phase, isSequential, questionTimeLeft, index, items.length, questionDeadline, goTo, handleSubmit]);

  /* ───────────── Raccourcis clavier ───────────── */

  useEffect(() => {
    if (phase !== "running") return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable)) return;
      if (confirmOpen) return;
      const it = items[index];
      if (!it) return;
      const key = e.key.toLowerCase();
      const letterIdx = "abcdefgh".indexOf(key);
      const numIdx = "12345678".indexOf(key);
      const optIdx = letterIdx >= 0 ? letterIdx : numIdx;
      if (optIdx >= 0 && it.question.question_type !== "short_answer" && it.options[optIdx]) {
        e.preventDefault();
        selectOption(it, it.options[optIdx].id);
      } else if (e.key === "Enter" && index < items.length - 1) {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ───────────── Helpers d'affichage ───────────── */

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const optionLabel = (opt: QuizOption) => {
    if (isTrueText(opt.option_text)) return tr("Vrai", "صحيح", "True");
    if (isFalseText(opt.option_text)) return tr("Faux", "خطأ", "False");
    return opt.option_text;
  };

  const mention = (pct: number) => {
    if (pct >= 90) return { label: tr("Excellent !", "ممتاز!", "Excellent!"), color: "text-emerald-600", ring: "#059669" };
    if (pct >= 75) return { label: tr("Très bien", "جيد جداً", "Very good"), color: "text-sky-600", ring: "#0284c7" };
    if (pct >= 60) return { label: tr("Bien", "جيد", "Good"), color: "text-indigo-600", ring: "#4f46e5" };
    if (pct >= 50) return { label: tr("Passable", "مقبول", "Fair"), color: "text-amber-600", ring: "#d97706" };
    return { label: tr("À retravailler", "يحتاج إلى مراجعة", "Needs work"), color: "text-rose-600", ring: "#e11d48" };
  };

  const unansweredCount = items.filter(it => !isAnswered(it, answers[it.question.id])).length;
  const answeredCount = items.length - unansweredCount;

  /* ═══════════════════════════════ RENDU ═══════════════════════════════ */

  // ─── Chargement ───
  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4" dir={isRtl ? "rtl" : "ltr"}>
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-4 border-primary/15" />
          <Loader2 className="h-16 w-16 text-primary animate-spin absolute inset-0" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          {tr("Préparation de votre quiz…", "جارٍ تحضير الاختبار…", "Preparing your quiz…")}
        </p>
      </div>
    );
  }

  // ─── Déjà passé, nouvelle tentative interdite ───
  if (phase === "blocked") {
    const sc = previousSubmission?.score ?? 0;
    const tot = previousSubmission?.total_points ?? totalPoints;
    const pct = tot > 0 ? Math.round((sc / tot) * 100) : 0;
    return (
      <div className="max-w-xl mx-auto animate-in fade-in zoom-in-95 duration-300" dir={isRtl ? "rtl" : "ltr"}>
        <div className="rounded-3xl border bg-card shadow-xl overflow-hidden">
          <div className="bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 p-8 text-center text-white">
            <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center">
              <Lock className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold">{tr("Quiz déjà passé", "تم اجتياز الاختبار", "Quiz already taken")}</h2>
            <p className="mt-2 text-sm text-white/70">
              {tr(
                "Une seule tentative est autorisée pour ce quiz.",
                "يُسمح بمحاولة واحدة فقط لهذا الاختبار.",
                "Only one attempt is allowed for this quiz."
              )}
            </p>
          </div>
          <div className="p-6 space-y-5 text-center">
            {settings.showResultsImmediately ? (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                  {tr("Votre note", "نقطتك", "Your score")}
                </p>
                <p className="text-4xl font-extrabold tabular-nums">
                  {sc}
                  <span className="text-xl text-muted-foreground font-semibold"> / {tot}</span>
                </p>
                <p className={`text-sm font-semibold ${mention(pct).color}`}>
                  {pct}% · {mention(pct).label}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {tr(
                  "Votre copie a été enregistrée. La note sera communiquée par votre enseignant.",
                  "تم حفظ ورقتك. سيتم إعلان النقطة من طرف الأستاذ.",
                  "Your answers were saved. Your teacher will publish the score."
                )}
              </p>
            )}
            <Button onClick={onClose} className="w-full h-11 rounded-xl font-semibold">
              {tr("Fermer", "إغلاق", "Close")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Écran d'accueil ───
  if (phase === "intro") {
    const timedCount = items.filter(it => it.timeLimitSeconds).length;
    const rules: { icon: React.ReactNode; text: string }[] = [
      isSequential
        ? {
            icon: <Layers className="h-4 w-4" />,
            text: tr(
              "Mode séquentiel : les questions s'enchaînent, impossible de revenir en arrière.",
              "الوضع المتسلسل: الأسئلة متتالية ولا يمكن الرجوع إلى الخلف.",
              "Sequential mode: you cannot go back to previous questions."
            )
          }
        : {
            icon: <ListChecks className="h-4 w-4" />,
            text: tr(
              "Navigation libre : vous pouvez revenir sur n'importe quelle question.",
              "تنقل حر: يمكنك الرجوع إلى أي سؤال.",
              "Free navigation: you can revisit any question."
            )
          },
      ...(isSequential && timedCount > 0
        ? [
            {
              icon: <Timer className="h-4 w-4" />,
              text: tr(
                "Certaines questions sont chronométrées : à la fin du temps, on passe automatiquement à la suivante.",
                "بعض الأسئلة موقوتة: عند انتهاء الوقت يتم الانتقال تلقائياً للسؤال التالي.",
                "Some questions are timed: when time runs out, you move on automatically."
              )
            }
          ]
        : []),
      settings.allowCorrections
        ? {
            icon: <PenLine className="h-4 w-4" />,
            text: tr(
              "Vous pouvez modifier vos réponses jusqu'à l'envoi.",
              "يمكنك تعديل إجاباتك قبل الإرسال.",
              "You can change your answers until you submit."
            )
          }
        : {
            icon: <Lock className="h-4 w-4" />,
            text: tr(
              "Réponses définitives : une réponse choisie ne peut plus être modifiée.",
              "إجابات نهائية: لا يمكن تعديل الإجابة بعد اختيارها.",
              "Final answers: once chosen, an answer cannot be changed."
            )
          },
      ...(settings.shuffleQuestions || settings.shuffleOptions
        ? [
            {
              icon: <Shuffle className="h-4 w-4" />,
              text: tr(
                "L'ordre des questions et/ou des réponses est aléatoire.",
                "ترتيب الأسئلة و/أو الأجوبة عشوائي.",
                "Question and/or answer order is randomized."
              )
            }
          ]
        : []),
      {
        icon: <Send className="h-4 w-4" />,
        text: tr(
          "Le quiz est envoyé automatiquement à la fin du temps.",
          "يُرسل الاختبار تلقائياً عند انتهاء الوقت.",
          "The quiz is submitted automatically when time runs out."
        )
      }
    ];

    const stats = [
      { icon: <HelpCircle className="h-5 w-5" />, value: items.length, label: tr("Questions", "أسئلة", "Questions"), tone: "from-sky-500/15 to-sky-500/5 text-sky-600" },
      { icon: <Target className="h-5 w-5" />, value: totalPoints, label: tr("Points", "نقاط", "Points"), tone: "from-violet-500/15 to-violet-500/5 text-violet-600" },
      { icon: <Clock className="h-5 w-5" />, value: `${durationMinutes}`, label: tr("Minutes", "دقيقة", "Minutes"), tone: "from-amber-500/15 to-amber-500/5 text-amber-600" },
      {
        icon: <RefreshCw className="h-5 w-5" />,
        value: settings.allowMultipleAttempts ? "∞" : "1",
        label: tr("Tentative(s)", "محاولة", "Attempt(s)"),
        tone: "from-emerald-500/15 to-emerald-500/5 text-emerald-600"
      }
    ];

    return (
      <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300" dir={isRtl ? "rtl" : "ltr"}>
        <div className="rounded-3xl border bg-card shadow-xl overflow-hidden">
          {/* Bandeau */}
          <div className="relative overflow-hidden bg-gradient-to-br from-primary to-primary/80 px-6 py-8 sm:px-8 text-primary-foreground">
            <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-fuchsia-400/20 blur-2xl" />
            <div className="relative flex items-start gap-4">
              <div className="h-14 w-14 shrink-0 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/25">
                <Sparkles className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.18em] font-semibold text-primary-foreground/70">
                  {tr("Quiz", "اختبار", "Quiz")}
                </p>
                <h2 className="text-2xl sm:text-3xl font-extrabold leading-tight break-words">{exam.title}</h2>
                {examDescription && (
                  <p className="mt-2 text-sm text-primary-foreground/80 line-clamp-3 whitespace-pre-line">{examDescription}</p>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Statistiques */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {stats.map((s, i) => (
                <div key={i} className={`rounded-2xl bg-gradient-to-br ${s.tone} p-4 border border-border/60`}>
                  <div className="flex items-center justify-between">
                    {s.icon}
                    <span className="text-2xl font-extrabold text-foreground tabular-nums">{s.value}</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Tentative précédente */}
            {previousSubmission && (
              <div className="flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 dark:bg-sky-950/30 dark:border-sky-900 p-4">
                <div className="h-10 w-10 rounded-xl bg-sky-500/15 text-sky-600 flex items-center justify-center shrink-0">
                  <Trophy className="h-5 w-5" />
                </div>
                <div className="flex-1 text-sm">
                  <p className="font-semibold text-sky-900 dark:text-sky-200">
                    {tr(`Tentative n° ${attemptsCount + 1}`, `المحاولة رقم ${attemptsCount + 1}`, `Attempt #${attemptsCount + 1}`)}
                  </p>
                  <p className="text-sky-800/80 dark:text-sky-300/80 text-xs">
                    {settings.showResultsImmediately
                      ? tr(
                          `Dernière note : ${previousSubmission.score} / ${previousSubmission.total_points} pts`,
                          `آخر نقطة: ${previousSubmission.score} / ${previousSubmission.total_points}`,
                          `Last score: ${previousSubmission.score} / ${previousSubmission.total_points} pts`
                        )
                      : tr("Votre tentative précédente a été enregistrée.", "تم حفظ محاولتك السابقة.", "Your previous attempt was saved.")}
                  </p>
                </div>
              </div>
            )}

            {/* Consignes */}
            <div className="rounded-2xl border bg-muted/30 p-5">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" />
                {tr("Consignes", "التعليمات", "Instructions")}
              </h3>
              <ul className="space-y-2.5">
                {rules.map((r, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <span className="mt-0.5 h-7 w-7 shrink-0 rounded-lg bg-background border flex items-center justify-center text-primary">
                      {r.icon}
                    </span>
                    <span className="pt-1">{r.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {items.length === 0 ? (
              <div className="flex items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                {tr(
                  "Ce quiz ne contient encore aucune question.",
                  "هذا الاختبار لا يحتوي على أي سؤال بعد.",
                  "This quiz has no questions yet."
                )}
              </div>
            ) : null}

            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <Button variant="outline" onClick={onClose} className="h-12 rounded-xl px-6">
                {tr("Annuler", "إلغاء", "Cancel")}
              </Button>
              <Button
                onClick={startQuiz}
                disabled={items.length === 0}
                className="h-12 rounded-xl px-8 text-base font-bold bg-primary hover:opacity-95 shadow-lg shadow-primary/25 gap-2"
              >
                {tr("Commencer le quiz", "ابدأ الاختبار", "Start quiz")}
                <ArrowRight className={`h-5 w-5 ${isRtl ? "rotate-180" : ""}`} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Résultat ───
  if (phase === "result" && finalScore) {
    const pct = finalScore.total > 0 ? Math.round((finalScore.score / finalScore.total) * 100) : 0;
    const m = mention(pct);
    const graded = results || [];
    const correct = graded.filter(r => r.gradable && r.isCorrect).length;
    const wrong = graded.filter(r => r.gradable && r.answered && !r.isCorrect).length;
    const empty = graded.filter(r => !r.answered).length;
    const pending = graded.filter(r => !r.gradable && r.answered).length;
    const R = 54;
    const C = 2 * Math.PI * R;
    // La correction détaillée révèle la note : elle n'est proposée que si les résultats sont visibles
    const canReview = settings.allowReview && settings.showResultsImmediately;

    return (
      <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in zoom-in-95 duration-300" dir={isRtl ? "rtl" : "ltr"}>
        <div className="rounded-3xl border bg-card shadow-xl overflow-hidden">
          <div className="relative overflow-hidden bg-gradient-to-br from-primary to-primary/80 px-6 pt-8 pb-24 text-center text-primary-foreground">
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
            <h2 className="relative text-2xl sm:text-3xl font-extrabold">
              {tr("Quiz terminé !", "انتهى الاختبار!", "Quiz complete!")}
            </h2>
            <p className="relative mt-1 text-sm text-primary-foreground/75">
              {autoSubmitted && autoReason === "cheat"
                ? tr("Envoyé automatiquement : vous avez quitté le quiz trop de fois.", "أُرسل تلقائياً: غادرت الاختبار عدة مرات.", "Submitted automatically: you left the quiz too many times.")
                : autoSubmitted
                ? tr("Envoyé automatiquement à la fin du temps.", "أُرسل تلقائياً عند انتهاء الوقت.", "Submitted automatically when time ran out.")
                : tr("Vos réponses ont bien été enregistrées.", "تم حفظ إجاباتك بنجاح.", "Your answers have been saved.")}
            </p>
          </div>

          <div className="-mt-16 px-6 pb-6 sm:px-8 space-y-6">
            {settings.showResultsImmediately ? (
              <>
                <div className="mx-auto w-40 h-40 rounded-full bg-card shadow-xl ring-8 ring-card flex items-center justify-center relative">
                  <svg viewBox="0 0 128 128" className="absolute inset-0 -rotate-90">
                    <circle cx="64" cy="64" r={R} fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/60" />
                    <circle
                      cx="64"
                      cy="64"
                      r={R}
                      fill="none"
                      stroke={m.ring}
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={C}
                      strokeDashoffset={C - (pct / 100) * C}
                      style={{ transition: "stroke-dashoffset 1s ease-out" }}
                    />
                  </svg>
                  <div className="text-center">
                    <div className="text-4xl font-extrabold tabular-nums">{pct}%</div>
                    <div className="text-xs font-semibold text-muted-foreground tabular-nums">
                      {finalScore.score} / {finalScore.total} pts
                    </div>
                  </div>
                </div>
                <p className={`text-center text-xl font-bold ${m.color}`}>{m.label}</p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { icon: <CheckCircle2 className="h-5 w-5" />, v: correct, l: tr("Correctes", "صحيحة", "Correct"), c: "text-emerald-600 bg-emerald-500/10" },
                    { icon: <XCircle className="h-5 w-5" />, v: wrong, l: tr("Incorrectes", "خاطئة", "Wrong"), c: "text-rose-600 bg-rose-500/10" },
                    { icon: <MinusCircle className="h-5 w-5" />, v: empty, l: tr("Sans réponse", "بدون جواب", "Unanswered"), c: "text-slate-500 bg-slate-500/10" },
                    { icon: <Clock className="h-5 w-5" />, v: `${finalScore.minutes}′`, l: tr("Durée", "المدة", "Time"), c: "text-amber-600 bg-amber-500/10" }
                  ].map((s, i) => (
                    <div key={i} className="rounded-2xl border p-3 flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${s.c}`}>{s.icon}</div>
                      <div>
                        <div className="text-xl font-extrabold tabular-nums leading-none">{s.v}</div>
                        <div className="text-[11px] font-semibold text-muted-foreground mt-1">{s.l}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {pending > 0 && (
                  <p className="text-xs text-center text-muted-foreground">
                    {tr(
                      `${pending} réponse(s) libre(s) seront corrigées par votre enseignant.`,
                      `${pending} إجابة حرة سيصححها الأستاذ.`,
                      `${pending} open answer(s) will be graded by your teacher.`
                    )}
                  </p>
                )}
              </>
            ) : (
              <div className="mx-auto max-w-md rounded-2xl border bg-card shadow-lg p-6 text-center">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-3">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <p className="font-semibold">
                  {tr("Copie enregistrée avec succès", "تم حفظ ورقتك بنجاح", "Answers saved successfully")}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {tr(
                    "Votre note sera publiée par votre enseignant.",
                    "سيتم نشر النقطة من طرف الأستاذ.",
                    "Your teacher will publish your score."
                  )}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {canReview && (
                <Button variant="outline" onClick={() => setShowReview(v => !v)} className="h-11 rounded-xl gap-2 font-semibold">
                  {showReview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showReview
                    ? tr("Masquer le corrigé", "إخفاء التصحيح", "Hide correction")
                    : tr("Voir le corrigé détaillé", "عرض التصحيح المفصل", "See detailed correction")}
                </Button>
              )}
              {settings.allowMultipleAttempts && (
                <Button variant="outline" onClick={startQuiz} className="h-11 rounded-xl gap-2 font-semibold border-primary/40 text-primary hover:bg-primary/10">
                  <RefreshCw className="h-4 w-4" />
                  {tr("Repasser le quiz", "إعادة الاختبار", "Retake quiz")}
                </Button>
              )}
              <Button onClick={onClose} className="h-11 rounded-xl px-8 font-semibold">
                {tr("Fermer", "إغلاق", "Close")}
              </Button>
            </div>
          </div>
        </div>

        {/* Corrigé détaillé */}
        {canReview && showReview && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
            {graded.map((r, i) => {
              const tone = !r.gradable
                ? "border-slate-200 dark:border-slate-800"
                : r.isCorrect
                ? "border-emerald-300 dark:border-emerald-900"
                : "border-rose-300 dark:border-rose-900";
              const pts = r.item.question.points || 1;
              return (
                <div key={r.item.question.id} className={`rounded-2xl border-2 bg-card p-5 ${tone}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-sm font-bold">{i + 1}</span>
                      {r.gradable ? (
                        r.isCorrect ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                            <CheckCircle2 className="h-4 w-4" /> {tr("Correct", "صحيح", "Correct")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600">
                            <XCircle className="h-4 w-4" />
                            {r.answered ? tr("Incorrect", "خطأ", "Incorrect") : tr("Sans réponse", "بدون جواب", "Unanswered")}
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500">
                          <PenLine className="h-4 w-4" /> {tr("Correction par l'enseignant", "يصححه الأستاذ", "Graded by teacher")}
                        </span>
                      )}
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full tabular-nums ${r.isCorrect ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                      {r.earned} / {pts} pt
                    </span>
                  </div>
                  <div className="quiz-question-html text-sm font-medium mb-3" dangerouslySetInnerHTML={{ __html: r.item.html }} />

                  {r.item.question.question_type === "short_answer" ? (
                    <div className="rounded-xl bg-muted/50 p-3 text-sm">
                      <span className="text-xs font-semibold text-muted-foreground block mb-1">{tr("Votre réponse", "إجابتك", "Your answer")}</span>
                      {r.answer?.text?.trim() || <em className="text-muted-foreground">—</em>}
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {r.item.options.map(opt => {
                        const chosen = !!r.answer?.selected.includes(opt.id);
                        const cls = opt.is_correct
                          ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-800"
                          : chosen
                          ? "border-rose-300 bg-rose-50 text-rose-900 dark:bg-rose-950/30 dark:text-rose-200 dark:border-rose-800"
                          : "border-border text-muted-foreground";
                        return (
                          <div key={opt.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${cls}`}>
                            {opt.is_correct ? <Check className="h-4 w-4 shrink-0" /> : chosen ? <X className="h-4 w-4 shrink-0" /> : <span className="h-4 w-4 shrink-0" />}
                            <span className="flex-1">{optionLabel(opt)}</span>
                            {chosen && (
                              <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">
                                {tr("Votre choix", "اختيارك", "Your pick")}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── Quiz en cours ───
  const item = items[index];
  if (!item) return null;
  const qid = item.question.id;
  const ans = answers[qid];
  const isLocked = !!locked[qid];
  const isLast = index === items.length - 1;
  const progress = items.length > 0 ? Math.round((answeredCount / items.length) * 100) : 0;
  const globalLow = timeLeft !== null && timeLeft <= 60;
  const qLimit = isSequential ? item.timeLimitSeconds : null;
  const qPct = qLimit && questionTimeLeft !== null ? Math.max(0, Math.min(100, (questionTimeLeft / qLimit) * 100)) : null;
  const qLow = questionTimeLeft !== null && questionTimeLeft <= 10;
  const type = item.question.question_type;

  const navState = (i: number) => {
    const it = items[i];
    const answered = isAnswered(it, answers[it.question.id]);
    if (i === index) return "current";
    if (answered) return "answered";
    return "empty";
  };

  const watermarkText = `${user?.name || ""} · ${user?.email || ""} · ${new Date(startTimeRef.current || Date.now()).toLocaleString(isRtl ? "ar-MA" : "fr-FR")}`;

  return (
    <div
      className={`max-w-5xl mx-auto ${antiCheatOn ? "quiz-protected" : ""}`}
      dir={isRtl ? "rtl" : "ltr"}
      onCopy={antiCheatOn ? e => e.preventDefault() : undefined}
      onPaste={antiCheatOn ? e => e.preventDefault() : undefined}
    >
      {antiCheatOn && (
        <>
          {/* Questions masquées dès que l'élève quitte l'onglet / l'application */}
          {antiCheat.isAway && (
            <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center p-6 text-center">
              <div className="max-w-sm space-y-3">
                <ShieldAlert className="h-12 w-12 mx-auto text-rose-500" />
                <p className="text-lg font-bold">{tr("Quiz masqué", "الاختبار مخفي", "Quiz hidden")}</p>
                <p className="text-sm text-muted-foreground">
                  {tr(
                    "Revenez sur cette page pour continuer. Chaque sortie est enregistrée.",
                    "عد إلى هذه الصفحة للمتابعة. كل مغادرة يتم تسجيلها.",
                    "Come back to this page to continue. Every exit is recorded."
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Avertissement après une sortie */}
          <AlertDialog open={antiCheat.warningOpen} onOpenChange={o => { if (!o) antiCheat.closeWarning(); }}>
            <AlertDialogContent className="rounded-3xl max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-rose-600">
                  <AlertTriangle className="h-5 w-5" />
                  {tr("Vous avez quitté le quiz", "لقد غادرت الاختبار", "You left the quiz")}
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2 text-sm">
                    <p>
                      {tr(
                        "Changer d'onglet ou d'application pendant le quiz est interdit et signalé à votre enseignant.",
                        "تغيير الصفحة أو التطبيق أثناء الاختبار ممنوع ويتم إبلاغ أستاذك.",
                        "Switching tabs or apps during the quiz is forbidden and reported to your teacher."
                      )}
                    </p>
                    <p className="font-semibold text-foreground">
                      {maxFocusLosses > 0
                        ? tr(
                            `Sortie ${antiCheat.focusLosses} sur ${maxFocusLosses} : à la ${maxFocusLosses}e, le quiz sera envoyé automatiquement.`,
                            `المغادرة ${antiCheat.focusLosses} من ${maxFocusLosses}: عند المرة ${maxFocusLosses} سيُرسل الاختبار تلقائياً.`,
                            `Exit ${antiCheat.focusLosses} of ${maxFocusLosses}: at ${maxFocusLosses}, the quiz will be submitted automatically.`
                          )
                        : tr(
                            `Sorties enregistrées : ${antiCheat.focusLosses}`,
                            `عدد المغادرات المسجلة: ${antiCheat.focusLosses}`,
                            `Recorded exits: ${antiCheat.focusLosses}`
                          )}
                    </p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction className="rounded-xl" onClick={() => antiCheat.closeWarning()}>
                  {tr("Reprendre le quiz", "متابعة الاختبار", "Resume the quiz")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
      {/* Barre supérieure */}
      <div className="sticky top-0 z-20 -mx-3 sm:-mx-6 -mt-3 sm:-mt-6 mb-5 px-3 sm:px-6 pt-3 sm:pt-4 pb-3 bg-background/85 backdrop-blur-md border-b">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold truncate">{exam.title}</h2>
            <p className="text-xs text-muted-foreground">
              {tr(
                `Question ${index + 1} sur ${items.length} · ${answeredCount} répondue(s)`,
                `السؤال ${index + 1} من ${items.length} · ${answeredCount} مُجاب`,
                `Question ${index + 1} of ${items.length} · ${answeredCount} answered`
              )}
            </p>
          </div>
          {timeLeft !== null && (
            <div
              className={`flex items-center gap-2 rounded-2xl px-3.5 py-2 font-mono text-base font-bold tabular-nums shadow-sm border transition-colors ${
                globalLow
                  ? "bg-rose-500 text-white border-rose-500 animate-pulse"
                  : timeLeft <= 300
                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900"
                  : "bg-card text-foreground"
              }`}
              aria-live="polite"
            >
              <Clock className="h-4 w-4" />
              {formatTimer(timeLeft)}
            </div>
          )}
        </div>
        <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_250px]">
        {/* Carte question */}
        <div key={qid} className="relative rounded-3xl border bg-card shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Filigrane nominatif : une capture d'écran partagée reste identifiable */}
          {antiCheatOn && (
            <div className="quiz-watermark" aria-hidden="true">
              {Array.from({ length: 18 }).map((_, i) => (
                <span key={i}>{watermarkText}</span>
              ))}
            </div>
          )}
          {/* Minuteur de question (mode séquentiel) */}
          {qPct !== null && (
            <div className="h-1.5 bg-muted">
              <div
                className={`h-full transition-all duration-300 ease-linear ${qLow ? "bg-rose-500" : "bg-amber-500"}`}
                style={{ width: `${qPct}%` }}
              />
            </div>
          )}

          <div className="p-5 sm:p-7 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-xl bg-primary px-3 py-1 text-sm font-bold text-primary-foreground shadow-sm">
                {tr("Question", "السؤال", "Question")} {index + 1}
              </span>
              <span className="inline-flex items-center rounded-xl border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                {item.question.points || 1} {tr("pt", "نقطة", "pt")}
              </span>
              {item.multi && (
                <span className="inline-flex items-center gap-1 rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-300 px-2.5 py-1 text-xs font-semibold">
                  <ListChecks className="h-3.5 w-3.5" />
                  {tr("Plusieurs réponses possibles", "عدة أجوبة ممكنة", "Several answers possible")}
                </span>
              )}
              {isLocked && (
                <span className="inline-flex items-center gap-1 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-300 px-2.5 py-1 text-xs font-semibold">
                  <Lock className="h-3.5 w-3.5" />
                  {tr("Réponse verrouillée", "إجابة مقفلة", "Answer locked")}
                </span>
              )}
              {qLimit && questionTimeLeft !== null && (
                <span
                  className={`ms-auto inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 font-mono text-sm font-bold tabular-nums ${
                    qLow ? "bg-rose-500/10 text-rose-600 animate-pulse" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  }`}
                >
                  <Timer className="h-4 w-4" />
                  {formatTimer(questionTimeLeft)}
                </span>
              )}
            </div>

            <div
              className="quiz-question-html text-lg sm:text-xl font-semibold leading-relaxed text-foreground"
              dangerouslySetInnerHTML={{ __html: item.html }}
            />

            {/* QCM */}
            {type === "multiple_choice" && (
              <div className="grid gap-3" role={item.multi ? "group" : "radiogroup"}>
                {item.options.map((opt, oIdx) => {
                  const selected = !!ans?.selected.includes(opt.id);
                  const disabled = isLocked && !selected;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role={item.multi ? "checkbox" : "radio"}
                      aria-checked={selected}
                      disabled={disabled}
                      onClick={() => selectOption(item, opt.id)}
                      className={`group relative flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-start transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 ${
                        selected
                          ? "border-primary bg-primary/[0.07] shadow-md shadow-primary/10"
                          : disabled
                          ? "border-border opacity-50 cursor-not-allowed"
                          : "border-border hover:border-primary/50 hover:bg-muted/40 hover:-translate-y-0.5 hover:shadow-md"
                      }`}
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center text-sm font-bold transition-colors ${
                          item.multi ? "rounded-lg" : "rounded-full"
                        } ${
                          selected
                            ? "bg-primary text-primary-foreground shadow"
                            : "bg-muted text-muted-foreground group-hover:bg-primary/15 group-hover:text-primary"
                        }`}
                      >
                        {selected && item.multi ? <Check className="h-5 w-5" /> : String.fromCharCode(65 + oIdx)}
                      </span>
                      <span className="flex-1 text-base font-medium">{opt.option_text}</span>
                      {selected && !item.multi && (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground animate-in zoom-in duration-200">
                          <Check className="h-4 w-4" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Vrai / Faux */}
            {type === "true_false" && (
              <div className="grid grid-cols-2 gap-4">
                {(item.options.length > 0
                  ? item.options
                  : ([
                      { id: "True", option_text: "True" },
                      { id: "False", option_text: "False" }
                    ] as QuizOption[])
                ).map(opt => {
                  const selected = !!ans?.selected.includes(opt.id);
                  const disabled = isLocked && !selected;
                  const isTrue = isTrueText(opt.option_text);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={disabled}
                      onClick={() => selectOption(item, opt.id)}
                      className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 p-6 sm:p-8 transition-all duration-200 focus:outline-none focus-visible:ring-4 ${
                        isTrue ? "focus-visible:ring-emerald-500/25" : "focus-visible:ring-rose-500/25"
                      } ${
                        selected
                          ? isTrue
                            ? "border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10"
                            : "border-rose-500 bg-rose-500/10 shadow-lg shadow-rose-500/10"
                          : disabled
                          ? "border-border opacity-50 cursor-not-allowed"
                          : "border-border hover:-translate-y-0.5 hover:shadow-md " +
                            (isTrue ? "hover:border-emerald-400" : "hover:border-rose-400")
                      }`}
                    >
                      <span
                        className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-colors ${
                          selected
                            ? isTrue
                              ? "bg-emerald-500 text-white"
                              : "bg-rose-500 text-white"
                            : isTrue
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-rose-500/10 text-rose-600"
                        }`}
                      >
                        {isTrue ? <Check className="h-8 w-8" strokeWidth={3} /> : <X className="h-8 w-8" strokeWidth={3} />}
                      </span>
                      <span className="text-lg font-bold">{optionLabel(opt)}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Réponse libre */}
            {type === "short_answer" && (
              <div className="space-y-2">
                <Textarea
                  placeholder={tr("Rédigez votre réponse ici…", "اكتب إجابتك هنا…", "Write your answer here…")}
                  value={ans?.text || ""}
                  onChange={e => setTextAnswer(item, e.target.value)}
                  disabled={isLocked}
                  rows={5}
                  className="rounded-2xl border-2 text-base p-4 focus-visible:ring-primary/25 resize-y"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {!settings.allowCorrections && !isLocked
                      ? tr(
                          "Votre réponse sera verrouillée en passant à une autre question.",
                          "سيتم قفل إجابتك عند الانتقال إلى سؤال آخر.",
                          "Your answer will be locked when you move to another question."
                        )
                      : ""}
                  </span>
                  <span className="tabular-nums">{(ans?.text || "").length}</span>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-5 py-4 sm:px-7">
            {!isSequential ? (
              <Button variant="ghost" onClick={goPrev} disabled={index === 0} className="h-11 rounded-xl gap-2 font-semibold">
                <ArrowLeft className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />
                {tr("Précédent", "السابق", "Previous")}
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                {tr("Mode séquentiel", "وضع متسلسل", "Sequential mode")}
              </span>
            )}

            {!isLast ? (
              <Button onClick={goNext} className="h-11 rounded-xl px-6 gap-2 font-semibold shadow-sm">
                {tr("Suivant", "التالي", "Next")}
                <ArrowRight className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />
              </Button>
            ) : (
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={isSubmitting}
                className="h-11 rounded-xl px-6 gap-2 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {tr("Terminer le quiz", "إنهاء الاختبار", "Finish quiz")}
              </Button>
            )}
          </div>
        </div>

        {/* Panneau de navigation */}
        <aside className="order-first lg:order-none">
          <div className="lg:sticky lg:top-28 rounded-3xl border bg-card p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">{tr("Questions", "الأسئلة", "Questions")}</p>
              <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                {answeredCount}/{items.length}
              </span>
            </div>
            <div className="flex lg:grid lg:grid-cols-5 gap-2 overflow-x-auto pb-1 lg:pb-0">
              {items.map((it, i) => {
                const st = navState(i);
                const lockedQ = !!locked[it.question.id];
                return (
                  <button
                    key={it.question.id}
                    type="button"
                    disabled={isSequential}
                    onClick={() => goTo(i)}
                    title={`${tr("Question", "السؤال", "Question")} ${i + 1}`}
                    className={`relative h-10 w-10 shrink-0 rounded-xl text-sm font-bold transition-all ${
                      st === "current"
                        ? "bg-primary text-primary-foreground shadow-md scale-105"
                        : st === "answered"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                        : "bg-muted text-muted-foreground border border-transparent"
                    } ${isSequential ? "cursor-default" : "hover:ring-2 hover:ring-primary/30"}`}
                  >
                    {i + 1}
                    {lockedQ && (
                      <Lock className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-card p-0.5 text-slate-500" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="hidden lg:flex flex-col gap-1.5 text-[11px] text-muted-foreground border-t pt-3">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-primary" />
                {tr("Question actuelle", "السؤال الحالي", "Current")}
              </span>
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-emerald-500/30" />
                {tr("Répondue", "مُجاب", "Answered")}
              </span>
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-muted border" />
                {tr("Sans réponse", "بدون جواب", "Not answered")}
              </span>
            </div>
            {!isSequential && (
              <Button
                variant="outline"
                onClick={() => setConfirmOpen(true)}
                disabled={isSubmitting}
                className="flex w-full h-10 rounded-xl gap-2 font-semibold border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
              >
                <Send className="h-4 w-4" />
                {tr("Terminer", "إنهاء", "Finish")}
              </Button>
            )}
          </div>
        </aside>
      </div>

      {/* Confirmation d'envoi */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-3xl" dir={isRtl ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              {tr("Envoyer vos réponses ?", "إرسال إجاباتك؟", "Submit your answers?")}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  {tr(
                    `Vous avez répondu à ${answeredCount} question(s) sur ${items.length}.`,
                    `أجبت عن ${answeredCount} من أصل ${items.length} سؤال.`,
                    `You answered ${answeredCount} of ${items.length} question(s).`
                  )}
                </p>
                {unansweredCount > 0 && (
                  <p className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    {tr(
                      `${unansweredCount} question(s) sans réponse compteront 0 point.`,
                      `${unansweredCount} سؤال بدون جواب سيُحتسب بصفر.`,
                      `${unansweredCount} unanswered question(s) will score 0.`
                    )}
                  </p>
                )}
                <p className="text-xs">
                  {tr("Cette action est définitive.", "هذا الإجراء نهائي.", "This action is final.")}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl">{tr("Continuer le quiz", "متابعة الاختبار", "Keep going")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => {
                e.preventDefault();
                handleSubmit(false);
              }}
              disabled={isSubmitting}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {tr("Envoyer", "إرسال", "Submit")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default QuizTaker;

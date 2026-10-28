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
  ShieldAlert,
  LogOut,
  WifiOff,
  PlayCircle
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
import { useQuizAntiCheat, type CheatEventType, type CheatEvent } from "@/hooks/useQuizAntiCheat";
import { MathHtml, MathText, SimpleMathPreview } from "@/components/math/MathContent";
import MathSymbolBar from "@/components/math/MathSymbolBar";
import { formatDecimal, localeFor } from "@/lib/formatDate";

interface QuizTakerProps {
  exam: Exam;
  onClose: () => void;
  /** Informe le parent de la phase (ex. masquer la croix du dialogue pendant le quiz). */
  onPhaseChange?: (phase: QuizPhase) => void;
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

/** Option telle que reçue par un élève (quiz_options_for_student) : jamais de is_correct */
interface StudentOptionRow {
  id: string;
  question_id: string;
  option_text: string;
  option_order: number | null;
  is_multi: boolean | null;
}

/** Retour de la fonction serveur submit_quiz_attempt */
interface SubmitResult {
  submission_id: string;
  score: number;
  total_points: number;
  submitted_at?: string;
  results: { question_id: string; is_correct: boolean; points_earned: number; gradable: boolean }[];
  correct_option_ids: string[];
}

/** Erreurs définitives renvoyées par le serveur (un nouvel essai ne changerait rien) */
const serverErrorCode = (err: any): string | null => {
  const text = `${err?.message || ""} ${err?.details || ""} ${err?.hint || ""}`;
  const m = text.match(/\b(ALREADY_SUBMITTED|QUIZ_CLOSED|QUIZ_NOT_OPEN|ACCESS_DENIED|NOT_A_QUIZ|NO_QUESTIONS|INVALID_ANSWERS|NOT_AUTHENTICATED|REVIEW_NOT_ALLOWED|NOT_FOUND)\b/);
  return m ? m[1] : null;
};

/** Paste détecté via « insertText » (presse-papiers du clavier Android) au-delà de ce nombre de caractères */
const LONG_INSERT_CHARS = 40;

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

type Phase = "loading" | "error" | "blocked" | "intro" | "resume" | "running" | "result";
export type QuizPhase = Phase;

/** Tentative en cours sauvegardée sur l'appareil (reprise après rechargement / fermeture). */
interface SavedAttempt {
  v: 1;
  answers: Record<string, StudentAnswer>;
  locked: Record<string, boolean>;
  index: number;
  order: string[];
  optionOrder: Record<string, string[]>;
  deadline: number | null;
  questionDeadline: number | null;
  startTime: number;
  focusLosses?: number;
  events?: CheatEvent[];
  pendingSubmit?: boolean;
  savedAt: number;
}

const readSaved = (key: string | null): SavedAttempt | null => {
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || v.v !== 1 || typeof v.startTime !== "number" || !Array.isArray(v.order)) return null;
    return v as SavedAttempt;
  } catch {
    return null;
  }
};
const writeSaved = (key: string | null, data: SavedAttempt) => {
  if (!key) return;
  try { window.localStorage.setItem(key, JSON.stringify(data)); } catch { /* stockage plein ou bloqué */ }
};
const clearSaved = (key: string | null) => {
  if (!key) return;
  try { window.localStorage.removeItem(key); } catch { /* ignore */ }
};

const MAX_AUTO_RETRIES = 5;
const RETRY_DELAY_MS = 10_000;

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

/**
 * La correction est faite par le serveur (submit_quiz_attempt) : l'élève ne reçoit jamais
 * is_correct avant l'envoi. On ne fait ici que mettre en forme le résultat renvoyé.
 */
function buildResult(
  item: QuizItem,
  ans: StudentAnswer | undefined,
  server: { is_correct?: boolean | null; points_earned?: number | string | null; gradable?: boolean | null } | undefined,
  gradableFallback: boolean
): QuestionResult {
  const answered = isAnswered(item, ans);
  const gradable = item.question.question_type === "short_answer"
    ? false
    : server && typeof server.gradable === "boolean"
    ? server.gradable
    : gradableFallback;
  return {
    item,
    answer: ans,
    isCorrect: gradable && !!server?.is_correct,
    earned: Number(server?.points_earned) || 0,
    gradable,
    answered
  };
}

/* ─────────────────────────────── Composant ─────────────────────────────── */

const QuizTaker: React.FC<QuizTakerProps> = ({ exam, onClose, onPhaseChange }) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { refreshData } = useCourses();
  // Un professeur qui ouvre le quiz le voit en aperçu (lecture directe des options, pas d'envoi)
  const isPreview = user?.role === "professor";
  const isRtl = language === "ar";
  const tr = useCallback(
    (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en),
    [language]
  );

  const [phase, setPhase] = useState<Phase>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
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
  const reviewRef = useRef<HTMLDivElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [quitOpen, setQuitOpen] = useState(false);
  const [results, setResults] = useState<QuestionResult[] | null>(null);
  const [finalScore, setFinalScore] = useState<{ score: number; total: number; minutes: number } | null>(null);
  const [previousSubmission, setPreviousSubmission] = useState<any>(null);
  const [attemptsCount, setAttemptsCount] = useState(0);
  const [showReview, setShowReview] = useState(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [autoReason, setAutoReason] = useState<"time" | "cheat" | null>(null);
  const [savedAttempt, setSavedAttempt] = useState<SavedAttempt | null>(null);
  // Échec d'envoi (réseau) : bannière persistante + nouvelles tentatives automatiques
  const [submitFailed, setSubmitFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [srMessage, setSrMessage] = useState("");
  // Corrigé de la dernière copie (élève revenant sur un quiz déjà passé)
  const [pastReview, setPastReview] = useState<QuestionResult[] | null>(null);
  // Bonnes réponses (renvoyées par le serveur seulement si le corrigé est autorisé)
  const [resultCorrect, setResultCorrect] = useState<Set<string>>(() => new Set());
  const [pastCorrect, setPastCorrect] = useState<Set<string>>(() => new Set());
  const [pastReviewLoading, setPastReviewLoading] = useState(false);
  const [showPastReview, setShowPastReview] = useState(false);

  // Refs pour éviter les closures périmées dans les minuteurs
  const answersRef = useRef(answers);
  const answerAreaRef = useRef<HTMLTextAreaElement>(null);
  answersRef.current = answers;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const submittingRef = useRef(false);
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  const indexRef = useRef(index);
  indexRef.current = index;
  const deadlineRef = useRef(deadline);
  deadlineRef.current = deadline;
  const questionDeadlineRef = useRef(questionDeadline);
  questionDeadlineRef.current = questionDeadline;
  // Saisie en cours de composition (IME, dictée) : une longue insertion est alors autorisée
  const composingRef = useRef(false);
  const compositionEndAtRef = useRef(0);
  const lastSubmitArgsRef = useRef<{ auto: boolean; reason: "time" | "cheat" }>({ auto: false, reason: "time" });

  const storageKey = user?.id ? `quiz-progress-${exam.id}-${user.id}` : null;
  const isSequential = settings.sequentialQuestions;

  useEffect(() => {
    onPhaseChange?.(phase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

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
        return tr(
          "Collage refusé : écris ta réponse toi-même. Le collage est signalé à l'enseignant.",
          "تم رفض اللصق: اكتب إجابتك بنفسك. يتم إبلاغ الأستاذ باللصق.",
          "Paste refused: type your answer yourself. Pasting is reported to the teacher."
        );
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
    getQuestionNumber: () => indexRef.current + 1,
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

  // Le hook contient aussi les incidents d'avant un rechargement (restaurés, S39)
  const allEvents = useCallback((): CheatEvent[] => antiCheatRef.current.getEvents(), []);

  /* ───────────── Sauvegarde locale de la tentative ───────────── */

  const persistAttempt = useCallback(
    (extra?: Partial<SavedAttempt>) => {
      if (!storageKey || !startTimeRef.current) return;
      const list = itemsRef.current;
      const optionOrder: Record<string, string[]> = {};
      list.forEach(it => {
        optionOrder[it.question.id] = it.options.map(o => o.id);
      });
      const prev = readSaved(storageKey);
      writeSaved(storageKey, {
        v: 1,
        answers: answersRef.current,
        locked: lockedRef.current,
        index: indexRef.current,
        order: list.map(it => it.question.id),
        optionOrder,
        deadline: deadlineRef.current,
        questionDeadline: questionDeadlineRef.current,
        startTime: startTimeRef.current,
        focusLosses: antiCheatRef.current.focusLosses,
        events: allEvents().slice(-300),
        pendingSubmit: prev && prev.startTime === startTimeRef.current ? prev.pendingSubmit : false,
        savedAt: Date.now(),
        ...(extra || {})
      });
    },
    [storageKey, allEvents]
  );

  useEffect(() => {
    if (phase !== "running") return;
    persistAttempt();
  }, [phase, answers, locked, index, items, deadline, questionDeadline, antiCheat.focusLosses, antiCheat.isAway, antiCheat.eventsVersion, persistAttempt]);

  // Sauvegarde aussi quand la page passe en arrière-plan / se ferme
  useEffect(() => {
    if (phase !== "running") return;
    const save = () => persistAttempt();
    const onVis = () => { if (document.visibilityState === "hidden") save(); };
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [phase, persistAttempt]);

  /** Recharge une tentative sauvegardée (ordre des questions/options, réponses, échéance d'origine). */
  const restoreAttempt = useCallback((saved: SavedAttempt, base: QuizItem[]) => {
    const byId = new Map(base.map(it => [it.question.id, it] as [string, QuizItem]));
    const ordered: QuizItem[] = [];
    saved.order.forEach(id => {
      const it = byId.get(id);
      if (it) {
        ordered.push(it);
        byId.delete(id);
      }
    });
    byId.forEach(it => ordered.push(it));
    const withOptions = ordered.map(it => {
      const ids = saved.optionOrder?.[it.question.id];
      if (!ids || it.question.question_type !== "multiple_choice") return it;
      const optById = new Map(it.options.map(o => [o.id, o] as [string, QuizOption]));
      const opts: QuizOption[] = [];
      ids.forEach(id => {
        const o = optById.get(id);
        if (o) {
          opts.push(o);
          optById.delete(id);
        }
      });
      optById.forEach(o => opts.push(o));
      return { ...it, options: opts };
    });

    // S39 : le compteur de sorties et le journal reprennent là où ils en étaient
    antiCheatRef.current.restore(saved.focusLosses || 0, Array.isArray(saved.events) ? saved.events : []);
    submittingRef.current = false;
    itemsRef.current = withOptions;
    answersRef.current = saved.answers || {};
    lockedRef.current = saved.locked || {};
    setItems(withOptions);
    setAnswers(saved.answers || {});
    setLocked(saved.locked || {});
    const idx = Math.max(0, Math.min(withOptions.length - 1, saved.index || 0));
    indexRef.current = idx;
    setIndex(idx);
    setResults(null);
    setFinalScore(null);
    setShowReview(false);
    setAutoSubmitted(false);
    setAutoReason(null);
    // Envoi en échec avant le rechargement : on relance les essais (sauf temps écoulé,
    // l'envoi automatique de fin de temps s'en charge immédiatement)
    setSubmitFailed(!!saved.pendingSubmit && !(saved.deadline !== null && saved.deadline <= Date.now()));
    setRetryCount(0);
    startTimeRef.current = saved.startTime;
    setNow(Date.now());
    deadlineRef.current = saved.deadline;
    setDeadline(saved.deadline);
    setQuestionDeadline(saved.questionDeadline ?? null);
    setSavedAttempt(null);
    setPhase("running");
  }, []);

  /* ───────────── Chargement ───────────── */

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setPhase("loading");
      setLoadError(null);
      try {
        // Requêtes indépendantes en parallèle (P11) : paramètres à jour, tentatives,
        // questions et options.
        //  - élève : options via la fonction serveur quiz_options_for_student (sans is_correct) ;
        //  - professeur (aperçu) : sélection imbriquée questions + options (les clés
        //    étrangères en double ont été supprimées), repli en 2 requêtes sinon.
        const questionsQuery = isPreview
          ? supabase
              .from("quiz_questions")
              .select("*, quiz_options(*)")
              .eq("exam_id", exam.id)
              .order("question_order", { ascending: true })
          : supabase
              .from("quiz_questions")
              .select("*")
              .eq("exam_id", exam.id)
              .order("question_order", { ascending: true });
        const [examRes, subRes, qResFirst, optRes] = await Promise.all([
          supabase.from("exams").select("*").eq("id", exam.id).maybeSingle(),
          user?.id && !isPreview
            ? supabase
                .from("quiz_submissions")
                .select("*")
                .eq("exam_id", exam.id)
                .eq("student_id", user.id)
                .order("submitted_at", { ascending: false })
            : Promise.resolve({ data: [] as any[], error: null } as any),
          questionsQuery,
          isPreview
            ? Promise.resolve({ data: null, error: null } as any)
            : (supabase as any).rpc("quiz_options_for_student", { p_exam_id: exam.id })
        ]);
        if (examRes.error) throw examRes.error;
        if (subRes.error) throw subRes.error;
        let qRes: any = qResFirst;
        if (qRes.error && isPreview) {
          // Migration pas encore appliquée (relation ambiguë) : questions seules
          qRes = await supabase
            .from("quiz_questions")
            .select("*")
            .eq("exam_id", exam.id)
            .order("question_order", { ascending: true });
        }
        if (qRes.error) throw qRes.error;
        if (optRes && optRes.error) throw optRes.error;

        // 1) Paramètres (l'enseignant a pu les modifier)
        let parsed = parseExamAvailability(exam) as any;
        if (examRes.data) parsed = parseExamAvailability(examRes.data as any) as any;
        const s: QuizSettings = { ...DEFAULT_QUIZ_SETTINGS, ...(parsed.quiz_settings || {}) };
        if (parsed.quiz_mode === "sequential_timed") s.sequentialQuestions = true;

        // 2) Tentatives précédentes
        const subData = (subRes.data || []) as any[];
        const latest: any = subData.length > 0 ? subData[0] : null;

        // 3) Questions + options
        const qRows = (qRes.data || []) as any[];
        const qList = qRows.map(r => {
          const { quiz_options: _nested, ...q } = r || {};
          return q as QuizQuestion;
        });
        let oList: QuizOption[] = [];
        // QCM à plusieurs bonnes réponses (fourni par le serveur pour un élève)
        const multiByQuestion = new Map<string, boolean>();
        if (isPreview) {
          const nested = qRows.some(r => Array.isArray(r?.quiz_options));
          if (nested) {
            qRows.forEach(r => {
              (Array.isArray(r?.quiz_options) ? r.quiz_options : []).forEach((o: QuizOption) => oList.push(o));
            });
          } else if (qList.length > 0) {
            const { data: oData, error: oErr } = await supabase
              .from("quiz_options")
              .select("*")
              .in("question_id", qList.map(q => q.id));
            if (oErr) throw oErr;
            oList = (oData || []) as QuizOption[];
          }
          oList = [...oList].sort((a, b) => (a.option_order ?? 0) - (b.option_order ?? 0));
          qList.forEach(q => {
            const n = oList.filter(o => o.question_id === q.id && o.is_correct).length;
            multiByQuestion.set(q.id, n > 1);
          });
        } else {
          const rows = (optRes?.data || []) as StudentOptionRow[];
          oList = rows.map(r => ({
            id: r.id,
            question_id: r.question_id,
            option_text: r.option_text,
            option_order: r.option_order ?? 0,
            // inconnu côté élève : la correction est faite par le serveur
            is_correct: false,
            created_at: ""
          }));
          rows.forEach(r => {
            if (r.is_multi) multiByQuestion.set(r.question_id, true);
          });
        }
        if (cancelled) return;

        setSettings(s);
        setExamDescription(parsed.description || "");
        const dur = parsed.duration_minutes || exam.duration_minutes || 30;
        setDurationMinutes(dur);
        setPreviousSubmission(latest);
        setAttemptsCount(subData.length);

        const built: QuizItem[] = qList.map(q => {
          const { cleanText, timeLimitSeconds } = parseQuestionText(q.question);
          let opts = oList.filter(o => o.question_id === q.id);
          if (q.question_type === "true_false") {
            // Toujours « Vrai » puis « Faux »
            opts = [...opts].sort((a, b) => (isTrueText(a.option_text) ? -1 : isTrueText(b.option_text) ? 1 : 0));
          }
          return {
            question: q,
            html: cleanText,
            timeLimitSeconds,
            options: opts,
            multi: q.question_type === "multiple_choice" && !!multiByQuestion.get(q.id)
          };
        });

        setBaseItems(built);
        setItems(built);

        // Tentative en cours sauvegardée sur cet appareil ?
        const saved = readSaved(storageKey);
        const latestTime = latest?.submitted_at ? new Date(latest.submitted_at).getTime() : 0;
        if (saved && built.length > 0 && (!latest || latestTime < saved.startTime)) {
          if (saved.deadline !== null && saved.deadline <= Date.now()) {
            // Temps écoulé pendant l'absence : envoi automatique des réponses sauvegardées
            restoreAttempt(saved, built);
            return;
          }
          setSavedAttempt(saved);
          setPhase("resume");
          return;
        }
        if (saved) clearSaved(storageKey);

        setPhase(latest && !s.allowMultipleAttempts ? "blocked" : "intro");
      } catch (err) {
        console.error("Error loading quiz data:", err);
        if (!cancelled) {
          const code = serverErrorCode(err);
          setLoadError(
            typeof navigator !== "undefined" && navigator.onLine === false
              ? tr("Pas de connexion Internet.", "لا يوجد اتصال بالإنترنت.", "No Internet connection.")
              : code === "QUIZ_NOT_OPEN"
              ? tr("Ce quiz n'est pas encore ouvert.", "هذا الاختبار غير متاح بعد.", "This quiz is not open yet.")
              : code === "ACCESS_DENIED"
              ? tr("Ce quiz n'est pas accessible.", "هذا الاختبار غير متاح لك.", "This quiz is not available to you.")
              : tr("Impossible de charger le quiz.", "تعذر تحميل الاختبار.", "Unable to load the quiz.")
          );
          setPhase("error");
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam.id, user?.id, reloadKey]);

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
    setSubmitFailed(false);
    setRetryCount(0);
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
    // 1 s suffit (affichage à la seconde) : 4× moins de rendus qu'avant
    const id = setInterval(() => setNow(Date.now()), 1000);
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
  const timeUp = timeLeft === 0;

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
    if (timeUp || submitFailed) return;
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

  /**
   * @param inputType type d'insertion natif (InputEvent.inputType) ; undefined = insertion
   * faite par l'application (barre de symboles). Sont refusés :
   *  - un collage / glisser-déposer (« insertFromPaste », « insertFromDrop »…) ;
   *  - S45 : une insertion « insertText » (ou sans inputType, vieux navigateurs) de plus de
   *    40 caractères d'un coup HORS composition : c'est ainsi qu'arrive le presse-papiers
   *    du clavier Android (Gboard…). La dictée vocale / l'IME passent par une composition
   *    (compositionstart → compositionend) et restent autorisés, comme « insertReplacementText ».
   * @param isComposing InputEvent.isComposing de l'événement natif
   */
  const setTextAnswer = (item: QuizItem, text: string, inputType?: string, isComposing?: boolean) => {
    const qid = item.question.id;
    if (locked[qid] || timeUp || submitFailed) return;
    if (antiCheatOn && inputType && /^insertFrom(Paste|Drop|Yank|PasteAsQuotation)$/.test(inputType)) {
      antiCheatRef.current.recordSuspiciousInput(inputType);
      return;
    }
    if (antiCheatOn && inputType !== undefined && (inputType === "insertText" || inputType === "")) {
      const previous = answersRef.current[qid]?.text || "";
      const inserted = text.length - previous.length;
      // Safari émet parfois l'événement final juste après compositionend
      const inComposition =
        !!isComposing || composingRef.current || Date.now() - compositionEndAtRef.current < 150;
      if (inserted > LONG_INSERT_CHARS && !inComposition) {
        antiCheatRef.current.recordSuspiciousInput(`${inputType || "input"} +${inserted}`);
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
      if (isPreview) {
        toast.info(
          tr(
            "Aperçu professeur : les réponses ne sont pas enregistrées.",
            "معاينة الأستاذ: لا يتم حفظ الإجابات.",
            "Teacher preview: answers are not saved."
          )
        );
        setConfirmOpen(false);
        return;
      }
      submittingRef.current = true;
      lastSubmitArgsRef.current = { auto, reason };
      setIsSubmitting(true);
      setConfirmOpen(false);

      const list = itemsRef.current;
      const ans = answersRef.current;
      const end = deadlineRef.current ? Math.min(Date.now(), deadlineRef.current) : Date.now();
      const minutes = Math.max(1, Math.round((end - startTimeRef.current) / 60000));

      // Réponses brutes : la note est calculée par le serveur
      const payload = list.map(it => {
        const a = ans[it.question.id];
        return {
          question_id: it.question.id,
          selected_option_ids: (a?.selected || []).filter(id => UUID_RE.test(id)),
          text_answer: it.question.question_type === "short_answer" ? (a?.text || "") : ""
        };
      });

      const markFailed = () => {
        submittingRef.current = false;
        setSubmitFailed(true);
        persistAttempt({ pendingSubmit: true });
        toast.error(
          tr(
            "Échec de l'envoi. Tes réponses sont sauvegardées sur cet appareil : nouvel essai automatique.",
            "فشل الإرسال. إجاباتك محفوظة على هذا الجهاز: ستتم إعادة المحاولة تلقائياً.",
            "Submission failed. Your answers are saved on this device: retrying automatically."
          )
        );
      };

      /** Refus définitif du serveur : inutile de réessayer, on recharge l'état du quiz */
      const handleRefused = (code: string) => {
        submittingRef.current = false;
        clearSaved(storageKey);
        setSubmitFailed(false);
        setRetryCount(0);
        setDeadline(null);
        setQuestionDeadline(null);
        if (code === "ALREADY_SUBMITTED") {
          toast.info(
            tr(
              "Ce quiz a déjà été envoyé : une seule tentative est autorisée.",
              "تم إرسال هذا الاختبار مسبقاً: يُسمح بمحاولة واحدة فقط.",
              "This quiz was already submitted: only one attempt is allowed."
            )
          );
        } else if (code === "QUIZ_CLOSED") {
          toast.error(
            tr(
              "Le quiz est fermé : la copie n'a pas pu être enregistrée.",
              "الاختبار مغلق: تعذر حفظ ورقتك.",
              "The quiz is closed: your answers could not be saved."
            )
          );
        } else {
          toast.error(
            tr(
              "Envoi refusé : ce quiz n'est pas accessible.",
              "تم رفض الإرسال: هذا الاختبار غير متاح.",
              "Submission refused: this quiz is not available."
            )
          );
        }
        setReloadKey(k => k + 1);
      };

      try {
        const events = allEvents().slice(-300);
        const { data, error } = await (supabase as any).rpc("submit_quiz_attempt", {
          p_exam_id: exam.id,
          p_answers: payload,
          p_time_taken_minutes: minutes,
          p_anti_cheat_events: events.length,
          p_anti_cheat_log: events.length > 0 ? events : null
        });

        if (error || !data) {
          const code = serverErrorCode(error);
          console.error("submit_quiz_attempt error:", error);
          if (code && code !== "NOT_AUTHENTICATED") handleRefused(code);
          else markFailed();
          return;
        }

        const res = data as SubmitResult;
        const byQ = new Map((Array.isArray(res.results) ? res.results : []).map(r => [r.question_id, r] as [string, SubmitResult["results"][number]]));
        const graded = list.map(it => buildResult(it, ans[it.question.id], byQ.get(it.question.id), it.options.length > 0));
        const score = Number(res.score) || 0;
        const total = Number(res.total_points) || list.reduce((s2, it) => s2 + (it.question.points || 1), 0);

        clearSaved(storageKey);
        setSubmitFailed(false);
        setRetryCount(0);
        setResults(graded);
        setResultCorrect(new Set(Array.isArray(res.correct_option_ids) ? res.correct_option_ids : []));
        setFinalScore({ score, total, minutes });
        setPreviousSubmission({
          id: res.submission_id,
          score,
          total_points: total,
          submitted_at: res.submitted_at || new Date().toISOString()
        });
        setPastReview(null);
        setShowPastReview(false);
        setAttemptsCount(c => c + 1);
        setAutoSubmitted(auto);
        setAutoReason(auto ? reason : null);
        setDeadline(null);
        setQuestionDeadline(null);
        setPhase("result");
        toast.success(tr("Quiz envoyé avec succès", "تم إرسال الاختبار بنجاح", "Quiz submitted successfully"));
        // « Ma note » et les listes de quiz se mettent à jour
        try {
          void refreshData(undefined, { force: true }).catch(() => undefined);
        } catch { /* ignore */ }
      } catch (err) {
        console.error("Error submitting quiz:", err);
        markFailed();
      } finally {
        setIsSubmitting(false);
      }
    },
    [user, exam.id, tr, storageKey, persistAttempt, allEvents, refreshData, isPreview]
  );
  submitRef.current = (auto = false, reason: "time" | "cheat" = "time") => {
    void handleSubmit(auto, reason);
  };

  const retrySubmit = useCallback(() => {
    const { auto, reason } = lastSubmitArgsRef.current;
    void handleSubmit(auto, reason);
  }, [handleSubmit]);

  // Nouvel essai automatique toutes les 10 s (5 fois max) quand le réseau est disponible,
  // et immédiatement au retour de la connexion.
  useEffect(() => {
    if (phase !== "running" || !submitFailed) return;
    const onOnline = () => {
      if (!submittingRef.current) retrySubmit();
    };
    window.addEventListener("online", onOnline);
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (retryCount < MAX_AUTO_RETRIES) {
      timer = setTimeout(() => {
        if (submittingRef.current) return;
        // Hors ligne : on attend l'événement « online »
        if (typeof navigator !== "undefined" && navigator.onLine === false) return;
        setRetryCount(c => c + 1);
        retrySubmit();
      }, RETRY_DELAY_MS);
    }
    return () => {
      window.removeEventListener("online", onOnline);
      if (timer) clearTimeout(timer);
    };
  }, [phase, submitFailed, retryCount, isSubmitting, retrySubmit]);

  // Avertissements avant la fin du temps (5 min, 1 min et 10 s) : toast + annonce lecteur d'écran
  const warnedRef = useRef<{ five: boolean; min: boolean; ten: boolean }>({ five: false, min: false, ten: false });
  useEffect(() => {
    if (phase !== "running" || timeLeft === null) {
      warnedRef.current = { five: false, min: false, ten: false };
      return;
    }
    const vibrate = () => { try { (navigator as any).vibrate?.(200); } catch { /* ignore */ } };
    if (durationMinutes > 5 && timeLeft <= 300 && timeLeft > 60 && !warnedRef.current.five) {
      warnedRef.current.five = true;
      setSrMessage(tr("Il reste 5 minutes.", "تبقّت 5 دقائق.", "5 minutes left."));
    }
    if (durationMinutes > 1 && timeLeft <= 60 && timeLeft > 10 && !warnedRef.current.min) {
      warnedRef.current.min = true;
      vibrate();
      const msg = tr("Plus qu'une minute !", "تبقّت دقيقة واحدة!", "One minute left!");
      setSrMessage(msg);
      toast.warning(msg);
    }
    if (timeLeft <= 10 && timeLeft > 0 && !warnedRef.current.ten) {
      warnedRef.current.ten = true;
      vibrate();
      const left = items.filter(it => !isAnswered(it, answers[it.question.id])).length;
      const msg =
        left > 0
          ? tr(`10 secondes ! ${left} question(s) sans réponse.`, `10 ثوانٍ! ${left} سؤال بدون جواب.`, `10 seconds! ${left} unanswered question(s).`)
          : tr("10 secondes restantes !", "تبقّت 10 ثوانٍ!", "10 seconds left!");
      setSrMessage(msg);
      toast.warning(msg);
    }
  }, [phase, timeLeft, durationMinutes, items, answers, tr]);

  // Fin du temps global → envoi automatique
  useEffect(() => {
    if (phase === "running" && timeLeft === 0 && !submitFailed) {
      toast.warning(tr("Temps écoulé ! Envoi automatique…", "انتهى الوقت! جارٍ الإرسال التلقائي…", "Time is up! Submitting…"));
      handleSubmit(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timeLeft, handleSubmit, tr]);

  // Fin du temps d'une question (mode séquentiel) → question suivante ou envoi
  const expiredRef = useRef<string | null>(null);
  useEffect(() => {
    if (phase !== "running" || !isSequential || questionTimeLeft !== 0 || submitFailed) return;
    const key = `${index}-${questionDeadline}`;
    if (expiredRef.current === key) return;
    expiredRef.current = key;
    if (index < items.length - 1) {
      goTo(index + 1);
    } else {
      handleSubmit(true);
    }
  }, [phase, isSequential, questionTimeLeft, index, items.length, questionDeadline, goTo, handleSubmit, submitFailed]);

  /* ───────────── Raccourcis clavier ───────────── */

  useEffect(() => {
    if (phase !== "running") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      // Ne pas détourner Entrée / lettres sur un bouton, une option, un champ de saisie…
      if (
        target &&
        (target.isContentEditable ||
          (typeof target.closest === "function" &&
            target.closest('button, a, input, textarea, select, [role="radio"], [role="checkbox"], [role="button"]')))
      )
        return;
      // … ni quand une fenêtre de confirmation / d'avertissement est ouverte
      if (confirmOpen || quitOpen || antiCheatRef.current.warningOpen) return;
      if (document.querySelector('[role="alertdialog"]')) return;
      const it = items[index];
      if (!it) return;
      const key = (e.key || "").toLowerCase();
      const letterIdx = key.length === 1 ? "abcdefgh".indexOf(key) : -1;
      const numIdx = key.length === 1 ? "12345678".indexOf(key) : -1;
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

  /* ───────────── Corrigé de la dernière copie ───────────── */

  const loadPastReview = useCallback(async () => {
    const sub = previousSubmission;
    if (!sub?.id) return;
    setPastReviewLoading(true);
    try {
      // Corrigé fourni par le serveur (seulement pour sa propre copie et si l'enseignant l'autorise)
      const { data, error } = await (supabase as any).rpc("quiz_review_for_student", { p_submission_id: sub.id });
      if (error) throw error;
      const review = (data || {}) as { answers?: any[]; correct_option_ids?: string[] };
      const rows = Array.isArray(review.answers) ? review.answers : [];
      const correct = new Set<string>(Array.isArray(review.correct_option_ids) ? review.correct_option_ids : []);
      const byQ = new Map(rows.map(r => [r.question_id, r] as [string, any]));
      const graded = baseItems.map(it => {
        const row = byQ.get(it.question.id);
        let ans: StudentAnswer | undefined;
        if (row) {
          if (it.question.question_type === "short_answer") {
            ans = { selected: [], text: row.text_answer || "" };
          } else if (it.multi && row.text_answer) {
            const texts = String(row.text_answer).split(" ; ").map((t: string) => t.trim());
            ans = { selected: it.options.filter(o => texts.includes(o.option_text.trim())).map(o => o.id), text: "" };
          } else {
            ans = { selected: row.selected_option_id ? [row.selected_option_id] : [], text: "" };
          }
        }
        const hasCorrect = it.options.some(o => correct.has(o.id));
        return buildResult(it, ans, row ? { is_correct: row.is_correct, points_earned: row.points_earned } : undefined, hasCorrect);
      });
      setPastCorrect(correct);
      setPastReview(graded);
      setShowPastReview(true);
      setTimeout(() => reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (err) {
      console.error("Error loading past answers:", err);
      toast.error(tr("Impossible de charger le corrigé.", "تعذر تحميل التصحيح.", "Unable to load the correction."));
    } finally {
      setPastReviewLoading(false);
    }
  }, [previousSubmission, baseItems, tr]);

  const togglePastReview = () => {
    if (showPastReview) {
      setShowPastReview(false);
      return;
    }
    if (pastReview) {
      setShowPastReview(true);
      setTimeout(() => reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
      return;
    }
    void loadPastReview();
  };

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
    if (pct >= 90) return { label: tr("Excellent !", "ممتاز!", "Excellent!"), color: "text-emerald-600 dark:text-emerald-400", ring: "#059669" };
    if (pct >= 75) return { label: tr("Très bien", "جيد جداً", "Very good"), color: "text-primary ", ring: "#0284c7" };
    if (pct >= 60) return { label: tr("Bien", "جيد", "Good"), color: "text-primary ", ring: "#4f46e5" };
    if (pct >= 50) return { label: tr("Passable", "مقبول", "Fair"), color: "text-amber-600 dark:text-amber-400", ring: "#d97706" };
    return { label: tr("À retravailler", "يحتاج إلى مراجعة", "Needs work"), color: "text-rose-600 dark:text-rose-400", ring: "#e11d48" };
  };

  const unansweredCount = items.filter(it => !isAnswered(it, answers[it.question.id])).length;
  const answeredCount = items.length - unansweredCount;
  /** Note sur 20 avec le séparateur décimal de la langue (12,5 en fr/ar, 12.5 en en) */
  const note20 = (score: number, total: number) => formatDecimal(total > 0 ? (score / total) * 20 : 0, language);
  const canReview = settings.allowReview && settings.showResultsImmediately;

  /** Corrigé détaillé (après l'envoi ou pour revoir la dernière copie) */
  const renderReviewList = (graded: QuestionResult[], correct: Set<string>) => (
    <div ref={reviewRef} className="space-y-3 scroll-mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
      {graded.map((r, i) => {
        const tone = !r.gradable
          ? "border-slate-200 dark:border-slate-800"
          : r.isCorrect
          ? "border-emerald-300 dark:border-emerald-900"
          : "border-rose-300 dark:border-rose-900";
        const pts = r.item.question.points || 1;
        return (
          <div key={r.item.question.id} className={`rounded-xl border-2 bg-card p-5 ${tone}`}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-sm font-semibold">{i + 1}</span>
                {r.gradable ? (
                  r.isCorrect ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" /> {tr("Correct", "صحيح", "Correct")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                      <XCircle className="h-4 w-4" />
                      {r.answered ? tr("Incorrect", "خطأ", "Incorrect") : tr("Sans réponse", "بدون جواب", "Unanswered")}
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <PenLine className="h-4 w-4" /> {tr("Correction par l'enseignant", "يصححه الأستاذ", "Graded by teacher")}
                  </span>
                )}
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full tabular-nums ${r.isCorrect ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                <span dir="ltr">{formatDecimal(r.earned, language, 2)}/{pts}</span> {tr("pt", "نقطة", "pt")}
              </span>
            </div>
            <MathHtml className="quiz-question-html text-sm font-medium mb-3" html={r.item.html} />

            {r.item.question.question_type === "short_answer" ? (
              <div className="rounded-xl bg-muted/50 p-3 text-sm">
                <span className="text-xs font-semibold text-muted-foreground block mb-1">{tr("Votre réponse", "إجابتك", "Your answer")}</span>
                {r.answer?.text?.trim() || <em className="text-muted-foreground">—</em>}
              </div>
            ) : (
              <div className="grid gap-2">
                {r.item.options.map(opt => {
                  const chosen = !!r.answer?.selected.includes(opt.id);
                  const isRight = correct.has(opt.id);
                  const cls = isRight
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-800"
                    : chosen
                    ? "border-rose-300 bg-rose-50 text-rose-900 dark:bg-rose-950/30 dark:text-rose-200 dark:border-rose-800"
                    : "border-border text-muted-foreground";
                  return (
                    <div key={opt.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${cls}`}>
                      {isRight ? <Check className="h-4 w-4 shrink-0" /> : chosen ? <X className="h-4 w-4 shrink-0" /> : <span className="h-4 w-4 shrink-0" />}
                      <MathText className="flex-1" text={optionLabel(opt)} />
                      {chosen && (
                        <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
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
  );

  /** Bouton « Voir le corrigé » de la dernière copie (quiz déjà passé) */
  const pastReviewButton = canReview && previousSubmission?.id ? (
    <Button
      variant="outline"
      onClick={togglePastReview}
      disabled={pastReviewLoading}
      aria-expanded={showPastReview}
      className="w-full h-11 rounded-xl gap-2 font-semibold"
    >
      {pastReviewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : showPastReview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      {showPastReview
        ? tr("Masquer le corrigé", "إخفاء التصحيح", "Hide correction")
        : tr("Voir le corrigé", "عرض التصحيح", "See the correction")}
    </Button>
  ) : null;

  /* ═══════════════════════════════ RENDU ═══════════════════════════════ */

  // ─── Chargement ───
  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4" dir={isRtl ? "rtl" : "ltr"}>
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-4 border-primary/15" />
          <Loader2 className="h-16 w-16 text-primary animate-spin absolute top-0 left-0" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          {tr("Préparation de votre quiz…", "جارٍ تحضير الاختبار…", "Preparing your quiz…")}
        </p>
      </div>
    );
  }

  // ─── Erreur de chargement ───
  if (phase === "error") {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4" dir={isRtl ? "rtl" : "ltr"} role="alert">
        <div className="mx-auto h-14 w-14 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
          <WifiOff className="h-7 w-7" />
        </div>
        <p className="text-lg font-semibold">{loadError || tr("Impossible de charger le quiz.", "تعذر تحميل الاختبار.", "Unable to load the quiz.")}</p>
        <p className="text-sm text-muted-foreground">
          {tr(
            "Vérifie ta connexion puis réessaie.",
            "تحقق من اتصالك ثم أعد المحاولة.",
            "Check your connection and try again."
          )}
        </p>
        <div className="flex flex-col-reverse sm:flex-row gap-3 justify-center">
          <Button variant="outline" onClick={onClose} className="h-11 rounded-xl px-6">
            {tr("Fermer", "إغلاق", "Close")}
          </Button>
          <Button onClick={() => setReloadKey(k => k + 1)} className="h-11 rounded-xl px-6 gap-2 font-semibold">
            <RefreshCw className="h-4 w-4" />
            {tr("Réessayer", "إعادة المحاولة", "Try again")}
          </Button>
        </div>
      </div>
    );
  }

  // ─── Tentative en cours sauvegardée sur cet appareil ───
  if (phase === "resume" && savedAttempt) {
    const remaining = savedAttempt.deadline ? Math.max(0, Math.ceil((savedAttempt.deadline - Date.now()) / 1000)) : null;
    const answeredSaved = baseItems.filter(it => isAnswered(it, savedAttempt.answers?.[it.question.id])).length;
    return (
      <div className="max-w-xl mx-auto animate-in fade-in zoom-in-95 duration-300" dir={isRtl ? "rtl" : "ltr"}>
        <div className="rounded-xl border bg-card shadow-xl overflow-hidden">
          <div className="bg-primary p-8 text-center text-primary-foreground">
            <div className="mx-auto mb-4 h-16 w-16 rounded-xl bg-white/15 flex items-center justify-center">
              <PlayCircle className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-semibold">{tr("Quiz en cours", "اختبار قيد الإنجاز", "Quiz in progress")}</h2>
            <p className="mt-2 text-sm text-primary-foreground/80">
              {tr(
                "Tes réponses ont été sauvegardées sur cet appareil. Le chrono a continué pendant ton absence.",
                "تم حفظ إجاباتك على هذا الجهاز. استمر العد التنازلي أثناء غيابك.",
                "Your answers were saved on this device. The timer kept running while you were away."
              )}
            </p>
          </div>
          <div className="p-6 space-y-5 text-center">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border p-3">
                <p className="text-xs font-semibold text-muted-foreground">{tr("Temps restant", "الوقت المتبقي", "Time left")}</p>
                <p className="text-2xl font-semibold tabular-nums" dir="ltr">{remaining === null ? "∞" : formatTimer(remaining)}</p>
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-xs font-semibold text-muted-foreground">{tr("Réponses", "الإجابات", "Answers")}</p>
                <p className="text-2xl font-semibold tabular-nums" dir="ltr">{answeredSaved}/{baseItems.length}</p>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <Button variant="outline" onClick={onClose} className="h-11 rounded-xl sm:flex-1">
                {tr("Plus tard", "لاحقاً", "Later")}
              </Button>
              <Button onClick={() => restoreAttempt(savedAttempt, baseItems)} className="h-11 rounded-xl sm:flex-1 gap-2 font-semibold">
                <PlayCircle className="h-4 w-4" />
                {tr("Reprendre", "متابعة", "Resume")}
              </Button>
            </div>
          </div>
        </div>
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
        <div className="rounded-xl border bg-card shadow-xl overflow-hidden">
          <div className="bg-zinc-900 p-8 text-center text-white">
            <div className="mx-auto mb-4 h-16 w-16 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
              <Lock className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-semibold">{tr("Quiz déjà passé", "تم اجتياز الاختبار", "Quiz already taken")}</h2>
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
                <p className="text-4xl font-semibold tabular-nums" dir="ltr">
                  {formatDecimal(Number(sc) || 0, language, 2)}
                  <span className="text-xl text-muted-foreground font-semibold"> / {tot}</span>
                </p>
                <p className={`text-sm font-semibold ${mention(pct).color}`}>
                  {pct}% · <span dir="ltr">{note20(Number(sc) || 0, Number(tot) || 0)}/20</span> · {mention(pct).label}
                </p>
                {!canReview && (
                  <p className="pt-2 text-xs text-muted-foreground">
                    {tr(
                      "Ton enseignant n'a pas activé la consultation du corrigé pour ce quiz.",
                      "لم يفعّل أستاذك الاطلاع على التصحيح لهذا الاختبار.",
                      "Your teacher hasn't enabled viewing the correction for this quiz."
                    )}
                  </p>
                )}
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
            {pastReviewButton}
            <Button onClick={onClose} className="w-full h-11 rounded-xl font-semibold">
              {tr("Fermer", "إغلاق", "Close")}
            </Button>
          </div>
        </div>
        {showPastReview && pastReview && <div className="mt-5">{renderReviewList(pastReview, pastCorrect)}</div>}
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
      ...(settings.antiCheat !== false
        ? [
            {
              icon: <ShieldAlert className="h-4 w-4" />,
              text: tr(
                `Quiz protégé : copier/coller bloqué, votre nom en filigrane. Si vous quittez la page ${maxFocusLosses} fois, le quiz est envoyé automatiquement.`,
                `اختبار محمي: النسخ واللصق ممنوعان واسمك يظهر كعلامة مائية. إذا غادرت الصفحة ${maxFocusLosses} مرات يُرسل الاختبار تلقائياً.`,
                `Protected quiz: copy/paste blocked, your name as a watermark. Leaving the page ${maxFocusLosses} times submits the quiz automatically.`
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
      { icon: <HelpCircle className="h-5 w-5" />, value: items.length, label: tr("Questions", "أسئلة", "Questions"), tone: "text-muted-foreground" },
      { icon: <Target className="h-5 w-5" />, value: totalPoints, label: tr("Points", "نقاط", "Points"), tone: "text-muted-foreground" },
      { icon: <Clock className="h-5 w-5" />, value: `${durationMinutes}`, label: tr("Minutes", "دقيقة", "Minutes"), tone: "text-muted-foreground" },
      {
        icon: <RefreshCw className="h-5 w-5" />,
        value: settings.allowMultipleAttempts ? "∞" : "1",
        label: tr("Tentative(s)", "محاولة", "Attempt(s)"),
        tone: "text-muted-foreground"
      }
    ];

    return (
      <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300" dir={isRtl ? "rtl" : "ltr"}>
        <div className="rounded-xl border bg-card shadow-xl overflow-hidden">
          {/* Bandeau */}
          <div className="relative overflow-hidden bg-primary px-6 py-8 sm:px-8 text-primary-foreground">
            <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-primary/10 blur-2xl" />
            <div className="relative flex items-start gap-4">
              <div className="h-14 w-14 shrink-0 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/25">
                <Sparkles className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.18em] font-semibold text-primary-foreground/70">
                  {tr("Quiz", "اختبار", "Quiz")}
                </p>
                <h2 className="text-2xl font-semibold leading-tight break-words">{exam.title}</h2>
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
                <div key={i} className={`rounded-lg border bg-card p-4 ${s.tone}`}>
                  <div className="flex items-center justify-between">
                    {s.icon}
                    <span className="text-2xl font-semibold text-foreground tabular-nums">{s.value}</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Tentative précédente */}
            {previousSubmission && (
              <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-accent   p-4">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Trophy className="h-5 w-5" />
                </div>
                <div className="flex-1 text-sm">
                  <p className="font-semibold text-primary ">
                    {tr(`Tentative n° ${attemptsCount + 1}`, `المحاولة رقم ${attemptsCount + 1}`, `Attempt #${attemptsCount + 1}`)}
                  </p>
                  <p className="text-primary/80  text-xs">
                    {settings.showResultsImmediately
                      ? tr(
                          `Dernière note : ${formatDecimal(Number(previousSubmission.score) || 0, language, 2)} / ${previousSubmission.total_points} pts`,
                          `آخر نقطة: ${formatDecimal(Number(previousSubmission.score) || 0, language, 2)} / ${previousSubmission.total_points}`,
                          `Last score: ${formatDecimal(Number(previousSubmission.score) || 0, language, 2)} / ${previousSubmission.total_points} pts`
                        )
                      : tr("Votre tentative précédente a été enregistrée.", "تم حفظ محاولتك السابقة.", "Your previous attempt was saved.")}
                  </p>
                </div>
              </div>
            )}
            {pastReviewButton}
            {showPastReview && pastReview && renderReviewList(pastReview, pastCorrect)}

            {/* Consignes */}
            <div className="rounded-xl border bg-muted/30 p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
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
              <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-300">
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
                className="h-12 rounded-xl px-8 text-base font-semibold bg-primary hover:opacity-95 shadow-lg shadow-primary/25 gap-2"
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
    // La correction détaillée révèle la note : elle n'est proposée que si les résultats sont visibles (canReview)

    return (
      <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in zoom-in-95 duration-300" dir={isRtl ? "rtl" : "ltr"}>
        <div className="rounded-xl border bg-card shadow-xl overflow-hidden">
          <div className="relative overflow-hidden bg-primary px-6 pt-8 pb-24 text-center text-primary-foreground">
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
            <h2 className="relative text-2xl font-semibold">
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
                  <svg viewBox="0 0 128 128" className="absolute top-0 left-0 h-full w-full -rotate-90">
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
                    <div className="text-4xl font-semibold tabular-nums">{pct}%</div>
                    <div className="text-xs font-semibold text-muted-foreground tabular-nums">
                      <span dir="ltr">{formatDecimal(finalScore.score, language, 2)}/{finalScore.total}</span> {tr("pts", "نقطة", "pts")}
                    </div>
                    {finalScore.total > 0 && (
                      <div className="mt-0.5 text-[11px] font-semibold text-primary tabular-nums">
                        <span dir="ltr">{note20(finalScore.score, finalScore.total)}/20</span>
                      </div>
                    )}
                  </div>
                </div>
                <p className={`text-center text-xl font-semibold ${m.color}`}>{m.label}</p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { icon: <CheckCircle2 className="h-5 w-5" />, v: correct, l: tr("Correctes", "صحيحة", "Correct"), c: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" },
                    { icon: <XCircle className="h-5 w-5" />, v: wrong, l: tr("Incorrectes", "خاطئة", "Wrong"), c: "text-rose-600 dark:text-rose-400 bg-rose-500/10" },
                    { icon: <MinusCircle className="h-5 w-5" />, v: empty, l: tr("Sans réponse", "بدون جواب", "Unanswered"), c: "text-slate-500 dark:text-slate-400 bg-slate-500/10" },
                    { icon: <Clock className="h-5 w-5" />, v: `${finalScore.minutes}′`, l: tr("Durée", "المدة", "Time"), c: "text-amber-600 dark:text-amber-400 bg-amber-500/10" }
                  ].map((s, i) => (
                    <div key={i} className="rounded-xl border p-3 flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${s.c}`}>{s.icon}</div>
                      <div>
                        <div className="text-xl font-semibold tabular-nums leading-none">{s.v}</div>
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
              <div className="mx-auto max-w-md rounded-xl border bg-card shadow-lg p-6 text-center">
                <div className="mx-auto h-14 w-14 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-3">
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
                <Button
                  variant="outline"
                  onClick={() => {
                    const open = !showReview;
                    setShowReview(open);
                    if (open) setTimeout(() => reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
                  }}
                  className="h-11 rounded-xl gap-2 font-semibold"
                >
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
        {canReview && showReview && renderReviewList(graded, resultCorrect)}
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

  // Nom + code Massar (l'e-mail technique « @student.internal » n'est jamais affiché)
  const rawEmail = user?.email || "";
  const idLabel = /@student\.internal$/i.test(rawEmail) ? rawEmail.split("@")[0].toUpperCase() : rawEmail;
  const watermarkText = `${user?.name || ""} · ${idLabel} · ${new Date(startTimeRef.current || Date.now()).toLocaleString(localeFor(language))}`;

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
            <div className="fixed top-0 left-0 h-full w-full z-[100] bg-background flex items-center justify-center p-6 text-center">
              <div className="max-w-sm space-y-3">
                <ShieldAlert className="h-12 w-12 mx-auto text-rose-500" />
                <p className="text-lg font-semibold">{tr("Quiz masqué", "الاختبار مخفي", "Quiz hidden")}</p>
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
            <AlertDialogContent className="rounded-xl max-w-md">
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
      {/* Annonces pour lecteurs d'écran (5 min, 1 min, 10 s) — le chrono lui-même n'est pas « live » */}
      <div className="sr-only" aria-live="assertive" aria-atomic="true">{srMessage}</div>

      {/* Barre supérieure */}
      <div className="sticky top-0 z-20 -mx-3 sm:-mx-6 -mt-3 sm:-mt-6 mb-5 px-3 sm:px-6 pt-3 sm:pt-4 pb-3 bg-background/85 backdrop-blur-md border-b">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-semibold truncate">{exam.title}</h2>
            <p className="text-xs text-muted-foreground">
              {tr(
                `Question ${index + 1} sur ${items.length} · ${answeredCount} répondue(s)`,
                `السؤال ${index + 1} من ${items.length} · ${answeredCount} مُجاب`,
                `Question ${index + 1} of ${items.length} · ${answeredCount} answered`
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {timeLeft !== null && (
              <div
                className={`flex items-center gap-2 rounded-xl px-3 sm:px-3.5 py-2 font-mono text-base font-semibold tabular-nums shadow-sm border transition-colors ${
                  globalLow
                    ? "bg-rose-500 text-white border-rose-500 motion-safe:animate-pulse"
                    : timeLeft <= 300
                    ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900"
                    : "bg-card text-foreground"
                }`}
                role="timer"
                aria-label={tr("Temps restant", "الوقت المتبقي", "Time left")}
                dir="ltr"
              >
                <Clock className="h-4 w-4" />
                {formatTimer(timeLeft)}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => setQuitOpen(true)}
              className="h-10 rounded-xl gap-1.5 px-2.5 sm:px-3 text-sm font-semibold"
              aria-label={tr("Quitter le quiz", "مغادرة الاختبار", "Leave the quiz")}
            >
              <LogOut className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />
              <span className="hidden sm:inline">{tr("Quitter", "مغادرة", "Leave")}</span>
            </Button>
          </div>
        </div>
        {submitFailed && (
          <div role="alert" className="mt-3 flex flex-col gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-start gap-2">
              <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {tr(
                  "L'envoi a échoué. Tes réponses sont sauvegardées sur cet appareil ; nouvel essai automatique dès que la connexion revient.",
                  "فشل الإرسال. إجاباتك محفوظة على هذا الجهاز؛ ستتم إعادة المحاولة تلقائياً عند عودة الاتصال.",
                  "Submission failed. Your answers are saved on this device; it will retry automatically when the connection is back."
                )}
              </span>
            </span>
            <Button
              size="sm"
              onClick={() => { setRetryCount(0); retrySubmit(); }}
              disabled={isSubmitting}
              className="h-10 shrink-0 gap-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {tr("Réessayer l'envoi", "إعادة محاولة الإرسال", "Retry sending")}
            </Button>
          </div>
        )}
        <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_250px]">
        {/* Carte question */}
        <div key={qid} className="relative rounded-xl border bg-card shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
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
                className={`h-full motion-safe:transition-all motion-safe:duration-1000 ease-linear ${qLow ? "bg-rose-500" : "bg-amber-500"}`}
                style={{ width: `${qPct}%` }}
              />
            </div>
          )}

          <div className="p-5 sm:p-7 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-xl bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground shadow-sm">
                {tr("Question", "السؤال", "Question")} {index + 1}
              </span>
              <span className="inline-flex items-center rounded-xl border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                {item.question.points || 1} {tr("pt", "نقطة", "pt")}
              </span>
              {item.multi && (
                <span className="inline-flex items-center gap-1 rounded-xl bg-primary/10 text-primary  px-2.5 py-1 text-xs font-semibold">
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
                  className={`ms-auto inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 font-mono text-sm font-semibold tabular-nums ${
                    qLow ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 motion-safe:animate-pulse" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  }`}
                  role="timer"
                  aria-label={tr("Temps restant pour cette question", "الوقت المتبقي لهذا السؤال", "Time left for this question")}
                  dir="ltr"
                >
                  <Timer className="h-4 w-4" />
                  {formatTimer(questionTimeLeft)}
                </span>
              )}
            </div>

            <MathHtml
              className="quiz-question-html text-lg sm:text-xl font-semibold leading-relaxed text-foreground"
              html={item.html}
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
                      disabled={disabled || timeUp || submitFailed}
                      onClick={() => selectOption(item, opt.id)}
                      className={`group relative flex w-full items-center gap-4 rounded-xl border-2 p-4 text-start transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 ${
                        selected
                          ? "border-primary bg-primary/[0.07] shadow-md shadow-primary/10"
                          : disabled
                          ? "border-border opacity-50 cursor-not-allowed"
                          : "border-border hover:border-primary/50 hover:bg-muted/40 hover:shadow-md"
                      }`}
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center text-sm font-semibold transition-colors ${
                          item.multi ? "rounded-lg" : "rounded-full"
                        } ${
                          selected
                            ? "bg-primary text-primary-foreground shadow"
                            : "bg-muted text-muted-foreground group-hover:bg-primary/15 group-hover:text-primary"
                        }`}
                      >
                        {selected && item.multi ? <Check className="h-5 w-5" /> : String.fromCharCode(65 + oIdx)}
                      </span>
                      <MathText className="flex-1 text-base font-medium" text={opt.option_text} />
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
                      disabled={disabled || timeUp || submitFailed}
                      onClick={() => selectOption(item, opt.id)}
                      className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 p-6 sm:p-8 transition-all duration-200 focus:outline-none focus-visible:ring-4 ${
                        isTrue ? "focus-visible:ring-emerald-500/25" : "focus-visible:ring-rose-500/25"
                      } ${
                        selected
                          ? isTrue
                            ? "border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10"
                            : "border-rose-500 bg-rose-500/10 shadow-lg shadow-rose-500/10"
                          : disabled
                          ? "border-border opacity-50 cursor-not-allowed"
                          : "border-border hover:shadow-md " +
                            (isTrue ? "hover:border-emerald-400" : "hover:border-rose-400")
                      }`}
                    >
                      <span
                        className={`flex h-14 w-14 items-center justify-center rounded-xl transition-colors ${
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
                      <span className="text-lg font-semibold">{optionLabel(opt)}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Réponse libre */}
            {type === "short_answer" && (
              <div className="space-y-2">
                <Textarea
                  ref={answerAreaRef}
                  placeholder={tr("Rédigez votre réponse ici…", "اكتب إجابتك هنا…", "Write your answer here…")}
                  value={ans?.text || ""}
                  onChange={e => {
                    const native = e.nativeEvent as InputEvent | undefined;
                    setTextAnswer(item, e.target.value, (native && native.inputType) || "", !!(native && native.isComposing));
                  }}
                  onCompositionStart={() => { composingRef.current = true; }}
                  onCompositionEnd={() => {
                    composingRef.current = false;
                    compositionEndAtRef.current = Date.now();
                  }}
                  disabled={isLocked || timeUp || submitFailed}
                  rows={5}
                  className="rounded-xl border-2 text-base p-4 focus-visible:ring-primary/25 resize-y"
                />
                <MathSymbolBar
                  disabled={isLocked || timeUp || submitFailed}
                  onInsert={(sym, caret) => {
                    const el = answerAreaRef.current;
                    const cur = ans?.text || "";
                    const start = el ? el.selectionStart : cur.length;
                    const end = el ? el.selectionEnd : cur.length;
                    // Focus synchrone (dans le geste de l'utilisateur) : iOS garde le clavier ouvert
                    try { el?.focus(); } catch { /* ignore */ }
                    setTextAnswer(item, cur.slice(0, start) + sym + cur.slice(end));
                    requestAnimationFrame(() => {
                      if (!el) return;
                      const pos = start + caret;
                      try { el.setSelectionRange(pos, pos); } catch { /* ancien iOS */ }
                    });
                  }}
                />
                <SimpleMathPreview text={ans?.text || ""} />
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
              <Button onClick={goNext} disabled={timeUp || submitFailed} className="h-11 rounded-xl px-6 gap-2 font-semibold shadow-sm">
                {tr("Suivant", "التالي", "Next")}
                <ArrowRight className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />
              </Button>
            ) : (
              <Button
                onClick={() => (submitFailed ? retrySubmit() : setConfirmOpen(true))}
                disabled={isSubmitting}
                className="h-11 rounded-xl px-6 gap-2 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {tr("Terminer le quiz", "إنهاء الاختبار", "Finish quiz")}
              </Button>
            )}
          </div>
        </div>

        {/* Panneau de navigation */}
        <aside aria-label={tr("Navigation entre les questions", "التنقل بين الأسئلة", "Question navigation")}>
          <div className="lg:sticky lg:top-28 rounded-xl border bg-card p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{tr("Questions", "الأسئلة", "Questions")}</p>
              <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                {answeredCount}/{items.length}
              </span>
            </div>
            <div className="flex lg:grid lg:grid-cols-5 gap-2 overflow-x-auto pb-1 lg:pb-0">
              {items.map((it, i) => {
                const st = navState(i);
                const lockedQ = !!locked[it.question.id];
                const answeredQ = isAnswered(it, answers[it.question.id]);
                const stateLabel = [
                  answeredQ ? tr("répondue", "مُجاب", "answered") : tr("sans réponse", "بدون جواب", "not answered"),
                  ...(lockedQ ? [tr("verrouillée", "مقفل", "locked")] : [])
                ].join(", ");
                const chipLabel = `${tr("Question", "السؤال", "Question")} ${i + 1} : ${stateLabel}`;
                return (
                  <button
                    key={it.question.id}
                    type="button"
                    disabled={isSequential}
                    onClick={() => goTo(i)}
                    title={chipLabel}
                    aria-label={chipLabel}
                    aria-current={st === "current" ? "step" : undefined}
                    className={`relative h-10 w-10 shrink-0 rounded-xl text-sm font-semibold transition-all ${
                      st === "current"
                        ? "bg-primary text-primary-foreground shadow-md scale-105"
                        : st === "answered"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                        : "bg-muted text-muted-foreground border border-transparent"
                    } ${isSequential ? "cursor-default" : "hover:ring-2 hover:ring-primary/30"}`}
                  >
                    {i + 1}
                    {lockedQ && (
                      <Lock aria-hidden="true" className="absolute -top-1 -right-1 rtl:right-auto rtl:-left-1 h-3.5 w-3.5 rounded-full bg-card p-0.5 text-slate-500" />
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
                onClick={() => (submitFailed ? retrySubmit() : setConfirmOpen(true))}
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

      {/* Confirmation de sortie (le chrono continue, les réponses restent sur l'appareil) */}
      <AlertDialog open={quitOpen} onOpenChange={setQuitOpen}>
        <AlertDialogContent className="rounded-xl" dir={isRtl ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <LogOut className={`h-5 w-5 text-rose-600 ${isRtl ? "rotate-180" : ""}`} />
              {tr("Quitter le quiz ?", "مغادرة الاختبار؟", "Leave the quiz?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tr(
                "Tes réponses sont sauvegardées sur cet appareil et le chrono continue.",
                "إجاباتك محفوظة على هذا الجهاز والعد التنازلي مستمر.",
                "Your answers are saved on this device and the timer keeps running."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl">{tr("Continuer le quiz", "متابعة الاختبار", "Keep going")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                persistAttempt();
                setQuitOpen(false);
                onClose();
              }}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white gap-2"
            >
              <LogOut className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />
              {tr("Quitter", "مغادرة", "Leave")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation d'envoi */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-xl" dir={isRtl ? "rtl" : "ltr"}>
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

/**
 * Éléments de l'espace élève organisés par cours : lignes d'exercices et d'évaluations,
 * statuts (à rendre, en retard, rendu…) et regroupement par cours.
 */
import { type ReactNode } from "react";
import { ArrowRight, BookOpen, CalendarClock, CheckCircle2, ChevronRight, ClipboardCheck, Clock, FileText, Paperclip, Timer } from "lucide-react";
import { Link } from "@/lib/router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime } from "@/lib/formatDate";
import type { Exam, Exercise } from "@/contexts/CourseContext";

export type Tr = (fr: string, ar: string, en: string) => string;

const DAY = 86400000;

export const dueTime = (ex: Exercise) => {
  const t = ex.due_date ? new Date(ex.due_date).getTime() : NaN;
  return isNaN(t) ? null : t;
};

/** Échéance la plus proche d'abord, sans échéance à la fin */
export const byUrgency = (a: Exercise, b: Exercise) => {
  const ta = dueTime(a), tb = dueTime(b);
  if (ta === null && tb === null) return 0;
  if (ta === null) return 1;
  if (tb === null) return -1;
  return ta - tb;
};

export type DueState = "none" | "late" | "soon" | "todo";

export const dueState = (ex: Exercise, now: number): DueState => {
  const t = dueTime(ex);
  if (t === null) return "none";
  if (t < now) return "late";
  if (t - now <= 2 * DAY) return "soon";
  return "todo";
};

const DUE_STYLE: Record<DueState, string> = {
  none: "bg-muted text-muted-foreground border-transparent",
  late: "bg-rose-500/10 text-rose-700 border-rose-300 dark:text-rose-300 dark:border-rose-800",
  soon: "bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-300 dark:border-amber-800",
  todo: "bg-primary/10 text-primary border-primary/30",
};

export const dueLabel = (s: DueState, tr: Tr) =>
  s === "none" ? tr("Sans échéance", "بدون موعد", "No due date")
  : s === "late" ? tr("En retard", "متأخر", "Overdue")
  : s === "soon" ? tr("Bientôt", "قريباً", "Due soon")
  : tr("À rendre", "للتسليم", "To do");

/* ───────────── exercices ───────────── */

/** État de la copie de l'élève pour un exercice (table exercise_submissions) */
export interface MySubmissionState {
  status: "submitted" | "returned";
  grade: number | null;
  max_grade: number;
}

export function ExerciseRow({
  exercise, attachments, now, language, tr, onOpen, courseLabel, submission,
}: {
  exercise: Exercise;
  attachments: number;
  now: number;
  language: string;
  tr: Tr;
  onOpen: () => void;
  /** nom du cours, quand la ligne est affichée hors de son groupe */
  courseLabel?: string;
  /** copie déjà rendue par l'élève */
  submission?: MySubmissionState;
}) {
  const state = dueState(exercise, now);
  const num = (v: number) => v.toLocaleString(language === "ar" ? "ar-MA" : language === "fr" ? "fr-FR" : "en-GB", { maximumFractionDigits: 2 });
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-start gap-3 px-4 py-3.5 text-start transition-colors hover:bg-muted/50 focus:outline-none focus-visible:bg-muted/60 sm:px-5"
      >
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background">
          <FileText className="h-4 w-4 text-muted-foreground" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium leading-snug group-hover:text-primary">{exercise.title}</span>
            {submission ? (
              <Badge variant="outline" className="border-emerald-300 bg-emerald-500/10 text-[11px] font-medium text-emerald-700 dark:border-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="me-1 h-3 w-3" />
                {submission.status === "returned"
                  ? submission.grade !== null
                    ? `${tr("Corrigé", "مصحح", "Graded")} · ${num(submission.grade)}/${num(submission.max_grade)}`
                    : tr("Corrigé", "مصحح", "Graded")
                  : tr("Rendu", "تم الإرسال", "Handed in")}
              </Badge>
            ) : (
              <Badge variant="outline" className={cn("text-[11px] font-medium", DUE_STYLE[state])}>{dueLabel(state, tr)}</Badge>
            )}
          </span>
          {exercise.description && <span className="mt-0.5 line-clamp-1 block text-sm text-muted-foreground">{exercise.description}</span>}
          <span className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {courseLabel && (
              <span className="inline-flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" />
                {courseLabel}
              </span>
            )}
            {state !== "none" && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {tr("Date limite :", "آخر أجل:", "Due:")} {formatDate(exercise.due_date, language)}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Paperclip className="h-3.5 w-3.5" />
              {attachments
                ? tr(`${attachments} pièce${attachments > 1 ? "s" : ""} jointe${attachments > 1 ? "s" : ""}`, `${attachments} مرفق`, `${attachments} attachment${attachments > 1 ? "s" : ""}`)
                : tr("Aucune pièce jointe", "بدون مرفقات", "No attachment")}
            </span>
          </span>
        </span>
        <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground/60 rtl:rotate-180" />
      </button>
    </li>
  );
}

/* ───────────── évaluations ───────────── */

export type ExamState = "done" | "open" | "upcoming" | "closed" | "scheduled" | "past";

export const examState = (exam: Exam, now: number, submitted: boolean): ExamState => {
  if (exam.type === "quiz") {
    if (submitted) return "done";
    const from = exam.available_from ? new Date(exam.available_from).getTime() : null;
    const until = exam.available_until ? new Date(exam.available_until).getTime() : null;
    if (from && from > now) return "upcoming";
    if (until && until < now) return "closed";
    return "open";
  }
  const at = exam.exam_date ? new Date(exam.exam_date).getTime() : NaN;
  return !isNaN(at) && at < now ? "past" : "scheduled";
};

const EXAM_STYLE: Record<ExamState, string> = {
  done: "bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-800",
  open: "bg-primary/10 text-primary border-primary/30",
  upcoming: "bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-300 dark:border-amber-800",
  closed: "bg-muted text-muted-foreground border-transparent",
  scheduled: "bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-300 dark:border-amber-800",
  past: "bg-muted text-muted-foreground border-transparent",
};

const examLabel = (s: ExamState, tr: Tr) =>
  s === "done" ? tr("Rendu", "تم التسليم", "Submitted")
  : s === "open" ? tr("Disponible", "متاح", "Available")
  : s === "upcoming" ? tr("Bientôt disponible", "قريباً", "Coming soon")
  : s === "closed" ? tr("Fermé", "مغلق", "Closed")
  : s === "scheduled" ? tr("À venir", "قادم", "Upcoming")
  : tr("Passé", "انتهى", "Past");

export function ExamRow({ exam, state, language, tr, href }: { exam: Exam; state: ExamState; language: string; tr: Tr; href: string }) {
  const isQuiz = exam.type === "quiz";
  const when = isQuiz
    ? exam.available_until
      ? `${tr("Jusqu'au", "حتى", "Until")} ${formatDateTime(exam.available_until, language)}`
      : exam.available_from
        ? `${tr("À partir du", "ابتداءً من", "From")} ${formatDateTime(exam.available_from, language)}`
        : null
    : exam.exam_date
      ? formatDateTime(exam.exam_date, language)
      : null;
  return (
    <li className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background">
        {isQuiz ? <ClipboardCheck className="h-4 w-4 text-muted-foreground" /> : <CalendarClock className="h-4 w-4 text-muted-foreground" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium leading-snug">{exam.title}</span>
          <Badge variant="outline" className="text-[11px] font-medium">{isQuiz ? tr("Quiz", "اختبار", "Quiz") : tr("Examen", "امتحان", "Exam")}</Badge>
          <Badge variant="outline" className={cn("text-[11px] font-medium", EXAM_STYLE[state])}>
            {state === "done" && <CheckCircle2 className="me-1 h-3 w-3" />}
            {examLabel(state, tr)}
          </Badge>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {when && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {when}
            </span>
          )}
          {exam.duration_minutes > 0 && (
            <span className="inline-flex items-center gap-1">
              <Timer className="h-3.5 w-3.5" />
              {exam.duration_minutes} min
            </span>
          )}
        </div>
      </div>
      <Button asChild size="sm" variant={isQuiz && state === "open" ? "default" : "outline"} className="h-8 shrink-0">
        <Link to={href}>
          {isQuiz && state === "open" ? tr("Commencer", "ابدأ", "Start") : tr("Voir", "عرض", "View")}
        </Link>
      </Button>
    </li>
  );
}

/* ───────────── cadres ───────────── */

/** Carte d'une section (Ressources, Exercices…) avec titre, compteur et action */
export function Section({
  id, icon: Icon, title, count, action, children, empty,
}: {
  id?: string;
  icon: typeof BookOpen;
  title: string;
  count?: number;
  action?: ReactNode;
  children?: ReactNode;
  empty?: string;
}) {
  return (
    <section id={id} className="scroll-mt-20 overflow-hidden rounded-xl border bg-card">
      <header className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{title}</h2>
        {count !== undefined && <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{count}</span>}
        <div className="ms-auto">{action}</div>
      </header>
      {count === 0 && empty ? <p className="px-4 py-6 text-sm text-muted-foreground sm:px-5">{empty}</p> : children}
    </section>
  );
}

/** En-tête d'un groupe « cours » dans la page Exercices */
export function CourseGroupHeader({ title, roomName, href, total, late, tr }: { title: string; roomName?: string; href: string; total: number; late: number; tr: Tr }) {
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-muted/30 px-4 py-3 sm:px-5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <BookOpen className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <Link to={href} className="font-semibold leading-tight hover:text-primary hover:underline">{title}</Link>
        <p className="text-xs text-muted-foreground">
          {roomName ? `${roomName} · ` : ""}
          {tr(`${total} exercice${total > 1 ? "s" : ""}`, `${total} تمرين`, `${total} exercise${total > 1 ? "s" : ""}`)}
          {late > 0 && <span className="text-rose-600 dark:text-rose-400"> · {tr(`${late} en retard`, `${late} متأخر`, `${late} overdue`)}</span>}
        </p>
      </div>
      <Link to={href} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
        {tr("Voir le cours", "عرض الدرس", "Open course")}
        <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
      </Link>
    </header>
  );
}

/* ───────────── liste des cours (élève) ───────────── */

export interface CourseCardData {
  id: string;
  title: string;
  description?: string;
  roomName?: string;
  cover: ReactNode;
  resources: number;
  exercises: number;
  pending: number;
  late: number;
  exams: number;
  /** undefined : jamais ouvert ; null : ouvert, pas fini ; date : lu */
  readAt?: string | null;
}

export function StudentCourseCards({ items, tr }: { items: CourseCardData[]; tr: Tr }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((c) => (
        <article key={c.id} className="group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:border-foreground/20">
          <div className="pointer-events-none">{c.cover}</div>
          <div className="flex flex-1 flex-col p-4">
            <div className="flex items-center justify-between gap-2">
              {c.roomName ? <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{c.roomName}</p> : <span />}
              {c.readAt ? (
                <Badge variant="secondary" className="gap-1 text-[10px]"><CheckCircle2 className="h-3 w-3 text-emerald-600" />{tr("Lu", "مقروء", "Read")}</Badge>
              ) : c.readAt === null ? (
                <Badge variant="outline" className="text-[10px]">{tr("Reprendre", "متابعة", "Resume")}</Badge>
              ) : null}
            </div>
            <h3 className="mt-0.5 font-semibold leading-snug">
              <Link to={`/courses/${c.id}`} className="after:absolute after:inset-0 group-hover:text-primary">{c.title}</Link>
            </h3>
            {c.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
            <dl className="mt-auto grid grid-cols-3 gap-2 pt-4 text-center">
              {[
                { label: tr("Ressources", "الموارد", "Resources"), value: c.resources },
                { label: tr("Exercices", "التمارين", "Exercises"), value: c.exercises },
                { label: tr("Évaluations", "التقييمات", "Assessments"), value: c.exams },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-muted/60 px-2 py-2">
                  <dd className="text-base font-semibold tabular-nums leading-tight">{s.value}</dd>
                  <dt className="text-[11px] text-muted-foreground">{s.label}</dt>
                </div>
              ))}
            </dl>
            <p className="mt-3 flex items-center justify-between text-xs">
              <span className={c.late ? "font-medium text-rose-600 dark:text-rose-400" : c.pending ? "font-medium text-primary" : "text-muted-foreground"}>
                {c.late
                  ? tr(`${c.late} exercice(s) en retard`, `${c.late} تمرين متأخر`, `${c.late} overdue exercise(s)`)
                  : c.pending
                    ? tr(`${c.pending} exercice(s) à rendre`, `${c.pending} تمرين للتسليم`, `${c.pending} exercise(s) to do`)
                    : tr("Rien à rendre", "لا شيء للتسليم", "Nothing due")}
              </span>
              <span className="inline-flex items-center gap-1 font-medium text-primary">
                {tr("Ouvrir", "فتح", "Open")}
                <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
              </span>
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}

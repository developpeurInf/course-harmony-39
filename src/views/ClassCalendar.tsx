/**
 * Calendrier : dates limites des exercices, quiz et examens, par mois.
 *   /rooms/:roomId/calendar → une classe (professeur)
 *   /calendar               → toutes ses classes (professeur) ou son travail (élève)
 * Un jour qui compte au moins deux évaluations est signalé, pour éviter de les empiler.
 */
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookOpenCheck, CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, FileText } from "lucide-react";
import { Link, useParams } from "@/lib/router";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses } from "@/contexts/CourseContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { localDay } from "@/lib/roomData";
import { supabase } from "@/integrations/supabase/client";

interface CalEvent {
  id: string;
  day: string; // AAAA-MM-JJ
  time?: string;
  title: string;
  kind: "exercise" | "quiz" | "exam" | "homework";
  course?: string;
  room?: string;
  href: string;
}

const KIND_STYLE: Record<CalEvent["kind"], string> = {
  exercise: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  quiz: "bg-primary/15 text-primary",
  exam: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  homework: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
};

const ClassCalendar = () => {
  const { roomId } = useParams();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { courses, rooms, exercises, exams, refreshData, getVisibleExercisesForStudent, getVisibleExamsForStudent } = useCourses();
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en);
  const locale = language === "ar" ? "ar-MA" : language === "fr" ? "fr-FR" : "en-GB";
  const isProfessor = user?.role === "professor";

  useEffect(() => {
    if (user) refreshData(roomId || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, roomId]);

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string>(localDay());

  // Travail à faire noté dans le cahier de textes (si la table existe)
  const [homework, setHomework] = useState<{ id: string; room_id: string; title: string; homework: string; homework_due: string }[]>([]);
  useEffect(() => {
    if (!user) return;
    let q = (supabase as any).from("lesson_log").select("id, room_id, title, homework, homework_due").not("homework_due", "is", null).limit(1000);
    if (roomId) q = q.eq("room_id", roomId);
    q.then(({ data, error }: any) => {
      if (!error) setHomework(data || []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, roomId]);

  const events = useMemo<CalEvent[]>(() => {
    const courseById = new Map(courses.map((c) => [c.id, c] as [string, (typeof courses)[number]]));
    const inScope = (courseId: string) => !roomId || courseById.get(courseId)?.room_id === roomId;
    const roomOf = (courseId: string) => rooms.find((r) => r.id === courseById.get(courseId)?.room_id)?.name;
    const exList = (isProfessor ? exercises : user ? getVisibleExercisesForStudent(user.id).filter((e) => e.is_visible) : []).filter((e) => inScope(e.course_id));
    const qList = (isProfessor ? exams : user ? getVisibleExamsForStudent(user.id) : []).filter((e) => inScope(e.course_id));
    const out: CalEvent[] = [];
    exList.forEach((e) => {
      if (!e.due_date) return;
      out.push({
        id: `x-${e.id}`, day: localDay(new Date(e.due_date)), title: e.title, kind: "exercise",
        course: courseById.get(e.course_id)?.title, room: roomOf(e.course_id),
        href: roomId ? `/rooms/${roomId}/exercises?course=${e.course_id}` : `/exercises?course=${e.course_id}`,
      });
    });
    qList.forEach((e) => {
      const when = e.available_from || e.exam_date;
      if (!when) return;
      const d = new Date(when);
      out.push({
        id: `e-${e.id}`, day: localDay(d), time: d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
        title: e.title, kind: e.type === "quiz" ? "quiz" : "exam",
        course: courseById.get(e.course_id)?.title, room: roomOf(e.course_id),
        href: !isProfessor && e.type === "quiz" ? `/exams?quiz=${e.id}` : roomId ? `/rooms/${roomId}/exams?course=${e.course_id}` : `/exams?course=${e.course_id}`,
      });
    });
    homework.forEach((h) => {
      out.push({
        id: `h-${h.id}`, day: h.homework_due, title: (h.homework || h.title).split(/\r?\n/)[0].slice(0, 80), kind: "homework",
        course: h.title, room: rooms.find((r) => r.id === h.room_id)?.name,
        href: isProfessor ? `/rooms/${h.room_id}/lesson-log` : `/lesson-log`,
      });
    });
    return out.sort((a, b) => (a.day + (a.time || "")).localeCompare(b.day + (b.time || "")));
  }, [courses, rooms, exercises, exams, homework, isProfessor, user, roomId, locale, getVisibleExercisesForStudent, getVisibleExamsForStudent]);

  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    events.forEach((e) => m.set(e.day, [...(m.get(e.day) || []), e]));
    return m;
  }, [events]);

  // Grille du mois, semaines commençant le lundi
  const cells = useMemo(() => {
    const first = new Date(cursor);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [cursor]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: "short" })),
    [locale]
  );
  const today = localDay();
  const evaluationsOn = (day: string) => (byDay.get(day) || []).filter((e) => e.kind === "quiz" || e.kind === "exam").length;
  const busyDays = useMemo(() => {
    const monthKey = localDay(cursor).slice(0, 7);
    return [...byDay.keys()].filter((d) => d.startsWith(monthKey) && evaluationsOn(d) >= 2).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byDay, cursor]);
  const selectedEvents = byDay.get(selected) || [];
  const upcoming = events.filter((e) => e.day >= today).slice(0, 8);
  const room = rooms.find((r) => r.id === roomId);

  const kindLabel = (k: CalEvent["kind"]) =>
    k === "homework" ? tr("Travail à faire", "واجب منزلي", "Homework") : k === "exercise" ? tr("Exercice à rendre", "تمرين للتسليم", "Exercise due") : k === "quiz" ? tr("Quiz", "اختبار", "Quiz") : tr("Examen", "امتحان", "Exam");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{tr("Calendrier", "الأجندة", "Calendar")}{room ? ` · ${room.name}` : ""}</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {isProfessor
              ? tr("Dates limites des exercices, quiz et examens. Évitez d'empiler plusieurs évaluations le même jour.", "آجال التمارين والاختبارات والامتحانات. تجنب تكديس عدة تقويمات في نفس اليوم.", "Exercise due dates, quizzes and exams. Avoid stacking several assessments on the same day.")
              : tr("Ce que tu dois rendre et tes prochaines évaluations.", "ما يجب عليك تسليمه وتقويماتك القادمة.", "What you need to hand in and your next assessments.")}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))} aria-label={tr("Mois précédent", "الشهر السابق", "Previous month")}>
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <span className="min-w-[9.5rem] text-center text-sm font-semibold capitalize">{cursor.toLocaleDateString(locale, { month: "long", year: "numeric" })}</span>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))} aria-label={tr("Mois suivant", "الشهر الموالي", "Next month")}>
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); setSelected(today); }}>
            {tr("Aujourd'hui", "اليوم", "Today")}
          </Button>
        </div>
      </div>

      {isProfessor && busyDays > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-300/70 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {tr(`${busyDays} jour(s) de ce mois comptent au moins deux évaluations.`, `${busyDays} يوم في هذا الشهر به تقويمان أو أكثر.`, `${busyDays} day(s) this month have two or more assessments.`)}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-[11px] font-medium uppercase text-muted-foreground">
            {weekDays.map((w) => <div key={w} className="py-2">{w}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((d) => {
              const key = localDay(d);
              const list = byDay.get(key) || [];
              const inMonth = d.getMonth() === cursor.getMonth();
              const busy = evaluationsOn(key) >= 2;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected(key)}
                  className={cn(
                    "min-h-[4.5rem] border-b border-e p-1 text-start align-top transition-colors hover:bg-muted/50 sm:min-h-[6rem] sm:p-1.5",
                    !inMonth && "bg-muted/20 text-muted-foreground/60",
                    selected === key && "ring-2 ring-inset ring-primary",
                    busy && "bg-amber-500/5"
                  )}
                  aria-label={`${d.toLocaleDateString(locale, { day: "numeric", month: "long" })} : ${list.length}`}
                >
                  <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold", key === today && "bg-primary text-primary-foreground")}>
                    {d.getDate()}
                  </span>
                  {busy && <AlertTriangle className="ms-0.5 inline h-3 w-3 text-amber-600" />}
                  <span className="mt-0.5 hidden space-y-0.5 sm:block">
                    {list.slice(0, 3).map((e) => (
                      <span key={e.id} className={cn("block truncate rounded px-1 py-0.5 text-[10px] font-medium", KIND_STYLE[e.kind])} title={e.title}>
                        {e.time ? `${e.time} ` : ""}{e.title}
                      </span>
                    ))}
                    {list.length > 3 && <span className="block text-[10px] text-muted-foreground">+{list.length - 3}</span>}
                  </span>
                  {list.length > 0 && (
                    <span className="mt-1 flex gap-0.5 sm:hidden">
                      {list.slice(0, 4).map((e) => <span key={e.id} className={cn("h-1.5 w-1.5 rounded-full", e.kind === "exercise" ? "bg-amber-500" : e.kind === "homework" ? "bg-sky-500" : e.kind === "quiz" ? "bg-primary" : "bg-rose-500")} />)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <CalendarDays className="h-4 w-4 text-primary" />
              {new Date(`${selected}T12:00:00`).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
            </p>
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tr("Rien de prévu.", "لا شيء مبرمج.", "Nothing planned.")}</p>
            ) : (
              <ul className="space-y-2">
                {selectedEvents.map((e) => <EventItem key={e.id} e={e} kindLabel={kindLabel} showRoom={!roomId} />)}
              </ul>
            )}
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="mb-2 text-sm font-semibold">{tr("À venir", "قريباً", "Upcoming")}</p>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tr("Aucune échéance à venir.", "لا توجد آجال قادمة.", "No upcoming deadlines.")}</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((e) => <EventItem key={e.id} e={e} kindLabel={kindLabel} showRoom={!roomId} date={new Date(`${e.day}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short" })} />)}
              </ul>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            {(["exercise", "homework", "quiz", "exam"] as const).map((k) => (
              <span key={k} className={cn("rounded px-1.5 py-0.5 font-medium", KIND_STYLE[k])}>{kindLabel(k)}</span>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};

function EventItem({ e, kindLabel, showRoom, date }: { e: CalEvent; kindLabel: (k: CalEvent["kind"]) => string; showRoom: boolean; date?: string }) {
  const Icon = e.kind === "exercise" ? FileText : e.kind === "homework" ? BookOpenCheck : ClipboardCheck;
  return (
    <li>
      <Link to={e.href} className="flex items-start gap-2 rounded-lg p-1.5 hover:bg-muted">
        <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md", KIND_STYLE[e.kind])}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{e.title}</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {[date, e.time, kindLabel(e.kind), showRoom ? e.room : undefined, e.course].filter(Boolean).join(" · ")}
          </span>
        </span>
      </Link>
    </li>
  );
}

export default ClassCalendar;

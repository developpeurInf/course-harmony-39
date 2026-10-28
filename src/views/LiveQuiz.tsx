/**
 * Quiz en direct en classe.
 *   Professeur (écran projeté) : salle d'attente, question par question, nombre de réponses,
 *   révélation avec répartition des choix, classement final.
 *   Élève (téléphone) : grands boutons de réponse, résultat après chaque question.
 * Synchronisation : temps réel Supabase + relecture périodique (si le temps réel est coupé).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCircle2, ChevronRight, Eye, Loader2, Maximize, Radio, Square, Trophy, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate, useParams } from "@/lib/router";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MathHtml, MathText } from "@/components/math/MathContent";
import { parseQuestionText } from "@/contexts/CourseContext";
import { cn } from "@/lib/utils";

type State = "lobby" | "question" | "reveal" | "ended";

const COLORS = [
  "bg-rose-500 hover:bg-rose-600",
  "bg-sky-500 hover:bg-sky-600",
  "bg-amber-500 hover:bg-amber-600",
  "bg-emerald-500 hover:bg-emerald-600",
  "bg-violet-500 hover:bg-violet-600",
  "bg-slate-500 hover:bg-slate-600",
];
const LETTERS = "ABCDEF";
const tfLabel = (t: string, tr: (fr: string, ar: string, en: string) => string) =>
  /^(true|vrai)$/i.test(t) ? tr("Vrai", "صحيح", "True") : /^(false|faux)$/i.test(t) ? tr("Faux", "خطأ", "False") : t;

/* ═══════════════════════════════ Professeur ═══════════════════════════════ */

interface HostQuestion { id: string; question: string; question_type: string; options: { id: string; option_text: string; is_correct: boolean }[] }
interface LiveAnswer { question_id: string; student_id: string; option_id: string | null; is_correct: boolean; answer_ms: number | null }

function LiveHost({ sessionId }: { sessionId: string }) {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const tr = useCallback((fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en), [language]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<HostQuestion[]>([]);
  const [students, setStudents] = useState<Map<string, string>>(new Map());
  const [answers, setAnswers] = useState<LiveAnswer[]>([]);
  const [present, setPresent] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const rootRef = useRef<HTMLDivElement>(null);

  const loadAnswers = useCallback(async () => {
    const { data } = await (supabase as any).from("live_answers").select("question_id, student_id, option_id, is_correct, answer_ms").eq("session_id", sessionId);
    if (data) setAnswers(data);
  }, [sessionId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: s, error } = await (supabase as any).from("live_sessions").select("*").eq("id", sessionId).maybeSingle();
      if (!alive) return;
      if (error || !s) {
        setLoading(false);
        return;
      }
      setSession(s);
      const [{ data: ex }, { data: qs }, { data: direct }, { data: enr }] = await Promise.all([
        supabase.from("exams").select("title").eq("id", s.exam_id).maybeSingle(),
        supabase.from("quiz_questions").select("id, question, question_type, question_order, quiz_options(id, option_text, is_correct, option_order)").eq("exam_id", s.exam_id).order("question_order").order("id"),
        supabase.from("profiles").select("id, name").eq("role", "student").eq("room_id", s.room_id),
        supabase.from("enrollments").select("student_id").eq("room_id", s.room_id),
      ]);
      if (!alive) return;
      setTitle(ex?.title || "");
      setQuestions(((qs || []) as any[]).map((q) => ({
        id: q.id, question: q.question, question_type: q.question_type,
        options: [...(q.quiz_options || [])].sort((a: any, b: any) => a.option_order - b.option_order),
      })));
      const m = new Map<string, string>();
      (direct || []).forEach((p: any) => m.set(p.id, p.name || ""));
      const missing = [...new Set((enr || []).map((e: any) => e.student_id as string))].filter((id) => !m.has(id));
      if (missing.length) {
        const { data: extra } = await supabase.from("profiles").select("id, name, role").in("id", missing);
        (extra || []).filter((p: any) => p.role === "student").forEach((p: any) => m.set(p.id, p.name || ""));
      }
      setStudents(m);
      await loadAnswers();
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [sessionId, loadAnswers]);

  // Réponses en temps réel + relecture toutes les 3 s (filet de sécurité) ; présence des élèves
  useEffect(() => {
    const ch = supabase
      .channel(`live-${sessionId}`)
      .on("postgres_changes" as any, { event: "INSERT", schema: "public", table: "live_answers", filter: `session_id=eq.${sessionId}` }, (p: any) => {
        setAnswers((l) => (l.some((a) => a.question_id === p.new.question_id && a.student_id === p.new.student_id) ? l : [...l, p.new]));
      })
      .on("presence", { event: "sync" }, () => {
        const st = ch.presenceState() as Record<string, any[]>;
        setPresent(new Set(Object.keys(st)));
      })
      .subscribe();
    const t = setInterval(() => {
      void loadAnswers();
      setNow(Date.now());
    }, 3000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(t);
      clearInterval(tick);
      void supabase.removeChannel(ch);
    };
  }, [sessionId, loadAnswers]);

  const state: State = session?.state || "lobby";
  const index: number = session?.current_index ?? -1;
  const q = index >= 0 ? questions[index] : undefined;
  const qAnswers = useMemo(() => (q ? answers.filter((a) => a.question_id === q.id) : []), [answers, q]);
  const elapsed = session?.question_started_at ? Math.max(0, Math.floor((now - new Date(session.question_started_at).getTime()) / 1000)) : 0;

  const update = async (patch: Record<string, any>) => {
    if (busy) return;
    setBusy(true);
    const { data, error } = await (supabase as any).from("live_sessions").update(patch).eq("id", sessionId).select("*").single();
    setBusy(false);
    if (error) {
      toast.error(tr("Action impossible.", "تعذر تنفيذ العملية.", "Action failed."));
      return;
    }
    setSession(data);
  };
  const goTo = (i: number) => update({ state: "question", current_index: i, question_started_at: new Date().toISOString() });
  const reveal = () => update({ state: "reveal" });
  const finish = () => update({ state: "ended", ended_at: new Date().toISOString() });

  const leaderboard = useMemo(() => {
    const m = new Map<string, { correct: number; ms: number }>();
    answers.forEach((a) => {
      const r = m.get(a.student_id) || { correct: 0, ms: 0 };
      if (a.is_correct) {
        r.correct += 1;
        r.ms += a.answer_ms || 0;
      }
      m.set(a.student_id, r);
    });
    return [...m.entries()]
      .map(([id, r]) => ({ id, name: students.get(id) || "—", ...r }))
      .sort((a, b) => b.correct - a.correct || a.ms - b.ms);
  }, [answers, students]);

  const fullscreen = () => {
    const el: any = rootRef.current;
    (el?.requestFullscreen || el?.webkitRequestFullscreen)?.call(el);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!session) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        {tr("Session introuvable.", "الجلسة غير موجودة.", "Session not found.")} <Link to="/exams" className="text-primary underline">{tr("Retour aux quiz", "العودة إلى الاختبارات", "Back to quizzes")}</Link>
      </div>
    );
  }

  const classSize = students.size;
  const counts = q ? q.options.map((o) => qAnswers.filter((a) => a.option_id === o.id).length) : [];
  const maxCount = Math.max(1, ...counts);

  return (
    <div ref={rootRef} className="flex min-h-[80vh] flex-col gap-5 bg-background p-1 sm:p-4" dir={language === "ar" ? "rtl" : "ltr"}>
      <header className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
          <Radio className="h-3.5 w-3.5" />{state === "ended" ? tr("Terminé", "انتهى", "Ended") : tr("En direct", "مباشر", "Live")}
        </span>
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold">{title}</h1>
        {q && state !== "ended" && <span className="text-sm text-muted-foreground">{tr("Question", "السؤال", "Question")} {index + 1} / {questions.length}</span>}
        <Button variant="ghost" size="icon" onClick={fullscreen} title={tr("Plein écran", "ملء الشاشة", "Fullscreen")} aria-label={tr("Plein écran", "ملء الشاشة", "Fullscreen")}><Maximize className="h-4 w-4" /></Button>
        {state !== "ended" && <Button variant="outline" size="sm" className="gap-1.5" onClick={finish} disabled={busy}><Square className="h-3.5 w-3.5" />{tr("Terminer", "إنهاء", "End")}</Button>}
      </header>

      {state === "lobby" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <p className="max-w-xl text-lg text-muted-foreground">
            {tr("Les élèves de la classe voient un bandeau « Quiz en direct » dans l'application. Ils le touchent pour rejoindre.",
              "يرى تلاميذ القسم شريط « اختبار مباشر » في التطبيق، ويضغطون عليه للانضمام.",
              "Students in the class see a “Live quiz” banner in the app and tap it to join.")}
          </p>
          <div className="flex items-center gap-2 text-3xl font-semibold"><Users className="h-8 w-8 text-primary" />{present.size}<span className="text-lg font-normal text-muted-foreground">/ {classSize}</span></div>
          <div className="flex max-w-3xl flex-wrap justify-center gap-2">
            {[...present].map((id) => students.get(id)).filter(Boolean).map((n, i) => (
              <span key={i} className="rounded-full bg-muted px-3 py-1 text-sm">{n}</span>
            ))}
          </div>
          <Button size="lg" className="gap-2 text-base" onClick={() => goTo(0)} disabled={busy || !questions.length}>
            {tr("Lancer la première question", "إطلاق السؤال الأول", "Start the first question")}<ChevronRight className="h-5 w-5 rtl:rotate-180" />
          </Button>
        </div>
      )}

      {q && (state === "question" || state === "reveal") && (
        <div className="flex flex-1 flex-col gap-5">
          <div className="rounded-2xl border bg-card p-6 text-center">
            <MathHtml html={parseQuestionText(q.question).cleanText} className="prose prose-lg mx-auto max-w-none text-2xl font-semibold dark:prose-invert sm:text-3xl [&_img]:mx-auto [&_img]:max-h-72 [&_p]:m-0" />
          </div>
          {q.question_type === "short_answer" ? (
            <p className="text-center text-muted-foreground">{tr("Question à réponse rédigée : non utilisable en direct, passez à la suivante.", "سؤال بجواب مكتوب: غير متاح مباشرة، انتقل إلى التالي.", "Written-answer question: not available live, move on.")}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {q.options.map((o, i) => {
                const show = state === "reveal";
                return (
                  <div key={o.id} className={cn("relative overflow-hidden rounded-xl p-4 text-lg font-semibold text-white", COLORS[i % COLORS.length].split(" ")[0], show && !o.is_correct && "opacity-40")}>
                    {show && <div className="absolute inset-y-0 start-0 bg-black/15" style={{ width: `${(counts[i] / maxCount) * 100}%` }} />}
                    <div className="relative flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/25">{LETTERS[i]}</span>
                      <MathText text={tfLabel(o.option_text, tr)} className="min-w-0 flex-1" />
                      {show && <span className="tabular-nums">{counts[i]}</span>}
                      {show && o.is_correct && <CheckCircle2 className="h-6 w-6" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-auto flex flex-wrap items-center gap-3">
            <span className="text-lg"><span className="font-semibold tabular-nums">{qAnswers.length}</span> / {classSize} {tr("réponses", "إجابة", "answers")}</span>
            {state === "question" && <span className="text-sm tabular-nums text-muted-foreground">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span>}
            {state === "reveal" && qAnswers.length > 0 && (
              <span className="text-sm text-muted-foreground">{Math.round((qAnswers.filter((a) => a.is_correct).length / qAnswers.length) * 100)} % {tr("de bonnes réponses", "إجابات صحيحة", "correct")}</span>
            )}
            <div className="ms-auto flex gap-2">
              {state === "question" && <Button size="lg" className="gap-2" onClick={reveal} disabled={busy}><Eye className="h-5 w-5" />{tr("Afficher la réponse", "إظهار الجواب", "Show the answer")}</Button>}
              {state === "reveal" && (index + 1 < questions.length
                ? <Button size="lg" className="gap-2" onClick={() => goTo(index + 1)} disabled={busy}>{tr("Question suivante", "السؤال التالي", "Next question")}<ChevronRight className="h-5 w-5 rtl:rotate-180" /></Button>
                : <Button size="lg" className="gap-2" onClick={finish} disabled={busy}><Trophy className="h-5 w-5" />{tr("Voir le classement", "عرض الترتيب", "Show the ranking")}</Button>)}
            </div>
          </div>
        </div>
      )}

      {state === "ended" && (
        <div className="mx-auto w-full max-w-2xl space-y-4">
          <h2 className="flex items-center justify-center gap-2 text-2xl font-semibold"><Trophy className="h-7 w-7 text-amber-500" />{tr("Classement", "الترتيب", "Ranking")}</h2>
          {leaderboard.length === 0 ? (
            <p className="text-center text-muted-foreground">{tr("Aucune réponse.", "لا توجد إجابات.", "No answers.")}</p>
          ) : (
            <ol className="divide-y rounded-xl border bg-card">
              {leaderboard.map((r, i) => (
                <li key={r.id} className={cn("flex items-center gap-3 px-4 py-2.5", i < 3 && "font-semibold")}>
                  <span className="w-6 text-center tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{r.name}</span>
                  <span className="tabular-nums">{r.correct} / {questions.length}</span>
                </li>
              ))}
            </ol>
          )}
          <div className="flex justify-center">
            <Button variant="outline" onClick={() => navigate(`/exams?quiz=${session.exam_id}`)}>{tr("Retour au quiz", "العودة إلى الاختبار", "Back to the quiz")}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════ Élève ═══════════════════════════════ */

interface PlayerState {
  state: State;
  index: number;
  total: number;
  title: string;
  question: { id: string; text: string; type: string; options: { id: string; text: string; correct: boolean | null }[] } | null;
  mine: { option_id: string; is_correct: boolean | null } | null;
  score: number;
}

function LivePlayer({ sessionId }: { sessionId: string }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const tr = useCallback((fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en), [language]);
  const [st, setSt] = useState<PlayerState | null>(null);
  const [error, setError] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error: e } = await (supabase as any).rpc("live_state", { p_session_id: sessionId });
    if (e) {
      setError(true);
      return;
    }
    setError(false);
    setSt(data);
  }, [sessionId]);

  useEffect(() => {
    void refresh();
    const ch = supabase.channel(`live-${sessionId}`, { config: { presence: { key: user?.id || "" } } });
    ch.on("postgres_changes" as any, { event: "UPDATE", schema: "public", table: "live_sessions", filter: `id=eq.${sessionId}` }, () => void refresh())
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") void ch.track({ at: Date.now() });
      });
    const t = setInterval(() => void refresh(), 2000);
    return () => {
      clearInterval(t);
      void supabase.removeChannel(ch);
    };
  }, [sessionId, refresh, user?.id]);

  const answer = async (optionId: string) => {
    if (!st?.question || st.mine || sending) return;
    setSending(optionId);
    const { error: e } = await (supabase as any).rpc("live_answer", { p_session_id: sessionId, p_question_id: st.question.id, p_option_id: optionId });
    if (e) toast.error(String(e.message).includes("QUESTION_CLOSED") ? tr("Trop tard, la question est fermée.", "فات الأوان، أغلق السؤال.", "Too late, the question is closed.") : tr("Réponse non envoyée.", "لم ترسل الإجابة.", "Answer not sent."));
    await refresh();
    setSending(null);
  };

  if (error) return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{tr("Ce quiz en direct n'est pas accessible.", "هذا الاختبار المباشر غير متاح.", "This live quiz is not available.")}</div>;
  if (!st) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col gap-4" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"><Radio className="h-3.5 w-3.5" />{tr("En direct", "مباشر", "Live")}</span>
        <h1 className="min-w-0 flex-1 truncate font-semibold">{st.title}</h1>
        {st.index >= 0 && st.state !== "ended" && <span className="text-xs text-muted-foreground">{st.index + 1} / {st.total}</span>}
      </div>

      {st.state === "lobby" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-lg font-medium">{tr("Vous êtes connecté. Le quiz va commencer…", "أنت متصل. سيبدأ الاختبار قريباً…", "You're in. The quiz will start soon…")}</p>
        </div>
      )}

      {(st.state === "question" || st.state === "reveal") && st.question && (
        <>
          <div className="rounded-xl border bg-card p-4">
            <MathHtml html={parseQuestionText(st.question.text).cleanText} className="prose max-w-none text-lg font-semibold dark:prose-invert [&_img]:max-h-56 [&_p]:m-0" />
          </div>
          {st.question.type === "short_answer" ? (
            <p className="text-center text-muted-foreground">{tr("Écoutez le professeur pour cette question.", "استمع إلى الأستاذ في هذا السؤال.", "Listen to the teacher for this question.")}</p>
          ) : (
            <div className="grid flex-1 grid-cols-1 gap-3">
              {st.question.options.map((o, i) => {
                const chosen = st.mine?.option_id === o.id;
                const reveal = st.state === "reveal";
                return (
                  <button
                    key={o.id}
                    type="button"
                    disabled={!!st.mine || reveal || !!sending}
                    onClick={() => void answer(o.id)}
                    className={cn(
                      "flex min-h-[64px] items-center gap-3 rounded-xl px-4 py-3 text-start text-lg font-semibold text-white transition-opacity",
                      COLORS[i % COLORS.length],
                      (st.mine && !chosen) && "opacity-40",
                      reveal && o.correct === false && "opacity-40",
                      chosen && "ring-4 ring-foreground/40"
                    )}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/25">{sending === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : LETTERS[i]}</span>
                    <MathText text={tfLabel(o.text, tr)} className="min-w-0 flex-1" />
                    {reveal && o.correct && <CheckCircle2 className="h-6 w-6 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
          {st.state === "question" && st.mine && <p className="text-center font-medium text-muted-foreground"><Check className="me-1 inline h-4 w-4" />{tr("Réponse envoyée. Attendez la correction…", "أرسلت الإجابة. انتظر التصحيح…", "Answer sent. Wait for the correction…")}</p>}
          {st.state === "reveal" && (
            <p className={cn("flex items-center justify-center gap-2 text-xl font-semibold", st.mine?.is_correct ? "text-emerald-600" : "text-rose-600")}>
              {st.mine?.is_correct ? <><CheckCircle2 className="h-6 w-6" />{tr("Bonne réponse !", "إجابة صحيحة!", "Correct!")}</>
                : st.mine ? <><XCircle className="h-6 w-6" />{tr("Raté", "خطأ", "Wrong")}</>
                : <span className="text-muted-foreground">{tr("Pas de réponse", "بدون إجابة", "No answer")}</span>}
            </p>
          )}
        </>
      )}

      {st.state === "ended" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <Trophy className="h-12 w-12 text-amber-500" />
          <p className="text-2xl font-semibold">{st.score} / {st.total}</p>
          <p className="text-muted-foreground">{tr("Quiz terminé, bravo !", "انتهى الاختبار، أحسنت!", "Quiz over, well done!")}</p>
          <Link to="/dashboard" className="text-primary underline">{tr("Retour à l'accueil", "العودة إلى الرئيسية", "Back home")}</Link>
        </div>
      )}
    </div>
  );
}

const LiveQuiz = () => {
  const { sessionId } = useParams();
  const { user } = useAuth();
  if (!sessionId) return null;
  return user?.role === "professor" ? <LiveHost sessionId={sessionId} /> : <LivePlayer sessionId={sessionId} />;
};

export default LiveQuiz;

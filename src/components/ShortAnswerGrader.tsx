/**
 * Correction des réponses rédigées (questions « short_answer ») par l'enseignant.
 *
 * Les réponses identiques (mêmes mots, sans tenir compte des majuscules ni des espaces)
 * sont regroupées : un clic note tout le groupe. La note est enregistrée par
 * grade_quiz_answers() qui recalcule aussi la note de chaque copie.
 */
import { useMemo, useState } from "react";
import { Check, CheckCircle2, Loader2, MessageSquare, PenLine, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { accessStore } from "@/contexts/AccessContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { MathText, SimpleMathPreview } from "@/components/math/MathContent";
import { formatDecimal } from "@/lib/formatDate";

export interface GradableAnswer {
  id?: string;
  submission_id: string;
  text_answer: string | null;
  points_earned?: number | string | null;
  graded_at?: string | null;
  teacher_comment?: string | null;
}

export interface GradeUpdate {
  answerIds: string[];
  points: number;
  comment: string | null;
  scores: { submission_id: string; score: number }[];
}

interface Props {
  maxPoints: number;
  answers: GradableAnswer[];
  /** Nom de l'élève d'une copie (+ « 2e tentative »… si besoin) */
  studentOf: (submissionId: string) => string;
  onGraded: (u: GradeUpdate) => void;
}

const normalize = (t: string) => t.replace(/\s+/g, " ").trim().toLowerCase();

const ShortAnswerGrader = ({ maxPoints, answers, studentOf, onGraded }: Props) => {
  const { language } = useLanguage();
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en);
  const num = (v: number) => formatDecimal(v, language, 2);
  const [onlyPending, setOnlyPending] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [openComment, setOpenComment] = useState<string | null>(null);

  // Réponses sans identifiant : migration pas encore appliquée → lecture seule
  const canGrade = answers.every((a) => !!a.id);

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; text: string; items: GradableAnswer[] }>();
    answers.forEach((a) => {
      const text = (a.text_answer || "").trim();
      if (!text) return;
      const key = normalize(text);
      const g = map.get(key);
      if (g) g.items.push(a);
      else map.set(key, { key, text, items: [a] });
    });
    return [...map.values()]
      .map((g) => {
        const graded = g.items.filter((a) => !!a.graded_at);
        const pts = new Set(graded.map((a) => Number(a.points_earned) || 0));
        return {
          ...g,
          gradedCount: graded.length,
          pending: g.items.length - graded.length,
          points: graded.length === g.items.length && pts.size === 1 ? [...pts][0] : null,
          comment: g.items.find((a) => a.teacher_comment)?.teacher_comment || "",
        };
      })
      // À corriger d'abord, puis les réponses les plus fréquentes
      .sort((a, b) => (b.pending > 0 ? 1 : 0) - (a.pending > 0 ? 1 : 0) || b.items.length - a.items.length);
  }, [answers]);

  const total = groups.reduce((s, g) => s + g.items.length, 0);
  const pending = groups.reduce((s, g) => s + g.pending, 0);
  const shown = onlyPending ? groups.filter((g) => g.pending > 0) : groups;

  const grade = async (groupKey: string, items: GradableAnswer[], points: number) => {
    if (!canGrade || busy) return;
    if (!accessStore.guard("quiz.grade")) return;
    if (!Number.isFinite(points) || points < 0 || points > maxPoints) {
      toast.error(tr(`La note doit être entre 0 et ${maxPoints}.`, `يجب أن تكون النقطة بين 0 و ${maxPoints}.`, `The grade must be between 0 and ${maxPoints}.`));
      return;
    }
    const rounded = Math.round(points * 2) / 2;
    const comment = (comments[groupKey] ?? "").trim() || null;
    setBusy(groupKey);
    try {
      const { data, error } = await (supabase as any).rpc("grade_quiz_answers", {
        p_grades: items.map((a) => ({ answer_id: a.id, points: rounded, comment })),
      });
      if (error) throw error;
      onGraded({
        answerIds: items.map((a) => a.id as string),
        points: rounded,
        comment,
        scores: (Array.isArray(data) ? data : []).map((r: any) => ({ submission_id: r.submission_id, score: Number(r.score) || 0 })),
      });
      setOpenComment(null);
      toast.success(
        items.length > 1
          ? tr(`${items.length} réponses notées ${num(rounded)}/${maxPoints}`, `تم تنقيط ${items.length} إجابات ${num(rounded)}/${maxPoints}`, `${items.length} answers graded ${num(rounded)}/${maxPoints}`)
          : tr(`Réponse notée ${num(rounded)}/${maxPoints}`, `تم تنقيط الإجابة ${num(rounded)}/${maxPoints}`, `Answer graded ${num(rounded)}/${maxPoints}`)
      );
    } catch (e: any) {
      console.error("grade_quiz_answers error:", e);
      const msg = String(e?.message || "");
      toast.error(
        /function .*grade_quiz_answers|Could not find the function/i.test(msg)
          ? tr("La correction n'est pas encore activée sur le serveur (migration à exécuter).", "التصحيح غير مفعّل بعد على الخادم.", "Grading is not enabled on the server yet (migration to run).")
          : tr("Impossible d'enregistrer la note.", "تعذر حفظ النقطة.", "Unable to save the grade.")
      );
    } finally {
      setBusy(null);
    }
  };

  if (total === 0) return null;

  return (
    <div className="mt-4 rounded-xl border bg-muted/20 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <PenLine className="h-4 w-4 text-primary" />
          {tr("Correction des réponses rédigées", "تصحيح الإجابات المكتوبة", "Grade written answers")}
        </div>
        <div className="flex items-center gap-2 text-xs">
          {pending > 0 ? (
            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 font-semibold text-amber-700 dark:text-amber-300">
              {tr(`${pending} à corriger`, `${pending} للتصحيح`, `${pending} to grade`)} · {total - pending}/{total}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {tr("Tout est corrigé", "تم تصحيح الكل", "All graded")}
            </span>
          )}
          {groups.some((g) => g.pending === 0) && pending > 0 && (
            <button type="button" className="rounded-full border px-2.5 py-1 font-medium hover:bg-muted" onClick={() => setOnlyPending((v) => !v)}>
              {onlyPending ? tr("Tout afficher", "عرض الكل", "Show all") : tr("Seulement à corriger", "غير المصححة فقط", "Only pending")}
            </button>
          )}
        </div>
      </div>
      {!canGrade && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
          {tr("La correction sera disponible après la mise à jour de la base de données.", "سيتوفر التصحيح بعد تحديث قاعدة البيانات.", "Grading will be available after the database update.")}
        </p>
      )}
      <p className="mt-1 text-[11px] text-muted-foreground">
        {tr("Les réponses identiques sont regroupées : une note s'applique à tout le groupe.", "الإجابات المتطابقة مجمعة: النقطة تطبق على المجموعة كلها.", "Identical answers are grouped: one grade applies to the whole group.")}
      </p>

      <div className="mt-3 space-y-2">
        {shown.map((g) => {
          const isBusy = busy === g.key;
          const tone = g.pending > 0
            ? "border-amber-300/70 dark:border-amber-800"
            : g.points !== null && g.points >= maxPoints
            ? "border-emerald-300 dark:border-emerald-900"
            : g.points === 0
            ? "border-rose-300 dark:border-rose-900"
            : "border-border";
          const names = g.items.map((a) => studentOf(a.submission_id));
          return (
            <div key={g.key} className={`rounded-lg border-2 bg-card p-3 ${tone}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <MathText as="div" className="whitespace-pre-wrap text-sm font-medium" text={g.text} />
                  <SimpleMathPreview text={g.text} compact className="mt-1" />
                  <div className="mt-1 text-[11px] text-muted-foreground" title={names.join(", ")}>
                    <span className="font-semibold">{tr(`${g.items.length} élève${g.items.length > 1 ? "s" : ""}`, `${g.items.length} تلميذ`, `${g.items.length} student${g.items.length > 1 ? "s" : ""}`)}</span>
                    {" · "}
                    {names.slice(0, 6).join(", ")}
                    {names.length > 6 && ` +${names.length - 6}`}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${g.pending > 0 ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-muted text-foreground"}`}>
                  {g.pending > 0
                    ? (g.gradedCount > 0 ? tr("Partiellement corrigé", "مصحح جزئياً", "Partly graded") : tr("À corriger", "للتصحيح", "To grade"))
                    : g.points !== null
                    ? <span dir="ltr">{num(g.points)}/{maxPoints}</span>
                    : tr("Notes différentes", "نقط مختلفة", "Mixed grades")}
                </span>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <Button size="sm" variant="outline" disabled={!canGrade || isBusy}
                  className="h-8 gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                  onClick={() => grade(g.key, g.items, maxPoints)}>
                  {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  {tr("Juste", "صحيح", "Correct")} <span dir="ltr" className="tabular-nums">({maxPoints})</span>
                </Button>
                <Button size="sm" variant="outline" disabled={!canGrade || isBusy}
                  className="h-8 gap-1 border-rose-300 text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30"
                  onClick={() => grade(g.key, g.items, 0)}>
                  <X className="h-3.5 w-3.5" />
                  {tr("Faux", "خطأ", "Wrong")} <span dir="ltr" className="tabular-nums">(0)</span>
                </Button>
                {maxPoints > 0.5 && (
                  <form
                    className="flex items-center gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      grade(g.key, g.items, parseFloat(String(custom[g.key] ?? "").replace(",", ".")));
                    }}
                  >
                    <Input
                      type="text"
                      inputMode="decimal"
                      dir="ltr"
                      aria-label={tr("Note partielle", "نقطة جزئية", "Partial grade")}
                      placeholder={`0–${maxPoints}`}
                      value={custom[g.key] ?? ""}
                      onChange={(e) => setCustom((c) => ({ ...c, [g.key]: e.target.value }))}
                      className="h-8 w-20 text-center text-xs"
                      disabled={!canGrade || isBusy}
                    />
                    <Button type="submit" size="sm" variant="secondary" className="h-8 text-xs" disabled={!canGrade || isBusy || !(custom[g.key] ?? "").trim()}>
                      {tr("Noter", "نقّط", "Grade")}
                    </Button>
                  </form>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 text-xs"
                  disabled={!canGrade}
                  onClick={() => {
                    setComments((c) => (g.key in c ? c : { ...c, [g.key]: g.comment }));
                    setOpenComment((k) => (k === g.key ? null : g.key));
                  }}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  {g.comment ? tr("Commentaire ✓", "ملاحظة ✓", "Comment ✓") : tr("Commentaire", "ملاحظة", "Comment")}
                </Button>
              </div>
              {openComment === g.key && (
                <div className="mt-2">
                  <Input
                    value={comments[g.key] ?? ""}
                    onChange={(e) => setComments((c) => ({ ...c, [g.key]: e.target.value }))}
                    placeholder={tr("Commentaire visible par l'élève (enregistré avec la note)", "ملاحظة يراها التلميذ (تحفظ مع النقطة)", "Comment shown to the student (saved with the grade)")}
                    className="h-8 text-xs"
                    maxLength={2000}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ShortAnswerGrader;

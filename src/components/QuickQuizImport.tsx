import { useMemo, useState } from "react";
import { Zap, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { serializeQuestionText } from "@/contexts/CourseContext";

/**
 * Saisie rapide : une question par ligne.
 *   Combien font 7 + 8 ? | 14 | *15 | 16 | 13 @2   → QCM (* = bonne réponse, @2 = 2 points)
 *   V: 9 × 6 = 54 @1                                → Vrai / Faux (bonne réponse : Vrai)
 *   F: 56 ÷ 7 = 9                                   → Vrai / Faux (bonne réponse : Faux)
 */
type Lang = "fr" | "ar" | "en";
interface Parsed {
  line: number;
  text: string;
  type: "multiple_choice" | "true_false";
  points: number;
  options: { text: string; correct: boolean }[];
  error?: string;
}

const escapeHtml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function parseQuickQuiz(src: string, L: (fr: string, ar: string, en: string) => string): Parsed[] {
  const out: Parsed[] = [];
  src.split(/\r?\n/).forEach((raw, i) => {
    let line = raw.trim();
    if (!line) return;
    let points = 1;
    const pm = /\s*@\s*(\d+(?:[.,]\d+)?)\s*$/.exec(line);
    if (pm) {
      points = Math.max(1, Math.round(parseFloat(pm[1].replace(",", "."))));
      line = line.slice(0, pm.index).trim();
    }
    const tf = /^(V|F|T|ص|خ)\s*[:：]\s*(.+)$/i.exec(line);
    if (tf) {
      const isTrue = /^(v|t|ص)$/i.test(tf[1]);
      out.push({
        line: i + 1, text: tf[2].trim(), type: "true_false", points,
        options: [{ text: "True", correct: isTrue }, { text: "False", correct: !isTrue }],
      });
      return;
    }
    const parts = line.split("|").map(p => p.trim()).filter(Boolean);
    const text = parts.shift() || "";
    const options = parts.map(p => ({ text: p.replace(/^\*\s*/, ""), correct: p.startsWith("*") }));
    const p: Parsed = { line: i + 1, text, type: "multiple_choice", points, options };
    if (!text) p.error = L("énoncé manquant", "نص السؤال مفقود", "missing question");
    else if (options.length < 2) p.error = L("au moins 2 réponses séparées par |", "على الأقل جوابان مفصولان بـ |", "at least 2 answers separated by |");
    else if (!options.some(o => o.correct)) p.error = L("marquez la bonne réponse avec *", "ضع * أمام الجواب الصحيح", "mark the right answer with *");
    out.push(p);
  });
  return out;
}

export default function QuickQuizImport({
  open, onOpenChange, examId, startOrder, language, onImported,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  examId: string;
  startOrder: number;
  language: Lang;
  onImported: () => void | Promise<void>;
}) {
  const L = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => parseQuickQuiz(text, L), [text, language]); // eslint-disable-line react-hooks/exhaustive-deps
  const valid = parsed.filter(p => !p.error);
  const total = valid.reduce((s, p) => s + p.points, 0);

  const example = L(
    "Combien font 7 + 8 ? | 14 | *15 | 16 | 13 @2\nV: 9 × 6 = 54\nF: 56 ÷ 7 = 9\nCombien font 81 ÷ 9 ? | 8 | *9 | 7 @2",
    "كم يساوي 7 + 8 ؟ | 14 | *15 | 16 | 13 @2\nص: 9 × 6 = 54\nخ: 56 ÷ 7 = 9\nكم يساوي 81 ÷ 9 ؟ | 8 | *9 | 7 @2",
    "What is 7 + 8? | 14 | *15 | 16 | 13 @2\nT: 9 × 6 = 54\nF: 56 ÷ 7 = 9\nWhat is 81 ÷ 9? | 8 | *9 | 7 @2"
  );

  const importAll = async () => {
    if (!valid.length || busy) return;
    setBusy(true);
    let inserted: { id: string; question_order: number }[] = [];
    try {
      // 1) Toutes les questions en UNE requête
      const rows = valid.map((q, i) => ({
        exam_id: examId,
        question: serializeQuestionText(`<p>${escapeHtml(q.text)}</p>`, null),
        question_type: q.type,
        points: q.points,
        question_order: startOrder + i + 1,
      }));
      const { data: nqs, error } = await supabase.from("quiz_questions").insert(rows).select("id, question_order");
      if (error || !nqs) throw error || new Error("insert");
      inserted = nqs as { id: string; question_order: number }[];
      const idByOrder: Record<number, string> = {};
      inserted.forEach(r => { idByOrder[r.question_order] = r.id; });

      // 2) Toutes les options en UNE requête
      const optionRows = valid.flatMap((q, i) => {
        const qid = idByOrder[startOrder + i + 1];
        return qid ? q.options.map((o, idx) => ({ question_id: qid, option_text: o.text, is_correct: o.correct, option_order: idx + 1 })) : [];
      });
      if (optionRows.length) {
        const { error: oe } = await supabase.from("quiz_options").insert(optionRows);
        if (oe) {
          // Pas de questions sans options : on annule les questions insérées
          await supabase.from("quiz_questions").delete().in("id", inserted.map(r => r.id));
          throw oe;
        }
      }
      const done = inserted.length;
      toast.success(L(`${done} question(s) ajoutée(s)`, `تمت إضافة ${done} سؤال`, `${done} question(s) added`));
      setText("");
      onOpenChange(false);
    } catch (e: any) {
      console.error("Quick quiz import failed", e);
      toast.error(L("Échec de l'ajout des questions. Aucune question n'a été ajoutée.", "تعذرت إضافة الأسئلة. لم تتم إضافة أي سؤال.", "Failed to add the questions. No question was added."));
    } finally {
      setBusy(false);
      await onImported();
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !busy && onOpenChange(o)}>
      <DialogContent className="max-h-[92vh] w-[95vw] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-amber-500" />{L("Saisie rapide", "إدخال سريع", "Quick entry")}</DialogTitle>
          <DialogDescription>
            {L("Une question par ligne. Réponses séparées par « | », la bonne précédée de « * ». « V: » ou « F: » pour un Vrai/Faux. « @2 » à la fin = 2 points.",
              "سؤال في كل سطر. الأجوبة مفصولة بـ « | » والصحيح يسبقه « * ». « ص: » أو « خ: » لسؤال صحيح/خطأ. « @2 » في النهاية = نقطتان.",
              "One question per line. Answers separated by “|”, the right one prefixed with “*”. “T:” or “F:” for True/False. “@2” at the end = 2 points.")}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={example}
          rows={8}
          className="font-mono text-sm"
          disabled={busy}
        />
        {!text && (
          <Button type="button" variant="ghost" size="sm" className="w-fit text-xs" onClick={() => setText(example)}>
            {L("Remplir avec l'exemple", "ملء بالمثال", "Fill with the example")}
          </Button>
        )}
        {parsed.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">
              {L(`Aperçu : ${valid.length} question(s) · ${total} pts`, `معاينة: ${valid.length} سؤال · ${total} نقطة`, `Preview: ${valid.length} question(s) · ${total} pts`)}
            </p>
            <ul className="max-h-56 space-y-1.5 overflow-y-auto">
              {parsed.map(p => (
                <li key={p.line} className={`rounded-lg border px-3 py-2 text-sm ${p.error ? "border-rose-300 bg-rose-50 dark:bg-rose-950/30" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{p.text || "—"}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {p.type === "true_false" ? L("V/F", "ص/خ", "T/F") : "QCM"} · {p.points} {L("pt", "نقطة", "pt")}
                    </span>
                  </div>
                  {p.error ? (
                    <p className="mt-1 flex items-center gap-1 text-xs text-rose-700"><AlertTriangle className="h-3.5 w-3.5" />{L("Ligne", "السطر", "Line")} {p.line} : {p.error}</p>
                  ) : (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {p.options.map((o, i) => (
                        <span key={i} className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${o.correct ? "bg-emerald-100 font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-muted"}`}>
                          {o.correct && <Check className="h-3 w-3" />}
                          {p.type === "true_false" ? (o.text === "True" ? L("Vrai", "صحيح", "True") : L("Faux", "خطأ", "False")) : o.text}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{L("Annuler", "إلغاء", "Cancel")}</Button>
          <Button onClick={importAll} disabled={busy || valid.length === 0 || valid.length !== parsed.length}>
            {busy ? L("Ajout…", "جارٍ الإضافة…", "Adding…") : L(`Ajouter ${valid.length} question(s)`, `إضافة ${valid.length} سؤال`, `Add ${valid.length} question(s)`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

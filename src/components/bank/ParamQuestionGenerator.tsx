/**
 * Questions à paramètres aléatoires : « Calcule {a} × {b} », a ∈ [2 ; 9], réponse « a*b ».
 * Génère N variantes (QCM avec distracteurs ou réponse courte) à ajouter au quiz,
 * et/ou enregistre le modèle dans la banque pour le réutiliser.
 */
import { useEffect, useMemo, useState } from "react";
import { Check, Dices, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MathHtml, MathText } from "@/components/math/MathContent";
import { accessStore } from "@/contexts/AccessContext";
import {
  evaluate, generateVariants, insertIntoExam, paramNames, plainText, saveToBank,
  type ParamSpec, type QuestionTemplate,
} from "@/lib/questionBank";

type Lang = "fr" | "ar" | "en";

const escapeHtml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const toHtml = (t: string) => t.split(/\r?\n/).filter((l) => l.trim()).map((l) => `<p>${escapeHtml(l)}</p>`).join("");

export interface GeneratorInitial {
  statement: string; // HTML
  template: QuestionTemplate;
  type: "multiple_choice" | "short_answer";
  points: number;
  chapter?: string | null;
}

export default function ParamQuestionGenerator({
  open, onOpenChange, language, examId, startOrder = 0, initial, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  language: Lang;
  /** Quiz où ajouter les variantes (sinon : enregistrement du modèle uniquement) */
  examId?: string;
  startOrder?: number;
  initial?: GeneratorInitial | null;
  onDone?: () => void | Promise<void>;
}) {
  const L = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en);
  const [statement, setStatement] = useState("");
  const [params, setParams] = useState<Record<string, ParamSpec>>({});
  const [answer, setAnswer] = useState("");
  const [decimals, setDecimals] = useState(0);
  const [unit, setUnit] = useState("");
  const [type, setType] = useState<"multiple_choice" | "short_answer">("multiple_choice");
  const [choices, setChoices] = useState(4);
  const [count, setCount] = useState(5);
  const [points, setPoints] = useState(1);
  const [chapter, setChapter] = useState("");
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setStatement(plainText(initial.statement.replace(/<\/p>\s*<p>/g, "\n")));
      const m: Record<string, ParamSpec> = {};
      initial.template.params.forEach((p) => (m[p.name] = p));
      setParams(m);
      setAnswer(initial.template.answer);
      setDecimals(initial.template.decimals || 0);
      setUnit(initial.template.unit || "");
      setType(initial.type);
      setPoints(initial.points || 1);
      setChapter(initial.chapter || "");
    } else {
      setStatement(L("Calcule {a} × {b}.", "احسب {a} × {b}.", "Compute {a} × {b}."));
      setParams({ a: { name: "a", min: 2, max: 9, step: 1 }, b: { name: "b", min: 2, max: 9, step: 1 } });
      setAnswer("a*b");
      setDecimals(0);
      setUnit("");
      setType("multiple_choice");
      setPoints(1);
      setChapter("");
    }
    setSeed(Math.floor(Math.random() * 1e9));
  }, [open, initial]); // eslint-disable-line react-hooks/exhaustive-deps

  const names = useMemo(() => paramNames(statement), [statement]);
  const specs: ParamSpec[] = names.map((n) => params[n] || { name: n, min: 1, max: 10, step: 1 });
  const setSpec = (n: string, patch: Partial<ParamSpec>) =>
    setParams((m) => ({ ...m, [n]: { ...(m[n] || { name: n, min: 1, max: 10, step: 1 }), ...patch, name: n } }));
  const template: QuestionTemplate = { params: specs, answer: answer.trim(), decimals, unit: unit.trim() || undefined };

  const formulaError = useMemo(() => {
    if (!names.length) return L("Ajoutez au moins un paramètre entre accolades, par exemple {a}.", "أضف معاملاً واحداً على الأقل بين معقوفتين، مثلاً {a}.", "Add at least one parameter in braces, e.g. {a}.");
    if (!answer.trim()) return L("Indiquez la formule de la réponse.", "اكتب صيغة الجواب.", "Enter the answer formula.");
    const bad = specs.find((s) => !(s.max >= s.min) || !(s.step > 0));
    if (bad) return L(`Intervalle invalide pour {${bad.name}}.`, `مجال غير صالح لـ {${bad.name}}.`, `Invalid range for {${bad.name}}.`);
    try {
      const vars: Record<string, number> = {};
      specs.forEach((s) => (vars[s.name] = s.min));
      evaluate(answer, vars);
      return null;
    } catch (e: any) {
      return `${L("Formule", "الصيغة", "Formula")} : ${e?.message || "?"}`;
    }
  }, [answer, names.join(","), JSON.stringify(specs)]); // eslint-disable-line react-hooks/exhaustive-deps

  const variants = useMemo(() => {
    if (formulaError) return [];
    try {
      return generateVariants(toHtml(statement), template, { count: Math.min(Math.max(1, count), 50), type, points, choices, lang: language, seed });
    } catch {
      return [];
    }
  }, [formulaError, statement, JSON.stringify(template), count, type, points, choices, language, seed]); // eslint-disable-line react-hooks/exhaustive-deps

  const addToQuiz = async () => {
    if (!examId || !variants.length || busy) return;
    if (!accessStore.guard("quiz.edit")) return;
    setBusy(true);
    try {
      const n = await insertIntoExam(examId, startOrder, variants.map((v) => v.question));
      toast.success(L(`${n} question(s) ajoutée(s) au quiz.`, `تمت إضافة ${n} سؤال إلى الاختبار.`, `${n} question(s) added to the quiz.`));
      onOpenChange(false);
      await onDone?.();
    } catch (e) {
      console.error(e);
      toast.error(L("Échec de l'ajout. Aucune question n'a été ajoutée.", "تعذرت الإضافة. لم تتم إضافة أي سؤال.", "Failed. No question was added."));
    } finally {
      setBusy(false);
    }
  };

  const saveTemplate = async () => {
    if (formulaError || busy) return;
    if (!accessStore.guard("quiz.bank")) return;
    setBusy(true);
    try {
      await saveToBank([{ question: toHtml(statement), question_type: type, points, options: [], template, chapter }]);
      toast.success(L("Modèle enregistré dans la banque de questions.", "تم حفظ النموذج في بنك الأسئلة.", "Template saved to the question bank."));
      if (!examId) {
        onOpenChange(false);
        await onDone?.();
      }
    } catch (e) {
      console.error(e);
      toast.error(L("Impossible d'enregistrer le modèle (banque de questions indisponible ?).", "تعذر حفظ النموذج.", "Unable to save the template."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-h-[92vh] w-[95vw] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Dices className="h-5 w-5 text-muted-foreground" />{L("Questions à paramètres aléatoires", "أسئلة بمعاملات عشوائية", "Randomised questions")}</DialogTitle>
          <DialogDescription>
            {L("Écrivez l'énoncé avec des paramètres entre accolades ({a}, {b}…) et la formule de la réponse. Chaque variante a d'autres valeurs : les élèves voisins n'ont plus les mêmes calculs.",
              "اكتب نص السؤال بمعاملات بين معقوفتين ({a}، {b}…) وصيغة الجواب. لكل نسخة قيم مختلفة، فلا يحصل التلاميذ المتجاورون على نفس الحسابات.",
              "Write the statement with parameters in braces ({a}, {b}…) and the answer formula. Each variant has different values.")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{L("Énoncé", "نص السؤال", "Statement")}</Label>
              <Textarea value={statement} onChange={(e) => setStatement(e.target.value)} rows={3} dir="auto" />
            </div>
            {specs.length > 0 && (
              <div className="space-y-1.5">
                <Label>{L("Valeurs des paramètres", "قيم المعاملات", "Parameter values")}</Label>
                {specs.map((s) => (
                  <div key={s.name} className="flex items-center gap-1.5 text-sm">
                    <span className="w-10 font-mono font-semibold">{`{${s.name}}`}</span>
                    <span className="text-xs text-muted-foreground">{L("de", "من", "from")}</span>
                    <Input type="number" className="h-8 w-20" value={s.min} onChange={(e) => setSpec(s.name, { min: Number(e.target.value) })} />
                    <span className="text-xs text-muted-foreground">{L("à", "إلى", "to")}</span>
                    <Input type="number" className="h-8 w-20" value={s.max} onChange={(e) => setSpec(s.name, { max: Number(e.target.value) })} />
                    <span className="text-xs text-muted-foreground">{L("pas", "خطوة", "step")}</span>
                    <Input type="number" className="h-8 w-16" value={s.step} min={0} step="any" onChange={(e) => setSpec(s.name, { step: Number(e.target.value) })} />
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1.5">
                <Label>{L("Formule de la réponse", "صيغة الجواب", "Answer formula")}</Label>
                <Input value={answer} onChange={(e) => setAnswer(e.target.value)} dir="ltr" className="font-mono" placeholder="a*b" />
              </div>
              <div className="space-y-1.5">
                <Label>{L("Unité", "الوحدة", "Unit")}</Label>
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="cm" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground" dir="ltr">+ − * / ^ ( ) · sqrt abs round min max pgcd pi · {L("arguments séparés par ;", "الوسائط مفصولة بـ ;", "arguments separated by ;")}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-xs">{L("Type", "النوع", "Type")}</Label>
                <Select value={type} onValueChange={(v) => setType(v as any)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice">QCM</SelectItem>
                    <SelectItem value="short_answer">{L("Réponse courte", "جواب قصير", "Short answer")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{L("Décimales", "الأرقام العشرية", "Decimals")}</Label>
                <Input type="number" min={0} max={6} className="h-9" value={decimals} onChange={(e) => setDecimals(Math.min(6, Math.max(0, Number(e.target.value) || 0)))} />
              </div>
              {type === "multiple_choice" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">{L("Choix", "الاختيارات", "Choices")}</Label>
                  <Input type="number" min={2} max={6} className="h-9" value={choices} onChange={(e) => setChoices(Math.min(6, Math.max(2, Number(e.target.value) || 4)))} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">{L("Points", "النقط", "Points")}</Label>
                <Input type="number" min={1} max={20} className="h-9" value={points} onChange={(e) => setPoints(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{L("Chapitre (pour la banque)", "الفصل (للبنك)", "Chapter (for the bank)")}</Label>
              <Input value={chapter} onChange={(e) => setChapter(e.target.value)} className="h-9" />
            </div>
            {type === "short_answer" && (
              <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                {L("Les réponses courtes se corrigent à la main (la bonne valeur est affichée dans l'aperçu).", "الأجوبة القصيرة تصحح يدوياً (القيمة الصحيحة تظهر في المعاينة).", "Short answers are graded by hand (the right value is shown in the preview).")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>{L("Aperçu des variantes", "معاينة النسخ", "Variant preview")}</Label>
              <div className="flex items-center gap-1.5">
                <Input type="number" min={1} max={50} className="h-8 w-16" value={count} onChange={(e) => setCount(Math.min(50, Math.max(1, Number(e.target.value) || 1)))} aria-label={L("Nombre de variantes", "عدد النسخ", "Number of variants")} />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSeed(Math.floor(Math.random() * 1e9))} title={L("Nouveau tirage", "سحب جديد", "New draw")} aria-label={L("Nouveau tirage", "سحب جديد", "New draw")}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {formulaError ? (
              <p className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{formulaError}</p>
            ) : (
              <ul className="max-h-[50vh] space-y-1.5 overflow-y-auto">
                {variants.map((v, i) => (
                  <li key={i} className="rounded-lg border px-3 py-2 text-sm">
                    <MathHtml html={v.question.question} className="font-medium [&_p]:m-0" />
                    {v.question.question_type === "multiple_choice" ? (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {v.question.options.map((o, k) => (
                          <span key={k} className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${o.is_correct ? "bg-emerald-100 font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-muted"}`}>
                            {o.is_correct && <Check className="h-3 w-3" />}<MathText text={o.text} />
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">{L("Réponse attendue", "الجواب المنتظر", "Expected answer")} : {String(v.answer).replace(".", language === "en" ? "." : ",")}{unit ? ` ${unit}` : ""}</p>
                    )}
                  </li>
                ))}
                {variants.length < count && variants.length > 0 && (
                  <li className="text-xs text-muted-foreground">{L("Pas assez de combinaisons différentes : élargissez les intervalles.", "التوليفات المختلفة غير كافية: وسّع المجالات.", "Not enough distinct combinations: widen the ranges.")}</li>
                )}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{L("Fermer", "إغلاق", "Close")}</Button>
          <Button variant="outline" onClick={saveTemplate} disabled={busy || !!formulaError}>
            {L("Enregistrer le modèle dans la banque", "حفظ النموذج في البنك", "Save template to bank")}
          </Button>
          {examId && (
            <Button onClick={addToQuiz} disabled={busy || !variants.length} className="gap-1.5">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {L(`Ajouter ${variants.length} question(s) au quiz`, `إضافة ${variants.length} سؤال إلى الاختبار`, `Add ${variants.length} question(s) to the quiz`)}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

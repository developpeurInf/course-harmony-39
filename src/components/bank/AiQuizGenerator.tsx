/**
 * Générer des questions de quiz avec l'IA à partir d'un document du cours (PDF, image)
 * ou d'un texte collé. Le professeur relit, décoche ce qu'il ne veut pas, puis ajoute.
 */
import { useEffect, useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MathHtml, MathText } from "@/components/math/MathContent";
import { accessStore } from "@/contexts/AccessContext";
import { supabase } from "@/integrations/supabase/client";
import { insertIntoExam, saveToBank, type DraftQuestion } from "@/lib/questionBank";
import { aiErrorMessage, callTeacherAi, loadAiMaterials, type AiQuizQuestion } from "@/lib/teacherAi";
import type { CourseMaterialLike } from "@/lib/courseMedia";

type Lang = "fr" | "ar" | "en";
const escapeHtml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export default function AiQuizGenerator({
  open, onOpenChange, language, examId, courseId, startOrder, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  language: Lang;
  examId: string;
  courseId?: string | null;
  startOrder: number;
  onDone: () => void | Promise<void>;
}) {
  const L = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en);
  const [materials, setMaterials] = useState<(CourseMaterialLike & { course_id: string; course_title?: string })[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [materialId, setMaterialId] = useState("none");
  const [text, setText] = useState("");
  const [count, setCount] = useState(10);
  const [level, setLevel] = useState("");
  const [qLang, setQLang] = useState<"ar" | "fr">(language === "ar" ? "ar" : "fr");
  const [types, setTypes] = useState({ multiple_choice: true, true_false: true, short_answer: false });
  const [busy, setBusy] = useState(false);
  const [alsoBank, setAlsoBank] = useState(true);
  const [result, setResult] = useState<AiQuizQuestion[] | null>(null);
  const [keep, setKeep] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    // Documents du cours du quiz d'abord, puis ceux de ses autres cours (le quiz peut ne pas
    // être rattaché à un cours, ou son cours n'avoir aucun PDF ni image)
    setLoadingMaterials(true);
    void (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        const { data: cs } = uid ? await supabase.from("courses").select("id, title").eq("professor_id", uid) : { data: [] as { id: string; title: string }[] };
        const titles = new Map(((cs || []) as { id: string; title: string }[]).map((c) => [c.id, c.title]));
        const ids = [...new Set([...(courseId ? [courseId] : []), ...titles.keys()])];
        const all = (await loadAiMaterials(ids)).map((m) => ({ ...m, course_title: titles.get(m.course_id) }));
        all.sort((a, b) => Number(b.course_id === courseId) - Number(a.course_id === courseId) || String(a.course_title || "").localeCompare(String(b.course_title || "")));
        setMaterials(all);
        const own = all.filter((x) => x.course_id === courseId);
        setMaterialId(own.find((x) => /\.pdf/i.test(x.file_path))?.id || own[0]?.id || "none");
      } finally {
        setLoadingMaterials(false);
      }
    })();
  }, [open, courseId]);

  const generate = async () => {
    if (busy) return;
    if (!accessStore.guard("ai.quiz_generator")) return;
    const t = Object.entries(types).filter(([, v]) => v).map(([k]) => k);
    if (!t.length) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await callTeacherAi<{ quiz: { title: string; questions: AiQuizQuestion[] } }>({
        action: "quiz", language: qLang, text, material_id: materialId === "none" ? undefined : materialId, count, level, types: t,
      });
      const qs = (r.quiz?.questions || []).filter((q) => q.question?.trim());
      setResult(qs);
      setKeep(new Set(qs.map((_, i) => i)));
    } catch (e: any) {
      toast.error(aiErrorMessage(String(e?.message || ""), L));
    } finally {
      setBusy(false);
    }
  };

  const toDraft = (q: AiQuizQuestion): DraftQuestion => {
    const type = q.type === "true_false" || q.type === "short_answer" ? q.type : "multiple_choice";
    let options = type === "short_answer" ? [] : q.options.filter((o) => o.text?.trim());
    if (type === "true_false") {
      const trueOk = options.find((o) => /^(true|vrai|صحيح)$/i.test(o.text.trim()))?.is_correct ?? !!options[0]?.is_correct;
      options = [{ text: "True", is_correct: trueOk }, { text: "False", is_correct: !trueOk }];
    }
    const body = q.question.split(/\r?\n/).filter((l) => l.trim()).map((l) => `<p>${escapeHtml(l)}</p>`).join("");
    return { question: body, question_type: type, points: Math.min(5, Math.max(1, q.points || 1)), options };
  };

  const add = async () => {
    if (!result || adding) return;
    if (!accessStore.guard("quiz.edit")) return;
    const chosen = result.filter((_, i) => keep.has(i)).map(toDraft).filter((d) => d.question_type === "short_answer" || d.options.some((o) => o.is_correct));
    if (!chosen.length) return;
    setAdding(true);
    try {
      const n = await insertIntoExam(examId, startOrder, chosen);
      if (alsoBank) {
        const src = materials.find((m) => m.id === materialId);
        await saveToBank(chosen.map((d) => ({ ...d, chapter: src?.course_title || null })), { source: "ai", courseId: src?.course_id || courseId || null })
          .catch((e) => console.warn("bank", e));
      }
      toast.success(L(`${n} question(s) ajoutée(s).`, `تمت إضافة ${n} سؤال.`, `${n} question(s) added.`));
      onOpenChange(false);
      await onDone();
    } catch (e) {
      console.error(e);
      toast.error(L("Échec de l'ajout. Aucune question n'a été ajoutée.", "تعذرت الإضافة. لم تتم إضافة أي سؤال.", "Failed. No question was added."));
    } finally {
      setAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && !adding && onOpenChange(o)}>
      <DialogContent className="max-h-[92vh] w-[95vw] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-violet-500" />{L("Générer des questions avec l'IA", "توليد أسئلة بالذكاء الاصطناعي", "Generate questions with AI")}</DialogTitle>
          <DialogDescription>
            {L("L'IA lit le document du cours et propose des questions. Relisez-les toujours : vous gardez seulement celles qui vous conviennent.",
              "يقرأ الذكاء الاصطناعي وثيقة الدرس ويقترح أسئلة. راجعها دائماً واحتفظ فقط بما يناسبك.",
              "The AI reads the course document and suggests questions. Always review them and keep only those you want.")}
          </DialogDescription>
        </DialogHeader>

        {!result && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{L("Document du cours", "وثيقة الدرس", "Course document")}</Label>
              <Select value={materialId} onValueChange={setMaterialId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{L("Aucun (texte collé uniquement)", "بدون (نص ملصق فقط)", "None (pasted text only)")}</SelectItem>
                  {materials.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.file_name}{m.course_id !== courseId && m.course_title ? ` · ${m.course_title}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!loadingMaterials && materials.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {L("Aucun PDF ni image dans vos cours. Ajoutez le document au cours (onglet Documents), ou collez le texte ci-dessous.",
                    "لا توجد ملفات PDF أو صور في دروسك. أضف الوثيقة إلى الدرس، أو ألصق النص أسفله.",
                    "No PDF or image in your courses. Add the document to the course, or paste the text below.")}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{L("Texte du cours ou consignes (facultatif)", "نص الدرس أو توجيهات (اختياري)", "Course text or instructions (optional)")}</Label>
              <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} dir="auto"
                placeholder={L("Collez un résumé du cours, ou précisez : « seulement la partie 2 », « niveau 3AC »…", "ألصق ملخص الدرس أو حدد: « الجزء الثاني فقط »…", "Paste a summary, or say: “only part 2”…")} />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-xs">{L("Questions", "عدد الأسئلة", "Questions")}</Label>
                <Input type="number" min={1} max={30} value={count} onChange={(e) => setCount(Math.min(30, Math.max(1, Number(e.target.value) || 10)))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{L("Langue", "اللغة", "Language")}</Label>
                <Select value={qLang} onValueChange={(v) => setQLang(v as "ar" | "fr")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="ar">العربية</SelectItem><SelectItem value="fr">Français</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">{L("Niveau", "المستوى", "Level")}</Label>
                <Input value={level} onChange={(e) => setLevel(e.target.value)} placeholder={L("ex. 2e année collège", "مثلاً: الثانية إعدادي", "e.g. grade 8")} />
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              {([["multiple_choice", "QCM", "اختيار من متعدد", "Multiple choice"], ["true_false", L("Vrai / Faux", "صحيح / خطأ", "True / False"), "صحيح / خطأ", "True / False"], ["short_answer", L("Réponse courte", "جواب قصير", "Short answer"), "جواب قصير", "Short answer"]] as const).map(([k, fr, ar, en]) => (
                <label key={k} className="flex items-center gap-2">
                  <Checkbox checked={types[k]} onCheckedChange={(v) => setTypes((t) => ({ ...t, [k]: !!v }))} />{L(fr, ar, en)}
                </label>
              ))}
            </div>
          </div>
        )}

        {busy && (
          <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin text-violet-500" />
            {L("Lecture du cours et rédaction des questions… (jusqu'à une minute)", "قراءة الدرس وكتابة الأسئلة… (قد يستغرق دقيقة)", "Reading the course and writing questions… (up to a minute)")}
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{L(`${keep.size} / ${result.length} question(s) retenue(s)`, `${keep.size} / ${result.length} سؤال محدد`, `${keep.size} / ${result.length} selected`)}</p>
            <ul className="max-h-[55vh] space-y-1.5 overflow-y-auto">
              {result.map((q, i) => {
                const d = toDraft(q);
                return (
                  <li key={i} className="flex items-start gap-2.5 rounded-lg border px-3 py-2" dir={qLang === "ar" ? "rtl" : "ltr"}>
                    <Checkbox className="mt-0.5" checked={keep.has(i)} onCheckedChange={(v) => setKeep((s) => { const n = new Set(s); if (v) n.add(i); else n.delete(i); return n; })} aria-label={`Q${i + 1}`} />
                    <div className="min-w-0 flex-1 text-sm">
                      <MathHtml html={d.question} className="font-medium [&_p]:m-0" />
                      {d.question_type !== "short_answer" ? (
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {d.options.map((o, k) => (
                            <span key={k} className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${o.is_correct ? "bg-emerald-100 font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-muted"}`}>
                              {o.is_correct && <Check className="h-3 w-3" />}
                              {d.question_type === "true_false" ? (o.text === "True" ? L("Vrai", "صحيح", "True") : L("Faux", "خطأ", "False")) : <MathText text={o.text} />}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {q.explanation && <p className="mt-1 text-xs text-muted-foreground"><MathText text={q.explanation} /></p>}
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{d.points} pt</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy || adding}>{L("Fermer", "إغلاق", "Close")}</Button>
          {result ? (
            <>
              <label className="me-auto flex items-center gap-2 text-sm">
                <Checkbox checked={alsoBank} onCheckedChange={(v) => setAlsoBank(!!v)} />
                {L("Garder aussi dans ma banque", "الاحتفاظ بها في بنكي أيضا", "Also keep in my bank")}
              </label>
              <Button variant="outline" onClick={() => setResult(null)} disabled={adding}>{L("Recommencer", "إعادة", "Start over")}</Button>
              <Button onClick={() => void add()} disabled={adding || !keep.size} className="gap-1.5">
                {adding && <Loader2 className="h-4 w-4 animate-spin" />}{L(`Ajouter ${keep.size} question(s)`, `إضافة ${keep.size} سؤال`, `Add ${keep.size} question(s)`)}
              </Button>
            </>
          ) : (
            <Button onClick={() => void generate()} disabled={busy || (materialId === "none" && !text.trim()) || !Object.values(types).some(Boolean)} className="gap-1.5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{L("Générer", "توليد", "Generate")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

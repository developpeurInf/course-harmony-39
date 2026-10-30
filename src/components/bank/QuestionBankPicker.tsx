/**
 * Choisir des questions dans sa banque pour les ajouter au quiz en cours.
 * Les modèles à paramètres donnent une ou plusieurs variantes fraîches à chaque ajout.
 */
import { useEffect, useMemo, useState } from "react";
import { Dices, Library, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MathHtml } from "@/components/math/MathContent";
import { accessStore } from "@/contexts/AccessContext";
import { generateVariants, insertIntoExam, loadBank, markUsed, plainText, type BankQuestion, type DraftQuestion } from "@/lib/questionBank";

type Lang = "fr" | "ar" | "en";

export default function QuestionBankPicker({
  open, onOpenChange, language, examId, startOrder, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  language: Lang;
  examId: string;
  startOrder: number;
  onDone: () => void | Promise<void>;
}) {
  const L = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en);
  const [items, setItems] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState(false);
  const [q, setQ] = useState("");
  const [chapter, setChapter] = useState("all");
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [level, setLevel] = useState("all");
  const [tag, setTag] = useState("all");
  const [drawN, setDrawN] = useState(5);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPicked({});
    setLoading(true);
    loadBank()
      .then((d) => { setItems(d); setMissing(false); })
      .catch(() => setMissing(true))
      .finally(() => setLoading(false));
  }, [open]);

  const chapters = useMemo(() => [...new Set(items.map((i) => i.chapter).filter(Boolean) as string[])].sort(), [items]);
  const levels = useMemo(() => [...new Set(items.map((i) => i.level).filter(Boolean) as string[])].sort(), [items]);
  const tags = useMemo(() => [...new Set(items.flatMap((i) => i.tags))].sort(), [items]);
  const shown = items.filter((i) =>
    (chapter === "all" || i.chapter === chapter) &&
    (level === "all" || i.level === level) &&
    (tag === "all" || i.tags.includes(tag)) &&
    (!q.trim() || `${plainText(i.question)} ${i.tags.join(" ")} ${i.chapter || ""}`.toLowerCase().includes(q.trim().toLowerCase()))
  );
  const total = Object.values(picked).reduce((s, n) => s + n, 0);

  /** Tirage au hasard parmi les questions affichées (filtres chapitre / niveau / compétence), jamais utilisées d'abord */
  const draw = () => {
    const pool = [...shown].sort(() => Math.random() - 0.5).sort((a, b) => Number(!!a.times_used) - Number(!!b.times_used));
    const next: Record<string, number> = {};
    pool.slice(0, Math.max(1, drawN)).forEach((it) => (next[it.id] = 1));
    setPicked(next);
  };

  const add = async () => {
    if (!total || busy) return;
    if (!accessStore.guard("quiz.edit")) return;
    setBusy(true);
    try {
      const drafts: DraftQuestion[] = [];
      items.forEach((it) => {
        const n = picked[it.id];
        if (!n) return;
        if (it.template) {
          generateVariants(it.question, it.template, {
            count: n, type: it.question_type === "short_answer" ? "short_answer" : "multiple_choice", points: it.points, choices: 4, lang: language,
          }).forEach((v) => drafts.push(v.question));
        } else {
          drafts.push({ question: it.question, question_type: it.question_type, points: it.points, options: it.options || [] });
        }
      });
      const n = await insertIntoExam(examId, startOrder, drafts);
      void markUsed(Object.keys(picked).filter((id) => picked[id]), new Map(items.map((i) => [i.id, i.times_used])));
      toast.success(L(`${n} question(s) ajoutée(s) depuis la banque.`, `تمت إضافة ${n} سؤال من البنك.`, `${n} question(s) added from the bank.`));
      onOpenChange(false);
      await onDone();
    } catch (e) {
      console.error(e);
      toast.error(L("Échec de l'ajout. Aucune question n'a été ajoutée.", "تعذرت الإضافة. لم تتم إضافة أي سؤال.", "Failed. No question was added."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-h-[92vh] w-[95vw] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Library className="h-5 w-5 text-muted-foreground" />{L("Banque de questions", "بنك الأسئلة", "Question bank")}</DialogTitle>
          <DialogDescription>
            {L("Cochez les questions à ajouter à ce quiz. Enregistrez vos questions dans la banque depuis la liste du quiz (icône marque-page).",
              "حدد الأسئلة التي تريد إضافتها. احفظ أسئلتك في البنك من قائمة الاختبار (أيقونة العلامة).",
              "Tick the questions to add. Save questions to the bank from the quiz list (bookmark icon).")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} className="ps-8" placeholder={L("Rechercher…", "بحث…", "Search…")} />
          </div>
          {levels.length > 0 && (
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{L("Tous niveaux", "كل المستويات", "All levels")}</SelectItem>
                {levels.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {tags.length > 0 && (
            <Select value={tag} onValueChange={setTag}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{L("Toutes compétences", "كل الكفايات", "All skills")}</SelectItem>
                {tags.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {shown.length > 1 && (
            <div className="flex items-center gap-1.5">
              <Input type="number" min={1} max={shown.length} value={drawN} onChange={(e) => setDrawN(Math.max(1, Number(e.target.value) || 1))} className="w-16" aria-label={L("Nombre de questions à tirer", "عدد الأسئلة", "Number of questions to draw")} />
              <Button type="button" variant="outline" onClick={draw}>{L("Tirer au hasard", "سحب عشوائي", "Random draw")}</Button>
            </div>
          )}
          {chapters.length > 0 && (
            <Select value={chapter} onValueChange={setChapter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{L("Tous les chapitres", "كل الفصول", "All chapters")}</SelectItem>
                {chapters.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : missing ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{L("La banque de questions sera disponible après la mise à jour de la base de données.", "سيتوفر بنك الأسئلة بعد تحديث قاعدة البيانات.", "The question bank will be available after the database update.")}</p>
        ) : shown.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{items.length ? L("Aucun résultat.", "لا توجد نتائج.", "No results.") : L("Votre banque est vide.", "بنك أسئلتك فارغ.", "Your bank is empty.")}</p>
        ) : (
          <ul className="max-h-[55vh] space-y-1.5 overflow-y-auto">
            {shown.map((it) => (
              <li key={it.id} className="flex items-start gap-2.5 rounded-lg border px-3 py-2">
                <Checkbox
                  className="mt-0.5"
                  checked={!!picked[it.id]}
                  onCheckedChange={(v) => setPicked((p) => ({ ...p, [it.id]: v ? (it.template ? 3 : 1) : 0 }))}
                  aria-label={plainText(it.question).slice(0, 60)}
                />
                <div className="min-w-0 flex-1">
                  <MathHtml html={it.question} className="line-clamp-2 text-sm [&_p]:m-0 [&_img]:max-h-16" />
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {it.template ? L("Modèle à paramètres", "نموذج بمعاملات", "Template") : it.question_type === "true_false" ? L("V/F", "ص/خ", "T/F") : it.question_type === "short_answer" ? L("Réponse courte", "جواب قصير", "Short answer") : "QCM"}
                    {it.chapter ? ` · ${it.chapter}` : ""} · {it.points} pt{it.times_used ? ` · ${L(`utilisée ${it.times_used} fois`, `استعملت ${it.times_used} مرة`, `used ${it.times_used}×`)}` : ""}
                  </p>
                </div>
                {it.template && !!picked[it.id] && (
                  <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <Dices className="h-3.5 w-3.5" />
                    <Input type="number" min={1} max={30} className="h-7 w-14" value={picked[it.id]}
                      onChange={(e) => setPicked((p) => ({ ...p, [it.id]: Math.min(30, Math.max(1, Number(e.target.value) || 1)) }))}
                      aria-label={L("Nombre de variantes", "عدد النسخ", "Number of variants")} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{L("Annuler", "إلغاء", "Cancel")}</Button>
          <Button onClick={add} disabled={busy || !total} className="gap-1.5">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {L(`Ajouter ${total} question(s)`, `إضافة ${total} سؤال`, `Add ${total} question(s)`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

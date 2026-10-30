/**
 * Banque de questions du professeur : classer par chapitre et niveau, retrouver,
 * supprimer, créer des modèles à paramètres aléatoires. Les questions s'ajoutent
 * aux quiz depuis l'éditeur de quiz (bouton « Banque »).
 */
import { useCourses } from "@/contexts/CourseContext";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Dices, Library, Loader2, Pencil, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "@/lib/router";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { accessStore } from "@/contexts/AccessContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MathHtml, MathText } from "@/components/math/MathContent";
import ParamQuestionGenerator, { type GeneratorInitial } from "@/components/bank/ParamQuestionGenerator";
import { loadBank, plainText, type BankQuestion } from "@/lib/questionBank";

const QuestionBank = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const lang = language === "ar" ? "ar" : language === "en" ? "en" : "fr";
  const tr = useCallback((fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en), [language]);
  const [items, setItems] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [q, setQ] = useState("");
  const [chapter, setChapter] = useState("all");
  const [kind, setKind] = useState("all");
  const [usage, setUsage] = useState("all");
  const { courses } = useCourses();
  const [genOpen, setGenOpen] = useState(false);
  const [genInitial, setGenInitial] = useState<GeneratorInitial | null>(null);
  const [editing, setEditing] = useState<BankQuestion | null>(null);
  const [meta, setMeta] = useState({ chapter: "", level: "", tags: "" });
  const [toDelete, setToDelete] = useState<BankQuestion | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await loadBank());
      setMissing(false);
    } catch {
      setMissing(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const chapters = useMemo(() => [...new Set(items.map((i) => i.chapter).filter(Boolean) as string[])].sort(), [items]);
  const shown = items.filter((i) =>
    (chapter === "all" || i.chapter === chapter) &&
    (kind === "all" || (kind === "template" ? !!i.template : !i.template && i.question_type === kind)) &&
    (usage === "all" || (usage === "unused" ? !i.times_used : !!i.times_used)) &&
    (!q.trim() || `${plainText(i.question)} ${i.tags.join(" ")} ${i.chapter || ""} ${i.level || ""}`.toLowerCase().includes(q.trim().toLowerCase()))
  );

  const openEdit = (it: BankQuestion) => {
    setEditing(it);
    setMeta({ chapter: it.chapter || "", level: it.level || "", tags: it.tags.join(", ") });
  };
  const saveMeta = async () => {
    if (!editing || busy) return;
    if (!accessStore.guard("quiz.bank")) return;
    setBusy(true);
    const patch = {
      chapter: meta.chapter.trim() || null,
      level: meta.level.trim() || null,
      tags: meta.tags.split(/[,;،]/).map((t) => t.trim()).filter(Boolean),
      updated_at: new Date().toISOString(),
    };
    const { error } = await (supabase as any).from("question_bank").update(patch).eq("id", editing.id);
    setBusy(false);
    if (error) {
      toast.error(tr("Enregistrement impossible.", "تعذر الحفظ.", "Unable to save."));
      return;
    }
    setItems((l) => l.map((i) => (i.id === editing.id ? { ...i, ...patch } : i)));
    setEditing(null);
  };
  const remove = async () => {
    if (!toDelete || busy) return;
    if (!accessStore.guard("quiz.bank")) return;
    setBusy(true);
    const { error } = await (supabase as any).from("question_bank").delete().eq("id", toDelete.id);
    setBusy(false);
    if (error) {
      toast.error(tr("Suppression impossible.", "تعذر الحذف.", "Unable to delete."));
      return;
    }
    setItems((l) => l.filter((i) => i.id !== toDelete.id));
    setToDelete(null);
  };

  if (user?.role !== "professor") return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Library className="h-6 w-6 text-muted-foreground" />{tr("Banque de questions", "بنك الأسئلة", "Question bank")}</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {tr("Vos questions réutilisables. Dans l'éditeur d'un quiz : l'icône marque-page enregistre une question ici, le bouton « Banque » la réutilise.",
              "أسئلتك القابلة لإعادة الاستعمال. في محرر الاختبار: أيقونة العلامة تحفظ السؤال هنا، وزر « البنك » يعيد استعماله.",
              "Your reusable questions. In the quiz editor, the bookmark icon saves a question here and the “Bank” button reuses it.")}
          </p>
        </div>
        <Button className="gap-1.5" onClick={() => { setGenInitial(null); setGenOpen(true); }}>
          <Dices className="h-4 w-4" />{tr("Nouveau modèle à paramètres", "نموذج جديد بمعاملات", "New randomised template")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} className="ps-8" placeholder={tr("Rechercher un énoncé, un mot-clé…", "ابحث عن نص أو كلمة مفتاحية…", "Search a statement, a tag…")} />
        </div>
        <Select value={chapter} onValueChange={setChapter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tr("Tous les chapitres", "كل الفصول", "All chapters")}</SelectItem>
            {chapters.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tr("Tous les types", "كل الأنواع", "All types")}</SelectItem>
            <SelectItem value="multiple_choice">QCM</SelectItem>
            <SelectItem value="true_false">{tr("Vrai / Faux", "صحيح / خطأ", "True / False")}</SelectItem>
            <SelectItem value="short_answer">{tr("Réponse courte", "جواب قصير", "Short answer")}</SelectItem>
            <SelectItem value="template">{tr("Modèles à paramètres", "نماذج بمعاملات", "Templates")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={usage} onValueChange={setUsage}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tr("Utilisées ou non", "مستعملة أو لا", "Used or not")}</SelectItem>
            <SelectItem value="unused">{tr("Jamais utilisées", "غير مستعملة", "Never used")}</SelectItem>
            <SelectItem value="used">{tr("Déjà utilisées", "سبق استعمالها", "Already used")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : missing ? (
        <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          {tr("La banque de questions sera disponible après la mise à jour de la base de données (migration 20261030090000).", "سيتوفر بنك الأسئلة بعد تحديث قاعدة البيانات.", "The question bank will be available after the database update.")}
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {items.length ? tr("Aucune question ne correspond.", "لا يوجد سؤال مطابق.", "No matching question.") : tr("Votre banque est vide pour l'instant.", "بنكك فارغ حالياً.", "Your bank is empty for now.")}
        </div>
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">
          {shown.map((it) => (
            <li key={it.id} className="flex flex-col rounded-xl border bg-card p-3">
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="rounded bg-muted px-1.5 py-0.5 font-semibold">
                  {it.template ? tr("Modèle", "نموذج", "Template") : it.question_type === "true_false" ? tr("V/F", "ص/خ", "T/F") : it.question_type === "short_answer" ? tr("Courte", "قصير", "Short") : "QCM"}
                </span>
                {it.chapter && <span>{it.chapter}</span>}
                {it.level && <span>· {it.level}</span>}
                {it.tags.map((t) => <span key={t} className="rounded-full border px-1.5">{t}</span>)}
                {it.source === "ai" && (
                  <span className="rounded bg-violet-100 px-1.5 py-0.5 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300" title={tr("Générée par l'IA", "مولدة بالذكاء الاصطناعي", "AI-generated")}>
                    IA{it.source_course_id && courses.find((c) => c.id === it.source_course_id) ? ` · ${courses.find((c) => c.id === it.source_course_id)!.title}` : ""}
                  </span>
                )}
                <span className="ms-auto">{it.points} pt{it.times_used
                  ? ` · ${tr(`utilisée ${it.times_used} fois`, `استعملت ${it.times_used} مرة`, `used ${it.times_used}×`)}${it.last_used_at ? ` (${new Date(it.last_used_at).toLocaleDateString(language === "ar" ? "ar-MA" : language === "fr" ? "fr-FR" : "en-GB")})` : ""}`
                  : ` · ${tr("jamais utilisée", "غير مستعملة", "never used")}`}</span>
              </div>
              <MathHtml html={it.question} className="text-sm [&_p]:m-0 [&_img]:max-h-24" />
              {it.template ? (
                <p className="mt-1 font-mono text-xs text-muted-foreground" dir="ltr">= {it.template.answer}{it.template.unit ? ` ${it.template.unit}` : ""}</p>
              ) : it.question_type !== "short_answer" && it.options.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {it.options.map((o, k) => (
                    <span key={k} className={`rounded px-1.5 py-0.5 text-xs ${o.is_correct ? "bg-emerald-100 font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-muted"}`}>
                      {it.question_type === "true_false" ? (/^(true|vrai)$/i.test(o.text) ? tr("Vrai", "صحيح", "True") : tr("Faux", "خطأ", "False")) : <MathText text={o.text} />}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-2 flex justify-end gap-1">
                {it.template && (
                  <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => {
                    setGenInitial({ statement: it.question, template: it.template!, type: it.question_type === "short_answer" ? "short_answer" : "multiple_choice", points: it.points, chapter: it.chapter });
                    setGenOpen(true);
                  }}>
                    <Copy className="h-3.5 w-3.5" />{tr("Variantes / copie", "نسخ ومتغيرات", "Variants / copy")}
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => openEdit(it)}><Pencil className="h-3.5 w-3.5" />{tr("Classer", "تصنيف", "Classify")}</Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => setToDelete(it)} aria-label={tr("Supprimer", "حذف", "Delete")}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ParamQuestionGenerator open={genOpen} onOpenChange={setGenOpen} language={lang} initial={genInitial} onDone={load} />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{tr("Classer la question", "تصنيف السؤال", "Classify the question")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>{tr("Chapitre", "الفصل", "Chapter")}</Label><Input value={meta.chapter} onChange={(e) => setMeta((m) => ({ ...m, chapter: e.target.value }))} list="bank-chapters" /></div>
            <datalist id="bank-chapters">{chapters.map((c) => <option key={c} value={c} />)}</datalist>
            <div className="space-y-1.5"><Label>{tr("Niveau", "المستوى", "Level")}</Label><Input value={meta.level} onChange={(e) => setMeta((m) => ({ ...m, level: e.target.value }))} placeholder={tr("ex. 2AC, facile", "مثلاً: 2إع، سهل", "e.g. grade 8, easy")} /></div>
            <div className="space-y-1.5"><Label>{tr("Mots-clés (séparés par des virgules)", "كلمات مفتاحية (مفصولة بفواصل)", "Tags (comma-separated)")}</Label><Input value={meta.tags} onChange={(e) => setMeta((m) => ({ ...m, tags: e.target.value }))} /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>{tr("Annuler", "إلغاء", "Cancel")}</Button>
            <Button onClick={saveMeta} disabled={busy}>{tr("Enregistrer", "حفظ", "Save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr("Supprimer cette question de la banque ?", "حذف هذا السؤال من البنك؟", "Delete this question from the bank?")}</AlertDialogTitle>
            <AlertDialogDescription>{tr("Les quiz qui l'utilisent déjà ne changent pas.", "الاختبارات التي تستعمله لن تتغير.", "Quizzes already using it are not affected.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr("Annuler", "إلغاء", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void remove(); }} className="bg-rose-600 hover:bg-rose-700">{tr("Supprimer", "حذف", "Delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default QuestionBank;

/** Bibliothèque partagée entre professeurs : contenus validés par l'administration, à importer */
import { useEffect, useMemo, useState } from "react";
import { Download, LibraryBig, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses } from "@/contexts/CourseContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { accessStore } from "@/contexts/AccessContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { kindLabel, LibraryPreview } from "@/components/library/LibraryShared";
import { cn } from "@/lib/utils";

const db = supabase as any;

export default function Library() {
  const { user } = useAuth();
  const { rooms, courses, refreshData } = useCourses();
  const { language } = useLanguage();
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);
  const [items, setItems] = useState<any[] | null>(null);
  const [tab, setTab] = useState<"browse" | "mine">("browse");
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () => db.from("library_items").select("*").order("created_at", { ascending: false }).limit(500)
    .then(({ data, error }: any) => {
      if (error) setError(error.message);
      setItems(data || []);
    });
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const myRooms = rooms.filter(r => r.professor_id === user?.id && !r.archived_at);
  const myCourses = courses.filter(c => c.professor_id === user?.id);
  const shown = useMemo(() => (items || []).filter(i =>
    (tab === "mine" ? i.owner_id === user?.id : i.status === "approved") &&
    (kind === "all" || i.kind === kind) &&
    (!q.trim() || `${i.title} ${i.description || ""} ${i.level || ""}`.toLowerCase().includes(q.trim().toLowerCase()))
  ), [items, tab, kind, q, user?.id]);

  const doImport = async () => {
    if (!preview || !accessStore.guard("library.import")) return;
    if (preview.kind !== "lesson_plan" && !target) return;
    setBusy(true);
    const { error } = await db.rpc("library_import", {
      p_item: preview.id,
      p_room: preview.kind === "course" ? target : null,
      p_course: preview.kind === "quiz" ? target : null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(tr("Importé (masqué) : relisez puis publiez.", "تم الاستيراد (مخفي): راجعه ثم انشره.", "Imported (hidden): review, then publish."));
    setPreview(null);
    setTarget("");
    void refreshData(undefined, { force: true });
    load();
  };
  const remove = async (id: string) => {
    const { error } = await db.from("library_items").delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };
  const statusTone = (s: string) => s === "approved" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" : s === "rejected" ? "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300";
  const statusLabel = (s: string) => s === "approved" ? tr("Publié", "منشور", "Published") : s === "rejected" ? tr("Refusé", "مرفوض", "Rejected") : tr("En validation", "قيد المصادقة", "Under review");

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><LibraryBig className="h-6 w-6 text-muted-foreground" />{tr("Bibliothèque partagée", "المكتبة المشتركة", "Shared library")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{tr("Cours, quiz et fiches partagés par d'autres professeurs et validés par l'administration. Partagez les vôtres avec le bouton « Partager ».", "دروس واختبارات وجذاذات يشاركها أساتذة آخرون وتصادق عليها الإدارة. شارك محتواك بزر « مشاركة ».", "Courses, quizzes and plans shared by other teachers and reviewed by the administration. Share yours with the “Share” button.")}</p>
      </div>
      {error && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{tr("Disponible après la mise à jour de la base de données (migration 20261107090000).", "متاحة بعد تحديث قاعدة البيانات.", "Available after the database update.")}</p>}

      <div className="flex flex-wrap gap-2">
        <div className="inline-flex rounded-lg border p-0.5">
          {(["browse", "mine"] as const).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)} className={cn("rounded-md px-3 py-1.5 text-sm", tab === t ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
              {t === "browse" ? tr("Parcourir", "تصفح", "Browse") : tr("Mes partages", "مشاركاتي", "My shares")}
            </button>
          ))}
        </div>
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} className="ps-8" placeholder={tr("Rechercher…", "بحث…", "Search…")} />
        </div>
        <select value={kind} onChange={e => setKind(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm" aria-label={tr("Type", "النوع", "Type")}>
          <option value="all">{tr("Tous les types", "كل الأنواع", "All types")}</option>
          <option value="course">{kindLabel("course", tr)}</option>
          <option value="quiz">{kindLabel("quiz", tr)}</option>
          <option value="lesson_plan">{kindLabel("lesson_plan", tr)}</option>
        </select>
      </div>

      {items === null ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : shown.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{tab === "mine" ? tr("Vous n'avez rien partagé. Utilisez « Partager » sur un cours, un quiz ou une fiche.", "لم تشارك شيئا بعد. استعمل « مشاركة » على درس أو اختبار أو جذاذة.", "You haven't shared anything. Use “Share” on a course, quiz or plan.") : tr("Aucun contenu pour l'instant.", "لا يوجد محتوى حاليا.", "No content yet.")}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map(i => (
            <li key={i.id} className="flex flex-col rounded-xl border bg-card p-4">
              <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span className="rounded bg-muted px-1.5 py-0.5 font-semibold">{kindLabel(i.kind, tr)}</span>
                {i.level && <span>{i.level}</span>}
                {tab === "mine" && <span className={cn("rounded-full px-2", statusTone(i.status))}>{statusLabel(i.status)}</span>}
                <span className="ms-auto">{tr(`${i.imports} import(s)`, `${i.imports} استيراد`, `${i.imports} import(s)`)}</span>
              </div>
              <h2 className="font-semibold">{i.title}</h2>
              {i.description && <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{i.description}</p>}
              {tab === "mine" && i.review_note && <p className="mt-1 text-xs text-muted-foreground">{tr("Note de l'administration : ", "ملاحظة الإدارة: ", "Admin note: ")}{i.review_note}</p>}
              <div className="mt-auto flex justify-end gap-2 pt-3">
                {tab === "mine" && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(i.id)} aria-label={tr("Retirer", "سحب", "Remove")}><Trash2 className="h-4 w-4" /></Button>}
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setPreview(i); setTarget(""); }}><Download className="h-4 w-4" />{tr("Voir et importer", "عرض واستيراد", "View & import")}</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!preview} onOpenChange={v => !v && setPreview(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {preview && (
            <>
              <DialogHeader>
                <DialogTitle>{preview.title}</DialogTitle>
                <DialogDescription>{kindLabel(preview.kind, tr)}{preview.level ? ` · ${preview.level}` : ""}</DialogDescription>
              </DialogHeader>
              <div className="max-h-[45vh] overflow-y-auto rounded-lg border p-3"><LibraryPreview item={preview} tr={tr} /></div>
              {preview.kind !== "lesson_plan" && (
                <div className="space-y-1.5">
                  <label htmlFor="lib-target" className="text-sm font-medium">{preview.kind === "course" ? tr("Importer dans la classe", "الاستيراد إلى القسم", "Import into class") : tr("Importer dans le cours", "الاستيراد إلى الدرس", "Import into course")}</label>
                  <select id="lib-target" value={target} onChange={e => setTarget(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="">—</option>
                    {(preview.kind === "course" ? myRooms : myCourses).map((x: any) => <option key={x.id} value={x.id}>{x.name || x.title}</option>)}
                  </select>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setPreview(null)}>{tr("Fermer", "إغلاق", "Close")}</Button>
                <Button onClick={doImport} disabled={busy || (preview.kind !== "lesson_plan" && !target)} className="gap-1.5">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{tr("Importer", "استيراد", "Import")}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Bibliothèque partagée : bouton « Partager » et aperçu d'un contenu */
import { useState } from "react";
import { Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { accessStore } from "@/contexts/AccessContext";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MathHtml } from "@/components/math/MathContent";

const db = supabase as any;
type Tr = (fr: string, ar: string, en: string) => string;
export type LibraryKind = "course" | "quiz" | "lesson_plan";

export const kindLabel = (k: string, tr: Tr) =>
  k === "course" ? tr("Cours", "درس", "Course") : k === "quiz" ? tr("Quiz / examen", "اختبار / امتحان", "Quiz / exam") : tr("Fiche pédagogique", "جذاذة", "Lesson plan");

export function PublishToLibraryButton({ kind, sourceId, tr, size = "sm", variant = "ghost", iconOnly = false }: {
  kind: LibraryKind;
  sourceId: string;
  tr: Tr;
  size?: "sm" | "icon";
  variant?: "ghost" | "outline";
  iconOnly?: boolean;
}) {
  const { feature } = useAppSettings();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState("");
  const [level, setLevel] = useState("");
  const [busy, setBusy] = useState(false);
  if (!feature("library") || user?.role !== "professor") return null;

  const publish = async () => {
    if (!accessStore.guard("library.publish")) return;
    setBusy(true);
    const { error } = await db.rpc("library_publish", { p_kind: kind, p_source: sourceId, p_description: desc, p_level: level });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(tr("Envoyé : l'administration le valide avant de le partager.", "تم الإرسال: تصادق عليه الإدارة قبل نشره.", "Sent: the administration reviews it before sharing."));
    setOpen(false);
    setDesc("");
  };

  return (
    <>
      <Button type="button" size={iconOnly ? "icon" : size} variant={variant} className={iconOnly ? "h-8 w-8" : "gap-1.5"} onClick={() => setOpen(true)}
        title={tr("Partager dans la bibliothèque", "المشاركة في المكتبة", "Share to the library")} aria-label={tr("Partager dans la bibliothèque", "المشاركة في المكتبة", "Share to the library")}>
        <Share2 className="h-4 w-4" />{!iconOnly && tr("Partager", "مشاركة", "Share")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tr("Partager dans la bibliothèque", "المشاركة في المكتبة المشتركة", "Share to the library")}</DialogTitle>
            <DialogDescription>{tr("Une copie (texte et questions, sans les fichiers ni les élèves) est proposée aux autres professeurs après validation.", "تُقترح نسخة (النص والأسئلة، بدون الملفات أو التلاميذ) على الأساتذة الآخرين بعد المصادقة.", "A copy (text and questions, no files or students) is offered to other teachers after review.")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="lib-level">{tr("Niveau", "المستوى", "Level")}</Label><Input id="lib-level" value={level} onChange={e => setLevel(e.target.value)} placeholder={tr("ex. 1re année bac", "مثال: الأولى باكالوريا", "e.g. Grade 11")} maxLength={80} /></div>
            <div className="space-y-1.5"><Label htmlFor="lib-desc">{tr("Description", "الوصف", "Description")}</Label><Textarea id="lib-desc" rows={3} value={desc} onChange={e => setDesc(e.target.value)} maxLength={1000} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{tr("Annuler", "إلغاء", "Cancel")}</Button>
            <Button onClick={publish} disabled={busy} className="gap-1.5">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{tr("Envoyer", "إرسال", "Send")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Aperçu du contenu figé d'un élément de bibliothèque */
export function LibraryPreview({ item, tr }: { item: { kind: string; payload: any }; tr: Tr }) {
  const p = item.payload || {};
  if (item.kind === "quiz") {
    return (
      <ol className="list-decimal space-y-2 ps-5 text-sm">
        {(p.questions || []).map((q: any, i: number) => (
          <li key={i}>
            <MathHtml html={q.question} className="[&_p]:m-0" />
            {(q.options || []).length > 0 && (
              <ul className="mt-1 flex flex-wrap gap-1">
                {q.options.map((o: any, j: number) => <li key={j} className={`rounded border px-1.5 text-xs ${o.is_correct ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30" : ""}`}>{o.text}</li>)}
              </ul>
            )}
          </li>
        ))}
      </ol>
    );
  }
  if (item.kind === "course") {
    return (
      <div className="space-y-2 text-sm">
        {p.description && <p className="whitespace-pre-line">{p.description}</p>}
        {(p.exercises || []).length > 0 && (
          <>
            <p className="font-semibold">{tr("Exercices", "التمارين", "Exercises")}</p>
            <ul className="list-disc space-y-1 ps-5">{p.exercises.map((x: any, i: number) => <li key={i}><span className="font-medium">{x.title}</span>{x.description ? ` — ${String(x.description).slice(0, 160)}` : ""}</li>)}</ul>
          </>
        )}
      </div>
    );
  }
  const c = p.content || {};
  return (
    <div className="space-y-1 text-sm">
      {Object.entries(c).slice(0, 8).map(([k, v]) => (
        <p key={k}><span className="font-semibold">{k} : </span>{Array.isArray(v) ? (v as any[]).map(x => typeof x === "string" ? x : x?.phase || x?.title || "").filter(Boolean).join(" · ") : typeof v === "string" ? v.slice(0, 200) : ""}</p>
      ))}
    </div>
  );
}

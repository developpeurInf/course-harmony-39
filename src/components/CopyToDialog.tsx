/**
 * Copier un cours vers une classe, ou un exercice / quiz / examen vers un cours (d'une autre classe ou de la même).
 * La copie est créée masquée aux élèves ; les copies d'élèves et les notes ne sont jamais recopiées.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { accessStore } from "@/contexts/AccessContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const db = supabase as any;
type Tr = (fr: string, ar: string, en: string) => string;

export interface CopySource {
  kind: "course" | "exercise" | "exam";
  /** pour un examen : « quiz » (en ligne) ou autre type */
  examType?: string;
  id: string;
  title: string;
  /** classe d'origine (cours) ou cours d'origine (exercice) */
  parentId?: string | null;
}

export function CopyToDialog({ source, onClose, onDone, tr }: { source: CopySource | null; onClose: () => void; onDone?: () => void; tr: Tr }) {
  const { user } = useAuth();
  const [targets, setTargets] = useState<{ id: string; label: string }[] | null>(null);
  const [target, setTarget] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const isCourse = source?.kind === "course";

  useEffect(() => {
    if (!source || !user) return;
    setTarget(""); setTitle(source.title); setTargets(null);
    (async () => {
      const { data: rooms } = await db.from("rooms").select("id, name, archived_at").eq("professor_id", user.id).order("name");
      const active = (rooms || []).filter((r: any) => !r.archived_at);
      if (source.kind === "course") { setTargets(active.map((r: any) => ({ id: r.id, label: r.name }))); return; }
      const { data: courses } = await db.from("courses").select("id, title, room_id").eq("professor_id", user.id);
      const roomName = (id: string | null) => active.find((r: any) => r.id === id)?.name;
      setTargets((courses || [])
        .filter((c: any) => !c.room_id || roomName(c.room_id))
        .map((c: any) => ({ id: c.id, label: `${roomName(c.room_id) || tr("Sans classe", "بدون قسم", "No class")} · ${c.title}` }))
        .sort((a: any, b: any) => a.label.localeCompare(b.label)));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?.id, user?.id]);

  // même classe / même cours : on suffixe le titre pour distinguer la copie
  const samePlace = !!source && target === source.parentId;
  useEffect(() => {
    if (!source) return;
    const suffix = ` (${tr("copie", "نسخة", "copy")})`;
    setTitle((t) => (samePlace ? (t.endsWith(suffix) ? t : `${t}${suffix}`) : t.endsWith(suffix) ? t.slice(0, -suffix.length) : t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samePlace]);

  const label = useMemo(() => targets?.find((x) => x.id === target)?.label || "", [targets, target]);

  const run = async () => {
    if (!source || !target || busy) return;
    const perm = isCourse ? "course.edit" : source.kind === "exercise" ? "exercise.edit" : source.examType === "quiz" ? "quiz.edit" : "exam.edit";
    if (!accessStore.guard(perm)) return;
    if (source.kind === "exam" && !accessStore.guardQuota("quiz.max_per_month")) return;
    setBusy(true);
    const p_title = title.trim() || null;
    const { error } = isCourse
      ? await db.rpc("duplicate_course", { p_course_id: source.id, p_target_room_id: target, p_title })
      : source.kind === "exercise"
      ? await db.rpc("duplicate_exercise", { p_exercise_id: source.id, p_target_course_id: target, p_title })
      : await db.rpc("duplicate_exam", { p_exam_id: source.id, p_target_course_id: target, p_title });
    setBusy(false);
    if (error) {
      const msg = String(error.message || "");
      toast.error(/duplicate_(course|exercise|exam)|Could not find the function/i.test(msg)
        ? tr("La copie n'est pas encore activée sur le serveur (migration à exécuter).", "النسخ غير مفعّل بعد على الخادم.", "Copy is not enabled on the server yet (migration to run).")
        : /quota/i.test(msg)
        ? tr("Limite mensuelle de quiz atteinte pour votre offre.", "تم بلوغ الحد الشهري للاختبارات في عرضك.", "Monthly quiz limit reached for your plan.")
        : /PERMISSION_DENIED/.test(msg)
        ? tr("Votre offre ne permet pas de copier tous les éléments de ce cours.", "عرضك لا يسمح بنسخ كل عناصر هذا الدرس.", "Your plan doesn't allow copying every item of this course.")
        : tr("Échec de la copie.", "فشل النسخ.", "Copy failed."));
      return;
    }
    toast.success(tr(
      `Copié vers ${label}. La copie est masquée aux élèves : vérifiez-la puis publiez-la.`,
      `تم النسخ إلى ${label}. النسخة مخفية عن التلاميذ: راجعها ثم انشرها.`,
      `Copied to ${label}. The copy is hidden from students: review it, then publish it.`));
    onClose();
    onDone?.();
  };

  return (
    <Dialog open={!!source} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="w-[95vw] max-w-md">
        <DialogHeader>
          <DialogTitle>{isCourse ? tr("Copier le cours vers une classe", "نسخ الدرس إلى قسم", "Copy the course to a class") : source?.kind === "exam" ? tr("Copier vers un autre cours ou une autre classe", "نسخ إلى درس أو قسم آخر", "Copy to another course or class") : tr("Copier l'exercice vers un cours", "نسخ التمرين إلى درس", "Copy the exercise to a course")}</DialogTitle>
          <DialogDescription>
            {isCourse
              ? tr("Le cours est recopié avec ses supports, ses exercices, ses quiz et examens (avec leurs questions) et ses scènes 3D. Les copies des élèves et les notes ne sont pas recopiées.",
                  "يُنسخ الدرس مع وثائقه وتمارينه واختباراته (مع أسئلتها) ومشاهده ثلاثية الأبعاد. أوراق التلاميذ والنقط لا تُنسخ.",
                  "The course is copied with its materials, exercises, quizzes and exams (with their questions) and 3D scenes. Student work and grades are not copied.")
              : source?.kind === "exam"
              ? tr("Le quiz ou l'examen est recopié avec ses questions et ses réglages. Les copies des élèves ne sont pas recopiées.", "يُنسخ الاختبار أو الامتحان مع أسئلته وإعداداته. أوراق التلاميذ لا تُنسخ.", "The quiz or exam is copied with its questions and settings. Student work is not copied.")
              : tr("L'exercice est recopié avec ses pièces jointes. Les copies des élèves ne sont pas recopiées.", "يُنسخ التمرين مع مرفقاته. أوراق التلاميذ لا تُنسخ.", "The exercise is copied with its attachments. Student work is not copied.")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>{isCourse ? tr("Classe de destination", "القسم المستهدف", "Target class") : tr("Cours de destination", "الدرس المستهدف", "Target course")}</Label>
            {targets === null ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : (
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger><SelectValue placeholder={isCourse ? tr("Choisir la classe", "اختر القسم", "Choose the class") : tr("Choisir la classe et le cours", "اختر القسم والدرس", "Choose the class and course")} /></SelectTrigger>
                <SelectContent>
                  {targets.map((x) => (
                    <SelectItem key={x.id} value={x.id}>{x.label}{x.id === source?.parentId ? ` (${isCourse ? tr("classe actuelle", "القسم الحالي", "current class") : tr("cours actuel", "الدرس الحالي", "current course")})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label>{tr("Titre de la copie", "عنوان النسخة", "Title of the copy")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">{tr("La copie est créée masquée aux élèves : vous pourrez ajuster les dates avant de la publier.", "تُنشأ النسخة مخفية عن التلاميذ: يمكنك تعديل التواريخ قبل نشرها.", "The copy is hidden from students: you can adjust the dates before publishing it.")}</p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>{tr("Annuler", "إلغاء", "Cancel")}</Button>
          <Button onClick={run} disabled={!target || busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}{tr("Copier", "نسخ", "Copy")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

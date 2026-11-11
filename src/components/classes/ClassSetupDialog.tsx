"use client";
/**
 * Classes existantes sans niveau ni matière : le professeur les complète en une fois.
 * S'ouvre seul (une fois par session) quand la base a les colonnes mais que des classes
 * ne sont pas renseignées, ou à la demande (bouton de la page « proposés »).
 */
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses, type Room } from "@/contexts/CourseContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ClassLevelFields } from "./ClassLevelFields";
import { guessFromRoom } from "@/lib/proposed/catalog";
import { useTeacherSchool } from "@/lib/proposed/teacherSchool";

type Row = { level: string; subject: string; school_name: string };
const SEEN = "class-setup-dialog-seen";

/** null = colonne présente mais vide ; undefined = migration pas encore lancée */
export const roomNeedsSetup = (r: Room) => r.level === null || (r.level !== undefined && !r.subject);

export function ClassSetupDialog({ open, onOpenChange, onlyRoomId }: { open: boolean; onOpenChange: (v: boolean) => void; onlyRoomId?: string }) {
  const { user } = useAuth();
  const { rooms, updateRoom } = useCourses();
  const { language } = useLanguage();
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);
  const school = useTeacherSchool(user?.id);
  const list = useMemo(
    () => rooms.filter((r) => !r.archived_at && r.professor_id === user?.id && (onlyRoomId ? r.id === onlyRoomId : roomNeedsSetup(r))),
    [rooms, user?.id, onlyRoomId]
  );
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next: Record<string, Row> = {};
    list.forEach((r) => {
      const g = guessFromRoom(r.name, r.description);
      next[r.id] = { level: r.level || g.level || "", subject: r.subject || g.subject || "", school_name: r.school_name || school };
    });
    setRows(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, list.length, school]);

  const save = async () => {
    const missing = list.filter((r) => !rows[r.id]?.level || !rows[r.id]?.subject);
    if (missing.length) {
      const names = missing.map((r) => r.name).join(", ");
      toast.error(tr(`Indiquez le niveau et la matière de : ${names}`, `حدد المستوى والمادة لـ: ${names}`, `Set level and subject for: ${names}`));
      return;
    }
    setSaving(true);
    let ok = true;
    for (const r of list) {
      const v = rows[r.id];
      ok = (await updateRoom(r.id, { level: v.level, subject: v.subject, school_name: v.school_name.trim() || null }, { silent: true })) && ok;
    }
    setSaving(false);
    if (ok) {
      toast.success(tr("Classes mises à jour", "تم تحديث الأقسام", "Classes updated"));
      onOpenChange(false);
    } else {
      toast.error(tr(
        "Enregistrement impossible : la migration 20261122090000_rooms_level_subject.sql doit être exécutée dans Supabase.",
        "تعذر الحفظ: يجب تنفيذ ملف الترحيل في Supabase.",
        "Could not save: run the 20261122090000 migration in Supabase."
      ));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{onlyRoomId ? tr("Niveau et matière de la classe", "مستوى ومادة القسم", "Class level and subject") : tr("Complétez vos classes", "أكمل معلومات أقسامك", "Complete your classes")}</DialogTitle>
          <DialogDescription>
            {tr(
              "Le niveau et la matière choisissent les cours, exercices et exams proposés de chaque classe. Le lycée apparaît en tête des PDF.",
              "يحدد المستوى والمادة الدروس والتمارين والامتحانات المقترحة لكل قسم. ويظهر اسم الثانوية في رأس الوثائق.",
              "Level and subject choose the suggested courses, exercises and exams of each class. The school appears on the PDFs."
            )}
          </DialogDescription>
        </DialogHeader>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tr("Toutes vos classes sont complètes.", "جميع أقسامك مكتملة.", "All your classes are complete.")}</p>
        ) : (
          <ul className="space-y-4">
            {list.map((r) => (
              <li key={r.id} className="space-y-2 rounded-lg border p-3">
                <p className="text-sm font-semibold">{r.name}</p>
                {rows[r.id] && <ClassLevelFields compact idPrefix={`setup-${r.id}`} value={rows[r.id]} onChange={(v) => setRows((p) => ({ ...p, [r.id]: v }))} />}
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tr("Plus tard", "لاحقا", "Later")}</Button>
          {list.length > 0 && <Button onClick={save} disabled={saving}>{saving ? tr("Enregistrement…", "جار الحفظ…", "Saving…") : tr("Enregistrer", "حفظ", "Save")}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Ouverture automatique, une fois par session, pour un professeur dont des classes sont incomplètes */
export function ClassSetupPrompt() {
  const { user } = useAuth();
  const { rooms } = useCourses();
  const [open, setOpen] = useState(false);
  const pending = user?.role === "professor" && rooms.some((r) => r.professor_id === user.id && !r.archived_at && roomNeedsSetup(r));
  useEffect(() => {
    if (!pending) return;
    try { if (sessionStorage.getItem(SEEN)) return; sessionStorage.setItem(SEEN, "1"); } catch { /* stockage indisponible */ }
    setOpen(true);
  }, [pending]);
  if (!pending && !open) return null;
  return <ClassSetupDialog open={open} onOpenChange={setOpen} />;
}

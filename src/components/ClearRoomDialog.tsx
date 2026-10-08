import { useEffect, useRef, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, BellOff, BookOpen, Calendar, Eraser, FileText, Loader2, ListChecks, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { COURSE_BUCKET } from "@/lib/courseMedia";

type ClearKey = "notifications" | "students" | "courses" | "exercises" | "exams" | "quizzes";

interface ClearRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: { id: string; name: string } | null;
  onDone?: () => void | Promise<void>;
}

/* ---------- helpers ---------- */

const chunk = <T,>(arr: T[], size = 100): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const deleteIn = async (table: string, column: string, ids: string[]) => {
  for (const part of chunk(ids)) {
    const { error } = await (supabase.from(table as any) as any).delete().in(column, part);
    if (error) throw error;
  }
};

const selectIds = async (table: string, column: string, ids: string[], idColumn = "id"): Promise<string[]> => {
  const out: string[] = [];
  for (const part of chunk(ids)) {
    const { data } = await (supabase.from(table as any) as any).select(idColumn).in(column, part);
    (data || []).forEach((r: any) => out.push(r[idColumn]));
  }
  return out;
};

/** Exams / quizzes with their questions, options, submissions and answers. */
const deleteExamsCascade = async (examIds: string[]) => {
  if (examIds.length === 0) return;
  const subIds = await selectIds("quiz_submissions", "exam_id", examIds);
  if (subIds.length) {
    await deleteIn("quiz_answers", "submission_id", subIds).catch(e => console.warn("quiz_answers", e));
    await deleteIn("quiz_submissions", "id", subIds).catch(e => console.warn("quiz_submissions", e));
  }
  const qIds = await selectIds("quiz_questions", "exam_id", examIds);
  if (qIds.length) {
    await deleteIn("quiz_options", "question_id", qIds).catch(e => console.warn("quiz_options", e));
    await deleteIn("quiz_questions", "id", qIds).catch(e => console.warn("quiz_questions", e));
  }
  await deleteIn("exams", "id", examIds);
};

/** Removes every uploaded file of a course folder (courses/<id>/...) from storage. */
const removeCourseFolder = async (courseId: string) => {
  try {
    const folder = `courses/${courseId}`;
    const { data } = await supabase.storage.from(COURSE_BUCKET).list(folder, { limit: 1000 });
    const paths = (data || []).filter(f => f && f.name).map(f => `${folder}/${f.name}`);
    for (const part of chunk(paths, 100)) {
      await supabase.storage.from(COURSE_BUCKET).remove(part);
    }
  } catch (e) {
    console.warn("Storage cleanup failed for course", courseId, e);
  }
};

/* ---------- component ---------- */

const ClearRoomDialog = ({ open, onOpenChange, room, onDone }: ClearRoomDialogProps) => {
  const { language } = useLanguage();
  const { clearRoomStudentsNotifications } = useNotifications();
  const tr = (ar: string, fr: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en);

  const [selected, setSelected] = useState<Record<ClearKey, boolean>>({
    notifications: false, students: false, courses: false, exercises: false, exams: false, quizzes: false,
  });
  const [counts, setCounts] = useState<Record<ClearKey, number | null>>({
    notifications: null, students: null, courses: null, exercises: null, exams: null, quizzes: null,
  });
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState("");
  const lockRef = useRef(false);

  // Reset + load counts when opened
  useEffect(() => {
    if (!open || !room) return;
    setSelected({ notifications: false, students: false, courses: false, exercises: false, exams: false, quizzes: false });
    setConfirming(false);
    setStep("");
    let cancelled = false;
    (async () => {
      try {
        const { data: courses } = await supabase.from("courses").select("id").eq("room_id", room.id);
        const courseIds = (courses || []).map(c => c.id);
        const { data: profs } = await supabase.from("profiles").select("id").eq("room_id", room.id).eq("role", "student");
        const { data: enr } = await supabase.from("enrollments").select("student_id").eq("room_id", room.id);
        const studentSet = new Set<string>();
        (profs || []).forEach(p => studentSet.add(p.id));
        (enr || []).forEach((e: any) => e.student_id && studentSet.add(e.student_id));
        let exercises = 0, exams = 0, quizzes = 0;
        if (courseIds.length) {
          const { count: ex } = await supabase.from("exercises").select("*", { count: "exact", head: true }).in("course_id", courseIds);
          const { count: exm } = await supabase.from("exams").select("*", { count: "exact", head: true }).in("course_id", courseIds).eq("type", "exam");
          const { count: qz } = await supabase.from("exams").select("*", { count: "exact", head: true }).in("course_id", courseIds).eq("type", "quiz");
          exercises = ex || 0; exams = exm || 0; quizzes = qz || 0;
        }
        if (!cancelled) {
          setCounts({ notifications: null, students: studentSet.size, courses: courseIds.length, exercises, exams, quizzes });
        }
      } catch (e) {
        console.error("Count loading failed", e);
      }
    })();
    return () => { cancelled = true; };
  }, [open, room]);

  const coursesChecked = selected.courses;
  const isChecked = (k: ClearKey) => selected[k] || (coursesChecked && (k === "exercises" || k === "exams" || k === "quizzes"));
  const anySelected = (Object.keys(selected) as ClearKey[]).some(k => selected[k]);
  const allSelected = (Object.keys(selected) as ClearKey[]).every(k => isChecked(k));

  const toggle = (k: ClearKey, v: boolean) => {
    setConfirming(false);
    setSelected(prev => ({ ...prev, [k]: v }));
  };
  const toggleAll = (v: boolean) => {
    setConfirming(false);
    setSelected({ notifications: v, students: v, courses: v, exercises: v, exams: v, quizzes: v });
  };

  const options: { key: ClearKey; icon: ReactNode; label: string; hint: string; tone: string }[] = [
    {
      key: "notifications", icon: <BellOff className="h-4 w-4" />, tone: "text-amber-600 bg-amber-500/10",
      label: tr("إفراغ الإشعارات", "Vider les notifications", "Clear notifications"),
      hint: tr("تفريغ شريط إشعارات تلاميذ القسم", "Remet à zéro les notifications des élèves de la classe", "Reset students' notification feeds"),
    },
    {
      key: "students", icon: <Users className="h-4 w-4" />, tone: "text-emerald-600 bg-emerald-500/10",
      label: tr("حذف جميع التلاميذ", "Supprimer tous les élèves", "Delete all students"),
      hint: tr("حذف حسابات التلاميذ ونتائجهم ونشاطهم", "Supprime les comptes des élèves, leurs résultats et leur activité", "Deletes student accounts, results and activity"),
    },
    {
      key: "courses", icon: <BookOpen className="h-4 w-4" />, tone: "text-blue-600 bg-blue-500/10",
      label: tr("حذف جميع الدروس", "Vider les cours", "Delete all courses"),
      hint: tr("مع موادها (PDF، صور، فيديوهات) — يشمل التمارين والامتحانات والاختبارات", "Avec leurs supports (PDF, images, vidéos) — inclut exercices, examens et quiz", "With their materials — includes exercises, exams and quizzes"),
    },
    {
      key: "exercises", icon: <FileText className="h-4 w-4" />, tone: "text-orange-600 bg-orange-500/10",
      label: tr("حذف التمارين", "Vider les exercices", "Delete exercises"),
      hint: tr("جميع تمارين دروس هذا القسم", "Tous les exercices des cours de cette classe", "All exercises of this class's courses"),
    },
    {
      key: "exams", icon: <Calendar className="h-4 w-4" />, tone: "text-purple-600 bg-purple-500/10",
      label: tr("حذف الامتحانات", "Vider les examens", "Delete exams"),
      hint: tr("الامتحانات (غير الاختبارات)", "Les examens (hors quiz)", "Exams (not quizzes)"),
    },
    {
      key: "quizzes", icon: <ListChecks className="h-4 w-4" />, tone: "text-rose-600 bg-rose-500/10",
      label: tr("حذف الاختبارات", "Vider les quiz", "Delete quizzes"),
      hint: tr("الاختبارات مع الأسئلة والإجابات والنتائج", "Les quiz avec questions, réponses et résultats", "Quizzes with questions, answers and results"),
    },
  ];

  const run = async () => {
    if (!room || lockRef.current) return;
    lockRef.current = true;
    setRunning(true);
    const errors: string[] = [];
    const want = (k: ClearKey) => isChecked(k);

    try {
      const { data: courses } = await supabase.from("courses").select("id").eq("room_id", room.id);
      const courseIds = (courses || []).map(c => c.id);

      // 1. Notifications first (needs the students and a course to exist)
      if (want("notifications")) {
        setStep(tr("إفراغ الإشعارات…", "Vidage des notifications…", "Clearing notifications…"));
        try { await clearRoomStudentsNotifications(room.id); } catch (e: any) { errors.push("notifications"); }
      }

      // 2. Quizzes / exams / exercises
      if (courseIds.length && (want("exams") || want("quizzes"))) {
        const types: string[] = [];
        if (want("exams")) types.push("exam");
        if (want("quizzes")) types.push("quiz");
        setStep(tr("حذف الامتحانات والاختبارات…", "Suppression des examens et quiz…", "Deleting exams and quizzes…"));
        try {
          const ids: string[] = [];
          for (const part of chunk(courseIds)) {
            const { data } = await supabase.from("exams").select("id").in("course_id", part).in("type", types as any);
            (data || []).forEach(e => ids.push(e.id));
          }
          await deleteExamsCascade(ids);
        } catch (e) { console.error(e); errors.push(tr("الامتحانات", "examens/quiz", "exams/quizzes")); }
      }
      if (courseIds.length && want("exercises")) {
        setStep(tr("حذف التمارين…", "Suppression des exercices…", "Deleting exercises…"));
        try { await deleteIn("exercises", "course_id", courseIds); }
        catch (e) { console.error(e); errors.push(tr("التمارين", "exercices", "exercises")); }
      }

      // 3. Courses (+ materials, enrollments, notifications linked to them, storage files)
      if (courseIds.length && want("courses")) {
        setStep(tr("حذف الدروس ومرفقاتها…", "Suppression des cours et de leurs supports…", "Deleting courses and materials…"));
        try {
          await deleteIn("course_materials", "course_id", courseIds).catch(e => console.warn(e));
          await deleteIn("enrollments", "course_id", courseIds).catch(e => console.warn(e));
          await deleteIn("notifications", "course_id", courseIds).catch(e => console.warn(e));
          await deleteIn("courses", "id", courseIds);
          for (const id of courseIds) await removeCourseFolder(id);
        } catch (e) { console.error(e); errors.push(tr("الدروس", "cours", "courses")); }
      }

      // 4. Students (accounts of this class) + remaining enrollments of the class
      if (want("students")) {
        const { data: profs } = await supabase.from("profiles").select("id").eq("room_id", room.id).eq("role", "student");
        const ids = (profs || []).map(p => p.id);
        let failed = 0;
        for (let i = 0; i < ids.length; i++) {
          setStep(tr(`حذف التلاميذ ${i + 1}/${ids.length}…`, `Suppression des élèves ${i + 1}/${ids.length}…`, `Deleting students ${i + 1}/${ids.length}…`));
          try {
            const { data, error } = await supabase.functions.invoke("delete-student", { body: { studentId: ids[i], roomId: room.id } });
            if (error || !data?.success) failed++;
          } catch { failed++; }
        }
        await supabase.from("enrollments").delete().eq("room_id", room.id);
        if (failed > 0) errors.push(tr(`${failed} تلميذ`, `${failed} élève(s)`, `${failed} student(s)`));
      }

      await onDone?.();
      if (errors.length) {
        toast.error(tr("تم الإفراغ مع بعض الأخطاء: ", "Vidage terminé avec des erreurs : ", "Done with errors: ") + errors.join(", "));
      } else {
        toast.success(tr(`تم إفراغ القسم "${room.name}"`, `La classe « ${room.name} » a été vidée`, `Class "${room.name}" cleared`));
      }
      onOpenChange(false);
    } catch (e: any) {
      console.error("Clear room failed", e);
      toast.error(tr("فشل الإفراغ", "Échec du vidage", "Clear failed") + (e?.message ? ` : ${e.message}` : ""));
    } finally {
      lockRef.current = false;
      setRunning(false);
      setStep("");
      setConfirming(false);
    }
  };

  const selectedLabels = options.filter(o => isChecked(o.key)).map(o => o.label);

  return (
    <Dialog open={open} onOpenChange={o => { if (!running) onOpenChange(o); }}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eraser className="h-5 w-5 text-amber-600" />
            {tr("إفراغ القسم", "Vider la classe", "Clear class")}
            {room && <span className="truncate text-muted-foreground font-normal">— {room.name}</span>}
          </DialogTitle>
          <DialogDescription>
            {tr("اختر ما تريد حذفه. يبقى القسم نفسه موجوداً.", "Cochez ce que vous voulez vider. La classe elle-même est conservée.", "Choose what to clear. The class itself is kept.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="flex items-center gap-3 rounded-lg border border-dashed px-3 py-2 cursor-pointer hover:bg-muted/50">
            <Checkbox checked={allSelected} onCheckedChange={v => toggleAll(v === true)} disabled={running} />
            <span className="text-sm font-semibold">{tr("تحديد الكل", "Tout sélectionner", "Select all")}</span>
          </label>
          {options.map(o => {
            const forced = coursesChecked && (o.key === "exercises" || o.key === "exams" || o.key === "quizzes");
            const count = counts[o.key];
            return (
              <label
                key={o.key}
                className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${isChecked(o.key) ? "border-destructive/40 bg-destructive/5" : "hover:bg-muted/50"} ${forced || running ? "opacity-80" : "cursor-pointer"}`}
              >
                <Checkbox
                  className="mt-0.5"
                  checked={isChecked(o.key)}
                  disabled={forced || running}
                  onCheckedChange={v => toggle(o.key, v === true)}
                />
                <span className={`rounded-md p-1.5 ${o.tone}`}>{o.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {o.label}
                    {count !== null && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{count}</span>}
                  </span>
                  <span className="block text-xs text-muted-foreground">{forced ? tr("مشمول مع الدروس", "Inclus avec les cours", "Included with courses") : o.hint}</span>
                </span>
              </label>
            );
          })}
        </div>

        {confirming && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <p className="flex items-center gap-2 font-semibold text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {tr("هذا الإجراء نهائي ولا يمكن التراجع عنه", "Action définitive, impossible à annuler", "This cannot be undone")}
            </p>
            <p className="mt-1 text-muted-foreground">{selectedLabels.join(" · ")}</p>
          </div>
        )}

        {running && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />{step}
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => (confirming ? setConfirming(false) : onOpenChange(false))} disabled={running}>
            {confirming ? tr("رجوع", "Retour", "Back") : tr("إلغاء", "Annuler", "Cancel")}
          </Button>
          {!confirming ? (
            <Button variant="destructive" onClick={() => setConfirming(true)} disabled={!anySelected || running}>
              <Eraser className="mr-2 h-4 w-4" />
              {tr("إفراغ المحدد", "Vider la sélection", "Clear selection")}
            </Button>
          ) : (
            <Button variant="destructive" onClick={run} disabled={running}>
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
              {tr("تأكيد الإفراغ", "Confirmer le vidage", "Confirm")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClearRoomDialog;

/**
 * Copies rendues pour un exercice, côté professeur : qui a rendu (ou pas), fichiers
 * de chaque élève, note, commentaire et copie corrigée, puis « Rendre la copie ».
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Clock, Loader2, Paperclip, RotateCcw, Send, Trash2, UserX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { accessStore } from "@/contexts/AccessContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Exercise } from "@/contexts/CourseContext";
import { formatDateTime } from "@/lib/formatDate";
import {
  MAX_SUBMISSION_FILES,
  SUBMISSION_ACCEPT,
  fetchSubmissions,
  formatGrade,
  isMissingTableError,
  notifySubmissionsChanged,
  removeSubmissionFiles,
  signedUrls,
  uploadSubmissionFiles,
  type ExerciseSubmission,
  type SubmissionFile,
} from "@/lib/exerciseSubmissions";
import { SubmissionFileList } from "@/components/ExerciseSubmissionPanel";

type Tr = (fr: string, ar: string, en: string) => string;

interface Student {
  id: string;
  name: string;
  username?: string | null;
}

/** Élèves concernés par un cours : ceux de la classe du cours + les inscrits au cours */
async function loadCourseStudents(courseId: string): Promise<Student[]> {
  const { data: course } = await supabase.from("courses").select("room_id").eq("id", courseId).maybeSingle();
  const map = new Map<string, Student>();
  const roomId = (course as any)?.room_id as string | null;
  const [{ data: byRoom }, { data: enr }] = await Promise.all([
    roomId
      ? supabase.from("profiles").select("id, name, username").eq("role", "student").eq("room_id", roomId)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from("enrollments").select("student_id").eq("course_id", courseId),
  ]);
  (byRoom || []).forEach((p: any) => map.set(p.id, p));
  const missing = (enr || []).map((e: any) => e.student_id).filter((id: string) => !map.has(id));
  if (missing.length) {
    const { data: extra } = await supabase.from("profiles").select("id, name, username, role").in("id", missing);
    (extra || []).filter((p: any) => p.role === "student").forEach((p: any) => map.set(p.id, p));
  }
  return [...map.values()];
}

function ReviewForm({
  sub, urls, tr, language, onSaved,
}: {
  sub: ExerciseSubmission;
  urls: Record<string, string>;
  tr: Tr;
  language: string;
  onSaved: () => void;
}) {
  const [grade, setGrade] = useState(sub.grade !== null ? String(sub.grade).replace(".", language === "en" ? "." : ",") : "");
  const [maxGrade, setMaxGrade] = useState(String(sub.max_grade || 20));
  const [feedback, setFeedback] = useState(sub.feedback || "");
  const [kept, setKept] = useState<SubmissionFile[]>(sub.correction_files);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState<"return" | "reopen" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async (returnIt: boolean) => {
    if (saving) return;
    if (!accessStore.guard("exercise.review")) return;
    const max = parseFloat(maxGrade.replace(",", "."));
    const g = grade.trim() ? parseFloat(grade.replace(",", ".")) : null;
    if (!Number.isFinite(max) || max <= 0 || max > 100) {
      toast.error(tr("Barème invalide (entre 1 et 100).", "سلم التنقيط غير صالح (بين 1 و 100).", "Invalid scale (1 to 100)."));
      return;
    }
    if (g !== null && (!Number.isFinite(g) || g < 0 || g > max)) {
      toast.error(tr(`La note doit être entre 0 et ${max}.`, `يجب أن تكون النقطة بين 0 و ${max}.`, `The grade must be between 0 and ${max}.`));
      return;
    }
    setSaving(returnIt ? "return" : "reopen");
    let uploaded: SubmissionFile[] = [];
    try {
      uploaded = await uploadSubmissionFiles(sub.exercise_id, sub.student_id, newFiles, { correction: true });
      const { error } = await (supabase as any).rpc("review_exercise_submission", {
        p_submission_id: sub.id,
        p_grade: g,
        p_max_grade: max,
        p_feedback: feedback.trim() || null,
        p_correction_files: [...kept, ...uploaded],
        p_return: returnIt,
      });
      if (error) throw error;
      const keptPaths = new Set(kept.map((f) => f.path));
      await removeSubmissionFiles(sub.correction_files.filter((f) => !keptPaths.has(f.path)).map((f) => f.path));
      toast.success(
        returnIt
          ? tr("Copie rendue à l'élève.", "تم إرجاع الورقة إلى التلميذ.", "Work returned to the student.")
          : tr("Copie rouverte : l'élève peut renvoyer une nouvelle version.", "تمت إعادة فتح الورقة: يمكن للتلميذ إرسال نسخة جديدة.", "Reopened: the student can send a new version.")
      );
      notifySubmissionsChanged();
      onSaved();
    } catch (e: any) {
      console.error("review_exercise_submission error:", e);
      await removeSubmissionFiles(uploaded.map((f) => f.path));
      toast.error(tr("Impossible d'enregistrer la correction.", "تعذر حفظ التصحيح.", "Unable to save the correction."));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-3 border-t bg-muted/20 px-3 py-3 sm:px-4">
      <SubmissionFileList files={sub.files} urls={urls} tr={tr} />
      {sub.student_note && (
        <p className="whitespace-pre-wrap rounded-lg bg-background p-2.5 text-sm">
          <span className="font-semibold">{tr("Mot de l'élève : ", "كلمة التلميذ: ", "Student's note: ")}</span>
          {sub.student_note}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs font-medium">
          {tr("Note", "النقطة", "Grade")}
          <span className="flex items-center gap-1" dir="ltr">
            <Input value={grade} onChange={(e) => setGrade(e.target.value)} inputMode="decimal" className="h-9 w-20 text-center" placeholder="—" />
            <span className="text-muted-foreground">/</span>
            <Input value={maxGrade} onChange={(e) => setMaxGrade(e.target.value)} inputMode="decimal" className="h-9 w-16 text-center" aria-label={tr("Barème", "سلم التنقيط", "Scale")} />
          </span>
        </label>
      </div>
      <Textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        rows={3}
        maxLength={4000}
        placeholder={tr("Commentaire pour l'élève (facultatif)", "ملاحظة للتلميذ (اختياري)", "Comment for the student (optional)")}
      />
      <div className="space-y-2">
        <p className="text-xs font-medium">{tr("Copie corrigée (facultatif)", "الورقة المصححة (اختياري)", "Corrected work (optional)")}</p>
        <SubmissionFileList files={kept} urls={urls} tr={tr} onRemove={(f) => setKept((k) => k.filter((x) => x.path !== f.path))} />
        {newFiles.length > 0 && (
          <ul className="space-y-1 text-xs">
            {newFiles.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2">
                <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate">{f.name}</span>
                <button type="button" className="text-destructive" onClick={() => setNewFiles((p) => p.filter((_, j) => j !== i))} aria-label={tr("Retirer", "إزالة", "Remove")}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          ref={fileRef}
          type="file"
          accept={SUBMISSION_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files || []);
            setNewFiles((p) => [...p, ...picked].slice(0, Math.max(0, MAX_SUBMISSION_FILES - kept.length)));
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
          <Paperclip className="h-3.5 w-3.5" />
          {tr("Joindre la copie annotée", "إرفاق الورقة المصححة", "Attach the annotated work")}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" className="gap-2" onClick={() => save(true)} disabled={!!saving}>
          {saving === "return" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {sub.status === "returned" ? tr("Mettre à jour la correction", "تحديث التصحيح", "Update the correction") : tr("Rendre la copie", "إرجاع الورقة", "Return the work")}
        </Button>
        <Button type="button" variant="ghost" className="gap-2" onClick={() => save(false)} disabled={!!saving}
          title={tr("L'élève pourra envoyer une nouvelle version", "سيتمكن التلميذ من إرسال نسخة جديدة", "The student will be able to send a new version")}>
          {saving === "reopen" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          {sub.status === "returned" ? tr("Rouvrir pour l'élève", "إعادة الفتح للتلميذ", "Reopen for the student") : tr("Enregistrer sans rendre", "حفظ دون إرجاع", "Save without returning")}
        </Button>
      </div>
    </div>
  );
}

const ExerciseSubmissionsDialog = ({
  open, onOpenChange, exercise, subtitle,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  exercise: Exercise | null;
  /** « Classe · Cours » */
  subtitle?: string;
}) => {
  const { language } = useLanguage();
  const tr: Tr = useCallback((fr, ar, en) => (language === "ar" ? ar : language === "fr" ? fr : en), [language]);
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [subs, setSubs] = useState<ExerciseSubmission[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!exercise) return;
    setLoading(true);
    try {
      const [st, rows] = await Promise.all([loadCourseStudents(exercise.course_id), fetchSubmissions([exercise.id])]);
      // Élèves qui ont rendu sans être (plus) dans la classe
      const unknown = rows.map((r) => r.student_id).filter((id) => !st.some((s) => s.id === id));
      if (unknown.length) {
        const { data } = await supabase.from("profiles").select("id, name, username").in("id", unknown);
        st.push(...((data || []) as Student[]));
      }
      setStudents(st.sort((a, b) => (a.name || "").localeCompare(b.name || "")));
      setSubs(rows);
      setAvailable(true);
      setUrls(await signedUrls(rows.flatMap((r) => [...r.files, ...r.correction_files].map((f) => f.path))));
    } catch (e) {
      if (isMissingTableError(e)) setAvailable(false);
      else {
        console.error("submissions dialog load error:", e);
        toast.error(tr("Impossible de charger les copies.", "تعذر تحميل الأوراق.", "Unable to load submissions."));
      }
    } finally {
      setLoading(false);
    }
  }, [exercise, tr]);

  useEffect(() => {
    if (open) {
      setOpenId(null);
      void load();
    }
  }, [open, load]);

  const rows = useMemo(() => {
    const bySt = new Map(subs.map((s) => [s.student_id, s] as [string, ExerciseSubmission]));
    const order = (s?: ExerciseSubmission) => (!s ? 2 : s.status === "submitted" ? 0 : 1);
    return students
      .map((st) => ({ student: st, sub: bySt.get(st.id) }))
      .sort((a, b) => order(a.sub) - order(b.sub) || (a.student.name || "").localeCompare(b.student.name || ""));
  }, [students, subs]);

  const handed = subs.length;
  const returned = subs.filter((s) => s.status === "returned").length;
  const toGrade = handed - returned;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[96vw] max-w-3xl flex-col overflow-hidden p-0">
        <div className="shrink-0 border-b px-5 pb-4 pt-5 sm:px-6">
          <DialogHeader className="space-y-1 text-start pe-8">
            {subtitle && <p className="text-xs font-semibold uppercase tracking-wider text-primary">{subtitle}</p>}
            <DialogTitle className="text-xl">{tr("Copies rendues", "الأوراق المرسلة", "Submissions")} · {exercise?.title}</DialogTitle>
            <DialogDescription>
              {exercise?.due_date && `${tr("Date limite :", "آخر أجل:", "Due:")} ${formatDateTime(exercise.due_date, language as any)}`}
            </DialogDescription>
          </DialogHeader>
          {available && !loading && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">{tr(`${handed}/${students.length} rendues`, `${handed}/${students.length} مرسلة`, `${handed}/${students.length} handed in`)}</span>
              {toGrade > 0 && <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-700 dark:text-amber-300">{tr(`${toGrade} à corriger`, `${toGrade} للتصحيح`, `${toGrade} to grade`)}</span>}
              {returned > 0 && <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-700 dark:text-emerald-300">{tr(`${returned} corrigées`, `${returned} مصححة`, `${returned} graded`)}</span>}
            </div>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-5" style={{ WebkitOverflowScrolling: "touch" } as any}>
          {!available ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {tr("La remise des copies sera disponible après la mise à jour de la base de données.", "سيتوفر إرسال الأوراق بعد تحديث قاعدة البيانات.", "Submissions will be available after the database update.")}
            </p>
          ) : loading ? (
            <div className="flex items-center justify-center py-14"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{tr("Aucun élève dans cette classe.", "لا يوجد تلاميذ في هذا القسم.", "No students in this class.")}</p>
          ) : (
            <ul className="space-y-2">
              {rows.map(({ student, sub }) => {
                const isOpen = !!sub && openId === sub.id;
                return (
                  <li key={student.id} className="overflow-hidden rounded-xl border bg-card">
                    <button
                      type="button"
                      disabled={!sub}
                      onClick={() => sub && setOpenId(isOpen ? null : sub.id)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-start hover:bg-muted/40 disabled:cursor-default disabled:hover:bg-transparent sm:px-4"
                      aria-expanded={isOpen}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{student.name}</span>
                        {sub && (
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(sub.submitted_at, language as any)}
                            {sub.is_late && <span className="font-semibold text-amber-700 dark:text-amber-300">{tr("en retard", "متأخرة", "late")}</span>}
                            <span>· {sub.files.length} {tr("fichier(s)", "ملف", "file(s)")}</span>
                          </span>
                        )}
                      </span>
                      {!sub ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                          <UserX className="h-3.5 w-3.5" />
                          {tr("Non rendu", "لم يرسل", "Not handed in")}
                        </span>
                      ) : sub.status === "returned" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300" dir="ltr">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {sub.grade !== null ? `${formatGrade(sub.grade, language)}/${formatGrade(sub.max_grade, language)}` : tr("Corrigée", "مصححة", "Graded")}
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">{tr("À corriger", "للتصحيح", "To grade")}</span>
                      )}
                      {sub && <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />}
                    </button>
                    {isOpen && sub && (
                      <ReviewForm key={sub.id + sub.status} sub={sub} urls={urls} tr={tr} language={language} onSaved={() => void load()} />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExerciseSubmissionsDialog;

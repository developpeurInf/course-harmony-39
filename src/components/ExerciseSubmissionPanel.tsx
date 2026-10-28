/**
 * Remise d'un exercice, côté élève (dans la fenêtre de l'exercice) :
 * photos ou PDF de sa copie, puis note, commentaire et copie corrigée une fois rendue.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, CheckCircle2, Clock, FileText, Loader2, MessageSquare, Paperclip, Pencil, Send, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Exercise } from "@/contexts/CourseContext";
import { formatDateTime } from "@/lib/formatDate";
import {
  MAX_SUBMISSION_FILES,
  SUBMISSION_ACCEPT,
  fetchSubmissions,
  formatGrade,
  isImageFile,
  isMissingTableError,
  notifySubmissionsChanged,
  removeSubmissionFiles,
  signedUrls,
  uploadSubmissionFiles,
  type ExerciseSubmission,
  type SubmissionFile,
} from "@/lib/exerciseSubmissions";

type Tr = (fr: string, ar: string, en: string) => string;

/** Vignettes (images) et liens (PDF) des fichiers d'une remise */
export function SubmissionFileList({
  files, urls, onRemove, tr,
}: {
  files: SubmissionFile[];
  urls: Record<string, string>;
  onRemove?: (f: SubmissionFile) => void;
  tr: Tr;
}) {
  if (!files.length) return null;
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {files.map((f) => {
        const url = urls[f.path];
        return (
          <li key={f.path} className="relative overflow-hidden rounded-lg border bg-background">
            <a
              href={url || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className={`block ${url ? "" : "pointer-events-none opacity-60"}`}
              title={f.name}
            >
              {isImageFile(f) && url ? (
                <img src={url} alt={f.name} loading="lazy" className="h-28 w-full object-cover" />
              ) : (
                <span className="flex h-28 w-full flex-col items-center justify-center gap-1 bg-muted/40 text-muted-foreground">
                  <FileText className="h-7 w-7" />
                  <span className="text-[11px] font-medium">{/\.pdf$/i.test(f.path) ? "PDF" : tr("Fichier", "ملف", "File")}</span>
                </span>
              )}
              <span className="block truncate px-2 py-1 text-[11px]">{f.name}</span>
            </a>
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(f)}
                className="absolute end-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-destructive shadow hover:bg-background"
                aria-label={tr("Retirer", "إزالة", "Remove")}
                title={tr("Retirer", "إزالة", "Remove")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Fichiers choisis mais pas encore envoyés */
function PendingFiles({ files, onRemove, tr }: { files: File[]; onRemove: (i: number) => void; tr: Tr }) {
  const previews = useMemo(() => files.map((f) => (/^image\//.test(f.type) ? URL.createObjectURL(f) : null)), [files]);
  useEffect(() => () => previews.forEach((u) => u && URL.revokeObjectURL(u)), [previews]);
  if (!files.length) return null;
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {files.map((f, i) => (
        <li key={`${f.name}-${i}`} className="relative overflow-hidden rounded-lg border border-dashed border-primary/50 bg-background">
          {previews[i] ? (
            <img src={previews[i] as string} alt={f.name} className="h-28 w-full object-cover" />
          ) : (
            <span className="flex h-28 w-full items-center justify-center bg-muted/40 text-muted-foreground">
              <FileText className="h-7 w-7" />
            </span>
          )}
          <span className="block truncate px-2 py-1 text-[11px]">{f.name}</span>
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="absolute end-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-destructive shadow hover:bg-background"
            aria-label={tr("Retirer", "إزالة", "Remove")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}

const ExerciseSubmissionPanel = ({ exercise }: { exercise: Exercise }) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const tr: Tr = (fr, ar, en) => (language === "ar" ? ar : language === "fr" ? fr : en);

  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [submission, setSubmission] = useState<ExerciseSubmission | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [kept, setKept] = useState<SubmissionFile[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const rows = await fetchSubmissions([exercise.id]);
      const mine = rows.find((r) => r.student_id === user.id) || null;
      setSubmission(mine);
      setAvailable(true);
      if (mine) {
        setUrls(await signedUrls([...mine.files, ...mine.correction_files].map((f) => f.path)));
      }
      setEditing(!mine);
      setKept(mine?.files || []);
      setNote(mine?.student_note || "");
      setNewFiles([]);
    } catch (e) {
      if (isMissingTableError(e)) setAvailable(false);
      else console.error("submission load error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id, user?.id]);

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const picked = Array.from(list).filter((f) => /^image\/|application\/pdf/.test(f.type) || /\.(pdf|jpe?g|png|webp|heic|heif)$/i.test(f.name));
    if (picked.length < list.length) {
      toast.error(tr("Seules les photos et les PDF sont acceptés.", "تقبل الصور وملفات PDF فقط.", "Only photos and PDFs are accepted."));
    }
    setNewFiles((prev) => {
      const room = MAX_SUBMISSION_FILES - kept.length - prev.length;
      if (picked.length > room) {
        toast.error(tr(`${MAX_SUBMISSION_FILES} fichiers au maximum.`, `${MAX_SUBMISSION_FILES} ملفاً على الأكثر.`, `${MAX_SUBMISSION_FILES} files at most.`));
      }
      return [...prev, ...picked.slice(0, Math.max(0, room))];
    });
  };

  const send = async () => {
    if (!user || sending) return;
    if (kept.length + newFiles.length === 0) {
      toast.error(tr("Ajoutez au moins une photo ou un PDF de votre copie.", "أضف صورة أو ملف PDF لورقتك على الأقل.", "Add at least one photo or PDF of your work."));
      return;
    }
    setSending(true);
    let uploaded: SubmissionFile[] = [];
    try {
      uploaded = await uploadSubmissionFiles(exercise.id, user.id, newFiles, {
        onProgress: (d, t) => setProgress(`${d}/${t}`),
      });
      const { data, error } = await (supabase as any).rpc("submit_exercise", {
        p_exercise_id: exercise.id,
        p_files: [...kept, ...uploaded],
        p_note: note.trim() || null,
      });
      if (error) throw error;
      // Fichiers retirés de la remise précédente
      const keptPaths = new Set(kept.map((f) => f.path));
      await removeSubmissionFiles((submission?.files || []).filter((f) => !keptPaths.has(f.path)).map((f) => f.path));
      toast.success(
        data?.is_late
          ? tr("Copie envoyée (après la date limite).", "تم إرسال الورقة (بعد الأجل).", "Work submitted (after the due date).")
          : tr("Copie envoyée à votre professeur.", "تم إرسال الورقة إلى أستاذك.", "Work sent to your teacher.")
      );
      notifySubmissionsChanged();
      await load();
    } catch (e: any) {
      console.error("submit_exercise error:", e);
      // Remise refusée : on retire les fichiers déjà envoyés
      await removeSubmissionFiles(uploaded.map((f) => f.path));
      const msg = String(e?.message || "");
      toast.error(
        /ALREADY_RETURNED/.test(msg)
          ? tr("Votre copie a déjà été corrigée.", "تم تصحيح ورقتك بالفعل.", "Your work has already been graded.")
          : /TOO_LARGE/.test(msg)
          ? tr("Un fichier dépasse 15 Mo.", "أحد الملفات يتجاوز 15 م.ب.", "A file is larger than 15 MB.")
          : tr("L'envoi a échoué. Vérifiez votre connexion et réessayez.", "فشل الإرسال. تحقق من الاتصال وأعد المحاولة.", "Upload failed. Check your connection and try again.")
      );
    } finally {
      setSending(false);
      setProgress("");
    }
  };

  if (!user || user.role !== "student" || !available) return null;

  return (
    <section className="mt-6 rounded-xl border-2 border-primary/20 bg-card p-4 sm:p-5" aria-label={tr("Ma copie", "ورقتي", "My work")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Upload className="h-4 w-4 text-primary" />
          {tr("Ma copie", "ورقتي", "My work")}
        </h3>
        {submission && (
          submission.status === "returned" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {tr("Corrigée", "مصححة", "Graded")}
            </span>
          ) : (
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${submission.is_late ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-primary/10 text-primary"}`}>
              <Clock className="h-3.5 w-3.5" />
              {tr("Rendue le", "أرسلت في", "Submitted")} {formatDateTime(submission.submitted_at, language)}
              {submission.is_late && ` · ${tr("en retard", "متأخرة", "late")}`}
            </span>
          )
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {tr("Chargement…", "جارٍ التحميل…", "Loading…")}
        </div>
      ) : submission?.status === "returned" ? (
        <div className="mt-3 space-y-3">
          {submission.grade !== null && (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold tabular-nums" dir="ltr">
                {formatGrade(submission.grade, language)}/{formatGrade(submission.max_grade, language)}
              </span>
              {submission.max_grade !== 20 && (
                <span className="text-sm text-muted-foreground" dir="ltr">
                  ({formatGrade(Math.round((submission.grade / submission.max_grade) * 200) / 10, language)}/20)
                </span>
              )}
            </div>
          )}
          {submission.feedback && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-primary">
                <MessageSquare className="h-3.5 w-3.5" />
                {tr("Commentaire du professeur", "ملاحظة الأستاذ", "Teacher's comment")}
              </span>
              <p className="whitespace-pre-wrap">{submission.feedback}</p>
            </div>
          )}
          {submission.correction_files.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{tr("Copie corrigée", "الورقة المصححة", "Corrected work")}</p>
              <SubmissionFileList files={submission.correction_files} urls={urls} tr={tr} />
            </div>
          )}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{tr("Ce que j'ai envoyé", "ما أرسلته", "What I sent")}</p>
            <SubmissionFileList files={submission.files} urls={urls} tr={tr} />
          </div>
        </div>
      ) : editing ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-muted-foreground">
            {tr(
              "Prenez votre copie en photo (une photo par page) ou joignez un PDF, puis envoyez-la.",
              "صوّر ورقتك (صورة لكل صفحة) أو أرفق ملف PDF، ثم أرسلها.",
              "Take a photo of your work (one per page) or attach a PDF, then send it."
            )}
          </p>
          <SubmissionFileList files={kept} urls={urls} tr={tr} onRemove={(f) => setKept((k) => k.filter((x) => x.path !== f.path))} />
          <PendingFiles files={newFiles} tr={tr} onRemove={(i) => setNewFiles((p) => p.filter((_, j) => j !== i))} />
          <div className="flex flex-wrap gap-2">
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            <input ref={fileRef} type="file" accept={SUBMISSION_ACCEPT} multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            <Button type="button" variant="outline" className="gap-2" onClick={() => cameraRef.current?.click()} disabled={sending}>
              <Camera className="h-4 w-4" />
              {tr("Prendre une photo", "التقاط صورة", "Take a photo")}
            </Button>
            <Button type="button" variant="outline" className="gap-2" onClick={() => fileRef.current?.click()} disabled={sending}>
              <Paperclip className="h-4 w-4" />
              {tr("Joindre des fichiers", "إرفاق ملفات", "Attach files")}
            </Button>
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={tr("Un mot pour le professeur (facultatif)", "كلمة للأستاذ (اختياري)", "A note for the teacher (optional)")}
            rows={2}
            maxLength={2000}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" className="gap-2" onClick={send} disabled={sending || kept.length + newFiles.length === 0}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending
                ? `${tr("Envoi…", "جارٍ الإرسال…", "Sending…")} ${progress}`
                : submission
                ? tr("Envoyer la nouvelle version", "إرسال النسخة الجديدة", "Send the new version")
                : tr("Rendre ma copie", "إرسال ورقتي", "Hand in my work")}
            </Button>
            {submission && !sending && (
              <Button type="button" variant="ghost" onClick={() => { setEditing(false); setKept(submission.files); setNewFiles([]); setNote(submission.student_note || ""); }}>
                {tr("Annuler", "إلغاء", "Cancel")}
              </Button>
            )}
          </div>
        </div>
      ) : submission ? (
        <div className="mt-3 space-y-3">
          <SubmissionFileList files={submission.files} urls={urls} tr={tr} />
          {submission.student_note && <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">{submission.student_note}</p>}
          <p className="text-xs text-muted-foreground">
            {tr("Votre professeur n'a pas encore corrigé cette copie. Vous pouvez encore la modifier.", "لم يصحح أستاذك هذه الورقة بعد. يمكنك تعديلها.", "Your teacher hasn't graded it yet. You can still change it.")}
          </p>
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            {tr("Modifier ma copie", "تعديل ورقتي", "Edit my work")}
          </Button>
        </div>
      ) : null}
    </section>
  );
};

export default ExerciseSubmissionPanel;

/**
 * Remise des exercices par les élèves (table exercise_submissions, bucket privé
 * « exercise-submissions ») : types, envoi des fichiers et liens de lecture.
 *
 * Chemins : <exercise_id>/<student_id>/<fichier>
 *           <exercise_id>/<student_id>/correction/<fichier>  (copie corrigée du professeur)
 * Les écritures passent par submit_exercise() et review_exercise_submission()
 * (migration 20261028120000_grading_submissions_copy.sql).
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const SUBMISSIONS_BUCKET = "exercise-submissions";
export const MAX_SUBMISSION_FILES = 15;
/** Taille max d'un fichier après compression (limite du bucket : 15 Mo) */
export const MAX_SUBMISSION_FILE_BYTES = 15 * 1024 * 1024;
export const SUBMISSION_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";

export interface SubmissionFile {
  path: string;
  name: string;
  size?: number | null;
  mime?: string | null;
}

export interface ExerciseSubmission {
  id: string;
  exercise_id: string;
  student_id: string;
  files: SubmissionFile[];
  student_note: string | null;
  submitted_at: string;
  is_late: boolean;
  status: "submitted" | "returned";
  grade: number | null;
  max_grade: number;
  feedback: string | null;
  correction_files: SubmissionFile[];
  returned_at: string | null;
}

const CHANGED_EVENT = "exercise-submissions-changed";
/** Prévient les listes ouvertes (badges « Rendu », compteurs) qu'une remise a changé */
export const notifySubmissionsChanged = () => {
  try {
    window.dispatchEvent(new Event(CHANGED_EVENT));
  } catch {
    /* navigateur sans Event constructeur : les listes se mettront à jour au prochain chargement */
  }
};

export const isMissingTableError = (e: any) =>
  /exercise_submissions|submit_exercise|review_exercise_submission|Could not find|does not exist|schema cache/i.test(String(e?.message || ""));

const normalizeRow = (r: any): ExerciseSubmission => ({
  ...r,
  files: Array.isArray(r?.files) ? r.files : [],
  correction_files: Array.isArray(r?.correction_files) ? r.correction_files : [],
  grade: r?.grade === null || r?.grade === undefined ? null : Number(r.grade),
  max_grade: Number(r?.max_grade) || 20,
});

/** Remises visibles par l'utilisateur (RLS : ses propres copies, ou celles de ses cours pour un professeur) */
export async function fetchSubmissions(exerciseIds: string[]): Promise<ExerciseSubmission[]> {
  const out: ExerciseSubmission[] = [];
  for (let i = 0; i < exerciseIds.length; i += 150) {
    const { data, error } = await (supabase as any)
      .from("exercise_submissions")
      .select("*")
      .in("exercise_id", exerciseIds.slice(i, i + 150));
    if (error) throw error;
    out.push(...(data || []).map(normalizeRow));
  }
  return out;
}

/**
 * Remises des exercices donnés, indexées par exercice, rechargées après chaque
 * remise ou correction. `available` = false tant que la migration n'est pas appliquée.
 */
export function useExerciseSubmissions(exerciseIds: string[]) {
  const key = [...exerciseIds].sort().join(",");
  const [byExercise, setByExercise] = useState<Map<string, ExerciseSubmission[]>>(new Map());
  const [available, setAvailable] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onChange = () => setTick((t) => t + 1);
    window.addEventListener(CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CHANGED_EVENT, onChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const ids = key ? key.split(",") : [];
    if (!ids.length) {
      setByExercise(new Map());
      return;
    }
    fetchSubmissions(ids)
      .then((rows) => {
        if (cancelled) return;
        const map = new Map<string, ExerciseSubmission[]>();
        rows.forEach((r) => map.set(r.exercise_id, [...(map.get(r.exercise_id) || []), r]));
        setByExercise(map);
        setAvailable(true);
      })
      .catch((e) => {
        if (cancelled) return;
        if (isMissingTableError(e)) setAvailable(false);
        else console.error("exercise_submissions load error:", e);
      });
    return () => {
      cancelled = true;
    };
  }, [key, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { byExercise, available, reload };
}

/** Nom de fichier sûr pour le stockage (les clés refusent certains caractères, dont l'arabe) */
const safeFileName = (name: string) => {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6) : "";
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "copie";
  return ext ? `${base}.${ext}` : base;
};

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    img.src = url;
  });

/**
 * Photo de copie : réduite à 2000 px et recompressée en JPEG (une photo de téléphone
 * passe de 4–6 Mo à ~500 Ko). En cas d'échec, le fichier d'origine est envoyé tel quel.
 */
export async function compressIfImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type) || file.size < 700 * 1024) return file;
  try {
    const img = await loadImage(file);
    const max = 2000;
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    try {
      return new File([blob], name, { type: "image/jpeg" });
    } catch {
      // Safari ancien : pas de constructeur File
      return Object.assign(blob, { name, lastModified: Date.now() }) as File;
    }
  } catch {
    return file;
  }
}

/** Envoie des fichiers dans <exercise_id>/<student_id>/[correction/] et renvoie leur description */
export async function uploadSubmissionFiles(
  exerciseId: string,
  studentId: string,
  files: File[],
  opts: { correction?: boolean; onProgress?: (done: number, total: number) => void } = {}
): Promise<SubmissionFile[]> {
  const out: SubmissionFile[] = [];
  const stamp = Date.now();
  for (let i = 0; i < files.length; i++) {
    const f = await compressIfImage(files[i]);
    if (f.size > MAX_SUBMISSION_FILE_BYTES) throw new Error(`TOO_LARGE:${files[i].name}`);
    const path = `${exerciseId}/${studentId}/${opts.correction ? "correction/" : ""}${stamp}_${i}_${safeFileName(f.name || files[i].name)}`;
    const { error } = await supabase.storage.from(SUBMISSIONS_BUCKET).upload(path, f, {
      contentType: f.type || files[i].type || undefined,
      upsert: false,
    });
    if (error) throw error;
    out.push({ path, name: files[i].name || f.name, size: f.size, mime: f.type || files[i].type || null });
    opts.onProgress?.(i + 1, files.length);
  }
  return out;
}

/** Suppression sans bloquer (fichiers retirés d'une remise) */
export async function removeSubmissionFiles(paths: string[]) {
  if (!paths.length) return;
  try {
    await supabase.storage.from(SUBMISSIONS_BUCKET).remove(paths);
  } catch (e) {
    console.warn("remove submission files:", e);
  }
}

/** Liens de lecture temporaires (1 h) indexés par chemin */
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!paths.length) return out;
  const { data, error } = await supabase.storage.from(SUBMISSIONS_BUCKET).createSignedUrls(paths, 3600);
  if (error) {
    console.warn("signed urls:", error);
    return out;
  }
  (data || []).forEach((d: any) => {
    if (d?.path && d?.signedUrl) out[d.path] = d.signedUrl;
  });
  return out;
}

export const isImageFile = (f: SubmissionFile) =>
  /^image\//i.test(f.mime || "") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.path);

/** Note sans zéros inutiles : 15 → « 15 », 15.5 → « 15,5 » en français */
export const formatGrade = (v: number, language: string) =>
  v.toLocaleString(language === "ar" ? "ar-MA" : language === "fr" ? "fr-FR" : "en-GB", { maximumFractionDigits: 2 });

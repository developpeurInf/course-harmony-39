import { supabase } from "@/integrations/supabase/client";

/**
 * Course materials helpers.
 *
 * A course material row (table `course_materials`) is either:
 *  - an uploaded file in the `course-materials` bucket (file_path = "courses/<id>/<name>")
 *  - an external video link (file_path = "https://..." — YouTube, Vimeo or a direct .mp4 URL)
 *
 * No schema change is needed: the kind is derived from the file name / path.
 */

export const COURSE_BUCKET = "course-materials";

export type MaterialKind = "pdf" | "image" | "video" | "youtube" | "vimeo" | "link" | "file";

export interface CourseMaterialLike {
  id: string;
  file_name: string;
  file_path: string;
  file_size?: number | null;
  uploaded_at?: string;
  course_id?: string;
}

const IMAGE_EXT = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"];
const VIDEO_EXT = ["mp4", "webm", "mov", "m4v", "ogv", "ogg"];

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
export const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v", "video/ogg"];
export const ACCEPT_ATTRIBUTE =
  ".pdf,application/pdf,.jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/png,image/gif,image/webp,.mp4,.webm,.mov,.m4v,video/mp4,video/webm,video/quicktime";

export const isExternalUrl = (path: string) => /^https?:\/\//i.test(path || "");

const extOf = (name: string) => {
  // Only URLs carry ?query / #fragment — a file name may legitimately contain "#" or "?"
  const raw = name || "";
  const clean = /^https?:\/\//i.test(raw) ? raw.split("?")[0].split("#")[0] : raw;
  const idx = clean.lastIndexOf(".");
  return idx >= 0 ? clean.slice(idx + 1).toLowerCase() : "";
};

export interface ParsedVideo {
  provider: "youtube" | "vimeo" | "direct";
  id?: string;
  embedUrl: string;
  thumbnail?: string;
}

export const parseVideoUrl = (raw: string): ParsedVideo | null => {
  const url = (raw || "").trim();
  if (!isExternalUrl(url)) return null;

  const yt =
    url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i);
  if (yt) {
    const id = yt[1];
    return {
      provider: "youtube",
      id,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`,
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    };
  }

  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d{6,12})/i);
  if (vm) {
    return {
      provider: "vimeo",
      id: vm[1],
      embedUrl: `https://player.vimeo.com/video/${vm[1]}?autoplay=1&playsinline=1`,
    };
  }

  if (VIDEO_EXT.includes(extOf(url))) {
    return { provider: "direct", embedUrl: url };
  }
  return null;
};

export const getFileKind = (name: string, mime?: string): MaterialKind => {
  const ext = extOf(name);
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if ((mime && mime.startsWith("image/")) || IMAGE_EXT.includes(ext)) return "image";
  if ((mime && mime.startsWith("video/")) || VIDEO_EXT.includes(ext)) return "video";
  return "file";
};

export const getMaterialKind = (m: CourseMaterialLike): MaterialKind => {
  if (isExternalUrl(m.file_path)) {
    const v = parseVideoUrl(m.file_path);
    if (!v) return "link";
    if (v.provider === "youtube") return "youtube";
    if (v.provider === "vimeo") return "vimeo";
    return "video";
  }
  // Prefer the storage path extension, fall back to the display name
  const k = getFileKind(m.file_path);
  return k !== "file" ? k : getFileKind(m.file_name);
};

export const isVideoKind = (k: MaterialKind) => k === "video" || k === "youtube" || k === "vimeo";

export const getMaterialUrl = (m: CourseMaterialLike): string => {
  if (isExternalUrl(m.file_path)) return m.file_path;
  const { data } = supabase.storage.from(COURSE_BUCKET).getPublicUrl(m.file_path);
  return data?.publicUrl || "";
};

export const getMaterialDownloadUrl = (m: CourseMaterialLike): string => {
  if (isExternalUrl(m.file_path)) return m.file_path;
  const { data } = supabase.storage.from(COURSE_BUCKET).getPublicUrl(m.file_path, { download: m.file_name });
  return data?.publicUrl || "";
};

export const getMaterialThumbnail = (m: CourseMaterialLike): string | null => {
  const kind = getMaterialKind(m);
  if (kind === "image") return getMaterialUrl(m);
  if (kind === "youtube") return parseVideoUrl(m.file_path)?.thumbnail || null;
  return null;
};

export const formatFileSize = (bytes?: number | null): string => {
  if (!bytes) return "";
  const k = 1024;
  const sizes = ["o", "Ko", "Mo", "Go"];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/** Sort: videos, images, documents, others — keeps upload order inside each group. */
const KIND_ORDER: Record<MaterialKind, number> = { youtube: 0, vimeo: 0, video: 0, image: 1, pdf: 2, file: 3, link: 4 };
export const sortMaterials = <T extends CourseMaterialLike>(items: T[]): T[] =>
  [...items]
    .map((m, i) => ({ m, i }))
    .sort((a, b) => KIND_ORDER[getMaterialKind(a.m)] - KIND_ORDER[getMaterialKind(b.m)] || a.i - b.i)
    .map(x => x.m);

export const countByKind = (items: CourseMaterialLike[]) => {
  const c = { video: 0, image: 0, pdf: 0, other: 0 };
  items.forEach(m => {
    const k = getMaterialKind(m);
    if (isVideoKind(k)) c.video++;
    else if (k === "image") c.image++;
    else if (k === "pdf") c.pdf++;
    else c.other++;
  });
  return c;
};

/* ------------------------------------------------------------------ */
/* Image compression (keeps uploads light for phones / iPad)          */
/* ------------------------------------------------------------------ */

const MAX_IMAGE_SIDE = 2000;

export interface CompressOptions {
  /** plus grand côté en px (défaut 2000) */
  maxSide?: number;
  /** qualité JPEG (défaut 0.85) */
  quality?: number;
  /** en dessous de cette taille, le fichier est laissé tel quel (défaut 600 Ko) */
  minBytes?: number;
  /** convertit aussi les PNG en JPEG (défaut false) */
  forceJpeg?: boolean;
}

export const compressImage = (file: File, opts: CompressOptions = {}): Promise<File> =>
  new Promise(resolve => {
    const maxSide = opts.maxSide || MAX_IMAGE_SIDE;
    const quality = opts.quality || 0.85;
    const minBytes = opts.minBytes === undefined ? 600 * 1024 : opts.minBytes;
    try {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < minBytes) {
        resolve(file);
        return;
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) { URL.revokeObjectURL(url); resolve(file); return; }
          const keepPng = file.type === "image/png" && !opts.forceJpeg;
          if (!keepPng) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); }
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(
            blob => {
              URL.revokeObjectURL(url);
              if (!blob || blob.size >= file.size) { resolve(file); return; }
              const name = keepPng ? file.name : file.name.replace(/\.(png|webp|jpe?g)$/i, "") + ".jpg";
              try {
                resolve(new File([blob], name, { type: blob.type, lastModified: Date.now() }));
              } catch {
                // Very old WebKit: File constructor unavailable
                const b: any = blob;
                b.name = name;
                resolve(b as File);
              }
            },
            keepPng ? "image/png" : "image/jpeg",
            quality
          );
        } catch {
          URL.revokeObjectURL(url);
          resolve(file);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    } catch {
      resolve(file);
    }
  });

/* ------------------------------------------------------------------ */
/* Upload / save                                                       */
/* ------------------------------------------------------------------ */

const MIME_EXT: Record<string, string> = {
  "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "video/x-m4v": "m4v", "video/ogg": "ogv",
};

export interface UploadedMaterialFile {
  /** fichier réellement envoyé (image éventuellement compressée) */
  file: File;
  filePath: string;
  kind: MaterialKind;
  publicUrl: string;
}

/**
 * Compresse (images) puis envoie un fichier dans le bucket « course-materials »
 * sous `<folder>/<prefix><horodatage>_<aléa>.<ext>`. Noms uniques → cache long (1 an).
 * Lève l'erreur de Storage en cas d'échec.
 */
export const uploadMaterialFile = async (original: File, folder: string, prefix = ""): Promise<UploadedMaterialFile> => {
  const kind = getFileKind(original.name, original.type);
  const file = kind === "image" ? await compressImage(original) : original;
  const nameExt = extOf(file.name);
  const ext = (nameExt && /^[a-z0-9]{2,5}$/.test(nameExt) ? nameExt : "") || MIME_EXT[file.type] || (kind === "pdf" ? "pdf" : "bin");
  const storageName = `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = `${folder.replace(/\/+$/, "")}/${storageName}`;

  const { error } = await supabase.storage
    .from(COURSE_BUCKET)
    .upload(filePath, file, { upsert: false, contentType: file.type || undefined, cacheControl: "31536000" });
  if (error) throw error;
  const publicUrl = supabase.storage.from(COURSE_BUCKET).getPublicUrl(filePath).data.publicUrl;
  return { file, filePath, kind, publicUrl };
};

/** Chemin Storage déduit d'une URL publique du bucket (ou null si URL externe). */
export const storagePathFromPublicUrl = (url?: string | null): string | null => {
  if (!url) return null;
  const m = url.match(/\/course-materials\/([^?#]+)/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
};

export interface SaveMaterialsOptions {
  courseId: string;
  files: File[];
  links?: { url: string; title?: string }[];
  userId?: string | null;
  onProgress?: (done: number, total: number, currentName: string) => void;
}

export interface SaveMaterialsResult {
  saved: number;
  failed: string[];
}

export const saveCourseMaterials = async ({
  courseId,
  files,
  links = [],
  userId,
  onProgress,
}: SaveMaterialsOptions): Promise<SaveMaterialsResult> => {
  const failed: string[] = [];
  let saved = 0;
  const total = files.length + links.length;
  let done = 0;
  let lastPdfUrl: string | null = null;

  for (const original of files) {
    onProgress?.(done, total, original.name);
    try {
      const { file, filePath, kind } = await uploadMaterialFile(original, `courses/${courseId}`);

      const { error: dbError } = await supabase.from("course_materials").insert({
        course_id: courseId,
        file_name: original.name,
        file_path: filePath,
        file_size: file.size,
        uploaded_by: userId || null,
      });
      if (dbError) {
        await supabase.storage.from(COURSE_BUCKET).remove([filePath]).catch(() => undefined);
        throw dbError;
      }

      if (kind === "pdf") {
        lastPdfUrl = supabase.storage.from(COURSE_BUCKET).getPublicUrl(filePath).data.publicUrl;
      }
      saved++;
    } catch (error: any) {
      console.error("Course material upload failed:", original.name, error);
      failed.push(`${original.name}${error?.message ? ` (${error.message})` : ""}`);
    }
    done++;
  }

  for (const link of links) {
    onProgress?.(done, total, link.title || link.url);
    try {
      const { error } = await supabase.from("course_materials").insert({
        course_id: courseId,
        file_name: (link.title || "").trim() || link.url,
        file_path: link.url.trim(),
        file_size: null,
        uploaded_by: userId || null,
      });
      if (error) throw error;
      saved++;
    } catch (error: any) {
      console.error("Course video link save failed:", link.url, error);
      failed.push(link.url);
    }
    done++;
  }

  // Keep the legacy "pdf_url" shortcut pointing at a PDF only (never an image/video)
  if (lastPdfUrl) {
    await supabase.from("courses").update({ pdf_url: lastPdfUrl }).eq("id", courseId);
  }
  onProgress?.(total, total, "");
  return { saved, failed };
};

/**
 * Retire du stockage les fichiers qui ne servent plus à aucun cours ni exercice.
 * Un cours ou un exercice copié partage les fichiers de l'original : on ne supprime un fichier
 * qu'une fois sa dernière référence partie. À appeler après la suppression des lignes.
 */
export const removeUnreferencedFiles = async (paths: (string | null | undefined)[]) => {
  const uniq = [...new Set(paths.filter((p): p is string => !!p && !isExternalUrl(p)))];
  if (!uniq.length) return;
  const db = supabase as any;
  const used = new Set<string>();
  const urlOf = (p: string) => supabase.storage.from(COURSE_BUCKET).getPublicUrl(p).data.publicUrl;
  for (let i = 0; i < uniq.length; i += 100) {
    const part = uniq.slice(i, i + 100);
    const urls = part.map(urlOf);
    const res = await Promise.all([
      db.from("course_materials").select("file_path").in("file_path", part),
      db.from("exercise_materials").select("file_path").in("file_path", part),
      db.from("courses").select("pdf_url").in("pdf_url", urls),
      db.from("exercises").select("pdf_url").in("pdf_url", urls),
    ]);
    // exercise_materials peut manquer sur une ancienne base ; toute autre erreur : dans le doute, on garde
    if (res.some((r: any, k: number) => r.error && !(k === 1 && /exercise_materials/.test(r.error.message || "")))) return;
    for (const r of res) for (const row of r.data || []) {
      const p = row.file_path ?? storagePathFromPublicUrl(row.pdf_url);
      if (p) used.add(p);
    }
  }
  const free = uniq.filter((p) => !used.has(p));
  for (let i = 0; i < free.length; i += 100) {
    await supabase.storage.from(COURSE_BUCKET).remove(free.slice(i, i + 100)).catch(() => undefined);
  }
};

/** Delete one material row (+ its storage object when it is an uploaded file). */
export const deleteCourseMaterial = async (m: CourseMaterialLike): Promise<boolean> => {
  const { error } = await supabase.from("course_materials").delete().eq("id", m.id);
  if (error) {
    console.error("Error deleting material:", error);
    return false;
  }
  await removeUnreferencedFiles([m.file_path]);
  return true;
};

/* ------------------------------------------------------------------ */
/* Images insérées dans l'éditeur de texte (questions, contenus)      */
/* ------------------------------------------------------------------ */

/** Compresse (1280 px, JPEG 0.8) puis envoie l'image dans le stockage ; renvoie l'URL publique ou null. */
export const uploadEditorImage = async (file: File, userId?: string | null): Promise<{ url: string | null; compressed: File }> => {
  const compressed = await compressImage(file, { maxSide: 1280, quality: 0.8, minBytes: 0, forceJpeg: file.type !== "image/png" });
  try {
    const ext = compressed.type === "image/png" ? "png" : compressed.type === "image/gif" ? "gif" : compressed.type === "image/webp" ? "webp" : "jpg";
    const path = `editor/${userId || "anon"}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from(COURSE_BUCKET)
      .upload(path, compressed, { upsert: false, contentType: compressed.type || undefined, cacheControl: "31536000" });
    if (error) throw error;
    const url = supabase.storage.from(COURSE_BUCKET).getPublicUrl(path).data.publicUrl;
    return { url: url || null, compressed };
  } catch (e) {
    console.warn("Editor image upload failed, falling back to inline image", e);
    return { url: null, compressed };
  }
};

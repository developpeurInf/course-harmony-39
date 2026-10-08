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

export const compressImage = (file: File): Promise<File> =>
  new Promise(resolve => {
    try {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 600 * 1024) {
        resolve(file);
        return;
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) { URL.revokeObjectURL(url); resolve(file); return; }
          const keepPng = file.type === "image/png";
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
            0.85
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
      const kind = getFileKind(original.name, original.type);
      const file = kind === "image" ? await compressImage(original) : original;
      const MIME_EXT: Record<string, string> = {
        "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp",
        "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "video/x-m4v": "m4v", "video/ogg": "ogv",
      };
      const nameExt = extOf(file.name);
      const ext = (nameExt && /^[a-z0-9]{2,5}$/.test(nameExt) ? nameExt : "") || MIME_EXT[file.type] || (kind === "pdf" ? "pdf" : "bin");
      const storageName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const filePath = `courses/${courseId}/${storageName}`;

      const { error: uploadError } = await supabase.storage
        .from(COURSE_BUCKET)
        .upload(filePath, file, { upsert: true, contentType: file.type || undefined, cacheControl: "3600" });
      if (uploadError) throw uploadError;

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

/** Delete one material row (+ its storage object when it is an uploaded file). */
export const deleteCourseMaterial = async (m: CourseMaterialLike): Promise<boolean> => {
  const { error } = await supabase.from("course_materials").delete().eq("id", m.id);
  if (error) {
    console.error("Error deleting material:", error);
    return false;
  }
  if (!isExternalUrl(m.file_path)) {
    await supabase.storage.from(COURSE_BUCKET).remove([m.file_path]).catch(() => undefined);
  }
  return true;
};

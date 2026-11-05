/**
 * « Exams » d'une classe : Devoirs maison et Exemples devoirs.
 * Tables class_documents / class_document_files, bucket privé « class-documents »
 * (migration supabase/migrations/20261120090000_class_documents.sql).
 *
 * Un document = un titre, une consigne, des fichiers « sujet » et des fichiers « corrigé »
 * (n'importe quel format). Les corrigés restent cachés aux élèves tant que
 * correction_visible est faux (la base ne leur renvoie même pas les lignes).
 */
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export const CLASS_DOCS_BUCKET = "class-documents";
export const CLASS_DOCS_MAX_BYTES = 50 * 1024 * 1024;

export type ClassDocKind = "homework" | "example";
export type DocFileRole = "subject" | "correction";

export interface DocFile {
  id: string;
  document_id: string;
  role: DocFileRole;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string | null;
  position: number;
  created_at: string;
}

export interface ClassDoc {
  id: string;
  room_id: string;
  owner_id: string;
  kind: ClassDocKind;
  title: string;
  description: string | null;
  due_at: string | null;
  is_visible: boolean;
  correction_visible: boolean;
  created_at: string;
  updated_at: string;
  files: DocFile[];
}

export type DocPatch = Partial<Pick<ClassDoc, "title" | "description" | "due_at" | "is_visible" | "correction_visible">>;

/** Page de la barre latérale pour chaque type */
export const docKindPath = (kind: ClassDocKind, roomId?: string | null) =>
  `${roomId ? `/rooms/${roomId}` : ""}/${kind === "homework" ? "homework" : "exam-examples"}`;

/** La migration n'a pas encore été lancée */
export const missingDocsTable = (e: any) =>
  e?.code === "42P01" || e?.code === "PGRST205" || /class_document/.test(e?.message || "");

const sortFiles = (files: DocFile[]) =>
  [...(files || [])].sort((a, b) => (a.role === b.role ? a.position - b.position || a.created_at.localeCompare(b.created_at) : a.role === "subject" ? -1 : 1));

let cache: Record<string, ClassDoc[]> = {};
export const cachedDocs = (kind: ClassDocKind, roomId?: string | null) => cache[`${kind}:${roomId || "*"}`] || null;

export async function listDocs(kind: ClassDocKind, roomId?: string | null): Promise<ClassDoc[]> {
  let q = db
    .from("class_documents")
    .select("*, files:class_document_files(*)")
    .eq("kind", kind)
    .order("created_at", { ascending: false })
    .limit(500);
  if (roomId) q = q.eq("room_id", roomId);
  const { data, error } = await q;
  if (error) throw error;
  const rows: ClassDoc[] = (data || []).map((d: ClassDoc) => ({ ...d, files: sortFiles(d.files) }));
  cache = { ...cache, [`${kind}:${roomId || "*"}`]: rows };
  return rows;
}

export async function createDoc(roomId: string, ownerId: string, kind: ClassDocKind, patch: DocPatch): Promise<ClassDoc> {
  const { data, error } = await db
    .from("class_documents")
    .insert({ room_id: roomId, owner_id: ownerId, kind, ...cleanPatch(patch) })
    .select("*")
    .single();
  if (error) throw error;
  return { ...data, files: [] };
}

export async function updateDoc(id: string, patch: DocPatch) {
  const { error } = await db.from("class_documents").update(cleanPatch(patch)).eq("id", id);
  if (error) throw error;
}

export async function deleteDoc(doc: ClassDoc) {
  const { data } = await db.from("class_document_files").select("file_path").eq("document_id", doc.id);
  const paths = [...new Set([...(doc.files || []).map((f) => f.file_path), ...((data || []) as { file_path: string }[]).map((f) => f.file_path)])];
  const { error } = await db.from("class_documents").delete().eq("id", doc.id);
  if (error) throw error;
  if (paths.length) await supabase.storage.from(CLASS_DOCS_BUCKET).remove(paths).catch(() => undefined);
}

function cleanPatch(p: DocPatch): DocPatch {
  const out: DocPatch = { ...p };
  if (out.title !== undefined) out.title = out.title.trim().slice(0, 200) || "Sans titre";
  if (out.description !== undefined) out.description = (out.description || "").trim().slice(0, 5000) || null;
  return out;
}

/** Nom de fichier sûr pour le stockage (le vrai nom reste dans file_name) */
const storageName = (name: string) => {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) : "";
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${Date.now()}-${rnd}${base ? `-${base}` : ""}${ext ? `.${ext}` : ""}`;
};

/** Envoie un fichier puis l'enregistre sur le document */
export async function uploadDocFile(doc: Pick<ClassDoc, "id" | "room_id">, file: File, role: DocFileRole, position = 0): Promise<DocFile> {
  if (file.size > CLASS_DOCS_MAX_BYTES) throw Object.assign(new Error("too_big"), { code: "too_big" });
  const path = `${doc.room_id}/${doc.id}/${storageName(file.name)}`;
  const { error: upErr } = await supabase.storage
    .from(CLASS_DOCS_BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false, cacheControl: "3600" });
  if (upErr) throw upErr;
  const { data, error } = await db
    .from("class_document_files")
    .insert({ document_id: doc.id, role, file_name: file.name.slice(0, 255) || "fichier", file_path: path, file_size: file.size, mime_type: file.type || null, position })
    .select("*")
    .single();
  if (error) {
    await supabase.storage.from(CLASS_DOCS_BUCKET).remove([path]).catch(() => undefined);
    throw error;
  }
  return data;
}

export async function deleteDocFile(f: DocFile) {
  const { error } = await db.from("class_document_files").delete().eq("id", f.id);
  if (error) throw error;
  await supabase.storage.from(CLASS_DOCS_BUCKET).remove([f.file_path]).catch(() => undefined);
}

export async function setFileRole(f: DocFile, role: DocFileRole) {
  const { error } = await db.from("class_document_files").update({ role }).eq("id", f.id);
  if (error) throw error;
}

/**
 * Lien temporaire (2 h). Avec `download`, le serveur renvoie le fichier sous son vrai nom
 * (fonctionne aussi sur iPad iOS 12, qui ignore l'attribut download).
 */
export async function fileUrl(f: Pick<DocFile, "file_path" | "file_name">, download = false): Promise<string> {
  const { data, error } = await supabase.storage
    .from(CLASS_DOCS_BUCKET)
    .createSignedUrl(f.file_path, 7200, download ? { download: f.file_name } : undefined);
  if (error || !data?.signedUrl) throw error || new Error("url");
  return data.signedUrl;
}

export type FileKind = "pdf" | "image" | "video" | "audio" | "office" | "text" | "other";
const ext = (n: string) => (n.includes(".") ? n.split(".").pop()!.toLowerCase() : "");
export function fileKind(f: Pick<DocFile, "file_name" | "mime_type">): FileKind {
  const e = ext(f.file_name);
  const m = f.mime_type || "";
  if (e === "pdf" || m === "application/pdf") return "pdf";
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "avif"].includes(e) || (m.startsWith("image/") && !["heic", "heif", "tif", "tiff"].includes(e))) return "image";
  if (["mp4", "webm", "mov", "m4v", "ogv"].includes(e) || m.startsWith("video/")) return "video";
  if (["mp3", "m4a", "wav", "ogg", "aac", "opus"].includes(e) || m.startsWith("audio/")) return "audio";
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp"].includes(e)) return "office";
  if (["txt", "csv", "md", "tex", "json"].includes(e)) return "text";
  return "other";
}

export const formatSize = (n: number, locale = "fr-FR") => {
  if (!n) return "";
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / 1048576).toLocaleString(locale, { maximumFractionDigits: 1 })} Mo`;
};

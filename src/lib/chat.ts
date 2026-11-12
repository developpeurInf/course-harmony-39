/**
 * Messagerie élève ↔ professeur : types, accès à la base, fichiers (bucket privé « chat-media »).
 * Les règles d'accès sont dans la base (migration 20261114090000_student_teacher_chat.sql) :
 * un élève ne peut écrire qu'à ses professeurs, jamais à un autre élève.
 */
import { supabase } from "@/integrations/supabase/client";
import { attachmentKind, formatBytes, type SupportAttachment, type SupportLocation } from "@/lib/supportAttachments";

export { attachmentKind, formatBytes };
export const db = supabase as any;

export const CHAT_BUCKET = "chat-media";
export const CHAT_MAX_BYTES = 25 * 1024 * 1024;
export const CHAT_DOC_ACCEPT =
  "application/pdf,text/plain,text/csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.zip,.rar,.ggb,image/*,video/*,audio/*";

export type Attachment = SupportAttachment & { width?: number; height?: number; duration?: number };
export type ChatLocation = SupportLocation;
export interface ChatContactCard { name: string; phone?: string; email?: string }

export type MessageKind = "text" | "media" | "voice" | "file" | "contact" | "location" | "call";

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  kind: MessageKind;
  body: string;
  attachments: Attachment[];
  location: ChatLocation | null;
  contact: ChatContactCard | null;
  meta: { call_id?: string; status?: string; duration?: number; video?: boolean } | null;
  reply_to: string | null;
  client_id: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  /** côté client : envoi en cours / échoué */
  _pending?: boolean;
  _failed?: boolean;
  _files?: File[];
}

export interface Reaction { message_id: string; user_id: string; emoji: string }

export interface ChatContact {
  user_id: string;
  name: string;
  avatar_url: string | null;
  role: "student" | "professor";
  room_names: string | null;
  conversation_id: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_sender_id: string | null;
  unread: number;
  other_read_at: string | null;
  muted: boolean;
  closed: boolean;
  can_chat: boolean;
  can_call: boolean;
  last_seen_at: string | null;
  /** Classes communes (professeur : classes de l'élève) */
  room_ids?: string[] | null;
}

export interface ChatCall {
  id: string;
  conversation_id: string;
  caller_id: string;
  callee_id: string;
  status: "ringing" | "accepted" | "declined" | "missed" | "cancelled" | "ended" | "failed";
  video?: boolean;
  created_at: string;
  answered_at: string | null;
  ended_at: string | null;
}

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
export const EMOJIS = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎", "🤔", "😅", "😉", "🙂", "😴", "😢", "😭", "😡",
  "👍", "👎", "👏", "🙏", "💪", "👌", "✌️", "🤝", "❤️", "💯", "🔥", "⭐", "✅", "❌", "❓", "❗",
  "📚", "📝", "✏️", "📐", "📏", "🧮", "➕", "➖", "✖️", "➗", "♾️", "🎓", "🏆", "🎉", "⏰", "📅",
];

export const initialsOf = (name?: string | null) =>
  (name || "?").trim().split(/\s+/).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join("") || "?";

/** Couleur stable d'un avatar sans photo */
export const avatarTone = (id: string) => {
  const tones = [
    "bg-sky-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-rose-500", "bg-teal-500", "bg-indigo-500", "bg-orange-500",
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return tones[Math.abs(h) % tones.length];
};

/** « En ligne » si vu il y a moins de 2 minutes */
export const isOnline = (lastSeen?: string | null) => !!lastSeen && Date.now() - new Date(lastSeen).getTime() < 2 * 60 * 1000;

export const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });

const safeName = (name: string) =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(-80) || "fichier";

/** Dimensions d'une image / durée d'une vidéo ou d'un audio (pour réserver la place avant chargement) */
async function probe(f: File): Promise<Partial<Attachment>> {
  const kind = attachmentKind(f.type);
  if (kind !== "image" && kind !== "video" && kind !== "audio") return {};
  const url = URL.createObjectURL(f);
  try {
    return await new Promise(resolve => {
      const done = (v: Partial<Attachment>) => { resolve(v); };
      const timer = setTimeout(() => done({}), 4000);
      if (kind === "image") {
        const img = new Image();
        img.onload = () => { clearTimeout(timer); done({ width: img.naturalWidth, height: img.naturalHeight }); };
        img.onerror = () => { clearTimeout(timer); done({}); };
        img.src = url;
      } else {
        const el = document.createElement(kind === "video" ? "video" : "audio") as HTMLVideoElement;
        el.preload = "metadata";
        el.onloadedmetadata = () => {
          clearTimeout(timer);
          const d = isFinite(el.duration) ? Math.round(el.duration) : undefined;
          done(kind === "video" ? { width: el.videoWidth, height: el.videoHeight, duration: d } : { duration: d });
        };
        el.onerror = () => { clearTimeout(timer); done({}); };
        el.src = url;
      }
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

/** Envoie les fichiers dans le dossier de la discussion */
export async function uploadChatFiles(conversationId: string, files: File[], extra: Partial<Attachment> = {}) {
  const done: Attachment[] = [];
  const failed: string[] = [];
  for (const f of files) {
    if (f.size > CHAT_MAX_BYTES) {
      failed.push(`${f.name} (> 25 Mo)`);
      continue;
    }
    const path = `${conversationId}/${uuid()}-${safeName(f.name)}`;
    const type = f.type || "application/octet-stream";
    const [meta, up] = await Promise.all([probe(f), supabase.storage.from(CHAT_BUCKET).upload(path, f, { contentType: type })]);
    if (up.error) failed.push(`${f.name} (${up.error.message})`);
    else done.push({ path, name: f.name, type, size: f.size, ...meta, ...extra });
  }
  return { done, failed };
}

/** Liens temporaires (2 h), gardés en mémoire pour ne pas les redemander */
const signed: Record<string, { url: string; until: number }> = {};
export async function signChatPaths(paths: string[]): Promise<Record<string, string>> {
  const now = Date.now();
  const missing = [...new Set(paths)].filter(p => !signed[p] || signed[p].until < now);
  if (missing.length) {
    const { data } = await supabase.storage.from(CHAT_BUCKET).createSignedUrls(missing, 7200);
    (data || []).forEach((d: any) => {
      if (d.signedUrl && d.path) signed[d.path] = { url: d.signedUrl, until: now + 7000 * 1000 };
    });
  }
  const out: Record<string, string> = {};
  paths.forEach(p => { if (signed[p]) out[p] = signed[p].url; });
  return out;
}

export const MSG_COLUMNS = "id, conversation_id, sender_id, kind, body, attachments, location, contact, meta, reply_to, client_id, created_at, edited_at, deleted_at";

export async function fetchMessages(conversationId: string, before?: string, limit = 40): Promise<ChatMessage[]> {
  let q = db.from("chat_messages").select(MSG_COLUMNS).eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(limit);
  if (before) q = q.lt("created_at", before);
  const { data, error } = await q;
  if (error) throw error;
  return ((data || []) as ChatMessage[]).reverse();
}

export async function fetchContacts(): Promise<ChatContact[]> {
  const { data, error } = await db.rpc("chat_contacts");
  if (error) throw error;
  return (data || []) as ChatContact[];
}

/** Choix du format d'enregistrement : mp4 d'abord (lisible sur iPhone / iPad), sinon webm / ogg */
export function pickAudioMime(): string | undefined {
  const MR = (typeof window !== "undefined" && (window as any).MediaRecorder) as typeof MediaRecorder | undefined;
  if (!MR || typeof MR.isTypeSupported !== "function") return undefined;
  return ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find(t => MR.isTypeSupported(t));
}

export const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export const vcard = (c: ChatContactCard) =>
  ["BEGIN:VCARD", "VERSION:3.0", `FN:${c.name}`, c.phone ? `TEL;TYPE=CELL:${c.phone}` : "", c.email ? `EMAIL:${c.email}` : "", "END:VCARD"]
    .filter(Boolean)
    .join("\r\n");

/**
 * Lit le fichier tout de suite après le choix (Android : le lien vers la photo de la galerie
 * peut expirer, et l'envoi échouait sans même partir). Les photos sont réduites à 1920 px
 * (JPEG 85 %) : envoi rapide en 4G, qualité nette à l'écran. GIF, SVG, HEIC non décodables : copie brute.
 */
const MAX_SIDE = 1920;
export async function prepareFile(f: File): Promise<File> {
  const type = f.type || "";
  const name = f.name || `fichier-${Date.now()}`;
  const raw = async () => new File([await f.arrayBuffer()], name, { type: type || guessType(name), lastModified: Date.now() });
  if (!/^image\/(jpeg|jpg|png|webp|bmp)$/i.test(type) || f.size < 300 * 1024) return raw();
  try {
    const url = URL.createObjectURL(f);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    URL.revokeObjectURL(url);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    if (scale === 1 && /jpe?g/i.test(type) && f.size < 1.5 * 1024 * 1024) return raw();
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return raw();
    ctx.fillStyle = "#fff"; // PNG transparent → fond blanc en JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob || blob.size >= f.size) return raw();
    return new File([blob], name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return raw();
  }
}

function guessType(name: string) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", heic: "image/heic", heif: "image/heif",
    mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", "3gp": "video/3gpp", m4a: "audio/mp4", mp3: "audio/mpeg", ogg: "audio/ogg",
    pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  return map[ext] || "application/octet-stream";
}

/** Le contact fait-il partie de cette classe ? (room_ids, sinon nom de la classe si la base n'est pas à jour) */
export function contactInRoom(c: ChatContact, roomId: string, roomName?: string | null) {
  if (Array.isArray(c.room_ids)) return c.room_ids.includes(roomId);
  if (!roomName || !c.room_names) return false;
  return c.room_names.split(" · ").includes(roomName);
}

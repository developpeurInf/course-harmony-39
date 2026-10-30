/** Pièces jointes du support : bucket privé « support-attachments », dossier = id du ticket. */
import { supabase } from "@/integrations/supabase/client";

export const SUPPORT_BUCKET = "support-attachments";
export const SUPPORT_MAX_BYTES = 25 * 1024 * 1024;
export const SUPPORT_ACCEPT =
  "image/*,video/*,audio/*,application/pdf,text/plain,text/csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.zip";

export interface SupportAttachment {
  path: string;
  name: string;
  type: string;
  size: number;
}

export interface SupportLocation {
  lat: number;
  lng: number;
  accuracy?: number;
}

export type AttachmentKind = "image" | "video" | "audio" | "pdf" | "file";

export const attachmentKind = (type: string): AttachmentKind =>
  type.startsWith("image/") ? "image" : type.startsWith("video/") ? "video" : type.startsWith("audio/") ? "audio" : type === "application/pdf" ? "pdf" : "file";

export const formatBytes = (n: number) =>
  n < 1024 ? `${n} o` : n < 1024 * 1024 ? `${Math.round(n / 1024)} Ko` : `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;

const safeName = (name: string) =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(-80) || "fichier";

/** Envoie les fichiers dans le dossier du ticket. Renvoie ceux qui ont réussi et les erreurs. */
export async function uploadSupportFiles(ticketId: string, files: File[]) {
  const done: SupportAttachment[] = [];
  const failed: string[] = [];
  for (const f of files) {
    if (f.size > SUPPORT_MAX_BYTES) {
      failed.push(`${f.name} (> 25 Mo)`);
      continue;
    }
    const path = `${ticketId}/${crypto.randomUUID()}-${safeName(f.name)}`;
    const { error } = await supabase.storage.from(SUPPORT_BUCKET).upload(path, f, { contentType: f.type || "application/octet-stream" });
    if (error) failed.push(f.name);
    else done.push({ path, name: f.name, type: f.type || "application/octet-stream", size: f.size });
  }
  return { done, failed };
}

/** Liens temporaires (1 h) pour afficher les pièces jointes */
export async function signSupportPaths(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data } = await supabase.storage.from(SUPPORT_BUCKET).createSignedUrls(paths, 3600);
  const m: Record<string, string> = {};
  (data || []).forEach((d: any) => { if (d.signedUrl && d.path) m[d.path] = d.signedUrl; });
  return m;
}

export const mapsUrl = (l: SupportLocation) => `https://www.google.com/maps?q=${l.lat},${l.lng}`;
export const osmEmbedUrl = (l: SupportLocation) => {
  const d = 0.004;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${l.lng - d},${l.lat - d},${l.lng + d},${l.lat + d}&layer=mapnik&marker=${l.lat},${l.lng}`;
};

export function currentLocation(): Promise<SupportLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: Number(p.coords.latitude.toFixed(6)), lng: Number(p.coords.longitude.toFixed(6)), accuracy: Math.round(p.coords.accuracy) }),
      (e) => reject(e),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
}

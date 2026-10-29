import { supabase } from "@/integrations/supabase/client";

/** Reçus de paiement envoyés par les profs : bucket privé « payment-receipts », dossier = id du prof. */
export const RECEIPTS_BUCKET = "payment-receipts";
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
export const RECEIPT_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,application/pdf";

/** Réduit une photo de téléphone (≤ 1800 px, JPEG) ; renvoie le fichier d'origine si le navigateur ne sait pas la lire. */
async function shrinkImage(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 600 * 1024) return file;
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    URL.revokeObjectURL(url);
    const scale = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/** Envoie le reçu ; renvoie son chemin dans le bucket, ou une erreur « too_big ». */
export async function uploadReceipt(userId: string, file: File): Promise<{ path?: string; error?: string }> {
  const body = await shrinkImage(file);
  if (body.size > RECEIPT_MAX_BYTES) return { error: "too_big" };
  const isJpeg = body !== file;
  const ext = isJpeg ? "jpg" : (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(RECEIPTS_BUCKET).upload(path, body, {
    contentType: isJpeg ? "image/jpeg" : file.type || undefined,
    upsert: false,
  });
  if (error) return { error: error.message };
  return { path };
}

/** Lien temporaire (10 min) pour ouvrir un reçu */
export async function receiptUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(RECEIPTS_BUCKET).createSignedUrl(path, 600);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Ouvre un reçu dans un nouvel onglet (onglet ouvert avant l'attente : Safari bloque sinon). */
export async function openReceipt(path: string): Promise<boolean> {
  const win = window.open("", "_blank");
  const url = await receiptUrl(path);
  if (!url) {
    if (win) win.close();
    return false;
  }
  if (win) win.location.href = url;
  else window.location.href = url;
  return true;
}

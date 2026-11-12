/**
 * Ajoute en tête de chaque page d'un PDF proposé un en-tête : professeur à gauche, lycée à droite
 * et, au centre, le chapitre dans l'ordre choisi par le professeur (« Chapitre 3 · … »).
 * Le texte est dessiné dans un canvas (le navigateur gère l'arabe et les accents), puis
 * collé en image avec pdf-lib : aucune police à embarquer.
 */
import { PDFDocument } from "pdf-lib";

const cache = new Map<string, string>();

/** coupe le texte avec « … » pour qu'il tienne dans maxW */
function fit(ctx: CanvasRenderingContext2D, t: string, maxW: number): string {
  if (!t || ctx.measureText(t).width <= maxW) return t;
  let s = t;
  while (s.length > 1 && ctx.measureText(s + "…").width > maxW) s = s.slice(0, -1);
  return s.trimEnd() + "…";
}

function bandPng(left: string, right: string, widthPt: number, center = ""): Promise<Uint8Array> {
  const scale = 4;
  const h = 18;
  const c = document.createElement("canvas");
  c.width = Math.round(widthPt * scale);
  c.height = h * scale;
  const ctx = c.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.font = "600 9.5px 'DejaVu Sans', 'Segoe UI', Tahoma, Arial, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#1d2433";
  // côtés limités à 30 % chacun quand il y a un chapitre ; le centre prend la place restante
  const sideW = center ? widthPt * 0.3 : widthPt / 2 - 6;
  const l = fit(ctx, left, sideW), r = fit(ctx, right, sideW);
  ctx.textAlign = "left";
  if (l) ctx.fillText(l, 0, 7);
  ctx.textAlign = "right";
  if (r) ctx.fillText(r, widthPt, 7);
  if (center) {
    const side = Math.max(l ? ctx.measureText(l).width : 0, r ? ctx.measureText(r).width : 0);
    ctx.font = "600 9px 'DejaVu Sans', 'Segoe UI', Tahoma, Arial, sans-serif";
    ctx.fillStyle = "#2b59c3";
    ctx.textAlign = "center";
    ctx.fillText(fit(ctx, center, widthPt - 2 * side - 24), widthPt / 2, 7);
  }
  ctx.fillStyle = "#2b59c3";
  ctx.fillRect(0, h - 2, widthPt, 1);
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? b.arrayBuffer().then((a) => resolve(new Uint8Array(a))) : reject(new Error("canvas"))), "image/png")
  );
}

export function stampLine(teacher?: string | null, school?: string | null): [string, string] {
  return [teacher?.trim() ? `Prof : ${teacher.trim()}` : "", school?.trim() ? `Lycée : ${school.trim()}` : ""];
}

/** URL blob du PDF tamponné (mise en cache) ; renvoie l'URL d'origine si rien à ajouter ou en cas d'échec */
export async function stampedPdfUrl(file: string, teacher?: string | null, school?: string | null, chapter?: string | null): Promise<string> {
  const [left, right] = stampLine(teacher, school);
  const center = chapter?.trim() || "";
  if (!left && !right && !center) return file;
  const key = `${file}|${left}|${right}|${center}`;
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const bytes = await fetch(file).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.arrayBuffer();
    });
    const pdf = await PDFDocument.load(bytes);
    const pages = pdf.getPages();
    if (!pages.length) return file;
    const { width } = pages[0].getSize();
    const bandW = width - 2 * 42;
    const png = await pdf.embedPng(await bandPng(left, right, bandW, center));
    for (const p of pages) {
      const { width: w, height: h } = p.getSize();
      p.drawImage(png, { x: (w - bandW) / 2, y: h - 34, width: bandW, height: 18 });
    }
    const out = await pdf.save();
    const url = URL.createObjectURL(new Blob([out as unknown as BlobPart], { type: "application/pdf" }));
    cache.set(key, url);
    return url;
  } catch (e) {
    console.warn("[proposés] tampon PDF impossible", e);
    return file;
  }
}

/** même PDF tamponné, sous forme de fichier (pour l'ajouter à un cours, un exercice ou un exam) */
export async function stampedPdfFile(file: string, name: string, teacher?: string | null, school?: string | null, chapter?: string | null): Promise<File> {
  const url = await stampedPdfUrl(file, teacher, school, chapter);
  const blob = await fetch(url).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.blob(); });
  return new File([blob], name, { type: "application/pdf" });
}

export const fileNameOf = (file: string) => file.split("/").pop() || "document.pdf";

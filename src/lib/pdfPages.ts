/**
 * Opérations sur les pages et le contenu d'un PDF (dans le navigateur, avec pdf-lib) :
 * organiser (réordonner, supprimer, extraire, pivoter, insérer, dupliquer, scinder, fusionner)
 * et ajouter (filigrane, en-tête / pied de page, numéros de page).
 *
 * Les textes ajoutés sont dessinés par le navigateur (canvas) puis insérés en image :
 * l'arabe, les accents et la police de l'application s'affichent correctement.
 */
import { PDFDocument, PDFPage, degrees } from "pdf-lib";

type Bytes = ArrayBuffer | Uint8Array;

const load = (b: Bytes) => PDFDocument.load(b, { ignoreEncryption: true, updateMetadata: false });

/** Copie des pages (index 0…) d'un document dans un nouveau document */
async function pick(src: PDFDocument, indices: number[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indices);
  pages.forEach((p) => out.addPage(p));
  return out.save();
}

export async function pageCount(bytes: Bytes): Promise<number> {
  return (await load(bytes)).getPageCount();
}

/** Nouvel ordre des pages : order[i] = index d'origine de la page placée en position i */
export async function reorderPages(bytes: Bytes, order: number[]): Promise<Uint8Array> {
  return pick(await load(bytes), order);
}

export async function deletePages(bytes: Bytes, indices: number[]): Promise<Uint8Array> {
  const src = await load(bytes);
  const drop = new Set(indices);
  const keep = src.getPageIndices().filter((i) => !drop.has(i));
  if (!keep.length) throw new Error("Cannot delete every page");
  return pick(src, keep);
}

export async function extractPages(bytes: Bytes, indices: number[]): Promise<Uint8Array> {
  return pick(await load(bytes), [...indices].sort((a, b) => a - b));
}

export async function duplicatePages(bytes: Bytes, indices: number[]): Promise<Uint8Array> {
  const src = await load(bytes);
  const dup = new Set(indices);
  const order: number[] = [];
  src.getPageIndices().forEach((i) => {
    order.push(i);
    if (dup.has(i)) order.push(i);
  });
  return pick(src, order);
}

/** Rotation permanente (multiple de 90°) */
export async function rotatePages(bytes: Bytes, indices: number[], delta: number): Promise<Uint8Array> {
  const doc = await load(bytes);
  indices.forEach((i) => {
    const p = doc.getPage(i);
    p.setRotation(degrees((((p.getRotation().angle + delta) % 360) + 360) % 360));
  });
  return doc.save();
}

/** Insère une page blanche (même format que la page de référence) à la position `at` */
export async function insertBlankPage(bytes: Bytes, at: number): Promise<Uint8Array> {
  const doc = await load(bytes);
  const ref = doc.getPage(Math.min(Math.max(at - 1, 0), doc.getPageCount() - 1));
  const { width, height } = ref.getSize();
  doc.insertPage(at, [width, height]);
  return doc.save();
}

/** Insère les pages d'autres PDF à la position `at` */
export async function insertFromPdf(bytes: Bytes, others: Bytes[], at: number): Promise<Uint8Array> {
  const doc = await load(bytes);
  let pos = at;
  for (const o of others) {
    const src = await load(o);
    const pages = await doc.copyPages(src, src.getPageIndices());
    pages.forEach((p) => doc.insertPage(pos++, p));
  }
  return doc.save();
}

export async function mergePdfs(files: Bytes[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const f of files) {
    const src = await load(f);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return out.save();
}

/** Scinde en morceaux de `every` pages, ou aux pages données (début de chaque nouvelle partie, base 1) */
export async function splitPdf(bytes: Bytes, opts: { every?: number; at?: number[] }): Promise<Uint8Array[]> {
  const src = await load(bytes);
  const n = src.getPageCount();
  const starts = new Set<number>([0]);
  if (opts.every && opts.every > 0) for (let i = opts.every; i < n; i += opts.every) starts.add(i);
  (opts.at || []).forEach((p) => p > 1 && p <= n && starts.add(p - 1));
  const sorted = [...starts].sort((a, b) => a - b);
  const parts: Uint8Array[] = [];
  for (let k = 0; k < sorted.length; k++) {
    const end = k + 1 < sorted.length ? sorted[k + 1] : n;
    parts.push(await pick(src, Array.from({ length: end - sorted[k] }, (_, j) => sorted[k] + j)));
  }
  return parts;
}

/* ───────────── sélection de pages : « 1-3, 5, 8-10 » ───────────── */

export function parsePageRange(input: string, total: number): number[] {
  const s = input.trim();
  if (!s) return Array.from({ length: total }, (_, i) => i);
  const out = new Set<number>();
  for (const part of s.split(/[,;\s]+/)) {
    const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
    if (!m) continue;
    const a = parseInt(m[1], 10);
    const b = m[2] ? parseInt(m[2], 10) : a;
    for (let i = Math.max(1, Math.min(a, b)); i <= Math.min(total, Math.max(a, b)); i++) out.add(i - 1);
  }
  return [...out].sort((x, y) => x - y);
}

/* ───────────── texte → image (canvas) ───────────── */

export interface TextStyle {
  fontSize: number; // en points PDF
  color: string; // #RRGGBB
  bold?: boolean;
  fontFamily?: string;
}

const RENDER_SCALE = 4; // netteté à l'impression

async function textImage(doc: PDFDocument, text: string, style: TextStyle) {
  const family = style.fontFamily || getComputedStyle(document.body).fontFamily || "sans-serif";
  const font = `${style.bold ? "600 " : ""}${style.fontSize * RENDER_SCALE}px ${family}`;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  const lines = text.split("\n");
  const lineH = style.fontSize * 1.25 * RENDER_SCALE;
  const w = Math.ceil(Math.max(...lines.map((l) => ctx.measureText(l).width), 1)) + 4;
  const h = Math.ceil(lineH * lines.length) + 4;
  canvas.width = w;
  canvas.height = h;
  ctx.font = font;
  ctx.fillStyle = style.color;
  ctx.textBaseline = "middle";
  ctx.direction = /[֐-ࣿ]/.test(text) ? "rtl" : "ltr";
  ctx.textAlign = "center";
  lines.forEach((l, i) => ctx.fillText(l, w / 2, lineH * (i + 0.5) + 2));
  const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/png"));
  const img = await doc.embedPng(await blob.arrayBuffer());
  return { img, width: w / RENDER_SCALE, height: h / RENDER_SCALE };
}

/* ───────────── filigrane ───────────── */

export type WatermarkPosition = "center" | "top" | "bottom";

export interface AddWatermarkOptions {
  text?: string;
  image?: { bytes: ArrayBuffer; type: "png" | "jpg" };
  /** largeur de l'image en % de la largeur de page */
  imageScale?: number;
  style: TextStyle;
  opacity: number; // 0–1
  rotation: number; // degrés
  position: WatermarkPosition;
  pages: number[]; // index 0…
  /** derrière le contenu (sinon par-dessus) */
  behind?: boolean;
}

/** Point d'ancrage pour dessiner une image (w×h) centrée en (cx, cy) avec une rotation */
function drawCentered(page: PDFPage, img: Parameters<PDFPage["drawImage"]>[0], w: number, h: number, cx: number, cy: number, rot: number, opacity: number) {
  const r = (rot * Math.PI) / 180;
  const x = cx - (w / 2) * Math.cos(r) + (h / 2) * Math.sin(r);
  const y = cy - (w / 2) * Math.sin(r) - (h / 2) * Math.cos(r);
  page.drawImage(img, { x, y, width: w, height: h, rotate: degrees(rot), opacity });
}

/** Repère visible de la page (tient compte de la rotation de la page) */
function visualBox(page: PDFPage) {
  const { width, height } = page.getSize();
  const angle = ((page.getRotation().angle % 360) + 360) % 360;
  const swapped = angle === 90 || angle === 270;
  return { width, height, angle, vw: swapped ? height : width, vh: swapped ? width : height };
}

/** Convertit un point (x, y) du repère visible vers le repère de la page */
function toPage(page: PDFPage, x: number, y: number) {
  const { width, height, angle } = visualBox(page);
  switch (angle) {
    case 90: return { x: width - y, y: x, rot: 90 };
    case 180: return { x: width - x, y: height - y, rot: 180 };
    case 270: return { x: y, y: height - x, rot: 270 };
    default: return { x, y, rot: 0 };
  }
}

export async function addWatermark(bytes: Bytes, o: AddWatermarkOptions): Promise<Uint8Array> {
  const doc = await load(bytes);
  let mark: { img: Parameters<PDFPage["drawImage"]>[0]; width: number; height: number } | null = null;
  if (o.image) {
    const img = o.image.type === "png" ? await doc.embedPng(o.image.bytes) : await doc.embedJpg(o.image.bytes);
    mark = { img, width: img.width, height: img.height };
  } else if (o.text?.trim()) {
    mark = await textImage(doc, o.text.trim(), o.style);
  }
  if (!mark) return doc.save();
  for (const i of o.pages) {
    const page = doc.getPage(i);
    const { vw, vh } = visualBox(page);
    let w = mark.width;
    let h = mark.height;
    if (o.image) {
      w = (vw * (o.imageScale || 40)) / 100;
      h = (mark.height / mark.width) * w;
    }
    const cy = o.position === "top" ? vh - h / 2 - 36 : o.position === "bottom" ? h / 2 + 36 : vh / 2;
    const p = toPage(page, vw / 2, cy);
    drawCentered(page, mark.img, w, h, p.x, p.y, o.rotation + p.rot, o.opacity);
    if (o.behind) sendLastOpBehind(page);
  }
  return doc.save();
}

/**
 * Place le dernier dessin ajouté derrière le contenu existant : pdf-lib ajoute un flux de contenu
 * en fin de page ; on le déplace en tête du tableau /Contents.
 */
function sendLastOpBehind(page: PDFPage) {
  const node = page.node;
  const contents = node.Contents();
  if (!contents || !("asArray" in contents)) return;
  const arr = contents as unknown as { asArray: () => unknown[]; remove: (i: number) => void; insert: (i: number, v: unknown) => void; size: () => number };
  const n = arr.size();
  if (n < 2) return;
  const last = arr.asArray()[n - 1];
  arr.remove(n - 1);
  // pdf-lib entoure le contenu d'origine par q … Q : on insère juste après le premier « q »
  arr.insert(1, last);
}

/* ───────────── en-tête, pied de page, numéros ───────────── */

export interface HeaderFooterSlots {
  headerLeft?: string;
  headerCenter?: string;
  headerRight?: string;
  footerLeft?: string;
  footerCenter?: string;
  footerRight?: string;
}

export interface HeaderFooterOptions extends HeaderFooterSlots {
  style: TextStyle;
  margin: number; // points depuis le bord
  pages: number[];
  /** valeurs des champs {name} {date} ; {page} et {total} sont calculés */
  vars?: Record<string, string>;
  /** premier numéro de page affiché */
  startAt?: number;
}

const fill = (tpl: string, vars: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

export async function addHeaderFooter(bytes: Bytes, o: HeaderFooterOptions): Promise<Uint8Array> {
  const doc = await load(bytes);
  const total = o.pages.length;
  const slots: [keyof HeaderFooterSlots, "l" | "c" | "r", "top" | "bottom"][] = [
    ["headerLeft", "l", "top"], ["headerCenter", "c", "top"], ["headerRight", "r", "top"],
    ["footerLeft", "l", "bottom"], ["footerCenter", "c", "bottom"], ["footerRight", "r", "bottom"],
  ];
  const cache = new Map<string, Awaited<ReturnType<typeof textImage>>>();
  let n = 0;
  for (const i of o.pages) {
    n++;
    const page = doc.getPage(i);
    const { vw, vh } = visualBox(page);
    const vars = { ...(o.vars || {}), page: String((o.startAt || 1) + n - 1), total: String(total) };
    for (const [slot, align, edge] of slots) {
      const tpl = o[slot]?.trim();
      if (!tpl) continue;
      const text = fill(tpl, vars);
      let im = cache.get(text);
      if (!im) {
        im = await textImage(doc, text, o.style);
        cache.set(text, im);
      }
      const cx = align === "l" ? o.margin + im.width / 2 : align === "r" ? vw - o.margin - im.width / 2 : vw / 2;
      const cy = edge === "top" ? vh - o.margin * 0.6 - im.height / 2 : o.margin * 0.6 + im.height / 2;
      const p = toPage(page, cx, cy);
      drawCentered(page, im.img, im.width, im.height, p.x, p.y, p.rot, 1);
    }
  }
  return doc.save();
}

/**
 * Papiers et repères à insérer dans un énoncé (SVG) : repère orthonormé gradué,
 * papier quadrillé, millimétré, pointé, et lignes de réponse pour l'élève.
 */
import { svgToDataUrl } from "./varTable";

const CM = 37.8; // 1 cm à l'écran (96 dpi)

export interface RepereOpts { xmin: number; xmax: number; ymin: number; ymax: number; unit: number; grid: boolean; labels: boolean }

export function repereSvg(o: RepereOpts): string {
  const u = o.unit * CM;
  const pad = 18;
  const W = (o.xmax - o.xmin) * u + pad * 2;
  const H = (o.ymax - o.ymin) * u + pad * 2;
  const X = (x: number) => pad + (x - o.xmin) * u;
  const Y = (y: number) => pad + (o.ymax - y) * u;
  const p: string[] = [];
  if (o.grid) {
    for (let x = o.xmin; x <= o.xmax; x++) p.push(`<line x1="${X(x)}" y1="${Y(o.ymin)}" x2="${X(x)}" y2="${Y(o.ymax)}" stroke="#b9c6d6" stroke-width="0.7"/>`);
    for (let y = o.ymin; y <= o.ymax; y++) p.push(`<line x1="${X(o.xmin)}" y1="${Y(y)}" x2="${X(o.xmax)}" y2="${Y(y)}" stroke="#b9c6d6" stroke-width="0.7"/>`);
  }
  const ax = 0 >= o.ymin && 0 <= o.ymax, ay = 0 >= o.xmin && 0 <= o.xmax;
  const arrow = `<marker id="rpA" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,1 L9,5 L0,9 z" fill="#111"/></marker>`;
  if (ax) p.push(`<line x1="${X(o.xmin) - 6}" y1="${Y(0)}" x2="${X(o.xmax) + 12}" y2="${Y(0)}" stroke="#111" stroke-width="1.3" marker-end="url(#rpA)"/>`);
  if (ay) p.push(`<line x1="${X(0)}" y1="${Y(o.ymin) + 6}" x2="${X(0)}" y2="${Y(o.ymax) - 12}" stroke="#111" stroke-width="1.3" marker-end="url(#rpA)"/>`);
  if (o.labels && ax) {
    for (let x = o.xmin; x <= o.xmax; x++) {
      if (x === 0) continue;
      p.push(`<line x1="${X(x)}" y1="${Y(0) - 3}" x2="${X(x)}" y2="${Y(0) + 3}" stroke="#111"/>`);
      p.push(`<text x="${X(x)}" y="${Y(0) + 14}" text-anchor="middle">${x < 0 ? "−" + -x : x}</text>`);
    }
  }
  if (o.labels && ay) {
    for (let y = o.ymin; y <= o.ymax; y++) {
      if (y === 0) continue;
      p.push(`<line x1="${X(0) - 3}" y1="${Y(y)}" x2="${X(0) + 3}" y2="${Y(y)}" stroke="#111"/>`);
      p.push(`<text x="${X(0) - 6}" y="${Y(y) + 4}" text-anchor="end">${y < 0 ? "−" + -y : y}</text>`);
    }
  }
  if (ax && ay) p.push(`<text x="${X(0) - 6}" y="${Y(0) + 14}" text-anchor="end" font-style="italic">O</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(W)}" height="${Math.ceil(H)}" viewBox="0 0 ${Math.ceil(W)} ${Math.ceil(H)}" font-family="Cambria, 'Times New Roman', serif" font-size="11" fill="#111"><defs>${arrow}</defs><rect width="100%" height="100%" fill="#fff"/>${p.join("")}</svg>`;
}

export type PaperKind = "squares" | "mm" | "dots" | "lines";

/** Papier sur la largeur utile de la page (px), sur `heightCm` cm */
export function paperSvg(kind: PaperKind, widthPx: number, heightCm: number): string {
  const W = Math.round(widthPx), H = Math.round(heightCm * CM);
  const p: string[] = [];
  if (kind === "squares") {
    const s = CM / 2;
    for (let x = 0; x <= W; x += s) p.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}"/>`);
    for (let y = 0; y <= H; y += s) p.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`);
    return wrap(W, H, `<g stroke="#a9bfd8" stroke-width="0.6">${p.join("")}</g>`);
  }
  if (kind === "mm") {
    const s = CM / 10;
    let i = 0;
    for (let x = 0; x <= W; x += s, i++) p.push(`<line x1="${x.toFixed(2)}" y1="0" x2="${x.toFixed(2)}" y2="${H}" stroke-width="${i % 10 === 0 ? 0.9 : i % 5 === 0 ? 0.5 : 0.25}"/>`);
    i = 0;
    for (let y = 0; y <= H; y += s, i++) p.push(`<line x1="0" y1="${y.toFixed(2)}" x2="${W}" y2="${y.toFixed(2)}" stroke-width="${i % 10 === 0 ? 0.9 : i % 5 === 0 ? 0.5 : 0.25}"/>`);
    return wrap(W, H, `<g stroke="#e0915a">${p.join("")}</g>`);
  }
  if (kind === "dots") {
    const s = CM / 2;
    for (let x = s / 2; x <= W; x += s) for (let y = s / 2; y <= H; y += s) p.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1"/>`);
    return wrap(W, H, `<g fill="#7d8b9c">${p.join("")}</g>`);
  }
  // lignes de réponse pointillées, espacées de 0,8 cm
  const s = CM * 0.8;
  for (let y = s; y <= H; y += s) p.push(`<line x1="0" y1="${y.toFixed(1)}" x2="${W}" y2="${y.toFixed(1)}"/>`);
  return wrap(W, H, `<g stroke="#8a8a8a" stroke-width="1" stroke-dasharray="1.5 3.5" stroke-linecap="round">${p.join("")}</g>`);
}

const wrap = (W: number, H: number, inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#fff"/>${inner}</svg>`;

export const svgSrc = svgToDataUrl;

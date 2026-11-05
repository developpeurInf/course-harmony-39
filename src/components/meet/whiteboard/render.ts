/**
 * Dessin du tableau sur <canvas> 2D, boîtes englobantes, tests de clic, reconnaissance de formes.
 */
import type { BoardTheme, El, LaserTrail, Paper } from "./model";
import { LASER_MS } from "./model";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Cam {
  x: number;
  y: number;
  z: number;
}

export const THEMES: Record<BoardTheme, { bg: string; fg: string; line: string; strong: string }> = {
  light: { bg: "#fbfbf8", fg: "#1c2230", line: "rgba(28,34,48,0.10)", strong: "rgba(225,29,72,0.28)" },
  slate: { bg: "#141a25", fg: "#eef2f7", line: "rgba(238,242,247,0.08)", strong: "rgba(251,113,133,0.30)" },
  chalk: { bg: "#1e3a32", fg: "#f4f1e8", line: "rgba(244,241,232,0.09)", strong: "rgba(253,224,71,0.25)" },
};

export let FONT = `"Segoe UI","Noto Sans Arabic",system-ui,sans-serif`;
/** même police que l'application (IBM Plex) */
export function initFont() {
  try {
    const f = getComputedStyle(document.body).fontFamily;
    if (f) FONT = f;
  } catch {
    /* ignore */
  }
}
export const NOTE_TEXT = "#1f2937";

export const color = (c: string, theme: BoardTheme) => (c === "fg" ? THEMES[theme].fg : c);
const RTL_RE = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
export const isRtl = (s?: string) => !!s && RTL_RE.test(s);

// ------------------------------------------------------------------ boîtes
const boxCache = new WeakMap<El, Box>();
export function bounds(e: El): Box {
  const c = boxCache.get(e);
  if (c) return c;
  let b: Box;
  if (e.k === "ink" && e.pts && e.pts.length >= 3) {
    const s = e.sc || 1;
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (let i = 0; i < e.pts.length; i += 3) {
      const x = e.pts[i],
        y = e.pts[i + 1];
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    const pad = (e.size * s) / 2 + 1;
    b = { x: e.x + x0 * s - pad, y: e.y + y0 * s - pad, w: (x1 - x0) * s + pad * 2, h: (y1 - y0) * s + pad * 2 };
  } else if (e.k === "shape" && (e.shape === "line" || e.shape === "arrow" || e.shape === "dline")) {
    const pad = e.size / 2 + (e.shape === "line" ? 1 : e.size * 3);
    b = { x: Math.min(e.x, e.x + e.w) - pad, y: Math.min(e.y, e.y + e.h) - pad, w: Math.abs(e.w) + pad * 2, h: Math.abs(e.h) + pad * 2 };
  } else {
    const pad = e.k === "shape" ? e.size / 2 : 0;
    b = { x: e.x - pad, y: e.y - pad, w: e.w + pad * 2, h: e.h + pad * 2 };
  }
  boxCache.set(e, b);
  return b;
}
export function union(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const b of boxes) {
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w);
    y1 = Math.max(y1, b.y + b.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
export const intersects = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const inside = (a: Box, b: Box) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;

function distSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax,
    dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function polyPoints(e: El): number[] {
  if (e.shape === "diamond") return [0.5, 0, 1, 0.5, 0.5, 1, 0, 0.5];
  return e.pts && e.pts.length >= 6 ? e.pts : [0.5, 0, 1, 1, 0, 1];
}

/** l'élément est-il sous le point (tolérance en unités du monde) ? */
export function hit(e: El, x: number, y: number, tol: number): boolean {
  const b = bounds(e);
  if (x < b.x - tol || y < b.y - tol || x > b.x + b.w + tol || y > b.y + b.h + tol) return false;
  if (e.k === "ink" && e.pts) {
    const s = e.sc || 1;
    const r = (e.size * s) / 2 + tol;
    const p = e.pts;
    if (p.length < 6) return Math.hypot(x - (e.x + p[0] * s), y - (e.y + p[1] * s)) <= r;
    for (let i = 3; i < p.length; i += 3) {
      if (distSeg(x, y, e.x + p[i - 3] * s, e.y + p[i - 2] * s, e.x + p[i] * s, e.y + p[i + 1] * s) <= r) return true;
    }
    return false;
  }
  if (e.k === "shape") {
    const r = e.size / 2 + tol;
    if (e.shape === "line" || e.shape === "arrow" || e.shape === "dline") return distSeg(x, y, e.x, e.y, e.x + e.w, e.y + e.h) <= r;
    if (e.fill) return x >= e.x && y >= e.y && x <= e.x + e.w && y <= e.y + e.h;
    if (e.shape === "rect") {
      const inner = x > e.x + r && y > e.y + r && x < e.x + e.w - r && y < e.y + e.h - r;
      return !inner;
    }
    if (e.shape === "ellipse") {
      const rx = e.w / 2,
        ry = e.h / 2;
      const cx = e.x + rx,
        cy = e.y + ry;
      const d = Math.hypot((x - cx) / Math.max(rx, 1), (y - cy) / Math.max(ry, 1));
      return Math.abs(d - 1) * Math.min(rx, ry) <= r;
    }
    const pp = polyPoints(e);
    for (let i = 0; i < pp.length; i += 2) {
      const j = (i + 2) % pp.length;
      if (distSeg(x, y, e.x + pp[i] * e.w, e.y + pp[i + 1] * e.h, e.x + pp[j] * e.w, e.y + pp[j + 1] * e.h) <= r) return true;
    }
    return false;
  }
  return true;
}

/** agrandir / réduire un élément autour d'un point fixe */
export function scaleEl(e: El, ax: number, ay: number, f: number): Partial<El> {
  const nx = ax + (e.x - ax) * f;
  const ny = ay + (e.y - ay) * f;
  if (e.k === "ink") return { x: nx, y: ny, sc: (e.sc || 1) * f };
  if (e.k === "text") return { x: nx, y: ny, w: e.w * f, h: e.h * f, size: e.size * f };
  if (e.k === "note") return { x: nx, y: ny, w: e.w * f, h: e.h * f, size: e.size * f };
  if (e.k === "shape") return { x: nx, y: ny, w: e.w * f, h: e.h * f };
  return { x: nx, y: ny, w: e.w * f, h: e.h * f };
}

// ------------------------------------------------------------------ texte
let measureCtx: CanvasRenderingContext2D | null = null;
function mctx() {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  return measureCtx!;
}
export function measureText(text: string, size: number) {
  const ctx = mctx();
  ctx.font = `600 ${size}px ${FONT}`;
  const lines = (text || " ").split("\n");
  const w = Math.max(...lines.map(l => ctx.measureText(l || " ").width));
  return { w: Math.ceil(w) + 4, h: Math.ceil(lines.length * size * 1.25) };
}
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const out: string[] = [];
  for (const para of (text || "").split("\n")) {
    const words = para.split(/(\s+)/);
    let line = "";
    for (const w of words) {
      const test = line + w;
      if (ctx.measureText(test).width > maxW && line.trim()) {
        out.push(line.trimEnd());
        line = w.trimStart();
        // mot trop long : coupure brute
        while (ctx.measureText(line).width > maxW && line.length > 1) {
          let n = line.length - 1;
          while (n > 1 && ctx.measureText(line.slice(0, n)).width > maxW) n--;
          out.push(line.slice(0, n));
          line = line.slice(n);
        }
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

// ------------------------------------------------------------------ images
const images = new Map<string, HTMLImageElement>();
export function imageFor(src: string, onLoad: () => void) {
  let img = images.get(src);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.onload = onLoad;
    img.src = src;
    images.set(src, img);
    if (images.size > 80) images.delete(images.keys().next().value as string);
  }
  return img;
}

// ------------------------------------------------------------------ fond
export function drawPaper(ctx: CanvasRenderingContext2D, theme: BoardTheme, paper: Paper, cam: Cam, W: number, H: number) {
  const t = THEMES[theme];
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, W, H);
  if (paper === "blank") return;
  let step = paper === "seyes" ? 8 : paper === "lines" ? 32 : 28;
  // pas d'affichage trop serré quand on dézoome
  while (step * cam.z < (paper === "seyes" ? 6 : 12)) step *= paper === "seyes" ? 4 : 2;
  const s = step * cam.z;
  const ox = -((cam.x * cam.z) % s);
  const oy = -((cam.y * cam.z) % s);
  ctx.save();
  if (paper === "dots") {
    ctx.fillStyle = t.line.replace(/[\d.]+\)$/, m => String(Math.min(0.45, parseFloat(m) * 2.6)) + ")");
    const r = Math.max(0.8, Math.min(1.8, cam.z * 1.3));
    for (let x = ox; x < W; x += s) for (let y = oy; y < H; y += s) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.strokeStyle = t.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (paper === "grid") for (let x = ox; x < W; x += s) {
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, H);
    }
    const startRow = Math.round((cam.y * cam.z + oy) / s);
    let row = startRow;
    for (let y = oy; y < H; y += s, row++) {
      if (paper === "seyes" && ((row % 4) + 4) % 4 === 0) continue;
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(W, Math.round(y) + 0.5);
    }
    ctx.stroke();
    if (paper === "seyes") {
      // grands carreaux : lignes plus marquées toutes les 4 lignes + verticales
      ctx.strokeStyle = t.line.replace(/[\d.]+\)$/, m => String(parseFloat(m) * 2.2) + ")");
      ctx.beginPath();
      row = startRow;
      for (let y = oy; y < H; y += s, row++) {
        if (((row % 4) + 4) % 4 !== 0) continue;
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(W, Math.round(y) + 0.5);
      }
      const big = s * 4;
      const bx = -((cam.x * cam.z) % big);
      for (let x = bx; x < W; x += big) {
        ctx.moveTo(Math.round(x) + 0.5, 0);
        ctx.lineTo(Math.round(x) + 0.5, H);
      }
      ctx.stroke();
      // marge rouge du cahier (à x = 0 du monde)
      const mx = (0 - cam.x) * cam.z;
      if (mx > -2 && mx < W + 2) {
        ctx.strokeStyle = t.strong;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(mx, 0);
        ctx.lineTo(mx, H);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------------ éléments
function inkPath(ctx: CanvasRenderingContext2D, e: El) {
  const p = e.pts!;
  const s = e.sc || 1;
  const X = (i: number) => e.x + p[i] * s;
  const Y = (i: number) => e.y + p[i + 1] * s;
  ctx.beginPath();
  ctx.moveTo(X(0), Y(0));
  if (p.length < 6) {
    ctx.lineTo(X(0) + 0.01, Y(0));
    return;
  }
  for (let i = 3; i < p.length - 3; i += 3) {
    ctx.quadraticCurveTo(X(i), Y(i), (X(i) + X(i + 3)) / 2, (Y(i) + Y(i + 3)) / 2);
  }
  ctx.lineTo(X(p.length - 3), Y(p.length - 3));
}

function drawInk(ctx: CanvasRenderingContext2D, e: El, theme: BoardTheme) {
  const p = e.pts;
  if (!p || p.length < 3) return;
  const s = e.sc || 1;
  ctx.strokeStyle = color(e.color, theme);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (e.hl) {
    ctx.globalAlpha *= theme === "light" ? 0.38 : 0.45;
    ctx.lineCap = "butt";
    ctx.lineWidth = e.size * s;
    inkPath(ctx, e);
    ctx.stroke();
    return;
  }
  if (!e.pr || p.length < 9) {
    ctx.lineWidth = e.size * s;
    inkPath(ctx, e);
    ctx.stroke();
    return;
  }
  // stylet : épaisseur selon la pression, segment par segment
  const X = (i: number) => e.x + p[i] * s;
  const Y = (i: number) => e.y + p[i + 1] * s;
  let mx = X(0),
    my = Y(0);
  for (let i = 3; i < p.length; i += 3) {
    const nx = i + 3 < p.length ? (X(i) + X(i + 3)) / 2 : X(i);
    const ny = i + 3 < p.length ? (Y(i) + Y(i + 3)) / 2 : Y(i);
    const pr = p[i + 2] || 0.5;
    ctx.lineWidth = e.size * s * (0.35 + pr * 1.1);
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.quadraticCurveTo(X(i), Y(i), nx, ny);
    ctx.stroke();
    mx = nx;
    my = ny;
  }
}

function arrowHead(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, size: number) {
  const len = Math.max(12, size * 3.6);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - len * Math.cos(ang - 0.45), y - len * Math.sin(ang - 0.45));
  ctx.lineTo(x - len * Math.cos(ang + 0.45), y - len * Math.sin(ang + 0.45));
  ctx.closePath();
  ctx.fill();
}

function drawShape(ctx: CanvasRenderingContext2D, e: El, theme: BoardTheme) {
  const c = color(e.color, theme);
  ctx.strokeStyle = c;
  ctx.fillStyle = c;
  ctx.lineWidth = e.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (e.dash) ctx.setLineDash([e.size * 2.5, e.size * 2]);
  const sh = e.shape;
  if (sh === "line" || sh === "arrow" || sh === "dline") {
    const ang = Math.atan2(e.h, e.w);
    const len = Math.max(12, e.size * 3.6) * 0.8;
    const x1 = e.x + e.w,
      y1 = e.y + e.h;
    const cut = sh === "line" ? 0 : Math.min(len, Math.hypot(e.w, e.h) / 2);
    ctx.beginPath();
    ctx.moveTo(e.x + (sh === "dline" ? cut * Math.cos(ang) : 0), e.y + (sh === "dline" ? cut * Math.sin(ang) : 0));
    ctx.lineTo(x1 - cut * Math.cos(ang), y1 - cut * Math.sin(ang));
    ctx.stroke();
    ctx.setLineDash([]);
    if (sh !== "line") arrowHead(ctx, x1, y1, ang, e.size);
    if (sh === "dline") arrowHead(ctx, e.x, e.y, ang + Math.PI, e.size);
    return;
  }
  ctx.beginPath();
  if (sh === "rect") {
    const r = Math.min(Math.abs(e.w), Math.abs(e.h)) * 0.06;
    (ctx as any).roundRect ? (ctx as any).roundRect(e.x, e.y, e.w, e.h, r) : ctx.rect(e.x, e.y, e.w, e.h);
  } else if (sh === "ellipse") {
    ctx.ellipse(e.x + e.w / 2, e.y + e.h / 2, Math.abs(e.w / 2), Math.abs(e.h / 2), 0, 0, Math.PI * 2);
  } else {
    const pp = polyPoints(e);
    ctx.moveTo(e.x + pp[0] * e.w, e.y + pp[1] * e.h);
    for (let i = 2; i < pp.length; i += 2) ctx.lineTo(e.x + pp[i] * e.w, e.y + pp[i + 1] * e.h);
    ctx.closePath();
  }
  if (e.fill) {
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * 0.2;
    ctx.fill();
    ctx.globalAlpha = a;
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawText(ctx: CanvasRenderingContext2D, e: El, theme: BoardTheme) {
  ctx.fillStyle = color(e.color, theme);
  ctx.font = `600 ${e.size}px ${FONT}`;
  ctx.textBaseline = "top";
  const rtl = isRtl(e.text);
  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textAlign = rtl ? "right" : "left";
  const lh = e.size * 1.25;
  (e.text || "").split("\n").forEach((l, i) => ctx.fillText(l, rtl ? e.x + e.w - 2 : e.x + 2, e.y + i * lh + e.size * 0.1));
  ctx.direction = "ltr";
  ctx.textAlign = "left";
}

function drawNote(ctx: CanvasRenderingContext2D, e: El) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.22)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = e.color;
  ctx.beginPath();
  const r = Math.min(e.w, e.h) * 0.04;
  (ctx as any).roundRect ? (ctx as any).roundRect(e.x, e.y, e.w, e.h, [r, r, r * 4, r]) : ctx.rect(e.x, e.y, e.w, e.h);
  ctx.fill();
  ctx.restore();
  // pli décoratif
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  ctx.fillRect(e.x, e.y, e.w, e.h * 0.09);
  const pad = e.w * 0.08;
  let size = e.size;
  ctx.fillStyle = NOTE_TEXT;
  ctx.textBaseline = "top";
  let lines: string[] = [];
  for (; size >= 9; size -= 1) {
    ctx.font = `600 ${size}px ${FONT}`;
    lines = wrap(ctx, e.text || "", e.w - pad * 2);
    if (lines.length * size * 1.3 <= e.h - pad * 2 - e.h * 0.09) break;
  }
  const rtl = isRtl(e.text);
  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textAlign = rtl ? "right" : "left";
  lines.forEach((l, i) => ctx.fillText(l, rtl ? e.x + e.w - pad : e.x + pad, e.y + e.h * 0.09 + pad * 0.8 + i * size * 1.3));
  ctx.direction = "ltr";
  ctx.textAlign = "left";
}

export function drawEl(ctx: CanvasRenderingContext2D, e: El, theme: BoardTheme, onImage: () => void, now = 0) {
  ctx.save();
  if (e.exp && now) {
    const left = e.exp - now;
    ctx.globalAlpha = Math.max(0, Math.min(1, left / 900));
  }
  if (e.k === "ink") drawInk(ctx, e, theme);
  else if (e.k === "shape") drawShape(ctx, e, theme);
  else if (e.k === "text") drawText(ctx, e, theme);
  else if (e.k === "note") drawNote(ctx, e);
  else if (e.k === "image" && e.src) {
    const img = imageFor(e.src, onImage);
    if (img.complete && img.naturalWidth) {
      ctx.drawImage(img, e.x, e.y, e.w, e.h);
    } else {
      ctx.fillStyle = "rgba(127,127,127,0.15)";
      ctx.fillRect(e.x, e.y, e.w, e.h);
    }
  }
  ctx.restore();
}

/** traînée lumineuse du pointeur laser */
export function drawLaser(ctx: CanvasRenderingContext2D, t: LaserTrail, now: number, z: number, hue = "#ff2d55") {
  const p = t.pts;
  if (p.length < 3) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 3; i < p.length; i += 3) {
    const age = (now - p[i + 2]) / LASER_MS;
    if (age >= 1) continue;
    const a = 1 - age;
    ctx.strokeStyle = hue;
    ctx.globalAlpha = a * 0.9;
    ctx.lineWidth = (2 + 5 * a) / z;
    ctx.shadowColor = hue;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(p[i - 3], p[i - 2]);
    ctx.lineTo(p[i], p[i + 1]);
    ctx.stroke();
  }
  const lx = p[p.length - 3],
    ly = p[p.length - 2];
  const age = (now - p[p.length - 1]) / LASER_MS;
  if (age < 1) {
    ctx.globalAlpha = 1 - age;
    ctx.fillStyle = "#fff";
    ctx.shadowColor = hue;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(lx, ly, 5 / z, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ reconnaissance de formes
function rdp(pts: [number, number][], eps: number): [number, number][] {
  if (pts.length < 3) return pts;
  let dmax = 0,
    idx = 0;
  const a = pts[0],
    b = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) {
    const d = distSeg(pts[i][0], pts[i][1], a[0], a[1], b[0], b[1]);
    if (d > dmax) {
      dmax = d;
      idx = i;
    }
  }
  if (dmax <= eps) return [a, b];
  const l = rdp(pts.slice(0, idx + 1), eps);
  const r = rdp(pts.slice(idx), eps);
  return l.slice(0, -1).concat(r);
}

/** Transforme un trait à main levée en forme propre (ligne, rectangle, ellipse, triangle…) */
export function recognize(e: El): El | null {
  const p = e.pts;
  if (!p || p.length < 3 * 8 || e.hl) return null;
  const pts: [number, number][] = [];
  for (let i = 0; i < p.length; i += 3) pts.push([e.x + p[i], e.y + p[i + 1]]);
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const xs = pts.map(q => q[0]),
    ys = pts.map(q => q[1]);
  const x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    y0 = Math.min(...ys),
    y1 = Math.max(...ys);
  const diag = Math.hypot(x1 - x0, y1 - y0);
  if (diag < 24) return null;
  const first = pts[0],
    last = pts[pts.length - 1];
  const gap = Math.hypot(last[0] - first[0], last[1] - first[1]);
  const base = { id: e.id + "s", by: e.by, k: "shape" as const, color: e.color, size: e.size };
  // ligne droite
  if (gap / len > 0.94) {
    let dx = last[0] - first[0],
      dy = last[1] - first[1];
    // aimantation horizontale / verticale
    const ang = Math.abs(Math.atan2(dy, dx));
    if (ang < 0.12 || Math.abs(ang - Math.PI) < 0.12) dy = 0;
    if (Math.abs(ang - Math.PI / 2) < 0.12) dx = 0;
    return { ...base, shape: "line", x: first[0], y: first[1], w: dx, h: dy };
  }
  if (gap > diag * 0.3) return null; // forme non fermée
  const w = x1 - x0,
    h = y1 - y0;
  // sommets de la forme fermée : simplification puis suppression des angles plats
  let simp = rdp(pts, diag * 0.06);
  if (simp.length > 2 && Math.hypot(simp[0][0] - simp[simp.length - 1][0], simp[0][1] - simp[simp.length - 1][1]) < diag * 0.2) simp = simp.slice(0, -1);
  for (let changed = true; changed && simp.length > 3; ) {
    changed = false;
    for (let i = 0; i < simp.length; i++) {
      const a = simp[(i - 1 + simp.length) % simp.length],
        b = simp[i],
        c = simp[(i + 1) % simp.length];
      const a1 = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const a2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
      let turn = Math.abs(a2 - a1);
      if (turn > Math.PI) turn = 2 * Math.PI - turn;
      const short = Math.hypot(b[0] - a[0], b[1] - a[1]) < diag * 0.08;
      if (turn < 0.45 || short) {
        simp.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  const corners = simp.length;
  // ellipse : distance au centre régulière
  const cx = x0 + w / 2,
    cy = y0 + h / 2;
  let err = 0;
  for (const [x, y] of pts) err += Math.abs(Math.hypot((x - cx) / (w / 2 || 1), (y - cy) / (h / 2 || 1)) - 1);
  err /= pts.length;
  if (corners >= 5 && err < 0.2) return { ...base, shape: "ellipse", x: x0, y: y0, w, h };
  if (corners === 3) {
    const tri = simp.slice(0, 3);
    return { ...base, shape: "poly", x: x0, y: y0, w, h, pts: tri.flatMap(([x, y]) => [(x - x0) / (w || 1), (y - y0) / (h || 1)]) };
  }
  if (corners === 4) {
    // rectangle si les côtés sont à peu près alignés aux axes, sinon quadrilatère (losange…)
    const quad = simp.slice(0, 4);
    let aligned = 0;
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = quad[i],
        [bx, by] = quad[(i + 1) % 4];
      const a = Math.abs(Math.atan2(by - ay, bx - ax)) % (Math.PI / 2);
      if (a < 0.25 || a > Math.PI / 2 - 0.25) aligned++;
    }
    if (aligned >= 3) return { ...base, shape: "rect", x: x0, y: y0, w, h };
    return { ...base, shape: "poly", x: x0, y: y0, w, h, pts: quad.flatMap(([x, y]) => [(x - x0) / (w || 1), (y - y0) / (h || 1)]) };
  }
  return null;
}

/** Rendu complet hors écran (export PNG, copie) */
export function renderToCanvas(els: El[], theme: BoardTheme, paper: Paper, box: Box, scale = 2, withBg = true) {
  const pad = 40;
  const W = Math.ceil((box.w + pad * 2) * scale);
  const H = Math.ceil((box.h + pad * 2) * scale);
  const max = 8192;
  const k = Math.min(1, max / Math.max(W, H));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.floor(W * k));
  c.height = Math.max(1, Math.floor(H * k));
  const ctx = c.getContext("2d")!;
  const z = scale * k;
  const cam = { x: box.x - pad, y: box.y - pad, z };
  if (withBg) drawPaper(ctx, theme, paper, cam, c.width, c.height);
  ctx.setTransform(z, 0, 0, z, -cam.x * z, -cam.y * z);
  for (const e of els) drawEl(ctx, e, theme, () => undefined);
  return c;
}

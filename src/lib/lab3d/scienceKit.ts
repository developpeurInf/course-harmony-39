/** Outils communs aux scènes de physique, chimie et SVT (repère maths : z vers le haut) */
import * as THREE from "three";
import type { Builder } from "./buildScene";
import type { Tri } from "./templates";

export type V = THREE.Vector3;
export const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export const T = (fr: string, ar: string, en: string): Tri => ({ fr, ar, en });
export const fmt = (n: number, d = 2) => {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a !== 0 && (a >= 1e5 || a < 1e-3)) {
    const e = Math.floor(Math.log10(a));
    return `${String(Math.round((n / 10 ** e) * 100) / 100).replace(".", ",")}×10^${e}`;
  }
  return String(Math.round(n * 10 ** d) / 10 ** d).replace(".", ",");
};
export const hex = (c: number) => "#" + c.toString(16).padStart(6, "0");
export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const N = (x: unknown, d = 0) => (Number.isFinite(Number(x)) ? Number(x) : d);

export function mat(B: Builder, color: number, o: { opacity?: number; emissive?: number; rough?: number; metal?: number; flat?: boolean } = {}) {
  const op = o.opacity ?? 1;
  return B.track(new THREE.MeshStandardMaterial({
    color, transparent: op < 1, opacity: op, depthWrite: op >= 0.95, side: THREE.DoubleSide,
    roughness: o.rough ?? 0.5, metalness: o.metal ?? 0.05, emissive: o.emissive ?? 0x000000, flatShading: !!o.flat,
  }));
}
export function ball(B: Builder, p: V, r: number, color: number | THREE.Material, parent: THREE.Object3D = B.m, seg = 20) {
  const m = new THREE.Mesh(B.track(new THREE.SphereGeometry(r, seg, Math.max(8, Math.round(seg * 0.7)))), typeof color === "number" ? mat(B, color) : color);
  m.position.copy(p);
  parent.add(m);
  return m;
}
/** cylindre entre deux points */
export function rod(B: Builder, a: V, b: V, r: number, color: number | THREE.Material, parent: THREE.Object3D = B.m, seg = 12) {
  const d = b.clone().sub(a);
  const len = d.length();
  const m = new THREE.Mesh(B.track(new THREE.CylinderGeometry(r, r, Math.max(len, 1e-4), seg)), typeof color === "number" ? mat(B, color) : color);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  if (len > 1e-6) m.quaternion.setFromUnitVectors(v3(0, 1, 0), d.normalize());
  parent.add(m);
  return m;
}
/** place un cylindre unitaire (hauteur 1) entre deux points (animation) */
export function placeRod(m: THREE.Object3D, a: V, b: V) {
  const d = b.clone().sub(a);
  const len = d.length();
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.scale.set(1, Math.max(len, 1e-4), 1);
  if (len > 1e-6) m.quaternion.setFromUnitVectors(v3(0, 1, 0), d.normalize());
}
export function unitRod(B: Builder, r: number, color: number | THREE.Material, parent: THREE.Object3D = B.m) {
  const m = new THREE.Mesh(B.track(new THREE.CylinderGeometry(r, r, 1, 12)), typeof color === "number" ? mat(B, color) : color);
  parent.add(m);
  return m;
}
export function box(B: Builder, c: V, sx: number, sy: number, sz: number, color: number | THREE.Material, parent: THREE.Object3D = B.m) {
  const m = new THREE.Mesh(B.track(new THREE.BoxGeometry(sx, sy, sz)), typeof color === "number" ? mat(B, color) : color);
  m.position.copy(c);
  parent.add(m);
  return m;
}
export function line(B: Builder, pts: V[], color: number, parent: THREE.Object3D = B.m, dashed = false) {
  const g = B.track(new THREE.BufferGeometry().setFromPoints(pts));
  const l = new THREE.Line(g, dashed ? B.dashMat(color, B.labelSize * 0.4) : B.lineMat(color));
  if (dashed) l.computeLineDistances();
  parent.add(l);
  return l;
}
/** ligne dont on remplace les points à chaque image */
export function liveLine(B: Builder, max: number, color: number, parent: THREE.Object3D = B.m) {
  const g = B.track(new THREE.BufferGeometry());
  const arr = new Float32Array(max * 3);
  g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
  g.setDrawRange(0, 0);
  const l = new THREE.Line(g, B.lineMat(color));
  l.frustumCulled = false;
  parent.add(l);
  return {
    obj: l,
    set(pts: V[]) {
      const n = Math.min(max, pts.length);
      for (let i = 0; i < n; i++) { arr[i * 3] = pts[i].x; arr[i * 3 + 1] = pts[i].y; arr[i * 3 + 2] = pts[i].z; }
      g.setDrawRange(0, n);
      (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    },
  };
}
/** flèche modifiable à chaque image */
export function liveArrow(B: Builder, color: number, parent: THREE.Object3D = B.m) {
  const a = new THREE.ArrowHelper(v3(1, 0, 0), v3(0, 0, 0), 1, color);
  B.track(a.line.geometry); B.track(a.cone.geometry);
  parent.add(a);
  return {
    obj: a,
    set(from: V, vec: V) {
      const len = vec.length();
      a.visible = len > 1e-4;
      if (!a.visible) return;
      a.position.copy(from);
      a.setDirection(vec.clone().normalize());
      const head = Math.min(len * 0.3, B.labelSize * 0.8);
      a.setLength(len, head, head * 0.6);
    },
  };
}
/** étiquette dont le texte change */
export function liveLabel(B: Builder, p: V, opts: { color?: string; scale?: number; parent?: THREE.Object3D; width?: number } = {}) {
  const canvas = document.createElement("canvas");
  const fontPx = 56;
  canvas.width = opts.width || 640;
  canvas.height = fontPx + 24;
  const ctx = canvas.getContext("2d")!;
  const tex = B.track(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  const sm = B.track(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  const s = new THREE.Sprite(sm);
  const h = B.labelSize * (opts.scale || 1);
  s.scale.set((h * canvas.width) / canvas.height, h, 1);
  s.center.set(0, 0.5);
  s.position.copy(p);
  s.renderOrder = 11;
  (opts.parent || B.m).add(s);
  let last = "";
  return {
    obj: s,
    set(text: string) {
      if (text === last) return;
      last = text;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = `600 ${fontPx}px system-ui, sans-serif`;
      const w = Math.min(canvas.width, ctx.measureText(text).width + 28);
      ctx.fillStyle = B.pal.textBg;
      ctx.fillRect(0, 0, w, canvas.height);
      ctx.fillStyle = opts.color || B.pal.text;
      ctx.textBaseline = "middle";
      ctx.fillText(text, 14, canvas.height / 2 + 2);
      tex.needsUpdate = true;
    },
  };
}
/** étiquette reliée à un point par un trait */
export function tag(B: Builder, text: string, at: V, labelPos: V, color?: string, parent: THREE.Object3D = B.m) {
  line(B, [at, labelPos], B.pal.dashed, parent);
  B.label(text, labelPos, { color, scale: 0.85, parent });
}

/** Graphique 2D dessiné dans le plan vertical (x, z) */
export interface Plot { map: (x: number, y: number) => V; curve: (f: (x: number) => number, color: number, n?: number, dashed?: boolean) => void; points: (pts: [number, number][], color: number) => void; cursor: (color?: number) => { set: (x: number, y: number) => void } }
export function plot(B: Builder, o: { origin: V; w: number; h: number; xmax: number; ymin: number; ymax: number; xlabel: string; ylabel: string; xticks?: number; yticks?: number; xmin?: number }): Plot {
  const xmin = o.xmin ?? 0;
  const map = (x: number, y: number) => v3(o.origin.x + ((x - xmin) / (o.xmax - xmin)) * o.w, o.origin.y, o.origin.z + ((clamp(y, o.ymin - (o.ymax - o.ymin) * 0.05, o.ymax + (o.ymax - o.ymin) * 0.05) - o.ymin) / (o.ymax - o.ymin)) * o.h);
  const light = B.pal.textBg.startsWith("rgba(255");
  const bg = new THREE.Mesh(B.track(new THREE.PlaneGeometry(o.w * 1.12, o.h * 1.2)), B.track(new THREE.MeshBasicMaterial({ color: light ? 0xffffff : 0x161a2c, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })));
  bg.rotation.x = Math.PI / 2;
  bg.position.set(o.origin.x + o.w / 2, o.origin.y + 0.02, o.origin.z + o.h / 2);
  B.m.add(bg);
  const y0 = o.ymin <= 0 && o.ymax >= 0 ? 0 : o.ymin;
  B.arrow(map(xmin, y0), map(xmin + (o.xmax - xmin) * 1.06, y0), B.pal.edge);
  B.arrow(map(xmin, o.ymin), map(xmin, o.ymax + (o.ymax - o.ymin) * 0.12), B.pal.edge);
  B.label(o.xlabel, map(xmin + (o.xmax - xmin) * 1.08, y0), { scale: 0.7, offset: v3(0, 0, -B.labelSize * 0.6) });
  B.label(o.ylabel, map(xmin, o.ymax + (o.ymax - o.ymin) * 0.18), { scale: 0.7 });
  const xt = o.xticks ?? 4, yt = o.yticks ?? 4;
  const grid: [V, V][] = [];
  for (let i = 1; i <= xt; i++) {
    const x = xmin + ((o.xmax - xmin) * i) / xt;
    grid.push([map(x, o.ymin), map(x, o.ymax)]);
    B.label(fmt(x, 2), map(x, y0), { scale: 0.5, offset: v3(0, 0, -B.labelSize * 0.45) });
  }
  for (let i = 0; i <= yt; i++) {
    const y = o.ymin + ((o.ymax - o.ymin) * i) / yt;
    grid.push([map(xmin, y), map(o.xmax, y)]);
    B.label(fmt(y, 2), map(xmin, y), { scale: 0.5, offset: v3(-B.labelSize * 0.9, 0, 0) });
  }
  const gl = B.segments(grid, B.track(new THREE.LineBasicMaterial({ color: B.pal.dashed, transparent: true, opacity: 0.25 })));
  gl.renderOrder = 1;
  return {
    map,
    curve(f, color, n = 240, dashed = false) {
      const pts: V[] = [];
      for (let i = 0; i <= n; i++) { const x = xmin + ((o.xmax - xmin) * i) / n; const y = f(x); if (Number.isFinite(y)) pts.push(map(x, y)); }
      line(B, pts, color, B.m, dashed);
    },
    points(pts, color) { line(B, pts.map(([x, y]) => map(x, y)), color); },
    cursor(color = B.pal.accent) {
      const d = ball(B, v3(0, 0, 0), B.labelSize * 0.18, color);
      return { set: (x: number, y: number) => d.position.copy(map(x, y)) };
    },
  };
}

/** Barres d'énergie (Ec, Ep, Em) */
export function energyBars(B: Builder, origin: V, height: number, names = ["Ec", "Ep", "Em"]) {
  const cols = [0xe8590c, 0x1c7ed6, 0x2f9e44];
  const w = B.labelSize * 0.9;
  const bars = cols.map((c, i) => {
    const m = box(B, v3(origin.x + i * w * 1.6, origin.y, origin.z), w, w, 1, c);
    B.label(names[i], v3(origin.x + i * w * 1.6, origin.y, origin.z - B.labelSize * 0.7), { scale: 0.7, color: hex(c) });
    return m;
  });
  line(B, [v3(origin.x - w, origin.y, origin.z + height), v3(origin.x + 4 * w, origin.y, origin.z + height)], B.pal.dashed, B.m, true);
  return (vals: number[], max: number) => vals.forEach((v, i) => {
    const h = Math.max(1e-3, (v / (max || 1)) * height);
    bars[i].scale.z = h;
    bars[i].position.z = origin.z + h / 2;
  });
}

/** générateur pseudo-aléatoire reproductible */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** sol / table */
export function ground(B: Builder, cx: number, cy: number, w: number, d: number, z = 0, color = 0x868e96) {
  const g = new THREE.Mesh(B.track(new THREE.PlaneGeometry(w, d)), mat(B, color, { opacity: 0.35 }));
  g.position.set(cx, cy, z);
  B.m.add(g);
  return g;
}

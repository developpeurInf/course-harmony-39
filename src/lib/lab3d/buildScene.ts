/**
 * Construction des scènes du Labo 3D avec three.js.
 * Tout est construit en coordonnées « maths » (z vers le haut) dans un groupe tourné
 * de −90° autour de x : (x, y, z) maths → (x, z, −y) three.js.
 */
import * as THREE from "three";
import { compileExpr } from "./mathExpr";
import { SCIENCE_BUILDERS } from "./buildSciences";
import type { Params, Tri } from "./templates";

export interface InfoLine { label: Tri; value: string }
export interface BuiltScene {
  root: THREE.Group;
  info: InfoLine[];
  error?: string;
  /** animation : t = temps simulé en secondes */
  update?: (t: number) => void;
  dispose: () => void;
}

const T = (fr: string, ar: string, en: string): Tri => ({ fr, ar, en });
type V = THREE.Vector3;
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const fmt = (n: number, d = 2) => (Number.isFinite(n) ? String(Math.round(n * 10 ** d) / 10 ** d).replace(".", ",") : "—");

export interface Palette { face: number; edge: number; accent: number; section: number; text: string; textBg: string; dashed: number }
export const palette = (dark: boolean): Palette => dark
  ? { face: 0x6d8cff, edge: 0xe8ecff, accent: 0xffb547, section: 0xff5c8a, text: "#ffffff", textBg: "rgba(20,24,40,0.75)", dashed: 0xb7c0e0 }
  : { face: 0x3b5bdb, edge: 0x1c2240, accent: 0xe8590c, section: 0xd6336c, text: "#111827", textBg: "rgba(255,255,255,0.85)", dashed: 0x5c677d };

export class Builder {
  root = new THREE.Group();
  m = new THREE.Group(); // repère maths
  info: InfoLine[] = [];
  private disposables: { dispose: () => void }[] = [];
  labelSize = 0.35;
  updaters: ((t: number) => void)[] = [];
  onFrame(f: (t: number) => void) { this.updaters.push(f); }
  constructor(public pal: Palette) {
    this.m.rotation.x = -Math.PI / 2;
    this.root.add(this.m);
  }
  track<Tp extends { dispose: () => void }>(x: Tp): Tp { this.disposables.push(x); return x; }
  dispose() { this.disposables.forEach((d) => d.dispose()); }

  faceMat(color = this.pal.face, opacity = 0.35) {
    return this.track(new THREE.MeshStandardMaterial({
      color, transparent: opacity < 1, opacity, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.05,
      depthWrite: opacity >= 0.95, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    }));
  }
  lineMat(color = this.pal.edge) { return this.track(new THREE.LineBasicMaterial({ color })); }
  dashMat(color = this.pal.dashed, size = 0.15) { return this.track(new THREE.LineDashedMaterial({ color, dashSize: size, gapSize: size * 0.8 })); }

  segments(pairs: [V, V][], mat: THREE.LineBasicMaterial | THREE.LineDashedMaterial, parent: THREE.Object3D = this.m) {
    const g = this.track(new THREE.BufferGeometry().setFromPoints(pairs.flat()));
    const l = new THREE.LineSegments(g, mat);
    if (mat instanceof THREE.LineDashedMaterial) l.computeLineDistances();
    parent.add(l);
    return l;
  }
  polygon(pts: V[], mat: THREE.Material, parent: THREE.Object3D = this.m) {
    if (pts.length < 3) return null;
    const pos: number[] = [];
    for (let i = 1; i < pts.length - 1; i++) [pts[0], pts[i], pts[i + 1]].forEach((p) => pos.push(p.x, p.y, p.z));
    const g = this.track(new THREE.BufferGeometry());
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, mat);
    parent.add(mesh);
    return mesh;
  }
  dot(p: V, color = this.pal.accent, r = this.labelSize * 0.22, parent: THREE.Object3D = this.m) {
    const g = this.track(new THREE.SphereGeometry(r, 16, 12));
    const s = new THREE.Mesh(g, this.track(new THREE.MeshStandardMaterial({ color })));
    s.position.copy(p);
    parent.add(s);
    return s;
  }
  label(text: string, p: V, opts: { color?: string; scale?: number; parent?: THREE.Object3D; offset?: V } = {}) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const fontPx = 64;
    ctx.font = `600 ${fontPx}px system-ui, sans-serif`;
    const w = Math.ceil(ctx.measureText(text).width) + 28;
    canvas.width = w;
    canvas.height = fontPx + 24;
    ctx.font = `600 ${fontPx}px system-ui, sans-serif`;
    ctx.fillStyle = this.pal.textBg;
    const r = 18;
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.lineTo(w - r, 0); ctx.quadraticCurveTo(w, 0, w, r); ctx.lineTo(w, canvas.height - r);
    ctx.quadraticCurveTo(w, canvas.height, w - r, canvas.height); ctx.lineTo(r, canvas.height); ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - r);
    ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0); ctx.fill();
    ctx.fillStyle = opts.color || this.pal.text;
    ctx.textBaseline = "middle";
    ctx.fillText(text, 14, canvas.height / 2 + 2);
    const tex = this.track(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = this.track(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    const s = new THREE.Sprite(mat);
    const h = this.labelSize * (opts.scale || 1);
    s.scale.set((h * canvas.width) / canvas.height, h, 1);
    s.position.copy(p).add(opts.offset || v3(0, 0, 0));
    s.renderOrder = 10;
    (opts.parent || this.m).add(s);
    return s;
  }
  arrow(from: V, to: V, color: number, parent: THREE.Object3D = this.m) {
    const dir = to.clone().sub(from);
    const len = dir.length();
    if (len < 1e-6) return null;
    const head = Math.min(len * 0.25, this.labelSize * 0.9);
    const a = new THREE.ArrowHelper(dir.normalize(), from, len, color, head, head * 0.55);
    this.track(a.line.geometry); this.track(a.cone.geometry);
    parent.add(a);
    return a;
  }
  axes(len: number) {
    const cols = [0xe03131, 0x2f9e44, 0x1c7ed6];
    const names = ["x", "y", "z"];
    [v3(1, 0, 0), v3(0, 1, 0), v3(0, 0, 1)].forEach((d, i) => {
      this.arrow(d.clone().multiplyScalar(-len * 0.25), d.clone().multiplyScalar(len), cols[i]);
      this.label(names[i], d.clone().multiplyScalar(len * 1.08), { color: "#" + cols[i].toString(16).padStart(6, "0") });
    });
    this.label("O", v3(-0.25, -0.25, -0.25).multiplyScalar(this.labelSize * 2), { scale: 0.8 });
  }
  gridXY(size: number, div: number) {
    const g = new THREE.GridHelper(size, div, this.pal.dashed, this.pal.dashed);
    (g.material as THREE.Material).transparent = true;
    (g.material as THREE.Material).opacity = 0.35;
    this.track(g.geometry); this.track(g.material as THREE.Material);
    g.rotation.x = Math.PI / 2; // plan (x, y) du repère maths
    this.m.add(g);
  }
}

// ---------------------------------------------------------------------
// Polyèdres : sommets nommés + faces
// ---------------------------------------------------------------------
interface Poly { v: Record<string, V>; faces: string[][] }
const edgesOf = (p: Poly) => {
  const seen = new Set<string>();
  const out: [string, string][] = [];
  p.faces.forEach((f) => f.forEach((a, i) => {
    const b = f[(i + 1) % f.length];
    const k = [a, b].sort().join("-");
    if (!seen.has(k)) { seen.add(k); out.push([a, b]); }
  }));
  return out;
};

/** Section d'un polyèdre convexe par le plan n·p = d */
function convexSection(p: Poly, n: V, d: number): V[] {
  const pts: V[] = [];
  const add = (q: V) => { if (!pts.some((x) => x.distanceTo(q) < 1e-6)) pts.push(q); };
  for (const [a, b] of edgesOf(p)) {
    const A = p.v[a], B = p.v[b];
    const da = n.dot(A) - d, db = n.dot(B) - d;
    if (Math.abs(da) < 1e-9) add(A.clone());
    if (Math.abs(db) < 1e-9) add(B.clone());
    if (da * db < 0) add(A.clone().lerp(B, da / (da - db)));
  }
  if (pts.length < 3) return [];
  const c = pts.reduce((s, q) => s.add(q), v3(0, 0, 0)).multiplyScalar(1 / pts.length);
  const u = pts[0].clone().sub(c).normalize();
  const w = n.clone().normalize().cross(u);
  return pts.sort((P, Q) => Math.atan2(P.clone().sub(c).dot(w), P.clone().sub(c).dot(u)) - Math.atan2(Q.clone().sub(c).dot(w), Q.clone().sub(c).dot(u)));
}
const polyArea = (pts: V[]) => {
  const s = v3(0, 0, 0);
  for (let i = 1; i < pts.length - 1; i++) s.add(pts[i].clone().sub(pts[0]).cross(pts[i + 1].clone().sub(pts[0])));
  return s.length() / 2;
};
const planeFrom3 = (a: V, b: V, c: V) => {
  const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
  return { n, d: n.dot(a) };
};

function drawPoly(B: Builder, p: Poly, prm: Params) {
  const op = Number(prm.opacity ?? 0.35);
  p.faces.forEach((f) => B.polygon(f.map((k) => p.v[k]), B.faceMat(B.pal.face, op)));
  B.segments(edgesOf(p).map(([a, b]) => [p.v[a], p.v[b]]), B.lineMat());
  if (prm.labels !== false) {
    const c = Object.values(p.v).reduce((s, q) => s.add(q), v3(0, 0, 0)).multiplyScalar(1 / Object.keys(p.v).length);
    Object.entries(p.v).forEach(([k, q]) => B.label(k, q.clone().add(q.clone().sub(c).normalize().multiplyScalar(B.labelSize * 0.9))));
  }
}
function drawSection(B: Builder, p: Poly, n: V, d: number, name: Tri) {
  const pts = convexSection(p, n, d);
  if (pts.length < 3) return;
  B.polygon(pts, B.faceMat(B.pal.section, 0.65));
  B.segments(pts.map((q, i) => [q, pts[(i + 1) % pts.length]] as [V, V]), B.lineMat(B.pal.section));
  B.info.push({ label: name, value: `${pts.length} ${pts.length === 3 ? "côtés (triangle)" : pts.length === 4 ? "côtés (quadrilatère)" : pts.length === 6 ? "côtés (hexagone)" : "côtés"} · aire ≈ ${fmt(polyArea(pts))}` });
}

// ---------------------------------------------------------------------
// Patrons qui se plient (pavé / cube, pyramide)
// ---------------------------------------------------------------------
function hingedFace(B: Builder, local: V[], mat: THREE.Material, edgeMat: THREE.LineBasicMaterial) {
  const g = new THREE.Group();
  B.polygon(local, mat, g);
  B.segments(local.map((q, i) => [q, local[(i + 1) % local.length]] as [V, V]), edgeMat, g);
  return g;
}
const FACE_COLORS = [0x4c6ef5, 0x12b886, 0xfab005, 0xfa5252, 0x7950f2, 0x15aabf];

function cuboidNet(B: Builder, L: number, l: number, h: number, t: number) {
  const em = B.lineMat();
  const fm = (i: number) => B.faceMat(FACE_COLORS[i % 6], 0.85);
  const base = hingedFace(B, [v3(-L / 2, -l / 2, 0), v3(L / 2, -l / 2, 0), v3(L / 2, l / 2, 0), v3(-L / 2, l / 2, 0)], fm(0), em);
  B.m.add(base);
  const sides = [{ len: L, dist: l / 2 }, { len: l, dist: L / 2 }, { len: L, dist: l / 2 }, { len: l, dist: L / 2 }];
  sides.forEach((s, k) => {
    const holder = new THREE.Group();
    holder.rotation.z = (k * Math.PI) / 2;
    const pivot = new THREE.Group();
    pivot.position.set(0, -s.dist, 0);
    const rot = new THREE.Group();
    rot.rotation.x = -t * (Math.PI / 2);
    rot.add(hingedFace(B, [v3(-s.len / 2, 0, 0), v3(s.len / 2, 0, 0), v3(s.len / 2, -h, 0), v3(-s.len / 2, -h, 0)], fm(k + 1), em));
    if (k === 2) { // couvercle, attaché à la face arrière
      const lidPivot = new THREE.Group();
      lidPivot.position.set(0, -h, 0);
      const lidRot = new THREE.Group();
      lidRot.rotation.x = -t * (Math.PI / 2);
      lidRot.add(hingedFace(B, [v3(-L / 2, 0, 0), v3(L / 2, 0, 0), v3(L / 2, -l, 0), v3(-L / 2, -l, 0)], fm(5), em));
      lidPivot.add(lidRot);
      rot.add(lidPivot);
    }
    pivot.add(rot);
    holder.add(pivot);
    B.m.add(holder);
  });
}

function pyramidNet(B: Builder, a: number, h: number, t: number) {
  const em = B.lineMat();
  const s = Math.sqrt(h * h + (a / 2) ** 2);
  const theta = Math.atan2(h, a / 2);
  B.m.add(hingedFace(B, [v3(-a / 2, -a / 2, 0), v3(a / 2, -a / 2, 0), v3(a / 2, a / 2, 0), v3(-a / 2, a / 2, 0)], B.faceMat(FACE_COLORS[0], 0.85), em));
  for (let k = 0; k < 4; k++) {
    const holder = new THREE.Group();
    holder.rotation.z = (k * Math.PI) / 2;
    const pivot = new THREE.Group();
    pivot.position.set(0, -a / 2, 0);
    const rot = new THREE.Group();
    rot.rotation.x = -t * (Math.PI - theta);
    rot.add(hingedFace(B, [v3(-a / 2, 0, 0), v3(a / 2, 0, 0), v3(0, -s, 0)], B.faceMat(FACE_COLORS[k + 1], 0.85), em));
    pivot.add(rot);
    holder.add(pivot);
    B.m.add(holder);
  }
}

// ---------------------------------------------------------------------
// Modèles
// ---------------------------------------------------------------------
function cuboid(B: Builder, L: number, l: number, h: number, prm: Params, cube: boolean) {
  const x0 = -L / 2, y0 = -l / 2;
  const P: Poly = {
    v: {
      A: v3(x0, y0, 0), B: v3(x0 + L, y0, 0), C: v3(x0 + L, y0 + l, 0), D: v3(x0, y0 + l, 0),
      E: v3(x0, y0, h), F: v3(x0 + L, y0, h), G: v3(x0 + L, y0 + l, h), H: v3(x0, y0 + l, h),
    },
    faces: [["A", "B", "C", "D"], ["E", "F", "G", "H"], ["A", "B", "F", "E"], ["B", "C", "G", "F"], ["C", "D", "H", "G"], ["D", "A", "E", "H"]],
  };
  const vol = L * l * h, area = 2 * (L * l + L * h + l * h), diag = Math.sqrt(L * L + l * l + h * h);
  B.info.push({ label: T("Volume", "الحجم", "Volume"), value: cube ? `a³ = ${fmt(vol)}` : `L × l × h = ${fmt(vol)}` });
  B.info.push({ label: T("Aire totale", "المساحة الكلية", "Total area"), value: cube ? `6a² = ${fmt(area)}` : fmt(area) });
  B.info.push({ label: T("Diagonale [AG]", "القطر [AG]", "Diagonal [AG]"), value: cube ? `a√3 ≈ ${fmt(diag)}` : `√(L² + l² + h²) ≈ ${fmt(diag)}` });

  if (prm.net) {
    cuboidNet(B, L, l, h, Number(prm.fold ?? 1));
    return;
  }
  drawPoly(B, P, prm);
  if (prm.diagonals) {
    B.segments([[P.v.A, P.v.G]], B.lineMat(B.pal.accent));
    if (cube) B.segments([[P.v.B, P.v.H]], B.lineMat(B.pal.accent));
    B.label(`AG ≈ ${fmt(diag)}`, P.v.A.clone().lerp(P.v.G, 0.5), { color: "#e8590c", scale: 0.8 });
  }
  const sec = String(prm.section || "none");
  if (cube && sec !== "none") {
    const v = P.v;
    if (sec === "triangle") { const pl = planeFrom3(v.B, v.D, v.E); drawSection(B, P, pl.n, pl.d, T("Section (BDE)", "المقطع (BDE)", "Section (BDE)")); }
    if (sec === "rectangle") { const pl = planeFrom3(v.A, v.B, v.G); drawSection(B, P, pl.n, pl.d, T("Section (ABGH)", "المقطع (ABGH)", "Section (ABGH)")); }
    if (sec === "hexagon") {
      const n = v.G.clone().sub(v.A).normalize();
      const c = v.A.clone().lerp(v.G, 0.5);
      drawSection(B, P, n, n.dot(c), T("Section perpendiculaire à (AG) en son milieu", "المقطع العمودي على (AG)", "Section perpendicular to (AG)"));
    }
  }
  const k = Number(prm.sectionH || 0);
  if (k > 0 && k < h) drawSection(B, P, v3(0, 0, 1), k, T(`Section à z = ${fmt(k)}`, `المقطع عند z = ${fmt(k)}`, `Section at z = ${fmt(k)}`));
}

function pyramid(B: Builder, prm: Params) {
  const a = Number(prm.a), h = Number(prm.h);
  const P: Poly = {
    v: { A: v3(-a / 2, -a / 2, 0), B: v3(a / 2, -a / 2, 0), C: v3(a / 2, a / 2, 0), D: v3(-a / 2, a / 2, 0), S: v3(0, 0, h) },
    faces: [["A", "B", "C", "D"], ["A", "B", "S"], ["B", "C", "S"], ["C", "D", "S"], ["D", "A", "S"]],
  };
  const ap = Math.sqrt(h * h + (a / 2) ** 2), lat = Math.sqrt(h * h + (a * a) / 2);
  B.info.push({ label: T("Volume", "الحجم", "Volume"), value: `a² × h / 3 = ${fmt((a * a * h) / 3)}` });
  B.info.push({ label: T("Apothème SI", "العامد SI", "Apothem SI"), value: `√(h² + (a/2)²) ≈ ${fmt(ap)}` });
  B.info.push({ label: T("Arête latérale SA", "الحرف الجانبي SA", "Lateral edge SA"), value: `√(h² + a²/2) ≈ ${fmt(lat)}` });
  B.info.push({ label: T("Aire latérale", "المساحة الجانبية", "Lateral area"), value: `2 × a × SI ≈ ${fmt(2 * a * ap)}` });
  if (prm.net) {
    pyramidNet(B, a, h, Number(prm.fold ?? 1));
    return;
  }
  drawPoly(B, P, prm);
  if (prm.height) {
    const O = v3(0, 0, 0), I = v3(0, -a / 2, 0);
    B.segments([[P.v.S, O]], B.dashMat(B.pal.accent));
    B.segments([[P.v.S, I], [O, I]], B.dashMat());
    B.dot(O); B.label("O", O, { offset: v3(B.labelSize * 0.6, B.labelSize * 0.6, 0), scale: 0.8 });
    B.dot(I); B.label("I", I, { offset: v3(0, -B.labelSize * 0.8, 0), scale: 0.8 });
    B.label(`h = ${fmt(h)}`, v3(0, 0, h / 2), { offset: v3(B.labelSize * 1.2, 0, 0), color: "#e8590c", scale: 0.75 });
  }
  const k = Number(prm.sectionH || 0);
  if (k > 0 && k < h) {
    drawSection(B, P, v3(0, 0, 1), k, T(`Section à z = ${fmt(k)}`, `المقطع عند z = ${fmt(k)}`, `Section at z = ${fmt(k)}`));
    const ratio = 1 - k / h;
    B.info.push({ label: T("Réduction de rapport k", "تصغير بنسبة k", "Reduction ratio k"), value: `k = ${fmt(ratio)} · volume × k³ = ${fmt((a * a * h) / 3 * ratio ** 3)}` });
  }
}

function tetrahedron(B: Builder, prm: Params) {
  const a = Number(prm.a);
  const R = a / Math.sqrt(3), H = a * Math.sqrt(2 / 3);
  const ang = (d: number) => (d * Math.PI) / 180;
  const P: Poly = {
    v: { A: v3(R * Math.cos(ang(210)), R * Math.sin(ang(210)), 0), B: v3(R * Math.cos(ang(330)), R * Math.sin(ang(330)), 0), C: v3(R * Math.cos(ang(90)), R * Math.sin(ang(90)), 0), D: v3(0, 0, H) },
    faces: [["A", "B", "C"], ["A", "B", "D"], ["B", "C", "D"], ["C", "A", "D"]],
  };
  drawPoly(B, P, prm);
  B.info.push({ label: T("Hauteur", "الارتفاع", "Height"), value: `a√(2/3) ≈ ${fmt(H)}` });
  B.info.push({ label: T("Volume", "الحجم", "Volume"), value: `a³√2 / 12 ≈ ${fmt((a ** 3 * Math.SQRT2) / 12)}` });
  if (prm.height) {
    const G = v3(0, 0, 0);
    B.segments([[P.v.D, G]], B.dashMat(B.pal.accent));
    B.dot(G); B.label("G", G, { offset: v3(B.labelSize * 0.6, 0, -B.labelSize * 0.3), scale: 0.8 });
  }
  const k = Number(prm.sectionH || 0);
  if (k > 0 && k < H) drawSection(B, P, v3(0, 0, 1), k, T(`Section à z = ${fmt(k)}`, `المقطع عند z = ${fmt(k)}`, `Section at z = ${fmt(k)}`));
}

function prism(B: Builder, prm: Params) {
  const a = Number(prm.a), h = Number(prm.h);
  const R = a / Math.sqrt(3);
  const ang = (d: number) => (d * Math.PI) / 180;
  const b = (d: number, z: number) => v3(R * Math.cos(ang(d)), R * Math.sin(ang(d)), z);
  const P: Poly = {
    v: { A: b(210, 0), B: b(330, 0), C: b(90, 0), D: b(210, h), E: b(330, h), F: b(90, h) },
    faces: [["A", "B", "C"], ["D", "E", "F"], ["A", "B", "E", "D"], ["B", "C", "F", "E"], ["C", "A", "D", "F"]],
  };
  drawPoly(B, P, prm);
  const base = (Math.sqrt(3) / 4) * a * a;
  B.info.push({ label: T("Aire de la base", "مساحة القاعدة", "Base area"), value: `a²√3 / 4 ≈ ${fmt(base)}` });
  B.info.push({ label: T("Volume", "الحجم", "Volume"), value: `B × h ≈ ${fmt(base * h)}` });
  const k = Number(prm.sectionH || 0);
  if (k > 0 && k < h) drawSection(B, P, v3(0, 0, 1), k, T(`Section à z = ${fmt(k)}`, `المقطع عند z = ${fmt(k)}`, `Section at z = ${fmt(k)}`));
}

function circleLine(B: Builder, r: number, z: number, color: number) {
  const pts: V[] = [];
  for (let i = 0; i <= 96; i++) { const t = (i / 96) * Math.PI * 2; pts.push(v3(r * Math.cos(t), r * Math.sin(t), z)); }
  const g = B.track(new THREE.BufferGeometry().setFromPoints(pts));
  B.m.add(new THREE.Line(g, B.lineMat(color)));
}
function disc(B: Builder, r: number, z: number, color: number, opacity: number) {
  const g = B.track(new THREE.CircleGeometry(r, 64));
  const mesh = new THREE.Mesh(g, B.faceMat(color, opacity));
  mesh.position.z = z;
  B.m.add(mesh);
}

function revolution(B: Builder, kind: "cylinder" | "cone", prm: Params) {
  const r = Number(prm.r), h = Number(prm.h), op = Number(prm.opacity ?? 0.45);
  const geo = B.track(kind === "cylinder" ? new THREE.CylinderGeometry(r, r, h, 64, 1, true) : new THREE.ConeGeometry(r, h, 64, 1, true));
  const mesh = new THREE.Mesh(geo, B.faceMat(B.pal.face, op));
  mesh.rotation.x = Math.PI / 2; // axe des y three.js → axe z maths
  mesh.position.z = h / 2;
  B.m.add(mesh);
  circleLine(B, r, 0, B.pal.edge);
  disc(B, r, 0, B.pal.face, op * 0.8);
  if (kind === "cylinder") { circleLine(B, r, h, B.pal.edge); disc(B, r, h, B.pal.face, op * 0.8); }
  const g = Math.sqrt(r * r + h * h);
  if (kind === "cylinder") {
    B.info.push({ label: T("Volume", "الحجم", "Volume"), value: `π r² h ≈ ${fmt(Math.PI * r * r * h)}` });
    B.info.push({ label: T("Aire latérale", "المساحة الجانبية", "Lateral area"), value: `2π r h ≈ ${fmt(2 * Math.PI * r * h)}` });
  } else {
    B.info.push({ label: T("Volume", "الحجم", "Volume"), value: `π r² h / 3 ≈ ${fmt((Math.PI * r * r * h) / 3)}` });
    B.info.push({ label: T("Génératrice", "المولد", "Slant height"), value: `√(r² + h²) ≈ ${fmt(g)}` });
    B.info.push({ label: T("Aire latérale", "المساحة الجانبية", "Lateral area"), value: `π r g ≈ ${fmt(Math.PI * r * g)}` });
  }
  if (prm.axis) {
    const O = v3(0, 0, 0), top = v3(0, 0, h), M = v3(r, 0, 0);
    B.segments([[O, top]], B.dashMat(B.pal.accent));
    B.segments([[O, M]], B.lineMat(B.pal.accent));
    B.label(`r = ${fmt(r)}`, O.clone().lerp(M, 0.5), { offset: v3(0, -B.labelSize, 0), scale: 0.75, color: "#e8590c" });
    B.label(`h = ${fmt(h)}`, v3(0, 0, h / 2), { offset: v3(-B.labelSize * 1.4, 0, 0), scale: 0.75, color: "#e8590c" });
    if (kind === "cone") { B.segments([[M, top]], B.lineMat(B.pal.accent)); B.label("S", top, { offset: v3(0, 0, B.labelSize * 0.8) }); }
  }
  const k = Number(prm.sectionH || 0);
  if (k > 0 && k < h) {
    const rk = kind === "cylinder" ? r : r * (1 - k / h);
    disc(B, rk, k, B.pal.section, 0.6);
    circleLine(B, rk, k, B.pal.section);
    B.info.push({ label: T(`Section à z = ${fmt(k)}`, `المقطع عند z = ${fmt(k)}`, `Section at z = ${fmt(k)}`), value: `${kind === "cylinder" ? "disque de rayon r" : "disque de rayon r(1 − z/h)"} = ${fmt(rk)} · aire ≈ ${fmt(Math.PI * rk * rk)}` });
  }
}

function sphere(B: Builder, prm: Params) {
  const r = Number(prm.r), d = Math.min(Number(prm.d), r), op = Number(prm.opacity ?? 0.3);
  const geo = B.track(new THREE.SphereGeometry(r, 64, 48));
  B.m.add(new THREE.Mesh(geo, B.faceMat(B.pal.face, op)));
  const wire = B.track(new THREE.WireframeGeometry(B.track(new THREE.SphereGeometry(r, 16, 12))));
  const wl = new THREE.LineSegments(wire, B.track(new THREE.LineBasicMaterial({ color: B.pal.edge, transparent: true, opacity: 0.12 })));
  B.m.add(wl);
  circleLine(B, r, 0, B.pal.edge);
  const rs = Math.sqrt(Math.max(0, r * r - d * d));
  if (rs > 0) {
    disc(B, rs, d, B.pal.section, 0.6);
    circleLine(B, rs, d, B.pal.section);
    const O = v3(0, 0, 0), Hc = v3(0, 0, d), M = v3(rs, 0, d);
    B.segments([[O, Hc]], B.dashMat(B.pal.accent));
    B.segments([[O, M], [Hc, M]], B.lineMat(B.pal.accent));
    B.dot(O); B.label("O", O, { offset: v3(-B.labelSize * 0.7, 0, 0), scale: 0.8 });
    B.label("H", Hc, { offset: v3(-B.labelSize * 0.7, 0, 0), scale: 0.8 });
    B.label("M", M, { offset: v3(B.labelSize * 0.7, 0, 0), scale: 0.8 });
  }
  B.info.push({ label: T("Volume de la boule", "حجم الكرة", "Ball volume"), value: `4/3 π r³ ≈ ${fmt((4 / 3) * Math.PI * r ** 3)}` });
  B.info.push({ label: T("Aire de la sphère", "مساحة الفلكة", "Sphere area"), value: `4π r² ≈ ${fmt(4 * Math.PI * r * r)}` });
  B.info.push({ label: T("Rayon de la section", "شعاع المقطع", "Section radius"), value: `HM = √(r² − d²) ≈ ${fmt(rs)}` });
}

const parsePoint = (s: string) => {
  const m = s.trim().match(/^([A-Za-z][A-Za-z0-9']*)\s*\(\s*(-?[\d.,]+)\s*[;,]\s*(-?[\d.,]+)\s*[;,]\s*(-?[\d.,]+)\s*\)$/);
  if (!m) return null;
  const n = (x: string) => Number(x.replace(",", "."));
  return { name: m[1], p: v3(n(m[2]), n(m[3]), n(m[4])) };
};
const planeEq = (a: number, b: number, c: number, d: number) => {
  const parts: string[] = [];
  ([[a, "x"], [b, "y"], [c, "z"], [d, ""]] as [number, string][]).forEach(([k, v]) => {
    if (!k) return;
    const abs = Math.abs(k), coef = v && abs === 1 ? "" : fmt(abs);
    parts.push(`${k < 0 ? (parts.length ? " − " : "−") : parts.length ? " + " : ""}${coef}${v}`);
  });
  return parts.join("") || "0";
};
function space(B: Builder, prm: Params): string | undefined {
  const pts: Record<string, V> = {};
  const errors: string[] = [];
  String(prm.points || "").split(/\n|;(?![^(]*\))/).map((l) => l.trim()).filter(Boolean).forEach((l) => {
    // « A(1, 2, 3) » ; les virgules décimales sont acceptées avec « ; » comme séparateur
    const q = parsePoint(l.replace(/\s*,\s*/g, ", "));
    if (q) pts[q.name] = q.p;
    else errors.push(l);
  });
  if (prm.grid) B.gridXY(12, 12);
  B.axes(Math.max(4, ...Object.values(pts).map((p) => p.length() + 1)));
  Object.entries(pts).forEach(([k, p]) => {
    B.dot(p);
    B.label(`${k}(${fmt(p.x)} ; ${fmt(p.y)} ; ${fmt(p.z)})`, p, { offset: v3(0, 0, B.labelSize * 0.9), scale: 0.7 });
    // projections en pointillés sur le plan (x, y)
    if (Math.abs(p.z) > 1e-6) B.segments([[p, v3(p.x, p.y, 0)]], B.dashMat(B.pal.dashed, 0.1));
  });
  if (prm.triangle && pts.A && pts.B && pts.C) {
    B.polygon([pts.A, pts.B, pts.C], B.faceMat(B.pal.face, 0.3));
    const n = pts.B.clone().sub(pts.A).cross(pts.C.clone().sub(pts.A));
    B.info.push({ label: T("Aire du triangle ABC", "مساحة المثلث ABC", "Area of triangle ABC"), value: `‖AB ∧ AC‖ / 2 ≈ ${fmt(n.length() / 2)}` });
    B.info.push({ label: T("Vecteur normal AB ∧ AC", "المتجهة المنظمية AB ∧ AC", "Normal vector AB ∧ AC"), value: `(${fmt(n.x)} ; ${fmt(n.y)} ; ${fmt(n.z)})` });
  }
  const colors = [0xe8590c, 0x2f9e44, 0x7048e8, 0x1098ad, 0xd6336c];
  String(prm.vectors || "").split(/\n|,(?![^(]*\))/).map((l) => l.trim()).filter(Boolean).forEach((l, i) => {
    const col = colors[i % colors.length];
    const two = l.match(/^([A-Za-z])([A-Za-z])$/);
    const free = l.match(/^([a-z])\s*\(\s*(-?[\d.]+)\s*[;,]\s*(-?[\d.]+)\s*[;,]\s*(-?[\d.]+)\s*\)$/);
    if (two && pts[two[1]] && pts[two[2]]) {
      const A = pts[two[1]], Bp = pts[two[2]];
      B.arrow(A, Bp, col);
      const d = Bp.clone().sub(A);
      B.info.push({ label: T(`Vecteur ${l}`, `المتجهة ${l}`, `Vector ${l}`), value: `(${fmt(d.x)} ; ${fmt(d.y)} ; ${fmt(d.z)}) · ‖${l}‖ ≈ ${fmt(d.length())}` });
    } else if (free) {
      const d = v3(Number(free[2]), Number(free[3]), Number(free[4]));
      B.arrow(v3(0, 0, 0), d, col);
      B.label(free[1], d, { offset: v3(0, 0, B.labelSize * 0.8), scale: 0.8 });
      B.info.push({ label: T(`Vecteur ${free[1]}`, `المتجهة ${free[1]}`, `Vector ${free[1]}`), value: `‖${free[1]}‖ ≈ ${fmt(d.length())}` });
    } else errors.push(l);
  });
  String(prm.lines || "").split(/[,;\n]/).map((l) => l.trim()).filter(Boolean).forEach((l) => {
    const m = l.match(/^\(?([A-Za-z])([A-Za-z])\)?$/);
    if (!m || !pts[m[1]] || !pts[m[2]]) { errors.push(l); return; }
    const A = pts[m[1]], d = pts[m[2]].clone().sub(A).normalize();
    B.segments([[A.clone().addScaledVector(d, -12), A.clone().addScaledVector(d, 12)]], B.lineMat(B.pal.accent));
  });
  const pl = String(prm.plane || "").split(/[,;]/).map((x) => Number(x.trim().replace(/\s/g, "")));
  if (pl.length === 4 && pl.every(Number.isFinite) && (pl[0] || pl[1] || pl[2])) {
    const n = v3(pl[0], pl[1], pl[2]); const d = pl[3];
    const P0 = n.clone().multiplyScalar(-d / n.lengthSq());
    const u = Math.abs(n.z) < 0.9 * n.length() ? v3(0, 0, 1).cross(n).normalize() : v3(1, 0, 0).cross(n).normalize();
    const w = n.clone().normalize().cross(u);
    const S = 4.5;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => P0.clone().addScaledVector(u, i * S).addScaledVector(w, j * S));
    B.polygon(corners, B.faceMat(0x20c997, 0.22));
    B.segments(corners.map((q, i) => [q, corners[(i + 1) % 4]] as [V, V]), B.lineMat(0x20c997));
    B.label("(P)", corners[2], { color: "#0ca678" });
    B.arrow(P0, P0.clone().add(n.clone().normalize().multiplyScalar(2)), 0x20c997);
    B.info.push({ label: T("Plan (P)", "المستوى (P)", "Plane (P)"), value: `${planeEq(pl[0], pl[1], pl[2], d)} = 0` });
    const name = String(prm.project || "").trim();
    const M = pts[name];
    if (M) {
      const k = (n.dot(M) + d) / n.lengthSq();
      const H = M.clone().addScaledVector(n, -k);
      B.segments([[M, H]], B.dashMat(B.pal.section, 0.12));
      B.dot(H, B.pal.section);
      B.label("H", H, { offset: v3(0, 0, -B.labelSize * 0.9), color: "#d6336c", scale: 0.85 });
      B.info.push({ label: T(`Projeté orthogonal de ${name} sur (P)`, `المسقط العمودي لـ ${name} على (P)`, `Projection of ${name} on (P)`), value: `H(${fmt(H.x)} ; ${fmt(H.y)} ; ${fmt(H.z)})` });
      B.info.push({ label: T(`Distance de ${name} à (P)`, `مسافة ${name} عن (P)`, `Distance from ${name} to (P)`), value: `|a·x + b·y + c·z + d| / ‖n‖ ≈ ${fmt(Math.abs(n.dot(M) + d) / n.length())}` });
    }
  }
  return errors.length ? `Non compris : ${errors.slice(0, 4).join(" · ")}` : undefined;
}

function surface(B: Builder, prm: Params): string | undefined {
  let f: (v: Record<string, number>) => number;
  try { f = compileExpr(String(prm.f || "0")); } catch (e: any) { B.axes(5); return String(e?.message || e); }
  const R = Number(prm.range), zmax = Number(prm.zmax), a = Number(prm.a), N = 80;
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const ok: boolean[] = [];
  const c = new THREE.Color();
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const x = -R + (2 * R * i) / N, y = -R + (2 * R * j) / N;
    let z = f({ x, y, a, b: 0, t: 0 });
    const good = Number.isFinite(z) && Math.abs(z) <= zmax * 1.0001;
    if (!Number.isFinite(z)) z = 0;
    z = Math.max(-zmax, Math.min(zmax, z));
    ok.push(good);
    pos.push(x, y, z);
    c.setHSL(0.66 - 0.66 * ((z + zmax) / (2 * zmax)), 0.75, 0.52);
    col.push(c.r, c.g, c.b);
  }
  const id = (i: number, j: number) => i * (N + 1) + j;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const q = [id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j + 1)];
    if (q.every((k) => ok[k])) idx.push(q[0], q[1], q[2], q[0], q[2], q[3]);
  }
  const g = B.track(new THREE.BufferGeometry());
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mat = B.track(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.6 }));
  B.m.add(new THREE.Mesh(g, mat));
  if (prm.wire) {
    const w = B.track(new THREE.WireframeGeometry(g));
    B.m.add(new THREE.LineSegments(w, B.track(new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12 }))));
  }
  if (prm.axes !== false) B.axes(Math.max(R, zmax) * 1.1);
  B.gridXY(2 * R, 10);
  const vals = pos.filter((_, i) => i % 3 === 2);
  B.info.push({ label: T("Valeurs de z (sur la grille)", "قيم z", "z values (on the grid)"), value: `min ≈ ${fmt(Math.min(...vals))} · max ≈ ${fmt(Math.max(...vals))}` });
  return undefined;
}

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function dieTexture(B: Builder, n: number) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const x = cv.getContext("2d")!;
  x.fillStyle = "#ffffff"; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = "#ced4da"; x.lineWidth = 6; x.strokeRect(3, 3, 122, 122);
  x.fillStyle = n === 1 ? "#e03131" : "#212529";
  const P: Record<number, [number, number][]> = {
    1: [[64, 64]], 2: [[34, 34], [94, 94]], 3: [[30, 30], [64, 64], [98, 98]], 4: [[34, 34], [94, 34], [34, 94], [94, 94]],
    5: [[30, 30], [98, 30], [64, 64], [30, 98], [98, 98]], 6: [[34, 28], [94, 28], [34, 64], [94, 64], [34, 100], [94, 100]],
  };
  P[n].forEach(([cx, cy]) => { x.beginPath(); x.arc(cx, cy, 11, 0, Math.PI * 2); x.fill(); });
  const t = B.track(new THREE.CanvasTexture(cv));
  t.colorSpace = THREE.SRGBColorSpace;
  return B.track(new THREE.MeshStandardMaterial({ map: t, roughness: 0.4 }));
}
function dice(B: Builder, prm: Params) {
  const two = String(prm.dice) === "2";
  const n = Math.round(Number(prm.n));
  const rnd = mulberry32(Number(prm.seed) * 7919 + n);
  const outcomes = two ? [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [1, 2, 3, 4, 5, 6];
  const count: Record<number, number> = {};
  outcomes.forEach((o) => (count[o] = 0));
  let last = [1, 1];
  for (let i = 0; i < n; i++) {
    const d1 = 1 + Math.floor(rnd() * 6), d2 = 1 + Math.floor(rnd() * 6);
    count[two ? d1 + d2 : d1]++;
    last = [d1, d2];
  }
  const theo = (o: number) => (two ? (6 - Math.abs(7 - o)) / 36 : 1 / 6);
  const maxP = Math.max(...outcomes.map(theo));
  const H = 5; // hauteur d'une barre à la probabilité maximale
  const w = 0.8, gap = 1.1;
  const x0 = -((outcomes.length - 1) * gap) / 2;
  outcomes.forEach((o, i) => {
    const fr = count[o] / Math.max(1, n);
    const hgt = Math.max(0.02, (fr / maxP) * H);
    const g = B.track(new THREE.BoxGeometry(w, w, hgt));
    const bar = new THREE.Mesh(g, B.faceMat(FACE_COLORS[i % 6], 0.9));
    bar.position.set(x0 + i * gap, 0, hgt / 2);
    B.m.add(bar);
    B.label(String(o), v3(x0 + i * gap, -w, 0), { scale: 0.8 });
    B.label(`${fmt(fr * 100, 1)} %`, v3(x0 + i * gap, 0, hgt + 0.45), { scale: 0.6 });
    if (prm.theory) {
      const th = (theo(o) / maxP) * H;
      const tg = B.track(new THREE.BoxGeometry(w * 1.25, w * 1.25, 0.04));
      const tm = new THREE.Mesh(tg, B.faceMat(0xe03131, 0.9));
      tm.position.set(x0 + i * gap, 0, th);
      B.m.add(tm);
    }
  });
  // dé(s) du dernier lancer
  const dieGroup = new THREE.Group();
  [last[0], ...(two ? [last[1]] : [])].forEach((val, k) => {
    // ordre des faces BoxGeometry : +x, −x, +y, −y, +z, −z (z maths en haut → face +z = valeur)
    const order = [3, 4, 2, 5, val, 7 - val].map((x, i) => (i < 4 ? [1, 2, 3, 4, 5, 6].filter((f) => f !== val && f !== 7 - val)[i] : x));
    const mats = order.map((f) => dieTexture(B, f));
    const g = B.track(new THREE.BoxGeometry(1.4, 1.4, 1.4));
    const die = new THREE.Mesh(g, mats);
    die.position.set(k * 1.8, 0, 0.7);
    die.rotation.z = 0.35 + k * 0.3;
    dieGroup.add(die);
  });
  dieGroup.position.set(x0 - 2.4 - (two ? 1.8 : 0), 2.2, 0);
  B.m.add(dieGroup);
  B.gridXY(outcomes.length * gap + 4, outcomes.length + 4);
  const meanTh = two ? 7 : 3.5;
  const mean = outcomes.reduce((s, o) => s + o * count[o], 0) / Math.max(1, n);
  B.info.push({ label: T("Lancers", "الرميات", "Rolls"), value: String(n) });
  B.info.push({ label: T("Moyenne observée / espérance", "المعدل الملاحظ / الأمل", "Observed mean / expected value"), value: `${fmt(mean, 3)} / ${fmt(meanTh)}` });
  const worst = Math.max(...outcomes.map((o) => Math.abs(count[o] / Math.max(1, n) - theo(o))));
  B.info.push({ label: T("Plus grand écart fréquence − probabilité", "أكبر فرق بين التردد والاحتمال", "Largest gap frequency − probability"), value: `${fmt(worst * 100, 2)} points` });
}

// ---------------------------------------------------------------------
export function buildScene(template: string, prm: Params, dark: boolean): BuiltScene {
  const B = new Builder(palette(dark));
  // taille des étiquettes proportionnelle à la scène
  const size = Math.max(Number(prm.a || 0), Number(prm.L || 0), Number(prm.h || 0), Number(prm.r || 0) * 2, Number(prm.range || 0) * 1.2, 4);
  B.labelSize = Math.max(0.28, size * 0.07);
  let error: string | undefined;
  try {
    switch (template) {
      case "cube": cuboid(B, Number(prm.a), Number(prm.a), Number(prm.a), prm, true); break;
      case "cuboid": cuboid(B, Number(prm.L), Number(prm.l), Number(prm.h), prm, false); break;
      case "pyramid": pyramid(B, prm); break;
      case "tetrahedron": tetrahedron(B, prm); break;
      case "prism": prism(B, prm); break;
      case "cylinder": revolution(B, "cylinder", prm); break;
      case "cone": revolution(B, "cone", prm); break;
      case "sphere": sphere(B, prm); break;
      case "space": error = space(B, prm); break;
      case "surface": error = surface(B, prm); break;
      case "dice": dice(B, prm); break;
      default: {
        const sb = SCIENCE_BUILDERS[template];
        if (sb) error = sb(B, prm) || undefined;
        else error = "Modèle inconnu";
      }
    }
    if (prm.axes && !["space", "surface", "dice"].includes(template)) B.axes(size * 1.2);
  } catch (e: any) {
    error = String(e?.message || e);
  }
  const ups = B.updaters;
  const update = ups.length ? (t: number) => { for (const u of ups) u(t); } : undefined;
  if (update) { try { update(0); } catch { /* */ } }
  return { root: B.root, info: B.info, error, update, dispose: () => B.dispose() };
}

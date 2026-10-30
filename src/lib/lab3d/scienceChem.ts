/** Scènes de chimie du Labo 3D */
import * as THREE from "three";
import type { Builder } from "./buildScene";
import type { Params } from "./templates";
import { N, T, ball, box, clamp, fmt, line, liveLabel, liveLine, mat, plot, rod, v3, type V } from "./scienceKit";

// ------------------------------------------------------------------ molécules
type AtomSpec = [el: string, parent?: number, order?: number, charge?: number];
const MOLS: Record<string, { atoms: AtomSpec[]; geo?: string; group?: string }> = {
  h2: { atoms: [["H"], ["H", 0, 1]], geo: "linéaire" },
  o2: { atoms: [["O"], ["O", 0, 2]], geo: "linéaire, liaison double O=O" },
  n2: { atoms: [["N"], ["N", 0, 3]], geo: "linéaire, liaison triple N≡N" },
  hcl: { atoms: [["Cl"], ["H", 0, 1]], geo: "linéaire, liaison polarisée" },
  h2o: { atoms: [["O"], ["H", 0], ["H", 0]], geo: "coudée (angle ≈ 104,5°), 2 doublets non liants" },
  nh3: { atoms: [["N"], ["H", 0], ["H", 0], ["H", 0]], geo: "pyramidale (angle ≈ 107°), 1 doublet non liant" },
  ch4: { atoms: [["C"], ["H", 0], ["H", 0], ["H", 0], ["H", 0]], geo: "tétraédrique (angle 109,5°)" },
  co2: { atoms: [["C"], ["O", 0, 2], ["O", 0, 2]], geo: "linéaire (180°), deux liaisons doubles" },
  h3o: { atoms: [["O", -1, 1, 1], ["H", 0], ["H", 0], ["H", 0]], geo: "pyramidale, ion oxonium H₃O⁺" },
  nh4: { atoms: [["N", -1, 1, 1], ["H", 0], ["H", 0], ["H", 0], ["H", 0]], geo: "tétraédrique, ion ammonium NH₄⁺" },
  c2h6: { atoms: [["C"], ["C", 0], ["H", 0], ["H", 0], ["H", 0], ["H", 1], ["H", 1], ["H", 1]], geo: "chaîne saturée, carbones tétraédriques" },
  c2h4: { atoms: [["C"], ["C", 0, 2], ["H", 0], ["H", 0], ["H", 1], ["H", 1]], geo: "plane (120°), liaison double C=C" },
  c2h2: { atoms: [["C"], ["C", 0, 3], ["H", 0], ["H", 1]], geo: "linéaire (180°), liaison triple C≡C" },
  butane: { atoms: [["C"], ["C", 0], ["C", 1], ["C", 2], ["H", 0], ["H", 0], ["H", 0], ["H", 1], ["H", 1], ["H", 2], ["H", 2], ["H", 3], ["H", 3], ["H", 3]], geo: "chaîne linéaire C₄H₁₀", group: "isomère de chaîne du méthylpropane" },
  isobutane: { atoms: [["C"], ["C", 0], ["C", 0], ["C", 0], ["H", 0], ["H", 1], ["H", 1], ["H", 1], ["H", 2], ["H", 2], ["H", 2], ["H", 3], ["H", 3], ["H", 3]], geo: "chaîne ramifiée C₄H₁₀", group: "isomère de chaîne du butane" },
  methanol: { atoms: [["C"], ["O", 0], ["H", 0], ["H", 0], ["H", 0], ["H", 1]], group: "groupe hydroxyle –OH : alcool" },
  ethanol: { atoms: [["C"], ["C", 0], ["O", 1], ["H", 0], ["H", 0], ["H", 0], ["H", 1], ["H", 1], ["H", 2]], group: "groupe hydroxyle –OH : alcool primaire" },
  ethanal: { atoms: [["C"], ["C", 0], ["O", 1, 2], ["H", 0], ["H", 0], ["H", 0], ["H", 1]], group: "groupe carbonyle en bout de chaîne –CHO : aldéhyde" },
  propanone: { atoms: [["C"], ["C", 0], ["C", 1], ["O", 1, 2], ["H", 0], ["H", 0], ["H", 0], ["H", 2], ["H", 2], ["H", 2]], group: "groupe carbonyle C=O dans la chaîne : cétone" },
  acetic: { atoms: [["C"], ["C", 0], ["O", 1, 2], ["O", 1], ["H", 0], ["H", 0], ["H", 0], ["H", 3]], group: "groupe carboxyle –COOH : acide carboxylique" },
  ester: { atoms: [["C"], ["C", 0], ["O", 1, 2], ["O", 1], ["C", 3], ["C", 4], ["H", 0], ["H", 0], ["H", 0], ["H", 4], ["H", 4], ["H", 5], ["H", 5], ["H", 5]], group: "groupe ester –COO– (obtenu par estérification acide + alcool)" },
  ethylamine: { atoms: [["C"], ["C", 0], ["N", 1], ["H", 0], ["H", 0], ["H", 0], ["H", 1], ["H", 1], ["H", 2], ["H", 2]], group: "groupe amino –NH₂ : amine" },
};
const VAL: Record<string, number> = { H: 1, C: 4, N: 5, O: 6, Cl: 7 };
const COLORS: Record<string, number> = { H: 0xf1f3f5, C: 0x343a40, N: 0x1c7ed6, O: 0xe03131, Cl: 0x2f9e44, Na: 0x7048e8, Cs: 0x9c36b5, Cu: 0xd9480f };
const VDW: Record<string, number> = { H: 1.2, C: 1.7, N: 1.55, O: 1.52, Cl: 1.75 };
const bondLen = (a: string, b: string, o: number) => {
  const k = [a, b].sort().join("");
  const t: Record<string, number[]> = { CC: [1.54, 1.34, 1.2], CH: [1.09], CO: [1.43, 1.21], HO: [0.96], HN: [1.01], CN: [1.47], HH: [0.74], OO: [1.48, 1.21], NN: [1.45, 1.25, 1.1], ClH: [1.27] };
  return (t[k] || [1.3])[Math.min(o, (t[k] || [1.3]).length) - 1] ?? 1.3;
};
function perp(u: V) { const a = Math.abs(u.x) < 0.9 ? v3(1, 0, 0) : v3(0, 1, 0); return a.sub(u.clone().multiplyScalar(a.dot(u))).normalize(); }
/** directions des domaines autour d'un atome : la première pointe vers le parent (u) */
function domainDirs(sn: number, u: V | null, ref: V | null): V[] {
  if (!u) {
    if (sn === 4) return [v3(1, 1, 1), v3(1, -1, -1), v3(-1, 1, -1), v3(-1, -1, 1)].map((x) => x.normalize());
    if (sn === 3) return [0, 1, 2].map((k) => v3(Math.cos((k * 2 * Math.PI) / 3), Math.sin((k * 2 * Math.PI) / 3), 0));
    if (sn === 2) return [v3(1, 0, 0), v3(-1, 0, 0)];
    return [v3(1, 0, 0)];
  }
  const e1 = ref ? ref.clone().sub(u.clone().multiplyScalar(ref.dot(u))) : perp(u);
  if (e1.length() < 1e-6) e1.copy(perp(u));
  e1.normalize();
  const e2 = u.clone().cross(e1);
  const out = [u.clone()];
  if (sn === 2) out.push(u.clone().negate());
  if (sn === 3) [0, Math.PI].forEach((ph) => out.push(u.clone().multiplyScalar(Math.cos((2 * Math.PI) / 3)).add(e1.clone().multiplyScalar(Math.sin((2 * Math.PI) / 3) * Math.cos(ph))).add(e2.clone().multiplyScalar(Math.sin((2 * Math.PI) / 3) * Math.sin(ph)))));
  if (sn === 4) [Math.PI / 3, Math.PI, (5 * Math.PI) / 3].forEach((ph) => out.push(u.clone().multiplyScalar(-1 / 3).add(e1.clone().multiplyScalar(Math.sqrt(8 / 9) * Math.cos(ph))).add(e2.clone().multiplyScalar(Math.sqrt(8 / 9) * Math.sin(ph)))));
  return out.map((x) => x.normalize());
}
export function molecule(B: Builder, p: Params) {
  const id = String(p.mol || "h2o");
  const fill = p.style === "fill";
  const S = 1.6;
  B.labelSize = 0.32;
  const group = new THREE.Group();
  B.m.add(group);
  let pos: V[] = [], els: string[] = [];
  const bonds: [number, number, number][] = [], lone: { at: number; dir: V }[] = [];
  if (id === "benzene") {
    for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3; els.push("C"); pos.push(v3(Math.cos(a), Math.sin(a), 0).multiplyScalar(1.39 * S)); }
    for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3; els.push("H"); pos.push(v3(Math.cos(a), Math.sin(a), 0).multiplyScalar((1.39 + 1.09) * S)); bonds.push([k, (k + 1) % 6, k % 2 ? 1 : 2], [k, k + 6, 1]); }
  } else {
    const spec = MOLS[id] || MOLS.h2o;
    els = spec.atoms.map((a) => a[0]);
    const parent = spec.atoms.map((a) => (a[1] === undefined ? -1 : a[1]));
    const order = spec.atoms.map((a) => a[2] ?? 1);
    const charge = spec.atoms.map((a) => a[3] ?? 0);
    const kids = els.map((_, i) => parent.map((q, j) => (q === i ? j : -1)).filter((j) => j >= 0));
    const neighbors = (i: number) => [...kids[i], ...(parent[i] >= 0 ? [parent[i]] : [])];
    const bondOrder = (i: number, j: number) => (parent[j] === i ? order[j] : order[i]);
    const lp = els.map((e, i) => Math.max(0, (VAL[e] - neighbors(i).reduce((s, j) => s + bondOrder(i, j), 0) - charge[i]) / 2));
    const sn = els.map((_, i) => neighbors(i).length + lp[i]);
    pos = els.map(() => v3(0, 0, 0));
    const placed = new Set<number>([0]);
    const queue = [0];
    while (queue.length) {
      const i = queue.shift()!;
      const toParent = parent[i] >= 0 ? pos[parent[i]].clone().sub(pos[i]).normalize() : null;
      let ref: V | null = null;
      if (parent[i] >= 0) { const sib = neighbors(parent[i]).find((j) => j !== i && placed.has(j)); if (sib !== undefined) ref = pos[sib].clone().sub(pos[parent[i]]).normalize(); }
      const dirs = domainDirs(Math.max(1, sn[i]), toParent, ref);
      const free = toParent ? dirs.slice(1) : dirs;
      kids[i].forEach((j, k) => {
        const d = free[k] || perp(free[0] || v3(1, 0, 0));
        pos[j] = pos[i].clone().addScaledVector(d, bondLen(els[i], els[j], order[j]) * S);
        bonds.push([i, j, order[j]]);
        placed.add(j);
        queue.push(j);
      });
      free.slice(kids[i].length).forEach((d) => { if (lp[i] > 0) lone.push({ at: i, dir: d }); });
    }
    if (spec.geo) B.info.push({ label: T("Géométrie", "الهندسة", "Geometry"), value: spec.geo });
    if (spec.group) B.info.push({ label: T("Groupe caractéristique", "المجموعة المميزة", "Functional group"), value: spec.group });
    const lpTot = lp.reduce((s, x) => s + x, 0);
    B.info.push({ label: T("Doublets", "الأزواج", "Electron pairs"), value: `${bonds.reduce((s, b) => s + b[2], 0)} doublet(s) liant(s) · ${lpTot} doublet(s) non liant(s)` });
  }
  const c = pos.reduce((s, q) => s.add(q), v3(0, 0, 0)).multiplyScalar(1 / pos.length);
  pos.forEach((q) => q.sub(c));
  pos.forEach((q, i) => {
    const r = fill ? VDW[els[i]] * S * 0.62 : els[i] === "H" ? 0.28 : 0.45;
    ball(B, q, r, COLORS[els[i]] ?? 0xadb5bd, group, 28);
    if (p.labels) B.label(els[i], q, { parent: group, offset: v3(0, 0, r + 0.25), scale: 0.8 });
  });
  if (!fill) bonds.forEach(([i, j, o]) => {
    const a = pos[i], b = pos[j];
    const d = b.clone().sub(a).normalize();
    const off = perp(d).multiplyScalar(0.16);
    const offs = o === 1 ? [v3(0, 0, 0)] : o === 2 ? [off, off.clone().negate()] : [off, v3(0, 0, 0), off.clone().negate()];
    offs.forEach((of) => {
      const m = a.clone().lerp(b, 0.5).add(of);
      rod(B, a.clone().add(of), m, 0.08, COLORS[els[i]] ?? 0xadb5bd, group);
      rod(B, m, b.clone().add(of), 0.08, COLORS[els[j]] ?? 0xadb5bd, group);
    });
  });
  if (p.pairs && !fill) lone.forEach(({ at, dir }) => {
    const e = new THREE.Mesh(B.track(new THREE.SphereGeometry(0.3, 16, 12)), mat(B, 0xfab005, { opacity: 0.45 }));
    e.scale.set(0.6, 1.3, 0.6);
    e.position.copy(pos[at]).addScaledVector(dir, 0.75);
    e.quaternion.setFromUnitVectors(v3(0, 1, 0), dir);
    group.add(e);
    ball(B, pos[at].clone().addScaledVector(dir, 0.75).add(perp(dir).multiplyScalar(0.1)), 0.05, 0x212529, group, 8);
    ball(B, pos[at].clone().addScaledVector(dir, 0.75).add(perp(dir).multiplyScalar(-0.1)), 0.05, 0x212529, group, 8);
  });
  const count: Record<string, number> = {};
  els.forEach((e) => (count[e] = (count[e] || 0) + 1));
  const sub = (n: number) => (n === 1 ? "" : String(n).split("").map((d) => "₀₁₂₃₄₅₆₇₈₉"[Number(d)]).join(""));
  const order = ["C", "H", "N", "O", "Cl"];
  B.info.unshift({ label: T("Formule brute", "الصيغة الإجمالية", "Molecular formula"), value: order.filter((e) => count[e]).map((e) => e + sub(count[e])).join("") });
  if (pos.length > 2) {
    const center = els.findIndex((e) => e !== "H");
    const nb = bonds.filter((b) => b[0] === center || b[1] === center).map((b) => (b[0] === center ? b[1] : b[0]));
    if (nb.length >= 2) {
      const ang = pos[nb[0]].clone().sub(pos[center]).angleTo(pos[nb[1]].clone().sub(pos[center]));
      B.info.push({ label: T("Angle de liaison (modèle)", "زاوية الرابطة", "Bond angle (model)"), value: `≈ ${fmt((ang * 180) / Math.PI, 1)}°` });
    }
  }
  const M: Record<string, number> = { H: 1, C: 12, N: 14, O: 16, Cl: 35.5 };
  B.info.push({ label: T("Masse molaire", "الكتلة المولية", "Molar mass"), value: `M = ${fmt(els.reduce((s, e) => s + (M[e] || 0), 0), 1)} g/mol` });
  if (p.spin) B.onFrame((t) => { group.rotation.z = t * 0.5; });
}

// ------------------------------------------------------------------ atome
const ELEMENTS: [string, string, string, number][] = [
  ["H", "Hydrogène", "الهيدروجين", 1], ["He", "Hélium", "الهيليوم", 4], ["Li", "Lithium", "الليثيوم", 7], ["Be", "Béryllium", "البيريليوم", 9], ["B", "Bore", "البور", 11],
  ["C", "Carbone", "الكربون", 12], ["N", "Azote", "الآزوت", 14], ["O", "Oxygène", "الأكسجين", 16], ["F", "Fluor", "الفلور", 19], ["Ne", "Néon", "النيون", 20],
  ["Na", "Sodium", "الصوديوم", 23], ["Mg", "Magnésium", "المغنيزيوم", 24], ["Al", "Aluminium", "الألومنيوم", 27], ["Si", "Silicium", "السيليسيوم", 28], ["P", "Phosphore", "الفوسفور", 31],
  ["S", "Soufre", "الكبريت", 32], ["Cl", "Chlore", "الكلور", 35], ["Ar", "Argon", "الأرغون", 40], ["K", "Potassium", "البوتاسيوم", 39], ["Ca", "Calcium", "الكالسيوم", 40],
];
export function atom(B: Builder, p: Params) {
  const Z = clamp(Math.round(N(p.Z, 8)), 1, 20);
  const [sym, nameFr, nameAr, A] = ELEMENTS[Z - 1];
  const Nn = A - Z;
  B.labelSize = 0.35;
  const shells: number[] = [];
  let rest = Z;
  [2, 8, 8, 2].forEach((cap) => { const k = Math.min(cap, rest); if (k > 0) shells.push(k); rest -= k; });
  const rnd = (() => { let s = Z * 7919; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const nuc = new THREE.Group();
  B.m.add(nuc);
  const total = Z + Nn, rN = 0.16 * Math.cbrt(total) + 0.1;
  for (let i = 0; i < total; i++) {
    const u = rnd() * 2 - 1, th = rnd() * 2 * Math.PI, rr = rN * Math.cbrt(rnd());
    const q = v3(Math.sqrt(1 - u * u) * Math.cos(th), Math.sqrt(1 - u * u) * Math.sin(th), u).multiplyScalar(rr);
    ball(B, q, 0.13, i < Z ? 0xe03131 : 0xadb5bd, nuc, 12);
  }
  const radii = shells.map((_, k) => 1.4 + k * 1.1);
  const names = ["K", "L", "M", "N"];
  const electrons: { m: THREE.Mesh; r: number; ph: number; k: number }[] = [];
  shells.forEach((n, k) => {
    const r = radii[k];
    const ring: V[] = Array.from({ length: 97 }, (_, i) => v3(r * Math.cos((i / 96) * 2 * Math.PI), r * Math.sin((i / 96) * 2 * Math.PI), 0));
    line(B, ring, B.pal.dashed);
    if (p.labels) B.label(`${names[k]} (${n})`, v3(r * 0.72, -r * 0.72, 0), { scale: 0.7 });
    for (let i = 0; i < n; i++) electrons.push({ m: ball(B, v3(0, 0, 0), 0.12, 0x1c7ed6, B.m, 12), r, ph: (i / n) * 2 * Math.PI, k });
  });
  if (p.labels) B.label(`${sym}  (Z = ${Z}, A = ${A})`, v3(0, 0, radii[radii.length - 1] + 0.8), { scale: 0.9 });
  const valence = shells[shells.length - 1];
  const period = shells.length, groupCol = Z === 2 ? 8 : valence;
  const conf = shells.map((n, k) => `(${names[k]})${String(n).split("").map((d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(d)]).join("")}`).join("");
  let ion = "—";
  if (valence <= 3 && Z > 2) ion = `${sym}${valence === 1 ? "⁺" : valence === 2 ? "²⁺" : "³⁺"} (perd ${valence} e⁻)`;
  else if (valence >= 5 && valence < 8) ion = `${sym}${8 - valence === 1 ? "⁻" : 8 - valence === 2 ? "²⁻" : "³⁻"} (gagne ${8 - valence} e⁻)`;
  else if (Z === 1) ion = "H⁺ (perd 1 e⁻)";
  B.info.push({ label: T("Élément", "العنصر", "Element"), value: `${nameFr} · ${nameAr} (${sym})` });
  B.info.push({ label: T("Composition du noyau", "تركيب النواة", "Nucleus"), value: `${Z} proton(s), ${Nn} neutron(s) · ${Z} électron(s)` });
  B.info.push({ label: T("Structure électronique", "البنية الإلكترونية", "Electron configuration"), value: conf });
  B.info.push({ label: T("Tableau périodique", "الجدول الدوري", "Periodic table"), value: `période ${period}, colonne ${groupCol} · ${valence} électron(s) de valence` });
  B.info.push({ label: T("Ion monoatomique probable (règles du duet / de l'octet)", "الأيون المحتمل", "Likely ion"), value: Z === 2 || Z === 10 || Z === 18 ? "gaz rare : stable" : ion });
  B.onFrame((t) => electrons.forEach((e) => { const a = e.ph + t * (1.2 / (e.k + 1)); e.m.position.set(e.r * Math.cos(a), e.r * Math.sin(a), 0); }));
}

// ------------------------------------------------------------------ cristaux
export function crystal(B: Builder, p: Params) {
  const type = String(p.type || "nacl"), n = clamp(Math.round(N(p.cells, 2)), 1, 3), compact = !!p.compact;
  const data = type === "nacl" ? { a: 0.564, ions: [["Na", 0.102], ["Cl", 0.181]] } : type === "cscl" ? { a: 0.412, ions: [["Cs", 0.167], ["Cl", 0.181]] } : { a: 0.361, ions: [["Cu", 0.128]] };
  const s = 6 / (n * data.a);
  B.labelSize = 0.32;
  const rad = (r: number) => r * s * (compact ? 1 : 0.38);
  const g = new THREE.Group();
  B.m.add(g);
  const add = (q: V, el: string, r: number) => ball(B, q.clone().multiplyScalar(data.a * s), rad(r), COLORS[el] ?? 0xadb5bd, g, compact ? 24 : 16);
  if (type === "nacl") {
    for (let i = 0; i <= 2 * n; i++) for (let j = 0; j <= 2 * n; j++) for (let k = 0; k <= 2 * n; k++) {
      const na = (i + j + k) % 2 === 1;
      add(v3(i / 2, j / 2, k / 2), na ? "Na" : "Cl", na ? 0.102 : 0.181);
    }
  } else if (type === "cscl") {
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) for (let k = 0; k <= n; k++) add(v3(i, j, k), "Cl", 0.181);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) add(v3(i + 0.5, j + 0.5, k + 0.5), "Cs", 0.167);
  } else {
    for (let i = 0; i <= 2 * n; i++) for (let j = 0; j <= 2 * n; j++) for (let k = 0; k <= 2 * n; k++) if ((i + j + k) % 2 === 0) add(v3(i / 2, j / 2, k / 2), "Cu", 0.128);
  }
  const L = data.a * s;
  const segs: [V, V][] = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
    segs.push([v3(0, i, j).multiplyScalar(L), v3(n, i, j).multiplyScalar(L)], [v3(i, 0, j).multiplyScalar(L), v3(i, n, j).multiplyScalar(L)], [v3(i, j, 0).multiplyScalar(L), v3(i, j, n).multiplyScalar(L)]);
  }
  B.segments(segs, B.lineMat(B.pal.edge), g);
  g.position.set((-n * L) / 2, (-n * L) / 2, 0);
  if (type === "nacl") {
    B.info.push({ label: T("Contenu d'une maille", "محتوى الخلية", "Unit-cell content"), value: "4 Na⁺ + 4 Cl⁻ (8 × 1/8 + 6 × 1/2 = 4)" });
    B.info.push({ label: T("Coordinence", "عدد التناسق", "Coordination"), value: "chaque ion est entouré de 6 ions de signe opposé" });
  } else if (type === "cscl") {
    B.info.push({ label: T("Contenu d'une maille", "محتوى الخلية", "Unit-cell content"), value: "1 Cs⁺ + 1 Cl⁻ (8 × 1/8 = 1)" });
    B.info.push({ label: T("Coordinence", "عدد التناسق", "Coordination"), value: "8" });
  } else {
    B.info.push({ label: T("Contenu d'une maille", "محتوى الخلية", "Unit-cell content"), value: "4 atomes de cuivre (cubique à faces centrées)" });
    B.info.push({ label: T("Coordinence", "عدد التناسق", "Coordination"), value: "12 · compacité ≈ 74 %" });
  }
  B.info.push({ label: T("Paramètre de maille", "ثابتة الشبكة", "Lattice parameter"), value: `a = ${fmt(data.a, 3)} nm` });
  B.info.push({ label: T("Neutralité électrique", "الحياد الكهربائي", "Electrical neutrality"), value: type === "fcc" ? "cristal métallique : ions positifs + électrons libres" : "autant de charges + que de charges −" });
}

// ------------------------------------------------------------------ dosage acido-basique
const IND: Record<string, { lo: number; hi: number; a: number; b: number; m?: number; name: string }> = {
  phenol: { lo: 8.2, hi: 10, a: 0xffffff, b: 0xe64980, name: "phénolphtaléine" },
  bbt: { lo: 6, hi: 7.6, a: 0xfab005, m: 0x40c057, b: 0x1c7ed6, name: "bleu de bromothymol" },
  helianthine: { lo: 3.1, hi: 4.4, a: 0xe03131, m: 0xfd7e14, b: 0xfcc419, name: "hélianthine" },
};
function indColor(id: string, pH: number) {
  const d = IND[id] || IND.phenol;
  const u = clamp((pH - d.lo) / (d.hi - d.lo), 0, 1);
  const ca = new THREE.Color(d.a), cb = new THREE.Color(d.b);
  if (d.m !== undefined) { const cm = new THREE.Color(d.m); return u < 0.5 ? ca.lerp(cm, u * 2) : cm.lerp(cb, (u - 0.5) * 2); }
  return ca.lerp(cb, u);
}
export function titration(B: Builder, p: Params) {
  const weak = p.acid !== "strong", Ca = N(p.Ca, 0.05), Va = N(p.Va, 20), Cb = N(p.Cb, 0.1), pKa = N(p.pKa, 4.8), ind = String(p.indicator || "phenol");
  const Ka = 10 ** -pKa, Kw = 1e-14;
  const Ve = (Ca * Va) / Cb;
  const pH = (Vb: number) => {
    const Vt = (Va + Vb) / 1000, na = (Ca * Va) / 1000, nb = (Cb * Vb) / 1000;
    const Na = nb / Vt, Ct = na / Vt;
    const f = (h: number) => h + Na - Kw / h - (weak ? (Ct * Ka) / (Ka + h) : Ct);
    let lo = -14, hi = 0;
    for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (f(10 ** mid) > 0) hi = mid; else lo = mid; }
    return -(lo + hi) / 2;
  };
  B.labelSize = 0.42;
  const Vmax = 2 * Ve;
  const pl = plot(B, { origin: v3(0, 0, 0), w: 8, h: 5, xmax: Vmax, ymin: 0, ymax: 14, xlabel: "V_B (mL)", ylabel: "pH", yticks: 7 });
  pl.curve(pH, 0xe8590c, 300);
  const pHE = pH(Ve);
  line(B, [pl.map(Ve, 0), pl.map(Ve, pHE), pl.map(0, pHE)], 0x1c7ed6, B.m, true);
  B.label(`E (${fmt(Ve, 1)} mL ; ${fmt(pHE, 2)})`, pl.map(Ve, pHE), { offset: v3(1.3, 0, 0), scale: 0.6, color: "#1c7ed6" });
  const d = IND[ind] || IND.phenol;
  const zone = new THREE.Mesh(B.track(new THREE.PlaneGeometry(8, ((d.hi - d.lo) / 14) * 5)), mat(B, d.b, { opacity: 0.15 }));
  zone.rotation.x = Math.PI / 2;
  zone.position.set(4, -0.01, ((d.lo + d.hi) / 2 / 14) * 5);
  B.m.add(zone);
  if (weak) { line(B, [pl.map(Ve / 2, 0), pl.map(Ve / 2, pKa), pl.map(0, pKa)], 0x2f9e44, B.m, true); B.label("pH = pKa", pl.map(Ve / 2, pKa), { offset: v3(-0.4, 0, 0.35), scale: 0.6, color: "#2f9e44" }); }
  // bécher et burette
  const bx = 11;
  const beaker = new THREE.Mesh(B.track(new THREE.CylinderGeometry(1, 1, 2, 32, 1, true)), mat(B, 0xdee2e6, { opacity: 0.25 }));
  beaker.rotation.x = Math.PI / 2; beaker.position.set(bx, 0, 1); B.m.add(beaker);
  const liquid = new THREE.Mesh(B.track(new THREE.CylinderGeometry(0.95, 0.95, 1, 32)), mat(B, 0xffffff, { opacity: 0.75 }));
  liquid.rotation.x = Math.PI / 2; B.m.add(liquid);
  const bur = new THREE.Mesh(B.track(new THREE.CylinderGeometry(0.15, 0.15, 4, 16, 1, true)), mat(B, 0xdee2e6, { opacity: 0.3 }));
  bur.rotation.x = Math.PI / 2; bur.position.set(bx, 0, 5.2); B.m.add(bur);
  const sol = new THREE.Mesh(B.track(new THREE.CylinderGeometry(0.13, 0.13, 1, 16)), mat(B, 0xd0ebff, { opacity: 0.8 }));
  sol.rotation.x = Math.PI / 2; B.m.add(sol);
  rod(B, v3(bx, 0, 3.2), v3(bx, 0, 2.6), 0.04, 0xadb5bd);
  const drop = ball(B, v3(bx, 0, 2.5), 0.06, 0xd0ebff);
  const cur = pl.cursor();
  const lab = liveLabel(B, v3(bx - 1.5, 0, 7.8), { scale: 0.75 });
  B.info.push({ label: T("Réaction de dosage", "تفاعل المعايرة", "Titration reaction"), value: weak ? "CH₃COOH + HO⁻ → CH₃COO⁻ + H₂O" : "H₃O⁺ + HO⁻ → 2 H₂O" });
  B.info.push({ label: T("Volume à l'équivalence", "حجم التكافؤ", "Equivalence volume"), value: `V_BE = Cₐ·Vₐ / C_B = ${fmt(Ve, 2)} mL` });
  B.info.push({ label: T("pH à l'équivalence", "pH عند التكافؤ", "pH at equivalence"), value: `${fmt(pHE, 2)} (${pHE > 7.2 ? "basique" : pHE < 6.8 ? "acide" : "neutre"})` });
  const ok = pHE >= d.lo - 0.3 && pHE <= d.hi + 0.3;
  B.info.push({ label: T("Indicateur", "الكاشف", "Indicator"), value: `${d.name} (zone ${fmt(d.lo, 1)} – ${fmt(d.hi, 1)}) : ${ok ? "adapté ✓" : "mal adapté ✗"}` });
  B.onFrame((t) => {
    const Vb = ((t % 14) / 12) * Vmax;
    const V = Math.min(Vb, Vmax);
    const ph = pH(V);
    cur.set(V, ph);
    const h = 0.6 + (V / Vmax) * 0.6;
    liquid.scale.set(1, h, 1); liquid.position.set(bx, 0, 0.05 + h / 2);
    (liquid.material as THREE.MeshStandardMaterial).color.copy(indColor(ind, ph));
    const lv = 3.8 * (1 - V / Vmax) + 0.1;
    sol.scale.set(1, lv, 1); sol.position.set(bx, 0, 3.2 + lv / 2);
    drop.position.z = 2.5 - ((t * 3) % 1) * (2.5 - h);
    drop.visible = V < Vmax;
    lab.set(`V_B = ${fmt(V, 1)} mL   pH = ${fmt(ph, 2)}`);
  });
}

// ------------------------------------------------------------------ cinétique
export function kinetics(B: Builder, p: Params) {
  const C0 = N(p.C0, 20), Tc = N(p.T, 25), k25 = N(p.k25, 0.1);
  const k = k25 * 2 ** ((Tc - 25) / 10);
  const th = Math.LN2 / k, tmax = 5 * th;
  B.labelSize = 0.42;
  const x = (t: number) => C0 * (1 - Math.exp(-k * t));
  const pl = plot(B, { origin: v3(0, 0, 0), w: 8, h: 5, xmax: tmax, ymin: 0, ymax: C0 * 1.1, xlabel: "t (min)", ylabel: "x (mmol/L)" });
  pl.curve(x, 0xe8590c);
  pl.curve(() => C0, 0x868e96, 2, true);
  line(B, [pl.map(th, 0), pl.map(th, C0 / 2), pl.map(0, C0 / 2)], 0x1c7ed6, B.m, true);
  B.label(`t½ = ${fmt(th, 2)} min`, pl.map(th, 0), { offset: v3(0, 0, -0.7), color: "#1c7ed6", scale: 0.7 });
  const tan = p.tangent ? liveLine(B, 2, 0x2f9e44) : null;
  const cur = pl.cursor();
  const bx = 11;
  const beaker = new THREE.Mesh(B.track(new THREE.CylinderGeometry(1, 1, 2, 32, 1, true)), mat(B, 0xdee2e6, { opacity: 0.25 }));
  beaker.rotation.x = Math.PI / 2; beaker.position.set(bx, 0, 1); B.m.add(beaker);
  const liq = new THREE.Mesh(B.track(new THREE.CylinderGeometry(0.95, 0.95, 1.4, 32)), mat(B, 0x9c5f2d, { opacity: 0.8 }));
  liq.rotation.x = Math.PI / 2; liq.position.set(bx, 0, 0.75); B.m.add(liq);
  const lab = liveLabel(B, v3(bx - 1.6, 0, 3), { scale: 0.75 });
  B.info.push({ label: T("Constante de vitesse à cette température", "ثابتة السرعة", "Rate constant"), value: `k ≈ ${fmt(k, 4)} min⁻¹ (×2 tous les 10 °C, ordre de grandeur)` });
  B.info.push({ label: T("Temps de demi-réaction", "زمن نصف التفاعل", "Half-reaction time"), value: `t½ = ln2 / k ≈ ${fmt(th, 3)} min` });
  B.info.push({ label: T("Vitesse volumique initiale", "السرعة الحجمية البدئية", "Initial rate"), value: `v₀ = k·C₀ ≈ ${fmt(k * C0, 3)} mmol·L⁻¹·min⁻¹` });
  B.info.push({ label: T("Facteur cinétique", "العامل الحركي", "Kinetic factor"), value: "la vitesse augmente avec la température et la concentration des réactifs" });
  const color0 = new THREE.Color(0x9c5f2d), color1 = new THREE.Color(0xf1f3f5);
  B.onFrame((t) => {
    const tt = ((t % 12) / 12) * tmax;
    const xx = x(tt);
    cur.set(tt, xx);
    const v = k * (C0 - xx);
    if (tan) { const dt = tmax * 0.18; tan.set([pl.map(Math.max(0, tt - dt), xx - v * dt), pl.map(Math.min(tmax, tt + dt), xx + v * dt)]); }
    (liq.material as THREE.MeshStandardMaterial).color.copy(color0.clone().lerp(color1, xx / C0));
    lab.set(`t = ${fmt(tt, 1)} min   x = ${fmt(xx, 2)} mmol/L   v = ${fmt(v, 3)}`);
  });
}

// ------------------------------------------------------------------ pile Daniell / électrolyse
export function electrochem(B: Builder, p: Params) {
  const pile = p.mode !== "electrolyse", I = N(p.I, 100) / 1000, tmin = N(p.t, 30);
  const F = 96500, Q = I * tmin * 60, ne = Q / F;
  B.labelSize = 0.42;
  const beaker = (x: number, color: number) => {
    const b = new THREE.Mesh(B.track(new THREE.CylinderGeometry(1.4, 1.4, 2.6, 32, 1, true)), mat(B, 0xdee2e6, { opacity: 0.22 }));
    b.rotation.x = Math.PI / 2; b.position.set(x, 0, 1.3); B.m.add(b);
    const l = new THREE.Mesh(B.track(new THREE.CylinderGeometry(1.35, 1.35, 1.9, 32)), mat(B, color, { opacity: 0.55 }));
    l.rotation.x = Math.PI / 2; l.position.set(x, 0, 0.95); B.m.add(l);
  };
  const path: V[] = [];
  const dots: THREE.Mesh[] = [];
  const bubbles: THREE.Mesh[] = [];
  if (pile) {
    beaker(-2.6, 0xe9ecef); beaker(2.6, 0x339af0);
    const thick = clamp(0.3 - ne * 30, 0.08, 0.3);
    box(B, v3(-2.6, 0, 1.6), 0.6, thick, 2.8, 0x868e96);
    box(B, v3(2.6, 0, 1.6), 0.6, 0.3 + clamp(ne * 30, 0, 0.2), 2.8, 0xd9480f);
    const bridge = [v3(-1.8, 0, 0.6), v3(-1.8, 0, 3.4), v3(1.8, 0, 3.4), v3(1.8, 0, 0.6)];
    B.m.add(new THREE.Mesh(B.track(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bridge, false, "catmullrom", 0.1), 60, 0.22, 12)), mat(B, 0xffffff, { opacity: 0.6 })));
    path.push(v3(-2.6, 0, 3), v3(-2.6, 0, 5), v3(2.6, 0, 5), v3(2.6, 0, 3));
    box(B, v3(0, 0, 5), 0.9, 0.5, 0.5, 0xfab005);
    if (p.labels) {
      B.label("Zn (−) anode", v3(-2.6, 0, 3.4), { offset: v3(-1.6, 0, 0), scale: 0.7 });
      B.label("Cu (+) cathode", v3(2.6, 0, 3.4), { offset: v3(1.7, 0, 0), scale: 0.7 });
      B.label("pont salin (K⁺, Cl⁻)", v3(0, 0, 3.8), { scale: 0.7 });
      B.label("Zn²⁺ + SO₄²⁻", v3(-2.6, 0, 0.3), { offset: v3(0, -1.6, 0), scale: 0.6 });
      B.label("Cu²⁺ + SO₄²⁻", v3(2.6, 0, 0.3), { offset: v3(0, -1.6, 0), scale: 0.6 });
      B.label("e⁻ →", v3(-1.2, 0, 5.4), { color: "#1c7ed6", scale: 0.7 });
    }
    B.info.push({ label: T("Anode (oxydation)", "الأنود (أكسدة)", "Anode (oxidation)"), value: "Zn → Zn²⁺ + 2 e⁻" });
    B.info.push({ label: T("Cathode (réduction)", "الكاثود (اختزال)", "Cathode (reduction)"), value: "Cu²⁺ + 2 e⁻ → Cu" });
    B.info.push({ label: T("Bilan / f.é.m.", "الحصيلة", "Overall / emf"), value: "Zn + Cu²⁺ → Zn²⁺ + Cu · E ≈ 1,10 V" });
    B.info.push({ label: T("Masses", "الكتل", "Masses"), value: `Δm(Zn) = −${fmt((ne / 2) * 65.4 * 1000, 1)} mg · Δm(Cu) = +${fmt((ne / 2) * 63.5 * 1000, 1)} mg` });
  } else {
    beaker(0, 0x63e6be);
    box(B, v3(-0.8, 0, 1.6), 0.25, 0.25, 2.8, 0x343a40);
    box(B, v3(0.8, 0, 1.6), 0.25, 0.25, 2.8, 0x343a40);
    box(B, v3(0.8, 0, 0.9), 0.25 + clamp(ne * 20, 0.02, 0.15), 0.25 + clamp(ne * 20, 0.02, 0.15), 1.2, 0xd9480f);
    path.push(v3(-0.8, 0, 3), v3(-0.8, 0, 4.6), v3(-0.3, 0, 4.6), v3(0.3, 0, 4.6), v3(0.8, 0, 4.6), v3(0.8, 0, 3));
    box(B, v3(0, 0, 4.6), 1, 0.6, 0.6, 0x495057);
    for (let i = 0; i < 14; i++) bubbles.push(ball(B, v3(-0.8, 0, 0), 0.07, 0xe9fac8));
    if (p.labels) {
      B.label("G", v3(0, 0, 5.2), { scale: 0.8 });
      B.label("anode (+) : Cl₂", v3(-0.8, 0, 3.4), { offset: v3(-1.6, 0, 0), scale: 0.7 });
      B.label("cathode (−) : dépôt de Cu", v3(0.8, 0, 3.4), { offset: v3(2, 0, 0), scale: 0.7 });
    }
    B.info.push({ label: T("Cathode (réduction)", "الكاثود (اختزال)", "Cathode (reduction)"), value: "Cu²⁺ + 2 e⁻ → Cu" });
    B.info.push({ label: T("Anode (oxydation)", "الأنود (أكسدة)", "Anode (oxidation)"), value: "2 Cl⁻ → Cl₂ + 2 e⁻" });
    B.info.push({ label: T("Transformation forcée", "تحول قسري", "Forced transformation"), value: "Cu²⁺ + 2 Cl⁻ → Cu + Cl₂ (imposée par le générateur)" });
    B.info.push({ label: T("Produits formés", "النواتج", "Products"), value: `m(Cu) = ${fmt((ne / 2) * 63.5 * 1000, 1)} mg · V(Cl₂) ≈ ${fmt((ne / 2) * 24 * 1000, 1)} mL (Vm = 24 L/mol)` });
  }
  B.info.unshift({ label: T("Quantité d'électricité", "كمية الكهرباء", "Charge"), value: `Q = I·Δt = ${fmt(Q, 1)} C · n(e⁻) = Q/F = ${fmt(ne * 1000, 3)} mmol` });
  line(B, path, 0x495057);
  const curve = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 0; i < path.length - 1; i++) curve.add(new THREE.LineCurve3(path[i], path[i + 1]));
  for (let i = 0; i < 10; i++) dots.push(ball(B, v3(0, 0, 0), 0.08, 0x1c7ed6));
  const ions = pile ? [ball(B, v3(0, 0, 0), 0.1, 0x7048e8), ball(B, v3(0, 0, 0), 0.12, 0x2f9e44)] : [];
  const sp = 0.05 + I * 0.5;
  B.onFrame((t) => {
    dots.forEach((d, i) => { d.position.copy(curve.getPointAt(((pile ? 1 : 1) * (t * sp + i / dots.length)) % 1)); });
    if (!pile) dots.forEach((d, i) => d.position.copy(curve.getPointAt(1 - ((t * sp + i / dots.length) % 1))));
    if (ions.length) {
      const u = (t * 0.15) % 1;
      ions[0].position.set(-1.8 + 3.6 * u, 0, 3.4); // K⁺ vers la cathode
      ions[1].position.set(1.8 - 3.6 * u, 0, 3.3); // Cl⁻ vers l'anode
    }
    bubbles.forEach((b, i) => { const u = (t * (0.3 + I) + i / bubbles.length) % 1; b.position.set(-0.8 + Math.sin(i * 3.1) * 0.18, Math.cos(i * 2.3) * 0.18, 0.3 + u * 1.6); });
  });
}

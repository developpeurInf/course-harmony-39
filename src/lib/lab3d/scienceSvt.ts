/** Scènes de SVT du Labo 3D */
import * as THREE from "three";
import type { Builder } from "./buildScene";
import type { Params } from "./templates";
import { N, T, ball, box, clamp, fmt, line, liveLabel, mat, rng, rod, tag, v3, type V } from "./scienceKit";

const capsule = (B: Builder, r: number, len: number, color: number, o: { opacity?: number } = {}) =>
  new THREE.Mesh(B.track(new THREE.CapsuleGeometry(r, Math.max(0.001, len), 6, 14)), mat(B, color, o));
const orient = (m: THREE.Object3D, dir: V) => m.quaternion.setFromUnitVectors(v3(0, 1, 0), dir.clone().normalize());

// ------------------------------------------------------------------ cellule
export function cell(B: Builder, p: Params) {
  const plant = p.type === "plant", cut = !!p.cut, L = !!p.labels;
  B.labelSize = 0.45;
  const rnd = rng(plant ? 11 : 7);
  const g = new THREE.Group();
  B.m.add(g);
  const tags: [string, V, V][] = [];
  const moving: { m: THREE.Object3D; c: V; r: number; ph: number }[] = [];
  if (plant) {
    const W = 6, D = 3.6, H = 3.6;
    const wall = new THREE.Mesh(B.track(new THREE.BoxGeometry(W + 0.3, D + 0.3, H + 0.3)), mat(B, 0x8ce99a, { opacity: cut ? 0.12 : 0.55 }));
    wall.position.z = H / 2; g.add(wall);
    const mem = new THREE.Mesh(B.track(new THREE.BoxGeometry(W, D, H)), mat(B, 0xb2f2bb, { opacity: cut ? 0.1 : 0.4 }));
    mem.position.z = H / 2; g.add(mem);
    const vac = new THREE.Mesh(B.track(new THREE.SphereGeometry(1, 32, 24)), mat(B, 0xa5d8ff, { opacity: 0.45 }));
    vac.scale.set(2.1, 1.3, 1.3); vac.position.set(0.5, 0, H / 2); g.add(vac);
    const nuc = ball(B, v3(-2.2, 0.6, H / 2 + 0.6), 0.75, 0x9775fa, g, 28);
    ball(B, v3(-2.2, 0.6, H / 2 + 0.95), 0.25, 0x5f3dc4, g);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * 2 * Math.PI;
      const c = capsule(B, 0.16, 0.35, 0x2b8a3e);
      const pos = v3(0.5 + 2.55 * Math.cos(a), 1.45 * Math.sin(a) * 0.95, H / 2 + 1.45 * Math.sin(a * 2) * 0.8);
      c.position.copy(pos); orient(c, v3(-Math.sin(a), Math.cos(a), 0)); g.add(c);
      moving.push({ m: c, c: v3(0.5, 0, H / 2), r: 2.55, ph: a });
    }
    for (let i = 0; i < 5; i++) { const m = capsule(B, 0.12, 0.3, 0xf08c00); m.position.set(-2.4 + rnd() * 1.2, -1.2 + rnd() * 0.6, 0.6 + rnd() * 2.2); orient(m, v3(rnd(), rnd(), rnd())); g.add(m); }
    tags.push(["paroi (cellulose)", v3(W / 2, -D / 2, H), v3(W / 2 + 1.2, -D / 2, H + 1.2)], ["membrane plasmique", v3(W / 2 - 0.1, 0, H * 0.75), v3(W / 2 + 1.8, 0, H * 0.75)],
      ["vacuole", v3(0.5, 0, H / 2 + 1.3), v3(1.2, 0, H + 1.4)], ["noyau", nuc.position.clone(), v3(-3.6, 0.6, H + 1.2)], ["chloroplaste", (moving[3].m as THREE.Mesh).position.clone(), v3(3.6, 0, -0.6)], ["mitochondrie", v3(-2, -1, 1), v3(-4.2, -1, 0)]);
    B.info.push({ label: T("Particularités de la cellule végétale", "خصائص الخلية النباتية", "Plant-cell features"), value: "paroi cellulosique, grande vacuole, chloroplastes (photosynthèse)" });
  } else {
    const R = 3;
    const mem = new THREE.Mesh(B.track(new THREE.SphereGeometry(R, 48, 32, 0, cut ? Math.PI * 1.5 : Math.PI * 2)), mat(B, 0xffc9c9, { opacity: cut ? 0.5 : 0.35 }));
    mem.rotation.x = Math.PI / 2; mem.position.z = R; g.add(mem);
    const nuc = ball(B, v3(0, 0, R), 1, 0x9775fa, g, 32);
    ball(B, v3(0.3, 0.2, R + 0.4), 0.32, 0x5f3dc4, g);
    for (let i = 0; i < 4; i++) {
      const t = new THREE.Mesh(B.track(new THREE.TorusGeometry(1.35 + i * 0.22, 0.05, 6, 40, Math.PI * 0.9)), mat(B, 0x74c0fc));
      t.position.set(0, 0, R); t.rotation.set(0.3 * i, 0.2, i); g.add(t);
    }
    for (let i = 0; i < 5; i++) {
      const d = new THREE.Mesh(B.track(new THREE.CylinderGeometry(0.6 - i * 0.05, 0.6 - i * 0.05, 0.06, 24)), mat(B, 0xcc5de8));
      d.position.set(-1.9, 1, R - 0.6 + i * 0.15); d.rotation.x = Math.PI / 2 + 0.2; g.add(d);
    }
    for (let i = 0; i < 10; i++) {
      const m = capsule(B, 0.18, 0.45, 0xf08c00);
      let q: V;
      do { q = v3(rnd() * 4.4 - 2.2, rnd() * 4.4 - 2.2, R + rnd() * 3 - 1.5); } while (q.distanceTo(v3(0, 0, R)) < 1.4 || q.distanceTo(v3(0, 0, R)) > 2.5);
      m.position.copy(q); orient(m, v3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5)); g.add(m);
      moving.push({ m, c: q.clone(), r: 0.08, ph: i });
    }
    for (let i = 0; i < 6; i++) { let q: V; do { q = v3(rnd() * 4 - 2, rnd() * 4 - 2, R + rnd() * 3 - 1.5); } while (q.distanceTo(v3(0, 0, R)) < 1.3 || q.distanceTo(v3(0, 0, R)) > 2.6); ball(B, q, 0.18, 0x51cf66, g); }
    tags.push(["membrane plasmique", v3(R * 0.7, -R * 0.7, R), v3(R + 1.2, -R, R + 1.5)], ["noyau", nuc.position.clone().add(v3(0, -0.9, 0.3)), v3(0, -R - 1.4, R + 2.2)], ["nucléole", v3(0.3, 0.2, R + 0.4), v3(1.6, 2, R + 3)],
      ["réticulum endoplasmique", v3(1.4, 0, R + 0.4), v3(R + 1.6, 1, R + 2.6)], ["appareil de Golgi", v3(-1.9, 1, R), v3(-R - 1.6, 1.5, R + 1.8)], ["mitochondrie", moving[0].c.clone(), v3(-R - 1.2, -1.5, R - 1.5)], ["lysosome / vésicule", v3(1.5, 1.5, R - 1), v3(R + 1.2, 2, R - 2)]);
    B.info.push({ label: T("Cellule animale", "الخلية الحيوانية", "Animal cell"), value: "pas de paroi ni de chloroplaste ; centrosome et petites vacuoles" });
  }
  if (L) tags.forEach(([n, at, lp]) => tag(B, n, at, lp, undefined, g));
  B.info.push({ label: T("Unité du vivant", "وحدة الكائن الحي", "Unit of life"), value: "tout être vivant est constitué de cellules (taille ≈ 10 à 100 µm)" });
  B.info.push({ label: T("Énergie", "الطاقة", "Energy"), value: plant ? "chloroplaste : énergie lumineuse → matière organique ; mitochondrie : respiration → ATP" : "mitochondrie : respiration cellulaire → ATP" });
  B.onFrame((t) => moving.forEach((o) => {
    if (plant) { const a = o.ph + t * 0.15; o.m.position.set(o.c.x + o.r * Math.cos(a), 1.4 * Math.sin(a) * 0.95, o.c.z + 1.4 * Math.sin(a * 2) * 0.8); }
    else o.m.position.set(o.c.x + Math.sin(t + o.ph) * o.r, o.c.y + Math.cos(t * 0.8 + o.ph) * o.r, o.c.z);
  }));
}

// ------------------------------------------------------------------ chloroplaste / mitochondrie / sarcomère
export function organelle(B: Builder, p: Params) {
  const mode = String(p.mode || "chloroplast"), L = !!p.labels;
  B.labelSize = 0.42;
  if (mode === "chloroplast") {
    const env = new THREE.Mesh(B.track(new THREE.SphereGeometry(1, 48, 32, 0, Math.PI * 1.4)), mat(B, 0x8ce99a, { opacity: 0.4 }));
    env.scale.set(4, 2.2, 1.6); env.position.z = 1.6; B.m.add(env);
    const env2 = new THREE.Mesh(B.track(new THREE.SphereGeometry(1, 48, 32, 0, Math.PI * 1.4)), mat(B, 0x69db7c, { opacity: 0.3 }));
    env2.scale.set(3.85, 2.08, 1.48); env2.position.z = 1.6; B.m.add(env2);
    const grana: V[] = [v3(-2.4, -0.4, 1.6), v3(-1.2, 0.6, 1.5), v3(0, -0.5, 1.7), v3(1.2, 0.5, 1.5), v3(2.4, -0.3, 1.6), v3(-0.6, 0.1, 1.2), v3(0.7, -0.1, 2)];
    grana.forEach((c) => { for (let i = 0; i < 7; i++) { const d = new THREE.Mesh(B.track(new THREE.CylinderGeometry(0.42, 0.42, 0.07, 24)), mat(B, 0x2b8a3e)); d.rotation.x = Math.PI / 2; d.position.set(c.x, c.y, c.z - 0.42 + i * 0.12); B.m.add(d); } });
    for (let i = 0; i < grana.length - 2; i++) box(B, grana[i].clone().lerp(grana[i + 1], 0.5), grana[i].distanceTo(grana[i + 1]), 0.25, 0.03, 0x40c057).lookAt(grana[i + 1]);
    const st = new THREE.Mesh(B.track(new THREE.SphereGeometry(0.45, 20, 14)), mat(B, 0xf8f9fa)); st.scale.set(1.4, 1, 0.8); st.position.set(-1.6, -1, 1.3); B.m.add(st);
    for (let i = 0; i < 8; i++) ball(B, v3(-3 + i * 0.8, 1.1 - (i % 2) * 2.1, 1.3 + (i % 3) * 0.2), 0.1, 0xfab005);
    if (L) { tag(B, "enveloppe (2 membranes)", v3(3.4, -1, 2.4), v3(4.6, -1.5, 3.6)); tag(B, "granum (thylakoïdes empilés)", grana[2].clone().add(v3(0, 0, 0.4)), v3(0.5, -1.8, 3.8)); tag(B, "thylakoïde intergranaire", grana[0].clone().lerp(grana[1], 0.5), v3(-3.2, 1.6, 3.4)); tag(B, "stroma", v3(1.8, -0.9, 1.2), v3(3.4, -2.6, 0.4)); tag(B, "grain d'amidon", st.position.clone(), v3(-3.6, -2.4, 0.2)); }
    B.info.push({ label: T("Phase claire (thylakoïdes)", "المرحلة المضيئة", "Light phase"), value: "photolyse de l'eau, libération de O₂, production d'ATP et de RH₂" });
    B.info.push({ label: T("Phase sombre (stroma)", "المرحلة المظلمة", "Dark phase"), value: "cycle de Calvin : fixation du CO₂ → glucides (amidon)" });
    B.info.push({ label: T("Bilan", "الحصيلة", "Overall"), value: "6 CO₂ + 12 H₂O → C₆H₁₂O₆ + 6 O₂ + 6 H₂O (énergie lumineuse)" });
    return;
  }
  if (mode === "mitochondria") {
    const outer = new THREE.Mesh(B.track(new THREE.CapsuleGeometry(1.4, 4, 8, 32)), mat(B, 0xffa94d, { opacity: 0.35 }));
    outer.rotation.z = Math.PI / 2; outer.position.z = 1.6; B.m.add(outer);
    const inner = new THREE.Mesh(B.track(new THREE.CapsuleGeometry(1.25, 3.8, 8, 32)), mat(B, 0xff922b, { opacity: 0.25 }));
    inner.rotation.z = Math.PI / 2; inner.position.z = 1.6; B.m.add(inner);
    for (let i = 0; i < 9; i++) {
      const x = -2.4 + i * 0.6;
      const c = new THREE.Mesh(B.track(new THREE.BoxGeometry(0.06, 1.6, 1.8, 1, 8, 8)), mat(B, 0xe8590c));
      const pos = c.geometry.attributes.position as THREE.BufferAttribute;
      for (let k = 0; k < pos.count; k++) pos.setX(k, pos.getX(k) + Math.sin(pos.getZ(k) * 4 + i) * 0.12);
      c.geometry.computeVertexNormals();
      c.position.set(x, i % 2 ? 0.45 : -0.45, 1.6); B.m.add(c);
    }
    for (let i = 0; i < 20; i++) ball(B, v3(-2.6 + (i % 10) * 0.6, i < 10 ? 0.9 : -0.9, 1.6 + Math.sin(i) * 0.6), 0.06, 0xfab005);
    if (L) { tag(B, "membrane externe", v3(0, -1.4, 2.2), v3(0, -2.8, 3.6)); tag(B, "membrane interne (crêtes)", v3(-0.6, 0.45, 2.3), v3(-2.4, 2.4, 3.6)); tag(B, "matrice (cycle de Krebs)", v3(1.5, 0, 1.6), v3(3.4, 2.2, 3.2)); tag(B, "espace intermembranaire", v3(2.6, -1.3, 1.6), v3(4.6, -2.2, 0.8)); }
    B.info.push({ label: T("Glycolyse (hyaloplasme)", "انحلال الكليكوز", "Glycolysis"), value: "glucose → 2 pyruvates + 2 ATP + 2 RH₂" });
    B.info.push({ label: T("Matrice", "المادة الأساسية", "Matrix"), value: "cycle de Krebs : pyruvate → CO₂ + RH₂ + ATP" });
    B.info.push({ label: T("Crêtes (chaîne respiratoire)", "الأعراف (السلسلة التنفسية)", "Cristae (respiratory chain)"), value: "oxydation des RH₂, O₂ accepteur final → H₂O, synthèse de l'ATP par l'ATP synthase" });
    B.info.push({ label: T("Bilan de la respiration", "حصيلة التنفس", "Respiration"), value: "C₆H₁₂O₆ + 6 O₂ → 6 CO₂ + 6 H₂O + 36 à 38 ATP · fermentation : 2 ATP" });
    return;
  }
  // sarcomère
  const cmax = N(p.contraction);
  const A = 1.6, thin = 1.0, s = 3; // µm → unités
  const grp = new THREE.Group();
  B.m.add(grp);
  const zL = box(B, v3(0, 0, 0), 0.08, 2.4, 2.4, 0x343a40, grp), zR = box(B, v3(0, 0, 0), 0.08, 2.4, 2.4, 0x343a40, grp);
  const grid: [number, number][] = [];
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) grid.push([i * 0.45, j * 0.45]);
  const myo = grid.filter(([y, z]) => (Math.round(y / 0.45) + Math.round(z / 0.45)) % 2 === 0);
  const act = grid.filter(([y, z]) => (Math.round(y / 0.45) + Math.round(z / 0.45)) % 2 !== 0);
  myo.forEach(([y, z]) => {
    const m = new THREE.Mesh(B.track(new THREE.CylinderGeometry(0.07, 0.07, A * s, 8)), mat(B, 0xe64980));
    m.rotation.z = Math.PI / 2; m.position.set(0, y, z + 1.4); grp.add(m);
    for (let k = 0; k < 14; k++) { const x = (k < 7 ? -A / 2 + 0.05 + k * 0.09 : A / 2 - 0.05 - (k - 7) * 0.09) * s; if (Math.abs(x) < 0.4) continue; ball(B, v3(x, y + 0.09, z + 1.4 + (k % 2 ? 0.08 : -0.08)), 0.04, 0xc2255c, grp, 6); }
  });
  const actinL = act.map(([y, z]) => { const m = new THREE.Mesh(B.track(new THREE.CylinderGeometry(0.035, 0.035, thin * s, 6)), mat(B, 0x1c7ed6)); m.rotation.z = Math.PI / 2; m.position.set(0, y, z + 1.4); grp.add(m); return m; });
  const actinR = act.map(([y, z]) => { const m = new THREE.Mesh(B.track(new THREE.CylinderGeometry(0.035, 0.035, thin * s, 6)), mat(B, 0x1c7ed6)); m.rotation.z = Math.PI / 2; m.position.set(0, y, z + 1.4); grp.add(m); return m; });
  const lab = liveLabel(B, v3(-4, 0, 3.6), { scale: 0.75 });
  if (L) { B.label("myosine (filament épais)", v3(0, -1.6, 3.2), { scale: 0.7, color: "#c2255c" }); B.label("actine (filament fin)", v3(0, 1.6, 3.2), { scale: 0.7, color: "#1c7ed6" }); }
  const Ls0 = 2.5;
  B.info.push({ label: T("Mécanisme", "الآلية", "Mechanism"), value: "glissement des filaments d'actine entre les filaments de myosine (ATP + Ca²⁺)" });
  B.info.push({ label: T("Ce qui change", "ما يتغير", "What changes"), value: "bande I et zone H raccourcissent ; la bande A (myosine) garde sa longueur" });
  const zL0 = zL.position.clone(); void zL0;
  B.onFrame((t) => {
    const c = cmax * (0.5 - 0.5 * Math.cos(t * 1.2));
    const Ls = Ls0 - c * 0.8;
    const half = (Ls / 2) * s;
    zL.position.set(-half, 0, 1.4); zR.position.set(half, 0, 1.4);
    actinL.forEach((m) => (m.position.x = -half + (thin * s) / 2));
    actinR.forEach((m) => (m.position.x = half - (thin * s) / 2));
    const I = Ls - A, H = Math.max(0, Ls - 2 * thin);
    lab.set(`sarcomère = ${fmt(Ls, 2)} µm   bande A = ${fmt(A, 2)} µm   bande I = ${fmt(I, 2)} µm   zone H = ${fmt(H, 2)} µm`);
  });
}

// ------------------------------------------------------------------ ADN
const CODE = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";
const AA3: Record<string, string> = { F: "Phe", L: "Leu", S: "Ser", Y: "Tyr", C: "Cys", W: "Trp", P: "Pro", H: "His", Q: "Gln", R: "Arg", I: "Ile", M: "Met", T: "Thr", N: "Asn", K: "Lys", V: "Val", A: "Ala", D: "Asp", E: "Glu", G: "Gly", "*": "Stop" };
const BASE_COL: Record<string, number> = { A: 0xe03131, T: 0xfab005, U: 0x9c36b5, G: 0x2f9e44, C: 0x1c7ed6 };
export function dna(B: Builder, p: Params) {
  const seq = (String(p.seq || "TACGGATTCACT").toUpperCase().replace(/[^ATGC]/g, "") || "TACGGA").slice(0, 30);
  const mode = String(p.mode || "helix"), open = mode === "helix" ? 0 : N(p.open, 0.6);
  const comp = (b: string) => ({ A: "T", T: "A", G: "C", C: "G" } as Record<string, string>)[b];
  const n = seq.length, rise = 0.55, R = 1.5;
  B.labelSize = 0.42;
  const grp = new THREE.Group();
  B.m.add(grp);
  const s1: V[] = [], s2: V[] = [];
  const o = (i: number) => clamp(((n - 1 - i) / Math.max(1, n - 1) - (1 - open)) * 3 + 0.0001, 0, 1) * (open > 0 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const a = (i * 36 * Math.PI) / 180, z = i * rise;
    const oi = o(i);
    const h1 = v3(R * Math.cos(a), R * Math.sin(a), z), h2 = v3(R * Math.cos(a + Math.PI * 0.8), R * Math.sin(a + Math.PI * 0.8), z);
    const u1 = v3(-R - 1.2, 0, z), u2 = v3(R + 1.2, 0, z);
    s1.push(h1.lerp(u1, oi)); s2.push(h2.lerp(u2, oi));
  }
  const tube = (pts: V[], color: number) => {
    if (pts.length < 2) return;
    grp.add(new THREE.Mesh(B.track(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 8, 0.12, 8)), mat(B, color)));
    pts.forEach((q) => ball(B, q, 0.17, color, grp, 10));
  };
  tube(s1, 0x868e96); tube(s2, 0xadb5bd);
  const newStrand1: V[] = [], newStrand2: V[] = [], rna: V[] = [];
  let mrna = "";
  for (let i = 0; i < n; i++) {
    const b1 = seq[i], b2 = comp(b1);
    const oi = o(i);
    if (oi < 0.5) {
      const mid = s1[i].clone().lerp(s2[i], 0.5);
      rod(B, s1[i], mid, 0.1, BASE_COL[b1], grp);
      rod(B, mid, s2[i], 0.1, BASE_COL[b2], grp);
    } else {
      rod(B, s1[i], s1[i].clone().add(v3(0.9, 0, 0)), 0.1, BASE_COL[b1], grp);
      rod(B, s2[i], s2[i].clone().add(v3(-0.9, 0, 0)), 0.1, BASE_COL[b2], grp);
      if (mode === "replication") {
        const q1 = s1[i].clone().add(v3(1.9, 0, 0)), q2 = s2[i].clone().add(v3(-1.9, 0, 0));
        rod(B, q1, q1.clone().add(v3(-1, 0, 0)), 0.1, BASE_COL[b2], grp); newStrand1.push(q1);
        rod(B, q2, q2.clone().add(v3(1, 0, 0)), 0.1, BASE_COL[b1], grp); newStrand2.push(q2);
      }
      if (mode === "transcription") {
        const q = s1[i].clone().add(v3(1.9, -0.4, 0));
        const rb = b1 === "A" ? "U" : comp(b1);
        rod(B, q, q.clone().add(v3(-1, 0.4, 0)), 0.1, BASE_COL[rb], grp); rna.push(q);
      }
    }
    if (p.labels && oi < 0.5) B.label(b1, s1[i], { parent: grp, scale: 0.6, offset: v3(0, 0, 0.3) });
  }
  tube(newStrand1, 0xffc078); tube(newStrand2, 0xffc078); tube(rna, 0x9c36b5);
  for (const b of seq) mrna += b === "A" ? "U" : b === "T" ? "A" : b === "G" ? "C" : "G";
  const idx = (c: string) => "UCAG".indexOf(c);
  const aas: string[] = [];
  const start = mrna.indexOf("AUG");
  if (start >= 0) for (let i = start; i + 2 < mrna.length; i += 3) { const aa = CODE[idx(mrna[i]) * 16 + idx(mrna[i + 1]) * 4 + idx(mrna[i + 2])]; aas.push(AA3[aa]); if (aa === "*") break; }
  const gc = (seq.split("").filter((b) => b === "G" || b === "C").length / n) * 100;
  B.info.push({ label: T("Brin transcrit (3' → 5')", "اللولب المنسوخ", "Template strand"), value: seq });
  B.info.push({ label: T("Brin non transcrit (5' → 3')", "اللولب غير المنسوخ", "Coding strand"), value: seq.split("").map(comp).join("") });
  B.info.push({ label: T("ARN messager (5' → 3')", "ARNm", "mRNA"), value: mrna.match(/.{1,3}/g)?.join(" ") || mrna });
  B.info.push({ label: T("Chaîne peptidique", "السلسلة البيبتيدية", "Peptide"), value: start >= 0 ? aas.join(" – ") : "pas de codon d'initiation AUG" });
  B.info.push({ label: T("Complémentarité", "التكامل", "Pairing"), value: `A = T, G ≡ C · %(G + C) = ${fmt(gc, 1)} %` });
  if (mode === "replication") B.info.push({ label: T("Réplication semi-conservative", "التضاعف نصف المحافظ", "Semi-conservative replication"), value: "chaque nouvelle molécule garde un brin ancien (gris) et un brin néoformé (orange)" });
  B.onFrame((t) => { if (mode === "helix") grp.rotation.z = t * 0.3; });
  grp.position.z = 0.5;
}

// ------------------------------------------------------------------ mitose / méiose
type Chromatid = { pos: V; dir: V; len: number; color: number; tip?: number };
export function division(B: Builder, p: Params) {
  const meiosis = p.type === "meiosis", ph = clamp(N(p.phase, 0.35), 0, 1), n = clamp(Math.round(N(p.pairs, 2)), 1, 4), co = !!p.crossing;
  B.labelSize = 0.45;
  const lens = [1.3, 1.0, 0.75, 0.55];
  const hue = (k: number) => k / n;
  const col = (k: number, pat: boolean) => new THREE.Color().setHSL(hue(k) * 0.85, 0.75, pat ? 0.65 : 0.4).getHex();
  const items: Chromatid[] = [];
  const cells: { c: V; r: V }[] = [];
  const spindles: [V, V][] = [];
  const up = v3(0, 0, 1);
  const chrom = (center: V, k: number, pat: boolean, dir: V, sep: number, single = false, swap = false) => {
    const len = lens[k];
    const side = dir.clone().cross(v3(0, 1, 0)).length() > 0.1 ? dir.clone().cross(v3(0, 1, 0)).normalize() : v3(1, 0, 0);
    const offs = single ? [0] : [-1, 1];
    offs.forEach((s, i) => items.push({ pos: center.clone().addScaledVector(side, s * (0.14 + sep)), dir, len, color: col(k, pat), tip: co && meiosis && swap && i === 1 ? col(k, !pat) : undefined }));
  };
  let stage = "", count = "", dnaQ = "";
  if (!meiosis) {
    const st = ph < 0.2 ? 0 : ph < 0.4 ? 1 : ph < 0.6 ? 2 : ph < 0.8 ? 3 : 4;
    const u = (ph - [0, 0.2, 0.4, 0.6, 0.8][st]) / 0.2;
    stage = ["Interphase (phase S : réplication de l'ADN)", "Prophase", "Métaphase", "Anaphase", "Télophase"][st];
    count = st < 4 ? `2n = ${2 * n} chromosomes` : `2 cellules filles à 2n = ${2 * n}`;
    dnaQ = st === 0 ? "Q → 2Q" : st < 4 ? "2Q" : "Q par cellule";
    const rnd = rng(3);
    if (st === 4) { cells.push({ c: v3(-1.9, 0, 2), r: v3(1.8, 1.8, 1.8) }, { c: v3(1.9, 0, 2), r: v3(1.8, 1.8, 1.8) }); }
    else cells.push({ c: v3(0, 0, 2), r: v3(st === 3 ? 3.4 + u * 0.6 : 3, 2.4, 2.4) });
    for (let k = 0; k < n; k++) for (const pat of [false, true]) {
      const idx = k * 2 + (pat ? 1 : 0);
      const zc = 2 + (idx - n + 0.5) * (3 / (2 * n));
      if (st <= 1) chrom(v3(rnd() * 1.8 - 0.9, rnd() * 1.4 - 0.7, 2 + rnd() * 1.4 - 0.7), k, pat, v3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), st === 0 ? 0.1 : 0, false);
      else if (st === 2) { chrom(v3(0, 0, zc), k, pat, v3(0, 1, 0), 0); spindles.push([v3(-3, 0, 2), v3(-0.15, 0, zc)], [v3(3, 0, 2), v3(0.15, 0, zc)]); }
      else {
        const d = st === 3 ? 0.3 + u * 2.3 : 2.4;
        [-1, 1].forEach((s) => { items.push({ pos: v3(s * d, 0, zc), dir: v3(-s * 0.6, 1, 0).normalize(), len: lens[k], color: col(k, pat) }); if (st === 3) spindles.push([v3(s * 3.2, 0, 2), v3(s * d, 0, zc)]); });
      }
    }
  } else {
    const st = Math.min(6, Math.floor(ph * 7));
    const u = ph * 7 - st;
    stage = ["Prophase I (appariement, crossing-over)", "Métaphase I (bivalents sur la plaque)", "Anaphase I (séparation des homologues)", "Télophase I (2 cellules à n chromosomes)", "Métaphase II", "Anaphase II (séparation des chromatides)", "Télophase II (4 cellules haploïdes)"][st];
    count = st <= 2 ? `2n = ${2 * n}` : `n = ${n} par cellule`;
    dnaQ = st <= 2 ? "2Q" : st <= 4 ? "Q par cellule" : st === 5 ? "Q → Q/2" : "Q/2 par cellule";
    const assort = (k: number) => k % 2 === 0; // répartition indépendante des paires
    if (st <= 2) cells.push({ c: v3(0, 0, 2), r: v3(st === 2 ? 3.4 + u * 0.6 : 3, 2.4, 2.4) });
    else if (st <= 5) cells.push({ c: v3(-2.6, 0, 2), r: v3(2.2, 2, 2) }, { c: v3(2.6, 0, 2), r: v3(2.2, 2, 2) });
    else [-1, 1].forEach((sx) => [-1, 1].forEach((sy) => cells.push({ c: v3(sx * 2.6, sy * 1.9, 2), r: v3(1.5, 1.5, 1.5) })));
    for (let k = 0; k < n; k++) {
      const zc = 2 + (k - (n - 1) / 2) * (3 / n);
      const leftPat = assort(k);
      if (st === 0) { const c = v3(-1 + (k % 2) * 1.6, -0.4 + k * 0.3, zc); chrom(c.clone().add(v3(-0.2, 0, 0)), k, false, v3(0, 1, 0.3).normalize(), 0, false, true); chrom(c.clone().add(v3(0.2, 0, 0)), k, true, v3(0, 1, 0.3).normalize(), 0, false, true); }
      else if (st === 1 || st === 2) {
        const d = st === 1 ? 0.35 : 0.35 + u * 2.2;
        chrom(v3(-d, 0, zc), k, leftPat ? true : false, v3(0, 1, 0), 0, false, true);
        chrom(v3(d, 0, zc), k, leftPat ? false : true, v3(0, 1, 0), 0, false, true);
        spindles.push([v3(-3.2, 0, 2), v3(-d, 0, zc)], [v3(3.2, 0, 2), v3(d, 0, zc)]);
      } else if (st === 3 || st === 4) {
        [-1, 1].forEach((s) => {
          const pat = s < 0 ? leftPat : !leftPat;
          const c = st === 3 ? v3(s * 2.6 + (k - (n - 1) / 2) * 0.5, -0.3, zc) : v3(s * 2.6, 0, zc);
          chrom(c, k, pat, st === 4 ? v3(1, 0, 0) : v3(0.3, 1, 0).normalize(), 0, false, true);
          if (st === 4) spindles.push([v3(s * 2.6, -1.8, 2), c.clone().add(v3(0, -0.15, 0))], [v3(s * 2.6, 1.8, 2), c.clone().add(v3(0, 0.15, 0))]);
        });
      } else {
        [-1, 1].forEach((s) => {
          const pat = s < 0 ? leftPat : !leftPat;
          const d = st === 5 ? 0.2 + u * 1.5 : 1.9;
          [-1, 1].forEach((sy, i) => items.push({ pos: v3(s * 2.6, sy * d, st === 6 ? 2 + (k - (n - 1) / 2) * 0.6 : zc), dir: v3(1, 0, 0), len: lens[k], color: col(k, pat), tip: co && i === 1 ? col(k, !pat) : undefined }));
        });
      }
    }
  }
  cells.forEach(({ c, r }) => { const m = new THREE.Mesh(B.track(new THREE.SphereGeometry(1, 40, 28)), mat(B, 0xffc9c9, { opacity: 0.22 })); m.scale.copy(r); m.position.copy(c); B.m.add(m); });
  if (!meiosis && ph < 0.4) { const nm = new THREE.Mesh(B.track(new THREE.SphereGeometry(1.35, 32, 24)), mat(B, 0x9775fa, { opacity: ph < 0.2 ? 0.25 : 0.1 })); nm.position.set(0, 0, 2); B.m.add(nm); }
  if (spindles.length) B.segments(spindles, B.lineMat(0x51cf66));
  items.forEach((c) => {
    const m = capsule(B, 0.11, c.len, c.color);
    m.position.copy(c.pos); orient(m, c.dir); B.m.add(m);
    if (c.tip !== undefined) { const t = capsule(B, 0.115, c.len * 0.25, c.tip); t.position.copy(c.pos.clone().addScaledVector(c.dir, c.len * 0.38)); orient(t, c.dir); B.m.add(t); }
    ball(B, c.pos, 0.09, 0x212529, B.m, 8);
  });
  void up;
  B.label(stage, v3(-3.5, 0, 4.9), { scale: 0.85 });
  B.info.push({ label: T("Phase", "المرحلة", "Phase"), value: stage });
  B.info.push({ label: T("Nombre de chromosomes", "عدد الصبغيات", "Chromosome number"), value: count });
  B.info.push({ label: T("Quantité d'ADN", "كمية ADN", "DNA amount"), value: dnaQ });
  B.info.push({ label: T("Couleurs", "الألوان", "Colours"), value: "foncé : origine maternelle · clair : origine paternelle" });
  if (meiosis) B.info.push({ label: T("Brassages", "التخليط", "Shuffling"), value: "interchromosomique (anaphase I, répartition au hasard) et intrachromosomique (crossing-over, prophase I)" });
}

// ------------------------------------------------------------------ échiquier de croisement
export function punnett(B: Builder, p: Params) {
  const cross = String(p.cross || "di"), codom = p.dominance === "co";
  const di = cross.startsWith("di"), test = cross.endsWith("test");
  B.labelSize = 0.45;
  const g1 = di ? ["JR", "Jr", "jR", "jr"] : ["J", "j"];
  const g2 = test ? (di ? ["jr"] : ["j"]) : g1;
  const cs = 1.4;
  const counts: Record<string, number> = {};
  const colorOf = (gt: string) => {
    const J = (gt.match(/J/g) || []).length;
    if (codom) return J === 2 ? 0xfcc419 : J === 1 ? 0xc0eb75 : 0x51cf66;
    return J > 0 ? 0xfcc419 : 0x51cf66;
  };
  const phen = (gt: string) => {
    const J = (gt.match(/J/g) || []).length, Rr = (gt.match(/R/g) || []).length;
    const c = codom ? (J === 2 ? "jaune" : J === 1 ? "jaune-vert" : "vert") : J > 0 ? "jaune" : "vert";
    return di ? `${c}, ${Rr > 0 ? "lisse" : "ridé"}` : c;
  };
  g2.forEach((b, i) => B.label(b, v3((i + 0.5) * cs, 0, 0.6), { scale: 0.85, color: "#c2255c" }));
  g1.forEach((a, j) => B.label(a, v3(-0.6, 0, -(j + 0.5) * cs), { scale: 0.85, color: "#1c7ed6" }));
  B.label("♂ \\ ♀", v3(-0.6, 0, 0.6), { scale: 0.7 });
  g1.forEach((a, j) => g2.forEach((b, i) => {
    const gt = di ? [a[0], b[0]].sort().join("") + [a[1], b[1]].sort().join("") : [a, b].sort().join("");
    const c = v3((i + 0.5) * cs, 0, -(j + 0.5) * cs);
    box(B, c.clone().add(v3(0, 0.3, 0)), cs * 0.95, 0.1, cs * 0.95, 0xf1f3f5);
    const wr = di && !(gt.match(/R/g) || []).length;
    const pea = new THREE.Mesh(B.track(new THREE.IcosahedronGeometry(0.38, wr ? 1 : 4)), mat(B, colorOf(gt), { flat: wr, rough: 0.4 }));
    if (wr) { const pos = pea.geometry.attributes.position as THREE.BufferAttribute; for (let k = 0; k < pos.count; k++) { const f = 0.85 + 0.15 * Math.sin(k * 12.9898); pos.setXYZ(k, pos.getX(k) * f, pos.getY(k) * f, pos.getZ(k) * f); } pea.geometry.computeVertexNormals(); }
    pea.position.copy(c.clone().add(v3(0, -0.2, 0.15)));
    B.m.add(pea);
    B.label(gt, c.clone().add(v3(0, -0.4, -0.5)), { scale: 0.55 });
    const ph2 = phen(gt);
    counts[ph2] = (counts[ph2] || 0) + 1;
  }));
  const total = g1.length * g2.length;
  B.info.push({ label: T("Gènes et allèles", "المورثات والحليلات", "Genes and alleles"), value: di ? "couleur : J (jaune) / j (vert) · forme : R (lisse) / r (ridé)" : `couleur : J (jaune) / j (vert)${codom ? " — codominance" : " — J dominant"}` });
  B.info.push({ label: T("Parents", "الآباء", "Parents"), value: test ? (di ? "F1 (JjRr) × double récessif (jjrr)" : "F1 (Jj) × récessif (jj)") : di ? "F1 (JjRr) × F1 (JjRr)" : "F1 (Jj) × F1 (Jj)" });
  B.info.push({ label: T("Phénotypes obtenus", "المظاهر الخارجية", "Phenotypes"), value: Object.entries(counts).map(([k, v]) => `${k} : ${v}/${total}`).join(" · ") });
  B.info.push({ label: T("Interprétation", "التفسير", "Interpretation"), value: di ? (test ? "4 phénotypes en proportions égales : gènes indépendants" : "9/16 · 3/16 · 3/16 · 1/16 : ségrégation indépendante") : test ? "1/2 – 1/2 : le parent testé est hétérozygote" : codom ? "1/4 – 1/2 – 1/4 : codominance" : "3/4 – 1/4 : dominance complète" });
}

// ------------------------------------------------------------------ neurone
export function neuron(B: Builder, p: Params) {
  const my = !!p.myelin, speed = N(p.speed, 50), freq = N(p.freq, 0.8), L = !!p.labels;
  B.labelSize = 0.42;
  const x0 = -4.2, x1 = 5.2;
  ball(B, v3(-5, 0, 2), 0.8, 0xf783ac, B.m, 28);
  ball(B, v3(-5, 0, 2), 0.3, 0x9c36b5);
  const rnd = rng(5);
  const branch = (from: V, dir: V, len: number, depth: number) => {
    const to = from.clone().addScaledVector(dir, len);
    rod(B, from, to, 0.05 * (depth + 1), 0xf783ac);
    if (depth > 0) for (let k = 0; k < 2; k++) branch(to, dir.clone().add(v3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5)).normalize(), len * 0.65, depth - 1);
  };
  for (let k = 0; k < 6; k++) { const a = (k / 6) * 2 * Math.PI; branch(v3(-5, 0, 2), v3(-0.6 + Math.cos(a) * 0.4, Math.sin(a) * 0.8, Math.cos(a) * 0.8).normalize(), 0.9, 2); }
  rod(B, v3(x0, 0, 2), v3(x1, 0, 2), 0.1, 0xf783ac);
  const nodes: number[] = [x0];
  if (my) for (let x = x0 + 0.15; x < x1 - 0.5; x += 1.05) { const c = new THREE.Mesh(B.track(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 20)), mat(B, 0xfff3bf, { opacity: 0.9 })); c.rotation.z = Math.PI / 2; c.position.set(x + 0.45, 0, 2); B.m.add(c); nodes.push(x + 0.975); }
  nodes.push(x1);
  for (let k = 0; k < 4; k++) { const d = v3(1, (k - 1.5) * 0.5, (k % 2 - 0.5) * 0.6).normalize(); const end = v3(x1, 0, 2).addScaledVector(d, 0.9); rod(B, v3(x1, 0, 2), end, 0.05, 0xf783ac); ball(B, end, 0.15, 0xf783ac); }
  if (L) { tag(B, "corps cellulaire", v3(-5, 0, 2.8), v3(-5, 0, 4)); tag(B, "dendrites", v3(-6, 0.3, 2.6), v3(-7, 0, 3.4)); tag(B, my ? "gaine de myéline" : "axone (fibre amyélinique)", v3(-1, 0, 2.3), v3(-1, 0, 3.6)); if (my) tag(B, "nœud de Ranvier", v3(nodes[3], 0, 2.15), v3(nodes[3] + 0.5, 0, 3.2)); tag(B, "arborisation terminale (synapses)", v3(x1 + 0.6, 0, 2.3), v3(x1 + 0.8, 0, 3.4)); }
  const pulses = [0, 1, 2].map(() => { const m = ball(B, v3(0, 0, 0), 0.22, 0xfab005); (m.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0xfab005); return m; });
  // potentiel d'action enregistré
  const ap = (t: number) => t < 0.2 ? -70 : t < 0.7 ? -70 + 100 * ((t - 0.2) / 0.5) : t < 1.6 ? 30 - 110 * ((t - 0.7) / 0.9) : t < 3 ? -80 + 10 * ((t - 1.6) / 1.4) : -70;
  const o = v3(-4.6, 0, -2.8);
  const pts: V[] = [];
  for (let i = 0; i <= 200; i++) { const t = (i / 200) * 4; pts.push(o.clone().add(v3(t * 2.2, 0, ((ap(t) + 90) / 130) * 2.4))); }
  line(B, pts, 0xe03131);
  line(B, [o.clone(), o.clone().add(v3(9, 0, 0))], B.pal.edge); line(B, [o.clone(), o.clone().add(v3(0, 0, 2.8))], B.pal.edge);
  B.label("PA (mV) / t (ms)", o.clone().add(v3(0.8, 0, 3)), { scale: 0.65 });
  B.label("+30", o.clone().add(v3(-0.5, 0, ((30 + 90) / 130) * 2.4)), { scale: 0.5 }); B.label("−70", o.clone().add(v3(-0.5, 0, ((-70 + 90) / 130) * 2.4)), { scale: 0.5 });
  B.label("dépolarisation", o.clone().add(v3(0.4 * 2.2, 0, 2.6)), { scale: 0.5 }); B.label("repolarisation", o.clone().add(v3(1.3 * 2.2, 0, 1.6)), { scale: 0.5 }); B.label("hyperpolarisation", o.clone().add(v3(2.2 * 2.2, 0, 0.2)), { scale: 0.5 });
  const vis = 0.4 + 2.2 * Math.log10(1 + speed);
  const travel = (x1 - x0) / vis;
  B.info.push({ label: T("Potentiel de repos / d'action", "جهد الراحة / العمل", "Resting / action potential"), value: "≈ −70 mV au repos ; PA d'amplitude ≈ 100 mV, durée ≈ 2 ms (loi du tout ou rien)" });
  B.info.push({ label: T("Conduction", "التوصيل", "Conduction"), value: my ? "saltatoire : le PA « saute » d'un nœud de Ranvier à l'autre (rapide)" : "continue, de proche en proche (lente)" });
  B.info.push({ label: T("Temps pour parcourir 1 m", "الزمن لقطع 1 م", "Time to travel 1 m"), value: `${fmt(1000 / speed, 1)} ms à ${fmt(speed, 1)} m/s` });
  B.info.push({ label: T("Codage du message", "ترميز الرسالة", "Message coding"), value: `en fréquence de PA : ${fmt(freq, 1)} PA par unité de temps (animation)` });
  B.onFrame((t) => {
    const period = 1 / freq * 1.5;
    pulses.forEach((m, k) => {
      const tt = t - k * period;
      const ph = ((tt % (period * 3)) + period * 3) % (period * 3);
      const u = ph / travel;
      m.visible = u <= 1 && tt >= 0;
      if (!m.visible) return;
      let x = x0 + u * (x1 - x0);
      if (my) { const i = nodes.findIndex((nx) => nx >= x); x = nodes[Math.max(0, i)]; }
      m.position.set(x, 0, 2);
    });
  });
}

// ------------------------------------------------------------------ géologie
function extrude(B: Builder, pts: [number, number][], depth: number, color: number, opacity = 1) {
  if (pts.length < 3) return null;
  const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z)));
  const g = B.track(new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }));
  g.rotateX(Math.PI / 2); g.translate(0, depth / 2, 0);
  const m = new THREE.Mesh(g, mat(B, color, { opacity, rough: 0.9 }));
  B.m.add(m);
  return m;
}
const LAYER_COLS = [0xe9c46a, 0xc9a227, 0xa47148, 0x8d99ae, 0xd4a373, 0x6c757d];
const LAYER_NAMES = ["grès", "calcaire", "marne", "argile", "conglomérat", "socle"];
export function geology(B: Builder, p: Params) {
  const mode = String(p.mode || "subduction"), amt = N(p.amount, 0.5), L = !!p.labels;
  B.labelSize = 0.45;
  const D = 4;
  if (mode === "globe") {
    const R = 4;
    const layers: [number, number, number, string][] = [[6371, 6200, 0x8d6e63, "croûte (0 – 35 km, épaisseur exagérée)"], [6200, 5700, 0xf08c00, "manteau supérieur"], [5700, 3480, 0xe8590c, "manteau inférieur"], [3480, 1220, 0xffd43b, "noyau externe (liquide)"], [1220, 0, 0xfff3bf, "noyau interne (solide)"]];
    const grp = new THREE.Group();
    grp.rotation.x = Math.PI / 2;
    grp.position.z = R;
    B.m.add(grp);
    layers.forEach(([ro, ri, c]) => {
      const r1 = (ro / 6371) * R, r0 = (ri / 6371) * R;
      grp.add(new THREE.Mesh(B.track(new THREE.SphereGeometry(r1, 64, 40, 0, Math.PI * 1.5)), mat(B, c, { rough: 0.8 })));
      [(th: number) => v3(-Math.sin(th), Math.cos(th), 0), (th: number) => v3(0, Math.cos(th), -Math.sin(th))].forEach((f) => {
        const pos: number[] = [];
        const nseg = 48;
        for (let i = 0; i < nseg; i++) {
          const a = (i / nseg) * Math.PI, b = ((i + 1) / nseg) * Math.PI;
          const A1 = f(a).multiplyScalar(r1), A2 = f(b).multiplyScalar(r1), C1 = f(a).multiplyScalar(r0), C2 = f(b).multiplyScalar(r0);
          [A1, A2, C2, A1, C2, C1].forEach((q) => pos.push(q.x, q.y, q.z));
        }
        const g = B.track(new THREE.BufferGeometry());
        g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        g.computeVertexNormals();
        grp.add(new THREE.Mesh(g, mat(B, c, { rough: 0.9 })));
      });
    });
    if (L) layers.forEach(([ro, ri, , n], i) => { const r = ((ro + ri) / 2 / 6371) * R; const at = v3(-r * 0.7, 0, R + r * 0.7); B.label(n, at.clone().add(v3(-2.6, 0, 0.3 + i * 0.1)), { scale: 0.65 }); line(B, [at, at.clone().add(v3(-1.6, 0, 0.3 + i * 0.1))], B.pal.dashed); });
    B.info.push({ label: T("Discontinuités", "الانقطاعات", "Discontinuities"), value: "Moho (≈ 30 km sous les continents), Gutenberg (2 900 km), Lehmann (5 150 km)" });
    B.info.push({ label: T("Lithosphère / asthénosphère", "الغلاف الصخري / الغلاف اللدن", "Lithosphere / asthenosphere"), value: "lithosphère rigide (≈ 100 km) découpée en plaques, sur l'asthénosphère ductile" });
    B.info.push({ label: T("Méthode d'étude", "طريقة الدراسة", "Method"), value: "propagation des ondes sismiques P et S (les ondes S ne traversent pas le noyau externe liquide)" });
    return;
  }
  if (mode === "subduction") {
    const slabEnd = 2 + amt * 4;
    const water = box(B, v3(-3.5, 0, -0.3), 7, D, 0.6, 0x4dabf7); (water.material as THREE.MeshStandardMaterial).transparent = true; (water.material as THREE.MeshStandardMaterial).opacity = 0.4;
    box(B, v3(0, 0, -5), 14, D, 6, 0xffa94d).material = mat(B, 0xffa94d, { opacity: 0.35 });
    const dip = Math.tan((35 * Math.PI) / 180);
    const top: [number, number][] = [[-7, -0.6], [-0.3, -0.6], [0.4, -0.9]];
    for (let x = 1; x <= slabEnd; x += 0.5) top.push([x, -0.9 - (x - 0.4) * dip]);
    const bottom = top.map(([x, z]) => [x - 0.35, z - 1] as [number, number]).reverse();
    extrude(B, [...top, ...bottom], D, 0x495057);
    extrude(B, [[0, -0.6], [0.4, -0.1], [1.5, 0.3], [3, 0.5], [7, 0.5], [7, -2.8], [1.8, -2.4], [0.6, -1.3]], D, 0xa47148);
    extrude(B, [[-0.4, -0.6], [0.3, -0.6], [0.6, -1.2]], D, 0x8d99ae);
    [3.2, 4.4].forEach((x) => { const c = new THREE.Mesh(B.track(new THREE.ConeGeometry(0.6, 1, 24)), mat(B, 0x6c4f3d)); c.rotation.x = Math.PI / 2; c.position.set(x, 0, 1); B.m.add(c); const mg = new THREE.Mesh(B.track(new THREE.SphereGeometry(0.4, 16, 12)), mat(B, 0xe03131, { emissive: 0x7a1010 })); mg.scale.set(0.6, 0.6, 1.6); mg.position.set(x - 0.3, 0, -2.6); B.m.add(mg); });
    for (let x = 0.8; x < slabEnd; x += 0.45) B.dot(v3(x, (x * 37) % 1 - 0.5, -0.9 - (x - 0.4) * dip - 0.3), 0xfab005, 0.07);
    B.arrow(v3(-5, 0, 0.1), v3(-3, 0, 0.1), 0xe03131);
    if (L) { B.label("fosse océanique", v3(0, 0, -0.4), { offset: v3(0, 0, 1.6), scale: 0.7 }); B.label("lithosphère océanique (dense)", v3(-4, 0, -1.4), { scale: 0.65 }); B.label("lithosphère continentale", v3(5, 0, -1.4), { scale: 0.65 }); B.label("volcanisme andésitique", v3(3.8, 0, 1.8), { scale: 0.65 }); B.label("foyers sismiques (plan de Benioff)", v3(slabEnd - 1, 0, -0.9 - (slabEnd - 1.4) * dip - 0.9), { scale: 0.6 }); B.label("asthénosphère", v3(-4, 0, -4.5), { scale: 0.65 }); B.label("prisme d'accrétion", v3(-0.1, 0, -0.7), { offset: v3(-1.6, 0, 0.6), scale: 0.55 }); }
    B.info.push({ label: T("Définition", "التعريف", "Definition"), value: "plongement de la lithosphère océanique sous une autre lithosphère (zone de convergence)" });
    B.info.push({ label: T("Indices", "المؤشرات", "Evidence"), value: "fosse, séismes de plus en plus profonds, volcanisme explosif, métamorphisme HP-BT (schistes bleus, éclogites)" });
    B.info.push({ label: T("Moteur", "المحرك", "Driver"), value: "la lithosphère océanique ancienne, froide et dense, plonge dans l'asthénosphère" });
    return;
  }
  if (mode === "collision") {
    const h = amt * 2.6;
    const topZ = (x: number) => 0.5 + h * Math.exp(-(x * x) / 5);
    const botZ = (x: number) => -1.8 - h * 1.3 * Math.exp(-(x * x) / 4);
    const xs = Array.from({ length: 61 }, (_, i) => -7 + (i * 14) / 60);
    const left = xs.filter((x) => x <= 0.3), right = xs.filter((x) => x >= 0.3);
    extrude(B, [...left.map((x) => [x, topZ(x)] as [number, number]), [0.3 + 0.5, topZ(0.3)], [0.3 - 0.6, botZ(0)], ...left.slice().reverse().map((x) => [x, botZ(x)] as [number, number])], D, 0xa47148);
    extrude(B, [...right.map((x) => [x, topZ(x)] as [number, number]), ...right.slice().reverse().map((x) => [x, botZ(x)] as [number, number]), [0.3 - 0.6, botZ(0)], [0.3 + 0.5, topZ(0.3)]], D, 0xc9a227);
    extrude(B, [[0.6, topZ(0.6) + 0.02], [0.9, topZ(0.9) + 0.02], [-0.1, botZ(0) + 0.3], [-0.4, botZ(0) + 0.3]], D, 0x2f9e44);
    extrude(B, [[-7, -1.8], [7, -1.8], [7, -3.8], [-7, -3.8]], D, 0x868e96, 0.6);
    B.arrow(v3(-6.5, 0, 1.2), v3(-4.5, 0, 1.2), 0xe03131); B.arrow(v3(6.5, 0, 1.2), v3(4.5, 0, 1.2), 0xe03131);
    if (L) { B.label("chaîne de montagnes", v3(0, 0, topZ(0) + 0.6), { scale: 0.7 }); B.label("racine crustale", v3(0, 0, botZ(0) - 0.4), { scale: 0.65 }); B.label("ophiolites (suture)", v3(0.5, 0, topZ(0.5)), { offset: v3(2.2, 0, 0.8), scale: 0.6 }); B.label("croûte continentale", v3(-5, 0, -0.6), { scale: 0.6 }); B.label("manteau lithosphérique", v3(-4.5, 0, -2.8), { scale: 0.6 }); }
    B.info.push({ label: T("Formation", "التكوين", "Formation"), value: "après la fermeture d'un océan (subduction), deux continents entrent en collision" });
    B.info.push({ label: T("Déformations", "التشوهات", "Deformations"), value: "plis, failles inverses, chevauchements et nappes de charriage ; épaississement de la croûte" });
    B.info.push({ label: T("Exemples", "أمثلة", "Examples"), value: "Himalaya, Alpes ; au Maroc : le Rif (domaine de collision)" });
    return;
  }
  const thick = [0.6, 0.5, 0.7, 0.5, 0.6];
  const zs = [0]; thick.forEach((t) => zs.push(zs[zs.length - 1] - t));
  if (mode === "fold") {
    const amp = amt * 1.4, lam = 7;
    thick.forEach((t, i) => {
      const g = B.track(new THREE.BoxGeometry(12, D, t, 96, 1, 1));
      const pos = g.attributes.position as THREE.BufferAttribute;
      for (let k = 0; k < pos.count; k++) pos.setZ(k, pos.getZ(k) + amp * Math.cos((2 * Math.PI * pos.getX(k)) / lam));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat(B, LAYER_COLS[i], { rough: 0.9 }));
      m.position.z = zs[i] - t / 2 + 3; B.m.add(m);
    });
    B.arrow(v3(-7.6, 0, 1.5), v3(-6.3, 0, 1.5), 0xe03131); B.arrow(v3(7.6, 0, 1.5), v3(6.3, 0, 1.5), 0xe03131);
    if (L && amp > 0.05) { B.label("anticlinal", v3(0, 0, 3 + amp + 0.5), { scale: 0.75 }); B.label("synclinal", v3(lam / 2, 0, 3 - amp + 0.6), { scale: 0.75 }); B.label("synclinal", v3(-lam / 2, 0, 3 - amp + 0.6), { scale: 0.75 }); line(B, [v3(0, 0, 3 + amp + 0.2), v3(0, 0, 3 + amp - 3.4)], 0xe03131, B.m, true); B.label("plan axial", v3(0.9, 0, 3 + amp - 3), { scale: 0.6, color: "#e03131" }); }
    B.info.push({ label: T("Pli", "الطية", "Fold"), value: "déformation souple (ductile) des couches sous l'effet d'une compression" });
    B.info.push({ label: T("Anticlinal / synclinal", "محدب / مقعر", "Anticline / syncline"), value: "anticlinal : couches les plus anciennes au cœur ; synclinal : couches les plus récentes au cœur" });
    B.info.push({ label: T("Raccourcissement", "التقلص", "Shortening"), value: `≈ ${fmt((1 - 1 / Math.sqrt(1 + ((2 * Math.PI * amp) / lam) ** 2 / 2)) * 100, 0)} % (indication)` });
  } else if (mode === "fault") {
    const normal = p.fault !== "reverse", s = amt * 1.5, ang = (60 * Math.PI) / 180;
    const xf = (z: number) => -z / Math.tan(ang) - 0.5;
    const disp = v3(Math.cos(ang), 0, -Math.sin(ang)).multiplyScalar(normal ? s : -s);
    thick.forEach((t, i) => {
      const z1 = zs[i] + 3, z0 = zs[i + 1] + 3;
      extrude(B, [[-6, z0], [xf(z0 - 3), z0], [xf(z1 - 3), z1], [-6, z1]], D, LAYER_COLS[i]);
      const m = extrude(B, [[xf(z0 - 3), z0], [6, z0], [6, z1], [xf(z1 - 3), z1]], D, LAYER_COLS[i]);
      m?.position.copy(disp);
    });
    if (L) { B.label("plan de faille", v3(xf(-1.5), 0, 1.6), { offset: v3(-1.4, 0, 0), scale: 0.65 }); B.label(normal ? "compartiment affaissé" : "compartiment soulevé", v3(3.5, 0, 3.6 + disp.z), { scale: 0.65 }); B.label(`rejet ≈ ${fmt(s, 2)}`, v3(xf(0) + 0.6, 0, 3.4 + disp.z / 2), { scale: 0.6 }); }
    B.arrow(v3(normal ? -7 : -5.2, 0, 0), v3(normal ? -5.2 : -7, 0, 0).add(v3(0, 0, 0)), 0xe03131);
    B.info.push({ label: T("Faille", "الفالق", "Fault"), value: normal ? "faille normale : le compartiment supérieur descend (extension)" : "faille inverse : le compartiment supérieur remonte (compression)" });
    B.info.push({ label: T("Déformation", "التشوه", "Deformation"), value: "cassante : rupture des couches avec déplacement (rejet)" });
  } else {
    const depth = amt * 3, w = 3.5;
    const zv = (x: number) => 0 - depth * Math.max(0, 1 - Math.abs(x) / w);
    const xs = Array.from({ length: 121 }, (_, i) => -6 + i * 0.1);
    thick.forEach((t, i) => {
      const z1 = zs[i], z0 = zs[i + 1];
      let run: number[] = [];
      const flush = () => {
        if (run.length > 1) extrude(B, [...run.map((x) => [x, z0 + 3] as [number, number]), ...run.slice().reverse().map((x) => [x, Math.min(z1, zv(x)) + 3] as [number, number])], D, LAYER_COLS[i]);
        run = [];
      };
      xs.forEach((x) => { if (Math.min(z1, zv(x)) > z0 + 1e-3) run.push(x); else flush(); });
      flush();
      if (L) B.label(`${LAYER_NAMES[i]}${i === thick.length - 1 ? " (le plus ancien)" : i === 0 ? " (le plus récent)" : ""}`, v3(-6.2, 0, (z0 + z1) / 2 + 3), { offset: v3(-1.8, 0, 0), scale: 0.6 });
    });
    if (depth > 0.2) { const r = box(B, v3(0, 0, 3 + zv(0) + 0.05), 0.6, D, 0.1, 0x4dabf7); void r; if (L) B.label("vallée creusée par l'érosion", v3(0, 0, 3.6), { scale: 0.65 }); }
    B.info.push({ label: T("Principe de superposition", "مبدأ التراكب", "Superposition"), value: "dans une série non déformée, une couche est plus récente que celle qu'elle recouvre" });
    B.info.push({ label: T("Principe de continuité", "مبدأ الاستمرارية", "Continuity"), value: "une même couche a le même âge sur toute son étendue (de part et d'autre de la vallée)" });
    B.info.push({ label: T("Phénomènes externes", "الظواهر الخارجية", "External processes"), value: "érosion → transport → sédimentation → diagenèse (formation des roches sédimentaires)" });
  }
}

// ------------------------------------------------------------------ pyramide écologique
export function ecopyramid(B: Builder, p: Params) {
  const P = N(p.P, 20000), eff = N(p.eff, 10) / 100, nl = clamp(Math.round(N(p.levels, 4)), 2, 5), log = p.scale !== "lin";
  B.labelSize = 0.45;
  const E = Array.from({ length: nl }, (_, i) => P * eff ** i);
  const names = ["producteurs (végétaux)", "consommateurs I (herbivores)", "consommateurs II (carnivores)", "consommateurs III", "consommateurs IV"];
  const cols = [0x2f9e44, 0x94d82d, 0xfab005, 0xf76707, 0xe03131];
  const lo = Math.log10(E[nl - 1] / 3), hi = Math.log10(E[0]);
  const width = (e: number) => (log ? 1 + 7 * ((Math.log10(e) - lo) / (hi - lo)) : Math.max(0.25, 8 * (e / E[0])));
  E.forEach((e, i) => {
    const w = width(e);
    box(B, v3(0, 0, i * 0.9 + 0.4), w, w, 0.8, cols[i]);
    B.label(`${names[i]} : ${fmt(e, 0)} kJ/m²/an`, v3(w / 2 + 0.4, 0, i * 0.9 + 0.4), { scale: 0.65, offset: v3(2.5, 0, 0) });
    if (i < nl - 1) { const loss = e - E[i + 1]; B.arrow(v3(-w / 2, 0, i * 0.9 + 0.4), v3(-w / 2 - 1.4, 0, i * 0.9 + 0.7), 0xe03131); B.label(`pertes ${fmt(loss, 0)}`, v3(-w / 2 - 1.6, 0, i * 0.9 + 0.8), { scale: 0.55, offset: v3(-1.1, 0, 0), color: "#e03131" }); }
  });
  B.info.push({ label: T("Rendement écologique", "المردود البيئي", "Ecological efficiency"), value: `${fmt(eff * 100, 1)} % de l'énergie passe au niveau suivant` });
  B.info.push({ label: T("Énergie au dernier niveau", "الطاقة في المستوى الأخير", "Energy at the top"), value: `${fmt(E[nl - 1], 2)} kJ/m²/an (${fmt((E[nl - 1] / P) * 100, 3)} % de la production primaire)` });
  B.info.push({ label: T("Pertes", "الضياع", "Losses"), value: "respiration (chaleur), matière non consommée ou non assimilée (excréments, cadavres → décomposeurs)" });
  B.info.push({ label: T("Conséquence", "النتيجة", "Consequence"), value: "les chaînes alimentaires sont courtes (rarement plus de 4 à 5 maillons)" });
}

// ------------------------------------------------------------------ fleur
export function flower(B: Builder, p: Params) {
  const open = N(p.open), np = clamp(Math.round(N(p.petals, 5)), 3, 8), L = !!p.labels, cut = !!p.cut;
  B.labelSize = 0.42;
  rod(B, v3(0, 0, -3), v3(0, 0, 0), 0.12, 0x2f9e44);
  ball(B, v3(0, 0, 0), 0.4, 0x40c057).scale.set(1, 1, 0.5);
  const petalShape = (w: number, h: number) => { const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(w, h * 0.4, 0, h); s.quadraticCurveTo(-w, h * 0.4, 0, 0); return s; };
  const whorl = (k: number, n: number, w: number, h: number, tilt: number, color: number, radius: number, z: number) => {
    const geo = B.track(new THREE.ShapeGeometry(petalShape(w, h), 12));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 2 * Math.PI + k * 0.3;
      const g = new THREE.Group();
      const m = new THREE.Mesh(geo, mat(B, color, { rough: 0.7 }));
      m.rotation.x = Math.PI / 2 - tilt; // la pièce s'élève vers l'extérieur
      g.add(m);
      g.rotation.z = a - Math.PI / 2;
      const off = open * (1.2 + k * 1.1);
      g.position.set(Math.cos(a) * (radius + off), Math.sin(a) * (radius + off), z - open * k * 0.4);
      B.m.add(g);
    }
  };
  whorl(0, np, 0.45, 1.2, 1.25, 0x2f9e44, 0.25, 0);
  whorl(1, np, 0.9, 2.2, 0.9, 0xf06595, 0.3, 0.1);
  const ns = np * 2;
  for (let i = 0; i < ns; i++) {
    const a = (i / ns) * 2 * Math.PI;
    const off = open * 3.6;
    const base = v3(Math.cos(a) * (0.32 + off), Math.sin(a) * (0.32 + off), 0.2 - open * 0.8);
    const top = base.clone().add(v3(Math.cos(a) * 0.35, Math.sin(a) * 0.35, 1.3));
    rod(B, base, top, 0.025, 0xfff3bf);
    const an = ball(B, top, 0.12, 0xfab005); an.scale.set(1, 1, 1.8);
  }
  const pz = -open * 1.6;
  const ovary = new THREE.Mesh(B.track(new THREE.SphereGeometry(0.32, 24, 16, 0, cut ? Math.PI : Math.PI * 2)), mat(B, 0x94d82d, { opacity: cut ? 0.8 : 1 }));
  ovary.scale.set(1, 1, 1.3); ovary.position.set(0, 0, 0.35 + pz); B.m.add(ovary);
  if (cut) for (let i = 0; i < 6; i++) ball(B, v3(Math.cos(i) * 0.12, -0.05, 0.25 + pz + (i % 3) * 0.1), 0.05, 0xf8f9fa);
  rod(B, v3(0, 0, 0.7 + pz), v3(0, 0, 1.6 + pz), 0.05, 0xa9e34b);
  ball(B, v3(0, 0, 1.65 + pz), 0.12, 0x5c940d);
  if (L) {
    tag(B, "sépale (calice)", v3(open * 1.2 + 0.6, 0, -0.1), v3(4.5, -2, -1.2));
    tag(B, "pétale (corolle)", v3(open * 2.3 + 1.2, 0.3, 0.9), v3(4.8, 1.5, 2.4));
    tag(B, "étamine : anthère + filet (♂, pollen)", v3(open * 3.6 + 0.6, 0, 1.4 - open * 0.8), v3(-4.8, -1.5, 3));
    tag(B, "stigmate", v3(0, 0, 1.7 + pz), v3(-2.6, 1.5, 3.4 + pz));
    tag(B, "style", v3(0, 0, 1.2 + pz), v3(-3, 2, 1.8 + pz));
    tag(B, cut ? "ovaire (ovules visibles)" : "ovaire (pistil ♀)", v3(0, 0, 0.35 + pz), v3(-3.2, 1.6, 0.2 + pz));
  }
  B.info.push({ label: T("Formule florale", "الصيغة الزهرية", "Floral formula"), value: `${np} S + ${np} P + ${ns} E + 1 C (pièces disposées en verticilles)` });
  B.info.push({ label: T("Organes reproducteurs", "أعضاء التوالد", "Reproductive organs"), value: "étamines (organes mâles : pollen) · pistil (organe femelle : ovules dans l'ovaire)" });
  B.info.push({ label: T("Après la fécondation", "بعد الإخصاب", "After fertilisation"), value: "l'ovaire devient le fruit, les ovules deviennent les graines" });
}

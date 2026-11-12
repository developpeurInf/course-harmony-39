/** Scènes de physique du Labo 3D (repère maths : x horizontal, z vers le haut) */
import * as THREE from "three";
import type { Builder } from "./buildScene";
import type { Params } from "./templates";
import {
  N, T, ball, box, clamp, energyBars, fmt, ground, hex, line, liveArrow, liveLabel, liveLine, mat, placeRod, plot, rng, rod, unitRod, v3, type V,
} from "./scienceKit";

// ------------------------------------------------------------------ pendule simple
export function pendulum(B: Builder, p: Params) {
  const L = N(p.L, 1), th0 = (N(p.theta, 20) * Math.PI) / 180, g = N(p.g, 9.8), c = N(p.damping) * 1.2;
  const k = 2.6; // unités d'affichage par mètre
  B.labelSize = 0.45;
  const top = L * k + 0.6;
  box(B, v3(0, 0, top + 0.08), 2.4, 0.4, 0.16, 0x495057);
  rod(B, v3(-1.1, 0, 0), v3(-1.1, 0, top), 0.05, 0x868e96);
  ground(B, 0, 0, 6, 3, 0);
  const pivot = v3(0, 0, top);
  const string = unitRod(B, 0.012, 0xadb5bd);
  const bob = ball(B, v3(0, 0, 0), 0.22, 0xe8590c, B.m, 28);
  line(B, [pivot, v3(0, 0, top - L * k - 0.3)], B.pal.dashed, B.m, true);
  const trace = p.trace ? liveLine(B, 2000, 0xfab005) : null;
  const tracePts: V[] = [];
  const bars = p.energy ? energyBars(B, v3(2.2, 0, 0.3), 2.2) : null;
  const lab = liveLabel(B, v3(-2.6, 0, top + 0.7), { scale: 0.8 });
  const T0 = 2 * Math.PI * Math.sqrt(L / g);
  B.info.push({ label: T("Période propre (petits angles)", "الدور الخاص (زوايا صغيرة)", "Natural period (small angles)"), value: `T₀ = 2π√(L/g) ≈ ${fmt(T0, 3)} s` });
  B.info.push({ label: T("Pulsation propre", "النبض الخاص", "Natural angular frequency"), value: `ω₀ = √(g/L) ≈ ${fmt(Math.sqrt(g / L), 3)} rad/s` });
  B.info.push({ label: T("Énergie mécanique initiale (m = 1 kg)", "الطاقة الميكانيكية البدئية", "Initial mechanical energy (m = 1 kg)"), value: `Em = m·g·L(1 − cos θ₀) ≈ ${fmt(g * L * (1 - Math.cos(th0)), 3)} J` });
  let th = th0, om = 0, last = 0, crossings = 0, firstCross = -1, measured = NaN;
  const E0 = g * L * (1 - Math.cos(th0)) || 1;
  const f = (a: number, w: number) => -(g / L) * Math.sin(a) - c * w;
  B.onFrame((t) => {
    if (t < last || t - last > 1) { th = th0; om = 0; last = t; tracePts.length = 0; crossings = 0; firstCross = -1; }
    const dt = 1 / 400;
    while (last < t) {
      const prev = th;
      const k1a = om, k1w = f(th, om);
      const k2a = om + (dt / 2) * k1w, k2w = f(th + (dt / 2) * k1a, om + (dt / 2) * k1w);
      const k3a = om + (dt / 2) * k2w, k3w = f(th + (dt / 2) * k2a, om + (dt / 2) * k2w);
      const k4a = om + dt * k3w, k4w = f(th + dt * k3a, om + dt * k3w);
      th += (dt / 6) * (k1a + 2 * k2a + 2 * k3a + k4a);
      om += (dt / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
      last += dt;
      if (prev > 0 && th <= 0) { crossings++; if (firstCross < 0) firstCross = last; else measured = (last - firstCross) / (crossings - 1); }
    }
    const pos = v3(Math.sin(th) * L * k, 0, top - Math.cos(th) * L * k);
    bob.position.copy(pos);
    placeRod(string, pivot, pos);
    if (trace) { tracePts.push(pos.clone()); if (tracePts.length > 2000) tracePts.shift(); trace.set(tracePts); }
    if (bars) bars([0.5 * L * L * om * om, g * L * (1 - Math.cos(th)), 0.5 * L * L * om * om + g * L * (1 - Math.cos(th))], E0);
    lab.set(`t = ${fmt(t, 1)} s   θ = ${fmt((th * 180) / Math.PI, 1)}°${Number.isFinite(measured) ? `   T mesurée ≈ ${fmt(measured, 3)} s` : ""}`);
  });
}

// ------------------------------------------------------------------ masse-ressort
export function spring(B: Builder, p: Params) {
  const k = N(p.k, 20), m = N(p.m, 0.2), A = N(p.A, 8) / 100, lam = N(p.damping) * 1.5;
  const s = 12; // unités par mètre
  B.labelSize = 0.42;
  const w0 = Math.sqrt(k / m), T0 = (2 * Math.PI) / w0, w = Math.sqrt(Math.max(1e-6, w0 * w0 - lam * lam));
  const xe = 3.2;
  box(B, v3(-0.15, 0, 0.6), 0.3, 1.4, 1.2, 0x495057);
  box(B, v3(xe, 0, -0.05), 8, 1.6, 0.1, 0xced4da);
  const block = box(B, v3(xe, 0, 0.3), 0.6, 0.6, 0.6, 0x4c6ef5);
  line(B, [v3(xe, -0.9, 0), v3(xe, -0.9, 1)], B.pal.dashed, B.m, true);
  B.label("x = 0", v3(xe, -0.9, 1.15), { scale: 0.7 });
  const coil = liveLine(B, 400, 0x868e96);
  const x = (t: number) => A * Math.exp(-lam * t) * Math.cos(w * t);
  const v = (t: number) => A * Math.exp(-lam * t) * (-lam * Math.cos(w * t) - w * Math.sin(w * t));
  const span = Math.max(3 * T0, 3);
  const pl = p.graph ? plot(B, { origin: v3(0, 0.8, 1.8), w: 6.5, h: 2.2, xmax: span, ymin: -A * 1.1, ymax: A * 1.1, xlabel: "t (s)", ylabel: "x (m)" }) : null;
  pl?.curve(x, 0x4c6ef5);
  const cur = pl?.cursor();
  const bars = p.energy ? energyBars(B, v3(8, 0, 0.1), 1.6) : null;
  const E0 = 0.5 * k * A * A;
  B.info.push({ label: T("Période propre", "الدور الخاص", "Natural period"), value: `T₀ = 2π√(m/k) ≈ ${fmt(T0, 3)} s` });
  B.info.push({ label: T("Énergie mécanique initiale", "الطاقة الميكانيكية البدئية", "Initial mechanical energy"), value: `Em = ½·k·Xm² ≈ ${fmt(E0, 4)} J` });
  B.info.push({ label: T("Vitesse maximale (sans frottement)", "السرعة القصوى", "Maximum speed"), value: `Vm = Xm·ω₀ ≈ ${fmt(A * w0, 3)} m/s` });
  B.onFrame((t) => {
    const tt = t % span;
    const xx = x(tt);
    const bx = xe + xx * s;
    block.position.x = bx;
    const pts: V[] = [];
    const turns = 14, L0 = bx - 0.3;
    for (let i = 0; i <= 300; i++) { const u = i / 300; pts.push(v3(u * L0, Math.sin(u * turns * 2 * Math.PI) * 0.18, 0.3 + Math.cos(u * turns * 2 * Math.PI) * 0.18)); }
    coil.set(pts);
    cur?.set(tt, xx);
    const vv = v(tt);
    bars?.([0.5 * m * vv * vv, 0.5 * k * xx * xx, 0.5 * m * vv * vv + 0.5 * k * xx * xx], E0);
  });
}

// ------------------------------------------------------------------ projectile
export function projectile(B: Builder, p: Params) {
  const v0 = N(p.v0, 15), a = (N(p.alpha, 45) * Math.PI) / 180, h0 = N(p.h0), g = N(p.g, 9.8);
  const traj = (al: number) => {
    const vx = v0 * Math.cos(al), vz = v0 * Math.sin(al);
    const tf = (vz + Math.sqrt(vz * vz + 2 * g * h0)) / g;
    return { vx, vz, tf, range: vx * tf, hmax: h0 + (vz * vz) / (2 * g), pos: (t: number) => v3(vx * t, 0, h0 + vz * t - 0.5 * g * t * t) };
  };
  const main = traj(a), other = traj(Math.PI / 2 - a);
  const size = Math.max(main.range, main.hmax * 1.3, p.compare ? other.range : 0, p.compare ? other.hmax : 0, 1);
  const s = 9 / size;
  B.labelSize = 0.45;
  const S = (q: V) => q.clone().multiplyScalar(s);
  ground(B, 4.5, 0, 12, 3, 0, 0x2f9e44);
  if (h0 > 0) box(B, v3(-0.3, 0, (h0 * s) / 2), 0.6, 0.6, h0 * s, 0x868e96);
  const draw = (tr: ReturnType<typeof traj>, color: number) => {
    const pts: V[] = [];
    for (let i = 0; i <= 120; i++) pts.push(S(tr.pos((tr.tf * i) / 120)));
    line(B, pts, color, B.m, true);
  };
  draw(main, 0xe8590c);
  if (p.compare && Math.abs(a - Math.PI / 4) > 1e-3) draw(other, 0x7048e8);
  const ballM = ball(B, v3(0, 0, 0), 0.2, 0xe8590c);
  const ball2 = p.compare ? ball(B, v3(0, 0, 0), 0.16, 0x7048e8) : null;
  const top = S(main.pos(main.vz / g));
  if (main.vz > 0) { line(B, [top, v3(top.x, 0, 0)], B.pal.dashed, B.m, true); B.label(`flèche ≈ ${fmt(main.hmax)} m`, top, { offset: v3(0, 0, 0.45), scale: 0.75 }); }
  B.label(`portée ≈ ${fmt(main.range)} m`, v3(main.range * s, 0, 0), { offset: v3(0, 0, -0.4), scale: 0.75 });
  const av = p.vectors ? liveArrow(B, 0x1c7ed6) : null, ax = p.vectors ? liveArrow(B, 0x74c0fc) : null, az = p.vectors ? liveArrow(B, 0x74c0fc) : null;
  const lab = liveLabel(B, v3(0, 0, 9.8), { scale: 0.8 });
  const vs = 2.2 / v0;
  B.info.push({ label: T("Équation de la trajectoire", "معادلة المسار", "Trajectory equation"), value: `z = −g·x² / (2·v₀²·cos²α) + x·tan α + h₀` });
  B.info.push({ label: T("Durée du vol", "مدة الطيران", "Flight time"), value: `${fmt(main.tf, 3)} s` });
  B.info.push({ label: T("Portée", "المدى", "Range"), value: `${fmt(main.range, 3)} m` });
  B.info.push({ label: T("Flèche (hauteur maximale)", "الذروة", "Maximum height"), value: `${fmt(main.hmax, 3)} m` });
  if (p.compare) B.info.push({ label: T("Portée avec 90° − α", "المدى مع 90° − α", "Range with 90° − α"), value: `${fmt(other.range, 3)} m` });
  B.onFrame((t) => {
    const per = Math.max(main.tf, p.compare ? other.tf : 0) + 1;
    const tt = t % per;
    const t1 = Math.min(tt, main.tf);
    const q = S(main.pos(t1));
    ballM.position.copy(q);
    if (ball2) ball2.position.copy(S(other.pos(Math.min(tt, other.tf))));
    const vz = main.vz - g * t1;
    if (av && ax && az) {
      const vis = tt < main.tf;
      av.set(q, v3(main.vx, 0, vz).multiplyScalar(vs * (vis ? 1 : 0)));
      ax.set(q, v3(main.vx, 0, 0).multiplyScalar(vs * (vis ? 1 : 0)));
      az.set(q, v3(0, 0, vz).multiplyScalar(vs * (vis ? 1 : 0)));
    }
    lab.set(`t = ${fmt(t1, 2)} s   x = ${fmt(main.vx * t1)} m   z = ${fmt(main.pos(t1).z)} m   v = ${fmt(Math.hypot(main.vx, vz))} m/s`);
  });
}

// ------------------------------------------------------------------ chute verticale
export function fall(B: Builder, p: Params) {
  const model = String(p.model || "quad"), m = N(p.m, 0.5), k = N(p.k, 0.05), H = N(p.H, 60), g = 9.8;
  const acc = (v: number) => g - (model === "lin" ? (k / m) * v : model === "quad" ? (k / m) * v * v : 0);
  const pts: { t: number; z: number; v: number }[] = [];
  let t = 0, z = 0, v = 0;
  const dt = 0.002;
  while (z < H && t < 120) { pts.push({ t, z, v }); v += acc(v) * dt; z += v * dt; t += dt; }
  pts.push({ t, z: H, v });
  const tf = t;
  const vlim = model === "lin" ? (m * g) / k : model === "quad" ? Math.sqrt((m * g) / k) : NaN;
  const tau = model === "lin" ? m / k : model === "quad" ? vlim / g : NaN;
  const s = 8 / H;
  B.labelSize = 0.42;
  const tube = new THREE.Mesh(B.track(new THREE.CylinderGeometry(0.5, 0.5, 8.4, 32, 1, true)), mat(B, 0x74c0fc, { opacity: 0.18 }));
  tube.rotation.x = Math.PI / 2;
  tube.position.set(0, 0, 4.2);
  B.m.add(tube);
  ground(B, 0, 0, 3, 3, 0);
  for (let i = 0; i <= 4; i++) { const zz = (H * i) / 4; B.label(`${fmt(H - zz, 0)} m`, v3(-0.8, 0, zz * s), { scale: 0.55 }); }
  const bl = ball(B, v3(0, 0, 8), 0.25, 0xe8590c);
  const vmax = Math.max(...pts.map((q) => q.v)) * 1.1;
  const pl = p.graph ? plot(B, { origin: v3(1.6, 0, 1), w: 6, h: 5, xmax: tf, ymin: 0, ymax: Math.max(vmax, Number.isFinite(vlim) ? vlim * 1.1 : 0), xlabel: "t (s)", ylabel: "v (m/s)" }) : null;
  if (pl) {
    pl.points(pts.filter((_, i) => i % 10 === 0).map((q) => [q.t, q.v]), 0xe8590c);
    if (Number.isFinite(vlim)) { pl.curve(() => vlim, 0x2f9e44, 2, true); B.label(`v_lim ≈ ${fmt(vlim)} m/s`, pl.map(tf * 0.7, vlim), { offset: v3(0, 0, 0.3), scale: 0.6, color: "#2f9e44" }); }
    if (Number.isFinite(tau) && tau < tf) pl.curve((x) => g * x, 0x868e96, 2, true);
  }
  const cur = pl?.cursor();
  const lab = liveLabel(B, v3(-2.5, 0, 9), { scale: 0.75 });
  B.info.push({ label: T("Équation différentielle", "المعادلة التفاضلية", "Differential equation"), value: model === "none" ? "dv/dt = g" : model === "lin" ? "dv/dt = g − (k/m)·v" : "dv/dt = g − (k/m)·v²" });
  if (Number.isFinite(vlim)) {
    B.info.push({ label: T("Vitesse limite", "السرعة الحدية", "Terminal velocity"), value: model === "lin" ? `v_lim = m·g/k ≈ ${fmt(vlim, 3)} m/s` : `v_lim = √(m·g/k) ≈ ${fmt(vlim, 3)} m/s` });
    B.info.push({ label: T("Temps caractéristique", "الزمن المميز", "Time constant"), value: `τ = v_lim/g ≈ ${fmt(tau, 3)} s` });
  }
  B.info.push({ label: T("Durée de la chute / vitesse au sol", "مدة السقوط / السرعة عند الأرض", "Fall time / speed at ground"), value: `${fmt(tf, 2)} s · ${fmt(v, 2)} m/s` });
  B.onFrame((tt) => {
    const per = tf + 1.2;
    const x = tt % per;
    const q = pts[Math.min(pts.length - 1, Math.floor(Math.min(x, tf) / dt))];
    bl.position.z = 8 - q.z * s + 0.25;
    cur?.set(q.t, q.v);
    lab.set(`t = ${fmt(q.t, 2)} s   v = ${fmt(q.v, 2)} m/s   a = ${fmt(acc(q.v), 2)} m/s²`);
  });
}

// ------------------------------------------------------------------ orbites
const PLANETS: Record<string, { r: number; name: string }> = {
  mercury: { r: 57.9e9, name: "Mercure" }, venus: { r: 108.2e9, name: "Vénus" }, earth: { r: 149.6e9, name: "Terre" },
  mars: { r: 227.9e9, name: "Mars" }, jupiter: { r: 778.5e9, name: "Jupiter" }, saturn: { r: 1433.5e9, name: "Saturne" },
};
export function orbit(B: Builder, p: Params) {
  const sun = p.body === "sun";
  const GM = sun ? 1.327e20 : 3.986e14, R = sun ? 6.96e8 : 6.371e6;
  const r = sun ? (PLANETS[String(p.planet)] || PLANETS.earth).r : R + N(p.h, 800) * 1000;
  const e = N(p.e);
  B.labelSize = 0.48;
  const Rd = sun ? 1.1 : 1.4;
  const disp = (d: number) => (sun ? Rd + 4.5 * Math.sqrt(d / PLANETS.saturn.r) * 1.6 : Rd * (1 + 2.2 * Math.sqrt(Math.max(0, d - R) / R)));
  const center = ball(B, v3(0, 0, 0), Rd, sun ? 0xffd43b : 0x1c7ed6, B.m, 48);
  if (sun) (center.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0xfab005);
  else {
    const eq = line(B, Array.from({ length: 97 }, (_, i) => v3(Rd * 1.002 * Math.cos((i / 96) * 2 * Math.PI), Rd * 1.002 * Math.sin((i / 96) * 2 * Math.PI), 0)), 0x2f9e44);
    eq.renderOrder = 2;
  }
  const a = r, b = a * Math.sqrt(1 - e * e);
  const posAt = (E: number) => v3(a * (Math.cos(E) - e), b * Math.sin(E), 0);
  const D = (q: V) => { const d = q.length(); return d < 1 ? q.clone() : q.clone().multiplyScalar(disp(d) / d); };
  const ell: V[] = [];
  for (let i = 0; i <= 200; i++) ell.push(D(posAt((i / 200) * 2 * Math.PI)));
  line(B, ell, B.pal.edge);
  const solveE = (M: number) => { let E = M; for (let i = 0; i < 12; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); return E; };
  if (p.areas) {
    const n = 12;
    for (let i = 0; i < n; i += 2) {
      const pts: V[] = [];
      for (let j = 0; j <= 16; j++) pts.push(D(posAt(solveE(((i + j / 16) / n) * 2 * Math.PI))));
      const fan: V[] = [v3(0, 0, 0), ...pts];
      const pos: number[] = [];
      for (let j = 1; j < fan.length - 1; j++) [fan[0], fan[j], fan[j + 1]].forEach((q) => pos.push(q.x, q.y, q.z));
      const g = B.track(new THREE.BufferGeometry());
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      B.m.add(new THREE.Mesh(g, mat(B, 0xfab005, { opacity: 0.35 })));
    }
  }
  if (!sun && p.geo) {
    const rg = 42164e3;
    const ring: V[] = Array.from({ length: 129 }, (_, i) => D(v3(rg * Math.cos((i / 128) * 2 * Math.PI), rg * Math.sin((i / 128) * 2 * Math.PI), 0)));
    line(B, ring, 0xe03131, B.m, true);
    B.label("géostationnaire (h ≈ 35 800 km)", ring[16], { color: "#e03131", scale: 0.7 });
  }
  const sat = sun ? ball(B, v3(0, 0, 0), 0.3, 0x74c0fc) : box(B, v3(0, 0, 0), 0.35, 0.35, 0.35, 0xdee2e6);
  if (!sun) { box(B, v3(-0.45, 0, 0), 0.5, 0.05, 0.25, 0x364fc7, sat); box(B, v3(0.45, 0, 0), 0.5, 0.05, 0.25, 0x364fc7, sat); }
  const fArr = p.vectors ? liveArrow(B, 0xe03131) : null, vArr = p.vectors ? liveArrow(B, 0x2f9e44) : null;
  const Tper = 2 * Math.PI * Math.sqrt(a ** 3 / GM);
  const vc = Math.sqrt(GM / r);
  const lab = liveLabel(B, v3(-disp(a * (1 + e)) - 1, 0, 2.6), { scale: 0.75 });
  B.info.push({ label: T("Vitesse (orbite circulaire)", "السرعة (مدار دائري)", "Speed (circular orbit)"), value: `v = √(G·M/r) ≈ ${fmt(vc / 1000, 3)} km/s` });
  B.info.push({ label: T("Période de révolution", "دور الدوران", "Orbital period"), value: `T = 2π√(r³/(G·M)) ≈ ${sun ? `${fmt(Tper / 86400, 1)} jours` : `${fmt(Tper / 60, 1)} min (${fmt(Tper / 3600, 2)} h)`}` });
  B.info.push({ label: T("3e loi de Kepler", "القانون الثالث لكيبلر", "Kepler's 3rd law"), value: `T²/r³ = 4π²/(G·M) ≈ ${fmt((4 * Math.PI ** 2) / GM)} s²/m³` });
  B.info.push({ label: T("Rayon de l'orbite", "شعاع المدار", "Orbit radius"), value: `r ≈ ${fmt(r / 1000, 0)} km` });
  if (sun || e > 0) B.info.push({ label: T("Échelle", "السلم", "Scale"), value: "distances non proportionnelles (lisibilité)" });
  const per = 8;
  B.onFrame((t) => {
    const E = solveE(((t % per) / per) * 2 * Math.PI);
    const q = posAt(E);
    const d = D(q);
    sat.position.copy(d);
    const dist = q.length();
    const vel = v3(-a * Math.sin(E), b * Math.cos(E), 0).normalize().multiplyScalar(Math.sqrt(GM * (2 / dist - 1 / a)));
    fArr?.set(d, q.clone().normalize().multiplyScalar(-1.8 * (r / dist) ** 2));
    vArr?.set(d, vel.clone().normalize().multiplyScalar((1.6 * vel.length()) / vc));
    if (!sun) center.rotation.z = (t / per) * 2 * Math.PI * 0.3;
    lab.set(`d = ${fmt(dist / 1000, 0)} km   v = ${fmt(vel.length() / 1000, 2)} km/s`);
  });
}

// ------------------------------------------------------------------ ondes
export function wave(B: Builder, p: Params) {
  const kind = String(p.kind || "water"), Nf = N(p.N, 1), v = N(p.v, 2), A = N(p.A, 0.25), a = N(p.a, 1.5);
  const lam = v / Nf, w = 2 * Math.PI * Nf;
  B.labelSize = 0.42;
  B.info.push({ label: T("Longueur d'onde", "طول الموجة", "Wavelength"), value: `λ = v / N = ${fmt(lam, 3)} m` });
  B.info.push({ label: T("Période", "الدور", "Period"), value: `T = 1 / N = ${fmt(1 / Nf, 3)} s` });
  const frozen = !!p.pause;
  if (kind === "rope" || kind === "spring") {
    const n = 120, Lr = 10;
    const geo = kind === "rope" ? B.track(new THREE.SphereGeometry(0.07, 10, 8)) : B.track(new THREE.TorusGeometry(0.28, 0.03, 6, 20));
    const inst = new THREE.InstancedMesh(geo, mat(B, kind === "rope" ? 0xe8590c : 0x868e96), n);
    B.m.add(inst);
    box(B, v3(-0.3, 0, 0), 0.3, 0.6, 1.2, 0x495057);
    const dm = new THREE.Object3D();
    const marks = line(B, [v3(0, -0.8, 0), v3(lam, -0.8, 0)], 0x1c7ed6);
    marks.visible = lam < Lr;
    if (lam < Lr) B.label(`λ = ${fmt(lam)} m`, v3(lam / 2, -0.8, -0.35), { scale: 0.7, color: "#1c7ed6" });
    B.info.push({ label: T("Retard entre deux points distants de d", "التأخر الزمني بين نقطتين", "Delay between two points distance d"), value: "τ = d / v" });
    const lab = liveLabel(B, v3(0, 0, 1.8), { scale: 0.75 });
    B.onFrame((t0) => {
      const t = frozen ? 3.3 : t0 % (Lr / v + 6);
      for (let i = 0; i < n; i++) {
        const x0 = (i / (n - 1)) * Lr;
        const on = x0 <= v * t;
        const u = on ? A * Math.sin(w * (t - x0 / v)) : 0;
        if (kind === "rope") dm.position.set(x0, 0, u * 2);
        else { dm.position.set(x0 + u * 0.6, 0, 0.3); dm.rotation.set(0, Math.PI / 2, 0); }
        dm.updateMatrix();
        inst.setMatrixAt(i, dm.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
      lab.set(`t = ${fmt(t, 2)} s   front d'onde : x = ${fmt(Math.min(Lr, v * t), 2)} m`);
    });
    return;
  }
  // surface de l'eau
  const S = 10, n = 140;
  const g = B.track(new THREE.PlaneGeometry(S, S, n, n));
  const col = new Float32Array((n + 1) * (n + 1) * 3);
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const surf = new THREE.Mesh(g, B.track(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.35, metalness: 0.1 })));
  B.m.add(surf);
  const srcs: V[] = kind === "two" ? [v3(-a / 2, -S / 2 + 0.5, 0), v3(a / 2, -S / 2 + 0.5, 0)] : kind === "slit" ? [] : [v3(0, 0, 0)];
  srcs.forEach((q) => rod(B, q.clone().add(v3(0, 0, -0.2)), q.clone().add(v3(0, 0, 1.2)), 0.05, 0x495057));
  if (kind === "slit") {
    const half = Math.min(a, S) / 2;
    box(B, v3(-(S / 2 + half) / 2, 0, 0.1), S / 2 - half, 0.15, 0.4, 0x495057);
    box(B, v3((S / 2 + half) / 2, 0, 0.1), S / 2 - half, 0.15, 0.4, 0x495057);
    B.info.push({ label: T("Écart angulaire de diffraction", "الفرق الزاوي للحيود", "Diffraction half-angle"), value: a < lam * 3 ? `θ ≈ λ / a = ${fmt(lam / a, 3)} rad` : "a ≫ λ : diffraction peu visible" });
  }
  if (kind === "two") B.info.push({ label: T("Franges d'amplitude maximale", "هدب الوسع الأقصى", "Maximum-amplitude fringes"), value: "|d₁ − d₂| = k·λ (k entier)" });
  const pos = g.attributes.position as THREE.BufferAttribute;
  const c = new THREE.Color();
  const k = (2 * Math.PI) / lam;
  B.onFrame((t0) => {
    const t = frozen ? 6 : t0;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      let z = 0;
      if (kind === "slit") {
        const yy = y + S / 2; // l'onde plane arrive de y = −S/2, la fente est en y = 0
        if (y < 0) z = yy <= v * t ? A * Math.sin(w * t - k * yy) : 0;
        else {
          const r = Math.hypot(x, y), d = S / 2 + r;
          const ang = Math.atan2(Math.abs(x), y);
          const spread = a < lam ? 1 : Math.exp(-((ang / Math.max(0.05, lam / a)) ** 2));
          z = d <= v * t ? (A * spread * Math.sin(w * t - k * d)) / Math.sqrt(1 + r * 0.6) : 0;
        }
      } else {
        for (const q of srcs) {
          const r = Math.hypot(x - q.x, y - q.y);
          if (r <= v * t) z += (A * Math.sin(w * t - k * r)) / Math.sqrt(1 + r * 0.5);
        }
      }
      pos.setZ(i, z);
      c.setHSL(0.58, 0.7, 0.45 + clamp(z / (A * 2), -0.3, 0.3));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    pos.needsUpdate = true;
    (g.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    g.computeVertexNormals();
  });
}

// ------------------------------------------------------------------ lentille mince
export function lens(B: Builder, p: Params) {
  const conv = p.type !== "div";
  const f = (conv ? 1 : -1) * N(p.f, 10), OA = N(p.OA, -30), AB = N(p.AB, 4);
  const s = 0.13;
  B.labelSize = 0.42;
  const X = (x: number, z = 0) => v3(clamp(x, -75, 75) * s, 0, z * s);
  line(B, [X(-75), X(75)], B.pal.edge);
  B.label("Δ", X(74), { offset: v3(0, 0, 0.3), scale: 0.7 });
  const H = Math.max(10, AB * 2.4);
  const lensMesh = new THREE.Mesh(B.track(new THREE.SphereGeometry(1, 32, 16)), mat(B, 0x74c0fc, { opacity: 0.35 }));
  lensMesh.scale.set(conv ? 0.18 : 0.08, 0.9, H * s * 0.5);
  B.m.add(lensMesh);
  if (!conv) { box(B, v3(0, 0, H * s * 0.5), 0.36, 0.2, 0.06, 0x74c0fc); box(B, v3(0, 0, -H * s * 0.5), 0.36, 0.2, 0.06, 0x74c0fc); }
  B.arrow(X(0, -H / 2), X(0, H / 2 + 1), 0x1c7ed6);
  B.arrow(X(0, H / 2), X(0, -H / 2 - 1), 0x1c7ed6);
  [["F", -f], ["F'", f]].forEach(([n, x]) => { B.dot(X(Number(x)), 0x1c7ed6, 0.07); B.label(String(n), X(Number(x)), { offset: v3(0, 0, -0.35), scale: 0.8, color: "#1c7ed6" }); });
  B.label("O", X(0), { offset: v3(0.25, 0, -0.35), scale: 0.8 });
  B.arrow(X(OA), X(OA, AB), 0x2f9e44);
  B.label("A", X(OA), { offset: v3(0, 0, -0.35), scale: 0.8 }); B.label("B", X(OA, AB), { offset: v3(0, 0, 0.3), scale: 0.8 });
  const inf = Math.abs(OA + f) < 1e-6;
  const OA2 = inf ? Infinity : 1 / (1 / f + 1 / OA);
  const gam = OA2 / OA, A2B2 = gam * AB;
  const real = Number.isFinite(OA2) && OA2 > 0;
  if (Number.isFinite(OA2)) {
    const mat2 = real ? 0xe8590c : 0xfa5252;
    const from = X(OA2), to = X(OA2, A2B2);
    if (Math.abs(OA2) <= 75) {
      if (real) B.arrow(from, to, mat2);
      else line(B, [from, to], mat2, B.m, true);
      B.label("A'", from, { offset: v3(0, 0, A2B2 > 0 ? -0.35 : 0.35), scale: 0.8 });
      B.label("B'", to, { offset: v3(0, 0, A2B2 > 0 ? 0.3 : -0.35), scale: 0.8 });
    }
  }
  if (p.rays) {
    const B0 = { x: OA, z: AB };
    const ray = (pts: [number, number][], color: number, dashed = false) => line(B, pts.map(([x, z]) => X(x, z)), color, B.m, dashed);
    const ext = (x1: number, z1: number, x2: number, z2: number, toX: number): [number, number] => [toX, z1 + ((z2 - z1) * (toX - x1)) / (x2 - x1)];
    // rayon parallèle à l'axe → passe par F'
    ray([[B0.x, B0.z], [0, B0.z], ext(0, B0.z, f, 0, 75)], 0xf59f00);
    if (!real) ray([[0, B0.z], ext(0, B0.z, f, 0, -75)], 0xf59f00, true);
    // rayon passant par O : non dévié
    ray([[B0.x, B0.z], ext(B0.x, B0.z, 0, 0, 75)], 0x7048e8);
    if (!real) ray([[0, 0], ext(B0.x, B0.z, 0, 0, -75)], 0x7048e8, true);
    // rayon passant par F → ressort parallèle
    if (Math.abs(B0.x + f) > 1e-6) {
      const zl = B0.z + ((0 - B0.z) * (0 - B0.x)) / (-f - B0.x);
      ray([[B0.x, B0.z], [0, zl], [75, zl]], 0x12b886);
      if (!real) ray([[0, zl], [-75, zl]], 0x12b886, true);
    }
  }
  B.info.push({ label: T("Relation de conjugaison", "علاقة المرافقة", "Lens equation"), value: "1/OA' − 1/OA = 1/f'" });
  B.info.push({ label: T("Position de l'image", "موضع الصورة", "Image position"), value: inf ? "image à l'infini (objet au foyer)" : `OA' ≈ ${fmt(OA2, 2)} cm` });
  if (!inf) {
    B.info.push({ label: T("Grandissement", "التكبير", "Magnification"), value: `γ = OA'/OA ≈ ${fmt(gam, 3)} · A'B' ≈ ${fmt(A2B2, 2)} cm` });
    B.info.push({ label: T("Nature de l'image", "طبيعة الصورة", "Nature of the image"), value: `${real ? "réelle" : "virtuelle"}, ${gam > 0 ? "droite" : "renversée"}, ${Math.abs(gam) > 1 ? "agrandie" : "réduite"}${conv && !real ? " (loupe)" : ""}` });
  }
  B.info.push({ label: T("Vergence", "التقارب", "Optical power"), value: `C = 1/f' = ${fmt(100 / f, 2)} δ` });
}

// ------------------------------------------------------------------ dispersion par un prisme
export function dispersion(B: Builder, p: Params) {
  const A = (N(p.A, 60) * Math.PI) / 180, i = (N(p.i, 50) * Math.PI) / 180, ny = N(p.n, 1.62);
  B.labelSize = 0.42;
  const side = 4;
  const apex = v3(0, 0, side * Math.cos(A / 2));
  const L = v3(-side * Math.sin(A / 2), 0, 0), R = v3(side * Math.sin(A / 2), 0, 0);
  const shape = new THREE.Shape([new THREE.Vector2(L.x, L.z), new THREE.Vector2(R.x, R.z), new THREE.Vector2(apex.x, apex.z)]);
  const geo = B.track(new THREE.ExtrudeGeometry(shape, { depth: 1.6, bevelEnabled: false }));
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0.8, 0);
  B.m.add(new THREE.Mesh(geo, mat(B, 0xa5d8ff, { opacity: 0.35 })));
  const cauchy = (lam: number) => ny + 0.0042 * (1 / (lam * lam) - 1 / (0.589 * 0.589));
  const refract = (d: THREE.Vector2, nrm: THREE.Vector2, n1: number, n2: number) => {
    const nn = nrm.clone().normalize();
    let c = -nn.dot(d);
    if (c < 0) { nn.multiplyScalar(-1); c = -c; }
    const r = n1 / n2, k = 1 - r * r * (1 - c * c);
    if (k < 0) return null;
    return d.clone().multiplyScalar(r).add(nn.multiplyScalar(r * c - Math.sqrt(k))).normalize();
  };
  const v2 = (q: V) => new THREE.Vector2(q.x, q.z);
  const hitPt = v2(L).lerp(v2(apex), 0.5);
  const leftDir = v2(apex).sub(v2(L)).normalize();
  const nLeft = new THREE.Vector2(-leftDir.y, leftDir.x); // normale sortante (vers la gauche)
  if (nLeft.x > 0) nLeft.multiplyScalar(-1);
  const inDir = nLeft.clone().multiplyScalar(-1).rotateAround(new THREE.Vector2(0, 0), i);
  const start = hitPt.clone().sub(inDir.clone().multiplyScalar(6));
  const P = (q: THREE.Vector2, y = 0) => v3(q.x, y, q.y);
  line(B, [P(start), P(hitPt)], 0xffffff);
  line(B, [P(hitPt.clone().add(nLeft.clone().multiplyScalar(1.2))), P(hitPt.clone().sub(nLeft.clone().multiplyScalar(1.2)))], B.pal.dashed, B.m, true);
  const lams = p.light === "red" ? [0.7] : p.light === "blue" ? [0.45] : [0.4, 0.43, 0.46, 0.49, 0.52, 0.55, 0.58, 0.61, 0.64, 0.67, 0.7];
  const color = (lam: number) => new THREE.Color().setHSL(clamp((0.7 - lam) / 0.3, 0, 1) * 0.75, 1, 0.5).getHex();
  const rightDir = v2(R).sub(v2(apex)).normalize();
  const nRight = new THREE.Vector2(-rightDir.y, rightDir.x);
  if (nRight.x < 0) nRight.multiplyScalar(-1);
  const screenX = 7;
  box(B, v3(screenX, 0, 2), 0.08, 2, 5, 0xf8f9fa);
  const devs: string[] = [];
  lams.forEach((lam) => {
    const n = cauchy(lam);
    const d1 = refract(inDir, nLeft, 1, n);
    if (!d1) return;
    // intersection avec la face droite
    const o = v2(apex), e = v2(R).sub(o);
    const den = d1.x * e.y - d1.y * e.x;
    const tt = ((o.x - hitPt.x) * e.y - (o.y - hitPt.y) * e.x) / den;
    const q = hitPt.clone().add(d1.clone().multiplyScalar(tt));
    const c = color(lam);
    if (!(tt > 0) || q.y < -1e-6 || q.y > apex.z + 1e-6) { devs.push(`${Math.round(lam * 1000)} nm : sort par la base`); return; }
    line(B, [P(hitPt), P(q)], c);
    const d2 = refract(d1, nRight, n, 1);
    if (!d2) { devs.push(`${Math.round(lam * 1000)} nm : réflexion totale`); return; }
    const k2 = (screenX - q.x) / d2.x;
    const end = q.clone().add(d2.clone().multiplyScalar(k2 > 0 ? k2 : 4));
    line(B, [P(q), P(end)], c);
    if (k2 > 0) ball(B, P(end, 0).add(v3(-0.06, 0, 0)), 0.07, c);
    const D = Math.acos(clamp(inDir.dot(d2), -1, 1));
    if (lam === 0.4 || lam === 0.7 || lams.length === 1 || lam === 0.58) devs.push(`${Math.round(lam * 1000)} nm : n = ${fmt(n, 3)}, D ≈ ${fmt((D * 180) / Math.PI, 1)}°`);
  });
  B.info.push({ label: T("Relations du prisme", "علاقات الموشور", "Prism relations"), value: "sin i = n·sin r ; r + r' = A ; sin i' = n·sin r' ; D = i + i' − A" });
  B.info.push({ label: T("Déviations", "الانحرافات", "Deviations"), value: devs.join(" · ") });
  B.info.push({ label: T("Interprétation", "التفسير", "Interpretation"), value: "le violet (λ courte) est plus dévié : n diminue quand λ augmente" });
}

// ------------------------------------------------------------------ champ magnétique
export function magnet(B: Builder, p: Params) {
  const src = String(p.source || "magnet"), I = N(p.I, 4), Nt = N(p.N, 500), Bmt = N(p.B, 40);
  B.labelSize = 0.42;
  const sgn = I >= 0 ? 1 : -1;
  // champ dans le plan (x, z) : modèle de charges magnétiques
  let charges: { q: V; s: number }[] = [];
  if (src === "magnet") {
    const bar = box(B, v3(-0.75, 0, 0), 1.5, 0.5, 0.5, 0x1c7ed6); void bar;
    box(B, v3(0.75, 0, 0), 1.5, 0.5, 0.5, 0xe03131);
    B.label("N", v3(1.2, 0, 0.45), { color: "#e03131" }); B.label("S", v3(-1.2, 0, 0.45), { color: "#1c7ed6" });
    charges = [{ q: v3(1.3, 0, 0), s: 1 }, { q: v3(-1.3, 0, 0), s: -1 }];
  }
  if (src === "solenoid") {
    const Ls = 4, r = 0.8, turns = 18;
    const pts: V[] = [];
    for (let i = 0; i <= turns * 40; i++) { const u = i / (turns * 40); const a = u * turns * 2 * Math.PI; pts.push(v3(-Ls / 2 + u * Ls, r * Math.sin(a), r * Math.cos(a))); }
    const tube = B.track(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 40, 0.04, 6));
    B.m.add(new THREE.Mesh(tube, mat(B, 0xd9480f, { metal: 0.6, rough: 0.3 })));
    for (let k = -3; k <= 3; k++) for (let j = -2; j <= 2; j++) if (Math.hypot(k, j) <= 3.2) charges.push({ q: v3(sgn * Ls / 2, (j * r) / 3, (k * r) / 4.5), s: 1 / 25 }, { q: v3(-sgn * Ls / 2, (j * r) / 3, (k * r) / 4.5), s: -1 / 25 });
    B.label(sgn > 0 ? "N" : "S", v3(Ls / 2 + 0.4, 0, 1.1), { color: "#e03131" }); B.label(sgn > 0 ? "S" : "N", v3(-Ls / 2 - 0.4, 0, 1.1), { color: "#1c7ed6" });
    B.info.push({ label: T("Champ au centre du solénoïde", "المجال في مركز الوشيعة", "Field at the centre"), value: `B = μ₀·N·I / L ≈ ${fmt((4e-7 * Math.PI * Nt * Math.abs(I) / 0.4) * 1000, 3)} mT (L = 40 cm)` });
  }
  const field = (r: V) => {
    const b = v3(0, 0, 0);
    for (const c of charges) { const d = r.clone().sub(c.q); const l = Math.max(d.length(), 0.05); b.addScaledVector(d, c.s / (l * l * l)); }
    return b;
  };
  if (src === "magnet" || src === "solenoid") {
    const starts: V[] = [];
    const pos = charges.filter((c) => c.s > 0).map((c) => c.q);
    const center = pos.reduce((s, q) => s.add(q), v3(0, 0, 0)).multiplyScalar(1 / pos.length);
    const nl = 16;
    for (let k = 0; k < nl; k++) { const a = (k / nl) * 2 * Math.PI; starts.push(center.clone().add(v3(Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25))); }
    for (const s0 of starts) {
      const pts: V[] = [s0.clone()];
      let q = s0.clone();
      for (let i = 0; i < 900; i++) {
        const b = field(q);
        if (b.length() < 1e-6) break;
        q = q.clone().addScaledVector(b.normalize(), 0.04);
        q.y = 0;
        pts.push(q);
        if (Math.abs(q.x) > 7 || Math.abs(q.z) > 5) break;
        if (charges.some((c) => c.s < 0 && c.q.distanceTo(q) < 0.15)) break;
      }
      line(B, pts, 0x7048e8);
      const mid = pts[Math.floor(pts.length / 2)], nx = pts[Math.floor(pts.length / 2) + 1];
      if (mid && nx) B.arrow(mid, mid.clone().add(nx.clone().sub(mid).normalize().multiplyScalar(0.3)), 0x7048e8);
    }
    if (p.compass) {
      for (let x = -5; x <= 5; x += 2.5) for (const z of [-2.2, 2.2]) needle(B, v3(x, 0, z), field(v3(x, 0, z)));
    }
    B.info.push({ label: T("Lignes de champ", "خطوط المجال", "Field lines"), value: "sortent par le pôle Nord, entrent par le pôle Sud ; l'aiguille s'oriente tangentiellement" });
  }
  if (src === "wire") {
    rod(B, v3(0, 0, -3), v3(0, 0, 3), 0.06, 0xd9480f);
    B.arrow(v3(0.3, 0, 2), v3(0.3, 0, 2 + sgn * 0.8), 0xe03131);
    B.label("I", v3(0.6, 0, 2.4), { color: "#e03131" });
    for (const z of [-1.5, 0, 1.5]) for (const r of [0.8, 1.6, 2.6]) {
      const ring: V[] = Array.from({ length: 65 }, (_, i) => v3(r * Math.cos((i / 64) * 2 * Math.PI), r * Math.sin((i / 64) * 2 * Math.PI), z));
      line(B, ring, 0x7048e8);
      const a0 = v3(r, 0, z);
      B.arrow(a0, a0.clone().add(v3(0, sgn * 0.3, 0)), 0x7048e8);
      if (p.compass && z === 0) for (let k = 0; k < 6; k++) { const a = (k / 6) * 2 * Math.PI + 0.3; needle(B, v3(r * Math.cos(a), r * Math.sin(a), 0.05), v3(-Math.sin(a) * sgn, Math.cos(a) * sgn, 0), true); }
    }
    B.info.push({ label: T("Champ à 5 cm du fil", "المجال على بعد 5 سم", "Field 5 cm from the wire"), value: `B = μ₀·I / (2π·d) ≈ ${fmt((2e-7 * Math.abs(I)) / 0.05 * 1000, 4)} mT` });
    B.info.push({ label: T("Sens", "المنحى", "Direction"), value: "règle de la main droite : lignes circulaires autour du fil" });
  }
  if (src === "laplace") {
    const Lr = 1.6;
    rod(B, v3(-3, -Lr / 2, 0), v3(3, -Lr / 2, 0), 0.05, 0xadb5bd);
    rod(B, v3(-3, Lr / 2, 0), v3(3, Lr / 2, 0), 0.05, 0xadb5bd);
    box(B, v3(0, 0, -1.2), 4, 2.6, 0.5, 0xe03131);
    box(B, v3(0, 0, 1.6), 4, 2.6, 0.5, 0x1c7ed6);
    B.label("N", v3(2.3, 0, -1.2), { color: "#e03131" }); B.label("S", v3(2.3, 0, 1.6), { color: "#1c7ed6" });
    for (let x = -1.5; x <= 1.5; x += 1) for (let y = -1; y <= 1; y += 1) B.arrow(v3(x, y, -0.9), v3(x, y, -0.3), 0x7048e8);
    B.label("B", v3(-1.9, 1.1, -0.6), { color: "#7048e8" });
    const r = rod(B, v3(0, -Lr / 2 - 0.2, 0.08), v3(0, Lr / 2 + 0.2, 0.08), 0.07, 0xd9480f);
    const F = liveArrow(B, 0x2f9e44);
    const Fval = Math.abs(I) * 0.05 * Bmt * 1e-3;
    B.info.push({ label: T("Force de Laplace", "قوة لابلاس", "Laplace force"), value: `F = I·ℓ·B = ${fmt(Math.abs(I))} × 0,05 × ${fmt(Bmt / 1000, 3)} ≈ ${fmt(Fval * 1000, 3)} mN (ℓ = 5 cm)` });
    B.info.push({ label: T("Sens", "المنحى", "Direction"), value: "règle des trois doigts de la main droite ; inverser I inverse F" });
    B.onFrame((t) => {
      const x = -2.6 + ((t * 0.8 * (0.3 + Bmt / 100) * Math.abs(I) / 4) % 5.2);
      const xx = sgn > 0 ? x : -x;
      r.position.x = xx;
      F.set(v3(xx, 0, 0.3), v3(sgn * (0.6 + Fval * 50), 0, 0));
    });
    return;
  }
  // courant : petits points qui circulent
  if (src !== "magnet") B.info.push({ label: T("Intensité", "الشدة", "Current"), value: `I = ${fmt(I)} A` });
}
function needle(B: Builder, at: V, dir: V, flat = false) {
  const d = dir.clone();
  if (!flat) d.y = 0;
  if (d.length() < 1e-9) return;
  d.normalize();
  const g = new THREE.Group();
  g.position.copy(at);
  const n = new THREE.Mesh(B.track(new THREE.ConeGeometry(0.08, 0.35, 10)), mat(B, 0xe03131));
  n.position.y = 0.175;
  const s = new THREE.Mesh(B.track(new THREE.ConeGeometry(0.08, 0.35, 10)), mat(B, 0xdee2e6));
  s.position.y = -0.175; s.rotation.z = Math.PI;
  g.add(n, s);
  g.quaternion.setFromUnitVectors(v3(0, 1, 0), d);
  B.m.add(g);
}

// ------------------------------------------------------------------ plan incliné
export function incline(B: Builder, p: Params) {
  const al = (N(p.alpha, 25) * Math.PI) / 180, m = N(p.m, 2), mu = N(p.mu, 0.2), g = 9.8;
  B.labelSize = 0.42;
  const Lp = 7, Hp = Lp * Math.tan(al);
  const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(Lp, 0), new THREE.Vector2(0, Hp)]);
  const geo = B.track(new THREE.ExtrudeGeometry(shape, { depth: 2, bevelEnabled: false }));
  geo.rotateX(Math.PI / 2); geo.translate(0, 1, 0);
  B.m.add(new THREE.Mesh(geo, mat(B, 0xced4da)));
  ground(B, 3.5, 0, 12, 4, -0.001);
  const slides = Math.tan(al) > mu;
  const acc = slides ? g * (Math.sin(al) - mu * Math.cos(al)) : 0;
  const dirDown = v3(Math.cos(al), 0, -Math.sin(al));
  const nrm = v3(Math.sin(al), 0, Math.cos(al));
  const blk = new THREE.Group();
  box(B, v3(0, 0, 0.3), 0.8, 0.8, 0.6, 0x4c6ef5, blk);
  blk.rotation.y = al;
  B.m.add(blk);
  const pathLen = Math.hypot(Lp, Hp) - 1.2;
  const start = v3(0.3, 0, Hp).addScaledVector(dirDown, 0.4);
  const sc = 0.07;
  const Pv = liveArrow(B, 0xe03131), Rn = liveArrow(B, 0x2f9e44), Fr = liveArrow(B, 0xf59f00), Px = liveArrow(B, 0xff8787), Py = liveArrow(B, 0xff8787), Rt = liveArrow(B, 0x12b886);
  const lab = liveLabel(B, v3(-1, 0, Hp + 1.4), { scale: 0.75 });
  const W = m * g, RN = W * Math.cos(al), f = slides ? mu * RN : W * Math.sin(al);
  B.info.push({ label: T("Poids", "الوزن", "Weight"), value: `P = m·g = ${fmt(W)} N` });
  B.info.push({ label: T("Réaction normale", "المركبة المنظمية للتأثير", "Normal reaction"), value: `R_N = m·g·cos α = ${fmt(RN)} N` });
  B.info.push({ label: T("Frottement", "الاحتكاك", "Friction"), value: slides ? `f = μ·R_N = ${fmt(f)} N` : `f = m·g·sin α = ${fmt(f)} N (équilibre)` });
  B.info.push({ label: T("Condition de glissement", "شرط الانزلاق", "Sliding condition"), value: `tan α = ${fmt(Math.tan(al), 3)} ${slides ? ">" : "≤"} μ = ${fmt(mu, 2)} → ${slides ? "le solide glisse" : "le solide reste immobile"}` });
  if (slides) B.info.push({ label: T("Accélération", "التسارع", "Acceleration"), value: `a = g(sin α − μ cos α) = ${fmt(acc, 3)} m/s²` });
  B.onFrame((t) => {
    const T1 = slides ? Math.sqrt((2 * pathLen) / Math.max(acc, 1e-3)) : 1;
    const tt = slides ? t % (Math.min(T1, 12) + 1) : 0;
    const d = slides ? Math.min(pathLen, 0.5 * acc * tt * tt) : 0;
    const pos = start.clone().addScaledVector(dirDown, d);
    blk.position.copy(pos);
    const c = pos.clone().addScaledVector(nrm, 0.3);
    if (p.forces) {
      Pv.set(c, v3(0, 0, -W * sc));
      Rn.set(c, nrm.clone().multiplyScalar(RN * sc));
      Fr.set(c, dirDown.clone().multiplyScalar(-f * sc));
      Rt.set(c, nrm.clone().multiplyScalar(RN * sc).addScaledVector(dirDown, -f * sc));
    } else [Pv, Rn, Fr, Rt].forEach((a) => (a.obj.visible = false));
    if (p.decompose) { Px.set(c, dirDown.clone().multiplyScalar(W * Math.sin(al) * sc)); Py.set(c, nrm.clone().multiplyScalar(-W * Math.cos(al) * sc)); }
    else { Px.obj.visible = false; Py.obj.visible = false; }
    const v = acc * tt;
    lab.set(slides ? `t = ${fmt(tt, 2)} s   d = ${fmt(d / 1, 2)} m   v = ${fmt(Math.min(v, Math.sqrt(2 * acc * pathLen)), 2)} m/s   Ec = ${fmt(0.5 * m * Math.min(v * v, 2 * acc * pathLen), 2)} J` : "Équilibre : P + R = 0");
  });
}

// ------------------------------------------------------------------ moments
export function lever(B: Builder, p: Params) {
  const m1 = N(p.m1, 200) / 1000, d1 = N(p.d1, 15) / 100, m2 = N(p.m2, 100) / 1000, d2 = N(p.d2, 30) / 100, g = 9.8;
  B.labelSize = 0.4;
  const s = 10; // unités par mètre
  const M1 = m1 * g * d1, M2 = m2 * g * d2, dM = M1 - M2;
  const target = Math.abs(dM) < 1e-6 ? 0 : clamp(dM * 8, -0.32, 0.32);
  rod(B, v3(0, -0.5, -3), v3(0, -0.5, 0), 0.08, 0x495057);
  box(B, v3(0, -0.5, -3), 2, 1.2, 0.15, 0x495057);
  const bar = new THREE.Group();
  B.m.add(bar);
  box(B, v3(0, 0, 0), 9, 0.3, 0.25, 0xd9a066, bar);
  for (let c = -45; c <= 45; c += 5) box(B, v3((c / 100) * s, 0.16, 0), 0.02, 0.02, c % 10 === 0 ? 0.25 : 0.12, 0x212529, bar);
  rod(B, v3(0, -0.6, 0), v3(0, 0.6, 0), 0.06, 0x868e96);
  const mkMass = (m: number, color: number) => {
    const h = 0.25 + m * 3;
    const g0 = new THREE.Group();
    const str = unitRod(B, 0.012, 0x495057, g0);
    const bx = box(B, v3(0, 0, 0), 0.5, 0.5, h, color, g0);
    B.m.add(g0);
    return { g: g0, str, bx, h };
  };
  const A = m1 > 0 ? mkMass(m1, 0x4c6ef5) : null, Bm = m2 > 0 ? mkMass(m2, 0xe8590c) : null;
  const la = A ? B.label(`${fmt(m1 * 1000, 0)} g`, v3(0, 0, 0), { scale: 0.7 }) : null;
  const lb = Bm ? B.label(`${fmt(m2 * 1000, 0)} g`, v3(0, 0, 0), { scale: 0.7 }) : null;
  B.info.push({ label: T("Moment de F₁ (sens +)", "عزم F₁", "Moment of F₁"), value: `M₁ = m₁·g·d₁ = ${fmt(M1, 4)} N·m` });
  B.info.push({ label: T("Moment de F₂ (sens −)", "عزم F₂", "Moment of F₂"), value: `M₂ = −m₂·g·d₂ = −${fmt(M2, 4)} N·m` });
  B.info.push({ label: T("Somme des moments", "مجموع العزوم", "Sum of moments"), value: `ΣM = ${fmt(dM, 4)} N·m → ${Math.abs(dM) < 1e-6 ? "équilibre" : dM > 0 ? "la barre tourne vers la gauche" : "la barre tourne vers la droite"}` });
  B.onFrame((t) => {
    const th = target * (1 - Math.exp(-(t % 6) / 0.6));
    bar.rotation.y = th;
    const at = (x: number) => v3(x * Math.cos(th), 0, -x * Math.sin(th));
    const place = (q: typeof A, x: number, l: THREE.Sprite | null) => {
      if (!q) return;
      const top = at(x);
      const bot = top.clone().add(v3(0, 0, -1.6));
      placeRod(q.str, top.clone().sub(q.g.position), bot.clone().sub(q.g.position));
      q.g.position.set(0, 0, 0);
      placeRod(q.str, top, bot);
      q.bx.position.copy(bot.clone().add(v3(0, 0, -q.h / 2)));
      l?.position.copy(bot.clone().add(v3(0.7, 0, -q.h / 2)));
    };
    place(A, -d1 * s, la);
    place(Bm, d2 * s, lb);
  });
}

// ------------------------------------------------------------------ RC / RL
export function rc(B: Builder, p: Params) {
  const mode = String(p.circuit || "rc_charge"), E = N(p.E, 6), R = N(p.R, 1000), C = N(p.C, 100) * 1e-6, L = N(p.L, 500) * 1e-3;
  const tau = mode === "rl" ? L / R : R * C;
  const tmax = 5 * tau;
  B.labelSize = 0.42;
  const f = mode === "rc_charge" ? (t: number) => E * (1 - Math.exp(-t / tau)) : mode === "rc_discharge" ? (t: number) => E * Math.exp(-t / tau) : (t: number) => (E / R) * (1 - Math.exp(-t / tau));
  const ymax = mode === "rl" ? (E / R) * 1.1 : E * 1.1;
  const unit = (x: number) => (tau < 0.01 ? x * 1000 : x);
  const tl = tau < 0.01 ? "t (ms)" : "t (s)";
  const pl = plot(B, { origin: v3(0, 0, 0), w: 8, h: 4.5, xmax: unit(tmax), ymin: 0, ymax: mode === "rl" ? ymax * 1000 : ymax, xlabel: tl, ylabel: mode === "rl" ? "i (mA)" : "u_C (V)" });
  const fy = (x: number) => (mode === "rl" ? f(tau < 0.01 ? x / 1000 : x) * 1000 : f(tau < 0.01 ? x / 1000 : x));
  pl.curve(fy, 0xe8590c);
  const yEnd = mode === "rl" ? (E / R) * 1000 : E;
  pl.curve(() => (mode === "rc_discharge" ? 0 : yEnd), 0x868e96, 2, true);
  // tangente à l'origine
  if (mode === "rc_discharge") pl.curve((x) => E * (1 - x / unit(tau)), 0x2f9e44, 60, true);
  else pl.curve((x) => (yEnd * x) / unit(tau), 0x2f9e44, 60, true);
  const yt = fy(unit(tau));
  line(B, [pl.map(unit(tau), 0), pl.map(unit(tau), yt), pl.map(0, yt)], 0x1c7ed6, B.m, true);
  B.label(`τ = ${fmt(unit(tau), 3)} ${tau < 0.01 ? "ms" : "s"}`, pl.map(unit(tau), 0), { offset: v3(0, 0, -0.7), color: "#1c7ed6", scale: 0.75 });
  B.label(mode === "rc_discharge" ? "0,37·E" : mode === "rl" ? "0,63·I_p" : "0,63·E", pl.map(0, yt), { offset: v3(-1.1, 0, 0), color: "#1c7ed6", scale: 0.6 });
  // composant en 3D
  const comp = new THREE.Group();
  comp.position.set(10, 0, 2);
  B.m.add(comp);
  const charges: THREE.Mesh[] = [];
  if (mode !== "rl") {
    box(B, v3(-0.4, 0, 0), 0.08, 1.6, 2, 0xadb5bd, comp);
    box(B, v3(0.4, 0, 0), 0.08, 1.6, 2, 0xadb5bd, comp);
    for (let i = 0; i < 20; i++) {
      const y = -0.6 + ((i % 5) / 4) * 1.2, z = -0.8 + (Math.floor(i / 5) / 3) * 1.6;
      charges.push(ball(B, v3(-0.5, y, z), 0.07, 0xe03131, comp), ball(B, v3(0.5, y, z), 0.07, 0x1c7ed6, comp));
    }
    B.label("C", v3(0, 0, 1.4), { parent: comp });
  } else {
    const pts: V[] = [];
    for (let i = 0; i <= 400; i++) { const u = i / 400; pts.push(v3(-1.2 + u * 2.4, 0.5 * Math.sin(u * 40 * Math.PI), 0.5 * Math.cos(u * 40 * Math.PI))); }
    comp.add(new THREE.Mesh(B.track(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.04, 6)), mat(B, 0xd9480f, { metal: 0.5 })));
    B.label("L", v3(0, 0, 1), { parent: comp });
  }
  const cur = pl.cursor();
  const lab = liveLabel(B, v3(0, 0, 5.6), { scale: 0.75 });
  B.info.push({ label: T("Constante de temps", "ثابتة الزمن", "Time constant"), value: mode === "rl" ? `τ = L/R = ${fmt(tau, 5)} s` : `τ = R·C = ${fmt(tau, 5)} s` });
  B.info.push({ label: T("Équation différentielle", "المعادلة التفاضلية", "Differential equation"), value: mode === "rc_charge" ? "τ·du_C/dt + u_C = E" : mode === "rc_discharge" ? "τ·du_C/dt + u_C = 0" : "τ·di/dt + i = E/R" });
  B.info.push({ label: T("Solution", "الحل", "Solution"), value: mode === "rc_charge" ? "u_C = E(1 − e^(−t/τ))" : mode === "rc_discharge" ? "u_C = E·e^(−t/τ)" : "i = (E/R)(1 − e^(−t/τ))" });
  B.info.push({ label: T("Énergie finale stockée", "الطاقة المخزونة", "Stored energy"), value: mode === "rl" ? `E_m = ½·L·I² = ${fmt(0.5 * L * (E / R) ** 2, 6)} J` : `E_e = ½·C·E² = ${fmt(0.5 * C * E * E, 6)} J` });
  B.onFrame((t) => {
    const x = ((t % 8) / 8) * tmax;
    const y = f(x);
    cur.set(unit(x), mode === "rl" ? y * 1000 : y);
    const frac = mode === "rl" ? y / (E / R) : y / E;
    charges.forEach((c, i) => (c.visible = Math.floor(i / 2) < Math.round(frac * 20)));
    lab.set(`t = ${fmt(unit(x), 3)} ${tau < 0.01 ? "ms" : "s"}   ${mode === "rl" ? `i = ${fmt(y * 1000, 3)} mA` : `u_C = ${fmt(y, 3)} V`}`);
  });
}

// ------------------------------------------------------------------ RLC
export function rlc(B: Builder, p: Params) {
  const L = N(p.L, 100) / 1000, C = N(p.C, 10) * 1e-6, R = N(p.R, 20), E = N(p.E, 6);
  const w0 = 1 / Math.sqrt(L * C), T0 = 2 * Math.PI / w0, lam = R / (2 * L), Rc = 2 * Math.sqrt(L / C);
  B.labelSize = 0.42;
  const tmax = 5 * T0;
  const dt = tmax / 4000;
  const us: number[] = [], is: number[] = [];
  let q = C * E, i = 0;
  for (let k = 0; k <= 4000; k++) { us.push(q / C); is.push(i); const a = -(R / L) * i - q / (L * C); i += a * dt; q += i * dt; }
  const ms = 1000;
  const pl = plot(B, { origin: v3(0, 0, 0), w: 9, h: 5, xmax: tmax * ms, ymin: -E * 1.1, ymax: E * 1.1, xlabel: "t (ms)", ylabel: "u_C (V)" });
  pl.points(us.filter((_, k) => k % 8 === 0).map((u, k) => [k * 8 * dt * ms, u]), 0xe8590c);
  if (lam > 0 && R < Rc) { pl.curve((x) => E * Math.exp((-lam * x) / ms), 0x868e96, 100, true); pl.curve((x) => -E * Math.exp((-lam * x) / ms), 0x868e96, 100, true); }
  if (p.energy) {
    const Emax = 0.5 * C * E * E;
    const pe = plot(B, { origin: v3(0, 0, 6.6), w: 9, h: 2.6, xmax: tmax * ms, ymin: 0, ymax: Emax * 1.1 * 1000, xlabel: "t (ms)", ylabel: "E (mJ)" });
    pe.points(us.filter((_, k) => k % 8 === 0).map((u, k) => [k * 8 * dt * ms, 0.5 * C * u * u * 1000]), 0x1c7ed6);
    pe.points(is.filter((_, k) => k % 8 === 0).map((x, k) => [k * 8 * dt * ms, 0.5 * L * x * x * 1000]), 0xe03131);
    pe.points(us.filter((_, k) => k % 8 === 0).map((u, k) => [k * 8 * dt * ms, (0.5 * C * u * u + 0.5 * L * is[k * 8] ** 2) * 1000]), 0x2f9e44);
    B.info.push({ label: T("Énergies", "الطاقات", "Energies"), value: "bleu : électrique ½Cu² · rouge : magnétique ½Li² · vert : totale" });
  }
  const cur = pl.cursor();
  const regime = R === 0 ? "périodique (oscillations non amorties)" : R < Rc ? "pseudo-périodique" : "apériodique (pas d'oscillation)";
  B.info.push({ label: T("Période propre", "الدور الخاص", "Natural period"), value: `T₀ = 2π√(LC) ≈ ${fmt(T0 * ms, 3)} ms` });
  B.info.push({ label: T("Régime", "النظام", "Regime"), value: regime });
  B.info.push({ label: T("Résistance critique (repère)", "المقاومة الحرجة", "Critical resistance"), value: `R_c = 2√(L/C) ≈ ${fmt(Rc, 1)} Ω` });
  B.info.push({ label: T("Équation différentielle", "المعادلة التفاضلية", "Differential equation"), value: "L·C·d²u_C/dt² + R·C·du_C/dt + u_C = 0" });
  B.onFrame((t) => { const k = Math.floor(((t % 10) / 10) * 4000); cur.set(k * dt * ms, us[k]); });
}

// ------------------------------------------------------------------ radioactivité
const NUCLIDES: Record<string, { name: string; th: number; unit: string; seconds: number }> = {
  c14: { name: "¹⁴C", th: 5730, unit: "ans", seconds: 5730 * 3.156e7 },
  i131: { name: "¹³¹I", th: 8.02, unit: "jours", seconds: 8.02 * 86400 },
  po210: { name: "²¹⁰Po", th: 138.4, unit: "jours", seconds: 138.4 * 86400 },
  co60: { name: "⁶⁰Co", th: 5.27, unit: "ans", seconds: 5.27 * 3.156e7 },
};
export function decay(B: Builder, p: Params) {
  const nu = NUCLIDES[String(p.nuclide)] || NUCLIDES.c14;
  const N0 = Math.round(N(p.N0, 400)), speed = N(p.speed, 2), rnd = rng(N(p.seed, 1) * 977 + N0);
  B.labelSize = 0.42;
  const side = Math.ceil(Math.cbrt(N0));
  const gap = 0.32;
  const life = Array.from({ length: N0 }, () => -Math.log(1 - rnd()) / Math.LN2); // en demi-vies
  const geo = B.track(new THREE.SphereGeometry(0.12, 12, 8));
  const alive = new THREE.InstancedMesh(geo, mat(B, 0xfab005, { emissive: 0x5c3d00 }), N0);
  const dead = new THREE.InstancedMesh(geo, mat(B, 0x868e96, { opacity: 0.5 }), N0);
  B.m.add(alive, dead);
  const posOf = (i: number) => v3((i % side) * gap - (side * gap) / 2, Math.floor(i / side) % side * gap - (side * gap) / 2, Math.floor(i / (side * side)) * gap + 0.2);
  const dm = new THREE.Object3D();
  const pl = plot(B, { origin: v3(side * gap * 0.7, 0, 0), w: 7, h: 4, xmax: 6, ymin: 0, ymax: 1.05, xlabel: `t (×t½ = ${fmt(nu.th, 2)} ${nu.unit})`, ylabel: "N/N₀", xticks: 6 });
  pl.curve((x) => Math.pow(0.5, x), 0x2f9e44);
  [1, 2, 3].forEach((k) => line(B, [pl.map(k, 0), pl.map(k, 0.5 ** k), pl.map(0, 0.5 ** k)], 0x1c7ed6, B.m, true));
  const counted = liveLine(B, 800, 0xe8590c);
  const cur = pl.cursor();
  const lab = liveLabel(B, v3(-side * gap / 2, 0, side * gap + 0.8), { scale: 0.8 });
  const lambda = Math.LN2 / nu.seconds;
  B.info.push({ label: T("Loi de décroissance", "قانون التناقص", "Decay law"), value: "N(t) = N₀·e^(−λt), λ = ln2 / t½" });
  B.info.push({ label: T("Constante radioactive", "الثابتة الإشعاعية", "Decay constant"), value: `λ ≈ ${fmt(lambda)} s⁻¹` });
  B.info.push({ label: T("Demi-vie", "عمر النصف", "Half-life"), value: `t½ = ${fmt(nu.th, 2)} ${nu.unit} (${nu.name})` });
  B.info.push({ label: T("Caractère aléatoire", "الطابع العشوائي", "Randomness"), value: "chaque noyau se désintègre au hasard ; seule la moyenne suit la loi" });
  B.onFrame((t) => {
    const x = ((t * speed) / 10) % 6;
    let na = 0, nd = 0;
    for (let i = 0; i < N0; i++) {
      dm.position.copy(posOf(i));
      dm.updateMatrix();
      if (life[i] > x) alive.setMatrixAt(na++, dm.matrix); else dead.setMatrixAt(nd++, dm.matrix);
    }
    alive.count = na; dead.count = nd;
    alive.instanceMatrix.needsUpdate = true; dead.instanceMatrix.needsUpdate = true;
    const pts: V[] = [];
    for (let k = 0; k <= 80; k++) { const xx = (x * k) / 80; pts.push(pl.map(xx, life.filter((l) => l > xx).length / N0)); }
    counted.set(pts);
    cur.set(x, na / N0);
    lab.set(`t = ${fmt(x, 2)} t½   noyaux restants : ${na} / ${N0}   (théorie : ${fmt(N0 * 0.5 ** x, 0)})`);
  });
}

// ------------------------------------------------------------------ gaz parfait
export function gas(B: Builder, p: Params) {
  const n = N(p.n, 4) / 1000, Tk = N(p.T, 300), V = N(p.V, 0.1) / 1000, R = 8.314;
  const P = (n * R * Tk) / V;
  B.labelSize = 0.42;
  const len = 2 + (V / 0.0005) * 6, w = 2.4;
  const walls = new THREE.Mesh(B.track(new THREE.BoxGeometry(len, w, w)), mat(B, 0xa5d8ff, { opacity: 0.18 }));
  walls.position.set(len / 2, 0, w / 2);
  B.m.add(walls);
  box(B, v3(len + 0.08, 0, w / 2), 0.16, w, w, 0x868e96);
  rod(B, v3(len + 0.16, 0, w / 2), v3(len + 2, 0, w / 2), 0.08, 0x868e96);
  const count = Math.round(20 + n * 1000 * 8);
  const rnd = rng(count + Math.round(Tk));
  const geo = B.track(new THREE.SphereGeometry(0.07, 10, 8));
  const inst = new THREE.InstancedMesh(geo, mat(B, new THREE.Color().setHSL(0.66 - clamp((Tk - 100) / 700, 0, 1) * 0.66, 0.8, 0.5).getHex()), count);
  B.m.add(inst);
  const ps = Array.from({ length: count }, () => ({ p: v3(rnd() * len, (rnd() - 0.5) * w, rnd() * w), v: v3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize() }));
  const sp = 0.9 * Math.sqrt(Tk / 300);
  const dm = new THREE.Object3D();
  let last = 0;
  const lab = liveLabel(B, v3(0, 0, w + 0.8), { scale: 0.8 });
  B.info.push({ label: T("Équation d'état", "معادلة الحالة", "Equation of state"), value: "P·V = n·R·T (R = 8,314 J/(mol·K))" });
  B.info.push({ label: T("Pression du gaz", "ضغط الغاز", "Gas pressure"), value: `P = ${fmt(P, 0)} Pa ≈ ${fmt(P / 1e5, 3)} bar` });
  B.info.push({ label: T("Volume molaire (dans ces conditions)", "الحجم المولي", "Molar volume"), value: `Vm = R·T / P = ${fmt(((R * Tk) / P) * 1000, 2)} L/mol` });
  B.info.push({ label: T("Vitesse quadratique moyenne (N₂)", "السرعة التربيعية المتوسطة", "RMS speed (N₂)"), value: `≈ ${fmt(Math.sqrt((3 * R * Tk) / 0.028), 0)} m/s` });
  B.onFrame((t) => {
    let dt = t - last; last = t;
    if (dt < 0 || dt > 0.1) dt = 0.016;
    let hits = 0;
    ps.forEach((q, i) => {
      q.p.addScaledVector(q.v, sp * dt);
      if (q.p.x < 0.07) { q.p.x = 0.07; q.v.x *= -1; }
      if (q.p.x > len - 0.07) { q.p.x = len - 0.07; q.v.x *= -1; hits++; }
      if (Math.abs(q.p.y) > w / 2 - 0.07) { q.p.y = Math.sign(q.p.y) * (w / 2 - 0.07); q.v.y *= -1; }
      if (q.p.z < 0.07) { q.p.z = 0.07; q.v.z *= -1; }
      if (q.p.z > w - 0.07) { q.p.z = w - 0.07; q.v.z *= -1; }
      dm.position.copy(q.p);
      dm.updateMatrix();
      inst.setMatrixAt(i, dm.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    void hits;
    lab.set(`P = ${fmt(P / 1000, 1)} kPa   V = ${fmt(V * 1000, 3)} L   T = ${fmt(Tk, 0)} K`);
  });
}

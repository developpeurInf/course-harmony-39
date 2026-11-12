/**
 * Dessin de graphiques (Canvas 2D) pour Excel, Word et PowerPoint :
 * histogramme, barres, courbes, aires, secteurs, anneau, nuage de points.
 * Le résultat est une image PNG insérée dans le document.
 */
export type ChartType = "column" | "stacked" | "bar" | "line" | "area" | "pie" | "doughnut" | "scatter";

export interface ChartSpec {
  type: ChartType;
  title?: string;
  categories: string[];
  series: { name: string; values: number[] }[];
  palette?: string[];
  width?: number;
  height?: number;
  legend?: boolean;
  dataLabels?: boolean;
  background?: string;
  textColor?: string;
}

export const CHART_PALETTES: Record<string, string[]> = {
  office: ["#4472C4", "#ED7D31", "#A5A5A5", "#FFC000", "#5B9BD5", "#70AD47", "#264478", "#9E480E"],
  green: ["#217346", "#33A06A", "#66C28F", "#99D9B4", "#145A32", "#0B3D20"],
  warm: ["#C43E1C", "#E86A3A", "#F2A23C", "#F6C85F", "#8C2B12", "#5E1D0C"],
  cool: ["#2B579A", "#3E7CC9", "#6FA3E0", "#A7C8F0", "#1B3A66", "#0E2240"],
  mono: ["#1F2937", "#4B5563", "#6B7280", "#9CA3AF", "#D1D5DB", "#111827"],
};

const niceStep = (range: number) => {
  const raw = range / 5;
  const p = Math.pow(10, Math.floor(Math.log10(Math.abs(raw) || 1)));
  const n = raw / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
};
const fmt = (v: number) => (Math.abs(v) >= 1000 ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : String(Math.round(v * 100) / 100));

export function renderChart(spec: ChartSpec): string {
  const W = spec.width || 640, H = spec.height || 400, dpr = 2;
  const cv = document.createElement("canvas");
  cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext("2d")!;
  g.scale(dpr, dpr);
  const pal = spec.palette || CHART_PALETTES.office;
  const txt = spec.textColor || "#404040";
  g.fillStyle = spec.background || "#FFFFFF";
  g.fillRect(0, 0, W, H);
  g.font = "13px Calibri, Arial, sans-serif";
  g.textBaseline = "middle";
  let top = 16;
  if (spec.title) {
    g.fillStyle = txt;
    g.font = "bold 18px Calibri, Arial, sans-serif";
    g.textAlign = "center";
    g.fillText(spec.title, W / 2, 24);
    top = 48;
    g.font = "13px Calibri, Arial, sans-serif";
  }
  const showLegend = spec.legend !== false;
  const pie = spec.type === "pie" || spec.type === "doughnut";
  const legendItems = pie ? spec.categories : spec.series.map((s) => s.name);
  const bottom = H - (showLegend ? 34 : 12);

  if (pie) {
    const vals = (spec.series[0]?.values || []).map((v) => Math.max(0, v || 0));
    const sum = vals.reduce((a, b) => a + b, 0) || 1;
    const cx = W / 2, cy = (top + bottom) / 2, r = Math.min(W / 2 - 30, (bottom - top) / 2 - 6);
    let a0 = -Math.PI / 2;
    vals.forEach((v, i) => {
      const a1 = a0 + (v / sum) * Math.PI * 2;
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, a0, a1); g.closePath();
      g.fillStyle = pal[i % pal.length]; g.fill();
      g.strokeStyle = spec.background || "#fff"; g.lineWidth = 2; g.stroke();
      if (spec.dataLabels !== false && v / sum > 0.04) {
        const am = (a0 + a1) / 2, rr = spec.type === "doughnut" ? r * 0.78 : r * 0.62;
        g.fillStyle = "#fff"; g.font = "bold 12px Calibri, Arial"; g.textAlign = "center";
        g.fillText(`${Math.round((v / sum) * 100)} %`, cx + Math.cos(am) * rr, cy + Math.sin(am) * rr);
      }
      a0 = a1;
    });
    if (spec.type === "doughnut") {
      g.beginPath(); g.arc(cx, cy, r * 0.55, 0, Math.PI * 2); g.fillStyle = spec.background || "#fff"; g.fill();
    }
  } else {
    const all = spec.series.flatMap((s) => s.values.map((v) => v || 0));
    let max: number, min: number;
    if (spec.type === "stacked") {
      const sums = spec.categories.map((_, i) => spec.series.reduce((a, s) => a + Math.max(0, s.values[i] || 0), 0));
      max = Math.max(0, ...sums); min = 0;
    } else { max = Math.max(0, ...all); min = Math.min(0, ...all); }
    if (max === min) max = min + 1;
    const step = niceStep(max - min);
    max = Math.ceil(max / step) * step; min = Math.floor(min / step) * step;
    const horizontal = spec.type === "bar";
    g.font = "12px Calibri, Arial";
    const labelW = Math.max(...(horizontal ? spec.categories : [fmt(max), fmt(min)]).map((s) => g.measureText(String(s)).width)) + 12;
    const L = 12 + Math.min(labelW, W * 0.3), R = W - 18, T = top, B = bottom - 22;
    const val2 = (v: number) => (horizontal ? L + ((v - min) / (max - min)) * (R - L) : B - ((v - min) / (max - min)) * (B - T));
    // quadrillage
    g.strokeStyle = "#D9D9D9"; g.lineWidth = 1; g.fillStyle = txt;
    for (let v = min; v <= max + 1e-9; v += step) {
      const p = val2(v);
      g.beginPath();
      if (horizontal) { g.moveTo(p, T); g.lineTo(p, B); g.textAlign = "center"; g.fillText(fmt(v), p, B + 12); }
      else { g.moveTo(L, p); g.lineTo(R, p); g.textAlign = "right"; g.fillText(fmt(v), L - 6, p); }
      g.stroke();
    }
    const n = spec.categories.length || 1;
    const band = (horizontal ? B - T : R - L) / n;
    const catPos = (i: number) => (horizontal ? T + band * (i + 0.5) : L + band * (i + 0.5));
    g.fillStyle = txt;
    spec.categories.forEach((c, i) => {
      const label = String(c).length > 14 ? `${String(c).slice(0, 13)}…` : String(c);
      if (horizontal) { g.textAlign = "right"; g.fillText(label, L - 6, catPos(i)); }
      else { g.textAlign = "center"; g.fillText(label, catPos(i), B + 12); }
    });
    const zero = val2(Math.max(min, 0));
    if (spec.type === "column" || spec.type === "bar" || spec.type === "stacked") {
      const ns = spec.type === "stacked" ? 1 : spec.series.length || 1;
      const bw = (band * 0.7) / ns;
      const acc = spec.categories.map(() => 0);
      spec.series.forEach((s, si) => {
        g.fillStyle = pal[si % pal.length];
        s.values.forEach((v0, i) => {
          const v = v0 || 0;
          const off = spec.type === "stacked" ? 0 : si * bw;
          const start = catPos(i) - (band * 0.7) / 2 + off;
          const base = spec.type === "stacked" ? val2(acc[i]) : zero;
          const end = spec.type === "stacked" ? val2(acc[i] + Math.max(0, v)) : val2(v);
          if (spec.type === "stacked") acc[i] += Math.max(0, v);
          if (horizontal) g.fillRect(Math.min(base, end), start, Math.abs(end - base), bw - 2);
          else g.fillRect(start, Math.min(base, end), bw - 2, Math.abs(end - base));
          if (spec.dataLabels) {
            g.save(); g.fillStyle = txt; g.font = "11px Calibri, Arial"; g.textAlign = "center";
            if (horizontal) g.fillText(fmt(v), end + 14, start + bw / 2); else g.fillText(fmt(v), start + bw / 2, end - 8);
            g.restore();
          }
        });
      });
    } else if (spec.type === "scatter") {
      spec.series.forEach((s, si) => {
        g.fillStyle = pal[si % pal.length];
        s.values.forEach((v, i) => { g.beginPath(); g.arc(catPos(i), val2(v || 0), 4.5, 0, Math.PI * 2); g.fill(); });
      });
    } else {
      spec.series.forEach((s, si) => {
        const c = pal[si % pal.length];
        g.beginPath();
        s.values.forEach((v, i) => { const x = catPos(i), y = val2(v || 0); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
        if (spec.type === "area") {
          g.lineTo(catPos(s.values.length - 1), zero); g.lineTo(catPos(0), zero); g.closePath();
          g.globalAlpha = 0.35; g.fillStyle = c; g.fill(); g.globalAlpha = 1;
          g.beginPath();
          s.values.forEach((v, i) => { const x = catPos(i), y = val2(v || 0); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
        }
        g.strokeStyle = c; g.lineWidth = 2.5; g.stroke();
        g.fillStyle = c;
        s.values.forEach((v, i) => { g.beginPath(); g.arc(catPos(i), val2(v || 0), 3.5, 0, Math.PI * 2); g.fill(); });
        if (spec.dataLabels) s.values.forEach((v, i) => { g.fillStyle = txt; g.textAlign = "center"; g.fillText(fmt(v || 0), catPos(i), val2(v || 0) - 12); });
      });
    }
    g.strokeStyle = "#8C8C8C"; g.beginPath();
    if (horizontal) { g.moveTo(zero, T); g.lineTo(zero, B); } else { g.moveTo(L, zero); g.lineTo(R, zero); }
    g.stroke();
  }

  if (showLegend && legendItems.length) {
    g.font = "12px Calibri, Arial"; g.textAlign = "left";
    const widths = legendItems.map((t) => g.measureText(String(t)).width + 28);
    let x = Math.max(8, (W - widths.reduce((a, b) => a + b, 0)) / 2);
    const y = H - 16;
    legendItems.forEach((t, i) => {
      g.fillStyle = pal[i % pal.length]; g.fillRect(x, y - 5, 12, 10);
      g.fillStyle = txt; g.fillText(String(t), x + 16, y);
      x += widths[i];
    });
  }
  return cv.toDataURL("image/png");
}

/** Lit un tableau de valeurs (1re ligne = séries, 1re colonne = catégories) */
export function tableToChartData(rows: unknown[][]): { categories: string[]; series: { name: string; values: number[] }[] } {
  const clean = rows.filter((r) => r && r.some((v) => v !== null && v !== undefined && v !== ""));
  if (!clean.length) return { categories: [], series: [] };
  const num = (v: unknown) => (typeof v === "number" ? v : Number(String(v ?? "").replace(",", ".")));
  const firstRowHeader = clean[0].slice(1).some((v) => isNaN(num(v))) || isNaN(num(clean[0][1]));
  const firstColLabels = clean.slice(firstRowHeader ? 1 : 0).some((r) => isNaN(num(r[0])));
  const body = firstRowHeader ? clean.slice(1) : clean;
  const c0 = firstColLabels ? 1 : 0;
  const ncol = Math.max(...clean.map((r) => r.length));
  const series = [] as { name: string; values: number[] }[];
  for (let c = c0; c < ncol; c++) {
    series.push({
      name: firstRowHeader ? String(clean[0][c] ?? `S${c}`) : `Série ${c - c0 + 1}`,
      values: body.map((r) => { const n = num(r[c]); return isNaN(n) ? 0 : n; }),
    });
  }
  return { categories: body.map((r, i) => (firstColLabels ? String(r[0] ?? "") : String(i + 1))), series };
}

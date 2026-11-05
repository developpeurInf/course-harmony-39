/**
 * Tableaux de signes et de variations : modèle de données et dessin en SVG.
 *
 * Les colonnes alternent « valeur » (indices pairs : x₀, x₁…) et « intervalle »
 * (indices impairs). Une ligne de signes contient « + », « - » ou rien dans les
 * intervalles, et « 0 », « || » ou rien sous les valeurs. Une ligne de variations
 * contient une valeur (en haut / en bas selon les flèches) sous chaque x,
 * « a||b » pour une valeur interdite (limite à gauche || limite à droite), et
 * une flèche (« up », « down », « flat ») dans chaque intervalle.
 */

export type RowType = "sign" | "var";
export interface VtRow { label: string; type: RowType; cells: string[] }
export interface VtData { xLabel: string; xs: string[]; rows: VtRow[] }

export const colCount = (d: VtData) => Math.max(1, d.xs.length * 2 - 1);

export function emptyRow(type: RowType, n: number, label = ""): VtRow {
  return { label, type, cells: Array.from({ length: Math.max(1, n * 2 - 1) }, () => "") };
}

/** Redimensionne les lignes quand le nombre de valeurs de x change */
export function resize(d: VtData, n: number): VtData {
  const xs = Array.from({ length: n }, (_, i) => d.xs[i] ?? "");
  const cols = n * 2 - 1;
  return { ...d, xs, rows: d.rows.map((r) => ({ ...r, cells: Array.from({ length: cols }, (_, i) => r.cells[i] ?? "") })) };
}

/** Écriture mathématique lisible : -inf → −∞, sqrt(2) → √2, x^2 → x²… */
export function pretty(s: string): string {
  const sup: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻", n: "ⁿ" };
  return s
    .replace(/\\infty|infini|\binf\b/gi, "∞")
    .replace(/\\sqrt\{([^}]*)\}|sqrt\(([^)]*)\)/g, (_, a, b) => `√${a ?? b}`)
    .replace(/\\pi|\bpi\b/g, "π")
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "$1/$2")
    .replace(/\^\{?([0-9n-]+)\}?/g, (_, e: string) => e.split("").map((c) => sup[c] ?? c).join(""))
    .replace(/\\ln/g, "ln")
    .replace(/-/g, "−");
}

/** Signes d'une ligne → flèches (+ ↗, − ↘) pour une ligne de variations */
export function arrowsFromSigns(sign: VtRow, target: VtRow): VtRow {
  return {
    ...target,
    cells: target.cells.map((c, i) => (i % 2 === 1 ? (sign.cells[i] === "+" ? "up" : sign.cells[i] === "-" ? "down" : c) : c)),
  };
}

/** Ligne de signes d'un produit / quotient à partir des lignes au-dessus */
export function productSigns(rows: VtRow[], n: number): string[] {
  const cols = n * 2 - 1;
  return Array.from({ length: cols }, (_, i) => {
    const signs = rows.filter((r) => r.type === "sign").map((r) => r.cells[i] || "");
    if (i % 2 === 1) {
      if (signs.some((s) => s !== "+" && s !== "-")) return "";
      return signs.filter((s) => s === "-").length % 2 ? "-" : "+";
    }
    if (signs.includes("||")) return "||";
    if (signs.includes("0")) return "0";
    return "";
  });
}

export const PRESETS: { id: string; label: string; data: () => VtData }[] = [
  {
    id: "affine",
    label: "Signe de ax + b",
    data: () => ({ xLabel: "x", xs: ["-inf", "-b/a", "+inf"], rows: [{ label: "ax+b", type: "sign", cells: ["", "-", "0", "+", ""] }] }),
  },
  {
    id: "trinome",
    label: "Signe d'un trinôme (Δ > 0)",
    data: () => ({ xLabel: "x", xs: ["-inf", "x₁", "x₂", "+inf"], rows: [{ label: "P(x)", type: "sign", cells: ["", "+", "0", "-", "0", "+", ""] }] }),
  },
  {
    id: "quotient",
    label: "Signe d'un quotient",
    data: () => ({
      xLabel: "x", xs: ["-inf", "-1", "2", "+inf"],
      rows: [
        { label: "x+1", type: "sign", cells: ["", "-", "0", "+", "", "+", ""] },
        { label: "x-2", type: "sign", cells: ["", "-", "", "-", "0", "+", ""] },
        { label: "(x+1)/(x-2)", type: "sign", cells: ["", "+", "0", "-", "||", "+", ""] },
      ],
    }),
  },
  {
    id: "parabole",
    label: "Variations : second degré (a > 0)",
    data: () => ({
      xLabel: "x", xs: ["-inf", "α", "+inf"],
      rows: [
        { label: "f'(x)", type: "sign", cells: ["", "-", "0", "+", ""] },
        { label: "f(x)", type: "var", cells: ["+inf", "down", "β", "up", "+inf"] },
      ],
    }),
  },
  {
    id: "cubique",
    label: "Variations : deux extremums",
    data: () => ({
      xLabel: "x", xs: ["-inf", "-1", "1", "+inf"],
      rows: [
        { label: "f'(x)", type: "sign", cells: ["", "+", "0", "-", "0", "+", ""] },
        { label: "f(x)", type: "var", cells: ["-inf", "up", "4", "down", "0", "up", "+inf"] },
      ],
    }),
  },
  {
    id: "interdite",
    label: "Variations : valeur interdite",
    data: () => ({
      xLabel: "x", xs: ["-inf", "1", "+inf"],
      rows: [
        { label: "f'(x)", type: "sign", cells: ["", "-", "||", "-", ""] },
        { label: "f(x)", type: "var", cells: ["2", "down", "-inf||+inf", "down", "2"] },
      ],
    }),
  },
];

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

/** Largeur approximative d'un texte (pour dimensionner les colonnes) */
const textW = (s: string, size: number) => [...s].length * size * 0.56;

export function renderVarTable(d: VtData, opts: { color?: string } = {}): { svg: string; width: number; height: number } {
  const stroke = opts.color || "#1f1f1f";
  const fs = 15;
  const n = Math.max(1, d.xs.length);
  const cols = n * 2 - 1;
  const labels = [d.xLabel, ...d.rows.map((r) => r.label)].map(pretty);
  const labelW = Math.max(56, Math.max(...labels.map((l) => textW(l, fs))) + 22);
  // largeur d'une demi-colonne selon le texte le plus long
  let longest = 0;
  d.xs.forEach((x) => (longest = Math.max(longest, textW(pretty(x), fs))));
  d.rows.forEach((r) => r.cells.forEach((c, i) => { if (i % 2 === 0 && r.type === "var") c.split("||").forEach((p) => (longest = Math.max(longest, textW(pretty(p), fs)))); }));
  const half = Math.max(34, longest / 2 + 14);
  const step = half * 2; // distance entre deux valeurs de x
  const pad = Math.max(20, longest / 2 + 10);
  const tableW = labelW + pad * 2 + step * (n - 1);
  const xAt = (i: number) => labelW + pad + (i / 2) * step; // i = indice de colonne
  const rowH = (r: VtRow) => (r.type === "var" ? 78 : 34);
  const xRowH = 34;
  const height = xRowH + d.rows.reduce((s, r) => s + rowH(r), 0);
  const parts: string[] = [];
  const text = (x: number, y: number, s: string, anchor = "middle", extra = "") =>
    parts.push(`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" ${extra}>${esc(pretty(s))}</text>`);
  const line = (x1: number, y1: number, x2: number, y2: number, extra = "") =>
    parts.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" ${extra}/>`);

  // cadre et séparations
  parts.push(`<rect x="0.75" y="0.75" width="${(tableW - 1.5).toFixed(1)}" height="${(height - 1.5).toFixed(1)}" fill="none"/>`);
  line(labelW, 0, labelW, height);
  // ligne des x
  text(labelW / 2, xRowH / 2 + 5, d.xLabel, "middle", 'font-style="italic"');
  d.xs.forEach((x, k) => text(xAt(k * 2), xRowH / 2 + 5, x));
  let y = xRowH;
  for (const r of d.rows) {
    const h = rowH(r);
    line(0, y, tableW, y);
    text(labelW / 2, y + h / 2 + 5, r.label, "middle", 'font-style="italic"');
    if (r.type === "sign") {
      r.cells.forEach((c, i) => {
        const cx = i % 2 === 0 ? xAt(i) : (xAt(i - 1) + xAt(i + 1)) / 2;
        if (i % 2 === 1) { if (c) text(cx, y + h / 2 + 6, c === "-" ? "−" : c, "middle", 'font-size="18"'); return; }
        if (c === "0") {
          line(cx, y, cx, y + h, 'stroke-dasharray="3 3" stroke-width="0.8"');
          parts.push(`<rect x="${(cx - 7).toFixed(1)}" y="${(y + h / 2 - 9).toFixed(1)}" width="14" height="17" fill="#fff" stroke="none"/>`);
          text(cx, y + h / 2 + 5, "0");
        } else if (c === "||") {
          line(cx - 2, y, cx - 2, y + h); line(cx + 2, y, cx + 2, y + h);
        } else if (i > 0 && i < cols - 1) {
          line(cx, y, cx, y + h, 'stroke-dasharray="3 3" stroke-width="0.6" opacity="0.5"');
        }
      });
    } else {
      // position (haut / bas / milieu) de chaque extrémité de flèche
      const top = y + 18, bottom = y + h - 9, mid = y + h / 2 + 5;
      const arrow = (i: number) => (i >= 1 && i < cols ? r.cells[i] : "");
      const posAt = (i: number, side: "L" | "R") => {
        const a = side === "L" ? arrow(i - 1) : arrow(i + 1);
        if (side === "L") return a === "up" ? top : a === "down" ? bottom : a === "flat" ? mid : null;
        return a === "up" ? bottom : a === "down" ? top : a === "flat" ? mid : null;
      };
      const ends: { x: number; y: number }[][] = [];
      for (let i = 0; i < cols; i += 2) {
        const c = r.cells[i] || "";
        const cx = xAt(i);
        if (c.includes("||")) {
          const [lv, rv] = c.split("||");
          line(cx - 2, y, cx - 2, y + h); line(cx + 2, y, cx + 2, y + h);
          const ly = posAt(i, "L") ?? mid, ry = posAt(i, "R") ?? mid;
          if (lv) text(cx - 6, ly, lv, "end");
          if (rv) text(cx + 6, ry, rv, "start");
          ends[i] = [{ x: cx - 6 - (lv ? textW(pretty(lv), fs) : 0) / 2, y: ly }, { x: cx + 6 + (rv ? textW(pretty(rv), fs) : 0) / 2, y: ry }];
        } else {
          const vy = posAt(i, "L") ?? posAt(i, "R") ?? mid;
          if (c) text(cx, vy, c);
          ends[i] = [{ x: cx, y: vy }, { x: cx, y: vy }];
        }
      }
      for (let i = 1; i < cols; i += 2) {
        const a = r.cells[i];
        if (a !== "up" && a !== "down" && a !== "flat") continue;
        const from = ends[i - 1][1], to = ends[i + 1][0];
        const dx = to.x - from.x;
        const gx = Math.min(22, Math.abs(dx) * 0.22);
        const x1 = from.x + gx, x2 = to.x - gx;
        const y1 = a === "up" ? bottom - 4 : a === "down" ? top + 4 : mid - 5;
        const y2 = a === "up" ? top + 4 : a === "down" ? bottom - 4 : mid - 5;
        line(x1, y1, x2, y2, 'marker-end="url(#vtArrow)"');
      }
    }
    y += h;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(tableW)}" height="${Math.ceil(height)}" viewBox="0 0 ${Math.ceil(tableW)} ${Math.ceil(height)}" font-family="Cambria Math, Cambria, 'Times New Roman', serif" font-size="${fs}" fill="${stroke}" stroke="${stroke}" stroke-width="1.2"><defs><marker id="vtArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${stroke}" stroke="none"/></marker></defs><rect width="100%" height="100%" fill="#fff" stroke="none"/><g>${parts.join("").replace(/<text /g, '<text stroke="none" ')}</g></svg>`;
  return { svg, width: Math.ceil(tableW), height: Math.ceil(height) };
}

export function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

export function parseVt(json: string | null | undefined): VtData | null {
  if (!json) return null;
  try {
    const d = JSON.parse(json) as VtData;
    if (!Array.isArray(d.xs) || !Array.isArray(d.rows)) return null;
    return d;
  } catch {
    return null;
  }
}

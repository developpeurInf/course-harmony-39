import React from "react";
import { DiagnosticClass, parseNoteValue } from "@/lib/diagnosticStatsEngine";
import type { DiagLang } from "@/lib/diagnosticTranslations";

/**
 * Bibliothèque de graphiques pour les rapports officiels (A4, impression, PDF).
 * — 100 % SVG (pas de bibliothèque externe) : rendu identique à l'écran, à l'impression
 *   et dans le PDF (l'export convertit chaque <svg> en image haute résolution).
 * — Deux palettes : « couleurs » (celles des tableaux officiels) et « noir & blanc »
 *   (photocopieuse / imprimante monochrome).
 */

/* ═════════════════════════ Types & catalogue ═════════════════════════ */

export type ClassChartType =
  | "bars" | "hbars" | "pie" | "donut" | "stacked"
  | "histogram" | "gauge" | "pictogram" | "boxplot" | "ogive";

export type GlobalChartType =
  | "grouped" | "stacked100" | "success" | "means"
  | "boxplots" | "heatmap" | "pieAll" | "histAll";

export type ChartPalette = "color" | "mono";

type L3 = { ar: string; fr: string; en: string };
const pick = (t: L3, lang: DiagLang) => t[lang] || t.fr;

export const CLASS_CHARTS: { id: ClassChartType; label: L3; desc: L3 }[] = [
  { id: "bars", label: { fr: "Colonnes", ar: "أعمدة", en: "Columns" }, desc: { fr: "Effectif par tranche de notes", ar: "العدد حسب الفئة", en: "Count per score band" } },
  { id: "hbars", label: { fr: "Barres horizontales", ar: "أشرطة أفقية", en: "Horizontal bars" }, desc: { fr: "Pourcentage par tranche", ar: "النسبة حسب الفئة", en: "Percentage per band" } },
  { id: "pie", label: { fr: "Secteurs", ar: "دائرة نسبية", en: "Pie" }, desc: { fr: "Part de chaque tranche", ar: "حصة كل فئة", en: "Share of each band" } },
  { id: "donut", label: { fr: "Anneau", ar: "حلقة", en: "Donut" }, desc: { fr: "Tranches + taux de réussite au centre", ar: "الفئات ونسبة النجاح في الوسط", en: "Bands + pass rate in the centre" } },
  { id: "stacked", label: { fr: "Barre 100 %", ar: "شريط 100%", en: "100% bar" }, desc: { fr: "Une barre, 4 tranches empilées", ar: "شريط واحد بأربع فئات", en: "One bar, 4 stacked bands" } },
  { id: "histogram", label: { fr: "Histogramme", ar: "مدرج تكراري", en: "Histogram" }, desc: { fr: "Distribution des notes de 0 à 20", ar: "توزيع النقط من 0 إلى 20", en: "Score distribution 0–20" } },
  { id: "gauge", label: { fr: "Jauge", ar: "عداد", en: "Gauge" }, desc: { fr: "Taux d'élèves ayant ≥ 10/20", ar: "نسبة الحاصلين على 10 فما فوق", en: "Share of students ≥ 10/20" } },
  { id: "pictogram", label: { fr: "Pictogramme", ar: "رسم بالرموز", en: "Pictogram" }, desc: { fr: "1 symbole = 1 élève", ar: "رمز واحد = تلميذ واحد", en: "1 symbol = 1 student" } },
  { id: "boxplot", label: { fr: "Boîte à moustaches", ar: "مخطط الصندوق", en: "Box plot" }, desc: { fr: "Min, quartiles, médiane, max, moyenne", ar: "الأدنى، الربيعيات، الوسيط، الأقصى، المعدل", en: "Min, quartiles, median, max, mean" } },
  { id: "ogive", label: { fr: "Courbe cumulée", ar: "منحنى تراكمي", en: "Cumulative curve" }, desc: { fr: "% d'élèves ayant moins de x/20", ar: "نسبة التلاميذ الحاصلين على أقل من x", en: "% of students scoring below x" } },
];

export const GLOBAL_CHARTS: { id: GlobalChartType; label: L3; desc: L3 }[] = [
  { id: "grouped", label: { fr: "Colonnes groupées", ar: "أعمدة مجمعة", en: "Grouped columns" }, desc: { fr: "Les 4 tranches pour chaque classe", ar: "الفئات الأربع لكل قسم", en: "The 4 bands for each class" } },
  { id: "stacked100", label: { fr: "Barres 100 % par classe", ar: "أشرطة 100% لكل قسم", en: "100% bars per class" } , desc: { fr: "Comparer la répartition des classes", ar: "مقارنة توزيع الأقسام", en: "Compare class distributions" } },
  { id: "success", label: { fr: "Taux de réussite", ar: "نسبة النجاح", en: "Pass rate" }, desc: { fr: "% ≥ 10/20, classes triées", ar: "نسبة ≥ 10، مرتبة", en: "% ≥ 10/20, sorted" } },
  { id: "means", label: { fr: "Moyennes", ar: "المعدلات", en: "Averages" }, desc: { fr: "Moyenne par classe + moyenne générale", ar: "معدل كل قسم والمعدل العام", en: "Average per class + overall" } },
  { id: "boxplots", label: { fr: "Boîtes à moustaches", ar: "مخططات الصندوق", en: "Box plots" }, desc: { fr: "Dispersion des notes par classe", ar: "تشتت النقط حسب القسم", en: "Score spread per class" } },
  { id: "heatmap", label: { fr: "Carte de chaleur", ar: "خريطة حرارية", en: "Heat map" }, desc: { fr: "Classes × tranches, en %", ar: "الأقسام × الفئات بالنسبة", en: "Classes × bands, in %" } },
  { id: "pieAll", label: { fr: "Anneau global", ar: "حلقة شاملة", en: "Overall donut" }, desc: { fr: "Tous les élèves réunis", ar: "جميع التلاميذ", en: "All students together" } },
  { id: "histAll", label: { fr: "Histogramme global", ar: "مدرج تكراري شامل", en: "Overall histogram" }, desc: { fr: "Toutes les notes de 0 à 20", ar: "جميع النقط من 0 إلى 20", en: "All scores 0–20" } },
];

/* ═════════════════════════ Tranches (selon le modèle de rapport) ═════════════════════════ */

export interface BandScheme {
  id: "t1" | "t2";
  classify: (v: number) => number; // 0..3
  short: string[];
  long: Record<DiagLang, string[]>;
  colors: string[];
}

/** Modèle 2 : < 5, [5;10[, [10;15[, [15;20] — couleurs des tableaux officiels */
export const SCHEME_T2: BandScheme = {
  id: "t2",
  classify: v => (v < 5 ? 0 : v < 10 ? 1 : v < 15 ? 2 : 3),
  short: ["< 5", "5 – 10", "10 – 15", "15 – 20"],
  long: {
    fr: ["Moins de 5", "De 5 à 10", "De 10 à 15", "De 15 à 20"],
    ar: ["أقل من 5", "من 5 إلى 10", "من 10 إلى 15", "من 15 إلى 20"],
    en: ["Below 5", "5 to 10", "10 to 15", "15 to 20"],
  },
  colors: ["#f79646", "#ffc000", "#92d050", "#4f81bd"],
};

/** Modèle 1 : [0;8], ]8;12], ]12;14], ]14;20] — en difficulté … excellence */
export const SCHEME_T1: BandScheme = {
  id: "t1",
  classify: v => (v <= 8 ? 0 : v <= 12 ? 1 : v <= 14 ? 2 : 3),
  short: ["0 – 8", "8 – 12", "12 – 14", "14 – 20"],
  long: {
    fr: ["En difficulté", "En progression", "Maîtrise satisf.", "Excellence"],
    ar: ["المتعثرون", "المسايرون", "المتفوقون", "المتميزون"],
    en: ["Struggling", "Progressing", "Proficient", "Exemplary"],
  },
  colors: ["#dc2626", "#d97706", "#2563eb", "#059669"],
};

/* ═════════════════════════ Données ═════════════════════════ */

export interface ClassChartData {
  nom: string;
  total: number;
  present: number;
  notes: number[];
  bands: [number, number, number, number];
  mean: number | null;
  median: number | null;
  sd: number | null;
  min: number | null;
  max: number | null;
  q1: number | null;
  q3: number | null;
  success: number; // nombre ≥ 10
  scheme: BandScheme;
}

const quantile = (sorted: number[], q: number) => {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};

export function computeClassChartData(cls: DiagnosticClass, scheme: BandScheme = SCHEME_T2): ClassChartData {
  const notes: number[] = [];
  for (const s of cls.students || []) {
    const v = parseNoteValue(s.note);
    if (v !== null) notes.push(v);
  }
  return dataFromNotes(cls.nom, (cls.students || []).length, notes, scheme);
}

export function dataFromNotes(nom: string, total: number, notes: number[], scheme: BandScheme = SCHEME_T2): ClassChartData {
  const sorted = [...notes].sort((a, b) => a - b);
  const bands: [number, number, number, number] = [0, 0, 0, 0];
  notes.forEach(v => { bands[scheme.classify(v) as 0 | 1 | 2 | 3]++; });
  const n = notes.length;
  const mean = n ? notes.reduce((a, b) => a + b, 0) / n : null;
  const sd = n && mean !== null ? Math.sqrt(notes.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n) : null;
  return {
    nom, total, present: n, notes: sorted, bands, mean, sd,
    median: quantile(sorted, 0.5), q1: quantile(sorted, 0.25), q3: quantile(sorted, 0.75),
    min: n ? sorted[0] : null, max: n ? sorted[n - 1] : null,
    success: notes.filter(v => v >= 10).length,
    scheme,
  };
}

export function mergeChartData(nom: string, items: ClassChartData[]): ClassChartData {
  return dataFromNotes(nom, items.reduce((s, d) => s + d.total, 0), items.reduce<number[]>((a, d) => a.concat(d.notes), []), items[0]?.scheme || SCHEME_T2);
}

/* ═════════════════════════ Style ═════════════════════════ */

const MONO = ["#1f1f1f", "#6b6b6b", "#a6a6a6", "#dcdcdc"];
const ACCENT = { color: "#2f5597", mono: "#333333" };
const FONT = "'Times New Roman', 'Amiri', serif";

const bandColors = (p: ChartPalette, scheme: BandScheme = SCHEME_T2) => (p === "mono" ? MONO : scheme.colors);
const textOn = (fill: string) => {
  const m = /^#(..)(..)(..)$/.exec(fill);
  if (!m) return "#000";
  const [r, g, b] = [m[1], m[2], m[3]].map(h => parseInt(h, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b < 140 ? "#fff" : "#000";
};

export const BAND_SHORT = SCHEME_T2.short;
const W = {
  students: { fr: "élèves", ar: "تلميذ", en: "students" },
  mean: { fr: "Moyenne", ar: "المعدل", en: "Average" },
  median: { fr: "Médiane", ar: "الوسيط", en: "Median" },
  pass: { fr: "≥ 10/20", ar: "≥ 10/20", en: "≥ 10/20" },
  passRate: { fr: "Taux ≥ 10/20", ar: "نسبة ≥ 10/20", en: "Rate ≥ 10/20" },
  overall: { fr: "Moyenne générale", ar: "المعدل العام", en: "Overall average" },
  noData: { fr: "Aucune note saisie", ar: "لا توجد نقط مسجلة", en: "No grades entered" },
  score: { fr: "Note /20", ar: "النقطة /20", en: "Score /20" },
  count: { fr: "Effectif", ar: "العدد", en: "Count" },
  all: { fr: "Toutes les classes", ar: "جميع الأقسام", en: "All classes" },
} as const;

const fmt = (v: number | null, lang: DiagLang, d = 1) => (v === null ? "—" : lang === "en" ? v.toFixed(d) : v.toFixed(d).replace(".", ","));
const pct = (n: number, total: number) => (total ? (n / total) * 100 : 0);
const fmtPct = (v: number, lang: DiagLang) => `${fmt(v, lang, 0)}%`;

/* Petit conteneur SVG commun */
const Svg: React.FC<{ w: number; h: number; mini?: boolean; children: React.ReactNode }> = ({ w, h, mini, children }) => (
  <svg
    viewBox={`0 0 ${w} ${h}`}
    width="100%"
    height={mini ? "100%" : undefined}
    preserveAspectRatio="xMidYMid meet"
    style={{ display: "block", fontFamily: FONT, overflow: "visible" }}
    xmlns="http://www.w3.org/2000/svg"
    direction="ltr"
  >
    {children}
  </svg>
);

const arc = (cx: number, cy: number, r: number, a0: number, a1: number, inner = 0) => {
  const p = (r0: number, a: number) => [cx + r0 * Math.sin(a), cy - r0 * Math.cos(a)];
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = p(r, a0);
  const [x1, y1] = p(r, a1);
  if (inner <= 0) return `M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} Z`;
  const [ix1, iy1] = p(inner, a1);
  const [ix0, iy0] = p(inner, a0);
  return `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} L${ix1},${iy1} A${inner},${inner} 0 ${large} 0 ${ix0},${iy0} Z`;
};

/* Texte arabe dans un SVG : direction RTL explicite pour un ordre correct des nombres.
   Attention : en RTL, text-anchor="start" aligne le texte à DROITE de x. */
const rtlProps = (lang: DiagLang) => (lang === "ar" ? ({ direction: "rtl", unicodeBidi: "embed" } as any) : {});

/* Légende des 4 tranches (colonne de droite) */
const BandLegend: React.FC<{ d: ClassChartData; x: number; y: number; lang: DiagLang; palette: ChartPalette; showPct?: boolean }> = ({ d, x, y, lang, palette, showPct = true }) => {
  const c = bandColors(palette, d.scheme);
  const ar = lang === "ar";
  const statText = `${pick(W.mean, lang)} : ${fmt(d.mean, lang, 2)}  ·  ${pick(W.passRate, lang)} : ${fmtPct(pct(d.success, d.present), lang)}`;
  return (
    <g>
      {(d.scheme.long[lang] || d.scheme.long.fr).map((label, i) => (
        <g key={i} transform={`translate(${x},${y + i * 24})`}>
          <rect x={ar ? 186 : 0} width={14} height={14} y={-11} fill={c[i]} stroke="#000" strokeWidth={0.6} />
          <text x={ar ? 180 : 20} fontSize={12.5} textAnchor="start" {...rtlProps(lang)}>{label}</text>
          <text x={ar ? 0 : 200} fontSize={12.5} textAnchor={ar ? "start" : "end"} fontWeight="bold" direction="ltr">
            {d.bands[i]}{showPct ? ` · ${fmtPct(pct(d.bands[i], d.present), lang)}` : ""}
          </text>
        </g>
      ))}
      <text x={ar ? x + 200 : x} y={y + 4 * 24 + 2} fontSize={11.5} fill="#222" fontWeight="bold" textAnchor="start" {...rtlProps(lang)}>
        {statText}
      </text>
    </g>
  );
};

const Empty: React.FC<{ lang: DiagLang; h?: number }> = ({ lang, h = 120 }) => (
  <Svg w={640} h={h}>
    <rect x={0.5} y={0.5} width={639} height={h - 1} fill="none" stroke="#999" strokeDasharray="4 3" />
    <text x={320} y={h / 2 + 4} textAnchor="middle" fontSize={13} fill="#555" fontStyle="italic">{pick(W.noData, lang)}</text>
  </Svg>
);

/* ═════════════════════════ Graphiques par classe ═════════════════════════ */

export interface ClassChartProps {
  type: ClassChartType;
  data: ClassChartData;
  lang: DiagLang;
  palette?: ChartPalette;
  /** vignette du sélecteur : sans texte */
  mini?: boolean;
}

export const ClassChart: React.FC<ClassChartProps> = ({ type, data: d, lang, palette = "color", mini = false }) => {
  const c = bandColors(palette, d.scheme);
  const short = d.scheme.short;
  const accent = ACCENT[palette];
  if (!d.present && !mini) return <Empty lang={lang} />;
  const H = 175;
  const legendX = 420;

  switch (type) {
    case "bars": {
      const max = Math.max(1, ...d.bands);
      const x0 = 40, w = 360, bw = 56, base = 145, top = 18;
      return (
        <Svg w={mini ? 410 : 640} h={H} mini={mini}>
          {[0, 0.5, 1].map(f => (
            <g key={f}>
              <line x1={x0} x2={x0 + w} y1={base - (base - top) * f} y2={base - (base - top) * f} stroke="#ccc" strokeWidth={0.6} />
              {!mini && <text x={x0 - 6} y={base - (base - top) * f + 4} fontSize={10.5} textAnchor="end">{Math.round(max * f)}</text>}
            </g>
          ))}
          {d.bands.map((n, i) => {
            const h = ((base - top) * n) / max;
            const x = x0 + 20 + i * (bw + 30);
            return (
              <g key={i}>
                <rect x={x} y={base - h} width={bw} height={h} fill={c[i]} stroke="#000" strokeWidth={0.7} />
                {!mini && <text x={x + bw / 2} y={base - h - 4} fontSize={12} textAnchor="middle" fontWeight="bold">{n}</text>}
                {!mini && <text x={x + bw / 2} y={base + 15} fontSize={11} textAnchor="middle">{short[i]}</text>}
              </g>
            );
          })}
          <line x1={x0} x2={x0 + w} y1={base} y2={base} stroke="#000" />
          {!mini && <BandLegend d={d} x={legendX + 10} y={40} lang={lang} palette={palette} />}
        </Svg>
      );
    }
    case "hbars": {
      const x0 = 70, w = 300;
      return (
        <Svg w={mini ? 410 : 640} h={H} mini={mini}>
          {d.bands.map((n, i) => {
            const p = pct(n, d.present);
            const y = 18 + i * 36;
            return (
              <g key={i}>
                {!mini && <text x={x0 - 8} y={y + 17} fontSize={11.5} textAnchor="end">{short[i]}</text>}
                <rect x={x0} y={y} width={w} height={24} fill="#f2f2f2" stroke="#bbb" strokeWidth={0.5} />
                <rect x={x0} y={y} width={(w * p) / 100} height={24} fill={c[i]} stroke="#000" strokeWidth={0.7} />
                {!mini && <text x={x0 + (w * p) / 100 + 6} y={y + 17} fontSize={12} fontWeight="bold">{fmtPct(p, lang)}</text>}
              </g>
            );
          })}
          {!mini && <BandLegend d={d} x={legendX + 10} y={40} lang={lang} palette={palette} />}
        </Svg>
      );
    }
    case "pie":
    case "donut": {
      const cx = 170, cy = 87, r = 78, inner = type === "donut" ? 46 : 0;
      let a = 0;
      return (
        <Svg w={mini ? 410 : 640} h={H} mini={mini}>
          {d.bands.map((n, i) => {
            if (!n) return null;
            const frac = n / Math.max(1, d.present);
            const a0 = a, a1 = a + frac * 2 * Math.PI;
            a = a1;
            const full = frac >= 0.9999;
            const mid = (a0 + a1) / 2;
            const lr = inner ? (r + inner) / 2 : r * 0.62;
            return (
              <g key={i}>
                {full
                  ? <circle cx={cx} cy={cy} r={r} fill={c[i]} stroke="#000" strokeWidth={0.7} />
                  : <path d={arc(cx, cy, r, a0, a1, inner)} fill={c[i]} stroke="#000" strokeWidth={0.7} />}
                {!mini && frac >= 0.06 && (
                  <text x={cx + lr * Math.sin(mid)} y={cy - lr * Math.cos(mid) + 4} fontSize={11.5} textAnchor="middle" fontWeight="bold" fill={textOn(c[i])}>
                    {fmtPct(frac * 100, lang)}
                  </text>
                )}
              </g>
            );
          })}
          {inner > 0 && <circle cx={cx} cy={cy} r={inner} fill="#fff" stroke="#000" strokeWidth={0.7} />}
          {inner > 0 && !mini && (
            <g>
              <text x={cx} y={cy + 2} fontSize={20} textAnchor="middle" fontWeight="bold" fill={accent}>{fmtPct(pct(d.success, d.present), lang)}</text>
              <text x={cx} y={cy + 18} fontSize={10.5} textAnchor="middle">{pick(W.pass, lang)}</text>
            </g>
          )}
          {!mini && <BandLegend d={d} x={legendX + 10} y={40} lang={lang} palette={palette} />}
        </Svg>
      );
    }
    case "stacked": {
      const x0 = 20, w = 600, y = 40, h = 46;
      let x = x0;
      return (
        <Svg w={640} h={mini ? 120 : 150} mini={mini}>
          {d.bands.map((n, i) => {
            const bw = (w * n) / Math.max(1, d.present);
            const g = (
              <g key={i}>
                <rect x={x} y={y} width={bw} height={h} fill={c[i]} stroke="#000" strokeWidth={0.7} />
                {!mini && bw > 34 && <text x={x + bw / 2} y={y + h / 2 + 5} fontSize={13} textAnchor="middle" fontWeight="bold" fill={textOn(c[i])}>{fmtPct(pct(n, d.present), lang)}</text>}
              </g>
            );
            x += bw;
            return g;
          })}
          {/* repère 10/20 : moitié gauche = < 10, moitié droite = ≥ 10 */}
          {!mini && (
            <g>
              <text x={x0} y={y - 10} fontSize={11.5}>&lt; 10 : <tspan fontWeight="bold">{fmtPct(pct(d.bands[0] + d.bands[1], d.present), lang)}</tspan></text>
              <text x={x0 + w} y={y - 10} fontSize={11.5} textAnchor="end">≥ 10 : <tspan fontWeight="bold">{fmtPct(pct(d.success, d.present), lang)}</tspan></text>
              <LegendRow y={y + h + 26} lang={lang} palette={palette} counts={d.bands} x0={x0} step={152} scheme={d.scheme} />
              <text x={lang === "ar" ? x0 + w : x0} y={y + h + 50} fontSize={11.5} fill="#222" fontWeight="bold" textAnchor="start" {...rtlProps(lang)}>{`${pick(W.mean, lang)} : ${fmt(d.mean, lang, 2)}  ·  ${pick(W.median, lang)} : ${fmt(d.median, lang, 2)}`}</text>
            </g>
          )}
        </Svg>
      );
    }
    case "histogram":
      return <Histogram notes={d.notes} lang={lang} palette={palette} mini={mini} legend={!mini ? d : null} scheme={d.scheme} />;
    case "gauge": {
      const cx = 170, cy = 140, r = 110, inner = 72;
      const p = pct(d.success, d.present) / 100;
      const start = -Math.PI / 2, end = Math.PI / 2;
      const a = start + (end - start) * p;
      const p0 = [cx + (inner - 6) * Math.sin(a), cy - (inner - 6) * Math.cos(a)];
      const p1 = [cx + (r + 8) * Math.sin(a), cy - (r + 8) * Math.cos(a)];
      return (
        <Svg w={mini ? 410 : 640} h={H} mini={mini}>
          <path d={arc(cx, cy, r, start, end, inner)} fill="#eee" stroke="#000" strokeWidth={0.7} />
          {p > 0 && <path d={arc(cx, cy, r, start, a, inner)} fill={palette === "mono" ? "#555" : p >= 0.5 ? "#92d050" : "#f79646"} stroke="#000" strokeWidth={0.7} />}
          <line x1={p0[0]} y1={p0[1]} x2={p1[0]} y2={p1[1]} stroke="#000" strokeWidth={2.5} />
          {!mini && (
            <g>
              <text x={cx - r} y={cy + 16} fontSize={11} textAnchor="middle">0%</text>
              <text x={cx + r} y={cy + 16} fontSize={11} textAnchor="middle">100%</text>
              <text x={cx} y={cy - 18} fontSize={24} textAnchor="middle" fontWeight="bold" fill={accent}>{fmtPct(p * 100, lang)}</text>
              <text x={cx} y={cy} fontSize={11} textAnchor="middle" {...rtlProps(lang)}>{pick(W.passRate, lang)}</text>
              <BandLegend d={d} x={legendX + 10} y={40} lang={lang} palette={palette} />
            </g>
          )}
        </Svg>
      );
    }
    case "pictogram": {
      const n = d.present || (mini ? 24 : 0);
      const perRow = n > 40 ? 16 : 12;
      const size = n > 40 ? 18 : 22;
      const order: number[] = [];
      d.bands.forEach((k, i) => { for (let j = 0; j < k; j++) order.push(i); });
      if (mini && !order.length) [6, 8, 7, 3].forEach((k, i) => { for (let j = 0; j < k; j++) order.push(i); });
      return (
        <Svg w={mini ? 410 : 640} h={H} mini={mini}>
          {order.map((band, idx) => {
            const col = idx % perRow, row = Math.floor(idx / perRow);
            const x = 20 + col * (size + 6), y = 14 + row * (size + 8);
            return (
              <g key={idx} transform={`translate(${x},${y})`}>
                <circle cx={size / 2} cy={size * 0.28} r={size * 0.22} fill={c[band]} stroke="#000" strokeWidth={0.6} />
                <path d={`M${size * 0.12},${size} Q${size * 0.12},${size * 0.52} ${size / 2},${size * 0.52} Q${size * 0.88},${size * 0.52} ${size * 0.88},${size} Z`} fill={c[band]} stroke="#000" strokeWidth={0.6} />
              </g>
            );
          })}
          {!mini && <BandLegend d={d} x={legendX + 10} y={40} lang={lang} palette={palette} />}
        </Svg>
      );
    }
    case "boxplot":
      return (
        <Svg w={640} h={mini ? 120 : 150} mini={mini}>
          <ScaleAxis x0={30} w={580} y={110} mini={mini} />
          <BoxGlyph d={mini && !d.present ? SAMPLE : d} x0={30} w={580} y={45} h={44} fill={palette === "mono" ? "#cfcfcf" : "#bdd7ee"} accent={accent} />
          {!mini && (
            <text x={lang === "ar" ? 610 : 30} y={140} fontSize={11.5} fill="#222" textAnchor="start" {...rtlProps(lang)}>
              {`Min ${fmt(d.min, lang)} · Q1 ${fmt(d.q1, lang)} · ${pick(W.median, lang)} ${fmt(d.median, lang)} · Q3 ${fmt(d.q3, lang)} · Max ${fmt(d.max, lang)} · ${pick(W.mean, lang)} ${fmt(d.mean, lang, 2)} (◆)`}
            </text>
          )}
        </Svg>
      );
    case "ogive": {
      const x0 = 40, w = 360, base = 145, top = 15;
      const notes = d.notes.length ? d.notes : mini ? SAMPLE.notes : [];
      const pts: string[] = [];
      for (let x = 0; x <= 20; x += 0.5) {
        const p = notes.filter(v => v < x).length / Math.max(1, notes.length);
        pts.push(`${x0 + (w * x) / 20},${base - (base - top) * p}`);
      }
      const at10 = pct(notes.filter(v => v < 10).length, notes.length);
      return (
        <Svg w={mini ? 410 : 640} h={H} mini={mini}>
          {[0, 25, 50, 75, 100].map(f => (
            <g key={f}>
              <line x1={x0} x2={x0 + w} y1={base - ((base - top) * f) / 100} y2={base - ((base - top) * f) / 100} stroke="#ddd" strokeWidth={0.6} />
              {!mini && <text x={x0 - 5} y={base - ((base - top) * f) / 100 + 4} fontSize={10} textAnchor="end">{f}%</text>}
            </g>
          ))}
          {[0, 5, 10, 15, 20].map(x => (
            <g key={x}>
              <line x1={x0 + (w * x) / 20} x2={x0 + (w * x) / 20} y1={top} y2={base} stroke={x === 10 ? "#000" : "#eee"} strokeDasharray={x === 10 ? "4 3" : undefined} strokeWidth={0.7} />
              {!mini && <text x={x0 + (w * x) / 20} y={base + 14} fontSize={10.5} textAnchor="middle">{x}</text>}
            </g>
          ))}
          <polyline points={pts.join(" ")} fill="none" stroke={accent} strokeWidth={2.2} />
          <line x1={x0} x2={x0 + w} y1={base} y2={base} stroke="#000" />
          {!mini && (
            <g>
              <circle cx={x0 + w / 2} cy={base - ((base - top) * at10) / 100} r={4} fill={accent} />
              <text x={x0 + w / 2 + 8} y={base - ((base - top) * at10) / 100 - 6} fontSize={11.5} fontWeight="bold">{fmtPct(at10, lang)} &lt; 10</text>
              <BandLegend d={d} x={legendX + 10} y={40} lang={lang} palette={palette} />
            </g>
          )}
        </Svg>
      );
    }
  }
  return null;
};

/* Échantillon fictif pour les vignettes du sélecteur */
const SAMPLE = dataFromNotes("—", 28, [2.5, 4, 4.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11, 12, 12.5, 13, 13.5, 14, 15, 16, 16.5, 18]);
export const SAMPLE_CLASS_DATA = SAMPLE;
export const SAMPLE_CLASSES: ClassChartData[] = [
  dataFromNotes("A", 30, [3, 5, 6, 7, 8, 9, 9.5, 10, 11, 12, 13, 14, 15, 16, 18]),
  dataFromNotes("B", 28, [1, 2, 4, 6, 7, 7.5, 8, 9, 10, 10.5, 11, 12]),
  dataFromNotes("C", 32, [6, 8, 9, 10, 11, 12, 12.5, 13, 14, 15, 16, 17, 18, 19]),
];

export const SAMPLE_CLASS_DATA_T1 = dataFromNotes("—", 28, SAMPLE.notes, SCHEME_T1);
export const SAMPLE_CLASSES_T1: ClassChartData[] = SAMPLE_CLASSES.map(k => dataFromNotes(k.nom, k.total, k.notes, SCHEME_T1));

/* Axe 0 → 20 */
const ScaleAxis: React.FC<{ x0: number; w: number; y: number; mini?: boolean }> = ({ x0, w, y, mini }) => (
  <g>
    <line x1={x0} x2={x0 + w} y1={y} y2={y} stroke="#000" />
    {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map(v => (
      <g key={v}>
        <line x1={x0 + (w * v) / 20} x2={x0 + (w * v) / 20} y1={y} y2={y + 4} stroke="#000" />
        {!mini && <text x={x0 + (w * v) / 20} y={y + 16} fontSize={10.5} textAnchor="middle">{v}</text>}
      </g>
    ))}
  </g>
);

const BoxGlyph: React.FC<{ d: ClassChartData; x0: number; w: number; y: number; h: number; fill: string; accent: string }> = ({ d, x0, w, y, h, fill, accent }) => {
  if (d.min === null || d.q1 === null || d.median === null || d.q3 === null || d.max === null) return null;
  const X = (v: number) => x0 + (w * v) / 20;
  const my = y + h / 2;
  return (
    <g>
      <line x1={X(d.min)} x2={X(d.q1)} y1={my} y2={my} stroke="#000" />
      <line x1={X(d.q3)} x2={X(d.max)} y1={my} y2={my} stroke="#000" />
      <line x1={X(d.min)} x2={X(d.min)} y1={y + h * 0.25} y2={y + h * 0.75} stroke="#000" />
      <line x1={X(d.max)} x2={X(d.max)} y1={y + h * 0.25} y2={y + h * 0.75} stroke="#000" />
      <rect x={X(d.q1)} y={y} width={Math.max(1, X(d.q3) - X(d.q1))} height={h} fill={fill} stroke="#000" />
      <line x1={X(d.median)} x2={X(d.median)} y1={y} y2={y + h} stroke="#000" strokeWidth={2.2} />
      {d.mean !== null && <path d={`M${X(d.mean)},${my - 6} L${X(d.mean) + 6},${my} L${X(d.mean)},${my + 6} L${X(d.mean) - 6},${my} Z`} fill={accent} stroke="#fff" strokeWidth={0.8} />}
    </g>
  );
};

/* Histogramme 0–20 par classes de 2 points */
const Histogram: React.FC<{ notes: number[]; lang: DiagLang; palette: ChartPalette; mini?: boolean; legend?: ClassChartData | null; wide?: boolean; scheme?: BandScheme }> = ({ notes, lang, palette, mini, legend, wide, scheme = SCHEME_T2 }) => {
  const list = notes.length ? notes : mini ? SAMPLE.notes : [];
  const bins = Array.from({ length: 10 }, (_, i) => list.filter(v => (i === 9 ? v >= 18 && v <= 20 : v >= i * 2 && v < i * 2 + 2)).length);
  const max = Math.max(1, ...bins);
  const x0 = 40, w = wide ? 580 : 360, base = 145, top = 18, bw = w / 10;
  const c = bandColors(palette, scheme);
  return (
    <Svg w={mini && !wide ? 410 : 640} h={175} mini={mini}>
      {[0, 0.5, 1].map(f => (
        <g key={f}>
          <line x1={x0} x2={x0 + w} y1={base - (base - top) * f} y2={base - (base - top) * f} stroke="#ddd" strokeWidth={0.6} />
          {!mini && <text x={x0 - 6} y={base - (base - top) * f + 4} fontSize={10.5} textAnchor="end">{Math.round(max * f)}</text>}
        </g>
      ))}
      {bins.map((n, i) => {
        const h = ((base - top) * n) / max;
        const band = scheme.classify(i * 2 + 1);
        return (
          <g key={i}>
            <rect x={x0 + i * bw + 1} y={base - h} width={bw - 2} height={h} fill={c[band]} stroke="#000" strokeWidth={0.6} />
            {!mini && n > 0 && <text x={x0 + i * bw + bw / 2} y={base - h - 3} fontSize={10.5} textAnchor="middle" fontWeight="bold">{n}</text>}
          </g>
        );
      })}
      <line x1={x0} x2={x0 + w} y1={base} y2={base} stroke="#000" />
      {!mini && [0, 4, 8, 10, 12, 16, 20].map(v => (
        <text key={v} x={x0 + (w * v) / 20} y={base + 14} fontSize={10.5} textAnchor="middle">{v}</text>
      ))}
      {!mini && <line x1={x0 + w / 2} x2={x0 + w / 2} y1={top} y2={base} stroke="#000" strokeDasharray="4 3" />}
      {!mini && legend && <BandLegend d={legend} x={430} y={40} lang={lang} palette={palette} />}
    </Svg>
  );
};

/* ═════════════════════════ Graphiques d'ensemble ═════════════════════════ */

export interface GlobalChartProps {
  type: GlobalChartType;
  classes: ClassChartData[];
  lang: DiagLang;
  palette?: ChartPalette;
  mini?: boolean;
}

export const GlobalChart: React.FC<GlobalChartProps> = ({ type, classes: rawClasses, lang, palette = "color", mini = false }) => {
  const classes = rawClasses.length ? rawClasses : mini ? SAMPLE_CLASSES : [];
  const scheme = classes[0]?.scheme || SCHEME_T2;
  const c = bandColors(palette, scheme);
  const accent = ACCENT[palette];
  const withData = classes.filter(k => k.present > 0);
  if (!withData.length && !mini) return <Empty lang={lang} h={140} />;
  const n = classes.length;
  const labelW = 110;

  switch (type) {
    case "grouped": {
      const H = 210, x0 = 40, base = 165, top = 20, w = 590;
      const max = Math.max(1, ...classes.map(k => Math.max(...k.bands)));
      const gw = w / Math.max(1, n), bw = Math.min(26, (gw - 14) / 4);
      return (
        <Svg w={640} h={mini ? 180 : H} mini={mini}>
          {[0, 0.5, 1].map(f => (
            <g key={f}>
              <line x1={x0} x2={x0 + w} y1={base - (base - top) * f} y2={base - (base - top) * f} stroke="#ddd" strokeWidth={0.6} />
              {!mini && <text x={x0 - 6} y={base - (base - top) * f + 4} fontSize={10.5} textAnchor="end">{Math.round(max * f)}</text>}
            </g>
          ))}
          {classes.map((k, ci) => {
            const gx = x0 + ci * gw + (gw - bw * 4) / 2;
            return (
              <g key={ci}>
                {k.bands.map((v, i) => {
                  const h = ((base - top) * v) / max;
                  return (
                    <g key={i}>
                      <rect x={gx + i * bw} y={base - h} width={bw - 1} height={h} fill={c[i]} stroke="#000" strokeWidth={0.6} />
                      {!mini && v > 0 && bw >= 14 && <text x={gx + i * bw + bw / 2} y={base - h - 3} fontSize={9.5} textAnchor="middle">{v}</text>}
                    </g>
                  );
                })}
                {!mini && <text x={gx + bw * 2} y={base + 15} fontSize={11} textAnchor="middle" fontWeight="bold">{k.nom}</text>}
              </g>
            );
          })}
          <line x1={x0} x2={x0 + w} y1={base} y2={base} stroke="#000" />
          {!mini && <LegendRow y={198} lang={lang} palette={palette} scheme={scheme} />}
        </Svg>
      );
    }
    case "stacked100": {
      const rowH = 26, x0 = labelW, w = 640 - labelW - 50;
      const H = 30 + n * (rowH + 8) + (mini ? 0 : 30);
      return (
        <Svg w={640} h={H} mini={mini}>
          {[0, 50, 100].map(f => (
            <g key={f}>
              <line x1={x0 + (w * f) / 100} x2={x0 + (w * f) / 100} y1={14} y2={20 + n * (rowH + 8)} stroke={f === 50 ? "#000" : "#ddd"} strokeDasharray={f === 50 ? "4 3" : undefined} strokeWidth={0.7} />
              {!mini && <text x={x0 + (w * f) / 100} y={10} fontSize={10} textAnchor="middle">{f}%</text>}
            </g>
          ))}
          {classes.map((k, ci) => {
            let x = x0;
            const y = 20 + ci * (rowH + 8);
            return (
              <g key={ci}>
                {!mini && <text x={x0 - 8} y={y + 17} fontSize={11.5} textAnchor="end" fontWeight="bold">{k.nom}</text>}
                {k.bands.map((v, i) => {
                  const bw = (w * v) / Math.max(1, k.present);
                  const g = (
                    <g key={i}>
                      <rect x={x} y={y} width={bw} height={rowH} fill={c[i]} stroke="#000" strokeWidth={0.6} />
                      {!mini && bw > 30 && <text x={x + bw / 2} y={y + 17} fontSize={10.5} textAnchor="middle" fill={textOn(c[i])}>{fmtPct(pct(v, k.present), lang)}</text>}
                    </g>
                  );
                  x += bw;
                  return g;
                })}
                {!mini && <text x={x0 + w + 6} y={y + 17} fontSize={10.5}>n={k.present}</text>}
              </g>
            );
          })}
          {!mini && <LegendRow y={H - 8} lang={lang} palette={palette} scheme={scheme} />}
        </Svg>
      );
    }
    case "success":
    case "means": {
      const isMean = type === "means";
      const sorted = [...classes].sort((a, b) => (isMean ? (b.mean ?? -1) - (a.mean ?? -1) : pct(b.success, b.present) - pct(a.success, a.present)));
      const rowH = 22, x0 = labelW, w = 640 - labelW - 70;
      const H = 26 + n * (rowH + 8) + (mini ? 0 : 20);
      const maxV = isMean ? 20 : 100;
      const all = mergeChartData("all", classes);
      const ref = isMean ? all.mean ?? 0 : pct(all.success, all.present);
      return (
        <Svg w={640} h={H} mini={mini}>
          <line x1={x0 + (w * ref) / maxV} x2={x0 + (w * ref) / maxV} y1={10} y2={16 + n * (rowH + 8)} stroke={accent} strokeWidth={1.6} strokeDasharray="5 3" />
          {sorted.map((k, ci) => {
            const v = isMean ? k.mean ?? 0 : pct(k.success, k.present);
            const y = 16 + ci * (rowH + 8);
            const good = isMean ? v >= 10 : v >= 50;
            const fill = palette === "mono" ? (good ? "#555" : "#bbb") : good ? "#92d050" : "#f79646";
            return (
              <g key={ci}>
                {!mini && <text x={x0 - 8} y={y + 16} fontSize={11.5} textAnchor="end" fontWeight="bold">{k.nom}</text>}
                <rect x={x0} y={y} width={w} height={rowH} fill="#f3f3f3" />
                <rect x={x0} y={y} width={(w * v) / maxV} height={rowH} fill={fill} stroke="#000" strokeWidth={0.6} />
                {!mini && <text x={x0 + (w * v) / maxV + 6} y={y + 16} fontSize={11.5} fontWeight="bold">{isMean ? fmt(k.mean, lang, 2) : fmtPct(v, lang)}</text>}
              </g>
            );
          })}
          {!mini && (
            <text x={x0 + (w * ref) / maxV} y={H - 4} fontSize={11} textAnchor="middle" fill={accent} fontWeight="bold" {...rtlProps(lang)}>
              {isMean ? `${pick(W.overall, lang)} : ${fmt(all.mean, lang, 2)}` : `${pick(W.all, lang)} : ${fmtPct(ref, lang)}`}
            </text>
          )}
        </Svg>
      );
    }
    case "boxplots": {
      const rowH = 26, x0 = labelW, w = 640 - labelW - 20;
      const H = 30 + n * (rowH + 10) + (mini ? 0 : 26);
      return (
        <Svg w={640} h={H} mini={mini}>
          {[0, 5, 10, 15, 20].map(v => (
            <g key={v}>
              <line x1={x0 + (w * v) / 20} x2={x0 + (w * v) / 20} y1={14} y2={20 + n * (rowH + 10)} stroke={v === 10 ? "#000" : "#e3e3e3"} strokeDasharray={v === 10 ? "4 3" : undefined} strokeWidth={0.7} />
              {!mini && <text x={x0 + (w * v) / 20} y={10} fontSize={10} textAnchor="middle">{v}</text>}
            </g>
          ))}
          {classes.map((k, ci) => (
            <g key={ci}>
              {!mini && <text x={x0 - 8} y={20 + ci * (rowH + 10) + 17} fontSize={11.5} textAnchor="end" fontWeight="bold">{k.nom}</text>}
              <BoxGlyph d={k} x0={x0} w={w} y={20 + ci * (rowH + 10)} h={rowH} fill={palette === "mono" ? "#d0d0d0" : "#bdd7ee"} accent={accent} />
            </g>
          ))}
          {!mini && <text x={lang === "ar" ? 630 : x0} y={H - 6} fontSize={10.5} fill="#333" textAnchor="start" {...rtlProps(lang)}>{`◆ ${pick(W.mean, lang)} · ┃ ${pick(W.median, lang)} · Q1–Q3 · Min–Max`}</text>}
        </Svg>
      );
    }
    case "heatmap": {
      const rowH = 24, x0 = labelW, cw = (640 - labelW - 10) / 4;
      const H = 26 + n * rowH + 4;
      return (
        <Svg w={640} h={H} mini={mini}>
          {!mini && scheme.short.map((b, i) => <text key={i} x={x0 + i * cw + cw / 2} y={16} fontSize={11.5} textAnchor="middle" fontWeight="bold">{b}</text>)}
          {classes.map((k, ci) => (
            <g key={ci}>
              {!mini && <text x={x0 - 8} y={24 + ci * rowH + 16} fontSize={11.5} textAnchor="end" fontWeight="bold">{k.nom}</text>}
              {k.bands.map((v, i) => {
                const p = pct(v, k.present);
                const t = Math.min(1, p / 60);
                const shade = palette === "mono"
                  ? `rgb(${Math.round(245 - 190 * t)},${Math.round(245 - 190 * t)},${Math.round(245 - 190 * t)})`
                  : i < 2
                  ? `rgb(${Math.round(255 - 8 * t)},${Math.round(245 - 125 * t)},${Math.round(235 - 165 * t)})`
                  : `rgb(${Math.round(240 - 140 * t)},${Math.round(248 - 40 * t)},${Math.round(235 - 150 * t)})`;
                return (
                  <g key={i}>
                    <rect x={x0 + i * cw} y={24 + ci * rowH} width={cw} height={rowH} fill={shade} stroke="#fff" strokeWidth={1.5} />
                    {!mini && <text x={x0 + i * cw + cw / 2} y={24 + ci * rowH + 16} fontSize={11.5} textAnchor="middle" fill={palette === "mono" && t > 0.55 ? "#fff" : "#000"}>{fmtPct(p, lang)}</text>}
                  </g>
                );
              })}
            </g>
          ))}
        </Svg>
      );
    }
    case "pieAll": {
      const all = mergeChartData(pick(W.all, lang), classes);
      return <ClassChart type="donut" data={all} lang={lang} palette={palette} mini={mini} />;
    }
    case "histAll": {
      const all = mergeChartData(pick(W.all, lang), classes);
      return <Histogram notes={all.notes} lang={lang} palette={palette} mini={mini} legend={mini ? null : all} scheme={scheme} />;
    }
  }
  return null;
};

const LegendRow: React.FC<{ y: number; lang: DiagLang; palette: ChartPalette; counts?: number[]; x0?: number; step?: number; scheme?: BandScheme }> = ({ y, lang, palette, counts, x0 = 40, step = 150, scheme = SCHEME_T2 }) => {
  const c = bandColors(palette, scheme);
  const ar = lang === "ar";
  return (
    <g>
      {(scheme.long[lang] || scheme.long.fr).map((label, i) => {
        const gx = ar ? 640 - x0 - i * step : x0 + i * step;
        return (
          <g key={i} transform={`translate(${gx},${y})`}>
            <rect x={ar ? -12 : 0} width={12} height={12} y={-10} fill={c[i]} stroke="#000" strokeWidth={0.6} />
            <text x={ar ? -17 : 17} fontSize={11} textAnchor="start" {...rtlProps(lang)}>{label}{counts ? ` (${counts[i]})` : ""}</text>
          </g>
        );
      })}
    </g>
  );
};

export const chartLabel = (type: ClassChartType | GlobalChartType, lang: DiagLang) => {
  const it = [...CLASS_CHARTS, ...GLOBAL_CHARTS].find(c => c.id === type);
  return it ? pick(it.label, lang) : type;
};
export const chartDesc = (type: ClassChartType | GlobalChartType, lang: DiagLang) => {
  const it = [...CLASS_CHARTS, ...GLOBAL_CHARTS].find(c => c.id === type);
  return it ? pick(it.desc, lang) : "";
};

export const statsLine = (d: ClassChartData, lang: DiagLang) => {
  const L = {
    fr: ["Moyenne", "Médiane", "Écart-type", "Min", "Max", "Taux ≥ 10"],
    ar: ["المعدل", "الوسيط", "الانحراف المعياري", "الأدنى", "الأقصى", "نسبة ≥ 10"],
    en: ["Average", "Median", "Std. dev.", "Min", "Max", "Rate ≥ 10"],
  }[lang] || [];
  if (!d.present) return "";
  return [
    `${L[0]} : ${fmt(d.mean, lang, 2)}`,
    `${L[1]} : ${fmt(d.median, lang, 2)}`,
    `${L[2]} : ${fmt(d.sd, lang, 2)}`,
    `${L[3]} : ${fmt(d.min, lang)}`,
    `${L[4]} : ${fmt(d.max, lang)}`,
    `${L[5]} : ${fmtPct(pct(d.success, d.present), lang)}`,
  ].join("  ·  ");
};

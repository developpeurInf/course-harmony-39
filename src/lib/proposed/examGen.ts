/**
 * Exams proposés : assemble un devoir (surveillé ou maison) à partir de la banque d'exercices,
 * pour les chapitres choisis par le professeur, avec barème sur 20 et une version différente
 * par classe. Le rendu est une page imprimable (Enregistrer en PDF) : énoncé seul ou énoncé + corrigé.
 */
import type { BankExercise } from "./examBank/types";
import { loadKatex, renderLatexToString } from "@/lib/mathRender";

export type ExamType = "ds" | "dm";

export interface ExamRequest {
  type: ExamType;
  /** numéro du devoir (DS n°1, DM n°2…) : change aussi la sélection d'exercices */
  number: number;
  semester?: 1 | 2;
  /** chapitres choisis, dans l'ordre du professeur, avec leur numéro */
  chapters: { id: string; num: number; title: string }[];
  /** une version par classe */
  classes: string[];
  durationMin?: number;
  date?: string;
  levelLabel: string;
  subjectLabel: string;
  teacher?: string;
  school?: string;
  schoolYear: string;
}

export interface PlacedQuestion { q: string; s: string; pts: number }
export interface PlacedExercise { ex: BankExercise; pts: number; questions: PlacedQuestion[] }
export interface ExamVersion { className: string; exercises: PlacedExercise[]; shared: boolean }

/** nombre d'exercices par devoir selon le nombre de chapitres */
function exerciseCount(nChapters: number, type: ExamType) {
  if (nChapters <= 1) return type === "dm" ? 3 : 2;
  if (nChapters === 2) return type === "dm" ? 4 : 3;
  return Math.min(nChapters, type === "dm" ? 6 : 5);
}

/** répartit les exercices entre les chapitres (tour à tour, dans l'ordre du professeur) */
function allocate(chapters: string[], total: number) {
  const n = new Map(chapters.map((c) => [c, 0]));
  const list = chapters.slice(0, Math.max(total, 1));
  for (let i = 0; i < total; i++) { const c = list[i % list.length]; n.set(c, (n.get(c) || 0) + 1); }
  return n;
}

const round = (x: number, step: number) => Math.round(x / step) * step;

/** met les points à l'échelle pour que la somme fasse exactement `total` (pas de `step`) */
function scale(weights: number[], total: number, step: number) {
  const W = weights.reduce((a, b) => a + b, 0) || 1;
  const pts = weights.map((w) => Math.max(step, round((w / W) * total, step)));
  let diff = round(total - pts.reduce((a, b) => a + b, 0), step);
  // corrige l'écart sur les plus gros éléments
  const order = pts.map((_, i) => i).sort((a, b) => weights[b] - weights[a]);
  let k = 0;
  while (Math.abs(diff) > 1e-9 && k < 1000) {
    const i = order[k % order.length];
    const d = diff > 0 ? step : -step;
    if (pts[i] + d >= step) { pts[i] += d; diff = round(diff - d, step); }
    k++;
  }
  return pts;
}

/** choisit, pour chaque classe, c indices parmi n : blocs disjoints si possible,
 *  sinon combinaisons qui se recouvrent le moins possible (jamais deux sujets identiques tant que la banque le permet) */
function pickSets(n: number, c: number, nC: number, seed: number): { sets: number[][]; shared: boolean } {
  if (c <= 0) return { sets: Array.from({ length: nC }, () => []), shared: false };
  if (n >= nC * c) {
    const start = (seed * nC * c) % n;
    return { sets: Array.from({ length: nC }, (_, v) => Array.from({ length: c }, (_, t) => (start + v * c + t) % n)), shared: false };
  }
  const combos: number[][] = [];
  const rec = (from: number, cur: number[]) => {
    if (cur.length === c) { combos.push(cur.slice()); return; }
    for (let i = from; i < n && combos.length < 5000; i++) { cur.push(i); rec(i + 1, cur); cur.pop(); }
  };
  rec(0, []);
  const rot = (k: number) => (k + seed * c) % n;
  const sets: number[][] = [];
  for (let v = 0; v < nC; v++) {
    let best = combos[0], bestKey = [Infinity, Infinity, Infinity];
    combos.forEach((cb, idx) => {
      const ov = sets.map((s) => cb.filter((x) => s.includes(x)).length);
      const key = [Math.max(0, ...ov), ov.reduce((a, b) => a + b, 0), idx];
      if (key[0] < bestKey[0] || (key[0] === bestKey[0] && (key[1] < bestKey[1] || (key[1] === bestKey[1] && key[2] < bestKey[2])))) { best = cb; bestKey = key; }
    });
    sets.push(best);
  }
  return { sets: sets.map((s) => s.map(rot)), shared: true };
}

/** construit une version par classe ; les versions n'ont aucun exercice commun tant que la banque le permet */
export function buildExam(req: ExamRequest, bank: BankExercise[]): ExamVersion[] {
  const chapterIds = req.chapters.map((c) => c.id);
  const pools = new Map(chapterIds.map((id) => [id, bank.filter((e) => e.chapter === id && (!e.only || e.only === req.type))]));
  const usable = chapterIds.filter((id) => (pools.get(id) || []).length > 0);
  if (!usable.length) return [];
  // un DS de 2 h ou plus reçoit un exercice de plus
  const total = exerciseCount(usable.length, req.type) + (req.type === "ds" && (req.durationMin || 0) >= 110 ? 1 : 0);
  const per = allocate(usable, total);
  const nC = Math.max(1, req.classes.length);
  const picks = new Map(usable.map((id) => [id, pickSets(pools.get(id)!.length, Math.min(per.get(id) || 0, pools.get(id)!.length), nC, req.number - 1)]));
  return (req.classes.length ? req.classes : [""]).map((className, v) => {
    let shared = false;
    const chosen: BankExercise[] = [];
    for (const id of usable) {
      const pool = pools.get(id)!;
      const pick = picks.get(id)!;
      if (pick.shared) shared = true;
      for (const i of pick.sets[v]) chosen.push(pool[i]);
    }
    const unique = chosen.filter((e, i) => chosen.findIndex((x) => x.id === e.id) === i);
    const exPts = scale(unique.map((e) => e.questions.reduce((a, q) => a + q.w, 0)), 20, 0.5);
    const exercises = unique.map((ex, i) => {
      const qp = scale(ex.questions.map((q) => q.w), exPts[i], 0.25);
      return { ex, pts: exPts[i], questions: ex.questions.map((q, j) => ({ q: q.q, s: q.s, pts: qp[j] })) };
    });
    return { className, exercises, shared };
  });
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const frDate = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split("-").reverse().join("/") : d || "");
const fmt = (x: number) => (Number.isInteger(x) ? String(x) : String(x).replace(".", ","));
const ptsLabel = (x: number) => `${fmt(x)} pt${x > 1 ? "s" : ""}`;

function mathify(katex: any, html: string) {
  return html
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, t) => renderLatexToString(katex, t, true))
    .replace(/\$([^$\n]+?)\$/g, (_, t) => renderLatexToString(katex, t, false));
}

/** page HTML imprimable d'une version (énoncé seul ou avec corrigé) */
export function examHtml(req: ExamRequest, v: ExamVersion, withSolution: boolean, katex: any): string {
  const title = req.type === "ds" ? `Devoir surveillé n°${req.number}` : `Devoir maison n°${req.number}`;
  const chapters = req.chapters.map((c) => `Chapitre ${c.num} · ${esc(c.title)}`).join(" — ");
  const head = `
<table class="hd"><tr>
<td class="l"><b>Lycée :</b> ${esc(req.school || "………………")}<br><b>Professeur :</b> ${esc(req.teacher || "………………")}<br><b>Année scolaire :</b> ${esc(req.schoolYear)}</td>
<td class="c"><div class="t">${title}${req.semester ? ` · Semestre ${req.semester}` : ""}</div><div class="m">${esc(req.subjectLabel)} · ${esc(req.levelLabel)}</div>${withSolution ? `<div class="cor">Énoncé et corrigé</div>` : ""}</td>
<td class="r"><b>Classe :</b> ${esc(v.className || "………")}<br>${req.type === "ds" ? `<b>Durée :</b> ${req.durationMin ? `${Math.floor(req.durationMin / 60) ? `${Math.floor(req.durationMin / 60)} h` : ""}${req.durationMin % 60 ? ` ${req.durationMin % 60} min` : ""}` : "………"}` : `<b>À rendre le :</b> ${esc(frDate(req.date) || "………")}`}<br>${req.type === "ds" && req.date ? `<b>Date :</b> ${esc(frDate(req.date))}` : ""}</td>
</tr></table>
${req.type === "ds" && !withSolution ? `<div class="id">Nom et prénom : ………………………………………… &nbsp; N° : ……… &nbsp; Note : ……… / 20</div>` : ""}
<div class="ch"><b>Programme :</b> ${chapters}</div>
<div class="bar"><b>Barème :</b> ${v.exercises.map((e, i) => `Exercice ${i + 1} : ${ptsLabel(e.pts)}`).join(" · ")} · <b>Total : 20 pts</b>${req.type === "ds" ? " · La calculatrice non programmable est autorisée. La rédaction et la justification des réponses sont prises en compte." : " · Rédiger avec soin ; justifier chaque réponse."}</div>`;
  const body = v.exercises.map((e, i) => `
<section class="ex"><h2>Exercice ${i + 1} <span>(${ptsLabel(e.pts)})</span> <em>${esc(e.ex.title)}</em></h2>
${e.ex.intro ? `<div class="intro">${mathify(katex, e.ex.intro)}</div>` : ""}
<ol>${e.questions.map((q) => `<li><div class="q">${mathify(katex, q.q)} <span class="p">(${ptsLabel(q.pts)})</span></div>${withSolution ? `<div class="s"><b>Corrigé.</b> ${mathify(katex, q.s)}</div>` : ""}</li>`).join("")}</ol>
</section>`).join("");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${title}${v.className ? ` - ${esc(v.className)}` : ""}${withSolution ? " - corrigé" : ""}</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css">
<style>
@page{size:A4;margin:14mm 14mm 16mm}
*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:"DejaVu Sans","Segoe UI",Arial,sans-serif;font-size:10.5pt;line-height:1.45;color:#1d2433;margin:0}
@media screen{body{max-width:182mm;margin:12mm auto}}
table.hd{width:100%;border-collapse:collapse;border:1.5px solid #1d2433}
table.hd td{border:1px solid #1d2433;padding:6px 8px;vertical-align:middle;font-size:9.5pt}
table.hd td.c{text-align:center;width:42%} .t{font-size:14pt;font-weight:700;color:#2b59c3} .m{margin-top:2px} .cor{margin-top:3px;color:#1f7a3f;font-weight:600}
.id{border:1px dashed #8a93a8;padding:6px 8px;margin-top:6px;font-size:9.5pt}
.ch{margin-top:6px;font-size:9.5pt} .bar{margin:4px 0 8px;font-size:9pt;color:#3c4659;border-bottom:2px solid #2b59c3;padding-bottom:6px}
.ex{margin-top:10px} h2{font-size:12pt;margin:8px 0 4px;color:#fff;background:#2b59c3;padding:3px 8px;border-radius:3px;break-after:avoid}
h2 span{font-weight:400} h2 em{font-weight:400;font-style:normal;opacity:.9;font-size:10pt;margin-left:6px}
.intro{margin:4px 0} ol{margin:4px 0;padding-left:22px} li{margin:4px 0}
.p{color:#55607a;font-size:9pt;white-space:nowrap}
.s{border-left:3px solid #1f7a3f;background:#f1faf4;padding:4px 10px;margin:4px 0 8px;break-inside:avoid}
.katex-display{margin:.4em 0} table.tv{border-collapse:collapse;margin:4px auto} table.tv td,table.tv th{border:1px solid #9aa3ad;padding:2px 8px;text-align:center}
.end{text-align:center;margin-top:14px;font-size:9pt;color:#55607a}
</style></head><body>${head}${body}<div class="end">Bon courage</div></body></html>`;
}

/** ouvre la version dans un nouvel onglet, prête à « Enregistrer en PDF » */
export async function openExam(req: ExamRequest, v: ExamVersion, withSolution: boolean, print = true) {
  const w = window.open("", "_blank");
  if (!w) return false;
  let katex: any = null;
  try { katex = await loadKatex(); } catch { /* formules laissées en LaTeX */ }
  const html = examHtml(req, v, withSolution, katex || { renderToString: (t: string) => t });
  w.document.open();
  w.document.write(html.replace("</body>", print ? `<script>window.addEventListener('load',function(){setTimeout(function(){window.print()},500)})</script></body>` : "</body>"));
  w.document.close();
  return true;
}

export function currentSchoolYear(d = new Date()) {
  const y = d.getFullYear();
  return d.getMonth() >= 7 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

/**
 * Mise en page officielle d'une fiche pédagogique (جذاذة), dans le style des rapports
 * d'évaluation diagnostique : A4 portrait, cadre double, en-tête en trois cases
 * (académie / titre / établissement), sections numérotées en chiffres romains,
 * tableaux à bordures noires et cases de signature.
 * Les formules LaTeX ($…$) sont converties par KaTeX en MathML, affiché nativement par le
 * navigateur : aucune feuille de style ni police à charger dans la fenêtre d'impression.
 */
import { escapeHtml, type ReportBranding } from "@/lib/reportBranding";
import { splitMath } from "@/lib/mathRender";
import type { LessonPlan } from "@/lib/teacherAi";

export type PlanLang = "ar" | "fr";

const FONTS_CSS = "https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap";
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

const TXT = {
  ar: {
    doc: "جذاذة درس", season: "الموسم الدراسي", institution: "المؤسسة", teacher: "الأستاذ(ة)", subject: "المادة",
    lesson: "عنوان الدرس", level: "المستوى", duration: "مدة الإنجاز", klass: "القسم", date: "التاريخ",
    frame: "الإطار المرجعي", competencies: "الكفايات المستهدفة", objectives: "الأهداف التعلمية", prerequisites: "المكتسبات القبلية", materials: "الوسائل الديداكتيكية",
    steps: "سير الحصة", phase: "المرحلة", time: "المدة", teacherAct: "أنشطة الأستاذ(ة)", studentsAct: "أنشطة المتعلمين", evaluation: "التقويم",
    closing: "التقويم والدعم", assessment: "التقويم الختامي", homework: "الواجب المنزلي", remediation: "الدعم والمعالجة",
    sigTeacher: "توقيع الأستاذ(ة)", sigDirector: "توقيع السيد المدير", sigInspector: "ملاحظات وتوقيع السيد المفتش", total: "المجموع",
  },
  fr: {
    doc: "Fiche pédagogique", season: "Année scolaire", institution: "Établissement", teacher: "Enseignant(e)", subject: "Matière",
    lesson: "Leçon", level: "Niveau", duration: "Durée", klass: "Classe", date: "Date",
    frame: "Cadre de référence", competencies: "Compétences visées", objectives: "Objectifs d'apprentissage", prerequisites: "Prérequis", materials: "Supports didactiques",
    steps: "Déroulement de la séance", phase: "Étape", time: "Durée", teacherAct: "Activités de l'enseignant(e)", studentsAct: "Activités des élèves", evaluation: "Évaluation",
    closing: "Évaluation et soutien", assessment: "Évaluation finale", homework: "Travail à la maison", remediation: "Soutien et remédiation",
    sigTeacher: "Signature de l'enseignant(e)", sigDirector: "Signature du directeur", sigInspector: "Observations et signature de l'inspecteur", total: "Total",
  },
};

/** En-tête administratif saisi dans « Évaluation diagnostique » (lu sans écrire de valeurs par défaut). */
export interface PlanHeader {
  academie: string;
  direction: string;
  lycee: string;
  matiere: string;
  annee: string;
  teacher: string;
}

export function readPlanHeader(teacherName: string): PlanHeader {
  let c: any = {};
  try {
    const raw = localStorage.getItem("diageval_pro_data_v1");
    c = (raw && JSON.parse(raw)?.config) || {};
  } catch {
    /* stockage indisponible */
  }
  return {
    academie: String(c.academie || ""),
    direction: String(c.direction || ""),
    lycee: String(c.lycee || ""),
    matiere: String(c.matiere || ""),
    annee: String(c.annee_scolaire || ""),
    teacher: teacherName || String(c.nom_enseignant || ""),
  };
}

function mathml(katex: any, latex: string): string {
  try {
    return katex.renderToString(latex, { output: "mathml", throwOnError: false, strict: "ignore" });
  } catch {
    return escapeHtml(latex);
  }
}

/** Texte → HTML : échappement, **gras**, retours à la ligne et formules LaTeX. */
function rich(text: string, katex: any): string {
  const parts = katex ? splitMath(String(text || "")) : [{ t: "text" as const, v: String(text || "") }];
  return parts
    .map((p) => {
      if (p.t === "math") return `<span class="m">${mathml(katex, p.v)}</span>`;
      return escapeHtml(p.v).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
    })
    .join("");
}

export function buildLessonPlanHtml(opts: {
  plan: LessonPlan;
  lang: PlanLang;
  branding: ReportBranding;
  header: PlanHeader;
  katex: any;
  autoPrint?: boolean;
}): string {
  const { plan, lang, branding: b, header: h, katex } = opts;
  const t = TXT[lang];
  const rtl = lang === "ar";
  const r = (s: string) => rich(s, katex);
  const list = (a: string[]) => {
    const items = (a || []).map((x) => x.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean);
    return items.length ? `<ul class="list">${items.map((x) => `<li>${r(x)}</li>`).join("")}</ul>` : `<div class="dots"></div>`;
  };
  const dots = `<span class="fill"></span>`;
  const sec = (i: number, label: string) => `<div class="section"><span class="roman">${ROMAN[i]}.</span> <u>${escapeHtml(label)} :</u></div>`;

  const steps = (plan.steps || [])
    .map(
      (s, i) => `<tr>
<td class="phase"><div class="num">${i + 1}</div>${r(s.phase)}</td>
<td class="time">${r(s.duration)}</td>
<td>${r(s.teacher)}</td>
<td>${r(s.students)}</td>
<td>${r(s.evaluation)}</td>
</tr>`,
    )
    .join("");

  const logo = b.logoUrl ? `<img class="logo" src="${escapeHtml(new URL(b.logoUrl, location.href).href)}" alt="" onerror="this.style.display='none'">` : "";

  const body = `
<div class="header">
  <div class="cell ministry">
    ${logo}
    ${b.headerTitle ? `<div class="small">${escapeHtml(b.headerTitle)}</div>` : ""}
    ${b.headerSubtitle ? `<div class="small n">${escapeHtml(b.headerSubtitle)}</div>` : ""}
    ${h.academie ? `<div class="small">${escapeHtml(h.academie)}</div>` : ""}
    ${h.direction ? `<div class="small">${escapeHtml(h.direction)}</div>` : ""}
  </div>
  <div class="cell title">
    <div class="doc">${escapeHtml(t.doc)}</div>
    <div class="season"><b>${escapeHtml(t.season)} :</b> ${escapeHtml(h.annee) || dots}</div>
  </div>
  <div class="cell info">
    <div><b class="lbl">${escapeHtml(t.institution)} :</b> ${escapeHtml(h.lycee || b.schoolName) || dots}</div>
    <div><b class="lbl">${escapeHtml(t.teacher)} :</b> ${escapeHtml(h.teacher) || dots}</div>
    <div><b class="lbl">${escapeHtml(t.subject)} :</b> ${escapeHtml(h.matiere) || dots}</div>
  </div>
</div>

<div class="lesson">${r(plan.title)}</div>

<table class="grid meta">
  <tr>
    <th>${escapeHtml(t.level)}</th><td>${r(plan.level)}</td>
    <th>${escapeHtml(t.duration)}</th><td>${r(plan.duration)}</td>
    <th>${escapeHtml(t.klass)}</th><td class="blank"></td>
    <th>${escapeHtml(t.date)}</th><td class="blank"></td>
  </tr>
</table>

${sec(0, t.frame)}
<table class="grid two">
  <tr><th class="band">${escapeHtml(t.competencies)}</th><th class="band">${escapeHtml(t.objectives)}</th></tr>
  <tr><td>${list(plan.competencies)}</td><td>${list(plan.objectives)}</td></tr>
  <tr><th class="band">${escapeHtml(t.prerequisites)}</th><th class="band">${escapeHtml(t.materials)}</th></tr>
  <tr><td>${list(plan.prerequisites)}</td><td>${list(plan.materials)}</td></tr>
</table>

${sec(1, t.steps)}
<table class="grid steps">
  <thead><tr>
    <th style="width:15%">${escapeHtml(t.phase)}</th>
    <th style="width:8%">${escapeHtml(t.time)}</th>
    <th>${escapeHtml(t.teacherAct)}</th>
    <th>${escapeHtml(t.studentsAct)}</th>
    <th style="width:19%">${escapeHtml(t.evaluation)}</th>
  </tr></thead>
  <tbody>${steps}</tbody>
</table>

${sec(2, t.closing)}
<table class="grid closing">
  <tr><th>${escapeHtml(t.assessment)}</th><td>${r(plan.assessment)}</td></tr>
  <tr><th>${escapeHtml(t.homework)}</th><td>${r(plan.homework)}</td></tr>
  <tr><th>${escapeHtml(t.remediation)}</th><td>${r(plan.remediation)}</td></tr>
</table>

<div class="keep"><table class="grid sign">
  <tr><th>${escapeHtml(t.sigTeacher)}</th><th>${escapeHtml(t.sigDirector)}</th><th>${escapeHtml(t.sigInspector)}</th></tr>
  <tr><td><b>${escapeHtml(h.teacher)}</b></td><td></td><td></td></tr>
</table></div>`;

  const css = `
@page { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; background: #fff; }
body { font-family: ${rtl ? "'Amiri', " : ""}'Times New Roman', 'Amiri', serif; color: #000; font-size: 11pt; line-height: 1.4; }
math { font-size: 1.08em; direction: ltr; }
.m { display: inline-block; direction: ltr; unicode-bidi: isolate; }
/* Cadre double répété sur chaque page + marges répétées (thead/tfoot) */
.frame { position: fixed; top: 9mm; bottom: 9mm; left: 9mm; right: 9mm; border: 3px double #000; pointer-events: none; }
.footer { position: fixed; bottom: 3.5mm; left: 12mm; right: 12mm; text-align: center; font-size: 7.5pt; color: #555; white-space: pre-line; }
.layout { width: 100%; border-collapse: collapse; }
.layout > thead td, .layout > tfoot td { height: 13mm; padding: 0; }
.layout > tbody > tr > td { padding: 0 15mm; }
.header { display: -webkit-box; display: flex; border: 1.5px solid #000; margin-bottom: 3mm; }
.cell { padding: 2mm 3mm; }
.ministry { width: 33%; text-align: center; }
.title { width: 34%; text-align: center; border-left: 1.5px solid #000; border-right: 1.5px solid #000; display: -webkit-box; display: flex; -webkit-box-orient: vertical; flex-direction: column; justify-content: center; }
.info { width: 33%; font-size: 10.5pt; line-height: 1.55; display: -webkit-box; display: flex; -webkit-box-orient: vertical; flex-direction: column; justify-content: center; }
.logo { display: block; max-width: 100%; max-height: 15mm; margin: 0 auto 1mm; object-fit: contain; }
.small { font-size: 7.5pt; font-weight: bold; line-height: 1.25; }
.small.n { font-weight: normal; }
.doc { font-size: 16pt; font-weight: bold; text-decoration: underline; text-underline-offset: 3px; }
.season { font-size: 10.5pt; margin-top: 1.5mm; }
.lbl { text-decoration: underline; }
.fill { display: inline-block; min-width: 28mm; border-bottom: 1px dotted #000; }
.lesson { margin: 1mm auto 3mm; padding: 2mm 4mm; border: 1.5px solid #000; background: #deeaf6; text-align: center; font-size: 15pt; font-weight: bold; }
.section { font-size: 13pt; font-weight: bold; margin: 3.5mm 0 1.5mm; page-break-after: avoid; break-after: avoid; }
.roman { display: inline-block; min-width: 9mm; }
.grid { width: 100%; border-collapse: collapse; font-size: 10.5pt; table-layout: fixed; }
.grid th, .grid td { word-wrap: break-word; overflow-wrap: break-word; border: 1px solid #000; padding: 1.4mm 2mm; vertical-align: top; text-align: ${rtl ? "right" : "left"}; }
.grid th { background: #e7e6e6; font-weight: bold; text-align: center; vertical-align: middle; }
.grid tr { page-break-inside: avoid; break-inside: avoid; }
.meta th { width: 11%; }
.meta td { text-align: center; font-weight: bold; }
.two td { width: 50%; }
.two th.band { background: #fbe4d5; }
.list { margin: 0; padding: 0 ${rtl ? "5mm 0 0" : "0 0 0 5mm"}; }
.list li { margin: 0.4mm 0; }
.dots { height: 10mm; }
.steps thead th { background: #d9e2f3; }
.steps td { font-size: 10pt; }
.steps td.phase { background: #f2f2f2; font-weight: bold; text-align: center; vertical-align: middle; }
.steps td.time { text-align: center; vertical-align: middle; font-weight: bold; white-space: nowrap; }
.num { display: block; margin: 0 auto 1mm; width: 6mm; height: 6mm; line-height: 6mm; border: 1px solid #000; border-radius: 50%; font-size: 9pt; background: #fff; }
.closing th { width: 24%; background: #e2efd9; }
.keep { page-break-inside: avoid; break-inside: avoid; }
.sign { margin-top: 4mm; }
.sign th { width: 33.3%; }
.sign td { height: 20mm; text-align: center; }
@media screen {
  html { background: #e5e7eb; }
  body { width: 210mm; min-height: 297mm; margin: 6mm auto; background: #fff; box-shadow: 0 4px 18px rgba(0,0,0,.18); position: relative; }
  .frame { position: absolute; }
  .footer { position: absolute; }
}`;

  const auto = opts.autoPrint
    ? `<script>window.addEventListener('load',function(){var go=function(){setTimeout(function(){window.print();},250);};if(document.fonts&&document.fonts.ready){document.fonts.ready.then(go,go);}else{go();}});</script>`
    : "";

  return `<!doctype html><html lang="${lang}" dir="${rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8">
<title>${escapeHtml(`${t.doc} - ${plan.title}`)}</title>
<link rel="stylesheet" href="${FONTS_CSS}">
<style>${css}</style></head>
<body><div class="frame"></div>${b.footerText ? `<div class="footer">${escapeHtml(b.footerText)}</div>` : ""}
<table class="layout"><thead><tr><td></td></tr></thead><tfoot><tr><td></td></tr></tfoot><tbody><tr><td>${body}</td></tr></tbody></table>
${auto}</body></html>`;
}

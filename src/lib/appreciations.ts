/**
 * Appréciations de bulletin et bilan imprimable pour les parents, à partir des
 * résultats aux quiz (classAnalytics) et des présences. Textes en arabe ou en français,
 * modifiables par le professeur avant export.
 */
import type { AnalyticsOptions, StudentAnalytics } from "@/lib/classAnalytics";
import { escapeHtml, getReportBranding, reportHeaderLines } from "@/lib/reportBranding";

export type TextLang = "ar" | "fr";

export interface AppreciationInput {
  note20: number | null;
  trend: StudentAnalytics["trend"];
  participation: number; // 0–100
  absences: number;
  lates: number;
}

const TEXTS = {
  fr: {
    excellent: "Excellents résultats et travail sérieux. Continuez ainsi.",
    good: "Bon travail et résultats satisfaisants. Poursuivez vos efforts.",
    progress: "Résultats moyens : des efforts réguliers sont encore nécessaires pour progresser.",
    struggling: "Résultats insuffisants : il faut travailler davantage et revoir les bases.",
    none: "Pas assez d'évaluations pour apprécier le travail.",
    up: "Belle progression.",
    down: "Attention à la baisse des résultats.",
    participation: "Plusieurs évaluations n'ont pas été faites.",
    absences: (n: number) => `Absences trop nombreuses (${n}).`,
    lates: "Retards répétés.",
  },
  ar: {
    excellent: "نتائج ممتازة وعمل جاد، استمر على هذا المنوال.",
    good: "عمل جيد ونتائج مرضية، واصل المجهود.",
    progress: "نتائج متوسطة، يجب بذل مجهود منتظم من أجل التحسن.",
    struggling: "نتائج غير كافية، يجب مضاعفة العمل ومراجعة الأساسيات.",
    none: "عدد التقويمات غير كاف لتقدير العمل.",
    up: "تحسن ملحوظ.",
    down: "انتبه إلى تراجع النتائج.",
    participation: "لم ينجز عدة تقويمات.",
    absences: (n: number) => `غيابات كثيرة (${n}).`,
    lates: "تأخرات متكررة.",
  },
};

export function generateAppreciation(input: AppreciationInput, lang: TextLang, o: AnalyticsOptions): string {
  const t = TEXTS[lang];
  const parts: string[] = [];
  const n = input.note20;
  if (n === null) parts.push(t.none);
  else if (n >= o.levelExcellent) parts.push(t.excellent);
  else if (n >= o.levelGood) parts.push(t.good);
  else if (n >= o.levelStruggling) parts.push(t.progress);
  else parts.push(t.struggling);
  if (n !== null && input.trend === "up") parts.push(t.up);
  if (n !== null && input.trend === "down") parts.push(t.down);
  if (n !== null && input.participation < 60) parts.push(t.participation);
  if (input.absences >= 3) parts.push(t.absences(input.absences));
  if (input.lates >= 3) parts.push(t.lates);
  return parts.join(" ");
}

/* ───────────────────────── Bilan pour les parents ───────────────────────── */

export interface ParentReportStudent {
  name: string;
  massar?: string | null;
  note20: number | null;
  rank: number | null;
  classSize: number;
  results: { title: string; date: string; note20: number }[];
  absences: number;
  excused: number;
  lates: number;
  appreciation: string;
}

const L = {
  fr: {
    title: "Bilan de l'élève",
    student: "Élève",
    massar: "Code Massar",
    klass: "Classe",
    teacher: "Professeur",
    period: "Période",
    average: "Moyenne des évaluations",
    rank: "Rang",
    results: "Résultats aux évaluations",
    evaluation: "Évaluation",
    date: "Date",
    grade: "Note /20",
    attendance: "Assiduité",
    absences: "Absences",
    excused: "dont justifiées",
    lates: "Retards",
    appreciation: "Appréciation du professeur",
    signTeacher: "Signature du professeur",
    signParent: "Signature des parents",
    none: "Aucune évaluation sur la période.",
  },
  ar: {
    title: "حصيلة التلميذ",
    student: "التلميذ(ة)",
    massar: "رمز مسار",
    klass: "القسم",
    teacher: "الأستاذ(ة)",
    period: "الفترة",
    average: "معدل التقويمات",
    rank: "الرتبة",
    results: "نتائج التقويمات",
    evaluation: "التقويم",
    date: "التاريخ",
    grade: "النقطة /20",
    attendance: "المواظبة",
    absences: "الغيابات",
    excused: "منها مبررة",
    lates: "التأخرات",
    appreciation: "ملاحظة الأستاذ(ة)",
    signTeacher: "توقيع الأستاذ(ة)",
    signParent: "توقيع ولي الأمر",
    none: "لا توجد تقويمات خلال هذه الفترة.",
  },
};

const fmt = (n: number, lang: TextLang) => (Math.round(n * 100) / 100).toString().replace(".", lang === "fr" ? "," : ".");

/** Document HTML complet, une page A4 par élève (impression ou « Enregistrer en PDF ») */
export function buildParentReportHtml(opts: {
  lang: TextLang;
  className: string;
  teacherName: string;
  periodLabel: string;
  students: ParentReportStudent[];
}): string {
  const t = L[opts.lang];
  const b = getReportBranding(opts.lang);
  const header = reportHeaderLines(b).map((l) => `<div>${escapeHtml(l)}</div>`).join("");
  const logo = b.logoUrl ? `<img class="logo" src="${escapeHtml(new URL(b.logoUrl, window.location.origin).href)}" alt="">` : "";
  const dateFmt = (iso: string) => new Date(iso).toLocaleDateString(opts.lang === "ar" ? "ar-MA" : "fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const pages = opts.students.map((s) => {
    const rows = s.results.length
      ? s.results.map((r) => `<tr><td>${escapeHtml(r.title)}</td><td class="c">${dateFmt(r.date)}</td><td class="c b">${fmt(r.note20, opts.lang)}</td></tr>`).join("")
      : `<tr><td colspan="3" class="c muted">${t.none}</td></tr>`;
    return `
    <section class="page">
      <header>${logo}<div class="head">${header}</div></header>
      <h1>${t.title}</h1>
      <table class="info">
        <tr><th>${t.student}</th><td>${escapeHtml(s.name)}</td><th>${t.massar}</th><td dir="ltr">${escapeHtml(s.massar || "—")}</td></tr>
        <tr><th>${t.klass}</th><td>${escapeHtml(opts.className)}</td><th>${t.teacher}</th><td>${escapeHtml(opts.teacherName)}</td></tr>
        <tr><th>${t.period}</th><td colspan="3">${escapeHtml(opts.periodLabel)}</td></tr>
      </table>
      <div class="kpis">
        <div class="kpi"><span>${t.average}</span><strong dir="ltr">${s.note20 === null ? "—" : `${fmt(s.note20, opts.lang)} / 20`}</strong></div>
        <div class="kpi"><span>${t.rank}</span><strong dir="ltr">${s.rank ? `${s.rank} / ${s.classSize}` : "—"}</strong></div>
        <div class="kpi"><span>${t.absences}</span><strong>${s.absences}${s.excused ? ` <small>(${t.excused} ${s.excused})</small>` : ""}</strong></div>
        <div class="kpi"><span>${t.lates}</span><strong>${s.lates}</strong></div>
      </div>
      <h2>${t.results}</h2>
      <table class="grid"><thead><tr><th>${t.evaluation}</th><th>${t.date}</th><th>${t.grade}</th></tr></thead><tbody>${rows}</tbody></table>
      <h2>${t.appreciation}</h2>
      <div class="appr">${escapeHtml(s.appreciation || "")}</div>
      <div class="signs"><div>${t.signTeacher}</div><div>${t.signParent}</div></div>
      ${b.footerText ? `<footer>${escapeHtml(b.footerText)}</footer>` : ""}
    </section>`;
  }).join("");
  return `<!doctype html><html lang="${opts.lang}" dir="${opts.lang === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8">
<title>${t.title} · ${escapeHtml(opts.className)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: ${opts.lang === "ar" ? "'Noto Naskh Arabic','Amiri','Tahoma'," : ""} 'Segoe UI', Arial, sans-serif; color: #111; margin: 0; font-size: 12.5px; }
  .page { page-break-after: always; padding: 4mm 0; }
  .page:last-child { page-break-after: auto; }
  header { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #222; padding-bottom: 8px; }
  .logo { height: 56px; width: auto; }
  .head { font-weight: 600; line-height: 1.5; }
  h1 { text-align: center; font-size: 20px; margin: 14px 0 10px; }
  h2 { font-size: 14px; margin: 16px 0 6px; border-bottom: 1px solid #bbb; padding-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; }
  .info th, .info td, .grid th, .grid td { border: 1px solid #999; padding: 5px 7px; text-align: start; }
  .info th, .grid th { background: #f1f1f1; font-weight: 600; white-space: nowrap; }
  .c { text-align: center !important; }
  .b { font-weight: 700; }
  .muted { color: #666; }
  .kpis { display: flex; gap: 8px; margin-top: 12px; }
  .kpi { flex: 1; border: 1px solid #999; border-radius: 6px; padding: 6px 8px; }
  .kpi span { display: block; font-size: 11px; color: #555; }
  .kpi strong { font-size: 16px; }
  .appr { border: 1px solid #999; border-radius: 6px; min-height: 60px; padding: 8px 10px; line-height: 1.7; }
  .signs { display: flex; justify-content: space-between; margin-top: 26px; }
  .signs div { width: 45%; border-top: 1px dashed #777; padding-top: 4px; text-align: center; color: #444; }
  footer { margin-top: 18px; font-size: 10.5px; color: #555; text-align: center; white-space: pre-line; }
</style></head><body>${pages}
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},300);});</script>
</body></html>`;
}

/** Ouvre le bilan dans un nouvel onglet et lance l'impression (le parent peut l'enregistrer en PDF) */
export function openPrintable(html: string): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}

import React from "react";
import { DiagnosticConfig } from "@/lib/diagnosticStorage";
import { DiagnosticClass, parseNoteValue } from "@/lib/diagnosticStatsEngine";
import { DiagLang } from "@/lib/diagnosticTranslations";

/**
 * Modèle 2 : « Rapport des évaluations diagnostiques » multi-classes
 * (données générales par classe + répartition des élèves en 4 tranches /20).
 * Mise en page A4 identique au modèle 1 (même id racine et mêmes classes CSS
 * de page) pour réutiliser l'export PDF et l'impression existants.
 */

interface Props {
  config: DiagnosticConfig;
  classes: DiagnosticClass[];
  lang?: DiagLang;
}

interface ClassBand {
  nom: string;
  date: string;
  total: number;
  present: number;
  bands: [number, number, number, number]; // <5, [5;10[, [10;15[, [15;20]
}

/* ───────────── Textes ───────────── */

const TXT = {
  ar: {
    title: "تقرير التقويمات التشخيصية",
    season: "الموسم الدراسي",
    institution: "المؤسسة",
    teacher: "الأستاذ",
    subject: "المادة",
    secObjectives: "أهداف التقويم التشخيصي:",
    objectives: [
      "التمكن من تحديد مواطن القوة ومواطن الضعف في التعلمات السابقة للمتعلمين والمتعلمات.",
      "تحديد صعوبات وعوائق التعلم وتحفيز المتعلمين على تجاوزها.",
      "استثمار نتائج التقويم التشخيصي لتخطيط أنشطة ونمط الدعم.",
      "اعتماد هذه النتائج في التوجيه والإرشاد.",
    ],
    secGeneral: "معطيات عامة حول التقويم التشخيصي:",
    colLevel: "المستوى",
    colDate: "تاريخ الإجراء",
    colTotal: "العدد الإجمالي",
    colPresent: "الحاضرون",
    note: "ملاحظة:",
    secDistribution: "تفييئ المتعلمين حسب نتائج التقويم التشخيصي:",
    colCategory: "الفئة",
    colCount: "العدد",
    colPct: "النسبة (من الحاضرين)",
    bands: ["النقطة أقل من 5 على عشرين.", "ما بين 5 و 10.", "ما بين 10 و 15.", "ما بين 15 و 20."],
    total: "المجموع",
    secSupport: "أساليب الدعم وطرق المعالجة المعتمدة:",
    sigTeacher: "توقيع الأستاذ",
    sigDirector: "توقيع السيد المدير",
    sigInspector: "توقيع السيد المفتش",
    noData: "لا توجد نقط مسجلة",
  },
  fr: {
    title: "Rapport des évaluations diagnostiques",
    season: "Année scolaire",
    institution: "Établissement",
    teacher: "Enseignant(e)",
    subject: "Matière",
    secObjectives: "Objectifs de l'évaluation diagnostique :",
    objectives: [
      "Identifier les points forts et les points faibles des apprentissages antérieurs des élèves.",
      "Déterminer les difficultés et les obstacles d'apprentissage et motiver les élèves à les surmonter.",
      "Exploiter les résultats de l'évaluation diagnostique pour planifier les activités et le type de soutien.",
      "S'appuyer sur ces résultats pour l'orientation et l'accompagnement.",
    ],
    secGeneral: "Données générales sur l'évaluation diagnostique :",
    colLevel: "Niveau / classe",
    colDate: "Date de passation",
    colTotal: "Effectif total",
    colPresent: "Présents",
    note: "Remarque :",
    secDistribution: "Répartition des élèves selon les résultats de l'évaluation diagnostique :",
    colCategory: "Catégorie",
    colCount: "Effectif",
    colPct: "Pourcentage (des présents)",
    bands: ["Note inférieure à 5 sur 20.", "Entre 5 et 10.", "Entre 10 et 15.", "Entre 15 et 20."],
    total: "Total",
    secSupport: "Méthodes de soutien et de remédiation adoptées :",
    sigTeacher: "Signature de l'enseignant(e)",
    sigDirector: "Signature du directeur",
    sigInspector: "Signature de l'inspecteur",
    noData: "Aucune note saisie",
  },
  en: {
    title: "Diagnostic Assessments Report",
    season: "School year",
    institution: "School",
    teacher: "Teacher",
    subject: "Subject",
    secObjectives: "Objectives of the diagnostic assessment:",
    objectives: [
      "Identify the strengths and weaknesses in students' prior learning.",
      "Determine learning difficulties and obstacles and motivate students to overcome them.",
      "Use the diagnostic results to plan support activities and the type of remediation.",
      "Rely on these results for guidance and counselling.",
    ],
    secGeneral: "General data on the diagnostic assessment:",
    colLevel: "Level / class",
    colDate: "Date taken",
    colTotal: "Total enrolled",
    colPresent: "Present",
    note: "Note:",
    secDistribution: "Distribution of students according to the diagnostic results:",
    colCategory: "Category",
    colCount: "Count",
    colPct: "Percentage (of present)",
    bands: ["Score below 5 out of 20.", "Between 5 and 10.", "Between 10 and 15.", "Between 15 and 20."],
    total: "Total",
    secSupport: "Support and remediation methods adopted:",
    sigTeacher: "Teacher's signature",
    sigDirector: "Principal's signature",
    sigInspector: "Inspector's signature",
    noData: "No grades entered",
  },
};

const ROMAN = ["I", "II", "III", "IV"];

/* ───────────── Textes dynamiques par défaut ───────────── */

export function defaultTemplate2Intro(config: DiagnosticConfig, classes: DiagnosticClass[], lang: DiagLang): string {
  const year = config.annee_scolaire || "";
  const period = config.periode_diagnostic || "";
  if (lang === "ar") {
    return `في سياق الدخول المدرسي للموسم الدراسي (${year})، تم استقبال وتشخيص المكتسبات القبلية للمتعلمين والمتعلمات خلال الفترة ${period}، حيث تم تمرير روائز التقويمات التشخيصية للتلاميذ وذلك خلال الحصص الدراسية الأولى لتلاميذ الأقسام الدراسية المسندة التالية:`;
  }
  if (lang === "en") {
    return `As part of the start of the ${year} school year, students' prior learning was assessed during the period ${period}. The diagnostic tests were administered during the first lessons to the students of the following assigned classes:`;
  }
  return `Dans le cadre de la rentrée scolaire (${year}), les acquis antérieurs des élèves ont été diagnostiqués durant la période du ${period}. Les tests d'évaluation diagnostique ont été passés lors des premières séances par les élèves des classes suivantes :`;
}

export function defaultTemplate2Support(lang: DiagLang): string {
  if (lang === "ar") {
    return "إن النتائج المحصل عليها أعلاه خلال مرحلة تفييئ المتعلمين تعكس مجموعة من التعثرات ونقط الضعف لدى عدد من المتعلمين. وعليه، تم تخصيص حصص لتصحيح التقويم التشخيصي وكذلك للدعم والتذكير بمجموعة من الفقرات التي تمت دراستها خلال السنوات الماضية وكذلك بعض القواعد الأساسية. كما سيتم العمل على الدعم المندمج من خلال تصحيح التعثرات ودعم المكتسبات خلال كل مرحلة أو درس بالنسبة للكفايات المرحلية المرتبطة بدرس معين، وعلى طول الموسم الدراسي للكفايات الممتدة. ويمكن إضافة حصص أخرى للدعم خارج استعمال زمن التلاميذ كلما سنحت الفرصة أو دعت الضرورة إلى ذلك.";
  }
  if (lang === "en") {
    return "The results obtained above when grouping the students reveal a number of difficulties and weaknesses for many of them. Sessions have therefore been devoted to correcting the diagnostic test and to reviewing key topics studied in previous years as well as some basic rules. Integrated support will also be provided by correcting difficulties and consolidating learning at each stage or lesson for the competencies linked to a given lesson, and throughout the school year for the extended competencies. Additional support sessions outside the students' timetable may be added whenever the opportunity arises or the need is felt.";
  }
  return "Les résultats obtenus ci-dessus lors de la catégorisation des élèves reflètent un ensemble de difficultés et de lacunes chez un nombre important d'entre eux. Des séances ont donc été consacrées à la correction de l'évaluation diagnostique, ainsi qu'au soutien et au rappel de notions étudiées les années précédentes et de quelques règles de base. Un soutien intégré sera également assuré en corrigeant les difficultés et en consolidant les acquis à chaque étape ou leçon pour les compétences liées à une leçon donnée, et tout au long de l'année pour les compétences étendues. D'autres séances de soutien en dehors de l'emploi du temps des élèves pourront être ajoutées chaque fois que l'occasion se présente ou que la nécessité l'impose.";
}

export function defaultTemplate2Remark(absentPct: number, lang: DiagLang): string {
  const p = formatPct(absentPct, lang, 0);
  const strong = absentPct >= 20;
  if (lang === "ar") {
    return strong
      ? `عرفت فترة تمرير روائز التقويم التشخيصي غيابا مهما للمتعلمين والمتعلمات (${p} من العدد الإجمالي)، ويُعزى ذلك أساسا إلى عدم استقرار البنية التربوية خلال بداية الموسم الدراسي.`
      : `بلغت نسبة غياب المتعلمين والمتعلمات خلال فترة تمرير روائز التقويم التشخيصي ${p} من العدد الإجمالي.`;
  }
  if (lang === "en") {
    return strong
      ? `The diagnostic testing period saw a high level of student absence (${p} of the total enrolment), mainly due to the instability of class structures at the start of the school year.`
      : `The student absence rate during the diagnostic testing period was ${p} of the total enrolment.`;
  }
  return strong
    ? `La période de passation des tests diagnostiques a connu une absence importante des élèves (${p} de l'effectif total), due principalement à l'instabilité de la structure pédagogique en début d'année.`
    : `Le taux d'absence des élèves durant la période de passation des tests diagnostiques s'élève à ${p} de l'effectif total.`;
}

/* ───────────── Helpers ───────────── */

function formatPct(v: number, lang: DiagLang, digits = 1): string {
  const s = v.toFixed(digits);
  return `${lang === "en" ? s : s.replace(".", ",")}%`;
}

function formatClassDate(d: string): string {
  if (!d) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d.replace(/-/g, "/");
}

function computeBands(cls: DiagnosticClass): ClassBand {
  const bands: [number, number, number, number] = [0, 0, 0, 0];
  let present = 0;
  for (const s of cls.students || []) {
    const v = parseNoteValue(s.note);
    if (v === null) continue;
    present++;
    if (v < 5) bands[0]++;
    else if (v < 10) bands[1]++;
    else if (v < 15) bands[2]++;
    else bands[3]++;
  }
  return { nom: cls.nom, date: cls.date, total: (cls.students || []).length, present, bands };
}

/* ───────────── Pagination (hauteurs estimées en mm) ───────────── */

type Block =
  | { kind: "header" }
  | { kind: "intro" }
  | { kind: "objectives" }
  | { kind: "general" }
  | { kind: "distTitle" }
  | { kind: "class"; band: ClassBand }
  | { kind: "support" }
  | { kind: "signatures" };

/* ═══════════════════════════════ Composant ═══════════════════════════════ */

export const DiagnosticReportTemplate2: React.FC<Props> = ({ config, classes, lang = "ar" }) => {
  const t = TXT[lang] || TXT.fr;
  const isRtl = lang === "ar";
  const cfg = config as DiagnosticConfig & { rapport2_intro?: string; rapport2_soutien?: string; rapport2_remarque?: string };

  const bands = React.useMemo(() => classes.map(computeBands), [classes]);
  const totalAll = bands.reduce((s, b) => s + b.total, 0);
  const presentAll = bands.reduce((s, b) => s + b.present, 0);
  const absentPct = totalAll ? ((totalAll - presentAll) / totalAll) * 100 : 0;

  const intro = (cfg.rapport2_intro || "").trim() || defaultTemplate2Intro(config, classes, lang);
  const support = (cfg.rapport2_soutien || "").trim() || defaultTemplate2Support(lang);
  const remark = (cfg.rapport2_remarque || "").trim() || defaultTemplate2Remark(absentPct, lang);

  // Blocs du rapport, dans l'ordre
  const blocks = React.useMemo<Block[]>(() => [
    { kind: "header" },
    { kind: "intro" },
    { kind: "objectives" },
    { kind: "general" },
    { kind: "distTitle" },
    ...bands.map((band) => ({ kind: "class" as const, band })),
    { kind: "support" },
    { kind: "signatures" },
  ], [bands]);

  // Pagination mesurée : chaque bloc est rendu une fois hors écran à la largeur réelle
  // de la page, puis les blocs sont répartis sur des pages A4 sans débordement.
  const measureRef = React.useRef<HTMLDivElement>(null);
  const [pages, setPages] = React.useState<Block[][] | null>(null);
  const [fontsTick, setFontsTick] = React.useState(0);
  React.useEffect(() => {
    // Re-mesurer une fois les polices chargées (les hauteurs de texte changent)
    const fonts = (document as any).fonts;
    if (fonts && fonts.ready && typeof fonts.ready.then === "function") {
      fonts.ready.then(() => setFontsTick((n) => n + 1)).catch(() => undefined);
    }
  }, []);
  const contentKey = `${lang}|${intro}|${support}|${remark}|${JSON.stringify(bands)}|${config.lycee}|${config.nom_enseignant}|${config.matiere}|${config.annee_scolaire}`;

  React.useLayoutEffect(() => {
    const root = measureRef.current;
    if (!root) return;
    const frame = root.querySelector(".t2-frame") as HTMLElement | null;
    if (!frame) return;
    const MM = 96 / 25.4;
    // Hauteur utile du cadre : 297mm − marges de page (2 × 10mm) − bordure/rembourrage du cadre
    const available = 297 * MM - 20 * MM - 10 * MM - 8;
    const els = Array.from(frame.children) as HTMLElement[];
    const heights = els.map((el) => {
      const cs = window.getComputedStyle(el);
      return el.getBoundingClientRect().height + parseFloat(cs.marginTop || "0") + parseFloat(cs.marginBottom || "0");
    });
    const out: Block[][] = [[]];
    let used = 0;
    blocks.forEach((b, i) => {
      const h = heights[i] || 0;
      // Garder le titre de la section III avec le premier tableau de classe
      const need = b.kind === "distTitle" && blocks[i + 1]?.kind === "class" ? h + (heights[i + 1] || 0) : h;
      if (used + need > available && out[out.length - 1].length > 0) {
        out.push([]);
        used = 0;
      }
      out[out.length - 1].push(b);
      used += h;
    });
    setPages(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey, blocks, fontsTick]);

  const renderBlock = (b: Block, key: number) => {
    switch (b.kind) {
      case "header":
        return (
          <div key={key} className="t2-header">
            <div className="t2-header-cell t2-header-ministry">
              <img
                src="/assets/header_logo.png"
                alt=""
                className="t2-logo"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
              <div className="t2-small">{config.academie}</div>
              <div className="t2-small">{config.direction}</div>
            </div>
            <div className="t2-header-cell t2-header-title">
              <div className="t2-title">{t.title}</div>
              <div className="t2-season"><b>{t.season} :</b> {config.annee_scolaire}</div>
            </div>
            <div className="t2-header-cell t2-header-info">
              <div><b className="t2-label">{t.institution} :</b> {config.lycee}</div>
              <div><b className="t2-label">{t.teacher} :</b> {config.nom_enseignant}</div>
              <div><b className="t2-label">{t.subject} :</b> {config.matiere}</div>
            </div>
          </div>
        );
      case "intro":
        return (
          <div key={key} className="t2-block">
            <p className="t2-para">{intro}</p>
            <ul className="t2-classes">
              {bands.map((c, i) => <li key={i}>{c.nom}</li>)}
            </ul>
          </div>
        );
      case "objectives":
        return (
          <div key={key} className="t2-block">
            <div className="t2-section"><span className="t2-roman">{ROMAN[0]}.</span> <u>{t.secObjectives}</u></div>
            <ul className="t2-list">
              {t.objectives.map((o, i) => <li key={i}>{o}</li>)}
            </ul>
          </div>
        );
      case "general":
        return (
          <div key={key} className="t2-block">
            <div className="t2-section"><span className="t2-roman">{ROMAN[1]}.</span> <u>{t.secGeneral}</u></div>
            <table className="t2-table">
              <thead>
                <tr>
                  <th>{t.colLevel}</th>
                  <th>{t.colDate}</th>
                  <th>{t.colTotal}</th>
                  <th className="t2-yellow">{t.colPresent}</th>
                </tr>
              </thead>
              <tbody>
                {bands.map((c, i) => (
                  <tr key={i}>
                    <td className="t2-start">{c.nom}</td>
                    <td>{formatClassDate(c.date)}</td>
                    <td>{c.total}</td>
                    <td className="t2-yellow t2-bold">{c.present}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="t2-remark"><b>{t.note}</b> {remark}</p>
          </div>
        );
      case "distTitle":
        return (
          <div key={key} className="t2-section"><span className="t2-roman">{ROMAN[2]}.</span> <u>{t.secDistribution}</u></div>
        );
      case "class": {
        const c = b.band;
        const p = c.bands.map((n) => (c.present ? (n / c.present) * 100 : 0));
        const below = p[0] + p[1];
        const above = p[2] + p[3];
        return (
          <div key={key} className="t2-block t2-class">
            <div className="t2-class-title">• {c.nom}</div>
            <table className="t2-table">
              <thead>
                <tr>
                  <th style={{ width: "40%" }}>{t.colCategory}</th>
                  <th style={{ width: "25%" }}>{t.colCount}</th>
                  <th colSpan={2}>{t.colPct}</th>
                </tr>
              </thead>
              <tbody>
                {c.present === 0 ? (
                  <tr><td colSpan={4} className="t2-muted">{t.noData}</td></tr>
                ) : (
                  t.bands.map((label, i) => (
                    <tr key={i}>
                      <td className={`t2-start t2-bold ${i === 0 ? "t2-orange" : i === 1 ? "t2-amber" : i === 2 ? "t2-green" : ""}`}>{label}</td>
                      <td className={`t2-bold ${i === 0 ? "t2-orange" : i === 1 ? "t2-amber" : i === 2 ? "t2-green" : ""}`}>{c.bands[i]}</td>
                      <td className={`t2-bold ${i === 0 ? "t2-orange" : i === 1 ? "t2-amber" : i === 2 ? "t2-green" : ""}`}>{formatPct(p[i], lang)}</td>
                      {i === 0 && <td rowSpan={2} className="t2-bold t2-orange t2-merged">{formatPct(below, lang)}</td>}
                      {i === 2 && <td rowSpan={2} className="t2-bold t2-green t2-merged">{formatPct(above, lang)}</td>}
                    </tr>
                  ))
                )}
                <tr>
                  <td className="t2-start t2-bold">{t.total}</td>
                  <td className="t2-bold">{c.present}</td>
                  <td colSpan={2} className="t2-bold">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      }
      case "support":
        return (
          <div key={key} className="t2-block">
            <div className="t2-section"><span className="t2-roman">{ROMAN[3]}.</span> <u>{t.secSupport}</u></div>
            <p className="t2-para t2-justify">{support}</p>
          </div>
        );
      case "signatures":
        return (
          <table key={key} className="t2-table t2-sign">
            <thead>
              <tr>
                <th>{t.sigTeacher}</th>
                <th>{t.sigDirector}</th>
                <th>{t.sigInspector}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="t2-sign-cell"><div className="t2-bold">{config.nom_enseignant}</div></td>
                <td className="t2-sign-cell" />
                <td className="t2-sign-cell" />
              </tr>
            </tbody>
          </table>
        );
    }
  };

  return (
    <div
      id="diagnostic-official-report"
      className="diagnostic-print-root text-black bg-slate-100 dark:bg-slate-900 py-6 print:py-0 print:bg-white flex flex-col items-center"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        @media print {
          nav, header, aside, .no-print, [data-no-print], button { display: none !important; }
          body, html { margin: 0 !important; padding: 0 !important; background: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .diag-a4-page { box-shadow: none !important; margin: 0 !important; height: 297mm !important; page-break-after: always !important; break-after: page !important; }
          .diag-a4-page:last-child { page-break-after: auto !important; break-after: auto !important; }
        }
        .pdf-export-mode { padding: 0 !important; margin: 0 !important; background: #fff !important; }
        .pdf-export-mode .diag-a4-page { margin: 0 !important; box-shadow: none !important; height: 296.5mm !important; min-height: 296.5mm !important; max-height: 296.5mm !important; page-break-after: always !important; break-after: page !important; }
        .pdf-export-mode .diag-a4-page:last-child { page-break-after: auto !important; break-after: auto !important; }
        .diag-a4-page {
          width: 210mm; height: 297mm; min-height: 297mm; max-height: 297mm;
          padding: 10mm 12mm; margin: 0 auto 30px auto; background: #fff; box-sizing: border-box;
          font-family: 'Times New Roman', 'Amiri', serif; color: #000; overflow: hidden;
          box-shadow: 0 4px 18px rgba(0,0,0,0.18); position: relative;
        }
        .t2-frame { border: 2.5px double #000; height: 100%; box-sizing: border-box; padding: 5mm 7mm; overflow: hidden; }
        .t2-header { display: -webkit-box; display: flex; border: 1.5px solid #000; margin-bottom: 3mm; }
        .t2-header-cell { padding: 2mm 3mm; box-sizing: border-box; }
        .t2-header-ministry { width: 33%; text-align: center; }
        .t2-header-title { width: 34%; text-align: center; border-left: 1.5px solid #000; border-right: 1.5px solid #000; display: -webkit-box; display: flex; -webkit-box-orient: vertical; flex-direction: column; justify-content: center; }
        .t2-header-info { width: 33%; font-size: 10.5pt; line-height: 1.45; display: -webkit-box; display: flex; -webkit-box-orient: vertical; flex-direction: column; justify-content: center; }
        .t2-logo { width: 100%; height: auto; max-height: 15mm; object-fit: contain; display: block; margin: 0 auto 1mm auto; }
        .t2-small { font-size: 7.5pt; font-weight: bold; line-height: 1.25; }
        .t2-title { font-size: 14pt; font-weight: bold; text-decoration: underline; text-underline-offset: 3px; line-height: 1.3; }
        .t2-season { font-size: 10.5pt; margin-top: 1.5mm; white-space: nowrap; }
        .t2-label { text-decoration: underline; }
        .t2-block { margin-bottom: 2mm; }
        .t2-para { font-size: 11pt; line-height: 1.45; margin: 0 0 1.5mm 0; text-indent: 6mm; }
        .t2-justify { text-align: justify; }
        .t2-classes, .t2-list { margin: 0; padding: 0 9mm; font-size: 11pt; line-height: 1.4; list-style: none; }
        .t2-classes li::before, .t2-list li::before { content: "-  "; }
        .t2-section { font-size: 13pt; font-weight: bold; margin: 1.5mm 0 1.2mm 0; }
        .t2-roman { display: inline-block; min-width: 9mm; }
        .t2-table { width: 100%; border-collapse: collapse; font-size: 10.5pt; margin-top: 0.5mm; }
        .t2-table th, .t2-table td { border: 1px solid #000; padding: 0.45mm 2mm; text-align: center; line-height: 1.3; }
        .t2-table th { font-weight: bold; text-decoration: underline; text-underline-offset: 2px; }
        .t2-start { text-align: ${isRtl ? "right" : "left"} !important; }
        .t2-bold { font-weight: bold; }
        .t2-muted { color: #555; font-style: italic; }
        .t2-yellow { background: #ffff00; }
        .t2-orange { background: #f79646; }
        .t2-amber { background: #ffc000; }
        .t2-green { background: #92d050; }
        .t2-merged { font-size: 11.5pt; }
        .t2-remark { margin: 1.5mm 0 0 0; font-size: 10.5pt; font-weight: bold; background: #ffff00; display: inline; line-height: 1.7; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
        .t2-class { margin-bottom: 2.5mm; page-break-inside: avoid; break-inside: avoid; }
        .t2-class-title { font-size: 11.5pt; font-weight: bold; text-decoration: underline; margin: 0 2mm 1mm 2mm; }
        .t2-sign { margin-top: 5mm; }
        .t2-sign-cell { height: 32mm; vertical-align: top; padding-top: 2mm !important; }
      `}</style>

      {/* Mesure hors écran (non imprimée) */}
      <div
        ref={measureRef}
        aria-hidden="true"
        className="no-print"
        style={{ position: "absolute", visibility: "hidden", pointerEvents: "none", left: -10000, top: 0 }}
      >
        <div className="diag-a4-page" style={{ height: "auto", maxHeight: "none", minHeight: 0 }}>
          <div className="t2-frame" style={{ height: "auto" }}>
            {blocks.map((b, i) => renderBlock(b, i))}
          </div>
        </div>
      </div>

      {(pages || [blocks]).map((pageBlocks, pi) => (
        <div key={pi} className="diag-a4-page">
          <div className="t2-frame">
            {pageBlocks.map((b, i) => renderBlock(b, pi * 100 + i))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default DiagnosticReportTemplate2;

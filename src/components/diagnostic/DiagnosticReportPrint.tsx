import React from "react";
import { DiagnosticConfig } from "@/lib/diagnosticStorage";
import { GlobalDiagnosticStats } from "@/lib/diagnosticStatsEngine";
import {
  DiagLang,
  DIAGNOSTIC_TRANSLATIONS,
  generateStatisticalCommentary,
  translateAppreciation
} from "@/lib/diagnosticTranslations";

interface DiagnosticReportPrintProps {
  config: DiagnosticConfig;
  stats: GlobalDiagnosticStats;
  lang?: DiagLang;
  includeGraphs?: boolean;
  selectedClassesNames?: string[];
}

// Formatage adapté de la période
function formatDiagnosticPeriod(period: string, lang: DiagLang): string {
  if (!period) return "";
  if (lang === "ar") {
    let res = period
      .replace(/202601/g, "2024")
      .replace(/2026/g, "2024")
      .replace(/\bau\b/gi, "إلى")
      .replace(/\bdu\b/gi, "من")
      .replace(/octobre/gi, "أكتوبر")
      .replace(/septembre/gi, "شتنبر")
      .replace(/novembre/gi, "نونبر")
      .replace(/décembre|decembre/gi, "دجنبر");
    
    if (!res.trim().startsWith("من")) {
      res = `من ${res.trim()}`;
    }
    return res;
  }
  if (lang === "en") {
    return period
      .replace(/202601/g, "2024")
      .replace(/2026/g, "2024")
      .replace(/\bau\b/gi, "to")
      .replace(/\bdu\b/gi, "from")
      .replace(/octobre/gi, "October")
      .replace(/septembre/gi, "September");
  }
  return period.replace(/202601/g, "2024").replace(/2026/g, "2024");
}

// Détection intelligente du niveau scolaire selon le nom de classe
function getLevelForClass(className: string | undefined, defaultNiveau: string, lang: DiagLang): string {
  if (!className) {
    if (lang === "ar" && (defaultNiveau.includes("2BPCF") || defaultNiveau.includes("2BSVT"))) {
      return "الثانية باكالوريا علوم تجريبية (PC / SVT)";
    }
    return defaultNiveau;
  }

  const upper = className.toUpperCase().trim();
  if (upper.startsWith("1BAC") || upper.startsWith("1 BAC")) {
    if (lang === "ar") return "الأولى باكالوريا علوم تجريبية";
    if (lang === "en") return "1st Year Baccalaureate Experimental Sciences";
    return "1ère Année Bac Sciences Expérimentales";
  }
  if (upper.startsWith("TCLSH") || upper.startsWith("TC-LSH") || upper.startsWith("TCL")) {
    if (lang === "ar") return "الجذع المشترك للآداب والعلوم الإنسانية";
    if (lang === "en") return "Common Core Humanities";
    return "Tronc Commun Lettres et Sciences Humaines";
  }
  if (upper.startsWith("TCS") || upper.startsWith("TC-S") || upper.startsWith("TCST")) {
    if (lang === "ar") return "الجذع المشترك العلمي";
    if (lang === "en") return "Common Core Science";
    return "Tronc Commun Scientifique";
  }
  if (upper.startsWith("2BAC") || upper.startsWith("2 BAC") || upper.startsWith("2BPC") || upper.startsWith("2BSVT")) {
    if (lang === "ar") return "الثانية باكالوريا علوم تجريبية (PC / SVT)";
    if (lang === "en") return "2nd Year Baccalaureate Experimental Sciences (PC/SVT)";
    return "2ème Année Bac Sciences Expérimentales (PC / SVT)";
  }

  if (lang === "ar" && (defaultNiveau.includes("2BPCF") || defaultNiveau.includes("2BSVT"))) {
    return "الثانية باكالوريا علوم تجريبية (PC / SVT)";
  }
  return defaultNiveau;
}

// Traduction du libellé d'absence
function getAbsentLabel(text: string, lang: DiagLang): string {
  if (!text) return "";
  if (text.toLowerCase().includes("absence")) {
    if (lang === "ar") return "غياب جماعي";
    if (lang === "en") return "Class Absence";
    return "Absence de groupe";
  }
  return text;
}

export const DiagnosticReportPrint: React.FC<DiagnosticReportPrintProps> = ({
  config,
  stats,
  lang = "fr",
  includeGraphs = false,
  selectedClassesNames = []
}) => {
  const t = DIAGNOSTIC_TRANSLATIONS[lang] || DIAGNOSTIC_TRANSLATIONS.fr;
  const isRtl = lang === "ar";

  // Noms et libellés des 4 tranches selon la langue choisie
  const tranches = React.useMemo(() => {
    if (lang === "ar") {
      return {
        t1: "المتعثرون",
        t2: "المسايرون",
        t3: "المتفوقون",
        t4: "المتميزون",
        r1: "[ 0 – 8 ]",
        r2: "[ 8 – 12 ]",
        r3: "[ 12 – 14 ]",
        r4: "[ 14 – 20 ]"
      };
    }
    if (lang === "en") {
      return {
        t1: "Struggling",
        t2: "Progressing",
        t3: "Proficient",
        t4: "Exemplary",
        r1: "[0 – 8]",
        r2: "[8 – 12]",
        r3: "[12 – 14]",
        r4: "[14 – 20]"
      };
    }
    return {
      t1: "En difficulté",
      t2: "En progression",
      t3: "Maîtrise satisfaisante",
      t4: "Excellence",
      r1: "[0 – 8]",
      r2: "[8 – 12]",
      r3: "[12 – 14]",
      r4: "[14 – 20]"
    };
  }, [lang]);

  // Libellé adapté des classes concernées
  const classesText = React.useMemo(() => {
    if (selectedClassesNames && selectedClassesNames.length > 0) {
      if (selectedClassesNames.length === 1) {
        if (lang === "ar") return `قسم ${selectedClassesNames[0]}`;
        if (lang === "en") return `class ${selectedClassesNames[0]}`;
        return `la classe de ${selectedClassesNames[0]}`;
      } else {
        if (lang === "ar") return `أقسام ${selectedClassesNames.join(" و ")}`;
        if (lang === "en") return `classes ${selectedClassesNames.join(", ")}`;
        return `les classes de ${selectedClassesNames.slice(0, -1).join(", ")} et ${selectedClassesNames[selectedClassesNames.length - 1]}`;
      }
    }
    return config.classes_concernees || (lang === "ar" ? "جميع الفصول" : "l'ensemble des classes");
  }, [selectedClassesNames, config.classes_concernees, lang]);

  // Titre du rapport officiel
  const reportMainTitle = React.useMemo(() => {
    const suffix = selectedClassesNames.length === 1
      ? selectedClassesNames[0]
      : (selectedClassesNames.length > 1
          ? selectedClassesNames.join(", ")
          : (lang === "ar" ? "جميع الفصول" : "Toutes les classes"));

    if (lang === "ar") return `تقرير التقويم التشخيصي – ${suffix}`;
    if (lang === "en") return `Diagnostic Evaluation Report – ${suffix}`;
    return `Rapport d’évaluation diagnostique – ${suffix}`;
  }, [selectedClassesNames, lang]);

  // Niveau affiché
  const displayedLevel = React.useMemo(() => {
    return getLevelForClass(
      selectedClassesNames && selectedClassesNames.length > 0 ? selectedClassesNames[0] : undefined,
      config.niveau,
      lang
    );
  }, [selectedClassesNames, config.niveau, lang]);

  // Matière affichée
  const displayedSubject = React.useMemo(() => {
    const raw = (config.matiere || "Mathématique").trim();
    if (lang === "ar") {
      if (/math/i.test(raw)) return "الرياضيات";
      if (/physique|pc/i.test(raw)) return "الفيزياء والكيمياء";
      if (/svt/i.test(raw)) return "علوم الحياة والأرض";
      if (/arabe/i.test(raw)) return "اللغة العربية";
      if (/fran/i.test(raw)) return "اللغة الفرنسية";
      if (/anglais|eng/i.test(raw)) return "اللغة الإنجليزية";
      if (/philo/i.test(raw)) return "الفلسفة";
      return raw;
    }
    if (lang === "en") {
      if (/math/i.test(raw)) return "Mathematics";
      return raw;
    }
    return /math/i.test(raw) ? "Mathématiques" : raw;
  }, [config.matiere, lang]);

  // Période affichée
  const displayedPeriod = React.useMemo(() => {
    return formatDiagnosticPeriod(config.periode_diagnostic, lang);
  }, [config.periode_diagnostic, lang]);

  // Nombre d'exercices en lettres
  const displayedNumExercises = React.useMemo(() => {
    const raw = (config.nombre_exercices_texte || "quatre").trim().toLowerCase();
    if (lang === "ar") {
      if (raw === "quatre" || raw === "4") return "أربعة";
      if (raw === "trois" || raw === "3") return "ثلاثة";
      if (raw === "cinq" || raw === "5") return "خمسة";
      if (raw === "six" || raw === "6") return "ستة";
      if (raw === "deux" || raw === "2") return "تمرينين";
      return raw;
    }
    if (lang === "en") {
      if (raw === "quatre" || raw === "4") return "four";
      if (raw === "trois" || raw === "3") return "three";
      if (raw === "cinq" || raw === "5") return "five";
      if (raw === "six" || raw === "6") return "six";
      return raw;
    }
    return config.nombre_exercices_texte || "quatre";
  }, [config.nombre_exercices_texte, lang]);

  // Appréciation traduite
  const displayedAppreciation = React.useMemo(() => {
    const raw = config.appreciation_globale || stats.default_appreciation;
    return translateAppreciation(raw, lang);
  }, [config.appreciation_globale, stats.default_appreciation, lang]);

  // Listes dynamiques d'observations, propositions et exercices
  const displayedObservations = React.useMemo(() => {
    if (lang === "ar") {
      const hasCustomArabic = config.observations.some(obs => /[\u0600-\u06FF]/.test(obs));
      return hasCustomArabic ? config.observations : t.defaultObservations;
    }
    if (lang === "en") {
      const hasCustomEnglish = config.observations.some(obs => /[a-zA-Z]/.test(obs) && !obs.includes("apprenants"));
      return hasCustomEnglish ? config.observations : t.defaultObservations;
    }
    return config.observations && config.observations.length > 0 ? config.observations : t.defaultObservations;
  }, [config.observations, lang, t]);

  const displayedPropositions = React.useMemo(() => {
    if (lang === "ar") {
      const hasCustomArabic = config.propositions.some(p => /[\u0600-\u06FF]/.test(p));
      return hasCustomArabic ? config.propositions : t.defaultPropositions;
    }
    if (lang === "en") {
      const hasCustomEnglish = config.propositions.some(p => /[a-zA-Z]/.test(p) && !p.includes("apprenants"));
      return hasCustomEnglish ? config.propositions : t.defaultPropositions;
    }
    return config.propositions && config.propositions.length > 0 ? config.propositions : t.defaultPropositions;
  }, [config.propositions, lang, t]);

  const displayedExercises = React.useMemo(() => {
    if (lang === "ar") {
      const hasCustomArabic = config.exercices.some(ex => /[\u0600-\u06FF]/.test(ex.description));
      return hasCustomArabic ? config.exercices : t.defaultExercises;
    }
    if (lang === "en") {
      return t.defaultExercises;
    }
    return config.exercices && config.exercices.length > 0 ? config.exercices : t.defaultExercises;
  }, [config.exercices, lang, t]);

  // Analyse statistique pédagogique approfondie
  const analysisCommentary = React.useMemo(() => {
    if (!includeGraphs) return null;
    return generateStatisticalCommentary(stats, lang, selectedClassesNames);
  }, [includeGraphs, stats, lang, selectedClassesNames]);

  // Totaux des tranches
  const totalPresentsNum = parseInt(stats.total_presents || "0", 10);
  const totalT1 = stats.classes_stats.reduce((acc, s) => acc + s.t1_count, 0);
  const totalT2 = stats.classes_stats.reduce((acc, s) => acc + s.t2_count, 0);
  const totalT3 = stats.classes_stats.reduce((acc, s) => acc + s.t3_count, 0);
  const totalT4 = stats.classes_stats.reduce((acc, s) => acc + s.t4_count, 0);

  const pctT1 = totalPresentsNum > 0 ? Math.round((totalT1 / totalPresentsNum) * 100) : 0;
  const pctT2 = totalPresentsNum > 0 ? Math.round((totalT2 / totalPresentsNum) * 100) : 0;
  const pctT3 = totalPresentsNum > 0 ? Math.round((totalT3 / totalPresentsNum) * 100) : 0;
  const pctT4 = totalPresentsNum > 0 ? Math.round((totalT4 / totalPresentsNum) * 100) : 0;

  // Calcul moyenne générale
  const validAvgs = stats.classes_stats.map(s => s.average_note).filter(n => n > 0);
  const generalAvg = validAvgs.length > 0
    ? (validAvgs.reduce((a, b) => a + b, 0) / validAvgs.length).toFixed(2)
    : "0.00";

  // Donut chart geometry (compact et net)
  const generatePieSlices = () => {
    const data = [
      { pct: pctT1, count: totalT1, color: "#dc2626", label: tranches.t1 },
      { pct: pctT2, count: totalT2, color: "#d97706", label: tranches.t2 },
      { pct: pctT3, count: totalT3, color: "#2563eb", label: tranches.t3 },
      { pct: pctT4, count: totalT4, color: "#059669", label: tranches.t4 }
    ];

    const cx = 50;
    const cy = 50;
    const r = 44;
    const innerR = 24;

    let cumulativeAngle = -Math.PI / 2;
    const slices: Array<{ path: string; color: string; pct: number }> = [];

    data.forEach(item => {
      if (item.pct <= 0) return;
      const angle = (item.pct / 100) * 2 * Math.PI;
      const x1 = cx + r * Math.cos(cumulativeAngle);
      const y1 = cy + r * Math.sin(cumulativeAngle);
      const x2 = cx + r * Math.cos(cumulativeAngle + angle);
      const y2 = cy + r * Math.sin(cumulativeAngle + angle);

      const ix1 = cx + innerR * Math.cos(cumulativeAngle + angle);
      const iy1 = cy + innerR * Math.sin(cumulativeAngle + angle);
      const ix2 = cx + innerR * Math.cos(cumulativeAngle);
      const iy2 = cy + innerR * Math.sin(cumulativeAngle);

      const largeArc = angle > Math.PI ? 1 : 0;
      const path = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2} Z`;

      slices.push({ path, color: item.color, pct: item.pct });
      cumulativeAngle += angle;
    });

    return slices;
  };

  const pieSlices = generatePieSlices();

  return (
    <div
      id="diagnostic-official-report"
      className="diagnostic-print-root text-black bg-slate-100 dark:bg-slate-900 py-6 print:py-0 print:bg-white flex flex-col items-center"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Styles d'impression et d'export PDF stricts A4 */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          #diagnostic-official-report, #diagnostic-official-report * {
            visibility: visible !important;
          }
          #diagnostic-official-report {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          nav, header, aside, .no-print, button {
            display: none !important;
          }
          body, html {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .diag-a4-page {
            box-shadow: none !important;
            margin: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .diag-a4-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }

        /* MODE EXPORT PDF STRICT — Annule tous les paddings/marges d'aperçu écran */
        .pdf-export-mode {
          padding: 0 !important;
          margin: 0 !important;
          background: #ffffff !important;
          box-shadow: none !important;
        }
        .pdf-export-mode .diag-a4-page {
          margin: 0 !important;
          box-shadow: none !important;
          width: 210mm !important;
          height: 296.5mm !important;
          min-height: 296.5mm !important;
          max-height: 296.5mm !important;
          page-break-after: always !important;
          break-after: page !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .pdf-export-mode .diag-a4-page:last-child {
          page-break-after: auto !important;
          break-after: auto !important;
        }

        .diag-a4-page {
          width: 210mm;
          min-height: 297mm;
          height: 297mm;
          max-height: 297mm;
          padding: 10mm 15mm 10mm 15mm;
          margin: 0 auto 30px auto;
          position: relative;
          background: #ffffff;
          box-sizing: border-box;
          font-family: 'Times New Roman', 'Amiri', serif;
          color: #000000;
          overflow: hidden;
          box-shadow: 0 4px 18px rgba(0,0,0,0.18);
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
        }

        /* PAGE 1 TYPOGRAPHIE & ESPACEMENTS HARMONIEUX */
        .diag-header-box {
          border: 1.5px solid #000000;
          padding: 4px 10px;
          text-align: center;
          margin-bottom: 7px;
          background: #ffffff;
        }
        .diag-header-logo {
          height: 46px;
          display: block;
          margin: 0 auto 2px auto;
          object-fit: contain;
        }
        .diag-header-sub-text {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 10pt;
          font-weight: bold;
          font-family: 'Times New Roman', 'Amiri', serif;
          direction: rtl;
          padding-top: 1px;
        }
        .diag-dash-sep {
          letter-spacing: 2px;
          padding: 0 4px;
        }

        .diag-report-title {
          text-align: center;
          font-size: 14pt;
          font-weight: bold;
          font-style: italic;
          font-family: 'Times New Roman', 'Amiri', serif;
          text-decoration: underline;
          margin: 4px 0 6px 0;
          line-height: 1.25;
        }

        .diag-teacher-box {
          border-top: 2.5px double #7030a0;
          border-bottom: 2.5px double #7030a0;
          padding: 3px 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 7px;
          font-family: 'Times New Roman', 'Amiri', cursive, serif;
          font-style: italic;
          font-size: 10.5pt;
        }

        .diag-intro-text {
          text-align: justify;
          text-justify: inter-word;
          text-indent: 20pt;
          font-size: 9.5pt;
          line-height: 1.34;
          margin-bottom: 6px;
        }

        .diag-heading-blue-dark {
          font-family: 'Bodoni MT', 'Times New Roman', 'Amiri', serif;
          font-weight: bold;
          font-size: 11.5pt;
          color: #002060;
          margin: 5px 0 2px 0;
        }
        .diag-heading-blue-light {
          font-family: 'Bodoni MT', 'Times New Roman', 'Amiri', serif;
          font-weight: bold;
          font-size: 11pt;
          color: #0070c1;
          margin: 5px 0 2px 0;
        }
        .diag-sub-heading-blue {
          font-family: 'Times New Roman', 'Amiri', serif;
          font-weight: bold;
          font-size: 10.2pt;
          color: #0070c0;
          margin: 4px 0 2px 0;
        }

        .diag-obj-list {
          list-style: none;
          padding-left: 8px;
          padding-right: 8px;
          margin: 2px 0 5px 0;
        }
        .diag-obj-list li {
          font-size: 9.3pt;
          line-height: 1.28;
          margin-bottom: 1.5px;
        }
        .diag-obj-list li::before {
          content: "✓ ";
          font-weight: bold;
          margin-right: 3px;
          margin-left: 3px;
        }

        .diag-custom-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 5px;
          background: #ffffff;
        }
        .diag-custom-table th, .diag-custom-table td {
          border: 1px solid #000000;
          padding: 3px 5px;
          font-size: 9.2pt;
        }
        .diag-custom-table th {
          text-align: center;
          font-weight: bold;
          font-style: italic;
          background: #ffffff;
        }

        .diag-stats-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 3px;
          margin-bottom: 6px;
          background: #ffffff;
        }
        .diag-stats-table th, .diag-stats-table td {
          border: 1px solid #000000;
          padding: 3px 4px;
          text-align: center;
          font-size: 9.2pt;
        }
        .diag-stats-table th.arabic-header {
          font-family: 'Times New Roman', 'Amiri', serif;
          font-size: 9.5pt;
          font-weight: bold;
          line-height: 1.2;
        }
        .diag-purple-stat {
          color: #7030a0 !important;
          font-weight: bold;
        }

        /* PAGE 2 : TITRES & SECTIONS */
        .diag-section-title-red {
          font-family: 'Times New Roman', 'Amiri', serif;
          font-size: 12pt;
          font-weight: bold;
          color: #b91c1c;
          text-decoration: underline;
          margin: 5px 0 4px 0;
        }
        .diag-section-title-green {
          font-family: 'Times New Roman', 'Amiri', serif;
          font-size: 11.5pt;
          font-weight: bold;
          color: #047857;
          text-decoration: underline;
          margin: 6px 0 3px 0;
        }

        /* CARTOUCHES KPI */
        .diag-kpi-grid-large {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
          margin-bottom: 6px;
        }
        .diag-kpi-card-large {
          border: 1px solid #cbd5e1;
          background: #ffffff !important;
          padding: 5px 4px;
          text-align: center;
          border-radius: 4px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
        }
        .diag-kpi-card-label {
          font-size: 8pt;
          color: #334155;
          display: block;
          line-height: 1.15;
          font-weight: 600;
          margin-bottom: 2px;
        }
        .diag-kpi-card-value {
          font-size: 13pt;
          font-weight: bold;
          color: #0f172a;
          line-height: 1.1;
        }

        /* BLOCS GRAPHIQUES COMPACTS */
        .diag-simple-graph-block {
          background: #ffffff !important;
          padding: 2px 0;
          margin-bottom: 5px;
        }
        .diag-graph-header-row {
          font-size: 9.5pt;
          font-weight: bold;
          color: #0f172a;
          margin-bottom: 2px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .diag-graph-desc-text {
          font-size: 8.5pt;
          line-height: 1.25;
          text-align: justify;
          color: #1e293b;
          margin-bottom: 4px;
        }
        .diag-legend-row-large {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 12px;
          font-size: 8pt;
          font-weight: bold;
          padding: 2px 0 1px 0;
          margin-top: 2px;
        }
        .diag-color-dot-large {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
          margin-right: 3px;
          margin-left: 3px;
          vertical-align: middle;
        }

        .diag-bullet-list {
          list-style: none;
          padding-left: 10px;
          padding-right: 10px;
          margin: 2px 0 4px 0;
        }
        .diag-bullet-list li {
          font-size: 8.8pt;
          line-height: 1.25;
          margin-bottom: 2px;
          position: relative;
          padding-left: 14px;
          padding-right: 14px;
          text-align: justify;
        }
        .diag-bullet-list li::before {
          content: "➢";
          position: absolute;
          ${isRtl ? "right: 0;" : "left: 0;"}
          font-size: 9pt;
        }

        .diag-signature-section {
          margin-top: 6px;
          width: 100%;
          display: flex;
          justify-content: flex-end;
          padding-right: 20px;
          padding-left: 20px;
        }
        .diag-signature-box {
          text-align: center;
          font-size: 9.5pt;
        }
        .diag-signature-title {
          font-weight: bold;
          text-decoration: underline;
          margin-bottom: 2px;
        }
        .diag-signature-name {
          font-weight: bold;
          letter-spacing: 0.5px;
        }
      `}</style>

      {/* ==================== PAGE 1 : CADRE RÉGLEMENTAIRE, OBJECTIFS, INFORMATIONS GÉNÉRALES & CONTENU DU TEST ==================== */}
      <div className="diag-a4-page">
        {/* En-tête officiel Royaume du Maroc */}
        <div className="diag-header-box">
          <img
            src="/assets/header_logo.png"
            alt="Royaume du Maroc"
            className="diag-header-logo"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          <div className="diag-header-sub-text">
            <span>{config.academie}</span>
            <span className="diag-dash-sep">----</span>
            <span>{config.direction}</span>
            <span className="diag-dash-sep">----</span>
            <span>{config.lycee}</span>
          </div>
        </div>

        {/* Titre du rapport officiel */}
        <div className="diag-report-title">{reportMainTitle}</div>

        {/* Cadre de l'enseignant */}
        <div className="diag-teacher-box">
          <span>{t.reportTeacherPrefix} {config.nom_enseignant}</span>
          <span>{t.reportSubjectPrefix} {displayedSubject}</span>
          <span>{t.reportLevelPrefix} {displayedLevel}</span>
        </div>

        {/* Texte introductif réglementaire */}
        <div className="diag-intro-text">
          {lang === "ar" ? (
            `تطبيقا لمقتضيات المادة 08 من المقرر الوزاري المنظم للسنة الدراسية ${config.annee_scolaire}، خُصصت الفترة الممتدة ${displayedPeriod} لتشخيص المكتسبات القبلية لدى المتعلمين. وفي هذا الإطار، وبغية التحقق من مدى جاهزية المتعلم وضبط الفوارق قبل الانطلاق في إرساء الموارد الجديدة، تم إنجاز هذا التقويم التشخيصي لفائدة ${classesText}.`
          ) : lang === "en" ? (
            `In accordance with Article 08 of the ministerial decision governing the ${config.annee_scolaire} academic year, the period ${displayedPeriod} is dedicated to diagnosing students' prior competencies. To verify learners' prerequisites before embarking on new modules, this diagnostic assessment was conducted for ${classesText}.`
          ) : (
            `Conformément aux dispositions de l’article 08 de la décision ministérielle organisant la nouvelle année scolaire ${config.annee_scolaire}, la période du ${displayedPeriod} est consacrée au diagnostic des connaissances antérieures des apprenants. Afin d’examiner les connaissances de l’apprenant avant de s’engager dans un nouvel apprentissage, nous avons effectué l’évaluation diagnostique pour ${classesText}.`
          )}
        </div>

        {/* Objectifs du diagnostic */}
        <div className="diag-heading-blue-dark">{t.reportObjectivesTitle}</div>
        <ul className="diag-obj-list">
          {lang === "ar" ? (
            <>
              <li>رصد مكامن القوة ومواطن الضعف والتعثرات لدى المتعلمين.</li>
              <li>تحديد الصعوبات المعرفية والمنهجية وتحفيز المتعلمين على تجاوزها.</li>
              <li>استثمار نتائج التقويم التشخيصي في التخطيط البيداغوجي لحصص الدعم والتثبيت.</li>
              <li>اعتماد هذه المخرجات في التوجيه والتأطير التربوي الملائم.</li>
            </>
          ) : lang === "en" ? (
            <>
              <li>Identify strengths and learning gaps among students.</li>
              <li>Determine learning obstacles and motivate learners to overcome them.</li>
              <li>Leverage diagnostic results to design targeted remediation and support activities.</li>
              <li>Utilize assessment outcomes for pedagogical guidance and student counseling.</li>
            </>
          ) : (
            <>
              <li>Détecter les points forts et les points faibles des apprenants.</li>
              <li>Déterminer les difficultés et les obstacles d’apprentissage et motiver les apprenants à les surmonter.</li>
              <li>Investir les résultats de l’évaluation diagnostique pour planifier les activités de soutien.</li>
              <li>Adopter ces résultats pour l’orientation et le conseil.</li>
            </>
          )}
        </ul>

        {/* Section I : Informations générales */}
        <div className="diag-heading-blue-light">
          {t.reportSection1Title} ({selectedClassesNames.length > 0 ? selectedClassesNames.join(", ") : config.classes_section_1}) :
        </div>
        <div style={{ fontSize: "9.3pt", marginBottom: "3px" }}>
          {t.reportSection1Intro}
        </div>

        {/* Tableau 1 Planification */}
        <table className="diag-custom-table">
          <thead>
            <tr>
              <th style={{ width: "32%" }}>{t.reportTable1ClassCol}</th>
              <th style={{ width: "33%" }}>{t.reportTable1DateCol}</th>
              <th style={{ width: "35%" }}>{t.reportTable1PresentsCol}</th>
            </tr>
          </thead>
          <tbody>
            {stats.classes_plan.map((cls, idx) => (
              <tr key={idx}>
                <td style={{ textAlign: "center", fontStyle: "italic", fontWeight: "bold" }}>{cls.nom}</td>
                <td style={{ textAlign: "center", fontStyle: "italic", fontWeight: "bold" }}>{cls.date}</td>
                <td style={{ textAlign: "center", fontStyle: "italic", fontWeight: "bold" }}>
                  {getAbsentLabel(cls.nb_presents_texte, lang)}
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={2} style={{ textAlign: "center", fontStyle: "italic", fontWeight: "bold" }}>
                {t.reportTable1TotalRow}
              </td>
              <td style={{ textAlign: "center", fontStyle: "italic", fontWeight: "bold" }}>
                {stats.total_presents}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Composition du test */}
        <div className="diag-sub-heading-blue">
          {t.reportCompositionPrefix} {displayedNumExercises} {lang === "ar" ? "تمارين" : lang === "en" ? "exercises" : "exercices"}
        </div>
        <table className="diag-custom-table" style={{ marginTop: "2px" }}>
          <tbody>
            {displayedExercises.map((ex, idx) => (
              <tr key={idx}>
                <td style={{ width: "22%", fontWeight: "bold" }}>{ex.titre}</td>
                <td style={{ width: "78%", fontWeight: "bold" }}>{ex.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ==================== PAGE 2 : ANALYSE DÉTAILLÉE DES RÉSULTATS, KPIS, OBSERVATIONS, PROPOSITIONS & SIGNATURE ==================== */}
      <div className="diag-a4-page">
        {/* Section II : Tableau des résultats avec noms des tranches traduits selon la langue */}
        <div className="diag-heading-blue-light" style={{ marginTop: "0", marginBottom: "3px" }}>
          {t.reportSection2Title}
        </div>
        <table className="diag-stats-table">
          <thead>
            <tr>
              <th rowSpan={2} style={{ width: "23%", fontStyle: "italic" }}>{t.reportTable1ClassCol}</th>
              <th rowSpan={2} style={{ width: "17%" }}>{t.indicatorCol}</th>
              <th className="arabic-header" style={{ width: "15%", color: "#dc2626" }}>
                {tranches.t1}<br />
                <span style={{ fontSize: "8.8pt" }}>{tranches.r1}</span>
              </th>
              <th className="arabic-header" style={{ width: "15%", color: "#d97706" }}>
                {tranches.t2}<br />
                <span style={{ fontSize: "8.8pt" }}>{tranches.r2}</span>
              </th>
              <th className="arabic-header" style={{ width: "15%", color: "#2563eb" }}>
                {tranches.t3}<br />
                <span style={{ fontSize: "8.8pt" }}>{tranches.r3}</span>
              </th>
              <th className="arabic-header" style={{ width: "15%", color: "#059669" }}>
                {tranches.t4}<br />
                <span style={{ fontSize: "8.8pt" }}>{tranches.r4}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {stats.classes_stats.map((stat, idx) => (
              <React.Fragment key={idx}>
                <tr>
                  <td rowSpan={2} style={{ fontWeight: "bold", fontStyle: "italic" }}>{stat.nom}</td>
                  <td style={{ fontWeight: "bold" }}>{t.countRow}</td>
                  <td className="diag-purple-stat">{stat.t1_count}</td>
                  <td className="diag-purple-stat">{stat.t2_count}</td>
                  <td className="diag-purple-stat">{stat.t3_count}</td>
                  <td className="diag-purple-stat">{stat.t4_count}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: "bold", fontStyle: "italic" }}>{t.percentageRow}</td>
                  <td className="diag-purple-stat">{stat.t1_pct} %</td>
                  <td className="diag-purple-stat">{stat.t2_pct} %</td>
                  <td className="diag-purple-stat">{stat.t3_pct} %</td>
                  <td className="diag-purple-stat">{stat.t4_pct} %</td>
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {/* 1. TITRE RÉSULTATS ET ANALYSE STATISTIQUE */}
        <div className="diag-section-title-red">
          {lang === "ar" ? "النتائج والتحليل الإحصائي :" : lang === "en" ? "Results & Statistical Analysis:" : "Résultats et analyse statistique :"}
        </div>

        <div className="diag-intro-text" style={{ marginBottom: "6px" }}>
          {lang === "ar" ? (
            `بعد اجتياز المتعلمين لهذا الرائز التشخيصي، يُسجل أن النتائج المحصل عليها جاءت `
          ) : lang === "en" ? (
            `Following the administration of this test, the recorded results are assessed as `
          ) : (
            `Après que les apprenants aient passé ce test, on constate que les résultats obtenus sont `
          )}
          <strong>{displayedAppreciation}</strong>
          {lang === "ar" ? (
            `، مع تفصيل المؤشرات والرسوم البيانية التوضيحية أسفله :`
          ) : lang === "en" ? (
            `, with detailed indicators and illustrative charts presented below:`
          ) : (
            `, avec le détail des indicateurs et graphiques explicatifs ci-dessous :`
          )}
        </div>

        {/* 4 CARTOUCHES KPI */}
        <div className="diag-kpi-grid-large">
          <div className="diag-kpi-card-large">
            <span className="diag-kpi-card-label">{t.statsKpiTotalPresents}</span>
            <span className="diag-kpi-card-value text-indigo-700">{stats.total_presents}</span>
          </div>
          <div className="diag-kpi-card-large">
            <span className="diag-kpi-card-label">{t.kpiSuccessRate}</span>
            <span className="diag-kpi-card-value text-emerald-700">{pctT3 + pctT4}%</span>
          </div>
          <div className="diag-kpi-card-large">
            <span className="diag-kpi-card-label">{t.statsKpiStrugglingRate}</span>
            <span className="diag-kpi-card-value text-rose-600">{stats.pct_struggling}%</span>
          </div>
          <div className="diag-kpi-card-large">
            <span className="diag-kpi-card-label">{t.kpiAverageGrade}</span>
            <span className="diag-kpi-card-value text-blue-700">{generalAvg}/20</span>
          </div>
        </div>

        {includeGraphs && analysisCommentary && (
          <>
            {/* GRAPHE 1 : Colonnes des 4 tranches */}
            <div className="diag-simple-graph-block">
              <div className="diag-graph-header-row">
                <span>{t.chartColumnsTitle}</span>
                <span style={{ fontSize: "8pt", color: "#64748b", fontWeight: "normal" }}>
                  {stats.total_presents} {lang === "ar" ? "تلميذاً" : "élèves"}
                </span>
              </div>

              <div className="diag-graph-desc-text">
                <strong>{lang === "ar" ? "تحليل الفئات الأربع : " : lang === "en" ? "Tier Breakdown: " : "Analyse des tranches : "}</strong>
                {analysisCommentary.tierBreakdown}
              </div>

              <svg viewBox="0 0 500 80" style={{ width: "100%", height: "70px", overflow: "visible" }}>
                <line x1="20" y1="10" x2="480" y2="10" stroke="#e2e8f0" strokeDasharray="3 3" />
                <line x1="20" y1="35" x2="480" y2="35" stroke="#e2e8f0" strokeDasharray="3 3" />
                <line x1="20" y1="58" x2="480" y2="58" stroke="#94a3b8" strokeWidth="1.2" />

                {/* Tranche 1 */}
                {(() => {
                  const h = Math.max(4, Math.round((pctT1 / 100) * 46));
                  const y = 58 - h;
                  return (
                    <g>
                      <rect x="45" y={y} width="68" height={h} fill="#dc2626" rx="2" />
                      <text x="79" y={y - 2} textAnchor="middle" fontSize="9.5" fontWeight="bold" fill="#dc2626">
                        {pctT1}% ({totalT1})
                      </text>
                      <text x="79" y="70" textAnchor="middle" fontSize="8.5" fill="#334155" fontWeight="bold">
                        {tranches.r1}
                      </text>
                    </g>
                  );
                })()}

                {/* Tranche 2 */}
                {(() => {
                  const h = Math.max(4, Math.round((pctT2 / 100) * 46));
                  const y = 58 - h;
                  return (
                    <g>
                      <rect x="160" y={y} width="68" height={h} fill="#d97706" rx="2" />
                      <text x="194" y={y - 2} textAnchor="middle" fontSize="9.5" fontWeight="bold" fill="#d97706">
                        {pctT2}% ({totalT2})
                      </text>
                      <text x="194" y="70" textAnchor="middle" fontSize="8.5" fill="#334155" fontWeight="bold">
                        {tranches.r2}
                      </text>
                    </g>
                  );
                })()}

                {/* Tranche 3 */}
                {(() => {
                  const h = Math.max(4, Math.round((pctT3 / 100) * 46));
                  const y = 58 - h;
                  return (
                    <g>
                      <rect x="275" y={y} width="68" height={h} fill="#2563eb" rx="2" />
                      <text x="309" y={y - 2} textAnchor="middle" fontSize="9.5" fontWeight="bold" fill="#2563eb">
                        {pctT3}% ({totalT3})
                      </text>
                      <text x="309" y="70" textAnchor="middle" fontSize="8.5" fill="#334155" fontWeight="bold">
                        {tranches.r3}
                      </text>
                    </g>
                  );
                })()}

                {/* Tranche 4 */}
                {(() => {
                  const h = Math.max(4, Math.round((pctT4 / 100) * 46));
                  const y = 58 - h;
                  return (
                    <g>
                      <rect x="390" y={y} width="68" height={h} fill="#059669" rx="2" />
                      <text x="424" y={y - 2} textAnchor="middle" fontSize="9.5" fontWeight="bold" fill="#059669">
                        {pctT4}% ({totalT4})
                      </text>
                      <text x="424" y="70" textAnchor="middle" fontSize="8.5" fill="#334155" fontWeight="bold">
                        {tranches.r4}
                      </text>
                    </g>
                  );
                })()}
              </svg>

              <div className="diag-legend-row-large">
                <span className="text-red-700">
                  <span className="diag-color-dot-large bg-red-600"></span>
                  {tranches.t1} {tranches.r1} : {pctT1}% ({totalT1})
                </span>
                <span className="text-amber-700">
                  <span className="diag-color-dot-large bg-amber-500"></span>
                  {tranches.t2} {tranches.r2} : {pctT2}% ({totalT2})
                </span>
                <span className="text-blue-700">
                  <span className="diag-color-dot-large bg-blue-600"></span>
                  {tranches.t3} {tranches.r3} : {pctT3}% ({totalT3})
                </span>
                <span className="text-emerald-700">
                  <span className="diag-color-dot-large bg-emerald-600"></span>
                  {tranches.t4} {tranches.r4} : {pctT4}% ({totalT4})
                </span>
              </div>
            </div>

            {/* GRAPHE 2 : Donut */}
            <div className="diag-simple-graph-block">
              <div className="diag-graph-header-row">
                <span>{t.chartPieTitle}</span>
                <span style={{ fontSize: "8pt", color: "#64748b", fontWeight: "normal" }}>
                  {stats.total_presents} {lang === "ar" ? "تلميذاً مقيماً" : "élèves"}
                </span>
              </div>

              <div className="diag-graph-desc-text">
                <strong>{lang === "ar" ? "قراءة شمولية : " : lang === "en" ? "Executive Summary: " : "Synthèse globale : "}</strong>
                {analysisCommentary.executiveSummary}
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "20px", padding: "2px 0" }}>
                <svg viewBox="0 0 100 100" style={{ width: "70px", height: "70px" }}>
                  {pieSlices.map((slice, i) => (
                    <path key={i} d={slice.path} fill={slice.color} stroke="#ffffff" strokeWidth="1.5" />
                  ))}
                  <text x="50" y="52" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#0f172a">
                    {stats.total_presents}
                  </text>
                  <text x="50" y="62" textAnchor="middle" fontSize="6" fill="#64748b">
                    {lang === "ar" ? "تلميذاً" : "élèves"}
                  </text>
                </svg>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px", fontSize: "8pt" }}>
                  <span className="text-red-700">
                    <span className="diag-color-dot-large bg-red-600"></span>
                    {tranches.t1} : <strong>{pctT1}%</strong>
                  </span>
                  <span className="text-amber-700">
                    <span className="diag-color-dot-large bg-amber-500"></span>
                    {tranches.t2} : <strong>{pctT2}%</strong>
                  </span>
                  <span className="text-blue-700">
                    <span className="diag-color-dot-large bg-blue-600"></span>
                    {tranches.t3} : <strong>{pctT3}%</strong>
                  </span>
                  <span className="text-emerald-700">
                    <span className="diag-color-dot-large bg-emerald-600"></span>
                    {tranches.t4} : <strong>{pctT4}%</strong>
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* 2. SECTION SÉPARÉE : OBSERVATIONS PÉDAGOGIQUES */}
        <div className="diag-section-title-green">
          {lang === "ar" ? "الملاحظات البيداغوجية المرصودة :" : lang === "en" ? "Pedagogical Observations:" : "Observations pédagogiques constatées :"}
        </div>

        {includeGraphs && analysisCommentary && (
          <div className="diag-intro-text" style={{ fontSize: "8.5pt", lineHeight: 1.25, marginBottom: "3px" }}>
            <strong>{lang === "ar" ? "التوجيه البيداغوجي : " : lang === "en" ? "Pedagogical Roadmap: " : "Orientation pédagogique : "}</strong>
            {analysisCommentary.pedagogicalRoadmap}
          </div>
        )}

        {/* Liste des observations */}
        <ul className="diag-bullet-list">
          {displayedObservations.map((obs, idx) => (
            <li key={idx}>{obs}</li>
          ))}
        </ul>

        {/* 3. SECTION III : PROPOSITIONS DE SOUTIEN & REMÉDIATION */}
        <div className="diag-heading-blue-light" style={{ marginTop: "4px", marginBottom: "2px" }}>
          {t.reportSection3Title}
        </div>
        <div style={{ fontSize: "8.8pt", marginBottom: "2px" }}>
          {t.reportSection3Intro}
        </div>

        <ul className="diag-bullet-list">
          {displayedPropositions.map((prop, idx) => (
            <li key={idx}>{prop}</li>
          ))}
        </ul>

        {/* Signature de l'enseignant */}
        <div className="diag-signature-section">
          <div className="diag-signature-box">
            <div className="diag-signature-title">{t.reportSignatureTitle}</div>
            <div className="diag-signature-name">{config.nom_enseignant}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

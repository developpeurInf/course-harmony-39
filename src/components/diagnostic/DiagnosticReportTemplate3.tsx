/**
 * Modèle 3 : « Analyse des acquis et plan de remédiation » (تقرير تحليل نتائج التقويم التشخيصي
 * وخطة الدعم والمعالجة). Données réelles des classes (effectifs, moyennes, tranches officielles)
 * + analyse rédigée par l'IA puis revue par le professeur (config.analyse_ia) :
 * maîtrise par ressource, besoins par groupe, plan de remédiation, constats et propositions.
 * Sans analyse, les tableaux restent imprimables avec des lignes vides à remplir à la main.
 */
import React from "react";
import { renderOfficialChart, useOfficialCharts, type ChartBlock } from "@/components/diagnostic/OfficialCharts";
import type { DiagnosticConfig } from "@/lib/diagnosticStorage";
import { getLangContent } from "@/lib/diagnosticStorage";
import { calculateClassStats, parseNoteValue, type DiagnosticClass } from "@/lib/diagnosticStatsEngine";
import type { DiagLang } from "@/lib/diagnosticTranslations";
import { BAND_LABEL, MASTERY_LABEL, emptyAnalysis, type BandKey, type DiagnosticAiAnalysis } from "@/lib/diagnosticAi";
import { OfficialHeader, OfficialPages, OfficialSignatures, SectionTitle, useReportFooter } from "@/components/diagnostic/OfficialReportKit";

const TXT = {
  ar: {
    title: "تقرير تحليل نتائج التقويم التشخيصي", subtitle: "وخطة الدعم والمعالجة",
    level: "المستوى", period: "فترة الإنجاز", overall: "التقدير العام لمستوى المتعلمين",
    secGeneral: "المعطيات الإحصائية العامة:", colClass: "القسم", colEnrolled: "المسجلون", colPresent: "الحاضرون", colAvg: "المعدل", colMin: "أدنى نقطة", colMax: "أعلى نقطة", colAbove: "نسبة ≥ 10",
    secBands: "تفييئ المتعلمين حسب الفئات الرسمية:", total: "المجموع",
    secResources: "تحليل درجة التحكم في الموارد:", colResource: "المورد / المهارة المستهدفة", colRate: "نسبة النجاح", colMastery: "درجة التحكم", colDifficulties: "التعثرات الملاحظة", colError: "طبيعة الخطأ", colRemediation: "المعالجة المقترحة",
    secGroups: "حاجيات الفئات ونوع الدعم:", colGroup: "الفئة", colCount: "العدد", colNeeds: "الحاجيات", colSupport: "نوع الدعم", colActivities: "الأنشطة المقترحة",
    secPlan: "خطة الدعم والمعالجة:", colPeriod: "الفترة", colContent: "التعلمات المستهدفة", colTarget: "الفئة المستهدفة", colActs: "الأنشطة والوسائل", colIndicators: "مؤشرات النجاح",
    secConclusions: "الخلاصات والمقترحات:", observations: "أهم الملاحظات", propositions: "المقترحات",
    estimated: "نسب تقديرية حين لا تتوفر نتائج مفصلة لكل تمرين.",
  },
  fr: {
    title: "Analyse des résultats de l'évaluation diagnostique", subtitle: "et plan de soutien et de remédiation",
    level: "Niveau", period: "Période", overall: "Appréciation générale du niveau des élèves",
    secGeneral: "Données statistiques générales :", colClass: "Classe", colEnrolled: "Inscrits", colPresent: "Présents", colAvg: "Moyenne", colMin: "Note min", colMax: "Note max", colAbove: "% ≥ 10",
    secBands: "Répartition des élèves selon les catégories officielles :", total: "Total",
    secResources: "Degré de maîtrise des ressources :", colResource: "Ressource / compétence visée", colRate: "Taux de réussite", colMastery: "Maîtrise", colDifficulties: "Difficultés observées", colError: "Nature de l'erreur", colRemediation: "Remédiation proposée",
    secGroups: "Besoins des groupes et type de soutien :", colGroup: "Groupe", colCount: "Effectif", colNeeds: "Besoins", colSupport: "Type de soutien", colActivities: "Activités proposées",
    secPlan: "Plan de soutien et de remédiation :", colPeriod: "Période", colContent: "Apprentissages visés", colTarget: "Groupe cible", colActs: "Activités et supports", colIndicators: "Indicateurs de réussite",
    secConclusions: "Conclusions et propositions :", observations: "Principaux constats", propositions: "Propositions",
    estimated: "Taux estimés lorsque les résultats détaillés par exercice ne sont pas disponibles.",
  },
  en: {
    title: "Diagnostic assessment results analysis", subtitle: "and support and remediation plan",
    level: "Level", period: "Period", overall: "Overall level of the students",
    secGeneral: "General statistics:", colClass: "Class", colEnrolled: "Enrolled", colPresent: "Present", colAvg: "Average", colMin: "Min", colMax: "Max", colAbove: "% ≥ 10",
    secBands: "Distribution of students by official category:", total: "Total",
    secResources: "Mastery of the resources:", colResource: "Resource / target skill", colRate: "Success rate", colMastery: "Mastery", colDifficulties: "Observed difficulties", colError: "Type of error", colRemediation: "Proposed remediation",
    secGroups: "Group needs and type of support:", colGroup: "Group", colCount: "Count", colNeeds: "Needs", colSupport: "Type of support", colActivities: "Proposed activities",
    secPlan: "Support and remediation plan:", colPeriod: "Period", colContent: "Target learning", colTarget: "Target group", colActs: "Activities and materials", colIndicators: "Success indicators",
    secConclusions: "Conclusions and proposals:", observations: "Main findings", propositions: "Proposals",
    estimated: "Estimated rates when detailed results per exercise are not available.",
  },
};

type Block =
  | { kind: "header" } | { kind: "overall" } | { kind: "generalTitle" } | { kind: "general" }
  | { kind: "bandsTitle" } | { kind: "bands" } | { kind: "resTitle" } | { kind: "resources" }
  | { kind: "groupsTitle" } | { kind: "groups" } | { kind: "planTitle" } | { kind: "plan" }
  | { kind: "conclTitle" } | { kind: "conclusions" } | { kind: "signatures" } | ChartBlock;

const fmt = (n: number, lang: DiagLang) => (lang === "en" ? n.toFixed(2) : n.toFixed(2).replace(".", ","));
const masteryClass = { acquired: "or-ok", partial: "or-mid", not_acquired: "or-ko" } as const;

interface Props { config: DiagnosticConfig; classes: DiagnosticClass[]; lang?: DiagLang; includeGraphs?: boolean }

export const DiagnosticReportTemplate3: React.FC<Props> = ({ config, classes, lang = "ar", includeGraphs = false }) => {
  const t = TXT[lang] || TXT.fr;
  const footer = useReportFooter(lang);
  const a: DiagnosticAiAnalysis = config.analyse_ia?.[lang] || emptyAnalysis();
  const content = getLangContent(config, lang);
  const observations = a.observations.length ? a.observations : content.observations;
  const propositions = a.propositions.length ? a.propositions : content.propositions;
  const appreciation = a.appreciation || content.appreciation_globale;

  const stats = React.useMemo(() => classes.map((c) => {
    const s = calculateClassStats(c);
    const notes = (c.students || []).map((x) => parseNoteValue(x.note)).filter((v): v is number => v !== null);
    return { ...s, min: notes.length ? Math.min(...notes) : null, max: notes.length ? Math.max(...notes) : null, above: notes.length ? Math.round((notes.filter((n) => n >= 10).length / notes.length) * 100) : null };
  }), [classes]);
  const bandTotals = stats.reduce((acc, s) => ({ t1: acc.t1 + s.t1_count, t2: acc.t2 + s.t2_count, t3: acc.t3 + s.t3_count, t4: acc.t4 + s.t4_count }), { t1: 0, t2: 0, t3: 0, t4: 0 } as Record<BandKey, number>);
  const presentAll = stats.reduce((s, x) => s + x.present_count, 0);

  // Ressources : analyse IA, sinon les exercices du test (lignes à compléter)
  const resources = a.resources.length
    ? a.resources
    : content.exercices.map((e) => ({ resource: `${e.titre} : ${e.description}`, mastery: null as null, rate: null as number | null, difficulties: "", error_type: "", remediation: "" }));
  const plan = a.plan.length ? a.plan : Array.from({ length: 4 }, () => ({ period: "", content: "", target: "", activities: "", indicators: "" }));

  const charts = useOfficialCharts(config, classes, includeGraphs);
  const blocks: Block[] = [
    { kind: "header" }, { kind: "overall" },
    { kind: "generalTitle" }, { kind: "general" },
    { kind: "bandsTitle" }, { kind: "bands" },
    // Graphiques (mêmes réglages que le modèle 2) sous la répartition par catégorie
    ...charts.perClass.filter((c): c is NonNullable<typeof c> => !!c), ...charts.global,
    { kind: "resTitle" }, { kind: "resources" },
    { kind: "groupsTitle" }, { kind: "groups" },
    { kind: "planTitle" }, { kind: "plan" },
    { kind: "conclTitle" }, { kind: "conclusions" },
    { kind: "signatures" },
  ];
  const titleKinds = new Set(["chartsTitle", "generalTitle", "bandsTitle", "resTitle", "groupsTitle", "planTitle", "conclTitle"]);
  const contentKey = JSON.stringify([lang, a, observations, propositions, appreciation, stats, resources.length, config.lycee, config.nom_enseignant, config.matiere, config.annee_scolaire, config.academie, config.direction, charts.key]);

  const renderBlock = (b: Block, key: number): React.ReactNode => {
    if (b.kind === "classChart" || b.kind === "globalChart" || b.kind === "chartsTitle") return renderOfficialChart(b, key, lang, charts);
    switch (b.kind) {
      case "header":
        return <div key={key}><OfficialHeader config={config} lang={lang} title={t.title} subtitle={t.subtitle} /></div>;
      case "overall":
        return (
          <div key={key} className="or-highlight">
            <div><b>{t.level} :</b> {config.niveau || config.niveau_titre} &nbsp;·&nbsp; <b>{t.period} :</b> {config.periode_diagnostic}</div>
            <div><b>{t.overall} :</b> {appreciation || "……………"}</div>
            {a.summary && <div style={{ marginTop: "1mm" }}>{a.summary}</div>}
          </div>
        );
      case "generalTitle": return <SectionTitle key={key} n={0}>{t.secGeneral}</SectionTitle>;
      case "general":
        return (
          <table key={key} className="or-table or-block">
            <thead><tr><th style={{ width: "22%" }}>{t.colClass}</th><th>{t.colEnrolled}</th><th>{t.colPresent}</th><th>{t.colAvg}</th><th>{t.colMin}</th><th>{t.colMax}</th><th>{t.colAbove}</th></tr></thead>
            <tbody>
              {stats.map((s, i) => (
                <tr key={i}>
                  <td className="or-start or-bold">{s.nom}</td><td>{s.total_students}</td><td className="or-bold">{s.present_count}</td>
                  <td className="or-bold">{s.present_count ? fmt(s.average_note, lang) : "—"}</td>
                  <td>{s.min ?? "—"}</td><td>{s.max ?? "—"}</td><td>{s.above === null ? "—" : `${s.above}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case "bandsTitle": return <SectionTitle key={key} n={1}>{t.secBands}</SectionTitle>;
      case "bands":
        return (
          <table key={key} className="or-table or-block">
            <thead><tr><th style={{ width: "22%" }}>{t.colClass}</th>{(["t1", "t2", "t3", "t4"] as BandKey[]).map((k) => <th key={k} className={`or-${k}`}>{BAND_LABEL[lang][k]}</th>)}</tr></thead>
            <tbody>
              {stats.map((s, i) => (
                <tr key={i}>
                  <td className="or-start or-bold">{s.nom}</td>
                  {([[s.t1_count, s.t1_pct], [s.t2_count, s.t2_pct], [s.t3_count, s.t3_pct], [s.t4_count, s.t4_pct]] as const).map(([c, p], j) => <td key={j}>{c} <span className="or-muted">({s.present_count ? p : 0}%)</span></td>)}
                </tr>
              ))}
              <tr>
                <td className="or-start or-bold">{t.total}</td>
                {(["t1", "t2", "t3", "t4"] as BandKey[]).map((k) => <td key={k} className={`or-bold or-${k}`}>{bandTotals[k]} ({presentAll ? Math.round((bandTotals[k] / presentAll) * 100) : 0}%)</td>)}
              </tr>
            </tbody>
          </table>
        );
      case "resTitle": return <SectionTitle key={key} n={2}>{t.secResources}</SectionTitle>;
      case "resources":
        return (
          <div key={key} className="or-block">
            <table className="or-table">
              <thead><tr><th style={{ width: "21%" }}>{t.colResource}</th><th style={{ width: "10%" }}>{t.colRate}</th><th style={{ width: "12%" }}>{t.colMastery}</th><th>{t.colDifficulties}</th><th style={{ width: "13%" }}>{t.colError}</th><th>{t.colRemediation}</th></tr></thead>
              <tbody>
                {resources.map((r, i) => (
                  <tr key={i}>
                    <td className="or-start or-bold or-top">{r.resource}</td>
                    <td>{r.rate === null || r.rate === undefined ? "…… %" : <>{r.rate}%<div className="or-bar"><div style={{ width: `${Math.max(0, Math.min(100, r.rate))}%` }} /></div></>}</td>
                    <td className={r.mastery ? `or-bold ${masteryClass[r.mastery]}` : ""}>{r.mastery ? MASTERY_LABEL[lang][r.mastery] : ""}</td>
                    <td className="or-start or-top">{r.difficulties}</td>
                    <td className="or-top">{r.error_type}</td>
                    <td className="or-start or-top">{r.remediation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {resources.some((r) => /estim|تقدير/i.test(r.difficulties)) && <div className="or-muted" style={{ fontSize: "8.5pt", marginTop: "0.8mm" }}>* {t.estimated}</div>}
          </div>
        );
      case "groupsTitle": return <SectionTitle key={key} n={3}>{t.secGroups}</SectionTitle>;
      case "groups":
        return (
          <table key={key} className="or-table or-block">
            <thead><tr><th style={{ width: "17%" }}>{t.colGroup}</th><th style={{ width: "8%" }}>{t.colCount}</th><th>{t.colNeeds}</th><th style={{ width: "15%" }}>{t.colSupport}</th><th>{t.colActivities}</th></tr></thead>
            <tbody>
              {a.groups.map((g) => (
                <tr key={g.band}>
                  <td className={`or-bold or-${g.band}`}>{BAND_LABEL[lang][g.band]}</td>
                  <td className="or-bold">{bandTotals[g.band]}</td>
                  <td className="or-start or-top">{g.needs}</td>
                  <td className="or-top">{g.support_type}</td>
                  <td className="or-start or-top">{g.activities}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case "planTitle": return <SectionTitle key={key} n={4}>{t.secPlan}</SectionTitle>;
      case "plan":
        return (
          <table key={key} className="or-table or-block">
            <thead><tr><th style={{ width: "11%" }}>{t.colPeriod}</th><th>{t.colContent}</th><th style={{ width: "13%" }}>{t.colTarget}</th><th>{t.colActs}</th><th style={{ width: "20%" }}>{t.colIndicators}</th></tr></thead>
            <tbody>
              {plan.map((p, i) => (
                <tr key={i} style={{ height: p.content ? undefined : "9mm" }}>
                  <td className="or-bold">{p.period}</td>
                  <td className="or-start or-top">{p.content}</td>
                  <td className="or-top">{p.target}</td>
                  <td className="or-start or-top">{p.activities}</td>
                  <td className="or-start or-top">{p.indicators}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case "conclTitle": return <SectionTitle key={key} n={5}>{t.secConclusions}</SectionTitle>;
      case "conclusions":
        return (
          <table key={key} className="or-table or-block">
            <thead><tr><th>{t.observations}</th><th>{t.propositions}</th></tr></thead>
            <tbody><tr>
              <td className="or-start or-top"><ul className="or-list">{observations.filter(Boolean).map((o, i) => <li key={i}>{o}</li>)}</ul></td>
              <td className="or-start or-top"><ul className="or-list">{propositions.filter(Boolean).map((o, i) => <li key={i}>{o}</li>)}</ul></td>
            </tr></tbody>
          </table>
        );
      case "signatures": return <div key={key}><OfficialSignatures config={config} lang={lang} /></div>;
    }
  };

  return (
    <OfficialPages
      lang={lang}
      blocks={blocks}
      renderBlock={renderBlock}
      contentKey={contentKey}
      keepWithNext={(i) => titleKinds.has(blocks[i].kind)}
      footerText={footer}
    />
  );
};

export default DiagnosticReportTemplate3;

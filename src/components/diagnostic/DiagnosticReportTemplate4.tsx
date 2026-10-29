/**
 * Modèle 4 : « Groupes de besoin » (لوائح فئات الدعم والمعالجة) — pour chaque classe, la liste
 * nominative des élèves de chaque catégorie officielle, prête à servir pour constituer les
 * groupes de soutien, avec les besoins et activités de l'analyse IA (modifiables) sous chaque
 * catégorie. Les noms restent dans l'appli : ils ne sont jamais envoyés à l'IA.
 */
import React from "react";
import { renderOfficialChart, useOfficialCharts, type ChartBlock } from "@/components/diagnostic/OfficialCharts";
import type { DiagnosticConfig } from "@/lib/diagnosticStorage";
import { parseNoteValue, type DiagnosticClass } from "@/lib/diagnosticStatsEngine";
import type { DiagLang } from "@/lib/diagnosticTranslations";
import { BAND_LABEL, bandOf, emptyAnalysis, type BandKey } from "@/lib/diagnosticAi";
import { OfficialHeader, OfficialPages, OfficialSignatures, useReportFooter } from "@/components/diagnostic/OfficialReportKit";

const TXT = {
  ar: { title: "لوائح فئات الدعم والمعالجة", subtitle: "حسب نتائج التقويم التشخيصي", klass: "القسم", present: "الحاضرون", absent: "المتغيبون", needs: "الحاجيات", activities: "الأنشطة", support: "نوع الدعم", none: "—", intro: "تم تفييئ المتعلمين حسب النقطة المحصل عليها في التقويم التشخيصي، لتكوين مجموعات الدعم وتتبع تطور تعلماتهم." },
  fr: { title: "Groupes de besoin", subtitle: "selon les résultats de l'évaluation diagnostique", klass: "Classe", present: "Présents", absent: "Absents", needs: "Besoins", activities: "Activités", support: "Type de soutien", none: "—", intro: "Les élèves sont répartis selon leur note à l'évaluation diagnostique afin de constituer les groupes de soutien et de suivre leurs progrès." },
  en: { title: "Need-based groups", subtitle: "from the diagnostic assessment results", klass: "Class", present: "Present", absent: "Absent", needs: "Needs", activities: "Activities", support: "Type of support", none: "—", intro: "Students are grouped by their diagnostic score to form support groups and follow their progress." },
};

const BANDS: BandKey[] = ["t1", "t2", "t3", "t4"];

type Row = { num: number; name: string; note: number };
type Block = { kind: "header" } | { kind: "intro" } | { kind: "class"; nom: string; groups: Record<BandKey, Row[]>; absents: string[]; present: number } | { kind: "needs" } | { kind: "signatures" } | ChartBlock;

interface Props { config: DiagnosticConfig; classes: DiagnosticClass[]; lang?: DiagLang; includeGraphs?: boolean }

export const DiagnosticReportTemplate4: React.FC<Props> = ({ config, classes, lang = "ar", includeGraphs = false }) => {
  const t = TXT[lang] || TXT.fr;
  const footer = useReportFooter(lang);
  const a = config.analyse_ia?.[lang] || emptyAnalysis();
  const hasNeeds = a.groups.some((g) => g.needs || g.activities);

  const classBlocks = React.useMemo(() => classes.map((c) => {
    const groups: Record<BandKey, Row[]> = { t1: [], t2: [], t3: [], t4: [] };
    const absents: string[] = [];
    (c.students || []).forEach((s, i) => {
      const v = parseNoteValue(s.note);
      if (v === null) absents.push(s.name);
      else groups[bandOf(v)].push({ num: s.num || i + 1, name: s.name, note: v });
    });
    BANDS.forEach((k) => groups[k].sort((x, y) => x.note - y.note));
    return { kind: "class" as const, nom: c.nom, groups, absents, present: BANDS.reduce((n, k) => n + groups[k].length, 0) };
  }), [classes]);

  const charts = useOfficialCharts(config, classes, includeGraphs);
  // Graphique de chaque classe sous sa liste, graphiques d'ensemble avant les signatures
  const blocks: Block[] = [
    { kind: "header" }, { kind: "intro" }, ...(hasNeeds ? [{ kind: "needs" as const }] : []),
    ...classBlocks.flatMap((cb, i): Block[] => (charts.perClass[i] ? [cb, charts.perClass[i]!] : [cb])),
    ...charts.global,
    { kind: "signatures" },
  ];
  const contentKey = JSON.stringify([lang, classBlocks, a.groups, config.lycee, config.nom_enseignant, config.matiere, config.annee_scolaire, charts.key]);
  const note = (n: number) => (lang === "en" ? String(n) : String(n).replace(".", ","));

  const renderBlock = (b: Block, key: number): React.ReactNode => {
    if (b.kind === "classChart" || b.kind === "globalChart" || b.kind === "chartsTitle") return renderOfficialChart(b, key, lang, charts);
    switch (b.kind) {
      case "header": return <div key={key}><OfficialHeader config={config} lang={lang} title={t.title} subtitle={t.subtitle} /></div>;
      case "intro": return <p key={key} className="or-para">{t.intro}</p>;
      case "needs":
        return (
          <table key={key} className="or-table or-block">
            <thead><tr>{BANDS.map((k) => <th key={k} className={`or-${k}`}>{BAND_LABEL[lang][k]}</th>)}</tr></thead>
            <tbody><tr>
              {a.groups.map((g) => (
                <td key={g.band} className="or-start or-top" style={{ fontSize: "8.8pt" }}>
                  {g.needs && <div><b>{t.needs} :</b> {g.needs}</div>}
                  {g.support_type && <div><b>{t.support} :</b> {g.support_type}</div>}
                  {g.activities && <div><b>{t.activities} :</b> {g.activities}</div>}
                </td>
              ))}
            </tr></tbody>
          </table>
        );
      case "class": {
        const max = Math.max(1, ...BANDS.map((k) => b.groups[k].length));
        return (
          <div key={key} className="or-block" style={{ breakInside: "avoid" }}>
            <div className="or-class-title">• {t.klass} : {b.nom} — {t.present} : {b.present}{b.absents.length ? ` · ${t.absent} : ${b.absents.length}` : ""}</div>
            <table className="or-table or-names">
              <thead><tr>{BANDS.map((k) => <th key={k} className={`or-${k}`}>{BAND_LABEL[lang][k]} ({b.groups[k].length})</th>)}</tr></thead>
              <tbody>
                {Array.from({ length: max }, (_, r) => (
                  <tr key={r}>
                    {BANDS.map((k) => {
                      const s = b.groups[k][r];
                      return <td key={k}>{s ? <>{s.num}. {s.name} <b style={{ float: lang === "ar" ? "left" : "right" }}>{note(s.note)}</b></> : r === 0 ? t.none : ""}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {b.absents.length > 0 && <div className="or-muted" style={{ fontSize: "8.5pt", marginTop: "0.6mm" }}>{t.absent} : {b.absents.join(lang === "ar" ? "، " : ", ")}</div>}
          </div>
        );
      }
      case "signatures": return <div key={key}><OfficialSignatures config={config} lang={lang} /></div>;
    }
  };

  return <OfficialPages lang={lang} blocks={blocks} renderBlock={renderBlock} contentKey={contentKey} footerText={footer} keepWithNext={(i) => blocks[i].kind === "chartsTitle"} />;
};

export default DiagnosticReportTemplate4;

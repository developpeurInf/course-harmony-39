/**
 * Graphiques des modèles 3 et 4 (« Inclure les graphiques ») : mêmes réglages et mêmes
 * graphiques que le modèle 2 (config.rapport2_graphiques), rendus comme blocs paginés.
 */
import React from "react";
import { DEFAULT_REPORT2_CHARTS, type DiagnosticConfig, type Report2ChartSettings } from "@/lib/diagnosticStorage";
import type { DiagnosticClass } from "@/lib/diagnosticStatsEngine";
import type { DiagLang } from "@/lib/diagnosticTranslations";
import {
  ClassChart, GlobalChart, computeClassChartData, chartDesc, chartLabel,
  type ClassChartData, type ClassChartType, type GlobalChartType,
} from "@/components/diagnostic/ReportCharts";

export type ChartBlock =
  | { kind: "classChart"; nom: string; type: ClassChartType; data: ClassChartData; fig: number }
  | { kind: "chartsTitle" }
  | { kind: "globalChart"; type: GlobalChartType; fig: number };

export interface OfficialChartSet {
  settings: Report2ChartSettings;
  data: ClassChartData[];
  /** graphique de chaque classe (index identique à `classes`), absent si aucun */
  perClass: (ChartBlock & { kind: "classChart" } | undefined)[];
  global: ChartBlock[];
  key: string;
}

export function useOfficialCharts(config: DiagnosticConfig, classes: DiagnosticClass[], includeGraphs: boolean): OfficialChartSet {
  const gs: Report2ChartSettings = { ...DEFAULT_REPORT2_CHARTS, ...(config.rapport2_graphiques || {}) };
  const data = React.useMemo(() => classes.map((c) => computeClassChartData(c)), [classes]);
  const key = JSON.stringify([includeGraphs, gs]);
  return React.useMemo(() => {
    let fig = 0;
    const perTable = includeGraphs && (gs.mode === "per_table" || gs.mode === "both");
    const globalOn = includeGraphs && (gs.mode === "global" || gs.mode === "both") && gs.globaux.length > 0;
    const perClass = classes.map((c, i) => {
      if (!perTable || !data[i] || !data[i].notes.length) return undefined;
      const choice = (gs.types_par_classe || {})[c.nom] || gs.type_par_defaut;
      if (!choice || choice === "none") return undefined;
      return { kind: "classChart" as const, nom: c.nom, type: choice as ClassChartType, data: data[i], fig: ++fig };
    });
    const global: ChartBlock[] = globalOn ? [{ kind: "chartsTitle" }, ...gs.globaux.map((type) => ({ kind: "globalChart" as const, type: type as GlobalChartType, fig: ++fig }))] : [];
    return { settings: gs, data, perClass, global, key };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classes, data, key]);
}

const TXT = {
  ar: { figure: "شكل", charts: "تمثيلات بيانية", all: "جميع الأقسام", of: (n: string, l: string) => `توزيع نتائج قسم ${n} (${l})` },
  fr: { figure: "Figure", charts: "Représentations graphiques", all: "toutes les classes", of: (n: string, l: string) => `Résultats de la classe ${n} (${l.toLowerCase()})` },
  en: { figure: "Figure", charts: "Charts", all: "all classes", of: (n: string, l: string) => `Results of ${n} (${l.toLowerCase()})` },
};

export function renderOfficialChart(b: ChartBlock, key: number, lang: DiagLang, set: OfficialChartSet): React.ReactNode {
  const t = TXT[lang] || TXT.fr;
  const gs = set.settings;
  const caption = (n: number, text: string) => (
    <div className="or-caption">{gs.numeroter ? <b>{t.figure} {n} : </b> : null}{text}</div>
  );
  switch (b.kind) {
    case "chartsTitle":
      return <div key={key} className="or-class-title">{t.charts}</div>;
    case "classChart":
      return (
        <div key={key} className="or-figure">
          <ClassChart type={b.type} data={b.data} lang={lang} palette={gs.palette} />
          {caption(b.fig, t.of(b.nom, chartLabel(b.type, lang)))}
        </div>
      );
    case "globalChart":
      return (
        <div key={key} className="or-figure">
          <GlobalChart type={b.type} classes={set.data} lang={lang} palette={gs.palette} />
          {caption(b.fig, `${chartDesc(b.type, lang)} — ${t.all}`)}
        </div>
      );
  }
}

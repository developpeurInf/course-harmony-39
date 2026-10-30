import React, { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { BarChart2, Check, Palette, Sigma, Hash } from "lucide-react";
import type { DiagLang } from "@/lib/diagnosticTranslations";
import { DEFAULT_REPORT2_CHARTS, DEFAULT_REPORT1_CHARTS, type Report2ChartSettings, type Report1ChartSettings } from "@/lib/diagnosticStorage";
import {
  CLASS_CHARTS, GLOBAL_CHARTS, ClassChart, GlobalChart, SAMPLE_CLASS_DATA, SAMPLE_CLASS_DATA_T1, SAMPLE_CLASSES_T1,
} from "@/components/diagnostic/ReportCharts";

/**
 * Réglages des graphiques du modèle 2 (onglet Rapport) :
 * mode (chaque tableau / ensemble / les deux), bibliothèque de graphiques avec aperçus,
 * choix par classe, palette couleurs / noir & blanc, indicateurs et numérotation des figures.
 */
interface Props {
  lang: DiagLang;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  settings?: Report2ChartSettings;
  onChange: (patch: Partial<Report2ChartSettings>) => void;
  classNames: string[];
}

export default function ChartSettingsPanel({ lang, enabled, onEnabledChange, settings, onChange, classNames }: Props) {
  const L = (ar: string, fr: string, en: string) => (lang === "ar" ? ar : lang === "en" ? en : fr);
  const pick = (t: { ar: string; fr: string; en: string }) => t[lang] || t.fr;
  const gs: Report2ChartSettings = { ...DEFAULT_REPORT2_CHARTS, ...(settings || {}) };
  const ALL = "__all__";
  const [targetRaw, setTarget] = useState<string>(ALL);
  // classe retirée de la sélection : on revient sur « Tous les tableaux »
  const target = targetRaw === ALL || classNames.includes(targetRaw) ? targetRaw : ALL;
  const currentOwn = target === ALL ? undefined : (gs.types_par_classe || {})[target];
  const chartName = (id?: string) => {
    const c = CLASS_CHARTS.find(x => x.id === id);
    return c ? pick(c.label) : "—";
  };
  const setClassChart = (nom: string, value: string) => {
    const next = { ...(gs.types_par_classe || {}) };
    if (value) next[nom] = value;
    else delete next[nom];
    onChange({ types_par_classe: next });
  };
  const checkMark = <Check className="absolute top-1 h-3.5 w-3.5 rounded-full bg-indigo-600 p-0.5 text-white" style={{ right: lang === "ar" ? undefined : 4, left: lang === "ar" ? 4 : undefined }} />;
  const perTable = gs.mode === "per_table" || gs.mode === "both";
  const global = gs.mode === "global" || gs.mode === "both";

  const tile = (active: boolean) =>
    `group relative flex flex-col rounded-lg border-2 bg-white dark:bg-slate-950 p-1.5 text-start transition-colors ${
      active ? "border-indigo-600 ring-2 ring-indigo-600/15" : "border-slate-200 dark:border-slate-800 hover:border-indigo-300"
    }`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="r2-graphs" className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
          <BarChart2 className="w-4 h-4 text-indigo-600" />
          {L("إدراج المبيانات", "Inclure les graphiques", "Include charts")}
        </Label>
        <Switch id="r2-graphs" checked={enabled} onCheckedChange={onEnabledChange} />
      </div>

      {enabled && (
        <>
          {/* Mode */}
          <div className="grid grid-cols-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-0.5">
            {([
              { id: "per_table" as const, label: L("لكل جدول", "Chaque tableau", "Each table") },
              { id: "global" as const, label: L("للمجموع", "L'ensemble", "Overall") },
              { id: "both" as const, label: L("الاثنان", "Les deux", "Both") },
            ]).map(o => (
              <button
                key={o.id}
                type="button"
                onClick={() => onChange({ mode: o.id })}
                className={`rounded-md px-1 py-1.5 text-[11px] font-semibold leading-tight ${
                  gs.mode === o.id ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {/* Bibliothèque : graphique de chaque tableau (un type différent possible pour chaque tableau) */}
          {perTable && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                {L("اختر الجدول ثم نوع مبيانه", "Choisissez le tableau, puis son graphique", "Pick a table, then its chart")}
              </p>
              {/* Tableaux : « Tous » + chaque classe, avec le graphique choisi */}
              <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: "touch" } as any}>
                {[ALL, ...classNames].map(nom => {
                  const active = target === nom;
                  const own = nom === ALL ? gs.type_par_defaut : (gs.types_par_classe || {})[nom];
                  const sub = nom === ALL
                    ? chartName(gs.type_par_defaut)
                    : own === "none" ? L("بدون مبيان", "Sans graphique", "No chart") : own ? chartName(own) : L("كالباقي", "Comme les autres", "Same as others");
                  return (
                    <button
                      key={nom}
                      type="button"
                      onClick={() => setTarget(nom)}
                      className={`flex shrink-0 flex-col items-start rounded-lg border-2 px-2 py-1 text-start ${
                        active ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
                      }`}
                    >
                      <span className="max-w-[120px] truncate text-[11px] font-bold">{nom === ALL ? L("كل الجداول", "Tous les tableaux", "All tables") : nom}</span>
                      <span className={`max-w-[120px] truncate text-[10px] ${own && nom !== ALL ? "text-indigo-700 dark:text-indigo-300 font-semibold" : "text-slate-500"}`}>{sub}</span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {target !== ALL && (
                  <>
                    <button type="button" onClick={() => setClassChart(target, "")} className={tile(!currentOwn)}>
                      <span className="flex h-11 w-full items-center justify-center rounded bg-slate-50 text-[10px] text-slate-500 dark:bg-slate-900">{chartName(gs.type_par_defaut)}</span>
                      <span className="mt-1 truncate text-[10.5px] font-semibold text-slate-800 dark:text-slate-100">{L("كالباقي", "Comme les autres", "Same as others")}</span>
                      {!currentOwn && checkMark}
                    </button>
                    <button type="button" onClick={() => setClassChart(target, "none")} className={tile(currentOwn === "none")}>
                      <span className="flex h-11 w-full items-center justify-center rounded bg-slate-50 text-lg text-slate-400 dark:bg-slate-900">∅</span>
                      <span className="mt-1 truncate text-[10.5px] font-semibold text-slate-800 dark:text-slate-100">{L("بدون مبيان", "Sans graphique", "No chart")}</span>
                      {currentOwn === "none" && checkMark}
                    </button>
                  </>
                )}
                {CLASS_CHARTS.map(c => {
                  const active = target === ALL ? gs.type_par_defaut === c.id : currentOwn === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => (target === ALL ? onChange({ type_par_defaut: c.id }) : setClassChart(target, c.id))}
                      className={tile(active)}
                      title={pick(c.desc)}
                    >
                      <div className="h-11 w-full overflow-hidden rounded bg-slate-50 dark:bg-white" dir="ltr">
                        <ClassChart type={c.id} data={SAMPLE_CLASS_DATA} lang={lang} palette={gs.palette} mini />
                      </div>
                      <span className="mt-1 truncate text-[10.5px] font-semibold text-slate-800 dark:text-slate-100">{pick(c.label)}</span>
                      {active && checkMark}
                    </button>
                  );
                })}
              </div>
              {target === ALL && Object.keys(gs.types_par_classe || {}).some(k => classNames.includes(k)) && (
                <button type="button" onClick={() => onChange({ types_par_classe: {} })} className="text-[11px] font-semibold text-indigo-600 underline">
                  {L("نفس المبيان لكل الجداول", "Même graphique pour tous les tableaux", "Same chart for every table")}
                </button>
              )}
            </div>
          )}

          {/* Bibliothèque : graphiques d'ensemble (choix multiple, dans l'ordre) */}
          {global && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                {L("مبيانات المجموع (اختيار متعدد)", "Graphiques d'ensemble (plusieurs choix)", "Overall charts (multiple choice)")}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {GLOBAL_CHARTS.map(c => {
                  const idx = gs.globaux.indexOf(c.id);
                  const active = idx >= 0;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      title={pick(c.desc)}
                      onClick={() => onChange({ globaux: active ? gs.globaux.filter(x => x !== c.id) : [...gs.globaux, c.id] })}
                      className={tile(active)}
                    >
                      <div className="h-11 w-full overflow-hidden rounded bg-slate-50 dark:bg-white" dir="ltr">
                        <GlobalChart type={c.id} classes={[]} lang={lang} palette={gs.palette} mini />
                      </div>
                      <span className="mt-1 truncate text-[10.5px] font-semibold text-slate-800 dark:text-slate-100">{pick(c.label)}</span>
                      {active && (
                        <span
                          className="absolute top-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[9.5px] font-bold text-white"
                          style={{ right: lang === "ar" ? undefined : 4, left: lang === "ar" ? 4 : undefined }}
                        >
                          {idx + 1}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Options */}
          <div className="space-y-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 p-2.5">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="flex items-center gap-1.5 font-semibold"><Palette className="h-3.5 w-3.5 text-indigo-600" />{L("الألوان", "Couleurs", "Colours")}</span>
              <div className="inline-flex rounded-md bg-white dark:bg-slate-900 p-0.5 shadow-sm">
                {([
                  { id: "color" as const, label: L("ملونة", "Couleurs", "Colour") },
                  { id: "mono" as const, label: L("أبيض وأسود", "Noir & blanc", "Black & white") },
                ]).map(o => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => onChange({ palette: o.id })}
                    className={`rounded px-2 py-1 font-semibold ${gs.palette === o.id ? "bg-indigo-600 text-white" : "text-slate-500"}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center justify-between gap-2 text-[11px] cursor-pointer">
              <span className="flex items-center gap-1.5 font-semibold"><Sigma className="h-3.5 w-3.5 text-indigo-600" />{L("مؤشرات إحصائية تحت كل جدول", "Indicateurs sous chaque tableau", "Statistics under each table")}</span>
              <Switch checked={gs.statistiques} onCheckedChange={v => onChange({ statistiques: v })} />
            </label>
            <label className="flex items-center justify-between gap-2 text-[11px] cursor-pointer">
              <span className="flex items-center gap-1.5 font-semibold"><Hash className="h-3.5 w-3.5 text-indigo-600" />{L("ترقيم الأشكال", "Numéroter les figures", "Number the figures")}</span>
              <Switch checked={gs.numeroter} onCheckedChange={v => onChange({ numeroter: v })} />
            </label>
          </div>
        </>
      )}
    </div>
  );
}


/* ═════════════════════════ Modèle 1 : deux emplacements de graphiques ═════════════════════════ */

interface P1 {
  lang: DiagLang;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  settings?: Report1ChartSettings;
  onChange: (patch: Partial<Report1ChartSettings>) => void;
  chartBg: "gray" | "white";
  onChartBg: (v: "gray" | "white") => void;
}

export function Report1ChartPicker({ lang, enabled, onEnabledChange, settings, onChange, chartBg, onChartBg }: P1) {
  const L = (ar: string, fr: string, en: string) => (lang === "ar" ? ar : lang === "en" ? en : fr);
  const pick = (t: { ar: string; fr: string; en: string }) => t[lang] || t.fr;
  const gs: Report1ChartSettings = { ...DEFAULT_REPORT1_CHARTS, ...(settings || {}) };
  const [slot, setSlot] = useState<"graphe1" | "graphe2">("graphe1");
  const current = gs[slot];

  const tile = (active: boolean) =>
    `group relative flex flex-col rounded-lg border-2 bg-white dark:bg-slate-950 p-1.5 text-start transition-colors ${
      active ? "border-indigo-600 ring-2 ring-indigo-600/15" : "border-slate-200 dark:border-slate-800 hover:border-indigo-300"
    }`;
  const checkMark = <Check className="absolute top-1 h-3.5 w-3.5 rounded-full bg-indigo-600 p-0.5 text-white" style={{ right: lang === "ar" ? undefined : 4, left: lang === "ar" ? 4 : undefined }} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="r1-graphs" className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
          <BarChart2 className="w-4 h-4 text-indigo-600" />
          {L("إدراج المبيانات", "Inclure les graphiques", "Include charts")}
        </Label>
        <Switch id="r1-graphs" checked={enabled} onCheckedChange={onEnabledChange} />
      </div>

      {enabled && (
        <>
          <div className="grid grid-cols-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-0.5">
            {(["graphe1", "graphe2"] as const).map((k, i) => (
              <button
                key={k}
                type="button"
                onClick={() => setSlot(k)}
                className={`rounded-md px-1 py-1.5 text-[11px] font-semibold ${slot === k ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-300"}`}
              >
                {L(`المبيان ${i + 1}`, `Graphique ${i + 1}`, `Chart ${i + 1}`)}
              </button>
            ))}
          </div>

          <button type="button" onClick={() => onChange({ [slot]: "original" } as any)} className={`${tile(current === "original")} w-full`}>
            <span className="text-[11px] font-semibold">{L("المبيان الأصلي للنموذج 1", "Graphique d'origine du modèle 1", "Template 1 original chart")}</span>
            <span className="text-[10px] text-slate-500">{slot === "graphe1" ? L("أعمدة الفئات الأربع", "Colonnes des 4 tranches", "Columns of the 4 bands") : L("حلقة النسب", "Anneau des pourcentages", "Percentage donut")}</span>
            {current === "original" && checkMark}
          </button>

          <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{L("جميع التلاميذ", "Tous les élèves réunis", "All students together")}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {CLASS_CHARTS.map(c => (
              <button key={c.id} type="button" title={pick(c.desc)} onClick={() => onChange({ [slot]: c.id } as any)} className={tile(current === c.id)}>
                <div className="h-11 w-full overflow-hidden rounded bg-slate-50 dark:bg-white" dir="ltr">
                  <ClassChart type={c.id} data={SAMPLE_CLASS_DATA_T1} lang={lang} palette={gs.palette} mini />
                </div>
                <span className="mt-1 truncate text-[10.5px] font-semibold text-slate-800 dark:text-slate-100">{pick(c.label)}</span>
                {current === c.id && checkMark}
              </button>
            ))}
          </div>

          <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{L("مقارنة الأقسام", "Comparaison des classes", "Class comparison")}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {GLOBAL_CHARTS.filter(c => c.id !== "pieAll" && c.id !== "histAll").map(c => (
              <button key={c.id} type="button" title={pick(c.desc)} onClick={() => onChange({ [slot]: c.id } as any)} className={tile(current === c.id)}>
                <div className="h-11 w-full overflow-hidden rounded bg-slate-50 dark:bg-white" dir="ltr">
                  <GlobalChart type={c.id} classes={SAMPLE_CLASSES_T1} lang={lang} palette={gs.palette} mini />
                </div>
                <span className="mt-1 truncate text-[10.5px] font-semibold text-slate-800 dark:text-slate-100">{pick(c.label)}</span>
                {current === c.id && checkMark}
              </button>
            ))}
          </div>

          <div className="space-y-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 p-2.5 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-semibold"><Palette className="h-3.5 w-3.5 text-indigo-600" />{L("الألوان", "Couleurs", "Colours")}</span>
              <div className="inline-flex rounded-md bg-white dark:bg-slate-900 p-0.5 shadow-sm">
                {([
                  { id: "color" as const, label: L("ملونة", "Couleurs", "Colour") },
                  { id: "mono" as const, label: L("أبيض وأسود", "Noir & blanc", "Black & white") },
                ]).map(o => (
                  <button key={o.id} type="button" onClick={() => onChange({ palette: o.id })} className={`rounded px-2 py-1 font-semibold ${gs.palette === o.id ? "bg-indigo-600 text-white" : "text-slate-500"}`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{L("خلفية الإطارات", "Fond des cadres", "Frame background")}</span>
              <div className="inline-flex rounded-md bg-white dark:bg-slate-900 p-0.5 shadow-sm">
                {(["gray", "white"] as const).map(bg => (
                  <button key={bg} type="button" onClick={() => onChartBg(bg)} className={`rounded px-2 py-1 font-semibold ${chartBg === bg ? "bg-indigo-600 text-white" : "text-slate-500"}`}>
                    {bg === "gray" ? L("رمادي", "Gris", "Gray") : L("أبيض", "Blanc", "White")}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

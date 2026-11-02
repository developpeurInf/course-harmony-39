"use client";

import { useEffect, useMemo, useState } from "react";
import { AreaChart, BarChart3, BarChartHorizontal, ChartColumnStacked, ChartPie, ChartScatter, Donut, LineChart, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CHART_PALETTES, renderChart, tableToChartData, type ChartSpec, type ChartType } from "./chartRender";
import type { Tr } from "./useOfficeEnv";

export function ChartDialog({
  open, onClose, initialRows, onInsert, L, initialType,
}: {
  initialType?: string;
  open: boolean;
  onClose: () => void;
  initialRows?: unknown[][] | null;
  onInsert: (png: string, spec: ChartSpec) => void;
  L: Tr;
}) {
  const sample = useMemo<string[][]>(() => [
    ["", L("Série 1", "سلسلة 1", "Series 1"), L("Série 2", "سلسلة 2", "Series 2")],
    [L("Catégorie 1", "فئة 1", "Category 1"), "4.3", "2.4"],
    [L("Catégorie 2", "فئة 2", "Category 2"), "2.5", "4.4"],
    [L("Catégorie 3", "فئة 3", "Category 3"), "3.5", "1.8"],
    [L("Catégorie 4", "فئة 4", "Category 4"), "4.5", "2.8"],
  ], [L]);
  const [grid, setGrid] = useState<string[][]>(sample);
  const [type, setType] = useState<ChartType>("column");
  useEffect(() => { if (open && initialType) setType(initialType as ChartType); }, [open, initialType]);
  const [title, setTitle] = useState("");
  const [pal, setPal] = useState("office");
  const [legend, setLegend] = useState(true);
  const [labels, setLabels] = useState(false);

  useEffect(() => {
    if (!open) return;
    const rows = initialRows && initialRows.length > 1 ? initialRows.map((r) => r.map((v) => (v === null || v === undefined ? "" : String(v)))) : sample;
    setGrid(rows);
    setTitle(L("Titre du graphique", "عنوان المبيان", "Chart title"));
  }, [open, initialRows, sample, L]);

  const spec: ChartSpec = useMemo(() => {
    const d = tableToChartData(grid);
    return { type, title, ...d, palette: CHART_PALETTES[pal], legend, dataLabels: labels, width: 640, height: 400 };
  }, [grid, type, title, pal, legend, labels]);
  const preview = useMemo(() => (open ? renderChart(spec) : ""), [open, spec]);

  const types: { id: ChartType; label: string; icon: typeof BarChart3 }[] = [
    { id: "column", label: L("Histogramme", "أعمدة", "Column"), icon: BarChart3 },
    { id: "stacked", label: L("Empilé", "مكدس", "Stacked"), icon: ChartColumnStacked },
    { id: "bar", label: L("Barres", "أشرطة", "Bar"), icon: BarChartHorizontal },
    { id: "line", label: L("Courbes", "منحنى", "Line"), icon: LineChart },
    { id: "area", label: L("Aires", "مساحات", "Area"), icon: AreaChart },
    { id: "pie", label: L("Secteurs", "دائري", "Pie"), icon: ChartPie },
    { id: "doughnut", label: L("Anneau", "حلقي", "Doughnut"), icon: Donut },
    { id: "scatter", label: L("Nuage de points", "نقط", "Scatter"), icon: ChartScatter },
  ];

  const setCell = (r: number, c: number, v: string) => setGrid((g) => g.map((row, ri) => (ri === r ? row.map((x, ci) => (ci === c ? v : x)) : row)));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{L("Insérer un graphique", "إدراج مبيان", "Insert chart")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-1.5">
              {types.map((t) => (
                <button key={t.id} type="button" onClick={() => setType(t.id)} className={cn("flex flex-col items-center gap-1 rounded-md border p-2 text-[11px] hover:bg-muted", type === t.id && "border-[color:var(--office-accent)] bg-[color:var(--office-accent-soft)]")}>
                  <t.icon className="h-5 w-5" />
                  {t.label}
                </button>
              ))}
            </div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={L("Titre", "العنوان", "Title")} className="h-9 w-full rounded-md border bg-background px-2 text-sm" />
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {Object.entries(CHART_PALETTES).map(([k, cols]) => (
                <button key={k} type="button" onClick={() => setPal(k)} className={cn("flex overflow-hidden rounded border", pal === k && "ring-2 ring-[color:var(--office-accent)]")} title={k}>
                  {cols.slice(0, 5).map((c) => <span key={c} className="h-5 w-3" style={{ background: c }} />)}
                </button>
              ))}
              <label className="ms-auto flex items-center gap-1.5"><input type="checkbox" checked={legend} onChange={(e) => setLegend(e.target.checked)} /> {L("Légende", "مفتاح", "Legend")}</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} /> {L("Étiquettes", "القيم", "Labels")}</label>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="text-xs">
                <tbody>
                  {grid.map((row, r) => (
                    <tr key={r}>
                      {row.map((v, c) => (
                        <td key={c} className="border p-0">
                          <input value={v} onChange={(e) => setCell(r, c, e.target.value)} className={cn("h-7 w-24 bg-transparent px-1.5 focus:bg-[color:var(--office-accent-soft)] focus:outline-none", (r === 0 || c === 0) && "font-semibold")} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setGrid((g) => [...g, g[0].map((_, i) => (i === 0 ? `${L("Catégorie", "فئة", "Category")} ${g.length}` : "0"))])}><Plus className="me-1 h-3.5 w-3.5" />{L("Ligne", "صف", "Row")}</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setGrid((g) => g.map((row, i) => [...row, i === 0 ? `${L("Série", "سلسلة", "Series")} ${row.length}` : "0"]))}><Plus className="me-1 h-3.5 w-3.5" />{L("Série", "سلسلة", "Series")}</Button>
              <Button type="button" size="sm" variant="ghost" disabled={grid.length <= 2} onClick={() => setGrid((g) => g.slice(0, -1))}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
          <div className="flex items-start justify-center rounded-md border bg-white p-2">
            {preview && <img src={preview} alt="" className="h-auto w-full" />}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{L("Annuler", "إلغاء", "Cancel")}</Button>
          <Button onClick={() => { onInsert(renderChart(spec), spec); onClose(); }} style={{ background: "var(--office-accent)" }} className="text-white">
            {L("Insérer", "إدراج", "Insert")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

/**
 * Excel — tableur complet dans le navigateur (moteur Univer, open source) :
 * plus de 400 formules, mise en forme, formats de nombres, fusion, bordures,
 * volets figés, tri, filtres, mise en forme conditionnelle, validation des
 * données, rechercher / remplacer, liens, images, notes, tableaux, graphiques.
 * Import / export .xlsx et .csv.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createUniver, LocaleType, mergeLocales, type IWorkbookData } from "@univerjs/presets";
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import { UniverSheetsConditionalFormattingPreset } from "@univerjs/preset-sheets-conditional-formatting";
import { UniverSheetsDataValidationPreset } from "@univerjs/preset-sheets-data-validation";
import { UniverSheetsFilterPreset } from "@univerjs/preset-sheets-filter";
import { UniverSheetsSortPreset } from "@univerjs/preset-sheets-sort";
import { UniverSheetsFindReplacePreset } from "@univerjs/preset-sheets-find-replace";
import { UniverSheetsHyperLinkPreset } from "@univerjs/preset-sheets-hyper-link";
import { UniverSheetsDrawingPreset } from "@univerjs/preset-sheets-drawing";
import { UniverSheetsNotePreset } from "@univerjs/preset-sheets-note";
import { UniverSheetsTablePreset } from "@univerjs/preset-sheets-table";
import "@univerjs/preset-sheets-core/lib/index.css";
import "@univerjs/preset-sheets-conditional-formatting/lib/index.css";
import "@univerjs/preset-sheets-data-validation/lib/index.css";
import "@univerjs/preset-sheets-filter/lib/index.css";
import "@univerjs/preset-sheets-sort/lib/index.css";
import "@univerjs/preset-sheets-find-replace/lib/index.css";
import "@univerjs/preset-sheets-hyper-link/lib/index.css";
import "@univerjs/preset-sheets-drawing/lib/index.css";
import "@univerjs/preset-sheets-note/lib/index.css";
import "@univerjs/preset-sheets-table/lib/index.css";
import { downloadBlob } from "@/lib/download";
import { OfficeShell, type ExportFormat } from "../shared/OfficeShell";
import { useOfficeEnv } from "../shared/useOfficeEnv";
import { useOfficeFile } from "../shared/useOfficeFile";
import { readFileAsArrayBuffer, stripExt } from "../shared/officeStore";
import { ChartDialog } from "../shared/ChartDialog";
import { GridThumb } from "../shared/Thumbs";
import { blankWorkbook, csvToUniver, univerSheetToCsv, univerToXlsx, xlsxToUniver } from "./xlsxConvert";
import { buildExcelTemplate, excelTemplates } from "./templates";

type FUniver = ReturnType<typeof createUniver>["univerAPI"];
type LocaleKey = "fr-FR" | "ar-SA" | "en-US";

// Traductions de chaque module, chargées seulement pour la langue utilisée
const LOCALE_FILES: Record<LocaleKey, () => Promise<unknown[]>> = {
  "fr-FR": () => Promise.all([
    import("@univerjs/preset-sheets-core/locales/fr-FR"), import("@univerjs/preset-sheets-conditional-formatting/locales/fr-FR"),
    import("@univerjs/preset-sheets-data-validation/locales/fr-FR"), import("@univerjs/preset-sheets-filter/locales/fr-FR"),
    import("@univerjs/preset-sheets-sort/locales/fr-FR"), import("@univerjs/preset-sheets-find-replace/locales/fr-FR"),
    import("@univerjs/preset-sheets-hyper-link/locales/fr-FR"), import("@univerjs/preset-sheets-drawing/locales/fr-FR"),
    import("@univerjs/preset-sheets-note/locales/fr-FR"), import("@univerjs/preset-sheets-table/locales/fr-FR"),
  ]),
  "ar-SA": () => Promise.all([
    import("@univerjs/preset-sheets-core/locales/ar-SA"), import("@univerjs/preset-sheets-conditional-formatting/locales/ar-SA"),
    import("@univerjs/preset-sheets-data-validation/locales/ar-SA"), import("@univerjs/preset-sheets-filter/locales/ar-SA"),
    import("@univerjs/preset-sheets-sort/locales/ar-SA"), import("@univerjs/preset-sheets-find-replace/locales/ar-SA"),
    import("@univerjs/preset-sheets-hyper-link/locales/ar-SA"), import("@univerjs/preset-sheets-drawing/locales/ar-SA"),
    import("@univerjs/preset-sheets-note/locales/ar-SA"), import("@univerjs/preset-sheets-table/locales/ar-SA"),
  ]),
  "en-US": () => Promise.all([
    import("@univerjs/preset-sheets-core/locales/en-US"), import("@univerjs/preset-sheets-conditional-formatting/locales/en-US"),
    import("@univerjs/preset-sheets-data-validation/locales/en-US"), import("@univerjs/preset-sheets-filter/locales/en-US"),
    import("@univerjs/preset-sheets-sort/locales/en-US"), import("@univerjs/preset-sheets-find-replace/locales/en-US"),
    import("@univerjs/preset-sheets-hyper-link/locales/en-US"), import("@univerjs/preset-sheets-drawing/locales/en-US"),
    import("@univerjs/preset-sheets-note/locales/en-US"), import("@univerjs/preset-sheets-table/locales/en-US"),
  ]),
};
const LOCALE_TYPE: Record<LocaleKey, LocaleType> = { "fr-FR": LocaleType.FR_FR, "ar-SA": LocaleType.AR_SA, "en-US": LocaleType.EN_US };

const FONTS = [
  "Calibri", "Arial", "Times New Roman", "Cambria", "Verdana", "Tahoma", "Georgia", "Trebuchet MS", "Courier New",
  "Segoe UI", "Aptos", "Cairo", "Tajawal", "Amiri", "Noto Naskh Arabic", "Inter", "Poppins",
].map((f) => ({ value: f, label: f, category: "sans-serif" as const }));

export default function ExcelEditor() {
  const { L, language, dir, dark } = useOfficeEnv();
  const hostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<FUniver | null>(null);
  const univerRef = useRef<ReturnType<typeof createUniver>["univer"] | null>(null);
  const pendingRef = useRef<IWorkbookData | null>(null);
  const [ready, setReady] = useState(false);
  const [backstage, setBackstage] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [chartRows, setChartRows] = useState<unknown[][] | null>(null);
  const suppressRef = useRef(false);

  const snapshot = useCallback((): IWorkbookData | null => {
    try {
      return (apiRef.current?.getActiveWorkbook()?.save() as IWorkbookData) || pendingRef.current;
    } catch {
      return pendingRef.current;
    }
  }, []);

  const file = useOfficeFile<IWorkbookData>("excel", () => {
    const data = snapshot();
    if (!data) return null;
    const first = data.sheets?.[data.sheetOrder?.[0]] as { name?: string } | undefined;
    return { data, preview: `${data.sheetOrder.length} ${L("feuille(s)", "ورقة", "sheet(s)")} · ${first?.name || ""}` };
  });
  const { markDirty } = file;
  const markDirtyRef = useRef(markDirty);
  markDirtyRef.current = markDirty;

  const localeKey: LocaleKey = language === "ar" ? "ar-SA" : language === "en" ? "en-US" : "fr-FR";
  const darkRef = useRef(dark);
  darkRef.current = dark;

  /** (Re)crée le tableur avec un classeur */
  const mount = useCallback(async (data: IWorkbookData) => {
    pendingRef.current = data;
    const host = hostRef.current;
    if (!host) return;
    setReady(false);
    try { univerRef.current?.dispose(); } catch { /* déjà libéré */ }
    univerRef.current = null;
    apiRef.current = null;
    host.innerHTML = "";
    const container = document.createElement("div");
    container.style.cssText = "width:100%;height:100%";
    host.appendChild(container);

    const mods = (await LOCALE_FILES[localeKey]()) as { default: object }[];
    const { univer, univerAPI } = createUniver({
      locale: LOCALE_TYPE[localeKey],
      locales: { [LOCALE_TYPE[localeKey]]: mergeLocales(...mods.map((m) => m.default)) } as never,
      darkMode: darkRef.current,
      presets: [
        UniverSheetsCorePreset({ container, ribbonType: "classic", customFontFamily: { override: false, list: FONTS } as never, footer: {} as never }),
        UniverSheetsConditionalFormattingPreset(),
        UniverSheetsDataValidationPreset(),
        UniverSheetsFilterPreset(),
        UniverSheetsSortPreset(),
        UniverSheetsFindReplacePreset(),
        UniverSheetsHyperLinkPreset(),
        UniverSheetsDrawingPreset(),
        UniverSheetsNotePreset(),
        UniverSheetsTablePreset(),
      ],
    });
    univerRef.current = univer;
    apiRef.current = univerAPI;
    suppressRef.current = true;
    univerAPI.createWorkbook(data);
    // les mutations (modifications réelles du classeur) déclenchent l'enregistrement auto
    univerAPI.addEvent(univerAPI.Event.CommandExecuted, (ev: { type: number }) => {
      if (ev.type === 2 && !suppressRef.current) markDirtyRef.current();
    });
    setTimeout(() => { suppressRef.current = false; }, 400);

    // Bouton « Graphique » dans le ruban Insertion d'Univer
    try {
      univerAPI.registerComponent("office-chart-icon", () => <BarChart3 style={{ width: 16, height: 16 }} />);
      univerAPI.createMenu({
        id: "office-insert-chart",
        icon: "office-chart-icon",
        title: L("Graphique", "مبيان", "Chart"),
        tooltip: L("Insérer un graphique à partir de la sélection", "إدراج مبيان انطلاقا من التحديد", "Insert a chart from the selection"),
        action: () => openChart(),
      }).appendTo(["ribbon.insert.media", "contextMenu.others"]);
    } catch (e) {
      console.warn("chart menu", e);
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localeKey]);

  const openChart = () => {
    try {
      const range = apiRef.current?.getActiveWorkbook()?.getActiveRange();
      const vals = range?.getValues() as unknown[][] | undefined;
      setChartRows(vals && vals.length > 1 ? vals : null);
    } catch { setChartRows(null); }
    setChartOpen(true);
  };

  const insertChart = async (png: string) => {
    const ws = apiRef.current?.getActiveWorkbook()?.getActiveSheet();
    if (!ws) return;
    let col = 1, row = 1;
    try {
      const r = apiRef.current?.getActiveWorkbook()?.getActiveRange();
      if (r) { col = r.getLastColumn() + 2; row = r.getRow(); }
    } catch { /* sélection absente */ }
    const ok = await (ws as unknown as { insertImage: (u: string, c: number, r: number) => Promise<boolean> }).insertImage(png, col, row);
    if (!ok) toast.error(L("Impossible d'insérer le graphique.", "تعذر إدراج المبيان.", "Could not insert the chart."));
    else markDirtyRef.current();
  };

  // Premier affichage : dernier classeur ouvert, sinon classeur vide
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    (async () => {
      const rec = await file.loadLast();
      if (rec?.data) await mount(rec.data);
      else {
        const name = L("Classeur1", "مصنف1", "Book1");
        const id = file.startFile(name);
        await mount(blankWorkbook(name, id, L("Feuil1", "ورقة1", "Sheet1")));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Changement de langue : on recrée l'interface avec le classeur courant
  const prevLocale = useRef(localeKey);
  useEffect(() => {
    if (prevLocale.current === localeKey) return;
    prevLocale.current = localeKey;
    const data = snapshot();
    if (data) void mount(data);
  }, [localeKey, mount, snapshot]);

  useEffect(() => {
    try { apiRef.current?.toggleDarkMode(dark); } catch { /* ancien moteur */ }
  }, [dark, ready]);

  useEffect(() => () => {
    try { univerRef.current?.dispose(); } catch { /* déjà libéré */ }
  }, []);

  const onNew = async (tid: string) => {
    await file.saveNow();
    const name = tid === "blank" ? L("Classeur", "مصنف", "Book") + (Math.floor(Math.random() * 90) + 10) : excelTemplates(L).find((t) => t.id === tid)?.label || "Classeur";
    const id = file.startFile(name);
    await mount(buildExcelTemplate(tid, name, id, L));
    void file.saveNow();
  };

  const onOpenFile = async (f: File) => {
    const t = toast.loading(L("Ouverture…", "جارٍ الفتح…", "Opening…"));
    try {
      await file.saveNow();
      const name = stripExt(f.name);
      const id = file.startFile(name);
      let data: IWorkbookData;
      if (/\.(csv|txt|tsv)$/i.test(f.name)) data = csvToUniver(await f.text(), name, id);
      else data = await xlsxToUniver(await readFileAsArrayBuffer(f), name, id);
      await mount(data);
      void file.saveNow();
      toast.success(L("Classeur ouvert", "تم فتح المصنف", "Workbook opened"), { id: t });
    } catch (e) {
      console.error(e);
      toast.error(L("Ce fichier n'a pas pu être lu (.xlsx ou .csv attendu).", "تعذرت قراءة هذا الملف (المطلوب ‎.xlsx أو ‎.csv).", "This file could not be read (.xlsx or .csv expected)."), { id: t });
    }
  };

  const onOpenRecent = async (id: string) => {
    await file.saveNow();
    const rec = await file.openRecord(id);
    if (rec?.data) await mount(rec.data);
  };

  const formats: ExportFormat[] = [
    { id: "xlsx", ext: "xlsx", label: L("Classeur Excel", "مصنف Excel", "Excel workbook"), desc: L("S'ouvre dans Excel, LibreOffice, Google Sheets", "يفتح في Excel وLibreOffice وGoogle Sheets", "Opens in Excel, LibreOffice, Google Sheets") },
    { id: "csv", ext: "csv", label: L("CSV (feuille active)", "CSV (الورقة النشطة)", "CSV (active sheet)"), desc: L("Valeurs séparées par des points-virgules", "قيم مفصولة بفواصل منقوطة", "Semicolon-separated values") },
  ];

  const onExport = async (fid: string) => {
    const data = snapshot();
    if (!data) return;
    const name = file.fileName || "Classeur";
    if (fid === "csv") {
      const sid = apiRef.current?.getActiveWorkbook()?.getActiveSheet()?.getSheetId();
      const csv = "﻿" + univerSheetToCsv(data, sid);
      await downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${name}.csv`);
    } else {
      const blob = await univerToXlsx(data, apiRef.current?.getActiveWorkbook() as never);
      await downloadBlob(blob, `${name}.xlsx`);
    }
  };

  const onPrint = () => {
    const data = snapshot();
    if (!data) return;
    const sid = apiRef.current?.getActiveWorkbook()?.getActiveSheet()?.getSheetId() || data.sheetOrder[0];
    printSheet(data, sid, file.fileName, dir);
  };

  return (
    <OfficeShell
      app="excel"
      L={L}
      dir={dir}
      dark={dark}
      fileName={file.fileName}
      onRename={(n) => {
        file.rename(n);
      }}
      saveState={file.saveState}
      onSaveNow={() => void file.saveNow()}
      onUndo={() => void apiRef.current?.undo()}
      onRedo={() => void apiRef.current?.redo()}
      templates={excelTemplates(L).map((t) => ({ ...t, thumb: <GridThumb accent="#217346" variant={t.id} /> }))}
      onNew={onNew}
      accept=".xlsx,.xlsm,.csv,.tsv"
      onOpenFile={onOpenFile}
      onOpenRecent={onOpenRecent}
      currentId={file.fileId}
      formats={formats}
      onExport={onExport}
      onPrint={onPrint}
      backstageOpen={backstage}
      setBackstageOpen={setBackstage}
      ribbon={
        <div className="flex h-9 shrink-0 items-center gap-1 border-b bg-card px-2">
          <button type="button" onClick={() => setBackstage(true)} className="h-7 rounded-md px-3 text-[13px] font-semibold text-white" style={{ background: "#217346" }}>
            {L("Fichier", "ملف", "File")}
          </button>
          <button type="button" onClick={openChart} className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[12.5px] hover:bg-muted">
            <BarChart3 className="h-4 w-4 text-[#217346]" /> {L("Graphique", "مبيان", "Chart")}
          </button>
          <span className="ms-auto hidden truncate text-[11.5px] text-muted-foreground md:block">
            {L("Astuce : tapez = pour une formule (SOMME, MOYENNE, SI, RECHERCHEV…)", "نصيحة: اكتب = لإدخال صيغة (SUM، AVERAGE، IF، VLOOKUP…)", "Tip: type = for a formula (SUM, AVERAGE, IF, VLOOKUP…)")}
          </span>
        </div>
      }
    >
      <div ref={hostRef} dir="ltr" className="office-univer min-h-0 flex-1" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70">
          <Loader2 className="h-6 w-6 animate-spin text-[#217346]" />
        </div>
      )}
      <ChartDialog open={chartOpen} onClose={() => setChartOpen(false)} initialRows={chartRows} onInsert={(png) => void insertChart(png)} L={L} />
    </OfficeShell>
  );
}

/** Impression de la feuille active (tableau HTML avec styles de base) */
function printSheet(data: IWorkbookData, sid: string, title: string, dir: "rtl" | "ltr") {
  const sh = data.sheets[sid] as unknown as { cellData?: Record<string, Record<string, { v?: unknown; s?: unknown }>>; mergeData?: { startRow: number; endRow: number; startColumn: number; endColumn: number }[]; columnData?: Record<string, { w?: number }>; rightToLeft?: number };
  const cd = sh?.cellData || {};
  const rows = Object.keys(cd).map(Number);
  if (!rows.length) { window.print(); return; }
  const maxR = Math.max(...rows);
  let maxC = 0;
  rows.forEach((r) => Object.keys(cd[r] || {}).forEach((c) => (maxC = Math.max(maxC, +c))));
  const styles = (data.styles || {}) as Record<string, Record<string, any>>;
  const covered = new Set<string>();
  const spans = new Map<string, string>();
  (sh.mergeData || []).forEach((m) => {
    spans.set(`${m.startRow}:${m.startColumn}`, ` rowspan="${m.endRow - m.startRow + 1}" colspan="${m.endColumn - m.startColumn + 1}"`);
    for (let r = m.startRow; r <= m.endRow; r++) for (let c = m.startColumn; c <= m.endColumn; c++) if (r !== m.startRow || c !== m.startColumn) covered.add(`${r}:${c}`);
  });
  const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch] as string));
  let html = "<table>";
  html += `<colgroup>${Array.from({ length: maxC + 1 }, (_, c) => `<col style="width:${sh.columnData?.[c]?.w || 88}px">`).join("")}</colgroup>`;
  for (let r = 0; r <= maxR; r++) {
    html += "<tr>";
    for (let c = 0; c <= maxC; c++) {
      if (covered.has(`${r}:${c}`)) continue;
      const cell = cd[r]?.[c];
      const s = (typeof cell?.s === "string" ? styles[cell.s] : (cell?.s as Record<string, any>)) || {};
      const css = [
        s.bl ? "font-weight:bold" : "", s.it ? "font-style:italic" : "", s.ul?.s ? "text-decoration:underline" : "",
        s.cl?.rgb ? `color:${s.cl.rgb}` : "", s.bg?.rgb ? `background:${s.bg.rgb}` : "", s.fs ? `font-size:${s.fs}pt` : "",
        s.ff ? `font-family:'${s.ff}'` : "", s.ht === 2 ? "text-align:center" : s.ht === 3 ? "text-align:right" : "",
        typeof cell?.v === "number" && !s.ht ? "text-align:right" : "",
      ].filter(Boolean).join(";");
      const v = typeof cell?.v === "number" ? (Math.round((cell.v as number) * 100) / 100).toLocaleString() : cell?.v;
      html += `<td${spans.get(`${r}:${c}`) || ""} style="${css}">${esc(v)}</td>`;
    }
    html += "</tr>";
  }
  html += "</table>";
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!doctype html><html dir="${sh.rightToLeft ? "rtl" : dir}"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    @page{margin:12mm} body{font-family:Calibri,Arial,sans-serif;font-size:11pt;margin:0}
    table{border-collapse:collapse;table-layout:fixed} td{border:1px solid #d0d0d0;padding:2px 4px;overflow:hidden;white-space:nowrap}
  </style></head><body>${html}<script>window.onload=function(){setTimeout(function(){window.print()},200)}</script></body></html>`);
  w.document.close();
}

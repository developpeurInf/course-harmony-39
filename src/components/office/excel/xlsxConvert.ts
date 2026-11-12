/**
 * Conversion .xlsx (ExcelJS) ⇄ classeur Univer (IWorkbookData).
 * Conservé : valeurs, formules, styles (police, couleurs, remplissage, alignement,
 * retour à la ligne, rotation, bordures, format des nombres), fusions, largeurs
 * de colonnes, hauteurs de lignes, lignes/colonnes masquées, volets figés,
 * couleur et visibilité des onglets, quadrillage, sens droite → gauche.
 */
import type { IWorkbookData, IWorksheetData, IStyleData, ICellData, IRange } from "@univerjs/presets";

type ExcelJSNS = typeof import("exceljs");
type AnyObj = Record<string, any>;

const PX_PER_CHAR = 7;
const ptToPx = (pt: number) => Math.round((pt * 96) / 72);
const pxToPt = (px: number) => Math.round(((px * 72) / 96) * 100) / 100;

const BORDER_TO_U: Record<string, number> = {
  thin: 1, hair: 2, dotted: 3, dashed: 4, dashDot: 5, dashDotDot: 6, double: 7, medium: 8,
  mediumDashed: 9, mediumDashDot: 10, mediumDashDotDot: 11, slantDashDot: 12, thick: 13,
};
const BORDER_FROM_U = Object.fromEntries(Object.entries(BORDER_TO_U).map(([k, v]) => [v, k])) as Record<number, string>;
const H_TO_U: Record<string, number> = { left: 1, center: 2, right: 3, justify: 4, distributed: 6, centerContinuous: 2, fill: 1 };
const H_FROM_U: Record<number, string> = { 1: "left", 2: "center", 3: "right", 4: "justify", 5: "justify", 6: "distributed" };
const V_TO_U: Record<string, number> = { top: 1, middle: 2, bottom: 3, justify: 2, distributed: 2 };
const V_FROM_U: Record<number, string> = { 1: "top", 2: "middle", 3: "bottom" };

// Couleurs du thème Office par défaut (pour les couleurs « theme » d'Excel)
const THEME_COLORS = ["FFFFFF", "000000", "E7E6E6", "44546A", "4472C4", "ED7D31", "A5A5A5", "FFC000", "5B9BD5", "70AD47"];

function tint(hex: string, t: number) {
  const n = parseInt(hex, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (t > 0) { r += (255 - r) * t; g += (255 - g) * t; b += (255 - b) * t; } else if (t < 0) { r *= 1 + t; g *= 1 + t; b *= 1 + t; }
  const h = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
  return `${h(r)}${h(g)}${h(b)}`;
}

function colorToRgb(c: AnyObj | undefined): string | undefined {
  if (!c) return undefined;
  if (typeof c.argb === "string") {
    const a = c.argb.length === 8 ? c.argb.slice(2) : c.argb;
    return `#${a}`;
  }
  if (typeof c.theme === "number") return `#${tint(THEME_COLORS[c.theme] || "000000", c.tint || 0)}`;
  if (typeof c.indexed === "number") {
    const idx: Record<number, string> = { 8: "000000", 9: "FFFFFF", 10: "FF0000", 11: "00FF00", 12: "0000FF", 13: "FFFF00", 14: "FF00FF", 15: "00FFFF", 64: "000000" };
    return idx[c.indexed] ? `#${idx[c.indexed]}` : undefined;
  }
  return undefined;
}
const rgbToArgb = (rgb?: string | null) => {
  if (!rgb) return undefined;
  let h = rgb.replace("#", "");
  if (/^rgb/i.test(rgb)) {
    const m = rgb.match(/\d+/g) || [];
    h = m.slice(0, 3).map((x) => Number(x).toString(16).padStart(2, "0")).join("");
  }
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  return `FF${h.toUpperCase()}`;
};

function styleFromExcel(cell: AnyObj): IStyleData | null {
  const s: IStyleData = {};
  const f = cell.font;
  if (f) {
    if (f.name) s.ff = f.name;
    if (f.size) s.fs = f.size;
    if (f.bold) s.bl = 1;
    if (f.italic) s.it = 1;
    if (f.underline) s.ul = { s: 1 };
    if (f.strike) s.st = { s: 1 };
    const cl = colorToRgb(f.color);
    if (cl) s.cl = { rgb: cl };
    if (f.vertAlign === "superscript") s.va = 3 as any;
    if (f.vertAlign === "subscript") s.va = 2 as any;
  }
  const fill = cell.fill;
  if (fill && fill.type === "pattern" && fill.pattern && fill.pattern !== "none") {
    const bg = colorToRgb(fill.fgColor) || colorToRgb(fill.bgColor);
    if (bg) s.bg = { rgb: bg };
  } else if (fill && fill.type === "gradient" && fill.stops?.length) {
    const bg = colorToRgb(fill.stops[0].color);
    if (bg) s.bg = { rgb: bg };
  }
  const a = cell.alignment;
  if (a) {
    if (a.horizontal && H_TO_U[a.horizontal]) s.ht = H_TO_U[a.horizontal] as any;
    if (a.vertical && V_TO_U[a.vertical]) s.vt = V_TO_U[a.vertical] as any;
    if (a.wrapText) s.tb = 3 as any;
    if (typeof a.textRotation === "number" && a.textRotation) s.tr = { a: a.textRotation > 90 ? 90 - a.textRotation : a.textRotation, v: 0 } as any;
    if (a.textRotation === "vertical") s.tr = { a: 0, v: 1 } as any;
    if (a.readingOrder === "rtl") s.td = 2 as any;
  }
  const b = cell.border;
  if (b) {
    const bd: AnyObj = {};
    for (const [k, u] of [["top", "t"], ["bottom", "b"], ["left", "l"], ["right", "r"]] as const) {
      const e = b[k];
      if (e?.style && BORDER_TO_U[e.style]) bd[u] = { s: BORDER_TO_U[e.style], cl: { rgb: colorToRgb(e.color) || "#000000" } };
    }
    if (Object.keys(bd).length) s.bd = bd;
  }
  if (cell.numFmt && cell.numFmt !== "General") s.n = { pattern: cell.numFmt };
  return Object.keys(s).length ? s : null;
}

function styleToExcel(st: IStyleData | null | undefined): AnyObj {
  const s = st as AnyObj | null | undefined;
  const out: AnyObj = {};
  if (!s) return out;
  const font: AnyObj = {};
  if (s.ff) font.name = s.ff;
  if (s.fs) font.size = s.fs;
  if (s.bl) font.bold = true;
  if (s.it) font.italic = true;
  if (s.ul?.s) font.underline = true;
  if (s.st?.s) font.strike = true;
  if (s.cl?.rgb) font.color = { argb: rgbToArgb(s.cl.rgb) };
  if ((s.va as any) === 3) font.vertAlign = "superscript";
  if ((s.va as any) === 2) font.vertAlign = "subscript";
  if (Object.keys(font).length) out.font = font;
  if (s.bg?.rgb) out.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rgbToArgb(s.bg.rgb) } };
  const al: AnyObj = {};
  if (s.ht && H_FROM_U[s.ht as number]) al.horizontal = H_FROM_U[s.ht as number];
  if (s.vt && V_FROM_U[s.vt as number]) al.vertical = V_FROM_U[s.vt as number];
  if ((s.tb as number) === 3) al.wrapText = true;
  const tr = s.tr as AnyObj | undefined;
  if (tr?.v) al.textRotation = "vertical";
  else if (tr?.a) al.textRotation = tr.a < 0 ? 90 - tr.a : tr.a;
  if ((s.td as any) === 2) al.readingOrder = "rtl";
  if (Object.keys(al).length) out.alignment = al;
  const bd = s.bd as AnyObj | undefined;
  if (bd) {
    const border: AnyObj = {};
    for (const [u, k] of [["t", "top"], ["b", "bottom"], ["l", "left"], ["r", "right"]] as const) {
      const e = bd[u];
      if (e?.s && BORDER_FROM_U[e.s]) border[k] = { style: BORDER_FROM_U[e.s], color: { argb: rgbToArgb(e.cl?.rgb || "#000000") } };
    }
    if (Object.keys(border).length) out.border = border;
  }
  if (s.n?.pattern) out.numFmt = s.n.pattern;
  return out;
}

function decodeRange(ref: string): IRange | null {
  const m = ref.replace(/\$/g, "").match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i);
  if (!m) return null;
  const col = (s: string) => s.toUpperCase().split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const r1 = +m[2] - 1, c1 = col(m[1]);
  const r2 = m[4] ? +m[4] - 1 : r1, c2 = m[3] ? col(m[3]) : c1;
  return { startRow: Math.min(r1, r2), endRow: Math.max(r1, r2), startColumn: Math.min(c1, c2), endColumn: Math.max(c1, c2) };
}

const excelDateToJs = (d: Date) => (d.getTime() - Date.UTC(1899, 11, 30)) / 86400000;

/** .xlsx → classeur Univer */
export async function xlsxToUniver(buf: ArrayBuffer, name: string, id: string): Promise<IWorkbookData> {
  const ExcelJS = ((await import("exceljs")) as unknown as { default?: ExcelJSNS }).default || ((await import("exceljs")) as unknown as ExcelJSNS);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const styles: Record<string, IStyleData> = {};
  const styleIds = new Map<string, string>();
  const styleId = (s: IStyleData) => {
    const key = JSON.stringify(s);
    let sid = styleIds.get(key);
    if (!sid) {
      sid = `s${styleIds.size + 1}`;
      styleIds.set(key, sid);
      styles[sid] = s;
    }
    return sid;
  };
  const sheets: Record<string, Partial<IWorksheetData>> = {};
  const sheetOrder: string[] = [];

  wb.eachSheet((ws: AnyObj, idx: number) => {
    const sid = `sheet-${idx}`;
    sheetOrder.push(sid);
    const cellData: Record<number, Record<number, ICellData>> = {};
    let maxR = 0, maxC = 0;
    ws.eachRow({ includeEmpty: true }, (row: AnyObj, rn: number) => {
      row.eachCell({ includeEmpty: true }, (cell: AnyObj, cn: number) => {
        const r = rn - 1, c = cn - 1;
        const out: ICellData = {};
        const v = cell.value;
        if (v !== null && v !== undefined) {
          if (typeof v === "number") { out.v = v; out.t = 2 as any; }
          else if (typeof v === "boolean") { out.v = v ? 1 : 0; out.t = 3 as any; }
          else if (typeof v === "string") { out.v = v; out.t = 1 as any; }
          else if (v instanceof Date) { out.v = excelDateToJs(v); out.t = 2 as any; }
          else if (typeof v === "object") {
            if ("formula" in v || "sharedFormula" in v) {
              const formula = v.formula || (cell.formula as string);
              if (formula) out.f = `=${formula}`;
              const res = v.result;
              if (res !== undefined && res !== null && typeof res !== "object") out.v = res instanceof Date ? excelDateToJs(res) : res;
            } else if ("richText" in v) {
              out.v = (v.richText as AnyObj[]).map((t) => t.text).join("");
              out.t = 1 as any;
            } else if ("hyperlink" in v) {
              out.v = typeof v.text === "string" ? v.text : (v.text?.richText || []).map((t: AnyObj) => t.text).join("") || v.hyperlink;
              out.t = 1 as any;
            } else if ("error" in v) {
              out.v = v.error;
            }
          }
        }
        const st = styleFromExcel(cell);
        if (st) out.s = styleId(st);
        if (out.v === undefined && !out.f && !out.s) return;
        (cellData[r] ||= {})[c] = out;
        maxR = Math.max(maxR, r);
        maxC = Math.max(maxC, c);
      });
    });

    const rowData: Record<number, AnyObj> = {};
    ws.eachRow({ includeEmpty: true }, (row: AnyObj, rn: number) => {
      const rd: AnyObj = {};
      if (row.height) { rd.h = ptToPx(row.height); rd.ia = 0; }
      if (row.hidden) rd.hd = 1;
      if (Object.keys(rd).length) rowData[rn - 1] = rd;
    });
    const columnData: Record<number, AnyObj> = {};
    (ws.columns || []).forEach((col: AnyObj, i: number) => {
      if (!col) return;
      const cd: AnyObj = {};
      if (col.width) cd.w = Math.round(col.width * PX_PER_CHAR + 5);
      if (col.hidden) cd.hd = 1;
      if (Object.keys(cd).length) columnData[i] = cd;
    });
    const merges: IRange[] = [];
    const mm = ws.model?.merges || [];
    for (const ref of mm) { const rg = decodeRange(ref); if (rg) merges.push(rg); }
    const view = (ws.views || [])[0] || {};
    const xs = view.state === "frozen" ? view.xSplit || 0 : 0;
    const ys = view.state === "frozen" ? view.ySplit || 0 : 0;
    sheets[sid] = {
      id: sid,
      name: ws.name,
      tabColor: colorToRgb(ws.properties?.tabColor) || "",
      hidden: ws.state && ws.state !== "visible" ? 1 : 0,
      rowCount: Math.max(1000, maxR + 50),
      columnCount: Math.max(26, maxC + 10),
      defaultColumnWidth: ws.properties?.defaultColWidth ? Math.round(ws.properties.defaultColWidth * PX_PER_CHAR + 5) : 88,
      defaultRowHeight: ws.properties?.defaultRowHeight ? ptToPx(ws.properties.defaultRowHeight) : 24,
      mergeData: merges,
      cellData: cellData as any,
      rowData: rowData as any,
      columnData: columnData as any,
      freeze: { xSplit: xs, ySplit: ys, startRow: ys || -1, startColumn: xs || -1 },
      showGridlines: view.showGridLines === false ? 0 : 1,
      rightToLeft: view.rightToLeft ? 1 : 0,
      zoomRatio: view.zoomScale ? view.zoomScale / 100 : 1,
    } as any;
  });

  if (!sheetOrder.length) return blankWorkbook(name, id);
  return { id, name, appVersion: "1.3.1", locale: "frFR" as any, styles, sheetOrder, sheets } as unknown as IWorkbookData;
}

interface FacadeRangeReader {
  getSheetBySheetId?: (id: string) => any;
}

/** Classeur Univer → .xlsx (Blob). `wbFacade` sert à relire les formules recopiées (partagées). */
export async function univerToXlsx(data: IWorkbookData, wbFacade?: FacadeRangeReader): Promise<Blob> {
  const ExcelJS = ((await import("exceljs")) as unknown as { default?: ExcelJSNS }).default || ((await import("exceljs")) as unknown as ExcelJSNS);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Math infini — Outils Office";
  wb.created = new Date();
  const styles = (data.styles || {}) as Record<string, IStyleData>;
  for (const sid of data.sheetOrder) {
    const sh = data.sheets[sid] as IWorksheetData;
    if (!sh) continue;
    const fz = sh.freeze || ({} as AnyObj);
    const ws = wb.addWorksheet(sh.name.slice(0, 31) || "Feuille", {
      properties: { tabColor: sh.tabColor ? { argb: rgbToArgb(sh.tabColor) } : undefined, defaultRowHeight: pxToPt(sh.defaultRowHeight || 24) } as AnyObj,
      state: sh.hidden ? "hidden" : "visible",
      views: [{
        state: fz.xSplit || fz.ySplit ? "frozen" : "normal",
        xSplit: fz.xSplit || 0,
        ySplit: fz.ySplit || 0,
        showGridLines: sh.showGridlines !== 0,
        rightToLeft: sh.rightToLeft === 1,
        zoomScale: Math.round((sh.zoomRatio || 1) * 100),
      } as AnyObj],
    });
    const fSheet = wbFacade?.getSheetBySheetId?.(sid);
    const cd = (sh.cellData || {}) as Record<string, Record<string, ICellData>>;
    for (const [rs, row] of Object.entries(cd)) {
      const r = +rs;
      for (const [cs, cell] of Object.entries(row || {})) {
        const c = +cs;
        if (!cell) continue;
        const xc = ws.getCell(r + 1, c + 1);
        let f = cell.f || null;
        if (!f && cell.si && fSheet) {
          try { f = fSheet.getRange(r, c).getFormula() || null; } catch { /* formule introuvable */ }
        }
        let v: any = cell.v;
        if ((v === undefined || v === null) && cell.p) {
          const ds: string = (cell.p as AnyObj)?.body?.dataStream || "";
          v = ds.replace(/\r\n$/, "").replace(/\r/g, "\n");
        }
        if (f) {
          xc.value = { formula: f.replace(/^=/, ""), result: v === undefined || v === null ? undefined : v } as any;
        } else if (v !== undefined && v !== null && v !== "") {
          if ((cell.t as any) === 3) xc.value = v === 1 || v === true || v === "TRUE";
          else if ((cell.t as any) === 2 || (typeof v === "number" && (cell.t as any) !== 1 && (cell.t as any) !== 4)) xc.value = Number(v);
          else xc.value = String(v);
        }
        const s = typeof cell.s === "string" ? styles[cell.s] : (cell.s as IStyleData | undefined);
        const xs = styleToExcel(s);
        if (xs.font) xc.font = xs.font;
        if (xs.fill) xc.fill = xs.fill;
        if (xs.alignment) xc.alignment = xs.alignment;
        if (xs.border) xc.border = xs.border;
        if (xs.numFmt) xc.numFmt = xs.numFmt;
      }
    }
    for (const [rs, rd] of Object.entries((sh.rowData || {}) as Record<string, AnyObj>)) {
      const row = ws.getRow(+rs + 1);
      if (rd?.h && rd.h !== (sh.defaultRowHeight || 24)) row.height = pxToPt(rd.h);
      if (rd?.hd) row.hidden = true;
    }
    for (const [cs, cd2] of Object.entries((sh.columnData || {}) as Record<string, AnyObj>)) {
      const col = ws.getColumn(+cs + 1);
      if (cd2?.w) col.width = Math.max(1, Math.round(((cd2.w - 5) / PX_PER_CHAR) * 100) / 100);
      if (cd2?.hd) col.hidden = true;
    }
    for (const m of sh.mergeData || []) {
      try { ws.mergeCells(m.startRow + 1, m.startColumn + 1, m.endRow + 1, m.endColumn + 1); } catch { /* fusion qui se chevauche */ }
    }
  }
  const out = await wb.xlsx.writeBuffer();
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/** CSV (première feuille ou feuille active) */
export function univerSheetToCsv(data: IWorkbookData, sheetId?: string): string {
  const sid = sheetId || data.sheetOrder[0];
  const sh = data.sheets[sid] as IWorksheetData;
  const cd = (sh?.cellData || {}) as Record<string, Record<string, ICellData>>;
  const rows = Object.keys(cd).map(Number);
  if (!rows.length) return "";
  const maxR = Math.max(...rows);
  let maxC = 0;
  for (const r of rows) for (const c of Object.keys(cd[r] || {})) maxC = Math.max(maxC, +c);
  const esc = (v: unknown) => {
    const s = v === undefined || v === null ? "" : String(v);
    return /[";\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines: string[] = [];
  for (let r = 0; r <= maxR; r++) {
    const cells: string[] = [];
    for (let c = 0; c <= maxC; c++) cells.push(esc(cd[r]?.[c]?.v));
    lines.push(cells.join(";"));
  }
  return lines.join("\r\n");
}

/** CSV → classeur (séparateur détecté : ; , ou tabulation) */
export function csvToUniver(text: string, name: string, id: string): IWorkbookData {
  const first = text.split(/\r?\n/, 1)[0] || "";
  const sep = [";", "\t", ","].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); rows.push(row); row = []; cur = "";
    } else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const wb = blankWorkbook(name, id);
  const sh = wb.sheets[wb.sheetOrder[0]] as IWorksheetData;
  const cd: AnyObj = {};
  rows.forEach((r, ri) => r.forEach((v, ci) => {
    if (v === "") return;
    const num = Number(v.replace(",", "."));
    (cd[ri] ||= {})[ci] = v.trim() !== "" && !isNaN(num) && /^-?[\d\s]*[.,]?\d+$/.test(v.trim()) ? { v: num, t: 2 } : { v, t: 1 };
  }));
  sh.cellData = cd;
  sh.rowCount = Math.max(1000, rows.length + 50);
  return wb;
}

export function blankWorkbook(name: string, id: string, sheetName = "Feuil1"): IWorkbookData {
  return {
    id,
    name,
    appVersion: "1.3.1",
    locale: "frFR" as any,
    styles: {},
    sheetOrder: ["sheet-1"],
    sheets: {
      "sheet-1": {
        id: "sheet-1",
        name: sheetName,
        rowCount: 1000,
        columnCount: 26,
        defaultColumnWidth: 88,
        defaultRowHeight: 24,
        cellData: {},
        mergeData: [],
        rowData: {},
        columnData: {},
        showGridlines: 1,
      } as unknown as IWorksheetData,
    },
  } as unknown as IWorkbookData;
}

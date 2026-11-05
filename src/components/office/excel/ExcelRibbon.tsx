"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Ruban Excel (Accueil, Insertion, Mise en page, Formules, Données, Révision, Affichage,
 * Automatiser, Aide) relié au moteur du tableur. Reprend la disposition d'Excel :
 * Presse-papiers · Police · Alignement · Nombre · Styles · Cellules · Édition · Compléments.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AArrowDown, AArrowUp, AlignCenter, AlignLeft, AlignRight, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart,
  ArrowDownAZ, ArrowDownToLine, ArrowDownZA, ArrowRightLeft, ArrowRightToLine, Baseline, Blocks, Bold, BookOpen, Bot, Calculator, CaseLower,
  CaseSensitive, CaseUpper, ChartColumn, ChartLine, ChartPie, CircleHelp, Clipboard, Columns3, Combine, Copy, CopyX, Eraser, Eye, Filter, FilterX,
  Grid2x2, Grid3x3, Hash, ImagePlus, IndentDecrease, IndentIncrease, Info, Italic, Keyboard, LayoutGrid, Link, ListFilter, ListOrdered, Lock,
  Maximize, MessageSquare, Omega, PaintBucket, Paintbrush, PanelTop, PilcrowRight, Printer, Repeat, Replace, RotateCcw, Rows3, Ruler, Scaling,
  Scissors, Search, Settings2, Share2, ShieldCheck, Sigma, Smile, Snowflake, Sparkles, Split, SquareFunction, SquareMinus, SquarePlus, StickyNote,
  Strikethrough, Subscript, Superscript, Table2, TableCellsMerge, TableCellsSplit, Trash2, Underline, Wand2, WrapText, ZoomIn, ZoomOut,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BigBtn, ColorButton, MenuItem, RGroup, RMenu, RRow, RSelect, RStack, RibbonBody, RibbonTabStrip, SmallBtn, type OfficeTab } from "../shared/Ribbon";
import type { Tr } from "../shared/useOfficeEnv";

type Api = any;
export interface PageSetup { orientation: "portrait" | "landscape"; size: "A4" | "A3" | "Letter"; margin: "normal" | "narrow" | "wide"; gridlines: boolean; headings: boolean }

const FONTS = ["Aptos Narrow", "Aptos", "Calibri", "Arial", "Times New Roman", "Cambria", "Verdana", "Tahoma", "Georgia", "Trebuchet MS", "Courier New", "Segoe UI", "Cairo", "Tajawal", "Amiri", "Noto Naskh Arabic"];
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

function useNumberFormats(L: Tr) {
  return [
    { value: "General", label: L("Standard", "عام", "General") },
    { value: "#,##0.00", label: L("Nombre", "رقم", "Number") },
    { value: '#,##0.00 "DH"', label: L("Monétaire", "عملة", "Currency") },
    { value: '_-* #,##0.00 "DH"_-', label: L("Comptabilité", "محاسبة", "Accounting") },
    { value: "dd/mm/yyyy", label: L("Date courte", "تاريخ قصير", "Short date") },
    { value: "dddd d mmmm yyyy", label: L("Date longue", "تاريخ طويل", "Long date") },
    { value: "hh:mm:ss", label: L("Heure", "الوقت", "Time") },
    { value: "0.00%", label: L("Pourcentage", "نسبة مئوية", "Percentage") },
    { value: "# ?/?", label: L("Fraction", "كسر", "Fraction") },
    { value: "0.00E+00", label: L("Scientifique", "علمي", "Scientific") },
    { value: "@", label: L("Texte", "نص", "Text") },
  ];
}

/** Petite icône en forme de glyphe (pour « , » « ‰ » « .00 ») */
const glyph = (text: string, className?: string): LucideIcon =>
  (function Glyph(props: { className?: string }) {
    return <span className={cn("inline-flex h-4 min-w-4 items-center justify-center text-[13px] font-bold leading-none", props.className, className)}>{text}</span>;
  }) as unknown as LucideIcon;
const CommaIcon = glyph("9", "font-serif text-[15px]");
const DecIncIcon = glyph("←.0", "text-[10px]");
const DecDecIcon = glyph(".00→", "text-[10px]");

export function ExcelRibbon({
  api, ready, L, onFile, onChart, onShare, onPrint, page, setPage,
}: {
  api: () => Api | null;
  ready: boolean;
  L: Tr;
  onFile: () => void;
  onChart: (kind?: string) => void;
  onShare: () => void;
  onPrint: () => void;
  page: PageSetup;
  setPage: (p: PageSetup) => void;
}) {
  const [tab, setTab] = useState("home");
  const [st, setSt] = useState<any>({});
  const [lastFill, setLastFill] = useState("#FFFF00");
  const [lastColor, setLastColor] = useState("#FF0000");
  const [lastBorder, setLastBorder] = useState<string>("bottom");
  const [ctx, setCtx] = useState({ gridlines: true, frozen: false, rtl: false, zoom: 100, filter: false });
  const numFormats = useNumberFormats(L);

  const wb = () => api()?.getActiveWorkbook();
  const ws = () => wb()?.getActiveSheet();
  const R = () => wb()?.getActiveRange();
  const cmd = async (id: string, params?: object) => {
    try { return await api()?.executeCommand(id, params); } catch (e) { console.warn(id, e); return false; }
  };
  const safe = (fn: () => unknown, msg?: string) => {
    try {
      const r = fn();
      if (r instanceof Promise) r.catch((e) => { console.warn(e); if (msg) toast.error(msg); });
    } catch (e) { console.warn(e); if (msg) toast.error(msg); }
    setTimeout(refresh, 30);
  };

  // ---------- état de la cellule active ----------
  const refresh = useCallback(() => {
    try {
      const r = api()?.getActiveWorkbook()?.getActiveRange();
      const s = r?.getCellStyleData?.() || {};
      setSt({ ...s, merged: !!r?.isMerged?.() });
      const sh = api()?.getActiveWorkbook()?.getActiveSheet();
      if (sh) setCtx({
        gridlines: !sh.hasHiddenGridLines?.(),
        frozen: !!(sh.getFreeze?.()?.xSplit || sh.getFreeze?.()?.ySplit),
        rtl: !!sh.getSheet?.()?.getConfig?.()?.rightToLeft,
        zoom: Math.round((sh.getZoom?.() || 1) * 100),
        filter: !!sh.getFilter?.(),
      });
    } catch { /* pas de sélection */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const raf = useRef(0);
  useEffect(() => {
    const a = api();
    if (!a || !ready) return;
    const later = () => { cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(refresh); };
    const subs = [a.addEvent(a.Event.SelectionChanged, later), a.addEvent(a.Event.CommandExecuted, later)];
    later();
    return () => subs.forEach((d: { dispose?: () => void }) => d?.dispose?.());
  }, [ready, api, refresh]);

  const on = (k: string) => !!st?.[k] && (typeof st[k] === "object" ? !!st[k].s : st[k] === 1);
  const font = st?.ff || "Aptos Narrow";
  const size = st?.fs || 11;
  const rawPattern = st?.n?.pattern || "General";
  const pattern = ["General", "#,##0.00", '#,##0.00 "DH"', '_-* #,##0.00 "DH"_-', "dd/mm/yyyy", "dddd d mmmm yyyy", "hh:mm:ss", "0.00%", "# ?/?", "0.00E+00", "@"].includes(rawPattern)
    ? rawPattern
    : /%/.test(rawPattern) ? "0.00%" : /E\+/.test(rawPattern) ? "0.00E+00" : /h+:m+/i.test(rawPattern) ? "hh:mm:ss" : /[dy]/i.test(rawPattern) ? "dd/mm/yyyy" : /DH|€|\$|£/.test(rawPattern) ? '#,##0.00 "DH"' : /[#0]/.test(rawPattern) ? "#,##0.00" : rawPattern;

  // ---------- actions ----------
  const setFont = (f: string) => cmd("sheet.command.set-range-font-family", { value: f });
  const setSize = (n: number) => cmd("sheet.command.set-range-fontsize", { value: n });
  const setFill = (c: string | null) => { if (c) { setLastFill(c); safe(() => R()?.setBackgroundColor(c)); } else cmd("sheet.command.reset-background-color"); };
  const setColor = (c: string | null) => { if (c) { setLastColor(c); cmd("sheet.command.set-range-text-color", { value: c }); } else cmd("sheet.command.reset-range-text-color"); };
  const border = (type: string, style = 1, color = "#000000") => {
    setLastBorder(type);
    const a = api();
    safe(() => R()?.setBorder(type, type === "none" ? a.Enum.BorderStyleTypes.NONE : style, color));
  };
  const hAlign = (v: "left" | "center" | "right") => safe(() => R()?.setHorizontalAlignment(v));
  const vAlign = (v: "top" | "middle" | "bottom") => safe(() => R()?.setVerticalAlignment(v));
  const numfmt = (p: string) => safe(() => R()?.setNumberFormat(p), L("Format impossible", "تعذر التنسيق", "Format failed"));
  const indent = (delta: number) => {
    const cur = Number(st?.pd?.l || 0);
    const next = Math.max(0, cur + delta * 12);
    void cmd("sheet.command.set-style", { style: { type: "pd", value: { t: st?.pd?.t ?? 0, b: st?.pd?.b ?? 0, l: next, r: st?.pd?.r ?? 0 } } });
    if (delta > 0 && !st?.ht) hAlign("left");
  };
  const merge = (mode: "center" | "across" | "all" | "unmerge") => {
    const r = R();
    if (!r) return;
    if (mode === "unmerge") return safe(() => r.breakApart());
    if (mode === "across") return void cmd("sheet.command.add-worksheet-merge-horizontal");
    safe(() => { r.merge(); if (mode === "center") r.setHorizontalAlignment("center"); }, L("Fusion impossible", "تعذر الدمج", "Cannot merge"));
  };
  const cellStyle = (s: { bg?: string; cl?: string; bold?: boolean; size?: number; border?: string; italic?: boolean }) => safe(() => {
    const r = R();
    if (!r) return;
    r.setBackgroundColor(s.bg || "#FFFFFF");
    r.setFontColor(s.cl || "#000000");
    r.setFontWeight(s.bold ? "bold" : "normal");
    r.setFontStyle(s.italic ? "italic" : "normal");
    if (s.size) r.setFontSize(s.size);
    if (s.border) r.setBorder(api().Enum.BorderType.BOTTOM, s.border === "double" ? api().Enum.BorderStyleTypes.DOUBLE : api().Enum.BorderStyleTypes.THICK, s.border === "double" ? "#000000" : s.border);
  });

  const formatAsTable = async (style: number) => {
    const r = R(), sh = ws();
    if (!r || !sh) return;
    let rg = r.getRange();
    if (rg.endRow === rg.startRow && rg.endColumn === rg.startColumn) {
      try { const d = r.getDataRegion?.(); if (d) rg = d.getRange(); } catch { /* sélection seule */ }
    }
    const id = `t${Date.now().toString(36)}`;
    const ok = await sh.addTable(`${L("Tableau", "جدول", "Table")}${Math.floor(Math.random() * 900) + 100}`, { startRow: rg.startRow, startColumn: rg.startColumn, endRow: rg.endRow, endColumn: rg.endColumn }, id, { tableStyleId: `table-default-${style}` });
    if (!ok) toast.error(L("Sélectionnez une plage avec une ligne d'en-tête (sans cellules fusionnées ni autre tableau).", "حدد نطاقا يحتوي على صف عناوين (بدون خلايا مدمجة أو جدول آخر).", "Select a range with a header row (no merged cells or other table)."));
  };

  /** Somme automatique (et Moyenne, NB, Max, Min) façon Excel */
  const autoFn = (fn: string) => safe(() => {
    const r = R(), sh = ws();
    if (!r || !sh) return;
    const g = r.getRange();
    const col = (c: number) => { let s = ""; c++; while (c) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
    const isNum = (row: number, c: number) => { const v = sh.getRange(row, c).getValue(); return typeof v === "number"; };
    if (g.startRow === g.endRow && g.startColumn === g.endColumn) {
      // cellule seule : on remonte la colonne, sinon on part vers la gauche
      let top = g.startRow - 1;
      while (top >= 0 && isNum(top, g.startColumn)) top--;
      if (top < g.startRow - 1) { r.setFormula(`=${fn}(${col(g.startColumn)}${top + 2}:${col(g.startColumn)}${g.startRow})`); return; }
      let left = g.startColumn - 1;
      while (left >= 0 && isNum(g.startRow, left)) left--;
      if (left < g.startColumn - 1) { r.setFormula(`=${fn}(${col(left + 1)}${g.startRow + 1}:${col(g.startColumn - 1)}${g.startRow + 1})`); return; }
      toast.info(L("Sélectionnez d'abord les nombres à calculer.", "حدد الأرقام أولا.", "Select the numbers first."));
      return;
    }
    // plage : résultat sous chaque colonne
    for (let c = g.startColumn; c <= g.endColumn; c++) sh.getRange(g.endRow + 1, c).setFormula(`=${fn}(${col(c)}${g.startRow + 1}:${col(c)}${g.endRow + 1})`);
  });

  /** Transforme les valeurs texte de la sélection */
  const mapValues = (fn: (v: unknown) => unknown, label: string) => safe(() => {
    const r = R();
    if (!r) return;
    const vals = r.getValues() as unknown[][];
    const formulas = (r.getFormulas?.() || []) as string[][];
    r.setValues(vals.map((row, i) => row.map((v, j) => (formulas[i]?.[j] ? formulas[i][j] : fn(v)))));
    toast.success(label);
  });
  const removeDuplicates = () => safe(() => {
    const r = R();
    if (!r) return;
    const vals = r.getValues() as unknown[][];
    const seen = new Set<string>();
    const kept = vals.filter((row) => { const k = JSON.stringify(row); if (seen.has(k)) return false; seen.add(k); return true; });
    const removed = vals.length - kept.length;
    const width = vals[0]?.length || 1;
    r.setValues([...kept, ...Array.from({ length: removed }, () => Array(width).fill(null))]);
    toast.success(L(`${removed} doublon(s) supprimé(s), ${kept.length} valeur(s) unique(s) conservée(s).`, `تم حذف ${removed} من التكرارات، والإبقاء على ${kept.length} قيمة فريدة.`, `${removed} duplicate(s) removed, ${kept.length} unique value(s) kept.`));
  });
  const fillSeries = () => safe(() => {
    const r = R();
    if (!r) return;
    const vals = r.getValues() as unknown[][];
    let n = 1;
    r.setValues(vals.map((row) => row.map(() => n++)));
  });
  const stats = () => {
    try {
      const vals = (R()?.getValues() || []) as unknown[][];
      const flat = vals.flat().filter((v) => v !== null && v !== "" && v !== undefined);
      const nums = flat.filter((v): v is number => typeof v === "number");
      const sum = nums.reduce((a, b) => a + b, 0);
      toast.info(`${L("Cellules non vides", "خلايا غير فارغة", "Non-empty cells")} : ${flat.length} · ${L("Nombres", "أرقام", "Numbers")} : ${nums.length} · ${L("Somme", "المجموع", "Sum")} : ${Math.round(sum * 100) / 100} · ${L("Moyenne", "المعدل", "Average")} : ${nums.length ? Math.round((sum / nums.length) * 100) / 100 : "—"}`, { duration: 8000 });
    } catch { /* rien */ }
  };
  const freeze = (mode: "panes" | "row" | "col" | "none") => safe(() => {
    const sh = ws();
    if (!sh) return;
    if (mode === "none") return sh.cancelFreeze();
    if (mode === "row") return sh.setFrozenRows(1);
    if (mode === "col") return sh.setFrozenColumns(1);
    const g = R()?.getRange();
    if (!g) return;
    if (g.startRow) sh.setFrozenRows(g.startRow);
    if (g.startColumn) sh.setFrozenColumns(g.startColumn);
  });
  const zoom = (v: number) => safe(() => ws()?.zoom(Math.max(0.1, Math.min(4, v))));
  const insertSymbol = (s: string) => safe(() => {
    const r = R();
    const v = r?.getValue();
    r?.setValue(v === null || v === undefined || v === "" ? s : `${v}${s}`);
  });

  // ---------- onglets ----------
  const tabs: OfficeTab[] = [
    { id: "home", label: L("Accueil", "الصفحة الرئيسية", "Home") },
    { id: "insert", label: L("Insertion", "إدراج", "Insert") },
    { id: "layout", label: L("Mise en page", "تخطيط الصفحة", "Page Layout") },
    { id: "formulas", label: L("Formules", "صيغ", "Formulas") },
    { id: "data", label: L("Données", "بيانات", "Data") },
    { id: "review", label: L("Révision", "مراجعة", "Review") },
    { id: "view", label: L("Affichage", "عرض", "View") },
    { id: "automate", label: L("Automatiser", "أتمتة", "Automate") },
    { id: "help", label: L("Aide", "تعليمات", "Help") },
  ];
  const dropDown = (close: () => void, fn: () => unknown) => () => { close(); fn(); setTimeout(refresh, 30); };

  return (
    <>
      <RibbonTabStrip
        tabs={tabs}
        value={tab}
        onChange={setTab}
        onFile={onFile}
        fileLabel={L("Fichier", "ملف", "File")}
        accent="#217346"
        end={
          <div className="flex items-center gap-1.5">
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => void cmd("sheet.operation.add-note-popup")} className="flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] hover:bg-muted">
              <MessageSquare className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{L("Commentaires", "تعليقات", "Comments")}</span>
            </button>
            <button type="button" onClick={onShare} className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium text-white" style={{ background: "#217346" }}>
              <Share2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{L("Partager", "مشاركة", "Share")}</span>
            </button>
          </div>
        }
      />
      <RibbonBody>
        {tab === "home" && (
          <>
            <RGroup label={L("Presse-papiers", "الحافظة", "Clipboard")}>
              <RMenu big icon={Clipboard} label={L("Coller", "لصق", "Paste")} width={220}>
                {(close) => (
                  <>
                    <MenuItem icon={Clipboard} label={L("Coller", "لصق", "Paste")} hint="Ctrl+V" onClick={dropDown(close, () => api()?.paste())} />
                    <MenuItem icon={Hash} label={L("Coller les valeurs", "لصق القيم", "Paste values")} onClick={dropDown(close, () => cmd("sheet.command.paste-value"))} />
                    <MenuItem icon={SquareFunction} label={L("Coller les formules", "لصق الصيغ", "Paste formulas")} onClick={dropDown(close, () => cmd("sheet.command.paste-formula"))} />
                    <MenuItem icon={Paintbrush} label={L("Coller la mise en forme", "لصق التنسيق", "Paste formatting")} onClick={dropDown(close, () => cmd("sheet.command.paste-format"))} />
                    <MenuItem icon={Columns3} label={L("Coller la largeur des colonnes", "لصق عرض الأعمدة", "Paste column widths")} onClick={dropDown(close, () => cmd("sheet.command.paste-col-width"))} />
                    <MenuItem icon={Grid2x2} label={L("Coller sans bordures", "لصق بدون حدود", "Paste without borders")} onClick={dropDown(close, () => cmd("sheet.command.paste-besides-border"))} />
                  </>
                )}
              </RMenu>
              <RStack>
                <SmallBtn icon={Scissors} label={L("Couper (Ctrl+X)", "قص (Ctrl+X)", "Cut (Ctrl+X)")} onClick={() => { void api()?.copy(); setTimeout(() => void cmd("sheet.command.clear-selection-all"), 50); }} />
                <RRow>
                  <SmallBtn icon={Copy} label={L("Copier (Ctrl+C)", "نسخ (Ctrl+C)", "Copy (Ctrl+C)")} onClick={() => void api()?.copy()} />
                  <RMenu label={L("Copier", "نسخ", "Copy")} width={200}>
                    {(close) => (
                      <>
                        <MenuItem icon={Copy} label={L("Copier", "نسخ", "Copy")} onClick={dropDown(close, () => api()?.copy())} />
                        <MenuItem icon={SquareFunction} label={L("Copier la formule seule", "نسخ الصيغة فقط", "Copy formula only")} onClick={dropDown(close, () => cmd("sheet.command.copy-formula-only"))} />
                      </>
                    )}
                  </RMenu>
                </RRow>
                <SmallBtn icon={Paintbrush} label={L("Reproduire la mise en forme (double-clic : plusieurs fois)", "نسخ التنسيق", "Format Painter")} onClick={() => void cmd("sheet.command.set-once-format-painter")} />
              </RStack>
            </RGroup>

            <RGroup label={L("Police", "الخط", "Font")}>
              <RStack>
                <RRow>
                  <RSelect title={L("Police", "الخط", "Font")} width={150} value={font} onChange={(v) => void setFont(v)} options={(FONTS.includes(font) ? FONTS : [font, ...FONTS]).map((f) => ({ value: f, label: f, style: { fontFamily: f } }))} />
                  <RSelect editable title={L("Taille de police", "حجم الخط", "Font size")} width={58} value={String(size)} onChange={(v) => { const n = parseFloat(v); if (n > 0 && n < 410) void setSize(n); }} options={SIZES.map((s) => ({ value: String(s), label: String(s) }))} />
                  <SmallBtn icon={AArrowUp} label={L("Augmenter la taille de police", "تكبير الخط", "Increase font size")} onClick={() => void cmd("sheet.command.set-range-font-increase")} />
                  <SmallBtn icon={AArrowDown} label={L("Diminuer la taille de police", "تصغير الخط", "Decrease font size")} onClick={() => void cmd("sheet.command.set-range-font-decrease")} />
                </RRow>
                <RRow>
                  <SmallBtn icon={Bold} label={L("Gras (Ctrl+B)", "غامق (Ctrl+B)", "Bold (Ctrl+B)")} active={on("bl")} onClick={() => void cmd("sheet.command.set-range-bold")} />
                  <SmallBtn icon={Italic} label={L("Italique (Ctrl+I)", "مائل (Ctrl+I)", "Italic (Ctrl+I)")} active={on("it")} onClick={() => void cmd("sheet.command.set-range-italic")} />
                  <SmallBtn icon={Underline} label={L("Souligné (Ctrl+U)", "تسطير (Ctrl+U)", "Underline (Ctrl+U)")} active={on("ul")} onClick={() => void cmd("sheet.command.set-range-underline")} />
                  <RMenu label={L("Plus d'options de police", "خيارات الخط", "More font options")} width={190}>
                    {(close) => (
                      <>
                        <MenuItem icon={Strikethrough} label={L("Barré", "يتوسطه خط", "Strikethrough")} active={on("st")} onClick={dropDown(close, () => cmd("sheet.command.set-range-stroke"))} />
                        <MenuItem icon={Superscript} label={L("Exposant", "مرتفع", "Superscript")} onClick={dropDown(close, () => cmd("sheet.command.set-range-superscript"))} />
                        <MenuItem icon={Subscript} label={L("Indice", "منخفض", "Subscript")} onClick={dropDown(close, () => cmd("sheet.command.set-range-subscript"))} />
                      </>
                    )}
                  </RMenu>
                  <span className="mx-0.5 h-5 w-px bg-border" />
                  <SmallBtn icon={Grid2x2} label={L("Bordures", "الحدود", "Borders")} onClick={() => border(lastBorder)} />
                  <RMenu label={L("Bordures", "الحدود", "Borders")} width={250}>
                    {(close) => (
                      <>
                        {([
                          ["bottom", L("Bordure inférieure", "حد سفلي", "Bottom border")], ["top", L("Bordure supérieure", "حد علوي", "Top border")],
                          ["left", L("Bordure gauche", "حد أيسر", "Left border")], ["right", L("Bordure droite", "حد أيمن", "Right border")],
                          ["none", L("Aucune bordure", "بلا حدود", "No border")], ["all", L("Toutes les bordures", "كل الحدود", "All borders")],
                          ["outside", L("Bordures extérieures", "حدود خارجية", "Outside borders")], ["inside", L("Bordures intérieures", "حدود داخلية", "Inside borders")],
                        ] as const).map(([t, lab]) => <MenuItem key={t} icon={Grid2x2} label={lab} onClick={dropDown(close, () => border(t))} />)}
                        <div className="my-1 border-t" />
                        <MenuItem icon={Grid2x2} label={L("Bordure extérieure épaisse", "حد خارجي سميك", "Thick outside border")} onClick={dropDown(close, () => border("outside", 13))} />
                        <MenuItem icon={Grid2x2} label={L("Double bordure inférieure", "حد سفلي مزدوج", "Bottom double border")} onClick={dropDown(close, () => border("bottom", 7))} />
                        <MenuItem icon={Grid2x2} label={L("Bordure inférieure épaisse", "حد سفلي سميك", "Thick bottom border")} onClick={dropDown(close, () => border("bottom", 13))} />
                        <MenuItem icon={Grid2x2} label={L("Bordures pointillées", "حدود منقطة", "Dotted borders")} onClick={dropDown(close, () => border("all", 3))} />
                        <MenuItem icon={Grid2x2} label={L("Diagonale", "قطري", "Diagonal")} onClick={dropDown(close, () => border("tlbr"))} />
                      </>
                    )}
                  </RMenu>
                  <ColorButton icon={PaintBucket} label={L("Couleur de remplissage", "لون التعبئة", "Fill color")} color={lastFill} customLabel={L("Autres couleurs…", "ألوان أخرى…", "More colors…")} noneLabel={L("Aucun remplissage", "بلا تعبئة", "No fill")} onNone={() => setFill(null)} onApply={setFill} />
                  <ColorButton icon={Baseline} label={L("Couleur de police", "لون الخط", "Font color")} color={lastColor} customLabel={L("Autres couleurs…", "ألوان أخرى…", "More colors…")} noneLabel={L("Automatique", "تلقائي", "Automatic")} onNone={() => setColor(null)} onApply={setColor} />
                </RRow>
              </RStack>
            </RGroup>

            <RGroup label={L("Alignement", "المحاذاة", "Alignment")}>
              <RStack>
                <RRow>
                  <SmallBtn icon={AlignVerticalJustifyStart} label={L("Aligner en haut", "محاذاة لأعلى", "Top align")} active={st?.vt === 1} onClick={() => vAlign("top")} />
                  <SmallBtn icon={AlignVerticalJustifyCenter} label={L("Aligner au centre", "توسيط عمودي", "Middle align")} active={st?.vt === 2} onClick={() => vAlign("middle")} />
                  <SmallBtn icon={AlignVerticalJustifyEnd} label={L("Aligner en bas", "محاذاة لأسفل", "Bottom align")} active={!st?.vt || st?.vt === 3} onClick={() => vAlign("bottom")} />
                  <RMenu label={L("Orientation", "الاتجاه", "Orientation")} icon={RotateCcw} width={240}>
                    {(close) => (
                      <>
                        <MenuItem icon={RotateCcw} label={L("Rotation antihoraire (45°)", "تدوير عكس عقارب الساعة", "Angle counterclockwise")} onClick={dropDown(close, () => R()?.setTextRotation(45))} />
                        <MenuItem icon={RotateCcw} label={L("Rotation horaire (−45°)", "تدوير مع عقارب الساعة", "Angle clockwise")} onClick={dropDown(close, () => R()?.setTextRotation(-45))} />
                        <MenuItem icon={ArrowDownToLine} label={L("Texte vertical", "نص عمودي", "Vertical text")} onClick={dropDown(close, () => cmd("sheet.command.set-text-rotation", { value: "v" }))} />
                        <MenuItem icon={RotateCcw} label={L("Rotation du texte vers le haut", "تدوير النص لأعلى", "Rotate text up")} onClick={dropDown(close, () => R()?.setTextRotation(90))} />
                        <MenuItem icon={RotateCcw} label={L("Rotation du texte vers le bas", "تدوير النص لأسفل", "Rotate text down")} onClick={dropDown(close, () => R()?.setTextRotation(-90))} />
                        <MenuItem icon={RotateCcw} label={L("Aucune rotation", "بلا تدوير", "No rotation")} onClick={dropDown(close, () => R()?.setTextRotation(0))} />
                      </>
                    )}
                  </RMenu>
                  <RMenu label={L("Sens du texte", "اتجاه النص", "Text direction")} icon={PilcrowRight} width={220}>
                    {(close) => (
                      <>
                        <MenuItem icon={ArrowRightLeft} label={L("Feuille de droite à gauche", "ورقة من اليمين لليسار", "Sheet right-to-left")} active={ctx.rtl} onClick={dropDown(close, () => cmd("sheet.command.set-worksheet-right-to-left", { rightToLeft: ctx.rtl ? 0 : 1 }))} />
                        <MenuItem icon={AlignRight} label={L("Texte aligné à droite", "نص محاذى لليمين", "Right-aligned text")} onClick={dropDown(close, () => hAlign("right"))} />
                      </>
                    )}
                  </RMenu>
                  <span className="mx-0.5 h-5 w-px bg-border" />
                  <SmallBtn icon={WrapText} label={L("Renvoyer à la ligne automatiquement", "التفاف النص", "Wrap Text")} withLabel active={st?.tb === 3} onClick={() => safe(() => R()?.setWrap(st?.tb !== 3))} />
                </RRow>
                <RRow>
                  <SmallBtn icon={AlignLeft} label={L("Aligner à gauche", "محاذاة لليسار", "Align left")} active={st?.ht === 1} onClick={() => hAlign("left")} />
                  <SmallBtn icon={AlignCenter} label={L("Centrer", "توسيط", "Center")} active={st?.ht === 2} onClick={() => hAlign("center")} />
                  <SmallBtn icon={AlignRight} label={L("Aligner à droite", "محاذاة لليمين", "Align right")} active={st?.ht === 3} onClick={() => hAlign("right")} />
                  <SmallBtn icon={IndentDecrease} label={L("Diminuer le retrait", "إنقاص المسافة البادئة", "Decrease indent")} onClick={() => indent(-1)} />
                  <SmallBtn icon={IndentIncrease} label={L("Augmenter le retrait", "زيادة المسافة البادئة", "Increase indent")} onClick={() => indent(1)} />
                  <span className="mx-0.5 h-5 w-px bg-border" />
                  <SmallBtn icon={TableCellsMerge} label={L("Fusionner et centrer", "دمج وتوسيط", "Merge & Center")} withLabel active={st?.merged} onClick={() => merge(st?.merged ? "unmerge" : "center")} />
                  <RMenu label={L("Fusionner", "دمج", "Merge")} width={220}>
                    {(close) => (
                      <>
                        <MenuItem icon={TableCellsMerge} label={L("Fusionner et centrer", "دمج وتوسيط", "Merge & Center")} onClick={dropDown(close, () => merge("center"))} />
                        <MenuItem icon={TableCellsMerge} label={L("Fusionner horizontalement", "دمج أفقي", "Merge Across")} onClick={dropDown(close, () => merge("across"))} />
                        <MenuItem icon={TableCellsMerge} label={L("Fusionner les cellules", "دمج الخلايا", "Merge Cells")} onClick={dropDown(close, () => merge("all"))} />
                        <MenuItem icon={TableCellsSplit} label={L("Annuler la fusion", "إلغاء الدمج", "Unmerge Cells")} onClick={dropDown(close, () => merge("unmerge"))} />
                      </>
                    )}
                  </RMenu>
                </RRow>
              </RStack>
            </RGroup>

            <RGroup label={L("Nombre", "رقم", "Number")}>
              <RStack>
                <RSelect title={L("Format de nombre", "تنسيق الأرقام", "Number format")} width={140} value={numFormats.some((f) => f.value === pattern) ? pattern : "__custom"} onChange={(v) => { if (v === "__more") void cmd("sheet.operation.open.numfmt.panel"); else if (v !== "__custom") numfmt(v); }} options={[...numFormats, ...(numFormats.some((f) => f.value === pattern) ? [] : [{ value: "__custom", label: L("Personnalisé", "مخصص", "Custom") }]), { value: "__more", label: L("Autres formats numériques…", "تنسيقات أخرى…", "More number formats…") }]} />
                <RRow>
                  <SmallBtn icon={glyph(L("DH", "د.م", "$"))} label={L("Format Comptabilité", "تنسيق محاسبي", "Accounting format")} onClick={() => numfmt('_-* #,##0.00 "DH"_-')} />
                  <RMenu label={L("Devise", "العملة", "Currency")} width={200}>
                    {(close) => (
                      <>
                        {[['#,##0.00 "DH"', "DH — Dirham"], ["#,##0.00 €", "€ — Euro"], ["$#,##0.00", "$ — Dollar"], ["£#,##0.00", "£ — Livre"], ['#,##0.00 "د.م."', "د.م. — درهم"]].map(([p, lab]) => <MenuItem key={p} label={lab} onClick={dropDown(close, () => numfmt(p))} />)}
                        <div className="my-1 border-t" />
                        <MenuItem label={L("Autres formats…", "تنسيقات أخرى…", "More formats…")} onClick={dropDown(close, () => cmd("sheet.operation.open.numfmt.panel"))} />
                      </>
                    )}
                  </RMenu>
                  <SmallBtn icon={glyph("%")} label={L("Style de pourcentage", "نمط النسبة المئوية", "Percent Style")} onClick={() => numfmt("0%")} />
                  <SmallBtn icon={CommaIcon} label={L("Séparateur de milliers", "فاصل الآلاف", "Comma Style")} onClick={() => numfmt("#,##0.00")} />
                </RRow>
                <RRow>
                  <SmallBtn icon={DecIncIcon} label={L("Ajouter une décimale", "زيادة المنازل العشرية", "Increase Decimal")} onClick={() => void cmd("sheet.command.numfmt.add.decimal.command")} />
                  <SmallBtn icon={DecDecIcon} label={L("Réduire les décimales", "إنقاص المنازل العشرية", "Decrease Decimal")} onClick={() => void cmd("sheet.command.numfmt.subtract.decimal.command")} />
                </RRow>
              </RStack>
            </RGroup>

            <RGroup label={L("Styles", "أنماط", "Styles")}>
              <RStack>
                <RMenu trigger={<SmallBtn icon={LayoutGrid} iconClassName="text-rose-600" label={L("Mise en forme conditionnelle", "تنسيق شرطي", "Conditional Formatting")} withLabel />} label={L("Mise en forme conditionnelle", "تنسيق شرطي", "Conditional Formatting")} width={270}>
                  {(close) => (
                    <>
                      <MenuItem icon={ListFilter} label={L("Règles de mise en surbrillance des cellules…", "قواعد تمييز الخلايا…", "Highlight Cells Rules…")} onClick={dropDown(close, () => cmd("sheet.operation.open.conditional.formatting.panel", { value: 1 }))} />
                      <MenuItem icon={ListOrdered} label={L("Règles des valeurs plus/moins élevées…", "قواعد أعلى/أدنى القيم…", "Top/Bottom Rules…")} onClick={dropDown(close, () => cmd("sheet.operation.open.conditional.formatting.panel", { value: 4 }))} />
                      <MenuItem icon={Rows3} label={L("Barres de données", "أشرطة البيانات", "Data Bars")} onClick={dropDown(close, () => cmd("sheet.operation.open.conditional.formatting.panel", { value: 7 }))} />
                      <MenuItem icon={Palette2} label={L("Nuances de couleurs", "تدرجات الألوان", "Color Scales")} onClick={dropDown(close, () => cmd("sheet.operation.open.conditional.formatting.panel", { value: 6 }))} />
                      <MenuItem icon={Sparkles} label={L("Jeux d'icônes", "مجموعات الأيقونات", "Icon Sets")} onClick={dropDown(close, () => cmd("sheet.operation.open.conditional.formatting.panel", { value: 8 }))} />
                      <MenuItem icon={CopyX} label={L("Valeurs en double", "القيم المكررة", "Duplicate Values")} onClick={dropDown(close, () => cmd("sheet.operation.open.conditional.formatting.panel", { value: 1 }))} />
                      <MenuItem icon={Search} label={L("Le texte contient…", "النص يحتوي على…", "Text that Contains…")} onClick={dropDown(close, () => cmd("sheet.operation.open.conditional.formatting.panel", { value: 1 }))} />
                      <div className="my-1 border-t" />
                      <MenuItem icon={SquareFunction} label={L("Nouvelle règle (formule)…", "قاعدة جديدة (صيغة)…", "New Rule (formula)…")} onClick={dropDown(close, () => cmd("sheet.operation.open.conditional.formatting.panel", { value: 5 }))} />
                      <MenuItem icon={Eraser} label={L("Effacer les règles de la sélection", "مسح قواعد التحديد", "Clear Rules from Selection")} onClick={dropDown(close, () => cmd("sheet.operation.open.conditional.formatting.panel", { value: 9 }))} />
                      <MenuItem icon={Eraser} label={L("Effacer les règles de la feuille", "مسح قواعد الورقة", "Clear Rules from Sheet")} onClick={dropDown(close, () => cmd("sheet.operation.open.conditional.formatting.panel", { value: 10 }))} />
                      <MenuItem icon={Settings2} label={L("Gérer les règles…", "إدارة القواعد…", "Manage Rules…")} onClick={dropDown(close, () => cmd("sheet.operation.open.conditional.formatting.panel", { value: 2 }))} />
                    </>
                  )}
                </RMenu>
                <RMenu trigger={<SmallBtn icon={Table2} iconClassName="text-sky-600" label={L("Mettre sous forme de tableau", "التنسيق كجدول", "Format as Table")} withLabel />} label={L("Mettre sous forme de tableau", "التنسيق كجدول", "Format as Table")} width={250}>
                  {(close) => (
                    <div className="grid grid-cols-3 gap-2 p-1">
                      {["#6280F9", "#16BDCA", "#31C48D", "#AC94FA", "#F17EBB", "#F98080"].map((c, i) => (
                        <button key={c} type="button" onClick={dropDown(close, () => formatAsTable(i))} className="grid h-12 grid-rows-4 overflow-hidden rounded border hover:ring-2 hover:ring-[#217346]">
                          <span style={{ background: c }} /><span style={{ background: `${c}22` }} /><span /><span style={{ background: `${c}22` }} />
                        </button>
                      ))}
                    </div>
                  )}
                </RMenu>
                <RMenu trigger={<SmallBtn icon={Paintbrush} iconClassName="text-amber-600" label={L("Styles de cellules", "أنماط الخلايا", "Cell Styles")} withLabel />} label={L("Styles de cellules", "أنماط الخلايا", "Cell Styles")} width={330}>
                  {(close) => (
                    <div className="space-y-2 p-1 text-[12px]">
                      {[
                        [L("Bon, mauvais et neutre", "جيد وسيئ ومحايد", "Good, Bad and Neutral"), [
                          [L("Normal", "عادي", "Normal"), {}], [L("Insatisfaisant", "سيئ", "Bad"), { bg: "#FFC7CE", cl: "#9C0006" }],
                          [L("Satisfaisant", "جيد", "Good"), { bg: "#C6EFCE", cl: "#006100" }], [L("Neutre", "محايد", "Neutral"), { bg: "#FFEB9C", cl: "#9C5700" }],
                        ]],
                        [L("Données et modèle", "البيانات والنموذج", "Data and Model"), [
                          [L("Calcul", "حساب", "Calculation"), { bg: "#F2F2F2", cl: "#FA7D00", bold: true }], [L("Entrée", "إدخال", "Input"), { bg: "#FFCC99", cl: "#3F3F76" }],
                          [L("Sortie", "إخراج", "Output"), { bg: "#F2F2F2", cl: "#3F3F3F", bold: true }], [L("Avertissement", "تحذير", "Warning Text"), { cl: "#FF0000" }],
                          [L("Note", "ملاحظة", "Note"), { bg: "#FFFFCC" }], [L("Explicatif", "توضيحي", "Explanatory"), { cl: "#7F7F7F", italic: true }],
                        ]],
                        [L("Titres et en-têtes", "العناوين", "Titles and Headings"), [
                          [L("Titre", "عنوان", "Title"), { cl: "#44546A", size: 18, bold: true }], [L("Titre 1", "عنوان 1", "Heading 1"), { cl: "#44546A", size: 15, bold: true, border: "#4472C4" }],
                          [L("Titre 2", "عنوان 2", "Heading 2"), { cl: "#44546A", size: 13, bold: true, border: "#A9C4EB" }], [L("Total", "المجموع", "Total"), { bold: true, border: "double" }],
                        ]],
                        [L("Styles avec thème", "أنماط السمة", "Themed Cell Styles"), [
                          ["Accent 1", { bg: "#4472C4", cl: "#FFFFFF" }], ["Accent 2", { bg: "#ED7D31", cl: "#FFFFFF" }], ["Accent 3", { bg: "#A5A5A5", cl: "#FFFFFF" }],
                          ["Accent 4", { bg: "#FFC000", cl: "#FFFFFF" }], ["Accent 5", { bg: "#5B9BD5", cl: "#FFFFFF" }], ["Accent 6", { bg: "#70AD47", cl: "#FFFFFF" }],
                        ]],
                      ].map(([title, items]) => (
                        <div key={title as string}>
                          <div className="mb-1 font-semibold text-muted-foreground">{title as string}</div>
                          <div className="grid grid-cols-3 gap-1">
                            {(items as [string, any][]).map(([lab, s]) => (
                              <button key={lab} type="button" onClick={dropDown(close, () => cellStyle(s))} className="h-7 truncate rounded border px-1.5 text-start" style={{ background: s.bg, color: s.cl, fontWeight: s.bold ? 700 : undefined, fontStyle: s.italic ? "italic" : undefined, borderBottom: s.border ? `${s.border === "double" ? "3px double #000" : `2px solid ${s.border}`}` : undefined }}>{lab}</button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </RMenu>
              </RStack>
            </RGroup>

            <RGroup label={L("Cellules", "خلايا", "Cells")}>
              <RStack>
                <RMenu trigger={<SmallBtn icon={SquarePlus} iconClassName="text-sky-600" label={L("Insérer", "إدراج", "Insert")} withLabel />} label={L("Insérer", "إدراج", "Insert")} width={240}>
                  {(close) => (
                    <>
                      <MenuItem icon={SquarePlus} label={L("Insérer des cellules (décalage vers le bas)", "إدراج خلايا (إزاحة لأسفل)", "Insert cells (shift down)")} onClick={dropDown(close, () => cmd("sheet.command.insert-range-move-down-confirm"))} />
                      <MenuItem icon={SquarePlus} label={L("Insérer des cellules (décalage à droite)", "إدراج خلايا (إزاحة لليمين)", "Insert cells (shift right)")} onClick={dropDown(close, () => cmd("sheet.command.insert-range-move-right-confirm"))} />
                      <MenuItem icon={Rows3} label={L("Insérer des lignes dans la feuille", "إدراج صفوف", "Insert Sheet Rows")} onClick={dropDown(close, () => cmd("sheet.command.insert-row-before"))} />
                      <MenuItem icon={Columns3} label={L("Insérer des colonnes dans la feuille", "إدراج أعمدة", "Insert Sheet Columns")} onClick={dropDown(close, () => cmd("sheet.command.insert-col-before"))} />
                      <MenuItem icon={LayoutGrid} label={L("Insérer une feuille", "إدراج ورقة", "Insert Sheet")} onClick={dropDown(close, () => cmd("sheet.command.insert-sheet"))} />
                    </>
                  )}
                </RMenu>
                <RMenu trigger={<SmallBtn icon={SquareMinus} iconClassName="text-rose-600" label={L("Supprimer", "حذف", "Delete")} withLabel />} label={L("Supprimer", "حذف", "Delete")} width={240}>
                  {(close) => (
                    <>
                      <MenuItem icon={SquareMinus} label={L("Supprimer des cellules (décalage vers le haut)", "حذف خلايا (إزاحة لأعلى)", "Delete cells (shift up)")} onClick={dropDown(close, () => cmd("sheet.command.delete-range-move-up-confirm"))} />
                      <MenuItem icon={SquareMinus} label={L("Supprimer des cellules (décalage à gauche)", "حذف خلايا (إزاحة لليسار)", "Delete cells (shift left)")} onClick={dropDown(close, () => cmd("sheet.command.delete-range-move-left-confirm"))} />
                      <MenuItem icon={Rows3} label={L("Supprimer des lignes de la feuille", "حذف صفوف", "Delete Sheet Rows")} onClick={dropDown(close, () => cmd("sheet.command.remove-row-confirm"))} />
                      <MenuItem icon={Columns3} label={L("Supprimer des colonnes de la feuille", "حذف أعمدة", "Delete Sheet Columns")} onClick={dropDown(close, () => cmd("sheet.command.remove-col-confirm"))} />
                      <MenuItem icon={Trash2} label={L("Supprimer la feuille", "حذف الورقة", "Delete Sheet")} onClick={dropDown(close, () => cmd("sheet.command.remove-sheet-confirm"))} />
                    </>
                  )}
                </RMenu>
                <RMenu trigger={<SmallBtn icon={Settings2} iconClassName="text-sky-700" label={L("Format", "تنسيق", "Format")} withLabel />} label={L("Format", "تنسيق", "Format")} width={260}>
                  {(close) => (
                    <>
                      <div className="px-2 pb-0.5 pt-1 text-[11px] font-semibold text-muted-foreground">{L("Taille de la cellule", "حجم الخلية", "Cell Size")}</div>
                      <MenuItem icon={Rows3} label={L("Hauteur de ligne…", "ارتفاع الصف…", "Row Height…")} onClick={dropDown(close, () => { const g = R()?.getRange(); const v = window.prompt(L("Hauteur de ligne (pixels)", "ارتفاع الصف (بكسل)", "Row height (pixels)"), "24"); if (g && v && +v > 0) ws()?.setRowHeights(g.startRow, g.endRow - g.startRow + 1, +v); })} />
                      <MenuItem icon={Rows3} label={L("Ajuster la hauteur de ligne", "احتواء تلقائي لارتفاع الصف", "AutoFit Row Height")} onClick={dropDown(close, () => cmd("sheet.command.set-row-is-auto-height"))} />
                      <MenuItem icon={Columns3} label={L("Largeur de colonne…", "عرض العمود…", "Column Width…")} onClick={dropDown(close, () => { const g = R()?.getRange(); const v = window.prompt(L("Largeur de colonne (pixels)", "عرض العمود (بكسل)", "Column width (pixels)"), "88"); if (g && v && +v > 0) ws()?.setColumnWidths(g.startColumn, g.endColumn - g.startColumn + 1, +v); })} />
                      <MenuItem icon={Columns3} label={L("Ajuster la largeur de colonne", "احتواء تلقائي لعرض العمود", "AutoFit Column Width")} onClick={dropDown(close, () => cmd("sheet.command.set-col-auto-width"))} />
                      <div className="px-2 pb-0.5 pt-1 text-[11px] font-semibold text-muted-foreground">{L("Visibilité", "الرؤية", "Visibility")}</div>
                      <MenuItem icon={Eye} label={L("Masquer les lignes", "إخفاء الصفوف", "Hide Rows")} onClick={dropDown(close, () => cmd("sheet.command.hide-row-confirm"))} />
                      <MenuItem icon={Eye} label={L("Masquer les colonnes", "إخفاء الأعمدة", "Hide Columns")} onClick={dropDown(close, () => cmd("sheet.command.hide-col-confirm"))} />
                      <MenuItem icon={Eye} label={L("Afficher les lignes", "إظهار الصفوف", "Unhide Rows")} onClick={dropDown(close, () => cmd("sheet.command.set-selected-rows-visible"))} />
                      <MenuItem icon={Eye} label={L("Afficher les colonnes", "إظهار الأعمدة", "Unhide Columns")} onClick={dropDown(close, () => cmd("sheet.command.set-selected-cols-visible"))} />
                      <div className="px-2 pb-0.5 pt-1 text-[11px] font-semibold text-muted-foreground">{L("Organiser les feuilles", "تنظيم الأوراق", "Organize Sheets")}</div>
                      <MenuItem icon={PanelTop} label={L("Renommer la feuille", "إعادة تسمية الورقة", "Rename Sheet")} onClick={dropDown(close, () => cmd("sheet.operation.rename-sheet"))} />
                      <MenuItem icon={Copy} label={L("Dupliquer la feuille", "تكرار الورقة", "Duplicate Sheet")} onClick={dropDown(close, () => wb()?.duplicateActiveSheet())} />
                      <MenuItem icon={PaintBucket} label={L("Couleur d'onglet…", "لون علامة التبويب…", "Tab Color…")} onClick={dropDown(close, () => { const v = window.prompt(L("Couleur (ex. #217346)", "اللون (مثلا ‎#217346)", "Color (e.g. #217346)"), "#217346"); if (v) ws()?.setTabColor(v); })} />
                      <div className="px-2 pb-0.5 pt-1 text-[11px] font-semibold text-muted-foreground">{L("Protection", "الحماية", "Protection")}</div>
                      <MenuItem icon={ShieldCheck} label={L("Protéger la feuille…", "حماية الورقة…", "Protect Sheet…")} onClick={dropDown(close, () => cmd("sheet.command.add-worksheet-protection"))} />
                      <MenuItem icon={Lock} label={L("Protéger la plage…", "حماية النطاق…", "Protect Range…")} onClick={dropDown(close, () => cmd("sheet.command.add-range-protection-from-toolbar"))} />
                      <div className="my-1 border-t" />
                      <MenuItem icon={Settings2} label={L("Format de cellule…", "تنسيق الخلايا…", "Format Cells…")} onClick={dropDown(close, () => cmd("sheet.operation.open.numfmt.panel"))} />
                    </>
                  )}
                </RMenu>
              </RStack>
            </RGroup>

            <RGroup label={L("Édition", "تحرير", "Editing")}>
              <RStack>
                <RRow>
                  <SmallBtn icon={Sigma} label={L("Somme automatique (Alt+=)", "جمع تلقائي", "AutoSum (Alt+=)")} onClick={() => autoFn("SUM")} />
                  <RMenu label={L("Somme automatique", "جمع تلقائي", "AutoSum")} width={190}>
                    {(close) => <>{[["SUM", L("Somme", "مجموع", "Sum")], ["AVERAGE", L("Moyenne", "المعدل", "Average")], ["COUNT", L("Nombre", "عدد", "Count Numbers")], ["MAX", "Max"], ["MIN", "Min"]].map(([f, lab]) => <MenuItem key={f} label={lab} onClick={dropDown(close, () => autoFn(f))} />)}<div className="my-1 border-t" /><MenuItem label={L("Autres fonctions…", "دوال أخرى…", "More Functions…")} onClick={dropDown(close, () => cmd("formula-ui.operation.more-functions"))} /></>}
                  </RMenu>
                </RRow>
                <RRow>
                  <SmallBtn icon={ArrowDownToLine} iconClassName="text-sky-600" label={L("Recopier vers le bas (Ctrl+D)", "تعبئة لأسفل", "Fill Down")} onClick={() => void cmd("sheet.command.copy-down")} />
                  <RMenu label={L("Recopier", "تعبئة", "Fill")} width={210}>
                    {(close) => (
                      <>
                        <MenuItem icon={ArrowDownToLine} label={L("En bas", "لأسفل", "Down")} onClick={dropDown(close, () => cmd("sheet.command.copy-down"))} />
                        <MenuItem icon={ArrowRightToLine} label={L("À droite", "لليمين", "Right")} onClick={dropDown(close, () => cmd("sheet.command.copy-right"))} />
                        <MenuItem icon={ListOrdered} label={L("Série (1, 2, 3…)", "سلسلة (1، 2، 3…)", "Series (1, 2, 3…)")} onClick={dropDown(close, fillSeries)} />
                        <MenuItem icon={Split} label={L("Convertir (texte en colonnes)", "تحويل النص إلى أعمدة", "Text to Columns")} onClick={dropDown(close, () => cmd("sheet.command.split-text-to-columns"))} />
                      </>
                    )}
                  </RMenu>
                </RRow>
                <RRow>
                  <SmallBtn icon={Eraser} iconClassName="text-pink-600" label={L("Effacer", "مسح", "Clear")} onClick={() => void cmd("sheet.command.clear-selection-all")} />
                  <RMenu label={L("Effacer", "مسح", "Clear")} width={210}>
                    {(close) => (
                      <>
                        <MenuItem icon={Eraser} label={L("Effacer tout", "مسح الكل", "Clear All")} onClick={dropDown(close, () => cmd("sheet.command.clear-selection-all"))} />
                        <MenuItem icon={Eraser} label={L("Effacer les formats", "مسح التنسيقات", "Clear Formats")} onClick={dropDown(close, () => cmd("sheet.command.clear-selection-format"))} />
                        <MenuItem icon={Eraser} label={L("Effacer le contenu", "مسح المحتويات", "Clear Contents")} onClick={dropDown(close, () => cmd("sheet.command.clear-selection-content"))} />
                      </>
                    )}
                  </RMenu>
                </RRow>
              </RStack>
              <RMenu big icon={ArrowDownAZ} label={L("Trier et filtrer", "فرز وتصفية", "Sort & Filter")} width={220}>
                {(close) => (
                  <>
                    <MenuItem icon={ArrowDownAZ} label={L("Trier de A à Z", "فرز من أ إلى ي", "Sort A to Z")} onClick={dropDown(close, () => cmd("sheet.command.sort-range-asc"))} />
                    <MenuItem icon={ArrowDownZA} label={L("Trier de Z à A", "فرز من ي إلى أ", "Sort Z to A")} onClick={dropDown(close, () => cmd("sheet.command.sort-range-desc"))} />
                    <MenuItem icon={ListOrdered} label={L("Tri personnalisé…", "فرز مخصص…", "Custom Sort…")} onClick={dropDown(close, () => cmd("sheet.command.sort-range-custom"))} />
                    <div className="my-1 border-t" />
                    <MenuItem icon={Filter} label={L("Filtrer", "تصفية", "Filter")} active={ctx.filter} onClick={dropDown(close, () => cmd("sheet.command.smart-toggle-filter"))} />
                    <MenuItem icon={FilterX} label={L("Effacer le filtre", "مسح التصفية", "Clear")} onClick={dropDown(close, () => cmd("sheet.command.clear-filter-criteria"))} />
                    <MenuItem icon={Repeat} label={L("Réappliquer", "إعادة التطبيق", "Reapply")} onClick={dropDown(close, () => cmd("sheet.command.re-calc-filter"))} />
                  </>
                )}
              </RMenu>
              <RMenu big icon={Search} label={L("Rechercher et sélectionner", "بحث وتحديد", "Find & Select")} width={220}>
                {(close) => (
                  <>
                    <MenuItem icon={Search} label={L("Rechercher…", "بحث…", "Find…")} hint="Ctrl+F" onClick={dropDown(close, () => cmd("ui.operation.open-find-dialog"))} />
                    <MenuItem icon={Replace} label={L("Remplacer…", "استبدال…", "Replace…")} hint="Ctrl+H" onClick={dropDown(close, () => cmd("ui.operation.open-replace-dialog"))} />
                    <MenuItem icon={LayoutGrid} label={L("Sélectionner tout", "تحديد الكل", "Select All")} hint="Ctrl+A" onClick={dropDown(close, () => cmd("sheet.command.select-all"))} />
                    <MenuItem icon={StickyNote} label={L("Notes", "ملاحظات", "Notes")} onClick={dropDown(close, () => cmd("sheet.operation.add-note-popup"))} />
                    <MenuItem icon={ShieldCheck} label={L("Validation des données", "التحقق من صحة البيانات", "Data Validation")} onClick={dropDown(close, () => cmd("data-validation.operation.open-validation-panel"))} />
                  </>
                )}
              </RMenu>
            </RGroup>

            <RGroup label={L("Compléments", "الوظائف الإضافية", "Add-ins")}>
              <RMenu big icon={Blocks} label={L("Compléments", "الوظائف الإضافية", "Add-ins")} width={240}>
                {(close) => (
                  <>
                    <MenuItem icon={ChartColumn} label={L("Graphique à partir de la sélection", "مبيان من التحديد", "Chart from selection")} onClick={dropDown(close, () => onChart())} />
                    <MenuItem icon={Calculator} label={L("Statistiques de la sélection", "إحصائيات التحديد", "Selection statistics")} onClick={dropDown(close, stats)} />
                    <MenuItem icon={CopyX} label={L("Supprimer les doublons", "إزالة التكرارات", "Remove duplicates")} onClick={dropDown(close, removeDuplicates)} />
                    <MenuItem icon={ListOrdered} label={L("Numéroter la sélection", "ترقيم التحديد", "Number the selection")} onClick={dropDown(close, fillSeries)} />
                  </>
                )}
              </RMenu>
            </RGroup>
          </>
        )}

        {tab === "insert" && (
          <>
            <RGroup label={L("Tableaux", "جداول", "Tables")}>
              <BigBtn icon={Table2} label={L("Tableau", "جدول", "Table")} onClick={() => void formatAsTable(0)} />
            </RGroup>
            <RGroup label={L("Illustrations", "رسوم توضيحية", "Illustrations")}>
              <RMenu big icon={ImagePlus} label={L("Images", "صور", "Pictures")} width={230}>
                {(close) => (
                  <>
                    <MenuItem icon={ImagePlus} label={L("Image flottante", "صورة عائمة", "Place over cells")} onClick={dropDown(close, () => cmd("sheet.command.insert-float-image"))} />
                    <MenuItem icon={ImagePlus} label={L("Image dans la cellule", "صورة داخل الخلية", "Place in cell")} onClick={dropDown(close, () => cmd("sheet.command.insert-cell-image"))} />
                  </>
                )}
              </RMenu>
            </RGroup>
            <RGroup label={L("Graphiques", "مبيانات", "Charts")}>
              <BigBtn icon={ChartColumn} label={L("Histogramme", "أعمدة", "Column")} onClick={() => onChart("column")} />
              <BigBtn icon={ChartLine} label={L("Courbes", "خطوط", "Line")} onClick={() => onChart("line")} />
              <BigBtn icon={ChartPie} label={L("Secteurs", "دائري", "Pie")} onClick={() => onChart("pie")} />
              <BigBtn icon={LayoutGrid} label={L("Graphiques recommandés", "مبيانات موصى بها", "Recommended Charts")} onClick={() => onChart()} />
            </RGroup>
            <RGroup label={L("Liens", "ارتباطات", "Links")}>
              <BigBtn icon={Link} label={L("Lien", "ارتباط", "Link")} onClick={() => void cmd("sheet.operation.insert-hyper-link-toolbar")} />
            </RGroup>
            <RGroup label={L("Commentaires", "تعليقات", "Comments")}>
              <BigBtn icon={StickyNote} label={L("Note", "ملاحظة", "Note")} onClick={() => void cmd("sheet.operation.add-note-popup")} />
            </RGroup>
            <RGroup label={L("Symboles", "رموز", "Symbols")}>
              <RMenu big icon={Omega} label={L("Symbole", "رمز", "Symbol")} width={300}>
                {(close) => (
                  <div className="grid grid-cols-10 gap-0.5">
                    {"± × ÷ ≤ ≥ ≠ ≈ ∞ √ ∑ π α β γ θ λ μ σ Δ Ω ° ² ³ ½ ¼ ¾ € $ £ ¥ © ® ™ ✓ ✗ ★ ♥ • → ← ↑ ↓ ⇒ ∈ ∀ ∃ ∅ ∩ ∪ ‰".split(" ").map((s) => <button key={s} type="button" className="h-7 rounded text-[15px] hover:bg-muted" onClick={dropDown(close, () => insertSymbol(s))}>{s}</button>)}
                  </div>
                )}
              </RMenu>
              <RMenu big icon={Smile} label={L("Emoji", "رموز تعبيرية", "Emoji")} width={280}>
                {(close) => (
                  <div className="grid grid-cols-8 gap-0.5">
                    {"✅ ❌ ⚠️ ⭐ 🔥 👍 👎 📌 📈 📉 💡 📅 ⏰ 🏆 🎯 🎓 📚 ✏️ 🔴 🟠 🟡 🟢 🔵 🟣".split(" ").map((s) => <button key={s} type="button" className="h-7 rounded text-[16px] hover:bg-muted" onClick={dropDown(close, () => insertSymbol(s))}>{s}</button>)}
                  </div>
                )}
              </RMenu>
            </RGroup>
          </>
        )}

        {tab === "layout" && (
          <>
            <RGroup label={L("Mise en page", "إعداد الصفحة", "Page Setup")}>
              <RMenu big icon={Ruler} label={L("Marges", "الهوامش", "Margins")} width={200}>
                {(close) => <>{(["normal", "narrow", "wide"] as const).map((m) => <MenuItem key={m} active={page.margin === m} label={m === "normal" ? L("Normales", "عادية", "Normal") : m === "narrow" ? L("Étroites", "ضيقة", "Narrow") : L("Larges", "عريضة", "Wide")} onClick={dropDown(close, () => setPage({ ...page, margin: m }))} />)}</>}
              </RMenu>
              <RMenu big icon={RotateCcw} label={L("Orientation", "الاتجاه", "Orientation")} width={180}>
                {(close) => <>{(["portrait", "landscape"] as const).map((o) => <MenuItem key={o} active={page.orientation === o} label={o === "portrait" ? L("Portrait", "عمودي", "Portrait") : L("Paysage", "أفقي", "Landscape")} onClick={dropDown(close, () => setPage({ ...page, orientation: o }))} />)}</>}
              </RMenu>
              <RMenu big icon={Scaling} label={L("Taille", "الحجم", "Size")} width={180}>
                {(close) => <>{(["A4", "A3", "Letter"] as const).map((s) => <MenuItem key={s} active={page.size === s} label={s} onClick={dropDown(close, () => setPage({ ...page, size: s }))} />)}</>}
              </RMenu>
              <BigBtn icon={Printer} label={L("Imprimer", "طباعة", "Print")} onClick={onPrint} />
              <BigBtn icon={ImagePlus} label={L("Arrière-plan", "خلفية", "Background")} onClick={() => void cmd("sheet.command.add-worksheet-background-image")} />
            </RGroup>
            <RGroup label={L("Options de la feuille", "خيارات الورقة", "Sheet Options")}>
              <RStack>
                <div className="text-[11.5px] font-medium">{L("Quadrillage", "خطوط الشبكة", "Gridlines")}</div>
                <label className="flex items-center gap-1.5 text-[12px]"><input type="checkbox" checked={ctx.gridlines} onChange={() => safe(() => ws()?.setHiddenGridlines(ctx.gridlines))} /> {L("Afficher", "عرض", "View")}</label>
                <label className="flex items-center gap-1.5 text-[12px]"><input type="checkbox" checked={page.gridlines} onChange={(e) => setPage({ ...page, gridlines: e.target.checked })} /> {L("Imprimer", "طباعة", "Print")}</label>
              </RStack>
              <RStack className="ms-3">
                <div className="text-[11.5px] font-medium">{L("En-têtes", "العناوين", "Headings")}</div>
                <label className="flex items-center gap-1.5 text-[12px]"><input type="checkbox" checked={page.headings} onChange={(e) => setPage({ ...page, headings: e.target.checked })} /> {L("Imprimer", "طباعة", "Print")}</label>
              </RStack>
              <BigBtn icon={ArrowRightLeft} label={L("Feuille de droite à gauche", "ورقة من اليمين لليسار", "Sheet Right-to-Left")} active={ctx.rtl} onClick={() => void cmd("sheet.command.set-worksheet-right-to-left", { rightToLeft: ctx.rtl ? 0 : 1 })} />
            </RGroup>
          </>
        )}

        {tab === "formulas" && (
          <>
            <RGroup label={L("Bibliothèque de fonctions", "مكتبة الدوال", "Function Library")}>
              <BigBtn icon={SquareFunction} label={L("Insérer une fonction", "إدراج دالة", "Insert Function")} onClick={() => void cmd("formula-ui.operation.more-functions")} />
              <RMenu big icon={Sigma} label={L("Somme automatique", "جمع تلقائي", "AutoSum")} width={190}>
                {(close) => <>{[["SUM", L("Somme", "مجموع", "Sum")], ["AVERAGE", L("Moyenne", "المعدل", "Average")], ["COUNT", L("Nombre", "عدد", "Count")], ["MAX", "Max"], ["MIN", "Min"]].map(([f, lab]) => <MenuItem key={f} label={lab} onClick={dropDown(close, () => autoFn(f))} />)}</>}
              </RMenu>
              {([
                [L("Financier", "مالية", "Financial"), Calculator, ["PMT", "FV", "PV", "NPV", "IRR", "RATE", "NPER", "SLN"]],
                [L("Logique", "منطقية", "Logical"), Wand2, ["IF", "IFS", "AND", "OR", "NOT", "IFERROR", "SWITCH", "XOR"]],
                [L("Texte", "نص", "Text"), CaseSensitive, ["CONCAT", "TEXTJOIN", "LEFT", "RIGHT", "MID", "LEN", "UPPER", "LOWER", "PROPER", "TRIM", "SUBSTITUTE", "TEXT", "FIND"]],
                [L("Date et heure", "التاريخ والوقت", "Date & Time"), BookOpen, ["TODAY", "NOW", "DATE", "YEAR", "MONTH", "DAY", "WEEKDAY", "DATEDIF", "EDATE", "NETWORKDAYS"]],
                [L("Recherche et référence", "بحث ومرجع", "Lookup & Reference"), Search, ["VLOOKUP", "HLOOKUP", "XLOOKUP", "INDEX", "MATCH", "CHOOSE", "FILTER", "SORT", "UNIQUE"]],
                [L("Maths et trigonométrie", "رياضيات ومثلثات", "Math & Trig"), Omega, ["SUM", "SUMIF", "SUMIFS", "ROUND", "ROUNDUP", "ROUNDDOWN", "ABS", "SQRT", "POWER", "MOD", "INT", "PRODUCT", "RAND"]],
                [L("Statistiques", "إحصائية", "Statistical"), ChartColumn, ["AVERAGE", "AVERAGEIF", "COUNT", "COUNTA", "COUNTIF", "COUNTIFS", "MAX", "MIN", "MEDIAN", "MODE", "RANK", "STDEV", "LARGE", "SMALL"]],
              ] as [string, LucideIcon, string[]][]).map(([lab, ic, fns]) => (
                <RMenu key={lab} big icon={ic} label={lab} width={200}>
                  {(close) => (
                    <div className="max-h-[320px] overflow-y-auto">
                      {fns.map((f) => <MenuItem key={f} label={<span className="font-mono text-[12.5px]">{f}</span>} onClick={dropDown(close, () => cmd("formula-ui.operation.insert-function", { value: f }))} />)}
                      <div className="my-1 border-t" />
                      <MenuItem icon={SquareFunction} label={L("Insérer une fonction…", "إدراج دالة…", "Insert Function…")} onClick={dropDown(close, () => cmd("formula-ui.operation.more-functions"))} />
                    </div>
                  )}
                </RMenu>
              ))}
            </RGroup>
            <RGroup label={L("Noms définis", "الأسماء المعرفة", "Defined Names")}>
              <BigBtn icon={Hash} label={L("Gestionnaire de noms", "إدارة الأسماء", "Name Manager")} onClick={() => void cmd("sheet.command.insert-defined-name")} />
            </RGroup>
            <RGroup label={L("Calcul", "حساب", "Calculation")}>
              <BigBtn icon={Calculator} label={L("Options de calcul", "خيارات الحساب", "Calculation Options")} onClick={() => void cmd("sheets-formula-ui.operation.calculation-options")} />
            </RGroup>
          </>
        )}

        {tab === "data" && (
          <>
            <RGroup label={L("Trier et filtrer", "فرز وتصفية", "Sort & Filter")}>
              <RStack>
                <SmallBtn icon={ArrowDownAZ} label={L("Trier de A à Z", "فرز تصاعدي", "Sort A to Z")} withLabel onClick={() => void cmd("sheet.command.sort-range-asc")} />
                <SmallBtn icon={ArrowDownZA} label={L("Trier de Z à A", "فرز تنازلي", "Sort Z to A")} withLabel onClick={() => void cmd("sheet.command.sort-range-desc")} />
              </RStack>
              <BigBtn icon={ListOrdered} label={L("Trier", "فرز", "Sort")} onClick={() => void cmd("sheet.command.sort-range-custom")} />
              <BigBtn icon={Filter} label={L("Filtrer", "تصفية", "Filter")} active={ctx.filter} onClick={() => void cmd("sheet.command.smart-toggle-filter")} />
              <RStack>
                <SmallBtn icon={FilterX} label={L("Effacer", "مسح", "Clear")} withLabel onClick={() => void cmd("sheet.command.clear-filter-criteria")} />
                <SmallBtn icon={Repeat} label={L("Réappliquer", "إعادة التطبيق", "Reapply")} withLabel onClick={() => void cmd("sheet.command.re-calc-filter")} />
              </RStack>
            </RGroup>
            <RGroup label={L("Outils de données", "أدوات البيانات", "Data Tools")}>
              <BigBtn icon={Split} label={L("Convertir", "نص إلى أعمدة", "Text to Columns")} onClick={() => void cmd("sheet.command.split-text-to-columns")} />
              <BigBtn icon={CopyX} label={L("Supprimer les doublons", "إزالة التكرارات", "Remove Duplicates")} onClick={removeDuplicates} />
              <BigBtn icon={ShieldCheck} label={L("Validation des données", "التحقق من صحة البيانات", "Data Validation")} onClick={() => void cmd("data-validation.operation.open-validation-panel")} />
              <BigBtn icon={Hash} label={L("Convertir en nombres", "تحويل إلى أرقام", "Convert to Numbers")} onClick={() => void cmd("sheet.command.text-to-number")} />
            </RGroup>
          </>
        )}

        {tab === "review" && (
          <>
            <RGroup label={L("Vérification", "تدقيق", "Proofing")}>
              <BigBtn icon={Calculator} label={L("Statistiques du classeur", "إحصائيات المصنف", "Workbook Statistics")} onClick={stats} />
            </RGroup>
            <RGroup label={L("Notes", "ملاحظات", "Notes")}>
              <BigBtn icon={StickyNote} label={L("Nouvelle note", "ملاحظة جديدة", "New Note")} onClick={() => void cmd("sheet.operation.add-note-popup")} />
            </RGroup>
            <RGroup label={L("Protéger", "حماية", "Protect")}>
              <BigBtn icon={ShieldCheck} label={L("Protéger la feuille", "حماية الورقة", "Protect Sheet")} onClick={() => void cmd("sheet.command.add-worksheet-protection")} />
              <BigBtn icon={Lock} label={L("Protéger la plage", "حماية النطاق", "Protect Range")} onClick={() => void cmd("sheet.command.add-range-protection-from-toolbar")} />
              <BigBtn icon={Eye} label={L("Gérer les protections", "إدارة الحماية", "Manage Protection")} onClick={() => void cmd("sheet-permission.operation.openPanel")} />
            </RGroup>
          </>
        )}

        {tab === "view" && (
          <>
            <RGroup label={L("Fenêtre", "نافذة", "Window")}>
              <RMenu big icon={Snowflake} label={L("Figer les volets", "تجميد الأجزاء", "Freeze Panes")} width={240}>
                {(close) => (
                  <>
                    <MenuItem icon={Snowflake} label={L("Figer les volets", "تجميد الأجزاء", "Freeze Panes")} onClick={dropDown(close, () => freeze("panes"))} />
                    <MenuItem icon={Rows3} label={L("Figer la ligne supérieure", "تجميد الصف العلوي", "Freeze Top Row")} onClick={dropDown(close, () => freeze("row"))} />
                    <MenuItem icon={Columns3} label={L("Figer la première colonne", "تجميد العمود الأول", "Freeze First Column")} onClick={dropDown(close, () => freeze("col"))} />
                    <MenuItem icon={Snowflake} label={L("Libérer les volets", "إلغاء التجميد", "Unfreeze Panes")} onClick={dropDown(close, () => freeze("none"))} />
                  </>
                )}
              </RMenu>
            </RGroup>
            <RGroup label={L("Afficher", "إظهار", "Show")}>
              <BigBtn icon={Grid3x3} label={L("Quadrillage", "خطوط الشبكة", "Gridlines")} active={ctx.gridlines} onClick={() => safe(() => ws()?.setHiddenGridlines(ctx.gridlines))} />
            </RGroup>
            <RGroup label={L("Zoom", "تكبير/تصغير", "Zoom")}>
              <BigBtn icon={ZoomIn} label={L("Zoom avant", "تكبير", "Zoom In")} onClick={() => zoom(ctx.zoom / 100 + 0.1)} />
              <BigBtn icon={ZoomOut} label={L("Zoom arrière", "تصغير", "Zoom Out")} onClick={() => zoom(ctx.zoom / 100 - 0.1)} />
              <BigBtn icon={glyph("100", "text-[11px]")} label="100 %" onClick={() => zoom(1)} />
            </RGroup>
            <RGroup label={L("Plein écran", "ملء الشاشة", "Full Screen")}>
              <BigBtn icon={Maximize} label={L("Plein écran", "ملء الشاشة", "Full Screen")} onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.(); }} />
            </RGroup>
          </>
        )}

        {tab === "automate" && (
          <>
            <RGroup label={L("Actions rapides", "إجراءات سريعة", "Quick Actions")}>
              <BigBtn icon={Repeat} label={L("Répéter la dernière action", "تكرار آخر إجراء", "Repeat Last Action")} onClick={() => void cmd("sheet.command.repeat-last-action")} />
              <BigBtn icon={ListOrdered} label={L("Numéroter", "ترقيم", "Number Rows")} onClick={fillSeries} />
              <BigBtn icon={CopyX} label={L("Supprimer les doublons", "إزالة التكرارات", "Remove Duplicates")} onClick={removeDuplicates} />
            </RGroup>
            <RGroup label={L("Nettoyer le texte", "تنظيف النص", "Clean Text")}>
              <RStack>
                <SmallBtn icon={Combine} label={L("Supprimer les espaces en trop", "إزالة المسافات الزائدة", "Trim spaces")} withLabel onClick={() => mapValues((v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : v), L("Espaces nettoyés", "تم تنظيف المسافات", "Spaces trimmed"))} />
                <SmallBtn icon={CaseUpper} label={L("MAJUSCULES", "أحرف كبيرة", "UPPERCASE")} withLabel onClick={() => mapValues((v) => (typeof v === "string" ? v.toUpperCase() : v), L("Texte en majuscules", "تم التحويل", "Uppercased"))} />
                <SmallBtn icon={CaseLower} label={L("minuscules", "أحرف صغيرة", "lowercase")} withLabel onClick={() => mapValues((v) => (typeof v === "string" ? v.toLowerCase() : v), L("Texte en minuscules", "تم التحويل", "Lowercased"))} />
              </RStack>
              <RStack>
                <SmallBtn icon={CaseSensitive} label={L("Nom Propre", "أول حرف كبير", "Proper Case")} withLabel onClick={() => mapValues((v) => (typeof v === "string" ? v.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_m, a, b) => a + b.toUpperCase()) : v), L("Texte en nom propre", "تم التحويل", "Proper-cased"))} />
                <SmallBtn icon={Hash} label={L("Texte en nombres", "نص إلى أرقام", "Text to numbers")} withLabel onClick={() => void cmd("sheet.command.text-to-number")} />
              </RStack>
            </RGroup>
            <RGroup label={L("Assistant", "مساعد", "Assistant")}>
              <BigBtn icon={Bot} label={L("Statistiques", "إحصائيات", "Statistics")} onClick={stats} />
            </RGroup>
          </>
        )}

        {tab === "help" && (
          <>
            <RGroup label={L("Aide", "تعليمات", "Help")}>
              <BigBtn icon={Keyboard} label={L("Raccourcis clavier", "اختصارات لوحة المفاتيح", "Keyboard Shortcuts")} onClick={() => void cmd("base-ui.operation.toggle-shortcut-panel")} />
              <BigBtn icon={SquareFunction} label={L("Liste des fonctions", "قائمة الدوال", "Function List")} onClick={() => void cmd("formula-ui.operation.more-functions")} />
              <BigBtn icon={CircleHelp} label={L("Astuces", "نصائح", "Tips")} onClick={() => toast.info(L("Tapez = pour une formule (SUM, AVERAGE, IF, VLOOKUP…). Glissez la poignée de la cellule pour recopier. Ctrl+Z annule.", "اكتب = لإدخال صيغة (SUM، AVERAGE، IF، VLOOKUP…). اسحب مقبض الخلية للتعبئة. Ctrl+Z للتراجع.", "Type = for a formula (SUM, AVERAGE, IF, VLOOKUP…). Drag the fill handle to copy. Ctrl+Z undoes."), { duration: 9000 })} />
              <BigBtn icon={Info} label={L("À propos", "حول", "About")} onClick={() => toast.info(L("Tableur compatible Excel : .xlsx et .csv, plus de 400 fonctions.", "جدول بيانات متوافق مع Excel: ‎.xlsx و‎.csv وأكثر من 400 دالة.", "Excel-compatible spreadsheet: .xlsx and .csv, 400+ functions."))} />
            </RGroup>
          </>
        )}
      </RibbonBody>
    </>
  );
}

const Palette2: LucideIcon = (function P(props: { className?: string }) {
  return <span className={cn("inline-block h-4 w-4 rounded-sm bg-[linear-gradient(90deg,#F8696B,#FFEB84,#63BE7B)]", props.className)} />;
}) as unknown as LucideIcon;

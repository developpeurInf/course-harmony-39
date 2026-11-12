"use client";

/**
 * PowerPoint — éditeur de présentations dans le navigateur.
 * Diapositives avec dispositions et thèmes, zones de texte enrichies, formes, images,
 * tableaux, graphiques, vidéos YouTube, lignes et flèches ; déplacement / redimensionnement /
 * rotation avec repères d'alignement ; transitions et animations ; diaporama plein écran,
 * mode présentateur, stylo et pointeur laser ; notes ; trieuse de diapositives.
 * Ouverture et enregistrement .pptx, export PDF.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import {
  AlignCenter, AlignEndHorizontal, AlignHorizontalJustifyCenter, AlignJustify, AlignLeft, AlignRight, AlignStartHorizontal, AlignVerticalJustifyCenter,
  ArrowDownToLine, ArrowUpToLine, BarChart3, Baseline, Bold, BringToFront, Calendar, ChevronDown, ChevronUp, Clipboard, Copy, CopyPlus, Eye, EyeOff,
  FileVideo, Grid3x3, Image as ImageIcon, Italic, LayoutGrid, LayoutTemplate, Link as LinkIcon, List, ListOrdered, Minus, MonitorPlay, MoveDiagonal,
  NotebookPen, PaintBucket, Palette, Play, Plus, Presentation, RotateCw, Scissors, SendToBack, Shapes, Sigma, Smile, Sparkles, Square, Strikethrough,
  Table as TableIcon, Trash2, Type, Underline, Wand2, X, ZoomIn, ZoomOut, Hash, Ratio, PenLine, ArrowRight, Columns2, RemoveFormatting, ArrowLeftRight,
  AlignVerticalJustifyStart, AlignVerticalJustifyEnd, Layers, Group, Spline,
} from "lucide-react";
import { toast } from "sonner";
import { downloadBlob } from "@/lib/download";
import { cn } from "@/lib/utils";
import { OfficeShell, type ExportFormat } from "../shared/OfficeShell";
import { useOfficeEnv, type Tr } from "../shared/useOfficeEnv";
import { useOfficeFile } from "../shared/useOfficeFile";
import { pickFile, readFileAsArrayBuffer, readFileAsDataUrl, stripExt } from "../shared/officeStore";
import { BigBtn, ColorButton, ColorPalette, MenuItem, RGroup, RMenu, RRow, RSelect, RStack, RibbonBody, RibbonTabStrip, SmallBtn, type OfficeTab } from "../shared/Ribbon";
import { ChartDialog } from "../shared/ChartDialog";
import { SlideThumb } from "../shared/Thumbs";
import {
  LAYOUTS, SHAPES, THEMES, buildPptTemplate, layoutLabel, makeSlide, pptTemplates, shapePath, themeOf, uid,
  type AnimType, type Deck, type ShapeKind, type Slide, type SlideEl, type TransType,
} from "./model";
import { SlideView } from "./SlideView";
import { Slideshow } from "./Slideshow";
import "./ppt.css";

const FONTS = ["Calibri", "Calibri Light", "Segoe UI", "Arial", "Aptos", "Century Gothic", "Montserrat", "Georgia", "Garamond", "Times New Roman", "Cambria", "Trebuchet MS", "Verdana", "Tahoma", "Comic Sans MS", "Impact", "Courier New", "Cairo", "Tajawal", "Amiri", "Noto Naskh Arabic"];
const SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 54, 60, 72, 88, 96, 120];
const EMOJIS = "😀 😃 😊 😍 🤩 😎 🤔 😮 😢 👍 👏 🙏 💪 👌 ✌️ 🤝 ❤️ 💡 ⭐ 🔥 ✅ ❌ ⚠️ 📌 📚 📖 ✏️ 📝 📐 📏 🧮 🔢 🧪 🔬 🌍 🏆 🎯 🎓 🏫 ⏰ 📅 💬 📢 🎉 🚀 📊 📈 🧠 💼".split(" ");

type TabId = "home" | "insert" | "design" | "transitions" | "animations" | "show" | "view" | "format" | "table";

export default function PptEditor() {
  const { L, dir, isRtl, dark } = useOfficeEnv();
  const [deck, setDeck] = useState<Deck>(() => buildPptTemplate("blank", L));
  const deckRef = useRef(deck);
  deckRef.current = deck;
  const [cur, setCur] = useState(0);
  const [sel, setSel] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("home");
  const [backstage, setBackstage] = useState(false);
  const [view, setView] = useState<"normal" | "sorter">("normal");
  const [showNotes, setShowNotes] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null); // null = ajuster
  const [show, setShow] = useState<{ from: number; presenter: boolean } | null>(null);
  const [chartOpen, setChartOpen] = useState(false);
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const undoRef = useRef<Deck[]>([]);
  const redoRef = useRef<Deck[]>([]);
  const [, bump] = useState(0);
  const clipRef = useRef<SlideEl[] | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 900, h: 520 });
  const [lastFill, setLastFill] = useState("#4472C4");
  const [lastLine, setLastLine] = useState("#1F1F1F");
  const [lastColor, setLastColor] = useState("#C00000");

  const file = useOfficeFile<Deck>("ppt", () => ({ data: deckRef.current, preview: `${deckRef.current.slides.length} ${L("diapositive(s)", "شريحة", "slide(s)")}` }));
  const markDirtyRef = useRef(file.markDirty);
  markDirtyRef.current = file.markDirty;

  const slide = deck.slides[Math.min(cur, deck.slides.length - 1)] || deck.slides[0];
  const selected = slide ? slide.els.filter((e) => sel.includes(e.id)) : [];
  const one = selected.length === 1 ? selected[0] : null;
  const theme = themeOf(deck.theme);

  // ---------- Historique ----------
  // Copie légère (les chaînes d'images sont partagées) : rapide même avec beaucoup d'images.
  const commit = useCallback((fn: (d: Deck) => void, opts?: { noHistory?: boolean }) => {
    const before = deckRef.current;
    const next = cloneDeck(before);
    fn(next);
    if (!opts?.noHistory) {
      undoRef.current.push(before);
      if (undoRef.current.length > 150) undoRef.current.shift();
      redoRef.current = [];
    }
    deckRef.current = next;
    setDeck(next);
    markDirtyRef.current();
  }, []);
  const undo = () => {
    const prev = undoRef.current.pop();
    if (!prev) return;
    redoRef.current.push(deckRef.current);
    deckRef.current = prev; setDeck(prev); setEditingId(null); bump((x) => x + 1); markDirtyRef.current();
    setCur((c) => Math.min(c, prev.slides.length - 1));
  };
  const redo = () => {
    const nxt = redoRef.current.pop();
    if (!nxt) return;
    undoRef.current.push(deckRef.current);
    deckRef.current = nxt; setDeck(nxt); setEditingId(null); bump((x) => x + 1); markDirtyRef.current();
    setCur((c) => Math.min(c, nxt.slides.length - 1));
  };
  const updSlide = (fn: (s: Slide, d: Deck) => void, opts?: { noHistory?: boolean }) => commit((d) => { const s = d.slides[cur]; if (s) fn(s, d); }, opts);
  const updSel = (fn: (e: SlideEl) => void) => updSlide((s) => s.els.forEach((e) => { if (sel.includes(e.id)) fn(e); }));

  // Point d'annulation au début de chaque saisie de texte (la frappe elle-même n'encombre pas l'historique)
  const snapshot = () => { undoRef.current.push(deckRef.current); if (undoRef.current.length > 150) undoRef.current.shift(); redoRef.current = []; };
  useEffect(() => { if (editingId) snapshot(); }, [editingId]);

  // ---------- Fichier ----------
  const loadDeck = (d: Deck) => {
    undoRef.current = []; redoRef.current = [];
    deckRef.current = d; setDeck(d); setCur(0); setSel([]); setEditingId(null);
  };
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    (async () => {
      const rec = await file.loadLast();
      if (rec?.data?.slides?.length) loadDeck(rec.data);
      else { file.startFile(L("Présentation1", "عرض1", "Presentation1")); loadDeck(buildPptTemplate("blank", L)); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onNew = async (tid: string) => {
    await file.saveNow();
    const t = pptTemplates(L).find((x) => x.id === tid);
    file.startFile(tid === "blank" ? L("Présentation", "عرض", "Presentation") + (Math.floor(Math.random() * 90) + 10) : t?.label || "Présentation");
    loadDeck(buildPptTemplate(tid, L));
    void file.saveNow();
  };
  const onOpenFile = async (f: File) => {
    const tId = toast.loading(L("Ouverture…", "جارٍ الفتح…", "Opening…"));
    try {
      if (!/\.pptx$/i.test(f.name)) throw new Error(/\.ppt$/i.test(f.name) ? "ppt" : "format");
      await file.saveNow();
      const { importPptx } = await import("./pptxImport");
      const d = await importPptx(await readFileAsArrayBuffer(f));
      file.startFile(stripExt(f.name));
      loadDeck(d);
      void file.saveNow();
      toast.success(L("Présentation ouverte", "تم فتح العرض", "Presentation opened"), { id: tId });
    } catch (e) {
      console.error(e);
      toast.error((e as Error).message === "ppt"
        ? L("L'ancien format .ppt n'est pas pris en charge : enregistrez-le en .pptx.", "الصيغة القديمة ‎.ppt غير مدعومة: احفظه بصيغة ‎.pptx.", "Legacy .ppt is not supported: save as .pptx.")
        : L("Ce fichier n'a pas pu être ouvert.", "تعذر فتح هذا الملف.", "This file could not be opened."), { id: tId });
    }
  };
  const onOpenRecent = async (id: string) => {
    await file.saveNow();
    const rec = await file.openRecord(id);
    if (rec?.data) loadDeck(rec.data);
  };
  const formats: ExportFormat[] = [
    { id: "pptx", ext: "pptx", label: L("Présentation PowerPoint", "عرض PowerPoint", "PowerPoint presentation"), desc: L("S'ouvre dans PowerPoint, LibreOffice, Google Slides", "يفتح في PowerPoint وLibreOffice وGoogle Slides", "Opens in PowerPoint, LibreOffice, Google Slides") },
    { id: "pdf", ext: "pdf", label: "PDF", desc: L("Une diapositive par page (fenêtre d'impression)", "شريحة في كل صفحة (نافذة الطباعة)", "One slide per page (print dialog)") },
    { id: "png", ext: "png", label: L("Image de la diapositive", "صورة الشريحة", "Slide image"), desc: L("Diapositive actuelle en PNG", "الشريحة الحالية بصيغة PNG", "Current slide as PNG") },
  ];
  const onExport = async (fid: string) => {
    const name = file.fileName || "Présentation";
    if (fid === "pptx") {
      const { exportPptx } = await import("./pptxExport");
      await downloadBlob(await exportPptx(deckRef.current), `${name}.pptx`);
    } else if (fid === "pdf") printDeck();
    else {
      const { slideToPng } = await import("./pptxExport");
      const url = await slideToPng(deckRef.current, deckRef.current.slides[cur]);
      const blob = await (await fetch(url)).blob();
      await downloadBlob(blob, `${name}-${cur + 1}.png`);
    }
  };
  const printDeck = async () => {
    const w = window.open("", "_blank");
    if (!w) { toast.error(L("Autorisez les fenêtres pop-up pour imprimer.", "اسمح بالنوافذ المنبثقة للطباعة.", "Allow pop-ups to print.")); return; }
    w.document.write(`<p style="font-family:sans-serif">${L("Préparation…", "جارٍ التحضير…", "Preparing…")}</p>`);
    const { slideToPng } = await import("./pptxExport");
    const d = deckRef.current;
    const imgs: string[] = [];
    for (const s of d.slides) if (!s.hidden) imgs.push(await slideToPng(d, s));
    w.document.open();
    w.document.write(`<!doctype html><html><head><title>${file.fileName}</title><style>@page{size:${d.w === 960 && d.h === 540 ? "254mm 142.9mm" : "254mm 190.5mm"};margin:0}body{margin:0}img{display:block;width:100%;height:100vh;object-fit:contain;break-after:page}</style></head><body>${imgs.map((u) => `<img src="${u}">`).join("")}<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script></body></html>`);
    w.document.close();
  };

  // ---------- Diapositives ----------
  const addSlide = (layout = "titleContent", at = cur + 1) => {
    commit((d) => { const s = makeSlide(layout, d, L); if (isRtl) s.els.forEach((e) => { e.dir = "rtl"; }); d.slides.splice(at, 0, s); });
    setCur(at); setSel([]); setEditingId(null);
  };
  const duplicateSlide = (i = cur) => {
    commit((d) => { const c = JSON.parse(JSON.stringify(d.slides[i])) as Slide; c.id = uid(); c.els.forEach((e) => (e.id = uid())); d.slides.splice(i + 1, 0, c); });
    setCur(i + 1);
  };
  const deleteSlide = (i = cur) => {
    if (deck.slides.length <= 1) { commit((d) => { d.slides = [makeSlide("blank", d, L)]; }); return; }
    commit((d) => { d.slides.splice(i, 1); });
    setCur((c) => Math.max(0, Math.min(c, deck.slides.length - 2)));
    setSel([]);
  };
  const moveSlide = (from: number, to: number) => {
    if (from === to || to < 0 || to >= deck.slides.length) return;
    commit((d) => { const [s] = d.slides.splice(from, 1); d.slides.splice(to, 0, s); });
    setCur(to);
  };
  const changeLayout = (layout: string) => updSlide((s, d) => {
    const fresh = makeSlide(layout, d, L);
    const oldPh = s.els.filter((e) => e.ph);
    const keep = s.els.filter((e) => !e.ph);
    fresh.els.forEach((e) => { const o = oldPh.find((x) => x.ph === e.ph && x.html); if (o) { e.html = o.html; oldPh.splice(oldPh.indexOf(o), 1); } });
    s.els = [...fresh.els, ...keep];
    s.layout = layout;
  });

  // ---------- Éléments ----------
  const addEl = (p: Partial<SlideEl>) => {
    const el: SlideEl = { id: uid(), kind: "text", x: deck.w / 2 - 150, y: deck.h / 2 - 40, w: 300, h: 80, ...p };
    if (isRtl && (el.kind === "text" || el.kind === "shape") && !el.dir) el.dir = "rtl";
    updSlide((s) => { s.els.push(el); });
    setSel([el.id]);
    return el;
  };
  const addText = () => { const el = addEl({ kind: "text", html: "", size: 20, w: 360, h: 60 }); setEditingId(el.id); };
  const addShape = (shape: ShapeKind) => addEl({ kind: "shape", shape, w: 200, h: shape === "rightArrow" || shape === "leftArrow" ? 110 : 160, x: deck.w / 2 - 100, y: deck.h / 2 - 80, fill: "accent", stroke: null, html: "", color: "#FFFFFF", align: "center", valign: "middle", size: 18 });
  const addLine = (arrow: boolean) => addEl({ kind: "line", w: 260, h: 4, x: deck.w / 2 - 130, y: deck.h / 2, stroke: "text", strokeW: 3, arrow });
  const addImages = async () => {
    const files = await pickFile("image/*", true);
    for (const f of files) {
      const src = await readFileAsDataUrl(f);
      const img = await new Promise<HTMLImageElement>((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(i); i.src = src; });
      const ratio = (img.naturalHeight || 3) / (img.naturalWidth || 4);
      const w = Math.min(deck.w * 0.6, img.naturalWidth || 400);
      addEl({ kind: "image", src, w, h: w * ratio, x: (deck.w - w) / 2, y: Math.max(20, (deck.h - w * ratio) / 2) });
    }
  };
  const addTable = (r: number, c: number) => addEl({ kind: "table", x: 60, y: 140, w: deck.w - 120, h: Math.min(deck.h - 180, 44 * r), size: 16, table: { rows: Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => (i === 0 ? `${L("Titre", "عنوان", "Header")} ${j + 1}` : ""))), header: true, style: "theme" } });
  const deleteSel = () => { if (!sel.length) return; updSlide((s) => { s.els = s.els.filter((e) => !sel.includes(e.id) || e.locked); }); setSel([]); setEditingId(null); };
  const copySel = () => { clipRef.current = JSON.parse(JSON.stringify(selected)); };
  const paste = () => {
    const c = clipRef.current;
    if (!c?.length) return;
    const ids: string[] = [];
    updSlide((s) => c.forEach((e) => { const n = { ...JSON.parse(JSON.stringify(e)), id: uid(), x: e.x + 20, y: e.y + 20 }; ids.push(n.id); s.els.push(n); }));
    clipRef.current = c.map((e) => ({ ...e, x: e.x + 20, y: e.y + 20 }));
    setSel(ids);
  };
  const duplicateSel = () => { copySel(); paste(); };
  const arrange = (mode: "front" | "back" | "forward" | "backward") => updSlide((s) => {
    const ids = new Set(sel);
    const picked = s.els.filter((e) => ids.has(e.id));
    const rest = s.els.filter((e) => !ids.has(e.id));
    if (mode === "front") s.els = [...rest, ...picked];
    else if (mode === "back") s.els = [...picked, ...rest];
    else {
      const arr = [...s.els];
      const order = mode === "forward" ? [...arr.keys()].reverse() : [...arr.keys()];
      for (const i of order) {
        if (!ids.has(arr[i].id)) continue;
        const j = mode === "forward" ? i + 1 : i - 1;
        if (j < 0 || j >= arr.length || ids.has(arr[j].id)) continue;
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      s.els = arr;
    }
  });
  const align = (mode: "left" | "hcenter" | "right" | "top" | "vmiddle" | "bottom" | "hdist" | "vdist") => {
    const many = selected.length > 1;
    const bx = many ? { x: Math.min(...selected.map((e) => e.x)), y: Math.min(...selected.map((e) => e.y)), r: Math.max(...selected.map((e) => e.x + e.w)), b: Math.max(...selected.map((e) => e.y + e.h)) } : { x: 0, y: 0, r: deck.w, b: deck.h };
    updSel((e) => {
      if (mode === "left") e.x = bx.x;
      if (mode === "right") e.x = bx.r - e.w;
      if (mode === "hcenter") e.x = (bx.x + bx.r) / 2 - e.w / 2;
      if (mode === "top") e.y = bx.y;
      if (mode === "bottom") e.y = bx.b - e.h;
      if (mode === "vmiddle") e.y = (bx.y + bx.b) / 2 - e.h / 2;
    });
    if ((mode === "hdist" || mode === "vdist") && selected.length > 2) {
      const key = mode === "hdist" ? "x" : "y";
      const dim = mode === "hdist" ? "w" : "h";
      const sorted = [...selected].sort((a, b) => a[key] - b[key]);
      const total = sorted.reduce((a, e) => a + e[dim], 0);
      const span = sorted[sorted.length - 1][key] + sorted[sorted.length - 1][dim] - sorted[0][key];
      const gap = (span - total) / (sorted.length - 1);
      let p = sorted[0][key];
      const pos: Record<string, number> = {};
      sorted.forEach((e) => { pos[e.id] = p; p += e[dim] + gap; });
      updSel((e) => { e[key] = pos[e.id]; });
    }
  };

  // ---------- Mise en forme du texte ----------
  const editingEl = () => document.querySelector<HTMLElement>(".ppt-editing");
  const exec = (cmd: string, value?: string) => {
    const ed = editingEl();
    if (!ed) return false;
    ed.focus();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(cmd, false, value);
    syncEditing();
    return true;
  };
  const syncEditing = () => {
    const ed = editingEl();
    if (!ed || !editingId) return;
    const html = ed.innerHTML;
    updSlide((s) => { const e = s.els.find((x) => x.id === editingId); if (e) e.html = html; }, { noHistory: true });
  };
  const toggleProp = (k: "bold" | "italic" | "underline" | "strike", cmd: string) => {
    if (exec(cmd)) return;
    const v = !one?.[k];
    updSel((e) => { e[k] = v; });
  };
  const setFontSize = (pt: number) => {
    const ed = editingEl();
    const s = window.getSelection();
    if (ed && s && !s.isCollapsed && ed.contains(s.anchorNode)) {
      document.execCommand("styleWithCSS", false, "false");
      document.execCommand("fontSize", false, "7");
      ed.querySelectorAll('font[size="7"]').forEach((f) => { const sp = document.createElement("span"); sp.style.fontSize = `${pt * (96 / 72)}px`; sp.innerHTML = f.innerHTML; f.replaceWith(sp); });
      syncEditing();
      return;
    }
    updSel((e) => { e.size = pt; });
  };
  const setFont = (f: string) => { if (!exec("fontName", f)) updSel((e) => { e.font = f; }); };
  const setColor = (c: string) => { setLastColor(c); if (!exec("foreColor", c)) updSel((e) => { e.color = c; }); };
  const setAlign = (a: "left" | "center" | "right" | "justify") => updSel((e) => { e.align = a; });
  const toggleList = (ordered: boolean) => {
    if (exec(ordered ? "insertOrderedList" : "insertUnorderedList")) return;
    updSel((e) => {
      const div = document.createElement("div");
      div.innerHTML = e.html || "";
      const list = div.querySelector("ul,ol");
      if (list) {
        const items = Array.from(list.querySelectorAll("li")).map((li) => `<p>${li.innerHTML}</p>`).join("");
        if ((list.tagName === "OL") === ordered) { e.html = items; return; }
        e.html = `<${ordered ? "ol" : "ul"}>${Array.from(list.querySelectorAll("li")).map((li) => `<li>${li.innerHTML}</li>`).join("")}</${ordered ? "ol" : "ul"}>`;
        return;
      }
      const lines = (div.innerHTML.split(/<br\s*\/?>|<\/p>|<\/div>/i).map((x) => x.replace(/<p[^>]*>|<div[^>]*>/gi, "").trim()).filter(Boolean));
      e.html = `<${ordered ? "ol" : "ul"}>${(lines.length ? lines : [""]).map((l) => `<li>${l}</li>`).join("")}</${ordered ? "ol" : "ul"}>`;
    });
  };
  const sizeShown = one?.size ?? 18;

  // ---------- Glisser / redimensionner / pivoter ----------
  const scale = useMemo(() => {
    if (zoom) return zoom;
    const notesH = 0;
    return Math.max(0.1, Math.min((stageSize.w - 48) / deck.w, (stageSize.h - 40 - notesH) / deck.h));
  }, [zoom, stageSize, deck.w, deck.h]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStageSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  const dragRef = useRef<null | { mode: "move" | "resize" | "rotate"; handle?: string; sx: number; sy: number; orig: Record<string, SlideEl>; before: Deck; moved: boolean; cx?: number; cy?: number }>(null);

  const startDrag = (e: RPointerEvent, mode: "move" | "resize" | "rotate", handle?: string, ids?: string[]) => {
    const useIds = ids || sel;
    const orig: Record<string, SlideEl> = {};
    slide.els.forEach((x) => { if (useIds.includes(x.id)) orig[x.id] = { ...x }; });
    const o = one || slide.els.find((x) => x.id === useIds[0]);
    dragRef.current = { mode, handle, sx: e.clientX, sy: e.clientY, orig, before: deckRef.current, moved: false, cx: o ? o.x + o.w / 2 : 0, cy: o ? o.y + o.h / 2 : 0 };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = (e.clientX - d.sx) / scale, dy = (e.clientY - d.sy) / scale;
      if (!d.moved && Math.abs(dx) + Math.abs(dy) < 2) return;
      d.moved = true;
      const next: Deck = { ...deckRef.current, slides: deckRef.current.slides.slice() };
      const s = { ...next.slides[cur], els: next.slides[cur].els.map((x) => ({ ...x })) };
      next.slides[cur] = s;
      const gv: number[] = [], gh: number[] = [];
      s.els.forEach((el) => {
        const o = d.orig[el.id];
        if (!o || o.locked) return;
        if (d.mode === "move") {
          let nx = o.x + dx, ny = o.y + dy;
          if (!e.altKey && Object.keys(d.orig).length === 1) {
            // repères : centre et bords de la diapositive, bords / centres des autres éléments
            const tx = [0, deck.w / 2, deck.w, ...s.els.filter((x) => !d.orig[x.id]).flatMap((x) => [x.x, x.x + x.w / 2, x.x + x.w])];
            const ty = [0, deck.h / 2, deck.h, ...s.els.filter((x) => !d.orig[x.id]).flatMap((x) => [x.y, x.y + x.h / 2, x.y + x.h])];
            const snap = (v: number, size: number, targets: number[], out: number[]) => {
              for (const t of targets) for (const off of [0, size / 2, size]) if (Math.abs(v + off - t) < 6 / scale) { out.push(t); return t - off; }
              return v;
            };
            nx = snap(nx, o.w, tx, gv);
            ny = snap(ny, o.h, ty, gh);
          }
          if (showGrid && !e.altKey) { nx = Math.round(nx / 20) * 20; ny = Math.round(ny / 20) * 20; }
          el.x = nx; el.y = ny;
        } else if (d.mode === "resize" && d.handle) {
          let { x, y, w, h } = o;
          const hd = d.handle;
          if (hd.includes("e")) w = Math.max(10, o.w + dx);
          if (hd.includes("s")) h = Math.max(4, o.h + dy);
          if (hd.includes("w")) { w = Math.max(10, o.w - dx); x = o.x + o.w - w; }
          if (hd.includes("n")) { h = Math.max(4, o.h - dy); y = o.y + o.h - h; }
          if ((e.shiftKey || o.kind === "image") && hd.length === 2) {
            const r = o.h / o.w;
            h = w * r;
            if (hd.includes("n")) y = o.y + o.h - h;
          }
          Object.assign(el, { x, y, w, h });
        } else if (d.mode === "rotate") {
          const rect = stageRef.current?.querySelector(".ppt-canvas")?.getBoundingClientRect();
          if (!rect) return;
          const cx = rect.left + (d.cx || 0) * scale, cy = rect.top + (d.cy || 0) * scale;
          let a = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI + 90;
          if (e.shiftKey) a = Math.round(a / 15) * 15;
          else for (const sn of [0, 90, 180, 270, 360, -90]) if (Math.abs(a - sn) < 4) a = sn;
          el.rot = Math.round(((a % 360) + 360) % 360);
        }
      });
      setGuides({ v: gv, h: gh });
      deckRef.current = next;
      setDeck(next);
    };
    const onUp = () => {
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      setGuides({ v: [], h: [] });
      if (d.moved) {
        undoRef.current.push(d.before);
        redoRef.current = [];
        markDirtyRef.current();
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [scale, cur, deck.w, deck.h, showGrid]);

  const onElPointerDown = (e: RPointerEvent, el: SlideEl) => {
    if (editingId === el.id) return;
    e.stopPropagation();
    if (editingId) { syncEditing(); setEditingId(null); }
    let ids = sel;
    if (e.shiftKey || e.ctrlKey || e.metaKey) ids = sel.includes(el.id) ? sel.filter((x) => x !== el.id) : [...sel, el.id];
    else if (!sel.includes(el.id)) ids = [el.id];
    setSel(ids);
    if (ids.includes(el.id)) startDrag(e, "move", undefined, ids);
  };
  const onElDouble = (el: SlideEl) => {
    if (el.kind === "text" || el.kind === "shape" || el.kind === "table") { setSel([el.id]); setEditingId(el.id); }
    if (el.kind === "image") void replaceImage();
    if (el.kind === "video") { const u = window.prompt("YouTube URL", el.url || ""); if (u !== null) updSel((x) => { x.url = u; }); }
  };
  const replaceImage = async () => {
    const [f] = await pickFile("image/*");
    if (!f) return;
    const src = await readFileAsDataUrl(f);
    updSel((x) => { if (x.kind === "image") x.src = src; });
  };

  // Sélection par rectangle
  const marqueeRef = useRef<{ sx: number; sy: number } | null>(null);
  const canvasPoint = (e: { clientX: number; clientY: number }) => {
    const r = stageRef.current?.querySelector(".ppt-canvas")?.getBoundingClientRect();
    return r ? { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale } : { x: 0, y: 0 };
  };
  const onCanvasDown = (e: RPointerEvent) => {
    if (editingId) { syncEditing(); setEditingId(null); }
    if (!e.shiftKey) setSel([]);
    const p = canvasPoint(e);
    marqueeRef.current = { sx: p.x, sy: p.y };
    setMarquee({ x: p.x, y: p.y, w: 0, h: 0 });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onCanvasMove = (e: RPointerEvent) => {
    const m = marqueeRef.current;
    if (!m) return;
    const p = canvasPoint(e);
    setMarquee({ x: Math.min(m.sx, p.x), y: Math.min(m.sy, p.y), w: Math.abs(p.x - m.sx), h: Math.abs(p.y - m.sy) });
  };
  const onCanvasUp = () => {
    const m = marquee;
    marqueeRef.current = null;
    setMarquee(null);
    if (m && m.w > 4 && m.h > 4) setSel(slide.els.filter((el) => el.x < m.x + m.w && el.x + el.w > m.x && el.y < m.y + m.h && el.y + el.h > m.y).map((el) => el.id));
  };

  // ---------- Clavier ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (show || backstage) return;
      const tgt = e.target as HTMLElement;
      const typing = tgt.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(tgt.tagName);
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === "F5") { e.preventDefault(); setShow({ from: e.shiftKey ? cur : 0, presenter: false }); return; }
      if (typing) return;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); return; }
      if (mod && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) { e.preventDefault(); redo(); return; }
      if (mod && e.key.toLowerCase() === "c") { copySel(); return; }
      if (mod && e.key.toLowerCase() === "x") { copySel(); deleteSel(); return; }
      if (mod && e.key.toLowerCase() === "v") { if (clipRef.current) { e.preventDefault(); paste(); } return; }
      if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateSel(); return; }
      if (mod && e.key.toLowerCase() === "a") { e.preventDefault(); setSel(slide.els.map((x) => x.id)); return; }
      if (mod && e.key.toLowerCase() === "m") { e.preventDefault(); addSlide(); return; }
      if (e.key === "Delete" || e.key === "Backspace") { if (sel.length) { e.preventDefault(); deleteSel(); } else if (view === "sorter" || document.activeElement?.closest(".ppt-thumbs")) deleteSlide(); return; }
      if (e.key === "Escape") { setSel([]); return; }
      if (e.key === "Enter" && one && (one.kind === "text" || one.kind === "shape")) { e.preventDefault(); setEditingId(one.id); return; }
      if (e.key.startsWith("Arrow") && sel.length) {
        e.preventDefault();
        const st = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -st : e.key === "ArrowRight" ? st : 0;
        const dy = e.key === "ArrowUp" ? -st : e.key === "ArrowDown" ? st : 0;
        updSel((x) => { x.x += dx; x.y += dy; });
        return;
      }
      if ((e.key === "PageDown" || e.key === "ArrowDown") && !sel.length) { setCur((c) => Math.min(deck.slides.length - 1, c + 1)); return; }
      if ((e.key === "PageUp" || e.key === "ArrowUp") && !sel.length) { setCur((c) => Math.max(0, c - 1)); return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Coller une image depuis le presse-papiers
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      if ((e.target as HTMLElement)?.isContentEditable) return;
      const f = Array.from(e.clipboardData?.files || []).find((x) => x.type.startsWith("image/"));
      if (!f) return;
      e.preventDefault();
      const src = await readFileAsDataUrl(f);
      addEl({ kind: "image", src, w: 400, h: 300, x: deck.w / 2 - 200, y: deck.h / 2 - 150 });
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  // Onglets contextuels
  useEffect(() => {
    if ((tab === "format" && !sel.length) || (tab === "table" && one?.kind !== "table")) setTab("home");
  }, [sel, tab, one]);

  // ---------- Ruban ----------
  const tabs: OfficeTab[] = [
    { id: "home", label: L("Accueil", "الرئيسية", "Home") },
    { id: "insert", label: L("Insertion", "إدراج", "Insert") },
    { id: "design", label: L("Création", "تصميم", "Design") },
    { id: "transitions", label: L("Transitions", "انتقالات", "Transitions") },
    { id: "animations", label: L("Animations", "حركات", "Animations") },
    { id: "show", label: L("Diaporama", "عرض الشرائح", "Slide Show") },
    { id: "view", label: L("Affichage", "عرض", "View") },
    ...(sel.length ? [{ id: "format", label: L("Format de la forme", "تنسيق الشكل", "Shape Format"), contextual: true }] : []),
    ...(one?.kind === "table" ? [{ id: "table", label: L("Tableau", "جدول", "Table"), contextual: true }] : []),
  ];

  const LayoutPicker = ({ onPick }: { onPick: (l: string) => void }) => (
    <div className="grid grid-cols-3 gap-2">
      {LAYOUTS.map((l) => {
        const s = makeSlide(l, deck, L, { title: layoutLabel(l, L) });
        return (
          <button key={l} type="button" onClick={() => onPick(l)} className="rounded border p-1 text-start hover:border-[color:var(--office-accent)]">
            <div className="pointer-events-none overflow-hidden rounded-sm border"><SlideView slide={s} deck={deck} scale={92 / deck.w} mode="thumb" L={L} /></div>
            <div className="mt-1 truncate text-[10.5px]">{layoutLabel(l, L)}</div>
          </button>
        );
      })}
    </div>
  );

  const ShapeGrid = ({ onPick }: { onPick: (k: ShapeKind) => void }) => (
    <div className="grid grid-cols-6 gap-1">
      {SHAPES.map((k) => (
        <button key={k} type="button" title={k} onClick={() => onPick(k)} className="flex h-9 items-center justify-center rounded border hover:bg-muted">
          <svg width="26" height="20" viewBox="0 0 26 20" className="overflow-visible"><path d={shapePath(k, 26, 20, 5)} fill="var(--office-accent)" opacity={0.85} /></svg>
        </button>
      ))}
    </div>
  );

  const transList: { id: TransType; label: string }[] = [
    { id: "none", label: L("Aucune", "بدون", "None") }, { id: "fade", label: L("Fondu", "تلاشي", "Fade") }, { id: "push", label: L("Pousser", "دفع", "Push") },
    { id: "wipe", label: L("Balayer", "مسح", "Wipe") }, { id: "zoom", label: L("Zoom", "تكبير", "Zoom") }, { id: "cover", label: L("Couvrir", "تغطية", "Cover") },
    { id: "split", label: L("Fractionner", "انقسام", "Split") }, { id: "reveal", label: L("Révéler", "كشف", "Reveal") }, { id: "flip", label: L("Retourner", "قلب", "Flip") },
    { id: "morph", label: L("Morphose", "تحول", "Morph") },
  ];
  const animList: { id: AnimType; label: string }[] = [
    { id: "none", label: L("Aucune", "بدون", "None") }, { id: "appear", label: L("Apparaître", "ظهور", "Appear") }, { id: "fade", label: L("Fondu", "تلاشي", "Fade") },
    { id: "flyBottom", label: L("Entrée (bas)", "دخول (أسفل)", "Fly in (bottom)") }, { id: "flyLeft", label: L("Entrée (gauche)", "دخول (يسار)", "Fly in (left)") },
    { id: "flyRight", label: L("Entrée (droite)", "دخول (يمين)", "Fly in (right)") }, { id: "zoom", label: L("Zoom", "تكبير", "Zoom") },
    { id: "bounce", label: L("Rebond", "ارتداد", "Bounce") }, { id: "spin", label: L("Rotation", "دوران", "Spin") }, { id: "wipe", label: L("Balayage", "مسح", "Wipe") },
    { id: "pulse", label: L("Pulsation", "نبض", "Pulse") },
  ];
  const [previewKey, setPreviewKey] = useState(0);
  const [previewAnim, setPreviewAnim] = useState(false);

  const ribbon = (
    <>
      <RibbonTabStrip
        tabs={tabs}
        value={tab}
        onChange={(v) => setTab(v as TabId)}
        onFile={() => setBackstage(true)}
        fileLabel={L("Fichier", "ملف", "File")}
        accent="#C43E1C"
        end={
          <>
            <button type="button" onClick={() => setShow({ from: cur, presenter: false })} className="flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] hover:bg-muted">
              <Play className="h-3.5 w-3.5 text-[#C43E1C]" /> <span className="hidden sm:inline">{L("Présenter", "عرض", "Present")}</span>
            </button>
          </>
        }
      />
      <RibbonBody>
        {tab === "home" && (
          <>
            <RGroup label={L("Presse-papiers", "الحافظة", "Clipboard")}>
              <BigBtn icon={Clipboard} label={L("Coller", "لصق", "Paste")} onClick={paste} disabled={!clipRef.current} />
              <RStack>
                <SmallBtn icon={Scissors} label={L("Couper", "قص", "Cut")} withLabel disabled={!sel.length} onClick={() => { copySel(); deleteSel(); }} />
                <SmallBtn icon={Copy} label={L("Copier", "نسخ", "Copy")} withLabel disabled={!sel.length} onClick={copySel} />
                <SmallBtn icon={CopyPlus} label={L("Dupliquer", "تكرار", "Duplicate")} withLabel disabled={!sel.length} onClick={duplicateSel} />
              </RStack>
            </RGroup>
            <RGroup label={L("Diapositives", "الشرائح", "Slides")}>
              <RMenu big icon={Plus} label={L("Nouvelle diapositive", "شريحة جديدة", "New slide")} width={330}>
                {(close) => <LayoutPicker onPick={(l) => { addSlide(l); close(); }} />}
              </RMenu>
              <RStack>
                <RMenu label={L("Disposition", "تخطيط", "Layout")} trigger={<SmallBtn icon={LayoutTemplate} label={L("Disposition", "تخطيط", "Layout")} withLabel />} width={330}>
                  {(close) => <LayoutPicker onPick={(l) => { changeLayout(l); close(); }} />}
                </RMenu>
                <SmallBtn icon={CopyPlus} label={L("Dupliquer la diapo", "تكرار الشريحة", "Duplicate slide")} withLabel onClick={() => duplicateSlide()} />
                <SmallBtn icon={Trash2} label={L("Supprimer la diapo", "حذف الشريحة", "Delete slide")} withLabel onClick={() => deleteSlide()} />
              </RStack>
            </RGroup>
            <RGroup label={L("Police", "الخط", "Font")}>
              <RStack>
                <RRow>
                  <RSelect title={L("Police", "الخط", "Font")} width={140} value={one?.font || (one?.ph === "title" ? theme.headFont : theme.bodyFont).split(",")[0]} onChange={setFont} options={FONTS.map((f) => ({ value: f, label: f, style: { fontFamily: f } }))} />
                  <RSelect editable title={L("Taille", "الحجم", "Size")} width={54} value={String(sizeShown)} onChange={(v) => { const n = parseFloat(v); if (n > 0 && n < 400) setFontSize(n); }} options={SIZES.map((s) => ({ value: String(s), label: String(s) }))} />
                  <SmallBtn icon={Plus} label={L("Augmenter la taille", "تكبير", "Grow")} onClick={() => setFontSize(SIZES.find((s) => s > sizeShown) || sizeShown + 4)} />
                  <SmallBtn icon={Minus} label={L("Réduire la taille", "تصغير", "Shrink")} onClick={() => setFontSize([...SIZES].reverse().find((s) => s < sizeShown) || Math.max(6, sizeShown - 2))} />
                  <SmallBtn icon={RemoveFormatting} label={L("Effacer la mise en forme", "مسح التنسيق", "Clear formatting")} onClick={() => { if (!exec("removeFormat")) updSel((e) => { e.bold = e.italic = e.underline = e.strike = false; e.color = undefined; e.font = undefined; }); }} />
                </RRow>
                <RRow>
                  <SmallBtn icon={Bold} label={L("Gras", "عريض", "Bold")} active={!!one?.bold} onClick={() => toggleProp("bold", "bold")} />
                  <SmallBtn icon={Italic} label={L("Italique", "مائل", "Italic")} active={!!one?.italic} onClick={() => toggleProp("italic", "italic")} />
                  <SmallBtn icon={Underline} label={L("Souligné", "تسطير", "Underline")} active={!!one?.underline} onClick={() => toggleProp("underline", "underline")} />
                  <SmallBtn icon={Strikethrough} label={L("Barré", "يتوسطه خط", "Strikethrough")} active={!!one?.strike} onClick={() => toggleProp("strike", "strikeThrough")} />
                  <SmallBtn icon={Sparkles} label={L("Ombre du texte", "ظل النص", "Text shadow")} active={!!one?.shadow} onClick={() => updSel((e) => { e.shadow = !e.shadow; })} />
                  <ColorButton icon={Baseline} label={L("Couleur de police", "لون الخط", "Font color")} color={lastColor} customLabel={L("Autres couleurs…", "ألوان أخرى…", "More colors…")} noneLabel={L("Automatique", "تلقائي", "Automatic")} onNone={() => updSel((e) => { e.color = undefined; })} onApply={setColor} />
                </RRow>
              </RStack>
            </RGroup>
            <RGroup label={L("Paragraphe", "فقرة", "Paragraph")}>
              <RStack>
                <RRow>
                  <SmallBtn icon={List} label={L("Puces", "تعداد نقطي", "Bullets")} onClick={() => toggleList(false)} />
                  <SmallBtn icon={ListOrdered} label={L("Numérotation", "ترقيم", "Numbering")} onClick={() => toggleList(true)} />
                  <SmallBtn icon={ArrowLeftRight} label={L("Sens du texte", "اتجاه النص", "Text direction")} active={one?.dir === "rtl"} onClick={() => updSel((e) => { e.dir = e.dir === "rtl" ? "ltr" : "rtl"; })} />
                  <RMenu label={L("Interligne", "تباعد الأسطر", "Line spacing")} icon={AlignVerticalJustifyCenter} width={150}>
                    {(close) => <>{[1, 1.2, 1.5, 2, 2.5].map((v) => <MenuItem key={v} label={String(v).replace(".", ",")} active={(one?.lineHeight || 1.2) === v} onClick={() => { updSel((e) => { e.lineHeight = v; }); close(); }} />)}</>}
                  </RMenu>
                </RRow>
                <RRow>
                  <SmallBtn icon={AlignLeft} label={L("Gauche", "يسار", "Left")} active={one?.align === "left"} onClick={() => setAlign("left")} />
                  <SmallBtn icon={AlignCenter} label={L("Centrer", "توسيط", "Center")} active={one?.align === "center"} onClick={() => setAlign("center")} />
                  <SmallBtn icon={AlignRight} label={L("Droite", "يمين", "Right")} active={one?.align === "right"} onClick={() => setAlign("right")} />
                  <SmallBtn icon={AlignJustify} label={L("Justifier", "ضبط", "Justify")} active={one?.align === "justify"} onClick={() => setAlign("justify")} />
                  <RMenu label={L("Aligner le texte", "محاذاة النص عموديا", "Align text")} icon={AlignVerticalJustifyStart} width={150}>
                    {(close) => <>{(["top", "middle", "bottom"] as const).map((v) => <MenuItem key={v} label={v === "top" ? L("Haut", "أعلى", "Top") : v === "middle" ? L("Milieu", "وسط", "Middle") : L("Bas", "أسفل", "Bottom")} active={one?.valign === v} onClick={() => { updSel((e) => { e.valign = v; }); close(); }} />)}</>}
                  </RMenu>
                </RRow>
              </RStack>
            </RGroup>
            <RGroup label={L("Dessin", "رسم", "Drawing")}>
              <RMenu big icon={Shapes} label={L("Formes", "أشكال", "Shapes")} width={260}>
                {(close) => (
                  <div className="space-y-2">
                    <ShapeGrid onPick={(k) => { addShape(k); close(); }} />
                    <div className="flex gap-1">
                      <button type="button" className="flex h-8 flex-1 items-center justify-center gap-1 rounded border text-xs hover:bg-muted" onClick={() => { addLine(false); close(); }}><Minus className="h-4 w-4" /> {L("Ligne", "خط", "Line")}</button>
                      <button type="button" className="flex h-8 flex-1 items-center justify-center gap-1 rounded border text-xs hover:bg-muted" onClick={() => { addLine(true); close(); }}><ArrowRight className="h-4 w-4" /> {L("Flèche", "سهم", "Arrow")}</button>
                    </div>
                  </div>
                )}
              </RMenu>
              <RMenu big icon={Layers} label={L("Organiser", "ترتيب", "Arrange")} width={210}>
                {(close) => (
                  <>
                    <MenuItem icon={BringToFront} label={L("Mettre au premier plan", "إحضار إلى الأمام", "Bring to front")} onClick={() => { arrange("front"); close(); }} />
                    <MenuItem icon={ChevronUp} label={L("Avancer", "تقديم للأمام", "Bring forward")} onClick={() => { arrange("forward"); close(); }} />
                    <MenuItem icon={ChevronDown} label={L("Reculer", "إرجاع للخلف", "Send backward")} onClick={() => { arrange("backward"); close(); }} />
                    <MenuItem icon={SendToBack} label={L("Mettre à l'arrière-plan", "إرسال إلى الخلف", "Send to back")} onClick={() => { arrange("back"); close(); }} />
                    <div className="my-1 border-t" />
                    <MenuItem icon={AlignStartHorizontal} label={L("Aligner à gauche", "محاذاة لليسار", "Align left")} onClick={() => { align("left"); close(); }} />
                    <MenuItem icon={AlignHorizontalJustifyCenter} label={L("Centrer horizontalement", "توسيط أفقي", "Align center")} onClick={() => { align("hcenter"); close(); }} />
                    <MenuItem icon={AlignEndHorizontal} label={L("Aligner à droite", "محاذاة لليمين", "Align right")} onClick={() => { align("right"); close(); }} />
                    <MenuItem icon={AlignVerticalJustifyStart} label={L("Aligner en haut", "محاذاة للأعلى", "Align top")} onClick={() => { align("top"); close(); }} />
                    <MenuItem icon={AlignVerticalJustifyCenter} label={L("Aligner au milieu", "توسيط عمودي", "Align middle")} onClick={() => { align("vmiddle"); close(); }} />
                    <MenuItem icon={AlignVerticalJustifyEnd} label={L("Aligner en bas", "محاذاة للأسفل", "Align bottom")} onClick={() => { align("bottom"); close(); }} />
                    <MenuItem icon={Columns2} label={L("Distribuer horizontalement", "توزيع أفقي", "Distribute horizontally")} onClick={() => { align("hdist"); close(); }} />
                    <MenuItem icon={Group} label={L("Distribuer verticalement", "توزيع عمودي", "Distribute vertically")} onClick={() => { align("vdist"); close(); }} />
                  </>
                )}
              </RMenu>
              <RStack>
                <ColorButton icon={PaintBucket} label={L("Remplissage", "تعبئة", "Fill")} color={lastFill} customLabel={L("Autres couleurs…", "ألوان أخرى…", "More colors…")} noneLabel={L("Aucun remplissage", "بدون تعبئة", "No fill")} onNone={() => updSel((e) => { e.fill = null; })} onApply={(c) => { setLastFill(c); updSel((e) => { e.fill = c; }); }} />
                <ColorButton icon={Square} label={L("Contour", "المخطط التفصيلي", "Outline")} color={lastLine} customLabel={L("Autres couleurs…", "ألوان أخرى…", "More colors…")} noneLabel={L("Sans contour", "بدون مخطط", "No outline")} onNone={() => updSel((e) => { e.stroke = null; })} onApply={(c) => { setLastLine(c); updSel((e) => { e.stroke = c; if (!e.strokeW) e.strokeW = 2; }); }} />
              </RStack>
            </RGroup>
          </>
        )}

        {tab === "insert" && (
          <>
            <RGroup label={L("Diapositives", "الشرائح", "Slides")}>
              <RMenu big icon={Plus} label={L("Nouvelle diapositive", "شريحة جديدة", "New slide")} width={330}>
                {(close) => <LayoutPicker onPick={(l) => { addSlide(l); close(); }} />}
              </RMenu>
            </RGroup>
            <RGroup label={L("Tableaux", "جداول", "Tables")}>
              <RMenu big icon={TableIcon} label={L("Tableau", "جدول", "Table")} width={240}>
                {(close) => <MiniGrid L={L} onPick={(r, c) => { addTable(r, c); close(); }} />}
              </RMenu>
            </RGroup>
            <RGroup label={L("Images", "صور", "Images")}>
              <BigBtn icon={ImageIcon} label={L("Images", "صور", "Pictures")} onClick={() => void addImages()} />
              <BigBtn icon={LinkIcon} label={L("Image en ligne", "صورة عبر الإنترنت", "Online picture")} onClick={() => { const u = window.prompt("https://…"); if (u) addEl({ kind: "image", src: u, w: 400, h: 300, x: deck.w / 2 - 200, y: deck.h / 2 - 150 }); }} />
            </RGroup>
            <RGroup label={L("Illustrations", "رسوم توضيحية", "Illustrations")}>
              <RMenu big icon={Shapes} label={L("Formes", "أشكال", "Shapes")} width={260}>
                {(close) => <ShapeGrid onPick={(k) => { addShape(k); close(); }} />}
              </RMenu>
              <RMenu big icon={Smile} label={L("Icônes", "أيقونات", "Icons")} width={300}>
                {(close) => (
                  <div className="grid grid-cols-10 gap-0.5">
                    {EMOJIS.map((s) => <button key={s} type="button" className="h-7 rounded text-[17px] hover:bg-muted" onClick={() => { addEl({ kind: "text", html: s, size: 72, w: 130, h: 120, align: "center", valign: "middle" }); close(); }}>{s}</button>)}
                  </div>
                )}
              </RMenu>
              <BigBtn icon={BarChart3} label={L("Graphique", "مبيان", "Chart")} onClick={() => setChartOpen(true)} />
            </RGroup>
            <RGroup label={L("Texte", "نص", "Text")}>
              <BigBtn icon={Type} label={L("Zone de texte", "مربع نص", "Text box")} onClick={addText} />
              <RMenu big icon={Wand2} label="WordArt" width={260}>
                {(close) => (
                  <div className="grid grid-cols-3 gap-1.5">
                    {[["#C43E1C", "Impact", false], ["#2B579A", "Georgia", true], ["#217346", "Arial Black", false], ["#7030A0", "Comic Sans MS", true], ["#FFC000", "Trebuchet MS", true], ["#1F1F1F", "Times New Roman", false]].map(([c, f, sh]) => (
                      <button key={`${c}${f}`} type="button" className="h-12 rounded border text-xl font-bold hover:bg-muted" style={{ color: c as string, fontFamily: f as string, textShadow: sh ? "2px 2px 0 rgba(0,0,0,.25)" : undefined }} onClick={() => { addEl({ kind: "text", html: "WordArt", font: f as string, color: c as string, size: 60, bold: true, shadow: !!sh, w: 520, h: 110, align: "center", valign: "middle", x: deck.w / 2 - 260, y: deck.h / 2 - 55 }); close(); }}>Aa</button>
                    ))}
                  </div>
                )}
              </RMenu>
              <RStack>
                <SmallBtn icon={Hash} label={L("Numéro de diapositive", "رقم الشريحة", "Slide number")} withLabel active={!!deck.footer?.number} onClick={() => commit((d) => { d.footer = { text: d.footer?.text || "", date: !!d.footer?.date, number: !d.footer?.number }; })} />
                <SmallBtn icon={Calendar} label={L("Date", "التاريخ", "Date")} withLabel active={!!deck.footer?.date} onClick={() => commit((d) => { d.footer = { text: d.footer?.text || "", number: !!d.footer?.number, date: !d.footer?.date }; })} />
                <SmallBtn icon={ArrowDownToLine} label={L("Pied de page", "تذييل", "Footer")} withLabel onClick={() => { const v = window.prompt(L("Texte du pied de page", "نص التذييل", "Footer text"), deck.footer?.text || ""); if (v !== null) commit((d) => { d.footer = { number: !!d.footer?.number, date: !!d.footer?.date, text: v }; }); }} />
              </RStack>
            </RGroup>
            <RGroup label={L("Symboles", "رموز", "Symbols")}>
              <RMenu big icon={Sigma} label={L("Symbole", "رمز", "Symbol")} width={300}>
                {(close) => (
                  <div className="grid grid-cols-10 gap-0.5">
                    {"± × ÷ ≤ ≥ ≠ ≈ ∞ √ ∑ ∫ ∂ ∆ π α β γ θ λ μ σ φ ω Ω ℝ ℕ ∈ ∉ ⊂ ∪ ∩ ∅ ∀ ∃ → ⇒ ⇔ ° ² ³ ½ ¼ ¾ € © ® ™ ✓ ✗ ★ ♥ •".split(" ").map((s) => (
                      <button key={s} type="button" className="h-7 rounded text-[15px] hover:bg-muted" onClick={() => { if (!exec("insertText", s)) addEl({ kind: "text", html: s, size: 40, w: 100, h: 70, align: "center" }); close(); }}>{s}</button>
                    ))}
                  </div>
                )}
              </RMenu>
            </RGroup>
            <RGroup label={L("Média", "وسائط", "Media")}>
              <BigBtn icon={FileVideo} label={L("Vidéo YouTube", "فيديو يوتيوب", "YouTube video")} onClick={() => { const u = window.prompt(L("Lien de la vidéo YouTube", "رابط فيديو يوتيوب", "YouTube video link")); if (u) addEl({ kind: "video", url: u, w: 560, h: 315, x: deck.w / 2 - 280, y: deck.h / 2 - 157 }); }} />
            </RGroup>
          </>
        )}

        {tab === "design" && (
          <>
            <RGroup label={L("Thèmes", "سمات", "Themes")}>
              <div className="flex max-w-[60vw] gap-1.5 overflow-x-auto pb-0.5">
                {THEMES.map((t) => (
                  <button key={t.id} type="button" title={L(...t.name)} onClick={() => commit((d) => { d.theme = t.id; })} className={cn("relative h-[62px] w-[100px] shrink-0 overflow-hidden rounded border text-start", deck.theme === t.id && "ring-2 ring-[color:var(--office-accent)]")} style={{ background: t.bg }}>
                    <span className="absolute start-2 top-1.5 text-[15px] font-semibold" style={{ color: t.title, fontFamily: t.headFont }}>Aa</span>
                    <span className="absolute bottom-1.5 start-2 flex gap-0.5">{t.accents.slice(0, 4).map((c) => <span key={c} className="h-2 w-3" style={{ background: c }} />)}</span>
                    <span className="absolute bottom-1 end-1.5 max-w-[56px] truncate text-[9px]" style={{ color: t.text }}>{L(...t.name)}</span>
                  </button>
                ))}
              </div>
            </RGroup>
            <RGroup label={L("Personnaliser", "تخصيص", "Customize")}>
              <RMenu big icon={Ratio} label={L("Taille des diapositives", "حجم الشريحة", "Slide size")} width={220}>
                {(close) => (
                  <>
                    <MenuItem label={L("Standard (4:3)", "قياسي (4:3)", "Standard (4:3)")} active={deck.h === 720} onClick={() => { commit((d) => { const f = 720 / d.h; d.h = 720; d.slides.forEach((s) => s.els.forEach((e) => { e.y *= f; e.h *= e.kind === "image" ? 1 : f; })); }); close(); }} />
                    <MenuItem label={L("Grand écran (16:9)", "شاشة عريضة (16:9)", "Widescreen (16:9)")} active={deck.h === 540} onClick={() => { commit((d) => { const f = 540 / d.h; d.h = 540; d.slides.forEach((s) => s.els.forEach((e) => { e.y *= f; e.h *= e.kind === "image" ? 1 : f; })); }); close(); }} />
                  </>
                )}
              </RMenu>
              <RMenu big icon={Palette} label={L("Arrière-plan", "الخلفية", "Background")} width={260}>
                {(close) => <BackgroundPanel L={L} slide={slide} onApply={(bg, all) => { commit((d) => { (all ? d.slides : [d.slides[cur]]).forEach((s) => { s.bg = bg; }); }); close(); }} />}
              </RMenu>
            </RGroup>
            <RGroup label={L("Idées de conception", "أفكار تصميم", "Designer")}>
              <BigBtn icon={Sparkles} label={L("Concepteur", "المصمم", "Designer")} onClick={() => {
                // Mise en forme automatique : thème suivant + transitions harmonisées
                const i = THEMES.findIndex((t) => t.id === deck.theme);
                const next = THEMES[(i + 1) % THEMES.length];
                commit((d) => { d.theme = next.id; d.slides.forEach((s, k) => { if (s.transition.type === "none") s.transition = { type: k === 0 ? "fade" : "morph", dur: 0.8 }; }); });
                toast.success(`${L("Thème appliqué", "تم تطبيق السمة", "Theme applied")} : ${L(...next.name)}`);
              }} />
            </RGroup>
          </>
        )}

        {tab === "transitions" && (
          <>
            <RGroup label={L("Aperçu", "معاينة", "Preview")}>
              <BigBtn icon={Eye} label={L("Aperçu", "معاينة", "Preview")} onClick={() => setPreviewKey((k) => k + 1)} />
            </RGroup>
            <RGroup label={L("Transition vers cette diapositive", "الانتقال إلى هذه الشريحة", "Transition to this slide")}>
              <div className="flex max-w-[56vw] gap-1 overflow-x-auto">
                {transList.map((t) => (
                  <button key={t.id} type="button" onClick={() => { updSlide((s) => { s.transition = { ...s.transition, type: t.id }; }); setPreviewKey((k) => k + 1); }} className={cn("flex h-[62px] w-[64px] shrink-0 flex-col items-center justify-center gap-1 rounded border text-[10.5px] hover:bg-muted", slide.transition.type === t.id && "border-[color:var(--office-accent)] bg-[color:var(--office-accent-soft)]")}>
                    <span className="flex h-7 w-9 items-center justify-center rounded-sm bg-gradient-to-br from-orange-300 to-rose-500 text-white"><Presentation className="h-4 w-4" /></span>
                    {t.label}
                  </button>
                ))}
              </div>
            </RGroup>
            <RGroup label={L("Minutage", "التوقيت", "Timing")}>
              <RStack>
                <label className="flex h-7 items-center gap-1.5 text-[12px]">{L("Durée", "المدة", "Duration")}
                  <input type="number" min={0.1} max={5} step={0.1} value={slide.transition.dur} onChange={(e) => updSlide((s) => { s.transition.dur = Math.max(0.1, Math.min(5, Number(e.target.value) || 0.7)); })} className="h-6 w-16 rounded border bg-background px-1" /> s
                </label>
                <SmallBtn icon={Copy} label={L("Appliquer partout", "تطبيق على الكل", "Apply to all")} withLabel onClick={() => commit((d) => { const t = d.slides[cur].transition; d.slides.forEach((s) => { s.transition = { ...t }; }); })} />
              </RStack>
            </RGroup>
          </>
        )}

        {tab === "animations" && (
          <>
            <RGroup label={L("Aperçu", "معاينة", "Preview")}>
              <BigBtn icon={Eye} label={L("Aperçu", "معاينة", "Preview")} onClick={() => { setPreviewAnim(true); setPreviewKey((k) => k + 1); setTimeout(() => setPreviewAnim(false), 2500); }} />
            </RGroup>
            <RGroup label={L("Animation de l'élément sélectionné", "حركة العنصر المحدد", "Animation of selected item")}>
              <div className="flex max-w-[56vw] gap-1 overflow-x-auto">
                {animList.map((a) => (
                  <button key={a.id} type="button" disabled={!sel.length} onClick={() => { const maxOrder = Math.max(0, ...slide.els.map((e) => e.anim?.order || 0)); updSel((e) => { e.anim = a.id === "none" ? undefined : { type: a.id, order: e.anim?.order || maxOrder + 1, dur: e.anim?.dur || 0.6 }; }); }} className={cn("flex h-[62px] w-[64px] shrink-0 flex-col items-center justify-center gap-1 rounded border text-[10.5px] hover:bg-muted disabled:opacity-40", (one?.anim?.type || "none") === a.id && sel.length > 0 && "border-[color:var(--office-accent)] bg-[color:var(--office-accent-soft)]")}>
                    <Sparkles className={cn("h-5 w-5", a.id === "none" ? "text-muted-foreground" : "text-amber-500")} />
                    {a.label}
                  </button>
                ))}
              </div>
            </RGroup>
            <RGroup label={L("Volet Animation", "جزء الحركات", "Animation pane")}>
              <div className="max-h-[66px] w-[220px] overflow-y-auto rounded border bg-background text-[11.5px]">
                {slide.els.filter((e) => e.anim).sort((a, b) => (a.anim!.order - b.anim!.order)).map((e) => (
                  <div key={e.id} className={cn("flex items-center gap-1 px-1.5 py-0.5", sel.includes(e.id) && "bg-muted")} onClick={() => setSel([e.id])}>
                    <span className="w-4 text-center font-semibold">{e.anim!.order}</span>
                    <span className="min-w-0 flex-1 truncate">{e.kind === "text" ? (e.html || "").replace(/<[^>]+>/g, " ").trim().slice(0, 24) || "Texte" : e.kind}</span>
                    <button type="button" className="rounded p-0.5 hover:bg-muted-foreground/20" onClick={(ev) => { ev.stopPropagation(); updSlide((s) => { const x = s.els.find((y) => y.id === e.id); if (x?.anim) x.anim.order = Math.max(1, x.anim.order - 1); }); }}><ChevronUp className="h-3 w-3" /></button>
                    <button type="button" className="rounded p-0.5 hover:bg-muted-foreground/20" onClick={(ev) => { ev.stopPropagation(); updSlide((s) => { const x = s.els.find((y) => y.id === e.id); if (x?.anim) x.anim.order += 1; }); }}><ChevronDown className="h-3 w-3" /></button>
                  </div>
                ))}
                {!slide.els.some((e) => e.anim) && <div className="p-2 text-muted-foreground">{L("Aucune animation", "لا توجد حركات", "No animations")}</div>}
              </div>
            </RGroup>
            <RGroup label={L("Minutage", "التوقيت", "Timing")}>
              <label className="flex h-7 items-center gap-1.5 text-[12px]">{L("Durée", "المدة", "Duration")}
                <input type="number" min={0.1} max={5} step={0.1} disabled={!one?.anim} value={one?.anim?.dur ?? 0.6} onChange={(e) => updSel((x) => { if (x.anim) x.anim.dur = Number(e.target.value) || 0.6; })} className="h-6 w-16 rounded border bg-background px-1" /> s
              </label>
            </RGroup>
          </>
        )}

        {tab === "show" && (
          <>
            <RGroup label={L("Démarrage", "بدء", "Start")}>
              <BigBtn icon={Play} label={L("À partir du début (F5)", "من البداية (F5)", "From beginning (F5)")} onClick={() => setShow({ from: 0, presenter: false })} />
              <BigBtn icon={MonitorPlay} label={L("À partir de la diapo actuelle", "من الشريحة الحالية", "From current slide")} onClick={() => setShow({ from: cur, presenter: false })} />
              <BigBtn icon={NotebookPen} label={L("Mode Présentateur", "وضع المقدم", "Presenter view")} onClick={() => setShow({ from: cur, presenter: true })} />
            </RGroup>
            <RGroup label={L("Configuration", "إعداد", "Set up")}>
              <BigBtn icon={slide.hidden ? Eye : EyeOff} label={slide.hidden ? L("Afficher la diapo", "إظهار الشريحة", "Unhide slide") : L("Masquer la diapo", "إخفاء الشريحة", "Hide slide")} active={!!slide.hidden} onClick={() => updSlide((s) => { s.hidden = !s.hidden; })} />
            </RGroup>
            <RGroup label={L("Pendant le diaporama", "أثناء العرض", "During the show")}>
              <div className="max-w-[260px] px-1 text-[11.5px] leading-snug text-muted-foreground">
                {L("Flèches / clic : avancer · P : stylo · L : pointeur laser · E : effacer · B / W : écran noir / blanc · Échap : quitter", "الأسهم / النقر: التقدم · P: قلم · L: مؤشر ليزر · E: مسح · B / W: شاشة سوداء / بيضاء · Esc: خروج", "Arrows / click: advance · P: pen · L: laser · E: erase · B / W: black / white screen · Esc: exit")}
              </div>
            </RGroup>
          </>
        )}

        {tab === "view" && (
          <>
            <RGroup label={L("Affichages des présentations", "طرق عرض العرض التقديمي", "Presentation views")}>
              <BigBtn icon={Presentation} label={L("Normal", "عادي", "Normal")} active={view === "normal"} onClick={() => setView("normal")} />
              <BigBtn icon={LayoutGrid} label={L("Trieuse de diapositives", "فارز الشرائح", "Slide sorter")} active={view === "sorter"} onClick={() => setView("sorter")} />
              <BigBtn icon={NotebookPen} label={L("Notes", "ملاحظات", "Notes")} active={showNotes} onClick={() => setShowNotes((v) => !v)} />
            </RGroup>
            <RGroup label={L("Afficher", "إظهار", "Show")}>
              <BigBtn icon={Grid3x3} label={L("Quadrillage (aimanté)", "الشبكة (مغناطيسية)", "Gridlines (snap)")} active={showGrid} onClick={() => setShowGrid((v) => !v)} />
            </RGroup>
            <RGroup label={L("Zoom", "تكبير/تصغير", "Zoom")}>
              <BigBtn icon={MoveDiagonal} label={L("Ajuster à la fenêtre", "ملاءمة للنافذة", "Fit to window")} active={zoom === null} onClick={() => setZoom(null)} />
              <RStack>
                <SmallBtn icon={ZoomIn} label={L("Zoom avant", "تكبير", "Zoom in")} withLabel onClick={() => setZoom(Math.min(3, Math.round((scale + 0.1) * 10) / 10))} />
                <SmallBtn icon={ZoomOut} label={L("Zoom arrière", "تصغير", "Zoom out")} withLabel onClick={() => setZoom(Math.max(0.2, Math.round((scale - 0.1) * 10) / 10))} />
              </RStack>
            </RGroup>
          </>
        )}

        {tab === "format" && sel.length > 0 && (
          <>
            <RGroup label={L("Insérer des formes", "إدراج أشكال", "Insert shapes")}>
              <RMenu big icon={Shapes} label={L("Modifier la forme", "تغيير الشكل", "Change shape")} width={260}>
                {(close) => <ShapeGrid onPick={(k) => { updSel((e) => { if (e.kind === "shape" || e.kind === "text") { e.kind = "shape"; e.shape = k; if (!e.fill) e.fill = "accent"; } }); close(); }} />}
              </RMenu>
            </RGroup>
            <RGroup label={L("Styles de forme", "أنماط الأشكال", "Shape styles")}>
              <div className="grid grid-cols-6 gap-1">
                {theme.accents.slice(0, 6).flatMap((c, i) => [
                  <button key={`f${i}`} type="button" className="h-6 w-8 rounded-sm" style={{ background: c }} onClick={() => updSel((e) => { e.fill = `accent${i + 1}`; e.stroke = null; e.color = "#FFFFFF"; })} />,
                ]).concat(theme.accents.slice(0, 6).map((c, i) => (
                  <button key={`o${i}`} type="button" className="h-6 w-8 rounded-sm border-2 bg-background" style={{ borderColor: c }} onClick={() => updSel((e) => { e.fill = null; e.stroke = `accent${i + 1}`; e.strokeW = 2; e.color = `accent${i + 1}`; })} />
                )))}
              </div>
              <RStack className="ms-1">
                <ColorButton icon={PaintBucket} label={L("Remplissage", "تعبئة", "Fill")} color={lastFill} customLabel={L("Autres couleurs…", "ألوان أخرى…", "More colors…")} noneLabel={L("Aucun remplissage", "بدون تعبئة", "No fill")} onNone={() => updSel((e) => { e.fill = null; })} onApply={(c) => { setLastFill(c); updSel((e) => { e.fill = c; }); }} />
                <ColorButton icon={Square} label={L("Contour", "المخطط", "Outline")} color={lastLine} customLabel={L("Autres couleurs…", "ألوان أخرى…", "More colors…")} noneLabel={L("Sans contour", "بدون", "No outline")} onNone={() => updSel((e) => { e.stroke = null; })} onApply={(c) => { setLastLine(c); updSel((e) => { e.stroke = c; if (!e.strokeW) e.strokeW = 2; }); }} />
                <RMenu label={L("Épaisseur et tirets", "السمك والتقطع", "Weight & dashes")} icon={Spline} width={170}>
                  {(close) => (
                    <>
                      {[1, 2, 3, 4.5, 6, 8].map((w) => <MenuItem key={w} label={`${w} pt`} active={one?.strokeW === w} onClick={() => { updSel((e) => { e.strokeW = w; if (!e.stroke) e.stroke = lastLine; }); close(); }} />)}
                      <div className="my-1 border-t" />
                      {(["solid", "dash", "dot"] as const).map((d) => <MenuItem key={d} label={d === "solid" ? "———" : d === "dash" ? "– – – –" : "· · · · ·"} active={(one?.dash || "solid") === d} onClick={() => { updSel((e) => { e.dash = d; }); close(); }} />)}
                    </>
                  )}
                </RMenu>
              </RStack>
            </RGroup>
            <RGroup label={L("Effets", "تأثيرات", "Effects")}>
              <RStack>
                <SmallBtn icon={Sparkles} label={L("Ombre", "ظل", "Shadow")} withLabel active={!!one?.shadow} onClick={() => updSel((e) => { e.shadow = !e.shadow; })} />
                <label className="flex h-7 items-center gap-1.5 text-[12px]">{L("Transparence", "الشفافية", "Transparency")}
                  <input type="range" min={0} max={90} value={Math.round((1 - (one?.opacity ?? 1)) * 100)} onChange={(e) => updSel((x) => { x.opacity = 1 - Number(e.target.value) / 100; })} className="w-20 accent-[#C43E1C]" />
                </label>
                {one?.kind === "image" && (
                  <RRow>
                    {(["none", "rounded", "circle"] as const).map((c) => <SmallBtn key={c} icon={c === "circle" ? Square : ImageIcon} label={c === "none" ? L("Rectangle", "مستطيل", "Rectangle") : c === "rounded" ? L("Arrondi", "مستدير", "Rounded") : L("Cercle", "دائرة", "Circle")} active={(one.crop || "none") === c} onClick={() => updSel((e) => { e.crop = c; if (c === "circle") e.h = e.w; })} />)}
                    <SmallBtn icon={ImageIcon} label={L("Changer l'image", "تغيير الصورة", "Change picture")} onClick={() => void replaceImage()} />
                  </RRow>
                )}
              </RStack>
            </RGroup>
            {one && (
              <RGroup label={L("Taille et position", "الحجم والموضع", "Size & position")}>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                  {([["x", "X"], ["y", "Y"], ["w", L("Largeur", "العرض", "Width")], ["h", L("Hauteur", "الارتفاع", "Height")]] as const).map(([k, lab]) => (
                    <label key={k} className="flex h-6 items-center gap-1 text-[11.5px]"><span className="w-12 truncate text-muted-foreground">{lab}</span>
                      <input type="number" value={Math.round(one[k])} onChange={(e) => { const v = Number(e.target.value); updSel((x) => { x[k] = v; }); }} className="h-6 w-16 rounded border bg-background px-1" />
                    </label>
                  ))}
                  <label className="flex h-6 items-center gap-1 text-[11.5px]"><RotateCw className="h-3.5 w-3.5 text-muted-foreground" />
                    <input type="number" value={one.rot || 0} onChange={(e) => { const v = Number(e.target.value); updSel((x) => { x.rot = v; }); }} className="h-6 w-14 rounded border bg-background px-1" />°
                  </label>
                  <label className="flex h-6 items-center gap-1 text-[11.5px]"><input type="checkbox" checked={!!one.locked} onChange={(e) => updSel((x) => { x.locked = e.target.checked; })} /> {L("Verrouiller", "قفل", "Lock")}</label>
                </div>
              </RGroup>
            )}
            <RGroup label={L("Organiser", "ترتيب", "Arrange")}>
              <RStack>
                <SmallBtn icon={BringToFront} label={L("Premier plan", "إلى الأمام", "Bring to front")} withLabel onClick={() => arrange("front")} />
                <SmallBtn icon={SendToBack} label={L("Arrière-plan", "إلى الخلف", "Send to back")} withLabel onClick={() => arrange("back")} />
                <SmallBtn icon={Trash2} label={L("Supprimer", "حذف", "Delete")} withLabel onClick={deleteSel} />
              </RStack>
            </RGroup>
          </>
        )}

        {tab === "table" && one?.kind === "table" && one.table && (
          <>
            <RGroup label={L("Lignes et colonnes", "صفوف وأعمدة", "Rows & Columns")}>
              <RStack>
                <SmallBtn icon={ArrowDownToLine} label={L("Ajouter une ligne", "إضافة صف", "Add row")} withLabel onClick={() => updSel((e) => { if (e.table) { e.table.rows.push(e.table.rows[0].map(() => "")); e.h += 40; } })} />
                <SmallBtn icon={ArrowUpToLine} label={L("Supprimer la ligne", "حذف صف", "Delete row")} withLabel onClick={() => updSel((e) => { if (e.table && e.table.rows.length > 1) { e.table.rows.pop(); e.h = Math.max(40, e.h - 40); } })} />
              </RStack>
              <RStack>
                <SmallBtn icon={Plus} label={L("Ajouter une colonne", "إضافة عمود", "Add column")} withLabel onClick={() => updSel((e) => { e.table?.rows.forEach((r) => r.push("")); })} />
                <SmallBtn icon={Minus} label={L("Supprimer la colonne", "حذف عمود", "Delete column")} withLabel onClick={() => updSel((e) => { if (e.table && e.table.rows[0].length > 1) e.table.rows.forEach((r) => r.pop()); })} />
              </RStack>
            </RGroup>
            <RGroup label={L("Options", "خيارات", "Options")}>
              <SmallBtn icon={TableIcon} label={L("Ligne d'en-tête", "صف العناوين", "Header row")} withLabel active={one.table.header} onClick={() => updSel((e) => { if (e.table) e.table.header = !e.table.header; })} />
            </RGroup>
            <RGroup label={L("Styles de tableau", "أنماط الجدول", "Table styles")}>
              <div className="flex gap-1">
                {["theme", "accent2", "accent3", "accent4", "#404040"].map((s) => (
                  <button key={s} type="button" onClick={() => updSel((e) => { if (e.table) e.table.style = s; })} className={cn("grid h-[52px] w-[42px] grid-rows-4 overflow-hidden rounded border", one.table?.style === s && "ring-2 ring-[color:var(--office-accent)]")}>
                    <span style={{ background: s === "theme" ? theme.accents[0] : s.startsWith("#") ? s : theme.accents[Number(s.slice(-1)) - 1] }} /><span className="bg-muted" /><span /><span className="bg-muted" />
                  </button>
                ))}
              </div>
            </RGroup>
          </>
        )}
      </RibbonBody>
    </>
  );

  // ---------- Rendu ----------
  const thumbScale = 168 / deck.w;
  const handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
  const handlePos = (hd: string, e: SlideEl) => ({
    left: hd.includes("w") ? -5 : hd.includes("e") ? e.w * scale - 5 : (e.w * scale) / 2 - 5,
    top: hd.includes("n") ? -5 : hd.includes("s") ? e.h * scale - 5 : (e.h * scale) / 2 - 5,
    cursor: `${hd}-resize`,
  });
  const [dragSlide, setDragSlide] = useState<number | null>(null);

  return (
    <OfficeShell
      app="ppt"
      L={L}
      dir={dir}
      dark={dark}
      fileName={file.fileName}
      onRename={file.rename}
      saveState={file.saveState}
      onSaveNow={() => void file.saveNow()}
      onUndo={undo}
      onRedo={redo}
      canUndo={undoRef.current.length > 0}
      canRedo={redoRef.current.length > 0}
      templates={pptTemplates(L).map((t) => { const th = themeOf(t.theme); return { ...t, thumb: <SlideThumb bg={th.bg} fg={th.title} accent={th.accents[0]} variant={t.id} /> }; })}
      onNew={onNew}
      accept=".pptx"
      onOpenFile={onOpenFile}
      onOpenRecent={onOpenRecent}
      currentId={file.fileId}
      formats={formats}
      onExport={onExport}
      onPrint={() => void printDeck()}
      backstageOpen={backstage}
      setBackstageOpen={setBackstage}
      ribbon={ribbon}
      statusBar={
        <>
          <span>{L("Diapositive", "شريحة", "Slide")} {cur + 1} {L("sur", "من", "of")} {deck.slides.length}</span>
          <span className="hidden sm:inline">{L(...theme.name)}</span>
          <div className="ms-auto flex items-center gap-1.5">
            <button type="button" title={L("Normal", "عادي", "Normal")} className={cn("rounded p-0.5 hover:bg-muted", view === "normal" && "bg-muted")} onClick={() => setView("normal")}><Presentation className="h-3.5 w-3.5" /></button>
            <button type="button" title={L("Trieuse", "فارز", "Sorter")} className={cn("rounded p-0.5 hover:bg-muted", view === "sorter" && "bg-muted")} onClick={() => setView("sorter")}><LayoutGrid className="h-3.5 w-3.5" /></button>
            <button type="button" title={L("Diaporama", "عرض", "Slide show")} className="rounded p-0.5 hover:bg-muted" onClick={() => setShow({ from: cur, presenter: false })}><Play className="h-3.5 w-3.5" /></button>
            <input type="range" min={20} max={300} value={Math.round(scale * 100)} onChange={(e) => setZoom(Number(e.target.value) / 100)} className="w-16 sm:w-24 accent-[#C43E1C]" aria-label="Zoom" />
            <button type="button" className="w-10 text-end" onClick={() => setZoom(null)}>{Math.round(scale * 100)} %</button>
          </div>
        </>
      }
    >
      {view === "sorter" ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-5">
            {deck.slides.map((s, i) => (
              <div
                key={s.id}
                draggable
                onDragStart={() => setDragSlide(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragSlide !== null) moveSlide(dragSlide, i); setDragSlide(null); }}
                onClick={() => setCur(i)}
                onDoubleClick={() => { setCur(i); setView("normal"); }}
                className={cn("cursor-pointer", s.hidden && "opacity-50")}
              >
                <div className={cn("overflow-hidden rounded-md border-2 shadow-sm", i === cur ? "border-[#C43E1C]" : "border-transparent")}>
                  <SlideView slide={s} deck={deck} scale={226 / deck.w} mode="thumb" L={L} />
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground"><span>{i + 1}</span>{s.transition.type !== "none" && <Sparkles className="h-3 w-3" />}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          {/* Miniatures */}
          <aside className="ppt-thumbs hidden w-[212px] shrink-0 overflow-y-auto border-e bg-card p-2 sm:block" tabIndex={0}>
            {deck.slides.map((s, i) => (
              <div
                key={s.id}
                draggable
                onDragStart={() => setDragSlide(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragSlide !== null) moveSlide(dragSlide, i); setDragSlide(null); }}
                onClick={() => { if (editingId) { syncEditing(); setEditingId(null); } setCur(i); setSel([]); }}
                className="group mb-2 flex cursor-pointer gap-1.5"
              >
                <div className="flex w-5 flex-col items-center pt-1 text-[11px] text-muted-foreground">
                  {i + 1}
                  {s.transition.type !== "none" && <Sparkles className="mt-1 h-3 w-3" />}
                  {s.hidden && <EyeOff className="mt-1 h-3 w-3" />}
                </div>
                <div className={cn("relative overflow-hidden rounded border-2", i === cur ? "border-[#C43E1C]" : "border-transparent hover:border-slate-300", s.hidden && "opacity-50")}>
                  <SlideView slide={s} deck={deck} scale={thumbScale} mode="thumb" L={L} />
                  <div className="absolute end-1 top-1 hidden gap-0.5 group-hover:flex">
                    <button type="button" title={L("Dupliquer", "تكرار", "Duplicate")} onClick={(e) => { e.stopPropagation(); duplicateSlide(i); }} className="rounded bg-black/55 p-0.5 text-white"><CopyPlus className="h-3 w-3" /></button>
                    <button type="button" title={L("Supprimer", "حذف", "Delete")} onClick={(e) => { e.stopPropagation(); deleteSlide(i); }} className="rounded bg-black/55 p-0.5 text-white"><Trash2 className="h-3 w-3" /></button>
                  </div>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => addSlide("titleContent", deck.slides.length)} className="ms-6 flex h-16 w-[168px] items-center justify-center rounded border-2 border-dashed text-muted-foreground hover:border-[#C43E1C] hover:text-[#C43E1C]">
              <Plus className="h-5 w-5" />
            </button>
          </aside>

          {/* Scène */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div ref={stageRef} className="relative min-h-0 flex-1 overflow-auto bg-muted/60" onPointerDown={(e) => { if (e.target === e.currentTarget) onCanvasDown(e); }}>
              <div className="flex min-h-full min-w-full items-center justify-center p-5" style={{ width: deck.w * scale + 40 > stageSize.w ? deck.w * scale + 40 : undefined }}>
                <div
                  className="ppt-canvas relative shadow-[0_2px_12px_rgba(0,0,0,.18)]"
                  style={{ width: deck.w * scale, height: deck.h * scale }}
                  onPointerDown={onCanvasDown}
                  onPointerMove={onCanvasMove}
                  onPointerUp={onCanvasUp}
                >
                  <div key={`${previewKey}-${slide.id}`} className={cn(previewKey > 0 && slide.transition.type !== "none" && !previewAnim && `ppt-trans-${slide.transition.type}`)} style={{ animationDuration: `${slide.transition.dur}s` }}>
                    <SlideView
                      slide={slide}
                      deck={deck}
                      scale={scale}
                      mode={previewAnim ? "show" : "edit"}
                      animStep={previewAnim ? 99 : undefined}
                      L={L}
                      footer
                      slideNo={cur + 1}
                      handlers={{
                        onPointerDown: onElPointerDown,
                        onDoubleClick: onElDouble,
                        editingId,
                        onEditInput: (el, html) => {
                          if (el.kind === "table") { updSlide((s) => { const e = s.els.find((x) => x.id === el.id); if (e && el.table) e.table = el.table; }, { noHistory: true }); return; }
                          updSlide((s) => { const e = s.els.find((x) => x.id === el.id); if (e) e.html = html; }, { noHistory: true });
                        },
                        onEditEnd: () => { syncEditing(); setEditingId(null); },
                      }}
                    />
                  </div>
                  {showGrid && <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(127,127,127,.25) 1px, transparent 1px), linear-gradient(90deg, rgba(127,127,127,.25) 1px, transparent 1px)", backgroundSize: `${20 * scale}px ${20 * scale}px` }} />}
                  {guides.v.map((x, i) => <div key={`v${i}`} className="pointer-events-none absolute inset-y-0 w-px bg-[#E91E63]" style={{ left: x * scale }} />)}
                  {guides.h.map((y, i) => <div key={`h${i}`} className="pointer-events-none absolute inset-x-0 h-px bg-[#E91E63]" style={{ top: y * scale }} />)}
                  {marquee && <div className="pointer-events-none absolute border border-[#C43E1C] bg-[#C43E1C]/10" style={{ left: marquee.x * scale, top: marquee.y * scale, width: marquee.w * scale, height: marquee.h * scale }} />}
                  {/* Cadres de sélection */}
                  {selected.map((e) => (
                    <div key={e.id} className="pointer-events-none absolute" style={{ left: e.x * scale, top: e.y * scale, width: e.w * scale, height: Math.max(e.h, 4) * scale, transform: e.rot ? `rotate(${e.rot}deg)` : undefined }}>
                      <div className={cn("absolute inset-0 border", editingId === e.id ? "border-dashed border-[#C43E1C]" : "border-[#C43E1C]")} />
                      {one && editingId !== e.id && !e.locked && (
                        <>
                          {handles.map((hd) => (
                            <div key={hd} className="pointer-events-auto absolute h-[10px] w-[10px] rounded-full border border-[#C43E1C] bg-white" style={handlePos(hd, e)} onPointerDown={(ev) => { ev.stopPropagation(); startDrag(ev, "resize", hd); }} />
                          ))}
                          <div className="pointer-events-auto absolute flex h-5 w-5 cursor-grab items-center justify-center rounded-full border border-[#C43E1C] bg-white" style={{ left: (e.w * scale) / 2 - 10, top: -30 }} onPointerDown={(ev) => { ev.stopPropagation(); startDrag(ev, "rotate"); }}>
                            <RotateCw className="h-3 w-3 text-[#C43E1C]" />
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {showNotes && (
              <div className="h-24 shrink-0 border-t bg-card">
                <textarea
                  value={slide.notes}
                  onFocus={snapshot}
                  onChange={(e) => { const v = e.target.value; updSlide((s) => { s.notes = v; }, { noHistory: true }); }}
                  placeholder={L("Cliquez pour ajouter des notes", "انقر لإضافة ملاحظات", "Click to add notes")}
                  className="h-full w-full resize-none bg-transparent p-3 text-sm outline-none"
                  dir="auto"
                />
              </div>
            )}
          </div>
        </div>
      )}
      <ChartDialog open={chartOpen} onClose={() => setChartOpen(false)} L={L} onInsert={(png) => addEl({ kind: "image", src: png, w: 560, h: 350, x: deck.w / 2 - 280, y: deck.h / 2 - 160 })} />
      {show && <Slideshow deck={deck} start={show.from} presenter={show.presenter} L={L} onExit={(i) => { setShow(null); setCur(i); }} />}
    </OfficeShell>
  );
}

function cloneDeck(d: Deck): Deck {
  return {
    ...d,
    footer: d.footer ? { ...d.footer } : d.footer,
    slides: d.slides.map((s) => ({
      ...s,
      bg: s.bg ? { ...s.bg, gradient: s.bg.gradient ? [...s.bg.gradient] as [string, string, number] : undefined } : s.bg,
      transition: { ...s.transition },
      els: s.els.map((e) => ({ ...e, anim: e.anim ? { ...e.anim } : undefined, table: e.table ? { ...e.table, rows: e.table.rows.map((r) => r.slice()) } : undefined })),
    })),
  };
}

function MiniGrid({ onPick, L }: { onPick: (r: number, c: number) => void; L: Tr }) {
  const [h, setH] = useState({ r: 0, c: 0 });
  return (
    <div>
      <div className="mb-1.5 text-center text-xs text-muted-foreground">{h.r ? `${h.c} × ${h.r}` : L("Insérer un tableau", "إدراج جدول", "Insert table")}</div>
      <div className="grid grid-cols-10 gap-[3px]" onMouseLeave={() => setH({ r: 0, c: 0 })}>
        {Array.from({ length: 80 }, (_, i) => {
          const r = Math.floor(i / 10) + 1, c = (i % 10) + 1;
          return <button key={i} type="button" onMouseEnter={() => setH({ r, c })} onClick={() => onPick(r, c)} className={cn("h-[18px] w-[18px] border", r <= h.r && c <= h.c ? "border-[#C43E1C] bg-[#C43E1C]/20" : "border-slate-300 bg-background")} />;
        })}
      </div>
    </div>
  );
}

function BackgroundPanel({ L, slide, onApply }: { L: Tr; slide: Slide; onApply: (bg: Slide["bg"], all: boolean) => void }) {
  const [mode, setMode] = useState<"color" | "gradient" | "image">(slide.bg?.image ? "image" : slide.bg?.gradient ? "gradient" : "color");
  const [c1, setC1] = useState(slide.bg?.gradient?.[0] || "#0B3D91");
  const [c2, setC2] = useState(slide.bg?.gradient?.[1] || "#1E88E5");
  const [angle, setAngle] = useState(slide.bg?.gradient?.[2] ?? 135);
  const [all, setAll] = useState(false);
  return (
    <div className="space-y-2 text-[12.5px]">
      <div className="flex gap-1">
        {(["color", "gradient", "image"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={cn("flex-1 rounded border px-1 py-1", mode === m && "bg-muted font-semibold")}>
            {m === "color" ? L("Couleur", "لون", "Solid") : m === "gradient" ? L("Dégradé", "تدرج", "Gradient") : L("Image", "صورة", "Picture")}
          </button>
        ))}
      </div>
      {mode === "color" && <ColorPalette customLabel={L("Autres couleurs…", "ألوان أخرى…", "More colors…")} noneLabel={L("Couleur du thème", "لون السمة", "Theme color")} onNone={() => onApply(null, all)} onPick={(c) => onApply({ color: c }, all)} />}
      {mode === "gradient" && (
        <div className="space-y-2">
          <div className="h-10 rounded border" style={{ background: `linear-gradient(${angle}deg, ${c1}, ${c2})` }} />
          <div className="flex items-center gap-2"><input type="color" value={c1} onChange={(e) => setC1(e.target.value)} /><input type="color" value={c2} onChange={(e) => setC2(e.target.value)} /><input type="range" min={0} max={360} value={angle} onChange={(e) => setAngle(Number(e.target.value))} className="flex-1" /></div>
          <button type="button" className="w-full rounded bg-[#C43E1C] py-1.5 text-white" onClick={() => onApply({ gradient: [c1, c2, angle] }, all)}>{L("Appliquer", "تطبيق", "Apply")}</button>
        </div>
      )}
      {mode === "image" && (
        <button type="button" className="w-full rounded border py-2 hover:bg-muted" onClick={async () => { const [f] = await pickFile("image/*"); if (f) onApply({ image: await readFileAsDataUrl(f) }, all); }}>
          {L("Choisir une image…", "اختيار صورة…", "Choose a picture…")}
        </button>
      )}
      <label className="flex items-center gap-1.5"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> {L("Appliquer à toutes les diapositives", "تطبيق على كل الشرائح", "Apply to all slides")}</label>
      <button type="button" className="w-full rounded border py-1 text-muted-foreground hover:bg-muted" onClick={() => onApply(null, all)}><X className="me-1 inline h-3 w-3" />{L("Rétablir l'arrière-plan", "إعادة تعيين الخلفية", "Reset background")}</button>
    </div>
  );
}

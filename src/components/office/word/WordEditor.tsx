"use client";

/**
 * Word — traitement de texte dans le navigateur (TipTap / ProseMirror).
 * Ruban Accueil, Insertion, Création, Mise en page, Références, Révision, Affichage,
 * et onglets contextuels Tableau / Image. Ouverture et enregistrement .docx,
 * export PDF (impression), HTML et texte.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TextStyle, Color, FontFamily, FontSize, BackgroundColor } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowDownToLine, ArrowUpToLine, BarChart3, Bold, BookOpen, Calendar, CaseSensitive,
  CheckSquare, ClipboardPaste, Code, Columns2, Copy, Droplet, Eraser, Eye, FileText, Footprints, Heading, Highlighter, Image as ImageIcon,
  Indent, Italic, Languages, LayoutTemplate, Link as LinkIcon, List, ListOrdered, ListTree, Maximize, MessageSquarePlus, MessageSquareX,
  Mic, MicOff, Minus, MonitorSmartphone, MoveHorizontal, Outdent, PaintBucket, Paintbrush, PanelLeft, PanelRight, Pilcrow, Plus, Quote,
  Redo2, RemoveFormatting, Replace, RotateCcw, Ruler, ScanText, Scissors, Search, Shapes, Sigma, Smile, SpellCheck, SquareSplitHorizontal,
  Strikethrough, Subscript as SubIcon, Superscript as SupIcon, Table as TableIcon, TableCellsMerge, TextCursorInput, Trash2, Type, Underline as UnderlineIcon,
  Undo2, Volume2, VolumeX, WrapText, X, ZoomIn, ZoomOut, Lock, Unlock, Stamp, Square, FileDown, ArrowLeftRight, Baseline, FilePlus, Hash, SquareDashed, Omega,
} from "lucide-react";
import { toast } from "sonner";
import { downloadBlob } from "@/lib/download";
import { cn } from "@/lib/utils";
import { OfficeShell, type ExportFormat } from "../shared/OfficeShell";
import { useOfficeEnv, type Tr } from "../shared/useOfficeEnv";
import { useOfficeFile } from "../shared/useOfficeFile";
import { pickFile, readFileAsArrayBuffer, readFileAsDataUrl, stripExt } from "../shared/officeStore";
import { BigBtn, ColorButton, MenuItem, RGroup, RMenu, RRow, RSelect, RStack, RibbonBody, RibbonTabStrip, SmallBtn, ColorPalette, type OfficeTab } from "../shared/Ribbon";
import { ChartDialog } from "../shared/ChartDialog";
import { DocThumb } from "../shared/Thumbs";
import {
  CellAttrs, Comment, Footnote, ImageAttrs, MathInline, PageBreak, ParagraphFormat, SearchHighlight, Toc, collectHeadings, searchState,
} from "./extensions";
import { DOC_THEMES, MARGIN_PRESETS, PAGE_SIZES, defaultPage, mmToPx, type PageSettings } from "./pageSettings";
import { buildWordTemplate, wordTemplates } from "./templates";
import "./word.css";

interface WordData { html: string; page: PageSettings }

const FONTS = [
  "Calibri", "Calibri Light", "Arial", "Aptos", "Times New Roman", "Cambria", "Georgia", "Garamond", "Verdana", "Tahoma", "Trebuchet MS",
  "Segoe UI", "Century Gothic", "Comic Sans MS", "Impact", "Courier New", "Consolas", "Cairo", "Tajawal", "Amiri", "Noto Naskh Arabic", "Scheherazade New",
];
const SIZES = ["8", "9", "10", "10.5", "11", "12", "14", "16", "18", "20", "22", "24", "26", "28", "36", "48", "72"];
const SYMBOLS = "± × ÷ ≤ ≥ ≠ ≈ ≡ ∞ √ ∛ ∑ ∏ ∫ ∮ ∂ ∆ ∇ π α β γ δ ε θ λ μ σ φ ω Ω ℝ ℕ ℤ ℚ ℂ ∈ ∉ ⊂ ⊃ ⊆ ∪ ∩ ∅ ∀ ∃ ¬ ∧ ∨ → ← ↔ ⇒ ⇔ ↑ ↓ ° ′ ″ ‰ % € $ £ ¥ © ® ™ § ¶ • … « » “ ” ‘ ’ – — ½ ⅓ ¼ ¾ ² ³ ¹ ✓ ✗ ★ ☆ ♥ ☐ ☑ ☎ ✉ ✈ ☀ ☁ ☂ ♪".split(" ");
const EMOJIS = "😀 😃 😄 😁 😊 😍 🤩 😎 🤔 😮 😢 😡 👍 👎 👏 🙏 💪 👌 ✌️ 🤝 ❤️ 💡 ⭐ 🔥 ✅ ❌ ⚠️ 📌 📎 📚 📖 ✏️ 📝 📐 📏 🧮 🔢 🧪 🔬 🌍 🏆 🎯 🎓 🏫 ⏰ 📅 💬 📢 🎉".split(" ");
const EQUATIONS: { label: string; latex: string }[] = [
  { label: "Fraction", latex: "\\frac{a}{b}" },
  { label: "Racine", latex: "\\sqrt{x}" },
  { label: "Puissance", latex: "x^{n}" },
  { label: "Indice", latex: "x_{i}" },
  { label: "Second degré", latex: "x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}" },
  { label: "Pythagore", latex: "a^2 + b^2 = c^2" },
  { label: "Somme", latex: "\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}" },
  { label: "Intégrale", latex: "\\int_{a}^{b} f(x)\\,dx" },
  { label: "Limite", latex: "\\lim_{x \\to +\\infty} f(x)" },
  { label: "Dérivée", latex: "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h)-f(x)}{h}" },
  { label: "Vecteur", latex: "\\overrightarrow{AB}" },
  { label: "Matrice", latex: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" },
  { label: "Système", latex: "\\begin{cases} x + y = 1 \\\\ x - y = 3 \\end{cases}" },
  { label: "Binôme", latex: "(a+b)^n = \\sum_{k=0}^{n} \\binom{n}{k} a^{k} b^{n-k}" },
  { label: "Euler", latex: "e^{i\\pi} + 1 = 0" },
  { label: "Trigonométrie", latex: "\\cos^2 x + \\sin^2 x = 1" },
];

type TabId = "home" | "insert" | "design" | "layout" | "refs" | "review" | "view" | "table" | "image";

export default function WordEditor() {
  const { L, language, dir, isRtl, dark } = useOfficeEnv();
  const [page, setPage] = useState<PageSettings>(defaultPage);
  const pageRef = useRef(page);
  pageRef.current = page;
  const [tab, setTab] = useState<TabId>("home");
  const [backstage, setBackstage] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [viewMode, setViewMode] = useState<"page" | "web" | "read">("page");
  const [showNav, setShowNav] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showMarks, setShowMarks] = useState(false);
  const [showRuler, setShowRuler] = useState(true);
  const [findOpen, setFindOpen] = useState<null | "find" | "replace">(null);
  const [chartOpen, setChartOpen] = useState(false);
  const [spell, setSpell] = useState(true);
  const [readOnly, setReadOnly] = useState(false);
  const [contentH, setContentH] = useState(0);
  const [lastColor, setLastColor] = useState("#C00000");
  const [lastHl, setLastHl] = useState("#FFFF00");
  const [lastShade, setLastShade] = useState("#DCE6F4");
  const painterRef = useRef<{ marks: { type: string; attrs: Record<string, unknown> }[]; para: Record<string, unknown> } | null>(null);
  const [painter, setPainter] = useState(false);
  const pageEl = useRef<HTMLDivElement>(null);

  const editorRef = useRef<Editor | null>(null);
  const file = useOfficeFile<WordData>("word", () => {
    const ed = editorRef.current;
    if (!ed) return null;
    const text = ed.getText().trim();
    return { data: { html: ed.getHTML(), page: pageRef.current }, preview: text.slice(0, 90) || L("Document vide", "مستند فارغ", "Empty document") };
  });
  const markDirtyRef = useRef(file.markDirty);
  markDirtyRef.current = file.markDirty;

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } } }),
      TextStyle, Color, FontFamily, FontSize, BackgroundColor,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      Subscript, Superscript,
      Image.configure({ inline: true, allowBase64: true, resize: { enabled: true, alwaysPreserveAspectRatio: true, minWidth: 30, minHeight: 30 } }),
      Table.configure({ resizable: true, allowTableNodeSelection: true }), TableRow, TableHeader, TableCell,
      TaskList, TaskItem.configure({ nested: true }),
      CharacterCount,
      Placeholder.configure({ placeholder: L("Commencez à écrire…", "ابدأ الكتابة…", "Start typing…") }),
      ParagraphFormat, ImageAttrs, CellAttrs, PageBreak, MathInline, Footnote, Toc, Comment, SearchHighlight,
    ],
    content: "",
    editorProps: {
      attributes: { spellcheck: "true" },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files || []).filter((f) => f.type.startsWith("image/"));
        if (!files.length) return false;
        event.preventDefault();
        files.forEach(async (f) => editorRef.current?.chain().focus().setImage({ src: await readFileAsDataUrl(f) }).run());
        return true;
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files || []).filter((f) => f.type.startsWith("image/"));
        if (!files.length) return false;
        files.forEach(async (f) => editorRef.current?.chain().focus().setImage({ src: await readFileAsDataUrl(f) }).run());
        return true;
      },
    },
    onUpdate: () => markDirtyRef.current(),
  });
  editorRef.current = editor;

  // État du ruban (gras actif, police courante…) recalculé à chaque transaction
  const st = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return null;
      const ts = e.getAttributes("textStyle");
      const para = e.isActive("heading") ? e.getAttributes("heading") : e.getAttributes("paragraph");
      return {
        bold: e.isActive("bold"), italic: e.isActive("italic"), underline: e.isActive("underline"), strike: e.isActive("strike"),
        sub: e.isActive("subscript"), sup: e.isActive("superscript"), code: e.isActive("code"),
        bullet: e.isActive("bulletList"), ordered: e.isActive("orderedList"), task: e.isActive("taskList"),
        left: e.isActive({ textAlign: "left" }), center: e.isActive({ textAlign: "center" }), right: e.isActive({ textAlign: "right" }), justify: e.isActive({ textAlign: "justify" }),
        h: [1, 2, 3, 4, 5, 6].find((l) => e.isActive("heading", { level: l })) || 0,
        quote: e.isActive("blockquote"), codeBlock: e.isActive("codeBlock"),
        font: (ts.fontFamily as string) || "", size: (ts.fontSize as string) || "",
        table: e.isActive("table"), image: e.isActive("image"), link: e.isActive("link"), comment: e.isActive("comment"),
        lineHeight: (para?.lineHeight as string) || "", dir: (para?.dir as string) || "", dropCap: !!para?.dropCap,
        canUndo: e.can().undo(), canRedo: e.can().redo(),
        words: e.storage.characterCount?.words?.() ?? 0, chars: e.storage.characterCount?.characters?.() ?? 0,
        imageAttrs: e.isActive("image") ? e.getAttributes("image") : null,
        tableStyle: e.isActive("table") ? (e.getAttributes("table").tableStyle as string) : "",
      };
    },
  });

  // Onglet contextuel : Tableau / Image
  useEffect(() => {
    if (!st) return;
    if (tab === "table" && !st.table) setTab("home");
    if (tab === "image" && !st.image) setTab("home");
  }, [st, tab]);

  // Hauteur du contenu → nombre de pages et repères de saut de page
  useEffect(() => {
    const el = pageEl.current?.querySelector(".ProseMirror") as HTMLElement | null;
    if (!el) return;
    const ro = new ResizeObserver(() => setContentH(el.scrollHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [editor]);

  useEffect(() => {
    editor?.setOptions({ editorProps: { ...editor.options.editorProps, attributes: { spellcheck: spell ? "true" : "false", lang: language === "ar" ? "ar" : language === "en" ? "en" : "fr" } } });
  }, [editor, spell, language]);
  useEffect(() => { editor?.setEditable(!readOnly); }, [editor, readOnly]);

  // Reproduire la mise en forme : appliquée à la prochaine sélection
  useEffect(() => {
    const el = pageEl.current;
    if (!el || !editor) return;
    const onUp = () => {
      const p = painterRef.current;
      if (!p) return;
      setTimeout(() => {
        const ch = editor.chain().focus().unsetAllMarks();
        p.marks.forEach((m) => ch.setMark(m.type, m.attrs));
        ch.setParagraphAttr(p.para).run();
        painterRef.current = null;
        setPainter(false);
      }, 0);
    };
    el.addEventListener("mouseup", onUp);
    return () => el.removeEventListener("mouseup", onUp);
  }, [editor]);

  // ---------- Fichier ----------
  const loadData = useCallback((data: WordData) => {
    setPage({ ...defaultPage(), ...data.page });
    editorRef.current?.commands.setContent(data.html || "<p></p>", { emitUpdate: false });
  }, []);

  const booted = useRef(false);
  useEffect(() => {
    if (!editor || booted.current) return;
    booted.current = true;
    (async () => {
      const rec = await file.loadLast();
      if (rec?.data) loadData(rec.data);
      else {
        file.startFile(L("Document1", "مستند1", "Document1"));
        loadData({ html: `<p${isRtl ? ' dir="rtl"' : ""}></p>`, page: defaultPage() });
      }
      editor.commands.focus("start");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const onNew = async (tid: string) => {
    await file.saveNow();
    const t = wordTemplates(L).find((x) => x.id === tid);
    file.startFile(tid === "blank" ? L("Document", "مستند", "Document") + (Math.floor(Math.random() * 90) + 10) : t?.label || "Document");
    loadData(buildWordTemplate(tid, L, isRtl));
    void file.saveNow();
  };

  const onOpenFile = async (f: File) => {
    const tId = toast.loading(L("Ouverture…", "جارٍ الفتح…", "Opening…"));
    try {
      await file.saveNow();
      let data: WordData;
      if (/\.docx$/i.test(f.name)) {
        const { importDocx } = await import("./docxImport");
        data = await importDocx(await readFileAsArrayBuffer(f));
      } else if (/\.html?$/i.test(f.name)) {
        data = { html: await f.text(), page: defaultPage() };
      } else if (/\.(txt|md|csv)$/i.test(f.name)) {
        const text = await f.text();
        data = { html: text.split(/\r?\n/).map((l) => `<p>${l.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string))}</p>`).join(""), page: defaultPage() };
      } else if (/\.doc$/i.test(f.name)) {
        throw new Error("doc");
      } else throw new Error("format");
      file.startFile(stripExt(f.name));
      loadData(data);
      void file.saveNow();
      toast.success(L("Document ouvert", "تم فتح المستند", "Document opened"), { id: tId });
    } catch (e) {
      console.error(e);
      toast.error((e as Error).message === "doc"
        ? L("L'ancien format .doc n'est pas pris en charge : enregistrez-le en .docx.", "الصيغة القديمة ‎.doc غير مدعومة: احفظه بصيغة ‎.docx.", "Legacy .doc is not supported: save it as .docx.")
        : L("Ce fichier n'a pas pu être ouvert.", "تعذر فتح هذا الملف.", "This file could not be opened."), { id: tId });
    }
  };

  const onOpenRecent = async (id: string) => {
    await file.saveNow();
    const rec = await file.openRecord(id);
    if (rec?.data) loadData(rec.data);
  };

  const formats: ExportFormat[] = [
    { id: "docx", ext: "docx", label: L("Document Word", "مستند Word", "Word document"), desc: L("S'ouvre dans Word, LibreOffice, Google Docs", "يفتح في Word وLibreOffice وGoogle Docs", "Opens in Word, LibreOffice, Google Docs") },
    { id: "pdf", ext: "pdf", label: L("PDF", "PDF", "PDF"), desc: L("Via la fenêtre d'impression : choisissez « Enregistrer au format PDF »", "عبر نافذة الطباعة: اختر «حفظ بصيغة PDF»", "Through the print dialog: choose “Save as PDF”") },
    { id: "html", ext: "html", label: L("Page web", "صفحة ويب", "Web page"), desc: L("Fichier HTML autonome", "ملف HTML مستقل", "Standalone HTML file") },
    { id: "txt", ext: "txt", label: L("Texte brut", "نص عادي", "Plain text"), desc: L("Sans mise en forme", "بدون تنسيق", "No formatting") },
  ];

  const onExport = async (fid: string) => {
    const ed = editorRef.current;
    if (!ed) return;
    const name = file.fileName || "Document";
    if (fid === "docx") {
      const { exportDocx } = await import("./docxExport");
      await downloadBlob(await exportDocx(ed.getJSON(), pageRef.current, name), `${name}.docx`);
    } else if (fid === "pdf") {
      printDoc();
    } else if (fid === "html") {
      await downloadBlob(new Blob([buildPrintHtml(ed.getHTML(), pageRef.current, name, dir, false)], { type: "text/html" }), `${name}.html`);
    } else {
      await downloadBlob(new Blob([ed.getText({ blockSeparator: "\n" })], { type: "text/plain;charset=utf-8" }), `${name}.txt`);
    }
  };

  const printDoc = () => {
    const ed = editorRef.current;
    if (!ed) return;
    const w = window.open("", "_blank");
    if (!w) { toast.error(L("Autorisez les fenêtres pop-up pour imprimer.", "اسمح بالنوافذ المنبثقة للطباعة.", "Allow pop-ups to print.")); return; }
    w.document.write(buildPrintHtml(ed.getHTML(), pageRef.current, file.fileName, dir, true));
    w.document.close();
  };

  const updatePage = (patch: Partial<PageSettings>) => {
    setPage((p) => ({ ...p, ...patch }));
    markDirtyRef.current();
  };

  // ---------- Commandes ----------
  const ed = editor;
  const run = (fn: (c: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => { if (ed) fn(ed.chain().focus()).run(); };

  const insertImageFromFile = async () => {
    const files = await pickFile("image/*", true);
    for (const f of files) ed?.chain().focus().setImage({ src: await readFileAsDataUrl(f) }).run();
  };
  const insertImageFromUrl = () => {
    const u = window.prompt(L("Adresse de l'image (https://…)", "رابط الصورة (https://…)", "Image URL (https://…)"));
    if (u) run((c) => c.setImage({ src: u }));
  };
  const setLink = () => {
    const prev = ed?.getAttributes("link").href || "";
    const u = window.prompt(L("Adresse du lien", "عنوان الرابط", "Link address"), prev || "https://");
    if (u === null) return;
    if (!u) run((c) => c.extendMarkRange("link").unsetLink());
    else if (ed?.state.selection.empty && !ed.isActive("link")) run((c) => c.insertContent({ type: "text", text: u, marks: [{ type: "link", attrs: { href: u } }] }));
    else run((c) => c.extendMarkRange("link").setLink({ href: u }));
  };
  const addComment = () => {
    if (!ed || ed.state.selection.empty) { toast.info(L("Sélectionnez d'abord le texte à commenter.", "حدد أولا النص المراد التعليق عليه.", "Select the text to comment first.")); return; }
    const t = window.prompt(L("Commentaire", "تعليق", "Comment"));
    if (t) { run((c) => c.setComment(t)); setShowComments(true); }
  };
  const addFootnote = () => {
    const t = window.prompt(L("Texte de la note de bas de page", "نص الحاشية", "Footnote text"));
    if (t) run((c) => c.insertFootnote(t));
  };
  const changeCase = (mode: "upper" | "lower" | "title" | "sentence" | "toggle") => {
    if (!ed) return;
    const { from, to } = ed.state.selection;
    if (from === to) return;
    const tr = ed.state.tr;
    const pieces: { from: number; to: number; text: string; marks: readonly import("@tiptap/pm/model").Mark[] }[] = [];
    ed.state.doc.nodesBetween(from, to, (node, pos) => {
      if (!node.isText) return;
      const s = Math.max(from, pos), e = Math.min(to, pos + node.nodeSize);
      pieces.push({ from: s, to: e, text: node.text!.slice(s - pos, e - pos), marks: node.marks });
    });
    let first = true;
    for (const p of pieces.reverse()) {
      let t = p.text;
      if (mode === "upper") t = t.toLocaleUpperCase();
      else if (mode === "lower") t = t.toLocaleLowerCase();
      else if (mode === "title") t = t.toLocaleLowerCase().replace(/(^|\s|[-'’])(\p{L})/gu, (_m, a, b) => a + b.toLocaleUpperCase());
      else if (mode === "toggle") t = [...t].map((ch) => (ch === ch.toLocaleUpperCase() ? ch.toLocaleLowerCase() : ch.toLocaleUpperCase())).join("");
      else t = t.toLocaleLowerCase();
      tr.replaceWith(p.from, p.to, ed.schema.text(t, p.marks));
      first = false;
    }
    if (mode === "sentence" && pieces.length) {
      const startPos = from;
      const ch = tr.doc.textBetween(startPos, startPos + 1);
      if (ch) tr.replaceWith(startPos, startPos + 1, ed.schema.text(ch.toLocaleUpperCase(), tr.doc.resolve(startPos + 1).marks()));
    }
    if (!first) ed.view.dispatch(tr);
  };
  const sortParagraphs = (desc = false) => {
    if (!ed) return;
    const { from, to } = ed.state.selection;
    const items: { pos: number; node: import("@tiptap/pm/model").Node }[] = [];
    ed.state.doc.nodesBetween(from, to, (node, pos, parent) => {
      if (node.type.name === "paragraph" && parent === ed.state.doc) items.push({ pos, node });
      return node.type.name !== "paragraph";
    });
    if (items.length < 2) return;
    const sorted = [...items].sort((a, b) => a.node.textContent.localeCompare(b.node.textContent, undefined, { numeric: true }) * (desc ? -1 : 1));
    const start = items[0].pos, end = items[items.length - 1].pos + items[items.length - 1].node.nodeSize;
    ed.view.dispatch(ed.state.tr.replaceWith(start, end, sorted.map((s) => s.node)));
  };
  const startPainter = () => {
    if (!ed) return;
    if (painter) { painterRef.current = null; setPainter(false); return; }
    const marks = ed.state.selection.$from.marks().map((m) => ({ type: m.type.name, attrs: m.attrs as Record<string, unknown> }));
    const parent = ed.state.selection.$from.parent;
    const { lineHeight, spaceBefore, spaceAfter, textAlign, shading } = parent.attrs as Record<string, unknown>;
    painterRef.current = { marks, para: { lineHeight, spaceBefore, spaceAfter, textAlign, shading } };
    setPainter(true);
    toast.info(L("Sélectionnez le texte auquel appliquer la mise en forme.", "حدد النص الذي ستطبق عليه التنسيق.", "Select the text to apply the formatting to."));
  };
  const pasteText = async () => {
    try {
      const t = await navigator.clipboard.readText();
      run((c) => c.insertContent(t));
    } catch {
      toast.info(L("Utilisez Ctrl+V pour coller.", "استعمل Ctrl+V للصق.", "Use Ctrl+V to paste."));
    }
  };
  const copyCut = (cut: boolean) => {
    ed?.commands.focus();
    try { document.execCommand(cut ? "cut" : "copy"); } catch { toast.info(cut ? "Ctrl+X" : "Ctrl+C"); }
  };
  const insertCover = () => {
    run((c) => c.insertContentAt(0, `<p style="margin-top:160px;text-align:center"><span style="font-size:32pt;color:#2B579A">${L("Titre du document", "عنوان المستند", "Document title")}</span></p><p style="text-align:center"><span style="font-size:16pt;color:#595959">${L("Sous-titre", "العنوان الفرعي", "Subtitle")}</span></p><p style="margin-top:240px;text-align:center">${L("Auteur", "المؤلف", "Author")} · ${new Date().toLocaleDateString()}</p><div data-page-break="1"></div>`));
  };
  const insertShape = (kind: string, color: string) => {
    const shapes: Record<string, string> = {
      rect: `<rect x="4" y="4" width="192" height="112" rx="2" fill="${color}"/>`,
      round: `<rect x="4" y="4" width="192" height="112" rx="22" fill="${color}"/>`,
      circle: `<ellipse cx="100" cy="60" rx="96" ry="56" fill="${color}"/>`,
      triangle: `<polygon points="100,4 196,116 4,116" fill="${color}"/>`,
      arrow: `<polygon points="4,40 130,40 130,8 196,60 130,112 130,80 4,80" fill="${color}"/>`,
      star: `<polygon points="100,4 124,44 172,48 136,78 148,116 100,96 52,116 64,78 28,48 76,44" fill="${color}"/>`,
      diamond: `<polygon points="100,4 196,60 100,116 4,60" fill="${color}"/>`,
      callout: `<path d="M8 8h184v80H80l-30 26 6-26H8z" fill="${color}"/>`,
      heart: `<path d="M100 112 C20 60 10 20 50 10 C75 4 95 20 100 34 C105 20 125 4 150 10 C190 20 180 60 100 112z" fill="${color}"/>`,
    };
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120" viewBox="0 0 200 120">${shapes[kind]}</svg>`;
    run((c) => c.setImage({ src: `data:image/svg+xml;base64,${btoa(svg)}` }));
  };

  // Lecture à voix haute et dictée
  const [speaking, setSpeaking] = useState(false);
  const speak = () => {
    if (!ed || typeof window === "undefined" || !window.speechSynthesis) return;
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const { from, to } = ed.state.selection;
    const text = from !== to ? ed.state.doc.textBetween(from, to, "\n") : ed.getText();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = /[؀-ۿ]/.test(text.slice(0, 200)) ? "ar-SA" : language === "en" ? "en-US" : "fr-FR";
    u.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  };
  const recRef = useRef<{ stop: () => void } | null>(null);
  const [dictating, setDictating] = useState(false);
  const dictate = () => {
    if (dictating) { recRef.current?.stop(); setDictating(false); return; }
    const W = window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any };
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SR) { toast.error(L("La dictée n'est pas disponible dans ce navigateur (utilisez Chrome ou Edge).", "الإملاء الصوتي غير متاح في هذا المتصفح (استعمل Chrome أو Edge).", "Dictation is not available in this browser (use Chrome or Edge).")); return; }
    const rec = new SR();
    rec.lang = language === "ar" ? "ar-MA" : language === "en" ? "en-US" : "fr-FR";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) editorRef.current?.chain().focus().insertContent(e.results[i][0].transcript + " ").run();
    };
    rec.onend = () => setDictating(false);
    rec.start();
    recRef.current = rec;
    setDictating(true);
  };

  // ---------- Ruban ----------
  const tabs: OfficeTab[] = [
    { id: "home", label: L("Accueil", "الرئيسية", "Home") },
    { id: "insert", label: L("Insertion", "إدراج", "Insert") },
    { id: "design", label: L("Création", "تصميم", "Design") },
    { id: "layout", label: L("Mise en page", "تخطيط الصفحة", "Layout") },
    { id: "refs", label: L("Références", "مراجع", "References") },
    { id: "review", label: L("Révision", "مراجعة", "Review") },
    { id: "view", label: L("Affichage", "عرض", "View") },
    ...(st?.table ? [{ id: "table", label: L("Tableau", "جدول", "Table"), contextual: true }] : []),
    ...(st?.image ? [{ id: "image", label: L("Image", "صورة", "Picture"), contextual: true }] : []),
  ];

  const sizeNum = st?.size ? String(Math.round(parseFloat(st.size) * (/px$/.test(st.size) ? 0.75 : 1) * 10) / 10) : String(page.defaultSize);
  const setSize = (v: string) => { const n = parseFloat(v); if (!isNaN(n) && n > 0 && n < 400) run((c) => c.setFontSize(`${n}pt`)); };
  const growShrink = (d: 1 | -1) => {
    const cur = parseFloat(sizeNum) || 11;
    const idx = SIZES.findIndex((s) => parseFloat(s) >= cur);
    const next = d > 0 ? SIZES[Math.min(SIZES.length - 1, (SIZES[idx] && parseFloat(SIZES[idx]) === cur ? idx : idx - 1) + 1)] : SIZES[Math.max(0, idx - 1)];
    setSize(next || String(cur + d));
  };
  const styleValue = st?.h ? `h${st.h}` : st?.quote ? "quote" : st?.codeBlock ? "code" : "p";
  const applyStyle = (v: string) => {
    if (v === "p") run((c) => c.setParagraph().unsetFontSize().unsetColor());
    else if (v === "title") run((c) => c.setHeading({ level: 1 }).setFontSize("26pt"));
    else if (v === "subtitle") run((c) => c.setParagraph().setFontSize("15pt").setColor("#595959"));
    else if (v === "quote") run((c) => c.setParagraph().toggleBlockquote());
    else if (v === "code") run((c) => c.toggleCodeBlock());
    else if (v === "nospace") run((c) => c.setParagraph().setParagraphAttr({ spaceAfter: 0, lineHeight: "1" }));
    else if (v.startsWith("h")) run((c) => c.setHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6 }));
  };
  const STYLES = [
    { v: "p", label: L("Normal", "عادي", "Normal"), css: {} },
    { v: "nospace", label: L("Sans interligne", "بدون تباعد", "No spacing"), css: {} },
    { v: "h1", label: L("Titre 1", "عنوان 1", "Heading 1"), css: { color: "var(--w-h-color,#2F5496)", fontSize: 16 } },
    { v: "h2", label: L("Titre 2", "عنوان 2", "Heading 2"), css: { color: "var(--w-h-color,#2F5496)", fontSize: 14 } },
    { v: "h3", label: L("Titre 3", "عنوان 3", "Heading 3"), css: { color: "#1F3763", fontSize: 13 } },
    { v: "title", label: L("Titre", "العنوان", "Title"), css: { fontSize: 20 } },
    { v: "subtitle", label: L("Sous-titre", "عنوان فرعي", "Subtitle"), css: { color: "#595959" } },
    { v: "quote", label: L("Citation", "اقتباس", "Quote"), css: { fontStyle: "italic", color: "#595959" } },
    { v: "code", label: L("Code", "شيفرة", "Code"), css: { fontFamily: "Consolas, monospace" } },
    { v: "h4", label: L("Titre 4", "عنوان 4", "Heading 4"), css: { fontStyle: "italic" } },
  ];

  const ribbon = !ed || !st ? <div className="h-[132px] border-b bg-card" /> : (
    <>
      <RibbonTabStrip
        tabs={tabs}
        value={tab}
        onChange={(v) => setTab(v as TabId)}
        onFile={() => setBackstage(true)}
        fileLabel={L("Fichier", "ملف", "File")}
        accent="#2B579A"
        end={
          <>
            <SmallBtn icon={Search} label={L("Rechercher (Ctrl+F)", "بحث (Ctrl+F)", "Find (Ctrl+F)")} onClick={() => setFindOpen("find")} />
            <SmallBtn icon={MessageSquarePlus} label={L("Commentaires", "التعليقات", "Comments")} active={showComments} onClick={() => setShowComments((v) => !v)} />
          </>
        }
      />
      {viewMode !== "read" && (
        <RibbonBody>
          {tab === "home" && (
            <>
              <RGroup label={L("Presse-papiers", "الحافظة", "Clipboard")}>
                <BigBtn icon={ClipboardPaste} label={L("Coller", "لصق", "Paste")} onClick={pasteText} />
                <RStack>
                  <SmallBtn icon={Scissors} label={L("Couper", "قص", "Cut")} withLabel onClick={() => copyCut(true)} />
                  <SmallBtn icon={Copy} label={L("Copier", "نسخ", "Copy")} withLabel onClick={() => copyCut(false)} />
                  <SmallBtn icon={Paintbrush} label={L("Reproduire", "نسخ التنسيق", "Format Painter")} withLabel active={painter} onClick={startPainter} />
                </RStack>
              </RGroup>
              <RGroup label={L("Police", "الخط", "Font")}>
                <RStack>
                  <RRow>
                    <RSelect title={L("Police", "الخط", "Font")} width={150} value={(st.font || page.defaultFont).split(",")[0].replace(/["']/g, "")} onChange={(v) => run((c) => c.setFontFamily(v))} options={FONTS.map((f) => ({ value: f, label: f, style: { fontFamily: f } }))} />
                    <RSelect editable title={L("Taille", "الحجم", "Size")} width={56} value={sizeNum} onChange={setSize} options={SIZES.map((s) => ({ value: s, label: s }))} />
                    <SmallBtn icon={Plus} label={L("Augmenter la taille", "تكبير الخط", "Grow font")} onClick={() => growShrink(1)} />
                    <SmallBtn icon={Minus} label={L("Réduire la taille", "تصغير الخط", "Shrink font")} onClick={() => growShrink(-1)} />
                    <RMenu label={L("Modifier la casse", "تغيير حالة الأحرف", "Change case")} icon={CaseSensitive} width={220}>
                      {(close) => (
                        <>
                          <MenuItem label={L("Majuscule en début de phrase.", "أول حرف كبير.", "Sentence case.")} onClick={() => { changeCase("sentence"); close(); }} />
                          <MenuItem label={L("minuscules", "أحرف صغيرة", "lowercase")} onClick={() => { changeCase("lower"); close(); }} />
                          <MenuItem label={L("MAJUSCULES", "أحرف كبيرة", "UPPERCASE")} onClick={() => { changeCase("upper"); close(); }} />
                          <MenuItem label={L("1re Lettre Des Mots En Majuscule", "حرف كبير لكل كلمة", "Capitalize Each Word")} onClick={() => { changeCase("title"); close(); }} />
                          <MenuItem label={L("iNVERSER lA cASSE", "عكس الحالة", "tOGGLE cASE")} onClick={() => { changeCase("toggle"); close(); }} />
                        </>
                      )}
                    </RMenu>
                    <SmallBtn icon={RemoveFormatting} label={L("Effacer la mise en forme", "مسح التنسيق", "Clear formatting")} onClick={() => run((c) => c.unsetAllMarks().clearNodes().setParagraphAttr({ lineHeight: null, spaceBefore: null, spaceAfter: null, indent: 0, firstLine: null, shading: null, border: null, dropCap: false }))} />
                  </RRow>
                  <RRow>
                    <SmallBtn icon={Bold} label={L("Gras (Ctrl+B)", "عريض (Ctrl+B)", "Bold (Ctrl+B)")} active={st.bold} onClick={() => run((c) => c.toggleBold())} />
                    <SmallBtn icon={Italic} label={L("Italique (Ctrl+I)", "مائل (Ctrl+I)", "Italic (Ctrl+I)")} active={st.italic} onClick={() => run((c) => c.toggleItalic())} />
                    <SmallBtn icon={UnderlineIcon} label={L("Souligné (Ctrl+U)", "تسطير (Ctrl+U)", "Underline (Ctrl+U)")} active={st.underline} onClick={() => run((c) => c.toggleUnderline())} />
                    <SmallBtn icon={Strikethrough} label={L("Barré", "يتوسطه خط", "Strikethrough")} active={st.strike} onClick={() => run((c) => c.toggleStrike())} />
                    <SmallBtn icon={SubIcon} label={L("Indice", "منخفض", "Subscript")} active={st.sub} onClick={() => run((c) => c.toggleSubscript())} />
                    <SmallBtn icon={SupIcon} label={L("Exposant", "مرتفع", "Superscript")} active={st.sup} onClick={() => run((c) => c.toggleSuperscript())} />
                    <SmallBtn icon={Code} label={L("Code", "شيفرة", "Code")} active={st.code} onClick={() => run((c) => c.toggleCode())} />
                    <ColorButton icon={Highlighter} label={L("Surlignage", "لون التمييز", "Highlight")} color={lastHl} customLabel={L("Autres couleurs…", "ألوان أخرى…", "More colors…")} noneLabel={L("Aucune couleur", "بدون لون", "No color")} onNone={() => run((c) => c.unsetHighlight())} onApply={(col) => { setLastHl(col); run((c) => c.setHighlight({ color: col })); }} />
                    <ColorButton icon={Baseline} label={L("Couleur de police", "لون الخط", "Font color")} color={lastColor} customLabel={L("Autres couleurs…", "ألوان أخرى…", "More colors…")} noneLabel={L("Automatique", "تلقائي", "Automatic")} onNone={() => run((c) => c.unsetColor())} onApply={(col) => { setLastColor(col); run((c) => c.setColor(col)); }} />
                  </RRow>
                </RStack>
              </RGroup>
              <RGroup label={L("Paragraphe", "فقرة", "Paragraph")}>
                <RStack>
                  <RRow>
                    <SmallBtn icon={List} label={L("Puces", "تعداد نقطي", "Bullets")} active={st.bullet} onClick={() => run((c) => c.toggleBulletList())} />
                    <RMenu label={L("Bibliothèque de puces", "مكتبة التعداد", "Bullet library")} width={200}>
                      {(close) => (
                        <div className="grid grid-cols-4 gap-1">
                          {[["", "●"], ["circle", "○"], ["square", "■"], ["check", "✓"], ["arrow", "➤"], ["dash", "–"]].map(([k, sym]) => (
                            <button key={k} type="button" className="h-10 rounded border text-lg hover:bg-muted" onClick={() => { if (!ed.isActive("bulletList")) ed.chain().focus().toggleBulletList().run(); ed.chain().focus().updateAttributes("bulletList", {}).run(); setBulletStyle(ed, k); close(); }}>{sym}</button>
                          ))}
                        </div>
                      )}
                    </RMenu>
                    <SmallBtn icon={ListOrdered} label={L("Numérotation", "ترقيم", "Numbering")} active={st.ordered} onClick={() => run((c) => c.toggleOrderedList())} />
                    <RMenu label={L("Format de numérotation", "صيغة الترقيم", "Numbering format")} width={210}>
                      {(close) => (
                        <div className="grid grid-cols-3 gap-1">
                          {[["1", "1. 2. 3."], ["a", "a. b. c."], ["A", "A. B. C."], ["i", "i. ii. iii."], ["I", "I. II. III."]].map(([k, lab]) => (
                            <button key={k} type="button" className="h-12 rounded border text-[11px] hover:bg-muted" onClick={() => { if (!ed.isActive("orderedList")) ed.chain().focus().toggleOrderedList().run(); ed.chain().focus().updateAttributes("orderedList", { type: k === "1" ? null : k }).run(); close(); }}>{lab}</button>
                          ))}
                        </div>
                      )}
                    </RMenu>
                    <SmallBtn icon={CheckSquare} label={L("Liste de tâches", "قائمة مهام", "Checklist")} active={st.task} onClick={() => run((c) => c.toggleTaskList())} />
                    <SmallBtn icon={Outdent} iconClassName="rtl:-scale-x-100" label={L("Diminuer le retrait", "إنقاص المسافة البادئة", "Decrease indent")} onClick={() => run((c) => c.outdent())} />
                    <SmallBtn icon={Indent} iconClassName="rtl:-scale-x-100" label={L("Augmenter le retrait", "زيادة المسافة البادئة", "Increase indent")} onClick={() => run((c) => c.indent())} />
                    <RMenu label={L("Trier", "فرز", "Sort")} icon={ArrowDownToLine} width={180}>
                      {(close) => (
                        <>
                          <MenuItem label={L("Trier de A à Z", "فرز تصاعدي", "Sort A to Z")} onClick={() => { sortParagraphs(false); close(); }} />
                          <MenuItem label={L("Trier de Z à A", "فرز تنازلي", "Sort Z to A")} onClick={() => { sortParagraphs(true); close(); }} />
                        </>
                      )}
                    </RMenu>
                    <SmallBtn icon={Pilcrow} label={L("Afficher tout (¶)", "إظهار الكل (¶)", "Show/Hide ¶")} active={showMarks} onClick={() => setShowMarks((v) => !v)} />
                  </RRow>
                  <RRow>
                    <SmallBtn icon={AlignLeft} label={L("Aligner à gauche (Ctrl+L)", "محاذاة لليسار", "Align left")} active={st.left} onClick={() => run((c) => c.setTextAlign("left"))} />
                    <SmallBtn icon={AlignCenter} label={L("Centrer (Ctrl+E)", "توسيط", "Center")} active={st.center} onClick={() => run((c) => c.setTextAlign("center"))} />
                    <SmallBtn icon={AlignRight} label={L("Aligner à droite (Ctrl+R)", "محاذاة لليمين", "Align right")} active={st.right} onClick={() => run((c) => c.setTextAlign("right"))} />
                    <SmallBtn icon={AlignJustify} label={L("Justifier (Ctrl+J)", "ضبط", "Justify")} active={st.justify} onClick={() => run((c) => c.setTextAlign("justify"))} />
                    <SmallBtn icon={ArrowLeftRight} label={st.dir === "rtl" ? L("De gauche à droite", "من اليسار إلى اليمين", "Left-to-right") : L("De droite à gauche", "من اليمين إلى اليسار", "Right-to-left")} active={st.dir === "rtl"} onClick={() => run((c) => c.setParagraphAttr({ dir: st.dir === "rtl" ? "ltr" : "rtl" }))} />
                    <RMenu label={L("Interligne et espacement", "تباعد الأسطر", "Line spacing")} icon={WrapText} width={200}>
                      {(close) => (
                        <>
                          {["1", "1.15", "1.5", "2", "2.5", "3"].map((v) => (
                            <MenuItem key={v} label={v.replace(".", ",")} active={st.lineHeight === v} onClick={() => { run((c) => c.setParagraphAttr({ lineHeight: v })); close(); }} />
                          ))}
                          <div className="my-1 border-t" />
                          <MenuItem label={L("Ajouter un espace avant", "إضافة مسافة قبل", "Add space before")} onClick={() => { run((c) => c.setParagraphAttr({ spaceBefore: 16 })); close(); }} />
                          <MenuItem label={L("Supprimer l'espace après", "إزالة المسافة بعد", "Remove space after")} onClick={() => { run((c) => c.setParagraphAttr({ spaceAfter: 0 })); close(); }} />
                        </>
                      )}
                    </RMenu>
                    <ColorButton icon={PaintBucket} label={L("Trame de fond", "تظليل", "Shading")} color={lastShade} customLabel={L("Autres couleurs…", "ألوان أخرى…", "More colors…")} noneLabel={L("Aucune", "بدون", "None")} onNone={() => run((c) => c.setParagraphAttr({ shading: null }))} onApply={(col) => { setLastShade(col); run((c) => c.setParagraphAttr({ shading: col })); }} />
                    <RMenu label={L("Bordures", "حدود", "Borders")} icon={Square} width={190}>
                      {(close) => (
                        <>
                          <MenuItem label={L("Bordure inférieure", "حد سفلي", "Bottom border")} onClick={() => { run((c) => c.setParagraphAttr({ border: "bottom" })); close(); }} />
                          <MenuItem label={L("Bordure supérieure", "حد علوي", "Top border")} onClick={() => { run((c) => c.setParagraphAttr({ border: "top" })); close(); }} />
                          <MenuItem label={L("Encadré", "إطار", "Box")} onClick={() => { run((c) => c.setParagraphAttr({ border: "box" })); close(); }} />
                          <MenuItem label={L("Aucune bordure", "بدون حدود", "No border")} onClick={() => { run((c) => c.setParagraphAttr({ border: null })); close(); }} />
                          <MenuItem label={L("Ligne horizontale", "خط أفقي", "Horizontal line")} onClick={() => { run((c) => c.setHorizontalRule()); close(); }} />
                        </>
                      )}
                    </RMenu>
                  </RRow>
                </RStack>
              </RGroup>
              <RGroup label={L("Styles", "أنماط", "Styles")}>
                <div className="grid max-w-[372px] grid-cols-5 gap-1">
                  {STYLES.map((s) => (
                    <button
                      key={s.v}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyStyle(s.v)}
                      className={cn("h-[30px] w-[70px] truncate rounded border px-1 text-start text-[11px] hover:border-[color:var(--office-accent)]", styleValue === s.v ? "border-[color:var(--office-accent)] bg-[color:var(--office-accent-soft)]" : "bg-background")}
                      style={s.css as CSSProperties}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </RGroup>
              <RGroup label={L("Modification", "تحرير", "Editing")}>
                <RStack>
                  <SmallBtn icon={Search} label={L("Rechercher", "بحث", "Find")} withLabel onClick={() => setFindOpen("find")} />
                  <SmallBtn icon={Replace} label={L("Remplacer", "استبدال", "Replace")} withLabel onClick={() => setFindOpen("replace")} />
                  <SmallBtn icon={TextCursorInput} label={L("Sélectionner tout", "تحديد الكل", "Select all")} withLabel onClick={() => run((c) => c.selectAll())} />
                </RStack>
              </RGroup>
              <RGroup label={L("Voix", "الصوت", "Voice")}>
                <BigBtn icon={dictating ? MicOff : Mic} label={L("Dicter", "إملاء", "Dictate")} active={dictating} onClick={dictate} />
              </RGroup>
            </>
          )}

          {tab === "insert" && (
            <>
              <RGroup label={L("Pages", "صفحات", "Pages")}>
                <BigBtn icon={LayoutTemplate} label={L("Page de garde", "صفحة الغلاف", "Cover page")} onClick={insertCover} />
                <RStack>
                  <SmallBtn icon={FilePlus} label={L("Page vierge", "صفحة فارغة", "Blank page")} withLabel onClick={() => run((c) => c.insertPageBreak().insertPageBreak())} />
                  <SmallBtn icon={SquareSplitHorizontal} label={L("Saut de page", "فاصل صفحة", "Page break")} withLabel onClick={() => run((c) => c.insertPageBreak())} />
                </RStack>
              </RGroup>
              <RGroup label={L("Tableaux", "جداول", "Tables")}>
                <RMenu big icon={TableIcon} label={L("Tableau", "جدول", "Table")} width={248}>
                  {(close) => <TableGrid L={L} onPick={(r, c) => { ed.chain().focus().insertTable({ rows: r, cols: c, withHeaderRow: true }).run(); close(); }} />}
                </RMenu>
              </RGroup>
              <RGroup label={L("Illustrations", "رسوم توضيحية", "Illustrations")}>
                <RMenu big icon={ImageIcon} label={L("Images", "صور", "Pictures")} width={220}>
                  {(close) => (
                    <>
                      <MenuItem icon={MonitorSmartphone} label={L("Cet appareil…", "هذا الجهاز…", "This device…")} onClick={() => { close(); void insertImageFromFile(); }} />
                      <MenuItem icon={LinkIcon} label={L("Depuis une adresse web…", "من رابط ويب…", "From a web address…")} onClick={() => { close(); insertImageFromUrl(); }} />
                    </>
                  )}
                </RMenu>
                <RMenu big icon={Shapes} label={L("Formes", "أشكال", "Shapes")} width={240}>
                  {(close) => <ShapePicker L={L} onPick={(k, col) => { insertShape(k, col); close(); }} />}
                </RMenu>
                <BigBtn icon={BarChart3} label={L("Graphique", "مبيان", "Chart")} onClick={() => setChartOpen(true)} />
              </RGroup>
              <RGroup label={L("Liens", "روابط", "Links")}>
                <BigBtn icon={LinkIcon} label={L("Lien", "رابط", "Link")} active={st.link} onClick={setLink} />
              </RGroup>
              <RGroup label={L("Commentaires", "تعليقات", "Comments")}>
                <BigBtn icon={MessageSquarePlus} label={L("Commentaire", "تعليق", "Comment")} onClick={addComment} />
              </RGroup>
              <RGroup label={L("En-tête et pied de page", "الرأس والتذييل", "Header & Footer")}>
                <RStack>
                  <SmallBtn icon={ArrowUpToLine} label={L("En-tête", "الرأس", "Header")} withLabel onClick={() => { const v = window.prompt(L("Texte de l'en-tête", "نص الرأس", "Header text"), page.header); if (v !== null) updatePage({ header: v }); }} />
                  <SmallBtn icon={ArrowDownToLine} label={L("Pied de page", "التذييل", "Footer")} withLabel onClick={() => { const v = window.prompt(L("Texte du pied de page", "نص التذييل", "Footer text"), page.footer); if (v !== null) updatePage({ footer: v }); }} />
                  <RMenu label={L("Numéro de page", "رقم الصفحة", "Page number")} trigger={<SmallBtn icon={Hash} label={L("Numéro de page", "رقم الصفحة", "Page number")} withLabel />} width={200}>
                    {(close) => (
                      <>
                        <MenuItem label={L("Haut de page", "أعلى الصفحة", "Top of page")} active={page.pageNumbers === "header"} onClick={() => { updatePage({ pageNumbers: "header" }); close(); }} />
                        <MenuItem label={L("Bas de page", "أسفل الصفحة", "Bottom of page")} active={page.pageNumbers === "footer"} onClick={() => { updatePage({ pageNumbers: "footer" }); close(); }} />
                        <MenuItem label={L("Supprimer les numéros", "حذف الترقيم", "Remove page numbers")} onClick={() => { updatePage({ pageNumbers: "none" }); close(); }} />
                      </>
                    )}
                  </RMenu>
                </RStack>
              </RGroup>
              <RGroup label={L("Texte", "نص", "Text")}>
                <BigBtn icon={SquareDashed} label={L("Zone de texte", "مربع نص", "Text box")} onClick={() => run((c) => c.insertContent({ type: "paragraph", attrs: { border: "box" }, content: [{ type: "text", text: L("Texte encadré", "نص داخل إطار", "Boxed text") }] }))} />
                <RStack>
                  <SmallBtn icon={Type} label={L("Lettrine", "حرف استهلالي", "Drop cap")} withLabel active={st.dropCap} onClick={() => run((c) => c.setParagraphAttr({ dropCap: !st.dropCap }))} />
                  <SmallBtn icon={Calendar} label={L("Date et heure", "التاريخ والوقت", "Date & time")} withLabel onClick={() => run((c) => c.insertContent(new Date().toLocaleString(language === "ar" ? "ar-MA" : language === "en" ? "en-GB" : "fr-FR", { dateStyle: "full", timeStyle: "short" })))} />
                  <RMenu label="WordArt" trigger={<SmallBtn icon={Stamp} label="WordArt" withLabel />} width={250}>
                    {(close) => (
                      <div className="grid grid-cols-2 gap-1.5">
                        {[["#2B579A", "Impact"], ["#C00000", "Georgia"], ["#217346", "Arial Black"], ["#7030A0", "Comic Sans MS"], ["#ED7D31", "Trebuchet MS"], ["#000000", "Times New Roman"]].map(([col, font]) => (
                          <button key={col + font} type="button" className="h-12 rounded border text-lg font-bold hover:bg-muted" style={{ color: col, fontFamily: font }} onClick={() => { run((c) => c.insertContent({ type: "text", text: "WordArt", marks: [{ type: "textStyle", attrs: { color: col, fontFamily: font, fontSize: "36pt" } }, { type: "bold" }] })); close(); }}>Aa</button>
                        ))}
                      </div>
                    )}
                  </RMenu>
                </RStack>
              </RGroup>
              <RGroup label={L("Symboles", "رموز", "Symbols")}>
                <RMenu big icon={Sigma} label={L("Équation", "معادلة", "Equation")} width={320}>
                  {(close) => (
                    <div className="space-y-1">
                      {EQUATIONS.map((q) => (
                        <MenuItem key={q.label} label={<span className="font-mono text-[11px]">{q.latex}</span>} hint={q.label} onClick={() => { run((c) => c.insertMath(q.latex)); close(); }} />
                      ))}
                      <div className="border-t pt-1">
                        <MenuItem icon={Plus} label={L("Nouvelle équation (LaTeX)…", "معادلة جديدة (LaTeX)…", "New equation (LaTeX)…")} onClick={() => { close(); const v = window.prompt("LaTeX", "\\frac{a}{b}"); if (v) run((c) => c.insertMath(v)); }} />
                      </div>
                    </div>
                  )}
                </RMenu>
                <RMenu big icon={Omega} label={L("Symbole", "رمز", "Symbol")} width={300}>
                  {(close) => (
                    <div className="grid grid-cols-10 gap-0.5">
                      {SYMBOLS.map((s) => <button key={s} type="button" className="h-7 rounded text-[15px] hover:bg-muted" onClick={() => { run((c) => c.insertContent(s)); close(); }}>{s}</button>)}
                    </div>
                  )}
                </RMenu>
                <RMenu big icon={Smile} label={L("Emoji", "رموز تعبيرية", "Emoji")} width={300}>
                  {(close) => (
                    <div className="grid grid-cols-10 gap-0.5">
                      {EMOJIS.map((s) => <button key={s} type="button" className="h-7 rounded text-[17px] hover:bg-muted" onClick={() => { run((c) => c.insertContent(s)); close(); }}>{s}</button>)}
                    </div>
                  )}
                </RMenu>
              </RGroup>
            </>
          )}

          {tab === "design" && (
            <>
              <RGroup label={L("Thèmes du document", "سمات المستند", "Document themes")}>
                <div className="flex gap-1.5">
                  {Object.entries(DOC_THEMES).map(([k, th]) => (
                    <button key={k} type="button" onClick={() => updatePage({ theme: k, defaultFont: th.body.split(",")[0] })} className={cn("flex h-[66px] w-[74px] flex-col items-start justify-between rounded border p-1.5 text-start hover:border-[color:var(--office-accent)]", page.theme === k && "border-[color:var(--office-accent)] bg-[color:var(--office-accent-soft)]")}>
                      <span className="text-[15px] font-semibold" style={{ fontFamily: th.heading, color: th.h1 }}>Aa</span>
                      <span className="flex gap-0.5">{[th.h1, th.h2, "#A5A5A5", "#FFC000"].map((c) => <span key={c} className="h-2 w-3" style={{ background: c }} />)}</span>
                      <span className="w-full truncate text-[10px]">{L(...th.label)}</span>
                    </button>
                  ))}
                </div>
              </RGroup>
              <RGroup label={L("Arrière-plan de la page", "خلفية الصفحة", "Page background")}>
                <RMenu big icon={Stamp} label={L("Filigrane", "علامة مائية", "Watermark")} width={220}>
                  {(close) => (
                    <>
                      {[L("CONFIDENTIEL", "سري", "CONFIDENTIAL"), L("BROUILLON", "مسودة", "DRAFT"), L("URGENT", "عاجل", "URGENT"), L("EXEMPLE", "نموذج", "SAMPLE"), L("CORRIGÉ", "التصحيح", "ANSWER KEY")].map((w) => (
                        <MenuItem key={w} label={w} active={page.watermark === w} onClick={() => { updatePage({ watermark: w }); close(); }} />
                      ))}
                      <MenuItem label={L("Filigrane personnalisé…", "علامة مائية مخصصة…", "Custom watermark…")} onClick={() => { close(); const v = window.prompt(L("Texte du filigrane", "نص العلامة المائية", "Watermark text"), page.watermark); if (v !== null) updatePage({ watermark: v }); }} />
                      <MenuItem icon={X} label={L("Supprimer le filigrane", "حذف العلامة المائية", "Remove watermark")} onClick={() => { updatePage({ watermark: "" }); close(); }} />
                    </>
                  )}
                </RMenu>
                <RMenu big icon={Droplet} label={L("Couleur de page", "لون الصفحة", "Page color")} width={236}>
                  {(close) => <ColorPalette customLabel={L("Autres couleurs…", "ألوان أخرى…", "More colors…")} noneLabel={L("Aucune couleur", "بدون لون", "No color")} onNone={() => { updatePage({ pageColor: null }); close(); }} onPick={(c) => { updatePage({ pageColor: c }); close(); }} />}
                </RMenu>
                <RMenu big icon={Square} label={L("Bordures de page", "حدود الصفحة", "Page borders")} width={200}>
                  {(close) => (
                    <>
                      {([["none", L("Aucune", "بدون", "None")], ["simple", L("Simple", "بسيطة", "Single")], ["double", L("Double", "مزدوجة", "Double")], ["art", L("Épaisse colorée", "سميكة ملونة", "Thick color")]] as const).map(([k, lab]) => (
                        <MenuItem key={k} label={lab} active={(page.pageBorder || "none") === k} onClick={() => { updatePage({ pageBorder: k }); close(); }} />
                      ))}
                    </>
                  )}
                </RMenu>
              </RGroup>
              <RGroup label={L("Police par défaut", "الخط الافتراضي", "Default font")}>
                <RStack>
                  <RSelect title={L("Police du document", "خط المستند", "Document font")} width={150} value={page.defaultFont} onChange={(v) => updatePage({ defaultFont: v })} options={FONTS.map((f) => ({ value: f, label: f }))} />
                  <RSelect title={L("Taille par défaut", "الحجم الافتراضي", "Default size")} width={70} value={String(page.defaultSize)} onChange={(v) => updatePage({ defaultSize: Number(v) })} options={SIZES.map((s) => ({ value: s, label: s }))} />
                </RStack>
              </RGroup>
            </>
          )}

          {tab === "layout" && (
            <>
              <RGroup label={L("Mise en page", "إعداد الصفحة", "Page setup")}>
                <RMenu big icon={Maximize} label={L("Marges", "الهوامش", "Margins")} width={230}>
                  {(close) => (
                    <>
                      {([["normal", L("Normales (2,5 cm)", "عادية (2,5 سم)", "Normal (2.5 cm)")], ["narrow", L("Étroites (1,27 cm)", "ضيقة (1,27 سم)", "Narrow (1.27 cm)")], ["moderate", L("Modérées", "متوسطة", "Moderate")], ["wide", L("Larges", "عريضة", "Wide")]] as const).map(([k, lab]) => (
                        <MenuItem key={k} label={lab} onClick={() => { updatePage({ margins: { ...MARGIN_PRESETS[k] } }); close(); }} />
                      ))}
                      <MenuItem label={L("Marges personnalisées…", "هوامش مخصصة…", "Custom margins…")} onClick={() => {
                        close();
                        const v = window.prompt(L("Marges en mm : haut, droite, bas, gauche", "الهوامش بالملم: أعلى، يمين، أسفل، يسار", "Margins in mm: top, right, bottom, left"), `${page.margins.top}, ${page.margins.right}, ${page.margins.bottom}, ${page.margins.left}`);
                        const n = v?.split(/[,;\s]+/).map(Number).filter((x) => !isNaN(x));
                        if (n && n.length === 4) updatePage({ margins: { top: n[0], right: n[1], bottom: n[2], left: n[3] } });
                      }} />
                    </>
                  )}
                </RMenu>
                <RMenu big icon={RotateCcw} label={L("Orientation", "الاتجاه", "Orientation")} width={170}>
                  {(close) => (
                    <>
                      <MenuItem label={L("Portrait", "عمودي", "Portrait")} active={page.orientation === "portrait"} onClick={() => { updatePage({ orientation: "portrait" }); close(); }} />
                      <MenuItem label={L("Paysage", "أفقي", "Landscape")} active={page.orientation === "landscape"} onClick={() => { updatePage({ orientation: "landscape" }); close(); }} />
                    </>
                  )}
                </RMenu>
                <RMenu big icon={FileText} label={L("Taille", "الحجم", "Size")} width={230}>
                  {(close) => (
                    <>
                      {(Object.keys(PAGE_SIZES) as PageSettings["size"][]).map((k) => (
                        <MenuItem key={k} label={PAGE_SIZES[k].label} active={page.size === k} onClick={() => { updatePage({ size: k }); close(); }} />
                      ))}
                    </>
                  )}
                </RMenu>
                <RMenu big icon={Columns2} label={L("Colonnes", "أعمدة", "Columns")} width={160}>
                  {(close) => (
                    <>
                      {([1, 2, 3] as const).map((n) => <MenuItem key={n} label={`${n}`} active={page.columns === n} onClick={() => { updatePage({ columns: n }); close(); }} />)}
                    </>
                  )}
                </RMenu>
                <BigBtn icon={SquareSplitHorizontal} label={L("Saut de page", "فاصل صفحة", "Break")} onClick={() => run((c) => c.insertPageBreak())} />
              </RGroup>
              <RGroup label={L("Retrait", "المسافة البادئة", "Indent")}>
                <RStack>
                  <NumField label={L("Gauche / début", "البداية", "Start")} unit="cm" value={pxToCm(Number((ed.getAttributes("paragraph").indent as number) || 0))} onChange={(v) => run((c) => c.setParagraphAttr({ indent: cmToPx(v) }))} />
                  <NumField label={L("1re ligne", "السطر الأول", "First line")} unit="cm" value={pxToCm(Number((ed.getAttributes("paragraph").firstLine as number) || 0))} onChange={(v) => run((c) => c.setParagraphAttr({ firstLine: cmToPx(v) }))} />
                </RStack>
              </RGroup>
              <RGroup label={L("Espacement", "التباعد", "Spacing")}>
                <RStack>
                  <NumField label={L("Avant", "قبل", "Before")} unit="pt" value={Math.round(Number(ed.getAttributes("paragraph").spaceBefore ?? 0) * 0.75)} onChange={(v) => run((c) => c.setParagraphAttr({ spaceBefore: Math.round(v / 0.75) }))} />
                  <NumField label={L("Après", "بعد", "After")} unit="pt" value={Math.round(Number(ed.getAttributes("paragraph").spaceAfter ?? 6) * 0.75)} onChange={(v) => run((c) => c.setParagraphAttr({ spaceAfter: Math.round(v / 0.75) }))} />
                </RStack>
              </RGroup>
              <RGroup label={L("Organiser", "ترتيب", "Arrange")}>
                <RStack>
                  <SmallBtn icon={AlignLeft} label={L("Image à gauche", "صورة يسارا", "Picture left")} withLabel disabled={!st.image} onClick={() => run((c) => c.updateAttributes("image", { align: "left" }))} />
                  <SmallBtn icon={AlignCenter} label={L("Image centrée", "صورة في الوسط", "Picture center")} withLabel disabled={!st.image} onClick={() => run((c) => c.updateAttributes("image", { align: "center" }))} />
                  <SmallBtn icon={AlignRight} label={L("Image à droite", "صورة يمينا", "Picture right")} withLabel disabled={!st.image} onClick={() => run((c) => c.updateAttributes("image", { align: "right" }))} />
                </RStack>
              </RGroup>
            </>
          )}

          {tab === "refs" && (
            <>
              <RGroup label={L("Table des matières", "الفهرس", "Table of contents")}>
                <BigBtn icon={ListTree} label={L("Table des matières", "فهرس", "Table of contents")} onClick={() => run((c) => c.insertToc())} />
              </RGroup>
              <RGroup label={L("Notes de bas de page", "الحواشي", "Footnotes")}>
                <BigBtn icon={Footprints} label={L("Insérer une note", "إدراج حاشية", "Insert footnote")} onClick={addFootnote} />
              </RGroup>
              <RGroup label={L("Légendes", "التسميات التوضيحية", "Captions")}>
                <BigBtn icon={ScanText} label={L("Insérer une légende", "إدراج تسمية", "Insert caption")} onClick={() => {
                  const kind = st.table ? L("Tableau", "جدول", "Table") : L("Figure", "شكل", "Figure");
                  const n = (ed.getHTML().match(new RegExp(`${kind} \\d+`, "g")) || []).length + 1;
                  run((c) => c.insertContent({ type: "paragraph", attrs: { textAlign: "center" }, content: [{ type: "text", text: `${kind} ${n} : `, marks: [{ type: "italic" }, { type: "textStyle", attrs: { color: "#44546A", fontSize: "9pt" } }] }] }));
                }} />
              </RGroup>
              <RGroup label={L("Navigation", "التنقل", "Navigation")}>
                <BigBtn icon={PanelLeft} label={L("Volet de navigation", "جزء التنقل", "Navigation pane")} active={showNav} onClick={() => setShowNav((v) => !v)} />
              </RGroup>
            </>
          )}

          {tab === "review" && (
            <>
              <RGroup label={L("Vérification", "تدقيق", "Proofing")}>
                <BigBtn icon={SpellCheck} label={L("Orthographe", "التدقيق الإملائي", "Spelling")} active={spell} onClick={() => setSpell((v) => !v)} />
                <BigBtn icon={Hash} label={L("Statistiques", "إحصائيات", "Word count")} onClick={() => {
                  const paras = (ed.getJSON().content || []).filter((n) => n.type === "paragraph" || n.type === "heading").length;
                  toast(`${L("Mots", "كلمات", "Words")} : ${st.words} · ${L("Caractères", "أحرف", "Characters")} : ${st.chars} · ${L("Paragraphes", "فقرات", "Paragraphs")} : ${paras} · ${L("Pages", "صفحات", "Pages")} : ${pageCount}`, { duration: 7000 });
                }} />
              </RGroup>
              <RGroup label={L("Voix", "الصوت", "Speech")}>
                <BigBtn icon={speaking ? VolumeX : Volume2} label={L("Lecture à voix haute", "القراءة بصوت عال", "Read aloud")} active={speaking} onClick={speak} />
                <BigBtn icon={dictating ? MicOff : Mic} label={L("Dicter", "إملاء", "Dictate")} active={dictating} onClick={dictate} />
              </RGroup>
              <RGroup label={L("Commentaires", "تعليقات", "Comments")}>
                <BigBtn icon={MessageSquarePlus} label={L("Nouveau commentaire", "تعليق جديد", "New comment")} onClick={addComment} />
                <BigBtn icon={MessageSquareX} label={L("Supprimer", "حذف", "Delete")} disabled={!st.comment} onClick={() => run((c) => c.unsetComment())} />
                <BigBtn icon={PanelRight} label={L("Afficher les commentaires", "إظهار التعليقات", "Show comments")} active={showComments} onClick={() => setShowComments((v) => !v)} />
              </RGroup>
              <RGroup label={L("Langue", "اللغة", "Language")}>
                <BigBtn icon={Languages} label={L("Sens du texte", "اتجاه النص", "Text direction")} onClick={() => run((c) => c.setParagraphAttr({ dir: st.dir === "rtl" ? "ltr" : "rtl" }))} />
              </RGroup>
              <RGroup label={L("Protéger", "حماية", "Protect")}>
                <BigBtn icon={readOnly ? Unlock : Lock} label={readOnly ? L("Autoriser la modification", "السماح بالتعديل", "Allow editing") : L("Lecture seule", "للقراءة فقط", "Read-only")} active={readOnly} onClick={() => setReadOnly((v) => !v)} />
              </RGroup>
            </>
          )}

          {tab === "view" && (
            <>
              <RGroup label={L("Affichages", "طرق العرض", "Views")}>
                <BigBtn icon={BookOpen} label={L("Mode Lecture", "وضع القراءة", "Read mode")} onClick={() => setViewMode("read")} />
                <BigBtn icon={FileText} label={L("Page", "تخطيط الطباعة", "Print layout")} active={viewMode === "page"} onClick={() => setViewMode("page")} />
                <BigBtn icon={MonitorSmartphone} label={L("Web", "تخطيط ويب", "Web layout")} active={viewMode === "web"} onClick={() => setViewMode("web")} />
              </RGroup>
              <RGroup label={L("Afficher", "إظهار", "Show")}>
                <RStack>
                  <SmallBtn icon={Ruler} label={L("Règle", "المسطرة", "Ruler")} withLabel active={showRuler} onClick={() => setShowRuler((v) => !v)} />
                  <SmallBtn icon={PanelLeft} label={L("Volet de navigation", "جزء التنقل", "Navigation pane")} withLabel active={showNav} onClick={() => setShowNav((v) => !v)} />
                  <SmallBtn icon={Pilcrow} label={L("Marques de mise en forme", "علامات التنسيق", "Formatting marks")} withLabel active={showMarks} onClick={() => setShowMarks((v) => !v)} />
                </RStack>
              </RGroup>
              <RGroup label={L("Zoom", "تكبير/تصغير", "Zoom")}>
                <BigBtn icon={ZoomIn} label="100 %" onClick={() => setZoom(1)} />
                <RStack>
                  <SmallBtn icon={MoveHorizontal} label={L("Largeur de page", "عرض الصفحة", "Page width")} withLabel onClick={() => fitWidth()} />
                  <SmallBtn icon={ZoomIn} label={L("Zoom avant", "تكبير", "Zoom in")} withLabel onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.1) * 10) / 10))} />
                  <SmallBtn icon={ZoomOut} label={L("Zoom arrière", "تصغير", "Zoom out")} withLabel onClick={() => setZoom((z) => Math.max(0.3, Math.round((z - 0.1) * 10) / 10))} />
                </RStack>
              </RGroup>
              <RGroup label={L("Page sombre", "صفحة داكنة", "Dark page")}>
                <BigBtn icon={Eye} label={L("Mode sombre de la page", "الوضع الداكن للصفحة", "Dark page mode")} active={!!page.pageDark} onClick={() => setPage((p) => ({ ...p, pageDark: !p.pageDark }))} />
              </RGroup>
            </>
          )}

          {tab === "table" && st.table && (
            <>
              <RGroup label={L("Lignes et colonnes", "صفوف وأعمدة", "Rows & Columns")}>
                <RStack>
                  <SmallBtn icon={ArrowUpToLine} label={L("Insérer au-dessus", "إدراج أعلاه", "Insert above")} withLabel onClick={() => run((c) => c.addRowBefore())} />
                  <SmallBtn icon={ArrowDownToLine} label={L("Insérer en dessous", "إدراج أسفله", "Insert below")} withLabel onClick={() => run((c) => c.addRowAfter())} />
                </RStack>
                <RStack>
                  <SmallBtn icon={Plus} label={L("Colonne avant", "عمود قبل", "Column before")} withLabel onClick={() => run((c) => c.addColumnBefore())} />
                  <SmallBtn icon={Plus} label={L("Colonne après", "عمود بعد", "Column after")} withLabel onClick={() => run((c) => c.addColumnAfter())} />
                </RStack>
                <RMenu big icon={Trash2} label={L("Supprimer", "حذف", "Delete")} width={190}>
                  {(close) => (
                    <>
                      <MenuItem label={L("Supprimer la ligne", "حذف الصف", "Delete row")} onClick={() => { run((c) => c.deleteRow()); close(); }} />
                      <MenuItem label={L("Supprimer la colonne", "حذف العمود", "Delete column")} onClick={() => { run((c) => c.deleteColumn()); close(); }} />
                      <MenuItem label={L("Supprimer le tableau", "حذف الجدول", "Delete table")} onClick={() => { run((c) => c.deleteTable()); close(); }} />
                    </>
                  )}
                </RMenu>
              </RGroup>
              <RGroup label={L("Fusionner", "دمج", "Merge")}>
                <BigBtn icon={TableCellsMerge} label={L("Fusionner les cellules", "دمج الخلايا", "Merge cells")} onClick={() => run((c) => c.mergeCells())} />
                <BigBtn icon={SquareSplitHorizontal} label={L("Fractionner", "تقسيم", "Split")} onClick={() => run((c) => c.splitCell())} />
              </RGroup>
              <RGroup label={L("Styles de tableau", "أنماط الجدول", "Table styles")}>
                <div className="flex gap-1">
                  {[["grid", "#A6A6A6", "#fff"], ["plain", "#fff", "#fff"], ["blue", "#2B579A", "#DCE6F4"], ["green", "#217346", "#E2EFDA"], ["gray", "#404040", "#F2F2F2"], ["orange", "#C43E1C", "#FBE5D6"]].map(([k, h, b]) => (
                    <button key={k} type="button" title={k} onClick={() => run((c) => c.updateAttributes("table", { tableStyle: k }))} className={cn("grid h-[58px] w-[46px] grid-rows-4 overflow-hidden rounded border", st.tableStyle === k && "ring-2 ring-[color:var(--office-accent)]")}>
                      <span style={{ background: h }} /><span style={{ background: b }} /><span className="bg-white" /><span style={{ background: b }} />
                    </button>
                  ))}
                </div>
              </RGroup>
              <RGroup label={L("Cellule", "خلية", "Cell")}>
                <RStack>
                  <SmallBtn icon={Heading} label={L("Ligne d'en-tête", "صف العناوين", "Header row")} withLabel onClick={() => run((c) => c.toggleHeaderRow())} />
                  <RMenu label={L("Trame", "تظليل", "Shading")} trigger={<SmallBtn icon={PaintBucket} label={L("Trame de cellule", "تظليل الخلية", "Cell shading")} withLabel />} width={236}>
                    {(close) => <ColorPalette customLabel={L("Autres couleurs…", "ألوان أخرى…", "More colors…")} noneLabel={L("Aucune", "بدون", "None")} onNone={() => { run((c) => c.setCellAttribute("background", null)); close(); }} onPick={(col) => { run((c) => c.setCellAttribute("background", col)); close(); }} />}
                  </RMenu>
                  <RMenu label={L("Alignement vertical", "المحاذاة العمودية", "Vertical align")} trigger={<SmallBtn icon={AlignCenter} label={L("Alignement vertical", "المحاذاة العمودية", "Vertical align")} withLabel />} width={170}>
                    {(close) => (
                      <>
                        {([["top", L("Haut", "أعلى", "Top")], ["middle", L("Centre", "وسط", "Middle")], ["bottom", L("Bas", "أسفل", "Bottom")]] as const).map(([k, lab]) => (
                          <MenuItem key={k} label={lab} onClick={() => { run((c) => c.setCellAttribute("valign", k)); close(); }} />
                        ))}
                      </>
                    )}
                  </RMenu>
                </RStack>
              </RGroup>
            </>
          )}

          {tab === "image" && st.image && (
            <>
              <RGroup label={L("Taille", "الحجم", "Size")}>
                <div className="grid grid-cols-2 gap-0.5">
                  {[25, 50, 75, 100].map((p) => (
                    <SmallBtn key={p} icon={Maximize} label={`${p} %`} withLabel onClick={() => {
                      const cw = (pageEl.current?.querySelector(".ProseMirror") as HTMLElement | null)?.clientWidth || 600;
                      run((c) => c.updateAttributes("image", { width: Math.round((cw * p) / 100), height: null }));
                    }} />
                  ))}
                </div>
              </RGroup>
              <RGroup label={L("Habillage", "التفاف النص", "Wrap text")}>
                <SmallBtn icon={AlignLeft} label={L("À gauche", "يسار", "Left")} active={st.imageAttrs?.align === "left"} onClick={() => run((c) => c.updateAttributes("image", { align: "left" }))} />
                <SmallBtn icon={AlignCenter} label={L("Centrée", "وسط", "Center")} active={st.imageAttrs?.align === "center"} onClick={() => run((c) => c.updateAttributes("image", { align: "center" }))} />
                <SmallBtn icon={AlignRight} label={L("À droite", "يمين", "Right")} active={st.imageAttrs?.align === "right"} onClick={() => run((c) => c.updateAttributes("image", { align: "right" }))} />
                <SmallBtn icon={WrapText} label={L("Aligné sur le texte", "مع النص", "In line")} active={!st.imageAttrs?.align} onClick={() => run((c) => c.updateAttributes("image", { align: null }))} />
              </RGroup>
              <RGroup label={L("Styles d'image", "أنماط الصورة", "Picture styles")}>
                <div className="flex gap-1">
                  {([["", L("Aucun", "بدون", "None")], ["shadow", L("Ombre", "ظل", "Shadow")], ["border", L("Cadre", "إطار", "Frame")], ["rounded", L("Arrondi", "مستدير", "Rounded")], ["circle", L("Cercle", "دائرة", "Circle")]] as const).map(([k, lab]) => (
                    <button key={k} type="button" onClick={() => run((c) => c.updateAttributes("image", { frame: k || null }))} className={cn("flex h-[58px] w-[56px] flex-col items-center justify-center gap-1 rounded border text-[10px] hover:bg-muted", (st.imageAttrs?.frame || "") === k && "ring-2 ring-[color:var(--office-accent)]")}>
                      <span className={cn("h-6 w-8 bg-gradient-to-br from-sky-300 to-indigo-500", k === "shadow" && "shadow-md", k === "border" && "border-2 border-white outline outline-1 outline-slate-400", k === "rounded" && "rounded-md", k === "circle" && "h-7 w-7 rounded-full")} />
                      {lab}
                    </button>
                  ))}
                </div>
              </RGroup>
              <RGroup label={L("Accessibilité", "إمكانية الوصول", "Accessibility")}>
                <BigBtn icon={Type} label={L("Texte de remplacement", "نص بديل", "Alt text")} onClick={() => { const v = window.prompt(L("Description de l'image", "وصف الصورة", "Image description"), String(st.imageAttrs?.alt || "")); if (v !== null) run((c) => c.updateAttributes("image", { alt: v })); }} />
                <BigBtn icon={Trash2} label={L("Supprimer", "حذف", "Delete")} onClick={() => run((c) => c.deleteSelection())} />
              </RGroup>
            </>
          )}
        </RibbonBody>
      )}
    </>
  );

  // ---------- Page ----------
  const size = PAGE_SIZES[page.size];
  const pw = mmToPx(page.orientation === "landscape" ? size.h : size.w);
  const ph = mmToPx(page.orientation === "landscape" ? size.w : size.h);
  const pad = page.margins;
  const theme = DOC_THEMES[page.theme || "office"] || DOC_THEMES.office;
  const totalH = Math.max(ph, contentH + mmToPx(pad.top) + mmToPx(pad.bottom));
  const pageCount = Math.max(1, Math.ceil(totalH / ph));
  const pageStyle: CSSProperties = viewMode === "web"
    ? { width: "100%", minHeight: "100%", padding: "24px 48px", fontFamily: page.defaultFont, fontSize: `${page.defaultSize}pt` }
    : {
      width: pw,
      minHeight: pageCount * ph,
      padding: `${mmToPx(pad.top)}px ${mmToPx(pad.right)}px ${mmToPx(pad.bottom)}px ${mmToPx(pad.left)}px`,
      fontFamily: page.defaultFont,
      fontSize: `${page.defaultSize}pt`,
      lineHeight: 1.15,
      columnCount: page.columns > 1 ? page.columns : undefined,
      columnGap: page.columns > 1 ? 32 : undefined,
    };
  if (page.pageColor) pageStyle.background = page.pageColor;
  (pageStyle as Record<string, string>)["--w-h-color"] = theme.h1;
  (pageStyle as Record<string, string>)["--w-h2-color"] = theme.h2;
  (pageStyle as Record<string, string>)["--w-h-font"] = theme.heading;
  (pageStyle as Record<string, string>)["--w-pb-label"] = `"${L("Saut de page", "فاصل صفحة", "Page break")}"`;

  const scrollRef = useRef<HTMLDivElement>(null);
  const fitWidth = () => {
    const w = scrollRef.current?.clientWidth || 800;
    setZoom(Math.max(0.3, Math.min(3, Math.floor(((w - 48) / pw) * 100) / 100)));
  };

  // Rechercher / remplacer : raccourcis
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") { e.preventDefault(); setFindOpen("find"); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "h") { e.preventDefault(); setFindOpen("replace"); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") { e.preventDefault(); printDoc(); }
      if (e.key === "Escape" && viewMode === "read") setViewMode("page");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const headings = useMemo(() => (ed && showNav ? collectHeadings(ed.state.doc) : []), [ed, showNav, st?.words]); // eslint-disable-line react-hooks/exhaustive-deps
  const comments = useMemo(() => {
    if (!ed || !showComments) return [];
    const out: { text: string; quote: string; pos: number; date: string }[] = [];
    ed.state.doc.descendants((n, pos) => {
      const m = n.marks.find((x) => x.type.name === "comment");
      if (m && n.isText) {
        const last = out[out.length - 1];
        if (last && last.text === m.attrs.text && last.pos + last.quote.length === pos) last.quote += n.text;
        else out.push({ text: m.attrs.text, quote: n.text || "", pos, date: m.attrs.date });
      }
    });
    return out;
  }, [ed, showComments, st?.chars]); // eslint-disable-line react-hooks/exhaustive-deps
  const footnotes = useMemo(() => {
    if (!ed) return [];
    const out: string[] = [];
    ed.state.doc.descendants((n) => { if (n.type.name === "footnote") out.push(n.attrs.text); });
    return out;
  }, [ed, st?.chars]); // eslint-disable-line react-hooks/exhaustive-deps

  const hfText = (txt: string, where: "header" | "footer", n: number) => {
    const withNum = page.pageNumbers === where;
    if (!txt && !withNum) return null;
    return `${txt}${txt && withNum ? "   " : ""}${withNum ? `${n} / ${pageCount}` : ""}`;
  };

  return (
    <OfficeShell
      app="word"
      L={L}
      dir={dir}
      dark={dark}
      fileName={file.fileName}
      onRename={file.rename}
      saveState={file.saveState}
      onSaveNow={() => void file.saveNow()}
      onUndo={() => run((c) => c.undo())}
      onRedo={() => run((c) => c.redo())}
      canUndo={st?.canUndo}
      canRedo={st?.canRedo}
      templates={wordTemplates(L).map((t) => ({ ...t, thumb: <DocThumb variant={t.id} accent="#2B579A" /> }))}
      onNew={onNew}
      accept=".docx,.html,.htm,.txt,.md"
      onOpenFile={onOpenFile}
      onOpenRecent={onOpenRecent}
      currentId={file.fileId}
      formats={formats}
      onExport={onExport}
      onPrint={printDoc}
      backstageOpen={backstage}
      setBackstageOpen={setBackstage}
      ribbon={ribbon}
      statusBar={
        <>
          <span>{L("Page", "صفحة", "Page")} {pageCount > 1 ? `1-${pageCount}` : 1} {L("sur", "من", "of")} {pageCount}</span>
          <span>{st?.words ?? 0} {L("mots", "كلمة", "words")}</span>
          <span className="hidden sm:inline">{st?.chars ?? 0} {L("caractères", "حرف", "characters")}</span>
          <span className="hidden md:inline">{language === "ar" ? "العربية" : language === "en" ? "English" : "Français"}</span>
          {readOnly && <span className="flex items-center gap-1 text-amber-600"><Lock className="h-3 w-3" /> {L("Lecture seule", "للقراءة فقط", "Read-only")}</span>}
          <div className="ms-auto flex items-center gap-1.5">
            <button type="button" title={L("Mode Lecture", "وضع القراءة", "Read mode")} className={cn("rounded p-0.5 hover:bg-muted", viewMode === "read" && "bg-muted")} onClick={() => setViewMode("read")}><BookOpen className="h-3.5 w-3.5" /></button>
            <button type="button" title={L("Page", "صفحة", "Print layout")} className={cn("rounded p-0.5 hover:bg-muted", viewMode === "page" && "bg-muted")} onClick={() => setViewMode("page")}><FileText className="h-3.5 w-3.5" /></button>
            <button type="button" title="Web" className={cn("rounded p-0.5 hover:bg-muted", viewMode === "web" && "bg-muted")} onClick={() => setViewMode("web")}><MonitorSmartphone className="h-3.5 w-3.5" /></button>
            <button type="button" className="rounded p-0.5 hover:bg-muted" onClick={() => setZoom((z) => Math.max(0.3, Math.round((z - 0.1) * 10) / 10))} aria-label="-"><Minus className="h-3 w-3" /></button>
            <input type="range" min={30} max={300} value={Math.round(zoom * 100)} onChange={(e) => setZoom(Number(e.target.value) / 100)} className="w-24 accent-[#2B579A]" aria-label="Zoom" />
            <button type="button" className="rounded p-0.5 hover:bg-muted" onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.1) * 10) / 10))} aria-label="+"><Plus className="h-3 w-3" /></button>
            <button type="button" className="w-10 text-end" onClick={() => setZoom(1)}>{Math.round(zoom * 100)} %</button>
          </div>
        </>
      }
    >
      <div className="flex min-h-0 flex-1">
        {showNav && viewMode !== "read" && (
          <aside className="hidden w-60 shrink-0 flex-col border-e bg-card md:flex">
            <div className="flex h-9 items-center justify-between border-b px-3 text-[13px] font-semibold">
              {L("Navigation", "التنقل", "Navigation")}
              <button type="button" onClick={() => setShowNav(false)} className="rounded p-1 hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2 text-[13px]">
              {headings.length === 0 ? (
                <p className="p-2 text-xs text-muted-foreground">{L("Ajoutez des titres (Titre 1, Titre 2…) pour les voir ici.", "أضف عناوين (عنوان 1، عنوان 2…) لتظهر هنا.", "Add headings (Heading 1, 2…) to see them here.")}</p>
              ) : headings.map((h, i) => (
                <button key={i} type="button" onClick={() => { ed?.chain().focus().setTextSelection(h.pos + 1).scrollIntoView().run(); }} className="block w-full truncate rounded px-2 py-1 text-start hover:bg-muted" style={{ paddingInlineStart: 8 + (h.level - 1) * 14, fontWeight: h.level === 1 ? 600 : 400 }}>
                  {h.text || "…"}
                </button>
              ))}
            </div>
          </aside>
        )}

        <div ref={scrollRef} className={cn("relative min-w-0 flex-1 overflow-auto", viewMode === "web" ? "bg-card" : "bg-muted/60")}>
          {findOpen && ed && <FindReplace editor={ed} mode={findOpen} onMode={setFindOpen} onClose={() => { ed.commands.setSearch(""); setFindOpen(null); }} L={L} />}
          {viewMode === "read" && (
            <button type="button" onClick={() => setViewMode("page")} className="sticky top-2 z-20 float-end me-3 mt-2 flex items-center gap-1 rounded-full border bg-card px-3 py-1.5 text-xs shadow">
              <X className="h-3.5 w-3.5" /> {L("Quitter le mode Lecture", "الخروج من وضع القراءة", "Exit Read mode")}
            </button>
          )}
          {showRuler && viewMode === "page" && (
            <div className="sticky top-0 z-10 flex justify-center bg-muted/90 py-1 backdrop-blur" style={{ zoom }}>
              <RulerBar width={pw} left={mmToPx(pad.left)} right={mmToPx(pad.right)} />
            </div>
          )}
          <div className={cn("flex justify-center", viewMode === "web" ? "" : "px-6 py-6")} style={{ zoom: viewMode === "web" ? undefined : zoom }}>
            <div
              ref={pageEl}
              dir={dir}
              className={cn("word-page", viewMode === "web" && "word-web", showMarks && "show-marks", page.pageDark && "page-dark", page.pageBorder && page.pageBorder !== "none" && viewMode === "page" && `border-${page.pageBorder}`, viewMode === "read" && "mx-auto max-w-3xl")}
              style={viewMode === "read" ? { padding: "48px 56px", fontFamily: page.defaultFont, fontSize: `${page.defaultSize + 2}pt`, lineHeight: 1.6 } : pageStyle}
              onClick={(e) => { if (e.target === e.currentTarget) ed?.commands.focus("end"); }}
            >
              {page.watermark && viewMode !== "web" && (
                <div className="watermark" aria-hidden="true">{Array.from({ length: pageCount }, (_, i) => <span key={i} style={{ position: "absolute", top: i * ph + ph / 2 - 60 }}>{page.watermark}</span>)}</div>
              )}
              {viewMode === "page" && Array.from({ length: pageCount }, (_, i) => (
                <div key={i}>
                  {hfText(page.header, "header", i + 1) && <div className="hf" style={{ top: i * ph + mmToPx(pad.top) / 2 - 8, paddingInline: `${mmToPx(pad.left)}px`, textAlign: page.headerAlign }}>{hfText(page.header, "header", i + 1)}</div>}
                  {hfText(page.footer, "footer", i + 1) && <div className="hf" style={{ top: (i + 1) * ph - mmToPx(pad.bottom) / 2 - 6, paddingInline: `${mmToPx(pad.left)}px`, textAlign: page.footerAlign }}>{hfText(page.footer, "footer", i + 1)}</div>}
                  {i > 0 && <div className="page-sep" style={{ top: i * ph }}><span>{L("Page", "صفحة", "Page")} {i + 1}</span></div>}
                </div>
              ))}
              <EditorContent editor={ed} />
              {footnotes.length > 0 && viewMode !== "web" && (
                <div className="mt-6 border-t pt-2 text-[9pt] opacity-80" style={{ width: "40%" }}>
                  {footnotes.map((f, i) => <div key={i}><sup>{i + 1}</sup> {f}</div>)}
                </div>
              )}
            </div>
          </div>
        </div>

        {showComments && viewMode !== "read" && (
          <aside className="hidden w-72 shrink-0 flex-col border-s bg-card md:flex">
            <div className="flex h-9 items-center justify-between border-b px-3 text-[13px] font-semibold">
              {L("Commentaires", "التعليقات", "Comments")}
              <button type="button" onClick={() => setShowComments(false)} className="rounded p-1 hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
              {comments.length === 0 ? (
                <p className="p-2 text-xs text-muted-foreground">{L("Sélectionnez du texte puis Révision → Nouveau commentaire.", "حدد نصا ثم مراجعة ← تعليق جديد.", "Select text, then Review → New comment.")}</p>
              ) : comments.map((c, i) => (
                <div key={i} className="cursor-pointer rounded-lg border bg-background p-2.5 text-[13px] shadow-sm hover:border-amber-400" onClick={() => ed?.chain().focus().setTextSelection(c.pos + 1).scrollIntoView().run()}>
                  <div className="mb-1 truncate border-s-2 border-amber-400 ps-2 text-xs italic text-muted-foreground">« {c.quote} »</div>
                  <div>{c.text}</div>
                  {c.date && <div className="mt-1 text-[10px] text-muted-foreground">{new Date(c.date).toLocaleString()}</div>}
                  <button type="button" className="mt-1 text-[11px] text-destructive hover:underline" onClick={(e) => { e.stopPropagation(); ed?.chain().focus().setTextSelection({ from: c.pos, to: c.pos + c.quote.length }).unsetComment().run(); }}>{L("Résoudre", "حل", "Resolve")}</button>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>
      <ChartDialog open={chartOpen} onClose={() => setChartOpen(false)} L={L} onInsert={(png) => run((c) => c.setImage({ src: png }))} />
    </OfficeShell>
  );
}

// ---------- Petits composants ----------

const pxToCm = (p: number) => Math.round((p / 96) * 2.54 * 100) / 100;
const cmToPx = (c: number) => Math.round((c / 2.54) * 96);

function NumField({ label, unit, value, onChange }: { label: string; unit: string; value: number; onChange: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  return (
    <label className="flex h-7 items-center gap-1.5 text-[11.5px]">
      <span className="w-20 truncate text-muted-foreground">{label}</span>
      <input
        type="number"
        step={unit === "cm" ? 0.1 : 1}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { const n = parseFloat(v); if (!isNaN(n)) onChange(n); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className="h-6 w-16 rounded border bg-background px-1 text-[12px]"
      />
      <span className="text-muted-foreground">{unit}</span>
    </label>
  );
}

function TableGrid({ onPick, L }: { onPick: (r: number, c: number) => void; L: Tr }) {
  const [h, setH] = useState({ r: 0, c: 0 });
  return (
    <div>
      <div className="mb-1.5 text-center text-xs text-muted-foreground">{h.r && h.c ? `${h.c} × ${h.r}` : L("Insérer un tableau", "إدراج جدول", "Insert table")}</div>
      <div className="grid grid-cols-10 gap-[3px]" onMouseLeave={() => setH({ r: 0, c: 0 })}>
        {Array.from({ length: 80 }, (_, i) => {
          const r = Math.floor(i / 10) + 1, c = (i % 10) + 1;
          return (
            <button
              key={i}
              type="button"
              onMouseEnter={() => setH({ r, c })}
              onClick={() => onPick(r, c)}
              className={cn("h-[18px] w-[18px] border", r <= h.r && c <= h.c ? "border-[color:var(--office-accent)] bg-[color:var(--office-accent-soft)]" : "border-slate-300 bg-background")}
            />
          );
        })}
      </div>
      <button type="button" className="mt-2 w-full rounded px-2 py-1.5 text-start text-[12.5px] hover:bg-muted" onClick={() => {
        const v = window.prompt(L("Colonnes × lignes (ex. 4x6)", "أعمدة × صفوف (مثال 4x6)", "Columns × rows (e.g. 4x6)"), "4x6");
        const m = v?.match(/(\d+)\s*[x×*]\s*(\d+)/i);
        if (m) onPick(Math.min(100, +m[2]), Math.min(30, +m[1]));
      }}>{L("Insérer un tableau…", "إدراج جدول…", "Insert table…")}</button>
    </div>
  );
}

function ShapePicker({ onPick, L }: { onPick: (k: string, color: string) => void; L: Tr }) {
  const [color, setColor] = useState("#4472C4");
  const kinds = ["rect", "round", "circle", "triangle", "diamond", "arrow", "star", "callout", "heart"];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-5 gap-1">
        {kinds.map((k) => (
          <button key={k} type="button" className="flex h-10 items-center justify-center rounded border hover:bg-muted" onClick={() => onPick(k, color)} title={k}>
            <ShapeIcon kind={k} color={color} />
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-6 w-8" />
        {L("Couleur de remplissage", "لون التعبئة", "Fill color")}
      </label>
    </div>
  );
}

export function ShapeIcon({ kind, color }: { kind: string; color: string }) {
  const p: Record<string, React.ReactNode> = {
    rect: <rect x="2" y="5" width="20" height="14" fill={color} />,
    round: <rect x="2" y="5" width="20" height="14" rx="4" fill={color} />,
    circle: <ellipse cx="12" cy="12" rx="10" ry="8" fill={color} />,
    triangle: <polygon points="12,3 22,21 2,21" fill={color} />,
    diamond: <polygon points="12,2 22,12 12,22 2,12" fill={color} />,
    arrow: <polygon points="2,9 14,9 14,4 22,12 14,20 14,15 2,15" fill={color} />,
    star: <polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9" fill={color} />,
    callout: <path d="M2 4h20v12H10l-5 4 1-4H2z" fill={color} />,
    heart: <path d="M12 21C3 14 1 9 5 5c3-2 6 0 7 2 1-2 4-4 7-2 4 4 2 9-7 16z" fill={color} />,
    line: <line x1="2" y1="12" x2="22" y2="12" stroke={color} strokeWidth="2.5" />,
  };
  return <svg viewBox="0 0 24 24" className="h-6 w-6">{p[kind]}</svg>;
}

function setBulletStyle(ed: Editor, kind: string) {
  // style de puce mémorisé sur la liste (attribut HTML data-bullet)
  const { $from } = ed.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const n = $from.node(d);
    if (n.type.name === "bulletList") {
      const pos = $from.before(d);
      const dom = ed.view.nodeDOM(pos) as HTMLElement | null;
      if (dom) { if (kind) dom.setAttribute("data-bullet", kind); else dom.removeAttribute("data-bullet"); }
      return;
    }
  }
}

function RulerBar({ width, left, right }: { width: number; left: number; right: number }) {
  const usable = width - left - right;
  const cm = Math.floor(usable / 37.8);
  return (
    <div className="relative h-5 rounded-sm border bg-card text-[8px] text-muted-foreground" style={{ width }}>
      <div className="absolute inset-y-0 start-0 bg-muted" style={{ width: left }} />
      <div className="absolute inset-y-0 end-0 bg-muted" style={{ width: right }} />
      {Array.from({ length: cm * 2 + 1 }, (_, i) => (
        <span key={i} className="absolute top-0 border-s border-slate-400/70" style={{ insetInlineStart: left + (i * 37.8) / 2, height: i % 2 === 0 ? 7 : 4 }}>
          {i > 0 && i % 2 === 0 && <span className="absolute top-[7px] -translate-x-1/2 rtl:translate-x-1/2">{i / 2}</span>}
        </span>
      ))}
    </div>
  );
}

function FindReplace({ editor, mode, onMode, onClose, L }: { editor: Editor; mode: "find" | "replace"; onMode: (m: "find" | "replace") => void; onClose: () => void; L: Tr }) {
  const [term, setTerm] = useState("");
  const [rep, setRep] = useState("");
  const [cs, setCs] = useState(false);
  const [ww, setWw] = useState(false);
  const s = useEditorState({ editor, selector: ({ editor: e }) => { const x = searchState(e); return { n: x?.results.length || 0, i: x?.index || 0 }; } });
  useEffect(() => { editor.commands.setSearch(term, { caseSensitive: cs, wholeWord: ww }); }, [editor, term, cs, ww]);
  const go = (delta: number) => {
    const x = searchState(editor);
    if (!x || !x.results.length) return;
    const i = (x.index + delta + x.results.length) % x.results.length;
    editor.commands.setSearchIndex(i);
    const r = x.results[i];
    editor.chain().setTextSelection(r).scrollIntoView().run();
  };
  const replaceOne = () => {
    const x = searchState(editor);
    if (!x || !x.results.length) return;
    const r = x.results[x.index];
    editor.chain().focus().insertContentAt(r, rep).run();
  };
  const replaceAll = () => {
    const x = searchState(editor);
    if (!x || !x.results.length) return;
    const n = x.results.length;
    const tr = editor.state.tr;
    [...x.results].reverse().forEach((r) => { const marks = editor.state.doc.resolve(r.from + 1).marks(); tr.replaceWith(r.from, r.to, editor.schema.text(rep || " ", marks)); if (!rep) tr.delete(r.from, r.from + 1); });
    editor.view.dispatch(tr);
    toast.success(L(`${n} remplacement(s) effectué(s)`, `تم ${n} استبدال`, `${n} replacement(s) made`));
  };
  return (
    <div className="sticky top-2 z-30 float-end me-3 mt-2 w-[320px] rounded-lg border bg-card p-2.5 shadow-lg">
      <div className="mb-2 flex items-center gap-1 text-[12.5px]">
        <button type="button" className={cn("rounded px-2 py-1", mode === "find" && "bg-muted font-semibold")} onClick={() => onMode("find")}>{L("Rechercher", "بحث", "Find")}</button>
        <button type="button" className={cn("rounded px-2 py-1", mode === "replace" && "bg-muted font-semibold")} onClick={() => onMode("replace")}>{L("Remplacer", "استبدال", "Replace")}</button>
        <button type="button" onClick={onClose} className="ms-auto rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex items-center gap-1">
        <input autoFocus value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") go(e.shiftKey ? -1 : 1); }} placeholder={L("Rechercher dans le document", "ابحث في المستند", "Search document")} className="h-8 min-w-0 flex-1 rounded border bg-background px-2 text-sm" />
        <span className="w-12 text-center text-[11px] text-muted-foreground">{s?.n ? `${s.i + 1}/${s.n}` : "0"}</span>
        <button type="button" className="rounded p-1 hover:bg-muted" onClick={() => go(-1)} aria-label="prev"><Undo2 className="h-3.5 w-3.5 rotate-90" /></button>
        <button type="button" className="rounded p-1 hover:bg-muted" onClick={() => go(1)} aria-label="next"><Redo2 className="h-3.5 w-3.5 rotate-90" /></button>
      </div>
      {mode === "replace" && (
        <div className="mt-1.5 space-y-1.5">
          <input value={rep} onChange={(e) => setRep(e.target.value)} placeholder={L("Remplacer par", "استبدال بـ", "Replace with")} className="h-8 w-full rounded border bg-background px-2 text-sm" />
          <div className="flex gap-1.5">
            <button type="button" className="h-7 flex-1 rounded border text-xs hover:bg-muted" onClick={replaceOne}>{L("Remplacer", "استبدال", "Replace")}</button>
            <button type="button" className="h-7 flex-1 rounded border text-xs hover:bg-muted" onClick={replaceAll}>{L("Remplacer tout", "استبدال الكل", "Replace all")}</button>
          </div>
        </div>
      )}
      <div className="mt-1.5 flex gap-3 text-[11.5px] text-muted-foreground">
        <label className="flex items-center gap-1"><input type="checkbox" checked={cs} onChange={(e) => setCs(e.target.checked)} /> {L("Respecter la casse", "مطابقة الحالة", "Match case")}</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={ww} onChange={(e) => setWw(e.target.checked)} /> {L("Mot entier", "كلمة كاملة", "Whole word")}</label>
      </div>
    </div>
  );
}

/** Page HTML d'impression (et export .html) avec format, marges, en-tête, pied et numéros */
function buildPrintHtml(body: string, page: PageSettings, title: string, dir: string, autoPrint: boolean) {
  const size = PAGE_SIZES[page.size];
  const [w, h] = page.orientation === "landscape" ? [size.h, size.w] : [size.w, size.h];
  const th = DOC_THEMES[page.theme || "office"] || DOC_THEMES.office;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
  const cssStr = (s: string) => `"${s.replace(/"/g, '\\"')}"`;
  const hf = (txt: string, where: "header" | "footer") => {
    const num = page.pageNumbers === where;
    if (!txt && !num) return "";
    const align = where === "header" ? page.headerAlign : page.footerAlign;
    const box = `@${where === "header" ? "top" : "bottom"}-${align === "left" ? "left" : align === "right" ? "right" : "center"}`;
    return `${box}{content:${txt ? cssStr(txt) : '""'}${num ? `${txt ? ' "   "' : ""} counter(page) " / " counter(pages)` : ""};font:9pt Calibri,Arial,sans-serif;color:#777}`;
  };
  return `<!doctype html><html dir="${dir}"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css">
<style>
@page{size:${w}mm ${h}mm;margin:${page.margins.top}mm ${page.margins.right}mm ${page.margins.bottom}mm ${page.margins.left}mm;${hf(page.header, "header")}${hf(page.footer, "footer")}}
body{font-family:${page.defaultFont},Calibri,Arial,sans-serif;font-size:${page.defaultSize}pt;line-height:1.15;color:#1f1f1f;margin:0;${page.pageColor ? `background:${page.pageColor};-webkit-print-color-adjust:exact;print-color-adjust:exact;` : ""}${page.columns > 1 ? `column-count:${page.columns};column-gap:8mm;` : ""}}
@media screen{body{max-width:${w - page.margins.left - page.margins.right}mm;margin:20mm auto}}
*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
p{margin:0 0 8px;unicode-bidi:plaintext} h1,h2,h3,h4,h5,h6{font-family:${th.heading};color:${th.h1};font-weight:600;margin:14px 0 6px;break-after:avoid} h1{font-size:1.6em} h2{font-size:1.3em;color:${th.h2}} h3{font-size:1.15em}
table{border-collapse:collapse;width:100%;margin:6px 0 10px;break-inside:auto} td,th{border:1px solid #a6a6a6;padding:4px 7px;vertical-align:top} th{background:#f2f2f2;text-align:start} td>p,th>p{margin:0} tr{break-inside:avoid}
table[data-style=plain] td,table[data-style=plain] th{border-color:transparent;border-bottom-color:#d9d9d9}
table[data-style=blue] th{background:#2b579a;color:#fff} table[data-style=blue] tr:nth-child(odd) td{background:#dce6f4}
table[data-style=green] th{background:#217346;color:#fff} table[data-style=green] tr:nth-child(odd) td{background:#e2efda}
table[data-style=gray] th{background:#404040;color:#fff} table[data-style=gray] tr:nth-child(odd) td{background:#f2f2f2}
table[data-style=orange] th{background:#c43e1c;color:#fff} table[data-style=orange] tr:nth-child(odd) td{background:#fbe5d6}
blockquote{border-inline-start:4px solid #c8c8c8;padding-inline-start:14px;color:#595959;font-style:italic;margin:8px 0}
pre{background:#f3f3f3;padding:10px;font-family:Consolas,monospace;direction:ltr} img{max-width:100%}
ul[data-type=taskList]{list-style:none;padding-inline-start:4px} ul[data-type=taskList] li{display:flex;gap:6px}
div[data-page-break]{break-after:page;height:0} .doc-comment,[data-comment]{background:none}
sup[data-footnote]{counter-increment:fn} sup[data-footnote]::after{content:counter(fn)} body{counter-reset:fn}
p.drop-cap::first-letter{float:left;font-size:3.4em;line-height:.85;padding:4px 6px 0 0;font-weight:600;color:${th.h1}}
div[data-toc]{display:none}
${page.watermark ? `body::before{content:${cssStr(page.watermark)};position:fixed;top:45%;left:0;right:0;text-align:center;transform:rotate(-40deg);font-size:90px;font-weight:700;color:rgba(160,160,160,.22);z-index:-1}` : ""}
</style></head><body>${body}
<script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js"></script>
<script>
(function(){
  function render(){ if(!window.katex) return; document.querySelectorAll('span[data-latex]').forEach(function(s){ try{ window.katex.render(s.getAttribute('data-latex'), s, {throwOnError:false, displayMode: s.getAttribute('data-display')==='1'});}catch(e){} }); }
  var notes=[].slice.call(document.querySelectorAll('sup[data-footnote]')); if(notes.length){ var d=document.createElement('div'); d.style.cssText='border-top:1px solid #999;margin-top:24px;padding-top:6px;font-size:9pt;width:40%'; notes.forEach(function(n,i){ var p=document.createElement('div'); p.textContent=(i+1)+'. '+n.getAttribute('data-footnote'); d.appendChild(p); }); document.body.appendChild(d); }
  window.addEventListener('load', function(){ render(); ${autoPrint ? "setTimeout(function(){ window.print(); }, 400);" : ""} });
})();
</script></body></html>`;
}

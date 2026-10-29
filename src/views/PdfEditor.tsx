import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import {
  ArrowUpRight, Camera, Circle, CircleDot, Combine, Copy, Download, Droplet, Eraser, FileOutput, FilePlus2, FileText, FolderOpen,
  Hand, HardDrive, Hash, Highlighter, ImagePlus, LayoutGrid, Link2, List, ListChecks, Loader2, Lock, MessageSquare,
  MessageSquareQuote, Minus, MousePointer2, Palette, PanelTop, PenLine, Pentagon, Printer, Redo2, RotateCcw, RotateCw,
  Save, Scissors, Search, Signature, Spline, Square, SquareCheck, SquareDashed, Stamp, StickyNote, Strikethrough,
  TextCursorInput, TextSelect, Trash2, Type, Underline, Undo2, Upload, Waves, ZoomIn, ZoomOut, MoveHorizontal, Replace,
  ChevronDownSquare, PencilLine, ReplaceAll, CheckCheck, X, PanelRight, Brush, Paperclip, MonitorPlay, Minimize2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { accessStore, useAccess } from "@/contexts/AccessContext";
import type { PermissionKey } from "@/lib/permissions";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCourses } from "@/contexts/CourseContext";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { getMaterialKind, getMaterialUrl, saveCourseMaterials, formatFileSize, type CourseMaterialLike } from "@/lib/courseMedia";
import { Navigate } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { PdfWorkspaceHandle } from "@/components/pdf-editor/PdfWorkspace";
import WatermarkDialog from "@/components/pdf-editor/WatermarkDialog";
import PageOrganizer from "@/components/pdf-editor/PageOrganizer";
import { CommandButton, RibbonBar, RibbonButton, RibbonGroup, RibbonTabs, useCommandRefresh } from "@/components/pdf-editor/Ribbon";
import {
  AddWatermarkDialog, HeaderFooterDialog, PageNumbersDialog, ReplaceDialog, SplitDialog,
  type HeaderFooterFormValue, type ReplaceFormValue, type PageNumbersFormValue, type WatermarkFormValue,
} from "@/components/pdf-editor/PageToolDialogs";

// Moteur PDF (WebAssembly) : chargé uniquement dans le navigateur, à l'ouverture de la page
const PdfWorkspace = dynamic(() => import("@/components/pdf-editor/PdfWorkspace"), {
  ssr: false,
  loading: () => <WorkspaceSpinner />,
});

function WorkspaceSpinner() {
  return (
    <div className="flex h-full items-center justify-center bg-muted/40">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

interface CoursePdf extends CourseMaterialLike {
  course_id: string;
}

const stripPdf = (name: string) => name.replace(/\.pdf$/i, "");
const toArrayBuffer = (b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
// Opérations sur les pages (pdf-lib) : chargées à la première utilisation
const pages = () => import("@/lib/pdfPages");

type TabId = "home" | "comment" | "edit" | "organize" | "form" | "protect";
type ToolDialogId = "watermark" | "headerFooter" | "pageNumbers" | "split" | "replace" | null;
/** Habilitation demandée par chaque onglet du ruban (Accueil : pdf.use, vérifiée par la page) */
const TAB_PERMISSION: Partial<Record<TabId, PermissionKey>> = {
  comment: "pdf.annotate",
  edit: "pdf.edit",
  organize: "pdf.organize",
  form: "pdf.edit",
  protect: "pdf.protect",
};
const TAB_MODE: Record<TabId, string> = {
  home: "mode:view",
  comment: "mode:annotate",
  edit: "mode:insert",
  organize: "mode:view",
  form: "mode:form",
  protect: "mode:redact",
};

const PdfEditor = () => {
  const { user } = useAuth();
  const { can } = useAccess();
  const { language } = useLanguage();
  const { courses, rooms } = useCourses();
  const { theme, systemTheme } = useTheme();
  const dark = (theme === "system" ? systemTheme : theme) === "dark";
  const lang = (language === "ar" || language === "en" ? language : "fr") as "fr" | "ar" | "en";
  const t = (fr: string, ar: string, en: string) => (lang === "ar" ? ar : lang === "en" ? en : fr);

  const workspace = useRef<PdfWorkspaceHandle>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [docCount, setDocCount] = useState(0);
  const [activeName, setActiveName] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [dragging, setDragging] = useState(false);

  const [pdfs, setPdfs] = useState<CoursePdf[]>([]);
  const [pdfsLoading, setPdfsLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");

  const [saveOpen, setSaveOpen] = useState(false);
  const [saveCourseId, setSaveCourseId] = useState("");
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [cleanOpen, setCleanOpen] = useState(false);
  /** Mode tableau : document seul en plein écran avec stylo, surligneur et zoom (vidéoprojecteur) */
  const [board, setBoard] = useState(false);

  /* ── Ruban (façon éditeur de bureau) ── */
  const [tab, setTab] = useState<TabId>("home");
  const [docVersion, setDocVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toolDialog, setToolDialog] = useState<ToolDialogId>(null);
  const [replaceFind, setReplaceFind] = useState("");
  const replaceSource = useRef<ArrayBuffer | null>(null);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [thumbsLoading, setThumbsLoading] = useState(false);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [pageTotal, setPageTotal] = useState(0);
  const undoStack = useRef<Record<string, ArrayBuffer[]>>({});
  const redoStack = useRef<Record<string, ArrayBuffer[]>>({});
  const [, setUndoTick] = useState(0);
  const insertInput = useRef<HTMLInputElement>(null);
  const mergeInput = useRef<HTMLInputElement>(null);
  // Cours d'origine du document ouvert (proposé par défaut à l'enregistrement)
  const originCourse = useRef<Record<string, string>>({});

  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const roomName = (roomId?: string) => rooms.find((r) => r.id === roomId)?.name;

  /* ── PDF des cours du professeur ── */
  useEffect(() => {
    const ids = courses.map((c) => c.id);
    if (ids.length === 0) {
      setPdfs([]);
      setPdfsLoading(false);
      return;
    }
    let cancelled = false;
    setPdfsLoading(true);
    supabase
      .from("course_materials")
      .select("*")
      .in("course_id", ids)
      .order("uploaded_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("PDF list error:", error);
        setPdfs(((data || []) as CoursePdf[]).filter((m) => getMaterialKind(m) === "pdf"));
        setPdfsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courses]);

  const onDocumentsChange = useCallback((count: number, name: string | null) => {
    setDocCount(count);
    setActiveName(name);
    setDocVersion((v) => v + 1);
  }, []);

  /* ── Ouverture ── */
  const openLocalFile = async (file: File) => {
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
      toast.error(t("Ce fichier n'est pas un PDF.", "هذا الملف ليس PDF.", "This file is not a PDF."));
      return;
    }
    setOpening(true);
    try {
      await workspace.current?.openBuffer(await file.arrayBuffer(), file.name);
    } catch (e) {
      console.error(e);
      toast.error(t("Impossible d'ouvrir ce PDF.", "تعذر فتح ملف PDF هذا.", "Could not open this PDF."));
    } finally {
      setOpening(false);
    }
  };

  const openCoursePdf = async (m: CoursePdf) => {
    setPickerOpen(false);
    setOpening(true);
    try {
      originCourse.current[m.file_name] = m.course_id;
      await workspace.current?.openUrl(getMaterialUrl(m), m.file_name);
    } catch (e) {
      console.error(e);
      toast.error(t("Impossible d'ouvrir ce PDF.", "تعذر فتح ملف PDF هذا.", "Could not open this PDF."));
    } finally {
      setOpening(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void openLocalFile(file);
  };

  /* ── Enregistrement dans un cours ── */
  const canUpload = can("course.upload_pdf");
  const openSaveDialog = () => {
    const base = stripPdf(activeName || "document");
    setSaveName(`${base} (${t("modifié", "معدل", "edited")})`);
    const origin = activeName ? originCourse.current[activeName] : undefined;
    setSaveCourseId(origin && courseById.has(origin) ? origin : courses[0]?.id || "");
    setSaveOpen(true);
  };

  const saveToCourse = async () => {
    if (!user || !saveCourseId) return;
    setSaving(true);
    try {
      const exported = await workspace.current?.exportActive();
      if (!exported) throw new Error("no document");
      const fileName = `${stripPdf(saveName.trim() || "document")}.pdf`;
      const file = new File([exported.buffer], fileName, { type: "application/pdf" });
      const { failed } = await saveCourseMaterials({ courseId: saveCourseId, files: [file], userId: user.id });
      if (failed.length) throw new Error(failed[0]);
      toast.success(
        t("PDF ajouté au cours", "تمت إضافة PDF إلى الدرس", "PDF added to the course"),
        { description: courseById.get(saveCourseId)?.title }
      );
      setPdfs((prev) => [
        { id: `local-${Date.now()}`, course_id: saveCourseId, file_name: fileName, file_path: "", file_size: file.size, uploaded_at: new Date().toISOString() },
        ...prev,
      ]);
      setSaveOpen(false);
    } catch (e) {
      console.error(e);
      toast.error(t("L'enregistrement a échoué.", "فشل الحفظ.", "Saving failed."));
    } finally {
      setSaving(false);
    }
  };

  const hasDoc = docCount > 0;
  const ws = workspace.current;

  /* ── Mode tableau ── */
  const enterBoard = () => {
    setBoard(true);
    try {
      const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
      if (el.requestFullscreen) void el.requestFullscreen().catch(() => undefined);
      else el.webkitRequestFullscreen?.();
    } catch {
      /* plein écran refusé : le mode tableau occupe quand même toute la fenêtre */
    }
    window.setTimeout(() => workspace.current?.runCommand("zoom:fit-width"), 150);
  };
  const exitBoard = useCallback(() => {
    setBoard(false);
    workspace.current?.clearActiveTool();
    try {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    if (!board) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) exitBoard();
    };
    // Sortie du plein écran (Échap) → sortie du mode tableau
    const onFs = () => {
      if (!document.fullscreenElement) exitBoard();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [board, exitBoard]);
  useEffect(() => {
    if (board && !hasDoc) exitBoard();
  }, [board, hasDoc, exitBoard]);

  // Lien « Projeter au tableau » depuis un cours : /pdf-editor?url=…&name=…&board=1
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpened.current || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const url = params.get("url");
    if (!url || !/^https?:\/\//i.test(url)) return;
    autoOpened.current = true;
    const name = params.get("name") || "document.pdf";
    let tries = 0;
    const timer = window.setInterval(async () => {
      tries += 1;
      if (!workspace.current && tries < 60) return;
      window.clearInterval(timer);
      if (!workspace.current) return;
      setOpening(true);
      try {
        await workspace.current.openUrl(url, name);
        if (params.get("board") === "1") {
          setBoard(true);
          window.setTimeout(() => workspace.current?.runCommand("zoom:fit-width"), 400);
        }
      } catch (e) {
        console.error(e);
        toast.error(t("Impossible d'ouvrir ce PDF.", "تعذر فتح ملف PDF هذا.", "Could not open this PDF."));
      } finally {
        setOpening(false);
      }
    }, 250);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useCommandRefresh(workspace, hasDoc);

  // Onglet du ruban → mode du visualiseur (verrouillage des formulaires, outils disponibles…)
  useEffect(() => {
    if (!hasDoc) return;
    const id = window.setTimeout(() => workspace.current?.runCommand(TAB_MODE[tab]), 0);
    return () => window.clearTimeout(id);
  }, [tab, hasDoc, docVersion]);

  // Changer d'onglet range l'outil en cours : un surligneur resté actif colorerait le texte sélectionné
  useEffect(() => {
    workspace.current?.clearActiveTool();
  }, [tab]);

  // Nombre de pages du document actif
  useEffect(() => {
    if (!hasDoc) return setPageTotal(0);
    const id = window.setTimeout(() => setPageTotal(workspace.current?.activePageCount() || 0), 300);
    return () => window.clearTimeout(id);
  }, [hasDoc, docVersion]);

  // Miniatures pour la vue « Organiser »
  useEffect(() => {
    setSelectedPages(new Set());
    if (tab !== "organize" || !hasDoc) return;
    let cancelled = false;
    let urls: string[] = [];
    setThumbsLoading(true);
    const id = window.setTimeout(async () => {
      try {
        urls = (await workspace.current?.renderThumbnails(0.3)) || [];
        if (cancelled) urls.forEach(URL.revokeObjectURL);
        else setThumbs(urls);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setThumbsLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
      urls.forEach(URL.revokeObjectURL);
    };
  }, [tab, hasDoc, docVersion]);

  const failed = () => toast.error(t("L'opération a échoué.", "فشلت العملية.", "The operation failed."));

  /** Modifie le document actif (nouvelle version dans le même onglet, avec retour arrière possible) */
  const transform = async (fn: (bytes: ArrayBuffer) => Promise<Uint8Array>, done?: string) => {
    const w = workspace.current;
    if (!w || busy) return false;
    setBusy(true);
    try {
      const cur = await w.exportActive();
      if (!cur) return false;
      const previous = cur.buffer.slice(0);
      const out = await fn(cur.buffer);
      const stack = (undoStack.current[cur.name] ||= []);
      stack.push(previous);
      if (stack.length > 15) stack.shift();
      redoStack.current[cur.name] = [];
      await w.replaceActive(toArrayBuffer(out), cur.name);
      setUndoTick((x) => x + 1);
      if (done) toast.success(done);
      return true;
    } catch (e) {
      console.error(e);
      failed();
      return false;
    } finally {
      setBusy(false);
    }
  };

  /** Crée de nouveaux documents (onglets) à partir du document actif */
  const derive = async (fn: (bytes: ArrayBuffer, name: string) => Promise<{ bytes: Uint8Array; name: string }[]>) => {
    const w = workspace.current;
    if (!w || busy) return;
    setBusy(true);
    try {
      const cur = await w.exportActive();
      if (!cur) return;
      const outs = await fn(cur.buffer, stripPdf(cur.name));
      for (const o of outs) await w.openBuffer(toArrayBuffer(o.bytes), o.name);
      toast.success(t(`${outs.length} document(s) ouvert(s) dans de nouveaux onglets`, `فتحت ${outs.length} وثيقة في تبويبات جديدة`, `${outs.length} document(s) opened in new tabs`));
    } catch (e) {
      console.error(e);
      failed();
    } finally {
      setBusy(false);
    }
  };

  const canUndo = !!(activeName && undoStack.current[activeName]?.length);
  const canRedo = !!(activeName && redoStack.current[activeName]?.length);
  /** Revient à une version enregistrée (annuler ou rétablir une opération sur les pages) */
  const stepHistory = async (from: Record<string, ArrayBuffer[]>, to: Record<string, ArrayBuffer[]>) => {
    const w = workspace.current;
    if (!w || !activeName || busy) return;
    const prev = from[activeName]?.pop();
    if (!prev) return;
    setBusy(true);
    try {
      const cur = await w.exportActive();
      if (cur) (to[activeName] ||= []).push(cur.buffer.slice(0));
      await w.replaceActive(prev, activeName);
      setUndoTick((x) => x + 1);
    } catch (e) {
      console.error(e);
      failed();
    } finally {
      setBusy(false);
    }
  };

  /* Annuler / rétablir unifiés : d'abord les annotations du visualiseur, puis les opérations sur le document */
  const viewerCan = (cmd: string) => {
    const s = ws?.commandState(cmd);
    return !!s && !s.disabled;
  };
  const undoAny = () => {
    if (viewerCan("history:undo")) ws?.runCommand("history:undo");
    else if (canUndo) void stepHistory(undoStack.current, redoStack.current);
  };
  const redoAny = () => {
    if (viewerCan("history:redo")) ws?.runCommand("history:redo");
    else if (canRedo) void stepHistory(redoStack.current, undoStack.current);
  };
  const undoReady = hasDoc && !busy && (viewerCan("history:undo") || canUndo);
  const redoReady = hasDoc && !busy && (viewerCan("history:redo") || canRedo);

  const openReplace = async () => {
    const w = workspace.current;
    if (!w || !hasDoc || busy) return;
    if (!accessStore.guard("pdf.edit")) return;
    const [text, cur] = await Promise.all([w.selectedText(), w.exportActive()]);
    if (!cur) return;
    replaceSource.current = cur.buffer;
    setReplaceFind(text.length <= 200 ? text : "");
    setToolDialog("replace");
  };

  const [closeOpen, setCloseOpen] = useState(false);
  const closeActive = async () => {
    const name = activeName;
    setCloseOpen(false);
    try {
      await workspace.current?.closeActive();
      if (name) {
        delete undoStack.current[name];
        delete redoStack.current[name];
        delete originCourse.current[name];
      }
      setSelectedPages(new Set());
      if (docCount <= 1) setTab("home");
      setUndoTick((x) => x + 1);
    } catch (e) {
      console.error(e);
      failed();
    }
  };
  // avec des modifications, on demande confirmation avant de les abandonner
  const requestClose = () => (undoReady ? setCloseOpen(true) : void closeActive());

  const copySelected = async () => {
    try {
      const text = await workspace.current?.copySelection();
      if (text) toast.success(t("Texte copié", "تم نسخ النص", "Text copied"));
      else
        toast.info(t("Aucun texte sélectionné", "لم يتم تحديد أي نص", "No text selected"), {
          description: t(
            "Choisissez l'outil Sélection puis faites glisser sur le texte. Une zone de texte ajoutée se copie en double-cliquant dedans.",
            "اختر أداة التحديد ثم اسحب فوق النص. مربع النص المضاف يُنسخ بالنقر المزدوج داخله.",
            "Pick the Select tool and drag over the text. An added text box is copied by double-clicking inside it."
          ),
        });
    } catch {
      toast.error(t("Copie impossible", "تعذر النسخ", "Copy failed"));
    }
  };

  const shortcuts = useRef({ undoAny, redoAny, openReplace });
  shortcuts.current = { undoAny, redoAny, openReplace };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const target = e.composedPath()[0] as HTMLElement | undefined;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if (document.querySelector("[role=dialog]")) return;
      const key = e.key.toLowerCase();
      if (key === "h" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        void shortcuts.current.openReplace();
      } else if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        shortcuts.current.undoAny();
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        e.stopPropagation();
        shortcuts.current.redoAny();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const sel = [...selectedPages].sort((a, b) => a - b);
  const selOrAll = () => (sel.length ? sel : Array.from({ length: pageTotal }, (_, i) => i));
  const insertAt = () => (sel.length ? sel[sel.length - 1] + 1 : pageTotal);
  const rangeLabel = (idx: number[]) => {
    const n = idx.map((i) => i + 1);
    return n.length === 1 ? `p${n[0]}` : `p${n[0]}-${n[n.length - 1]}`;
  };

  const readFiles = async (list: FileList | null) => Promise.all([...(list || [])].filter((f) => /\.pdf$/i.test(f.name) || f.type === "application/pdf").map((f) => f.arrayBuffer()));

  const applyWatermark = async (v: WatermarkFormValue) => {
    const { addWatermark, parsePageRange } = await pages();
    const image = v.mode === "image" && v.image ? { bytes: await v.image.arrayBuffer(), type: (/png$/i.test(v.image.type) ? "png" : "jpg") as "png" | "jpg" } : undefined;
    const ok = await transform(
      (b) =>
        addWatermark(b, {
          text: v.mode === "text" ? v.text : undefined,
          image,
          imageScale: v.imageScale,
          style: { fontSize: v.fontSize, color: v.color, bold: true },
          opacity: v.opacity,
          rotation: v.rotation,
          position: v.position,
          pages: parsePageRange(v.pages, pageTotal),
        }),
      t("Filigrane ajouté", "تمت إضافة العلامة المائية", "Watermark added")
    );
    if (ok) setToolDialog(null);
  };

  const headerVars = () => ({
    date: new Date().toLocaleDateString(lang === "ar" ? "ar-MA" : lang === "en" ? "en-GB" : "fr-FR"),
    name: user?.name || "",
  });

  const applyHeaderFooter = async (v: HeaderFooterFormValue) => {
    const { addHeaderFooter, parsePageRange } = await pages();
    const ok = await transform(
      (b) => addHeaderFooter(b, { ...v, style: { fontSize: v.fontSize, color: v.color }, margin: v.margin, pages: parsePageRange(v.pages, pageTotal), vars: headerVars() }),
      t("En-tête et pied de page ajoutés", "تمت إضافة الرأس والتذييل", "Header & footer added")
    );
    if (ok) setToolDialog(null);
  };

  const applyPageNumbers = async (v: PageNumbersFormValue) => {
    const { addHeaderFooter, parsePageRange } = await pages();
    const ok = await transform(
      (b) => addHeaderFooter(b, { [v.slot]: v.format, style: { fontSize: v.fontSize, color: "#374151" }, margin: 36, pages: parsePageRange(v.pages, pageTotal), startAt: v.startAt, vars: headerVars() }),
      t("Numéros de page ajoutés", "تمت إضافة أرقام الصفحات", "Page numbers added")
    );
    if (ok) setToolDialog(null);
  };

  const replacer = () => import("@/lib/pdfReplace");
  const replaceOpts = async (v: ReplaceFormValue) => ({ find: v.find, matchCase: v.matchCase, pages: (await pages()).parsePageRange(v.pages, pageTotal) });
  const countReplace = async (v: ReplaceFormValue) => {
    const src = replaceSource.current;
    if (!src) return { total: 0, pages: [] };
    const { countInPdf } = await replacer();
    return countInPdf(src.slice(0), await replaceOpts(v));
  };
  const applyReplace = async (v: ReplaceFormValue) => {
    const { replaceInPdf } = await replacer();
    const opts = await replaceOpts(v);
    let result = { replaced: 0, fallback: 0, failed: 0 };
    const ok = await transform(async (b) => {
      const r = await replaceInPdf(b, { ...opts, replace: v.replace });
      result = r;
      return r.bytes;
    });
    if (!ok) return;
    setToolDialog(null);
    const n = result.replaced;
    toast.success(t(`${n} remplacement(s) effectué(s)`, `تم ${n} استبدال`, `${n} replacement(s) made`), {
      description: result.fallback
        ? t(
            `${result.fallback} avec une police proche : la police d'origine ne contenait pas toutes les lettres.`,
            `${result.fallback} بخط قريب: الخط الأصلي لا يحتوي على كل الحروف.`,
            `${result.fallback} with a similar font: the original font lacked some letters.`
          )
        : result.failed
          ? t(`${result.failed} non remplacé(s) : caractères non pris en charge.`, `${result.failed} لم يُستبدل: أحرف غير مدعومة.`, `${result.failed} not replaced: unsupported characters.`)
          : undefined,
    });
  };

  const applySplit = async (v: { every?: number; at?: number[] }) => {
    const { splitPdf } = await pages();
    await derive(async (b, base) => (await splitPdf(b, v)).map((bytes, k) => ({ bytes, name: `${base} (${t("partie", "جزء", "part")} ${k + 1}).pdf` })));
    setToolDialog(null);
  };

  if (user && user.role !== "professor") return <Navigate to="/dashboard" replace />;

  const recent = pdfs.filter((p) => p.file_path).slice(0, 6);
  const q = pickerQuery.trim().toLowerCase();
  const pickerItems = pdfs.filter(
    (p) => p.file_path && (!q || p.file_name.toLowerCase().includes(q) || (courseById.get(p.course_id)?.title || "").toLowerCase().includes(q))
  );

  const pdfRow = (m: CoursePdf) => {
    const course = courseById.get(m.course_id);
    const room = roomName(course?.room_id);
    return (
      <button
        key={m.id}
        type="button"
        onClick={() => void openCoursePdf(m)}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-start transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex h-9 w-8 shrink-0 items-end justify-center rounded-sm border bg-background pb-1 text-[9px] font-semibold tracking-wide text-muted-foreground">
          PDF
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{m.file_name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {[course?.title, room].filter(Boolean).join(" · ")}
          </span>
        </span>
        {m.file_size ? <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatFileSize(m.file_size)}</span> : null}
      </button>
    );
  };

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className={cn("flex min-h-0 flex-col", board ? "fixed left-0 top-0 z-[60] h-full w-full bg-background" : "h-full")}>
      {/* Ruban */}
      {!board && (
      <RibbonTabs
        value={tab}
        onChange={(id) => {
          const perm = TAB_PERMISSION[id as TabId];
          if (perm && !accessStore.guard(perm)) return;
          setTab(id as TabId);
        }}
        tabs={[
          { id: "home", label: t("Accueil", "الرئيسية", "Home") },
          { id: "comment", label: t("Commentaire", "تعليق", "Comment") },
          { id: "edit", label: t("Modifier", "تعديل", "Edit") },
          { id: "organize", label: t("Organiser", "تنظيم", "Organize") },
          { id: "form", label: t("Formulaire", "نموذج", "Form") },
          { id: "protect", label: t("Protéger", "حماية", "Protect") },
        ]}
        end={
          <>
            {activeName && (
              <span className="hidden max-w-[28vw] truncate text-xs text-muted-foreground xl:inline" title={activeName}>
                {activeName}
              </span>
            )}
            {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2.5 sm:px-3" disabled={!hasDoc} onClick={enterBoard} title={t("Mode tableau : plein écran pour le vidéoprojecteur", "وضع السبورة: ملء الشاشة لجهاز العرض", "Board mode: full screen for the projector")}>
              <MonitorPlay className="h-4 w-4" strokeWidth={1.75} />
              <span className="hidden sm:inline">{t("Mode tableau", "وضع السبورة", "Board mode")}</span>
            </Button>
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2.5 text-muted-foreground hover:text-foreground sm:px-3" disabled={!hasDoc || busy} onClick={requestClose} title={t("Fermer le PDF sans enregistrer", "إغلاق PDF دون حفظ", "Close PDF without saving")}>
              <X className="h-4 w-4" strokeWidth={1.75} />
              <span className="hidden sm:inline">{t("Fermer", "إغلاق", "Close")}</span>
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 px-2.5 sm:px-3" disabled={!hasDoc} onClick={() => ws?.downloadActive()} title={t("Télécharger le PDF", "تحميل PDF", "Download PDF")}>
              <Download className="h-4 w-4" strokeWidth={1.75} />
              <span className="hidden sm:inline">{t("Télécharger", "تحميل", "Download")}</span>
            </Button>
            <Button size="sm" className="h-8 gap-1.5" disabled={!hasDoc || !canUpload || courses.length === 0} onClick={openSaveDialog}>
              <Save className="h-4 w-4" strokeWidth={1.75} />
              <span className="sm:hidden">{t("Enregistrer", "حفظ", "Save")}</span>
              <span className="hidden sm:inline">{t("Enregistrer dans un cours", "حفظ في درس", "Save to a course")}</span>
            </Button>
          </>
        }
      />
      )}
      {!board && (
      <RibbonBar>
        {tab === "home" && (
          <>
            <RibbonGroup label={t("Fichier", "ملف", "File")}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <span>
                    <RibbonButton icon={FolderOpen} label={t("Ouvrir", "فتح", "Open")} menu />
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuItem onSelect={() => fileInput.current?.click()} className="gap-2.5">
                    <HardDrive className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                    {t("Depuis l'ordinateur", "من الحاسوب", "From this device")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setPickerOpen(true)} className="gap-2.5">
                    <FileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                    {t("Depuis mes cours", "من دروسي", "From my courses")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <RibbonButton icon={Download} label={t("Télécharger", "تحميل", "Download")} disabled={!hasDoc} onClick={() => ws?.downloadActive()} />
              <CommandButton ws={ws} command="document:print" icon={Printer} label={t("Imprimer", "طباعة", "Print")} disabled={!hasDoc} />
            </RibbonGroup>
            <RibbonGroup label={t("Outils", "أدوات", "Tools")}>
              <CommandButton ws={ws} command="pan:toggle" icon={Hand} label={t("Main", "يد", "Hand")} disabled={!hasDoc} />
              <CommandButton ws={ws} command="pointer:toggle" icon={MousePointer2} label={t("Sélection", "تحديد", "Select")} disabled={!hasDoc} />
              <CommandButton ws={ws} command="capture:screenshot" icon={Camera} label={t("Capture", "لقطة", "Snapshot")} disabled={!hasDoc} />
            </RibbonGroup>
            <RibbonGroup label={t("Affichage", "العرض", "View")}>
              <CommandButton ws={ws} command="zoom:in" icon={ZoomIn} label={t("Zoom avant", "تكبير", "Zoom in")} disabled={!hasDoc} />
              <CommandButton ws={ws} command="zoom:out" icon={ZoomOut} label={t("Zoom arrière", "تصغير", "Zoom out")} disabled={!hasDoc} />
              <CommandButton ws={ws} command="zoom:fit-width" icon={MoveHorizontal} label={t("Pleine largeur", "ملء العرض", "Fit width")} disabled={!hasDoc} />
              <CommandButton ws={ws} command="rotate:clockwise" icon={RotateCw} label={t("Pivoter la vue", "تدوير العرض", "Rotate view")} disabled={!hasDoc} />
            </RibbonGroup>
            <RibbonGroup label={t("Rechercher", "بحث", "Find")}>
              <RibbonButton icon={Copy} label={t("Copier", "نسخ", "Copy")} title={t("Copier le texte sélectionné (Ctrl+C)", "نسخ النص المحدد (Ctrl+C)", "Copy selected text (Ctrl+C)")} disabled={!hasDoc} onClick={() => void copySelected()} />
              <CommandButton ws={ws} command="panel:toggle-search" icon={Search} label={t("Rechercher", "بحث", "Search")} disabled={!hasDoc} />
              <RibbonButton icon={ReplaceAll} label={t("Remplacer", "استبدال", "Replace")} title={t("Rechercher et remplacer (Ctrl+H)", "بحث واستبدال (Ctrl+H)", "Find and replace (Ctrl+H)")} disabled={!hasDoc || busy} onClick={() => void openReplace()} />
              <CommandButton ws={ws} command="panel:toggle-comment" icon={MessageSquare} label={t("Commentaires", "التعليقات", "Comments")} disabled={!hasDoc} />
            </RibbonGroup>
            <RibbonGroup label={t("Historique", "السجل", "History")}>
              <RibbonButton icon={Undo2} label={t("Annuler", "تراجع", "Undo")} title={t("Annuler (Ctrl+Z)", "تراجع (Ctrl+Z)", "Undo (Ctrl+Z)")} disabled={!undoReady} onClick={undoAny} />
              <RibbonButton icon={Redo2} label={t("Rétablir", "إعادة", "Redo")} title={t("Rétablir (Ctrl+Y)", "إعادة (Ctrl+Y)", "Redo (Ctrl+Y)")} disabled={!redoReady} onClick={redoAny} />
            </RibbonGroup>
          </>
        )}

        {tab === "comment" && (
          <>
            <RibbonGroup label={t("Texte", "النص", "Text")}>
              <CommandButton ws={ws} command="annotation:add-highlight" icon={Highlighter} label={t("Surligner", "تظليل", "Highlight")} />
              <CommandButton ws={ws} command="annotation:add-underline" icon={Underline} label={t("Souligner", "تسطير", "Underline")} />
              <CommandButton ws={ws} command="annotation:add-strikeout" icon={Strikethrough} label={t("Barrer", "شطب", "Strikeout")} />
              <CommandButton ws={ws} command="annotation:add-squiggly" icon={Waves} label={t("Ondulé", "متموج", "Squiggly")} />
              <CommandButton ws={ws} command="annotation:add-insert-text" icon={TextCursorInput} label={t("Insérer du texte", "إدراج نص", "Insert text")} />
              <CommandButton ws={ws} command="annotation:add-replace-text" icon={Replace} label={t("Remplacer", "استبدال", "Replace")} />
            </RibbonGroup>
            <RibbonGroup label={t("Notes", "ملاحظات", "Notes")}>
              <CommandButton ws={ws} command="annotation:add-comment" icon={StickyNote} label={t("Note", "ملاحظة", "Note")} />
              <CommandButton ws={ws} command="annotation:add-text" icon={Type} label={t("Zone de texte", "مربع نص", "Text box")} />
              <CommandButton ws={ws} command="annotation:add-callout" icon={MessageSquareQuote} label={t("Légende", "فقاعة", "Callout")} />
            </RibbonGroup>
            <RibbonGroup label={t("Dessin", "الرسم", "Drawing")}>
              <CommandButton ws={ws} command="annotation:add-ink" icon={PenLine} label={t("Crayon", "قلم", "Pencil")} />
              <CommandButton ws={ws} command="annotation:add-ink-highlighter" icon={Brush} label={t("Surligneur", "قلم تظليل", "Marker")} />
              <CommandButton ws={ws} command="annotation:add-rectangle" icon={Square} label={t("Rectangle", "مستطيل", "Rectangle")} />
              <CommandButton ws={ws} command="annotation:add-circle" icon={Circle} label={t("Ovale", "دائرة", "Oval")} />
              <CommandButton ws={ws} command="annotation:add-line" icon={Minus} label={t("Ligne", "خط", "Line")} />
              <CommandButton ws={ws} command="annotation:add-arrow" icon={ArrowUpRight} label={t("Flèche", "سهم", "Arrow")} />
              <CommandButton ws={ws} command="annotation:add-polygon" icon={Pentagon} label={t("Polygone", "مضلع", "Polygon")} />
              <CommandButton ws={ws} command="annotation:add-polyline" icon={Spline} label={t("Polyligne", "خط متعدد", "Polyline")} />
            </RibbonGroup>
            <RibbonGroup label={t("Gérer", "إدارة", "Manage")}>
              <CommandButton ws={ws} command="panel:toggle-annotation-style" icon={Palette} label={t("Style", "النمط", "Style")} />
              <CommandButton ws={ws} command="panel:toggle-comment" icon={MessageSquare} label={t("Commentaires", "التعليقات", "Comments")} />
              <CommandButton ws={ws} command="annotation:delete-selected" icon={Trash2} label={t("Supprimer", "حذف", "Delete")} />
              <RibbonButton icon={Undo2} label={t("Annuler", "تراجع", "Undo")} title={t("Annuler (Ctrl+Z)", "تراجع (Ctrl+Z)", "Undo (Ctrl+Z)")} disabled={!undoReady} onClick={undoAny} />
              <RibbonButton icon={Redo2} label={t("Rétablir", "إعادة", "Redo")} title={t("Rétablir (Ctrl+Y)", "إعادة (Ctrl+Y)", "Redo (Ctrl+Y)")} disabled={!redoReady} onClick={redoAny} />
            </RibbonGroup>
          </>
        )}

        {tab === "edit" && (
          <>
            <RibbonGroup label={t("Texte", "النص", "Text")}>
              <RibbonButton
                icon={PencilLine}
                label={t("Modifier le texte", "تعديل النص", "Edit text")}
                title={t("Sélectionnez un texte puis cliquez ici pour le remplacer", "حدد نصاً ثم انقر هنا لاستبداله", "Select text, then click here to replace it")}
                disabled={!hasDoc || busy}
                onClick={() => void openReplace()}
              />
              <RibbonButton icon={ReplaceAll} label={t("Remplacer", "استبدال", "Replace")} title={t("Rechercher et remplacer (Ctrl+H)", "بحث واستبدال (Ctrl+H)", "Find and replace (Ctrl+H)")} disabled={!hasDoc || busy} onClick={() => void openReplace()} />
              <CommandButton ws={ws} command="annotation:add-text" icon={Type} label={t("Ajouter du texte", "إضافة نص", "Add text")} />
            </RibbonGroup>
            <RibbonGroup label={t("Insérer", "إدراج", "Insert")}>
              <CommandButton ws={ws} command="insert:add-image" icon={ImagePlus} label={t("Image", "صورة", "Image")} />
              <CommandButton ws={ws} command="insert:add-signature" icon={Signature} label={t("Signature", "توقيع", "Signature")} />
              <CommandButton ws={ws} command="insert:add-rubber-stamp" icon={Stamp} label={t("Tampon", "ختم", "Stamp")} />
              <CommandButton ws={ws} command="annotation:add-link" icon={Link2} label={t("Lien", "رابط", "Link")} />
              <CommandButton ws={ws} command="insert:add-attachment" icon={Paperclip} label={t("Pièce jointe", "مرفق", "Attachment")} />
            </RibbonGroup>
            <RibbonGroup label={t("Mise en page", "التنسيق", "Page design")}>
              <RibbonButton icon={Droplet} label={t("Filigrane", "علامة مائية", "Watermark")} disabled={!hasDoc || busy} onClick={() => accessStore.guard("pdf.layout") && setToolDialog("watermark")} />
              <RibbonButton icon={Eraser} label={t("Supprimer un filigrane", "حذف علامة مائية", "Remove watermark")} disabled={!hasDoc || busy} onClick={() => accessStore.guard("pdf.watermark_remove") && setCleanOpen(true)} />
              <RibbonButton icon={PanelTop} label={t("En-tête / pied", "رأس / تذييل", "Header / footer")} disabled={!hasDoc || busy} onClick={() => accessStore.guard("pdf.layout") && setToolDialog("headerFooter")} />
              <RibbonButton icon={Hash} label={t("Numéros de page", "ترقيم الصفحات", "Page numbers")} disabled={!hasDoc || busy} onClick={() => accessStore.guard("pdf.layout") && setToolDialog("pageNumbers")} />
            </RibbonGroup>
            <RibbonGroup label={t("Historique", "السجل", "History")}>
              <RibbonButton icon={Undo2} label={t("Annuler", "تراجع", "Undo")} title={t("Annuler (Ctrl+Z)", "تراجع (Ctrl+Z)", "Undo (Ctrl+Z)")} disabled={!undoReady} onClick={undoAny} />
              <RibbonButton icon={Redo2} label={t("Rétablir", "إعادة", "Redo")} title={t("Rétablir (Ctrl+Y)", "إعادة (Ctrl+Y)", "Redo (Ctrl+Y)")} disabled={!redoReady} onClick={redoAny} />
            </RibbonGroup>
          </>
        )}

        {tab === "organize" && (
          <>
            <RibbonGroup label={t("Insérer", "إدراج", "Insert")}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild disabled={!hasDoc || busy}>
                  <span>
                    <RibbonButton icon={FilePlus2} label={t("Insérer", "إدراج", "Insert")} menu disabled={!hasDoc || busy} />
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-60">
                  <DropdownMenuItem
                    className="gap-2.5"
                    onSelect={() => void transform(async (b) => (await pages()).insertBlankPage(b, insertAt()), t("Page blanche insérée", "تم إدراج صفحة فارغة", "Blank page inserted"))}
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                    {t("Page blanche", "صفحة فارغة", "Blank page")}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2.5" onSelect={() => insertInput.current?.click()}>
                    <HardDrive className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                    {t("Pages d'un autre PDF…", "صفحات من PDF آخر…", "Pages from another PDF…")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <RibbonButton icon={Combine} label={t("Fusionner des PDF", "دمج ملفات PDF", "Merge PDFs")} disabled={!hasDoc || busy} onClick={() => mergeInput.current?.click()} />
            </RibbonGroup>
            <RibbonGroup label={t("Pages", "الصفحات", "Pages")}>
              <RibbonButton
                icon={Trash2}
                label={t("Supprimer", "حذف", "Delete")}
                disabled={!sel.length || sel.length >= pageTotal || busy}
                onClick={() => void transform(async (b) => (await pages()).deletePages(b, sel), t(`${sel.length} page(s) supprimée(s)`, `تم حذف ${sel.length} صفحة`, `${sel.length} page(s) deleted`))}
              />
              <RibbonButton
                icon={FileOutput}
                label={t("Extraire", "استخراج", "Extract")}
                disabled={!sel.length || busy}
                onClick={() => void derive(async (b, base) => [{ bytes: await (await pages()).extractPages(b, sel), name: `${base} (${rangeLabel(sel)}).pdf` }])}
              />
              <RibbonButton
                icon={Copy}
                label={t("Dupliquer", "تكرار", "Duplicate")}
                disabled={!sel.length || busy}
                onClick={() => void transform(async (b) => (await pages()).duplicatePages(b, sel))}
              />
              <RibbonButton
                icon={RotateCcw}
                label={t("Pivoter à gauche", "تدوير لليسار", "Rotate left")}
                disabled={!hasDoc || busy}
                onClick={() => void transform(async (b) => (await pages()).rotatePages(b, selOrAll(), -90))}
              />
              <RibbonButton
                icon={RotateCw}
                label={t("Pivoter à droite", "تدوير لليمين", "Rotate right")}
                disabled={!hasDoc || busy}
                onClick={() => void transform(async (b) => (await pages()).rotatePages(b, selOrAll(), 90))}
              />
            </RibbonGroup>
            <RibbonGroup label={t("Document", "الوثيقة", "Document")}>
              <RibbonButton icon={Scissors} label={t("Scinder", "تقسيم", "Split")} disabled={pageTotal < 2 || busy} onClick={() => setToolDialog("split")} />
              <RibbonButton
                icon={ListChecks}
                label={t("Tout sélectionner", "تحديد الكل", "Select all")}
                disabled={!thumbs.length}
                onClick={() => setSelectedPages(new Set(thumbs.map((_, i) => i)))}
              />
              <RibbonButton icon={Undo2} label={t("Annuler", "تراجع", "Undo")} title={t("Annuler (Ctrl+Z)", "تراجع (Ctrl+Z)", "Undo (Ctrl+Z)")} disabled={!undoReady} onClick={undoAny} />
              <RibbonButton icon={Redo2} label={t("Rétablir", "إعادة", "Redo")} title={t("Rétablir (Ctrl+Y)", "إعادة (Ctrl+Y)", "Redo (Ctrl+Y)")} disabled={!redoReady} onClick={redoAny} />
            </RibbonGroup>
          </>
        )}

        {tab === "form" && (
          <>
            <RibbonGroup label={t("Champs", "الحقول", "Fields")}>
              <CommandButton ws={ws} command="form:add-textfield" icon={TextCursorInput} label={t("Champ texte", "حقل نص", "Text field")} />
              <CommandButton ws={ws} command="form:add-checkbox" icon={SquareCheck} label={t("Case à cocher", "خانة اختيار", "Checkbox")} />
              <CommandButton ws={ws} command="form:add-radio" icon={CircleDot} label={t("Bouton radio", "زر اختيار", "Radio button")} />
              <CommandButton ws={ws} command="form:add-select" icon={ChevronDownSquare} label={t("Liste déroulante", "قائمة منسدلة", "Dropdown")} />
              <CommandButton ws={ws} command="form:add-listbox" icon={List} label={t("Zone de liste", "قائمة", "List box")} />
            </RibbonGroup>
            <RibbonGroup label={t("Remplir", "ملء", "Fill")}>
              <CommandButton ws={ws} command="form:toggle-fill-mode" icon={PencilLine} label={t("Mode remplissage", "وضع الملء", "Fill mode")} />
              <CommandButton ws={ws} command="insert:add-signature" icon={Signature} label={t("Signer", "توقيع", "Sign")} />
            </RibbonGroup>
          </>
        )}

        {tab === "protect" && (
          <>
            <RibbonGroup label={t("Masquage", "الإخفاء", "Redaction")}>
              <CommandButton ws={ws} command="redaction:redact-text" icon={TextSelect} label={t("Masquer du texte", "إخفاء نص", "Redact text")} />
              <CommandButton ws={ws} command="redaction:redact-area" icon={SquareDashed} label={t("Masquer une zone", "إخفاء منطقة", "Redact area")} />
              <CommandButton ws={ws} command="panel:toggle-redaction" icon={PanelRight} label={t("Liste", "القائمة", "List")} />
              <CommandButton ws={ws} command="redaction:apply-all" icon={CheckCheck} label={t("Appliquer tout", "تطبيق الكل", "Apply all")} />
              <CommandButton ws={ws} command="redaction:clear-all" icon={X} label={t("Tout effacer", "مسح الكل", "Clear all")} />
            </RibbonGroup>
            <RibbonGroup label={t("Sécurité", "الأمان", "Security")}>
              <CommandButton ws={ws} command="document:protect" icon={Lock} label={t("Mot de passe", "كلمة المرور", "Password")} />
              <RibbonButton icon={Eraser} label={t("Supprimer un filigrane", "حذف علامة مائية", "Remove watermark")} disabled={!hasDoc || busy} onClick={() => accessStore.guard("pdf.watermark_remove") && setCleanOpen(true)} />
            </RibbonGroup>
          </>
        )}
      </RibbonBar>
      )}

      <input
        ref={fileInput}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void openLocalFile(f);
        }}
      />
      <input
        ref={insertInput}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = await readFiles(e.target.files);
          e.target.value = "";
          if (files.length) void transform(async (b) => (await pages()).insertFromPdf(b, files, insertAt()), t("Pages insérées", "تم إدراج الصفحات", "Pages inserted"));
        }}
      />
      <input
        ref={mergeInput}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = await readFiles(e.target.files);
          e.target.value = "";
          if (files.length) void transform(async (b) => (await pages()).insertFromPdf(b, files, pageTotal), t(`${files.length} PDF ajouté(s) à la fin`, `تمت إضافة ${files.length} ملف في النهاية`, `${files.length} PDF(s) appended`));
        }}
      />

      {/* Espace de travail */}
      <div className="relative min-h-0 flex-1">
        <PdfWorkspace ref={workspace} language={lang} dark={dark} author={user?.name} onDocumentsChange={onDocumentsChange} />

        {board && hasDoc && (
          <div
            className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-2xl border bg-background/95 p-1.5 shadow-xl backdrop-blur"
            role="toolbar"
            aria-label={t("Outils du tableau", "أدوات السبورة", "Board tools")}
          >
            {([
              { cmd: "annotation:add-ink", icon: PenLine, label: t("Stylo", "قلم", "Pen") },
              { cmd: "annotation:add-ink-highlighter", icon: Highlighter, label: t("Surligneur", "قلم تمييز", "Highlighter") },
              { cmd: "pan:toggle", icon: Hand, label: t("Déplacer", "تحريك", "Pan") },
            ] as const).map((b) => {
              const st = ws?.commandState(b.cmd);
              return (
                <Button
                  key={b.cmd}
                  size="icon"
                  variant={st?.active ? "default" : "ghost"}
                  className="h-11 w-11"
                  onClick={() => ws?.runCommand(b.cmd)}
                  title={b.label}
                  aria-label={b.label}
                  aria-pressed={!!st?.active}
                >
                  <b.icon className="h-5 w-5" />
                </Button>
              );
            })}
            <Button size="icon" variant="ghost" className="h-11 w-11" onClick={() => ws?.runCommand("annotation:delete-selected")} title={t("Effacer l'élément sélectionné", "حذف العنصر المحدد", "Erase selected item")} aria-label={t("Effacer", "مسح", "Erase")}>
              <Eraser className="h-5 w-5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-11 w-11" onClick={() => ws?.runCommand("history:undo")} title={t("Annuler", "تراجع", "Undo")} aria-label={t("Annuler", "تراجع", "Undo")}>
              <Undo2 className="h-5 w-5" />
            </Button>
            <span className="mx-1 h-7 w-px bg-border" aria-hidden="true" />
            <Button size="icon" variant="ghost" className="h-11 w-11" onClick={() => ws?.runCommand("zoom:out")} title={t("Zoom arrière", "تصغير", "Zoom out")} aria-label={t("Zoom arrière", "تصغير", "Zoom out")}>
              <ZoomOut className="h-5 w-5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-11 w-11" onClick={() => ws?.runCommand("zoom:fit-width")} title={t("Pleine largeur", "ملء العرض", "Fit width")} aria-label={t("Pleine largeur", "ملء العرض", "Fit width")}>
              <MoveHorizontal className="h-5 w-5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-11 w-11" onClick={() => ws?.runCommand("zoom:in")} title={t("Zoom avant", "تكبير", "Zoom in")} aria-label={t("Zoom avant", "تكبير", "Zoom in")}>
              <ZoomIn className="h-5 w-5" />
            </Button>
            <span className="mx-1 h-7 w-px bg-border" aria-hidden="true" />
            <Button size="sm" variant="outline" className="h-11 gap-1.5" onClick={exitBoard} title={t("Quitter le mode tableau (Échap)", "الخروج من وضع السبورة (Esc)", "Exit board mode (Esc)")}>
              <Minimize2 className="h-4 w-4" />
              <span className="hidden sm:inline">{t("Quitter", "خروج", "Exit")}</span>
            </Button>
          </div>
        )}

        {!hasDoc && (
          <div
            className="absolute inset-0 z-10 overflow-y-auto bg-background"
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
              <p className="eyebrow">{t("Outils", "الأدوات", "Tools")}</p>
              <h1 className="page-title mt-1">{t("Éditeur PDF", "محرر PDF", "PDF editor")}</h1>
              <p className="page-description mt-1.5 max-w-xl">
                {t(
                  "Annotez, surlignez, écrivez, signez et masquez des passages de vos documents, puis joignez le résultat à un cours.",
                  "علّق على وثائقك وظلّل واكتب وأمضِ وأخفِ مقاطع منها، ثم أرفق النتيجة بدرس.",
                  "Annotate, highlight, write on, sign and redact your documents, then attach the result to a course."
                )}
              </p>

              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={opening}
                className={cn(
                  "mt-8 flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card px-6 py-12 text-center transition-colors hover:border-foreground/30 hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  dragging && "border-primary bg-accent"
                )}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border bg-background text-muted-foreground">
                  {opening ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" strokeWidth={1.75} />}
                </span>
                <span className="text-sm font-medium">
                  {t("Glissez un PDF ici ou choisissez un fichier", "اسحب ملف PDF هنا أو اختر ملفا", "Drop a PDF here or choose a file")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("Le fichier reste sur votre appareil tant que vous ne l'enregistrez pas.", "يبقى الملف على جهازك ما لم تحفظه.", "The file stays on your device until you save it.")}
                </span>
              </button>

              <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-muted-foreground sm:grid-cols-3">
                {[
                  t("Texte, notes et commentaires", "نصوص وملاحظات وتعليقات", "Text, notes and comments"),
                  t("Surlignage, soulignement, barré", "تظليل وتسطير وشطب", "Highlight, underline, strike"),
                  t("Formes, flèches, dessin libre", "أشكال وأسهم ورسم حر", "Shapes, arrows, freehand"),
                  t("Signature, images, tampons", "التوقيع والصور والأختام", "Signature, images, stamps"),
                  t("Masquage définitif", "إخفاء نهائي", "Permanent redaction"),
                  t("Champs de formulaire", "حقول النماذج", "Form fields"),
                ].map((label) => (
                  <li key={label} className="flex items-center gap-2">
                    <span className="h-1 w-1 shrink-0 rounded-full bg-foreground/40" aria-hidden="true" />
                    {label}
                  </li>
                ))}
              </ul>

              <div className="mt-10">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-medium">{t("PDF de vos cours", "ملفات PDF في دروسك", "PDFs from your courses")}</h2>
                  {pdfs.length > recent.length && (
                    <button type="button" onClick={() => setPickerOpen(true)} className="text-sm text-muted-foreground hover:text-foreground">
                      {t("Tout voir", "عرض الكل", "View all")} ({pdfs.length})
                    </button>
                  )}
                </div>
                <div className="rounded-xl border bg-card p-1">
                  {pdfsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : recent.length ? (
                    recent.map(pdfRow)
                  ) : (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                      {t("Aucun PDF dans vos cours pour le moment.", "لا توجد ملفات PDF في دروسك حاليا.", "No PDF in your courses yet.")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {hasDoc && tab === "organize" && (
          <div className="absolute inset-0 z-[5]">
            <PageOrganizer
              thumbnails={thumbs}
              loading={thumbsLoading}
              selected={selectedPages}
              onSelectionChange={setSelectedPages}
              busy={busy}
              t={t}
              onReorder={(order) => void transform(async (b) => (await pages()).reorderPages(b, order))}
              onRotate={(idx, d) => void transform(async (b) => (await pages()).rotatePages(b, idx, d))}
              onDelete={(idx) => idx.length < pageTotal && void transform(async (b) => (await pages()).deletePages(b, idx))}
            />
          </div>
        )}

        {hasDoc && opening && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Choisir un PDF d'un cours */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-lg gap-0 p-0">
          <DialogHeader className="space-y-1 border-b p-5">
            <DialogTitle>{t("Ouvrir un PDF de vos cours", "فتح PDF من دروسك", "Open a PDF from your courses")}</DialogTitle>
            <DialogDescription>{t("Le document original n'est pas modifié.", "لا يتم تعديل الوثيقة الأصلية.", "The original document is not changed.")}</DialogDescription>
          </DialogHeader>
          <div className="border-b p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder={t("Rechercher un fichier ou un cours", "ابحث عن ملف أو درس", "Search a file or course")}
                className="ps-9"
              />
            </div>
          </div>
          <div className="max-h-[50vh] overflow-y-auto p-1">
            {pickerItems.length ? (
              pickerItems.map(pdfRow)
            ) : (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">{t("Aucun résultat.", "لا توجد نتائج.", "No results.")}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {toolDialog === "watermark" && <AddWatermarkDialog open onOpenChange={(o) => !o && setToolDialog(null)} onApply={(v) => void applyWatermark(v)} busy={busy} total={pageTotal} t={t} />}
      {toolDialog === "headerFooter" && <HeaderFooterDialog open onOpenChange={(o) => !o && setToolDialog(null)} onApply={(v) => void applyHeaderFooter(v)} busy={busy} total={pageTotal} t={t} />}
      {toolDialog === "pageNumbers" && <PageNumbersDialog open onOpenChange={(o) => !o && setToolDialog(null)} onApply={(v) => void applyPageNumbers(v)} busy={busy} total={pageTotal} t={t} />}
      {toolDialog === "replace" && (
        <ReplaceDialog open onOpenChange={(o) => !o && setToolDialog(null)} onApply={(v) => void applyReplace(v)} count={countReplace} initialFind={replaceFind} busy={busy} total={pageTotal} t={t} />
      )}
      {toolDialog === "split" && <SplitDialog open onOpenChange={(o) => !o && setToolDialog(null)} onApply={(v) => void applySplit(v)} busy={busy} total={pageTotal} t={t} />}

      <WatermarkDialog
        open={cleanOpen}
        onOpenChange={setCleanOpen}
        t={t}
        getPdf={() => workspace.current?.exportActive() ?? Promise.resolve(null)}
        onResult={async (bytes, name, removed) => {
          const origin = activeName ? originCourse.current[activeName] : undefined;
          if (origin) originCourse.current[name] = origin;
          const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
          await workspace.current?.openBuffer(buffer, name);
          toast.success(t("Filigrane retiré", "تم حذف العلامة المائية", "Watermark removed"), {
            description: t(`${removed} élément(s) retiré(s). Le résultat est ouvert dans un nouvel onglet.`, `تم حذف ${removed} عنصر. فتحت النتيجة في تبويب جديد.`, `${removed} element(s) removed. The result is open in a new tab.`),
          });
        }}
      />

      {/* Enregistrer dans un cours */}
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Fermer sans enregistrer ?", "إغلاق دون حفظ؟", "Close without saving?")}</DialogTitle>
            <DialogDescription>
              {t(
                `Les modifications faites sur « ${activeName || ""} » seront perdues. Le fichier d'origine n'est pas modifié.`,
                `ستضيع التعديلات على « ${activeName || ""} ». الملف الأصلي لن يتغير.`,
                `Changes made to “${activeName || ""}” will be lost. The original file is not changed.`
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCloseOpen(false)}>
              {t("Continuer à modifier", "متابعة التعديل", "Keep editing")}
            </Button>
            <Button variant="destructive" onClick={() => void closeActive()}>
              {t("Fermer sans enregistrer", "إغلاق دون حفظ", "Close without saving")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={saveOpen} onOpenChange={(o) => !saving && setSaveOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Enregistrer dans un cours", "حفظ في درس", "Save to a course")}</DialogTitle>
            <DialogDescription>
              {t(
                "Le PDF modifié est ajouté comme nouveau document du cours. L'original reste inchangé.",
                "يضاف ملف PDF المعدل كوثيقة جديدة في الدرس. يبقى الأصل كما هو.",
                "The edited PDF is added as a new course document. The original stays unchanged."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("Cours", "الدرس", "Course")}</Label>
              <Select value={saveCourseId} onValueChange={setSaveCourseId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("Choisir un cours", "اختر درسا", "Choose a course")} />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {[c.title, roomName(c.room_id)].filter(Boolean).join(" · ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pdf-save-name">{t("Nom du fichier", "اسم الملف", "File name")}</Label>
              <div className="flex items-center gap-2">
                <Input id="pdf-save-name" value={saveName} onChange={(e) => setSaveName(e.target.value)} />
                <span className="text-sm text-muted-foreground">.pdf</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)} disabled={saving}>
              {t("Annuler", "إلغاء", "Cancel")}
            </Button>
            <Button onClick={() => void saveToCourse()} disabled={saving || !saveCourseId}>
              {saving && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
              {t("Enregistrer", "حفظ", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PdfEditor;

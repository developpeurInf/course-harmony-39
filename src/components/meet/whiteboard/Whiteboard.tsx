"use client";

/**
 * Tableau blanc de la réunion (plein cadre) et annotation de l'écran partagé.
 */
import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Check,
  Download,
  Eye,
  Grid3x3,
  ImagePlus,
  Lock,
  LockOpen,
  Maximize,
  MonitorDown,
  MoreHorizontal,
  PenLine,
  Redo2,
  Trash2,
  Undo2,
  Video,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { SCREEN_W, type BoardTheme, type Paper, type WbStore } from "./model";
import { THEMES, bounds, renderToCanvas, union } from "./render";
import { useTools } from "./tools";
import { WbCanvas, type WbCanvasHandle } from "./WbCanvas";
import { TOOL_KEYS, WbToolbar } from "./WbToolbar";
import type { Tr } from "../useTr";

function useIsNarrow() {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setM(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return m;
}

function useStoreState(store: WbStore) {
  useSyncExternalStore(store.subscribeState, store.getStateVersion, store.getStateVersion);
  return store.state;
}

/** Image choisie / collée : réduite pour circuler vite dans la réunion */
export async function prepareImage(blob: Blob, max = 1600): Promise<{ src: string; w: number; h: number }> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = ko;
      i.src = url;
    });
    return canvasToImage(img, img.naturalWidth, img.naturalHeight, max, blob.type === "image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function canvasToImage(src: CanvasImageSource, w0: number, h0: number, max = 1600, png = false) {
  const k = Math.min(1, max / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * k)),
    h = Math.max(1, Math.round(h0 * k));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  if (!png) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(src, 0, 0, w, h);
  let data = png ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.85);
  if (data.length > 1_400_000) data = c.toDataURL("image/jpeg", 0.7);
  return { src: data, w, h };
}

function download(canvas: HTMLCanvasElement, name: string) {
  canvas.toBlob(b => {
    if (!b) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, "image/png");
}

const PAPERS: { id: Paper; fr: string; ar: string; en: string }[] = [
  { id: "blank", fr: "Uni", ar: "فارغ", en: "Plain" },
  { id: "dots", fr: "Points", ar: "نقاط", en: "Dots" },
  { id: "grid", fr: "Quadrillage", ar: "مربعات", en: "Grid" },
  { id: "lines", fr: "Lignes", ar: "أسطر", en: "Lines" },
  { id: "seyes", fr: "Seyès (cahier)", ar: "دفتر مدرسي (سييس)", en: "Seyès (French ruled)" },
];
const BOARD_THEMES: { id: BoardTheme; fr: string; ar: string; en: string }[] = [
  { id: "light", fr: "Blanc", ar: "أبيض", en: "White" },
  { id: "slate", fr: "Ardoise", ar: "أردواز", en: "Slate" },
  { id: "chalk", fr: "Tableau vert", ar: "سبورة خضراء", en: "Chalkboard" },
];

// ======================================================================== tableau
export const WhiteboardBoard = memo(function WhiteboardBoard(props: {
  store: WbStore;
  tr: Tr;
  title: string;
  /** professeur : ferme pour tous ; élève : revient à la vidéo */
  onClose: () => void;
  /** capture de l'écran partagé (avec ses annotations) */
  captureScreen?: (() => Promise<{ src: string; w: number; h: number } | null>) | null;
}) {
  const { store, tr } = props;
  const st = useStoreState(store);
  useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
  const narrow = useIsNarrow();
  const [tools, setTools] = useTools("board");
  const [follow, setFollow] = useState(true);
  const [zoom, setZoom] = useState(1);
  const canvas = useRef<WbCanvasHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canWrite = store.canWrite;
  const host = store.isHost;

  // l'élève qui obtient le droit d'écrire arrête de suivre la vue (il navigue lui-même)
  useEffect(() => {
    if (!host && st.allow) toast(tr("Le professeur vous permet d'écrire au tableau", "سمح لك الأستاذ بالكتابة على اللوحة", "The teacher lets you write on the board"));
  }, [st.allow, host, tr]);

  const insertBlob = useCallback(
    async (b: Blob) => {
      try {
        const img = await prepareImage(b);
        canvas.current?.insertImage(img.src, img.w, img.h);
        setTools({ tool: "select" });
      } catch {
        toast.error(tr("Image illisible", "صورة غير صالحة", "Unreadable image"));
      }
    },
    [setTools, tr],
  );

  // clavier : outils 0-9, annuler / rétablir
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (!canWrite) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "z") {
        e.preventDefault();
        if (e.shiftKey) store.redo("board");
        else store.undo("board");
        return;
      }
      if ((e.ctrlKey || e.metaKey) && k === "y") {
        e.preventDefault();
        store.redo("board");
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (TOOL_KEYS[e.key]) setTools({ tool: TOOL_KEYS[e.key] });
      else if (e.key === "0") fileRef.current?.click();
    };
    // coller une image ou du texte
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement;
      if (!canWrite || t?.closest("input, textarea, [contenteditable=true]")) return;
      const item = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith("image/"));
      const f = item?.getAsFile();
      if (f) {
        e.preventDefault();
        void insertBlob(f);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
    };
  }, [canWrite, store, setTools, insertBlob]);

  const exportPng = () => {
    const els = store.list("board").filter(e => !e.exp);
    const box = union(els.map(bounds));
    if (!box) {
      toast(tr("Le tableau est vide", "اللوحة فارغة", "The board is empty"));
      return;
    }
    const c = renderToCanvas(els, st.theme, st.paper, box, 2);
    const d = new Date();
    download(c, `tableau-${props.title.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 40)}-${d.getHours()}h${String(d.getMinutes()).padStart(2, "0")}.png`);
  };

  const insertScreen = async () => {
    const img = await props.captureScreen?.();
    if (!img) {
      toast.error(tr("Aucun écran partagé à copier", "لا توجد شاشة مشتركة للنسخ", "No shared screen to copy"));
      return;
    }
    canvas.current?.insertImage(img.src, img.w, img.h);
    setTools({ tool: "pen" });
  };

  const theme = THEMES[st.theme];
  const lightBoard = st.theme === "light";
  const chip = lightBoard ? "bg-white/90 text-slate-800 ring-black/10" : "bg-[#151b27]/90 text-white ring-white/10";
  const empty = store.isEmpty("board");

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-2xl ring-1 ring-white/10 sm:rounded-3xl"
      style={{ background: theme.bg }}
      onDragOver={e => canWrite && e.preventDefault()}
      onDrop={e => {
        if (!canWrite) return;
        const f = Array.from(e.dataTransfer.files).find(x => x.type.startsWith("image/"));
        if (f) {
          e.preventDefault();
          void insertBlob(f);
        }
      }}
    >
      <WbCanvas
        ref={canvas}
        store={store}
        layer="board"
        variant="board"
        tools={tools}
        active={canWrite}
        tr={tr}
        follow={!host && follow}
        onUserNavigate={() => setFollow(false)}
        onZoom={setZoom}
      />

      {/* invitation quand le tableau est vide */}
      {empty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div className={cn("max-w-sm text-center", lightBoard ? "text-slate-400" : "text-white/35")}>
            <PenLine className="mx-auto mb-3 h-9 w-9 opacity-60" />
            <p className="text-base font-semibold">
              {canWrite ? tr("Écrivez, dessinez, collez une image…", "اكتب، ارسم، الصق صورة…", "Write, draw, paste an image…") : tr("Le professeur va écrire ici", "سيكتب الأستاذ هنا", "The teacher will write here")}
            </p>
            {canWrite && (
              <p className="mt-1 text-xs">
                {tr("Molette : défiler · Ctrl + molette ou deux doigts : zoomer", "العجلة: تمرير · Ctrl + العجلة أو إصبعان: تكبير", "Wheel: scroll · Ctrl + wheel or two fingers: zoom")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* en-tête : titre et droits */}
      <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-2 sm:inset-x-3 sm:top-3">
        <div className={cn("pointer-events-auto flex min-w-0 items-center gap-2 rounded-2xl px-2 py-1.5 shadow-lg ring-1 backdrop-blur", chip)}>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <PenLine className="h-4 w-4" />
          </span>
          <div className="min-w-0 pe-1">
            <p className="truncate text-xs font-semibold leading-tight">{tr("Tableau blanc", "السبورة البيضاء", "Whiteboard")}</p>
            <p className="truncate text-[10px] leading-tight opacity-60">
              {host
                ? st.allow
                  ? tr("Tout le monde peut écrire", "يمكن للجميع الكتابة", "Everyone can write")
                  : tr("Vous seul écrivez", "أنت وحدك تكتب", "Only you can write")
                : canWrite
                  ? tr("Vous pouvez écrire", "يمكنك الكتابة", "You can write")
                  : tr("Lecture seule", "قراءة فقط", "View only")}
            </p>
          </div>
          {host && (
            <button
              type="button"
              onClick={() => store.setState({ allow: !st.allow })}
              className={cn(
                "flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold transition",
                st.allow ? "bg-emerald-500 text-white" : lightBoard ? "bg-slate-900/5 hover:bg-slate-900/10" : "bg-white/10 hover:bg-white/15",
              )}
              title={tr("Autoriser les élèves à écrire", "السماح للتلاميذ بالكتابة", "Let students write")}
            >
              {st.allow ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{tr("Élèves", "التلاميذ", "Students")}</span>
            </button>
          )}
          {!host && !follow && (
            <button
              type="button"
              onClick={() => setFollow(true)}
              className="flex h-7 shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground"
            >
              <Eye className="h-3.5 w-3.5" />
              {tr("Suivre le prof", "تتبع الأستاذ", "Follow teacher")}
            </button>
          )}
        </div>

        <div className={cn("pointer-events-auto flex shrink-0 items-center gap-0.5 rounded-2xl p-1 shadow-lg ring-1 backdrop-blur", chip)}>
          {canWrite && (
            <>
              <IconBtn label={tr("Annuler (Ctrl+Z)", "تراجع (Ctrl+Z)", "Undo (Ctrl+Z)")} disabled={!store.canUndo} onClick={() => store.undo("board")}>
                <Undo2 className="h-4 w-4" />
              </IconBtn>
              <IconBtn label={tr("Rétablir (Ctrl+Y)", "إعادة (Ctrl+Y)", "Redo (Ctrl+Y)")} disabled={!store.canRedo} onClick={() => store.redo("board")}>
                <Redo2 className="h-4 w-4" />
              </IconBtn>
              <span className="mx-0.5 h-5 w-px bg-current opacity-15" />
            </>
          )}
          {!narrow && (
            <>
              <IconBtn label={tr("Dézoomer", "تصغير", "Zoom out")} onClick={() => canvas.current?.zoomBy(1 / 1.25)}>
                <ZoomOut className="h-4 w-4" />
              </IconBtn>
              <button
                type="button"
                onClick={() => canvas.current?.setZoom(1)}
                className="h-8 min-w-12 rounded-lg px-1 text-xs font-semibold tabular-nums hover:bg-current/10"
                title={tr("Zoom 100 %", "تكبير 100٪", "Zoom 100%")}
              >
                {Math.round(zoom * 100)}%
              </button>
              <IconBtn label={tr("Zoomer", "تكبير", "Zoom in")} onClick={() => canvas.current?.zoomBy(1.25)}>
                <ZoomIn className="h-4 w-4" />
              </IconBtn>
            </>
          )}
          <IconBtn label={tr("Tout afficher", "عرض الكل", "Fit to content")} onClick={() => canvas.current?.fit()}>
            <Maximize className="h-4 w-4" />
          </IconBtn>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-current/10" aria-label={tr("Options du tableau", "خيارات اللوحة", "Board options")}>
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {host && (
                <>
                  <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Grid3x3 className="h-3.5 w-3.5" />
                    {tr("Fond", "الخلفية", "Background")}
                  </DropdownMenuLabel>
                  {PAPERS.map(p => (
                    <DropdownMenuItem key={p.id} onClick={() => store.setState({ paper: p.id })}>
                      <Check className={cn("me-2 h-4 w-4", st.paper !== p.id && "opacity-0")} />
                      {tr(p.fr, p.ar, p.en)}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <div className="flex gap-1.5 px-2 py-1.5">
                    {BOARD_THEMES.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => store.setState({ theme: t.id })}
                        className={cn("flex flex-1 flex-col items-center gap-1 rounded-lg p-1.5 text-[11px] transition hover:bg-muted", st.theme === t.id && "bg-muted font-semibold")}
                      >
                        <span className="h-6 w-full rounded-md ring-1 ring-black/10" style={{ background: THEMES[t.id].bg }} />
                        {tr(t.fr, t.ar, t.en)}
                      </button>
                    ))}
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}
              {canWrite && (
                <DropdownMenuItem onClick={() => fileRef.current?.click()}>
                  <ImagePlus className="me-2 h-4 w-4" />
                  {tr("Insérer une image", "إدراج صورة", "Insert image")}
                </DropdownMenuItem>
              )}
              {canWrite && props.captureScreen && (
                <DropdownMenuItem onClick={() => void insertScreen()}>
                  <MonitorDown className="me-2 h-4 w-4" />
                  {tr("Copier l'écran partagé ici", "نسخ الشاشة المشتركة هنا", "Copy the shared screen here")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={exportPng}>
                <Download className="me-2 h-4 w-4" />
                {tr("Télécharger en image (PNG)", "تنزيل كصورة (PNG)", "Download as image (PNG)")}
              </DropdownMenuItem>
              {host && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-rose-600 focus:text-rose-600"
                    disabled={empty}
                    onClick={() => {
                      store.clear("board");
                      toast(tr("Tableau effacé", "تم مسح اللوحة", "Board cleared"), {
                        action: { label: tr("Annuler", "تراجع", "Undo"), onClick: () => store.undo("board") },
                      });
                    }}
                  >
                    <Trash2 className="me-2 h-4 w-4" />
                    {tr("Tout effacer", "مسح الكل", "Clear board")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="mx-0.5 h-5 w-px bg-current opacity-15" />
          <button
            type="button"
            onClick={props.onClose}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition hover:bg-current/10"
            title={host ? tr("Fermer le tableau pour tous (B)", "إغلاق اللوحة للجميع (B)", "Close the board for everyone (B)") : tr("Revenir à la vidéo", "العودة إلى الفيديو", "Back to video")}
          >
            {host ? <X className="h-4 w-4" /> : <Video className="h-4 w-4" />}
            <span className="hidden sm:inline">{host ? tr("Fermer", "إغلاق", "Close") : tr("Vidéo", "الفيديو", "Video")}</span>
          </button>
        </div>
      </div>

      {/* outils */}
      {canWrite && (
        <div
          className={cn(
            "pointer-events-none absolute z-10 flex",
            narrow ? "inset-x-2 bottom-2 justify-center" : "start-3 top-1/2 -translate-y-1/2",
          )}
        >
          <WbToolbar tools={tools} setTools={setTools} scope="board" vertical={!narrow} theme={st.theme} tr={tr} onImage={() => fileRef.current?.click()} />
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void insertBlob(f);
        }}
      />
    </div>
  );
});

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-current/10 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

// ======================================================================== écran partagé
/**
 * Calque d'annotation posé exactement sur l'image de l'écran partagé (object-contain).
 * Monté par-dessus la tuile : la vidéo est trouvée dans le conteneur parent.
 */
export const ScreenAnnotator = memo(function ScreenAnnotator(props: {
  store: WbStore;
  tr: Tr;
  /** clé de l'écran partagé (change quand un nouveau partage commence) */
  shareKey: string;
  onCopyToBoard?: () => void;
}) {
  const { store, tr } = props;
  useStoreState(store);
  useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);
  const [tools, setTools] = useTools("screen");
  const [on, setOn] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const narrow = useIsNarrow();
  const canWrite = store.canWrite;
  const active = on && canWrite;

  // rectangle réellement occupé par l'image (bandes noires exclues)
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const parent = box.parentElement!;
    const measure = () => {
      const v = parent.querySelector("video");
      const W = box.clientWidth,
        H = box.clientHeight;
      if (!v || !v.videoWidth || !W || !H) {
        setRect(r => (r ? null : r));
        return;
      }
      const ar = v.videoWidth / v.videoHeight;
      let w = W,
        h = W / ar;
      if (h > H) {
        h = H;
        w = H * ar;
      }
      const next = { x: (W - w) / 2, y: (H - h) / 2, w, h };
      setRect(r => (r && Math.abs(r.x - next.x) < 0.5 && Math.abs(r.y - next.y) < 0.5 && Math.abs(r.w - next.w) < 0.5 && Math.abs(r.h - next.h) < 0.5 ? r : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    const t = window.setInterval(measure, 1000);
    parent.addEventListener("resize", measure, true);
    parent.addEventListener("loadedmetadata", measure, true);
    return () => {
      ro.disconnect();
      window.clearInterval(t);
      parent.removeEventListener("resize", measure, true);
      parent.removeEventListener("loadedmetadata", measure, true);
    };
  }, [props.shareKey]);

  useEffect(() => {
    if (!canWrite) setOn(false);
  }, [canWrite]);

  // clavier pendant l'annotation
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.closest("input, textarea, select, [contenteditable=true]")) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "z") {
        e.preventDefault();
        if (e.shiftKey) store.redo("screen");
        else store.undo("screen");
      } else if ((e.ctrlKey || e.metaKey) && k === "y") {
        e.preventDefault();
        store.redo("screen");
      } else if (e.key === "Escape") {
        // Échap ferme d'abord le menu ouvert
        if (!document.querySelector("[data-radix-popper-content-wrapper]")) setOn(false);
      }
      else if (!e.ctrlKey && !e.metaKey && !e.altKey && TOOL_KEYS[e.key] && !["pan", "note"].includes(TOOL_KEYS[e.key])) setTools({ tool: TOOL_KEYS[e.key] });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, store, setTools]);

  const hasMarks = !store.isEmpty("screen");

  return (
    <div ref={boxRef} className="pointer-events-none absolute inset-0 z-[5]">
      {rect && (
        <div
          className={cn("absolute", active && "pointer-events-auto ring-2 ring-primary/70")}
          style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, aspectRatio: undefined }}
        >
          <WbCanvas store={store} layer="screen" variant="overlay" tools={tools} active={active} tr={tr} />
        </div>
      )}
      {/* barre d'annotation */}
      {active ? (
        <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex justify-center">
          <div className="pointer-events-auto flex max-w-full items-center gap-1">
            <WbToolbar tools={tools} setTools={setTools} scope="screen" vertical={false} theme="light" tr={tr} />
            <div className="flex shrink-0 items-center gap-0.5 rounded-2xl bg-[#151b27]/95 p-1.5 text-white shadow-2xl ring-1 ring-white/10">
              {!narrow && (
                <>
                  <IconBtn label={tr("Annuler (Ctrl+Z)", "تراجع (Ctrl+Z)", "Undo (Ctrl+Z)")} disabled={!store.canUndo} onClick={() => store.undo("screen")}>
                    <Undo2 className="h-4 w-4" />
                  </IconBtn>
                  {store.isHost && (
                    <IconBtn label={tr("Effacer les annotations", "مسح التعليقات", "Clear annotations")} disabled={!hasMarks} onClick={() => store.clear("screen")}>
                      <Trash2 className="h-4 w-4" />
                    </IconBtn>
                  )}
                  {props.onCopyToBoard && (
                    <IconBtn label={tr("Copier sur le tableau blanc", "نسخ إلى السبورة", "Copy to whiteboard")} onClick={props.onCopyToBoard}>
                      <MonitorDown className="h-4 w-4" />
                    </IconBtn>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={() => setOn(false)}
                className="flex h-10 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-xs font-semibold hover:bg-white/15"
                title={tr("Terminer l'annotation (Échap)", "إنهاء التعليق (Esc)", "Stop annotating (Esc)")}
              >
                <Check className="h-4 w-4" />
                <span className="hidden sm:inline">{tr("Terminer", "إنهاء", "Done")}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        canWrite &&
        rect && (
          <div className="pointer-events-none absolute inset-x-0 bottom-12 z-10 flex justify-center sm:bottom-auto sm:top-3">
            <button
              type="button"
              onClick={() => setOn(true)}
              className="pointer-events-auto flex h-9 items-center gap-2 rounded-full bg-[#151b27]/90 px-3.5 text-xs font-semibold text-white shadow-xl ring-1 ring-white/15 backdrop-blur transition hover:bg-primary hover:text-primary-foreground"
            >
              <PenLine className="h-4 w-4" />
              {tr("Annoter l'écran", "التعليق على الشاشة", "Annotate screen")}
              {hasMarks && <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />}
            </button>
          </div>
        )
      )}
    </div>
  );
});

/** Image de l'écran partagé + ses annotations (pour la copier sur le tableau) */
export async function captureTrack(track: MediaStreamTrack | undefined, store: WbStore) {
  if (!track) return null;
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.srcObject = new MediaStream([track]);
  try {
    await v.play();
    if (!v.videoWidth) await new Promise(r => v.addEventListener("loadeddata", r, { once: true }));
    const W = v.videoWidth,
      H = v.videoHeight;
    const c = document.createElement("canvas");
    const k = Math.min(1, 1920 / W);
    c.width = Math.round(W * k);
    c.height = Math.round(H * k);
    const ctx = c.getContext("2d")!;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    const els = store.list("screen").filter(e => !e.exp);
    if (els.length) {
      const z = c.width / SCREEN_W;
      const { drawEl } = await import("./render");
      ctx.setTransform(z, 0, 0, z, 0, 0);
      for (const e of els) drawEl(ctx, e, "light", () => undefined);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    return canvasToImage(c, c.width, c.height, 1600);
  } catch {
    return null;
  } finally {
    v.pause();
    v.srcObject = null;
  }
}

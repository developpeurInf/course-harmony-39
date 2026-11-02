"use client";

/**
 * Espace de travail GeoGebra : une application officielle GeoGebra (API « GeoGebra Apps »)
 * dans la page, avec la langue (fr / ar / en) et le thème (clair / sombre) de l'application,
 * l'enregistrement automatique dans le navigateur, l'ouverture / le téléchargement de fichiers .ggb
 * et l'export en image (PNG, SVG) pour les cours, fiches et documents Word.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowLeft, Check, ChevronDown, Clipboard, Cloud, Download, FilePlus2, FolderOpen, Image as ImageIcon,
  Loader2, Maximize2, Minimize2, Moon, MoreVertical, RefreshCw, Sun, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate, useSearchParams } from "@/lib/router";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOfficeEnv, debounce } from "@/components/office/shared/useOfficeEnv";
import { newFileId, pickFile, readFileAsArrayBuffer } from "@/components/office/shared/officeStore";
import { GGB_APPS, ggbApp, type GgbAppDef, type GgbAppId } from "./ggbApps";
import { deleteGgbFile, getGgbFile, getLastGgb, listGgbFiles, putGgbFile, setLastGgb, type GgbFileMeta } from "./ggbStore";
import { arrayBufferToBase64, base64ToBlob, downloadBlob, injectGeogebra, loadGeogebra, type GgbApi } from "./loadGeogebra";
import "./geogebra.css";

type SaveState = "saved" | "saving" | "dirty" | "empty";
type Status = "loading" | "ready" | "error";

let appletCounter = 0;
const THEME_KEY = "geogebra:darkCanvas";

function safeName(s: string) {
  return (s.trim() || "geogebra").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80);
}

export default function GeoGebraWorkspace({ appId }: { appId: GgbAppId }) {
  const { L, language, dir, isRtl, dark } = useOfficeEnv();
  const navigate = useNavigate();
  const searchParams = useSearchParams();
  const def = ggbApp(appId) as GgbAppDef;

  const wrapRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<GgbApi | null>(null);
  const fileIdRef = useRef<string | null>(null);
  const nameRef = useRef("");
  const loadingFileRef = useRef(false);

  const [status, setStatus] = useState<Status>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [fileId, setFileId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("empty");
  const [files, setFiles] = useState<GgbFileMeta[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  // Fond sombre de la zone GeoGebra : suit le thème de l'application, sauf choix contraire mémorisé
  const [canvasPref, setCanvasPref] = useState<"auto" | "dark" | "light">(() => {
    try {
      return (localStorage.getItem(THEME_KEY) as "dark" | "light" | null) || "auto";
    } catch {
      return "auto";
    }
  });
  const darkCanvas = canvasPref === "auto" ? dark : canvasPref === "dark";

  const defaultName = useCallback(
    () => `${def.label(L)} ${new Date().toLocaleDateString(language === "ar" ? "ar-MA" : language === "en" ? "en-GB" : "fr-FR")}`,
    [def, L, language]
  );

  useEffect(() => {
    fileIdRef.current = fileId;
  }, [fileId]);
  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  const refreshFiles = useCallback(() => {
    listGgbFiles().then(setFiles).catch(() => setFiles([]));
  }, []);
  useEffect(refreshFiles, [refreshFiles]);

  /* ---------- enregistrement ---------- */

  const thumbnail = useCallback((api: GgbApi): string | undefined => {
    try {
      const w = hostRef.current?.clientWidth || 800;
      const png = api.getPNGBase64(Math.min(1, 320 / w), false, 72);
      return png ? `data:image/png;base64,${png}` : undefined;
    } catch {
      return undefined;
    }
  }, []);

  const saveNow = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;
    setSaveState("saving");
    try {
      const base64 = api.getBase64();
      let id = fileIdRef.current;
      if (!id) {
        id = newFileId();
        fileIdRef.current = id;
        setFileId(id);
      }
      const nm = nameRef.current.trim() || defaultName();
      if (!nameRef.current.trim()) {
        nameRef.current = nm;
        setName(nm);
      }
      await putGgbFile({ id, app: appId, name: nm, updatedAt: Date.now(), base64, thumb: thumbnail(api) });
      setLastGgb(appId, id);
      setSaveState("saved");
      refreshFiles();
    } catch {
      setSaveState("dirty");
    }
  }, [appId, defaultName, refreshFiles, thumbnail]);

  // fonction d'enregistrement stable (évite de recréer le minuteur à chaque rendu)
  const saveRef = useRef(saveNow);
  useEffect(() => {
    saveRef.current = saveNow;
  }, [saveNow]);
  const autosave = useMemo(() => debounce(() => void saveRef.current(), 2000), []);
  useEffect(() => () => autosave.flush(), [autosave]);

  const onChange = useCallback(() => {
    if (loadingFileRef.current) return;
    setSaveState("dirty");
    autosave();
  }, [autosave]);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  /* ---------- création de l'application GeoGebra ---------- */

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;
    setStatus("loading");
    apiRef.current = null;

    (async () => {
      // Fichier à ouvrir : ?file=<id>, sinon la dernière construction de cette application
      const wanted = searchParams?.get("file") || (searchParams?.get("new") ? null : getLastGgb(appId));
      const rec = wanted ? await getGgbFile(wanted) : null;
      try {
        await loadGeogebra();
      } catch {
        if (!cancelled) setStatus("error");
        return;
      }
      if (cancelled) return;
      if (rec && rec.app === appId) {
        fileIdRef.current = rec.id;
        setFileId(rec.id);
        setName(rec.name);
        nameRef.current = rec.name;
        setSaveState("saved");
        setLastGgb(appId, rec.id);
      } else {
        fileIdRef.current = null;
        setFileId(null);
        setName("");
        nameRef.current = "";
        setSaveState("empty");
      }

      host.innerHTML = "";
      const target = document.createElement("div");
      target.className = "ggb-target";
      host.appendChild(target);
      const id = `ggbApp${++appletCounter}`;
      const w = Math.max(320, host.clientWidth);
      const h = Math.max(320, host.clientHeight);
      const watchdog = setTimeout(() => {
        if (!cancelled && !apiRef.current) setStatus("error");
      }, 45000);
      loadingFileRef.current = true;
      try {
        injectGeogebra(target, {
          id,
          appName: def.appName,
          ...(def.perspective ? { perspective: def.perspective } : {}),
          width: w,
          height: h,
          language: language === "ar" ? "ar" : language === "en" ? "en" : "fr",
          showToolBar: true,
          showAlgebraInput: true,
          showMenuBar: true,
          showResetIcon: false,
          showFullscreenButton: false,
          showZoomButtons: true,
          enableLabelDrags: true,
          enableShiftDragZoom: true,
          enableRightClick: true,
          enableFileFeatures: false,
          errorDialogsActive: true,
          useBrowserForJS: false,
          allowStyleBar: true,
          preventFocus: true,
          borderColor: "transparent",
          borderRadius: 0,
          ...(rec && rec.app === appId ? { ggbBase64: rec.base64 } : {}),
          appletOnLoad: (api: GgbApi) => {
            clearTimeout(watchdog);
            if (cancelled) return;
            apiRef.current = api;
            const fire = () => onChangeRef.current();
            try {
              api.registerAddListener?.(fire);
              api.registerRemoveListener?.(fire);
              api.registerUpdateListener?.(fire);
              api.registerRenameListener?.(fire);
              api.registerClearListener?.(fire);
            } catch {
              /* ancienne version de GeoGebra */
            }
            // les mises à jour déclenchées par le chargement du fichier ne comptent pas
            setTimeout(() => (loadingFileRef.current = false), 600);
            setStatus("ready");
            const box = hostRef.current;
            if (box) api.setSize(Math.max(320, box.clientWidth), Math.max(320, box.clientHeight));
          },
        });
      } catch {
        clearTimeout(watchdog);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      autosave.flush();
      try {
        apiRef.current?.remove?.();
      } catch {
        /* déjà retirée */
      }
      apiRef.current = null;
      host.innerHTML = "";
    };
    // la langue est appliquée sans recharger (voir plus bas) ; ?file= recharge l'application
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, reloadKey, searchParams?.get("file"), searchParams?.get("new")]);

  // Changement de langue de l'application : GeoGebra suit sans tout recharger
  const firstLang = useRef(language);
  useEffect(() => {
    if (firstLang.current === language) return;
    firstLang.current = language;
    const api = apiRef.current;
    const lang = language === "ar" ? "ar" : language === "en" ? "en" : "fr";
    if (api?.setLanguage) {
      try {
        api.setLanguage(lang);
      } catch {
        /* ignoré */
      }
    }
  }, [language]);

  // Taille : GeoGebra occupe toute la zone disponible (fenêtre, rotation d'iPad, plein écran)
  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    const resize = debounce(() => {
      const api = apiRef.current;
      if (api) api.setSize(Math.max(320, host.clientWidth), Math.max(320, host.clientHeight));
    }, 120);
    const ro = new ResizeObserver(() => resize());
    ro.observe(host);
    return () => {
      ro.disconnect();
      resize.cancel();
    };
  }, []);

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  /* ---------- actions ---------- */

  const goTo = (id: GgbAppId, extra = "") => navigate(`/geogebra/${id}${extra}`);

  const newConstruction = async () => {
    autosave.flush();
    const api = apiRef.current;
    if (!api) return;
    loadingFileRef.current = true;
    api.newConstruction();
    setTimeout(() => (loadingFileRef.current = false), 300);
    fileIdRef.current = null;
    setFileId(null);
    setName("");
    nameRef.current = "";
    setSaveState("empty");
    setLastGgb(appId, null);
  };

  const openGgb = async () => {
    const [file] = await pickFile(".ggb,application/vnd.geogebra.file,application/zip");
    if (!file) return;
    const api = apiRef.current;
    if (!api) return;
    const tId = toast.loading(L("Ouverture…", "جارٍ الفتح…", "Opening…"));
    try {
      autosave.flush();
      const b64 = arrayBufferToBase64(await readFileAsArrayBuffer(file));
      loadingFileRef.current = true;
      api.setBase64(b64);
      setTimeout(() => (loadingFileRef.current = false), 600);
      const nm = file.name.replace(/\.ggb$/i, "");
      fileIdRef.current = null;
      setFileId(null);
      setName(nm);
      nameRef.current = nm;
      await saveNow();
      toast.success(L("Fichier ouvert", "تم فتح الملف", "File opened"), { id: tId });
    } catch {
      toast.error(L("Ce fichier n'est pas un fichier GeoGebra (.ggb) valide.", "هذا الملف ليس ملف جيوجبرا (‎.ggb) صالحا.", "This is not a valid GeoGebra (.ggb) file."), { id: tId });
    }
  };

  const openRecent = (f: GgbFileMeta) => {
    autosave.flush();
    goTo(f.app, `?file=${encodeURIComponent(f.id)}`);
  };

  const removeRecent = async (f: GgbFileMeta) => {
    await deleteGgbFile(f.id);
    if (f.id === fileIdRef.current) {
      fileIdRef.current = null;
      setFileId(null);
      setSaveState("dirty");
    }
    refreshFiles();
  };

  const downloadGgb = () => {
    const api = apiRef.current;
    if (!api) return;
    try {
      downloadBlob(base64ToBlob(api.getBase64(), "application/vnd.geogebra.file"), `${safeName(name || defaultName())}.ggb`);
    } catch {
      toast.error(L("Téléchargement impossible.", "تعذر التحميل.", "Download failed."));
    }
  };

  const pngBlob = (scale: number, transparent: boolean) => {
    const api = apiRef.current;
    if (!api) return null;
    const b64 = api.getPNGBase64(scale, transparent, 300);
    return b64 ? base64ToBlob(b64, "image/png") : null;
  };

  const downloadPng = (transparent = false) => {
    const blob = pngBlob(2, transparent);
    if (!blob) return toast.error(L("Rien à exporter : la zone graphique est vide ou masquée.", "لا شيء للتصدير: منطقة الرسم فارغة أو مخفية.", "Nothing to export: the graphics view is empty or hidden."));
    downloadBlob(blob, `${safeName(name || defaultName())}.png`);
  };

  const downloadSvg = () => {
    const api = apiRef.current;
    if (!api?.exportSVG) return toast.error(L("Export SVG non disponible dans cette application.", "التصدير بصيغة SVG غير متاح في هذا التطبيق.", "SVG export is not available in this app."));
    api.exportSVG((svg) => {
      if (!svg) return toast.error(L("Rien à exporter.", "لا شيء للتصدير.", "Nothing to export."));
      downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${safeName(name || defaultName())}.svg`);
    });
  };

  const copyImage = async () => {
    const blob = pngBlob(2, false);
    if (!blob) return toast.error(L("Rien à copier.", "لا شيء للنسخ.", "Nothing to copy."));
    try {
      const CI = (window as unknown as { ClipboardItem?: new (d: Record<string, Blob>) => unknown }).ClipboardItem;
      if (!CI || !navigator.clipboard?.write) throw new Error("clipboard");
      await navigator.clipboard.write([new CI({ "image/png": blob }) as ClipboardItem]);
      toast.success(L("Image copiée : collez-la dans Word, PowerPoint ou un cours.", "تم نسخ الصورة: ألصقها في Word أو PowerPoint أو درس.", "Image copied: paste it into Word, PowerPoint or a course."));
    } catch {
      downloadBlob(blob, `${safeName(name || defaultName())}.png`);
      toast.info(L("Copie non autorisée par le navigateur : l'image a été téléchargée.", "المتصفح لا يسمح بالنسخ: تم تحميل الصورة.", "The browser blocked copying: the image was downloaded."));
    }
  };

  const toggleFullscreen = async () => {
    const el = wrapRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (el.requestFullscreen) await el.requestFullscreen();
      else setFullscreen((v) => !v); // Safari iOS : plein écran « dans la page »
    } catch {
      setFullscreen((v) => !v);
    }
  };

  const toggleCanvas = () => {
    const next = darkCanvas ? "light" : "dark";
    const value = (next === "dark") === dark ? "auto" : next;
    setCanvasPref(value);
    try {
      if (value === "auto") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, value);
    } catch {
      /* stockage bloqué */
    }
  };

  const rename = (v: string) => {
    setName(v);
    nameRef.current = v;
    if (apiRef.current && saveState !== "empty") {
      setSaveState("dirty");
      autosave();
    }
  };

  const Icon = def.icon;
  const pseudoFs = fullscreen && typeof document !== "undefined" && document.fullscreenElement !== wrapRef.current;
  const ready = status === "ready";

  const saveLabel =
    saveState === "saving" ? L("Enregistrement…", "جارٍ الحفظ…", "Saving…")
      : saveState === "saved" ? L("Enregistré dans ce navigateur", "محفوظ في هذا المتصفح", "Saved in this browser")
        : saveState === "dirty" ? L("Modifications non enregistrées", "تعديلات غير محفوظة", "Unsaved changes")
          : L("Nouvelle construction", "إنشاء جديد", "New construction");

  return (
    <div
      ref={wrapRef}
      dir={dir}
      className={cn(
        "ggb-workspace flex min-h-0 flex-1 flex-col bg-background",
        pseudoFs && "fixed inset-0 z-[80]"
      )}
      style={{ ["--ggb-accent" as string]: def.color }}
    >
      {/* Barre du haut */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-card px-2 py-1.5 sm:px-3">
        <Link
          to="/geogebra"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          title={L("Toutes les applications GeoGebra", "كل تطبيقات جيوجبرا", "All GeoGebra apps")}
          aria-label={L("Retour", "رجوع", "Back")}
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        </Link>

        {/* Choix de l'application */}
        <DropdownMenu dir={dir}>
          <DropdownMenuTrigger className="inline-flex h-9 min-w-0 items-center gap-2 rounded-md px-2 text-sm font-semibold hover:bg-muted">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white" style={{ background: def.color }}>
              <Icon className="h-4 w-4" strokeWidth={1.8} />
            </span>
            <span className="hidden max-w-[14rem] truncate sm:inline">{def.label(L)}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel>{L("Applications GeoGebra", "تطبيقات جيوجبرا", "GeoGebra apps")}</DropdownMenuLabel>
            {GGB_APPS.map((a) => {
              const AI = a.icon;
              return (
                <DropdownMenuItem key={a.id} onSelect={() => a.id !== appId && goTo(a.id)} className="gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white" style={{ background: a.color }}>
                    <AI className="h-4 w-4" strokeWidth={1.8} />
                  </span>
                  <span className="flex-1">{a.label(L)}</span>
                  {a.id === appId && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Nom + état */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <input
            value={name}
            onChange={(e) => rename(e.target.value)}
            placeholder={defaultName()}
            dir="auto"
            aria-label={L("Nom de la construction", "اسم الإنشاء", "Construction name")}
            className="h-8 min-w-[7rem] flex-1 rounded-md border border-transparent bg-transparent px-2 text-sm hover:border-border focus:border-ring focus:outline-none sm:max-w-xs"
          />
          <span className="hidden shrink-0 items-center gap-1 whitespace-nowrap text-xs text-muted-foreground md:inline-flex" aria-live="polite" title={saveLabel}>
            {saveState === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saveState === "saved" ? <Cloud className="h-3.5 w-3.5" /> : null}
            <span className="hidden 2xl:inline">{saveLabel}</span>
          </span>
        </div>

        {/* Actions principales (ordinateur) */}
        <div className="hidden items-center gap-1 lg:flex">
          <ToolBtn onClick={newConstruction} disabled={!ready} icon={FilePlus2} label={L("Nouveau", "جديد", "New")} />
          <ToolBtn onClick={openGgb} disabled={!ready} icon={FolderOpen} label={L("Ouvrir .ggb", "فتح ‎.ggb", "Open .ggb")} />
          <ToolBtn onClick={downloadGgb} disabled={!ready} icon={Download} label={L("Télécharger .ggb", "تحميل ‎.ggb", "Download .ggb")} />
          <ToolBtn onClick={() => downloadPng(false)} disabled={!ready} icon={ImageIcon} label={L("Image PNG", "صورة PNG", "PNG image")} />
          <ToolBtn onClick={copyImage} disabled={!ready} icon={Clipboard} label={L("Copier l'image", "نسخ الصورة", "Copy image")} />
        </div>

        <IconBtn
          onClick={toggleCanvas}
          icon={darkCanvas ? Sun : Moon}
          label={darkCanvas ? L("GeoGebra en clair", "جيوجبرا بالوضع الفاتح", "Light GeoGebra") : L("GeoGebra en sombre", "جيوجبرا بالوضع الداكن", "Dark GeoGebra")}
        />
        <IconBtn
          onClick={toggleFullscreen}
          icon={fullscreen ? Minimize2 : Maximize2}
          label={fullscreen ? L("Quitter le plein écran", "الخروج من ملء الشاشة", "Exit full screen") : L("Plein écran (tableau)", "ملء الشاشة (السبورة)", "Full screen (board)")}
        />

        {/* Menu : constructions + actions sur petit écran */}
        <DropdownMenu dir={dir} onOpenChange={(o) => o && refreshFiles()}>
          <DropdownMenuTrigger
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm hover:bg-muted"
            aria-label={L("Mes constructions et plus", "إنشاءاتي والمزيد", "My constructions and more")}
          >
            <FolderOpen className="h-4 w-4 lg:hidden" />
            <span className="hidden lg:inline">{L("Mes constructions", "إنشاءاتي", "My constructions")}</span>
            <MoreVertical className="h-4 w-4 lg:hidden" />
            <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground lg:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-[70vh] w-80 overflow-y-auto">
            <div className="lg:hidden">
              <DropdownMenuItem disabled={!ready} onSelect={newConstruction} className="gap-2"><FilePlus2 className="h-4 w-4" />{L("Nouvelle construction", "إنشاء جديد", "New construction")}</DropdownMenuItem>
              <DropdownMenuItem disabled={!ready} onSelect={openGgb} className="gap-2"><FolderOpen className="h-4 w-4" />{L("Ouvrir un fichier .ggb", "فتح ملف ‎.ggb", "Open a .ggb file")}</DropdownMenuItem>
              <DropdownMenuItem disabled={!ready} onSelect={downloadGgb} className="gap-2"><Download className="h-4 w-4" />{L("Télécharger en .ggb", "تحميل بصيغة ‎.ggb", "Download as .ggb")}</DropdownMenuItem>
              <DropdownMenuItem disabled={!ready} onSelect={copyImage} className="gap-2"><Clipboard className="h-4 w-4" />{L("Copier l'image", "نسخ الصورة", "Copy image")}</DropdownMenuItem>
              <DropdownMenuSeparator />
            </div>
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">{L("Exporter l'image", "تصدير الصورة", "Export image")}</DropdownMenuLabel>
            <DropdownMenuItem disabled={!ready} onSelect={() => downloadPng(false)} className="gap-2"><ImageIcon className="h-4 w-4" />{L("PNG (fond blanc, haute qualité)", "PNG (خلفية بيضاء، جودة عالية)", "PNG (white background, high quality)")}</DropdownMenuItem>
            <DropdownMenuItem disabled={!ready} onSelect={() => downloadPng(true)} className="gap-2"><ImageIcon className="h-4 w-4" />{L("PNG transparent", "PNG شفاف", "Transparent PNG")}</DropdownMenuItem>
            <DropdownMenuItem disabled={!ready} onSelect={downloadSvg} className="gap-2"><ImageIcon className="h-4 w-4" />{L("SVG (vectoriel)", "SVG (متجهي)", "SVG (vector)")}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">{L("Mes constructions (ce navigateur)", "إنشاءاتي (هذا المتصفح)", "My constructions (this browser)")}</DropdownMenuLabel>
            {files.length === 0 && (
              <p className="px-2 py-2 text-xs text-muted-foreground">{L("Aucune pour l'instant : vos constructions s'enregistrent toutes seules.", "لا شيء بعد: تحفظ إنشاءاتك تلقائيا.", "None yet: your constructions save automatically.")}</p>
            )}
            {files.slice(0, 30).map((f) => {
              const A = ggbApp(f.app);
              const FI = A?.icon || ImageIcon;
              return (
                <DropdownMenuItem key={f.id} onSelect={() => openRecent(f)} className={cn("group gap-2", f.id === fileId && "bg-muted")}>
                  {f.thumb ? (
                    <img src={f.thumb} alt="" className="h-9 w-12 shrink-0 rounded border bg-white object-cover" />
                  ) : (
                    <span className="flex h-9 w-12 shrink-0 items-center justify-center rounded border" style={{ color: A?.color }}><FI className="h-4 w-4" /></span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm" dir="auto">{f.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{A?.label(L)} · {new Date(f.updatedAt).toLocaleDateString()}</span>
                  </span>
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground opacity-60 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    aria-label={L("Supprimer", "حذف", "Delete")}
                    title={L("Supprimer", "حذف", "Delete")}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void removeRecent(f);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Zone GeoGebra : l'application gère elle-même son sens d'écriture (arabe compris) */}
      <div className="relative min-h-0 flex-1">
        <div ref={hostRef} dir="ltr" className={cn("ggb-host absolute inset-0 overflow-hidden", darkCanvas && "ggb-dark")} />
        {status !== "ready" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background p-6 text-center">
            {status === "loading" ? (
              <>
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-lg" style={{ background: def.color }}>
                  <Icon className="h-8 w-8" strokeWidth={1.6} />
                </span>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> {L("Chargement de GeoGebra…", "جارٍ تحميل جيوجبرا…", "Loading GeoGebra…")}
                </div>
              </>
            ) : (
              <>
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  <AlertTriangle className="h-7 w-7" />
                </span>
                <p className="max-w-md text-sm font-medium">{L("GeoGebra n'a pas pu se charger.", "تعذر تحميل جيوجبرا.", "GeoGebra could not be loaded.")}</p>
                <p className="max-w-md text-xs text-muted-foreground">
                  {L(
                    "Vérifiez la connexion Internet. Sur un réseau d'établissement, le site geogebra.org est peut-être bloqué : demandez à l'administrateur de l'autoriser.",
                    "تحقق من الاتصال بالإنترنت. في شبكة المؤسسة قد يكون موقع geogebra.org محجوبا: اطلب من المسؤول السماح به.",
                    "Check the Internet connection. On a school network, geogebra.org may be blocked: ask the administrator to allow it."
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => setReloadKey((k) => k + 1)}
                  className="mt-1 inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  <RefreshCw className="h-4 w-4" /> {L("Réessayer", "إعادة المحاولة", "Try again")}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolBtn({ onClick, disabled, icon: I, label }: { onClick: () => void; disabled?: boolean; icon: typeof Download; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm text-foreground/90 hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
      title={label}
    >
      <I className="h-4 w-4" strokeWidth={1.75} />
      <span className="hidden 2xl:inline">{label}</span>
    </button>
  );
}

function IconBtn({ onClick, icon: I, label }: { onClick: () => void; icon: typeof Download; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      title={label}
      aria-label={label}
    >
      <I className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}

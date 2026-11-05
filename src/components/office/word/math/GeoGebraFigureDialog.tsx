"use client";

/**
 * Figure GeoGebra dans Word : tracer une courbe ou une figure de géométrie (ou reprendre
 * une construction de « Mes constructions »), puis l'insérer comme image.
 * Le fichier GeoGebra est gardé dans l'image : double-clic → la figure se rouvre, modifiable.
 */
import { useEffect, useRef, useState } from "react";
import { Box, FolderOpen, Loader2, LineChart, Shapes, Triangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getGgbFile, listGgbFiles, type GgbFileMeta } from "@/components/geogebra/ggbStore";
import { injectGeogebra, loadGeogebra, type GgbApi } from "@/components/geogebra/loadGeogebra";
import type { Tr } from "../../shared/useOfficeEnv";
import { MathOverlay } from "./MathOverlay";

type FigApp = "graphing" | "geometry" | "3d";
export interface GgbFigureRequest { ggb?: string | null; app?: string | null; pos?: number }

let counter = 0;

export function GeoGebraFigureDialog({
  request, onClose, onSubmit, L, language, dir,
}: {
  request: GgbFigureRequest | null;
  onClose: () => void;
  onSubmit: (png: string, ggb: string, app: FigApp, width: number, pos?: number) => void;
  L: Tr;
  language: string;
  dir: "ltr" | "rtl";
}) {
  const open = !!request;
  const [app, setApp] = useState<FigApp>("graphing");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [files, setFiles] = useState<GgbFileMeta[]>([]);
  const [showFiles, setShowFiles] = useState(false);
  const [size, setSize] = useState(60);
  const [grid, setGrid] = useState(true);
  const [busy, setBusy] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<GgbApi | null>(null);
  const startB64 = useRef<string | null>(null);

  useEffect(() => {
    if (!request) return;
    const a = (request.app === "geometry" || request.app === "3d" ? request.app : "graphing") as FigApp;
    startB64.current = request.ggb || null;
    setApp(a);
    listGgbFiles().then((f) => setFiles(f.filter((x) => x.app === "graphing" || x.app === "geometry" || x.app === "3d"))).catch(() => setFiles([]));
  }, [request]);

  useEffect(() => {
    if (!open) return;
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    setStatus("loading");
    apiRef.current = null;
    (async () => {
      try { await loadGeogebra(); } catch { if (!cancelled) setStatus("error"); return; }
      if (cancelled) return;
      host.innerHTML = "";
      const target = document.createElement("div");
      host.appendChild(target);
      const b64 = startB64.current;
      startB64.current = null;
      try {
        injectGeogebra(target, {
          id: `ggbWord${++counter}`,
          appName: app,
          width: Math.max(320, host.clientWidth),
          height: Math.max(300, host.clientHeight),
          language: language === "ar" ? "ar" : language === "en" ? "en" : "fr",
          showToolBar: true, showAlgebraInput: true, showMenuBar: false, showResetIcon: false, showFullscreenButton: false,
          showZoomButtons: true, enableLabelDrags: true, enableShiftDragZoom: true, enableRightClick: true, enableFileFeatures: false,
          useBrowserForJS: false, allowStyleBar: true, preventFocus: true, borderColor: "transparent",
          ...(b64 ? { ggbBase64: b64 } : {}),
          appletOnLoad: (api: GgbApi) => {
            if (cancelled) return;
            apiRef.current = api;
            setStatus("ready");
          },
        });
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      try { apiRef.current?.remove?.(); } catch { /* */ }
      apiRef.current = null;
      host.innerHTML = "";
    };
  }, [open, app, language]);

  useEffect(() => {
    const host = hostRef.current;
    if (!open || !host) return;
    const ro = new ResizeObserver(() => { try { apiRef.current?.setSize(Math.max(320, host.clientWidth), Math.max(300, host.clientHeight)); } catch { /* */ } });
    ro.observe(host);
    return () => ro.disconnect();
  }, [open, status]);

  const openSaved = async (id: string) => {
    const rec = await getGgbFile(id);
    if (!rec) return;
    setShowFiles(false);
    const a = (rec.app === "geometry" || rec.app === "3d" ? rec.app : "graphing") as FigApp;
    if (a !== app) { startB64.current = rec.base64; setApp(a); }
    else apiRef.current?.setBase64(rec.base64);
  };

  const submit = () => {
    const api = apiRef.current;
    if (!api) return;
    setBusy(true);
    try {
      if (!grid) { try { api.setGraphicsOptions?.(1, { gridIsBold: false, gridType: "none" }); (api as any).setGridVisible?.(false); } catch { /* */ } }
      const png = api.getPNGBase64(2, false, 300);
      const ggb = api.getBase64();
      onSubmit(`data:image/png;base64,${png}`, ggb, app, size, request?.pos);
    } finally {
      setBusy(false);
    }
  };

  const apps: { id: FigApp; label: string; icon: typeof LineChart }[] = [
    { id: "graphing", label: L("Courbes", "منحنيات", "Graphs"), icon: LineChart },
    { id: "geometry", label: L("Géométrie", "هندسة", "Geometry"), icon: Shapes },
    { id: "3d", label: L("Espace (3D)", "الفضاء (3D)", "Space (3D)"), icon: Box },
  ];

  return (
    <MathOverlay
      open={open}
      onClose={onClose}
      dir={dir}
      className="max-w-6xl"
      icon={<Triangle className="h-4 w-4" />}
      title={request?.pos != null ? L("Modifier la figure GeoGebra", "تعديل شكل GeoGebra", "Edit GeoGebra figure") : L("Insérer une figure GeoGebra", "إدراج شكل GeoGebra", "Insert a GeoGebra figure")}
      subtitle={L("Tracez votre figure puis cliquez sur « Insérer ». Elle reste modifiable : double-cliquez sur l'image dans le document.", "ارسم الشكل ثم انقر على «إدراج». يبقى قابلا للتعديل: انقر مرتين على الصورة في المستند.", "Draw the figure, then click Insert. Double-click the picture in the document to edit it again.")}
      footer={
        <>
          <label className="me-auto flex items-center gap-2 text-[12px]">
            {L("Largeur dans la page", "العرض في الصفحة", "Width on the page")}
            <select value={size} onChange={(e) => setSize(Number(e.target.value))} className="h-7 rounded border bg-background px-1 text-[12px]">
              {[30, 40, 50, 60, 75, 100].map((v) => <option key={v} value={v}>{v} %</option>)}
            </select>
          </label>
          <Button variant="outline" size="sm" onClick={onClose}>{L("Annuler", "إلغاء", "Cancel")}</Button>
          <Button size="sm" disabled={status !== "ready" || busy} onClick={submit} className="bg-[#2B579A] text-white hover:bg-[#244a85]">
            {busy && <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />}
            {request?.pos != null ? L("Mettre à jour", "تحديث", "Update") : L("Insérer", "إدراج", "Insert")}
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2">
        {apps.map((a) => (
          <button key={a.id} type="button" onClick={() => setApp(a.id)} className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px]", app === a.id ? "bg-[#2B579A] text-white" : "bg-muted/70 hover:bg-muted")}>
            <a.icon className="h-3.5 w-3.5" /> {a.label}
          </button>
        ))}
        <div className="relative ms-auto">
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 text-[12px]" onClick={() => setShowFiles((v) => !v)} disabled={!files.length}>
            <FolderOpen className="h-3.5 w-3.5" /> {L("Mes constructions", "إنشاءاتي", "My constructions")} {files.length ? `(${files.length})` : ""}
          </Button>
          {showFiles && (
            <div className="absolute end-0 top-8 z-10 max-h-80 w-72 overflow-y-auto rounded-lg border bg-card p-1.5 shadow-xl">
              {files.map((f) => (
                <button key={f.id} type="button" onClick={() => void openSaved(f.id)} className="flex w-full items-center gap-2 rounded-md p-1.5 text-start hover:bg-muted">
                  {f.thumb ? <img src={f.thumb} alt="" className="h-10 w-14 shrink-0 rounded border bg-white object-contain" /> : <div className="h-10 w-14 shrink-0 rounded border bg-muted" />}
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-medium">{f.name || L("Sans titre", "بدون عنوان", "Untitled")}</div>
                    <div className="text-[10px] text-muted-foreground">{new Date(f.updatedAt).toLocaleDateString()}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <label className="flex items-center gap-1.5 text-[12px]"><input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} className="accent-[#2B579A]" /> {L("Garder la grille", "إبقاء الشبكة", "Keep grid")}</label>
      </div>
      <div className="relative h-[62vh] min-h-[320px] bg-white" dir="ltr">
        <div ref={hostRef} className="ggb-host absolute inset-0" />
        {status !== "ready" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white text-sm text-neutral-500">
            {status === "loading" ? <><Loader2 className="h-6 w-6 animate-spin" /> {L("Chargement de GeoGebra…", "جارٍ تحميل GeoGebra…", "Loading GeoGebra…")}</> : L("GeoGebra n'a pas pu se charger (connexion à geogebra.org ?).", "تعذر تحميل GeoGebra (الاتصال بـ geogebra.org؟).", "GeoGebra could not load (connection to geogebra.org?).")}
          </div>
        )}
      </div>
    </MathOverlay>
  );
}

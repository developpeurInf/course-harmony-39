"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { PDFViewer, type PDFViewerRef, type PluginRegistry, type ThemeColors, type DeepPartial } from "@embedpdf/react-pdf-viewer";
import { ARABIC_LOCALE } from "./arabicLocale";

/** Moteur PDFium servi par l'application (pas de CDN externe) */
const WASM_URL = "/vendor/pdfium-2.15.1.wasm";

export type EditorLang = "fr" | "ar" | "en";

export interface PdfWorkspaceHandle {
  openFileDialog: () => void;
  openBuffer: (buffer: ArrayBuffer, name: string) => Promise<void>;
  openUrl: (url: string, name: string) => Promise<void>;
  /** PDF actif avec toutes les modifications (annotations, pages, masquages appliqués) */
  exportActive: () => Promise<{ buffer: ArrayBuffer; name: string } | null>;
  downloadActive: () => void;
}

interface Props {
  language: EditorLang;
  dark: boolean;
  author?: string;
  /** Nombre de documents ouverts et nom du document actif */
  onDocumentsChange?: (count: number, activeName: string | null) => void;
}

/* Le visualiseur reçoit les couleurs de l'application (variables CSS HSL) */
const cssVar = (name: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `hsl(${v})` : "";
};
const cssVarA = (name: string, alpha: number) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `hsl(${v} / ${alpha})` : "";
};

function appColors(): DeepPartial<ThemeColors> {
  return {
    background: {
      app: cssVar("--muted"),
      surface: cssVar("--card"),
      surfaceAlt: cssVar("--muted"),
      elevated: cssVar("--popover"),
      overlay: "rgba(9, 9, 11, 0.4)",
      input: cssVar("--card"),
    },
    foreground: {
      primary: cssVar("--foreground"),
      secondary: cssVar("--muted-foreground"),
      muted: cssVar("--muted-foreground"),
      disabled: cssVarA("--muted-foreground", 0.5),
      onAccent: cssVar("--primary-foreground"),
    },
    border: {
      default: cssVar("--border"),
      subtle: cssVar("--border"),
      strong: cssVar("--input"),
    },
    accent: {
      primary: cssVar("--primary"),
      primaryHover: cssVarA("--primary", 0.9),
      primaryActive: cssVarA("--primary", 0.82),
      primaryLight: cssVarA("--primary", 0.1),
      primaryForeground: cssVar("--primary-foreground"),
    },
    interactive: {
      hover: cssVar("--muted"),
      active: cssVarA("--foreground", 0.08),
      selected: cssVarA("--primary", 0.1),
      focus: cssVarA("--primary", 0.12),
      focusRing: cssVarA("--ring", 0.35),
    },
    state: {
      error: cssVar("--destructive"),
      errorLight: cssVarA("--destructive", 0.1),
      warning: cssVar("--warning"),
      warningLight: cssVarA("--warning", 0.12),
      success: cssVar("--success"),
      successLight: cssVarA("--success", 0.12),
      info: cssVar("--primary"),
      infoLight: cssVarA("--primary", 0.1),
    },
    tooltip: {
      background: cssVar("--foreground"),
      foreground: cssVar("--background"),
    },
  };
}

type DocManager = {
  openFileDialog: () => unknown;
  openDocumentBuffer: (o: { buffer: ArrayBuffer; name: string }) => { toPromise: () => Promise<{ task: { toPromise: () => Promise<unknown> } }> };
  openDocumentUrl: (o: { url: string; name: string; mode?: "full-fetch" }) => { toPromise: () => Promise<{ task: { toPromise: () => Promise<unknown> } }> };
  getActiveDocumentId: () => string | null;
  getActiveDocument: () => { name?: string } | null;
  getDocumentState: (id: string) => { name?: string } | null;
  getDocumentCount: () => number;
  onDocumentOpened: (cb: () => void) => () => void;
  onDocumentClosed: (cb: () => void) => () => void;
  onActiveDocumentChanged: (cb: () => void) => () => void;
};
type Exporter = {
  forDocument: (id: string) => { saveAsCopy: () => { toPromise: () => Promise<ArrayBuffer> }; download: () => void };
};

const capability = <T,>(registry: PluginRegistry, id: string): T | null => {
  const plugin = registry.getPlugin(id) as unknown as { provides?: () => T } | null;
  return plugin?.provides ? plugin.provides() : null;
};

const PdfWorkspace = forwardRef<PdfWorkspaceHandle, Props>(function PdfWorkspace(
  { language, dark, author, onDocumentsChange },
  ref
) {
  const viewerRef = useRef<PDFViewerRef>(null);
  const registryRef = useRef<PluginRegistry | null>(null);
  const changeRef = useRef(onDocumentsChange);
  changeRef.current = onDocumentsChange;

  const registry = async () => {
    if (registryRef.current) return registryRef.current;
    const r = await viewerRef.current?.registry;
    if (!r) throw new Error("PDF engine not ready");
    registryRef.current = r;
    return r;
  };

  const docName = (dm: DocManager) => {
    const id = dm.getActiveDocumentId();
    if (!id) return null;
    return dm.getDocumentState(id)?.name || dm.getActiveDocument()?.name || "document.pdf";
  };

  useImperativeHandle(ref, () => ({
    openFileDialog: () => {
      void registry().then((r) => capability<DocManager>(r, "document-manager")?.openFileDialog());
    },
    openBuffer: async (buffer, name) => {
      const dm = capability<DocManager>(await registry(), "document-manager");
      if (!dm) return;
      const res = await dm.openDocumentBuffer({ buffer, name }).toPromise();
      await res.task.toPromise();
    },
    openUrl: async (url, name) => {
      const dm = capability<DocManager>(await registry(), "document-manager");
      if (!dm) return;
      const res = await dm.openDocumentUrl({ url, name, mode: "full-fetch" }).toPromise();
      await res.task.toPromise();
    },
    exportActive: async () => {
      const r = await registry();
      const dm = capability<DocManager>(r, "document-manager");
      const ex = capability<Exporter>(r, "export");
      const id = dm?.getActiveDocumentId();
      if (!dm || !ex || !id) return null;
      const buffer = await ex.forDocument(id).saveAsCopy().toPromise();
      return { buffer, name: docName(dm) || "document.pdf" };
    },
    downloadActive: () => {
      void registry().then((r) => {
        const dm = capability<DocManager>(r, "document-manager");
        const id = dm?.getActiveDocumentId();
        if (id) capability<Exporter>(r, "export")?.forDocument(id).download();
      });
    },
  }));

  // La configuration n'est lue qu'au démarrage : langue et thème suivent ensuite via l'API
  const config = useMemo(
    () => ({
      wasmUrl: new URL(WASM_URL, window.location.origin).href,
      worker: true,
      tabBar: "multiple" as const,
      theme: { preference: (dark ? "dark" : "light") as "dark" | "light", light: appColors(), dark: appColors() },
      i18n: { defaultLocale: language === "ar" ? "ar" : language, fallbackLocale: "en" },
      annotations: { annotationAuthor: author || "Math infini" },
      export: { defaultFileName: "document.pdf" },
      fonts: { ui: { family: "var(--font-latin), var(--font-arabic), system-ui, sans-serif", stylesheetUrl: null } },
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }),
    []
  );

  const onReady = (r: PluginRegistry) => {
    registryRef.current = r;
    const i18n = capability<{ registerLocale: (l: unknown) => void; hasLocale: (c: string) => boolean; setLocale: (c: string) => void }>(r, "i18n");
    if (i18n && !i18n.hasLocale("ar")) i18n.registerLocale(ARABIC_LOCALE);
    if (i18n) i18n.setLocale(language);
    const dm = capability<DocManager>(r, "document-manager");
    if (!dm) return;
    const notify = () => changeRef.current?.(dm.getDocumentCount(), docName(dm));
    dm.onDocumentOpened(notify);
    dm.onDocumentClosed(notify);
    dm.onActiveDocumentChanged(notify);
    notify();
  };

  // Langue de l'application → langue du visualiseur
  useEffect(() => {
    const r = registryRef.current;
    if (!r) return;
    capability<{ setLocale: (c: string) => void }>(r, "i18n")?.setLocale(language);
  }, [language]);

  // Thème clair / sombre de l'application → visualiseur (les couleurs sont relues)
  useEffect(() => {
    const container = viewerRef.current?.container;
    if (!container) return;
    const id = window.requestAnimationFrame(() => {
      container.setTheme({ preference: dark ? "dark" : "light", light: appColors(), dark: appColors() });
    });
    return () => window.cancelAnimationFrame(id);
  }, [dark]);

  return (
    <div dir="ltr" style={{ direction: "ltr", textAlign: "left" }} className="h-full w-full">
      <PDFViewer ref={viewerRef} config={config} onReady={onReady} style={{ width: "100%", height: "100%" }} />
    </div>
  );
});

export default PdfWorkspace;

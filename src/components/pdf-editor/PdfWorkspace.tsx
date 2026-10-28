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
  /** Remplace le document actif par une nouvelle version (même nom, même onglet) */
  replaceActive: (buffer: ArrayBuffer, name: string) => Promise<void>;
  /** Commande du visualiseur (outils d'annotation, modes, zoom…) */
  runCommand: (id: string) => void;
  commandState: (id: string) => { active: boolean; disabled: boolean; label: string } | null;
  /** Rappel à chaque changement d'état des commandes (outil actif, annuler…) */
  onCommandsChange: (cb: () => void) => () => void;
  /** Miniatures du document actif (URL d'objets à libérer par l'appelant) */
  renderThumbnails: (scale?: number) => Promise<string[]>;
  activePageCount: () => number;
  /** Texte actuellement sélectionné dans le document ("" sinon) */
  selectedText: () => Promise<string>;
  /** Ferme le document actif sans enregistrer ses modifications */
  closeActive: () => Promise<void>;
  /** Copie le texte sélectionné dans le presse-papiers ; renvoie le texte copié ("" si rien) */
  copySelection: () => Promise<string>;
  /** Désactive l'outil d'annotation en cours (surligneur, forme…) */
  clearActiveTool: () => void;
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
type Commands = {
  execute: (id: string, documentId?: string, source?: "ui" | "api") => void;
  resolve: (id: string, documentId?: string) => { active: boolean; disabled: boolean; label: string };
  onCommandExecuted: (cb: () => void) => () => void;
  onCommandStateChanged: (cb: () => void) => () => void;
};
type UiCap = {
  getSchema: () => { toolbars: Record<string, { items: { id: string }[] }> };
  mergeSchema: (partial: unknown) => void;
  forDocument: (id: string) => { closeToolbarSlot: (placement: string, slot: string) => void };
};
type Engine = {
  renderThumbnail: (doc: unknown, page: unknown, o: { scaleFactor: number; withAnnotations: boolean; dpr: number }) => { toPromise: () => Promise<Blob> };
};
type Exporter = {
  forDocument: (id: string) => { saveAsCopy: () => { toPromise: () => Promise<ArrayBuffer> }; download: () => void };
};

/** Corrige le style d'édition des zones de texte venues d'autres éditeurs (sans bloquer l'ouverture) */
const prepare = async (buffer: ArrayBuffer) => {
  try {
    const { normalizeFreeText } = await import("@/lib/pdfFreeText");
    return await normalizeFreeText(buffer);
  } catch {
    return buffer;
  }
};

/*
 * La sélection de texte est dessinée en bleu plein avec un mélange « multiply » : sur un fond foncé
 * (bandeau bleu d'un titre) elle devient invisible. On la rend translucide et bordée.
 */
const SELECTION_CSS = `
div[style*="isolation: isolate"][style*="mix-blend-mode: multiply"] { mix-blend-mode: normal !important; }
div[style*="background: rgb(33, 150, 243)"] { background: rgba(33, 150, 243, 0.38) !important; box-shadow: 0 0 0 1px rgba(33, 150, 243, 0.9); }
`;
function injectSelectionStyle(container: unknown) {
  const root = (container as HTMLElement | null | undefined)?.shadowRoot;
  if (!root || root.getElementById("mi-selection-style")) return;
  const style = document.createElement("style");
  style.id = "mi-selection-style";
  style.textContent = SELECTION_CSS;
  root.appendChild(style);
}

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
      const res = await dm.openDocumentBuffer({ buffer: await prepare(buffer), name }).toPromise();
      await res.task.toPromise();
    },
    openUrl: async (url, name) => {
      const dm = capability<DocManager>(await registry(), "document-manager");
      if (!dm) return;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const res = await dm.openDocumentBuffer({ buffer: await prepare(await resp.arrayBuffer()), name }).toPromise();
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
    replaceActive: async (buffer, name) => {
      const dm = capability<DocManager & { closeDocument: (id: string) => { toPromise: () => Promise<void> }; getDocumentOrder: () => string[]; moveDocument: (id: string, to: number) => void }>(await registry(), "document-manager");
      if (!dm) return;
      const old = dm.getActiveDocumentId();
      const index = old ? dm.getDocumentOrder().indexOf(old) : -1;
      const res = await dm.openDocumentBuffer({ buffer, name }).toPromise();
      await res.task.toPromise();
      if (old) {
        await dm.closeDocument(old).toPromise();
        const fresh = (res as unknown as { documentId?: string }).documentId;
        if (fresh && index >= 0) dm.moveDocument(fresh, index);
      }
    },
    runCommand: (id) => {
      const r = registryRef.current;
      const dm = r && capability<DocManager>(r, "document-manager");
      const docId = dm?.getActiveDocumentId();
      if (!r || !docId) return;
      capability<Commands>(r, "commands")?.execute(id, docId, "ui");
      // Les modes ouvrent une barre d'outils secondaire du visualiseur : nos onglets la remplacent
      if (id.startsWith("mode:")) capability<UiCap>(r, "ui")?.forDocument(docId).closeToolbarSlot("top", "secondary");
    },
    commandState: (id) => {
      const r = registryRef.current;
      const dm = r && capability<DocManager>(r, "document-manager");
      const docId = dm?.getActiveDocumentId();
      if (!r || !docId) return null;
      try {
        return capability<Commands>(r, "commands")?.resolve(id, docId) ?? null;
      } catch {
        return null;
      }
    },
    onCommandsChange: (cb) => {
      const r = registryRef.current;
      const cmds = r && capability<Commands>(r, "commands");
      if (!cmds) return () => undefined;
      const a = cmds.onCommandExecuted(cb);
      const b = cmds.onCommandStateChanged(cb);
      return () => {
        a?.();
        b?.();
      };
    },
    activePageCount: () => {
      const r = registryRef.current;
      const doc = r && (capability<DocManager>(r, "document-manager")?.getActiveDocument() as { pageCount?: number } | null);
      return doc?.pageCount || 0;
    },
    renderThumbnails: async (scale = 0.35) => {
      const r = await registry();
      const dm = capability<DocManager>(r, "document-manager");
      const doc = dm?.getActiveDocument() as { pages?: unknown[] } | null | undefined;
      if (!doc?.pages) return [];
      const engine = r.getEngine() as unknown as Engine;
      const urls: string[] = [];
      for (const page of doc.pages) {
        const blob = await engine.renderThumbnail(doc, page, { scaleFactor: scale, withAnnotations: true, dpr: Math.min(window.devicePixelRatio || 1, 2) }).toPromise();
        urls.push(URL.createObjectURL(blob));
      }
      return urls;
    },
    selectedText: async () => {
      const r = registryRef.current;
      const docId = r && capability<DocManager>(r, "document-manager")?.getActiveDocumentId();
      const sel = r && capability<{ forDocument: (id: string) => { getSelectedText: () => { toPromise: () => Promise<string[]> } } }>(r, "selection");
      if (!sel || !docId) return "";
      try {
        return (await sel.forDocument(docId).getSelectedText().toPromise()).join(" ").replace(/\s+/g, " ").trim();
      } catch {
        return "";
      }
    },
    closeActive: async () => {
      const dm = capability<DocManager & { closeDocument: (id: string) => { toPromise: () => Promise<void> } }>(await registry(), "document-manager");
      const id = dm?.getActiveDocumentId();
      if (dm && id) await dm.closeDocument(id).toPromise();
    },
    copySelection: async () => {
      const r = registryRef.current;
      const docId = r && capability<DocManager>(r, "document-manager")?.getActiveDocumentId();
      const sel = r && capability<{ forDocument: (id: string) => { getSelectedText: () => { toPromise: () => Promise<string[]> } } }>(r, "selection");
      if (!sel || !docId) return "";
      let text = "";
      try {
        text = (await sel.forDocument(docId).getSelectedText().toPromise()).join("\n").trim();
      } catch {
        return "";
      }
      if (text) await navigator.clipboard.writeText(text);
      return text;
    },
    clearActiveTool: () => {
      const r = registryRef.current;
      const docId = r && capability<DocManager>(r, "document-manager")?.getActiveDocumentId();
      const annot = r && capability<{ forDocument: (id: string) => { getActiveTool: () => unknown; setActiveTool: (id: string | null) => void } }>(r, "annotation");
      if (!annot || !docId) return;
      const scope = annot.forDocument(docId);
      if (scope.getActiveTool()) scope.setActiveTool(null);
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
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const onReady = (r: PluginRegistry) => {
    registryRef.current = r;
    const i18n = capability<{ registerLocale: (l: unknown) => void; hasLocale: (c: string) => boolean; setLocale: (c: string) => void }>(r, "i18n");
    if (i18n && !i18n.hasLocale("ar")) i18n.registerLocale(ARABIC_LOCALE);
    if (i18n) i18n.setLocale(language);
    // Les onglets « Affichage / Annoter / Formes… » du visualiseur sont remplacés par notre ruban
    const ui = capability<UiCap>(r, "ui");
    const main = ui?.getSchema().toolbars["main-toolbar"];
    if (ui && main) {
      const hidden = new Set(["mode-select-button", "mode-tabs", "spacer-2", "document-menu-button", "divider-1"]);
      ui.mergeSchema({ toolbars: { "main-toolbar": { ...main, items: main.items.filter((it) => !hidden.has(it.id)) } } });
    }
    injectSelectionStyle(viewerRef.current?.container);
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

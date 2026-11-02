"use client";

/**
 * Cadre commun des Outils Office : barre de titre (accès rapide, nom du fichier,
 * état d'enregistrement), mode « Fichier » (Accueil, Nouveau, Ouvrir, Enregistrer
 * sous, Imprimer) et barre d'état.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowLeft, Check, Clock, Cloud, Download, FilePlus2, FileType2, FolderOpen, Loader2, Maximize2, Minimize2, Presentation,
  Printer, Redo2, Save, Sheet, Trash2, Undo2, X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { deleteOfficeFile, listOfficeFiles, type OfficeApp, type OfficeFileRecord } from "./officeStore";
import type { Tr } from "./useOfficeEnv";

export const OFFICE_ACCENT: Record<OfficeApp, { accent: string; soft: string; softDark: string; name: string }> = {
  word: { accent: "#2B579A", soft: "#DCE6F4", softDark: "#22324a", name: "Word" },
  excel: { accent: "#217346", soft: "#DCEFE3", softDark: "#1e3b2b", name: "Excel" },
  ppt: { accent: "#C43E1C", soft: "#F8E1DA", softDark: "#4a2a20", name: "PowerPoint" },
};

export const APP_ICON: Record<OfficeApp, typeof FileType2> = { word: FileType2, excel: Sheet, ppt: Presentation };

export interface NewTemplate {
  id: string;
  label: string;
  desc?: string;
  /** petite vignette (couleur, motif…) */
  thumb?: ReactNode;
}

export interface ExportFormat {
  id: string;
  label: string;
  ext: string;
  desc: string;
}

export type SaveState = "saved" | "saving" | "dirty";

export interface OfficeShellProps {
  app: OfficeApp;
  L: Tr;
  dir: "rtl" | "ltr";
  dark: boolean;
  fileName: string;
  onRename: (name: string) => void;
  saveState: SaveState;
  onSaveNow: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  templates: NewTemplate[];
  onNew: (templateId: string) => void;
  accept: string;
  onOpenFile: (file: File) => void;
  onOpenRecent: (id: string) => void;
  currentId: string | null;
  formats: ExportFormat[];
  onExport: (formatId: string) => Promise<void> | void;
  onPrint?: () => void;
  /** onglets + ruban */
  ribbon?: ReactNode;
  children: ReactNode;
  statusBar?: ReactNode;
  backstageOpen: boolean;
  setBackstageOpen: (v: boolean) => void;
  titleExtra?: ReactNode;
}

type Pane = "home" | "new" | "open" | "export" | "print";

export function OfficeShell(props: OfficeShellProps) {
  const { app, L, dir, dark, fileName, onRename, saveState, onSaveNow, ribbon, children, statusBar, backstageOpen, setBackstageOpen } = props;
  const meta = OFFICE_ACCENT[app];
  const AppIcon = APP_ICON[app];
  const [name, setName] = useState(fileName);
  const [full, setFull] = useState(false);
  useEffect(() => setName(fileName), [fileName]);

  // Ctrl+S : enregistrement immédiat (sinon le navigateur proposerait « Enregistrer la page »)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        onSaveNow();
        toast.success(L("Enregistré dans ce navigateur", "تم الحفظ في هذا المتصفح", "Saved in this browser"));
      }
      if (e.key === "Escape" && backstageOpen) setBackstageOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSaveNow, backstageOpen, setBackstageOpen, L]);

  const style = {
    "--office-accent": meta.accent,
    "--office-accent-soft": dark ? meta.softDark : meta.soft,
  } as CSSProperties;

  return (
    <div
      dir={dir}
      style={style}
      className={cn(
        "office-app relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-muted/40 text-foreground",
        full ? "fixed inset-0 z-[60] h-[100dvh] bg-background" : "h-full"
      )}
    >
      {/* Barre de titre */}
      <div className="flex h-10 shrink-0 items-center gap-1 px-2 text-white" style={{ background: meta.accent }}>
        <AppIcon className="h-5 w-5 shrink-0 opacity-95" strokeWidth={1.75} />
        <span className="hidden text-[13px] font-semibold sm:inline">{meta.name}</span>
        <div className="mx-1 h-5 w-px bg-white/30" />
        <TitleBtn title={L("Enregistrer (Ctrl+S)", "حفظ (Ctrl+S)", "Save (Ctrl+S)")} onClick={() => { onSaveNow(); toast.success(L("Enregistré dans ce navigateur", "تم الحفظ في هذا المتصفح", "Saved in this browser")); }}>
          <Save className="h-4 w-4" />
        </TitleBtn>
        {props.onUndo && (
          <TitleBtn title={L("Annuler (Ctrl+Z)", "تراجع (Ctrl+Z)", "Undo (Ctrl+Z)")} onClick={props.onUndo} disabled={props.canUndo === false}>
            <Undo2 className="h-4 w-4 rtl:-scale-x-100" />
          </TitleBtn>
        )}
        {props.onRedo && (
          <TitleBtn title={L("Rétablir (Ctrl+Y)", "إعادة (Ctrl+Y)", "Redo (Ctrl+Y)")} onClick={props.onRedo} disabled={props.canRedo === false}>
            <Redo2 className="h-4 w-4 rtl:-scale-x-100" />
          </TitleBtn>
        )}
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => { const n = name.trim() || fileName; setName(n); if (n !== fileName) onRename(n); }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            aria-label={L("Nom du fichier", "اسم الملف", "File name")}
            className="h-7 w-full max-w-[280px] min-w-0 rounded bg-white/10 px-2 text-center text-[13px] font-medium text-white placeholder:text-white/60 hover:bg-white/15 focus:bg-white focus:text-slate-900 focus:outline-none"
          />
          <span className="hidden shrink-0 items-center gap-1 text-[11px] text-white/85 md:flex">
            {saveState === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saveState === "saved" ? <Cloud className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
            {saveState === "saving" ? L("Enregistrement…", "جارٍ الحفظ…", "Saving…") : saveState === "saved" ? L("Enregistré", "محفوظ", "Saved") : L("Modifications non enregistrées", "تعديلات غير محفوظة", "Unsaved changes")}
          </span>
        </div>
        {props.titleExtra}
        <TitleBtn title={full ? L("Quitter le plein écran", "الخروج من ملء الشاشة", "Exit full screen") : L("Plein écran", "ملء الشاشة", "Full screen")} onClick={() => setFull((v) => !v)}>
          {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </TitleBtn>
      </div>

      {ribbon}

      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>

      {statusBar && (
        <div className="flex h-7 shrink-0 items-center gap-3 border-t bg-card px-3 text-[11.5px] text-muted-foreground">{statusBar}</div>
      )}

      {backstageOpen && <Backstage {...props} onClose={() => setBackstageOpen(false)} />}
    </div>
  );
}

function TitleBtn({ children, title, onClick, disabled }: { children: ReactNode; title: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded hover:bg-white/15 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Backstage(props: OfficeShellProps & { onClose: () => void }) {
  const { app, L, templates, onNew, accept, onOpenFile, onOpenRecent, currentId, formats, onExport, onPrint, onClose, fileName } = props;
  const meta = OFFICE_ACCENT[app];
  const [pane, setPane] = useState<Pane>("home");
  const [recents, setRecents] = useState<Omit<OfficeFileRecord, "data">[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = () => { listOfficeFiles(app).then(setRecents).catch(() => setRecents([])); };
  useEffect(reload, [app]);

  const nav: { id: Pane; label: string; icon: typeof Save }[] = [
    { id: "home", label: L("Accueil", "الرئيسية", "Home"), icon: Clock },
    { id: "new", label: L("Nouveau", "جديد", "New"), icon: FilePlus2 },
    { id: "open", label: L("Ouvrir", "فتح", "Open"), icon: FolderOpen },
    { id: "export", label: L("Enregistrer une copie", "حفظ نسخة", "Save a copy"), icon: Download },
    ...(onPrint ? [{ id: "print" as Pane, label: L("Imprimer / PDF", "طباعة / PDF", "Print / PDF"), icon: Printer }] : []),
  ];

  const openLocal = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) { onOpenFile(f); onClose(); }
    };
    input.click();
  };

  const fmtDate = (t: number) => new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  const RecentList = ({ limit }: { limit?: number }) => (
    <div className="divide-y rounded-lg border bg-card">
      {recents === null ? (
        <div className="flex items-center justify-center p-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : recents.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{L("Aucun fichier récent dans ce navigateur.", "لا توجد ملفات حديثة في هذا المتصفح.", "No recent files in this browser.")}</p>
      ) : (
        recents.slice(0, limit).map((r) => {
          const Icon = APP_ICON[app];
          return (
            <div key={r.id} className={cn("group flex items-center gap-3 px-3 py-2.5 hover:bg-muted/60", r.id === currentId && "bg-[color:var(--office-accent-soft)]")}>
              <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-start" onClick={() => { onOpenRecent(r.id); onClose(); }}>
                <Icon className="h-7 w-7 shrink-0" style={{ color: meta.accent }} strokeWidth={1.5} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.preview || ""}</span>
                </span>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{fmtDate(r.updatedAt)}</span>
              </button>
              {r.id !== currentId && (
                <button
                  type="button"
                  title={L("Supprimer", "حذف", "Delete")}
                  className="rounded p-1.5 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  onClick={async () => {
                    if (!window.confirm(L(`Supprimer « ${r.name} » de ce navigateur ?`, `حذف «${r.name}» من هذا المتصفح؟`, `Delete "${r.name}" from this browser?`))) return;
                    await deleteOfficeFile(r.id);
                    reload();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  const Templates = ({ limit }: { limit?: number }) => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {templates.slice(0, limit).map((t) => (
        <button key={t.id} type="button" onClick={() => { onNew(t.id); onClose(); }} className="group text-start">
          <div className="aspect-[4/3] overflow-hidden rounded-lg border bg-white shadow-sm ring-[color:var(--office-accent)] transition group-hover:ring-2 dark:bg-slate-900">
            {t.thumb}
          </div>
          <div className="mt-1.5 truncate text-[13px] font-medium">{t.label}</div>
          {t.desc && <div className="truncate text-xs text-muted-foreground">{t.desc}</div>}
        </button>
      ))}
    </div>
  );

  return (
    <div className="absolute inset-0 z-40 flex bg-background">
      <aside className="flex w-14 shrink-0 flex-col py-2 text-white sm:w-52" style={{ background: meta.accent }}>
        <button type="button" onClick={onClose} className="mx-2 mb-2 flex h-10 items-center gap-2 rounded-full px-3 hover:bg-white/15" title={L("Retour", "رجوع", "Back")}>
          <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
          <span className="hidden text-sm sm:inline">{L("Retour au document", "العودة إلى المستند", "Back to document")}</span>
        </button>
        {nav.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => (n.id === "print" && onPrint ? (onClose(), onPrint()) : setPane(n.id))}
            className={cn("flex h-11 items-center gap-3 px-4 text-start text-sm hover:bg-white/15", pane === n.id && "bg-white/20 font-semibold")}
            title={n.label}
          >
            <n.icon className="h-5 w-5 shrink-0" />
            <span className="hidden truncate sm:inline">{n.label}</span>
          </button>
        ))}
        <div className="flex-1" />
        <button type="button" onClick={onClose} className="flex h-11 items-center gap-3 px-4 text-sm hover:bg-white/15" title={L("Fermer", "إغلاق", "Close")}>
          <X className="h-5 w-5" />
          <span className="hidden sm:inline">{L("Fermer", "إغلاق", "Close")}</span>
        </button>
      </aside>
      <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-8">
        {pane === "home" && (
          <div className="mx-auto max-w-5xl space-y-8">
            <h2 className="text-2xl font-semibold">{L("Bonjour", "مرحبا", "Hello")} 👋</h2>
            <section>
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{L("Nouveau", "جديد", "New")}</h3>
              <Templates limit={4} />
            </section>
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground">{L("Récents", "الملفات الأخيرة", "Recent")}</h3>
                <button type="button" onClick={openLocal} className="flex items-center gap-1.5 text-sm font-medium" style={{ color: meta.accent }}>
                  <FolderOpen className="h-4 w-4" /> {L("Ouvrir depuis l'ordinateur", "فتح من الحاسوب", "Open from computer")}
                </button>
              </div>
              <RecentList limit={8} />
            </section>
          </div>
        )}
        {pane === "new" && (
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-5 text-2xl font-semibold">{L("Nouveau", "جديد", "New")}</h2>
            <Templates />
          </div>
        )}
        {pane === "open" && (
          <div className="mx-auto max-w-4xl space-y-5">
            <h2 className="text-2xl font-semibold">{L("Ouvrir", "فتح", "Open")}</h2>
            <button type="button" onClick={openLocal} className="flex w-full items-center gap-4 rounded-lg border bg-card p-4 text-start hover:bg-muted/60">
              <FolderOpen className="h-8 w-8" style={{ color: meta.accent }} />
              <span>
                <span className="block font-medium">{L("Parcourir l'ordinateur", "تصفح الحاسوب", "Browse this device")}</span>
                <span className="block text-sm text-muted-foreground">{accept.split(",").join("  ")}</span>
              </span>
            </button>
            <h3 className="text-sm font-semibold text-muted-foreground">{L("Fichiers enregistrés dans ce navigateur", "الملفات المحفوظة في هذا المتصفح", "Files saved in this browser")}</h3>
            <RecentList />
          </div>
        )}
        {pane === "export" && (
          <div className="mx-auto max-w-3xl space-y-3">
            <h2 className="mb-2 text-2xl font-semibold">{L("Enregistrer une copie", "حفظ نسخة", "Save a copy")}</h2>
            <p className="text-sm text-muted-foreground">
              {L("Le document est enregistré automatiquement dans ce navigateur. Téléchargez une copie pour l'ouvrir ailleurs ou l'envoyer.", "يُحفظ المستند تلقائيا في هذا المتصفح. حمّل نسخة لفتحها في مكان آخر أو إرسالها.", "The document is saved automatically in this browser. Download a copy to open it elsewhere or send it.")}
            </p>
            {formats.map((f) => (
              <button
                key={f.id}
                type="button"
                disabled={!!busy}
                onClick={async () => {
                  setBusy(f.id);
                  try {
                    await onExport(f.id);
                  } catch (e) {
                    console.error(e);
                    toast.error(L("L'export a échoué.", "فشل التصدير.", "Export failed."));
                  } finally {
                    setBusy(null);
                  }
                }}
                className="flex w-full items-center gap-4 rounded-lg border bg-card p-4 text-start hover:bg-muted/60 disabled:opacity-60"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-xs font-bold uppercase text-white" style={{ background: meta.accent }}>
                  {busy === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : f.ext}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{f.label}</span>
                  <span className="block text-sm text-muted-foreground">{fileName}.{f.ext} · {f.desc}</span>
                </span>
                <Check className="h-4 w-4 text-muted-foreground opacity-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

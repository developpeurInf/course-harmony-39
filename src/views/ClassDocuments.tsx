"use client";

/**
 * Menu de classe « Exams » : Devoirs maison (/rooms/:roomId/homework) et Exemples devoirs
 * (/rooms/:roomId/exam-examples). Élève : /homework et /exam-examples (toutes ses classes).
 * Professeur : déposer sujets et corrigés (tout format), masquer, publier le corrigé.
 * Élève : consulter (aperçu PDF, images, vidéos, Office) et télécharger.
 */
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  File as FileIcon,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  FolderOpen,
  House,
  Loader2,
  Lock,
  MoreVertical,
  Pencil,
  Plus,
  Presentation,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses } from "@/contexts/CourseContext";
import { useAccess } from "@/contexts/AccessContext";
import { useNavigate } from "@/lib/router";
import { useTr, type Tr } from "@/components/meet/useTr";
import SearchInput from "@/components/SearchInput";
import { matchesText } from "@/lib/search";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useClassModule, roomModuleOn } from "@/lib/classModules";
import { cn } from "@/lib/utils";
import {
  CLASS_DOCS_MAX_BYTES,
  cachedDocs,
  createDoc,
  deleteDoc,
  deleteDocFile,
  docKindPath,
  fileKind,
  fileUrl,
  formatSize,
  listDocs,
  missingDocsTable,
  updateDoc,
  uploadDocFile,
  type ClassDoc,
  type ClassDocKind,
  type DocFile,
  type DocFileRole,
} from "@/lib/classDocuments";

const kindIcon = (f: Pick<DocFile, "file_name" | "mime_type">) => {
  const k = fileKind(f);
  const e = f.file_name.split(".").pop()?.toLowerCase() || "";
  if (k === "pdf") return { Icon: FileText, tone: "bg-rose-500/10 text-rose-600 dark:text-rose-300" };
  if (k === "image") return { Icon: FileImage, tone: "bg-violet-500/10 text-violet-600 dark:text-violet-300" };
  if (k === "video") return { Icon: FileVideo, tone: "bg-sky-500/10 text-sky-600 dark:text-sky-300" };
  if (k === "audio") return { Icon: FileAudio, tone: "bg-amber-500/10 text-amber-600 dark:text-amber-300" };
  if (["xls", "xlsx", "ods", "csv"].includes(e)) return { Icon: FileSpreadsheet, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" };
  if (["ppt", "pptx", "odp"].includes(e)) return { Icon: Presentation, tone: "bg-orange-500/10 text-orange-600 dark:text-orange-300" };
  if (k === "office") return { Icon: FileText, tone: "bg-blue-500/10 text-blue-600 dark:text-blue-300" };
  if (["zip", "rar", "7z"].includes(e)) return { Icon: FileArchive, tone: "bg-slate-500/10 text-slate-600 dark:text-slate-300" };
  return { Icon: FileIcon, tone: "bg-muted text-muted-foreground" };
};

const kindText = (kind: ClassDocKind, tr: Tr) =>
  kind === "homework"
    ? {
        title: tr("Devoirs maison", "الفروض المنزلية", "Homework"),
        one: tr("devoir", "فرض", "homework"),
        add: tr("Ajouter un devoir", "إضافة فرض", "Add homework"),
        teacherHint: tr(
          "Déposez les sujets de devoirs maison et leurs corrigés, dans n'importe quel format. Le corrigé reste caché aux élèves jusqu'à ce que vous le publiiez.",
          "ضع مواضيع الفروض المنزلية وتصحيحاتها بأي صيغة. يبقى التصحيح مخفيا عن التلاميذ حتى تنشره.",
          "Upload homework sheets and their corrections in any format. Corrections stay hidden until you publish them.",
        ),
        studentHint: tr("Les devoirs maison donnés par votre professeur, à consulter et télécharger.", "الفروض المنزلية التي يقدمها أستاذك، للاطلاع والتحميل.", "Homework from your teacher, to view and download."),
        empty: tr("Aucun devoir maison pour l'instant", "لا توجد فروض منزلية بعد", "No homework yet"),
      }
    : {
        title: tr("Exemples devoirs", "نماذج الفروض", "Sample exams"),
        one: tr("exemple", "نموذج", "sample"),
        add: tr("Ajouter un exemple", "إضافة نموذج", "Add a sample"),
        teacherHint: tr(
          "Partagez des exemples d'examens et des examens corrigés (PDF, photos, Word, PowerPoint, tout format) pour aider vos élèves à se préparer.",
          "شارك نماذج امتحانات وامتحانات مصححة (PDF، صور، Word، PowerPoint، أي صيغة) لمساعدة تلاميذك على الاستعداد.",
          "Share sample and corrected exams (PDF, photos, Word, PowerPoint, any format) to help your students prepare.",
        ),
        studentHint: tr("Exemples d'examens et examens corrigés pour vous entraîner.", "نماذج امتحانات وامتحانات مصححة للتدرب.", "Sample and corrected exams to practise."),
        empty: tr("Aucun exemple pour l'instant", "لا توجد نماذج بعد", "No samples yet"),
      };

export default function ClassDocuments({ kind, roomId }: { kind: ClassDocKind; roomId?: string }) {
  const { user } = useAuth();
  const { rooms } = useCourses();
  const { can } = useAccess();
  const navigate = useNavigate();
  const classModule = useClassModule();
  const { tr, dir, locale } = useTr();
  const isTeacher = user?.role === "professor";
  const canManage = isTeacher && can("homework.manage");
  const K = kindText(kind, tr);
  const [items, setItems] = useState<ClassDoc[] | null>(() => cachedDocs(kind, roomId));
  const [missing, setMissing] = useState(false);
  const [search, setSearch] = useState("");
  const q = useDeferredValue(search);
  const [editing, setEditing] = useState<ClassDoc | "new" | null>(null);
  const [toDelete, setToDelete] = useState<ClassDoc | null>(null);
  const [preview, setPreview] = useState<DocFile | null>(null);

  const room = roomId ? (rooms || []).find((r) => r.id === roomId) : null;
  const roomName = (id: string) => (rooms || []).find((r) => r.id === id)?.name || "";
  const myRooms = useMemo(
    () => (isTeacher ? (rooms || []).filter((r) => r.professor_id === user?.id && !r.archived_at).sort((a, b) => a.name.localeCompare(b.name, "fr")) : []),
    [rooms, isTeacher, user?.id],
  );

  const load = useCallback(async () => {
    try {
      setItems(await listDocs(kind, roomId));
      setMissing(false);
    } catch (e: any) {
      setItems((cur) => cur ?? []);
      if (missingDocsTable(e)) setMissing(true);
      else toast.error(e?.message || "");
    }
  }, [kind, roomId]);
  useEffect(() => {
    setItems(cachedDocs(kind, roomId));
    void load();
    const onVis = () => !document.hidden && void load();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load, kind, roomId]);

  const shown = useMemo(
    () => (items || []).filter((d) => matchesText(q, d.title, d.description || "", roomName(d.room_id), ...d.files.map((f) => f.file_name))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, q, rooms],
  );

  const patch = async (d: ClassDoc, p: Partial<ClassDoc>, msg?: string) => {
    setItems((l) => (l || []).map((x) => (x.id === d.id ? { ...x, ...p } : x)));
    try {
      await updateDoc(d.id, p);
      if (msg) toast.success(msg);
    } catch (e: any) {
      toast.error(e?.message || "");
      void load();
    }
  };

  // Onglets du menu « Exams » (les deux sous-sections)
  const otherKind: ClassDocKind = kind === "homework" ? "example" : "homework";
  const room0 = room || null;
  const otherOpen = isTeacher || (room0 ? roomModuleOn(room0, otherKind === "homework" ? "homework" : "examples") : classModule(otherKind === "homework" ? "homework" : "examples"));

  return (
    <div dir={dir} className="mx-auto w-full max-w-5xl space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground rtl:normal-case rtl:tracking-normal">
            {tr("Exams", "الامتحانات", "Exams")}
            {room ? ` · ${room.name}` : ""}
          </p>
          <h1 className="mt-0.5 flex items-center gap-2 text-2xl font-semibold tracking-tight">
            {kind === "homework" ? <House className="h-6 w-6 text-primary" /> : <FolderOpen className="h-6 w-6 text-primary" />}
            {K.title}
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm">{isTeacher ? K.teacherHint : K.studentHint}</p>
        </div>
        {canManage && (
          <Button onClick={() => setEditing("new")} disabled={!roomId && myRooms.length === 0} className="gap-1.5 font-semibold">
            <Plus className="h-4 w-4" />
            {K.add}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {otherOpen ? (
          <div role="tablist" className="inline-flex w-fit rounded-lg border bg-muted/40 p-1 text-sm">
            {(["homework", "example"] as const).map((k) => {
              const active = k === kind;
              return (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => !active && navigate(docKindPath(k, roomId))}
                  className={cn(
                    "flex min-h-[36px] items-center gap-2 rounded-md px-3 font-medium transition-colors",
                    active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {k === "homework" ? <House className="h-4 w-4" /> : <FolderOpen className="h-4 w-4" />}
                  {kindText(k, tr).title}
                </button>
              );
            })}
          </div>
        ) : (
          <span />
        )}
        {(items?.length || 0) > 0 && (
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={tr("Rechercher (titre, fichier…)", "ابحث (العنوان، الملف…)", "Search (title, file…)")}
            className="sm:max-w-xs"
          />
        )}
      </div>

      {missing && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          {tr(
            "Cette section n'est pas encore installée : lancez le fichier supabase/migrations/20261120090000_class_documents.sql dans le SQL Editor de Supabase.",
            "هذا القسم غير مثبت بعد: شغّل الملف 20261120090000_class_documents.sql في محرر SQL الخاص بـ Supabase.",
            "This section is not installed yet: run supabase/migrations/20261120090000_class_documents.sql in the Supabase SQL Editor.",
          )}
        </div>
      )}

      {items === null ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {kind === "homework" ? <House className="h-7 w-7" /> : <FolderOpen className="h-7 w-7" />}
          </span>
          <p className="font-semibold">{items.length ? tr("Aucun résultat", "لا توجد نتائج", "No results") : K.empty}</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {items.length
              ? tr("Essayez un autre mot.", "جرّب كلمة أخرى.", "Try another word.")
              : isTeacher
                ? tr("Ajoutez un sujet et, si vous voulez, son corrigé : PDF, photo, Word, Excel, PowerPoint ou tout autre fichier.", "أضف موضوعا وتصحيحه إن شئت: PDF، صورة، Word، Excel، PowerPoint أو أي ملف آخر.", "Add a sheet and, if you like, its correction: PDF, photo, Word, Excel, PowerPoint or any other file.")
                : tr("Quand votre professeur en ajoutera, ils apparaîtront ici.", "عندما يضيفها أستاذك، ستظهر هنا.", "When your teacher adds some, they will appear here.")}
          </p>
          {canManage && !items.length && (
            <Button className="mt-4 gap-1.5" onClick={() => setEditing("new")} disabled={!roomId && myRooms.length === 0}>
              <Plus className="h-4 w-4" />
              {K.add}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((d) => (
            <DocCard
              key={d.id}
              doc={d}
              isTeacher={!!isTeacher}
              canManage={!!canManage}
              showRoom={!roomId}
              roomName={roomName(d.room_id)}
              tr={tr}
              locale={locale}
              onPreview={setPreview}
              onEdit={() => setEditing(d)}
              onDelete={() => setToDelete(d)}
              onToggleVisible={() =>
                void patch(d, { is_visible: !d.is_visible }, d.is_visible ? tr("Masqué aux élèves", "مخفي عن التلاميذ", "Hidden from students") : tr("Visible par les élèves", "مرئي للتلاميذ", "Visible to students"))
              }
              onToggleCorrection={() =>
                void patch(
                  d,
                  { correction_visible: !d.correction_visible },
                  d.correction_visible ? tr("Corrigé caché aux élèves", "التصحيح مخفي عن التلاميذ", "Correction hidden") : tr("Corrigé publié", "تم نشر التصحيح", "Correction published"),
                )
              }
            />
          ))}
        </div>
      )}

      {editing && (
        <DocEditor
          kind={kind}
          doc={editing === "new" ? null : editing}
          roomId={roomId}
          rooms={myRooms.map((r) => ({ id: r.id, name: r.name }))}
          tr={tr}
          dir={dir}
          locale={locale}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
          onChanged={() => void load()}
        />
      )}

      <FilePreview file={preview} onClose={() => setPreview(null)} tr={tr} dir={dir} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent dir={dir}>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr(`Supprimer « ${toDelete?.title} » ?`, `حذف « ${toDelete?.title} »؟`, `Delete “${toDelete?.title}”?`)}</AlertDialogTitle>
            <AlertDialogDescription>
              {tr("Le document et tous ses fichiers seront supprimés définitivement.", "سيتم حذف الوثيقة وجميع ملفاتها نهائيا.", "The document and all its files will be permanently deleted.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr("Annuler", "إلغاء", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={async () => {
                const d = toDelete;
                setToDelete(null);
                if (!d) return;
                setItems((l) => (l || []).filter((x) => x.id !== d.id));
                try {
                  await deleteDoc(d);
                  toast.success(tr("Supprimé", "تم الحذف", "Deleted"));
                } catch (e: any) {
                  toast.error(e?.message || "");
                  void load();
                }
              }}
            >
              {tr("Supprimer", "حذف", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */

async function downloadFile(f: DocFile, tr: Tr) {
  try {
    const url = await fileUrl(f, true);
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e: any) {
    toast.error(e?.message || tr("Téléchargement impossible", "تعذر التحميل", "Download failed"));
  }
}

function FileRow({ f, tr, locale, onPreview, muted }: { f: DocFile; tr: Tr; locale: string; onPreview: (f: DocFile) => void; muted?: boolean }) {
  const { Icon, tone } = kindIcon(f);
  return (
    <li className={cn("flex items-center gap-2.5 rounded-lg border bg-background/60 p-2 ps-2.5", muted && "border-dashed")}>
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", tone)}>
        <Icon className="h-4 w-4" />
      </span>
      <button type="button" onClick={() => onPreview(f)} className="min-w-0 flex-1 text-start" title={f.file_name}>
        <span className="block truncate text-sm font-medium hover:underline" dir="auto">
          {f.file_name}
        </span>
        <span className="block text-xs text-muted-foreground">
          {(f.file_name.split(".").pop() || "").toUpperCase()}
          {f.file_size ? ` · ${formatSize(f.file_size, locale)}` : ""}
        </span>
      </button>
      <Button variant="ghost" size="sm" className="h-9 gap-1.5 px-2.5" onClick={() => onPreview(f)} aria-label={tr("Ouvrir", "فتح", "Open")}>
        <Eye className="h-4 w-4" />
        <span className="hidden sm:inline">{tr("Ouvrir", "فتح", "Open")}</span>
      </Button>
      <Button variant="outline" size="sm" className="h-9 gap-1.5 px-2.5" onClick={() => void downloadFile(f, tr)} aria-label={tr("Télécharger", "تحميل", "Download")}>
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">{tr("Télécharger", "تحميل", "Download")}</span>
      </Button>
    </li>
  );
}

function DocCard({
  doc: d,
  isTeacher,
  canManage,
  showRoom,
  roomName,
  tr,
  locale,
  onPreview,
  onEdit,
  onDelete,
  onToggleVisible,
  onToggleCorrection,
}: {
  doc: ClassDoc;
  isTeacher: boolean;
  canManage: boolean;
  showRoom: boolean;
  roomName: string;
  tr: Tr;
  locale: string;
  onPreview: (f: DocFile) => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleVisible: () => void;
  onToggleCorrection: () => void;
}) {
  const subjects = d.files.filter((f) => f.role === "subject");
  const corrections = d.files.filter((f) => f.role === "correction");
  const due = d.due_at ? new Date(d.due_at) : null;
  const late = !!due && due.getTime() < Date.now();
  return (
    <article className={cn("rounded-xl border bg-card p-4 shadow-sm", isTeacher && !d.is_visible && "bg-muted/30")}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold leading-snug" dir="auto">
            {d.title}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {showRoom && roomName && <span className="rounded-full border px-2 py-0.5">{roomName}</span>}
            {due && (
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium", late ? "bg-muted text-muted-foreground" : "bg-amber-500/10 text-amber-700 dark:text-amber-300")}>
                <CalendarClock className="h-3 w-3" />
                {tr("À rendre le", "التسليم يوم", "Due")} {due.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })}
              </span>
            )}
            {isTeacher && !d.is_visible && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium">
                <EyeOff className="h-3 w-3" />
                {tr("Masqué aux élèves", "مخفي عن التلاميذ", "Hidden from students")}
              </span>
            )}
            <span>· {new Date(d.created_at).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}</span>
          </div>
        </div>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="-me-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={tr("Actions", "إجراءات", "Actions")}>
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="me-2 h-4 w-4" />
                {tr("Modifier, ajouter des fichiers", "تعديل، إضافة ملفات", "Edit, add files")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleVisible}>
                {d.is_visible ? <EyeOff className="me-2 h-4 w-4" /> : <Eye className="me-2 h-4 w-4" />}
                {d.is_visible ? tr("Masquer aux élèves", "إخفاء عن التلاميذ", "Hide from students") : tr("Montrer aux élèves", "إظهار للتلاميذ", "Show to students")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-rose-600 focus:text-rose-600" onClick={onDelete}>
                <Trash2 className="me-2 h-4 w-4" />
                {tr("Supprimer", "حذف", "Delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {d.description && (
        <p className="mt-2 whitespace-pre-line text-sm text-foreground/80" dir="auto">
          {d.description}
        </p>
      )}

      <div className={cn("mt-3 grid gap-3", (corrections.length > 0 || isTeacher) && "md:grid-cols-2")}>
        <section>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground rtl:normal-case rtl:tracking-normal">
            {tr("Sujet", "الموضوع", "Sheet")} {subjects.length > 1 ? `(${subjects.length})` : ""}
          </h3>
          {subjects.length ? (
            <ul className="space-y-1.5">
              {subjects.map((f) => (
                <FileRow key={f.id} f={f} tr={tr} locale={locale} onPreview={onPreview} />
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">{tr("Aucun fichier", "لا يوجد ملف", "No file")}</p>
          )}
        </section>
        {(corrections.length > 0 || isTeacher) && (
          <section>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground rtl:normal-case rtl:tracking-normal">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                {tr("Corrigé", "التصحيح", "Correction")} {corrections.length > 1 ? `(${corrections.length})` : ""}
              </h3>
              {canManage && corrections.length > 0 && (
                <label className="flex cursor-pointer items-center gap-2 text-xs">
                  <span className={cn("font-medium", d.correction_visible ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground")}>
                    {d.correction_visible ? tr("Publié aux élèves", "منشور للتلاميذ", "Published") : tr("Caché aux élèves", "مخفي عن التلاميذ", "Hidden")}
                  </span>
                  <Switch checked={d.correction_visible} onCheckedChange={onToggleCorrection} aria-label={tr("Publier le corrigé", "نشر التصحيح", "Publish correction")} />
                </label>
              )}
            </div>
            {corrections.length ? (
              <ul className="space-y-1.5">
                {corrections.map((f) => (
                  <FileRow key={f.id} f={f} tr={tr} locale={locale} onPreview={onPreview} muted={isTeacher && !d.correction_visible} />
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                {tr("Pas encore de corrigé. Ajoutez-le avec « Modifier ».", "لا يوجد تصحيح بعد. أضفه عبر « تعديل ».", "No correction yet. Add it with “Edit”.")}
              </p>
            )}
            {isTeacher && corrections.length > 0 && !d.correction_visible && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                {tr("Les élèves ne voient pas ce corrigé.", "التلاميذ لا يرون هذا التصحيح.", "Students can't see this correction.")}
              </p>
            )}
          </section>
        )}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */

type Pending = { key: string; file: File; role: DocFileRole };

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function DocEditor({
  kind,
  doc,
  roomId,
  rooms,
  tr,
  dir,
  locale,
  onClose,
  onSaved,
  onChanged,
}: {
  kind: ClassDocKind;
  doc: ClassDoc | null;
  roomId?: string;
  rooms: { id: string; name: string }[];
  tr: Tr;
  dir: "rtl" | "ltr";
  locale: string;
  onClose: () => void;
  onSaved: () => void;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState(doc?.title || "");
  const [description, setDescription] = useState(doc?.description || "");
  const [due, setDue] = useState(toLocalInput(doc?.due_at || null));
  const [visible, setVisible] = useState(doc?.is_visible ?? true);
  const [corrVisible, setCorrVisible] = useState(doc?.correction_visible ?? kind === "example");
  const [targetRoom, setTargetRoom] = useState(doc?.room_id || roomId || rooms[0]?.id || "");
  const [existing, setExisting] = useState<DocFile[]>(doc?.files || []);
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const add = (list: FileList | File[] | null, role: DocFileRole) => {
    const files = Array.from(list || []);
    const big = files.filter((f) => f.size > CLASS_DOCS_MAX_BYTES);
    if (big.length) toast.error(tr(`Trop lourd (50 Mo max.) : ${big.map((f) => f.name).join(", ")}`, `ملف كبير جدا (50 م.ب كحد أقصى): ${big.map((f) => f.name).join("، ")}`, `Too large (50 MB max): ${big.map((f) => f.name).join(", ")}`));
    const ok = files.filter((f) => f.size <= CLASS_DOCS_MAX_BYTES);
    setPending((p) => [...p, ...ok.map((file) => ({ key: `${file.name}-${file.size}-${Math.random()}`, file, role }))]);
  };

  const save = async () => {
    if (!user) return;
    const t = title.trim() || pending.find((p) => p.role === "subject")?.file.name.replace(/\.[^.]+$/, "") || "";
    if (!t) {
      toast.error(tr("Donnez un titre.", "أدخل عنوانا.", "Enter a title."));
      return;
    }
    if (!targetRoom) return;
    setBusy(tr("Enregistrement…", "جارٍ الحفظ…", "Saving…"));
    try {
      const patch = {
        title: t,
        description,
        due_at: kind === "homework" && due ? new Date(`${due}T23:59:00`).toISOString() : null,
        is_visible: visible,
        correction_visible: corrVisible,
      };
      let d: Pick<ClassDoc, "id" | "room_id">;
      if (doc) {
        await updateDoc(doc.id, patch);
        d = doc;
      } else {
        d = await createDoc(targetRoom, user.id, kind, patch);
      }
      const base = existing.length;
      let failed = 0;
      for (let i = 0; i < pending.length; i++) {
        const p = pending[i];
        setBusy(tr(`Envoi ${i + 1}/${pending.length} : ${p.file.name}`, `رفع ${i + 1}/${pending.length}: ${p.file.name}`, `Uploading ${i + 1}/${pending.length}: ${p.file.name}`));
        try {
          await uploadDocFile(d, p.file, p.role, base + i);
        } catch (e: any) {
          failed++;
          toast.error(`${p.file.name} : ${e?.message || tr("échec de l'envoi", "فشل الرفع", "upload failed")}`);
        }
      }
      if (!failed) toast.success(doc ? tr("Modifications enregistrées", "تم حفظ التعديلات", "Changes saved") : tr("Ajouté", "تمت الإضافة", "Added"));
      onSaved();
    } catch (e: any) {
      toast.error(missingDocsTable(e) ? tr("Lancez d'abord la migration SQL des devoirs.", "شغّل أولا ترحيل SQL الخاص بالفروض.", "Run the homework SQL migration first.") : e?.message || "");
      setBusy(null);
    }
  };

  const removeExisting = async (f: DocFile) => {
    setExisting((l) => l.filter((x) => x.id !== f.id));
    try {
      await deleteDocFile(f);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "");
      setExisting((l) => [...l, f]);
    }
  };

  const zone = (role: DocFileRole) => {
    const ex = existing.filter((f) => f.role === role);
    const pe = pending.filter((p) => p.role === role);
    return (
      <DropZone
        role={role}
        tr={tr}
        disabled={!!busy}
        onFiles={(fl) => add(fl, role)}
        title={role === "subject" ? tr("Sujet / énoncé", "الموضوع / النص", "Sheet / questions") : tr("Corrigé", "التصحيح", "Correction")}
      >
        {(ex.length > 0 || pe.length > 0) && (
          <ul className="mt-2 space-y-1">
            {ex.map((f) => (
              <li key={f.id} className="flex items-center gap-2 rounded-md bg-muted/60 px-2 py-1.5 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span className="min-w-0 flex-1 truncate" dir="auto">{f.file_name}</span>
                <span className="text-muted-foreground">{formatSize(f.file_size, locale)}</span>
                <button type="button" disabled={!!busy} onClick={() => void removeExisting(f)} className="rounded p-1 text-muted-foreground hover:bg-background hover:text-rose-600" aria-label={tr("Retirer", "إزالة", "Remove")}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
            {pe.map((p) => (
              <li key={p.key} className="flex items-center gap-2 rounded-md border border-dashed px-2 py-1.5 text-xs">
                <Upload className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate" dir="auto">{p.file.name}</span>
                <span className="text-muted-foreground">{formatSize(p.file.size, locale)}</span>
                <button type="button" disabled={!!busy} onClick={() => setPending((l) => l.filter((x) => x.key !== p.key))} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={tr("Retirer", "إزالة", "Remove")}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </DropZone>
    );
  };

  const K = kindText(kind, tr);
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent dir={dir} className="max-h-[92vh] w-[95vw] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{doc ? tr("Modifier", "تعديل", "Edit") + ` · ${doc.title}` : K.add}</DialogTitle>
          <DialogDescription>
            {tr("Tous les formats sont acceptés : PDF, photos, Word, Excel, PowerPoint, GeoGebra, ZIP… (50 Mo max. par fichier).", "جميع الصيغ مقبولة: PDF، صور، Word، Excel، PowerPoint، GeoGebra، ZIP… (50 م.ب كحد أقصى لكل ملف).", "Any format: PDF, photos, Word, Excel, PowerPoint, GeoGebra, ZIP… (50 MB max per file).")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!roomId && !doc && rooms.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="cd-room">{tr("Classe", "القسم", "Class")}</Label>
              <select id="cd-room" value={targetRoom} onChange={(e) => setTargetRoom(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="cd-title">{tr("Titre", "العنوان", "Title")}</Label>
            <Input
              id="cd-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              dir="auto"
              maxLength={200}
              placeholder={kind === "homework" ? tr("ex. Devoir maison n°2 : les fonctions", "مثال: الفرض المنزلي رقم 2: الدوال", "e.g. Homework 2: functions") : tr("ex. Examen régional 2025 corrigé", "مثال: الامتحان الجهوي 2025 مع التصحيح", "e.g. 2025 regional exam with correction")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cd-desc">{tr("Consigne ou description (facultatif)", "التعليمات أو الوصف (اختياري)", "Instructions or description (optional)")}</Label>
            <Textarea id="cd-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} dir="auto" maxLength={5000} />
          </div>
          {kind === "homework" && (
            <div className="space-y-1.5">
              <Label htmlFor="cd-due">{tr("À rendre le (facultatif)", "تاريخ التسليم (اختياري)", "Due date (optional)")}</Label>
              <Input id="cd-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-full sm:w-56" />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {zone("subject")}
            {zone("correction")}
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
              <span>
                <span className="block font-medium">{tr("Visible par les élèves", "مرئي للتلاميذ", "Visible to students")}</span>
                <span className="block text-xs text-muted-foreground">{tr("Décochez pour préparer à l'avance.", "ألغِ التحديد للتحضير مسبقا.", "Turn off to prepare in advance.")}</span>
              </span>
              <Switch checked={visible} onCheckedChange={setVisible} />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
              <span>
                <span className="block font-medium">{tr("Corrigé publié aux élèves", "التصحيح منشور للتلاميذ", "Correction published to students")}</span>
                <span className="block text-xs text-muted-foreground">{tr("Sinon, le corrigé reste caché ; vous le publiez quand vous voulez.", "وإلا يبقى التصحيح مخفيا؛ تنشره متى شئت.", "Otherwise it stays hidden; publish it whenever you like.")}</span>
              </span>
              <Switch checked={corrVisible} onCheckedChange={setCorrVisible} />
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {busy && (
            <span className="me-auto flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              <span className="truncate">{busy}</span>
            </span>
          )}
          <Button variant="outline" onClick={onClose} disabled={!!busy}>
            {tr("Annuler", "إلغاء", "Cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={!!busy} className="font-semibold">
            {doc ? tr("Enregistrer", "حفظ", "Save") : tr("Ajouter", "إضافة", "Add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DropZone({ role, title, tr, disabled, onFiles, children }: { role: DocFileRole; title: string; tr: Tr; disabled?: boolean; onFiles: (f: FileList | null) => void; children?: React.ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={cn("rounded-lg border-2 border-dashed p-3 transition-colors", over ? "border-primary bg-primary/5" : "border-border")}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) onFiles(e.dataTransfer.files);
      }}
    >
      <p className="flex items-center gap-1.5 text-sm font-medium">
        {role === "correction" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <FileText className="h-4 w-4 text-primary" />}
        {title}
      </p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md bg-muted/60 px-3 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
      >
        <Upload className="h-4 w-4" />
        {tr("Choisir ou déposer des fichiers", "اختر أو اسحب الملفات", "Choose or drop files")}
      </button>
      <input
        ref={input}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Le navigateur sait-il afficher un PDF dans un cadre ? (non sur Android, iPhone, iPad) */
function inlinePdf() {
  if (typeof navigator === "undefined") return true;
  const ua = navigator.userAgent || "";
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return false;
  // iPad récent : se présente comme un Mac avec écran tactile
  return !(/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
}

function FilePreview({ file, onClose, tr, dir }: { file: DocFile | null; onClose: () => void; tr: Tr; dir: "rtl" | "ltr" }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    setUrl(null);
    setErr(false);
    if (!file) return;
    let alive = true;
    fileUrl(file)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [file]);
  const k = file ? fileKind(file) : "other";
  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir={dir} className="flex h-[92vh] w-[96vw] max-w-5xl flex-col gap-3 p-3 sm:p-4">
        <DialogHeader className="pe-8">
          <DialogTitle className="truncate text-base" dir="auto">
            {file?.file_name}
          </DialogTitle>
          <DialogDescription className="sr-only">{tr("Aperçu du fichier", "معاينة الملف", "File preview")}</DialogDescription>
        </DialogHeader>
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border bg-muted/40">
          {!url && !err && (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {err && <p className="p-6 text-center text-sm text-muted-foreground">{tr("Fichier introuvable ou accès refusé.", "الملف غير موجود أو الوصول مرفوض.", "File not found or access denied.")}</p>}
          {url && k === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={file?.file_name || ""} className="h-full w-full object-contain" />
          )}
          {url && k === "pdf" && inlinePdf() && <iframe src={url} title={file?.file_name} className="h-full w-full border-0 bg-white" />}
          {url && k === "pdf" && !inlinePdf() && (
            // Android et iPhone/iPad n'affichent pas un PDF dans un cadre (page blanche ou 1re page seulement)
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <FileIcon className="h-10 w-10 text-rose-500" />
              <p className="max-w-sm text-sm text-muted-foreground">
                {tr("Sur téléphone et tablette, le PDF s'ouvre dans le lecteur de l'appareil.", "على الهاتف واللوحة، يفتح ملف PDF في قارئ الجهاز.", "On phones and tablets, the PDF opens in the device viewer.")}
              </p>
              <Button asChild className="min-h-[44px] gap-1.5">
                <a href={url} target="_blank" rel="noopener noreferrer">
                  {tr("Ouvrir le PDF", "فتح ملف PDF", "Open the PDF")}
                </a>
              </Button>
            </div>
          )}
          {url && k === "video" && <video src={url} controls playsInline className="h-full w-full bg-black object-contain" />}
          {url && k === "audio" && (
            <div className="flex h-full items-center justify-center p-6">
              <audio src={url} controls className="w-full max-w-md" />
            </div>
          )}
          {url && k === "office" && (
            <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`} title={file?.file_name} className="h-full w-full border-0 bg-white" />
          )}
          {url && k === "text" && <iframe src={url} title={file?.file_name} className="h-full w-full border-0 bg-white" />}
          {url && k === "other" && (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <FileIcon className="h-10 w-10 text-muted-foreground" />
              <p className="max-w-sm text-sm text-muted-foreground">
                {tr("Pas d'aperçu pour ce type de fichier. Téléchargez-le pour l'ouvrir.", "لا توجد معاينة لهذا النوع من الملفات. حمّله لفتحه.", "No preview for this file type. Download it to open.")}
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {url && k !== "other" && (
            <Button variant="ghost" size="sm" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                {tr("Ouvrir dans un onglet", "فتح في علامة تبويب", "Open in a tab")}
              </a>
            </Button>
          )}
          <Button size="sm" className="gap-1.5" onClick={() => file && void downloadFile(file, tr)}>
            <Download className="h-4 w-4" />
            {tr("Télécharger", "تحميل", "Download")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

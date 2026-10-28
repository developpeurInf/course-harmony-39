import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { ChevronDown, Download, FileText, FolderOpen, HardDrive, Loader2, Save, Search, Upload } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAccess } from "@/contexts/AccessContext";
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

  if (user && user.role !== "professor") return <Navigate to="/dashboard" replace />;

  const hasDoc = docCount > 0;
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
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="flex h-full min-h-0 flex-col">
      {/* Barre d'actions */}
      <div className="flex min-h-12 flex-wrap items-center justify-end gap-2 border-b bg-card px-3 py-2 sm:px-4">
        <div className="me-auto hidden min-w-0 items-center gap-2 sm:flex">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          <span className={cn("max-w-[48vw] truncate text-sm", activeName ? "font-medium" : "text-muted-foreground")} title={activeName || undefined}>
            {activeName || t("Aucun document ouvert", "لا توجد وثيقة مفتوحة", "No document open")}
          </span>
          {docCount > 1 && (
            <span className="shrink-0 rounded border px-1.5 text-2xs text-muted-foreground">
              {docCount} {t("ouverts", "مفتوحة", "open")}
            </span>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <FolderOpen className="h-4 w-4" strokeWidth={1.75} />
              {t("Ouvrir", "فتح", "Open")}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
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

        <Button variant="outline" size="sm" className="gap-1.5" disabled={!hasDoc} onClick={() => workspace.current?.downloadActive()}>
          <Download className="h-4 w-4" strokeWidth={1.75} />
          <span className="hidden sm:inline">{t("Télécharger", "تحميل", "Download")}</span>
        </Button>
        <Button size="sm" className="gap-1.5" disabled={!hasDoc || !canUpload || courses.length === 0} onClick={openSaveDialog}>
          <Save className="h-4 w-4" strokeWidth={1.75} />
          <span className="sm:hidden">{t("Enregistrer", "حفظ", "Save")}</span>
          <span className="hidden sm:inline">{t("Enregistrer dans un cours", "حفظ في درس", "Save to a course")}</span>
        </Button>

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
      </div>

      {/* Espace de travail */}
      <div className="relative min-h-0 flex-1">
        <PdfWorkspace ref={workspace} language={lang} dark={dark} author={user?.name} onDocumentsChange={onDocumentsChange} />

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

      {/* Enregistrer dans un cours */}
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

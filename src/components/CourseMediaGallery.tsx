import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  BookOpen, ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Film, Image as ImageIcon,
  Layers, Link2, Play, X, Youtube,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  countByKind, formatFileSize, getMaterialDownloadUrl, getMaterialKind, getMaterialThumbnail,
  getMaterialUrl, isVideoKind, parseVideoUrl, sortMaterials, type CourseMaterialLike,
} from "@/lib/courseMedia";

/* NB: iOS 12 ne gère ni `aspect-ratio` ni `inset` → ratios faits avec padding-top et top/left/w/h. */

const useTr = () => {
  const { language } = useLanguage();
  return (ar: string, fr: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en);
};

const triggerDownload = (m: CourseMaterialLike) => {
  const a = document.createElement("a");
  a.href = getMaterialDownloadUrl(m);
  a.download = m.file_name;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

const displayName = (m: CourseMaterialLike) => {
  const k = getMaterialKind(m);
  if ((k === "youtube" || k === "vimeo" || k === "link") && m.file_name === m.file_path) {
    return k === "youtube" ? "Vidéo YouTube" : k === "vimeo" ? "Vidéo Vimeo" : m.file_name;
  }
  return m.file_name.replace(/\.(mp4|webm|mov|m4v|jpe?g|png|webp|gif|pdf)$/i, "");
};

/* ------------------------------------------------------------------ */
/* Video                                                               */
/* ------------------------------------------------------------------ */

export const VideoPlayer = ({ material }: { material: CourseMaterialLike }) => {
  const tr = useTr();
  const kind = getMaterialKind(material);
  const parsed = kind === "youtube" || kind === "vimeo" ? parseVideoUrl(material.file_path) : null;
  const [playing, setPlaying] = useState(false);
  const src = getMaterialUrl(material);
  // Hauteur / largeur réelle de la vidéo (16:9 par défaut, 9:16 pour les YouTube Shorts)
  const [ratio, setRatio] = useState(() => (/youtube\.com\/shorts\//i.test(material.file_path) ? 16 / 9 : 9 / 16));
  // Le lecteur épouse la vidéo : jamais plus haut que 70 % de l'écran, centré
  const maxWidth = `calc(70vh / ${ratio.toFixed(4)})`;

  return (
    <div className="group mx-auto w-full overflow-hidden rounded-2xl border bg-card shadow-sm" style={{ maxWidth }}>
      <div className="relative w-full bg-black" style={{ paddingTop: `${(ratio * 100).toFixed(3)}%` }}>
        {parsed ? (
          playing ? (
            <iframe
              src={parsed.embedUrl}
              title={displayName(material)}
              className="absolute top-0 left-0 h-full w-full"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              frameBorder={0}
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="absolute top-0 left-0 h-full w-full"
              aria-label={tr("تشغيل", "Lire la vidéo", "Play video")}
            >
              {parsed.thumbnail ? (
                <span className="block h-full w-full bg-gradient-to-br from-red-700 to-zinc-900">
                  <img src={parsed.thumbnail} alt="" className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                </span>
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-violet-700 to-indigo-900" />
              )}
              <span className="absolute top-0 left-0 flex h-full w-full items-center justify-center bg-black/20">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 shadow-xl transition-transform group-hover:scale-110">
                  <Play className="ml-1 h-7 w-7 fill-current text-red-600" />
                </span>
              </span>
            </button>
          )
        ) : (
          <video
            className="absolute top-0 left-0 h-full w-full bg-black"
            src={`${src}#t=0.1`}
            controls
            playsInline
            preload="metadata"
            onLoadedMetadata={e => {
              const v = e.currentTarget;
              if (v.videoWidth > 0 && v.videoHeight > 0) setRatio(v.videoHeight / v.videoWidth);
            }}
          >
            {tr("المتصفح لا يدعم تشغيل الفيديو", "Votre navigateur ne peut pas lire cette vidéo", "Your browser cannot play this video")}
          </video>
        )}
      </div>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`rounded-lg p-2 ${kind === "youtube" ? "bg-red-500/10" : "bg-violet-500/10"}`}>
          {kind === "youtube" ? <Youtube className="h-4 w-4 text-red-500" /> : <Film className="h-4 w-4 text-violet-500" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" title={material.file_name}>{displayName(material)}</p>
          <p className="text-xs text-muted-foreground">
            {kind === "youtube" ? "YouTube" : kind === "vimeo" ? "Vimeo" : formatFileSize(material.file_size) || tr("فيديو", "Vidéo", "Video")}
          </p>
        </div>
        {parsed ? (
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild title={tr("فتح", "Ouvrir", "Open")}>
            <a href={material.file_path} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => triggerDownload(material)} title={tr("تحميل", "Télécharger", "Download")}>
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Image lightbox                                                      */
/* ------------------------------------------------------------------ */

const ImageLightbox = ({
  images, index, onIndexChange, onClose,
}: {
  images: CourseMaterialLike[];
  index: number | null;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) => {
  const tr = useTr();
  const touchX = useRef<number | null>(null);
  const open = index !== null && images.length > 0;
  const current = open ? images[index!] : null;
  const go = (delta: number) => {
    if (index === null) return;
    onIndexChange((index + delta + images.length) % images.length);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(document.dir === "rtl" ? -1 : 1);
      if (e.key === "ArrowLeft") go(document.dir === "rtl" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <DialogPrimitive.Root open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed top-0 left-0 z-[80] h-full w-full bg-black/90" />
        <DialogPrimitive.Content
          className="fixed top-0 left-0 z-[81] flex h-full w-full flex-col outline-none"
          onTouchStart={e => { touchX.current = e.touches[0]?.clientX ?? null; }}
          onTouchEnd={e => {
            if (touchX.current === null) return;
            const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
            touchX.current = null;
          }}
        >
          <DialogPrimitive.Title className="sr-only">{current ? displayName(current) : ""}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{tr("عرض الصورة", "Aperçu de l'image", "Image preview")}</DialogPrimitive.Description>
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-white" dir="ltr">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{current ? displayName(current) : ""}</p>
              <p className="text-xs text-white/60">{index !== null ? index + 1 : 0} / {images.length}</p>
            </div>
            <div className="flex items-center gap-1">
              {current && (
                <button type="button" onClick={() => triggerDownload(current)} className="rounded-full p-2 hover:bg-white/10" aria-label="Download">
                  <Download className="h-5 w-5" />
                </button>
              )}
              <DialogPrimitive.Close className="rounded-full p-2 hover:bg-white/10" aria-label="Close">
                <X className="h-6 w-6" />
              </DialogPrimitive.Close>
            </div>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4 sm:px-16" dir="ltr">
            {current && (
              <img
                key={current.id}
                src={getMaterialUrl(current)}
                alt={displayName(current)}
                className="max-h-full max-w-full select-none rounded-lg object-contain shadow-2xl animate-fade-in"
                draggable={false}
              />
            )}
            {images.length > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20 sm:left-4" aria-label="Previous">
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button type="button" onClick={() => go(1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20 sm:right-4" aria-label="Next">
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex justify-center gap-2 overflow-x-auto px-4 pb-4" dir="ltr">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => onIndexChange(i)}
                  className={`h-12 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-opacity ${i === index ? "border-white opacity-100" : "border-transparent opacity-50 hover:opacity-80"}`}
                >
                  <img src={getMaterialUrl(img)} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

/* ------------------------------------------------------------------ */
/* Gallery                                                             */
/* ------------------------------------------------------------------ */

type Filter = "all" | "video" | "image" | "doc";

const SectionTitle = ({ icon, label, count, color }: { icon: ReactNode; label: string; count: number; color: string }) => (
  <div className="mb-3 flex items-center gap-2">
    <span className={`rounded-lg p-1.5 ${color}`}>{icon}</span>
    <h3 className="text-sm font-bold uppercase tracking-wide">{label}</h3>
    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{count}</span>
  </div>
);

export const CourseMediaGallery = ({
  materials, showFilters = true,
}: {
  materials: CourseMaterialLike[];
  showFilters?: boolean;
}) => {
  const tr = useTr();
  const [filter, setFilter] = useState<Filter>("all");
  const [lightbox, setLightbox] = useState<number | null>(null);

  const sorted = useMemo(() => sortMaterials(materials), [materials]);
  const videos = sorted.filter(m => isVideoKind(getMaterialKind(m)));
  const images = sorted.filter(m => getMaterialKind(m) === "image");
  const docs = sorted.filter(m => { const k = getMaterialKind(m); return !isVideoKind(k) && k !== "image"; });

  const filters: { key: Filter; label: string; count: number; icon: ReactNode }[] = [
    { key: "all", label: tr("الكل", "Tout", "All"), count: sorted.length, icon: <Layers className="h-3.5 w-3.5" /> },
    { key: "video", label: tr("فيديوهات", "Vidéos", "Videos"), count: videos.length, icon: <Film className="h-3.5 w-3.5" /> },
    { key: "image", label: tr("صور", "Images", "Images"), count: images.length, icon: <ImageIcon className="h-3.5 w-3.5" /> },
    { key: "doc", label: tr("وثائق", "Documents", "Documents"), count: docs.length, icon: <FileText className="h-3.5 w-3.5" /> },
  ];
  const visibleFilters = filters.filter(f => f.key === "all" || f.count > 0);
  const show = (k: Filter) => filter === "all" || filter === k;

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-12 text-center text-muted-foreground">
        <BookOpen className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm">{tr("لا توجد مواد لهذا الدرس بعد", "Aucun support pour ce cours pour l'instant", "No materials for this course yet")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {showFilters && visibleFilters.length > 2 && (
        <div className="flex flex-wrap gap-2">
          {visibleFilters.map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === f.key ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
              }`}
            >
              {f.icon}{f.label}<span className="opacity-70">{f.count}</span>
            </button>
          ))}
        </div>
      )}

      {show("video") && videos.length > 0 && (
        <section>
          <SectionTitle icon={<Film className="h-4 w-4 text-violet-600" />} color="bg-violet-500/10" label={tr("فيديوهات", "Vidéos", "Videos")} count={videos.length} />
          <div className={`grid items-start gap-4 ${videos.length > 1 ? "md:grid-cols-2" : ""}`}>
            {videos.map(v => <VideoPlayer key={v.id} material={v} />)}
          </div>
        </section>
      )}

      {show("image") && images.length > 0 && (
        <section>
          <SectionTitle icon={<ImageIcon className="h-4 w-4 text-sky-600" />} color="bg-sky-500/10" label={tr("صور", "Images", "Images")} count={images.length} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((img, i) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setLightbox(i)}
                className="group relative block w-full overflow-hidden rounded-xl border bg-muted shadow-sm"
                style={{ paddingTop: "75%" }}
              >
                <img
                  src={getMaterialUrl(img)}
                  alt={displayName(img)}
                  loading="lazy"
                  className="absolute top-0 left-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <span className="absolute bottom-0 left-0 right-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-2 pt-6 text-start text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {displayName(img)}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {show("doc") && docs.length > 0 && (
        <section>
          <SectionTitle icon={<FileText className="h-4 w-4 text-rose-600" />} color="bg-rose-500/10" label={tr("وثائق", "Documents", "Documents")} count={docs.length} />
          <div className="grid gap-3 sm:grid-cols-2">
            {docs.map(d => {
              const k = getMaterialKind(d);
              return (
                <div key={d.id} className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm transition-shadow hover:shadow-md">
                  <div className={`flex h-12 w-10 shrink-0 items-center justify-center rounded-md ${k === "pdf" ? "bg-rose-500/10" : "bg-slate-500/10"}`}>
                    {k === "link" ? <Link2 className="h-5 w-5 text-slate-500" /> : <FileText className="h-5 w-5 text-rose-500" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold" title={d.file_name}>{displayName(d)}</p>
                    <p className="text-xs text-muted-foreground">{k === "pdf" ? "PDF" : k === "link" ? tr("رابط", "Lien", "Link") : tr("ملف", "Fichier", "File")}{d.file_size ? ` · ${formatFileSize(d.file_size)}` : ""}</p>
                  </div>
                  <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs" onClick={() => window.open(getMaterialUrl(d), "_blank", "noopener,noreferrer")}>
                    <ExternalLink className="h-3.5 w-3.5 sm:mr-1" />
                    <span className="hidden sm:inline">{tr("فتح", "Ouvrir", "Open")}</span>
                  </Button>
                  {k !== "link" && (
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => triggerDownload(d)} title={tr("تحميل", "Télécharger", "Download")}>
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <ImageLightbox images={images} index={lightbox} onIndexChange={setLightbox} onClose={() => setLightbox(null)} />
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Course viewer dialog                                                */
/* ------------------------------------------------------------------ */

export const CourseViewerDialog = ({
  open, onOpenChange, title, description, materials, subtitle,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string | null;
  subtitle?: string;
  materials: CourseMaterialLike[];
}) => {
  const tr = useTr();
  const c = countByKind(materials);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[96vw] max-w-5xl flex-col overflow-hidden p-0">
        <div className="shrink-0 border-b bg-gradient-to-br from-primary/10 via-background to-background px-5 pb-4 pt-5 sm:px-7">
          <DialogHeader className="space-y-1.5 text-start pr-8">
            {subtitle && <p className="text-xs font-semibold uppercase tracking-wider text-primary">{subtitle}</p>}
            <DialogTitle className="text-xl font-bold leading-tight sm:text-2xl">{title}</DialogTitle>
            <DialogDescription className={description ? "whitespace-pre-line text-sm" : "sr-only"}>
              {description || tr("مواد الدرس", "Supports du cours", "Course materials")}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {c.video > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2.5 py-1 font-semibold text-violet-700 dark:text-violet-300"><Film className="h-3.5 w-3.5" />{c.video} {tr("فيديو", c.video > 1 ? "vidéos" : "vidéo", c.video > 1 ? "videos" : "video")}</span>}
            {c.image > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-1 font-semibold text-sky-700 dark:text-sky-300"><ImageIcon className="h-3.5 w-3.5" />{c.image} {tr("صورة", c.image > 1 ? "images" : "image", c.image > 1 ? "images" : "image")}</span>}
            {c.pdf + c.other > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 font-semibold text-rose-700 dark:text-rose-300"><FileText className="h-3.5 w-3.5" />{c.pdf + c.other} {tr("وثيقة", "document" + (c.pdf + c.other > 1 ? "s" : ""), "document" + (c.pdf + c.other > 1 ? "s" : ""))}</span>}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7" style={{ WebkitOverflowScrolling: "touch" } as any}>
          <CourseMediaGallery materials={materials} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ------------------------------------------------------------------ */
/* Cover for course cards                                              */
/* ------------------------------------------------------------------ */

const COVER_GRADIENTS = [
  "from-indigo-500 to-violet-600",
  "from-sky-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-cyan-500 to-blue-600",
];

export const CourseCover = ({
  materials, title, onClick, heightPct = 45,
}: {
  materials: CourseMaterialLike[];
  title: string;
  onClick?: () => void;
  heightPct?: number;
}) => {
  const tr = useTr();
  const [coverFailed, setCoverFailed] = useState(false);
  const sorted = sortMaterials(materials);
  const image = sorted.find(m => getMaterialKind(m) === "image");
  const yt = sorted.find(m => getMaterialKind(m) === "youtube");
  const cover = coverFailed ? null : image ? getMaterialThumbnail(image) : yt ? getMaterialThumbnail(yt) : null;
  const c = countByKind(materials);
  const hash = Array.from(title || "").reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const gradient = COVER_GRADIENTS[hash % COVER_GRADIENTS.length];

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative block w-full overflow-hidden text-start"
      style={{ paddingTop: `${heightPct}%` }}
      aria-label={tr("فتح الدرس", "Ouvrir le cours", "Open course")}
    >
      {cover ? (
        <img src={cover} alt="" loading="lazy" onError={() => setCoverFailed(true)} className="absolute top-0 left-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
      ) : (
        <div className={`absolute top-0 left-0 flex h-full w-full items-center justify-center bg-gradient-to-br ${gradient}`}>
          <BookOpen className="h-12 w-12 text-white/40" />
        </div>
      )}
      <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-t from-black/60 via-black/0 to-black/0" />
      {!image && yt && (
        <span className="absolute top-1/2 left-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow-lg">
          <Play className="ml-0.5 h-5 w-5 fill-current text-red-600" />
        </span>
      )}
      {materials.length > 0 && (
        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1.5" dir="ltr">
          {c.video > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm"><Film className="h-3 w-3" />{c.video}</span>}
          {c.image > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm"><ImageIcon className="h-3 w-3" />{c.image}</span>}
          {c.pdf + c.other > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm"><FileText className="h-3 w-3" />{c.pdf + c.other}</span>}
        </div>
      )}
    </button>
  );
};

export default CourseMediaGallery;

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, X, Plus, Eye, Image as ImageIcon, Film, Youtube, Link2, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  ACCEPT_ATTRIBUTE,
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_VIDEO_TYPES,
  formatFileSize,
  getFileKind,
  getMaterialKind,
  getMaterialThumbnail,
  getMaterialUrl,
  parseVideoUrl,
  type CourseMaterialLike,
  type MaterialKind,
} from '@/lib/courseMedia';

interface ExistingFile extends CourseMaterialLike {
  uploaded_at: string;
}

export interface VideoLinkDraft {
  url: string;
  title?: string;
}

interface MultiPdfUploadProps {
  onFilesChange: (files: File[]) => void;
  selectedFiles: File[];
  maxFiles?: number;
  maxSizeMB?: number;
  existingFiles?: ExistingFile[];
  onRemoveExisting?: (fileId: string) => void;
  /** Optional YouTube / Vimeo / .mp4 links (stored as course materials) */
  videoLinks?: VideoLinkDraft[];
  onVideoLinksChange?: (links: VideoLinkDraft[]) => void;
  /** Restrict to PDF files (exercises) */
  pdfOnly?: boolean;
}

const KindIcon = ({ kind, className = "h-4 w-4" }: { kind: MaterialKind; className?: string }) => {
  if (kind === 'image') return <ImageIcon className={`${className} text-sky-500`} />;
  if (kind === 'youtube') return <Youtube className={`${className} text-red-500`} />;
  if (kind === 'video' || kind === 'vimeo') return <Film className={`${className} text-violet-500`} />;
  if (kind === 'link') return <Link2 className={`${className} text-slate-500`} />;
  return <FileText className={`${className} text-rose-500`} />;
};

/** Small preview for a not-yet-uploaded File (object URL, revoked on unmount). */
const LocalPreview = ({ file }: { file: File }) => {
  const kind = getFileKind(file.name, file.type);
  const url = useMemo(() => (kind === 'image' ? URL.createObjectURL(file) : null), [file, kind]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  if (url) return <img src={url} alt="" className="h-full w-full object-cover" />;
  return (
    <div className="h-full w-full flex items-center justify-center bg-muted">
      <KindIcon kind={kind} className="h-6 w-6" />
    </div>
  );
};

const MultiPdfUpload = ({
  onFilesChange,
  selectedFiles,
  maxFiles = 20,
  maxSizeMB = 50,
  existingFiles = [],
  onRemoveExisting,
  videoLinks,
  onVideoLinksChange,
  pdfOnly = false,
}: MultiPdfUploadProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { language } = useLanguage();
  const tr = (ar: string, fr: string, en: string) => (language === 'ar' ? ar : language === 'fr' ? fr : en);

  const links = videoLinks || [];
  const totalCount = selectedFiles.length + existingFiles.length + links.length;

  const validateAndAddFiles = (newFiles: FileList | File[]) => {
    const filesToAdd: File[] = [];
    const fileArray = Array.from(newFiles);

    for (const file of fileArray) {
      const kind = getFileKind(file.name, file.type);
      const okType =
        kind === 'pdf' || (!pdfOnly && (
        (kind === 'image' && (!file.type || ACCEPTED_IMAGE_TYPES.includes(file.type))) ||
        (kind === 'video' && (!file.type || ACCEPTED_VIDEO_TYPES.includes(file.type)))));

      if (!okType) {
        toast.error(
          /heic|heif/i.test(file.type + file.name)
            ? tr(`${file.name}: صيغة HEIC غير مدعومة، حوّل الصورة إلى JPG`, `${file.name} : format HEIC non pris en charge, convertissez en JPG`, `${file.name}: HEIC is not supported, convert it to JPG`)
            : tr(`${file.name}: نوع ملف غير مدعوم`, `${file.name} : type de fichier non pris en charge`, `${file.name}: unsupported file type`)
        );
        continue;
      }

      if (file.size > maxSizeMB * 1024 * 1024) {
        toast.error(
          kind === 'video'
            ? tr(
                `الفيديو ${file.name} يتجاوز ${maxSizeMB} ميغابايت. استعمل رابط YouTube للفيديوهات الطويلة.`,
                `La vidéo ${file.name} dépasse ${maxSizeMB} Mo. Pour les longues vidéos, ajoutez plutôt un lien YouTube.`,
                `${file.name} is larger than ${maxSizeMB}MB. Use a YouTube link for long videos.`
              )
            : tr(`حجم الملف ${file.name} يتجاوز ${maxSizeMB} ميغابايت`, `${file.name} dépasse ${maxSizeMB} Mo`, `${file.name} is larger than ${maxSizeMB}MB`)
        );
        continue;
      }

      if (selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
        toast.error(tr(`تم تحديد الملف ${file.name} مسبقاً`, `${file.name} est déjà sélectionné`, `${file.name} is already selected`));
        continue;
      }

      if (totalCount + filesToAdd.length >= maxFiles) {
        toast.error(tr(`الحد الأقصى هو ${maxFiles} عناصر`, `Limite de ${maxFiles} supports atteinte`, `Maximum ${maxFiles} items allowed`));
        break;
      }

      filesToAdd.push(file);
    }

    if (filesToAdd.length > 0) onFilesChange([...selectedFiles, ...filesToAdd]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    validateAndAddFiles(e.dataTransfer.files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) validateAndAddFiles(e.target.files);
    // allow selecting the same file again after removing it
    e.target.value = '';
  };

  const removeFile = (index: number) => onFilesChange(selectedFiles.filter((_, i) => i !== index));

  const addLink = () => {
    const url = linkInput.trim();
    if (!url) return;
    if (!parseVideoUrl(url)) {
      toast.error(tr('رابط فيديو غير صالح (YouTube أو Vimeo أو ملف mp4)', 'Lien vidéo invalide (YouTube, Vimeo ou fichier .mp4)', 'Invalid video link (YouTube, Vimeo or .mp4)'));
      return;
    }
    if (links.some(l => l.url === url) || existingFiles.some(f => f.file_path === url)) {
      toast.error(tr('هذا الرابط مضاف مسبقاً', 'Ce lien est déjà ajouté', 'This link is already added'));
      return;
    }
    if (totalCount >= maxFiles) {
      toast.error(tr(`الحد الأقصى هو ${maxFiles} عناصر`, `Limite de ${maxFiles} supports atteinte`, `Maximum ${maxFiles} items allowed`));
      return;
    }
    onVideoLinksChange?.([...links, { url, title: linkTitle.trim() || undefined }]);
    setLinkInput('');
    setLinkTitle('');
  };

  return (
    <div className="space-y-4">
      {/* Existing materials */}
      {existingFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {tr('المواد الحالية', 'Supports existants', 'Existing materials')} ({existingFiles.length})
          </h4>
          <div className="grid grid-cols-1 gap-2">
            {existingFiles.map(file => {
              const kind = getMaterialKind(file);
              const thumb = getMaterialThumbnail(file);
              return (
                <div key={file.id} className="flex items-center gap-2.5 rounded-lg border bg-card p-2">
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-muted flex items-center justify-center">
                    {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : <KindIcon kind={kind} className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" title={file.file_name}>
                      {file.file_name === file.file_path && (kind === 'youtube' || kind === 'vimeo')
                        ? tr('فيديو', 'Vidéo', 'Video') + (kind === 'youtube' ? ' YouTube' : ' Vimeo')
                        : file.file_name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatFileSize(file.file_size) || (kind === 'youtube' ? 'YouTube' : kind === 'vimeo' ? 'Vimeo' : '')}
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                    onClick={() => window.open(getMaterialUrl(file), '_blank', 'noopener,noreferrer')}
                    title={tr('معاينة', 'Aperçu', 'Preview')}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  {onRemoveExisting && (
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => onRemoveExisting(file.id)} title={tr('حذف', 'Supprimer', 'Remove')}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Drop zone */}
      <div
        className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors cursor-pointer ${
          isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40'
        }`}
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={e => { e.preventDefault(); setIsDragOver(false); }}
        onDrop={handleDrop}
        onClick={() => totalCount < maxFiles && inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <div className="mx-auto mb-2 flex w-fit items-center gap-2">
          <span className="rounded-lg bg-rose-500/10 p-2"><FileText className="h-5 w-5 text-rose-500" /></span>
          {!pdfOnly && <span className="rounded-lg bg-sky-500/10 p-2"><ImageIcon className="h-5 w-5 text-sky-500" /></span>}
          {!pdfOnly && <span className="rounded-lg bg-violet-500/10 p-2"><Film className="h-5 w-5 text-violet-500" /></span>}
        </div>
        <p className="text-sm font-medium">
          {pdfOnly
            ? tr('اسحب ملفات PDF هنا أو انقر للاختيار', 'Glissez ici des fichiers PDF ou cliquez pour choisir', 'Drop PDF files here or click to choose')
            : tr('اسحب ملفات PDF أو صور أو فيديوهات هنا', 'Glissez ici des PDF, images ou vidéos', 'Drop PDFs, images or videos here')}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {pdfOnly ? tr(
            `PDF — حتى ${maxSizeMB} ميغابايت لكل ملف (${totalCount}/${maxFiles})`,
            `PDF — jusqu'à ${maxSizeMB} Mo par fichier (${totalCount}/${maxFiles})`,
            `PDF — up to ${maxSizeMB}MB each (${totalCount}/${maxFiles})`
          ) : tr(
            `PDF · JPG/PNG/WebP · MP4/WebM/MOV — حتى ${maxSizeMB} ميغابايت لكل ملف (${totalCount}/${maxFiles})`,
            `PDF · JPG/PNG/WebP · MP4/WebM/MOV — jusqu'à ${maxSizeMB} Mo par fichier (${totalCount}/${maxFiles})`,
            `PDF · JPG/PNG/WebP · MP4/WebM/MOV — up to ${maxSizeMB}MB each (${totalCount}/${maxFiles})`
          )}
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-3" disabled={totalCount >= maxFiles}
          onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}>
          <Plus className="h-4 w-4 mr-1.5" />
          {tr('اختيار ملفات', 'Choisir des fichiers', 'Choose files')}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={pdfOnly ? '.pdf,application/pdf' : ACCEPT_ATTRIBUTE}
          onChange={handleFileSelect}
          className="hidden"
          disabled={totalCount >= maxFiles}
        />
      </div>

      {/* Video link */}
      {onVideoLinksChange && !pdfOnly && (
        <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Youtube className="h-4 w-4 text-red-500" />
            {tr('إضافة فيديو عبر رابط', 'Ajouter une vidéo par lien', 'Add a video by link')}
            <span className="text-xs font-normal text-muted-foreground">(YouTube, Vimeo, .mp4)</span>
          </div>
          <div className="space-y-2">
            <Input
              value={linkInput}
              onChange={e => setLinkInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
              placeholder="https://www.youtube.com/watch?v=..."
              dir="ltr"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
            />
            <div className="flex gap-2">
            <Input
              value={linkTitle}
              onChange={e => setLinkTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
              placeholder={tr('عنوان الفيديو (اختياري)', 'Titre (facultatif)', 'Title (optional)')}
              className="flex-1"
            />
            <Button type="button" variant="secondary" onClick={addLink} disabled={!linkInput.trim()} className="shrink-0">
              <Plus className="h-4 w-4 mr-1" />
              {tr('إضافة', 'Ajouter', 'Add')}
            </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pending items */}
      {(selectedFiles.length > 0 || links.length > 0) && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {tr('سيتم رفعها', 'À téléverser', 'To upload')} ({selectedFiles.length + links.length})
          </p>
          <div className="grid grid-cols-1 gap-2">
            {selectedFiles.map((file, index) => (
              <div key={`${file.name}-${index}`} className="flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/5 p-2">
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md">
                  <LocalPreview file={file} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate" title={file.name}>{file.name}</p>
                  <p className="text-[11px] text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeFile(index)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {links.map((link, index) => {
              const parsed = parseVideoUrl(link.url);
              return (
                <div key={link.url} className="flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/5 p-2">
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-muted flex items-center justify-center">
                    {parsed?.thumbnail
                      ? <img src={parsed.thumbnail} alt="" className="h-full w-full object-cover" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                      : <Film className="h-5 w-5 text-violet-500" />}
                    <PlayCircle className="absolute h-5 w-5 text-white drop-shadow" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{link.title || link.url}</p>
                    <p className="text-[11px] text-muted-foreground truncate" dir="ltr">{link.url}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                    onClick={() => onVideoLinksChange?.(links.filter((_, i) => i !== index))}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiPdfUpload;

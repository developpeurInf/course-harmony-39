import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Image as ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AppSettings, I18nText } from "@/lib/appSettings";
import { db, useT } from "../adminShared";

/** Met à jour une partie du brouillon : update("theme", { primary: "#..." }) */
export type Updater = <K extends keyof AppSettings>(section: K, patch: Partial<AppSettings[K]>) => void;

export interface SectionProps {
  draft: AppSettings;
  update: Updater;
}

export type LFn = (fr: string, ar: string, en: string) => string;

/** Copie profonde (réglages = JSON pur) */
export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Nombre de valeurs (feuilles) différentes entre deux réglages */
export function countChanges(a: unknown, b: unknown): number {
  const isObj = (v: unknown) => !!v && typeof v === "object" && !Array.isArray(v);
  if (isObj(a) && isObj(b)) {
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const keys: Record<string, true> = {};
    Object.keys(ao).forEach(k => (keys[k] = true));
    Object.keys(bo).forEach(k => (keys[k] = true));
    return Object.keys(keys).reduce((n, k) => n + countChanges(ao[k], bo[k]), 0);
  }
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null) ? 0 : 1;
}

/** Carte de section */
export function Card({ title, description, children, icon }: { title: string; description?: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-start gap-2.5">
        {icon && <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

/** Champ simple avec libellé */
export function Field({ id, label, hint, children, className }: { id: string; label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-sm font-semibold">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Liste déroulante native (fiable sur iPad iOS 12 et téléphones) */
export function NativeSelect({ id, value, onChange, options, className }: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={e => onChange(e.target.value)}
      className={cn("flex h-10 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm", className)}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

/** Interrupteur + libellé + explication */
export function SwitchRow({ id, label, description, checked, onChange, disabled }: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5">
      <div className="min-w-0">
        <Label htmlFor={id} className="cursor-pointer text-sm font-semibold leading-snug">{label}</Label>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={v => onChange(!!v)} disabled={disabled} className="mt-0.5" />
    </div>
  );
}

/** Nombre borné : la saisie reste libre, la valeur est corrigée en quittant le champ */
export function NumberField({ id, value, onChange, min, max, step = 1, disabled, suffix }: {
  id: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  suffix?: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const clamp = (n: number) => {
    const r = Math.round(n / step) * step;
    return Math.min(max, Math.max(min, Number(r.toFixed(3))));
  };
  return (
    <div className="flex items-center gap-2">
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={text}
        disabled={disabled}
        className="w-28"
        onChange={e => {
          setText(e.target.value);
          const n = parseFloat(e.target.value.replace(",", "."));
          if (!isNaN(n) && n >= min && n <= max) onChange(n);
        }}
        onBlur={() => {
          const n = parseFloat(text.replace(",", "."));
          const v = isNaN(n) ? value : clamp(n);
          setText(String(v));
          if (v !== value) onChange(v);
        }}
      />
      {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
    </div>
  );
}

const LANGS: { key: keyof I18nText; tag: string; name: [string, string, string] }[] = [
  { key: "fr", tag: "FR", name: ["Français", "الفرنسية", "French"] },
  { key: "ar", tag: "ع", name: ["Arabe", "العربية", "Arabic"] },
  { key: "en", tag: "EN", name: ["Anglais", "الإنجليزية", "English"] },
];

/** Texte en trois langues (le champ arabe est écrit de droite à gauche) */
export function I18nField({ id, label, hint, value, onChange, multiline, placeholder }: {
  id: string;
  label: string;
  hint?: string;
  value: I18nText;
  onChange: (v: I18nText) => void;
  multiline?: boolean;
  placeholder?: I18nText;
}) {
  const { L } = useT();
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{label}</legend>
      {hint && <p className="-mt-1 text-xs text-muted-foreground">{hint}</p>}
      {LANGS.map(l => {
        const fid = `${id}-${l.key}`;
        const common = {
          id: fid,
          dir: l.key === "ar" ? "rtl" : "ltr",
          lang: l.key,
          value: value[l.key] || "",
          placeholder: placeholder ? placeholder[l.key] : undefined,
          className: l.key === "ar" ? "text-right" : "text-left",
        } as const;
        return (
          <div key={l.key} className="flex items-start gap-2">
            <label
              htmlFor={fid}
              title={L(...l.name)}
              className="mt-2 flex h-6 w-8 flex-shrink-0 items-center justify-center rounded bg-muted text-[11px] font-semibold text-muted-foreground"
            >
              {l.tag}
              <span className="sr-only"> — {L(...l.name)}</span>
            </label>
            {multiline ? (
              <Textarea {...common} rows={2} onChange={e => onChange({ ...value, [l.key]: e.target.value })} />
            ) : (
              <Input {...common} onChange={e => onChange({ ...value, [l.key]: e.target.value })} />
            )}
          </div>
        );
      })}
    </fieldset>
  );
}

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
const IMAGE_EXT = ["png", "jpg", "jpeg", "svg", "webp"];

/** Image envoyée dans le bucket public « branding » (logo, favicon…) */
export function ImageField({ id, label, hint, value, onChange, prefix, maxBytes, square = true }: {
  id: string;
  label: string;
  hint?: string;
  value: string | null;
  onChange: (url: string | null) => void;
  prefix: string;
  maxBytes: number;
  square?: boolean;
}) {
  const { L } = useT();
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const sizeLabel = maxBytes >= 1024 * 1024 ? `${Math.round(maxBytes / 1024 / 1024)} Mo` : `${Math.round(maxBytes / 1024)} Ko`;
  const sizeLabelAr = maxBytes >= 1024 * 1024 ? `${Math.round(maxBytes / 1024 / 1024)} م.ب` : `${Math.round(maxBytes / 1024)} ك.ب`;
  const sizeLabelEn = maxBytes >= 1024 * 1024 ? `${Math.round(maxBytes / 1024 / 1024)} MB` : `${Math.round(maxBytes / 1024)} KB`;

  const pick = async (file: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!file) return;
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (IMAGE_TYPES.indexOf(file.type) === -1 && IMAGE_EXT.indexOf(ext) === -1) {
      toast.error(L("Format non accepté (PNG, JPG, SVG ou WebP)", "صيغة غير مقبولة (PNG أو JPG أو SVG أو WebP)", "Unsupported format (PNG, JPG, SVG or WebP)"));
      return;
    }
    if (file.size > maxBytes) {
      toast.error(L(`Image trop lourde (max ${sizeLabel})`, `الصورة كبيرة جدا (الحد ${sizeLabelAr})`, `Image too large (max ${sizeLabelEn})`));
      return;
    }
    const safeExt = IMAGE_EXT.indexOf(ext) !== -1 ? (ext === "jpeg" ? "jpg" : ext) : file.type === "image/svg+xml" ? "svg" : file.type.split("/")[1] || "png";
    const path = `${prefix}-${Date.now()}.${safeExt}`;
    setBusy(true);
    try {
      const bucket = db.storage.from("branding");
      const { error } = await bucket.upload(path, file, { contentType: file.type || undefined, upsert: false, cacheControl: "31536000" });
      if (error) throw error;
      const { data } = bucket.getPublicUrl(path);
      if (!data?.publicUrl) throw new Error("URL");
      onChange(data.publicUrl);
      toast.success(L("Image envoyée — pensez à enregistrer", "تم رفع الصورة — لا تنس الحفظ", "Image uploaded — remember to save"));
    } catch (e: any) {
      toast.error(L("Envoi impossible", "تعذر الرفع", "Upload failed") + (e?.message ? ` : ${e.message}` : ""));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-semibold">{label}</Label>
      <div className="flex flex-wrap items-center gap-3">
        <div
          className={cn(
            "flex flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] bg-[length:12px_12px] dark:bg-[repeating-conic-gradient(#334155_0%_25%,transparent_0%_50%)]",
            square ? "h-16 w-16" : "h-16 w-28"
          )}
        >
          {value ? (
            <img src={value} alt={label} className="max-h-full max-w-full object-contain" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            id={id}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp,.png,.jpg,.jpeg,.svg,.webp"
            className="sr-only"
            disabled={busy}
            onChange={e => void pick(e.target.files ? e.target.files[0] : undefined)}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current && input.current.click()}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-semibold hover:bg-muted disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {value ? L("Remplacer", "استبدال", "Replace") : L("Choisir une image", "اختيار صورة", "Choose an image")}
          </button>
          {value && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onChange(null)}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-md border border-red-200 px-3 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <Trash2 className="h-4 w-4" />
              {L("Retirer", "إزالة", "Remove")}
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {hint ? `${hint} · ` : ""}
        {L(`PNG, JPG, SVG ou WebP — ${sizeLabel} max`, `PNG أو JPG أو SVG أو WebP — ${sizeLabelAr} كحد أقصى`, `PNG, JPG, SVG or WebP — ${sizeLabelEn} max`)}
      </p>
    </div>
  );
}

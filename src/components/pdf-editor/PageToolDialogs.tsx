import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type Tr = (fr: string, ar: string, en: string) => string;

/* ───────────── cadre commun ───────────── */

function ToolDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onApply,
  applyLabel,
  busy,
  disabled,
  t,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  onApply: () => void;
  applyLabel?: string;
  busy: boolean;
  disabled?: boolean;
  t: Tr;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <DialogHeader className="space-y-1 border-b p-5">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-5">{children}</div>
        <DialogFooter className="border-t p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("Annuler", "إلغاء", "Cancel")}
          </Button>
          <Button onClick={onApply} disabled={busy || disabled}>
            {busy && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
            {applyLabel || t("Appliquer", "تطبيق", "Apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function PagesField({ value, onChange, total, t }: { value: string; onChange: (v: string) => void; total: number; t: Tr }) {
  return (
    <Field
      label={t("Pages", "الصفحات", "Pages")}
      htmlFor="tool-pages"
      hint={t(`Vide = toutes les pages (${total}). Exemple : 1-3, 5, 8-10`, `فارغ = كل الصفحات (${total}). مثال: 1-3، 5، 8-10`, `Empty = all pages (${total}). Example: 1-3, 5, 8-10`)}
    >
      <Input id="tool-pages" value={value} onChange={(e) => onChange(e.target.value)} placeholder={t("Toutes", "الكل", "All")} dir="ltr" />
    </Field>
  );
}

function ColorField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const presets = ["#111827", "#6b7280", "#2b4aca", "#ce2727", "#208857", "#b45309"];
  return (
    <Field label={label}>
      <div className="flex items-center gap-1.5">
        {presets.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            onClick={() => onChange(c)}
            className={cn("h-7 w-7 rounded-md border", value === c && "ring-2 ring-ring ring-offset-1 ring-offset-background")}
            style={{ background: c }}
          />
        ))}
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-9 cursor-pointer rounded-md border bg-transparent p-0.5" />
      </div>
    </Field>
  );
}

/* ───────────── Ajouter un filigrane ───────────── */

export interface WatermarkFormValue {
  mode: "text" | "image";
  text: string;
  image: File | null;
  imageScale: number;
  fontSize: number;
  color: string;
  opacity: number;
  rotation: number;
  position: "center" | "top" | "bottom";
  pages: string;
}

export function AddWatermarkDialog({
  open,
  onOpenChange,
  onApply,
  busy,
  total,
  t,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onApply: (v: WatermarkFormValue) => void;
  busy: boolean;
  total: number;
  t: Tr;
}) {
  const [v, setV] = useState<WatermarkFormValue>({
    mode: "text",
    text: "",
    image: null,
    imageScale: 40,
    fontSize: 60,
    color: "#6b7280",
    opacity: 0.2,
    rotation: 45,
    position: "center",
    pages: "",
  });
  const set = <K extends keyof WatermarkFormValue>(k: K, val: WatermarkFormValue[K]) => setV((p) => ({ ...p, [k]: val }));
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!v.image) return setPreview(null);
    const url = URL.createObjectURL(v.image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [v.image]);

  const ready = v.mode === "text" ? !!v.text.trim() : !!v.image;

  return (
    <ToolDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("Ajouter un filigrane", "إضافة علامة مائية", "Add a watermark")}
      description={t("Un texte ou un logo ajouté sur les pages choisies.", "نص أو شعار يضاف إلى الصفحات المختارة.", "A text or logo added to the selected pages.")}
      onApply={() => onApply(v)}
      busy={busy}
      disabled={!ready}
      t={t}
    >
      <div className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/50 p-1">
        {(["text", "image"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => set("mode", m)}
            className={cn("h-8 rounded-md text-sm", v.mode === m ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}
          >
            {m === "text" ? t("Texte", "نص", "Text") : t("Image / logo", "صورة / شعار", "Image / logo")}
          </button>
        ))}
      </div>

      {/* Aperçu */}
      <div className="relative flex h-40 items-center justify-center overflow-hidden rounded-lg border bg-white">
        <div className="absolute inset-x-6 top-5 space-y-1.5 opacity-60" aria-hidden="true">
          {[90, 75, 85, 60, 80, 70].map((w, i) => (
            <div key={i} className="h-1.5 rounded bg-zinc-200" style={{ width: `${w}%` }} />
          ))}
        </div>
        <div
          className={cn("absolute inset-x-0 flex justify-center", v.position === "top" ? "top-3" : v.position === "bottom" ? "bottom-3" : "top-1/2 -translate-y-1/2")}
          style={{ opacity: v.opacity }}
        >
          <div style={{ transform: `rotate(${-v.rotation}deg)` }}>
            {v.mode === "text" ? (
              <span style={{ color: v.color, fontSize: Math.max(10, v.fontSize / 2.4) }} className="whitespace-pre font-semibold" dir="auto">
                {v.text || t("CONFIDENTIEL", "سري", "CONFIDENTIAL")}
              </span>
            ) : preview ? (
              <img src={preview} alt="" style={{ width: `${v.imageScale * 2}px` }} />
            ) : (
              <span className="text-xs text-muted-foreground">{t("Aucune image", "لا توجد صورة", "No image")}</span>
            )}
          </div>
        </div>
      </div>

      {v.mode === "text" ? (
        <>
          <Field label={t("Texte", "النص", "Text")} htmlFor="wm-add-text">
            <Input id="wm-add-text" value={v.text} onChange={(e) => set("text", e.target.value)} placeholder={t("ex. CONFIDENTIEL", "مثال: سري", "e.g. CONFIDENTIAL")} dir="auto" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t(`Taille : ${v.fontSize} pt`, `الحجم: ${v.fontSize}`, `Size: ${v.fontSize} pt`)}>
              <Slider min={12} max={140} step={2} value={[v.fontSize]} onValueChange={([x]) => set("fontSize", x)} />
            </Field>
            <ColorField label={t("Couleur", "اللون", "Color")} value={v.color} onChange={(c) => set("color", c)} />
          </div>
        </>
      ) : (
        <>
          <Field label={t("Image (PNG ou JPG)", "صورة (PNG أو JPG)", "Image (PNG or JPG)")}>
            <Input type="file" accept="image/png,image/jpeg" onChange={(e) => set("image", e.target.files?.[0] || null)} />
          </Field>
          <Field label={t(`Largeur : ${v.imageScale} % de la page`, `العرض: ${v.imageScale}٪ من الصفحة`, `Width: ${v.imageScale}% of the page`)}>
            <Slider min={5} max={100} step={1} value={[v.imageScale]} onValueChange={([x]) => set("imageScale", x)} />
          </Field>
        </>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label={t(`Opacité : ${Math.round(v.opacity * 100)} %`, `الشفافية: ${Math.round(v.opacity * 100)}٪`, `Opacity: ${Math.round(v.opacity * 100)}%`)}>
          <Slider min={5} max={100} step={5} value={[Math.round(v.opacity * 100)]} onValueChange={([x]) => set("opacity", x / 100)} />
        </Field>
        <Field label={t("Rotation", "التدوير", "Rotation")}>
          <Select value={String(v.rotation)} onValueChange={(x) => set("rotation", Number(x))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 45, 90, -45].map((r) => (
                <SelectItem key={r} value={String(r)}>
                  {r}°
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t("Position", "الموضع", "Position")}>
          <Select value={v.position} onValueChange={(x) => set("position", x as WatermarkFormValue["position"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="center">{t("Centre", "الوسط", "Center")}</SelectItem>
              <SelectItem value="top">{t("Haut", "الأعلى", "Top")}</SelectItem>
              <SelectItem value="bottom">{t("Bas", "الأسفل", "Bottom")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <PagesField value={v.pages} onChange={(p) => set("pages", p)} total={total} t={t} />
      </div>
    </ToolDialog>
  );
}

/* ───────────── En-tête et pied de page ───────────── */

export interface HeaderFooterFormValue {
  headerLeft: string;
  headerCenter: string;
  headerRight: string;
  footerLeft: string;
  footerCenter: string;
  footerRight: string;
  fontSize: number;
  color: string;
  margin: number;
  pages: string;
}

export function HeaderFooterDialog({
  open,
  onOpenChange,
  onApply,
  busy,
  total,
  t,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onApply: (v: HeaderFooterFormValue) => void;
  busy: boolean;
  total: number;
  t: Tr;
}) {
  const [v, setV] = useState<HeaderFooterFormValue>({
    headerLeft: "",
    headerCenter: "",
    headerRight: "",
    footerLeft: "",
    footerCenter: "",
    footerRight: "",
    fontSize: 9,
    color: "#6b7280",
    margin: 36,
    pages: "",
  });
  const [focus, setFocus] = useState<keyof HeaderFooterFormValue>("footerCenter");
  const set = <K extends keyof HeaderFooterFormValue>(k: K, val: HeaderFooterFormValue[K]) => setV((p) => ({ ...p, [k]: val }));
  const insertToken = (token: string) => set(focus, `${String(v[focus] || "")}${token}` as never);
  const ready = [v.headerLeft, v.headerCenter, v.headerRight, v.footerLeft, v.footerCenter, v.footerRight].some((x) => x.trim());

  const slot = (k: keyof HeaderFooterFormValue, label: string) => (
    <Input value={String(v[k])} onChange={(e) => set(k, e.target.value as never)} onFocus={() => setFocus(k)} placeholder={label} aria-label={label} dir="auto" className="h-8 text-xs" />
  );

  return (
    <ToolDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("En-tête et pied de page", "رأس وتذييل الصفحة", "Header & footer")}
      description={t("Texte ajouté en haut et en bas des pages, à gauche, au centre ou à droite.", "نص يضاف أعلى وأسفل الصفحات، يسارا أو وسطا أو يمينا.", "Text added at the top and bottom of pages, left, center or right.")}
      onApply={() => onApply(v)}
      busy={busy}
      disabled={!ready}
      t={t}
    >
      <div className="space-y-2">
        <Label>{t("En-tête", "الرأس", "Header")}</Label>
        <div className="grid grid-cols-3 gap-2">
          {slot("headerLeft", t("Gauche", "يسار", "Left"))}
          {slot("headerCenter", t("Centre", "وسط", "Center"))}
          {slot("headerRight", t("Droite", "يمين", "Right"))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t("Pied de page", "التذييل", "Footer")}</Label>
        <div className="grid grid-cols-3 gap-2">
          {slot("footerLeft", t("Gauche", "يسار", "Left"))}
          {slot("footerCenter", t("Centre", "وسط", "Center"))}
          {slot("footerRight", t("Droite", "يمين", "Right"))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="me-1 text-xs text-muted-foreground">{t("Insérer :", "إدراج:", "Insert:")}</span>
        {[
          ["{page}", t("N° de page", "رقم الصفحة", "Page no.")],
          ["{total}", t("Nb de pages", "عدد الصفحات", "Page count")],
          ["{date}", t("Date", "التاريخ", "Date")],
          ["{name}", t("Nom du prof", "اسم الأستاذ", "Teacher name")],
        ].map(([token, label]) => (
          <button key={token} type="button" onClick={() => insertToken(token)} className="rounded-md border px-2 py-1 text-xs hover:bg-muted">
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t(`Taille : ${v.fontSize} pt`, `الحجم: ${v.fontSize}`, `Size: ${v.fontSize} pt`)}>
          <Slider min={6} max={24} step={1} value={[v.fontSize]} onValueChange={([x]) => set("fontSize", x)} />
        </Field>
        <Field label={t(`Marge : ${Math.round(v.margin / 2.835)} mm`, `الهامش: ${Math.round(v.margin / 2.835)} مم`, `Margin: ${Math.round(v.margin / 2.835)} mm`)}>
          <Slider min={14} max={90} step={2} value={[v.margin]} onValueChange={([x]) => set("margin", x)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <ColorField label={t("Couleur", "اللون", "Color")} value={v.color} onChange={(c) => set("color", c)} />
        <PagesField value={v.pages} onChange={(p) => set("pages", p)} total={total} t={t} />
      </div>
    </ToolDialog>
  );
}

/* ───────────── Numéros de page ───────────── */

export type NumberSlot = "footerCenter" | "footerRight" | "footerLeft" | "headerCenter" | "headerRight" | "headerLeft";

export interface PageNumbersFormValue {
  slot: NumberSlot;
  format: string;
  startAt: number;
  fontSize: number;
  pages: string;
}

export function PageNumbersDialog({
  open,
  onOpenChange,
  onApply,
  busy,
  total,
  t,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onApply: (v: PageNumbersFormValue) => void;
  busy: boolean;
  total: number;
  t: Tr;
}) {
  const [v, setV] = useState<PageNumbersFormValue>({ slot: "footerCenter", format: "{page} / {total}", startAt: 1, fontSize: 10, pages: "" });
  const set = <K extends keyof PageNumbersFormValue>(k: K, val: PageNumbersFormValue[K]) => setV((p) => ({ ...p, [k]: val }));
  const formats = [
    "{page}",
    "{page} / {total}",
    t("Page {page}", "الصفحة {page}", "Page {page}"),
    t("Page {page} sur {total}", "الصفحة {page} من {total}", "Page {page} of {total}"),
    "- {page} -",
  ];
  const positions: [NumberSlot, string][] = [
    ["headerLeft", t("En haut à gauche", "أعلى اليسار", "Top left")],
    ["headerCenter", t("En haut au centre", "أعلى الوسط", "Top center")],
    ["headerRight", t("En haut à droite", "أعلى اليمين", "Top right")],
    ["footerLeft", t("En bas à gauche", "أسفل اليسار", "Bottom left")],
    ["footerCenter", t("En bas au centre", "أسفل الوسط", "Bottom center")],
    ["footerRight", t("En bas à droite", "أسفل اليمين", "Bottom right")],
  ];
  return (
    <ToolDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("Numéros de page", "ترقيم الصفحات", "Page numbers")}
      onApply={() => onApply(v)}
      busy={busy}
      t={t}
    >
      <Field label={t("Position", "الموضع", "Position")}>
        <div className="grid grid-cols-3 gap-1.5">
          {positions.map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => set("slot", k)}
              className={cn("rounded-md border px-2 py-2 text-xs", v.slot === k ? "border-primary bg-primary/5 font-medium text-primary" : "hover:bg-muted")}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>
      <Field label={t("Format", "الصيغة", "Format")}>
        <Select value={v.format} onValueChange={(x) => set("format", x)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {formats.map((f) => (
              <SelectItem key={f} value={f}>
                {f.replace("{page}", "3").replace("{total}", String(total || 12))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid grid-cols-3 gap-4">
        <Field label={t("Commencer à", "البدء من", "Start at")} htmlFor="pn-start">
          <Input id="pn-start" type="number" min={1} value={v.startAt} onChange={(e) => set("startAt", Math.max(1, Number(e.target.value) || 1))} />
        </Field>
        <Field label={t(`Taille : ${v.fontSize} pt`, `الحجم: ${v.fontSize}`, `Size: ${v.fontSize} pt`)}>
          <Slider min={6} max={20} step={1} value={[v.fontSize]} onValueChange={([x]) => set("fontSize", x)} className="pt-2" />
        </Field>
        <div className="col-span-3">
          <PagesField value={v.pages} onChange={(p) => set("pages", p)} total={total} t={t} />
        </div>
      </div>
    </ToolDialog>
  );
}

/* ───────────── Scinder ───────────── */

export function SplitDialog({
  open,
  onOpenChange,
  onApply,
  busy,
  total,
  t,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onApply: (v: { every?: number; at?: number[] }) => void;
  busy: boolean;
  total: number;
  t: Tr;
}) {
  const [mode, setMode] = useState<"every" | "at">("every");
  const [every, setEvery] = useState(1);
  const [at, setAt] = useState("");
  const atList = at
    .split(/[,;\s]+/)
    .map((x) => parseInt(x, 10))
    .filter((x) => x > 1 && x <= total);
  const parts = mode === "every" ? Math.ceil(total / Math.max(1, every)) : atList.length + 1;
  return (
    <ToolDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("Scinder le document", "تقسيم الوثيقة", "Split document")}
      description={t("Chaque partie s'ouvre dans un nouvel onglet.", "يفتح كل جزء في تبويب جديد.", "Each part opens in a new tab.")}
      onApply={() => onApply(mode === "every" ? { every } : { at: atList })}
      applyLabel={t(`Scinder en ${parts} parties`, `تقسيم إلى ${parts} أجزاء`, `Split into ${parts} parts`)}
      busy={busy}
      disabled={parts < 2 || parts > 50}
      t={t}
    >
      <label className="flex items-center gap-3 rounded-lg border p-3">
        <input type="radio" checked={mode === "every"} onChange={() => setMode("every")} className="accent-[hsl(var(--primary))]" />
        <span className="flex-1 text-sm">{t("Toutes les", "كل", "Every")}</span>
        <Input type="number" min={1} max={total} value={every} onChange={(e) => setEvery(Math.max(1, Number(e.target.value) || 1))} className="h-8 w-20" onFocus={() => setMode("every")} />
        <span className="text-sm text-muted-foreground">{t("pages", "صفحات", "pages")}</span>
      </label>
      <label className="flex items-center gap-3 rounded-lg border p-3">
        <input type="radio" checked={mode === "at"} onChange={() => setMode("at")} className="accent-[hsl(var(--primary))]" />
        <span className="shrink-0 text-sm">{t("Avant les pages", "قبل الصفحات", "Before pages")}</span>
        <Input value={at} onChange={(e) => setAt(e.target.value)} placeholder="4, 9" className="h-8" onFocus={() => setMode("at")} dir="ltr" />
      </label>
    </ToolDialog>
  );
}

/* ───────────── rechercher et remplacer ───────────── */

export interface ReplaceFormValue {
  find: string;
  replace: string;
  matchCase: boolean;
  pages: string;
}

export function ReplaceDialog({
  open,
  onOpenChange,
  onApply,
  count,
  initialFind,
  busy,
  total,
  t,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onApply: (v: ReplaceFormValue) => void;
  /** occurrences pour la recherche en cours (total et numéros de page à partir de 0) */
  count: (v: ReplaceFormValue) => Promise<{ total: number; pages: number[] }>;
  initialFind?: string;
  busy: boolean;
  total: number;
  t: Tr;
}) {
  const [v, setV] = useState<ReplaceFormValue>({ find: initialFind || "", replace: "", matchCase: false, pages: "" });
  const [found, setFound] = useState<{ total: number; pages: number[] } | null>(null);
  const [counting, setCounting] = useState(false);
  const set = (patch: Partial<ReplaceFormValue>) => setV((x) => ({ ...x, ...patch }));

  useEffect(() => {
    if (!v.find.trim()) return setFound(null);
    let cancelled = false;
    setCounting(true);
    const id = window.setTimeout(() => {
      count(v)
        .then((r) => !cancelled && setFound(r))
        .catch(() => !cancelled && setFound(null))
        .finally(() => !cancelled && setCounting(false));
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.find, v.matchCase, v.pages]);

  const pageList = (pages: number[]) => {
    const shown = pages.slice(0, 12).map((p) => p + 1).join(", ");
    return pages.length > 12 ? `${shown}…` : shown;
  };
  const canApply = !!v.find.trim() && !!found?.total && !counting;

  return (
    <ToolDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("Rechercher et remplacer", "بحث واستبدال", "Find and replace")}
      description={t(
        "Le nouveau texte garde la police, la taille, la couleur et la position du texte d'origine.",
        "يحتفظ النص الجديد بخط النص الأصلي وحجمه ولونه وموضعه.",
        "The new text keeps the original font, size, colour and position."
      )}
      onApply={() => onApply(v)}
      applyLabel={t("Tout remplacer", "استبدال الكل", "Replace all")}
      busy={busy}
      disabled={!canApply}
      t={t}
    >
      <Field label={t("Rechercher", "بحث عن", "Find")} htmlFor="rp-find">
        <Input id="rp-find" value={v.find} autoFocus onChange={(e) => set({ find: e.target.value })} placeholder={t("Texte à trouver", "النص المراد إيجاده", "Text to find")} />
      </Field>
      <Field label={t("Remplacer par", "استبدال بـ", "Replace with")} htmlFor="rp-repl" hint={t("Laissez vide pour effacer le texte trouvé.", "اتركه فارغاً لحذف النص.", "Leave empty to erase the text.")}>
        <Input
          id="rp-repl"
          value={v.replace}
          onChange={(e) => set({ replace: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && canApply && !busy && onApply(v)}
          placeholder={t("Nouveau texte", "النص الجديد", "New text")}
        />
      </Field>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox checked={v.matchCase} onCheckedChange={(c) => set({ matchCase: c === true })} />
        {t("Respecter les majuscules et minuscules", "مطابقة حالة الأحرف", "Match case")}
      </label>
      <PagesField value={v.pages} onChange={(pages) => set({ pages })} total={total} t={t} />
      <div className={cn("rounded-md border px-3 py-2 text-sm", found?.total ? "border-primary/30 bg-primary/5" : "bg-muted/50 text-muted-foreground")} aria-live="polite">
        {!v.find.trim()
          ? t("Saisissez le texte à rechercher.", "اكتب النص المراد البحث عنه.", "Type the text to find.")
          : counting
            ? t("Recherche…", "جارٍ البحث…", "Searching…")
            : found?.total
              ? t(
                  `${found.total} occurrence(s) sur ${found.pages.length} page(s) : ${pageList(found.pages)}`,
                  `${found.total} نتيجة في ${found.pages.length} صفحة: ${pageList(found.pages)}`,
                  `${found.total} match(es) on ${found.pages.length} page(s): ${pageList(found.pages)}`
                )
              : t("Aucune occurrence trouvée.", "لا توجد نتائج.", "No matches found.")}
      </div>
    </ToolDialog>
  );
}

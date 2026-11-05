import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { WatermarkCandidate } from "@/lib/pdfWatermark";

type Tr = (fr: string, ar: string, en: string) => string;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** PDF actif (avec les modifications en cours) */
  getPdf: () => Promise<{ buffer: ArrayBuffer; name: string } | null>;
  /** ouvre le résultat dans un nouvel onglet de l'éditeur */
  onResult: (bytes: Uint8Array, name: string, removed: number) => Promise<void>;
  t: Tr;
}

// Le moteur (pdf-lib) n'est chargé qu'à l'ouverture de cette fenêtre
const engine = () => import("@/lib/pdfWatermark");

export default function WatermarkDialog({ open, onOpenChange, getPdf, onResult, t }: Props) {
  const [source, setSource] = useState<{ bytes: Uint8Array; name: string } | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [candidates, setCandidates] = useState<WatermarkCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setAnalyzing(true);
    setError(null);
    setCandidates([]);
    setSelected(new Set());
    setQuery("");
    (async () => {
      try {
        const pdf = await getPdf();
        if (!pdf) throw new Error("no document");
        const bytes = new Uint8Array(pdf.buffer.slice(0));
        const { analyzePdf } = await engine();
        const result = await analyzePdf(bytes.slice());
        if (cancelled) return;
        setSource({ bytes, name: pdf.name });
        setPageCount(result.pageCount);
        setCandidates(result.candidates);
        setSelected(new Set(result.candidates.filter((c) => c.likely).map((c) => c.key)));
      } catch (e) {
        console.error(e);
        if (!cancelled) setError(t("Impossible d'analyser ce PDF.", "تعذر تحليل ملف PDF هذا.", "Could not analyse this PDF."));
      } finally {
        if (!cancelled) setAnalyzing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const texts = query
    .split(/\n|;/)
    .map((s) => s.trim())
    .filter(Boolean);
  const canApply = !!source && (selected.size > 0 || texts.length > 0) && !working;

  const apply = async () => {
    if (!source) return;
    setWorking(true);
    setError(null);
    try {
      const { removeFromPdf } = await engine();
      const { bytes, removed } = await removeFromPdf(source.bytes.slice(), { keys: [...selected], texts });
      if (!removed) {
        setError(t("Aucun élément correspondant n'a été trouvé.", "لم يتم العثور على أي عنصر مطابق.", "No matching element was found."));
        return;
      }
      const base = source.name.replace(/\.pdf$/i, "");
      await onResult(bytes, `${base} (${t("nettoyé", "منظف", "cleaned")}).pdf`, removed);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      setError(t("La suppression a échoué.", "فشل الحذف.", "Removal failed."));
    } finally {
      setWorking(false);
    }
  };

  const kindLabel = (c: WatermarkCandidate) =>
    c.kind === "image"
      ? t("Image", "صورة", "Image")
      : c.kind === "annotation"
        ? t("Filigrane intégré", "علامة مائية مدمجة", "Embedded watermark")
        : t("Texte", "نص", "Text");

  return (
    <Dialog open={open} onOpenChange={(o) => !working && onOpenChange(o)}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <DialogHeader className="space-y-1 border-b p-5">
          <DialogTitle>{t("Supprimer un filigrane", "حذف علامة مائية", "Remove a watermark")}</DialogTitle>
          <DialogDescription>
            {t(
              "Retire un texte, un logo ou un filigrane répété sur les pages. Le résultat s'ouvre dans un nouvel onglet, le document actuel n'est pas modifié.",
              "يحذف نصا أو شعارا أو علامة مائية مكررة في الصفحات. تفتح النتيجة في تبويب جديد ولا تتغير الوثيقة الحالية.",
              "Removes a text, logo or watermark repeated across pages. The result opens in a new tab; the current document is not changed."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[52vh] overflow-y-auto p-5">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-sm font-medium">{t("Éléments répétés détectés", "العناصر المكررة المكتشفة", "Repeated elements found")}</h3>
            {pageCount > 0 && <span className="text-xs text-muted-foreground">{pageCount} {t("pages", "صفحة", "pages")}</span>}
          </div>

          {analyzing ? (
            <div className="flex items-center justify-center gap-2 rounded-lg border py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("Analyse du document…", "جارٍ تحليل الوثيقة…", "Analysing document…")}
            </div>
          ) : candidates.length ? (
            <div className="divide-y rounded-lg border">
              {candidates.map((c) => (
                <label key={c.key} className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-muted/50">
                  <Checkbox checked={selected.has(c.key)} onCheckedChange={() => toggle(c.key)} className="mt-0.5" />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-sm", c.kind === "text" ? "font-medium" : "text-muted-foreground")} dir="auto">
                      {c.kind === "text" ? c.label : kindLabel(c)}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span>{kindLabel(c)}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {c.pages}/{pageCount} {t("pages", "صفحة", "pages")}
                      </span>
                      {c.likely && (
                        <span className="rounded border px-1.5 py-px text-2xs font-medium text-foreground">
                          {t("Filigrane probable", "علامة مائية محتملة", "Likely watermark")}
                        </span>
                      )}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            !error && (
              <p className="rounded-lg border px-3 py-6 text-center text-sm text-muted-foreground">
                {t("Aucun élément répété détecté.", "لم يتم اكتشاف عناصر مكررة.", "No repeated element found.")}
              </p>
            )
          )}

          <div className="mt-5 space-y-1.5">
            <Label htmlFor="wm-text">{t("Ou saisissez le texte à retirer", "أو اكتب النص المراد حذفه", "Or type the text to remove")}</Label>
            <Input
              id="wm-text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("ex. CONFIDENTIEL ; Brouillon", "مثال: سري ؛ مسودة", "e.g. CONFIDENTIAL; Draft")}
              dir="auto"
            />
            <p className="text-xs text-muted-foreground">
              {t(
                "Séparez plusieurs textes par « ; ». Seuls les textes courts qui le contiennent sont retirés.",
                "افصل بين عدة نصوص بـ « ؛ ». تحذف النصوص القصيرة التي تحتويه فقط.",
                "Separate several texts with “;”. Only short texts containing it are removed."
              )}
            </p>
          </div>

          {error && <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="border-t p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={working}>
            {t("Annuler", "إلغاء", "Cancel")}
          </Button>
          <Button onClick={() => void apply()} disabled={!canApply}>
            {working && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
            {t("Retirer", "حذف", "Remove")}
            {selected.size + texts.length > 0 && ` (${selected.size + texts.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

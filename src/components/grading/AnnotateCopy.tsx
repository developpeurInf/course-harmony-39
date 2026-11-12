/**
 * Correction annotée : le professeur écrit au stylet / doigt / souris sur la photo
 * de la copie ; l'image annotée est jointe à la correction (PNG).
 * Barème réutilisable : critères enregistrés dans les préférences du professeur.
 */
import { useEffect, useRef, useState } from "react";
import { Eraser, ListChecks, Loader2, PenLine, Plus, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getUserPrefs, saveUserPrefs } from "@/lib/userPrefs";
import { cn } from "@/lib/utils";

type Tr = (fr: string, ar: string, en: string) => string;
type Stroke = { color: string; width: number; pts: [number, number][] };

const COLORS = ["#dc2626", "#16a34a", "#2563eb", "#111827"];

export function AnnotateImageDialog({ src, name, open, onOpenChange, onSave, tr }: {
  src: string | null;
  name: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (file: File) => void;
  tr: Tr;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(4);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const drawing = useRef<Stroke | null>(null);

  useEffect(() => {
    if (!open || !src) return;
    setStrokes([]);
    setReady(false);
    setFailed(false);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setReady(true);
    };
    img.onerror = () => setFailed(true);
    img.src = src;
  }, [open, src]);

  // Redessine l'image et tous les traits
  useEffect(() => {
    const c = canvasRef.current, img = imgRef.current;
    if (!c || !img || !ready) return;
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of strokes) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width * (c.width / 800);
      ctx.beginPath();
      s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * c.width, y * c.height) : ctx.moveTo(x * c.width, y * c.height)));
      if (s.pts.length === 1) ctx.lineTo(s.pts[0][0] * c.width + 0.1, s.pts[0][1] * c.height);
      ctx.stroke();
    }
  }, [strokes, ready]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = { color, width: e.pointerType === "pen" ? width * Math.max(0.5, e.pressure * 1.5) : width, pts: [pos(e)] };
    setStrokes((s) => [...s, drawing.current!]);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current.pts.push(pos(e));
    setStrokes((s) => [...s.slice(0, -1), { ...drawing.current! }]);
  };
  const up = () => {
    drawing.current = null;
  };

  const save = () => {
    const c = canvasRef.current;
    if (!c) return;
    try {
      c.toBlob((b) => {
        if (!b) return;
        onSave(new File([b], `${name.replace(/\.[^.]+$/, "")}-corrige.png`, { type: "image/png" }));
        onOpenChange(false);
      }, "image/png");
    } catch {
      toast.error(tr("Image protégée : téléchargez-la puis joignez-la annotée.", "صورة محمية: حمّلها ثم أرفقها مصححة.", "Protected image: download it, then attach it annotated."));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[96vh] w-[98vw] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PenLine className="h-5 w-5" />{tr("Annoter la copie", "التصحيح على الورقة", "Annotate the work")}</DialogTitle>
          <DialogDescription>{tr("Écrivez au stylet, au doigt ou à la souris. L'image annotée est jointe à la correction.", "اكتب بالقلم أو الإصبع أو الفأرة. تُرفق الصورة المصححة بالتصحيح.", "Write with a pen, finger or mouse. The annotated image is attached to the correction.")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} aria-label={c} aria-pressed={color === c}
              className={cn("h-7 w-7 rounded-full border-2", color === c ? "border-foreground" : "border-transparent")} style={{ background: c }} />
          ))}
          <select value={width} onChange={(e) => setWidth(Number(e.target.value))} className="h-8 rounded-md border bg-background px-2 text-sm" aria-label={tr("Épaisseur", "السمك", "Thickness")}>
            <option value={2}>{tr("Fin", "رفيع", "Thin")}</option>
            <option value={4}>{tr("Moyen", "متوسط", "Medium")}</option>
            <option value={8}>{tr("Épais", "سميك", "Thick")}</option>
          </select>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setStrokes((s) => s.slice(0, -1))} disabled={!strokes.length}><Undo2 className="h-4 w-4" />{tr("Annuler", "تراجع", "Undo")}</Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setStrokes([])} disabled={!strokes.length}><Eraser className="h-4 w-4" />{tr("Tout effacer", "مسح الكل", "Clear")}</Button>
        </div>
        <div className="overflow-auto rounded-lg border bg-muted">
          {failed ? (
            <p className="p-6 text-sm text-muted-foreground">{tr("Impossible de charger l'image.", "تعذر تحميل الصورة.", "Unable to load the image.")}</p>
          ) : !ready ? (
            <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <canvas ref={canvasRef} className="mx-auto block w-full max-w-full touch-none cursor-crosshair"
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tr("Fermer", "إغلاق", "Close")}</Button>
          <Button onClick={save} disabled={!ready || !strokes.length}>{tr("Joindre à la correction", "إرفاق بالتصحيح", "Attach to the correction")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface Rubric {
  name: string;
  criteria: { label: string; points: number }[];
}

/** Barème réutilisable : coche des critères → note et commentaire */
export function RubricPicker({ onApply, tr }: { onApply: (grade: number, max: number, lines: string[]) => void; tr: Tr }) {
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [active, setActive] = useState<number>(-1);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<Rubric | null>(null);

  useEffect(() => {
    getUserPrefs().then((p) => setRubrics(Array.isArray(p.rubrics) ? (p.rubrics as Rubric[]) : []));
  }, []);

  const persist = async (list: Rubric[]) => {
    const p = await getUserPrefs();
    if (await saveUserPrefs({ ...p, rubrics: list })) setRubrics(list);
    else toast.error(tr("Enregistrement impossible (mise à jour de la base nécessaire).", "تعذر الحفظ (يلزم تحديث قاعدة البيانات).", "Unable to save (database update needed)."));
  };

  const r = rubrics[active];
  const apply = () => {
    if (!r) return;
    const max = r.criteria.reduce((s, c) => s + c.points, 0);
    const got = r.criteria.filter((_, i) => checked.has(i)).reduce((s, c) => s + c.points, 0);
    onApply(got, max, r.criteria.map((c, i) => `${checked.has(i) ? "✓" : "✗"} ${c.label} (${checked.has(i) ? c.points : 0}/${c.points})`));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5"><ListChecks className="h-4 w-4" />{tr("Barème", "سلم التنقيط", "Rubric")}</Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
        {editing ? (
          <div className="space-y-2">
            <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder={tr("Nom du barème", "اسم السلم", "Rubric name")} />
            {editing.criteria.map((c, i) => (
              <div key={i} className="flex gap-1.5">
                <Input value={c.label} onChange={(e) => setEditing({ ...editing, criteria: editing.criteria.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder={tr("Critère", "معيار", "Criterion")} />
                <Input type="number" min={0} step={0.5} value={c.points} className="w-16" onChange={(e) => setEditing({ ...editing, criteria: editing.criteria.map((x, j) => (j === i ? { ...x, points: Number(e.target.value) || 0 } : x)) })} aria-label={tr("Points", "نقط", "Points")} />
                <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => setEditing({ ...editing, criteria: editing.criteria.filter((_, j) => j !== i) })} aria-label={tr("Retirer", "إزالة", "Remove")}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button size="sm" variant="ghost" className="gap-1" onClick={() => setEditing({ ...editing, criteria: [...editing.criteria, { label: "", points: 1 }] })}><Plus className="h-4 w-4" />{tr("Critère", "معيار", "Criterion")}</Button>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(null)}>{tr("Annuler", "إلغاء", "Cancel")}</Button>
              <Button size="sm" disabled={!editing.name.trim() || !editing.criteria.some((c) => c.label.trim())} onClick={async () => {
                const clean = { name: editing.name.trim(), criteria: editing.criteria.filter((c) => c.label.trim()) };
                const list = [...rubrics.filter((x) => x.name !== clean.name), clean];
                await persist(list);
                setActive(list.length - 1);
                setChecked(new Set());
                setEditing(null);
              }}>{tr("Enregistrer", "حفظ", "Save")}</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-1.5">
              <select value={active} onChange={(e) => { setActive(Number(e.target.value)); setChecked(new Set()); }} className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm" aria-label={tr("Barème", "سلم التنقيط", "Rubric")}>
                <option value={-1}>{rubrics.length ? tr("Choisir un barème…", "اختر سلما…", "Pick a rubric…") : tr("Aucun barème", "لا يوجد سلم", "No rubric")}</option>
                {rubrics.map((x, i) => <option key={x.name} value={i}>{x.name}</option>)}
              </select>
              <Button size="sm" variant="outline" onClick={() => setEditing({ name: "", criteria: [{ label: "", points: 1 }] })}>{tr("Nouveau", "جديد", "New")}</Button>
            </div>
            {r && (
              <>
                <ul className="space-y-1.5">
                  {r.criteria.map((c, i) => (
                    <li key={i}>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox checked={checked.has(i)} onCheckedChange={(v) => setChecked((s) => { const n = new Set(s); if (v) n.add(i); else n.delete(i); return n; })} />
                        <span className="min-w-0 flex-1">{c.label}</span>
                        <span className="text-xs text-muted-foreground">{c.points} pt</span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between gap-2">
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { void persist(rubrics.filter((_, i) => i !== active)); setActive(-1); }}>{tr("Supprimer", "حذف", "Delete")}</Button>
                  <Button size="sm" onClick={apply}>{tr("Appliquer la note", "تطبيق النقطة", "Apply grade")}</Button>
                </div>
              </>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

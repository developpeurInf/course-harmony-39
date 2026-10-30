import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, CalendarClock, ListOrdered } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const db = supabase as any;
type Tr = (fr: string, ar: string, en: string) => string;

/** Valeur pour <input type="datetime-local"> (heure locale) */
export const toLocalInput = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Champ « Publier automatiquement le … » (visible quand le contenu est masqué) */
export function PublishAtField({ id, value, onChange, tr }: { id: string; value: string; onChange: (v: string) => void; tr: Tr }) {
  return (
    <div className="space-y-1.5 rounded-lg border border-dashed p-3">
      <Label htmlFor={id} className="flex items-center gap-1.5 text-sm"><CalendarClock className="h-4 w-4" />{tr("Publier automatiquement le (facultatif)", "النشر تلقائيا في (اختياري)", "Publish automatically on (optional)")}</Label>
      <Input id={id} type="datetime-local" value={value} onChange={e => onChange(e.target.value)} className="max-w-xs" />
      <p className="text-xs text-muted-foreground">{tr("Le contenu reste masqué jusqu'à cette date, puis devient visible pour les élèves.", "يبقى المحتوى مخفيا حتى هذا التاريخ ثم يصبح مرئيا للتلاميذ.", "The content stays hidden until then, then becomes visible to students.")}</p>
    </div>
  );
}

/** Enregistre la date de publication programmée (null pour l'annuler) */
export async function savePublishAt(table: "courses" | "exercises", id: string, local: string): Promise<boolean> {
  const iso = local ? new Date(local).toISOString() : null;
  const { error } = await db.from(table).update({ publish_at: iso }).eq("id", id);
  if (error && !/publish_at/.test(error.message)) toast.error(error.message);
  return !error;
}

/** Réordonner les cours d'une classe (ordre vu par les élèves) */
export function CourseOrderDialog({ open, onOpenChange, roomId, courses, onSaved, tr }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  roomId: string;
  courses: { id: string; title: string }[];
  onSaved: () => void;
  tr: Tr;
}) {
  const [list, setList] = useState(courses);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setList(courses);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const move = (i: number, d: number) => setList(l => {
    const j = i + d;
    if (j < 0 || j >= l.length) return l;
    const n = [...l];
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });

  const save = async () => {
    setSaving(true);
    const { error } = await db.rpc("reorder_courses", { p_room: roomId, p_ids: list.map(c => c.id) });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(tr("Ordre enregistré", "تم حفظ الترتيب", "Order saved"));
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ListOrdered className="h-5 w-5" />{tr("Ordre des cours", "ترتيب الدروس", "Course order")}</DialogTitle>
          <DialogDescription>{tr("Les élèves voient les cours dans cet ordre.", "يرى التلاميذ الدروس بهذا الترتيب.", "Students see the courses in this order.")}</DialogDescription>
        </DialogHeader>
        <ol className="space-y-1.5">
          {list.map((c, i) => (
            <li key={c.id} className="flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm">
              <span className="w-6 text-center text-xs tabular-nums text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{c.title}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0} onClick={() => move(i, -1)} aria-label={tr("Monter", "إلى الأعلى", "Move up")}><ArrowUp className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label={tr("Descendre", "إلى الأسفل", "Move down")}><ArrowDown className="h-4 w-4" /></Button>
            </li>
          ))}
        </ol>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tr("Annuler", "إلغاء", "Cancel")}</Button>
          <Button onClick={save} disabled={saving}>{tr("Enregistrer l'ordre", "حفظ الترتيب", "Save order")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

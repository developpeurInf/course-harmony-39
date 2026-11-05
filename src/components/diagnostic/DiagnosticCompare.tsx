/**
 * Comparer deux diagnostics (ex. début / fin d'année) : on fige les notes actuelles
 * sous un nom, puis on compare une version figée avec les notes actuelles.
 * Versions enregistrées dans les préférences du professeur (table user_prefs).
 */
import { useEffect, useMemo, useState } from "react";
import { GitCompare, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { calculateClassStats, parseNoteValue, type DiagnosticClass } from "@/lib/diagnosticStatsEngine";
import { getUserPrefs, saveUserPrefs } from "@/lib/userPrefs";
import { cn } from "@/lib/utils";

type Tr = (fr: string, ar: string, en: string) => string;
interface Snapshot {
  name: string;
  at: string;
  classes: { id: string; nom: string; notes: Record<string, number | string | null> }[];
}

const fmt = (n: number | null, lang: string) => (n === null ? "—" : String(Math.round(n * 100) / 100).replace(".", lang === "en" ? "." : ","));

export function DiagnosticCompare({ classes, tr, lang }: { classes: DiagnosticClass[]; tr: Tr; lang: string }) {
  const [open, setOpen] = useState(false);
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  const [name, setName] = useState("");
  const [pick, setPick] = useState(-1);
  const [classId, setClassId] = useState("");

  useEffect(() => {
    if (!open) return;
    getUserPrefs().then((p) => setSnaps(Array.isArray(p.diagSnapshots) ? (p.diagSnapshots as Snapshot[]) : []));
    setName(tr(`Diagnostic du ${new Date().toLocaleDateString()}`, `تشخيص ${new Date().toLocaleDateString()}`, `Diagnostic ${new Date().toLocaleDateString()}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const persist = async (list: Snapshot[]) => {
    const p = await getUserPrefs();
    if (await saveUserPrefs({ ...p, diagSnapshots: list.slice(-12) })) {
      setSnaps(list.slice(-12));
      return true;
    }
    toast.error(tr("Enregistrement impossible (mise à jour de la base nécessaire).", "تعذر الحفظ (يلزم تحديث قاعدة البيانات).", "Unable to save (database update needed)."));
    return false;
  };

  const freeze = async () => {
    const snap: Snapshot = {
      name: name.trim() || new Date().toLocaleDateString(),
      at: new Date().toISOString(),
      classes: classes.map((c) => ({ id: c.id, nom: c.nom, notes: Object.fromEntries(c.students.map((s) => [String(s.id), s.note])) })),
    };
    if (await persist([...snaps, snap])) {
      toast.success(tr("Notes actuelles figées", "تم حفظ النقط الحالية", "Current grades frozen"));
      setPick(snaps.length);
    }
  };

  const snap = snaps[pick];
  const rows = useMemo(() => {
    if (!snap) return [];
    return classes.map((c) => {
      const old = snap.classes.find((x) => x.id === c.id);
      const before = old ? calculateClassStats({ ...c, students: c.students.map((s) => ({ ...s, note: old.notes[String(s.id)] ?? null })) }) : null;
      const after = calculateClassStats(c);
      let up = 0, down = 0, both = 0;
      c.students.forEach((s) => {
        const a = parseNoteValue(old?.notes[String(s.id)]), b = parseNoteValue(s.note);
        if (a === null || b === null) return;
        both++;
        if (b > a) up++;
        else if (b < a) down++;
      });
      return { c, before, after, up, down, both };
    });
  }, [snap, classes]);

  const detail = snap && classId ? classes.find((c) => c.id === classId) : null;
  const oldNotes = detail ? snap?.classes.find((x) => x.id === detail.id)?.notes || {} : {};

  return (
    <>
      <Button variant="outline" size="sm" className="text-xs gap-1.5 border-slate-200 dark:border-slate-700" onClick={() => setOpen(true)}>
        <GitCompare className="w-3.5 h-3.5 text-violet-600" />
        <span>{tr("Comparer deux diagnostics", "مقارنة تشخيصين", "Compare two diagnostics")}</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] w-[96vw] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><GitCompare className="h-5 w-5" />{tr("Comparer deux diagnostics", "مقارنة تشخيصين", "Compare two diagnostics")}</DialogTitle>
            <DialogDescription>{tr("Figez les notes du diagnostic de début d'année, puis comparez-les plus tard avec les notes actuelles.", "احفظ نقط تشخيص بداية السنة ثم قارنها لاحقا بالنقط الحالية.", "Freeze the start-of-year grades, then compare them later with the current grades.")}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
            <div className="min-w-[12rem] flex-1 space-y-1">
              <label htmlFor="diag-snap" className="text-xs font-medium">{tr("Nom de la version", "اسم النسخة", "Version name")}</label>
              <Input id="diag-snap" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <Button className="gap-1.5" onClick={freeze} disabled={!classes.length}><Save className="h-4 w-4" />{tr("Figer les notes actuelles", "حفظ النقط الحالية", "Freeze current grades")}</Button>
          </div>

          {snaps.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm">{tr("Comparer", "مقارنة", "Compare")}</span>
              <select value={pick} onChange={(e) => { setPick(Number(e.target.value)); setClassId(""); }} className="h-9 rounded-md border bg-background px-2 text-sm" aria-label={tr("Version", "النسخة", "Version")}>
                <option value={-1}>{tr("Choisir une version…", "اختر نسخة…", "Pick a version…")}</option>
                {snaps.map((s, i) => <option key={s.at} value={i}>{s.name}</option>)}
              </select>
              <span className="text-sm">{tr("avec les notes actuelles", "مع النقط الحالية", "with the current grades")}</span>
              {snap && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={async () => { await persist(snaps.filter((_, i) => i !== pick)); setPick(-1); }} aria-label={tr("Supprimer cette version", "حذف هذه النسخة", "Delete this version")}><Trash2 className="h-4 w-4" /></Button>}
            </div>
          )}

          {snap && (
            <div className="app-table-wrap">
              <table className="app-table w-full text-sm">
                <thead><tr>
                  <th className="p-2 text-start">{tr("Classe", "القسم", "Class")}</th>
                  <th className="p-2 text-start">{tr("Moyenne avant", "المعدل قبل", "Average before")}</th>
                  <th className="p-2 text-start">{tr("Moyenne après", "المعدل بعد", "Average after")}</th>
                  <th className="p-2 text-start">{tr("Écart", "الفرق", "Change")}</th>
                  <th className="p-2 text-start">{tr("Élèves en progrès", "تلاميذ في تقدم", "Students improving")}</th>
                </tr></thead>
                <tbody>
                  {rows.map(({ c, before, after, up, down, both }) => {
                    const a = before && !before.is_empty_or_absent ? before.average_note : null;
                    const b = !after.is_empty_or_absent ? after.average_note : null;
                    const d = a !== null && b !== null ? b - a : null;
                    return (
                      <tr key={c.id} className={cn("cursor-pointer", classId === c.id && "bg-muted/60")} onClick={() => setClassId(c.id)}>
                        <td className="p-2 font-medium">{c.nom}</td>
                        <td className="p-2 tabular-nums">{fmt(a, lang)}</td>
                        <td className="p-2 tabular-nums">{fmt(b, lang)}</td>
                        <td className={cn("p-2 font-semibold tabular-nums", d !== null && d > 0 && "text-emerald-600", d !== null && d < 0 && "text-destructive")}>{d === null ? "—" : `${d > 0 ? "+" : ""}${fmt(d, lang)}`}</td>
                        <td className="p-2 text-xs">{both ? tr(`${up} / ${both} (↓ ${down})`, `${up} / ${both} (↓ ${down})`, `${up} / ${both} (↓ ${down})`) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="p-2 text-xs text-muted-foreground">{tr("Cliquez sur une classe pour le détail par élève.", "انقر على قسم لعرض التفاصيل حسب التلميذ.", "Click a class for the per-student detail.")}</p>
            </div>
          )}

          {detail && (
            <ul className="divide-y rounded-lg border text-sm">
              {detail.students.map((s) => {
                const a = parseNoteValue(oldNotes[String(s.id)]), b = parseNoteValue(s.note);
                const d = a !== null && b !== null ? b - a : null;
                return (
                  <li key={String(s.id)} className="flex items-center gap-2 px-3 py-1.5">
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    <span className="w-14 text-end tabular-nums text-muted-foreground">{fmt(a, lang)}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="w-14 tabular-nums">{fmt(b, lang)}</span>
                    <span className={cn("w-14 text-end text-xs font-semibold tabular-nums", d !== null && d > 0 && "text-emerald-600", d !== null && d < 0 && "text-destructive")}>{d === null ? "" : `${d > 0 ? "+" : ""}${fmt(d, lang)}`}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

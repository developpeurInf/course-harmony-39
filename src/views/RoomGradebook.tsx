/**
 * Carnet de notes d'une classe : devoirs, contrôles et activités saisis par le professeur,
 * moyenne des quiz calculée automatiquement, moyenne pondérée par élève.
 * Export Excel (code Massar, nom, notes /20) et copie d'une colonne pour la coller dans Massar.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { ClipboardCopy, Download, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Navigate, useParams } from "@/lib/router";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses } from "@/contexts/CourseContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { accessStore, useAccess } from "@/contexts/AccessContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { downloadBlob } from "@/lib/download";
import { computeClassAnalytics } from "@/lib/classAnalytics";
import { isMissingRelation, loadRoomResults, loadRoomStudents, localDay, type RoomResults, type RoomStudent } from "@/lib/roomData";

type Term = "S1" | "S2";
type Kind = "devoir" | "controle" | "activite" | "autre";
interface Column { id: string; room_id: string; term: string; title: string; kind: Kind; max_points: number; coef: number; position: number }
interface Mark { column_id: string; student_id: string; value: number | null; absent: boolean }

const termRange = (term: Term, now = new Date()) => {
  const y0 = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return term === "S1" ? { from: `${y0}-09-01`, to: `${y0 + 1}-01-31` } : { from: `${y0 + 1}-02-01`, to: `${y0 + 1}-07-15` };
};
const r2 = (v: number) => Math.round(v * 100) / 100;

const RoomGradebook = () => {
  const { roomId } = useParams();
  const { user } = useAuth();
  const { rooms } = useCourses();
  const { language } = useLanguage();
  const { prefs } = usePreferences();
  const { can } = useAccess();
  const tr = useCallback((fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en), [language]);
  const room = rooms.find((r) => r.id === roomId);
  const fmt = (v: number | null | undefined) => (v === null || v === undefined || Number.isNaN(v) ? "" : String(r2(v)).replace(".", language === "en" ? "." : ","));

  const [term, setTerm] = useState<Term>(() => (new Date().getMonth() >= 1 && new Date().getMonth() <= 7 ? "S2" : "S1"));
  const [loading, setLoading] = useState(true);
  const [dbReady, setDbReady] = useState(true);
  const [students, setStudents] = useState<RoomStudent[]>([]);
  const [results, setResults] = useState<RoomResults | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [marks, setMarks] = useState<Map<string, Mark>>(new Map());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [includeQuiz, setIncludeQuiz] = useState(true);
  const [quizCoef, setQuizCoef] = useState(1);
  const [colOpen, setColOpen] = useState(false);
  const [newCol, setNewCol] = useState({ title: "", kind: "devoir" as Kind, max: 20, coef: 1 });
  const [toDelete, setToDelete] = useState<Column | null>(null);
  const [saving, setSaving] = useState(0);
  const savingRef = useRef(0);

  const key = (c: string, s: string) => `${c}:${s}`;

  const load = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      const [st, res] = await Promise.all([loadRoomStudents(roomId), loadRoomResults(roomId)]);
      setStudents(st);
      setResults(res);
      const { data: cols, error } = await (supabase as any).from("gradebook_columns").select("*").eq("room_id", roomId).order("position").order("created_at");
      if (error) {
        if (isMissingRelation(error)) setDbReady(false);
        setColumns([]);
        setMarks(new Map());
        return;
      }
      setDbReady(true);
      setColumns(cols || []);
      const ids = (cols || []).map((c: Column) => c.id);
      const m = new Map<string, Mark>();
      if (ids.length) {
        const { data: mk } = await (supabase as any).from("gradebook_marks").select("column_id, student_id, value, absent").in("column_id", ids);
        (mk || []).forEach((x: Mark) => m.set(key(x.column_id, x.student_id), x));
      }
      setMarks(m);
      setDrafts({});
    } catch (e) {
      console.error(e);
      toast.error(tr("Erreur de chargement", "خطأ في التحميل", "Loading error"));
    } finally {
      setLoading(false);
    }
  }, [roomId, tr]);
  useEffect(() => {
    void load();
  }, [load]);

  const termCols = columns.filter((c) => c.term === term);
  const range = termRange(term);
  const quizNote = useMemo(() => {
    const m = new Map<string, number | null>();
    if (!results) return m;
    const quizzes = results.quizzes.filter((q) => {
      const d = localDay(new Date(q.date));
      return d >= range.from && d <= range.to;
    });
    const a = computeClassAnalytics({
      students, quizzes, submissions: results.submissions, questions: results.questions, answers: [], sessions: results.sessions,
      options: { passThreshold: prefs.passThreshold, levelStruggling: prefs.levelStruggling, levelGood: prefs.levelGood, levelExcellent: prefs.levelExcellent, attemptPolicy: prefs.attemptPolicy, inactivityDays: prefs.inactivityDays },
    });
    a.students.forEach((s) => m.set(s.student.id, s.note20));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, students, term, prefs.passThreshold, prefs.attemptPolicy, prefs.levelGood, prefs.levelExcellent, prefs.levelStruggling, prefs.inactivityDays]);

  const on20 = (c: Column, s: string) => {
    const mk = marks.get(key(c.id, s));
    if (!mk || mk.absent || mk.value === null) return null;
    return (Number(mk.value) / Number(c.max_points)) * 20;
  };
  const average = (s: string) => {
    let sum = 0;
    let w = 0;
    termCols.forEach((c) => {
      const v = on20(c, s);
      if (v !== null && c.coef > 0) {
        sum += v * Number(c.coef);
        w += Number(c.coef);
      }
    });
    const q = quizNote.get(s);
    if (includeQuiz && q !== null && q !== undefined && quizCoef > 0) {
      sum += q * quizCoef;
      w += quizCoef;
    }
    return w ? sum / w : null;
  };

  const kindLabel = (k: Kind) => ({
    devoir: tr("Devoir surveillé", "فرض محروس", "Test"),
    controle: tr("Contrôle continu", "مراقبة مستمرة", "Continuous assessment"),
    activite: tr("Activités intégrées", "الأنشطة المندمجة", "Integrated activities"),
    autre: tr("Autre", "أخرى", "Other"),
  })[k];

  const addColumn = async () => {
    if (!roomId || !newCol.title.trim()) return;
    if (!accessStore.guard("gradebook.manage")) return;
    const { data, error } = await (supabase as any).from("gradebook_columns").insert({
      room_id: roomId, term, title: newCol.title.trim(), kind: newCol.kind, max_points: newCol.max || 20, coef: newCol.coef, position: columns.length,
    }).select("*").single();
    if (error) {
      toast.error(tr("Impossible d'ajouter la colonne.", "تعذرت إضافة العمود.", "Unable to add the column."));
      return;
    }
    setColumns((l) => [...l, data]);
    setColOpen(false);
  };
  const deleteColumn = async () => {
    if (!toDelete) return;
    if (!accessStore.guard("gradebook.manage")) return;
    const { error } = await (supabase as any).from("gradebook_columns").delete().eq("id", toDelete.id);
    if (error) {
      toast.error(tr("Suppression impossible.", "تعذر الحذف.", "Unable to delete."));
      return;
    }
    setColumns((l) => l.filter((c) => c.id !== toDelete.id));
    setToDelete(null);
  };

  // Saisie d'une note : « 14,5 », « abs » / « غ » pour absent, vide pour effacer
  const commit = async (c: Column, s: string) => {
    const k = key(c.id, s);
    if (!(k in drafts)) return;
    const raw = drafts[k].trim();
    const absent = /^(abs|a|غ|غائب)$/i.test(raw);
    const value = raw === "" || absent ? null : Number(raw.replace(",", "."));
    if (value !== null && (Number.isNaN(value) || value < 0 || value > Number(c.max_points))) {
      toast.error(tr(`Note invalide (0 à ${c.max_points}).`, `نقطة غير صالحة (0 إلى ${c.max_points}).`, `Invalid mark (0 to ${c.max_points}).`));
      return;
    }
    if (!accessStore.guard("gradebook.manage")) return;
    savingRef.current += 1;
    setSaving(savingRef.current);
    const row = { column_id: c.id, student_id: s, value, absent, updated_at: new Date().toISOString() };
    const { error } = await (supabase as any).from("gradebook_marks").upsert(row, { onConflict: "column_id,student_id" });
    savingRef.current -= 1;
    setSaving(savingRef.current);
    if (error) {
      toast.error(tr("Note non enregistrée.", "لم تحفظ النقطة.", "Mark not saved."));
      return;
    }
    setMarks((m) => new Map(m).set(k, row));
    setDrafts((d) => {
      const n = { ...d };
      delete n[k];
      return n;
    });
  };
  const cellText = (c: Column, s: string) => {
    const k = key(c.id, s);
    if (k in drafts) return drafts[k];
    const mk = marks.get(k);
    if (!mk) return "";
    return mk.absent ? tr("abs", "غ", "abs") : fmt(mk.value);
  };

  const exportXlsx = async () => {
    const head = [tr("Code Massar", "رمز مسار", "Massar code"), tr("Nom et prénom", "الاسم الكامل", "Full name"),
      ...termCols.map((c) => `${c.title} (/20)`), ...(includeQuiz ? [tr("Moyenne des quiz", "معدل الاختبارات", "Quiz average")] : []), tr("Moyenne", "المعدل", "Average")];
    const rows = students.map((s) => [
      s.username || "", s.name,
      ...termCols.map((c) => {
        const mk = marks.get(key(c.id, s.id));
        if (mk?.absent) return tr("Abs", "غ", "Abs");
        const v = on20(c, s.id);
        return v === null ? "" : r2(v);
      }),
      ...(includeQuiz ? [quizNote.get(s.id) === null || quizNote.get(s.id) === undefined ? "" : r2(quizNote.get(s.id) as number)] : []),
      average(s.id) === null ? "" : r2(average(s.id) as number),
    ]);
    const ws = XLSX.utils.aoa_to_sheet([[`${room?.name || ""} · ${term}`], [], head, ...rows]);
    ws["!cols"] = [{ wch: 14 }, { wch: 28 }, ...head.slice(2).map(() => ({ wch: 14 }))];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, term);
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    await downloadBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `notes-${term}-${(room?.name || "classe").replace(/[^\w-]+/g, "_")}.xlsx`);
  };

  // Une note par ligne, dans l'ordre des élèves : à coller dans la colonne correspondante de Massar
  const copyColumn = async (get: (s: string) => number | null | "abs") => {
    const text = students.map((s) => {
      const v = get(s.id);
      return v === "abs" ? "" : v === null ? "" : String(r2(v)).replace(".", ",");
    }).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success(tr("Colonne copiée : collez-la dans Massar (même ordre des élèves).", "تم نسخ العمود: ألصقه في مسار (نفس ترتيب التلاميذ).", "Column copied: paste it in Massar (same student order)."));
    } catch {
      toast.error(tr("Copie impossible sur cet appareil.", "النسخ غير ممكن على هذا الجهاز.", "Copy not available on this device."));
    }
  };

  if (!roomId || user?.role !== "professor") return <Navigate to="/dashboard" replace />;
  const editable = dbReady && can("gradebook.manage");

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{tr("Carnet de notes", "دفتر النقط", "Gradebook")}</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {tr("Tapez une note puis Entrée ou Tab ; « abs » pour une absence. Les élèves sont triés comme dans Massar (ordre alphabétique).",
              "اكتب النقطة ثم Entrée أو Tab؛ « غ » للغياب. التلاميذ مرتبون أبجدياً كما في مسار.",
              "Type a mark then Enter or Tab; “abs” for absent. Students are sorted alphabetically.")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={term} onValueChange={(v) => setTerm(v as Term)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="S1">{tr("1er semestre", "الدورة الأولى", "Semester 1")}</SelectItem>
              <SelectItem value="S2">{tr("2e semestre", "الدورة الثانية", "Semester 2")}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-1.5" onClick={() => { setNewCol({ title: `${tr("Devoir", "الفرض", "Test")} ${termCols.filter((c) => c.kind === "devoir").length + 1}`, kind: "devoir", max: 20, coef: 1 }); setColOpen(true); }} disabled={!editable}>
            <Plus className="h-4 w-4" />{tr("Colonne", "عمود", "Column")}
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={() => void exportXlsx()} disabled={!students.length}><Download className="h-4 w-4" />Excel</Button>
          <Button variant="ghost" size="icon" onClick={() => void load()} aria-label={tr("Actualiser", "تحديث", "Refresh")}><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></Button>
          {saving > 0 && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {!dbReady && (
        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          {tr("La saisie des notes sera disponible après la mise à jour de la base de données (migration 20261030090000). La moyenne des quiz est déjà affichée.",
            "سيتوفر إدخال النقط بعد تحديث قاعدة البيانات. معدل الاختبارات معروض حالياً.",
            "Mark entry will be available after the database update. The quiz average is already shown.")}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2"><Checkbox checked={includeQuiz} onCheckedChange={(v) => setIncludeQuiz(!!v)} />{tr("Compter la moyenne des quiz", "احتساب معدل الاختبارات", "Include the quiz average")}</label>
        {includeQuiz && (
          <span className="flex items-center gap-1.5 text-muted-foreground">{tr("coef.", "المعامل", "coef.")}
            <Input type="number" min={0} max={10} step="0.5" className="h-8 w-16" value={quizCoef} onChange={(e) => setQuizCoef(Math.max(0, Number(e.target.value) || 0))} />
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : students.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">{tr("Aucun élève dans cette classe.", "لا يوجد تلاميذ في هذا القسم.", "No students in this class.")}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-max text-sm">
            <thead className="bg-muted/50 text-xs">
              <tr>
                <th className="sticky start-0 z-10 bg-muted/90 px-3 py-2 text-start font-semibold">{tr("Élève", "التلميذ", "Student")}</th>
                {termCols.map((c) => (
                  <th key={c.id} className="px-2 py-2 text-center font-semibold">
                    <div className="flex items-center justify-center gap-1">
                      <span title={kindLabel(c.kind)}>{c.title}</span>
                      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => void copyColumn((s) => {
                        const mk = marks.get(key(c.id, s));
                        return mk?.absent ? "abs" : on20(c, s);
                      })} title={tr("Copier pour Massar", "نسخ لمسار", "Copy for Massar")} aria-label={tr(`Copier ${c.title}`, `نسخ ${c.title}`, `Copy ${c.title}`)}><ClipboardCopy className="h-3.5 w-3.5" /></button>
                      {editable && <button type="button" className="text-muted-foreground hover:text-rose-600" onClick={() => setToDelete(c)} aria-label={tr(`Supprimer ${c.title}`, `حذف ${c.title}`, `Delete ${c.title}`)}><Trash2 className="h-3.5 w-3.5" /></button>}
                    </div>
                    <div className="font-normal text-muted-foreground">/{fmt(Number(c.max_points))}{Number(c.coef) !== 1 ? ` · ×${fmt(Number(c.coef))}` : ""}</div>
                  </th>
                ))}
                {includeQuiz && (
                  <th className="px-2 py-2 text-center font-semibold">
                    <div className="flex items-center justify-center gap-1">{tr("Quiz", "الاختبارات", "Quizzes")}
                      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => void copyColumn((s) => quizNote.get(s) ?? null)} aria-label={tr("Copier la moyenne des quiz", "نسخ معدل الاختبارات", "Copy quiz average")}><ClipboardCopy className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="font-normal text-muted-foreground">/20 · {tr("auto", "تلقائي", "auto")}</div>
                  </th>
                )}
                <th className="px-3 py-2 text-center font-semibold">
                  <div className="flex items-center justify-center gap-1">{tr("Moyenne", "المعدل", "Average")}
                    <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => void copyColumn(average)} aria-label={tr("Copier les moyennes", "نسخ المعدلات", "Copy averages")}><ClipboardCopy className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="font-normal text-muted-foreground">/20</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {students.map((s) => {
                const avg = average(s.id);
                return (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <td className="sticky start-0 z-10 max-w-[14rem] truncate bg-card px-3 py-1.5 font-medium">
                      {s.name}
                      {s.username && <span className="ms-1.5 text-[11px] font-normal text-muted-foreground" dir="ltr">{s.username}</span>}
                    </td>
                    {termCols.map((c) => (
                      <td key={c.id} className="px-1 py-1 text-center">
                        <input
                          className="h-8 w-16 rounded-md border bg-background text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
                          inputMode="decimal"
                          disabled={!editable}
                          value={cellText(c, s.id)}
                          onChange={(e) => setDrafts((d) => ({ ...d, [key(c.id, s.id)]: e.target.value }))}
                          onBlur={() => void commit(c, s.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              (e.currentTarget as HTMLInputElement).blur();
                              // descend d'une ligne, comme dans un tableur
                              const tr_ = (e.currentTarget.closest("tr")?.nextElementSibling as HTMLElement | null);
                              const idx = Array.from(e.currentTarget.closest("tr")?.children || []).indexOf(e.currentTarget.closest("td") as Element);
                              (tr_?.children[idx]?.querySelector("input") as HTMLInputElement | null)?.focus();
                            }
                          }}
                          aria-label={`${s.name} · ${c.title}`}
                        />
                      </td>
                    ))}
                    {includeQuiz && <td className="px-2 py-1 text-center tabular-nums text-muted-foreground" dir="ltr">{fmt(quizNote.get(s.id) ?? null) || "—"}</td>}
                    <td className={cn("px-3 py-1 text-center font-semibold tabular-nums", avg !== null && avg < prefs.passThreshold && "text-rose-600")} dir="ltr">{fmt(avg) || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={colOpen} onOpenChange={setColOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{tr("Nouvelle colonne de notes", "عمود نقط جديد", "New mark column")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>{tr("Titre", "العنوان", "Title")}</Label><Input value={newCol.title} onChange={(e) => setNewCol((c) => ({ ...c, title: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>{tr("Type", "النوع", "Type")}</Label>
              <Select value={newCol.kind} onValueChange={(v) => setNewCol((c) => ({ ...c, kind: v as Kind }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(["devoir", "controle", "activite", "autre"] as Kind[]).map((k) => <SelectItem key={k} value={k}>{kindLabel(k)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>{tr("Noté sur", "على", "Out of")}</Label><Input type="number" min={1} value={newCol.max} onChange={(e) => setNewCol((c) => ({ ...c, max: Math.max(1, Number(e.target.value) || 20) }))} /></div>
              <div className="space-y-1.5"><Label>{tr("Coefficient", "المعامل", "Weight")}</Label><Input type="number" min={0} step="0.5" value={newCol.coef} onChange={(e) => setNewCol((c) => ({ ...c, coef: Math.max(0, Number(e.target.value) || 0) }))} /></div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setColOpen(false)}>{tr("Annuler", "إلغاء", "Cancel")}</Button>
            <Button onClick={() => void addColumn()} disabled={!newCol.title.trim()}>{tr("Ajouter", "إضافة", "Add")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr(`Supprimer « ${toDelete?.title} » ?`, `حذف « ${toDelete?.title} »؟`, `Delete “${toDelete?.title}”?`)}</AlertDialogTitle>
            <AlertDialogDescription>{tr("Toutes les notes de cette colonne seront effacées.", "ستحذف كل نقط هذا العمود.", "All marks in this column will be deleted.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr("Annuler", "إلغاء", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void deleteColumn(); }} className="bg-rose-600 hover:bg-rose-700">{tr("Supprimer", "حذف", "Delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RoomGradebook;

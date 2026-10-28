/**
 * Cahier de textes.
 *   Professeur (/rooms/:roomId/lesson-log) : une entrée par séance (date, heure, leçon,
 *   contenu, travail à faire pour une date), modification, impression du cahier.
 *   Élève (/lesson-log) : lecture du cahier de sa classe et du travail à faire.
 * Le travail à faire apparaît aussi dans le calendrier.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpenCheck, Loader2, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useParams } from "@/lib/router";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses } from "@/contexts/CourseContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { accessStore, useAccess } from "@/contexts/AccessContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { isMissingRelation, localDay } from "@/lib/roomData";
import { escapeHtml, getReportBranding, reportHeaderLines } from "@/lib/reportBranding";
import { openPrintable } from "@/lib/appreciations";

interface Entry {
  id: string;
  room_id: string;
  lesson_date: string;
  slot: number;
  course_id: string | null;
  title: string;
  content: string | null;
  homework: string | null;
  homework_due: string | null;
}
const EMPTY = { lesson_date: localDay(), slot: 1, course_id: "none", title: "", content: "", homework: "", homework_due: "" };

const LessonLog = () => {
  const { roomId: paramRoom } = useParams();
  const { user } = useAuth();
  const { rooms, courses, enrollments } = useCourses();
  const { language } = useLanguage();
  const { can } = useAccess();
  const tr = useCallback((fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en), [language]);
  const locale = language === "ar" ? "ar-MA" : language === "fr" ? "fr-FR" : "en-GB";
  const isProfessor = user?.role === "professor";

  // Élève : sa classe (profil) ou ses inscriptions
  const studentRooms = useMemo(() => {
    if (isProfessor || !user) return [] as string[];
    const ids = new Set<string>();
    if (user.room_id) ids.add(user.room_id);
    enrollments.filter((e) => e.student_id === user.id && e.room_id).forEach((e) => ids.add(e.room_id as string));
    return [...ids];
  }, [isProfessor, user, enrollments]);
  const [pickedRoom, setPickedRoom] = useState<string | null>(null);
  const roomId = paramRoom || pickedRoom || studentRooms[0] || null;
  const room = rooms.find((r) => r.id === roomId);
  const roomCourses = courses.filter((c) => c.room_id === roomId);
  const editable = isProfessor && can("lesson_log.manage");

  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [form, setForm] = useState<typeof EMPTY & { id?: string }>(EMPTY);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<Entry | null>(null);

  const load = useCallback(async () => {
    if (!roomId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await (supabase as any).from("lesson_log").select("*").eq("room_id", roomId).order("lesson_date", { ascending: false }).order("slot", { ascending: false }).limit(1000);
    setLoading(false);
    if (error) {
      if (isMissingRelation(error)) setMissing(true);
      return;
    }
    setMissing(false);
    setEntries(data || []);
  }, [roomId]);
  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!roomId || !form.title.trim() || busy) return;
    if (!accessStore.guard("lesson_log.manage")) return;
    setBusy(true);
    const row = {
      room_id: roomId,
      lesson_date: form.lesson_date || localDay(),
      slot: form.slot || 1,
      course_id: form.course_id === "none" ? null : form.course_id,
      title: form.title.trim(),
      content: form.content.trim() || null,
      homework: form.homework.trim() || null,
      homework_due: form.homework.trim() && form.homework_due ? form.homework_due : null,
      updated_at: new Date().toISOString(),
    };
    const { error } = form.id
      ? await (supabase as any).from("lesson_log").update(row).eq("id", form.id)
      : await (supabase as any).from("lesson_log").insert(row);
    setBusy(false);
    if (error) {
      toast.error(tr("Enregistrement impossible.", "تعذر الحفظ.", "Unable to save."));
      return;
    }
    setOpen(false);
    toast.success(tr("Séance enregistrée.", "تم حفظ الحصة.", "Lesson saved."));
    void load();
  };
  const remove = async () => {
    if (!toDelete) return;
    if (!accessStore.guard("lesson_log.manage")) return;
    const { error } = await (supabase as any).from("lesson_log").delete().eq("id", toDelete.id);
    if (error) {
      toast.error(tr("Suppression impossible.", "تعذر الحذف.", "Unable to delete."));
      return;
    }
    setEntries((l) => l.filter((e) => e.id !== toDelete.id));
    setToDelete(null);
  };

  const dateLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const courseTitle = (id: string | null) => (id ? courses.find((c) => c.id === id)?.title : undefined);
  const today = localDay();
  const upcomingHomework = entries.filter((e) => e.homework && e.homework_due && e.homework_due >= today).sort((a, b) => (a.homework_due || "").localeCompare(b.homework_due || ""));

  const print = () => {
    const lang = language === "ar" ? "ar" : "fr";
    const b = getReportBranding(lang);
    const head = reportHeaderLines(b).map((l) => `<div>${escapeHtml(l)}</div>`).join("");
    const L = lang === "ar"
      ? { t: "دفتر النصوص", d: "التاريخ", s: "الحصة", l: "الدرس", c: "المضمون", h: "الواجب", due: "لـ" }
      : { t: "Cahier de textes", d: "Date", s: "Séance", l: "Leçon", c: "Contenu", h: "Travail à faire", due: "pour le" };
    const rows = [...entries].reverse().map((e) => `<tr><td>${escapeHtml(new Date(`${e.lesson_date}T12:00:00`).toLocaleDateString(lang === "ar" ? "ar-MA" : "fr-FR"))}</td><td class="c">${e.slot}</td>
      <td><b>${escapeHtml(e.title)}</b>${courseTitle(e.course_id) ? `<br><small>${escapeHtml(courseTitle(e.course_id) || "")}</small>` : ""}</td>
      <td>${escapeHtml(e.content || "").replace(/\n/g, "<br>")}</td>
      <td>${escapeHtml(e.homework || "").replace(/\n/g, "<br>")}${e.homework_due ? `<br><small>${L.due} ${escapeHtml(new Date(`${e.homework_due}T12:00:00`).toLocaleDateString(lang === "ar" ? "ar-MA" : "fr-FR"))}</small>` : ""}</td></tr>`).join("");
    openPrintable(`<!doctype html><html lang="${lang}" dir="${lang === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${L.t} · ${escapeHtml(room?.name || "")}</title>
<style>@page{size:A4 landscape;margin:12mm}body{font-family:${lang === "ar" ? "'Noto Naskh Arabic',Tahoma," : ""}'Segoe UI',Arial,sans-serif;font-size:12px;color:#111}
.head{font-weight:600;line-height:1.5;border-bottom:2px solid #222;padding-bottom:6px}h1{text-align:center;font-size:18px;margin:10px 0}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:5px 7px;vertical-align:top;text-align:start}th{background:#f1f1f1}.c{text-align:center}tr{page-break-inside:avoid}</style></head>
<body><div class="head">${head}</div><h1>${L.t} · ${escapeHtml(room?.name || "")}</h1>
<table><thead><tr><th style="width:11%">${L.d}</th><th style="width:5%">${L.s}</th><th style="width:22%">${L.l}</th><th>${L.c}</th><th style="width:24%">${L.h}</th></tr></thead><tbody>${rows}</tbody></table>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},300);});</script></body></html>`);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><BookOpenCheck className="h-6 w-6 text-muted-foreground" />{tr("Cahier de textes", "دفتر النصوص", "Lesson log")}{room ? ` · ${room.name}` : ""}</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {isProfessor
              ? tr("Notez ce qui a été fait à chaque séance et le travail à faire : les élèves le voient dans l'application et dans le calendrier.",
                "سجل ما أنجز في كل حصة والواجبات: يراها التلاميذ في التطبيق وفي الأجندة.",
                "Record each lesson and the homework: students see it in the app and in the calendar.")
              : tr("Les séances de la classe et le travail à faire.", "حصص القسم والواجبات المنزلية.", "Class lessons and homework.")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!paramRoom && studentRooms.length > 1 && (
            <Select value={roomId || ""} onValueChange={setPickedRoom}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{studentRooms.map((id) => <SelectItem key={id} value={id}>{rooms.find((r) => r.id === id)?.name || id}</SelectItem>)}</SelectContent>
            </Select>
          )}
          {isProfessor && <Button variant="outline" className="gap-1.5" onClick={print} disabled={!entries.length}><Printer className="h-4 w-4" />{tr("Imprimer", "طباعة", "Print")}</Button>}
          {isProfessor && (
            <Button className="gap-1.5" disabled={!editable || missing} onClick={() => { setForm({ ...EMPTY, lesson_date: localDay() }); setOpen(true); }}>
              <Plus className="h-4 w-4" />{tr("Nouvelle séance", "حصة جديدة", "New lesson")}
            </Button>
          )}
        </div>
      </div>

      {missing && (
        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          {tr("Le cahier de textes sera disponible après la mise à jour de la base de données (migration 20261030090000).", "سيتوفر دفتر النصوص بعد تحديث قاعدة البيانات.", "The lesson log will be available after the database update.")}
        </div>
      )}

      {upcomingHomework.length > 0 && (
        <section className="rounded-xl border border-sky-300 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/30">
          <h2 className="mb-2 text-sm font-semibold">{tr("Travail à faire", "الواجبات المنزلية", "Homework")}</h2>
          <ul className="space-y-1.5 text-sm">
            {upcomingHomework.map((e) => (
              <li key={e.id} className="flex gap-2">
                <span className="shrink-0 font-semibold">{new Date(`${e.homework_due}T12:00:00`).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })}</span>
                <span className="whitespace-pre-line">{e.homework}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : !roomId ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">{tr("Aucune classe.", "لا يوجد قسم.", "No class.")}</div>
      ) : entries.length === 0 && !missing ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">{tr("Aucune séance notée pour l'instant.", "لم تسجل أي حصة بعد.", "No lesson recorded yet.")}</div>
      ) : (
        <ol className="space-y-2">
          {entries.map((e) => (
            <li key={e.id} className="rounded-xl border bg-card p-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-xs font-semibold capitalize text-muted-foreground">{dateLabel(e.lesson_date)} · {tr("séance", "الحصة", "lesson")} {e.slot}</span>
                {courseTitle(e.course_id) && <span className="text-xs text-muted-foreground">{courseTitle(e.course_id)}</span>}
                {editable && (
                  <span className="ms-auto flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setForm({ id: e.id, lesson_date: e.lesson_date, slot: e.slot, course_id: e.course_id || "none", title: e.title, content: e.content || "", homework: e.homework || "", homework_due: e.homework_due || "" }); setOpen(true); }} aria-label={tr("Modifier", "تعديل", "Edit")}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600" onClick={() => setToDelete(e)} aria-label={tr("Supprimer", "حذف", "Delete")}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </span>
                )}
              </div>
              <h3 className="mt-0.5 font-semibold">{e.title}</h3>
              {e.content && <p className="mt-1 whitespace-pre-line text-sm text-foreground/85">{e.content}</p>}
              {e.homework && (
                <p className={cn("mt-2 whitespace-pre-line rounded-lg px-2.5 py-1.5 text-sm", "bg-sky-50 dark:bg-sky-950/30")}>
                  <span className="font-semibold">{tr("À faire", "الواجب", "Homework")}{e.homework_due ? ` (${new Date(`${e.homework_due}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short" })})` : ""} : </span>{e.homework}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}

      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? tr("Modifier la séance", "تعديل الحصة", "Edit lesson") : tr("Nouvelle séance", "حصة جديدة", "New lesson")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1.5"><Label>{tr("Date", "التاريخ", "Date")}</Label><Input type="date" value={form.lesson_date} onChange={(e) => setForm((f) => ({ ...f, lesson_date: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>{tr("Séance", "الحصة", "Slot")}</Label><Input type="number" min={1} max={12} value={form.slot} onChange={(e) => setForm((f) => ({ ...f, slot: Math.min(12, Math.max(1, Number(e.target.value) || 1)) }))} /></div>
            </div>
            {roomCourses.length > 0 && (
              <div className="space-y-1.5">
                <Label>{tr("Cours lié (facultatif)", "الدرس المرتبط (اختياري)", "Linked course (optional)")}</Label>
                <Select value={form.course_id} onValueChange={(v) => setForm((f) => ({ ...f, course_id: v, title: f.title || (v !== "none" ? courses.find((c) => c.id === v)?.title || "" : "") }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {roomCourses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5"><Label>{tr("Leçon / titre", "الدرس / العنوان", "Lesson / title")} *</Label><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>{tr("Contenu de la séance", "مضمون الحصة", "Lesson content")}</Label><Textarea rows={3} value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>{tr("Travail à faire", "الواجب المنزلي", "Homework")}</Label><Textarea rows={2} value={form.homework} onChange={(e) => setForm((f) => ({ ...f, homework: e.target.value }))} /></div>
            {form.homework.trim() && (
              <div className="space-y-1.5"><Label>{tr("Pour le", "لـ", "Due")}</Label><Input type="date" value={form.homework_due} onChange={(e) => setForm((f) => ({ ...f, homework_due: e.target.value }))} /></div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>{tr("Annuler", "إلغاء", "Cancel")}</Button>
            <Button onClick={() => void save()} disabled={busy || !form.title.trim()} className="gap-1.5">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{tr("Enregistrer", "حفظ", "Save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr("Supprimer cette séance ?", "حذف هذه الحصة؟", "Delete this lesson?")}</AlertDialogTitle>
            <AlertDialogDescription>{toDelete?.title}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr("Annuler", "إلغاء", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void remove(); }} className="bg-rose-600 hover:bg-rose-700">{tr("Supprimer", "حذف", "Delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LessonLog;

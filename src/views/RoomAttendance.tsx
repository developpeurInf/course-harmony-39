/**
 * Appel des présences d'une classe : tout le monde « présent » par défaut, un appui
 * pour marquer un absent, un retard ou une absence justifiée. Récapitulatif par élève
 * sur le mois, le trimestre ou l'année scolaire, avec export CSV.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, CheckCheck, Download, Loader2, Save, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Navigate, useParams } from "@/lib/router";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses } from "@/contexts/CourseContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { accessStore } from "@/contexts/AccessContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { downloadBlob } from "@/lib/download";
import { formatDate } from "@/lib/formatDate";
import {
  attendanceTotals, isMissingRelation, loadAttendance, loadRoomStudents, localDay, schoolYearStart, toCsv,
  type AttendanceRow, type AttendanceStatus, type RoomStudent,
} from "@/lib/roomData";

const STATUSES: AttendanceStatus[] = ["present", "absent", "late", "excused"];

const RoomAttendance = () => {
  const { roomId } = useParams();
  const { user } = useAuth();
  const { rooms } = useCourses();
  const { language } = useLanguage();
  const tr = useCallback((fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en), [language]);
  const room = rooms.find((r) => r.id === roomId);

  const statusLabel = (s: AttendanceStatus, short = false) => {
    const m: Record<AttendanceStatus, [string, string, string, string, string, string]> = {
      present: ["Présent", "حاضر", "Present", "P", "ح", "P"],
      absent: ["Absent", "غائب", "Absent", "A", "غ", "A"],
      late: ["Retard", "متأخر", "Late", "R", "م", "L"],
      excused: ["Justifié", "غياب مبرر", "Excused", "J", "ب", "E"],
    };
    const v = m[s];
    return short ? tr(v[3], v[4], v[5]) : tr(v[0], v[1], v[2]);
  };
  const statusStyle: Record<AttendanceStatus, string> = {
    present: "border-emerald-300 bg-emerald-500/10 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300",
    absent: "border-rose-400 bg-rose-500/15 text-rose-700 dark:border-rose-800 dark:text-rose-300",
    late: "border-amber-400 bg-amber-500/15 text-amber-700 dark:border-amber-800 dark:text-amber-300",
    excused: "border-sky-300 bg-sky-500/10 text-sky-700 dark:border-sky-800 dark:text-sky-300",
  };

  const [students, setStudents] = useState<RoomStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [day, setDay] = useState(localDay());
  const [slot, setSlot] = useState("1");
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [saved, setSaved] = useState<Record<string, AttendanceStatus>>({});
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<AttendanceRow[]>([]);
  const [period, setPeriod] = useState<"month" | "trimester" | "year">("month");
  const [tab, setTab] = useState("call");

  const periodStart = useMemo(() => {
    const now = new Date();
    if (period === "month") return localDay(new Date(now.getFullYear(), now.getMonth(), 1));
    if (period === "trimester") return localDay(new Date(now.getFullYear(), now.getMonth() - 2, 1));
    return schoolYearStart(now);
  }, [period]);

  const loadDay = useCallback(async () => {
    if (!roomId) return;
    try {
      const rows = (await loadAttendance(roomId, day, day)).filter((r) => String(r.slot) === slot);
      const m: Record<string, AttendanceStatus> = {};
      rows.forEach((r) => (m[r.student_id] = r.status));
      setSaved(m);
      setMarks(m);
      setAvailable(true);
    } catch (e) {
      if (isMissingRelation(e)) setAvailable(false);
      else console.error("attendance load error:", e);
    }
  }, [roomId, day, slot]);

  const loadHistory = useCallback(async () => {
    if (!roomId) return;
    try {
      setHistory(await loadAttendance(roomId, schoolYearStart()));
    } catch (e) {
      if (!isMissingRelation(e)) console.error("attendance history error:", e);
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    setLoading(true);
    loadRoomStudents(roomId)
      .then(setStudents)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
    void loadHistory();
  }, [roomId, loadHistory]);

  useEffect(() => {
    void loadDay();
  }, [loadDay]);

  const statusOf = (id: string): AttendanceStatus => marks[id] || "present";
  const cycle = (id: string) => {
    const cur = statusOf(id);
    const next = STATUSES[(STATUSES.indexOf(cur) + 1) % STATUSES.length];
    setMarks((m) => ({ ...m, [id]: next }));
  };
  const alreadyTaken = Object.keys(saved).length > 0;
  const dirty = !alreadyTaken || students.some((s) => statusOf(s.id) !== (saved[s.id] || "present"));
  const counts = useMemo(() => {
    const c: Record<AttendanceStatus, number> = { present: 0, absent: 0, late: 0, excused: 0 };
    students.forEach((s) => (c[statusOf(s.id)] += 1));
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, marks]);

  const save = async () => {
    if (!roomId || !user || saving || !students.length) return;
    if (!accessStore.guard("attendance.manage")) return;
    setSaving(true);
    try {
      const rows = students.map((s) => ({
        room_id: roomId,
        student_id: s.id,
        session_date: day,
        slot: Number(slot),
        status: statusOf(s.id),
        recorded_by: user.id,
        recorded_at: new Date().toISOString(),
      }));
      const { error } = await (supabase as any).from("attendance").upsert(rows, { onConflict: "room_id,student_id,session_date,slot" });
      if (error) throw error;
      toast.success(tr(
        `Appel enregistré : ${counts.absent} absent(s), ${counts.late} retard(s).`,
        `تم تسجيل الحضور: ${counts.absent} غائب، ${counts.late} متأخر.`,
        `Attendance saved: ${counts.absent} absent, ${counts.late} late.`
      ));
      await Promise.all([loadDay(), loadHistory()]);
    } catch (e) {
      console.error("attendance save error:", e);
      toast.error(tr("Impossible d'enregistrer l'appel.", "تعذر حفظ الحضور.", "Unable to save attendance."));
    } finally {
      setSaving(false);
    }
  };

  const periodRows = useMemo(() => history.filter((r) => r.session_date >= periodStart), [history, periodStart]);
  const totals = useMemo(() => attendanceTotals(periodRows), [periodRows]);
  const sessionsInPeriod = useMemo(() => new Set(periodRows.map((r) => `${r.session_date}#${r.slot}`)).size, [periodRows]);
  const recentSessions = useMemo(() => {
    const m = new Map<string, { date: string; slot: number; absent: number; late: number }>();
    history.forEach((r) => {
      const k = `${r.session_date}#${r.slot}`;
      const e = m.get(k) || { date: r.session_date, slot: r.slot, absent: 0, late: 0 };
      if (r.status === "absent") e.absent += 1;
      if (r.status === "late") e.late += 1;
      m.set(k, e);
    });
    return [...m.values()].sort((a, b) => (b.date + b.slot).localeCompare(a.date + a.slot)).slice(0, 12);
  }, [history]);

  const exportCsv = () => {
    const header = [tr("Élève", "التلميذ", "Student"), tr("Code Massar", "رمز مسار", "Massar code"), tr("Séances", "الحصص", "Sessions"),
      tr("Absences", "الغيابات", "Absences"), tr("Justifiées", "مبررة", "Excused"), tr("Retards", "التأخرات", "Lates"), tr("Taux de présence", "نسبة الحضور", "Attendance rate")];
    const lines = students.map((s) => {
      const t = totals.get(s.id) || { absent: 0, late: 0, excused: 0, sessions: 0 };
      const rate = t.sessions ? Math.round(((t.sessions - t.absent - t.excused) / t.sessions) * 100) : "";
      return [s.name, s.username || "", t.sessions, t.absent, t.excused, t.late, rate === "" ? "" : `${rate} %`];
    });
    void downloadBlob(toCsv([[`${room?.name || ""} · ${formatDate(periodStart, language)} → ${formatDate(localDay(), language)}`], [], header, ...lines]),
      `presences-${(room?.name || "classe").replace(/[^\w-]+/g, "_")}.csv`);
  };

  if (!roomId) return <Navigate to="/dashboard" replace />;
  if (user?.role !== "professor") return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{tr("Présences", "الحضور والغياب", "Attendance")}</h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          {tr("Tout le monde est présent par défaut : appuyez sur un élève pour le marquer absent, en retard ou justifié.",
            "الجميع حاضر افتراضياً: اضغط على التلميذ لتسجيله غائباً أو متأخراً أو غياباً مبرراً.",
            "Everyone is present by default: tap a student to mark them absent, late or excused.")}
        </p>
      </div>

      {!available ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {tr("L'appel sera disponible après la mise à jour de la base de données (migration 20261029090000).",
            "سيتوفر تسجيل الحضور بعد تحديث قاعدة البيانات.",
            "Attendance will be available after the database update.")}
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="call" className="gap-1.5"><UserCheck className="h-4 w-4" />{tr("Faire l'appel", "تسجيل الحضور", "Take attendance")}</TabsTrigger>
            <TabsTrigger value="summary" className="gap-1.5"><CalendarCheck className="h-4 w-4" />{tr("Récapitulatif", "الحصيلة", "Summary")}</TabsTrigger>
          </TabsList>

          <TabsContent value="call" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
              <div className="grid gap-1.5">
                <Label htmlFor="att-day">{tr("Date", "التاريخ", "Date")}</Label>
                <Input id="att-day" type="date" value={day} max={localDay()} onChange={(e) => e.target.value && setDay(e.target.value)} className="w-44" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="att-slot">{tr("Séance", "الحصة", "Session")}</Label>
                <Select value={slot} onValueChange={setSlot}>
                  <SelectTrigger id="att-slot" className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 8 }, (_, i) => String(i + 1)).map((v) => (
                      <SelectItem key={v} value={v}>{tr(`Séance ${v}`, `الحصة ${v}`, `Session ${v}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
                {STATUSES.map((s) => (
                  <span key={s} className={cn("rounded-full border px-2.5 py-1", statusStyle[s])}>{statusLabel(s)} · {counts[s]}</span>
                ))}
              </div>
              <div className="ms-auto flex gap-2">
                <Button variant="outline" className="gap-1.5" onClick={() => setMarks({})} disabled={saving}>
                  <CheckCheck className="h-4 w-4" />{tr("Tous présents", "الكل حاضر", "All present")}
                </Button>
                <Button className="gap-1.5" onClick={save} disabled={saving || !students.length || !dirty}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {alreadyTaken ? tr("Mettre à jour", "تحديث", "Update") : tr("Enregistrer l'appel", "حفظ الحضور", "Save attendance")}
                </Button>
              </div>
            </div>
            {alreadyTaken && !dirty && (
              <p className="text-xs text-emerald-700 dark:text-emerald-300">{tr("L'appel de cette séance est déjà enregistré.", "تم تسجيل حضور هذه الحصة.", "Attendance for this session is already saved.")}</p>
            )}

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
            ) : students.length === 0 ? (
              <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{tr("Aucun élève dans cette classe.", "لا يوجد تلاميذ في هذا القسم.", "No students in this class.")}</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {students.map((s, i) => {
                  const st = statusOf(s.id);
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => cycle(s.id)}
                        className={cn("flex w-full items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-start transition-colors", st === "present" ? "border-border bg-card hover:bg-muted/40" : statusStyle[st])}
                        aria-label={`${s.name} : ${statusLabel(st)}`}
                      >
                        <span className="w-6 shrink-0 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{s.name}</span>
                          {s.username && <span className="block truncate text-[11px] text-muted-foreground">{s.username}</span>}
                        </span>
                        <span className={cn("flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-sm font-semibold", statusStyle[st])}>
                          {statusLabel(st, true)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="summary" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">{tr("Ce mois-ci", "هذا الشهر", "This month")}</SelectItem>
                  <SelectItem value="trimester">{tr("3 derniers mois", "آخر 3 أشهر", "Last 3 months")}</SelectItem>
                  <SelectItem value="year">{tr("Année scolaire", "السنة الدراسية", "School year")}</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">{tr(`${sessionsInPeriod} séance(s) enregistrée(s)`, `${sessionsInPeriod} حصة مسجلة`, `${sessionsInPeriod} session(s) recorded`)}</span>
              <Button variant="outline" size="sm" className="ms-auto gap-1.5" onClick={exportCsv} disabled={!students.length}>
                <Download className="h-4 w-4" />{tr("Exporter (Excel)", "تصدير (Excel)", "Export (Excel)")}
              </Button>
            </div>
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-start font-medium">{tr("Élève", "التلميذ", "Student")}</th>
                    <th className="px-3 py-2 text-center font-medium">{tr("Absences", "الغيابات", "Absences")}</th>
                    <th className="px-3 py-2 text-center font-medium">{tr("Justifiées", "مبررة", "Excused")}</th>
                    <th className="px-3 py-2 text-center font-medium">{tr("Retards", "التأخرات", "Lates")}</th>
                    <th className="px-3 py-2 text-center font-medium">{tr("Présence", "الحضور", "Attendance")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[...students]
                    .sort((a, b) => (totals.get(b.id)?.absent || 0) - (totals.get(a.id)?.absent || 0) || a.name.localeCompare(b.name))
                    .map((s) => {
                      const t = totals.get(s.id) || { absent: 0, late: 0, excused: 0, sessions: 0 };
                      const rate = t.sessions ? Math.round(((t.sessions - t.absent - t.excused) / t.sessions) * 100) : null;
                      return (
                        <tr key={s.id}>
                          <td className="px-3 py-2 font-medium">{s.name}</td>
                          <td className={cn("px-3 py-2 text-center tabular-nums", t.absent >= 3 && "font-semibold text-rose-600")}>{t.absent}</td>
                          <td className="px-3 py-2 text-center tabular-nums">{t.excused}</td>
                          <td className="px-3 py-2 text-center tabular-nums">{t.late}</td>
                          <td className="px-3 py-2 text-center tabular-nums">{rate === null ? "—" : `${rate} %`}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            {recentSessions.length > 0 && (
              <div className="rounded-xl border bg-card p-4">
                <p className="mb-2 text-sm font-semibold">{tr("Dernières séances", "آخر الحصص", "Recent sessions")}</p>
                <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
                  {recentSessions.map((r) => (
                    <li key={`${r.date}-${r.slot}`}>
                      <button type="button" className="flex w-full items-center justify-between rounded-lg px-2 py-1 hover:bg-muted"
                        onClick={() => { setDay(r.date); setSlot(String(r.slot)); setTab("call"); }}>
                        <span>{formatDate(r.date, language)} · {tr(`séance ${r.slot}`, `الحصة ${r.slot}`, `session ${r.slot}`)}</span>
                        <span className="text-xs text-muted-foreground">{r.absent} {tr("abs.", "غ", "abs.")} · {r.late} {tr("ret.", "م", "late")}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default RoomAttendance;

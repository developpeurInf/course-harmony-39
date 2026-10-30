/**
 * Suivi d'une classe : groupes de besoin, appréciations de bulletin et bilans
 * imprimables pour les parents. Les notes viennent des quiz de la classe
 * (même calcul que « Suivi et classement »), les absences de l'appel.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileText, Layers, Loader2, Printer, RefreshCw, Save, Sparkles, Wand2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { downloadBlob } from "@/lib/download";
import { computeClassAnalytics, type StudentAnalytics } from "@/lib/classAnalytics";
import {
  attendanceTotals, isMissingRelation, loadAttendance, loadRoomResults, loadRoomStudents, localDay, toCsv,
  type AttendanceRow, type RoomResults, type RoomStudent,
} from "@/lib/roomData";
import { buildParentReportHtml, generateAppreciation, openPrintable, type TextLang } from "@/lib/appreciations";

type Group = "consolidate" | "progress" | "mastered";
type Term = "S1" | "S2" | "AN";

/** Bornes d'une période de l'année scolaire en cours */
function termRange(term: Term, now = new Date()) {
  const y0 = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  if (term === "S1") return { from: `${y0}-09-01`, to: `${y0 + 1}-01-31` };
  if (term === "S2") return { from: `${y0 + 1}-02-01`, to: `${y0 + 1}-07-15` };
  return { from: `${y0}-09-01`, to: `${y0 + 1}-07-15` };
}

const RoomFollowUp = () => {
  const { roomId } = useParams();
  const { user } = useAuth();
  const { rooms } = useCourses();
  const { language } = useLanguage();
  const { prefs } = usePreferences();
  const { can } = useAccess();
  const tr = useCallback((fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en), [language]);
  const room = rooms.find((r) => r.id === roomId);
  const opts = useMemo(() => ({
    passThreshold: prefs.passThreshold,
    levelStruggling: prefs.levelStruggling,
    levelGood: prefs.levelGood,
    levelExcellent: prefs.levelExcellent,
    attemptPolicy: prefs.attemptPolicy,
    inactivityDays: prefs.inactivityDays,
  }), [prefs.passThreshold, prefs.levelStruggling, prefs.levelGood, prefs.levelExcellent, prefs.attemptPolicy, prefs.inactivityDays]);

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<RoomStudent[]>([]);
  const [results, setResults] = useState<RoomResults | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [dbReady, setDbReady] = useState(true);
  const [term, setTerm] = useState<Term>(() => (new Date().getMonth() >= 1 && new Date().getMonth() <= 7 ? "S2" : "S1"));
  const [textLang, setTextLang] = useState<TextLang>(language === "ar" ? "ar" : "fr");

  const load = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      const [st, res] = await Promise.all([loadRoomStudents(roomId), loadRoomResults(roomId)]);
      setStudents(st);
      setResults(res);
      try {
        setAttendance(await loadAttendance(roomId, termRange("AN").from));
        setDbReady(true);
      } catch (e) {
        if (isMissingRelation(e)) setDbReady(false);
      }
    } catch (e) {
      console.error("follow-up load error:", e);
      toast.error(tr("Erreur de chargement des données", "خطأ في تحميل البيانات", "Failed to load data"));
    } finally {
      setLoading(false);
    }
  }, [roomId, tr]);

  useEffect(() => {
    void load();
  }, [load]);

  const range = termRange(term);
  const analytics = useMemo(() => {
    if (!results) return null;
    const quizzes = results.quizzes.filter((q) => {
      const d = localDay(new Date(q.date));
      return d >= range.from && d <= range.to;
    });
    return computeClassAnalytics({ students, quizzes, submissions: results.submissions, questions: results.questions, answers: [], sessions: results.sessions, options: opts });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, students, opts, term]);
  const byStudent = useMemo(() => new Map((analytics?.students || []).map((s) => [s.student.id, s] as [string, StudentAnalytics])), [analytics]);
  const att = useMemo(
    () => attendanceTotals(attendance.filter((r) => r.session_date >= range.from && r.session_date <= range.to)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attendance, term]
  );
  const num = (v: number | null) => (v === null ? "—" : String(Math.round(v * 100) / 100).replace(".", language === "en" ? "." : ","));
  const termLabel = (t: Term) => (t === "S1" ? tr("1er semestre", "الدورة الأولى", "Semester 1") : t === "S2" ? tr("2e semestre", "الدورة الثانية", "Semester 2") : tr("Année scolaire", "السنة الدراسية", "School year"));

  /* ───────────── Groupes de besoin ───────────── */
  const autoGroup = useCallback((id: string): Group | null => {
    const n = byStudent.get(id)?.note20 ?? null;
    if (n === null) return null;
    if (n < opts.passThreshold) return "consolidate";
    if (n < opts.levelGood) return "progress";
    return "mastered";
  }, [byStudent, opts]);
  const [savedGroups, setSavedGroups] = useState<Record<string, Group>>({});
  const [groups, setGroups] = useState<Record<string, Group>>({});
  const [savingGroups, setSavingGroups] = useState(false);

  useEffect(() => {
    if (!roomId) return;
    (supabase as any).from("student_need_groups").select("student_id, grp").eq("room_id", roomId).then(({ data, error }: any) => {
      if (error) {
        if (isMissingRelation(error)) setDbReady(false);
        return;
      }
      const m: Record<string, Group> = {};
      (data || []).forEach((r: any) => (m[r.student_id] = r.grp));
      setSavedGroups(m);
      setGroups(m);
    });
  }, [roomId]);

  const groupOf = (id: string): Group | null => groups[id] || autoGroup(id);
  const recompute = () => {
    setGroups({});
    toast.message(tr("Groupes recalculés à partir des notes. Pensez à enregistrer.", "أعيد حساب المجموعات انطلاقاً من النقط. لا تنس الحفظ.", "Groups recomputed from grades. Remember to save."));
  };
  const saveGroups = async () => {
    if (!roomId || savingGroups) return;
    if (!accessStore.guard("student.groups")) return;
    setSavingGroups(true);
    try {
      const rows = students.map((s) => ({ room_id: roomId, student_id: s.id, grp: groupOf(s.id) })).filter((r) => r.grp);
      const { error } = await (supabase as any).from("student_need_groups").upsert(
        rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })),
        { onConflict: "room_id,student_id" }
      );
      if (error) throw error;
      const m: Record<string, Group> = {};
      rows.forEach((r) => (m[r.student_id] = r.grp as Group));
      setSavedGroups(m);
      setGroups(m);
      toast.success(tr("Groupes enregistrés.", "تم حفظ المجموعات.", "Groups saved."));
    } catch (e) {
      console.error(e);
      toast.error(tr("Impossible d'enregistrer les groupes.", "تعذر حفظ المجموعات.", "Unable to save groups."));
    } finally {
      setSavingGroups(false);
    }
  };
  const groupsDirty = students.some((s) => (groupOf(s.id) || null) !== (savedGroups[s.id] || null));
  const GROUPS: { id: Group; label: string; hint: string; cls: string }[] = [
    { id: "consolidate", label: tr("À consolider", "للدعم", "To consolidate"), hint: tr(`moyenne < ${opts.passThreshold}/20`, `المعدل < ${opts.passThreshold}/20`, `average < ${opts.passThreshold}/20`), cls: "border-rose-300 dark:border-rose-900" },
    { id: "progress", label: tr("En cours d'acquisition", "في طور الاكتساب", "In progress"), hint: `${opts.passThreshold} – ${opts.levelGood}/20`, cls: "border-amber-300 dark:border-amber-900" },
    { id: "mastered", label: tr("Maîtrisé", "متمكن", "Mastered"), hint: `≥ ${opts.levelGood}/20`, cls: "border-emerald-300 dark:border-emerald-900" },
  ];
  const exportGroups = () => {
    const lines = students.map((s) => [s.name, s.username || "", num(byStudent.get(s.id)?.note20 ?? null), GROUPS.find((g) => g.id === groupOf(s.id))?.label || tr("Non évalué", "غير مقوَّم", "Not assessed")]);
    void downloadBlob(toCsv([[`${room?.name || ""} · ${termLabel(term)}`], [], [tr("Élève", "التلميذ", "Student"), tr("Code Massar", "رمز مسار", "Massar code"), tr("Moyenne /20", "المعدل /20", "Average /20"), tr("Groupe", "المجموعة", "Group")], ...lines]),
      `groupes-${(room?.name || "classe").replace(/[^\w-]+/g, "_")}.csv`);
  };

  /* ───────────── Appréciations ───────────── */
  const [apprSaved, setApprSaved] = useState<Record<string, string>>({});
  const [appr, setAppr] = useState<Record<string, string>>({});
  const [savingAppr, setSavingAppr] = useState(false);
  useEffect(() => {
    if (!roomId) return;
    (supabase as any).from("student_appreciations").select("student_id, text").eq("room_id", roomId).eq("term", term).then(({ data, error }: any) => {
      if (error) return;
      const m: Record<string, string> = {};
      (data || []).forEach((r: any) => (m[r.student_id] = r.text));
      setApprSaved(m);
      setAppr(m);
    });
  }, [roomId, term]);
  const suggestion = useCallback((id: string) => {
    const a = byStudent.get(id);
    const t = att.get(id);
    return generateAppreciation({
      note20: a?.note20 ?? null,
      trend: a?.trend || "na",
      participation: a?.participation ?? 100,
      absences: t?.absent || 0,
      lates: t?.late || 0,
    }, textLang, opts);
  }, [byStudent, att, textLang, opts]);
  const apprText = (id: string) => (id in appr ? appr[id] : suggestion(id));
  const regenerateAll = () => {
    const m: Record<string, string> = {};
    students.forEach((s) => (m[s.id] = suggestion(s.id)));
    setAppr(m);
  };
  const saveAppr = async () => {
    if (!roomId || savingAppr) return;
    if (!accessStore.guard("student.appreciations")) return;
    setSavingAppr(true);
    try {
      const rows = students.map((s) => ({ room_id: roomId, student_id: s.id, term, text: apprText(s.id).trim(), updated_at: new Date().toISOString() })).filter((r) => r.text);
      const { error } = await (supabase as any).from("student_appreciations").upsert(rows, { onConflict: "room_id,student_id,term" });
      if (error) throw error;
      const m: Record<string, string> = {};
      rows.forEach((r) => (m[r.student_id] = r.text));
      setApprSaved(m);
      setAppr(m);
      toast.success(tr("Appréciations enregistrées.", "تم حفظ الملاحظات.", "Comments saved."));
    } catch (e) {
      console.error(e);
      toast.error(tr("Impossible d'enregistrer les appréciations.", "تعذر حفظ الملاحظات.", "Unable to save comments."));
    } finally {
      setSavingAppr(false);
    }
  };
  const exportAppr = () => {
    const lines = students.map((s) => [s.name, s.username || "", num(byStudent.get(s.id)?.note20 ?? null), att.get(s.id)?.absent || 0, apprText(s.id)]);
    void downloadBlob(toCsv([[`${room?.name || ""} · ${termLabel(term)}`], [], [tr("Élève", "التلميذ", "Student"), tr("Code Massar", "رمز مسار", "Massar code"), tr("Moyenne /20", "المعدل /20", "Average /20"), tr("Absences", "الغيابات", "Absences"), tr("Appréciation", "الملاحظة", "Comment")], ...lines]),
      `appreciations-${term}-${(room?.name || "classe").replace(/[^\w-]+/g, "_")}.csv`);
  };

  /* ───────────── Bilans parents ───────────── */
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const printReports = (ids: string[]) => {
    if (!accessStore.guard("reports.parent_report")) return;
    if (!ids.length) return;
    const html = buildParentReportHtml({
      lang: textLang,
      className: room?.name || "",
      teacherName: user?.name || "",
      periodLabel: textLang === "ar"
        ? (term === "S1" ? "الدورة الأولى" : term === "S2" ? "الدورة الثانية" : "السنة الدراسية")
        : (term === "S1" ? "1er semestre" : term === "S2" ? "2e semestre" : "Année scolaire"),
      students: ids.map((id) => {
        const s = students.find((x) => x.id === id) as RoomStudent;
        const a = byStudent.get(id);
        const t = att.get(id);
        return {
          name: s?.name || "",
          massar: s?.username,
          note20: a?.note20 ?? null,
          rank: a?.rank ?? null,
          classSize: analytics?.evaluatedCount || students.length,
          results: (a?.results || []).map((r) => ({ title: r.quiz.title, date: r.quiz.date, note20: r.pct / 5 })),
          absences: t?.absent || 0,
          excused: t?.excused || 0,
          lates: t?.late || 0,
          appreciation: apprText(id),
        };
      }),
    });
    if (!openPrintable(html)) {
      toast.error(tr("Autorisez les fenêtres surgissantes pour imprimer les bilans.", "اسمح بالنوافذ المنبثقة لطباعة الحصائل.", "Allow pop-ups to print the reports."));
    }
  };

  if (!roomId) return <Navigate to="/dashboard" replace />;
  if (user?.role !== "professor") return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{tr("Groupes, appréciations et bilans", "المجموعات والملاحظات والحصائل", "Groups, comments and reports")}</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {tr("Calculés à partir des quiz de la classe et de l'appel. Tout reste modifiable avant l'enregistrement.",
              "محسوبة انطلاقاً من اختبارات القسم والحضور. كل شيء قابل للتعديل قبل الحفظ.",
              "Computed from the class quizzes and attendance. Everything can be edited before saving.")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={term} onValueChange={(v) => setTerm(v as Term)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["S1", "S2", "AN"] as Term[]).map((t) => <SelectItem key={t} value={t}>{termLabel(t)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={() => void load()} aria-label={tr("Actualiser", "تحديث", "Refresh")} title={tr("Actualiser", "تحديث", "Refresh")}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {!dbReady && (
        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          {tr("L'enregistrement des groupes, appréciations et présences sera disponible après la mise à jour de la base de données (migration 20261029090000).",
            "سيتوفر حفظ المجموعات والملاحظات والحضور بعد تحديث قاعدة البيانات.",
            "Saving groups, comments and attendance will be available after the database update.")}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <Tabs defaultValue="groups">
          <TabsList className="flex h-auto w-full flex-wrap sm:w-auto">
            <TabsTrigger value="groups" className="gap-1.5"><Layers className="h-4 w-4" />{tr("Groupes de besoin", "مجموعات الحاجة", "Need groups")}</TabsTrigger>
            <TabsTrigger value="appr" className="gap-1.5"><Sparkles className="h-4 w-4" />{tr("Appréciations", "الملاحظات", "Comments")}</TabsTrigger>
            <TabsTrigger value="reports" className="gap-1.5"><FileText className="h-4 w-4" />{tr("Bilans parents", "حصائل الآباء", "Parent reports")}</TabsTrigger>
          </TabsList>

          {/* ═════ Groupes ═════ */}
          <TabsContent value="groups" className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-1.5" onClick={recompute}><Wand2 className="h-4 w-4" />{tr("Recalculer depuis les notes", "إعادة الحساب من النقط", "Recompute from grades")}</Button>
              <Button variant="outline" className="gap-1.5" onClick={exportGroups}><Download className="h-4 w-4" />{tr("Exporter", "تصدير", "Export")}</Button>
              <Button className="gap-1.5" onClick={saveGroups} disabled={savingGroups || !groupsDirty || !can("student.groups")}>
                {savingGroups ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{tr("Enregistrer les groupes", "حفظ المجموعات", "Save groups")}
              </Button>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {GROUPS.map((g) => {
                const members = students.filter((s) => groupOf(s.id) === g.id);
                return (
                  <section key={g.id} className={cn("rounded-xl border-2 bg-card p-3", g.cls)}>
                    <header className="mb-2 flex items-baseline justify-between gap-2">
                      <h2 className="font-semibold">{g.label} <span className="text-sm text-muted-foreground">· {members.length}</span></h2>
                      <span className="text-[11px] text-muted-foreground">{g.hint}</span>
                    </header>
                    <ul className="space-y-1.5">
                      {members.map((s) => (
                        <li key={s.id} className="flex items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5 text-sm">
                          <span className="min-w-0 flex-1 truncate">{s.name}</span>
                          <span className="text-xs tabular-nums text-muted-foreground" dir="ltr">{num(byStudent.get(s.id)?.note20 ?? null)}</span>
                          <Select value={g.id} onValueChange={(v) => setGroups((m) => ({ ...m, [s.id]: v as Group }))}>
                            <SelectTrigger className="h-7 w-8 px-1.5 [&>span]:hidden" aria-label={tr(`Changer le groupe de ${s.name}`, `تغيير مجموعة ${s.name}`, `Move ${s.name}`)} />
                            <SelectContent>
                              {GROUPS.map((x) => <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </li>
                      ))}
                      {members.length === 0 && <li className="py-3 text-center text-xs text-muted-foreground">{tr("Aucun élève", "لا يوجد تلاميذ", "No students")}</li>}
                    </ul>
                  </section>
                );
              })}
            </div>
            {students.some((s) => !groupOf(s.id)) && (
              <div className="rounded-xl border bg-card p-3">
                <p className="mb-2 text-sm font-semibold">{tr("Pas encore évalués", "لم يُقوَّموا بعد", "Not assessed yet")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {students.filter((s) => !groupOf(s.id)).map((s) => (
                    <Select key={s.id} onValueChange={(v) => setGroups((m) => ({ ...m, [s.id]: v as Group }))}>
                      <SelectTrigger className="h-8 w-auto gap-1 rounded-full text-xs"><span>{s.name}</span></SelectTrigger>
                      <SelectContent>
                        {GROUPS.map((x) => <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ═════ Appréciations ═════ */}
          <TabsContent value="appr" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-sm">{tr("Langue des textes", "لغة النصوص", "Text language")}</Label>
              <Select value={textLang} onValueChange={(v) => setTextLang(v as TextLang)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="gap-1.5" onClick={regenerateAll}><Wand2 className="h-4 w-4" />{tr("Tout régénérer", "إعادة توليد الكل", "Regenerate all")}</Button>
              <Button variant="outline" className="gap-1.5" onClick={exportAppr}><Download className="h-4 w-4" />{tr("Exporter", "تصدير", "Export")}</Button>
              <Button className="gap-1.5" onClick={saveAppr} disabled={savingAppr || !can("student.appreciations")}>
                {savingAppr ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{tr("Enregistrer", "حفظ", "Save")}
              </Button>
            </div>
            <ul className="space-y-2">
              {students.map((s) => {
                const a = byStudent.get(s.id);
                const t = att.get(s.id);
                const savedText = apprSaved[s.id];
                return (
                  <li key={s.id} className="rounded-xl border bg-card p-3">
                    <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-xs text-muted-foreground" dir="ltr">{num(a?.note20 ?? null)}/20</span>
                      {a?.trend === "up" && <span className="text-xs text-emerald-600">↗ {tr("en progrès", "في تحسن", "improving")}</span>}
                      {a?.trend === "down" && <span className="text-xs text-rose-600">↘ {tr("en baisse", "في تراجع", "declining")}</span>}
                      {(t?.absent || 0) > 0 && <span className="text-xs text-muted-foreground">{t?.absent} {tr("abs.", "غياب", "abs.")}</span>}
                      {savedText !== undefined && apprText(s.id) === savedText && <span className="ms-auto text-[11px] text-emerald-600">{tr("enregistrée", "محفوظة", "saved")}</span>}
                    </div>
                    <div className="flex gap-2">
                      <Textarea
                        dir={textLang === "ar" ? "rtl" : "ltr"}
                        value={apprText(s.id)}
                        onChange={(e) => setAppr((m) => ({ ...m, [s.id]: e.target.value }))}
                        rows={2}
                        className="text-sm"
                      />
                      <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setAppr((m) => ({ ...m, [s.id]: suggestion(s.id) }))}
                        title={tr("Régénérer", "إعادة التوليد", "Regenerate")} aria-label={tr("Régénérer", "إعادة التوليد", "Regenerate")}>
                        <Wand2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </TabsContent>

          {/* ═════ Bilans parents ═════ */}
          <TabsContent value="reports" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-sm">{tr("Langue du bilan", "لغة الحصيلة", "Report language")}</Label>
              <Select value={textLang} onValueChange={(v) => setTextLang(v as TextLang)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                </SelectContent>
              </Select>
              <Button className="gap-1.5" onClick={() => printReports(students.map((s) => s.id))} disabled={!students.length || !can("reports.parent_report")}>
                <Printer className="h-4 w-4" />{tr(`Imprimer toute la classe (${students.length})`, `طباعة القسم كاملاً (${students.length})`, `Print the whole class (${students.length})`)}
              </Button>
              <Button variant="outline" className="gap-1.5" onClick={() => printReports([...picked])} disabled={!picked.size || !can("reports.parent_report")}>
                <Printer className="h-4 w-4" />{tr(`Imprimer la sélection (${picked.size})`, `طباعة المحدد (${picked.size})`, `Print selection (${picked.size})`)}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {tr("Une page A4 par élève : moyenne, rang, notes, absences et appréciation. Dans la fenêtre d'impression, choisissez « Enregistrer en PDF » pour l'envoyer par WhatsApp.",
                "صفحة A4 لكل تلميذ: المعدل والرتبة والنقط والغيابات والملاحظة. في نافذة الطباعة اختر « حفظ كـ PDF » لإرسالها عبر واتساب.",
                "One A4 page per student: average, rank, grades, absences and comment. In the print window, choose “Save as PDF” to send it via WhatsApp.")}
            </p>
            <ul className="divide-y rounded-xl border bg-card">
              {students.map((s) => {
                const a = byStudent.get(s.id);
                return (
                  <li key={s.id} className="flex items-center gap-3 px-3 py-2">
                    <Checkbox
                      checked={picked.has(s.id)}
                      onCheckedChange={(v) => setPicked((p) => { const n = new Set(p); if (v) n.add(s.id); else n.delete(s.id); return n; })}
                      aria-label={s.name}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</span>
                    <span className="text-xs tabular-nums text-muted-foreground" dir="ltr">{num(a?.note20 ?? null)}/20 · {a?.rank ? `#${a.rank}` : "—"}</span>
                    <Button variant="ghost" size="sm" className="gap-1" onClick={() => printReports([s.id])} disabled={!can("reports.parent_report")}>
                      <Printer className="h-3.5 w-3.5" />{tr("Bilan", "الحصيلة", "Report")}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default RoomFollowUp;

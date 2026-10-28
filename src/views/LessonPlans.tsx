/**
 * Fiches pédagogiques (جذاذات) rédigées avec l'IA : sujet, niveau, durée, document du cours
 * éventuel → déroulement complet modifiable, impression A4, enregistrement.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Eye, FileText, Loader2, Pencil, Plus, Printer, Save, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "@/lib/router";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses } from "@/contexts/CourseContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { accessStore } from "@/contexts/AccessContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getReportBranding } from "@/lib/reportBranding";
import { loadKatex } from "@/lib/mathRender";
import { buildLessonPlanHtml, readPlanHeader } from "@/lib/lessonPlanPrint";
import { openPrintable } from "@/lib/appreciations";
import { aiErrorMessage, callTeacherAi, loadAiMaterials, type LessonPlan } from "@/lib/teacherAi";
import type { CourseMaterialLike } from "@/lib/courseMedia";

interface Saved { id: string; title: string; level: string | null; language: string; content: LessonPlan; created_at: string }

const LABELS = {
  fr: { title: "Fiche pédagogique", level: "Niveau", duration: "Durée", competencies: "Compétences visées", objectives: "Objectifs", prerequisites: "Prérequis", materials: "Supports didactiques", steps: "Déroulement", phase: "Étape", time: "Durée", teacher: "Activités du professeur", students: "Activités des élèves", evaluation: "Évaluation", assessment: "Évaluation finale", homework: "Travail à la maison", remediation: "Remédiation / soutien" },
  ar: { title: "جذاذة", level: "المستوى", duration: "المدة", competencies: "الكفايات المستهدفة", objectives: "الأهداف", prerequisites: "المكتسبات القبلية", materials: "الوسائل الديداكتيكية", steps: "سير الحصة", phase: "المرحلة", time: "المدة", teacher: "أنشطة الأستاذ", students: "أنشطة المتعلمين", evaluation: "التقويم", assessment: "التقويم الختامي", homework: "الواجب المنزلي", remediation: "الدعم والمعالجة" },
};

type Tr = (fr: string, ar: string, en: string) => string;

/** Barre d'avancement et étapes de la rédaction (durée estimée : ~40 s, ~60 s avec un document). */
function GenerationProgress({ elapsed, finishing, withDocument, tr }: { elapsed: number; finishing: boolean; withDocument: boolean; tr: Tr }) {
  const expected = withDocument ? 60 : 40;
  const pct = finishing ? 100 : Math.min(95, Math.round(95 * (1 - Math.exp((-2.3 * elapsed) / expected))));
  const stages = [
    { at: 0, label: tr("Envoi de la demande", "إرسال الطلب", "Sending the request") },
    ...(withDocument ? [{ at: 8, label: tr("Lecture du document du cours", "قراءة وثيقة الدرس", "Reading the course document") }] : []),
    { at: withDocument ? 22 : 10, label: tr("Compétences, objectifs et prérequis", "الكفايات والأهداف والمكتسبات القبلية", "Competencies, objectives and prerequisites") },
    { at: 40, label: tr("Déroulement de la séance (étapes)", "سير الحصة (المراحل)", "Lesson steps") },
    { at: 72, label: tr("Évaluation, devoirs et remédiation", "التقويم والواجب والدعم", "Assessment, homework and remediation") },
    { at: 100, label: tr("Mise en page de la fiche", "إخراج الجذاذة", "Laying out the plan") },
  ];
  const current = stages.reduce((acc, s, i) => (pct >= s.at ? i : acc), 0);
  const secs = Math.floor(elapsed);
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 py-12">
      <div className="flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4 text-violet-500" />{tr("Rédaction de la fiche", "كتابة الجذاذة", "Drafting the plan")}</div>
      <div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div className="h-full rounded-full bg-violet-500 transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>{pct} %</span>
          <span>{secs} s{!finishing && elapsed > expected ? ` · ${tr("encore un instant…", "لحظة من فضلك…", "almost there…")}` : ""}</span>
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        {stages.map((s, i) => (
          <li key={i} className={cn("flex items-center gap-2", i > current && "text-muted-foreground/60")}>
            {i < current ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : i === current ? (
              <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
            ) : (
              <span className="inline-block h-4 w-4 rounded-full border" />
            )}
            {s.label}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{tr("L'avancement est estimé : l'IA renvoie la fiche complète en une fois. La fiche mise en page s'affichera ici.", "التقدم تقديري: يرسل الذكاء الاصطناعي الجذاذة كاملة دفعة واحدة. ستظهر الجذاذة هنا.", "Progress is estimated: the AI returns the whole plan at once. The laid-out plan will appear here.")}</p>
    </div>
  );
}

const LessonPlans = () => {
  const { user } = useAuth();
  const { courses } = useCourses();
  const { language } = useLanguage();
  const tr = useCallback((fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en), [language]);

  const [planLang, setPlanLang] = useState<"ar" | "fr">(language === "ar" ? "ar" : "fr");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("");
  const [duration, setDuration] = useState(55);
  const [notes, setNotes] = useState("");
  const [materials, setMaterials] = useState<(CourseMaterialLike & { course_id: string })[]>([]);
  const [materialId, setMaterialId] = useState("none");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  // Avancement affiché pendant la rédaction (estimé d'après le temps écoulé : l'IA répond en une fois)
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [finishing, setFinishing] = useState(false);
  useEffect(() => {
    if (!startedAt) return;
    const id = window.setInterval(() => setElapsed((Date.now() - startedAt) / 1000), 250);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const myCourses = useMemo(() => courses.filter((c) => c.professor_id === user?.id), [courses, user?.id]);
  useEffect(() => {
    void loadAiMaterials(myCourses.map((c) => c.id)).then(setMaterials);
  }, [myCourses]);

  const loadSaved = useCallback(async () => {
    const { data, error } = await (supabase as any).from("lesson_plans").select("id, title, level, language, content, created_at").order("created_at", { ascending: false }).limit(200);
    if (error) {
      setMissing(true);
      return;
    }
    setSaved(data || []);
  }, []);
  useEffect(() => {
    void loadSaved();
  }, [loadSaved]);

  const generate = async () => {
    if (busy) return;
    if (!accessStore.guard("ai.lesson_plan")) return;
    setBusy(true);
    setFinishing(false);
    setElapsed(0);
    setStartedAt(Date.now());
    try {
      const r = await callTeacherAi<{ plan: LessonPlan }>({
        action: "lesson_plan", language: planLang, topic, level, duration, notes,
        material_id: materialId === "none" ? undefined : materialId,
      });
      setFinishing(true);
      const html = await planHtml(r.plan, false);
      setPlan(r.plan);
      setPreview(html || null);
      setPlanId(null);
      toast.success(tr("Fiche prête.", "الجذاذة جاهزة.", "Plan ready."));
    } catch (e: any) {
      toast.error(aiErrorMessage(String(e?.message || ""), tr));
    } finally {
      setBusy(false);
      setStartedAt(null);
    }
  };

  const save = async () => {
    if (!plan || saving) return;
    if (!accessStore.guard("ai.lesson_plan")) return;
    setSaving(true);
    const row = { title: plan.title || topic || "—", level: plan.level || level || null, language: planLang, content: plan, updated_at: new Date().toISOString() };
    const res = planId
      ? await (supabase as any).from("lesson_plans").update(row).eq("id", planId).select("id").single()
      : await (supabase as any).from("lesson_plans").insert(row).select("id").single();
    setSaving(false);
    if (res.error) {
      toast.error(tr("Enregistrement impossible.", "تعذر الحفظ.", "Unable to save."));
      return;
    }
    setPlanId(res.data.id);
    toast.success(tr("Fiche enregistrée.", "تم حفظ الجذاذة.", "Plan saved."));
    void loadSaved();
  };

  const remove = async (id: string) => {
    if (!accessStore.guard("ai.lesson_plan")) return;
    const { error } = await (supabase as any).from("lesson_plans").delete().eq("id", id);
    if (error) return;
    setSaved((l) => l.filter((x) => x.id !== id));
    if (planId === id) {
      setPlan(null);
      setPlanId(null);
    }
  };

  const L = LABELS[planLang];
  const set = <K extends keyof LessonPlan>(k: K, v: LessonPlan[K]) => setPlan((p) => (p ? { ...p, [k]: v } : p));
  const listField = (k: "competencies" | "objectives" | "prerequisites" | "materials") => (
    <div className="space-y-1">
      <Label className="text-xs font-semibold">{L[k]}</Label>
      <Textarea rows={Math.max(2, plan?.[k].length || 2)} value={(plan?.[k] || []).join("\n")} onChange={(e) => set(k, e.target.value.split("\n"))} className="text-sm" />
    </div>
  );

  const planHtml = async (p: LessonPlan | null, autoPrint: boolean) => {
    if (!p) return "";
    const katex = await loadKatex().catch(() => null);
    return buildLessonPlanHtml({ plan: p, lang: planLang, branding: getReportBranding(planLang), header: readPlanHeader(user?.name || ""), katex, autoPrint });
  };

  const print = async () => {
    const html = await planHtml(plan, true);
    if (html && !openPrintable(html)) toast.error(tr("Autorisez les fenêtres pop-up pour imprimer.", "اسمح بالنوافذ المنبثقة للطباعة.", "Allow pop-ups to print."));
  };

  const togglePreview = async () => {
    if (preview) return setPreview(null);
    setPreview(await planHtml(plan, false));
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><FileText className="h-6 w-6 text-muted-foreground" />{tr("Fiches pédagogiques", "الجذاذات", "Lesson plans")}</h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          {tr("L'IA rédige une première version de la fiche (compétences, objectifs, déroulement). Vous la corrigez, l'imprimez et l'enregistrez.",
            "يكتب الذكاء الاصطناعي نسخة أولى من الجذاذة (الكفايات، الأهداف، سير الحصة). تصححها ثم تطبعها وتحفظها.",
            "The AI drafts the plan (competencies, objectives, steps). You edit, print and save it.")}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
        <aside className="space-y-4">
          <section className="space-y-3 rounded-xl border bg-card p-4">
            <div className="space-y-1.5"><Label>{tr("Sujet de la leçon", "موضوع الدرس", "Lesson topic")}</Label><Input value={topic} onChange={(e) => setTopic(e.target.value)} dir="auto" placeholder={tr("ex. Théorème de Pythagore", "مثلاً: مبرهنة فيثاغورس", "e.g. Pythagorean theorem")} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>{tr("Niveau", "المستوى", "Level")}</Label><Input value={level} onChange={(e) => setLevel(e.target.value)} dir="auto" /></div>
              <div className="space-y-1.5"><Label>{tr("Durée (min)", "المدة (د)", "Duration (min)")}</Label><Input type="number" min={15} max={240} value={duration} onChange={(e) => setDuration(Math.min(240, Math.max(15, Number(e.target.value) || 55)))} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>{tr("Langue de la fiche", "لغة الجذاذة", "Plan language")}</Label>
              <Select value={planLang} onValueChange={(v) => setPlanLang(v as "ar" | "fr")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ar">العربية</SelectItem><SelectItem value="fr">Français</SelectItem></SelectContent>
              </Select>
            </div>
            {materials.length > 0 && (
              <div className="space-y-1.5">
                <Label>{tr("Document du cours (facultatif)", "وثيقة الدرس (اختياري)", "Course document (optional)")}</Label>
                <Select value={materialId} onValueChange={setMaterialId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {materials.map((m) => <SelectItem key={m.id} value={m.id}>{myCourses.find((c) => c.id === m.course_id)?.title} · {m.file_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5"><Label>{tr("Précisions (facultatif)", "توضيحات (اختياري)", "Notes (optional)")}</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} dir="auto" placeholder={tr("travail en groupes, classe de 40 élèves…", "عمل في مجموعات، قسم من 40 تلميذاً…", "group work, 40 students…")} /></div>
            <Button className="w-full gap-1.5" onClick={() => void generate()} disabled={busy || (!topic.trim() && materialId === "none")}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{tr("Rédiger la fiche", "كتابة الجذاذة", "Draft the plan")}
            </Button>
          </section>

          <section className="rounded-xl border bg-card p-3">
            <h2 className="mb-2 text-sm font-semibold">{tr("Fiches enregistrées", "الجذاذات المحفوظة", "Saved plans")}</h2>
            {missing ? (
              <p className="text-xs text-muted-foreground">{tr("Disponible après la mise à jour de la base de données (migration 20261031090000).", "متاح بعد تحديث قاعدة البيانات.", "Available after the database update.")}</p>
            ) : saved.length === 0 ? (
              <p className="text-xs text-muted-foreground">{tr("Aucune fiche.", "لا توجد جذاذات.", "No plans.")}</p>
            ) : (
              <ul className="space-y-1">
                {saved.map((s) => (
                  <li key={s.id} className={cn("flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm hover:bg-muted", planId === s.id && "bg-muted")}>
                    <button type="button" className="min-w-0 flex-1 truncate text-start" onClick={() => { setPlan(s.content); setPreview(null); setPlanId(s.id); setPlanLang(s.language === "ar" ? "ar" : "fr"); }}>
                      {s.title}{s.level ? <span className="text-xs text-muted-foreground"> · {s.level}</span> : null}
                    </button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600" onClick={() => void remove(s.id)} aria-label={tr("Supprimer", "حذف", "Delete")}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        <section className="min-w-0 rounded-xl border bg-card p-4" dir={planLang === "ar" ? "rtl" : "ltr"}>
          {busy ? (
            <GenerationProgress elapsed={elapsed} finishing={finishing} withDocument={materialId !== "none"} tr={tr} />
          ) : !plan ? (
            <div className="flex flex-col items-center gap-2 py-20 text-center text-sm text-muted-foreground"><Plus className="h-8 w-8" />{tr("Remplissez le sujet et cliquez sur « Rédiger la fiche ».", "أدخل الموضوع واضغط « كتابة الجذاذة ».", "Enter a topic and click “Draft the plan”.")}</div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Input value={plan.title} onChange={(e) => set("title", e.target.value)} className="min-w-[12rem] flex-1 text-lg font-semibold" />
                <Button variant="outline" className="gap-1.5" onClick={() => void togglePreview()}>{preview ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{preview ? tr("Modifier", "تعديل", "Edit") : tr("Aperçu", "معاينة", "Preview")}</Button>
                <Button variant="outline" className="gap-1.5" onClick={() => void print()}><Printer className="h-4 w-4" />{tr("Imprimer / PDF", "طباعة / PDF", "Print / PDF")}</Button>
                <Button className="gap-1.5" onClick={() => void save()} disabled={saving || missing}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{tr("Enregistrer", "حفظ", "Save")}</Button>
              </div>
              {preview ? (
                <iframe title={tr("Aperçu de la fiche", "معاينة الجذاذة", "Plan preview")} srcDoc={preview} className="h-[80vh] w-full rounded-lg border bg-slate-200" />
              ) : (
                <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs font-semibold">{L.level}</Label><Input value={plan.level} onChange={(e) => set("level", e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs font-semibold">{L.duration}</Label><Input value={plan.duration} onChange={(e) => set("duration", e.target.value)} /></div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {listField("competencies")}
                {listField("objectives")}
                {listField("prerequisites")}
                {listField("materials")}
              </div>
              <div>
                <Label className="text-xs font-semibold">{L.steps}</Label>
                <div className="mt-1 space-y-2">
                  {plan.steps.map((s, i) => (
                    <div key={i} className="rounded-lg border p-2">
                      <div className="mb-1.5 flex gap-2">
                        <Input value={s.phase} onChange={(e) => set("steps", plan.steps.map((x, k) => (k === i ? { ...x, phase: e.target.value } : x)))} className="h-8 flex-1 font-semibold" />
                        <Input value={s.duration} onChange={(e) => set("steps", plan.steps.map((x, k) => (k === i ? { ...x, duration: e.target.value } : x)))} className="h-8 w-24" />
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => set("steps", plan.steps.filter((_, k) => k !== i))} aria-label={tr("Supprimer l'étape", "حذف المرحلة", "Delete step")}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                      <div className="grid gap-2 md:grid-cols-3">
                        {(["teacher", "students", "evaluation"] as const).map((f) => (
                          <div key={f} className="space-y-0.5">
                            <span className="text-[11px] text-muted-foreground">{L[f]}</span>
                            <Textarea rows={3} value={s[f]} onChange={(e) => set("steps", plan.steps.map((x, k) => (k === i ? { ...x, [f]: e.target.value } : x)))} className="text-sm" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => set("steps", [...plan.steps, { phase: "", duration: "", teacher: "", students: "", evaluation: "" }])}><Plus className="h-3.5 w-3.5" />{tr("Étape", "مرحلة", "Step")}</Button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {(["assessment", "homework", "remediation"] as const).map((k) => (
                  <div key={k} className="space-y-1"><Label className="text-xs font-semibold">{L[k]}</Label><Textarea rows={3} value={plan[k]} onChange={(e) => set(k, e.target.value)} className="text-sm" /></div>
                ))}
              </div>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default LessonPlans;

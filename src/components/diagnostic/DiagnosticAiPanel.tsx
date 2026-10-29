/**
 * Onglet 6 (modèles 3 et 4) : analyse de l'évaluation diagnostique par l'IA.
 * Sources : statistiques anonymes des classes (toujours), test passé dans l'appli (taux de
 * réussite réels par question), document du test ou du cours, taux saisis par exercice.
 * Tout le résultat reste modifiable (fenêtre « Modifier l'analyse ») et peut être recopié
 * dans les constats / propositions du modèle 1.
 */
import { useEffect, useMemo, useState } from "react";
import { ClipboardCopy, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AiProgress, useElapsed } from "@/components/ai/AiProgress";
import { accessStore } from "@/contexts/AccessContext";
import { aiErrorMessage, loadAiMaterials } from "@/lib/teacherAi";
import { BAND_LABEL, MASTERY_LABEL, emptyAnalysis, generateDiagnosticAnalysis, type DiagnosticAiAnalysis, type Mastery } from "@/lib/diagnosticAi";
import { getLangContent, setLangContent, type DiagnosticConfig } from "@/lib/diagnosticStorage";
import type { DiagnosticClass } from "@/lib/diagnosticStatsEngine";
import type { DiagLang } from "@/lib/diagnosticTranslations";
import type { CourseMaterialLike } from "@/lib/courseMedia";

interface Props {
  config: DiagnosticConfig;
  classes: DiagnosticClass[];
  lang: DiagLang;
  /** tests et quiz du professeur (CourseContext) */
  exams: { id: string; title: string; course_id: string }[];
  courseIds: string[];
  onConfig: (updater: (c: DiagnosticConfig) => DiagnosticConfig) => void;
}

export function DiagnosticAiPanel({ config, classes, lang, exams, courseIds, onConfig }: Props) {
  const L = (ar: string, fr: string, en: string) => (lang === "ar" ? ar : lang === "en" ? en : fr);
  const tr = (fr: string, ar: string, en: string) => L(ar, fr, en);
  const content = getLangContent(config, lang);
  const analysis = config.analyse_ia?.[lang] || null;
  const rates = config.taux_exercices || {};

  const [examId, setExamId] = useState("none");
  const [materialId, setMaterialId] = useState("none");
  const [materials, setMaterials] = useState<(CourseMaterialLike & { course_id: string; id: string })[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const elapsed = useElapsed(startedAt);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DiagnosticAiAnalysis>(emptyAnalysis());

  const courseKey = courseIds.join(",");
  useEffect(() => {
    void loadAiMaterials(courseIds).then((m) => setMaterials(m as any));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseKey]);
  const myExams = useMemo(() => exams.filter((e) => courseIds.includes(e.course_id)), [exams, courseIds]);

  const setAnalysis = (a: DiagnosticAiAnalysis | null) =>
    onConfig((c) => {
      const next = { ...(c.analyse_ia || {}) };
      if (a) next[lang] = a;
      else delete next[lang];
      return { ...c, analyse_ia: next };
    });

  const generate = async () => {
    if (busy || !accessStore.guard("ai.diagnostic")) return;
    if (!classes.length) return toast.error(tr("Sélectionnez au moins une classe.", "اختر قسماً واحداً على الأقل.", "Select at least one class."));
    setBusy(true);
    setFinishing(false);
    setStartedAt(Date.now());
    try {
      const a = await generateDiagnosticAnalysis({
        config, classes, lang,
        exercises: content.exercices.map((e, i) => ({ title: e.titre, description: e.description, rate: rates[String(i)] ?? null })),
        examId: examId === "none" ? undefined : examId,
        materialId: materialId === "none" ? undefined : materialId,
        notes,
      });
      setFinishing(true);
      setAnalysis(a);
      toast.success(tr("Analyse prête : vérifiez-la et modifiez-la si besoin.", "التحليل جاهز: راجعه وعدّله عند الحاجة.", "Analysis ready: review and edit it if needed."));
    } catch (e: any) {
      toast.error(aiErrorMessage(String(e?.message || ""), tr));
    } finally {
      setBusy(false);
      setStartedAt(null);
    }
  };

  const copyToModel1 = () => {
    if (!analysis) return;
    onConfig((c) => setLangContent(c, lang, {
      observations: analysis.observations,
      propositions: analysis.propositions,
      ...(analysis.appreciation ? { appreciation_globale: analysis.appreciation } : {}),
    }));
    toast.success(tr("Constats, propositions et appréciation recopiés dans le modèle 1 (onglet 4).", "تم نسخ الملاحظات والمقترحات والتقدير إلى النموذج 1.", "Copied to template 1 (tab 4)."));
  };

  const openEditor = () => {
    setDraft(JSON.parse(JSON.stringify(analysis || emptyAnalysis())));
    setEditing(true);
  };
  const saveEditor = () => {
    setAnalysis({ ...draft, observations: draft.observations.filter(Boolean), propositions: draft.propositions.filter(Boolean) });
    setEditing(false);
  };
  const upd = <K extends keyof DiagnosticAiAnalysis>(k: K, v: DiagnosticAiAnalysis[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const dir = lang === "ar" ? "rtl" : "ltr";

  if (busy) {
    return (
      <div className="rounded-lg border border-violet-200 bg-violet-50/40 px-3 dark:border-violet-900 dark:bg-violet-950/20">
        <AiProgress
          className="py-4"
          elapsed={elapsed}
          finishing={finishing}
          expected={materialId !== "none" ? 60 : 45}
          title={L("تحليل التقويم التشخيصي", "Analyse de l'évaluation diagnostique", "Analysing the diagnostic")}
          stages={[
            { at: 0, label: L("إرسال الإحصائيات (بدون أسماء)", "Envoi des statistiques (sans noms)", "Sending statistics (no names)") },
            ...(examId !== "none" || materialId !== "none" ? [{ at: 8, label: L("قراءة الاختبار / الوثيقة", "Lecture du test / du document", "Reading the test / document") }] : []),
            { at: 20, label: L("تحليل التحكم في الموارد", "Maîtrise de chaque ressource", "Mastery of each resource") },
            { at: 45, label: L("حاجيات الفئات ونوع الدعم", "Besoins des groupes", "Group needs") },
            { at: 65, label: L("خطة الدعم والمعالجة", "Plan de remédiation", "Remediation plan") },
            { at: 82, label: L("الملاحظات والمقترحات", "Constats et propositions", "Findings and proposals") },
          ]}
          note={L("التقدم تقديري: يرسل الذكاء الاصطناعي التحليل كاملاً دفعة واحدة.", "Avancement estimé : l'IA renvoie l'analyse complète en une fois.", "Estimated progress: the AI returns the whole analysis at once.")}
          lateLabel={L("لحظة من فضلك…", "encore un instant…", "almost there…")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/40 p-3 dark:border-violet-900 dark:bg-violet-950/20">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-800 dark:text-violet-200">
        <Sparkles className="h-3.5 w-3.5" />{L("التحليل بالذكاء الاصطناعي", "Analyse par l'IA", "AI analysis")}
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">{L("الاختبار المنجز في التطبيق (اختياري)", "Test passé dans l'appli (facultatif)", "Test taken in the app (optional)")}</Label>
        <Select value={examId} onValueChange={setExamId}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">—</SelectItem>
            {myExams.map((e) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-slate-500">{L("نسب النجاح الحقيقية لكل سؤال تُحسب تلقائياً.", "Les taux de réussite réels de chaque question sont calculés.", "Real success rates per question are used.")}</p>
      </div>

      {materials.length > 0 && (
        <div className="space-y-1">
          <Label className="text-[11px]">{L("وثيقة الاختبار أو الدرس (اختياري)", "Document du test ou du cours (facultatif)", "Test or course document (optional)")}</Label>
          <Select value={materialId} onValueChange={setMaterialId}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {materials.map((m) => <SelectItem key={m.id} value={m.id}>{m.file_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {content.exercices.length > 0 && (
        <div className="space-y-1">
          <Label className="text-[11px]">{L("نسبة النجاح لكل تمرين % (اختياري)", "Taux de réussite par exercice % (facultatif)", "Success rate per exercise % (optional)")}</Label>
          <div className="space-y-1">
            {content.exercices.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[11px] text-slate-600 dark:text-slate-300" title={e.description}>{e.titre}</span>
                <Input
                  type="number" min={0} max={100} inputMode="numeric"
                  className="h-7 w-16 text-xs"
                  value={rates[String(i)] ?? ""}
                  placeholder="—"
                  onChange={(ev) => {
                    const v = ev.target.value === "" ? null : Math.max(0, Math.min(100, Number(ev.target.value)));
                    onConfig((c) => ({ ...c, taux_exercices: { ...(c.taux_exercices || {}), [String(i)]: v } }));
                  }}
                />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-500">{L("بدونها، يقدّر الذكاء الاصطناعي النسب ويشير إلى ذلك.", "Sans ces taux, l'IA les estime et l'indique.", "Without them, the AI estimates and says so.")}</p>
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-[11px]">{L("ملاحظاتك (اختياري)", "Vos remarques (facultatif)", "Your notes (optional)")}</Label>
        <Textarea rows={2} dir={dir} value={notes} onChange={(e) => setNotes(e.target.value)} className="text-xs" placeholder={L("مثلاً: صعوبات في الحساب الحرفي…", "ex. : difficultés en calcul littéral…", "e.g. difficulties with algebra…")} />
      </div>

      <Button onClick={() => void generate()} className="h-9 w-full gap-1.5 bg-violet-600 text-xs font-semibold text-white hover:bg-violet-700">
        <Sparkles className="h-4 w-4" />{analysis ? L("إعادة التوليد", "Régénérer l'analyse", "Regenerate") : L("توليد التحليل", "Générer l'analyse", "Generate the analysis")}
      </Button>
      <p className="text-[10px] leading-snug text-slate-500">{L("تُرسل إحصائيات مجهولة فقط (بدون أسماء أو أرقام مسار).", "Seules des statistiques anonymes sont envoyées (aucun nom ni numéro Massar).", "Only anonymous statistics are sent (no names).")}</p>

      {analysis && (
        <div className="grid grid-cols-2 gap-2 border-t border-violet-200 pt-2 dark:border-violet-900">
          <Button variant="outline" size="sm" onClick={openEditor} className="gap-1 text-xs"><Pencil className="h-3.5 w-3.5" />{L("تعديل التحليل", "Modifier l'analyse", "Edit analysis")}</Button>
          <Button variant="outline" size="sm" onClick={copyToModel1} className="gap-1 text-xs"><ClipboardCopy className="h-3.5 w-3.5" />{L("نسخ إلى النموذج 1", "Copier vers modèle 1", "Copy to template 1")}</Button>
          <Button variant="ghost" size="sm" onClick={() => setAnalysis(null)} className="col-span-2 gap-1 text-xs text-rose-600"><Trash2 className="h-3.5 w-3.5" />{L("حذف التحليل", "Effacer l'analyse", "Clear analysis")}</Button>
        </div>
      )}

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[92vh] w-[96vw] overflow-y-auto sm:max-w-5xl" dir={dir}>
          <DialogHeader>
            <DialogTitle>{L("تعديل التحليل", "Modifier l'analyse", "Edit analysis")}</DialogTitle>
            <DialogDescription className="text-xs">{L("كل الحقول قابلة للتعديل وتظهر مباشرة في التقرير.", "Tous les champs sont modifiables et apparaissent dans le rapport.", "Every field is editable and shown in the report.")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 text-sm">
            <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
              <div className="space-y-1"><Label className="text-xs">{L("التقدير العام", "Appréciation générale", "Overall level")}</Label><Input value={draft.appreciation} onChange={(e) => upd("appreciation", e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">{L("خلاصة", "Synthèse", "Summary")}</Label><Textarea rows={2} value={draft.summary} onChange={(e) => upd("summary", e.target.value)} /></div>
            </div>

            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">{L("التحكم في الموارد", "Maîtrise des ressources", "Resources")}</h4>
              {draft.resources.map((r, i) => {
                const set = (patch: Partial<typeof r>) => upd("resources", draft.resources.map((x, k) => (k === i ? { ...x, ...patch } : x)));
                return (
                  <div key={i} className="space-y-2 rounded-lg border p-2">
                    <div className="flex flex-wrap gap-2">
                      <Input className="min-w-[12rem] flex-1 font-medium" value={r.resource} onChange={(e) => set({ resource: e.target.value })} />
                      <Input type="number" min={0} max={100} className="w-20" value={r.rate} onChange={(e) => set({ rate: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
                      <Select value={r.mastery} onValueChange={(v) => set({ mastery: v as Mastery })}>
                        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>{(["acquired", "partial", "not_acquired"] as Mastery[]).map((m) => <SelectItem key={m} value={m}>{MASTERY_LABEL[lang][m]}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="text-rose-600" onClick={() => upd("resources", draft.resources.filter((_, k) => k !== i))} aria-label="×"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Textarea rows={2} value={r.difficulties} placeholder={L("التعثرات", "Difficultés", "Difficulties")} onChange={(e) => set({ difficulties: e.target.value })} className="text-xs" />
                      <Textarea rows={2} value={r.error_type} placeholder={L("طبيعة الخطأ", "Nature de l'erreur", "Error type")} onChange={(e) => set({ error_type: e.target.value })} className="text-xs" />
                      <Textarea rows={2} value={r.remediation} placeholder={L("المعالجة", "Remédiation", "Remediation")} onChange={(e) => set({ remediation: e.target.value })} className="text-xs" />
                    </div>
                  </div>
                );
              })}
              <Button variant="outline" size="sm" className="gap-1" onClick={() => upd("resources", [...draft.resources, { resource: "", mastery: "partial", rate: 50, difficulties: "", error_type: "", remediation: "" }])}><Plus className="h-3.5 w-3.5" />{L("مورد", "Ressource", "Resource")}</Button>
            </section>

            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">{L("الفئات", "Groupes", "Groups")}</h4>
              {draft.groups.map((g, i) => {
                const set = (patch: Partial<typeof g>) => upd("groups", draft.groups.map((x, k) => (k === i ? { ...x, ...patch } : x)));
                return (
                  <div key={g.band} className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[150px_1fr_160px_1fr]">
                    <div className="self-center text-xs font-semibold">{BAND_LABEL[lang][g.band]}</div>
                    <Textarea rows={2} value={g.needs} placeholder={L("الحاجيات", "Besoins", "Needs")} onChange={(e) => set({ needs: e.target.value })} className="text-xs" />
                    <Textarea rows={2} value={g.support_type} placeholder={L("نوع الدعم", "Type de soutien", "Support")} onChange={(e) => set({ support_type: e.target.value })} className="text-xs" />
                    <Textarea rows={2} value={g.activities} placeholder={L("الأنشطة", "Activités", "Activities")} onChange={(e) => set({ activities: e.target.value })} className="text-xs" />
                  </div>
                );
              })}
            </section>

            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">{L("خطة الدعم", "Plan de remédiation", "Remediation plan")}</h4>
              {draft.plan.map((p, i) => {
                const set = (patch: Partial<typeof p>) => upd("plan", draft.plan.map((x, k) => (k === i ? { ...x, ...patch } : x)));
                return (
                  <div key={i} className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[110px_1fr_120px_1fr_1fr_auto]">
                    <Input value={p.period} placeholder={L("الفترة", "Période", "Period")} onChange={(e) => set({ period: e.target.value })} className="text-xs" />
                    <Textarea rows={2} value={p.content} placeholder={L("التعلمات", "Apprentissages", "Learning")} onChange={(e) => set({ content: e.target.value })} className="text-xs" />
                    <Input value={p.target} placeholder={L("الفئة", "Groupe", "Group")} onChange={(e) => set({ target: e.target.value })} className="text-xs" />
                    <Textarea rows={2} value={p.activities} placeholder={L("الأنشطة", "Activités", "Activities")} onChange={(e) => set({ activities: e.target.value })} className="text-xs" />
                    <Textarea rows={2} value={p.indicators} placeholder={L("المؤشرات", "Indicateurs", "Indicators")} onChange={(e) => set({ indicators: e.target.value })} className="text-xs" />
                    <Button variant="ghost" size="icon" className="text-rose-600" onClick={() => upd("plan", draft.plan.filter((_, k) => k !== i))} aria-label="×"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                );
              })}
              <Button variant="outline" size="sm" className="gap-1" onClick={() => upd("plan", [...draft.plan, { period: "", content: "", target: "", activities: "", indicators: "" }])}><Plus className="h-3.5 w-3.5" />{L("سطر", "Ligne", "Row")}</Button>
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">{L("الملاحظات (سطر لكل ملاحظة)", "Constats (une ligne par constat)", "Findings (one per line)")}</Label>
                <Textarea rows={7} value={draft.observations.join("\n")} onChange={(e) => upd("observations", e.target.value.split("\n"))} className="text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{L("المقترحات (سطر لكل مقترح)", "Propositions (une ligne par proposition)", "Proposals (one per line)")}</Label>
                <Textarea rows={7} value={draft.propositions.join("\n")} onChange={(e) => upd("propositions", e.target.value.split("\n"))} className="text-xs" />
              </div>
            </section>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditing(false)}>{L("إلغاء", "Annuler", "Cancel")}</Button>
            <Button onClick={saveEditor}>{L("حفظ", "Enregistrer", "Save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


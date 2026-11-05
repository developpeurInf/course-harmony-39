/**
 * Onglet 6 (modèles 3 et 4) : analyse de l'évaluation diagnostique par l'IA.
 * Sources : statistiques anonymes des classes (toujours), test passé dans l'appli (taux de
 * réussite réels par question), document du test ou du cours, taux saisis par exercice.
 * Tout le résultat reste modifiable (fenêtre « Modifier l'analyse ») et peut être recopié
 * dans les constats / propositions du modèle 1.
 */
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ClipboardCopy, Loader2, Pencil, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useElapsed } from "@/components/ai/AiProgress";
import { accessStore } from "@/contexts/AccessContext";
import { aiErrorMessage, loadAiMaterials } from "@/lib/teacherAi";
import { BAND_LABEL, MASTERY_LABEL, emptyAnalysis, generateDiagnosticAnalysis, partsForTemplate, type DiagPart, type DiagnosticAiAnalysis, type Mastery } from "@/lib/diagnosticAi";
import { getLangContent, numberToWords, setLangContent, type DiagnosticConfig } from "@/lib/diagnosticStorage";
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
  /** modèle affiché : décide des parties à générer */
  template: "t1" | "t2" | "t3" | "t4";
  /** mode de rédaction choisi au début (ai = génération, manual = saisie) */
  mode: "ai" | "manual";
  /** ouvre l'onglet 4 (textes du modèle 1) */
  onOpenTexts?: () => void;
}

export function DiagnosticAiPanel({ config, classes, lang, exams, courseIds, onConfig, template, mode, onOpenTexts }: Props) {
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
  // État de chaque partie pendant / après la génération
  const [partState, setPartState] = useState<Partial<Record<DiagPart, "running" | "done" | "error">>>({});
  const [partErrors, setPartErrors] = useState<Partial<Record<DiagPart, string>>>({});
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

  const generate = async (only?: DiagPart[]) => {
    if (busy || !accessStore.guard("ai.diagnostic")) return;
    if (!classes.length) return toast.error(tr("Sélectionnez au moins une classe.", "اختر قسماً واحداً على الأقل.", "Select at least one class."));
    const parts = only && only.length ? only : partsForTemplate(template, examId !== "none" || materialId !== "none");
    setBusy(true);
    setPartState(Object.fromEntries(parts.map((p) => [p, "running"])));
    setPartErrors({});
    setStartedAt(Date.now());
    try {
      const { analysis: got, failed } = await generateDiagnosticAnalysis(
        {
          config, classes, lang,
          exercises: content.exercices.map((e, i) => ({ title: e.titre, description: e.description, rate: rates[String(i)] ?? null })),
          examId: examId === "none" ? undefined : examId,
          materialId: materialId === "none" ? undefined : materialId,
          notes,
        },
        (part, status, error) => {
          setPartState((s) => ({ ...s, [part]: status }));
          if (error) setPartErrors((s) => ({ ...s, [part]: error }));
        },
        parts,
      );
      // Les parties reçues remplacent les anciennes ; les autres sont conservées.
      // Constats, propositions, appréciation et composition du test vont aussi dans l'onglet 4
      // (modèles 1 et 3), l'introduction / remarque / soutien dans les textes du modèle 2.
      if (Object.keys(got).length) {
        onConfig((c) => {
          const base = c.analyse_ia?.[lang] || emptyAnalysis();
          let next: DiagnosticConfig = { ...c, analyse_ia: { ...(c.analyse_ia || {}), [lang]: { ...base, ...got, generated_at: new Date().toISOString() } } };
          if (got.observations || got.propositions || got.appreciation) {
            next = setLangContent(next, lang, {
              ...(got.observations?.length ? { observations: got.observations } : {}),
              ...(got.propositions?.length ? { propositions: got.propositions } : {}),
              ...(got.appreciation ? { appreciation_globale: got.appreciation } : {}),
            });
          }
          if (got.exercises?.length) {
            next = setLangContent(next, lang, {
              exercices: got.exercises.map((e) => ({ titre: e.title, description: e.description })),
              nombre_exercices_texte: numberToWords(got.exercises.length, lang),
            });
          }
          if (got.intro || got.remark || got.support) {
            const r2 = { ...(next.rapport2_par_langue?.[lang] || {}) };
            if (got.intro) r2.intro = got.intro;
            if (got.remark) r2.remarque = got.remark;
            if (got.support) r2.soutien = got.support;
            next = { ...next, rapport2_par_langue: { ...(next.rapport2_par_langue || {}), [lang]: r2 } };
          }
          return next;
        });
      }
      if (!failed.length) {
        setPartState({});
        toast.success(tr("Textes générés : vérifiez-les et modifiez-les si besoin.", "تم توليد النصوص: راجعها وعدّلها عند الحاجة.", "Texts generated: review and edit them if needed."));
      } else {
        toast.error(`${aiErrorMessage(failed[0].error, tr)} ${tr("Les parties réussies sont conservées.", "تم الاحتفاظ بالأجزاء الناجحة.", "Successful parts were kept.")}`);
      }
    } finally {
      setBusy(false);
      setStartedAt(null);
    }
  };
  const ALL_PARTS: DiagPart[] = ["summary", "exercises", "report2", "resources", "groups", "plan"];
  const failedParts = ALL_PARTS.filter((p) => partState[p] === "error");

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

  const partLabel: Record<DiagPart, string> = {
    exercises: L("مكونات الرائز (التمارين)", "Composition du test (exercices)", "Test structure (exercises)"),
    report2: L("التقديم والملاحظة وأساليب الدعم", "Introduction, remarque et soutien", "Introduction, note and support"),
    summary: L("التقدير العام والملاحظات والمقترحات", "Appréciation, constats et propositions", "Overall level, findings, proposals"),
    resources: L("التحكم في كل مورد", "Maîtrise de chaque ressource", "Mastery of each resource"),
    groups: L("حاجيات الفئات ونوع الدعم", "Besoins des groupes", "Group needs"),
    plan: L("خطة الدعم والمعالجة", "Plan de remédiation", "Remediation plan"),
  };
  const tracked = ALL_PARTS.filter((p) => partState[p]);
  const doneCount = tracked.filter((p) => partState[p] === "done").length;
  // Barre : parties terminées + progression estimée de celles en cours (~45 s chacune)
  const running = tracked.length - doneCount - failedParts.length;
  const pct = tracked.length ? Math.round(((doneCount + failedParts.length + running * Math.min(0.9, elapsed / 50)) / tracked.length) * 100) : 0;
  const progress = tracked.length > 0 && (
    <div className="space-y-2 rounded-md border border-violet-200 bg-white/70 p-2 dark:border-violet-900 dark:bg-slate-900/50">
      {busy && (
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <div className="h-full rounded-full bg-violet-500 transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>{doneCount}/{tracked.length}</span><span>{Math.floor(elapsed)} s</span></div>
        </div>
      )}
      <ul className="space-y-1 text-[11px]">
        {tracked.map((p) => (
          <li key={p} className="flex items-start gap-1.5">
            {partState[p] === "done" ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> : partState[p] === "error" ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" /> : <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-violet-500" />}
            <span>
              {partLabel[p]}
              {partState[p] === "error" && partErrors[p] && <span className="block text-rose-600">{aiErrorMessage(partErrors[p]!, tr)}</span>}
            </span>
          </li>
        ))}
      </ul>
      {!busy && failedParts.length > 0 && (
        <Button size="sm" variant="outline" onClick={() => void generate(failedParts)} className="h-7 w-full gap-1 text-[11px]">
          <RotateCcw className="h-3 w-3" />{L("إعادة الأجزاء الفاشلة", "Relancer les parties manquantes", "Retry failed parts")}
        </Button>
      )}
    </div>
  );

  const editorDialog = (
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
  );

  const advanced = template === "t3" || template === "t4";

  // Mode manuel, modèles 1 et 2 : le professeur rédige les textes lui-même
  if (mode === "manual" && !advanced) {
    return (
      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/40">
        <p className="text-[11px] text-slate-600 dark:text-slate-300">
          {template === "t1"
            ? L("الوضع اليدوي: املأ بنفسك النتائج والمعالجة (التبويب 4) والإعدادات (التبويب 5).", "Mode manuel : remplissez vous-même les résultats et la remédiation (onglet 4) et les paramètres (onglet 5).", "Manual mode: fill in results & remediation (tab 4) and settings (tab 5) yourself.")
            : L("الوضع اليدوي: اكتب بنفسك التقديم والملاحظة وأساليب الدعم.", "Mode manuel : rédigez vous-même l'introduction, la remarque et les méthodes de soutien.", "Manual mode: write the introduction, the note and the support methods yourself.")}
        </p>
        {onOpenTexts && (
          <Button variant="outline" size="sm" onClick={onOpenTexts} className="w-full gap-1 text-xs"><Pencil className="h-3.5 w-3.5" />{template === "t1" ? L("تعديل النتائج والمقترحات (4)", "Modifier les résultats (onglet 4)", "Edit the results (tab 4)") : L("تعديل نصوص النموذج 2", "Modifier les textes du modèle 2", "Edit template 2 texts")}</Button>
        )}
      </div>
    );
  }

  // Mode manuel (modèles 3 et 4) : saisie directe de l'analyse, sans IA
  if (mode === "manual") {
    return (
      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/40">
        <p className="text-[11px] text-slate-600 dark:text-slate-300">{L("الوضع اليدوي: املأ التحليل بنفسك (الموارد، الفئات، خطة الدعم).", "Mode manuel : remplissez vous-même l'analyse (ressources, groupes, plan de remédiation).", "Manual mode: fill in the analysis yourself (resources, groups, plan).")}</p>
        <Button variant="outline" size="sm" onClick={openEditor} className="w-full gap-1 text-xs"><Pencil className="h-3.5 w-3.5" />{analysis ? L("تعديل التحليل", "Modifier l'analyse", "Edit analysis") : L("ملء التحليل يدوياً", "Remplir l'analyse", "Fill in the analysis")}</Button>
        {editorDialog}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/40 p-3 dark:border-violet-900 dark:bg-violet-950/20">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-800 dark:text-violet-200">
        <Sparkles className="h-3.5 w-3.5" />{advanced ? L("التحليل بالذكاء الاصطناعي", "Analyse par l'IA", "AI analysis") : L("التحرير بالذكاء الاصطناعي", "Rédaction par l'IA", "AI writing")}
      </div>
      {!advanced && (
        <p className="text-[10px] leading-snug text-slate-600 dark:text-slate-300">
          {template === "t1"
            ? L("يحرر الذكاء الاصطناعي التقدير العام والملاحظات والمقترحات، ومكونات الرائز إذا اخترت الاختبار أو وثيقته. النموذج لا يتغير.", "L'IA rédige l'appréciation, les observations et les propositions, et la composition du test si vous choisissez le test ou son document. La mise en page ne change pas.", "The AI writes the overall level, findings and proposals, and the test structure if you pick the test or its document. The layout does not change.")
            : L("يحرر الذكاء الاصطناعي التقديم والملاحظة وأساليب الدعم، والملاحظات والمقترحات. النموذج لا يتغير.", "L'IA rédige l'introduction, la remarque et les méthodes de soutien, ainsi que les observations et propositions. La mise en page ne change pas.", "The AI writes the introduction, the note and the support methods, plus findings and proposals. The layout does not change.")}
        </p>
      )}

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

      <Button onClick={() => void generate()} disabled={busy} className="h-9 w-full gap-1.5 bg-violet-600 text-xs font-semibold text-white hover:bg-violet-700">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{analysis ? L("إعادة التوليد", "Régénérer", "Regenerate") : advanced ? L("توليد التحليل", "Générer l'analyse", "Generate the analysis") : L("توليد النصوص", "Générer les textes", "Generate the texts")}
      </Button>
      {progress}
      <p className="text-[10px] leading-snug text-slate-500">{L("تُرسل إحصائيات مجهولة فقط (بدون أسماء أو أرقام مسار).", "Seules des statistiques anonymes sont envoyées (aucun nom ni numéro Massar).", "Only anonymous statistics are sent (no names).")}</p>

      {analysis && !busy && !advanced && template === "t1" && onOpenTexts && (
        <Button variant="outline" size="sm" onClick={onOpenTexts} className="w-full gap-1 text-xs"><Pencil className="h-3.5 w-3.5" />{L("مراجعة النصوص وتعديلها (4)", "Relire et modifier les textes (onglet 4)", "Review and edit the texts (tab 4)")}</Button>
      )}
      {analysis && !busy && advanced && (
        <div className="grid grid-cols-2 gap-2 border-t border-violet-200 pt-2 dark:border-violet-900">
          <Button variant="outline" size="sm" onClick={openEditor} className="gap-1 text-xs"><Pencil className="h-3.5 w-3.5" />{L("تعديل التحليل", "Modifier l'analyse", "Edit analysis")}</Button>
          <Button variant="outline" size="sm" onClick={copyToModel1} className="gap-1 text-xs"><ClipboardCopy className="h-3.5 w-3.5" />{L("نسخ إلى النموذج 1", "Copier vers modèle 1", "Copy to template 1")}</Button>
          <Button variant="ghost" size="sm" onClick={() => setAnalysis(null)} className="col-span-2 gap-1 text-xs text-rose-600"><Trash2 className="h-3.5 w-3.5" />{L("حذف التحليل", "Effacer l'analyse", "Clear analysis")}</Button>
        </div>
      )}

      {editorDialog}
    </div>
  );
}


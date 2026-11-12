"use client";
/**
 * Générateur d'exams proposés : le professeur choisit les chapitres, le type (devoir surveillé ou
 * devoir maison) et les classes ; chaque classe reçoit une version différente, avec en-tête,
 * barème sur 20, et deux sorties : énoncé, énoncé + corrigé détaillé.
 */
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckSquare, FileText, Plus, Sparkles, Square } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCourses } from "@/contexts/CourseContext";
import { bankFor } from "@/lib/proposed/examBank";
import { buildExam, currentSchoolYear, openExam, type ExamRequest, type ExamType, type ExamVersion } from "@/lib/proposed/examGen";
import { LEVELS, SUBJECTS, type LevelKey, type SubjectKey } from "@/lib/proposed/catalog";
import type { NumberedChapter } from "@/lib/proposed/order";

interface Props {
  level: LevelKey | "";
  subject: SubjectKey | "";
  chapters: NumberedChapter[];
  teacher?: string | null;
  school?: string | null;
  roomName?: string;
}

export function ExamGenerator({ level, subject, chapters, teacher, school, roomName }: Props) {
  const { language } = useLanguage();
  const L = (v: [string, string, string]) => (language === "ar" ? v[1] : language === "en" ? v[2] : v[0]);
  const tr = (fr: string, ar: string, en: string) => L([fr, ar, en]);
  const { rooms } = useCourses();
  const bank = useMemo(() => bankFor(level, subject), [level, subject]);
  const countBy = useMemo(() => { const m = new Map<string, number>(); bank.forEach((e) => m.set(e.chapter, (m.get(e.chapter) || 0) + 1)); return m; }, [bank]);
  const available = chapters.filter((c) => countBy.get(c.id));

  const [picked, setPicked] = useState<string[]>([]);
  const [type, setType] = useState<ExamType>("ds");
  const [number, setNumber] = useState(1);
  const [semester, setSemester] = useState<1 | 2>(1);
  const [duration, setDuration] = useState(120);
  const [date, setDate] = useState("");
  const [classes, setClasses] = useState<string[]>([]);
  const [newClass, setNewClass] = useState("");
  const [versions, setVersions] = useState<ExamVersion[] | null>(null);

  /** classes du professeur de même niveau et même matière, proposées par défaut */
  const sameLevel = useMemo(() => rooms.filter((r) => (r as any).level === level && (!(r as any).subject || (r as any).subject === subject)).map((r) => r.name), [rooms, level, subject]);
  useEffect(() => { setClasses(roomName ? [roomName] : []); setVersions(null); setPicked([]); }, [roomName, level, subject]);

  const toggle = (id: string) => { setVersions(null); setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])); };
  const toggleClass = (n: string) => { setVersions(null); setClasses((c) => (c.includes(n) ? c.filter((x) => x !== n) : [...c, n])); };

  if (!bank.length) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        {tr("Le générateur d'exams sera bientôt disponible pour ce niveau et cette matière.", "مولد الامتحانات سيكون متاحا قريبا لهذا المستوى وهذه المادة.", "The exam generator is coming soon for this level and subject.")}
      </div>
    );
  }

  const req = (): ExamRequest => ({
    type, number, semester,
    chapters: chapters.filter((c) => picked.includes(c.id)).map((c) => ({ id: c.id, num: c.num, title: c.title })),
    classes: classes.length ? classes : [""],
    durationMin: type === "ds" ? duration : undefined,
    date: date ? new Date(date).toLocaleDateString("fr-FR") : undefined,
    levelLabel: L(LEVELS.find((l) => l.key === level)!.label),
    subjectLabel: L(SUBJECTS.find((s) => s.key === subject)!.label),
    teacher: teacher || undefined, school: school || undefined, schoolYear: currentSchoolYear(),
  });

  const generate = () => setVersions(buildExam(req(), bank));
  const shared = versions?.some((v) => v.shared);

  const chip = (active: boolean) => active
    ? "inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
    : "inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 text-sm hover:bg-accent";

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold"><Sparkles className="h-4 w-4 text-primary" />{tr("Générer un devoir", "إنشاء فرض", "Generate a test")}</h2>
        <p className="text-xs text-muted-foreground">{tr("Choisissez les chapitres : chaque classe reçoit un sujet différent, avec barème sur 20 et corrigé détaillé.", "اختر الدروس: كل قسم يحصل على موضوع مختلف مع سلم التنقيط والتصحيح المفصل.", "Pick chapters: each class gets a different paper, marked out of 20, with detailed solutions.")}</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{tr("Type", "النوع", "Type")}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={chip(type === "ds")} aria-pressed={type === "ds"} onClick={() => { setType("ds"); setVersions(null); }}>{tr("Devoir surveillé", "فرض محروس", "In-class test")}</button>
          <button type="button" className={chip(type === "dm")} aria-pressed={type === "dm"} onClick={() => { setType("dm"); setVersions(null); }}>{tr("Devoir maison", "فرض منزلي", "Homework")}</button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{tr("Chapitres du devoir", "دروس الفرض", "Chapters")} ({picked.length})</p>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {available.map((c) => {
            const on = picked.includes(c.id);
            return (
              <li key={c.id}>
                <button type="button" onClick={() => toggle(c.id)} aria-pressed={on} className={`flex min-h-[40px] w-full items-center gap-2 rounded-lg border px-3 text-start text-sm ${on ? "border-primary bg-primary/5" : "hover:bg-accent"}`}>
                  {on ? <CheckSquare className="h-4 w-4 shrink-0 text-primary" /> : <Square className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0 flex-1">{tr(`Ch. ${c.num} · `, `د ${c.num} · `, `Ch. ${c.num} · `)}{c.title}</span>
                  <span className="text-[11px] text-muted-foreground">{countBy.get(c.id)} ex.</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">{tr("N° du devoir", "رقم الفرض", "Number")}
          <input type="number" min={1} max={9} value={number} onChange={(e) => { setNumber(Math.max(1, Number(e.target.value) || 1)); setVersions(null); }} className="h-10 rounded-md border bg-background px-3 text-sm text-foreground" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">{tr("Semestre", "الدورة", "Semester")}
          <select value={semester} onChange={(e) => setSemester(Number(e.target.value) as 1 | 2)} className="h-10 rounded-md border bg-background px-3 text-sm text-foreground"><option value={1}>1</option><option value={2}>2</option></select>
        </label>
        {type === "ds" && (
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">{tr("Durée (min)", "المدة (دقيقة)", "Duration (min)")}
            <input type="number" min={30} step={15} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 120)} className="h-10 rounded-md border bg-background px-3 text-sm text-foreground" />
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">{type === "ds" ? tr("Date", "التاريخ", "Date") : tr("À rendre le", "يسلم يوم", "Due on")}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm text-foreground" />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{tr("Classes (un sujet différent par classe)", "الأقسام (موضوع مختلف لكل قسم)", "Classes (one different paper each)")}</p>
        <div className="flex flex-wrap gap-2">
          {[...new Set([...sameLevel, ...classes])].map((n) => (
            <button key={n} type="button" className={chip(classes.includes(n))} aria-pressed={classes.includes(n)} onClick={() => toggleClass(n)}>{n}</button>
          ))}
          <span className="flex items-center gap-1">
            <input value={newClass} onChange={(e) => setNewClass(e.target.value)} placeholder={tr("Autre classe", "قسم آخر", "Other class")}
              onKeyDown={(e) => { if (e.key === "Enter" && newClass.trim()) { e.preventDefault(); toggleClass(newClass.trim()); setNewClass(""); } }}
              className="h-9 w-36 rounded-md border bg-background px-2 text-sm" />
            <button type="button" disabled={!newClass.trim()} onClick={() => { toggleClass(newClass.trim()); setNewClass(""); }} aria-label={tr("Ajouter", "إضافة", "Add")} className="inline-flex h-9 w-9 items-center justify-center rounded-md border disabled:opacity-40"><Plus className="h-4 w-4" /></button>
          </span>
        </div>
      </div>

      <button type="button" onClick={generate} disabled={!picked.length} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        <Sparkles className="h-4 w-4" />{tr("Générer", "إنشاء", "Generate")}
      </button>

      {versions && (
        <div className="space-y-2">
          {shared && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{tr("Pas assez d'exercices dans ces chapitres pour que toutes les classes aient des sujets entièrement différents : certaines partagent un exercice. Ajoutez un chapitre ou changez le n° du devoir.", "لا توجد تمارين كافية لجعل كل المواضيع مختلفة تماما.", "Not enough exercises for fully different papers: some classes share an exercise.")}
            </p>
          )}
          <ul className="divide-y rounded-lg border">
            {versions.map((v, i) => (
              <li key={i} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm">
                  <b>{v.className || tr("Sujet", "موضوع", "Paper")}</b>
                  <span className="block text-xs text-muted-foreground">{v.exercises.map((e, k) => `Ex. ${k + 1} : ${e.ex.title} (${String(e.pts).replace(".", ",")} pts)`).join(" · ")}</span>
                </span>
                <span className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => openExam(req(), v, false)} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 text-sm hover:bg-accent"><FileText className="h-4 w-4" />{tr("Énoncé", "الموضوع", "Paper")}</button>
                  <button type="button" onClick={() => openExam(req(), v, true)} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"><FileText className="h-4 w-4" />{tr("Énoncé + corrigé", "الموضوع + التصحيح", "Paper + solutions")}</button>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground">{tr("Le sujet s'ouvre dans un nouvel onglet : choisissez « Enregistrer en PDF » dans la fenêtre d'impression.", "يفتح الموضوع في نافذة جديدة: اختر « حفظ بصيغة PDF ».", "The paper opens in a new tab: choose “Save as PDF” in the print dialog.")}</p>
        </div>
      )}
    </section>
  );
}

/** Bibliothèque des labos du Labo 3D : par matière, niveau (TC, 1re Bac, 2e Bac) et leçon du programme marocain. */
import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { LESSONS, LEVELS, SUBJECTS, type LabEntry, type LabLesson, type Level, type Subject } from "@/lib/lab3d/catalog";
import { templateById, type Tri } from "@/lib/lab3d/templates";
import { cn } from "@/lib/utils";

const SUBJECT_KEY = "lab3d.library.subject";
const LEVEL_KEY = "lab3d.library.level";
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* stockage indisponible */ } };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function LabLibrary({ onOpen }: { onOpen: (lab: LabEntry, lesson: LabLesson) => void }) {
  const { language } = useLanguage();
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);
  const L = (t: Tri) => (language === "ar" ? t.ar : language === "en" ? t.en : t.fr);
  const [subject, setSubjectState] = useState<Subject>(() => (SUBJECTS.some((s) => s.id === read(SUBJECT_KEY)) ? read(SUBJECT_KEY) as Subject : "math"));
  const [level, setLevelState] = useState<Level | "all">(() => { const v = read(LEVEL_KEY); return LEVELS.some((l) => l.id === v) ? v as Level : "all"; });
  const [q, setQ] = useState("");
  const setSubject = (s: Subject) => { setSubjectState(s); write(SUBJECT_KEY, s); };
  const setLevel = (l: Level | "all") => { setLevelState(l); write(LEVEL_KEY, l); };

  const count = (s: Subject) => LESSONS.filter((l) => l.subject === s).reduce((n, l) => n + l.labs.length, 0);
  const lessons = useMemo(() => {
    const needle = norm(q.trim());
    return LESSONS.filter((l) => (needle ? true : l.subject === subject) && (level === "all" || l.level === level))
      .map((l) => {
        if (!needle) return l;
        const inLesson = norm(`${l.title.fr} ${l.title.ar} ${l.part.fr}`).includes(needle);
        const labs = inLesson ? l.labs : l.labs.filter((x) => norm(`${x.title.fr} ${x.title.ar} ${x.goal.fr}`).includes(needle));
        return { ...l, labs };
      })
      .filter((l) => l.labs.length > 0);
  }, [subject, level, q]);
  const byLevel = LEVELS.map((lv) => ({ lv, items: lessons.filter((l) => l.level === lv.id) })).filter((g) => g.items.length);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SUBJECTS.map((s) => (
          <button key={s.id} type="button" onClick={() => { setSubject(s.id); setQ(""); }}
            className={cn("flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors", subject === s.id && !q ? "border-primary bg-primary/10 font-medium" : "bg-card hover:bg-muted")}>
            <span className="text-lg">{s.icon}</span>{L(s.label)}<span className="rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground">{count(s.id)}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {([{ id: "all", label: { fr: "Tous niveaux", ar: "كل المستويات", en: "All levels" } }, ...LEVELS] as { id: Level | "all"; label: Tri }[]).map((lv) => (
          <button key={lv.id} type="button" onClick={() => setLevel(lv.id)}
            className={cn("rounded-full border px-3 py-1 text-xs", level === lv.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>{L(lv.label)}</button>
        ))}
        <div className="relative ms-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="h-9 ps-8" placeholder={tr("Chercher un labo, une notion…", "ابحث عن مختبر أو مفهوم…", "Search a lab, a notion…")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {byLevel.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{tr("Aucun labo ne correspond.", "لا يوجد مختبر مطابق.", "No matching lab.")}</p>}
      {byLevel.map(({ lv, items }) => (
        <section key={lv.id} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{L(lv.label)}</h3>
          <div className="grid gap-3 lg:grid-cols-2">
            {items.map((lesson) => (
              <div key={lesson.id} className="rounded-xl border bg-card">
                <div className="border-b px-4 py-3">
                  <p className="text-[11px] text-muted-foreground">{q && `${SUBJECTS.find((s) => s.id === lesson.subject)?.icon} `}{L(lesson.part)}</p>
                  <p className="font-medium leading-snug">{L(lesson.title)}</p>
                </div>
                <ul className="divide-y">
                  {lesson.labs.map((lab) => {
                    const tpl = templateById(lab.template);
                    return (
                      <li key={lab.id}>
                        <button type="button" onClick={() => onOpen(lab, lesson)} className="flex w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-muted/60">
                          <span className="text-xl">{tpl.icon}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">{L(lab.title)}</span>
                            <span className="block truncate text-xs text-muted-foreground">{L(lab.goal)}</span>
                          </span>
                          <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">{lab.steps.length} {tr("étapes", "مراحل", "steps")}</span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
      <p className="text-[11px] text-muted-foreground">{tr("Leçons choisies d'après les programmes et orientations pédagogiques du lycée marocain (filières scientifiques).", "دروس مختارة وفق برامج وتوجيهات التعليم الثانوي التأهيلي المغربي (الشعب العلمية).", "Lessons chosen from the Moroccan high-school curriculum (science streams).")}</p>
    </div>
  );
}

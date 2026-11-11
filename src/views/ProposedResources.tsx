"use client";
/**
 * Cours / Exercices / Exams proposés d'une classe : catalogue de documents originaux
 * rangé selon le programme officiel, filtré par le niveau et la matière de la classe.
 * Le niveau et la matière sont devinés depuis le nom de la classe ; le professeur peut
 * les changer (mémorisés sur cet appareil).
 */
import { useEffect, useMemo, useState } from "react";
import { useParams } from "@/lib/router";
import { useCourses } from "@/contexts/CourseContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { BookOpen, ClipboardCheck, Download, Eye, FileText, Search, X } from "lucide-react";
import {
  KIND_LABEL, LEVELS, SUBJECTS, chaptersFor, guessFromRoom,
  type LevelKey, type ProposedDoc, type ProposedKind, type SubjectKey,
} from "@/lib/proposed/catalog";

const KIND_ICON = { course: BookOpen, exercise: FileText, exam: ClipboardCheck } as const;
const storeKey = (roomId: string) => `proposed:${roomId}`;

function readChoice(roomId: string): { level?: LevelKey; subject?: SubjectKey } {
  try { return JSON.parse(localStorage.getItem(storeKey(roomId)) || "{}"); } catch { return {}; }
}

export default function ProposedResources({ kind }: { kind: ProposedKind }) {
  const { roomId = "" } = useParams<{ roomId: string }>();
  const { rooms } = useCourses();
  const { language } = useLanguage();
  const L = (v: [string, string, string]) => (language === "ar" ? v[1] : language === "en" ? v[2] : v[0]);
  const tr = (fr: string, ar: string, en: string) => L([fr, ar, en]);
  const room = rooms.find((r) => r.id === roomId);

  const [level, setLevel] = useState<LevelKey | "">("");
  const [subject, setSubject] = useState<SubjectKey | "">("");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<ProposedDoc | null>(null);

  useEffect(() => {
    const saved = readChoice(roomId);
    const guess = guessFromRoom(room?.name, room?.description);
    setLevel(saved.level || guess.level || "");
    setSubject(saved.subject || guess.subject || "pc");
  }, [roomId, room?.name, room?.description]);

  const save = (l: LevelKey | "", s: SubjectKey | "") => {
    setLevel(l); setSubject(s);
    try { localStorage.setItem(storeKey(roomId), JSON.stringify({ level: l || undefined, subject: s || undefined })); } catch { /* stockage indisponible */ }
  };

  const chapters = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chaptersFor(level || null, subject || null).filter((c) => !q || c.title.toLowerCase().includes(q) || c.part.toLowerCase().includes(q));
  }, [level, subject, query]);

  const parts = useMemo(() => {
    const m = new Map<string, typeof chapters>();
    chapters.forEach((c) => m.set(c.part, [...(m.get(c.part) || []), c]));
    return [...m.entries()];
  }, [chapters]);

  const ready = chapters.reduce((n, c) => n + (c.docs || []).filter((d) => d.kind === kind).length, 0);
  const Icon = KIND_ICON[kind];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold"><Icon className="h-5 w-5 text-primary" />{L(KIND_LABEL[kind])}</h1>
        <p className="text-sm text-muted-foreground">
          {tr(
            "Documents prêts à l'emploi selon le programme officiel, pour le niveau et la matière de cette classe.",
            "وثائق جاهزة وفق البرنامج الرسمي، حسب مستوى ومادة هذا القسم.",
            "Ready-to-use documents following the official curriculum for this class's level and subject."
          )}
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
        <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground">
          {tr("Niveau", "المستوى", "Level")}
          <select value={level} onChange={(e) => save(e.target.value as LevelKey, subject)} className="h-10 rounded-md border bg-background px-3 text-sm text-foreground">
            <option value="">{tr("Choisir le niveau", "اختر المستوى", "Choose level")}</option>
            {LEVELS.map((l) => <option key={l.key} value={l.key}>{L(l.label)}</option>)}
          </select>
        </label>
        <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground">
          {tr("Matière", "المادة", "Subject")}
          <select value={subject} onChange={(e) => save(level, e.target.value as SubjectKey)} className="h-10 rounded-md border bg-background px-3 text-sm text-foreground">
            {SUBJECTS.map((s) => <option key={s.key} value={s.key}>{L(s.label)}</option>)}
          </select>
        </label>
        <label className="flex min-w-[200px] flex-[2] flex-col gap-1 text-xs font-medium text-muted-foreground">
          {tr("Rechercher un chapitre", "ابحث عن درس", "Search a chapter")}
          <span className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} className="h-10 w-full rounded-md border bg-background ps-9 pe-3 text-sm text-foreground" />
          </span>
        </label>
      </div>

      {!level ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {tr("Choisissez le niveau de la classe pour voir les documents proposés.", "اختر مستوى القسم لعرض الوثائق المقترحة.", "Choose the class level to see suggested documents.")}
        </p>
      ) : parts.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {query
            ? tr("Aucun chapitre ne correspond.", "لا يوجد درس مطابق.", "No matching chapter.")
            : tr("Le programme de cette matière arrive bientôt.", "برنامج هذه المادة قريبا.", "This subject's curriculum is coming soon.")}
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {tr(`${chapters.length} chapitres · ${ready} document(s) disponible(s)`, `${chapters.length} درسا · ${ready} وثيقة متاحة`, `${chapters.length} chapters · ${ready} document(s) available`)}
          </p>
          {parts.map(([part, list]) => (
            <section key={part} className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">{part}</h2>
              <ul className="divide-y rounded-xl border bg-card">
                {list.map((c) => {
                  const docs = (c.docs || []).filter((d) => d.kind === kind);
                  return (
                    <li key={c.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-sm font-medium">{c.title}</span>
                      {docs.length === 0 ? (
                        <span className="w-fit rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{tr("Bientôt", "قريبا", "Soon")}</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {docs.map((d) => (
                            <span key={d.file} className="flex flex-wrap items-center gap-2">
                              {d.withSolution && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">{tr("Avec corrigé", "مع التصحيح", "With solution")}</span>}
                              <button type="button" onClick={() => setPreview(d)} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 text-sm hover:bg-accent">
                                <Eye className="h-4 w-4" />{tr("Voir", "عرض", "View")}
                              </button>
                              <a href={d.file} download className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">
                                <Download className="h-4 w-4" />PDF
                              </a>
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/70 p-2 sm:p-6" role="dialog" aria-modal="true" aria-label={preview.title}>
          <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-background">
            <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
              <span className="truncate text-sm font-semibold">{preview.title}</span>
              <div className="flex items-center gap-2">
                <a href={preview.file} download className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 text-sm"><Download className="h-4 w-4" />PDF</a>
                <button type="button" onClick={() => setPreview(null)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-accent" aria-label={tr("Fermer", "إغلاق", "Close")}><X className="h-5 w-5" /></button>
              </div>
            </div>
            <iframe src={preview.file} title={preview.title} className="h-full w-full flex-1" />
          </div>
        </div>
      )}
    </div>
  );
}

"use client";
/**
 * Cours / Exercices / Exams proposés d'une classe : catalogue de documents originaux
 * rangé selon le programme officiel, filtré par le niveau et la matière de la classe.
 * Le niveau et la matière sont ceux de la classe (rooms.level / rooms.subject). Sans la
 * migration, ils sont devinés depuis le nom et modifiables (mémorisés sur cet appareil).
 * Chaque PDF reçoit en tête le nom du professeur et du lycée.
 */
import { useEffect, useMemo, useState } from "react";
import { useParams } from "@/lib/router";
import { useCourses } from "@/contexts/CourseContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { BookOpen, ClipboardCheck, Download, Eye, FileText, Loader2, Pencil, Search, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ClassSetupDialog } from "@/components/classes/ClassSetupDialog";
import { useTeacherSchool } from "@/lib/proposed/teacherSchool";
import { fileNameOf, stampedPdfUrl } from "@/lib/proposed/stamp";
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
  const { user } = useAuth();
  const teacherSchool = useTeacherSchool(user?.id);
  const school = room?.school_name || teacherSchool;
  /** la base a les colonnes niveau / matière */
  const fromDb = room ? room.level !== undefined : false;
  const [setupOpen, setSetupOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const open = async (d: ProposedDoc, mode: "view" | "download") => {
    setBusy(d.file + mode);
    const url = await stampedPdfUrl(d.file, user?.name, school);
    setBusy(null);
    if (mode === "view") { setPreviewUrl(url); setPreview(d); return; }
    const a = document.createElement("a");
    a.href = url; a.download = fileNameOf(d.file);
    document.body.appendChild(a); a.click(); a.remove();
  };

  const [level, setLevel] = useState<LevelKey | "">("");
  const [subject, setSubject] = useState<SubjectKey | "">("");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<ProposedDoc | null>(null);

  useEffect(() => {
    if (fromDb) { setLevel((room?.level as LevelKey) || ""); setSubject((room?.subject as SubjectKey) || ""); return; }
    const saved = readChoice(roomId);
    const guess = guessFromRoom(room?.name, room?.description);
    setLevel(saved.level || guess.level || "");
    setSubject(saved.subject || guess.subject || "pc");
  }, [roomId, room?.name, room?.description, room?.level, room?.subject, fromDb]);

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
        {fromDb ? (
          <div className="flex min-w-[220px] flex-[2] flex-col gap-1 text-xs font-medium text-muted-foreground">
            {tr("Classe", "القسم", "Class")}
            <div className="flex min-h-[40px] flex-wrap items-center gap-2 text-sm text-foreground">
              <span className="font-semibold">{room?.name}</span>
              {level && <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{L(LEVELS.find((l) => l.key === level)!.label)}</span>}
              {subject && <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs">{L(SUBJECTS.find((x) => x.key === subject)!.label)}</span>}
              {school && <span className="text-xs text-muted-foreground">· {school}</span>}
              <button type="button" onClick={() => setSetupOpen(true)} className="inline-flex min-h-[32px] items-center gap-1 rounded-md px-2 text-xs text-primary hover:bg-accent">
                <Pencil className="h-3.5 w-3.5" />{tr("Modifier", "تعديل", "Edit")}
              </button>
            </div>
          </div>
        ) : (<>
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
        </>)}
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
          {tr("Indiquez le niveau et la matière de la classe pour voir les documents proposés.", "حدد مستوى ومادة القسم لعرض الوثائق المقترحة.", "Set the class level and subject to see suggested documents.")}
          {fromDb && (
            <button type="button" onClick={() => setSetupOpen(true)} className="mx-auto mt-3 flex min-h-[40px] items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
              {tr("Choisir le niveau et la matière", "اختيار المستوى والمادة", "Set level and subject")}
            </button>
          )}
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
                              <button type="button" disabled={!!busy} onClick={() => open(d, "view")} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 text-sm hover:bg-accent disabled:opacity-60">
                                {busy === d.file + "view" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}{tr("Voir", "عرض", "View")}
                              </button>
                              <button type="button" disabled={!!busy} onClick={() => open(d, "download")} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-60">
                                {busy === d.file + "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}PDF
                              </button>
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
                <a href={previewUrl || preview.file} download={fileNameOf(preview.file)} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 text-sm"><Download className="h-4 w-4" />PDF</a>
                <button type="button" onClick={() => setPreview(null)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-accent" aria-label={tr("Fermer", "إغلاق", "Close")}><X className="h-5 w-5" /></button>
              </div>
            </div>
            <iframe src={previewUrl || preview.file} title={preview.title} className="h-full w-full flex-1" />
          </div>
        </div>
      )}

      {fromDb && <ClassSetupDialog open={setupOpen} onOpenChange={setSetupOpen} onlyRoomId={roomId} />}
    </div>
  );
}

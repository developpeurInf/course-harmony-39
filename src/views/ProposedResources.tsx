"use client";
/**
 * Cours / Exercices / Exams proposés d'une classe : catalogue de documents originaux
 * rangé selon le programme officiel, filtré par le niveau et la matière de la classe.
 * Le niveau et la matière sont ceux de la classe (rooms.level / rooms.subject). Sans la
 * migration, ils sont devinés depuis le nom et modifiables (mémorisés sur cet appareil).
 * Chaque PDF reçoit en tête, sur chaque page, le professeur à gauche, le lycée à droite et le
 * numéro de chapitre au centre. Ce numéro suit l'ordre choisi par le professeur (réorganisable).
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "@/lib/router";
import { useCourses } from "@/contexts/CourseContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowDown, ArrowRight, ArrowUp, BookOpen, ListOrdered, RotateCcw, ClipboardCheck, Download, Eye, FileText, Loader2, Pencil, Search, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ClassSetupDialog } from "@/components/classes/ClassSetupDialog";
import { useTeacherSchool } from "@/lib/proposed/teacherSchool";
import { fileNameOf, stampedPdfUrl } from "@/lib/proposed/stamp";
import { chapterLabel, useChapterOrder, type NumberedChapter } from "@/lib/proposed/order";
import { ExamGenerator } from "@/components/proposed/ExamGenerator";
import {
  KIND_LABEL, LEVELS, SUBJECTS, guessFromRoom,
  type LevelKey, type ProposedDoc, type ProposedKind, type SubjectKey,
} from "@/lib/proposed/catalog";

const KIND_ICON = { course: BookOpen, exercise: FileText, exam: ClipboardCheck } as const;
/** page de chaque type de document, pour passer de l'un à l'autre */
const KIND_PATH: Record<ProposedKind, string> = { course: "proposed-courses", exercise: "proposed-exercises", exam: "proposed-exams" };
const KINDS: ProposedKind[] = ["course", "exercise", "exam"];
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
  const [previewName, setPreviewName] = useState<string>("");
  const [reorder, setReorder] = useState(false);

  const open = async (d: ProposedDoc, c: NumberedChapter, mode: "view" | "download") => {
    setBusy(d.file + mode);
    const url = await stampedPdfUrl(d.file, user?.name, school, chapterLabel(c));
    setBusy(null);
    if (mode === "view") { setPreviewUrl(url); setPreview(d); setPreviewName(`ch${c.num}-${fileNameOf(d.file)}`); return; }
    const a = document.createElement("a");
    a.href = url; a.download = `ch${c.num}-${fileNameOf(d.file)}`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const [level, setLevel] = useState<LevelKey | "">("");
  const [subject, setSubject] = useState<SubjectKey | "">("");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<ProposedDoc | null>(null);
  /** chapitre ouvert depuis une autre page (?ch=…) : on le fait défiler et on le met en évidence */
  const [focusCh, setFocusCh] = useState<string>("");
  useEffect(() => {
    try { setFocusCh(new URLSearchParams(window.location.search).get("ch") || ""); } catch { /* pas de fenêtre */ }
  }, []);

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

  /** chapitres dans l'ordre du professeur : le numéro affiché est celui tamponné dans les PDF */
  const order = useChapterOrder(user?.id, level, subject);
  const chapters = useMemo(() => {
    const q = query.trim().toLowerCase();
    return order.chapters.filter((c) => !q || c.title.toLowerCase().includes(q) || c.part.toLowerCase().includes(q));
  }, [order.chapters, query]);

  useEffect(() => {
    if (!focusCh || chapters.length === 0) return;
    const el = document.getElementById(`ch-${focusCh}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusCh, chapters.length]);

  const countOf = (k: ProposedKind) => chapters.reduce((n, c) => n + (c.docs || []).filter((d) => d.kind === k).length, 0);
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

      <nav className="flex flex-wrap gap-2" aria-label={tr("Documents proposés", "الوثائق المقترحة", "Suggested documents")}>
        {KINDS.map((k) => {
          const KI = KIND_ICON[k];
          const active = k === kind;
          return (
            <Link key={k} to={`/rooms/${roomId}/${KIND_PATH[k]}`} aria-current={active ? "page" : undefined}
              className={active ? "inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground" : "inline-flex min-h-[40px] items-center gap-2 rounded-lg border bg-card px-3 text-sm hover:bg-accent"}>
              <KI className="h-4 w-4" />{L(KIND_LABEL[k])}
              {level && <span className={active ? "rounded-full bg-primary-foreground/20 px-1.5 text-xs" : "rounded-full bg-muted px-1.5 text-xs text-muted-foreground"}>{countOf(k)}</span>}
            </Link>
          );
        })}
      </nav>

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

      {kind === "exam" && level && subject && (
        <ExamGenerator level={level} subject={subject} chapters={order.chapters} teacher={user?.name} school={school} roomName={room?.name} />
      )}

      {!level ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {tr("Indiquez le niveau et la matière de la classe pour voir les documents proposés.", "حدد مستوى ومادة القسم لعرض الوثائق المقترحة.", "Set the class level and subject to see suggested documents.")}
          {fromDb && (
            <button type="button" onClick={() => setSetupOpen(true)} className="mx-auto mt-3 flex min-h-[40px] items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
              {tr("Choisir le niveau et la matière", "اختيار المستوى والمادة", "Set level and subject")}
            </button>
          )}
        </p>
      ) : chapters.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {query
            ? tr("Aucun chapitre ne correspond.", "لا يوجد درس مطابق.", "No matching chapter.")
            : tr("Le programme de cette matière arrive bientôt.", "برنامج هذه المادة قريبا.", "This subject's curriculum is coming soon.")}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {tr(`${chapters.length} chapitres · ${ready} document(s) disponible(s)`, `${chapters.length} درسا · ${ready} وثيقة متاحة`, `${chapters.length} chapters · ${ready} document(s) available`)}
              {order.custom && <span> · {tr("ordre personnalisé", "ترتيب شخصي", "custom order")}</span>}
            </p>
            <span className="flex flex-wrap gap-2">
              {reorder && order.custom && (
                <button type="button" onClick={order.reset} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 text-sm hover:bg-accent">
                  <RotateCcw className="h-4 w-4" />{tr("Ordre du programme", "ترتيب البرنامج", "Curriculum order")}
                </button>
              )}
              <button type="button" onClick={() => { setReorder((v) => !v); setQuery(""); }} aria-pressed={reorder}
                className={reorder ? "inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground" : "inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 text-sm hover:bg-accent"}>
                <ListOrdered className="h-4 w-4" />{reorder ? tr("Terminer", "إنهاء", "Done") : tr("Changer l'ordre des chapitres", "تغيير ترتيب الدروس", "Reorder chapters")}
              </button>
            </span>
          </div>
          {reorder && (
            <p className="rounded-lg bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              {tr("Déplacez les chapitres avec les flèches. Le numéro choisi est imprimé en tête de chaque page du cours complet, du résumé et des exercices de ce chapitre.",
                "رتّب الدروس بالأسهم. يُطبع الرقم المختار في أعلى كل صفحة من الدرس الكامل والملخص والتمارين.",
                "Move chapters with the arrows. The number is printed at the top of every page of the chapter's full course, summary and exercises.")}
            </p>
          )}
          {(
            <section className="space-y-2">
              <ul className="divide-y rounded-xl border bg-card">
                {chapters.map((c, idx) => {
                  const docs = (c.docs || []).filter((d) => d.kind === kind);
                  const others = KINDS.filter((k) => k !== kind).map((k) => ({ k, n: (c.docs || []).filter((d) => d.kind === k).length })).filter((o) => o.n > 0);
                  return (
                    <li key={c.id} id={`ch-${c.id}`} className={`flex scroll-mt-24 flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between ${focusCh === c.id ? "bg-primary/5 ring-2 ring-inset ring-primary/40" : ""}`}>
                      <span className="flex items-start gap-3">
                        {reorder && !query && (
                          <span className="flex flex-col">
                            <button type="button" disabled={idx === 0} onClick={() => order.move(c.id, -1)} aria-label={tr("Monter", "إلى الأعلى", "Move up")} className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                            <button type="button" disabled={idx === chapters.length - 1} onClick={() => order.move(c.id, 1)} aria-label={tr("Descendre", "إلى الأسفل", "Move down")} className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                          </span>
                        )}
                        <span className="mt-0.5 inline-flex h-7 min-w-[28px] shrink-0 items-center justify-center rounded-md bg-primary/10 px-1.5 text-xs font-semibold text-primary">{c.num}</span>
                      <span className="flex flex-col gap-1">
                        <span className="text-sm font-medium">{tr(`Chapitre ${c.num} · `, `الدرس ${c.num} · `, `Chapter ${c.num} · `)}{c.title}</span>
                        <span className="text-[11px] text-muted-foreground">{c.part}</span>
                        {others.length > 0 && (
                          <span className="flex flex-wrap gap-x-3 gap-y-1">
                            {others.map(({ k, n }) => (
                              <Link key={k} to={`/rooms/${roomId}/${KIND_PATH[k]}?ch=${encodeURIComponent(c.id)}`} className="inline-flex min-h-[28px] items-center gap-1 text-xs text-primary hover:underline">
                                {L(KIND_LABEL[k])} ({n})<ArrowRight className="h-3 w-3 rtl:rotate-180" />
                              </Link>
                            ))}
                          </span>
                        )}
                      </span>
                      </span>
                      {reorder ? null : docs.length === 0 ? (
                        <span className="w-fit rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{tr("Bientôt", "قريبا", "Soon")}</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {docs.map((d) => (
                            <span key={d.file} className="flex flex-wrap items-center gap-2">
                              {d.variant && <span className={d.variant === "full" ? "rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary" : "rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"}>{d.variant === "full" ? tr("Cours complet", "درس كامل", "Full course") : tr("Résumé", "ملخص", "Summary")}</span>}
                              {d.withSolution && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">{tr("Avec corrigé", "مع التصحيح", "With solution")}</span>}
                              <button type="button" disabled={!!busy} onClick={() => open(d, c, "view")} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 text-sm hover:bg-accent disabled:opacity-60">
                                {busy === d.file + "view" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}{tr("Voir", "عرض", "View")}
                              </button>
                              <button type="button" disabled={!!busy} onClick={() => open(d, c, "download")} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-60">
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
          )}
        </>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/70 p-2 sm:p-6" role="dialog" aria-modal="true" aria-label={preview.title}>
          <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-background">
            <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
              <span className="truncate text-sm font-semibold">{preview.title}</span>
              <div className="flex items-center gap-2">
                <a href={previewUrl || preview.file} download={previewName || fileNameOf(preview.file)} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 text-sm"><Download className="h-4 w-4" />PDF</a>
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

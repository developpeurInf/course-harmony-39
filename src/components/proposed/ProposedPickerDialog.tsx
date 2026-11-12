"use client";
/**
 * Choisir des PDF parmi les cours / exercices / exams proposés pour les joindre à un cours,
 * un exercice ou un exam. Les fichiers sont tamponnés (professeur, lycée, numéro de chapitre
 * dans l'ordre du professeur) puis rendus comme des fichiers choisis sur l'ordinateur.
 */
import { useEffect, useMemo, useState } from "react";
import { useParams } from "@/lib/router";
import { BookOpen, Check, ClipboardCheck, FileText, Library, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses } from "@/contexts/CourseContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTeacherSchool } from "@/lib/proposed/teacherSchool";
import { fileNameOf, stampedPdfFile } from "@/lib/proposed/stamp";
import { chapterLabel, useChapterOrder } from "@/lib/proposed/order";
import { KIND_LABEL, LEVELS, SUBJECTS, guessFromRoom, type LevelKey, type ProposedDoc, type ProposedKind, type SubjectKey } from "@/lib/proposed/catalog";

const KIND_ICON = { course: BookOpen, exercise: FileText, exam: ClipboardCheck } as const;
const KINDS: ProposedKind[] = ["course", "exercise", "exam"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** onglet ouvert au départ */
  defaultKind?: ProposedKind;
  /** classe concernée (sinon celle de l'adresse) */
  roomId?: string;
  onPick: (files: File[]) => void;
}

export function ProposedPickerDialog({ open, onOpenChange, defaultKind = "course", roomId: roomProp, onPick }: Props) {
  const params = useParams<{ roomId: string }>();
  const roomId = roomProp || params.roomId || "";
  const { rooms } = useCourses();
  const { user } = useAuth();
  const { language } = useLanguage();
  const L = (v: [string, string, string]) => (language === "ar" ? v[1] : language === "en" ? v[2] : v[0]);
  const tr = (fr: string, ar: string, en: string) => L([fr, ar, en]);
  const room = rooms.find((r) => r.id === roomId);
  const teacherSchool = useTeacherSchool(user?.id);
  const school = room?.school_name || teacherSchool;

  const [kind, setKind] = useState<ProposedKind>(defaultKind);
  const [level, setLevel] = useState<LevelKey | "">("");
  const [subject, setSubject] = useState<SubjectKey | "">("");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKind(defaultKind); setPicked(new Set()); setQuery("");
    let saved: { level?: LevelKey; subject?: SubjectKey } = {};
    try { saved = JSON.parse(localStorage.getItem(`proposed:${roomId}`) || "{}"); } catch { /* rien */ }
    const guess = guessFromRoom(room?.name, room?.description);
    setLevel((room?.level as LevelKey) || saved.level || guess.level || "");
    setSubject((room?.subject as SubjectKey) || saved.subject || guess.subject || "pc");
  }, [open, defaultKind, roomId, room?.level, room?.subject, room?.name, room?.description]);

  const order = useChapterOrder(user?.id, level, subject);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return order.chapters
      .filter((c) => !q || c.title.toLowerCase().includes(q) || c.part.toLowerCase().includes(q))
      .map((c) => ({ c, docs: (c.docs || []).filter((d) => d.kind === kind) }))
      .filter((r) => r.docs.length > 0);
  }, [order.chapters, kind, query]);
  const countOf = (k: ProposedKind) => order.chapters.reduce((n, c) => n + (c.docs || []).filter((d) => d.kind === k).length, 0);

  const toggle = (file: string) => setPicked((p) => { const n = new Set(p); if (n.has(file)) n.delete(file); else n.add(file); return n; });

  const docLabel = (d: ProposedDoc) => d.kind === "course"
    ? (d.variant === "full" ? tr("Cours complet", "درس كامل", "Full course") : tr("Résumé", "ملخص", "Summary"))
    : d.kind === "exercise" ? tr("Série d'exercices corrigés", "سلسلة تمارين مصححة", "Exercises with solutions") : tr("Exam", "امتحان", "Exam");

  const confirm = async () => {
    const chosen = order.chapters.flatMap((c) => (c.docs || []).filter((d) => picked.has(d.file)).map((d) => ({ c, d })));
    if (!chosen.length) return;
    setBusy(true);
    try {
      const files = await Promise.all(chosen.map(({ c, d }) =>
        stampedPdfFile(d.file, `ch${c.num}-${fileNameOf(d.file)}`, user?.name, school, chapterLabel(c))));
      onPick(files);
      onOpenChange(false);
    } catch (e) {
      console.warn("[proposés] ajout impossible", e);
      toast.error(tr("Impossible de récupérer ce document.", "تعذر جلب هذه الوثيقة.", "Could not fetch this document."));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Library className="h-5 w-5 text-primary" />{tr("Ajouter depuis les documents proposés", "إضافة من الوثائق المقترحة", "Add from suggested documents")}</DialogTitle>
          <DialogDescription>{tr("Les PDF sont ajoutés avec votre nom, votre lycée et le numéro de chapitre de votre progression.", "تضاف الملفات باسمك وثانويتك ورقم الدرس حسب ترتيبك.", "PDFs are added with your name, school and chapter number from your order.")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => {
            const KI = KIND_ICON[k];
            const active = k === kind;
            return (
              <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={active}
                className={active ? "inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground" : "inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 text-sm hover:bg-accent"}>
                <KI className="h-4 w-4" />{L(KIND_LABEL[k])}<span className="text-xs opacity-80">({countOf(k)})</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <select value={level} onChange={(e) => setLevel(e.target.value as LevelKey)} aria-label={tr("Niveau", "المستوى", "Level")} className="h-9 min-w-[150px] flex-1 rounded-md border bg-background px-2 text-sm">
            <option value="">{tr("Choisir le niveau", "اختر المستوى", "Choose level")}</option>
            {LEVELS.map((l) => <option key={l.key} value={l.key}>{L(l.label)}</option>)}
          </select>
          <select value={subject} onChange={(e) => setSubject(e.target.value as SubjectKey)} aria-label={tr("Matière", "المادة", "Subject")} className="h-9 min-w-[150px] flex-1 rounded-md border bg-background px-2 text-sm">
            {SUBJECTS.map((x) => <option key={x.key} value={x.key}>{L(x.label)}</option>)}
          </select>
          <span className="relative min-w-[180px] flex-[2]">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr("Rechercher un chapitre", "ابحث عن درس", "Search a chapter")} className="h-9 w-full rounded-md border bg-background ps-8 pe-2 text-sm" />
          </span>
        </div>

        <div className="min-h-[160px] flex-1 overflow-y-auto rounded-lg border">
          {!level ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{tr("Choisissez le niveau et la matière.", "اختر المستوى والمادة.", "Choose the level and subject.")}</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{tr("Aucun document de ce type pour l'instant.", "لا توجد وثائق من هذا النوع حاليا.", "No document of this type yet.")}</p>
          ) : (
            <ul className="divide-y">
              {rows.map(({ c, docs }) => (
                <li key={c.id} className="space-y-1.5 p-3">
                  <p className="text-sm font-medium">{tr(`Chapitre ${c.num} · `, `الدرس ${c.num} · `, `Chapter ${c.num} · `)}{c.title}</p>
                  <div className="flex flex-wrap gap-2">
                    {docs.map((d) => {
                      const on = picked.has(d.file);
                      return (
                        <button key={d.file} type="button" onClick={() => toggle(d.file)} aria-pressed={on}
                          className={on ? "inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-primary bg-primary/10 px-3 text-xs font-semibold text-primary" : "inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border px-3 text-xs hover:bg-accent"}>
                          {on ? <Check className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}{docLabel(d)}
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{tr("Annuler", "إلغاء", "Cancel")}</Button>
          <Button type="button" onClick={confirm} disabled={busy || picked.size === 0}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {tr(`Ajouter (${picked.size})`, `إضافة (${picked.size})`, `Add (${picked.size})`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

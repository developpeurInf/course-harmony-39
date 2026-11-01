"use client";

/**
 * Tableaux blancs d'une classe (/rooms/:roomId/whiteboard) ou de toutes ses classes (/whiteboards).
 * Professeur : créer, ouvrir, renommer, partager (privé / lecture / collaboratif), dupliquer, supprimer.
 * Élève : tableaux partagés par ses professeurs.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Eye, Lock, MoreVertical, PenLine, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses } from "@/contexts/CourseContext";
import { useNavigate } from "@/lib/router";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTr } from "@/components/meet/useTr";
import { cachedBoards, createBoard, deleteBoard, duplicateBoard, listBoards, missingTable, updateBoard, type BoardSummary, type Share } from "@/lib/whiteboards";

export default function Whiteboards({ roomId }: { roomId?: string } = {}) {
  const { user } = useAuth();
  const { rooms } = useCourses();
  const navigate = useNavigate();
  const { tr, dir, locale } = useTr();
  const isTeacher = user?.role === "professor";
  const [items, setItems] = useState<BoardSummary[] | null>(() => cachedBoards(roomId));
  const [missing, setMissing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<BoardSummary | null>(null);
  const [toDelete, setToDelete] = useState<BoardSummary | null>(null);
  const room = roomId ? (rooms || []).find(r => r.id === roomId) : null;
  const myRooms = useMemo(
    () => (isTeacher ? (rooms || []).filter(r => r.professor_id === user?.id && !r.archived_at).sort((a, b) => a.name.localeCompare(b.name, "fr")) : []),
    [rooms, isTeacher, user?.id],
  );
  const roomName = (id: string) => (rooms || []).find(r => r.id === id)?.name || "";

  const load = useCallback(async () => {
    try {
      setItems(await listBoards(roomId));
      setMissing(false);
    } catch (e: any) {
      setItems(cur => cur ?? []);
      if (missingTable(e)) setMissing(true);
      else toast.error(e?.message || "");
    }
  }, [roomId]);
  useEffect(() => {
    void load();
    const onVis = () => !document.hidden && void load();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);

  const open = (b: BoardSummary) => navigate(`/whiteboard/${b.id}`);
  const create = async (rid: string, title: string) => {
    if (!user) return;
    try {
      const b = await createBoard(rid, user.id, title);
      navigate(`/whiteboard/${b.id}`);
    } catch (e: any) {
      toast.error(missingTable(e) ? tr("Lancez d'abord la migration SQL des tableaux blancs.", "شغّل أولا ترحيل SQL الخاص بالسبورات.", "Run the whiteboards SQL migration first.") : e?.message || "");
    }
  };
  const setShare = async (b: BoardSummary, share: Share) => {
    setItems(l => (l || []).map(x => (x.id === b.id ? { ...x, share } : x)));
    try {
      await updateBoard(b.id, { share });
    } catch (e: any) {
      toast.error(e?.message || "");
      void load();
    }
  };

  const shares: Record<Share, { icon: any; label: string; hint: string; tone: string }> = {
    private: { icon: Lock, label: tr("Privé", "خاص", "Private"), hint: tr("Visible par vous seul", "مرئي لك وحدك", "Only you"), tone: "bg-muted text-muted-foreground" },
    view: { icon: Eye, label: tr("Lecture", "قراءة", "View"), hint: tr("Les élèves de la classe peuvent le voir", "يمكن لتلاميذ القسم رؤيته", "Students of the class can view it"), tone: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
    edit: { icon: Users, label: tr("Collaboratif", "تشاركي", "Collaborative"), hint: tr("Les élèves peuvent aussi écrire", "يمكن للتلاميذ الكتابة أيضا", "Students can write too"), tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  };

  return (
    <div dir={dir} className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{tr("Tableau blanc", "السبورة البيضاء", "Whiteboard")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isTeacher
              ? room
                ? tr(`Les tableaux de la classe ${room.name}. Enregistrés automatiquement, à partager avec vos élèves.`, `سبورات القسم ${room.name}. تحفظ تلقائيا ويمكن مشاركتها مع تلاميذك.`, `Boards of ${room.name}. Saved automatically, shareable with your students.`)
                : tr("Tous vos tableaux, classe par classe.", "جميع سبوراتك، قسما بقسم.", "All your boards, class by class.")
              : tr("Les tableaux partagés par vos professeurs.", "السبورات التي يشاركها أساتذتك.", "Boards shared by your teachers.")}
          </p>
        </div>
        {isTeacher && (
          <button
            type="button"
            onClick={() => (roomId ? void create(roomId, tr("Nouveau tableau", "سبورة جديدة", "New board")) : setCreating(true))}
            disabled={!roomId && myRooms.length === 0}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {tr("Nouveau tableau", "سبورة جديدة", "New board")}
          </button>
        )}
      </div>

      {missing && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          {tr(
            "Les tableaux blancs ne sont pas encore installés : lancez le fichier supabase/migrations/20261118090000_class_whiteboards.sql dans le SQL Editor de Supabase.",
            "السبورات البيضاء غير مثبتة بعد: شغّل الملف 20261118090000_class_whiteboards.sql في محرر SQL الخاص بـ Supabase.",
            "Whiteboards are not installed yet: run supabase/migrations/20261118090000_class_whiteboards.sql in the Supabase SQL Editor.",
          )}
        </div>
      )}

      {items === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-60 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <PenLine className="h-7 w-7" />
          </span>
          <p className="font-semibold">{isTeacher ? tr("Aucun tableau pour l'instant", "لا توجد سبورة بعد", "No boards yet") : tr("Aucun tableau partagé", "لا توجد سبورة مشتركة", "No shared boards")}</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {isTeacher
              ? tr("Préparez un cours, expliquez une notion ou faites travailler la classe ensemble sur une page infinie.", "حضّر درسا أو اشرح مفهوما أو اجعل القسم يعمل معا على صفحة لا نهائية.", "Prepare a lesson, explain a concept or get the class working together on an infinite page.")
              : tr("Quand votre professeur partagera un tableau, il apparaîtra ici.", "عندما يشارك أستاذك سبورة، ستظهر هنا.", "When your teacher shares a board, it will appear here.")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(b => {
            const sh = shares[b.share] || shares.view;
            const ShIcon = sh.icon;
            const mine = isTeacher;
            return (
              <div key={b.id} className="group relative overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <button type="button" onClick={() => open(b)} className="block w-full text-start" aria-label={b.title}>
                  <div
                    className="relative aspect-[16/10] w-full overflow-hidden border-b bg-[#fbfbf8]"
                    style={!b.thumb ? { backgroundImage: "radial-gradient(rgba(28,34,48,.16) 1.2px, transparent 1.2px)", backgroundSize: "18px 18px" } : undefined}
                  >
                    {b.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.thumb} alt="" className="h-full w-full object-contain" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-400">
                        <PenLine className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5 p-3.5">
                    <p className="truncate pe-8 font-semibold">{b.title}</p>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium", sh.tone)}>
                        <ShIcon className="h-3 w-3" />
                        {sh.label}
                      </span>
                      {!roomId && <span className="truncate">{roomName(b.room_id)}</span>}
                      <span>· {new Date(b.updated_at).toLocaleDateString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                </button>
                {mine && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="absolute bottom-3 end-2 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={tr("Actions", "إجراءات", "Actions")}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuItem onClick={() => setRenaming(b)}>
                        <Pencil className="me-2 h-4 w-4" />
                        {tr("Renommer", "إعادة التسمية", "Rename")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={async () => {
                          if (!user) return;
                          try {
                            const c = await duplicateBoard(b.id, user.id, tr("(copie)", "(نسخة)", "(copy)"));
                            setItems(l => [c, ...(l || [])]);
                          } catch (e: any) {
                            toast.error(e?.message || "");
                          }
                        }}
                      >
                        <Copy className="me-2 h-4 w-4" />
                        {tr("Dupliquer", "تكرار", "Duplicate")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-muted-foreground">{tr("Partage avec les élèves", "المشاركة مع التلاميذ", "Sharing with students")}</DropdownMenuLabel>
                      {(Object.keys(shares) as Share[]).map(k => {
                        const S = shares[k];
                        const Ic = S.icon;
                        return (
                          <DropdownMenuItem key={k} onClick={() => void setShare(b, k)} className="items-start">
                            <Ic className="me-2 mt-0.5 h-4 w-4" />
                            <span className="flex-1">
                              <span className={cn("block", b.share === k && "font-semibold")}>{S.label}</span>
                              <span className="block text-xs text-muted-foreground">{S.hint}</span>
                            </span>
                            {b.share === k && <span className="ms-2 mt-1.5 h-2 w-2 rounded-full bg-primary" />}
                          </DropdownMenuItem>
                        );
                      })}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-rose-600 focus:text-rose-600" onClick={() => setToDelete(b)}>
                        <Trash2 className="me-2 h-4 w-4" />
                        {tr("Supprimer", "حذف", "Delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* nouveau tableau (vue toutes classes) */}
      <TitleDialog
        open={creating}
        onOpenChange={setCreating}
        title={tr("Nouveau tableau", "سبورة جديدة", "New board")}
        initial={tr("Nouveau tableau", "سبورة جديدة", "New board")}
        rooms={myRooms.map(r => ({ id: r.id, name: r.name }))}
        tr={tr}
        dir={dir}
        onSubmit={(t, rid) => {
          setCreating(false);
          if (rid) void create(rid, t);
        }}
      />
      <TitleDialog
        open={!!renaming}
        onOpenChange={o => !o && setRenaming(null)}
        title={tr("Renommer le tableau", "إعادة تسمية السبورة", "Rename board")}
        initial={renaming?.title || ""}
        tr={tr}
        dir={dir}
        onSubmit={async t => {
          const b = renaming;
          setRenaming(null);
          if (!b) return;
          setItems(l => (l || []).map(x => (x.id === b.id ? { ...x, title: t } : x)));
          try {
            await updateBoard(b.id, { title: t });
          } catch (e: any) {
            toast.error(e?.message || "");
            void load();
          }
        }}
      />
      <AlertDialog open={!!toDelete} onOpenChange={o => !o && setToDelete(null)}>
        <AlertDialogContent dir={dir}>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr("Supprimer ce tableau ?", "حذف هذه السبورة؟", "Delete this board?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tr(`« ${toDelete?.title} » sera supprimé pour vous et vos élèves.`, `سيتم حذف «${toDelete?.title}» لك ولتلاميذك.`, `"${toDelete?.title}" will be deleted for you and your students.`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr("Annuler", "إلغاء", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={async () => {
                const b = toDelete;
                setToDelete(null);
                if (!b) return;
                setItems(l => (l || []).filter(x => x.id !== b.id));
                try {
                  await deleteBoard(b.id);
                } catch (e: any) {
                  toast.error(e?.message || "");
                  void load();
                }
              }}
            >
              {tr("Supprimer", "حذف", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TitleDialog(props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  initial: string;
  rooms?: { id: string; name: string }[];
  tr: (fr: string, ar: string, en?: string) => string;
  dir: "rtl" | "ltr";
  onSubmit: (title: string, roomId?: string) => void;
}) {
  const { tr } = props;
  const [value, setValue] = useState(props.initial);
  const [rid, setRid] = useState(props.rooms?.[0]?.id || "");
  useEffect(() => {
    if (props.open) {
      setValue(props.initial);
      setRid(props.rooms?.[0]?.id || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-md" dir={props.dir}>
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={e => {
            e.preventDefault();
            if (value.trim()) props.onSubmit(value.trim(), rid || undefined);
          }}
        >
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">{tr("Titre", "العنوان", "Title")}</span>
            <input autoFocus value={value} maxLength={120} onChange={e => setValue(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm" />
          </label>
          {props.rooms && (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">{tr("Classe", "القسم", "Class")}</span>
              <select value={rid} onChange={e => setRid(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {props.rooms.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <DialogFooter>
            <button type="submit" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              {tr("Valider", "تأكيد", "OK")}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

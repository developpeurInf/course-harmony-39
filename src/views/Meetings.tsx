"use client";

/**
 * Réunions vidéo d'une classe (/rooms/:roomId/meet) ou de toutes ses classes (/meetings).
 * Professeur : démarrer tout de suite, planifier, modifier, annuler, rapport de présence, chat archivé.
 * Élève : réunion en direct à rejoindre, réunions à venir, réunions passées (chat).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CalendarPlus,
  ClipboardList,
  Clock,
  Copy,
  Lock,
  MessageSquare,
  MonitorUp,
  MoreVertical,
  Pencil,
  Play,
  Radio,
  ShieldCheck,
  Trash2,
  Users,
  Video,
  XCircle,
  PhoneOff,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useAccess } from "@/contexts/AccessContext";
import { useCourses } from "@/contexts/CourseContext";
import { useNavigate, useSearchParams } from "@/lib/router";
import { supabase } from "@/integrations/supabase/client";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { cachedMeetings, cancelMeeting, clock, debounce, deleteMeeting, formatDuration, listMeetings, moderate, onMeetingsCacheChange, patchCachedMeetings, preloadMeetingRoom, preloadWhenIdle, type Meeting } from "@/lib/meet";
import { ChatArchiveDialog, ReportDialog, ScheduleDialog } from "@/components/meet/MeetDialogs";
import { useTr } from "@/components/meet/useTr";
import "@/components/meet/meet.css";

export default function Meetings({ roomId }: { roomId?: string } = {}) {
  const { user } = useAuth();
  const { can } = useAccess();
  const { rooms } = useCourses();
  const navigate = useNavigate();
  const params = useSearchParams();
  const { tr, dir, locale, lang } = useTr();
  const isTeacher = user?.role === "professor";
  const allowed = !isTeacher || can("meet.host" as any);
  // Affichage immédiat avec la dernière liste connue, puis mise à jour en arrière-plan
  const [items, setItems] = useState<Meeting[] | null>(() => cachedMeetings(roomId || null));
  const [dialog, setDialog] = useState<null | { mode: "now" | "schedule"; edit?: Meeting | null }>(null);
  const [report, setReport] = useState<Meeting | null>(null);
  const [archive, setArchive] = useState<Meeting | null>(null);
  const [toDelete, setToDelete] = useState<Meeting | null>(null);
  const [filterRoom, setFilterRoom] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const myRooms = useMemo(
    () =>
      isTeacher
        ? (rooms || []).filter(r => r.professor_id === user?.id && !r.archived_at).map(r => ({ id: r.id, name: r.name })).sort((a, b) => a.name.localeCompare(b.name, "fr"))
        : [],
    [rooms, isTeacher, user?.id],
  );
  const room = roomId ? (rooms || []).find(r => r.id === roomId) : null;

  const load = useCallback(async () => {
    try {
      setItems(await listMeetings(roomId || null));
    } catch (e: any) {
      setItems(cur => cur ?? []);
      if (!/meet_list/.test(e?.message || "")) toast.error(e?.message || "");
    }
  }, [roomId]);

  useEffect(() => {
    void load();
    preloadWhenIdle();
    const soon = debounce(() => void load(), 350);
    // Pas d'appels quand l'onglet est caché ; rattrapage dès qu'il redevient visible
    const t = setInterval(() => !document.hidden && void load(), 30_000);
    const c = setInterval(() => !document.hidden && setNow(Date.now()), 15_000);
    const onVis = () => {
      if (!document.hidden) {
        setNow(Date.now());
        soon();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    const off = onMeetingsCacheChange(() => setItems(cachedMeetings(roomId || null)));
    const ch = supabase
      .channel(`meetings-${roomId || "all"}`)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "meetings", ...(roomId ? { filter: `room_id=eq.${roomId}` } : {}) }, () => soon())
      .subscribe();
    return () => {
      clearInterval(t);
      clearInterval(c);
      soon.cancel();
      off();
      document.removeEventListener("visibilitychange", onVis);
      void supabase.removeChannel(ch);
    };
  }, [load, roomId]);

  // Lien direct vers un rapport (?report=<id>) depuis la fin de réunion
  const reportParam = params?.get("report");
  useEffect(() => {
    if (reportParam && items) {
      const m = items.find(x => x.id === reportParam);
      if (m) setReport(m);
    }
  }, [reportParam, items]);

  const shown = (items || []).filter(m => !filterRoom || m.room_id === filterRoom);
  const live = shown.filter(m => m.status === "live");
  const upcoming = shown.filter(m => m.status === "scheduled");
  const past = shown.filter(m => m.status === "ended" || m.status === "cancelled");

  const copyLink = (m: Meeting) => {
    const url = `${window.location.origin}/meet/${m.id}`;
    void navigator.clipboard?.writeText(url).then(
      () => toast.success(tr("Lien copié : seuls les élèves de la classe peuvent l'ouvrir.", "تم نسخ الرابط: يمكن لتلاميذ القسم فقط فتحه.", "Link copied: only students of the class can open it.")),
      () => toast(url),
    );
  };
  /** Action avec mise à jour immédiate de l'écran ; annulée si le serveur refuse */
  const act = async (fn: () => Promise<void>, ok: string, optimistic?: (list: Meeting[]) => Meeting[]) => {
    const before = items;
    if (optimistic) {
      setItems(cur => (cur ? optimistic(cur) : cur));
      patchCachedMeetings(optimistic);
    }
    try {
      await fn();
      toast.success(ok);
      void load();
    } catch (e: any) {
      if (optimistic) setItems(before);
      toast.error(e?.message || "");
      void load();
    }
  };
  const setStatus = (id: string, status: Meeting["status"]) => (list: Meeting[]) =>
    list.map(x => (x.id === id ? { ...x, status, ended_at: status === "ended" ? new Date().toISOString() : x.ended_at } : x));
  const removeOne = (id: string) => (list: Meeting[]) => list.filter(x => x.id !== id);
  const open = (id: string) => navigate(`/meet/${id}`);

  return (
    <div dir={dir} className="mx-auto w-full max-w-5xl space-y-6">
      {/* En-tête */}
      <div className="relative overflow-hidden rounded-3xl border bg-card p-5 sm:p-7">
        <div className="meet-hero pointer-events-none absolute inset-0 opacity-80" aria-hidden="true" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Video className="h-4 w-4" />
              {room ? room.name : isTeacher ? tr("Toutes mes classes", "جميع أقسامي", "All my classes") : tr("Mes classes", "أقسامي", "My classes")}
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">{tr("Réunions en direct", "الاجتماعات المباشرة", "Live meetings")}</h1>
            <p className="mt-1.5 max-w-lg text-sm text-muted-foreground">
              {isTeacher
                ? tr(
                    "Faites cours en visio, présentez votre écran et discutez avec la classe. La présence est notée automatiquement.",
                    "قدّم الدرس عبر الفيديو، واعرض شاشتك، وتحدث مع القسم. يتم تسجيل الحضور تلقائيا.",
                    "Teach by video, present your screen and chat with the class. Attendance is recorded automatically.",
                  )
                : tr(
                    "Rejoignez les cours en direct de vos professeurs. Vous êtes prévenu dès qu'une réunion commence.",
                    "انضم إلى الحصص المباشرة لأساتذتك. يصلك إشعار بمجرد بدء اجتماع.",
                    "Join your teachers' live classes. You're notified as soon as a meeting starts.",
                  )}
            </p>
          </div>
          {isTeacher && allowed && myRooms.length > 0 && (
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDialog({ mode: "schedule" })}
                className="inline-flex h-11 items-center gap-2 rounded-full border bg-background px-4 text-sm font-semibold transition hover:bg-muted"
              >
                <CalendarPlus className="h-4 w-4" />
                {tr("Planifier", "برمجة", "Schedule")}
              </button>
              <button
                type="button"
                onClick={() => setDialog({ mode: "now" })}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-rose-600 px-5 text-sm font-semibold text-white shadow-lg shadow-rose-600/25 transition hover:bg-rose-700"
              >
                <Radio className="h-4 w-4" />
                {tr("Démarrer maintenant", "ابدأ الآن", "Start now")}
              </button>
            </div>
          )}
        </div>
        {isTeacher && !allowed && (
          <p className="relative mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <Lock className="h-4 w-4" />
            {tr("Les réunions vidéo ne sont pas incluses dans votre offre.", "اجتماعات الفيديو غير مضمنة في اشتراكك.", "Video meetings aren't included in your plan.")}
          </p>
        )}
      </div>

      {/* Filtre par classe (page générale) */}
      {!roomId && isTeacher && myRooms.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!filterRoom} onClick={() => setFilterRoom(null)}>
            {tr("Toutes", "الكل", "All")}
          </Chip>
          {myRooms.map(r => (
            <Chip key={r.id} active={filterRoom === r.id} onClick={() => setFilterRoom(r.id)}>
              {r.name}
            </Chip>
          ))}
        </div>
      )}

      {items === null ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted/60" />
          ))}
        </div>
      ) : (
        <>
          {/* En direct */}
          {live.map(m => (
            <div key={m.id} className="meet-live-card relative overflow-hidden rounded-3xl p-5 text-white shadow-xl sm:p-6">
              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                    </span>
                    {tr("En direct", "مباشر", "Live")} · <span className="tabular-nums">{clock(now - new Date(m.started_at || now).getTime())}</span>
                  </span>
                  <h2 className="mt-2 truncate text-xl font-semibold">{m.title}</h2>
                  <p className="mt-0.5 truncate text-sm text-white/80">
                    {!roomId && `${m.room_name} · `}
                    {isTeacher ? tr(`${m.online} connecté(s) maintenant`, `${m.online} متصل الآن`, `${m.online} connected now`) : tr(`avec ${m.host_name}`, `مع ${m.host_name}`, `with ${m.host_name}`)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isTeacher && (
                    <button type="button" onClick={() => copyLink(m)} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 hover:bg-white/25" aria-label={tr("Copier le lien", "نسخ الرابط", "Copy link")} title={tr("Copier le lien", "نسخ الرابط", "Copy link")}>
                      <Copy className="h-4 w-4" />
                    </button>
                  )}
                  {m.host_id === user?.id && (
                    <button
                      type="button"
                      onClick={() => void act(() => moderate(m.id, "end").then(() => undefined), tr("Réunion terminée pour tout le monde", "تم إنهاء الاجتماع للجميع", "Meeting ended for everyone"), setStatus(m.id, "ended"))}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
                      aria-label={tr("Terminer pour tout le monde", "إنهاء للجميع", "End for everyone")}
                      title={tr("Terminer pour tout le monde", "إنهاء للجميع", "End for everyone")}
                    >
                      <PhoneOff className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => open(m.id)} onPointerEnter={preloadMeetingRoom} onTouchStart={preloadMeetingRoom} onFocus={preloadMeetingRoom}
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-rose-700 shadow-lg transition hover:scale-[1.02]"
                  >
                    <Video className="h-4 w-4" />
                    {tr("Rejoindre", "انضمام", "Join")}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* À venir */}
          <Section title={tr("À venir", "القادمة", "Upcoming")} count={upcoming.length}>
            {upcoming.length === 0 ? (
              <Empty
                icon={CalendarClock}
                text={
                  isTeacher
                    ? tr("Aucune réunion planifiée. Planifiez-en une : les élèves sont prévenus.", "لا توجد اجتماعات مبرمجة. برمج واحدا وسيتم إشعار التلاميذ.", "No scheduled meetings. Schedule one and students are notified.")
                    : tr("Aucune réunion prévue pour l'instant.", "لا توجد اجتماعات مبرمجة حاليا.", "No meetings planned yet.")
                }
              />
            ) : (
              upcoming.map(m => {
                const d = new Date(m.scheduled_at || m.started_at || Date.now());
                const diff = d.getTime() - now;
                const soon = diff < 15 * 60_000;
                const late = diff < -m.duration_min * 60_000;
                return (
                  <Row key={m.id}>
                    <DateBadge d={d} locale={locale} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{m.title}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })} · {formatDuration(m.duration_min * 60, lang)}
                        </span>
                        {!roomId && <span>{m.room_name}</span>}
                        {!isTeacher && <span>{m.host_name}</span>}
                        {late ? (
                          <span className="font-medium text-amber-600 dark:text-amber-400">{tr("Pas encore démarrée", "لم تبدأ بعد", "Not started yet")}</span>
                        ) : (
                          <span className={cn(soon && "font-medium text-rose-600 dark:text-rose-400")}>{relative(diff, lang)}</span>
                        )}
                      </p>
                      {m.description && <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{m.description}</p>}
                    </div>
                    {isTeacher ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => open(m.id)} onPointerEnter={preloadMeetingRoom} onTouchStart={preloadMeetingRoom} onFocus={preloadMeetingRoom}
                          className={cn(
                            "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition",
                            soon ? "bg-rose-600 text-white hover:bg-rose-700" : "border hover:bg-muted",
                          )}
                        >
                          <Play className="h-3.5 w-3.5" />
                          {tr("Démarrer", "ابدأ", "Start")}
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label={tr("Actions", "إجراءات", "Actions")}>
                            <MoreVertical className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDialog({ mode: "schedule", edit: m })}>
                              <Pencil className="me-2 h-4 w-4" />
                              {tr("Modifier", "تعديل", "Edit")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyLink(m)}>
                              <Copy className="me-2 h-4 w-4" />
                              {tr("Copier le lien", "نسخ الرابط", "Copy link")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-rose-600 focus:text-rose-600"
                              onClick={() => void act(() => cancelMeeting(m.id), tr("Réunion annulée, les élèves sont prévenus", "تم إلغاء الاجتماع وإشعار التلاميذ", "Meeting cancelled, students notified"), setStatus(m.id, "cancelled"))}
                            >
                              <XCircle className="me-2 h-4 w-4" />
                              {tr("Annuler la réunion", "إلغاء الاجتماع", "Cancel meeting")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ) : (
                      <button type="button" onClick={() => open(m.id)} onPointerEnter={preloadMeetingRoom} onTouchStart={preloadMeetingRoom} onFocus={preloadMeetingRoom} className="shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium hover:bg-muted">
                        {tr("Ouvrir", "فتح", "Open")}
                      </button>
                    )}
                  </Row>
                );
              })
            )}
          </Section>

          {/* Passées */}
          <Section title={tr("Réunions passées", "الاجتماعات السابقة", "Past meetings")} count={past.length}>
            {past.length === 0 ? (
              <Empty icon={Video} text={tr("Les réunions terminées apparaîtront ici, avec leur chat et la présence.", "ستظهر هنا الاجتماعات المنتهية مع الدردشة والحضور.", "Finished meetings show up here with their chat and attendance.")} />
            ) : (
              past.map(m => {
                const start = m.started_at ? new Date(m.started_at) : m.scheduled_at ? new Date(m.scheduled_at) : null;
                const dur = m.started_at && m.ended_at ? (new Date(m.ended_at).getTime() - new Date(m.started_at).getTime()) / 1000 : 0;
                const cancelled = m.status === "cancelled";
                return (
                  <Row key={m.id} muted={cancelled}>
                    {start ? <DateBadge d={start} locale={locale} muted /> : <span className="w-12" />}
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate font-semibold", cancelled && "line-through decoration-1")}>{m.title}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        {cancelled ? (
                          <span>{tr("Annulée", "ملغاة", "Cancelled")}</span>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {formatDuration(dur, lang)}
                            </span>
                            {isTeacher ? (
                              <span className="inline-flex items-center gap-1">
                                <Users className="h-3.5 w-3.5" />
                                {tr(`${m.attendees} élève(s) présent(s)`, `${m.attendees} تلميذ حاضر`, `${m.attendees} student(s) attended`)}
                              </span>
                            ) : m.my_seconds > 0 ? (
                              <span className="text-emerald-600 dark:text-emerald-400">{tr(`Présent ${formatDuration(m.my_seconds, lang)}`, `حاضر ${formatDuration(m.my_seconds, lang)}`, `Attended ${formatDuration(m.my_seconds, lang)}`)}</span>
                            ) : (
                              <span>{tr("Absent", "غائب", "Absent")}</span>
                            )}
                          </>
                        )}
                        {!roomId && <span>{m.room_name}</span>}
                      </p>
                    </div>
                    {!cancelled && (
                      <div className="flex shrink-0 items-center gap-1">
                        {m.messages > 0 && (
                          <button type="button" onClick={() => setArchive(m)} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                            <MessageSquare className="h-4 w-4" />
                            <span className="tabular-nums">{m.messages}</span>
                          </button>
                        )}
                        {isTeacher && (
                          <button type="button" onClick={() => setReport(m)} className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium hover:bg-muted">
                            <ClipboardList className="h-4 w-4" />
                            <span className="hidden sm:inline">{tr("Présence", "الحضور", "Attendance")}</span>
                          </button>
                        )}
                      </div>
                    )}
                    {isTeacher && (
                      <button
                        type="button"
                        onClick={() => setToDelete(m)}
                        className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-rose-600"
                        aria-label={tr("Supprimer", "حذف", "Delete")}
                        title={tr("Supprimer", "حذف", "Delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </Row>
                );
              })
            )}
          </Section>

          {/* Ce qui est inclus */}
          {isTeacher && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Feature icon={MonitorUp} title={tr("Présentez votre écran", "اعرض شاشتك", "Present your screen")} text={tr("Une fenêtre, un onglet (avec le son) ou tout l'écran, net jusqu'en 1440p.", "نافذة أو تبويب (مع الصوت) أو الشاشة كاملة، بجودة تصل إلى 1440p.", "A window, a tab (with sound) or the whole screen, sharp up to 1440p.")} />
              <Feature icon={Users} title={tr("Gardez la main", "تحكم في القسم", "Stay in control")} text={tr("Mains levées dans l'ordre, couper les micros, retirer un élève, verrouiller.", "الأيدي المرفوعة بالترتيب، كتم الميكروفونات، إخراج تلميذ، إغلاق.", "Raised hands in order, mute, remove a student, lock.")} />
              <Feature icon={ShieldCheck} title={tr("Réservé à la classe", "خاص بالقسم", "Class only")} text={tr("Personne d'autre ne peut entrer, même avec le lien. Présence notée automatiquement.", "لا يمكن لأي شخص آخر الدخول حتى مع الرابط. يُسجل الحضور تلقائيا.", "No one else can get in, even with the link. Attendance is automatic.")} />
            </div>
          )}
        </>
      )}

      <ScheduleDialog
        open={!!dialog}
        onOpenChange={v => !v && setDialog(null)}
        rooms={myRooms}
        defaultRoom={roomId || filterRoom}
        lockRoom={!!roomId}
        mode={dialog?.mode || "now"}
        edit={dialog?.edit || null}
        onDone={(id, isLive) => {
          if (isLive) navigate(`/meet/${id}`);
          else {
            toast.success(tr("Réunion planifiée, les élèves sont prévenus", "تمت برمجة الاجتماع وإشعار التلاميذ", "Meeting scheduled, students notified"));
            void load();
          }
        }}
      />
      <AlertDialog open={!!toDelete} onOpenChange={v => !v && setToDelete(null)}>
        <AlertDialogContent dir={dir}>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr("Supprimer cette réunion ?", "حذف هذا الاجتماع؟", "Delete this meeting?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tr(
                "Son chat et son rapport de présence seront supprimés définitivement.",
                "سيتم حذف دردشته وتقرير حضوره نهائيا.",
                "Its chat and attendance report will be permanently deleted.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr("Annuler", "إلغاء", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => {
                const m = toDelete;
                setToDelete(null);
                if (m) void act(() => deleteMeeting(m.id), tr("Réunion supprimée", "تم حذف الاجتماع", "Meeting deleted"), removeOne(m.id));
              }}
            >
              {tr("Supprimer", "حذف", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ReportDialog meeting={report} onOpenChange={v => !v && setReport(null)} />
      <ChatArchiveDialog meeting={archive} onOpenChange={v => !v && setArchive(null)} me={user?.id || ""} />
    </div>
  );
}

function relative(ms: number, lang: string) {
  const min = Math.round(ms / 60_000);
  if (lang === "ar") {
    if (min <= 0) return "الآن";
    if (min < 60) return `بعد ${min} د`;
    const h = Math.round(min / 60);
    return h < 24 ? `بعد ${h} س` : `بعد ${Math.round(h / 24)} يوم`;
  }
  if (lang === "en") {
    if (min <= 0) return "now";
    if (min < 60) return `in ${min} min`;
    const h = Math.round(min / 60);
    return h < 24 ? `in ${h} h` : `in ${Math.round(h / 24)} d`;
  }
  if (min <= 0) return "maintenant";
  if (min < 60) return `dans ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `dans ${h} h` : `dans ${Math.round(h / 24)} j`;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("rounded-full border px-3 py-1.5 text-sm transition", active ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}
    >
      {children}
    </button>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 px-1 text-sm font-semibold text-muted-foreground">
        {title}
        {count > 0 && <span className="rounded-full bg-muted px-2 text-xs tabular-nums">{count}</span>}
      </h2>
      <div className="divide-y overflow-hidden rounded-2xl border bg-card">{children}</div>
    </section>
  );
}

function Row({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return <div className={cn("flex items-center gap-3 px-3 py-3 sm:gap-4 sm:px-4", muted && "opacity-60")}>{children}</div>;
}

function DateBadge({ d, locale, muted }: { d: Date; locale: string; muted?: boolean }) {
  return (
    <div className={cn("flex w-12 shrink-0 flex-col items-center rounded-xl py-1.5 text-center", muted ? "bg-muted" : "bg-primary/10 text-primary")}>
      <span className="text-[10px] font-semibold uppercase leading-none">{d.toLocaleDateString(locale, { month: "short" })}</span>
      <span className="text-lg font-bold leading-tight tabular-nums">{d.getDate()}</span>
      <span className="text-[10px] leading-none opacity-70">{d.toLocaleDateString(locale, { weekday: "short" })}</span>
    </div>
  );
}

function Empty({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-6 text-sm text-muted-foreground">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
        <Icon className="h-5 w-5" />
      </span>
      {text}
    </div>
  );
}

function Feature({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

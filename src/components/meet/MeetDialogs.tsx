"use client";

/**
 * Fenêtres de la page Réunions : planifier / modifier, rapport de présence, chat archivé.
 */
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Download, Loader2, MessageSquare, Radio, Users } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  DEFAULT_SETTINGS,
  createMeeting,
  formatDuration,
  initials,
  loadMessages,
  mdb,
  meetingReport,
  personHue,
  updateMeeting,
  type Meeting,
  type MeetMessage,
  type MeetSettings,
  type ReportRow,
} from "@/lib/meet";
import { useTr } from "./useTr";

const pad = (n: number) => String(n).padStart(2, "0");
function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function nextSlot() {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return d;
}

export function ScheduleDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rooms: { id: string; name: string }[];
  defaultRoom?: string | null;
  lockRoom?: boolean;
  mode: "now" | "schedule";
  edit?: Meeting | null;
  onDone: (id: string, live: boolean) => void;
}) {
  const { tr, dir } = useTr();
  const [roomId, setRoomId] = useState(props.defaultRoom || props.rooms[0]?.id || "");
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState(toLocalInput(nextSlot()));
  const [duration, setDuration] = useState(60);
  const [desc, setDesc] = useState("");
  const [s, setS] = useState<MeetSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const now = props.mode === "now" && !props.edit;

  useEffect(() => {
    if (!props.open) return;
    const e = props.edit;
    setRoomId(e?.room_id || props.defaultRoom || props.rooms[0]?.id || "");
    setTitle(e?.title || "");
    setWhen(toLocalInput(e?.scheduled_at ? new Date(e.scheduled_at) : nextSlot()));
    setDuration(e?.duration_min || 60);
    setDesc(e?.description || "");
    setS({ ...DEFAULT_SETTINGS, ...(e?.settings || {}) });
  }, [props.open, props.edit, props.defaultRoom, props.rooms]);

  const roomName = props.rooms.find(r => r.id === roomId)?.name || "";

  const submit = async () => {
    if (!roomId) return;
    setSaving(true);
    try {
      if (props.edit) {
        await updateMeeting(props.edit.id, { title, scheduledAt: new Date(when).toISOString(), duration, description: desc });
        props.onDone(props.edit.id, false);
      } else {
        const m = await createMeeting({
          roomId,
          title: title.trim() || tr(`Cours en direct · ${roomName}`, `حصة مباشرة · ${roomName}`, `Live class · ${roomName}`),
          startNow: now,
          scheduledAt: now ? null : new Date(when).toISOString(),
          duration,
          description: desc,
          settings: s,
        });
        props.onDone(m.id, now);
      }
      props.onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || tr("Enregistrement impossible", "تعذر الحفظ", "Could not save"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto" dir={dir}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {now ? <Radio className="h-5 w-5 text-rose-500" /> : <CalendarClock className="h-5 w-5 text-primary" />}
            {props.edit
              ? tr("Modifier la réunion", "تعديل الاجتماع", "Edit meeting")
              : now
                ? tr("Démarrer une réunion", "بدء اجتماع", "Start a meeting")
                : tr("Planifier une réunion", "برمجة اجتماع", "Schedule a meeting")}
          </DialogTitle>
          <DialogDescription>
            {tr(
              "Seuls les élèves de la classe pourront rejoindre. Ils reçoivent une notification.",
              "يمكن لتلاميذ القسم فقط الانضمام. يتوصلون بإشعار.",
              "Only students of the class can join. They get a notification.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!props.edit && !props.lockRoom && props.rooms.length > 1 && (
            <div className="space-y-1.5">
              <Label>{tr("Classe", "القسم", "Class")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {props.rooms.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRoomId(r.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition",
                      roomId === r.id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="meet-title">{tr("Titre", "العنوان", "Title")}</Label>
            <Input
              id="meet-title"
              value={title}
              maxLength={160}
              onChange={e => setTitle(e.target.value)}
              placeholder={tr(`Cours en direct · ${roomName}`, `حصة مباشرة · ${roomName}`, `Live class · ${roomName}`)}
            />
          </div>
          {!now && (
            <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
              <div className="space-y-1.5">
                <Label htmlFor="meet-when">{tr("Date et heure", "التاريخ والساعة", "Date & time")}</Label>
                <Input id="meet-when" type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="meet-dur">{tr("Durée", "المدة", "Duration")}</Label>
                <select id="meet-dur" value={duration} onChange={e => setDuration(Number(e.target.value))} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  {[30, 45, 60, 90, 120, 180].map(d => (
                    <option key={d} value={d}>
                      {formatDuration(d * 60, "fr")}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="meet-desc">{tr("Ordre du jour (facultatif)", "جدول الأعمال (اختياري)", "Agenda (optional)")}</Label>
            <Textarea id="meet-desc" rows={2} maxLength={2000} value={desc} onChange={e => setDesc(e.target.value)} placeholder={tr("Correction de l'exercice 3, questions…", "تصحيح التمرين 3، أسئلة…", "Exercise 3 review, questions…")} />
          </div>
          {!props.edit && (
            <div className="rounded-xl border p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tr("Au départ, les élèves peuvent…", "في البداية، يمكن للتلاميذ…", "At the start, students can…")}</p>
              {(
                [
                  ["students_mic", tr("Activer leur micro", "تشغيل الميكروفون", "Turn on their mic")],
                  ["students_cam", tr("Activer leur caméra", "تشغيل الكاميرا", "Turn on their camera")],
                  ["students_share", tr("Partager leur écran", "مشاركة الشاشة", "Share their screen")],
                  ["chat", tr("Écrire dans le chat", "الكتابة في الدردشة", "Write in the chat")],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="flex cursor-pointer items-center justify-between gap-3 py-1.5 text-sm">
                  {label}
                  <Switch checked={!!s[k]} onCheckedChange={v => setS(x => ({ ...x, [k]: v }))} />
                </label>
              ))}
              <p className="mt-1 text-xs text-muted-foreground">{tr("Modifiable à tout moment pendant la réunion.", "قابل للتعديل في أي وقت أثناء الاجتماع.", "You can change this anytime during the meeting.")}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => props.onOpenChange(false)}>
            {tr("Annuler", "إلغاء", "Cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={saving || !roomId} className={cn(now && "bg-rose-600 hover:bg-rose-700")}>
            {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {props.edit ? tr("Enregistrer", "حفظ", "Save") : now ? tr("Démarrer maintenant", "ابدأ الآن", "Start now") : tr("Planifier", "برمجة", "Schedule")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReportDialog({ meeting, onOpenChange }: { meeting: Meeting | null; onOpenChange: (v: boolean) => void }) {
  const { tr, dir, locale, lang } = useTr();
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  useEffect(() => {
    if (!meeting) return;
    setRows(null);
    meetingReport(meeting.id)
      .then(setRows)
      .catch(e => {
        toast.error(e?.message || "");
        setRows([]);
      });
  }, [meeting]);

  const students = useMemo(() => (rows || []).filter(r => r.role === "student"), [rows]);
  const present = students.filter(r => r.seconds > 0);
  const total = meeting?.started_at
    ? Math.max(60, ((meeting.ended_at ? new Date(meeting.ended_at).getTime() : Date.now()) - new Date(meeting.started_at).getTime()) / 1000)
    : 3600;
  const avg = present.length ? present.reduce((n, r) => n + r.seconds, 0) / present.length : 0;

  const exportCsv = () => {
    const head = ["Nom", "Présent", "Durée (min)", "Arrivée", "Départ", "Connexions"];
    const lines = students.map(r =>
      [
        r.name,
        r.seconds > 0 ? "oui" : "non",
        Math.round(r.seconds / 60),
        r.first_join ? new Date(r.first_join).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "",
        r.last_leave ? new Date(r.last_leave).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "",
        r.sessions,
      ]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(";"),
    );
    const blob = new Blob(["﻿" + [head.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `presence-${(meeting?.room_name || "classe").replace(/\s+/g, "_")}-${(meeting?.started_at || "").slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <Dialog open={!!meeting} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] max-w-xl flex-col" dir={dir}>
        <DialogHeader>
          <DialogTitle>{tr("Rapport de présence", "تقرير الحضور", "Attendance report")}</DialogTitle>
          <DialogDescription>
            {meeting?.title} · {meeting?.room_name}
            {meeting?.started_at && ` · ${new Date(meeting.started_at).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`}
          </DialogDescription>
        </DialogHeader>
        {rows === null ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Stat label={tr("Présents", "الحاضرون", "Present")} value={`${present.length} / ${students.length}`} />
              <Stat label={tr("Durée de la réunion", "مدة الاجتماع", "Meeting length")} value={formatDuration(total, lang)} />
              <Stat label={tr("Temps moyen", "المعدل", "Average time")} value={formatDuration(avg, lang)} />
            </div>
            <div className="-mx-1 min-h-0 flex-1 space-y-1 overflow-y-auto px-1">
              {students.map(r => {
                const pct = Math.min(100, Math.round((r.seconds / total) * 100));
                const st = r.seconds === 0 ? "absent" : pct < 50 ? "short" : "ok";
                return (
                  <div key={r.user_id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/60">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white" style={{ background: `hsl(${personHue(r.user_id)} 55% 48%)` }}>
                      {initials(r.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">{r.name}</p>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                            st === "absent" && "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
                            st === "short" && "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
                            st === "ok" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
                          )}
                        >
                          {st === "absent" ? tr("Absent", "غائب", "Absent") : formatDuration(r.seconds, lang)}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full", st === "short" ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
                      </div>
                      {r.first_join && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {new Date(r.first_join).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                          {r.last_leave && ` → ${new Date(r.last_leave).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`}
                          {r.sessions > 1 && ` · ${tr(`${r.sessions} connexions`, `${r.sessions} اتصالات`, `${r.sessions} sessions`)}`}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              {students.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{tr("Aucun élève dans cette classe.", "لا يوجد تلاميذ في هذا القسم.", "No students in this class.")}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={exportCsv} disabled={students.length === 0}>
                <Download className="me-2 h-4 w-4" />
                {tr("Exporter (Excel / CSV)", "تصدير (Excel / CSV)", "Export (Excel / CSV)")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function ChatArchiveDialog({ meeting, onOpenChange, me }: { meeting: Meeting | null; onOpenChange: (v: boolean) => void; me: string }) {
  const { tr, dir, locale } = useTr();
  const [msgs, setMsgs] = useState<MeetMessage[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!meeting) return;
    setMsgs(null);
    void loadMessages(meeting.id)
      .then(async list => {
        setMsgs(list.filter(m => !m.deleted_at));
        const ids = [...new Set(list.map(m => m.sender_id))];
        if (ids.length) {
          const { data } = await mdb.from("profiles").select("id, name").in("id", ids);
          setNames(Object.fromEntries(((data || []) as { id: string; name: string }[]).map(p => [p.id, p.name])));
        }
      })
      .catch(() => setMsgs([]));
  }, [meeting]);
  return (
    <Dialog open={!!meeting} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] max-w-lg flex-col" dir={dir}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {tr("Chat de la réunion", "دردشة الاجتماع", "Meeting chat")}
          </DialogTitle>
          <DialogDescription>{meeting?.title}</DialogDescription>
        </DialogHeader>
        <div className="-mx-1 min-h-0 flex-1 space-y-3 overflow-y-auto px-1">
          {msgs === null ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : msgs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{tr("Aucun message.", "لا توجد رسائل.", "No messages.")}</p>
          ) : (
            msgs.map(m => (
              <div key={m.id} className="flex gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white" style={{ background: `hsl(${personHue(m.sender_id)} 55% 48%)` }}>
                  {initials(names[m.sender_id])}
                </span>
                <div className="min-w-0">
                  <p className="text-xs">
                    <span className={cn("font-semibold", m.sender_id === meeting?.host_id && "text-amber-600 dark:text-amber-400")}>
                      {m.sender_id === me ? tr("Vous", "أنت", "You") : names[m.sender_id] || "…"}
                    </span>
                    <span className="ms-2 text-muted-foreground">{new Date(m.created_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</span>
                  </p>
                  <p dir="auto" className="whitespace-pre-wrap break-words text-sm">
                    {m.body}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { Users };

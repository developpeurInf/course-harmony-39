/** Fil d'un ticket de support (professeur ou équipe) : discussion, pièces jointes, notes internes */
import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import {
  Camera, Download, FileText, Film, Image as ImageIcon, Loader2, Lock, MapPin, Mic, Paperclip, Send, Square, Star, X, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  SUPPORT_ACCEPT, attachmentKind, currentLocation, formatBytes, mapsUrl, osmEmbedUrl, signSupportPaths, uploadSupportFiles,
  type SupportAttachment, type SupportLocation,
} from "@/lib/supportAttachments";

const db = supabase as any;
type Tr = (fr: string, ar: string, en: string) => string;

export type TicketStatus = "open" | "in_progress" | "answered" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export interface Ticket {
  id: string;
  number?: number;
  author_id: string;
  subject: string;
  category: string;
  status: TicketStatus;
  priority?: TicketPriority;
  assigned_to?: string | null;
  created_at: string;
  updated_at: string;
  last_message_at?: string | null;
  last_message_preview?: string | null;
  last_from_staff?: boolean;
  staff_read_at?: string | null;
  author_read_at?: string | null;
  closed_at?: string | null;
  rating?: number | null;
  rating_comment?: string | null;
  author_name?: string;
  author_email?: string;
  messages?: number;
  author_tickets?: number;
}

interface Message {
  id: string;
  ticket_id: string;
  author_id: string;
  is_staff: boolean;
  internal?: boolean;
  body: string;
  attachments?: SupportAttachment[];
  location?: SupportLocation | null;
  created_at: string;
}

export const ticketStatusLabel = (s: string, tr: Tr) =>
  s === "open" ? tr("À traiter", "للمعالجة", "To handle")
    : s === "in_progress" ? tr("En cours", "قيد المعالجة", "In progress")
    : s === "answered" ? tr("Répondu", "تم الرد", "Answered")
    : tr("Fermé", "مغلق", "Closed");
/** Libellé côté professeur (« À traiter » n'a pas de sens pour lui) */
export const ticketStatusLabelAuthor = (s: string, tr: Tr) =>
  s === "open" || s === "in_progress" ? tr("En attente du support", "في انتظار الدعم", "Waiting for support") : ticketStatusLabel(s, tr);
export const ticketStatusTone = (s: string) =>
  s === "open" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
    : s === "in_progress" ? "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300"
    : s === "answered" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
    : "bg-muted text-muted-foreground";
export const categoryLabel = (c: string, tr: Tr) =>
  c === "bug" ? tr("Problème", "مشكلة", "Bug") : c === "payment" ? tr("Paiement", "الأداء", "Payment") : c === "idea" ? tr("Suggestion", "اقتراح", "Idea") : tr("Question", "سؤال", "Question");
export const priorityLabel = (p: string | undefined, tr: Tr) =>
  p === "urgent" ? tr("Urgente", "عاجلة", "Urgent") : p === "high" ? tr("Haute", "مرتفعة", "High") : p === "low" ? tr("Basse", "منخفضة", "Low") : tr("Normale", "عادية", "Normal");
export const priorityTone = (p: string | undefined) =>
  p === "urgent" ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
    : p === "high" ? "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300"
    : p === "low" ? "bg-muted text-muted-foreground"
    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

/** Non lu pour l'équipe : dernier message du professeur après la dernière lecture */
export const unreadForStaff = (t: Ticket) =>
  !t.last_from_staff && t.status !== "closed" && new Date(t.last_message_at || t.created_at) > new Date(t.staff_read_at || 0);
export const unreadForAuthor = (t: Ticket) =>
  !!t.last_from_staff && !!t.last_message_at && new Date(t.last_message_at) > new Date(t.author_read_at || 0);

/** Fond du fil : teinte légère + motif de points, différent du reste de la page */
const CHAT_BG = {
  backgroundImage: "radial-gradient(hsl(var(--primary) / 0.10) 1px, transparent 1px)",
  backgroundSize: "18px 18px",
};

interface Macro { id: string; title: string; body: string }

export function SupportThread({ ticket, staff, tr, locale, onChanged, authorName, staffNames }: {
  ticket: Ticket;
  staff: boolean;
  tr: Tr;
  locale: string;
  onChanged: () => void;
  /** Nom du professeur, pour les réponses types ({nom}) */
  authorName?: string;
  /** Noms des membres de l'équipe (id → nom) */
  staffNames?: Record<string, string>;
}) {
  const [msgs, setMsgs] = useState<Message[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [location, setLocation] = useState<SupportLocation | null>(null);
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [macros, setMacros] = useState<Macro[]>([]);
  const [dragging, setDragging] = useState(false);
  const [recording, setRecording] = useState<{ rec: MediaRecorder; started: number } | null>(null);
  const [recSeconds, setRecSeconds] = useState(0);
  const [viewer, setViewer] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const mediaInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const chunks = useRef<Blob[]>([]);
  const keepRecording = useRef(true);

  const load = () => db.from("support_messages").select("*").eq("ticket_id", ticket.id).order("created_at")
    .then(async ({ data }: any) => {
      const rows: Message[] = data || [];
      setMsgs(rows);
      const paths = rows.flatMap(m => (m.attachments || []).map(a => a.path));
      if (paths.length) setUrls(await signSupportPaths(paths));
    });
  const markRead = () => { void db.rpc("support_mark_read", { p_ticket: ticket.id }).then(() => onChanged()); };

  useEffect(() => {
    setMsgs(null);
    setText("");
    setFiles([]);
    setLocation(null);
    setInternal(false);
    load();
    markRead();
    // Nom unique à chaque ouverture : supabase.channel() renvoie un canal déjà abonné
    // si le nom existe encore (fermeture asynchrone), et .on() lève alors une erreur.
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase.channel(`support-${ticket.id}-${Math.random().toString(36).slice(2, 8)}`)
        .on("postgres_changes" as any, { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${ticket.id}` }, () => {
          load();
          markRead();
        })
        .subscribe();
    } catch (e) {
      console.error("support realtime", e);
    }
    return () => { if (ch) void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [msgs]);

  useEffect(() => {
    if (!staff) return;
    db.from("support_macros").select("id, title, body").order("title").then(({ data }: any) => setMacros(data || []));
  }, [staff]);

  // Minuteur du message vocal
  useEffect(() => {
    if (!recording) return;
    setRecSeconds(0);
    const t = setInterval(() => setRecSeconds(Math.floor((Date.now() - recording.started) / 1000)), 500);
    return () => clearInterval(t);
  }, [recording]);

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    const arr = Array.from(list);
    if (!arr.length) return;
    setFiles(prev => [...prev, ...arr].slice(0, 10));
  };

  const pickLocation = async () => {
    try {
      setLocation(await currentLocation());
    } catch {
      toast.error(tr("Position indisponible : autorisez la localisation dans le navigateur.", "الموقع غير متاح: اسمح بتحديد الموقع في المتصفح.", "Location unavailable: allow location in your browser."));
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      keepRecording.current = true;
      rec.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        if (!keepRecording.current || !chunks.current.length) return;
        const type = (rec.mimeType || "audio/webm").split(";")[0];
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, "-");
        addFiles([new File(chunks.current, `message-vocal-${stamp}.${ext}`, { type })]);
      };
      rec.start();
      setRecording({ rec, started: Date.now() });
    } catch {
      toast.error(tr("Micro indisponible : autorisez le micro dans le navigateur.", "الميكروفون غير متاح.", "Microphone unavailable."));
    }
  };
  const stopRecording = (keep: boolean) => {
    if (!recording) return;
    keepRecording.current = keep;
    recording.rec.stop();
    setRecording(null);
  };

  const canSend = (text.trim().length > 0 || files.length > 0 || !!location) && !busy && !recording;

  const send = async (closeAfter = false) => {
    if (!canSend) return;
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    let attachments: SupportAttachment[] = [];
    if (files.length) {
      const { done, failed } = await uploadSupportFiles(ticket.id, files);
      attachments = done;
      if (failed.length) toast.error(tr(`Non envoyé : ${failed.join(", ")}`, `لم يُرسل: ${failed.join(", ")}`, `Not sent: ${failed.join(", ")}`));
      if (!done.length && !text.trim() && !location) {
        setBusy(false);
        return;
      }
    }
    const { error } = await db.from("support_messages").insert({
      ticket_id: ticket.id, body: text.trim(), author_id: u?.user?.id, internal: staff && internal, attachments, location,
    });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    if (closeAfter) await db.from("support_tickets").update({ status: "closed", updated_at: new Date().toISOString() }).eq("id", ticket.id);
    setBusy(false);
    setText("");
    setFiles([]);
    setLocation(null);
    load();
    onChanged();
  };

  const setStatus = async (status: string) => {
    const { error } = await db.from("support_tickets").update({ status, updated_at: new Date().toISOString() }).eq("id", ticket.id);
    if (error) toast.error(error.message);
    else onChanged();
  };

  const rate = async (rating: number) => {
    const { error } = await db.from("support_tickets").update({ rating }).eq("id", ticket.id);
    if (error) toast.error(error.message);
    else {
      toast.success(tr("Merci pour votre avis !", "شكرا على رأيك!", "Thanks for your feedback!"));
      onChanged();
    }
  };

  const applyMacro = (m: Macro) => {
    const first = (authorName || "").split(" ")[0] || "";
    setText(prev => (prev ? prev + "\n" : "") + m.body.replace(/\{nom\}/g, first || tr("Madame, Monsieur", "سيدي، سيدتي", "there")));
    setInternal(false);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };
  const onPaste = (e: ClipboardEvent) => {
    const pasted = Array.from(e.clipboardData.files || []);
    if (pasted.length) {
      e.preventDefault();
      addFiles(pasted);
    }
  };

  // Séparateurs de jour
  const groups = useMemo(() => {
    const out: { day: string; items: Message[] }[] = [];
    (msgs || []).forEach(m => {
      const day = new Date(m.created_at).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
      if (!out.length || out[out.length - 1].day !== day) out.push({ day, items: [] });
      out[out.length - 1].items.push(m);
    });
    return out;
  }, [msgs, locale]);

  const closed = ticket.status === "closed";

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {!staff && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate font-semibold">{ticket.number ? <span className="text-muted-foreground">#{ticket.number} </span> : null}{ticket.subject}</h2>
            <p className="text-xs text-muted-foreground">
              {categoryLabel(ticket.category, tr)} · <span className={cn("rounded-full px-2 py-0.5", ticketStatusTone(ticket.status))}>{ticketStatusLabelAuthor(ticket.status, tr)}</span>
            </p>
          </div>
          {!closed
            ? <Button size="sm" variant="outline" onClick={() => setStatus("closed")}>{tr("Mon problème est résolu", "تم حل مشكلتي", "My issue is solved")}</Button>
            : <Button size="sm" variant="outline" onClick={() => setStatus("open")}>{tr("Rouvrir", "إعادة الفتح", "Reopen")}</Button>}
        </div>
      )}

      {/* Fil de discussion */}
      <div
        className={cn("relative min-h-[16rem] flex-1 overflow-y-auto rounded-xl border bg-primary/[0.035] p-3 sm:p-4 dark:bg-primary/[0.06]", dragging && "ring-2 ring-primary")}
        style={CHAT_BG}
        onDragOver={e => { e.preventDefault(); if (!closed || staff) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { if (!closed || staff) onDrop(e); else e.preventDefault(); }}
      >
        {msgs === null ? <Loader2 className="mx-auto mt-10 h-5 w-5 animate-spin text-muted-foreground" /> : groups.map(g => (
          <div key={g.day} className="space-y-2">
            <div className="sticky top-0 z-10 flex justify-center py-1">
              <span className="rounded-full border bg-background/90 px-3 py-0.5 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur">{g.day}</span>
            </div>
            {g.items.map(m => {
              const mine = staff ? m.is_staff : !m.is_staff;
              const who = m.is_staff
                ? (staff && staffNames?.[m.author_id]) || tr("Support", "الدعم", "Support")
                : authorName || tr("Professeur", "الأستاذ", "Teacher");
              const att = m.attachments || [];
              const light = mine && !m.internal;
              return (
                <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[75%]",
                    m.internal
                      ? "border border-dashed border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
                      : mine
                        ? "rounded-ee-md bg-primary text-primary-foreground"
                        : m.is_staff
                          ? "rounded-es-md border border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50"
                          : "rounded-es-md border bg-background",
                  )}>
                    <p className={cn("mb-0.5 flex items-center gap-1 text-[11px] font-semibold", m.internal ? "text-amber-700 dark:text-amber-300" : light ? "text-primary-foreground/80" : "text-muted-foreground")}>
                      {m.internal && <Lock className="h-3 w-3" />}
                      {m.internal ? tr("Note interne", "ملاحظة داخلية", "Internal note") + " · " : ""}{who}
                    </p>
                    {att.length > 0 && (
                      <div className={cn("mb-1 grid gap-1.5", att.filter(a => attachmentKind(a.type) === "image").length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                        {att.map(a => <AttachmentView key={a.path} a={a} url={urls[a.path]} mine={light} onOpenImage={setViewer} tr={tr} />)}
                      </div>
                    )}
                    {m.location && <LocationView loc={m.location} tr={tr} mine={light} />}
                    {m.body && <p className="whitespace-pre-line break-words">{m.body}</p>}
                    <p className={cn("mt-1 text-end text-[10px]", m.internal ? "text-amber-700/80 dark:text-amber-300/80" : light ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {new Date(m.created_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {dragging && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-primary/10 text-sm font-medium text-primary">
            {tr("Déposez vos fichiers ici", "أفلت ملفاتك هنا", "Drop your files here")}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Avis du professeur sur un ticket fermé */}
      {!staff && closed && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
          <span className="text-muted-foreground">{ticket.rating ? tr("Votre avis :", "رأيك:", "Your rating:") : tr("Êtes-vous satisfait de la réponse ?", "هل أنت راضٍ عن الرد؟", "Are you happy with the answer?")}</span>
          <span className="flex">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" onClick={() => rate(n)} aria-label={`${n}/5`} className="p-0.5">
                <Star className={cn("h-5 w-5", (ticket.rating || 0) >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/50")} />
              </button>
            ))}
          </span>
        </div>
      )}
      {staff && closed && ticket.rating ? (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          {tr("Avis du professeur :", "رأي الأستاذ:", "Teacher rating:")}
          {[1, 2, 3, 4, 5].map(n => <Star key={n} className={cn("h-3.5 w-3.5", (ticket.rating || 0) >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />)}
        </p>
      ) : null}

      {/* Zone de saisie */}
      {(!closed || staff) && (
        <div className={cn("rounded-xl border bg-card p-2", internal && "border-amber-400 bg-amber-50/60 dark:bg-amber-950/20")}>
          {staff && (
            <div className="mb-2 flex flex-wrap items-center gap-1">
              <button type="button" onClick={() => setInternal(false)} className={cn("rounded-md px-2.5 py-1 text-xs font-medium", !internal ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                {tr("Réponse au professeur", "رد على الأستاذ", "Reply to teacher")}
              </button>
              <button type="button" onClick={() => setInternal(true)} className={cn("inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium", internal ? "bg-amber-500 text-white" : "text-muted-foreground hover:bg-muted")}>
                <Lock className="h-3 w-3" />{tr("Note interne", "ملاحظة داخلية", "Internal note")}
              </button>
              {macros.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="ms-auto inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted">
                      <Zap className="h-3 w-3" />{tr("Réponses types", "ردود جاهزة", "Canned replies")}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-72 w-64 overflow-y-auto">
                    {macros.map(m => (
                      <DropdownMenuItem key={m.id} onSelect={() => applyMacro(m)} className="flex-col items-start">
                        <span className="font-medium">{m.title}</span>
                        <span className="line-clamp-1 text-xs text-muted-foreground">{m.body}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}

          {(files.length > 0 || location) && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {files.map((f, i) => (
                <span key={i} className="inline-flex max-w-[14rem] items-center gap-1.5 rounded-lg border bg-background px-2 py-1 text-xs">
                  <KindIcon type={f.type} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{f.name}</span>
                  <span className="shrink-0 text-muted-foreground">{formatBytes(f.size)}</span>
                  <button type="button" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} aria-label={tr("Retirer", "إزالة", "Remove")}><X className="h-3 w-3" /></button>
                </span>
              ))}
              {location && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-2 py-1 text-xs">
                  <MapPin className="h-3.5 w-3.5 text-rose-500" />{tr("Position", "الموقع", "Location")} ({location.lat.toFixed(3)}, {location.lng.toFixed(3)})
                  <button type="button" onClick={() => setLocation(null)} aria-label={tr("Retirer", "إزالة", "Remove")}><X className="h-3 w-3" /></button>
                </span>
              )}
            </div>
          )}

          {recording ? (
            <div className="flex items-center gap-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
              {tr("Enregistrement…", "جارٍ التسجيل…", "Recording…")} {Math.floor(recSeconds / 60)}:{String(recSeconds % 60).padStart(2, "0")}
              <Button size="sm" variant="ghost" className="ms-auto" onClick={() => stopRecording(false)}>{tr("Annuler", "إلغاء", "Cancel")}</Button>
              <Button size="sm" className="gap-1.5" onClick={() => stopRecording(true)}><Square className="h-3.5 w-3.5" />{tr("Terminer", "إنهاء", "Stop")}</Button>
            </div>
          ) : (
            <Textarea
              rows={2}
              value={text}
              onChange={e => setText(e.target.value)}
              onPaste={onPaste}
              onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void send(); } }}
              maxLength={5000}
              placeholder={internal ? tr("Note visible uniquement par l'équipe…", "ملاحظة يراها الفريق فقط…", "Note only the team can see…") : tr("Votre message…", "رسالتك…", "Your message…")}
              aria-label={tr("Message", "رسالة", "Message")}
              className="min-h-[3.5rem] resize-none border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
            />
          )}

          <div className="mt-1 flex flex-wrap items-center gap-1">
            <input ref={mediaInput} type="file" accept="image/*,video/*" multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
            <input ref={docInput} type="file" accept={SUPPORT_ACCEPT} multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
            <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="icon" variant="ghost" className="h-9 w-9" disabled={busy || !!recording} aria-label={tr("Joindre", "إرفاق", "Attach")} title={tr("Joindre", "إرفاق", "Attach")}>
                  <Paperclip className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top">
                <DropdownMenuLabel className="text-xs">{tr("Joindre", "إرفاق", "Attach")}</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => mediaInput.current?.click()}><ImageIcon className="me-2 h-4 w-4" />{tr("Photo ou vidéo", "صورة أو فيديو", "Photo or video")}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => cameraInput.current?.click()}><Camera className="me-2 h-4 w-4" />{tr("Prendre une photo", "التقاط صورة", "Take a photo")}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => docInput.current?.click()}><FileText className="me-2 h-4 w-4" />{tr("Document", "مستند", "Document")}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void pickLocation()}><MapPin className="me-2 h-4 w-4" />{tr("Ma position", "موقعي", "My location")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {typeof window !== "undefined" && "MediaRecorder" in window && (
              <Button type="button" size="icon" variant="ghost" className="h-9 w-9" onClick={startRecording} disabled={busy || !!recording} aria-label={tr("Message vocal", "رسالة صوتية", "Voice message")} title={tr("Message vocal", "رسالة صوتية", "Voice message")}>
                <Mic className="h-4 w-4" />
              </Button>
            )}
            <span className="hidden text-[11px] text-muted-foreground md:inline">{tr("Ctrl + Entrée pour envoyer · glissez ou collez une image", "Ctrl + Entrée للإرسال", "Ctrl + Enter to send · drag or paste an image")}</span>
            <div className="ms-auto flex gap-1.5">
              {staff && !internal && !closed && (
                <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => send(true)} disabled={!canSend}>
                  {tr("Envoyer et fermer", "إرسال وإغلاق", "Send & close")}
                </Button>
              )}
              <Button type="button" size="sm" onClick={() => send()} disabled={!canSend} className={cn("h-9 gap-1.5", internal && "bg-amber-500 hover:bg-amber-600")}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 rtl:rotate-180" />}
                {internal ? tr("Ajouter la note", "إضافة الملاحظة", "Add note") : tr("Envoyer", "إرسال", "Send")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Visionneuse photo */}
      {viewer && (
        <div role="dialog" aria-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setViewer(null)}>
          <button type="button" className="absolute end-4 top-4 rounded-full bg-white/10 p-2 text-white" aria-label={tr("Fermer", "إغلاق", "Close")}><X className="h-5 w-5" /></button>
          <img src={viewer} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
}

function KindIcon({ type, className }: { type: string; className?: string }) {
  const k = attachmentKind(type);
  const I = k === "image" ? ImageIcon : k === "video" ? Film : k === "audio" ? Mic : FileText;
  return <I className={className} />;
}

function AttachmentView({ a, url, mine, onOpenImage, tr }: { a: SupportAttachment; url?: string; mine: boolean; onOpenImage: (u: string) => void; tr: Tr }) {
  const kind = attachmentKind(a.type);
  if (!url) return <div className="flex h-16 items-center justify-center rounded-lg bg-black/5"><Loader2 className="h-4 w-4 animate-spin opacity-60" /></div>;
  if (kind === "image") {
    return (
      <button type="button" onClick={() => onOpenImage(url)} className="overflow-hidden rounded-lg">
        <img src={url} alt={a.name} loading="lazy" className="max-h-64 w-full object-cover" />
      </button>
    );
  }
  if (kind === "video") return <video src={url} controls preload="metadata" className="max-h-72 w-full rounded-lg bg-black" />;
  if (kind === "audio") return <audio src={url} controls preload="metadata" className="w-64 max-w-full" />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" download={a.name}
      className={cn("flex items-center gap-2 rounded-lg border px-2.5 py-2", mine ? "border-primary-foreground/30 bg-primary-foreground/10" : "bg-muted/50")}>
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white", kind === "pdf" ? "bg-rose-500" : "bg-sky-500")}>
        <FileText className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium">{a.name}</span>
        <span className={cn("block text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>{formatBytes(a.size)} · {tr("Télécharger", "تحميل", "Download")}</span>
      </span>
      <Download className="h-4 w-4 shrink-0 opacity-70" />
    </a>
  );
}

function LocationView({ loc, tr, mine }: { loc: SupportLocation; tr: Tr; mine: boolean }) {
  return (
    <div className="mb-1 overflow-hidden rounded-lg border">
      <iframe title={tr("Position", "الموقع", "Location")} src={osmEmbedUrl(loc)} className="h-40 w-64 max-w-full border-0" loading="lazy" />
      <a href={mapsUrl(loc)} target="_blank" rel="noopener noreferrer"
        className={cn("flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium", mine ? "bg-primary-foreground/10" : "bg-muted/60")}>
        <MapPin className="h-3.5 w-3.5 text-rose-500" />{tr("Ouvrir dans Maps", "فتح في الخرائط", "Open in Maps")}
        {loc.accuracy ? <span className="opacity-70">· ±{loc.accuracy} m</span> : null}
      </a>
    </div>
  );
}

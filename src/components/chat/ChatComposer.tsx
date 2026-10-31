"use client";

/**
 * Zone de saisie : texte (hauteur automatique), émojis, pièces jointes (photo / vidéo,
 * appareil photo, document, contact, position), message vocal avec minuteur et niveau du micro.
 * Signale « écrit… », « enregistre un vocal… », « envoie une photo… » à l'autre personne.
 */
import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import { toast } from "sonner";
import {
  Camera, FileText, Image as ImageIcon, MapPin, Mic, Paperclip, Pencil, Reply, Send, Smile, Trash2, UserRound, X,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { currentLocation } from "@/lib/supportAttachments";
import { CHAT_DOC_ACCEPT, EMOJIS, attachmentKind, fmtDuration, formatBytes, pickAudioMime, type ChatContactCard, type ChatLocation, type ChatMessage } from "@/lib/chat";

type Tr = (fr: string, ar: string, en: string) => string;
export type Activity = "typing" | "recording" | "uploading" | "idle";

export interface Outgoing {
  text: string;
  files: File[];
  location?: ChatLocation | null;
  contact?: ChatContactCard | null;
  voice?: { file: File; duration: number };
}

const isTouch = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

export function ChatComposer({
  tr, disabled, disabledReason, replyTo, replyName, editing, onCancelReply, onCancelEdit, onSend, onEdit, onActivity,
}: {
  tr: Tr;
  disabled?: boolean;
  disabledReason?: string;
  replyTo: ChatMessage | null;
  replyName?: string;
  editing: ChatMessage | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onSend: (o: Outgoing) => void;
  onEdit: (m: ChatMessage, text: string) => void;
  onActivity: (a: Activity) => void;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [location, setLocation] = useState<ChatLocation | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [rec, setRec] = useState<{ started: number; level: number } | null>(null);
  const [recSec, setRecSec] = useState(0);
  const area = useRef<HTMLTextAreaElement>(null);
  const mediaInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const keep = useRef(true);
  const meter = useRef<{ ctx: AudioContext; raf: number } | null>(null);
  const typingSent = useRef(0);
  const [attachOpen, setAttachOpen] = useState(false);
  const canRecord = typeof window !== "undefined" && "MediaRecorder" in window && !!navigator.mediaDevices?.getUserMedia;

  // Modification d'un message : on reprend son texte
  useEffect(() => {
    if (editing) { setText(editing.body); setTimeout(() => area.current?.focus(), 0); }
  }, [editing]);
  useEffect(() => { if (replyTo) area.current?.focus(); }, [replyTo]);

  // Hauteur automatique (1 à 6 lignes)
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 144) + "px";
  }, [text]);

  // Aperçus des photos choisies
  useEffect(() => {
    const urls = files.map(f => (attachmentKind(f.type) === "image" || attachmentKind(f.type) === "video" ? URL.createObjectURL(f) : ""));
    setPreviews(urls);
    return () => urls.forEach(u => u && URL.revokeObjectURL(u));
  }, [files]);

  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => setRecSec(Math.floor((Date.now() - rec.started) / 1000)), 250);
    return () => clearInterval(t);
  }, [rec?.started]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { stopMeter(); try { recorder.current?.stop(); } catch { /* ignore */ } }, []);

  const changeText = (v: string) => {
    setText(v);
    const now = Date.now();
    if (v && now - typingSent.current > 2500) { typingSent.current = now; onActivity("typing"); }
    if (!v) { typingSent.current = 0; onActivity("idle"); }
  };

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

  const canSend = !disabled && (text.trim().length > 0 || files.length > 0 || !!location);

  const submit = () => {
    if (!canSend) return;
    if (editing) {
      if (text.trim() && text.trim() !== editing.body) onEdit(editing, text.trim());
      onCancelEdit();
      setText("");
      return;
    }
    onSend({ text: text.trim(), files, location });
    setText("");
    setFiles([]);
    setLocation(null);
    typingSent.current = 0;
    onActivity("idle");
    if (!isTouch()) area.current?.focus();
  };

  // ------------------------------------------------------------ vocal
  const stopMeter = () => {
    if (meter.current) {
      cancelAnimationFrame(meter.current.raf);
      try { void meter.current.ctx.close(); } catch { /* ignore */ }
      meter.current = null;
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickAudioMime();
      const r = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunks.current = [];
      keep.current = true;
      const started = Date.now();
      r.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data); };
      r.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        stopMeter();
        const duration = Math.round((Date.now() - started) / 1000);
        if (!keep.current || !chunks.current.length || duration < 1) return;
        const type = (r.mimeType || mime || "audio/webm").split(";")[0];
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        const file = new File(chunks.current, `vocal-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${ext}`, { type });
        onSend({ text: "", files: [], voice: { file, duration } });
      };
      r.start(250);
      recorder.current = r;
      setRec({ started, level: 0 });
      setRecSec(0);
      onActivity("recording");
      // Niveau du micro (animation)
      try {
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx: AudioContext = new AC();
        const an = ctx.createAnalyser();
        an.fftSize = 256;
        ctx.createMediaStreamSource(stream).connect(an);
        const buf = new Uint8Array(an.frequencyBinCount);
        const loop = () => {
          an.getByteTimeDomainData(buf);
          let peak = 0;
          for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128));
          setRec(p => (p ? { ...p, level: Math.min(1, peak / 64) } : p));
          if (meter.current) meter.current.raf = requestAnimationFrame(loop);
        };
        meter.current = { ctx, raf: requestAnimationFrame(loop) };
      } catch { /* pas d'animation */ }
    } catch {
      toast.error(tr("Micro indisponible : autorisez le micro dans le navigateur.", "الميكروفون غير متاح: اسمح به في المتصفح.", "Microphone unavailable: allow it in your browser."));
    }
  };
  const stopRecording = (send: boolean) => {
    keep.current = send;
    try { recorder.current?.stop(); } catch { /* ignore */ }
    recorder.current = null;
    setRec(null);
    onActivity("idle");
  };

  const onPaste = (e: ClipboardEvent) => {
    const pasted = Array.from(e.clipboardData.files || []);
    if (pasted.length) { e.preventDefault(); addFiles(pasted); }
  };

  if (disabled) {
    return (
      <div className="border-t bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}>
        {disabledReason}
      </div>
    );
  }

  const attach = (fn: () => void) => { setAttachOpen(false); fn(); };

  return (
    <div className="border-t bg-background/95 px-2 pt-2 backdrop-blur sm:px-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}>
      {/* Réponse / modification */}
      {(replyTo || editing) && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border-s-4 border-primary bg-muted/60 px-3 py-1.5 text-xs">
          {editing ? <Pencil className="h-3.5 w-3.5 shrink-0 text-primary" /> : <Reply className="h-3.5 w-3.5 shrink-0 text-primary" />}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-primary">{editing ? tr("Modifier le message", "تعديل الرسالة", "Edit message") : tr(`Répondre à ${replyName}`, `الرد على ${replyName}`, `Reply to ${replyName}`)}</p>
            <p className="truncate text-muted-foreground">{(editing || replyTo)?.body || tr("Pièce jointe", "مرفق", "Attachment")}</p>
          </div>
          <button type="button" onClick={editing ? () => { onCancelEdit(); setText(""); } : onCancelReply} className="rounded-full p-1 hover:bg-muted" aria-label={tr("Annuler", "إلغاء", "Cancel")}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Pièces jointes en attente */}
      {(files.length > 0 || location) && (
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
          {files.map((f, i) => (
            <div key={i} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-muted">
              {previews[i] ? (
                attachmentKind(f.type) === "video"
                  ? <video src={previews[i]} muted playsInline className="h-full w-full object-cover" />
                  : <img src={previews[i]} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full flex-col items-center justify-center p-1 text-center text-[9px] leading-tight text-muted-foreground">
                  <FileText className="mb-0.5 h-5 w-5" /><span className="line-clamp-2 break-all">{f.name}</span><span>{formatBytes(f.size)}</span>
                </span>
              )}
              <button type="button" onClick={() => setFiles(p => p.filter((_, j) => j !== i))} className="absolute end-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white" aria-label={tr("Retirer", "إزالة", "Remove")}>
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {location && (
            <div className="relative flex h-16 shrink-0 items-center gap-1.5 rounded-lg border bg-muted px-3 text-xs">
              <MapPin className="h-4 w-4 text-rose-500" />{tr("Ma position", "موقعي", "My location")}
              <button type="button" onClick={() => setLocation(null)} className="ms-1 rounded-full bg-black/60 p-0.5 text-white" aria-label={tr("Retirer", "إزالة", "Remove")}><X className="h-3 w-3" /></button>
            </div>
          )}
        </div>
      )}

      {rec ? (
        <div className="flex items-center gap-2 py-1">
          <button type="button" onClick={() => stopRecording(false)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40" aria-label={tr("Supprimer l'enregistrement", "حذف التسجيل", "Discard recording")}>
            <Trash2 className="h-5 w-5" />
          </button>
          <div className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-full bg-rose-50 px-4 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-rose-500" />
            <span className="tabular-nums text-sm font-medium">{fmtDuration(recSec)}</span>
            <span className="flex h-6 flex-1 items-center gap-[3px] overflow-hidden" aria-hidden="true">
              {Array.from({ length: 24 }, (_, i) => (
                <span key={i} className="w-[3px] shrink-0 rounded-full bg-rose-400 transition-all"
                  style={{ height: `${Math.max(12, Math.min(100, rec.level * 100 * (0.5 + Math.abs(Math.sin(i * 1.3 + recSec)) * 0.8)))}%` }} />
              ))}
            </span>
            <span className="hidden text-xs sm:inline">{tr("Enregistrement…", "جارٍ التسجيل…", "Recording…")}</span>
          </div>
          <button type="button" onClick={() => stopRecording(true)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow" aria-label={tr("Envoyer le vocal", "إرسال الرسالة الصوتية", "Send voice message")}>
            <Send className="h-5 w-5 rtl:rotate-180" />
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-1">
          <input ref={mediaInput} type="file" accept="image/*,video/*" multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = ""; onActivity("idle"); }} />
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
          <input ref={docInput} type="file" accept={CHAT_DOC_ACCEPT} multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />

          <Popover open={attachOpen} onOpenChange={setAttachOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-primary hover:bg-muted" aria-label={tr("Joindre", "إرفاق", "Attach")} title={tr("Joindre", "إرفاق", "Attach")}>
                <Paperclip className="h-5 w-5" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-64 p-2">
              <div className="grid grid-cols-3 gap-1">
                <AttachItem icon={ImageIcon} tone="bg-violet-500" label={tr("Galerie", "المعرض", "Gallery")} onClick={() => attach(() => mediaInput.current?.click())} />
                <AttachItem icon={Camera} tone="bg-rose-500" label={tr("Caméra", "الكاميرا", "Camera")} onClick={() => attach(() => cameraInput.current?.click())} />
                <AttachItem icon={FileText} tone="bg-sky-500" label={tr("Document", "مستند", "Document")} onClick={() => attach(() => docInput.current?.click())} />
                <AttachItem icon={UserRound} tone="bg-blue-600" label={tr("Contact", "جهة اتصال", "Contact")} onClick={() => attach(() => setContactOpen(true))} />
                <AttachItem icon={MapPin} tone="bg-emerald-500" label={tr("Position", "الموقع", "Location")} onClick={() => attach(() => void pickLocation())} />
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex min-h-[44px] min-w-0 flex-1 items-end rounded-3xl bg-muted px-1">
            <textarea
              ref={area}
              rows={1}
              value={text}
              onChange={e => changeText(e.target.value)}
              onPaste={onPaste}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey && !isTouch() && !(e.nativeEvent as any).isComposing) { e.preventDefault(); submit(); }
                if (e.key === "Escape" && (editing || replyTo)) { if (editing) onCancelEdit(); else onCancelReply(); }
              }}
              maxLength={5000}
              placeholder={tr("Écrire un message…", "اكتب رسالة…", "Write a message…")}
              aria-label={tr("Message", "رسالة", "Message")}
              dir="auto"
              className="max-h-36 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-[11px] text-[15px] leading-[22px] outline-none placeholder:text-muted-foreground"
            />
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground" aria-label={tr("Émojis", "رموز تعبيرية", "Emoji")}>
                  <Smile className="h-5 w-5" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="end" className="w-72 p-2">
                <div className="grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto">
                  {EMOJIS.map(e => (
                    <button key={e} type="button" className="rounded-md p-1 text-xl hover:bg-muted" onClick={() => { changeText(text + e); area.current?.focus(); }}>{e}</button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {canSend || editing || !canRecord ? (
            <button type="button" onClick={submit} disabled={!canSend} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow transition-transform active:scale-95 disabled:opacity-40" aria-label={tr("Envoyer", "إرسال", "Send")}>
              <Send className="h-5 w-5 rtl:rotate-180" />
            </button>
          ) : (
            <button type="button" onClick={() => void startRecording()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow transition-transform active:scale-95" aria-label={tr("Message vocal", "رسالة صوتية", "Voice message")} title={tr("Message vocal", "رسالة صوتية", "Voice message")}>
              <Mic className="h-5 w-5" />
            </button>
          )}
        </div>
      )}

      <ContactDialog open={contactOpen} onOpenChange={setContactOpen} tr={tr} onShare={c => onSend({ text: "", files: [], contact: c })} />
    </div>
  );
}

function AttachItem({ icon: Icon, tone, label, onClick }: { icon: typeof ImageIcon; tone: string; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1 rounded-lg p-2 text-xs hover:bg-muted">
      <span className={cn("flex h-11 w-11 items-center justify-center rounded-full text-white", tone)}><Icon className="h-5 w-5" /></span>
      {label}
    </button>
  );
}

/** Partager un contact : depuis le carnet du téléphone (Android Chrome) ou saisi à la main */
function ContactDialog({ open, onOpenChange, tr, onShare }: { open: boolean; onOpenChange: (v: boolean) => void; tr: Tr; onShare: (c: ChatContactCard) => void }) {
  const [c, setC] = useState<ChatContactCard>({ name: "", phone: "", email: "" });
  const picker = typeof navigator !== "undefined" && (navigator as any).contacts?.select;
  useEffect(() => { if (open) setC({ name: "", phone: "", email: "" }); }, [open]);
  const pick = async () => {
    try {
      const [r] = await (navigator as any).contacts.select(["name", "tel", "email"], { multiple: false });
      if (r) setC({ name: r.name?.[0] || "", phone: r.tel?.[0] || "", email: r.email?.[0] || "" });
    } catch { /* annulé */ }
  };
  const ok = c.name.trim().length > 0 && ((c.phone || "").trim() || (c.email || "").trim());
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{tr("Partager un contact", "مشاركة جهة اتصال", "Share a contact")}</DialogTitle></DialogHeader>
        {picker && (
          <Button type="button" variant="outline" onClick={() => void pick()} className="gap-2"><UserRound className="h-4 w-4" />{tr("Choisir dans mes contacts", "اختيار من جهات الاتصال", "Pick from my contacts")}</Button>
        )}
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="cc-name">{tr("Nom", "الاسم", "Name")}</Label><Input id="cc-name" value={c.name} onChange={e => setC({ ...c, name: e.target.value })} maxLength={100} /></div>
          <div className="space-y-1"><Label htmlFor="cc-tel">{tr("Téléphone", "الهاتف", "Phone")}</Label><Input id="cc-tel" type="tel" dir="ltr" value={c.phone} onChange={e => setC({ ...c, phone: e.target.value })} maxLength={30} /></div>
          <div className="space-y-1"><Label htmlFor="cc-mail">{tr("E-mail", "البريد الإلكتروني", "E-mail")}</Label><Input id="cc-mail" type="email" dir="ltr" value={c.email} onChange={e => setC({ ...c, email: e.target.value })} maxLength={120} /></div>
        </div>
        <DialogFooter>
          <Button type="button" disabled={!ok} onClick={() => { onShare({ name: c.name.trim(), phone: c.phone?.trim() || undefined, email: c.email?.trim() || undefined }); onOpenChange(false); }}>
            {tr("Envoyer", "إرسال", "Send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

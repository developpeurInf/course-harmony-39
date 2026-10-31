"use client";

/** Morceaux d'une bulle de message : médias, vocal, document, contact, position, appel */
import { useEffect, useRef, useState } from "react";
import { Download, FileText, Loader2, MapPin, Pause, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Play, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { mapsUrl, osmEmbedUrl } from "@/lib/supportAttachments";
import { attachmentKind, fmtDuration, formatBytes, vcard, type Attachment, type ChatContactCard, type ChatLocation, type ChatMessage } from "@/lib/chat";

type Tr = (fr: string, ar: string, en: string) => string;

/** Liens cliquables dans le texte */
export function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-2">{p}</a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

/** Grille de photos / vidéos (jusqu'à 4 visibles, « +N » ensuite) */
export function MediaGrid({ items, urls, onOpen }: { items: Attachment[]; urls: Record<string, string>; onOpen: (index: number) => void }) {
  const shown = items.slice(0, 4);
  const more = items.length - shown.length;
  const single = items.length === 1;
  return (
    <div className={cn("grid w-64 max-w-full gap-0.5 overflow-hidden rounded-xl sm:w-72", single ? "grid-cols-1" : "grid-cols-2")}>
      {shown.map((a, i) => {
        const url = urls[a.path];
        const kind = attachmentKind(a.type);
        const ratio = single && a.width && a.height ? Math.min(Math.max(a.height / a.width, 0.5), 1.4) : 1;
        return (
          <button
            key={a.path}
            type="button"
            onClick={() => onOpen(i)}
            className={cn("relative block w-full overflow-hidden bg-black/10", !single && items.length === 3 && i === 0 && "col-span-2")}
            style={{ paddingTop: `${(!single && items.length === 3 && i === 0 ? 0.5 : ratio) * 100}%` }}
            aria-label={kind === "video" ? "Vidéo" : "Photo"}
          >
            {url ? (
              kind === "video" ? (
                <>
                  <video src={url + "#t=0.1"} preload="metadata" muted playsInline className="absolute inset-0 h-full w-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur"><Play className="ms-0.5 h-5 w-5 fill-current" /></span>
                  </span>
                  {a.duration ? <span className="absolute bottom-1 end-1 rounded bg-black/60 px-1.5 text-[10px] text-white">{fmtDuration(a.duration)}</span> : null}
                </>
              ) : (
                <img src={url} alt={a.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
              )
            ) : (
              <span className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin opacity-60" /></span>
            )}
            {more > 0 && i === 3 && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-2xl font-semibold text-white">+{more}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Lecteur de message vocal : lecture / pause, barre de progression, vitesse */
const BARS = 28;
export function VoicePlayer({ url, duration, mine, seed }: { url?: string; duration?: number; mine: boolean; seed: string }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [len, setLen] = useState(duration || 0);
  const [rate, setRate] = useState(1);
  const [error, setError] = useState(false);
  // Forme d'onde décorative stable (le fichier n'est pas analysé)
  const heights = useRef<number[]>([]);
  if (!heights.current.length) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) | 0;
    heights.current = Array.from({ length: BARS }, (_, i) => 0.3 + Math.abs(Math.sin(h + i * 1.7)) * 0.7);
  }

  useEffect(() => () => { audio.current?.pause(); }, []);

  const toggle = () => {
    const el = audio.current;
    if (!el || !url) return;
    if (playing) { el.pause(); return; }
    // Un seul vocal à la fois
    document.querySelectorAll<HTMLAudioElement>("audio[data-chat-voice]").forEach(a => { if (a !== el) a.pause(); });
    el.playbackRate = rate;
    void el.play().catch(() => setError(true));
  };
  const progress = len ? Math.min(1, pos / len) : 0;
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audio.current;
    if (!el || !len) return;
    const r = e.currentTarget.getBoundingClientRect();
    let x = (e.clientX - r.left) / r.width;
    if (getComputedStyle(e.currentTarget).direction === "rtl") x = 1 - x;
    el.currentTime = Math.max(0, Math.min(len, x * len));
    setPos(el.currentTime);
  };
  const nextRate = () => {
    const r = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
    setRate(r);
    if (audio.current) audio.current.playbackRate = r;
  };

  return (
    <div className="flex w-60 max-w-full items-center gap-2 py-0.5 sm:w-64">
      {url && (
        <audio
          ref={audio}
          data-chat-voice=""
          src={url}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setPos(0); }}
          onTimeUpdate={e => setPos(e.currentTarget.currentTime)}
          onLoadedMetadata={e => { const d = e.currentTarget.duration; if (isFinite(d) && d > 0) setLen(d); }}
          onError={() => setError(true)}
        />
      )}
      <button
        type="button"
        onClick={toggle}
        disabled={!url}
        aria-label={playing ? "Pause" : "Lecture"}
        className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", mine ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground")}
      >
        {!url ? <Loader2 className="h-4 w-4 animate-spin" /> : playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ms-0.5 h-4 w-4 fill-current" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex h-7 cursor-pointer items-center gap-[2px]" onClick={seek} role="slider" aria-valuemin={0} aria-valuemax={Math.round(len)} aria-valuenow={Math.round(pos)} aria-label="Position">
          {heights.current.map((h, i) => (
            <span
              key={i}
              className={cn("flex-1 rounded-full transition-colors", i / BARS < progress
                ? (mine ? "bg-primary-foreground" : "bg-primary")
                : (mine ? "bg-primary-foreground/35" : "bg-muted-foreground/30"))}
              style={{ height: `${h * 100}%` }}
            />
          ))}
        </div>
        <div className={cn("mt-0.5 flex items-center justify-between text-[10px]", mine ? "text-primary-foreground/75" : "text-muted-foreground")}>
          <span className="tabular-nums">{error ? "Format non lisible ici" : fmtDuration(playing || pos ? pos : len)}</span>
          <button type="button" onClick={nextRate} className={cn("rounded px-1.5 font-semibold", mine ? "bg-primary-foreground/20" : "bg-muted")}>{rate}×</button>
        </div>
      </div>
    </div>
  );
}

export function FileCard({ a, url, mine, tr }: { a: Attachment; url?: string; mine: boolean; tr: Tr }) {
  const kind = attachmentKind(a.type);
  const ext = (a.name.split(".").pop() || "").toUpperCase().slice(0, 4);
  const tone = kind === "pdf" ? "bg-rose-500" : /DOC|ODT/.test(ext) ? "bg-blue-600" : /XLS|ODS|CSV/.test(ext) ? "bg-emerald-600" : /PPT|ODP/.test(ext) ? "bg-orange-500" : kind === "audio" ? "bg-violet-500" : "bg-slate-500";
  if (kind === "audio" && url) return <audio src={url} controls preload="metadata" className="w-64 max-w-full" />;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={a.name}
      className={cn("flex w-64 max-w-full items-center gap-2.5 rounded-xl p-2", mine ? "bg-primary-foreground/15" : "bg-muted/70")}
    >
      <span className={cn("flex h-11 w-10 shrink-0 flex-col items-center justify-center rounded-md text-white", tone)}>
        <FileText className="h-4 w-4" />
        <span className="mt-0.5 text-[8px] font-bold">{ext}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{a.name}</span>
        <span className={cn("block text-[11px]", mine ? "text-primary-foreground/75" : "text-muted-foreground")}>{formatBytes(a.size)} · {tr("Ouvrir", "فتح", "Open")}</span>
      </span>
      {url ? <Download className="h-4 w-4 shrink-0 opacity-70" /> : <Loader2 className="h-4 w-4 shrink-0 animate-spin opacity-70" />}
    </a>
  );
}

export function ContactCard({ c, mine, tr }: { c: ChatContactCard; mine: boolean; tr: Tr }) {
  const href = `data:text/vcard;charset=utf-8,${encodeURIComponent(vcard(c))}`;
  return (
    <div className={cn("w-60 max-w-full overflow-hidden rounded-xl", mine ? "bg-primary-foreground/15" : "bg-muted/70")}>
      <div className="flex items-center gap-2.5 p-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white"><UserRound className="h-5 w-5" /></span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{c.name}</span>
          {c.phone && <span className="block truncate text-xs opacity-80" dir="ltr">{c.phone}</span>}
          {c.email && <span className="block truncate text-xs opacity-80">{c.email}</span>}
        </span>
      </div>
      <div className={cn("grid border-t text-xs font-medium", c.phone ? "grid-cols-2" : "grid-cols-1", mine ? "border-primary-foreground/20" : "border-border")}>
        {c.phone && <a href={`tel:${c.phone.replace(/\s+/g, "")}`} className="flex items-center justify-center gap-1 py-2 hover:bg-black/5"><Phone className="h-3.5 w-3.5" />{tr("Appeler", "اتصال", "Call")}</a>}
        <a href={href} download={`${c.name}.vcf`} className={cn("flex items-center justify-center gap-1 py-2 hover:bg-black/5", c.phone && (mine ? "border-s border-primary-foreground/20" : "border-s"))}>
          <UserRound className="h-3.5 w-3.5" />{tr("Enregistrer", "حفظ", "Save")}
        </a>
      </div>
    </div>
  );
}

export function LocationCard({ loc, mine, tr }: { loc: ChatLocation; mine: boolean; tr: Tr }) {
  return (
    <div className="w-64 max-w-full overflow-hidden rounded-xl">
      <iframe title={tr("Position", "الموقع", "Location")} src={osmEmbedUrl(loc)} className="pointer-events-none h-36 w-full border-0" loading="lazy" />
      <a href={mapsUrl(loc)} target="_blank" rel="noopener noreferrer"
        className={cn("flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium", mine ? "bg-primary-foreground/15" : "bg-muted/70")}>
        <MapPin className="h-3.5 w-3.5 text-rose-500" />{tr("Ouvrir dans Maps", "فتح في الخرائط", "Open in Maps")}
        {loc.accuracy ? <span className="opacity-70">· ±{loc.accuracy} m</span> : null}
      </a>
    </div>
  );
}

/** Ligne d'appel au milieu du fil */
export function CallLine({ m, me, tr, time, onCallBack }: { m: ChatMessage; me: string; tr: Tr; time: string; onCallBack?: () => void }) {
  const status = m.meta?.status;
  const outgoing = m.sender_id === me;
  const missed = status === "missed" || status === "cancelled" || status === "declined" || status === "failed";
  const Icon = missed && !outgoing ? PhoneMissed : outgoing ? PhoneOutgoing : PhoneIncoming;
  const label = status === "ended"
    ? (outgoing ? tr("Appel vocal sortant", "مكالمة صادرة", "Outgoing call") : tr("Appel vocal entrant", "مكالمة واردة", "Incoming call"))
    : status === "declined" ? (outgoing ? tr("Appel refusé", "مكالمة مرفوضة", "Call declined") : tr("Appel refusé", "رفضت المكالمة", "You declined"))
    : status === "failed" ? tr("Appel interrompu", "مكالمة منقطعة", "Call dropped")
    : outgoing ? tr("Pas de réponse", "لا يوجد رد", "No answer") : tr("Appel manqué", "مكالمة فائتة", "Missed call");
  return (
    <div className="flex justify-center py-1">
      <div className={cn("inline-flex items-center gap-2 rounded-full border bg-background/90 px-3 py-1.5 text-xs shadow-sm", missed && !outgoing && "border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-300")}>
        <Icon className="h-3.5 w-3.5" />
        <span className="font-medium">{label}</span>
        {status === "ended" && m.meta?.duration ? <span className="text-muted-foreground">· {fmtDuration(m.meta.duration)}</span> : null}
        <span className="text-muted-foreground">· {time}</span>
        {onCallBack && (
          <button type="button" onClick={onCallBack} className="ms-1 rounded-full bg-emerald-500 px-2 py-0.5 font-semibold text-white hover:bg-emerald-600">
            {tr("Rappeler", "إعادة الاتصال", "Call back")}
          </button>
        )}
      </div>
    </div>
  );
}

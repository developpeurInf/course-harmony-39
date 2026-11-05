"use client";

/**
 * Participants : mains levées (dans l'ordre), présents, élèves pas encore arrivés.
 * Professeur : couper un micro / une caméra, baisser une main, retirer, et droits de la classe.
 */
import { useMemo, useState } from "react";
import { Track, type Participant } from "livekit-client";
import {
  Camera,
  CameraOff,
  Hand,
  Lock,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  MoreVertical,
  Pin,
  Search,
  UserMinus,
  UserX,
  Users,
  VolumeX,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { initials, personHue, type MeetSettings, type ReportRow } from "@/lib/meet";
import type { Tr } from "./useTr";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function roleOf(p: Participant): "host" | "student" {
  return p.attributes?.role === "host" ? "host" : "student";
}
export function handOf(p: Participant): number {
  const v = Number(p.attributes?.hand || 0);
  return Number.isFinite(v) ? v : 0;
}

export function MeetPeople(props: {
  tr: Tr;
  participants: Participant[];
  meId: string;
  isHost: boolean;
  settings: MeetSettings;
  absent: ReportRow[] | null;
  onModerate: (action: "mute" | "lower_hand" | "remove" | "mute_all" | "lower_all", identity?: string, source?: "microphone" | "camera" | "screen_share") => void;
  onSetting: (patch: Partial<MeetSettings>) => void;
  onPin: (identity: string) => void;
}) {
  const { tr } = props;
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const f = q.trim() ? props.participants.filter(p => norm(p.name || p.identity).includes(norm(q))) : props.participants;
    return [...f].sort((a, b) => {
      const ra = roleOf(a) === "host" ? 0 : 1;
      const rb = roleOf(b) === "host" ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return (a.name || "").localeCompare(b.name || "", "fr");
    });
  }, [props.participants, q]);
  const hands = useMemo(
    () => props.participants.filter(p => handOf(p) > 0).sort((a, b) => handOf(a) - handOf(b)),
    [props.participants],
  );
  const absent = (props.absent || []).filter(r => r.role === "student" && !props.participants.some(p => p.identity === r.user_id));

  return (
    <div className="meet-scroll flex h-full min-h-0 flex-col overflow-y-auto">
      {props.isHost && (
        <div className="space-y-3 border-b border-white/10 p-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => props.onModerate("mute_all")}
              className="flex items-center justify-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs font-medium ring-1 ring-white/10 hover:bg-white/10"
            >
              <VolumeX className="h-4 w-4" />
              {tr("Couper tous les micros", "كتم جميع الميكروفونات", "Mute everyone")}
            </button>
            <button
              type="button"
              disabled={hands.length === 0}
              onClick={() => props.onModerate("lower_all")}
              className="flex items-center justify-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs font-medium ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-40"
            >
              <Hand className="h-4 w-4" />
              {tr("Baisser les mains", "إنزال الأيدي", "Lower all hands")}
            </button>
          </div>
          <details className="group rounded-xl bg-white/[0.03] ring-1 ring-white/10" open>
            <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white/50">
              {tr("Les élèves peuvent…", "يمكن للتلاميذ…", "Students can…")}
            </summary>
            <div className="space-y-1 px-3 pb-3">
              <SettingRow icon={Mic} label={tr("Activer leur micro", "تشغيل الميكروفون", "Turn on their mic")} checked={props.settings.students_mic} onChange={v => props.onSetting({ students_mic: v })} />
              <SettingRow icon={Camera} label={tr("Activer leur caméra", "تشغيل الكاميرا", "Turn on their camera")} checked={props.settings.students_cam} onChange={v => props.onSetting({ students_cam: v })} />
              <SettingRow icon={MonitorUp} label={tr("Partager leur écran", "مشاركة الشاشة", "Share their screen")} checked={props.settings.students_share} onChange={v => props.onSetting({ students_share: v })} />
              <SettingRow icon={MessageSquare} label={tr("Écrire dans le chat", "الكتابة في الدردشة", "Write in the chat")} checked={props.settings.chat} onChange={v => props.onSetting({ chat: v })} />
              <SettingRow
                icon={Lock}
                label={tr("Verrouiller (plus de nouvelles entrées)", "إغلاق (لا دخول جديد)", "Lock (no new joins)")}
                checked={props.settings.locked}
                onChange={v => props.onSetting({ locked: v })}
              />
            </div>
          </details>
        </div>
      )}

      <div className="p-3 pb-1">
        <label className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10 focus-within:ring-primary/60">
          <Search className="h-4 w-4 text-white/40" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={tr("Rechercher", "بحث", "Search")}
            className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
          />
        </label>
      </div>

      {hands.length > 0 && (
        <Section title={tr(`Mains levées · ${hands.length}`, `أيدٍ مرفوعة · ${hands.length}`, `Raised hands · ${hands.length}`)} accent>
          {hands.map((p, i) => (
            <PersonRow key={`h-${p.identity}`} p={p} {...props} order={i + 1} />
          ))}
        </Section>
      )}

      <Section title={tr(`Dans la réunion · ${props.participants.length}`, `في الاجتماع · ${props.participants.length}`, `In the meeting · ${props.participants.length}`)}>
        {list.map(p => (
          <PersonRow key={p.identity} p={p} {...props} />
        ))}
      </Section>

      {props.isHost && absent.length > 0 && (
        <Section title={tr(`Pas encore là · ${absent.length}`, `لم يلتحقوا بعد · ${absent.length}`, `Not here yet · ${absent.length}`)}>
          {absent.map(r => (
            <div key={r.user_id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 opacity-60">
              <Avatar id={r.user_id} name={r.name} size={32} />
              <span className="min-w-0 flex-1 truncate text-sm">{r.name}</span>
              {r.sessions > 0 && <span className="text-[11px] text-white/50">{tr("parti", "غادر", "left")}</span>}
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children, accent }: { title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <div className="px-3 py-2">
      <p className={cn("mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider", accent ? "text-amber-300" : "text-white/45")}>{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function SettingRow({ icon: Icon, label, checked, onChange }: { icon: any; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-1.5 text-sm">
      <Icon className="h-4 w-4 shrink-0 text-white/50" />
      <span className="min-w-0 flex-1 text-white/85">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

export function Avatar({ id, name, size = 32 }: { id: string; name: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        background: `linear-gradient(135deg, hsl(${personHue(id)} 65% 52%), hsl(${personHue(id) + 35} 65% 40%))`,
      }}
    >
      {initials(name)}
    </span>
  );
}

function PersonRow(props: {
  p: Participant;
  tr: Tr;
  meId: string;
  isHost: boolean;
  order?: number;
  onModerate: (action: "mute" | "lower_hand" | "remove", identity?: string, source?: "microphone" | "camera" | "screen_share") => void;
  onPin: (identity: string) => void;
}) {
  const { p, tr } = props;
  const me = p.identity === props.meId;
  const host = roleOf(p) === "host";
  const mic = p.getTrackPublication(Track.Source.Microphone);
  const cam = p.getTrackPublication(Track.Source.Camera);
  const screen = p.getTrackPublication(Track.Source.ScreenShare);
  const micOn = !!mic && !mic.isMuted;
  const camOn = !!cam && !cam.isMuted;
  const hand = handOf(p) > 0;
  return (
    <div className={cn("group flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white/5", p.isSpeaking && "bg-primary/10")}>
      <div className="relative">
        <Avatar id={p.identity} name={p.name || "?"} />
        {props.order && (
          <span className="absolute -bottom-1 -end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-black">
            {props.order}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {p.name || tr("Participant", "مشارك", "Participant")}
          {me && <span className="text-white/50"> · {tr("vous", "أنت", "you")}</span>}
        </p>
        {(host || screen) && (
          <p className="truncate text-[11px] text-white/50">
            {host ? tr("Professeur", "الأستاذ", "Teacher") : ""}
            {host && screen ? " · " : ""}
            {screen ? tr("présente son écran", "يعرض شاشته", "presenting") : ""}
          </p>
        )}
      </div>
      {hand && <Hand className="h-4 w-4 text-amber-300" aria-label={tr("Main levée", "يد مرفوعة", "Hand raised")} />}
      {camOn ? <Camera className="h-4 w-4 text-white/60" /> : <CameraOff className="h-4 w-4 text-white/30" />}
      {micOn ? <Mic className={cn("h-4 w-4", p.isSpeaking ? "text-emerald-400" : "text-white/60")} /> : <MicOff className="h-4 w-4 text-rose-400/80" />}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={tr("Actions", "إجراءات", "Actions")}
        >
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => props.onPin(p.identity)}>
            <Pin className="me-2 h-4 w-4" />
            {tr("Épingler pour moi", "تثبيت عندي", "Pin for me")}
          </DropdownMenuItem>
          {props.isHost && !me && (
            <>
              <DropdownMenuSeparator />
              {hand && (
                <DropdownMenuItem onClick={() => props.onModerate("lower_hand", p.identity)}>
                  <Hand className="me-2 h-4 w-4" />
                  {tr("Baisser la main", "إنزال اليد", "Lower hand")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem disabled={!micOn} onClick={() => props.onModerate("mute", p.identity, "microphone")}>
                <MicOff className="me-2 h-4 w-4" />
                {tr("Couper son micro", "كتم ميكروفونه", "Mute mic")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!camOn} onClick={() => props.onModerate("mute", p.identity, "camera")}>
                <CameraOff className="me-2 h-4 w-4" />
                {tr("Couper sa caméra", "إيقاف كاميرته", "Stop camera")}
              </DropdownMenuItem>
              {screen && (
                <DropdownMenuItem onClick={() => props.onModerate("mute", p.identity, "screen_share")}>
                  <UserX className="me-2 h-4 w-4" />
                  {tr("Arrêter son partage", "إيقاف مشاركته", "Stop sharing")}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-rose-600 focus:text-rose-600" onClick={() => props.onModerate("remove", p.identity)}>
                <UserMinus className="me-2 h-4 w-4" />
                {tr("Retirer de la réunion", "إخراج من الاجتماع", "Remove from meeting")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export { Users };

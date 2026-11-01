/**
 * Réunions vidéo de classe : types, accès à la base (migration 20261116090000_class_meetings.sql)
 * et appels aux routes serveur /api/meet/* (jeton LiveKit, actions du professeur).
 */
import { supabase } from "@/integrations/supabase/client";

export const mdb = supabase as any;

export type MeetStatus = "scheduled" | "live" | "ended" | "cancelled";

export interface MeetSettings {
  chat: boolean;
  students_mic: boolean;
  students_cam: boolean;
  students_share: boolean;
  locked: boolean;
}

export const DEFAULT_SETTINGS: MeetSettings = { chat: true, students_mic: true, students_cam: true, students_share: false, locked: false };

export interface Meeting {
  id: string;
  room_id: string;
  room_name: string;
  host_id: string;
  host_name: string;
  title: string;
  description: string;
  status: MeetStatus;
  scheduled_at: string | null;
  duration_min: number;
  started_at: string | null;
  ended_at: string | null;
  settings: MeetSettings;
  attendees: number;
  online: number;
  messages: number;
  my_seconds: number;
}

export interface MeetMessage {
  id: string;
  meeting_id: string;
  sender_id: string;
  body: string;
  client_id: string | null;
  created_at: string;
  deleted_at: string | null;
  _pending?: boolean;
}

export interface ReportRow {
  user_id: string;
  name: string;
  avatar_url: string | null;
  role: "host" | "student";
  first_join: string | null;
  last_leave: string | null;
  seconds: number;
  sessions: number;
}

export interface JoinInfo {
  token: string;
  url: string;
  role: "host" | "student";
  user_id: string;
  name: string;
  avatar_url: string | null;
  room_name: string;
  host_name: string;
  meeting: Omit<Meeting, "room_name" | "host_name" | "attendees" | "online" | "messages" | "my_seconds">;
}

export class MeetError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ---------------------------------------------------------------------------
// Cache mémoire des listes : affichage instantané en revenant sur une page,
// et un seul appel réseau quand plusieurs composants demandent la même liste.
// ---------------------------------------------------------------------------
const listCache = new Map<string, { at: number; data: Meeting[] }>();
const inflight = new Map<string, Promise<Meeting[]>>();
const listeners = new Set<() => void>();
const keyOf = (roomId?: string | null) => roomId || "*";

/** Dernière liste connue (ou null) : sert à afficher tout de suite, avant le réseau */
export function cachedMeetings(roomId?: string | null): Meeting[] | null {
  return listCache.get(keyOf(roomId))?.data ?? null;
}

/** Une réunion déjà connue d'une liste (pour ouvrir sa page sans attendre) */
export function cachedMeeting(id: string): Meeting | null {
  for (const { data } of listCache.values()) {
    const m = data.find(x => x.id === id);
    if (m) return m;
  }
  return null;
}

/** Modifie localement toutes les listes en cache (mise à jour optimiste) puis prévient les pages */
export function patchCachedMeetings(fn: (list: Meeting[]) => Meeting[]) {
  for (const [k, v] of listCache) listCache.set(k, { at: v.at, data: fn(v.data) });
  listeners.forEach(l => l());
}

export function onMeetingsCacheChange(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** maxAge : réutilise une liste plus récente que ce délai (ms) au lieu d'appeler la base */
export async function listMeetings(roomId?: string | null, maxAge = 0): Promise<Meeting[]> {
  const key = keyOf(roomId);
  const hit = listCache.get(key);
  if (hit && maxAge > 0 && Date.now() - hit.at < maxAge) return hit.data;
  const running = inflight.get(key);
  if (running) return running;
  const p = (async () => {
    const { data, error } = await mdb.rpc("meet_list", { p_room: roomId || null });
    if (error) throw error;
    const list = ((data || []) as Meeting[]).map(m => ({ ...m, settings: { ...DEFAULT_SETTINGS, ...(m.settings || {}) } }));
    listCache.set(key, { at: Date.now(), data: list });
    return list;
  })();
  inflight.set(key, p);
  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
}

/** Regroupe les rafales (temps réel) en un seul appel */
export function debounce<T extends (...a: any[]) => void>(fn: T, ms: number) {
  let t: ReturnType<typeof setTimeout> | null = null;
  const run = (...a: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn(...a);
    }, ms);
  };
  run.cancel = () => t && clearTimeout(t);
  return run;
}

// ---------------------------------------------------------------------------
// Préchargement : code de la visio + serveur (fonction Netlify réveillée, connexion
// LiveKit préparée) pour que « Rejoindre » soit immédiat.
// ---------------------------------------------------------------------------
let roomCode: Promise<unknown> | null = null;
export function preloadMeetingRoom() {
  if (typeof window === "undefined") return;
  roomCode ??= import("@/views/MeetingRoom").catch(() => (roomCode = null));
}

let warm: Promise<string | null> | null = null;
/** Réveille la route du jeton et renvoie l'adresse LiveKit (pour préparer la connexion) */
export function warmMeetServer(): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  warm ??= fetch("/api/meet/token", { method: "GET", cache: "no-store" })
    .then(r => (r.ok ? r.json() : null))
    .then(b => (b?.url as string) || null)
    .catch(() => {
      warm = null;
      return null;
    });
  return warm;
}

/** Lance les préchargements quand le navigateur est libre */
export function preloadWhenIdle() {
  if (typeof window === "undefined") return;
  const go = () => {
    preloadMeetingRoom();
    void warmMeetServer();
  };
  const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, o?: { timeout: number }) => number);
  if (ric) ric(go, { timeout: 2500 });
  else setTimeout(go, 1200);
}

export async function createMeeting(input: {
  roomId: string;
  title: string;
  startNow: boolean;
  scheduledAt?: string | null;
  duration?: number;
  description?: string;
  settings?: Partial<MeetSettings>;
}) {
  const { data, error } = await mdb.rpc("meet_create", {
    p_room: input.roomId,
    p_title: input.title,
    p_start_now: input.startNow,
    p_scheduled_at: input.scheduledAt || null,
    p_duration: input.duration || 60,
    p_description: input.description || "",
    p_settings: input.settings || {},
  });
  if (error) throw error;
  return data as { id: string; status: MeetStatus };
}

export async function updateMeeting(id: string, patch: { title?: string; scheduledAt?: string | null; duration?: number; description?: string }) {
  const { error } = await mdb.rpc("meet_update", {
    p_meeting: id,
    p_title: patch.title ?? null,
    p_scheduled_at: patch.scheduledAt ?? null,
    p_duration: patch.duration ?? null,
    p_description: patch.description ?? null,
  });
  if (error) throw error;
}

export const cancelMeeting = async (id: string) => {
  const { error } = await mdb.rpc("meet_cancel", { p_meeting: id });
  if (error) throw error;
};
export const deleteMeeting = async (id: string) => {
  const { error } = await mdb.rpc("meet_delete", { p_meeting: id });
  if (error) throw error;
};
export const heartbeat = async (id: string): Promise<MeetStatus | null> => {
  const { data } = await mdb.rpc("meet_heartbeat", { p_meeting: id });
  return (data as MeetStatus) || null;
};
export const leaveMeeting = async (id: string) => {
  await mdb.rpc("meet_leave", { p_meeting: id });
};
export async function meetingReport(id: string): Promise<ReportRow[]> {
  const { data, error } = await mdb.rpc("meet_report", { p_meeting: id });
  if (error) throw error;
  return (data || []) as ReportRow[];
}

export async function fetchJoin(meetingId: string): Promise<JoinInfo> {
  const res = await fetch("/api/meet/token", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ meetingId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new MeetError(body.error || "unavailable", body.message || "Réunion indisponible");
  return body as JoinInfo;
}

export type ModerateAction = "mute" | "mute_all" | "lower_hand" | "lower_all" | "remove" | "settings" | "end";

export async function moderate(
  meetingId: string,
  action: ModerateAction,
  extra: { identity?: string; source?: "microphone" | "camera" | "screen_share"; settings?: Partial<MeetSettings> } = {},
) {
  const res = await fetch("/api/meet/moderate", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ meetingId, action, ...extra }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new MeetError(body.error || "failed", body.message || "Action impossible");
  return body as { ok: true; settings?: MeetSettings };
}

export async function loadMessages(meetingId: string): Promise<MeetMessage[]> {
  const { data, error } = await mdb
    .from("meeting_messages")
    .select("*")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data || []) as MeetMessage[];
}

export async function sendMessage(meetingId: string, senderId: string, body: string, clientId: string) {
  const { data, error } = await mdb
    .from("meeting_messages")
    .insert({ meeting_id: meetingId, sender_id: senderId, body, client_id: clientId })
    .select("*")
    .single();
  if (error) throw error;
  return data as MeetMessage;
}

export const deleteMessage = async (id: string) => {
  const { error } = await mdb.rpc("meet_delete_message", { p_message: id });
  if (error) throw error;
};

/** 3 h 05 / 12 min / 45 s */
export function formatDuration(seconds: number, lang: string) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (lang === "ar") return h ? `${h} س ${m} د` : m ? `${m} د` : `${s} ث`;
  if (h) return `${h} h ${String(m).padStart(2, "0")}`;
  if (m) return `${m} min`;
  return `${s} s`;
}

/** Chronomètre 00:12:04 */
export function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export const initials = (name?: string | null) =>
  (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p.charAt(0).toUpperCase())
    .join("") || "?";

/** Couleur stable par personne (avatars sans photo) */
const HUES = [210, 262, 330, 15, 160, 190, 40, 290];
export function personHue(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return HUES[Math.abs(h) % HUES.length];
}

export const REACTIONS = ["👏", "👍", "❤️", "😂", "😮", "🎉", "🤔", "✅"];

/** Le navigateur peut-il faire de la visio ? (iOS 12 et vieux navigateurs : non) */
export function webrtcSupported() {
  if (typeof window === "undefined") return true;
  return typeof (window as any).RTCPeerConnection === "function" && !!navigator.mediaDevices?.getUserMedia;
}
export function screenShareSupported() {
  if (typeof navigator === "undefined") return false;
  return !!(navigator.mediaDevices as any)?.getDisplayMedia;
}

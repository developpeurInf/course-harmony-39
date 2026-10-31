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

export async function listMeetings(roomId?: string | null): Promise<Meeting[]> {
  const { data, error } = await mdb.rpc("meet_list", { p_room: roomId || null });
  if (error) throw error;
  return ((data || []) as Meeting[]).map(m => ({ ...m, settings: { ...DEFAULT_SETTINGS, ...(m.settings || {}) } }));
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

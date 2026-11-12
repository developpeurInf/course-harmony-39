/**
 * Réunions vidéo (côté serveur uniquement) : client Supabase au nom de l'utilisateur,
 * accès à LiveKit (jetons + modération).
 * Variables d'environnement (Netlify → Site configuration → Environment variables) :
 *   LIVEKIT_URL          wss://xxxx.livekit.cloud
 *   LIVEKIT_API_KEY      clé API du projet LiveKit
 *   LIVEKIT_API_SECRET   secret de la clé (ne jamais l'exposer au navigateur)
 */
import { createClient } from "@supabase/supabase-js";
import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://qsroveljtrscsgkykmfh.supabase.co";
const SUPABASE_ANON =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzcm92ZWxqdHJzY3Nna3lrbWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2NTAxMjEsImV4cCI6MjA3MDIyNjEyMX0.7NE0xKtqHcIEobXKJnNycCZIgGwx_aIlZGhaZzY_nbA";

export interface MeetSettings {
  chat?: boolean;
  students_mic?: boolean;
  students_cam?: boolean;
  students_share?: boolean;
  locked?: boolean;
}

export function livekitConfig() {
  const url = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL || "";
  const key = process.env.LIVEKIT_API_KEY || "";
  const secret = process.env.LIVEKIT_API_SECRET || "";
  if (!url || !key || !secret) return null;
  return { url, key, secret, httpUrl: url.replace(/^ws/, "http") };
}

export const roomName = (meetingId: string) => `meet-${meetingId}`;

/** Client Supabase qui agit avec la session de l'utilisateur (les règles RLS s'appliquent) */
export function userClient(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+/i.test(auth)) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Sources qu'un participant peut publier */
export function allowedSources(role: "host" | "student", s: MeetSettings): TrackSource[] {
  if (role === "host") return [TrackSource.CAMERA, TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO];
  const out: TrackSource[] = [];
  if (s.students_mic !== false) out.push(TrackSource.MICROPHONE);
  if (s.students_cam !== false) out.push(TrackSource.CAMERA);
  if (s.students_share) out.push(TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO);
  return out;
}

export async function mintToken(opts: {
  meetingId: string;
  identity: string;
  name: string;
  role: "host" | "student";
  avatar?: string | null;
  settings: MeetSettings;
}) {
  const cfg = livekitConfig();
  if (!cfg) throw new Error("not_configured");
  const at = new AccessToken(cfg.key, cfg.secret, {
    identity: opts.identity,
    name: opts.name,
    ttl: "6h",
    metadata: JSON.stringify({ role: opts.role, avatar: opts.avatar || null }),
    attributes: { role: opts.role },
  });
  at.addGrant({
    room: roomName(opts.meetingId),
    roomJoin: true,
    canSubscribe: true,
    canPublish: true,
    canPublishData: true,
    canUpdateOwnMetadata: true,
    roomAdmin: opts.role === "host",
    canPublishSources: allowedSources(opts.role, opts.settings),
  });
  return { token: await at.toJwt(), url: cfg.url };
}

export function roomService() {
  const cfg = livekitConfig();
  if (!cfg) return null;
  return new RoomServiceClient(cfg.httpUrl, cfg.key, cfg.secret);
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

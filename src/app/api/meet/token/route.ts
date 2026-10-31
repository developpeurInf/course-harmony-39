/**
 * Jeton LiveKit d'une réunion de classe.
 * La base décide (rpc meet_join) : professeur de la classe ou élève de la classe,
 * réunion en direct, pas exclu, pas verrouillée. Le secret LiveKit ne quitte jamais le serveur.
 */
import { json, livekitConfig, mintToken, userClient } from "@/lib/server/meet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!livekitConfig()) {
    return json({ error: "not_configured", message: "Le serveur vidéo n'est pas encore configuré (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)." }, 503);
  }
  const db = userClient(req);
  if (!db) return json({ error: "auth", message: "Connexion requise" }, 401);
  let meetingId = "";
  try {
    meetingId = String(((await req.json()) as { meetingId?: string }).meetingId || "");
  } catch {
    /* corps vide */
  }
  if (!/^[0-9a-f-]{36}$/i.test(meetingId)) return json({ error: "bad_request", message: "Réunion inconnue" }, 400);

  const { data, error } = await db.rpc("meet_join" as never, { p_meeting: meetingId } as never);
  if (error || !data) {
    const forbidden = (error as { code?: string } | null)?.code === "42501";
    return json({ error: forbidden ? "forbidden" : "unavailable", message: error?.message || "Réunion indisponible" }, forbidden ? 403 : 409);
  }
  const info = data as {
    meeting: { id: string; settings: Record<string, boolean> };
    role: "host" | "student";
    user_id: string;
    name: string;
    avatar_url: string | null;
  };
  const { token, url } = await mintToken({
    meetingId,
    identity: info.user_id,
    name: info.name,
    role: info.role,
    avatar: info.avatar_url,
    settings: info.meeting.settings || {},
  });
  return json({ token, url, ...info });
}

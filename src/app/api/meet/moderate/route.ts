/**
 * Actions du professeur pendant une réunion : couper un micro / une caméra / un partage,
 * couper tous les micros, baisser les mains, retirer un élève, changer les droits des élèves,
 * terminer pour tout le monde. Seul le professeur de la réunion est accepté.
 */
import { TrackSource } from "livekit-server-sdk";
import { allowedSources, json, roomName, roomService, userClient, type MeetSettings } from "@/lib/server/meet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  meetingId?: string;
  action?: "mute" | "mute_all" | "lower_hand" | "lower_all" | "remove" | "settings" | "end";
  identity?: string;
  source?: "microphone" | "camera" | "screen_share";
  settings?: MeetSettings;
};

const SOURCES: Record<string, TrackSource[]> = {
  microphone: [TrackSource.MICROPHONE],
  camera: [TrackSource.CAMERA],
  screen_share: [TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO],
};

export async function POST(req: Request) {
  const db = userClient(req);
  if (!db) return json({ error: "auth" }, 401);
  const body = (await req.json().catch(() => ({}))) as Body;
  const meetingId = String(body.meetingId || "");
  if (!/^[0-9a-f-]{36}$/i.test(meetingId)) return json({ error: "bad_request" }, 400);

  const { data: auth } = await db.auth.getUser();
  const me = auth?.user?.id;
  const { data: meeting } = await db.from("meetings" as never).select("id, host_id, status, settings").eq("id", meetingId).maybeSingle();
  const m = meeting as { id: string; host_id: string; status: string; settings: MeetSettings } | null;
  if (!me || !m || m.host_id !== me) return json({ error: "forbidden", message: "Réservé au professeur de la réunion" }, 403);

  const svc = roomService();
  const room = roomName(meetingId);
  const others = async () => {
    if (!svc) return [];
    try {
      return (await svc.listParticipants(room)).filter((p) => p.identity !== me);
    } catch {
      return [];
    }
  };

  try {
    switch (body.action) {
      case "mute": {
        if (!svc || !body.identity) break;
        const p = await svc.getParticipant(room, body.identity);
        const wanted = SOURCES[body.source || "microphone"] || SOURCES.microphone;
        for (const t of p.tracks) if (wanted.includes(t.source) && !t.muted) await svc.mutePublishedTrack(room, p.identity, t.sid, true);
        break;
      }
      case "mute_all": {
        for (const p of await others())
          for (const t of p.tracks) if (t.source === TrackSource.MICROPHONE && !t.muted) await svc!.mutePublishedTrack(room, p.identity, t.sid, true);
        break;
      }
      case "lower_hand": {
        if (svc && body.identity) await svc.updateParticipant(room, body.identity, { attributes: { hand: "" } });
        break;
      }
      case "lower_all": {
        for (const p of await others()) if (p.attributes?.hand) await svc!.updateParticipant(room, p.identity, { attributes: { hand: "" } });
        break;
      }
      case "remove": {
        if (!body.identity || body.identity === me) break;
        const { error } = await db.rpc("meet_kick" as never, { p_meeting: meetingId, p_user: body.identity } as never);
        if (error) return json({ error: "failed", message: error.message }, 400);
        if (svc) await svc.removeParticipant(room, body.identity).catch(() => undefined);
        break;
      }
      case "settings": {
        const { data, error } = await db.rpc("meet_update" as never, { p_meeting: meetingId, p_settings: body.settings || {} } as never);
        if (error) return json({ error: "failed", message: error.message }, 400);
        const settings = ((data as { settings?: MeetSettings } | null)?.settings || {}) as MeetSettings;
        const sources = allowedSources("student", settings);
        for (const p of await others()) {
          await svc!.updateParticipant(room, p.identity, {
            permission: { canSubscribe: true, canPublish: true, canPublishData: true, canUpdateMetadata: true, canPublishSources: sources },
          });
        }
        return json({ ok: true, settings });
      }
      case "end": {
        const { error } = await db.rpc("meet_end" as never, { p_meeting: meetingId } as never);
        if (error) return json({ error: "failed", message: error.message }, 400);
        if (svc) await svc.deleteRoom(room).catch(() => undefined);
        break;
      }
      default:
        return json({ error: "bad_request" }, 400);
    }
  } catch (e) {
    return json({ error: "livekit", message: e instanceof Error ? e.message : String(e) }, 502);
  }
  return json({ ok: true });
}

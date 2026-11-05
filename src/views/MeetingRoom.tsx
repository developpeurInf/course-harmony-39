"use client";

/**
 * Page d'une réunion (/meet/:meetingId), en plein écran : salle d'attente → réunion → fin.
 */
import { useCallback, useEffect, useState } from "react";
import { LiveKitRoom } from "@livekit/components-react";
import { DisconnectReason, Room, VideoPresets, type RoomOptions } from "livekit-client";
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardList, Loader2, RotateCcw, ServerCog, UserX } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, useNavigate, useParams } from "@/lib/router";
import { supabase } from "@/integrations/supabase/client";
import { cachedMeeting, clock, debounce, fetchJoin, leaveMeeting, listMeetings, moderate, warmMeetServer, webrtcSupported, type JoinInfo, type Meeting, type MeetSettings, DEFAULT_SETTINGS } from "@/lib/meet";
import { MeetLobby, type LobbyChoices } from "@/components/meet/MeetLobby";
import { MeetStage } from "@/components/meet/MeetStage";
import { useTr } from "@/components/meet/useTr";
import "@/components/meet/meet.css";

type Stage =
  | { k: "loading" }
  | { k: "lobby" }
  | { k: "room"; join: JoinInfo; choices: LobbyChoices }
  | { k: "left"; startedAt?: string | null }
  | { k: "ended"; startedAt?: string | null }
  | { k: "kicked" }
  | { k: "error"; code: string; message: string };

const ROOM_OPTIONS: RoomOptions = {
  // "screen" : tient compte de la densité de l'écran (Retina, téléphones) pour choisir la meilleure qualité
  adaptiveStream: { pixelDensity: "screen" },
  dynacast: true,
  videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
  audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  publishDefaults: {
    simulcast: true,
    videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
    videoEncoding: VideoPresets.h720.encoding,
    dtx: true,
    red: true,
    videoCodec: "vp8",
  },
  disconnectOnPageLeave: true,
};

export default function MeetingRoom() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { tr, dir } = useTr();
  // Réunion déjà connue (liste, bandeau) : l'écran d'accueil s'affiche sans attendre le réseau
  const [meeting, setMeeting] = useState<Meeting | null>(() => (meetingId ? cachedMeeting(meetingId) : null));
  const [stage, setStage] = useState<Stage>(() => (meetingId && cachedMeeting(meetingId) ? { k: "lobby" } : { k: "loading" }));
  const inRoom = stage.k === "room";

  // Pendant l'accueil : réveiller le serveur et ouvrir la connexion LiveKit à l'avance
  useEffect(() => {
    let alive = true;
    void warmMeetServer().then(url => {
      if (alive && url) void new Room().prepareConnection(url).catch(() => undefined);
    });
    return () => {
      alive = false;
    };
  }, []);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true, state: { from: { pathname: location.pathname } } });
  }, [loading, user, navigate, location.pathname]);

  const refresh = useCallback(async () => {
    if (!meetingId) return;
    try {
      const all = await listMeetings(null);
      const m = all.find(x => x.id === meetingId) || null;
      setMeeting(m);
      setStage(s => (s.k === "loading" ? (m ? { k: "lobby" } : { k: "error", code: "forbidden", message: "" }) : s));
    } catch (e: any) {
      setStage(s => (s.k === "loading" ? { k: "error", code: "unavailable", message: e?.message || "" } : s));
    }
  }, [meetingId]);

  useEffect(() => {
    // Dans la salle, la présence est suivie par la salle elle-même : pas d'appels inutiles
    if (!user || inRoom) return;
    void refresh();
    const soon = debounce(() => void refresh(), 300);
    const t = setInterval(() => !document.hidden && void refresh(), 20_000);
    const ch = supabase
      .channel(`meet-page-${meetingId}`)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "meetings", filter: `id=eq.${meetingId}` }, () => soon())
      .subscribe();
    return () => {
      clearInterval(t);
      soon.cancel();
      void supabase.removeChannel(ch);
    };
  }, [user, meetingId, refresh, inRoom]);

  const backTo = meeting ? (user?.role === "professor" ? `/rooms/${meeting.room_id}/meet` : "/meetings") : "/dashboard";

  const join = async (choices: LobbyChoices) => {
    if (!meetingId) return;
    setJoining(true);
    try {
      const info = await fetchJoin(meetingId);
      const s = { ...DEFAULT_SETTINGS, ...(info.meeting.settings || {}) } as MeetSettings;
      const student = info.role !== "host";
      setStage({
        k: "room",
        join: info,
        choices: {
          ...choices,
          audio: choices.audio && (!student || s.students_mic),
          video: choices.video && (!student || s.students_cam),
        },
      });
    } catch (e: any) {
      if (e?.code === "not_configured" || e?.code === "forbidden") setStage({ k: "error", code: e.code, message: e.message });
      else toast.error(e?.message || tr("Impossible de rejoindre", "تعذر الانضمام", "Could not join"));
      void refresh();
    } finally {
      setJoining(false);
    }
  };

  const leave = async (endForAll: boolean) => {
    if (!meetingId) return;
    const startedAt = stage.k === "room" ? stage.join.meeting.started_at : meeting?.started_at;
    if (endForAll) {
      try {
        await moderate(meetingId, "end");
      } catch (e: any) {
        toast.error(e?.message || "");
      }
      setStage({ k: "ended", startedAt });
    } else {
      setStage({ k: "left", startedAt });
    }
    void leaveMeeting(meetingId);
    void refresh();
  };

  if (!webrtcSupported()) {
    return (
      <EndCard dir={dir} icon={<AlertTriangle className="h-7 w-7 text-amber-300" />} title={tr("Navigateur non compatible", "متصفح غير متوافق", "Browser not supported")}
        text={tr("Ce navigateur ne permet pas la visio. Mettez à jour Safari / Chrome, ou utilisez un autre appareil.", "هذا المتصفح لا يدعم الفيديو. حدّث Safari أو Chrome، أو استخدم جهازا آخر.", "This browser can't do video calls. Update Safari / Chrome or use another device.")}
        actions={<BackButton onClick={() => navigate(backTo)} label={tr("Retour", "رجوع", "Back")} />} />
    );
  }

  if (stage.k === "loading" || loading || !user) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#0b0e14] text-white/60">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (stage.k === "error") {
    const notConfigured = stage.code === "not_configured";
    return (
      <EndCard
        dir={dir}
        icon={notConfigured ? <ServerCog className="h-7 w-7 text-sky-300" /> : <AlertTriangle className="h-7 w-7 text-amber-300" />}
        title={
          notConfigured
            ? tr("Serveur vidéo pas encore configuré", "خادم الفيديو غير مهيأ بعد", "Video server not configured yet")
            : tr("Réunion introuvable", "الاجتماع غير موجود", "Meeting not found")
        }
        text={
          notConfigured
            ? user.role === "professor"
              ? tr(
                  "Ajoutez LIVEKIT_URL, LIVEKIT_API_KEY et LIVEKIT_API_SECRET dans les variables d'environnement de Netlify, puis redéployez.",
                  "أضف LIVEKIT_URL و LIVEKIT_API_KEY و LIVEKIT_API_SECRET في متغيرات Netlify ثم أعد النشر.",
                  "Add LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET to the Netlify environment variables, then redeploy.",
                )
              : tr("Les réunions vidéo ne sont pas encore disponibles. Réessayez plus tard.", "اجتماعات الفيديو غير متاحة بعد. حاول لاحقا.", "Video meetings aren't available yet. Try again later.")
            : stage.message || tr("Cette réunion n'existe pas ou est réservée aux élèves de la classe.", "هذا الاجتماع غير موجود أو خاص بتلاميذ القسم.", "This meeting doesn't exist or is only for students of the class.")
        }
        actions={<BackButton onClick={() => navigate(backTo)} label={tr("Retour", "رجوع", "Back")} />}
      />
    );
  }

  if (stage.k === "room") {
    const j = stage.join;
    return (
      <LiveKitRoom
        serverUrl={j.url}
        token={j.token}
        connect
        options={ROOM_OPTIONS}
        audio={stage.choices.audio ? { deviceId: stage.choices.audioDeviceId, echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false}
        video={stage.choices.video ? { deviceId: stage.choices.videoDeviceId, resolution: VideoPresets.h720.resolution } : false}
        onDisconnected={reason => {
          if (reason === DisconnectReason.PARTICIPANT_REMOVED) setStage({ k: "kicked" });
          else if (reason === DisconnectReason.ROOM_DELETED) setStage({ k: "ended", startedAt: j.meeting.started_at });
          else if (reason !== DisconnectReason.CLIENT_INITIATED) setStage(s => (s.k === "room" ? { k: "left", startedAt: j.meeting.started_at } : s));
          void leaveMeeting(j.meeting.id);
        }}
        onError={e => toast.error(e.message)}
        onMediaDeviceFailure={() => toast.error(tr("Caméra ou micro indisponible", "الكاميرا أو الميكروفون غير متاح", "Camera or microphone unavailable"))}
        className="contents"
      >
        <MeetStage
          meetingId={j.meeting.id}
          title={j.meeting.title}
          roomName={j.room_name}
          hostId={j.meeting.host_id}
          isHost={j.role === "host"}
          me={j.user_id}
          startedAt={j.meeting.started_at}
          initialSettings={{ ...DEFAULT_SETTINGS, ...(j.meeting.settings || {}) }}
          onLeave={endForAll => void leave(endForAll)}
          onEnded={() => setStage({ k: "ended", startedAt: j.meeting.started_at })}
        />
      </LiveKitRoom>
    );
  }

  if (stage.k === "kicked") {
    return (
      <EndCard dir={dir} icon={<UserX className="h-7 w-7 text-rose-300" />} title={tr("Vous avez été retiré de la réunion", "تم إخراجك من الاجتماع", "You were removed from the meeting")}
        text={tr("Le professeur vous a retiré. Contactez-le si c'est une erreur.", "قام الأستاذ بإخراجك. تواصل معه إذا كان ذلك خطأ.", "The teacher removed you. Contact them if this is a mistake.")}
        actions={<BackButton onClick={() => navigate(backTo)} label={tr("Retour", "رجوع", "Back")} />} />
    );
  }

  if (stage.k === "left" || stage.k === "ended") {
    const isHost = meeting?.host_id === user.id;
    const ended = stage.k === "ended" || meeting?.status === "ended";
    const dur = stage.startedAt ? Date.now() - new Date(stage.startedAt).getTime() : 0;
    return (
      <EndCard
        dir={dir}
        icon={<CheckCircle2 className="h-7 w-7 text-emerald-300" />}
        title={ended ? tr("La réunion est terminée", "انتهى الاجتماع", "The meeting has ended") : tr("Vous avez quitté la réunion", "لقد غادرت الاجتماع", "You left the meeting")}
        text={
          ended && dur > 0
            ? tr(`Durée : ${clock(dur)}. Le chat reste disponible dans la page Réunions.`, `المدة: ${clock(dur)}. تبقى الدردشة متاحة في صفحة الاجتماعات.`, `Duration: ${clock(dur)}. The chat stays available on the Meetings page.`)
            : meeting?.title || ""
        }
        actions={
          <>
            {!ended && meeting?.status === "live" && (
              <button type="button" onClick={() => setStage({ k: "lobby" })} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
                <RotateCcw className="h-4 w-4" />
                {tr("Rejoindre à nouveau", "الانضمام مجددا", "Rejoin")}
              </button>
            )}
            {isHost && meeting && (
              <button
                type="button"
                onClick={() => navigate(`/rooms/${meeting.room_id}/meet?report=${meeting.id}`)}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-white/10 px-5 text-sm font-semibold ring-1 ring-white/15 hover:bg-white/15"
              >
                <ClipboardList className="h-4 w-4" />
                {tr("Rapport de présence", "تقرير الحضور", "Attendance report")}
              </button>
            )}
            <BackButton onClick={() => navigate(backTo)} label={tr("Retour aux réunions", "العودة إلى الاجتماعات", "Back to meetings")} />
          </>
        }
      />
    );
  }

  // Salle d'attente
  const m = meeting!;
  return (
    <MeetLobby
      title={m.title}
      roomName={m.room_name}
      hostName={m.host_name}
      isHost={m.host_id === user.id}
      userName={user.name}
      userId={user.id}
      status={m.status}
      scheduledAt={m.scheduled_at}
      online={m.online}
      locked={!!m.settings?.locked}
      joining={joining}
      onJoin={c => void join(c)}
      onBack={() => navigate(backTo)}
    />
  );
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white">
      <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
      {label}
    </button>
  );
}

function EndCard({ dir, icon, title, text, actions }: { dir: string; icon: React.ReactNode; title: string; text: string; actions: React.ReactNode }) {
  return (
    <div dir={dir} className="meet-shell relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#0b0e14] px-4 text-white">
      <div className="meet-aurora pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md rounded-3xl bg-white/[0.04] p-8 text-center ring-1 ring-white/10 backdrop-blur">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">{icon}</span>
        <h1 className="mt-5 text-xl font-semibold">{title}</h1>
        {text && <p className="mt-2 text-sm leading-relaxed text-white/60">{text}</p>}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{actions}</div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const HEARTBEAT_MS = 60000;

/**
 * Suivi des sessions élève (connexion, présence, déconnexion).
 * - ne dépend que de l'identifiant / du rôle de l'élève (le renouvellement du jeton ne
 *   ferme plus la session pour en ouvrir une autre) ;
 * - room_id gardé en mémoire (plus de relecture du profil à chaque activité) ;
 * - battement de présence en pause quand l'onglet est caché.
 */
export const useSessionTracking = () => {
  const { user, session } = useAuth();
  const userId = user?.id;
  const isStudent = user?.role === 'student';
  const profileRoomId = user?.room_id;
  const hasSession = !!session;

  const sessionIdRef = useRef<string | null>(null);
  const roomIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || !hasSession || !isStudent) return;

    let cancelled = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;

    const beat = () => {
      if (document.hidden || !sessionIdRef.current) return;
      void supabase
        .from('student_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('id', sessionIdRef.current);
    };
    const onVisibility = () => {
      // retour sur l'onglet : présence signalée tout de suite
      if (!document.hidden) beat();
    };

    const startSession = async () => {
      try {
        // room_id : celui du profil déjà chargé, sinon lu une fois
        let roomId: string | null = profileRoomId || null;
        if (!roomId) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('room_id')
            .eq('id', userId)
            .single();
          if (profileError) {
            console.error('Error fetching profile:', profileError.message);
            return;
          }
          roomId = profile?.room_id || null;
        }
        if (!roomId || cancelled) return;
        roomIdRef.current = roomId;

        // Sessions restées ouvertes (onglet fermé brutalement…) : clôturées en parallèle
        const now = new Date();
        const { data: existingSessions } = await supabase
          .from('student_sessions')
          .select('id, session_start')
          .eq('student_id', userId)
          .eq('is_active', true);

        if (existingSessions && existingSessions.length > 0) {
          await Promise.all(existingSessions.map(s =>
            supabase
              .from('student_sessions')
              .update({
                session_end: now.toISOString(),
                is_active: false,
                duration_minutes: Math.max(0, Math.round((now.getTime() - new Date(s.session_start).getTime()) / 60000)),
              })
              .eq('id', s.id)
          ));
        }
        if (cancelled) return;

        // Create a new session
        const nowIso = new Date().toISOString();
        const { data, error } = await supabase
          .from('student_sessions')
          .insert({
            student_id: userId,
            room_id: roomId,
            session_start: nowIso,
            is_active: true,
            last_activity: nowIso,
          })
          .select('id')
          .single();

        if (error || !data) {
          console.error('Error creating session:', error?.message);
          return;
        }

        sessionIdRef.current = data.id;
        // démonté pendant la création : on referme aussitôt cette session
        if (cancelled) {
          void endSession();
          return;
        }

        // Log login activity
        const { error: activityError } = await supabase.from('student_activities').insert({
          student_id: userId,
          room_id: roomId,
          session_id: data.id,
          activity_type: 'login',
          activity_data: { timestamp: nowIso },
        });
        if (activityError) console.error('Error creating activity:', activityError.message);

        if (cancelled) return;
        heartbeat = setInterval(beat, HEARTBEAT_MS);
        document.addEventListener('visibilitychange', onVisibility);
      } catch (error) {
        console.error('Error starting session:', error);
      }
    };

    const endSession = async () => {
      const sessionId = sessionIdRef.current;
      const roomId = roomIdRef.current;
      sessionIdRef.current = null;
      if (!sessionId) return;

      try {
        const now = new Date();
        const { data: sessionData } = await supabase
          .from('student_sessions')
          .select('session_start')
          .eq('id', sessionId)
          .single();

        if (sessionData) {
          const durationMinutes = Math.max(0, Math.round((now.getTime() - new Date(sessionData.session_start).getTime()) / 60000));

          const { error: updateError } = await supabase
            .from('student_sessions')
            .update({
              session_end: now.toISOString(),
              is_active: false,
              duration_minutes: durationMinutes,
            })
            .eq('id', sessionId);
          if (updateError) console.error('Error updating session:', updateError.message);

          if (roomId) {
            await supabase.from('student_activities').insert({
              student_id: userId,
              room_id: roomId,
              session_id: sessionId,
              activity_type: 'logout',
              activity_data: {
                timestamp: now.toISOString(),
                duration_minutes: durationMinutes,
              },
            });
          }
        }
      } catch (error) {
        console.error('Error ending session:', error);
      }
    };

    void startSession();

    // Cleanup on unmount or logout
    return () => {
      cancelled = true;
      if (heartbeat) clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', onVisibility);
      void endSession();
    };
  }, [userId, isStudent, hasSession, profileRoomId]);

  // Function to log specific activities
  const logActivity = useCallback(async (activityType: string, activityData?: any) => {
    if (!userId || !isStudent || !sessionIdRef.current || !roomIdRef.current) return;
    try {
      await supabase.from('student_activities').insert({
        student_id: userId,
        room_id: roomIdRef.current,
        session_id: sessionIdRef.current,
        activity_type: activityType,
        activity_data: activityData || {},
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }, [userId, isStudent]);

  return { logActivity };
};

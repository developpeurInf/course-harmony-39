import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useSessionTracking = () => {
  const { user, session } = useAuth();
  const sessionIdRef = useRef<string | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    console.log('Session tracking hook - User:', user?.role, 'Session exists:', !!session);
    
    if (!user || !session || user.role !== 'student') {
      console.log('Session tracking skipped - not a student or no session');
      return;
    }

    const startSession = async () => {
      try {
        console.log('Starting session tracking for student:', user.id);
        
        // Get room_id from profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('room_id')
          .eq('id', user.id)
          .single();

        console.log('Profile data:', profile, 'Error:', profileError);

        if (profileError) {
          console.error('Error fetching profile:', profileError);
          return;
        }

        if (!profile?.room_id) {
          console.warn('Student has no room assignment');
          return;
        }

        console.log('Creating session for room:', profile.room_id);

        // Create a new session
        const { data, error } = await supabase
          .from('student_sessions')
          .insert({
            student_id: user.id,
            room_id: profile.room_id,
            session_start: new Date().toISOString(),
            is_active: true,
            last_activity: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating session:', error);
          return;
        }

        console.log('Session created successfully:', data.id);
        sessionIdRef.current = data.id;

        // Log login activity
        const { error: activityError } = await supabase.from('student_activities').insert({
          student_id: user.id,
          room_id: profile.room_id,
          session_id: data.id,
          activity_type: 'login',
          activity_data: {
            timestamp: new Date().toISOString(),
          },
        });

        if (activityError) {
          console.error('Error creating activity:', activityError);
        } else {
          console.log('Login activity logged successfully');
        }

        // Start heartbeat to update last_activity
        heartbeatIntervalRef.current = setInterval(async () => {
          if (sessionIdRef.current) {
            await supabase
              .from('student_sessions')
              .update({
                last_activity: new Date().toISOString(),
              })
              .eq('id', sessionIdRef.current);
          }
        }, 60000); // Update every minute
      } catch (error) {
        console.error('Error starting session:', error);
      }
    };

    const endSession = async () => {
      if (!sessionIdRef.current) return;

      try {
        const now = new Date();
        
        // Get session start time to calculate duration
        const { data: sessionData } = await supabase
          .from('student_sessions')
          .select('session_start')
          .eq('id', sessionIdRef.current)
          .single();

        if (sessionData) {
          const startTime = new Date(sessionData.session_start);
          const durationMinutes = Math.round((now.getTime() - startTime.getTime()) / 60000);

          // Update session as ended
          await supabase
            .from('student_sessions')
            .update({
              session_end: now.toISOString(),
              is_active: false,
              duration_minutes: durationMinutes,
            })
            .eq('id', sessionIdRef.current);

          // Log logout activity
          const { data: profile } = await supabase
            .from('profiles')
            .select('room_id')
            .eq('id', user.id)
            .single();

          if (profile?.room_id) {
            await supabase.from('student_activities').insert({
              student_id: user.id,
              room_id: profile.room_id,
              session_id: sessionIdRef.current,
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

    startSession();

    // Cleanup on unmount or logout
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      endSession();
    };
  }, [user, session]);

  // Function to log specific activities
  const logActivity = async (activityType: string, activityData?: any) => {
    if (!user || user.role !== 'student' || !sessionIdRef.current) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('room_id')
        .eq('id', user.id)
        .single();

      if (profile?.room_id) {
        await supabase.from('student_activities').insert({
          student_id: user.id,
          room_id: profile.room_id,
          session_id: sessionIdRef.current,
          activity_type: activityType,
          activity_data: activityData || {},
        });
      }
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  return { logActivity };
};

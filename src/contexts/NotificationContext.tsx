import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export type NotificationType =
  | 'course_added'
  | 'course_updated'
  | 'course_deleted'
  | 'exercise_added'
  | 'exercise_updated'
  | 'exercise_deleted'
  | 'exam_added'
  | 'exam_updated'
  | 'exam_deleted'
  | 'exam_reminder'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | '__DELETED__'
  | '__CLEAR_ALL__';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  created_at: string;
  updated_at: string;
  course_id?: string | null;
  exam_id?: string | null;
  exercise_id?: string | null;
}

export interface NotifyRoomParams {
  roomId?: string | null;
  courseId?: string | null;
  exerciseId?: string | null;
  examId?: string | null;
  title: string;
  courseTitle?: string;
  itemType: 'course' | 'exercise' | 'exam' | 'quiz';
  action: 'add' | 'delete' | 'update';
  examDate?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<boolean>;
  markAllAsRead: () => Promise<boolean>;
  deleteNotification: (id: string) => Promise<boolean>;
  clearAllNotifications: () => Promise<boolean>;
  clearRoomStudentsNotifications: (roomId: string) => Promise<boolean>;
  createNotification: (notification: Omit<Notification, 'id' | 'created_at' | 'updated_at'>) => Promise<boolean>;
  notifyRoomStudents: (params: NotifyRoomParams) => Promise<void>;
  checkExamReminders: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Storage helper for persisted deleted IDs
const getDeletedIdsKey = (userId: string) => `course_harmony_deleted_notifs_${userId}`;

const getPersistedDeletedIds = (userId: string): Set<string> => {
  try {
    const raw = localStorage.getItem(getDeletedIdsKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch (e) {
    console.error('Failed to read deleted notifications cache:', e);
  }
  return new Set<string>();
};

const addPersistedDeletedIds = (userId: string, ids: string[]) => {
  try {
    const current = getPersistedDeletedIds(userId);
    ids.forEach(id => current.add(id));
    localStorage.setItem(getDeletedIdsKey(userId), JSON.stringify(Array.from(current)));
  } catch (e) {
    console.error('Failed to save deleted notifications cache:', e);
  }
};

// Storage helper for persisted clear timestamp per student
const getClearTsKey = (userId: string) => `course_harmony_clear_ts_${userId}`;

const getLastClearTimestamp = (userId: string): number => {
  try {
    const raw = localStorage.getItem(getClearTsKey(userId));
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to get last clear timestamp:', e);
  }
  return 0;
};

const setLastClearTimestamp = (userId: string, ts: number) => {
  try {
    const current = getLastClearTimestamp(userId);
    if (ts > current) {
      localStorage.setItem(getClearTsKey(userId), ts.toString());
    }
  } catch (e) {
    console.error('Failed to set last clear timestamp:', e);
  }
};

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const reminderCheckedRef = useRef(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }

    setLoading(true);
    try {
      const deletedIds = getPersistedDeletedIds(user.id);
      let lastClearTs = getLastClearTimestamp(user.id);

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch notifications:', error);
        return;
      }

      const allRows = data || [];

      // Check for reset markers
      const clearMarkers = allRows.filter(
        n => n.type === '__CLEAR_ALL__' || n.title === '__RESET_ROOM_NOTIFICATIONS__'
      );

      if (clearMarkers.length > 0) {
        const maxMarkerTs = Math.max(
          ...clearMarkers.map(m => new Date(m.created_at).getTime())
        );
        if (maxMarkerTs > lastClearTs) {
          lastClearTs = maxMarkerTs;
          setLastClearTimestamp(user.id, maxMarkerTs);
        }
      }

      // Filter active notifications
      const active = allRows
        .filter(n => {
          if (n.type === '__DELETED__' || n.type === '__CLEAR_ALL__') return false;
          if (n.title === '__RESET_ROOM_NOTIFICATIONS__') return false;
          if (deletedIds.has(n.id)) return false;
          const notifTime = new Date(n.created_at).getTime();
          if (lastClearTs > 0 && notifTime <= lastClearTs) return false;
          return true;
        })
        .map(notification => ({
          ...notification,
          type: (notification.type as NotificationType) || 'info'
        }));

      setNotifications(active);

      // Student client cleanup in Supabase for rows <= lastClearTs
      if (lastClearTs > 0) {
        const staleRows = allRows.filter(n => {
          const notifTime = new Date(n.created_at).getTime();
          return notifTime <= lastClearTs || n.type === '__CLEAR_ALL__' || n.title === '__RESET_ROOM_NOTIFICATIONS__';
        });

        if (staleRows.length > 0) {
          const staleIds = staleRows.map(r => r.id);
          addPersistedDeletedIds(user.id, staleIds);

          // As the student (auth.uid() = user_id), perform cleanup
          try {
            await supabase
              .from('notifications')
              .update({ type: '__DELETED__', updated_at: new Date().toISOString() })
              .eq('user_id', user.id)
              .lte('created_at', new Date(lastClearTs).toISOString());

            await supabase
              .from('notifications')
              .delete()
              .eq('user_id', user.id)
              .lte('created_at', new Date(lastClearTs).toISOString());
          } catch (cleanErr) {
            console.error('Error during student cleanup:', cleanErr);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Check for exams approaching in less than 24h
  const checkExamReminders = useCallback(async () => {
    if (!user || user.role !== 'student' || !user.room_id) return;

    try {
      const lastClearTs = getLastClearTimestamp(user.id);
      const deletedIds = getPersistedDeletedIds(user.id);

      // 1. Get courses in student's room
      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('id, title')
        .eq('room_id', user.room_id)
        .eq('is_visible', true);

      if (coursesError || !courses || courses.length === 0) return;

      const courseIds = courses.map(c => c.id);

      // 2. Get exams for these courses
      const { data: exams, error: examsError } = await supabase
        .from('exams')
        .select('*')
        .in('course_id', courseIds)
        .eq('is_visible', true);

      if (examsError || !exams || exams.length === 0) return;

      const now = new Date();

      // 3. Get existing reminders for this user
      const { data: existingReminders } = await supabase
        .from('notifications')
        .select('id, exam_id, created_at, type')
        .eq('user_id', user.id)
        .eq('type', 'exam_reminder');

      const existingExamIds = new Set(
        (existingReminders || [])
          .filter(r => {
            if (deletedIds.has(r.id)) return true;
            const reminderDate = new Date(r.created_at);
            return now.getTime() - reminderDate.getTime() < 24 * 60 * 60 * 1000;
          })
          .map(r => r.exam_id)
      );

      for (const exam of exams) {
        if (!exam.exam_date) continue;

        const examDate = new Date(exam.exam_date);
        const timeDiff = examDate.getTime() - now.getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);

        // If exam is in the future and within the next 24 hours
        if (hoursDiff > 0 && hoursDiff <= 24 && !existingExamIds.has(exam.id)) {
          // If cleared after exam creation, skip
          const examCreatedTs = new Date(exam.created_at || exam.updated_at || 0).getTime();
          if (lastClearTs > 0 && examCreatedTs <= lastClearTs) {
            continue;
          }

          const formattedDate = examDate.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          await supabase.from('notifications').insert({
            user_id: user.id,
            title: `⏰ Rappel : ${exam.type === 'quiz' ? 'Quiz' : 'Examen'} dans moins de 24h !`,
            message: `L'évaluation "${exam.title}" aura lieu le ${formattedDate}. Préparez-vous !`,
            type: 'exam_reminder',
            read: false,
            course_id: exam.course_id,
            exam_id: exam.id
          });

          existingExamIds.add(exam.id);
        }
      }

      fetchNotifications();
    } catch (err) {
      console.error('Error checking exam reminders:', err);
    }
  }, [user, fetchNotifications]);

  // Initial fetch and Realtime subscription
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    fetchNotifications();

    if (!reminderCheckedRef.current && user.role === 'student') {
      reminderCheckedRef.current = true;
      checkExamReminders();
    }

    // Set up Realtime subscription for user's notifications
    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newNotif = payload.new as Notification;
            
            // Check for reset marker
            if (newNotif.type === '__CLEAR_ALL__' || newNotif.title === '__RESET_ROOM_NOTIFICATIONS__') {
              const clearTs = new Date(newNotif.created_at).getTime();
              setLastClearTimestamp(user.id, clearTs);
              setNotifications([]);
              try {
                await supabase
                  .from('notifications')
                  .update({ type: '__DELETED__', updated_at: new Date().toISOString() })
                  .eq('user_id', user.id)
                  .lte('created_at', newNotif.created_at);

                await supabase
                  .from('notifications')
                  .delete()
                  .eq('user_id', user.id)
                  .lte('created_at', newNotif.created_at);
              } catch (e) {
                // ignore
              }
              return;
            }

            const deletedIds = getPersistedDeletedIds(user.id);
            const lastClearTs = getLastClearTimestamp(user.id);
            const notifTime = new Date(newNotif.created_at).getTime();

            if (
              newNotif.type !== '__DELETED__' &&
              !deletedIds.has(newNotif.id) &&
              (lastClearTs === 0 || notifTime > lastClearTs)
            ) {
              setNotifications(prev => [
                { ...newNotif, type: (newNotif.type as NotificationType) || 'info' },
                ...prev
              ]);
              toast.info(newNotif.title, {
                description: newNotif.message,
                duration: 5000,
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Notification;
            const deletedIds = getPersistedDeletedIds(user.id);
            const lastClearTs = getLastClearTimestamp(user.id);
            const notifTime = new Date(updated.created_at).getTime();

            if (
              updated.type === '__DELETED__' ||
              updated.type === '__CLEAR_ALL__' ||
              deletedIds.has(updated.id) ||
              (lastClearTs > 0 && notifTime <= lastClearTs)
            ) {
              setNotifications(prev => prev.filter(n => n.id !== updated.id));
            } else {
              setNotifications(prev =>
                prev.map(n => n.id === updated.id ? { ...updated, type: (updated.type as NotificationType) || 'info' } : n)
              );
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id;
            setNotifications(prev => prev.filter(n => n.id !== deletedId));
          }
        }
      )
      .subscribe();

    // Also listen to room broadcasts for students
    let roomChannel: any = null;
    if (user.role === 'student' && user.room_id) {
      roomChannel = supabase
        .channel(`room-notifications-${user.room_id}`)
        .on('broadcast', { event: 'clear_all' }, (payload) => {
          const clearTs = payload.payload?.timestamp ? new Date(payload.payload.timestamp).getTime() : Date.now();
          setLastClearTimestamp(user.id, clearTs);
          setNotifications([]);
          supabase
            .from('notifications')
            .update({ type: '__DELETED__', updated_at: new Date().toISOString() })
            .eq('user_id', user.id)
            .lte('created_at', new Date(clearTs).toISOString());
        })
        .subscribe();
    }

    return () => {
      supabase.removeChannel(channel);
      if (roomChannel) supabase.removeChannel(roomChannel);
    };
  }, [user, fetchNotifications, checkExamReminders]);

  const markAsRead = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error('Failed to mark notification as read:', error);
        return false;
      }

      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
      return true;
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      return false;
    }
  };

  const markAllAsRead = async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) {
        console.error('Failed to mark all notifications as read:', error);
        return false;
      }

      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      );
      return true;
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      return false;
    }
  };

  // Robust delete using soft-delete update, hard-delete attempt, and localStorage persistence
  const deleteNotification = async (id: string): Promise<boolean> => {
    if (!user) return false;

    try {
      addPersistedDeletedIds(user.id, [id]);
      setNotifications(prev => prev.filter(n => n.id !== id));

      await supabase
        .from('notifications')
        .update({ type: '__DELETED__', updated_at: new Date().toISOString() })
        .eq('id', id);

      await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      return true;
    } catch (error) {
      console.error('Failed to delete notification:', error);
      return false;
    }
  };

  // Robust clear all using soft-delete update, hard-delete attempt, and localStorage persistence
  const clearAllNotifications = async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const nowTs = Date.now();
      setLastClearTimestamp(user.id, nowTs);

      const currentIds = notifications.map(n => n.id);
      if (currentIds.length > 0) {
        addPersistedDeletedIds(user.id, currentIds);
      }

      setNotifications([]);

      await supabase
        .from('notifications')
        .update({ type: '__DELETED__', updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);

      return true;
    } catch (error) {
      console.error('Failed to clear notifications:', error);
      return false;
    }
  };

  // Professor clears all notifications for all students in a specific room/class
  const clearRoomStudentsNotifications = async (roomId: string): Promise<boolean> => {
    try {
      // 1. Get all students in this room
      const { data: roomStudents } = await supabase
        .from('profiles')
        .select('id')
        .eq('room_id', roomId)
        .eq('role', 'student');

      const studentIdsSet = new Set<string>();
      (roomStudents || []).forEach(s => studentIdsSet.add(s.id));

      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('room_id', roomId);

      (enrollments || []).forEach(e => studentIdsSet.add(e.student_id));

      // Get room courses
      const { data: roomCourses } = await supabase
        .from('courses')
        .select('id')
        .eq('room_id', roomId);

      const courseIds = (roomCourses || []).map(c => c.id);

      if (courseIds.length > 0) {
        const { data: courseEnrollments } = await supabase
          .from('enrollments')
          .select('student_id')
          .in('course_id', courseIds);

        (courseEnrollments || []).forEach(e => studentIdsSet.add(e.student_id));
      }

      const studentIds = Array.from(studentIdsSet);

      if (studentIds.length === 0) {
        toast.info("Aucun élève trouvé dans cette classe.");
        return true;
      }

      // 2. Find a valid course_id owned by the professor so the INSERT policy passes
      let validCourseId: string | null = courseIds[0] || null;
      if (!validCourseId && user) {
        const { data: profCourses } = await supabase
          .from('courses')
          .select('id')
          .eq('professor_id', user.id)
          .limit(1);
        if (profCourses && profCourses.length > 0) {
          validCourseId = profCourses[0].id;
        }
      }

      if (!validCourseId) {
        const { data: anyCourse } = await supabase
          .from('courses')
          .select('id')
          .limit(1);
        if (anyCourse && anyCourse.length > 0) {
          validCourseId = anyCourse[0].id;
        }
      }

      const nowIso = new Date().toISOString();

      // 3. Insert reset markers for each student (allowed by professor INSERT policy)
      if (validCourseId) {
        const resetRows = studentIds.map(studentId => ({
          user_id: studentId,
          title: '__RESET_ROOM_NOTIFICATIONS__',
          message: `RESET_${roomId}_${nowIso}`,
          type: '__CLEAR_ALL__' as NotificationType,
          course_id: validCourseId,
          read: true,
          created_at: nowIso,
          updated_at: nowIso
        }));

        const { error: insertError } = await supabase.from('notifications').insert(resetRows);
        if (insertError) {
          console.error('Error inserting clear markers:', insertError);
        }
      }

      // 4. Update the room updated_at
      await supabase
        .from('rooms')
        .update({ updated_at: nowIso })
        .eq('id', roomId);

      // 5. Broadcast to room realtime channel
      const channel = supabase.channel(`room-notifications-${roomId}`);
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.send({
            type: 'broadcast',
            event: 'clear_all',
            payload: { roomId, timestamp: nowIso }
          });
          supabase.removeChannel(channel);
        }
      });

      toast.success("Toutes les notifications des élèves de cette classe ont été supprimées avec succès !");
      return true;
    } catch (error) {
      console.error('Exception clearing room students notifications:', error);
      toast.error("Erreur lors de la suppression des notifications");
      return false;
    }
  };

  const createNotification = async (
    notification: Omit<Notification, 'id' | 'created_at' | 'updated_at'>
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          ...notification,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Failed to create notification:', error);
        return false;
      }

      fetchNotifications();
      return true;
    } catch (error) {
      console.error('Failed to create notification:', error);
      return false;
    }
  };

  // Broadcast addition/deletion of course, exercise, exam to all students in room + enrollments
  const notifyRoomStudents = async (params: NotifyRoomParams): Promise<void> => {
    try {
      const {
        roomId,
        courseId,
        exerciseId,
        examId,
        title,
        courseTitle,
        itemType,
        action,
        examDate
      } = params;

      const studentIdsSet = new Set<string>();

      // 1. Find all students belonging to the room
      if (roomId) {
        const { data: roomStudents } = await supabase
          .from('profiles')
          .select('id')
          .eq('room_id', roomId)
          .eq('role', 'student');

        (roomStudents || []).forEach(s => studentIdsSet.add(s.id));
      }

      // 2. Find students enrolled in the course if courseId is available
      if (courseId) {
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('student_id')
          .eq('course_id', courseId);

        (enrollments || []).forEach(e => studentIdsSet.add(e.student_id));
      }

      if (studentIdsSet.size === 0) {
        return;
      }

      // 3. Determine notification type, title, and message
      let notifType: NotificationType;
      let notifTitle: string;
      let notifMessage: string;

      if (action === 'add') {
        if (itemType === 'course') {
          notifType = 'course_added';
          notifTitle = `📚 Nouveau cours disponible`;
          notifMessage = `Le cours "${title}" a été publié pour votre classe.`;
        } else if (itemType === 'exercise') {
          notifType = 'exercise_added';
          notifTitle = `📝 Nouvel exercice disponible`;
          notifMessage = courseTitle
            ? `L'exercice "${title}" a été ajouté dans le cours "${courseTitle}".`
            : `L'exercice "${title}" a été ajouté à vos devoirs.`;
        } else if (itemType === 'quiz') {
          notifType = 'exam_added';
          notifTitle = `🎯 Nouveau Quiz programmé`;
          notifMessage = examDate
            ? `Le quiz "${title}" est disponible. Date limite : ${new Date(examDate).toLocaleDateString()}.`
            : `Le quiz "${title}" est maintenant disponible.`;
        } else {
          notifType = 'exam_added';
          notifTitle = `🎓 Nouvel examen programmé`;
          notifMessage = examDate
            ? `L'examen "${title}" est programmé pour le ${new Date(examDate).toLocaleDateString()}.`
            : `L'examen "${title}" a été ajouté.`;
        }
      } else if (action === 'update') {
        if (itemType === 'course') {
          notifType = 'course_updated';
          notifTitle = `🔄 Cours mis à jour`;
          notifMessage = `Le contenu du cours "${title}" a été modifié. Veuillez le consulter.`;
        } else if (itemType === 'exercise') {
          notifType = 'exercise_updated';
          notifTitle = `🔄 Exercice mis à jour`;
          notifMessage = `L'exercice "${title}" a été modifié. Veuillez le consulter.`;
        } else {
          notifType = 'exam_updated';
          notifTitle = `🔄 Évaluation mise à jour`;
          notifMessage = `L'évaluation "${title}" a été modifiée. Veuillez vérifier les détails.`;
        }
      } else {
        // Deletion
        if (itemType === 'course') {
          notifType = 'course_deleted';
          notifTitle = `🗑️ Cours retiré`;
          notifMessage = `Le cours "${title}" a été retiré par votre professeur.`;
        } else if (itemType === 'exercise') {
          notifType = 'exercise_deleted';
          notifTitle = `🗑️ Exercice retiré`;
          notifMessage = `L'exercice "${title}" a été supprimé.`;
        } else {
          notifType = 'exam_deleted';
          notifTitle = `🗑️ Évaluation retirée`;
          notifMessage = `L'évaluation "${title}" a été supprimée/annulée.`;
        }
      }

      const nowIso = new Date().toISOString();
      const insertRows = Array.from(studentIdsSet).map(studentId => ({
        user_id: studentId,
        title: notifTitle,
        message: notifMessage,
        type: notifType,
        read: false,
        course_id: courseId || null,
        exercise_id: exerciseId || null,
        exam_id: examId || null,
        created_at: nowIso,
        updated_at: nowIso
      }));

      const { error } = await supabase.from('notifications').insert(insertRows);
      if (error) {
        console.error('Error broadcasting notifications to students:', error);
      }
    } catch (err) {
      console.error('Exception in notifyRoomStudents:', err);
    }
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      loading,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      clearAllNotifications,
      clearRoomStudentsNotifications,
      createNotification,
      notifyRoomStudents,
      checkExamReminders,
      refreshNotifications: fetchNotifications
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
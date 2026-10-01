import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export type NotificationType =
  | 'course_added'
  | 'course_deleted'
  | 'exercise_added'
  | 'exercise_deleted'
  | 'exam_added'
  | 'exam_deleted'
  | 'exam_reminder'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | '__DELETED__';

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
  action: 'add' | 'delete';
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

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .neq('type', '__DELETED__')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch notifications:', error);
        return;
      }

      const active = (data || [])
        .filter(n => n.type !== '__DELETED__' && !deletedIds.has(n.id))
        .map(notification => ({
          ...notification,
          type: (notification.type as NotificationType) || 'info'
        }));

      setNotifications(active);
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
        .select('exam_id, created_at')
        .eq('user_id', user.id)
        .eq('type', 'exam_reminder');

      const existingExamIds = new Set(
        (existingReminders || [])
          .filter(r => {
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
        (payload) => {
          const deletedIds = getPersistedDeletedIds(user.id);

          if (payload.eventType === 'INSERT') {
            const newNotif = payload.new as Notification;
            if (newNotif.type !== '__DELETED__' && !deletedIds.has(newNotif.id)) {
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
            if (updated.type === '__DELETED__' || deletedIds.has(updated.id)) {
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

    return () => {
      supabase.removeChannel(channel);
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

  // Robust delete using both soft-delete update, hard-delete attempt, and localStorage persistence
  const deleteNotification = async (id: string): Promise<boolean> => {
    if (!user) return false;

    try {
      // 1. Persist to localStorage
      addPersistedDeletedIds(user.id, [id]);

      // 2. Optimistically update local state
      setNotifications(prev => prev.filter(n => n.id !== id));

      // 3. Mark as deleted in Supabase (allowed by UPDATE RLS policy)
      await supabase
        .from('notifications')
        .update({ type: '__DELETED__', updated_at: new Date().toISOString() })
        .eq('id', id);

      // 4. Also attempt hard delete in case policy allows it
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

  // Robust clear all using both soft-delete update, hard-delete attempt, and localStorage persistence
  const clearAllNotifications = async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const currentIds = notifications.map(n => n.id);

      // 1. Persist all IDs to localStorage
      if (currentIds.length > 0) {
        addPersistedDeletedIds(user.id, currentIds);
      }

      // 2. Optimistically clear local state
      setNotifications([]);

      // 3. Mark all as deleted in Supabase (allowed by UPDATE RLS policy)
      await supabase
        .from('notifications')
        .update({ type: '__DELETED__', updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      // 4. Also attempt hard delete
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
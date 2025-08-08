import React, { createContext, useContext, useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  created_at: string;
  updated_at: string;
  course_id?: string;
  exam_id?: string;
  exercise_id?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<boolean>;
  markAllAsRead: () => Promise<boolean>;
  createNotification: (notification: Omit<Notification, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<boolean>;
  notifyStudentsAboutCourse: (courseId: string, title: string, type: 'course' | 'exercise' | 'exam') => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Fetch notifications for the current user
  useEffect(() => {
    if (user) {
      fetchNotifications();
    } else {
      setNotifications([]);
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch notifications:', error);
        return;
      }

      setNotifications((data || []).map(notification => ({
        ...notification,
        type: notification.type as 'info' | 'success' | 'warning' | 'error'
      })));
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
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
        .update({ read: true })
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

  const createNotification = async (notification: Omit<Notification, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          ...notification,
          user_id: user.id
        });

      if (error) {
        console.error('Failed to create notification:', error);
        return false;
      }

      // Refresh notifications
      fetchNotifications();
      return true;
    } catch (error) {
      console.error('Failed to create notification:', error);
      return false;
    }
  };

  const notifyStudentsAboutCourse = async (courseId: string, title: string, type: 'course' | 'exercise' | 'exam'): Promise<void> => {
    try {
      // Get all students enrolled in the course
      const { data: enrollments, error: enrollmentError } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('course_id', courseId);

      if (enrollmentError) {
        console.error('Failed to fetch enrollments:', enrollmentError);
        return;
      }

      if (!enrollments || enrollments.length === 0) {
        return;
      }

      const studentIds = enrollments.map(e => e.student_id);

      // Create notification for each student
      const notificationData = {
        title: `New ${type} available`,
        message: `${title} has been added to your course`,
        type: 'info' as const,
        read: false,
        course_id: courseId,
        ...(type === 'exam' && { exam_id: courseId }),
        ...(type === 'exercise' && { exercise_id: courseId })
      };

      const notifications = studentIds.map(studentId => ({
        ...notificationData,
        user_id: studentId
      }));

      const { error } = await supabase
        .from('notifications')
        .insert(notifications);

      if (error) {
        console.error('Failed to create notifications:', error);
      }
    } catch (error) {
      console.error('Failed to notify students:', error);
    }
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      loading,
      markAsRead,
      markAllAsRead,
      createNotification,
      notifyStudentsAboutCourse
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
import React, { createContext, useContext, useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from '@supabase/supabase-js';

// Types for our users
export type UserRole = "professor" | "student";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
  room_id?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  session: Session | null;
  loading: boolean;
  isFirstLogin: boolean;
  setIsFirstLogin: (v: boolean) => void;
  login: (email: string, password: string, role?: UserRole) => Promise<boolean>;
  loginStudent: (username: string, password: string) => Promise<boolean>;
  changeStudentPassword: (newPassword: string) => Promise<boolean>;
  register: (email: string, password: string, name: string, role: UserRole) => Promise<boolean>;
  verifyOtp: (email: string, token: string) => Promise<boolean>;
  resendOtp: (email: string) => Promise<boolean>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<boolean>;
  uploadAvatar: (file: File) => Promise<string | null>;
  deleteAvatar: () => Promise<boolean>;
  getStudents: (roomId?: string) => Promise<UserProfile[]>;
  addStudent: (email: string, password: string, name: string) => Promise<boolean>;
  resetStudentPassword: (studentId: string, newPassword: string) => Promise<boolean>;
  isLoggedIn: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isFirstLogin, setIsFirstLogin] = useState(false);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (session?.user) {
          let { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          const metadataRole = session.user.user_metadata?.role as UserRole | undefined;
          
          if (!profile && mounted) {
            const defaultRole = metadataRole || "professor";
            const defaultName = session.user.user_metadata?.name || session.user.email?.split('@')[0] || "User";
            await supabase.from('profiles').insert({
              id: session.user.id,
              name: defaultName,
              email: session.user.email,
              role: defaultRole
            });
            const { data: createdProfile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();
            profile = createdProfile;
          } else if (profile && metadataRole === 'professor' && profile.role !== 'professor') {
            await supabase.from('profiles').update({ role: 'professor' }).eq('id', session.user.id);
            profile.role = 'professor';
          }
          
          if (mounted && profile) {
            setUser({
              id: profile.id,
              name: profile.name,
              email: session.user.email!,
              role: profile.role as UserRole,
              avatar_url: profile.avatar_url,
              room_id: profile.room_id
            });
            setSession(session);
            setIsLoggedIn(true);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        setSession(session);
        
        if (session?.user) {
          setTimeout(async () => {
            let { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();

            const metadataRole = session.user.user_metadata?.role as UserRole | undefined;

            if (!profile && mounted) {
              const defaultRole = metadataRole || "professor";
              const defaultName = session.user.user_metadata?.name || session.user.email?.split('@')[0] || "User";
              await supabase.from('profiles').insert({
                id: session.user.id,
                name: defaultName,
                email: session.user.email,
                role: defaultRole
              });
              const { data: createdProfile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();
              profile = createdProfile;
            } else if (profile && metadataRole === 'professor' && profile.role !== 'professor') {
              await supabase.from('profiles').update({ role: 'professor' }).eq('id', session.user.id);
              profile.role = 'professor';
            }
            
            if (profile && mounted) {
              setUser({
                id: profile.id,
                name: profile.name,
                email: session.user.email!,
                role: profile.role as UserRole,
                avatar_url: profile.avatar_url,
                room_id: profile.room_id
              });
              setIsLoggedIn(true);
            }
          }, 0);
        } else {
          setUser(null);
          setIsLoggedIn(false);
        }
      }
    );

    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const register = async (email: string, password: string, name: string, role: UserRole): Promise<boolean> => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      const assignedRole = role || "professor";
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name,
            role: assignedRole
          }
        }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error("An account with this email already exists");
        } else {
          toast.error(error.message);
        }
        return false;
      }

      toast.success("Registration successful! A verification code has been sent to your email.");
      return true;
    } catch (error) {
      toast.error("Registration failed");
      return false;
    }
  };

  const verifyOtp = async (email: string, tokenOrUrl: string): Promise<boolean> => {
    try {
      const cleanInput = tokenOrUrl.trim();
      let verifyParams: any;

      // Check if user entered/pasted a URL or token_hash
      const tokenMatch = cleanInput.match(/[?&]token=([^&]+)/) || cleanInput.match(/[?&]token_hash=([^&]+)/);
      if (tokenMatch) {
        verifyParams = {
          token_hash: tokenMatch[1],
          type: 'signup'
        };
      } else if (cleanInput.length > 10) {
        verifyParams = {
          token_hash: cleanInput,
          type: 'signup'
        };
      } else {
        verifyParams = {
          email: email.trim(),
          token: cleanInput,
          type: 'signup'
        };
      }

      let { data, error } = await supabase.auth.verifyOtp(verifyParams);

      // Fallback if 'signup' type fails
      if (error && verifyParams.type === 'signup') {
        const retryResult = await supabase.auth.verifyOtp({
          ...verifyParams,
          type: 'email'
        });
        if (!retryResult.error) {
          data = retryResult.data;
          error = null;
        }
      }

      if (error) {
        toast.error(error.message || "Invalid or expired verification code");
        return false;
      }

      if (data?.session && data.user) {
        setSession(data.session);

        let { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profile) {
          if (profile.role !== 'professor') {
            await supabase.from('profiles').update({ role: 'professor' }).eq('id', data.user.id);
            profile.role = 'professor';
          }
        } else {
          const newProfile = {
            id: data.user.id,
            name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'Professor',
            email: data.user.email!,
            role: 'professor' as UserRole
          };
          await supabase.from('profiles').insert(newProfile);
          profile = newProfile as any;
        }

        setUser({
          id: data.user.id,
          name: profile?.name || data.user.user_metadata?.name || 'Professor',
          email: data.user.email!,
          role: 'professor',
          avatar_url: profile?.avatar_url,
          room_id: profile?.room_id
        });
        setIsLoggedIn(true);
      }

      toast.success("Email verified successfully! Welcome to Course Harmony.");
      return true;
    } catch (error: any) {
      toast.error(error?.message || "Verification failed");
      return false;
    }
  };

  const resendOtp = async (email: string): Promise<boolean> => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim()
      });

      if (error) {
        toast.error(error.message || "Failed to resend code");
        return false;
      }

      toast.success("Verification code resent! Please check your inbox.");
      return true;
    } catch (error: any) {
      toast.error(error?.message || "Failed to resend code");
      return false;
    }
  };

  const login = async (email: string, password: string, role?: UserRole): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error("Invalid email or password");
        } else if (error.message.includes('Email not confirmed')) {
          toast.error("Email not confirmed. Please enter the verification code.");
        } else {
          toast.error(error.message);
        }
        return false;
      }

      // If logging in as professor, ensure profile has role 'professor'
      if (data?.user && (role === "professor" || data.user.user_metadata?.role === "professor")) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profile && profile.role !== 'professor') {
          await supabase.from('profiles').update({ role: 'professor' }).eq('id', data.user.id);
          await supabase.auth.updateUser({ data: { role: 'professor' } });
          profile.role = 'professor';
        }
      }

      return true;
    } catch (error) {
      toast.error("Login failed");
      return false;
    }
  };

  const loginStudent = async (username: string, password: string): Promise<boolean> => {
    try {
      // Find user by username
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email, temporary_password')
        .eq('username', username)
        .eq('role', 'student')
        .maybeSingle();

      if (profileError || !profile) {
        toast.error("Invalid username or password");
        return false;
      }

      // Check temporary password
      if (profile.temporary_password !== password) {
        toast.error("Invalid username or password");
        return false;
      }

      // Login with email (since Supabase auth uses email)
      const { error } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: password
      });

      if (error) {
        toast.error("Login failed. Please contact your professor.");
        return false;
      }

      // If temporary_password is still set, this is a first/temporary-password login
      if (profile.temporary_password) {
        setIsFirstLogin(true);
      }

      return true;
    } catch (error) {
      toast.error("Login failed");
      return false;
    }
  };

  // Student changes their own password
  const changeStudentPassword = async (newPassword: string): Promise<boolean> => {
    if (!user) return false;
    try {
      // Update Supabase auth password
      const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
      if (authError) {
        toast.error("Failed to update password");
        return false;
      }
      // Clear temporary_password in profile to mark as no longer first login
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ temporary_password: null })
        .eq('id', user.id);
      if (profileError) {
        console.error('Failed to clear temporary password:', profileError);
      }
      setIsFirstLogin(false);
      toast.success("Password changed successfully!");
      return true;
    } catch (error) {
      toast.error("Failed to change password");
      return false;
    }
  };

  // Professor resets a student's password directly
  const resetStudentPassword = async (studentId: string, newPassword: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ temporary_password: newPassword })
        .eq('id', studentId);
      if (error) {
        toast.error("Failed to reset student password");
        return false;
      }
      // Also update Supabase auth password via admin function if available
      const { error: fnError } = await supabase.functions.invoke('reset-student-password', {
        body: { studentId, newPassword }
      });
      if (fnError) {
        console.warn('Admin password reset not available, only temporary_password updated:', fnError);
      }
      toast.success("Student password reset successfully!");
      return true;
    } catch (error) {
      toast.error("Failed to reset student password");
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      // Close any active sessions before logging out
      if (user && user.role === 'student') {
        console.log('Closing active sessions before logout for user:', user.id);
        
        const now = new Date();
        
        // Get all active sessions for this user
        const { data: activeSessions } = await supabase
          .from('student_sessions')
          .select('id, session_start, room_id')
          .eq('student_id', user.id)
          .eq('is_active', true);

        console.log('Found active sessions to close:', activeSessions?.length || 0);

        // Close all active sessions
        if (activeSessions && activeSessions.length > 0) {
          for (const session of activeSessions) {
            const startTime = new Date(session.session_start);
            const durationMinutes = Math.round((now.getTime() - startTime.getTime()) / 60000);
            
            const { error: updateError } = await supabase
              .from('student_sessions')
              .update({
                session_end: now.toISOString(),
                is_active: false,
                duration_minutes: durationMinutes,
              })
              .eq('id', session.id);

            if (updateError) {
              console.error('Error closing session:', updateError);
            } else {
              console.log('Closed session:', session.id);
            }

            // Log logout activity
            await supabase.from('student_activities').insert({
              student_id: user.id,
              room_id: session.room_id,
              session_id: session.id,
              activity_type: 'logout',
              activity_data: {
                timestamp: now.toISOString(),
                duration_minutes: durationMinutes,
              },
            });
          }
        }
      }

      // Now sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error("Logout failed");
      } else {
        toast.info("You have been logged out");
      }
    } catch (error) {
      console.error('Error during logout:', error);
      toast.error("Logout failed");
    }
  };

  const resetPassword = async (email: string): Promise<boolean> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) {
        toast.error(error.message);
        return false;
      }

      toast.success("Password reset email sent! Please check your inbox.");
      return true;
    } catch (error) {
      toast.error("Failed to send reset email");
      return false;
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: updates.name,
          role: updates.role,
          avatar_url: updates.avatar_url
        })
        .eq('id', user.id);

      if (error) {
        toast.error("Failed to update profile");
        return false;
      }

      setUser({ ...user, ...updates });
      toast.success("Profile updated successfully");
      return true;
    } catch (error) {
      toast.error("Failed to update profile");
      return false;
    }
  };

  const uploadAvatar = async (file: File): Promise<string | null> => {
    if (!user) return null;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          upsert: true
        });

      if (uploadError) {
        toast.error("Failed to upload avatar");
        return null;
      }

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const publicUrl = data.publicUrl;

      // Update profile with new avatar URL
      await updateProfile({ avatar_url: publicUrl });

      return publicUrl;
    } catch (error) {
      toast.error("Failed to upload avatar");
      return null;
    }
  };

  const deleteAvatar = async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          avatar_url: null
        })
        .eq('id', user.id);

      if (error) {
        toast.error("Failed to delete avatar");
        return false;
      }

      setUser({ ...user, avatar_url: undefined });
      return true;
    } catch (error) {
      toast.error("Failed to delete avatar");
      return false;
    }
  };

  const getStudents = async (roomId?: string): Promise<UserProfile[]> => {
    try {
      let query = supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student');

      // If roomId is provided, filter by room_id
      if (roomId) {
        query = query.eq('room_id', roomId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to fetch students:', error);
        return [];
      }

      return (data || []).map(profile => ({
        id: profile.id,
        name: profile.name,
        email: profile.email || '',
        role: profile.role as UserRole,
        avatar_url: profile.avatar_url
      }));
    } catch (error) {
      console.error('Failed to fetch students:', error);
      return [];
    }
  };

  const addStudent = async (email: string, password: string, name: string): Promise<boolean> => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role: 'student'
          }
        }
      });

      if (error) {
        toast.error(error.message);
        return false;
      }

      toast.success("Student added successfully! They will receive an email to verify their account.");
      return true;
    } catch (error) {
      toast.error("Failed to add student");
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session,
      loading,
      isFirstLogin,
      setIsFirstLogin,
      login, 
      loginStudent,
      changeStudentPassword,
      register,
      verifyOtp,
      resendOtp,
      logout, 
      resetPassword,
      updateProfile,
      uploadAvatar,
      deleteAvatar,
      getStudents,
      addStudent,
      resetStudentPassword,
      isLoggedIn
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
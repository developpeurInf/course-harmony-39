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
}

interface AuthContextType {
  user: UserProfile | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  loginStudent: (username: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string, role: UserRole) => Promise<boolean>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<boolean>;
  uploadAvatar: (file: File) => Promise<string | null>;
  getStudents: () => Promise<UserProfile[]>;
  addStudent: (email: string, password: string, name: string) => Promise<boolean>;
  isLoggedIn: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        
        if (session?.user) {
          // Fetch user profile
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();
          
          if (profile && !error) {
            setUser({
              id: profile.id,
              name: profile.name,
              email: session.user.email!,
              role: profile.role as UserRole,
              avatar_url: profile.avatar_url
            });
            setIsLoggedIn(true);
          }
        } else {
          setUser(null);
          setIsLoggedIn(false);
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        // The auth state change will handle profile fetching
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const register = async (email: string, password: string, name: string, role: UserRole): Promise<boolean> => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name,
            role
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

      toast.success("Registration successful! Please check your email for verification.");
      return true;
    } catch (error) {
      toast.error("Registration failed");
      return false;
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error("Invalid email or password");
        } else {
          toast.error(error.message);
        }
        return false;
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

      return true;
    } catch (error) {
      toast.error("Login failed");
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error("Logout failed");
      } else {
        toast.info("You have been logged out");
      }
    } catch (error) {
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
      const fileName = `${user.id}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);

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

  const getStudents = async (): Promise<UserProfile[]> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student');

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
      login, 
      loginStudent,
      register,
      logout, 
      resetPassword,
      updateProfile,
      uploadAvatar,
      getStudents,
      addStudent,
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
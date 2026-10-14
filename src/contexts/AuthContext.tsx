import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  /** Code Massar de l'élève (identifiant de connexion) */
  username?: string;
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

/** Langue active (ce contexte est monté au-dessus de celui de la langue) */
const activeLang = (): string => {
  try {
    return localStorage.getItem("maataoui-language") || "fr";
  } catch {
    return "fr";
  }
};
const tra = (fr: string, ar: string, en: string): string => {
  const l = activeLang();
  return l === "ar" ? ar : l === "en" ? en : fr;
};

/** Seuls ces champs comptent : un nouvel objet identique ne doit pas relancer tous les effets */
const sameProfile = (a: UserProfile | null, b: UserProfile | null): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.id === b.id && a.role === b.role && (a.room_id || null) === (b.room_id || null) &&
    a.name === b.name && a.email === b.email && (a.avatar_url || null) === (b.avatar_url || null) &&
    (a.username || null) === (b.username || null);
};

/** Échappe les jokers de LIKE (%, _ et \) pour une comparaison exacte insensible à la casse */
const escapeLike = (v: string) => v.replace(/[\\%_]/g, (c) => "\\" + c);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isFirstLogin, setIsFirstLogin] = useState(false);

  // Dernier profil connu, lisible depuis des fonctions stables
  const userRef = useRef<UserProfile | null>(null);
  const setUser = useCallback((next: UserProfile | null) => {
    if (sameProfile(userRef.current, next)) return;
    userRef.current = next;
    setUserState(next);
  }, []);

  // Chargement du profil : une seule requête à la fois par compte
  const profileLoads = useRef(new Map<string, Promise<UserProfile | null>>());

  useEffect(() => {
    let mounted = true;

    const fetchProfile = async (sessionUser: User): Promise<UserProfile | null> => {
      let { data: profile } = await supabase
        .from('profiles')
        .select('id, name, email, role, avatar_url, room_id, username')
        .eq('id', sessionUser.id)
        .maybeSingle();

      const metadataRole = sessionUser.user_metadata?.role as UserRole | undefined;

      if (!profile && mounted) {
        const defaultRole = metadataRole || "professor";
        const defaultName = sessionUser.user_metadata?.name || sessionUser.email?.split('@')[0] || "User";
        await supabase.from('profiles').insert({
          id: sessionUser.id,
          name: defaultName,
          email: sessionUser.email,
          role: defaultRole
        });
        const { data: createdProfile } = await supabase
          .from('profiles')
          .select('id, name, email, role, avatar_url, room_id, username')
          .eq('id', sessionUser.id)
          .maybeSingle();
        profile = createdProfile;
      } else if (profile && metadataRole === 'professor' && profile.role !== 'professor') {
        await supabase.from('profiles').update({ role: 'professor' }).eq('id', sessionUser.id);
        profile.role = 'professor';
      }

      if (!profile) return null;
      return {
        id: profile.id,
        name: profile.name,
        email: sessionUser.email!,
        role: profile.role as UserRole,
        avatar_url: profile.avatar_url || undefined,
        room_id: profile.room_id || undefined,
        username: (profile as any).username || undefined,
      };
    };

    const loadProfile = (sessionUser: User): Promise<UserProfile | null> => {
      const existing = profileLoads.current.get(sessionUser.id);
      if (existing) return existing;
      const p = fetchProfile(sessionUser)
        .catch((error) => {
          console.error('Profile load error:', error);
          return null;
        })
        .finally(() => {
          profileLoads.current.delete(sessionUser.id);
        });
      profileLoads.current.set(sessionUser.id, p);
      return p;
    };

    const applySession = async (nextSession: Session | null) => {
      if (!nextSession?.user) {
        setUser(null);
        setIsLoggedIn(false);
        return;
      }
      const profile = await loadProfile(nextSession.user);
      if (mounted && profile) {
        setUser(profile);
        setIsLoggedIn(true);
      }
    };

    // Démarrage : une seule lecture de la session (l'événement INITIAL_SESSION est ignoré)
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(session);
        await applySession(session);
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
      (event, nextSession) => {
        if (!mounted) return;
        // déjà traité par initializeAuth
        if (event === 'INITIAL_SESSION') return;

        setSession(prev => {
          if (prev && nextSession && prev.access_token === nextSession.access_token) return prev;
          return nextSession;
        });

        if (!nextSession?.user || event === 'SIGNED_OUT') {
          setUser(null);
          setIsLoggedIn(false);
          return;
        }

        // Jeton renouvelé / métadonnées modifiées (préférences, mot de passe) : le profil
        // (rôle, classe, nom…) n'a pas changé, inutile de le relire et de tout recharger.
        if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return;

        // SIGNED_IN est aussi réémis au retour sur l'onglet : on ne relit que si le compte change
        if (event === 'SIGNED_IN' && userRef.current && userRef.current.id === nextSession.user.id) return;

        // (hors du callback : un appel Supabase attendu ici peut bloquer le client)
        setTimeout(() => {
          if (mounted) void applySession(nextSession);
        }, 0);
      }
    );

    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setUser]);

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
          toast.error(tra("Un compte existe déjà avec cet e-mail", "يوجد حساب بهذا البريد الإلكتروني مسبقاً", "An account with this email already exists"));
        } else {
          toast.error(error.message);
        }
        return false;
      }

      toast.success(tra(
        "Inscription réussie ! Un code de vérification a été envoyé à votre e-mail.",
        "تم التسجيل بنجاح! تم إرسال رمز التحقق إلى بريدك الإلكتروني.",
        "Registration successful! A verification code has been sent to your email."
      ));
      return true;
    } catch (error) {
      toast.error(tra("Échec de l'inscription", "فشل التسجيل", "Registration failed"));
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
        toast.error(error.message || tra("Code de vérification invalide ou expiré", "رمز التحقق غير صالح أو منتهي الصلاحية", "Invalid or expired verification code"));
        return false;
      }

      if (data?.session && data.user) {
        setSession(data.session);

        let { data: profile } = await supabase
          .from('profiles')
          .select('id, name, email, role, avatar_url, room_id, username')
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
          avatar_url: profile?.avatar_url || undefined,
          room_id: profile?.room_id || undefined,
          username: (profile as any)?.username || undefined
        });
        setIsLoggedIn(true);
      }

      toast.success(tra("E-mail vérifié avec succès ! Bienvenue.", "تم التحقق من البريد الإلكتروني بنجاح! مرحباً بك.", "Email verified successfully! Welcome."));
      return true;
    } catch (error: any) {
      toast.error(error?.message || tra("Échec de la vérification", "فشل التحقق", "Verification failed"));
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
        toast.error(error.message || tra("Échec du renvoi du code", "فشل إعادة إرسال الرمز", "Failed to resend code"));
        return false;
      }

      toast.success(tra("Code renvoyé ! Vérifiez votre boîte de réception.", "تمت إعادة إرسال الرمز! تحقق من بريدك الوارد.", "Verification code resent! Please check your inbox."));
      return true;
    } catch (error: any) {
      toast.error(error?.message || tra("Échec du renvoi du code", "فشل إعادة إرسال الرمز", "Failed to resend code"));
      return false;
    }
  };

  const login = async (email: string, password: string, role?: UserRole): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error(tra("E-mail ou mot de passe incorrect", "البريد الإلكتروني أو كلمة المرور غير صحيحة", "Invalid email or password"));
        } else if (/banned/i.test(error.message)) {
          toast.error(tra("Compte suspendu : contactez l'administration.", "الحساب موقوف: يرجى الاتصال بالإدارة.", "Account suspended: please contact the administration."));
        } else if (error.message.includes('Email not confirmed')) {
          toast.error(tra("E-mail non confirmé. Saisissez le code de vérification.", "البريد الإلكتروني غير مؤكد. أدخل رمز التحقق.", "Email not confirmed. Please enter the verification code."));
        } else {
          toast.error(error.message);
        }
        return false;
      }

      // Le rôle (professeur / élève) est fixé par l'administration : plus de promotion automatique ici.
      void role;
      void data;

      return true;
    } catch (error) {
      toast.error(tra("Échec de la connexion", "فشل تسجيل الدخول", "Login failed"));
      return false;
    }
  };

  const loginStudent = async (username: string, password: string): Promise<boolean> => {
    const invalid = () => toast.error(tra("Code Massar ou mot de passe incorrect", "رمز مسار أو كلمة المرور غير صحيحة", "Invalid username or password"));
    try {
      const cleanUsername = (username || "").trim();
      if (!cleanUsername) {
        invalid();
        return false;
      }
      // Code Massar comparé sans tenir compte des majuscules / minuscules
      // (ilike sans joker = égalité insensible à la casse)
      const { data: rows, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, username, temporary_password')
        .ilike('username', escapeLike(cleanUsername))
        .eq('role', 'student')
        .limit(5);

      const list = rows || [];
      // correspondance exacte d'abord, sinon la seule correspondance insensible à la casse
      const profile = list.find(r => r.username === cleanUsername) || (list.length === 1 ? list[0] : null);

      if (profileError || !profile || !profile.email) {
        invalid();
        return false;
      }

      // Login directly with Supabase Auth using the student's email and password
      const { error } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: password
      });

      if (error) {
        invalid();
        return false;
      }

      // If temporary_password is still active and matches what was entered, prompt first-login choice
      if (profile.temporary_password && profile.temporary_password === password) {
        setIsFirstLogin(true);
      } else {
        setIsFirstLogin(false);
      }

      return true;
    } catch (error) {
      toast.error(tra("Échec de la connexion", "فشل تسجيل الدخول", "Login failed"));
      return false;
    }
  };

  // Student changes their own password
  const changeStudentPassword = async (newPassword: string): Promise<boolean> => {
    const current = userRef.current;
    if (!current) return false;
    try {
      // Update Supabase auth password
      const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
      if (authError) {
        toast.error(tra("Échec du changement de mot de passe", "فشل تغيير كلمة المرور", "Failed to update password"), { description: authError.message });
        return false;
      }
      // Clear temporary_password in profile so it's no longer marked as temporary
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ temporary_password: null })
        .eq('id', current.id);
      if (profileError) {
        console.error('Failed to clear temporary password in profile:', profileError.message);
      }
      setIsFirstLogin(false);
      toast.success(tra("Mot de passe modifié avec succès !", "تم تغيير كلمة المرور بنجاح!", "Password changed successfully!"));
      return true;
    } catch (error) {
      toast.error(tra("Échec du changement de mot de passe", "فشل تغيير كلمة المرور", "Failed to change password"));
      return false;
    }
  };

  // Professor resets a student's password directly
  const resetStudentPassword = async (studentId: string, newPassword: string): Promise<boolean> => {
    try {
      const { data: profile, error: getError } = await supabase
        .from('profiles')
        .select('id, name, username, room_id')
        .eq('id', studentId)
        .single();

      if (getError || !profile) {
        toast.error(tra("Profil de l'élève introuvable", "لم يتم العثور على ملف التلميذ", "Student profile not found"));
        return false;
      }

      // 1. Update temporary_password in profiles
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ temporary_password: newPassword })
        .eq('id', studentId);

      if (updateError) {
        toast.error(tra("Échec de la réinitialisation du mot de passe", "فشل إعادة تعيين كلمة المرور", "Failed to reset student password"));
        return false;
      }

      // 2. Synchronize Supabase Auth password via create-student function
      if (profile.username && profile.room_id) {
        const nameParts = (profile.name || 'Student').split(' ');
        const prenom = nameParts[0] || 'Student';
        const nom = nameParts.slice(1).join(' ') || '';
        await supabase.functions.invoke('create-student', {
          body: {
            students: [{
              prenom,
              nom,
              username: profile.username,
              temporaryPassword: newPassword
            }],
            roomId: profile.room_id,
            purpose: 'reset'
          }
        });
      }

      toast.success(tra("Mot de passe de l'élève réinitialisé !", "تمت إعادة تعيين كلمة مرور التلميذ!", "Student password reset successfully!"));
      return true;
    } catch (error) {
      toast.error(tra("Échec de la réinitialisation du mot de passe", "فشل إعادة تعيين كلمة المرور", "Failed to reset student password"));
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    // Déconnexion immédiate côté interface : on vide l'état tout de suite (la page de
    // connexion ne renvoie plus vers le tableau de bord), puis on termine en arrière-plan
    // (clôture des sessions élève + déconnexion Supabase).
    const leavingUser = userRef.current;
    setUser(null);
    setSession(null);
    setIsLoggedIn(false);
    setIsFirstLogin(false);
    void finishLogout(leavingUser);
  };

  const finishLogout = async (leaving: UserProfile | null): Promise<void> => {
    try {
      // Close any active sessions before logging out
      if (leaving && leaving.role === 'student') {
        const now = new Date();

        // Get all active sessions for this user
        const { data: activeSessions } = await supabase
          .from('student_sessions')
          .select('id, session_start, room_id')
          .eq('student_id', leaving.id)
          .eq('is_active', true);

        if (activeSessions && activeSessions.length > 0) {
          // Clôtures en parallèle (durée propre à chaque session) + journal en un seul envoi
          const durations = activeSessions.map(s =>
            Math.max(0, Math.round((now.getTime() - new Date(s.session_start).getTime()) / 60000))
          );
          await Promise.all(activeSessions.map((s, i) =>
            supabase
              .from('student_sessions')
              .update({
                session_end: now.toISOString(),
                is_active: false,
                duration_minutes: durations[i],
              })
              .eq('id', s.id)
              .then(({ error }) => {
                if (error) console.error('Error closing session:', error.message);
              })
          ));

          const { error: actError } = await supabase.from('student_activities').insert(
            activeSessions.map((s, i) => ({
              student_id: leaving.id,
              room_id: s.room_id,
              session_id: s.id,
              activity_type: 'logout',
              activity_data: {
                timestamp: now.toISOString(),
                duration_minutes: durations[i],
              },
            }))
          );
          if (actError) console.error('Error logging logout activity:', actError.message);
        }
      }

      // Now sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Supabase signOut error:', error.message);
        // Au minimum, supprimer la session locale pour ne pas être reconnecté au rechargement
        await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      }
    } catch (error) {
      console.error('Error during logout:', error);
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    }
  };

  const resetPassword = async (email: string): Promise<boolean> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) {
        toast.error(error.message);
        return false;
      }

      toast.success(tra(
        "E-mail de réinitialisation envoyé ! Vérifiez votre boîte de réception.",
        "تم إرسال بريد إعادة التعيين! تحقق من بريدك الوارد.",
        "Password reset email sent! Please check your inbox."
      ));
      return true;
    } catch (error) {
      toast.error(tra("Échec de l'envoi de l'e-mail de réinitialisation", "فشل إرسال بريد إعادة التعيين", "Failed to send reset email"));
      return false;
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>): Promise<boolean> => {
    const current = userRef.current;
    if (!current) return false;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: updates.name,
          role: updates.role,
          avatar_url: updates.avatar_url
        })
        .eq('id', current.id);

      if (error) {
        toast.error(tra("Échec de la mise à jour du profil", "فشل تحديث الملف الشخصي", "Failed to update profile"));
        return false;
      }

      setUser({ ...(userRef.current || current), ...updates });
      toast.success(tra("Profil mis à jour avec succès", "تم تحديث الملف الشخصي بنجاح", "Profile updated successfully"));
      return true;
    } catch (error) {
      toast.error(tra("Échec de la mise à jour du profil", "فشل تحديث الملف الشخصي", "Failed to update profile"));
      return false;
    }
  };

  const uploadAvatar = async (file: File): Promise<string | null> => {
    const current = userRef.current;
    if (!current) return null;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${current.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          upsert: true
        });

      if (uploadError) {
        toast.error(tra("Échec de l'envoi de la photo", "فشل رفع الصورة", "Failed to upload avatar"));
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
      toast.error(tra("Échec de l'envoi de la photo", "فشل رفع الصورة", "Failed to upload avatar"));
      return null;
    }
  };

  const deleteAvatar = async (): Promise<boolean> => {
    const current = userRef.current;
    if (!current) return false;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          avatar_url: null
        })
        .eq('id', current.id);

      if (error) {
        toast.error(tra("Échec de la suppression de la photo", "فشل حذف الصورة", "Failed to delete avatar"));
        return false;
      }

      setUser({ ...(userRef.current || current), avatar_url: undefined });
      return true;
    } catch (error) {
      toast.error(tra("Échec de la suppression de la photo", "فشل حذف الصورة", "Failed to delete avatar"));
      return false;
    }
  };

  // Stable (utilisée dans les dépendances d'effets des pages) ; seulement les colonnes utiles
  const getStudents = useCallback(async (roomId?: string): Promise<UserProfile[]> => {
    try {
      let query = supabase
        .from('profiles')
        .select('id, name, email, role, avatar_url')
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
        avatar_url: profile.avatar_url || undefined
      }));
    } catch (error) {
      console.error('Failed to fetch students:', error);
      return [];
    }
  }, []);

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

      toast.success(tra(
        "Élève ajouté ! Il recevra un e-mail pour vérifier son compte.",
        "تمت إضافة التلميذ! سيتلقى بريداً إلكترونياً لتأكيد حسابه.",
        "Student added successfully! They will receive an email to verify their account."
      ));
      return true;
    } catch (error) {
      toast.error(tra("Échec de l'ajout de l'élève", "فشل إضافة التلميذ", "Failed to add student"));
      return false;
    }
  };

  // Les fonctions lisent l'utilisateur via userRef : la valeur ne change que si l'état change.
  const value = useMemo<AuthContextType>(() => ({
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [user, session, loading, isFirstLogin, isLoggedIn, getStudents]);

  return (
    <AuthContext.Provider value={value}>
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
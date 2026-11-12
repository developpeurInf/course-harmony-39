import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

/** Préférences de l'utilisateur connecté (table user_prefs, une ligne par compte) */
export interface UserPrefs {
  alerts?: { inactiveDays?: number; minAverage?: number };
  notify?: { reminders?: boolean; grades?: boolean; announcements?: boolean };
  [key: string]: unknown;
}

export async function getUserPrefs(): Promise<UserPrefs> {
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) return {};
  const { data } = await db.from("user_prefs").select("data").eq("user_id", u.user.id).maybeSingle();
  return (data?.data as UserPrefs) || {};
}

export async function saveUserPrefs(prefs: UserPrefs): Promise<boolean> {
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) return false;
  const { error } = await db.from("user_prefs").upsert({ user_id: u.user.id, data: prefs, updated_at: new Date().toISOString() });
  return !error;
}

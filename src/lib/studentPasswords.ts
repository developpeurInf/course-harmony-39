import { supabase } from "@/integrations/supabase/client";

/**
 * Mots de passe provisoires des élèves d'une classe (prof de la classe ou admin).
 * La colonne profiles.temporary_password n'est plus lisible directement.
 */
export async function fetchRoomPasswords(roomId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!roomId) return map;
  const { data } = await (supabase as any).rpc("room_student_passwords", { p_room: roomId });
  for (const r of (data || []) as { id: string; username: string | null; temporary_password: string | null }[]) {
    if (r.temporary_password) {
      map.set(r.id, r.temporary_password);
      if (r.username) map.set(`u:${r.username}`, r.temporary_password);
    }
  }
  return map;
}

/**
 * Tableaux blancs de classe : accès aux données (table class_whiteboards).
 */
import { supabase } from "@/integrations/supabase/client";
import type { El, Paper, BoardTheme } from "@/components/meet/whiteboard/model";

const db = supabase as any;

export type Share = "private" | "view" | "edit";

export interface BoardSummary {
  id: string;
  room_id: string;
  owner_id: string;
  title: string;
  share: Share;
  thumb: string | null;
  updated_at: string;
  created_at: string;
}
export interface BoardData {
  board: El[];
  state: { paper?: Paper; theme?: BoardTheme };
}
export interface Board extends BoardSummary {
  data: BoardData;
}

const LIST_COLS = "id, room_id, owner_id, title, share, thumb, updated_at, created_at";

let cache: Record<string, BoardSummary[]> = {};
export const cachedBoards = (roomId?: string | null) => cache[roomId || "*"] || null;

export async function listBoards(roomId?: string | null): Promise<BoardSummary[]> {
  let q = db.from("class_whiteboards").select(LIST_COLS).order("updated_at", { ascending: false }).limit(200);
  if (roomId) q = q.eq("room_id", roomId);
  const { data, error } = await q;
  if (error) throw error;
  cache = { ...cache, [roomId || "*"]: data || [] };
  return data || [];
}

export async function getBoard(id: string): Promise<Board | null> {
  const { data, error } = await db.from("class_whiteboards").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createBoard(roomId: string, ownerId: string, title: string, data?: BoardData, share: Share = "view"): Promise<BoardSummary> {
  const { data: row, error } = await db
    .from("class_whiteboards")
    .insert({ room_id: roomId, owner_id: ownerId, title: title.trim().slice(0, 120) || "Tableau blanc", share, ...(data ? { data } : {}) })
    .select(LIST_COLS)
    .single();
  if (error) throw error;
  return row;
}

export async function updateBoard(id: string, patch: Partial<Pick<Board, "title" | "share" | "data" | "thumb">>) {
  const { error } = await db.from("class_whiteboards").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteBoard(id: string) {
  const { error } = await db.from("class_whiteboards").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicateBoard(id: string, ownerId: string, suffix: string) {
  const b = await getBoard(id);
  if (!b) throw new Error("not found");
  const copy = await createBoard(b.room_id, ownerId, `${b.title} ${suffix}`.slice(0, 120), b.data, b.share);
  if (b.thumb) await updateBoard(copy.id, { thumb: b.thumb });
  return { ...copy, thumb: b.thumb };
}

/** La table n'existe pas encore (migration non lancée) */
export const missingTable = (e: any) => e?.code === "42P01" || e?.code === "PGRST205" || /class_whiteboards/.test(e?.message || "");

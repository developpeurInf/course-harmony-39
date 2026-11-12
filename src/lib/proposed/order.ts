/**
 * Ordre des chapitres propre à chaque professeur (par niveau et matière).
 * Le numéro « Chapitre N » n'est écrit dans aucun PDF : il vient de cet ordre et il est
 * ajouté dans l'en-tête de chaque page au moment du téléchargement. Ainsi le cours complet,
 * le résumé et la série d'exercices d'un même chapitre portent toujours le même numéro.
 * Stockage : table teacher_chapter_order (migration 20261123090000) ; sans elle, l'appareil.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { chaptersFor, type Chapter, type LevelKey, type SubjectKey } from "./catalog";

export interface NumberedChapter extends Chapter { num: number }

const localKey = (u: string, l: string, s: string) => `chorder:${u || "anon"}:${l}:${s}`;
const memo = new Map<string, string[]>();

/** applique un ordre enregistré au programme : chapitres inconnus ignorés, nouveaux ajoutés à leur place d'origine en fin */
export function applyOrder(chapters: Chapter[], ids: string[] | null | undefined): NumberedChapter[] {
  const byId = new Map(chapters.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const out: Chapter[] = [];
  (ids || []).forEach((id) => { const c = byId.get(id); if (c && !seen.has(id)) { seen.add(id); out.push(c); } });
  chapters.forEach((c) => { if (!seen.has(c.id)) out.push(c); });
  return out.map((c, i) => ({ ...c, num: i + 1 }));
}

async function loadIds(userId: string, level: string, subject: string): Promise<string[] | null> {
  const k = localKey(userId, level, subject);
  if (memo.has(k)) return memo.get(k)!;
  let ids: string[] | null = null;
  if (userId) {
    const { data, error } = await (supabase as any).from("teacher_chapter_order")
      .select("chapter_ids").eq("user_id", userId).eq("level", level).eq("subject", subject).maybeSingle();
    if (!error && data?.chapter_ids) ids = data.chapter_ids as string[];
  }
  if (!ids) { try { ids = JSON.parse(localStorage.getItem(k) || "null"); } catch { ids = null; } }
  if (ids) memo.set(k, ids);
  return ids;
}

async function saveIds(userId: string, level: string, subject: string, ids: string[] | null) {
  const k = localKey(userId, level, subject);
  if (ids) memo.set(k, ids); else memo.delete(k);
  try { if (ids) localStorage.setItem(k, JSON.stringify(ids)); else localStorage.removeItem(k); } catch { /* stockage indisponible */ }
  if (!userId) return;
  const t = (supabase as any).from("teacher_chapter_order");
  if (ids) await t.upsert({ user_id: userId, level, subject, chapter_ids: ids, updated_at: new Date().toISOString() }, { onConflict: "user_id,level,subject" });
  else await t.delete().eq("user_id", userId).eq("level", level).eq("subject", subject);
}

/** Chapitres de la classe dans l'ordre du professeur, numérotés, avec de quoi les déplacer */
export function useChapterOrder(userId: string | undefined, level?: LevelKey | "" | null, subject?: SubjectKey | "" | null) {
  const base = useMemo(() => chaptersFor(level || null, subject || null), [level, subject]);
  const [ids, setIds] = useState<string[] | null>(null);
  useEffect(() => {
    setIds(null);
    if (!level || !subject) return;
    let alive = true;
    loadIds(userId || "", level, subject).then((v) => { if (alive) setIds(v); });
    return () => { alive = false; };
  }, [userId, level, subject]);

  const chapters = useMemo(() => applyOrder(base, ids), [base, ids]);
  const custom = !!ids && chapters.some((c, i) => c.id !== base[i]?.id);

  const persist = useCallback((next: string[] | null) => {
    setIds(next);
    if (level && subject) void saveIds(userId || "", level, subject, next);
  }, [userId, level, subject]);

  const move = useCallback((id: string, delta: number) => {
    const list = chapters.map((c) => c.id);
    const i = list.indexOf(id), j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    persist(list);
  }, [chapters, persist]);

  const reset = useCallback(() => persist(null), [persist]);
  return { chapters, custom, move, reset };
}

/** libellé tamponné en tête des pages : « Chapitre 3 · Les suites numériques » */
export const chapterLabel = (c?: { num: number; title: string } | null) => (c ? `Chapitre ${c.num} · ${c.title}` : "");

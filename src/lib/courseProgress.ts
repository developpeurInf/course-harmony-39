/**
 * Progression de lecture des chapitres (table course_progress).
 * Silencieux tant que la migration n'est pas appliquée.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export interface CourseProgressRow {
  course_id: string;
  opened_at: string;
  read_at: string | null;
}

/** Enregistre l'ouverture d'un chapitre sans écraser read_at */
export async function markCourseOpened(studentId: string, courseId: string) {
  const { error } = await db
    .from("course_progress")
    .upsert({ student_id: studentId, course_id: courseId, opened_at: new Date().toISOString() }, { onConflict: "student_id,course_id" });
  return !error;
}

export async function setCourseRead(studentId: string, courseId: string, read: boolean) {
  const { error } = await db
    .from("course_progress")
    .upsert({ student_id: studentId, course_id: courseId, read_at: read ? new Date().toISOString() : null }, { onConflict: "student_id,course_id" });
  return !error;
}

/** Map course_id → ligne de progression pour l'élève connecté */
export function useCourseProgress(studentId: string | undefined, enabled = true) {
  const [map, setMap] = useState<Record<string, CourseProgressRow>>({});
  useEffect(() => {
    if (!studentId || !enabled) return;
    let alive = true;
    db.from("course_progress").select("course_id, opened_at, read_at").eq("student_id", studentId)
      .then(({ data, error }: any) => {
        if (!alive || error) return;
        const m: Record<string, CourseProgressRow> = {};
        (data || []).forEach((r: CourseProgressRow) => { m[r.course_id] = r; });
        setMap(m);
      });
    return () => { alive = false; };
  }, [studentId, enabled]);
  return map;
}

/**
 * Chargement des données d'une classe pour les outils de suivi (présences,
 * groupes de besoin, appréciations, bilans) : élèves, résultats aux quiz, sessions.
 * Mêmes règles que StudentActivities (élèves rattachés à la classe OU inscrits).
 */
import { supabase } from "@/integrations/supabase/client";
import type { AQuiz, AStudent, ASession, ASubmission, AQuestion } from "@/lib/classAnalytics";

export interface RoomStudent extends AStudent {
  username?: string | null;
}

export async function loadRoomStudents(roomId: string): Promise<RoomStudent[]> {
  const [{ data: direct }, { data: enr }] = await Promise.all([
    supabase.from("profiles").select("id, name, email, username, avatar_url").eq("role", "student").eq("room_id", roomId),
    supabase.from("enrollments").select("student_id").eq("room_id", roomId),
  ]);
  const map = new Map<string, RoomStudent>();
  (direct || []).forEach((p: any) => map.set(p.id, p));
  const missing = Array.from(new Set<string>((enr || []).map((e: any) => e.student_id as string))).filter((id) => !map.has(id));
  if (missing.length) {
    const { data: extra } = await supabase.from("profiles").select("id, name, email, username, avatar_url, role").in("id", missing);
    (extra || []).filter((p: any) => p.role === "student").forEach((p: any) => map.set(p.id, p));
  }
  return Array.from(map.values()).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

export interface RoomResults {
  quizzes: AQuiz[];
  submissions: ASubmission[];
  questions: AQuestion[];
  sessions: ASession[];
}

/** Quiz de la classe, copies rendues, questions et sessions (sans le détail des réponses) */
export async function loadRoomResults(roomId: string): Promise<RoomResults> {
  const { data: roomCourses } = await supabase.from("courses").select("id").eq("room_id", roomId);
  const courseIds = (roomCourses || []).map((c: any) => c.id);
  let quizzes: AQuiz[] = [];
  if (courseIds.length) {
    const { data: ex } = await supabase
      .from("exams")
      .select("id, title, exam_date, created_at, course_id, type")
      .in("course_id", courseIds)
      .eq("type", "quiz");
    quizzes = (ex || []).map((e: any) => ({ id: e.id, title: e.title, date: e.exam_date || e.created_at, course_id: e.course_id }));
  }
  const ids = quizzes.map((q) => q.id);
  let submissions: ASubmission[] = [];
  let questions: AQuestion[] = [];
  if (ids.length) {
    const [{ data: s }, { data: q }] = await Promise.all([
      supabase.from("quiz_submissions")
        .select("id, exam_id, student_id, score, total_points, submitted_at, time_taken_minutes")
        .in("exam_id", ids)
        .eq("is_completed", true),
      supabase.from("quiz_questions")
        .select("id, exam_id, question, question_order, points, question_type")
        .in("exam_id", ids),
    ]);
    submissions = (s || []) as ASubmission[];
    questions = (q || []) as AQuestion[];
  }
  const { data: sess } = await supabase
    .from("student_sessions")
    .select("student_id, session_start, last_activity, duration_minutes, is_active")
    .eq("room_id", roomId)
    .order("session_start", { ascending: false })
    .limit(5000);
  return { quizzes, submissions, questions, sessions: (sess || []) as ASession[] };
}

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface AttendanceRow {
  id?: string;
  room_id: string;
  student_id: string;
  session_date: string; // AAAA-MM-JJ
  slot: number;
  status: AttendanceStatus;
  note?: string | null;
}

export const isMissingRelation = (e: any) =>
  /does not exist|Could not find|schema cache|relation/i.test(String(e?.message || ""));

/** Présences d'une classe entre deux dates (incluses, AAAA-MM-JJ) */
export async function loadAttendance(roomId: string, from?: string, to?: string): Promise<AttendanceRow[]> {
  let q = (supabase as any).from("attendance").select("id, room_id, student_id, session_date, slot, status, note").eq("room_id", roomId);
  if (from) q = q.gte("session_date", from);
  if (to) q = q.lte("session_date", to);
  const { data, error } = await q.order("session_date", { ascending: false }).limit(20000);
  if (error) throw error;
  return (data || []) as AttendanceRow[];
}

/** Absences / retards par élève */
export function attendanceTotals(rows: AttendanceRow[]) {
  const m = new Map<string, { absent: number; late: number; excused: number; sessions: number }>();
  rows.forEach((r) => {
    const t = m.get(r.student_id) || { absent: 0, late: 0, excused: 0, sessions: 0 };
    t.sessions += 1;
    if (r.status === "absent") t.absent += 1;
    else if (r.status === "late") t.late += 1;
    else if (r.status === "excused") t.excused += 1;
    m.set(r.student_id, t);
  });
  return m;
}

/** Date locale AAAA-MM-JJ (pas toISOString, qui passe en UTC) */
export const localDay = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Début de l'année scolaire (1er septembre) */
export const schoolYearStart = (d: Date = new Date()) =>
  localDay(new Date(d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1, 8, 1));

/** Export CSV (séparateur « ; », BOM pour Excel) */
export function toCsv(rows: (string | number | null | undefined)[][]): Blob {
  const csv = "﻿" + rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
  return new Blob([csv], { type: "text/csv;charset=utf-8;" });
}

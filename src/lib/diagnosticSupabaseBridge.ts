import { supabase } from "@/integrations/supabase/client";
import { DiagnosticClass, DiagnosticStudent } from "./diagnosticStatsEngine";

const NOTES_STORAGE_KEY = "diageval_real_student_notes_v1";
const DATES_STORAGE_KEY = "diageval_real_room_dates_v1";
const INCLUDED_ROOMS_KEY = "diageval_included_rooms_v1";

export function getStoredStudentNotes(): Record<string, number | string | null> {
  try {
    const raw = localStorage.getItem(NOTES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveStoredStudentNotes(notes: Record<string, number | string | null>): void {
  try {
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
  } catch (e) {
    console.error("Erreur de sauvegarde des notes:", e);
  }
}

export function getStoredRoomDates(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DATES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveStoredRoomDates(dates: Record<string, string>): void {
  try {
    localStorage.setItem(DATES_STORAGE_KEY, JSON.stringify(dates));
  } catch (e) {
    console.error("Erreur de sauvegarde des dates:", e);
  }
}

export function getStoredIncludedRooms(): string[] | null {
  try {
    const raw = localStorage.getItem(INCLUDED_ROOMS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function saveStoredIncludedRooms(roomIds: string[]): void {
  try {
    localStorage.setItem(INCLUDED_ROOMS_KEY, JSON.stringify(roomIds));
  } catch (e) {
    console.error("Erreur de sauvegarde des classes sélectionnées:", e);
  }
}

/**
 * Récupère dynamiquement toutes les salles de cours (classes) créées dans Class Management
 * ainsi que tous les élèves associés (directs dans profiles + enrollments).
 */
export async function fetchDiagnosticClassesFromSupabase(
  professorId?: string,
  providedRooms?: Array<{ id: string; name: string; description?: string; professor_id?: string }>
): Promise<DiagnosticClass[]> {
  try {
    let rooms: Array<{ id: string; name: string; description?: string; professor_id?: string }> = [];

    if (providedRooms && providedRooms.length > 0) {
      // Utiliser directement les salles filtrées du professeur depuis CourseContext (Class Management)
      rooms = providedRooms;
    } else {
      // 1. Récupérer les classes (rooms) du professeur connecté
      let query = supabase
        .from("rooms")
        .select("id, name, description, professor_id, created_at")
        .order("created_at", { ascending: false });
      
      if (professorId) {
        query = query.eq("professor_id", professorId);
      }
      
      const { data: userRooms, error: roomsError } = await query;
      if (roomsError) {
        console.error("Erreur chargement rooms Supabase:", roomsError);
        return [];
      }
      rooms = userRooms || [];
    }

    if (rooms.length === 0) {
      return [];
    }

    // Récupérer les notes et dates enregistrées
    const storedNotes = getStoredStudentNotes();
    const storedDates = getStoredRoomDates();

    // 2. Pour chaque salle, récupérer ses élèves
    const classes: DiagnosticClass[] = [];

    for (const room of rooms) {
      // Élèves directs dans profiles
      const { data: directProfiles } = await supabase
        .from("profiles")
        .select("id, name, username, email, role")
        .eq("role", "student")
        .eq("room_id", room.id)
        .order("name");

      // Élèves inscrits via enrollments
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("student_id")
        .eq("room_id", room.id);

      const enrolledStudentIds = (enrollments || []).map(e => e.student_id).filter(Boolean);

      let enrolledProfiles: any[] = [];
      if (enrolledStudentIds.length > 0) {
        const { data: extraProfiles } = await supabase
          .from("profiles")
          .select("id, name, username, email, role")
          .in("id", enrolledStudentIds);
        enrolledProfiles = extraProfiles || [];
      }

      // Fusion et déduplication
      const studentMap = new Map<string, any>();
      (directProfiles || []).forEach(p => studentMap.set(p.id, p));
      enrolledProfiles.forEach(p => studentMap.set(p.id, p));

      const allRoomStudents = Array.from(studentMap.values()).sort((a, b) => a.name.localeCompare(b.name));

      const students: DiagnosticStudent[] = allRoomStudents.map((s, idx) => {
        const noteVal = storedNotes[s.id] ?? null;
        return {
          id: s.id,
          num: idx + 1,
          massar: s.username || `M13${1000 + idx + 1}`,
          name: s.name,
          note: noteVal
        };
      });

      classes.push({
        id: room.id,
        nom: room.name,
        date: storedDates[room.id] || "06-10-2024",
        students
      });
    }

    return classes;
  } catch (err) {
    console.error("Erreur globale lors de la récupération des classes:", err);
    return [];
  }
}

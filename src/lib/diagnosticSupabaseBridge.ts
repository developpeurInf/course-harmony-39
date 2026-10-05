import { supabase } from "@/integrations/supabase/client";
import { DiagnosticClass, DiagnosticStudent } from "./diagnosticStatsEngine";
import { DiagnosticConfig, DEFAULT_DIAGNOSTIC_DATA } from "./diagnosticStorage";

const NOTES_STORAGE_KEY = "diageval_real_student_notes_v1";
const DATES_STORAGE_KEY = "diageval_real_room_dates_v1";
const INCLUDED_ROOMS_KEY = "diageval_included_rooms_v1";
const CONFIG_STORAGE_KEY = "diageval_pro_data_v1";

/**
 * Récupère les notes en cache local synchrone
 */
export function getStoredStudentNotes(): Record<string, number | string | null> {
  try {
    const raw = localStorage.getItem(NOTES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

/**
 * Sauvegarde les notes à la fois en LocalStorage et dans Supabase Cloud
 */
export async function saveStoredStudentNotes(
  notes: Record<string, number | string | null>,
  roomId?: string,
  professorId?: string
): Promise<void> {
  // 1. Sauvegarde locale immédiate
  try {
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
  } catch (e) {
    console.error("Erreur de sauvegarde locale des notes:", e);
  }

  // 2. Synchronisation dans Supabase Cloud (student_activities)
  try {
    const targetUserId = professorId || "00000000-0000-0000-0000-000000000000";
    await supabase.from("student_activities").insert({
      room_id: roomId || null,
      student_id: targetUserId,
      activity_type: "diagnostic_notes_batch",
      activity_data: {
        notes,
        room_id: roomId || null,
        updated_at: new Date().toISOString()
      } as any
    });
  } catch (err) {
    console.warn("Avertissement synchronisation cloud des notes:", err);
  }
}

/**
 * Récupère les notes enregistrées depuis Supabase Cloud et fusionne avec le local
 */
export async function fetchCloudStudentNotes(): Promise<Record<string, number | string | null>> {
  const localNotes = getStoredStudentNotes();

  try {
    const { data, error } = await supabase
      .from("student_activities")
      .select("activity_data, created_at")
      .eq("activity_type", "diagnostic_notes_batch")
      .order("created_at", { ascending: true })
      .limit(100);

    if (error || !data) {
      return localNotes;
    }

    const merged: Record<string, number | string | null> = { ...localNotes };

    // Fusionner chronologiquement : les écritures les plus récentes écrasent les anciennes
    data.forEach((row: any) => {
      const batch = row.activity_data?.notes;
      if (batch && typeof batch === "object") {
        Object.keys(batch).forEach(k => {
          if (batch[k] !== undefined) {
            merged[k] = batch[k];
          }
        });
      }
    });

    // Mettre à jour le cache local avec les données cloud
    try {
      localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(merged));
    } catch (_) {}

    return merged;
  } catch (err) {
    console.warn("Impossible de charger les notes depuis Supabase:", err);
    return localNotes;
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

export async function saveStoredRoomDates(
  dates: Record<string, string>,
  roomId?: string,
  professorId?: string
): Promise<void> {
  try {
    localStorage.setItem(DATES_STORAGE_KEY, JSON.stringify(dates));
  } catch (e) {
    console.error("Erreur de sauvegarde des dates:", e);
  }

  try {
    const targetUserId = professorId || "00000000-0000-0000-0000-000000000000";
    await supabase.from("student_activities").insert({
      room_id: roomId || null,
      student_id: targetUserId,
      activity_type: "diagnostic_room_dates",
      activity_data: {
        dates,
        updated_at: new Date().toISOString()
      } as any
    });
  } catch (err) {
    console.warn("Avertissement synchronisation cloud des dates:", err);
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
 * Sauvegarde la configuration diagnostic (exercices, observations, remédiation) dans Supabase Cloud
 */
export async function saveDiagnosticConfigToCloud(
  config: DiagnosticConfig,
  professorId?: string
): Promise<void> {
  // 1. Sauvegarde locale
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    const appData = raw ? JSON.parse(raw) : DEFAULT_DIAGNOSTIC_DATA;
    appData.config = config;
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(appData));
  } catch (e) {
    console.error("Erreur de sauvegarde locale de la config:", e);
  }

  // 2. Synchronisation Supabase Cloud
  try {
    const targetUserId = professorId || "00000000-0000-0000-0000-000000000000";
    await supabase.from("student_activities").insert({
      student_id: targetUserId,
      activity_type: "diagnostic_config_cloud",
      activity_data: {
        config,
        updated_at: new Date().toISOString()
      } as any
    });
  } catch (err) {
    console.warn("Avertissement synchronisation cloud de la config:", err);
  }
}

/**
 * Récupère la configuration diagnostic depuis Supabase Cloud
 */
export async function fetchDiagnosticConfigFromCloud(): Promise<DiagnosticConfig | null> {
  try {
    const { data, error } = await supabase
      .from("student_activities")
      .select("activity_data, created_at")
      .eq("activity_type", "diagnostic_config_cloud")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return null;
    }

    const cloudConfig = data[0].activity_data?.config;
    if (cloudConfig && typeof cloudConfig === "object") {
      return cloudConfig as DiagnosticConfig;
    }
    return null;
  } catch (err) {
    console.warn("Impossible de charger la config cloud:", err);
    return null;
  }
}

/**
 * Récupère dynamiquement toutes les salles de cours (classes) créées dans Class Management
 * ainsi que tous les élèves associés (directs dans profiles + enrollments) avec synchronisation Cloud.
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

    // Récupérer les notes enregistrées (depuis le Cloud Supabase + LocalStorage)
    const storedNotes = await fetchCloudStudentNotes();
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


import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { accessStore } from "@/contexts/AccessContext";
import { useAuth, UserProfile, UserRole } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { COURSE_BUCKET, getFileKind, isExternalUrl, parseVideoUrl, storagePathFromPublicUrl, uploadMaterialFile } from "@/lib/courseMedia";

// Types
export interface Room {
  id: string;
  name: string;
  description: string;
  professor_id: string;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  is_visible: boolean;
  professor_id: string;
  room_id?: string;
  pdf_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Exercise {
  id: string;
  course_id: string;
  title: string;
  description: string;
  due_date: string;
  is_visible: boolean;
  pdf_url?: string;
  created_at: string;
  updated_at: string;
}

/** Pièce jointe d'un exercice (table exercise_materials) : fichier du bucket ou lien vidéo */
export interface ExerciseMaterial {
  id: string;
  exercise_id: string;
  file_name: string;
  file_path: string;
  file_size?: number | null;
  mime_type?: string | null;
  uploaded_at: string;
  uploaded_by?: string | null;
}

export interface ExerciseMaterialsResult {
  saved: ExerciseMaterial[];
  failed: string[];
}

export interface Exam {
  id: string;
  course_id: string;
  title: string;
  description: string;
  exam_date: string;
  duration_minutes: number;
  is_visible: boolean;
  pdf_url?: string;
  type: 'exam' | 'quiz';
  available_from?: string | null;
  available_until?: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuizSettings {
  sequentialQuestions: boolean;
  allowMultipleAttempts: boolean;
  allowCorrections: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  timeLimit: number | null;
  showResultsImmediately: boolean;
  allowReview: boolean;
  /** Protection anti-triche : copier/coller bloqués, sorties de l'onglet détectées, filigrane */
  antiCheat: boolean;
  /** Nombre de sorties de l'onglet tolérées avant envoi automatique (0 = jamais) */
  maxFocusLosses: number;
}

export const DEFAULT_QUIZ_SETTINGS: QuizSettings = {
  sequentialQuestions: false,
  allowMultipleAttempts: false,
  allowCorrections: true,
  shuffleQuestions: false,
  shuffleOptions: false,
  timeLimit: null,
  showResultsImmediately: true,
  allowReview: true,
  antiCheat: true,
  maxFocusLosses: 3,
};

export const serializeExamDescription = (
  rawDescription: string,
  availableUntil: string | null,
  quizMode?: string | null,
  quizSettings?: QuizSettings | null
): string => {
  let clean = (rawDescription || "")
    .replace(/<!--AVAIL_UNTIL:[\s\S]*?-->/g, "")
    .replace(/<!--QUIZ_MODE:[\s\S]*?-->/g, "")
    .replace(/<!--QUIZ_SETTINGS:[\s\S]*?-->/g, "")
    .trim();
  if (availableUntil) clean = `${clean}${clean ? "\n" : ""}<!--AVAIL_UNTIL:${availableUntil}-->`;
  if (quizMode && quizMode !== 'free') clean = `${clean}\n<!--QUIZ_MODE:${quizMode}-->`;
  if (quizSettings) clean = `${clean}\n<!--QUIZ_SETTINGS:${JSON.stringify(quizSettings)}-->`;
  return clean;
};

export const parseExamAvailability = (exam: any): Exam & { quiz_mode?: string; quiz_settings?: QuizSettings } => {
  if (!exam) return exam;
  const desc = exam.description || "";
  const matchUntil = desc.match(/<!--AVAIL_UNTIL:(.+?)-->/);
  const matchMode = desc.match(/<!--QUIZ_MODE:(.+?)-->/);
  const matchSettings = desc.match(/<!--QUIZ_SETTINGS:([\s\S]+?)-->/);

  const available_until = matchUntil ? matchUntil[1].trim() : (exam.available_until || null);
  // ⚠️ Idempotent : si l'examen a déjà été parsé (description nettoyée), on conserve
  // le mode et les paramètres déjà extraits au lieu de retomber sur les valeurs par défaut.
  let quiz_mode = matchMode ? matchMode[1].trim() : (exam.quiz_mode || 'free');

  let quiz_settings: QuizSettings = { ...DEFAULT_QUIZ_SETTINGS, ...(exam.quiz_settings || {}) };
  if (matchSettings) {
    try {
      quiz_settings = { ...DEFAULT_QUIZ_SETTINGS, ...JSON.parse(matchSettings[1].trim()) };
    } catch (e) {
      console.error("Error parsing quiz_settings:", e);
    }
  }

  if (quiz_settings.sequentialQuestions) {
    quiz_mode = 'sequential_timed';
  }

  const cleanDescription = desc
    .replace(/<!--AVAIL_UNTIL:[\s\S]*?-->/g, "")
    .replace(/<!--QUIZ_MODE:[\s\S]*?-->/g, "")
    .replace(/<!--QUIZ_SETTINGS:[\s\S]*?-->/g, "")
    .trim();
  const available_from = exam.available_from || exam.exam_date;

  return {
    ...exam,
    available_from,
    available_until,
    quiz_mode,
    quiz_settings,
    description: cleanDescription
  };
};

// Serialize/parse per-question time limit embedded in the question HTML
export const serializeQuestionText = (questionHtml: string, timeLimitSeconds: number | null): string => {
  const clean = (questionHtml || "").replace(/<!--TIME:\d+-->/g, "").trimEnd();
  if (!timeLimitSeconds || timeLimitSeconds <= 0) return clean;
  return `${clean}<!--TIME:${timeLimitSeconds}-->`;
};

export const parseQuestionText = (rawQuestion: string): { cleanText: string; timeLimitSeconds: number | null } => {
  const match = (rawQuestion || "").match(/<!--TIME:(\d+)-->/);
  const timeLimitSeconds = match ? parseInt(match[1]) : null;
  const cleanText = (rawQuestion || "").replace(/<!--TIME:\d+-->/g, "").trimEnd();
  return { cleanText, timeLimitSeconds };
};

export interface QuizQuestion {
  id: string;
  exam_id: string;
  question: string;
  question_order: number;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer';
  points: number;
  time_limit_seconds?: number | null;
  created_at: string;
  updated_at: string;
}

export interface QuizOption {
  id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean;
  option_order: number;
  created_at: string;
}

export interface QuizSubmission {
  id: string;
  exam_id: string;
  student_id: string;
  submitted_at: string;
  score?: number;
  total_points?: number;
  is_completed: boolean;
  time_taken_minutes?: number;
  /** Nombre d'incidents anti-triche (copier/coller, sorties de l'onglet…) */
  anti_cheat_events?: number;
  anti_cheat_log?: { type: string; at: string; detail?: string }[] | null;
}

export interface QuizAnswer {
  id: string;
  submission_id: string;
  question_id: string;
  selected_option_id?: string;
  text_answer?: string;
  is_correct?: boolean;
  points_earned?: number;
  created_at: string;
}

export interface Enrollment {
  id: string;
  student_id: string;
  course_id: string;
  enrolled_at: string;
  room_id?: string;
}

// Context type
interface CourseContextType {
  rooms: Room[];
  courses: Course[];
  exercises: Exercise[];
  exams: Exam[];
  enrollments: Enrollment[];
  /** Colonnes réduites : id, exam_id, points, question_order (le texte des questions est lu à la demande) */
  quizQuestions: QuizQuestion[];
  /** @deprecated plus chargé globalement : toujours [] (lire quiz_options à la demande) */
  quizOptions: QuizOption[];
  /** Colonnes réduites : id, exam_id, student_id, score, total_points, submitted_at, is_completed */
  quizSubmissions: QuizSubmission[];
  /** @deprecated plus chargé globalement : toujours [] (lire quiz_answers à la demande) */
  quizAnswers: QuizAnswer[];
  loading: boolean;
  
  // Room operations
  addRoom: (room: Omit<Room, "id" | "created_at" | "updated_at" | "professor_id">) => Promise<boolean>;
  updateRoom: (roomId: string, updates: Partial<Room>) => Promise<boolean>;
  deleteRoom: (roomId: string) => Promise<boolean>;
  toggleRoomVisibility: (roomId: string) => Promise<boolean>;
  
  // Course operations
  addCourse: (course: Omit<Course, "id" | "created_at" | "updated_at" | "professor_id">) => Promise<Course | null>;
  updateCourse: (courseId: string, updates: Partial<Course>) => Promise<boolean>;
  deleteCourse: (courseId: string) => Promise<boolean>;
  toggleCourseVisibility: (courseId: string) => Promise<boolean>;
  uploadCoursePdf: (courseId: string, file: File) => Promise<string | null>;
  
  // Exercise operations
  addExercise: (exercise: Omit<Exercise, "id" | "created_at" | "updated_at">) => Promise<Exercise | null>;
  updateExercise: (exerciseId: string, updates: Partial<Exercise>) => Promise<boolean>;
  deleteExercise: (exerciseId: string) => Promise<boolean>;
  toggleExerciseVisibility: (exerciseId: string) => Promise<boolean>;
  /** Ajoute un fichier aux pièces jointes de l'exercice (n'écrase plus le précédent) ; renvoie son URL publique */
  uploadExercisePdf: (exerciseId: string, file: File, courseId?: string) => Promise<string | null>;
  /** Pièces jointes des exercices chargés (toutes, triées par date d'ajout) */
  exerciseMaterials: ExerciseMaterial[];
  /** Pièces jointes d'un exercice */
  getExerciseMaterials: (exerciseId: string) => ExerciseMaterial[];
  /** Relit les pièces jointes de ces exercices */
  loadExerciseMaterials: (exerciseIds: string[]) => Promise<void>;
  /** Envoie un ou plusieurs fichiers (PDF, images compressées, vidéos) */
  uploadExerciseMaterials: (exerciseId: string, files: File[], courseId?: string) => Promise<ExerciseMaterialsResult>;
  uploadExerciseMaterial: (exerciseId: string, file: File, courseId?: string) => Promise<ExerciseMaterial | null>;
  /** Ajoute un lien vidéo (YouTube, Vimeo, .mp4) */
  addExerciseVideoLink: (exerciseId: string, url: string, title?: string) => Promise<ExerciseMaterial | null>;
  /** Supprime une pièce jointe (et son fichier dans le stockage) */
  deleteExerciseMaterial: (materialId: string) => Promise<boolean>;
  
  // Exam operations
  addExam: (exam: Omit<Exam, "id" | "created_at" | "updated_at">) => Promise<Exam | null>;
  updateExam: (examId: string, updates: Partial<Exam>) => Promise<boolean>;
  deleteExam: (examId: string) => Promise<boolean>;
  toggleExamVisibility: (examId: string) => Promise<boolean>;
  uploadExamPdf: (examId: string, file: File, courseId?: string) => Promise<string | null>;
  
  // Quiz operations
  addQuizQuestion: (question: Omit<QuizQuestion, "id" | "created_at" | "updated_at">) => Promise<QuizQuestion | null>;
  addQuizOption: (option: Omit<QuizOption, "id" | "created_at">) => Promise<boolean>;
  updateQuizQuestion: (questionId: string, updates: Partial<QuizQuestion>) => Promise<boolean>;
  deleteQuizQuestion: (questionId: string) => Promise<boolean>;
  getQuizQuestions: (examId: string) => QuizQuestion[];
  getQuizOptions: (questionId: string) => QuizOption[];
  submitQuiz: (submission: Omit<QuizSubmission, "id" | "submitted_at">, answers: Omit<QuizAnswer, "id" | "submission_id" | "created_at">[]) => Promise<boolean>;
  getQuizSubmissions: (examId: string) => QuizSubmission[];
  getStudentQuizSubmission: (examId: string, studentId: string) => QuizSubmission | null;
  
  // Enrollment operations
  enrollStudent: (courseId: string, studentId: string) => Promise<boolean>;
  unenrollStudent: (courseId: string, studentId: string) => Promise<boolean>;
  removeEnrollment: (enrollmentId: string) => Promise<boolean>;
  getEnrolledStudents: (courseId: string) => Promise<UserProfile[]>;
  getStudentCourses: (studentId: string) => Course[];
  getVisibleCoursesForStudent: (studentId: string) => Course[];
  getVisibleExercisesForStudent: (studentId: string) => Exercise[];
  getVisibleExamsForStudent: (studentId: string) => Exam[];
  
  // Utility functions
  /**
   * Relit les données du périmètre (vue globale ou une classe). Un même périmètre relu il y a
   * moins de 30 s n'est pas relu au montage d'une autre page ; `{ force: true }` force la relecture.
   * Les appels identiques simultanés partagent la même requête.
   */
  refreshData: (roomId?: string, opts?: { force?: boolean }) => Promise<void>;
}

const CourseContext = createContext<CourseContextType | undefined>(undefined);

/** Langue active (le contexte de langue est monté à côté de celui-ci, pas au-dessus) */
const activeLang = (): string => {
  try {
    return localStorage.getItem("maataoui-language") || "fr";
  } catch {
    return "fr";
  }
};
/** Message traduit (fr / ar / en) selon la langue active */
const trc = (fr: string, ar: string, en: string): string => {
  const l = activeLang();
  return l === "ar" ? ar : l === "en" ? en : fr;
};
/**
 * Toast d'échec : une erreur d'habilitation renvoyée par la base (offre / quota / règle « hab: »)
 * est transmise telle quelle (l'intercepteur de toasts la rend lisible) ; sinon message traduit.
 */
const toastFail = (fr: string, ar: string, en: string, err?: { message?: string } | null) => {
  const m = err && typeof err.message === "string" ? err.message : "";
  if (m && /(PERMISSION|QUOTA):|"hab:|Changement de rôle non autorisé/.test(m)) {
    toast.error(m);
  } else {
    toast.error(trc(fr, ar, en));
  }
};

/** Retire la colonne de jointure (courses / exams) ajoutée pour filtrer côté base */
const stripJoin = <T,>(row: any, key: string): T => {
  if (row && typeof row === "object" && key in row) {
    const copy = { ...row };
    delete copy[key];
    return copy as T;
  }
  return row as T;
};

/** Durée pendant laquelle un même périmètre n'est pas relu au montage d'une page */
const REFRESH_TTL_MS = 30 * 1000;

const EMPTY_OPTIONS: QuizOption[] = [];
const EMPTY_ANSWERS: QuizAnswer[] = [];

const QUESTION_COLUMNS = "id, exam_id, points, question_order";
const EXERCISE_MATERIAL_COLUMNS = "id, exercise_id, file_name, file_path, file_size, mime_type, uploaded_at, uploaded_by";
/** Fichiers à noms uniques : mis en cache 1 an par le navigateur / CDN */
const STORAGE_CACHE_CONTROL = "31536000";
/** Préfixe des pièces jointes « virtuelles » construites depuis exercises.pdf_url (avant migration) */
export const LEGACY_EXERCISE_MATERIAL_PREFIX = "legacy:";

/** La table exercise_materials n'existe pas (encore) côté base */
const isMissingTableError = (err: any): boolean => {
  if (!err) return false;
  const code = String(err.code || "");
  return code === "42P01" || code === "PGRST205" || code === "PGRST106" ||
    (/exercise_materials/.test(String(err.message || "")) && /(does not exist|schema cache|not find)/i.test(String(err.message || "")));
};

const byUploadedAt = (a: ExerciseMaterial, b: ExerciseMaterial) =>
  (a.uploaded_at || "").localeCompare(b.uploaded_at || "");

const EMPTY_EXERCISE_MATERIALS: ExerciseMaterial[] = [];
const SUBMISSION_COLUMNS = "id, exam_id, student_id, score, total_points, submitted_at, is_completed";

export function CourseProvider({ children }: { children: React.ReactNode }) {
  // Créations identiques en cours (double-clic, double envoi…) : on renvoie la même promesse
  // au lieu d'insérer plusieurs fois le même cours / exercice / examen.
  const inFlightCreations = useRef(new Map<string, Promise<any>>());
  const dedupeCreation = <T,>(key: string, run: () => Promise<T>): Promise<T> => {
    const existing = inFlightCreations.current.get(key);
    if (existing) return existing as Promise<T>;
    const p = run().finally(() => {
      // petite marge : un clic arrivé juste après la réponse est aussi ignoré
      setTimeout(() => inFlightCreations.current.delete(key), 1500);
    });
    inFlightCreations.current.set(key, p);
    return p;
  };
  const { user } = useAuth();
  const userId = user?.id;
  const userRole = user?.role;
  const userRoomId = user?.room_id;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizSubmissions, setQuizSubmissions] = useState<QuizSubmission[]>([]);
  const [exerciseMaterials, setExerciseMaterials] = useState<ExerciseMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  /** false si la table exercise_materials est absente : repli sur exercises.pdf_url */
  const exerciseMaterialsSupportedRef = useRef(true);

  // Dernières valeurs connues, lisibles depuis des fonctions stables (sans closure périmée)
  const hasDataRef = useRef(false);
  hasDataRef.current = courses.length > 0 || rooms.length > 0 || exercises.length > 0 || exams.length > 0;

  // Périmètre actuellement chargé + requêtes en cours (anti-doublons)
  const lastFetchRef = useRef<{ key: string; at: number; href: string } | null>(null);
  const inFlightRef = useRef<{ key: string; promise: Promise<void> } | null>(null);
  const fetchSeqRef = useRef(0);
  /** room_id du périmètre affiché ('' = vue globale) */
  const scopeRoomRef = useRef<string>("");

  /** Lit les pièces jointes de ces exercices (par lots, pour garder des URL courtes) */
  const fetchExerciseMaterials = useCallback(async (exerciseIds: string[]): Promise<ExerciseMaterial[] | null> => {
    const ids = Array.from(new Set(exerciseIds.filter(Boolean)));
    if (ids.length === 0) return [];
    const rows: ExerciseMaterial[] = [];
    for (let i = 0; i < ids.length; i += 150) {
      const { data, error } = await (supabase as any)
        .from('exercise_materials')
        .select(EXERCISE_MATERIAL_COLUMNS)
        .in('exercise_id', ids.slice(i, i + 150))
        .order('uploaded_at', { ascending: true });
      if (error) {
        if (isMissingTableError(error)) exerciseMaterialsSupportedRef.current = false;
        else console.error('Exercise materials fetch error:', error);
        return null;
      }
      exerciseMaterialsSupportedRef.current = true;
      rows.push(...((data || []) as ExerciseMaterial[]));
    }
    return rows;
  }, []);

  const loadExerciseMaterials = useCallback(async (exerciseIds: string[]): Promise<void> => {
    const ids = Array.from(new Set(exerciseIds.filter(Boolean)));
    if (ids.length === 0) return;
    const rows = await fetchExerciseMaterials(ids);
    if (!rows) return;
    const idSet = new Set(ids);
    setExerciseMaterials(prev => prev.filter(m => !idSet.has(m.exercise_id)).concat(rows).sort(byUploadedAt));
  }, [fetchExerciseMaterials]);

  const refreshData = useCallback(async (roomId?: string, opts?: { force?: boolean }): Promise<void> => {
    if (!userId) return;
    const scopeKey = `${userId}|${userRole || ""}|${userRoomId || ""}|${roomId || ""}`;
    const force = !!(opts && opts.force);
    const href = typeof window !== "undefined" ? window.location.pathname + window.location.search : "";

    // 1. Même requête déjà en cours : on la réutilise
    const inFlight = inFlightRef.current;
    if (!force && inFlight && inFlight.key === scopeKey) return inFlight.promise;

    // 2. Même périmètre lu il y a moins de 30 s lors d'une navigation (montage d'une autre page) :
    //    inutile de tout relire. Un appel depuis la même page (après une modification) relit.
    const last = lastFetchRef.current;
    if (!force && last && last.key === scopeKey && Date.now() - last.at < REFRESH_TTL_MS && (last.href === "*" || last.href !== href)) {
      last.href = href;
      return;
    }

    const seq = ++fetchSeqRef.current;
    const run = async () => {
      if (!hasDataRef.current) setLoading(true);
      try {
        // Fetch rooms first - always get all rooms for the professor
        let roomsQuery = supabase.from('rooms').select('*').order('created_at', { ascending: false });
        if (userRole === 'professor') {
          roomsQuery = roomsQuery.eq('professor_id', userId);
        }

        // For courses, exercises, and exams - filter by room if provided
        let coursesQuery = supabase.from('courses').select('*').order('created_at', { ascending: false });
        let exercisesQuery: any = supabase.from('exercises').select('*').order('created_at', { ascending: false });
        let examsQuery: any = supabase.from('exams').select('*').order('created_at', { ascending: false });

        // Filtre « par cours » appliqué aux questions / copies (via l'examen → le cours)
        let examCourseFilter: { column: string; value: string } | null = null;

        if (roomId) {
          coursesQuery = coursesQuery.eq('room_id', roomId);
          exercisesQuery = supabase
            .from('exercises')
            .select(`*, courses!inner ( room_id )`)
            .eq('courses.room_id', roomId)
            .order('created_at', { ascending: false });
          examsQuery = supabase
            .from('exams')
            .select(`*, courses!inner ( room_id )`)
            .eq('courses.room_id', roomId)
            .order('created_at', { ascending: false });
          examCourseFilter = { column: 'room_id', value: roomId };
        } else if (userRole === 'professor') {
          coursesQuery = coursesQuery.eq('professor_id', userId);
          exercisesQuery = supabase
            .from('exercises')
            .select(`*, courses!inner ( professor_id )`)
            .eq('courses.professor_id', userId)
            .order('created_at', { ascending: false });
          examsQuery = supabase
            .from('exams')
            .select(`*, courses!inner ( professor_id )`)
            .eq('courses.professor_id', userId)
            .order('created_at', { ascending: false });
          examCourseFilter = { column: 'professor_id', value: userId };
        } else if (userRole === 'student' && userRoomId) {
          coursesQuery = coursesQuery.eq('room_id', userRoomId).eq('is_visible', true);
          exercisesQuery = supabase
            .from('exercises')
            .select(`*, courses!inner ( room_id, is_visible )`)
            .eq('courses.room_id', userRoomId)
            .eq('is_visible', true)
            .order('created_at', { ascending: false });
          examsQuery = supabase
            .from('exams')
            .select(`*, courses!inner ( room_id, is_visible )`)
            .eq('courses.room_id', userRoomId)
            .eq('is_visible', true)
            .order('created_at', { ascending: false });
          examCourseFilter = { column: 'room_id', value: userRoomId };
        }

        // Inscriptions : un élève ne lit que les siennes
        let enrollmentsQuery = supabase.from('enrollments').select('*');
        if (userRole === 'student') enrollmentsQuery = enrollmentsQuery.eq('student_id', userId);

        // Questions : seulement les colonnes utiles (nombre de questions / points par quiz),
        // limitées aux examens du périmètre. Repli sans filtre si la jointure est refusée.
        const questionsQuery = async () => {
          if (examCourseFilter) {
            const res = await (supabase as any)
              .from('quiz_questions')
              .select(`${QUESTION_COLUMNS}, exams!inner ( courses!inner ( ${examCourseFilter.column} ) )`)
              .eq(`exams.courses.${examCourseFilter.column}`, examCourseFilter.value)
              .order('question_order', { ascending: true });
            if (!res.error) return res;
          }
          return (supabase as any).from('quiz_questions').select(QUESTION_COLUMNS).order('question_order', { ascending: true });
        };

        // Copies : un élève ne lit que les siennes ; un professeur celles de ses examens
        const submissionsQuery = async () => {
          if (userRole === 'student') {
            return (supabase as any)
              .from('quiz_submissions')
              .select(SUBMISSION_COLUMNS)
              .eq('student_id', userId)
              .order('submitted_at', { ascending: false });
          }
          if (examCourseFilter) {
            const res = await (supabase as any)
              .from('quiz_submissions')
              .select(`${SUBMISSION_COLUMNS}, exams!inner ( courses!inner ( ${examCourseFilter.column} ) )`)
              .eq(`exams.courses.${examCourseFilter.column}`, examCourseFilter.value)
              .order('submitted_at', { ascending: false });
            if (!res.error) return res;
          }
          return (supabase as any).from('quiz_submissions').select(SUBMISSION_COLUMNS).order('submitted_at', { ascending: false });
        };

        // Fetch all data in parallel
        const [roomsData, coursesData, exercisesData, examsData, enrollmentsData, questionsData, submissionsData] = await Promise.all([
          roomsQuery,
          coursesQuery,
          exercisesQuery,
          examsQuery,
          enrollmentsQuery,
          questionsQuery(),
          submissionsQuery(),
        ]);

        // Une requête plus récente a été lancée entre-temps : on ne l'écrase pas
        if (seq !== fetchSeqRef.current) return;

        if (roomsData.error) console.error('Rooms fetch error:', roomsData.error);
        else setRooms(roomsData.data || []);

        if (coursesData.error) console.error('Courses fetch error:', coursesData.error);
        else setCourses(coursesData.data || []);

        let loadedExerciseIds: string[] | null = null;
        if (exercisesData.error) console.error('Exercises fetch error:', exercisesData.error);
        else {
          const list = (exercisesData.data || []).map((e: any) => stripJoin<Exercise>(e, 'courses'));
          loadedExerciseIds = list.map((e: Exercise) => e.id);
          setExercises(list);
        }

        if (examsData.error) console.error('Exams fetch error:', examsData.error);
        else setExams((examsData.data || []).map((e: any) => parseExamAvailability(stripJoin<Exam>(e, 'courses'))));

        if (enrollmentsData.error) console.error('Enrollments fetch error:', enrollmentsData.error);
        else setEnrollments(enrollmentsData.data || []);

        if (questionsData.error) console.error('Quiz questions fetch error:', questionsData.error);
        else setQuizQuestions((questionsData.data || []).map((q: any) => stripJoin<QuizQuestion>(q, 'exams')));

        if (submissionsData.error) console.error('Quiz submissions fetch error:', submissionsData.error);
        else setQuizSubmissions((submissionsData.data || []).map((s: any) => stripJoin<QuizSubmission>(s, 'exams')));

        scopeRoomRef.current = roomId || "";
        lastFetchRef.current = { key: scopeKey, at: Date.now(), href: opts && (opts as any).__auto ? "*" : href };

        // Pièces jointes des exercices du périmètre (après coup : n'en retarde pas l'affichage)
        if (loadedExerciseIds) {
          const materials = await fetchExerciseMaterials(loadedExerciseIds);
          if (materials && seq === fetchSeqRef.current) setExerciseMaterials(materials.sort(byUploadedAt));
        }
      } catch (error) {
        console.error('Failed to refresh data:', error);
      } finally {
        if (seq === fetchSeqRef.current) setLoading(false);
      }
    };

    const promise = run().finally(() => {
      if (inFlightRef.current && inFlightRef.current.promise === promise) inFlightRef.current = null;
    });
    inFlightRef.current = { key: scopeKey, promise };
    return promise;
  }, [userId, userRole, userRoomId, fetchExerciseMaterials]);

  // Chargement initial (et à chaque changement de compte / rôle / classe)
  useEffect(() => {
    if (userId) {
      void refreshData(undefined, { __auto: true } as any);
    } else {
      // Déconnexion : on vide les données (iPad partagé entre plusieurs élèves)
      lastFetchRef.current = null;
      inFlightRef.current = null;
      fetchSeqRef.current++;
      setRooms([]);
      setCourses([]);
      setExercises([]);
      setExams([]);
      setEnrollments([]);
      setQuizQuestions([]);
      setQuizSubmissions([]);
      setExerciseMaterials([]);
      setLoading(false);
    }
  }, [userId, userRole, userRoomId, refreshData]);

  /** Faut-il ajouter un élément de cette classe aux listes affichées ? */
  const inScope = (roomId?: string | null) => !scopeRoomRef.current || scopeRoomRef.current === (roomId || "");

  // Room operations
  const addRoom = async (room: Omit<Room, "id" | "created_at" | "updated_at" | "professor_id">): Promise<boolean> => {
    if (!accessStore.guard("class.create")) return false;
    if (!accessStore.guardQuota("classes.max")) return false;
    if (!user || user.role !== "professor") {
      toast.error(trc("Seuls les professeurs peuvent créer une classe", "يمكن للأساتذة فقط إنشاء قسم", "Only professors can add rooms"));
      return false;
    }

    try {
      const { data, error } = await supabase
        .from('rooms')
        .insert([{
          ...room,
          professor_id: user.id
        }])
        .select()
        .single();

      if (error || !data) {
        toastFail("Échec de la création de la classe", "فشل إنشاء القسم", "Failed to add room", error);
        return false;
      }

      setRooms(prev => [data as Room, ...prev.filter(r => r.id !== (data as Room).id)]);
      toast.success(trc("Classe créée avec succès", "تم إنشاء القسم بنجاح", "Room added successfully"));
      return true;
    } catch (error) {
      toastFail("Échec de la création de la classe", "فشل إنشاء القسم", "Failed to add room");
      return false;
    }
  };

  const updateRoom = async (roomId: string, updates: Partial<Room>): Promise<boolean> => {
    if (!accessStore.guard("class.edit")) return false;
    try {
      const { data, error } = await supabase
        .from('rooms')
        .update(updates)
        .eq('id', roomId)
        .select();

      if (error) {
        toastFail("Échec de la mise à jour de la classe", "فشل تحديث القسم", "Failed to update room", error);
        return false;
      }

      const row = data && data[0] ? (data[0] as Room) : null;
      setRooms(prev => prev.map(room =>
        room.id === roomId ? (row ? { ...room, ...row } : { ...room, ...updates }) : room
      ));
      toast.success(trc("Classe mise à jour avec succès", "تم تحديث القسم بنجاح", "Room updated successfully"));
      return true;
    } catch (error) {
      toastFail("Échec de la mise à jour de la classe", "فشل تحديث القسم", "Failed to update room");
      return false;
    }
  };

  const deleteRoom = async (roomId: string): Promise<boolean> => {
    if (!accessStore.guard("class.delete")) return false;
    try {
      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', roomId);

      if (error) {
        toastFail("Échec de la suppression de la classe", "فشل حذف القسم", "Failed to delete room", error);
        return false;
      }

      setRooms(prev => prev.filter(room => room.id !== roomId));
      toast.success(trc("Classe supprimée avec succès", "تم حذف القسم بنجاح", "Room deleted successfully"));
      return true;
    } catch (error) {
      toastFail("Échec de la suppression de la classe", "فشل حذف القسم", "Failed to delete room");
      return false;
    }
  };

  const toggleRoomVisibility = async (roomId: string): Promise<boolean> => {
    if (!accessStore.guard("class.edit")) return false;
    const room = rooms.find(r => r.id === roomId);
    if (!room) return false;

    return await updateRoom(roomId, { is_visible: !room.is_visible });
  };

  // Course operations
  const addCourseImpl = async (course: Omit<Course, "id" | "created_at" | "updated_at" | "professor_id">): Promise<Course | null> => {
    if (!accessStore.guard("course.edit")) return null;
    if (!user || user.role !== "professor") {
      toast.error(trc("Seuls les professeurs peuvent ajouter un cours", "يمكن للأساتذة فقط إضافة درس", "Only professors can add courses"));
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('courses')
        .insert([{
          ...course,
          professor_id: user.id
        }])
        .select()
        .single();

      if (error || !data) {
        toastFail("Échec de l'ajout du cours", "فشل إضافة الدرس", "Failed to add course", error);
        return null;
      }

      const created = data as Course;
      if (inScope(created.room_id)) {
        setCourses(prev => [created, ...prev.filter(c => c.id !== created.id)]);
      }
      toast.success(trc("Cours ajouté avec succès", "تمت إضافة الدرس بنجاح", "Course added successfully"));

      // Notify enrolled and room students
      setTimeout(async () => {
        await notifyStudentsAboutUpdate({
          courseId: created.id,
          roomId: course.room_id,
          title: course.title,
          itemType: 'course',
          action: 'add'
        });
      }, 500);

      return created;
    } catch (error) {
      toastFail("Échec de l'ajout du cours", "فشل إضافة الدرس", "Failed to add course");
      return null;
    }
  };

  const updateCourse = async (courseId: string, updates: Partial<Course>): Promise<boolean> => {
    if (!accessStore.guard("course.edit")) return false;
    try {
      const { data, error } = await supabase
        .from('courses')
        .update(updates)
        .eq('id', courseId)
        .select();

      if (error) {
        toastFail("Échec de la mise à jour du cours", "فشل تحديث الدرس", "Failed to update course", error);
        return false;
      }

      const row = data && data[0] ? (data[0] as Course) : null;
      setCourses(prev => prev
        .map(c => (c.id === courseId ? (row ? { ...c, ...row } : { ...c, ...updates }) : c))
        // déplacé dans une autre classe que celle affichée : on le retire de la liste
        .filter(c => c.id !== courseId || inScope(c.room_id)));
      toast.success(trc("Cours mis à jour avec succès", "تم تحديث الدرس بنجاح", "Course updated successfully"));

      // Notify enrolled and room students about modification
      const course = courses.find(c => c.id === courseId);
      const courseTitle = updates.title || course?.title || 'Cours';
      const courseRoomId = updates.room_id || course?.room_id;

      setTimeout(async () => {
        await notifyStudentsAboutUpdate({
          courseId,
          roomId: courseRoomId,
          title: courseTitle,
          itemType: 'course',
          action: 'update'
        });
      }, 500);

      return true;
    } catch (error) {
      toastFail("Échec de la mise à jour du cours", "فشل تحديث الدرس", "Failed to update course");
      return false;
    }
  };

  const deleteCourse = async (courseId: string): Promise<boolean> => {
    if (!accessStore.guard("course.delete")) return false;
    try {
      // Find course details before deletion
      const courseToDelete = courses.find(c => c.id === courseId);
      const courseTitle = courseToDelete?.title || 'Cours';
      const courseRoomId = courseToDelete?.room_id;

      // Delete course materials
      const { error: materialsError } = await supabase
        .from('course_materials')
        .delete()
        .eq('course_id', courseId);

      if (materialsError) console.error('Error deleting course materials:', materialsError);

      // Get all exams for this course to delete quiz data
      const { data: courseExams } = await supabase
        .from('exams')
        .select('id')
        .eq('course_id', courseId);

      const examIds = (courseExams || []).map(e => e.id);
      if (examIds.length > 0) {
        // Delete quiz submissions and answers for these exams
        const { data: submissions } = await supabase
          .from('quiz_submissions')
          .select('id')
          .in('exam_id', examIds);

        if (submissions && submissions.length > 0) {
          const submissionIds = submissions.map(s => s.id);

          await supabase
            .from('quiz_answers')
            .delete()
            .in('submission_id', submissionIds);

          await supabase
            .from('quiz_submissions')
            .delete()
            .in('exam_id', examIds);
        }

        // Delete quiz options
        const { data: questions } = await supabase
          .from('quiz_questions')
          .select('id')
          .in('exam_id', examIds);

        if (questions && questions.length > 0) {
          const questionIds = questions.map(q => q.id);

          await supabase
            .from('quiz_options')
            .delete()
            .in('question_id', questionIds);

          await supabase
            .from('quiz_questions')
            .delete()
            .in('exam_id', examIds);
        }
      }

      // Delete exercises for this course
      const { error: exercisesError } = await supabase
        .from('exercises')
        .delete()
        .eq('course_id', courseId);

      if (exercisesError) {
        console.error('Error deleting exercises:', exercisesError);
        toastFail("Échec de la suppression des exercices du cours", "فشل حذف تمارين الدرس", "Failed to delete course exercises", exercisesError);
        return false;
      }

      // Delete exams for this course
      const { error: examsError } = await supabase
        .from('exams')
        .delete()
        .eq('course_id', courseId);

      if (examsError) {
        console.error('Error deleting exams:', examsError);
        toastFail("Échec de la suppression des évaluations du cours", "فشل حذف تقييمات الدرس", "Failed to delete course exams", examsError);
        return false;
      }

      // Delete enrollments
      const { error: enrollmentsError } = await supabase
        .from('enrollments')
        .delete()
        .eq('course_id', courseId);

      if (enrollmentsError) console.error('Error deleting enrollments:', enrollmentsError);

      // Delete notifications
      const { error: notificationsError } = await supabase
        .from('notifications')
        .delete()
        .eq('course_id', courseId);

      if (notificationsError) console.error('Error deleting notifications:', notificationsError);

      // Finally, delete the course itself
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId);

      if (error) {
        console.error('Error deleting course:', error);
        toastFail("Échec de la suppression du cours", "فشل حذف الدرس", "Failed to delete course", error);
        return false;
      }

      // Mise à jour locale (cours + tout ce qui en dépend), sans tout relire
      const removedExamIds = new Set<string>(examIds);
      exams.forEach(e => { if (e.course_id === courseId) removedExamIds.add(e.id); });
      setCourses(prev => prev.filter(c => c.id !== courseId));
      setExercises(prev => prev.filter(e => e.course_id !== courseId));
      setExams(prev => prev.filter(e => e.course_id !== courseId));
      setEnrollments(prev => prev.filter(e => e.course_id !== courseId));
      setQuizQuestions(prev => prev.filter(q => !removedExamIds.has(q.exam_id)));
      setQuizSubmissions(prev => prev.filter(s => !removedExamIds.has(s.exam_id)));

      // Notify students about course deletion
      if (courseToDelete) {
        setTimeout(async () => {
          await notifyStudentsAboutUpdate({
            courseId,
            roomId: courseRoomId,
            title: courseTitle,
            itemType: 'course',
            action: 'delete'
          });
        }, 500);
      }

      toast.success(trc("Cours et données associées supprimés avec succès", "تم حذف الدرس وجميع البيانات المرتبطة به بنجاح", "Course and all related data deleted successfully"));
      return true;
    } catch (error) {
      console.error('Exception deleting course:', error);
      toastFail("Échec de la suppression du cours", "فشل حذف الدرس", "Failed to delete course");
      return false;
    }
  };

  const toggleCourseVisibility = async (courseId: string): Promise<boolean> => {
    if (!accessStore.guard("course.edit")) return false;
    const course = courses.find(c => c.id === courseId);
    if (!course) return false;

    return await updateCourse(courseId, { is_visible: !course.is_visible });
  };

  const uploadCoursePdf = async (courseId: string, file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `course_${Date.now()}.${fileExt}`;
      const filePath = `courses/${courseId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('course-materials')
        .upload(filePath, file, { upsert: true, contentType: file.type || undefined, cacheControl: STORAGE_CACHE_CONTROL });

      if (uploadError) {
        console.error("Course PDF upload error:", uploadError);
        toastFail("Échec de l'envoi du PDF", "فشل رفع ملف PDF", "Failed to upload PDF", uploadError);
        return null;
      }

      const { data } = supabase.storage
        .from('course-materials')
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;

      // Update course with PDF URL
      await updateCourse(courseId, { pdf_url: publicUrl });

      toast.success(trc("PDF envoyé avec succès", "تم رفع ملف PDF بنجاح", "PDF uploaded successfully"));
      return publicUrl;
    } catch (error) {
      toastFail("Échec de l'envoi du PDF", "فشل رفع ملف PDF", "Failed to upload PDF");
      return null;
    }
  };

  // Exercise operations
  const addExerciseImpl = async (exercise: Omit<Exercise, "id" | "created_at" | "updated_at">): Promise<Exercise | null> => {
    if (!accessStore.guard("exercise.edit")) return null;
    try {
      const { data, error } = await supabase
        .from('exercises')
        .insert([exercise])
        .select()
        .single();

      if (error || !data) {
        toastFail("Échec de l'ajout de l'exercice", "فشل إضافة التمرين", "Failed to add exercise", error);
        return null;
      }

      const created = data as Exercise;
      const parentCourse = courses.find(c => c.id === exercise.course_id);
      if (parentCourse || !scopeRoomRef.current) {
        setExercises(prev => [created, ...prev.filter(e => e.id !== created.id)]);
      }
      toast.success(trc("Exercice ajouté avec succès", "تمت إضافة التمرين بنجاح", "Exercise added successfully"));

      // Notify enrolled and room students
      setTimeout(async () => {
        await notifyStudentsAboutUpdate({
          courseId: exercise.course_id,
          exerciseId: created.id,
          roomId: parentCourse?.room_id,
          title: exercise.title,
          courseTitle: parentCourse?.title,
          itemType: 'exercise',
          action: 'add'
        });
      }, 500);

      return created;
    } catch (error) {
      toastFail("Échec de l'ajout de l'exercice", "فشل إضافة التمرين", "Failed to add exercise");
      return null;
    }
  };

  const updateExercise = async (exerciseId: string, updates: Partial<Exercise>): Promise<boolean> => {
    if (!accessStore.guard("exercise.edit")) return false;
    try {
      const { data, error } = await supabase
        .from('exercises')
        .update(updates)
        .eq('id', exerciseId)
        .select();

      if (error) {
        toastFail("Échec de la mise à jour de l'exercice", "فشل تحديث التمرين", "Failed to update exercise", error);
        return false;
      }

      const row = data && data[0] ? (data[0] as Exercise) : null;
      setExercises(prev => prev.map(e => (e.id === exerciseId ? (row ? { ...e, ...row } : { ...e, ...updates }) : e)));
      toast.success(trc("Exercice mis à jour avec succès", "تم تحديث التمرين بنجاح", "Exercise updated successfully"));

      // Notify enrolled and room students about modification
      const exercise = exercises.find(e => e.id === exerciseId);
      const targetCourseId = updates.course_id || exercise?.course_id;
      const parentCourse = courses.find(c => c.id === targetCourseId);
      const exerciseTitle = updates.title || exercise?.title || 'Exercice';

      setTimeout(async () => {
        await notifyStudentsAboutUpdate({
          courseId: targetCourseId,
          exerciseId,
          roomId: parentCourse?.room_id,
          title: exerciseTitle,
          courseTitle: parentCourse?.title,
          itemType: 'exercise',
          action: 'update'
        });
      }, 500);

      return true;
    } catch (error) {
      toastFail("Échec de la mise à jour de l'exercice", "فشل تحديث التمرين", "Failed to update exercise");
      return false;
    }
  };

  const deleteExercise = async (exerciseId: string): Promise<boolean> => {
    if (!accessStore.guard("exercise.edit")) return false;
    try {
      const exerciseToDelete = exercises.find(e => e.id === exerciseId);
      const parentCourse = exerciseToDelete ? courses.find(c => c.id === exerciseToDelete.course_id) : null;
      // Fichiers à retirer du stockage une fois l'exercice supprimé (les lignes partent en cascade)
      const storagePaths = exerciseMaterials
        .filter(m => m.exercise_id === exerciseId && !isExternalUrl(m.file_path))
        .map(m => m.file_path);
      const legacyPath = storagePathFromPublicUrl(exerciseToDelete?.pdf_url);
      if (legacyPath && !storagePaths.includes(legacyPath)) storagePaths.push(legacyPath);

      const { error } = await supabase
        .from('exercises')
        .delete()
        .eq('id', exerciseId);

      if (error) {
        toastFail("Échec de la suppression de l'exercice", "فشل حذف التمرين", "Failed to delete exercise", error);
        return false;
      }

      setExercises(prev => prev.filter(e => e.id !== exerciseId));
      setExerciseMaterials(prev => prev.filter(m => m.exercise_id !== exerciseId));
      if (storagePaths.length > 0) {
        void supabase.storage.from(COURSE_BUCKET).remove(storagePaths).catch(() => undefined);
      }

      // Notify students about exercise deletion
      if (exerciseToDelete) {
        setTimeout(async () => {
          await notifyStudentsAboutUpdate({
            courseId: exerciseToDelete.course_id,
            exerciseId,
            roomId: parentCourse?.room_id,
            title: exerciseToDelete.title,
            itemType: 'exercise',
            action: 'delete'
          });
        }, 500);
      }

      toast.success(trc("Exercice supprimé avec succès", "تم حذف التمرين بنجاح", "Exercise deleted successfully"));
      return true;
    } catch (error) {
      toastFail("Échec de la suppression de l'exercice", "فشل حذف التمرين", "Failed to delete exercise");
      return false;
    }
  };

  const toggleExerciseVisibility = async (exerciseId: string): Promise<boolean> => {
    if (!accessStore.guard("exercise.publish")) return false;
    const exercise = exercises.find(e => e.id === exerciseId);
    if (!exercise) return false;

    return await updateExercise(exerciseId, { is_visible: !exercise.is_visible });
  };

  /** Cours de l'exercice (état local, sinon lu en base) */
  const resolveExerciseCourseId = async (exerciseId: string, courseId?: string): Promise<string | undefined> => {
    if (courseId) return courseId;
    const ex = exercises.find(e => e.id === exerciseId);
    if (ex?.course_id) return ex.course_id;
    const { data: exData } = await supabase.from('exercises').select('course_id').eq('id', exerciseId).single();
    return exData?.course_id || undefined;
  };

  /** Met à jour le raccourci historique exercises.pdf_url (dernier PDF joint, ou null) */
  const syncExercisePdfUrl = async (exerciseId: string, pdfUrl: string | null) => {
    const { error } = await supabase.from('exercises').update({ pdf_url: pdfUrl }).eq('id', exerciseId);
    if (error) {
      console.error('Exercise pdf_url sync error:', error);
      return;
    }
    setExercises(prev => prev.map(e => (e.id === exerciseId ? { ...e, pdf_url: pdfUrl || undefined } : e)));
  };

  /** Ancien fonctionnement (table exercise_materials absente) : un seul PDF dans exercises.pdf_url */
  const uploadExercisePdfLegacy = async (exerciseId: string, file: File, targetCourseId?: string): Promise<string | null> => {
    const folder = targetCourseId ? `courses/${targetCourseId}` : 'exercises';
    const { publicUrl } = await uploadMaterialFile(file, folder, `exercise_${exerciseId}_`);
    const { error: updError } = await supabase
      .from('exercises')
      .update({ pdf_url: publicUrl })
      .eq('id', exerciseId);
    if (updError) {
      toastFail("Échec de l'envoi du PDF", "فشل رفع ملف PDF", "Failed to upload PDF", updError);
      return null;
    }
    setExercises(prev => prev.map(e => (e.id === exerciseId ? { ...e, pdf_url: publicUrl } : e)));
    return publicUrl;
  };

  /** Envoie les fichiers sans toast ; renvoie les lignes créées et les noms en échec */
  const saveExerciseFiles = async (exerciseId: string, files: File[], courseId?: string): Promise<ExerciseMaterialsResult & { legacyUrl?: string | null; lastError?: any }> => {
    const saved: ExerciseMaterial[] = [];
    const failed: string[] = [];
    let lastError: any = null;
    let lastPdfUrl: string | null = null;
    let legacyUrl: string | null = null;
    const targetCourseId = await resolveExerciseCourseId(exerciseId, courseId);
    const folder = targetCourseId ? `courses/${targetCourseId}` : 'exercises';

    for (const original of files) {
      try {
        if (!exerciseMaterialsSupportedRef.current) {
          const url = await uploadExercisePdfLegacy(exerciseId, original, targetCourseId);
          if (!url) throw new Error('legacy upload failed');
          legacyUrl = url;
          continue;
        }
        const { file, filePath, kind, publicUrl } = await uploadMaterialFile(original, folder, `exercise_${exerciseId}_`);
        const { data, error } = await (supabase as any)
          .from('exercise_materials')
          .insert({
            exercise_id: exerciseId,
            file_name: original.name,
            file_path: filePath,
            file_size: file.size,
            mime_type: file.type || null,
            uploaded_by: userId || null,
          })
          .select(EXERCISE_MATERIAL_COLUMNS)
          .single();
        if (error || !data) {
          if (isMissingTableError(error)) {
            // Migration pas encore appliquée : on garde le fichier comme PDF unique de l'exercice
            exerciseMaterialsSupportedRef.current = false;
            const { error: updError } = await supabase.from('exercises').update({ pdf_url: publicUrl }).eq('id', exerciseId);
            if (updError) throw updError;
            setExercises(prev => prev.map(e => (e.id === exerciseId ? { ...e, pdf_url: publicUrl } : e)));
            legacyUrl = publicUrl;
            continue;
          }
          await supabase.storage.from(COURSE_BUCKET).remove([filePath]).catch(() => undefined);
          throw error || new Error('insert failed');
        }
        saved.push(data as ExerciseMaterial);
        if (kind === 'pdf') lastPdfUrl = publicUrl;
      } catch (error: any) {
        console.error('Exercise material upload failed:', original.name, error);
        lastError = error;
        failed.push(original.name);
      }
    }

    if (saved.length > 0) {
      setExerciseMaterials(prev => prev.filter(m => !saved.some(s => s.id === m.id)).concat(saved).sort(byUploadedAt));
    }
    // Raccourci historique : exercises.pdf_url pointe vers le dernier PDF joint
    if (lastPdfUrl) await syncExercisePdfUrl(exerciseId, lastPdfUrl);
    return { saved, failed, lastError, legacyUrl };
  };

  const uploadExerciseMaterials = async (exerciseId: string, files: File[], courseId?: string): Promise<ExerciseMaterialsResult> => {
    if (!accessStore.guard("exercise.edit")) return { saved: [], failed: files.map(f => f.name) };
    if (files.length === 0) return { saved: [], failed: [] };
    try {
      const res = await saveExerciseFiles(exerciseId, files, courseId);
      const okCount = res.saved.length + (res.legacyUrl ? 1 : 0);
      if (res.failed.length > 0) {
        toastFail(
          `Échec de l'envoi : ${res.failed.join(", ")}`,
          `فشل رفع: ${res.failed.join("، ")}`,
          `Upload failed: ${res.failed.join(", ")}`,
          res.lastError
        );
      }
      if (okCount > 0) {
        toast.success(okCount > 1
          ? trc(`${okCount} fichiers joints à l'exercice`, `تم إرفاق ${okCount} ملفات بالتمرين`, `${okCount} files attached to the exercise`)
          : trc("Fichier joint à l'exercice", "تم إرفاق الملف بالتمرين", "File attached to the exercise"));
      }
      return { saved: res.saved, failed: res.failed };
    } catch (error) {
      toastFail("Échec de l'envoi des fichiers", "فشل رفع الملفات", "Failed to upload files", error as any);
      return { saved: [], failed: files.map(f => f.name) };
    }
  };

  const uploadExerciseMaterial = async (exerciseId: string, file: File, courseId?: string): Promise<ExerciseMaterial | null> => {
    const res = await uploadExerciseMaterials(exerciseId, [file], courseId);
    return res.saved[0] || null;
  };

  /** Compatibilité : ajoute le fichier aux pièces jointes (n'écrase plus) et renvoie son URL publique */
  const uploadExercisePdf = async (exerciseId: string, file: File, courseId?: string): Promise<string | null> => {
    if (!accessStore.guard("exercise.edit")) return null;
    try {
      const res = await saveExerciseFiles(exerciseId, [file], courseId);
      if (res.legacyUrl) {
        toast.success(trc("PDF envoyé avec succès", "تم رفع ملف PDF بنجاح", "PDF uploaded successfully"));
        return res.legacyUrl;
      }
      const row = res.saved[0];
      if (!row) {
        toastFail("Échec de l'envoi du PDF", "فشل رفع ملف PDF", "Failed to upload PDF", res.lastError);
        return null;
      }
      toast.success(trc("Fichier envoyé avec succès", "تم رفع الملف بنجاح", "File uploaded successfully"));
      return supabase.storage.from(COURSE_BUCKET).getPublicUrl(row.file_path).data.publicUrl;
    } catch (error) {
      toastFail("Échec de l'envoi du PDF", "فشل رفع ملف PDF", "Failed to upload PDF", error as any);
      return null;
    }
  };

  const addExerciseVideoLink = async (exerciseId: string, url: string, title?: string): Promise<ExerciseMaterial | null> => {
    if (!accessStore.guard("exercise.edit")) return null;
    const clean = (url || "").trim();
    if (!parseVideoUrl(clean)) {
      toast.error(trc("Lien vidéo invalide (YouTube, Vimeo ou fichier .mp4)", "رابط فيديو غير صالح (YouTube أو Vimeo أو ملف mp4)", "Invalid video link (YouTube, Vimeo or .mp4)"));
      return null;
    }
    try {
      const { data, error } = await (supabase as any)
        .from('exercise_materials')
        .insert({
          exercise_id: exerciseId,
          file_name: (title || "").trim() || clean,
          file_path: clean,
          file_size: null,
          mime_type: null,
          uploaded_by: userId || null,
        })
        .select(EXERCISE_MATERIAL_COLUMNS)
        .single();
      if (error || !data) {
        if (isMissingTableError(error)) exerciseMaterialsSupportedRef.current = false;
        toastFail("Échec de l'ajout du lien vidéo", "فشل إضافة رابط الفيديو", "Failed to add the video link", error);
        return null;
      }
      const row = data as ExerciseMaterial;
      setExerciseMaterials(prev => prev.filter(m => m.id !== row.id).concat(row).sort(byUploadedAt));
      toast.success(trc("Vidéo ajoutée à l'exercice", "تمت إضافة الفيديو إلى التمرين", "Video added to the exercise"));
      return row;
    } catch (error) {
      toastFail("Échec de l'ajout du lien vidéo", "فشل إضافة رابط الفيديو", "Failed to add the video link");
      return null;
    }
  };

  const deleteExerciseMaterial = async (materialId: string): Promise<boolean> => {
    if (!accessStore.guard("exercise.edit")) return false;
    try {
      // Pièce jointe « virtuelle » (ancien exercises.pdf_url sans ligne dans exercise_materials)
      if (materialId.startsWith(LEGACY_EXERCISE_MATERIAL_PREFIX)) {
        const exerciseId = materialId.slice(LEGACY_EXERCISE_MATERIAL_PREFIX.length);
        const ex = exercises.find(e => e.id === exerciseId);
        const { error } = await supabase.from('exercises').update({ pdf_url: null }).eq('id', exerciseId);
        if (error) {
          toastFail("Échec de la suppression du fichier", "فشل حذف الملف", "Failed to delete the file", error);
          return false;
        }
        setExercises(prev => prev.map(e => (e.id === exerciseId ? { ...e, pdf_url: undefined } : e)));
        const path = storagePathFromPublicUrl(ex?.pdf_url);
        if (path) void supabase.storage.from(COURSE_BUCKET).remove([path]).catch(() => undefined);
        toast.success(trc("Fichier supprimé", "تم حذف الملف", "File deleted"));
        return true;
      }

      const material = exerciseMaterials.find(m => m.id === materialId);
      const { error } = await (supabase as any).from('exercise_materials').delete().eq('id', materialId);
      if (error) {
        toastFail("Échec de la suppression du fichier", "فشل حذف الملف", "Failed to delete the file", error);
        return false;
      }
      const remaining = exerciseMaterials.filter(m => m.id !== materialId);
      setExerciseMaterials(prev => prev.filter(m => m.id !== materialId));

      if (material) {
        if (!isExternalUrl(material.file_path)) {
          void supabase.storage.from(COURSE_BUCKET).remove([material.file_path]).catch(() => undefined);
        }
        // Le raccourci exercises.pdf_url ne doit pas pointer vers un fichier supprimé
        const ex = exercises.find(e => e.id === material.exercise_id);
        const deletedPath = material.file_path;
        const currentPath = storagePathFromPublicUrl(ex?.pdf_url) || ex?.pdf_url || null;
        if (ex && currentPath && currentPath === deletedPath) {
          const nextPdf = remaining
            .filter(m => m.exercise_id === material.exercise_id && !isExternalUrl(m.file_path) && getFileKind(m.file_path, m.mime_type || undefined) === 'pdf')
            .pop();
          const nextUrl = nextPdf ? supabase.storage.from(COURSE_BUCKET).getPublicUrl(nextPdf.file_path).data.publicUrl : null;
          await syncExercisePdfUrl(material.exercise_id, nextUrl);
        }
      }
      toast.success(trc("Fichier supprimé", "تم حذف الملف", "File deleted"));
      return true;
    } catch (error) {
      toastFail("Échec de la suppression du fichier", "فشل حذف الملف", "Failed to delete the file");
      return false;
    }
  };

  const getExerciseMaterials = (exerciseId: string): ExerciseMaterial[] => {
    const list = exerciseMaterials.filter(m => m.exercise_id === exerciseId);
    return list.length > 0 ? list : EMPTY_EXERCISE_MATERIALS;
  };

  // Exam operations
  const addExamImpl = async (exam: Omit<Exam, "id" | "created_at" | "updated_at">): Promise<Exam | null> => {
    if (!accessStore.guard((exam as any).type === "exam" ? "exam.edit" : "quiz.edit")) return null;
    if (!accessStore.guardQuota("quiz.max_per_month")) return null;
    try {
      const payload: any = {
        title: exam.title,
        // Les quiz reçoivent dès leur création les paramètres par défaut choisis par l'enseignant
        description: serializeExamDescription(
          exam.description || "",
          exam.available_until || null,
          (exam as any).quiz_settings?.sequentialQuestions ? "sequential_timed" : null,
          exam.type === "quiz" ? ((exam as any).quiz_settings || null) : null
        ),
        course_id: exam.course_id,
        exam_date: exam.exam_date,
        duration_minutes: exam.duration_minutes,
        is_visible: exam.is_visible,
        type: exam.type,
      };
      if (exam.pdf_url) payload.pdf_url = exam.pdf_url;

      const { data, error } = await supabase
        .from('exams')
        .insert([payload])
        .select()
        .single();

      if (error || !data) {
        console.error("Supabase insert exam error:", error);
        toastFail("Échec de l'ajout de l'évaluation", "فشل إضافة التقييم", "Failed to add exam", error);
        return null;
      }

      const parsedExam = parseExamAvailability(data);
      const parentCourse = courses.find(c => c.id === exam.course_id);
      if (parentCourse || !scopeRoomRef.current) {
        setExams(prev => [parsedExam, ...prev.filter(e => e.id !== parsedExam.id)]);
      }
      toast.success(trc("Évaluation ajoutée avec succès", "تمت إضافة التقييم بنجاح", "Exam added successfully"));

      // Notify enrolled and room students
      setTimeout(async () => {
        await notifyStudentsAboutUpdate({
          courseId: exam.course_id,
          examId: parsedExam.id,
          roomId: parentCourse?.room_id,
          title: exam.title,
          examDate: exam.exam_date,
          itemType: exam.type === 'quiz' ? 'quiz' : 'exam',
          action: 'add'
        });
      }, 500);

      return parsedExam;
    } catch (error) {
      console.error("addExam error:", error);
      toastFail("Échec de l'ajout de l'évaluation", "فشل إضافة التقييم", "Failed to add exam");
      return null;
    }
  };

  const updateExam = async (examId: string, updates: Partial<Exam>): Promise<boolean> => {
    {
      const t = (updates as any).type || (exams.find(e => e.id === examId) as any)?.type;
      if (!accessStore.guard(t === "exam" ? "exam.edit" : "quiz.edit")) return false;
    }
    try {
      const dbUpdates: any = { ...updates };

      if (updates.available_until !== undefined || updates.description !== undefined) {
        const untilVal = updates.available_until;
        const currentExamData = exams.find(e => e.id === examId);
        const rawDesc = updates.description !== undefined ? updates.description : (currentExamData?.description || "");
        // Fetch raw DB description to preserve existing quiz_mode if set
        const { data: rawExamData } = await supabase.from('exams').select('description').eq('id', examId).maybeSingle();
        const rawStoredDesc = rawExamData?.description || "";
        const existingModeMatch = rawStoredDesc.match(/<!--QUIZ_MODE:(.+?)-->/);
        const existingMode = existingModeMatch ? existingModeMatch[1].trim() : null;

        const existingSettingsMatch = rawStoredDesc.match(/<!--QUIZ_SETTINGS:([\s\S]+?)-->/);
        let existingSettings: QuizSettings | null = null;
        if (existingSettingsMatch) {
          try {
            existingSettings = JSON.parse(existingSettingsMatch[1].trim());
          } catch (e) {}
        }

        dbUpdates.description = serializeExamDescription(rawDesc || "", untilVal || null, existingMode, existingSettings);
      }

      delete dbUpdates.available_from;
      delete dbUpdates.available_until;
      // champs calculés côté client (pas des colonnes)
      delete dbUpdates.quiz_mode;
      delete dbUpdates.quiz_settings;

      const { data, error } = await supabase
        .from('exams')
        .update(dbUpdates)
        .eq('id', examId)
        .select();

      if (error) {
        console.error("Supabase update exam error:", error);
        toastFail("Échec de la mise à jour de l'évaluation", "فشل تحديث التقييم", "Failed to update exam", error);
        return false;
      }

      const row = data && data[0] ? data[0] : null;
      setExams(prev => prev.map(e => {
        if (e.id !== examId) return e;
        if (row) return parseExamAvailability(row);
        return parseExamAvailability({ ...e, ...dbUpdates, description: dbUpdates.description !== undefined ? dbUpdates.description : e.description, available_until: updates.available_until !== undefined ? updates.available_until : e.available_until });
      }));
      toast.success(trc("Évaluation mise à jour avec succès", "تم تحديث التقييم بنجاح", "Exam updated successfully"));

      // Notify enrolled and room students about modification
      const exam = exams.find(e => e.id === examId);
      const targetCourseId = updates.course_id || exam?.course_id;
      const parentCourse = courses.find(c => c.id === targetCourseId);
      const examTitle = updates.title || exam?.title || 'Évaluation';

      setTimeout(async () => {
        await notifyStudentsAboutUpdate({
          courseId: targetCourseId,
          examId,
          roomId: parentCourse?.room_id,
          title: examTitle,
          examDate: updates.exam_date || exam?.exam_date,
          itemType: (updates.type || exam?.type) === 'quiz' ? 'quiz' : 'exam',
          action: 'update'
        });
      }, 500);

      return true;
    } catch (error) {
      console.error("updateExam error:", error);
      toastFail("Échec de la mise à jour de l'évaluation", "فشل تحديث التقييم", "Failed to update exam");
      return false;
    }
  };

  const deleteExam = async (examId: string): Promise<boolean> => {
    {
      const t = (exams.find(e => e.id === examId) as any)?.type;
      if (!accessStore.guard(t === "exam" ? "exam.edit" : "quiz.edit")) return false;
    }
    try {
      const examToDelete = exams.find(e => e.id === examId);
      const parentCourse = examToDelete ? courses.find(c => c.id === examToDelete.course_id) : null;

      const { error } = await supabase
        .from('exams')
        .delete()
        .eq('id', examId);

      if (error) {
        toastFail("Échec de la suppression de l'évaluation", "فشل حذف التقييم", "Failed to delete exam", error);
        return false;
      }

      setExams(prev => prev.filter(e => e.id !== examId));
      setQuizQuestions(prev => prev.filter(q => q.exam_id !== examId));
      setQuizSubmissions(prev => prev.filter(s => s.exam_id !== examId));

      // Notify students about exam deletion
      if (examToDelete) {
        setTimeout(async () => {
          await notifyStudentsAboutUpdate({
            courseId: examToDelete.course_id,
            examId,
            roomId: parentCourse?.room_id,
            title: examToDelete.title,
            itemType: examToDelete.type === 'quiz' ? 'quiz' : 'exam',
            action: 'delete'
          });
        }, 500);
      }

      toast.success(trc("Évaluation supprimée avec succès", "تم حذف التقييم بنجاح", "Exam deleted successfully"));
      return true;
    } catch (error) {
      toastFail("Échec de la suppression de l'évaluation", "فشل حذف التقييم", "Failed to delete exam");
      return false;
    }
  };

  const toggleExamVisibility = async (examId: string): Promise<boolean> => {
    if (!accessStore.guard("quiz.publish")) return false;
    const exam = exams.find(e => e.id === examId);
    if (!exam) return false;

    return await updateExam(examId, { is_visible: !exam.is_visible });
  };

  const uploadExamPdf = async (examId: string, file: File, courseId?: string): Promise<string | null> => {
    try {
      let targetCourseId = courseId;
      if (!targetCourseId) {
        const ex = exams.find(e => e.id === examId);
        targetCourseId = ex?.course_id;
      }
      if (!targetCourseId) {
        const { data: exData } = await supabase.from('exams').select('course_id').eq('id', examId).single();
        targetCourseId = exData?.course_id;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `exam_${examId}_${Date.now()}.${fileExt}`;
      const filePath = targetCourseId ? `courses/${targetCourseId}/${fileName}` : fileName;

      const { error: uploadError } = await supabase.storage
        .from('course-materials')
        .upload(filePath, file, { upsert: true, contentType: file.type || undefined, cacheControl: STORAGE_CACHE_CONTROL });

      if (uploadError) {
        console.error("Exam PDF upload error:", uploadError);
        toastFail("Échec de l'envoi du PDF", "فشل رفع ملف PDF", "Failed to upload PDF", uploadError);
        return null;
      }

      const { data } = supabase.storage
        .from('course-materials')
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;

      // Update exam with PDF URL
      const { error: updError } = await supabase
        .from('exams')
        .update({ pdf_url: publicUrl })
        .eq('id', examId);
      if (updError) {
        toastFail("Échec de l'envoi du PDF", "فشل رفع ملف PDF", "Failed to upload PDF", updError);
        return null;
      }

      setExams(prev => prev.map(e => (e.id === examId ? { ...e, pdf_url: publicUrl } : e)));
      toast.success(trc("PDF envoyé avec succès", "تم رفع ملف PDF بنجاح", "PDF uploaded successfully"));
      return publicUrl;
    } catch (error) {
      toastFail("Échec de l'envoi du PDF", "فشل رفع ملف PDF", "Failed to upload PDF");
      return null;
    }
  };

  // Enrollment operations
  const enrollStudent = async (courseId: string, studentId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .insert([{
          course_id: courseId,
          student_id: studentId
        }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          toast.error(trc("L'élève est déjà inscrit à ce cours", "التلميذ مسجل بالفعل في هذا الدرس", "Student is already enrolled in this course"));
        } else {
          toastFail("Échec de l'inscription de l'élève", "فشل تسجيل التلميذ", "Failed to enroll student", error);
        }
        return false;
      }

      setEnrollments(prev => [...prev, data as Enrollment]);
      toast.success(trc("Élève inscrit avec succès", "تم تسجيل التلميذ بنجاح", "Student enrolled successfully"));
      return true;
    } catch (error) {
      toastFail("Échec de l'inscription de l'élève", "فشل تسجيل التلميذ", "Failed to enroll student");
      return false;
    }
  };

  const unenrollStudent = async (courseId: string, studentId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('enrollments')
        .delete()
        .eq('course_id', courseId)
        .eq('student_id', studentId);

      if (error) {
        toastFail("Échec de la désinscription de l'élève", "فشل إلغاء تسجيل التلميذ", "Failed to unenroll student", error);
        return false;
      }

      setEnrollments(prev => prev.filter(enr =>
        !(enr.course_id === courseId && enr.student_id === studentId)
      ));
      toast.success(trc("Élève désinscrit avec succès", "تم إلغاء تسجيل التلميذ بنجاح", "Student unenrolled successfully"));
      return true;
    } catch (error) {
      toastFail("Échec de la désinscription de l'élève", "فشل إلغاء تسجيل التلميذ", "Failed to unenroll student");
      return false;
    }
  };

  const getEnrolledStudents = async (courseId: string): Promise<UserProfile[]> => {
    try {
      // Get enrollments for this course
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('course_id', courseId);

      if (enrollmentError) {
        console.error('Failed to fetch enrollments:', enrollmentError);
        return [];
      }

      if (!enrollmentData || enrollmentData.length === 0) {
        return [];
      }

      const studentIds = enrollmentData.map(e => e.student_id);

      // Get profiles for these students
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, email, role, avatar_url')
        .in('id', studentIds);

      if (profileError) {
        console.error('Failed to fetch student profiles:', profileError);
        return [];
      }

      return (profileData || []).map(profile => ({
        id: profile.id,
        name: profile.name,
        email: profile.email || '',
        role: profile.role as UserRole,
        avatar_url: profile.avatar_url
      }));
    } catch (error) {
      console.error('Failed to fetch enrolled students:', error);
      return [];
    }
  };

  const removeEnrollment = async (enrollmentId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('enrollments')
        .delete()
        .eq('id', enrollmentId);

      if (error) {
        toastFail("Échec du retrait de l'inscription", "فشل إزالة التسجيل", "Failed to remove enrollment", error);
        return false;
      }

      setEnrollments(prev => prev.filter(enr => enr.id !== enrollmentId));
      toast.success(trc("Élève retiré du cours avec succès", "تمت إزالة التلميذ من الدرس بنجاح", "Student removed from course successfully"));
      return true;
    } catch (error) {
      toastFail("Échec du retrait de l'inscription", "فشل إزالة التسجيل", "Failed to remove enrollment");
      return false;
    }
  };

  const getStudentCourses = (studentId: string): Course[] => {
    const enrolledCourseIds = new Set(enrollments
      .filter(enr => enr.student_id === studentId)
      .map(enr => enr.course_id));

    return courses.filter(course => enrolledCourseIds.has(course.id));
  };

  const getVisibleCoursesForStudent = (studentId: string): Course[] => {
    // Get the student's room_id from user context if this is the current user
    const studentRoomId = user?.id === studentId ? user?.room_id : null;

    // If we have the student's room, show all visible courses in that room
    if (studentRoomId) {
      return courses.filter(course =>
        course.is_visible && course.room_id === studentRoomId
      );
    }

    // Fallback to enrollment-based filtering for other students (e.g., professor viewing)
    const enrolledCourseIds = new Set(enrollments
      .filter(enr => enr.student_id === studentId)
      .map(enr => enr.course_id));

    return courses.filter(course =>
      course.is_visible && enrolledCourseIds.has(course.id)
    );
  };

  /** Cours accessibles à l'élève (classe + inscriptions), sans les cours masqués */
  const accessibleCourseIdsFor = (studentId: string): Set<string> => {
    const studentRoomId = user?.id === studentId ? user?.room_id : null;
    const ids = new Set<string>();
    if (studentRoomId) {
      courses.forEach(c => { if (c.room_id === studentRoomId) ids.add(c.id); });
    }
    enrollments.forEach(enr => { if (enr.student_id === studentId) ids.add(enr.course_id); });
    // un cours connu et masqué rend ses exercices / évaluations invisibles
    courses.forEach(c => { if (c.is_visible === false) ids.delete(c.id); });
    return ids;
  };

  const getVisibleExercisesForStudent = (studentId: string): Exercise[] => {
    const accessibleCourseIds = accessibleCourseIdsFor(studentId);
    if (accessibleCourseIds.size === 0) return [];
    return exercises.filter(exercise => exercise.is_visible && accessibleCourseIds.has(exercise.course_id));
  };

  const getVisibleExamsForStudent = (studentId: string): Exam[] => {
    const accessibleCourseIds = accessibleCourseIdsFor(studentId);
    if (accessibleCourseIds.size === 0) return [];

    // Un quiz encore vide (aucune question) n'est pas montré aux élèves
    const examsWithQuestions = new Set(quizQuestions.map(q => q.exam_id));
    const examsWithMySubmission = new Set(quizSubmissions.filter(sub => sub.student_id === studentId).map(sub => sub.exam_id));
    return exams.filter(exam =>
      exam.is_visible && accessibleCourseIds.has(exam.course_id)
      && (exam.type !== 'quiz' || examsWithQuestions.has(exam.id) || examsWithMySubmission.has(exam.id))
    );
  };

  // Quiz operations
  const addQuizQuestion = async (question: Omit<QuizQuestion, "id" | "created_at" | "updated_at">): Promise<QuizQuestion | null> => {
    try {
      const { data, error } = await supabase
        .from('quiz_questions')
        .insert([question])
        .select()
        .single();

      if (error) {
        toastFail("Échec de l'ajout de la question", "فشل إضافة السؤال", "Failed to add question", error);
        return null;
      }

      setQuizQuestions(prev => [...prev, data as QuizQuestion]);
      toast.success(trc("Question ajoutée avec succès", "تمت إضافة السؤال بنجاح", "Question added successfully"));
      return data as QuizQuestion;
    } catch (error) {
      toastFail("Échec de l'ajout de la question", "فشل إضافة السؤال", "Failed to add question");
      return null;
    }
  };

  const addQuizOption = async (option: Omit<QuizOption, "id" | "created_at">): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('quiz_options')
        .insert([option]);

      if (error) {
        toastFail("Échec de l'ajout de l'option", "فشل إضافة الخيار", "Failed to add option", error);
        return false;
      }
      return true;
    } catch (error) {
      toastFail("Échec de l'ajout de l'option", "فشل إضافة الخيار", "Failed to add option");
      return false;
    }
  };

  const updateQuizQuestion = async (questionId: string, updates: Partial<QuizQuestion>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('quiz_questions')
        .update(updates)
        .eq('id', questionId);

      if (error) {
        toastFail("Échec de la mise à jour de la question", "فشل تحديث السؤال", "Failed to update question", error);
        return false;
      }

      setQuizQuestions(prev => prev.map(q => q.id === questionId ? { ...q, ...updates } : q));
      toast.success(trc("Question mise à jour avec succès", "تم تحديث السؤال بنجاح", "Question updated successfully"));
      return true;
    } catch (error) {
      toastFail("Échec de la mise à jour de la question", "فشل تحديث السؤال", "Failed to update question");
      return false;
    }
  };

  const deleteQuizQuestion = async (questionId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('quiz_questions')
        .delete()
        .eq('id', questionId);

      if (error) {
        toastFail("Échec de la suppression de la question", "فشل حذف السؤال", "Failed to delete question", error);
        return false;
      }

      setQuizQuestions(prev => prev.filter(q => q.id !== questionId));
      toast.success(trc("Question supprimée avec succès", "تم حذف السؤال بنجاح", "Question deleted successfully"));
      return true;
    } catch (error) {
      toastFail("Échec de la suppression de la question", "فشل حذف السؤال", "Failed to delete question");
      return false;
    }
  };

  const getQuizQuestions = (examId: string): QuizQuestion[] => {
    return quizQuestions.filter(q => q.exam_id === examId).sort((a, b) => a.question_order - b.question_order);
  };

  /** @deprecated les options ne sont plus chargées globalement (lire quiz_options à la demande) */
  const getQuizOptions = (_questionId: string): QuizOption[] => EMPTY_OPTIONS;

  const submitQuiz = async (submission: Omit<QuizSubmission, "id" | "submitted_at">, answers: Omit<QuizAnswer, "id" | "submission_id" | "created_at">[]): Promise<boolean> => {
    try {
      // Insert submission
      let { data: submissionData, error: submissionError } = await supabase
        .from('quiz_submissions')
        .insert([submission as any])
        .select()
        .single();

      // Colonnes anti-triche absentes (migration pas encore appliquée) : on réessaie sans
      if (submissionError && /anti_cheat/i.test(`${submissionError.message || ""} ${(submissionError as any).details || ""}`)) {
        const { anti_cheat_events, anti_cheat_log, ...plain } = submission as any;
        ({ data: submissionData, error: submissionError } = await supabase
          .from('quiz_submissions')
          .insert([plain])
          .select()
          .single());
      }

      if (submissionError || !submissionData) {
        console.error("Supabase insert quiz_submissions error:", submissionError);
        toastFail("Échec de l'envoi du quiz", "فشل إرسال الاختبار", "Failed to submit quiz", submissionError);
        return false;
      }

      // Insert answers (sanitize selected_option_id to ensure valid UUIDs)
      const answersWithSubmissionId = answers.map(answer => {
        const payload: any = {
          submission_id: submissionData.id,
          question_id: answer.question_id,
          is_correct: !!answer.is_correct,
          points_earned: answer.points_earned || 0
        };

        if (answer.selected_option_id && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(answer.selected_option_id)) {
          payload.selected_option_id = answer.selected_option_id;
        }

        if (answer.text_answer) {
          payload.text_answer = answer.text_answer;
        }

        return payload;
      });

      if (answersWithSubmissionId.length > 0) {
        const { error: answersError } = await supabase
          .from('quiz_answers')
          .insert(answersWithSubmissionId);

        if (answersError) {
          console.error("Supabase insert quiz_answers error:", answersError);
          toastFail("Échec de l'enregistrement des réponses", "فشل حفظ الإجابات", "Failed to save answers", answersError);
          // Annule la copie incomplète : un nouvel essai d'envoi ne créera pas de doublon
          try { await supabase.from('quiz_submissions').delete().eq('id', submissionData.id); } catch { /* ignore */ }
          return false;
        }
      }

      // Mise à jour locale (les réponses détaillées ne sont pas gardées en mémoire)
      const saved = submissionData as QuizSubmission;
      setQuizSubmissions(prev => [saved, ...prev.filter(s => s.id !== saved.id)]);

      return true;
    } catch (error) {
      console.error("submitQuiz error:", error);
      toastFail("Échec de l'envoi du quiz", "فشل إرسال الاختبار", "Failed to submit quiz");
      return false;
    }
  };

  const getQuizSubmissions = (examId: string): QuizSubmission[] => {
    return quizSubmissions.filter(sub => sub.exam_id === examId);
  };

  const getStudentQuizSubmission = (examId: string, studentId: string): QuizSubmission | null => {
    return quizSubmissions.find(sub => sub.exam_id === examId && sub.student_id === studentId) || null;
  };

  const notifyStudentsAboutUpdate = async (params: {
    courseId?: string | null;
    roomId?: string | null;
    exerciseId?: string | null;
    examId?: string | null;
    title: string;
    courseTitle?: string;
    itemType: 'course' | 'exercise' | 'exam' | 'quiz';
    action: 'add' | 'delete' | 'update';
    examDate?: string;
  }) => {
    // Notifications aux élèves : seulement si l'offre l'inclut (sans message d'erreur)
    if (!accessStore.can("notify.send")) return;
    try {
      const {
        courseId,
        roomId,
        exerciseId,
        examId,
        title,
        courseTitle,
        itemType,
        action,
        examDate
      } = params;

      const studentIdsSet = new Set<string>();

      // 1. If roomId provided, get all students in this room
      if (roomId) {
        const { data: roomStudents } = await supabase
          .from('profiles')
          .select('id')
          .eq('room_id', roomId)
          .eq('role', 'student');

        (roomStudents || []).forEach(s => studentIdsSet.add(s.id));
      }

      // 2. If courseId provided, get all enrolled students
      if (courseId) {
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('student_id')
          .eq('course_id', courseId);

        (enrollments || []).forEach(e => studentIdsSet.add(e.student_id));
      }

      if (studentIdsSet.size === 0) {
        return;
      }

      // 3. Format title, message, and type
      let notifType: string;
      let notifTitle: string;
      let notifMessage: string;

      if (action === 'add') {
        if (itemType === 'course') {
          notifType = 'course_added';
          notifTitle = `📚 Nouveau cours disponible`;
          notifMessage = `Le cours "${title}" a été publié pour votre classe.`;
        } else if (itemType === 'exercise') {
          notifType = 'exercise_added';
          notifTitle = `📝 Nouvel exercice disponible`;
          notifMessage = courseTitle
            ? `L'exercice "${title}" a été ajouté dans le cours "${courseTitle}".`
            : `L'exercice "${title}" a été ajouté à vos devoirs.`;
        } else if (itemType === 'quiz') {
          notifType = 'exam_added';
          notifTitle = `🎯 Nouveau Quiz programmé`;
          notifMessage = examDate
            ? `Le quiz "${title}" est disponible. Date limite : ${new Date(examDate).toLocaleDateString()}.`
            : `Le quiz "${title}" est maintenant disponible.`;
        } else {
          notifType = 'exam_added';
          notifTitle = `🎓 Nouvel examen programmé`;
          notifMessage = examDate
            ? `L'examen "${title}" est programmé pour le ${new Date(examDate).toLocaleDateString()}.`
            : `L'examen "${title}" a été ajouté.`;
        }
      } else if (action === 'update') {
        if (itemType === 'course') {
          notifType = 'course_updated';
          notifTitle = `🔄 Cours mis à jour`;
          notifMessage = `Le contenu du cours "${title}" a été modifié. Veuillez le consulter.`;
        } else if (itemType === 'exercise') {
          notifType = 'exercise_updated';
          notifTitle = `🔄 Exercice mis à jour`;
          notifMessage = `L'exercice "${title}" a été modifié. Veuillez le consulter.`;
        } else {
          notifType = 'exam_updated';
          notifTitle = `🔄 Évaluation mise à jour`;
          notifMessage = `L'évaluation "${title}" a été modifiée. Veuillez vérifier les détails.`;
        }
      } else {
        if (itemType === 'course') {
          notifType = 'course_deleted';
          notifTitle = `🗑️ Cours retiré`;
          notifMessage = `Le cours "${title}" a été retiré par votre professeur.`;
        } else if (itemType === 'exercise') {
          notifType = 'exercise_deleted';
          notifTitle = `🗑️ Exercice retiré`;
          notifMessage = `L'exercice "${title}" a été supprimé.`;
        } else {
          notifType = 'exam_deleted';
          notifTitle = `🗑️ Évaluation retirée`;
          notifMessage = `L'évaluation "${title}" a été supprimée/annulée.`;
        }
      }

      const nowIso = new Date().toISOString();
      const insertRows = Array.from(studentIdsSet).map(studentId => ({
        user_id: studentId,
        title: notifTitle,
        message: notifMessage,
        type: notifType,
        read: false,
        course_id: courseId || null,
        exercise_id: exerciseId || null,
        exam_id: examId || null,
        created_at: nowIso,
        updated_at: nowIso
      }));

      await supabase.from('notifications').insert(insertRows);
    } catch (error) {
      console.error('Failed to notify students:', error);
    }
  };

  const addCourse = (course: Omit<Course, "id" | "created_at" | "updated_at" | "professor_id">) =>
    dedupeCreation(`course:${JSON.stringify(course)}`, () => addCourseImpl(course));
  const addExercise = (exercise: Omit<Exercise, "id" | "created_at" | "updated_at">) =>
    dedupeCreation(`exercise:${JSON.stringify(exercise)}`, () => addExerciseImpl(exercise));
  const addExam = (exam: Omit<Exam, "id" | "created_at" | "updated_at">) =>
    dedupeCreation(`exam:${JSON.stringify(exam)}`, () => addExamImpl(exam));

  // Valeur du contexte recalculée seulement quand les données ou le compte changent :
  // les fonctions recréées entre-temps sont équivalentes (mêmes données capturées).
  const value = useMemo<CourseContextType>(() => ({
    rooms,
    courses,
    exercises,
    exams,
    enrollments,
    quizQuestions,
    quizOptions: EMPTY_OPTIONS,
    quizSubmissions,
    quizAnswers: EMPTY_ANSWERS,
    loading,
    addRoom,
    updateRoom,
    deleteRoom,
    toggleRoomVisibility,
    addCourse,
    updateCourse,
    deleteCourse,
    toggleCourseVisibility,
    uploadCoursePdf,
    addExercise,
    updateExercise,
    deleteExercise,
    toggleExerciseVisibility,
    uploadExercisePdf,
    exerciseMaterials,
    getExerciseMaterials,
    loadExerciseMaterials,
    uploadExerciseMaterials,
    uploadExerciseMaterial,
    addExerciseVideoLink,
    deleteExerciseMaterial,
    addExam,
    updateExam,
    deleteExam,
    toggleExamVisibility,
    uploadExamPdf,
    addQuizQuestion,
    addQuizOption,
    updateQuizQuestion,
    deleteQuizQuestion,
    getQuizQuestions,
    getQuizOptions,
    submitQuiz,
    getQuizSubmissions,
    getStudentQuizSubmission,
    enrollStudent,
    unenrollStudent,
    removeEnrollment,
    getEnrolledStudents,
    getStudentCourses,
    getVisibleCoursesForStudent,
    getVisibleExercisesForStudent,
    getVisibleExamsForStudent,
    refreshData
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [rooms, courses, exercises, exams, enrollments, quizQuestions, quizSubmissions, exerciseMaterials, loading, user, refreshData, loadExerciseMaterials]);

  return (
    <CourseContext.Provider value={value}>
      {children}
    </CourseContext.Provider>
  );
}

export function useCourses() {
  const context = useContext(CourseContext);
  if (context === undefined) {
    throw new Error("useCourses must be used within a CourseProvider");
  }
  return context;
}

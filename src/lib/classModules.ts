/**
 * Habilitations des élèves par classe : le professeur choisit, pour chacune de ses classes,
 * les modules que ses élèves voient dans leur barre latérale (colonne rooms.student_modules).
 *
 * Valeur stockée : { "<module>": false } pour un module coupé. Clé absente = module ouvert
 * (les classes existantes et la base sans migration restent donc inchangées).
 * Ces réglages s'ajoutent aux modules de l'administration (Personnalisation → Modules) et à
 * l'offre du professeur : un module coupé plus haut reste coupé quoi qu'il arrive.
 */
import { useCallback } from "react";
import {
  BookOpen,
  BookOpenCheck,
  Boxes,
  CalendarDays,
  ClipboardCheck,
  FileText,
  FolderOpen,
  House,
  MessageCircle,
  PenLine,
  TrendingUp,
  Video,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses, type Room } from "@/contexts/CourseContext";
import type { FeatureKey } from "@/lib/appSettings";

export type ClassModuleKey =
  | "chat"
  | "courses"
  | "exercises"
  | "exams"
  | "homework"
  | "examples"
  | "meet"
  | "whiteboard"
  | "lessonLog"
  | "calendar"
  | "progress"
  | "lab3d";

export interface ClassModuleDef {
  key: ClassModuleKey;
  /** module de l'administration correspondant (absent : toujours proposé) */
  feature?: FeatureKey;
  icon: LucideIcon;
  label: [fr: string, ar: string, en: string];
  hint: [fr: string, ar: string, en: string];
}

/** Dans l'ordre de la barre latérale */
export const CLASS_MODULES: ClassModuleDef[] = [
  {
    key: "chat", feature: "chat", icon: MessageCircle,
    label: ["Messages", "الرسائل", "Messages"],
    hint: ["Discuter avec vous, appels vocaux et vidéo", "المراسلة معك والمكالمات الصوتية والمرئية", "Chat with you, voice and video calls"],
  },
  {
    key: "courses", feature: "courses", icon: BookOpen,
    label: ["Cours", "الدروس", "Courses"],
    hint: ["Liste des cours et leurs documents", "لائحة الدروس ووثائقها", "Course list and documents"],
  },
  {
    key: "exercises", feature: "exercises", icon: FileText,
    label: ["Exercices", "التمارين", "Exercises"],
    hint: ["Exercices et devoirs à rendre", "التمارين والواجبات", "Exercises and homework"],
  },
  {
    key: "exams", feature: "exams", icon: ClipboardCheck,
    label: ["Exams programmés", "الامتحانات المبرمجة", "Scheduled exams"],
    hint: ["Exams et quiz programmés à passer en ligne", "الامتحانات والاختبارات المبرمجة عبر الإنترنت", "Scheduled exams and quizzes taken online"],
  },
  {
    key: "homework", feature: "homework", icon: House,
    label: ["Exams › Devoirs maison", "الامتحانات › الفروض المنزلية", "Exams › Homework"],
    hint: ["Sujets de devoirs maison et leurs corrigés", "مواضيع الفروض المنزلية وتصحيحاتها", "Homework sheets and their corrections"],
  },
  {
    key: "examples", feature: "homework", icon: FolderOpen,
    label: ["Exams › Exemples devoirs", "الامتحانات › نماذج الفروض", "Exams › Sample exams"],
    hint: ["Exemples d'examens et examens corrigés à télécharger", "نماذج امتحانات وامتحانات مصححة للتحميل", "Sample and corrected exams to download"],
  },
  {
    key: "meet", feature: "meet", icon: Video,
    label: ["Réunions", "الاجتماعات", "Meetings"],
    hint: ["Rejoindre les réunions vidéo de la classe", "الانضمام إلى اجتماعات القسم", "Join the class video meetings"],
  },
  {
    key: "whiteboard", icon: PenLine,
    label: ["Tableau blanc", "السبورة البيضاء", "Whiteboard"],
    hint: ["Voir et modifier les tableaux partagés", "عرض وتعديل السبورات المشتركة", "View and edit shared boards"],
  },
  {
    key: "lessonLog", feature: "lessonLog", icon: BookOpenCheck,
    label: ["Cahier de textes", "دفتر النصوص", "Lesson log"],
    hint: ["Séances et devoirs notés", "الحصص والواجبات المسجلة", "Sessions and homework"],
  },
  {
    key: "calendar", feature: "calendar", icon: CalendarDays,
    label: ["Calendrier", "اليومية", "Calendar"],
    hint: ["Échéances des exercices, quiz et examens", "آجال التمارين والاختبارات والامتحانات", "Due dates"],
  },
  {
    key: "progress", feature: "progress", icon: TrendingUp,
    label: ["Ma progression", "تقدمي", "My progress"],
    hint: ["Notes, badges et points à retravailler", "النقط والشارات ونقط المراجعة", "Grades, badges and review"],
  },
  {
    key: "lab3d", feature: "lab3d", icon: Boxes,
    label: ["Labo 3D · AR / VR", "المختبر ثلاثي الأبعاد", "3D Lab · AR / VR"],
    hint: ["Scènes 3D, réalité augmentée et virtuelle", "مشاهد ثلاثية الأبعاد والواقع المعزز", "3D scenes, AR and VR"],
  },
];

const KEYS = new Set<string>(CLASS_MODULES.map((m) => m.key));
export const isClassModule = (k: string): k is ClassModuleKey => KEYS.has(k);

export type StudentModules = Partial<Record<ClassModuleKey, boolean>>;

/** Module ouvert aux élèves de cette classe ? (absent = ouvert) */
export const roomModuleOn = (room: Pick<Room, "student_modules"> | null | undefined, key: ClassModuleKey) =>
  !room || !room.student_modules || (room.student_modules as StudentModules)[key] !== false;

/** Classes d'un élève : classe d'affectation + inscriptions */
export function studentRoomIds(user: { id: string; room_id?: string | null } | null | undefined, enrollments: { student_id: string; room_id?: string | null }[]) {
  if (!user) return [] as string[];
  const ids = new Set<string>();
  if (user.room_id) ids.add(user.room_id);
  for (const e of enrollments) if (e.student_id === user.id && e.room_id) ids.add(e.room_id);
  return [...ids];
}

/**
 * Pour l'utilisateur connecté : le module est-il ouvert par le professeur ?
 * Toujours vrai pour un professeur ou un administrateur. Pour un élève : vrai si au moins
 * une de ses classes l'ouvre (ou s'il n'a encore aucune classe chargée).
 */
export function useClassModule() {
  const { user } = useAuth();
  const { rooms, enrollments } = useCourses();
  return useCallback(
    (key: ClassModuleKey | string) => {
      if (!user || user.role !== "student" || !isClassModule(key)) return true;
      const ids = studentRoomIds(user, enrollments);
      const mine = rooms.filter((r) => ids.includes(r.id));
      if (mine.length === 0) return true;
      return mine.some((r) => roomModuleOn(r, key));
    },
    [user, rooms, enrollments]
  );
}

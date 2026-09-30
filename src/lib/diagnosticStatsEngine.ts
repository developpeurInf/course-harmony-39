/**
 * Moteur de calcul statistique conforme aux directives du Ministère marocain
 * pour les rapports d'évaluation diagnostique.
 */

export interface DiagnosticStudent {
  id: string | number;
  num: number;
  massar: string;
  name: string;
  note: number | string | null;
}

export interface DiagnosticClass {
  id: string;
  nom: string;
  date: string;
  students: DiagnosticStudent[];
}

export interface ClassStats {
  nom: string;
  total_students: number;
  present_count: number;
  absent_count: number;
  average_note: number;
  t1_count: number; // ] 8 – 0 ]
  t2_count: number; // ] 12 – 8 ]
  t3_count: number; // ] 14 – 12 ]
  t4_count: number; // ] 20 – 14 ]
  t1_pct: number;
  t2_pct: number;
  t3_pct: number;
  t4_pct: number;
  is_empty_or_absent: boolean;
}

export interface ClassPlanEntry {
  nom: string;
  date: string;
  nb_presents_texte: string;
}

export interface GlobalDiagnosticStats {
  classes_stats: ClassStats[];
  classes_plan: ClassPlanEntry[];
  total_presents: string;
  default_appreciation: string;
  pct_struggling: number;
}

export function parseNoteValue(note: unknown): number | null {
  if (note === null || note === undefined || note === "") return null;
  const str = String(note).trim().toUpperCase();
  if (str === "ABS") return null;
  const num = parseFloat(str.replace(",", "."));
  if (isNaN(num) || num < 0 || num > 20) return null;
  return Math.round(num * 100) / 100;
}

export function isStudentAbsent(note: unknown): boolean {
  if (note === null || note === undefined || note === "") return true;
  const str = String(note).trim().toUpperCase();
  if (str === "ABS") return true;
  const num = parseFloat(str.replace(",", "."));
  return isNaN(num) || num < 0 || num > 20;
}

/**
 * Calcule les effectifs et pourcentages pour une classe selon les 4 tranches officielles :
 * - المتعثرون ] 8 – 0 ]
 * - المسايرون ] 12 – 8 ]
 * - المتفوقون ] 14 – 12 ]
 * - المتميزون ] 20 – 14 ]
 */
export function calculateClassStats(classData: DiagnosticClass): ClassStats {
  const students = classData.students || [];

  let t1_count = 0; // 0 à 8
  let t2_count = 0; // >8 à 12
  let t3_count = 0; // >12 à 14
  let t4_count = 0; // >14 à 20
  let absent_count = 0;
  let present_count = 0;

  const valid_notes: number[] = [];

  for (const s of students) {
    const val = parseNoteValue(s.note);
    if (val !== null) {
      valid_notes.push(val);
      present_count++;
      if (val <= 8.0) {
        t1_count++;
      } else if (val <= 12.0) {
        t2_count++;
      } else if (val <= 14.0) {
        t3_count++;
      } else {
        t4_count++;
      }
    } else {
      absent_count++;
    }
  }

  let t1_pct = 0;
  let t2_pct = 0;
  let t3_pct = 0;
  let t4_pct = 0;

  if (present_count > 0) {
    t1_pct = Math.round((t1_count / present_count) * 100);
    t2_pct = Math.round((t2_count / present_count) * 100);
    t3_pct = Math.round((t3_count / present_count) * 100);
    t4_pct = Math.round((t4_count / present_count) * 100);

    // Ajustement d'arrondi pour faire exactement 100% sur la plus grande tranche
    const total_pct = t1_pct + t2_pct + t3_pct + t4_pct;
    if (total_pct !== 100 && (t1_count + t2_count + t3_count + t4_count) === present_count) {
      const diff = 100 - total_pct;
      const counts = [t1_count, t2_count, t3_count, t4_count];
      let maxIdx = 0;
      let maxVal = counts[0];
      for (let i = 1; i < 4; i++) {
        if (counts[i] > maxVal) {
          maxVal = counts[i];
          maxIdx = i;
        }
      }
      if (maxIdx === 0) t1_pct += diff;
      else if (maxIdx === 1) t2_pct += diff;
      else if (maxIdx === 2) t3_pct += diff;
      else if (maxIdx === 3) t4_pct += diff;
    }
  }

  const avg_note = valid_notes.length > 0
    ? Math.round((valid_notes.reduce((a, b) => a + b, 0) / valid_notes.length) * 100) / 100
    : 0.0;

  return {
    nom: classData.nom || "Classe",
    total_students: students.length,
    present_count,
    absent_count,
    average_note: avg_note,
    t1_count,
    t2_count,
    t3_count,
    t4_count,
    t1_pct,
    t2_pct,
    t3_pct,
    t4_pct,
    is_empty_or_absent: present_count === 0,
  };
}

/**
 * Calcule les statistiques globales pour l'ensemble des classes.
 */
export function computeAllStats(classesList: DiagnosticClass[]): GlobalDiagnosticStats {
  const classes_stats: ClassStats[] = [];
  const classes_plan: ClassPlanEntry[] = [];
  let total_presents = 0;

  for (const cls of classesList) {
    const stat = calculateClassStats(cls);
    classes_stats.push(stat);
    total_presents += stat.present_count;

    // Préparation du tableau de planification (Tableau 1)
    if (stat.present_count === 0) {
      classes_plan.push({
        nom: stat.nom,
        date: cls.date || "---------------------",
        nb_presents_texte: "Absence de groupe",
      });
    } else {
      classes_plan.push({
        nom: stat.nom,
        date: cls.date || "06-10-2026",
        nb_presents_texte: String(stat.present_count),
      });
    }
  }

  // Diagnostic global
  const total_t1 = classes_stats.reduce((acc, s) => acc + s.t1_count, 0);
  const pct_struggling = total_presents > 0
    ? Math.round((total_t1 / total_presents) * 1000) / 10
    : 0;

  let default_appreciation: string;
  if (pct_struggling >= 50) {
    default_appreciation = "médiocres";
  } else if (pct_struggling >= 30) {
    default_appreciation = "moyens avec des difficultés ciblées";
  } else {
    default_appreciation = "satisfaisants dans l'ensemble";
  }

  return {
    classes_stats,
    classes_plan,
    total_presents: total_presents > 0 ? String(total_presents) : "0",
    default_appreciation,
    pct_struggling,
  };
}

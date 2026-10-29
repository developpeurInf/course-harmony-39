/**
 * Analyse IA de l'évaluation diagnostique (fonction Edge teacher-ai, action « diagnostic »).
 * Seules des statistiques anonymes partent vers l'IA : effectifs, moyennes, répartition par
 * tranche et histogramme des notes par classe. Aucun nom ni numéro Massar.
 * Le résultat est enregistré par langue dans la configuration (config.analyse_ia) et reste
 * entièrement modifiable par le professeur.
 */
import { callTeacherAi } from "@/lib/teacherAi";
import { calculateClassStats, parseNoteValue, type DiagnosticClass } from "@/lib/diagnosticStatsEngine";
import type { DiagnosticConfig } from "@/lib/diagnosticStorage";
import type { DiagLang } from "@/lib/diagnosticTranslations";

export type Mastery = "acquired" | "partial" | "not_acquired";
export type BandKey = "t1" | "t2" | "t3" | "t4";

export interface DiagnosticAiAnalysis {
  appreciation: string;
  summary: string;
  observations: string[];
  propositions: string[];
  resources: { resource: string; mastery: Mastery; rate: number; difficulties: string; error_type: string; remediation: string }[];
  groups: { band: BandKey; needs: string; support_type: string; activities: string }[];
  plan: { period: string; content: string; target: string; activities: string; indicators: string }[];
  /** ISO, ajouté par l'appli */
  generated_at?: string;
}

export const emptyAnalysis = (): DiagnosticAiAnalysis => ({
  appreciation: "",
  summary: "",
  observations: [],
  propositions: [],
  resources: [],
  groups: (["t1", "t2", "t3", "t4"] as BandKey[]).map((band) => ({ band, needs: "", support_type: "", activities: "" })),
  plan: [],
});

/** Statistiques anonymes envoyées à l'IA */
export function anonymousStats(classes: DiagnosticClass[]) {
  return classes.map((c) => {
    const s = calculateClassStats(c);
    const notes = (c.students || []).map((x) => parseNoteValue(x.note)).filter((v): v is number => v !== null);
    const hist = [0, 0, 0, 0, 0];
    notes.forEach((n) => hist[Math.min(4, Math.floor(n / 4))]++);
    return {
      class: c.nom,
      enrolled: s.total_students,
      present: s.present_count,
      absent: s.absent_count,
      average: s.average_note,
      min: notes.length ? Math.min(...notes) : null,
      max: notes.length ? Math.max(...notes) : null,
      above_10_pct: notes.length ? Math.round((notes.filter((n) => n >= 10).length / notes.length) * 100) : null,
      bands_count: { t1: s.t1_count, t2: s.t2_count, t3: s.t3_count, t4: s.t4_count },
      histogram_0_4_8_12_16_20: hist,
    };
  });
}

export interface DiagnosticAiRequest {
  config: DiagnosticConfig;
  classes: DiagnosticClass[];
  lang: DiagLang;
  exercises: { title: string; description: string; rate?: number | null }[];
  examId?: string;
  materialId?: string;
  notes?: string;
}

export async function generateDiagnosticAnalysis(req: DiagnosticAiRequest): Promise<DiagnosticAiAnalysis> {
  const r = await callTeacherAi<{ analysis: DiagnosticAiAnalysis }>({
    action: "diagnostic",
    // L'IA rédige en arabe ou en français ; le rapport anglais reçoit le texte français
    language: req.lang === "ar" ? "ar" : "fr",
    subject: req.config.matiere,
    level: req.config.niveau || req.config.niveau_titre,
    stats: anonymousStats(req.classes),
    exercises: req.exercises,
    exam_id: req.examId || undefined,
    material_id: req.materialId || undefined,
    text: req.notes || undefined,
  });
  const a = r.analysis;
  // Toujours 4 groupes dans l'ordre t1..t4
  const groups = (["t1", "t2", "t3", "t4"] as BandKey[]).map(
    (band) => a.groups.find((g) => g.band === band) || { band, needs: "", support_type: "", activities: "" },
  );
  return { ...a, groups, generated_at: new Date().toISOString() };
}

export const MASTERY_LABEL: Record<DiagLang, Record<Mastery, string>> = {
  ar: { acquired: "متحكم فيه", partial: "في طور التحكم", not_acquired: "غير متحكم فيه" },
  fr: { acquired: "Acquis", partial: "En cours d'acquisition", not_acquired: "Non acquis" },
  en: { acquired: "Mastered", partial: "Partly mastered", not_acquired: "Not mastered" },
};

export const BAND_LABEL: Record<DiagLang, Record<BandKey, string>> = {
  ar: { t1: "المتعثرون ]0 – 8]", t2: "المسايرون ]8 – 12]", t3: "المتفوقون ]12 – 14]", t4: "المتميزون ]14 – 20]" },
  fr: { t1: "En difficulté ]0 – 8]", t2: "Moyens ]8 – 12]", t3: "Bons ]12 – 14]", t4: "Excellents ]14 – 20]" },
  en: { t1: "Struggling ]0 – 8]", t2: "Keeping up ]8 – 12]", t3: "Good ]12 – 14]", t4: "Excellent ]14 – 20]" },
};

/** Tranche officielle d'une note (mêmes bornes que calculateClassStats) */
export function bandOf(note: number): BandKey {
  return note <= 8 ? "t1" : note <= 12 ? "t2" : note <= 14 ? "t3" : "t4";
}

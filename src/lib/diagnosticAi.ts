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
  /** Modèle 2 : introduction, remarque (absences), méthodes de soutien */
  intro?: string;
  remark?: string;
  support?: string;
  /** Composition du test (onglet 4), quand un test ou un document est fourni */
  exercises?: { title: string; description: string }[];
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

export type DiagPart = "summary" | "resources" | "groups" | "plan" | "report2" | "exercises";
export const DIAG_PARTS: DiagPart[] = ["summary", "resources", "groups", "plan"];

/** Parties utiles à chaque modèle de rapport (les mises en page ne changent pas) */
export function partsForTemplate(template: "t1" | "t2" | "t3" | "t4", hasSource: boolean): DiagPart[] {
  const ex: DiagPart[] = hasSource ? ["exercises"] : [];
  switch (template) {
    case "t1": return ["summary", ...ex];
    case "t2": return ["summary", "report2"];
    case "t3": return ["summary", "resources", "groups", "plan"];
    case "t4": return ["groups"];
  }
}

/**
 * Génère l'analyse en 4 demandes courtes et parallèles (une par partie) : chacune reste sous
 * la limite de durée des Edge Functions, et l'avancement réel est suivi partie par partie.
 * Les parties déjà présentes dans `previous` ne sont pas redemandées si `onlyMissing`.
 */
export async function generateDiagnosticAnalysis(
  req: DiagnosticAiRequest,
  onPart?: (part: DiagPart, status: "done" | "error", error?: string) => void,
  parts: DiagPart[] = DIAG_PARTS,
): Promise<{ analysis: Partial<DiagnosticAiAnalysis>; failed: { part: DiagPart; error: string }[] }> {
  const body = {
    action: "diagnostic",
    language: req.lang,
    context: { year: req.config.annee_scolaire, period: req.config.periode_diagnostic },
    subject: req.config.matiere,
    level: req.config.niveau || req.config.niveau_titre,
    stats: anonymousStats(req.classes),
    exercises: req.exercises,
    exam_id: req.examId || undefined,
    material_id: req.materialId || undefined,
    text: req.notes || undefined,
  };
  const analysis: Partial<DiagnosticAiAnalysis> = {};
  const failed: { part: DiagPart; error: string }[] = [];
  await Promise.all(parts.map(async (part) => {
    try {
      const r = await callTeacherAi<{ analysis: Partial<DiagnosticAiAnalysis> }>({ ...body, part });
      Object.assign(analysis, r.analysis);
      onPart?.(part, "done");
    } catch (e: any) {
      const error = String(e?.message || "AI_ERROR");
      failed.push({ part, error });
      onPart?.(part, "error", error);
    }
  }));
  if (analysis.groups) {
    // Toujours 4 groupes dans l'ordre t1..t4
    const g = analysis.groups;
    analysis.groups = (["t1", "t2", "t3", "t4"] as BandKey[]).map((band) => g.find((x) => x.band === band) || { band, needs: "", support_type: "", activities: "" });
  }
  return { analysis, failed };
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

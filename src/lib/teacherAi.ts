/**
 * Appels à la fonction Edge « teacher-ai » (Claude) : génération de quiz et fiches pédagogiques.
 */
import { supabase } from "@/integrations/supabase/client";
import { getMaterialKind, type CourseMaterialLike } from "@/lib/courseMedia";

export interface AiQuizQuestion {
  question: string;
  type: "multiple_choice" | "true_false" | "short_answer";
  points: number;
  options: { text: string; is_correct: boolean }[];
  explanation: string;
}

export interface LessonPlan {
  title: string;
  level: string;
  duration: string;
  competencies: string[];
  objectives: string[];
  prerequisites: string[];
  materials: string[];
  steps: { phase: string; duration: string; teacher: string; students: string; evaluation: string }[];
  assessment: string;
  homework: string;
  remediation: string;
}

type Tr = (fr: string, ar: string, en: string) => string;

/** Message lisible pour un code d'erreur renvoyé par la fonction */
export function aiErrorMessage(code: string, tr: Tr) {
  switch (code) {
    case "AI_NOT_CONFIGURED": return tr("L'IA n'est pas encore configurée (clé GEMINI_API_KEY ou ANTHROPIC_API_KEY, ou fonction teacher-ai manquante).", "الذكاء الاصطناعي غير مهيأ بعد.", "AI is not configured yet.");
    case "PERMISSION_DENIED": return tr("Cette fonction n'est pas incluse dans votre offre.", "هذه الميزة غير متضمنة في عرضك.", "This feature is not included in your plan.");
    case "DAILY_LIMIT": return tr("Limite quotidienne de générations atteinte. Réessayez demain.", "تم بلوغ الحد اليومي. أعد المحاولة غداً.", "Daily limit reached. Try again tomorrow.");
    case "MATERIAL_TOO_LARGE": return tr("Document trop lourd (20 Mo maximum).", "الوثيقة كبيرة جداً (20 م.ب كحد أقصى).", "Document too large (20 MB max).");
    case "NO_SOURCE": return tr("Choisissez un document du cours ou collez un texte.", "اختر وثيقة من الدرس أو ألصق نصاً.", "Pick a course document or paste some text.");
    case "REFUSED": return tr("L'IA n'a pas pu traiter ce contenu.", "تعذر على الذكاء الاصطناعي معالجة هذا المحتوى.", "The AI could not process this content.");
    case "AI_BUSY": return tr("L'IA est très sollicitée, réessayez dans une minute.", "الذكاء الاصطناعي مشغول، أعد المحاولة بعد دقيقة.", "The AI is busy, retry in a minute.");
    default: return tr("La génération a échoué. Réessayez.", "فشل التوليد. أعد المحاولة.", "Generation failed. Try again.");
  }
}

export async function callTeacherAi<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("teacher-ai", { body });
  if (error) {
    // Corps de l'erreur HTTP : { error: "CODE" }
    let code = "AI_ERROR";
    try {
      const ctx: any = (error as any).context;
      const j = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
      if (j?.error) code = j.error;
    } catch {
      /* corps illisible */
    }
    if (/Failed to send|not found|404/i.test(String(error.message)) && code === "AI_ERROR") code = "AI_NOT_CONFIGURED";
    throw new Error(code);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

/** Documents d'un cours utilisables par l'IA (PDF et images) */
export async function loadAiMaterials(courseIds: string[]) {
  if (!courseIds.length) return [] as (CourseMaterialLike & { course_id: string })[];
  const { data } = await supabase.from("course_materials").select("id, file_name, file_path, file_size, course_id").in("course_id", courseIds);
  return ((data || []) as any[]).filter((m) => ["pdf", "image"].includes(getMaterialKind(m))) as (CourseMaterialLike & { course_id: string })[];
}

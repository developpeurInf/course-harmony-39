// Supabase Edge Function : teacher-ai
// Outils IA pour les professeurs (Claude ou Gemini) :
//   action "quiz"        → questions de quiz (QCM, vrai/faux, réponse courte) à partir d'un cours
//   action "lesson_plan" → fiche pédagogique d'une séance (déroulement, activités, évaluation)
//   action "omr"         → lecture de la photo d'une feuille-réponse de QCM (cases cochées)
//
// Le contenu du cours vient d'un texte collé et/ou d'un document du cours (PDF ou image,
// table course_materials) lu côté serveur : le professeur doit être propriétaire du cours.
//
// Secrets Supabase : GEMINI_API_KEY ou ANTHROPIC_API_KEY (l'un des deux).
//   AI_PROVIDER (optionnel) : "gemini" ou "anthropic" ; par défaut gemini si GEMINI_API_KEY existe.
//   TEACHER_AI_MODEL (optionnel) : défaut gemini-2.5-flash (Gemini) / claude-opus-5-5 (Anthropic).
// Habilitations : ai.quiz_generator / ai.lesson_plan / ai.omr ; par professeur et par jour :
// 40 générations (quiz, fiches) et 400 lectures de feuilles.
//
// Requête  : { action: "quiz" | "lesson_plan", language: "ar" | "fr", text?: string, material_id?: string, ...options }
// Réponse  : { quiz: {...} } | { plan: {...} } | { error: string }

import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const DAILY_LIMIT = { quiz: 40, lesson_plan: 40, omr: 400 } as const;
const MAX_TEXT = 60000;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const LANG = { ar: "Arabic (Modern Standard Arabic, as used in Moroccan schools)", fr: "French" } as const;

const SYSTEM =
  "You assist teachers of the Moroccan education system (primary, collège, lycée). " +
  "You write classroom material that a teacher will review before use: precise, correct, adapted to the stated level, " +
  "using the official Moroccan curriculum vocabulary. Mathematical expressions are written in LaTeX between $...$. " +
  "Base the content strictly on the course material provided when there is one; do not invent facts outside it.";

const QUIZ_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "questions"],
  properties: {
    title: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "type", "points", "options", "explanation"],
        properties: {
          question: { type: "string" },
          type: { type: "string", enum: ["multiple_choice", "true_false", "short_answer"] },
          points: { type: "integer" },
          options: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["text", "is_correct"],
              properties: { text: { type: "string" }, is_correct: { type: "boolean" } },
            },
          },
          explanation: { type: "string" },
        },
      },
    },
  },
};

const OMR_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["readable", "sheet_number", "student_name", "answers"],
  properties: {
    readable: { type: "boolean" },
    sheet_number: { type: "string" },
    student_name: { type: "string" },
    answers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["n", "marked", "doubtful"],
        properties: {
          n: { type: "integer" },
          marked: { type: "array", items: { type: "string" } },
          doubtful: { type: "boolean" },
        },
      },
    },
  },
};

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "level", "duration", "competencies", "objectives", "prerequisites", "materials", "steps", "assessment", "homework", "remediation"],
  properties: {
    title: { type: "string" },
    level: { type: "string" },
    duration: { type: "string" },
    competencies: { type: "array", items: { type: "string" } },
    objectives: { type: "array", items: { type: "string" } },
    prerequisites: { type: "array", items: { type: "string" } },
    materials: { type: "array", items: { type: "string" } },
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["phase", "duration", "teacher", "students", "evaluation"],
        properties: {
          phase: { type: "string" },
          duration: { type: "string" },
          teacher: { type: "string" },
          students: { type: "string" },
          evaluation: { type: "string" },
        },
      },
    },
    assessment: { type: "string" },
    homework: { type: "string" },
    remediation: { type: "string" },
  },
};

const toBase64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

// ---- Gemini (API REST generativelanguage) ----
// Le schéma JSON est converti au format « responseSchema » (sous-ensemble OpenAPI).
const toGeminiSchema = (s: any): any => {
  const out: any = { type: String(s.type).toUpperCase() };
  if (s.enum) out.enum = s.enum;
  if (s.items) out.items = toGeminiSchema(s.items);
  if (s.properties) {
    out.properties = Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, toGeminiSchema(v)]));
    out.required = s.required;
    out.propertyOrdering = s.required;
  }
  return out;
};

class AiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function callGemini(apiKey: string, model: string, content: any[], schema: Record<string, unknown>) {
  const parts = content.map((b) => (b.type === "text" ? { text: b.text } : { inlineData: { mimeType: b.source.media_type, data: b.source.data } }));
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", responseSchema: toGeminiSchema(schema), maxOutputTokens: 16000 },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AiError(res.status, data?.error?.message || `Gemini HTTP ${res.status}`);
  const cand = data?.candidates?.[0];
  const finish = cand?.finishReason;
  const text = (cand?.content?.parts || []).map((p: any) => p.text || "").join("");
  return {
    refused: !cand || finish === "SAFETY" || finish === "PROHIBITED_CONTENT" || finish === "BLOCKLIST",
    truncated: finish === "MAX_TOKENS",
    text,
    usage: { input_tokens: data?.usageMetadata?.promptTokenCount ?? null, output_tokens: data?.usageMetadata?.candidatesTokenCount ?? null },
  };
}

async function callAnthropic(apiKey: string, model: string, content: any[], schema: Record<string, unknown>) {
  const client = new Anthropic({ apiKey });
  const response = await client.beta.messages.create({
    model,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort: "medium", format: { type: "json_schema", schema } },
    messages: [{ role: "user", content }],
  });
  return {
    refused: response.stop_reason === "refusal",
    truncated: response.stop_reason === "max_tokens",
    text: response.content.map((b) => (b.type === "text" ? b.text : "")).join(""),
    usage: { input_tokens: response.usage?.input_tokens ?? null, output_tokens: response.usage?.output_tokens ?? null },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const provider = Deno.env.get("AI_PROVIDER") === "anthropic" || !geminiKey ? "anthropic" : "gemini";
    const apiKey = provider === "gemini" ? geminiKey : anthropicKey;
    if (!apiKey) return json({ error: "AI_NOT_CONFIGURED" }, 503);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const caller = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: who } = await caller.auth.getUser();
    const uid = who?.user?.id;
    if (!uid) return json({ error: "NOT_AUTHENTICATED" }, 401);
    const { data: prof } = await admin.from("profiles").select("role").eq("id", uid).maybeSingle();
    if (prof?.role !== "professor") return json({ error: "PROFESSORS_ONLY" }, 403);

    const body = await req.json();
    if (body?.material_id && body?.action === "omr") delete body.material_id;
    const action = body?.action;
    if (action !== "quiz" && action !== "lesson_plan" && action !== "omr") return json({ error: "INVALID_ACTION" }, 400);
    const language: "ar" | "fr" = body?.language === "ar" ? "ar" : "fr";

    const perm = action === "quiz" ? "ai.quiz_generator" : action === "omr" ? "ai.omr" : "ai.lesson_plan";
    const { data: allowed, error: permErr } = await caller.rpc("has_permission", { p_key: perm });
    if (!permErr && allowed === false) return json({ error: "PERMISSION_DENIED" }, 403);

    // Limite quotidienne (si la table existe)
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count, error: cntErr } = await admin.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("kind", action).gte("created_at", since);
    if (!cntErr && (count || 0) >= DAILY_LIMIT[action as keyof typeof DAILY_LIMIT]) return json({ error: "DAILY_LIMIT" }, 429);

    // Contenu du cours : texte collé + document (PDF / image) du professeur
    const text = String(body?.text || "").slice(0, MAX_TEXT).trim();
    const content: any[] = [];
    if (body?.material_id) {
      const { data: m } = await admin.from("course_materials").select("file_path, file_name, course_id").eq("id", body.material_id).maybeSingle();
      if (!m) return json({ error: "MATERIAL_NOT_FOUND" }, 404);
      const { data: c } = await admin.from("courses").select("professor_id").eq("id", m.course_id).maybeSingle();
      if (c?.professor_id !== uid) return json({ error: "ACCESS_DENIED" }, 403);
      if (/^https?:\/\//i.test(m.file_path)) return json({ error: "UNSUPPORTED_MATERIAL" }, 400);
      const { data: file, error: dlErr } = await admin.storage.from("course-materials").download(m.file_path);
      if (dlErr || !file) return json({ error: "MATERIAL_DOWNLOAD_FAILED" }, 502);
      if (file.size > MAX_FILE_BYTES) return json({ error: "MATERIAL_TOO_LARGE" }, 413);
      const data = toBase64(await file.arrayBuffer());
      const name = `${m.file_path} ${m.file_name}`.toLowerCase();
      if (/\.pdf\b/.test(name)) {
        content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data } });
      } else {
        const ext = (/\.(png|jpe?g|gif|webp)\b/.exec(name)?.[1] || "png").replace("jpg", "jpeg");
        content.push({ type: "image", source: { type: "base64", media_type: `image/${ext}`, data } });
      }
    }
    if (!text && !content.length && action === "quiz") return json({ error: "NO_SOURCE" }, 400);

    let prompt: string;
    let schema: Record<string, unknown>;
    if (action === "omr") {
      // Photo de la feuille (JPEG en base64, compressée par le navigateur)
      const image = String(body?.image || "");
      if (!image || image.length > 7_000_000) return json({ error: "NO_SOURCE" }, 400);
      const layout: number[] = (Array.isArray(body?.options_per_question) ? body.options_per_question : []).slice(0, 100).map((x: unknown) => Math.min(6, Math.max(2, Number(x) || 4)));
      if (!layout.length) return json({ error: "NO_SOURCE" }, 400);
      content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } });
      prompt =
        "This is a photo of a student's multiple-choice answer sheet. " +
        `It has ${layout.length} numbered rows; row n has the boxes ${layout.map((k, i) => `${i + 1}: ${"ABCDEF".slice(0, k).split("").join(" ")}`).join("; ")}. ` +
        "For each row, list the letters whose box is clearly filled, crossed or ticked by the student. " +
        "A box that was crossed out and then circled or redone counts as the student's final choice; scribbled-out marks do not count. " +
        "Leave marked empty when the row has no mark. Set doubtful to true when a row is ambiguous (faint mark, two marks where one may be erased). " +
        'sheet_number: the printed sheet number (after "N°" or "#"), digits only, or "" if absent. ' +
        'student_name: the name printed or handwritten on the sheet, or "". ' +
        "readable: false if the photo is not an answer sheet or is too blurry to read; then answers may be empty. " +
        "Return one entry per row, n from 1 to " + layout.length + ".";
      schema = OMR_SCHEMA;
    } else if (action === "quiz") {
      const count = Math.min(30, Math.max(1, Number(body?.count) || 10));
      const types: string[] = Array.isArray(body?.types) && body.types.length ? body.types : ["multiple_choice", "true_false"];
      prompt =
        `Write a quiz of exactly ${count} questions in ${LANG[language]} about the course material provided` +
        (text ? " (pasted text below)" : "") + ". " +
        `Level: ${String(body?.level || "unspecified").slice(0, 80)}. Difficulty: ${String(body?.difficulty || "mixed").slice(0, 40)}. ` +
        `Allowed question types: ${types.join(", ")}. ` +
        "multiple_choice: 4 options, exactly one correct, plausible distractors based on common student mistakes. " +
        `true_false: exactly two options, "True" and "False" (in English, these exact words), one correct. ` +
        "short_answer: options must be an empty array; put the expected answer in explanation. " +
        "points: 1 for easy questions, 2 for harder ones. explanation: one short sentence justifying the right answer, for the teacher. " +
        "Cover the whole material, from recall to application. title: a short quiz title." +
        (text ? `\n\n<course>\n${text}\n</course>` : "");
      schema = QUIZ_SCHEMA;
    } else {
      const topic = String(body?.topic || "").slice(0, 300).trim();
      if (!topic && !text && !content.length) return json({ error: "NO_SOURCE" }, 400);
      prompt =
        `Write a lesson plan (fiche pédagogique / جذاذة) in ${LANG[language]} for one lesson. ` +
        `Topic: ${topic || "the course material provided"}. Level: ${String(body?.level || "unspecified").slice(0, 80)}. ` +
        `Duration: ${Math.min(240, Math.max(15, Number(body?.duration) || 55))} minutes. ` +
        (body?.notes ? `Teacher's notes: ${String(body.notes).slice(0, 1000)}. ` : "") +
        "Follow the Moroccan competency-based approach: competencies, measurable objectives, prerequisites, teaching materials, " +
        "then steps (phase name such as warm-up / discovery / construction / consolidation / evaluation, duration, " +
        "what the teacher does, what the students do, formative evaluation for that step). " +
        "Step durations must add up to the lesson duration. End with the final assessment, homework and a remediation idea for struggling students." +
        (text ? `\n\n<course>\n${text}\n</course>` : "");
      schema = PLAN_SCHEMA;
    }
    content.push({ type: "text", text: prompt });

    const model = Deno.env.get("TEACHER_AI_MODEL") || (provider === "gemini" ? "gemini-2.5-flash" : "claude-opus-5-5");
    const result = provider === "gemini" ? await callGemini(apiKey, model, content, schema) : await callAnthropic(apiKey, model, content, schema);

    if (result.refused) return json({ error: "REFUSED" }, 422);
    if (result.truncated) return json({ error: "TOO_LONG" }, 422);
    const parsed = JSON.parse(result.text);

    await admin.from("ai_usage").insert({
      user_id: uid,
      kind: action,
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
    }).then(() => undefined, () => undefined);

    return json(action === "quiz" ? { quiz: parsed } : action === "omr" ? { sheet: parsed } : { plan: parsed });
  } catch (error) {
    console.error(error);
    if (error instanceof Anthropic.RateLimitError || (error instanceof AiError && error.status === 429)) return json({ error: "AI_BUSY" }, 429);
    if (error instanceof Anthropic.APIError || error instanceof AiError) return json({ error: "AI_ERROR", status: (error as any).status, detail: String((error as Error).message).slice(0, 300) }, 502);
    return json({ error: String((error as Error)?.message || error) }, 500);
  }
});

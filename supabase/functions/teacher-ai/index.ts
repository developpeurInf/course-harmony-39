// Supabase Edge Function : teacher-ai
// Outils IA pour les professeurs (Claude ou Gemini) :
//   action "quiz"        → questions de quiz (QCM, vrai/faux, réponse courte) à partir d'un cours
//   action "lesson_plan" → fiche pédagogique d'une séance (déroulement, activités, évaluation)
//   action "omr"         → lecture de la photo d'une feuille-réponse de QCM (cases cochées)
//   action "diagnostic"  → analyse d'une évaluation diagnostique : constats, propositions, analyse par
//                          ressource, besoins par groupe et plan de remédiation (statistiques
//                          anonymes + test de l'appli ou document ; aucun nom d'élève n'est envoyé)
//
// Le contenu du cours vient d'un texte collé et/ou d'un document du cours (PDF ou image,
// table course_materials) lu côté serveur : le professeur doit être propriétaire du cours.
//
// Secrets Supabase : GEMINI_API_KEY ou ANTHROPIC_API_KEY (l'un des deux).
//   AI_PROVIDER (optionnel) : "gemini" ou "anthropic" ; par défaut gemini si GEMINI_API_KEY existe.
//   TEACHER_AI_MODEL (optionnel) : défaut gemini-3.8-flash (Gemini) / claude-opus-5-5 (Anthropic).
//   GEMINI_FALLBACK_MODEL (optionnel) : modèle Gemini essayé quand le principal est saturé.
//   AI_TIME_BUDGET_MS (optionnel) : durée maximale d'une génération, 135000 par défaut.
// Habilitations : ai.quiz_generator / ai.lesson_plan / ai.omr ; par professeur et par jour :
// 40 générations (quiz, fiches) et 400 lectures de feuilles.
//
// Requête  : { action: "quiz" | "lesson_plan", language: "ar" | "fr", text?: string, material_id?: string, ...options }
// Réponse  : { quiz: {...} } | { plan: {...} } | { error: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const DAILY_LIMIT = { quiz: 40, lesson_plan: 40, omr: 400, diagnostic: 120, remediation: 6 } as const; // diagnostic : 4 parties par analyse
const MAX_TEXT = 60000;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const LANG = { ar: "Arabic (Modern Standard Arabic, as used in Moroccan schools)", fr: "French", en: "English" } as const;

const SYSTEM =
  "You assist teachers of the Moroccan education system (primary, collège, lycée). " +
  "You write classroom material that a teacher will review before use: precise, correct, adapted to the stated level, " +
  "using the official Moroccan curriculum vocabulary. Mathematical expressions are written in LaTeX between $...$. " +
  "Base the content strictly on the course material provided when there is one; do not invent facts outside it.";

// Remédiation pour l'élève : exercices ciblés sur ses erreurs d'un quiz
const REMEDIATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "exercises"],
  properties: {
    summary: { type: "string" },
    exercises: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["skill", "statement", "hint", "answer"],
        properties: {
          skill: { type: "string" },
          statement: { type: "string" },
          hint: { type: "string" },
          answer: { type: "string" },
        },
      },
    },
  },
} as const;

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

const DIAG_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["appreciation", "summary", "observations", "propositions", "resources", "groups", "plan"],
  properties: {
    appreciation: { type: "string" },
    summary: { type: "string" },
    intro: { type: "string" },
    remark: { type: "string" },
    support: { type: "string" },
    exercises: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description"],
        properties: { title: { type: "string" }, description: { type: "string" } },
      },
    },
    observations: { type: "array", items: { type: "string" } },
    propositions: { type: "array", items: { type: "string" } },
    resources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["resource", "mastery", "rate", "difficulties", "error_type", "remediation"],
        properties: {
          resource: { type: "string" },
          mastery: { type: "string", enum: ["acquired", "partial", "not_acquired"] },
          rate: { type: "integer" },
          difficulties: { type: "string" },
          error_type: { type: "string" },
          remediation: { type: "string" },
        },
      },
    },
    groups: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["band", "needs", "support_type", "activities"],
        properties: {
          band: { type: "string", enum: ["t1", "t2", "t3", "t4"] },
          needs: { type: "string" },
          support_type: { type: "string" },
          activities: { type: "string" },
        },
      },
    },
    plan: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["period", "content", "target", "activities", "indicators"],
        properties: {
          period: { type: "string" },
          content: { type: "string" },
          target: { type: "string" },
          activities: { type: "string" },
          indicators: { type: "string" },
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

/** Parties de l'analyse diagnostique, demandées séparément par l'appli (body.part) */
const DIAG_PARTS: Record<string, string[]> = {
  summary: ["appreciation", "summary", "observations", "propositions"],
  resources: ["resources"],
  groups: ["groups"],
  plan: ["plan"],
  report2: ["intro", "remark", "support"],
  exercises: ["exercises"],
};

/** Schéma restreint à certaines parties (sans part : deux moitiés indépendantes) */
function splitSchema(schema: any, part?: string): Record<string, unknown>[] {
  const halves = part && DIAG_PARTS[part] ? [DIAG_PARTS[part]] : [["appreciation", "summary", "observations", "propositions", "resources"], ["groups", "plan"]];
  return halves.map((keys) => ({
    ...schema,
    required: keys,
    properties: Object.fromEntries(keys.map((k) => [k, schema.properties[k]])),
  }));
}

class AiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function callGemini(apiKey: string, model: string, content: any[], schema: Record<string, unknown>, deadline: number) {
  const parts = content.map((b) => (b.type === "text" ? { text: b.text } : { inlineData: { mimeType: b.source.media_type, data: b.source.data } }));
  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: toGeminiSchema(schema),
      maxOutputTokens: 8192,
      // Réflexion courte : reste sous les limites de temps / CPU des Edge Functions
      thinkingConfig: { thinkingLevel: Deno.env.get("GEMINI_THINKING") || "low" },
    },
  });
  // Durée limitée : chaque appel s'arrête avant la limite de la fonction (150 s sur l'offre
  // gratuite) pour renvoyer une erreur claire au lieu d'un arrêt brutal (546).
  const fallback = Deno.env.get("GEMINI_FALLBACK_MODEL");
  const useFallback = !!fallback && fallback !== model;
  const send = (m: string, maxMs = Infinity) => {
    const left = Math.min(deadline - Date.now(), maxMs);
    if (left < 8000) throw new AiError(504, "AI_TIMEOUT");
    return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: payload,
      signal: AbortSignal.timeout(left),
    }).catch((e) => {
      if (e?.name === "TimeoutError" || e?.name === "AbortError") throw new AiError(504, "AI_TIMEOUT");
      throw e;
    });
  };
  // Modèle principal : avec un modèle de secours, on ne lui laisse que 60 s (lent = saturé).
  // Saturé (503 / 429) ou trop lent : nouvelles tentatives courtes, puis GEMINI_FALLBACK_MODEL.
  let res: Response | null = null;
  try {
    res = await send(model, useFallback ? 60000 : Infinity);
    for (const wait of [2000, 5000]) {
      if (res.status !== 503 && res.status !== 429) break;
      if (deadline - Date.now() < wait + 30000) break;
      await new Promise((r) => setTimeout(r, wait));
      res = await send(model, useFallback ? 40000 : Infinity);
    }
  } catch (e) {
    if (!(e instanceof AiError && e.status === 504 && useFallback)) throw e;
    res = null;
  }
  if (useFallback && (!res || res.status === 503 || res.status === 429)) {
    console.log(`teacher-ai: ${model} ${res ? res.status : "trop lent"}, essai de ${fallback}`);
    res = await send(fallback!);
  }
  if (!res) throw new AiError(504, "AI_TIMEOUT");
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
  // Import à la demande : le SDK n'est chargé que si Anthropic est utilisé
  const { default: Anthropic } = await import("npm:@anthropic-ai/sdk@1.3.0");
  const client = new Anthropic({ apiKey });
  let response;
  try {
    response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      output_config: { effort: "medium", format: { type: "json_schema", schema } },
      messages: [{ role: "user", content }],
    });
  } catch (e) {
    if (e instanceof Anthropic.APIError) throw new AiError(e.status ?? 502, e.message);
    throw e;
  }
  return {
    refused: response.stop_reason === "refusal",
    truncated: response.stop_reason === "max_tokens",
    text: response.content.map((b) => (b.type === "text" ? b.text : "")).join(""),
    usage: { input_tokens: response.usage?.input_tokens ?? null, output_tokens: response.usage?.output_tokens ?? null },
  };
}

/** Exercices de remédiation à partir des questions ratées d'une copie de quiz de l'élève */
async function remediation(admin: any, uid: string, body: any, provider: string, apiKey: string, deadline: number) {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("kind", "remediation").gte("created_at", since);
  if ((count || 0) >= DAILY_LIMIT.remediation) return json({ error: "DAILY_LIMIT" }, 429);
  const { data: sub } = await admin.from("quiz_submissions").select("id, student_id, exam_id").eq("id", body?.submission_id).maybeSingle();
  if (!sub || sub.student_id !== uid) return json({ error: "ACCESS_DENIED" }, 403);
  const { data: exam } = await admin.from("exams").select("title, course_id").eq("id", sub.exam_id).maybeSingle();
  const { data: course } = exam?.course_id ? await admin.from("courses").select("title, professor_id").eq("id", exam.course_id).maybeSingle() : { data: null };
  if (course?.professor_id) {
    const { data: s } = await admin.from("app_settings").select("data").eq("id", 1).maybeSingle();
    if (s?.data?.features?.progress === false) return json({ error: "PERMISSION_DENIED" }, 403);
  }
  const { data: answers } = await admin.from("quiz_answers").select("question_id, is_correct, text_answer, selected_option_id").eq("submission_id", sub.id);
  const wrong = (answers || []).filter((a: any) => a.is_correct === false);
  if (!wrong.length) return json({ error: "NOTHING_TO_REMEDIATE" }, 400);
  const ids = wrong.map((a: any) => a.question_id);
  const [{ data: qs }, { data: opts }] = await Promise.all([
    admin.from("quiz_questions").select("id, question").in("id", ids),
    admin.from("quiz_options").select("id, question_id, option_text, is_correct").in("question_id", ids),
  ]);
  const strip = (h: string) => String(h || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 600);
  const lines = wrong.slice(0, 12).map((a: any, i: number) => {
    const q = (qs || []).find((x: any) => x.id === a.question_id);
    const right = (opts || []).filter((o: any) => o.question_id === a.question_id && o.is_correct).map((o: any) => strip(o.option_text)).join(" / ");
    const given = a.selected_option_id ? strip((opts || []).find((o: any) => o.id === a.selected_option_id)?.option_text) : strip(a.text_answer);
    return `${i + 1}. Question: ${strip(q?.question)}\n   Student answer: ${given || "(none)"}\n   Correct answer: ${right || "(open question)"}`;
  });
  const language: "ar" | "fr" | "en" = body?.language === "ar" ? "ar" : body?.language === "en" ? "en" : "fr";
  const prompt =
    `A student got these questions wrong in the quiz "${strip(exam?.title || "")}" (course: ${strip(course?.title || "")}).\n` + lines.join("\n") +
    `\n\nWrite in ${LANG[language]}, addressing the student directly and kindly. summary: two sentences naming the misunderstood notions. ` +
    "exercises: 3 to 6 short practice exercises, easier than or as hard as the missed questions, each targeting one missed notion (skill), " +
    "with a hint and the full worked answer. Do not repeat the quiz questions word for word.";
  const content = [{ type: "text", text: prompt }];
  const model = Deno.env.get("TEACHER_AI_MODEL") || (provider === "gemini" ? "gemini-3.8-flash" : "claude-opus-5-5");
  const r = provider === "gemini" ? await callGemini(apiKey, model, content, REMEDIATION_SCHEMA, deadline) : await callAnthropic(apiKey, model, content, REMEDIATION_SCHEMA);
  if (r.refused) return json({ error: "REFUSED" }, 422);
  if (r.truncated) return json({ error: "TOO_LONG" }, 422);
  await admin.from("ai_usage").insert({ user_id: uid, kind: "remediation", input_tokens: r.usage.input_tokens, output_tokens: r.usage.output_tokens }).then(() => undefined, () => undefined);
  return json({ remediation: JSON.parse(r.text) });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  // Marge sous la limite de durée des Edge Functions (150 s sur l'offre gratuite)
  const deadline = Date.now() + Number(Deno.env.get("AI_TIME_BUDGET_MS") || 135000);
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
    const body = await req.json();
    if (body?.action === "remediation") {
      if (prof?.role !== "student") return json({ error: "STUDENTS_ONLY" }, 403);
      // Fonction accordée par l'offre du professeur de l'élève (absente avant migration : autorisée)
      const { data: okForStudent, error: sfErr } = await caller.rpc("student_teacher_can", { p_key: "student.remediation_ai" });
      if (!sfErr && okForStudent === false) return json({ error: "PERMISSION_DENIED" }, 403);
      return await remediation(admin, uid, body, provider, apiKey, deadline);
    }
    if (prof?.role !== "professor") return json({ error: "PROFESSORS_ONLY" }, 403);

    if (body?.material_id && body?.action === "omr") delete body.material_id;
    const action = body?.action;
    if (action !== "quiz" && action !== "lesson_plan" && action !== "omr" && action !== "diagnostic") return json({ error: "INVALID_ACTION" }, 400);
    const language: "ar" | "fr" | "en" = body?.language === "ar" ? "ar" : body?.language === "en" && action === "diagnostic" ? "en" : "fr";

    const perm = action === "quiz" ? "ai.quiz_generator" : action === "omr" ? "ai.omr" : action === "diagnostic" ? "ai.diagnostic" : "ai.lesson_plan";
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
      if (file.size > (action === "diagnostic" ? MAX_FILE_BYTES / 2 : MAX_FILE_BYTES)) return json({ error: "MATERIAL_TOO_LARGE" }, 413);
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
    } else if (action === "diagnostic") {
      // Statistiques anonymes calculées par l'appli (aucun nom d'élève)
      const stats = JSON.stringify(body?.stats ?? {}).slice(0, 12000);
      const exercises: { title: string; description: string; rate?: number | null }[] = (Array.isArray(body?.exercises) ? body.exercises : [])
        .slice(0, 20)
        .map((e: any) => ({ title: String(e?.title || "").slice(0, 120), description: String(e?.description || "").slice(0, 400), rate: Number.isFinite(Number(e?.rate)) && e?.rate !== null && e?.rate !== "" ? Math.max(0, Math.min(100, Math.round(Number(e.rate)))) : null }));
      // Test passé dans l'appli : questions et taux de réussite réels par question
      let examBlock = "";
      if (body?.exam_id) {
        const { data: ex } = await admin.from("exams").select("title, course_id").eq("id", body.exam_id).maybeSingle();
        if (!ex) return json({ error: "EXAM_NOT_FOUND" }, 404);
        const { data: c } = await admin.from("courses").select("professor_id").eq("id", ex.course_id).maybeSingle();
        if (c?.professor_id !== uid) return json({ error: "ACCESS_DENIED" }, 403);
        const { data: qs } = await admin.from("quiz_questions").select("id, question, points, question_order").eq("exam_id", body.exam_id).order("question_order").limit(60);
        const ids = (qs || []).map((q: any) => q.id);
        const rates: Record<string, { got: number; max: number; n: number }> = {};
        if (ids.length) {
          const { data: ans } = await admin.from("quiz_answers").select("question_id, is_correct, points_earned").in("question_id", ids).limit(20000);
          const pts: Record<string, number> = Object.fromEntries((qs || []).map((q: any) => [q.id, Number(q.points) || 1]));
          for (const a of ans || []) {
            const r = (rates[a.question_id] ||= { got: 0, max: 0, n: 0 });
            const max = pts[a.question_id] || 1;
            r.n++;
            r.max += max;
            r.got += a.points_earned != null ? Math.max(0, Math.min(max, Number(a.points_earned))) : a.is_correct ? max : 0;
          }
        }
        examBlock = `\n\n<app_test title="${String(ex.title || "").replace(/"/g, "'").slice(0, 150)}">\n` +
          (qs || []).map((q: any, i: number) => {
            const r = rates[q.id];
            const rate = r && r.max ? `${Math.round((r.got / r.max) * 100)}% success over ${r.n} answers` : "no answers";
            return `Q${i + 1} (${rate}): ${String(q.question || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 300)}`;
          }).join("\n") + "\n</app_test>";
      }
      prompt =
        `Analyse the results of a diagnostic assessment (التقويم التشخيصي) of the Moroccan education system and write the teacher's report content in ${LANG[language]}. ` +
        `Subject: ${String(body?.subject || "unspecified").slice(0, 80)}. Level: ${String(body?.level || "unspecified").slice(0, 120)}. ` +
        "Score bands used by the ministry: t1 = struggling (المتعثرون, score ≤ 8/20), t2 = keeping up (المسايرون, 8–12), t3 = good (المتفوقون, 12–14), t4 = excellent (المتميزون, 14–20). " +
        "Base every statement on the data below; do not invent numbers. " +
        "resources: one entry per exercise / resource listed (in the same order); when a success rate is given (teacher's or measured in the app test), copy it into rate; " +
        "otherwise estimate it from the class results and the difficulty of the item, and say \"estimated\" in difficulties. mastery: acquired ≥ 70%, partial 40–69%, not_acquired < 40%. " +
        "difficulties: the observed gaps (1–2 sentences). error_type: nature of the error (conceptual, procedural / calculation, methodological, reading of the statement, prerequisite from previous years…). remediation: a concrete targeted activity. " +
        "groups: exactly 4 entries t1..t4 with the needs of each group, the type of support (immediate / integrated in lessons / institutional / outside class time) and 2–3 concrete activities. " +
        "plan: 4 to 6 rows of a remediation plan over the first weeks (period such as \"Semaine 1\" / \"الأسبوع 1\", content, target group, activities and materials, success indicators). " +
        "observations: 4 to 6 findings; propositions: 4 to 6 remediation proposals. " +
        (language === "ar"
          ? "appreciation: one adjective (or two words) that completes the sentence \"النتائج المحصل عليها ___\" (feminine, e.g. ضعيفة، متوسطة، مستحسنة). "
          : language === "en"
          ? "appreciation: one adjective (or two words) that completes \"The results obtained are ___\" (e.g. weak, moderate, satisfactory). "
          : "appreciation: one adjective (or two words), masculine plural, that completes \"Les résultats obtenus sont ___\" (e.g. faibles, moyens, satisfaisants). ") +
        `intro: 2–3 sentences introducing the report (start of the ${String(body?.context?.year || "").slice(0, 20)} school year, diagnostic period ${String(body?.context?.period || "").slice(0, 60)}, prior learning assessed in the first lessons) ending with a colon before the list of classes. ` +
        "remark: one sentence on student absence during the test, using the absence rate from the statistics. " +
        "support: one paragraph (4–5 sentences) on the support and remediation methods adopted after the test (correction sessions, reminders, integrated support in each lesson, extra sessions). " +
        "exercises: one entry per exercise of the test document or app test, title such as \"Exercice 1\" / \"التمرين 1\" / \"Exercise 1\" and a short description of the resources it assesses. " +
        "summary: 2–3 sentences. Keep every string short (at most 2 sentences). Do NOT use LaTeX: write mathematics in plain Unicode (x², √x, ≤, ≥, π, f(x))." +
        `\n\n<class_statistics>\n${stats}\n</class_statistics>` +
        `\n\n<exercises>\n${exercises.map((e, i) => `${i + 1}. ${e.title} — ${e.description}${e.rate !== null && e.rate !== undefined ? ` (teacher's success rate: ${e.rate}%)` : ""}`).join("\n") || "(none listed)"}\n</exercises>` +
        examBlock +
        (text ? `\n\n<teacher_notes>\n${text}\n</teacher_notes>` : "") +
        (content.length ? "\n\nThe attached document is the diagnostic test or the related course." : "") +
        (DIAG_PARTS[String(body?.part || "")] ? `\n\nWrite ONLY these fields now: ${DIAG_PARTS[String(body.part)].join(", ")}. Be concise.` : "");
      schema = DIAG_SCHEMA;
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

    const model = Deno.env.get("TEACHER_AI_MODEL") || (provider === "gemini" ? "gemini-3.8-flash" : "claude-opus-5-5");
    const call = (sch: Record<string, unknown>) => (provider === "gemini" ? callGemini(apiKey, model, content, sch, deadline) : callAnthropic(apiKey, model, content, sch));
    // Analyse diagnostique : deux demandes plus courtes en parallèle (constats + ressources /
    // groupes + plan) pour rester sous la limite de durée des Edge Functions.
    const parts = action === "diagnostic" ? await Promise.all(splitSchema(schema, String(body?.part || "")).map(call)) : [await call(schema)];

    if (parts.some((r) => r.refused)) return json({ error: "REFUSED" }, 422);
    if (parts.some((r) => r.truncated)) return json({ error: "TOO_LONG" }, 422);
    const parsed = Object.assign({}, ...parts.map((r) => JSON.parse(r.text)));
    const result = {
      usage: {
        input_tokens: parts.reduce((n, r) => n + (r.usage.input_tokens || 0), 0),
        output_tokens: parts.reduce((n, r) => n + (r.usage.output_tokens || 0), 0),
      },
    };

    await admin.from("ai_usage").insert({
      user_id: uid,
      kind: action,
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
    }).then(() => undefined, () => undefined);

    return json(action === "quiz" ? { quiz: parsed } : action === "omr" ? { sheet: parsed } : action === "diagnostic" ? { analysis: parsed } : { plan: parsed });
  } catch (error) {
    console.error(error);
    if (error instanceof AiError && error.status === 504) return json({ error: "AI_TIMEOUT" }, 504);
    if (error instanceof AiError && (error.status === 429 || error.status === 503 || error.status === 529)) return json({ error: "AI_BUSY", detail: String(error.message).slice(0, 300) }, 503);
    if (error instanceof AiError) return json({ error: "AI_ERROR", status: error.status, detail: String((error as Error).message).slice(0, 300) }, 502);
    return json({ error: String((error as Error)?.message || error) }, 500);
  }
});

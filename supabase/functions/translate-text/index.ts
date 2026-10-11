// Supabase Edge Function : translate-text
// Traduit une liste de textes (ar ⇄ fr ⇄ en) pour l'évaluation diagnostique.
//
// Fournisseur utilisé, par ordre de priorité (secrets Supabase) :
//   1. ANTHROPIC_API_KEY          → Claude (meilleure qualité, vocabulaire pédagogique marocain)
//      ANTHROPIC_MODEL (optionnel) → modèle à utiliser (défaut : claude-sonnet-4-5)
//   2. GOOGLE_TRANSLATE_API_KEY   → Google Cloud Translation (officiel)
//   3. aucun secret               → service Google Translate gratuit (sans clé, non officiel)
//
// Requête  : { texts: string[], source: "ar"|"fr"|"en", target: "ar"|"fr"|"en" }
// Réponse  : { translations: string[], provider: string }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LANG_NAMES: Record<string, string> = { ar: "Arabic", fr: "French", en: "English" };
const MAX_TEXTS = 200;
const MAX_CHARS = 30000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function withClaude(texts: string[], source: string, target: string, apiKey: string): Promise<string[]> {
  const model = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-5";
  const system =
    `You are a professional translator for Moroccan secondary-school teachers. ` +
    `You translate the content of an official "diagnostic evaluation" report (التقويم التشخيصي / évaluation diagnostique): ` +
    `pedagogical observations, remediation and support proposals (الدعم والمعالجة / soutien et remédiation), exercise titles and descriptions, global appreciation. ` +
    `Translate from ${LANG_NAMES[source]} to ${LANG_NAMES[target]} using the standard terminology of the Moroccan education system ` +
    `(e.g. "رائز" = "test diagnostique", "الكفايات" = "compétences", "التعلمات القبلية" = "prérequis / acquis antérieurs"). ` +
    `Keep numbers, percentages, mathematical notation and formulas unchanged. Keep the same tone and roughly the same length. ` +
    `Do not add explanations. Reply ONLY with a JSON array of strings, same length and same order as the input array.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      temperature: 0,
      system,
      messages: [{ role: "user", content: JSON.stringify(texts) }],
    }),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text: string = (data?.content || []).map((c: any) => c?.text || "").join("");
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  const arr = JSON.parse(text.slice(start, end + 1));
  if (!Array.isArray(arr) || arr.length !== texts.length) throw new Error("Claude: invalid array length");
  return arr.map((s: unknown) => String(s ?? ""));
}

async function withGoogleOfficial(texts: string[], source: string, target: string, apiKey: string): Promise<string[]> {
  const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ q: texts, source, target, format: "text" }),
  });
  if (!res.ok) throw new Error(`Google ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data?.data?.translations || []).map((t: any) => String(t?.translatedText ?? ""));
}

async function withGoogleFree(texts: string[], source: string, target: string): Promise<string[]> {
  const out: string[] = [];
  for (const t of texts) {
    if (!t.trim()) { out.push(t); continue; }
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(t)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Google free ${res.status}`);
    const data = await res.json();
    out.push((data?.[0] || []).map((seg: any) => seg?.[0] || "").join(""));
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { texts, source, target } = await req.json();
    if (!Array.isArray(texts) || !LANG_NAMES[source] || !LANG_NAMES[target]) {
      return json({ error: "Expected { texts: string[], source, target } with ar|fr|en" }, 400);
    }
    const clean = texts.map((t: unknown) => String(t ?? ""));
    if (clean.length > MAX_TEXTS || clean.join("").length > MAX_CHARS) {
      return json({ error: "Too much text" }, 413);
    }
    if (source === target || clean.every(t => !t.trim())) {
      return json({ translations: clean, provider: "none" });
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const googleKey = Deno.env.get("GOOGLE_TRANSLATE_API_KEY");
    const errors: string[] = [];

    if (anthropicKey) {
      try { return json({ translations: await withClaude(clean, source, target, anthropicKey), provider: "claude" }); }
      catch (e) { errors.push(String(e)); console.error(e); }
    }
    if (googleKey) {
      try { return json({ translations: await withGoogleOfficial(clean, source, target, googleKey), provider: "google" }); }
      catch (e) { errors.push(String(e)); console.error(e); }
    }
    try { return json({ translations: await withGoogleFree(clean, source, target), provider: "google-free" }); }
    catch (e) { errors.push(String(e)); console.error(e); }

    return json({ error: "Translation failed", details: errors }, 502);
  } catch (error) {
    return json({ error: String((error as Error)?.message || error) }, 500);
  }
});

import { supabase } from "@/integrations/supabase/client";

export type TransLang = "ar" | "fr" | "en";

/**
 * Traduit une liste de textes.
 * 1. Fonction Supabase « translate-text » (Claude / Google selon les secrets configurés)
 * 2. Repli : service Google Translate gratuit appelé depuis le navigateur
 * Les textes vides sont conservés tels quels ; l'ordre est préservé.
 */
export async function translateTexts(texts: string[], source: TransLang, target: TransLang): Promise<string[]> {
  if (source === target) return [...texts];
  const idx: number[] = [];
  const toSend: string[] = [];
  texts.forEach((t, i) => {
    if (t && t.trim()) { idx.push(i); toSend.push(t); }
  });
  const out = [...texts];
  if (toSend.length === 0) return out;

  let translated: string[] | null = null;

  try {
    const { data, error } = await supabase.functions.invoke("translate-text", {
      body: { texts: toSend, source, target },
    });
    if (!error && Array.isArray(data?.translations) && data.translations.length === toSend.length) {
      translated = data.translations.map((s: unknown) => String(s ?? ""));
    } else if (error) {
      console.warn("translate-text indisponible, repli navigateur :", error?.message || error);
    }
  } catch (e) {
    console.warn("translate-text indisponible, repli navigateur :", e);
  }

  if (!translated) {
    translated = [];
    for (const t of toSend) {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(t)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Translation HTTP ${res.status}`);
      const data = await res.json();
      translated.push(((data && data[0]) || []).map((seg: any) => (seg && seg[0]) || "").join(""));
    }
  }

  idx.forEach((pos, k) => { out[pos] = translated![k] ?? out[pos]; });
  return out;
}

import { supabase } from "@/integrations/supabase/client";
import { SCIENCE_GLOSSARY, POST_FIXES } from "@/lib/scienceGlossary";

export type TransLang = "ar" | "fr" | "en";
const COL: Record<TransLang, 0 | 1 | 2> = { ar: 0, fr: 1, en: 2 };

/* NB : pas de lookbehind (?<=…) — non supporté par Safari iOS 12. */
const AR = "\\u0621-\\u064A";
const LATIN = "A-Za-zÀ-ÿ";
const isArabic = (s: string) => /[؀-ۿ]/.test(s);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const stripFrArticle = (s: string) => s.replace(/^(les|le|la|l['’])\s*/i, "");

/* ------------------------------------------------------------------ */
/* Glossaire : protection des termes scientifiques                     */
/* ------------------------------------------------------------------ */

interface Matcher {
  re: RegExp;
  row: number;
  /** forme « لل… » (لـ + terme défini) */
  lil?: boolean;
}

const matcherCache: Partial<Record<TransLang, Matcher[]>> = {};

function arabicTermPattern(term: string): string {
  return term
    .trim()
    .split(/\s+/)
    .map(w => escapeRe(w).replace(/[اأإآ]/g, "[اأإآ]").replace(/[ةه]$/, "[ةه]"))
    .join("\\s+");
}

function getMatchers(source: TransLang): Matcher[] {
  if (matcherCache[source]) return matcherCache[source]!;
  const items: { len: number; m: Matcher }[] = [];
  SCIENCE_GLOSSARY.forEach((row, rowIdx) => {
    const forms = [row[COL[source]], ...row.slice(3)].filter(f => (source === "ar") === isArabic(f));
    const seen = new Set<string>();
    for (const raw of forms) {
      const form = source === "ar" ? raw.trim() : stripFrArticle(raw.trim());
      if (!form || seen.has(form)) continue;
      seen.add(form);
      if (source === "ar") {
        const pat = arabicTermPattern(form);
        items.push({ len: form.length, m: { row: rowIdx, re: new RegExp(`(^|[^${AR}])([وف]?)([بلك]?)(${pat})(?![${AR}])`, "g") } });
        if (form.startsWith("ال")) {
          const rest = arabicTermPattern(form.slice(2));
          items.push({ len: form.length, m: { row: rowIdx, lil: true, re: new RegExp(`(^|[^${AR}])([وف]?)لل(${rest})(?![${AR}])`, "g") } });
        }
      } else {
        const pat = form.split(/\s+/).map(w => escapeRe(w).replace(/['’]/g, "['’]")).join("\\s+");
        items.push({ len: form.length, m: { row: rowIdx, re: new RegExp(`(^|[^${LATIN}])(${pat})(s|x)?(?![${LATIN}])`, "gi") } });
      }
    }
  });
  items.sort((a, b) => b.len - a.len);
  return (matcherCache[source] = items.map(i => i.m));
}

const token = (n: number) => `«ZXQ${n}»`;

/** Remplace les termes du glossaire par des jetons ; renvoie le texte et les termes cibles */
function protect(text: string, source: TransLang, target: TransLang): { text: string; terms: string[] } {
  const terms: string[] = [];
  let out = source === "ar" ? text.replace(/[ً-ْٰـ]/g, "") : text;
  for (const m of getMatchers(source)) {
    m.re.lastIndex = 0;
    out = out.replace(m.re, (...g: any[]) => {
      const row = SCIENCE_GLOSSARY[m.row];
      let targetTerm = row[COL[target]];
      if (source === "ar") {
        const [whole, before, conj, prep, matched] = g;
        const offset: number = g[g.length - 2];
        const full: string = g[g.length - 1];
        const after = full.slice(offset + whole.length);
        // défini : article « ال », forme « لل… », ou état construit (إضافة) suivi d'un nom défini
        const definite = m.lil || /ال/.test(matched || "") || /^\s+(ال|«ZXQ)/.test(after);
        if (target === "fr" && !definite) targetTerm = stripFrArticle(targetTerm);
        terms.push(targetTerm);
        const n = terms.length - 1;
        if (m.lil) return `${before}${conj}لـ${token(n)}`;
        return `${before}${conj}${prep ? prep + "ـ" : conj ? " " : ""}${token(n)}`;
      }
      const [, before] = g;
      terms.push(targetTerm);
      return `${before}${token(terms.length - 1)}`;
    });
  }
  return { text: out, terms };
}

const TOKEN_RE = /[«"“]?\s*Z\s*X\s*Q\s*(\d+)\s*[»"”]?/gi;

/** Remet les termes exacts et corrige la grammaire autour */
function restore(text: string, terms: string[], target: TransLang): { text: string; ok: boolean } {
  let used = 0;
  // Deux termes collés (état construit arabe) : « l'exploitation » + « la fonction » → « … de la fonction »
  let src = text;
  if (target === "fr" || target === "en") {
    const link = target === "fr" ? " de " : " of ";
    src = src.replace(/(Z\s*X\s*Q\s*\d+\s*[»"”]?)\s*(?=[«"“]?\s*Z\s*X\s*Q\s*\d)/gi, `$1${link}`);
  }
  let out = src.replace(TOKEN_RE, (_m: string, n: string, offset: number, full: string) => {
    const t = terms[Number(n)];
    if (t === undefined) return _m;
    used++;
    // garder un espace avec les mots voisins (« pour« ZXQ1 » » → « pour le … »)
    const prev = full.charAt(offset - 1);
    const next = full.charAt(offset + _m.length);
    const word = /[A-Za-zÀ-ÿ0-9]/;
    return (prev && word.test(prev) ? " " : "") + t + (next && word.test(next) ? " " : "");
  });
  const ok = used >= terms.length && !/ZXQ/i.test(out);
  if (target === "fr") out = fixFrench(out);
  if (target === "ar") out = fixArabic(out);
  return { text: out, ok };
}

function fixFrench(s: string): string {
  let out = s;
  // article en double : « la la fonction », « les les acquis »
  out = out.replace(/(^|[^A-Za-zÀ-ÿ'])(le|la|les|l['’])\s+(?=(le|la|les)\s|l['’])/gi, "$1");
  // complément du nom oublié : « l'étude les variations » → « l'étude des variations »
  out = out.replace(/(l['’](?:étude|analyse|utilisation|exploitation|application)|la (?:maîtrise|compréhension|résolution|représentation)|le calcul)\s+(?=(les|le|la|l['’])[\s'’A-Za-zÀ-ÿ])/gi, "$1 de ");
  // contractions
  out = out.replace(/(^|[^A-Za-zÀ-ÿ])De\s+les\s/g, "$1Des ");
  out = out.replace(/(^|[^A-Za-zÀ-ÿ])de\s+les\s/gi, "$1des ");
  out = out.replace(/(^|[^A-Za-zÀ-ÿ])à\s+les\s/gi, "$1aux ");
  out = out.replace(/(^|[^A-Za-zÀ-ÿ])de\s+le\s/gi, "$1du ");
  out = out.replace(/(^|[^A-Za-zÀ-ÿ])à\s+le\s/gi, "$1au ");
  out = out.replace(/(^|[^A-Za-zÀ-ÿ])(des|du|aux|au)\s+(les|le|la)\s/gi, "$1$2 ");
  // élisions devant voyelle : « de acquis » → « d'acquis », « la évaluation » → « l'évaluation »
  out = out.replace(/(^|[^A-Za-zÀ-ÿ])(de|que|ne)\s+(?=[aeiouyéèêâîôûAEIOUYÉÈÊ])/g, (_m, b, w) => `${b}${w[0]}'`);
  out = out.replace(/(^|[^A-Za-zÀ-ÿ])(le|la)\s+(?=[aeiouyéèêâîôûAEIOUYÉÈÊ])/g, (_m, b, w) => `${b}${w[0] === "L" ? "L" : "l"}'`);
  // ponctuation française
  out = out.replace(/\s+([,.])/g, "$1").replace(/\s{2,}/g, " ");
  return out;
}

function fixArabic(s: string): string {
  let out = s;
  out = out.replace(/ـ(?=[ء-ي])/g, "");
  // « ل ال… » → « لل… », « ب ال… » → « بال… »
  out = out.replace(/(^|[\s(«])لـ?\s*ال/g, "$1لل");
  out = out.replace(/(^|[\s(«])([وفبك])ـ?\s+(?=[ء-ي])/g, "$1$2");
  out = out.replace(/\s{2,}/g, " ");
  return out;
}

function applyPostFixes(s: string, target: TransLang): string {
  let out = s;
  for (const [re, rep] of POST_FIXES[target]) out = out.replace(re, rep);
  return out;
}

const capitalizeFirst = (s: string, like: string) => {
  if (!s) return s;
  const srcStartsUpper = /^[A-ZÀ-Ý]/.test(like.trim());
  const first = s.charAt(0);
  return (srcStartsUpper || isArabic(like)) && /[a-zà-ÿ]/.test(first) ? first.toUpperCase() + s.slice(1) : s;
};

/* ------------------------------------------------------------------ */
/* Appel du service de traduction                                      */
/* ------------------------------------------------------------------ */

async function rawTranslate(texts: string[], source: TransLang, target: TransLang): Promise<string[]> {
  try {
    const { data, error } = await supabase.functions.invoke("translate-text", { body: { texts, source, target } });
    if (!error && Array.isArray(data?.translations) && data.translations.length === texts.length) {
      return data.translations.map((s: unknown) => String(s ?? ""));
    }
    if (error) console.warn("translate-text indisponible, repli navigateur :", error?.message || error);
  } catch (e) {
    console.warn("translate-text indisponible, repli navigateur :", e);
  }
  const out: string[] = [];
  for (const t of texts) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(t)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Translation HTTP ${res.status}`);
    const data = await res.json();
    out.push(((data && data[0]) || []).map((seg: any) => (seg && seg[0]) || "").join(""));
  }
  return out;
}

/**
 * Traduit une liste de textes avec le vocabulaire scientifique officiel
 * (maths, physique-chimie, SVT, pédagogie). Textes vides conservés, ordre préservé.
 */
export async function translateTexts(texts: string[], source: TransLang, target: TransLang): Promise<string[]> {
  if (source === target) return [...texts];
  const idx: number[] = [];
  const prepared: { text: string; terms: string[] }[] = [];
  texts.forEach((t, i) => {
    if (t && t.trim()) {
      idx.push(i);
      prepared.push(protect(t, source, target));
    }
  });
  const out = [...texts];
  if (prepared.length === 0) return out;

  const translated = await rawTranslate(prepared.map(p => p.text), source, target);

  // Si un jeton a été abîmé par le traducteur, on retraduit ce texte sans protection
  const retry: number[] = [];
  const results: string[] = translated.map((tr, k) => {
    const r = restore(tr, prepared[k].terms, target);
    if (!r.ok) retry.push(k);
    return r.text;
  });
  if (retry.length > 0) {
    const plain = await rawTranslate(retry.map(k => texts[idx[k]]), source, target);
    retry.forEach((k, j) => {
      let s = plain[j];
      if (target === "fr") s = fixFrench(s);
      if (target === "ar") s = fixArabic(s);
      results[k] = s;
    });
  }

  idx.forEach((pos, k) => {
    out[pos] = capitalizeFirst(applyPostFixes(results[k], target).trim(), texts[pos]);
  });
  return out;
}

/** Pour les tests : étapes internes */
export const __translateInternals = { protect, restore, fixFrench, fixArabic, applyPostFixes };

/**
 * Banque de questions du professeur (table question_bank) et questions à
 * paramètres aléatoires : un énoncé avec {a}, {b}… et une formule de réponse.
 * Chaque tirage donne des valeurs différentes, la bonne réponse est calculée
 * et des distracteurs plausibles sont proposés pour un QCM.
 */
import { supabase } from "@/integrations/supabase/client";
import { serializeQuestionText, parseQuestionText } from "@/contexts/CourseContext";

export type QType = "multiple_choice" | "true_false" | "short_answer";

export interface DraftOption {
  text: string;
  is_correct: boolean;
}

/** Question prête à insérer dans un quiz (énoncé HTML sans balise de durée) */
export interface DraftQuestion {
  question: string;
  question_type: QType;
  points: number;
  options: DraftOption[];
}

export interface ParamSpec {
  name: string;
  min: number;
  max: number;
  step: number;
}

export interface QuestionTemplate {
  params: ParamSpec[];
  answer: string;
  decimals: number;
  /** Unité ajoutée aux réponses (« cm », « € »…) */
  unit?: string;
}

export interface BankQuestion extends DraftQuestion {
  id: string;
  chapter: string | null;
  level: string | null;
  tags: string[];
  template: QuestionTemplate | null;
  times_used: number;
  created_at: string;
}

const db = () => supabase as any;

export async function loadBank(): Promise<BankQuestion[]> {
  const { data, error } = await db()
    .from("question_bank")
    .select("id, question, question_type, points, options, chapter, level, tags, template, times_used, created_at")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return (data || []) as BankQuestion[];
}

export async function saveToBank(items: (DraftQuestion & { chapter?: string | null; level?: string | null; tags?: string[]; template?: QuestionTemplate | null })[]) {
  if (!items.length) return;
  const { error } = await db().from("question_bank").insert(
    items.map((q) => ({
      question: q.question,
      question_type: q.question_type,
      points: q.points || 1,
      options: q.options,
      chapter: q.chapter?.trim() || null,
      level: q.level?.trim() || null,
      tags: q.tags || [],
      template: q.template || null,
    }))
  );
  if (error) throw error;
}

export async function markUsed(ids: string[], current: Map<string, number>) {
  await Promise.all(ids.map((id) => db().from("question_bank").update({ times_used: (current.get(id) || 0) + 1 }).eq("id", id)));
}

/** Question d'un quiz → brouillon (sans la durée par question) */
export function draftFromQuizQuestion(q: { question: string; question_type: string; points: number }, opts: { option_text: string; is_correct: boolean }[]): DraftQuestion {
  return {
    question: parseQuestionText(q.question).cleanText,
    question_type: (q.question_type as QType) || "multiple_choice",
    points: q.points || 1,
    options: opts.map((o) => ({ text: o.option_text, is_correct: !!o.is_correct })),
  };
}

/** Ajoute des questions à la fin d'un quiz (deux requêtes, annulées ensemble en cas d'échec) */
export async function insertIntoExam(examId: string, startOrder: number, items: DraftQuestion[]) {
  if (!items.length) return 0;
  const rows = items.map((q, i) => ({
    exam_id: examId,
    question: serializeQuestionText(q.question, null),
    question_type: q.question_type,
    points: q.points || 1,
    question_order: startOrder + i + 1,
  }));
  const { data, error } = await supabase.from("quiz_questions").insert(rows).select("id, question_order");
  if (error || !data) throw error || new Error("insert");
  const idByOrder = new Map<number, string>((data as any[]).map((r) => [r.question_order, r.id]));
  const optionRows = items.flatMap((q, i) => {
    const qid = idByOrder.get(startOrder + i + 1);
    if (!qid || q.question_type === "short_answer") return [];
    return q.options.map((o, idx) => ({ question_id: qid, option_text: o.text, is_correct: o.is_correct, option_order: idx + 1 }));
  });
  if (optionRows.length) {
    const { error: oe } = await supabase.from("quiz_options").insert(optionRows);
    if (oe) {
      await supabase.from("quiz_questions").delete().in("id", (data as any[]).map((r) => r.id));
      throw oe;
    }
  }
  return data.length;
}

/* ───────────────────────── Formules ───────────────────────── */

type Tok = { t: "n"; v: number } | { t: "id"; v: string } | { t: "op"; v: string } | { t: "(" } | { t: ")" } | { t: "," };

const FUNCS: Record<string, (...a: number[]) => number> = {
  sqrt: Math.sqrt, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil,
  min: Math.min, max: Math.max, pow: Math.pow, sin: Math.sin, cos: Math.cos, tan: Math.tan,
  ln: Math.log, log: Math.log10, exp: Math.exp,
  pgcd: (a, b) => gcd(a, b), gcd: (a, b) => gcd(a, b),
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };

function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) [a, b] = [b, a % b];
  return a;
}

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  const s = src.replace(/×/g, "*").replace(/÷/g, "/").replace(/,(?=\d)/g, ".").replace(/√/g, "sqrt");
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[\d.]/.test(c)) {
      let j = i;
      while (j < s.length && /[\d.]/.test(s[j])) j++;
      out.push({ t: "n", v: parseFloat(s.slice(i, j)) });
      i = j;
    } else if (/[a-zA-Z_]/.test(c)) {
      let j = i;
      while (j < s.length && /[a-zA-Z_0-9]/.test(s[j])) j++;
      out.push({ t: "id", v: s.slice(i, j).toLowerCase() });
      i = j;
    } else if ("+-*/^%".includes(c)) { out.push({ t: "op", v: c }); i++; }
    else if (c === "(") { out.push({ t: "(" }); i++; }
    else if (c === ")") { out.push({ t: ")" }); i++; }
    else if (c === ";" || c === ",") { out.push({ t: "," }); i++; }
    else throw new Error(`Caractère inattendu « ${c} »`);
  }
  return out;
}

/** Évalue une formule (sans eval) : + - * / ^ %, parenthèses, fonctions usuelles, variables */
export function evaluate(expr: string, vars: Record<string, number>): number {
  const toks = tokenize(expr);
  let p = 0;
  const peek = () => toks[p];
  const expect = (t: Tok["t"]) => {
    if (toks[p]?.t !== t) throw new Error("Formule incomplète");
    p++;
  };
  const primary = (): number => {
    const k = toks[p++];
    if (!k) throw new Error("Formule incomplète");
    if (k.t === "n") return k.v;
    if (k.t === "(") { const v = sum(); expect(")"); return v; }
    if (k.t === "op" && k.v === "-") return -power();
    if (k.t === "op" && k.v === "+") return power();
    if (k.t === "id") {
      if (peek()?.t === "(") {
        const f = FUNCS[k.v];
        if (!f) throw new Error(`Fonction inconnue « ${k.v} »`);
        p++;
        const args = [sum()];
        while (peek()?.t === ",") { p++; args.push(sum()); }
        expect(")");
        return f(...args);
      }
      if (k.v in vars) return vars[k.v];
      if (k.v in CONSTS) return CONSTS[k.v];
      throw new Error(`Variable inconnue « ${k.v} »`);
    }
    throw new Error("Formule invalide");
  };
  const power = (): number => {
    const b = primary();
    const k = peek();
    if (k?.t === "op" && k.v === "^") { p++; return Math.pow(b, unary()); }
    return b;
  };
  const unary = (): number => {
    const k = peek();
    if (k?.t === "op" && k.v === "-") { p++; return -unary(); }
    return power();
  };
  const product = (): number => {
    let v = unary();
    for (;;) {
      const k = peek();
      if (k?.t === "op" && (k.v === "*" || k.v === "/" || k.v === "%")) {
        p++;
        const r = unary();
        v = k.v === "*" ? v * r : k.v === "/" ? v / r : v % r;
      } else if (k && (k.t === "n" || k.t === "id" || k.t === "(")) {
        v *= unary(); // multiplication implicite : 2a, 3(x+1)
      } else return v;
    }
  };
  const sum = (): number => {
    let v = product();
    for (;;) {
      const k = peek();
      if (k?.t === "op" && (k.v === "+" || k.v === "-")) { p++; const r = product(); v = k.v === "+" ? v + r : v - r; }
      else return v;
    }
  };
  const v = sum();
  if (p < toks.length) throw new Error("Formule invalide");
  return v;
}

/** Noms des paramètres utilisés dans un énoncé : {a}, {b}… */
export function paramNames(text: string): string[] {
  const s = new Set<string>();
  (text.match(/\{([a-zA-Z]\w*)\}/g) || ([] as string[])).forEach((m: string) => s.add(m.slice(1, -1).toLowerCase()));
  return [...s];
}

const roundTo = (v: number, d: number) => {
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
};
export const fmtNum = (v: number, decimals: number, lang: "fr" | "ar" | "en") => {
  const s = roundTo(v, decimals).toString();
  return lang === "en" ? s : s.replace(".", ",");
};

function pick(spec: ParamSpec, rnd: () => number) {
  const step = spec.step > 0 ? spec.step : 1;
  const n = Math.max(0, Math.floor((spec.max - spec.min) / step + 1e-9));
  return roundTo(spec.min + Math.floor(rnd() * (n + 1)) * step, 6);
}

/** Distracteurs plausibles autour de la bonne réponse (erreurs fréquentes) */
function distractors(correct: number, vars: Record<string, number>, decimals: number, count: number, rnd: () => number): number[] {
  const vals = Object.values(vars);
  const allPositive = correct > 0 && vals.every((v) => v >= 0);
  // Erreurs « de raisonnement » d'abord (dans un ordre aléatoire), puis des voisins proches
  const main = [
    correct * 2, correct / 2, correct * 10, correct / 10, correct + 1, correct - 1,
    ...vals.map((v) => correct + v), ...vals.map((v) => correct - v), ...vals.map((v) => correct * v),
    ...(allPositive ? [] : [-correct]),
  ].sort(() => rnd() - 0.5);
  const step = Math.max(Math.pow(10, -decimals), Math.abs(correct) >= 10 ? Math.round(Math.abs(correct) / 10) : 1);
  const near = [1, -1, 2, -2, 3, -3, 4, -4, 5, -5].map((k) => correct + k * step);
  const out: number[] = [];
  const seen = new Set([roundTo(correct, decimals)]);
  for (const raw of [...main, ...near]) {
    if (out.length >= count) break;
    const c = roundTo(raw, decimals);
    if (!Number.isFinite(c) || seen.has(c) || (allPositive && c <= 0)) continue;
    seen.add(c);
    out.push(c);
  }
  for (let k = 6; out.length < count; k++) out.push(roundTo(correct + k * step, decimals));
  return out;
}

export interface Variant {
  vars: Record<string, number>;
  question: DraftQuestion;
  answer: number;
}

/** Tire `count` variantes différentes d'un modèle */
export function generateVariants(
  statementHtml: string,
  tpl: QuestionTemplate,
  opts: { count: number; type: "multiple_choice" | "short_answer"; points: number; choices: number; lang: "fr" | "ar" | "en"; seed?: number }
): Variant[] {
  let seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rnd = () => {
    // mulberry32 : reproductible avec la même graine
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out: Variant[] = [];
  const seen = new Set<string>();
  const unit = tpl.unit?.trim() ? ` ${tpl.unit.trim()}` : "";
  for (let tries = 0; out.length < opts.count && tries < opts.count * 40; tries++) {
    const vars: Record<string, number> = {};
    tpl.params.forEach((ps) => (vars[ps.name.toLowerCase()] = pick(ps, rnd)));
    const key = JSON.stringify(vars);
    if (seen.has(key)) continue;
    let ans: number;
    try {
      ans = evaluate(tpl.answer, vars);
    } catch {
      throw new Error("FORMULA");
    }
    if (!Number.isFinite(ans)) continue; // division par zéro…
    seen.add(key);
    ans = roundTo(ans, tpl.decimals);
    const text = statementHtml.replace(/\{([a-zA-Z]\w*)\}/g, (m, n) => {
      const v = vars[String(n).toLowerCase()];
      return v === undefined ? m : fmtNum(v, 6, opts.lang);
    });
    const options: DraftOption[] =
      opts.type === "multiple_choice"
        ? [ans, ...distractors(ans, vars, tpl.decimals, Math.max(1, opts.choices - 1), rnd)]
            .map((v, i) => ({ text: fmtNum(v, tpl.decimals, opts.lang) + unit, is_correct: i === 0, r: rnd() }))
            .sort((a, b) => a.r - b.r)
            .map(({ text: t, is_correct }) => ({ text: t, is_correct }))
        : [];
    out.push({ vars, answer: ans, question: { question: text, question_type: opts.type, points: opts.points, options } });
  }
  return out;
}

/** Texte brut d'un énoncé HTML (aperçus, recherche) */
export const plainText = (html: string) =>
  (html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

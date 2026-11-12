/**
 * Petit analyseur d'expressions mathématiques, sans eval : z = f(x, y).
 * Accepte + - * / ^, parenthèses, multiplication implicite (2x, 3(x+1), x y),
 * constantes pi et e, variables x, y, a, b, t et les fonctions usuelles.
 */
type Fn = (v: Record<string, number>) => number;

const FUNCS: Record<string, (x: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  sqrt: Math.sqrt, racine: Math.sqrt, abs: Math.abs, exp: Math.exp, ln: Math.log, log: Math.log10,
  floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign,
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };
export const EXPR_VARS = ["x", "y", "a", "b", "t"];

type Tok = { k: "num"; v: number } | { k: "id"; v: string } | { k: "op"; v: string };

function tokenize(src: string): Tok[] {
  const s = src.toLowerCase().replace(/π/g, "pi").replace(/\s+/g, " ").replace(/,/g, ".").replace(/×/g, "*").replace(/÷/g, "/").replace(/²/g, "^2").replace(/³/g, "^3");
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === " ") { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const v = Number(s.slice(i, j));
      if (!Number.isFinite(v)) throw new Error(`Nombre invalide : ${s.slice(i, j)}`);
      out.push({ k: "num", v });
      i = j;
      continue;
    }
    if (/[a-z]/.test(c)) {
      let j = i;
      while (j < s.length && /[a-z]/.test(s[j])) j++;
      let word = s.slice(i, j);
      // découpe « xy » en x * y, « sinx » en sin x
      while (word) {
        const fn = Object.keys(FUNCS).sort((p, q) => q.length - p.length).find((f) => word.startsWith(f));
        const cst = Object.keys(CONSTS).sort((p, q) => q.length - p.length).find((f) => word.startsWith(f));
        const pick = fn || cst || (EXPR_VARS.includes(word[0]) ? word[0] : null);
        if (!pick) throw new Error(`Inconnu : « ${word} »`);
        out.push({ k: "id", v: pick });
        word = word.slice(pick.length);
      }
      i = j;
      continue;
    }
    if ("+-*/^()".includes(c)) {
      out.push({ k: "op", v: c });
      i++;
      continue;
    }
    throw new Error(`Caractère inattendu : « ${c} »`);
  }
  return out;
}

export function compileExpr(src: string): Fn {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => peek()?.k === "op" && peek()!.v === v;
  const startsFactor = () => {
    const t = peek();
    return !!t && (t.k === "num" || t.k === "id" || (t.k === "op" && t.v === "("));
  };

  const expr = (): Fn => {
    let left = term();
    while (isOp("+") || isOp("-")) {
      const op = (toks[p++] as any).v;
      const r = term(), l = left;
      left = op === "+" ? (v) => l(v) + r(v) : (v) => l(v) - r(v);
    }
    return left;
  };
  const term = (): Fn => {
    let left = unary();
    for (;;) {
      if (isOp("*") || isOp("/")) {
        const op = (toks[p++] as any).v;
        const r = unary(), l = left;
        left = op === "*" ? (v) => l(v) * r(v) : (v) => l(v) / r(v);
      } else if (startsFactor()) {
        const r = power(), l = left; // multiplication implicite
        left = (v) => l(v) * r(v);
      } else return left;
    }
  };
  const unary = (): Fn => {
    if (isOp("-")) { p++; const f = unary(); return (v) => -f(v); }
    if (isOp("+")) { p++; return unary(); }
    return power();
  };
  const power = (): Fn => {
    const base = atom();
    if (isOp("^")) {
      p++;
      const ex = unary();
      return (v) => Math.pow(base(v), ex(v));
    }
    return base;
  };
  const atom = (): Fn => {
    const t = toks[p++];
    if (!t) throw new Error("Expression incomplète");
    if (t.k === "num") return () => t.v;
    if (t.k === "op" && t.v === "(") {
      const e = expr();
      if (!isOp(")")) throw new Error("Parenthèse fermante manquante");
      p++;
      return e;
    }
    if (t.k === "id") {
      if (FUNCS[t.v]) {
        const f = FUNCS[t.v];
        const arg = isOp("(") ? atom() : power();
        return (v) => f(arg(v));
      }
      if (t.v in CONSTS) { const c = CONSTS[t.v]; return () => c; }
      const name = t.v;
      return (v) => v[name] ?? 0;
    }
    throw new Error(`Symbole inattendu : « ${t.v} »`);
  };

  const f = expr();
  if (p < toks.length) throw new Error(`Symbole inattendu : « ${(toks[p] as any).v} »`);
  return f;
}

/** Version sûre : renvoie null et le message d'erreur si l'expression est invalide */
export function tryCompile(src: string): { fn: Fn | null; error: string | null } {
  try {
    const fn = compileExpr(src);
    fn({ x: 0.5, y: 0.5, a: 1, b: 1, t: 0 });
    return { fn, error: null };
  } catch (e: any) {
    return { fn: null, error: String(e?.message || e) };
  }
}

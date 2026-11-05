/**
 * Écriture mathématique « simple » (sans LaTeX) → LaTeX, pour professeurs et élèves.
 *
 * Règle unique : LES PARENTHÈSES DÉLIMITENT.
 *   √(32)×5      → racine de 32, puis × 5          (\sqrt{32}\times 5)
 *   √(32×5)      → racine de 32×5                    (\sqrt{32\times 5})
 *   (x+1)/(x−2)  → fraction                           (\frac{x+1}{x-2})
 *   x^(n+1)      → puissance                          (x^{n+1})
 *   u_(n+1)      → indice                             (u_{n+1})
 *   √[3](x+1)    → racine cubique                     (\sqrt[3]{x+1})
 *   lim(x→+∞)    → limite                             (\lim_{x\to+\infty})
 *   ∫(0,1)  Σ(k=0,n)  vec(AB)  |x−1|  ln(x)  …
 * Les parenthèses qui servent seulement à délimiter (après √, ^, /, _) ne sont pas affichées :
 * la barre de la racine, la barre de fraction ou l'exposant couvrent exactement leur contenu.
 */

const SYMBOLS: Record<string, string> = {
  "×": "\\times ", "*": "\\times ", "÷": "\\div ", "±": "\\pm ", "∓": "\\mp ", "·": "\\cdot ",
  "−": "-", "≤": "\\leq ", "≥": "\\geq ", "≠": "\\neq ", "≈": "\\approx ", "≡": "\\equiv ",
  "∞": "\\infty ", "π": "\\pi ", "°": "^{\\circ}",
  "ℕ": "\\mathbb{N}", "ℤ": "\\mathbb{Z}", "ℚ": "\\mathbb{Q}", "ℝ": "\\mathbb{R}", "ℂ": "\\mathbb{C}",
  "∈": "\\in ", "∉": "\\notin ", "⊂": "\\subset ", "⊄": "\\not\\subset ", "∪": "\\cup ", "∩": "\\cap ", "∅": "\\emptyset ",
  "∀": "\\forall ", "∃": "\\exists ", "⇒": "\\Rightarrow ", "⇔": "\\Leftrightarrow ", "→": "\\to ", "⇌": "\\rightleftharpoons ", "↦": "\\mapsto ",
  "⊥": "\\perp ", "∥": "\\parallel ", "‖": "\\| ", "∠": "\\angle ", "△": "\\triangle ",
  "α": "\\alpha ", "β": "\\beta ", "γ": "\\gamma ", "δ": "\\delta ", "Δ": "\\Delta ", "ε": "\\varepsilon ",
  "θ": "\\theta ", "λ": "\\lambda ", "μ": "\\mu ", "ρ": "\\rho ", "σ": "\\sigma ", "τ": "\\tau ",
  "φ": "\\varphi ", "ω": "\\omega ", "Ω": "\\Omega ", "Σ": "\\sum ", "∫": "\\int ", "∂": "\\partial ",
  "′": "'", "%": "\\% ", "#": "\\# ", "&": "\\& ", "$": "\\$ ", "{": "\\{", "}": "\\}", "~": "\\sim ",
  "<": "<", ">": ">", "=": "=", "+": "+", "-": "-", ",": ",", ";": ";", ":": ":", "!": "!", ".": ".", "'": "'",
  "[": "[", "]": "]", "|": "|",
};
const SUPERSCRIPTS: Record<string, string> = { "²": "2", "³": "3", "¹": "1", "⁰": "0", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "ⁿ": "n", "⁻": "-" };
const FUNCS = ["arcsin", "arccos", "arctan", "sinh", "cosh", "tanh", "sin", "cos", "tan", "cot", "ln", "log", "exp", "lim", "max", "min", "sup", "inf", "det", "deg", "dim", "ker", "gcd", "pgcd", "ppcm"];
const KNOWN_LATEX = new Set(["sin", "cos", "tan", "cot", "ln", "log", "exp", "lim", "max", "min", "sup", "inf", "det", "deg", "dim", "ker", "gcd", "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh"]);

interface Node { latex: string; inner: string; }
const node = (latex: string, inner = latex): Node => ({ latex, inner });

class Parser {
  i = 0;
  /** dans f(a, b) la virgule sépare les arguments (pas de virgule décimale) */
  argDepth = 0;
  constructor(private s: string) {}

  peek(n = 0) { return this.s[this.i + n]; }
  eof() { return this.i >= this.s.length; }

  /** Suite d'éléments jusqu'à `stop` (non consommé) */
  seq(stop?: string): string {
    const out: Node[] = [];
    while (!this.eof()) {
      const c = this.peek();
      if (stop && stop.includes(c)) break;
      if (c === "/" && out.length) {
        this.i++;
        this.skipSpaces();
        const den = this.postfix(this.atom());
        const num = out.pop()!;
        out.push(node(`\\frac{${num.inner}}{${den.inner}}`));
        continue;
      }
      const a = this.atom();
      if (a) out.push(this.postfix(a));
    }
    return out.map(n => n.latex).join("");
  }

  skipSpaces() { while (this.peek() === " ") this.i++; }

  /** Exposants / indices collés à un élément */
  postfix(base: Node | null): Node {
    let b = base || node("");
    for (;;) {
      const c = this.peek();
      if (c === "^" || c === "_") {
        this.i++;
        // ℝ^*  ℝ_+  : étoile / signe gardés tels quels en exposant ou indice
        const nx = this.peek();
        let v: string;
        if (nx === "*" || nx === "+" || nx === "-" || nx === "−") {
          this.i++;
          v = nx === "−" ? "-" : nx;
          // x^-1 , x^−(n+1) : le signe suit l'exposant
          if ((v === "-" || v === "+") && /[0-9A-Za-z(√]/.test(this.peek() || "")) {
            const arg = this.atom();
            v += arg ? arg.latex : ""; // x^−(n+1) garde ses parenthèses : x^{-(n+1)}
          }
        } else {
          const arg = this.atom();
          v = arg ? arg.inner : "";
        }
        b = node(`${b.latex}${c}{${v}}`);
      } else if (c && SUPERSCRIPTS[c] !== undefined) {
        let sup = "";
        while (this.peek() && SUPERSCRIPTS[this.peek()] !== undefined) sup += SUPERSCRIPTS[this.s[this.i++]];
        b = node(`${b.latex}^{${sup}}`);
      } else if (c === "!" ) {
        this.i++;
        b = node(`${b.latex}!`);
      } else break;
    }
    return b;
  }

  /** Groupe ( … ) : parenthèses affichées, contenu disponible sans parenthèses */
  group(open: string, close: string): Node {
    this.i++; // open
    const inner = this.seq(close);
    if (this.peek() === close) this.i++;
    const L = open === "(" ? "\\left(" : open === "[" ? "\\left[" : "\\left\\{";
    const R = close === ")" ? "\\right)" : close === "]" ? "\\right]" : "\\right\\}";
    return node(`${L}${inner}${R}`, inner);
  }

  /** Argument d'une fonction : (…) sans parenthèses affichées, sinon un seul élément */
  arg(): string {
    this.skipSpaces();
    if (this.peek() === "(") return this.group("(", ")").inner;
    const a = this.atom();
    return a ? this.postfix(a).inner : "";
  }

  /** Arguments séparés par des virgules : f(a, b) */
  args(): string[] {
    this.skipSpaces();
    if (this.peek() !== "(") return [];
    this.i++;
    const parts: string[] = [];
    let cur = "";
    this.argDepth++;
    for (;;) {
      cur = this.seq(",;)");
      parts.push(cur.replace(/^(\\ )+|(\\ )+$/g, "").trim());
      if (this.peek() === "," || this.peek() === ";") { this.i++; continue; }
      if (this.peek() === ")") this.i++;
      break;
    }
    this.argDepth--;
    return parts;
  }

  atom(): Node | null {
    if (this.eof()) return null;
    const s = this.s;
    const c = this.peek();

    // espaces : conservés (texte et maths mélangés)
    if (c === " " || c === "\t") {
      while (this.peek() === " " || this.peek() === "\t") this.i++;
      return node("\\ ");
    }
    if (c === "\n") { this.i++; return node("\\\\ "); }

    if (c === "(") return this.group("(", ")");
    if (c === "{") return this.group("{", "}");

    // racines
    if (c === "√" || s.startsWith("sqrt", this.i) || s.startsWith("racine", this.i)) {
      this.i += c === "√" ? 1 : s.startsWith("sqrt", this.i) ? 4 : 6;
      let index = "";
      if (this.peek() === "[") {
        this.i++;
        index = this.seq("]");
        if (this.peek() === "]") this.i++;
      }
      const a = this.arg();
      return node(index ? `\\sqrt[${index}]{${a}}` : `\\sqrt{${a}}`);
    }
    if (c === "∛" || c === "∜") {
      this.i++;
      return node(`\\sqrt[${c === "∛" ? 3 : 4}]{${this.arg()}}`);
    }

    // valeur absolue |…|
    if (c === "|") {
      const end = s.indexOf("|", this.i + 1);
      if (end > this.i + 1) {
        const inner = new Parser(s.slice(this.i + 1, end)).seq();
        this.i = end + 1;
        return node(`\\left|${inner}\\right|`);
      }
      this.i++;
      return node("|");
    }

    // nombres (virgule ou point décimal)
    if (/[0-9]/.test(c)) {
      let n = "";
      while (/[0-9]/.test(this.peek() || "") || (((this.peek() === "," && this.argDepth === 0) || this.peek() === ".") && /[0-9]/.test(this.peek(1) || ""))) {
        const ch = this.s[this.i++];
        n += ch === "," ? "{,}" : ch;
      }
      return node(n);
    }

    // mots : fonctions, constructions spéciales, variables, texte
    if (/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(c)) {
      let w = "";
      while (/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(this.peek() || "")) w += this.s[this.i++];
      if (/^d[a-z]$/.test(w) && w !== "de") return node(`\\,${w}`); // dx, dt, dy
      const lower = w.toLowerCase();
      if (lower === "lim") {
        const a = this.args();
        return node(a.length ? `\\lim_{${a[0]}}` : "\\lim");
      }
      if (lower === "vec") return node(`\\overrightarrow{${this.arg()}}`);
      if (lower === "bar") return node(`\\overline{${this.arg()}}`);
      if (lower === "int" || lower === "integrale") {
        const a = this.args();
        return node(a.length >= 2 ? `\\int_{${a[0]}}^{${a[1]}}` : "\\int ");
      }
      if (lower === "sum" || lower === "somme") {
        const a = this.args();
        return node(a.length >= 2 ? `\\sum_{${a[0]}}^{${a[1]}}` : "\\sum ");
      }
      if (lower === "pi") return node("\\pi ");
      if (lower === "inf" && !/[A-Za-z]/.test(this.peek() || "")) return node("\\infty ");
      if (FUNCS.includes(lower)) {
        const name = KNOWN_LATEX.has(lower) ? `\\${lower}` : `\\operatorname{${lower}}`;
        // ln(x) forme un seul bloc : ln(x)/x → fraction de ln(x) par x
        if (this.peek() === "(") {
          const g = this.group("(", ")");
          return node(`${name}${g.latex}`);
        }
        return node(`${name} `);
      }
      // une lettre (x, f) ou deux majuscules (AB) = variables ; sinon mot du texte
      return (w.length === 1 && /[A-Za-z]/.test(w)) || /^[A-Z]{2,3}$/.test(w) ? node(w) : node(`\\text{${w}}`);
    }

    // ∫(a,b) et Σ(k=0,n) avec bornes
    if ((c === "∫" || c === "Σ") && this.peek(1) === "(") {
      this.i++;
      const a = this.args();
      const cmd = c === "∫" ? "\\int" : "\\sum";
      return node(a.length >= 2 ? `${cmd}_{${a[0]}}^{${a[1]}}` : `${cmd} `);
    }

    if (SYMBOLS[c] !== undefined) {
      this.i++;
      return node(SYMBOLS[c]);
    }
    if (c === "\\") { this.i++; return node("\\backslash "); }
    if (c === "^" || c === "_") { this.i++; return node(""); }

    // tout autre caractère (arabe, accents…) : texte
    let t = "";
    while (!this.eof()) {
      const ch = this.peek();
      if (/[A-Za-zÀ-ÖØ-öø-ÿ0-9\s]/.test(ch) || SYMBOLS[ch] !== undefined || "()√∛∜^_/".includes(ch) || SUPERSCRIPTS[ch] !== undefined) break;
      t += ch;
      this.i++;
    }
    if (!t) { this.i++; return node(""); }
    return node(`\\text{${t}}`);
  }
}

/** Convertit l'écriture simple en LaTeX (KaTeX). */
export function simpleToLatex(input: string): string {
  try {
    return new Parser(input.replace(/\r/g, "")).seq().replace(/(\\ )+$/g, "").trim();
  } catch {
    return input;
  }
}

/** Le texte contient-il de l'écriture mathématique à mettre en forme ? */
export const looksMathy = (s: string | null | undefined) =>
  !!s && /[√∛∜^_/²³ⁿ×÷±≤≥≠≈∞πℕℤℚℝℂ∈∉⊂∪∩∅∀∃⇒⇔→∫Σ|]|\b(sqrt|lim|vec|ln|cos|sin|tan)\s*\(/.test(s);

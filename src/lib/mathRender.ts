/**
 * Formules mathématiques (LaTeX) dans les quiz : $…$ (dans la ligne) et $$…$$ (centrée).
 * KaTeX est chargé à la demande depuis cdnjs (même principe que html2pdf) :
 * aucun poids ajouté au site tant qu'aucune formule n'est affichée.
 * Si le chargement échoue (hors ligne), le texte LaTeX reste lisible tel quel.
 */

const KATEX_VERSION = "0.16.9";
const BASE = `https://cdnjs.cloudflare.com/ajax/libs/KaTeX/${KATEX_VERSION}`;

let katexPromise: Promise<any> | null = null;

export function loadKatex(): Promise<any> {
  if ((window as any).katex) return Promise.resolve((window as any).katex);
  if (katexPromise) return katexPromise;
  katexPromise = new Promise((resolve, reject) => {
    if (!document.getElementById("katex-css")) {
      const link = document.createElement("link");
      link.id = "katex-css";
      link.rel = "stylesheet";
      link.href = `${BASE}/katex.min.css`;
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = `${BASE}/katex.min.js`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => ((window as any).katex ? resolve((window as any).katex) : reject(new Error("KaTeX indisponible")));
    script.onerror = () => {
      katexPromise = null;
      reject(new Error("Impossible de charger KaTeX"));
    };
    document.head.appendChild(script);
  });
  return katexPromise;
}

/** Le texte contient-il une formule ? */
export const hasMath = (text: string | null | undefined) => !!text && /\$[^$]+\$|\\\(|\\\[/.test(text);

/** Rendu d'une formule seule (aperçu de l'éditeur). */
export function renderLatexToString(katex: any, latex: string, displayMode = false): string {
  try {
    return katex.renderToString(latex, { displayMode, throwOnError: false, strict: "ignore", output: "htmlAndMathml" });
  } catch {
    return latex;
  }
}

// $$…$$ | \[…\] | $…$ | \(…\)   (un $ précédé de \ est un vrai dollar)
const MATH_RE = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|(?:^|[^\\])\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)/g;

/** Découpe un texte en morceaux texte / formule. */
export function splitMath(text: string): { t: "text" | "math"; v: string; display?: boolean }[] {
  const out: { t: "text" | "math"; v: string; display?: boolean }[] = [];
  let last = 0;
  MATH_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MATH_RE.exec(text))) {
    let start = m.index;
    const whole = m[0];
    // le groupe « (?:^|[^\\]) » peut avoir consommé un caractère avant le $
    let lead = "";
    if (m[3] !== undefined && whole[0] !== "$") {
      lead = whole[0];
      start += 1;
    }
    if (start > last || lead) out.push({ t: "text", v: text.slice(last, start) });
    const display = m[1] !== undefined || m[2] !== undefined;
    out.push({ t: "math", v: (m[1] ?? m[2] ?? m[3] ?? m[4] ?? "").trim(), display });
    last = m.index + whole.length;
  }
  if (last < text.length) out.push({ t: "text", v: text.slice(last) });
  return out.filter(p => p.v !== "");
}

/**
 * Remplace les formules dans les nœuds texte d'un élément (contenu HTML de l'éditeur, options…).
 * Ne touche pas aux balises : uniquement aux textes.
 */
export async function renderMathInElement(root: HTMLElement | null): Promise<void> {
  if (!root || !hasMath(root.textContent)) return;
  let katex: any;
  try {
    katex = await loadKatex();
  } catch {
    return;
  }
  // Un même paragraphe peut couper une formule en plusieurs nœuds (gras, etc.) :
  // on traite chaque nœud texte qui contient au moins une formule complète.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      const p = (n as Text).parentElement;
      if (!p || p.closest(".katex, code, pre, textarea, script, style")) return NodeFilter.FILTER_REJECT;
      return hasMath(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  } as any);
  const nodes: Text[] = [];
  let cur = walker.nextNode();
  while (cur) {
    nodes.push(cur as Text);
    cur = walker.nextNode();
  }
  for (const node of nodes) {
    const parts = splitMath(node.nodeValue || "");
    if (!parts.some(p => p.t === "math")) continue;
    const frag = document.createDocumentFragment();
    for (const p of parts) {
      if (p.t === "text") {
        frag.appendChild(document.createTextNode(p.v));
      } else {
        const span = document.createElement("span");
        span.className = p.display ? "math-display" : "math-inline";
        span.setAttribute("data-latex", p.v);
        span.innerHTML = renderLatexToString(katex, p.v, !!p.display);
        frag.appendChild(span);
      }
    }
    node.parentNode?.replaceChild(frag, node);
  }
}

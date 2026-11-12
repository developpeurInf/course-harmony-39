/**
 * Nettoyage du HTML écrit dans l'éditeur (énoncés, cours, questions) avant
 * affichage : on garde la mise en forme, on retire tout ce qui peut exécuter
 * du code (scripts, attributs on…, liens javascript:, iframes…).
 * DOMParser ne charge ni images ni scripts : l'analyse est sans effet.
 */

const ALLOWED_TAGS = new Set([
  "a", "b", "blockquote", "br", "code", "div", "em", "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6",
  "hr", "i", "img", "li", "mark", "ol", "p", "pre", "s", "small", "span", "strike", "strong", "sub", "sup",
  "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul", "del", "ins", "caption", "colgroup", "col",
]);

// Contenu supprimé entièrement (avec ses enfants)
const DROP_TAGS = new Set(["script", "style", "iframe", "object", "embed", "noscript", "template", "form", "input", "button", "textarea", "select", "link", "meta", "base", "svg", "math", "frame", "frameset"]);

const ALLOWED_ATTRS = new Set([
  "href", "src", "alt", "title", "class", "style", "dir", "lang", "width", "height", "colspan", "rowspan",
  "align", "target", "rel", "data-type", "data-latex", "data-display", "start", "type",
]);

const SAFE_URL = /^(https?:|mailto:|tel:|data:image\/(png|jpe?g|gif|webp);|\/|#|\.)/i;
const UNSAFE_STYLE = /expression\s*\(|url\s*\(\s*['"]?\s*javascript:|behavior\s*:|-moz-binding/i;

const cleanNode = (node: Element) => {
  for (const child of Array.from(node.children)) {
    const tag = child.tagName.toLowerCase();
    if (DROP_TAGS.has(tag)) {
      child.remove();
      continue;
    }
    if (!ALLOWED_TAGS.has(tag)) {
      // balise inconnue : on garde son contenu
      cleanNode(child);
      child.replaceWith(...Array.from(child.childNodes));
      continue;
    }
    for (const attr of Array.from(child.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();
      if (!ALLOWED_ATTRS.has(name)) child.removeAttribute(attr.name);
      else if ((name === "href" || name === "src") && !SAFE_URL.test(value.replace(/[\s\u0000-\u001f]/g, ""))) child.removeAttribute(attr.name);
      else if (name === "style" && UNSAFE_STYLE.test(value)) child.removeAttribute(attr.name);
    }
    if (tag === "a") {
      child.setAttribute("rel", "noopener noreferrer");
      if (child.getAttribute("target") && child.getAttribute("target") !== "_blank") child.removeAttribute("target");
    }
    cleanNode(child);
  }
};

const cache = new Map<string, string>();

export function sanitizeHtml(html: string | null | undefined): string {
  const src = html || "";
  if (!src) return "";
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    // côté serveur : texte seul
    return src.replace(/<[^>]*>/g, "");
  }
  const hit = cache.get(src);
  if (hit !== undefined) return hit;
  const doc = new DOMParser().parseFromString(`<body>${src}</body>`, "text/html");
  cleanNode(doc.body);
  const out = doc.body.innerHTML;
  if (cache.size > 500) cache.clear();
  cache.set(src, out);
  return out;
}

/** Texte brut d'un contenu HTML, sans jamais l'exécuter */
export function htmlToText(html: string | null | undefined): string {
  const src = (html || "").replace(/<!--[\s\S]*?-->/g, "");
  if (!src) return "";
  if (typeof DOMParser === "undefined") return src.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const doc = new DOMParser().parseFromString(`<body>${src}</body>`, "text/html");
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
}

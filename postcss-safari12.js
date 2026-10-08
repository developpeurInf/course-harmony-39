/**
 * postcss-safari12 — compatibilité CSS pour iPad iOS 12 (Safari 12.1) et vieux Android.
 * -------------------------------------------------------------------------------------
 * Tailwind 3.4 génère des sélecteurs que Safari 12 ne comprend pas. Un sélecteur
 * inconnu invalide TOUTE la règle, donc sur iPad iOS 12 :
 *   1. `dark:`  → `.x:is(.dark *)`                      : le mode sombre ne s'applique pas
 *   2. `rtl:`   → `.x:where([dir=rtl],[dir=rtl] *)`     : la mise en page arabe est cassée
 *   3. preflight `button,input:where([type=button])…`   : les boutons gardent le fond gris iOS
 *   4. `gap-*` sur un conteneur flex (Safari ≥ 14.1)     : éléments collés, sans espacement
 *
 * Ce plugin réécrit 1-3 avec des sélecteurs équivalents compatibles, et ajoute pour 4
 * des règles de repli appliquées UNIQUEMENT quand <html> porte la classe `no-flex-gap`
 * (posée par un petit test dans index.html). Les navigateurs récents ne sont pas touchés.
 */

const DARK_RE = /:is\(\s*\.dark\s+\*\s*\)/g;
const DIR_RE = /:where\(\s*\[dir=(["']?)(rtl|ltr)\1\]\s*,\s*\[dir=\1\2\1\]\s+\*\s*\)/g;
// :where(<sélecteur simple sans virgule ni parenthèse imbriquée>) sur un élément (preflight)
const SIMPLE_WHERE_RE = /:where\(((?:[^(),]|\([^()]*\))+)\)/g;

const FLEX_ROW_DECL = (value) => [
  ["-webkit-margin-start", value],
  ["margin-inline-start", value],
];

function splitTopLevel(selector) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const ch of selector) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function rewriteSelector(sel) {
  let s = sel;
  let prefix = "";
  if (DARK_RE.test(s)) {
    s = s.replace(DARK_RE, "");
    prefix += ".dark ";
  }
  DARK_RE.lastIndex = 0;
  const dirMatch = s.match(DIR_RE);
  if (dirMatch) {
    const dir = /rtl/.test(dirMatch[0]) ? "rtl" : "ltr";
    s = s.replace(DIR_RE, "");
    prefix = `[dir="${dir}"] ` + prefix;
  }
  // Preflight : `input:where([type=button])`, `abbr:where([title])`, `[hidden]:where(:not(...))`
  // → uniquement quand le sélecteur commence par un élément/attribut (jamais une classe utilitaire)
  if (/^[a-z\[]/i.test(s) && s.includes(":where(")) {
    s = s.replace(SIMPLE_WHERE_RE, (_m, inner) => (/^\[/.test(inner) || /^:/.test(inner) ? inner : _m));    // `input[type=button]` aurait une spécificité trop forte face aux utilitaires (bg-primary…)
    s = s.replace(/^input(\[type=[^\]]+\])$/, "$1");
  }
  return prefix + s;
}

function parseGap(decls) {
  let col = null;
  let row = null;
  for (const d of decls) {
    if (d.prop === "gap" || d.prop === "grid-gap") {
      const parts = d.value.trim().split(/\s+/);
      row = parts[0];
      col = parts[1] || parts[0];
    } else if (d.prop === "column-gap" || d.prop === "grid-column-gap") col = d.value.trim();
    else if (d.prop === "row-gap" || d.prop === "grid-row-gap") row = d.value.trim();
  }
  return { col, row };
}

// Enfants ayant déjà une marge explicite (ml-auto, mt-2, sm:mx-4…) : on ne touche pas
const exclude = (prefixes) =>
  prefixes
    .map((p) => `:not([class^="${p}"]):not([class*=" ${p}"]):not([class*=":${p}"]):not([class*="-${p}"])`)
    .join("");
const NOT_INLINE_MARGIN = exclude(["m-", "mx-", "ml-", "mr-", "ms-", "me-"]);
const NOT_BLOCK_MARGIN = exclude(["m-", "my-", "mt-"]);
// Seuls les conteneurs qui utilisent réellement gap-* sont concernés
const HAS_GAP = '[class*="gap-"]';

const isSingleClassSelector = (sel) => /^\.[^\s,>+~:]+$/.test(sel.replace(/\\./g, "_"));

export default function postcssSafari12() {
  return {
    postcssPlugin: "postcss-safari12",
    OnceExit(root, { Rule, Declaration }) {
      try {
        const additions = [];
        root.walkRules((rule) => {
          // ignore les @keyframes
          if (rule.parent && rule.parent.type === "atrule" && /keyframes$/i.test(rule.parent.name)) return;

          /* ---------- 1-3 : réécriture des sélecteurs ---------- */
          if (/:is\(|:where\(/.test(rule.selector)) {
            const parts = splitTopLevel(rule.selector);
            const rewritten = parts.map(rewriteSelector);
            const next = rewritten.join(",\n");
            if (next !== rule.selector) rule.selector = next;
          }

          /* ---------- 4 : repli flex-gap ---------- */
          const sel = rule.selector.trim();
          if (!isSingleClassSelector(sel)) return;
          const decls = rule.nodes ? rule.nodes.filter((n) => n.type === "decl") : [];
          if (!decls.length) return;

          const { col, row } = parseGap(decls);
          if (col !== null || row !== null) {
            const r = new Rule({ selector: `.no-flex-gap ${sel} > *` });
            if (col !== null) r.append(new Declaration({ prop: "--fg-x", value: col }));
            if (row !== null) r.append(new Declaration({ prop: "--fg-y", value: row }));
            additions.push([rule, r]);
          }

          const display = decls.find((d) => d.prop === "display");
          const dir = decls.find((d) => d.prop === "flex-direction");
          const wrap = decls.find((d) => d.prop === "flex-wrap");

          if (display && /^(inline-)?flex$/.test(display.value.trim())) {
            const r = new Rule({
              selector: `.no-flex-gap ${sel}${HAS_GAP}:not(.flex-col):not(.flex-col-reverse) > * + *${NOT_INLINE_MARGIN}`,
            });
            FLEX_ROW_DECL("var(--fg-x, 0px)").forEach(([p, v]) => r.append(new Declaration({ prop: p, value: v })));
            additions.push([rule, r]);
          }
          if (dir) {
            const isCol = /column/.test(dir.value);
            const base = `.no-flex-gap ${sel}${HAS_GAP} > * + *`;
            const inline = new Rule({ selector: base + NOT_INLINE_MARGIN });
            const block = new Rule({ selector: base + NOT_BLOCK_MARGIN });
            FLEX_ROW_DECL(isCol ? "0px" : "var(--fg-x, 0px)").forEach(([p, v]) =>
              inline.append(new Declaration({ prop: p, value: v }))
            );
            block.append(new Declaration({ prop: "margin-top", value: isCol ? "var(--fg-y, 0px)" : "0px" }));
            additions.push([rule, inline], [rule, block]);
          }
          if (wrap && /^wrap/.test(wrap.value.trim())) {
            const r = new Rule({ selector: `.no-flex-gap ${sel}${HAS_GAP} > *` + exclude(["m-", "my-", "mb-"]) });
            r.append(new Declaration({ prop: "margin-bottom", value: "var(--fg-y, 0px)" }));
            additions.push([rule, r]);
          }
        });
        // Valeurs par défaut (évite qu'un enfant hérite de l'espacement d'un grand-parent)
        if (additions.length) {
          const reset = new Rule({ selector: `.no-flex-gap ${HAS_GAP} > *` });
          reset.append(new Declaration({ prop: "--fg-x", value: "0px" }));
          reset.append(new Declaration({ prop: "--fg-y", value: "0px" }));
          root.prepend(reset);
        }
        // Insertion juste après la règle d'origine (même @media, même ordre de cascade)
        for (let i = additions.length - 1; i >= 0; i--) {
          const [after, node] = additions[i];
          after.after(node);
        }
      } catch (err) {
        // Ne jamais casser le build pour un repli de compatibilité
        console.warn("[postcss-safari12] ignoré :", err && err.message);
      }
    },
  };
}
postcssSafari12.postcss = true;

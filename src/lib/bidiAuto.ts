/**
 * Sens d'écriture automatique des paragraphes au contenu mixte arabe / français.
 *
 * Dans l'interface arabe, un énoncé saisi en français (« Combien font 7 + 8 ? ») s'affichait
 * « ? Combien font 7 + 8 ». On donne à chaque paragraphe le sens de sa première lettre forte,
 * uniquement quand il diffère de celui de la page ; les paragraphes faits seulement de
 * chiffres ou de symboles ne sont pas touchés (ils gardent l'alignement de la page).
 */
const SELECTOR = "p, h1, h2, h3, h4, h5, h6, li, blockquote, .bidi-auto";
const RTL_CHAR = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const LTR_CHAR = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ]/;
// première lettre « forte » (latine ou arabe/hébreu)
const STRONG = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ֐-ࣿיִ-﷿ﹰ-﻿]/;

function firstStrongDir(text: string): "ltr" | "rtl" | null {
  const m = STRONG.exec(text);
  if (!m) return null;
  return RTL_CHAR.test(m[0]) ? "rtl" : LTR_CHAR.test(m[0]) ? "ltr" : null;
}

function pageDir(el: Element): "ltr" | "rtl" {
  const parent = el.parentElement?.closest("[dir]");
  const d = (parent?.getAttribute("dir") || document.documentElement.getAttribute("dir") || "ltr").toLowerCase();
  return d === "rtl" ? "rtl" : "ltr";
}

function fix(el: HTMLElement) {
  const own = el.getAttribute("data-bidi") === "1";
  // un « dir » posé par l'application elle-même est respecté
  if (!own && el.hasAttribute("dir")) return;
  // dans un éditeur, c'est le CSS (unicode-bidi: plaintext) qui s'en charge
  if (el.closest('[contenteditable="true"]')) return;
  const text = el.textContent || "";
  const want = firstStrongDir(text);
  const base = pageDir(el);
  if (want && want !== base) {
    // pas de bascule pour les lignes en flex/grid (icône + texte) : ordre visuel conservé
    const disp = getComputedStyle(el).display;
    if (disp.indexOf("flex") !== -1 || disp.indexOf("grid") !== -1) return;
    if (el.getAttribute("dir") !== want) {
      el.setAttribute("dir", want);
      el.setAttribute("data-bidi", "1");
    }
  } else if (own) {
    el.removeAttribute("dir");
    el.removeAttribute("data-bidi");
  }
}

let scheduled = false;
function scan() {
  scheduled = false;
  const list = document.querySelectorAll<HTMLElement>(SELECTOR);
  for (let i = 0; i < list.length; i++) fix(list[i]);
}

export function startBidiAuto() {
  if (typeof window === "undefined" || typeof MutationObserver === "undefined") return;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    window.setTimeout(scan, 120);
  };
  const obs = new MutationObserver(schedule);
  obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["dir", "lang"] });
  schedule();
}

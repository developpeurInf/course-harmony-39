/**
 * Sens d'écriture automatique des paragraphes au contenu mixte arabe / français.
 *
 * Dans l'interface arabe, un énoncé saisi en français (« Combien font 7 + 8 ? ») s'affichait
 * « ? Combien font 7 + 8 ». On donne à chaque paragraphe le sens de sa première lettre forte,
 * uniquement quand il diffère de celui de la page ; les paragraphes faits seulement de
 * chiffres ou de symboles ne sont pas touchés (ils gardent l'alignement de la page).
 *
 * Performances : un balayage complet au démarrage (et quand le sens de la page change),
 * ensuite seuls les éléments touchés par les mutations sont retraités.
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
  const parent = el.parentElement ? el.parentElement.closest("[dir]") : null;
  const d = ((parent && parent.getAttribute("dir")) || document.documentElement.getAttribute("dir") || "ltr").toLowerCase();
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
let fullScan = true;
const pending: Element[] = [];

/** Élément concerné par un nœud muté : lui-même (ou son parent pour un texte) */
function elementOf(node: Node | null): Element | null {
  if (!node) return null;
  if (node.nodeType === 1) return node as Element;
  return node.parentElement;
}

function processSubtree(root: Element, done: Set<Element>) {
  // l'élément ciblé et ses ancêtres concernés (le texte d'un <p> a pu changer)
  const host = root.closest ? root.closest(SELECTOR) : null;
  if (host && !done.has(host)) {
    done.add(host);
    fix(host as HTMLElement);
  }
  // ses descendants concernés
  const list = root.querySelectorAll ? root.querySelectorAll<HTMLElement>(SELECTOR) : null;
  if (list) {
    for (let i = 0; i < list.length; i++) {
      if (!done.has(list[i])) {
        done.add(list[i]);
        fix(list[i]);
      }
    }
  }
}

function run() {
  scheduled = false;
  if (fullScan) {
    fullScan = false;
    pending.length = 0;
    const list = document.querySelectorAll<HTMLElement>(SELECTOR);
    for (let i = 0; i < list.length; i++) fix(list[i]);
    return;
  }
  const roots = pending.splice(0, pending.length);
  const done = new Set<Element>();
  for (let i = 0; i < roots.length; i++) {
    const r = roots[i];
    if (!r.isConnected && r.isConnected !== undefined) continue;
    processSubtree(r, done);
  }
}

export function startBidiAuto() {
  if (typeof window === "undefined" || typeof MutationObserver === "undefined") return;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    window.setTimeout(run, 120);
  };
  const obs = new MutationObserver((mutations) => {
    for (let i = 0; i < mutations.length; i++) {
      const m = mutations[i];
      if (m.type === "attributes") {
        const target = m.target as Element;
        // sens / langue de la page changés : tout est à revoir
        if (target === document.documentElement || target === document.body) {
          fullScan = true;
          continue;
        }
        // nos propres marques n'ont pas besoin d'être retraitées
        if (target.getAttribute && target.getAttribute("data-bidi") === "1" && m.attributeName === "dir") continue;
        pending.push(target);
      } else if (m.type === "characterData") {
        const el = elementOf(m.target);
        if (el) pending.push(el);
      } else {
        const el = elementOf(m.target);
        if (el) pending.push(el);
        m.addedNodes.forEach((n) => {
          if (n.nodeType === 1) pending.push(n as Element);
        });
      }
    }
    // très grosse rafale (changement de page complet) : un seul balayage est plus simple
    if (pending.length > 400) fullScan = true;
    schedule();
  });
  obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["dir", "lang"] });
  schedule();
}

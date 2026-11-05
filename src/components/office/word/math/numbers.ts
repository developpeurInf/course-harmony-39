/**
 * « Changer les nombres » : repère les nombres d'un énoncé (texte et équations),
 * permet de les remplacer un à un ou au hasard, pour créer en un clic un sujet B.
 */
import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";

/** 12 | 3,5 | 3.5 | 3{,}5 (virgule de MathLive) */
const NUM_RE = /\d+(?:(?:\{,\}|[.,])\d+)?/g;

export interface NumberInfo { value: string; count: number; inMath: number; inText: number; sample: string }

const norm = (v: string) => v.replace("{,}", ",");

function eachTarget(editor: Editor, fn: (node: PMNode, pos: number, kind: "text" | "math") => void) {
  const { from, to, empty } = editor.state.selection;
  const [a, b] = empty ? [0, editor.state.doc.content.size] : [from, to];
  editor.state.doc.nodesBetween(a, b, (node, pos) => {
    if (node.isText) fn(node, pos, "text");
    else if (node.type.name === "mathInline") fn(node, pos, "math");
  });
}

export function scanNumbers(editor: Editor): NumberInfo[] {
  const map = new Map<string, NumberInfo>();
  eachTarget(editor, (node, _pos, kind) => {
    const s = kind === "text" ? node.text || "" : String(node.attrs.latex || "");
    // (pas de matchAll : absent de Safari 12)
    const re = new RegExp(NUM_RE.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
      const v = norm(m[0]);
      const info = map.get(v) || { value: v, count: 0, inMath: 0, inText: 0, sample: "" };
      info.count++;
      if (kind === "math") info.inMath++; else info.inText++;
      if (!info.sample) {
        const i = m.index ?? 0;
        info.sample = (i > 12 ? "…" : "") + s.slice(Math.max(0, i - 12), i + m[0].length + 12).trim() + (i + m[0].length + 12 < s.length ? "…" : "");
      }
      map.set(v, info);
    }
  });
  return [...map.values()].sort((x, y) => parseFloat(x.value.replace(",", ".")) - parseFloat(y.value.replace(",", ".")));
}

/** Nouvelle valeur au hasard : même nombre de chiffres et de décimales, différente de l'ancienne */
export function randomLike(v: string): string {
  const sep = v.includes(",") ? "," : ".";
  const [int, dec] = v.split(/[.,]/);
  const digits = int.length;
  const lo = digits === 1 ? 2 : 10 ** (digits - 1);
  const hi = 10 ** digits - 1;
  for (let k = 0; k < 20; k++) {
    const n = lo + Math.floor(Math.random() * (hi - lo + 1));
    const d = dec ? Array.from({ length: dec.length }, (_, j) => String(j === dec.length - 1 ? 1 + Math.floor(Math.random() * 9) : Math.floor(Math.random() * 10))).join("") : "";
    const out = d ? `${n}${sep}${d}` : String(n);
    if (out !== v) return out;
  }
  return v;
}

/** Applique les remplacements (une seule transaction, annulable avec Ctrl+Z) */
export function applyNumbers(editor: Editor, repl: Record<string, string>): number {
  const keys = Object.keys(repl).filter((k) => repl[k] !== "" && repl[k] !== k);
  if (!keys.length) return 0;
  const changes: { pos: number; node: PMNode; kind: "text" | "math" }[] = [];
  eachTarget(editor, (node, pos, kind) => changes.push({ node, pos, kind }));
  const { tr, schema } = editor.state;
  let count = 0;
  const swap = (s: string, math: boolean) =>
    s.replace(NUM_RE, (m) => {
      const r = repl[norm(m)];
      if (r === undefined || r === "" || r === norm(m)) return m;
      count++;
      return math ? r.replace(",", "{,}") : r;
    });
  // de la fin vers le début : les positions restent valables
  for (const c of changes.reverse()) {
    if (c.kind === "math") {
      const latex = swap(String(c.node.attrs.latex || ""), true);
      if (latex !== c.node.attrs.latex) tr.setNodeMarkup(c.pos, undefined, { ...c.node.attrs, latex });
    } else {
      const text = c.node.text || "";
      const t2 = swap(text, false);
      if (t2 !== text) tr.replaceWith(c.pos, c.pos + c.node.nodeSize, schema.text(t2, c.node.marks));
    }
  }
  if (count) editor.view.dispatch(tr);
  return count;
}

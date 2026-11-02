/**
 * Extensions TipTap propres à l'éditeur Word : mise en forme des paragraphes
 * (interligne, espacement, retraits, sens, trame, lettrine), saut de page,
 * équations (LaTeX), notes de bas de page, table des matières, commentaires,
 * recherche / remplacement surlignés, attributs d'images et de cellules.
 */
import { Extension, Mark, Node, mergeAttributes, type Editor } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { loadKatex, renderLatexToString } from "@/lib/mathRender";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    paragraphFormat: {
      setParagraphAttr: (attrs: Record<string, unknown>) => ReturnType;
      indent: () => ReturnType;
      outdent: () => ReturnType;
    };
    pageBreak: { insertPageBreak: () => ReturnType };
    mathInline: { insertMath: (latex: string, display?: boolean) => ReturnType };
    footnote: { insertFootnote: (text: string) => ReturnType };
    toc: { insertToc: () => ReturnType };
    comment: { setComment: (text: string) => ReturnType; unsetComment: () => ReturnType };
    search: {
      setSearch: (term: string, opts?: { caseSensitive?: boolean; wholeWord?: boolean }) => ReturnType;
      setSearchIndex: (i: number) => ReturnType;
    };
  }
}

const PARA_TYPES = ["paragraph", "heading", "blockquote"];
const INDENT_STEP = 36; // px (≈ 1,27 cm, comme Word)

const px = (v: string | null | undefined) => {
  if (!v) return null;
  const n = parseFloat(v);
  if (isNaN(n)) return null;
  if (/pt$/.test(v)) return Math.round((n * 96) / 72);
  if (/cm$/.test(v)) return Math.round((n * 96) / 2.54);
  if (/mm$/.test(v)) return Math.round((n * 96) / 25.4);
  if (/in$/.test(v)) return Math.round(n * 96);
  if (/em$/.test(v)) return Math.round(n * 16);
  return Math.round(n);
};

export const ParagraphFormat = Extension.create({
  name: "paragraphFormat",
  addGlobalAttributes() {
    return [
      {
        types: PARA_TYPES,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (el) => el.style.lineHeight || null,
            renderHTML: (a) => (a.lineHeight ? { style: `line-height:${a.lineHeight}` } : {}),
          },
          spaceBefore: {
            default: null,
            parseHTML: (el) => px(el.style.marginTop),
            renderHTML: (a) => (a.spaceBefore != null ? { style: `margin-top:${a.spaceBefore}px` } : {}),
          },
          spaceAfter: {
            default: null,
            parseHTML: (el) => px(el.style.marginBottom),
            renderHTML: (a) => (a.spaceAfter != null ? { style: `margin-bottom:${a.spaceAfter}px` } : {}),
          },
          indent: {
            default: 0,
            parseHTML: (el) => px(el.style.marginInlineStart || el.getAttribute("data-indent") || "") || 0,
            renderHTML: (a) => (a.indent ? { style: `margin-inline-start:${a.indent}px`, "data-indent": `${a.indent}` } : {}),
          },
          firstLine: {
            default: null,
            parseHTML: (el) => px(el.style.textIndent),
            renderHTML: (a) => (a.firstLine ? { style: `text-indent:${a.firstLine}px` } : {}),
          },
          dir: {
            default: null,
            parseHTML: (el) => el.getAttribute("dir"),
            renderHTML: (a) => (a.dir ? { dir: a.dir } : {}),
          },
          shading: {
            default: null,
            parseHTML: (el) => el.getAttribute("data-shading") || null,
            renderHTML: (a) => (a.shading ? { "data-shading": a.shading, style: `background-color:${a.shading};padding:2px 4px` } : {}),
          },
          border: {
            default: null,
            parseHTML: (el) => el.getAttribute("data-border") || null,
            renderHTML: (a) => {
              if (!a.border) return {};
              const css = a.border === "box" ? "border:1px solid currentColor;padding:4px 6px" : a.border === "bottom" ? "border-bottom:1px solid currentColor;padding-bottom:2px" : a.border === "top" ? "border-top:1px solid currentColor;padding-top:2px" : "";
              return { "data-border": a.border, style: css };
            },
          },
          dropCap: {
            default: false,
            parseHTML: (el) => el.classList.contains("drop-cap"),
            renderHTML: (a) => (a.dropCap ? { class: "drop-cap" } : {}),
          },
          keepNext: {
            default: false,
            parseHTML: (el) => el.getAttribute("data-keep-next") === "1",
            renderHTML: (a) => (a.keepNext ? { "data-keep-next": "1", style: "break-after:avoid" } : {}),
          },
        },
      },
    ];
  },
  addCommands() {
    const setAttr = (attrs: Record<string, unknown>) => ({ tr, state, dispatch }: { tr: any; state: EditorState; dispatch?: (tr: any) => void }) => {
      const { from, to } = state.selection;
      let changed = false;
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (PARA_TYPES.includes(node.type.name)) {
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs });
          changed = true;
        }
      });
      if (changed && dispatch) dispatch(tr);
      return changed;
    };
    const shift = (delta: number) => ({ tr, state, dispatch }: { tr: any; state: EditorState; dispatch?: (tr: any) => void }) => {
      const { from, to } = state.selection;
      let changed = false;
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (PARA_TYPES.includes(node.type.name)) {
          const indent = Math.max(0, Math.min(INDENT_STEP * 10, (node.attrs.indent || 0) + delta));
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent });
          changed = true;
        }
      });
      if (changed && dispatch) dispatch(tr);
      return changed;
    };
    return {
      setParagraphAttr: (attrs) => setAttr(attrs) as never,
      indent: () => ({ chain, editor, ...rest }) => {
        if (editor.isActive("listItem") && editor.can().sinkListItem("listItem")) return chain().sinkListItem("listItem").run();
        return (shift(INDENT_STEP) as any)(rest);
      },
      outdent: () => ({ chain, editor, ...rest }) => {
        if (editor.isActive("listItem") && editor.can().liftListItem("listItem")) return chain().liftListItem("listItem").run();
        return (shift(-INDENT_STEP) as any)(rest);
      },
    };
  },
  addKeyboardShortcuts() {
    return {
      Tab: () => (this.editor.isActive("table") ? false : this.editor.commands.indent()),
      "Shift-Tab": () => (this.editor.isActive("table") ? false : this.editor.commands.outdent()),
      "Mod-l": () => this.editor.commands.setTextAlign("left"),
      "Mod-e": () => this.editor.commands.setTextAlign("center"),
      "Mod-r": () => this.editor.commands.setTextAlign("right"),
      "Mod-j": () => this.editor.commands.setTextAlign("justify"),
      "Mod-Enter": () => this.editor.commands.insertPageBreak(),
    };
  },
});

/** Attributs d'image : alignement / habillage et bordure */
export const ImageAttrs = Extension.create({
  name: "imageAttrs",
  addGlobalAttributes() {
    return [
      {
        types: ["image"],
        attributes: {
          align: {
            default: null,
            parseHTML: (el) => el.getAttribute("data-align"),
            renderHTML: (a) => {
              if (!a.align) return {};
              const css = a.align === "left" ? "float:left;margin:4px 12px 4px 0" : a.align === "right" ? "float:right;margin:4px 0 4px 12px" : "display:block;margin:6px auto";
              return { "data-align": a.align, style: css };
            },
          },
          frame: {
            default: null,
            parseHTML: (el) => el.getAttribute("data-frame"),
            renderHTML: (a) => {
              if (!a.frame) return {};
              const css = a.frame === "shadow" ? "box-shadow:0 4px 14px rgba(0,0,0,.35)" : a.frame === "border" ? "border:3px solid #fff;outline:1px solid #999" : a.frame === "rounded" ? "border-radius:14px" : a.frame === "circle" ? "border-radius:9999px;aspect-ratio:1/1;object-fit:cover" : "";
              return { "data-frame": a.frame, style: css };
            },
          },
        },
      },
    ];
  },
});

/** Attributs des cellules de tableau : trame et alignement vertical */
export const CellAttrs = Extension.create({
  name: "cellAttrs",
  addGlobalAttributes() {
    return [
      {
        types: ["tableCell", "tableHeader"],
        attributes: {
          background: {
            default: null,
            parseHTML: (el) => el.getAttribute("data-bg") || el.style.backgroundColor || null,
            renderHTML: (a) => (a.background ? { "data-bg": a.background, style: `background-color:${a.background}` } : {}),
          },
          valign: {
            default: null,
            parseHTML: (el) => el.getAttribute("data-valign") || el.style.verticalAlign || null,
            renderHTML: (a) => (a.valign ? { "data-valign": a.valign, style: `vertical-align:${a.valign}` } : {}),
          },
        },
      },
      {
        types: ["table"],
        attributes: {
          tableStyle: {
            default: "grid",
            parseHTML: (el) => el.getAttribute("data-style") || "grid",
            renderHTML: (a) => ({ "data-style": a.tableStyle || "grid" }),
          },
        },
      },
    ];
  },
});

export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: "div[data-page-break]" }, { tag: 'p[style*="page-break-before: always"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-page-break": "1", class: "page-break" })];
  },
  addCommands() {
    return {
      insertPageBreak: () => ({ chain }) => chain().insertContent([{ type: "pageBreak" }, { type: "paragraph" }]).run(),
    };
  },
});

/** Équation LaTeX (rendue avec KaTeX), double-clic pour modifier */
export const MathInline = Node.create({
  name: "mathInline",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      latex: { default: "x^2", parseHTML: (el) => el.getAttribute("data-latex") || el.textContent || "" },
      display: { default: false, parseHTML: (el) => el.getAttribute("data-display") === "1" },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-latex]" }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-latex": node.attrs.latex, "data-display": node.attrs.display ? "1" : "0", class: "math-node" }), node.attrs.latex];
  },
  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement("span");
      dom.className = "math-node";
      dom.contentEditable = "false";
      let current = node;
      const draw = () => {
        dom.textContent = current.attrs.latex;
        loadKatex().then((k) => { dom.innerHTML = renderLatexToString(k, current.attrs.latex, current.attrs.display); }).catch(() => undefined);
      };
      draw();
      dom.addEventListener("dblclick", () => {
        const v = window.prompt("LaTeX", current.attrs.latex);
        if (v === null || typeof getPos !== "function") return;
        const pos = getPos();
        if (typeof pos !== "number") return;
        editor.chain().focus().command(({ tr }) => { tr.setNodeMarkup(pos, undefined, { ...current.attrs, latex: v }); return true; }).run();
      });
      return {
        dom,
        update: (n) => {
          if (n.type.name !== "mathInline") return false;
          current = n;
          draw();
          return true;
        },
      };
    };
  },
  addCommands() {
    return {
      insertMath: (latex, display = false) => ({ chain }) => chain().insertContent({ type: "mathInline", attrs: { latex, display } }).run(),
    };
  },
});

/** Note de bas de page : numérotée automatiquement, listée sous le document */
export const Footnote = Node.create({
  name: "footnote",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return { text: { default: "", parseHTML: (el) => el.getAttribute("data-footnote") || "" } };
  },
  parseHTML() {
    return [{ tag: "sup[data-footnote]" }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return ["sup", mergeAttributes(HTMLAttributes, { "data-footnote": node.attrs.text, class: "footnote-ref", title: node.attrs.text })];
  },
  addCommands() {
    return {
      insertFootnote: (text) => ({ chain }) => chain().insertContent({ type: "footnote", attrs: { text } }).run(),
    };
  },
});

export interface HeadingInfo { level: number; text: string; pos: number }
export function collectHeadings(doc: EditorState["doc"]): HeadingInfo[] {
  const out: HeadingInfo[] = [];
  doc.descendants((n, pos) => {
    if (n.type.name === "heading") out.push({ level: n.attrs.level, text: n.textContent, pos });
    return n.type.name !== "heading";
  });
  return out;
}

/** Table des matières (mise à jour automatique à chaque modification) */
export const Toc = Node.create({
  name: "toc",
  group: "block",
  atom: true,
  selectable: true,
  addAttributes() {
    return { title: { default: "Table des matières", parseHTML: (el) => el.getAttribute("data-title") || "Table des matières" } };
  },
  parseHTML() {
    return [{ tag: "div[data-toc]" }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-toc": "1", "data-title": node.attrs.title, class: "toc-block" })];
  },
  addNodeView() {
    return ({ editor, node }) => {
      const dom = document.createElement("div");
      dom.className = "toc-block";
      dom.contentEditable = "false";
      const draw = () => {
        const hs = collectHeadings(editor.state.doc);
        dom.innerHTML = "";
        const t = document.createElement("div");
        t.className = "toc-title";
        t.textContent = node.attrs.title;
        dom.appendChild(t);
        if (!hs.length) {
          const e = document.createElement("div");
          e.className = "toc-empty";
          e.textContent = "—";
          dom.appendChild(e);
        }
        hs.forEach((h) => {
          const a = document.createElement("div");
          a.className = `toc-entry toc-l${h.level}`;
          a.textContent = h.text || "…";
          a.onclick = () => {
            editor.commands.setTextSelection(h.pos + 1);
            editor.view.domAtPos(h.pos + 1).node.parentElement?.scrollIntoView({ behavior: "smooth", block: "center" });
          };
          dom.appendChild(a);
        });
      };
      draw();
      const onUpd = () => draw();
      editor.on("update", onUpd);
      return { dom, update: (n) => n.type.name === "toc", destroy: () => editor.off("update", onUpd) };
    };
  },
  addCommands() {
    return {
      insertToc: () => ({ chain }) => chain().insertContent([{ type: "toc" }, { type: "paragraph" }]).run(),
    };
  },
});

/** Commentaire (révision) : texte surligné avec la remarque en info-bulle */
export const Comment = Mark.create({
  name: "comment",
  inclusive: false,
  addAttributes() {
    return {
      text: { default: "", parseHTML: (el) => el.getAttribute("data-comment") || "" },
      author: { default: "", parseHTML: (el) => el.getAttribute("data-author") || "" },
      date: { default: "", parseHTML: (el) => el.getAttribute("data-date") || "" },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-comment]" }];
  },
  renderHTML({ HTMLAttributes, mark }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-comment": mark.attrs.text, class: "doc-comment", title: mark.attrs.text }), 0];
  },
  addCommands() {
    return {
      setComment: (text) => ({ commands }) => commands.setMark(this.name, { text, date: new Date().toISOString() }),
      unsetComment: () => ({ commands }) => commands.unsetMark(this.name, { extendEmptyMarkRange: true }),
    };
  },
});

// ---------- Rechercher / remplacer ----------
export const searchKey = new PluginKey<SearchState>("office-search");
interface SearchState { term: string; caseSensitive: boolean; wholeWord: boolean; index: number; results: { from: number; to: number }[]; deco: DecorationSet }

function findAll(doc: EditorState["doc"], term: string, cs: boolean, ww: boolean) {
  const res: { from: number; to: number }[] = [];
  if (!term) return res;
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(ww ? `(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])` : esc, cs ? "gu" : "giu");
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    // texte du bloc avec correspondance position → document
    let text = "";
    const map: number[] = [];
    node.forEach((child, offset) => {
      if (child.isText) {
        for (let i = 0; i < child.text!.length; i++) { map.push(pos + 1 + offset + i); }
        text += child.text;
      } else {
        map.push(-1);
        text += "￼";
      }
    });
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (!m[0].length) { re.lastIndex++; continue; }
      const a = map[m.index], b = map[m.index + m[0].length - 1];
      if (a >= 0 && b >= 0) res.push({ from: a, to: b + 1 });
    }
    return false;
  });
  return res;
}

function buildDeco(doc: EditorState["doc"], results: { from: number; to: number }[], index: number) {
  return DecorationSet.create(doc, results.map((r, i) => Decoration.inline(r.from, r.to, { class: i === index ? "search-hit search-current" : "search-hit" })));
}

export const SearchHighlight = Extension.create({
  name: "search",
  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchKey,
        state: {
          init: (_, { doc }) => ({ term: "", caseSensitive: false, wholeWord: false, index: 0, results: [], deco: DecorationSet.create(doc, []) }),
          apply: (tr, prev) => {
            const meta = tr.getMeta(searchKey) as Partial<SearchState> | undefined;
            if (!meta && !tr.docChanged) return prev;
            const next = { ...prev, ...(meta || {}) };
            const results = findAll(tr.doc, next.term, next.caseSensitive, next.wholeWord);
            const index = results.length ? Math.min(next.index, results.length - 1) : 0;
            return { ...next, results, index, deco: buildDeco(tr.doc, results, index) };
          },
        },
        props: { decorations: (state) => searchKey.getState(state)?.deco },
      }),
    ];
  },
  addCommands() {
    return {
      setSearch: (term, opts) => ({ tr, dispatch }) => {
        if (dispatch) dispatch(tr.setMeta(searchKey, { term, caseSensitive: !!opts?.caseSensitive, wholeWord: !!opts?.wholeWord, index: 0 }));
        return true;
      },
      setSearchIndex: (index) => ({ tr, dispatch }) => {
        if (dispatch) dispatch(tr.setMeta(searchKey, { index }));
        return true;
      },
    };
  },
});

export function searchState(editor: Editor) {
  return searchKey.getState(editor.state);
}

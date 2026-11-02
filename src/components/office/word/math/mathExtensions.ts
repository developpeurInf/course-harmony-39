/**
 * Extensions TipTap des outils Maths de Word :
 * - VarTable : tableau de signes / variations (dessiné en SVG, double-clic pour modifier) ;
 * - Correction : texte de corrigé, masquable pour obtenir la version élève ;
 * - attribut « ggb » des images : figure GeoGebra modifiable après insertion.
 */
import { Extension, Mark, Node, mergeAttributes } from "@tiptap/core";
import { openVarTableEditor } from "./events";
import { parseVt, renderVarTable, svgToDataUrl } from "./varTable";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    varTable: { insertVarTable: (data: string) => ReturnType };
    correction: { toggleCorrection: () => ReturnType };
  }
}

const vtSrc = (json: string) => {
  const d = parseVt(json);
  if (!d) return { src: "", width: 0 };
  const r = renderVarTable(d);
  return { src: svgToDataUrl(r.svg), width: r.width };
};

export const VarTable = Node.create({
  name: "varTable",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,
  priority: 120,
  addAttributes() {
    return { data: { default: "", parseHTML: (el) => el.getAttribute("data-vartable") || "" } };
  },
  parseHTML() {
    return [{ tag: "img[data-vartable]", priority: 120 }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const { src, width } = vtSrc(node.attrs.data);
    return ["img", mergeAttributes(HTMLAttributes, { src, width, "data-vartable": node.attrs.data, alt: "Tableau", class: "vartable" })];
  },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const img = document.createElement("img");
      img.className = "vartable";
      img.alt = "Tableau";
      img.title = "Double-clic pour modifier";
      img.draggable = false;
      const draw = (json: string) => { const { src, width } = vtSrc(json); img.src = src; img.width = width; };
      let current = node;
      draw(node.attrs.data);
      img.addEventListener("dblclick", (e) => {
        e.preventDefault();
        if (typeof getPos !== "function" || !editor.isEditable) return;
        const pos = getPos();
        if (typeof pos === "number") openVarTableEditor({ data: current.attrs.data, pos });
      });
      return {
        dom: img,
        update: (n) => {
          if (n.type.name !== "varTable") return false;
          if (n.attrs.data !== current.attrs.data) draw(n.attrs.data);
          current = n;
          return true;
        },
      };
    };
  },
  addCommands() {
    return {
      insertVarTable: (data) => ({ chain }) => chain().insertContent({ type: "varTable", attrs: { data } }).run(),
    };
  },
});

export const Correction = Mark.create({
  name: "correction",
  inclusive: true,
  parseHTML() {
    return [{ tag: "span[data-correction]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-correction": "1", class: "correction" }), 0];
  },
  addCommands() {
    return {
      toggleCorrection: () => ({ commands }) => commands.toggleMark(this.name),
    };
  },
  addKeyboardShortcuts() {
    return { "Mod-Shift-k": () => this.editor.commands.toggleCorrection() };
  },
});

/** Fichier GeoGebra (base64) gardé dans l'image pour pouvoir rouvrir la figure */
export const ImageGgb = Extension.create({
  name: "imageGgb",
  addGlobalAttributes() {
    return [
      {
        types: ["image"],
        attributes: {
          ggb: {
            default: null,
            parseHTML: (el) => el.getAttribute("data-ggb"),
            renderHTML: (a) => (a.ggb ? { "data-ggb": a.ggb } : {}),
          },
          ggbApp: {
            default: null,
            parseHTML: (el) => el.getAttribute("data-ggb-app"),
            renderHTML: (a) => (a.ggbApp ? { "data-ggb-app": a.ggbApp } : {}),
          },
        },
      },
    ];
  },
});

/**
 * Listes a), b) / i), ii) : en HTML, le sélecteur [type="a"] ne distingue pas
 * minuscules et majuscules, donc « a. » s'affichait « A. ». On ajoute un attribut
 * data-lt explicite que la feuille de style peut cibler sans ambiguïté.
 */
export const ListMarker = Extension.create({
  name: "listMarker",
  addGlobalAttributes() {
    const STYLE: Record<string, string> = { a: "lower-alpha", A: "upper-alpha", i: "lower-roman", I: "upper-roman", "1": "decimal" };
    return [
      {
        types: ["orderedList"],
        attributes: {
          listMarker: {
            default: null,
            parseHTML: () => null,
            renderHTML: (a) => (a.type && STYLE[a.type] ? { "data-lt": STYLE[a.type] } : {}),
          },
        },
      },
    ];
  },
});

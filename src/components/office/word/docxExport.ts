/**
 * Export .docx du document (JSON TipTap → bibliothèque « docx »).
 * Titres, styles de caractères, couleurs, surlignage, polices, tailles, exposant / indice,
 * alignement, interligne, espacements, retraits, sens droite → gauche, listes (puces,
 * numéros, cases à cocher), tableaux (fusions, trames), images, liens, sauts de page,
 * notes de bas de page, commentaires, table des matières, en-tête / pied de page,
 * numéros de page, marges, format et orientation, colonnes, filigrane (texte d'en-tête).
 */
import { parseVt, renderVarTable, svgToDataUrl } from "./math/varTable";
import type { JSONContent } from "@tiptap/core";
import type { PageSettings } from "./pageSettings";
import { PAGE_SIZES } from "./pageSettings";

type D = typeof import("docx");
type AnyObj = Record<string, any>;

const toHex = (c?: string | null): string | undefined => {
  if (!c) return undefined;
  c = c.trim();
  if (c.startsWith("#")) {
    let h = c.slice(1);
    if (h.length === 3) h = h.split("").map((x) => x + x).join("");
    return h.slice(0, 6).toUpperCase();
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) return m[1].split(",").slice(0, 3).map((x) => Math.round(Number(x.trim())).toString(16).padStart(2, "0")).join("").toUpperCase();
  const named: Record<string, string> = { red: "FF0000", blue: "0000FF", green: "008000", yellow: "FFFF00", black: "000000", white: "FFFFFF", orange: "FFA500", purple: "800080", gray: "808080", grey: "808080" };
  return named[c.toLowerCase()];
};
const halfPoints = (size?: string | null) => {
  if (!size) return undefined;
  const n = parseFloat(size);
  if (isNaN(n)) return undefined;
  const pt = /px$/.test(size) ? (n * 72) / 96 : n;
  return Math.round(pt * 2);
};
const twip = (pxv: number) => Math.round(pxv * 15);
const mmToTwip = (mm: number) => Math.round((mm / 25.4) * 1440);

async function imageData(src: string): Promise<{ data: Uint8Array; type: "png" | "jpg" | "gif" | "bmp"; w: number; h: number } | null> {
  try {
    let blob: Blob;
    if (src.startsWith("data:")) {
      const [head, b64] = src.split(",");
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      blob = new Blob([arr], { type: head.slice(5).split(";")[0] });
    } else {
      blob = await (await fetch(src)).blob();
    }
    const url = URL.createObjectURL(blob);
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    let type: "png" | "jpg" | "gif" | "bmp" = /jpe?g/.test(blob.type) ? "jpg" : /gif/.test(blob.type) ? "gif" : /bmp/.test(blob.type) ? "bmp" : "png";
    let data = new Uint8Array(await blob.arrayBuffer());
    // formats non pris en charge par Word dans « docx » (webp, svg…) : conversion en PNG
    if (!/png|jpe?g|gif|bmp/.test(blob.type)) {
      const cv = document.createElement("canvas");
      cv.width = img.naturalWidth || 400; cv.height = img.naturalHeight || 300;
      cv.getContext("2d")!.drawImage(img, 0, 0);
      const b2 = await new Promise<Blob | null>((r) => cv.toBlob(r, "image/png"));
      if (!b2) return null;
      data = new Uint8Array(await b2.arrayBuffer());
      type = "png";
    }
    URL.revokeObjectURL(url);
    return { data, type, w: img.naturalWidth || 400, h: img.naturalHeight || 300 };
  } catch {
    return null;
  }
}


const SYM: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ",
  pi: "π", rho: "ρ", sigma: "σ", tau: "τ", phi: "φ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω", Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Pi: "Π",
  Sigma: "Σ", Phi: "Φ", Omega: "Ω", infty: "∞", pm: "±", mp: "∓", times: "×", div: "÷", cdot: "·", leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠",
  approx: "≈", equiv: "≡", in: "∈", notin: "∉", subset: "⊂", subseteq: "⊆", cup: "∪", cap: "∩", emptyset: "∅", forall: "∀", exists: "∃", to: "→",
  rightarrow: "→", leftarrow: "←", Rightarrow: "⇒", Leftrightarrow: "⇔", iff: "⇔", partial: "∂", nabla: "∇", circ: "∘", ldots: "…", cdots: "⋯",
  mathbb: "", R: "ℝ", N: "ℕ", Z: "ℤ", Q: "ℚ", C: "ℂ", setminus: "∖", backslash: "\\", ",": " ", ";": " ", quad: "  ", qquad: "    ", "{": "{", "}": "}",
  widehat: "", overrightarrow: "", vec: "", left: "", right: "", displaystyle: "", limits: "", lim: "lim", sin: "sin", cos: "cos", tan: "tan", ln: "ln", log: "log", exp: "exp",
};

/** LaTeX simple → équation Word (OMML) : fractions, racines, exposants, indices, sommes, intégrales */
function latexToMath(d: D, src: string): any {
  const { Math: OMath, MathRun, MathFraction, MathRadical, MathSuperScript, MathSubScript, MathSubSuperScript, MathSum, MathIntegral } = d as any;
  let i = 0;
  const peek = () => src[i];
  const skipWs = () => { while (src[i] === " ") i++; };
  const readCmd = () => { i++; let n = ""; if (!/[a-zA-Z]/.test(src[i] || "")) return src[i++] || ""; while (/[a-zA-Z]/.test(src[i] || "")) n += src[i++]; return n; };
  const group = (): any[] => { skipWs(); if (peek() === "{") { i++; const r = seq("}"); i++; return r; } const a = atom(); return a ? [a] : []; };
  const atom = (): any => {
    skipWs();
    const c = peek();
    if (c === undefined) return null;
    if (c === "{") { i++; const r = seq("}"); i++; return r; }
    if (c === "\\") {
      const cmd = readCmd();
      if (cmd === "frac" || cmd === "dfrac" || cmd === "tfrac") return new MathFraction({ numerator: group(), denominator: group() });
      if (cmd === "sqrt") {
        skipWs();
        let degree: any[] | undefined;
        if (peek() === "[") { i++; degree = seq("]"); i++; }
        return new MathRadical({ children: group(), degree });
      }
      if (cmd === "sum" || cmd === "prod" || cmd === "int") {
        let sub: any[] = [], sup: any[] = [];
        for (let k = 0; k < 2; k++) { skipWs(); if (peek() === "_") { i++; sub = group(); } else if (peek() === "^") { i++; sup = group(); } }
        const body = [atom()].filter(Boolean).flat();
        return cmd === "int" ? new MathIntegral({ children: body, subScript: sub, superScript: sup }) : new MathSum({ children: body, subScript: sub, superScript: sup });
      }
      if (cmd === "text" || cmd === "mathrm" || cmd === "operatorname") { const g = group(); return g; }
      if (cmd === "mathbb") { skipWs(); const ch = peek() === "{" ? (i++, src.slice(i, (i = src.indexOf("}", i)) )) : src[i]; i++; return new MathRun(SYM[ch] || ch); }
      if (cmd in SYM) return SYM[cmd] ? new MathRun(SYM[cmd]) : (cmd === "widehat" || cmd === "overrightarrow" || cmd === "vec" ? group() : null);
      if (cmd === "begin") { const end = src.indexOf("\\end", i); const raw = src.slice(i, end > 0 ? end : undefined); i = end > 0 ? src.indexOf("}", end) + 1 : src.length; return new MathRun(raw.replace(/^\{[a-z]+\}/, "").replace(/\\\\/g, " ; ").replace(/&/g, " ")); }
      return new MathRun(cmd);
    }
    i++;
    return new MathRun(c);
  };
  const seq = (end?: string): any[] => {
    const out: any[] = [];
    while (i < src.length && src[i] !== end) {
      let base = atom();
      if (base === null) continue;
      skipWs();
      let sub: any[] | null = null, sup: any[] | null = null;
      for (let k = 0; k < 2; k++) { if (src[i] === "^") { i++; sup = group(); } else if (src[i] === "_") { i++; sub = group(); } skipWs(); }
      const b = Array.isArray(base) ? base : [base];
      if (sub && sup) base = new MathSubSuperScript({ children: b, subScript: sub, superScript: sup });
      else if (sup) base = new MathSuperScript({ children: b, superScript: sup });
      else if (sub) base = new MathSubScript({ children: b, subScript: sub });
      if (Array.isArray(base)) out.push(...base); else out.push(base);
    }
    return out;
  };
  try {
    return new OMath({ children: seq() });
  } catch {
    return new OMath({ children: [new MathRun(src)] });
  }
}

/** Retire le texte marqué « corrigé » (version élève) */
function stripCorrections(n: JSONContent): JSONContent {
  if (!n.content) return n;
  return { ...n, content: n.content.filter((c) => !c.marks?.some((m) => m.type === "correction")).map(stripCorrections) };
}

export async function exportDocx(doc: JSONContent, page: PageSettings, title: string, opts: { hideCorrections?: boolean } = {}): Promise<Blob> {
  if (opts.hideCorrections) doc = stripCorrections(doc);
  const d: D = await import("docx");
  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, ImageRun,
    ExternalHyperlink, PageBreak, ShadingType, BorderStyle, Header, Footer, PageNumber, LevelFormat, FootnoteReferenceRun,
    TableOfContents, VerticalAlign, PageOrientation, CommentRangeStart, CommentRangeEnd, CommentReference,
  } = d;

  const footnotes: Record<number, { children: InstanceType<D["Paragraph"]>[] }> = {};
  let fnId = 1;
  const comments: AnyObj[] = [];
  let commentId = 0;
  let numberingInstance = 0;
  const numberingConfigs: AnyObj[] = [];
  const size = PAGE_SIZES[page.size] || PAGE_SIZES.A4;
  const landscape = page.orientation === "landscape";
  const contentWidthPx = ((landscape ? size.h : size.w) - page.margins.left - page.margins.right) * (96 / 25.4);

  const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];
  const ALIGN: Record<string, any> = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED };

  const runOpts = (marks: AnyObj[] | undefined, rtl: boolean) => {
    const o: AnyObj = {};
    if (rtl) o.rightToLeft = true;
    for (const m of marks || []) {
      const a = m.attrs || {};
      switch (m.type) {
        case "bold": o.bold = true; if (rtl) o.boldComplexScript = true; break;
        case "italic": o.italics = true; if (rtl) o.italicsComplexScript = true; break;
        case "underline": o.underline = {}; break;
        case "strike": o.strike = true; break;
        case "code": o.font = "Consolas"; o.shading = { type: ShadingType.CLEAR, fill: "EEEEEE", color: "auto" }; break;
        case "subscript": o.subScript = true; break;
        case "superscript": o.superScript = true; break;
        case "correction": o.color = o.color || "137333"; break;
        case "highlight": o.shading = { type: ShadingType.CLEAR, fill: toHex(a.color) || "FFFF00", color: "auto" }; break;
        case "textStyle":
          if (a.color) o.color = toHex(a.color);
          if (a.fontFamily) o.font = String(a.fontFamily).split(",")[0].replace(/["']/g, "").trim();
          if (a.fontSize) { o.size = halfPoints(a.fontSize); if (rtl) o.sizeComplexScript = o.size; }
          if (a.backgroundColor) o.shading = { type: ShadingType.CLEAR, fill: toHex(a.backgroundColor), color: "auto" };
          break;
      }
    }
    return o;
  };

  const inline = async (nodes: JSONContent[] | undefined, rtl: boolean): Promise<any[]> => {
    const out: any[] = [];
    for (const n of nodes || []) {
      if (n.type === "text") {
        const link = n.marks?.find((m) => m.type === "link");
        const comment = n.marks?.find((m) => m.type === "comment");
        const opts = runOpts(n.marks, rtl);
        let run: any = new TextRun({ text: n.text || "", ...opts, ...(link ? { style: "Hyperlink" } : {}) });
        if (link?.attrs?.href) run = new ExternalHyperlink({ link: link.attrs.href, children: [run] });
        if (comment) {
          const id = commentId++;
          comments.push({ id, author: comment.attrs?.author || "Auteur", date: comment.attrs?.date ? new Date(comment.attrs.date) : new Date(), children: [new Paragraph({ children: [new TextRun(comment.attrs?.text || "")] })] });
          out.push(new CommentRangeStart(id), run, new CommentRangeEnd(id), new TextRun({ children: [new CommentReference(id)] }));
        } else out.push(run);
      } else if (n.type === "hardBreak") {
        out.push(new TextRun({ text: "", break: 1 }));
      } else if (n.type === "image") {
        const img = await imageData(n.attrs?.src);
        if (img) {
          let w = Number(n.attrs?.width) || img.w, h = Number(n.attrs?.height) || 0;
          if (!h) h = Math.round((img.h * w) / img.w);
          if (w > contentWidthPx) { h = Math.round((h * contentWidthPx) / w); w = Math.round(contentWidthPx); }
          out.push(new ImageRun({ data: img.data, type: img.type, transformation: { width: w, height: h } } as any));
        }
      } else if (n.type === "varTable") {
        const vt = parseVt(String(n.attrs?.data || ""));
        if (vt) {
          const r = renderVarTable(vt);
          // dessiné en double résolution pour une impression nette
          const hi = r.svg.replace(`width="${r.width}" height="${r.height}"`, `width="${r.width * 2}" height="${r.height * 2}"`);
          const img = await imageData(svgToDataUrl(hi));
          if (img) {
            let w = r.width, h = r.height;
            if (w > contentWidthPx) { h = Math.round((h * contentWidthPx) / w); w = Math.round(contentWidthPx); }
            out.push(new ImageRun({ data: img.data, type: img.type, transformation: { width: w, height: h } } as any));
          }
        }
      } else if (n.type === "mathInline") {
        out.push(latexToMath(d, String(n.attrs?.latex || "")));
      } else if (n.type === "footnote") {
        const id = fnId++;
        footnotes[id] = { children: [new Paragraph({ children: [new TextRun(n.attrs?.text || "")] })] };
        out.push(new FootnoteReferenceRun(id));
      }
    }
    return out;
  };

  const paraProps = (n: JSONContent) => {
    const a = (n.attrs || {}) as AnyObj;
    const p: AnyObj = {};
    if (a.textAlign && ALIGN[a.textAlign]) p.alignment = ALIGN[a.textAlign];
    const spacing: AnyObj = {};
    if (a.spaceBefore != null) spacing.before = twip(a.spaceBefore);
    if (a.spaceAfter != null) spacing.after = twip(a.spaceAfter);
    if (a.lineHeight) { const lh = parseFloat(a.lineHeight); if (!isNaN(lh)) { spacing.line = Math.round(lh * 240); spacing.lineRule = "auto"; } }
    if (Object.keys(spacing).length) p.spacing = spacing;
    const indent: AnyObj = {};
    if (a.indent) indent.start = twip(a.indent);
    if (a.firstLine) indent.firstLine = twip(a.firstLine);
    if (Object.keys(indent).length) p.indent = indent;
    if (a.dir === "rtl") p.bidirectional = true;
    if (a.shading) p.shading = { type: ShadingType.CLEAR, fill: toHex(a.shading), color: "auto" };
    if (a.border === "box") { const b = { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 4 }; p.border = { top: b, bottom: b, left: b, right: b }; }
    if (a.border === "bottom") p.border = { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 1 } };
    if (a.border === "top") p.border = { top: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 1 } };
    if (a.keepNext) p.keepNext = true;
    return p;
  };
  const isRtl = (n: JSONContent) => (n.attrs as AnyObj | undefined)?.dir === "rtl" || /[؀-ۿ]/.test(JSON.stringify(n.content || []).slice(0, 400));

  const newNumbering = (ordered: boolean, type?: string | null) => {
    const ref = `list-${numberingInstance++}`;
    const fmt = (lvl: number) => {
      if (!ordered) return { format: LevelFormat.BULLET, text: ["•", "◦", "▪"][lvl % 3] };
      const t = lvl === 0 ? type : null;
      const f = t === "a" ? LevelFormat.LOWER_LETTER : t === "A" ? LevelFormat.UPPER_LETTER : t === "i" ? LevelFormat.LOWER_ROMAN : t === "I" ? LevelFormat.UPPER_ROMAN : [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN][lvl % 3];
      return { format: f, text: `%${lvl + 1}.` };
    };
    numberingConfigs.push({
      reference: ref,
      levels: Array.from({ length: 6 }, (_, lvl) => ({
        level: lvl, ...fmt(lvl), alignment: AlignmentType.START,
        style: { paragraph: { indent: { start: 720 * (lvl + 1), hanging: 360 } } },
      })),
    });
    return ref;
  };

  const block = async (n: JSONContent, ctx: { list?: { ref: string; level: number }; task?: boolean; checked?: boolean; quote?: boolean } = {}): Promise<any[]> => {
    const rtl = isRtl(n);
    switch (n.type) {
      case "paragraph":
      case "heading": {
        const children = await inline(n.content, rtl);
        if (ctx.task) children.unshift(new TextRun({ text: ctx.checked ? "☑ " : "☐ " }));
        const p: AnyObj = { children, ...paraProps(n) };
        if (n.type === "heading") p.heading = HEADINGS[(n.attrs as AnyObj)?.level || 1];
        if (ctx.list && !ctx.task) p.numbering = { reference: ctx.list.ref, level: ctx.list.level };
        if (ctx.task) p.indent = { start: 360 * ((ctx.list?.level || 0) + 1) };
        if (ctx.quote) { p.indent = { start: 567 }; p.border = { left: { style: BorderStyle.SINGLE, size: 18, color: "BFBFBF", space: 8 } }; p.children = (await inline(n.content, rtl)).map((r: any) => r); p.style = "Quote"; }
        return [new Paragraph(p)];
      }
      case "blockquote": {
        const out: any[] = [];
        for (const c of n.content || []) out.push(...(await block(c, { ...ctx, quote: true })));
        return out;
      }
      case "codeBlock": {
        const lines = (n.content || []).map((c) => c.text || "").join("").split("\n");
        return lines.map((l) => new Paragraph({ children: [new TextRun({ text: l, font: "Consolas", size: 20 })], shading: { type: ShadingType.CLEAR, fill: "F3F3F3", color: "auto" }, spacing: { after: 0 } }));
      }
      case "bulletList":
      case "orderedList":
      case "taskList": {
        const ordered = n.type === "orderedList";
        const ref = ctx.list && ctx.list.level >= 0 && n.type !== "taskList" ? ctx.list.ref : newNumbering(ordered, (n.attrs as AnyObj)?.type);
        const level = ctx.list ? ctx.list.level + 1 : 0;
        const ownRef = ctx.list ? newNumbering(ordered, (n.attrs as AnyObj)?.type) : ref;
        const out: any[] = [];
        for (const item of n.content || []) {
          for (const c of item.content || []) {
            const isList = /List$/.test(c.type || "");
            out.push(...(await block(c, isList ? { list: { ref: ownRef, level } } : { list: { ref: ownRef, level }, task: n.type === "taskList", checked: !!(item.attrs as AnyObj)?.checked })));
          }
        }
        return out;
      }
      case "horizontalRule":
        return [new Paragraph({ children: [], border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 1 } } })];
      case "pageBreak":
        return [new Paragraph({ children: [new PageBreak()] })];
      case "toc":
        return [new Paragraph({ children: [new TextRun({ text: (n.attrs as AnyObj)?.title || "Table des matières", bold: true, size: 28 })] }), new TableOfContents("TOC", { hyperlink: true, headingStyleRange: "1-3" })];
      case "image": {
        const runs = await inline([n], rtl);
        const al = (n.attrs as AnyObj)?.align;
        return [new Paragraph({ children: runs, alignment: al === "right" ? AlignmentType.RIGHT : al === "left" ? AlignmentType.LEFT : AlignmentType.CENTER })];
      }
      case "table": {
        const rows: any[] = [];
        const styleName = (n.attrs as AnyObj)?.tableStyle || "grid";
        let ri = 0;
        for (const r of n.content || []) {
          const cells: any[] = [];
          let isHeaderRow = true;
          for (const c of r.content || []) {
            const ca = (c.attrs || {}) as AnyObj;
            if (c.type !== "tableHeader") isHeaderRow = false;
            const kids: any[] = [];
            for (const cc of c.content || []) kids.push(...(await block(cc)));
            let fill = toHex(ca.background);
            if (!fill && styleName !== "grid" && styleName !== "plain") {
              if (c.type === "tableHeader") fill = styleName === "blue" ? "2B579A" : styleName === "green" ? "217346" : "404040";
              else if (ri % 2 === 0) fill = styleName === "blue" ? "DCE6F4" : styleName === "green" ? "E2EFDA" : "F2F2F2";
            }
            const width = Array.isArray(ca.colwidth) && ca.colwidth[0] ? { size: twip(ca.colwidth[0]), type: WidthType.DXA } : undefined;
            cells.push(new TableCell({
              children: kids.length ? kids : [new Paragraph("")],
              columnSpan: ca.colspan > 1 ? ca.colspan : undefined,
              rowSpan: ca.rowspan > 1 ? ca.rowspan : undefined,
              shading: fill ? { type: ShadingType.CLEAR, fill, color: "auto" } : undefined,
              verticalAlign: ca.valign === "middle" ? VerticalAlign.CENTER : ca.valign === "bottom" ? VerticalAlign.BOTTOM : undefined,
              width,
            }));
          }
          rows.push(new TableRow({ children: cells, tableHeader: isHeaderRow }));
          ri++;
        }
        const noBorder = styleName === "plain";
        const b = { style: noBorder ? BorderStyle.NONE : BorderStyle.SINGLE, size: 4, color: "A6A6A6" };
        return [new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b } }), new Paragraph("")];
      }
      default:
        if (n.content) {
          const out: any[] = [];
          for (const c of n.content) out.push(...(await block(c, ctx)));
          return out;
        }
        return [];
    }
  };

  const children: any[] = [];
  for (const n of doc.content || []) children.push(...(await block(n)));

  const hfPara = (text: string, align: string, withPage: boolean) => {
    const runs: any[] = [];
    if (text) runs.push(new TextRun({ text, color: "666666", size: 18 }));
    if (withPage) {
      if (text) runs.push(new TextRun({ text: "   ", size: 18 }));
      runs.push(new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "666666" }));
      runs.push(new TextRun({ children: [" / ", PageNumber.TOTAL_PAGES], size: 18, color: "666666" }));
    }
    return new Paragraph({ children: runs, alignment: ALIGN[align] || AlignmentType.CENTER });
  };
  const pn = page.pageNumbers;
  const headerKids = [] as any[];
  if (page.header || pn === "header") headerKids.push(hfPara(page.header, page.headerAlign, pn === "header"));
  if (page.watermark) headerKids.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: page.watermark, color: "D9D9D9", size: 72, bold: true })] }));
  const footerKids = [] as any[];
  if (page.footer || pn === "footer") footerKids.push(hfPara(page.footer, page.footerAlign, pn === "footer"));

  const wDoc = new Document({
    creator: "Math infini — Outils Office",
    title,
    features: { updateFields: children.some((c) => c instanceof TableOfContents) },
    styles: {
      default: { document: { run: { font: page.defaultFont || "Calibri", size: Math.round((page.defaultSize || 11) * 2) }, paragraph: { spacing: { after: 160, line: 276, lineRule: "auto" as any } } } },
      paragraphStyles: [
        { id: "Quote", name: "Quote", basedOn: "Normal", run: { italics: true, color: "595959" } },
      ],
    },
    numbering: { config: numberingConfigs },
    footnotes,
    comments: { children: comments },
    background: page.pageColor ? { color: toHex(page.pageColor) } : undefined,
    sections: [{
      properties: {
        page: {
          size: { width: mmToTwip(size.w), height: mmToTwip(size.h), orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
          margin: { top: mmToTwip(page.margins.top), right: mmToTwip(page.margins.right), bottom: mmToTwip(page.margins.bottom), left: mmToTwip(page.margins.left) },
        },
        column: page.columns > 1 ? { count: page.columns, space: 708 } : undefined,
      },
      headers: headerKids.length ? { default: new Header({ children: headerKids }) } : undefined,
      footers: footerKids.length ? { default: new Footer({ children: footerKids }) } : undefined,
      children: children.length ? children : [new Paragraph("")],
    }],
  } as AnyObj as ConstructorParameters<D["Document"]>[0]);
  return Packer.toBlob(wDoc);
}

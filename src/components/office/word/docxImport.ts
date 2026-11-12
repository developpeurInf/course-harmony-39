/**
 * Ouverture d'un .docx : lecture directe du XML Word (JSZip) → HTML compris par l'éditeur.
 * Conserve titres, styles de caractères (gras, italique, souligné, barré, couleur,
 * surlignage, police, taille, exposant / indice), alignement, interligne, espacements,
 * retraits, sens droite → gauche, trames, listes à puces / numérotées (niveaux),
 * tableaux (fusions, trames), images, liens, sauts de page, notes de bas de page,
 * commentaires, et la mise en page (format, orientation, marges, colonnes, en-tête / pied).
 */
import type { PageSettings } from "./pageSettings";
import { defaultPage, PAGE_SIZES } from "./pageSettings";

type El = Element;
const kids = (el: El | null | undefined, name?: string): El[] =>
  el ? (Array.from(el.childNodes).filter((n) => n.nodeType === 1 && (!name || (n as El).localName === name)) as El[]) : [];
const kid = (el: El | null | undefined, name: string) => kids(el, name)[0] || null;
const attr = (el: El | null | undefined, name: string) => (el ? el.getAttribute(`w:${name}`) ?? el.getAttribute(name) : null);
const val = (el: El | null | undefined) => attr(el, "val");
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const twipPx = (t: string | null) => (t ? Math.round(Number(t) / 15) : null);
const isOn = (el: El | null) => !!el && !["0", "false", "none"].includes(val(el) || "");

const HL: Record<string, string> = {
  yellow: "#FFFF00", green: "#00FF00", cyan: "#00FFFF", magenta: "#FF00FF", blue: "#0000FF", red: "#FF0000", darkBlue: "#000080",
  darkCyan: "#008080", darkGreen: "#008000", darkMagenta: "#800080", darkRed: "#800000", darkYellow: "#808000", darkGray: "#808080",
  lightGray: "#C0C0C0", black: "#000000", white: "#FFFFFF",
};

interface Ctx {
  rels: Record<string, string>;
  media: Record<string, string>;
  headingOf: Record<string, number>;
  quoteStyles: Set<string>;
  numFmt: Record<string, Record<string, string>>;
  footnotes: Record<string, string>;
  comments: Record<string, { text: string; author: string; date: string }>;
  openComments: Set<string>;
  styleNum: Record<string, { numId: string; ilvl: number }>;
}

export async function importDocx(buf: ArrayBuffer): Promise<{ html: string; page: PageSettings }> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buf);
  const parse = async (path: string) => {
    const f = zip.file(path);
    if (!f) return null;
    return new DOMParser().parseFromString(await f.async("text"), "application/xml");
  };
  const docXml = await parse("word/document.xml");
  if (!docXml) throw new Error("document.xml manquant");

  // relations (images, liens)
  const rels: Record<string, string> = {};
  const relsXml = await parse("word/_rels/document.xml.rels");
  relsXml?.querySelectorAll("Relationship").forEach((r) => { rels[r.getAttribute("Id") || ""] = r.getAttribute("Target") || ""; });
  const media: Record<string, string> = {};
  for (const [id, target] of Object.entries(rels)) {
    if (!/^media\//.test(target) && !/\.(png|jpe?g|gif|bmp|svg|webp|emf|wmf)$/i.test(target)) continue;
    const p = target.startsWith("/") ? target.slice(1) : `word/${target}`;
    const f = zip.file(p);
    if (!f) continue;
    const ext = (p.split(".").pop() || "png").toLowerCase();
    if (ext === "emf" || ext === "wmf") continue;
    const mime = ext === "jpg" ? "image/jpeg" : ext === "svg" ? "image/svg+xml" : `image/${ext}`;
    media[id] = `data:${mime};base64,${await f.async("base64")}`;
  }

  // styles : titres et citations
  const headingOf: Record<string, number> = {};
  const quoteStyles = new Set<string>();
  const styleNum: Record<string, { numId: string; ilvl: number }> = {};
  const stylesXml = await parse("word/styles.xml");
  stylesXml?.querySelectorAll("style").forEach((s) => {
    const id = s.getAttribute("w:styleId") || "";
    const name = (val(kid(s, "name")) || "").toLowerCase();
    const m = name.match(/^(?:heading|titre)\s*(\d)/) || id.match(/^(?:Heading|Titre)(\d)$/);
    if (m) headingOf[id] = Math.min(6, Number(m[1]));
    else if (name === "title" || id === "Title" || id === "Titre") headingOf[id] = 1;
    else if (name === "subtitle" || id === "Subtitle" || id === "Sous-titre") headingOf[id] = 2;
    const outline = kid(kid(s, "pPr"), "outlineLvl");
    if (!headingOf[id] && outline && s.getAttribute("w:type") === "paragraph") headingOf[id] = Math.min(6, Number(val(outline)) + 1);
    if (/quote|citation/.test(name)) quoteStyles.add(id);
    const snp = kid(kid(s, "pPr"), "numPr");
    if (snp && val(kid(snp, "numId"))) styleNum[id] = { numId: val(kid(snp, "numId")) || "", ilvl: Number(val(kid(snp, "ilvl")) || 0) };
  });

  // numérotation
  const numFmt: Record<string, Record<string, string>> = {};
  const numXml = await parse("word/numbering.xml");
  if (numXml) {
    const abs: Record<string, Record<string, string>> = {};
    kids(numXml.documentElement, "abstractNum").forEach((a) => {
      const id = attr(a, "abstractNumId") || "";
      abs[id] = {};
      kids(a, "lvl").forEach((l) => { abs[id][attr(l, "ilvl") || "0"] = val(kid(l, "numFmt")) || "bullet"; });
    });
    kids(numXml.documentElement, "num").forEach((n) => {
      numFmt[attr(n, "numId") || ""] = abs[val(kid(n, "abstractNumId")) || ""] || {};
    });
  }

  const footnotes: Record<string, string> = {};
  const fnXml = await parse("word/footnotes.xml");
  fnXml && kids(fnXml.documentElement, "footnote").forEach((f) => { footnotes[attr(f, "id") || ""] = (f.textContent || "").trim(); });
  const comments: Ctx["comments"] = {};
  const cmXml = await parse("word/comments.xml");
  cmXml && kids(cmXml.documentElement, "comment").forEach((c) => {
    comments[attr(c, "id") || ""] = { text: (c.textContent || "").trim(), author: attr(c, "author") || "", date: attr(c, "date") || "" };
  });

  const ctx: Ctx = { rels, media, headingOf, quoteStyles, numFmt, footnotes, comments, openComments: new Set(), styleNum };
  const body = kid(docXml.documentElement, "body");
  const html = blocks(kids(body), ctx);

  // mise en page
  const page = defaultPage();
  const sect = kid(body, "sectPr");
  if (sect) {
    const pgSz = kid(sect, "pgSz");
    if (pgSz) {
      const w = Number(attr(pgSz, "w")) / 1440 * 25.4, h = Number(attr(pgSz, "h")) / 1440 * 25.4;
      const landscape = attr(pgSz, "orient") === "landscape" || w > h;
      page.orientation = landscape ? "landscape" : "portrait";
      const [pw, ph] = landscape ? [h, w] : [w, h];
      const best = (Object.entries(PAGE_SIZES) as [PageSettings["size"], { w: number; h: number }][]).sort((a, b) => Math.abs(a[1].w - pw) + Math.abs(a[1].h - ph) - (Math.abs(b[1].w - pw) + Math.abs(b[1].h - ph)))[0];
      if (best) page.size = best[0];
    }
    const mar = kid(sect, "pgMar");
    if (mar) {
      const mm = (n: string | null) => (n ? Math.round((Number(n) / 1440) * 25.4 * 10) / 10 : 25);
      page.margins = { top: Math.abs(mm(attr(mar, "top"))), right: mm(attr(mar, "right")), bottom: Math.abs(mm(attr(mar, "bottom"))), left: mm(attr(mar, "left")) };
    }
    const cols = Number(attr(kid(sect, "cols"), "num") || 1);
    page.columns = (cols >= 3 ? 3 : cols === 2 ? 2 : 1) as 1 | 2 | 3;
    const hdr = kids(sect, "headerReference").find((h) => attr(h, "type") === "default");
    const ftr = kids(sect, "footerReference").find((h) => attr(h, "type") === "default");
    const hfText = async (ref: El | undefined) => {
      if (!ref) return { text: "", page: false };
      const target = rels[ref.getAttribute("r:id") || ""];
      const x = target ? await parse(`word/${target}`) : null;
      const instr = x ? Array.from(x.getElementsByTagName("w:instrText")).map((t) => t.textContent || "").join(" ") + Array.from(x.getElementsByTagName("w:fldSimple")).map((f) => f.getAttribute("w:instr") || "").join(" ") : "";
      return { text: (x ? Array.from(x.getElementsByTagName("w:t")).map((t) => t.textContent).join("") : "").trim(), page: /PAGE/.test(instr) };
    };
    const h = await hfText(hdr), f = await hfText(ftr);
    page.header = h.text.replace(/\d+\s*\/\s*\d+$/, "").trim();
    page.footer = f.text.replace(/\d+\s*\/\s*\d+$/, "").replace(/^\d+$/, "").trim();
    page.pageNumbers = f.page ? "footer" : h.page ? "header" : "none";
  }
  const bg = kid(docXml.documentElement, "background");
  if (bg && attr(bg, "color") && attr(bg, "color") !== "FFFFFF") page.pageColor = `#${attr(bg, "color")}`;
  const defRun = stylesXml?.querySelector("docDefaults rPrDefault rPr");
  if (defRun) {
    const font = attr(kid(defRun, "rFonts"), "ascii");
    const sz = val(kid(defRun, "sz"));
    if (font) page.defaultFont = font;
    if (sz) page.defaultSize = Number(sz) / 2;
  }
  return { html: html || "<p></p>", page };
}

function blocks(els: El[], ctx: Ctx): string {
  let out = "";
  let i = 0;
  while (i < els.length) {
    const el = els[i];
    if (el.localName === "p" && numOf(el, ctx)) {
      // liste : paragraphes numérotés consécutifs
      const group: El[] = [];
      while (i < els.length && els[i].localName === "p" && numOf(els[i], ctx)) group.push(els[i++]);
      out += list(group, ctx);
      continue;
    }
    if (el.localName === "p") out += paragraph(el, ctx);
    else if (el.localName === "tbl") out += table(el, ctx);
    else if (el.localName === "sdt") out += blocks(kids(kid(el, "sdtContent")), ctx);
    i++;
  }
  return out;
}

function numOf(p: El, ctx: Ctx) {
  const pPr = kid(p, "pPr");
  const np = kid(pPr, "numPr");
  if (!np) {
    const sn = ctx.styleNum[val(kid(pPr, "pStyle")) || ""];
    return sn && sn.numId !== "0" ? sn : null;
  }
  const numId = val(kid(np, "numId"));
  if (!numId || numId === "0") return null;
  return { numId, ilvl: Number(val(kid(np, "ilvl")) || 0) };
}

function list(ps: El[], ctx: Ctx): string {
  let html = "";
  const stack: { tag: string }[] = [];
  const open = (fmt: string) => {
    const ordered = fmt !== "bullet" && fmt !== "none";
    const type = fmt === "lowerLetter" ? "a" : fmt === "upperLetter" ? "A" : fmt === "lowerRoman" ? "i" : fmt === "upperRoman" ? "I" : "";
    const tag = ordered ? "ol" : "ul";
    html += `<${tag}${type ? ` type="${type}"` : ""}>`;
    stack.push({ tag });
  };
  for (const p of ps) {
    const n = numOf(p, ctx)!;
    const fmt = ctx.numFmt[n.numId]?.[String(n.ilvl)] || "bullet";
    while (stack.length > n.ilvl + 1) html += `</li></${stack.pop()!.tag}>`;
    if (stack.length === n.ilvl + 1) html += "</li>";
    while (stack.length < n.ilvl + 1) open(fmt);
    html += `<li>${paragraph(p, ctx, true)}`;
  }
  while (stack.length) html += `</li></${stack.pop()!.tag}>`;
  return html;
}

function paragraph(p: El, ctx: Ctx, inList = false): string {
  const pPr = kid(p, "pPr");
  const styleId = val(kid(pPr, "pStyle")) || "";
  const level = ctx.headingOf[styleId];
  const css: string[] = [];
  let dirAttr = "";
  const jc = val(kid(pPr, "jc"));
  const bidi = isOn(kid(pPr, "bidi"));
  if (jc) {
    const map: Record<string, string> = { left: bidi ? "right" : "left", start: bidi ? "right" : "left", center: "center", right: bidi ? "left" : "right", end: bidi ? "left" : "right", both: "justify", distribute: "justify" };
    if (map[jc]) css.push(`text-align:${map[jc]}`);
  }
  if (bidi) dirAttr = ' dir="rtl"';
  const sp = kid(pPr, "spacing");
  if (sp) {
    const b = twipPx(attr(sp, "before")), a = twipPx(attr(sp, "after"));
    if (b !== null) css.push(`margin-top:${b}px`);
    if (a !== null) css.push(`margin-bottom:${a}px`);
    const line = attr(sp, "line"), rule = attr(sp, "lineRule");
    if (line && (!rule || rule === "auto")) css.push(`line-height:${Math.round((Number(line) / 240) * 100) / 100}`);
  }
  const ind = kid(pPr, "ind");
  if (ind && !inList) {
    const left = twipPx(attr(ind, "start") || attr(ind, "left"));
    if (left) css.push(`margin-inline-start:${left}px`);
    const fl = twipPx(attr(ind, "firstLine"));
    const hg = twipPx(attr(ind, "hanging"));
    if (fl) css.push(`text-indent:${fl}px`);
    else if (hg) css.push(`text-indent:-${hg}px`);
  }
  const shd = attr(kid(pPr, "shd"), "fill");
  let shading = "";
  if (shd && shd !== "auto" && shd !== "FFFFFF") shading = ` data-shading="#${shd}"`;
  let pageBreakBefore = isOn(kid(pPr, "pageBreakBefore")) ? '<div data-page-break="1"></div>' : "";

  let inner = "";
  for (const r of kids(p)) inner += runLike(r, ctx);
  // saut de page dans un run : on coupe le paragraphe
  let after = "";
  if (inner.includes("\u0000PB\u0000")) {
    const parts = inner.split("\u0000PB\u0000");
    inner = parts[0];
    after = parts.slice(1).map((x) => `<div data-page-break="1"></div>${x.trim() ? `<p>${x}</p>` : ""}`).join("");
  }
  const style = css.length ? ` style="${css.join(";")}"` : "";
  if (ctx.quoteStyles.has(styleId)) return `${pageBreakBefore}<blockquote><p${style}${dirAttr}>${inner}</p></blockquote>${after}`;
  const tag = level ? `h${level}` : "p";
  const out = `${pageBreakBefore}<${tag}${style}${dirAttr}${shading}>${inner}</${tag}>${after}`;
  pageBreakBefore = "";
  return out;
}

function runLike(el: El, ctx: Ctx): string {
  switch (el.localName) {
    case "r": return run(el, ctx);
    case "hyperlink": {
      const id = el.getAttribute("r:id");
      const href = id ? ctx.rels[id] : el.getAttribute("w:anchor") ? `#${el.getAttribute("w:anchor")}` : "";
      const inner = kids(el).map((r) => runLike(r, ctx)).join("");
      return href ? `<a href="${esc(href)}">${inner}</a>` : inner;
    }
    case "ins": case "smartTag": case "fldSimple": case "customXml": case "bdo": case "dir":
      return kids(el).map((r) => runLike(r, ctx)).join("");
    case "sdt": return kids(kid(el, "sdtContent")).map((r) => runLike(r, ctx)).join("");
    case "commentRangeStart": ctx.openComments.add(attr(el, "id") || ""); return "";
    case "commentRangeEnd": ctx.openComments.delete(attr(el, "id") || ""); return "";
    case "oMath": case "oMathPara": return `<span data-latex="${esc((el.textContent || "").trim())}"></span>`;
    default: return "";
  }
}

function run(r: El, ctx: Ctx): string {
  const rPr = kid(r, "rPr");
  let text = "";
  for (const c of kids(r)) {
    switch (c.localName) {
      case "t": text += esc(c.textContent || ""); break;
      case "tab": text += "&emsp;"; break;
      case "br": text += attr(c, "type") === "page" ? "\u0000PB\u0000" : "<br>"; break;
      case "cr": text += "<br>"; break;
      case "noBreakHyphen": text += "‑"; break;
      case "sym": text += String.fromCharCode(parseInt(attr(c, "char") || "20", 16)); break;
      case "drawing": case "pict": {
        const blip = c.getElementsByTagName("a:blip")[0] || c.getElementsByTagName("v:imagedata")[0];
        const id = blip?.getAttribute("r:embed") || blip?.getAttribute("r:id");
        const src = id ? ctx.media[id] : null;
        if (src) {
          const ext = c.getElementsByTagName("wp:extent")[0];
          const w = ext ? Math.round(Number(ext.getAttribute("cx")) / 9525) : 0;
          const anchor = c.getElementsByTagName("wp:anchor")[0];
          const alignH = anchor?.getElementsByTagName("wp:align")[0]?.textContent;
          const align = alignH === "right" ? ' data-align="right"' : alignH === "left" ? ' data-align="left"' : "";
          text += `<img src="${src}"${w ? ` width="${w}"` : ""}${align}>`;
        }
        break;
      }
      case "footnoteReference": {
        const id = attr(c, "id") || "";
        text += `<sup data-footnote="${esc(ctx.footnotes[id] || "")}"></sup>`;
        break;
      }
      case "AlternateContent": {
        const fb = c.getElementsByTagName("mc:Fallback")[0] || c.getElementsByTagName("mc:Choice")[0];
        if (fb) text += kids(fb).map((x) => (x.localName === "drawing" || x.localName === "pict" ? run(wrapRun(x), ctx) : "")).join("");
        break;
      }
    }
  }
  if (!text) return "";
  if (!rPr) return wrapComment(text, ctx);
  let html = text;
  const span: string[] = [];
  const color = val(kid(rPr, "color"));
  if (color && color !== "auto" && color !== "000000") span.push(`color:#${color}`);
  const fonts = kid(rPr, "rFonts");
  const font = attr(fonts, "ascii") || attr(fonts, "hAnsi") || attr(fonts, "cs");
  if (font) span.push(`font-family:${font}`);
  const sz = val(kid(rPr, "sz")) || val(kid(rPr, "szCs"));
  if (sz) span.push(`font-size:${Number(sz) / 2}pt`);
  const shdFill = attr(kid(rPr, "shd"), "fill");
  if (shdFill && shdFill !== "auto" && shdFill !== "FFFFFF") span.push(`background-color:#${shdFill}`);
  if (span.length) html = `<span style="${span.join(";")}">${html}</span>`;
  const hl = val(kid(rPr, "highlight"));
  if (hl && hl !== "none" && HL[hl]) html = `<mark data-color="${HL[hl]}" style="background-color:${HL[hl]}">${html}</mark>`;
  const va = val(kid(rPr, "vertAlign"));
  if (va === "superscript") html = `<sup>${html}</sup>`;
  if (va === "subscript") html = `<sub>${html}</sub>`;
  if (isOn(kid(rPr, "strike")) || isOn(kid(rPr, "dstrike"))) html = `<s>${html}</s>`;
  const u = kid(rPr, "u");
  if (u && val(u) !== "none") html = `<u>${html}</u>`;
  if (isOn(kid(rPr, "i")) || isOn(kid(rPr, "iCs"))) html = `<em>${html}</em>`;
  if (isOn(kid(rPr, "b")) || isOn(kid(rPr, "bCs"))) html = `<strong>${html}</strong>`;
  if (isOn(kid(rPr, "caps"))) html = `<span style="text-transform:uppercase">${html}</span>`;
  return wrapComment(html, ctx);
}

function wrapRun(x: El): El {
  const doc = x.ownerDocument;
  const r = doc.createElementNS("http://schemas.openxmlformats.org/wordprocessingml/2006/main", "w:r");
  r.appendChild(x.cloneNode(true));
  return r;
}

function wrapComment(html: string, ctx: Ctx) {
  if (!ctx.openComments.size) return html;
  const id = [...ctx.openComments][0];
  const c = ctx.comments[id];
  if (!c) return html;
  return `<span data-comment="${esc(c.text)}" data-author="${esc(c.author)}" data-date="${esc(c.date)}">${html}</span>`;
}

function table(tbl: El, ctx: Ctx): string {
  const rows = kids(tbl, "tr");
  // grille : fusions verticales (vMerge) → rowspan
  const grid: { el: El; col: number; span: number; vm: string | null; rowspan: number; skip: boolean }[][] = [];
  rows.forEach((tr, ri) => {
    let col = 0;
    grid[ri] = kids(tr, "tc").map((tc) => {
      const tcPr = kid(tc, "tcPr");
      const span = Number(val(kid(tcPr, "gridSpan")) || 1);
      const vmEl = kid(tcPr, "vMerge");
      const vm = vmEl ? val(vmEl) || "continue" : null;
      const cell = { el: tc, col, span, vm, rowspan: 1, skip: false };
      col += span;
      return cell;
    });
  });
  grid.forEach((row, ri) => row.forEach((c) => {
    if (c.vm === "restart") {
      let k = ri + 1;
      while (k < grid.length) {
        const below = grid[k].find((x) => x.col === c.col);
        if (!below || below.vm !== "continue") break;
        below.skip = true;
        c.rowspan++;
        k++;
      }
    } else if (c.vm === "continue" && !c.skip) c.skip = false;
  }));
  const styleId = val(kid(kid(tbl, "tblPr"), "tblStyle")) || "";
  let html = `<table data-style="${/Plain|Grid|Light/i.test(styleId) || !styleId ? "grid" : "grid"}"><tbody>`;
  grid.forEach((row, ri) => {
    const isHeader = isOn(kid(kid(rows[ri], "trPr"), "tblHeader"));
    html += "<tr>";
    for (const c of row) {
      if (c.skip) continue;
      const tcPr = kid(c.el, "tcPr");
      const fill = attr(kid(tcPr, "shd"), "fill");
      const v = val(kid(tcPr, "vAlign"));
      const w = attr(kid(tcPr, "tcW"), "w");
      const wType = attr(kid(tcPr, "tcW"), "type");
      const tag = isHeader ? "th" : "td";
      const attrs = [
        c.span > 1 ? `colspan="${c.span}"` : "",
        c.rowspan > 1 ? `rowspan="${c.rowspan}"` : "",
        fill && fill !== "auto" ? `data-bg="#${fill}"` : "",
        v ? `data-valign="${v === "center" ? "middle" : v}"` : "",
        w && wType === "dxa" ? `colwidth="${Math.round(Number(w) / 15)}"` : "",
      ].filter(Boolean).join(" ");
      html += `<${tag}${attrs ? " " + attrs : ""}>${blocks(kids(c.el), ctx) || "<p></p>"}</${tag}>`;
    }
    html += "</tr>";
  });
  return html + "</tbody></table>";
}

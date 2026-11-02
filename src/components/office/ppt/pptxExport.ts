/**
 * Export .pptx (pptxgenjs) : textes enrichis, formes, images, tableaux, lignes, vidéos en ligne,
 * arrière-plans (y compris dégradés et décors du thème rendus en image), notes, diapositives masquées,
 * transitions et animations d'entrée (injectées dans le XML).
 * Aussi : rendu d'une diapositive en PNG (export image / PDF).
 */
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { createElement } from "react";
import JSZip from "jszip";
import { PT, SlideView } from "./SlideView";
import { resolveColor, themeOf, type Deck, type Slide, type SlideEl, type Theme } from "./model";

const IN = 72; // 1 pouce = 72 unités de la diapositive
const noL = (fr: string) => fr;

// ---------- Rendu PNG ----------
const STYLE_PROPS = [
  "position", "left", "top", "right", "bottom", "width", "height", "display", "flex-direction", "justify-content", "align-items",
  "overflow", "transform", "transform-origin", "opacity", "filter", "background-color", "background-image", "background-size", "background-position", "background-repeat",
  "color", "font-family", "font-size", "font-weight", "font-style", "text-align", "line-height", "direction", "unicode-bidi",
  "padding-top", "padding-right", "padding-bottom", "padding-left", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "border-top", "border-right", "border-bottom", "border-left", "border-radius", "border-collapse", "list-style-type", "list-style-position",
  "box-shadow", "white-space", "overflow-wrap", "text-decoration", "text-shadow", "table-layout", "vertical-align", "object-fit", "clip-path", "box-sizing",
];

function inlineStyles(src: Element, dst: Element) {
  const cs = getComputedStyle(src);
  const parts: string[] = [];
  for (const p of STYLE_PROPS) {
    const v = cs.getPropertyValue(p);
    if (v) parts.push(`${p}:${v}`);
  }
  (dst as HTMLElement).setAttribute("style", parts.join(";"));
  const sc = src.children, dc = dst.children;
  for (let i = 0; i < sc.length; i++) if (dc[i] && !(sc[i] instanceof SVGElement && sc[i].tagName !== "svg")) inlineStyles(sc[i], dc[i]);
}

async function inlineImages(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(imgs.map(async (img) => {
    const src = img.getAttribute("src") || "";
    if (src.startsWith("data:")) return;
    try {
      const b = await (await fetch(src, { mode: "cors" })).blob();
      img.setAttribute("src", await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(b); }));
    } catch { img.removeAttribute("src"); }
  }));
}

/** Rend une diapositive (ou seulement son fond si `bgOnly`) en image PNG */
export async function slideToPng(deck: Deck, slide: Slide, opts?: { scale?: number; bgOnly?: boolean }): Promise<string> {
  const scale = opts?.scale ?? 2;
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${deck.w}px;height:${deck.h}px;pointer-events:none;`;
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    const s = opts?.bgOnly ? { ...slide, els: [] } : slide;
    flushSync(() => root.render(createElement(SlideView, { slide: s, deck: opts?.bgOnly ? { ...deck, footer: undefined } : deck, scale: 1, mode: "thumb", L: noL, footer: !opts?.bgOnly })));
    await new Promise((r) => setTimeout(r, 30));
    await Promise.all(Array.from(host.querySelectorAll("img")).map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
    const src = host.firstElementChild as HTMLElement;
    const clone = src.cloneNode(true) as HTMLElement;
    inlineStyles(src, clone);
    await inlineImages(clone);
    clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    const css = `.ppt-text p{margin:0 0 .25em}.ppt-text ul,.ppt-text ol{margin:0;padding-inline-start:1.25em}.ppt-text li{margin:0 0 .35em}`;
    const xhtml = new XMLSerializer().serializeToString(clone);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${deck.w * scale}" height="${deck.h * scale}"><foreignObject x="0" y="0" width="${deck.w}" height="${deck.h}" transform="scale(${scale})"><style>${css}</style>${xhtml}</foreignObject></svg>`;
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("render")); img.src = url; });
    const c = document.createElement("canvas");
    c.width = deck.w * scale; c.height = deck.h * scale;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0);
    return c.toDataURL("image/png");
  } finally {
    root.unmount();
    host.remove();
  }
}

// ---------- Texte enrichi → segments pptxgenjs ----------
type Run = { text: string; options: Record<string, unknown> };
const hex = (c?: string) => {
  if (!c) return undefined;
  if (c.startsWith("#")) { const h = c.slice(1); return (h.length === 3 ? h.split("").map((x) => x + x).join("") : h.slice(0, 6)).toUpperCase(); }
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();
  return undefined;
};

function htmlToRuns(html: string, base: Record<string, unknown>): Run[] {
  const div = document.createElement("div");
  div.innerHTML = html || "";
  const out: Run[] = [];
  type Fmt = Record<string, unknown>;
  const pushBreak = (para: Fmt) => {
    if (!out.length) return;
    const last = out[out.length - 1];
    last.options = { ...last.options, ...para, breakLine: true };
  };
  const walk = (node: Node, fmt: Fmt, para: Fmt) => {
    if (node.nodeType === 3) {
      const t = (node.textContent || "").replace(/\s+/g, " ");
      if (t) out.push({ text: t, options: { ...base, ...fmt, ...para } });
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as HTMLElement;
    const tag = el.tagName;
    const f: Fmt = { ...fmt };
    if (tag === "B" || tag === "STRONG") f.bold = true;
    if (tag === "I" || tag === "EM") f.italic = true;
    if (tag === "U") f.underline = { style: "sng" };
    if (tag === "S" || tag === "STRIKE" || tag === "DEL") f.strike = "sngStrike";
    if (tag === "SUP") f.superscript = true;
    if (tag === "SUB") f.subscript = true;
    if (tag === "A") f.hyperlink = { url: el.getAttribute("href") || "" };
    if (tag === "FONT") { const c = el.getAttribute("color"); if (c) f.color = hex(c); const fa = el.getAttribute("face"); if (fa) f.fontFace = fa; }
    const st = el.style;
    if (st.fontWeight && (st.fontWeight === "bold" || Number(st.fontWeight) >= 600)) f.bold = true;
    if (st.fontStyle === "italic") f.italic = true;
    if (st.textDecoration?.includes("underline") || st.textDecorationLine?.includes("underline")) f.underline = { style: "sng" };
    if (st.textDecoration?.includes("line-through") || st.textDecorationLine?.includes("line-through")) f.strike = "sngStrike";
    if (st.color) f.color = hex(st.color);
    if (st.backgroundColor) f.highlight = hex(st.backgroundColor);
    if (st.fontFamily) f.fontFace = st.fontFamily.split(",")[0].replace(/["']/g, "").trim();
    if (st.fontSize?.endsWith("px")) f.fontSize = Math.round(parseFloat(st.fontSize) * 0.75 * PT * 10) / 10;
    if (tag === "BR") { if (out.length) out[out.length - 1].options.breakLine = true; else out.push({ text: "", options: { ...base, breakLine: true } }); return; }
    const isBlock = /^(P|DIV|LI|H\d|BLOCKQUOTE)$/.test(tag);
    if (tag === "UL" || tag === "OL") {
      const indent = (Number(para.indentLevel) || -1) + 1;
      Array.from(el.children).forEach((li) => {
        const p: Fmt = { ...para, indentLevel: indent, bullet: tag === "OL" ? { type: "number" } : true };
        if ((li as HTMLElement).tagName === "LI") {
          const start = out.length;
          Array.from(li.childNodes).forEach((c) => { if ((c as HTMLElement).tagName === "UL" || (c as HTMLElement).tagName === "OL") { pushBreak(p); walk(c, f, para); } else walk(c, f, p); });
          if (out.length === start) out.push({ text: "", options: { ...base, ...p } });
          pushBreak(p);
        } else walk(li, f, para);
      });
      return;
    }
    const p: Fmt = { ...para };
    if (isBlock) {
      const ta = st.textAlign;
      if (ta) p.align = ta === "justify" ? "justify" : ta === "start" ? "left" : ta === "end" ? "right" : ta;
      if (el.dir === "rtl" || st.direction === "rtl") p.rtlMode = true;
    }
    const start = out.length;
    el.childNodes.forEach((c) => walk(c, f, p));
    if (isBlock && tag !== "LI") { if (out.length === start) out.push({ text: "", options: { ...base, ...p } }); pushBreak(p); }
  };
  div.childNodes.forEach((c) => walk(c, {}, {}));
  if (out.length) { const l = out[out.length - 1]; delete l.options.breakLine; }
  return out.length ? out : [{ text: "", options: base }];
}

const SHAPE_MAP: Record<string, string> = {
  rect: "rect", roundRect: "roundRect", ellipse: "ellipse", triangle: "triangle", rtTriangle: "rtTriangle", diamond: "diamond", pentagon: "pentagon",
  hexagon: "hexagon", octagon: "octagon", star5: "star5", star6: "star6", rightArrow: "rightArrow", leftArrow: "leftArrow", upArrow: "upArrow",
  downArrow: "downArrow", chevron: "chevron", plus: "mathPlus", parallelogram: "parallelogram", trapezoid: "trapezoid", callout: "wedgeRectCallout",
  heart: "heart", moon: "moon", cloud: "cloud", lightning: "lightningBolt",
};

const imgData = (src: string) => (src.startsWith("data:") ? { data: src.slice(5) } : { path: src });

async function toPngIfNeeded(src: string): Promise<string> {
  if (!src.startsWith("data:") || /^data:image\/(png|jpe?g|gif);/i.test(src)) return src;
  // WebP / SVG… → PNG pour une compatibilité maximale
  const img = new Image();
  await new Promise((r) => { img.onload = img.onerror = r; img.src = src; });
  const c = document.createElement("canvas");
  c.width = img.naturalWidth || 800; c.height = img.naturalHeight || 600;
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}

function baseText(el: SlideEl, theme: Theme): Record<string, unknown> {
  const isTitle = el.ph === "title";
  return {
    fontFace: (el.font || (isTitle ? theme.headFont : theme.bodyFont)).split(",")[0].trim(),
    fontSize: Math.round((el.size || 18) * PT * 10) / 10,
    color: hex(resolveColor(el.color, theme, isTitle ? theme.title : theme.text)),
    bold: !!el.bold, italic: !!el.italic,
    underline: el.underline ? { style: "sng" } : undefined,
    strike: el.strike ? "sngStrike" : undefined,
  };
}

// ---------- Export ----------
export async function exportPptx(deck: Deck): Promise<Blob> {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  const theme = themeOf(deck.theme);
  pptx.defineLayout({ name: "CUSTOM", width: deck.w / IN, height: deck.h / IN });
  pptx.layout = "CUSTOM";
  pptx.title = "Présentation";
  const animMaps: { order: number; type: string; idx: number }[][] = [];

  for (const [si, s] of deck.slides.entries()) {
    const slide = pptx.addSlide();
    if (s.hidden) slide.hidden = true;
    // Arrière-plan
    const needsImage = !!s.bg?.gradient || (!s.bg && (theme.bg.includes("gradient") || (theme.deco && theme.deco !== "none")));
    if (s.bg?.image) slide.background = imgData(await toPngIfNeeded(s.bg.image));
    else if (needsImage) slide.background = { data: (await slideToPng(deck, s, { bgOnly: true, scale: 1.5 })).slice(5) };
    else slide.background = { color: hex(s.bg?.color || theme.bg) || "FFFFFF" };

    const anims: { order: number; type: string; idx: number }[] = [];
    let objIdx = 0;
    for (const el of s.els) {
      const pos = { x: el.x / IN, y: el.y / IN, w: Math.max(el.w, 1) / IN, h: Math.max(el.h, 1) / IN, rotate: el.rot || undefined };
      const fill = resolveColor(el.fill, theme);
      const stroke = resolveColor(el.stroke, theme);
      const line = stroke ? { color: hex(stroke), width: el.strokeW || (el.kind === "text" ? 1 : 2), dashType: el.dash === "dash" ? "dash" : el.dash === "dot" ? "sysDot" : "solid" } : undefined;
      const transparency = el.opacity !== undefined && el.opacity < 1 ? Math.round((1 - el.opacity) * 100) : undefined;
      const shadow = el.shadow ? { type: "outer", blur: 8, offset: 4, angle: 90, color: "000000", opacity: 0.35 } : undefined;
      let added = true;
      if (el.kind === "text" || el.kind === "shape") {
        const runs = htmlToRuns(el.html || "", baseText(el, theme));
        slide.addText(runs as never, {
          ...pos,
          shape: el.kind === "shape" ? (SHAPE_MAP[el.shape || "rect"] || "rect") as never : undefined,
          fill: fill ? { color: hex(fill), transparency } : undefined,
          line: line as never,
          align: (el.align || (el.dir === "rtl" ? "right" : "left")) as never,
          valign: (el.valign || "top") as never,
          rtlMode: el.dir === "rtl",
          lineSpacingMultiple: el.lineHeight || undefined,
          margin: el.kind === "text" ? [4, 7, 4, 7] : [6, 10, 6, 10],
          shadow: shadow as never,
          rectRadius: el.shape === "roundRect" ? 0.15 : undefined,
        });
      } else if (el.kind === "image" && el.src) {
        const src = await toPngIfNeeded(el.src);
        slide.addImage({ ...imgData(src), ...pos, rounding: el.crop === "circle", sizing: { type: "cover", w: pos.w, h: pos.h }, transparency, shadow: shadow as never } as never);
      } else if (el.kind === "line") {
        slide.addShape("line" as never, { x: pos.x, y: (el.y + el.h / 2) / IN, w: pos.w, h: 0, rotate: pos.rotate, line: { color: hex(stroke || theme.text), width: el.strokeW || 3, dashType: el.dash === "dash" ? "dash" : el.dash === "dot" ? "sysDot" : "solid", endArrowType: el.arrow ? "triangle" : undefined } as never });
      } else if (el.kind === "table" && el.table) {
        const t = el.table;
        const head = hex(resolveColor(t.style === "theme" ? "accent" : t.style, theme) || theme.accents[0]);
        const base = baseText(el, theme);
        const rows = t.rows.map((r, ri) => r.map((cell) => ({
          text: cell,
          options: {
            ...base,
            fontSize: Math.round((el.size || 14) * PT * 10) / 10,
            bold: t.header && ri === 0 ? true : !!el.bold,
            color: t.header && ri === 0 ? "FFFFFF" : base.color,
            fill: { color: t.header && ri === 0 ? head : ri % 2 === 1 ? "EDEDED" : "FFFFFF" },
            valign: "middle",
            rtlMode: el.dir === "rtl",
            align: el.dir === "rtl" ? "right" : "left",
          },
        })));
        slide.addTable(rows as never, { x: pos.x, y: pos.y, w: pos.w, h: pos.h, border: { type: "solid", pt: 1, color: hex(stroke) || "BFBFBF" }, colW: Array(t.rows[0]?.length || 1).fill(pos.w / (t.rows[0]?.length || 1)) });
      } else if (el.kind === "video" && el.url) {
        const yt = el.url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{6,})/);
        if (yt) slide.addMedia({ type: "online", link: `https://www.youtube.com/embed/${yt[1]}`, ...pos } as never);
        else added = false;
      } else added = false;
      if (added) {
        if (el.anim && el.anim.type !== "none") anims.push({ order: el.anim.order, type: el.anim.type, idx: objIdx });
        objIdx++;
      }
    }
    // Pied de page
    if (deck.footer && (deck.footer.text || deck.footer.number || deck.footer.date)) {
      const fo = { fontSize: 12, color: hex(theme.text), y: (deck.h - 30) / IN, h: 0.3 };
      if (deck.footer.date) slide.addText(new Date().toLocaleDateString(), { ...fo, x: 0.4, w: 3, align: "left" });
      if (deck.footer.text) slide.addText(deck.footer.text, { ...fo, x: deck.w / IN / 2 - 3, w: 6, align: "center" });
      if (deck.footer.number) slide.slideNumber = { x: deck.w / IN - 1.2, y: fo.y, w: 0.8, h: 0.3, fontSize: 12, color: hex(theme.text), align: "right" } as never;
    }
    if (s.notes) slide.addNotes(s.notes);
    animMaps[si] = anims;
  }

  const buf = (await pptx.write({ outputType: "arraybuffer" })) as ArrayBuffer;
  // Transitions et animations
  const zip = await JSZip.loadAsync(buf);
  for (const [si, s] of deck.slides.entries()) {
    const path = `ppt/slides/slide${si + 1}.xml`;
    const f = zip.file(path);
    if (!f) continue;
    let xml = await f.async("string");
    let extra = "";
    if (s.transition.type !== "none") extra += transitionXml(s.transition.type, s.transition.dur);
    if (animMaps[si]?.length) extra += timingXml(xml, animMaps[si]);
    if (!extra) continue;
    xml = xml.includes("</p:clrMapOvr>") ? xml.replace("</p:clrMapOvr>", `</p:clrMapOvr>${extra}`) : xml.replace(/(<p:extLst>[\s\S]*<\/p:extLst>\s*)?<\/p:sld>/, (m) => `${extra}${m}`);
    zip.file(path, xml);
  }
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
}

function transitionXml(type: string, dur: number) {
  const spd = dur < 0.5 ? "fast" : dur < 1 ? "med" : "slow";
  const inner: Record<string, string> = {
    fade: "<p:fade/>", push: '<p:push dir="u"/>', wipe: '<p:wipe dir="r"/>', zoom: "<p:zoom/>", cover: '<p:cover dir="l"/>',
    split: '<p:split orient="vert" dir="out"/>', reveal: '<p:fade thruBlk="1"/>', flip: "<p:circle/>", morph: "<p:fade/>",
  };
  return `<p:transition spd="${spd}">${inner[type] || "<p:fade/>"}</p:transition>`;
}

function timingXml(slideXml: string, anims: { order: number; type: string; idx: number }[]) {
  // identifiants des formes dans l'ordre de l'arbre (le premier, id=1, est le groupe racine)
  const ids = Array.from(slideXml.matchAll(/<p:cNvPr[^>]*\sid="(\d+)"/g)).map((m) => m[1]).filter((id) => id !== "1");
  let n = 3;
  const id = () => n++;
  const orders = Array.from(new Set(anims.map((a) => a.order))).sort((a, b) => a - b);
  const clicks = orders.map((o) => {
    const group = anims.filter((a) => a.order === o);
    const effects = group.map((a, gi) => {
      const spid = ids[a.idx];
      if (!spid) return "";
      const preset = a.type === "appear" ? 1 : a.type.startsWith("fly") ? 2 : a.type === "wipe" ? 22 : a.type === "zoom" ? 53 : 10;
      const sub = a.type === "flyBottom" ? 4 : a.type === "flyLeft" ? 8 : a.type === "flyRight" ? 2 : a.type === "wipe" ? 8 : 0;
      const filter = a.type === "wipe" ? "wipe(left)" : "fade";
      const set = `<p:set><p:cBhvr><p:cTn id="${id()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>`;
      const eff = a.type === "appear" ? "" : `<p:animEffect transition="in" filter="${filter}"><p:cBhvr><p:cTn id="${id()}" dur="600"/><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl></p:cBhvr></p:animEffect>`;
      return `<p:par><p:cTn id="${id()}" presetID="${preset}" presetClass="entr" presetSubtype="${sub}" fill="hold" nodeType="${gi === 0 ? "clickEffect" : "withEffect"}"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${set}${eff}</p:childTnLst></p:cTn></p:par>`;
    }).join("");
    return `<p:par><p:cTn id="${id()}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="${id()}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${effects}</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>`;
  }).join("");
  return `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>${clicks}</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`;
}

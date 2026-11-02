/**
 * Import .pptx : taille des diapositives, couleurs et polices du thème, espaces réservés
 * (hérités de la disposition et du masque), zones de texte et formes avec texte enrichi, listes,
 * images, tableaux, connecteurs/flèches, groupes, arrière-plans (couleur, dégradé, image),
 * notes, diapositives masquées, transitions et animations d'entrée.
 */
import JSZip from "jszip";
import { PT } from "./SlideView";
import { uid, type AnimType, type Deck, type ShapeKind, type Slide, type SlideEl, type TransType } from "./model";

type El = Element;
const kids = (e: El | null | undefined, n: string) => (e ? Array.from(e.children).filter((c) => c.localName === n) : []);
const kid = (e: El | null | undefined, n: string) => kids(e, n)[0] || null;
const path = (e: El | null | undefined, ...ns: string[]) => ns.reduce<El | null>((a, n) => kid(a, n), e || null);
const desc = (e: El | Document | null | undefined, n: string) => (e ? Array.from(e.getElementsByTagNameNS("*", n)) : []);
const attr = (e: El | null | undefined, n: string) => e?.getAttribute(n) ?? null;
const rAttr = (e: El | null | undefined, n: string) => e?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", n) || e?.getAttribute(`r:${n}`) || null;
const parse = (s: string) => new DOMParser().parseFromString(s, "application/xml");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function resolvePath(base: string, target: string) {
  if (target.startsWith("/")) return target.slice(1);
  const parts = base.split("/").slice(0, -1);
  for (const p of target.split("/")) { if (p === "..") parts.pop(); else if (p !== ".") parts.push(p); }
  return parts.join("/");
}

async function readRels(zip: JSZip, partPath: string): Promise<Record<string, { target: string; type: string; external: boolean }>> {
  const dir = partPath.split("/").slice(0, -1).join("/");
  const name = partPath.split("/").pop();
  const f = zip.file(`${dir}/_rels/${name}.rels`);
  if (!f) return {};
  const doc = parse(await f.async("string"));
  const out: Record<string, { target: string; type: string; external: boolean }> = {};
  desc(doc, "Relationship").forEach((r) => {
    const ext = attr(r, "TargetMode") === "External";
    out[attr(r, "Id") || ""] = { target: ext ? attr(r, "Target") || "" : resolvePath(partPath, attr(r, "Target") || ""), type: attr(r, "Type") || "", external: ext };
  });
  return out;
}

// ---------- Couleurs ----------
function hexToRgb(h: string) { const n = parseInt(h.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbToHex(r: number, g: number, b: number) { return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("").toUpperCase()}`; }
function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hslToRgb(h: number, s: number, l: number) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

interface Ctx {
  zip: JSZip;
  scheme: Record<string, string>;
  majorFont: string;
  minorFont: string;
  f: number; // unités diapositive par point
  media: Map<string, string>;
}

function colorOf(fillParent: El | null, ctx: Ctx): { color?: string; alpha?: number } {
  if (!fillParent) return {};
  const c = kid(fillParent, "srgbClr") || kid(fillParent, "schemeClr") || kid(fillParent, "sysClr") || kid(fillParent, "prstClr") || kid(fillParent, "scrgbClr");
  if (!c) return {};
  let hex = "";
  if (c.localName === "srgbClr") hex = attr(c, "val") || "000000";
  else if (c.localName === "sysClr") hex = attr(c, "lastClr") || (attr(c, "val") === "window" ? "FFFFFF" : "000000");
  else if (c.localName === "prstClr") hex = ({ black: "000000", white: "FFFFFF", red: "FF0000", green: "00FF00", blue: "0000FF", yellow: "FFFF00" } as Record<string, string>)[attr(c, "val") || ""] || "000000";
  else if (c.localName === "schemeClr") {
    const v = attr(c, "val") || "tx1";
    const map: Record<string, string> = { tx1: "dk1", bg1: "lt1", tx2: "dk2", bg2: "lt2", phClr: "accent1" };
    hex = (ctx.scheme[map[v] || v] || "000000").replace("#", "");
  } else return {};
  let [r, g, b] = hexToRgb(hex);
  let alpha: number | undefined;
  for (const m of Array.from(c.children)) {
    const val = Number(attr(m, "val")) / 100000;
    if (m.localName === "alpha") alpha = val;
    else if (m.localName === "lumMod" || m.localName === "lumOff") {
      const [h, s, l] = rgbToHsl(r, g, b);
      const nl = m.localName === "lumMod" ? l * val : l + val;
      [r, g, b] = hslToRgb(h, s, Math.max(0, Math.min(1, nl)));
    } else if (m.localName === "tint") { r = r + (255 - r) * (1 - val); g = g + (255 - g) * (1 - val); b = b + (255 - b) * (1 - val); }
    else if (m.localName === "shade") { r *= val; g *= val; b *= val; }
  }
  return { color: rgbToHex(r, g, b), alpha };
}

async function mediaUrl(ctx: Ctx, target: string): Promise<string | undefined> {
  if (ctx.media.has(target)) return ctx.media.get(target);
  const f = ctx.zip.file(target);
  if (!f) return undefined;
  const ext = (target.split(".").pop() || "png").toLowerCase();
  const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "gif" ? "image/gif" : ext === "svg" ? "image/svg+xml" : ext === "bmp" ? "image/bmp" : ext === "webp" ? "image/webp" : ext === "emf" || ext === "wmf" ? "" : "image/png";
  if (!mime) return undefined;
  const url = `data:${mime};base64,${await f.async("base64")}`;
  ctx.media.set(target, url);
  return url;
}

// ---------- Parties (diapositive, disposition, masque) ----------
interface Part { doc: Document; rels: Record<string, { target: string; type: string; external: boolean }>; path: string }
async function loadPart(zip: JSZip, p: string): Promise<Part | null> {
  const f = zip.file(p);
  if (!f) return null;
  return { doc: parse(await f.async("string")), rels: await readRels(zip, p), path: p };
}

function phOf(sp: El) { const ph = path(sp, "nvSpPr", "nvPr", "ph") || path(sp, "nvPicPr", "nvPr", "ph"); return ph ? { type: attr(ph, "type") || "body", idx: attr(ph, "idx") } : null; }
function findPh(part: Part | null, ph: { type: string; idx: string | null }) {
  if (!part) return null;
  const sps = desc(part.doc, "sp");
  const norm = (t: string) => (t === "ctrTitle" ? "title" : t === "subTitle" ? "body" : t === "obj" ? "body" : t);
  return sps.find((s) => { const p = phOf(s); return p && ph.idx && p.idx === ph.idx; })
    || sps.find((s) => { const p = phOf(s); return p && p.type === ph.type; })
    || sps.find((s) => { const p = phOf(s); return p && norm(p.type) === norm(ph.type); }) || null;
}

function xfrmOf(sp: El | null) {
  const x = path(sp, "spPr", "xfrm") || path(sp, "grpSpPr", "xfrm") || kid(sp, "xfrm");
  if (!x) return null;
  const off = kid(x, "off"), ext = kid(x, "ext");
  if (!off || !ext) return null;
  return { x: Number(attr(off, "x")), y: Number(attr(off, "y")), w: Number(attr(ext, "cx")), h: Number(attr(ext, "cy")), rot: Number(attr(x, "rot") || 0) / 60000, flipH: attr(x, "flipH") === "1" };
}

function defSize(lst: El | null, lvl: number): number | undefined {
  const p = kid(lst, `lvl${lvl + 1}pPr`);
  const sz = attr(kid(p, "defRPr"), "sz");
  return sz ? Number(sz) / 100 : undefined;
}

const PRST: Record<string, ShapeKind> = {
  rect: "rect", roundRect: "roundRect", snipRoundRect: "roundRect", round2SameRect: "roundRect", ellipse: "ellipse", triangle: "triangle", rtTriangle: "rtTriangle",
  diamond: "diamond", pentagon: "pentagon", homePlate: "pentagon", hexagon: "hexagon", octagon: "octagon", star5: "star5", star6: "star6", star4: "star5", star7: "star6", star8: "star6",
  rightArrow: "rightArrow", leftArrow: "leftArrow", upArrow: "upArrow", downArrow: "downArrow", chevron: "chevron", mathPlus: "plus", plus: "plus",
  parallelogram: "parallelogram", trapezoid: "trapezoid", wedgeRectCallout: "callout", wedgeRoundRectCallout: "callout", wedgeEllipseCallout: "callout",
  heart: "heart", moon: "moon", cloud: "cloud", cloudCallout: "cloud", lightningBolt: "lightning", flowChartProcess: "rect", flowChartDecision: "diamond", flowChartTerminator: "roundRect",
};

// ---------- Texte ----------
function textHtml(txBody: El | null, ctx: Ctx, opts: { isTitle: boolean; bulletDefault: boolean; baseSize: number; baseColor?: string; baseFont?: string; lst: (El | null)[] }) {
  if (!txBody) return { html: "", size: undefined as number | undefined, align: undefined as SlideEl["align"], rtl: false, color: undefined as string | undefined, font: undefined as string | undefined, bold: false };
  const paras = kids(txBody, "p");
  let firstSize: number | undefined, firstAlign: SlideEl["align"], rtl = false, firstColor: string | undefined, firstFont: string | undefined;
  let allBold = true;
  // valeurs de base : celles du premier segment de texte (ou celles héritées), les autres segments ne portent que leurs différences
  const firstRun = paras.flatMap((p) => kids(p, "r")).find((r) => (kid(r, "t")?.textContent || "").trim());
  const fr = kid(firstRun, "rPr");
  const faceOf = (rPr: El | null) => { const v = attr(kid(rPr, "latin"), "typeface") || attr(kid(rPr, "cs"), "typeface") || undefined; return v === "+mj-lt" ? ctx.majorFont : v === "+mn-lt" ? ctx.minorFont : v; };
  firstSize = attr(fr, "sz") ? Number(attr(fr, "sz")) / 100 : undefined;
  firstColor = colorOf(kid(fr, "solidFill"), ctx).color;
  firstFont = faceOf(fr);
  const baseSize = firstSize ?? opts.baseSize, baseColor = firstColor ?? opts.baseColor, baseFont = firstFont ?? opts.baseFont;
  let html = "";
  let listOpen: "ul" | "ol" | null = null;
  let anyText = false;
  for (const p of paras) {
    const pPr = kid(p, "pPr");
    const lvl = Number(attr(pPr, "lvl") || 0);
    const algn = attr(pPr, "algn");
    const align: SlideEl["align"] = algn === "ctr" ? "center" : algn === "r" ? "right" : algn === "just" ? "justify" : algn === "l" ? "left" : undefined;
    if (attr(pPr, "rtl") === "1") rtl = true;
    const inherited = opts.lst.map((l) => kid(l, `lvl${lvl + 1}pPr`)).filter(Boolean) as El[];
    const hasNone = kid(pPr, "buNone") || (!kid(pPr, "buChar") && !kid(pPr, "buAutoNum") && inherited.some((x) => kid(x, "buNone")));
    const auto = kid(pPr, "buAutoNum") || (!kid(pPr, "buChar") && inherited.map((x) => kid(x, "buAutoNum")).find(Boolean));
    const bullet = !hasNone && (kid(pPr, "buChar") || auto || inherited.some((x) => kid(x, "buChar")) || opts.bulletDefault);
    let runs = "";
    let plain = "";
    for (const r of Array.from(p.children)) {
      if (r.localName === "br") { runs += "<br>"; continue; }
      if (r.localName !== "r" && r.localName !== "fld") continue;
      const t = kid(r, "t")?.textContent || "";
      plain += t;
      const rPr = kid(r, "rPr");
      const st: string[] = [];
      const sz = attr(rPr, "sz") ? Number(attr(rPr, "sz")) / 100 : opts.baseSize;
      const fill = colorOf(kid(rPr, "solidFill"), ctx).color || opts.baseColor;
      const face = faceOf(rPr) || opts.baseFont;
      const b = attr(rPr, "b") === "1", i = attr(rPr, "i") === "1", u = attr(rPr, "u") && attr(rPr, "u") !== "none", s = attr(rPr, "strike") && attr(rPr, "strike") !== "noStrike";
      if (!b && t.trim()) allBold = false;
      if (sz && sz !== baseSize) st.push(`font-size:${(sz * ctx.f).toFixed(1)}px`);
      if (fill && fill !== baseColor) st.push(`color:${fill}`);
      if (face && face !== baseFont) st.push(`font-family:'${face}'`);
      const hl = colorOf(kid(rPr, "highlight"), ctx).color;
      if (hl) st.push(`background-color:${hl}`);
      const base = attr(rPr, "baseline");
      let inner = esc(t);
      const link = kid(rPr, "hlinkClick");
      if (b) inner = `<b>${inner}</b>`;
      if (i) inner = `<i>${inner}</i>`;
      if (u) inner = `<u>${inner}</u>`;
      if (s) inner = `<s>${inner}</s>`;
      if (base && Number(base) > 0) inner = `<sup>${inner}</sup>`;
      if (base && Number(base) < 0) inner = `<sub>${inner}</sub>`;
      if (link) inner = `<a data-rid="${rAttr(link, "id") || ""}">${inner}</a>`;
      runs += st.length ? `<span style="${st.join(";")}">${inner}</span>` : inner;
    }
    if (plain.trim()) anyText = true;
    if (firstAlign === undefined && align) firstAlign = align;
    const pStyle = align && align !== firstAlign ? ` style="text-align:${align}"` : "";
    if (bullet && plain.trim()) {
      const kind = auto ? "ol" : "ul";
      if (listOpen !== kind) { if (listOpen) html += `</${listOpen}>`; html += `<${kind}>`; listOpen = kind; }
      html += `<li${pStyle}${lvl ? ` style="margin-inline-start:${lvl * 1.2}em"` : ""}>${runs}</li>`;
    } else {
      if (listOpen) { html += `</${listOpen}>`; listOpen = null; }
      html += `<p${pStyle}>${runs || "<br>"}</p>`;
    }
  }
  if (listOpen) html += `</${listOpen}>`;
  if (!anyText) html = "";
  return { html, size: firstSize, align: firstAlign, rtl, color: firstColor, font: firstFont, bold: anyText && allBold };
}

// ---------- Import principal ----------
export async function importPptx(buf: ArrayBuffer): Promise<Deck> {
  const zip = await JSZip.loadAsync(buf);
  const presPath = "ppt/presentation.xml";
  const pres = await loadPart(zip, presPath);
  if (!pres) throw new Error("format");
  const sz = desc(pres.doc, "sldSz")[0];
  const cxPt = Number(attr(sz, "cx") || 12192000) / 12700;
  const cyPt = Number(attr(sz, "cy") || 6858000) / 12700;
  const f = 960 / cxPt;
  const deck: Deck = { w: 960, h: Math.round(cyPt * f), theme: "white", slides: [] };

  // Thème
  const scheme: Record<string, string> = { dk1: "#000000", lt1: "#FFFFFF", dk2: "#44546A", lt2: "#E7E6E6", accent1: "#4472C4", accent2: "#ED7D31", accent3: "#A5A5A5", accent4: "#FFC000", accent5: "#5B9BD5", accent6: "#70AD47", hlink: "#0563C1" };
  let majorFont = "Calibri Light", minorFont = "Calibri";
  const themeRel = Object.values(pres.rels).find((r) => r.type.endsWith("/theme"));
  const themeFile = zip.file(themeRel?.target || "ppt/theme/theme1.xml");
  if (themeFile) {
    const th = parse(await themeFile.async("string"));
    const cs = desc(th, "clrScheme")[0];
    if (cs) Array.from(cs.children).forEach((c) => {
      const v = kid(c, "srgbClr") ? attr(kid(c, "srgbClr"), "val") : attr(kid(c, "sysClr"), "lastClr");
      if (v) scheme[c.localName] = `#${v}`;
    });
    majorFont = attr(path(desc(th, "majorFont")[0], "latin"), "typeface") || majorFont;
    minorFont = attr(path(desc(th, "minorFont")[0], "latin"), "typeface") || minorFont;
  }
  const ctx: Ctx = { zip, scheme, majorFont, minorFont, f, media: new Map() };

  const ids = desc(pres.doc, "sldId");
  for (const sid of ids) {
    const rel = pres.rels[rAttr(sid, "id") || ""];
    if (!rel) continue;
    const sp = await loadPart(zip, rel.target);
    if (!sp) continue;
    const layoutRel = Object.values(sp.rels).find((r) => r.type.endsWith("/slideLayout"));
    const layout = layoutRel ? await loadPart(zip, layoutRel.target) : null;
    const masterRel = layout ? Object.values(layout.rels).find((r) => r.type.endsWith("/slideMaster")) : null;
    const master = masterRel ? await loadPart(zip, masterRel.target) : null;
    const txStyles = master ? desc(master.doc, "txStyles")[0] : null;
    const titleStyle = kid(txStyles, "titleStyle"), bodyStyle = kid(txStyles, "bodyStyle"), otherStyle = kid(txStyles, "otherStyle");

    const slide: Slide = { id: uid(), layout: "blank", els: [], notes: "", transition: { type: "none", dur: 0.7 } };
    if (attr(sp.doc.documentElement, "show") === "0") slide.hidden = true;

    // Arrière-plan : diapositive → disposition → masque
    for (const part of [sp, layout, master]) {
      if (!part) continue;
      const bgPr = path(desc(part.doc, "bg")[0], "bgPr");
      const bgRef = path(desc(part.doc, "bg")[0], "bgRef");
      if (!bgPr && !bgRef) continue;
      if (bgPr) {
        const solid = kid(bgPr, "solidFill");
        const grad = kid(bgPr, "gradFill");
        const blip = path(bgPr, "blipFill", "blip");
        if (solid) slide.bg = { color: colorOf(solid, ctx).color || "#FFFFFF" };
        else if (grad) {
          const gs = desc(grad, "gs").map((g) => colorOf(g, ctx).color || "#FFFFFF");
          const ang = Number(attr(kid(grad, "lin"), "ang") || 5400000) / 60000;
          slide.bg = { gradient: [gs[0] || "#FFFFFF", gs[gs.length - 1] || "#FFFFFF", (ang + 90) % 360] };
        } else if (blip) {
          const r = part.rels[rAttr(blip, "embed") || ""];
          const url = r ? await mediaUrl(ctx, r.target) : undefined;
          if (url) slide.bg = { image: url };
        }
      } else if (bgRef) {
        const c = colorOf(bgRef, ctx).color;
        if (c) slide.bg = { color: c };
      }
      break;
    }
    if (!slide.bg) slide.bg = { color: scheme.lt1 || "#FFFFFF" };

    const spidMap = new Map<string, SlideEl>();

    const walkTree = async (tree: El, part: Part, g: { ox: number; oy: number; sx: number; sy: number; cx: number; cy: number }, isTemplate: boolean) => {
      const tx = (v: number) => (g.ox + (v - g.cx) * g.sx) / 12700 * f;
      const ty = (v: number) => (g.oy + (v - g.cy) * g.sy) / 12700 * f;
      for (const node of Array.from(tree.children)) {
        const ln = node.localName;
        if (ln === "grpSp") {
          const x = xfrmOf(node);
          const chOff = path(node, "grpSpPr", "xfrm", "chOff"), chExt = path(node, "grpSpPr", "xfrm", "chExt");
          if (x && chOff && chExt) {
            const ng = {
              ox: g.ox + (x.x - g.cx) * g.sx, oy: g.oy + (x.y - g.cy) * g.sy,
              sx: g.sx * (x.w / (Number(attr(chExt, "cx")) || x.w || 1)), sy: g.sy * (x.h / (Number(attr(chExt, "cy")) || x.h || 1)),
              cx: Number(attr(chOff, "x")), cy: Number(attr(chOff, "y")),
            };
            await walkTree(node, part, ng, isTemplate);
          } else await walkTree(node, part, g, isTemplate);
          continue;
        }
        if (ln !== "sp" && ln !== "pic" && ln !== "graphicFrame" && ln !== "cxnSp") continue;
        const ph = phOf(node);
        if (isTemplate && ph) continue; // espaces réservés du masque : non affichés
        const cNvPr = desc(node, "cNvPr")[0];
        if (attr(cNvPr, "hidden") === "1") continue;
        const layoutPh = ph ? findPh(layout, ph) : null;
        const masterPh = ph ? findPh(master, ph) : null;
        const xf = xfrmOf(node) || xfrmOf(layoutPh) || xfrmOf(masterPh);
        if (!xf) continue;
        const box = { x: tx(xf.x), y: ty(xf.y), w: (xf.w * g.sx) / 12700 * f, h: (xf.h * g.sy) / 12700 * f };
        const base: SlideEl = { id: uid(), kind: "text", ...box, rot: xf.rot ? Math.round(xf.rot) : undefined, fill: null, stroke: null };

        if (ln === "pic") {
          const blip = path(node, "blipFill", "blip");
          const r = part.rels[rAttr(blip, "embed") || ""];
          const url = r ? await mediaUrl(ctx, r.target) : undefined;
          const vid = path(node, "nvPicPr", "nvPr", "videoFile");
          if (vid) {
            const vr = part.rels[rAttr(vid, "link") || ""];
            if (vr?.external) { slide.els.push({ ...base, kind: "video", url: vr.target }); continue; }
          }
          if (!url) continue;
          const geom = attr(path(node, "spPr", "prstGeom"), "prst");
          const el: SlideEl = { ...base, kind: "image", src: url, crop: geom === "ellipse" ? "circle" : geom === "roundRect" ? "rounded" : "none" };
          slide.els.push(el);
          if (!isTemplate) spidMap.set(attr(cNvPr, "id") || "", el);
          continue;
        }
        if (ln === "graphicFrame") {
          const tbl = desc(node, "tbl")[0];
          if (!tbl) {
            const chart = desc(node, "chart")[0];
            if (chart) slide.els.push({ ...base, kind: "shape", shape: "rect", fill: "#F2F2F2", stroke: "#BFBFBF", strokeW: 1, html: "<p>📊</p>", align: "center", valign: "middle", size: 28, color: "#7F7F7F" });
            continue;
          }
          const rows = kids(tbl, "tr").map((tr) => kids(tr, "tc").map((tc) => kids(kid(tc, "txBody"), "p").map((p) => desc(p, "t").map((t) => t.textContent).join("")).join("\n")));
          const firstSz = desc(tbl, "rPr").map((r) => attr(r, "sz")).find(Boolean);
          const tblPr = kid(tbl, "tblPr");
          const headFill = colorOf(kid(path(kid(kid(tbl, "tr"), "tc"), "tcPr"), "solidFill") ? path(kid(kid(tbl, "tr"), "tc"), "tcPr") : null, ctx).color;
          const el: SlideEl = { ...base, kind: "table", size: firstSz ? (Number(firstSz) / 100) * f / PT : 14 * f / PT, table: { rows: rows.length ? rows : [[""]], header: attr(tblPr, "firstRow") === "1", style: headFill || "theme" } };
          slide.els.push(el);
          if (!isTemplate) spidMap.set(attr(cNvPr, "id") || "", el);
          continue;
        }
        // sp / cxnSp
        const spPr = kid(node, "spPr");
        const prst = attr(kid(spPr, "prstGeom"), "prst") || (kid(spPr, "custGeom") ? "rect" : null);
        const isLine = ln === "cxnSp" || prst === "line" || prst === "straightConnector1" || prst?.startsWith("bentConnector") || prst?.startsWith("curvedConnector");
        const styleEl = kid(node, "style");
        const lnEl = kid(spPr, "ln") || path(layoutPh, "spPr", "ln");
        let stroke: string | null = null, strokeW: number | undefined;
        if (lnEl && !kid(lnEl, "noFill")) {
          stroke = colorOf(kid(lnEl, "solidFill"), ctx).color || null;
          strokeW = attr(lnEl, "w") ? (Number(attr(lnEl, "w")) / 12700) * f : undefined;
        }
        if (!stroke && !(lnEl && kid(lnEl, "noFill")) && styleEl && kid(styleEl, "lnRef") && Number(attr(kid(styleEl, "lnRef"), "idx")) > 0) stroke = colorOf(kid(styleEl, "lnRef"), ctx).color || null;
        const dashV = attr(kid(lnEl, "prstDash"), "val");
        const dash: SlideEl["dash"] = dashV && dashV !== "solid" ? (dashV.includes("ot") ? "dot" : "dash") : undefined;
        if (isLine) {
          const arrow = !!(attr(kid(lnEl, "tailEnd"), "type") && attr(kid(lnEl, "tailEnd"), "type") !== "none") || !!(attr(kid(lnEl, "headEnd"), "type") && attr(kid(lnEl, "headEnd"), "type") !== "none");
          const len = Math.hypot(box.w, box.h);
          const ang = (Math.atan2(box.h, box.w) * 180) / Math.PI * (xf.flipH ? -1 : 1) + (xf.rot || 0);
          const cxL = box.x + box.w / 2, cyL = box.y + box.h / 2;
          slide.els.push({ ...base, kind: "line", x: cxL - len / 2, y: cyL - 2, w: Math.max(len, 4), h: 4, rot: Math.round(ang) || undefined, stroke: stroke || scheme.dk1, strokeW: strokeW || 2, arrow, dash });
          continue;
        }
        let fill: string | null = null; let opacity: number | undefined;
        const solid = kid(spPr, "solidFill"), grad = kid(spPr, "gradFill");
        if (solid) { const c = colorOf(solid, ctx); fill = c.color || null; if (c.alpha !== undefined) opacity = c.alpha; }
        else if (grad) fill = colorOf(desc(grad, "gs")[0] || null, ctx).color || null;
        else if (!kid(spPr, "noFill") && styleEl && Number(attr(kid(styleEl, "fillRef"), "idx")) > 0) fill = colorOf(kid(styleEl, "fillRef"), ctx).color || null;
        const blipFill = path(spPr, "blipFill", "blip");
        const isTitle = !!ph && (ph.type === "title" || ph.type === "ctrTitle");
        const isBodyPh = !!ph && (ph.type === "body" || ph.type === "obj") && !ph.idx?.match(/^1[0-2]$/);
        const txBody = kid(node, "txBody");
        const bodyPr = kid(txBody, "bodyPr") || path(layoutPh, "txBody", "bodyPr") || path(masterPh, "txBody", "bodyPr");
        const anchor = attr(bodyPr, "anchor") || attr(path(layoutPh, "txBody", "bodyPr"), "anchor") || attr(path(masterPh, "txBody", "bodyPr"), "anchor");
        const lsts = [kid(txBody, "lstStyle"), path(layoutPh, "txBody", "lstStyle"), path(masterPh, "txBody", "lstStyle"), ph ? (isTitle ? titleStyle : bodyStyle) : otherStyle];
        const defSz = lsts.map((l) => defSize(l, 0)).find((v) => v !== undefined) ?? (isTitle ? 44 : ph ? 28 : 18);
        const lstColor = (l: El | null) => colorOf(kid(path(l, "lvl1pPr", "defRPr"), "solidFill"), ctx).color;
        const defColor = lstColor(lsts[0]) || (styleEl ? colorOf(kid(styleEl, "fontRef"), ctx).color : undefined) || lsts.slice(1).map(lstColor).find(Boolean);
        const defAlgn = lsts.map((l) => attr(kid(l, "lvl1pPr"), "algn")).find(Boolean);
        const t = textHtml(txBody, ctx, { isTitle, bulletDefault: false, baseSize: defSz, baseColor: defColor, baseFont: isTitle ? majorFont : minorFont, lst: ph ? [kid(txBody, "lstStyle"), path(layoutPh, "txBody", "lstStyle"), path(masterPh, "txBody", "lstStyle"), isTitle ? titleStyle : bodyStyle] : [kid(txBody, "lstStyle")] });
        if (ph && !t.html && !fill && !stroke) continue; // espace réservé vide : PowerPoint ne l'affiche pas
        const kind: SlideEl["kind"] = prst && prst !== "rect" ? "shape" : fill || stroke ? (prst === "rect" ? "shape" : "text") : "text";
        const ptSize = t.size ?? defSz;
        const el: SlideEl = {
          ...base,
          kind,
          shape: kind === "shape" ? PRST[prst || "rect"] || "rect" : undefined,
          fill, stroke, strokeW, dash, opacity,
          html: t.html,
          size: Math.round(((ptSize * f) / PT) * 10) / 10,
          color: t.color || defColor || (isTitle ? scheme.dk1 : undefined) || (kind === "shape" && fill ? "#FFFFFF" : scheme.dk1),
          font: t.font || (isTitle ? majorFont : minorFont),
          align: t.align || (defAlgn === "ctr" ? "center" : defAlgn === "r" ? "right" : undefined) || (kind === "shape" ? "center" : undefined),
          valign: anchor === "ctr" ? "middle" : anchor === "b" ? "bottom" : kind === "shape" && !anchor ? "middle" : "top",
          dir: t.rtl ? "rtl" : undefined,
          bold: t.bold || undefined,
          ph: isTitle ? "title" : ph?.type === "subTitle" ? "subtitle" : isBodyPh ? "body" : undefined,
          shadow: !!path(spPr, "effectLst", "outerShdw") || undefined,
        };
        if (blipFill) {
          const r = part.rels[rAttr(blipFill, "embed") || ""];
          const url = r ? await mediaUrl(ctx, r.target) : undefined;
          if (url) { slide.els.push({ ...base, kind: "image", src: url }); if (!isTemplate) spidMap.set(attr(cNvPr, "id") || "", slide.els[slide.els.length - 1]); continue; }
        }
        // liens hypertextes
        if (el.html?.includes("data-rid")) el.html = el.html.replace(/data-rid="([^"]*)"/g, (_m, id) => { const r = part.rels[id]; return r?.external ? `href="${esc(r.target)}" target="_blank"` : ""; });
        slide.els.push(el);
        if (!isTemplate) spidMap.set(attr(cNvPr, "id") || "", el);
      }
    };
    const id0 = { ox: 0, oy: 0, sx: 1, sy: 1, cx: 0, cy: 0 };
    // Formes décoratives du masque et de la disposition (hors espaces réservés)
    const showMaster = attr(sp.doc.documentElement, "showMasterSp") !== "0" && attr(layout?.doc.documentElement, "showMasterSp") !== "0";
    if (master && showMaster) { const tree = desc(master.doc, "spTree")[0]; if (tree) await walkTree(tree, master, id0, true); }
    if (layout && attr(sp.doc.documentElement, "showMasterSp") !== "0") { const tree = desc(layout.doc, "spTree")[0]; if (tree) await walkTree(tree, layout, id0, true); }
    const tree = desc(sp.doc, "spTree")[0];
    if (tree) await walkTree(tree, sp, id0, false);

    // Notes
    const notesRel = Object.values(sp.rels).find((r) => r.type.endsWith("/notesSlide"));
    if (notesRel) {
      const np = zip.file(notesRel.target);
      if (np) {
        const nd = parse(await np.async("string"));
        const body = desc(nd, "sp").find((s) => phOf(s)?.type === "body");
        if (body) slide.notes = kids(kid(body, "txBody"), "p").map((p) => desc(p, "t").map((t) => t.textContent).join("")).join("\n").trim();
      }
    }

    // Transition
    const tr = desc(sp.doc, "transition")[0];
    if (tr) {
      const child = Array.from(tr.children).find((c) => c.localName !== "sndAc" && c.localName !== "extLst");
      const map: Record<string, TransType> = { fade: "fade", push: "push", wipe: "wipe", zoom: "zoom", cover: "cover", pull: "cover", split: "split", circle: "flip", dissolve: "fade", randomBar: "wipe", strips: "wipe", blinds: "wipe", checker: "wipe", comb: "split", wheel: "flip", wedge: "flip", newsflash: "zoom", plus: "zoom", diamond: "zoom", cut: "fade", morph: "morph", prism: "flip", flip: "flip", reveal: "reveal", vortex: "zoom", ripple: "zoom", ferris: "flip", conveyor: "push", pan: "push", gallery: "push", switch: "flip", doors: "split", window: "split", shred: "wipe", glitter: "fade", honeycomb: "zoom", flash: "fade", warp: "zoom", flythrough: "zoom" };
      const spd = attr(tr, "spd");
      const dur = attr(tr, "dur") || (tr.getAttributeNS("http://schemas.microsoft.com/office/powerpoint/2010/main", "dur"));
      slide.transition = { type: child ? map[child.localName] || "fade" : "fade", dur: dur ? Number(dur) / 1000 : spd === "fast" ? 0.4 : spd === "slow" ? 1.2 : 0.7 };
    }

    // Animations d'entrée
    const timing = desc(sp.doc, "timing")[0];
    if (timing) {
      let order = 0;
      const mainSeq = desc(timing, "cTn").find((c) => attr(c, "nodeType") === "mainSeq");
      const clicks = mainSeq ? kids(kid(mainSeq, "childTnLst"), "par") : [];
      for (const click of clicks) {
        order++;
        desc(click, "cTn").filter((c) => attr(c, "presetClass")).forEach((c) => {
          const cls = attr(c, "presetClass");
          if (cls !== "entr" && cls !== "emph") return;
          const nodeType = attr(c, "nodeType");
          if (nodeType === "afterEffect" && order === 0) order = 1;
          const pid = Number(attr(c, "presetID"));
          const sub = Number(attr(c, "presetSubtype"));
          const spid = attr(desc(c, "spTgt")[0], "spid");
          const target = spid ? spidMap.get(spid) : undefined;
          if (!target) return;
          const type: AnimType = cls === "emph" ? "pulse" : pid === 1 ? "appear" : pid === 2 ? (sub === 8 ? "flyLeft" : sub === 2 ? "flyRight" : "flyBottom") : pid === 22 ? "wipe" : pid === 53 || pid === 23 ? "zoom" : pid === 26 ? "bounce" : pid === 8 || pid === 31 ? "spin" : "fade";
          const durEl = desc(c, "cTn").map((x) => attr(x, "dur")).find((d) => d && d !== "1" && d !== "indefinite");
          target.anim = { type, order, dur: durEl ? Math.min(5, Number(durEl) / 1000) : 0.6 };
        });
      }
    }
    slide.layout = slide.els.some((e) => e.ph === "title") ? (slide.els.some((e) => e.ph === "body") ? "titleContent" : "title") : "blank";
    deck.slides.push(slide);
  }
  if (!deck.slides.length) throw new Error("empty");
  return deck;
}

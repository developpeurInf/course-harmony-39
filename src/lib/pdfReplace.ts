/**
 * Rechercher et remplacer du texte dans un PDF (dans le navigateur, sans serveur).
 *
 * Le texte est modifié directement dans les flux de contenu : le remplacement est écrit avec la
 * police d'origine, à la même position, dans la même taille et la même couleur. Quand la police
 * intégrée ne contient pas un caractère du nouveau texte (polices réduites aux glyphes utilisés),
 * le remplacement est écrit à la même place avec une police standard proche (Helvetica, Times ou
 * Courier), toujours dans la même taille et la même couleur.
 */
import { PDFArray, PDFDict, PDFDocument, PDFFont, PDFHexString, PDFName, PDFNumber, PDFRef, PDFStream, PDFString, StandardFonts } from "pdf-lib";
import { fromBinary, lookupDict, streamBytes, toBinary, tokenize, type Op, type Operand } from "./pdfWatermark";

/* ───────────── polices : décodage et ré-encodage ───────────── */

interface Glyph {
  bytes: string;
  text: string;
}

interface Codec {
  decode: (bytes: string) => Glyph[];
  /** octets dans cette police, ou null si un caractère manque */
  encode: (text: string) => string | null;
  baseFont: string;
}

// Codage WinAnsi : seules les positions 0x80 à 0x9F diffèrent de Latin-1
const WIN_ANSI_HIGH = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ";
const winAnsiChar = (b: number) => (b >= 0x80 && b <= 0x9f ? WIN_ANSI_HIGH[b - 0x80] : String.fromCharCode(b));
const winAnsiCode = (c: string) => {
  const i = WIN_ANSI_HIGH.indexOf(c);
  if (i >= 0) return 0x80 + i;
  const code = c.charCodeAt(0);
  return c.length === 1 && code < 256 && !(code >= 0x80 && code <= 0x9f) ? code : -1;
};

function parseCMap(cmap: string) {
  const map = new Map<number, string>();
  let codeLen = 1;
  const csr = /begincodespacerange([\s\S]*?)endcodespacerange/.exec(cmap);
  if (csr) {
    const first = /<([0-9a-fA-F]+)>/.exec(csr[1]);
    if (first) codeLen = Math.max(1, Math.ceil(first[1].length / 2));
  }
  const utf16 = (hex: string) => {
    if (hex.length <= 2) return hex ? String.fromCharCode(parseInt(hex, 16)) : "";
    let out = "";
    for (let k = 0; k + 4 <= hex.length; k += 4) out += String.fromCharCode(parseInt(hex.slice(k, k + 4), 16));
    return out;
  };
  for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) map.set(parseInt(m[1], 16), utf16(m[2]));
  }
  for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<([0-9a-fA-F]*)>|\[([^\]]*)\])/g)) {
      const lo = parseInt(m[1], 16);
      const hi = parseInt(m[2], 16);
      if (hi - lo > 65535) continue;
      if (m[4] !== undefined) {
        const base = m[4];
        const baseLast = parseInt(base.slice(-4) || "0", 16);
        const prefix = utf16(base.slice(0, -4));
        for (let c = lo; c <= hi; c++) map.set(c, prefix + String.fromCharCode(baseLast + (c - lo)));
      } else if (m[5] !== undefined) {
        [...m[5].matchAll(/<([0-9a-fA-F]*)>/g)].forEach((x, k) => map.set(lo + k, utf16(x[1])));
      }
    }
  }
  return { map, codeLen };
}

const codeBytes = (code: number, len: number) => {
  let out = "";
  for (let j = len - 1; j >= 0; j--) out += String.fromCharCode((code >> (8 * j)) & 0xff);
  return out;
};

function makeCodec(doc: PDFDocument, font: PDFDict | undefined): Codec {
  const baseFont = font?.get(PDFName.of("BaseFont"))?.toString().replace(/^\//, "") || "Helvetica";
  const isType0 = font?.get(PDFName.of("Subtype"))?.toString() === "/Type0";
  const tuRef = font?.get(PDFName.of("ToUnicode"));
  const tuBytes = streamBytes(tuRef instanceof PDFRef ? doc.context.lookup(tuRef) : tuRef);

  if (tuBytes) {
    const { map, codeLen: cmapLen } = parseCMap(toBinary(tuBytes));
    const codeLen = isType0 ? Math.max(2, cmapLen) : 1;
    const reverse = new Map<string, number>();
    for (const [code, text] of map) if (text && !reverse.has(text)) reverse.set(text, code);
    const longest = Math.max(1, ...[...reverse.keys()].map((k) => k.length));
    return {
      baseFont,
      decode: (bytes) => {
        const out: Glyph[] = [];
        for (let k = 0; k + codeLen <= bytes.length; k += codeLen) {
          let code = 0;
          for (let j = 0; j < codeLen; j++) code = (code << 8) | bytes.charCodeAt(k + j);
          out.push({ bytes: bytes.slice(k, k + codeLen), text: map.get(code) ?? "" });
        }
        return out;
      },
      encode: (text) => {
        let out = "";
        let i = 0;
        while (i < text.length) {
          let hit = false;
          for (let n = Math.min(longest, text.length - i); n >= 1; n--) {
            const code = reverse.get(text.slice(i, i + n));
            if (code !== undefined) {
              out += codeBytes(code, codeLen);
              i += n;
              hit = true;
              break;
            }
          }
          if (!hit) return null;
        }
        return out;
      },
    };
  }

  if (isType0) {
    // police composite sans table ToUnicode : texte illisible, rien à rechercher
    return { baseFont, decode: (bytes) => [...bytes].map((b) => ({ bytes: b, text: "" })), encode: () => null };
  }

  // police simple : codage WinAnsi, glyphes disponibles d'après le tableau /Widths
  const first = font?.get(PDFName.of("FirstChar"));
  const widths = lookupArray(doc, font?.get(PDFName.of("Widths")));
  const firstChar = first instanceof PDFNumber ? first.asNumber() : 0;
  const hasEmbedded = !!lookupDict(doc, font?.get(PDFName.of("FontDescriptor")));
  const available = (code: number) => {
    if (!widths || !hasEmbedded) return true; // police standard : tout le jeu WinAnsi
    const w = widths.lookup(code - firstChar);
    return w instanceof PDFNumber && w.asNumber() > 0;
  };
  return {
    baseFont,
    decode: (bytes) => [...bytes].map((b) => ({ bytes: b, text: winAnsiChar(b.charCodeAt(0)) })),
    encode: (text) => {
      let out = "";
      for (const c of text) {
        const code = winAnsiCode(c);
        if (code < 0 || !available(code)) return null;
        out += String.fromCharCode(code);
      }
      return out;
    },
  };
}

function lookupArray(doc: PDFDocument, v: unknown): PDFArray | undefined {
  const o = v instanceof PDFRef ? doc.context.lookup(v) : v;
  return o instanceof PDFArray ? o : undefined;
}

/* ───────────── analyse d'un flux ───────────── */

type Seg = { t: "str"; v: string } | { t: "num"; v: number };

interface TextOp {
  op: Op;
  segs: Seg[];
  font: string;
  size: number;
  codec: Codec;
}

interface Unit {
  textOp: number;
  seg: number;
  /** position et longueur dans les octets du segment */
  at: number;
  len: number;
  text: string;
}

interface Stream {
  source: string;
  ops: TextOp[];
  units: Unit[];
  /** texte sans espaces et, pour chaque caractère, son glyphe */
  flat: string;
  flatUnit: number[];
  flatOffset: number[];
}

function scanStream(doc: PDFDocument, source: string, resources: PDFDict | undefined, codecs: Map<PDFDict | undefined, Codec>, onForm: (ref: PDFRef, stream: PDFStream, res: PDFDict | undefined) => void): Stream {
  const fonts = lookupDict(doc, resources?.get(PDFName.of("Font")));
  const xobjects = lookupDict(doc, resources?.get(PDFName.of("XObject")));
  const codecFor = (name: string) => {
    const dict = lookupDict(doc, fonts?.get(PDFName.of(name)));
    let c = codecs.get(dict);
    if (!c) codecs.set(dict, (c = makeCodec(doc, dict)));
    return c;
  };

  const ops: TextOp[] = [];
  const units: Unit[] = [];
  const stack: { font: string; size: number }[] = [];
  let state = { font: "", size: 12 };

  for (const o of tokenize(source)) {
    const a = o.args;
    switch (o.op) {
      case "q": stack.push({ ...state }); break;
      case "Q": state = stack.pop() || state; break;
      case "Tf":
        state = { font: a[0]?.t === "name" ? a[0].v : "", size: a[1]?.t === "num" ? a[1].v : 12 };
        break;
      case "Tj": case "'": case '"': case "TJ": {
        const raw: Operand[] = o.op === "TJ" ? (a[0]?.t === "arr" ? a[0].v : []) : a.slice(-1);
        const segs: Seg[] = raw.flatMap((x): Seg[] => (x.t === "str" ? [{ t: "str", v: x.v }] : x.t === "num" ? [{ t: "num", v: x.v }] : []));
        const codec = codecFor(state.font);
        const idx = ops.push({ op: o, segs, font: state.font, size: state.size, codec }) - 1;
        segs.forEach((s, si) => {
          if (s.t !== "str") return;
          let at = 0;
          for (const g of codec.decode(s.v)) {
            units.push({ textOp: idx, seg: si, at, len: g.bytes.length, text: g.text });
            at += g.bytes.length;
          }
        });
        break;
      }
      case "Do": {
        const name = a[0]?.t === "name" ? a[0].v : "";
        const ref = xobjects?.get(PDFName.of(name));
        const x = ref instanceof PDFRef ? doc.context.lookup(ref) : undefined;
        if (ref instanceof PDFRef && x instanceof PDFStream && x.dict.get(PDFName.of("Subtype"))?.toString() === "/Form") onForm(ref, x, resources);
        break;
      }
    }
  }

  let flat = "";
  const flatUnit: number[] = [];
  const flatOffset: number[] = [];
  units.forEach((u, ui) => {
    let k = 0;
    for (const c of u.text) {
      if (!/\s/.test(c)) {
        flat += c;
        flatUnit.push(ui);
        flatOffset.push(k);
      }
      k += c.length;
    }
  });
  return { source, ops, units, flat, flatUnit, flatOffset };
}

/* ───────────── recherche ───────────── */

export interface ReplaceOptions {
  find: string;
  replace: string;
  matchCase?: boolean;
  /** pages concernées (index à partir de 0) ; toutes par défaut */
  pages?: number[];
}

const squash = (s: string) => s.normalize("NFC").replace(/\s+/g, "");

function findMatches(st: Stream, query: string, matchCase: boolean): [number, number][] {
  const q = squash(query);
  if (!q) return [];
  const hay = matchCase ? st.flat : st.flat.toLowerCase();
  const needle = matchCase ? q : q.toLowerCase();
  const out: [number, number][] = [];
  let i = hay.indexOf(needle);
  while (i >= 0) {
    out.push([i, i + needle.length]);
    i = hay.indexOf(needle, i + needle.length);
  }
  return out;
}

/* ───────────── réécriture ───────────── */

type Piece = Seg | { t: "fb"; text: string };

interface Edit {
  at: number;
  len: number;
  insert?: { bytes: string } | { fb: string };
}

const hex = (bytes: string) => {
  let out = "<";
  for (let i = 0; i < bytes.length; i++) out += bytes.charCodeAt(i).toString(16).padStart(2, "0");
  return out + ">";
};
const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/0+$/, "").replace(/\.$/, ""));

function fallbackStyle(baseFont: string): StandardFonts {
  const n = baseFont.replace(/^[A-Z]{6}\+/, "").toLowerCase();
  const bold = /bold|black|heavy|semibold|demi/.test(n);
  const italic = /italic|oblique/.test(n);
  if (/courier|mono|consol/.test(n)) return bold ? (italic ? StandardFonts.CourierBoldOblique : StandardFonts.CourierBold) : italic ? StandardFonts.CourierOblique : StandardFonts.Courier;
  if (/times|serif|roman|georgia|garamond|cambria|book|cmr|nimbusrom/.test(n) && !/sans/.test(n))
    return bold ? (italic ? StandardFonts.TimesRomanBoldItalic : StandardFonts.TimesRomanBold) : italic ? StandardFonts.TimesRomanItalic : StandardFonts.TimesRoman;
  return bold ? (italic ? StandardFonts.HelveticaBoldOblique : StandardFonts.HelveticaBold) : italic ? StandardFonts.HelveticaOblique : StandardFonts.Helvetica;
}

interface Outcome {
  source: string;
  replaced: number;
  fallback: number;
  failed: number;
  /** polices de secours à déclarer dans les ressources du flux */
  fallbackFonts: Map<string, PDFFont>;
}

async function rewrite(doc: PDFDocument, st: Stream, opts: ReplaceOptions, fonts: Map<StandardFonts, PDFFont>, nameFor: (f: PDFFont) => string): Promise<Outcome> {
  const matches = findMatches(st, opts.find, !!opts.matchCase);
  const res: Outcome = { source: st.source, replaced: 0, fallback: 0, failed: 0, fallbackFonts: new Map() };
  if (!matches.length) return res;

  const edits = new Map<string, Edit[]>(); // « op:seg » → modifications
  const addEdit = (op: number, seg: number, e: Edit) => {
    const k = `${op}:${seg}`;
    const list = edits.get(k) || [];
    list.push(e);
    edits.set(k, list);
  };
  const fbFonts = new Map<number, PDFFont>(); // op → police de secours
  let lastUnit = -1;

  for (const [ms, me] of matches) {
    const u0 = st.flatUnit[ms];
    const u1 = st.flatUnit[me - 1];
    if (u0 <= lastUnit) continue; // chevauchement avec le remplacement précédent
    const first = st.units[u0];
    const last = st.units[u1];
    const prefix = first.text.slice(0, st.flatOffset[ms]);
    const lastEnd = st.flatOffset[me - 1] + last.text.slice(st.flatOffset[me - 1]).match(/^[\s\S]/u)![0].length;
    const suffix = last.text.slice(lastEnd);
    const text = prefix + opts.replace + suffix;
    const op = st.ops[first.textOp];

    let insert: Edit["insert"];
    if (text) {
      const bytes = op.codec.encode(text);
      if (bytes !== null) insert = { bytes };
      else {
        const style = fallbackStyle(op.codec.baseFont);
        let font = fonts.get(style);
        if (!font) fonts.set(style, (font = await doc.embedFont(style)));
        try {
          font.encodeText(text);
        } catch {
          res.failed++;
          continue;
        }
        insert = { fb: text };
        fbFonts.set(first.textOp, font);
        res.fallbackFonts.set(nameFor(font), font);
        res.fallback++;
      }
    }

    for (let u = u0; u <= u1; u++) {
      const unit = st.units[u];
      addEdit(unit.textOp, unit.seg, { at: unit.at, len: unit.len, insert: u === u0 ? insert : undefined });
    }
    // espacements (TJ) entre les glyphes retirés d'une même opération
    for (let u = u0; u < u1; u++) {
      const a = st.units[u];
      const b = st.units[u + 1];
      if (a.textOp !== b.textOp) continue;
      for (let s = a.seg + 1; s < b.seg; s++) if (st.ops[a.textOp].segs[s].t === "num") addEdit(a.textOp, s, { at: 0, len: 0 });
    }
    lastUnit = u1;
    res.replaced++;
  }

  // nouvelles opérations de texte
  const replacements: { start: number; end: number; text: string }[] = [];
  st.ops.forEach((top, oi) => {
    const touched = top.segs.some((_, si) => edits.has(`${oi}:${si}`));
    if (!touched) return;
    const pieces: Piece[] = [];
    top.segs.forEach((seg, si) => {
      const list = edits.get(`${oi}:${si}`);
      if (!list) return void pieces.push(seg);
      if (seg.t === "num") return; // espacement supprimé
      let cursor = 0;
      let buf = "";
      for (const e of list.sort((x, y) => x.at - y.at)) {
        buf += seg.v.slice(cursor, e.at);
        if (e.insert && "bytes" in e.insert) buf += e.insert.bytes;
        else if (e.insert && "fb" in e.insert) {
          if (buf) pieces.push({ t: "str", v: buf });
          buf = "";
          pieces.push({ t: "fb", text: e.insert.fb });
        }
        cursor = e.at + e.len;
      }
      buf += seg.v.slice(cursor);
      if (buf) pieces.push({ t: "str", v: buf });
    });

    const a = top.op.args;
    let out = "";
    if (top.op.op === "'") out += "T* ";
    if (top.op.op === '"') out += `${a[0]?.t === "num" ? num(a[0].v) : 0} Tw ${a[1]?.t === "num" ? num(a[1].v) : 0} Tc T* `;
    let arr: string[] = [];
    const flush = () => {
      if (arr.length) out += `[${arr.join(" ")}] TJ `;
      arr = [];
    };
    for (const p of pieces) {
      if (p.t === "str") arr.push(hex(p.v));
      else if (p.t === "num") arr.push(num(p.v));
      else {
        flush();
        const fb = fbFonts.get(oi)!;
        const encoded = fb.encodeText(p.text).toString();
        out += `/${nameFor(fb)} ${num(top.size)} Tf ${encoded} Tj /${top.font} ${num(top.size)} Tf `;
      }
    }
    flush();
    replacements.push({ start: top.op.start, end: top.op.end, text: out.trim() || " " });
  });

  let source = st.source;
  for (const r of replacements.sort((x, y) => y.start - x.start)) source = source.slice(0, r.start) + r.text + source.slice(r.end);
  res.source = source;
  return res;
}

/* ───────────── document ───────────── */

function pageSource(doc: PDFDocument, contents: unknown) {
  const parts: string[] = [];
  const push = (v: unknown) => {
    const b = streamBytes(v instanceof PDFRef ? doc.context.lookup(v) : v);
    if (b) parts.push(toBinary(b));
  };
  if (contents instanceof PDFArray) for (let i = 0; i < contents.size(); i++) push(contents.get(i));
  else if (contents) push(contents);
  return parts.join("\n");
}

function addFontResource(doc: PDFDocument, resources: PDFDict, name: string, font: PDFFont) {
  let fontDict = lookupDict(doc, resources.get(PDFName.of("Font")));
  if (!fontDict) {
    fontDict = doc.context.obj({});
    resources.set(PDFName.of("Font"), fontDict);
  }
  fontDict.set(PDFName.of(name), font.ref);
}

interface Target {
  source: string;
  resources: PDFDict | undefined;
  write: (source: string, fallbackFonts: Map<string, PDFFont>) => void;
}

async function collectTargets(doc: PDFDocument, pages: number[] | undefined, codecs: Map<PDFDict | undefined, Codec>) {
  const ctx = doc.context;
  const all = doc.getPages();
  const wanted = new Set(pages ?? all.map((_, i) => i));
  const streams: { target: Target; stream: Stream; page: number }[] = [];
  const annotTexts: AnnotText[] = [];
  const seenForms = new Set<string>();

  const visitForm = (page: number) => (ref: PDFRef, stream: PDFStream, parentRes: PDFDict | undefined) => {
    const id = ref.toString();
    if (seenForms.has(id)) return;
    seenForms.add(id);
    const bytes = streamBytes(stream);
    if (!bytes) return;
    const ownRes = lookupDict(doc, stream.dict.get(PDFName.of("Resources")));
    const resources = ownRes || parentRes;
    const source = toBinary(bytes);
    const target: Target = {
      source,
      resources,
      write: (out, fallbackFonts) => {
        const fresh = ctx.flateStream(fromBinary(out));
        for (const [k, v] of stream.dict.entries()) {
          const name = k.asString();
          if (name === "/Filter" || name === "/Length" || name === "/DecodeParms") continue;
          fresh.dict.set(k, v);
        }
        if (fallbackFonts.size) {
          let res = lookupDict(doc, fresh.dict.get(PDFName.of("Resources")));
          if (!res) {
            res = ctx.obj({});
            if (parentRes) for (const [k, v] of parentRes.entries()) res.set(k, v);
            fresh.dict.set(PDFName.of("Resources"), res);
          }
          for (const [name, font] of fallbackFonts) addFontResource(doc, res, name, font);
        }
        ctx.assign(ref, fresh);
      },
    };
    streams.push({ target, stream: scanStream(doc, source, resources, codecs, visitForm(page)), page });
  };

  all.forEach((page, idx) => {
    if (!wanted.has(idx)) return;
    const node = page.node;
    const source = pageSource(doc, node.Contents());
    const resources = node.Resources();
    const target: Target = {
      source,
      resources,
      write: (out, fallbackFonts) => {
        node.set(PDFName.of("Contents"), ctx.register(ctx.flateStream(fromBinary(out))));
        for (const [name, font] of fallbackFonts) node.setFontDictionary(PDFName.of(name), font.ref);
      },
    };
    streams.push({ target, stream: scanStream(doc, source, resources, codecs, visitForm(idx)), page: idx });

    // annotations (zones de texte ajoutées par un éditeur) : apparence et texte enregistré
    const annots = node.Annots();
    for (let i = 0; annots && i < annots.size(); i++) {
      const annot = lookupDict(doc, annots.get(i));
      if (!annot) continue;
      const ap = lookupDict(doc, annot.get(PDFName.of("AP")));
      const n = ap?.get(PDFName.of("N"));
      const nObj = n instanceof PDFRef ? ctx.lookup(n) : undefined;
      if (n instanceof PDFRef && nObj instanceof PDFStream) visitForm(idx)(n, nObj, undefined);
      annotTexts.push({ annot, page: idx, hasAppearance: n instanceof PDFRef && nObj instanceof PDFStream });
    }
  });
  return { streams, annotTexts };
}

interface AnnotText {
  annot: PDFDict;
  page: number;
  hasAppearance: boolean;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const looseRegex = (find: string, matchCase: boolean) => {
  const parts = find.trim().split(/\s+/).filter(Boolean).map((w) => [...w].map(escapeRe).join("\\s*"));
  return parts.length ? new RegExp(parts.join("\\s*"), matchCase ? "g" : "gi") : null;
};

/** Texte enregistré dans l'annotation (/Contents et /RC) : remplacé pour que l'éditeur affiche le nouveau texte */
function replaceAnnotStrings(annot: PDFDict, re: RegExp, replace: string | null) {
  let hits = 0;
  for (const key of ["Contents", "RC"]) {
    const v = annot.get(PDFName.of(key));
    if (!(v instanceof PDFString || v instanceof PDFHexString)) continue;
    const text = v.decodeText();
    const found = text.match(re)?.length || 0;
    if (!found) continue;
    if (key === "Contents") hits += found;
    if (replace !== null) annot.set(PDFName.of(key), PDFHexString.fromText(text.replace(re, replace.replace(/\$/g, "$$$$"))));
  }
  return hits;
}

/** Nombre d'occurrences, au total et par page */
export async function countInPdf(bytes: ArrayBuffer | Uint8Array, opts: Omit<ReplaceOptions, "replace">) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const { streams, annotTexts } = await collectTargets(doc, opts.pages, new Map());
  const perPage = new Map<number, number>();
  let total = 0;
  const add = (page: number, n: number) => {
    if (!n) return;
    total += n;
    perPage.set(page, (perPage.get(page) || 0) + n);
  };
  for (const { stream, page } of streams) add(page, findMatches(stream, opts.find, !!opts.matchCase).length);
  const re = looseRegex(opts.find, !!opts.matchCase);
  if (re) for (const a of annotTexts) if (!a.hasAppearance) add(a.page, replaceAnnotStrings(a.annot, re, null));
  return { total, pages: [...perPage.keys()].sort((a, b) => a - b) };
}

export interface ReplaceResult {
  bytes: Uint8Array;
  /** occurrences remplacées */
  replaced: number;
  /** dont écrites avec une police standard (caractère absent de la police d'origine) */
  fallback: number;
  /** occurrences laissées telles quelles (caractères non pris en charge) */
  failed: number;
}

export async function replaceInPdf(bytes: ArrayBuffer | Uint8Array, opts: ReplaceOptions): Promise<ReplaceResult> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const { streams, annotTexts } = await collectTargets(doc, opts.pages, new Map());
  const fonts = new Map<StandardFonts, PDFFont>();
  const names = new Map<PDFFont, string>();
  const nameFor = (f: PDFFont) => {
    let n = names.get(f);
    if (!n) names.set(f, (n = `MiRpl${names.size + 1}`));
    return n;
  };

  const total: ReplaceResult = { bytes: new Uint8Array(), replaced: 0, fallback: 0, failed: 0 };
  for (const { target, stream } of streams) {
    const r = await rewrite(doc, stream, opts, fonts, nameFor);
    total.replaced += r.replaced;
    total.fallback += r.fallback;
    total.failed += r.failed;
    if (r.replaced) target.write(r.source, r.fallbackFonts);
  }
  const re = looseRegex(opts.find, !!opts.matchCase);
  for (const a of annotTexts) {
    if (!re) break;
    const n = replaceAnnotStrings(a.annot, re, opts.replace);
    if (!a.hasAppearance) total.replaced += n;
    else if (n) a.annot.set(PDFName.of("M"), PDFString.fromDate(new Date()));
  }
  total.bytes = total.replaced ? await doc.save() : new Uint8Array(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  return total;
}

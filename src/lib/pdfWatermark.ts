/**
 * Suppression de filigranes et d'éléments répétés dans un PDF (dans le navigateur, sans serveur).
 *
 * Le PDF est lu avec pdf-lib ; chaque flux de contenu (pages et Form XObjects) est découpé en
 * opérations. On repère :
 *  - les blocs de texte BT…ET (texte décodé via la police : ToUnicode ou codage simple),
 *  - les images dessinées par « /Nom Do »,
 *  - les annotations de type /Watermark.
 * Un élément présent sur beaucoup de pages, ou transparent / incliné, est proposé comme filigrane.
 * La suppression retire l'opération du flux : le reste de la page n'est pas modifié.
 */
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  PDFStream,
  decodePDFRawStream,
} from "pdf-lib";

export type CandidateKind = "text" | "image" | "annotation";

export interface WatermarkCandidate {
  key: string;
  kind: CandidateKind;
  label: string;
  /** nombre de pages où l'élément apparaît */
  pages: number;
  occurrences: number;
  /** transparent ou incliné : très probablement un filigrane */
  likely: boolean;
}

export interface WatermarkAnalysis {
  pageCount: number;
  candidates: WatermarkCandidate[];
}

/* ───────────── texte : normalisation ───────────── */

export const normalizeText = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\s\u00a0]+/g, "");

/* ───────────── octets ↔ chaîne binaire ───────────── */

const toBinary = (bytes: Uint8Array) => {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return out;
};
const fromBinary = (s: string) => {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
};

/* ───────────── découpage d'un flux de contenu ───────────── */

type Operand =
  | { t: "num"; v: number }
  | { t: "str"; v: string } // octets (chaîne binaire)
  | { t: "name"; v: string }
  | { t: "arr"; v: Operand[] }
  | { t: "other" };

interface Op {
  op: string;
  args: Operand[];
  /** début de la première opérande (ou de l'opérateur) et fin de l'opérateur */
  start: number;
  end: number;
}

const WS = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
const DELIM = new Set(["(", ")", "<", ">", "[", "]", "{", "}", "/", "%"]);

function readLiteral(s: string, i: number): [string, number] {
  // s[i] === "("
  let depth = 1;
  let out = "";
  i++;
  while (i < s.length && depth > 0) {
    const c = s[i];
    if (c === "\\") {
      const n = s[i + 1];
      i += 2;
      if (n === "n") out += "\n";
      else if (n === "r") out += "\r";
      else if (n === "t") out += "\t";
      else if (n === "b") out += "\b";
      else if (n === "f") out += "\f";
      else if (n === "\r") { if (s[i] === "\n") i++; }
      else if (n === "\n") { /* continuation */ }
      else if (n >= "0" && n <= "7") {
        let oct = n;
        while (oct.length < 3 && s[i] >= "0" && s[i] <= "7") oct += s[i++];
        out += String.fromCharCode(parseInt(oct, 8) & 0xff);
      } else if (n !== undefined) out += n;
      continue;
    }
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) { i++; break; }
    }
    out += c;
    i++;
  }
  return [out, i];
}

function tokenize(s: string): Op[] {
  const ops: Op[] = [];
  const stack: Operand[][] = [[]]; // tableaux imbriqués
  let argStart = -1;
  let dictDepth = 0;
  let i = 0;
  const push = (o: Operand, start: number) => {
    if (argStart < 0 && stack.length === 1 && dictDepth === 0) argStart = start;
    if (dictDepth > 0) return;
    stack[stack.length - 1].push(o);
  };
  while (i < s.length) {
    const code = s.charCodeAt(i);
    if (WS.has(code)) { i++; continue; }
    const c = s[i];
    const start = i;
    if (c === "%") { while (i < s.length && s[i] !== "\n" && s[i] !== "\r") i++; continue; }
    if (c === "(") {
      const [v, ni] = readLiteral(s, i);
      i = ni;
      push({ t: "str", v }, start);
      continue;
    }
    if (c === "<") {
      if (s[i + 1] === "<") {
        if (argStart < 0 && stack.length === 1 && dictDepth === 0) argStart = start;
        dictDepth++;
        i += 2;
        continue;
      }
      const close = s.indexOf(">", i);
      const hex = s.slice(i + 1, close < 0 ? s.length : close).replace(/[^0-9a-fA-F]/g, "");
      i = close < 0 ? s.length : close + 1;
      let v = "";
      const h = hex.length % 2 ? hex + "0" : hex;
      for (let k = 0; k < h.length; k += 2) v += String.fromCharCode(parseInt(h.slice(k, k + 2), 16));
      push({ t: "str", v }, start);
      continue;
    }
    if (c === ">" && s[i + 1] === ">") { dictDepth = Math.max(0, dictDepth - 1); i += 2; if (dictDepth === 0) push({ t: "other" }, start); continue; }
    if (c === "[") { if (argStart < 0 && dictDepth === 0) argStart = start; if (dictDepth === 0) stack.push([]); i++; continue; }
    if (c === "]") {
      i++;
      if (dictDepth === 0 && stack.length > 1) {
        const arr = stack.pop()!;
        stack[stack.length - 1].push({ t: "arr", v: arr });
      }
      continue;
    }
    if (c === "/") {
      i++;
      while (i < s.length && !WS.has(s.charCodeAt(i)) && !DELIM.has(s[i])) i++;
      push({ t: "name", v: s.slice(start + 1, i) }, start);
      continue;
    }
    if (c === "{" || c === "}" || c === ")" || c === ">") { i++; continue; }
    // nombre ou opérateur
    while (i < s.length && !WS.has(s.charCodeAt(i)) && !DELIM.has(s[i])) i++;
    const word = s.slice(start, i);
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) { push({ t: "num", v: parseFloat(word) }, start); continue; }
    if (dictDepth > 0) continue;
    if (stack.length > 1) { stack[stack.length - 1].push({ t: "other" }); continue; }
    if (word === "BI") {
      // image en ligne : on saute jusqu'à « EI »
      const id = s.indexOf("ID", i);
      const re = /[\s]EI(?=[\s]|$)/g;
      re.lastIndex = id < 0 ? i : id + 3;
      const m = re.exec(s);
      i = m ? m.index + 3 : s.length;
      ops.push({ op: "BI", args: [], start, end: i });
      stack[0] = [];
      argStart = -1;
      continue;
    }
    ops.push({ op: word, args: stack[0], start: argStart >= 0 ? argStart : start, end: i });
    stack[0] = [];
    argStart = -1;
  }
  return ops;
}

/* ───────────── polices : décodage du texte ───────────── */

interface FontDecoder {
  decode: (bytes: string) => string;
}

function parseToUnicode(cmap: string): FontDecoder {
  const map = new Map<number, string>();
  let codeLen = 1;
  const csr = /begincodespacerange([\s\S]*?)endcodespacerange/.exec(cmap);
  if (csr) {
    const first = /<([0-9a-fA-F]+)>/.exec(csr[1]);
    if (first) codeLen = Math.max(1, Math.ceil(first[1].length / 2));
  }
  const utf16 = (hex: string) => {
    let out = "";
    for (let k = 0; k + 4 <= hex.length; k += 4) out += String.fromCharCode(parseInt(hex.slice(k, k + 4), 16));
    if (hex.length === 2) out = String.fromCharCode(parseInt(hex, 16));
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
        const list = [...m[5].matchAll(/<([0-9a-fA-F]*)>/g)].map((x) => utf16(x[1]));
        list.forEach((v, k) => map.set(lo + k, v));
      }
    }
  }
  return {
    decode: (bytes) => {
      let out = "";
      for (let k = 0; k + codeLen <= bytes.length; k += codeLen) {
        let code = 0;
        for (let j = 0; j < codeLen; j++) code = (code << 8) | bytes.charCodeAt(k + j);
        out += map.get(code) ?? "";
      }
      return out;
    },
  };
}

const LATIN: FontDecoder = { decode: (b) => b };
const NONE: FontDecoder = { decode: () => "" };

function streamBytes(obj: unknown): Uint8Array | null {
  if (obj instanceof PDFRawStream) return decodePDFRawStream(obj).decode();
  if (obj instanceof PDFStream) {
    const anyStream = obj as unknown as { getContents?: () => Uint8Array; getUnencodedContents?: () => Uint8Array };
    return anyStream.getUnencodedContents?.() ?? anyStream.getContents?.() ?? null;
  }
  return null;
}

/* ───────────── analyse d'un flux ───────────── */

interface Item {
  kind: "text" | "image";
  key: string;
  label: string;
  start: number;
  end: number;
  likely: boolean;
}

interface Scope {
  doc: PDFDocument;
  fontCache: Map<PDFDict, FontDecoder>;
  /** Form XObjects déjà analysés (ref → éléments) */
  forms: Map<string, FormInfo>;
}

interface FormInfo {
  ref: PDFRef;
  stream: PDFStream;
  source: string;
  items: Item[];
  /** éléments des formulaires imbriqués */
  nestedKeys: string[];
}

const lookupDict = (doc: PDFDocument, v: unknown): PDFDict | undefined => {
  const o = v instanceof PDFRef ? doc.context.lookup(v) : v;
  return o instanceof PDFDict ? o : undefined;
};

function fontDecoder(scope: Scope, fontDict: PDFDict | undefined): FontDecoder {
  if (!fontDict) return LATIN;
  const cached = scope.fontCache.get(fontDict);
  if (cached) return cached;
  let dec: FontDecoder = LATIN;
  const tu = fontDict.get(PDFName.of("ToUnicode"));
  const tuObj = tu instanceof PDFRef ? scope.doc.context.lookup(tu) : tu;
  const bytes = streamBytes(tuObj);
  if (bytes) dec = parseToUnicode(toBinary(bytes));
  else if (fontDict.get(PDFName.of("Subtype"))?.toString() === "/Type0") dec = NONE;
  scope.fontCache.set(fontDict, dec);
  return dec;
}

function scanContent(scope: Scope, source: string, resources: PDFDict | undefined, parentLikely = false): { items: Item[]; forms: string[] } {
  const doc = scope.doc;
  const fonts = lookupDict(doc, resources?.get(PDFName.of("Font")));
  const gstates = lookupDict(doc, resources?.get(PDFName.of("ExtGState")));
  const xobjects = lookupDict(doc, resources?.get(PDFName.of("XObject")));

  const items: Item[] = [];
  const forms: string[] = [];
  const gs: { alpha: number; rot: boolean }[] = [{ alpha: 1, rot: parentLikely }];
  let cur = { ...gs[0] };
  let block: { start: number; text: string; rot: boolean; dec: FontDecoder } | null = null;
  let dec: FontDecoder = LATIN;

  for (const o of tokenize(source)) {
    const a = o.args;
    switch (o.op) {
      case "q": gs.push({ ...cur }); break;
      case "Q": cur = gs.pop() || { alpha: 1, rot: parentLikely }; break;
      case "cm": {
        const b = a[1]?.t === "num" ? a[1].v : 0;
        const c = a[2]?.t === "num" ? a[2].v : 0;
        if (Math.abs(b) > 1e-3 || Math.abs(c) > 1e-3) cur.rot = true;
        break;
      }
      case "gs": {
        const name = a[0]?.t === "name" ? a[0].v : "";
        const g = lookupDict(doc, gstates?.get(PDFName.of(name)));
        const ca = g?.get(PDFName.of("ca"));
        if (ca instanceof PDFNumber) cur.alpha = ca.asNumber();
        break;
      }
      case "BT": block = { start: o.start, text: "", rot: cur.rot, dec }; break;
      case "Tf": {
        const name = a[0]?.t === "name" ? a[0].v : "";
        dec = fontDecoder(scope, lookupDict(doc, fonts?.get(PDFName.of(name))));
        if (block) block.dec = dec;
        break;
      }
      case "Tm": {
        const b = a[1]?.t === "num" ? a[1].v : 0;
        const c = a[2]?.t === "num" ? a[2].v : 0;
        if (block && (Math.abs(b) > 1e-3 || Math.abs(c) > 1e-3)) block.rot = true;
        break;
      }
      case "Tj": case "'": case '"': {
        const str = a[a.length - 1];
        if (block && str?.t === "str") block.text += block.dec.decode(str.v);
        break;
      }
      case "TJ": {
        const arr = a[0];
        if (block && arr?.t === "arr") {
          for (const el of arr.v) {
            if (el.t === "str") block.text += block.dec.decode(el.v);
            else if (el.t === "num" && el.v < -200) block.text += " ";
          }
        }
        break;
      }
      case "ET": {
        if (block) {
          const label = block.text.replace(/\s+/g, " ").trim();
          const key = normalizeText(label);
          if (key) items.push({ kind: "text", key: "T:" + key, label, start: block.start, end: o.end, likely: cur.alpha < 0.95 || block.rot });
        }
        block = null;
        break;
      }
      case "Do": {
        const name = a[0]?.t === "name" ? a[0].v : "";
        const ref = xobjects?.get(PDFName.of(name));
        const x = ref instanceof PDFRef ? doc.context.lookup(ref) : ref;
        if (!(x instanceof PDFStream)) break;
        const subtype = x.dict.get(PDFName.of("Subtype"))?.toString();
        const id = ref instanceof PDFRef ? ref.toString() : name;
        if (subtype === "/Image") {
          items.push({ kind: "image", key: "I:" + id, label: name, start: o.start, end: o.end, likely: cur.alpha < 0.95 });
        } else if (subtype === "/Form" && ref instanceof PDFRef) {
          scanForm(scope, ref, x, resources, cur.alpha < 0.95 || cur.rot);
          forms.push(ref.toString());
        }
        break;
      }
    }
  }
  return { items, forms };
}

function scanForm(scope: Scope, ref: PDFRef, stream: PDFStream, parentResources: PDFDict | undefined, likely: boolean) {
  const id = ref.toString();
  if (scope.forms.has(id)) return;
  const bytes = streamBytes(stream);
  const placeholder: FormInfo = { ref, stream, source: "", items: [], nestedKeys: [] };
  scope.forms.set(id, placeholder); // évite les boucles
  if (!bytes) return;
  const source = toBinary(bytes);
  const res = lookupDict(scope.doc, stream.dict.get(PDFName.of("Resources"))) || parentResources;
  const { items, forms } = scanContent(scope, source, res, likely);
  placeholder.source = source;
  placeholder.items = items;
  placeholder.nestedKeys = forms;
}

/* ───────────── document ───────────── */

interface PageInfo {
  source: string;
  items: Item[];
  forms: string[];
  watermarkAnnots: number;
}

async function loadAndScan(bytes: ArrayBuffer | Uint8Array) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const scope: Scope = { doc, fontCache: new Map(), forms: new Map() };
  const pages: PageInfo[] = doc.getPages().map((page) => {
    const node = page.node;
    const contents = node.Contents();
    const parts: Uint8Array[] = [];
    const pushStream = (v: unknown) => {
      const o = v instanceof PDFRef ? doc.context.lookup(v) : v;
      const b = streamBytes(o);
      if (b) parts.push(b);
    };
    if (contents instanceof PDFArray) for (let i = 0; i < contents.size(); i++) pushStream(contents.get(i));
    else if (contents) pushStream(contents);
    const source = parts.map(toBinary).join("\n");
    const { items, forms } = scanContent(scope, source, node.Resources());
    const annots = node.Annots();
    let watermarkAnnots = 0;
    if (annots) {
      for (let i = 0; i < annots.size(); i++) {
        const a = lookupDict(doc, annots.get(i));
        if (a?.get(PDFName.of("Subtype"))?.toString() === "/Watermark") watermarkAnnots++;
      }
    }
    return { source, items, forms, watermarkAnnots };
  });
  return { doc, scope, pages };
}

/** Tous les éléments d'une page, y compris ceux de ses Form XObjects (récursivement) */
function pageItems(scope: Scope, page: PageInfo): Item[] {
  const out = [...page.items];
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const f = scope.forms.get(id);
    if (!f) return;
    out.push(...f.items);
    f.nestedKeys.forEach(visit);
  };
  page.forms.forEach(visit);
  return out;
}

export async function analyzePdf(bytes: ArrayBuffer | Uint8Array): Promise<WatermarkAnalysis> {
  const { scope, pages } = await loadAndScan(bytes);
  const stats = new Map<string, { kind: CandidateKind; label: string; pages: Set<number>; occ: number; likely: boolean }>();
  pages.forEach((p, idx) => {
    for (const it of pageItems(scope, p)) {
      const s = stats.get(it.key) || { kind: it.kind, label: it.label, pages: new Set<number>(), occ: 0, likely: false };
      s.pages.add(idx);
      s.occ++;
      s.likely = s.likely || it.likely;
      stats.set(it.key, s);
    }
    if (p.watermarkAnnots) {
      const s = stats.get("A:watermark") || { kind: "annotation" as const, label: "Watermark", pages: new Set<number>(), occ: 0, likely: true };
      s.pages.add(idx);
      s.occ += p.watermarkAnnots;
      stats.set("A:watermark", s);
    }
  });
  const n = pages.length;
  const minPages = n <= 1 ? 1 : Math.max(2, Math.ceil(n * 0.4));
  const candidates: WatermarkCandidate[] = [...stats.entries()]
    .filter(([, s]) => s.kind === "annotation" || s.pages.size >= minPages || (s.likely && s.kind === "text"))
    .filter(([, s]) => s.kind !== "text" || s.label.length <= 160)
    .map(([key, s]) => ({ key, kind: s.kind, label: s.label, pages: s.pages.size, occurrences: s.occ, likely: s.likely }))
    .sort((a, b) => Number(b.likely) - Number(a.likely) || b.pages - a.pages || b.occurrences - a.occurrences)
    .slice(0, 40);
  return { pageCount: n, candidates };
}

export interface RemoveOptions {
  /** clés de candidats (analyzePdf) */
  keys: string[];
  /** textes saisis : retire les blocs de texte qui les contiennent (blocs courts uniquement) */
  texts?: string[];
}

export async function removeFromPdf(bytes: ArrayBuffer | Uint8Array, opts: RemoveOptions): Promise<{ bytes: Uint8Array; removed: number }> {
  const { doc, scope, pages } = await loadAndScan(bytes);
  const keys = new Set(opts.keys);
  const queries = (opts.texts || []).map(normalizeText).filter(Boolean);
  const matches = (it: Item) => {
    if (keys.has(it.key)) return true;
    if (it.kind !== "text") return false;
    const k = it.key.slice(2);
    return queries.some((q) => k.includes(q) && k.length <= q.length + 12);
  };
  const strip = (source: string, items: Item[]) => {
    const hits = items.filter(matches).sort((a, b) => b.start - a.start);
    let out = source;
    for (const it of hits) out = out.slice(0, it.start) + " " + out.slice(it.end);
    return { out, count: hits.length };
  };

  let removed = 0;
  const ctx = doc.context;
  doc.getPages().forEach((page, idx) => {
    const info = pages[idx];
    const { out, count } = strip(info.source, info.items);
    if (count) {
      removed += count;
      page.node.set(PDFName.of("Contents"), ctx.register(ctx.flateStream(fromBinary(out))));
    }
    if (keys.has("A:watermark") && info.watermarkAnnots) {
      const annots = page.node.Annots();
      if (annots) {
        for (let i = annots.size() - 1; i >= 0; i--) {
          const a = lookupDict(doc, annots.get(i));
          if (a?.get(PDFName.of("Subtype"))?.toString() === "/Watermark") { annots.remove(i); removed++; }
        }
      }
    }
  });

  for (const f of scope.forms.values()) {
    if (!f.source) continue;
    const { out, count } = strip(f.source, f.items);
    if (!count) continue;
    removed += count;
    const fresh = ctx.flateStream(fromBinary(out));
    for (const [k, v] of f.stream.dict.entries()) {
      const name = k.asString();
      if (name === "/Filter" || name === "/Length" || name === "/DecodeParms") continue;
      fresh.dict.set(k, v);
    }
    ctx.assign(f.ref, fresh);
  }

  const saved = await doc.save();
  return { bytes: saved, removed };
}

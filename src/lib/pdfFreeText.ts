/**
 * Zones de texte (annotations FreeText) créées par d'autres éditeurs, par exemple sur iPad :
 * leur apparence (couleur, police) est décrite dans /DS et /RC, mais leur /DA, que l'éditeur lit
 * pour modifier le texte, contient parfois une autre couleur ou une police inconnue.
 * On aligne /DA sur l'apparence réelle pour que le texte garde son style quand on le modifie.
 */
import { PDFDict, PDFDocument, PDFHexString, PDFName, PDFRef, PDFString } from "pdf-lib";

const STANDARD = {
  helvetica: ["Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique"],
  times: ["Times-Roman", "Times-Bold", "Times-Italic", "Times-BoldItalic"],
  courier: ["Courier", "Courier-Bold", "Courier-Oblique", "Courier-BoldOblique"],
};

const str = (v: unknown) => (v instanceof PDFString || v instanceof PDFHexString ? v.decodeText() : "");

function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}

/** Style du premier passage de texte : le dernier « color », « font-family »… rencontré l'emporte */
function readStyle(css: string) {
  const pick = (prop: string) => {
    const all = [...css.matchAll(new RegExp(`(?:^|[;\\s'"])${prop}\\s*:\\s*([^;'"]+)`, "gi"))];
    return all.length ? all[all.length - 1][1].trim() : "";
  };
  return {
    color: pick("color"),
    family: pick("font-family").toLowerCase(),
    weight: pick("font-weight").toLowerCase(),
    style: pick("font-style").toLowerCase(),
    size: parseFloat(pick("font-size")) || 0,
  };
}

const n3 = (x: number) => x.toFixed(3).replace(/\.?0+$/, "") || "0";

export async function normalizeFreeText(bytes: ArrayBuffer): Promise<ArrayBuffer> {
  const raw = new Uint8Array(bytes);
  // repérage rapide : rien à faire si le fichier ne contient pas de zone de texte (ou de flux d'objets)
  const head = new TextDecoder("latin1").decode(raw);
  if (!head.includes("FreeText") && !head.includes("ObjStm")) return bytes;

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(raw, { ignoreEncryption: true, updateMetadata: false });
  } catch {
    return bytes;
  }
  let changed = 0;
  for (const page of doc.getPages()) {
    const annots = page.node.Annots();
    for (let i = 0; annots && i < annots.size(); i++) {
      const ref = annots.get(i);
      const a = ref instanceof PDFRef ? doc.context.lookup(ref) : ref;
      if (!(a instanceof PDFDict) || a.get(PDFName.of("Subtype"))?.toString() !== "/FreeText") continue;
      const da = str(a.get(PDFName.of("DA")));
      const rc = str(a.get(PDFName.of("RC")));
      const ds = str(a.get(PDFName.of("DS")));
      // le passage de texte (span) de /RC est le plus précis, sinon /DS
      const span = /<span[^>]*style\s*=\s*['"]([^'"]*)['"]/i.exec(rc)?.[1] || "";
      const s = readStyle(`${ds};${span}`);
      const rgb = s.color ? hexToRgb(s.color) : null;
      if (!rgb) continue;

      const daSize = parseFloat(/([\d.]+)\s+Tf/.exec(da)?.[1] || "") || 0;
      const size = daSize || s.size || 12;
      const daFont = (/\/([^\s/]+)\s+[\d.]+\s+Tf/.exec(da)?.[1] || "").toLowerCase();
      const fam = `${s.family} ${daFont}`;
      const set = /courier|mono/.test(fam) ? STANDARD.courier : /times|serif|roman|georgia|garamond|cambria/.test(fam) && !/sans/.test(fam) ? STANDARD.times : STANDARD.helvetica;
      const bold = /bold|[6-9]00/.test(`${s.weight} ${daFont}`);
      const italic = /italic|oblique/.test(`${s.style} ${daFont}`);
      const font = set[(bold ? 1 : 0) + (italic ? 2 : 0)];

      const next = `/${font} ${n3(size)} Tf ${rgb.map(n3).join(" ")} rg`;
      if (next === da.trim()) continue;
      a.set(PDFName.of("DA"), PDFString.of(next));
      changed++;
    }
  }
  if (!changed) return bytes;
  const out = await doc.save({ useObjectStreams: false });
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
}

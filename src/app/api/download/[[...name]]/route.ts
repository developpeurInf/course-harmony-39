/**
 * Téléchargement de fichiers générés dans le navigateur (Excel, PDF, CSV).
 * Le contenu (base64) est renvoyé en pièce jointe : utile sur les navigateurs
 * mobiles qui ignorent l'attribut `download` des liens blob:.
 */
const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function contentTypeFor(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return TYPES[ext] ?? TYPES.xlsx;
}

function respond(filename: string, base64: string) {
  const safeName = filename.replace(/["\r\n]/g, "");
  return new Response(Buffer.from(base64, "base64"), {
    headers: {
      "Content-Type": contentTypeFor(safeName),
      "Content-Disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      "Cache-Control": "no-cache",
    },
  });
}

function nameFromPath(params: { name?: string[] }) {
  const last = params.name?.[params.name.length - 1];
  return last && last.includes(".") ? decodeURIComponent(last) : null;
}

type Ctx = { params: Promise<{ name?: string[] }> };

export async function GET(req: Request, ctx: Ctx) {
  const url = new URL(req.url);
  const filename = nameFromPath(await ctx.params) ?? url.searchParams.get("filename") ?? "liste_eleves.xlsx";
  return respond(filename, url.searchParams.get("data") ?? "");
}

export async function POST(req: Request, ctx: Ctx) {
  let filename = nameFromPath(await ctx.params) ?? "liste_eleves.xlsx";
  let data = "";
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const json = await req.json().catch(() => ({}));
    if (json.filename) filename = json.filename;
    if (json.data) data = json.data;
  } else {
    const form = new URLSearchParams(await req.text());
    filename = form.get("filename") ?? filename;
    data = form.get("data") ?? "";
  }
  return respond(filename, data);
}

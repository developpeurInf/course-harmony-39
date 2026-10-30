import { toast } from "sonner";
import { getAppSettingsSnapshot } from "@/contexts/AppSettingsContext";

type Lang = "fr" | "ar" | "en";

/** Cartes d'identifiants à découper (8 par page A4) : nom, identifiant, mot de passe provisoire, adresse */
export function printCredentialCards(
  students: { name: string; username?: string | null; temporary_password?: string | null }[],
  roomName: string,
  lang: Lang
) {
  const L = (fr: string, ar: string, en: string) => (lang === "ar" ? ar : lang === "en" ? en : fr);
  const w = window.open("", "_blank", "width=820,height=980");
  if (!w) {
    toast.error(L("Fenêtre bloquée : autorisez les fenêtres pop-up.", "تم حظر النافذة: اسمح بالنوافذ المنبثقة.", "Pop-up blocked: allow pop-ups."));
    return;
  }
  const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
  const brand = getAppSettingsSnapshot();
  const app = brand.identity.appName || "Math infini";
  const url = `${window.location.origin}/login`;
  const dir = lang === "ar" ? "rtl" : "ltr";
  const cards = students.map(s => `
  <div class="card">
    <div class="top"><strong>${esc(app)}</strong><span>${esc(roomName)}</span></div>
    <div class="name">${esc(s.name)}</div>
    <div class="row"><span>${esc(L("Identifiant", "اسم المستخدم", "Username"))}</span><code>${esc(s.username || "—")}</code></div>
    <div class="row"><span>${esc(L("Mot de passe", "كلمة المرور", "Password"))}</span><code>${esc(s.temporary_password || L("(demander au professeur)", "(اطلب من الأستاذ)", "(ask your teacher)"))}</code></div>
    <div class="url">${esc(url)}</div>
    <div class="hint">${esc(L("Changez ce mot de passe à la première connexion.", "غيّر كلمة المرور عند أول دخول.", "Change this password on first login."))}</div>
  </div>`).join("");
  w.document.write(`<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><title>${esc(L("Identifiants", "بيانات الدخول", "Credentials"))} · ${esc(roomName)}</title>
<style>
body{font-family:Arial,Tahoma,sans-serif;margin:0;padding:10mm;color:#111}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:6mm}
.card{border:1px dashed #888;border-radius:6px;padding:4mm 5mm;break-inside:avoid;height:58mm;box-sizing:border-box;display:flex;flex-direction:column;gap:2mm}
.top{display:flex;justify-content:space-between;font-size:11px;color:#555}
.name{font-size:16px;font-weight:bold;margin-top:1mm}
.row{display:flex;justify-content:space-between;align-items:center;font-size:12px;gap:4mm}
code{font-family:Consolas,monospace;font-size:15px;direction:ltr;unicode-bidi:embed;background:#f3f3f3;padding:1mm 2mm;border-radius:3px}
.url{font-size:11px;direction:ltr;unicode-bidi:embed;margin-top:auto}
.hint{font-size:10px;color:#666}
@media print{body{padding:8mm}}
</style></head><body><div class="grid">${cards}</div><script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
}

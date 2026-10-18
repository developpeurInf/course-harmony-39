import { toast } from "sonner";
// Traducteurs chargés à la demande avec le dictionnaire de la langue (src/i18n) :
// tant qu'il n'est pas chargé, le texte est affiché tel quel.
import { getLoadedTranslator } from "@/i18n/loader";

// Intercept all Sonner toast calls to automatically translate (anglais → arabe / français)
// according to the active language.

function getActiveLanguage(): string {
  try {
    return localStorage.getItem("maataoui-language") || "fr";
  } catch {
    return "fr";
  }
}

// Erreurs d'habilitation renvoyées par la base (offre / quotas) → message clair
function friendlyAccessError(text: string, lang: string): string {
  if (typeof text !== "string") return text;
  const m = text.match(/(PERMISSION|QUOTA):[\w.]+ — ([^\n]+)/);
  if (m) {
    try { window.dispatchEvent(new Event("access-refresh")); } catch { /* ancien navigateur */ }
    const detail = m[2].replace(/^(Limite de votre offre atteinte|Non inclus dans votre offre) : /, "");
    if (m[1] === "QUOTA") {
      return lang === "ar" ? `تم بلوغ حد عرضك: ${detail}` : lang === "en" ? `Plan limit reached: ${detail}` : `Limite de votre offre atteinte : ${detail}`;
    }
    return lang === "ar" ? `غير مدرج في عرضك: ${detail}` : lang === "en" ? `Not included in your plan: ${detail}` : `Non inclus dans votre offre : ${detail}`;
  }
  if (/row-level security policy "hab:/.test(text) || /Changement de rôle non autorisé/.test(text)) {
    // la base vient de refuser : on relit tout de suite les droits pour mettre l'écran à jour
    try { window.dispatchEvent(new Event("access-refresh")); } catch { /* ancien navigateur */ }
    return lang === "ar"
      ? "هذه العملية غير مدرجة في عرضك أو أن اشتراكك منته."
      : lang === "en"
      ? "This action is not included in your plan, or your subscription has expired."
      : "Action non incluse dans votre offre, ou abonnement expiré.";
  }
  return text;
}

function processToastArgs(args: any[]): any[] {
  const lang = getActiveLanguage();
  if (args.length > 0) {
    args = [...args];
    if (typeof args[0] === "string") args[0] = friendlyAccessError(args[0], lang);
    if (args[1] && typeof args[1] === "object" && typeof args[1].description === "string") {
      args[1] = { ...args[1], description: friendlyAccessError(args[1].description, lang) };
    }
  }
  if ((lang !== "ar" && lang !== "fr") || args.length === 0) return args;
  const translate = getLoadedTranslator(lang as "ar" | "fr");
  if (!translate) return args;

  const [message, options] = args;
  let translatedMessage = message;

  if (typeof message === "string") {
    translatedMessage = translate(message);
  }

  let translatedOptions = options;
  if (options && typeof options === "object") {
    translatedOptions = { ...options };
    if (typeof options.description === "string") {
      translatedOptions.description = translate(options.description);
    }
  }

  const out = [translatedMessage, translatedOptions];
  // arguments supplémentaires éventuels conservés
  for (let i = 2; i < args.length; i++) out.push(args[i]);
  return out;
}

export function setupToastInterceptor() {
  if (typeof window === "undefined") return;
  if ((window as any).__toastInterceptorInitialized) return;
  (window as any).__toastInterceptorInitialized = true;

  const methods: Array<keyof typeof toast> = [
    "success",
    "error",
    "info",
    "warning",
    "message",
    "loading",
  ];

  for (const method of methods) {
    const original = (toast as any)[method];
    if (typeof original === "function") {
      (toast as any)[method] = function (...args: any[]) {
        const processed = processToastArgs(args);
        return original.apply(this, processed);
      };
    }
  }
}

// Auto-run on import
setupToastInterceptor();

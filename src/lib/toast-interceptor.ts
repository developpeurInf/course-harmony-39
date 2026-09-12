import { toast } from "sonner";
import { translateToArabic } from "./arabic-translations";

// Intercept all Sonner toast calls to automatically translate to Arabic
// when Arabic is the active language.

function getActiveLanguage(): string {
  try {
    return localStorage.getItem("maataoui-language") || "fr";
  } catch {
    return "fr";
  }
}

function processToastArgs(args: any[]): any[] {
  const lang = getActiveLanguage();
  if (lang !== "ar" || args.length === 0) return args;

  const [message, options] = args;
  let translatedMessage = message;

  if (typeof message === "string") {
    translatedMessage = translateToArabic(message);
  }

  let translatedOptions = options;
  if (options && typeof options === "object") {
    translatedOptions = { ...options };
    if (typeof options.description === "string") {
      translatedOptions.description = translateToArabic(options.description);
    }
  }

  return [translatedMessage, translatedOptions];
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

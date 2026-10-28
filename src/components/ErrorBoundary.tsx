import React from "react";

/**
 * Filet de sécurité : une erreur d'affichage dans une page n'efface plus tout l'écran.
 * Messages en fr / ar / en (langue lue dans le stockage local ou sur <html lang>).
 */
type Lang = "fr" | "ar" | "en";

const readLang = (): Lang => {
  let l: string | null = null;
  try {
    l = localStorage.getItem("maataoui-language");
  } catch {
    /* stockage indisponible */
  }
  if (!l && typeof document !== "undefined") l = document.documentElement.getAttribute("lang");
  return l === "ar" || l === "en" ? l : "fr";
};

const TEXTS: Record<Lang, { title: string; body: string; reload: string; back: string }> = {
  fr: {
    title: "Une erreur est survenue",
    body: "La page n'a pas pu s'afficher correctement. Rechargez-la pour continuer.",
    reload: "Recharger",
    back: "Retour à l'accueil",
  },
  ar: {
    title: "حدث خطأ",
    body: "تعذّر عرض الصفحة بشكل صحيح. أعد تحميلها للمتابعة.",
    reload: "إعادة التحميل",
    back: "العودة إلى الرئيسية",
  },
  en: {
    title: "Something went wrong",
    body: "This page could not be displayed correctly. Reload it to continue.",
    reload: "Reload",
    back: "Back to home",
  },
};

interface Props {
  children: React.ReactNode;
  /** Change de valeur (ex. l'adresse de la page) → l'erreur est effacée */
  resetKey?: string;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error("ErrorBoundary:", error, info && info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const lang = readLang();
    const t = TEXTS[lang];
    return (
      <div
        role="alert"
        dir={lang === "ar" ? "rtl" : "ltr"}
        data-no-translate
        className="flex min-h-[60vh] w-full items-center justify-center p-6"
      >
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="mb-2 text-lg font-semibold text-foreground">{t.title}</h1>
          <p className="mb-5 text-sm text-muted-foreground">{t.body}</p>
          <div className="flex flex-col items-center justify-center sm:flex-row">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="m-1 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
            >
              {t.reload}
            </button>
            <a
              href="/"
              className="m-1 inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border px-5 text-sm font-medium text-foreground"
            >
              {t.back}
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;

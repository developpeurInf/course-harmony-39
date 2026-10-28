import AuthForm from "@/components/AuthForm";
import { useEffect } from "react";
import { useLocation, useNavigate } from "@/lib/router";
import { useAuth } from "@/contexts/AuthContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBrand } from "@/components/AppBrand";
import AuthAside from "@/components/AuthAside";

type FromState = { from?: { pathname?: string; search?: string; hash?: string } } | null;

/** Page demandée avant la redirection vers /login (MainLayout la transmet dans state.from). */
function getRedirectTarget(state: FromState): string {
  const from = state && state.from;
  const pathname = from && typeof from.pathname === "string" ? from.pathname : "";
  // On ne renvoie jamais vers /login ni vers une URL externe
  if (!pathname || pathname.charAt(0) !== "/" || pathname.indexOf("//") === 0 || pathname.indexOf("/login") === 0 || pathname === "/") {
    return "/dashboard";
  }
  return pathname + (from && from.search ? from.search : "") + (from && from.hash ? from.hash : "");
}

const Login = () => {
  const { isLoggedIn, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const brand = useBrand(language);
  const isRtl = language === "ar";

  useEffect(() => {
    // Déjà connecté (ou connexion réussie) : retour à la page demandée, sinon tableau de bord
    if (!loading && isLoggedIn) {
      navigate(getRedirectTarget(location.state as FromState), { replace: true });
    }
  }, [isLoggedIn, loading, navigate, location.state]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" role="status">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-foreground/70" />
      </div>
    );
  }

  return (
    <div className="grid min-h-screen bg-card lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex min-h-screen flex-col">
        {/* Barre d'outils dans le flux normal : ne recouvre jamais le formulaire */}
        <header
          className="flex items-center justify-end gap-1 px-4 sm:px-6"
          style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
        >
          <LanguageSelector />
          <ThemeToggle />
        </header>
        <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[380px]">
            <AuthForm />
          </div>
        </main>
        <footer className="px-6 pb-6 text-center text-xs text-muted-foreground lg:text-start">
          © {new Date().getFullYear()} {brand.appName}
        </footer>
      </div>
      <AuthAside />
    </div>
  );
};

export default Login;

import AuthForm from "@/components/AuthForm";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ThemeToggle } from "@/components/ThemeToggle";

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

  useEffect(() => {
    // Déjà connecté (ou connexion réussie) : retour à la page demandée, sinon tableau de bord
    if (!loading && isLoggedIn) {
      navigate(getRedirectTarget(location.state as FromState), { replace: true });
    }
  }, [isLoggedIn, loading, navigate, location.state]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background to-muted">
      {/* Barre d'outils dans le flux normal : ne recouvre jamais le formulaire (FR/EN à droite, AR à gauche) */}
      <header
        className="flex items-center justify-end gap-2 px-4 pt-4"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <LanguageSelector />
        <ThemeToggle />
      </header>
      <div className="flex-1">
        <AuthForm />
      </div>
    </div>
  );
};

export default Login;

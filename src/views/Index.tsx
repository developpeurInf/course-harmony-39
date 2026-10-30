import { Navigate } from "@/lib/router";
import { useAuth } from "@/contexts/AuthContext";

/** Accueil : tableau de bord si une session existe, sinon page de connexion. */
const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" role="status">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-foreground/70" />
      </div>
    );
  }

  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
};

export default Index;

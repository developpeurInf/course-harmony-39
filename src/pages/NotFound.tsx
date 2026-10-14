import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Home } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const { language } = useLanguage();
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
      <div className="text-center max-w-md">
        <p className="text-6xl font-extrabold text-primary mb-2" aria-hidden="true">404</p>
        <h1 className="text-xl font-bold mb-2">
          {tr("Page introuvable", "الصفحة غير موجودة", "Page not found")}
        </h1>
        <p className="text-muted-foreground mb-6">
          {tr(
            "La page que vous cherchez n'existe pas ou a été déplacée.",
            "الصفحة التي تبحث عنها غير موجودة أو تم نقلها.",
            "The page you are looking for doesn't exist or has been moved."
          )}
        </p>
        <Button asChild className="h-11 px-6 rounded-xl">
          <Link to="/dashboard" replace>
            <Home className="h-4 w-4" />
            {tr("Retour à l'accueil", "العودة إلى الرئيسية", "Back to home")}
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;

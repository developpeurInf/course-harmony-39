import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAccess } from "@/contexts/AccessContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { SubscriptionBanner } from "@/components/access/AccessUi";
import { useSessionTracking } from "@/hooks/useSessionTracking";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { installIOSFocusScrollFix } from "@/components/ui/ui-i18n";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";
import BottomNav from "./BottomNav";

/** Distance de défilement à partir de laquelle les boutons Haut / Bas apparaissent */
const SCROLL_THRESHOLD = 400;

const MainLayout = () => {
  const { user, loading } = useAuth();
  const { isAdmin } = useAccess();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const [scrollState, setScrollState] = useState({ top: false, bottom: false });

  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);

  // Initialize session tracking for students
  useSessionTracking();

  // iOS : le champ actif reste visible au-dessus du clavier
  useEffect(() => {
    installIOSFocusScrollFix();
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      // replace : le bouton « Retour » ne ramène pas vers une page protégée ;
      // state.from : après connexion, Login renvoie vers la page demandée
      navigate("/login", {
        replace: true,
        state: { from: { pathname: location.pathname, search: location.search, hash: location.hash } },
      });
    }
    // location volontairement exclue : seule la perte de session déclenche la redirection
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, navigate]);

  const recompute = useCallback(() => {
    const el = mainRef.current;
    if (!el) return;
    const scrolled = el.scrollTop;
    const remaining = el.scrollHeight - el.clientHeight - scrolled;
    const next = {
      top: scrolled > SCROLL_THRESHOLD,
      bottom: scrolled > SCROLL_THRESHOLD && remaining > SCROLL_THRESHOLD,
    };
    setScrollState((prev) => (prev.top === next.top && prev.bottom === next.bottom ? prev : next));
  }, []);

  // Défilement, redimensionnement de la fenêtre et du contenu (ResizeObserver si disponible)
  useEffect(() => {
    const mainEl = mainRef.current;
    if (!mainEl) return;

    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        recompute();
      });
    };

    mainEl.addEventListener("scroll", schedule, { passive: true } as AddEventListenerOptions);
    window.addEventListener("resize", schedule);

    let observer: { observe: (el: Element) => void; disconnect: () => void } | null = null;
    const RO = (window as any).ResizeObserver;
    if (RO) {
      observer = new RO(schedule);
      observer!.observe(mainEl);
      for (let i = 0; i < mainEl.children.length; i++) observer!.observe(mainEl.children[i]);
    }

    recompute();
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      mainEl.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (observer) observer.disconnect();
    };
    // user : <main> n'existe qu'une fois l'utilisateur chargé
  }, [recompute, user, loading]);

  // Changement de page : nouveau contenu, on recalcule (immédiatement puis après le rendu différé)
  useEffect(() => {
    recompute();
    const timer = window.setTimeout(recompute, 500);
    return () => window.clearTimeout(timer);
  }, [location.pathname, recompute]);

  const scrollMain = (top: number) => {
    const el = mainRef.current;
    if (!el) return;
    try {
      el.scrollTo({ top, behavior: "smooth" });
    } catch {
      el.scrollTop = top; // Safari < 14 : pas d'options de scrollTo sur un élément
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  // Les comptes de l'équipe d'administration ont leur propre espace
  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  const topLabel = tr("Aller en haut", "الانتقال إلى الأعلى", "Back to top");
  const bottomLabel = tr("Aller en bas", "الانتقال إلى الأسفل", "Go to bottom");
  const floatingBtn =
    "h-10 w-10 rounded-full shadow-lg border border-border/80 bg-background/95 hover:bg-primary hover:text-primary-foreground transition-all duration-200";

  return (
    <div className="with-bottomnav flex app-viewport bg-background overflow-hidden">
      <aside className="hidden lg:flex lg:w-72 h-full max-h-screen overflow-hidden bg-background border-r rtl:border-r-0 rtl:border-l border-border/70 shadow-xs flex-shrink-0 z-20">
        <Sidebar />
      </aside>
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        <TopNav />
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 pb-12 md:pb-12 pb-bottomnav touch-auto"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <Suspense
            fallback={
              <div className="flex items-center justify-center min-h-[40vh]">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
              </div>
            }
          >
            <SubscriptionBanner />
            <Outlet />
          </Suspense>
        </main>

        {/* Boutons flottants Haut / Bas (après 400 px de défilement) */}
        {(scrollState.top || scrollState.bottom) && (
          <div className="safe-bottom-offset fixed right-4 sm:right-6 rtl:right-auto rtl:left-4 sm:rtl:right-auto sm:rtl:left-6 z-30 flex flex-col gap-2 print:hidden">
            {scrollState.top && (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={() => scrollMain(0)}
                className={floatingBtn}
                title={topLabel}
                aria-label={topLabel}
              >
                <ArrowUp className="h-5 w-5" />
              </Button>
            )}
            {scrollState.bottom && (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={() => scrollMain(mainRef.current ? mainRef.current.scrollHeight : 0)}
                className={floatingBtn}
                title={bottomLabel}
                aria-label={bottomLabel}
              >
                <ArrowDown className="h-5 w-5" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Navigation du bas : téléphones / tablettes (< lg), élèves et professeurs */}
      <BottomNav />
    </div>
  );
};

export default MainLayout;

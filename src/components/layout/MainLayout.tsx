import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAccess } from "@/contexts/AccessContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { SubscriptionBanner } from "@/components/access/AccessUi";
import { useSessionTracking } from "@/hooks/useSessionTracking";
import { ArrowUp, ArrowDown, Info, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import type { Lang } from "@/lib/appSettings";
import { Button } from "@/components/ui/button";
import { installIOSFocusScrollFix } from "@/components/ui/ui-i18n";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";
import BottomNav from "./BottomNav";

/** Empreinte courte d'un texte (pour mémoriser qu'une annonce précise a été fermée). */
function textHash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const ANNOUNCEMENT_TONES = {
  info: {
    box: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-100",
    icon: "text-sky-600 dark:text-sky-400",
    Icon: Info,
  },
  warning: {
    box: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100",
    icon: "text-amber-600 dark:text-amber-400",
    Icon: AlertTriangle,
  },
  success: {
    box: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100",
    icon: "text-emerald-600 dark:text-emerald-400",
    Icon: CheckCircle2,
  },
} as const;

/**
 * Bandeau d'annonce de l'administration (Personnalisation → Textes), affiché en haut du
 * contenu pour tous les utilisateurs connectés ; fermable (mémorisé par utilisateur et par texte).
 */
const AnnouncementBanner = ({ userId, language }: { userId: string; language: string }) => {
  const { settings, text } = useAppSettings();
  const lang = (language === "ar" || language === "en" ? language : "fr") as Lang;
  const message = text(settings.texts?.announcement, lang);
  const hash = message ? textHash(message) : "";
  const storageKey = `app-announcement-dismissed-${userId}`;
  const [dismissed, setDismissed] = useState<string | null>(() => {
    try { return localStorage.getItem(storageKey); } catch { return null; }
  });
  useEffect(() => {
    try { setDismissed(localStorage.getItem(storageKey)); } catch { setDismissed(null); }
  }, [storageKey]);

  if (!message || dismissed === hash) return null;
  const tone = ANNOUNCEMENT_TONES[settings.texts?.announcementTone as keyof typeof ANNOUNCEMENT_TONES] || ANNOUNCEMENT_TONES.info;
  const ToneIcon = tone.Icon;
  const closeLabel = lang === "ar" ? "إخفاء الإعلان" : lang === "en" ? "Dismiss announcement" : "Masquer l'annonce";
  const dismiss = () => {
    try { localStorage.setItem(storageKey, hash); } catch { /* stockage indisponible */ }
    setDismissed(hash);
  };

  return (
    <div
      role="status"
      dir={lang === "ar" ? "rtl" : "ltr"}
      className={`mb-3 sm:mb-4 flex items-start gap-2.5 rounded-xl border px-3 py-2.5 sm:px-4 text-sm shadow-xs print:hidden ${tone.box}`}
    >
      <ToneIcon className={`mt-0.5 h-4 w-4 shrink-0 ${tone.icon}`} aria-hidden="true" />
      <p className="min-w-0 flex-1 whitespace-pre-line break-words leading-relaxed">{message}</p>
      <button
        type="button"
        onClick={dismiss}
        className="-m-1 shrink-0 rounded-lg p-1.5 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={closeLabel}
        title={closeLabel}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

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
  const { settings: appSettings, text: settingText, feature } = useAppSettings();
  const showBottomNav = feature("bottomNav");
  const footerText = settingText(appSettings.texts?.footer, (language === "ar" || language === "en" ? language : "fr") as Lang);

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
    <div className={`${showBottomNav ? "with-bottomnav " : ""}flex app-viewport bg-background overflow-hidden`}>
      <aside className="hidden lg:flex lg:w-72 h-full max-h-screen overflow-hidden bg-background border-r rtl:border-r-0 rtl:border-l border-border/70 shadow-xs flex-shrink-0 z-20">
        <Sidebar />
      </aside>
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        <TopNav />
        <main
          ref={mainRef}
          className={`flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 pb-12 md:pb-12 ${showBottomNav ? "pb-bottomnav " : ""}touch-auto`}
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <Suspense
            fallback={
              <div className="flex items-center justify-center min-h-[40vh]">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
              </div>
            }
          >
            <AnnouncementBanner userId={user.id} language={language} />
            <SubscriptionBanner />
            <Outlet />
          </Suspense>
          {footerText && (
            <footer
              dir={language === "ar" ? "rtl" : "ltr"}
              className="mt-10 border-t border-border/60 pt-4 text-center text-xs text-muted-foreground whitespace-pre-line break-words print:hidden"
            >
              {footerText}
            </footer>
          )}
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


import { useEffect, useRef, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSessionTracking } from "@/hooks/useSessionTracking";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";

const MainLayout = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  
  // Initialize session tracking for students
  useSessionTracking();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const mainEl = mainRef.current;
    if (!mainEl) return;

    const checkScroll = () => {
      // Show buttons if the page is scrollable
      if (mainEl.scrollHeight > mainEl.clientHeight + 80) {
        setShowScrollButtons(true);
      } else {
        setShowScrollButtons(false);
      }
    };

    checkScroll();
    const timer = setTimeout(checkScroll, 500);
    window.addEventListener("resize", checkScroll);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", checkScroll);
    };
  }, []);

  const scrollToTop = () => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const scrollToBottom = () => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: mainRef.current.scrollHeight, behavior: "smooth" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <div className="flex h-screen h-[100dvh] bg-background overflow-hidden">
      <aside className="hidden md:flex md:w-64 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-sm">
        <Sidebar />
      </aside>
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        <TopNav />
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto p-4 md:p-6 pb-28 md:pb-12 touch-auto"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <Outlet />
        </main>

        {/* Floating Quick Scroll to Top / Bottom Buttons (Haut / Bas) */}
        {showScrollButtons && (
          <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 print:hidden">
            <Button
              variant="secondary"
              size="icon"
              onClick={scrollToTop}
              className="h-10 w-10 rounded-full shadow-lg border border-border/80 bg-background/90 backdrop-blur-sm hover:bg-primary hover:text-primary-foreground transition-all duration-200"
              title="Aller en haut"
              aria-label="Aller en haut"
            >
              <ArrowUp className="h-5 w-5" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={scrollToBottom}
              className="h-10 w-10 rounded-full shadow-lg border border-border/80 bg-background/90 backdrop-blur-sm hover:bg-primary hover:text-primary-foreground transition-all duration-200"
              title="Aller en bas"
              aria-label="Aller en bas"
            >
              <ArrowDown className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MainLayout;


import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSessionTracking } from "@/hooks/useSessionTracking";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";

const MainLayout = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  // Initialize session tracking for students
  useSessionTracking();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

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
    <div className="flex h-screen bg-background">
      <aside className="hidden md:flex md:w-64 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-sm">
        <Sidebar />
      </aside>
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;

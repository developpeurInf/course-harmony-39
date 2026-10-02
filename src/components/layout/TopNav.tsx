import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCourses } from "@/contexts/CourseContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Menu, 
  LogOut, 
  User,
  Settings,
  Camera,
  Home,
  BookOpen,
  FileText,
  Calendar,
  Users,
  BarChart3,
  FileSpreadsheet,
  FolderOpen,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  GraduationCap
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import Sidebar from "./Sidebar";
import NotificationBell from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import ProfileAvatarDialog from "@/components/ProfileAvatarDialog";
import { cn } from "@/lib/utils";

const TopNav = () => {
  const { user, logout } = useAuth();
  const { t, language } = useLanguage();
  const { rooms } = useCourses();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  const isRtl = language === "ar";
  const isProfessor = user?.role === "professor";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Helper to determine the current page title & icon
  const getPageInfo = () => {
    const path = location.pathname;

    if (path.startsWith("/dashboard")) {
      return {
        title: language === "ar" ? "لوحة التحكم" : language === "fr" ? "Tableau de bord" : "Dashboard",
        icon: Home,
        color: "text-blue-500 bg-blue-500/10"
      };
    }
    if (path.includes("/students-activities")) {
      return {
        title: language === "ar" ? "أنشطة التلاميذ" : language === "fr" ? "Activités des élèves" : "Student Activities",
        icon: BarChart3,
        color: "text-amber-500 bg-amber-500/10"
      };
    }
    if (path.includes("/students")) {
      return {
        title: language === "ar" ? "إدارة التلاميذ" : language === "fr" ? "Gestion des élèves" : "Students",
        icon: Users,
        color: "text-sky-500 bg-sky-500/10"
      };
    }
    if (path.includes("/courses")) {
      return {
        title: language === "ar" ? "الدروس والمحتوى" : language === "fr" ? "Cours & Leçons" : "Courses",
        icon: BookOpen,
        color: "text-emerald-500 bg-emerald-500/10"
      };
    }
    if (path.includes("/exercises")) {
      return {
        title: language === "ar" ? "التمارين والسلاسل" : language === "fr" ? "Exercices & Séries" : "Exercises",
        icon: FileText,
        color: "text-purple-500 bg-purple-500/10"
      };
    }
    if (path.includes("/exams")) {
      return {
        title: language === "ar" ? "الامتحانات والاختبارات" : language === "fr" ? "Examens & Quiz" : "Exams & Quizzes",
        icon: Calendar,
        color: "text-rose-500 bg-rose-500/10"
      };
    }
    if (path.startsWith("/reports")) {
      return {
        title: language === "ar" ? "التقارير والإحصائيات" : language === "fr" ? "Rapports & Statistiques" : "Reports & Analytics",
        icon: BarChart3,
        color: "text-indigo-500 bg-indigo-500/10"
      };
    }
    if (path.startsWith("/diagnostic")) {
      return {
        title: language === "ar" ? "التقويم التشخيصي" : language === "fr" ? "Évaluation Diagnostique" : "Diagnostic Assessment",
        icon: FileSpreadsheet,
        color: "text-violet-500 bg-violet-500/10"
      };
    }
    if (path.startsWith("/class-management")) {
      return {
        title: language === "ar" ? "إدارة الأقسام" : language === "fr" ? "Gestion des Classes" : "Class Management",
        icon: FolderOpen,
        color: "text-teal-500 bg-teal-500/10"
      };
    }
    if (path.startsWith("/profile")) {
      return {
        title: language === "ar" ? "الملف الشخصي" : language === "fr" ? "Mon Profil" : "Profile",
        icon: User,
        color: "text-slate-500 bg-slate-500/10"
      };
    }
    if (path.startsWith("/settings")) {
      return {
        title: language === "ar" ? "الإعدادات" : language === "fr" ? "Paramètres" : "Settings",
        icon: Settings,
        color: "text-slate-500 bg-slate-500/10"
      };
    }

    return {
      title: language === "ar" ? "Math infini ∞" : "Math infini ∞",
      icon: Sparkles,
      color: "text-primary bg-primary/10"
    };
  };

  const pageInfo = getPageInfo();
  const PageIcon = pageInfo.icon;
  const firstName = user?.name ? user.name.split(' ')[0] : (isProfessor ? "Professeur" : "Élève");

  return (
    <header 
      dir={isRtl ? "rtl" : "ltr"}
      className="sticky top-0 z-30 h-16 w-full bg-background/80 backdrop-blur-xl border-b border-border/70 shadow-xs flex items-center justify-between px-3 md:px-6 transition-all"
    >
      {/* Left Section: Mobile Drawer Trigger + Current Page Info */}
      <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
        {/* Mobile Sidebar Hamburger */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors flex-shrink-0"
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent 
            side={isRtl ? "right" : "left"} 
            className="p-0 w-72 max-w-[85vw] border-0 overflow-hidden bg-transparent shadow-2xl" 
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('a')) {
                setIsOpen(false);
              }
            }}
          >
            <Sidebar />
          </SheetContent>
        </Sheet>

        {/* Brand on mobile / Page context on desktop */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn(
            "p-2 rounded-xl transition-all flex items-center justify-center flex-shrink-0",
            pageInfo.color
          )}>
            <PageIcon className="h-4.5 w-4.5" />
          </div>

          <div className="flex flex-col min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-foreground truncate tracking-tight">
              {pageInfo.title}
            </h1>
            <span className="text-[11px] text-muted-foreground hidden sm:block truncate">
              {language === "ar"
                ? `مرحباً، ${firstName} 👋`
                : language === "fr"
                ? `Bonjour, ${firstName} 👋`
                : `Welcome, ${firstName} 👋`}
            </span>
          </div>
        </div>
      </div>

      {/* Right Section: Compact Glass Toolbar & Profile Capsule */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Controls Container Pill */}
        <div className="flex items-center gap-1 p-1 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/70 dark:border-slate-800/70 shadow-2xs">
          <LanguageSelector />
          <NotificationBell />
          <ThemeToggle />
        </div>

        {/* User Profile Capsule Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="h-10 px-2 sm:px-2.5 py-1 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-900 border border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition-all flex items-center gap-2 cursor-pointer focus-visible:ring-1"
            >
              <div className="relative flex-shrink-0">
                <Avatar className="h-7 w-7 ring-2 ring-primary/20">
                  <AvatarImage src={user?.avatar_url} alt={user?.name || "Profile"} className="object-cover" />
                  <AvatarFallback className="bg-gradient-to-tr from-primary to-indigo-600 text-white font-bold text-[11px]">
                    {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || user?.name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-1.5 ring-background" />
              </div>

              <div className="hidden lg:flex flex-col items-start text-left rtl:text-right min-w-0">
                <span className="text-xs font-bold text-foreground truncate max-w-[100px] leading-tight">
                  {user?.name || (isProfessor ? "Professeur" : "Élève")}
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  {isProfessor ? t("Professeur", "أستاذ", "Professor") : t("Élève", "تلميذ", "Student")}
                </span>
              </div>

              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block transition-transform duration-200" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent 
            align={isRtl ? "start" : "end"} 
            className="w-64 p-1.5 rounded-2xl shadow-2xl border-border/80 backdrop-blur-xl bg-card/95 overflow-hidden"
          >
            {/* Header with full user details */}
            <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl mb-1 border border-border/40">
              <div className="relative flex-shrink-0">
                <Avatar className="h-10 w-10 ring-2 ring-primary/30 shadow-xs">
                  <AvatarImage src={user?.avatar_url} alt={user?.name || "Profile"} className="object-cover" />
                  <AvatarFallback className="bg-gradient-to-tr from-primary to-indigo-600 text-white font-bold text-sm">
                    {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-foreground truncate">{user?.name}</span>
                </div>
                <span className="text-xs text-muted-foreground font-normal truncate">{user?.email}</span>
                <div className="mt-1">
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-[9px] px-1.5 py-0 h-4 border-0 font-bold",
                      isProfessor 
                        ? "bg-blue-500/15 text-blue-600 dark:text-blue-400" 
                        : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    {isProfessor ? t("Professeur", "أستاذ", "Professor") : t("Élève", "تلميذ", "Student")}
                  </Badge>
                </div>
              </div>
            </div>

            <DropdownMenuSeparator />

            {/* Menu Items */}
            <DropdownMenuItem 
              onClick={() => setIsAvatarModalOpen(true)}
              className="cursor-pointer rounded-xl flex items-center gap-2.5 px-3 py-2 text-xs font-medium hover:bg-primary/10 hover:text-primary transition-colors"
            >
              <div className="p-1 rounded-lg bg-primary/10 text-primary">
                <Camera className="h-4 w-4" />
              </div>
              <span>
                {language === "ar" 
                  ? "تغيير صورة الملف الشخصي" 
                  : language === "fr" 
                  ? "Photo de profil" 
                  : "Profile Photo"}
              </span>
            </DropdownMenuItem>

            <DropdownMenuItem 
              onClick={() => navigate("/profile")} 
              className="cursor-pointer rounded-xl flex items-center gap-2.5 px-3 py-2 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="p-1 rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-400">
                <User className="h-4 w-4" />
              </div>
              <span>{t("nav.profile")}</span>
            </DropdownMenuItem>

            <DropdownMenuItem 
              onClick={() => navigate("/settings")} 
              className="cursor-pointer rounded-xl flex items-center gap-2.5 px-3 py-2 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <div className="p-1 rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-400">
                <Settings className="h-4 w-4" />
              </div>
              <span>{t("nav.settings")}</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem 
              onClick={handleLogout} 
              className="cursor-pointer rounded-xl flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 dark:hover:bg-rose-500/15 focus:text-rose-600 transition-colors"
            >
              <div className="p-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <LogOut className="h-4 w-4" />
              </div>
              <span>{t("nav.logout")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Profile Avatar Modal Dialog */}
        <ProfileAvatarDialog 
          isOpen={isAvatarModalOpen}
          onOpenChange={setIsAvatarModalOpen}
        />
      </div>
    </header>
  );
};

export default TopNav;

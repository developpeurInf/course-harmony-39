import { useState } from "react";
import { useNavigate, useLocation } from "@/lib/router";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCourses } from "@/contexts/CourseContext";
import { Button } from "@/components/ui/button";
import { Menu, LogOut, UserRound, Settings, Camera, ChevronDown } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Sidebar, { initialsOf } from "./Sidebar";
import NotificationBell from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import ProfileAvatarDialog from "@/components/ProfileAvatarDialog";
import { cn } from "@/lib/utils";
import { usePopupMenu } from "@/components/ui/use-popup-menu";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { useBrand } from "@/components/AppBrand";

const TopNav = () => {
  const { user, logout } = useAuth();
  const { t, language } = useLanguage();
  const { rooms } = useCourses();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const {
    containerRef: userMenuRef,
    triggerRef: userMenuTriggerRef,
    menuRef: userMenuListRef,
    menuId: userMenuId,
    triggerProps: userMenuTriggerProps,
  } = usePopupMenu(isUserMenuOpen, setIsUserMenuOpen);

  const brand = useBrand(language);
  const { feature } = useAppSettings();
  const isRtl = language === "ar";
  const isProfessor = user?.role === "professor";

  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);
  const roleLabel = isProfessor ? tr("Professeur", "أستاذ", "Teacher") : tr("Élève", "تلميذ", "Student");

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  // Titre de la page courante (barre du haut)
  const getPageTitle = (): { title: string; shortTitle?: string } => {
    const path = location.pathname;
    const routes: [boolean, string][] = [
      [path.startsWith("/dashboard"), tr("Tableau de bord", "لوحة القيادة", "Dashboard")],
      [path.includes("/students-activities"), tr("Suivi pédagogique et classement", "التتبع التربوي والترتيب", "Learning analytics & ranking")],
      [path.includes("/students"), tr("Élèves", "التلاميذ", "Students")],
      [path.includes("/courses"), tr("Cours", "الدروس", "Courses")],
      [path.includes("/exercises"), tr("Exercices", "التمارين", "Exercises")],
      [path.includes("/exams"), tr("Examens et quiz", "الامتحانات والاختبارات", "Exams & quizzes")],
      [path.startsWith("/reports"), tr("Rapports", "التقارير", "Reports")],
      [path.startsWith("/diagnostic"), tr("Évaluation diagnostique", "التقويم التشخيصي", "Diagnostic assessment")],
      [path.startsWith("/class-management"), tr("Gestion des classes", "إدارة الأقسام", "Class management")],
      [path.startsWith("/profile"), tr("Mon profil", "الملف الشخصي", "My profile")],
      [path.startsWith("/subscription"), tr("Abonnement", "الاشتراك", "Subscription")],
      [path.startsWith("/create-room"), tr("Nouvelle classe", "قسم جديد", "New class")],
      [path.startsWith("/settings"), tr("Paramètres", "الإعدادات", "Settings")],
    ];
    const match = routes.find(([ok]) => ok);
    if (match) return { title: match[1] };
    // nom court sur les très petits écrans (si l'administration l'a personnalisé)
    return { title: brand.appName, shortTitle: brand.isDefaultName ? undefined : brand.shortName };
  };

  // Classe courante (pages /rooms/:id/…) : affichée avant le titre
  const roomMatch = /^\/rooms\/([^/]+)/.exec(location.pathname);
  const currentRoom = roomMatch ? rooms.find((r) => r.id === roomMatch[1]) : undefined;

  const pageInfo = getPageTitle();

  const menuItem =
    "flex h-9 w-full cursor-pointer select-none items-center gap-2.5 rounded-md px-2 text-sm text-foreground text-start transition-colors hover:bg-muted focus:bg-muted focus:outline-none";

  return (
    <header
      dir={isRtl ? "rtl" : "ltr"}
      className="app-topnav sticky top-0 z-30 flex w-full flex-shrink-0 items-center justify-between gap-3 border-b bg-background/85 px-3 backdrop-blur-md md:px-6"
    >
      <div className="flex min-w-0 items-center gap-2">
        {/* Menu (téléphones et tablettes < lg) */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="-ms-1 h-9 w-9 flex-shrink-0 lg:hidden"
              aria-label={tr("Ouvrir le menu", "فتح القائمة", "Open menu")}
            >
              <Menu className="h-5 w-5" strokeWidth={1.75} />
            </Button>
          </SheetTrigger>
          <SheetContent
            side={isRtl ? "right" : "left"}
            aria-label={tr("Menu de navigation", "قائمة التنقل", "Navigation menu")}
            className="w-72 max-w-[85vw] overflow-hidden border-0 p-0"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) setIsOpen(false);
            }}
          >
            <Sidebar />
          </SheetContent>
        </Sheet>

        <nav aria-label={tr("Fil d'Ariane", "مسار التنقل", "Breadcrumb")} className="flex min-w-0 items-center gap-1.5 text-sm">
          {currentRoom && (
            <>
              <span className="hidden max-w-[180px] truncate text-muted-foreground sm:inline">{currentRoom.name}</span>
              <span className="hidden text-muted-foreground/60 sm:inline" aria-hidden="true">/</span>
            </>
          )}
          <h1 className="truncate font-medium text-foreground" title={pageInfo.title}>
            {pageInfo.shortTitle && pageInfo.shortTitle !== pageInfo.title ? (
              <>
                <span className="sm:hidden">{pageInfo.shortTitle}</span>
                <span className="hidden sm:inline">{pageInfo.title}</span>
              </>
            ) : (
              pageInfo.title
            )}
          </h1>
        </nav>
      </div>

      <div className="flex flex-shrink-0 items-center gap-1">
        <div className="hidden items-center gap-0.5 sm:flex">
          <LanguageSelector />
          <ThemeToggle />
        </div>
        {feature("notifications") && <NotificationBell />}

        <div className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />

        {/* Menu du compte */}
        <div ref={userMenuRef} className="relative inline-block">
          <button
            ref={userMenuTriggerRef}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsUserMenuOpen((prev) => !prev);
            }}
            className={cn(
              "flex h-9 cursor-pointer select-none items-center gap-2 rounded-md px-1.5 transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isUserMenuOpen && "bg-muted"
            )}
            aria-label={tr("Menu du compte", "قائمة الحساب", "Account menu")}
            {...userMenuTriggerProps}
          >
            <Avatar className="pointer-events-none h-7 w-7 rounded-md">
              <AvatarImage src={user?.avatar_url} alt="" className="object-cover" />
              <AvatarFallback className="rounded-md bg-muted text-2xs font-medium text-foreground">{initialsOf(user?.name)}</AvatarFallback>
            </Avatar>
            <span className="pointer-events-none hidden max-w-[140px] truncate text-[13px] font-medium lg:block">{user?.name || roleLabel}</span>
            <ChevronDown className={cn("pointer-events-none hidden h-3.5 w-3.5 text-muted-foreground transition-transform sm:block", isUserMenuOpen && "rotate-180")} />
          </button>

          {isUserMenuOpen && (
            <div
              ref={userMenuListRef}
              id={userMenuId}
              aria-label={tr("Menu du compte", "قائمة الحساب", "Account menu")}
              className="absolute end-0 top-full z-50 mt-1.5 w-60 max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95"
              role="menu"
            >
              <div className="px-2 py-2">
                <p className="truncate text-sm font-medium">{user?.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                <p className="mt-1 text-2xs text-muted-foreground">{roleLabel}</p>
              </div>
              <div className="-mx-1 my-1 h-px bg-border" />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsUserMenuOpen(false);
                  setIsAvatarModalOpen(true);
                }}
                className={menuItem}
                role="menuitem"
              >
                <Camera className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                <span>{tr("Photo de profil", "صورة الملف الشخصي", "Profile photo")}</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsUserMenuOpen(false);
                  navigate("/profile");
                }}
                className={menuItem}
                role="menuitem"
              >
                <UserRound className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                <span>{t("nav.profile")}</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsUserMenuOpen(false);
                  navigate("/settings");
                }}
                className={menuItem}
                role="menuitem"
              >
                <Settings className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                <span>{t("nav.settings")}</span>
              </button>
              <div className="-mx-1 my-1 h-px bg-border" />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsUserMenuOpen(false);
                  handleLogout();
                }}
                className={cn(menuItem, "text-destructive hover:bg-destructive/10 focus:bg-destructive/10")}
                role="menuitem"
              >
                <LogOut className={cn("h-4 w-4", isRtl && "rotate-180")} strokeWidth={1.75} />
                <span>{t("nav.logout")}</span>
              </button>
            </div>
          )}
        </div>

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

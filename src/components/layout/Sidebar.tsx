import { NavLink, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCourses } from "@/contexts/CourseContext";
import { 
  Home, 
  BookOpen, 
  FileText, 
  Users, 
  Calendar,
  Settings, 
  User, 
  Building, 
  ChevronDown, 
  ChevronRight, 
  FolderOpen, 
  BarChart3, 
  Activity, 
  FileSpreadsheet,
  GraduationCap,
  Sparkles,
  LogOut,
  Layers,
  ChevronLeft,
  Crown,
  Lock
} from "lucide-react";
import { useAccess } from "@/contexts/AccessContext";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { BrandLogo, useBrand } from "@/components/AppBrand";

const Sidebar = () => {
  const { user, logout } = useAuth();
  const { language } = useLanguage();
  const { rooms, enrollments } = useCourses();
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [openRooms, setOpenRooms] = useState<Record<string, boolean>>({});
  const isProfessor = user?.role === "professor";
  const isRtl = language === "ar";
  const { can, enforced, access } = useAccess();
  const brand = useBrand(language);
  const { feature } = useAppSettings();
  const lockIcon = <Lock size={12} className="flex-shrink-0 opacity-60" />;

  const t = (fr: string, ar: string, en: string = fr) =>
    language === "ar" ? ar : language === "fr" ? fr : en;

  // For students, get enrolled rooms through their course enrollments or direct room assignment
  const getEnrolledRooms = () => {
    if (isProfessor) {
      if (!can("class.view")) return []; // habilitation « Voir ses classes » retirée
      return rooms.filter(room => room.professor_id === user?.id);
    }
    
    if (!user) return [];
    
    const studentEnrollments = enrollments.filter(e => e.student_id === user.id);
    const enrolledRoomIds = [...new Set(studentEnrollments.map(e => e.room_id).filter(Boolean))];
    if (user.room_id) enrolledRoomIds.push(user.room_id);
    
    return rooms.filter(room => 
      room.is_visible && enrolledRoomIds.includes(room.id)
    );
  };

  const userRooms = getEnrolledRooms();

  const toggleRoom = (roomIdToToggle: string) => {
    setOpenRooms(prev => {
      const currentState = prev[roomIdToToggle] ?? (roomId === roomIdToToggle);
      return { ...prev, [roomIdToToggle]: !currentState };
    });
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  // Helper for student's current room name
  const studentRoomName = !isProfessor && user?.room_id 
    ? rooms.find(r => r.id === user.room_id)?.name 
    : userRooms[0]?.name;

  return (
    <div 
      dir={isRtl ? "rtl" : "ltr"}
      className="flex flex-col h-full w-full max-h-full overflow-hidden bg-gradient-to-b from-slate-50 via-slate-50/80 to-slate-100/90 dark:from-slate-950 dark:via-slate-900/90 dark:to-slate-950 border-r rtl:border-r-0 rtl:border-l border-slate-200/80 dark:border-slate-800/80 select-none text-slate-700 dark:text-slate-300"
    >
      {/* Brand Header */}
      <div className="p-4 md:p-5 flex-shrink-0 border-b border-slate-200/60 dark:border-slate-800/60">
        <NavLink 
          to="/dashboard" 
          className="flex items-center gap-3 group focus:outline-none"
        >
          {brand.logoUrl ? (
            <BrandLogo
              logoUrl={brand.logoUrl}
              alt={brand.appName}
              imgClassName="h-10 w-10 rounded-xl bg-white dark:bg-slate-900 ring-2 ring-primary/20 shadow-md shadow-primary/20 group-hover:scale-105 transition-transform duration-300"
              className="relative flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-tr from-primary via-blue-600 to-indigo-500 text-white shadow-md shadow-primary/20 ring-2 ring-primary/20"
              symbolClassName="text-xl font-black font-mono"
            />
          ) : (
            <div className="relative flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-tr from-primary via-blue-600 to-indigo-500 text-white shadow-md shadow-primary/20 ring-2 ring-primary/20 group-hover:scale-105 transition-transform duration-300">
              <span className="text-xl font-black font-mono">∞</span>
              <div className="absolute -inset-0.5 rounded-xl bg-primary/30 blur-xs opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-base font-extrabold tracking-tight bg-gradient-to-r from-primary to-indigo-600 dark:from-primary dark:to-blue-400 bg-clip-text text-transparent truncate" title={brand.appName}>
                {brand.appName}
              </span>
              {brand.isDefaultName && <span className="text-xs font-mono font-bold text-primary">∞</span>}
            </div>
            <span className="text-[11px] font-medium text-muted-foreground truncate">
              {brand.customTagline || (isProfessor 
                ? t("Espace Enseignant", "فضاء الأستاذ", "Teacher Space")
                : t("Espace Élève", "فضاء التلميذ", "Student Space"))}
            </span>
          </div>
        </NavLink>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar px-3 py-3 space-y-4">
        
        {/* Section: Overview */}
        <div className="space-y-1">
          <div className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>{t("Général", "عام", "General")}</span>
          </div>

          <NavLink 
            to="/dashboard" 
            className={({ isActive }) => cn(
              "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
              isActive 
                ? "bg-primary/10 text-primary font-semibold shadow-xs dark:bg-primary/20 border-l-4 rtl:border-l-0 rtl:border-r-4 border-primary" 
                : "text-slate-600 dark:text-slate-300 hover:text-foreground hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
            )}
          >
            <div className={cn(
              "p-1.5 rounded-lg transition-all duration-200 group-hover:scale-110",
              "bg-blue-500/10 text-blue-600 dark:text-blue-400 dark:bg-blue-500/20"
            )}>
              <Home size={18} />
            </div>
            <span className="truncate">{t("Tableau de bord", "لوحة التحكم", "Dashboard")}</span>
          </NavLink>
        </div>

        {/* Section: Classes / Courses */}
        <div className="space-y-1.5">
          <div className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>
              {isProfessor 
                ? t("Mes Classes", "أقسامي", "My Classes")
                : t("Mon Apprentissage", "فضاء التعلم", "My Learning")}
            </span>
            {isProfessor && userRooms.length > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold bg-primary/10 text-primary border-primary/20">
                {userRooms.length}
              </Badge>
            )}
          </div>

          {isProfessor ? (
            userRooms.length === 0 ? (
              <div className="px-3 py-3 text-xs text-muted-foreground bg-slate-100/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-300/60 dark:border-slate-800 text-center">
                {t("Aucune classe créée", "لم يتم إنشاء أي قسم بعد", "No classes created yet")}
              </div>
            ) : (
              userRooms.map(room => {
                const isOpen = openRooms[room.id] ?? (roomId === room.id);
                const isRoomActive = roomId === room.id;

                return (
                  <Collapsible 
                    key={room.id} 
                    open={isOpen}
                    onOpenChange={() => toggleRoom(room.id)}
                    className="space-y-1"
                  >
                    <CollapsibleTrigger 
                      className={cn(
                        "flex items-center justify-between w-full px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 group",
                        isRoomActive 
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/30" 
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={cn(
                          "p-1.5 rounded-lg transition-transform duration-200 group-hover:scale-110",
                          isRoomActive 
                            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-500/15"
                        )}>
                          <Building size={16} />
                        </div>
                        <span className="truncate font-semibold text-xs tracking-tight">{room.name}</span>
                      </div>
                      <div className="text-muted-foreground transition-transform duration-200 flex items-center">
                        {isOpen ? (
                          <ChevronDown size={15} className="transition-transform duration-200" />
                        ) : isRtl ? (
                          <ChevronLeft size={15} className="transition-transform duration-200" />
                        ) : (
                          <ChevronRight size={15} className="transition-transform duration-200" />
                        )}
                      </div>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent className="space-y-1 my-1 pl-3 rtl:pl-0 rtl:pr-3 border-l-2 rtl:border-l-0 rtl:border-r-2 border-emerald-500/30 dark:border-emerald-500/20 ml-3.5 rtl:ml-0 rtl:mr-3.5 animate-in slide-in-from-top-1 duration-150">
                      {/* Élèves */}
                      <NavLink 
                        to={`/rooms/${room.id}/students`} 
                        className={({ isActive }) => cn(
                          "flex items-center gap-2.5 px-2.5 py-2.5 min-h-[40px] rounded-lg text-xs font-medium transition-all duration-150 group",
                          isActive 
                            ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 font-semibold shadow-xs" 
                            : "text-muted-foreground hover:text-foreground hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                        )}
                      >
                        <div className="p-1 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform">
                          <Users size={14} />
                        </div>
                        <span className="truncate">{t("Élèves", "التلاميذ", "Students")}</span>
                      </NavLink>
                      
                      {/* Activités */}
                      {feature("studentActivities") && (
                      <NavLink 
                        to={`/rooms/${room.id}/students-activities`} 
                        className={({ isActive }) => cn(
                          "flex items-center gap-2.5 px-2.5 py-2.5 min-h-[40px] rounded-lg text-xs font-medium transition-all duration-150 group",
                          isActive 
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold shadow-xs" 
                            : "text-muted-foreground hover:text-foreground hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                        )}
                      >
                        <div className="p-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                          <Activity size={14} />
                        </div>
                        <span className="truncate">{t("Suivi & Classement", "التتبع والترتيب", "Tracking & Ranking")}</span>
                        {!can("student.activity_view") && lockIcon}
                      </NavLink>
                      )}
                      
                      {/* Cours */}
                      {feature("courses") && (
                      <NavLink 
                        to={`/rooms/${room.id}/courses`} 
                        className={({ isActive }) => cn(
                          "flex items-center gap-2.5 px-2.5 py-2.5 min-h-[40px] rounded-lg text-xs font-medium transition-all duration-150 group",
                          isActive 
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold shadow-xs" 
                            : "text-muted-foreground hover:text-foreground hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                        )}
                      >
                        <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                          <BookOpen size={14} />
                        </div>
                        <span className="truncate">{t("Cours & Leçons", "الدروس والمحتوى", "Courses")}</span>
                      </NavLink>
                      )}
                      
                      {/* Exercices */}
                      {feature("exercises") && (
                      <NavLink 
                        to={`/rooms/${room.id}/exercises`} 
                        className={({ isActive }) => cn(
                          "flex items-center gap-2.5 px-2.5 py-2.5 min-h-[40px] rounded-lg text-xs font-medium transition-all duration-150 group",
                          isActive 
                            ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 font-semibold shadow-xs" 
                            : "text-muted-foreground hover:text-foreground hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                        )}
                      >
                        <div className="p-1 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                          <FileText size={14} />
                        </div>
                        <span className="truncate">{t("Exercices & Séries", "التمارين والسلاسل", "Exercises")}</span>
                      </NavLink>
                      )}
                      
                      {/* Examens */}
                      {feature("exams") && (
                      <NavLink 
                        to={`/rooms/${room.id}/exams`} 
                        className={({ isActive }) => cn(
                          "flex items-center gap-2.5 px-2.5 py-2.5 min-h-[40px] rounded-lg text-xs font-medium transition-all duration-150 group",
                          isActive 
                            ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 font-semibold shadow-xs" 
                            : "text-muted-foreground hover:text-foreground hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                        )}
                      >
                        <div className="p-1 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
                          <Calendar size={14} />
                        </div>
                        <span className="truncate">{t("Examens & Quiz", "الامتحانات والاختبارات", "Exams & Quizzes")}</span>
                      </NavLink>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })
            )
          ) : (
            <>
              {/* Student View */}
              {feature("courses") && (
              <NavLink 
                to="/courses" 
                className={({ isActive }) => cn(
                  "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold shadow-xs dark:bg-emerald-500/20 border-l-4 rtl:border-l-0 rtl:border-r-4 border-emerald-500" 
                    : "text-slate-600 dark:text-slate-300 hover:text-foreground hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
                )}
              >
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-500/20 group-hover:scale-110 transition-transform">
                  <BookOpen size={18} />
                </div>
                <span className="truncate">{t("Mes Cours", "دروسي", "My Courses")}</span>
              </NavLink>
              )}
              
              {feature("exercises") && (
              <NavLink 
                to="/exercises" 
                className={({ isActive }) => cn(
                  "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 font-semibold shadow-xs dark:bg-purple-500/20 border-l-4 rtl:border-l-0 rtl:border-r-4 border-purple-500" 
                    : "text-slate-600 dark:text-slate-300 hover:text-foreground hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
                )}
              >
                <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 dark:bg-purple-500/20 group-hover:scale-110 transition-transform">
                  <FileText size={18} />
                </div>
                <span className="truncate">{t("Mes Exercices", "تماريني", "My Exercises")}</span>
              </NavLink>
              )}
              
              {feature("exams") && (
              <NavLink 
                to="/exams" 
                className={({ isActive }) => cn(
                  "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 font-semibold shadow-xs dark:bg-rose-500/20 border-l-4 rtl:border-l-0 rtl:border-r-4 border-rose-500" 
                    : "text-slate-600 dark:text-slate-300 hover:text-foreground hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
                )}
              >
                <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 dark:bg-rose-500/20 group-hover:scale-110 transition-transform">
                  <Calendar size={18} />
                </div>
                <span className="truncate">{t("Examens & Quiz", "الامتحانات والاختبارات", "Exams & Quizzes")}</span>
              </NavLink>
              )}
            </>
          )}
        </div>

        {/* Section: Management Tools (Professor Only) */}
        {isProfessor && (
          <div className="space-y-1 pt-1">
            <div className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>{t("Gestion & Outils", "الإدارة والأدوات", "Management & Tools")}</span>
            </div>

            {feature("reports") && (
            <NavLink 
              to="/reports" 
              className={({ isActive }) => cn(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-semibold shadow-xs dark:bg-indigo-500/20 border-l-4 rtl:border-l-0 rtl:border-r-4 border-indigo-500" 
                  : "text-slate-600 dark:text-slate-300 hover:text-foreground hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
              )}
            >
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 dark:bg-indigo-500/20 group-hover:scale-110 transition-transform">
                <BarChart3 size={18} />
              </div>
              <span className="truncate">{t("Rapports & Statistiques", "التقارير والإحصائيات", "Reports & Analytics")}</span>
              {!can("reports.view") && lockIcon}
            </NavLink>
            )}
            
            {feature("diagnostic") && (
            <NavLink 
              to="/diagnostic" 
              className={({ isActive }) => cn(
                "group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-violet-500/10 text-violet-700 dark:text-violet-300 font-semibold shadow-xs dark:bg-violet-500/20 border-l-4 rtl:border-l-0 rtl:border-r-4 border-violet-500" 
                  : "text-slate-600 dark:text-slate-300 hover:text-foreground hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 dark:bg-violet-500/20 group-hover:scale-110 transition-transform">
                  <FileSpreadsheet size={18} />
                </div>
                <span className="truncate">{t("Évaluation Diagnostique", "التقويم التشخيصي", "Diagnostic Assessment")}</span>
                {!can("diagnostic.use") && lockIcon}
              </div>
              <Badge className="text-[10px] h-4 px-1.5 bg-violet-500/20 text-violet-700 dark:text-violet-300 border-0 font-bold">
                {t("Éval", "تقويم", "Eval")}
              </Badge>
            </NavLink>
            )}
            
            <NavLink 
              to="/class-management" 
              className={({ isActive }) => cn(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-teal-500/10 text-teal-700 dark:text-teal-300 font-semibold shadow-xs dark:bg-teal-500/20 border-l-4 rtl:border-l-0 rtl:border-r-4 border-teal-500" 
                  : "text-slate-600 dark:text-slate-300 hover:text-foreground hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
              )}
            >
              <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 dark:bg-teal-500/20 group-hover:scale-110 transition-transform">
                <FolderOpen size={18} />
              </div>
              <span className="truncate">{t("Gestion des Classes", "إدارة الأقسام", "Manage Classes")}</span>
            </NavLink>
          </div>
        )}

        {/* Section: Account & Settings */}
        <div className="space-y-1 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
          <div className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>{t("Compte & Paramètres", "الحساب والإعدادات", "Account & Settings")}</span>
          </div>

          <NavLink 
            to="/profile" 
            className={({ isActive }) => cn(
              "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
              isActive 
                ? "bg-slate-500/10 text-slate-900 dark:text-slate-100 font-semibold shadow-xs dark:bg-slate-500/20 border-l-4 rtl:border-l-0 rtl:border-r-4 border-slate-500" 
                : "text-slate-600 dark:text-slate-300 hover:text-foreground hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
            )}
          >
            <div className="p-1.5 rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-400 dark:bg-slate-500/20 group-hover:scale-110 transition-transform">
              <User size={18} />
            </div>
            <span className="truncate">{t("Mon Profil", "الملف الشخصي", "My Profile")}</span>
          </NavLink>
          
          {isProfessor && enforced && (
            <NavLink 
              to="/subscription" 
              className={({ isActive }) => cn(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-amber-500/10 text-amber-800 dark:text-amber-200 font-semibold shadow-xs dark:bg-amber-500/20 border-l-4 rtl:border-l-0 rtl:border-r-4 border-amber-500" 
                  : "text-slate-600 dark:text-slate-300 hover:text-foreground hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
              )}
            >
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 dark:bg-amber-500/20 group-hover:scale-110 transition-transform">
                <Crown size={18} />
              </div>
              <span className="truncate">{t("Mon abonnement", "اشتراكي", "My subscription")}</span>
              {access?.subscription?.plan_name && (
                <>
                  <span className="flex-1" />
                  <span className="max-w-[90px] truncate rounded-full bg-amber-500/15 px-1.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                    {access.subscription.plan_name}
                  </span>
                </>
              )}
            </NavLink>
          )}

          <NavLink 
            to="/settings" 
            className={({ isActive }) => cn(
              "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
              isActive 
                ? "bg-slate-500/10 text-slate-900 dark:text-slate-100 font-semibold shadow-xs dark:bg-slate-500/20 border-l-4 rtl:border-l-0 rtl:border-r-4 border-slate-500" 
                : "text-slate-600 dark:text-slate-300 hover:text-foreground hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
            )}
          >
            <div className="p-1.5 rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-400 dark:bg-slate-500/20 group-hover:scale-110 transition-transform">
              <Settings size={18} />
            </div>
            <span className="truncate">{t("Paramètres", "الإعدادات", "Settings")}</span>
          </NavLink>
        </div>
      </nav>

      {/* Modern User Profile Footer Card */}
      <div className="p-3 border-t border-slate-200/80 dark:border-slate-800/80 flex-shrink-0 bg-slate-100/60 dark:bg-slate-900/60 backdrop-blur-xs space-y-2">
        {/* Mobile quick settings: Language + Theme Toggle */}
        <div className="flex items-center justify-between px-2 py-1 bg-background/60 dark:bg-slate-950/40 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
          <span className="text-[11px] font-medium text-muted-foreground">{t("Affichage & Langue", "العرض واللغة", "Display & Language")}</span>
          <div className="flex items-center gap-1">
            <LanguageSelector placement="top" />
            <ThemeToggle placement="top" />
          </div>
        </div>

        <div className="flex items-center justify-between p-2 rounded-xl bg-background/80 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800/70 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative flex-shrink-0">
              <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                <AvatarImage src={user?.avatar_url} alt={user?.name || "User"} className="object-cover" />
                <AvatarFallback className="bg-gradient-to-tr from-primary to-indigo-600 text-white font-bold text-xs">
                  {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || user?.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              {/* Online pulse indicator */}
              <span className="absolute -bottom-0.5 -right-0.5 rtl:right-auto rtl:-left-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse" />
            </div>
            
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-foreground truncate max-w-[110px]">
                {user?.name || t("Utilisateur", "مستخدم", "User")}
              </span>
              <div className="flex items-center gap-1">
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-[9px] px-1.5 py-0 h-3.5 border-0 font-semibold",
                    isProfessor 
                      ? "bg-blue-500/15 text-blue-600 dark:text-blue-400" 
                      : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  )}
                >
                  {isProfessor ? t("Professeur", "أستاذ", "Professor") : t("Élève", "تلميذ", "Student")}
                </Badge>
                {studentRoomName && !isProfessor && (
                  <span className="text-[10px] text-muted-foreground truncate max-w-[70px]">
                    {studentRoomName}
                  </span>
                )}
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors flex-shrink-0"
            title={t("Déconnexion", "تسجيل الخروج", "Log out")}
            aria-label={t("Déconnexion", "تسجيل الخروج", "Log out")}
          >
            <LogOut size={16} className={isRtl ? "rotate-180" : undefined} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;

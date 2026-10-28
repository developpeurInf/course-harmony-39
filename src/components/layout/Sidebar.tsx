import { useState } from "react";
import { NavLink, useParams, useNavigate } from "@/lib/router";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCourses } from "@/contexts/CourseContext";
import { useAccess } from "@/contexts/AccessContext";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import {
  LayoutGrid,
  BookOpen,
  FileText,
  Users,
  ClipboardCheck,
  Settings,
  UserRound,
  ChevronRight,
  FolderKanban,
  BarChart3,
  Activity,
  FileSpreadsheet,
  FilePen,
  LogOut,
  CreditCard,
  Lock,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandMark, useBrand } from "@/components/AppBrand";
import { cn } from "@/lib/utils";

export const initialsOf = (name?: string | null) =>
  (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";

const itemClass = (isActive: boolean, nested = false) =>
  cn(
    "group flex w-full items-center gap-2.5 rounded-md text-[13px] font-medium transition-colors",
    nested ? "h-8 px-2" : "h-9 px-2.5",
    isActive
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : "text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
  );

function NavItem({
  to,
  icon: Icon,
  label,
  locked,
  trailing,
  nested,
  end,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  locked?: boolean;
  trailing?: React.ReactNode;
  nested?: boolean;
  end?: boolean;
}) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => itemClass(isActive, nested)}>
      {({ isActive }) => (
        <>
          <Icon
            className={cn(
              "h-4 w-4 shrink-0",
              isActive ? "text-sidebar-primary" : "text-muted-foreground group-hover:text-sidebar-accent-foreground"
            )}
            strokeWidth={1.75}
          />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {locked && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />}
          {trailing}
        </>
      )}
    </NavLink>
  );
}

function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex h-7 items-center justify-between px-2.5">
      <span className="text-2xs font-medium uppercase tracking-wider text-muted-foreground rtl:normal-case rtl:tracking-normal rtl:text-xs">
        {children}
      </span>
      {action}
    </div>
  );
}

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

  const t = (fr: string, ar: string, en: string = fr) =>
    language === "ar" ? ar : language === "fr" ? fr : en;

  // Élève : classes de ses inscriptions ou classe d'affectation directe
  const getEnrolledRooms = () => {
    if (isProfessor) {
      if (!can("class.view")) return []; // habilitation « Voir ses classes » retirée
      return rooms.filter((room) => room.professor_id === user?.id);
    }
    if (!user) return [];
    const studentEnrollments = enrollments.filter((e) => e.student_id === user.id);
    const enrolledRoomIds = [...new Set(studentEnrollments.map((e) => e.room_id).filter(Boolean))];
    if (user.room_id) enrolledRoomIds.push(user.room_id);
    return rooms.filter((room) => room.is_visible && enrolledRoomIds.includes(room.id));
  };

  const userRooms = getEnrolledRooms();

  const toggleRoom = (id: string) => {
    setOpenRooms((prev) => {
      const current = prev[id] ?? roomId === id;
      return { ...prev, [id]: !current };
    });
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  const studentRoomName =
    !isProfessor && user?.room_id ? rooms.find((r) => r.id === user.room_id)?.name : userRooms[0]?.name;

  const roleLabel = isProfessor ? t("Professeur", "أستاذ", "Teacher") : t("Élève", "تلميذ", "Student");

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="flex h-full max-h-full w-full select-none flex-col overflow-hidden bg-sidebar text-sidebar-foreground"
    >
      {/* Identité */}
      <div className="flex h-14 flex-shrink-0 items-center px-4">
        <NavLink to="/dashboard" className="flex min-w-0 items-center gap-2.5 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <BrandMark logoUrl={brand.logoUrl} alt={brand.appName} size="sm" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-foreground" title={brand.appName}>
              {brand.appName}
            </p>
            <p className="truncate text-2xs text-muted-foreground">
              {brand.customTagline ||
                (isProfessor ? t("Espace enseignant", "فضاء الأستاذ", "Teacher space") : t("Espace élève", "فضاء التلميذ", "Student space"))}
            </p>
          </div>
        </NavLink>
      </div>

      <nav
        aria-label={t("Navigation principale", "التنقل الرئيسي", "Main navigation")}
        className="custom-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-2.5 pb-4 pt-2"
      >
        <div className="space-y-0.5">
          <NavItem to="/dashboard" icon={LayoutGrid} label={t("Tableau de bord", "لوحة القيادة", "Dashboard")} />
        </div>

        <div className="space-y-0.5">
          <SectionLabel
            action={
              isProfessor && can("class.create") ? (
                <NavLink
                  to="/create-room"
                  className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                  title={t("Créer une classe", "إنشاء قسم", "Create a class")}
                  aria-label={t("Créer une classe", "إنشاء قسم", "Create a class")}
                >
                  <Plus className="h-3.5 w-3.5" />
                </NavLink>
              ) : undefined
            }
          >
            {isProfessor ? t("Mes classes", "أقسامي", "My classes") : t("Mon apprentissage", "فضاء التعلم", "My learning")}
          </SectionLabel>

          {isProfessor ? (
            userRooms.length === 0 ? (
              <p className="px-2.5 py-1.5 text-xs text-muted-foreground">
                {t("Aucune classe pour l'instant", "لا يوجد أي قسم بعد", "No classes yet")}
              </p>
            ) : (
              userRooms.map((room) => {
                const isOpen = openRooms[room.id] ?? roomId === room.id;
                return (
                  <Collapsible key={room.id} open={isOpen} onOpenChange={() => toggleRoom(room.id)}>
                    <CollapsibleTrigger
                      className={cn(
                        "group flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
                        roomId === room.id ? "text-foreground" : "text-sidebar-foreground",
                        "hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] text-[9px] font-semibold uppercase",
                          roomId === room.id ? "bg-sidebar-primary text-sidebar-primary-foreground" : "bg-muted text-muted-foreground"
                        )}
                        aria-hidden="true"
                      >
                        {room.name.trim().charAt(0)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-start">{room.name}</span>
                      <ChevronRight
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
                          isRtl && "rotate-180",
                          isOpen && (isRtl ? "-rotate-90" : "rotate-90")
                        )}
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="ms-[17px] space-y-0.5 border-s ps-2 pt-0.5">
                      <NavItem nested to={`/rooms/${room.id}/students`} icon={Users} label={t("Élèves", "التلاميذ", "Students")} />
                      {feature("studentActivities") && (
                        <NavItem
                          nested
                          to={`/rooms/${room.id}/students-activities`}
                          icon={Activity}
                          label={t("Suivi et classement", "التتبع والترتيب", "Tracking & ranking")}
                          locked={!can("student.activity_view")}
                        />
                      )}
                      {feature("courses") && (
                        <NavItem nested to={`/rooms/${room.id}/courses`} icon={BookOpen} label={t("Cours", "الدروس", "Courses")} />
                      )}
                      {feature("exercises") && (
                        <NavItem nested to={`/rooms/${room.id}/exercises`} icon={FileText} label={t("Exercices", "التمارين", "Exercises")} />
                      )}
                      {feature("exams") && (
                        <NavItem nested to={`/rooms/${room.id}/exams`} icon={ClipboardCheck} label={t("Examens et quiz", "الامتحانات والاختبارات", "Exams & quizzes")} />
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })
            )
          ) : (
            <>
              {feature("courses") && <NavItem to="/courses" icon={BookOpen} label={t("Mes cours", "دروسي", "My courses")} />}
              {feature("exercises") && <NavItem to="/exercises" icon={FileText} label={t("Mes exercices", "تماريني", "My exercises")} />}
              {feature("exams") && <NavItem to="/exams" icon={ClipboardCheck} label={t("Examens et quiz", "الامتحانات والاختبارات", "Exams & quizzes")} />}
            </>
          )}
        </div>

        {isProfessor && (
          <div className="space-y-0.5">
            <SectionLabel>{t("Outils", "الأدوات", "Tools")}</SectionLabel>
            {feature("reports") && (
              <NavItem to="/reports" icon={BarChart3} label={t("Rapports", "التقارير", "Reports")} locked={!can("reports.view")} />
            )}
            {feature("diagnostic") && (
              <NavItem
                to="/diagnostic"
                icon={FileSpreadsheet}
                label={t("Évaluation diagnostique", "التقويم التشخيصي", "Diagnostic assessment")}
                locked={!can("diagnostic.use")}
              />
            )}
            {feature("pdfEditor") && (
              <NavItem to="/pdf-editor" icon={FilePen} label={t("Éditeur PDF", "محرر PDF", "PDF editor")} />
            )}
            <NavItem to="/class-management" icon={FolderKanban} label={t("Gestion des classes", "إدارة الأقسام", "Manage classes")} />
          </div>
        )}

        <div className="space-y-0.5">
          <SectionLabel>{t("Compte", "الحساب", "Account")}</SectionLabel>
          <NavItem to="/profile" icon={UserRound} label={t("Mon profil", "الملف الشخصي", "My profile")} />
          {isProfessor && enforced && (
            <NavItem
              to="/subscription"
              icon={CreditCard}
              label={t("Abonnement", "الاشتراك", "Subscription")}
              trailing={
                access?.subscription?.plan_name ? (
                  <span className="max-w-[84px] truncate rounded border px-1.5 text-2xs text-muted-foreground">
                    {access.subscription.plan_name}
                  </span>
                ) : undefined
              }
            />
          )}
          <NavItem to="/settings" icon={Settings} label={t("Paramètres", "الإعدادات", "Settings")} />
        </div>
      </nav>

      {/* Compte connecté */}
      <div className="flex-shrink-0 space-y-1 border-t p-2.5">
        <div className="flex items-center gap-1 px-1">
          <LanguageSelector placement="top" align="start" />
          <ThemeToggle placement="top" align="start" />
        </div>
        <div className="flex items-center gap-2.5 rounded-md p-1.5">
          <Avatar className="h-8 w-8 rounded-md">
            <AvatarImage src={user?.avatar_url} alt="" className="object-cover" />
            <AvatarFallback className="rounded-md bg-muted text-xs font-medium text-foreground">{initialsOf(user?.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[13px] font-medium text-foreground">{user?.name || t("Utilisateur", "مستخدم", "User")}</p>
            <p className="truncate text-2xs text-muted-foreground">
              {roleLabel}
              {studentRoomName && !isProfessor ? ` · ${studentRoomName}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            title={t("Déconnexion", "تسجيل الخروج", "Log out")}
            aria-label={t("Déconnexion", "تسجيل الخروج", "Log out")}
          >
            <LogOut className={cn("h-4 w-4", isRtl && "rotate-180")} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;

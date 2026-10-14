import { NavLink, useLocation } from "react-router-dom";
import { Home, BookOpen, FileText, Calendar, User, FolderOpen, BarChart3, type LucideIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface BottomNavItem {
  to: string;
  icon: LucideIcon;
  label: [fr: string, ar: string, en: string];
  /** Autres chemins qui activent cet onglet (ex. pages d'une classe) */
  match: RegExp;
}

const STUDENT_ITEMS: BottomNavItem[] = [
  { to: "/dashboard", icon: Home, label: ["Accueil", "الرئيسية", "Home"], match: /^\/dashboard/ },
  { to: "/courses", icon: BookOpen, label: ["Cours", "الدروس", "Courses"], match: /^\/(courses|rooms\/[^/]+\/courses)/ },
  { to: "/exercises", icon: FileText, label: ["Exercices", "التمارين", "Exercises"], match: /^\/(exercises|rooms\/[^/]+\/exercises)/ },
  { to: "/exams", icon: Calendar, label: ["Examens", "الامتحانات", "Exams"], match: /^\/(exams|rooms\/[^/]+\/exams)/ },
  { to: "/profile", icon: User, label: ["Profil", "حسابي", "Profile"], match: /^\/(profile|settings)/ },
];

const PROFESSOR_ITEMS: BottomNavItem[] = [
  { to: "/dashboard", icon: Home, label: ["Accueil", "الرئيسية", "Home"], match: /^\/dashboard/ },
  { to: "/class-management", icon: FolderOpen, label: ["Classes", "الأقسام", "Classes"], match: /^\/(class-management|create-room|students|rooms\/[^/]+\/students)/ },
  { to: "/courses", icon: BookOpen, label: ["Cours", "الدروس", "Courses"], match: /^\/(courses|rooms\/[^/]+\/courses)/ },
  { to: "/exams", icon: Calendar, label: ["Examens", "الامتحانات", "Exams"], match: /^\/(exams|exercises|rooms\/[^/]+\/(exams|exercises))/ },
  { to: "/reports", icon: BarChart3, label: ["Rapports", "التقارير", "Reports"], match: /^\/(reports|diagnostic)/ },
];

export interface BottomNavProps {
  className?: string;
}

/**
 * Barre de navigation du bas pour téléphones et tablettes (< lg), élèves et professeurs.
 * Hauteur 60 px + zone sûre iPhone (env(safe-area-inset-bottom)). Masquée à partir de lg
 * (la barre latérale prend le relais). À afficher uniquement pour un utilisateur connecté
 * non administrateur (MainLayout s'en charge) ; prévoir la classe `pb-bottomnav` sur le contenu.
 */
const BottomNav = ({ className }: BottomNavProps) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const location = useLocation();

  if (!user) return null;

  const items = user.role === "professor" ? PROFESSOR_ITEMS : STUDENT_ITEMS;
  const pick = (l: [string, string, string]) => (language === "ar" ? l[1] : language === "en" ? l[2] : l[0]);
  const navLabel = language === "ar" ? "التنقل الرئيسي" : language === "en" ? "Main navigation" : "Navigation principale";

  return (
    <nav
      aria-label={navLabel}
      dir={language === "ar" ? "rtl" : "ltr"}
      className={cn(
        "app-bottomnav lg:hidden print:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur-md shadow-[0_-4px_16px_-8px_rgb(15_23_42/0.18)]",
        className
      )}
    >
      <ul className="mx-auto flex h-[60px] max-w-2xl items-stretch justify-around">
        {items.map((item) => {
          const active = item.match.test(location.pathname);
          const Icon = item.icon;
          return (
            <li key={item.to} className="flex flex-1 min-w-0">
              <NavLink
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium leading-tight transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  active ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active && <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-primary" aria-hidden="true" />}
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active && "bg-primary/10"
                  )}
                  aria-hidden="true"
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="max-w-full truncate">{pick(item.label)}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default BottomNav;

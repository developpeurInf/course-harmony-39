import { NavLink, useLocation } from "@/lib/router";
import { Home, BookOpen, FileText, Calendar, User, FolderOpen, BarChart3, FileSpreadsheet, MessageCircle, type LucideIcon } from "lucide-react";
import { useChatOptional } from "@/contexts/ChatContext";
import { ChatUnreadBadge } from "@/components/chat/ChatNavButton";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { useAccess } from "@/contexts/AccessContext";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import type { FeatureKey } from "@/lib/appSettings";

interface BottomNavItem {
  to: string;
  icon: LucideIcon;
  label: [fr: string, ar: string, en: string];
  /** Autres chemins qui activent cet onglet (ex. pages d'une classe) */
  match: RegExp;
  /** Module à activer (Personnalisation → Modules) pour afficher l'onglet */
  feature?: FeatureKey;
}

const STUDENT_ITEMS: BottomNavItem[] = [
  { to: "/dashboard", icon: Home, label: ["Accueil", "الرئيسية", "Home"], match: /^\/dashboard/ },
  { to: "/courses", icon: BookOpen, label: ["Cours", "الدروس", "Courses"], match: /^\/(courses|rooms\/[^/]+\/courses)/, feature: "courses" },
  { to: "/exercises", icon: FileText, label: ["Exercices", "التمارين", "Exercises"], match: /^\/(exercises|rooms\/[^/]+\/exercises)/, feature: "exercises" },
  { to: "/exams", icon: Calendar, label: ["Examens", "الامتحانات", "Exams"], match: /^\/(exams|rooms\/[^/]+\/exams)/, feature: "exams" },
  { to: "/profile", icon: User, label: ["Profil", "حسابي", "Profile"], match: /^\/(profile|settings)/ },
];

const PROFESSOR_ITEMS: BottomNavItem[] = [
  { to: "/dashboard", icon: Home, label: ["Accueil", "الرئيسية", "Home"], match: /^\/dashboard/ },
  { to: "/class-management", icon: FolderOpen, label: ["Classes", "الأقسام", "Classes"], match: /^\/(class-management|create-room|students|rooms\/[^/]+\/students)/ },
  { to: "/courses", icon: BookOpen, label: ["Cours", "الدروس", "Courses"], match: /^\/(courses|rooms\/[^/]+\/courses)/, feature: "courses" },
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
  const { feature: enabled } = useAppSettings();
  const { hasModule } = useAccess();
  // module affiché : allumé dans Personnalisation ET inclus dans l'offre
  const feature = (m: Parameters<typeof enabled>[0]) => enabled(m) && (m === "bottomNav" || hasModule(m));
  const chat = useChatOptional();

  if (!user || !feature("bottomNav")) return null;

  // Onglets des modules désactivés par l'administration retirés (ou redirigés vers le module voisin)
  const items = (user.role === "professor" ? PROFESSOR_ITEMS : STUDENT_ITEMS)
    .map((item): BottomNavItem | null => {
      if (item.feature && !feature(item.feature)) return null;
      if (user.role === "professor" && item.to === "/exams" && !feature("exams")) {
        return feature("exercises")
          ? { ...item, to: "/exercises", icon: FileText, label: ["Exercices", "التمارين", "Exercises"] }
          : null;
      }
      if (user.role === "professor" && item.to === "/reports" && !feature("reports")) {
        return feature("diagnostic")
          ? { ...item, to: "/diagnostic", icon: FileSpreadsheet, label: ["Diagnostic", "التشخيص", "Diagnostic"] }
          : null;
      }
      // Élève : l'onglet Profil devient Messages (le profil reste dans le menu du haut)
      if (user.role !== "professor" && item.to === "/profile" && chat?.enabled) {
        return { to: "/messages", icon: MessageCircle, label: ["Messages", "الرسائل", "Messages"], match: /^\/messages/ };
      }
      return item;
    })
    .filter((item): item is BottomNavItem => !!item);
  const pick = (l: [string, string, string]) => (language === "ar" ? l[1] : language === "en" ? l[2] : l[0]);
  const navLabel = language === "ar" ? "التنقل الرئيسي" : language === "en" ? "Main navigation" : "Navigation principale";

  return (
    <nav
      aria-label={navLabel}
      dir={language === "ar" ? "rtl" : "ltr"}
      className={cn(
        "app-bottomnav fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-md print:hidden lg:hidden",
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
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="flex h-7 items-center justify-center" aria-hidden="true">
                  <Icon className={cn("h-5 w-5", active && "text-primary")} strokeWidth={active ? 2 : 1.75} />
                </span>
                {item.to === "/messages" && <ChatUnreadBadge className="absolute top-1.5 start-1/2 ms-1.5" />}
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

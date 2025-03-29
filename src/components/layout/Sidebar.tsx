
import { NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  Home, 
  BookOpen, 
  FileText, 
  Users, 
  Calendar,
  Settings,
  User,
  Building
} from "lucide-react";

const Sidebar = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isProfessor = user?.role === "professor";

  return (
    <aside className="hidden md:flex md:w-64 flex-col bg-sidebar border-r shadow-sm">
      <div className="p-6">
        <h2 className="text-xl font-bold text-primary">{t("app.name")}</h2>
      </div>
      
      <nav className="flex-1 px-4 space-y-2 py-2">
        <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Home size={20} />
          <span>{t("nav.dashboard")}</span>
        </NavLink>
        
        <NavLink to="/rooms" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Building size={20} />
          <span>{t("nav.rooms")}</span>
        </NavLink>
        
        <NavLink to="/courses" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <BookOpen size={20} />
          <span>{t("nav.courses")}</span>
        </NavLink>
        
        <NavLink to="/exercises" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <FileText size={20} />
          <span>{t("nav.exercises")}</span>
        </NavLink>
        
        <NavLink to="/exams" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Calendar size={20} />
          <span>{t("nav.exams")}</span>
        </NavLink>
        
        {isProfessor && (
          <NavLink to="/students" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Users size={20} />
            <span>{t("nav.students")}</span>
          </NavLink>
        )}
        
        <NavLink to="/profile" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <User size={20} />
          <span>{t("nav.profile")}</span>
        </NavLink>
        
        <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Settings size={20} />
          <span>{t("nav.settings")}</span>
        </NavLink>
      </nav>
      
      <div className="p-4 border-t">
        <div className="px-3 py-2 text-sm text-muted-foreground">
          {user?.role === "professor" ? "Professor" : "Student"} {t("nav.profile")}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;

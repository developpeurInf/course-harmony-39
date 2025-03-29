
import { NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Home, 
  BookOpen, 
  FileText, 
  Users, 
  Calendar,
  Settings,
  User
} from "lucide-react";

const Sidebar = () => {
  const { user } = useAuth();
  const isProfessor = user?.role === "professor";

  return (
    <aside className="hidden md:flex md:w-64 flex-col bg-sidebar border-r shadow-sm">
      <div className="p-6">
        <h2 className="text-xl font-bold text-primary">Course Harmony</h2>
      </div>
      
      <nav className="flex-1 px-4 space-y-2 py-2">
        <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Home size={20} />
          <span>Dashboard</span>
        </NavLink>
        
        <NavLink to="/courses" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <BookOpen size={20} />
          <span>Courses</span>
        </NavLink>
        
        <NavLink to="/exercises" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <FileText size={20} />
          <span>Exercises</span>
        </NavLink>
        
        <NavLink to="/exams" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Calendar size={20} />
          <span>Exams</span>
        </NavLink>
        
        {isProfessor && (
          <NavLink to="/students" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Users size={20} />
            <span>Students</span>
          </NavLink>
        )}
        
        <NavLink to="/profile" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <User size={20} />
          <span>Profile</span>
        </NavLink>
        
        <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Settings size={20} />
          <span>Settings</span>
        </NavLink>
      </nav>
      
      <div className="p-4 border-t">
        <div className="px-3 py-2 text-sm text-muted-foreground">
          {user?.role === "professor" ? "Professor" : "Student"} Account
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;

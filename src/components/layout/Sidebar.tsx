
import { NavLink, useParams } from "react-router-dom";
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
  BarChart3
} from "lucide-react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const Sidebar = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { rooms } = useCourses();
  const { roomId } = useParams();
  const [openRooms, setOpenRooms] = useState<Record<string, boolean>>({});
  const isProfessor = user?.role === "professor";

  const { enrollments } = useCourses();
  
  // For students, get enrolled rooms through their course enrollments
  const getEnrolledRooms = () => {
    if (isProfessor) {
      return rooms.filter(room => room.professor_id === user.id);
    }
    
    if (!user) return [];
    
    // Get courses the student is enrolled in
    const studentEnrollments = enrollments.filter(e => e.student_id === user.id);
    const enrolledRoomIds = [...new Set(studentEnrollments.map(e => e.room_id).filter(Boolean))];
    
    return rooms.filter(room => 
      room.is_visible && enrolledRoomIds.includes(room.id)
    );
  };

  const userRooms = getEnrolledRooms();

  const toggleRoom = (roomId: string) => {
    setOpenRooms(prev => ({ ...prev, [roomId]: !prev[roomId] }));
  };

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
        
        {isProfessor ? (
          /* Professor: Room-based navigation */
          userRooms.map(room => (
            <Collapsible 
              key={room.id} 
              open={openRooms[room.id] || roomId === room.id}
              onOpenChange={() => toggleRoom(room.id)}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full nav-link">
                <div className="flex items-center gap-3">
                  <Building size={20} />
                  <span className="truncate">{room.name}</span>
                </div>
                {openRooms[room.id] || roomId === room.id ? 
                  <ChevronDown size={16} className="flex-shrink-0" /> : 
                  <ChevronRight size={16} className="flex-shrink-0" />
                }
              </CollapsibleTrigger>
              
              <CollapsibleContent className="ml-6 space-y-1 mt-1">
                <NavLink 
                  to={`/rooms/${room.id}/students`} 
                  className={({ isActive }) => `nav-link text-sm ${isActive ? 'active' : ''}`}
                >
                  <Users size={16} />
                  <span>Students</span>
                </NavLink>
                
                <NavLink 
                  to={`/rooms/${room.id}/courses`} 
                  className={({ isActive }) => `nav-link text-sm ${isActive ? 'active' : ''}`}
                >
                  <BookOpen size={16} />
                  <span>Courses</span>
                </NavLink>
                
                <NavLink 
                  to={`/rooms/${room.id}/exercises`} 
                  className={({ isActive }) => `nav-link text-sm ${isActive ? 'active' : ''}`}
                >
                  <FileText size={16} />
                  <span>Exercises</span>
                </NavLink>
                
                <NavLink 
                  to={`/rooms/${room.id}/exams`} 
                  className={({ isActive }) => `nav-link text-sm ${isActive ? 'active' : ''}`}
                >
                  <Calendar size={16} />
                  <span>Exams</span>
                </NavLink>
              </CollapsibleContent>
            </Collapsible>
          ))
        ) : (
          /* Student: Simple navigation */
          <>
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
          <NavLink to="/reports" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <BarChart3 size={20} />
            <span>Reports</span>
          </NavLink>
        )}
          </>
        )}
        
        <div className="border-t pt-4 mt-4">
          {isProfessor && (
            <NavLink to="/class-management" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <FolderOpen size={20} />
              <span>Manage Classes</span>
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
        </div>
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

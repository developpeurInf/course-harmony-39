import { useEffect } from "react";
import { useParams, Navigate } from "@/lib/router";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses } from "@/contexts/CourseContext";
import Exams, { type ExamsKind } from "./Exams";

const RoomExams = ({ kind }: { kind?: ExamsKind } = {}) => {
  const { roomId } = useParams();
  const { user } = useAuth();
  const { refreshData } = useCourses();
  
  // Load room-specific data when component mounts or roomId changes
  useEffect(() => {
    if (user && roomId) {
      refreshData(roomId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, roomId]); // dépendances stables : la classe uniquement (le contexte déduplique)
  
  // Redirect if no roomId
  if (!roomId) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <Exams kind={kind} />;
};

export default RoomExams;
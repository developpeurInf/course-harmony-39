import { useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses } from "@/contexts/CourseContext";
import Courses from "./Courses";

const RoomCourses = () => {
  const { roomId } = useParams();
  const { user } = useAuth();
  const { refreshData } = useCourses();
  
  // Load room-specific data when component mounts
  useEffect(() => {
    if (user && roomId) {
      refreshData(roomId);
    }
  }, [user, roomId, refreshData]);
  
  // Redirect if no roomId
  if (!roomId) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <Courses />;
};

export default RoomCourses;
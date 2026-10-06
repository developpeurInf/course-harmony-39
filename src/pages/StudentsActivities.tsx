import { useParams, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import StudentActivities from "@/components/StudentActivities";

const StudentsActivities = () => {
  const { roomId } = useParams();
  const { user } = useAuth();

  if (!roomId) {
    return <Navigate to="/dashboard" replace />;
  }

  // Page réservée aux enseignants
  if (user?.role !== "professor") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <StudentActivities roomId={roomId} />
    </div>
  );
};

export default StudentsActivities;

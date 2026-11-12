import { useParams, Navigate } from "@/lib/router";
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
    <div className="mx-auto w-full">
      <StudentActivities roomId={roomId} />
    </div>
  );
};

export default StudentsActivities;

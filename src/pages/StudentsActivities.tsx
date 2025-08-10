import { useParams, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import StudentActivities from "@/components/StudentActivities";

const StudentsActivities = () => {
  const { roomId } = useParams();
  const { user } = useAuth();

  if (!roomId) {
    return <Navigate to="/dashboard" replace />;
  }

  // Redirect students away from this page
  if (user?.role !== 'professor') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Students Activities</h1>
        <p className="text-muted-foreground">
          Monitor student activities, sessions, and online status
        </p>
      </div>
      
      <StudentActivities roomId={roomId} />
    </div>
  );
};

export default StudentsActivities;
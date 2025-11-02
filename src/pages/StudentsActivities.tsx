import { useParams, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import StudentActivities from "@/components/StudentActivities";

const StudentsActivities = () => {
  const { roomId } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();

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
        <h1 className="text-3xl font-bold">{t("activities.title")}</h1>
        <p className="text-muted-foreground">
          {t("activities.desc")}
        </p>
      </div>
      
      <StudentActivities roomId={roomId} />
    </div>
  );
};

export default StudentsActivities;
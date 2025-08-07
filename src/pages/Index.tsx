
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, BookOpen, FileText, Calendar, ArrowRight } from "lucide-react";

const Index = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    // If already logged in, redirect to dashboard
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-accent/20 p-4">
      <div className="max-w-4xl w-full space-y-8 animate-fade-in">
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-primary">{t("app.name")}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t("index.subtitle")}
          </p>
        </div>

        <Card className="border-2 border-primary/10 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl">{t("index.get.started")}</CardTitle>
            <CardDescription>
              {t("index.login.desc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex gap-2 items-start p-4 border rounded-lg">
                <GraduationCap className="h-6 w-6 text-primary mt-1" />
                <div>
                  <h3 className="font-medium mb-1">{t("index.for.professors")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t("index.professors.desc")}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 items-start p-4 border rounded-lg">
                <BookOpen className="h-6 w-6 text-primary mt-1" />
                <div>
                  <h3 className="font-medium mb-1">{t("index.for.students")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t("index.students.desc")}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={() => navigate("/login")}>
              {t("index.login.account")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-in">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{t("index.course.management")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t("index.course.management.desc")}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{t("index.exercise.tracking")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t("index.exercise.tracking.desc")}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{t("index.exam.scheduling")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t("index.exam.scheduling.desc")}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center pt-6">
          <Button variant="outline" onClick={() => navigate("/login")}>
            {t("index.login.now")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;

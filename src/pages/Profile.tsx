
import { useAuth } from "@/contexts/AuthContext";
import { useCourses } from "@/contexts/CourseContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Mail, BookOpen, FileText, Calendar, GraduationCap, User } from "lucide-react";

const Profile = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { 
    courses, 
    exercises, 
    exams, 
    getVisibleCoursesForStudent, 
    getVisibleExercisesForStudent, 
    getVisibleExamsForStudent 
  } = useCourses();

  if (!user) return null;

  const isProfessor = user.role === "professor";
  
  // Get relevant data based on user role
  const userCourses = isProfessor
    ? courses
    : getVisibleCoursesForStudent(user.id);
    
  const userExercises = isProfessor
    ? exercises
    : getVisibleExercisesForStudent(user.id);
    
  const userExams = isProfessor
    ? exams
    : getVisibleExamsForStudent(user.id);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">{t("profile.title")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("profile.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle>{t("profile.account")}</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex flex-col items-center pb-6">
              <Avatar className="h-24 w-24 mb-4">
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {user.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-bold">{user.name}</h2>
              <div className="flex items-center mt-1 text-muted-foreground">
                <Mail className="h-4 w-4 mr-1" />
                {user.email}
              </div>
              <Badge className="mt-3" variant={isProfessor ? "default" : "secondary"}>
                {isProfessor ? (
                  <><GraduationCap className="h-3 w-3 mr-1" /> {t("profile.professor")}</>
                ) : (
                  <><User className="h-3 w-3 mr-1" /> {t("profile.student")}</>
                )}
              </Badge>
            </div>
            
            <Separator className="my-4" />
            
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-sm mb-2">{t("profile.statistics")}</h3>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="flex flex-col items-center p-2 bg-muted rounded-md">
                    <BookOpen className="h-4 w-4 mb-1 text-primary" />
                    <p className="text-xl font-bold">{userCourses.length}</p>
                    <p className="text-xs text-muted-foreground">{t("nav.courses")}</p>
                  </div>
                  <div className="flex flex-col items-center p-2 bg-muted rounded-md">
                    <FileText className="h-4 w-4 mb-1 text-primary" />
                    <p className="text-xl font-bold">{userExercises.length}</p>
                    <p className="text-xs text-muted-foreground">{t("nav.exercises")}</p>
                  </div>
                  <div className="flex flex-col items-center p-2 bg-muted rounded-md">
                    <Calendar className="h-4 w-4 mb-1 text-primary" />
                    <p className="text-xl font-bold">{userExams.length}</p>
                    <p className="text-xs text-muted-foreground">{t("nav.exams")}</p>
                  </div>
                </div>
              </div>
              
              <Separator className="my-4" />
              
              <div>
                <h3 className="font-medium text-sm mb-2">{t("profile.details")}</h3>
                <ul className="space-y-2">
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">{t("profile.role")}</span>
                    <span className="font-medium">{user.role === "professor" ? t("profile.professor") : t("profile.student")}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">ID</span>
                    <span className="font-medium">{user.id}</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle>{t("profile.activity")}</CardTitle>
            <CardDescription>
              {t("profile.activity.desc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-6">
              <div>
                <h3 className="font-medium mb-3">
                  {isProfessor ? t("profile.courses.teach") : t("profile.courses.enrolled")}
                </h3>
                {userCourses.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3">
                    {userCourses.map(course => (
                      <div key={course.id} className="flex justify-between items-center border p-3 rounded-md">
                        <div>
                          <div className="font-medium">{course.title}</div>
                          <div className="text-sm text-muted-foreground">{course.description}</div>
                        </div>
                        {!course.isVisible && (
                          <Badge variant="outline">{t("dashboard.hidden")}</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground border rounded-md">
                    {t("profile.no.courses")}
                  </div>
                )}
              </div>
              
              <Separator />
              
              <div>
                <h3 className="font-medium mb-3">{t("profile.recent.activity")}</h3>
                {(userExercises.length > 0 || userExams.length > 0) ? (
                  <div className="space-y-3">
                    {userExercises.slice(0, 3).map(exercise => (
                      <div key={exercise.id} className="flex justify-between items-center border p-3 rounded-md">
                        <div>
                          <div className="font-medium">{exercise.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {t("profile.exercise.for")} {courses.find(c => c.id === exercise.courseId)?.title || t("profile.unknown.course")}
                          </div>
                        </div>
                        <Badge variant="secondary">{t("profile.exercise")}</Badge>
                      </div>
                    ))}
                    
                    {userExams.slice(0, 3).map(exam => (
                      <div key={exam.id} className="flex justify-between items-center border p-3 rounded-md">
                        <div>
                          <div className="font-medium">{exam.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {t("profile.exam.for")} {courses.find(c => c.id === exam.courseId)?.title || t("profile.unknown.course")}
                          </div>
                        </div>
                        <Badge variant="default">{t("profile.exam")}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground border rounded-md">
                    {t("profile.no.activity")}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;

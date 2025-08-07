
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses, Course, Exercise, Exam } from "@/contexts/CourseContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, FileText, Calendar, Users } from "lucide-react";
import { format } from "date-fns";

const Dashboard = () => {
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
  
  const [studentCourses, setStudentCourses] = useState<Course[]>([]);
  const [studentExercises, setStudentExercises] = useState<Exercise[]>([]);
  const [studentExams, setStudentExams] = useState<Exam[]>([]);
  const [upcomingExercises, setUpcomingExercises] = useState<Exercise[]>([]);
  const [upcomingExams, setUpcomingExams] = useState<Exam[]>([]);

  useEffect(() => {
    if (user?.role === "student" && user.id) {
      setStudentCourses(getVisibleCoursesForStudent(user.id));
      setStudentExercises(getVisibleExercisesForStudent(user.id));
      setStudentExams(getVisibleExamsForStudent(user.id));
    } else {
      // For professors, we want to show all their courses
      setStudentCourses(courses);
      setStudentExercises(exercises);
      setStudentExams(exams);
    }

    // Get upcoming exercises and exams (due within 14 days)
    const now = new Date();
    const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    
    if (user?.role === "professor") {
      setUpcomingExercises(
        exercises.filter(ex => {
          const dueDate = new Date(ex.dueDate);
          return dueDate >= now && dueDate <= twoWeeksFromNow;
        })
      );
      
      setUpcomingExams(
        exams.filter(ex => {
          const examDate = new Date(ex.date);
          return examDate >= now && examDate <= twoWeeksFromNow;
        })
      );
    } else if (user?.role === "student" && user.id) {
      setUpcomingExercises(
        getVisibleExercisesForStudent(user.id).filter(ex => {
          const dueDate = new Date(ex.dueDate);
          return dueDate >= now && dueDate <= twoWeeksFromNow;
        })
      );
      
      setUpcomingExams(
        getVisibleExamsForStudent(user.id).filter(ex => {
          const examDate = new Date(ex.date);
          return examDate >= now && examDate <= twoWeeksFromNow;
        })
      );
    }
  }, [user, courses, exercises, exams, getVisibleCoursesForStudent, getVisibleExercisesForStudent, getVisibleExamsForStudent]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">{t("dashboard.welcome")}, {user?.name}</h1>
        <p className="text-muted-foreground mt-1">
          {user?.role === "professor" 
            ? t("dashboard.professor.subtitle") 
            : t("dashboard.student.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("nav.courses")}</CardTitle>
            <BookOpen className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {studentCourses.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {user?.role === "professor" 
                ? t("dashboard.courses.professor") 
                : t("dashboard.courses.student")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("nav.exercises")}</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {studentExercises.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {user?.role === "professor" 
                ? t("dashboard.exercises.professor") 
                : t("dashboard.exercises.student")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("nav.exams")}</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {studentExams.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {user?.role === "professor" 
                ? t("dashboard.exams.professor") 
                : t("dashboard.exams.student")}
            </p>
          </CardContent>
        </Card>

        {user?.role === "professor" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("nav.students")}</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {/* Count unique students across all courses */}
                {Array.from(
                  new Set(
                    courses.flatMap(course => course.enrolledStudents)
                  )
                ).length}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("dashboard.students.total")}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>{t("dashboard.deadlines")}</CardTitle>
            <CardDescription>
              {t("dashboard.deadlines.desc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingExercises.length > 0 ? (
              <ul className="space-y-2">
                {upcomingExercises.map(exercise => {
                  const course = courses.find(c => c.id === exercise.courseId);
                  return (
                    <li key={exercise.id} className="flex justify-between items-center p-2 border rounded-md">
                      <div>
                        <div className="font-medium">{exercise.title}</div>
                        <div className="text-sm text-muted-foreground">{course?.title}</div>
                      </div>
                      <Badge variant="outline">
                        {t("dashboard.due")} {format(new Date(exercise.dueDate), "MMM dd")}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                {t("dashboard.no.deadlines")}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>{t("dashboard.upcoming.exams")}</CardTitle>
            <CardDescription>
              {t("dashboard.upcoming.exams.desc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingExams.length > 0 ? (
              <ul className="space-y-2">
                {upcomingExams.map(exam => {
                  const course = courses.find(c => c.id === exam.courseId);
                  return (
                    <li key={exam.id} className="flex justify-between items-center p-2 border rounded-md">
                      <div>
                        <div className="font-medium">{exam.title}</div>
                        <div className="text-sm text-muted-foreground">{course?.title}</div>
                      </div>
                      <Badge variant="outline">
                        {format(new Date(exam.date), "MMM dd, HH:mm")}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                {t("dashboard.no.exams")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.your.courses")}</CardTitle>
          <CardDescription>
            {user?.role === "professor" 
              ? t("dashboard.your.courses.professor") 
              : t("dashboard.your.courses.student")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {studentCourses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {studentCourses.map(course => (
                <Card key={course.id} className="card-hover">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between">
                      <CardTitle className="text-lg">{course.title}</CardTitle>
                      {!course.isVisible && (
                        <Badge variant="outline" className="ml-2">{t("dashboard.hidden")}</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-2">{course.description}</p>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Users className="h-3 w-3 mr-1" />
                      {course.enrolledStudents.length} {t("dashboard.students.count")}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              {user?.role === "student" 
                ? t("dashboard.no.courses.student") 
                : t("dashboard.no.courses.professor")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;

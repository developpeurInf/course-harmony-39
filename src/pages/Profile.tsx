
import { useAuth } from "@/contexts/AuthContext";
import { useCourses } from "@/contexts/CourseContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Mail, BookOpen, FileText, Calendar, GraduationCap, User } from "lucide-react";

const Profile = () => {
  const { user } = useAuth();
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
        <h1 className="text-3xl font-bold">My Profile</h1>
        <p className="text-muted-foreground mt-1">
          View and manage your account information
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle>Account Information</CardTitle>
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
                  <><GraduationCap className="h-3 w-3 mr-1" /> Professor</>
                ) : (
                  <><User className="h-3 w-3 mr-1" /> Student</>
                )}
              </Badge>
            </div>
            
            <Separator className="my-4" />
            
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-sm mb-2">Account Statistics</h3>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="flex flex-col items-center p-2 bg-muted rounded-md">
                    <BookOpen className="h-4 w-4 mb-1 text-primary" />
                    <p className="text-xl font-bold">{userCourses.length}</p>
                    <p className="text-xs text-muted-foreground">Courses</p>
                  </div>
                  <div className="flex flex-col items-center p-2 bg-muted rounded-md">
                    <FileText className="h-4 w-4 mb-1 text-primary" />
                    <p className="text-xl font-bold">{userExercises.length}</p>
                    <p className="text-xs text-muted-foreground">Exercises</p>
                  </div>
                  <div className="flex flex-col items-center p-2 bg-muted rounded-md">
                    <Calendar className="h-4 w-4 mb-1 text-primary" />
                    <p className="text-xl font-bold">{userExams.length}</p>
                    <p className="text-xs text-muted-foreground">Exams</p>
                  </div>
                </div>
              </div>
              
              <Separator className="my-4" />
              
              <div>
                <h3 className="font-medium text-sm mb-2">Account Details</h3>
                <ul className="space-y-2">
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">Role</span>
                    <span className="font-medium">{user.role === "professor" ? "Professor" : "Student"}</span>
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
            <CardTitle>My Activity</CardTitle>
            <CardDescription>
              Summary of your courses and academic activity
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-6">
              <div>
                <h3 className="font-medium mb-3">
                  {isProfessor ? "Courses You Teach" : "Your Enrolled Courses"}
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
                          <Badge variant="outline">Hidden</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground border rounded-md">
                    No courses found
                  </div>
                )}
              </div>
              
              <Separator />
              
              <div>
                <h3 className="font-medium mb-3">Recent Activity</h3>
                {(userExercises.length > 0 || userExams.length > 0) ? (
                  <div className="space-y-3">
                    {userExercises.slice(0, 3).map(exercise => (
                      <div key={exercise.id} className="flex justify-between items-center border p-3 rounded-md">
                        <div>
                          <div className="font-medium">{exercise.title}</div>
                          <div className="text-sm text-muted-foreground">
                            Exercise for {courses.find(c => c.id === exercise.courseId)?.title || "Unknown Course"}
                          </div>
                        </div>
                        <Badge variant="secondary">Exercise</Badge>
                      </div>
                    ))}
                    
                    {userExams.slice(0, 3).map(exam => (
                      <div key={exam.id} className="flex justify-between items-center border p-3 rounded-md">
                        <div>
                          <div className="font-medium">{exam.title}</div>
                          <div className="text-sm text-muted-foreground">
                            Exam for {courses.find(c => c.id === exam.courseId)?.title || "Unknown Course"}
                          </div>
                        </div>
                        <Badge variant="primary">Exam</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground border rounded-md">
                    No recent activity
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

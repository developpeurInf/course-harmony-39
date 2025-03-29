
import { useAuth } from "@/contexts/AuthContext";
import { useCourses } from "@/contexts/CourseContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

const Students = () => {
  const { user, getStudents } = useAuth();
  const { courses } = useCourses();
  const navigate = useNavigate();
  
  const students = getStudents();
  const isProfessor = user?.role === "professor";
  
  // Redirect if not a professor
  useEffect(() => {
    if (!isProfessor) {
      navigate("/dashboard");
    }
  }, [isProfessor, navigate]);

  if (!isProfessor) {
    return null; // Will redirect
  }

  // Count number of courses a student is enrolled in
  const getStudentCourseCount = (studentId: string) => {
    return courses.filter(course => course.enrolledStudents.includes(studentId)).length;
  };

  // Get courses for a student
  const getStudentCourses = (studentId: string) => {
    return courses.filter(course => course.enrolledStudents.includes(studentId));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Students</h1>
        <p className="text-muted-foreground mt-1">
          Manage and view information about your students
        </p>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="all">All Students</TabsTrigger>
          <TabsTrigger value="byCourse">By Course</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {students.map(student => (
              <Card key={student.id} className="overflow-hidden card-hover">
                <CardHeader className="pb-3">
                  <CardTitle>{student.name}</CardTitle>
                  <CardDescription className="flex items-center mt-1">
                    <Mail className="h-4 w-4 mr-1" />
                    {student.email}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <BookOpen className="h-4 w-4 mr-1" />
                      <span>
                        Enrolled in {getStudentCourseCount(student.id)} course{getStudentCourseCount(student.id) !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  
                  {getStudentCourseCount(student.id) > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Enrolled Courses</h4>
                      <div className="flex flex-wrap gap-2">
                        {getStudentCourses(student.id).map(course => (
                          <Badge key={course.id} variant="outline" className="bg-accent/50">
                            {course.title}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="byCourse" className="space-y-6">
          {courses.map(course => (
            <Card key={course.id} className="overflow-hidden">
              <CardHeader>
                <CardTitle>{course.title}</CardTitle>
                <CardDescription>
                  {course.enrolledStudents.length} enrolled student{course.enrolledStudents.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {course.enrolledStudents.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {course.enrolledStudents.map(studentId => {
                      const student = students.find(s => s.id === studentId);
                      return student ? (
                        <div key={studentId} className="flex items-center p-3 border rounded-md">
                          <div>
                            <div className="font-medium">{student.name}</div>
                            <div className="text-sm text-muted-foreground">{student.email}</div>
                          </div>
                        </div>
                      ) : null;
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No students enrolled in this course
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Students;

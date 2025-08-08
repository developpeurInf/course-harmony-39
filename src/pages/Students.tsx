import { useAuth } from "@/contexts/AuthContext";
import { useCourses } from "@/contexts/CourseContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, LayoutList, Mail, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const Students = () => {
  const { user, getStudents } = useAuth();
  const { courses, enrollments } = useCourses();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const isProfessor = user?.role === "professor";
  
  // Redirect if not a professor
  useEffect(() => {
    if (!isProfessor) {
      navigate("/dashboard");
    }
  }, [isProfessor, navigate]);

  // Fetch students
  useEffect(() => {
    const fetchStudents = async () => {
      if (isProfessor) {
        setLoading(true);
        const studentsData = await getStudents();
        setStudents(studentsData);
        setLoading(false);
      }
    };

    fetchStudents();
  }, [isProfessor, getStudents]);

  if (!isProfessor) {
    return null; // Will redirect
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Count number of courses a student is enrolled in
  const getStudentCourseCount = (studentId: string) => {
    return enrollments.filter(enrollment => enrollment.student_id === studentId).length;
  };

  // Get courses for a student
  const getStudentCourses = (studentId: string) => {
    const enrolledCourseIds = enrollments
      .filter(enrollment => enrollment.student_id === studentId)
      .map(enrollment => enrollment.course_id);
    
    return courses.filter(course => enrolledCourseIds.includes(course.id));
  };

  // Toggle view mode between grid and list
  const toggleViewMode = () => {
    setViewMode(viewMode === "grid" ? "list" : "grid");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Students</h1>
          <p className="text-muted-foreground mt-1">
            Manage and view information about your students
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={toggleViewMode}
          title={viewMode === "grid" ? "Switch to list view" : "Switch to grid view"}
        >
          {viewMode === "grid" ? (
            <LayoutList className="h-4 w-4" />
          ) : (
            <LayoutGrid className="h-4 w-4" />
          )}
        </Button>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="all">All Students</TabsTrigger>
          <TabsTrigger value="byCourse">By Course</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {students.map(student => (
                <Card key={student.id} className="overflow-hidden card-hover">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                      {student.avatar_url && (
                        <img 
                          src={student.avatar_url} 
                          alt={student.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      )}
                      {student.name}
                    </CardTitle>
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
          ) : (
            <div className="space-y-3">
              {students.map(student => (
                <div key={student.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg bg-card">
                  <div className="space-y-1 mb-2 sm:mb-0">
                    <div className="flex items-center gap-2">
                      {student.avatar_url && (
                        <img 
                          src={student.avatar_url} 
                          alt={student.name}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      )}
                      <h3 className="font-medium">{student.name}</h3>
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Mail className="h-4 w-4 mr-1" />
                      <span>{student.email}</span>
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <BookOpen className="h-4 w-4 mr-1" />
                      <span>
                        Enrolled in {getStudentCourseCount(student.id)} course{getStudentCourseCount(student.id) !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  
                  {getStudentCourseCount(student.id) > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {getStudentCourses(student.id).map(course => (
                        <Badge key={course.id} variant="outline" className="bg-accent/50">
                          {course.title}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {students.length === 0 && (
            <div className="text-center py-12">
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No Students Found</h3>
              <p className="mt-2 text-muted-foreground">
                Students will appear here when they register for your courses.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="byCourse" className="space-y-6">
          {courses
            .filter(course => course.professor_id === user?.id)
            .map(course => {
              const enrolledStudents = students.filter(student => 
                enrollments.some(enrollment => 
                  enrollment.course_id === course.id && enrollment.student_id === student.id
                )
              );

              return (
                <Card key={course.id} className="overflow-hidden">
                  <CardHeader>
                    <CardTitle>{course.title}</CardTitle>
                    <CardDescription>
                      {enrolledStudents.length} enrolled student{enrolledStudents.length !== 1 ? 's' : ''}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {enrolledStudents.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {enrolledStudents.map(student => (
                          <div key={student.id} className="flex items-center p-3 border rounded-md">
                            <div className="flex items-center gap-2">
                              {student.avatar_url && (
                                <img 
                                  src={student.avatar_url} 
                                  alt={student.name}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              )}
                              <div>
                                <div className="font-medium">{student.name}</div>
                                <div className="text-sm text-muted-foreground">{student.email}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        No students enrolled in this course
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

          {courses.filter(course => course.professor_id === user?.id).length === 0 && (
            <div className="text-center py-12">
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No Courses Found</h3>
              <p className="mt-2 text-muted-foreground">
                Create some courses first to see student enrollments.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Students;
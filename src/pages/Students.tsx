import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses } from "@/contexts/CourseContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Users, 
  Search, 
  Plus, 
  Mail, 
  BookOpen,
  UserPlus,
  UserMinus,
  LayoutGrid,
  LayoutList
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const Students = () => {
  const { user, getStudents, addStudent } = useAuth();
  const { courses, enrollments, enrollStudent, removeEnrollment } = useCourses();
  const navigate = useNavigate();

  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isEnrollDialogOpen, setIsEnrollDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [enrollCourseId, setEnrollCourseId] = useState("");
  const [isAddStudentDialogOpen, setIsAddStudentDialogOpen] = useState(false);
  const [newStudentData, setNewStudentData] = useState({
    name: "",
    email: "",
    password: ""
  });

  // Redirect if not professor
  useEffect(() => {
    if (user && user.role !== "professor") {
      navigate("/dashboard");
      return;
    }
  }, [user, navigate]);

  // Fetch students
  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      try {
        const studentsList = await getStudents();
        setStudents(studentsList);
      } catch (error) {
        console.error("Failed to fetch students:", error);
        toast.error("Failed to load students");
      } finally {
        setLoading(false);
      }
    };

    if (user?.role === "professor") {
      fetchStudents();
    }
  }, [user, getStudents]);

  // Filter students by professor's courses
  const professorCourses = courses.filter(c => c.professor_id === user?.id);
  const professorCourseIds = professorCourses.map(c => c.id);

  // Get students enrolled in professor's courses
  const enrolledStudents = students.filter(student => 
    enrollments.some(e => 
      e.student_id === student.id && 
      professorCourseIds.includes(e.course_id)
    )
  );

  // Filter students based on search and course selection
  const filteredStudents = enrolledStudents.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (selectedCourse === "all") return matchesSearch;
    
    return matchesSearch && enrollments.some(e => 
      e.student_id === student.id && 
      e.course_id === selectedCourse
    );
  });

  // Get student's enrolled courses count
  const getStudentCourseCount = (studentId: string): number => {
    return enrollments.filter(e => 
      e.student_id === studentId && 
      professorCourseIds.includes(e.course_id)
    ).length;
  };

  // Get courses a student is enrolled in
  const getStudentCourses = (studentId: string) => {
    const studentEnrollments = enrollments.filter(e => e.student_id === studentId);
    return professorCourses.filter(course => 
      studentEnrollments.some(e => e.course_id === course.id)
    );
  };

  // Handle student enrollment
  const handleEnrollStudent = async () => {
    if (!selectedStudent || !enrollCourseId) return;

    // Check if already enrolled
    const alreadyEnrolled = enrollments.some(e => 
      e.student_id === selectedStudent.id && 
      e.course_id === enrollCourseId
    );

    if (alreadyEnrolled) {
      toast.error("Student is already enrolled in this course");
      return;
    }

    const success = await enrollStudent(enrollCourseId, selectedStudent.id);
    if (success) {
      setIsEnrollDialogOpen(false);
      setSelectedStudent(null);
      setEnrollCourseId("");
    }
  };

  // Handle remove enrollment
  const handleRemoveEnrollment = async (studentId: string, courseId: string) => {
    const enrollment = enrollments.find(e => 
      e.student_id === studentId && 
      e.course_id === courseId
    );
    
    if (!enrollment) return;

    const success = await removeEnrollment(enrollment.id);
    if (success) {
      toast.success("Student removed from course");
    }
  };

  const openEnrollDialog = (student: any) => {
    setSelectedStudent(student);
    setIsEnrollDialogOpen(true);
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === "grid" ? "list" : "grid");
  };

  const handleAddStudent = async () => {
    if (!newStudentData.name || !newStudentData.email || !newStudentData.password) {
      toast.error("Please fill in all fields");
      return;
    }

    const success = await addStudent(newStudentData.email, newStudentData.password, newStudentData.name);
    if (success) {
      setIsAddStudentDialogOpen(false);
      setNewStudentData({ name: "", email: "", password: "" });
      // Refresh students list
      const updatedStudents = await getStudents();
      setStudents(updatedStudents);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading students...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            Student Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage students enrolled in your courses
          </p>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={isAddStudentDialogOpen} onOpenChange={setIsAddStudentDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Student
              </Button>
            </DialogTrigger>
          </Dialog>
        
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
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search students by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={selectedCourse} onValueChange={setSelectedCourse}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter by course" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Courses</SelectItem>
            {professorCourses.map(course => (
              <SelectItem key={course.id} value={course.id}>
                {course.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Students Display */}
      {filteredStudents.length > 0 ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStudents.map((student) => (
              <Card key={student.id} className="overflow-hidden card-hover">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={student.avatar_url} alt={student.name} />
                      <AvatarFallback>
                        {student.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{student.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <Mail className="h-3 w-3" />
                        {student.email}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Enrolled Courses:</span>
                    <Badge variant="secondary">
                      {getStudentCourseCount(student.id)}
                    </Badge>
                  </div>
                  
                  {/* Course List */}
                  <div className="space-y-1">
                    {getStudentCourses(student.id).slice(0, 3).map(course => (
                      <div key={course.id} className="flex items-center justify-between text-sm">
                        <span className="truncate">{course.title}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveEnrollment(student.id, course.id)}
                          title="Remove from course"
                        >
                          <UserMinus className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    {getStudentCourses(student.id).length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{getStudentCourses(student.id).length - 3} more courses
                      </p>
                    )}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => openEnrollDialog(student)}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Enroll in Course
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredStudents.map((student) => (
              <div key={student.id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={student.avatar_url} alt={student.name} />
                    <AvatarFallback>
                      {student.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-medium">{student.name}</h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {student.email}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {getStudentCourseCount(student.id)} courses
                  </Badge>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEnrollDialog(student)}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Enroll
                </Button>
              </div>
            ))}
          </div>
        )
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Students Found</h3>
            <p className="text-muted-foreground text-center">
              {searchTerm || selectedCourse !== "all" 
                ? "No students match your current filters." 
                : "No students are enrolled in your courses yet."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Enrollment Dialog */}
      <Dialog open={isEnrollDialogOpen} onOpenChange={setIsEnrollDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enroll Student in Course</DialogTitle>
            <DialogDescription>
              Select a course to enroll {selectedStudent?.name} in.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="course">Course</Label>
              <Select value={enrollCourseId} onValueChange={setEnrollCourseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  {professorCourses.map(course => {
                    const isEnrolled = selectedStudent && enrollments.some(e => 
                      e.student_id === selectedStudent.id && 
                      e.course_id === course.id
                    );
                    
                    return (
                      <SelectItem 
                        key={course.id} 
                        value={course.id}
                        disabled={isEnrolled}
                      >
                        {course.title} {isEnrolled && "(Already enrolled)"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEnrollDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleEnrollStudent}
              disabled={!enrollCourseId}
            >
              Enroll Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Student Dialog */}
      <Dialog open={isAddStudentDialogOpen} onOpenChange={setIsAddStudentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Student</DialogTitle>
            <DialogDescription>
              Create a new student account. They will receive an email to verify their account.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="Enter student's full name"
                value={newStudentData.name}
                onChange={(e) => setNewStudentData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter student's email"
                value={newStudentData.email}
                onChange={(e) => setNewStudentData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Temporary Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter temporary password"
                value={newStudentData.password}
                onChange={(e) => setNewStudentData(prev => ({ ...prev, password: e.target.value }))}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddStudentDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddStudent}
              disabled={!newStudentData.name || !newStudentData.email || !newStudentData.password}
            >
              Add Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Students;
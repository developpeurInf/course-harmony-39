
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses, Course } from "@/contexts/CourseContext";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter,
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { 
  BookOpen, 
  Eye, 
  EyeOff, 
  Edit, 
  Trash, 
  Plus,
  Users,
  FileText,
  Calendar,
  LayoutGrid,
  LayoutList
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";

const Courses = () => {
  const { user, getStudents } = useAuth();
  const { 
    courses, 
    exercises,
    exams,
    addCourse, 
    updateCourse, 
    deleteCourse, 
    toggleCourseVisibility,
    enrollStudent,
    unenrollStudent,
    getVisibleCoursesForStudent
  } = useCourses();
  
  const navigate = useNavigate();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEnrollDialogOpen, setIsEnrollDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isVisible, setIsVisible] = useState(true);
  const [currentCourse, setCurrentCourse] = useState<Course | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  
  const students = getStudents();
  const isProfessor = user?.role === "professor";
  
  // Filter courses based on user role
  const displayedCourses = isProfessor 
    ? courses 
    : (user ? getVisibleCoursesForStudent(user.id) : []);

  // Reset form
  const resetForm = () => {
    setTitle("");
    setDescription("");
    setIsVisible(true);
    setCurrentCourse(null);
    setSelectedStudentId("");
  };

  // Add new course
  const handleAddCourse = () => {
    addCourse({
      title,
      description,
      isVisible,
      enrolledStudents: []
    });
    setIsAddDialogOpen(false);
    resetForm();
  };

  // Edit course
  const handleEditCourse = () => {
    if (currentCourse) {
      updateCourse(currentCourse.id, {
        title,
        description,
        isVisible
      });
      setIsEditDialogOpen(false);
      resetForm();
    }
  };

  // Delete course
  const handleDeleteCourse = () => {
    if (currentCourse) {
      deleteCourse(currentCourse.id);
      setIsDeleteDialogOpen(false);
      resetForm();
    }
  };

  // Open edit dialog with course data
  const openEditDialog = (course: Course) => {
    setCurrentCourse(course);
    setTitle(course.title);
    setDescription(course.description);
    setIsVisible(course.isVisible);
    setIsEditDialogOpen(true);
  };

  // Open delete confirmation dialog
  const openDeleteDialog = (course: Course) => {
    setCurrentCourse(course);
    setIsDeleteDialogOpen(true);
  };

  // Open enrollment dialog
  const openEnrollDialog = (course: Course) => {
    setCurrentCourse(course);
    setIsEnrollDialogOpen(true);
  };

  // Handle enrollment
  const handleEnrollStudent = () => {
    if (currentCourse && selectedStudentId) {
      enrollStudent(currentCourse.id, selectedStudentId);
      setSelectedStudentId("");
    }
  };

  // Handle unenrollment
  const handleUnenrollStudent = (courseId: string, studentId: string) => {
    unenrollStudent(courseId, studentId);
  };

  // Toggle course visibility
  const handleToggleVisibility = (courseId: string) => {
    toggleCourseVisibility(courseId);
  };

  // Toggle view mode between grid and list
  const toggleViewMode = () => {
    setViewMode(viewMode === "grid" ? "list" : "grid");
  };

  // Get course statistics
  const getCourseStats = (courseId: string) => {
    const courseExercises = exercises.filter(e => e.courseId === courseId);
    const courseExams = exams.filter(e => e.courseId === courseId);
    
    return {
      exerciseCount: courseExercises.length,
      examCount: courseExams.length
    };
  };

  // Navigate to filtered exercises/exams for a course
  const navigateToExercises = (courseId: string) => {
    navigate(`/exercises?course=${courseId}`);
  };

  const navigateToExams = (courseId: string) => {
    navigate(`/exams?course=${courseId}`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Courses</h1>
          <p className="text-muted-foreground mt-1">
            {isProfessor 
              ? "Manage your courses and student enrollments" 
              : "View courses you're enrolled in"}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
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
          
          {isProfessor && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Course
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Course</DialogTitle>
                  <DialogDescription>
                    Create a new course and make it available to students.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Course Title</Label>
                    <Input
                      id="title"
                      placeholder="e.g., Introduction to Computer Science"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Enter course description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="visibility"
                      checked={isVisible}
                      onCheckedChange={setIsVisible}
                    />
                    <Label htmlFor="visibility">Visible to students</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddCourse}>
                    Create Course
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {displayedCourses.length > 0 ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedCourses.map((course) => {
              const stats = getCourseStats(course.id);
              
              return (
                <Card key={course.id} className="overflow-hidden card-hover">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle>{course.title}</CardTitle>
                      {!course.isVisible && (
                        <Badge variant="outline">Hidden</Badge>
                      )}
                    </div>
                    <CardDescription className="mt-2">
                      {course.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center text-muted-foreground">
                          <Users className="h-4 w-4 mr-1" />
                          <span>{course.enrolledStudents.length} students</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-3">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7"
                          onClick={() => navigateToExercises(course.id)}
                        >
                          <FileText className="h-3.5 w-3.5 mr-1" />
                          {stats.exerciseCount} {stats.exerciseCount === 1 ? "Exercise" : "Exercises"}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7"
                          onClick={() => navigateToExams(course.id)}
                        >
                          <Calendar className="h-3.5 w-3.5 mr-1" />
                          {stats.examCount} {stats.examCount === 1 ? "Exam" : "Exams"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                  {isProfessor && (
                    <CardFooter className="border-t bg-muted/30 px-6 py-3">
                      <div className="flex justify-between w-full">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleToggleVisibility(course.id)}
                          title={course.isVisible ? "Hide from students" : "Make visible to students"}
                        >
                          {course.isVisible ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => openEnrollDialog(course)}
                            title="Manage students"
                          >
                            <Users className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => openEditDialog(course)}
                            title="Edit course"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => openDeleteDialog(course)}
                            title="Delete course"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardFooter>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {displayedCourses.map((course) => {
              const stats = getCourseStats(course.id);
              
              return (
                <div key={course.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg bg-card">
                  <div className="space-y-1 mb-2 sm:mb-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{course.title}</h3>
                      {!course.isVisible && <Badge variant="outline" className="h-5">Hidden</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{course.description}</p>
                    <div className="flex items-center text-xs text-muted-foreground mt-1">
                      <Users className="h-3 w-3 mr-1" />
                      <span>{course.enrolledStudents.length} students</span>
                      <span className="mx-2">•</span>
                      <FileText className="h-3 w-3 mr-1" />
                      <span>{stats.exerciseCount} exercises</span>
                      <span className="mx-2">•</span>
                      <Calendar className="h-3 w-3 mr-1" />
                      <span>{stats.examCount} exams</span>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2 w-full sm:w-auto justify-end">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigateToExercises(course.id)}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      <span>Exercises</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigateToExams(course.id)}
                    >
                      <Calendar className="h-4 w-4 mr-1" />
                      <span>Exams</span>
                    </Button>
                    
                    {isProfessor && (
                      <>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => openEnrollDialog(course)}
                        >
                          <Users className="h-4 w-4 mr-1" />
                          <span>Students</span>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => openEditDialog(course)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          <span>Edit</span>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => openDeleteDialog(course)}
                        >
                          <Trash className="h-4 w-4 mr-1" />
                          <span>Delete</span>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center py-12 border rounded-lg bg-muted/30">
          <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-medium">No courses found</h3>
          <p className="text-muted-foreground text-center max-w-md mt-2">
            {isProfessor 
              ? "You haven't created any courses yet. Add your first course to get started."
              : "You are not enrolled in any courses yet. Contact your professor for enrollment."}
          </p>
          {isProfessor && (
            <Button className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Course
            </Button>
          )}
        </div>
      )}
      
      {/* Edit Course Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
            <DialogDescription>
              Update the course details and visibility.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Course Title</Label>
              <Input
                id="edit-title"
                placeholder="Course title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Course description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-visibility"
                checked={isVisible}
                onCheckedChange={setIsVisible}
              />
              <Label htmlFor="edit-visibility">Visible to students</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditCourse}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Course Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Course</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {currentCourse?.title}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteCourse}>
              Delete Course
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enrollment Dialog */}
      <Dialog open={isEnrollDialogOpen} onOpenChange={setIsEnrollDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Students</DialogTitle>
            <DialogDescription>
              Enroll or unenroll students for {currentCourse?.title}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Add student */}
            <div className="space-y-2">
              <Label>Add student</Label>
              <div className="flex space-x-2">
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.filter(student => 
                      !currentCourse?.enrolledStudents.includes(student.id)
                    ).map(student => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleEnrollStudent} 
                  disabled={!selectedStudentId}
                  size="icon"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Enrolled students */}
            <div className="space-y-2">
              <Label>Enrolled students</Label>
              <div className="border rounded-md overflow-hidden">
                {currentCourse?.enrolledStudents.length === 0 ? (
                  <div className="p-3 text-center text-muted-foreground">
                    No students enrolled yet
                  </div>
                ) : (
                  <ul className="divide-y">
                    {currentCourse?.enrolledStudents.map(studentId => {
                      const student = students.find(s => s.id === studentId);
                      return (
                        <li key={studentId} className="flex justify-between items-center p-3">
                          <span>{student?.name}</span>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => currentCourse && handleUnenrollStudent(currentCourse.id, studentId)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsEnrollDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Courses;

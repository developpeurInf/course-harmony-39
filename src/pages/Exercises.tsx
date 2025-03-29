
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses, Exercise } from "@/contexts/CourseContext";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  FileText, 
  Eye, 
  EyeOff, 
  Edit, 
  Trash, 
  Plus,
  Calendar,
  LayoutGrid,
  LayoutList
} from "lucide-react";
import { format } from "date-fns";
import { useLocation, useNavigate } from "react-router-dom";

const Exercises = () => {
  const { user } = useAuth();
  const { 
    courses, 
    exercises, 
    addExercise, 
    updateExercise, 
    deleteExercise, 
    toggleExerciseVisibility,
    getVisibleExercisesForStudent 
  } = useCourses();
  
  const location = useLocation();
  const navigate = useNavigate();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isVisible, setIsVisible] = useState(true);
  const [currentExercise, setCurrentExercise] = useState<Exercise | null>(null);
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>("all");
  
  const isProfessor = user?.role === "professor";
  
  // Parse course ID from URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const courseParam = params.get('course');
    if (courseParam && courses.some(c => c.id === courseParam)) {
      setSelectedCourseFilter(courseParam);
    }
  }, [location.search, courses]);
  
  // Update URL when filter changes
  const updateUrlWithFilter = (courseId: string) => {
    if (courseId === "all") {
      navigate('/exercises');
    } else {
      navigate(`/exercises?course=${courseId}`);
    }
  };

  // Filter exercises based on user role and selected course
  const userExercises = isProfessor 
    ? exercises 
    : (user ? getVisibleExercisesForStudent(user.id) : []);
  const displayedExercises = selectedCourseFilter === "all" 
    ? userExercises 
    : userExercises.filter(exercise => exercise.courseId === selectedCourseFilter);

  // Filter courses based on user role for the course dropdown
  const availableCourses = isProfessor 
    ? courses 
    : courses.filter(course => 
        course.isVisible && user && course.enrolledStudents.includes(user.id)
      );

  // Reset form
  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCourseId("");
    setDueDate("");
    setIsVisible(true);
    setCurrentExercise(null);
  };

  // Format date for input field
  const formatDateForInput = (dateString: string) => {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  // Add new exercise
  const handleAddExercise = () => {
    addExercise({
      title,
      description,
      courseId,
      dueDate: new Date(dueDate).toISOString(),
      isVisible
    });
    setIsAddDialogOpen(false);
    resetForm();
  };

  // Edit exercise
  const handleEditExercise = () => {
    if (currentExercise) {
      updateExercise(currentExercise.id, {
        title,
        description,
        courseId,
        dueDate: new Date(dueDate).toISOString(),
        isVisible
      });
      setIsEditDialogOpen(false);
      resetForm();
    }
  };

  // Delete exercise
  const handleDeleteExercise = () => {
    if (currentExercise) {
      deleteExercise(currentExercise.id);
      setIsDeleteDialogOpen(false);
      resetForm();
    }
  };

  // Open edit dialog with exercise data
  const openEditDialog = (exercise: Exercise) => {
    setCurrentExercise(exercise);
    setTitle(exercise.title);
    setDescription(exercise.description);
    setCourseId(exercise.courseId);
    setDueDate(formatDateForInput(exercise.dueDate));
    setIsVisible(exercise.isVisible);
    setIsEditDialogOpen(true);
  };

  // Open delete confirmation dialog
  const openDeleteDialog = (exercise: Exercise) => {
    setCurrentExercise(exercise);
    setIsDeleteDialogOpen(true);
  };

  // Toggle exercise visibility
  const handleToggleVisibility = (exerciseId: string) => {
    toggleExerciseVisibility(exerciseId);
  };

  // Get course name from ID
  const getCourseName = (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    return course ? course.title : "Unknown Course";
  };

  // Format due date
  const formatDueDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "PPP");
    } catch (error) {
      return "Invalid date";
    }
  };

  // Check if due date is in the past
  const isPastDue = (dateString: string) => {
    const now = new Date();
    const dueDate = new Date(dateString);
    return dueDate < now;
  };

  // Toggle view mode between grid and list
  const toggleViewMode = () => {
    setViewMode(viewMode === "grid" ? "list" : "grid");
  };

  // Handle course filter change
  const handleCourseFilterChange = (courseId: string) => {
    setSelectedCourseFilter(courseId);
    updateUrlWithFilter(courseId);
  };

  // Set initial courseId for new exercise form if a course is selected
  useEffect(() => {
    if (selectedCourseFilter !== "all" && selectedCourseFilter) {
      setCourseId(selectedCourseFilter);
    }
  }, [selectedCourseFilter, isAddDialogOpen]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Exercises</h1>
          <p className="text-muted-foreground mt-1">
            {isProfessor 
              ? "Manage exercises and assignments for your courses" 
              : "View and complete your assigned exercises"}
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
                  Add Exercise
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Exercise</DialogTitle>
                  <DialogDescription>
                    Create a new exercise for one of your courses.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="course">Course</Label>
                    <Select value={courseId} onValueChange={setCourseId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a course" />
                      </SelectTrigger>
                      <SelectContent>
                        {courses.map(course => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="title">Exercise Title</Label>
                    <Input
                      id="title"
                      placeholder="e.g., Programming Assignment 1"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Enter exercise description and requirements"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
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
                  <Button 
                    onClick={handleAddExercise}
                    disabled={!title || !courseId || !dueDate}
                  >
                    Create Exercise
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Course filter */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
        <div className="w-full sm:w-64">
          <Select value={selectedCourseFilter} onValueChange={handleCourseFilterChange}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by course" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {availableCourses.map(course => (
                <SelectItem key={course.id} value={course.id}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">
          Showing {displayedExercises.length} {displayedExercises.length === 1 ? "exercise" : "exercises"}
          {selectedCourseFilter !== "all" && " for " + getCourseName(selectedCourseFilter)}
        </p>
      </div>

      {displayedExercises.length > 0 ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedExercises.map((exercise) => (
              <Card key={exercise.id} className="overflow-hidden card-hover">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle>{exercise.title}</CardTitle>
                    <div className="flex flex-col items-end gap-1">
                      {!exercise.isVisible && (
                        <Badge variant="outline">Hidden</Badge>
                      )}
                      {isPastDue(exercise.dueDate) ? (
                        <Badge variant="destructive">Past Due</Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </div>
                  </div>
                  <CardDescription className="mt-1">
                    {getCourseName(exercise.courseId)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-3">
                  <p className="text-sm mb-3">{exercise.description}</p>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 mr-1" />
                    <span>Due: {formatDueDate(exercise.dueDate)}</span>
                  </div>
                </CardContent>
                {isProfessor && (
                  <CardFooter className="border-t bg-muted/30 px-6 py-3">
                    <div className="flex justify-between w-full">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleToggleVisibility(exercise.id)}
                        title={exercise.isVisible ? "Hide from students" : "Make visible to students"}
                      >
                        {exercise.isVisible ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => openEditDialog(exercise)}
                          title="Edit exercise"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => openDeleteDialog(exercise)}
                          title="Delete exercise"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardFooter>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {displayedExercises.map((exercise) => (
              <div key={exercise.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg bg-card">
                <div className="space-y-1 mb-2 sm:mb-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{exercise.title}</h3>
                    {!exercise.isVisible && <Badge variant="outline" className="h-5">Hidden</Badge>}
                    {isPastDue(exercise.dueDate) ? (
                      <Badge variant="destructive" className="h-5">Past Due</Badge>
                    ) : (
                      <Badge variant="secondary" className="h-5">Active</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{getCourseName(exercise.courseId)}</p>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3 mr-1" />
                    <span>Due: {formatDueDate(exercise.dueDate)}</span>
                  </div>
                </div>
                
                {isProfessor && (
                  <div className="flex space-x-2 w-full sm:w-auto justify-end">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleToggleVisibility(exercise.id)}
                    >
                      {exercise.isVisible ? (
                        <EyeOff className="h-4 w-4 mr-1" />
                      ) : (
                        <Eye className="h-4 w-4 mr-1" />
                      )}
                      <span>{exercise.isVisible ? "Hide" : "Show"}</span>
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => openEditDialog(exercise)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      <span>Edit</span>
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => openDeleteDialog(exercise)}
                    >
                      <Trash className="h-4 w-4 mr-1" />
                      <span>Delete</span>
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center py-12 border rounded-lg bg-muted/30">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-medium">No exercises found</h3>
          <p className="text-muted-foreground text-center max-w-md mt-2">
            {isProfessor 
              ? selectedCourseFilter !== "all" 
                ? `You haven't created any exercises for ${getCourseName(selectedCourseFilter)} yet.`
                : "You haven't created any exercises yet. Add your first exercise to get started."
              : selectedCourseFilter !== "all"
                ? `No exercises are currently available for ${getCourseName(selectedCourseFilter)}.`
                : "You don't have any assigned exercises yet."}
          </p>
          {isProfessor && (
            <Button className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {selectedCourseFilter !== "all" 
                ? `Add Exercise for ${getCourseName(selectedCourseFilter)}`
                : "Add Your First Exercise"}
            </Button>
          )}
        </div>
      )}
      
      {/* Edit Exercise Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Exercise</DialogTitle>
            <DialogDescription>
              Update the exercise details and due date.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-course">Course</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map(course => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-title">Exercise Title</Label>
              <Input
                id="edit-title"
                placeholder="Exercise title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Exercise description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-dueDate">Due Date</Label>
              <Input
                id="edit-dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
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
            <Button 
              onClick={handleEditExercise}
              disabled={!title || !courseId || !dueDate}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Exercise Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Exercise</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {currentExercise?.title}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteExercise}>
              Delete Exercise
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Exercises;


import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses, Exam } from "@/contexts/CourseContext";
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
  Calendar, 
  Eye, 
  EyeOff, 
  Edit, 
  Trash, 
  Trash2,
  Plus,
  PlusCircle,
  Clock,
  LayoutGrid,
  LayoutList,
  BookOpen,
  Settings,
  Play
} from "lucide-react";
import QuizBuilder from "@/components/QuizBuilder";
import QuizTaker from "@/components/QuizTaker";
import { format } from "date-fns";
import { useLocation, useNavigate } from "react-router-dom";
import ViewToggle from "@/components/ViewToggle";

const Exams = () => {
  const { user } = useAuth();
  const { 
    courses, 
    exams, 
    enrollments,
    addExam, 
    updateExam, 
    deleteExam, 
    toggleExamVisibility,
    getVisibleExamsForStudent 
  } = useCourses();
  
  const location = useLocation();
  const navigate = useNavigate();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState("");
  const [examDate, setExamDate] = useState("");
  const [examTime, setExamTime] = useState("");
  const [duration, setDuration] = useState(60);
  const [isVisible, setIsVisible] = useState(true);
  const [examType, setExamType] = useState<"exam" | "quiz">("exam");
  const [currentExam, setCurrentExam] = useState<Exam | null>(null);
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>("all");
  const [showQuizBuilder, setShowQuizBuilder] = useState<string | null>(null);
  const [showQuizTaker, setShowQuizTaker] = useState<Exam | null>(null);
  
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
      navigate('/exams');
    } else {
      navigate(`/exams?course=${courseId}`);
    }
  };
  
  // Filter exams based on user role and selected course
  const userExams = isProfessor ? exams : (user ? getVisibleExamsForStudent(user.id) : []);
  const displayedExams = selectedCourseFilter === "all" 
    ? userExams 
    : userExams.filter(exam => exam.course_id === selectedCourseFilter);

  // Filter courses based on user role for the course dropdown
  const availableCourses = isProfessor 
    ? courses 
    : courses.filter(course => 
        course.is_visible && user && enrollments.some(e => e.course_id === course.id && e.student_id === user.id)
      );

  // Reset form
  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCourseId("");
    setExamDate("");
    setExamTime("");
    setDuration(60);
    setIsVisible(true);
    setExamType("exam");
    setCurrentExam(null);
  };

  // Format date for input field
  const formatDateForInput = (dateString: string) => {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  // Format time for input field
  const formatTimeForInput = (dateString: string) => {
    const date = new Date(dateString);
    return date.toISOString().split('T')[1].substring(0, 5);
  };

  // Combine date and time to ISO string
  const combineDateTime = (date: string, time: string) => {
    return new Date(`${date}T${time}:00`).toISOString();
  };

  // Add new exam
  const handleAddExam = async () => {
    const success = await addExam({
      title,
      description,
      course_id: courseId,
      exam_date: combineDateTime(examDate, examTime),
      duration_minutes: duration,
      is_visible: isVisible,
      type: examType
    });
    
    if (success) {
      setIsAddDialogOpen(false);
      resetForm();
    }
  };

  // Edit exam
  const handleEditExam = async () => {
    if (currentExam) {
      const success = await updateExam(currentExam.id, {
        title,
        description,
        course_id: courseId,
        exam_date: combineDateTime(examDate, examTime),
        duration_minutes: duration,
        is_visible: isVisible,
        type: examType
      });
      
      if (success) {
        setIsEditDialogOpen(false);
        resetForm();
      }
    }
  };

  // Delete exam
  const handleDeleteExam = () => {
    if (currentExam) {
      deleteExam(currentExam.id);
      setIsDeleteDialogOpen(false);
      resetForm();
    }
  };

  // Open edit dialog with exam data
  const openEditDialog = (exam: Exam) => {
    setCurrentExam(exam);
    setTitle(exam.title);
    setDescription(exam.description);
    setCourseId(exam.course_id);
    setExamDate(formatDateForInput(exam.exam_date));
    setExamTime(formatTimeForInput(exam.exam_date));
    setDuration(exam.duration_minutes);
    setIsVisible(exam.is_visible);
    setExamType(exam.type);
    setIsEditDialogOpen(true);
  };

  // Open delete confirmation dialog
  const openDeleteDialog = (exam: Exam) => {
    setCurrentExam(exam);
    setIsDeleteDialogOpen(true);
  };

  // Toggle exam visibility
  const handleToggleVisibility = (examId: string) => {
    toggleExamVisibility(examId);
  };

  // Get course name from ID
  const getCourseName = (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    return course ? course.title : "Unknown Course";
  };

  // Format exam date and time
  const formatExamDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), "PPP 'at' p");
    } catch (error) {
      return "Invalid date";
    }
  };

  // Format duration in hours and minutes
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0 && mins > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ${mins} minute${mins > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      return `${mins} minute${mins > 1 ? 's' : ''}`;
    }
  };

  // Check if exam date is in the past
  const isPastExam = (dateString: string) => {
    const now = new Date();
    const examDate = new Date(dateString);
    return examDate < now;
  };


  // Handle course filter change
  const handleCourseFilterChange = (courseId: string) => {
    setSelectedCourseFilter(courseId);
    updateUrlWithFilter(courseId);
  };

  // Set initial courseId for new exam form if a course is selected
  useEffect(() => {
    if (selectedCourseFilter !== "all" && selectedCourseFilter && isAddDialogOpen) {
      setCourseId(selectedCourseFilter);
    }
  }, [selectedCourseFilter, isAddDialogOpen]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Exams</h1>
          <p className="text-muted-foreground mt-1">
            {isProfessor 
              ? "Manage exams and tests for your courses" 
              : "View your upcoming and past exams"}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <ViewToggle
            view={viewMode}
            onViewChange={(view) => setViewMode(view)}
          />
          
          {isProfessor && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Exam
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Schedule New Exam</DialogTitle>
                  <DialogDescription>
                    Create a new exam for one of your courses.
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
                    <Label htmlFor="title">Exam Title</Label>
                    <Input
                      id="title"
                      placeholder="e.g., Midterm Exam"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Enter exam description and topics covered"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="examDate">Exam Date</Label>
                      <Input
                        id="examDate"
                        type="date"
                        value={examDate}
                        onChange={(e) => setExamDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="examTime">Start Time</Label>
                      <Input
                        id="examTime"
                        type="time"
                        value={examTime}
                        onChange={(e) => setExamTime(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="examType">Type</Label>
                    <Select value={examType} onValueChange={(value: "exam" | "quiz") => setExamType(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="exam">Regular Exam</SelectItem>
                        <SelectItem value="quiz">Quiz</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (minutes)</Label>
                    <Input
                      id="duration"
                      type="number"
                      min="15"
                      step="15"
                      value={duration}
                      onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
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
                    onClick={handleAddExam}
                    disabled={!title || !courseId || !examDate || !examTime}
                  >
                    {examType === 'quiz' ? 'Create Quiz' : 'Schedule Exam'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Quiz Builder Modal */}
      {showQuizBuilder && (
        <Dialog open={!!showQuizBuilder} onOpenChange={() => setShowQuizBuilder(null)}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden p-0">
            <div className="h-full overflow-y-auto p-6">
              <QuizBuilder examId={showQuizBuilder} onClose={() => setShowQuizBuilder(null)} />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Quiz Taker Modal */}
      {showQuizTaker && (
        <Dialog open={!!showQuizTaker} onOpenChange={() => setShowQuizTaker(null)}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden p-0">
            <div className="h-full overflow-y-auto p-6">
              <QuizTaker exam={showQuizTaker} onClose={() => setShowQuizTaker(null)} />
            </div>
          </DialogContent>
        </Dialog>
      )}

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
          Showing {displayedExams.length} {displayedExams.length === 1 ? "exam" : "exams"}
          {selectedCourseFilter !== "all" && " for " + getCourseName(selectedCourseFilter)}
        </p>
      </div>

      {displayedExams.length > 0 ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedExams.map((exam) => (
              <Card key={exam.id} className="overflow-hidden card-hover">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle>{exam.title}</CardTitle>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={exam.type === 'quiz' ? 'default' : 'secondary'}>
                        {exam.type === 'quiz' ? 'Quiz' : 'Exam'}
                      </Badge>
                      {!exam.is_visible && (
                        <Badge variant="outline">Hidden</Badge>
                      )}
                      {isPastExam(exam.exam_date) ? (
                        <Badge variant="secondary">Past</Badge>
                      ) : (
                        <Badge>Upcoming</Badge>
                      )}
                    </div>
                  </div>
                  <CardDescription className="mt-1">
                    {getCourseName(exam.course_id)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-3">
                  <p className="text-sm mb-3">{exam.description}</p>
                  <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      <span>{formatExamDateTime(exam.exam_date)}</span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      <span>Duration: {formatDuration(exam.duration_minutes)}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="border-t bg-muted/30 px-6 py-3">
                  <div className="flex justify-between w-full">
                    {isProfessor ? (
                      <>
                        <div className="flex gap-2">
                          {exam.type === 'quiz' && (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => setShowQuizBuilder(exam.id)}
                              title="Manage quiz questions"
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleToggleVisibility(exam.id)}
                            title={exam.is_visible ? "Hide from students" : "Make visible to students"}
                          >
                            {exam.is_visible ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => openEditDialog(exam)}
                            title="Edit exam"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => openDeleteDialog(exam)}
                            title="Delete exam"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    ) : exam.type === 'quiz' && !isPastExam(exam.exam_date) && (
                      <div className="flex justify-end w-full">
                        <Button 
                          size="sm"
                          onClick={() => setShowQuizTaker(exam)}
                          className="flex items-center gap-2"
                        >
                          <Play className="h-4 w-4" />
                          Take Quiz
                        </Button>
                      </div>
                    )}
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="border rounded-lg">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-4 text-left font-medium">Exam</th>
                  <th className="p-4 text-left font-medium">Course</th>
                  <th className="p-4 text-left font-medium">Date & Time</th>
                  <th className="p-4 text-left font-medium">Duration</th>
                  <th className="p-4 text-left font-medium">Type</th>
                  <th className="p-4 text-left font-medium">Status</th>
                  {isProfessor && <th className="p-4 text-left font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {displayedExams.map((exam) => (
                  <tr key={exam.id} className="border-t">
                    <td className="p-4">
                      <div>
                        <h3 className="font-medium">{exam.title}</h3>
                        <p className="text-sm text-muted-foreground">{exam.description}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <BookOpen className="h-4 w-4 text-blue-600" />
                        <span className="text-sm">{getCourseName(exam.course_id)}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        <div>{format(new Date(exam.exam_date), "PPP")}</div>
                        <div className="text-muted-foreground">{format(new Date(exam.exam_date), "p")}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{exam.duration_minutes}min</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant={exam.type === 'quiz' ? 'default' : 'secondary'}>
                        {exam.type === 'quiz' ? 'Quiz' : 'Exam'}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        {isPastExam(exam.exam_date) ? (
                          <Badge variant="outline" className="w-fit">Past</Badge>
                        ) : (
                          <Badge variant="default" className="w-fit">Upcoming</Badge>
                        )}
                        {!exam.is_visible && (
                          <Badge variant="outline" className="w-fit">Hidden</Badge>
                        )}
                      </div>
                    </td>
                    {isProfessor && (
                      <td className="p-4">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setShowQuizBuilder(exam.id)}
                          >
                            <PlusCircle className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEditDialog(exam)}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => openDeleteDialog(exam)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center py-12 border rounded-lg bg-muted/30">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-medium">No exams found</h3>
          <p className="text-muted-foreground text-center max-w-md mt-2">
            {isProfessor 
              ? selectedCourseFilter !== "all" 
                ? `You haven't scheduled any exams for ${getCourseName(selectedCourseFilter)} yet.`
                : "You haven't scheduled any exams yet. Add your first exam to get started."
              : selectedCourseFilter !== "all"
                ? `No exams are currently scheduled for ${getCourseName(selectedCourseFilter)}.`
                : "You don't have any exams scheduled yet."}
          </p>
          {isProfessor && (
            <Button className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {selectedCourseFilter !== "all" 
                ? `Schedule Exam for ${getCourseName(selectedCourseFilter)}`
                : "Schedule Your First Exam"}
            </Button>
          )}
        </div>
      )}
      
      {/* Edit Exam Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Exam</DialogTitle>
            <DialogDescription>
              Update the exam details and schedule.
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
              <Label htmlFor="edit-title">Exam Title</Label>
              <Input
                id="edit-title"
                placeholder="Exam title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Exam description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-examDate">Exam Date</Label>
                <Input
                  id="edit-examDate"
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-examTime">Start Time</Label>
                <Input
                  id="edit-examTime"
                  type="time"
                  value={examTime}
                  onChange={(e) => setExamTime(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-duration">Duration (minutes)</Label>
              <Input
                id="edit-duration"
                type="number"
                min="15"
                step="15"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
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
              onClick={handleEditExam}
              disabled={!title || !courseId || !examDate || !examTime}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Exam Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Exam</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {currentExam?.title}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteExam}>
              Delete Exam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Exams;

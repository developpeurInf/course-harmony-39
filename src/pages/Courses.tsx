
import { useState, useEffect } from "react";
import { useAuth, UserProfile } from "@/contexts/AuthContext";
import { useCourses, Course } from "@/contexts/CourseContext";
import MultiPdfUpload from "@/components/MultiPdfUpload";
import { iosCompatibleDownload } from "@/lib/download";
import CourseMaterials from "@/components/CourseMaterials";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
  Trash2,
  Plus,
  Users,
  UserPlus,
  FileText,
  Calendar,
  LayoutGrid,
  LayoutList,
  Building,
  Download,
  File
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate, useLocation } from "react-router-dom";
import ViewToggle from "@/components/ViewToggle";
import { useLanguage } from "@/contexts/LanguageContext";

const Courses = () => {
  const { user, getStudents } = useAuth();
  const { t, language } = useLanguage();
  const { 
    rooms,
    courses, 
    exercises,
    exams,
    enrollments,
    addCourse, 
    updateCourse, 
    deleteCourse, 
    toggleCourseVisibility,
    enrollStudent,
    unenrollStudent,
    getVisibleCoursesForStudent,
    getEnrolledStudents
  } = useCourses();
  
  const location = useLocation();
  const navigate = useNavigate();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEnrollDialogOpen, setIsEnrollDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [selectedPdfFiles, setSelectedPdfFiles] = useState<File[]>([]);
  const [courseMaterials, setCourseMaterials] = useState<{[courseId: string]: any[]}>({});
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [roomId, setRoomId] = useState("");
  const [isVisible, setIsVisible] = useState(true);
  const [currentCourse, setCurrentCourse] = useState<Course | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>("all");
  
  const [students, setStudents] = useState<UserProfile[]>([]);
  
  // Load students
  useEffect(() => {
    const loadStudents = async () => {
      const studentList = await getStudents();
      setStudents(studentList);
    };
    loadStudents();
  }, [getStudents]);
  const isProfessor = user?.role === "professor";
  
  // Parse room ID from URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const roomParam = params.get('room');
    if (roomParam && rooms.some(r => r.id === roomParam)) {
      setSelectedRoomFilter(roomParam);
    }
  }, [location.search, rooms]);
  
  // Update URL when filter changes
  const updateUrlWithFilter = (roomId: string) => {
    if (roomId === "all") {
      navigate('/courses');
    } else {
      navigate(`/courses?room=${roomId}`);
    }
  };
  
  // Filter courses based on user role and selected room
  const userCourses = isProfessor 
    ? courses 
    : (user ? getVisibleCoursesForStudent(user.id) : []);
  
  const displayedCourses = selectedRoomFilter === "all" 
    ? userCourses 
    : userCourses.filter(course => course.room_id === selectedRoomFilter);

  // Fetch course materials
  const fetchCourseMaterials = async (courseId: string) => {
    const { data, error } = await supabase
      .from('course_materials')
      .select('*')
      .eq('course_id', courseId)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Error fetching course materials:', error);
      return [];
    }
    return data || [];
  };

  // Load course materials for all courses
  const loadCourseMaterials = async () => {
    if (!courses) return;
    
    const materialsMap: {[courseId: string]: any[]} = {};
    
    for (const course of courses) {
      materialsMap[course.id] = await fetchCourseMaterials(course.id);
    }
    
    setCourseMaterials(materialsMap);
  };

  // Reset form
  const resetForm = () => {
    setTitle("");
    setDescription("");
    setRoomId("");
    setIsVisible(true);
    setCurrentCourse(null);
    setSelectedStudentId("");
    setSelectedPdfFiles([]);
  };

  // Add new course
  const handleAddCourse = async () => {
    // Create the course first
    const newCourse = await addCourse({
      title,
      description,
      is_visible: isVisible,
      room_id: roomId || undefined
    });
    if (!newCourse) return;

    // Upload PDFs if selected
    if (selectedPdfFiles.length > 0 && user) {
      for (const file of selectedPdfFiles) {
        try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `courses/${newCourse.id}/${fileName}`;
          
          const { error: uploadError } = await supabase.storage
            .from('course-materials')
            .upload(filePath, file, { upsert: true });
          
          if (uploadError) {
            console.error('Upload error:', uploadError);
            toast.error(`Failed to upload ${file.name}`);
            continue;
          }

          const { data: publicUrlData } = supabase.storage
            .from('course-materials')
            .getPublicUrl(filePath);
          
          // Save file info to course_materials table
          const { error: dbError } = await supabase
            .from('course_materials')
            .insert({
              course_id: newCourse.id,
              file_name: file.name,
              file_path: filePath,
              file_size: file.size,
              uploaded_by: user.id
            });

          if (dbError) {
            console.error('DB error:', dbError);
            toast.error(`Failed to save ${file.name} info`);
          }

          // Also set pdf_url on course for fast direct viewing
          await supabase
            .from('courses')
            .update({ pdf_url: publicUrlData.publicUrl })
            .eq('id', newCourse.id);

        } catch (error) {
          console.error('Error uploading PDF:', error);
          toast.error(`Failed to upload ${file.name}`);
        }
      }
    }

    setIsAddDialogOpen(false);
    resetForm();
    await loadCourseMaterials(); // Refresh materials
  };

  // Edit course
  const handleEditCourse = async () => {
    if (currentCourse) {
      const success = await updateCourse(currentCourse.id, {
        title,
        description,
        room_id: roomId || undefined,
        is_visible: isVisible
      });

      // Upload new PDFs if selected
      if (selectedPdfFiles.length > 0 && user && success) {
        for (const file of selectedPdfFiles) {
          try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `courses/${currentCourse.id}/${fileName}`;
            
            const { error: uploadError } = await supabase.storage
              .from('course-materials')
              .upload(filePath, file, { upsert: true });
            
            if (uploadError) {
              console.error('Upload error:', uploadError);
              toast.error(`Failed to upload ${file.name}`);
              continue;
            }

            const { data: publicUrlData } = supabase.storage
              .from('course-materials')
              .getPublicUrl(filePath);
            
            // Save file info to course_materials table
            const { error: dbError } = await supabase
              .from('course_materials')
              .insert({
                course_id: currentCourse.id,
                file_name: file.name,
                file_path: filePath,
                file_size: file.size,
                uploaded_by: user.id
              });

            if (dbError) {
              console.error('DB error:', dbError);
              toast.error(`Failed to save ${file.name} info`);
            }

            await supabase
              .from('courses')
              .update({ pdf_url: publicUrlData.publicUrl })
              .eq('id', currentCourse.id);

          } catch (error) {
            console.error('Error uploading PDF:', error);
            toast.error(`Failed to upload ${file.name}`);
          }
        }
        await loadCourseMaterials(); // Refresh materials
      }

      setIsEditDialogOpen(false);
      resetForm();
    }
  };

  // Delete course
  const handleDeleteCourse = async () => {
    if (currentCourse) {
      await deleteCourse(currentCourse.id);
      setIsDeleteDialogOpen(false);
      resetForm();
    }
  };

  // Open edit dialog with course data
  const openEditDialog = (course: Course) => {
    setCurrentCourse(course);
    setTitle(course.title);
    setDescription(course.description);
    setRoomId(course.room_id || "");
    setIsVisible(course.is_visible);
    setSelectedPdfFiles([]); // Reset selected files for edit
    setIsEditDialogOpen(true);
  };

  // Open delete confirmation dialog
  const openDeleteDialog = (course: Course) => {
    setCurrentCourse(course);
    setIsDeleteDialogOpen(true);
  };

  // Open enrollment dialog
  const openEnrollDialog = async (course: Course) => {
    setCurrentCourse(course);
    const students = await getEnrolledStudents(course.id);
    setEnrolledStudents(students);
    setIsEnrollDialogOpen(true);
  };

  // Handle enrollment
  const handleEnrollStudent = async () => {
    if (currentCourse && selectedStudentId) {
      const success = await enrollStudent(currentCourse.id, selectedStudentId);
      if (success) {
        // Refresh enrolled students list
        const students = await getEnrolledStudents(currentCourse.id);
        setEnrolledStudents(students);
        setSelectedStudentId("");
      }
    }
  };

  // Handle unenrollment
  const handleUnenrollStudent = async (courseId: string, studentId: string) => {
    const success = await unenrollStudent(courseId, studentId);
    if (success && currentCourse) {
      // Refresh enrolled students list
      const students = await getEnrolledStudents(currentCourse.id);
      setEnrolledStudents(students);
    }
  };

  // Toggle course visibility
  const handleToggleVisibility = (courseId: string) => {
    toggleCourseVisibility(courseId);
  };


  // Get course statistics
  const getCourseStats = (courseId: string) => {
    const courseExercises = exercises.filter(e => e.course_id === courseId);
    const courseExams = exams.filter(e => e.course_id === courseId);
    
    return {
      exerciseCount: courseExercises.length,
      examCount: courseExams.length
    };
  };

  // Get enrollment count for a course
  const getEnrollmentCount = (courseId: string) => {
    return enrollments.filter(e => e.course_id === courseId).length;
  };

  // Get room name from ID
  const getRoomName = (roomId?: string) => {
    if (!roomId) return "No Room";
    const room = rooms.find(r => r.id === roomId);
    return room ? room.name : "Unknown Room";
  };

  // Navigate to filtered exercises/exams for a course
  const navigateToExercises = (courseId: string) => {
    navigate(`/exercises?course=${courseId}`);
  };

  const navigateToExams = (courseId: string) => {
    navigate(`/exams?course=${courseId}`);
  };

  // Handle PDF view/download
  const handleViewPdf = (pdfUrl: string) => {
    window.open(pdfUrl, '_blank');
  };

  const handleDownloadPdf = (pdfUrl: string, courseName: string) => {
    try {
      const filename = `${courseName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_materials.pdf`;
      let downloadUrl = pdfUrl;
      if (downloadUrl.includes('supabase.co/storage/v1/object/public') && !downloadUrl.includes('download=')) {
        downloadUrl += `${downloadUrl.includes('?') ? '&' : '?'}download=${encodeURIComponent(filename)}`;
      }
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      toast.error("Failed to download PDF");
    }
  };

  // Handle room filter change
  const handleRoomFilterChange = (roomId: string) => {
    setSelectedRoomFilter(roomId);
    updateUrlWithFilter(roomId);
  };

  // Set initial roomId for new course form if a room is selected
  useEffect(() => {
    if (selectedRoomFilter !== "all" && selectedRoomFilter) {
      setRoomId(selectedRoomFilter);
    }
  }, [selectedRoomFilter, isAddDialogOpen]);

  // Load course materials when courses change
  useEffect(() => {
    if (courses && courses.length > 0) {
      loadCourseMaterials();
    }
  }, [courses]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{language === "ar" ? "الدروس" : "Courses"}</h1>
          <p className="text-muted-foreground mt-1">
            {isProfessor 
              ? (language === "ar" ? "إدارة دروسك وتسجيلات التلاميذ" : "Manage your courses and student enrollments") 
              : (language === "ar" ? "عرض الدروس المسجل بها" : "View courses you're enrolled in")}
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
                  {language === "ar" ? "إضافة درس" : "Add Course"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{language === "ar" ? "إضافة درس جديد" : "Add New Course"}</DialogTitle>
                  <DialogDescription>
                    {language === "ar" ? "إنشاء درس جديد وإتاحته للتلاميذ." : "Create a new course and make it available to students."}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="room">{language === "ar" ? "القسم (اختياري)" : "Room (Optional)"}</Label>
                    <Select value={roomId} onValueChange={setRoomId}>
                      <SelectTrigger>
                        <SelectValue placeholder={language === "ar" ? "اختر قسمًا (اختياري)" : "Select a room (optional)"} />
                      </SelectTrigger>
                      <SelectContent>
                        {rooms.map(room => (
                          <SelectItem key={room.id} value={room.id}>
                            {room.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="title">{language === "ar" ? "عنوان الدرس" : "Course Title"}</Label>
                    <Input
                      id="title"
                      placeholder={language === "ar" ? "مثال: الرياضيات المتقدمة" : "e.g., Introduction to Computer Science"}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">{language === "ar" ? "الوصف" : "Description"}</Label>
                    <Textarea
                      id="description"
                      placeholder={language === "ar" ? "أدخل وصف الدرس" : "Enter course description"}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === "ar" ? "مواد الدرس (ملفات PDF)" : "Course Materials (PDFs)"}</Label>
                    <MultiPdfUpload
                      onFilesChange={setSelectedPdfFiles}
                      selectedFiles={selectedPdfFiles}
                      maxFiles={5}
                      maxSizeMB={50}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="visibility"
                      checked={isVisible}
                      onCheckedChange={setIsVisible}
                    />
                    <Label htmlFor="visibility">{language === "ar" ? "مرئي للتلاميذ" : "Visible to students"}</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    {language === "ar" ? "إلغاء" : "Cancel"}
                  </Button>
                  <Button onClick={handleAddCourse} disabled={!title}>
                    {language === "ar" ? "إنشاء الدرس" : "Create Course"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Room filter - Only for professors */}
      {isProfessor && (
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
          <div className="w-full sm:w-64">
            <Select value={selectedRoomFilter} onValueChange={handleRoomFilterChange}>
              <SelectTrigger>
                <SelectValue placeholder={language === "ar" ? "تصفية حسب القسم" : "Filter by room"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === "ar" ? "جميع الأقسام" : "All Rooms"}</SelectItem>
                {rooms.map(room => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            {language === "ar"
              ? `عرض ${displayedCourses.length} من الدروس${selectedRoomFilter !== "all" ? " في " + getRoomName(selectedRoomFilter) : ""}`
              : `Showing ${displayedCourses.length} ${displayedCourses.length === 1 ? "course" : "courses"}${selectedRoomFilter !== "all" ? " in " + getRoomName(selectedRoomFilter) : ""}`}
          </p>
        </div>
      )}
      
      {/* Course count for students */}
      {!isProfessor && (
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            {language === "ar"
              ? `أنت مسجل في ${displayedCourses.length} ${displayedCourses.length === 1 ? "درس" : "دروس"}`
              : `You are enrolled in ${displayedCourses.length} ${displayedCourses.length === 1 ? "course" : "courses"}`}
          </p>
        </div>
      )}

      {displayedCourses.length > 0 ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedCourses.map((course) => {
              const stats = getCourseStats(course.id);
              const enrollmentCount = getEnrollmentCount(course.id);
              
              return (
                <Card key={course.id} className="overflow-hidden card-hover">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle>{course.title}</CardTitle>
                      {!course.is_visible && (
                        <Badge variant="outline">{language === "ar" ? "مخفي" : "Hidden"}</Badge>
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
                          <span>{enrollmentCount} {language === "ar" ? "تلاميذ" : "students"}</span>
                        </div>
                      </div>
                      
                      {course.room_id && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Building className="h-4 w-4 mr-1" />
                          <span>{language === "ar" ? "القسم: " : "Room: "}{getRoomName(course.room_id)}</span>
                        </div>
                      )}
                      
                      <div className="flex flex-wrap gap-3 mt-3">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7"
                          onClick={() => navigateToExercises(course.id)}
                        >
                          <FileText className="h-3.5 w-3.5 mr-1" />
                          {stats.exerciseCount} {language === "ar" ? "تمارين" : (stats.exerciseCount === 1 ? "Exercise" : "Exercises")}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7"
                          onClick={() => navigateToExams(course.id)}
                        >
                          <Calendar className="h-3.5 w-3.5 mr-1" />
                          {stats.examCount} {language === "ar" ? "امتحانات" : (stats.examCount === 1 ? "Exam" : "Exams")}
                        </Button>
                        {(course.pdf_url || (courseMaterials[course.id] && courseMaterials[course.id].length > 0)) && (
                          courseMaterials[course.id] && courseMaterials[course.id].length > 0 ? (
                            <CourseMaterials 
                              materials={courseMaterials[course.id]} 
                              compact={true}
                            />
                          ) : course.pdf_url ? (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-7"
                              onClick={() => handleViewPdf(course.pdf_url!)}
                            >
                              <File className="h-3.5 w-3.5 mr-1" />
                              {language === "ar" ? "المواد" : "Materials"}
                            </Button>
                          ) : null
                        )}
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
                          title={course.is_visible ? "Hide from students" : "Make visible to students"}
                        >
                          {course.is_visible ? (
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
          <div className="border rounded-lg">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-4 text-left font-medium">{language === "ar" ? "الدرس" : "Course"}</th>
                  <th className="p-4 text-left font-medium">{language === "ar" ? "القسم" : "Room"}</th>
                  <th className="p-4 text-left font-medium">{language === "ar" ? "التلاميذ" : "Students"}</th>
                  <th className="p-4 text-left font-medium">{language === "ar" ? "التمارين" : "Exercises"}</th>
                  <th className="p-4 text-left font-medium">{language === "ar" ? "الامتحانات" : "Exams"}</th>
                  <th className="p-4 text-left font-medium">{language === "ar" ? "الرؤية" : "Visibility"}</th>
                  {isProfessor && <th className="p-4 text-left font-medium">{language === "ar" ? "الإجراءات" : "Actions"}</th>}
                </tr>
              </thead>
              <tbody>
                {displayedCourses.map((course) => {
                  const stats = getCourseStats(course.id);
                  const enrollmentCount = getEnrollmentCount(course.id);
                  
                  return (
                    <tr key={course.id} className="border-t">
                      <td className="p-4">
                        <div>
                          <h3 className="font-medium">{course.title}</h3>
                          <p className="text-sm text-muted-foreground">{course.description}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {course.room_id ? getRoomName(course.room_id) : "No Room"}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-blue-600" />
                          <span>{enrollmentCount}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => navigateToExercises(course.id)}
                          className="h-7"
                        >
                          <FileText className="h-3.5 w-3.5 mr-1" />
                          {stats.exerciseCount}
                        </Button>
                      </td>
                      <td className="p-4">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => navigateToExams(course.id)}
                          className="h-7"
                        >
                          <Calendar className="h-3.5 w-3.5 mr-1" />
                          {stats.examCount}
                        </Button>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          course.is_visible ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"
                        }`}>
                          {course.is_visible ? (language === "ar" ? "مرئي" : "Visible") : (language === "ar" ? "مخفي" : "Hidden")}
                        </span>
                      </td>
                      {isProfessor && (
                        <td className="p-4">
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleToggleVisibility(course.id)}
                              title={course.is_visible ? "Hide from students" : "Make visible to students"}
                            >
                              {course.is_visible ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEnrollDialog(course)}
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEditDialog(course)}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => openDeleteDialog(course)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center py-12 border rounded-lg bg-muted/30">
          <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-medium">
            {language === "ar" ? "لم يتم العثور على دروس" : "No courses found"}
          </h3>
          <p className="text-muted-foreground text-center max-w-md mt-2">
            {language === "ar"
              ? isProfessor
                ? selectedRoomFilter !== "all"
                  ? `لا توجد دروس في ${getRoomName(selectedRoomFilter)} بعد.`
                  : "لم تقم بإنشاء أي دروس بعد. أضف أول درس للبدء."
                : selectedRoomFilter !== "all"
                  ? `أنت غير مسجل في أي دروس في ${getRoomName(selectedRoomFilter)}.`
                  : "لم تسجل في أي دروس بعد. تواصل مع أستاذك للتسجيل."
              : isProfessor 
                ? selectedRoomFilter !== "all"
                  ? `There are no courses in ${getRoomName(selectedRoomFilter)} yet.`
                  : "You haven't created any courses yet. Add your first course to get started."
                : selectedRoomFilter !== "all"
                  ? `You are not enrolled in any courses in ${getRoomName(selectedRoomFilter)}.`
                  : "You are not enrolled in any courses yet. Contact your professor for enrollment."}
          </p>
          {isProfessor && (
            <Button className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {language === "ar"
                ? selectedRoomFilter !== "all"
                  ? `إضافة درس إلى ${getRoomName(selectedRoomFilter)}`
                  : "إضافة أول درس"
                : selectedRoomFilter !== "all" 
                  ? `Add Course to ${getRoomName(selectedRoomFilter)}`
                  : "Add Your First Course"}
            </Button>
          )}
        </div>
      )}
      
      {/* Edit Course Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "تعديل الدرس" : "Edit Course"}</DialogTitle>
            <DialogDescription>
              {language === "ar" ? "تحديث تفاصيل الدرس والرؤية." : "Update the course details and visibility."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-room">{language === "ar" ? "القسم (اختياري)" : "Room (Optional)"}</Label>
              <Select value={roomId} onValueChange={setRoomId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a room (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map(room => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-title">{language === "ar" ? "عنوان الدرس" : "Course Title"}</Label>
              <Input
                id="edit-title"
                placeholder={language === "ar" ? "عنوان الدرس" : "Course title"}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">{language === "ar" ? "الوصف" : "Description"}</Label>
              <Textarea
                id="edit-description"
                placeholder={language === "ar" ? "وصف الدرس" : "Course description"}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Course Materials (PDFs)</Label>
              <MultiPdfUpload
                onFilesChange={setSelectedPdfFiles}
                selectedFiles={selectedPdfFiles}
                maxFiles={5}
                maxSizeMB={50}
                existingFiles={courseMaterials[currentCourse?.id || ''] || []}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-visibility"
                checked={isVisible}
                onCheckedChange={setIsVisible}
              />
              <Label htmlFor="edit-visibility">{language === "ar" ? "مرئي للتلاميذ" : "Visible to students"}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleEditCourse}>
              {language === "ar" ? "حفظ التغييرات" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Course Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "حذف الدرس" : "Delete Course"}</DialogTitle>
            <DialogDescription>
              {language === "ar" ? `هل أنت متأكد من رغبتك في حذف ${currentCourse?.title}؟ لا يمكن التراجع عن هذا الإجراء وسيتم حذف جميع التمارين والامتحانات المرتبطة به.` : `Are you sure you want to delete ${currentCourse?.title}? This action cannot be undone and will also delete all associated exercises and exams.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={handleDeleteCourse}>
              {language === "ar" ? "حذف الدرس" : "Delete Course"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enrollment Dialog */}
      <Dialog open={isEnrollDialogOpen} onOpenChange={setIsEnrollDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "إدارة التلاميذ" : "Manage Students"}</DialogTitle>
            <DialogDescription>
              {language === "ar" ? `تسجيل أو إلغاء تسجيل التلاميذ في ${currentCourse?.title}.` : `Enroll or unenroll students for ${currentCourse?.title}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Add student */}
            <div className="space-y-2">
              <Label>{language === "ar" ? "إضافة تلميذ" : "Add student"}</Label>
              <div className="flex space-x-2">
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={language === "ar" ? "اختر تلميذًا" : "Select a student"} />
                  </SelectTrigger>
                  <SelectContent>
                    {students.filter(student => 
                      !enrolledStudents.some(enrolled => enrolled.id === student.id)
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
              <Label>{language === "ar" ? "التلاميذ المسجلون" : "Enrolled students"}</Label>
              <div className="border rounded-md overflow-hidden">
                {enrolledStudents.length === 0 ? (
                  <div className="p-3 text-center text-muted-foreground">
                    {language === "ar" ? "لم يتم تسجيل أي تلميذ بعد" : "No students enrolled yet"}
                  </div>
                ) : (
                  <ul className="divide-y">
                    {enrolledStudents.map(student => (
                      <li key={student.id} className="flex justify-between items-center p-3">
                        <span>{student.name}</span>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => currentCourse && handleUnenrollStudent(currentCourse.id, student.id)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsEnrollDialogOpen(false)}>
              {language === "ar" ? "تم" : "Done"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Courses;

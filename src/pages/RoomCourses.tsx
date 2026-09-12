import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useAuth, UserProfile } from "@/contexts/AuthContext";
import { useCourses, Course, Room } from "@/contexts/CourseContext";
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
  Grid3x3,
  List,
  FileText
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import MultiPdfUpload from "@/components/MultiPdfUpload";
import CourseMaterials from "@/components/CourseMaterials";
import { useLanguage } from "@/contexts/LanguageContext";

interface CourseMaterial {
  id: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  uploaded_at: string;
}

const RoomCourses = () => {
  const { roomId } = useParams();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { 
    rooms, 
    courses, 
    refreshData, 
    addCourse, 
    updateCourse, 
    deleteCourse, 
    toggleCourseVisibility 
  } = useCourses();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isVisible, setIsVisible] = useState(true);
  const [currentCourse, setCurrentCourse] = useState<Course | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [courseMaterials, setCourseMaterials] = useState<Record<string, CourseMaterial[]>>({});
  const [existingFiles, setExistingFiles] = useState<CourseMaterial[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  
  const isProfessor = user?.role === "professor";
  
  // Load room-specific data when component mounts
  useEffect(() => {
    if (user && roomId) {
      refreshData(roomId);
    }
  }, [user, roomId, refreshData]);

  // Redirect if no roomId
  if (!roomId) {
    return <Navigate to="/dashboard" replace />;
  }
  
  // Get current room
  const currentRoom = rooms.find(room => room.id === roomId);
  
  // Filter courses for current room
  const roomCourses = courses.filter(course => course.room_id === roomId);

  // Load course materials
  const loadCourseMaterials = async () => {
    try {
      if (roomCourses.length === 0) return;
      
      const courseIds = roomCourses.map(course => course.id);
      const { data: materials, error } = await supabase
        .from('course_materials')
        .select('*')
        .in('course_id', courseIds)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;

      // Group materials by course_id
      const materialsByCode: Record<string, CourseMaterial[]> = {};
      materials?.forEach((material) => {
        if (!materialsByCode[material.course_id]) {
          materialsByCode[material.course_id] = [];
        }
        materialsByCode[material.course_id].push(material);
      });

      setCourseMaterials(materialsByCode);
    } catch (error) {
      console.error('Error loading course materials:', error);
    }
  };

  // Load course materials when room courses change
  useEffect(() => {
    if (roomCourses.length > 0) {
      loadCourseMaterials();
    }
  }, [roomCourses]);

  // Load specific course materials
  const loadCourseSpecificMaterials = async (courseId: string) => {
    try {
      const { data: materials, error } = await supabase
        .from('course_materials')
        .select('*')
        .eq('course_id', courseId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      return materials || [];
    } catch (error) {
      console.error('Error loading course materials:', error);
      return [];
    }
  };
  
  // Handle form submission
  const handleAddCourse = async () => {
    if (!title.trim()) {
      toast.error("Course title is required");
      return;
    }

    const newCourse = await addCourse({
      title: title.trim(),
      description: description.trim(),
      room_id: roomId,
      is_visible: isVisible
    });

    if (newCourse && selectedFiles.length > 0) {
      await uploadFiles(newCourse.id);
    }

    if (newCourse) {
      resetForm();
    }
  };

  // Upload files
  const uploadFiles = async (courseId: string) => {
    for (const file of selectedFiles) {
      try {
        // Upload file to storage with proper courses/<course_id>/ path for RLS
        const fileExt = file.name.split('.').pop();
        const safeName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `courses/${courseId}/${safeName}`;
        
        const { data, error: uploadError } = await supabase.storage
          .from('course-materials')
          .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('course-materials')
          .getPublicUrl(filePath);

        // Save file info to database
        const { error: dbError } = await supabase
          .from('course_materials')
          .insert({
            course_id: courseId,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            uploaded_by: user?.id
          });

        if (dbError) throw dbError;

        // Also update course pdf_url for fast direct access
        await supabase
          .from('courses')
          .update({ pdf_url: publicUrlData.publicUrl })
          .eq('id', courseId);

      } catch (error: any) {
        console.error('Error uploading file:', error);
        toast.error(`Failed to upload ${file.name}: ${error.message || ''}`);
      }
    }
    
    // Reload materials after upload
    await loadCourseMaterials();
    toast.success('Course materials uploaded successfully');
  };

  // Reset form
  const resetForm = () => {
    setTitle("");
    setDescription("");
    setIsVisible(true);
    setSelectedFiles([]);
    setExistingFiles([]);
    setIsAddDialogOpen(false);
    setIsEditDialogOpen(false);
    setCurrentCourse(null);
  };
  
  // Handle edit submission
  const handleEditCourse = async () => {
    if (!currentCourse) return;
    
    if (!title.trim()) {
      toast.error("Course title is required");
      return;
    }

    const success = await updateCourse(currentCourse.id, {
      title: title.trim(),
      description: description.trim(),
      is_visible: isVisible
    });

    // Upload new files if any
    if (success && selectedFiles.length > 0) {
      await uploadFiles(currentCourse.id);
    }

    if (success) {
      resetForm();
    }
  };
  
  // Handle delete
  const handleDeleteCourse = async (courseId: string) => {
    const success = await deleteCourse(courseId);
    if (success) {
      // Refresh data to update the view
      refreshData(roomId);
    }
  };
  
  // Open edit dialog
  const openEditDialog = async (course: Course) => {
    setCurrentCourse(course);
    setTitle(course.title);
    setDescription(course.description || "");
    setIsVisible(course.is_visible);
    
    // Load existing materials for this course
    const materials = await loadCourseSpecificMaterials(course.id);
    setExistingFiles(materials);
    
    setIsEditDialogOpen(true);
  };

  // Remove existing file
  const removeExistingFile = async (fileId: string) => {
    try {
      const { error } = await supabase
        .from('course_materials')
        .delete()
        .eq('id', fileId);

      if (error) throw error;

      setExistingFiles(prev => prev.filter(file => file.id !== fileId));
      loadCourseMaterials();
      toast.success('File removed successfully');
    } catch (error) {
      console.error('Error removing file:', error);
      toast.error('Failed to remove file');
    }
  };
  
  if (!currentRoom) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Class not found.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("nav.courses")}</h1>
          <p className="text-muted-foreground mt-1">
            {language === "ar" ? `إدارة وعرض الدروس في ${currentRoom.name}` : `Manage and view courses in ${currentRoom.name}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="h-8"
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="h-8"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          
          {isProfessor && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="shadow-elegant">
                  <Plus className="h-4 w-4 mr-2" />
                  {t("Add Course")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{t("Add New Course")}</DialogTitle>
                  <DialogDescription>
                    {language === "ar" ? `إنشاء درس جديد في ${currentRoom.name}.` : `Create a new course in ${currentRoom.name}.`}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">{language === "ar" ? "عنوان الدرس *" : "Course Title *"}</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={language === "ar" ? "مثال: الرياضيات المتقدمة" : "e.g., Introduction to Computer Science"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">{language === "ar" ? "وصف الدرس" : "Course Description"}</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={language === "ar" ? "قدم وصفاً مفصلاً للمحتوى وأهداف الدرس..." : "Provide a detailed description of the course content, objectives, and what students will learn..."}
                      rows={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === "ar" ? "مواد الدرس (ملفات PDF)" : "Course Materials (PDFs)"}</Label>
                    <MultiPdfUpload
                      selectedFiles={selectedFiles}
                      onFilesChange={setSelectedFiles}
                      maxFiles={10}
                      maxSizeMB={50}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="visible"
                      checked={isVisible}
                      onCheckedChange={setIsVisible}
                    />
                    <Label htmlFor="visible">{language === "ar" ? "جعل الدرس مرئياً للتلاميذ" : "Make course visible to students"}</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={resetForm}>
                    {language === "ar" ? "إلغاء" : "Cancel"}
                  </Button>
                  <Button onClick={handleAddCourse}>{language === "ar" ? "إنشاء الدرس" : "Create Course"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
      
      {/* Courses Display */}
      {roomCourses.length > 0 ? (
        viewMode === 'grid' ? (
          // Grid View
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roomCourses.map((course) => (
              <Card key={course.id} className="group hover:shadow-elegant transition-all duration-300 hover:-translate-y-1">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg line-clamp-2 group-hover:text-primary transition-colors">
                        {course.title}
                      </CardTitle>
                      {course.description && (
                        <CardDescription className="mt-2 line-clamp-2">
                          {course.description}
                        </CardDescription>
                      )}
                    </div>
                    <Badge variant={course.is_visible ? "default" : "secondary"} className="shrink-0">
                      {course.is_visible ? "Visible" : "Hidden"}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>Created {new Date(course.created_at).toLocaleDateString()}</span>
                  </div>
                  
                  {courseMaterials[course.id] && courseMaterials[course.id].length > 0 && (
                    <div className="pt-2 border-t">
                      <CourseMaterials 
                        materials={courseMaterials[course.id]} 
                        compact={true}
                      />
                    </div>
                  )}
                </CardContent>
                
                {isProfessor && (
                  <CardFooter className="pt-3 flex gap-2 border-t bg-muted/30">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleCourseVisibility(course.id)}
                      className="flex-1"
                    >
                      {course.is_visible ? (
                        <>
                          <EyeOff className="h-4 w-4 mr-1" />
                          Hide
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 mr-1" />
                          Show
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(course)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteCourse(course.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                )}
              </Card>
            ))}
          </div>
        ) : (
          // List View
          <div className="space-y-4">
            {roomCourses.map((course) => (
              <Card key={course.id} className="group hover:shadow-elegant transition-all duration-300">
                <div className="flex flex-col md:flex-row">
                  <div className="flex-1 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-3 mb-2">
                          <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                            <BookOpen className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-xl font-semibold group-hover:text-primary transition-colors">
                              {course.title}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              Created {new Date(course.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge variant={course.is_visible ? "default" : "secondary"} className="shrink-0">
                            {course.is_visible ? "Visible" : "Hidden"}
                          </Badge>
                        </div>
                        
                        {course.description && (
                          <p className="text-muted-foreground mt-3 leading-relaxed">
                            {course.description}
                          </p>
                        )}
                        
                        {courseMaterials[course.id] && courseMaterials[course.id].length > 0 && (
                          <div className="mt-4">
                            <CourseMaterials 
                              materials={courseMaterials[course.id]} 
                              compact={false}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {isProfessor && (
                    <div className="flex md:flex-col gap-2 p-4 border-t md:border-t-0 md:border-l bg-muted/30 md:w-32 justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleCourseVisibility(course.id)}
                        className="flex-1 md:flex-none"
                      >
                        {course.is_visible ? (
                          <>
                            <EyeOff className="h-4 w-4 md:mr-0 mr-1" />
                            <span className="md:hidden">Hide</span>
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4 md:mr-0 mr-1" />
                            <span className="md:hidden">Show</span>
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(course)}
                        className="flex-1 md:flex-none"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteCourse(course.id)}
                        className="flex-1 md:flex-none text-destructive hover:text-destructive"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 bg-primary/10 rounded-full mb-4">
              <BookOpen className="h-12 w-12 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t("No courses found")}</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              {isProfessor 
                ? (language === "ar" ? `لا توجد دروس في ${currentRoom.name} بعد. أضف درسك الأول للبدء.` : `There are no courses in ${currentRoom.name} yet. Add your first course to get started.`)
                : (language === "ar" ? `أنت غير مسجل في أي دروس في ${currentRoom.name}.` : `You are not enrolled in any courses in ${currentRoom.name}.`)}
            </p>
            {isProfessor && (
              <Button onClick={() => setIsAddDialogOpen(true)} className="shadow-elegant">
                <Plus className="h-4 w-4 mr-2" />
                {t("Add Your First Course")}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Edit Course Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "تعديل الدرس" : "Edit Course"}</DialogTitle>
            <DialogDescription>
              {language === "ar" ? "تحديث تفاصيل الدرس ورؤيته للتلاميذ." : "Update the course details and visibility."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">{language === "ar" ? "عنوان الدرس *" : "Course Title *"}</Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={language === "ar" ? "مثال: الرياضيات المتقدمة" : "e.g., Introduction to Computer Science"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">{language === "ar" ? "وصف الدرس" : "Course Description"}</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={language === "ar" ? "قدم وصفاً مفصلاً للمحتوى وأهداف الدرس..." : "Provide a detailed description of the course content, objectives, and what students will learn..."}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "مواد الدرس (ملفات PDF)" : "Course Materials (PDFs)"}</Label>
              <MultiPdfUpload
                selectedFiles={selectedFiles}
                onFilesChange={setSelectedFiles}
                existingFiles={existingFiles}
                onRemoveExisting={removeExistingFile}
                maxFiles={10}
                maxSizeMB={50}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-visible"
                checked={isVisible}
                onCheckedChange={setIsVisible}
              />
              <Label htmlFor="edit-visible">{language === "ar" ? "جعل الدرس مرئياً للتلاميذ" : "Make course visible to students"}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleEditCourse}>{language === "ar" ? "تحديث الدرس" : "Update Course"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RoomCourses;
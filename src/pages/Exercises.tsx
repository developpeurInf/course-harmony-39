
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCourses, Exercise, Course } from "@/contexts/CourseContext";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Plus, Calendar, Eye, EyeOff, Edit, Trash2, Grid3x3, List, BookOpen, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import MultiPdfUpload from "@/components/MultiPdfUpload";
import PdfInfo from "@/components/PdfInfo";

const Exercises = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { roomId } = useParams();
  const { exercises, courses, addExercise, updateExercise, deleteExercise, toggleExerciseVisibility, uploadExercisePdf, refreshData, getVisibleExercisesForStudent } = useCourses();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    id: "",
    course_id: "",
    title: "",
    description: "",
    due_date: "",
    is_visible: true,
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [exerciseMaterials, setExerciseMaterials] = useState<{[exerciseId: string]: any[]}>({});
  
  const isProfessor = user?.role === "professor";
  
  // Refresh data when component mounts or when navigating between room/global views
  useEffect(() => {
    if (user && !roomId) {
      // If we're NOT in a room context (accessing /exercises directly), refresh all data
      // RoomExercises component handles refresh for room-specific context
      refreshData();
    }
  }, [user, roomId, refreshData]);
  
  const userExercises = isProfessor 
    ? exercises 
    : (user ? getVisibleExercisesForStudent(user.id) : []);

  const visibleExercises = isProfessor
    ? userExercises
    : userExercises.filter((exercise) => exercise.is_visible);

  const formatDueDate = (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      if (language === "ar") {
        return d.toLocaleDateString("ar-MA", { year: 'numeric', month: 'long', day: 'numeric' });
      }
      return format(d, "PPP");
    } catch {
      return dateStr;
    }
  };

  const resetForm = () => {
    setFormData({
      id: "",
      course_id: "",
      title: "",
      description: "",
      due_date: "",
      is_visible: true,
    });
    setSelectedFiles([]);
  };

  const handleAddExercise = async () => {
    if (!formData.course_id || !formData.title || !formData.due_date) return;
    
    const newExercise = await addExercise({
      course_id: formData.course_id,
      title: formData.title,
      description: formData.description,
      due_date: new Date(formData.due_date).toISOString(),
      is_visible: formData.is_visible,
    });
    
    if (newExercise) {
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          await uploadExercisePdf(newExercise.id, file, formData.course_id);
        }
      }
      resetForm();
      setIsAddDialogOpen(false);
    }
  };

  const handleEditExercise = async () => {
    if (!formData.id || !formData.course_id || !formData.title || !formData.due_date) return;
    
    const success = await updateExercise(formData.id, {
      course_id: formData.course_id,
      title: formData.title,
      description: formData.description,
      due_date: new Date(formData.due_date).toISOString(),
      is_visible: formData.is_visible,
    });
    
    // Handle multiple file uploads if files are selected
    if (selectedFiles.length > 0 && success) {
      for (const file of selectedFiles) {
        await uploadExercisePdf(formData.id, file, formData.course_id);
      }
    }
    
    if (success) {
      resetForm();
      setIsEditDialogOpen(false);
    }
  };

  const openEditDialog = (exercise: Exercise) => {
    setFormData({
      id: exercise.id,
      course_id: exercise.course_id,
      title: exercise.title,
      description: exercise.description,
      due_date: exercise.due_date.split("T")[0], // Format date for input
      is_visible: exercise.is_visible,
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteExercise = (id: string) => {
    if (confirm(t("exercise.delete") + "?")) {
      deleteExercise(id);
    }
  };

  const findCourseName = (courseId: string): string => {
    const course = courses.find((c) => c.id === courseId);
    return course ? course.title : "Unknown Course";
  };

  const handleViewPdf = (exercise: Exercise) => {
    if (exercise.pdf_url) {
      window.open(exercise.pdf_url, "_blank");
    }
  };

  const handleDownloadPdf = (exercise: Exercise) => {
    if (exercise.pdf_url) {
      const a = document.createElement("a");
      a.href = exercise.pdf_url;
      a.download = `${exercise.title}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("nav.exercises")}</h1>
          <p className="text-muted-foreground mt-1">
            {language === "ar" ? "إدارة وعرض التمارين المرتبطة بالدروس" : "Manage and view exercises linked to courses"}
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
                <Button className="shadow-elegant" onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("exercise.add")}
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("exercise.add")}</DialogTitle>
                <DialogDescription>
                  {language === "ar" ? "إنشاء تمرين جديد وربطه بدرس" : "Create a new exercise and link it to a course"}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="course">{t("nav.courses")}</Label>
                  <Select
                    value={formData.course_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, course_id: value })
                    }
                  >
                    <SelectTrigger id="course">
                      <SelectValue placeholder={t("nav.courses")} />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map((course: Course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="title">{t("form.title")}</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">{t("form.description")}</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dueDate">{t("form.dueDate")}</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) =>
                      setFormData({ ...formData, due_date: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="visible">{t("form.visible")}</Label>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="visible"
                      checked={formData.is_visible}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, is_visible: checked })
                      }
                    />
                    <Label htmlFor="visible">{formData.is_visible ? t("app.view") : t("app.view")}</Label>
                  </div>
                </div>
                
                {/* Multiple PDF Upload */}
                <div className="grid gap-2">
                  <Label htmlFor="pdfs">{t("file.upload")} (PDFs)</Label>
                  <MultiPdfUpload
                    onFilesChange={setSelectedFiles}
                    selectedFiles={selectedFiles}
                    maxFiles={3}
                    maxSizeMB={20}
                  />
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  {t("app.cancel")}
                </Button>
                <Button onClick={handleAddExercise}>{t("form.create")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      {/* Exercises Display */}
      {visibleExercises.length > 0 ? (
        viewMode === "grid" ? (
          // Grid View
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleExercises.map((exercise) => (
              <Card key={exercise.id} className="group hover:shadow-elegant transition-all duration-300 hover:-translate-y-1">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-primary/10 rounded">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <CardTitle className="text-lg line-clamp-1 group-hover:text-primary transition-colors">
                          {exercise.title}
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          <BookOpen className="h-3 w-3 mr-1" />
                          {findCourseName(exercise.course_id)}
                        </Badge>
                        <Badge variant={exercise.is_visible ? "default" : "secondary"} className="text-xs">
                          {exercise.is_visible ? "Visible" : "Hidden"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  {exercise.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {exercise.description}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
                    <Clock className="h-4 w-4" />
                    <span>{language === "ar" ? "تاريخ التسليم: " : "Due: "}{formatDueDate(exercise.due_date)}</span>
                  </div>
                  
                  {/* PDF Information */}
                  {exercise.pdf_url && (
                    <PdfInfo
                      fileName={`${exercise.title}.pdf`}
                      onView={() => handleViewPdf(exercise)}
                      onDownload={() => handleDownloadPdf(exercise)}
                    />
                  )}
                </CardContent>
                
                {isProfessor && (
                  <CardFooter className="pt-3 flex gap-2 border-t bg-muted/30">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleExerciseVisibility(exercise.id)}
                      className="flex-1"
                    >
                      {exercise.is_visible ? (
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
                      onClick={() => openEditDialog(exercise)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteExercise(exercise.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                )}
              </Card>
            ))}
          </div>
        ) : (
          // List View
          <div className="space-y-4">
            {visibleExercises.map((exercise) => (
              <Card key={exercise.id} className="group hover:shadow-elegant transition-all duration-300">
                <div className="flex flex-col md:flex-row">
                  <div className="flex-1 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-3 mb-2">
                          <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-xl font-semibold group-hover:text-primary transition-colors">
                              {exercise.title}
                            </h3>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                <BookOpen className="h-3 w-3 mr-1" />
                                {findCourseName(exercise.course_id)}
                              </Badge>
                              <Badge variant={exercise.is_visible ? "default" : "secondary"} className="text-xs">
                                {exercise.is_visible ? "Visible" : "Hidden"}
                              </Badge>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                <span>{language === "ar" ? "تاريخ التسليم: " : "Due: "}{formatDueDate(exercise.due_date)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {exercise.description && (
                          <p className="text-muted-foreground mt-3 leading-relaxed">
                            {exercise.description}
                          </p>
                        )}
                        
                        {/* PDF Information */}
                        {exercise.pdf_url && (
                          <div className="mt-4">
                            <PdfInfo
                              fileName={`${exercise.title}.pdf`}
                              onView={() => handleViewPdf(exercise)}
                              onDownload={() => handleDownloadPdf(exercise)}
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
                        onClick={() => toggleExerciseVisibility(exercise.id)}
                        className="flex-1 md:flex-none"
                      >
                        {exercise.is_visible ? (
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
                        onClick={() => openEditDialog(exercise)}
                        className="flex-1 md:flex-none"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteExercise(exercise.id)}
                        className="flex-1 md:flex-none text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
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
              <FileText className="h-12 w-12 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{language === "ar" ? "لم يتم العثور على تمارين" : "No exercises found"}</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              {language === "ar"
                ? isProfessor
                  ? "لم يتم إنشاء أي تمارين بعد. أضف أول تمرين للبدء."
                  : "لا توجد تمارين متاحة حاليًا."
                : isProfessor 
                  ? "No exercises have been created yet. Add your first exercise to get started."
                  : "No exercises are currently available."}
            </p>
            {isProfessor && (
              <Button onClick={() => setIsAddDialogOpen(true)} className="shadow-elegant">
                <Plus className="h-4 w-4 mr-2" />
                {language === "ar" ? "أضف أول تمرين" : "Add Your First Exercise"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Exercise Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("exercise.edit")}</DialogTitle>
            <DialogDescription>
              {language === "ar" ? "تحديث تفاصيل التمرين والمواد" : "Update exercise details and materials"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-course">{t("nav.courses")}</Label>
              <Select
                value={formData.course_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, course_id: value })
                }
              >
                <SelectTrigger id="edit-course">
                  <SelectValue placeholder={t("nav.courses")} />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-title">{t("form.title")}</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">{t("form.description")}</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-dueDate">{t("form.dueDate")}</Label>
              <Input
                id="edit-dueDate"
                type="date"
                value={formData.due_date}
                onChange={(e) =>
                  setFormData({ ...formData, due_date: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-visible">{t("form.visible")}</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-visible"
                  checked={formData.is_visible}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_visible: checked })
                  }
                />
                <Label htmlFor="edit-visible">{formData.is_visible ? t("app.view") : t("app.view")}</Label>
              </div>
            </div>
            
            {/* Multiple PDF Upload */}
            <div className="grid gap-2">
              <Label htmlFor="edit-pdfs">{t("file.upload")} (PDFs)</Label>
              <MultiPdfUpload
                onFilesChange={setSelectedFiles}
                selectedFiles={selectedFiles}
                maxFiles={3}
                maxSizeMB={20}
                existingFiles={exerciseMaterials[formData.id] || []}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              {t("app.cancel")}
            </Button>
            <Button onClick={handleEditExercise}>{t("form.update")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Exercises;

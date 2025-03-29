
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCourses, Exercise, Course } from "@/contexts/CourseContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Calendar, Eye, EyeOff, Edit, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import FileUpload from "@/components/FileUpload";
import PdfInfo from "@/components/PdfInfo";

const Exercises = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { exercises, courses, addExercise, updateExercise, deleteExercise, toggleExerciseVisibility, setExerciseFile } = useCourses();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    id: "",
    courseId: "",
    title: "",
    description: "",
    dueDate: "",
    isVisible: true,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const isProfessor = user?.role === "professor";
  const visibleExercises = exercises.filter(
    (exercise) => exercise.isVisible || isProfessor
  );

  const resetForm = () => {
    setFormData({
      id: "",
      courseId: "",
      title: "",
      description: "",
      dueDate: "",
      isVisible: true,
    });
    setSelectedFile(null);
  };

  const handleAddExercise = () => {
    if (!formData.courseId || !formData.title || !formData.dueDate) return;
    
    addExercise({
      courseId: formData.courseId,
      title: formData.title,
      description: formData.description,
      dueDate: formData.dueDate,
      isVisible: formData.isVisible,
    });
    
    // Handle file upload if file is selected
    if (selectedFile) {
      const newExerciseId = `e${Date.now()}`;
      setExerciseFile(newExerciseId, selectedFile);
    }
    
    resetForm();
    setIsAddDialogOpen(false);
  };

  const handleEditExercise = () => {
    if (!formData.id || !formData.courseId || !formData.title || !formData.dueDate) return;
    
    updateExercise(formData.id, {
      courseId: formData.courseId,
      title: formData.title,
      description: formData.description,
      dueDate: formData.dueDate,
      isVisible: formData.isVisible,
    });
    
    // Handle file upload if file is selected
    if (selectedFile) {
      setExerciseFile(formData.id, selectedFile);
    }
    
    resetForm();
    setIsEditDialogOpen(false);
  };

  const openEditDialog = (exercise: Exercise) => {
    setFormData({
      id: exercise.id,
      courseId: exercise.courseId,
      title: exercise.title,
      description: exercise.description,
      dueDate: exercise.dueDate.split("T")[0], // Format date for input
      isVisible: exercise.isVisible,
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
    if (exercise.pdfFile) {
      const url = URL.createObjectURL(exercise.pdfFile);
      window.open(url, "_blank");
    }
  };

  const handleDownloadPdf = (exercise: Exercise) => {
    if (exercise.pdfFile) {
      const url = URL.createObjectURL(exercise.pdfFile);
      const a = document.createElement("a");
      a.href = url;
      a.download = exercise.pdfFileName || "exercise.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t("nav.exercises")}</h1>
        {isProfessor && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-1" onClick={resetForm}>
                <Plus size={16} /> {t("exercise.add")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{t("exercise.add")}</DialogTitle>
                <DialogDescription>
                  {t("file.upload")}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="course">{t("nav.courses")}</Label>
                  <Select
                    value={formData.courseId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, courseId: value })
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
                    value={formData.dueDate}
                    onChange={(e) =>
                      setFormData({ ...formData, dueDate: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="visible">{t("form.visible")}</Label>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="visible"
                      checked={formData.isVisible}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, isVisible: checked })
                      }
                    />
                    <Label htmlFor="visible">{formData.isVisible ? t("app.view") : t("app.view")}</Label>
                  </div>
                </div>
                
                {/* File Upload */}
                <div className="grid gap-2">
                  <Label htmlFor="pdf">{t("file.upload")}</Label>
                  <FileUpload
                    onFileSelect={(file) => setSelectedFile(file)}
                    selectedFile={selectedFile}
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleExercises.map((exercise) => (
          <Card key={exercise.id} className="shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-xl flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {exercise.title}
                </CardTitle>
                {isProfessor && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleExerciseVisibility(exercise.id)}
                      title={exercise.isVisible ? "Hide" : "Show"}
                    >
                      {exercise.isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(exercise)}
                      title={t("app.edit")}
                    >
                      <Edit size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteExercise(exercise.id)}
                      title={t("app.delete")}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                )}
              </div>
              <CardDescription>
                {findCourseName(exercise.courseId)}
              </CardDescription>
            </CardHeader>
            <CardContent className="py-2">
              <p className="text-sm line-clamp-3">{exercise.description}</p>
              
              {/* PDF Information */}
              {exercise.pdfFileName && (
                <PdfInfo
                  fileName={exercise.pdfFileName}
                  onView={() => handleViewPdf(exercise)}
                  onDownload={() => handleDownloadPdf(exercise)}
                  className="mt-3"
                />
              )}
            </CardContent>
            <CardFooter className="pt-2 flex justify-between">
              <div className="flex items-center text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 mr-1" />
                {format(parseISO(exercise.dueDate), "PPP")}
              </div>
              <Badge variant={exercise.isVisible ? "default" : "secondary"}>
                {exercise.isVisible ? t("app.view") : t("app.view")}
              </Badge>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Edit Exercise Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t("exercise.edit")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-course">{t("nav.courses")}</Label>
              <Select
                value={formData.courseId}
                onValueChange={(value) =>
                  setFormData({ ...formData, courseId: value })
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
                value={formData.dueDate}
                onChange={(e) =>
                  setFormData({ ...formData, dueDate: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-visible">{t("form.visible")}</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-visible"
                  checked={formData.isVisible}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isVisible: checked })
                  }
                />
                <Label htmlFor="edit-visible">{formData.isVisible ? t("app.view") : t("app.view")}</Label>
              </div>
            </div>
            
            {/* File Upload */}
            <div className="grid gap-2">
              <Label htmlFor="edit-pdf">{t("file.upload")}</Label>
              <FileUpload
                onFileSelect={(file) => setSelectedFile(file)}
                selectedFile={selectedFile}
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

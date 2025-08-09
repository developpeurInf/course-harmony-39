
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Plus, Calendar, Eye, EyeOff, Edit, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import FileUpload from "@/components/FileUpload";
import PdfInfo from "@/components/PdfInfo";
import ViewToggle from "@/components/ViewToggle";

const Exercises = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { exercises, courses, addExercise, updateExercise, deleteExercise, toggleExerciseVisibility, uploadExercisePdf } = useCourses();
  
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  
  const isProfessor = user?.role === "professor";
  const visibleExercises = exercises.filter(
    (exercise) => exercise.is_visible || isProfessor
  );

  const resetForm = () => {
    setFormData({
      id: "",
      course_id: "",
      title: "",
      description: "",
      due_date: "",
      is_visible: true,
    });
    setSelectedFile(null);
  };

  const handleAddExercise = async () => {
    if (!formData.course_id || !formData.title || !formData.due_date) return;
    
    const success = await addExercise({
      course_id: formData.course_id,
      title: formData.title,
      description: formData.description,
      due_date: new Date(formData.due_date).toISOString(),
      is_visible: formData.is_visible,
    });
    
    if (success) {
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
    
    // Handle file upload if file is selected
    if (selectedFile && success) {
      await uploadExercisePdf(formData.id, selectedFile);
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
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t("nav.exercises")}</h1>
        <div className="flex items-center gap-4">
          {isProfessor && <ViewToggle view={viewMode} onViewChange={setViewMode} />}
          {isProfessor && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-1" onClick={resetForm}>
                  <Plus size={16} /> {t("exercise.add")}
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
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
      </div>

      {viewMode === "grid" ? (
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
                      title={exercise.is_visible ? "Hide" : "Show"}
                    >
                      {exercise.is_visible ? <Eye size={16} /> : <EyeOff size={16} />}
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
                {findCourseName(exercise.course_id)}
              </CardDescription>
            </CardHeader>
            <CardContent className="py-2">
              <p className="text-sm line-clamp-3">{exercise.description}</p>
              
              {/* PDF Information */}
              {exercise.pdf_url && (
                <PdfInfo
                  fileName={`${exercise.title}.pdf`}
                  onView={() => handleViewPdf(exercise)}
                  onDownload={() => handleDownloadPdf(exercise)}
                  className="mt-3"
                />
              )}
            </CardContent>
            <CardFooter className="pt-2 flex justify-between">
              <div className="flex items-center text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 mr-1" />
                {format(parseISO(exercise.due_date), "PPP")}
              </div>
              <Badge variant={exercise.is_visible ? "default" : "secondary"}>
                {exercise.is_visible ? t("app.view") : t("app.view")}
              </Badge>
            </CardFooter>
          </Card>
        ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exercise</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>PDF</TableHead>
                {isProfessor && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleExercises.map((exercise) => (
                <TableRow key={exercise.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <div>
                        <div className="font-medium">{exercise.title}</div>
                        <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {exercise.description}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{findCourseName(exercise.course_id)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{format(parseISO(exercise.due_date), "PPP")}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={exercise.is_visible ? "default" : "secondary"}>
                      {exercise.is_visible ? t("app.view") : t("app.view")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {exercise.pdf_url && (
                      <PdfInfo
                        fileName={`${exercise.title}.pdf`}
                        onView={() => handleViewPdf(exercise)}
                        onDownload={() => handleDownloadPdf(exercise)}
                      />
                    )}
                  </TableCell>
                  {isProfessor && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExerciseVisibility(exercise.id)}
                          title={exercise.is_visible ? "Hide" : "Show"}
                        >
                          {exercise.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(exercise)}
                          title={t("app.edit")}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteExercise(exercise.id)}
                          title={t("app.delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Edit Exercise Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("exercise.edit")}</DialogTitle>
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

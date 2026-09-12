import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses } from "@/contexts/CourseContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building, Plus, Trash2, Edit, Users, BookOpen, FileText, Calendar, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ViewToggle from "@/components/ViewToggle";
import { useLanguage } from "@/contexts/LanguageContext";

interface Room {
  id: string;
  name: string;
  description?: string;
  is_visible: boolean;
  created_at: string;
  professor_id: string;
  _count?: {
    courses: number;
    students: number;
    exercises: number;
    exams: number;
  };
}

const ClassManagement = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { rooms, addRoom, updateRoom, deleteRoom } = useCourses();
  const [loading, setLoading] = useState(false);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [roomsWithCounts, setRoomsWithCounts] = useState<Room[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_visible: true
  });

  useEffect(() => {
    fetchRoomsWithCounts();
  }, [rooms]);

  const fetchRoomsWithCounts = async () => {
    if (!user) return;
    if (roomsWithCounts.length === 0) setLoadingCounts(true);
    try {
      const roomsWithCounts = await Promise.all(
        rooms.map(async (room) => {
          // Get courses count
          const { count: coursesCount } = await supabase
            .from('courses')
            .select('*', { count: 'exact', head: true })
            .eq('room_id', room.id);

          // Get students count: direct room assignment (imported via Excel) + enrolled students
          const { count: directStudentsCount } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('room_id', room.id)
            .eq('role', 'student');

          const { count: enrolledStudentsCount } = await supabase
            .from('enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('room_id', room.id);

          const studentsCount = (directStudentsCount || 0) + (enrolledStudentsCount || 0);

          // Get exercises count
          const { data: courses } = await supabase
            .from('courses')
            .select('id')
            .eq('room_id', room.id);

          const courseIds = courses?.map(c => c.id) || [];
          
          let exercisesCount = 0;
          let examsCount = 0;
          
          if (courseIds.length > 0) {
            const { count: exercisesCountResult } = await supabase
              .from('exercises')
              .select('*', { count: 'exact', head: true })
              .in('course_id', courseIds);
            
            const { count: examsCountResult } = await supabase
              .from('exams')
              .select('*', { count: 'exact', head: true })
              .in('course_id', courseIds);

            exercisesCount = exercisesCountResult || 0;
            examsCount = examsCountResult || 0;
          }

          return {
            ...room,
            _count: {
              courses: coursesCount || 0,
              students: studentsCount || 0,
              exercises: exercisesCount,
              exams: examsCount
            }
          };
        })
      );
      
      setRoomsWithCounts(roomsWithCounts);
    } catch (error) {
      console.error('Error fetching room counts:', error);
    } finally {
      setLoadingCounts(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!formData.name.trim()) {
      toast.error("Room name is required");
      return;
    }

    setLoading(true);
    try {
      await addRoom({
        name: formData.name,
        description: formData.description || null,
        is_visible: formData.is_visible
      });
      
      toast.success("Class created successfully!");
      setIsCreateDialogOpen(false);
      setFormData({ name: "", description: "", is_visible: true });
    } catch (error) {
      toast.error("Failed to create class");
      console.error("Error creating room:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditRoom = async () => {
    if (!editingRoom || !formData.name.trim()) {
      toast.error("Room name is required");
      return;
    }

    setLoading(true);
    try {
      await updateRoom(editingRoom.id, {
        name: formData.name,
        description: formData.description || null,
        is_visible: formData.is_visible
      });
      
      toast.success("Class updated successfully!");
      setEditingRoom(null);
      setFormData({ name: "", description: "", is_visible: true });
    } catch (error) {
      toast.error("Failed to update class");
      console.error("Error updating room:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    setLoading(true);
    try {
      // Manual cascading deletion since we don't have RPC function yet
      // Delete enrollments first
      await supabase.from('enrollments').delete().eq('room_id', roomId);
      
      // Get courses in this room
      const { data: courses } = await supabase
        .from('courses')
        .select('id')
        .eq('room_id', roomId);

      if (courses && courses.length > 0) {
        const courseIds = courses.map(c => c.id);
        
        // Delete quiz-related data
        const { data: submissions } = await supabase
          .from('quiz_submissions')
          .select('id')
          .in('exam_id', 
            await supabase.from('exams').select('id').in('course_id', courseIds).then(res => 
              res.data?.map(e => e.id) || []
            )
          );
        
        if (submissions && submissions.length > 0) {
          const submissionIds = submissions.map(s => s.id);
          await supabase.from('quiz_answers').delete().in('submission_id', submissionIds);
          await supabase.from('quiz_submissions').delete().in('id', submissionIds);
        }
        
        // Delete quiz questions and options
        const { data: exams } = await supabase.from('exams').select('id').in('course_id', courseIds);
        if (exams && exams.length > 0) {
          const examIds = exams.map(e => e.id);
          const { data: questions } = await supabase.from('quiz_questions').select('id').in('exam_id', examIds);
          if (questions && questions.length > 0) {
            const questionIds = questions.map(q => q.id);
            await supabase.from('quiz_options').delete().in('question_id', questionIds);
            await supabase.from('quiz_questions').delete().in('id', questionIds);
          }
        }
        
        // Delete exercises and exams
        await supabase.from('exercises').delete().in('course_id', courseIds);
        await supabase.from('exams').delete().in('course_id', courseIds);
        
        // Delete course materials
        await supabase.from('course_materials').delete().in('course_id', courseIds);
        
        // Delete courses
        await supabase.from('courses').delete().in('id', courseIds);
      }
      
      // Finally delete the room
      await supabase.from('rooms').delete().eq('id', roomId);
      
      // Update local state
      await deleteRoom(roomId);
      
      toast.success("Class and all related data deleted successfully!");
    } catch (error) {
      toast.error("Failed to delete class");
      console.error("Error deleting room:", error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setFormData({ name: "", description: "", is_visible: true });
    setIsCreateDialogOpen(true);
  };

  const openEditDialog = (room: Room) => {
    setEditingRoom(room);
    setFormData({
      name: room.name,
      description: room.description || "",
      is_visible: room.is_visible
    });
  };

  if (user?.role !== 'professor') {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">{language === "ar" ? "الوصول مرفوض. إدارة الأقسام متاحة للأساتذة فقط." : "Access denied. Only professors can manage classes."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("Class Management")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("Manage your classes and their associated content")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle
            view={viewMode}
            onViewChange={(view) => setViewMode(view)}
          />
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              {t("Create New Class")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("Create New Class")}</DialogTitle>
              <DialogDescription>
                {t("Set up a new class to organize your courses and students")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("Class Name *")}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t("Enter class name...")}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{t("form.description")}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={t("Enter class description...")}
                  rows={3}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="visibility"
                  checked={formData.is_visible}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_visible: checked }))}
                />
                <Label htmlFor="visibility">{t("Make class visible to students")}</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                {t("app.cancel")}
              </Button>
              <Button onClick={handleCreateRoom} disabled={loading}>
                <Building className="mr-2 h-4 w-4" />
                {t("Create Class")}
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {loadingCounts ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm">{language === "ar" ? "جاري التحميل..." : "Loading..."}</p>
          </div>
        </div>
      ) : viewMode === "table" ? (
        <div className="border rounded-lg">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-4 text-left font-medium">{language === "ar" ? "اسم القسم" : "Class Name"}</th>
                <th className="p-4 text-left font-medium">{language === "ar" ? "الوصف" : "Description"}</th>
                <th className="p-4 text-left font-medium">{language === "ar" ? "الدروس" : "Courses"}</th>
                <th className="p-4 text-left font-medium">{language === "ar" ? "التلاميذ" : "Students"}</th>
                <th className="p-4 text-left font-medium">{language === "ar" ? "التمارين" : "Exercises"}</th>
                <th className="p-4 text-left font-medium">{language === "ar" ? "الامتحانات" : "Exams"}</th>
                <th className="p-4 text-left font-medium">{language === "ar" ? "الرؤية" : "Visibility"}</th>
                <th className="p-4 text-left font-medium">{language === "ar" ? "الإجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {roomsWithCounts.map((room) => (
                <tr key={room.id} className="border-t">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-primary" />
                      <span className="font-medium">{room.name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {room.description || (language === "ar" ? "لا يوجد وصف" : "No description")}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <BookOpen className="h-4 w-4 text-blue-600" />
                      <span>{room._count?.courses}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-green-600" />
                      <span>{room._count?.students}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <FileText className="h-4 w-4 text-orange-600" />
                      <span>{room._count?.exercises}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-purple-600" />
                      <span>{room._count?.exams}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      room.is_visible ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"
                    }`}>
                      {room.is_visible ? "Visible" : "Hidden"}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(room)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 text-destructive" />
                              Delete Class
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the class "{room.name}" and ALL related content including:
                              <ul className="mt-2 list-disc list-inside space-y-1">
                                <li>{room._count?.courses} courses</li>
                                <li>{room._count?.exercises} exercises</li>
                                <li>{room._count?.exams} exams</li>
                                <li>{room._count?.students} student enrollments</li>
                              </ul>
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteRoom(room.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete Everything
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {roomsWithCounts.length === 0 && !loadingCounts && (
            <div className="p-8 text-center">
              <Building className="h-12 w-12 text-muted-foreground mb-4 mx-auto" />
              <p className="text-lg font-medium mb-2">{language === "ar" ? "لم يتم إنشاء أي قسم بعد" : "No classes created yet"}</p>
              <p className="text-muted-foreground text-center mb-4">
                {language === "ar" ? "أنشئ قسمك الأول لتنظيم الدروس والتلاميذ" : "Create your first class to start organizing courses and students"}
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                {language === "ar" ? "إنشاء أول قسم" : "Create Your First Class"}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {roomsWithCounts.map((room) => (
          <Card key={room.id} className="relative">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5 text-primary" />
                    {room.name}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {room.description || (language === "ar" ? "لا يوجد وصف" : "No description")}
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(room)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                          Delete Class
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the class "{room.name}" and ALL related content including:
                          <ul className="mt-2 list-disc list-inside space-y-1">
                            <li>{room._count?.courses} courses</li>
                            <li>{room._count?.exercises} exercises</li>
                            <li>{room._count?.exams} exams</li>
                            <li>{room._count?.students} student enrollments</li>
                          </ul>
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteRoom(room.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete Everything
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">{room._count?.courses} {language === "ar" ? "دروس" : "Courses"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-green-600" />
                  <span className="text-sm">{room._count?.students} {language === "ar" ? "تلاميذ" : "Students"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-orange-600" />
                  <span className="text-sm">{room._count?.exercises} {language === "ar" ? "تمارين" : "Exercises"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-purple-600" />
                  <span className="text-sm">{room._count?.exams} {language === "ar" ? "امتحانات" : "Exams"}</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("Visibility:")}</span>
                  <span className={room.is_visible ? "text-green-600" : "text-orange-600"}>
                    {room.is_visible ? t("Visible") : t("Hidden")}
                  </span>
                </div>
              </div>
          </CardContent>
        </Card>
      ))}
    </div>
      )}

    {viewMode === "grid" && roomsWithCounts.length === 0 && !loadingCounts && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Building className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">{language === "ar" ? "لم يتم إنشاء أي قسم بعد" : "No classes created yet"}</p>
            <p className="text-muted-foreground text-center mb-4">
              {language === "ar" ? "أنشئ قسمك الأول لتنظيم الدروس والتلاميذ" : "Create your first class to start organizing courses and students"}
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              {language === "ar" ? "إنشاء أول قسم" : "Create Your First Class"}
            </Button>
        </CardContent>
      </Card>
    )}

    {/* Add missing imports at the top if needed */}

      {/* Edit Dialog */}
      <Dialog open={!!editingRoom} onOpenChange={() => setEditingRoom(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "تعديل القسم" : "Edit Class"}</DialogTitle>
            <DialogDescription>
              {language === "ar" ? "تحديث معلومات القسم" : "Update the class information"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{language === "ar" ? "اسم القسم *" : "Class Name *"}</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder={language === "ar" ? "أدخل اسم القسم..." : "Enter class name..."}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">{language === "ar" ? "الوصف" : "Description"}</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={language === "ar" ? "أدخل وصف القسم..." : "Enter class description..."}
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-visibility"
                checked={formData.is_visible}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_visible: checked }))}
              />
              <Label htmlFor="edit-visibility">{language === "ar" ? "جعل القسم مرئيًا للتلاميذ" : "Make class visible to students"}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRoom(null)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleEditRoom} disabled={loading}>
              <Edit className="mr-2 h-4 w-4" />
              {language === "ar" ? "تحديث القسم" : "Update Class"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClassManagement;
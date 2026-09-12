import { useState, useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses } from "@/contexts/CourseContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, UserX, Plus, Search, Grid, List, Edit, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StudentExcelManager } from "@/components/StudentExcelManager";
import { EditStudentDialog } from "@/components/EditStudentDialog";
import { StudentInfoDialog } from "@/components/StudentInfoDialog";
import { useLanguage } from "@/contexts/LanguageContext";

interface Student {
  id: string;
  name: string;
  email: string;
  username?: string;
  role: string;
  avatar_url?: string;
  created_at: string;
  temporary_password?: string;
}

const RoomStudents = () => {
  const { t, language } = useLanguage();
  const { roomId } = useParams();
  const { user } = useAuth();
  const { refreshData } = useCourses();
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('list');
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [infoStudent, setInfoStudent] = useState<Student | null>(null);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);

  useEffect(() => {
    if (user && roomId) {
      loadStudents();
    }
  }, [user, roomId]);

  const loadStudents = async () => {
    if (!roomId) return;
    
    if (students.length === 0) setLoading(true);
    try {
      // Get students specifically for this room
      const { data: roomStudents, error: roomStudentsError } = await supabase
        .from('profiles')
        .select('id, name, email, username, role, avatar_url, created_at, temporary_password')
        .eq('role', 'student')
        .eq('room_id', roomId);

      if (roomStudentsError) {
        console.error('Error fetching room students:', roomStudentsError);
        toast.error("Failed to load students");
        return;
      }

      setStudents(roomStudents || []);

    } catch (error) {
      console.error('Error in loadStudents:', error);
      toast.error("Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('delete-student', {
        body: { 
          studentId: studentId,
          roomId: roomId 
        }
      });

      if (error) {
        console.error('Error calling delete-student function:', error);
        toast.error("Failed to remove student: " + error.message);
        return;
      }

      if (data?.success) {
        // Remove from local state
        setStudents(prev => prev.filter(s => s.id !== studentId));
        toast.success("Student removed successfully");
      } else {
        toast.error("Failed to remove student: " + (data?.error || "Unknown error"));
      }
    } catch (error) {
      console.error('Error removing student:', error);
      toast.error("Failed to remove student");
    }
  };

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    setIsEditDialogOpen(true);
  };

  const handleEditClose = () => {
    setIsEditDialogOpen(false);
    setEditingStudent(null);
  };

  const handleInfoStudent = (student: Student) => {
    setInfoStudent(student);
    setIsInfoDialogOpen(true);
  };

  const handleInfoClose = () => {
    setIsInfoDialogOpen(false);
    setInfoStudent(null);
  };

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.username && student.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!roomId) {
    return <Navigate to="/dashboard" replace />;
  }

  // Redirect students away from this page
  if (user?.role !== 'professor') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("nav.students")}</h1>
          <p className="text-muted-foreground">
            {language === "ar" ? "إدارة التلاميذ في هذا القسم" : t("Manage students in this class")}
          </p>
        </div>
        <Badge variant="secondary">
          {students.length} {language === "ar" ? "تلاميذ" : `student${students.length !== 1 ? 's' : ''}`}
        </Badge>
      </div>

      {/* Student Excel Manager */}
      <StudentExcelManager 
        roomId={roomId} 
        onStudentsImported={loadStudents}
        existingStudents={students.map(s => ({
          prenom: s.name.split(' ')[0] || '',
          nom: s.name.split(' ').slice(1).join(' ') || '',
          username: s.username,
          temporaryPassword: s.temporary_password
        }))}
      />

      {/* Search and View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={language === "ar" ? "البحث عن التلاميذ..." : t("Search students...")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={viewMode === 'cards' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('cards')}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Students List */}
      {loading ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">{language === "ar" ? "جاري تحميل التلاميذ..." : t("Loading students...")}</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">{language === "ar" ? "لم يتم العثور على تلاميذ" : t("No Students Found")}</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm 
                  ? (language === "ar" ? "لا توجد نتائج مطابقة لبحثك." : t("No students match your search."))
                  : (language === "ar" ? "قم باستيراد التلاميذ عبر ملف Excel للبدء." : t("Import students using Excel to get started."))}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === 'cards' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.map((student) => (
            <Card key={student.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={student.avatar_url || undefined} />
                    <AvatarFallback>
                      {student.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{student.name}</CardTitle>
                    <CardDescription className="truncate">
                      {student.username ? `@${student.username}` : student.email}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {student.role === "student" ? (language === "ar" ? "تلميذ" : "student") : (language === "ar" ? "أستاذ" : student.role)}
                  </Badge>
                  <div className="flex space-x-1">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleInfoStudent(student)}
                    >
                      <Info className="h-3 w-3" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEditStudent(student)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <UserX className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{language === "ar" ? "حذف التلميذ" : "Remove Student"}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {language === "ar" 
                              ? `هل أنت متأكد من رغبتك في حذف ${student.name} من هذا القسم؟ سيتم حذف حسابه وجميع بياناته بشكل نهائي.`
                              : `Are you sure you want to remove ${student.name} from this class? This will permanently delete their account and all associated data.`}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{language === "ar" ? "إلغاء" : "Cancel"}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemoveStudent(student.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {language === "ar" ? "حذف" : "Remove"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {language === "ar" ? "انضم في " : "Joined "} {new Date(student.created_at).toLocaleDateString(language === "ar" ? "ar-MA" : undefined)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === "ar" ? "التلميذ" : "Student"}</TableHead>
                <TableHead>{language === "ar" ? "اسم المستخدم" : "Username"}</TableHead>
                <TableHead>{language === "ar" ? "البريد الإلكتروني" : "Email"}</TableHead>
                <TableHead>{language === "ar" ? "الصفة" : "Role"}</TableHead>
                <TableHead>{language === "ar" ? "تاريخ الانضمام" : "Joined"}</TableHead>
                <TableHead className="text-right">{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={student.avatar_url || undefined} />
                        <AvatarFallback>
                          {student.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{student.name}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{student.username ? `@${student.username}` : '-'}</TableCell>
                  <TableCell>{student.email || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {student.role === "student" ? (language === "ar" ? "تلميذ" : "student") : (language === "ar" ? "أستاذ" : student.role)}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(student.created_at).toLocaleDateString(language === "ar" ? "ar-MA" : undefined)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-1">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleInfoStudent(student)}
                      >
                        <Info className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditStudent(student)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <UserX className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{language === "ar" ? "حذف التلميذ" : "Remove Student"}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {language === "ar" 
                                ? `هل أنت متأكد من رغبتك في حذف ${student.name} من هذا القسم؟ سيتم حذف حسابه وجميع بياناته بشكل نهائي.`
                                : `Are you sure you want to remove ${student.name} from this class? This will permanently delete their account and all associated data.`}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{language === "ar" ? "إلغاء" : "Cancel"}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRemoveStudent(student.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {language === "ar" ? "حذف" : "Remove"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Edit Student Dialog */}
      <EditStudentDialog
        student={editingStudent}
        isOpen={isEditDialogOpen}
        onClose={handleEditClose}
        onStudentUpdated={loadStudents}
      />

      {/* Student Info Dialog */}
      <StudentInfoDialog
        student={infoStudent}
        isOpen={isInfoDialogOpen}
        onClose={handleInfoClose}
      />
    </div>
  );
};

export default RoomStudents;
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, UserX, Plus, Search, Grid, List, Edit, Info, KeyRound, BellOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StudentExcelManager } from "@/components/StudentExcelManager";
import { EditStudentDialog } from "@/components/EditStudentDialog";
import { StudentInfoDialog } from "@/components/StudentInfoDialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNotifications } from "@/contexts/NotificationContext";
import StudentSearchBar from "@/components/StudentSearchBar";
import { matchesStudent, type StudentSearchMode } from "@/lib/search";

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
  const { user, resetStudentPassword } = useAuth();
  const { refreshData } = useCourses();
  const { clearRoomStudentsNotifications } = useNotifications();
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchMode, setSearchMode] = useState<StudentSearchMode>("all");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('list');
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [infoStudent, setInfoStudent] = useState<Student | null>(null);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const [resetPasswordStudent, setResetPasswordStudent] = useState<Student | null>(null);
  const [newTempPassword, setNewTempPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);

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

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let result = '';
    for (let i = 0; i < 8; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    setNewTempPassword(result);
  };

  const handleResetStudentPassword = async () => {
    if (!resetPasswordStudent || !newTempPassword.trim()) return;
    setIsResetting(true);
    const success = await resetStudentPassword(resetPasswordStudent.id, newTempPassword.trim());
    setIsResetting(false);
    if (success) {
      setResetPasswordStudent(null);
      setNewTempPassword("");
    }
  };

  const filteredStudents = students.filter(student => matchesStudent(student, searchTerm, searchMode));

  if (!roomId) {
    return <Navigate to="/dashboard" replace />;
  }

  // Redirect students away from this page
  if (user?.role !== 'professor') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("nav.students")}</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            {language === "ar" ? "إدارة التلاميذ في هذا القسم" : language === "fr" ? "Gérer les élèves de cette classe" : "Manage students in this class"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {roomId && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 border-amber-300 dark:border-amber-800 flex items-center gap-1.5 text-xs h-8"
                >
                  <BellOff className="h-3.5 w-3.5" />
                  <span>{language === "ar" ? "مسح إشعارات القسم" : language === "fr" ? "Vider les notifications" : "Clear Notifications"}</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <BellOff className="h-5 w-5 text-amber-500" />
                    {language === "ar" ? "مسح إشعارات تلاميذ هذا القسم" : language === "fr" ? "Vider les notifications de la classe" : "Clear Class Notifications"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {language === "ar"
                      ? "هل أنت متأكد من رغبتك في مسح جميع الإشعارات لدى تلاميذ هذا القسم؟ ستتم إعادة تعيين واجهاتهم كأنك لم تقم بأي تعديلات."
                      : language === "fr"
                      ? "Êtes-vous sûr de vouloir supprimer toutes les notifications de tous les élèves de cette classe ? Leurs interfaces seront réinitialisées."
                      : "Are you sure you want to delete all notifications for students in this class? Their notification feeds will be reset."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{language === "ar" ? "إلغاء" : language === "fr" ? "Annuler" : "Cancel"}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => roomId && clearRoomStudentsNotifications(roomId)}
                    className="bg-amber-600 text-white hover:bg-amber-700"
                  >
                    {language === "ar" ? "تأكيد ومسح" : language === "fr" ? "Confirmer et vider" : "Confirm & Clear"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <Badge variant="secondary" className="text-xs shrink-0">
            {students.length} {language === "ar" ? "تلاميذ" : language === "fr" ? `élève${students.length > 1 ? "s" : ""}` : `student${students.length !== 1 ? "s" : ""}`}
          </Badge>
        </div>
      </div>

      {/* Student Excel Manager */}
      <StudentExcelManager 
        roomId={roomId} 
        onStudentsImported={loadStudents}
        existingStudents={students.map(s => {
          const parts = (s.name || '').trim().split(/\s+/);
          return {
            prenom: parts[0] || '',
            nom: parts.slice(1).join(' ') || s.name || '',
            codeMassar: s.username || '',
            username: s.username || '',
            temporaryPassword: s.temporary_password || ''
          };
        })}
      />

      {/* Search and View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <StudentSearchBar
          query={searchTerm}
          onQueryChange={setSearchTerm}
          mode={searchMode}
          onModeChange={setSearchMode}
          resultCount={filteredStudents.length}
          totalCount={students.length}
          className="flex-1 w-full sm:max-w-2xl"
        />
        <div className="flex items-center gap-1.5 self-end sm:self-auto bg-muted/50 rounded-lg p-1">
          <Button
            variant={viewMode === 'cards' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('cards')}
            className="h-8 w-8 p-0"
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="h-8 w-8 p-0"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Students List */}
      {loading ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">{language === "ar" ? "جاري تحميل التلاميذ..." : language === "fr" ? "Chargement des élèves..." : "Loading students..."}</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">{language === "ar" ? "لم يتم العثور على تلاميذ" : language === "fr" ? "Aucun élève trouvé" : "No Students Found"}</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm 
                  ? (language === "ar" ? "لا توجد نتائج مطابقة لبحثك." : language === "fr" ? "Aucun élève ne correspond à votre recherche." : "No students match your search.")
                  : (language === "ar" ? "قم باستيراد التلاميذ عبر ملف Excel للبدء." : language === "fr" ? "Importez des élèves via un fichier Excel pour commencer." : "Import students using Excel to get started.")}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map((student) => (
            <Card key={student.id} className="card-hover">
              <CardHeader className="p-4 pb-2.5">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={student.avatar_url || undefined} />
                    <AvatarFallback>
                      {student.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm sm:text-base truncate">{student.name}</CardTitle>
                    <CardDescription className="truncate text-xs">
                      {student.username ? `@${student.username}` : student.email}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="text-[11px] shrink-0">
                    {student.role === "student" ? (language === "ar" ? "تلميذ" : language === "fr" ? "élève" : "student") : (language === "ar" ? "أستاذ" : student.role)}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleInfoStudent(student)}
                    >
                      <Info className="h-3.5 w-3.5" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleEditStudent(student)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      title={language === "ar" ? "إعادة تعيين كلمة المرور" : language === "fr" ? "Réinitialiser le mot de passe" : "Reset Password"}
                      onClick={() => { setResetPasswordStudent(student); setNewTempPassword(""); }}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                          <UserX className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
                        <AlertDialogHeader>
                          <AlertDialogTitle>{language === "ar" ? "حذف التلميذ" : language === "fr" ? "Retirer l'élève" : "Remove Student"}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {language === "ar" 
                              ? `هل أنت متأكد من رغبتك في حذف ${student.name} من هذا القسم؟ سيتم حذف حسابه وجميع بياناته بشكل نهائي.`
                              : `Are you sure you want to remove ${student.name} from this class? This will permanently delete their account and all associated data.`}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{language === "ar" ? "إلغاء" : language === "fr" ? "Annuler" : "Cancel"}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemoveStudent(student.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {language === "ar" ? "حذف" : language === "fr" ? "Retirer" : "Remove"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  {language === "ar" ? "انضم في " : language === "fr" ? "Inscrit le " : "Joined "} {new Date(student.created_at).toLocaleDateString(language === "ar" ? "ar-MA" : undefined)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table flat className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "ar" ? "التلميذ" : language === "fr" ? "Élève" : "Student"}</TableHead>
                  <TableHead>{language === "ar" ? "رمز مسار" : language === "fr" ? "Code Massar" : "Code Massar"}</TableHead>
                  <TableHead>{language === "ar" ? "البريد الإلكتروني" : language === "fr" ? "E-mail" : "Email"}</TableHead>
                  <TableHead>{language === "ar" ? "الصفة" : language === "fr" ? "Rôle" : "Role"}</TableHead>
                  <TableHead>{language === "ar" ? "تاريخ الانضمام" : language === "fr" ? "Inscrit le" : "Joined"}</TableHead>
                  <TableHead className="text-end">{language === "ar" ? "الإجراءات" : language === "fr" ? "Actions" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={student.avatar_url || undefined} />
                          <AvatarFallback>
                            {student.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium truncate max-w-[140px]">{student.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{student.username ? `@${student.username}` : '-'}</TableCell>
                    <TableCell className="text-xs truncate max-w-[150px]">{student.email || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {student.role === "student" ? (language === "ar" ? "تلميذ" : language === "fr" ? "élève" : "student") : (language === "ar" ? "أستاذ" : student.role)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(student.created_at).toLocaleDateString(language === "ar" ? "ar-MA" : undefined)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-1">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleInfoStudent(student)}
                        >
                          <Info className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleEditStudent(student)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title={language === "ar" ? "إعادة تعيين كلمة المرور" : language === "fr" ? "Réinitialiser le mot de passe" : "Reset Password"}
                          onClick={() => { setResetPasswordStudent(student); setNewTempPassword(""); }}
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                              <UserX className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
                            <AlertDialogHeader>
                              <AlertDialogTitle>{language === "ar" ? "حذف التلميذ" : language === "fr" ? "Retirer l'élève" : "Remove Student"}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {language === "ar" 
                                  ? `هل أنت متأكد من رغبتك في حذف ${student.name} من هذا القسم؟ سيتم حذف حسابه وجميع بياناته بشكل نهائي.`
                                  : language === "fr"
                                  ? `Êtes-vous sûr de vouloir retirer ${student.name} de cette classe ? Cela supprimera définitivement son compte et toutes ses données associées.`
                                  : `Are you sure you want to remove ${student.name} from this class? This will permanently delete their account and all associated data.`}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{language === "ar" ? "إلغاء" : language === "fr" ? "Annuler" : "Cancel"}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleRemoveStudent(student.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {language === "ar" ? "حذف" : language === "fr" ? "Retirer" : "Remove"}
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
          </div>
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

      {/* Professor Reset Student Password Dialog */}
      <Dialog open={!!resetPasswordStudent} onOpenChange={() => setResetPasswordStudent(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "إعادة تعيين كلمة مرور التلميذ" : language === "fr" ? "Réinitialiser le mot de passe de l'élève" : "Reset Student Password"}
            </DialogTitle>
            <DialogDescription>
              {language === "ar"
                ? `تعيين كلمة مرور مؤقتة جديدة لـ ${resetPasswordStudent?.name}`
                : language === "fr"
                ? `Définir un nouveau mot de passe temporaire pour ${resetPasswordStudent?.name}`
                : `Set a new temporary password for ${resetPasswordStudent?.name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="student-new-password">
                {language === "ar" ? "كلمة المرور المؤقتة الجديدة" : language === "fr" ? "Nouveau mot de passe temporaire" : "New Temporary Password"}
              </Label>
              <div className="flex gap-2 mt-1.5">
                <Input
                  id="student-new-password"
                  value={newTempPassword}
                  onChange={(e) => setNewTempPassword(e.target.value)}
                  placeholder={language === "ar" ? "أدخل أو أنشئ كلمة المرور" : language === "fr" ? "Entrez ou générez le mot de passe" : "Enter or generate password"}
                />
                <Button type="button" variant="outline" onClick={generatePassword} size="sm">
                  {language === "ar" ? "توليد تلقائي" : language === "fr" ? "Générer" : "Generate"}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordStudent(null)} disabled={isResetting}>
              {language === "ar" ? "إلغاء" : language === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button onClick={handleResetStudentPassword} disabled={!newTempPassword.trim() || isResetting}>
              {isResetting
                ? (language === "ar" ? "جاري التعيين..." : language === "fr" ? "Réinitialisation..." : "Resetting...")
                : (language === "ar" ? "تأكيد وتعيين" : language === "fr" ? "Confirmer et définir" : "Confirm & Set")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RoomStudents;
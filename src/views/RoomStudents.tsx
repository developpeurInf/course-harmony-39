import { accessStore } from "@/contexts/AccessContext";
import { useState, useEffect } from "react";
import { useParams, Navigate } from "@/lib/router";
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
import { Users, UserX, Edit, Info, KeyRound, BellOff, Loader2, Copy, Check, ArrowRightLeft, IdCard } from "lucide-react";
import { printCredentialCards } from "@/lib/credentialCards";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StudentExcelManager } from "@/components/StudentExcelManager";
import { EditStudentDialog } from "@/components/EditStudentDialog";
import { StudentInfoDialog } from "@/components/StudentInfoDialog";
import TransferStudentDialog from "@/components/TransferStudentDialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNotifications } from "@/contexts/NotificationContext";
import StudentSearchBar from "@/components/StudentSearchBar";
import { matchesStudent, type StudentSearchMode } from "@/lib/search";
import { isSmallScreen } from "@/lib/device";
import ViewToggle from "@/components/ViewToggle";
import { localeFor } from "@/lib/formatDate";
import { fetchRoomPasswords } from "@/lib/studentPasswords";

/** Mot de passe aléatoire (crypto.getRandomValues, repli Math.random sur très vieux navigateurs). */
const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const makePassword = (len = 8) => {
  let out = '';
  try {
    const c: Crypto | undefined = (window as any).crypto || (window as any).msCrypto;
    if (c && c.getRandomValues) {
      const buf = new Uint32Array(len);
      c.getRandomValues(buf);
      for (let i = 0; i < len; i++) out += PASSWORD_CHARS.charAt(buf[i] % PASSWORD_CHARS.length);
      return out;
    }
  } catch { /* repli */ }
  for (let i = 0; i < len; i++) out += PASSWORD_CHARS.charAt(Math.floor(Math.random() * PASSWORD_CHARS.length));
  return out;
};

/** Copie avec repli iOS 12 (textarea caché + execCommand). */
const copyText = async (text: string): Promise<boolean> => {
  try {
    const nav: any = navigator;
    if (nav.clipboard && typeof nav.clipboard.writeText === "function" && (window as any).isSecureContext !== false) {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch { /* repli */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.width = "1px";
    ta.style.height = "1px";
    ta.style.opacity = "0";
    ta.style.fontSize = "16px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
};

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
  const { refreshData, rooms } = useCourses();
  const { clearRoomStudentsNotifications } = useNotifications();
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchMode, setSearchMode] = useState<StudentSearchMode>("all");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>(() => (isSmallScreen() ? 'cards' : 'list'));
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [infoStudent, setInfoStudent] = useState<Student | null>(null);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const [resetPasswordStudent, setResetPasswordStudent] = useState<Student | null>(null);
  const [newTempPassword, setNewTempPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [resetDonePassword, setResetDonePassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [transferTarget, setTransferTarget] = useState<Student | null>(null);
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en);
  const iconBtn = "h-9 w-9 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10";
  const fmtDay = (d: string) => {
    try { return new Date(d).toLocaleDateString(localeFor(language)); } catch { return d; }
  };

  useEffect(() => {
    if (user && roomId) {
      loadStudents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, roomId]);

  const loadStudents = async () => {
    if (!roomId) return;
    
    if (students.length === 0) setLoading(true);
    try {
      // Get students specifically for this room
      const { data: roomStudents, error: roomStudentsError } = await supabase
        .from('profiles')
        .select('id, name, email, username, role, avatar_url, created_at')
        .eq('role', 'student')
        .eq('room_id', roomId);

      if (roomStudentsError) {
        console.error('Error fetching room students:', roomStudentsError);
        toast.error(tr("Impossible de charger les élèves", "تعذر تحميل التلاميذ", "Failed to load students"));
        return;
      }

      const passwords = await fetchRoomPasswords(roomId);
      setStudents((roomStudents || []).map((s: any) => ({ ...s, temporary_password: passwords.get(s.id) || undefined })));

    } catch (error) {
      console.error('Error in loadStudents:', error);
      toast.error(tr("Impossible de charger les élèves", "تعذر تحميل التلاميذ", "Failed to load students"));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (deleting) return;
    if (!accessStore.guard("student.delete")) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-student', {
        body: { 
          studentId: studentId,
          roomId: roomId 
        }
      });

      if (error) {
        console.error('Error calling delete-student function:', error);
        toast.error(tr("Impossible de retirer l'élève", "تعذر حذف التلميذ", "Failed to remove student"));
        return;
      }

      if (data?.success) {
        setStudents(prev => prev.filter(s => s.id !== studentId));
        setDeleteTarget(null);
        toast.success(tr("Élève retiré", "تم حذف التلميذ", "Student removed"));
      } else {
        console.error('delete-student failed:', data?.error);
        toast.error(tr("Impossible de retirer l'élève", "تعذر حذف التلميذ", "Failed to remove student"));
      }
    } catch (error) {
      console.error('Error removing student:', error);
      toast.error(tr("Impossible de retirer l'élève", "تعذر حذف التلميذ", "Failed to remove student"));
    } finally {
      setDeleting(false);
    }
  };

  const handleEditStudent = (student: Student) => {
    if (!accessStore.guard("student.edit")) return;
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

  const generatePassword = () => setNewTempPassword(makePassword(8));

  const openResetDialog = (student: Student) => {
    setResetPasswordStudent(student);
    setNewTempPassword("");
    setResetDonePassword(null);
    setCopied(false);
  };

  const closeResetDialog = () => {
    if (isResetting) return;
    setResetPasswordStudent(null);
    setNewTempPassword("");
    setResetDonePassword(null);
    setCopied(false);
  };

  const handleResetStudentPassword = async () => {
    if (!accessStore.guard("student.reset_password")) return;
    if (!resetPasswordStudent || !newTempPassword.trim() || isResetting) return;
    setIsResetting(true);
    const pwd = newTempPassword.trim();
    const success = await resetStudentPassword(resetPasswordStudent.id, pwd);
    setIsResetting(false);
    if (success) {
      // Étape « succès » : on affiche le nouveau mot de passe à communiquer à l'élève
      setResetDonePassword(pwd);
      setStudents(prev => prev.map(s => (s.id === resetPasswordStudent.id ? { ...s, temporary_password: pwd } : s)));
    }
  };

  const handleCopyPassword = async () => {
    if (!resetDonePassword) return;
    const ok = await copyText(resetDonePassword);
    if (ok) {
      setCopied(true);
      toast.success(tr("Mot de passe copié", "تم نسخ كلمة المرور", "Password copied"));
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error(tr("Copie impossible : sélectionnez le texte", "تعذر النسخ: حدد النص يدويا", "Copy failed: select the text"));
    }
  };

  const renderActions = (student: Student) => (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className={iconBtn}
        onClick={() => handleInfoStudent(student)}
        aria-label={tr(`Informations de ${student.name}`, `معلومات ${student.name}`, `Details for ${student.name}`)}
        title={tr("Informations", "معلومات", "Details")}
      >
        <Info className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className={iconBtn}
        onClick={() => handleEditStudent(student)}
        aria-label={tr(`Modifier ${student.name}`, `تعديل ${student.name}`, `Edit ${student.name}`)}
        title={tr("Modifier", "تعديل", "Edit")}
      >
        <Edit className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className={iconBtn}
        onClick={() => openResetDialog(student)}
        aria-label={tr(`Réinitialiser le mot de passe de ${student.name}`, `إعادة تعيين كلمة مرور ${student.name}`, `Reset password for ${student.name}`)}
        title={tr("Réinitialiser le mot de passe", "إعادة تعيين كلمة المرور", "Reset Password")}
      >
        <KeyRound className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className={iconBtn}
        onClick={() => setTransferTarget(student)}
        aria-label={tr(`Changer ${student.name} de classe`, `تغيير قسم ${student.name}`, `Move ${student.name} to another class`)}
        title={tr("Changer de classe", "تغيير القسم", "Move to another class")}
      >
        <ArrowRightLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className={`${iconBtn} text-destructive hover:text-destructive`}
        onClick={() => setDeleteTarget(student)}
        aria-label={tr(`Retirer ${student.name}`, `حذف ${student.name}`, `Remove ${student.name}`)}
        title={tr("Retirer l'élève", "حذف التلميذ", "Remove Student")}
      >
        <UserX className="h-4 w-4" />
      </Button>
    </div>
  );

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
          <h1 className="text-2xl font-semibold tracking-tight">{t("nav.students")}</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            {language === "ar" ? "إدارة التلاميذ في هذا القسم" : language === "fr" ? "Gérer les élèves de cette classe" : "Manage students in this class"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {students.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5 text-xs h-8"
              onClick={() => accessStore.guard("student.print_cards") && printCredentialCards([...students].sort((a, b) => a.name.localeCompare(b.name)), rooms.find(r => r.id === roomId)?.name || "", language as "fr" | "ar" | "en")}
              title={tr("Imprimer une carte par élève avec son identifiant et son mot de passe provisoire", "طباعة بطاقة لكل تلميذ ببيانات دخوله", "Print one card per student with their username and temporary password")}
            >
              <IdCard className="h-3.5 w-3.5" />
              <span>{tr("Cartes d'identifiants", "بطاقات الدخول", "Credential cards")}</span>
            </Button>
          )}
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
                    <BellOff className="h-5 w-5 text-muted-foreground" />
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
        <div className="self-end sm:self-auto">
          <ViewToggle view={viewMode === 'cards' ? 'grid' : 'table'} onViewChange={(v) => setViewMode(v === 'grid' ? 'cards' : 'list')} />
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
                <div className="flex items-center gap-3">
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
                  {renderActions(student)}
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  {language === "ar" ? "انضم في " : language === "fr" ? "Inscrit le " : "Joined "} {fmtDay(student.created_at)}
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
                      <div className="flex items-center gap-3">
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
                      {fmtDay(student.created_at)}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end">{renderActions(student)}</div>
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

      <TransferStudentDialog
        student={transferTarget}
        currentRoomId={roomId}
        rooms={rooms.filter(r => r.professor_id === user?.id)}
        language={language === "ar" ? "ar" : language === "fr" ? "fr" : "en"}
        onClose={() => setTransferTarget(null)}
        onDone={(id) => {
          setTransferTarget(null);
          setStudents(prev => prev.filter(s => s.id !== id));
          void refreshData(undefined, { force: true });
        }}
      />

      {/* Student Info Dialog */}
      <StudentInfoDialog
        student={infoStudent}
        isOpen={isInfoDialogOpen}
        onClose={handleInfoClose}
      />

      {/* Retirer un élève : une seule boîte, état « occupé » */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o && !deleting) setDeleteTarget(null); }}>
        <AlertDialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{tr("Retirer l'élève", "حذف التلميذ", "Remove Student")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tr(
                `Êtes-vous sûr de vouloir retirer ${deleteTarget?.name || ""} de cette classe ? Cela supprimera définitivement son compte et toutes ses données associées.`,
                `هل أنت متأكد من رغبتك في حذف ${deleteTarget?.name || ""} من هذا القسم؟ سيتم حذف حسابه وجميع بياناته بشكل نهائي.`,
                `Are you sure you want to remove ${deleteTarget?.name || ""} from this class? This will permanently delete their account and all associated data.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{tr("Annuler", "إلغاء", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); if (deleteTarget) void handleRemoveStudent(deleteTarget.id); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {deleting ? tr("Suppression…", "جارٍ الحذف…", "Removing…") : tr("Retirer", "حذف", "Remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Professor Reset Student Password Dialog */}
      <Dialog open={!!resetPasswordStudent} onOpenChange={(o) => { if (!o) closeResetDialog(); }}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {resetDonePassword
                ? tr("Mot de passe réinitialisé", "تمت إعادة تعيين كلمة المرور", "Password reset")
                : tr("Réinitialiser le mot de passe de l'élève", "إعادة تعيين كلمة مرور التلميذ", "Reset Student Password")}
            </DialogTitle>
            <DialogDescription>
              {resetDonePassword
                ? tr(
                    `Communiquez ce nouveau mot de passe à ${resetPasswordStudent?.name || ""}.`,
                    `أبلغ ${resetPasswordStudent?.name || ""} بكلمة المرور الجديدة هذه.`,
                    `Give this new password to ${resetPasswordStudent?.name || ""}.`
                  )
                : tr(
                    `Définir un nouveau mot de passe temporaire pour ${resetPasswordStudent?.name || ""}`,
                    `تعيين كلمة مرور مؤقتة جديدة لـ ${resetPasswordStudent?.name || ""}`,
                    `Set a new temporary password for ${resetPasswordStudent?.name || ""}`
                  )}
            </DialogDescription>
          </DialogHeader>
          {resetDonePassword ? (
            <div className="space-y-3 py-2">
              {resetPasswordStudent?.username && (
                <p className="text-sm text-muted-foreground">
                  {tr("Identifiant", "اسم المستخدم", "Username")} : <span className="font-mono text-foreground" dir="ltr">{resetPasswordStudent.username}</span>
                </p>
              )}
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 rounded-md border bg-muted px-3 py-2 font-mono text-lg tracking-wider select-all break-all" dir="ltr">
                  {resetDonePassword}
                </code>
                <Button type="button" variant="outline" onClick={handleCopyPassword}>
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  {tr("Copier", "نسخ", "Copy")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="student-new-password">
                  {tr("Nouveau mot de passe temporaire", "كلمة المرور المؤقتة الجديدة", "New Temporary Password")}
                </Label>
                <div className="flex gap-2 mt-1.5">
                  <Input
                    id="student-new-password"
                    value={newTempPassword}
                    onChange={(e) => setNewTempPassword(e.target.value)}
                    placeholder={tr("Entrez ou générez le mot de passe", "أدخل أو أنشئ كلمة المرور", "Enter or generate password")}
                    autoComplete="off"
                    dir="ltr"
                    disabled={isResetting}
                  />
                  <Button type="button" variant="outline" onClick={generatePassword} disabled={isResetting}>
                    {tr("Générer", "توليد تلقائي", "Generate")}
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            {resetDonePassword ? (
              <Button onClick={closeResetDialog}>{tr("Terminé", "تم", "Done")}</Button>
            ) : (
              <>
                <Button variant="outline" onClick={closeResetDialog} disabled={isResetting}>
                  {tr("Annuler", "إلغاء", "Cancel")}
                </Button>
                <Button onClick={handleResetStudentPassword} disabled={!newTempPassword.trim() || isResetting}>
                  {isResetting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isResetting
                    ? tr("Réinitialisation...", "جاري التعيين...", "Resetting...")
                    : tr("Confirmer et définir", "تأكيد وتعيين", "Confirm & Set")}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RoomStudents;
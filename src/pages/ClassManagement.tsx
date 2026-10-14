import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses } from "@/contexts/CourseContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building, Plus, Trash2, Edit, Users, BookOpen, FileText, Calendar, AlertTriangle, Eraser, Pencil, Check, X, Loader2 } from "lucide-react";
import ClearRoomDialog from "@/components/ClearRoomDialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { accessStore } from "@/contexts/AccessContext";
import ViewToggle from "@/components/ViewToggle";
import { useLanguage } from "@/contexts/LanguageContext";
import { isSmallScreen } from "@/lib/device";

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
  const { rooms, addRoom, updateRoom, deleteRoom, refreshData } = useCourses();
  const [clearTarget, setClearTarget] = useState<Room | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "table">(() => (isSmallScreen() ? "grid" : "table"));
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_visible: true
  });

  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en);
  const iconBtn = "h-9 w-9 [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10";

  // Suppression : une seule boîte de dialogue, état « occupé » + progression
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteStep, setDeleteStep] = useState<{ done: number; total: number; label: string } | null>(null);

  // Clé stable : on ne recompte que si la liste des classes change réellement
  const roomKey = rooms.map(r => r.id).join(",");
  const [counts, setCounts] = useState<Record<string, NonNullable<Room["_count"]>>>({});

  useEffect(() => {
    fetchRoomsWithCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomKey, user?.id]);

  const roomsWithCounts: Room[] = rooms.map(r => ({ ...(r as any), _count: counts[r.id] || { courses: 0, students: 0, exercises: 0, exams: 0 } }));

  /** Lit toutes les lignes (pagination par 1000, limite par défaut de l'API). */
  const fetchAll = async <T,>(make: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> => {
    const out: T[] = [];
    const PAGE = 1000;
    for (let from = 0; from < 100000; from += PAGE) {
      const { data, error } = await make(from, from + PAGE - 1);
      if (error) throw error;
      out.push(...(data || []));
      if (!data || data.length < PAGE) break;
    }
    return out;
  };

  const fetchRoomsWithCounts = async () => {
    if (!user) return;
    const roomIds = rooms.map(r => r.id);
    if (roomIds.length === 0) {
      setCounts({});
      setLoadingCounts(false);
      return;
    }
    if (Object.keys(counts).length === 0) setLoadingCounts(true);
    try {
      // Requêtes groupées (au lieu de 6 requêtes par classe)
      const [courses, directStudents, enrolled] = await Promise.all([
        fetchAll<{ id: string; room_id: string }>((a, b) => supabase.from('courses').select('id, room_id').in('room_id', roomIds).range(a, b)),
        fetchAll<{ id: string; room_id: string | null }>((a, b) => supabase.from('profiles').select('id, room_id').eq('role', 'student').in('room_id', roomIds).range(a, b)),
        fetchAll<{ student_id: string; room_id: string | null }>((a, b) => supabase.from('enrollments').select('student_id, room_id').in('room_id', roomIds).range(a, b)),
      ]);
      const courseIds = courses.map(c => c.id);
      const courseRoom: Record<string, string> = {};
      courses.forEach(c => { courseRoom[c.id] = c.room_id; });
      const [exercises, exams] = courseIds.length
        ? await Promise.all([
            fetchAll<{ course_id: string }>((a, b) => supabase.from('exercises').select('course_id').in('course_id', courseIds).range(a, b)),
            fetchAll<{ course_id: string }>((a, b) => supabase.from('exams').select('course_id').in('course_id', courseIds).range(a, b)),
          ])
        : [[], []];

      const next: Record<string, NonNullable<Room["_count"]>> = {};
      const students: Record<string, Set<string>> = {};
      roomIds.forEach(id => { next[id] = { courses: 0, students: 0, exercises: 0, exams: 0 }; students[id] = new Set(); });
      courses.forEach(c => { if (next[c.room_id]) next[c.room_id].courses++; });
      // Élèves distincts : rattachement direct ∪ inscriptions
      directStudents.forEach(p => { if (p.room_id && students[p.room_id]) students[p.room_id].add(p.id); });
      enrolled.forEach(e => { if (e.room_id && students[e.room_id]) students[e.room_id].add(e.student_id); });
      roomIds.forEach(id => { next[id].students = students[id].size; });
      exercises.forEach(x => { const r = courseRoom[x.course_id]; if (r && next[r]) next[r].exercises++; });
      exams.forEach(x => { const r = courseRoom[x.course_id]; if (r && next[r]) next[r].exams++; });
      setCounts(next);
    } catch (error) {
      console.error('Error fetching room counts:', error);
    } finally {
      setLoadingCounts(false);
    }
  };

  const normName = (v: string) => v.trim().replace(/\s+/g, " ");
  const nameTaken = (name: string, exceptId?: string) =>
    rooms.some(r => r.id !== exceptId && r.name.trim().toLowerCase() === name.toLowerCase());

  const handleCreateRoom = async () => {
    const name = normName(formData.name);
    if (!name) {
      toast.error(tr("Le nom de la classe est obligatoire", "اسم القسم مطلوب", "Class name is required"));
      return;
    }
    if (nameTaken(name)) {
      toast.error(tr("Une classe porte déjà ce nom", "يوجد قسم بهذا الاسم", "A class with this name already exists"));
      return;
    }
    if (loading) return;
    setLoading(true);
    try {
      // Le contexte affiche lui-même le message de succès / d'erreur
      const ok = await addRoom({
        name,
        description: formData.description || null,
        is_visible: formData.is_visible
      } as any);
      if (!ok) return;
      setIsCreateDialogOpen(false);
      setFormData({ name: "", description: "", is_visible: true });
    } catch (error) {
      toast.error(tr("Impossible de créer la classe", "تعذر إنشاء القسم", "Failed to create class"));
      console.error("Error creating room:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditRoom = async () => {
    const name = normName(formData.name);
    if (!editingRoom || !name) {
      toast.error(tr("Le nom de la classe est obligatoire", "اسم القسم مطلوب", "Class name is required"));
      return;
    }
    if (nameTaken(name, editingRoom.id)) {
      toast.error(tr("Une classe porte déjà ce nom", "يوجد قسم بهذا الاسم", "A class with this name already exists"));
      return;
    }
    if (loading) return;
    setLoading(true);
    try {
      const ok = await updateRoom(editingRoom.id, {
        name,
        description: formData.description || null,
        is_visible: formData.is_visible
      } as any);
      if (!ok) return;
      setEditingRoom(null);
      setFormData({ name: "", description: "", is_visible: true });
    } catch (error) {
      toast.error(tr("Impossible de mettre à jour la classe", "تعذر تحديث القسم", "Failed to update class"));
      console.error("Error updating room:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (deleting) return;
    // 1) Habilitation AVANT toute suppression
    if (!accessStore.guard("class.delete")) return;
    setDeleting(true);
    const TOTAL = 10;
    let step = 0;
    const progress = (label: string) => { step++; setDeleteStep({ done: step, total: TOTAL, label }); };
    const check = (res: { error: any }, what: string) => {
      if (res.error) {
        const err: any = new Error(what);
        err.step = what;
        err.cause = res.error;
        throw err;
      }
    };
    try {
      progress(tr("Analyse du contenu", "تحليل المحتوى", "Analysing content"));
      const coursesRes = await supabase.from('courses').select('id').eq('room_id', roomId);
      check(coursesRes, tr("lecture des cours", "قراءة الدروس", "reading courses"));
      const courseIds = (coursesRes.data || []).map(c => c.id);

      let examIds: string[] = [];
      let submissionIds: string[] = [];
      let questionIds: string[] = [];
      if (courseIds.length > 0) {
        const examsRes = await supabase.from('exams').select('id').in('course_id', courseIds);
        check(examsRes, tr("lecture des examens", "قراءة الامتحانات", "reading exams"));
        examIds = (examsRes.data || []).map(e => e.id);
        if (examIds.length > 0) {
          const [subsRes, qRes] = await Promise.all([
            supabase.from('quiz_submissions').select('id').in('exam_id', examIds),
            supabase.from('quiz_questions').select('id').in('exam_id', examIds),
          ]);
          check(subsRes, tr("lecture des copies", "قراءة الإجابات", "reading submissions"));
          check(qRes, tr("lecture des questions", "قراءة الأسئلة", "reading questions"));
          submissionIds = (subsRes.data || []).map(s => s.id);
          questionIds = (qRes.data || []).map(q => q.id);
        }
      }

      progress(tr("Réponses des élèves", "إجابات التلاميذ", "Student answers"));
      if (submissionIds.length) check(await supabase.from('quiz_answers').delete().in('submission_id', submissionIds), tr("suppression des réponses", "حذف الإجابات", "deleting answers"));
      progress(tr("Copies de quiz", "أوراق الاختبارات", "Quiz submissions"));
      if (submissionIds.length) check(await supabase.from('quiz_submissions').delete().in('id', submissionIds), tr("suppression des copies", "حذف الأوراق", "deleting submissions"));
      progress(tr("Options des questions", "خيارات الأسئلة", "Question options"));
      if (questionIds.length) check(await supabase.from('quiz_options').delete().in('question_id', questionIds), tr("suppression des options", "حذف الخيارات", "deleting options"));
      progress(tr("Questions", "الأسئلة", "Questions"));
      if (questionIds.length) check(await supabase.from('quiz_questions').delete().in('id', questionIds), tr("suppression des questions", "حذف الأسئلة", "deleting questions"));
      progress(tr("Exercices et examens", "التمارين والامتحانات", "Exercises and exams"));
      if (courseIds.length) {
        check(await supabase.from('exercises').delete().in('course_id', courseIds), tr("suppression des exercices", "حذف التمارين", "deleting exercises"));
        check(await supabase.from('exams').delete().in('course_id', courseIds), tr("suppression des examens", "حذف الامتحانات", "deleting exams"));
      }
      progress(tr("Supports de cours", "موارد الدروس", "Course materials"));
      if (courseIds.length) check(await supabase.from('course_materials').delete().in('course_id', courseIds), tr("suppression des supports", "حذف الموارد", "deleting materials"));
      progress(tr("Cours", "الدروس", "Courses"));
      if (courseIds.length) check(await supabase.from('courses').delete().in('id', courseIds), tr("suppression des cours", "حذف الدروس", "deleting courses"));
      progress(tr("Inscriptions", "التسجيلات", "Enrollments"));
      check(await supabase.from('enrollments').delete().eq('room_id', roomId), tr("suppression des inscriptions", "حذف التسجيلات", "deleting enrollments"));
      progress(tr("Classe", "القسم", "Class"));
      // Suppression de la classe : le contexte vérifie l'erreur et affiche le message de succès
      const ok = await deleteRoom(roomId);
      if (!ok) return;
      setDeleteTarget(null);
    } catch (error: any) {
      console.error("Error deleting room:", error);
      toast.error(
        tr(
          `Suppression interrompue (${error?.step || "erreur"}). Le reste de la classe n'a pas été supprimé.`,
          `توقف الحذف (${error?.step || "خطأ"}). لم يتم حذف باقي القسم.`,
          `Deletion stopped (${error?.step || "error"}). The rest of the class was not deleted.`
        )
      );
    } finally {
      setDeleting(false);
      setDeleteStep(null);
    }
  };

  // Inline rename
  const startRename = (room: Room) => {
    setRenamingId(room.id);
    setRenameValue(room.name);
  };
  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };
  const submitRename = async (room: Room) => {
    const name = renameValue.trim().replace(/\s+/g, " ");
    if (!name) {
      toast.error(language === "ar" ? "اسم القسم مطلوب" : language === "fr" ? "Le nom de la classe est obligatoire" : "Class name is required");
      return;
    }
    if (name === room.name) { cancelRename(); return; }
    if (rooms.some(r => r.id !== room.id && r.name.trim().toLowerCase() === name.toLowerCase())) {
      toast.error(language === "ar" ? "يوجد قسم بهذا الاسم" : language === "fr" ? "Une classe porte déjà ce nom" : "A class with this name already exists");
      return;
    }
    if (renaming) return;
    setRenaming(true);
    try {
      const ok = await updateRoom(room.id, { name });
      // Le contexte affiche déjà le message de succès
      if (ok) cancelRename();
    } finally {
      setRenaming(false);
    }
  };

  const renderRoomName = (room: Room, big = false) =>
    renamingId === room.id ? (
      <form
        className="flex items-center gap-1 min-w-0"
        onSubmit={e => { e.preventDefault(); submitRename(room); }}
        onClick={e => e.stopPropagation()}
      >
        <Input
          autoFocus
          value={renameValue}
          onChange={e => setRenameValue(e.target.value)}
          onKeyDown={e => { if (e.key === "Escape") cancelRename(); }}
          className={big ? "h-9 text-base font-semibold" : "h-8 text-sm"}
          disabled={renaming}
          maxLength={80}
        />
        <Button type="submit" size="icon" variant="ghost" className={`${iconBtn} shrink-0 text-emerald-600`} disabled={renaming} title={tr("Enregistrer", "حفظ", "Save")} aria-label={tr("Enregistrer", "حفظ", "Save")}>
          <Check className="h-4 w-4" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className={`${iconBtn} shrink-0`} onClick={cancelRename} disabled={renaming} title={tr("Annuler", "إلغاء", "Cancel")} aria-label={tr("Annuler", "إلغاء", "Cancel")}>
          <X className="h-4 w-4" />
        </Button>
      </form>
    ) : (
      <span className="group/name inline-flex items-center gap-1.5 min-w-0">
        <span className={`truncate ${big ? "" : "font-medium"}`}>{room.name}</span>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); startRename(room); }}
          className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded text-muted-foreground opacity-60 hover:bg-muted hover:text-foreground hover:opacity-100 group-hover/name:opacity-100 focus-visible:opacity-100 [@media(pointer:coarse)]:opacity-100"
          title={language === "ar" ? "إعادة التسمية" : language === "fr" ? "Renommer" : "Rename"}
          aria-label={language === "ar" ? "إعادة التسمية" : language === "fr" ? "Renommer" : "Rename"}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </span>
    );

  const renderActions = (room: Room) => (
    <div className="flex gap-1 shrink-0">
      <Button
        variant="ghost"
        size="icon"
        className={iconBtn}
        onClick={() => openEditDialog(room)}
        aria-label={tr(`Modifier la classe ${room.name}`, `تعديل القسم ${room.name}`, `Edit class ${room.name}`)}
        title={tr("Modifier", "تعديل", "Edit")}
      >
        <Edit className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={iconBtn}
        onClick={() => setClearTarget(room)}
        aria-label={tr(`Vider la classe ${room.name}`, `إفراغ القسم ${room.name}`, `Clear class ${room.name}`)}
        title={tr("Vider la classe", "إفراغ القسم", "Clear class")}
      >
        <Eraser className="h-4 w-4 text-amber-500 hover:text-amber-600" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={iconBtn}
        onClick={() => setDeleteTarget(room)}
        aria-label={tr(`Supprimer la classe ${room.name}`, `حذف القسم ${room.name}`, `Delete class ${room.name}`)}
        title={tr("Supprimer", "حذف", "Delete")}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );

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
        <p className="text-muted-foreground">{language === "ar" ? "الوصول مرفوض. إدارة الأقسام متاحة للأساتذة فقط." : language === "fr" ? "Accès refusé. Seuls les professeurs peuvent gérer les classes." : "Access denied. Only professors can manage classes."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{t("Class Management")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("Manage your classes and their associated content")}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ViewToggle
            view={viewMode}
            onViewChange={(view) => setViewMode(view)}
          />
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              {t("Create New Class")}
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
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
              <div className="flex items-center gap-2">
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
              <Button onClick={handleCreateRoom} disabled={loading} aria-busy={loading}>
                <Building className="h-4 w-4" />
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
            <p className="text-sm">{language === "ar" ? "جاري التحميل..." : language === "fr" ? "Chargement..." : "Loading..."}</p>
          </div>
        </div>
      ) : viewMode === "table" ? (
        <div className="app-table-wrap">
          <table className="app-table w-full text-sm min-w-[650px]">
            <thead>
              <tr>
                <th className="p-4 text-start font-medium">{language === "ar" ? "اسم القسم" : language === "fr" ? "Nom de la classe" : "Class Name"}</th>
                <th className="p-4 text-start font-medium">{language === "ar" ? "الوصف" : language === "fr" ? "Description" : "Description"}</th>
                <th className="p-4 text-start font-medium">{language === "ar" ? "الدروس" : language === "fr" ? "Cours" : "Courses"}</th>
                <th className="p-4 text-start font-medium">{language === "ar" ? "التلاميذ" : language === "fr" ? "Élèves" : "Students"}</th>
                <th className="p-4 text-start font-medium">{language === "ar" ? "التمارين" : language === "fr" ? "Exercices" : "Exercises"}</th>
                <th className="p-4 text-start font-medium">{language === "ar" ? "الامتحانات" : language === "fr" ? "Examens" : "Exams"}</th>
                <th className="p-4 text-start font-medium">{language === "ar" ? "الرؤية" : language === "fr" ? "Visibilité" : "Visibility"}</th>
                <th className="p-4 text-start font-medium">{language === "ar" ? "الإجراءات" : language === "fr" ? "Actions" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {roomsWithCounts.map((room) => (
                <tr key={room.id}>
                  <td className="p-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building className="h-4 w-4 text-primary shrink-0" />
                      {renderRoomName(room)}
                    </div>
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {room.description || (language === "ar" ? "لا يوجد وصف" : language === "fr" ? "Aucune description" : "No description")}
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
                      {room.is_visible ? (language === "ar" ? "مرئي" : language === "fr" ? "Visible" : "Visible") : (language === "ar" ? "مخفي" : language === "fr" ? "Masqué" : "Hidden")}
                    </span>
                  </td>
                  <td className="p-4">
                    {renderActions(room)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {roomsWithCounts.length === 0 && !loadingCounts && (
            <div className="p-8 text-center">
              <Building className="h-12 w-12 text-muted-foreground mb-4 mx-auto" />
              <p className="text-lg font-medium mb-2">{language === "ar" ? "لم يتم إنشاء أي قسم بعد" : language === "fr" ? "Aucune classe créée pour l'instant" : "No classes created yet"}</p>
              <p className="text-muted-foreground text-center mb-4">
                {language === "ar" ? "أنشئ قسمك الأول لتنظيم الدروس والتلاميذ" : language === "fr" ? "Créez votre première classe pour organiser vos cours et vos élèves" : "Create your first class to start organizing courses and students"}
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4" />
                {language === "ar" ? "إنشاء أول قسم" : language === "fr" ? "Créer ma première classe" : "Create Your First Class"}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {roomsWithCounts.map((room) => (
          <Card key={room.id} className="relative card-hover">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <CardTitle className="flex items-center gap-2 min-w-0">
                    <Building className="h-5 w-5 text-primary shrink-0" />
                    {renderRoomName(room, true)}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {room.description || (language === "ar" ? "لا يوجد وصف" : language === "fr" ? "Aucune description" : "No description")}
                  </CardDescription>
                </div>
                {renderActions(room)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">{room._count?.courses} {language === "ar" ? "دروس" : language === "fr" ? "Cours" : "Courses"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-green-600" />
                  <span className="text-sm">{room._count?.students} {language === "ar" ? "تلاميذ" : language === "fr" ? "Élèves" : "Students"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-orange-600" />
                  <span className="text-sm">{room._count?.exercises} {language === "ar" ? "تمارين" : language === "fr" ? "Exercices" : "Exercises"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-purple-600" />
                  <span className="text-sm">{room._count?.exams} {language === "ar" ? "امتحانات" : language === "fr" ? "Examens" : "Exams"}</span>
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
            <p className="text-lg font-medium mb-2">{language === "ar" ? "لم يتم إنشاء أي قسم بعد" : language === "fr" ? "Aucune classe créée pour l'instant" : "No classes created yet"}</p>
            <p className="text-muted-foreground text-center mb-4">
              {language === "ar" ? "أنشئ قسمك الأول لتنظيم الدروس والتلاميذ" : language === "fr" ? "Créez votre première classe pour organiser vos cours et vos élèves" : "Create your first class to start organizing courses and students"}
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              {language === "ar" ? "إنشاء أول قسم" : language === "fr" ? "Créer ma première classe" : "Create Your First Class"}
            </Button>
        </CardContent>
      </Card>
    )}

      {/* Suppression d'une classe (une seule boîte, reste ouverte pendant l'opération) */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o && !deleting) setDeleteTarget(null); }}>
        <AlertDialogContent>
          {deleteTarget && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  {tr("Supprimer la classe", "حذف القسم", "Delete Class")}
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div>
                    {tr(`La classe « ${deleteTarget.name} » et tout son contenu seront supprimés définitivement :`, `سيتم حذف القسم "${deleteTarget.name}" وكل محتواه نهائياً:`, `This will permanently delete the class "${deleteTarget.name}" and ALL related content:`)}
                    <ul className="mt-2 list-disc list-inside space-y-1">
                      <li>{deleteTarget._count?.courses} {tr("cours", "دروس", "courses")}</li>
                      <li>{deleteTarget._count?.exercises} {tr("exercices", "تمارين", "exercises")}</li>
                      <li>{deleteTarget._count?.exams} {tr("examens et quiz", "امتحانات واختبارات", "exams & quizzes")}</li>
                      <li>{deleteTarget._count?.students} {tr("inscriptions d'élèves", "تسجيلات التلاميذ", "student enrollments")}</li>
                    </ul>
                    <p className="mt-2">{tr("Cette action est irréversible.", "لا يمكن التراجع عن هذا الإجراء.", "This action cannot be undone.")}</p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              {deleting && deleteStep && (
                <div className="space-y-2" role="status" aria-live="polite">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{tr("Suppression en cours…", "جارٍ الحذف…", "Deleting…")} {deleteStep.label} ({deleteStep.done}/{deleteStep.total})</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-destructive transition-all" style={{ width: `${Math.round((deleteStep.done / deleteStep.total) * 100)}%` }} />
                  </div>
                </div>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>{tr("Annuler", "إلغاء", "Cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  disabled={deleting}
                  onClick={(e) => { e.preventDefault(); void handleDeleteRoom(deleteTarget.id); }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {tr("Tout supprimer", "حذف كل شيء", "Delete Everything")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      <ClearRoomDialog
        open={!!clearTarget}
        onOpenChange={(o) => { if (!o) setClearTarget(null); }}
        room={clearTarget}
        onDone={async () => {
          await refreshData();
          await fetchRoomsWithCounts();
        }}
      />

      {/* Edit Dialog */}
      <Dialog open={!!editingRoom} onOpenChange={() => setEditingRoom(null)}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "تعديل القسم" : language === "fr" ? "Modifier la classe" : "Edit Class"}</DialogTitle>
            <DialogDescription>
              {language === "ar" ? "تحديث معلومات القسم" : language === "fr" ? "Mettre à jour les informations de la classe" : "Update the class information"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{language === "ar" ? "اسم القسم *" : language === "fr" ? "Nom de la classe *" : "Class Name *"}</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder={language === "ar" ? "أدخل اسم القسم..." : language === "fr" ? "Saisissez le nom de la classe..." : "Enter class name..."}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">{language === "ar" ? "الوصف" : language === "fr" ? "Description" : "Description"}</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={language === "ar" ? "أدخل وصف القسم..." : language === "fr" ? "Saisissez la description de la classe..." : "Enter class description..."}
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="edit-visibility"
                checked={formData.is_visible}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_visible: checked }))}
              />
              <Label htmlFor="edit-visibility">{language === "ar" ? "جعل القسم مرئيًا للتلاميذ" : language === "fr" ? "Rendre la classe visible pour les élèves" : "Make class visible to students"}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRoom(null)}>
              {language === "ar" ? "إلغاء" : language === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button onClick={handleEditRoom} disabled={loading}>
              <Edit className="h-4 w-4" />
              {language === "ar" ? "تحديث القسم" : language === "fr" ? "Mettre à jour la classe" : "Update Class"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClassManagement;
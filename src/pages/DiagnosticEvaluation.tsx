import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users,
  Edit3,
  PieChart as PieChartIcon,
  ClipboardCheck,
  Settings as SettingsIcon,
  Printer,
  FileSpreadsheet,
  PlusCircle,
  Trash2,
  Upload,
  Download,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Eye,
  GraduationCap,
  Calendar,
  Sparkles,
  RefreshCw,
  Database,
  Building,
  Check,
  CheckSquare,
  Square,
  BarChart2,
  Layers,
  Filter,
  Zap
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

import { useAuth } from "@/contexts/AuthContext";
import { useCourses } from "@/contexts/CourseContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  DiagnosticAppData,
  loadDiagnosticData,
  saveDiagnosticData,
  resetDiagnosticDataToDefaults,
  DEFAULT_DIAGNOSTIC_DATA
} from "@/lib/diagnosticStorage";
import {
  DiagnosticClass,
  DiagnosticStudent,
  computeAllStats,
  calculateClassStats,
  parseNoteValue
} from "@/lib/diagnosticStatsEngine";
import {
  downloadSampleDiagnosticExcel,
  parseExcelStudentsFile
} from "@/lib/diagnosticExcelHandler";
import {
  fetchDiagnosticClassesFromSupabase,
  saveStoredStudentNotes,
  saveStoredRoomDates,
  getStoredStudentNotes,
  getStoredRoomDates
} from "@/lib/diagnosticSupabaseBridge";
import {
  DiagLang,
  DIAGNOSTIC_TRANSLATIONS
} from "@/lib/diagnosticTranslations";
import { DiagnosticReportPrint } from "@/components/diagnostic/DiagnosticReportPrint";
import { exportDiagnosticReportToPdf } from "@/lib/diagnosticPdfExporter";
import * as XLSX from "xlsx";
import { downloadExcelFile } from "@/lib/download";

export const DiagnosticEvaluation: React.FC = () => {
  const { user } = useAuth();
  const { rooms, addRoom, courses, exams } = useCourses();
  const { language, getDirection } = useLanguage();

  // Langue active et traductions
  const lang: DiagLang = language === "ar" || language === "en" ? language : "fr";
  const t = DIAGNOSTIC_TRANSLATIONS[lang] || DIAGNOSTIC_TRANSLATIONS.fr;
  const isRtl = lang === "ar";

  const [appData, setAppData] = useState<DiagnosticAppData>(() => loadDiagnosticData());
  const [currentTab, setCurrentTab] = useState<"classes" | "notes" | "stats" | "observations" | "config" | "preview">("classes");
  const [activeClassId, setActiveClassId] = useState<string>("");
  const [dataSource, setDataSource] = useState<"supabase" | "sample">("supabase");
  const [loadingRealData, setLoadingRealData] = useState<boolean>(true);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  // --- NOUVEAUX ÉTATS POUR LE MODE DE NOTATION (MANUEL vs QUIZ) ---
  const [classGradingModes, setClassGradingModes] = useState<Record<string, "manual" | "quiz">>({});
  const [classSelectedQuiz, setClassSelectedQuiz] = useState<Record<string, string>>({});
  const [isSyncingQuiz, setIsSyncingQuiz] = useState<boolean>(false);

  // --- NOUVEAUX ÉTATS POUR LE PÉRIMÈTRE DU RAPPORT ET LES GRAPHES ---
  const [reportScope, setReportScope] = useState<"all" | "single" | "custom">("all");
  const [selectedSingleClassId, setSelectedSingleClassId] = useState<string>("");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [includeGraphsInReport, setIncludeGraphsInReport] = useState<boolean>(false);

  // Modals state
  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassDate, setNewClassDate] = useState("06-10-2024");
  const [editingClass, setEditingClass] = useState<DiagnosticClass | null>(null);

  // Delete confirmation dialogs
  const [classToDelete, setClassToDelete] = useState<DiagnosticClass | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<{id: string | number; name: string} | null>(null);
  const [observationToDelete, setObservationToDelete] = useState<number | null>(null);
  const [propositionToDelete, setPropositionToDelete] = useState<number | null>(null);
  const [exerciseToDeleteDiag, setExerciseToDeleteDiag] = useState<number | null>(null);
  const [isResetDefaultsOpen, setIsResetDefaultsOpen] = useState(false);

  const [isQuickEditConfigOpen, setIsQuickEditConfigOpen] = useState(false);
  const [editConfigDraft, setEditConfigDraft] = useState<any>(null);

  const [importTargetClass, setImportTargetClass] = useState<DiagnosticClass | null>(null);
  const [importingFile, setImportingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentMassar, setNewStudentMassar] = useState("");
  const [newStudentNote, setNewStudentNote] = useState("");

  // Local draft of notes being edited in Tab 2
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  // CHARGEMENT DYNAMIQUE DEPUIS SUPABASE (ROOMS DU PROFESSEUR CONNECTÉ)
  const activeClassIdRef = useRef(activeClassId);
  const selectedSingleClassIdRef = useRef(selectedSingleClassId);
  useEffect(() => { activeClassIdRef.current = activeClassId; }, [activeClassId]);
  useEffect(() => { selectedSingleClassIdRef.current = selectedSingleClassId; }, [selectedSingleClassId]);

  const loadDynamicDataFromSupabase = useCallback(async (force = false) => {
    setLoadingRealData(true);
    try {
      const realClasses = await fetchDiagnosticClassesFromSupabase(
        user?.id,
        rooms && rooms.length > 0 ? rooms : undefined
      );

      if (realClasses.length > 0) {
        setAppData(prev => ({
          ...prev,
          classes: realClasses
        }));
        setDataSource("supabase");
        if (!activeClassIdRef.current || !realClasses.some(c => c.id === activeClassIdRef.current)) {
          setActiveClassId(realClasses[0].id);
        }
        if (!selectedSingleClassIdRef.current || !realClasses.some(c => c.id === selectedSingleClassIdRef.current)) {
          setSelectedSingleClassId(realClasses[0].id);
        }
        setSelectedClassIds(realClasses.map(c => c.id));
        if (force) {
          toast.success(`${realClasses.length} ${t.selectedClassesCount}`);
        }
      } else {
        // Aucune classe trouvée dans Supabase : afficher liste vide
        setAppData(prev => ({
          ...prev,
          classes: []
        }));
        setDataSource("supabase");
        setActiveClassId("");
        setSelectedSingleClassId("");
        setSelectedClassIds([]);
        if (force) {
          toast.info(t.noClassesMessage);
        }
      }
    } catch (err) {
      console.error("Erreur de synchronisation:", err);
      if (force) toast.error("Erreur de chargement");
    } finally {
      setLoadingRealData(false);
    }
  }, [user?.id, rooms, t]);

  useEffect(() => {
    loadDynamicDataFromSupabase();
  }, [rooms, loadDynamicDataFromSupabase]);

  useEffect(() => {
    if (!activeClassId && appData.classes.length > 0) {
      setActiveClassId(appData.classes[0].id);
    }
    if (!selectedSingleClassId && appData.classes.length > 0) {
      setSelectedSingleClassId(appData.classes[0].id);
    }
  }, [appData.classes, activeClassId, selectedSingleClassId]);

  // Classe active pour l'onglet de saisie
  const currentClass = useMemo(() => {
    return appData.classes.find(c => c.id === activeClassId) || appData.classes[0] || null;
  }, [appData.classes, activeClassId]);

  useEffect(() => {
    if (currentClass) {
      const initial: Record<string, string> = {};
      currentClass.students.forEach(s => {
        initial[String(s.id)] = s.note !== null && s.note !== undefined ? String(s.note) : "";
      });
      setNotesDraft(initial);
    }
  }, [currentClass]);

  // --- GESTION DU MODE DE SAISIE (MANUELLE vs QUIZ PLATEFORME) ---
  const currentGradingMode = classGradingModes[activeClassId] || "manual";

  // Quizz disponibles pour la classe active
  const classCourses = useMemo(() => {
    return courses.filter(c => c.room_id === activeClassId);
  }, [courses, activeClassId]);

  const classCourseIds = useMemo(() => classCourses.map(c => c.id), [classCourses]);

  const availableQuizzes = useMemo(() => {
    // 1. Quizz appartenant directement aux cours de cette classe
    const direct = exams.filter(e => classCourseIds.includes(e.course_id));
    // 2. Autres quizz disponibles du professeur
    const other = exams.filter(e => !classCourseIds.includes(e.course_id));
    return {
      direct,
      other,
      all: [...direct, ...other]
    };
  }, [exams, classCourseIds]);

  const currentSelectedQuizId = classSelectedQuiz[activeClassId] || availableQuizzes.direct[0]?.id || availableQuizzes.all[0]?.id || "";

  // Synchronisation des notes d'un Quiz avec la classe active
  const handleSyncNotesFromQuiz = async (quizIdOverride?: string) => {
    const quizId = quizIdOverride || currentSelectedQuizId;
    if (!quizId) {
      toast.error(t.noQuizAvailableForClass);
      return;
    }

    if (!currentClass) return;

    setIsSyncingQuiz(true);
    try {
      const { data: submissions, error } = await supabase
        .from("quiz_submissions")
        .select("*")
        .eq("exam_id", quizId);

      if (error) {
        console.error("Erreur récupération soumissions:", error);
        toast.error(lang === "ar" ? "تعذر جلب نتائج الاختبار" : "Erreur lors de la récupération des notes du quiz");
        return;
      }

      const submissionMap = new Map<string, any>();
      (submissions || []).forEach(sub => {
        if (!submissionMap.has(sub.student_id)) {
          submissionMap.set(sub.student_id, sub);
        } else {
          const prev = submissionMap.get(sub.student_id);
          if ((sub.score ?? 0) > (prev.score ?? 0)) {
            submissionMap.set(sub.student_id, sub);
          }
        }
      });

      let presentCount = 0;
      let absentCount = 0;
      const newDraft = { ...notesDraft };

      const updatedStudents = currentClass.students.map(student => {
        const sub = submissionMap.get(String(student.id));
        let finalNote: string | number;

        if (sub && sub.score !== null && sub.score !== undefined) {
          let numScore = Number(sub.score);
          let totalPts = Number(sub.total_points || 0);
          let note20: number;

          if (totalPts > 0) {
            note20 = (numScore / totalPts) * 20;
          } else if (numScore <= 20) {
            note20 = numScore;
          } else {
            note20 = (numScore / 100) * 20;
          }

          note20 = Math.round(note20 * 100) / 100;
          note20 = Math.max(0, Math.min(20, note20));
          finalNote = note20;
          newDraft[String(student.id)] = String(note20);
          presentCount++;
        } else {
          finalNote = "ABS";
          newDraft[String(student.id)] = "ABS";
          absentCount++;
        }

        return {
          ...student,
          note: finalNote
        };
      });

      // Mettre à jour le draft
      setNotesDraft(newDraft);

      // Enregistrer dans le stockage local des notes
      const storedNotes = getStoredStudentNotes();
      updatedStudents.forEach(s => {
        storedNotes[String(s.id)] = s.note;
      });
      saveStoredStudentNotes(storedNotes);

      // Mettre à jour l'état appData
      updateAppData(prev => ({
        ...prev,
        classes: prev.classes.map(c => c.id === currentClass.id ? { ...c, students: updatedStudents } : c)
      }));

      const targetQuiz = exams.find(e => e.id === quizId);
      const quizName = targetQuiz?.title || "Quiz";

      toast.success(
        lang === "ar"
          ? `✅ تم استيراد النقط من "${quizName}" : ${presentCount} حاضر(ة)، ${absentCount} غائب(ة) (ABS)`
          : `✅ Notes synchronisées depuis "${quizName}" : ${presentCount} noté(s), ${absentCount} absent(s) (ABS)`
      );
    } catch (err) {
      console.error("Erreur synchronisation quiz:", err);
      toast.error("Erreur inattendue");
    } finally {
      setIsSyncingQuiz(false);
    }
  };

  // --- CALCUL DES CLASSES ET STATISTIQUES EN FONCTION DU PÉRIMÈTRE SÉLECTIONNÉ ---
  const classesForReport = useMemo(() => {
    if (reportScope === "single") {
      const found = appData.classes.find(c => c.id === selectedSingleClassId);
      return found ? [found] : (appData.classes.length > 0 ? [appData.classes[0]] : []);
    }
    if (reportScope === "custom") {
      const filtered = appData.classes.filter(c => selectedClassIds.includes(c.id));
      return filtered.length > 0 ? filtered : appData.classes;
    }
    return appData.classes; // "all"
  }, [appData.classes, reportScope, selectedSingleClassId, selectedClassIds]);

  const reportStats = useMemo(() => {
    return computeAllStats(classesForReport);
  }, [classesForReport]);

  const reportClassesNames = useMemo(() => {
    return classesForReport.map(c => c.nom);
  }, [classesForReport]);

  // Sauvegarde globale de l'état
  const updateAppData = (updater: (prev: DiagnosticAppData) => DiagnosticAppData) => {
    setAppData(prev => {
      const next = updater(prev);
      saveDiagnosticData(next);
      return next;
    });
  };

  // --- ACTIONS EXPORT PDF & IMPRESSION SÉPARÉES ---
  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    toast.info(t.downloadingPdfMsg);
    try {
      const scopeName = reportClassesNames.length === 1
        ? reportClassesNames[0]
        : (reportScope === "all" ? "Toutes_Classes" : "Selection");
      const filename = `Rapport_Evaluation_Diagnostique_${scopeName}_${lang}.pdf`;

      if (currentTab !== "preview") {
        setCurrentTab("preview");
        await new Promise(r => setTimeout(r, 450));
      }

      const ok = await exportDiagnosticReportToPdf("diagnostic-official-report", filename);
      if (ok) {
        toast.success(lang === "ar" ? "تم تحميل التقرير بصيغة PDF بنجاح !" : "Rapport téléchargé avec succès en PDF !");
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur lors du téléchargement du PDF");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrintReport = () => {
    if (currentTab !== "preview") {
      setCurrentTab("preview");
      setTimeout(() => window.print(), 350);
    } else {
      window.print();
    }
  };

  // --- ACTIONS CLASSES ---
  const handleAddClass = async () => {
    if (!newClassName.trim()) {
      toast.error(t.classesHeaderTitle);
      return;
    }

    try {
      if (user && addRoom) {
        const ok = await addRoom({
          name: newClassName.trim(),
          description: "Classe créée pour l'évaluation diagnostique",
          is_visible: true
        });
        if (ok) {
          toast.success(`Classe "${newClassName.trim()}" créée avec succès !`);
          setIsAddClassOpen(false);
          setNewClassName("");
          await loadDynamicDataFromSupabase(false);
          return;
        }
      }
    } catch (e) {
      console.warn("Création Supabase échouée, fallback local:", e);
    }

    const newId = `c_${Date.now().toString(36)}`;
    const newCls: DiagnosticClass = {
      id: newId,
      nom: newClassName.trim(),
      date: newClassDate.trim() || "06-10-2024",
      students: []
    };
    updateAppData(prev => ({
      ...prev,
      classes: [...prev.classes, newCls]
    }));
    setActiveClassId(newId);
    setSelectedClassIds(prev => [...prev, newId]);
    setIsAddClassOpen(false);
    setNewClassName("");
    toast.success(`Classe "${newCls.nom}" ajoutée.`);
  };

  const handleUpdateClass = () => {
    if (!editingClass || !editingClass.nom.trim()) return;

    const storedDates = getStoredRoomDates();
    storedDates[editingClass.id] = editingClass.date;
    saveStoredRoomDates(storedDates);

    updateAppData(prev => ({
      ...prev,
      classes: prev.classes.map(c => c.id === editingClass.id ? editingClass : c)
    }));
    setEditingClass(null);
    toast.success(t.editClassBtn);
  };

  const handleDeleteClass = async (id: string) => {
    const cls = appData.classes.find(c => c.id === id);
    if (cls) setClassToDelete(cls);
  };

  const confirmDeleteClass = async () => {
    if (!classToDelete) return;
    const id = classToDelete.id;
    updateAppData(prev => {
      const filtered = prev.classes.filter(c => c.id !== id);
      return { ...prev, classes: filtered };
    });
    setSelectedClassIds(prev => prev.filter(cid => cid !== id));
    if (activeClassId === id) {
      setActiveClassId(appData.classes.find(c => c.id !== id)?.id || "");
    }
    setClassToDelete(null);
    toast.success(t.deleteClassBtn);
  };

  const handleToggleDataSource = () => {
    if (dataSource === "supabase") {
      setAppData(prev => ({
        ...prev,
        classes: DEFAULT_DIAGNOSTIC_DATA.classes
      }));
      setActiveClassId(DEFAULT_DIAGNOSTIC_DATA.classes[0].id);
      setSelectedSingleClassId(DEFAULT_DIAGNOSTIC_DATA.classes[0].id);
      setSelectedClassIds(DEFAULT_DIAGNOSTIC_DATA.classes.map(c => c.id));
      setDataSource("sample");
      toast.info(t.demoModeBadge);
    } else {
      loadDynamicDataFromSupabase(true);
    }
  };

  // --- ACTIONS EXCEL ---
  const handleDownloadExcelForClass = (targetClass: DiagnosticClass) => {
    if (!targetClass || targetClass.students.length === 0) {
      downloadSampleDiagnosticExcel(targetClass?.nom || "Classe");
      return;
    }

    const wb = XLSX.utils.book_new();
    const data: (string | number)[][] = [
      [t.numCol, t.massarCol, t.studentNameCol, t.noteCol]
    ];

    targetClass.students.forEach((s, idx) => {
      data.push([
        idx + 1,
        s.massar || `M13000${idx + 1}`,
        s.name,
        s.note !== null && s.note !== undefined ? s.note : ""
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 8 }, { wch: 18 }, { wch: 30 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, targetClass.nom.substring(0, 30));
    downloadExcelFile(wb, `liste_diagnostic_${targetClass.nom}.xlsx`);
    toast.success(`${t.downloadClassTemplateBtn} (${targetClass.students.length})`);
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !importTargetClass) return;

    setImportingFile(true);
    try {
      const importedStudents = await parseExcelStudentsFile(file);
      if (importedStudents.length === 0) {
        toast.error(t.noStudentsMessage);
        return;
      }

      const existingStudents = [...importTargetClass.students];
      const storedNotes = getStoredStudentNotes();

      if (existingStudents.length > 0) {
        let matchedCount = 0;
        const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, "");

        existingStudents.forEach(exStudent => {
          const match = importedStudents.find(imp => {
            if (imp.massar && exStudent.massar && normalize(imp.massar) === normalize(exStudent.massar)) {
              return true;
            }
            return normalize(imp.name) === normalize(exStudent.name);
          });

          if (match && match.note !== null) {
            exStudent.note = match.note;
            storedNotes[String(exStudent.id)] = match.note;
            matchedCount++;
          }
        });

        const newStudents = importedStudents.filter(imp => {
          return !existingStudents.some(ex => {
            if (imp.massar && ex.massar && normalize(imp.massar) === normalize(ex.massar)) return true;
            return normalize(imp.name) === normalize(ex.name);
          });
        });

        newStudents.forEach(ns => {
          existingStudents.push(ns);
          if (ns.note !== null) {
            storedNotes[String(ns.id)] = ns.note;
          }
        });

        saveStoredStudentNotes(storedNotes);

        updateAppData(prev => ({
          ...prev,
          classes: prev.classes.map(c => c.id === importTargetClass.id ? { ...c, students: existingStudents } : c)
        }));

        toast.success(`${matchedCount} élèves mis à jour, ${newStudents.length} ajoutés.`);
      } else {
        importedStudents.forEach(s => {
          if (s.note !== null) {
            storedNotes[String(s.id)] = s.note;
          }
        });
        saveStoredStudentNotes(storedNotes);

        updateAppData(prev => ({
          ...prev,
          classes: prev.classes.map(c => c.id === importTargetClass.id ? { ...c, students: importedStudents } : c)
        }));

        toast.success(`${importedStudents.length} élèves importés.`);
      }

      setImportTargetClass(null);
    } catch (err: any) {
      console.error(err);
      toast.error(`Erreur : ${err.message || "Fichier invalide"}`);
    } finally {
      setImportingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // --- ACTIONS SAISIE DES NOTES ---
  const handleNoteChange = (studentId: string | number, val: string) => {
    setNotesDraft(prev => ({ ...prev, [String(studentId)]: val }));
  };

  const handleSaveNotes = () => {
    if (!currentClass) return;

    const storedNotes = getStoredStudentNotes();

    const updatedStudents = currentClass.students.map(s => {
      const raw = notesDraft[String(s.id)];
      let finalNote: number | string | null = null;

      if (raw !== undefined && raw !== "" && raw !== null) {
        if (raw.trim().toUpperCase() === "ABS") {
          finalNote = "ABS";
        } else {
          const parsed = parseFloat(raw.replace(",", "."));
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 20) {
            finalNote = Math.round(parsed * 100) / 100;
          }
        }
      }

      storedNotes[String(s.id)] = finalNote;
      return { ...s, note: finalNote };
    });

    saveStoredStudentNotes(storedNotes);

    updateAppData(prev => ({
      ...prev,
      classes: prev.classes.map(c => c.id === currentClass.id ? { ...c, students: updatedStudents } : c)
    }));

    toast.success(t.saveNotesBtn);
  };

  const handleAddStudent = () => {
    if (!currentClass || !newStudentName.trim()) return;

    const newId = `std_${Date.now().toString(36)}`;
    const finalNote = newStudentNote.trim().toUpperCase() === "ABS"
      ? "ABS"
      : parseNoteValue(newStudentNote);

    const newStudent: DiagnosticStudent = {
      id: newId,
      num: currentClass.students.length + 1,
      massar: newStudentMassar.trim() || `M13${1000 + currentClass.students.length + 1}`,
      name: newStudentName.trim(),
      note: finalNote
    };

    const storedNotes = getStoredStudentNotes();
    storedNotes[newId] = finalNote;
    saveStoredStudentNotes(storedNotes);

    updateAppData(prev => ({
      ...prev,
      classes: prev.classes.map(c => {
        if (c.id === currentClass.id) {
          return { ...c, students: [...c.students, newStudent] };
        }
        return c;
      })
    }));

    setNotesDraft(prev => ({
      ...prev,
      [newId]: newStudent.note !== null ? String(newStudent.note) : ""
    }));

    setIsAddStudentOpen(false);
    setNewStudentName("");
    setNewStudentMassar("");
    setNewStudentNote("");
    toast.success(t.addStudentBtn);
  };

  const handleDeleteStudent = (studentId: string | number, studentName: string) => {
    setStudentToDelete({ id: studentId, name: studentName });
  };

  const confirmDeleteStudent = () => {
    if (!studentToDelete || !currentClass) return;
    updateAppData(prev => ({
      ...prev,
      classes: prev.classes.map(c => {
        if (c.id === currentClass.id) {
          const filtered = c.students.filter(s => s.id !== studentToDelete.id);
          return {
            ...c,
            students: filtered.map((s, idx) => ({ ...s, num: idx + 1 }))
          };
        }
        return c;
      })
    }));
    setStudentToDelete(null);
    toast.success(lang === "ar" ? "تم حذف التلميذ." : lang === "fr" ? "Élève retiré." : "Student removed.");
  };

  // --- ACTIONS OBSERVATIONS & PROPOSITIONS ---
  const handleAddObservation = () => {
    updateAppData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        observations: [...prev.config.observations, lang === "ar" ? "ملاحظة بيداغوجية جديدة..." : "Nouvelle observation pédagogique..."]
      }
    }));
  };

  const handleUpdateObservation = (index: number, val: string) => {
    updateAppData(prev => {
      const nextObs = [...prev.config.observations];
      nextObs[index] = val;
      return { ...prev, config: { ...prev.config, observations: nextObs } };
    });
  };

  const handleDeleteObservation = (index: number) => {
    setObservationToDelete(index);
  };

  const confirmDeleteObservation = () => {
    if (observationToDelete === null) return;
    updateAppData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        observations: prev.config.observations.filter((_, i) => i !== observationToDelete)
      }
    }));
    setObservationToDelete(null);
  };

  const handleAddProposition = () => {
    updateAppData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        propositions: [...prev.config.propositions, lang === "ar" ? "مقترح دعم ومعالجة جديد..." : "Nouvelle proposition de soutien..."]
      }
    }));
  };

  const handleUpdateProposition = (index: number, val: string) => {
    updateAppData(prev => {
      const nextProps = [...prev.config.propositions];
      nextProps[index] = val;
      return { ...prev, config: { ...prev.config, propositions: nextProps } };
    });
  };

  const handleDeleteProposition = (index: number) => {
    setPropositionToDelete(index);
  };

  const confirmDeleteProposition = () => {
    if (propositionToDelete === null) return;
    updateAppData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        propositions: prev.config.propositions.filter((_, i) => i !== propositionToDelete)
      }
    }));
    setPropositionToDelete(null);
  };

  const handleAddExercise = () => {
    updateAppData(prev => {
      const exNum = prev.config.exercices.length + 1;
      return {
        ...prev,
        config: {
          ...prev.config,
          exercices: [
            ...prev.config.exercices,
            {
              titre: lang === "ar" ? `تمرين ${exNum}` : `Exercice ${exNum}`,
              description: lang === "ar" ? "وصف المفاهيم والكفايات المستهدفة" : "Description des compétences évaluées"
            }
          ]
        }
      };
    });
  };

  const handleUpdateExercise = (index: number, field: "titre" | "description", val: string) => {
    updateAppData(prev => {
      const nextEx = [...prev.config.exercices];
      nextEx[index] = { ...nextEx[index], [field]: val };
      return { ...prev, config: { ...prev.config, exercices: nextEx } };
    });
  };

  const handleDeleteExercise = (index: number) => {
    setExerciseToDeleteDiag(index);
  };

  const confirmDeleteExerciseDiag = () => {
    if (exerciseToDeleteDiag === null) return;
    updateAppData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        exercices: prev.config.exercices.filter((_, i) => i !== exerciseToDeleteDiag)
      }
    }));
    setExerciseToDeleteDiag(null);
  };

  // Données graphiques basées sur classesForReport
  const chartData = useMemo(() => {
    return reportStats.classes_stats.map(cs => ({
      name: cs.nom,
      [t.tranche1Name]: cs.t1_count,
      [t.tranche2Name]: cs.t2_count,
      [t.tranche3Name]: cs.t3_count,
      [t.tranche4Name]: cs.t4_count
    }));
  }, [reportStats, t]);

  const pieData = useMemo(() => {
    const totalT1 = reportStats.classes_stats.reduce((acc, s) => acc + s.t1_count, 0);
    const totalT2 = reportStats.classes_stats.reduce((acc, s) => acc + s.t2_count, 0);
    const totalT3 = reportStats.classes_stats.reduce((acc, s) => acc + s.t3_count, 0);
    const totalT4 = reportStats.classes_stats.reduce((acc, s) => acc + s.t4_count, 0);

    return [
      { name: t.tranche1Name, value: totalT1, color: "#ef4444" },
      { name: t.tranche2Name, value: totalT2, color: "#f59e0b" },
      { name: t.tranche3Name, value: totalT3, color: "#3b82f6" },
      { name: t.tranche4Name, value: totalT4, color: "#10b981" }
    ];
  }, [reportStats, t]);

  const totalStudentsInApp = useMemo(() => {
    return appData.classes.reduce((sum, c) => sum + c.students.length, 0);
  }, [appData.classes]);

  // --- COMPOSANT DE SÉLECTION DU PÉRIMÈTRE & GRAPHES ---
  const renderReportScopeControls = () => (
    <Card className="border-indigo-100 dark:border-indigo-900 bg-gradient-to-r from-slate-50 via-indigo-50/30 to-slate-50 dark:from-slate-900 dark:via-indigo-950/20 dark:to-slate-900 no-print print:hidden">
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-indigo-600" />
              <span>{t.scopeLabel}</span>
            </span>

            {/* Boutons d'options de périmètre */}
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0.5 shadow-sm">
              <Button
                variant={reportScope === "all" ? "default" : "ghost"}
                size="sm"
                onClick={() => setReportScope("all")}
                className="h-7 text-xs px-2.5 rounded-md"
              >
                {t.scopeAllClasses}
              </Button>
              <Button
                variant={reportScope === "single" ? "default" : "ghost"}
                size="sm"
                onClick={() => setReportScope("single")}
                className="h-7 text-xs px-2.5 rounded-md"
              >
                {t.scopeSingleClass}
              </Button>
              <Button
                variant={reportScope === "custom" ? "default" : "ghost"}
                size="sm"
                onClick={() => setReportScope("custom")}
                className="h-7 text-xs px-2.5 rounded-md"
              >
                {t.scopeCustom}
              </Button>
            </div>
          </div>

          {/* Toggle Option Graphiques & Analyse */}
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
            <Switch
              id="include-graphs-toggle"
              checked={includeGraphsInReport}
              onCheckedChange={setIncludeGraphsInReport}
            />
            <Label
              htmlFor="include-graphs-toggle"
              className="text-xs font-semibold cursor-pointer flex items-center gap-1.5 text-slate-800 dark:text-slate-200"
            >
              <BarChart2 className="w-4 h-4 text-indigo-600" />
              <span>{t.includeGraphsInReportLabel}</span>
            </Label>
          </div>
        </div>

        {/* Détails du sélecteur selon le mode choisi */}
        {reportScope === "single" && (
          <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500 font-medium">{t.selectClassLabel}</span>
            {appData.classes.map(c => (
              <Button
                key={c.id}
                variant={c.id === selectedSingleClassId ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedSingleClassId(c.id)}
                className="h-7 text-xs gap-1.5 rounded-md"
              >
                <span>{c.nom}</span>
                <Badge variant="secondary" className="px-1 py-0 text-[10px]">
                  {c.students.length}
                </Badge>
              </Button>
            ))}
          </div>
        )}

        {reportScope === "custom" && (
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 flex-wrap">
              {appData.classes.map(c => {
                const isChecked = selectedClassIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer border transition ${
                      isChecked
                        ? "bg-indigo-50 border-indigo-300 text-indigo-900 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-200"
                        : "bg-white border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-800"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedClassIds(prev => [...prev, c.id]);
                        } else {
                          setSelectedClassIds(prev => prev.filter(id => id !== c.id));
                        }
                      }}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                    />
                    <span>{c.nom}</span>
                    <span className="text-[10px] text-slate-400">({c.students.length})</span>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedClassIds(appData.classes.map(c => c.id))}
                className="h-6 text-[11px] text-indigo-600 px-2"
              >
                {t.selectAllBtn}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedClassIds([])}
                className="h-6 text-[11px] text-slate-500 px-2"
              >
                {t.deselectAllBtn}
              </Button>
            </div>
          </div>
        )}

        {/* Aperçu du scope actif */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
          <span>
            {t.classesHeaderTitle} : <strong>{reportClassesNames.join(", ") || t.noClassesMessage}</strong>
          </span>
          <span>
            {reportStats.total_presents} {t.presentCountLabel} • {includeGraphsInReport ? "📊 Avec graphes & analyse" : "📄 Format classique épuré"}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 pb-12" dir={getDirection()}>
      {/* Input de fichier caché pour l'importation Excel */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileImport}
        accept=".xlsx,.xls"
        className="hidden"
      />

      {/* TOP HEADER & TITLE BANNER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 no-print print:hidden">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900 rounded-2xl flex items-center justify-center p-2 shadow-inner shrink-0">
            <img
              src="/assets/header_logo.png"
              alt="Armoiries du Royaume du Maroc"
              className="max-h-full object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            <GraduationCap className="w-8 h-8 text-indigo-600 hidden" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {t.appTitle}
              </h1>
              <Badge variant="secondary" className="bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold text-xs uppercase">
                {t.appEdition}
              </Badge>
              {dataSource === "supabase" ? (
                <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 text-[11px] gap-1 flex items-center">
                  <Database className="w-3 h-3" />
                  <span>{t.connectedToClassManagement} ({appData.classes.length} classes, {totalStudentsInApp} élèves)</span>
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 text-[11px] gap-1 flex items-center">
                  <span>{t.demoModeBadge}</span>
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {t.appSubtitle}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadDynamicDataFromSupabase(true)}
            disabled={loadingRealData}
            className="text-xs gap-1.5 border-slate-200 dark:border-slate-700"
            title={t.refreshBtn}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-sky-600 ${loadingRealData ? "animate-spin" : ""}`} />
            <span>{t.refreshBtn}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleDataSource}
            className="text-xs gap-1.5 border-slate-200 dark:border-slate-700"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>{t.toggleDemoBtn}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownloadExcelForClass(currentClass || appData.classes[0])}
            className="text-xs gap-1.5 border-slate-200 dark:border-slate-700"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{t.downloadClassTemplateBtn} {currentClass ? `(${currentClass.nom})` : ""}</span>
          </Button>

          <Button
            size="sm"
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-100 dark:shadow-none font-semibold"
          >
            {isExportingPdf ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>{isExportingPdf ? t.downloadingPdfMsg : t.downloadPdfBtn}</span>
          </Button>

          <Button
            size="sm"
            onClick={handlePrintReport}
            className="text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100 dark:shadow-none font-semibold"
          >
            <Printer className="w-4 h-4" />
            <span>{t.printPdfBtn}</span>
          </Button>
        </div>
      </div>

      {/* NAVIGATION ONGLET */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800 no-print print:hidden">
        <Button
          variant={currentTab === "classes" ? "default" : "ghost"}
          size="sm"
          onClick={() => setCurrentTab("classes")}
          className="text-xs gap-2 shrink-0 rounded-xl"
        >
          <Building className="w-4 h-4" />
          <span>{t.tabClasses} ({appData.classes.length})</span>
        </Button>

        <Button
          variant={currentTab === "notes" ? "default" : "ghost"}
          size="sm"
          onClick={() => setCurrentTab("notes")}
          className="text-xs gap-2 shrink-0 rounded-xl"
        >
          <Edit3 className="w-4 h-4" />
          <span>{t.tabNotes}</span>
        </Button>

        <Button
          variant={currentTab === "stats" ? "default" : "ghost"}
          size="sm"
          onClick={() => setCurrentTab("stats")}
          className="text-xs gap-2 shrink-0 rounded-xl"
        >
          <PieChartIcon className="w-4 h-4" />
          <span>{t.tabStats}</span>
        </Button>

        <Button
          variant={currentTab === "observations" ? "default" : "ghost"}
          size="sm"
          onClick={() => setCurrentTab("observations")}
          className="text-xs gap-2 shrink-0 rounded-xl"
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>{t.tabObservations}</span>
        </Button>

        <Button
          variant={currentTab === "config" ? "default" : "ghost"}
          size="sm"
          onClick={() => setCurrentTab("config")}
          className="text-xs gap-2 shrink-0 rounded-xl"
        >
          <SettingsIcon className="w-4 h-4" />
          <span>{t.tabConfig}</span>
        </Button>

        <Button
          variant={currentTab === "preview" ? "default" : "ghost"}
          size="sm"
          onClick={() => setCurrentTab("preview")}
          className="text-xs gap-2 shrink-0 rounded-xl font-bold text-indigo-600 dark:text-indigo-400"
        >
          <Printer className="w-4 h-4" />
          <span>{t.tabPreview}</span>
        </Button>
      </div>

      {/* ========================================================================= */}
      {/* ONGLET 1 : CLASSES & ÉLÈVES */}
      {/* ========================================================================= */}
      {currentTab === "classes" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{t.classesHeaderTitle}</span>
                {dataSource === "supabase" && (
                  <Badge variant="outline" className="text-xs text-indigo-700 bg-indigo-50 border-indigo-200">
                    {t.connectedToClassManagement}
                  </Badge>
                )}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                {t.classesHeaderSubtitle}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setIsAddClassOpen(true)}
                size="sm"
                className="gap-2 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{t.addClassBtn}</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
            {appData.classes.map((cls) => {
              const stat = calculateClassStats(cls);

              return (
                <Card key={cls.id} className="relative overflow-hidden border-slate-200 dark:border-slate-800 flex flex-col justify-between hover:shadow-md transition">
                  <div className={`absolute top-0 left-0 right-0 h-1.5 ${cls.students.length > 0 ? "bg-indigo-500" : "bg-slate-300"}`} />
                  <CardHeader className="pb-3 pt-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{cls.nom}</span>
                        </CardTitle>
                        <CardDescription className="text-xs flex items-center gap-1.5 mt-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{t.classDateLabel} {cls.date}</span>
                        </CardDescription>
                      </div>
                      <Badge variant={cls.students.length > 0 ? "secondary" : "outline"} className="text-xs font-mono font-bold">
                        {cls.students.length} {lang === "ar" ? "تلميذاً" : "élèves"}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 pb-4">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">{t.presentCountLabel}</span>
                        <span className="font-bold text-emerald-600 text-sm">{stat.present_count}</span>
                      </div>
                      <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">{t.absentCountLabel}</span>
                        <span className="font-bold text-rose-500 text-sm">{stat.absent_count}</span>
                      </div>
                      <div className="col-span-2 p-2 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-lg flex items-center justify-between">
                        <span className="text-indigo-900 dark:text-indigo-300 text-xs font-medium">{t.averageNoteLabel}</span>
                        <span className="font-bold text-indigo-700 dark:text-indigo-300 text-sm">{stat.average_note} / 20</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 pt-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            setActiveClassId(cls.id);
                            setClassGradingModes(prev => ({ ...prev, [cls.id]: "manual" }));
                            setCurrentTab("notes");
                          }}
                          className="w-full h-9 px-2 text-xs font-semibold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                        >
                          <Edit3 className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{t.enterNotesBtn}</span>
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setImportTargetClass(cls);
                            fileInputRef.current?.click();
                          }}
                          className="w-full h-9 px-2 text-xs font-semibold gap-1.5 border-emerald-400 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/40 shadow-xs"
                        >
                          <Upload className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{t.importExcelBtn}</span>
                        </Button>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setActiveClassId(cls.id);
                          setClassGradingModes(prev => ({ ...prev, [cls.id]: "quiz" }));
                          setCurrentTab("notes");
                        }}
                        className="w-full h-8 px-2 text-xs font-semibold gap-1.5 border-amber-300 bg-amber-50/50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/60 shadow-2xs"
                      >
                        <Zap className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                        <span className="truncate">{t.importFromQuizBtn}</span>
                      </Button>

                      <div className="flex items-center justify-between pt-1 text-slate-400 text-xs">
                        <button
                          onClick={() => handleDownloadExcelForClass(cls)}
                          className="text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 hover:underline"
                          title={lang === "ar" ? "تحميل اللائحة بصيغة Excel" : "Télécharger la liste au format Excel"}
                        >
                          <Download className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{t.downloadClassTemplateBtn}</span>
                        </button>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setEditingClass(cls)}
                            className="hover:text-slate-600 dark:hover:text-slate-200 underline text-xs"
                          >
                            {t.editClassBtn}
                          </button>
                          <button
                            onClick={() => handleDeleteClass(cls.id)}
                            className="text-rose-500 hover:text-rose-700 p-0.5"
                            title={t.deleteClassBtn}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 2 : SAISIE DES NOTES */}
      {/* ========================================================================= */}
      {currentTab === "notes" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
              <span className="text-xs font-bold uppercase text-slate-400 shrink-0">{t.selectClassLabel}</span>
              {appData.classes.map(c => (
                <Button
                  key={c.id}
                  variant={c.id === activeClassId ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveClassId(c.id)}
                  className="text-xs shrink-0 rounded-lg gap-1.5"
                >
                  <span>{c.nom}</span>
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                    {c.students.length}
                  </Badge>
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddStudentOpen(true)}
                className="text-xs gap-1.5"
              >
                <PlusCircle className="w-4 h-4 text-emerald-600" />
                <span>{t.addStudentBtn}</span>
              </Button>

              <Button
                size="sm"
                onClick={handleSaveNotes}
                className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-semibold"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{t.saveNotesBtn}</span>
              </Button>
            </div>
          </div>

          {/* SÉLECTION DU MODE D'ATTRIBUTION DES NOTES (MANUEL VS QUIZ) */}
          <Card className="border-indigo-100 dark:border-indigo-900/60 bg-gradient-to-r from-slate-50 via-indigo-50/20 to-slate-50 dark:from-slate-900 dark:via-indigo-950/20 dark:to-slate-900 shadow-2xs">
            <CardContent className="p-3.5 sm:p-4 space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Boutons de basculement de mode */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>{t.gradingModeLabel}</span>
                  </span>

                  <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0.5 shadow-2xs">
                    <Button
                      type="button"
                      variant={currentGradingMode === "manual" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setClassGradingModes(prev => ({ ...prev, [activeClassId]: "manual" }))}
                      className="h-7 text-xs px-2.5 sm:px-3 rounded-md gap-1.5 font-medium"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{t.manualModeLabel}</span>
                    </Button>
                    <Button
                      type="button"
                      variant={currentGradingMode === "quiz" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setClassGradingModes(prev => ({ ...prev, [activeClassId]: "quiz" }))}
                      className="h-7 text-xs px-2.5 sm:px-3 rounded-md gap-1.5 font-medium"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span>{t.quizModeLabel}</span>
                    </Button>
                  </div>
                </div>

                {/* Si mode Quiz actif : sélecteur de quiz et bouton de synchronisation */}
                {currentGradingMode === "quiz" && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {availableQuizzes.all.length > 0 ? (
                      <>
                        <Select
                          value={currentSelectedQuizId}
                          onValueChange={(val) => {
                            setClassSelectedQuiz(prev => ({ ...prev, [activeClassId]: val }));
                          }}
                        >
                          <SelectTrigger className="w-[200px] sm:w-[240px] md:w-[280px] h-8 text-xs bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800 font-medium truncate">
                            <SelectValue placeholder={t.selectQuizLabel} />
                          </SelectTrigger>
                          <SelectContent className="max-w-md">
                            {availableQuizzes.direct.length > 0 && (
                              <>
                                <div className="px-2 py-1 text-[10px] font-bold uppercase text-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40">
                                  {lang === "ar" ? `اختبارات هذا الفصل (${currentClass?.nom})` : `Quiz de cette classe (${currentClass?.nom})`}
                                </div>
                                {availableQuizzes.direct.map(q => (
                                  <SelectItem key={q.id} value={q.id} className="text-xs">
                                    <span className="font-semibold">{q.title}</span>
                                    <span className="text-[10px] text-muted-foreground ml-1.5">
                                      ({new Date(q.exam_date).toLocaleDateString()})
                                    </span>
                                  </SelectItem>
                                ))}
                              </>
                            )}
                            {availableQuizzes.other.length > 0 && (
                              <>
                                <div className="px-2 py-1 text-[10px] font-bold uppercase text-slate-500 bg-muted/40 mt-1">
                                  {lang === "ar" ? "اختبارات المقررات الأخرى" : "Quiz d'autres cours"}
                                </div>
                                {availableQuizzes.other.map(q => (
                                  <SelectItem key={q.id} value={q.id} className="text-xs">
                                    <span>{q.title}</span>
                                    <span className="text-[10px] text-muted-foreground ml-1.5">
                                      ({new Date(q.exam_date).toLocaleDateString()})
                                    </span>
                                  </SelectItem>
                                ))}
                              </>
                            )}
                          </SelectContent>
                        </Select>

                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleSyncNotesFromQuiz()}
                          disabled={isSyncingQuiz || !currentSelectedQuizId}
                          className="h-8 text-xs gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-xs font-semibold"
                        >
                          <RefreshCw className={cn("w-3.5 h-3.5", isSyncingQuiz && "animate-spin")} />
                          <span>{isSyncingQuiz ? t.syncingQuizMsg : t.syncQuizBtn}</span>
                        </Button>
                      </>
                    ) : (
                      <div className="text-xs text-amber-600 dark:text-amber-400 italic">
                        {t.noQuizAvailableForClass}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bannière explicative */}
              {currentGradingMode === "quiz" ? (
                <div className="flex items-center gap-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-900 dark:text-amber-200">
                  <Zap className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>{t.quizModeDesc}</span>
                </div>
              ) : (
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                  <span>
                    {lang === "ar" 
                      ? "💡 مسك يدوي: يمكنك تعديل النقط مباشرة في خانات الجدول (0 إلى 20)، أو تعيين ABS للغائبين، أو استيراد ملف إكسيل."
                      : "💡 Saisie manuelle : Vous pouvez saisir directement les notes dans le tableau (0 à 20), marquer ABS pour les absents, ou importer un fichier Excel."}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {currentClass && (
            (() => {
              const currentStat = calculateClassStats(currentClass);
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                    <span className="text-xs text-slate-400 uppercase font-semibold">{t.totalStudentsLabel}</span>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{currentStat.total_students}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                    <span className="text-xs text-slate-400 uppercase font-semibold">{t.presentCountLabel}</span>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">{currentStat.present_count}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                    <span className="text-xs text-slate-400 uppercase font-semibold">{t.absentCountLabel}</span>
                    <p className="text-2xl font-bold text-slate-500 mt-1">{currentStat.absent_count}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                    <span className="text-xs text-slate-400 uppercase font-semibold">{t.averageNoteLabel}</span>
                    <p className="text-2xl font-bold text-indigo-600 mt-1">{currentStat.average_note} <span className="text-xs text-slate-400">/ 20</span></p>
                  </div>
                </div>
              );
            })()
          )}

          {currentClass && currentClass.students.length > 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4 w-12 text-center">{t.numCol}</th>
                      <th className="py-3 px-4 w-36">{t.massarCol}</th>
                      <th className="py-3 px-4">{t.studentNameCol}</th>
                      <th className="py-3 px-4 w-40 text-center">{t.noteCol}</th>
                      <th className="py-3 px-4 w-44 text-center">{t.trancheCol}</th>
                      <th className="py-3 px-4 w-28 text-center">{t.actionsCol}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {currentClass.students.map((student) => {
                      const noteVal = notesDraft[String(student.id)] ?? (student.note !== null ? String(student.note) : "");
                      const parsedNum = parseFloat(noteVal.replace(",", "."));
                      const isAbs = noteVal.trim().toUpperCase() === "ABS";
                      const isValidNum = !isNaN(parsedNum) && parsedNum >= 0 && parsedNum <= 20;

                      let badgeText = t.notGradedBadge;
                      let badgeClass = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";

                      if (isAbs) {
                        badgeText = t.absentBadge;
                        badgeClass = "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
                      } else if (isValidNum) {
                        if (parsedNum <= 8.0) {
                          badgeText = t.tranche1Name;
                          badgeClass = "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
                        } else if (parsedNum <= 12.0) {
                          badgeText = t.tranche2Name;
                          badgeClass = "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
                        } else if (parsedNum <= 14.0) {
                          badgeText = t.tranche3Name;
                          badgeClass = "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
                        } else {
                          badgeText = t.tranche4Name;
                          badgeClass = "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
                        }
                      }

                      return (
                        <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                          <td className="py-2.5 px-4 text-center font-mono font-medium text-slate-500">
                            {student.num}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-300 font-medium">
                            {student.massar}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                            {student.name}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <Input
                              type="text"
                              value={noteVal}
                              onChange={(e) => handleNoteChange(student.id, e.target.value)}
                              placeholder="0-20 ou ABS"
                              className="h-8 w-28 text-center font-bold font-mono mx-auto text-xs"
                            />
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${badgeClass}`}>
                              {badgeText}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleNoteChange(student.id, "ABS")}
                                className="h-7 px-2 text-[10px] text-slate-500 hover:text-slate-700"
                              >
                                {t.setAbsBtn}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteStudent(student.id, student.name)}
                                className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-8">
              <Users className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <h3 className="font-bold text-slate-700 dark:text-slate-300">{t.noStudentsMessage}</h3>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 3 : STATISTIQUES & TRANCHES */}
      {/* ========================================================================= */}
      {currentTab === "stats" && (
        <div className="space-y-6">
          {/* Barre de contrôle du périmètre & des graphes */}
          {renderReportScopeControls()}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase font-semibold">{t.statsKpiTotalPresents}</CardDescription>
                <CardTitle className="text-3xl font-extrabold text-indigo-600">{reportStats.total_presents}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-500">
                Sur {classesForReport.reduce((acc, s) => acc + s.students.length, 0)} {t.totalStudentsLabel}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase font-semibold">{t.statsKpiStrugglingRate}</CardDescription>
                <CardTitle className="text-3xl font-extrabold text-rose-500">{reportStats.pct_struggling} %</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-500">
                {t.tranche1Name}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase font-semibold">{t.statsKpiAppreciation}</CardDescription>
                <CardTitle className="text-xl font-bold text-slate-900 dark:text-white capitalize">
                  {reportStats.default_appreciation}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-500">
                {t.globalAppreciationTitle}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase font-semibold">{t.statsKpiClassesCount}</CardDescription>
                <CardTitle className="text-3xl font-extrabold text-emerald-600">{classesForReport.length}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-500">
                {reportClassesNames.join(", ")}
              </CardContent>
            </Card>
          </div>

          {/* Graphiques Recharts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base font-bold">{t.chartDistributionTitle}</CardTitle>
                <CardDescription className="text-xs">
                  {t.chartDistributionSubtitle}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey={t.tranche1Name} fill="#ef4444" radius={[4, 4, 0, 0]} />
                      <Bar dataKey={t.tranche2Name} fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey={t.tranche3Name} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey={t.tranche4Name} fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold">{t.chartPieTitle}</CardTitle>
                <CardDescription className="text-xs">
                  {t.statsKpiTotalPresents} : {reportStats.total_presents}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={40}
                        label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tableau Officiel Section II */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">{t.officialTableTitle}</CardTitle>
              <CardDescription className="text-xs">{t.officialTableSubtitle}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-center border-collapse border border-slate-300 dark:border-slate-700 text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                      <th rowSpan={2} className="border border-slate-300 dark:border-slate-700 p-2 italic w-1/4">{t.reportTable1ClassCol}</th>
                      <th rowSpan={2} className="border border-slate-300 dark:border-slate-700 p-2 w-24">{t.indicatorCol}</th>
                      <th className="border border-slate-300 dark:border-slate-700 p-2 font-bold text-rose-600">
                        {t.tranche1Name}
                      </th>
                      <th className="border border-slate-300 dark:border-slate-700 p-2 font-bold text-amber-600">
                        {t.tranche2Name}
                      </th>
                      <th className="border border-slate-300 dark:border-slate-700 p-2 font-bold text-blue-600">
                        {t.tranche3Name}
                      </th>
                      <th className="border border-slate-300 dark:border-slate-700 p-2 font-bold text-emerald-600">
                        {t.tranche4Name}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportStats.classes_stats.map((stat, idx) => (
                      <React.Fragment key={idx}>
                        <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td rowSpan={2} className="border border-slate-300 dark:border-slate-700 p-2 font-bold italic text-left pl-4">
                            {stat.nom}
                          </td>
                          <td className="border border-slate-300 dark:border-slate-700 p-2 font-semibold bg-slate-50 dark:bg-slate-800/20">
                            {t.countRow}
                          </td>
                          <td className="border border-slate-300 dark:border-slate-700 p-2 font-bold text-purple-700 dark:text-purple-400">
                            {stat.t1_count}
                          </td>
                          <td className="border border-slate-300 dark:border-slate-700 p-2 font-bold text-purple-700 dark:text-purple-400">
                            {stat.t2_count}
                          </td>
                          <td className="border border-slate-300 dark:border-slate-700 p-2 font-bold text-purple-700 dark:text-purple-400">
                            {stat.t3_count}
                          </td>
                          <td className="border border-slate-300 dark:border-slate-700 p-2 font-bold text-purple-700 dark:text-purple-400">
                            {stat.t4_count}
                          </td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="border border-slate-300 dark:border-slate-700 p-2 font-semibold italic bg-slate-50 dark:bg-slate-800/20">
                            {t.percentageRow}
                          </td>
                          <td className="border border-slate-300 dark:border-slate-700 p-2 font-bold text-purple-700 dark:text-purple-400">
                            {stat.t1_pct} %
                          </td>
                          <td className="border border-slate-300 dark:border-slate-700 p-2 font-bold text-purple-700 dark:text-purple-400">
                            {stat.t2_pct} %
                          </td>
                          <td className="border border-slate-300 dark:border-slate-700 p-2 font-bold text-purple-700 dark:text-purple-400">
                            {stat.t3_pct} %
                          </td>
                          <td className="border border-slate-300 dark:border-slate-700 p-2 font-bold text-purple-700 dark:text-purple-400">
                            {stat.t4_pct} %
                          </td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 4 : RÉSULTATS, OBSERVATIONS & PROPOSITIONS */}
      {/* ========================================================================= */}
      {currentTab === "observations" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">{t.globalAppreciationTitle}</CardTitle>
              <CardDescription className="text-xs">{t.globalAppreciationSubtitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Input
                  value={appData.config.appreciation_globale}
                  onChange={(e) => updateAppData(prev => ({
                    ...prev,
                    config: { ...prev.config, appreciation_globale: e.target.value }
                  }))}
                  className="max-w-md"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateAppData(prev => ({
                    ...prev,
                    config: { ...prev.config, appreciation_globale: reportStats.default_appreciation }
                  }))}
                  className="text-xs gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{t.useCalculatedAppreciationBtn} ({reportStats.default_appreciation})</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">{t.testCompositionTitle}</CardTitle>
                <CardDescription className="text-xs">{t.testCompositionSubtitle}</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={handleAddExercise} className="gap-1.5 text-xs">
                <PlusCircle className="w-4 h-4 text-emerald-600" />
                <span>{t.addExerciseBtn}</span>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 mb-2">
                <Label className="text-xs font-semibold whitespace-nowrap">{t.numExercisesLabel}</Label>
                <Input
                  value={appData.config.nombre_exercices_texte}
                  onChange={(e) => updateAppData(prev => ({
                    ...prev,
                    config: { ...prev.config, nombre_exercices_texte: e.target.value }
                  }))}
                  className="max-w-xs h-8 text-xs font-medium"
                />
              </div>

              {appData.config.exercices.map((ex, idx) => (
                <div key={idx} className="flex items-start gap-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                  <Input
                    value={ex.titre}
                    onChange={(e) => handleUpdateExercise(idx, "titre", e.target.value)}
                    className="w-36 h-9 text-xs font-bold shrink-0"
                  />
                  <Input
                    value={ex.description}
                    onChange={(e) => handleUpdateExercise(idx, "description", e.target.value)}
                    className="flex-1 h-9 text-xs"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteExercise(idx)}
                    className="h-9 w-9 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">{t.observationsTitle}</CardTitle>
                <CardDescription className="text-xs">{t.observationsSubtitle}</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={handleAddObservation} className="gap-1.5 text-xs">
                <PlusCircle className="w-4 h-4 text-emerald-600" />
                <span>{t.addObservationBtn}</span>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {appData.config.observations.map((obs, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="font-bold text-slate-400 mt-2 text-sm">➢</span>
                  <Textarea
                    value={obs}
                    onChange={(e) => handleUpdateObservation(idx, e.target.value)}
                    rows={2}
                    className="text-xs flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteObservation(idx)}
                    className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 mt-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">{t.propositionsTitle}</CardTitle>
                <CardDescription className="text-xs">{t.propositionsSubtitle}</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={handleAddProposition} className="gap-1.5 text-xs">
                <PlusCircle className="w-4 h-4 text-emerald-600" />
                <span>{t.addPropositionBtn}</span>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {appData.config.propositions.map((prop, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="font-bold text-slate-400 mt-2 text-sm">➢</span>
                  <Textarea
                    value={prop}
                    onChange={(e) => handleUpdateProposition(idx, e.target.value)}
                    rows={2}
                    className="text-xs flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteProposition(idx)}
                    className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 mt-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 5 : PARAMÈTRES DU RAPPORT */}
      {/* ========================================================================= */}
      {currentTab === "config" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">{t.adminConfigTitle}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">{t.academieLabel}</Label>
                <Input
                  value={appData.config.academie}
                  onChange={(e) => updateAppData(prev => ({
                    ...prev,
                    config: { ...prev.config, academie: e.target.value }
                  }))}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">{t.directionLabel}</Label>
                <Input
                  value={appData.config.direction}
                  onChange={(e) => updateAppData(prev => ({
                    ...prev,
                    config: { ...prev.config, direction: e.target.value }
                  }))}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">{t.lyceeLabel}</Label>
                <Input
                  value={appData.config.lycee}
                  onChange={(e) => updateAppData(prev => ({
                    ...prev,
                    config: { ...prev.config, lycee: e.target.value }
                  }))}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">{t.anneeScolaireLabel}</Label>
                <Input
                  value={appData.config.annee_scolaire}
                  onChange={(e) => updateAppData(prev => ({
                    ...prev,
                    config: { ...prev.config, annee_scolaire: e.target.value }
                  }))}
                  className="text-xs"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">{t.pedagogicalConfigTitle}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">{t.teacherNameLabel}</Label>
                <Input
                  value={appData.config.nom_enseignant}
                  onChange={(e) => updateAppData(prev => ({
                    ...prev,
                    config: { ...prev.config, nom_enseignant: e.target.value }
                  }))}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">{t.subjectLabel}</Label>
                <Input
                  value={appData.config.matiere}
                  onChange={(e) => updateAppData(prev => ({
                    ...prev,
                    config: { ...prev.config, matiere: e.target.value }
                  }))}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">{t.gradeLevelLabel}</Label>
                <Input
                  value={appData.config.niveau}
                  onChange={(e) => updateAppData(prev => ({
                    ...prev,
                    config: { ...prev.config, niveau: e.target.value }
                  }))}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">{t.titleHeaderLabel}</Label>
                <Input
                  value={appData.config.niveau_titre}
                  onChange={(e) => updateAppData(prev => ({
                    ...prev,
                    config: { ...prev.config, niveau_titre: e.target.value }
                  }))}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">{t.diagnosticPeriodLabel}</Label>
                <Input
                  value={appData.config.periode_diagnostic}
                  onChange={(e) => updateAppData(prev => ({
                    ...prev,
                    config: { ...prev.config, periode_diagnostic: e.target.value }
                  }))}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">{t.section1ClassesLabel}</Label>
                <Input
                  value={appData.config.classes_section_1}
                  onChange={(e) => updateAppData(prev => ({
                    ...prev,
                    config: { ...prev.config, classes_section_1: e.target.value }
                  }))}
                  className="text-xs"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsResetDefaultsOpen(true)}
              className="text-xs gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t.resetDefaultsBtn}</span>
            </Button>

            <Button
              size="sm"
              onClick={() => toast.success(t.saveConfigBtn)}
              className="text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>{t.saveConfigBtn}</span>
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 6 : APERÇU 1:1 & EXPORT PDF */}
      {/* ========================================================================= */}
      {currentTab === "preview" && (
        <div className="space-y-4">
          {/* Barre de sélection de la classe pour le PDF et des graphes */}
          {renderReportScopeControls()}

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print print:hidden">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <span>{t.previewHeaderTitle}</span>
                <Badge variant="secondary" className="text-xs">
                  {classesForReport.length} {t.selectedClassesCount} • {reportStats.total_presents} {t.presentCountLabel}
                </Badge>
              </h3>
              <p className="text-xs text-slate-500">
                {t.previewHeaderSubtitle}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentTab("classes")}
                className="text-xs gap-1"
              >
                <span>{t.backToEditBtn}</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditConfigDraft({ ...appData.config });
                  setIsQuickEditConfigOpen(true);
                }}
                className="text-xs gap-1.5 border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 font-semibold"
              >
                <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                <span>{lang === "ar" ? "تعديل الفترة والمعلومات" : "Modifier la période & informations"}</span>
              </Button>

              <Button
                size="sm"
                onClick={handleDownloadPdf}
                disabled={isExportingPdf}
                className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-100 font-semibold"
              >
                {isExportingPdf ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>{isExportingPdf ? t.downloadingPdfMsg : t.downloadPdfBtn}</span>
              </Button>

              <Button
                size="sm"
                onClick={handlePrintReport}
                className="text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100 font-semibold"
              >
                <Printer className="w-4 h-4" />
                <span>{t.printPdfBtn}</span>
              </Button>
            </div>
          </div>

          {/* Rendu 1:1 du rapport officiel avec la langue, la classe et les graphiques */}
          <DiagnosticReportPrint
            config={appData.config}
            stats={reportStats}
            lang={lang}
            includeGraphs={includeGraphsInReport}
            selectedClassesNames={reportClassesNames}
          />
        </div>
      )}

      {/* ==================== DIALOG AJOUTER UNE CLASSE ==================== */}
      <Dialog open={isAddClassOpen} onOpenChange={setIsAddClassOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto" dir={getDirection()}>
          <DialogHeader>
            <DialogTitle>{t.addClassBtn}</DialogTitle>
            <DialogDescription className="text-xs">
              {t.classesHeaderSubtitle}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">{t.reportTable1ClassCol} :</Label>
              <Input
                placeholder="ex: 1BACSF3 ou 2Bac-SVT"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t.classDateLabel}</Label>
              <Input
                placeholder="ex: 06-10-2024"
                value={newClassDate}
                onChange={(e) => setNewClassDate(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsAddClassOpen(false)}>Annuler</Button>
            <Button size="sm" onClick={handleAddClass} className="bg-indigo-600 text-white hover:bg-indigo-700">{t.addClassBtn}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== DIALOG MODIFIER UNE CLASSE ==================== */}
      <Dialog open={editingClass !== null} onOpenChange={(open) => !open && setEditingClass(null)}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto" dir={getDirection()}>
          <DialogHeader>
            <DialogTitle>{t.editClassBtn}</DialogTitle>
          </DialogHeader>
          {editingClass && (
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label className="text-xs">{t.reportTable1ClassCol} :</Label>
                <Input
                  value={editingClass.nom}
                  onChange={(e) => setEditingClass({ ...editingClass, nom: e.target.value })}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t.classDateLabel}</Label>
                <Input
                  value={editingClass.date}
                  onChange={(e) => setEditingClass({ ...editingClass, date: e.target.value })}
                  className="text-xs"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditingClass(null)}>Annuler</Button>
            <Button size="sm" onClick={handleUpdateClass} className="bg-indigo-600 text-white">{t.editClassBtn}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== DIALOG AJOUTER UN ÉLÈVE ==================== */}
      <Dialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto" dir={getDirection()}>
          <DialogHeader>
            <DialogTitle>{t.addStudentBtn} ({currentClass?.nom})</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">{t.studentNameCol} :</Label>
              <Input
                placeholder="ex: BENNANI SALMA"
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t.massarCol} :</Label>
              <Input
                placeholder="ex: M130005"
                value={newStudentMassar}
                onChange={(e) => setNewStudentMassar(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t.noteCol} :</Label>
              <Input
                placeholder="ex: 14.5 ou ABS"
                value={newStudentNote}
                onChange={(e) => setNewStudentNote(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsAddStudentOpen(false)}>Annuler</Button>
            <Button size="sm" onClick={handleAddStudent} className="bg-indigo-600 text-white">{t.addStudentBtn}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Class Confirmation Dialog */}
      <Dialog open={!!classToDelete} onOpenChange={(open) => { if (!open) setClassToDelete(null); }}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>
              {lang === "ar" ? "حذف الفصل" : lang === "fr" ? "Supprimer la classe" : "Delete Class"}
            </DialogTitle>
            <DialogDescription>
              {lang === "ar"
                ? `هل أنت متأكد من رغبتك في حذف "${classToDelete?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`
                : lang === "fr"
                ? `Êtes-vous sûr de vouloir supprimer "${classToDelete?.name}" ? Cette action est irréversible.`
                : `Are you sure you want to delete "${classToDelete?.name}"? This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClassToDelete(null)}>
              {lang === "ar" ? "إلغاء" : lang === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={confirmDeleteClass}>
              {lang === "ar" ? "حذف" : lang === "fr" ? "Supprimer" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Student Confirmation Dialog */}
      <Dialog open={!!studentToDelete} onOpenChange={(open) => { if (!open) setStudentToDelete(null); }}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>
              {lang === "ar" ? "حذف التلميذ" : lang === "fr" ? "Retirer l'élève" : "Remove Student"}
            </DialogTitle>
            <DialogDescription>
              {lang === "ar"
                ? `هل أنت متأكد من رغبتك في حذف "${studentToDelete?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`
                : lang === "fr"
                ? `Êtes-vous sûr de vouloir retirer "${studentToDelete?.name}" ? Cette action est irréversible.`
                : `Are you sure you want to remove "${studentToDelete?.name}"? This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStudentToDelete(null)}>
              {lang === "ar" ? "إلغاء" : lang === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={confirmDeleteStudent}>
              {lang === "ar" ? "حذف" : lang === "fr" ? "Retirer" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Observation Confirmation Dialog */}
      <Dialog open={observationToDelete !== null} onOpenChange={(open) => { if (!open) setObservationToDelete(null); }}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>
              {lang === "ar" ? "حذف الملاحظة" : lang === "fr" ? "Supprimer l'observation" : "Delete Observation"}
            </DialogTitle>
            <DialogDescription>
              {lang === "ar"
                ? "هل أنت متأكد من رغبتك في حذف هذه الملاحظة؟ لا يمكن التراجع عن هذا الإجراء."
                : lang === "fr"
                ? "Êtes-vous sûr de vouloir supprimer cette observation ? Cette action est irréversible."
                : "Are you sure you want to delete this observation? This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setObservationToDelete(null)}>
              {lang === "ar" ? "إلغاء" : lang === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={confirmDeleteObservation}>
              {lang === "ar" ? "حذف" : lang === "fr" ? "Supprimer" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Proposition Confirmation Dialog */}
      <Dialog open={propositionToDelete !== null} onOpenChange={(open) => { if (!open) setPropositionToDelete(null); }}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>
              {lang === "ar" ? "حذف المقترح" : lang === "fr" ? "Supprimer la proposition" : "Delete Proposition"}
            </DialogTitle>
            <DialogDescription>
              {lang === "ar"
                ? "هل أنت متأكد من رغبتك في حذف هذا المقترح؟ لا يمكن التراجع عن هذا الإجراء."
                : lang === "fr"
                ? "Êtes-vous sûr de vouloir supprimer cette proposition ? Cette action est irréversible."
                : "Are you sure you want to delete this proposition? This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPropositionToDelete(null)}>
              {lang === "ar" ? "إلغاء" : lang === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={confirmDeleteProposition}>
              {lang === "ar" ? "حذف" : lang === "fr" ? "Supprimer" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Exercise (Diagnostic) Confirmation Dialog */}
      <Dialog open={exerciseToDeleteDiag !== null} onOpenChange={(open) => { if (!open) setExerciseToDeleteDiag(null); }}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>
              {lang === "ar" ? "حذف التمرين" : lang === "fr" ? "Supprimer l'exercice" : "Delete Exercise"}
            </DialogTitle>
            <DialogDescription>
              {lang === "ar"
                ? "هل أنت متأكد من رغبتك في حذف هذا التمرين؟ لا يمكن التراجع عن هذا الإجراء."
                : lang === "fr"
                ? "Êtes-vous sûr de vouloir supprimer cet exercice ? Cette action est irréversible."
                : "Are you sure you want to delete this exercise? This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExerciseToDeleteDiag(null)}>
              {lang === "ar" ? "إلغاء" : lang === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={confirmDeleteExerciseDiag}>
              {lang === "ar" ? "حذف" : lang === "fr" ? "Supprimer" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Defaults Confirmation Dialog */}
      <Dialog open={isResetDefaultsOpen} onOpenChange={setIsResetDefaultsOpen}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>
              {lang === "ar" ? "استعادة الإعدادات الافتراضية" : lang === "fr" ? "Rétablir la configuration par défaut" : "Reset Default Settings"}
            </DialogTitle>
            <DialogDescription>
              {lang === "ar"
                ? "هل أنت متأكد من رغبتك في استعادة الإعدادات الافتراضية؟ سيتم إعادة تعيين الملاحظات والمقترحات والتمارين."
                : lang === "fr"
                ? "Êtes-vous sûr de vouloir rétablir les paramètres par défaut ? Les observations, propositions et exercices seront réinitialisés."
                : "Are you sure you want to restore default settings? All observations, propositions, and exercises will be reset."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetDefaultsOpen(false)}>
              {lang === "ar" ? "إلغاء" : lang === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const def = resetDiagnosticDataToDefaults();
                setAppData(prev => ({ ...prev, config: def.config }));
                setIsResetDefaultsOpen(false);
                toast.success(t.resetDefaultsBtn);
              }}
            >
              {lang === "ar" ? "استعادة" : lang === "fr" ? "Rétablir" : "Reset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Edit Report Configuration Dialog */}
      <Dialog open={isQuickEditConfigOpen} onOpenChange={setIsQuickEditConfigOpen}>
        <DialogContent className="w-[95vw] max-w-xl max-h-[90vh] overflow-y-auto" dir={getDirection()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-indigo-700 dark:text-indigo-400">
              <Edit3 className="w-5 h-5 text-indigo-600" />
              {lang === "ar" ? "تعديل فترة ومعلومات التقرير الرسمي" : "Modifier la période & informations du rapport"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {lang === "ar"
                ? "تعديل فترة التقويم التشخيصي، السنة الدراسية، الأستاذ والمؤسسة مباشرة على التقرير."
                : "Modifiez la période du diagnostic, l'année scolaire, l'enseignant et l'établissement."}
            </DialogDescription>
          </DialogHeader>

          {editConfigDraft && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5 p-3 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    {lang === "ar" ? "فترة التقويم التشخيصي (المادة 08) :" : "Période du diagnostic (Article 08) :"}
                  </Label>
                  <Badge variant="outline" className="text-[10px] border-indigo-300 text-indigo-700">
                    {lang === "ar" ? "المادة 08" : "Article 08"}
                  </Badge>
                </div>
                <Input
                  value={editConfigDraft.periode_diagnostic || ""}
                  onChange={(e) => setEditConfigDraft({ ...editConfigDraft, periode_diagnostic: e.target.value })}
                  placeholder="ex: 01 au 09 octobre 2026 ou 15 au 25 septembre 2026"
                  className="text-xs bg-white dark:bg-slate-900 font-semibold"
                />
                {/* Raccourcis rapides */}
                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                  <span className="text-[10px] text-muted-foreground">{lang === "ar" ? "اقتراحات سريعة:" : "Suggestions :"}</span>
                  {[
                    "01 au 09 octobre 2026",
                    "02 au 10 octobre 2026",
                    "15 au 25 septembre 2026",
                    "01 au 09 octobre 2025"
                  ].map((p) => (
                    <Button
                      key={p}
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditConfigDraft({ ...editConfigDraft, periode_diagnostic: p })}
                      className="h-5 px-2 text-[10px] text-indigo-700 bg-white/80 dark:bg-indigo-900/40 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-700 rounded-md"
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">{t.anneeScolaireLabel} :</Label>
                  <Input
                    value={editConfigDraft.annee_scolaire || ""}
                    onChange={(e) => setEditConfigDraft({ ...editConfigDraft, annee_scolaire: e.target.value })}
                    placeholder="2026 / 2027"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">{t.teacherNameLabel} :</Label>
                  <Input
                    value={editConfigDraft.nom_enseignant || ""}
                    onChange={(e) => setEditConfigDraft({ ...editConfigDraft, nom_enseignant: e.target.value })}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">{t.subjectLabel} :</Label>
                  <Input
                    value={editConfigDraft.matiere || ""}
                    onChange={(e) => setEditConfigDraft({ ...editConfigDraft, matiere: e.target.value })}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">{t.lyceeLabel} :</Label>
                  <Input
                    value={editConfigDraft.lycee || ""}
                    onChange={(e) => setEditConfigDraft({ ...editConfigDraft, lycee: e.target.value })}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">{t.gradeLevelLabel} :</Label>
                  <Input
                    value={editConfigDraft.niveau || ""}
                    onChange={(e) => setEditConfigDraft({ ...editConfigDraft, niveau: e.target.value })}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium">{t.titleHeaderLabel} :</Label>
                  <Input
                    value={editConfigDraft.niveau_titre || ""}
                    onChange={(e) => setEditConfigDraft({ ...editConfigDraft, niveau_titre: e.target.value })}
                    className="text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsQuickEditConfigOpen(false)}>
              {lang === "ar" ? "إلغاء" : "Annuler"}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (editConfigDraft) {
                  updateAppData(prev => ({
                    ...prev,
                    config: { ...editConfigDraft }
                  }));
                  setIsQuickEditConfigOpen(false);
                  toast.success(
                    lang === "ar"
                      ? "تم حفظ التعديلات وتحديث التقرير بنجاح"
                      : "Modifications enregistrées et rapport actualisé avec succès"
                  );
                }
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs"
            >
              {lang === "ar" ? "حفظ وتحديث التقرير" : "Enregistrer et actualiser le rapport"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DiagnosticEvaluation;

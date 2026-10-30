import { accessStore, useAccess } from "@/contexts/AccessContext";
import { DiagnosticCompare } from "@/components/diagnostic/DiagnosticCompare";
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
  Zap,
  Loader2
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
  DEFAULT_DIAGNOSTIC_DATA,
  DEFAULT_REPORT1_CHARTS,
  DEFAULT_REPORT2_CHARTS,
  getLangContent,
  setLangContent,
  numberToWords,
  fillConfigFromData,
  type DiagnosticLangContent
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
  getStoredRoomDates,
  saveDiagnosticConfigToCloud,
  fetchDiagnosticConfigFromCloud,
  fetchCloudStudentNotes
} from "@/lib/diagnosticSupabaseBridge";
import {
  DiagLang,
  DIAGNOSTIC_TRANSLATIONS,
  translateAppreciation
} from "@/lib/diagnosticTranslations";
import { DiagnosticReportPrint } from "@/components/diagnostic/DiagnosticReportPrint";
import { DiagnosticReportTemplate3 } from "@/components/diagnostic/DiagnosticReportTemplate3";
import { DiagnosticReportTemplate4 } from "@/components/diagnostic/DiagnosticReportTemplate4";
import { DiagnosticAiPanel } from "@/components/diagnostic/DiagnosticAiPanel";
import { emptyAnalysis, generateDiagnosticAnalysis } from "@/lib/diagnosticAi";
import { aiErrorMessage } from "@/lib/teacherAi";
import type { PermissionKey } from "@/lib/permissions";

type ReportTemplateId = "t1" | "t2" | "t3" | "t4";
const TEMPLATE_PERMISSION: Record<ReportTemplateId, PermissionKey> = {
  t1: "diagnostic.template1",
  t2: "diagnostic.template2",
  t3: "diagnostic.template3",
  t4: "diagnostic.template4",
};
import ReportScaler from "@/components/diagnostic/ReportScaler";
import ChartSettingsPanel, { Report1ChartPicker } from "@/components/diagnostic/ChartSettingsPanel";
import {
  DiagnosticReportTemplate2,
  defaultTemplate2Intro,
  defaultTemplate2Support,
} from "@/components/diagnostic/DiagnosticReportTemplate2";
import { exportDiagnosticReportToPdf } from "@/lib/diagnosticPdfExporter";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { getReportBranding } from "@/lib/reportBranding";
import * as XLSX from "xlsx";
import { downloadExcelFile } from "@/lib/download";
import { supabase } from "@/integrations/supabase/client";

/** Saisie d'une note : vide, « ABS », ou nombre de 0 à 20 (virgule ou point, 2 décimales max). */
const NOTE_INPUT_RE = /^\d{1,2}([.,]\d{1,2})?$/;
const isValidNoteInput = (raw: string): boolean => {
  const v = (raw || "").trim();
  if (!v) return true;
  if (v.toUpperCase() === "ABS") return true;
  if (!NOTE_INPUT_RE.test(v)) return false;
  const n = parseFloat(v.replace(",", "."));
  return !isNaN(n) && n >= 0 && n <= 20;
};
const parseNoteInput = (raw: string): number | string | null => {
  const v = (raw || "").trim();
  if (!v) return null;
  if (v.toUpperCase() === "ABS") return "ABS";
  const n = parseFloat(v.replace(",", "."));
  return isNaN(n) ? null : Math.round(n * 100) / 100;
};

export const DiagnosticEvaluation: React.FC = () => {
  const { user } = useAuth();
  const { rooms, addRoom, courses, exams } = useCourses();
  const { language, getDirection } = useLanguage();
  // Logo des rapports (Personnalisation → Rapports) pour l'en-tête de la page
  const { settings: appSettingsForReports } = useAppSettings();
  const reportBranding = getReportBranding(language, appSettingsForReports);

  // Langue active et traductions
  const lang: DiagLang = language === "ar" || language === "en" ? language : "fr";
  const t = DIAGNOSTIC_TRANSLATIONS[lang] || DIAGNOSTIC_TRANSLATIONS.fr;
  const isRtl = lang === "ar";
  const tx = (fr: string, ar: string, en: string) => (lang === "ar" ? ar : lang === "en" ? en : fr);
  const dateLocale = lang === "ar" ? "ar-MA" : lang === "en" ? "en-GB" : "fr-FR";

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
  const [includeGraphsInReportRaw, setIncludeGraphsInReportRaw] = useState<boolean>(false);
  // Graphiques : réservés aux offres qui incluent la bibliothèque de graphiques
  const { can: canAccess } = useAccess();
  const includeGraphsInReport = includeGraphsInReportRaw && canAccess("diagnostic.charts");
  const setIncludeGraphsInReport = (v: boolean) => {
    if (v && !accessStore.guard("diagnostic.charts")) return;
    setIncludeGraphsInReportRaw(v);
  };
  const [chartBgTheme, setChartBgTheme] = useState<"gray" | "white">("gray");
  // Modèle de rapport officiel : 1 = rapport détaillé, 2 = multi-classes par tranches,
  // 3 = analyse des acquis et plan de remédiation (IA), 4 = groupes de besoin (listes nominatives)
  const [reportTemplate, setReportTemplateState] = useState<ReportTemplateId>(() => {
    try {
      const v = localStorage.getItem("diag_report_template");
      return v === "t2" || v === "t3" || v === "t4" ? v : "t1";
    } catch { return "t1"; }
  });
  const setReportTemplate = (v: ReportTemplateId) => {
    if (!accessStore.guard(TEMPLATE_PERMISSION[v])) return;
    setReportTemplateState(v);
    try { localStorage.setItem("diag_report_template", v); } catch { /* stockage indisponible */ }
  };
  // Modèle mémorisé mais non inclus dans l'offre : on bascule sur le premier modèle autorisé
  useEffect(() => {
    if (canAccess(TEMPLATE_PERMISSION[reportTemplate])) return;
    const allowed = (["t1", "t2", "t3", "t4"] as ReportTemplateId[]).find(v => canAccess(TEMPLATE_PERMISSION[v]));
    if (allowed) setReportTemplateState(allowed);
  }, [reportTemplate, canAccess]);
  const [showTemplate2Texts, setShowTemplate2Texts] = useState(false);
  // Aperçu du rapport : ajusté à la largeur de l'écran (téléphone / iPad) ou taille réelle
  const [previewFit, setPreviewFit] = useState(true);

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
  const [savingNotes, setSavingNotes] = useState(false);
  const [pendingLeave, setPendingLeave] = useState<null | (() => void)>(null);

  // CHARGEMENT DYNAMIQUE DEPUIS SUPABASE (ROOMS DU PROFESSEUR CONNECTÉ)
  const activeClassIdRef = useRef(activeClassId);
  const selectedSingleClassIdRef = useRef(selectedSingleClassId);
  useEffect(() => { activeClassIdRef.current = activeClassId; }, [activeClassId]);
  useEffect(() => { selectedSingleClassIdRef.current = selectedSingleClassId; }, [selectedSingleClassId]);

  // Clé stable des classes : on ne recharge que si la liste des classes change vraiment
  const roomsKey = (rooms || []).map(r => r.id).join(",");
  const roomsRef = useRef(rooms);
  roomsRef.current = rooms;
  const tRef = useRef(t);
  tRef.current = t;

  const loadDynamicDataFromSupabase = useCallback(async (force = false) => {
    setLoadingRealData(true);
    const t = tRef.current;
    const rooms = roomsRef.current;
    try {
      const realClassesPromise = fetchDiagnosticClassesFromSupabase(
        user?.id,
        rooms && rooms.length > 0 ? rooms : undefined
      );
      const cloudConfigPromise = fetchDiagnosticConfigFromCloud();

      const [realClasses, cloudConfig] = await Promise.all([realClassesPromise, cloudConfigPromise]);

      if (cloudConfig) {
        setAppData(prev => ({
          ...prev,
          config: {
            ...prev.config,
            ...cloudConfig
          }
        }));
      }

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
      if (force) toast.error(tx("Erreur de chargement des classes", "خطأ في تحميل الأقسام", "Failed to load classes"));
    } finally {
      setLoadingRealData(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, roomsKey]);

  useEffect(() => {
    loadDynamicDataFromSupabase();
  }, [loadDynamicDataFromSupabase]);

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

  // Notes modifiées et non enregistrées ?
  const notesDirty = useMemo(() => {
    if (!currentClass) return false;
    return currentClass.students.some(s => {
      const saved = s.note !== null && s.note !== undefined ? String(s.note) : "";
      const draft = notesDraft[String(s.id)];
      return draft !== undefined && draft.trim() !== saved;
    });
  }, [currentClass, notesDraft]);

  // Avertissement à la fermeture / au rechargement de l'onglet
  useEffect(() => {
    if (!notesDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [notesDirty]);

  /** Navigation interne (onglets, changement de classe) : confirmation si notes non enregistrées */
  const guardLeave = (action: () => void) => {
    if (notesDirty) {
      setPendingLeave(() => action);
      return;
    }
    action();
  };

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
        toast.error(tx("Erreur lors de la récupération des notes du quiz", "تعذر جلب نتائج الاختبار", "Could not fetch the quiz grades"));
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

      // Enregistrer dans le stockage local et synchroniser dans Supabase Cloud
      const storedNotes = getStoredStudentNotes();
      updatedStudents.forEach(s => {
        storedNotes[String(s.id)] = s.note;
      });
      await saveStoredStudentNotes(storedNotes, currentClass.id, user?.id);

      // Mettre à jour l'état appData
      updateAppData(prev => ({
        ...prev,
        classes: prev.classes.map(c => c.id === currentClass.id ? { ...c, students: updatedStudents } : c)
      }));

      const targetQuiz = exams.find(e => e.id === quizId);
      const quizName = targetQuiz?.title || "Quiz";

      toast.success(tx(
        `Notes synchronisées depuis "${quizName}" : ${presentCount} noté(s), ${absentCount} absent(s) (ABS)`,
        `تم استيراد النقط من "${quizName}" : ${presentCount} حاضر(ة)، ${absentCount} غائب(ة) (ABS)`,
        `Grades synced from "${quizName}": ${presentCount} graded, ${absentCount} absent (ABS)`
      ));
    } catch (err) {
      console.error("Erreur synchronisation quiz:", err);
      toast.error(tx("Erreur inattendue lors de la synchronisation", "خطأ غير متوقع أثناء المزامنة", "Unexpected error while syncing"));
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

  // Contenu pédagogique (observations, propositions, exercices…) de la langue affichée
  const langContent = useMemo(() => getLangContent(appData.config, lang), [appData.config, lang]);

  const reportStats = useMemo(() => {
    return computeAllStats(classesForReport);
  }, [classesForReport]);

  const reportClassesNames = useMemo(() => {
    return classesForReport.map(c => c.nom);
  }, [classesForReport]);

  // Sauvegarde globale de l'état (écriture locale différée de ~500 ms : la saisie reste fluide)
  const pendingSaveRef = useRef<DiagnosticAppData | null>(null);
  const saveTimerRef = useRef<number | undefined>(undefined);
  const flushPendingSave = useCallback(() => {
    window.clearTimeout(saveTimerRef.current);
    const data = pendingSaveRef.current;
    pendingSaveRef.current = null;
    if (!data) return;
    try {
      saveDiagnosticData(data);
    } catch (e) {
      console.error("Diagnostic: local save failed", e);
      toast.error(tx("Enregistrement local impossible (stockage plein ou bloqué)", "تعذر الحفظ المحلي (التخزين ممتلئ أو محظور)", "Local save failed (storage full or blocked)"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);
  const updateAppData = (updater: (prev: DiagnosticAppData) => DiagnosticAppData) => {
    setAppData(prev => {
      const next = updater(prev);
      pendingSaveRef.current = next;
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(flushPendingSave, 500);
      return next;
    });
  };
  // Mode de rédaction choisi au début : IA (génération depuis les données) ou manuel (onglets 4 et 5)
  const redactionMode = appData.config.mode_redaction;
  const fillFromData = (force: boolean) => updateAppData(prev => ({
    ...prev,
    config: fillConfigFromData(prev.config, prev.classes, lang, { teacher: user?.name, school: reportBranding.schoolName }, force),
  }));
  const chooseRedactionMode = (m: "ai" | "manual") => {
    updateAppData(prev => ({
      ...prev,
      config: m === "ai"
        ? { ...fillConfigFromData(prev.config, prev.classes, lang, { teacher: user?.name, school: reportBranding.schoolName }), mode_redaction: m }
        : { ...prev.config, mode_redaction: m },
    }));
    if (m === "ai") {
      toast.success(tx("Paramètres remplis depuis vos données. Générez les textes dans l'onglet 6.", "تم ملء الإعدادات من معطياتك. ولّد النصوص في التبويب 6.", "Settings filled from your data. Generate the texts in tab 6."));
    }
  };
  // Onglet 4 : rédaction directe des observations, propositions et appréciation par l'IA
  const [quickAiBusy, setQuickAiBusy] = useState(false);
  const quickGenerateTexts = async () => {
    if (!classesForReport.length) {
      toast.error(tx("Sélectionnez au moins une classe.", "اختر قسماً واحداً على الأقل.", "Select at least one class."));
      return;
    }
    setQuickAiBusy(true);
    try {
      const rates = appData.config.taux_exercices || {};
      const { analysis: got, failed } = await generateDiagnosticAnalysis({
        config: appData.config,
        classes: classesForReport,
        lang,
        exercises: langContent.exercices.map((e, i) => ({ title: e.titre, description: e.description, rate: rates[String(i)] ?? null })),
      }, undefined, ["summary"]);
      if (failed.length) {
        toast.error(aiErrorMessage(failed[0].error, tx));
        return;
      }
      updateAppData(prev => {
        const base = prev.config.analyse_ia?.[lang] || emptyAnalysis();
        const cfg = { ...prev.config, analyse_ia: { ...(prev.config.analyse_ia || {}), [lang]: { ...base, ...got, generated_at: new Date().toISOString() } } };
        return {
          ...prev,
          config: setLangContent(cfg, lang, {
            ...(got.observations?.length ? { observations: got.observations } : {}),
            ...(got.propositions?.length ? { propositions: got.propositions } : {}),
            ...(got.appreciation ? { appreciation_globale: got.appreciation } : {}),
          }),
        };
      });
      toast.success(tx("Textes rédigés : relisez-les et modifiez-les si besoin.", "تم تحرير النصوص: راجعها وعدّلها عند الحاجة.", "Texts written: review and edit them if needed."));
    } finally {
      setQuickAiBusy(false);
    }
  };
  // Écrit ce qui reste en attente en quittant la page / l'application
  useEffect(() => {
    const onHide = () => flushPendingSave();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      flushPendingSave();
    };
  }, [flushPendingSave]);

  // --- ACTIONS EXPORT PDF & IMPRESSION SÉPARÉES ---
  const handleDownloadPdf = async () => {
    if (!accessStore.guard("diagnostic.export_pdf")) return;
    setIsExportingPdf(true);
    toast.info(t.downloadingPdfMsg);
    try {
      const scopeName = reportClassesNames.length === 1
        ? reportClassesNames[0]
        : (reportScope === "all" ? "Toutes_Classes" : "Selection");
      const filename = `Rapport_Evaluation_Diagnostique_${reportTemplate === "t1" ? "" : `Modele${reportTemplate.slice(1)}_`}${scopeName}_${lang}.pdf`;

      if (currentTab !== "preview") {
        setCurrentTab("preview");
        await new Promise(r => setTimeout(r, 450));
      }
      // L'aperçu repasse en taille réelle (sans réduction) le temps de la capture
      await new Promise(r => setTimeout(r, 250));

      const ok = await exportDiagnosticReportToPdf("diagnostic-official-report", filename);
      if (ok) {
        toast.success(tx("Rapport téléchargé avec succès en PDF !", "تم تحميل التقرير بصيغة PDF بنجاح !", "Report downloaded as PDF!"));
      }
    } catch (e: any) {
      console.error(e);
      toast.error(tx("Erreur lors du téléchargement du PDF", "خطأ أثناء تحميل ملف PDF", "PDF download failed"));
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrintReport = () => {
    if (!accessStore.guard("diagnostic.export_pdf")) return;
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
      toast.error(tx("Le nom de la classe est obligatoire", "اسم القسم مطلوب", "Class name is required"));
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
          // Le contexte affiche déjà le message de succès
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
    toast.success(tx(`Classe « ${newCls.nom} » ajoutée.`, `تمت إضافة القسم « ${newCls.nom} ».`, `Class "${newCls.nom}" added.`));
  };

  const handleUpdateClass = () => {
    if (!editingClass || !editingClass.nom.trim()) return;

    try {
      const storedDates = getStoredRoomDates();
      storedDates[editingClass.id] = editingClass.date;
      void saveStoredRoomDates(storedDates);
    } catch (e) {
      console.error("Diagnostic: dates save failed", e);
    }

    updateAppData(prev => ({
      ...prev,
      classes: prev.classes.map(c => c.id === editingClass.id ? editingClass : c)
    }));
    setEditingClass(null);
    toast.success(tx("Classe mise à jour", "تم تحديث القسم", "Class updated"));
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
    toast.success(tx("Classe retirée de l'évaluation", "تم حذف القسم من التقويم", "Class removed from the assessment"));
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
      toast.info(tx("Mode démonstration : données d'exemple affichées", "وضع العرض: بيانات تجريبية", "Demo mode: sample data shown"));
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
    toast.success(tx(`Liste téléchargée (${targetClass.students.length} élèves)`, `تم تحميل اللائحة (${targetClass.students.length} تلميذ)`, `List downloaded (${targetClass.students.length} students)`));
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

        await saveStoredStudentNotes(storedNotes, importTargetClass.id, user?.id);

        updateAppData(prev => ({
          ...prev,
          classes: prev.classes.map(c => c.id === importTargetClass.id ? { ...c, students: existingStudents } : c)
        }));

        toast.success(tx(`${matchedCount} élèves mis à jour, ${newStudents.length} ajoutés.`, `تم تحديث ${matchedCount} تلميذ وإضافة ${newStudents.length}.`, `${matchedCount} students updated, ${newStudents.length} added.`));
      } else {
        importedStudents.forEach(s => {
          if (s.note !== null) {
            storedNotes[String(s.id)] = s.note;
          }
        });
        await saveStoredStudentNotes(storedNotes, importTargetClass.id, user?.id);

        updateAppData(prev => ({
          ...prev,
          classes: prev.classes.map(c => c.id === importTargetClass.id ? { ...c, students: importedStudents } : c)
        }));

        toast.success(tx(`${importedStudents.length} élèves importés.`, `تم استيراد ${importedStudents.length} تلميذ.`, `${importedStudents.length} students imported.`));
      }

      setImportTargetClass(null);
    } catch (err: any) {
      console.error(err);
      toast.error(tx("Fichier invalide ou illisible", "ملف غير صالح أو غير مقروء", "Invalid or unreadable file"));
    } finally {
      setImportingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // --- ACTIONS SAISIE DES NOTES ---
  const handleNoteChange = (studentId: string | number, val: string) => {
    setNotesDraft(prev => ({ ...prev, [String(studentId)]: val }));
  };

  const handleSaveNotes = async (): Promise<boolean> => {
    if (!currentClass || savingNotes) return false;

    // Validation : 0–20 (virgule ou point, 2 décimales max) ou « ABS »
    const invalid = currentClass.students.filter(s => !isValidNoteInput(notesDraft[String(s.id)] ?? ""));
    if (invalid.length > 0) {
      const names = invalid.slice(0, 5).map(s => s.name).join(", ") + (invalid.length > 5 ? "…" : "");
      toast.error(tx(
        `Notes invalides (0 à 20 ou ABS) : ${names}`,
        `نقط غير صالحة (من 0 إلى 20 أو ABS): ${names}`,
        `Invalid grades (0 to 20 or ABS): ${names}`
      ));
      return false;
    }

    setSavingNotes(true);
    try {
      const storedNotes = getStoredStudentNotes();

      const updatedStudents = currentClass.students.map(s => {
        const finalNote = parseNoteInput(notesDraft[String(s.id)] ?? "");
        storedNotes[String(s.id)] = finalNote;
        return { ...s, note: finalNote };
      });

      await saveStoredStudentNotes(storedNotes, currentClass.id, user?.id);

      updateAppData(prev => ({
        ...prev,
        classes: prev.classes.map(c => c.id === currentClass.id ? { ...c, students: updatedStudents } : c)
      }));
      flushPendingSave();

      toast.success(tx("Notes enregistrées et synchronisées", "تم حفظ النقط ومزامنتها بنجاح", "Grades saved and synchronized"));
      return true;
    } catch (e) {
      console.error("Diagnostic: notes save failed", e);
      toast.error(tx("Impossible d'enregistrer les notes", "تعذر حفظ النقط", "Could not save the grades"));
      return false;
    } finally {
      setSavingNotes(false);
    }
  };

  const handleAddStudent = async () => {
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

    try {
      const storedNotes = getStoredStudentNotes();
      storedNotes[newId] = finalNote;
      await saveStoredStudentNotes(storedNotes, currentClass.id, user?.id);
    } catch (e) {
      console.error("Diagnostic: note save failed", e);
    }

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
    toast.success(tx("Élève ajouté", "تمت إضافة التلميذ", "Student added"));
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
  // Contenu propre à la langue affichée : modifier en arabe met à jour le rapport arabe, etc.
  const updateLangContent = (fn: (c: DiagnosticLangContent) => Partial<DiagnosticLangContent>) => {
    updateAppData(prev => ({
      ...prev,
      config: setLangContent(prev.config, lang, fn(getLangContent(prev.config, lang))),
    }));
  };

  const handleAddObservation = () => {
    updateLangContent(c => ({
      observations: [...c.observations, lang === "ar" ? "ملاحظة بيداغوجية جديدة..." : lang === "en" ? "New pedagogical observation..." : "Nouvelle observation pédagogique..."]
    }));
  };

  const handleUpdateObservation = (index: number, val: string) => {
    updateLangContent(c => {
      const next = [...c.observations];
      next[index] = val;
      return { observations: next };
    });
  };

  const handleDeleteObservation = (index: number) => {
    setObservationToDelete(index);
  };

  const confirmDeleteObservation = () => {
    if (observationToDelete === null) return;
    updateLangContent(c => ({ observations: c.observations.filter((_, i) => i !== observationToDelete) }));
    setObservationToDelete(null);
  };

  const handleAddProposition = () => {
    updateLangContent(c => ({
      propositions: [...c.propositions, lang === "ar" ? "مقترح دعم ومعالجة جديد..." : lang === "en" ? "New support proposal..." : "Nouvelle proposition de soutien..."]
    }));
  };

  const handleUpdateProposition = (index: number, val: string) => {
    updateLangContent(c => {
      const next = [...c.propositions];
      next[index] = val;
      return { propositions: next };
    });
  };

  const handleDeleteProposition = (index: number) => {
    setPropositionToDelete(index);
  };

  const confirmDeleteProposition = () => {
    if (propositionToDelete === null) return;
    updateLangContent(c => ({ propositions: c.propositions.filter((_, i) => i !== propositionToDelete) }));
    setPropositionToDelete(null);
  };

  const handleAddExercise = () => {
    updateLangContent(c => {
      const exNum = c.exercices.length + 1;
      const exercices = [
        ...c.exercices,
        {
          titre: lang === "ar" ? `تمرين ${exNum}` : lang === "en" ? `Exercise ${exNum}` : `Exercice ${exNum}`,
          description: lang === "ar" ? "وصف المفاهيم والكفايات المستهدفة" : lang === "en" ? "Description of the assessed skills" : "Description des compétences évaluées"
        }
      ];
      return { exercices, nombre_exercices_texte: numberToWords(exercices.length, lang) };
    });
  };

  const handleUpdateExercise = (index: number, field: "titre" | "description", val: string) => {
    updateLangContent(c => {
      const next = [...c.exercices];
      next[index] = { ...next[index], [field]: val };
      return { exercices: next };
    });
  };

  const handleDeleteExercise = (index: number) => {
    setExerciseToDeleteDiag(index);
  };

  const confirmDeleteExerciseDiag = () => {
    if (exerciseToDeleteDiag === null) return;
    updateLangContent(c => {
      const exercices = c.exercices.filter((_, i) => i !== exerciseToDeleteDiag);
      return { exercices, nombre_exercices_texte: numberToWords(exercices.length, lang) };
    });
    setExerciseToDeleteDiag(null);
  };

  const handleSaveConfig = async () => {
    try {
      await saveDiagnosticConfigToCloud(appData.config, user?.id);
      toast.success(
        lang === "ar"
          ? "تم حفظ التغييرات والإعدادات بنجاح ومزامنتها في السحابة"
          : lang === "en"
          ? "Changes and settings saved successfully to Cloud"
          : "Modifications et paramètres enregistrés avec succès dans le Cloud"
      );
    } catch (e) {
      toast.error(tx("Erreur d'enregistrement des paramètres", "تعذر حفظ الإعدادات", "Could not save the settings"));
    }
  };

  const handleLoadDefaultTemplatesForLang = (targetLang: DiagLang) => {
    const tr = DIAGNOSTIC_TRANSLATIONS[targetLang] || DIAGNOSTIC_TRANSLATIONS.fr;
    const defaultAppr = targetLang === "ar" ? "متوسطة" : targetLang === "en" ? "moderate" : "médiocres";
    const exercices = (tr.defaultExercises || []).map(e => ({ ...e }));

    updateAppData(prev => ({
      ...prev,
      config: setLangContent(prev.config, targetLang, {
        appreciation_globale: defaultAppr,
        nombre_exercices_texte: numberToWords(exercices.length, targetLang),
        exercices,
        observations: [...(tr.defaultObservations || [])],
        propositions: [...(tr.defaultPropositions || [])],
      })
    }));

    toast.success(
      targetLang === "ar"
        ? "تم استيراد النماذج الافتراضية باللغة العربية"
        : targetLang === "en"
        ? "Loaded default English templates"
        : "Modèles par défaut en Français chargés"
    );
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
    <Card className="border-indigo-100 dark:border-indigo-900 bg-muted/40 no-print print:hidden">
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
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

          {/* Toggle Option Graphiques & Analyse + Sélecteur de Fond (Gris / Blanc) */}
          <div className="flex items-center gap-3 flex-wrap">
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

            {includeGraphsInReport && (
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
                <span className="text-slate-500 font-medium">
                  {lang === "ar" ? "خلفية المبيانات :" : lang === "en" ? "Charts Background:" : "Fond des graphiques :"}
                </span>
                <div className="inline-flex rounded-md shadow-xs bg-slate-100 dark:bg-slate-800 p-0.5">
                  <Button
                    type="button"
                    variant={chartBgTheme === "gray" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setChartBgTheme("gray")}
                    className="h-6 text-[11px] px-2 rounded-sm"
                  >
                    {lang === "ar" ? "رمادي" : lang === "en" ? "Gray" : "Gris"}
                  </Button>
                  <Button
                    type="button"
                    variant={chartBgTheme === "white" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setChartBgTheme("white")}
                    className="h-6 text-[11px] px-2 rounded-sm"
                  >
                    {lang === "ar" ? "أبيض" : lang === "en" ? "White" : "Blanc"}
                  </Button>
                </div>
              </div>
            )}
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
            {reportStats.total_presents} {t.presentCountLabel} • {includeGraphsInReport ? "Avec graphes & analyse" : "Format classique épuré"}
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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 no-print print:hidden">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-11 h-11 sm:w-14 sm:h-14 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900 rounded-xl flex items-center justify-center p-2 shadow-inner shrink-0">
            <img
              key={reportBranding.customLogo && reportBranding.logoUrl ? reportBranding.logoUrl : "default"}
              src={reportBranding.customLogo && reportBranding.logoUrl ? reportBranding.logoUrl : "/assets/header_logo.png"}
              alt={reportBranding.customLogo ? reportBranding.schoolName || "Logo" : "Armoiries du Royaume du Maroc"}
              className="max-h-full object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            <GraduationCap className="w-8 h-8 text-indigo-600 hidden" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
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
            <p className="hidden sm:block text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {t.appSubtitle}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 w-full md:w-auto md:flex md:flex-wrap md:items-center">
          {canAccess("diagnostic.compare") && <DiagnosticCompare classes={appData.classes} tr={tx} lang={lang} />}
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
            <FileSpreadsheet className="w-4 h-4 shrink-0 text-emerald-600" />
            <span className="truncate">{t.downloadClassTemplateBtn} {currentClass ? `(${currentClass.nom})` : ""}</span>
          </Button>

          <Button
            size="sm"
            onClick={() => guardLeave(() => setCurrentTab("preview"))}
            className="md:hidden text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
          >
            <Eye className="w-4 h-4" />
            <span>{lang === "ar" ? "التقرير" : lang === "en" ? "Report" : "Rapport"}</span>
          </Button>

          <Button
            size="sm"
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            className="hidden md:inline-flex text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-100 dark:shadow-none font-semibold"
          >
            {isExportingPdf ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>{isExportingPdf ? t.downloadingPdfMsg : t.downloadPdfBtn}</span>
          </Button>

          <Button
            size="sm"
            onClick={handlePrintReport}
            className="hidden md:inline-flex text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100 dark:shadow-none font-semibold"
          >
            <Printer className="w-4 h-4" />
            <span>{t.printPdfBtn}</span>
          </Button>
        </div>
      </div>

      {/* CHOIX DU MODE DE RÉDACTION */}
      {!redactionMode ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900 dark:bg-indigo-950/20 no-print print:hidden">
          <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
            {tx("Comment voulez-vous rédiger le rapport ?", "كيف تريد تحرير التقرير؟", "How do you want to write the report?")}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => chooseRedactionMode("ai")} className="rounded-lg border-2 border-violet-300 bg-white p-3 text-start transition hover:border-violet-500 dark:border-violet-800 dark:bg-slate-900">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-violet-700 dark:text-violet-300"><Sparkles className="h-4 w-4" />{tx("Automatique (IA)", "تلقائي (الذكاء الاصطناعي)", "Automatic (AI)")}</span>
              <span className="mt-1 block text-xs text-slate-600 dark:text-slate-300">{tx("Les paramètres sont remplis depuis vos données, puis l'IA rédige résultats, observations et propositions selon les notes et le test. Tout reste modifiable.", "تُملأ الإعدادات من معطياتك، ثم يحرر الذكاء الاصطناعي النتائج والملاحظات والمقترحات حسب النقط والرائز. كل شيء يبقى قابلا للتعديل.", "Settings are filled from your data, then the AI writes results, findings and proposals from the marks and the test. Everything stays editable.")}</span>
            </button>
            <button type="button" onClick={() => chooseRedactionMode("manual")} className="rounded-lg border-2 border-slate-300 bg-white p-3 text-start transition hover:border-slate-500 dark:border-slate-700 dark:bg-slate-900">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100"><Edit3 className="h-4 w-4" />{tx("Manuel", "يدوي", "Manual")}</span>
              <span className="mt-1 block text-xs text-slate-600 dark:text-slate-300">{tx("Vous remplissez vous-même l'onglet 4 (Résultats & Remédiation) et l'onglet 5 (Paramètres).", "تملأ بنفسك التبويب 4 (النتائج والمعالجة) والتبويب 5 (الإعدادات).", "You fill in tab 4 (Results & Remediation) and tab 5 (Settings) yourself.")}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300 no-print print:hidden">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${redactionMode === "ai" ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}>
            {redactionMode === "ai" ? <Sparkles className="h-3.5 w-3.5" /> : <Edit3 className="h-3.5 w-3.5" />}
            {redactionMode === "ai" ? tx("Rédaction automatique (IA)", "تحرير تلقائي (ذكاء اصطناعي)", "Automatic writing (AI)") : tx("Rédaction manuelle", "تحرير يدوي", "Manual writing")}
          </span>
          <button type="button" className="underline underline-offset-2 hover:text-indigo-600" onClick={() => chooseRedactionMode(redactionMode === "ai" ? "manual" : "ai")}>
            {redactionMode === "ai" ? tx("Passer en manuel", "التحويل إلى اليدوي", "Switch to manual") : tx("Passer en automatique (IA)", "التحويل إلى التلقائي", "Switch to automatic (AI)")}
          </button>
        </div>
      )}

      {/* NAVIGATION ONGLET */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800 no-print print:hidden">
        <Button
          variant={currentTab === "classes" ? "default" : "ghost"}
          size="sm"
          onClick={() => guardLeave(() => setCurrentTab("classes"))}
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
          onClick={() => guardLeave(() => setCurrentTab("stats"))}
          className="text-xs gap-2 shrink-0 rounded-xl"
        >
          <PieChartIcon className="w-4 h-4" />
          <span>{t.tabStats}</span>
        </Button>

        <Button
          variant={currentTab === "observations" ? "default" : "ghost"}
          size="sm"
          onClick={() => guardLeave(() => setCurrentTab("observations"))}
          className="text-xs gap-2 shrink-0 rounded-xl"
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>{t.tabObservations}</span>
        </Button>

        <Button
          variant={currentTab === "config" ? "default" : "ghost"}
          size="sm"
          onClick={() => guardLeave(() => setCurrentTab("config"))}
          className="text-xs gap-2 shrink-0 rounded-xl"
        >
          <SettingsIcon className="w-4 h-4" />
          <span>{t.tabConfig}</span>
        </Button>

        <Button
          variant={currentTab === "preview" ? "default" : "ghost"}
          size="sm"
          onClick={() => guardLeave(() => setCurrentTab("preview"))}
          className="text-xs gap-2 shrink-0 rounded-xl font-semibold text-indigo-600 dark:text-indigo-400"
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
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
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
                <Card key={cls.id} className="relative overflow-hidden flex flex-col justify-between card-hover">
                  <div className={`absolute top-0 left-0 right-0 h-1.5 ${cls.students.length > 0 ? "bg-indigo-500" : "bg-slate-300"}`} />
                  <CardHeader className="pb-3 pt-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{cls.nom}</span>
                        </CardTitle>
                        <CardDescription className="text-xs flex items-center gap-1.5 mt-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{t.classDateLabel} {cls.date}</span>
                        </CardDescription>
                      </div>
                      <Badge variant={cls.students.length > 0 ? "secondary" : "outline"} className="text-xs font-mono font-semibold">
                        {cls.students.length} {lang === "ar" ? "تلميذاً" : "élèves"}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 pb-4">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">{t.presentCountLabel}</span>
                        <span className="font-semibold text-emerald-600 text-sm">{stat.present_count}</span>
                      </div>
                      <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">{t.absentCountLabel}</span>
                        <span className="font-semibold text-rose-500 text-sm">{stat.absent_count}</span>
                      </div>
                      <div className="col-span-2 p-2 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-lg flex items-center justify-between">
                        <span className="text-indigo-900 dark:text-indigo-300 text-xs font-medium">{t.averageNoteLabel}</span>
                        <span className="font-semibold text-indigo-700 dark:text-indigo-300 text-sm">{stat.average_note} / 20</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 pt-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => guardLeave(() => {
                            setActiveClassId(cls.id);
                            setClassGradingModes(prev => ({ ...prev, [cls.id]: "manual" }));
                            setCurrentTab("notes");
                          })}
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
                        onClick={() => guardLeave(() => {
                          setActiveClassId(cls.id);
                          setClassGradingModes(prev => ({ ...prev, [cls.id]: "quiz" }));
                          setCurrentTab("notes");
                        })}
                        className="w-full h-8 px-2 text-xs font-semibold gap-1.5 border-amber-300 bg-amber-50/50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/60 shadow-2xs"
                      >
                        <Zap className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                        <span className="truncate">{t.importFromQuizBtn}</span>
                      </Button>

                      <div className="flex items-center justify-between pt-1 text-slate-400 text-xs">
                        <button
                          onClick={() => handleDownloadExcelForClass(cls)}
                          className="text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1 hover:underline"
                          title={tx("Télécharger la liste au format Excel", "تحميل اللائحة بصيغة Excel", "Download the list as Excel")}
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
              <span className="text-xs font-semibold uppercase text-slate-400 shrink-0">{t.selectClassLabel}</span>
              {appData.classes.map(c => (
                <Button
                  key={c.id}
                  variant={c.id === activeClassId ? "default" : "outline"}
                  size="sm"
                  onClick={() => { if (c.id !== activeClassId) guardLeave(() => setActiveClassId(c.id)); }}
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
                onClick={() => { void handleSaveNotes(); }}
                disabled={savingNotes}
                aria-busy={savingNotes}
                className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-semibold"
              >
                {savingNotes ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                <span>{t.saveNotesBtn}</span>
                {notesDirty && !savingNotes && <span className="h-2 w-2 rounded-full bg-amber-300" aria-label={tx("Modifications non enregistrées", "تعديلات غير محفوظة", "Unsaved changes")} />}
              </Button>
            </div>
          </div>

          {/* SÉLECTION DU MODE D'ATTRIBUTION DES NOTES (MANUEL VS QUIZ) */}
          <Card className="border-indigo-100 dark:border-indigo-900/60 bg-muted/40 shadow-2xs">
            <CardContent className="p-3.5 sm:p-4 space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Boutons de basculement de mode */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
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
                                <div className="px-2 py-1 text-[10px] font-semibold uppercase text-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40">
                                  {tx(`Quiz de cette classe (${currentClass?.nom})`, `اختبارات هذا الفصل (${currentClass?.nom})`, `Quizzes of this class (${currentClass?.nom})`)}
                                </div>
                                {availableQuizzes.direct.map(q => (
                                  <SelectItem key={q.id} value={q.id} className="text-xs">
                                    <span className="font-semibold">{q.title}</span>
                                    <span className="text-[10px] text-muted-foreground ml-1.5 rtl:ml-0 rtl:mr-1.5">
                                      ({new Date(q.exam_date).toLocaleDateString(dateLocale)})
                                    </span>
                                  </SelectItem>
                                ))}
                              </>
                            )}
                            {availableQuizzes.other.length > 0 && (
                              <>
                                <div className="px-2 py-1 text-[10px] font-semibold uppercase text-slate-500 bg-muted/40 mt-1">
                                  {tx("Quiz d'autres cours", "اختبارات المقررات الأخرى", "Quizzes from other courses")}
                                </div>
                                {availableQuizzes.other.map(q => (
                                  <SelectItem key={q.id} value={q.id} className="text-xs">
                                    <span>{q.title}</span>
                                    <span className="text-[10px] text-muted-foreground ml-1.5 rtl:ml-0 rtl:mr-1.5">
                                      ({new Date(q.exam_date).toLocaleDateString(dateLocale)})
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
                          className="h-8 text-xs gap-1.5 bg-foreground text-background hover:bg-foreground/90 shadow-xs font-semibold"
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
                      ? "مسك يدوي: يمكنك تعديل النقط مباشرة في خانات الجدول (0 إلى 20)، أو تعيين ABS للغائبين، أو استيراد ملف إكسيل."
                      : "Saisie manuelle : Vous pouvez saisir directement les notes dans le tableau (0 à 20), marquer ABS pour les absents, ou importer un fichier Excel."}
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
                    <p className="text-2xl font-semibold text-slate-900 dark:text-white mt-1">{currentStat.total_students}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                    <span className="text-xs text-slate-400 uppercase font-semibold">{t.presentCountLabel}</span>
                    <p className="text-2xl font-semibold text-emerald-600 mt-1">{currentStat.present_count}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                    <span className="text-xs text-slate-400 uppercase font-semibold">{t.absentCountLabel}</span>
                    <p className="text-2xl font-semibold text-slate-500 mt-1">{currentStat.absent_count}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                    <span className="text-xs text-slate-400 uppercase font-semibold">{t.averageNoteLabel}</span>
                    <p className="text-2xl font-semibold text-indigo-600 mt-1">{currentStat.average_note} <span className="text-xs text-slate-400">/ 20</span></p>
                  </div>
                </div>
              );
            })()
          )}

          {currentClass && currentClass.students.length > 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left rtl:text-right text-xs sm:text-sm">
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
                      const isValidNum = !isAbs && isValidNoteInput(noteVal) && noteVal.trim() !== "";
                      const isInvalid = !isValidNoteInput(noteVal);

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
                          <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                            {student.name}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <Input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              dir="ltr"
                              value={noteVal}
                              onChange={(e) => handleNoteChange(student.id, e.target.value)}
                              placeholder={tx("0-20 ou ABS", "0-20 أو ABS", "0-20 or ABS")}
                              aria-label={tx(`Note de ${student.name}`, `نقطة ${student.name}`, `Grade of ${student.name}`)}
                              aria-invalid={isInvalid}
                              className={`h-9 w-28 text-center font-semibold font-mono mx-auto text-sm ${isInvalid ? "border-rose-500 bg-rose-50 text-rose-700 focus-visible:ring-rose-500 dark:bg-rose-950/30" : ""}`}
                            />
                            {isInvalid && (
                              <span className="mt-0.5 block text-[10px] font-semibold text-rose-600">{tx("0 à 20 ou ABS", "من 0 إلى 20 أو ABS", "0 to 20 or ABS")}</span>
                            )}
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
                                className="h-8 min-w-[32px] px-2 text-[11px] text-slate-500 hover:text-slate-700"
                                aria-label={tx(`Marquer ${student.name} absent`, `تسجيل ${student.name} غائباً`, `Mark ${student.name} absent`)}
                              >
                                {t.setAbsBtn}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteStudent(student.id, student.name)}
                                className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                aria-label={tx(`Retirer ${student.name}`, `حذف ${student.name}`, `Remove ${student.name}`)}
                                title={tx("Retirer l'élève", "حذف التلميذ", "Remove student")}
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
              <h3 className="font-semibold text-slate-700 dark:text-slate-300">{t.noStudentsMessage}</h3>
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
                <CardTitle className="text-3xl font-semibold text-indigo-600">{reportStats.total_presents}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-500">
                Sur {classesForReport.reduce((acc, s) => acc + s.students.length, 0)} {t.totalStudentsLabel}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase font-semibold">{t.statsKpiStrugglingRate}</CardDescription>
                <CardTitle className="text-3xl font-semibold text-rose-500">{reportStats.pct_struggling} %</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-500">
                {t.tranche1Name}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase font-semibold">{t.statsKpiAppreciation}</CardDescription>
                <CardTitle className="text-base font-semibold text-slate-900 dark:text-white capitalize">
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
                <CardTitle className="text-3xl font-semibold text-emerald-600">{classesForReport.length}</CardTitle>
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
                <CardTitle className="text-base font-semibold">{t.chartDistributionTitle}</CardTitle>
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
                <CardTitle className="text-base font-semibold">{t.chartPieTitle}</CardTitle>
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
              <CardTitle className="text-base font-semibold">{t.officialTableTitle}</CardTitle>
              <CardDescription className="text-xs">{t.officialTableSubtitle}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-center border-collapse border border-slate-300 dark:border-slate-700 text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                      <th rowSpan={2} className="border border-slate-300 dark:border-slate-700 p-2 italic w-1/4">{t.reportTable1ClassCol}</th>
                      <th rowSpan={2} className="border border-slate-300 dark:border-slate-700 p-2 w-24">{t.indicatorCol}</th>
                      <th className="border border-slate-300 dark:border-slate-700 p-2 font-semibold text-rose-600">
                        {t.tranche1Name}
                      </th>
                      <th className="border border-slate-300 dark:border-slate-700 p-2 font-semibold text-amber-600">
                        {t.tranche2Name}
                      </th>
                      <th className="border border-slate-300 dark:border-slate-700 p-2 font-semibold text-blue-600">
                        {t.tranche3Name}
                      </th>
                      <th className="border border-slate-300 dark:border-slate-700 p-2 font-semibold text-emerald-600">
                        {t.tranche4Name}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportStats.classes_stats.map((stat, idx) => (
                      <React.Fragment key={idx}>
                        <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td rowSpan={2} className="border border-slate-300 dark:border-slate-700 p-2 font-semibold italic text-left rtl:text-right pl-4 rtl:pl-2 rtl:pr-4">
                            {stat.nom}
                          </td>
                          <td className="border border-slate-300 dark:border-slate-700 p-2 font-semibold bg-slate-50 dark:bg-slate-800/20">
                            {t.countRow}
                          </td>
                          <td className="border border-slate-300 dark:border-slate-700 p-2 font-semibold text-purple-700 dark:text-purple-400">
                            {stat.t1_count}
                          </td>
                          <td className="border border-slate-300 dark:border-slate-700 p-2 font-semibold text-purple-700 dark:text-purple-400">
                            {stat.t2_count}
                          </td>
                          <td className="border border-slate-300 dark:border-slate-700 p-2 font-semibold text-purple-700 dark:text-purple-400">
                            {stat.t3_count}
                          </td>
                          <td className="border border-slate-300 dark:border-slate-700 p-2 font-semibold text-purple-700 dark:text-purple-400">
                            {stat.t4_count}
                          </td>
                        </tr>
                        <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="border border-slate-300 dark:border-slate-700 p-2 font-semibold italic bg-slate-50 dark:bg-slate-800/20">
                            {t.percentageRow}
                          </td>
                          <td className="border border-slate-300 dark:border-slate-700 p-2 font-semibold text-purple-700 dark:text-purple-400">
                            {stat.t1_pct} %
                          </td>
                          <td className="border border-slate-300 dark:border-slate-700 p-2 font-semibold text-purple-700 dark:text-purple-400">
                            {stat.t2_pct} %
                          </td>
                          <td className="border border-slate-300 dark:border-slate-700 p-2 font-semibold text-purple-700 dark:text-purple-400">
                            {stat.t3_pct} %
                          </td>
                          <td className="border border-slate-300 dark:border-slate-700 p-2 font-semibold text-purple-700 dark:text-purple-400">
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
          {canAccess("ai.diagnostic") && (
            <div className="flex flex-col gap-2 rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-xs text-violet-900 sm:flex-row sm:items-center sm:justify-between dark:border-violet-900 dark:bg-violet-950/20 dark:text-violet-200">
              <span className="flex items-start gap-1.5"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />{tx("L'IA peut rédiger l'appréciation, les observations pédagogiques et les propositions à partir des notes des classes choisies. Vous pourrez tout modifier ensuite.", "يمكن للذكاء الاصطناعي تحرير التقدير العام والملاحظات البيداغوجية والمقترحات انطلاقا من نقط الأقسام المختارة. يمكنك تعديل كل شيء بعد ذلك.", "The AI can write the overall level, the findings and the proposals from the marks of the selected classes. You can edit everything afterwards.")}</span>
              <Button size="sm" disabled={quickAiBusy} onClick={() => void quickGenerateTexts()} className="h-8 shrink-0 gap-1 bg-violet-600 text-xs text-white hover:bg-violet-700">
                {quickAiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {quickAiBusy ? tx("Rédaction…", "جارٍ التحرير…", "Writing…") : tx("Générer avec l'IA", "التوليد بالذكاء الاصطناعي", "Generate with AI")}
              </Button>
            </div>
          )}
          {/* Barre d'action supérieure */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                {t.tabObservations}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {lang === "ar"
                  ? "تعديل الملاحظات البيداغوجية، مكونات الرائز التشخيصي، ومقترحات الدعم والمعالجة."
                  : lang === "en"
                  ? "Customize pedagogical findings, test structure, and remediation proposals."
                  : "Personnalisez les observations pédagogiques, la composition du test et le plan de remédiation."}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleLoadDefaultTemplatesForLang(lang)}
                className="text-xs gap-1.5 border-slate-200 dark:border-slate-800"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  {lang === "ar"
                    ? "استيراد النماذج الافتراضية بالعربية"
                    : lang === "en"
                    ? "Load Default English Templates"
                    : "Charger modèles par défaut en Français"}
                </span>
              </Button>

              <Button
                size="sm"
                onClick={handleSaveConfig}
                className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>{lang === "ar" ? "حفظ التغييرات" : lang === "en" ? "Save Changes" : "Enregistrer les modifications"}</span>
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">{t.globalAppreciationTitle}</CardTitle>
              <CardDescription className="text-xs">{t.globalAppreciationSubtitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Input
                  value={langContent.appreciation_globale}
                  dir="auto"
                  onChange={(e) => { const v = e.target.value; updateLangContent(() => ({ appreciation_globale: v })); }}
                  placeholder={lang === "ar" ? "التقدير العام (مثال: مرضية ومشجعة...)" : lang === "en" ? "Global appreciation..." : "Appréciation globale (ex: satisfaisants...)"}
                  className="max-w-md text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateLangContent(() => ({ appreciation_globale: translateAppreciation(reportStats.default_appreciation, lang) }))}
                  className="text-xs gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{t.useCalculatedAppreciationBtn} ({translateAppreciation(reportStats.default_appreciation, lang)})</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">{t.testCompositionTitle}</CardTitle>
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
                  value={langContent.nombre_exercices_texte}
                  dir="auto"
                  onChange={(e) => { const v = e.target.value; updateLangContent(() => ({ nombre_exercices_texte: v })); }}
                  placeholder={lang === "ar" ? "أربعة" : lang === "en" ? "four" : "quatre"}
                  className="max-w-xs h-8 text-xs font-medium"
                />
              </div>

              {langContent.exercices.map((ex, idx) => (
                <div key={idx} className="flex items-start gap-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                  <Input
                    value={ex.titre}
                    onChange={(e) => handleUpdateExercise(idx, "titre", e.target.value)}
                    dir="auto"
                    placeholder={lang === "ar" ? `تمرين ${idx + 1}` : `Exercice ${idx + 1}`}
                    className="w-36 h-9 text-xs font-semibold shrink-0"
                  />
                  <Input
                    value={ex.description}
                    onChange={(e) => handleUpdateExercise(idx, "description", e.target.value)}
                    dir="auto"
                    placeholder={lang === "ar" ? "موضوع التمرين والكفايات المستهدفة..." : "Description du contenu et des compétences évaluées..."}
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
                <CardTitle className="text-base font-semibold">{t.observationsTitle}</CardTitle>
                <CardDescription className="text-xs">{t.observationsSubtitle}</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={handleAddObservation} className="gap-1.5 text-xs">
                <PlusCircle className="w-4 h-4 text-emerald-600" />
                <span>{t.addObservationBtn}</span>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {langContent.observations.map((obs, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="font-semibold text-slate-400 mt-2 text-sm">➢</span>
                  <Textarea
                    value={obs}
                    onChange={(e) => handleUpdateObservation(idx, e.target.value)}
                    dir="auto"
                    placeholder={lang === "ar" ? "أدخل الملاحظة البيداغوجية..." : "Entrez l'observation pédagogique constatée..."}
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
                <CardTitle className="text-base font-semibold">{t.propositionsTitle}</CardTitle>
                <CardDescription className="text-xs">{t.propositionsSubtitle}</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={handleAddProposition} className="gap-1.5 text-xs">
                <PlusCircle className="w-4 h-4 text-emerald-600" />
                <span>{t.addPropositionBtn}</span>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {langContent.propositions.map((prop, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="font-semibold text-slate-400 mt-2 text-sm">➢</span>
                  <Textarea
                    value={prop}
                    onChange={(e) => handleUpdateProposition(idx, e.target.value)}
                    dir="auto"
                    placeholder={lang === "ar" ? "أدخل مقترح الدعم والمعالجة..." : "Entrez la proposition de remédiation..."}
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

          {/* Barre d'action inférieure */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              size="sm"
              onClick={handleSaveConfig}
              className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>{lang === "ar" ? "حفظ التغييرات" : lang === "en" ? "Save Changes" : "Enregistrer les modifications"}</span>
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 5 : PARAMÈTRES DU RAPPORT */}
      {/* ========================================================================= */}
      {currentTab === "config" && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base font-semibold">{t.adminConfigTitle}</CardTitle>
              <Button variant="outline" size="sm" onClick={() => { fillFromData(true); toast.success(tx("Paramètres remplis depuis vos données.", "تم ملء الإعدادات من معطياتك.", "Settings filled from your data.")); }} className="gap-1.5 text-xs">
                <Database className="h-3.5 w-3.5 text-indigo-600" />{tx("Remplir depuis les données", "ملء من المعطيات", "Fill from data")}
              </Button>
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
              <CardTitle className="text-base font-semibold">{t.pedagogicalConfigTitle}</CardTitle>
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
              onClick={handleSaveConfig}
              className="text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>{t.saveConfigBtn}</span>
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 6 : RAPPORT — réglages à gauche, aperçu A4 à droite                  */}
      {/* ========================================================================= */}
      {currentTab === "preview" && (() => {
        const L = (ar: string, fr: string, en: string) => (lang === "ar" ? ar : lang === "en" ? en : fr);
        const sectionTitle = (n: number, label: string) => (
          <div className="flex items-center gap-2 mb-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-semibold text-white">{n}</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">{label}</span>
          </div>
        );
        const actionButtons = (
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handleDownloadPdf}
              disabled={isExportingPdf || classesForReport.length === 0}
              className="h-10 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm"
            >
              {isExportingPdf ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span className="truncate">{isExportingPdf ? L("جارٍ التحميل…", "Génération…", "Generating…") : L("تحميل PDF", "Télécharger PDF", "Download PDF")}</span>
            </Button>
            <Button
              variant="outline"
              onClick={handlePrintReport}
              disabled={classesForReport.length === 0}
              className="h-10 gap-1.5 font-semibold text-xs sm:text-sm"
            >
              <Printer className="w-4 h-4" />
              <span className="truncate">{L("طباعة", "Imprimer", "Print")}</span>
            </Button>
          </div>
        );
        const infoRows: { label: string; value: string }[] = [
          { label: L("المؤسسة", "Établissement", "School"), value: appData.config.lycee },
          { label: L("الأستاذ(ة)", "Enseignant(e)", "Teacher"), value: appData.config.nom_enseignant },
          { label: L("السنة الدراسية", "Année scolaire", "School year"), value: appData.config.annee_scolaire },
          { label: L("الفترة", "Période", "Period"), value: appData.config.periode_diagnostic },
        ];

        return (
          <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)] items-start">
            {/* ---------------- Panneau de gestion du rapport ---------------- */}
            <aside className="space-y-3 no-print print:hidden lg:sticky lg:top-2">
              {/* Résumé + actions */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{L("التقرير الرسمي", "Rapport officiel", "Official report")}</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {classesForReport.length} {t.selectedClassesCount} • {reportStats.total_presents} {t.presentCountLabel}
                  </p>
                </div>
                {actionButtons}
              </div>

              {/* 1. Modèle */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                {sectionTitle(1, L("نموذج التقرير", "Modèle", "Template"))}
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: "t1" as const, title: L("النموذج 1", "Modèle 1", "Template 1"), desc: L("تقرير مفصل مع الفئات والملاحظات", "Rapport détaillé : tranches, observations, propositions", "Detailed: levels, observations, proposals") },
                    { id: "t2" as const, title: L("النموذج 2", "Modèle 2", "Template 2"), desc: L("تقرير حسب الأقسام", "Rapport par classes (<5, 5-10, 10-15, 15-20)", "By class (<5, 5-10, 10-15, 15-20)") },
                    { id: "t3" as const, title: L("النموذج 3 ✨", "Modèle 3 ✨", "Template 3 ✨"), desc: L("تحليل التحكم في الموارد وخطة الدعم (بالذكاء الاصطناعي)", "Maîtrise par ressource, besoins des groupes, plan de remédiation (IA)", "Mastery per resource, group needs, remediation plan (AI)") },
                    { id: "t4" as const, title: L("النموذج 4", "Modèle 4", "Template 4"), desc: L("لوائح فئات الدعم بأسماء المتعلمين", "Groupes de besoin : listes nominatives par catégorie", "Need-based groups: named lists") },
                  ]).map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setReportTemplate(opt.id)}
                      className={`text-start rounded-lg border-2 p-2.5 transition-colors ${
                        reportTemplate === opt.id
                          ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40"
                          : "border-slate-200 dark:border-slate-800 hover:border-indigo-300"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white">
                        <span className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${reportTemplate === opt.id ? "border-indigo-600 bg-indigo-600" : "border-slate-300"}`} />
                        {opt.title}
                      </div>
                      <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Classes */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                {sectionTitle(2, L("الأقسام المعنية", "Classes du rapport", "Classes"))}
                <div className="grid grid-cols-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-0.5">
                  {([
                    { id: "all" as const, label: t.scopeAllClasses },
                    { id: "single" as const, label: t.scopeSingleClass },
                    { id: "custom" as const, label: t.scopeCustom },
                  ]).map(o => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setReportScope(o.id)}
                      className={`rounded-md px-1.5 py-1.5 text-[11px] font-semibold leading-tight transition-colors ${
                        reportScope === o.id ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>

                {appData.classes.length === 0 ? (
                  <p className="mt-3 text-xs text-slate-500">{t.noClassesMessage}</p>
                ) : reportScope === "all" ? (
                  <p className="mt-3 text-xs text-slate-500 leading-relaxed">{reportClassesNames.join(" • ")}</p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {appData.classes.map(c => {
                      const checked = reportScope === "single" ? c.id === selectedSingleClassId : selectedClassIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            if (reportScope === "single") setSelectedSingleClassId(c.id);
                            else setSelectedClassIds(prev => (prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]));
                          }}
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                            checked
                              ? "border-indigo-400 bg-indigo-50 text-indigo-900 dark:border-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-200"
                              : "border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                          }`}
                        >
                          {checked && <Check className="h-3 w-3" />}
                          {c.nom}
                          <span className="text-[10px] opacity-60">({c.students.length})</span>
                        </button>
                      );
                    })}
                    {reportScope === "custom" && (
                      <div className="flex w-full gap-1 pt-1">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedClassIds(appData.classes.map(c => c.id))} className="h-7 px-2 text-[11px] text-indigo-600">{t.selectAllBtn}</Button>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedClassIds([])} className="h-7 px-2 text-[11px] text-slate-500">{t.deselectAllBtn}</Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Contenu */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
                {sectionTitle(3, L("المحتوى", "Contenu", "Content"))}
                <DiagnosticAiPanel
                    config={appData.config}
                    classes={classesForReport}
                    lang={lang}
                    exams={exams}
                    courseIds={courses.filter(c => c.professor_id === user?.id).map(c => c.id)}
                    onConfig={(updater) => updateAppData(prev => ({ ...prev, config: updater(prev.config) }))}
                    template={reportTemplate}
                    mode={redactionMode === "ai" ? "ai" : "manual"}
                    onOpenTexts={() => (reportTemplate === "t2" ? setShowTemplate2Texts(true) : guardLeave(() => setCurrentTab("observations")))}
                  />
                {reportTemplate === "t3" || reportTemplate === "t4" ? (
                  <ChartSettingsPanel
                    lang={lang}
                    enabled={includeGraphsInReport}
                    onEnabledChange={setIncludeGraphsInReport}
                    settings={appData.config.rapport2_graphiques}
                    onChange={(patch) => updateAppData(prev => ({
                      ...prev,
                      config: { ...prev.config, rapport2_graphiques: { ...DEFAULT_REPORT2_CHARTS, ...(prev.config.rapport2_graphiques || {}), ...patch } },
                    }))}
                    classNames={classesForReport.map(c => c.nom)}
                  />
                ) : reportTemplate === "t1" ? (
                  <>
                    <Report1ChartPicker
                      lang={lang}
                      enabled={includeGraphsInReport}
                      onEnabledChange={setIncludeGraphsInReport}
                      settings={appData.config.rapport1_graphiques}
                      onChange={(patch) => updateAppData(prev => ({
                        ...prev,
                        config: { ...prev.config, rapport1_graphiques: { ...DEFAULT_REPORT1_CHARTS, ...(prev.config.rapport1_graphiques || {}), ...patch } },
                      }))}
                      chartBg={chartBgTheme}
                      onChartBg={setChartBgTheme}
                    />
                    <Button variant="outline" size="sm" onClick={() => guardLeave(() => setCurrentTab("observations"))} className="w-full justify-start gap-1.5 text-xs">
                      <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                      {L("تعديل الملاحظات والمقترحات (4)", "Modifier observations & propositions (onglet 4)", "Edit observations & proposals (tab 4)")}
                    </Button>
                  </>
                ) : (
                  <>
                    <ChartSettingsPanel
                      lang={lang}
                      enabled={includeGraphsInReport}
                      onEnabledChange={setIncludeGraphsInReport}
                      settings={appData.config.rapport2_graphiques}
                      onChange={(patch) => updateAppData(prev => ({
                        ...prev,
                        config: { ...prev.config, rapport2_graphiques: { ...DEFAULT_REPORT2_CHARTS, ...(prev.config.rapport2_graphiques || {}), ...patch } },
                      }))}
                      classNames={classesForReport.map(c => c.nom)}
                    />
                    <Button variant="outline" size="sm" onClick={() => setShowTemplate2Texts(v => !v)} className="w-full justify-start gap-1.5 text-xs">
                      <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                      {L("تخصيص نصوص النموذج 2", "Personnaliser les textes du modèle 2", "Customise template 2 texts")}
                    </Button>
                    {showTemplate2Texts && (
                      <div className="space-y-3">
                        <p className="text-[11px] text-slate-500">
                          {L(
                            "اترك الحقل فارغا لاستعمال النص التلقائي.",
                            "Laissez un champ vide pour utiliser le texte automatique.",
                            "Leave a field empty to use the automatic text."
                          )}
                        </p>
                        {([
                          { key: "intro" as const, label: L("النص التمهيدي", "Introduction", "Introduction"), ph: defaultTemplate2Intro(appData.config, classesForReport, lang) },
                          { key: "remarque" as const, label: L("ملاحظة (الغياب)", "Remarque (absences)", "Note (absences)"), ph: L("نص تلقائي حسب نسبة الغياب", "Texte automatique selon le taux d'absence", "Automatic text based on the absence rate") },
                          { key: "soutien" as const, label: L("أساليب الدعم وطرق المعالجة", "Méthodes de soutien et de remédiation", "Support and remediation methods"), ph: defaultTemplate2Support(lang) },
                        ]).map(f => (
                          <div key={f.key} className="space-y-1">
                            <Label className="text-xs font-semibold">{f.label}</Label>
                            <Textarea
                              rows={3}
                              value={appData.config.rapport2_par_langue?.[lang]?.[f.key] ?? (appData.config[`rapport2_${f.key}` as const] || "")}
                              placeholder={f.ph}
                              dir={getDirection()}
                              onChange={(e) => {
                                const v = e.target.value;
                                updateAppData(prev => ({
                                  ...prev,
                                  config: {
                                    ...prev.config,
                                    rapport2_par_langue: { ...(prev.config.rapport2_par_langue || {}), [lang]: { ...(prev.config.rapport2_par_langue?.[lang] || {}), [f.key]: v } },
                                  },
                                }));
                              }}
                              className="text-xs"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* 4. Informations */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                {sectionTitle(4, L("معلومات التقرير", "Informations", "Information"))}
                <dl className="space-y-1.5 text-xs">
                  {infoRows.map(r => (
                    <div key={r.label} className="flex items-start justify-between gap-3">
                      <dt className="shrink-0 text-slate-500">{r.label}</dt>
                      <dd className={`text-end font-medium break-words min-w-0 ${r.value ? "text-slate-900 dark:text-slate-100" : "text-amber-600"}`}>
                        {r.value || L("غير محدد", "À compléter", "Missing")}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditConfigDraft({ ...appData.config });
                      setIsQuickEditConfigOpen(true);
                    }}
                    className="gap-1.5 text-xs"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    {L("تعديل", "Modifier", "Edit")}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => guardLeave(() => setCurrentTab("config"))} className="gap-1.5 text-xs">
                    <SettingsIcon className="w-3.5 h-3.5" />
                    {L("كل الإعدادات", "Tous les paramètres", "All settings")}
                  </Button>
                </div>
              </div>
            </aside>

            {/* ---------------- Aperçu A4 ---------------- */}
            <section className="min-w-0 space-y-2">
              <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 shadow-sm no-print print:hidden">
                <div className="flex items-center gap-2 min-w-0">
                  <Eye className="w-4 h-4 shrink-0 text-indigo-600" />
                  <span className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {L("معاينة (A4)", "Aperçu (A4)", "Preview (A4)")} — {L("النموذج", "Modèle", "Template")} {reportTemplate.slice(1)}
                  </span>
                </div>
                <div className="inline-flex shrink-0 rounded-md bg-slate-100 dark:bg-slate-800 p-0.5">
                  {([
                    { v: true, label: L("ملاءمة", "Ajuster", "Fit") },
                    { v: false, label: "100%" },
                  ]).map(o => (
                    <button
                      key={String(o.v)}
                      type="button"
                      onClick={() => setPreviewFit(o.v)}
                      className={`rounded px-2.5 py-1 text-[11px] font-semibold ${previewFit === o.v ? "bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white" : "text-slate-500"}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {classesForReport.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-sm text-slate-500">
                  {L("أضف قسماً أو اختر الأقسام لعرض التقرير.", "Ajoutez ou sélectionnez des classes pour afficher le rapport.", "Add or select classes to display the report.")}
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                  <ReportScaler fit={previewFit} disabled={isExportingPdf}>
                    {reportTemplate === "t3" ? (
                      <DiagnosticReportTemplate3 config={appData.config} classes={classesForReport} lang={lang} includeGraphs={includeGraphsInReport} />
                    ) : reportTemplate === "t4" ? (
                      <DiagnosticReportTemplate4 config={appData.config} classes={classesForReport} lang={lang} includeGraphs={includeGraphsInReport} />
                    ) : reportTemplate === "t2" ? (
                      <DiagnosticReportTemplate2
                        config={appData.config}
                        classes={classesForReport}
                        lang={lang}
                        includeGraphs={includeGraphsInReport}
                      />
                    ) : (
                      <DiagnosticReportPrint
                        config={appData.config}
                        stats={reportStats}
                        lang={lang}
                        includeGraphs={includeGraphsInReport}
                        selectedClassesNames={reportClassesNames}
                        chartBackground={chartBgTheme}
                        classes={classesForReport}
                      />
                    )}
                  </ReportScaler>
                </div>
              )}

              {/* Actions répétées sous l'aperçu (pratique sur téléphone) */}
              <div className="lg:hidden no-print print:hidden pt-1">{actionButtons}</div>
            </section>
          </div>
        );
      })()}

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
                ? `هل أنت متأكد من رغبتك في حذف "${classToDelete?.nom}"؟ لا يمكن التراجع عن هذا الإجراء.`
                : lang === "fr"
                ? `Êtes-vous sûr de vouloir supprimer "${classToDelete?.nom}" ? Cette action est irréversible.`
                : `Are you sure you want to delete "${classToDelete?.nom}"? This action cannot be undone.`}
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
                toast.success(tx("Paramètres par défaut rétablis", "تمت استعادة الإعدادات الافتراضية", "Default settings restored"));
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
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-indigo-700 dark:text-indigo-400">
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
                  <Label className="text-xs font-semibold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
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


              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsQuickEditConfigOpen(false)}>
              {tx("Annuler", "إلغاء", "Cancel")}
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
                  toast.success(tx(
                    "Modifications enregistrées et rapport actualisé avec succès",
                    "تم حفظ التعديلات وتحديث التقرير بنجاح",
                    "Changes saved and report updated"
                  ));
                }
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs"
            >
              {tx("Enregistrer et actualiser le rapport", "حفظ وتحديث التقرير", "Save and update the report")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notes non enregistrées : confirmation avant de quitter la saisie */}
      <Dialog open={!!pendingLeave} onOpenChange={(o) => { if (!o) setPendingLeave(null); }}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {tx("Notes non enregistrées", "نقط غير محفوظة", "Unsaved grades")}
            </DialogTitle>
            <DialogDescription>
              {tx(
                "Vous avez modifié des notes sans les enregistrer. Que voulez-vous faire ?",
                "لقد عدلت نقطاً دون حفظها. ماذا تريد أن تفعل؟",
                "You changed grades without saving them. What do you want to do?"
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPendingLeave(null)}>
              {tx("Rester", "البقاء", "Stay")}
            </Button>
            <Button
              variant="outline"
              className="text-rose-600"
              onClick={() => {
                const action = pendingLeave;
                setPendingLeave(null);
                // On abandonne les modifications : retour aux notes enregistrées
                if (currentClass) {
                  const initial: Record<string, string> = {};
                  currentClass.students.forEach(st => { initial[String(st.id)] = st.note !== null && st.note !== undefined ? String(st.note) : ""; });
                  setNotesDraft(initial);
                }
                action?.();
              }}
            >
              {tx("Quitter sans enregistrer", "الخروج دون حفظ", "Leave without saving")}
            </Button>
            <Button
              disabled={savingNotes}
              onClick={async () => {
                const action = pendingLeave;
                const ok = await handleSaveNotes();
                setPendingLeave(null);
                if (ok) action?.();
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {savingNotes && <Loader2 className="h-4 w-4 animate-spin" />}
              {tx("Enregistrer", "حفظ", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DiagnosticEvaluation;
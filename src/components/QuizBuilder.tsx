import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Save, Edit2, Settings, HelpCircle, CheckCircle2, ListOrdered, Sparkles, X, Check, Timer, AlertTriangle } from "lucide-react";
import { useCourses, QuizQuestion, QuizOption, serializeQuestionText, parseQuestionText, serializeExamDescription, parseExamAvailability, QuizSettings as QuizSettingsType, DEFAULT_QUIZ_SETTINGS } from "@/contexts/CourseContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import QuizSettings from "@/components/QuizSettings";
import { usePreferences } from "@/contexts/PreferencesContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RichTextEditor from "@/components/RichTextEditor";


interface QuizBuilderProps {
  examId: string;
  isOpen?: boolean;
  onClose: () => void;
}

const QuizBuilder: React.FC<QuizBuilderProps> = ({ examId, isOpen = true, onClose }) => {
  const { language } = useLanguage();
  const { prefs } = usePreferences();
  const { refreshData } = useCourses();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [options, setOptions] = useState<QuizOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<QuizQuestion | null>(null);

  // Sequential mode & per-question timing
  const [isSequentialMode, setIsSequentialMode] = useState(false);
  const [examData, setExamData] = useState<any>(null);

  const [currentQuestion, setCurrentQuestion] = useState<{
    question: string;
    question_type: 'multiple_choice' | 'true_false' | 'short_answer';
    points: number;
    question_order: number;
    timeMins: number;
    timeSecs: number;
  }>({
    question: "",
    question_type: "multiple_choice",
    points: 1,
    question_order: 1,
    timeMins: 0,
    timeSecs: 0,
  });

  const [currentOptions, setCurrentOptions] = useState([
    { option_text: "", is_correct: false, option_order: 1 },
    { option_text: "", is_correct: false, option_order: 2 },
    { option_text: "", is_correct: false, option_order: 3 },
    { option_text: "", is_correct: false, option_order: 4 }
  ]);

  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [quizSettings, setQuizSettings] = useState<QuizSettingsType>(DEFAULT_QUIZ_SETTINGS);

  const emptyMcqOptions = () => [
    { option_text: "", is_correct: false, option_order: 1 },
    { option_text: "", is_correct: false, option_order: 2 },
    { option_text: "", is_correct: false, option_order: 3 },
    { option_text: "", is_correct: false, option_order: 4 }
  ];
  const emptyTfOptions = () => [
    { option_text: "True", is_correct: false, option_order: 1 },
    { option_text: "False", is_correct: false, option_order: 2 }
  ];

  // Changer de type réinitialise des options cohérentes (avant : options QCM vides
  // conservées pour un Vrai/Faux → question V/F sans bonne réponse enregistrée)
  const handleTypeChange = (val: 'multiple_choice' | 'true_false' | 'short_answer') => {
    setCurrentQuestion(prev => ({ ...prev, question_type: val }));
    if (val === 'true_false') setCurrentOptions(emptyTfOptions());
    else if (val === 'multiple_choice') setCurrentOptions(emptyMcqOptions());
    else setCurrentOptions([]);
  };

  /** Vérifie la question en cours. Retourne false (avec message) si elle est incomplète. */
  const validateCurrentQuestion = (): boolean => {
    const plain = currentQuestion.question.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
    const hasImage = /<img\b/i.test(currentQuestion.question);
    if (!plain && !hasImage) {
      toast.error(
        language === "ar" ? "يرجى كتابة نص السؤال"
        : language === "fr" ? "Veuillez saisir le texte de la question"
        : "Please enter a question"
      );
      return false;
    }
    if (!currentQuestion.points || currentQuestion.points < 1) {
      toast.error(language === "fr" ? "Le barème doit être d'au moins 1 point" : language === "ar" ? "يجب أن تكون النقطة 1 على الأقل" : "Points must be at least 1");
      return false;
    }
    if (currentQuestion.question_type === 'multiple_choice') {
      const validOptions = currentOptions.filter(opt => opt.option_text.trim());
      if (validOptions.length < 2) {
        toast.error(
          language === "ar" ? "يرجى إضافة خيارين على الأقل"
          : language === "fr" ? "Veuillez ajouter au moins 2 options"
          : "Please add at least 2 options"
        );
        return false;
      }
      if (!validOptions.some(opt => opt.is_correct)) {
        toast.error(
          language === "ar" ? "يرجى تحديد إجابة صحيحة واحدة على الأقل"
          : language === "fr" ? "Veuillez cocher au moins une réponse correcte"
          : "Please mark at least one correct answer"
        );
        return false;
      }
      if (currentOptions.some(opt => opt.is_correct && !opt.option_text.trim())) {
        toast.error(
          language === "ar" ? "خيار محدد كصحيح لكنه فارغ"
          : language === "fr" ? "Une option cochée comme correcte est vide"
          : "An option marked as correct is empty"
        );
        return false;
      }
    }
    if (currentQuestion.question_type === 'true_false' && !currentOptions.some(opt => opt.is_correct)) {
      toast.error(
        language === "ar" ? "يرجى اختيار الإجابة الصحيحة (صحيح أو خطأ)"
        : language === "fr" ? "Veuillez choisir la bonne réponse (Vrai ou Faux)"
        : "Please choose the correct answer (True or False)"
      );
      return false;
    }
    return true;
  };

  /** Options à enregistrer pour la question en cours */
  const buildOptionsPayload = (questionId: string) => {
    if (currentQuestion.question_type === 'short_answer') return [];
    return currentOptions
      .filter(opt => opt.option_text.trim())
      .map((opt, idx) => ({
        question_id: questionId,
        option_text: opt.option_text.trim(),
        is_correct: opt.is_correct,
        option_order: idx + 1
      }));
  };

  useEffect(() => {
    if (examId) {
      loadQuestions();
      loadExamData();
    }
  }, [examId]);

  const loadExamData = async () => {
    const { data } = await supabase.from('exams').select('*').eq('id', examId).maybeSingle();
    if (data) {
      const parsed = parseExamAvailability(data) as any;
      setExamData(parsed);
      // Quiz jamais configuré : on part des paramètres par défaut de l'enseignant
      const hasSaved = /<!--QUIZ_SETTINGS:/.test(data.description || "");
      const loadedSettings = hasSaved ? (parsed.quiz_settings || DEFAULT_QUIZ_SETTINGS) : { ...DEFAULT_QUIZ_SETTINGS, ...prefs.quizDefaults };
      setQuizSettings(loadedSettings);
      setIsSequentialMode(loadedSettings.sequentialQuestions || parsed.quiz_mode === 'sequential_timed');
    }
  };

  const handleSequentialToggle = (checked: boolean) => {
    setIsSequentialMode(checked);
    setQuizSettings(prev => ({
      ...prev,
      sequentialQuestions: checked
    }));
  };

  const handleSettingsChange = (newSettings: QuizSettingsType) => {
    setQuizSettings(newSettings);
    if (newSettings.sequentialQuestions !== isSequentialMode) {
      setIsSequentialMode(newSettings.sequentialQuestions);
    }
  };

  const loadQuestions = async () => {
    setLoading(true);
    try {
      const { data: qData, error: qErr } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('exam_id', examId)
        .order('question_order', { ascending: true });

      if (qErr) throw qErr;

      const qList = (qData || []) as QuizQuestion[];
      setQuestions(qList);

      if (qList.length > 0) {
        const qIds = qList.map(q => q.id);
        const { data: oData, error: oErr } = await supabase
          .from('quiz_options')
          .select('*')
          .in('question_id', qIds)
          .order('option_order', { ascending: true });

        if (oErr) throw oErr;
        setOptions((oData || []) as QuizOption[]);
      } else {
        setOptions([]);
      }
    } catch (error) {
      console.error('Error loading quiz questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCurrentQuestion({
      question: "",
      question_type: "multiple_choice",
      points: 1,
      question_order: questions.length + 1,
      timeMins: 0,
      timeSecs: 0,
    });
    setCurrentOptions(emptyMcqOptions());
    setEditingQuestionId(null);
  };

  const handleAddQuestion = async (): Promise<boolean> => {
    if (!validateCurrentQuestion()) return false;

    setSaving(true);
    try {
      const timeLimitSeconds = currentQuestion.timeMins * 60 + currentQuestion.timeSecs;
      const serializedQuestion = serializeQuestionText(currentQuestion.question, timeLimitSeconds > 0 ? timeLimitSeconds : null);
      // Ordre = max + 1 (après une suppression, questions.length + 1 pouvait créer des doublons)
      const nextOrder = questions.reduce((m, q) => Math.max(m, q.question_order || 0), 0) + 1;

      const { data: newQuestion, error: qError } = await supabase
        .from('quiz_questions')
        .insert([{
          exam_id: examId,
          question: serializedQuestion,
          question_type: currentQuestion.question_type,
          points: currentQuestion.points,
          question_order: nextOrder
        }])
        .select()
        .single();

      if (qError || !newQuestion) throw qError;

      const optionsPayload = buildOptionsPayload(newQuestion.id);
      if (optionsPayload.length > 0) {
        const { error: optError } = await supabase.from('quiz_options').insert(optionsPayload);
        if (optError) throw optError;
      }

      await loadQuestions();
      await refreshData();
      resetForm();
      toast.success(
        language === "ar" ? "تمت إضافة السؤال بنجاح"
        : language === "fr" ? "Question ajoutée avec succès"
        : "Question added successfully"
      );
      return true;
    } catch (error) {
      console.error('Error adding question:', error);
      toast.error(
        language === "ar" ? "فشل حفظ السؤال"
        : language === "fr" ? "Échec de l'enregistrement de la question"
        : "Failed to add question"
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateQuestion = async (): Promise<boolean> => {
    if (!editingQuestionId) return false;
    if (!validateCurrentQuestion()) return false;

    setSaving(true);
    try {
      const timeLimitSeconds = currentQuestion.timeMins * 60 + currentQuestion.timeSecs;
      const serializedQuestion = serializeQuestionText(currentQuestion.question, timeLimitSeconds > 0 ? timeLimitSeconds : null);

      const { error: qError } = await supabase
        .from('quiz_questions')
        .update({
          question: serializedQuestion,
          question_type: currentQuestion.question_type,
          points: currentQuestion.points
        })
        .eq('id', editingQuestionId);

      if (qError) throw qError;

      // Options : on supprime toujours les anciennes (y compris si la question devient
      // « réponse directe »), puis on réinsère les nouvelles
      const { error: delError } = await supabase.from('quiz_options').delete().eq('question_id', editingQuestionId);
      if (delError) throw delError;

      const optionsPayload = buildOptionsPayload(editingQuestionId);
      if (optionsPayload.length > 0) {
        const { error: insError } = await supabase.from('quiz_options').insert(optionsPayload);
        if (insError) throw insError;
      }

      await loadQuestions();
      await refreshData();
      resetForm();
      toast.success(
        language === "ar" ? "تم تحديث السؤال بنجاح"
        : language === "fr" ? "Question mise à jour avec succès"
        : "Question updated successfully"
      );
      return true;
    } catch (error) {
      console.error('Error updating question:', error);
      toast.error(
        language === "ar" ? "فشل تحديث السؤال"
        : language === "fr" ? "Échec de la mise à jour"
        : "Failed to update question"
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleEditQuestion = (question: QuizQuestion) => {
    const { cleanText, timeLimitSeconds } = parseQuestionText(question.question);
    const timeMins = timeLimitSeconds ? Math.floor(timeLimitSeconds / 60) : 0;
    const timeSecs = timeLimitSeconds ? timeLimitSeconds % 60 : 0;

    setCurrentQuestion({
      question: cleanText,
      question_type: question.question_type,
      points: question.points,
      question_order: question.question_order,
      timeMins,
      timeSecs,
    });

    const questionOptions = getQuestionOptions(question.id);
    if (question.question_type === 'multiple_choice') {
      const editOptions = [...Array(Math.max(4, questionOptions.length))].map((_, index) => {
        const existingOption = questionOptions[index];
        return existingOption 
          ? { option_text: existingOption.option_text, is_correct: existingOption.is_correct, option_order: index + 1 }
          : { option_text: "", is_correct: false, option_order: index + 1 };
      });
      setCurrentOptions(editOptions);
    } else if (question.question_type === 'true_false') {
      setCurrentOptions([
        { option_text: "True", is_correct: questionOptions.find(opt => /^(true|vrai)$/i.test(opt.option_text.trim()))?.is_correct || false, option_order: 1 },
        { option_text: "False", is_correct: questionOptions.find(opt => /^(false|faux)$/i.test(opt.option_text.trim()))?.is_correct || false, option_order: 2 }
      ]);
    } else {
      setCurrentOptions([]);
    }

    setEditingQuestionId(question.id);
  };

  const handleDeleteQuestion = async (questionId: string) => {
    try {
      await supabase.from('quiz_options').delete().eq('question_id', questionId);
      const { error } = await supabase.from('quiz_questions').delete().eq('id', questionId);
      if (error) throw error;

      await loadQuestions();
      await refreshData();
      if (editingQuestionId === questionId) {
        resetForm();
      }
      toast.success(
        language === "ar" ? "تم حذف السؤال"
        : language === "fr" ? "Question supprimée"
        : "Question deleted"
      );
    } catch (error) {
      console.error('Error deleting question:', error);
      toast.error("Failed to delete question");
    }
  };

  const getQuestionOptions = (questionId: string) => {
    return options.filter(opt => opt.question_id === questionId).sort((a, b) => a.option_order - b.option_order);
  };

  const totalPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0);

  // Compute total question time for sequential mode
  const totalQuestionSeconds = questions.reduce((sum, q) => {
    const { timeLimitSeconds } = parseQuestionText(q.question);
    return sum + (timeLimitSeconds || 0);
  }, 0);
  const totalQuestionMins = Math.floor(totalQuestionSeconds / 60);
  const totalQuestionSecs = totalQuestionSeconds % 60;
  const previewTimeSecs = currentQuestion.timeMins * 60 + currentQuestion.timeSecs;

  const handleSaveAllAndClose = async () => {
    // Enregistre la question en cours si elle a été commencée ; en cas d'erreur
    // on NE ferme PAS la fenêtre (avant : la question était perdue silencieusement)
    const hasDraft = currentQuestion.question.replace(/<[^>]*>/g, "").trim() || /<img\b/i.test(currentQuestion.question);
    if (hasDraft) {
      const ok = editingQuestionId ? await handleUpdateQuestion() : await handleAddQuestion();
      if (!ok) return;
    }

    // Enregistre le mode séquentiel et TOUS les paramètres du quiz dans la description de l'examen
    if (examData) {
      const finalSettings: QuizSettingsType = {
        ...quizSettings,
        sequentialQuestions: isSequentialMode
      };
      const newMode = isSequentialMode ? 'sequential_timed' : 'free';
      const newDesc = serializeExamDescription(
        examData.description || '',
        examData.available_until || null,
        newMode,
        finalSettings
      );
      const { error } = await supabase.from('exams').update({ description: newDesc }).eq('id', examId);
      if (error) {
        console.error("Error updating exam description/settings:", error);
        toast.error(
          language === "ar" ? "فشل حفظ إعدادات الاختبار"
          : language === "fr" ? "Échec de l'enregistrement des paramètres du quiz"
          : "Failed to save quiz settings"
        );
        return;
      }
      await refreshData();
    }

    toast.success(
      language === "ar" ? "تم حفظ جميع التغييرات بنجاح"
      : language === "fr" ? "Modifications sauvegardées avec succès"
      : "Modifications saved successfully"
    );
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[92vh] w-[95vw] overflow-hidden flex flex-col p-0 gap-0 border rounded-2xl shadow-2xl bg-card">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                {language === "ar" ? "محرر أسئلة الاختبار" : language === "fr" ? "Créateur de Quiz" : "Quiz Builder"}
                <Badge variant="outline" className="text-xs font-semibold">
                  {questions.length} {language === "ar" ? "سؤال" : language === "fr" ? "questions" : "questions"}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {language === "ar"
                  ? "إنشاء الأسئلة وخيارات الإجابة وضبط الإعدادات"
                  : language === "fr"
                  ? "Créer des questions, options de réponse et configurer le quiz"
                  : "Create questions, answer options and configure quiz settings"}
              </DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Sequential mode toggle */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${isSequentialMode ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-400' : 'bg-muted/30 border-muted text-muted-foreground'}`}>
              <Timer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{language === "fr" ? "Séquentiel minuté" : language === "ar" ? "ترتيب موقوت" : "Sequential timed"}</span>
              <Switch
                checked={isSequentialMode}
                onCheckedChange={handleSequentialToggle}
                className="scale-75"
              />
            </div>
            <Badge variant="secondary" className="px-3 py-1.5 text-xs font-bold text-primary bg-primary/10">
              {language === "ar" ? `المجموع: ${totalPoints} نقطة` : language === "fr" ? `Total : ${totalPoints} pts` : `Total: ${totalPoints} pts`}
            </Badge>
          </div>
        </div>

        {/* Body with Tabs */}
        <div className="flex-1 overflow-hidden flex flex-col p-4 sm:p-5">
          <Tabs defaultValue="questions" className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b mb-3">
              <TabsList className="grid grid-cols-2 w-72">
                <TabsTrigger value="questions" className="text-xs font-semibold flex items-center gap-1.5">
                  <ListOrdered className="h-3.5 w-3.5" />
                  {language === "ar" ? "الأسئلة" : language === "fr" ? "Questions" : "Questions"}
                </TabsTrigger>
                <TabsTrigger value="settings" className="text-xs font-semibold flex items-center gap-1.5">
                  <Settings className="h-3.5 w-3.5" />
                  {language === "ar" ? "الإعدادات" : language === "fr" ? "Paramètres" : "Settings"}
                </TabsTrigger>
              </TabsList>

              <Button
                variant="outline"
                size="sm"
                onClick={resetForm}
                className="text-xs gap-1.5 font-medium border-primary/30 text-primary hover:bg-primary/10"
              >
                <Plus className="h-3.5 w-3.5" />
                {language === "ar" ? "سؤال جديد" : language === "fr" ? "Nouvelle question" : "New Question"}
              </Button>
            </div>

            {/* Questions Tab: 2-Column Split View */}
            <TabsContent value="questions" className="flex-1 overflow-hidden m-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Column: Questions List */}
              <div className="lg:col-span-5 flex flex-col overflow-hidden border rounded-xl bg-muted/10">
                <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ListOrdered className="h-4 w-4 text-primary" />
                    {language === "ar" ? "لائحة الأسئلة" : language === "fr" ? "Liste des questions" : "Questions List"} ({questions.length})
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                  {loading ? (
                    <div className="text-center py-10 text-muted-foreground text-xs">
                      {language === "ar" ? "جاري تحميل الأسئلة..." : language === "fr" ? "Chargement des questions..." : "Loading questions..."}
                    </div>
                  ) : questions.length === 0 ? (
                    <div className="text-center py-12 px-4 border border-dashed rounded-xl bg-card">
                      <HelpCircle className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
                      <p className="font-semibold text-sm">
                        {language === "ar" ? "لا توجد أسئلة بعد" : language === "fr" ? "Aucune question ajoutée" : "No questions added yet"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {language === "ar"
                          ? "استخدم النموذج على اليمين لإضافة سؤالك الأول"
                          : language === "fr"
                          ? "Utilisez le formulaire pour ajouter votre première question"
                          : "Use the form to add your first question"}
                      </p>
                    </div>
                  ) : (
                    questions.map((q, idx) => {
                      const qOpts = getQuestionOptions(q.id);
                      const isSelected = editingQuestionId === q.id;
                      const { cleanText: qCleanText, timeLimitSeconds: qTimeSec } = parseQuestionText(q.question);

                      return (
                        <Card
                          key={q.id}
                          className={`p-3 transition-all cursor-pointer border ${
                            isSelected
                              ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30"
                              : "hover:border-muted-foreground/40 hover:bg-card"
                          }`}
                          onClick={() => handleEditQuestion(q)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                                <Badge variant="outline" className="text-[10px] font-bold py-0 h-4 border-primary/40 text-primary">
                                  Q{idx + 1}
                                </Badge>
                                <Badge variant="secondary" className="text-[10px] py-0 h-4 font-semibold">
                                  {q.question_type === 'multiple_choice'
                                    ? 'QCM'
                                    : q.question_type === 'true_false'
                                    ? (language === 'ar' ? 'ص/خ' : 'V/F')
                                    : (language === 'ar' ? 'مباشرة' : 'Directe')}
                                </Badge>
                                <span className="text-[10px] font-semibold text-muted-foreground">
                                  {q.points} {language === "ar" ? "نقطة" : q.points > 1 ? "pts" : "pt"}
                                </span>
                                {qTimeSec && qTimeSec > 0 && (
                                  <span className="text-[10px] font-semibold text-amber-600 flex items-center gap-0.5">
                                    <Timer className="h-2.5 w-2.5" />
                                    {Math.floor(qTimeSec / 60) > 0 && `${Math.floor(qTimeSec / 60)}m`}{qTimeSec % 60 > 0 && `${qTimeSec % 60}s`}
                                  </span>
                                )}
                              </div>

                              <div 
                                className="text-xs font-semibold text-foreground mb-1.5 prose prose-xs max-w-none dark:prose-invert line-clamp-3 [&_p]:m-0 [&_img]:max-h-20 [&_img]:rounded [&_img]:inline-block" 
                                dangerouslySetInnerHTML={{ __html: qCleanText }}
                              />


                              {/* Options preview for QCM */}
                              {q.question_type === 'multiple_choice' && qOpts.length > 0 && (
                                <div className="mt-2 space-y-1 pl-1 bg-muted/20 p-2 rounded-lg border border-muted/30">
                                  {qOpts.map((opt, oIdx) => (
                                    <div key={opt.id} className="text-[11px] flex items-center gap-1.5">
                                      <span className={`w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold shrink-0 ${
                                        opt.is_correct ? 'bg-emerald-600 text-white font-black' : 'bg-muted text-muted-foreground'
                                      }`}>
                                        {String.fromCharCode(65 + oIdx)}
                                      </span>
                                      <span className={`truncate flex-1 ${opt.is_correct ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-muted-foreground'}`}>
                                        {opt.option_text}
                                      </span>
                                      {opt.is_correct && <Check className="w-3 h-3 text-emerald-600 shrink-0 ml-auto" />}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* True/False preview */}
                              {q.question_type === 'true_false' && (
                                <div className="mt-1.5 text-[11px] text-muted-foreground flex items-center gap-2">
                                  {qOpts.find(o => o.is_correct)?.option_text && (
                                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      {/^(true|vrai)$/i.test(qOpts.find(o => o.is_correct)?.option_text || '') 
                                        ? (language === 'ar' ? 'صحيح' : 'Vrai') 
                                        : (language === 'ar' ? 'خطأ' : 'Faux')}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                onClick={() => handleEditQuestion(q)}
                                title={language === "ar" ? "تعديل" : language === "fr" ? "Modifier" : "Edit"}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                onClick={() => setQuestionToDelete(q)}
                                title={language === "ar" ? "حذف" : language === "fr" ? "Supprimer" : "Delete"}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Question Editor Form */}
              <div className="lg:col-span-7 flex flex-col overflow-y-auto border rounded-xl p-4 bg-card shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    {editingQuestionId ? (
                      <>
                        <Edit2 className="h-4 w-4 text-primary" />
                        <span>{language === "ar" ? "تعديل السؤال" : language === "fr" ? "Modifier la question" : "Edit Question"}</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 text-primary" />
                        <span>{language === "ar" ? "إضافة سؤال جديد" : language === "fr" ? "Ajouter une question" : "Add New Question"}</span>
                      </>
                    )}
                  </h3>
                  {editingQuestionId && (
                    <Button variant="ghost" size="sm" onClick={resetForm} className="h-7 text-xs text-muted-foreground">
                      <X className="h-3.5 w-3.5 mr-1" />
                      {language === "ar" ? "إلغاء التعديل" : language === "fr" ? "Annuler" : "Cancel"}
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      {language === "ar" ? "نوع السؤال" : language === "fr" ? "Type de question" : "Question Type"}
                    </Label>
                    <Select
                      value={currentQuestion.question_type}
                      onValueChange={(val: any) => handleTypeChange(val)}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="multiple_choice" className="text-xs">
                          {language === "ar" ? "اختيار من متعدد (QCM)" : language === "fr" ? "Choix multiple (QCM)" : "Multiple Choice (QCM)"}
                        </SelectItem>
                        <SelectItem value="true_false" className="text-xs">
                          {language === "ar" ? "صحيح / خطأ (V/F)" : language === "fr" ? "Vrai / Faux (V/F)" : "True / False (V/F)"}
                        </SelectItem>
                        <SelectItem value="short_answer" className="text-xs">
                          {language === "ar" ? "إجابة مباشرة" : language === "fr" ? "Réponse directe" : "Short Answer"}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      {language === "ar" ? "النقاط" : language === "fr" ? "Points" : "Points"}
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      value={currentQuestion.points}
                      onChange={(e) => setCurrentQuestion(prev => ({ ...prev, points: parseInt(e.target.value) || 1 }))}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                {/* Per-question timing (shown only in sequential mode) */}
                {isSequentialMode && (
                  <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800 space-y-2">
                    <div className="flex items-center gap-2">
                      <Timer className="h-3.5 w-3.5 text-amber-600" />
                      <Label className="text-xs font-bold text-amber-700 dark:text-amber-400">
                        {language === "fr" ? "Durée pour cette question" : language === "ar" ? "مدة هذا السؤال" : "Time for this question"}
                      </Label>
                      {previewTimeSecs > 0 && (
                        <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 dark:text-amber-400 ml-auto">
                          {currentQuestion.timeMins > 0 && `${currentQuestion.timeMins}min `}{currentQuestion.timeSecs > 0 && `${currentQuestion.timeSecs}s`}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 flex-1">
                        <Input
                          type="number" min="0" max="59"
                          value={currentQuestion.timeMins}
                          onChange={(e) => setCurrentQuestion(prev => ({ ...prev, timeMins: Math.max(0, parseInt(e.target.value) || 0) }))}
                          className="h-8 text-xs w-16 text-center"
                        />
                        <span className="text-xs text-muted-foreground font-medium">{language === "fr" ? "min" : language === "ar" ? "دقيقة" : "min"}</span>
                        <Input
                          type="number" min="0" max="59"
                          value={currentQuestion.timeSecs}
                          onChange={(e) => setCurrentQuestion(prev => ({ ...prev, timeSecs: Math.max(0, Math.min(59, parseInt(e.target.value) || 0)) }))}
                          className="h-8 text-xs w-16 text-center"
                        />
                        <span className="text-xs text-muted-foreground font-medium">{language === "fr" ? "sec" : language === "ar" ? "ث" : "sec"}</span>
                      </div>
                      {/* Quick presets */}
                      <div className="flex gap-1 flex-wrap">
                        {[{l:'30s',m:0,s:30},{l:'1m',m:1,s:0},{l:'2m',m:2,s:0},{l:'3m',m:3,s:0},{l:'5m',m:5,s:0}].map(p => (
                          <Button key={p.l} type="button" size="sm" variant="outline"
                            className={`h-6 px-2 text-[10px] font-bold ${currentQuestion.timeMins === p.m && currentQuestion.timeSecs === p.s ? 'bg-amber-200 border-amber-400 text-amber-800' : 'hover:bg-amber-100 dark:hover:bg-amber-950'}`}
                            onClick={() => setCurrentQuestion(prev => ({ ...prev, timeMins: p.m, timeSecs: p.s }))}
                          >{p.l}</Button>
                        ))}
                        <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-muted-foreground"
                          onClick={() => setCurrentQuestion(prev => ({ ...prev, timeMins: 0, timeSecs: 0 }))}
                        ><X className="h-3 w-3"/></Button>
                      </div>
                    </div>
                    {totalQuestionSeconds > 0 && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">
                        {language === "fr"
                          ? `⏱ Total questions : ${totalQuestionMins}min ${totalQuestionSecs}s`
                          : language === "ar"
                          ? `⏱ إجمالي الأسئلة: ${totalQuestionMins} دقيقة ${totalQuestionSecs} ث`
                          : `⏱ Total questions time: ${totalQuestionMins}min ${totalQuestionSecs}s`}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    {language === "ar" ? "نص السؤال (يدعم التنسيق الغني والصور) *" : language === "fr" ? "Texte de la question (texte enrichi, gras, souligné, images...) *" : "Question Text (rich text, bold, underline, images...) *"}
                  </Label>
                  <RichTextEditor
                    content={currentQuestion.question}
                    onChange={(val) => setCurrentQuestion(prev => ({ ...prev, question: val }))}
                    placeholder={
                      language === "ar" ? "أدخل نص السؤال هنا مع الصور والتنسيقات..."
                      : language === "fr" ? "Entrez le texte de la question ici avec images et mise en page..."
                      : "Enter question text here with images and rich formatting..."
                    }
                  />
                </div>

                {/* Multiple Choice Options */}
                {currentQuestion.question_type === 'multiple_choice' && (
                  <div className="space-y-2.5 pt-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">
                        {language === "ar" 
                          ? "خيارات الإجابة (حدد الإجابة الصحيحة)" 
                          : language === "fr" 
                          ? "Options de réponse (cochez la ou les bonnes réponses)" 
                          : "Answer Options (check the correct answer(s))"}
                      </Label>
                    </div>

                    <div className="space-y-2">
                      {currentOptions.map((opt, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                            opt.is_correct ? 'bg-emerald-50/70 border-emerald-300 dark:bg-emerald-950/20' : 'bg-muted/10 border-muted'
                          }`}
                        >
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            opt.is_correct ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'
                          }`}>
                            {String.fromCharCode(65 + idx)}
                          </span>

                          <Input
                            placeholder={`${language === "ar" ? "الخيار" : "Option"} ${String.fromCharCode(65 + idx)}`}
                            value={opt.option_text}
                            onChange={(e) => {
                              const next = [...currentOptions];
                              next[idx] = { ...opt, option_text: e.target.value };
                              setCurrentOptions(next);
                            }}
                            className="h-8 text-xs flex-1 bg-background"
                          />

                          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold select-none pr-1">
                            <input
                              type="checkbox"
                              checked={opt.is_correct}
                              onChange={(e) => {
                                const next = [...currentOptions];
                                next[idx] = { ...opt, is_correct: e.target.checked };
                                setCurrentOptions(next);
                              }}
                              className="rounded border-muted text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                            />
                            <span className={opt.is_correct ? "text-emerald-700 font-bold text-[11px]" : "text-muted-foreground text-[11px]"}>
                              {language === "ar" ? "صحيحة" : language === "fr" ? "Correcte" : "Correct"}
                            </span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* True / False Options */}
                {currentQuestion.question_type === 'true_false' && (
                  <div className="space-y-2 pt-1">
                    <Label className="text-xs font-semibold">
                      {language === "ar" ? "حدد الإجابة الصحيحة" : language === "fr" ? "Sélectionnez la bonne réponse" : "Select the Correct Answer"}
                    </Label>
                    <RadioGroup
                      value={currentOptions.find(opt => opt.is_correct)?.option_text || ""}
                      onValueChange={(val) => {
                        setCurrentOptions([
                          { option_text: "True", is_correct: val === "True", option_order: 1 },
                          { option_text: "False", is_correct: val === "False", option_order: 2 }
                        ]);
                      }}
                      className="grid grid-cols-2 gap-3"
                    >
                      <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer bg-muted/10 hover:bg-muted/30">
                        <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          {language === "ar" ? "صحيح (True)" : language === "fr" ? "Vrai (True)" : "True"}
                        </span>
                        <RadioGroupItem value="True" />
                      </label>

                      <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer bg-muted/10 hover:bg-muted/30">
                        <span className="text-xs font-bold text-rose-700 flex items-center gap-1.5">
                          <X className="w-4 h-4 text-rose-600" />
                          {language === "ar" ? "خطأ (False)" : language === "fr" ? "Faux (False)" : "False"}
                        </span>
                        <RadioGroupItem value="False" />
                      </label>
                    </RadioGroup>
                  </div>
                )}

                {/* Action Buttons inside Question Editor */}
                <div className="flex items-center justify-between pt-3 border-t mt-auto">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={resetForm}
                    className="text-xs"
                  >
                    {language === "ar" ? "مسح النموذج" : language === "fr" ? "Effacer" : "Clear Form"}
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    disabled={saving}
                    onClick={() => { editingQuestionId ? handleUpdateQuestion() : handleAddQuestion(); }}
                    className="text-xs gap-1.5 bg-primary hover:bg-primary/90 font-semibold px-4"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {saving
                      ? (language === "ar" ? "جاري الحفظ..." : language === "fr" ? "Enregistrement..." : "Saving...")
                      : editingQuestionId
                      ? (language === "ar" ? "تحديث السؤال" : language === "fr" ? "Mettre à jour" : "Update Question")
                      : (language === "ar" ? "إضافة السؤال" : language === "fr" ? "Ajouter la question" : "Add Question")}
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="flex-1 overflow-y-auto m-0 p-1">
              <QuizSettings
                initialSettings={quizSettings}
                onSettingsChange={handleSettingsChange}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Dialog Bottom Footer Bar */}
        <div className="p-3 sm:p-4 border-t bg-muted/30 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="text-xs font-medium"
          >
            {language === "ar" ? "إلغاء التعديلات" : language === "fr" ? "Annuler les modifications" : "Cancel modifications"}
          </Button>

          <Button
            type="button"
            onClick={handleSaveAllAndClose}
            className="text-xs font-semibold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
          >
            <Save className="h-3.5 w-3.5" />
            {language === "ar" ? "حفظ التعديلات" : language === "fr" ? "Sauvegarder les modifications" : "Save modifications"}
          </Button>
        </div>
      </DialogContent>

      {/* Delete Question Confirmation Dialog */}
      <Dialog open={!!questionToDelete} onOpenChange={(open) => { if (!open) setQuestionToDelete(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "حذف السؤال" : language === "fr" ? "Supprimer la question" : "Delete Question"}
            </DialogTitle>
            <DialogDescription>
              {language === "ar" 
                ? "هل أنت متأكد من رغبتك في حذف هذا السؤال وجميع خياراته؟ لا يمكن التراجع عن هذا الإجراء." 
                : language === "fr" 
                ? "Êtes-vous sûr de vouloir supprimer cette question et toutes ses options ? Cette action est irréversible." 
                : "Are you sure you want to delete this question and all its options? This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setQuestionToDelete(null)}>
              {language === "ar" ? "إلغاء" : language === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button 
              variant="destructive" 
              onClick={async () => {
                if (questionToDelete) {
                  await handleDeleteQuestion(questionToDelete.id);
                  setQuestionToDelete(null);
                }
              }}
            >
              {language === "ar" ? "حذف السؤال" : language === "fr" ? "Supprimer la question" : "Delete Question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

export default QuizBuilder;

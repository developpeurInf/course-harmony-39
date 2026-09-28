import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Save, Edit2, Settings, HelpCircle, CheckCircle2, ListOrdered, Sparkles, X, Check } from "lucide-react";
import { useCourses, QuizQuestion, QuizOption } from "@/contexts/CourseContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import QuizSettings, { QuizSettings as QuizSettingsType } from "@/components/QuizSettings";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface QuizBuilderProps {
  examId: string;
  isOpen?: boolean;
  onClose: () => void;
}

const QuizBuilder: React.FC<QuizBuilderProps> = ({ examId, isOpen = true, onClose }) => {
  const { language } = useLanguage();
  const { refreshData } = useCourses();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [options, setOptions] = useState<QuizOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [currentQuestion, setCurrentQuestion] = useState<{
    question: string;
    question_type: 'multiple_choice' | 'true_false' | 'short_answer';
    points: number;
    question_order: number;
  }>({
    question: "",
    question_type: "multiple_choice",
    points: 1,
    question_order: 1
  });

  const [currentOptions, setCurrentOptions] = useState([
    { option_text: "", is_correct: false, option_order: 1 },
    { option_text: "", is_correct: false, option_order: 2 },
    { option_text: "", is_correct: false, option_order: 3 },
    { option_text: "", is_correct: false, option_order: 4 }
  ]);

  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [quizSettings, setQuizSettings] = useState<QuizSettingsType>({
    sequentialQuestions: false,
    allowMultipleAttempts: false,
    allowCorrections: true,
    shuffleQuestions: false,
    shuffleOptions: false,
    timeLimit: null,
    showResultsImmediately: true,
    allowReview: true,
  });

  useEffect(() => {
    if (examId) {
      loadQuestions();
    }
  }, [examId]);

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
      question_order: questions.length + 1
    });
    setCurrentOptions([
      { option_text: "", is_correct: false, option_order: 1 },
      { option_text: "", is_correct: false, option_order: 2 },
      { option_text: "", is_correct: false, option_order: 3 },
      { option_text: "", is_correct: false, option_order: 4 }
    ]);
    setEditingQuestionId(null);
  };

  const handleAddQuestion = async () => {
    if (!currentQuestion.question.trim()) {
      toast.error(
        language === "ar" ? "يرجى كتابة نص السؤال"
        : language === "fr" ? "Veuillez saisir le texte de la question"
        : "Please enter a question"
      );
      return;
    }

    if (currentQuestion.question_type === 'multiple_choice') {
      const validOptions = currentOptions.filter(opt => opt.option_text.trim());
      const correctOptions = validOptions.filter(opt => opt.is_correct);
      
      if (validOptions.length < 2) {
        toast.error(
          language === "ar" ? "يرجى إضافة خيارين على الأقل"
          : language === "fr" ? "Veuillez ajouter au moins 2 options"
          : "Please add at least 2 options"
        );
        return;
      }
      
      if (correctOptions.length === 0) {
        toast.error(
          language === "ar" ? "يرجى تحديد إجابة صحيحة واحدة على الأقل"
          : language === "fr" ? "Veuillez cocher au moins une réponse correcte"
          : "Please mark at least one correct answer"
        );
        return;
      }
    }

    setSaving(true);
    try {
      const { data: newQuestion, error: qError } = await supabase
        .from('quiz_questions')
        .insert([{
          exam_id: examId,
          question: currentQuestion.question,
          question_type: currentQuestion.question_type,
          points: currentQuestion.points,
          question_order: questions.length + 1
        }])
        .select()
        .single();

      if (qError || !newQuestion) throw qError;

      // Add options
      if (currentQuestion.question_type === 'multiple_choice') {
        const validOptions = currentOptions
          .filter(opt => opt.option_text.trim())
          .map((opt, idx) => ({
            question_id: newQuestion.id,
            option_text: opt.option_text.trim(),
            is_correct: opt.is_correct,
            option_order: idx + 1
          }));

        if (validOptions.length > 0) {
          const { error: optError } = await supabase
            .from('quiz_options')
            .insert(validOptions);
          if (optError) throw optError;
        }
      } else if (currentQuestion.question_type === 'true_false') {
        const tfOptions = currentOptions
          .filter(opt => opt.option_text)
          .map((opt, idx) => ({
            question_id: newQuestion.id,
            option_text: opt.option_text,
            is_correct: opt.is_correct,
            option_order: idx + 1
          }));

        if (tfOptions.length > 0) {
          const { error: optError } = await supabase
            .from('quiz_options')
            .insert(tfOptions);
          if (optError) throw optError;
        }
      }

      await loadQuestions();
      await refreshData();
      resetForm();
      toast.success(
        language === "ar" ? "تمت إضافة السؤال بنجاح"
        : language === "fr" ? "Question ajoutée avec succès"
        : "Question added successfully"
      );
    } catch (error) {
      console.error('Error adding question:', error);
      toast.error(
        language === "ar" ? "فشل حفظ السؤال"
        : language === "fr" ? "Échec de l'enregistrement de la question"
        : "Failed to add question"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateQuestion = async () => {
    if (!editingQuestionId || !currentQuestion.question.trim()) return;

    setSaving(true);
    try {
      const { error: qError } = await supabase
        .from('quiz_questions')
        .update({
          question: currentQuestion.question,
          question_type: currentQuestion.question_type,
          points: currentQuestion.points
        })
        .eq('id', editingQuestionId);

      if (qError) throw qError;

      // Update options: delete old, insert new
      if (currentQuestion.question_type === 'multiple_choice' || currentQuestion.question_type === 'true_false') {
        await supabase.from('quiz_options').delete().eq('question_id', editingQuestionId);

        const optionsToInsert = currentOptions
          .filter(opt => opt.option_text.trim())
          .map((opt, idx) => ({
            question_id: editingQuestionId,
            option_text: opt.option_text.trim(),
            is_correct: opt.is_correct,
            option_order: idx + 1
          }));

        if (optionsToInsert.length > 0) {
          await supabase.from('quiz_options').insert(optionsToInsert);
        }
      }

      await loadQuestions();
      await refreshData();
      resetForm();
      toast.success(
        language === "ar" ? "تم تحديث السؤال بنجاح"
        : language === "fr" ? "Question mise à jour avec succès"
        : "Question updated successfully"
      );
    } catch (error) {
      console.error('Error updating question:', error);
      toast.error(
        language === "ar" ? "فشل تحديث السؤال"
        : language === "fr" ? "Échec de la mise à jour"
        : "Failed to update question"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEditQuestion = (question: QuizQuestion) => {
    setCurrentQuestion({
      question: question.question,
      question_type: question.question_type,
      points: question.points,
      question_order: question.question_order
    });

    const questionOptions = getQuestionOptions(question.id);
    if (question.question_type === 'multiple_choice') {
      const editOptions = [...Array(4)].map((_, index) => {
        const existingOption = questionOptions[index];
        return existingOption 
          ? { option_text: existingOption.option_text, is_correct: existingOption.is_correct, option_order: index + 1 }
          : { option_text: "", is_correct: false, option_order: index + 1 };
      });
      setCurrentOptions(editOptions);
    } else if (question.question_type === 'true_false') {
      setCurrentOptions([
        { option_text: "True", is_correct: questionOptions.find(opt => opt.option_text === "True")?.is_correct || false, option_order: 1 },
        { option_text: "False", is_correct: questionOptions.find(opt => opt.option_text === "False")?.is_correct || false, option_order: 2 }
      ]);
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

  const handleSaveAllAndClose = async () => {
    // If there's an unsaved question in progress, inform or auto-save if filled
    if (currentQuestion.question.trim()) {
      if (editingQuestionId) {
        await handleUpdateQuestion();
      } else if (currentQuestion.question_type !== 'multiple_choice' || currentOptions.some(o => o.is_correct && o.option_text.trim())) {
        await handleAddQuestion();
      }
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
          <div className="flex items-center gap-2">
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
                              </div>

                              <p className="text-xs font-semibold text-foreground mb-1.5">
                                {q.question.replace(/<[^>]+>/g, '') || q.question}
                              </p>

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
                                      {qOpts.find(o => o.is_correct)?.option_text === 'True' 
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
                                onClick={() => handleDeleteQuestion(q.id)}
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
                      onValueChange={(val: any) => setCurrentQuestion(prev => ({ ...prev, question_type: val }))}
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

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    {language === "ar" ? "نص السؤال *" : language === "fr" ? "Texte de la question *" : "Question Text *"}
                  </Label>
                  <Input
                    placeholder={
                      language === "ar" ? "أدخل نص السؤال هنا..."
                      : language === "fr" ? "Entrez le texte de la question ici..."
                      : "Enter question text here..."
                    }
                    value={currentQuestion.question}
                    onChange={(e) => setCurrentQuestion(prev => ({ ...prev, question: e.target.value }))}
                    className="h-10 text-sm font-medium"
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
                          ? "Options de réponse (Cochez la bonne réponse)" 
                          : "Answer Options (Check the correct answer)"}
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
                    onClick={editingQuestionId ? handleUpdateQuestion : handleAddQuestion}
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
              <QuizSettings onSettingsChange={setQuizSettings} />
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
    </Dialog>
  );
};

export default QuizBuilder;

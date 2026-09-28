import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, CheckCircle, XCircle, Award, AlertCircle, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useCourses, QuizQuestion, QuizOption, Exam } from "@/contexts/CourseContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface QuizTakerProps {
  exam: Exam;
  onClose: () => void;
}

interface Answer {
  questionId: string;
  selectedOptionId?: string;
  textAnswer?: string;
}

const QuizTaker: React.FC<QuizTakerProps> = ({ exam, onClose }) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { submitQuiz } = useCourses();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [options, setOptions] = useState<QuizOption[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    loadQuizData();
  }, [exam.id]);

  useEffect(() => {
    if (isStarted && timeLeft > 0 && !isSubmitted) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isStarted, timeLeft, isSubmitted]);

  const loadQuizData = async () => {
    setLoading(true);
    try {
      // Check existing submission
      if (user?.id) {
        const { data: subData } = await supabase
          .from('quiz_submissions')
          .select('*')
          .eq('exam_id', exam.id)
          .eq('student_id', user.id)
          .maybeSingle();

        if (subData) {
          setIsSubmitted(true);
          setScore(subData.score);
          setTotalPoints(subData.total_points || 0);
          setLoading(false);
          return;
        }
      }

      // Fetch questions
      const { data: qData } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('exam_id', exam.id)
        .order('question_order', { ascending: true });

      const qList = (qData || []) as QuizQuestion[];
      setQuestions(qList);

      const total = qList.reduce((sum, q) => sum + (q.points || 1), 0);
      setTotalPoints(total);

      // Fetch options
      if (qList.length > 0) {
        const qIds = qList.map(q => q.id);
        const { data: oData } = await supabase
          .from('quiz_options')
          .select('*')
          .in('question_id', qIds)
          .order('option_order', { ascending: true });

        setOptions((oData || []) as QuizOption[]);
      }
    } catch (err) {
      console.error('Error loading quiz data:', err);
    } finally {
      setLoading(false);
    }
  };

  const startQuiz = () => {
    setIsStarted(true);
    setTimeLeft((exam.duration_minutes || 30) * 60);
    startTimeRef.current = Date.now();
  };

  const handleSelectOption = (questionId: string, optionId: string) => {
    setAnswers(prev => {
      const filtered = prev.filter(a => a.questionId !== questionId);
      return [...filtered, { questionId, selectedOptionId: optionId }];
    });
  };

  const handleTextAnswer = (questionId: string, text: string) => {
    setAnswers(prev => {
      const filtered = prev.filter(a => a.questionId !== questionId);
      return [...filtered, { questionId, textAnswer: text }];
    });
  };

  const getCurrentAnswer = (questionId: string) => {
    return answers.find(a => a.questionId === questionId);
  };

  const getQuestionOptions = (questionId: string) => {
    return options.filter(o => o.question_id === questionId).sort((a, b) => a.option_order - b.option_order);
  };

  const handleSubmit = async () => {
    if (!user) return;

    let earnedScore = 0;
    const answerRecords: any[] = [];

    questions.forEach(q => {
      const answer = getCurrentAnswer(q.id);
      const qOptions = getQuestionOptions(q.id);
      let isCorrect = false;

      if (q.question_type === 'multiple_choice' || q.question_type === 'true_false') {
        const correctOpt = qOptions.find(o => o.is_correct);
        if (correctOpt && answer?.selectedOptionId === correctOpt.id) {
          isCorrect = true;
          earnedScore += q.points;
        }
      }

      answerRecords.push({
        question_id: q.id,
        selected_option_id: answer?.selectedOptionId,
        text_answer: answer?.textAnswer,
        is_correct: isCorrect,
        points_earned: isCorrect ? q.points : 0
      });
    });

    const timeTaken = Math.round((Date.now() - startTimeRef.current) / 60000);

    try {
      const success = await submitQuiz({
        student_id: user.id,
        exam_id: exam.id,
        score: earnedScore,
        total_points: totalPoints,
        time_taken_minutes: Math.max(1, timeTaken),
        is_completed: true
      }, answerRecords);

      if (success) {
        setScore(earnedScore);
        setIsSubmitted(true);
        toast.success(
          language === "ar" ? "تم إرسال الاختبار بنجاح"
          : language === "fr" ? "Quiz soumis avec succès"
          : "Quiz submitted successfully"
        );
      }
    } catch (err) {
      console.error('Error submitting quiz:', err);
      toast.error("Failed to submit quiz");
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground text-sm">
          {language === "ar" ? "جاري تحميل الاختبار..." : language === "fr" ? "Chargement du quiz..." : "Loading quiz..."}
        </p>
      </div>
    );
  }

  if (isSubmitted) {
    const percentage = totalPoints > 0 ? Math.round(((score || 0) / totalPoints) * 100) : 0;

    return (
      <Card className="max-w-xl mx-auto p-6 text-center border shadow-lg rounded-2xl">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-600">
            <Award className="h-10 w-10" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">
          {language === "ar" ? "تم إنهاء الاختبار !" : language === "fr" ? "Quiz terminé !" : "Quiz Completed!"}
        </CardTitle>
        <CardContent className="space-y-4 pt-4">
          <div className="text-4xl font-extrabold text-primary font-mono">
            {score}/{totalPoints} <span className="text-lg font-normal text-muted-foreground">{language === "ar" ? "نقطة" : "pts"}</span>
          </div>
          <div className="text-base font-semibold text-muted-foreground">
            {percentage}% {language === "ar" ? "النتيجة النهائية" : language === "fr" ? "Score final" : "Final Score"}
          </div>
          <Progress value={percentage} className="w-full max-w-xs mx-auto h-2.5" />
          <div className="pt-4">
            <Button onClick={onClose} className="px-6 font-semibold">
              {language === "ar" ? "إغلاق" : language === "fr" ? "Fermer" : "Close"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isStarted) {
    return (
      <Card className="max-w-2xl mx-auto border shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="bg-muted/20 border-b pb-4">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            {language === "ar" ? `اجتياز: ${exam.title}` : language === "fr" ? `Passer : ${exam.title}` : `Start Quiz: ${exam.title}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-muted/40 flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span>{language === "ar" ? `المدة: ${exam.duration_minutes} دقيقة` : language === "fr" ? `Durée : ${exam.duration_minutes} min` : `Duration: ${exam.duration_minutes} mins`}</span>
            </div>
            <div className="p-3 rounded-lg bg-muted/40 flex items-center gap-2">
              <Badge variant="outline" className="font-semibold">
                {questions.length} {language === "ar" ? "أسئلة" : "Questions"}
              </Badge>
            </div>
            <div className="p-3 rounded-lg bg-muted/40 flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" />
              <span>{language === "ar" ? `مجموع النقاط: ${totalPoints}` : language === "fr" ? `Total : ${totalPoints} points` : `Total: ${totalPoints} points`}</span>
            </div>
            <div className="p-3 rounded-lg bg-muted/40 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <span>{language === "ar" ? "إرسال تلقائي عند انتهاء الوقت" : language === "fr" ? "Envoi auto à l'expiration" : "Auto-submit when time expires"}</span>
            </div>
          </div>

          <div className="bg-muted/20 p-4 rounded-xl border space-y-2">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              {language === "ar" ? "تعليمات الاختبار :" : language === "fr" ? "Consignes :" : "Instructions:"}
            </h4>
            <ul className="text-xs space-y-1.5 text-muted-foreground list-disc list-inside">
              <li>{language === "ar" ? "أجب عن جميع الأسئلة بدقة وتركيز." : language === "fr" ? "Répondez à toutes les questions." : "Answer all questions to the best of your ability."}</li>
              <li>{language === "ar" ? "يمكنك التنقل بين الأسئلة بحرية قبل الإرسال النهائي." : language === "fr" ? "Vous pouvez naviguer librement entre les questions." : "You can navigate between questions using next/prev buttons."}</li>
              <li>{language === "ar" ? "انقر على زر الإرسال عند الانتهاء أو عند نفاد الوقت." : language === "fr" ? "Cliquez sur Terminer une fois vos réponses complétées." : "Submit when ready or when the timer expires."}</li>
            </ul>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={onClose} size="sm">
              {language === "ar" ? "إلغاء" : language === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button onClick={startQuiz} size="sm" className="bg-primary hover:bg-primary/90 font-bold px-5">
              {language === "ar" ? "بدء الاختبار الآن" : language === "fr" ? "Commencer le Quiz" : "Start Quiz"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  if (!currentQuestion) return null;

  const currentAnswer = getCurrentAnswer(currentQuestion.id);
  const qOptions = getQuestionOptions(currentQuestion.id);
  const progressPercent = Math.round(((currentQuestionIndex + 1) / questions.length) * 100);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Quiz Header with Timer */}
      <div className="flex items-center justify-between p-4 rounded-xl border bg-card shadow-xs">
        <div>
          <h2 className="text-lg font-bold">{exam.title}</h2>
          <p className="text-xs text-muted-foreground">
            {language === "ar" ? `السؤال ${currentQuestionIndex + 1} من ${questions.length}` : language === "fr" ? `Question ${currentQuestionIndex + 1} sur ${questions.length}` : `Question ${currentQuestionIndex + 1} of ${questions.length}`}
          </p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono font-bold text-sm ${
          timeLeft <= 120 ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-muted text-foreground'
        }`}>
          <Clock className="h-4 w-4" />
          <span>{formatTimer(timeLeft)}</span>
        </div>
      </div>

      <Progress value={progressPercent} className="h-2" />

      {/* Question Card */}
      <Card className="p-6 border shadow-sm rounded-2xl space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Badge className="font-bold">Q{currentQuestionIndex + 1}</Badge>
            <Badge variant="outline">{currentQuestion.points} {language === "ar" ? "نقطة" : "pt"}</Badge>
          </div>
        </div>

        <div 
          className="text-base font-semibold leading-relaxed text-foreground prose max-w-none dark:prose-invert [&_img]:max-h-[320px] [&_img]:object-contain [&_img]:rounded-xl [&_img]:mx-auto [&_img]:my-3"
          dangerouslySetInnerHTML={{ __html: currentQuestion.question }}
        />

        {/* Multiple Choice Options */}
        {currentQuestion.question_type === 'multiple_choice' && (
          <div className="space-y-2.5 pt-2">
            {qOptions.map((opt, oIdx) => {
              const isSelected = currentAnswer?.selectedOptionId === opt.id;

              return (
                <div
                  key={opt.id}
                  onClick={() => handleSelectOption(currentQuestion.id, opt.id)}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-primary bg-primary/10 shadow-xs'
                      : 'border-muted hover:border-muted-foreground/30 hover:bg-muted/10'
                  }`}
                >
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    {String.fromCharCode(65 + oIdx)}
                  </span>
                  <span className="text-sm font-medium flex-1">{opt.option_text}</span>
                  {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                </div>
              );
            })}
          </div>
        )}

        {/* True / False Options */}
        {currentQuestion.question_type === 'true_false' && (
          <div className="grid grid-cols-2 gap-4 pt-2">
            {['True', 'False'].map(val => {
              const isSelected = currentAnswer?.selectedOptionId === val;

              return (
                <Button
                  key={val}
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  onClick={() => handleSelectOption(currentQuestion.id, val)}
                  className={`h-12 text-sm font-bold gap-2 ${
                    isSelected ? 'bg-primary text-primary-foreground' : ''
                  }`}
                >
                  {val === 'True' ? (
                    language === "ar" ? "صحيح (True)" : language === "fr" ? "Vrai" : "True"
                  ) : (
                    language === "ar" ? "خطأ (False)" : language === "fr" ? "Faux" : "False"
                  )}
                </Button>
              );
            })}
          </div>
        )}

        {/* Short Answer */}
        {currentQuestion.question_type === 'short_answer' && (
          <div className="pt-2">
            <Textarea
              placeholder={language === "ar" ? "اكتب إجابتك هنا..." : language === "fr" ? "Saisissez votre réponse ici..." : "Type your answer here..."}
              value={currentAnswer?.textAnswer || ""}
              onChange={(e) => handleTextAnswer(currentQuestion.id, e.target.value)}
              rows={4}
            />
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            disabled={currentQuestionIndex === 0}
            onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
            className="text-xs font-semibold gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {language === "ar" ? "السابق" : language === "fr" ? "Précédent" : "Previous"}
          </Button>

          {currentQuestionIndex < questions.length - 1 ? (
            <Button
              size="sm"
              onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
              className="text-xs font-semibold gap-1.5"
            >
              {language === "ar" ? "التالي" : language === "fr" ? "Suivant" : "Next"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleSubmit}
              className="text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-5"
            >
              <Check className="h-4 w-4" />
              {language === "ar" ? "إنهاء وإرسال الاختبار" : language === "fr" ? "Terminer le Quiz" : "Submit Quiz"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default QuizTaker;

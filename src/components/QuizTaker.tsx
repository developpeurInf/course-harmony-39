import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, CheckCircle, Award, ArrowLeft, ArrowRight, Check, Timer, AlertTriangle, RefreshCw, Eye } from "lucide-react";
import { useCourses, QuizQuestion, QuizOption, Exam, parseQuestionText, parseExamAvailability, QuizSettings, DEFAULT_QUIZ_SETTINGS } from "@/contexts/CourseContext";
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
  const [parsedQuestions, setParsedQuestions] = useState<Array<{ cleanText: string; timeLimitSeconds: number | null }>>([]);
  const [options, setOptions] = useState<QuizOption[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Global quiz timer
  const [timeLeft, setTimeLeft] = useState(0);

  // Per-question timer (sequential mode)
  const [questionTimeLeft, setQuestionTimeLeft] = useState<number | null>(null);
  const questionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const startTimeRef = useRef<number>(0);

  // Settings & Sequential mode
  const [quizSettings, setQuizSettings] = useState<QuizSettings>(DEFAULT_QUIZ_SETTINGS);
  const [isSequentialMode, setIsSequentialMode] = useState(false);
  const [previousSubmission, setPreviousSubmission] = useState<any>(null);
  const [showReviewDetails, setShowReviewDetails] = useState(false);

  useEffect(() => {
    const parsed = parseExamAvailability(exam) as any;
    const settings: QuizSettings = parsed.quiz_settings || DEFAULT_QUIZ_SETTINGS;
    setQuizSettings(settings);
    const seq = !!(settings.sequentialQuestions || parsed.quiz_mode === 'sequential_timed');
    setIsSequentialMode(seq);
    loadQuizData(settings);
  }, [exam.id]);

  // Global quiz timer
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

  // Per-question timer (sequential mode)
  const startQuestionTimer = useCallback((timeLimitSec: number | null) => {
    if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    if (!timeLimitSec || timeLimitSec <= 0) {
      setQuestionTimeLeft(null);
      return;
    }
    setQuestionTimeLeft(timeLimitSec);
    questionTimerRef.current = setInterval(() => {
      setQuestionTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          // auto-advance or auto-submit
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Handle question timer hitting 0
  useEffect(() => {
    if (!isSequentialMode || questionTimeLeft === null || questionTimeLeft > 0 || !isStarted || isSubmitted) return;
    // Time expired for this question — advance or submit
    if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    if (currentQuestionIndex < questions.length - 1) {
      setTimeout(() => {
        const nextIdx = currentQuestionIndex + 1;
        setCurrentQuestionIndex(nextIdx);
        const nextParsed = parsedQuestions[nextIdx];
        startQuestionTimer(nextParsed?.timeLimitSeconds ?? null);
      }, 300);
    } else {
      // Last question — auto submit
      setTimeout(() => handleSubmit(), 300);
    }
  }, [questionTimeLeft, isSequentialMode, currentQuestionIndex, questions.length, isStarted, isSubmitted]);

  // Start per-question timer when question changes in sequential mode
  useEffect(() => {
    if (!isSequentialMode || !isStarted || parsedQuestions.length === 0) return;
    const parsed = parsedQuestions[currentQuestionIndex];
    startQuestionTimer(parsed?.timeLimitSeconds ?? null);
    return () => {
      if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    };
  }, [currentQuestionIndex, isSequentialMode, isStarted, parsedQuestions]);

  const loadQuizData = async (settings: QuizSettings) => {
    setLoading(true);
    try {
      if (user?.id) {
        const { data: subData } = await supabase
          .from('quiz_submissions')
          .select('*')
          .eq('exam_id', exam.id)
          .eq('student_id', user.id)
          .order('submitted_at', { ascending: false });

        if (subData && subData.length > 0) {
          const latestSub = subData[0];
          setPreviousSubmission(latestSub);
          if (!settings.allowMultipleAttempts) {
            // Block retaking, show submitted screen directly
            setIsSubmitted(true);
            setScore(latestSub.score);
            setTotalPoints(latestSub.total_points || 0);
            setLoading(false);
            return;
          }
        }
      }

      const { data: qData } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('exam_id', exam.id)
        .order('question_order', { ascending: true });

      let qList = (qData || []) as QuizQuestion[];

      // 🔀 Apply shuffleQuestions setting if enabled
      if (settings.shuffleQuestions && qList.length > 0) {
        qList = [...qList].sort(() => Math.random() - 0.5);
      }

      setQuestions(qList);

      // Parse per-question timing from question HTML
      const parsed = qList.map(q => parseQuestionText(q.question));
      setParsedQuestions(parsed);

      const total = qList.reduce((sum, q) => sum + (q.points || 1), 0);
      setTotalPoints(total);

      if (qList.length > 0) {
        const qIds = qList.map(q => q.id);
        const { data: oData } = await supabase
          .from('quiz_options')
          .select('*')
          .in('question_id', qIds)
          .order('option_order', { ascending: true });

        let fetchedOptions = (oData || []) as QuizOption[];

        // 🔀 Apply shuffleOptions setting if enabled
        if (settings.shuffleOptions && fetchedOptions.length > 0) {
          fetchedOptions = [...fetchedOptions].sort(() => Math.random() - 0.5);
        }

        setOptions(fetchedOptions);
      }
    } catch (err) {
      console.error('Error loading quiz data:', err);
    } finally {
      setLoading(false);
    }
  };

  const startQuiz = () => {
    setIsStarted(true);
    setIsSubmitted(false);
    setAnswers([]);
    setCurrentQuestionIndex(0);
    setTimeLeft((exam.duration_minutes || 30) * 60);
    startTimeRef.current = Date.now();

    // Start first question timer if sequential mode
    if (isSequentialMode && parsedQuestions.length > 0) {
      startQuestionTimer(parsedQuestions[0]?.timeLimitSeconds ?? null);
    }
  };

  const handleSelectOption = (questionId: string, optionId: string) => {
    // 🔒 If allowCorrections is false and student already selected an answer, block changing
    const existing = getCurrentAnswer(questionId);
    if (!quizSettings.allowCorrections && existing?.selectedOptionId) {
      toast.info(
        language === "fr" ? "Les corrections ne sont pas autorisées pour ce quiz."
        : language === "ar" ? "غير مسموح بتعديل الإجابات في هذا الاختبار."
        : "Corrections are not allowed for this quiz."
      );
      return;
    }

    setAnswers(prev => {
      const filtered = prev.filter(a => a.questionId !== questionId);
      return [...filtered, { questionId, selectedOptionId: optionId }];
    });
  };

  const handleTextAnswer = (questionId: string, text: string) => {
    const existing = getCurrentAnswer(questionId);
    if (!quizSettings.allowCorrections && existing?.textAnswer && existing.textAnswer.trim()) {
      return;
    }

    setAnswers(prev => {
      const filtered = prev.filter(a => a.questionId !== questionId);
      return [...filtered, { questionId, textAnswer: text }];
    });
  };

  const getCurrentAnswer = (questionId: string) => {
    return answers.find(a => a.questionId === questionId);
  };

  const getQuestionOptions = (questionId: string) => {
    return options.filter(o => o.question_id === questionId);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!user) return;
    setIsSubmitting(true);

    if (questionTimerRef.current) clearInterval(questionTimerRef.current);

    let earnedScore = 0;
    const answerRecords: any[] = [];

    questions.forEach(q => {
      const answer = getCurrentAnswer(q.id);
      const qOptions = getQuestionOptions(q.id);
      let isCorrect = false;

      let validSelectedOptionId: string | null = null;
      if (answer?.selectedOptionId) {
        const rawSel = answer.selectedOptionId;
        const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(rawSel);
        if (isUuid) {
          validSelectedOptionId = rawSel;
        } else {
          const matchOpt = qOptions.find(o => o.option_text.toLowerCase() === rawSel.toLowerCase());
          if (matchOpt) {
            validSelectedOptionId = matchOpt.id;
          }
        }
      }

      if (q.question_type === 'multiple_choice' || q.question_type === 'true_false') {
        const correctOpt = qOptions.find(o => o.is_correct);
        if (correctOpt) {
          if (validSelectedOptionId === correctOpt.id || (answer?.selectedOptionId && answer.selectedOptionId.toLowerCase() === correctOpt.option_text.toLowerCase())) {
            isCorrect = true;
            earnedScore += q.points;
          }
        }
      }

      answerRecords.push({
        question_id: q.id,
        selected_option_id: validSelectedOptionId,
        text_answer: answer?.textAnswer || null,
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToNext = () => {
    if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    const nextIdx = currentQuestionIndex + 1;
    setCurrentQuestionIndex(nextIdx);
    if (isSequentialMode) {
      startQuestionTimer(parsedQuestions[nextIdx]?.timeLimitSeconds ?? null);
    }
  };

  const goToPrev = () => {
    if (isSequentialMode) return; // blocked in sequential mode
    setCurrentQuestionIndex(prev => prev - 1);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground text-sm">
          {language === "ar" ? "جاري تحميل الاختبار..." : language === "fr" ? "Chargement du quiz..." : "Loading quiz..."}
        </p>
      </div>
    );
  }

  // ─── Submitted / Result Screen ─────────────────────────────────────────────
  if (isSubmitted) {
    const percentage = totalPoints > 0 ? Math.round(((score || 0) / totalPoints) * 100) : 0;

    return (
      <Card className="max-w-xl mx-auto p-6 text-center border shadow-lg rounded-2xl space-y-4">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-600">
            <Award className="h-10 w-10" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">
          {language === "ar" ? "تم إنهاء الاختبار !" : language === "fr" ? "Quiz terminé !" : "Quiz Completed!"}
        </CardTitle>
        <CardContent className="space-y-4 pt-2">
          {/* 🎯 Respect showResultsImmediately setting */}
          {quizSettings.showResultsImmediately ? (
            <>
              <div className="text-4xl font-extrabold text-primary font-mono">
                {score}/{totalPoints} <span className="text-lg font-normal text-muted-foreground">{language === "ar" ? "نقطة" : "pts"}</span>
              </div>
              <div className="text-base font-semibold text-muted-foreground">
                {percentage}% {language === "ar" ? "النتيجة النهائية" : language === "fr" ? "Score final" : "Final Score"}
              </div>
              <Progress value={percentage} className="w-full max-w-xs mx-auto h-2.5" />
            </>
          ) : (
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs">
              <p className="font-semibold">
                {language === "fr"
                  ? "Votre réponse a été enregistrée avec succès. La note sera publiée par votre enseignant."
                  : language === "ar"
                  ? "تم حفظ إجابتك بنجاح. سيتم نشر النتيجة من طرف الأستاذ."
                  : "Your response has been saved. Scores will be published by your teacher."}
              </p>
            </div>
          )}

          {/* 📖 Respect allowReview setting */}
          {quizSettings.allowReview && questions.length > 0 && (
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowReviewDetails(!showReviewDetails)}
                className="text-xs font-semibold gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              >
                <Eye className="h-3.5 w-3.5" />
                {showReviewDetails
                  ? (language === "fr" ? "Masquer le corrigé" : language === "ar" ? "إخفاء التصحيح" : "Hide correction")
                  : (language === "fr" ? "Consulter le corrigé détaillé" : language === "ar" ? "عرض التصحيح التفصيلي" : "View detailed correction")}
              </Button>

              {showReviewDetails && (
                <div className="pt-4 border-t text-left space-y-3 mt-3">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    {language === "fr" ? "Corrigé détaillé :" : language === "ar" ? "التصحيح التفصيلي :" : "Detailed Correction:"}
                  </h4>
                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                    {questions.map((q, idx) => {
                      const { cleanText } = parseQuestionText(q.question);
                      const ans = getCurrentAnswer(q.id);
                      const qOpts = getQuestionOptions(q.id);
                      const correctOpt = qOpts.find(o => o.is_correct);

                      let isCorrect = false;
                      if (q.question_type === 'multiple_choice' || q.question_type === 'true_false') {
                        if (correctOpt && (ans?.selectedOptionId === correctOpt.id || (ans?.selectedOptionId && ans.selectedOptionId.toLowerCase() === correctOpt.option_text.toLowerCase()))) {
                          isCorrect = true;
                        }
                      }

                      return (
                        <div key={q.id} className={`p-3 rounded-xl border text-xs space-y-1 ${isCorrect ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20' : 'bg-rose-50/50 border-rose-200 dark:bg-rose-950/20'}`}>
                          <div className="flex items-center justify-between font-bold">
                            <span className="truncate max-w-[70%]">Q{idx + 1}: <span dangerouslySetInnerHTML={{ __html: cleanText }} /></span>
                            <Badge variant={isCorrect ? 'default' : 'destructive'} className="text-[10px]">
                              {isCorrect ? `+${q.points} pt` : `0 / ${q.points} pt`}
                            </Badge>
                          </div>
                          {correctOpt && (
                            <p className="text-muted-foreground text-[11px]">
                              <strong className="text-foreground">{language === "fr" ? "Bonne réponse : " : "Correct answer: "}</strong>
                              {correctOpt.option_text}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 🔄 Allow multiple attempts button if allowed */}
          {quizSettings.allowMultipleAttempts && (
            <div className="pt-2">
              <Button onClick={startQuiz} size="sm" variant="outline" className="text-xs font-semibold gap-1.5 border-primary text-primary hover:bg-primary/10">
                <RefreshCw className="h-3.5 w-3.5" />
                {language === "fr" ? "Repasser le quiz" : language === "ar" ? "إعادة اجتياز الاختبار" : "Retake Quiz"}
              </Button>
            </div>
          )}

          <div className="pt-2">
            <Button onClick={onClose} className="px-6 font-semibold">
              {language === "ar" ? "إغلاق" : language === "fr" ? "Fermer" : "Close"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── Start Screen ──────────────────────────────────────────────────────────
  if (!isStarted) {
    const questionsWithNoTime = isSequentialMode ? parsedQuestions.filter(p => !p.timeLimitSeconds).length : 0;

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
            {isSequentialMode && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-700 flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <Timer className="h-4 w-4" />
                <span className="font-semibold">{language === "fr" ? "Mode séquentiel minuté" : language === "ar" ? "وضع ترتيب موقوت" : "Sequential timed mode"}</span>
              </div>
            )}
          </div>

          {previousSubmission && quizSettings.allowMultipleAttempts && (
            <div className="p-3 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 text-xs flex items-center justify-between">
              <div>
                <span className="font-bold">{language === "fr" ? "Dernière tentative :" : "Previous score:"} </span>
                <span>{previousSubmission.score} / {previousSubmission.total_points} pts</span>
              </div>
              <Badge variant="outline" className="border-blue-300 text-blue-700 font-semibold">
                {language === "fr" ? "Plusieurs tentatives autorisées" : "Multiple attempts allowed"}
              </Badge>
            </div>
          )}

          {isSequentialMode && questionsWithNoTime > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                {language === "fr"
                  ? `${questionsWithNoTime} question(s) sans minuteur — elles seront sans limite de temps.`
                  : language === "ar"
                  ? `${questionsWithNoTime} سؤال بدون توقيت — ستكون بدون حد زمني.`
                  : `${questionsWithNoTime} question(s) have no timer — they will have no time limit.`}
              </p>
            </div>
          )}

          <div className="bg-muted/20 p-4 rounded-xl border space-y-2">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              {language === "ar" ? "تعليمات الاختبار :" : language === "fr" ? "Consignes :" : "Instructions:"}
            </h4>
            <ul className="text-xs space-y-1.5 text-muted-foreground list-disc list-inside">
              <li>{language === "ar" ? "أجب عن جميع الأسئلة بدقة وتركيز." : language === "fr" ? "Répondez à toutes les questions." : "Answer all questions to the best of your ability."}</li>
              {isSequentialMode ? (
                <>
                  <li>{language === "fr" ? "Mode séquentiel : vous ne pouvez pas revenir en arrière." : language === "ar" ? "وضع الترتيب: لا يمكنك العودة للسؤال السابق." : "Sequential mode: you cannot go back to previous questions."}</li>
                  <li>{language === "fr" ? "Chaque question a son propre chronomètre. Le temps expiré passe à la question suivante." : language === "ar" ? "لكل سؤال وقته الخاص. انتهاء الوقت ينتقل للسؤال التالي تلقائيًا." : "Each question has its own timer. Time expiry auto-advances to next question."}</li>
                </>
              ) : (
                <>
                  <li>{language === "fr" ? "Vous pouvez naviguer librement entre les questions." : language === "ar" ? "يمكنك التنقل بين الأسئلة بحرية." : "You can navigate between questions using next/prev buttons."}</li>
                  <li>{language === "fr" ? "Cliquez sur Terminer une fois vos réponses complétées." : language === "ar" ? "انقر على زر الإرسال عند الانتهاء." : "Submit when ready or when the timer expires."}</li>
                </>
              )}
              {quizSettings.shuffleQuestions && (
                <li>{language === "fr" ? "Les questions sont mélangées aléatoirement." : "Questions are randomized."}</li>
              )}
              {quizSettings.shuffleOptions && (
                <li>{language === "fr" ? "Les options de réponse sont mélangées aléatoirement." : "Answer options are randomized."}</li>
              )}
              {!quizSettings.allowCorrections && (
                <li>{language === "fr" ? "Une fois votre réponse choisie, vous ne pourrez pas la modifier." : "Answer modifications are locked after selection."}</li>
              )}
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

  // ─── Active Quiz ───────────────────────────────────────────────────────────
  const currentQ = questions[currentQuestionIndex];
  if (!currentQ) return null;

  const currentAnswer = getCurrentAnswer(currentQ.id);
  const qOptions = getQuestionOptions(currentQ.id);
  const progressPercent = Math.round(((currentQuestionIndex + 1) / questions.length) * 100);
  const currentParsed = parsedQuestions[currentQuestionIndex];
  const currentQCleanText = currentParsed?.cleanText || currentQ.question;
  const currentQTimeLimitSec = currentParsed?.timeLimitSeconds;

  // Per-question progress
  const qTimePercent = (isSequentialMode && questionTimeLeft !== null && currentQTimeLimitSec)
    ? Math.round((questionTimeLeft / currentQTimeLimitSec) * 100)
    : null;
  const qTimeLow = questionTimeLeft !== null && questionTimeLeft <= 10 && questionTimeLeft > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Global Timer Header */}
      <div className="flex items-center justify-between p-4 rounded-xl border bg-card shadow-xs">
        <div>
          <h2 className="text-lg font-bold">{exam.title}</h2>
          <p className="text-xs text-muted-foreground">
            {language === "ar" ? `السؤال ${currentQuestionIndex + 1} من ${questions.length}` : language === "fr" ? `Question ${currentQuestionIndex + 1} sur ${questions.length}` : `Question ${currentQuestionIndex + 1} of ${questions.length}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSequentialMode && (
            <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 dark:text-amber-400">
              {language === "fr" ? "Séquentiel" : language === "ar" ? "ترتيب" : "Sequential"}
            </Badge>
          )}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono font-bold text-sm ${
            timeLeft <= 120 ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-muted text-foreground'
          }`}>
            <Clock className="h-4 w-4" />
            <span>{formatTimer(timeLeft)}</span>
          </div>
        </div>
      </div>

      {/* Global progress */}
      <Progress value={progressPercent} className="h-1.5" />

      {/* Question Card */}
      <Card className="p-6 border shadow-sm rounded-2xl space-y-4">
        {/* Question header with per-question timer */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="font-bold">Q{currentQuestionIndex + 1}</Badge>
            <Badge variant="outline">{currentQ.points} {language === "ar" ? "نقطة" : "pt"}</Badge>
          </div>

          {/* Per-question timer bar (sequential mode) */}
          {isSequentialMode && questionTimeLeft !== null && currentQTimeLimitSec && (
            <div className="flex items-center gap-2 flex-1 max-w-xs ml-auto">
              <Timer className={`h-4 w-4 shrink-0 ${qTimeLow ? 'text-rose-600 animate-pulse' : 'text-amber-600'}`} />
              <div className="flex-1 space-y-1">
                <Progress
                  value={qTimePercent || 0}
                  className={`h-2 ${qTimeLow ? '[&>div]:bg-rose-500' : '[&>div]:bg-amber-500'}`}
                />
              </div>
              <span className={`font-mono text-xs font-bold shrink-0 ${qTimeLow ? 'text-rose-600 animate-pulse' : 'text-amber-700 dark:text-amber-400'}`}>
                {formatTimer(questionTimeLeft)}
              </span>
            </div>
          )}

          {/* No timer assigned in sequential mode */}
          {isSequentialMode && (questionTimeLeft === null || !currentQTimeLimitSec) && (
            <Badge variant="outline" className="text-[10px] border-muted text-muted-foreground ml-auto">
              {language === "fr" ? "Pas de minuteur" : language === "ar" ? "بدون توقيت" : "No timer"}
            </Badge>
          )}
        </div>

        {/* Question text */}
        <div
          className="text-base font-semibold leading-relaxed text-foreground prose max-w-none dark:prose-invert [&_img]:max-h-[320px] [&_img]:object-contain [&_img]:rounded-xl [&_img]:mx-auto [&_img]:my-3"
          dangerouslySetInnerHTML={{ __html: currentQCleanText }}
        />

        {/* Multiple Choice Options */}
        {currentQ.question_type === 'multiple_choice' && (
          <div className="space-y-2.5 pt-2">
            {qOptions.map((opt, oIdx) => {
              const isSelected = currentAnswer?.selectedOptionId === opt.id;
              const isLocked = !quizSettings.allowCorrections && !!currentAnswer?.selectedOptionId && !isSelected;

              return (
                <div
                  key={opt.id}
                  onClick={() => !isLocked && handleSelectOption(currentQ.id, opt.id)}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all ${
                    isLocked ? 'opacity-50 cursor-not-allowed border-muted' : 'cursor-pointer'
                  } ${
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

        {/* True / False */}
        {currentQ.question_type === 'true_false' && (
          <div className="grid grid-cols-2 gap-4 pt-2">
            {['True', 'False'].map(val => {
              const matchingOpt = qOptions.find(o => o.option_text.toLowerCase() === val.toLowerCase());
              const optId = matchingOpt ? matchingOpt.id : val;
              const isSelected = currentAnswer?.selectedOptionId === optId || currentAnswer?.selectedOptionId === val;
              const isLocked = !quizSettings.allowCorrections && !!currentAnswer?.selectedOptionId && !isSelected;

              return (
                <Button
                  key={val}
                  type="button"
                  disabled={isLocked}
                  variant={isSelected ? "default" : "outline"}
                  onClick={() => handleSelectOption(currentQ.id, optId)}
                  className={`h-12 text-sm font-bold gap-2 ${isSelected ? 'bg-primary text-primary-foreground' : ''}`}
                >
                  {val === 'True'
                    ? (language === "ar" ? "صحيح (True)" : language === "fr" ? "Vrai" : "True")
                    : (language === "ar" ? "خطأ (False)" : language === "fr" ? "Faux" : "False")}
                </Button>
              );
            })}
          </div>
        )}

        {/* Short Answer */}
        {currentQ.question_type === 'short_answer' && (
          <div className="pt-2">
            <Textarea
              placeholder={language === "ar" ? "اكتب إجابتك هنا..." : language === "fr" ? "Saisissez votre réponse ici..." : "Type your answer here..."}
              value={currentAnswer?.textAnswer || ""}
              onChange={(e) => handleTextAnswer(currentQ.id, e.target.value)}
              rows={4}
            />
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          {/* Previous: hidden in sequential mode */}
          {!isSequentialMode ? (
            <Button
              variant="outline"
              size="sm"
              disabled={currentQuestionIndex === 0}
              onClick={goToPrev}
              className="text-xs font-semibold gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {language === "ar" ? "السابق" : language === "fr" ? "Précédent" : "Previous"}
            </Button>
          ) : (
            <div />
          )}

          {currentQuestionIndex < questions.length - 1 ? (
            <Button
              size="sm"
              onClick={goToNext}
              className="text-xs font-semibold gap-1.5"
            >
              {language === "ar" ? "التالي" : language === "fr" ? "Suivant" : "Next"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-5"
            >
              <Check className="h-4 w-4" />
              {isSubmitting
                ? (language === "fr" ? "Envoi..." : language === "ar" ? "جاري الإرسال..." : "Submitting...")
                : (language === "ar" ? "إنهاء وإرسال الاختبار" : language === "fr" ? "Terminer le Quiz" : "Submit Quiz")}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default QuizTaker;

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Trophy, User, Clock, Target } from "lucide-react";
import { useCourses } from "@/contexts/CourseContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface QuizSubmission {
  id: string;
  student_id: string;
  score: number;
  total_points: number;
  time_taken_minutes: number;
  submitted_at: string;
  is_completed: boolean;
  student_name?: string;
  attempts?: number;
}

interface QuizResultsProps {
  examId: string;
  onClose: () => void;
}

const QuizResults = ({ examId, onClose }: QuizResultsProps) => {
  const { user } = useAuth();
  const { exams } = useCourses();
  const { language } = useLanguage();
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const exam = exams.find(e => e.id === examId);
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en);
  const isProfessor = user?.role === "professor";

  useEffect(() => {
    loadSubmissions();
  }, [examId]);

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      if (isProfessor) {
        // Load all submissions for this exam for professors
        const { data: submissions, error: submissionsError } = await supabase
          .from('quiz_submissions')
          .select('*')
          .eq('exam_id', examId)
          .eq('is_completed', true)
          .order('score', { ascending: false });

        if (submissionsError) throw submissionsError;

        if (submissions && submissions.length > 0) {
          // Plusieurs tentatives autorisées : on garde la DERNIÈRE tentative de chaque élève
          // (avant : un élève apparaissait plusieurs fois et faussait les statistiques)
          const byStudent = new Map<string, any>();
          const attemptsByStudent = new Map<string, number>();
          for (const sub of submissions) {
            attemptsByStudent.set(sub.student_id, (attemptsByStudent.get(sub.student_id) || 0) + 1);
            const prev = byStudent.get(sub.student_id);
            if (!prev || new Date(sub.submitted_at) > new Date(prev.submitted_at)) {
              byStudent.set(sub.student_id, sub);
            }
          }
          const latestSubs = Array.from(byStudent.values()).sort((a, b) => (b.score || 0) - (a.score || 0));

          // Get student names separately
          const studentIds = latestSubs.map(sub => sub.student_id);
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', studentIds);

          if (profilesError) throw profilesError;

          const submissionsWithNames = latestSubs.map(sub => {
            const profile = profiles?.find(p => p.id === sub.student_id);
            return {
              ...sub,
              attempts: attemptsByStudent.get(sub.student_id) || 1,
              student_name: profile?.name || (language === "fr" ? "Élève inconnu" : language === "ar" ? "تلميذ غير معروف" : "Unknown Student")
            };
          });

          setSubmissions(submissionsWithNames);
        }
      } else {
        // Load only current user's submission for students
        const { data, error } = await supabase
          .from('quiz_submissions')
          .select('*')
          .eq('exam_id', examId)
          .eq('student_id', user?.id)
          .eq('is_completed', true)
          .order('submitted_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        
        if (data) {
          setSubmissions([{
            ...data,
            student_name: user?.name
          }]);
        }
      }
    } catch (error) {
      console.error('Failed to load quiz results:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScorePercentage = (score: number, total: number) => {
    if (!total) return 0;
    return Math.round(((score || 0) / total) * 100);
  };

  const getGradeColor = (percentage: number) => {
    if (percentage >= 90) return "text-green-600";
    if (percentage >= 80) return "text-blue-600";
    if (percentage >= 70) return "text-yellow-600";
    if (percentage >= 60) return "text-orange-600";
    return "text-red-600";
  };

  const getAverageScore = () => {
    if (submissions.length === 0) return 0;
    const totalScore = submissions.reduce((sum, sub) => sum + sub.score, 0);
    const totalPossible = submissions.reduce((sum, sub) => sum + sub.total_points, 0);
    return totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">{tr("Chargement des résultats…", "جارٍ تحميل النتائج…", "Loading results...")}</p>
        </CardContent>
      </Card>
    );
  }

  if (submissions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">{tr("Aucun résultat pour l'instant", "لا توجد نتائج بعد", "No Results Yet")}</h3>
          <p className="text-muted-foreground mb-4">
            {isProfessor
              ? tr("Aucun élève n'a encore terminé ce quiz.", "لم يُنهِ أي تلميذ هذا الاختبار بعد.", "No students have completed this quiz yet.")
              : tr("Vous n'avez pas encore terminé ce quiz.", "لم تُنهِ هذا الاختبار بعد.", "You haven't completed this quiz yet.")}
          </p>
          <Button onClick={onClose}>{tr("Fermer", "إغلاق", "Close")}</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{tr("Résultats du quiz", "نتائج الاختبار", "Quiz Results")}</h2>
          <p className="text-muted-foreground">{exam?.title}</p>
        </div>
        <Button onClick={onClose} variant="outline">{tr("Fermer", "إغلاق", "Close")}</Button>
      </div>

      {/* Statistics for professors */}
      {isProfessor && submissions.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              {tr("Statistiques de la classe", "إحصائيات القسم", "Class Statistics")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{submissions.length}</div>
                <div className="text-sm text-muted-foreground">{tr("Élèves ayant terminé", "تلاميذ أنهوا", "Students Completed")}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{getAverageScore()}%</div>
                <div className="text-sm text-muted-foreground">{tr("Moyenne de la classe", "معدل القسم", "Class Average")}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {Math.max(...submissions.map(s => getScorePercentage(s.score, s.total_points)))}%
                </div>
                <div className="text-sm text-muted-foreground">{tr("Meilleur score", "أعلى نقطة", "Highest Score")}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {Math.round(submissions.reduce((sum, s) => sum + (s.time_taken_minutes || 0), 0) / submissions.length)} min
                </div>
                <div className="text-sm text-muted-foreground">{tr("Temps moyen", "متوسط الوقت", "Avg. Time")}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Individual Results */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          {isProfessor
            ? (language === "ar" ? "نتائج التلاميذ" : language === "fr" ? "Résultats des élèves" : "Student Results")
            : (language === "ar" ? "نتيجتك" : language === "fr" ? "Votre résultat" : "Your Result")}
        </h3>
        
        {submissions.map((submission, index) => {
          const percentage = getScorePercentage(submission.score, submission.total_points);
          
          return (
            <Card key={submission.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {isProfessor && (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-muted-foreground">
                            #{index + 1}
                          </span>
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {submission.student_name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {submission.student_name}
                            {(submission.attempts || 1) > 1 && (
                              <Badge variant="outline" className="text-[10px] font-semibold">
                                {tr(`${submission.attempts} tentatives`, `${submission.attempts} محاولات`, `${submission.attempts} attempts`)}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {language === "ar" ? `تم التسليم: ${format(new Date(submission.submitted_at), "d MMM yyyy")}` : language === "fr" ? `Soumis le ${format(new Date(submission.submitted_at), "d MMM yyyy")}` : `Submitted ${format(new Date(submission.submitted_at), "MMM d, yyyy 'at' h:mm a")}`}
                          </div>
                        </div>
                      </>
                    )}
                    {!isProfessor && (
                      <div className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-yellow-500" />
                        <span className="font-medium">
                          {language === "ar" ? "نتيجتك" : language === "fr" ? "Votre résultat" : "Your Result"}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${getGradeColor(percentage)}`}>
                      {submission.score}/{submission.total_points}
                    </div>
                    <div className="text-sm text-muted-foreground">{percentage}%</div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <Progress value={percentage} className="h-2" />
                  
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>
                          {language === "ar"
                            ? `الوقت: ${submission.time_taken_minutes} دقيقة`
                            : language === "fr"
                            ? `Temps: ${submission.time_taken_minutes} min`
                            : `Time: ${submission.time_taken_minutes} minutes`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Target className="h-4 w-4" />
                        <span>
                          {language === "ar" ? `النقطة: ${percentage}%` : language === "fr" ? `Score: ${percentage}%` : `Score: ${percentage}%`}
                        </span>
                      </div>
                    </div>
                    
                    <Badge 
                      variant={percentage >= 70 ? "default" : percentage >= 60 ? "secondary" : "destructive"}
                    >
                      {language === "ar"
                        ? (percentage >= 90 ? "ممتاز" : percentage >= 80 ? "جيد جداً" : percentage >= 70 ? "جيد" : percentage >= 60 ? "مقبول" : "راسب")
                        : language === "fr"
                        ? (percentage >= 90 ? "Excellent" : percentage >= 80 ? "Bien" : percentage >= 70 ? "Assez bien" : percentage >= 60 ? "Passable" : "Insuffisant")
                        : (percentage >= 90 ? "Excellent" : percentage >= 80 ? "Good" : percentage >= 70 ? "Fair" : percentage >= 60 ? "Pass" : "Fail")}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default QuizResults;
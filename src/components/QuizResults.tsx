import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Trophy, User, Clock, Target } from "lucide-react";
import { useCourses } from "@/contexts/CourseContext";
import { useAuth } from "@/contexts/AuthContext";
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
}

interface QuizResultsProps {
  examId: string;
  onClose: () => void;
}

const QuizResults = ({ examId, onClose }: QuizResultsProps) => {
  const { user } = useAuth();
  const { exams } = useCourses();
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const exam = exams.find(e => e.id === examId);
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
          // Get student names separately
          const studentIds = submissions.map(sub => sub.student_id);
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', studentIds);

          if (profilesError) throw profilesError;

          const submissionsWithNames = submissions.map(sub => {
            const profile = profiles?.find(p => p.id === sub.student_id);
            return {
              ...sub,
              student_name: profile?.name || 'Unknown Student'
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
    return Math.round((score / total) * 100);
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
    return Math.round((totalScore / totalPossible) * 100);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Loading results...</p>
        </CardContent>
      </Card>
    );
  }

  if (submissions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Results Yet</h3>
          <p className="text-muted-foreground mb-4">
            {isProfessor 
              ? "No students have completed this quiz yet." 
              : "You haven't completed this quiz yet."}
          </p>
          <Button onClick={onClose}>Close</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Quiz Results</h2>
          <p className="text-muted-foreground">{exam?.title}</p>
        </div>
        <Button onClick={onClose} variant="outline">Close</Button>
      </div>

      {/* Statistics for professors */}
      {isProfessor && submissions.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Class Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{submissions.length}</div>
                <div className="text-sm text-muted-foreground">Students Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{getAverageScore()}%</div>
                <div className="text-sm text-muted-foreground">Class Average</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {Math.max(...submissions.map(s => getScorePercentage(s.score, s.total_points)))}%
                </div>
                <div className="text-sm text-muted-foreground">Highest Score</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {Math.round(submissions.reduce((sum, s) => sum + s.time_taken_minutes, 0) / submissions.length)}min
                </div>
                <div className="text-sm text-muted-foreground">Avg. Time</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Individual Results */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          {isProfessor ? "Student Results" : "Your Result"}
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
                          <div className="font-medium">{submission.student_name}</div>
                          <div className="text-sm text-muted-foreground">
                            Submitted {format(new Date(submission.submitted_at), "MMM d, yyyy 'at' h:mm a")}
                          </div>
                        </div>
                      </>
                    )}
                    {!isProfessor && (
                      <div className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-yellow-500" />
                        <span className="font-medium">Your Result</span>
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
                        <span>Time: {submission.time_taken_minutes} minutes</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Target className="h-4 w-4" />
                        <span>Score: {percentage}%</span>
                      </div>
                    </div>
                    
                    <Badge 
                      variant={percentage >= 70 ? "default" : percentage >= 60 ? "secondary" : "destructive"}
                    >
                      {percentage >= 90 ? "Excellent" : 
                       percentage >= 80 ? "Good" : 
                       percentage >= 70 ? "Fair" : 
                       percentage >= 60 ? "Pass" : "Fail"}
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
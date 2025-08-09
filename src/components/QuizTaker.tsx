import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, CheckCircle, XCircle, Award } from "lucide-react";
import { useCourses, QuizQuestion, QuizOption, Exam } from "@/contexts/CourseContext";
import { useAuth } from "@/contexts/AuthContext";
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

const QuizTaker = ({ exam, onClose }: QuizTakerProps) => {
  const { user } = useAuth();
  const { 
    getQuizQuestions, 
    getQuizOptions, 
    submitQuiz,
    getStudentQuizSubmission 
  } = useCourses();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [options, setOptions] = useState<QuizOption[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    loadQuiz();
    checkExistingSubmission();
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

  const loadQuiz = () => {
    const quizQuestions = getQuizQuestions(exam.id).sort((a, b) => a.question_order - b.question_order);
    setQuestions(quizQuestions);
    
    const allOptions: QuizOption[] = [];
    quizQuestions.forEach(q => {
      const questionOptions = getQuizOptions(q.id);
      allOptions.push(...questionOptions);
    });
    setOptions(allOptions);
    
    const total = quizQuestions.reduce((sum, q) => sum + q.points, 0);
    setTotalPoints(total);
    
    setAnswers(quizQuestions.map(q => ({ questionId: q.id })));
  };

  const checkExistingSubmission = () => {
    if (!user) return;
    
    const submission = getStudentQuizSubmission(exam.id, user.id);
    if (submission && submission.is_completed) {
      setIsSubmitted(true);
      setScore(submission.score || 0);
    }
  };

  const startQuiz = () => {
    setIsStarted(true);
    setTimeLeft(exam.duration_minutes * 60);
    startTimeRef.current = Date.now();
  };

  const handleAnswerChange = (questionId: string, selectedOptionId?: string, textAnswer?: string) => {
    setAnswers(prev => prev.map(answer => 
      answer.questionId === questionId 
        ? { ...answer, selectedOptionId, textAnswer }
        : answer
    ));
  };

  const calculateScore = () => {
    let earnedPoints = 0;
    
    answers.forEach(answer => {
      const question = questions.find(q => q.id === answer.questionId);
      if (!question) return;
      
      if (question.question_type === 'multiple_choice' || question.question_type === 'true_false') {
        const selectedOption = options.find(opt => opt.id === answer.selectedOptionId);
        if (selectedOption?.is_correct) {
          earnedPoints += question.points;
        }
      }
      // For short_answer, we'd need manual grading - for now, assume 0 points
    });
    
    return earnedPoints;
  };

  const handleSubmit = async () => {
    if (!user) return;
    
    const finalScore = calculateScore();
    const timeTaken = Math.floor((Date.now() - startTimeRef.current) / (1000 * 60));
    
    const quizAnswers = answers.map(answer => {
      const question = questions.find(q => q.id === answer.questionId);
      const selectedOption = options.find(opt => opt.id === answer.selectedOptionId);
      
      return {
        question_id: answer.questionId,
        selected_option_id: answer.selectedOptionId,
        text_answer: answer.textAnswer,
        is_correct: selectedOption?.is_correct || false,
        points_earned: selectedOption?.is_correct ? (question?.points || 0) : 0
      };
    });

    const success = await submitQuiz(
      {
        exam_id: exam.id,
        student_id: user.id,
        score: finalScore,
        total_points: totalPoints,
        is_completed: true,
        time_taken_minutes: timeTaken
      },
      quizAnswers
    );

    if (success) {
      setIsSubmitted(true);
      setScore(finalScore);
      toast.success("Quiz submitted successfully!");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getQuestionOptions = (questionId: string) => {
    return options.filter(opt => opt.question_id === questionId).sort((a, b) => a.option_order - b.option_order);
  };

  const getCurrentAnswer = (questionId: string) => {
    return answers.find(a => a.questionId === questionId);
  };

  const isAnswered = (questionId: string) => {
    const answer = getCurrentAnswer(questionId);
    return !!(answer?.selectedOptionId || answer?.textAnswer);
  };

  const getAnsweredCount = () => {
    return answers.filter(answer => answer.selectedOptionId || answer.textAnswer).length;
  };

  if (questions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">This quiz has no questions yet.</p>
          <Button onClick={onClose} className="mt-4">Close</Button>
        </CardContent>
      </Card>
    );
  }

  if (isSubmitted) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Award className="h-16 w-16 text-yellow-500" />
          </div>
          <CardTitle className="text-2xl">Quiz Completed!</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="text-4xl font-bold text-primary">
            {score}/{totalPoints} points
          </div>
          <div className="text-xl text-muted-foreground">
            {Math.round(((score || 0) / totalPoints) * 100)}% Score
          </div>
          <Progress value={((score || 0) / totalPoints) * 100} className="w-full max-w-md mx-auto" />
          <Button onClick={onClose} className="mt-6">Close Quiz</Button>
        </CardContent>
      </Card>
    );
  }

  if (!isStarted) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Ready to Start Quiz?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Duration: {exam.duration_minutes} minutes</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{questions.length} Questions</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              <span>Total Points: {totalPoints}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span>Auto-submit when time expires</span>
            </div>
          </div>
          
          <div className="bg-muted/50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Instructions:</h3>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Answer all questions to the best of your ability</li>
              <li>• You can navigate between questions using the buttons</li>
              <li>• Your progress is saved automatically</li>
              <li>• Submit when you're ready or when time runs out</li>
            </ul>
          </div>
          
          <div className="flex gap-2 justify-center">
            <Button onClick={startQuiz} size="lg">Start Quiz</Button>
            <Button onClick={onClose} variant="outline" size="lg">Cancel</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer = getCurrentAnswer(currentQuestion.id);
  const questionOptions = getQuestionOptions(currentQuestion.id);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{exam.title}</h2>
          <p className="text-muted-foreground">
            Question {currentQuestionIndex + 1} of {questions.length}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-lg font-mono">
            <Clock className="h-5 w-5" />
            <span className={timeLeft < 300 ? "text-red-500" : ""}>{formatTime(timeLeft)}</span>
          </div>
          <Button onClick={onClose} variant="outline" size="sm">Exit</Button>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Progress: {getAnsweredCount()}/{questions.length} answered</span>
          <span>{Math.round((getAnsweredCount() / questions.length) * 100)}%</span>
        </div>
        <Progress value={(getAnsweredCount() / questions.length) * 100} />
      </div>

      {/* Question */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Question {currentQuestionIndex + 1}</Badge>
            <Badge>{currentQuestion.question_type.replace('_', ' ').toUpperCase()}</Badge>
            <Badge variant="secondary">{currentQuestion.points} points</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div 
            className="text-lg font-medium prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: currentQuestion.question }}
          />
          
          {currentQuestion.question_type === 'multiple_choice' && (
            <div className="space-y-4">
              {questionOptions.length === 0 ? (
                <div className="text-muted-foreground text-center p-4 border-2 border-dashed border-muted rounded-lg">
                  No options available for this question.
                </div>
              ) : (
                <RadioGroup
                  value={currentAnswer?.selectedOptionId || ""}
                  onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                >
                  {questionOptions.map((option, index) => (
                    <div 
                      key={option.id} 
                      className="flex items-start space-x-4 p-4 border-2 rounded-xl bg-card hover:bg-accent/50 hover:border-primary/50 transition-all duration-200 cursor-pointer group"
                    >
                      <RadioGroupItem 
                        value={option.id} 
                        id={`option-${option.id}`} 
                        className="mt-1 flex-shrink-0"
                      />
                      <label 
                        htmlFor={`option-${option.id}`} 
                        className="flex-1 cursor-pointer flex items-center gap-3"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center text-sm font-semibold text-primary group-hover:bg-primary/20 group-hover:border-primary/50 transition-all">
                          {String.fromCharCode(65 + index)}
                        </div>
                        <span className="text-base leading-relaxed">{option.option_text}</span>
                      </label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </div>
          )}
          
          {currentQuestion.question_type === 'true_false' && (
            <div className="space-y-4">
              {questionOptions.length === 0 ? (
                <div className="text-muted-foreground text-center p-4 border-2 border-dashed border-muted rounded-lg">
                  No options available for this question.
                </div>
              ) : (
                <RadioGroup
                  value={currentAnswer?.selectedOptionId || ""}
                  onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                >
                  {questionOptions.map((option) => (
                    <div 
                      key={option.id} 
                      className="flex items-center space-x-4 p-4 border-2 rounded-xl bg-card hover:bg-accent/50 hover:border-primary/50 transition-all duration-200 cursor-pointer"
                    >
                      <RadioGroupItem 
                        value={option.id} 
                        id={`tf-option-${option.id}`} 
                        className="flex-shrink-0"
                      />
                      <label 
                        htmlFor={`tf-option-${option.id}`} 
                        className="flex-1 cursor-pointer text-base font-medium"
                      >
                        {option.option_text}
                      </label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </div>
          )}
          
          {currentQuestion.question_type === 'short_answer' && (
            <Textarea
              placeholder="Enter your answer here..."
              value={currentAnswer?.textAnswer || ""}
              onChange={(e) => handleAnswerChange(currentQuestion.id, undefined, e.target.value)}
              rows={4}
            />
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
            disabled={currentQuestionIndex === 0}
            variant="outline"
          >
            Previous
          </Button>
          <Button
            onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
            disabled={currentQuestionIndex === questions.length - 1}
            variant="outline"
          >
            Next
          </Button>
        </div>
        
        <div className="flex gap-2">
          <span className="text-sm text-muted-foreground self-center">
            {isAnswered(currentQuestion.id) ? (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle className="h-4 w-4" />
                Answered
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <XCircle className="h-4 w-4" />
                Not answered
              </span>
            )}
          </span>
          <Button onClick={handleSubmit} disabled={getAnsweredCount() === 0}>
            Submit Quiz
          </Button>
        </div>
      </div>

      {/* Question Navigation */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-2">
            {questions.map((_, index) => (
              <Button
                key={index}
                variant={currentQuestionIndex === index ? "default" : "outline"}
                size="sm"
                className={`w-10 h-10 p-0 ${
                  isAnswered(questions[index].id) 
                    ? "border-green-500 bg-green-50 text-green-700" 
                    : ""
                }`}
                onClick={() => setCurrentQuestionIndex(index)}
              >
                {index + 1}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QuizTaker;
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Save, Edit2 } from "lucide-react";
import { useCourses, QuizQuestion, QuizOption } from "@/contexts/CourseContext";
import { toast } from "sonner";
import RichTextEditor from "@/components/RichTextEditor";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface QuizBuilderProps {
  examId: string;
  onClose: () => void;
}

const QuizBuilder = ({ examId, onClose }: QuizBuilderProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { 
    addQuizQuestion, 
    addQuizOption, 
    updateQuizQuestion, 
    deleteQuizQuestion,
    getQuizQuestions, 
    getQuizOptions 
  } = useCourses();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [options, setOptions] = useState<QuizOption[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState({
    question: "",
    question_type: "multiple_choice" as const,
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

  useEffect(() => {
    loadQuestions();
  }, [examId]);

  const loadQuestions = () => {
    const quizQuestions = getQuizQuestions(examId);
    setQuestions(quizQuestions);
    
    // Load all options for these questions
    const allOptions: QuizOption[] = [];
    quizQuestions.forEach(q => {
      const questionOptions = getQuizOptions(q.id);
      allOptions.push(...questionOptions);
    });
    setOptions(allOptions);
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
      toast.error("Please enter a question");
      return;
    }

    if (currentQuestion.question_type === 'multiple_choice') {
      const validOptions = currentOptions.filter(opt => opt.option_text.trim());
      const correctOptions = validOptions.filter(opt => opt.is_correct);
      
      if (validOptions.length < 2) {
        toast.error("Please add at least 2 options");
        return;
      }
      
      if (correctOptions.length === 0) {
        toast.error("Please mark at least one correct answer");
        return;
      }
    }

    try {
      const success = await addQuizQuestion({
        exam_id: examId,
        question: currentQuestion.question,
        question_type: currentQuestion.question_type,
        points: currentQuestion.points,
        question_order: currentQuestion.question_order
      });

      if (success) {
        // Reload questions to get the new question with ID
        loadQuestions();
        
        // Add options for multiple choice or true/false
        if (currentQuestion.question_type === 'multiple_choice') {
          const newQuestions = getQuizQuestions(examId);
          const newQuestion = newQuestions.find(q => q.question === currentQuestion.question);
          
          if (newQuestion) {
            const validOptions = currentOptions.filter(opt => opt.option_text.trim());
            for (const option of validOptions) {
              await addQuizOption({
                question_id: newQuestion.id,
                option_text: option.option_text,
                is_correct: option.is_correct,
                option_order: option.option_order
              });
            }
            loadQuestions(); // Reload to get options
          }
        } else if (currentQuestion.question_type === 'true_false') {
          const newQuestions = getQuizQuestions(examId);
          const newQuestion = newQuestions.find(q => q.question === currentQuestion.question);
          
          if (newQuestion) {
            for (const option of currentOptions.filter(opt => opt.option_text)) {
              await addQuizOption({
                question_id: newQuestion.id,
                option_text: option.option_text,
                is_correct: option.is_correct,
                option_order: option.option_order
              });
            }
            loadQuestions(); // Reload to get options
          }
        }
        
        resetForm();
        toast.success("Question added successfully");
      }
    } catch (error) {
      toast.error("Failed to add question");
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    const success = await deleteQuizQuestion(questionId);
    if (success) {
      loadQuestions();
      toast.success("Question deleted");
    }
  };

  const handleOptionChange = (index: number, field: keyof typeof currentOptions[0], value: string | boolean) => {
    const newOptions = [...currentOptions];
    if (field === 'is_correct' && value === true) {
      // For single correct answer, uncheck others
      newOptions.forEach((opt, i) => {
        opt.is_correct = i === index;
      });
    } else {
      (newOptions[index] as any)[field] = value;
    }
    setCurrentOptions(newOptions);
  };

  const getQuestionOptions = (questionId: string) => {
    return options.filter(opt => opt.question_id === questionId).sort((a, b) => a.option_order - b.option_order);
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Build Quiz
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quiz Builder</DialogTitle>
          <DialogDescription>
            Create and manage quiz questions for this exam.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Add Question Form */}
          <Card>
            <CardHeader>
              <CardTitle>{editingQuestionId ? "Edit Question" : "Add New Question"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="question">Question</Label>
                <RichTextEditor
                  content={currentQuestion.question}
                  onChange={(content) => setCurrentQuestion(prev => ({ ...prev, question: content }))}
                  placeholder="Enter your question here... You can add formatting, images, and links."
                  className="min-h-[150px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="questionType">Question Type</Label>
                  <Select 
                    value={currentQuestion.question_type} 
                    onValueChange={(value: any) => setCurrentQuestion(prev => ({ ...prev, question_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                      <SelectItem value="true_false">True/False</SelectItem>
                      <SelectItem value="short_answer">Short Answer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="points">Points</Label>
                  <Input
                    id="points"
                    type="number"
                    min="1"
                    max="10"
                    value={currentQuestion.points}
                    onChange={(e) => setCurrentQuestion(prev => ({ ...prev, points: parseInt(e.target.value) || 1 }))}
                  />
                </div>
              </div>

              {currentQuestion.question_type === 'multiple_choice' && (
                <div className="space-y-3">
                  <Label>Answer Options</Label>
                  <RadioGroup className="space-y-2">
                    {currentOptions.map((option, index) => (
                      <div key={index} className="flex items-center space-x-3 p-3 border rounded-lg">
                        <RadioGroupItem
                          value={index.toString()}
                          checked={option.is_correct}
                          onClick={() => handleOptionChange(index, 'is_correct', !option.is_correct)}
                        />
                        <Input
                          placeholder={`Option ${index + 1}`}
                          value={option.option_text}
                          onChange={(e) => handleOptionChange(index, 'option_text', e.target.value)}
                          className="flex-1"
                        />
                        <Badge variant={option.is_correct ? "default" : "secondary"}>
                          {option.is_correct ? "Correct" : "Incorrect"}
                        </Badge>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              )}

              {(currentQuestion.question_type as string) === 'true_false' && (
                <div className="space-y-2">
                  <Label>Correct Answer</Label>
                  <Select 
                    value={currentOptions.find(opt => opt.is_correct)?.option_text?.toLowerCase() || "true"} 
                    onValueChange={(value) => {
                      setCurrentOptions([
                        { option_text: "True", is_correct: value === "true", option_order: 1 },
                        { option_text: "False", is_correct: value === "false", option_order: 2 }
                      ]);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">True</SelectItem>
                      <SelectItem value="false">False</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={handleAddQuestion} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  {editingQuestionId ? "Update Question" : "Add Question"}
                </Button>
                {editingQuestionId && (
                  <Button onClick={resetForm} variant="outline">
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Questions List */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Questions ({questions.length})</h3>
            {questions.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No questions added yet. Add your first question above.
                </CardContent>
              </Card>
            ) : (
              questions
                .sort((a, b) => a.question_order - b.question_order)
                .map((question, index) => (
                  <Card key={question.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">Q{index + 1}</Badge>
                            <Badge>{question.question_type.replace('_', ' ').toUpperCase()}</Badge>
                            <Badge variant="secondary">{question.points} pts</Badge>
                          </div>
                          <div 
                            className="font-medium mb-3 prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: question.question }}
                          />
                          
                          {question.question_type === 'multiple_choice' && (
                            <div className="space-y-1">
                              {getQuestionOptions(question.id).map((option, optIndex) => (
                                <div key={option.id} className="flex items-center gap-2 text-sm">
                                  <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">
                                    {String.fromCharCode(65 + optIndex)}
                                  </span>
                                  <span className={option.is_correct ? "font-medium text-green-600" : ""}>
                                    {option.option_text}
                                  </span>
                                  {option.is_correct && (
                                    <Badge variant="default" className="text-xs">Correct</Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {question.question_type === 'true_false' && (
                            <div className="text-sm">
                              <span className="font-medium text-green-600">
                                Correct Answer: {getQuestionOptions(question.id).find(opt => opt.is_correct)?.option_text || "Not set"}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteQuestion(question.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
            )}
          </div>
          
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button onClick={() => setIsDialogOpen(false)} variant="outline">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuizBuilder;
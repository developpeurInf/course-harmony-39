import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Save, Edit2, Settings } from "lucide-react";
import { useCourses, QuizQuestion, QuizOption } from "@/contexts/CourseContext";
import { toast } from "sonner";
import RichTextEditor from "@/components/RichTextEditor";
import QuizSettings, { QuizSettings as QuizSettingsType } from "@/components/QuizSettings";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
      const newQuestion = await addQuizQuestion({
        exam_id: examId,
        question: currentQuestion.question,
        question_type: currentQuestion.question_type,
        points: currentQuestion.points,
        question_order: currentQuestion.question_order
      });

      if (newQuestion) {
        // Add options for multiple choice or true/false
        if (currentQuestion.question_type === 'multiple_choice') {
          const validOptions = currentOptions.filter(opt => opt.option_text.trim());
          console.log('Saving multiple choice options:', validOptions);
          
          for (const option of validOptions) {
            const optionSaved = await addQuizOption({
              question_id: newQuestion.id,
              option_text: option.option_text,
              is_correct: option.is_correct,
              option_order: option.option_order
            });
            console.log('Option saved:', option.option_text, optionSaved);
          }
        } else if (currentQuestion.question_type === 'true_false') {
          const tfOptions = currentOptions.filter(opt => opt.option_text);
          console.log('Saving true/false options:', tfOptions);
          
          for (const option of tfOptions) {
            const optionSaved = await addQuizOption({
              question_id: newQuestion.id,
              option_text: option.option_text,
              is_correct: option.is_correct,
              option_order: option.option_order
            });
            console.log('Option saved:', option.option_text, optionSaved);
          }
        }
        
        // Reload questions to get the latest data including options
        loadQuestions();
        resetForm();
        toast.success("Question added successfully");
      }
    } catch (error) {
      console.error('Error adding question:', error);
      toast.error("Failed to add question");
    }
  };

  const handleUpdateQuestion = async () => {
    if (!editingQuestionId) return;
    
    const success = await updateQuizQuestion(editingQuestionId, {
      question: currentQuestion.question,
      points: currentQuestion.points
    });
    
    if (success) {
      loadQuestions();
      resetForm();
      toast.success("Question updated successfully");
    }
  };

  const handleEditQuestion = (question: QuizQuestion) => {
    setCurrentQuestion({
      question: question.question,
      question_type: question.question_type,
      points: question.points,
      question_order: question.question_order
    });
    
    // Load current options for editing
    const questionOptions = getQuestionOptions(question.id);
    if (question.question_type === 'multiple_choice') {
      const editOptions = [...Array(4)].map((_, index) => {
        const existingOption = questionOptions[index];
        return existingOption || { option_text: "", is_correct: false, option_order: index + 1 };
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
    const success = await deleteQuizQuestion(questionId);
    if (success) {
      loadQuestions();
      toast.success("Question deleted");
    }
  };

  const getQuestionOptions = (questionId: string) => {
    return options.filter(opt => opt.question_id === questionId).sort((a, b) => a.option_order - b.option_order);
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button onClick={() => setIsDialogOpen(true)} className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-lg">
          <Edit2 className="h-4 w-4 mr-2" />
          Edit Quiz Questions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl font-bold text-primary">Quiz Builder</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Create questions and configure quiz settings
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          <Tabs defaultValue="questions" className="h-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="questions">Questions</TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="questions" className="mt-4 space-y-6">
              {/* Questions List */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Quiz Questions</h3>
                {questions.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-muted-foreground">No questions added yet</p>
                    <p className="text-sm text-muted-foreground mt-1">Add your first question below</p>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {questions.map((question, index) => (
                      <Card key={question.id} className="p-5 border-l-4 border-l-primary/30 hover:border-l-primary transition-colors">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-3">
                              <Badge variant="outline" className="text-primary border-primary/50">Q{index + 1}</Badge>
                              <Badge variant="secondary">{question.question_type.replace('_', ' ')}</Badge>
                              <Badge className="bg-primary/10 text-primary">{question.points} points</Badge>
                            </div>
                            <div 
                              className="prose prose-sm max-w-none mb-3 text-foreground"
                              dangerouslySetInnerHTML={{ __html: question.question }}
                            />
                            {/* Show options for multiple choice questions */}
                            {question.question_type === 'multiple_choice' && (
                              <div className="space-y-2 ml-4 mt-3">
                                {getQuestionOptions(question.id).map((option, optIndex) => (
                                  <div key={option.id} className={`text-sm flex items-center gap-2 p-2 rounded-md ${option.is_correct ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-muted/30 text-muted-foreground'}`}>
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${option.is_correct ? 'bg-green-200' : 'bg-muted'}`}>
                                      {String.fromCharCode(65 + optIndex)}
                                    </span>
                                    {option.option_text}
                                    {option.is_correct && <Badge variant="outline" className="ml-auto text-xs">Correct</Badge>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditQuestion(question)}
                              className="hover:bg-primary hover:text-primary-foreground"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteQuestion(question.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Question Form */}
              <Card className="p-6 bg-gradient-to-br from-background to-muted/20 border-2">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Plus className="h-5 w-5 text-primary" />
                  {editingQuestionId ? "Edit Question" : "Add New Question"}
                </h3>
                
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="question-type" className="text-sm font-medium">Question Type</Label>
                      <Select
                        value={currentQuestion.question_type}
                        onValueChange={(value: any) => 
                          setCurrentQuestion(prev => ({ ...prev, question_type: value }))
                        }
                      >
                        <SelectTrigger className="border-2">
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
                      <Label htmlFor="points" className="text-sm font-medium">Points</Label>
                      <Input
                        id="points"
                        type="number"
                        min="1"
                        value={currentQuestion.points}
                        onChange={(e) => setCurrentQuestion(prev => ({ 
                          ...prev, 
                          points: parseInt(e.target.value) || 1 
                        }))}
                        className="border-2"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="question" className="text-sm font-medium">Question</Label>
                    <div className="border-2 rounded-md">
                      <RichTextEditor
                        content={currentQuestion.question}
                        onChange={(content) => setCurrentQuestion(prev => ({ 
                          ...prev, 
                          question: content 
                        }))}
                      />
                    </div>
                  </div>

                  {/* Options for multiple choice */}
                  {currentQuestion.question_type === 'multiple_choice' && (
                    <div className="space-y-4">
                      <Label className="text-sm font-medium">Answer Options</Label>
                      {currentOptions.map((option, index) => (
                        <div key={index} className="flex items-center gap-3 p-4 border-2 rounded-lg bg-background">
                          <span className="w-8 h-8 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                            {String.fromCharCode(65 + index)}
                          </span>
                          <Input
                            placeholder={`Option ${String.fromCharCode(65 + index)}`}
                            value={option.option_text}
                            onChange={(e) => {
                              const newOptions = [...currentOptions];
                              newOptions[index] = { ...option, option_text: e.target.value };
                              setCurrentOptions(newOptions);
                            }}
                            className="flex-1"
                          />
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`correct-${index}`}
                              checked={option.is_correct}
                              onChange={(e) => {
                                const newOptions = [...currentOptions];
                                newOptions[index] = { ...option, is_correct: e.target.checked };
                                setCurrentOptions(newOptions);
                              }}
                              className="rounded border-2"
                            />
                            <Label htmlFor={`correct-${index}`} className="text-sm font-medium">Correct</Label>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Options for true/false */}
                  {currentQuestion.question_type === 'true_false' && (
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Correct Answer</Label>
                      <RadioGroup
                        value={currentOptions.find(opt => opt.is_correct)?.option_text || ""}
                        onValueChange={(value) => {
                          setCurrentOptions([
                            { option_text: "True", is_correct: value === "True", option_order: 1 },
                            { option_text: "False", is_correct: value === "False", option_order: 2 }
                          ]);
                        }}
                        className="grid grid-cols-2 gap-4"
                      >
                        <div className="flex items-center space-x-2 p-3 border-2 rounded-lg">
                          <RadioGroupItem value="True" id="true" />
                          <Label htmlFor="true" className="font-medium">True</Label>
                        </div>
                        <div className="flex items-center space-x-2 p-3 border-2 rounded-lg">
                          <RadioGroupItem value="False" id="false" />
                          <Label htmlFor="false" className="font-medium">False</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  )}

                  <div className="flex justify-between pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={resetForm}
                      className="border-2"
                    >
                      {editingQuestionId ? "Cancel Edit" : "Clear Form"}
                    </Button>
                    <Button 
                      onClick={editingQuestionId ? handleUpdateQuestion : handleAddQuestion}
                      className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {editingQuestionId ? "Update Question" : "Add Question"}
                    </Button>
                  </div>
                </div>
              </Card>
            </TabsContent>
            
            <TabsContent value="settings" className="mt-4">
              <QuizSettings onSettingsChange={setQuizSettings} />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuizBuilder;
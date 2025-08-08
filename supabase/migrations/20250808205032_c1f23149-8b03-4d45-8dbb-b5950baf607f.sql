-- Add exam types and quiz functionality

-- Add exam type enum
CREATE TYPE exam_type AS ENUM ('exam', 'quiz');

-- Add type column to exams table
ALTER TABLE exams 
ADD COLUMN type exam_type NOT NULL DEFAULT 'exam';

-- Create quiz questions table
CREATE TABLE quiz_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id UUID NOT NULL,
  question TEXT NOT NULL,
  question_order INTEGER NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice', -- multiple_choice, true_false, short_answer
  points INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quiz options table (for multiple choice questions)
CREATE TABLE quiz_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  option_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quiz submissions table
CREATE TABLE quiz_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id UUID NOT NULL,
  student_id UUID NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  score DECIMAL(5,2),
  total_points INTEGER,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  time_taken_minutes INTEGER
);

-- Create quiz answers table
CREATE TABLE quiz_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL,
  question_id UUID NOT NULL,
  selected_option_id UUID,
  text_answer TEXT,
  is_correct BOOLEAN,
  points_earned DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all quiz tables
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;

-- RLS policies for quiz_questions
CREATE POLICY "Quiz questions viewable by everyone" 
ON quiz_questions FOR SELECT 
USING (true);

CREATE POLICY "Professors can manage quiz questions for their exams" 
ON quiz_questions FOR ALL 
USING (auth.uid() IN (
  SELECT c.professor_id 
  FROM courses c 
  JOIN exams e ON c.id = e.course_id 
  WHERE e.id = quiz_questions.exam_id
));

-- RLS policies for quiz_options
CREATE POLICY "Quiz options viewable by everyone" 
ON quiz_options FOR SELECT 
USING (true);

CREATE POLICY "Professors can manage quiz options for their questions" 
ON quiz_options FOR ALL 
USING (auth.uid() IN (
  SELECT c.professor_id 
  FROM courses c 
  JOIN exams e ON c.id = e.course_id 
  JOIN quiz_questions qq ON e.id = qq.exam_id 
  WHERE qq.id = quiz_options.question_id
));

-- RLS policies for quiz_submissions
CREATE POLICY "Students can view their own quiz submissions" 
ON quiz_submissions FOR SELECT 
USING (auth.uid() = student_id);

CREATE POLICY "Students can create their own quiz submissions" 
ON quiz_submissions FOR INSERT 
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update their own quiz submissions" 
ON quiz_submissions FOR UPDATE 
USING (auth.uid() = student_id);

CREATE POLICY "Professors can view quiz submissions for their exams" 
ON quiz_submissions FOR SELECT 
USING (auth.uid() IN (
  SELECT c.professor_id 
  FROM courses c 
  JOIN exams e ON c.id = e.course_id 
  WHERE e.id = quiz_submissions.exam_id
));

-- RLS policies for quiz_answers
CREATE POLICY "Students can view their own quiz answers" 
ON quiz_answers FOR SELECT 
USING (auth.uid() IN (
  SELECT qs.student_id 
  FROM quiz_submissions qs 
  WHERE qs.id = quiz_answers.submission_id
));

CREATE POLICY "Students can create their own quiz answers" 
ON quiz_answers FOR INSERT 
WITH CHECK (auth.uid() IN (
  SELECT qs.student_id 
  FROM quiz_submissions qs 
  WHERE qs.id = quiz_answers.submission_id
));

CREATE POLICY "Students can update their own quiz answers" 
ON quiz_answers FOR UPDATE 
USING (auth.uid() IN (
  SELECT qs.student_id 
  FROM quiz_submissions qs 
  WHERE qs.id = quiz_answers.submission_id
));

CREATE POLICY "Professors can view quiz answers for their exams" 
ON quiz_answers FOR SELECT 
USING (auth.uid() IN (
  SELECT c.professor_id 
  FROM courses c 
  JOIN exams e ON c.id = e.course_id 
  JOIN quiz_submissions qs ON e.id = qs.exam_id 
  WHERE qs.id = quiz_answers.submission_id
));

-- Add triggers for updated_at
CREATE TRIGGER update_quiz_questions_updated_at
  BEFORE UPDATE ON quiz_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add foreign key constraints
ALTER TABLE quiz_questions 
ADD CONSTRAINT fk_quiz_questions_exam 
FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;

ALTER TABLE quiz_options 
ADD CONSTRAINT fk_quiz_options_question 
FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE;

ALTER TABLE quiz_submissions 
ADD CONSTRAINT fk_quiz_submissions_exam 
FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;

ALTER TABLE quiz_answers 
ADD CONSTRAINT fk_quiz_answers_submission 
FOREIGN KEY (submission_id) REFERENCES quiz_submissions(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_quiz_answers_question 
FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_quiz_answers_option 
FOREIGN KEY (selected_option_id) REFERENCES quiz_options(id) ON DELETE SET NULL;
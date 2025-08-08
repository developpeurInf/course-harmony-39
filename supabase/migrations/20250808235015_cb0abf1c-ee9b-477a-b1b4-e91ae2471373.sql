-- Set up cascade delete constraints for room deletion
-- This will ensure that when a room is deleted, all related data is cleaned up

-- First, let's add the foreign key constraints properly with CASCADE DELETE
-- We need to drop existing constraints and recreate them with CASCADE

-- Add foreign key constraint for courses -> rooms with CASCADE DELETE
ALTER TABLE public.courses 
DROP CONSTRAINT IF EXISTS courses_room_id_fkey;

ALTER TABLE public.courses 
ADD CONSTRAINT courses_room_id_fkey 
FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;

-- Add foreign key constraint for enrollments -> courses with CASCADE DELETE
ALTER TABLE public.enrollments 
DROP CONSTRAINT IF EXISTS enrollments_course_id_fkey;

ALTER TABLE public.enrollments 
ADD CONSTRAINT enrollments_course_id_fkey 
FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;

-- Add foreign key constraint for exercises -> courses with CASCADE DELETE
ALTER TABLE public.exercises 
DROP CONSTRAINT IF EXISTS exercises_course_id_fkey;

ALTER TABLE public.exercises 
ADD CONSTRAINT exercises_course_id_fkey 
FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;

-- Add foreign key constraint for exams -> courses with CASCADE DELETE
ALTER TABLE public.exams 
DROP CONSTRAINT IF EXISTS exams_course_id_fkey;

ALTER TABLE public.exams 
ADD CONSTRAINT exams_course_id_fkey 
FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;

-- Add foreign key constraint for course_materials -> courses with CASCADE DELETE
ALTER TABLE public.course_materials 
DROP CONSTRAINT IF EXISTS course_materials_course_id_fkey;

ALTER TABLE public.course_materials 
ADD CONSTRAINT course_materials_course_id_fkey 
FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;

-- Add foreign key constraint for quiz_questions -> exams with CASCADE DELETE
ALTER TABLE public.quiz_questions 
DROP CONSTRAINT IF EXISTS quiz_questions_exam_id_fkey;

ALTER TABLE public.quiz_questions 
ADD CONSTRAINT quiz_questions_exam_id_fkey 
FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;

-- Add foreign key constraint for quiz_options -> quiz_questions with CASCADE DELETE
ALTER TABLE public.quiz_options 
DROP CONSTRAINT IF EXISTS quiz_options_question_id_fkey;

ALTER TABLE public.quiz_options 
ADD CONSTRAINT quiz_options_question_id_fkey 
FOREIGN KEY (question_id) REFERENCES public.quiz_questions(id) ON DELETE CASCADE;

-- Add foreign key constraint for quiz_submissions -> exams with CASCADE DELETE
ALTER TABLE public.quiz_submissions 
DROP CONSTRAINT IF EXISTS quiz_submissions_exam_id_fkey;

ALTER TABLE public.quiz_submissions 
ADD CONSTRAINT quiz_submissions_exam_id_fkey 
FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;

-- Add foreign key constraint for quiz_answers -> quiz_submissions with CASCADE DELETE
ALTER TABLE public.quiz_answers 
DROP CONSTRAINT IF EXISTS quiz_answers_submission_id_fkey;

ALTER TABLE public.quiz_answers 
ADD CONSTRAINT quiz_answers_submission_id_fkey 
FOREIGN KEY (submission_id) REFERENCES public.quiz_submissions(id) ON DELETE CASCADE;

-- Add foreign key constraint for quiz_answers -> quiz_questions with CASCADE DELETE
ALTER TABLE public.quiz_answers 
DROP CONSTRAINT IF EXISTS quiz_answers_question_id_fkey;

ALTER TABLE public.quiz_answers 
ADD CONSTRAINT quiz_answers_question_id_fkey 
FOREIGN KEY (question_id) REFERENCES public.quiz_questions(id) ON DELETE CASCADE;
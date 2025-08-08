
import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth, UserProfile, UserRole } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Types
export interface Room {
  id: string;
  name: string;
  description: string;
  professor_id: string;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  is_visible: boolean;
  professor_id: string;
  room_id?: string;
  pdf_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Exercise {
  id: string;
  course_id: string;
  title: string;
  description: string;
  due_date: string;
  is_visible: boolean;
  pdf_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Exam {
  id: string;
  course_id: string;
  title: string;
  description: string;
  exam_date: string;
  duration_minutes: number;
  is_visible: boolean;
  pdf_url?: string;
  type: 'exam' | 'quiz';
  created_at: string;
  updated_at: string;
}

export interface QuizQuestion {
  id: string;
  exam_id: string;
  question: string;
  question_order: number;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer';
  points: number;
  created_at: string;
  updated_at: string;
}

export interface QuizOption {
  id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean;
  option_order: number;
  created_at: string;
}

export interface QuizSubmission {
  id: string;
  exam_id: string;
  student_id: string;
  submitted_at: string;
  score?: number;
  total_points?: number;
  is_completed: boolean;
  time_taken_minutes?: number;
}

export interface QuizAnswer {
  id: string;
  submission_id: string;
  question_id: string;
  selected_option_id?: string;
  text_answer?: string;
  is_correct?: boolean;
  points_earned?: number;
  created_at: string;
}

export interface Enrollment {
  id: string;
  student_id: string;
  course_id: string;
  enrolled_at: string;
}

// Context type
interface CourseContextType {
  rooms: Room[];
  courses: Course[];
  exercises: Exercise[];
  exams: Exam[];
  enrollments: Enrollment[];
  quizQuestions: QuizQuestion[];
  quizOptions: QuizOption[];
  quizSubmissions: QuizSubmission[];
  quizAnswers: QuizAnswer[];
  loading: boolean;
  
  // Room operations
  addRoom: (room: Omit<Room, "id" | "created_at" | "updated_at" | "professor_id">) => Promise<boolean>;
  updateRoom: (roomId: string, updates: Partial<Room>) => Promise<boolean>;
  deleteRoom: (roomId: string) => Promise<boolean>;
  toggleRoomVisibility: (roomId: string) => Promise<boolean>;
  
  // Course operations
  addCourse: (course: Omit<Course, "id" | "created_at" | "updated_at" | "professor_id">) => Promise<boolean>;
  updateCourse: (courseId: string, updates: Partial<Course>) => Promise<boolean>;
  deleteCourse: (courseId: string) => Promise<boolean>;
  toggleCourseVisibility: (courseId: string) => Promise<boolean>;
  uploadCoursePdf: (courseId: string, file: File) => Promise<string | null>;
  
  // Exercise operations
  addExercise: (exercise: Omit<Exercise, "id" | "created_at" | "updated_at">) => Promise<boolean>;
  updateExercise: (exerciseId: string, updates: Partial<Exercise>) => Promise<boolean>;
  deleteExercise: (exerciseId: string) => Promise<boolean>;
  toggleExerciseVisibility: (exerciseId: string) => Promise<boolean>;
  uploadExercisePdf: (exerciseId: string, file: File) => Promise<string | null>;
  
  // Exam operations
  addExam: (exam: Omit<Exam, "id" | "created_at" | "updated_at">) => Promise<boolean>;
  updateExam: (examId: string, updates: Partial<Exam>) => Promise<boolean>;
  deleteExam: (examId: string) => Promise<boolean>;
  toggleExamVisibility: (examId: string) => Promise<boolean>;
  uploadExamPdf: (examId: string, file: File) => Promise<string | null>;
  
  // Quiz operations
  addQuizQuestion: (question: Omit<QuizQuestion, "id" | "created_at" | "updated_at">) => Promise<boolean>;
  addQuizOption: (option: Omit<QuizOption, "id" | "created_at">) => Promise<boolean>;
  updateQuizQuestion: (questionId: string, updates: Partial<QuizQuestion>) => Promise<boolean>;
  deleteQuizQuestion: (questionId: string) => Promise<boolean>;
  getQuizQuestions: (examId: string) => QuizQuestion[];
  getQuizOptions: (questionId: string) => QuizOption[];
  submitQuiz: (submission: Omit<QuizSubmission, "id" | "submitted_at">, answers: Omit<QuizAnswer, "id" | "submission_id" | "created_at">[]) => Promise<boolean>;
  getQuizSubmissions: (examId: string) => QuizSubmission[];
  getStudentQuizSubmission: (examId: string, studentId: string) => QuizSubmission | null;
  
  // Enrollment operations
  enrollStudent: (courseId: string, studentId: string) => Promise<boolean>;
  unenrollStudent: (courseId: string, studentId: string) => Promise<boolean>;
  removeEnrollment: (enrollmentId: string) => Promise<boolean>;
  getEnrolledStudents: (courseId: string) => Promise<UserProfile[]>;
  getStudentCourses: (studentId: string) => Course[];
  getVisibleCoursesForStudent: (studentId: string) => Course[];
  getVisibleExercisesForStudent: (studentId: string) => Exercise[];
  getVisibleExamsForStudent: (studentId: string) => Exam[];
  
  // Utility functions
  refreshData: (roomId?: string) => Promise<void>;
}

const CourseContext = createContext<CourseContextType | undefined>(undefined);

export function CourseProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizOptions, setQuizOptions] = useState<QuizOption[]>([]);
  const [quizSubmissions, setQuizSubmissions] = useState<QuizSubmission[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswer[]>([]);
  const [loading, setLoading] = useState(false);

  // Load initial data
  useEffect(() => {
    if (user) {
      refreshData();
    }
  }, [user]);

  const refreshData = async (roomId?: string) => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch rooms first - always get all rooms for the professor
      let roomsQuery = supabase.from('rooms').select('*').order('created_at', { ascending: false });
      if (user.role === 'professor') {
        roomsQuery = roomsQuery.eq('professor_id', user.id);
      }
      
      // For courses, exercises, and exams - filter by room if provided
      let coursesQuery = supabase.from('courses').select('*').order('created_at', { ascending: false });
      let exercisesQuery = supabase.from('exercises').select('*').order('created_at', { ascending: false });
      let examsQuery = supabase.from('exams').select('*').order('created_at', { ascending: false });
      
      if (roomId) {
        // Clear previous data when filtering by room to prevent stale data
        setCourses([]);
        setExercises([]);
        setExams([]);
        
        // Filter courses by room
        coursesQuery = coursesQuery.eq('room_id', roomId);
        
        // For exercises and exams, we need to join with courses to filter by room
        exercisesQuery = supabase
          .from('exercises')
          .select(`
            *,
            courses!inner (
              room_id
            )
          `)
          .eq('courses.room_id', roomId)
          .order('created_at', { ascending: false });
          
        examsQuery = supabase
          .from('exams')
          .select(`
            *,
            courses!inner (
              room_id
            )
          `)
          .eq('courses.room_id', roomId)
          .order('created_at', { ascending: false });
      }
      
      // Fetch all data in parallel
      const [roomsData, coursesData, exercisesData, examsData, enrollmentsData, questionsData, optionsData, submissionsData, answersData] = await Promise.all([
        roomsQuery,
        coursesQuery,
        exercisesQuery,
        examsQuery,
        supabase.from('enrollments').select('*'),
        supabase.from('quiz_questions').select('*').order('question_order', { ascending: true }),
        supabase.from('quiz_options').select('*').order('option_order', { ascending: true }),
        supabase.from('quiz_submissions').select('*').order('submitted_at', { ascending: false }),
        supabase.from('quiz_answers').select('*')
      ]);

      if (roomsData.error) console.error('Rooms fetch error:', roomsData.error);
      else setRooms(roomsData.data || []);

      if (coursesData.error) console.error('Courses fetch error:', coursesData.error);
      else setCourses(coursesData.data || []);

      if (exercisesData.error) console.error('Exercises fetch error:', exercisesData.error);
      else {
        // Clean up the exercises data if it came from a join query
        const cleanExercises = (exercisesData.data || []).map((exercise: any) => {
          if (exercise.courses) {
            const { courses, ...cleanExercise } = exercise;
            return cleanExercise;
          }
          return exercise;
        });
        setExercises(cleanExercises);
      }

      if (examsData.error) console.error('Exams fetch error:', examsData.error);
      else {
        // Clean up the exams data if it came from a join query
        const cleanExams = (examsData.data || []).map((exam: any) => {
          if (exam.courses) {
            const { courses, ...cleanExam } = exam;
            return cleanExam;
          }
          return exam;
        });
        setExams(cleanExams);
      }

      if (enrollmentsData.error) console.error('Enrollments fetch error:', enrollmentsData.error);
      else setEnrollments(enrollmentsData.data || []);

      if (questionsData.error) console.error('Quiz questions fetch error:', questionsData.error);
      else setQuizQuestions((questionsData.data || []) as QuizQuestion[]);

      if (optionsData.error) console.error('Quiz options fetch error:', optionsData.error);
      else setQuizOptions(optionsData.data || []);

      if (submissionsData.error) console.error('Quiz submissions fetch error:', submissionsData.error);
      else setQuizSubmissions(submissionsData.data || []);

      if (answersData.error) console.error('Quiz answers fetch error:', answersData.error);
      else setQuizAnswers(answersData.data || []);

    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Room operations
  const addRoom = async (room: Omit<Room, "id" | "created_at" | "updated_at" | "professor_id">): Promise<boolean> => {
    if (!user || user.role !== "professor") {
      toast.error("Only professors can add rooms");
      return false;
    }

    try {
      const { data, error } = await supabase
        .from('rooms')
        .insert([{
          ...room,
          professor_id: user.id
        }])
        .select()
        .single();

      if (error) {
        toast.error("Failed to add room");
        return false;
      }

      setRooms(prev => [data, ...prev]);
      toast.success("Room added successfully");
      return true;
    } catch (error) {
      toast.error("Failed to add room");
      return false;
    }
  };

  const updateRoom = async (roomId: string, updates: Partial<Room>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('rooms')
        .update(updates)
        .eq('id', roomId);

      if (error) {
        toast.error("Failed to update room");
        return false;
      }

      setRooms(prev => prev.map(room => 
        room.id === roomId ? { ...room, ...updates } : room
      ));
      toast.success("Room updated successfully");
      return true;
    } catch (error) {
      toast.error("Failed to update room");
      return false;
    }
  };

  const deleteRoom = async (roomId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', roomId);

      if (error) {
        toast.error("Failed to delete room");
        return false;
      }

      setRooms(prev => prev.filter(room => room.id !== roomId));
      toast.success("Room deleted successfully");
      return true;
    } catch (error) {
      toast.error("Failed to delete room");
      return false;
    }
  };

  const toggleRoomVisibility = async (roomId: string): Promise<boolean> => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return false;

    return await updateRoom(roomId, { is_visible: !room.is_visible });
  };

  // Course operations
  const addCourse = async (course: Omit<Course, "id" | "created_at" | "updated_at" | "professor_id">): Promise<boolean> => {
    if (!user || user.role !== "professor") {
      toast.error("Only professors can add courses");
      return false;
    }

    try {
      const { data, error } = await supabase
        .from('courses')
        .insert([{
          ...course,
          professor_id: user.id
        }])
        .select()
        .single();

      if (error) {
        toast.error("Failed to add course");
        return false;
      }

      setCourses(prev => [data, ...prev]);
      toast.success("Course added successfully");
      
      // Notify enrolled students (though a new course won't have students yet)
      setTimeout(async () => {
        await notifyStudentsAboutUpdate(data.id, course.title, 'course');
      }, 1000);
      
      return true;
    } catch (error) {
      toast.error("Failed to add course");
      return false;
    }
  };

  const updateCourse = async (courseId: string, updates: Partial<Course>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('courses')
        .update(updates)
        .eq('id', courseId);

      if (error) {
        toast.error("Failed to update course");
        return false;
      }

      setCourses(prev => prev.map(course => 
        course.id === courseId ? { ...course, ...updates } : course
      ));
      toast.success("Course updated successfully");
      return true;
    } catch (error) {
      toast.error("Failed to update course");
      return false;
    }
  };

  const deleteCourse = async (courseId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId);

      if (error) {
        toast.error("Failed to delete course");
        return false;
      }

      setCourses(prev => prev.filter(course => course.id !== courseId));
      // Also remove from local state
      setExercises(prev => prev.filter(ex => ex.course_id !== courseId));
      setExams(prev => prev.filter(exam => exam.course_id !== courseId));
      setEnrollments(prev => prev.filter(enr => enr.course_id !== courseId));
      
      toast.success("Course deleted successfully");
      return true;
    } catch (error) {
      toast.error("Failed to delete course");
      return false;
    }
  };

  const toggleCourseVisibility = async (courseId: string): Promise<boolean> => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return false;

    return await updateCourse(courseId, { is_visible: !course.is_visible });
  };

  const uploadCoursePdf = async (courseId: string, file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `course_${courseId}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('course-materials')
        .upload(fileName, file);

      if (uploadError) {
        toast.error("Failed to upload PDF");
        return null;
      }

      const { data } = supabase.storage
        .from('course-materials')
        .getPublicUrl(fileName);

      const publicUrl = data.publicUrl;

      // Update course with PDF URL
      await updateCourse(courseId, { pdf_url: publicUrl });

      toast.success("PDF uploaded successfully");
      return publicUrl;
    } catch (error) {
      toast.error("Failed to upload PDF");
      return null;
    }
  };

  // Exercise operations
  const addExercise = async (exercise: Omit<Exercise, "id" | "created_at" | "updated_at">): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('exercises')
        .insert([exercise])
        .select()
        .single();

      if (error) {
        toast.error("Failed to add exercise");
        return false;
      }

      setExercises(prev => [data, ...prev]);
      toast.success("Exercise added successfully");
      
      // Notify enrolled students
      setTimeout(async () => {
        await notifyStudentsAboutUpdate(exercise.course_id, exercise.title, 'exercise');
      }, 1000);
      
      return true;
    } catch (error) {
      toast.error("Failed to add exercise");
      return false;
    }
  };

  const updateExercise = async (exerciseId: string, updates: Partial<Exercise>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('exercises')
        .update(updates)
        .eq('id', exerciseId);

      if (error) {
        toast.error("Failed to update exercise");
        return false;
      }

      setExercises(prev => prev.map(exercise => 
        exercise.id === exerciseId ? { ...exercise, ...updates } : exercise
      ));
      toast.success("Exercise updated successfully");
      return true;
    } catch (error) {
      toast.error("Failed to update exercise");
      return false;
    }
  };

  const deleteExercise = async (exerciseId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('exercises')
        .delete()
        .eq('id', exerciseId);

      if (error) {
        toast.error("Failed to delete exercise");
        return false;
      }

      setExercises(prev => prev.filter(exercise => exercise.id !== exerciseId));
      toast.success("Exercise deleted successfully");
      return true;
    } catch (error) {
      toast.error("Failed to delete exercise");
      return false;
    }
  };

  const toggleExerciseVisibility = async (exerciseId: string): Promise<boolean> => {
    const exercise = exercises.find(e => e.id === exerciseId);
    if (!exercise) return false;

    return await updateExercise(exerciseId, { is_visible: !exercise.is_visible });
  };

  const uploadExercisePdf = async (exerciseId: string, file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `exercise_${exerciseId}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('course-materials')
        .upload(fileName, file);

      if (uploadError) {
        toast.error("Failed to upload PDF");
        return null;
      }

      const { data } = supabase.storage
        .from('course-materials')
        .getPublicUrl(fileName);

      const publicUrl = data.publicUrl;

      // Update exercise with PDF URL
      await updateExercise(exerciseId, { pdf_url: publicUrl });

      toast.success("PDF uploaded successfully");
      return publicUrl;
    } catch (error) {
      toast.error("Failed to upload PDF");
      return null;
    }
  };

  // Exam operations
  const addExam = async (exam: Omit<Exam, "id" | "created_at" | "updated_at">): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('exams')
        .insert([exam])
        .select()
        .single();

      if (error) {
        toast.error("Failed to add exam");
        return false;
      }

      setExams(prev => [data, ...prev]);
      toast.success("Exam added successfully");
      
      // Notify enrolled students
      setTimeout(async () => {
        await notifyStudentsAboutUpdate(exam.course_id, exam.title, 'exam');
      }, 1000);
      
      return true;
    } catch (error) {
      toast.error("Failed to add exam");
      return false;
    }
  };

  const updateExam = async (examId: string, updates: Partial<Exam>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('exams')
        .update(updates)
        .eq('id', examId);

      if (error) {
        toast.error("Failed to update exam");
        return false;
      }

      setExams(prev => prev.map(exam => 
        exam.id === examId ? { ...exam, ...updates } : exam
      ));
      toast.success("Exam updated successfully");
      return true;
    } catch (error) {
      toast.error("Failed to update exam");
      return false;
    }
  };

  const deleteExam = async (examId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('exams')
        .delete()
        .eq('id', examId);

      if (error) {
        toast.error("Failed to delete exam");
        return false;
      }

      setExams(prev => prev.filter(exam => exam.id !== examId));
      toast.success("Exam deleted successfully");
      return true;
    } catch (error) {
      toast.error("Failed to delete exam");
      return false;
    }
  };

  const toggleExamVisibility = async (examId: string): Promise<boolean> => {
    const exam = exams.find(e => e.id === examId);
    if (!exam) return false;

    return await updateExam(examId, { is_visible: !exam.is_visible });
  };

  const uploadExamPdf = async (examId: string, file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `exam_${examId}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('course-materials')
        .upload(fileName, file);

      if (uploadError) {
        toast.error("Failed to upload PDF");
        return null;
      }

      const { data } = supabase.storage
        .from('course-materials')
        .getPublicUrl(fileName);

      const publicUrl = data.publicUrl;

      // Update exam with PDF URL
      await updateExam(examId, { pdf_url: publicUrl });

      toast.success("PDF uploaded successfully");
      return publicUrl;
    } catch (error) {
      toast.error("Failed to upload PDF");
      return null;
    }
  };

  // Enrollment operations
  const enrollStudent = async (courseId: string, studentId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .insert([{
          course_id: courseId,
          student_id: studentId
        }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          toast.error("Student is already enrolled in this course");
        } else {
          toast.error("Failed to enroll student");
        }
        return false;
      }

      setEnrollments(prev => [...prev, data]);
      toast.success("Student enrolled successfully");
      return true;
    } catch (error) {
      toast.error("Failed to enroll student");
      return false;
    }
  };

  const unenrollStudent = async (courseId: string, studentId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('enrollments')
        .delete()
        .eq('course_id', courseId)
        .eq('student_id', studentId);

      if (error) {
        toast.error("Failed to unenroll student");
        return false;
      }

      setEnrollments(prev => prev.filter(enr => 
        !(enr.course_id === courseId && enr.student_id === studentId)
      ));
      toast.success("Student unenrolled successfully");
      return true;
    } catch (error) {
      toast.error("Failed to unenroll student");
      return false;
    }
  };

  const getEnrolledStudents = async (courseId: string): Promise<UserProfile[]> => {
    try {
      // Get enrollments for this course
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('course_id', courseId);

      if (enrollmentError) {
        console.error('Failed to fetch enrollments:', enrollmentError);
        return [];
      }

      if (!enrollmentData || enrollmentData.length === 0) {
        return [];
      }

      const studentIds = enrollmentData.map(e => e.student_id);

      // Get profiles for these students
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, email, role, avatar_url')
        .in('id', studentIds);

      if (profileError) {
        console.error('Failed to fetch student profiles:', profileError);
        return [];
      }

      return (profileData || []).map(profile => ({
        id: profile.id,
        name: profile.name,
        email: profile.email || '',
        role: profile.role as UserRole,
        avatar_url: profile.avatar_url
      }));
    } catch (error) {
      console.error('Failed to fetch enrolled students:', error);
      return [];
    }
  };

  const removeEnrollment = async (enrollmentId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('enrollments')
        .delete()
        .eq('id', enrollmentId);

      if (error) {
        toast.error("Failed to remove enrollment");
        return false;
      }

      setEnrollments(prev => prev.filter(enr => enr.id !== enrollmentId));
      toast.success("Student removed from course successfully");
      return true;
    } catch (error) {
      toast.error("Failed to remove enrollment");
      return false;
    }
  };

  const getStudentCourses = (studentId: string): Course[] => {
    const enrolledCourseIds = enrollments
      .filter(enr => enr.student_id === studentId)
      .map(enr => enr.course_id);
    
    return courses.filter(course => enrolledCourseIds.includes(course.id));
  };

  const getVisibleCoursesForStudent = (studentId: string): Course[] => {
    return getStudentCourses(studentId).filter(course => course.is_visible);
  };

  const getVisibleExercisesForStudent = (studentId: string): Exercise[] => {
    const studentCourses = getVisibleCoursesForStudent(studentId);
    const courseIds = studentCourses.map(c => c.id);
    
    return exercises.filter(exercise => 
      courseIds.includes(exercise.course_id) && exercise.is_visible
    );
  };

  const getVisibleExamsForStudent = (studentId: string): Exam[] => {
    const studentCourses = getVisibleCoursesForStudent(studentId);
    const courseIds = studentCourses.map(c => c.id);
    
    return exams.filter(exam => 
      courseIds.includes(exam.course_id) && exam.is_visible
    );
  };

  // Quiz operations
  const addQuizQuestion = async (question: Omit<QuizQuestion, "id" | "created_at" | "updated_at">): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('quiz_questions')
        .insert([question])
        .select()
        .single();

      if (error) {
        toast.error("Failed to add question");
        return false;
      }

      setQuizQuestions(prev => [...prev, data as QuizQuestion]);
      toast.success("Question added successfully");
      return true;
    } catch (error) {
      toast.error("Failed to add question");
      return false;
    }
  };

  const addQuizOption = async (option: Omit<QuizOption, "id" | "created_at">): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('quiz_options')
        .insert([option])
        .select()
        .single();

      if (error) {
        toast.error("Failed to add option");
        return false;
      }

      setQuizOptions(prev => [...prev, data]);
      return true;
    } catch (error) {
      toast.error("Failed to add option");
      return false;
    }
  };

  const updateQuizQuestion = async (questionId: string, updates: Partial<QuizQuestion>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('quiz_questions')
        .update(updates)
        .eq('id', questionId);

      if (error) {
        toast.error("Failed to update question");
        return false;
      }

      setQuizQuestions(prev => prev.map(q => q.id === questionId ? { ...q, ...updates } : q));
      toast.success("Question updated successfully");
      return true;
    } catch (error) {
      toast.error("Failed to update question");
      return false;
    }
  };

  const deleteQuizQuestion = async (questionId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('quiz_questions')
        .delete()
        .eq('id', questionId);

      if (error) {
        toast.error("Failed to delete question");
        return false;
      }

      setQuizQuestions(prev => prev.filter(q => q.id !== questionId));
      setQuizOptions(prev => prev.filter(opt => opt.question_id !== questionId));
      toast.success("Question deleted successfully");
      return true;
    } catch (error) {
      toast.error("Failed to delete question");
      return false;
    }
  };

  const getQuizQuestions = (examId: string): QuizQuestion[] => {
    return quizQuestions.filter(q => q.exam_id === examId).sort((a, b) => a.question_order - b.question_order);
  };

  const getQuizOptions = (questionId: string): QuizOption[] => {
    return quizOptions.filter(opt => opt.question_id === questionId).sort((a, b) => a.option_order - b.option_order);
  };

  const submitQuiz = async (submission: Omit<QuizSubmission, "id" | "submitted_at">, answers: Omit<QuizAnswer, "id" | "submission_id" | "created_at">[]): Promise<boolean> => {
    try {
      // Insert submission
      const { data: submissionData, error: submissionError } = await supabase
        .from('quiz_submissions')
        .insert([submission])
        .select()
        .single();

      if (submissionError) {
        toast.error("Failed to submit quiz");
        return false;
      }

      // Insert answers
      const answersWithSubmissionId = answers.map(answer => ({
        ...answer,
        submission_id: submissionData.id
      }));

      const { error: answersError } = await supabase
        .from('quiz_answers')
        .insert(answersWithSubmissionId);

      if (answersError) {
        toast.error("Failed to save answers");
        return false;
      }

      // Update local state
      setQuizSubmissions(prev => [...prev, submissionData]);
      refreshData(); // Refresh to get the inserted answers
      
      toast.success("Quiz submitted successfully");
      return true;
    } catch (error) {
      toast.error("Failed to submit quiz");
      return false;
    }
  };

  const getQuizSubmissions = (examId: string): QuizSubmission[] => {
    return quizSubmissions.filter(sub => sub.exam_id === examId);
  };

  const getStudentQuizSubmission = (examId: string, studentId: string): QuizSubmission | null => {
    return quizSubmissions.find(sub => sub.exam_id === examId && sub.student_id === studentId) || null;
  };

  const notifyStudentsAboutUpdate = async (courseId: string, title: string, type: 'course' | 'exercise' | 'exam') => {
    try {
      // Get all students enrolled in the course
      const { data: enrollments, error: enrollmentError } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('course_id', courseId);

      if (enrollmentError || !enrollments || enrollments.length === 0) {
        return;
      }

      const studentIds = enrollments.map(e => e.student_id);

      // Create notification for each student
      const notificationData = {
        title: `New ${type} available`,
        message: `${title} has been added to your course`,
        type: 'info' as const,
        read: false,
        course_id: courseId
      };

      const notifications = studentIds.map(studentId => ({
        ...notificationData,
        user_id: studentId
      }));

      await supabase
        .from('notifications')
        .insert(notifications);
    } catch (error) {
      console.error('Failed to notify students:', error);
    }
  };

  return (
    <CourseContext.Provider value={{
      rooms,
      courses,
      exercises,
      exams,
      enrollments,
      quizQuestions,
      quizOptions,
      quizSubmissions,
      quizAnswers,
      loading,
      addRoom,
      updateRoom,
      deleteRoom,
      toggleRoomVisibility,
      addCourse,
      updateCourse,
      deleteCourse,
      toggleCourseVisibility,
      uploadCoursePdf,
      addExercise,
      updateExercise,
      deleteExercise,
      toggleExerciseVisibility,
      uploadExercisePdf,
      addExam,
      updateExam,
      deleteExam,
      toggleExamVisibility,
      uploadExamPdf,
      addQuizQuestion,
      addQuizOption,
      updateQuizQuestion,
      deleteQuizQuestion,
      getQuizQuestions,
      getQuizOptions,
      submitQuiz,
      getQuizSubmissions,
      getStudentQuizSubmission,
      enrollStudent,
      unenrollStudent,
      removeEnrollment,
      getEnrolledStudents,
      getStudentCourses,
      getVisibleCoursesForStudent,
      getVisibleExercisesForStudent,
      getVisibleExamsForStudent,
      refreshData
    }}>
      {children}
    </CourseContext.Provider>
  );
}

export function useCourses() {
  const context = useContext(CourseContext);
  if (context === undefined) {
    throw new Error("useCourses must be used within a CourseProvider");
  }
  return context;
}

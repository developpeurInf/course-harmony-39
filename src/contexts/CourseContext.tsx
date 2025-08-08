
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
  created_at: string;
  updated_at: string;
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
  
  // Enrollment operations
  enrollStudent: (courseId: string, studentId: string) => Promise<boolean>;
  unenrollStudent: (courseId: string, studentId: string) => Promise<boolean>;
  getEnrolledStudents: (courseId: string) => Promise<UserProfile[]>;
  getStudentCourses: (studentId: string) => Course[];
  getVisibleCoursesForStudent: (studentId: string) => Course[];
  getVisibleExercisesForStudent: (studentId: string) => Exercise[];
  getVisibleExamsForStudent: (studentId: string) => Exam[];
  
  // Utility functions
  refreshData: () => Promise<void>;
}

const CourseContext = createContext<CourseContextType | undefined>(undefined);

export function CourseProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(false);

  // Load initial data
  useEffect(() => {
    if (user) {
      refreshData();
    }
  }, [user]);

  const refreshData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch all data in parallel
      const [roomsData, coursesData, exercisesData, examsData, enrollmentsData] = await Promise.all([
        supabase.from('rooms').select('*').order('created_at', { ascending: false }),
        supabase.from('courses').select('*').order('created_at', { ascending: false }),
        supabase.from('exercises').select('*').order('created_at', { ascending: false }),
        supabase.from('exams').select('*').order('created_at', { ascending: false }),
        supabase.from('enrollments').select('*')
      ]);

      if (roomsData.error) console.error('Rooms fetch error:', roomsData.error);
      else setRooms(roomsData.data || []);

      if (coursesData.error) console.error('Courses fetch error:', coursesData.error);
      else setCourses(coursesData.data || []);

      if (exercisesData.error) console.error('Exercises fetch error:', exercisesData.error);
      else setExercises(exercisesData.data || []);

      if (examsData.error) console.error('Exams fetch error:', examsData.error);
      else setExams(examsData.data || []);

      if (enrollmentsData.error) console.error('Enrollments fetch error:', enrollmentsData.error);
      else setEnrollments(enrollmentsData.data || []);

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

  return (
    <CourseContext.Provider value={{
      rooms,
      courses,
      exercises,
      exams,
      enrollments,
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
      enrollStudent,
      unenrollStudent,
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


import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth, User } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Types
export interface Course {
  id: string;
  title: string;
  description: string;
  isVisible: boolean;
  professorId: string;
  enrolledStudents: string[]; // Student IDs
  createdAt: string;
  pdfFile?: File | null;
  pdfFileName?: string;
}

export interface Exercise {
  id: string;
  courseId: string;
  title: string;
  description: string;
  dueDate: string;
  isVisible: boolean;
  createdAt: string;
  pdfFile?: File | null;
  pdfFileName?: string;
}

export interface Exam {
  id: string;
  courseId: string;
  title: string;
  description: string;
  date: string;
  duration: number; // in minutes
  isVisible: boolean;
  createdAt: string;
  pdfFile?: File | null;
  pdfFileName?: string;
}

// Mock initial data
const initialCourses: Course[] = [
  {
    id: "c1",
    title: "Introduction to Computer Science",
    description: "Basic concepts of computer science and programming.",
    isVisible: true,
    professorId: "p1",
    enrolledStudents: ["s1", "s2", "s3"],
    createdAt: new Date().toISOString(),
  },
  {
    id: "c2",
    title: "Data Structures and Algorithms",
    description: "Advanced data structures and algorithm design.",
    isVisible: true,
    professorId: "p1",
    enrolledStudents: ["s1", "s3"],
    createdAt: new Date().toISOString(),
  },
  {
    id: "c3",
    title: "Web Development",
    description: "Fundamentals of web technologies and applications.",
    isVisible: false,
    professorId: "p1",
    enrolledStudents: ["s2"],
    createdAt: new Date().toISOString(),
  },
  {
    id: "c4",
    title: "Artificial Intelligence",
    description: "Introduction to AI concepts and applications.",
    isVisible: true,
    professorId: "p1",
    enrolledStudents: ["s1", "s2", "s3"],
    createdAt: new Date().toISOString(),
  },
];

const initialExercises: Exercise[] = [
  {
    id: "e1",
    courseId: "c1",
    title: "Variables and Data Types",
    description: "Practice exercises on variables and basic data types.",
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week from now
    isVisible: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "e2",
    courseId: "c1",
    title: "Control Structures",
    description: "Implement different control structures in programming.",
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 2 weeks from now
    isVisible: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "e3",
    courseId: "c2",
    title: "Linked Lists Implementation",
    description: "Create and manipulate linked list data structures.",
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
    isVisible: true,
    createdAt: new Date().toISOString(),
  },
];

const initialExams: Exam[] = [
  {
    id: "ex1",
    courseId: "c1",
    title: "Midterm Exam",
    description: "Covers all topics from weeks 1-6.",
    date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 1 month from now
    duration: 120, // 2 hours
    isVisible: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "ex2",
    courseId: "c2",
    title: "Final Exam",
    description: "Comprehensive exam covering all course material.",
    date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 3 months from now
    duration: 180, // 3 hours
    isVisible: false,
    createdAt: new Date().toISOString(),
  },
];

// Context type
interface CourseContextType {
  courses: Course[];
  exercises: Exercise[];
  exams: Exam[];
  addCourse: (course: Omit<Course, "id" | "createdAt" | "professorId">) => void;
  updateCourse: (courseId: string, updates: Partial<Course>) => void;
  deleteCourse: (courseId: string) => void;
  toggleCourseVisibility: (courseId: string) => void;
  addExercise: (exercise: Omit<Exercise, "id" | "createdAt">) => void;
  updateExercise: (exerciseId: string, updates: Partial<Exercise>) => void;
  deleteExercise: (exerciseId: string) => void;
  toggleExerciseVisibility: (exerciseId: string) => void;
  addExam: (exam: Omit<Exam, "id" | "createdAt">) => void;
  updateExam: (examId: string, updates: Partial<Exam>) => void;
  deleteExam: (examId: string) => void;
  toggleExamVisibility: (examId: string) => void;
  enrollStudent: (courseId: string, studentId: string) => void;
  unenrollStudent: (courseId: string, studentId: string) => void;
  getVisibleCoursesForStudent: (studentId: string) => Course[];
  getVisibleExercisesForStudent: (studentId: string) => Exercise[];
  getVisibleExamsForStudent: (studentId: string) => Exam[];
  setCourseFile: (courseId: string, file: File | null) => void;
  setExerciseFile: (exerciseId: string, file: File | null) => void;
  setExamFile: (examId: string, file: File | null) => void;
}

const CourseContext = createContext<CourseContextType | undefined>(undefined);

export function CourseProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [exercises, setExercises] = useState<Exercise[]>(initialExercises);
  const [exams, setExams] = useState<Exam[]>(initialExams);

  // Load data from localStorage if available
  useEffect(() => {
    const savedCourses = localStorage.getItem("courseHarmonyCourses");
    const savedExercises = localStorage.getItem("courseHarmonyExercises");
    const savedExams = localStorage.getItem("courseHarmonyExams");

    if (savedCourses) setCourses(JSON.parse(savedCourses));
    if (savedExercises) setExercises(JSON.parse(savedExercises));
    if (savedExams) setExams(JSON.parse(savedExams));
  }, []);

  // Save data to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("courseHarmonyCourses", JSON.stringify(courses.map(course => {
      // Remove the actual File object before storing in localStorage
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { pdfFile, ...courseWithoutFile } = course;
      return courseWithoutFile;
    })));
    
    localStorage.setItem("courseHarmonyExercises", JSON.stringify(exercises.map(exercise => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { pdfFile, ...exerciseWithoutFile } = exercise;
      return exerciseWithoutFile;
    })));
    
    localStorage.setItem("courseHarmonyExams", JSON.stringify(exams.map(exam => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { pdfFile, ...examWithoutFile } = exam;
      return examWithoutFile;
    })));
  }, [courses, exercises, exams]);

  // File handling functions
  const setCourseFile = (courseId: string, file: File | null) => {
    setCourses(
      courses.map((course) => {
        if (course.id === courseId) {
          return {
            ...course,
            pdfFile: file,
            pdfFileName: file ? file.name : undefined
          };
        }
        return course;
      })
    );
    toast.success(file ? "PDF added to course" : "PDF removed from course");
  };

  const setExerciseFile = (exerciseId: string, file: File | null) => {
    setExercises(
      exercises.map((exercise) => {
        if (exercise.id === exerciseId) {
          return {
            ...exercise,
            pdfFile: file,
            pdfFileName: file ? file.name : undefined
          };
        }
        return exercise;
      })
    );
    toast.success(file ? "PDF added to exercise" : "PDF removed from exercise");
  };

  const setExamFile = (examId: string, file: File | null) => {
    setExams(
      exams.map((exam) => {
        if (exam.id === examId) {
          return {
            ...exam,
            pdfFile: file,
            pdfFileName: file ? file.name : undefined
          };
        }
        return exam;
      })
    );
    toast.success(file ? "PDF added to exam" : "PDF removed from exam");
  };

  // Course functions
  const addCourse = (course: Omit<Course, "id" | "createdAt" | "professorId">) => {
    if (!user || user.role !== "professor") {
      toast.error("Only professors can add courses");
      return;
    }

    const newCourse: Course = {
      ...course,
      id: `c${Date.now()}`,
      professorId: user.id,
      createdAt: new Date().toISOString(),
    };

    setCourses([...courses, newCourse]);
    toast.success("Course added successfully");
  };

  const updateCourse = (courseId: string, updates: Partial<Course>) => {
    setCourses(
      courses.map((course) =>
        course.id === courseId ? { ...course, ...updates } : course
      )
    );
    toast.success("Course updated successfully");
  };

  const deleteCourse = (courseId: string) => {
    setCourses(courses.filter((course) => course.id !== courseId));
    // Also delete associated exercises and exams
    setExercises(exercises.filter((exercise) => exercise.courseId !== courseId));
    setExams(exams.filter((exam) => exam.courseId !== courseId));
    toast.success("Course deleted successfully");
  };

  const toggleCourseVisibility = (courseId: string) => {
    setCourses(
      courses.map((course) =>
        course.id === courseId
          ? { ...course, isVisible: !course.isVisible }
          : course
      )
    );
    toast.success(`Course is now ${!courses.find(c => c.id === courseId)?.isVisible ? 'visible' : 'hidden'}`);
  };

  // Exercise functions
  const addExercise = (exercise: Omit<Exercise, "id" | "createdAt">) => {
    const newExercise: Exercise = {
      ...exercise,
      id: `e${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    setExercises([...exercises, newExercise]);
    toast.success("Exercise added successfully");
  };

  const updateExercise = (exerciseId: string, updates: Partial<Exercise>) => {
    setExercises(
      exercises.map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, ...updates } : exercise
      )
    );
    toast.success("Exercise updated successfully");
  };

  const deleteExercise = (exerciseId: string) => {
    setExercises(exercises.filter((exercise) => exercise.id !== exerciseId));
    toast.success("Exercise deleted successfully");
  };

  const toggleExerciseVisibility = (exerciseId: string) => {
    setExercises(
      exercises.map((exercise) =>
        exercise.id === exerciseId
          ? { ...exercise, isVisible: !exercise.isVisible }
          : exercise
      )
    );
    toast.success(`Exercise is now ${!exercises.find(e => e.id === exerciseId)?.isVisible ? 'visible' : 'hidden'}`);
  };

  // Exam functions
  const addExam = (exam: Omit<Exam, "id" | "createdAt">) => {
    const newExam: Exam = {
      ...exam,
      id: `ex${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    setExams([...exams, newExam]);
    toast.success("Exam added successfully");
  };

  const updateExam = (examId: string, updates: Partial<Exam>) => {
    setExams(
      exams.map((exam) =>
        exam.id === examId ? { ...exam, ...updates } : exam
      )
    );
    toast.success("Exam updated successfully");
  };

  const deleteExam = (examId: string) => {
    setExams(exams.filter((exam) => exam.id !== examId));
    toast.success("Exam deleted successfully");
  };

  const toggleExamVisibility = (examId: string) => {
    setExams(
      exams.map((exam) =>
        exam.id === examId
          ? { ...exam, isVisible: !exam.isVisible }
          : exam
      )
    );
    toast.success(`Exam is now ${!exams.find(e => e.id === examId)?.isVisible ? 'visible' : 'hidden'}`);
  };

  // Enrollment functions
  const enrollStudent = (courseId: string, studentId: string) => {
    setCourses(
      courses.map((course) => {
        if (course.id === courseId && !course.enrolledStudents.includes(studentId)) {
          return {
            ...course,
            enrolledStudents: [...course.enrolledStudents, studentId],
          };
        }
        return course;
      })
    );
    toast.success("Student enrolled successfully");
  };

  const unenrollStudent = (courseId: string, studentId: string) => {
    setCourses(
      courses.map((course) => {
        if (course.id === courseId) {
          return {
            ...course,
            enrolledStudents: course.enrolledStudents.filter(
              (id) => id !== studentId
            ),
          };
        }
        return course;
      })
    );
    toast.success("Student unenrolled successfully");
  };

  // Student-specific functions
  const getVisibleCoursesForStudent = (studentId: string) => {
    return courses.filter(
      (course) =>
        course.isVisible && course.enrolledStudents.includes(studentId)
    );
  };

  const getVisibleExercisesForStudent = (studentId: string) => {
    const enrolledCourseIds = courses
      .filter((course) => course.enrolledStudents.includes(studentId))
      .map((course) => course.id);

    return exercises.filter(
      (exercise) =>
        exercise.isVisible && enrolledCourseIds.includes(exercise.courseId)
    );
  };

  const getVisibleExamsForStudent = (studentId: string) => {
    const enrolledCourseIds = courses
      .filter((course) => course.enrolledStudents.includes(studentId))
      .map((course) => course.id);

    return exams.filter(
      (exam) =>
        exam.isVisible && enrolledCourseIds.includes(exam.courseId)
    );
  };

  return (
    <CourseContext.Provider
      value={{
        courses,
        exercises,
        exams,
        addCourse,
        updateCourse,
        deleteCourse,
        toggleCourseVisibility,
        addExercise,
        updateExercise,
        deleteExercise,
        toggleExerciseVisibility,
        addExam,
        updateExam,
        deleteExam,
        toggleExamVisibility,
        enrollStudent,
        unenrollStudent,
        getVisibleCoursesForStudent,
        getVisibleExercisesForStudent,
        getVisibleExamsForStudent,
        setCourseFile,
        setExerciseFile,
        setExamFile,
      }}
    >
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

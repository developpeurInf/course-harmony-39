import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CourseProvider } from "@/contexts/CourseContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { PreferencesProvider } from "@/contexts/PreferencesContext";
import { FirstLoginDialog } from "@/components/FirstLoginDialog";

import MainLayout from "@/components/layout/MainLayout";
import Index from "@/pages/Index";
import Login from "@/pages/Login";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

// Chargement des pages à la demande : le premier écran se charge beaucoup plus
// vite et consomme moins de mémoire (iPad Air / mini 2-3 sous iOS 12 = 1 Go de RAM).
const Dashboard = lazyWithRetry(() => import("@/pages/Dashboard"));
const CreateRoom = lazyWithRetry(() => import("@/pages/CreateRoom"));
const ClassManagement = lazyWithRetry(() => import("@/pages/ClassManagement"));
const Courses = lazyWithRetry(() => import("@/pages/Courses"));
const RoomStudents = lazyWithRetry(() => import("@/pages/RoomStudents"));
const RoomCourses = lazyWithRetry(() => import("@/pages/RoomCourses"));
const RoomExercises = lazyWithRetry(() => import("@/pages/RoomExercises"));
const Exercises = lazyWithRetry(() => import("@/pages/Exercises"));
const Exams = lazyWithRetry(() => import("@/pages/Exams"));
const Students = lazyWithRetry(() => import("@/pages/Students"));
const StudentsActivities = lazyWithRetry(() => import("@/pages/StudentsActivities"));
const Profile = lazyWithRetry(() => import("@/pages/Profile"));
const RoomExams = lazyWithRetry(() => import("@/pages/RoomExams"));
const Settings = lazyWithRetry(() => import("@/pages/Settings"));
const Reports = lazyWithRetry(() => import("@/pages/Reports"));
const DiagnosticEvaluation = lazyWithRetry(() => import("@/pages/DiagnosticEvaluation"));
const NotFound = lazyWithRetry(() => import("@/pages/NotFound"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh] w-full">
    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
  </div>
);

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <LanguageProvider>
            <PreferencesProvider>
            <CourseProvider>
              <NotificationProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <BrowserRouter>
                    <FirstLoginDialog />
                    <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/login" element={<Login />} />
                      <Route element={<MainLayout />}>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/create-room" element={<CreateRoom />} />
                        <Route path="/class-management" element={<ClassManagement />} />
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/courses" element={<Courses />} />
                        <Route path="/exercises" element={<Exercises />} />
                        <Route path="/exams" element={<Exams />} />
                        <Route path="/students" element={<Students />} />
                        <Route path="/rooms/:roomId/students" element={<RoomStudents />} />
                        <Route path="/rooms/:roomId/students-activities" element={<StudentsActivities />} />
                        <Route path="/rooms/:roomId/courses" element={<RoomCourses />} />
                        <Route path="/rooms/:roomId/exercises" element={<RoomExercises />} />
                        <Route path="/rooms/:roomId/exams" element={<RoomExams />} />
                        <Route path="/reports" element={<Reports />} />
                        <Route path="/diagnostic" element={<DiagnosticEvaluation />} />
                        <Route path="/settings" element={<Settings />} />
                      </Route>
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                    </Suspense>
                  </BrowserRouter>
                </TooltipProvider>
              </NotificationProvider>
            </CourseProvider>
            </PreferencesProvider>
          </LanguageProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;

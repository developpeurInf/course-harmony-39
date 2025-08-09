import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CourseProvider } from "@/contexts/CourseContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

import MainLayout from "@/components/layout/MainLayout";
import Index from "@/pages/Index";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import CreateRoom from "@/pages/CreateRoom";
import ClassManagement from "@/pages/ClassManagement";
import Courses from "@/pages/Courses";
import RoomStudents from "@/pages/RoomStudents";
import RoomCourses from "@/pages/RoomCourses";
import RoomExercises from "@/pages/RoomExercises";
import Exercises from "@/pages/Exercises";
import Exams from "@/pages/Exams";
import Students from "@/pages/Students";
import Profile from "@/pages/Profile";
import RoomExams from "@/pages/RoomExams";
import Settings from "@/pages/Settings";
import Reports from "@/pages/Reports";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <LanguageProvider>
            <CourseProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
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
                      <Route path="/rooms/:roomId/courses" element={<RoomCourses />} />
                      <Route path="/rooms/:roomId/exercises" element={<RoomExercises />} />
                      <Route path="/rooms/:roomId/exams" element={<RoomExams />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route path="/settings" element={<Settings />} />
                    </Route>
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
              </TooltipProvider>
            </CourseProvider>
          </LanguageProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
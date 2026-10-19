import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { CourseProvider } from "@/contexts/CourseContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { PreferencesProvider } from "@/contexts/PreferencesContext";
import { FirstLoginDialog } from "@/components/FirstLoginDialog";
import { AccessProvider } from "@/contexts/AccessContext";
import { RequirePermission } from "@/components/access/AccessUi";
import { RequireFeature } from "@/components/access/RequireFeature";
import { AppSettingsProvider } from "@/contexts/AppSettingsContext";

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
const MySubscription = lazyWithRetry(() => import("@/pages/MySubscription"));
// Espace d'administration (chargé uniquement par les administrateurs)
const AdminLayout = lazyWithRetry(() => import("@/pages/admin/AdminLayout"));
const AdminDashboard = lazyWithRetry(() => import("@/pages/admin/AdminDashboard"));
const AdminTeachers = lazyWithRetry(() => import("@/pages/admin/AdminTeachers"));
const AdminTeacherDetail = lazyWithRetry(() => import("@/pages/admin/AdminTeacherDetail"));
const AdminPlans = lazyWithRetry(() => import("@/pages/admin/AdminPlans"));
const AdminSubscriptions = lazyWithRetry(() => import("@/pages/admin/AdminSubscriptions"));
const AdminPayments = lazyWithRetry(() => import("@/pages/admin/AdminPayments"));
const AdminAudit = lazyWithRetry(() => import("@/pages/admin/AdminAudit"));
const AdminTeam = lazyWithRetry(() => import("@/pages/admin/AdminTeam"));
const AdminCustomization = lazyWithRetry(() => import("@/pages/admin/AdminCustomization"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh] w-full">
    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
  </div>
);

/** Erreur d'affichage d'une page : message + bouton « Recharger » ; effacée en changeant de page */
const RouteErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>;
};

const App = () => {
  return (
    <ErrorBoundary>
    <AppSettingsProvider>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <AccessProvider>
          <LanguageProvider>
            <PreferencesProvider>
            <CourseProvider>
              <NotificationProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <BrowserRouter>
                    <FirstLoginDialog />
                    <RouteErrorBoundary>
                    <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/login" element={<Login />} />
                      <Route element={<MainLayout />}>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/create-room" element={<RequirePermission perm="class.create"><CreateRoom /></RequirePermission>} />
                        <Route path="/class-management" element={<RequirePermission perm="class.view"><ClassManagement /></RequirePermission>} />
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/courses" element={<RequireFeature feature="courses"><RequirePermission perm="course.view"><Courses /></RequirePermission></RequireFeature>} />
                        <Route path="/exercises" element={<RequireFeature feature="exercises"><Exercises /></RequireFeature>} />
                        <Route path="/exams" element={<RequireFeature feature="exams"><Exams /></RequireFeature>} />
                        <Route path="/students" element={<RequirePermission perm="student.view"><Students /></RequirePermission>} />
                        <Route path="/rooms/:roomId/students" element={<RequirePermission perm="student.view"><RoomStudents /></RequirePermission>} />
                        <Route path="/rooms/:roomId/students-activities" element={<RequireFeature feature="studentActivities"><RequirePermission perm="student.activity_view"><StudentsActivities /></RequirePermission></RequireFeature>} />
                        <Route path="/rooms/:roomId/courses" element={<RequireFeature feature="courses"><RequirePermission perm="course.view"><RoomCourses /></RequirePermission></RequireFeature>} />
                        <Route path="/rooms/:roomId/exercises" element={<RequireFeature feature="exercises"><RoomExercises /></RequireFeature>} />
                        <Route path="/rooms/:roomId/exams" element={<RequireFeature feature="exams"><RoomExams /></RequireFeature>} />
                        <Route path="/reports" element={<RequireFeature feature="reports"><RequirePermission perm="reports.view"><Reports /></RequirePermission></RequireFeature>} />
                        <Route path="/diagnostic" element={<RequireFeature feature="diagnostic"><RequirePermission perm="diagnostic.use"><DiagnosticEvaluation /></RequirePermission></RequireFeature>} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/subscription" element={<MySubscription />} />
                      </Route>
                      <Route path="/admin" element={<AdminLayout />}>
                        <Route index element={<AdminDashboard />} />
                        <Route path="teachers" element={<AdminTeachers />} />
                        <Route path="teachers/:id" element={<AdminTeacherDetail />} />
                        <Route path="plans" element={<AdminPlans />} />
                        <Route path="subscriptions" element={<AdminSubscriptions />} />
                        <Route path="payments" element={<AdminPayments />} />
                        <Route path="audit" element={<AdminAudit />} />
                        <Route path="team" element={<AdminTeam />} />
                        <Route path="customization" element={<AdminCustomization />} />
                      </Route>
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                    </Suspense>
                    </RouteErrorBoundary>
                  </BrowserRouter>
                </TooltipProvider>
              </NotificationProvider>
            </CourseProvider>
            </PreferencesProvider>
          </LanguageProvider>
          </AccessProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
    </AppSettingsProvider>
    </ErrorBoundary>
  );
};

export default App;

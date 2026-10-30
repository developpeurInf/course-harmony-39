"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { CourseProvider } from "@/contexts/CourseContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { PreferencesProvider } from "@/contexts/PreferencesContext";
import { AccessProvider } from "@/contexts/AccessContext";
import { AppSettingsProvider } from "@/contexts/AppSettingsContext";
import { FirstLoginDialog } from "@/components/FirstLoginDialog";
import { startBidiAuto } from "@/lib/bidiAuto";
import "@/lib/toast-interceptor";

const subscribe = () => () => {};

/**
 * Fournisseurs de l'application (session Supabase, langue, thème, accès…).
 * L'application vit entièrement dans le navigateur (données lues directement dans
 * Supabase) : le contenu n'est monté qu'une fois côté client.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient());
  const mounted = React.useSyncExternalStore(subscribe, () => true, () => false);

  React.useEffect(() => {
    startBidiAuto();
  }, []);

  if (!mounted) return null;

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
                          <FirstLoginDialog />
                          {children}
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
}

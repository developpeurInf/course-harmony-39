import './polyfills'
import { createRoot } from 'react-dom/client'
import './lib/toast-interceptor'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext'
import { CourseProvider } from './contexts/CourseContext'
import { LanguageProvider } from './contexts/LanguageContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { Toaster } from '@/components/ui/sonner'

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <CourseProvider>
      <NotificationProvider>
        <LanguageProvider>
          <App />
          <Toaster />
        </LanguageProvider>
      </NotificationProvider>
    </CourseProvider>
  </AuthProvider>
)

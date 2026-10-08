import './polyfills'
import { createRoot } from 'react-dom/client'
import './lib/toast-interceptor'
import './index.css'
import App from './App.tsx'

// Les fournisseurs (Auth, Course, Notification, Language…) et le Toaster sont déjà
// montés dans App.tsx. Les monter une seconde fois ici doublait les requêtes
// Supabase, les abonnements temps réel et la mémoire utilisée (critique sur iPad iOS 12).
createRoot(document.getElementById('root')!).render(<App />)

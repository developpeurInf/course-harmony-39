
import React, { createContext, useContext, useState, useEffect } from "react";

type Language = "en" | "fr" | "ar";

type Translations = {
  [key: string]: {
    en: string;
    fr: string;
    ar: string;
  };
};

// Translations for the application
const translations: Translations = {
  // General
  "app.name": {
    en: "Course Harmony",
    fr: "Harmonie des Cours",
    ar: "تناغم الدورات"
  },
  "app.language": {
    en: "Language",
    fr: "Langue",
    ar: "اللغة"
  },
  "app.save": {
    en: "Save",
    fr: "Enregistrer",
    ar: "حفظ"
  },
  "app.cancel": {
    en: "Cancel",
    fr: "Annuler",
    ar: "إلغاء"
  },
  "app.delete": {
    en: "Delete",
    fr: "Supprimer",
    ar: "حذف"
  },
  "app.edit": {
    en: "Edit",
    fr: "Modifier",
    ar: "تعديل"
  },
  "app.upload": {
    en: "Upload",
    fr: "Téléverser",
    ar: "رفع"
  },
  "app.download": {
    en: "Download",
    fr: "Télécharger",
    ar: "تنزيل"
  },
  "app.view": {
    en: "View",
    fr: "Voir",
    ar: "عرض"
  },
  
  // Navigation
  "nav.dashboard": {
    en: "Dashboard",
    fr: "Tableau de bord",
    ar: "لوحة التحكم"
  },
  "nav.rooms": {
    en: "Rooms",
    fr: "Salles",
    ar: "الغرف"
  },
  "nav.courses": {
    en: "Courses",
    fr: "Cours",
    ar: "الدورات"
  },
  "nav.exercises": {
    en: "Exercises",
    fr: "Exercices",
    ar: "التمارين"
  },
  "nav.exams": {
    en: "Exams",
    fr: "Examens",
    ar: "الامتحانات"
  },
  "nav.students": {
    en: "Students",
    fr: "Étudiants",
    ar: "الطلاب"
  },
  "nav.profile": {
    en: "Profile",
    fr: "Profil",
    ar: "الملف الشخصي"
  },
  "nav.settings": {
    en: "Settings",
    fr: "Paramètres",
    ar: "الإعدادات"
  },
  "nav.login": {
    en: "Login",
    fr: "Connexion",
    ar: "تسجيل الدخول"
  },
  "nav.logout": {
    en: "Logout",
    fr: "Déconnexion",
    ar: "تسجيل الخروج"
  },
  
  // Forms
  "form.title": {
    en: "Title",
    fr: "Titre",
    ar: "العنوان"
  },
  "form.description": {
    en: "Description",
    fr: "Description",
    ar: "الوصف"
  },
  "form.date": {
    en: "Date",
    fr: "Date",
    ar: "التاريخ"
  },
  "form.dueDate": {
    en: "Due Date",
    fr: "Date d'échéance",
    ar: "تاريخ الاستحقاق"
  },
  "form.duration": {
    en: "Duration (minutes)",
    fr: "Durée (minutes)",
    ar: "المدة (بالدقائق)"
  },
  "form.visible": {
    en: "Visible",
    fr: "Visible",
    ar: "مرئي"
  },
  "form.create": {
    en: "Create",
    fr: "Créer",
    ar: "إنشاء"
  },
  "form.update": {
    en: "Update",
    fr: "Mettre à jour",
    ar: "تحديث"
  },
  "form.name": {
    en: "Name",
    fr: "Nom",
    ar: "الاسم"
  },
  "form.email": {
    en: "Email",
    fr: "Email",
    ar: "البريد الإلكتروني"
  },
  "form.password": {
    en: "Password",
    fr: "Mot de passe",
    ar: "كلمة المرور"
  },
  
  // File Upload
  "file.upload": {
    en: "Upload PDF",
    fr: "Téléverser PDF",
    ar: "رفع ملف PDF"
  },
  "file.drag": {
    en: "Drag and drop your PDF here or click to browse",
    fr: "Glissez et déposez votre PDF ici ou cliquez pour parcourir",
    ar: "اسحب وأفلت ملف PDF الخاص بك هنا أو انقر للتصفح"
  },
  "file.limit": {
    en: "PDF files only, up to 10MB",
    fr: "Fichiers PDF uniquement, jusqu'à 10Mo",
    ar: "ملفات PDF فقط، حتى 10 ميجابايت"
  },
  
  // Courses
  "course.add": {
    en: "Add Course",
    fr: "Ajouter un cours",
    ar: "إضافة دورة"
  },
  "course.edit": {
    en: "Edit Course",
    fr: "Modifier le cours",
    ar: "تعديل الدورة"
  },
  "course.delete": {
    en: "Delete Course",
    fr: "Supprimer le cours",
    ar: "حذف الدورة"
  },
  
  // Exercises
  "exercise.add": {
    en: "Add Exercise",
    fr: "Ajouter un exercice",
    ar: "إضافة تمرين"
  },
  "exercise.edit": {
    en: "Edit Exercise",
    fr: "Modifier l'exercice",
    ar: "تعديل التمرين"
  },
  "exercise.delete": {
    en: "Delete Exercise",
    fr: "Supprimer l'exercice",
    ar: "حذف التمرين"
  },
  
  // Exams
  "exam.add": {
    en: "Add Exam",
    fr: "Ajouter un examen",
    ar: "إضافة امتحان"
  },
  "exam.edit": {
    en: "Edit Exam",
    fr: "Modifier l'examen",
    ar: "تعديل الامتحان"
  },
  "exam.delete": {
    en: "Delete Exam",
    fr: "Supprimer l'examen",
    ar: "حذف الامتحان"
  },
  
  // Rooms
  "room.add": {
    en: "Add Room",
    fr: "Ajouter une salle",
    ar: "إضافة غرفة"
  },
  "room.edit": {
    en: "Edit Room",
    fr: "Modifier la salle",
    ar: "تعديل الغرفة"
  },
  "room.delete": {
    en: "Delete Room",
    fr: "Supprimer la salle",
    ar: "حذف الغرفة"
  },
  
  // Dashboard
  "dashboard.welcome": {
    en: "Welcome",
    fr: "Bienvenue",
    ar: "مرحباً"
  },
  "dashboard.professor.subtitle": {
    en: "Manage your courses, exercises, and exams",
    fr: "Gérez vos cours, exercices et examens",
    ar: "إدارة دوراتك وتمارينك وامتحاناتك"
  },
  "dashboard.student.subtitle": {
    en: "View your courses, assignments, and exams",
    fr: "Consultez vos cours, devoirs et examens",
    ar: "عرض دوراتك ومهامك وامتحاناتك"
  },
  "dashboard.courses.professor": {
    en: "Total courses you manage",
    fr: "Total des cours que vous gérez",
    ar: "إجمالي الدورات التي تديرها"
  },
  "dashboard.courses.student": {
    en: "Courses you're enrolled in",
    fr: "Cours auxquels vous êtes inscrit",
    ar: "الدورات المسجل بها"
  },
  "dashboard.exercises.professor": {
    en: "Total assigned exercises",
    fr: "Total des exercices assignés",
    ar: "إجمالي التمارين المخصصة"
  },
  "dashboard.exercises.student": {
    en: "Exercises assigned to you",
    fr: "Exercices qui vous sont assignés",
    ar: "التمارين المخصصة لك"
  },
  "dashboard.exams.professor": {
    en: "Total scheduled exams",
    fr: "Total des examens programmés",
    ar: "إجمالي الامتحانات المجدولة"
  },
  "dashboard.exams.student": {
    en: "Upcoming exams",
    fr: "Examens à venir",
    ar: "الامتحانات القادمة"
  },
  "dashboard.students.total": {
    en: "Total enrolled students",
    fr: "Total des étudiants inscrits",
    ar: "إجمالي الطلاب المسجلين"
  },
  "dashboard.deadlines": {
    en: "Upcoming Deadlines",
    fr: "Échéances à venir",
    ar: "المواعيد النهائية القادمة"
  },
  "dashboard.deadlines.desc": {
    en: "Exercises due in the next 14 days",
    fr: "Exercices à rendre dans les 14 prochains jours",
    ar: "التمارين المستحقة في الـ 14 يوماً القادمة"
  },
  "dashboard.upcoming.exams": {
    en: "Upcoming Exams",
    fr: "Examens à venir",
    ar: "الامتحانات القادمة"
  },
  "dashboard.upcoming.exams.desc": {
    en: "Exams scheduled in the next 14 days",
    fr: "Examens programmés dans les 14 prochains jours",
    ar: "الامتحانات المجدولة في الـ 14 يوماً القادمة"
  },
  "dashboard.no.deadlines": {
    en: "No upcoming deadlines in the next 14 days",
    fr: "Aucune échéance dans les 14 prochains jours",
    ar: "لا توجد مواعيد نهائية في الـ 14 يوماً القادمة"
  },
  "dashboard.no.exams": {
    en: "No upcoming exams in the next 14 days",
    fr: "Aucun examen dans les 14 prochains jours",
    ar: "لا توجد امتحانات في الـ 14 يوماً القادمة"
  },
  "dashboard.your.courses": {
    en: "Your Courses",
    fr: "Vos cours",
    ar: "دوراتك"
  },
  "dashboard.your.courses.professor": {
    en: "Courses you are teaching",
    fr: "Cours que vous enseignez",
    ar: "الدورات التي تدرسها"
  },
  "dashboard.your.courses.student": {
    en: "Courses you are enrolled in",
    fr: "Cours auxquels vous êtes inscrit",
    ar: "الدورات المسجل بها"
  },
  "dashboard.no.courses.student": {
    en: "You are not enrolled in any courses yet",
    fr: "Vous n'êtes inscrit à aucun cours pour le moment",
    ar: "لم تسجل في أي دورات بعد"
  },
  "dashboard.no.courses.professor": {
    en: "You haven't created any courses yet",
    fr: "Vous n'avez encore créé aucun cours",
    ar: "لم تنشئ أي دورات بعد"
  },
  "dashboard.due": {
    en: "Due",
    fr: "Échéance",
    ar: "الاستحقاق"
  },
  "dashboard.hidden": {
    en: "Hidden",
    fr: "Masqué",
    ar: "مخفي"
  },
  "dashboard.students.count": {
    en: "students",
    fr: "étudiants",
    ar: "طلاب"
  },
  
  // Profile
  "profile.title": {
    en: "My Profile",
    fr: "Mon profil",
    ar: "ملفي الشخصي"
  },
  "profile.subtitle": {
    en: "View and manage your account information",
    fr: "Consultez et gérez les informations de votre compte",
    ar: "عرض وإدارة معلومات حسابك"
  },
  "profile.account": {
    en: "Account Information",
    fr: "Informations du compte",
    ar: "معلومات الحساب"
  },
  "profile.professor": {
    en: "Professor",
    fr: "Professeur",
    ar: "أستاذ"
  },
  "profile.student": {
    en: "Student",
    fr: "Étudiant",
    ar: "طالب"
  },
  "profile.statistics": {
    en: "Account Statistics",
    fr: "Statistiques du compte",
    ar: "إحصائيات الحساب"
  },
  "profile.details": {
    en: "Account Details",
    fr: "Détails du compte",
    ar: "تفاصيل الحساب"
  },
  "profile.role": {
    en: "Role",
    fr: "Rôle",
    ar: "الدور"
  },
  "profile.activity": {
    en: "My Activity",
    fr: "Mon activité",
    ar: "نشاطي"
  },
  "profile.activity.desc": {
    en: "Summary of your courses and academic activity",
    fr: "Résumé de vos cours et activité académique",
    ar: "ملخص دوراتك ونشاطك الأكاديمي"
  },
  "profile.courses.teach": {
    en: "Courses You Teach",
    fr: "Cours que vous enseignez",
    ar: "الدورات التي تدرسها"
  },
  "profile.courses.enrolled": {
    en: "Your Enrolled Courses",
    fr: "Vos cours inscrits",
    ar: "دوراتك المسجلة"
  },
  "profile.recent.activity": {
    en: "Recent Activity",
    fr: "Activité récente",
    ar: "النشاط الحديث"
  },
  "profile.no.courses": {
    en: "No courses found",
    fr: "Aucun cours trouvé",
    ar: "لم يتم العثور على دورات"
  },
  "profile.no.activity": {
    en: "No recent activity",
    fr: "Aucune activité récente",
    ar: "لا يوجد نشاط حديث"
  },
  "profile.exercise.for": {
    en: "Exercise for",
    fr: "Exercice pour",
    ar: "تمرين لـ"
  },
  "profile.exam.for": {
    en: "Exam for",
    fr: "Examen pour",
    ar: "امتحان لـ"
  },
  "profile.unknown.course": {
    en: "Unknown Course",
    fr: "Cours inconnu",
    ar: "دورة غير معروفة"
  },
  "profile.exercise": {
    en: "Exercise",
    fr: "Exercice",
    ar: "تمرين"
  },
  "profile.exam": {
    en: "Exam",
    fr: "Examen",
    ar: "امتحان"
  },
  
  // Index/Landing page
  "index.subtitle": {
    en: "A complete platform for professors to manage courses, exercises, and exams",
    fr: "Une plateforme complète pour que les professeurs gèrent les cours, exercices et examens",
    ar: "منصة شاملة للأساتذة لإدارة الدورات والتمارين والامتحانات"
  },
  "index.get.started": {
    en: "Get Started",
    fr: "Commencer",
    ar: "ابدأ الآن"
  },
  "index.login.desc": {
    en: "Log in to access your academic portal",
    fr: "Connectez-vous pour accéder à votre portail académique",
    ar: "سجل الدخول للوصول إلى بوابتك الأكاديمية"
  },
  "index.for.professors": {
    en: "For Professors",
    fr: "Pour les professeurs",
    ar: "للأساتذة"
  },
  "index.professors.desc": {
    en: "Create and manage courses, set up exercises and exams, and track student progress.",
    fr: "Créez et gérez des cours, configurez des exercices et des examens, et suivez les progrès des étudiants.",
    ar: "إنشاء وإدارة الدورات، وإعداد التمارين والامتحانات، وتتبع تقدم الطلاب."
  },
  "index.for.students": {
    en: "For Students",
    fr: "Pour les étudiants",
    ar: "للطلاب"
  },
  "index.students.desc": {
    en: "Access course materials, complete exercises, and stay prepared for upcoming exams.",
    fr: "Accédez aux supports de cours, complétez les exercices et restez préparé pour les examens à venir.",
    ar: "الوصول إلى مواد الدورة، وإكمال التمارين، والاستعداد للامتحانات القادمة."
  },
  "index.login.account": {
    en: "Log In to Your Account",
    fr: "Connectez-vous à votre compte",
    ar: "سجل الدخول إلى حسابك"
  },
  "index.course.management": {
    en: "Course Management",
    fr: "Gestion des cours",
    ar: "إدارة الدورات"
  },
  "index.course.management.desc": {
    en: "Organize and control visibility of course materials for your students.",
    fr: "Organisez et contrôlez la visibilité des supports de cours pour vos étudiants.",
    ar: "تنظيم والتحكم في رؤية مواد الدورة لطلابك."
  },
  "index.exercise.tracking": {
    en: "Exercise Tracking",
    fr: "Suivi des exercices",
    ar: "تتبع التمارين"
  },
  "index.exercise.tracking.desc": {
    en: "Create exercises with deadlines and control when they're available.",
    fr: "Créez des exercices avec des délais et contrôlez quand ils sont disponibles.",
    ar: "إنشاء تمارين مع مواعيد نهائية والتحكم في توقيت توفرها."
  },
  "index.exam.scheduling": {
    en: "Exam Scheduling",
    fr: "Planification des examens",
    ar: "جدولة الامتحانات"
  },
  "index.exam.scheduling.desc": {
    en: "Schedule and manage exams with detailed timing and visibility controls.",
    fr: "Planifiez et gérez les examens avec des contrôles détaillés de timing et de visibilité.",
    ar: "جدولة وإدارة الامتحانات مع ضوابط مفصلة للتوقيت والرؤية."
  },
  "index.login.now": {
    en: "Log In Now",
    fr: "Se connecter maintenant",
    ar: "سجل الدخول الآن"
  },
  
  // Login
  "login.title": {
    en: "Course Harmony",
    fr: "Harmonie des Cours",
    ar: "تناغم الدورات"
  },
  "login.subtitle": {
    en: "Login to access your academic portal",
    fr: "Connectez-vous pour accéder à votre portail académique",
    ar: "سجل الدخول للوصول إلى بوابتك الأكاديمية"
  },
  "login.forgot": {
    en: "Forgot password?",
    fr: "Mot de passe oublié ?",
    ar: "نسيت كلمة المرور؟"
  },
  "login.logging": {
    en: "Logging in...",
    fr: "Connexion en cours...",
    ar: "جاري تسجيل الدخول..."
  },
  "login.demo": {
    en: "Demo Logins",
    fr: "Connexions de démonstration",
    ar: "تسجيل دخول تجريبي"
  },
  
  // NotFound
  "notfound.title": {
    en: "Oops! Page not found",
    fr: "Oups ! Page non trouvée",
    ar: "عذراً! الصفحة غير موجودة"
  },
  "notfound.home": {
    en: "Return to Home",
    fr: "Retour à l'accueil",
    ar: "العودة إلى الصفحة الرئيسية"
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
  getDirection: () => "ltr" | "rtl";
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Get saved language or default to English
  const [language, setLanguage] = useState<Language>(() => {
    const savedLanguage = localStorage.getItem("maataoui-language");
    return (savedLanguage as Language) || "en";
  });

  // Save language to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("maataoui-language", language);
    
    // Set the dir attribute on the document for RTL support
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    
    // Add a class to the body for RTL styling
    if (language === "ar") {
      document.body.classList.add("rtl");
    } else {
      document.body.classList.remove("rtl");
    }
  }, [language]);

  // Translation function
  const t = (key: string): string => {
    if (!translations[key]) {
      console.warn(`Translation missing for key: ${key}`);
      return key;
    }
    return translations[key][language];
  };

  // Get text direction based on language
  const getDirection = (): "ltr" | "rtl" => {
    return language === "ar" ? "rtl" : "ltr";
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, getDirection }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

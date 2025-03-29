
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
    const savedLanguage = localStorage.getItem("courseHarmonyLanguage");
    return (savedLanguage as Language) || "en";
  });

  // Save language to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("courseHarmonyLanguage", language);
    
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

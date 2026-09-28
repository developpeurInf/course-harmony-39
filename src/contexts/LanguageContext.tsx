
import React, { createContext, useContext, useState, useEffect } from "react";
import { translateToArabic } from "@/lib/arabic-translations";
import { translateToFrench } from "@/lib/french-translations";

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
      en: "Math infini ∞",
      fr: "Math infini ∞",
      ar: "Math infini ∞"
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
  

  // Profile translations
  "Personal Information": {
    en: "Personal Information",
    fr: "Informations personnelles",
    ar: "المعلومات الشخصية"
  },
  "Update your personal details and account information": {
    en: "Update your personal details and account information",
    fr: "Mettez à jour vos informations personnelles et votre compte",
    ar: "تحديث بياناتك الشخصية ومعلومات حسابك"
  },
  "Full Name": {
    en: "Full Name",
    fr: "Nom complet",
    ar: "الاسم الكامل"
  },
  "Enter your full name": {
    en: "Enter your full name",
    fr: "Entrez votre nom complet",
    ar: "أدخل اسمك الكامل"
  },
  "Email Address": {
    en: "Email Address",
    fr: "Adresse email",
    ar: "البريد الإلكتروني"
  },
  "Email cannot be changed. Contact support if you need to update it.": {
    en: "Email cannot be changed. Contact support if you need to update it.",
    fr: "L'adresse email ne peut pas être modifiée. Contactez le support si nécessaire.",
    ar: "لا يمكن تغيير البريد الإلكتروني. اتصل بالدعم إذا كنت بحاجة إلى تحديثه."
  },
  "Role": {
    en: "Role",
    fr: "Rôle",
    ar: "الدور"
  },
  "Student": {
    en: "Student",
    fr: "Élève",
    ar: "تلميذ"
  },
  "Professor": {
    en: "Professor",
    fr: "Professeur",
    ar: "أستاذ"
  },
  "Edit Profile": {
    en: "Edit Profile",
    fr: "Modifier le profil",
    ar: "تعديل الملف الشخصي"
  },
  "Save Changes": {
    en: "Save Changes",
    fr: "Enregistrer les modifications",
    ar: "حفظ التغييرات"
  },
  "Saving...": {
    en: "Saving...",
    fr: "Enregistrement...",
    ar: "جاري الحفظ..."
  },
  "Profile Picture": {
    en: "Profile Picture",
    fr: "Photo de profil",
    ar: "صورة الملف الشخصي"
  },
  "Upload a profile picture to personalize your account": {
    en: "Upload a profile picture to personalize your account",
    fr: "Téléversez une photo de profil pour personnaliser votre compte",
    ar: "قم برفع صورة للملف الشخصي لإضفاء طابع شخصي على حسابك"
  },
  "Change Photo": {
    en: "Change Photo",
    fr: "Changer la photo",
    ar: "تغيير الصورة"
  },
  "JPG, PNG or GIF. Max 5MB.": {
    en: "JPG, PNG or GIF. Max 5MB.",
    fr: "JPG, PNG ou GIF. Max 5 Mo.",
    ar: "JPG أو PNG أو GIF. الحد الأقصى 5 ميجابايت."
  },
  "Security": {
    en: "Security",
    fr: "Sécurité",
    ar: "الأمان"
  },
  "Manage your account security settings": {
    en: "Manage your account security settings",
    fr: "Gérer les paramètres de sécurité de votre compte",
    ar: "إدارة إعدادات أمان حسابك"
  },
  "Password": {
    en: "Password",
    fr: "Mot de passe",
    ar: "كلمة المرور"
  },
  "Reset your password via email": {
    en: "Reset your password via email",
    fr: "Réinitialisez votre mot de passe par email",
    ar: "إعادة تعيين كلمة المرور عبر البريد الإلكتروني"
  },
  "Reset": {
    en: "Reset",
    fr: "Réinitialiser",
    ar: "إعادة تعيين"
  },
  "Two-Factor Authentication": {
    en: "Two-Factor Authentication",
    fr: "Authentification à deux facteurs",
    ar: "المصادقة الثنائية"
  },
  "Coming soon: Add an extra layer of security to your account.": {
    en: "Coming soon: Add an extra layer of security to your account.",
    fr: "Bientôt disponible : ajoutez une couche de sécurité supplémentaire à votre compte.",
    ar: "قريباً: أضف طبقة أمان إضافية إلى حسابك."
  },
  "Manage your account settings and preferences": {
    en: "Manage your account settings and preferences",
    fr: "Gérer les paramètres et préférences de votre compte",
    ar: "إدارة إعدادات وتفضيلات حسابك"
  },

  // Reports
  "Reports & Analytics": {
    en: "Reports & Analytics",
    fr: "Rapports & Analyses",
    ar: "التقارير والتحليلات"
  },
  "Comprehensive insights into student performance and engagement": {
    en: "Comprehensive insights into student performance and engagement",
    fr: "Aperçu complet des performances et de l'engagement des élèves",
    ar: "رؤى شاملة حول أداء التلاميذ وتفاعلهم"
  },
  "Export": {
    en: "Export",
    fr: "Exporter",
    ar: "تصدير"
  },
  "Overview": {
    en: "Overview",
    fr: "Vue d'ensemble",
    ar: "نظرة عامة"
  },
  "Activity": {
    en: "Activity",
    fr: "Activité",
    ar: "النشاط"
  },
  "Total Students": {
    en: "Total Students",
    fr: "Total des élèves",
    ar: "إجمالي التلاميذ"
  },
  "Total Courses": {
    en: "Total Courses",
    fr: "Total des cours",
    ar: "إجمالي الدروس"
  },
  "Total Exams": {
    en: "Total Exams",
    fr: "Total des examens",
    ar: "إجمالي الامتحانات"
  },
  "Average Score": {
    en: "Average Score",
    fr: "Score moyen",
    ar: "متوسط النقاط"
  },
  "Across all rooms": {
    en: "Across all classes",
    fr: "Dans toutes les classes",
    ar: "في جميع الأقسام"
  },
  "Across all classes": {
    en: "Across all classes",
    fr: "Dans toutes les classes",
    ar: "في جميع الأقسام"
  },
  "Active courses": {
    en: "Active courses",
    fr: "Cours actifs",
    ar: "الدروس النشطة"
  },
  "Overall average": {
    en: "Overall average",
    fr: "Moyenne générale",
    ar: "المعدل العام"
  },
  "Across all courses": {
    en: "Across all courses",
    fr: "Dans tous les cours",
    ar: "في جميع الدروس"
  },
  "Performance Distribution": {
    en: "Performance Distribution",
    fr: "Distribution des performances",
    ar: "توزيع الأداء"
  },
  "Student performance by score ranges": {
    en: "Student performance by score ranges",
    fr: "Performance des élèves par tranches de notes",
    ar: "أداء التلاميذ حسب فئات الدرجات"
  },
  "Weekly Activity": {
    en: "Weekly Activity",
    fr: "Activité hebdomadaire",
    ar: "النشاط الأسبوعي"
  },
  "Student engagement over the last 7 days": {
    en: "Student engagement over the last 7 days",
    fr: "Engagement des élèves sur les 7 derniers jours",
    ar: "تفاعل التلاميذ خلال الأيام السبعة الماضية"
  },
  "Select room": {
    en: "Select a class",
    fr: "Sélectionner une classe",
    ar: "اختر القسم"
  },
  "Select a room to view reports": {
    en: "Select a class to view reports",
    fr: "Sélectionnez une classe pour afficher les rapports",
    ar: "اختر قسماً لعرض التقارير"
  },

  // Settings page
  "settings.theme.title": {
    en: "Theme",
    fr: "Thème",
    ar: "المظهر"
  },
  "settings.theme.description": {
    en: "Choose your preferred theme appearance",
    fr: "Choisissez l'apparence de thème préférée",
    ar: "اختر مظهر السمة المفضل لديك"
  },
  "settings.theme.select": {
    en: "Select theme",
    fr: "Sélectionner le thème",
    ar: "اختر المظهر"
  },
  "settings.theme.light": {
    en: "Light",
    fr: "Clair",
    ar: "فاتح"
  },
  "settings.theme.dark": {
    en: "Dark",
    fr: "Sombre",
    ar: "داكن"
  },
  "settings.theme.system": {
    en: "System",
    fr: "Système",
    ar: "النظام"
  },
  "settings.language.description": {
    en: "Choose your preferred language",
    fr: "Choisissez votre langue préférée",
    ar: "اختر لغتك المفضلة"
  },
  "settings.password.title": {
    en: "Password & Security",
    fr: "Mot de passe et sécurité",
    ar: "كلمة المرور والأمان"
  },
  "settings.password.description": {
    en: "Manage your account password",
    fr: "Gérer le mot de passe de votre compte",
    ar: "إدارة كلمة مرور حسابك"
  },
  "settings.password.student.description": {
    en: "Change your temporary password or request a reset from your professor",
    fr: "Changez votre mot de passe temporaire ou demandez une réinitialisation à votre professeur",
    ar: "غيّر كلمة مرورك المؤقتة أو اطلب إعادة تعيينها من أستاذك"
  },
  "settings.password.change": {
    en: "Change Password",
    fr: "Changer le mot de passe",
    ar: "تغيير كلمة المرور"
  },
  "settings.password.request.reset": {
    en: "Request Password Reset from Professor",
    fr: "Demander une réinitialisation du mot de passe au professeur",
    ar: "طلب إعادة تعيين كلمة المرور من الأستاذ"
  },
  "settings.password.requesting": {
    en: "Requesting...",
    fr: "Demande en cours...",
    ar: "جاري الطلب..."
  },
  "settings.password.note": {
    en: "Note: Click the button above to send a reset request to your professor. They will provide you with a new temporary password.",
    fr: "Note : Cliquez sur le bouton ci-dessus pour envoyer une demande de réinitialisation à votre professeur. Il vous fournira un nouveau mot de passe temporaire.",
    ar: "ملاحظة: انقر فوق الزر أعلاه لإرسال طلب إعادة التعيين إلى أستاذك. سيزودك بكلمة مرور مؤقتة جديدة."
  },
  "settings.notifications.title": {
    en: "Notifications",
    fr: "Notifications",
    ar: "الإشعارات"
  },
  "settings.notifications.description": {
    en: "Manage your notification preferences",
    fr: "Gérer vos préférences de notification",
    ar: "إدارة تفضيلات الإشعارات الخاصة بك"
  },
  "settings.notifications.push": {
    en: "Push Notifications",
    fr: "Notifications push",
    ar: "إشعارات الدفع"
  },
  "settings.notifications.push.desc": {
    en: "Receive notifications about updates and activity.",
    fr: "Recevez des notifications concernant les mises à jour et l'activité.",
    ar: "تلقي إشعارات حول التحديثات والنشاط."
  },
  "settings.notifications.email": {
    en: "Email Updates",
    fr: "Mises à jour par email",
    ar: "تحديثات البريد الإلكتروني"
  },
  "settings.notifications.email.desc": {
    en: "Receive email notifications about your account.",
    fr: "Recevez des notifications par email concernant votre compte.",
    ar: "تلقي إشعارات البريد الإلكتروني حول حسابك."
  },
  // Password Reset Manager (professor)
  "pwdReset.title": {
    en: "Password Reset Requests",
    fr: "Demandes de réinitialisation de mot de passe",
    ar: "طلبات إعادة تعيين كلمة المرور"
  },
  "pwdReset.description": {
    en: "Manage student password reset requests",
    fr: "Gérer les demandes de réinitialisation de mot de passe des élèves",
    ar: "إدارة طلبات إعادة تعيين كلمة المرور للتلاميذ"
  },
  "pwdReset.loading": {
    en: "Loading requests...",
    fr: "Chargement des demandes...",
    ar: "جاري تحميل الطلبات..."
  },
  "pwdReset.none": {
    en: "No pending password reset requests",
    fr: "Aucune demande de réinitialisation en attente",
    ar: "لا توجد طلبات إعادة تعيين معلقة"
  },
  "pwdReset.resetBtn": {
    en: "Reset Password",
    fr: "Réinitialiser le mot de passe",
    ar: "إعادة تعيين كلمة المرور"
  },
  "pwdReset.dialog.title": {
    en: "Reset Password",
    fr: "Réinitialiser le mot de passe",
    ar: "إعادة تعيين كلمة المرور"
  },
  "pwdReset.dialog.desc": {
    en: "Reset password for",
    fr: "Réinitialiser le mot de passe de",
    ar: "إعادة تعيين كلمة مرور"
  },
  "pwdReset.newPassword": {
    en: "New Temporary Password",
    fr: "Nouveau mot de passe temporaire",
    ar: "كلمة المرور المؤقتة الجديدة"
  },
  "pwdReset.placeholder": {
    en: "Enter new temporary password",
    fr: "Entrez le nouveau mot de passe temporaire",
    ar: "أدخل كلمة المرور المؤقتة الجديدة"
  },
  "pwdReset.generate": {
    en: "Generate",
    fr: "Générer",
    ar: "توليد"
  },
  "pwdReset.resetting": {
    en: "Resetting...",
    fr: "Réinitialisation...",
    ar: "جاري إعادة التعيين..."
  },
  "pwdReset.success": {
    en: "Student password reset successfully",
    fr: "Mot de passe de l'élève réinitialisé avec succès",
    ar: "تم إعادة تعيين كلمة مرور التلميذ بنجاح"
  },
  "pwdReset.error": {
    en: "Failed to reset student password",
    fr: "Échec de la réinitialisation du mot de passe",
    ar: "فشل في إعادة تعيين كلمة المرور"
  },
  "pwdReset.requestedAt": {
    en: "Requested",
    fr: "Demandé le",
    ar: "طُلب في"
  },

  // Navigation
  "nav.dashboard": {
    en: "Dashboard",
    fr: "Tableau de bord",
    ar: "لوحة التحكم"
  },
  "nav.rooms": {
    en: "Classes",
    fr: "Classes",
    ar: "الأقسام"
  },
  "nav.courses": {
    en: "Courses",
    fr: "Cours",
    ar: "الدروس"
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
    ar: "التلاميذ"
  },
  "nav.studentsActivities": {
    en: "Students Activities",
    fr: "Activités des étudiants",
    ar: "أنشطة التلاميذ"
  },
  "nav.reports": {
    en: "Reports",
    fr: "Rapports",
    ar: "التقارير"
  },
  "nav.diagnostic": {
    en: "Diagnostic Evaluation",
    fr: "Éval. Diagnostique",
    ar: "التقويم التشخيصي"
  },
  "nav.manageClasses": {
    en: "Manage Classes",
    fr: "Gérer les classes",
    ar: "إدارة الأقسام"
  },
  "nav.professor": {
    en: "Professor",
    fr: "Professeur",
    ar: "أستاذ"
  },
  "nav.student": {
    en: "Student",
    fr: "Étudiant",
    ar: "تلميذ"
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
  "auth.logout": {
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
    ar: "إضافة درس"
  },
  "course.edit": {
    en: "Edit Course",
    fr: "Modifier le cours",
    ar: "تعديل الدرس"
  },
  "course.delete": {
    en: "Delete Course",
    fr: "Supprimer le cours",
    ar: "حذف الدرس"
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
    ar: "إدارة دروسك وتمارينك وامتحاناتك"
  },
  "dashboard.student.subtitle": {
    en: "View your courses, assignments, and exams",
    fr: "Consultez vos cours, devoirs et examens",
    ar: "عرض دروسك ومهامك وامتحاناتك"
  },
  "dashboard.courses.professor": {
    en: "Total courses you manage",
    fr: "Total des cours que vous gérez",
    ar: "إجمالي الدروس التي تديرها"
  },
  "dashboard.courses.student": {
    en: "Courses you're enrolled in",
    fr: "Cours auxquels vous êtes inscrit",
    ar: "الدروس المسجل بها"
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
    ar: "إجمالي التلاميذ المسجلين"
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
    ar: "دروسك"
  },
  "dashboard.your.courses.professor": {
    en: "Courses you are teaching",
    fr: "Cours que vous enseignez",
    ar: "الدروس التي تدرسها"
  },
  "dashboard.your.courses.student": {
    en: "Courses you are enrolled in",
    fr: "Cours auxquels vous êtes inscrit",
    ar: "الدروس المسجل بها"
  },
  "dashboard.no.courses.student": {
    en: "You are not enrolled in any courses yet",
    fr: "Vous n'êtes inscrit à aucun cours pour le moment",
    ar: "لم تسجل في أي دروس بعد"
  },
  "dashboard.no.courses.professor": {
    en: "You haven't created any courses yet",
    fr: "Vous n'avez encore créé aucun cours",
    ar: "لم تنشئ أي دروس بعد"
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
    ar: "تلاميذ"
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
    ar: "تلميذ"
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
    ar: "ملخص دروسك ونشاطك الأكاديمي"
  },
  "profile.courses.teach": {
    en: "Courses You Teach",
    fr: "Cours que vous enseignez",
    ar: "الدروس التي تدرسها"
  },
  "profile.courses.enrolled": {
    en: "Your Enrolled Courses",
    fr: "Vos cours inscrits",
    ar: "دروسك المسجلة"
  },
  "profile.recent.activity": {
    en: "Recent Activity",
    fr: "Activité récente",
    ar: "النشاط الحديث"
  },
  "profile.no.courses": {
    en: "No courses found",
    fr: "Aucun cours trouvé",
    ar: "لم يتم العثور على دروس"
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
    ar: "درس غير معروفة"
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
    ar: "منصة شاملة للأساتذة لإدارة الدروس والتمارين والامتحانات"
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
    ar: "إنشاء وإدارة الدروس، وإعداد التمارين والامتحانات، وتتبع تقدم التلاميذ."
  },
  "index.for.students": {
    en: "For Students",
    fr: "Pour les étudiants",
    ar: "للتلاميذ"
  },
  "index.students.desc": {
    en: "Access course materials, complete exercises, and stay prepared for upcoming exams.",
    fr: "Accédez aux supports de cours, complétez les exercices et restez préparé pour les examens à venir.",
    ar: "الوصول إلى مواد الدرس، وإكمال التمارين، والاستعداد للامتحانات القادمة."
  },
  "index.login.account": {
    en: "Log In to Your Account",
    fr: "Connectez-vous à votre compte",
    ar: "سجل الدخول إلى حسابك"
  },
  "index.course.management": {
    en: "Course Management",
    fr: "Gestion des cours",
    ar: "إدارة الدروس"
  },
  "index.course.management.desc": {
    en: "Organize and control visibility of course materials for your students.",
    fr: "Organisez et contrôlez la visibilité des supports de cours pour vos étudiants.",
    ar: "تنظيم والتحكم في رؤية مواد الدرس لتلاميذك."
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
    ar: "تناغم الدروس"
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
  },
  
  // Students
  "student.edit": {
    en: "Edit Student",
    fr: "Modifier l'étudiant",
    ar: "تعديل التلميذ"
  },
  "student.edit.desc": {
    en: "Update the student's information below.",
    fr: "Mettez à jour les informations de l'étudiant ci-dessous.",
    ar: "قم بتحديث معلومات التلميذ أدناه."
  },
  "student.name": {
    en: "Full Name",
    fr: "Nom complet",
    ar: "الاسم الكامل"
  },
  "student.username": {
    en: "Code Massar",
    fr: "Code Massar",
    ar: "رمز مسار"
  },
  "student.email": {
    en: "Email",
    fr: "E-mail",
    ar: "البريد الإلكتروني"
  },
  "student.update": {
    en: "Update Student",
    fr: "Mettre à jour l'étudiant",
    ar: "تحديث التلميذ"
  },
  "student.updating": {
    en: "Updating...",
    fr: "Mise à jour...",
    ar: "جاري التحديث..."
  },
  "student.required": {
    en: "Name is required",
    fr: "Le nom est obligatoire",
    ar: "الاسم مطلوب"
  },
  "student.updated": {
    en: "Student updated successfully",
    fr: "Étudiant mis à jour avec succès",
    ar: "تم تحديث التلميذ بنجاح"
  },
  "student.update.failed": {
    en: "Failed to update student",
    fr: "Échec de la mise à jour de l'étudiant",
    ar: "فشل تحديث التلميذ"
  },
  "student.placeholder.name": {
    en: "Enter full name",
    fr: "Entrer le nom complet",
    ar: "أدخل الاسم الكامل"
  },
  "student.placeholder.username": {
    en: "Enter Code Massar",
    fr: "Entrer le Code Massar",
    ar: "أدخل رمز مسار"
  },
  "student.placeholder.email": {
    en: "Enter email",
    fr: "Entrer l'e-mail",
    ar: "أدخل البريد الإلكتروني"
  },
  
  // Password
  "password.change": {
    en: "Change Password",
    fr: "Changer le mot de passe",
    ar: "تغيير كلمة المرور"
  },
  "password.current": {
    en: "Current Password",
    fr: "Mot de passe actuel",
    ar: "كلمة المرور الحالية"
  },
  "password.temp": {
    en: "Temporary Password",
    fr: "Mot de passe temporaire",
    ar: "كلمة المرور المؤقتة"
  },
  "password.new": {
    en: "New Password",
    fr: "Nouveau mot de passe",
    ar: "كلمة مرور جديدة"
  },
  "password.confirm": {
    en: "Confirm New Password",
    fr: "Confirmer le nouveau mot de passe",
    ar: "تأكيد كلمة المرور الجديدة"
  },
  "password.update": {
    en: "Update Password",
    fr: "Mettre à jour le mot de passe",
    ar: "تحديث كلمة المرور"
  },
  "password.updating": {
    en: "Updating...",
    fr: "Mise à jour...",
    ar: "جاري التحديث..."
  },
  "password.mismatch": {
    en: "New passwords don't match",
    fr: "Les nouveaux mots de passe ne correspondent pas",
    ar: "كلمات المرور الجديدة غير متطابقة"
  },
  "password.length": {
    en: "Password must be at least 6 characters long",
    fr: "Le mot de passe doit contenir au moins 6 caractères",
    ar: "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل"
  },
  "password.incorrect": {
    en: "Current password is incorrect",
    fr: "Le mot de passe actuel est incorrect",
    ar: "كلمة المرور الحالية غير صحيحة"
  },
  "password.updated": {
    en: "Password updated successfully",
    fr: "Mot de passe mis à jour avec succès",
    ar: "تم تحديث كلمة المرور بنجاح"
  },
  "password.failed": {
    en: "Failed to update password",
    fr: "Échec de la mise à jour du mot de passe",
    ar: "فشل تحديث كلمة المرور"
  },
  "password.temp.desc": {
    en: "You're currently using a temporary password. Please set a new password.",
    fr: "Vous utilisez actuellement un mot de passe temporaire. Veuillez définir un nouveau mot de passe.",
    ar: "أنت تستخدم حالياً كلمة مرور مؤقتة. يرجى تعيين كلمة مرور جديدة."
  },
  "password.current.desc": {
    en: "Enter your current password and choose a new one.",
    fr: "Entrez votre mot de passe actuel et choisissez-en un nouveau.",
    ar: "أدخل كلمة المرور الحالية واختر واحدة جديدة."
  },
  
  // Theme
  "theme.light": {
    en: "Light",
    fr: "Clair",
    ar: "فاتح"
  },
  "theme.dark": {
    en: "Dark",
    fr: "Sombre",
    ar: "داكن"
  },
  "theme.system": {
    en: "System",
    fr: "Système",
    ar: "النظام"
  },
  "theme.toggle": {
    en: "Toggle theme",
    fr: "Changer de thème",
    ar: "تبديل المظهر"
  },
  
  // Students Management
  "students.management": {
    en: "Student Management",
    fr: "Gestion des étudiants",
    ar: "إدارة التلاميذ"
  },
  "students.manage.desc": {
    en: "Manage students enrolled in your courses",
    fr: "Gérer les étudiants inscrits à vos cours",
    ar: "إدارة التلاميذ المسجلين في دروسك"
  },
  "students.add": {
    en: "Add Student",
    fr: "Ajouter un étudiant",
    ar: "إضافة تلميذ"
  },
  "students.search": {
    en: "Search students by name or email...",
    fr: "Rechercher des étudiants par nom ou e-mail...",
    ar: "البحث عن التلاميذ بالاسم أو البريد الإلكتروني..."
  },
  "students.filter.course": {
    en: "Filter by course",
    fr: "Filtrer par cours",
    ar: "تصفية حسب الدرس"
  },
  "students.all.courses": {
    en: "All Courses",
    fr: "Tous les cours",
    ar: "جميع الدروس"
  },
  "students.enrolled.courses": {
    en: "Enrolled Courses:",
    fr: "Cours inscrits :",
    ar: "الدروس المسجلة:"
  },
  "students.enroll.in.course": {
    en: "Enroll in Course",
    fr: "Inscrire au cours",
    ar: "التسجيل في الدرس"
  },
  "students.enroll": {
    en: "Enroll",
    fr: "Inscrire",
    ar: "تسجيل"
  },
  "students.enroll.title": {
    en: "Enroll Student in Course",
    fr: "Inscrire l'étudiant au cours",
    ar: "تسجيل التلميذ في الدرس"
  },
  "students.enroll.desc": {
    en: "Select a course to enroll",
    fr: "Sélectionnez un cours pour inscrire",
    ar: "اختر درس للتسجيل"
  },
  "students.select.course": {
    en: "Select a course",
    fr: "Sélectionner un cours",
    ar: "اختر درس"
  },
  "students.already.enrolled": {
    en: "Already enrolled",
    fr: "Déjà inscrit",
    ar: "مسجل بالفعل"
  },
  "students.course": {
    en: "Course",
    fr: "Cours",
    ar: "الدرس"
  },
  "students.courses": {
    en: "courses",
    fr: "cours",
    ar: "دروس"
  },
  "students.loading": {
    en: "Loading students...",
    fr: "Chargement des étudiants...",
    ar: "جاري تحميل التلاميذ..."
  },
  "students.no.found": {
    en: "No Students Found",
    fr: "Aucun étudiant trouvé",
    ar: "لم يتم العثور على تلاميذ"
  },
  "students.no.match": {
    en: "No students match your current filters.",
    fr: "Aucun étudiant ne correspond à vos filtres actuels.",
    ar: "لا يوجد تلاميذ يطابقون المرشحات الحالية."
  },
  "students.no.enrolled": {
    en: "No students are enrolled in your courses yet.",
    fr: "Aucun étudiant n'est encore inscrit à vos cours.",
    ar: "لا يوجد تلاميذ مسجلون في دروسك حتى الآن."
  },
  "students.more.courses": {
    en: "more courses",
    fr: "cours supplémentaires",
    ar: "دروس إضافية"
  },
  "students.more": {
    en: "more",
    fr: "plus",
    ar: "المزيد"
  },
  
  // Students Activities
  "activities.title": {
    en: "Students Activities",
    fr: "Activités des étudiants",
    ar: "أنشطة التلاميذ"
  },
  "activities.desc": {
    en: "Monitor student activities, sessions, and online status",
    fr: "Surveiller les activités, les sessions et le statut en ligne des étudiants",
    ar: "مراقبة أنشطة التلاميذ والجلسات والحالة عبر الإنترنت"
  },
  "activities.student.activities": {
    en: "Student Activities",
    fr: "Activités des étudiants",
    ar: "أنشطة التلاميذ"
  },
  "activities.monitor": {
    en: "Monitor and track student engagement and activity",
    fr: "Surveiller et suivre l'engagement et l'activité des étudiants",
    ar: "مراقبة وتتبع مشاركة التلاميذ ونشاطهم"
  },
  "activities.export": {
    en: "Export Activities",
    fr: "Exporter les activités",
    ar: "تصدير الأنشطة"
  },
  "activities.total.students": {
    en: "Total Students",
    fr: "Total étudiants",
    ar: "إجمالي التلاميذ"
  },
  "activities.online.now": {
    en: "Online Now",
    fr: "En ligne maintenant",
    ar: "متصل الآن"
  },
  "activities.total.study.time": {
    en: "Total Study Time",
    fr: "Temps d'étude total",
    ar: "إجمالي وقت الدراسة"
  },
  "activities.today": {
    en: "Activities Today",
    fr: "Activités aujourd'hui",
    ar: "الأنشطة اليوم"
  },
  "activities.search": {
    en: "Search",
    fr: "Rechercher",
    ar: "بحث"
  },
  "activities.search.placeholder": {
    en: "Search students or activities...",
    fr: "Rechercher des étudiants ou des activités...",
    ar: "البحث عن التلاميذ أو الأنشطة..."
  },
  "activities.student.filter": {
    en: "Student",
    fr: "Étudiant",
    ar: "تلميذ"
  },
  "activities.all.students": {
    en: "All Students",
    fr: "Tous les étudiants",
    ar: "جميع التلاميذ"
  },
  "activities.select.student": {
    en: "Select student",
    fr: "Sélectionner un étudiant",
    ar: "اختر تلميذاً"
  },
  "activities.date.range": {
    en: "Date Range",
    fr: "Période",
    ar: "نطاق التاريخ"
  },
  "activities.last.week": {
    en: "Last Week",
    fr: "Dernière semaine",
    ar: "الأسبوع الماضي"
  },
  "activities.last.month": {
    en: "Last Month",
    fr: "Le mois dernier",
    ar: "الشهر الماضي"
  },
  "activities.last.3.months": {
    en: "Last 3 Months",
    fr: "3 derniers mois",
    ar: "آخر 3 أشهر"
  },
  "activities.activities": {
    en: "Activities",
    fr: "Activités",
    ar: "الأنشطة"
  },
  "activities.sessions": {
    en: "Sessions",
    fr: "Sessions",
    ar: "الجلسات"
  },
  "activities.online.students": {
    en: "Online Students",
    fr: "Étudiants en ligne",
    ar: "التلاميذ المتصلون"
  },
  "activities.no.online": {
    en: "No students are currently online",
    fr: "Aucun étudiant n'est actuellement en ligne",
    ar: "لا يوجد تلاميذ متصلون حالياً"
  },
  "activities.active.for": {
    en: "Active for",
    fr: "Actif depuis",
    ar: "نشط منذ"
  },
  "activities.last.active": {
    en: "Last active",
    fr: "Dernière activité",
    ar: "آخر نشاط"
  },
  "activities.tracking.ready": {
    en: "Activity Tracking Ready",
    fr: "Suivi des activités prêt",
    ar: "تتبع النشاط جاهز"
  },
  "activities.tracking.desc": {
    en: "The activity tracking system is set up. Student activities will appear here once students start using the platform.",
    fr: "Le système de suivi des activités est configuré. Les activités des étudiants apparaîtront ici une fois qu'ils commenceront à utiliser la plateforme.",
    ar: "تم إعداد نظام تتبع النشاط. ستظهر أنشطة التلاميذ هنا بمجرد أن يبدأوا في استخدام المنصة."
  },
  "activities.no.activities": {
    en: "No activities found",
    fr: "Aucune activité trouvée",
    ar: "لم يتم العثور على أنشطة"
  },
  "activities.no.sessions": {
    en: "No sessions found",
    fr: "Aucune session trouvée",
    ar: "لم يتم العثور على جلسات"
  },
  "activities.session.started": {
    en: "Session started",
    fr: "Session démarrée",
    ar: "بدأت الجلسة"
  },
  "activities.duration": {
    en: "Duration",
    fr: "Durée",
    ar: "المدة"
  },
  "activities.minutes": {
    en: "minutes",
    fr: "minutes",
    ar: "دقائق"
  },
  "activities.active": {
    en: "Active",
    fr: "Actif",
    ar: "نشط"
  },
  "activities.ended": {
    en: "Ended",
    fr: "Terminé",
    ar: "انتهى"
  },
  
  // Dashboard Welcome
  "dashboard.welcome.platform": {
    en: "Welcome to Your Teaching Platform",
    fr: "Bienvenue sur votre plateforme d'enseignement",
    ar: "مرحباً بك في منصة التدريس الخاصة بك"
  },
  "dashboard.get.started": {
    en: "Get started by creating your first room. Rooms help you organize your courses, students, and academic content.",
    fr: "Commencez par créer votre première salle. Les salles vous aident à organiser vos cours, étudiants et contenu académique.",
    ar: "ابدأ بإنشاء غرفتك الأولى. تساعدك الغرف في تنظيم دروسك وتلاميذك والمحتوى الأكاديمي."
  },
  "dashboard.create.first.room": {
    en: "Create Your First Class",
    fr: "Créer votre première classe",
    ar: "إنشاء قسمك الأول"
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
  // Get saved language or default to French
  const [language, setLanguageState] = useState<Language>(() => {
    const savedLanguage = localStorage.getItem("maataoui-language");
    return (savedLanguage as Language) || "ar";
  });

  const setLanguage = (newLang: Language) => {
    if (newLang === language) return;
    localStorage.setItem("maataoui-language", newLang);
    setLanguageState(newLang);
    setTimeout(() => {
      window.location.reload();
    }, 50);
  };

  // Save language to localStorage and handle RTL and Arabic translation
  useEffect(() => {
    localStorage.setItem("maataoui-language", language);
    
    // Set the dir attribute on the document for RTL support
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = language;
    document.documentElement.setAttribute("translate", "no");
    document.documentElement.classList.add("notranslate");
    
    // Add a class to the body for RTL styling
    if (language === "ar") {
      document.body.classList.add("rtl");
    } else {
      document.body.classList.remove("rtl");
    }

    if (language === "ar") {
      const translator = language === "ar" ? translateToArabic : translateToFrench;

      const translateNode = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const val = node.nodeValue;
          if (val && val.trim()) {
            const trimmed = val.trim();
            const translated = translator(trimmed);
            if (translated && translated !== trimmed) {
              node.nodeValue = val.replace(trimmed, translated);
            }
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (["SCRIPT", "STYLE", "CODE", "PRE"].includes(el.tagName)) return;
          
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            if (el.placeholder) {
              const transPh = translator(el.placeholder);
              if (transPh && transPh !== el.placeholder) {
                el.placeholder = transPh;
              }
            }
          }
          if (el.title) {
            const transTitle = translator(el.title);
            if (transTitle && transTitle !== el.title) {
              el.title = transTitle;
            }
          }
          for (let i = 0; i < el.childNodes.length; i++) {
            translateNode(el.childNodes[i]);
          }
        }
      };

      // Scan initial DOM
      translateNode(document.body);

      // Mutation observer to dynamically translate new elements & texts
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === "childList") {
            mutation.addedNodes.forEach((node) => translateNode(node));
          } else if (mutation.type === "characterData") {
            const node = mutation.target;
            const val = node.nodeValue;
            if (val && val.trim()) {
              const trimmed = val.trim();
              const translated = translator(trimmed);
              if (translated && translated !== trimmed) {
                node.nodeValue = val.replace(trimmed, translated);
              }
            }
          }
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      return () => {
        observer.disconnect();
      };
    }
  }, [language]);

  // Translation function
  const t = (key: string): string => {
    if (translations[key]) {
      if (language === "en") {
        return translations[key].en || key;
      }
      if (language === "fr") {
        return translations[key].fr || translateToFrench(key);
      }
      if (language === "ar") {
        return translations[key].ar || translateToArabic(key);
      }
    }
    if (language === "ar") {
      const ar = translateToArabic(key);
      if (ar && ar !== key) return ar;
    }
    if (language === "fr") {
      const fr = translateToFrench(key);
      if (fr && fr !== key) return fr;
    }
    return key;
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

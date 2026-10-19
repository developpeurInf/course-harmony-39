/**
 * Catalogue des habilitations (même contenu que la table public.permissions).
 * Toute nouvelle fonction de l'application ajoute sa clé ici ET dans une migration.
 */

export type PermissionKey =
  | "class.view"
  | "class.create"
  | "class.edit"
  | "class.clear"
  | "class.delete"
  | "student.view"
  | "student.create"
  | "student.import_excel"
  | "student.export_excel"
  | "student.edit"
  | "student.delete"
  | "student.reset_password"
  | "student.activity_view"
  | "course.view"
  | "course.edit"
  | "course.upload_pdf"
  | "course.upload_image"
  | "course.upload_video"
  | "course.delete"
  | "exercise.edit"
  | "exercise.publish"
  | "quiz.edit"
  | "exam.edit"
  | "quiz.math_editor"
  | "quiz.anti_cheat"
  | "quiz.publish"
  | "quiz.results_view"
  | "quiz.results_export"
  | "diagnostic.use"
  | "diagnostic.template1"
  | "diagnostic.template2"
  | "diagnostic.charts"
  | "diagnostic.export_pdf"
  | "reports.view"
  | "reports.export"
  | "notify.send"
  | "profile.edit"
  | "settings.edit";

export type QuotaKey =
  | "classes.max"
  | "students.max"
  | "storage.max_mb"
  | "video.max_mb"
  | "quiz.max_per_month";

export type AdminPermissionKey =
  | "admin.teachers.manage"
  | "admin.plans.manage"
  | "admin.subscriptions.manage"
  | "admin.payments.manage"
  | "admin.overrides.manage"
  | "admin.audit.view"
  | "admin.roles.manage"
  | "admin.settings.manage";

export const MODULE_LABELS: Record<string, { fr: string; ar: string; en: string }> = {
  "class": { fr: "Classes", ar: "الأقسام", en: "Classes" },
  "student": { fr: "Élèves", ar: "التلاميذ", en: "Students" },
  "course": { fr: "Cours", ar: "الدروس", en: "Courses" },
  "exercise": { fr: "Exercices", ar: "التمارين", en: "Exercises" },
  "quiz": { fr: "Quiz et examens", ar: "الاختبارات والامتحانات", en: "Quizzes & exams" },
  "diagnostic": { fr: "Évaluation diagnostique", ar: "التقويم التشخيصي", en: "Diagnostic assessment" },
  "reports": { fr: "Rapports", ar: "التقارير", en: "Reports" },
  "notify": { fr: "Notifications", ar: "الإشعارات", en: "Notifications" },
  "account": { fr: "Compte", ar: "الحساب", en: "Account" },
  "quota": { fr: "Quotas", ar: "الحصص", en: "Quotas" },
  "admin": { fr: "Administration", ar: "الإدارة", en: "Administration" },
};

export const PERMISSION_LABELS: Record<string, { module: string; fr: string; ar: string; en: string }> = {
  "class.view": { module: "class", fr: "Voir ses classes", ar: "عرض أقسامه", en: "View classes" },
  "class.create": { module: "class", fr: "Créer une classe", ar: "إنشاء قسم", en: "Create a class" },
  "class.edit": { module: "class", fr: "Renommer / modifier une classe", ar: "تعديل قسم", en: "Edit a class" },
  "class.clear": { module: "class", fr: "Vider une classe", ar: "إفراغ قسم", en: "Empty a class" },
  "class.delete": { module: "class", fr: "Supprimer une classe", ar: "حذف قسم", en: "Delete a class" },
  "student.view": { module: "student", fr: "Voir les élèves", ar: "عرض التلاميذ", en: "View students" },
  "student.create": { module: "student", fr: "Créer un élève à la main", ar: "إضافة تلميذ يدويا", en: "Create a student" },
  "student.import_excel": { module: "student", fr: "Importer des élèves depuis Excel", ar: "استيراد التلاميذ من Excel", en: "Import students from Excel" },
  "student.export_excel": { module: "student", fr: "Exporter les élèves vers Excel", ar: "تصدير التلاميذ إلى Excel", en: "Export students to Excel" },
  "student.edit": { module: "student", fr: "Modifier une fiche élève", ar: "تعديل بطاقة تلميذ", en: "Edit a student" },
  "student.delete": { module: "student", fr: "Supprimer un élève", ar: "حذف تلميذ", en: "Delete a student" },
  "student.reset_password": { module: "student", fr: "Réinitialiser le mot de passe d'un élève", ar: "إعادة تعيين كلمة مرور تلميذ", en: "Reset a student's password" },
  "student.activity_view": { module: "student", fr: "Suivre les activités et connexions", ar: "تتبع الأنشطة والاتصالات", en: "Track activity and sessions" },
  "course.view": { module: "course", fr: "Voir les cours", ar: "عرض الدروس", en: "View courses" },
  "course.edit": { module: "course", fr: "Créer / modifier un cours", ar: "إنشاء / تعديل درس", en: "Create / edit a course" },
  "course.upload_pdf": { module: "course", fr: "Joindre des documents (PDF…)", ar: "إرفاق وثائق (PDF…)", en: "Attach documents (PDF…)" },
  "course.upload_image": { module: "course", fr: "Joindre des images", ar: "إرفاق صور", en: "Attach images" },
  "course.upload_video": { module: "course", fr: "Joindre des vidéos", ar: "إرفاق فيديوهات", en: "Attach videos" },
  "course.delete": { module: "course", fr: "Supprimer un cours", ar: "حذف درس", en: "Delete a course" },
  "exercise.edit": { module: "exercise", fr: "Créer / modifier un exercice", ar: "إنشاء / تعديل تمرين", en: "Create / edit an exercise" },
  "exercise.publish": { module: "exercise", fr: "Publier un exercice aux élèves", ar: "نشر تمرين للتلاميذ", en: "Publish an exercise" },
  "quiz.edit": { module: "quiz", fr: "Créer / modifier un quiz", ar: "إنشاء / تعديل اختبار", en: "Create / edit a quiz" },
  "exam.edit": { module: "quiz", fr: "Créer / modifier un examen", ar: "إنشاء / تعديل امتحان", en: "Create / edit an exam" },
  "quiz.math_editor": { module: "quiz", fr: "Éditeur de formules mathématiques", ar: "محرر الصيغ الرياضية", en: "Math formula editor" },
  "quiz.anti_cheat": { module: "quiz", fr: "Anti-triche (plein écran, détection)", ar: "مكافحة الغش", en: "Anti-cheat" },
  "quiz.publish": { module: "quiz", fr: "Publier / programmer un quiz", ar: "نشر / برمجة اختبار", en: "Publish / schedule a quiz" },
  "quiz.results_view": { module: "quiz", fr: "Voir les résultats détaillés", ar: "عرض النتائج المفصلة", en: "View detailed results" },
  "quiz.results_export": { module: "quiz", fr: "Exporter les résultats", ar: "تصدير النتائج", en: "Export results" },
  "diagnostic.use": { module: "diagnostic", fr: "Utiliser l'évaluation diagnostique", ar: "استعمال التقويم التشخيصي", en: "Use diagnostic assessment" },
  "diagnostic.template1": { module: "diagnostic", fr: "Modèle de rapport 1", ar: "نموذج التقرير 1", en: "Report template 1" },
  "diagnostic.template2": { module: "diagnostic", fr: "Modèle de rapport 2", ar: "نموذج التقرير 2", en: "Report template 2" },
  "diagnostic.charts": { module: "diagnostic", fr: "Bibliothèque de graphiques", ar: "مكتبة المبيانات", en: "Chart library" },
  "diagnostic.export_pdf": { module: "diagnostic", fr: "Export PDF / impression du rapport", ar: "تصدير PDF / طباعة التقرير", en: "Export / print report" },
  "reports.view": { module: "reports", fr: "Tableaux de bord et rapports", ar: "لوحات القيادة والتقارير", en: "Dashboards and reports" },
  "reports.export": { module: "reports", fr: "Exporter les rapports", ar: "تصدير التقارير", en: "Export reports" },
  "notify.send": { module: "notify", fr: "Envoyer des notifications aux élèves", ar: "إرسال إشعارات للتلاميذ", en: "Send notifications" },
  "profile.edit": { module: "account", fr: "Modifier son profil et sa photo", ar: "تعديل الملف الشخصي والصورة", en: "Edit profile" },
  "settings.edit": { module: "account", fr: "Paramètres de l'application", ar: "إعدادات التطبيق", en: "App settings" },
  "classes.max": { module: "quota", fr: "Nombre de classes", ar: "عدد الأقسام", en: "Number of classes" },
  "students.max": { module: "quota", fr: "Nombre d'élèves (toutes classes)", ar: "عدد التلاميذ", en: "Number of students" },
  "storage.max_mb": { module: "quota", fr: "Stockage des fichiers (Mo)", ar: "مساحة التخزين (م.ب)", en: "File storage (MB)" },
  "video.max_mb": { module: "quota", fr: "Taille max d'une vidéo (Mo)", ar: "الحجم الأقصى للفيديو (م.ب)", en: "Max video size (MB)" },
  "quiz.max_per_month": { module: "quota", fr: "Quiz et examens créés par mois", ar: "الاختبارات المنشأة شهريا", en: "Quizzes created per month" },
  "admin.teachers.manage": { module: "admin", fr: "Gérer les professeurs", ar: "تدبير الأساتذة", en: "Manage teachers" },
  "admin.plans.manage": { module: "admin", fr: "Gérer les offres", ar: "تدبير العروض", en: "Manage plans" },
  "admin.subscriptions.manage": { module: "admin", fr: "Gérer les abonnements", ar: "تدبير الاشتراكات", en: "Manage subscriptions" },
  "admin.payments.manage": { module: "admin", fr: "Gérer les paiements", ar: "تدبير الأداءات", en: "Manage payments" },
  "admin.overrides.manage": { module: "admin", fr: "Gérer les habilitations par professeur", ar: "تدبير صلاحيات الأستاذ", en: "Manage teacher permissions" },
  "admin.audit.view": { module: "admin", fr: "Consulter le journal", ar: "الاطلاع على السجل", en: "View audit log" },
  "admin.roles.manage": { module: "admin", fr: "Gérer l'équipe d'administration", ar: "تدبير فريق الإدارة", en: "Manage admin team" },
  "admin.settings.manage": { module: "admin", fr: "Personnaliser l'application", ar: "تخصيص التطبيق", en: "Customize the app" },
};

export const ADMIN_PERMISSION_KEYS: AdminPermissionKey[] = ["admin.teachers.manage", "admin.plans.manage", "admin.subscriptions.manage", "admin.payments.manage", "admin.overrides.manage", "admin.audit.view", "admin.roles.manage", "admin.settings.manage"];

/** Type de fichier → permission d'ajout (même règle que le déclencheur SQL) */
export function uploadPermissionFor(fileName: string, mime = ""): PermissionKey {
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  if (mime.startsWith("video/") || ["mp4", "mov", "webm", "m4v", "avi", "mkv", "3gp", "ogv"].includes(ext)) return "course.upload_video";
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "bmp", "svg"].includes(ext)) return "course.upload_image";
  return "course.upload_pdf";
}

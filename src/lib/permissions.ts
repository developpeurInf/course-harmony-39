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
  | "class.duplicate"
  | "class.calendar"
  | "student.view"
  | "student.create"
  | "student.import_excel"
  | "student.export_excel"
  | "student.edit"
  | "student.delete"
  | "student.reset_password"
  | "student.activity_view"
  | "attendance.manage"
  | "student.groups"
  | "course.view"
  | "course.edit"
  | "course.upload_pdf"
  | "course.upload_image"
  | "course.upload_video"
  | "course.delete"
  | "lesson_log.manage"
  | "ai.lesson_plan"
  | "exercise.edit"
  | "exercise.publish"
  | "exercise.review"
  | "quiz.edit"
  | "exam.edit"
  | "quiz.math_editor"
  | "quiz.anti_cheat"
  | "quiz.publish"
  | "quiz.results_view"
  | "quiz.grade"
  | "quiz.bank"
  | "quiz.remediation"
  | "quiz.live"
  | "ai.quiz_generator"
  | "ai.omr"
  | "quiz.results_export"
  | "diagnostic.use"
  | "diagnostic.template1"
  | "diagnostic.template2"
  | "diagnostic.template3"
  | "diagnostic.template4"
  | "ai.diagnostic"
  | "diagnostic.charts"
  | "diagnostic.export_pdf"
  | "reports.view"
  | "reports.export"
  | "student.appreciations"
  | "reports.parent_report"
  | "gradebook.manage"
  | "notify.send"
  | "pdf.use"
  | "pdf.annotate"
  | "pdf.edit"
  | "pdf.layout"
  | "pdf.watermark_remove"
  | "pdf.organize"
  | "pdf.protect"
  | "profile.edit"
  | "settings.edit"
  | "parents.links"
  | "library.import"
  | "library.publish";

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
  | "admin.settings.manage"
  | "admin.support.manage"
  | "admin.library.manage";

/** Modules de l'application : mêmes identifiants que les interrupteurs de Personnalisation → Modules
 *  (FeatureKey) et que la colonne permissions.module. Ordre = barre latérale. */
export const MODULE_LABELS: Record<string, { fr: string; ar: string; en: string }> = {
  "classManagement": { fr: "Classes et gestion des classes", ar: "الأقسام وإدارتها", en: "Classes & class management" },
  "students": { fr: "Élèves", ar: "التلاميذ", en: "Students" },
  "studentActivities": { fr: "Suivi et classement", ar: "التتبع والترتيب", en: "Tracking & ranking" },
  "attendance": { fr: "Appel", ar: "الحضور والغياب", en: "Attendance" },
  "followUp": { fr: "Groupes et bilans", ar: "المجموعات والحصائل", en: "Groups & reports" },
  "gradebook": { fr: "Carnet de notes", ar: "دفتر النقط", en: "Gradebook" },
  "lessonLog": { fr: "Cahier de textes", ar: "دفتر النصوص", en: "Lesson log" },
  "calendar": { fr: "Calendrier", ar: "اليومية", en: "Calendar" },
  "courses": { fr: "Cours", ar: "الدروس", en: "Courses" },
  "lessonPlans": { fr: "Fiches pédagogiques (IA)", ar: "الجذاذات (ذكاء اصطناعي)", en: "Lesson plans (AI)" },
  "exercises": { fr: "Exercices", ar: "التمارين", en: "Exercises" },
  "exams": { fr: "Examens et quiz", ar: "الامتحانات والاختبارات", en: "Exams & quizzes" },
  "questionBank": { fr: "Banque de questions", ar: "بنك الأسئلة", en: "Question bank" },
  "diagnostic": { fr: "Évaluation diagnostique", ar: "التقويم التشخيصي", en: "Diagnostic assessment" },
  "reports": { fr: "Rapports", ar: "التقارير", en: "Reports" },
  "pdfEditor": { fr: "Éditeur PDF", ar: "محرر PDF", en: "PDF editor" },
  "parents": { fr: "Portail parents", ar: "فضاء الآباء", en: "Parent portal" },
  "library": { fr: "Bibliothèque partagée", ar: "المكتبة المشتركة", en: "Shared library" },
  "notifications": { fr: "Notifications", ar: "الإشعارات", en: "Notifications" },
  "account": { fr: "Compte", ar: "الحساب", en: "Account" },
  "quota": { fr: "Quotas", ar: "الحصص", en: "Quotas" },
  "admin": { fr: "Administration", ar: "الإدارة", en: "Administration" },
};

export const PERMISSION_LABELS: Record<string, { module: string; fr: string; ar: string; en: string }> = {
  "class.view": { module: "classManagement", fr: "Voir ses classes", ar: "عرض أقسامه", en: "View classes" },
  "class.create": { module: "classManagement", fr: "Créer une classe", ar: "إنشاء قسم", en: "Create a class" },
  "class.edit": { module: "classManagement", fr: "Renommer / modifier une classe", ar: "تعديل قسم", en: "Edit a class" },
  "class.clear": { module: "classManagement", fr: "Vider une classe", ar: "إفراغ قسم", en: "Empty a class" },
  "class.delete": { module: "classManagement", fr: "Supprimer une classe", ar: "حذف قسم", en: "Delete a class" },
  "class.duplicate": { module: "classManagement", fr: "Dupliquer et archiver une classe", ar: "نسخ وأرشفة قسم", en: "Duplicate and archive a class" },
  "parents.links": { module: "parents", fr: "Liens parents (bulletin en lecture seule)", ar: "روابط الآباء (كشف للاطلاع فقط)", en: "Parent links (read-only report)" },
  "library.import": { module: "library", fr: "Importer depuis la bibliothèque partagée", ar: "الاستيراد من المكتبة المشتركة", en: "Import from the shared library" },
  "library.publish": { module: "library", fr: "Publier dans la bibliothèque partagée", ar: "النشر في المكتبة المشتركة", en: "Publish to the shared library" },
  "class.calendar": { module: "calendar", fr: "Calendrier des échéances (exercices, quiz, examens)", ar: "يومية الآجال (تمارين، اختبارات، امتحانات)", en: "Due-date calendar (exercises, quizzes, exams)" },
  "student.view": { module: "students", fr: "Voir les élèves", ar: "عرض التلاميذ", en: "View students" },
  "student.create": { module: "students", fr: "Créer un élève à la main", ar: "إضافة تلميذ يدويا", en: "Create a student" },
  "student.import_excel": { module: "students", fr: "Importer des élèves depuis Excel", ar: "استيراد التلاميذ من Excel", en: "Import students from Excel" },
  "student.export_excel": { module: "students", fr: "Exporter les élèves vers Excel", ar: "تصدير التلاميذ إلى Excel", en: "Export students to Excel" },
  "student.edit": { module: "students", fr: "Modifier une fiche élève", ar: "تعديل بطاقة تلميذ", en: "Edit a student" },
  "student.delete": { module: "students", fr: "Supprimer un élève", ar: "حذف تلميذ", en: "Delete a student" },
  "student.reset_password": { module: "students", fr: "Réinitialiser le mot de passe d'un élève", ar: "إعادة تعيين كلمة مرور تلميذ", en: "Reset a student's password" },
  "student.activity_view": { module: "studentActivities", fr: "Suivre les activités et connexions", ar: "تتبع الأنشطة والاتصالات", en: "Track activity and sessions" },
  "attendance.manage": { module: "attendance", fr: "Faire l'appel (présences)", ar: "تسجيل الحضور والغياب", en: "Take attendance" },
  "student.groups": { module: "followUp", fr: "Groupes de besoin", ar: "مجموعات الحاجة", en: "Need-based groups" },
  "course.view": { module: "courses", fr: "Voir les cours", ar: "عرض الدروس", en: "View courses" },
  "course.edit": { module: "courses", fr: "Créer / modifier un cours", ar: "إنشاء / تعديل درس", en: "Create / edit a course" },
  "course.upload_pdf": { module: "courses", fr: "Joindre des documents (PDF…)", ar: "إرفاق وثائق (PDF…)", en: "Attach documents (PDF…)" },
  "course.upload_image": { module: "courses", fr: "Joindre des images", ar: "إرفاق صور", en: "Attach images" },
  "course.upload_video": { module: "courses", fr: "Joindre des vidéos", ar: "إرفاق فيديوهات", en: "Attach videos" },
  "course.delete": { module: "courses", fr: "Supprimer un cours", ar: "حذف درس", en: "Delete a course" },
  "lesson_log.manage": { module: "lessonLog", fr: "Cahier de textes", ar: "دفتر النصوص", en: "Lesson log" },
  "ai.lesson_plan": { module: "lessonPlans", fr: "Fiche pédagogique avec l'IA", ar: "جذاذة بالذكاء الاصطناعي", en: "AI lesson plan" },
  "exercise.edit": { module: "exercises", fr: "Créer / modifier un exercice", ar: "إنشاء / تعديل تمرين", en: "Create / edit an exercise" },
  "exercise.publish": { module: "exercises", fr: "Publier un exercice aux élèves", ar: "نشر تمرين للتلاميذ", en: "Publish an exercise" },
  "exercise.review": { module: "exercises", fr: "Recevoir et corriger les copies d'exercices", ar: "استلام وتصحيح أوراق التمارين", en: "Receive and grade exercise submissions" },
  "quiz.edit": { module: "exams", fr: "Créer / modifier un quiz", ar: "إنشاء / تعديل اختبار", en: "Create / edit a quiz" },
  "exam.edit": { module: "exams", fr: "Créer / modifier un examen", ar: "إنشاء / تعديل امتحان", en: "Create / edit an exam" },
  "quiz.math_editor": { module: "exams", fr: "Éditeur de formules mathématiques", ar: "محرر الصيغ الرياضية", en: "Math formula editor" },
  "quiz.anti_cheat": { module: "exams", fr: "Anti-triche (plein écran, détection)", ar: "مكافحة الغش", en: "Anti-cheat" },
  "quiz.publish": { module: "exams", fr: "Publier / programmer un quiz", ar: "نشر / برمجة اختبار", en: "Publish / schedule a quiz" },
  "quiz.results_view": { module: "exams", fr: "Voir les résultats détaillés", ar: "عرض النتائج المفصلة", en: "View detailed results" },
  "quiz.grade": { module: "exams", fr: "Corriger les réponses rédigées", ar: "تصحيح الإجابات المكتوبة", en: "Grade written answers" },
  "quiz.bank": { module: "questionBank", fr: "Banque de questions", ar: "بنك الأسئلة", en: "Question bank" },
  "quiz.remediation": { module: "exams", fr: "Quiz de remédiation en un clic", ar: "اختبار الدعم بنقرة واحدة", en: "One-click remediation quiz" },
  "quiz.live": { module: "exams", fr: "Quiz en direct en classe", ar: "اختبار مباشر في القسم", en: "Live in-class quiz" },
  "ai.quiz_generator": { module: "exams", fr: "Générer un quiz avec l'IA à partir d'un cours", ar: "توليد اختبار بالذكاء الاصطناعي من درس", en: "Generate a quiz from a course with AI" },
  "ai.omr": { module: "exams", fr: "Corriger des QCM papier par photo", ar: "تصحيح أوراق الاختيار من متعدد بالصور", en: "Grade paper multiple-choice sheets from photos" },
  "quiz.results_export": { module: "exams", fr: "Exporter les résultats", ar: "تصدير النتائج", en: "Export results" },
  "diagnostic.use": { module: "diagnostic", fr: "Utiliser l'évaluation diagnostique", ar: "استعمال التقويم التشخيصي", en: "Use diagnostic assessment" },
  "diagnostic.template1": { module: "diagnostic", fr: "Modèle de rapport 1", ar: "نموذج التقرير 1", en: "Report template 1" },
  "diagnostic.template2": { module: "diagnostic", fr: "Modèle de rapport 2", ar: "نموذج التقرير 2", en: "Report template 2" },
  "diagnostic.template3": { module: "diagnostic", fr: "Modèle 3 : analyse des acquis et plan de remédiation", ar: "النموذج 3: تحليل النتائج وخطة الدعم", en: "Template 3: analysis and remediation plan" },
  "diagnostic.template4": { module: "diagnostic", fr: "Modèle 4 : groupes de besoin (listes nominatives)", ar: "النموذج 4: لوائح فئات الدعم", en: "Template 4: need-based groups" },
  "ai.diagnostic": { module: "diagnostic", fr: "Analyse de l'évaluation diagnostique par l'IA", ar: "تحليل التقويم التشخيصي بالذكاء الاصطناعي", en: "AI analysis of the diagnostic assessment" },
  "diagnostic.charts": { module: "diagnostic", fr: "Bibliothèque de graphiques", ar: "مكتبة المبيانات", en: "Chart library" },
  "diagnostic.export_pdf": { module: "diagnostic", fr: "Export PDF / impression du rapport", ar: "تصدير PDF / طباعة التقرير", en: "Export / print report" },
  "reports.view": { module: "reports", fr: "Tableaux de bord et rapports", ar: "لوحات القيادة والتقارير", en: "Dashboards and reports" },
  "reports.export": { module: "reports", fr: "Exporter les rapports", ar: "تصدير التقارير", en: "Export reports" },
  "student.appreciations": { module: "followUp", fr: "Appréciations des bulletins", ar: "ملاحظات النشرات", en: "Report card comments" },
  "reports.parent_report": { module: "followUp", fr: "Bilan par élève pour les parents", ar: "حصيلة التلميذ للآباء", en: "Student report for parents" },
  "gradebook.manage": { module: "gradebook", fr: "Carnet de notes et export Massar", ar: "دفتر النقط والتصدير إلى مسار", en: "Gradebook and Massar export" },
  "pdf.use": { module: "pdfEditor", fr: "Ouvrir l'éditeur PDF (lire, télécharger, mode tableau)", ar: "فتح محرر PDF (قراءة، تحميل، وضع السبورة)", en: "Open the PDF editor (read, download, board mode)" },
  "pdf.annotate": { module: "pdfEditor", fr: "Annoter un PDF (surligner, dessiner, notes)", ar: "التعليق على PDF (تظليل، رسم، ملاحظات)", en: "Annotate a PDF (highlight, draw, notes)" },
  "pdf.edit": { module: "pdfEditor", fr: "Modifier le texte, insérer images et signatures, formulaires", ar: "تعديل النص وإدراج الصور والتوقيعات والنماذج", en: "Edit text, insert images and signatures, forms" },
  "pdf.layout": { module: "pdfEditor", fr: "Filigrane, en-tête / pied de page et numéros de page", ar: "العلامة المائية والرأس والتذييل وترقيم الصفحات", en: "Watermark, header / footer and page numbers" },
  "pdf.watermark_remove": { module: "pdfEditor", fr: "Supprimer un filigrane ou des éléments répétés", ar: "حذف علامة مائية أو عناصر مكررة", en: "Remove a watermark or repeated elements" },
  "pdf.organize": { module: "pdfEditor", fr: "Organiser les pages (insérer, fusionner, scinder, pivoter)", ar: "تنظيم الصفحات (إدراج، دمج، تقسيم، تدوير)", en: "Organize pages (insert, merge, split, rotate)" },
  "pdf.protect": { module: "pdfEditor", fr: "Masquer des informations (caviardage)", ar: "إخفاء المعلومات", en: "Redact information" },
  "notify.send": { module: "notifications", fr: "Envoyer des notifications aux élèves", ar: "إرسال إشعارات للتلاميذ", en: "Send notifications" },
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
  "admin.support.manage": { module: "admin", fr: "Répondre aux tickets de support", ar: "الرد على تذاكر الدعم", en: "Answer support tickets" },
  "admin.library.manage": { module: "admin", fr: "Valider la bibliothèque partagée", ar: "المصادقة على المكتبة المشتركة", en: "Review the shared library" },
};

export const ADMIN_PERMISSION_KEYS: AdminPermissionKey[] = ["admin.teachers.manage", "admin.plans.manage", "admin.subscriptions.manage", "admin.payments.manage", "admin.overrides.manage", "admin.audit.view", "admin.roles.manage", "admin.settings.manage", "admin.support.manage", "admin.library.manage"];

/** Type de fichier → permission d'ajout (même règle que le déclencheur SQL) */
export function uploadPermissionFor(fileName: string, mime = ""): PermissionKey {
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  if (mime.startsWith("video/") || ["mp4", "mov", "webm", "m4v", "avi", "mkv", "3gp", "ogv"].includes(ext)) return "course.upload_video";
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "bmp", "svg"].includes(ext)) return "course.upload_image";
  return "course.upload_pdf";
}

/** Modules toujours visibles (ne peuvent pas être retirés par une offre) */
export const ALWAYS_ON_MODULES = ["account", "quota", "admin"];

/** Module d'une habilitation (catalogue du code, sinon la valeur venue de la base) */
export const moduleOf = (key: string, fallback?: string): string => PERMISSION_LABELS[key]?.module || fallback || "account";

/** Habilitations (fonctions) d'un module */
export const moduleKeys = (module: string): PermissionKey[] =>
  Object.keys(PERMISSION_LABELS).filter((k) => PERMISSION_LABELS[k].module === module) as PermissionKey[];

/** Un module est inclus dès qu'au moins une de ses fonctions l'est ; sinon il est masqué. */
export const moduleIncluded = (module: string, can: (k: PermissionKey) => boolean): boolean => {
  if (ALWAYS_ON_MODULES.includes(module)) return true;
  const keys = moduleKeys(module);
  return keys.length === 0 || keys.some((k) => can(k));
};

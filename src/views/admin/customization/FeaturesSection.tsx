import { LayoutGrid } from "lucide-react";
import type { FeatureKey } from "@/lib/appSettings";
import { useT } from "../adminShared";
import { Card, SwitchRow, type SectionProps } from "./shared";

export default function FeaturesSection({ draft, update }: SectionProps) {
  const { L } = useT();
  const f = draft.features;
  type Item = { k: FeatureKey; label: string; desc: string };
  // Même ordre que la barre latérale
  const groups: { title: string; items: Item[] }[] = [
    {
      title: L("Classes (menu de chaque classe)", "الأقسام (قائمة كل قسم)", "Classes (each class menu)"),
      items: [
        { k: "students", label: L("Élèves", "التلاميذ", "Students"), desc: L("Liste des élèves de la classe, ajout et import.", "لائحة تلاميذ القسم والإضافة والاستيراد.", "Class student list, adding and import.") },
        { k: "studentActivities", label: L("Suivi et classement", "التتبع والترتيب", "Tracking & ranking"), desc: L("Suivi des connexions, de l'activité et classement par classe.", "تتبع الاتصالات والنشاط والترتيب حسب القسم.", "Sessions, activity and ranking per class.") },
        { k: "attendance", label: L("Appel", "الحضور والغياب", "Attendance"), desc: L("Présences, absences et retards par séance.", "الحضور والغياب والتأخر حسب الحصة.", "Presence, absences and lates per session.") },
        { k: "followUp", label: L("Groupes et bilans", "المجموعات والحصائل", "Groups & reports"), desc: L("Groupes de besoin, appréciations et bilans pour les parents.", "مجموعات الحاجة والملاحظات وحصائل الآباء.", "Need-based groups, comments and parent reports.") },
        { k: "gradebook", label: L("Carnet de notes", "دفتر النقط", "Gradebook"), desc: L("Notes des devoirs et contrôles, export Massar.", "نقط الفروض والمراقبة والتصدير إلى مسار.", "Homework and test marks, Massar export.") },
        { k: "lessonLog", label: L("Cahier de textes", "دفتر النصوص", "Lesson log"), desc: L("Séances, contenu et travail à faire, lisible par les élèves.", "الحصص والمحتوى والواجبات، يطلع عليها التلاميذ.", "Sessions, content and homework, visible to students.") },
        { k: "calendar", label: L("Calendrier", "اليومية", "Calendar"), desc: L("Dates limites des exercices, quiz et examens.", "آجال التمارين والاختبارات والامتحانات.", "Due dates of exercises, quizzes and exams.") },
        { k: "courses", label: L("Cours", "الدروس", "Courses"), desc: L("Supports de cours (PDF, images, vidéos) partagés avec les classes.", "مواد الدروس (PDF، صور، فيديو) المشاركة مع الأقسام.", "Course materials (PDF, images, videos) shared with classes.") },
        { k: "exercises", label: L("Exercices", "التمارين", "Exercises"), desc: L("Exercices et quiz d'entraînement des élèves.", "تمارين واختبارات تدريب التلاميذ.", "Exercises and practice quizzes for students.") },
        { k: "exams", label: L("Examens et quiz", "الامتحانات والاختبارات", "Exams & quizzes"), desc: L("Évaluations notées et programmées.", "تقويمات منقطة ومبرمجة.", "Graded, scheduled assessments.") },
      ],
    },
    {
      title: L("Outils du professeur", "أدوات الأستاذ", "Teacher tools"),
      items: [
        { k: "questionBank", label: L("Banque de questions", "بنك الأسئلة", "Question bank"), desc: L("Questions réutilisables dans tous les quiz.", "أسئلة قابلة لإعادة الاستعمال في كل الاختبارات.", "Questions reusable in every quiz.") },
        { k: "lessonPlans", label: L("Fiches pédagogiques", "الجذاذات", "Lesson plans"), desc: L("Fiches de préparation générées avec l'IA.", "جذاذات التحضير المولدة بالذكاء الاصطناعي.", "AI-generated lesson plans.") },
        { k: "reports", label: L("Rapports", "التقارير", "Reports"), desc: L("Tableaux de bord et rapports de résultats.", "لوحات القيادة وتقارير النتائج.", "Dashboards and results reports.") },
        { k: "diagnostic", label: L("Évaluation diagnostique", "التقويم التشخيصي", "Diagnostic assessment"), desc: L("Grilles diagnostiques et rapports PDF associés.", "شبكات التقويم التشخيصي وتقارير PDF المرتبطة.", "Diagnostic grids and related PDF reports.") },
        { k: "pdfEditor", label: L("Éditeur PDF", "محرر PDF", "PDF editor"), desc: L("Annoter, modifier, organiser et masquer des PDF, puis les joindre à un cours.", "تعليق وتعديل وتنظيم وإخفاء ملفات PDF ثم إرفاقها بدرس.", "Annotate, edit, organize and redact PDFs, then attach them to a course.") },
        { k: "classManagement", label: L("Gestion des classes", "إدارة الأقسام", "Manage classes"), desc: L("Page de gestion de toutes les classes (renommer, vider, supprimer).", "صفحة إدارة جميع الأقسام (إعادة التسمية، الإفراغ، الحذف).", "Page to manage all classes (rename, empty, delete).") },
      ],
    },
    {
      title: L("Espaces complémentaires", "فضاءات إضافية", "Extra spaces"),
      items: [
        { k: "parents", label: L("Portail parents", "فضاء الآباء", "Parent portal"), desc: L("Lien de suivi en lecture seule pour les parents : notes, absences, devoirs, messages.", "رابط تتبع للآباء: النقط والغياب والواجبات والرسائل.", "Read-only link for parents: marks, absences, homework, messages.") },
        { k: "library", label: L("Bibliothèque partagée", "المكتبة المشتركة", "Shared library"), desc: L("Cours, quiz et fiches partagés entre professeurs, validés par l'administration.", "دروس واختبارات وجذاذات مشتركة بين الأساتذة بعد مصادقة الإدارة.", "Courses, quizzes and plans shared between teachers, approved by admins.") },
        { k: "support", label: L("Aide et support", "المساعدة والدعم", "Help & support"), desc: L("Centre d'aide et demandes de support envoyées à l'administration.", "مركز المساعدة وطلبات الدعم للإدارة.", "Help center and support requests to the administration.") },
        { k: "progress", label: L("Ma progression (élève)", "تقدمي (التلميذ)", "My progress (student)"), desc: L("Moyenne, derniers résultats et compétences de l'élève, avec exercices de remédiation.", "معدل التلميذ ونتائجه الأخيرة وكفاياته مع تمارين الدعم.", "Student average, recent results and skills, with remediation exercises.") },
        { k: "gamification", label: L("Badges et séries", "الشارات والسلاسل", "Badges & streaks"), desc: L("Badges et jours d'affilée pour motiver les élèves.", "شارات وأيام متتالية لتحفيز التلاميذ.", "Badges and day streaks to motivate students.") },
      ],
    },
    {
      title: L("Interface", "الواجهة", "Interface"),
      items: [
        { k: "notifications", label: L("Notifications", "الإشعارات", "Notifications"), desc: L("Cloche de notifications et messages aux élèves.", "جرس الإشعارات والرسائل للتلاميذ.", "Notification bell and messages to students.") },
        { k: "bottomNav", label: L("Barre de navigation du bas (téléphone)", "شريط التنقل السفلي (الهاتف)", "Bottom navigation bar (phone)"), desc: L("Raccourcis en bas de l'écran sur les petits écrans.", "اختصارات أسفل الشاشة في الشاشات الصغيرة.", "Shortcuts at the bottom of small screens.") },
      ],
    },
  ];
  const items = groups.flatMap(g => g.items);
  const off = items.filter(i => f[i.k] === false).length;
  return (
    <Card
      icon={<LayoutGrid className="h-4 w-4" />}
      title={L("Modules de l'application", "وحدات التطبيق", "App modules")}
      description={L(
        "Un module désactivé disparaît des menus et sa page affiche « Module désactivé ». Les données ne sont pas supprimées.",
        "الوحدة المعطلة تختفي من القوائم وتعرض صفحتها « وحدة معطلة ». لا تُحذف البيانات.",
        "A disabled module disappears from menus and its page shows “Module disabled”. No data is deleted."
      )}
    >
      {off > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {L(`${off} module(s) désactivé(s)`, `${off} وحدة معطلة`, `${off} module(s) disabled`)}
        </p>
      )}
      {groups.map(g => (
        <div key={g.title} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {g.items.map(i => (
              <SwitchRow key={i.k} id={`cz-f-${i.k}`} label={i.label} description={i.desc} checked={f[i.k] !== false} onChange={v => update("features", { [i.k]: v } as Partial<Record<FeatureKey, boolean>>)} />
            ))}
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        {L(
          "Tableau de bord, Mon profil, Abonnement et Paramètres restent toujours visibles.",
          "لوحة القيادة والملف الشخصي والاشتراك والإعدادات تبقى ظاهرة دائما.",
          "Dashboard, My profile, Subscription and Settings are always shown."
        )}
      </p>
    </Card>
  );
}

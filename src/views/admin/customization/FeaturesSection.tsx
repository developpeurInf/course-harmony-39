import { LayoutGrid } from "lucide-react";
import type { FeatureKey } from "@/lib/appSettings";
import { useT } from "../adminShared";
import { Card, SwitchRow, type SectionProps } from "./shared";

export default function FeaturesSection({ draft, update }: SectionProps) {
  const { L } = useT();
  const f = draft.features;
  const items: { k: FeatureKey; label: string; desc: string }[] = [
    { k: "courses", label: L("Cours", "الدروس", "Courses"), desc: L("Supports de cours (PDF, images, vidéos) partagés avec les classes.", "مواد الدروس (PDF، صور، فيديو) المشاركة مع الأقسام.", "Course materials (PDF, images, videos) shared with classes.") },
    { k: "exercises", label: L("Exercices", "التمارين", "Exercises"), desc: L("Quiz d'entraînement des élèves.", "اختبارات تدريب التلاميذ.", "Practice quizzes for students.") },
    { k: "exams", label: L("Examens", "الامتحانات", "Exams"), desc: L("Évaluations notées et programmées.", "تقويمات منقطة ومبرمجة.", "Graded, scheduled assessments.") },
    { k: "diagnostic", label: L("Évaluation diagnostique", "التقويم التشخيصي", "Diagnostic assessment"), desc: L("Grilles diagnostiques et rapports PDF associés.", "شبكات التقويم التشخيصي وتقارير PDF المرتبطة.", "Diagnostic grids and related PDF reports.") },
    { k: "reports", label: L("Rapports", "التقارير", "Reports"), desc: L("Tableaux de bord et rapports de résultats.", "لوحات القيادة وتقارير النتائج.", "Dashboards and results reports.") },
    { k: "studentActivities", label: L("Activités des élèves", "أنشطة التلاميذ", "Student activity"), desc: L("Suivi des connexions et de l'activité par classe.", "تتبع الاتصالات والنشاط حسب القسم.", "Tracking of sessions and activity per class.") },
    { k: "notifications", label: L("Notifications", "الإشعارات", "Notifications"), desc: L("Cloche de notifications et messages aux élèves.", "جرس الإشعارات والرسائل للتلاميذ.", "Notification bell and messages to students.") },
    { k: "bottomNav", label: L("Barre de navigation du bas (téléphone)", "شريط التنقل السفلي (الهاتف)", "Bottom navigation bar (phone)"), desc: L("Raccourcis en bas de l'écran sur les petits écrans.", "اختصارات أسفل الشاشة في الشاشات الصغيرة.", "Shortcuts at the bottom of small screens.") },
  ];
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
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map(i => (
          <SwitchRow key={i.k} id={`cz-f-${i.k}`} label={i.label} description={i.desc} checked={f[i.k] !== false} onChange={v => update("features", { [i.k]: v } as Partial<Record<FeatureKey, boolean>>)} />
        ))}
      </div>
    </Card>
  );
}

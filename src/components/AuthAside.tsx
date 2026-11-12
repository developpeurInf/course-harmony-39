import { BookOpen, ClipboardCheck, LineChart } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBrand } from "@/components/AppBrand";

/**
 * Panneau de présentation à côté du formulaire de connexion (grands écrans) :
 * ce que l'on trouve dans l'espace, sur un fond neutre quadrillé.
 */
export default function AuthAside() {
  const { language } = useLanguage();
  const brand = useBrand(language);
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);

  const points = [
    {
      icon: BookOpen,
      title: tr("Cours et exercices", "الدروس والتمارين", "Courses & exercises"),
      text: tr(
        "Les leçons, séries et documents de chaque classe, au même endroit.",
        "دروس كل قسم وسلاسله ووثائقه في مكان واحد.",
        "Every class's lessons, worksheets and files in one place."
      ),
    },
    {
      icon: ClipboardCheck,
      title: tr("Quiz et examens", "الاختبارات والامتحانات", "Quizzes & exams"),
      text: tr(
        "Correction automatique, chronomètre et protection contre la triche.",
        "تصحيح تلقائي ومؤقت وحماية من الغش.",
        "Automatic grading, timers and anti-cheating protection."
      ),
    },
    {
      icon: LineChart,
      title: tr("Suivi des élèves", "تتبع التلاميذ", "Student progress"),
      text: tr(
        "Résultats, évaluation diagnostique et rapports PDF prêts à imprimer.",
        "النتائج والتقويم التشخيصي وتقارير PDF جاهزة للطباعة.",
        "Results, diagnostic assessments and print-ready PDF reports."
      ),
    },
  ];

  return (
    <aside className="relative hidden overflow-hidden border-s bg-muted/50 lg:flex lg:flex-col lg:justify-center">
      <div
        className="pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
        aria-hidden="true"
      />
      <div className="relative mx-auto w-full max-w-md px-10">
        <p className="eyebrow">{brand.appName}</p>
        <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-foreground">
          {tr(
            "L'espace de travail de la classe de mathématiques.",
            "فضاء العمل لقسم الرياضيات.",
            "The workspace for the maths classroom."
          )}
        </h2>
        <ul className="mt-10 space-y-6">
          {points.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-card text-foreground shadow-sm">
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">{title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

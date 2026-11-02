"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Clock } from "lucide-react";
import { Link } from "@/lib/router";
import { useOfficeEnv } from "@/components/office/shared/useOfficeEnv";
import { APP_ICON, OFFICE_ACCENT } from "@/components/office/shared/OfficeShell";
import { listOfficeFiles, setLastOpened, type OfficeApp, type OfficeFileRecord } from "@/components/office/shared/officeStore";

const ROUTE: Record<OfficeApp, string> = { word: "/office/word", excel: "/office/excel", ppt: "/office/powerpoint" };

/** Page d'accueil des Outils Office : les trois applications et les fichiers récents */
export default function OfficeHub() {
  const { L } = useOfficeEnv();
  const [recent, setRecent] = useState<(Omit<OfficeFileRecord, "data">)[]>([]);
  useEffect(() => {
    Promise.all((["word", "excel", "ppt"] as OfficeApp[]).map((a) => listOfficeFiles(a)))
      .then((all) => setRecent(all.flat().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 12)))
      .catch(() => setRecent([]));
  }, []);
  const apps: { app: OfficeApp; title: string; desc: string }[] = [
    { app: "word", title: L("Word", "Word", "Word"), desc: L("Documents, cours, fiches, examens : mise en forme complète, tableaux, images, équations, export .docx et PDF.", "وثائق ودروس وجذاذات وامتحانات: تنسيق كامل وجداول وصور ومعادلات وتصدير ‎.docx وPDF.", "Documents, lessons, exams: full formatting, tables, images, equations, .docx and PDF export.") },
    { app: "excel", title: L("Excel", "Excel", "Excel"), desc: L("Tableur avec plus de 400 formules, tri, filtres, mise en forme conditionnelle, graphiques, import/export .xlsx.", "جداول بيانات بأكثر من 400 صيغة وفرز وتصفية وتنسيق شرطي ومبيانات واستيراد/تصدير ‎.xlsx.", "Spreadsheet with 400+ formulas, sort, filters, conditional formatting, charts, .xlsx import/export.") },
    { app: "ppt", title: L("PowerPoint", "PowerPoint", "PowerPoint"), desc: L("Présentations : thèmes, dispositions, formes, transitions, animations, diaporama et mode présentateur, export .pptx.", "عروض تقديمية: سمات وتخطيطات وأشكال وانتقالات وحركات وعرض ووضع المقدم وتصدير ‎.pptx.", "Presentations: themes, layouts, shapes, transitions, animations, slideshow and presenter view, .pptx export.") },
  ];
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold">{L("Outils Office", "أدوات أوفيس", "Office tools")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{L("Créez et modifiez vos documents directement dans le navigateur, sans rien installer.", "أنشئ وثائقك وعدّلها مباشرة في المتصفح دون تثبيت أي شيء.", "Create and edit your documents right in the browser, nothing to install.")}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {apps.map(({ app, title, desc }) => {
          const Icon = APP_ICON[app];
          const m = OFFICE_ACCENT[app];
          return (
            <Link key={app} to={ROUTE[app]} className="group flex flex-col rounded-xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl text-white shadow" style={{ background: m.accent }}>
                <Icon className="h-6 w-6" strokeWidth={1.6} />
              </span>
              <span className="mt-4 text-lg font-semibold">{title}</span>
              <span className="mt-1 flex-1 text-sm text-muted-foreground">{desc}</span>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium" style={{ color: m.accent }}>
                {L("Ouvrir", "فتح", "Open")} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5 rtl:rotate-180" />
              </span>
            </Link>
          );
        })}
      </div>
      {recent.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Clock className="h-4 w-4" /> {L("Récents", "الملفات الأخيرة", "Recent")}</h2>
          <div className="divide-y rounded-xl border bg-card">
            {recent.map((r) => {
              const Icon = APP_ICON[r.app];
              return (
                <Link key={r.id} to={ROUTE[r.app]} onClick={() => setLastOpened(r.app, r.id)} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                  <Icon className="h-6 w-6 shrink-0" style={{ color: OFFICE_ACCENT[r.app].accent }} strokeWidth={1.5} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{r.preview}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{new Date(r.updatedAt).toLocaleDateString()}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

/** Scènes du Labo 3D rattachées à un cours (affichées dans la page du cours) */
import { useEffect, useState } from "react";
import { Boxes, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { Link } from "@/lib/router";
import { templateById, type Tri } from "@/lib/lab3d/templates";
import { useLab3dFeatures } from "@/lib/lab3d/features";

export function CourseScenes({ courseId }: { courseId: string }) {
  const { language } = useLanguage();
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);
  const L = (t: Tri) => (language === "ar" ? t.ar : language === "en" ? t.en : t.fr);
  const { feature } = useAppSettings();
  const f = useLab3dFeatures();
  const [list, setList] = useState<{ id: string; title: string; template: string; is_visible: boolean }[]>([]);
  const on = feature("lab3d") && !!f?.use;

  useEffect(() => {
    if (!on) return;
    (supabase as any).from("lab3d_scenes").select("id, title, template, is_visible").eq("course_id", courseId).order("created_at")
      .then(({ data }: any) => setList(data || []));
  }, [courseId, on]);

  if (!on || !list.length) return null;
  return (
    <section className="rounded-xl border bg-card">
      <h2 className="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold sm:px-5">
        <Boxes className="h-4 w-4 text-muted-foreground" />{tr("En 3D, AR et VR", "ثلاثي الأبعاد والواقع المعزز والافتراضي", "In 3D, AR and VR")}
        <span className="text-xs font-normal text-muted-foreground">{list.length}</span>
      </h2>
      <ul className="divide-y">
        {list.map((s) => {
          const t = templateById(s.template);
          return (
            <li key={s.id}>
              <Link to={`/lab3d/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 sm:px-5">
                <span className="text-xl">{t.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{s.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{L(t.label)}{!s.is_visible && ` · ${tr("masquée aux élèves", "مخفي عن التلاميذ", "hidden from students")}`}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

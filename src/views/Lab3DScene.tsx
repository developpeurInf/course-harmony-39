/** Une scène du Labo 3D : visionneuse + réglages laissés à l'élève + consigne */
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link, useParams } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { NotInPlan } from "@/components/access/AccessUi";
import { Viewer3D } from "@/components/lab3d/Viewer3D";
import { ParamsForm } from "@/components/lab3d/ParamsForm";
import { normalizeParams, templateById, type Params, type Tri } from "@/lib/lab3d/templates";
import { useLab3dFeatures } from "@/lib/lab3d/features";
import type { Lab3dScene as Scene } from "@/views/Lab3D";
import { labLessonLabel } from "@/lib/lab3d/catalog";

const db = supabase as any;

export default function Lab3DScene() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { language } = useLanguage();
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);
  const L = (t: Tri) => (language === "ar" ? t.ar : language === "en" ? t.en : t.fr);
  const f = useLab3dFeatures();
  const [scene, setScene] = useState<Scene | null | undefined>(undefined);
  const [p, setP] = useState<Params>({});
  const counted = useRef(false);

  useEffect(() => {
    if (!id) return;
    db.from("lab3d_scenes").select("*").eq("id", id).maybeSingle().then(({ data }: any) => {
      setScene(data || null);
      if (data) setP(normalizeParams(data.template, data.params));
    });
  }, [id]);
  useEffect(() => {
    if (scene && user?.role === "student" && !counted.current) { counted.current = true; db.rpc("lab3d_viewed", { p_scene: scene.id }); }
  }, [scene, user?.role]);

  if (!f || scene === undefined) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!f.use) return <NotInPlan title={tr("Labo 3D (AR / VR)", "المختبر ثلاثي الأبعاد", "3D Lab (AR / VR)")} />;
  if (!scene) return (
    <div className="mx-auto mt-10 max-w-md rounded-xl border bg-card p-6 text-center">
      <p className="font-medium">{tr("Scène introuvable ou non partagée.", "المشهد غير موجود أو غير مشارك.", "Scene not found or not shared.")}</p>
      <Button asChild variant="outline" className="mt-4"><Link to="/lab3d">{tr("Retour au Labo 3D", "العودة إلى المختبر", "Back to the 3D Lab")}</Link></Button>
    </div>
  );
  const tpl = templateById(scene.template);
  const hasStudentParams = tpl.params.some((x) => x.student);
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/lab3d" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"><ArrowLeft className="h-3.5 w-3.5" />{tr("Labo 3D", "المختبر ثلاثي الأبعاد", "3D Lab")}</Link>
          <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold"><span className="text-2xl">{tpl.icon}</span>{scene.title}</h1>
          <p className="text-xs text-muted-foreground">{labLessonLabel(scene.lab_id, L) || `${L(tpl.label)} · ${tpl.level}`}</p>
        </div>
      </div>
      {scene.description && <p className="whitespace-pre-wrap rounded-xl border-s-4 border-primary bg-primary/5 px-4 py-3 text-sm">{scene.description}</p>}
      <div className={hasStudentParams ? "grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]" : ""}>
        <Viewer3D template={scene.template} params={p} ar={f.ar} vr={f.vr} height="min(64vh, 600px)" />
        {hasStudentParams && (
          <section className="space-y-3 rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{tr("À vous de manipuler", "جرب بنفسك", "Your turn")}</h2>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setP(normalizeParams(scene.template, scene.params))}><RotateCcw className="me-1 h-3.5 w-3.5" />{tr("Réinitialiser", "إعادة الضبط", "Reset")}</Button>
            </div>
            <ParamsForm template={scene.template} params={p} onChange={setP} studentOnly />
          </section>
        )}
      </div>
    </div>
  );
}

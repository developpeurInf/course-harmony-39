"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Clock, Trash2 } from "lucide-react";
import { Link } from "@/lib/router";
import { useOfficeEnv } from "@/components/office/shared/useOfficeEnv";
import { GGB_APPS, ggbApp } from "@/components/geogebra/ggbApps";
import { deleteGgbFile, listGgbFiles, type GgbFileMeta } from "@/components/geogebra/ggbStore";

/** Page d'accueil GeoGebra : les applications et les constructions récentes */
export default function GeoGebraHub() {
  const { L, dir } = useOfficeEnv();
  const [recent, setRecent] = useState<GgbFileMeta[]>([]);
  const load = () => listGgbFiles().then((r) => setRecent(r.slice(0, 12))).catch(() => setRecent([]));
  useEffect(() => {
    void load();
  }, []);

  return (
    <div dir={dir} className="mx-auto w-full max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">GeoGebra</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {L(
            "Les applications de mathématiques GeoGebra dans l'application : fonctions, géométrie, 3D, calcul formel et probabilités. Vos constructions s'enregistrent toutes seules dans ce navigateur.",
            "تطبيقات جيوجبرا للرياضيات داخل المنصة: الدوال والهندسة والفضاء والحساب الرمزي والاحتمالات. تحفظ إنشاءاتك تلقائيا في هذا المتصفح.",
            "GeoGebra math apps inside the platform: functions, geometry, 3D, CAS and probability. Your constructions save automatically in this browser."
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GGB_APPS.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.id}
              to={`/geogebra/${a.id}`}
              className="group flex flex-col rounded-xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl text-white shadow" style={{ background: a.color }}>
                <Icon className="h-6 w-6" strokeWidth={1.6} />
              </span>
              <span className="mt-4 text-lg font-semibold">{a.label(L)}</span>
              <span className="mt-1 flex-1 text-sm text-muted-foreground">{a.desc(L)}</span>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium" style={{ color: a.color }}>
                {L("Ouvrir", "فتح", "Open")} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5 rtl:rotate-180" />
              </span>
            </Link>
          );
        })}
      </div>

      {recent.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Clock className="h-4 w-4" /> {L("Mes constructions récentes", "إنشاءاتي الأخيرة", "Recent constructions")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((r) => {
              const A = ggbApp(r.app);
              const Icon = A?.icon;
              return (
                <div key={r.id} className="group relative overflow-hidden rounded-xl border bg-card transition hover:shadow-md">
                  <Link to={`/geogebra/${r.app}?file=${encodeURIComponent(r.id)}`} className="block">
                    <div className="flex aspect-[16/10] items-center justify-center border-b bg-white">
                      {r.thumb ? (
                        <img src={r.thumb} alt="" className="h-full w-full object-contain" />
                      ) : (
                        Icon && <Icon className="h-8 w-8" style={{ color: A?.color }} />
                      )}
                    </div>
                    <div className="px-3 py-2">
                      <span className="block truncate text-sm font-medium" dir="auto">{r.name}</span>
                      <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                        <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: A?.color }} />
                        {A?.label(L)} · {new Date(r.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteGgbFile(r.id);
                      void load();
                    }}
                    className="absolute end-2 top-2 rounded-md bg-background/90 p-1.5 text-muted-foreground opacity-0 shadow-sm transition hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                    aria-label={L("Supprimer", "حذف", "Delete")}
                    title={L("Supprimer", "حذف", "Delete")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        {L("GeoGebra® est fourni par GeoGebra GmbH (geogebra.org).", "جيوجبرا® مقدم من شركة GeoGebra GmbH ‏(geogebra.org).", "GeoGebra® is provided by GeoGebra GmbH (geogebra.org).")}
      </p>
    </div>
  );
}

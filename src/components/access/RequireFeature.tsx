import type { ReactNode } from "react";
import { Link } from "@/lib/router";
import { PowerOff } from "lucide-react";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { FeatureKey } from "@/lib/appSettings";

/** Page entière d'un module que l'administration peut désactiver (Personnalisation → Modules) */
export function RequireFeature({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  const { feature: enabled } = useAppSettings();
  const { language } = useLanguage();
  if (enabled(feature)) return <>{children}</>;
  const L = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);
  return (
    <div className="mx-auto mt-10 max-w-md rounded-xl border bg-card p-6 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <PowerOff className="h-6 w-6" />
      </span>
      <h1 className="mt-3 text-lg font-semibold">{L("Module désactivé par l'administration", "هذه الوحدة معطلة من طرف الإدارة", "Module disabled by the administration")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {L(
          "Cette partie de l'application n'est pas disponible pour le moment.",
          "هذا الجزء من التطبيق غير متاح حاليا.",
          "This part of the app is not available at the moment."
        )}
      </p>
      <Link to="/dashboard" className="mt-4 inline-flex min-h-[40px] items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
        {L("Retour au tableau de bord", "العودة إلى لوحة القيادة", "Back to dashboard")}
      </Link>
    </div>
  );
}

export default RequireFeature;

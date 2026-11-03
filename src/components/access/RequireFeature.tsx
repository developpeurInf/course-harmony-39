import type { ReactNode } from "react";
import { Link } from "@/lib/router";
import { PowerOff } from "lucide-react";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { useAccess } from "@/contexts/AccessContext";
import { NotInPlan } from "@/components/access/AccessUi";
import { useLanguage } from "@/contexts/LanguageContext";
import type { FeatureKey } from "@/lib/appSettings";
import { useClassModule, type ClassModuleKey } from "@/lib/classModules";

/**
 * Page d'un module que le professeur a masqué aux élèves de sa classe (Habilitations).
 * Sans effet pour un professeur ou un administrateur.
 */
export function RequireClassModule({ module, children }: { module: ClassModuleKey; children: ReactNode }) {
  const classModule = useClassModule();
  const { language } = useLanguage();
  if (classModule(module)) return <>{children}</>;
  const L = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);
  return (
    <div className="mx-auto mt-10 max-w-md rounded-xl border bg-card p-6 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <PowerOff className="h-6 w-6" />
      </span>
      <h1 className="mt-3 text-lg font-semibold">{L("Module fermé par votre professeur", "أغلق أستاذك هذه الوحدة", "Closed by your teacher")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {L(
          "Votre professeur n'a pas ouvert cette partie pour votre classe.",
          "لم يفتح أستاذك هذا الجزء لقسمك.",
          "Your teacher has not opened this part for your class."
        )}
      </p>
      <Link to="/dashboard" className="mt-4 inline-flex min-h-[40px] items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
        {L("Retour au tableau de bord", "العودة إلى لوحة القيادة", "Back to dashboard")}
      </Link>
    </div>
  );
}

/**
 * Page entière d'un module : coupé par l'administration (Personnalisation → Modules)
 * ou non inclus dans l'offre du professeur (aucune de ses fonctions).
 * Pour un élève : aussi fermé si son professeur l'a masqué à sa classe (Habilitations).
 */
export function RequireFeature({ feature, classModule, children }: { feature: FeatureKey; /** habilitation de classe si elle diffère du module */ classModule?: ClassModuleKey; children: ReactNode }) {
  const { feature: enabled } = useAppSettings();
  const { hasModule, loading } = useAccess();
  const { language } = useLanguage();
  if (enabled(feature)) {
    if (loading) return null;
    return hasModule(feature) ? <RequireClassModule module={classModule ?? (feature as ClassModuleKey)}>{children}</RequireClassModule> : <NotInPlan />;
  }
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

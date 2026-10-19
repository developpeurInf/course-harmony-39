import { useState } from "react";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { DEFAULT_APP_SETTINGS, pickText, type Lang } from "@/lib/appSettings";
import { cn } from "@/lib/utils";

/**
 * Identité de l'application (Personnalisation → Identité) pour les en-têtes :
 * nom, nom court, sous-titre et logo, avec repli sur l'affichage d'origine.
 */
export function useBrand(language: string) {
  const { settings } = useAppSettings();
  const lang = (language === "ar" || language === "en" ? language : "fr") as Lang;
  const id = settings.identity || DEFAULT_APP_SETTINGS.identity;
  const appName = (id.appName || "").trim() || DEFAULT_APP_SETTINGS.identity.appName;
  const shortName = (id.shortName || "").trim() || appName;
  const tagline = pickText(id.tagline, lang);
  const defaultTagline = pickText(DEFAULT_APP_SETTINGS.identity.tagline, lang);
  return {
    appName,
    shortName,
    /** true : nom d'origine (« Math infini ») → on garde le « ∞ » décoratif */
    isDefaultName: appName === DEFAULT_APP_SETTINGS.identity.appName,
    /** Nom complet tel qu'affiché jusqu'ici (« Math infini ∞ ») */
    displayName: appName === DEFAULT_APP_SETTINGS.identity.appName ? `${appName} ∞` : appName,
    tagline,
    /** Sous-titre personnalisé par l'administration (vide = garder le texte d'origine de l'écran) */
    customTagline: tagline && tagline !== defaultTagline ? tagline : "",
    logoUrl: (id.logoUrl || "").trim() || null,
  };
}

/** Logo carré : image de l'administration si configurée, sinon le « ∞ » d'origine. */
export function BrandLogo({
  logoUrl,
  alt,
  className,
  imgClassName,
  symbolClassName,
}: {
  logoUrl: string | null;
  alt: string;
  /** Classes du conteneur du « ∞ » (fond dégradé, taille…) */
  className?: string;
  imgClassName?: string;
  symbolClassName?: string;
}) {
  const [broken, setBroken] = useState<string | null>(null);
  if (logoUrl && broken !== logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={alt}
        className={cn("shrink-0 object-contain", imgClassName)}
        onError={() => setBroken(logoUrl)}
      />
    );
  }
  return (
    <div className={className}>
      <span className={symbolClassName}>∞</span>
    </div>
  );
}

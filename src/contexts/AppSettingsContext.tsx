import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  FeatureKey,
  I18nText,
  Lang,
  applyAppSettings,
  mergeAppSettings,
  pickText,
  readCachedSettings,
  writeCachedSettings,
} from "@/lib/appSettings";

/**
 * Réglages centraux de l'application (table public.app_settings, ligne id = 1).
 * - lus au démarrage (le cache local permet un affichage immédiat, même hors ligne) ;
 * - appliqués au document (couleurs, police, favicon, titre) ;
 * - mis à jour en direct pour tout le monde quand l'administration enregistre.
 */
interface AppSettingsContextValue {
  settings: AppSettings;
  loading: boolean;
  /** Texte traduit d'un réglage, dans la langue donnée. */
  text: (value: I18nText | undefined | null, lang: Lang) => string;
  /** Module activé par l'administration ? */
  feature: (key: FeatureKey) => boolean;
  /** Relit les réglages depuis la base. */
  reload: () => Promise<void>;
  /** Enregistre de nouveaux réglages (admin seulement : contrôlé par la base). */
  save: (next: AppSettings) => Promise<{ error: string | null }>;
  /** Aperçu local (page de personnalisation) sans enregistrer ; null = arrêter l'aperçu. */
  preview: (draft: AppSettings | null) => void;
}

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

const db = supabase as any;

export const AppSettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const [settings, setSettings] = useState<AppSettings>(() => readCachedSettings() || DEFAULT_APP_SETTINGS);
  const [loading, setLoading] = useState(true);
  const previewRef = useRef<AppSettings | null>(null);
  const savedRef = useRef(settings);

  const commit = useCallback((next: AppSettings) => {
    savedRef.current = next;
    writeCachedSettings(next);
    if (!previewRef.current) {
      setSettings(next);
      applyAppSettings(next);
    }
  }, []);

  const reload = useCallback(async () => {
    try {
      const { data, error } = await db.from("app_settings").select("data").eq("id", 1).maybeSingle();
      if (!error) commit(mergeAppSettings(data?.data || {}));
    } catch {
      /* table absente (migration non appliquée) : valeurs par défaut */
    } finally {
      setLoading(false);
    }
  }, [commit]);

  // Thème appliqué tout de suite (cache), puis lecture de la base
  useEffect(() => {
    applyAppSettings(settings);
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mises à jour en direct (enregistrement par un administrateur)
  useEffect(() => {
    let channel: any = null;
    try {
      channel = db
        .channel("app-settings")
        .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, (payload: any) => {
          const row = payload?.new;
          if (row && row.data) commit(mergeAppSettings(row.data));
          else void reload();
        })
        .subscribe();
    } catch {
      /* temps réel indisponible : la relecture au retour sur l'onglet suffit */
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") void reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      try {
        if (channel) db.removeChannel(channel);
      } catch {
        /* ignore */
      }
    };
  }, [commit, reload]);

  const save = useCallback(
    async (next: AppSettings) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await db
        .from("app_settings")
        .upsert({ id: 1, data: next, updated_by: auth?.user?.id ?? null, updated_at: new Date().toISOString() }, { onConflict: "id" });
      if (error) return { error: error.message as string };
      previewRef.current = null;
      commit(next);
      setSettings(next);
      applyAppSettings(next);
      return { error: null };
    },
    [commit]
  );

  const preview = useCallback((draft: AppSettings | null) => {
    previewRef.current = draft;
    const shown = draft || savedRef.current;
    setSettings(shown);
    applyAppSettings(shown);
  }, []);

  const text = useCallback((value: I18nText | undefined | null, lang: Lang) => pickText(value, lang), []);
  const feature = useCallback((key: FeatureKey) => settings.features[key] !== false, [settings]);

  const value = useMemo(
    () => ({ settings, loading, text, feature, reload, save, preview }),
    [settings, loading, text, feature, reload, save, preview]
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
};

/** Accès aux réglages ; hors du fournisseur, renvoie les valeurs par défaut. */
export function useAppSettings(): AppSettingsContextValue {
  const ctx = useContext(AppSettingsContext);
  if (ctx) return ctx;
  return {
    settings: DEFAULT_APP_SETTINGS,
    loading: false,
    text: pickText,
    feature: () => true,
    reload: async () => {},
    save: async () => ({ error: "AppSettingsProvider manquant" }),
    preview: () => {},
  };
}

/** Lecture hors React (ex. génération de PDF) : dernière valeur connue. */
export function getAppSettingsSnapshot(): AppSettings {
  return readCachedSettings() || DEFAULT_APP_SETTINGS;
}

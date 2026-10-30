import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  BookOpen, Check, Download, FileText, GraduationCap, LayoutGrid, Loader2, Lock, Palette, RefreshCw, ScrollText, ShieldCheck, Upload, Wallet, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/contexts/AccessContext";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { DEFAULT_APP_SETTINGS, mergeAppSettings, type AppSettings } from "@/lib/appSettings";
import { cn } from "@/lib/utils";
import { PageTitle, copyText, db, localDateStr, useT } from "./adminShared";
import { useConfirm } from "./ConfirmDialog";
import { clone, countChanges, type Updater } from "./customization/shared";
import IdentitySection from "./customization/IdentitySection";
import ThemeSection from "./customization/ThemeSection";
import TextsSection from "./customization/TextsSection";
import PedagogySection from "./customization/PedagogySection";
import ReportsSection from "./customization/ReportsSection";
import FeaturesSection from "./customization/FeaturesSection";
import PaymentsSection from "./customization/PaymentsSection";
import SecuritySection from "./customization/SecuritySection";
import LivePreview from "./customization/LivePreview";

type TabId = "identity" | "theme" | "texts" | "pedagogy" | "reports" | "payments" | "features" | "security";

const TAB_SECTIONS: Record<TabId, (keyof AppSettings)[]> = {
  identity: ["identity"],
  theme: ["theme"],
  texts: ["texts"],
  pedagogy: ["pedagogy"],
  reports: ["reports"],
  payments: ["payments"],
  features: ["features"],
  security: ["security", "maintenance"],
};

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Espace d'administration → Personnalisation de toute l'application */
export default function AdminCustomization() {
  const { L, lang, rtl } = useT();
  const { settings, loading, save, preview } = useAppSettings();
  const { access, adminCan } = useAccess();
  const canManage = access?.admin_role === "super_admin" || adminCan("admin.settings.manage");
  const { ask, dialog: confirmDialog } = useConfirm();

  const [baseline, setBaseline] = useState<AppSettings | null>(null);
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [tab, setTab] = useState<TabId>("identity");
  const [live, setLive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState<{ at: string | null; by: string | null } | null>(null);
  const liveRef = useRef(false);
  const dirtyRef = useRef(false);
  const importInput = useRef<HTMLInputElement>(null);
  const tabList = useRef<HTMLDivElement>(null);

  const changes = baseline && draft ? countChanges(baseline, draft) : 0;
  const dirty = changes > 0;
  dirtyRef.current = dirty;

  // Brouillon initialisé avec les réglages enregistrés ; resynchronisé si un autre
  // administrateur enregistre pendant qu'on ne modifie rien.
  useEffect(() => {
    if (loading || liveRef.current) return;
    setBaseline(clone(settings));
    if (!dirtyRef.current) setDraft(clone(settings));
  }, [settings, loading]);

  // Aperçu dans toute l'application
  useEffect(() => {
    if (live && draft) preview(draft);
  }, [live, draft, preview]);
  // Arrêt de l'aperçu en quittant la page
  useEffect(() => () => preview(null), [preview]);

  const setLiveMode = (v: boolean) => {
    liveRef.current = v;
    setLive(v);
    if (!v) preview(null);
  };

  // Avertissement si on quitte la page avec des modifications non enregistrées
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  // Téléphone : la pastille active reste visible dans la barre défilante (calcul manuel, fiable sur iOS 12)
  useEffect(() => {
    const nav = tabList.current;
    const active = nav && nav.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!nav || !active) return;
    const navRect = nav.getBoundingClientRect();
    const r = active.getBoundingClientRect();
    if (r.left < navRect.left + 16 || r.right > navRect.right - 16) nav.scrollLeft += r.left - navRect.left - (navRect.width - r.width) / 2;
  }, [tab, rtl, !!draft]);

  const loadMeta = useCallback(async () => {
    try {
      const { data } = await db.from("app_settings").select("updated_at, updated_by").eq("id", 1).maybeSingle();
      if (!data) return setMeta(null);
      let by: string | null = null;
      if (data.updated_by) {
        const { data: p } = await db.from("profiles").select("name").eq("id", data.updated_by).maybeSingle();
        by = (p && p.name) || null;
      }
      setMeta({ at: data.updated_at || null, by });
    } catch {
      setMeta(null);
    }
  }, []);
  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  const update: Updater = useCallback((section, patch) => {
    setDraft(d => (d ? ({ ...d, [section]: { ...d[section], ...patch } } as AppSettings) : d));
  }, []);

  const cancel = () => {
    if (baseline) setDraft(clone(baseline));
    if (liveRef.current) setLiveMode(false);
  };

  const doSave = async () => {
    if (!draft || saving) return;
    setSaving(true);
    if (liveRef.current) setLiveMode(false);
    const next = clone(draft);
    const { error } = await save(next);
    setSaving(false);
    if (error) {
      toast.error(L("Enregistrement impossible", "تعذر الحفظ", "Could not save") + ` : ${error}`);
      return;
    }
    setBaseline(next);
    toast.success(L("Personnalisation enregistrée — appliquée à tous", "تم حفظ التخصيص — طُبق على الجميع", "Customization saved — applied to everyone"));
    void loadMeta();
  };

  const resetDefaults = () =>
    ask({
      title: L("Réinitialiser aux valeurs par défaut ?", "إعادة التعيين إلى القيم الافتراضية؟", "Reset to default values?"),
      description: L(
        "Tous les réglages (couleurs, textes, logos, modules…) reprennent leur valeur d'origine dans le brouillon. Rien n'est enregistré tant que vous ne cliquez pas sur « Enregistrer ».",
        "تعود جميع الإعدادات (الألوان، النصوص، الشعارات، الوحدات…) إلى قيمها الأصلية في المسودة. لا يُحفظ أي شيء حتى تضغط « حفظ ».",
        "All settings (colors, texts, logos, modules…) go back to their original values in the draft. Nothing is saved until you click “Save”."
      ),
      confirmLabel: L("Réinitialiser", "إعادة التعيين", "Reset"),
      destructive: true,
      onConfirm: () => {
        setDraft(clone(DEFAULT_APP_SETTINGS));
        toast.info(L("Valeurs par défaut chargées — cliquez sur Enregistrer pour appliquer", "تم تحميل القيم الافتراضية — اضغط حفظ للتطبيق", "Defaults loaded — click Save to apply"));
      },
    });

  const exportJson = () => {
    if (!draft) return;
    const json = JSON.stringify(draft, null, 2);
    const name = `personnalisation-${localDateStr(new Date())}.json`;
    let url = "";
    try {
      const blob = new Blob([json], { type: "application/json" });
      url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      if ("download" in a) {
        a.href = url;
        a.download = name;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        // iOS 12 : pas d'attribut download → ouverture dans un nouvel onglet (Partager → Enregistrer)
        const w = window.open(url, "_blank");
        if (!w) throw new Error("popup");
      }
    } catch {
      void copyText(json).then(ok =>
        ok
          ? toast.success(L("Fichier indisponible : le JSON a été copié", "الملف غير متاح: تم نسخ JSON", "File unavailable: JSON copied"))
          : toast.error(L("Export impossible", "تعذر التصدير", "Export failed"))
      );
    } finally {
      if (url) window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  };

  const importJson = (file: File | undefined) => {
    if (importInput.current) importInput.current.value = "";
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast.error(L("Fichier trop lourd (1 Mo max)", "الملف كبير جدا (1 م.ب كحد أقصى)", "File too large (1 MB max)"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ""));
        if (!isObj(parsed)) throw new Error("format");
        const src = !parsed.identity && isObj(parsed.data) ? parsed.data : parsed;
        setDraft(mergeAppSettings(src));
        toast.success(L("Réglages importés dans le brouillon — vérifiez puis enregistrez", "تم استيراد الإعدادات إلى المسودة — راجعها ثم احفظ", "Settings imported into the draft — review, then save"));
      } catch {
        toast.error(L("Fichier JSON invalide", "ملف JSON غير صالح", "Invalid JSON file"));
      }
    };
    reader.onerror = () => toast.error(L("Lecture du fichier impossible", "تعذرت قراءة الملف", "Could not read the file"));
    reader.readAsText(file);
  };

  if (!canManage) {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-xl border bg-card p-6 text-center">
        <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-3 text-lg font-semibold">{L("Personnalisation", "التخصيص", "Customization")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {L("Votre compte n'a pas la permission « Personnaliser l'application ».", "حسابك لا يملك صلاحية « تخصيص التطبيق ».", "Your account lacks the “Customize the app” permission.")}
        </p>
      </div>
    );
  }

  if (!draft || !baseline) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: typeof Palette }[] = [
    { id: "identity", label: L("Identité", "الهوية", "Identity"), icon: BookOpen },
    { id: "theme", label: L("Thème", "المظهر", "Theme"), icon: Palette },
    { id: "texts", label: L("Textes", "النصوص", "Texts"), icon: ScrollText },
    { id: "pedagogy", label: L("Pédagogie", "البيداغوجيا", "Teaching"), icon: GraduationCap },
    { id: "reports", label: L("Rapports PDF", "تقارير PDF", "PDF reports"), icon: FileText },
    { id: "payments", label: L("Paiements", "الأداءات", "Payments"), icon: Wallet },
    { id: "features", label: L("Modules", "الوحدات", "Modules"), icon: LayoutGrid },
    { id: "security", label: L("Sécurité", "الأمان", "Security"), icon: ShieldCheck },
  ];
  const tabChanges = (t: TabId) => TAB_SECTIONS[t].reduce((n, k) => n + countChanges(baseline[k], draft[k]), 0);

  const locale = lang === "ar" ? "ar-MA" : lang === "en" ? "en-GB" : "fr-FR";
  let metaDate = "";
  if (meta && meta.at) {
    try {
      metaDate = new Date(meta.at).toLocaleString(locale, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      metaDate = meta.at.slice(0, 16).replace("T", " ");
    }
  }

  const props = { draft, update };
  const actionBtn = "inline-flex min-h-[38px] items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-semibold hover:bg-muted";

  return (
    <div className={dirty ? "pb-28" : undefined}>
      <PageTitle
        title={L("Personnalisation", "التخصيص", "Customization")}
        subtitle={L(
          "Identité, couleurs, textes et modules de toute l'application, au même endroit.",
          "هوية التطبيق وألوانه ونصوصه ووحداته، في مكان واحد.",
          "The whole app's identity, colors, texts and modules, in one place."
        )}
        actions={
          <>
            <button type="button" className={actionBtn} onClick={exportJson}>
              <Download className="h-4 w-4" />
              {L("Exporter (JSON)", "تصدير (JSON)", "Export (JSON)")}
            </button>
            <input ref={importInput} id="cz-import" type="file" accept=".json,application/json" className="sr-only" onChange={e => importJson(e.target.files ? e.target.files[0] : undefined)} />
            <button type="button" className={actionBtn} onClick={() => importInput.current && importInput.current.click()}>
              <Upload className="h-4 w-4" />
              {L("Importer (JSON)", "استيراد (JSON)", "Import (JSON)")}
            </button>
            <button type="button" className={cn(actionBtn, "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40")} onClick={resetDefaults}>
              <RefreshCw className="h-4 w-4" />
              {L("Réinitialiser aux valeurs par défaut", "إعادة التعيين إلى القيم الافتراضية", "Reset to defaults")}
            </button>
          </>
        }
      />

      {metaDate && (
        <p className="-mt-3 mb-4 text-xs text-muted-foreground">
          {L("Dernière modification", "آخر تعديل", "Last modified")} : <span dir="auto">{metaDate}</span>
          {meta && meta.by ? (
            <>
              {" · "}
              {L("par", "بواسطة", "by")} <span className="font-semibold" dir="auto">{meta.by}</span>
            </>
          ) : null}
        </p>
      )}

      {/* Sections : pastilles (défilement horizontal sur téléphone) */}
      <div
        ref={tabList}
        role="tablist"
        aria-label={L("Sections de la personnalisation", "أقسام التخصيص", "Customization sections")}
        className="-mx-3 mb-4 flex gap-1.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        style={{ WebkitOverflowScrolling: "touch" } as any}
      >
        {tabs.map(t => {
          const n = tabChanges(t.id);
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`cz-tab-${t.id}`}
              aria-selected={active}
              aria-controls="cz-panel"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex min-h-[38px] flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors",
                active ? "bg-foreground text-background" : "bg-background text-muted-foreground ring-1 ring-border hover:bg-muted hover:text-foreground"
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {n > 0 && (
                <span className="rounded-full bg-amber-400 px-1.5 text-[10px] font-semibold leading-4 text-amber-950" aria-label={L(`${n} modification(s)`, `${n} تعديل`, `${n} change(s)`)}>
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px]">
        <div id="cz-panel" role="tabpanel" aria-labelledby={`cz-tab-${tab}`} className="order-2 min-w-0 lg:order-1">
          {tab === "identity" && <IdentitySection {...props} />}
          {tab === "theme" && <ThemeSection {...props} />}
          {tab === "texts" && <TextsSection {...props} />}
          {tab === "pedagogy" && <PedagogySection {...props} />}
          {tab === "reports" && <ReportsSection {...props} />}
          {tab === "payments" && <PaymentsSection {...props} />}
          {tab === "features" && <FeaturesSection {...props} />}
          {tab === "security" && <SecuritySection {...props} onRestore={s => setDraft(clone(s))} />}
        </div>
        <div className="order-1 min-w-0 lg:sticky lg:top-2 lg:order-2">
          <LivePreview draft={draft} live={live} onLiveChange={setLiveMode} />
        </div>
      </div>

      {dirty && (
        <div
          dir={rtl ? "rtl" : "ltr"}
          className="fixed bottom-0 left-0 right-0 z-40 border-t-2 border-amber-400 bg-background shadow-[0_-4px_16px_rgba(0,0,0,0.08)] ltr:lg:left-60 rtl:lg:right-60"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              {L(`${changes} modification(s) non enregistrée(s)`, `${changes} تعديل(ات) غير محفوظة`, `${changes} unsaved change(s)`)}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={cancel} disabled={saving}>
                <XCircle className="h-4 w-4" />
                {L("Annuler", "إلغاء", "Cancel")}
              </Button>
              <Button size="sm" onClick={() => void doSave()} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {L("Enregistrer", "حفظ", "Save")}
              </Button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}

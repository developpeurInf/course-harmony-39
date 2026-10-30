import { useEffect, useState } from "react";
import { History, RotateCcw, ShieldCheck, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { mergeAppSettings, type AppSettings } from "@/lib/appSettings";
import { db, useT } from "../adminShared";
import { Card, I18nField, SwitchRow, type SectionProps } from "./shared";

/** Sécurité (double authentification), maintenance et historique des versions */
export default function SecuritySection({ draft, update, onRestore }: SectionProps & { onRestore: (s: AppSettings) => void }) {
  const { L, lang } = useT();
  const [history, setHistory] = useState<{ id: number; saved_at: string; saved_by: string | null; data: unknown }[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    db.from("app_settings_history").select("id, saved_at, saved_by, data").order("id", { ascending: false }).limit(30)
      .then(async ({ data, error }: any) => {
        if (error) {
          setHistory([]);
          return;
        }
        setHistory(data || []);
        const ids = [...new Set((data || []).map((h: any) => h.saved_by).filter(Boolean))];
        if (ids.length) {
          const { data: p } = await db.from("profiles").select("id, name").in("id", ids);
          const m: Record<string, string> = {};
          (p || []).forEach((x: any) => (m[x.id] = x.name));
          setNames(m);
        }
      });
  }, []);

  const locale = lang === "ar" ? "ar-MA" : lang === "en" ? "en-GB" : "fr-FR";
  const when = (d: string) => {
    try {
      return new Date(d).toLocaleString(locale, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return d;
    }
  };

  return (
    <div className="space-y-4">
      <Card
        icon={<ShieldCheck className="h-4 w-4" />}
        title={L("Sécurité de l'équipe", "أمان فريق الإدارة", "Team security")}
        description={L(
          "Configurez d'abord votre propre double authentification (page Équipe admin), puis activez l'obligation.",
          "قم أولا بإعداد التحقق بخطوتين لحسابك (صفحة فريق الإدارة) ثم فعّل الإلزام.",
          "First set up your own two-factor authentication (Admin team page), then turn on the requirement."
        )}
      >
        <SwitchRow
          id="cz-sec-mfa"
          label={L("Double authentification obligatoire pour l'administration", "التحقق بخطوتين إلزامي للإدارة", "Two-factor authentication required for admins")}
          description={L(
            "Sans code de l'application d'authentification, la base de données refuse les droits d'administration.",
            "بدون رمز تطبيق المصادقة ترفض قاعدة البيانات صلاحيات الإدارة.",
            "Without the authenticator code, the database refuses admin rights."
          )}
          checked={!!draft.security?.requireAdminMfa}
          onChange={v => update("security", { requireAdminMfa: v })}
        />
      </Card>

      <Card
        icon={<Wrench className="h-4 w-4" />}
        title={L("Mode maintenance", "وضع الصيانة", "Maintenance mode")}
        description={L("Les profs et les élèves voient ce message à la place de l'application. L'équipe admin garde l'accès.", "يرى الأساتذة والتلاميذ هذه الرسالة بدل التطبيق. يحتفظ فريق الإدارة بالولوج.", "Teachers and students see this message instead of the app. Admins keep access.")}
      >
        <SwitchRow
          id="cz-maint"
          label={L("Fermer l'application pour maintenance", "إغلاق التطبيق للصيانة", "Close the app for maintenance")}
          checked={!!draft.maintenance?.enabled}
          onChange={v => update("maintenance", { enabled: v })}
        />
        <I18nField id="cz-maint-msg" multiline label={L("Message affiché", "الرسالة المعروضة", "Message shown")} value={draft.maintenance.message} onChange={v => update("maintenance", { message: v })} />
      </Card>

      <Card
        icon={<History className="h-4 w-4" />}
        title={L("Historique des versions", "سجل النسخ", "Version history")}
        description={L("Les 50 dernières versions enregistrées. « Restaurer » charge la version dans le brouillon : vérifiez puis enregistrez.", "آخر 50 نسخة محفوظة. «استرجاع» يحمل النسخة في المسودة: راجعها ثم احفظ.", "The last 50 saved versions. “Restore” loads it into the draft: review, then save.")}
      >
        {history === null ? (
          <div className="h-16 animate-pulse rounded-lg bg-muted" />
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground">{L("Aucune version précédente (ou migration « outils d'administration » non appliquée).", "لا توجد نسخ سابقة (أو لم يطبق ترحيل « أدوات الإدارة »).", "No previous version (or the “admin tools” migration is not applied).")}</p>
        ) : (
          <ul className="divide-y rounded-lg border text-sm">
            {history.map(h => (
              <li key={h.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0 truncate">{when(h.saved_at)}{h.saved_by && names[h.saved_by] ? ` · ${names[h.saved_by]}` : ""}</span>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
                  onRestore(mergeAppSettings(h.data));
                  toast.success(L("Version chargée dans le brouillon — enregistrez pour l'appliquer", "تم تحميل النسخة في المسودة — احفظ لتطبيقها", "Version loaded into the draft — save to apply"));
                }}>
                  <RotateCcw className="h-3.5 w-3.5" />{L("Restaurer", "استرجاع", "Restore")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

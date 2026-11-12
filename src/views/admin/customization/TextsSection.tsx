import { Globe, Mail, ScrollText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AppSettings, I18nText, Lang } from "@/lib/appSettings";
import { useT } from "../adminShared";
import { Card, Field, I18nField, NativeSelect, type SectionProps } from "./shared";

type TextKey = "loginTitle" | "loginSubtitle" | "loginHelpStudent" | "dashboardWelcome" | "announcement" | "footer";

export default function TextsSection({ draft, update }: SectionProps) {
  const { L } = useT();
  const tx = draft.texts;
  const set = (k: TextKey) => (v: I18nText) => update("texts", { [k]: v } as Partial<AppSettings["texts"]>);

  const tones: { v: AppSettings["texts"]["announcementTone"]; label: string; cls: string }[] = [
    { v: "info", label: L("Information", "معلومة", "Information"), cls: "border-primary/30 bg-accent text-primary   " },
    { v: "warning", label: L("Attention", "تنبيه", "Warning"), cls: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200" },
    { v: "success", label: L("Bonne nouvelle", "خبر سار", "Good news"), cls: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" },
  ];

  return (
    <div className="space-y-4">
      <Card icon={<Globe className="h-4 w-4" />} title={L("Langue", "اللغة", "Language")}>
        <Field
          id="cz-lang"
          label={L("Langue par défaut", "اللغة الافتراضية", "Default language")}
          hint={L("Utilisée à la première visite ; chacun peut ensuite changer de langue.", "تُستعمل عند أول زيارة؛ ويمكن لكل مستخدم تغييرها بعد ذلك.", "Used on the first visit; everyone can switch language afterwards.")}
        >
          <NativeSelect
            id="cz-lang"
            value={tx.defaultLanguage}
            onChange={v => update("texts", { defaultLanguage: v as Lang })}
            options={[
              { value: "ar", label: "العربية" },
              { value: "fr", label: "Français" },
              { value: "en", label: "English" },
            ]}
            className="max-w-xs"
          />
        </Field>
      </Card>

      <Card
        icon={<ScrollText className="h-4 w-4" />}
        title={L("Page de connexion et accueil", "صفحة الدخول والاستقبال", "Login page and home")}
        description={L("Laissez une langue vide pour utiliser le français à sa place.", "اترك لغة فارغة لاستعمال الفرنسية مكانها.", "Leave a language empty to fall back to French.")}
      >
        <I18nField id="cz-login-title" label={L("Titre de la connexion", "عنوان صفحة الدخول", "Login title")} value={tx.loginTitle} onChange={set("loginTitle")} />
        <I18nField id="cz-login-sub" label={L("Sous-titre de la connexion", "العنوان الفرعي لصفحة الدخول", "Login subtitle")} value={tx.loginSubtitle} onChange={set("loginSubtitle")} />
        <I18nField id="cz-login-help" multiline label={L("Aide pour les élèves (sous le formulaire)", "مساعدة للتلاميذ (تحت الاستمارة)", "Help for students (below the form)")} value={tx.loginHelpStudent} onChange={set("loginHelpStudent")} />
        <I18nField
          id="cz-welcome"
          multiline
          label={L("Message d'accueil du tableau de bord", "رسالة الترحيب في لوحة القيادة", "Dashboard welcome message")}
          hint={L("Affiché sous « Bonjour, … ». Vide = aucun message.", "يظهر تحت « مرحبا، … ». فارغ = بدون رسالة.", "Shown under “Hello, …”. Empty = no message.")}
          value={tx.dashboardWelcome}
          onChange={set("dashboardWelcome")}
        />
        <I18nField id="cz-footer" label={L("Pied de page", "تذييل الصفحة", "Footer")} value={tx.footer} onChange={set("footer")} />
      </Card>

      <Card
        icon={<ScrollText className="h-4 w-4" />}
        title={L("Bandeau d'annonce", "شريط الإعلان", "Announcement banner")}
        description={L("Visible en haut de l'application pour tous. Vide = masqué.", "يظهر أعلى التطبيق للجميع. فارغ = مخفي.", "Shown at the top of the app for everyone. Empty = hidden.")}
      >
        <I18nField id="cz-announce" multiline label={L("Texte de l'annonce", "نص الإعلان", "Announcement text")} value={tx.announcement} onChange={set("announcement")} />
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-semibold">{L("Style du bandeau", "نمط الشريط", "Banner style")}</legend>
          <div className="flex flex-wrap gap-2">
            {tones.map(t => (
              <label
                key={t.v}
                className={cn(
                  "flex min-h-[38px] cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium",
                  t.cls,
                  tx.announcementTone === t.v ? "ring-2 ring-foreground/60" : "opacity-80"
                )}
              >
                <input type="radio" name="cz-tone" value={t.v} checked={tx.announcementTone === t.v} onChange={() => update("texts", { announcementTone: t.v })} />
                {t.label}
              </label>
            ))}
          </div>
        </fieldset>
      </Card>

      <Card
        icon={<Mail className="h-4 w-4" />}
        title={L("Contact", "التواصل", "Contact")}
        description={L("Proposé aux professeurs et élèves qui ont besoin d'aide.", "يُعرض على الأساتذة والتلاميذ الذين يحتاجون مساعدة.", "Offered to teachers and students who need help.")}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="cz-email" label={L("E-mail", "البريد الإلكتروني", "Email")}>
            <Input id="cz-email" type="email" dir="ltr" inputMode="email" autoCapitalize="none" value={tx.contactEmail} placeholder="contact@ecole.ma" onChange={e => update("texts", { contactEmail: e.target.value.trim() })} />
          </Field>
          <Field id="cz-phone" label={L("Téléphone", "الهاتف", "Phone")}>
            <Input id="cz-phone" type="tel" dir="ltr" inputMode="tel" value={tx.contactPhone} placeholder="+212 6…" onChange={e => update("texts", { contactPhone: e.target.value })} />
          </Field>
          <Field id="cz-whatsapp" label="WhatsApp" hint={L("Numéro international, ex. 212612345678", "رقم دولي، مثال 212612345678", "International number, e.g. 212612345678")}>
            <Input id="cz-whatsapp" type="tel" dir="ltr" inputMode="tel" value={tx.contactWhatsapp} placeholder="2126…" onChange={e => update("texts", { contactWhatsapp: e.target.value })} />
          </Field>
        </div>
      </Card>
    </div>
  );
}

import { BookOpen, Printer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useT } from "../adminShared";
import { Card, Field, I18nField, ImageField, type SectionProps } from "./shared";

export default function IdentitySection({ draft, update }: SectionProps) {
  const { L } = useT();
  const id = draft.identity;
  return (
    <div className="space-y-4">
      <Card
        icon={<BookOpen className="h-4 w-4" />}
        title={L("Nom et slogan", "الاسم والشعار", "Name and tagline")}
        description={L("Affichés sur la page de connexion, dans le menu et dans l'onglet du navigateur.", "تظهر في صفحة الدخول والقائمة وعنوان المتصفح.", "Shown on the login page, in the menu and in the browser tab.")}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="cz-appname" label={L("Nom de l'application", "اسم التطبيق", "App name")}>
            <Input id="cz-appname" value={id.appName} maxLength={60} onChange={e => update("identity", { appName: e.target.value })} />
          </Field>
          <Field id="cz-shortname" label={L("Nom court", "الاسم المختصر", "Short name")} hint={L("Petits écrans et icône", "الشاشات الصغيرة والأيقونة", "Small screens and icon")}>
            <Input id="cz-shortname" value={id.shortName} maxLength={20} onChange={e => update("identity", { shortName: e.target.value })} />
          </Field>
        </div>
        <I18nField id="cz-tagline" label={L("Slogan", "الشعار", "Tagline")} value={id.tagline} onChange={v => update("identity", { tagline: v })} />
      </Card>

      <Card
        icon={<BookOpen className="h-4 w-4" />}
        title={L("Logo et icône", "الشعار والأيقونة", "Logo and icon")}
        description={L("Les images sont envoyées tout de suite, mais ne s'appliquent qu'après « Enregistrer ».", "تُرفع الصور فورا لكنها لا تُطبق إلا بعد « حفظ ».", "Images are uploaded right away but only apply after “Save”.")}
      >
        <ImageField
          id="cz-logo"
          label={L("Logo", "الشعار", "Logo")}
          hint={L("Carré de préférence", "يفضل أن يكون مربعا", "Square preferred")}
          value={id.logoUrl}
          onChange={url => update("identity", { logoUrl: url })}
          prefix="logo"
          maxBytes={2 * 1024 * 1024}
        />
        <ImageField
          id="cz-favicon"
          label={L("Icône d'onglet (favicon)", "أيقونة المتصفح (favicon)", "Browser icon (favicon)")}
          hint={L("Carré, 64×64 px ou plus", "مربع، 64×64 بكسل أو أكثر", "Square, 64×64 px or larger")}
          value={id.faviconUrl}
          onChange={url => update("identity", { faviconUrl: url })}
          prefix="favicon"
          maxBytes={512 * 1024}
        />
      </Card>

      <Card icon={<Printer className="h-4 w-4" />} title={L("Logo des rapports", "شعار التقارير", "Report logo")}>
        <ImageField
          id="cz-report-logo"
          label={L("Logo des rapports PDF et reçus", "شعار تقارير PDF والوصولات", "Logo on PDF reports and receipts")}
          hint={L("Vide = logo de l'application", "فارغ = شعار التطبيق", "Empty = app logo")}
          value={draft.reports.logoUrl}
          onChange={url => update("reports", { logoUrl: url })}
          prefix="report-logo"
          maxBytes={2 * 1024 * 1024}
          square={false}
        />
      </Card>
    </div>
  );
}

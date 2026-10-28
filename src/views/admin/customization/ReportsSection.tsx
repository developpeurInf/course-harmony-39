import { FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { AppSettings, I18nText } from "@/lib/appSettings";
import { useT } from "../adminShared";
import { Card, Field, I18nField, SwitchRow, type SectionProps } from "./shared";

type RText = "headerTitle" | "headerSubtitle" | "footerText" | "receiptFooter";

export default function ReportsSection({ draft, update }: SectionProps) {
  const { L } = useT();
  const r = draft.reports;
  const set = (k: RText) => (v: I18nText) => update("reports", { [k]: v } as Partial<AppSettings["reports"]>);
  return (
    <div className="space-y-4">
      <Card
        icon={<FileText className="h-4 w-4" />}
        title={L("En-tête des rapports PDF", "رأس تقارير PDF", "PDF report header")}
        description={L("Rapports de classe, évaluations diagnostiques et reçus de paiement.", "تقارير الأقسام والتقويمات التشخيصية ووصولات الأداء.", "Class reports, diagnostic assessments and payment receipts.")}
      >
        <Field id="cz-school" label={L("Nom de l'établissement", "اسم المؤسسة", "School name")} hint={L("Vide = nom de l'application", "فارغ = اسم التطبيق", "Empty = app name")}>
          <Input id="cz-school" value={r.schoolName} maxLength={120} onChange={e => update("reports", { schoolName: e.target.value })} />
        </Field>
        <I18nField id="cz-r-title" label={L("Titre de l'en-tête", "عنوان الرأس", "Header title")} value={r.headerTitle} onChange={set("headerTitle")} />
        <I18nField id="cz-r-sub" label={L("Sous-titre de l'en-tête", "العنوان الفرعي للرأس", "Header subtitle")} value={r.headerSubtitle} onChange={set("headerSubtitle")} />
        <SwitchRow
          id="cz-r-logo"
          label={L("Afficher le logo sur les rapports", "إظهار الشعار في التقارير", "Show the logo on reports")}
          description={L("Logo des rapports (onglet Identité), sinon logo de l'application.", "شعار التقارير (تبويب الهوية)، وإلا شعار التطبيق.", "Report logo (Identity tab), otherwise the app logo.")}
          checked={r.showLogo}
          onChange={v => update("reports", { showLogo: v })}
        />
      </Card>
      <Card icon={<FileText className="h-4 w-4" />} title={L("Pied de page", "تذييل الصفحة", "Footer")}>
        <I18nField id="cz-r-footer" multiline label={L("Pied de page des rapports", "تذييل التقارير", "Report footer")} value={r.footerText} onChange={set("footerText")} />
        <I18nField
          id="cz-r-receipt"
          multiline
          label={L("Mentions des reçus de paiement", "بيانات وصولات الأداء", "Payment receipt notes")}
          hint={L("Ex. adresse, numéro d'identification, conditions.", "مثال: العنوان، رقم التعريف، الشروط.", "E.g. address, registration number, terms.")}
          value={r.receiptFooter}
          onChange={set("receiptFooter")}
        />
      </Card>
    </div>
  );
}

/** Formulaire des réglages d'un modèle du Labo 3D (professeur : tous ; élève : ceux marqués « élève ») */
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { templateById, type Params, type Tri } from "@/lib/lab3d/templates";
import { cn } from "@/lib/utils";

export function ParamsForm({ template, params, onChange, studentOnly, compact, showStudentFlag }: {
  template: string;
  params: Params;
  onChange: (p: Params) => void;
  studentOnly?: boolean;
  compact?: boolean;
  showStudentFlag?: boolean;
}) {
  const { language } = useLanguage();
  const L = (t: Tri) => (language === "ar" ? t.ar : language === "en" ? t.en : t.fr);
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);
  const def = templateById(template);
  const list = def.params.filter((p) => !studentOnly || p.student);
  const set = (k: string, v: any) => onChange({ ...params, [k]: v });
  if (!list.length) return null;
  return (
    <div className={cn("grid gap-3", compact ? "sm:grid-cols-2" : "")}>
      {list.map((p) => {
        const flag = showStudentFlag && p.student ? <span className="ms-1 rounded bg-primary/10 px-1 text-[10px] font-medium text-primary">{tr("élève", "تلميذ", "student")}</span> : null;
        if (p.type === "number") {
          const v = Number(params[p.key] ?? p.def);
          return (
            <div key={p.key} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <Label className="text-xs font-medium">{L(p.label)}{flag}</Label>
                <span className="tabular-nums text-muted-foreground">{String(Math.round(v * 100) / 100).replace(".", language === "en" ? "." : ",")}</span>
              </div>
              <Slider min={p.min} max={p.max} step={p.step} value={[v]} onValueChange={([x]) => set(p.key, x)} />
            </div>
          );
        }
        if (p.type === "bool") {
          return (
            <label key={p.key} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs font-medium">
              <span>{L(p.label)}{flag}</span>
              <Switch checked={params[p.key] === undefined ? p.def : !!params[p.key]} onCheckedChange={(c) => set(p.key, c)} />
            </label>
          );
        }
        if (p.type === "select") {
          return (
            <div key={p.key} className="space-y-1.5">
              <Label className="text-xs font-medium">{L(p.label)}{flag}</Label>
              <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={String(params[p.key] ?? p.def)} onChange={(e) => set(p.key, e.target.value)}>
                {p.options.map((o) => <option key={o.v} value={o.v}>{L(o.label)}</option>)}
              </select>
            </div>
          );
        }
        return (
          <div key={p.key} className={cn("space-y-1.5", compact && "sm:col-span-2")}>
            <Label className="text-xs font-medium">{L(p.label)}{flag}</Label>
            {p.multiline
              ? <Textarea rows={4} className="font-mono text-xs" placeholder={p.placeholder} value={String(params[p.key] ?? p.def)} onChange={(e) => set(p.key, e.target.value)} />
              : <Input className="font-mono text-xs" placeholder={p.placeholder} value={String(params[p.key] ?? p.def)} onChange={(e) => set(p.key, e.target.value)} />}
          </div>
        );
      })}
    </div>
  );
}

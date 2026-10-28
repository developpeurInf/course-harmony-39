import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Palette, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { FONT_OPTIONS, contrastRatio, type AppSettings, type FontChoice, type ThemeMode } from "@/lib/appSettings";
import { useT } from "../adminShared";
import { Card, Field, NativeSelect, type SectionProps } from "./shared";

const HEX = /^#[0-9a-f]{6}$/i;

type ColorKey = "primary" | "accent" | "success" | "danger";

const PRESETS: Record<ColorKey, string[]> = {
  primary: ["#2b4aca", "#2563eb", "#4f46e5", "#7c3aed", "#0d9488", "#059669", "#ea580c", "#e11d48", "#0f172a"],
  accent: ["#eceef9", "#e0e7ff", "#ede9fe", "#ccfbf1", "#dcfce7", "#ffedd5", "#ffe4e6", "#f1f5f9"],
  success: ["#16a34a", "#059669", "#0d9488", "#65a30d"],
  danger: ["#dc2626", "#e11d48", "#ea580c", "#b91c1c"],
};

/** Couleur : sélecteur natif + code hex + pastilles prédéfinies */
function ColorField({ id, label, value, presets, onChange }: { id: string; label: string; value: string; presets: string[]; onChange: (v: string) => void }) {
  const { L } = useT();
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const valid = HEX.test(text);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${id}-hex`} className="text-sm font-semibold">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          id={`${id}-picker`}
          type="color"
          aria-label={`${label} — ${L("sélecteur", "منتقي", "picker")}`}
          value={HEX.test(value) ? value : "#000000"}
          onChange={e => onChange(e.target.value.toLowerCase())}
          className="h-10 w-12 flex-shrink-0 cursor-pointer rounded-md border bg-background p-1"
        />
        <Input
          id={`${id}-hex`}
          dir="ltr"
          value={text}
          maxLength={7}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          aria-invalid={!valid}
          className={cn("w-28 font-mono uppercase", !valid && "border-red-500 focus-visible:ring-red-500")}
          onChange={e => {
            let v = e.target.value.trim();
            if (v && v.charAt(0) !== "#") v = "#" + v;
            setText(v);
            if (HEX.test(v)) onChange(v.toLowerCase());
          }}
          onBlur={() => !HEX.test(text) && setText(value)}
        />
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={L("Couleurs suggérées", "ألوان مقترحة", "Suggested colors")}>
        {presets.map(c => (
          <button
            key={c}
            type="button"
            title={c}
            aria-label={c}
            aria-pressed={value.toLowerCase() === c}
            onClick={() => onChange(c)}
            className={cn(
              "h-7 w-7 rounded-full border-2 shadow-sm transition-transform",
              value.toLowerCase() === c ? "border-foreground ring-2 ring-offset-1 ring-offset-background" : "border-white dark:border-slate-700"
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );
}

const SAMPLE_LINK_ID = "app-settings-font-sample";

export default function ThemeSection({ draft, update }: SectionProps) {
  const { L } = useT();
  const th = draft.theme;
  const font = FONT_OPTIONS[th.font] || FONT_OPTIONS.system;
  const ratio = contrastRatio(th.primary, "#ffffff");

  // Charge la police choisie pour l'échantillon (sans l'appliquer à l'application)
  useEffect(() => {
    let link = document.getElementById(SAMPLE_LINK_ID) as HTMLLinkElement | null;
    if (!font.google) return;
    const href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`;
    if (!link) {
      link = document.createElement("link");
      link.id = SAMPLE_LINK_ID;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.href !== href) link.href = href;
  }, [font.google]);

  const setColor = (k: ColorKey) => (v: string) => update("theme", { [k]: v } as Partial<AppSettings["theme"]>);

  const modes: { v: ThemeMode; label: string }[] = [
    { v: "light", label: L("Clair", "فاتح", "Light") },
    { v: "dark", label: L("Sombre", "داكن", "Dark") },
    { v: "system", label: L("Selon l'appareil", "حسب الجهاز", "System") },
  ];

  return (
    <div className="space-y-4">
      <Card
        icon={<Palette className="h-4 w-4" />}
        title={L("Couleurs", "الألوان", "Colors")}
        description={L("La couleur principale colore les boutons, liens, menus et graphiques.", "اللون الرئيسي يلوّن الأزرار والروابط والقوائم والمبيانات.", "The primary color is used for buttons, links, menus and charts.")}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <ColorField id="cz-primary" label={L("Couleur principale", "اللون الرئيسي", "Primary color")} value={th.primary} presets={PRESETS.primary} onChange={setColor("primary")} />
          <ColorField id="cz-accent" label={L("Couleur d'accent (fonds légers)", "لون التمييز (خلفيات فاتحة)", "Accent color (light backgrounds)")} value={th.accent} presets={PRESETS.accent} onChange={setColor("accent")} />
          <ColorField id="cz-success" label={L("Succès", "النجاح", "Success")} value={th.success} presets={PRESETS.success} onChange={setColor("success")} />
          <ColorField id="cz-danger" label={L("Danger / erreur", "الخطر / الخطأ", "Danger / error")} value={th.danger} presets={PRESETS.danger} onChange={setColor("danger")} />
        </div>

        <div
          role="status"
          className={cn(
            "flex items-start gap-2.5 rounded-lg border p-3 text-sm",
            ratio >= 4.5
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          )}
        >
          {ratio >= 4.5 ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />}
          <div className="min-w-0">
            <p className="font-semibold">
              {L("Contraste texte blanc / couleur principale", "تباين النص الأبيض / اللون الرئيسي", "White text / primary color contrast")} :{" "}
              <span dir="ltr" className="font-mono">{ratio.toFixed(2)} : 1</span>
            </p>
            <p className="mt-0.5 text-xs">
              {ratio >= 4.5
                ? L("Lisible (norme WCAG AA ≥ 4,5).", "مقروء (معيار WCAG AA ≥ 4.5).", "Readable (WCAG AA ≥ 4.5).")
                : ratio >= 3
                  ? L("Contraste faible (< 4,5) : le texte des boutons sera difficile à lire. Choisissez une teinte plus foncée.", "تباين ضعيف (< 4.5): سيصعب قراءة نص الأزرار. اختر لونا أغمق.", "Low contrast (< 4.5): button text will be hard to read. Pick a darker shade.")
                  : L("Couleur très claire : le texte des boutons passera automatiquement en sombre.", "لون فاتح جدا: سيصبح نص الأزرار داكنا تلقائيا.", "Very light color: button text will automatically switch to dark.")}
            </p>
          </div>
          <span
            className="ml-auto flex-shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold text-white rtl:ml-0 rtl:mr-auto"
            style={{ backgroundColor: th.primary }}
            aria-hidden="true"
          >
            Aa
          </span>
        </div>
      </Card>

      <Card icon={<Sparkles className="h-4 w-4" />} title={L("Forme et typographie", "الشكل والخط", "Shape and typography")}>
        <Field id="cz-radius" label={`${L("Arrondi des angles", "استدارة الزوايا", "Corner radius")} — ${th.radius.toFixed(2)} rem`}>
          <div className="flex items-center gap-3">
            <input
              id="cz-radius"
              type="range"
              min={0}
              max={1.5}
              step={0.125}
              value={th.radius}
              onChange={e => update("theme", { radius: Number(e.target.value) })}
              className="h-9 w-full max-w-xs cursor-pointer accent-primary"
            />
            <span className="h-10 w-16 flex-shrink-0 border-2 border-primary bg-primary/10" style={{ borderRadius: `${th.radius}rem` }} aria-hidden="true" />
          </div>
        </Field>

        <Field id="cz-font" label={L("Police", "الخط", "Font")}>
          <NativeSelect
            id="cz-font"
            value={th.font}
            onChange={v => update("theme", { font: v as FontChoice })}
            options={(Object.keys(FONT_OPTIONS) as FontChoice[]).map(k => ({
              value: k,
              label: k === "system" ? L("Police du système", "خط النظام", "System font") : FONT_OPTIONS[k].label,
            }))}
            className="max-w-xs"
          />
          <div className="mt-2 space-y-1 rounded-lg border bg-muted/40 p-3" style={font.css ? { fontFamily: font.css } : undefined}>
            <p className="text-base font-semibold" lang="fr" dir="ltr">Bonjour ! Les fractions : ½ + ¼ = ¾</p>
            <p className="text-base" lang="ar" dir="rtl">مرحبا! حل المعادلة ٢س + ٣ = ٧</p>
          </div>
        </Field>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-semibold">{L("Mode d'affichage par défaut", "وضع العرض الافتراضي", "Default display mode")}</legend>
          <p className="text-xs text-muted-foreground">{L("Pour les utilisateurs qui n'ont pas encore choisi.", "للمستخدمين الذين لم يختاروا بعد.", "For users who haven't chosen yet.")}</p>
          <div className="flex flex-wrap gap-2">
            {modes.map(m => (
              <label
                key={m.v}
                className={cn(
                  "flex min-h-[38px] cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium",
                  th.defaultMode === m.v ? "border-primary bg-primary/10 text-foreground" : "hover:bg-muted"
                )}
              >
                <input type="radio" name="cz-mode" value={m.v} checked={th.defaultMode === m.v} onChange={() => update("theme", { defaultMode: m.v })} className="accent-primary" />
                {m.label}
              </label>
            ))}
          </div>
        </fieldset>
      </Card>
    </div>
  );
}

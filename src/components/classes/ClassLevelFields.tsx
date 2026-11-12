"use client";
import { useLanguage } from "@/contexts/LanguageContext";
import { LEVELS, SUBJECTS } from "@/lib/proposed/catalog";

const sel = "h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground";

/** Champs niveau / matière / lycée d'une classe (création et mise à jour) */
export function ClassLevelFields({
  value, onChange, idPrefix = "cl", compact = false,
}: {
  value: { level: string; subject: string; school_name: string };
  onChange: (v: { level: string; subject: string; school_name: string }) => void;
  idPrefix?: string;
  compact?: boolean;
}) {
  const { language } = useLanguage();
  const L = (v: [string, string, string]) => (language === "ar" ? v[1] : language === "en" ? v[2] : v[0]);
  const tr = (fr: string, ar: string, en: string) => L([fr, ar, en]);
  return (
    <div className={compact ? "grid gap-2 sm:grid-cols-3" : "grid gap-4 sm:grid-cols-2"}>
      <label className="flex flex-col gap-1 text-sm font-medium" htmlFor={`${idPrefix}-level`}>
        {!compact && <span>{tr("Niveau *", "المستوى *", "Level *")}</span>}
        <select id={`${idPrefix}-level`} required value={value.level} onChange={(e) => onChange({ ...value, level: e.target.value })} className={sel} aria-label={tr("Niveau", "المستوى", "Level")}>
          <option value="">{tr("Choisir le niveau", "اختر المستوى", "Choose level")}</option>
          {LEVELS.map((l) => <option key={l.key} value={l.key}>{L(l.label)}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium" htmlFor={`${idPrefix}-subject`}>
        {!compact && <span>{tr("Matière *", "المادة *", "Subject *")}</span>}
        <select id={`${idPrefix}-subject`} required value={value.subject} onChange={(e) => onChange({ ...value, subject: e.target.value })} className={sel} aria-label={tr("Matière", "المادة", "Subject")}>
          <option value="">{tr("Choisir la matière", "اختر المادة", "Choose subject")}</option>
          {SUBJECTS.map((s) => <option key={s.key} value={s.key}>{L(s.label)}</option>)}
        </select>
      </label>
      <label className={compact ? "flex flex-col gap-1 text-sm font-medium" : "flex flex-col gap-1 text-sm font-medium sm:col-span-2"} htmlFor={`${idPrefix}-school`}>
        {!compact && <span>{tr("Lycée", "الثانوية", "School")}</span>}
        <input id={`${idPrefix}-school`} value={value.school_name} onChange={(e) => onChange({ ...value, school_name: e.target.value })} placeholder={tr("Nom du lycée", "اسم الثانوية", "School name")} className={sel} aria-label={tr("Lycée", "الثانوية", "School")} />
      </label>
    </div>
  );
}

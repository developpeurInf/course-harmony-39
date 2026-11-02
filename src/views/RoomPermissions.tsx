import { useMemo, useState } from "react";
import { Navigate, useParams } from "@/lib/router";
import { ShieldCheck, Eye, EyeOff, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses } from "@/contexts/CourseContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { useAccess } from "@/contexts/AccessContext";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { CLASS_MODULES, roomModuleOn, type ClassModuleKey, type StudentModules } from "@/lib/classModules";
import { cn } from "@/lib/utils";

/**
 * Habilitations d'une classe : le professeur choisit les modules que les élèves
 * de cette classe voient dans leur barre latérale (et peuvent ouvrir).
 */
export default function RoomPermissions() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const { rooms, updateRoom } = useCourses();
  const { language } = useLanguage();
  const { feature } = useAppSettings();
  const { hasModule } = useAccess();
  const [saving, setSaving] = useState<string | null>(null);
  const isRtl = language === "ar";
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);
  const pick = (l: [string, string, string]) => tr(l[0], l[1], l[2]);

  const room = rooms.find((r) => r.id === roomId);

  // Module coupé plus haut (administration ou offre) : affiché mais non modifiable
  const upstreamOff = (key: ClassModuleKey) => {
    const def = CLASS_MODULES.find((m) => m.key === key);
    return !!def?.feature && (!feature(def.feature) || !hasModule(def.feature));
  };

  const openCount = useMemo(
    () => CLASS_MODULES.filter((m) => !upstreamOff(m.key) && roomModuleOn(room, m.key)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room, feature, hasModule]
  );
  const available = CLASS_MODULES.filter((m) => !upstreamOff(m.key)).length;

  if (!roomId || user?.role !== "professor") return <Navigate to="/dashboard" replace />;
  if (!room) {
    return <p className="p-6 text-sm text-muted-foreground">{tr("Classe introuvable.", "القسم غير موجود.", "Class not found.")}</p>;
  }

  const save = async (next: StudentModules, busyKey: string) => {
    setSaving(busyKey);
    // On ne garde que les modules fermés : une clé absente veut dire « ouvert »
    const compact: StudentModules = {};
    for (const m of CLASS_MODULES) if (next[m.key] === false) compact[m.key] = false;
    const ok = await updateRoom(room.id, { student_modules: compact }, { silent: true });
    setSaving(null);
    if (ok) toast.success(tr("Habilitations enregistrées", "تم حفظ الصلاحيات", "Access saved"));
  };

  const current = (room.student_modules || {}) as StudentModules;
  const toggle = (key: ClassModuleKey, on: boolean) => save({ ...current, [key]: on ? undefined : false }, key);
  const setAll = (on: boolean) => {
    const next: StudentModules = {};
    if (!on) for (const m of CLASS_MODULES) next[m.key] = false;
    return save(next, on ? "all-on" : "all-off");
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="mx-auto max-w-3xl space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ShieldCheck className="h-6 w-6 text-primary" />
            {tr("Habilitations", "صلاحيات التلاميذ", "Student access")}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {tr(
              `Choisissez ce que les élèves de « ${room.name} » voient dans leur menu. Un module fermé disparaît de leur barre latérale et sa page leur est refusée. Rien n'est supprimé : vous le rouvrez quand vous voulez.`,
              `اختر ما يراه تلاميذ « ${room.name} » في قائمتهم. الوحدة المغلقة تختفي من شريطهم الجانبي ولا يمكنهم فتحها. لا يُحذف أي شيء: يمكنك إعادة فتحها متى شئت.`,
              `Choose what students of “${room.name}” see in their menu. A closed module disappears from their sidebar and its page is refused. Nothing is deleted: reopen it any time.`
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" disabled={!!saving} onClick={() => setAll(true)}>
            <Eye className="h-4 w-4" />
            {tr("Tout ouvrir", "فتح الكل", "Open all")}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={!!saving} onClick={() => setAll(false)}>
            <EyeOff className="h-4 w-4" />
            {tr("Tout fermer", "إغلاق الكل", "Close all")}
          </Button>
        </div>
      </div>

      <p className="text-sm font-medium text-muted-foreground">
        {tr(`${openCount} module(s) ouvert(s) sur ${available}`, `${openCount} وحدة مفتوحة من ${available}`, `${openCount} of ${available} module(s) open`)}
      </p>

      <ul className="divide-y rounded-xl border bg-card">
        {CLASS_MODULES.map((m) => {
          const off = upstreamOff(m.key);
          const on = !off && roomModuleOn(room, m.key);
          const Icon = m.icon;
          return (
            <li key={m.key} className={cn("flex items-center gap-3 px-4 py-3", off && "opacity-60")}>
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  on ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <label htmlFor={`cm-${m.key}`} className="min-w-0 flex-1 cursor-pointer">
                <span className="block text-sm font-medium">{pick(m.label)}</span>
                <span className="block text-xs text-muted-foreground">
                  {off ? (
                    <span className="inline-flex items-center gap-1">
                      <PowerOff className="h-3 w-3" />
                      {tr("Désactivé par l'administration ou absent de votre offre", "معطل من طرف الإدارة أو غير مدرج في عرضك", "Disabled by the administration or not in your plan")}
                    </span>
                  ) : (
                    pick(m.hint)
                  )}
                </span>
              </label>
              <Switch
                id={`cm-${m.key}`}
                checked={on}
                disabled={off || !!saving}
                onCheckedChange={(v) => toggle(m.key, v)}
                aria-label={pick(m.label)}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

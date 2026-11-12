/** Préférences de notification (user_prefs.notify) : rappels de devoirs (élèves) */
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { getUserPrefs, saveUserPrefs, type UserPrefs } from "@/lib/userPrefs";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentFeatures } from "@/lib/studentFeatures";

type Key = "reminders";

export function NotificationPrefsCard({ student }: { student: boolean }) {
  const { language } = useLanguage();
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);
  const [prefs, setPrefs] = useState<UserPrefs | null>(null);
  const { user } = useAuth();
  const sf = useStudentFeatures(user?.id);

  useEffect(() => {
    getUserPrefs().then(setPrefs);
  }, []);

  if (!prefs || !student || !sf?.reminders) return null;
  const notify = prefs.notify || {};
  const rows: { key: Key; label: string; hint: string }[] = [
    { key: "reminders", label: tr("Rappels de devoirs", "تذكيرات الواجبات", "Homework reminders"), hint: tr("La veille d'une date limite, si rien n'est rendu.", "قبل يوم من الموعد إن لم يُسلَّم شيء.", "The day before a deadline, if nothing was handed in.") },
  ];

  const toggle = async (key: Key, value: boolean) => {
    const next = { ...prefs, notify: { ...notify, [key]: value } };
    setPrefs(next);
    if (await saveUserPrefs(next)) toast.success(tr("Préférence enregistrée", "تم حفظ التفضيل", "Preference saved"));
  };

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Bell className="h-4 w-4 text-primary" />{tr("Notifications", "الإشعارات", "Notifications")}</h2>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.key} className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor={`notif-${r.key}`} className="text-sm">{r.label}</Label>
              <p className="text-xs text-muted-foreground">{r.hint}</p>
            </div>
            <Switch id={`notif-${r.key}`} checked={notify[r.key] !== false} onCheckedChange={(v) => toggle(r.key, v)} />
          </div>
        ))}
      </div>
    </section>
  );
}

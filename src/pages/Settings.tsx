import { useEffect, useState, type ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePreferences, playNotificationSound, AttemptPolicy, ACCENT_PRESETS, AccentColor } from "@/contexts/PreferencesContext";
import {
  Globe, Moon, Sun, Monitor, Key, AlertCircle, Bell, Volume2, MonitorSmartphone, Type, Rows3, Sparkles,
  GraduationCap, FileQuestion, ShieldCheck, Cloud, CloudOff, Loader2, Check, RotateCcw, Clock, Palette
} from "lucide-react";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";
import { PasswordResetManager } from "@/components/PasswordResetManager";
import QuizSettings from "@/components/QuizSettings";
import { supabase } from "@/integrations/supabase/client";

type SectionId = "general" | "display" | "notifications" | "evaluation" | "quiz" | "security";

/* ───────────── petits composants de mise en page ───────────── */

const Row = ({ icon, title, desc, children }: { icon?: ReactNode; title: ReactNode; desc?: ReactNode; children: ReactNode }) => (
  <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex items-start gap-3 min-w-0">
      {icon && <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">{icon}</span>}
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        {desc && <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{desc}</p>}
      </div>
    </div>
    <div className="shrink-0 sm:ms-4">{children}</div>
  </div>
);

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; icon?: ReactNode }[] }) {
  return (
    <div className="inline-flex rounded-xl bg-muted p-1">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
            value === o.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

const SectionCard = ({ id, icon, title, desc, onReset, resetLabel, children }: { id: string; icon: ReactNode; title: string; desc: string; onReset?: () => void; resetLabel?: string; children: ReactNode }) => (
  <Card id={`settings-${id}`} className="scroll-mt-24">
    <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span>
        <div>
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription className="mt-1">{desc}</CardDescription>
        </div>
      </div>
      {onReset && (
        <Button variant="ghost" size="sm" onClick={onReset} className="gap-1.5 text-xs text-muted-foreground">
          <RotateCcw className="h-3.5 w-3.5" />
          {resetLabel}
        </Button>
      )}
    </CardHeader>
    <CardContent className="divide-y">{children}</CardContent>
  </Card>
);

const Settings = () => {
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [isRequestingReset, setIsRequestingReset] = useState(false);
  const { language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const { prefs, update, reset, syncState } = usePreferences();
  const isProfessor = user?.role === "professor";
  const isRtl = language === "ar";
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "fr" ? fr : en);
  const [active, setActive] = useState<SectionId>("general");
  const [notifPermission, setNotifPermission] = useState<string>(
    typeof window !== "undefined" && "Notification" in window ? window.Notification.permission : "unsupported"
  );

  // Champs numériques édités localement (validés à la sortie du champ)
  const [levels, setLevels] = useState({ s: String(prefs.levelStruggling), g: String(prefs.levelGood), e: String(prefs.levelExcellent), p: String(prefs.passThreshold) });
  useEffect(() => {
    setLevels({ s: String(prefs.levelStruggling), g: String(prefs.levelGood), e: String(prefs.levelExcellent), p: String(prefs.passThreshold) });
  }, [prefs.levelStruggling, prefs.levelGood, prefs.levelExcellent, prefs.passThreshold]);

  const [durations, setDurations] = useState({ q: String(prefs.defaultQuizDuration), e: String(prefs.defaultExamDuration) });
  useEffect(() => {
    setDurations({ q: String(prefs.defaultQuizDuration), e: String(prefs.defaultExamDuration) });
  }, [prefs.defaultQuizDuration, prefs.defaultExamDuration]);
  const commitDurations = () => {
    const q = parseInt(durations.q), e = parseInt(durations.e);
    if (!(q >= 1 && q <= 600 && e >= 1 && e <= 600)) {
      toast.error(tr("Durée invalide (entre 1 et 600 minutes).", "مدة غير صالحة (بين 1 و600 دقيقة).", "Invalid duration (1–600 minutes)."));
      setDurations({ q: String(prefs.defaultQuizDuration), e: String(prefs.defaultExamDuration) });
      return;
    }
    update({ defaultQuizDuration: q, defaultExamDuration: e });
  };

  const commitLevels = () => {
    const n = (v: string) => parseFloat(v.replace(",", "."));
    const s = n(levels.s), g = n(levels.g), e = n(levels.e), p = n(levels.p);
    if ([s, g, e, p].some(x => isNaN(x) || x < 0 || x > 20)) {
      toast.error(tr("Les seuils doivent être compris entre 0 et 20.", "يجب أن تكون العتبات بين 0 و20.", "Thresholds must be between 0 and 20."));
      return;
    }
    if (!(s <= g && g <= e)) {
      toast.error(tr("Les seuils doivent être croissants : difficulté ≤ satisfaisant ≤ excellent.", "يجب أن تكون العتبات تصاعدية.", "Thresholds must be increasing."));
      return;
    }
    update({ levelStruggling: s, levelGood: g, levelExcellent: e, passThreshold: p });
  };

  const sections: { id: SectionId; icon: ReactNode; label: string; show: boolean }[] = [
    { id: "general", icon: <Globe className="h-4 w-4" />, label: tr("Général", "عام", "General"), show: true },
    { id: "display", icon: <Type className="h-4 w-4" />, label: tr("Affichage", "العرض", "Display"), show: true },
    { id: "notifications", icon: <Bell className="h-4 w-4" />, label: tr("Notifications", "الإشعارات", "Notifications"), show: true },
    { id: "evaluation", icon: <GraduationCap className="h-4 w-4" />, label: tr("Évaluation", "التقويم", "Assessment"), show: isProfessor },
    { id: "quiz", icon: <FileQuestion className="h-4 w-4" />, label: tr("Nouveaux quiz", "الاختبارات الجديدة", "New quizzes"), show: isProfessor },
    { id: "security", icon: <ShieldCheck className="h-4 w-4" />, label: tr("Sécurité", "الأمان", "Security"), show: true },
  ];

  const goTo = (id: SectionId) => {
    setActive(id);
    document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: prefs.reduceMotion ? "auto" : "smooth", block: "start" });
  };

  const requestBrowserPermission = async () => {
    if (!("Notification" in window)) {
      toast.error(tr("Votre navigateur ne prend pas en charge les notifications.", "متصفحك لا يدعم الإشعارات.", "Your browser does not support notifications."));
      return;
    }
    const res = await window.Notification.requestPermission();
    setNotifPermission(res);
    if (res === "granted") {
      update({ notifyBrowser: true });
      new window.Notification(tr("Notifications activées", "تم تفعيل الإشعارات", "Notifications enabled"), {
        body: tr("Vous serez prévenu même quand l'onglet est en arrière-plan.", "ستتوصل بالإشعارات حتى عندما تكون الصفحة في الخلفية.", "You'll be notified even when the tab is in the background."),
      });
    } else {
      update({ notifyBrowser: false });
      toast.info(tr("Autorisation refusée par le navigateur.", "رفض المتصفح الإذن.", "Permission denied by the browser."));
    }
  };

  const handleRequestPasswordReset = async () => {
    if (!user || user.role !== "student") return;
    setIsRequestingReset(true);
    try {
      const { data: enrollments, error: enrollError } = await supabase
        .from("enrollments")
        .select("courses!inner(professor_id, room_id)")
        .eq("student_id", user.id)
        .limit(1);
      if (enrollError || !enrollments?.length) {
        toast.error(tr("Impossible de trouver votre professeur. Contactez le support.", "تعذّر العثور على أستاذك. يرجى التواصل مع الدعم.", "Unable to find your professor. Please contact support."));
        return;
      }
      const professorId = (enrollments[0] as any).courses.professor_id;
      const roomId = (enrollments[0] as any).courses.room_id;
      const { error: insertError } = await supabase
        .from("password_reset_requests")
        .insert({ student_id: user.id, professor_id: professorId, room_id: roomId, status: "pending" });
      if (insertError) {
        toast.error(tr("Échec de la demande de réinitialisation", "فشل في إرسال طلب إعادة التعيين", "Failed to request password reset"));
        return;
      }
      toast.success(tr("Demande de réinitialisation envoyée à votre professeur", "تم إرسال طلب إعادة تعيين كلمة المرور إلى أستاذك", "Password reset request sent to your professor"));
    } catch (error) {
      console.error("Error requesting password reset:", error);
      toast.error(tr("Échec de la demande de réinitialisation", "فشل في إرسال طلب إعادة التعيين", "Failed to request password reset"));
    } finally {
      setIsRequestingReset(false);
    }
  };

  const renderSyncBadge = () => {
    const map = {
      idle: { icon: <Cloud className="h-3.5 w-3.5" />, text: tr("Synchronisé avec votre compte", "متزامن مع حسابك", "Synced with your account"), cls: "bg-muted text-muted-foreground" },
      saved: { icon: <Check className="h-3.5 w-3.5" />, text: tr("Enregistré", "تم الحفظ", "Saved"), cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
      saving: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, text: tr("Enregistrement…", "جارٍ الحفظ…", "Saving…"), cls: "bg-muted text-muted-foreground" },
      local: { icon: <CloudOff className="h-3.5 w-3.5" />, text: tr("Enregistré sur cet appareil", "محفوظ على هذا الجهاز", "Saved on this device"), cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
      error: { icon: <CloudOff className="h-3.5 w-3.5" />, text: tr("Enregistré localement (synchronisation impossible)", "محفوظ محلياً (تعذرت المزامنة)", "Saved locally (sync failed)"), cls: "bg-rose-500/10 text-rose-700 dark:text-rose-300" },
    }[syncState];
    return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${map.cls}`}>{map.icon}{map.text}</span>;
  };

  const fmt = (n: number) => String(n).replace(".", language === "en" ? "." : ",");
  const scale = [
    { from: 0, to: prefs.levelStruggling, color: "#e11d48", label: tr("En difficulté", "متعثر", "Struggling") },
    { from: prefs.levelStruggling, to: prefs.levelGood, color: "#d97706", label: tr("En progression", "في تقدم", "Progressing") },
    { from: prefs.levelGood, to: prefs.levelExcellent, color: "#0284c7", label: tr("Satisfaisant", "جيد", "Good") },
    { from: prefs.levelExcellent, to: 20, color: "#059669", label: tr("Excellent", "ممتاز", "Excellent") },
  ];

  const policies: { value: AttemptPolicy; title: string; desc: string }[] = [
    { value: "latest", title: tr("Dernière tentative", "آخر محاولة", "Latest attempt"), desc: tr("Reflète le niveau actuel de l'élève.", "تعكس المستوى الحالي للتلميذ.", "Reflects the student's current level.") },
    { value: "best", title: tr("Meilleure tentative", "أفضل محاولة", "Best attempt"), desc: tr("Valorise la progression, encourage à repasser.", "تثمن التقدم وتشجع على إعادة المحاولة.", "Rewards improvement, encourages retakes.") },
    { value: "average", title: tr("Moyenne des tentatives", "معدل المحاولات", "Average of attempts"), desc: tr("Tient compte de tous les essais.", "تأخذ بعين الاعتبار جميع المحاولات.", "Takes every attempt into account.") },
  ];

  return (
    <div className="container mx-auto max-w-6xl space-y-6 py-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* En-tête simple */}
      <div className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{tr("Paramètres", "الإعدادات", "Settings")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tr("Personnalisez l'application. Les changements sont appliqués et enregistrés automatiquement.", "خصص التطبيق. يتم تطبيق التغييرات وحفظها تلقائياً.", "Customise the app. Changes are applied and saved automatically.")}</p>
        </div>
        {renderSyncBadge()}
      </div>

      <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
        {/* Navigation */}
        <nav className="lg:sticky lg:top-20 lg:self-start">
          <div className="flex gap-1 overflow-x-auto rounded-2xl border bg-card p-1.5 lg:flex-col">
            {sections.filter(s => s.show).map(s => (
              <button
                key={s.id}
                onClick={() => goTo(s.id)}
                className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  active === s.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="space-y-6">
          {/* ── Général ── */}
          <SectionCard id="general" icon={<Globe className="h-5 w-5" />} title={tr("Général", "عام", "General")} desc={tr("Langue et apparence de l'interface.", "لغة ومظهر الواجهة.", "Interface language and appearance.")}>
            <Row icon={<Globe className="h-4 w-4" />} title={tr("Langue", "اللغة", "Language")} desc={tr("La page se recharge pour appliquer la langue.", "يتم إعادة تحميل الصفحة لتطبيق اللغة.", "The page reloads to apply the language.")}>
              <Select value={language} onValueChange={v => setLanguage(v as "en" | "fr" | "ar")}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </Row>
            <Row icon={<Moon className="h-4 w-4" />} title={tr("Thème", "المظهر", "Theme")} desc={tr("Clair, sombre ou selon le système.", "فاتح أو داكن أو حسب النظام.", "Light, dark or follow the system.")}>
              <Segmented
                value={theme as "light" | "dark" | "system"}
                onChange={v => setTheme(v)}
                options={[
                  { value: "light", label: tr("Clair", "فاتح", "Light"), icon: <Sun className="h-3.5 w-3.5" /> },
                  { value: "dark", label: tr("Sombre", "داكن", "Dark"), icon: <Moon className="h-3.5 w-3.5" /> },
                  { value: "system", label: tr("Système", "النظام", "System"), icon: <Monitor className="h-3.5 w-3.5" /> },
                ]}
              />
            </Row>
            <div className="py-4 last:pb-0">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Palette className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{tr("Couleur de l'application", "لون التطبيق", "App colour")}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                    {tr(
                      "Couleur principale des boutons, menus et liens. Le rouge (supprimer), le vert (valider/enregistrer) et l'orange (avertissement) gardent toujours leur sens.",
                      "اللون الرئيسي للأزرار والقوائم والروابط. يحتفظ الأحمر (حذف) والأخضر (حفظ/تأكيد) والبرتقالي (تنبيه) دائماً بمعناها.",
                      "Main colour for buttons, menus and links. Red (delete), green (save/confirm) and orange (warning) always keep their meaning."
                    )}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2.5">
                    {(Object.keys(ACCENT_PRESETS) as AccentColor[]).map(key => {
                      const c = ACCENT_PRESETS[key];
                      const selected = prefs.accentColor === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => update({ accentColor: key })}
                          title={language === "ar" ? c.ar : language === "fr" ? c.fr : c.en}
                          aria-pressed={selected}
                          className={`group flex flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-2.5 transition-all ${selected ? "border-foreground/70 bg-muted/60" : "border-transparent hover:bg-muted/50"}`}
                        >
                          <span
                            className="flex h-9 w-9 items-center justify-center rounded-full shadow-sm ring-2 ring-background transition-transform group-hover:scale-110"
                            style={{ background: `hsl(${c.h} ${c.s}% ${c.l}%)` }}
                          >
                            {selected && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
                          </span>
                          <span className={`text-[11px] ${selected ? "font-bold" : "font-medium text-muted-foreground"}`}>
                            {language === "ar" ? c.ar : language === "fr" ? c.fr : c.en}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {/* Aperçu en direct */}
                  <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border bg-muted/30 p-3">
                    <span className="text-[11px] font-semibold text-muted-foreground me-1">{tr("Aperçu :", "معاينة:", "Preview:")}</span>
                    <Button size="sm">{tr("Bouton principal", "زر رئيسي", "Primary button")}</Button>
                    <Button size="sm" variant="outline" className="text-primary border-primary/40">{tr("Lien", "رابط", "Link")}</Button>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{tr("Badge", "شارة", "Badge")}</span>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">{tr("Enregistrer", "حفظ", "Save")}</Button>
                    <Button size="sm" variant="destructive">{tr("Supprimer", "حذف", "Delete")}</Button>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ── Affichage ── */}
          <SectionCard id="display" icon={<Type className="h-5 w-5" />} title={tr("Affichage et accessibilité", "العرض وإمكانية الوصول", "Display & accessibility")} desc={tr("Confort de lecture, notamment en classe sur un vidéoprojecteur.", "راحة القراءة، خاصة في القسم على جهاز العرض.", "Reading comfort, e.g. on a classroom projector.")} resetLabel={tr("Par défaut", "افتراضي", "Defaults")} onReset={() => reset("display")}>
            <Row icon={<Type className="h-4 w-4" />} title={tr("Taille du texte", "حجم النص", "Text size")} desc={tr("Agrandit tout le contenu de l'application.", "يكبر كل محتوى التطبيق.", "Enlarges all app content.")}>
              <Segmented
                value={prefs.fontScale}
                onChange={v => update({ fontScale: v })}
                options={[
                  { value: "normal", label: "A" },
                  { value: "large", label: <span className="text-sm">A</span> },
                  { value: "xlarge", label: <span className="text-base">A</span> },
                ]}
              />
            </Row>
            <Row icon={<Rows3 className="h-4 w-4" />} title={tr("Densité des tableaux", "كثافة الجداول", "Table density")} desc={tr("« Compacte » affiche plus de lignes à l'écran.", "« مضغوطة » تعرض صفوفاً أكثر على الشاشة.", "“Compact” fits more rows on screen.")}>
              <Segmented
                value={prefs.tableDensity}
                onChange={v => update({ tableDensity: v })}
                options={[
                  { value: "comfortable", label: tr("Confortable", "مريحة", "Comfortable") },
                  { value: "compact", label: tr("Compacte", "مضغوطة", "Compact") },
                ]}
              />
            </Row>
            <Row icon={<Sparkles className="h-4 w-4" />} title={tr("Réduire les animations", "تقليل الحركات", "Reduce motion")} desc={tr("Désactive les effets d'apparition et de survol (plus sobre, plus rapide sur les ordinateurs anciens).", "يعطل تأثيرات الظهور والتمرير.", "Turns off entrance and hover effects.")}>
              <Switch checked={prefs.reduceMotion} onCheckedChange={v => update({ reduceMotion: v })} />
            </Row>
          </SectionCard>

          {/* ── Notifications ── */}
          <SectionCard id="notifications" icon={<Bell className="h-5 w-5" />} title={tr("Notifications", "الإشعارات", "Notifications")} desc={isProfessor ? tr("Comment être prévenu des nouvelles copies, demandes et événements.", "كيف يتم إخبارك بالأوراق والطلبات الجديدة.", "How you are alerted about new submissions and requests.") : tr("Comment être prévenu des nouveaux cours, exercices et quiz.", "كيف يتم إخبارك بالدروس والتمارين والاختبارات الجديدة.", "How you are alerted about new courses, exercises and quizzes.")} resetLabel={tr("Par défaut", "افتراضي", "Defaults")} onReset={() => reset("notifications")}>
            <Row icon={<Bell className="h-4 w-4" />} title={tr("Fenêtres d'alerte dans l'application", "نوافذ التنبيه داخل التطبيق", "In-app pop-ups")} desc={tr("Un message apparaît en bas de l'écran à chaque nouvelle notification. Les notifications restent toujours visibles dans la cloche.", "تظهر رسالة أسفل الشاشة عند كل إشعار جديد.", "A message appears for each new notification. They always remain in the bell.")}>
              <Switch checked={prefs.notifyPopup} onCheckedChange={v => update({ notifyPopup: v })} />
            </Row>
            <Row icon={<Volume2 className="h-4 w-4" />} title={tr("Signal sonore", "تنبيه صوتي", "Sound")} desc={tr("Un court son discret à l'arrivée d'une notification.", "صوت قصير عند وصول إشعار.", "A short, discreet sound for new notifications.")}>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={playNotificationSound}>{tr("Tester", "تجربة", "Test")}</Button>
                <Switch checked={prefs.notifySound} onCheckedChange={v => update({ notifySound: v })} />
              </div>
            </Row>
            <Row
              icon={<MonitorSmartphone className="h-4 w-4" />}
              title={tr("Notifications du système", "إشعارات النظام", "System notifications")}
              desc={
                notifPermission === "denied"
                  ? tr("Bloquées par le navigateur : autorisez-les dans les réglages du site (icône 🔒 de la barre d'adresse).", "محظورة من طرف المتصفح: اسمح بها من إعدادات الموقع.", "Blocked by the browser: allow them in the site settings.")
                  : notifPermission === "unsupported"
                  ? tr("Non prises en charge par ce navigateur.", "غير مدعومة في هذا المتصفح.", "Not supported by this browser.")
                  : tr("Prévenu même quand l'onglet est en arrière-plan.", "تنبيه حتى عندما تكون الصفحة في الخلفية.", "Get alerted even when the tab is in the background.")
              }
            >
              {notifPermission === "granted" ? (
                <Switch checked={prefs.notifyBrowser} onCheckedChange={v => update({ notifyBrowser: v })} />
              ) : (
                <Button size="sm" variant="outline" disabled={notifPermission === "denied" || notifPermission === "unsupported"} onClick={requestBrowserPermission}>
                  {tr("Autoriser", "السماح", "Allow")}
                </Button>
              )}
            </Row>
          </SectionCard>

          {/* ── Évaluation (enseignant) ── */}
          {isProfessor && (
            <SectionCard id="evaluation" icon={<GraduationCap className="h-5 w-5" />} title={tr("Évaluation et notation", "التقويم والتنقيط", "Assessment & grading")} desc={tr("Utilisés par le tableau de bord, le suivi pédagogique, le classement et les alertes.", "تُستعمل في لوحة التحكم والتتبع والترتيب والتنبيهات.", "Used by the dashboard, tracking, ranking and alerts.")} resetLabel={tr("Par défaut", "افتراضي", "Defaults")} onReset={() => reset("evaluation")}>
              <Row title={tr("Seuil de réussite", "عتبة النجاح", "Pass mark")} desc={tr("Moyenne à partir de laquelle un élève est considéré en réussite. En dessous : alerte « moyenne insuffisante ».", "المعدل الذي يعتبر ابتداءً منه التلميذ ناجحاً.", "Average from which a student passes; below triggers an alert.")}>
                <div className="flex items-center gap-2">
                  <Input value={levels.p} onChange={e => setLevels(l => ({ ...l, p: e.target.value }))} onBlur={commitLevels} inputMode="decimal" className="h-9 w-20 text-center font-bold" />
                  <span className="text-sm text-muted-foreground">/ 20</span>
                </div>
              </Row>
              <div className="py-4">
                <p className="text-sm font-semibold">{tr("Niveaux des élèves", "مستويات التلاميذ", "Student levels")}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{tr("Seuils (sur 20) utilisés pour la répartition, les badges de niveau et les couleurs des notes.", "العتبات (على 20) المستعملة للتوزيع وشارات المستوى وألوان النقط.", "Thresholds (out of 20) used for distribution, level badges and grade colours.")}</p>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  {([["s", tr("En progression dès", "في تقدم ابتداءً من", "Progressing from")], ["g", tr("Satisfaisant dès", "جيد ابتداءً من", "Good from")], ["e", tr("Excellent dès", "ممتاز ابتداءً من", "Excellent from")]] as const).map(([k, l]) => (
                    <div key={k}>
                      <Label className="text-[11px] text-muted-foreground">{l}</Label>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Input value={levels[k]} onChange={e => setLevels(v => ({ ...v, [k]: e.target.value }))} onBlur={commitLevels} inputMode="decimal" className="h-9 text-center font-bold" />
                        <span className="text-xs text-muted-foreground">/20</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <div className="flex h-3 w-full overflow-hidden rounded-full">
                    {scale.map((b, i) => <div key={i} style={{ width: `${((b.to - b.from) / 20) * 100}%`, background: b.color }} title={b.label} />)}
                  </div>
                  <div className="relative mt-1 h-4 text-[10px] text-muted-foreground" dir="ltr">
                    {[0, prefs.levelStruggling, prefs.levelGood, prefs.levelExcellent, 20].map((v, i) => (
                      <span key={i} className="absolute -translate-x-1/2 tabular-nums" style={{ left: `${(v / 20) * 100}%` }}>{fmt(v)}</span>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
                    {scale.map((b, i) => <span key={i} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: b.color }} />{b.label}</span>)}
                  </div>
                </div>
              </div>
              <div className="py-4">
                <p className="text-sm font-semibold">{tr("Quiz repassé : note retenue", "اختبار مُعاد: النقطة المعتمدة", "Retaken quiz: grade kept")}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{tr("Quand plusieurs tentatives sont autorisées.", "عندما يُسمح بعدة محاولات.", "When multiple attempts are allowed.")}</p>
                <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                  {policies.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => update({ attemptPolicy: p.value })}
                      className={`rounded-2xl border-2 p-3.5 text-start transition-all ${prefs.attemptPolicy === p.value ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40"}`}
                    >
                      <span className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{p.title}</span>
                        <span className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${prefs.attemptPolicy === p.value ? "border-primary bg-primary" : "border-muted-foreground/40"}`}>
                          {prefs.attemptPolicy === p.value && <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={4} />}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">{p.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <Row icon={<Clock className="h-4 w-4" />} title={tr("Alerte d'inactivité", "تنبيه عدم النشاط", "Inactivity alert")} desc={tr("Un élève est signalé « à accompagner » s'il ne s'est pas connecté depuis…", "يُشار إلى التلميذ إذا لم يتصل منذ…", "A student is flagged if not connected for…")}>
                <Select value={String(prefs.inactivityDays)} onValueChange={v => update({ inactivityDays: parseInt(v) })}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[3, 7, 14, 30].map(d => <SelectItem key={d} value={String(d)}>{tr(`${d} jours`, `${d} أيام`, `${d} days`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Row>
            </SectionCard>
          )}

          {/* ── Nouveaux quiz (enseignant) ── */}
          {isProfessor && (
            <SectionCard id="quiz" icon={<FileQuestion className="h-5 w-5" />} title={tr("Valeurs par défaut des nouveaux quiz", "القيم الافتراضية للاختبارات الجديدة", "New quiz defaults")} desc={tr("Appliquées automatiquement à chaque quiz créé. Modifiables ensuite quiz par quiz dans le créateur.", "تُطبق تلقائياً على كل اختبار جديد، ويمكن تعديلها لاحقاً.", "Applied to every new quiz; editable per quiz later.")} resetLabel={tr("Par défaut", "افتراضي", "Defaults")} onReset={() => reset("quiz")}>
              <Row icon={<Clock className="h-4 w-4" />} title={tr("Durées par défaut", "المدد الافتراضية", "Default durations")} desc={tr("Pré-remplies dans le formulaire de création.", "تُملأ مسبقاً في نموذج الإنشاء.", "Pre-filled in the creation form.")}>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {tr("Quiz", "اختبار", "Quiz")}
                    <Input type="number" min={1} value={durations.q} onChange={e => setDurations(d => ({ ...d, q: e.target.value }))} onBlur={commitDurations} className="h-9 w-20 text-center font-bold" />
                    min
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {tr("Examen", "امتحان", "Exam")}
                    <Input type="number" min={1} value={durations.e} onChange={e => setDurations(d => ({ ...d, e: e.target.value }))} onBlur={commitDurations} className="h-9 w-20 text-center font-bold" />
                    min
                  </label>
                </div>
              </Row>
              <div className="pt-4">
                <QuizSettings initialSettings={prefs.quizDefaults} onSettingsChange={s => update({ quizDefaults: s })} />
              </div>
            </SectionCard>
          )}

          {/* ── Sécurité ── */}
          <SectionCard id="security" icon={<ShieldCheck className="h-5 w-5" />} title={tr("Sécurité", "الأمان", "Security")} desc={user?.role === "student" ? tr("Votre mot de passe et sa réinitialisation.", "كلمة المرور وإعادة تعيينها.", "Your password and how to reset it.") : tr("Votre mot de passe et les demandes de réinitialisation des élèves.", "كلمة المرور وطلبات إعادة التعيين للتلاميذ.", "Your password and students' reset requests.")}>
            <Row icon={<Key className="h-4 w-4" />} title={tr("Mot de passe", "كلمة المرور", "Password")} desc={tr("Modifiez votre mot de passe de connexion.", "غيّر كلمة مرور الدخول.", "Change your login password.")}>
              <Button onClick={() => setPasswordDialogOpen(true)}>{tr("Changer le mot de passe", "تغيير كلمة المرور", "Change password")}</Button>
            </Row>
            {user?.role === "student" && (
              <Row icon={<AlertCircle className="h-4 w-4" />} title={tr("Mot de passe oublié ?", "نسيت كلمة المرور؟", "Forgot your password?")} desc={tr("Votre professeur recevra une demande et pourra réinitialiser votre mot de passe.", "سيتوصل أستاذك بطلب ويمكنه إعادة تعيين كلمة المرور.", "Your teacher will get a request and can reset your password.")}>
                <Button variant="outline" onClick={handleRequestPasswordReset} disabled={isRequestingReset}>
                  {isRequestingReset ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
                  {tr("Demander une réinitialisation", "طلب إعادة التعيين", "Request a reset")}
                </Button>
              </Row>
            )}
          </SectionCard>

          {isProfessor && <PasswordResetManager />}
        </div>
      </div>

      <ChangePasswordDialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen} />
    </div>
  );
};

export default Settings;


import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { Globe, Moon, Key, AlertCircle } from "lucide-react";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";
import { PasswordResetManager } from "@/components/PasswordResetManager";
import { supabase } from "@/integrations/supabase/client";

const Settings = () => {
  const [notifications, setNotifications] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [isRequestingReset, setIsRequestingReset] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();

  const handleSaveSettings = () => {
    toast.success(t("app.save") + " — " + t("nav.settings"));
  };

  const handleRequestPasswordReset = async () => {
    if (!user || user.role !== 'student') return;
    setIsRequestingReset(true);
    try {
      const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select('courses!inner(professor_id, room_id)')
        .eq('student_id', user.id)
        .limit(1);

      if (enrollError || !enrollments?.length) {
        toast.error(
          language === "ar" ? "تعذّر العثور على أستاذك. يرجى التواصل مع الدعم."
          : language === "fr" ? "Impossible de trouver votre professeur. Contactez le support."
          : "Unable to find your professor. Please contact support."
        );
        return;
      }

      const professorId = enrollments[0].courses.professor_id;
      const roomId = enrollments[0].courses.room_id;

      const { error: insertError } = await supabase
        .from('password_reset_requests')
        .insert({ student_id: user.id, professor_id: professorId, room_id: roomId, status: 'pending' });

      if (insertError) {
        toast.error(
          language === "ar" ? "فشل في إرسال طلب إعادة التعيين"
          : language === "fr" ? "Échec de la demande de réinitialisation"
          : "Failed to request password reset"
        );
        return;
      }

      toast.success(
        language === "ar" ? "تم إرسال طلب إعادة تعيين كلمة المرور إلى أستاذك"
        : language === "fr" ? "Demande de réinitialisation envoyée à votre professeur"
        : "Password reset request sent to your professor"
      );
    } catch (error) {
      console.error('Error requesting password reset:', error);
      toast.error(
        language === "ar" ? "فشل في إرسال طلب إعادة التعيين"
        : language === "fr" ? "Échec de la demande de réinitialisation"
        : "Failed to request password reset"
      );
    } finally {
      setIsRequestingReset(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold">{t("nav.settings")}</h1>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5" />
            {t("settings.theme.title")}
          </CardTitle>
          <CardDescription>{t("settings.theme.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="theme">{t("settings.theme.title")}</Label>
              <Select value={theme} onValueChange={(v) => setTheme(v as "light" | "dark" | "system")}>
                <SelectTrigger id="theme">
                  <SelectValue placeholder={t("settings.theme.select")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t("settings.theme.light")}</SelectItem>
                  <SelectItem value="dark">{t("settings.theme.dark")}</SelectItem>
                  <SelectItem value="system">{t("settings.theme.system")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t("app.language")}
          </CardTitle>
          <CardDescription>{t("settings.language.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="language">{t("app.language")}</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as "en" | "fr" | "ar")}>
                <SelectTrigger id="language">
                  <SelectValue placeholder={t("app.language")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="ar">العربية</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Password & Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            {t("settings.password.title")}
          </CardTitle>
          <CardDescription>
            {user?.role === 'student'
              ? t("settings.password.student.description")
              : t("settings.password.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={() => setPasswordDialogOpen(true)}>
            {t("settings.password.change")}
          </Button>

          {user?.role === 'student' && (
            <div className="space-y-3">
              <Button
                variant="outline"
                onClick={handleRequestPasswordReset}
                disabled={isRequestingReset}
                className="w-full"
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                {isRequestingReset
                  ? t("settings.password.requesting")
                  : t("settings.password.request.reset")}
              </Button>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>
                    {language === "ar" ? "ملاحظة: " : language === "fr" ? "Note : " : "Note: "}
                  </strong>
                  {t("settings.password.note")}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.notifications.title")}</CardTitle>
          <CardDescription>{t("settings.notifications.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifications">{t("settings.notifications.push")}</Label>
              <p className="text-sm text-muted-foreground">{t("settings.notifications.push.desc")}</p>
            </div>
            <Switch id="notifications" checked={notifications} onCheckedChange={setNotifications} />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-updates">{t("settings.notifications.email")}</Label>
              <p className="text-sm text-muted-foreground">{t("settings.notifications.email.desc")}</p>
            </div>
            <Switch id="email-updates" checked={emailUpdates} onCheckedChange={setEmailUpdates} />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveSettings}>{t("app.save")}</Button>
        </CardFooter>
      </Card>

      {/* Password Reset Manager - Professor only */}
      {user?.role === 'professor' && <PasswordResetManager />}

      <ChangePasswordDialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen} />
    </div>
  );
};

export default Settings;

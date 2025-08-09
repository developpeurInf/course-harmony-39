
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
import { Globe, Moon, Key, Mail, AlertCircle } from "lucide-react";
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
    toast.success(t("app.save") + " " + t("nav.settings"));
  };

  const handleRequestPasswordReset = async () => {
    if (!user || user.role !== 'student') return;

    setIsRequestingReset(true);
    try {
      // Get professor from enrollments
      const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select(`
          courses!inner (
            professor_id,
            room_id
          )
        `)
        .eq('student_id', user.id)
        .limit(1);

      if (enrollError || !enrollments?.length) {
        toast.error("Unable to find your professor. Please contact support.");
        return;
      }

      const professorId = enrollments[0].courses.professor_id;
      const roomId = enrollments[0].courses.room_id;

      // Create password reset request
      const { error: insertError } = await supabase
        .from('password_reset_requests')
        .insert({
          student_id: user.id,
          professor_id: professorId,
          room_id: roomId,
          status: 'pending'
        });

      if (insertError) {
        console.error('Error creating password reset request:', insertError);
        toast.error("Failed to request password reset");
        return;
      }

      toast.success("Password reset request sent to your professor");

    } catch (error) {
      console.error('Error requesting password reset:', error);
      toast.error("Failed to request password reset");
    } finally {
      setIsRequestingReset(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold">{t("nav.settings")}</h1>
      
      {/* Theme Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5" />
            Theme
          </CardTitle>
          <CardDescription>
            Choose your preferred theme appearance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="theme">Theme</Label>
              <Select
                value={theme}
                onValueChange={(value) => setTheme(value as "light" | "dark" | "system")}
              >
                <SelectTrigger id="theme">
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Language Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t("app.language")}
          </CardTitle>
          <CardDescription>
            {language === "en" && "Choose your preferred language"}
            {language === "fr" && "Choisissez votre langue préférée"}
            {language === "ar" && "اختر لغتك المفضلة"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="language">{t("app.language")}</Label>
              <Select
                value={language}
                onValueChange={(value) => setLanguage(value as "en" | "fr" | "ar")}
              >
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
      
      {/* Password Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Password & Security
          </CardTitle>
          <CardDescription>
            {user?.role === 'student' 
              ? "Change your temporary password or request a password reset from your professor"
              : "Manage your account password"
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={() => setPasswordDialogOpen(true)}>
            Change Password
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
                {isRequestingReset ? "Requesting..." : "Request Password Reset from Professor"}
              </Button>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> Click the button above to send a reset request to your professor. They will provide you with a new temporary password.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t("nav.settings")}</CardTitle>
          <CardDescription>
            {language === "en" && "Manage your notification preferences"}
            {language === "fr" && "Gérer vos préférences de notification"}
            {language === "ar" && "إدارة تفضيلات الإشعارات الخاصة بك"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifications">
                {language === "en" && "Push Notifications"}
                {language === "fr" && "Notifications Push"}
                {language === "ar" && "إشعارات الدفع"}
              </Label>
              <p className="text-sm text-muted-foreground">
                {language === "en" && "Receive notifications about updates and activity."}
                {language === "fr" && "Recevez des notifications concernant les mises à jour et l'activité."}
                {language === "ar" && "تلقي إشعارات حول التحديثات والنشاط."}
              </p>
            </div>
            <Switch
              id="notifications"
              checked={notifications}
              onCheckedChange={setNotifications}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-updates">
                {language === "en" && "Email Updates"}
                {language === "fr" && "Mises à jour par email"}
                {language === "ar" && "تحديثات البريد الإلكتروني"}
              </Label>
              <p className="text-sm text-muted-foreground">
                {language === "en" && "Receive email notifications about your account."}
                {language === "fr" && "Recevez des notifications par email concernant votre compte."}
                {language === "ar" && "تلقي إشعارات البريد الإلكتروني حول حسابك."}
              </p>
            </div>
            <Switch
              id="email-updates"
              checked={emailUpdates}
              onCheckedChange={setEmailUpdates}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveSettings}>{t("app.save")}</Button>
        </CardFooter>
      </Card>
      
      {/* Password Reset Manager for Professors */}
      {user?.role === 'professor' && (
        <PasswordResetManager />
      )}

      <ChangePasswordDialog 
        open={passwordDialogOpen} 
        onOpenChange={setPasswordDialogOpen}
      />
    </div>
  );
};

export default Settings;

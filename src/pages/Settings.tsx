
import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { Globe } from "lucide-react";

const Settings = () => {
  const [notifications, setNotifications] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  const handleSaveSettings = () => {
    toast.success(t("app.save") + " " + t("nav.settings"));
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold">{t("nav.settings")}</h1>
      
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
    </div>
  );
};

export default Settings;

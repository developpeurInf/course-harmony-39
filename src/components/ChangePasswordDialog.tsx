import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  disabled?: boolean;
  showLabel: string;
  hideLabel: string;
}

const PasswordField = ({ id, label, value, onChange, autoComplete, disabled, showLabel, hideLabel }: PasswordFieldProps) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="pr-11 rtl:pr-3 rtl:pl-11"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-1 rtl:right-auto rtl:left-1 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
};

const ChangePasswordDialog = ({ open, onOpenChange }: ChangePasswordDialogProps) => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const showLabel = tr("Afficher le mot de passe", "إظهار كلمة المرور", "Show password");
  const hideLabel = tr("Masquer le mot de passe", "إخفاء كلمة المرور", "Hide password");

  const handleChangePassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (loading) return;

    if (!currentPassword) {
      toast.error(tr("Saisissez votre mot de passe actuel.", "أدخل كلمة المرور الحالية.", "Enter your current password."));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t("password.mismatch"));
      return;
    }

    if (newPassword.length < 6) {
      toast.error(t("password.length"));
      return;
    }

    setLoading(true);

    try {
      // Vérifie le mot de passe actuel avant toute modification
      if (!user?.email) {
        toast.error(t("password.failed"));
        return;
      }
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (verifyError) {
        toast.error(t("password.incorrect"));
        return;
      }

      // Update password in Supabase Auth
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        toast.error(t("password.failed") + ": " + error.message);
        return;
      }

      // Clear temporary password for students
      if (user?.role === 'student') {
        await supabase
          .from('profiles')
          .update({ temporary_password: null })
          .eq('id', user?.id);
      }

      toast.success(t("password.updated"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error(
        error?.message || t("password.failed")
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (loading) return; // pas de fermeture pendant l'enregistrement
      if (!next) {
        resetForm();
      }
      onOpenChange(next);
    }}>
      <DialogContent className="sm:max-w-[425px]" hideClose={loading}>
        <DialogHeader>
          <DialogTitle>{t("password.change")}</DialogTitle>
          <DialogDescription>
            {user?.role === 'student'
              ? t("password.temp.desc")
              : t("password.current.desc")
            }
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleChangePassword} className="grid gap-4">
          <div className="grid gap-4 py-2">
            <PasswordField
              id="current-password"
              label={tr("Mot de passe actuel", "كلمة المرور الحالية", "Current password")}
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
              disabled={loading}
              showLabel={showLabel}
              hideLabel={hideLabel}
            />
            <PasswordField
              id="new-password"
              label={t("password.new")}
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
              disabled={loading}
              showLabel={showLabel}
              hideLabel={hideLabel}
            />
            <PasswordField
              id="confirm-password"
              label={t("password.confirm")}
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              disabled={loading}
              showLabel={showLabel}
              hideLabel={hideLabel}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              {t("app.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t("password.updating") : t("password.update")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePasswordDialog;

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAccess } from "@/contexts/AccessContext";
import { supabase } from "@/integrations/supabase/client";

export const FirstLoginDialog = () => {
  const { user, isFirstLogin, setIsFirstLogin, changeStudentPassword } = useAuth();
  const { language } = useLanguage();
  const { access, refresh } = useAccess();
  // Professeur créé par l'administration : changement du mot de passe obligatoire
  const teacherMustChange = user?.role === "professor" && !!access?.must_change_password;
  // L'élève peut reporter : le choix est mémorisé pour ce compte (pas de réouverture à chaque connexion).
  // Le changement imposé par l'administration (professeur) reste obligatoire.
  const dismissKey = user?.id ? `first-login-dismissed-${user.id}` : "";
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (!dismissKey) { setDismissed(false); return; }
    try { setDismissed(localStorage.getItem(dismissKey) === "1"); } catch { setDismissed(false); }
  }, [dismissKey]);
  const open = teacherMustChange || (isFirstLogin && !dismissed);

  const [mode, setMode] = useState<"choice" | "change">("choice");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const t = (fr: string, ar: string, en: string) =>
    language === "fr" ? fr : language === "ar" ? ar : en;

  const rememberDismiss = () => {
    if (dismissKey) {
      try { localStorage.setItem(dismissKey, "1"); } catch { /* stockage indisponible */ }
    }
    setDismissed(true);
  };

  const handleKeep = async () => {
    // Student keeps the temporary password — just clear isFirstLogin locally
    // but keep temporary_password in DB so professor still sees it
    rememberDismiss();
    setIsFirstLogin(false);
  };

  const handleLater = () => {
    rememberDismiss();
    setIsFirstLogin(false);
  };

  const handleChange = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (newPassword.length < 6) {
      toast.error(t(
        "Le mot de passe doit contenir au moins 6 caractères.",
        "يجب أن تحتوي كلمة المرور على 6 أحرف على الأقل.",
        "Password must be at least 6 characters."
      ));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t(
        "Les mots de passe ne correspondent pas.",
        "كلمتا المرور غير متطابقتين.",
        "Passwords do not match."
      ));
      return;
    }
    setLoading(true);
    const success = await changeStudentPassword(newPassword);
    if (success && teacherMustChange) {
      await (supabase as any).rpc("clear_must_change_password");
      await refresh();
    }
    setLoading(false);
    if (success) {
      setMode("choice");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        hideClose
        className="sm:max-w-md"
        // Prevent closing by clicking outside or pressing Escape
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center justify-center mb-3">
            <div className="bg-primary/10 p-3 rounded-full">
              <KeyRound className="h-8 w-8 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            {t("Première connexion", "أول تسجيل دخول", "First Login")}
          </DialogTitle>
          <DialogDescription className="text-center">
            {teacherMustChange && mode === "choice"
              ? t(
                  "Votre compte a été créé par l'administration avec un mot de passe provisoire. Choisissez votre propre mot de passe pour continuer.",
                  "تم إنشاء حسابك من طرف الإدارة بكلمة مرور مؤقتة. اختر كلمة مرورك الخاصة للمتابعة.",
                  "Your account was created by the administration with a temporary password. Choose your own password to continue."
                )
              : mode === "choice"
              ? t(
                  "Vous utilisez un mot de passe temporaire. Souhaitez-vous le conserver ou en définir un nouveau ?",
                  "أنت تستخدم كلمة مرور مؤقتة. هل تريد الاحتفاظ بها أو تغييرها؟",
                  "You are using a temporary password. Would you like to keep it or set a new one?"
                )
              : t(
                  "Entrez votre nouveau mot de passe.",
                  "أدخل كلمة المرور الجديدة.",
                  "Enter your new password."
                )}
          </DialogDescription>
        </DialogHeader>

        {mode === "choice" ? (
          <div className="flex flex-col gap-3 mt-2">
            <Button
              onClick={() => setMode("change")}
              className="w-full h-12 gap-2"
            >
              <ShieldCheck className="h-5 w-5" />
              {t("Modifier le mot de passe", "تغيير كلمة المرور", "Change Password")}
            </Button>
            {!teacherMustChange && (
              <Button
                variant="outline"
                onClick={handleKeep}
                className="w-full h-12"
              >
                {t("Conserver le mot de passe temporaire", "الاحتفاظ بكلمة المرور المؤقتة", "Keep Temporary Password")}
              </Button>
            )}
            {!teacherMustChange && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleLater}
                className="w-full h-11 text-muted-foreground"
              >
                {t("Plus tard", "لاحقاً", "Later")}
              </Button>
            )}
          </div>
        ) : (
          <form onSubmit={handleChange} className="space-y-4 mt-2">
            <div>
              <Label htmlFor="first-login-new-password">
                {t("Nouveau mot de passe", "كلمة المرور الجديدة", "New Password")}
              </Label>
              <div className="relative mt-1">
                <Input
                  id="first-login-new-password"
                  name="new-password"
                  type={showNew ? "text" : "password"}
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t("Min. 6 caractères", "6 أحرف على الأقل", "Min. 6 characters")}
                  className="pr-10 rtl:pr-3 rtl:pl-10"
                />
                <button
                  type="button"
                  className="absolute right-1 rtl:right-auto rtl:left-1 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNew((v) => !v)}
                  aria-label={showNew ? t("Masquer le mot de passe", "إخفاء كلمة المرور", "Hide password") : t("Afficher le mot de passe", "إظهار كلمة المرور", "Show password")}
                  aria-pressed={showNew}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="first-login-confirm-password">
                {t("Confirmer le mot de passe", "تأكيد كلمة المرور", "Confirm Password")}
              </Label>
              <div className="relative mt-1">
                <Input
                  id="first-login-confirm-password"
                  name="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("Répétez le mot de passe", "أعد كتابة كلمة المرور", "Repeat password")}
                  className="pr-10 rtl:pr-3 rtl:pl-10"
                />
                <button
                  type="button"
                  className="absolute right-1 rtl:right-auto rtl:left-1 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? t("Masquer le mot de passe", "إخفاء كلمة المرور", "Hide password") : t("Afficher le mot de passe", "إظهار كلمة المرور", "Show password")}
                  aria-pressed={showConfirm}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setMode("choice"); setNewPassword(""); setConfirmPassword(""); }}
                disabled={loading}
                className="flex-1"
              >
                {t("Retour", "رجوع", "Back")}
              </Button>
              <Button
                type="submit"
                disabled={loading || !newPassword || !confirmPassword}
                className="flex-1"
              >
                {loading
                  ? t("Enregistrement...", "جاري الحفظ...", "Saving...")
                  : t("Enregistrer", "حفظ", "Save")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

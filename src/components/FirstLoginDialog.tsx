import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const FirstLoginDialog = () => {
  const { isFirstLogin, setIsFirstLogin, changeStudentPassword } = useAuth();
  const { language } = useLanguage();

  const [mode, setMode] = useState<"choice" | "change">("choice");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const t = (fr: string, ar: string, en: string) =>
    language === "fr" ? fr : language === "ar" ? ar : en;

  const handleKeep = async () => {
    // Student keeps the temporary password — just clear isFirstLogin locally
    // but keep temporary_password in DB so professor still sees it
    setIsFirstLogin(false);
  };

  const handleChange = async () => {
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
    setLoading(false);
    if (success) {
      setMode("choice");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <Dialog open={isFirstLogin} onOpenChange={() => {}}>
      <DialogContent
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
            {mode === "choice"
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
            <Button
              variant="outline"
              onClick={handleKeep}
              className="w-full h-12"
            >
              {t("Conserver le mot de passe temporaire", "الاحتفاظ بكلمة المرور المؤقتة", "Keep Temporary Password")}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            <div>
              <Label>
                {t("Nouveau mot de passe", "كلمة المرور الجديدة", "New Password")}
              </Label>
              <div className="relative mt-1">
                <Input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t("Min. 6 caractères", "6 أحرف على الأقل", "Min. 6 characters")}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowNew((v) => !v)}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>
                {t("Confirmer le mot de passe", "تأكيد كلمة المرور", "Confirm Password")}
              </Label>
              <div className="relative mt-1">
                <Input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("Répétez le mot de passe", "أعد كتابة كلمة المرور", "Repeat password")}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowConfirm((v) => !v)}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => { setMode("choice"); setNewPassword(""); setConfirmPassword(""); }}
                disabled={loading}
                className="flex-1"
              >
                {t("Retour", "رجوع", "Back")}
              </Button>
              <Button
                onClick={handleChange}
                disabled={loading || !newPassword || !confirmPassword}
                className="flex-1"
              >
                {loading
                  ? t("Enregistrement...", "جاري الحفظ...", "Saving...")
                  : t("Enregistrer", "حفظ", "Save")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

import { accessStore } from "@/contexts/AccessContext";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

interface Student {
  id: string;
  name: string;
  email: string;
  username?: string;
  role: string;
  avatar_url?: string;
  created_at: string;
}

interface EditStudentDialogProps {
  student: Student | null;
  isOpen: boolean;
  onClose: () => void;
  onStudentUpdated: () => void;
}

export const EditStudentDialog = ({ student, isOpen, onClose, onStudentUpdated }: EditStudentDialogProps) => {
  const { t, language } = useLanguage();
  const { resetStudentPassword } = useAuth();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (student) {
      setName(student.name);
      setUsername(student.username || "");
      setEmail(student.email);
      setNewPassword("");
    }
  }, [student]);

  const handleUpdate = async () => {
    if (!accessStore.guard("student.edit")) return;
    if (!student || !name.trim()) {
      toast.error(t("student.required"));
      return;
    }

    const pwd = newPassword.trim();
    if (pwd && !accessStore.guard("student.reset_password")) return;
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      // Le mot de passe n'est plus écrit directement dans profiles : il passe par
      // resetStudentPassword (met à jour le mot de passe de CONNEXION Supabase Auth).
      // 1) Mot de passe d'abord (avec l'identifiant actuel, celui du compte de connexion)
      if (pwd) {
        // Affiche lui-même son message de succès / d'erreur
        const ok = await resetStudentPassword(student.id, pwd);
        if (!ok) return;
      }

      // 2) Profil
      const updatePayload: Record<string, any> = {
        name: name.trim(),
        username: username.trim() || null,
        email: email.trim() || null,
      };

      const { data, error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', student.id)
        .select('id');

      if (error) {
        toast.error(t("student.update.failed"));
        console.error('Error updating student:', error.message);
        return;
      }

      if (!data || data.length === 0) {
        toast.error(t("student.update.failed"));
        return;
      }

      toast.success(t("student.updated"));
      onStudentUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating student');
      toast.error(t("student.update.failed"));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o && !isUpdating) onClose(); }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("student.edit")}</DialogTitle>
          <DialogDescription>
            {t("student.edit.desc")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">{t("student.name")} *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("student.placeholder.name")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="username">{t("student.username")}</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("student.placeholder.username")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">{t("student.email")}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("student.placeholder.email")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-new-password">
              {language === "ar" ? "تغيير كلمة المرور (اختياري)" : language === "fr" ? "Changer le mot de passe (optionnel)" : "Change Password (optional)"}
            </Label>
            <Input
              id="edit-new-password"
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={language === "ar" ? "أدخل كلمة مرور جديدة لتعيينها" : language === "fr" ? "Nouveau mot de passe temporaire" : "New temporary password"}
              autoComplete="off"
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground">
              {language === "ar" ? "يصبح هذا هو كلمة مرور الدخول للتلميذ." : language === "fr" ? "Ce sera le nouveau mot de passe de connexion de l'élève." : "This becomes the student's login password."}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isUpdating}>
            {t("app.cancel")}
          </Button>
          <Button onClick={handleUpdate} disabled={isUpdating}>
            {isUpdating ? t("student.updating") : t("student.update")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
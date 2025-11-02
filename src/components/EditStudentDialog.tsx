import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (student) {
      setName(student.name);
      setUsername(student.username || "");
      setEmail(student.email);
    }
  }, [student]);

  const handleUpdate = async () => {
    if (!student || !name.trim()) {
      toast.error(t("student.required"));
      return;
    }

    setIsUpdating(true);
    try {
      console.log('Updating student:', student.id, { name: name.trim(), username: username.trim() || null, email: email.trim() || null });
      
      const { data, error } = await supabase
        .from('profiles')
        .update({
          name: name.trim(),
          username: username.trim() || null,
          email: email.trim() || null,
        })
        .eq('id', student.id)
        .select();

      console.log('Update result:', { data, error });

      if (error) {
        toast.error(t("student.update.failed") + ": " + error.message);
        console.error('Error updating student:', error);
        return;
      }

      if (!data || data.length === 0) {
        toast.error(t("student.update.failed"));
        console.error('No data returned from update');
        return;
      }

      toast.success(t("student.updated"));
      onStudentUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating student:', error);
      toast.error(t("student.update.failed"));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
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
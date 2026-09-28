import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Clock, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PasswordResetRequest {
  id: string;
  student_id: string;
  professor_id: string;
  room_id: string;
  status: string;
  requested_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  student_name: string;
  student_username?: string;
}

interface PasswordResetManagerProps {
  roomId?: string;
}

export const PasswordResetManager = ({ roomId }: PasswordResetManagerProps) => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { createNotification } = useNotifications();
  const [requests, setRequests] = useState<PasswordResetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<PasswordResetRequest | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (user?.role === 'professor') {
      loadPasswordResetRequests();
    }
  }, [user, roomId]);

  const loadPasswordResetRequests = async () => {
    setLoading(true);
    try {
      const { data: reqs, error: requestsError } = await supabase
        .from('password_reset_requests')
        .select('*')
        .eq(roomId ? 'room_id' : 'professor_id', roomId || user?.id)
        .eq('status', 'pending')
        .order('requested_at', { ascending: false });

      if (requestsError) {
        console.error('Error loading password reset requests:', requestsError);
        toast.error(t("pwdReset.error"));
        return;
      }

      if (!reqs || reqs.length === 0) {
        setRequests([]);
        return;
      }

      const studentIds = reqs.map(r => r.student_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, username')
        .in('id', studentIds);

      if (profilesError) {
        console.error('Error loading profiles:', profilesError);
        return;
      }

      const formatted = reqs.map(req => {
        const profile = profiles?.find(p => p.id === req.student_id);
        return {
          ...req,
          student_name: profile?.name || (language === "ar" ? "تلميذ غير معروف" : language === "fr" ? "Élève inconnu" : "Unknown Student"),
          student_username: profile?.username
        };
      });

      setRequests(formatted);
    } catch (error) {
      console.error('Error loading password reset requests:', error);
      toast.error(t("pwdReset.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedRequest || !newPassword.trim()) return;
    setIsResetting(true);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ temporary_password: newPassword.trim() })
        .eq('id', selectedRequest.student_id);

      if (updateError) {
        toast.error(t("pwdReset.error"));
        return;
      }

      const { error: requestError } = await supabase
        .from('password_reset_requests')
        .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: user?.id })
        .eq('id', selectedRequest.id);

      if (requestError) {
        toast.error(t("pwdReset.error"));
        return;
      }

      await createNotification({
        title: language === "ar" ? "تم إعادة تعيين كلمة المرور"
          : language === "fr" ? "Réinitialisation du mot de passe effectuée"
          : "Password Reset Complete",
        message: language === "ar"
          ? `تم إعادة تعيين كلمة مرورك من قِبل أستاذك. كلمة المرور المؤقتة الجديدة: ${newPassword.trim()}`
          : language === "fr"
          ? `Votre mot de passe a été réinitialisé par votre professeur. Nouveau mot de passe temporaire : ${newPassword.trim()}`
          : `Your password has been reset by your professor. Your new temporary password is: ${newPassword.trim()}`,
        type: 'info',
        read: false
      });

      toast.success(t("pwdReset.success"));
      setSelectedRequest(null);
      setNewPassword("");
      loadPasswordResetRequests();
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error(t("pwdReset.error"));
    } finally {
      setIsResetting(false);
    }
  };

  const generateTempPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(result);
  };

  if (user?.role !== 'professor') return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            {t("pwdReset.title")}
            {requests.length > 0 && (
              <Badge variant="destructive" className="ml-2">{requests.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>{t("pwdReset.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-4">{t("pwdReset.loading")}</p>
          ) : requests.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">{t("pwdReset.none")}</p>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <Card key={request.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{request.student_name}</p>
                        {request.student_username && (
                          <p className="text-sm text-muted-foreground">@{request.student_username}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right text-sm text-muted-foreground">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {new Date(request.requested_at).toLocaleDateString(
                          language === "ar" ? "ar-MA" : language === "fr" ? "fr-FR" : "en-US"
                        )}
                      </div>
                      <Button size="sm" onClick={() => setSelectedRequest(request)} variant="outline">
                        {t("pwdReset.resetBtn")}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("pwdReset.dialog.title")}</DialogTitle>
            <DialogDescription>
              {t("pwdReset.dialog.desc")} {selectedRequest?.student_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-password">{t("pwdReset.newPassword")}</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t("pwdReset.placeholder")}
                />
                <Button type="button" variant="outline" onClick={generateTempPassword} size="sm">
                  {t("pwdReset.generate")}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRequest(null)} disabled={isResetting}>
              {t("app.cancel")}
            </Button>
            <Button onClick={handleResetPassword} disabled={!newPassword.trim() || isResetting}>
              {isResetting ? t("pwdReset.resetting") : t("pwdReset.resetBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

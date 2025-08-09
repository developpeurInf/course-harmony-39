import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Check, Clock, User } from "lucide-react";
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
      // First get password reset requests
      const { data: requests, error: requestsError } = await supabase
        .from('password_reset_requests')
        .select('*')
        .eq(roomId ? 'room_id' : 'professor_id', roomId || user?.id)
        .eq('status', 'pending')
        .order('requested_at', { ascending: false });

      if (requestsError) {
        console.error('Error loading password reset requests:', requestsError);
        toast.error("Failed to load password reset requests");
        return;
      }

      if (!requests || requests.length === 0) {
        setRequests([]);
        return;
      }

      // Get student profiles separately
      const studentIds = requests.map(r => r.student_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, username')
        .in('id', studentIds);

      if (profilesError) {
        console.error('Error loading profiles:', profilesError);
        toast.error("Failed to load student profiles");
        return;
      }

      const formattedRequests = requests.map(request => {
        const profile = profiles?.find(p => p.id === request.student_id);
        return {
          ...request,
          student_name: profile?.name || 'Unknown Student',
          student_username: profile?.username
        };
      });

      setRequests(formattedRequests);
    } catch (error) {
      console.error('Error loading password reset requests:', error);
      toast.error("Failed to load password reset requests");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedRequest || !newPassword.trim()) return;

    setIsResetting(true);
    try {
      // Update the student's temporary password
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ temporary_password: newPassword.trim() })
        .eq('id', selectedRequest.student_id);

      if (updateError) {
        console.error('Error updating student password:', updateError);
        toast.error("Failed to reset student password");
        return;
      }

      // Update the password reset request status
      const { error: requestError } = await supabase
        .from('password_reset_requests')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id
        })
        .eq('id', selectedRequest.id);

      if (requestError) {
        console.error('Error updating request status:', requestError);
        toast.error("Failed to update request status");
        return;
      }

      // Send notification to student  
      await createNotification({
        title: "Password Reset Complete",
        message: `Your password has been reset by your professor. Your new temporary password is: ${newPassword.trim()}`,
        type: 'info',
        read: false
      });

      toast.success("Student password reset successfully");
      setSelectedRequest(null);
      setNewPassword("");
      loadPasswordResetRequests();

    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error("Failed to reset student password");
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

  if (user?.role !== 'professor') {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Password Reset Requests
            {requests.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {requests.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Manage student password reset requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-4">Loading requests...</p>
          ) : requests.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No pending password reset requests</p>
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
                        {new Date(request.requested_at).toLocaleDateString()}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setSelectedRequest(request)}
                        variant="outline"
                      >
                        Reset Password
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
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Reset password for {selectedRequest?.student_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-password">New Temporary Password</Label>
              <div className="flex gap-2">
                <Input
                  id="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new temporary password"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={generateTempPassword}
                  size="sm"
                >
                  Generate
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedRequest(null)}
              disabled={isResetting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={!newPassword.trim() || isResetting}
            >
              {isResetting ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
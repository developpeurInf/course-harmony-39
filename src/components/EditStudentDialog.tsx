import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
      toast.error("Name is required");
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: name.trim(),
          username: username.trim() || null,
          email: email.trim() || null,
        })
        .eq('id', student.id);

      if (error) {
        toast.error("Failed to update student");
        console.error('Error updating student:', error);
        return;
      }

      toast.success("Student updated successfully");
      onStudentUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating student:', error);
      toast.error("Failed to update student");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Student</DialogTitle>
          <DialogDescription>
            Update the student's information below.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter full name"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={isUpdating}>
            {isUpdating ? "Updating..." : "Update Student"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Copy, User, Mail, Key, AtSign, Calendar, Shield, Check } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface Student {
  id: string;
  name: string;
  email: string;
  username?: string;
  role: string;
  avatar_url?: string;
  created_at: string;
  temporary_password?: string;
}

interface StudentInfoDialogProps {
  student: Student | null;
  isOpen: boolean;
  onClose: () => void;
}

export const StudentInfoDialog: React.FC<StudentInfoDialogProps> = ({ 
  student, 
  isOpen, 
  onClose 
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showAvatarDialog, setShowAvatarDialog] = useState(false);

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        setCopiedField(fieldName);
        toast.success(`${fieldName} copied to clipboard`);
        
        // Reset the copied state after 2 seconds
        setTimeout(() => setCopiedField(null), 2000);
      } else {
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          document.execCommand('copy');
          setCopiedField(fieldName);
          toast.success(`${fieldName} copied to clipboard`);
          setTimeout(() => setCopiedField(null), 2000);
        } catch (err) {
          toast.error("Failed to copy to clipboard");
        } finally {
          document.body.removeChild(textArea);
        }
      }
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error("Failed to copy to clipboard");
    }
  };

  if (!student) return null;

  const infoFields = [
    {
      label: "First Name",
      value: student.name.split(' ')[0] || '',
      icon: User,
      key: "firstName"
    },
    {
      label: "Last Name", 
      value: student.name.split(' ').slice(1).join(' ') || '',
      icon: User,
      key: "lastName"
    },
    {
      label: "Username",
      value: student.username || 'Not set',
      icon: AtSign,
      key: "username"
    },
    {
      label: "Email",
      value: student.email || 'Not set',
      icon: Mail,
      key: "email"
    },
    {
      label: "Temporary Password",
      value: student.temporary_password || 'Not available',
      icon: Key,
      key: "password"
    },
    {
      label: "Role",
      value: student.role,
      icon: Shield,
      key: "role"
    },
    {
      label: "Joined Date",
      value: new Date(student.created_at).toLocaleDateString(),
      icon: Calendar,
      key: "joinedDate"
    }
  ];

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar 
                className="h-12 w-12 cursor-pointer hover:opacity-80 transition-opacity" 
                onClick={() => student.avatar_url && setShowAvatarDialog(true)}
              >
                <AvatarImage src={student.avatar_url || undefined} />
                <AvatarFallback>
                  {student.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
            <div>
              <div className="text-xl">{student.name}</div>
              <div className="text-sm text-muted-foreground font-normal">
                Student Information
              </div>
            </div>
          </DialogTitle>
          <DialogDescription>
            View and copy student details including login credentials and personal information.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {infoFields.map((field) => {
            const IconComponent = field.icon;
            const isCopied = copiedField === field.key;
            
            return (
              <div key={field.key} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-muted">
                    <IconComponent className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      {field.label}
                    </div>
                    <div className="text-base">
                      {field.key === 'role' ? (
                        <Badge variant="outline" className="text-xs">
                          {field.value}
                        </Badge>
                      ) : field.key === 'password' && field.value !== 'Not available' ? (
                        <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                          {field.value}
                        </code>
                      ) : (
                        field.value
                      )}
                    </div>
                  </div>
                </div>
                
                {field.value !== 'Not set' && field.value !== 'Not available' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(field.value, field.label)}
                    className="ml-2"
                  >
                    {isCopied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end mt-6">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <AlertDialog open={showAvatarDialog} onOpenChange={setShowAvatarDialog}>
      <AlertDialogContent className="max-w-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{student.name}'s Profile Picture</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="flex items-center justify-center p-4">
          <img 
            src={student.avatar_url || undefined} 
            alt={`${student.name}'s avatar`}
            className="max-w-full max-h-[70vh] object-contain rounded-lg"
          />
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setShowAvatarDialog(false)}>
            Close
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
};
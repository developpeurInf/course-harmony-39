import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      toast.success(`${fieldName} copied to clipboard`);
      
      // Reset the copied state after 2 seconds
      setTimeout(() => setCopiedField(null), 2000);
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
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
  );
};
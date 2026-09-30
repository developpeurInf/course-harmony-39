import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Copy, User, Mail, Key, AtSign, Calendar, Shield, Check } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import ProfileAvatarDialog from "@/components/ProfileAvatarDialog";

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
  const { t, language } = useLanguage();

  const notSet = language === "ar" ? "غير محدد" : language === "fr" ? "Non défini" : "Not set";
  const notAvailable = language === "ar" ? "غير متاح" : language === "fr" ? "Non disponible" : "Not available";

  // Get avatar URL - use public URL from Supabase storage
  const getAvatarUrl = () => {
    if (!student?.avatar_url) return undefined;
    if (student.avatar_url.startsWith('http')) {
      return student.avatar_url;
    }
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(student.avatar_url);
    return data.publicUrl;
  };

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        setCopiedField(fieldName);
        toast.success(
          language === "ar" ? `تم نسخ ${fieldName} إلى الحافظة`
          : language === "fr" ? `${fieldName} copié dans le presse-papier`
          : `${fieldName} copied to clipboard`
        );
        setTimeout(() => setCopiedField(null), 2000);
      } else {
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
          toast.success(
            language === "ar" ? `تم نسخ ${fieldName} إلى الحافظة`
            : language === "fr" ? `${fieldName} copié dans le presse-papier`
            : `${fieldName} copied to clipboard`
          );
          setTimeout(() => setCopiedField(null), 2000);
        } catch (err) {
          toast.error(t("Failed to copy to clipboard"));
        } finally {
          document.body.removeChild(textArea);
        }
      }
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error(t("Failed to copy to clipboard"));
    }
  };

  if (!student) return null;

  const infoFields = [
    {
      label: language === "ar" ? "الاسم الأول" : language === "fr" ? "Prénom" : "First Name",
      value: student.name.split(' ')[0] || '',
      icon: User,
      key: "firstName"
    },
    {
      label: language === "ar" ? "الاسم العائلي" : language === "fr" ? "Nom de famille" : "Last Name",
      value: student.name.split(' ').slice(1).join(' ') || '',
      icon: User,
      key: "lastName"
    },
    {
      label: language === "ar" ? "رمز مسار" : "Code Massar",
      value: student.username || notSet,
      icon: AtSign,
      key: "username"
    },
    {
      label: language === "ar" ? "البريد الإلكتروني" : language === "fr" ? "Email" : "Email",
      value: student.email || notSet,
      icon: Mail,
      key: "email"
    },
    {
      label: language === "ar" ? "كلمة المرور المؤقتة" : language === "fr" ? "Mot de passe temporaire" : "Temporary Password",
      value: student.temporary_password || notAvailable,
      icon: Key,
      key: "password"
    },
    {
      label: language === "ar" ? "الدور" : language === "fr" ? "Rôle" : "Role",
      value: student.role,
      icon: Shield,
      key: "role"
    },
    {
      label: language === "ar" ? "تاريخ الانضمام" : language === "fr" ? "Date d'inscription" : "Joined Date",
      value: new Date(student.created_at).toLocaleDateString(
        language === "ar" ? "ar-MA" : language === "fr" ? "fr-FR" : "en-US"
      ),
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
              <AvatarImage src={getAvatarUrl()} />
              <AvatarFallback>
                {student.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="text-xl">{student.name}</div>
              <div className="text-sm text-muted-foreground font-normal">
                {language === "ar" ? "معلومات التلميذ" : language === "fr" ? "Informations de l'élève" : "Student Information"}
              </div>
            </div>
          </DialogTitle>
          <DialogDescription>
            {language === "ar"
              ? "عرض ونسخ بيانات التلميذ بما فيها بيانات تسجيل الدخول."
              : language === "fr"
              ? "Voir et copier les informations de l'élève, y compris les identifiants."
              : "View and copy student details including login credentials and personal information."}
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
                      ) : field.key === 'password' && field.value !== notAvailable ? (
                        <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                          {field.value}
                        </code>
                      ) : (
                        field.value
                      )}
                    </div>
                  </div>
                </div>
                
                {field.value !== notSet && field.value !== notAvailable && (
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
            {language === "ar" ? "إغلاق" : language === "fr" ? "Fermer" : "Close"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Instagram-style Student Avatar Dialog */}
    <ProfileAvatarDialog
      isOpen={showAvatarDialog}
      onOpenChange={setShowAvatarDialog}
      userOverride={{
        id: student.id,
        name: student.name,
        email: student.email,
        role: student.role,
        avatar_url: getAvatarUrl()
      }}
      editable={false}
    />
  </>
  );
};
import { useState } from "react";
import { useAuth, UserRole } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Camera, 
  Shield, 
  KeyRound, 
  Maximize2, 
  Trash2, 
  Upload, 
  Loader2,
  Sparkles,
  CheckCircle2
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import ProfileAvatarDialog from "@/components/ProfileAvatarDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Profile = () => {
  const { user, updateProfile, uploadAvatar, deleteAvatar, resetPassword } = useAuth();
  const { t, language } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Form state
  const [name, setName] = useState(user?.name || "");
  const [role, setRole] = useState<UserRole>(user?.role || "student");

  const handleSave = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const success = await updateProfile({
        name,
        role
      });
      
      if (success) {
        setIsEditing(false);
        toast.success(
          language === "ar" 
            ? "تم حفظ التغييرات بنجاح" 
            : language === "fr" 
            ? "Profil mis à jour avec succès" 
            : "Profile updated successfully"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setName(user?.name || "");
    setRole(user?.role || "student");
    setIsEditing(false);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(
        language === "ar"
          ? "يرجى تحديد ملف صورة صالح"
          : language === "fr"
          ? "Veuillez sélectionner un fichier image valide"
          : "Please select an image file"
      );
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(
        language === "ar"
          ? "حجم الصورة يجب ألا يتجاوز 5 ميغابايت"
          : language === "fr"
          ? "La taille de l'image ne doit pas dépasser 5 Mo"
          : "Image size must be less than 5MB"
      );
      return;
    }

    setAvatarLoading(true);
    try {
      const url = await uploadAvatar(file);
      if (url) {
        toast.success(
          language === "ar"
            ? "تم تغيير صورة الملف الشخصي بنجاح"
            : language === "fr"
            ? "Photo de profil modifiée avec succès"
            : "Profile photo updated successfully"
        );
      }
    } finally {
      setAvatarLoading(false);
      event.target.value = "";
    }
  };

  const handleDeleteAvatar = async () => {
    setShowDeleteConfirm(false);
    setAvatarLoading(true);
    try {
      const success = await deleteAvatar();
      if (success) {
        toast.success(
          language === "ar"
            ? "تم حذف صورة الملف الشخصي بنجاح"
            : language === "fr"
            ? "Photo de profil supprimée avec succès"
            : "Profile photo removed successfully"
        );
      }
    } finally {
      setAvatarLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    
    setResetLoading(true);
    try {
      const success = await resetPassword(user.email);
      if (success) {
        toast.success(
          language === "ar"
            ? "تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني"
            : language === "fr"
            ? "Un email de réinitialisation vous a été envoyé"
            : "Password reset email sent! Check your inbox"
        );
      }
    } finally {
      setResetLoading(false);
    }
  };

  const getInitials = (userName?: string) => {
    if (!userName) return "U";
    return userName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold">
            {language === "ar" ? "لم يتم العثور على مستخدم" : language === "fr" ? "Aucun utilisateur trouvé" : "No user found"}
          </h2>
          <p className="text-muted-foreground mt-2">
            {language === "ar" ? "يرجى تسجيل الدخول لعرض ملفك الشخصي." : language === "fr" ? "Veuillez vous connecter pour voir votre profil." : "Please log in to view your profile."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
      <div>
        <h1 className="text-3xl font-bold">{t("nav.profile")}</h1>
        <p className="text-muted-foreground mt-1">
          {language === "ar" 
            ? "إدارة إعدادات حسابك وتفضيلاتك الشخصية" 
            : language === "fr" 
            ? "Gérez les paramètres de votre compte et vos préférences" 
            : "Manage your account settings and preferences"}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Information */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-xs border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <User className="h-5 w-5 text-primary" />
                {language === "ar" ? "المعلومات الشخصية" : language === "fr" ? "Informations personnelles" : "Personal Information"}
              </CardTitle>
              <CardDescription>
                {language === "ar"
                  ? "تحديث تفاصيلك الشخصية ومعلومات حسابك"
                  : language === "fr"
                  ? "Mettez à jour vos informations personnelles et votre compte"
                  : "Update your personal details and account information"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="font-medium">
                  {language === "ar" ? "الاسم الكامل" : language === "fr" ? "Nom complet" : "Full Name"}
                </Label>
                {isEditing ? (
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={language === "ar" ? "أدخل اسمك الكامل" : language === "fr" ? "Entrez votre nom complet" : "Enter your full name"}
                    className="h-10"
                  />
                ) : (
                  <div className="p-2.5 bg-muted/60 rounded-md font-medium text-foreground">{user.name}</div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="font-medium">
                  {language === "ar" ? "البريد الإلكتروني" : language === "fr" ? "Adresse email" : "Email Address"}
                </Label>
                <div className="p-2.5 bg-muted/60 rounded-md font-mono text-sm text-muted-foreground">{user.email}</div>
                <p className="text-xs text-muted-foreground">
                  {language === "ar" 
                    ? "لا يمكن تغيير البريد الإلكتروني. تواصل مع الدعم لتحديثه." 
                    : language === "fr" 
                    ? "L'adresse email est fixe. Contactez le support si vous devez la changer." 
                    : "Email cannot be changed. Contact support if you need to update it."}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="font-medium">
                  {language === "ar" ? "الدور" : language === "fr" ? "Rôle" : "Role"}
                </Label>
                {isEditing ? (
                  <Select value={role} onValueChange={(value: UserRole) => setRole(value)}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">
                        {language === "ar" ? "تلميذ" : language === "fr" ? "Élève" : "Student"}
                      </SelectItem>
                      <SelectItem value="professor">
                        {language === "ar" ? "أستاذ" : language === "fr" ? "Professeur" : "Professor"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-2.5 bg-muted/60 rounded-md flex items-center gap-2">
                    <Badge variant={user.role === "professor" ? "default" : "secondary"}>
                      {user.role === "professor" 
                        ? (language === "ar" ? "أستاذ" : language === "fr" ? "Professeur" : "Professor") 
                        : (language === "ar" ? "تلميذ" : language === "fr" ? "Élève" : "Student")}
                    </Badge>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t border-border">
                {isEditing ? (
                  <>
                    <Button onClick={handleSave} disabled={loading} className="gap-2 cursor-pointer">
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {language === "ar" ? "جارٍ الحفظ..." : language === "fr" ? "Enregistrement..." : "Saving..."}
                        </>
                      ) : (
                        language === "ar" ? "حفظ التغييرات" : language === "fr" ? "Enregistrer" : "Save Changes"
                      )}
                    </Button>
                    <Button variant="outline" onClick={handleCancel} disabled={loading} className="cursor-pointer">
                      {language === "ar" ? "إلغاء" : language === "fr" ? "Annuler" : "Cancel"}
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setIsEditing(true)} className="cursor-pointer">
                    {language === "ar" ? "تعديل الملف الشخصي" : language === "fr" ? "Modifier le profil" : "Edit Profile"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Avatar and Security Column */}
        <div className="space-y-6">
          {/* Instagram-style Avatar Card */}
          <Card className="shadow-xs border overflow-hidden">
            <CardHeader className="bg-muted/20 pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Camera className="h-5 w-5 text-primary" />
                {language === "ar" ? "صورة الملف الشخصي" : language === "fr" ? "Photo de profil" : "Profile Picture"}
              </CardTitle>
              <CardDescription>
                {language === "ar"
                  ? "انقر على الصورة لتكبيرها أو تغييرها أو حذفها"
                  : language === "fr"
                  ? "Cliquez sur la photo pour l'agrandir, la modifier ou la supprimer"
                  : "Click photo to zoom, change, or remove"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="flex flex-col items-center">
                {/* Interactive Instagram Avatar container */}
                <div 
                  onClick={() => setIsAvatarDialogOpen(true)}
                  className="relative group cursor-pointer"
                  title={language === "ar" ? "عرض / إدارة الصورة" : language === "fr" ? "Voir / Gérer la photo" : "View / Manage photo"}
                >
                  <div className={`p-1 rounded-full transition-all duration-300 ${
                    user.avatar_url 
                      ? "bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 shadow-md group-hover:shadow-lg group-hover:scale-105" 
                      : "bg-muted-foreground/20 group-hover:ring-2 group-hover:ring-primary/40"
                  }`}>
                    <div className="p-0.5 bg-background rounded-full">
                      <Avatar className="h-28 w-28 rounded-full transition-transform">
                        <AvatarImage src={user.avatar_url} alt={user.name} className="object-cover" />
                        <AvatarFallback className="text-2xl bg-primary/10 text-primary font-bold">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </div>

                  {/* Hover Overlay with Zoom Icon */}
                  <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                    <Maximize2 className="h-6 w-6 mb-1" />
                    <span className="text-[11px] font-medium">
                      {language === "ar" ? "تكبير" : language === "fr" ? "Agrandir" : "Zoom"}
                    </span>
                  </div>

                  {avatarLoading && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-xs rounded-full flex items-center justify-center z-20">
                      <Loader2 className="h-7 w-7 animate-spin text-primary" />
                    </div>
                  )}
                </div>

                <div className="mt-4 text-center">
                  <h4 className="font-semibold text-sm">{user.name}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {user.avatar_url 
                      ? (language === "ar" ? "صورة مخصصة نشطة" : language === "fr" ? "Photo personnalisée active" : "Custom photo active")
                      : (language === "ar" ? "الصورة الرمزية الافتراضية" : language === "fr" ? "Avatar par défaut" : "Default avatar")}
                  </p>
                </div>

                {/* CRUD Actions Bar */}
                <div className="w-full flex flex-col gap-2 mt-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full gap-2 cursor-pointer"
                    onClick={() => setIsAvatarDialogOpen(true)}
                  >
                    <Maximize2 className="h-4 w-4 text-primary" />
                    <span>
                      {language === "ar" ? "فتح المعرض / التكبير" : language === "fr" ? "Agrandir / Modal photo" : "View Photo Modal"}
                    </span>
                  </Button>

                  <div className="flex gap-2 w-full">
                    <Label htmlFor="avatar-upload-profile" className="flex-1 cursor-pointer">
                      <Button variant="secondary" size="sm" className="w-full gap-1.5 cursor-pointer" asChild disabled={avatarLoading}>
                        <span>
                          <Upload className="h-3.5 w-3.5" />
                          {user.avatar_url 
                            ? (language === "ar" ? "تغيير" : language === "fr" ? "Modifier" : "Change")
                            : (language === "ar" ? "إضافة" : language === "fr" ? "Ajouter" : "Upload")}
                        </span>
                      </Button>
                    </Label>
                    <Input
                      id="avatar-upload-profile"
                      type="file"
                      accept="image/png, image/jpeg, image/webp, image/gif"
                      className="hidden"
                      onChange={handleAvatarUpload}
                      disabled={avatarLoading}
                    />

                    {user.avatar_url && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0 cursor-pointer"
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={avatarLoading}
                        title={language === "ar" ? "حذف الصورة" : language === "fr" ? "Supprimer la photo" : "Remove photo"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground mt-3 text-center">
                  {language === "ar" ? "JPG أو PNG أو WEBP. الحد الأقصى 5 ميغابايت." : language === "fr" ? "JPG, PNG ou WEBP. Max 5 Mo." : "JPG, PNG or WEBP. Max 5MB."}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Security Card */}
          <Card className="shadow-xs border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Shield className="h-5 w-5 text-primary" />
                {language === "ar" ? "الأمان" : language === "fr" ? "Sécurité" : "Security"}
              </CardTitle>
              <CardDescription>
                {language === "ar" ? "إدارة أمان حسابك وكلمة المرور" : language === "fr" ? "Gérez la sécurité de votre compte" : "Manage account security settings"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 p-3 bg-muted/30 rounded-lg border">
                  <div>
                    <h4 className="text-sm font-medium">
                      {language === "ar" ? "كلمة المرور" : language === "fr" ? "Mot de passe" : "Password"}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {language === "ar" ? "إعادة تعيين عبر البريد الإلكتروني" : language === "fr" ? "Réinitialisation par email" : "Reset via email"}
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handlePasswordReset}
                    disabled={resetLoading}
                    className="gap-1.5 cursor-pointer shrink-0"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    {resetLoading 
                      ? (language === "ar" ? "جارٍ الإرسال..." : language === "fr" ? "Envoi..." : "Sending...") 
                      : (language === "ar" ? "إعادة تعيين" : language === "fr" ? "Réinitialiser" : "Reset")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Instagram-like Modal */}
      <ProfileAvatarDialog
        isOpen={isAvatarDialogOpen}
        onOpenChange={setIsAvatarDialogOpen}
      />

      {/* Localized Delete Confirmation Alert */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              {language === "ar"
                ? "حذف صورة الملف الشخصي"
                : language === "fr"
                ? "Supprimer la photo de profil"
                : "Remove profile photo"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "ar"
                ? "هل أنت متأكد من رغبتك في حذف صورة ملفك الشخصي؟ ستتم استعادة الأحرف الأولى لاسمك كصورة رمزية."
                : language === "fr"
                ? "Êtes-vous sûr de vouloir supprimer votre photo de profil ? Votre avatar sera réinitialisé avec vos initiales."
                : "Are you sure you want to remove your profile photo? This will reset your avatar to your initials."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {language === "ar" ? "إلغاء" : language === "fr" ? "Annuler" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAvatar}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {language === "ar" ? "تأكيد الحذف" : language === "fr" ? "Confirmer la suppression" : "Confirm delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Profile;
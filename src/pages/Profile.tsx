import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, Camera, Shield, KeyRound } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { UserRole } from "@/contexts/AuthContext";
import { toast } from "sonner";

const Profile = () => {
  const { user, updateProfile, uploadAvatar, resetPassword } = useAuth();
  const { t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  
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

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    setLoading(true);
    try {
      await uploadAvatar(file);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    
    setResetLoading(true);
    try {
      await resetPassword(user.email);
    } finally {
      setResetLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold">No user found</h2>
          <p className="text-muted-foreground mt-2">Please log in to view your profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">{t("nav.profile")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("Manage your account settings and preferences")}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Information */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {t("Personal Information")}
              </CardTitle>
              <CardDescription>
                {t("Update your personal details and account information")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("Full Name")}</Label>
                {isEditing ? (
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("Enter your full name")}
                  />
                ) : (
                  <div className="p-2 bg-muted rounded-md">{user.name}</div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t("Email Address")}</Label>
                <div className="p-2 bg-muted rounded-md">{user.email}</div>
                <p className="text-sm text-muted-foreground">
                  {t("Email cannot be changed. Contact support if you need to update it.")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">{t("Role")}</Label>
                {isEditing ? (
                  <Select value={role} onValueChange={(value: UserRole) => setRole(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">{t("Student")}</SelectItem>
                      <SelectItem value="professor">{t("Professor")}</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-2 bg-muted rounded-md flex items-center gap-2">
                    <Badge variant={user.role === "professor" ? "default" : "secondary"}>
                      {user.role === "professor" ? t("Professor") : t("Student")}
                    </Badge>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                {isEditing ? (
                  <>
                    <Button onClick={handleSave} disabled={loading}>
                      {loading ? t("Saving...") : t("Save Changes")}
                    </Button>
                    <Button variant="outline" onClick={handleCancel}>
                      {t("Cancel")}
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setIsEditing(true)}>
                    {t("Edit Profile")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Avatar and Security */}
        <div className="space-y-6">
          {/* Avatar Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                {t("Profile Picture")}
              </CardTitle>
              <CardDescription>
                {t("Upload a profile picture to personalize your account")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={user.avatar_url} alt={user.name} />
                  <AvatarFallback className="text-lg">
                    {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="text-center">
                  <Label htmlFor="avatar-upload" className="cursor-pointer">
                    <Button variant="outline" size="sm" asChild>
                      <span>
                        <Camera className="h-4 w-4 mr-2" />
                        {t("Change Photo")}
                      </span>
                    </Button>
                  </Label>
                  <Input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("JPG, PNG or GIF. Max 5MB.")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t("Security")}
              </CardTitle>
              <CardDescription>
                {t("Manage your account security settings")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium">{t("Password")}</h4>
                    <p className="text-xs text-muted-foreground">
                      {t("Reset your password via email")}
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handlePasswordReset}
                    disabled={resetLoading}
                  >
                    <KeyRound className="h-4 w-4 mr-2" />
                    {resetLoading ? t("Sending...") : t("Reset")}
                  </Button>
                </div>
                
                {/* Future: 2FA section */}
                <div className="flex items-center justify-between opacity-50">
                  <div>
                    <h4 className="text-sm font-medium">{t("Two-Factor Authentication")}</h4>
                    <p className="text-xs text-muted-foreground">
                      {t("Coming soon: Add an extra layer of security")}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" disabled>
                    <Shield className="h-4 w-4 mr-2" />
                    Setup
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;
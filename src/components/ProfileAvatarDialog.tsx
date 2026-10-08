import React, { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Camera, 
  Trash2, 
  Download, 
  Maximize2, 
  Upload, 
  Loader2, 
  Check, 
  X,
  Sparkles,
  ShieldCheck,
  GraduationCap
} from "lucide-react";
import { toast } from "sonner";

interface ProfileAvatarDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  userOverride?: {
    id: string;
    name: string;
    email?: string;
    role?: string;
    avatar_url?: string;
  };
  editable?: boolean;
}

export const ProfileAvatarDialog: React.FC<ProfileAvatarDialogProps> = ({
  isOpen,
  onOpenChange,
  userOverride,
  editable = true,
}) => {
  const { user: authUser, uploadAvatar, deleteAvatar } = useAuth();
  const { language } = useLanguage();

  const user = userOverride || authUser;
  const isSelf = !userOverride || userOverride.id === authUser?.id;
  const canEdit = editable && isSelf;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(
        language === "ar"
          ? "يرجى تحديد ملف صورة صالح"
          : language === "fr"
          ? "Veuillez sélectionner un fichier image valide"
          : "Please select a valid image file"
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

    // Create local instant preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    setLoading(true);
    try {
      const uploadedUrl = await uploadAvatar(file);
      if (uploadedUrl) {
        toast.success(
          language === "ar"
            ? "تم تحديث صورة الملف الشخصي بنجاح"
            : language === "fr"
            ? "Photo de profil mise à jour avec succès"
            : "Profile photo updated successfully"
        );
      }
    } catch (error) {
      console.error(error);
      toast.error(
        language === "ar"
          ? "فشل رفع الصورة"
          : language === "fr"
          ? "Échec du téléversement de la photo"
          : "Failed to upload photo"
      );
    } finally {
      setLoading(false);
      setPreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    setLoading(true);
    try {
      const success = await deleteAvatar();
      if (success) {
        toast.success(
          language === "ar"
            ? "تم حذف صورة الملف الشخصي"
            : language === "fr"
            ? "Photo de profil supprimée"
            : "Profile photo removed"
        );
      }
    } catch (error) {
      console.error(error);
      toast.error(
        language === "ar"
          ? "فشل حذف الصورة"
          : language === "fr"
          ? "Échec de la suppression de la photo"
          : "Failed to remove photo"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!user?.avatar_url) return;
    // iPad / iPhone : pas d'attribut download → on ouvre l'image (appui long → « Enregistrer l'image »)
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
      window.open(user.avatar_url, "_blank");
      return;
    }
    try {
      const response = await fetch(user.avatar_url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${user.name || "profile"}-avatar.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
      toast.success(
        language === "ar"
          ? "تم تنزيل الصورة"
          : language === "fr"
          ? "Image téléchargée"
          : "Image downloaded"
      );
    } catch (err) {
      // Fallback
      window.open(user.avatar_url, "_blank");
    }
  };

  const currentAvatarUrl = previewUrl || user?.avatar_url;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent 
          className="sm:max-w-md p-0 overflow-hidden bg-background/95 backdrop-blur-md border border-border shadow-2xl rounded-2xl animate-scale-in"
          onDragOver={(e) => {
            if (canEdit) {
              e.preventDefault();
              setIsDragging(true);
            }
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            if (canEdit) {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFileSelect(file);
            }
          }}
        >
          {/* Header Banner Background */}
          <div className="relative h-28 bg-gradient-to-tr from-primary/30 via-primary/15 to-accent/20 flex items-center justify-end p-4">
            {user?.role && (
              <Badge 
                variant="secondary" 
                className="bg-background/80 backdrop-blur-sm shadow-xs text-xs font-semibold gap-1 px-3 py-1"
              >
                {user.role === "professor" ? (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    {language === "ar" ? "أستاذ" : language === "fr" ? "Professeur" : "Professor"}
                  </>
                ) : (
                  <>
                    <GraduationCap className="h-3.5 w-3.5 text-primary" />
                    {language === "ar" ? "تلميذ" : language === "fr" ? "Élève" : "Student"}
                  </>
                )}
              </Badge>
            )}
          </div>

          {/* Main Avatar Presentation (Instagram Aesthetic) */}
          <div className="relative px-6 pb-6 pt-0 flex flex-col items-center text-center -mt-16">
            <div className="relative group">
              {/* Instagram Story Gradient Ring */}
              <div className={`p-[3.5px] rounded-full transition-all duration-300 ${
                currentAvatarUrl 
                  ? "bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 shadow-lg shadow-rose-500/20" 
                  : "bg-muted-foreground/20"
              } ${isDragging ? "ring-4 ring-primary scale-105" : ""}`}>
                <div className="relative rounded-full overflow-hidden bg-background p-1">
                  <Avatar className="h-32 w-32 md:h-36 md:w-36 rounded-full cursor-pointer select-none transition-transform duration-300 group-hover:scale-[1.02]">
                    <AvatarImage 
                      src={currentAvatarUrl} 
                      alt={user?.name} 
                      className="object-cover h-full w-full" 
                    />
                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/40 text-primary font-bold text-3xl">
                      {getInitials(user?.name)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Loading Overlay */}
                  {loading && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-xs flex flex-col items-center justify-center rounded-full z-20 animate-fade-in">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span className="text-[10px] font-medium text-muted-foreground mt-1">
                        {language === "ar" ? "جارٍ التحميل..." : language === "fr" ? "Traitement..." : "Processing..."}
                      </span>
                    </div>
                  )}

                  {/* Hover Quick Action Badge */}
                  {currentAvatarUrl && !loading && (
                    <button
                      type="button"
                      onClick={() => setIsFullscreen(true)}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center text-white rounded-full z-10"
                      title={language === "ar" ? "تكبير الصورة" : language === "fr" ? "Agrandir l'image" : "Zoom photo"}
                    >
                      <Maximize2 className="h-6 w-6 mb-1" />
                      <span className="text-xs font-medium">
                        {language === "ar" ? "عرض" : language === "fr" ? "Agrandir" : "Zoom"}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Camera Action Pill */}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="absolute bottom-1 right-1 p-2.5 bg-primary text-primary-foreground rounded-full shadow-lg hover:scale-110 active:scale-95 transition-transform duration-150 border-2 border-background z-20 cursor-pointer"
                  title={language === "ar" ? "تغيير الصورة" : language === "fr" ? "Changer la photo" : "Change photo"}
                >
                  <Camera className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* User Details */}
            <div className="mt-4 space-y-1">
              <h3 className="text-xl font-bold text-foreground tracking-tight">
                {user?.name || (language === "ar" ? "مستخدم" : language === "fr" ? "Utilisateur" : "User")}
              </h3>
              {user?.email && (
                <p className="text-sm text-muted-foreground">
                  {user.email}
                </p>
              )}
            </div>

            {/* Drag & Drop Hint */}
            {canEdit && isDragging && (
              <div className="mt-3 py-2 px-4 rounded-lg bg-primary/10 border border-primary/30 text-xs font-medium text-primary animate-pulse">
                {language === "ar" 
                  ? "أفلت الصورة هنا لرفعها مباشرة" 
                  : language === "fr" 
                  ? "Déposez l'image ici pour la téléverser" 
                  : "Drop image here to upload"}
              </div>
            )}

            {/* Actions Grid */}
            <div className="mt-6 w-full flex flex-col sm:flex-row items-center justify-center gap-2 pt-4 border-t border-border">
              {/* Hidden file input */}
              {canEdit && (
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp, image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                />
              )}

              {/* Modify / Upload Button */}
              {canEdit && (
                <Button
                  type="button"
                  variant="default"
                  className="w-full sm:w-auto flex-1 gap-2 shadow-xs cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                >
                  <Upload className="h-4 w-4" />
                  <span>
                    {currentAvatarUrl
                      ? language === "ar"
                        ? "تغيير الصورة"
                        : language === "fr"
                        ? "Modifier la photo"
                        : "Change photo"
                      : language === "ar"
                      ? "إضافة صورة"
                      : language === "fr"
                      ? "Ajouter une photo"
                      : "Add photo"}
                  </span>
                </Button>
              )}

              {/* View Fullscreen Button */}
              {currentAvatarUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 cursor-pointer"
                  onClick={() => setIsFullscreen(true)}
                  title={language === "ar" ? "عرض كامل" : language === "fr" ? "Plein écran" : "Fullscreen"}
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              )}

              {/* Download Button */}
              {currentAvatarUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 cursor-pointer"
                  onClick={handleDownload}
                  title={language === "ar" ? "تحميل الصورة" : language === "fr" ? "Télécharger" : "Download"}
                >
                  <Download className="h-4 w-4" />
                </Button>
              )}

              {/* Delete Button */}
              {canEdit && currentAvatarUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 cursor-pointer"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={loading}
                  title={language === "ar" ? "حذف الصورة" : language === "fr" ? "Supprimer la photo" : "Delete photo"}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Instagram Fullscreen Lightbox Modal */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-4xl p-2 bg-black/95 text-white border-0 shadow-2xl flex flex-col items-center justify-center">
          <div className="w-full flex items-center justify-between p-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8 ring-1 ring-white/30">
                <AvatarImage src={currentAvatarUrl} alt={user?.name} />
                <AvatarFallback>{getInitials(user?.name)}</AvatarFallback>
              </Avatar>
              <span className="font-semibold text-sm">{user?.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/10"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4 mr-1" />
                {language === "ar" ? "تحميل" : language === "fr" ? "Télécharger" : "Download"}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="text-white hover:bg-white/10"
                onClick={() => setIsFullscreen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <div className="p-4 flex items-center justify-center max-h-[80vh] overflow-hidden">
            <img
              src={currentAvatarUrl}
              alt={user?.name}
              className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl animate-scale-in"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Localized Delete Confirmation Dialog */}
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
                ? "Êtes-vous sûr de vouloir supprimer votre photo de profil ? Cette action réinitialisera votre avatar par vos initiales."
                : "Are you sure you want to remove your profile photo? This will reset your avatar to your initials."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {language === "ar" ? "إلغاء" : language === "fr" ? "Annuler" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {language === "ar" ? "تأكيد الحذف" : language === "fr" ? "Confirmer la suppression" : "Confirm delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ProfileAvatarDialog;

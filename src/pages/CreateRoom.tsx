import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses } from "@/contexts/CourseContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Building, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const CreateRoom = () => {
  const { user } = useAuth();
  const { addRoom } = useCourses();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_visible: true
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error(language === "ar" ? "اسم القسم مطلوب" : t("Class name is required"));
      return;
    }

    setLoading(true);
    try {
      await addRoom({
        name: formData.name.trim(),
        description: formData.description?.trim() || null,
        is_visible: formData.is_visible
      });
      
      toast.success(language === "ar" ? "تم إنشاء القسم بنجاح!" : t("Class created successfully!"));
      navigate('/class-management');
    } catch (error) {
      toast.error(language === "ar" ? "فشل في إنشاء القسم" : t("Failed to create class"));
      console.error("Error creating class:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/class-management')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {language === "ar" ? "إنشاء قسم جديد" : t("Create New Class")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === "ar" 
              ? "إعداد قسم جديد لتنظيم دروسك وتلاميذك" 
              : t("Set up a new class to organize your courses and students")}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building className="h-5 w-5 text-primary" />
            <CardTitle>
              {language === "ar" ? "تفاصيل القسم" : t("Class Details")}
            </CardTitle>
          </div>
          <CardDescription>
            {language === "ar" 
              ? "أدخل معلومات قسمك الجديد" 
              : t("Enter the information for your new class")}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">
                {language === "ar" ? "اسم القسم *" : t("Class Name *")}
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder={language === "ar" ? "أدخل اسم القسم..." : t("Enter class name...")}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                {language === "ar" ? "الوصف" : t("form.description")}
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={language === "ar" ? "أدخل وصف القسم..." : t("Enter class description...")}
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <Switch
                id="visibility"
                checked={formData.is_visible}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_visible: checked }))}
              />
              <Label htmlFor="visibility">
                {language === "ar" ? "إتاحة القسم لظهور التلاميذ" : t("Make class visible to students")}
              </Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1" disabled={loading}>
                <Building className="mr-2 h-4 w-4" />
                {loading 
                  ? (language === "ar" ? "جاري الإنشاء..." : "Creating...")
                  : (language === "ar" ? "إنشاء قسم" : t("Create Class"))}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/class-management')}>
                {language === "ar" ? "إلغاء" : t("app.cancel")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateRoom;

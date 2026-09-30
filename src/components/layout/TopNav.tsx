
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Menu, 
  Bell, 
  LogOut, 
  User,
  Settings,
  Camera
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Sidebar from "./Sidebar";
import NotificationBell from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import ProfileAvatarDialog from "@/components/ProfileAvatarDialog";

const TopNav = () => {
  const { user, logout } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="bg-card border-b h-16 flex items-center px-4 md:px-6 shadow-sm">
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side={language === "ar" ? "right" : "left"} className="p-0 w-72 max-w-[85vw]" onClick={(e) => {
          // Close sheet when clicking on links inside
          if ((e.target as HTMLElement).closest('a')) {
            setIsOpen(false);
          }
        }}>
          <Sidebar />
        </SheetContent>
      </Sheet>

      <div className="flex items-center space-x-4 ml-4 md:ml-0">
        <h1 className="text-xl font-bold text-gradient hidden sm:block">
          Math infini ∞
        </h1>
        <h1 className="text-lg font-bold text-gradient sm:hidden">
          ∞
        </h1>
      </div>

      <div className="ml-auto flex items-center space-x-4">
        <LanguageSelector />
        <NotificationBell />
        <ThemeToggle />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0 overflow-hidden ring-2 ring-primary/20 hover:ring-primary/50 transition-all cursor-pointer">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user?.avatar_url} alt={user?.name || "Profile"} className="object-cover" />
                <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-xs">
                  {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || user?.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col">
              <span className="font-semibold text-sm">{user?.name || t("profile.account")}</span>
              <span className="text-xs text-muted-foreground font-normal truncate">{user?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => setIsAvatarModalOpen(true)}
              className="cursor-pointer"
            >
              <Camera className="mr-2 h-4 w-4 text-primary" />
              <span>
                {language === "ar" 
                  ? "صورة الملف الشخصي" 
                  : language === "fr" 
                  ? "Photo de profil" 
                  : "Profile Photo"}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/profile")} className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              <span>{t("nav.profile")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              <span>{t("nav.settings")}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>{t("nav.logout")}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Instagram-style Profile Avatar Modal */}
        <ProfileAvatarDialog 
          isOpen={isAvatarModalOpen}
          onOpenChange={setIsAvatarModalOpen}
        />
      </div>
    </header>
  );
};

export default TopNav;

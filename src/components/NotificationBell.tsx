import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Bell,
  CheckCheck,
  Trash2,
  BookOpen,
  FileText,
  GraduationCap,
  Clock,
  AlertTriangle,
  Info,
  Check,
  Sparkles,
  Inbox,
  Flame
} from "lucide-react";
import { useNotifications, Notification, NotificationType } from "@/contexts/NotificationContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

export const NotificationBell = () => {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications
  } = useNotifications();

  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const navigate = useNavigate();

  const t = (fr: string, ar: string, en: string) =>
    language === "ar" ? ar : language === "fr" ? fr : en;

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Smart navigation based on notification type and ids
    if (notification.type.includes('course')) {
      navigate('/courses');
    } else if (notification.type.includes('exercise')) {
      navigate('/exercises');
    } else if (notification.type.includes('exam')) {
      navigate('/exams');
    }

    setIsOpen(false);
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return t("À l'instant", "الآن", "Just now");
    if (diffMin < 60) return t(`Il y a ${diffMin} min`, `منذ ${diffMin} د`, `${diffMin}m ago`);
    if (diffHours < 24) return t(`Il y a ${diffHours} h`, `منذ ${diffHours} س`, `${diffHours}h ago`);
    if (diffDays === 1) return t("Hier", "أمس", "Yesterday");
    if (diffDays < 7) return t(`Il y a ${diffDays} j`, `منذ ${diffDays} أيام`, `${diffDays}d ago`);

    return date.toLocaleDateString(language === "ar" ? "ar-MA" : "fr-FR", {
      month: "short",
      day: "numeric",
    });
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'course_added':
        return {
          icon: BookOpen,
          bg: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
          badge: t("Cours", "درس", "Course")
        };
      case 'course_deleted':
        return {
          icon: Trash2,
          bg: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
          badge: t("Suppression", "حذف", "Deleted")
        };
      case 'exercise_added':
        return {
          icon: FileText,
          bg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
          badge: t("Exercice", "تمرين", "Exercise")
        };
      case 'exercise_deleted':
        return {
          icon: Trash2,
          bg: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
          badge: t("Suppression", "حذف", "Deleted")
        };
      case 'exam_added':
        return {
          icon: GraduationCap,
          bg: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
          badge: t("Évaluation", "تقييم", "Exam")
        };
      case 'exam_deleted':
        return {
          icon: Trash2,
          bg: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
          badge: t("Annulation", "إلغاء", "Cancelled")
        };
      case 'exam_reminder':
        return {
          icon: Clock,
          bg: "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40 animate-pulse",
          badge: t("⏰ Rappel < 24h", "⏰ تذكير", "⏰ Reminder")
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          bg: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
          badge: t("Alerte", "تنبيه", "Alert")
        };
      default:
        return {
          icon: Info,
          bg: "bg-primary/15 text-primary border-primary/30",
          badge: t("Info", "معلومة", "Info")
        };
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === "unread") return !n.read;
    return true;
  });

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full transition-colors hover:bg-muted focus-visible:ring-1"
          aria-label="Notifications"
        >
          <Bell className={cn("h-5 w-5 transition-transform", unreadCount > 0 && "text-primary animate-wiggle")} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground shadow-md ring-2 ring-background animate-scale-in">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[92vw] sm:w-[410px] p-0 shadow-2xl border-border/80 backdrop-blur-md bg-card/95 overflow-hidden"
        align={language === "ar" ? "start" : "end"}
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold leading-none">
                {t("Notifications", "الإشعارات", "Notifications")}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {unreadCount > 0
                  ? t(`${unreadCount} non lue(s)`, `${unreadCount} غير مقروءة`, `${unreadCount} unread`)
                  : t("Toutes les notifications sont lues", "جميع الإشعارات مقروءة", "All caught up")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <TooltipProvider>
              {unreadCount > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => markAllAsRead()}
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                    >
                      <CheckCheck className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs">
                      {t("Tout marquer comme lu", "تحديد الكل كمقروء", "Mark all as read")}
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}

              {notifications.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => clearAllNotifications()}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs">
                      {t("Tout effacer", "حذف الكل", "Clear all")}
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
          </div>
        </div>

        {/* Filter Tabs */}
        {notifications.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 border-b bg-background/50 text-xs">
            <button
              onClick={() => setFilter("all")}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-all",
                filter === "all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {t("Toutes", "الكل", "All")} ({notifications.length})
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1.5",
                filter === "unread"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {t("Non lues", "غير مقروءة", "Unread")}
              {unreadCount > 0 && (
                <span className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                  filter === "unread" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"
                )}>
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Notifications List */}
        <ScrollArea className="h-[360px] max-h-[60vh]">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground mb-3 border border-border/50">
                {filter === "unread" ? <Sparkles className="h-6 w-6 text-primary" /> : <Inbox className="h-6 w-6" />}
              </div>
              <h4 className="text-sm font-semibold text-foreground">
                {filter === "unread"
                  ? t("Aucune notification non lue", "لا توجد إشعارات غير مقروءة", "No unread notifications")
                  : t("Aucune notification pour le moment", "لا توجد إشعارات حالياً", "No notifications yet")}
              </h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                {filter === "unread"
                  ? t("Vous avez consulté toutes vos alertes !", "لقد اطلعت على جميع الإشعارات!", "You're all caught up!")
                  : t("Les nouveaux cours, exercices et examens apparaîtront ici.", "ستظهر هنا الدروس والتمارين والامتحانات الجديدة.", "New courses, exercises and exams will appear here.")}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filteredNotifications.map((notification) => {
                const iconConfig = getNotificationIcon(notification.type);
                const IconComponent = iconConfig.icon;

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "group relative flex items-start gap-3 p-3.5 transition-all cursor-pointer hover:bg-muted/60",
                      !notification.read && "bg-primary/[0.04] dark:bg-primary/[0.07]"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    {/* Icon with colored badge container */}
                    <div
                      className={cn(
                        "mt-0.5 p-2 rounded-xl border flex-shrink-0 transition-transform group-hover:scale-105",
                        iconConfig.bg
                      )}
                    >
                      <IconComponent className="h-4 w-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-foreground leading-snug line-clamp-1">
                          {notification.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0 font-medium">
                          {formatRelativeTime(notification.created_at)}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {notification.message}
                      </p>

                      <div className="flex items-center justify-between pt-1">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border/40">
                          {iconConfig.badge}
                        </span>

                        {/* Quick hover actions */}
                        <div
                          className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded"
                            title={notification.read ? t("Marquer comme non lu", "تحديد كغير مقروء", "Mark as unread") : t("Marquer comme lu", "تحديد كمقروء", "Mark as read")}
                            onClick={() => markAsRead(notification.id)}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"
                            title={t("Supprimer", "حذف", "Delete")}
                            onClick={() => deleteNotification(notification.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Unread indicator dot */}
                    {!notification.read && (
                      <span className="absolute top-4 right-3 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
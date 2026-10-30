import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { uiTr } from "./ui-i18n"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-']):not([class*='h-'])]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-card text-foreground shadow-sm hover:bg-muted",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        ghost: "text-foreground/80 hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        premium: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
      },
      size: {
        default: "h-9 px-3.5 py-2",
        sm: "h-8 rounded-md px-2.5 text-[13px]",
        lg: "h-10 rounded-md px-5",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

// Libellé lu par les lecteurs d'écran pour un bouton qui ne montre qu'une icône
const ICON_LABELS: [RegExp, string, string, string][] = [
  [/^Trash/, "Supprimer", "حذف", "Delete"],
  [/^(Pencil|Edit|SquarePen|PenLine)/, "Modifier", "تعديل", "Edit"],
  [/^(X|XCircle|CircleX)$/, "Fermer", "إغلاق", "Close"],
  [/^Chevron(Left|sLeft)|^ArrowLeft/, "Précédent", "السابق", "Previous"],
  [/^Chevron(Right|sRight)|^ArrowRight/, "Suivant", "التالي", "Next"],
  [/^ChevronUp|^ArrowUp/, "Monter", "أعلى", "Move up"],
  [/^ChevronDown|^ArrowDown/, "Descendre", "أسفل", "Move down"],
  [/^Eye(?!Off)/, "Voir", "عرض", "View"],
  [/^EyeOff/, "Masquer", "إخفاء", "Hide"],
  [/^Download/, "Télécharger", "تحميل", "Download"],
  [/^Upload/, "Envoyer un fichier", "رفع ملف", "Upload"],
  [/^Plus/, "Ajouter", "إضافة", "Add"],
  [/^(Copy|Files)/, "Copier", "نسخ", "Copy"],
  [/^(MoreVertical|MoreHorizontal|Ellipsis|EllipsisVertical)/, "Plus d'actions", "إجراءات أخرى", "More actions"],
  [/^(RefreshCw|RotateCw|RotateCcw|RefreshCcw)/, "Actualiser", "تحديث", "Refresh"],
  [/^Search/, "Rechercher", "بحث", "Search"],
  [/^Settings/, "Réglages", "الإعدادات", "Settings"],
  [/^(Maximize|Expand|Fullscreen)/, "Plein écran", "ملء الشاشة", "Full screen"],
  [/^(Minimize|Shrink)/, "Réduire", "تصغير", "Collapse"],
  [/^(ZoomIn)/, "Agrandir", "تكبير", "Zoom in"],
  [/^(ZoomOut)/, "Réduire le zoom", "تصغير", "Zoom out"],
  [/^(Printer)/, "Imprimer", "طباعة", "Print"],
  [/^(Share)/, "Partager", "مشاركة", "Share"],
  [/^(Send)/, "Envoyer", "إرسال", "Send"],
  [/^(Save)/, "Enregistrer", "حفظ", "Save"],
  [/^(Check)$/, "Valider", "تأكيد", "Confirm"],
  [/^(Menu|PanelLeft)/, "Menu", "القائمة", "Menu"],
  [/^(Bell)/, "Notifications", "الإشعارات", "Notifications"],
  [/^(Info|HelpCircle|CircleHelp)/, "Informations", "معلومات", "Information"],
  [/^(Play)/, "Lancer", "تشغيل", "Start"],
  [/^(Pause)/, "Pause", "إيقاف مؤقت", "Pause"],
  [/^(ExternalLink)/, "Ouvrir", "فتح", "Open"],
  [/^(Link)/, "Lien", "رابط", "Link"],
  [/^(Mic)/, "Micro", "الميكروفون", "Microphone"],
  [/^(Image|Camera)/, "Image", "صورة", "Image"],
  [/^(LogOut)/, "Se déconnecter", "تسجيل الخروج", "Log out"],
  [/^(Sun|Moon)/, "Changer de thème", "تغيير المظهر", "Toggle theme"],
  [/^(Key|KeyRound)/, "Mot de passe", "كلمة المرور", "Password"],
  [/^(ArrowLeftRight|Repeat)/, "Transférer", "نقل", "Transfer"],
]

function iconLabel(children: React.ReactNode): string | undefined {
  for (const child of React.Children.toArray(children)) {
    if (!React.isValidElement(child)) continue
    const name = (child.type as any)?.displayName as string | undefined
    if (!name) continue
    const hit = ICON_LABELS.find(([re]) => re.test(name))
    if (hit) return uiTr(hit[1], hit[2], hit[3])
  }
  return undefined
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    // bouton-icône sans libellé : on reprend le title, sinon le nom de l'icône
    const ariaLabel =
      size === "icon" && !props["aria-label"] && !props["aria-labelledby"]
        ? (typeof props.title === "string" && props.title) || iconLabel(props.children)
        : undefined
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

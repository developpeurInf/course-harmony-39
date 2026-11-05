import * as React from "react"
import { Toaster as Sonner } from "sonner"
import { useTheme } from "@/contexts/ThemeContext"
import { useLanguage } from "@/contexts/LanguageContext"

type ToasterProps = React.ComponentProps<typeof Sonner>

const SMALL_QUERY = "(max-width: 640px)"

function useIsSmallScreen() {
  const [small, setSmall] = React.useState(() =>
    typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(SMALL_QUERY).matches
  )
  React.useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia(SMALL_QUERY)
    const onChange = () => setSmall(mq.matches)
    onChange()
    // Safari < 14 : addListener/removeListener uniquement
    if (mq.addEventListener) mq.addEventListener("change", onChange)
    else if ((mq as any).addListener) (mq as any).addListener(onChange)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange)
      else if ((mq as any).removeListener) (mq as any).removeListener(onChange)
    }
  }, [])
  return small
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme, systemTheme } = useTheme()
  const { language } = useLanguage()
  const small = useIsSmallScreen()
  const resolvedTheme = theme === "system" ? systemTheme : theme
  const dir = language === "ar" ? "rtl" : "ltr"

  return (
    <Sonner
      theme={resolvedTheme as ToasterProps["theme"]}
      dir={dir}
      position={small ? "top-center" : dir === "rtl" ? "bottom-left" : "bottom-right"}
      closeButton
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

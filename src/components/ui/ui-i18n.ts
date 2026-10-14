/**
 * Mini-traduction pour les primitives UI (dialog, sheet…), qui peuvent être rendues
 * hors des fournisseurs React : on lit la langue posée sur <html lang> par LanguageContext.
 */
export function uiLang(): "fr" | "ar" | "en" {
  if (typeof document === "undefined") return "fr"
  const l = (document.documentElement.lang || "").toLowerCase()
  if (l.indexOf("ar") === 0) return "ar"
  if (l.indexOf("en") === 0) return "en"
  return "fr"
}

export function uiTr(fr: string, ar: string, en: string): string {
  const l = uiLang()
  return l === "ar" ? ar : l === "en" ? en : fr
}

/* ───────── iOS : garder le champ actif visible au-dessus du clavier ───────── */
let focusFixInstalled = false

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent || ""
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1)
}

/**
 * Installe (une seule fois) un écouteur global `focusin` : sur iOS, 300 ms après la mise au
 * point d'un champ (le temps que le clavier s'ouvre), on le fait défiler dans la zone visible
 * s'il est masqué. Utilise window.visualViewport quand il existe (iOS ≥ 13).
 */
export function installIOSFocusScrollFix(): void {
  if (focusFixInstalled || typeof document === "undefined" || !isIOS()) return
  focusFixInstalled = true
  document.addEventListener("focusin", (e) => {
    const el = e.target as HTMLElement | null
    if (!el || !el.tagName) return
    const tag = el.tagName
    if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT" && !el.isContentEditable) return
    const type = (el as HTMLInputElement).type
    if (tag === "INPUT" && /^(checkbox|radio|button|submit|reset|file|range|color)$/.test(type)) return
    window.setTimeout(() => {
      if (document.activeElement !== el) return
      const vv = (window as any).visualViewport as { height: number; offsetTop: number } | undefined
      const viewTop = vv ? vv.offsetTop : 0
      const viewHeight = vv ? vv.height : window.innerHeight
      const r = el.getBoundingClientRect()
      if (r.top < viewTop + 8 || r.bottom > viewTop + viewHeight - 8) {
        try {
          el.scrollIntoView({ block: "center", inline: "nearest" } as ScrollIntoViewOptions)
        } catch {
          el.scrollIntoView(false)
        }
      }
    }, 300)
  })
}

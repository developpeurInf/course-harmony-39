import * as React from "react"

const ITEM_SELECTOR = '[role="menuitem"]:not([disabled]), [role="menuitemradio"]:not([disabled]), [role="menuitemcheckbox"]:not([disabled])'
const FOCUSABLE_SELECTOR = 'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Comportement commun des petits menus déroulants « maison » (langue, thème, profil,
 * notifications) : fermeture au clic / toucher extérieur et avec Échap (focus rendu au
 * bouton), focus sur le 1er élément (ou l'élément coché) à l'ouverture, flèches ↑/↓,
 * Début/Fin pour naviguer. Compatible Safari iOS 12 (pas d'API récente).
 */
export function usePopupMenu(open: boolean, setOpen: (open: boolean) => void) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)
  const id = React.useRef("popup-" + Math.random().toString(36).slice(2, 9)).current

  React.useEffect(() => {
    if (!open) return

    const getItems = (): HTMLElement[] => {
      const menu = menuRef.current
      if (!menu) return []
      let items = Array.prototype.slice.call(menu.querySelectorAll(ITEM_SELECTOR)) as HTMLElement[]
      if (!items.length) items = Array.prototype.slice.call(menu.querySelectorAll(FOCUSABLE_SELECTOR)) as HTMLElement[]
      return items
    }

    const onOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // Un clic dans un dialogue ouvert depuis le menu ne doit pas le fermer
        const target = e.target as HTMLElement | null
        if (target && target.closest && target.closest('[role="dialog"], [role="alertdialog"]')) return
        setOpen(false)
      }
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Esc") {
        // Ne pas fermer si un dialogue ouvert par-dessus gère Échap
        if (document.querySelector('[role="alertdialog"][data-state="open"], [role="dialog"][data-state="open"]')) return
        setOpen(false)
        if (triggerRef.current) triggerRef.current.focus()
        return
      }
      if (!menuRef.current || !menuRef.current.contains(document.activeElement)) return
      const items = getItems()
      if (!items.length) return
      const idx = items.indexOf(document.activeElement as HTMLElement)
      let next = -1
      if (e.key === "ArrowDown" || e.key === "Down") next = idx < 0 ? 0 : (idx + 1) % items.length
      else if (e.key === "ArrowUp" || e.key === "Up") next = idx <= 0 ? items.length - 1 : idx - 1
      else if (e.key === "Home") next = 0
      else if (e.key === "End") next = items.length - 1
      else if (e.key === "Tab") {
        // Tab quitte le menu : on le ferme
        setOpen(false)
        return
      }
      if (next >= 0) {
        e.preventDefault()
        items[next].focus()
      }
    }

    document.addEventListener("mousedown", onOutside)
    document.addEventListener("touchstart", onOutside, { passive: true } as AddEventListenerOptions)
    document.addEventListener("keydown", onKey)

    const timer = window.setTimeout(() => {
      const items = getItems()
      let first: HTMLElement | undefined
      for (let i = 0; i < items.length; i++) {
        if (items[i].getAttribute("aria-checked") === "true") { first = items[i]; break }
      }
      first = first || items[0]
      if (first) {
        try { first.focus({ preventScroll: true } as FocusOptions) } catch { first.focus() }
      }
    }, 0)

    return () => {
      window.clearTimeout(timer)
      document.removeEventListener("mousedown", onOutside)
      document.removeEventListener("touchstart", onOutside)
      document.removeEventListener("keydown", onKey)
    }
  }, [open, setOpen])

  return {
    containerRef,
    triggerRef,
    menuRef,
    menuId: id,
    triggerProps: {
      "aria-expanded": open,
      "aria-haspopup": "true" as const,
      "aria-controls": open ? id : undefined,
    },
  }
}

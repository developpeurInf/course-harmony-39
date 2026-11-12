"use client";

/**
 * Fenêtre des outils Maths. Volontairement sans la boîte de dialogue Radix :
 * le clavier virtuel de MathLive et GeoGebra s'affichent hors de la fenêtre
 * et doivent rester cliquables (Radix bloque les clics en dehors).
 */
import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function MathOverlay({
  open, onClose, title, icon, subtitle, children, footer, dir, className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  dir?: "ltr" | "rtl";
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/45 p-2 pt-[4vh] backdrop-blur-[1px] sm:p-4 sm:pt-[6vh]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      dir={dir}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className={cn("flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border bg-card text-foreground shadow-2xl", className)}>
        <div className="flex items-start gap-3 border-b px-4 py-3">
          {icon && <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[color:var(--office-accent-soft,#dce6f4)] text-[color:var(--office-accent,#2B579A)]">{icon}</div>}
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold leading-tight">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Fermer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-muted/30 px-4 py-2.5">{footer}</div>}
      </div>
    </div>
  );
}

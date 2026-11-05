import { useEffect, useReducer, type ReactNode, type RefObject } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PdfWorkspaceHandle } from "./PdfWorkspace";

/** Relit l'état des commandes du visualiseur (outil actif, annuler disponible…) à chaque changement */
export function useCommandRefresh(wsRef: RefObject<PdfWorkspaceHandle | null>, ready: boolean) {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  // abonnement lié à la référence (stable) et non à l'objet du visualiseur, recréé à chaque rendu
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !ready) return;
    const off = ws.onCommandsChange(() => bump());
    bump();
    return off;
  }, [wsRef, ready]);
}

export interface RibbonTab {
  id: string;
  label: string;
}

export function RibbonTabs({ tabs, value, onChange, end }: { tabs: RibbonTab[]; value: string; onChange: (id: string) => void; end?: ReactNode }) {
  return (
    <div className="flex items-end gap-2 border-b bg-card px-2 sm:px-3">
      <div role="tablist" className="-mb-px flex min-w-0 flex-1 items-end overflow-x-auto [scrollbar-width:none]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={value === tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative h-10 shrink-0 whitespace-nowrap px-3 text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              value === tab.id
                ? "font-medium text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {end && <div className="flex shrink-0 items-center gap-2 py-1.5">{end}</div>}
    </div>
  );
}

export function RibbonBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[68px] items-stretch gap-0 overflow-x-auto border-b bg-card px-1.5 py-1 [scrollbar-width:thin] sm:px-2">
      {children}
    </div>
  );
}

export function RibbonGroup({ label, children, className }: { label?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex shrink-0 flex-col border-e px-1 last:border-e-0", className)}>
      <div className="flex flex-1 items-start gap-0.5">{children}</div>
      {label && <div className="hidden pb-0.5 pt-0.5 text-center text-[10px] uppercase tracking-wide text-muted-foreground/80 lg:block">{label}</div>}
    </div>
  );
}

export interface RibbonButtonProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  /** petite flèche (menu) */
  menu?: boolean;
  iconClassName?: string;
}

export function RibbonButton({ icon: Icon, label, onClick, active, disabled, title, menu, iconClassName }: RibbonButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title || label}
      aria-pressed={active || undefined}
      className={cn(
        "flex h-[54px] min-w-[54px] max-w-[80px] flex-col items-center justify-center gap-1 rounded-md px-1.5 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40",
        active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
      )}
    >
      <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-primary" : "text-foreground/75", iconClassName)} strokeWidth={1.6} />
      <span className="line-clamp-2 text-[11px] leading-tight">
        {label}
        {menu && <span className="ms-0.5 text-muted-foreground">▾</span>}
      </span>
    </button>
  );
}

/** Bouton lié à une commande du visualiseur : libellé, état actif et désactivé suivent la commande */
export function CommandButton({
  ws,
  command,
  icon,
  label,
  disabled,
}: {
  ws: PdfWorkspaceHandle | null;
  command: string;
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
}) {
  const state = ws?.commandState(command);
  return (
    <RibbonButton
      icon={icon}
      label={label}
      active={!!state?.active}
      disabled={disabled || !state || state.disabled}
      onClick={() => ws?.runCommand(command)}
    />
  );
}

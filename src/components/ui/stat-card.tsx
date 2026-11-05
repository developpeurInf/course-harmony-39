import * as React from "react";
import { cn } from "@/lib/utils";

export type StatTone = "blue" | "indigo" | "violet" | "emerald" | "amber" | "rose" | "cyan" | "slate";

/**
 * Les tons ne colorent plus que la jauge : les indicateurs restent neutres
 * pour que la page ne ressemble pas à un arc-en-ciel.
 */
const BAR: Record<StatTone, string> = {
  blue: "bg-primary",
  indigo: "bg-primary",
  violet: "bg-primary",
  emerald: "bg-success",
  amber: "bg-warning",
  rose: "bg-destructive",
  cyan: "bg-primary",
  slate: "bg-foreground/60",
};

export interface StatCardProps {
  icon: React.ReactNode;
  label: React.ReactNode;
  value: React.ReactNode;
  /** Petit texte sous la valeur (unité, contexte…) */
  hint?: React.ReactNode;
  tone?: StatTone;
  /** 0–100 : affiche une jauge fine sous la valeur */
  progress?: number | null;
  /** Élément affiché à droite de la valeur (badge de tendance…) */
  aside?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

/** Carte d'indicateur (KPI) : libellé, valeur en chiffres tabulaires, jauge optionnelle. */
export function StatCard({ icon, label, value, hint, tone = "blue", progress, aside, onClick, className }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined}
      className={cn(
        "group relative rounded-xl border bg-card p-4 shadow-sm sm:p-5",
        onClick && "card-hover cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium leading-tight text-muted-foreground">{label}</p>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground [&_svg]:h-3.5 [&_svg]:w-3.5">
          {icon}
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="text-2xl font-semibold leading-none tracking-tight tabular-nums">{value}</div>
        {aside}
      </div>
      {hint && <p className="mt-2 text-xs leading-snug text-muted-foreground">{hint}</p>}
      {progress !== undefined && progress !== null && (
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-[width] duration-500 ease-out", BAR[tone])}
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default StatCard;

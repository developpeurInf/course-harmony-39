import * as React from "react";
import { cn } from "@/lib/utils";

export type StatTone = "blue" | "indigo" | "violet" | "emerald" | "amber" | "rose" | "cyan" | "slate";

const TONES: Record<StatTone, { icon: string; glow: string; bar: string; ring: string }> = {
  blue: { icon: "bg-blue-500/10 text-blue-600 dark:text-blue-400", glow: "from-blue-500/15", bar: "bg-blue-500", ring: "group-hover:ring-blue-500/20" },
  indigo: { icon: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400", glow: "from-indigo-500/15", bar: "bg-indigo-500", ring: "group-hover:ring-indigo-500/20" },
  violet: { icon: "bg-violet-500/10 text-violet-600 dark:text-violet-400", glow: "from-violet-500/15", bar: "bg-violet-500", ring: "group-hover:ring-violet-500/20" },
  emerald: { icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", glow: "from-emerald-500/15", bar: "bg-emerald-500", ring: "group-hover:ring-emerald-500/20" },
  amber: { icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400", glow: "from-amber-500/15", bar: "bg-amber-500", ring: "group-hover:ring-amber-500/20" },
  rose: { icon: "bg-rose-500/10 text-rose-600 dark:text-rose-400", glow: "from-rose-500/15", bar: "bg-rose-500", ring: "group-hover:ring-rose-500/20" },
  cyan: { icon: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400", glow: "from-cyan-500/15", bar: "bg-cyan-500", ring: "group-hover:ring-cyan-500/20" },
  slate: { icon: "bg-slate-500/10 text-slate-600 dark:text-slate-300", glow: "from-slate-500/15", bar: "bg-slate-500", ring: "group-hover:ring-slate-500/20" },
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

/**
 * Carte d'indicateur (KPI) : icône teintée, valeur mise en avant, halo coloré,
 * jauge optionnelle et léger relief au survol.
 */
export function StatCard({ icon, label, value, hint, tone = "blue", progress, aside, onClick, className }: StatCardProps) {
  const t = TONES[tone];
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-4 sm:p-5",
        "shadow-[0_1px_2px_rgb(15_23_42/0.04),0_6px_20px_-12px_rgb(15_23_42/0.14)]",
        "ring-1 ring-transparent transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_1px_2px_rgb(15_23_42/0.05),0_16px_32px_-16px_rgb(15_23_42/0.25)]",
        t.ring,
        onClick && "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        "stat-card-in",
        className
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -top-10 -end-10 h-32 w-32 rounded-full bg-gradient-to-br to-transparent opacity-80 blur-2xl transition-opacity duration-300 group-hover:opacity-100",
          t.glow
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-muted-foreground leading-tight">{label}</p>
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110", t.icon)}>
          {icon}
        </span>
      </div>
      <div className="relative mt-2 flex items-end justify-between gap-2">
        <div className="text-2xl sm:text-[1.7rem] font-extrabold tracking-tight tabular-nums leading-none">{value}</div>
        {aside}
      </div>
      {hint && <p className="relative mt-1.5 text-[11px] text-muted-foreground leading-snug">{hint}</p>}
      {progress !== undefined && progress !== null && (
        <div className="relative mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-[width] duration-700 ease-out", t.bar)}
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default StatCard;

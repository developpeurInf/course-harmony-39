"use client";

/**
 * Ruban des Outils Office (Word / Excel / PowerPoint) : onglets, groupes,
 * grands et petits boutons, listes, nuancier de couleurs.
 */
import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface OfficeTab {
  id: string;
  label: string;
  /** onglet contextuel (ex. « Tableau » quand le curseur est dans un tableau) */
  contextual?: boolean;
}

export function RibbonTabStrip({
  tabs, value, onChange, onFile, fileLabel, accent, end,
}: {
  tabs: OfficeTab[];
  value: string;
  onChange: (id: string) => void;
  onFile: () => void;
  fileLabel: string;
  accent: string;
  end?: ReactNode;
}) {
  return (
    <div className="flex items-end gap-1 border-b bg-card px-1 sm:px-2">
      <div role="tablist" className="-mb-px flex min-w-0 flex-1 items-end overflow-x-auto [scrollbar-width:none]">
        <button
          type="button"
          onClick={onFile}
          className="me-1 mb-1 h-8 shrink-0 rounded-md px-3 text-[13px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          style={{ background: accent }}
        >
          {fileLabel}
        </button>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={value === tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative h-10 shrink-0 whitespace-nowrap px-3 text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              value === tab.id ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground",
              tab.contextual && "text-[color:var(--office-accent)]"
            )}
          >
            {tab.label}
            {value === tab.id && <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-full" style={{ background: accent }} />}
          </button>
        ))}
      </div>
      {end && <div className="flex shrink-0 items-center gap-1 py-1">{end}</div>}
    </div>
  );
}

export function RibbonBody({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[92px] items-stretch overflow-x-auto overflow-y-hidden border-b bg-card px-1 py-1 [scrollbar-width:thin]">
      {children}
    </div>
  );
}

export function RGroup({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex shrink-0 flex-col border-e px-1.5 last:border-e-0", className)}>
      <div className="flex flex-1 items-start gap-0.5">{children}</div>
      <div className="truncate pt-0.5 text-center text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

/** Colonne de petites lignes de commandes dans un groupe */
export function RStack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-0.5", className)}>{children}</div>;
}
export function RRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex items-center gap-0.5", className)}>{children}</div>;
}

interface BtnProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  iconClassName?: string;
  iconStyle?: React.CSSProperties;
}

export function BigBtn({ icon: Icon, label, onClick, active, disabled, title, iconClassName, menu }: BtnProps & { menu?: boolean }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title || label}
      aria-pressed={active || undefined}
      className={cn(
        "flex h-[66px] min-w-[52px] max-w-[84px] flex-col items-center justify-start gap-1 rounded-md px-1.5 pt-1.5 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40",
        active ? "bg-[color:var(--office-accent-soft)] text-foreground ring-1 ring-[color:var(--office-accent)]/40" : "text-foreground hover:bg-muted"
      )}
    >
      <Icon className={cn("h-6 w-6 shrink-0 text-[color:var(--office-accent)]", iconClassName)} strokeWidth={1.5} />
      <span className="line-clamp-2 text-[11px] leading-tight">
        {label}
        {menu && <ChevronDown className="ms-0.5 inline h-3 w-3 text-muted-foreground" />}
      </span>
    </button>
  );
}

export function SmallBtn({ icon: Icon, label, onClick, active, disabled, title, iconClassName, iconStyle, withLabel }: BtnProps & { withLabel?: boolean }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title || label}
      aria-label={label}
      aria-pressed={active || undefined}
      className={cn(
        "flex h-7 shrink-0 items-center gap-1.5 rounded px-1.5 text-[12px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40",
        withLabel ? "" : "w-7 justify-center",
        active ? "bg-[color:var(--office-accent-soft)] ring-1 ring-[color:var(--office-accent)]/40" : "hover:bg-muted"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0 text-foreground/80", iconClassName)} style={iconStyle} strokeWidth={1.75} />
      {withLabel && <span className="whitespace-nowrap">{label}</span>}
    </button>
  );
}

/** Bouton qui ouvre un panneau (galerie, nuancier, grille de tableau…) */
export function RMenu({
  trigger, children, big, label, icon, title, align = "start", width = 240, open: openProp, onOpenChange,
}: {
  trigger?: ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  big?: boolean;
  label: string;
  icon?: LucideIcon;
  title?: string;
  align?: "start" | "center" | "end";
  width?: number;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const [own, setOwn] = useState(false);
  const open = openProp ?? own;
  const setOpen = onOpenChange ?? setOwn;
  const close = () => setOpen(false);
  const Icon = icon;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ? (
          <span className="inline-flex">{trigger}</span>
        ) : big && Icon ? (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            title={title || label}
            className="flex h-[66px] min-w-[52px] max-w-[84px] flex-col items-center justify-start gap-1 rounded-md px-1.5 pt-1.5 text-center hover:bg-muted"
          >
            <Icon className="h-6 w-6 shrink-0 text-[color:var(--office-accent)]" strokeWidth={1.5} />
            <span className="line-clamp-2 text-[11px] leading-tight">
              {label}
              <ChevronDown className="ms-0.5 inline h-3 w-3 text-muted-foreground" />
            </span>
          </button>
        ) : (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            title={title || label}
            aria-label={label}
            className={cn("flex h-7 shrink-0 items-center gap-0.5 rounded text-[12px] hover:bg-muted", Icon ? "px-1" : "w-4 justify-center")}
          >
            {Icon && <Icon className="h-4 w-4 text-foreground/80" strokeWidth={1.75} />}
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="max-h-[70vh] overflow-y-auto p-2"
        style={{ width }}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {typeof children === "function" ? children(close) : children}
      </PopoverContent>
    </Popover>
  );
}

/** Élément de liste dans un menu de ruban */
export function MenuItem({ icon: Icon, label, onClick, hint, active }: { icon?: LucideIcon; label: ReactNode; onClick: () => void; hint?: string; active?: boolean }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-[13px] hover:bg-muted", active && "bg-muted font-medium")}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </button>
  );
}

/** Liste déroulante compacte (police, taille…) */
export function RSelect({
  value, onChange, options, width = 120, title, editable,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; style?: React.CSSProperties }[];
  width?: number;
  title: string;
  editable?: boolean;
}) {
  if (editable) {
    const id = `dl-${title.replace(/\W/g, "")}`;
    return (
      <>
        <input
          list={id}
          title={title}
          aria-label={title}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className="h-7 rounded border bg-background px-1.5 text-[12px] focus:outline-none focus:ring-1 focus:ring-[color:var(--office-accent)]"
          style={{ width }}
        />
        <datalist id={id}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </datalist>
      </>
    );
  }
  return (
    <select
      title={title}
      aria-label={title}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 rounded border bg-background px-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-[color:var(--office-accent)]"
      style={{ width }}
    >
      {!options.some((o) => o.value === value) && <option value={value}>{value || "—"}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value} style={o.style}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ---------- Couleurs ----------
const THEME_BASE = ["#FFFFFF", "#000000", "#E7E6E6", "#44546A", "#4472C4", "#ED7D31", "#A5A5A5", "#FFC000", "#5B9BD5", "#70AD47"];
const STANDARD = ["#C00000", "#FF0000", "#FFC000", "#FFFF00", "#92D050", "#00B050", "#00B0F0", "#0070C0", "#002060", "#7030A0"];

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt > 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  const h = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

export function ColorPalette({ onPick, noneLabel, onNone, customLabel }: { onPick: (c: string) => void; noneLabel?: string; onNone?: () => void; customLabel: string }) {
  const rows = [0.8, 0.6, 0.4, -0.25, -0.5];
  return (
    <div className="space-y-1.5">
      {onNone && (
        <button type="button" onClick={onNone} className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-[12px] hover:bg-muted">
          <span className="h-4 w-4 rounded border bg-[linear-gradient(135deg,transparent_45%,red_45%,red_55%,transparent_55%)]" />
          {noneLabel}
        </button>
      )}
      <div className="grid grid-cols-10 gap-[3px]">
        {THEME_BASE.map((c) => <Swatch key={c} c={c} onPick={onPick} />)}
      </div>
      <div className="grid grid-cols-10 gap-[3px]">
        {rows.flatMap((amt) => THEME_BASE.map((c) => <Swatch key={c + amt} c={shade(c, c === "#FFFFFF" ? -Math.abs(amt) / 2 - 0.05 : c === "#000000" ? Math.abs(amt) : amt)} onPick={onPick} />))}
      </div>
      <div className="grid grid-cols-10 gap-[3px] pt-1">
        {STANDARD.map((c) => <Swatch key={c} c={c} onPick={onPick} />)}
      </div>
      <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[12px] hover:bg-muted">
        <input type="color" className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" onChange={(e) => onPick(e.target.value)} />
        {customLabel}
      </label>
    </div>
  );
}

function Swatch({ c, onPick }: { c: string; onPick: (c: string) => void }) {
  return (
    <button
      type="button"
      title={c}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPick(c)}
      className="h-[18px] w-[18px] rounded-[2px] border border-black/15 transition-transform hover:scale-125 dark:border-white/20"
      style={{ background: c }}
    />
  );
}

/** Bouton couleur (A souligné, surligneur, remplissage…) avec barre de la dernière couleur */
export function ColorButton({
  icon: Icon, label, color, onApply, noneLabel, onNone, customLabel,
}: {
  icon: LucideIcon;
  label: string;
  color: string;
  onApply: (c: string) => void;
  noneLabel?: string;
  onNone?: () => void;
  customLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center">
      <button
        type="button"
        title={label}
        aria-label={label}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onApply(color)}
        className="flex h-7 w-7 flex-col items-center justify-center rounded-s hover:bg-muted"
      >
        <Icon className="h-[15px] w-[15px] text-foreground/80" strokeWidth={1.75} />
        <span className="mt-[1px] h-[3px] w-4 rounded-sm" style={{ background: color }} />
      </button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" onMouseDown={(e) => e.preventDefault()} aria-label={label} className="flex h-7 w-3.5 items-center justify-center rounded-e hover:bg-muted">
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[236px] p-2" onOpenAutoFocus={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()}>
          <ColorPalette
            customLabel={customLabel}
            noneLabel={noneLabel}
            onNone={onNone ? () => { onNone(); setOpen(false); } : undefined}
            onPick={(c) => { onApply(c); setOpen(false); }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

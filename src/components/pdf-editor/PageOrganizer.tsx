import { useState } from "react";
import { Loader2, RotateCcw, RotateCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Tr = (fr: string, ar: string, en: string) => string;

interface Props {
  thumbnails: string[];
  loading: boolean;
  selected: Set<number>;
  onSelectionChange: (next: Set<number>) => void;
  /** déplacement d'un groupe de pages : nouvel ordre complet (index d'origine) */
  onReorder: (order: number[]) => void;
  onRotate: (indices: number[], delta: number) => void;
  onDelete: (indices: number[]) => void;
  busy: boolean;
  t: Tr;
}

/** Vue « Organiser les pages » : grille de miniatures, sélection multiple et glisser-déposer */
export default function PageOrganizer({ thumbnails, loading, selected, onSelectionChange, onReorder, onRotate, onDelete, busy, t }: Props) {
  const [anchor, setAnchor] = useState<number | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);

  const click = (i: number, e: React.MouseEvent) => {
    const next = new Set(e.metaKey || e.ctrlKey ? selected : []);
    if (e.shiftKey && anchor !== null) {
      const [a, b] = anchor < i ? [anchor, i] : [i, anchor];
      for (let k = a; k <= b; k++) next.add(k);
    } else if ((e.metaKey || e.ctrlKey) && selected.has(i)) {
      next.delete(i);
    } else {
      next.add(i);
      setAnchor(i);
    }
    onSelectionChange(next);
  };

  const drop = (target: number) => {
    if (dragFrom === null) return;
    const moving = selected.has(dragFrom) ? [...selected].sort((a, b) => a - b) : [dragFrom];
    const rest = thumbnails.map((_, i) => i).filter((i) => !moving.includes(i));
    // position d'insertion parmi les pages restantes
    const before = thumbnails.map((_, i) => i).slice(0, target).filter((i) => !moving.includes(i)).length;
    const order = [...rest.slice(0, before), ...moving, ...rest.slice(before)];
    setDragFrom(null);
    setDropAt(null);
    if (order.some((v, k) => v !== k)) onReorder(order);
  };

  if (loading && !thumbnails.length) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("Préparation des pages…", "جارٍ تحضير الصفحات…", "Preparing pages…")}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-muted" onClick={(e) => e.target === e.currentTarget && onSelectionChange(new Set())}>
      <div className="flex items-center justify-between px-5 pt-4 text-xs text-muted-foreground">
        <span>
          {selected.size
            ? t(`${selected.size} page(s) sélectionnée(s)`, `${selected.size} صفحة محددة`, `${selected.size} page(s) selected`)
            : t("Cliquez pour sélectionner, Maj ou Ctrl pour plusieurs. Glissez pour déplacer.", "انقر للتحديد، Shift أو Ctrl لعدة صفحات. اسحب للنقل.", "Click to select, Shift or Ctrl for several. Drag to move.")}
        </span>
        {thumbnails.length > 0 && (
          <button type="button" className="hover:text-foreground" onClick={() => onSelectionChange(new Set(thumbnails.map((_, i) => i)))}>
            {t("Tout sélectionner", "تحديد الكل", "Select all")}
          </button>
        )}
      </div>
      <div
        className={cn("grid gap-x-4 gap-y-5 p-5 [grid-template-columns:repeat(auto-fill,minmax(132px,1fr))]", busy && "pointer-events-none opacity-60")}
        onClick={(e) => e.target === e.currentTarget && onSelectionChange(new Set())}
      >
        {thumbnails.map((src, i) => {
          const isSel = selected.has(i);
          return (
            <div
              key={src}
              draggable
              onDragStart={(e) => {
                setDragFrom(i);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => {
                setDragFrom(null);
                setDropAt(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setDropAt(e.clientX < r.left + r.width / 2 ? i : i + 1);
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(dropAt ?? i);
              }}
              className="group relative flex flex-col items-center"
            >
              {dropAt === i && dragFrom !== null && <span className="absolute -start-2.5 top-0 h-full w-0.5 rounded-full bg-primary" />}
              {dropAt === i + 1 && dragFrom !== null && <span className="absolute -end-2.5 top-0 h-full w-0.5 rounded-full bg-primary" />}
              <button
                type="button"
                onClick={(e) => click(i, e)}
                className={cn(
                  "relative flex w-full items-center justify-center rounded-md border bg-card p-1.5 shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSel ? "border-primary ring-2 ring-primary/30" : "hover:border-foreground/25",
                  dragFrom === i && "opacity-40"
                )}
              >
                <img src={src} alt="" className="max-h-[180px] w-auto max-w-full bg-white object-contain" draggable={false} />
              </button>
              <div className="pointer-events-none absolute end-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                {[
                  { icon: RotateCcw, label: t("Pivoter à gauche", "تدوير لليسار", "Rotate left"), run: () => onRotate([i], -90) },
                  { icon: RotateCw, label: t("Pivoter à droite", "تدوير لليمين", "Rotate right"), run: () => onRotate([i], 90) },
                  { icon: Trash2, label: t("Supprimer", "حذف", "Delete"), run: () => onDelete([i]) },
                ].map(({ icon: Icon, label, run }) => (
                  <button
                    key={label}
                    type="button"
                    title={label}
                    aria-label={label}
                    onClick={run}
                    className="flex h-7 w-7 items-center justify-center rounded-md border bg-card text-muted-foreground shadow-sm hover:text-foreground"
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
              <span className={cn("mt-1.5 text-xs tabular-nums", isSel ? "font-medium text-primary" : "text-muted-foreground")}>{i + 1}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

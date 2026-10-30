/**
 * Avancement d'une génération IA : barre, secondes écoulées et étapes cochées.
 * L'avancement est estimé d'après le temps écoulé (la fonction teacher-ai répond en une fois) :
 * la barre tend vers 95 % autour de la durée attendue, puis passe à 100 % à la réception.
 */
import { useEffect, useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Secondes écoulées depuis startedAt (null = arrêté) */
export function useElapsed(startedAt: number | null) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    setElapsed(0);
    const id = window.setInterval(() => setElapsed((Date.now() - startedAt) / 1000), 250);
    return () => window.clearInterval(id);
  }, [startedAt]);
  return elapsed;
}

export function AiProgress({
  elapsed, finishing, expected, title, stages, note, lateLabel, className,
}: {
  elapsed: number;
  finishing: boolean;
  /** durée attendue en secondes */
  expected: number;
  title: string;
  /** étapes, avec le pourcentage à partir duquel chacune commence */
  stages: { at: number; label: string }[];
  note?: string;
  lateLabel?: string;
  className?: string;
}) {
  const pct = finishing ? 100 : Math.min(95, Math.round(95 * (1 - Math.exp((-2.3 * elapsed) / expected))));
  const current = stages.reduce((acc, s, i) => (pct >= s.at ? i : acc), 0);
  return (
    <div className={cn("mx-auto flex max-w-md flex-col gap-4 py-12", className)}>
      <div className="flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4 text-violet-500" />{title}</div>
      <div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div className="h-full rounded-full bg-violet-500 transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>{pct} %</span>
          <span>{Math.floor(elapsed)} s{!finishing && elapsed > expected && lateLabel ? ` · ${lateLabel}` : ""}</span>
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        {stages.map((s, i) => (
          <li key={i} className={cn("flex items-center gap-2", i > current && "text-muted-foreground/60")}>
            {i < current ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : i === current ? (
              <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
            ) : (
              <span className="inline-block h-4 w-4 rounded-full border" />
            )}
            {s.label}
          </li>
        ))}
      </ul>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

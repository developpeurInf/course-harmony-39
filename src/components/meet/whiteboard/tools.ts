import { useCallback, useState } from "react";
import type { ShapeKind } from "./model";

export type Tool = "select" | "pan" | "pen" | "highlighter" | "eraser" | "laser" | "shape" | "text" | "note";

export interface ToolState {
  tool: Tool;
  color: string;
  hlColor: string;
  noteColor: string;
  pen: number;
  hl: number;
  shape: ShapeKind;
  fill: boolean;
  dash: boolean;
  /** formes intelligentes : un trait à main levée devient une forme propre */
  smart: boolean;
  /** encre éphémère : disparaît après quelques secondes */
  ephemeral: boolean;
}

export const INK_COLORS = ["fg", "#e11d48", "#f97316", "#eab308", "#16a34a", "#0ea5e9", "#2563eb", "#7c3aed", "#db2777", "#78716c"];
export const HL_COLORS = ["#facc15", "#4ade80", "#38bdf8", "#f472b6", "#fb923c"];
export const NOTE_COLORS = ["#fde68a", "#fbcfe8", "#bfdbfe", "#bbf7d0", "#fed7aa", "#ddd6fe"];
export const PEN_SIZES = [2, 4, 7, 12, 20];
export const HL_SIZES = [12, 20, 32];

const DEFAULT: ToolState = {
  tool: "pen",
  color: "fg",
  hlColor: "#facc15",
  noteColor: "#fde68a",
  pen: 4,
  hl: 20,
  shape: "rect",
  fill: false,
  dash: false,
  smart: false,
  ephemeral: false,
};


/** Préférences d'outils (mémorisées sur l'appareil) */
export function useTools(scope: "board" | "screen") {
  const KEY = `wb-tools-${scope}-v1`;
  const [s, set] = useState<ToolState>(() => {
    let saved: Partial<ToolState> = {};
    try {
      saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    } catch {
      /* stockage indisponible */
    }
    return { ...DEFAULT, ...(scope === "screen" ? { color: "#e11d48", pen: 4 } : {}), ...saved, ...(scope === "screen" && ["pan", "note"].includes(saved.tool as string) ? { tool: "pen" as Tool } : {}) };
  });
  const update = useCallback((p: Partial<ToolState>) => {
    set(prev => {
      const next = { ...prev, ...p };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [KEY]);
  return [s, update] as const;
}

/**
 * Petits événements entre les nœuds du document (double-clic sur une équation,
 * un tableau de variations, une figure GeoGebra) et les fenêtres de l'éditeur Word.
 */
export interface EquationEvent { latex: string; display: boolean; pos?: number }
export interface VarTableEvent { data: string; pos: number }

export const EQ_EVENT = "word-math:equation";
export const VT_EVENT = "word-math:vartable";

export function openEquationEditor(detail: EquationEvent) {
  window.dispatchEvent(new CustomEvent<EquationEvent>(EQ_EVENT, { detail }));
}
export function openVarTableEditor(detail: VarTableEvent) {
  window.dispatchEvent(new CustomEvent<VarTableEvent>(VT_EVENT, { detail }));
}

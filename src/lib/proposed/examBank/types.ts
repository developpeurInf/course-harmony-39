/** Banque d'exercices d'exam : chaque exercice est rattaché à un chapitre du catalogue (id fixe). */
export interface BankQuestion {
  /** énoncé de la question (HTML, formules $…$ / $$…$$) */
  q: string;
  /** poids relatif : les points réels sont calculés pour que l'exam soit sur 20 */
  w: number;
  /** corrigé détaillé de la question (HTML, formules) */
  s: string;
}
export interface BankExercise {
  id: string;
  /** id du chapitre dans le catalogue, ex. "1bac-math-3" */
  chapter: string;
  title: string;
  /** texte avant les questions (données, figure…) */
  intro?: string;
  questions: BankQuestion[];
  /** "ds" : seulement en devoir surveillé, "dm" : seulement en devoir maison */
  only?: "ds" | "dm";
}

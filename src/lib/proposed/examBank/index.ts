import type { BankExercise } from "./types";
import type { LevelKey, SubjectKey } from "../catalog";
import { MATH_1BAC_BANK } from "./math1bac";

const BANKS: Partial<Record<LevelKey, Partial<Record<SubjectKey, BankExercise[]>>>> = {
  "1bac": { math: MATH_1BAC_BANK },
};

export const bankFor = (level?: LevelKey | "" | null, subject?: SubjectKey | "" | null): BankExercise[] =>
  (level && subject && BANKS[level]?.[subject]) || [];

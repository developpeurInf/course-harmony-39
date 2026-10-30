/**
 * Recherche tolérante (accents, majuscules, variantes arabes) pour les listes
 * de cours, exercices, examens et élèves.
 */

/** Normalise un texte : minuscules, sans accents, formes arabes unifiées */
export function normalizeSearch(text: string | null | undefined): string {
  let s = String(text || "").toLowerCase();
  try {
    s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  } catch {
    /* navigateur sans normalize : on garde le texte tel quel */
  }
  return s
    .replace(/[ً-ٰٟـ]/g, "") // voyelles et tatweel arabes
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}\s@._-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const tokens = (s: string) => normalizeSearch(s).split(" ").filter(Boolean);

/** Vrai si chaque mot de la recherche apparaît dans au moins un des champs */
export function matchesText(query: string, ...fields: Array<string | null | undefined>): boolean {
  const q = tokens(query);
  if (!q.length) return true;
  const hay = normalizeSearch(fields.filter(Boolean).join(" "));
  return q.every((w) => hay.includes(w));
}

export type StudentSearchMode = "all" | "lastName" | "firstName" | "fullName" | "massar";

export interface SearchableStudent {
  name?: string | null;
  username?: string | null;
  email?: string | null;
}

/**
 * Le nom complet est enregistré « Prénom Nom » (import Excel / création).
 * Prénom = premier mot, Nom = le reste.
 */
export function splitStudentName(fullName: string | null | undefined): { firstName: string; lastName: string } {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || "", lastName: parts[0] || "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/** Code Massar = identifiant de connexion (username), sinon partie avant @ de l'e-mail */
export function studentMassar(s: SearchableStudent): string {
  if (s.username) return s.username;
  const email = s.email || "";
  return email.endsWith("@student.internal") ? email.split("@")[0] : "";
}

export function matchesStudent(student: SearchableStudent, query: string, mode: StudentSearchMode = "all"): boolean {
  const q = tokens(query);
  if (!q.length) return true;
  const { firstName, lastName } = splitStudentName(student.name);
  const massar = normalizeSearch(studentMassar(student));
  const nameTokens = tokens(student.name || "");
  const qJoined = q.join(" ");

  const fullName = () => q.every((w) => nameTokens.some((t) => t.includes(w)));
  switch (mode) {
    case "firstName":
      return normalizeSearch(firstName).includes(qJoined);
    case "lastName":
      return normalizeSearch(lastName).includes(qJoined);
    case "fullName":
      return fullName();
    case "massar":
      return massar.includes(qJoined.replace(/\s+/g, ""));
    case "all":
    default:
      return (
        fullName() ||
        massar.includes(qJoined.replace(/\s+/g, "")) ||
        normalizeSearch(student.email || "").includes(qJoined)
      );
  }
}

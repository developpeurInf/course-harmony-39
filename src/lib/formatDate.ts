/** Formatage des dates selon la langue de l'interface (fr / ar / en). */
export type AppLanguage = "fr" | "ar" | "en" | string;

export function localeFor(language: AppLanguage): string {
  return language === "ar" ? "ar-MA" : language === "fr" ? "fr-FR" : "en-GB";
}

export function formatDate(
  date: string | number | Date | null | undefined,
  language: AppLanguage,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }
): string {
  if (date === null || date === undefined || date === "") return "—";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "—";
  try {
    return d.toLocaleDateString(localeFor(language), options);
  } catch {
    return d.toDateString();
  }
}

export function formatDateTime(
  date: string | number | Date | null | undefined,
  language: AppLanguage,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }
): string {
  if (date === null || date === undefined || date === "") return "—";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "—";
  try {
    return d.toLocaleString(localeFor(language), options);
  } catch {
    return d.toString();
  }
}

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

/** Date locale au format « yyyy-MM-dd » (pour <input type="date">), sans passer par l'UTC. */
export function toLocalDateInput(date: string | number | Date | null | undefined): string {
  if (date === null || date === undefined || date === "") return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Heure locale « HH:mm » (pour <input type="time">). */
export function toLocalTimeInput(date: string | number | Date | null | undefined): string {
  if (date === null || date === undefined || date === "") return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * « yyyy-MM-dd » (date locale) → ISO de la fin de journée locale (23:59:59).
 * Construction par composants : Safari 12 lit « AAAA-MM-JJTHH:mm:ss » comme de l'UTC.
 */
export function localEndOfDayIso(dateInput: string): string | null {
  if (!dateInput) return null;
  const [y, m, d] = dateInput.split("-").map(Number);
  if (![y, m, d].every(n => Number.isFinite(n))) return null;
  return new Date(y, m - 1, d, 23, 59, 59).toISOString();
}

/** Nombre décimal avec le séparateur de la langue (virgule en fr/ar, point en en). */
export function formatDecimal(value: number, language: AppLanguage, digits = 1): string {
  const rounded = Math.round(value * Math.pow(10, digits)) / Math.pow(10, digits);
  const s = String(rounded);
  return language === "en" ? s : s.replace(".", ",");
}

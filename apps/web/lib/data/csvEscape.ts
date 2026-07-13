/**
 * Canonical CSV field escaping for every CSV the app generates: quote a value containing
 * a double quote, comma, or line break (\n or \r), doubling embedded quotes; null renders
 * as an empty field. Kept dependency-free so client-side exports can import it too.
 */
export function csvEscape(value: string | number | boolean | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

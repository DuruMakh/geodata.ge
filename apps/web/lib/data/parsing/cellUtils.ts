export type MatrixCell = string | number | boolean | null | undefined;

export function cellText(value: MatrixCell): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

export type NumericCellOptions = {
  /**
   * Remove every whitespace character (including non-breaking spaces) before parsing,
   * so values such as "1 000" or "1 234.5" parse as numbers.
   * Defaults to false (the historical realExpenditure behavior).
   */
  stripWhitespace?: boolean;
  /**
   * How a trailing percent sign is treated:
   * - "strip" (default): "101.6%" parses to 101.6 (historical expenditure behavior).
   * - "fraction": "99%" parses to 0.99 (historical realRevenue behavior).
   */
  percentMode?: "strip" | "fraction";
};

export function numericCell(value: MatrixCell, options: NumericCellOptions = {}): number | null {
  if (value === null || value === undefined || value === "") return null;

  let normalized = String(value).replaceAll(",", "");
  // \s matches regular whitespace and non-breaking spaces ( ) alike.
  if (options.stripWhitespace) normalized = normalized.replace(/\s+/g, "");

  const isPercent = normalized.endsWith("%");
  if (isPercent) normalized = normalized.slice(0, -1);

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;

  return isPercent && options.percentMode === "fraction" ? parsed / 100 : parsed;
}

export function normalizeSheetName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export type PickSheetNameOptions = {
  /** Exact (normalized) sheet names to try first, in order. */
  preferredNames?: string[];
  /** Fallback predicate applied to each normalized sheet name after preferred names fail. */
  fallbackPattern?: (normalizedSheetName: string) => boolean;
  /** When true, fall back to the first sheet instead of throwing (historical adminSpending behavior). */
  defaultToFirstSheet?: boolean;
  /** Human-readable description used in the thrown error, e.g. "tavi 6 sheet". */
  sheetDescription?: string;
};

export function pickSheetName(
  workbook: { SheetNames: string[] },
  options: PickSheetNameOptions,
): string {
  const available = workbook.SheetNames;
  const availableByNormalized = new Map(available.map((name) => [normalizeSheetName(name), name]));

  for (const preferred of options.preferredNames ?? []) {
    const matched = availableByNormalized.get(normalizeSheetName(preferred));
    if (matched) return matched;
  }

  if (options.fallbackPattern) {
    const candidate = available.find((name) => options.fallbackPattern?.(normalizeSheetName(name)));
    if (candidate) return candidate;
  }

  if (options.defaultToFirstSheet) return available[0];

  throw new Error(
    `Could not find ${options.sheetDescription ?? "sheet"}. Available sheets: ${available.join(", ")}`,
  );
}

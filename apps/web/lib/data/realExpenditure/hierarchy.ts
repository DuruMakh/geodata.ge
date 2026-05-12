export function normalizeOfficialCode(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().replace(/\s+/g, " ");
  return normalized.length === 0 ? null : normalized;
}

export function codeDepth(code: string): number {
  const normalized = normalizeOfficialCode(code);
  if (!normalized || normalized === "00 00") return 0;
  const parts = normalized.split(" ");
  if (parts.length === 2 && parts[1] === "00") return 1;
  return parts.length;
}

export function parentCodeFor(code: string): string | null {
  const normalized = normalizeOfficialCode(code);
  if (!normalized || normalized === "00 00") return null;
  const parts = normalized.split(" ");

  if (parts.length === 2) {
    return parts[1] === "00" ? "00 00" : `${parts[0]} 00`;
  }
  if (parts.length === 3) return `${parts[0]} ${parts[1]}`;
  return parts.slice(0, -1).join(" ");
}

export function ancestorCodesFor(code: string): string[] {
  const ancestors: string[] = [];
  let current = parentCodeFor(code);

  while (current && current !== "00 00") {
    ancestors.unshift(current);
    current = parentCodeFor(current);
  }

  return ancestors;
}

export function findLeafCodes(codes: string[]): string[] {
  const normalizedCodes = Array.from(
    new Set(codes.map(normalizeOfficialCode).filter((code): code is string => Boolean(code))),
  );
  const ancestorCodes = new Set(normalizedCodes.flatMap(ancestorCodesFor));

  return normalizedCodes
    .filter((code) => code !== "00 00")
    .filter((code) => !ancestorCodes.has(code))
    .sort((a, b) => a.localeCompare(b));
}

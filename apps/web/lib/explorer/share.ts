// One definition of "this value's share of that total", used by every section
// that renders a share column. A served zero is a real zero share; a missing
// value or a missing or zero total has no share at all.
export function shareOfTotal(
  value: number | null | undefined,
  total: number | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  if (total === null || total === undefined || total === 0) return null;
  return value / total;
}

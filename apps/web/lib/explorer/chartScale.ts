// Shared y-axis scale helpers for the bespoke SVG charts (DESIGN.md §8.3).

/** The rounded top of a domain: the raw maximum plus 12% headroom, snapped to 1, 2, 2.5, 5 or 10 × 10ⁿ. */
export function niceMax(rawMax: number): number {
  const raw = rawMax * 1.12;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

/**
 * Smallest decimal count (up to max) that renders the gridline step exactly,
 * so axis labels are never rounded into duplicates ("0.3" for a 0.25 step).
 */
export function decimalsFor(step: number, max: number): number {
  for (let digits = 0; digits <= max; digits += 1) {
    const scaled = step * 10 ** digits;
    if (Math.abs(Math.round(scaled) - scaled) < 1e-6) return digits;
  }
  return max;
}

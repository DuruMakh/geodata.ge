// Shared y-axis scale helpers for the bespoke SVG charts (DESIGN.md §8.3).

/** The rounded top of a domain: the raw maximum plus 12% headroom, snapped to 1, 2, 2.5, 5 or 10 × 10ⁿ. */
export function niceMax(rawMax: number): number {
  const raw = rawMax * 1.12;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

// Advance widths in em of the chart's numeric face (`--font-numeric`): Geist Mono
// sets every Latin character, digit, separator and the "−" sign at 0.6 em, and
// Georgian falls back to Noto Sans Georgian, which is proportional. Measured in
// the browser with getComputedTextLength at 11px. The wide letters are listed;
// the rest of the script sits at or under 0.62 em.
const MONO_EM = 0.6;
const GEORGIAN_EM = 0.62;
const WIDE_EM: Record<string, number> = { "₾": 1.07, ლ: 1.09, დ: 0.89, თ: 0.89, ფ: 0.86, ო: 0.81, ღ: 0.81, რ: 0.81, ტ: 0.77, ც: 0.67 };
// Anything this table does not know (a fallback glyph) is estimated wide, so the
// error is spare room rather than a clipped digit.
const UNKNOWN_EM = 1.1;

/**
 * Estimated rendered width of a mono axis label, in SVG user units. Deterministic
 * (no DOM measuring) so the server render and the client agree on the layout.
 */
export function axisLabelWidth(label: string, fontSize = 11): number {
  let em = 0;
  for (const char of label) {
    if (WIDE_EM[char] !== undefined) em += WIDE_EM[char];
    else if (char <= "\u007f" || char === "−" || char === "€") em += MONO_EM;
    else if (char >= "ა" && char <= "ჿ") em += GEORGIAN_EM;
    else em += UNKNOWN_EM;
  }
  return em * fontSize;
}

/** Room between a right-aligned y label and the plot edge it sits against. */
export const AXIS_LABEL_GAP = 10;

/**
 * Left padding that keeps every right-aligned y label inside the viewBox (DESIGN.md
 * §8.3: labels never clip). Never below `minimum`, so short axes keep the house layout.
 */
export function axisLeftPaddingFor(labels: readonly string[], minimum: number, fontSize = 11): number {
  let widest = 0;
  for (const label of labels) widest = Math.max(widest, axisLabelWidth(label, fontSize));
  return Math.max(minimum, Math.ceil(widest + AXIS_LABEL_GAP + 4));
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

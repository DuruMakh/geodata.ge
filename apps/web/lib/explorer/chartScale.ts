// Shared y-axis scale helpers for the bespoke SVG charts (DESIGN.md §8.3).

export type NiceScale = { top: number; bottom: number; step: number };

const HEADROOM = 1.05;
const NICE_MULTIPLIERS = [1, 2, 2.5, 5];
// 4–7 gridline intervals: enough labels to read a value against, and at 7 the
// lattice's three rows per step still clear its 12-unit density floor.
const MIN_INTERVALS = 4;
const MAX_INTERVALS = 7;

/**
 * The y domain of a chart: one gridline step shared by both sides of zero, so 0
 * always sits on a gridline (DESIGN.md §8.3), with the top and bottom the first
 * gridlines past the data plus 5% headroom. The step is chosen, not derived from
 * a snapped maximum: snapping the top to 1/2/2.5/5/10 first put a 27.7 series
 * under a 50 axis and a −45% low over a −100% floor.
 *
 * `quantum`, when given, is the smallest step the axis can print (an amount
 * unit's last decimal); steps that are not a whole multiple of it are skipped,
 * so the debt axis reads 0/10/20 rather than 0/13/26.
 */
export function niceScale(minValue: number, maxValue: number, quantum = 0): NiceScale {
  const high = Math.max(0, maxValue) * HEADROOM;
  const low = Math.max(0, -minValue) * HEADROOM;
  const extent = Math.max(high, low) || 1;
  const exponent = Math.floor(Math.log10(extent));
  const lastPower = Math.max(exponent + 1, quantum > 0 ? Math.ceil(Math.log10(quantum)) : -Infinity);

  const candidates: Array<NiceScale & { intervals: number; digits: number }> = [];
  for (let power = exponent - 2; power <= lastPower; power += 1) {
    for (const multiplier of NICE_MULTIPLIERS) {
      const step = multiplier * 10 ** power;
      if (quantum > 0) {
        const ratio = step / quantum;
        if (ratio < 1 - 1e-9 || Math.abs(ratio - Math.round(ratio)) > 1e-6) continue;
      }
      const top = high > 0 ? Math.ceil(high / step - 1e-9) * step : 0;
      const bottom = low > 0 ? -Math.ceil(low / step - 1e-9) * step : 0;
      const intervals = Math.round((top - bottom) / step);
      if (intervals < 1) continue;
      candidates.push({ top, bottom, step, intervals, digits: decimalsFor(step, 6) });
    }
  }

  const inRange = candidates.filter((option) => option.intervals >= MIN_INTERVALS && option.intervals <= MAX_INTERVALS);
  // Spans are float products (3 × 0.1), so equal spans can differ in the last bit.
  const spanOrder = (a: NiceScale, b: NiceScale) => {
    const difference = a.top - a.bottom - (b.top - b.bottom);
    return Math.abs(difference) <= extent * 1e-9 ? 0 : difference;
  };
  const pick = inRange.length > 0
    // Tightest domain first; then the rounder step; then fewer gridlines.
    ? inRange.sort((a, b) => spanOrder(a, b) || a.digits - b.digits || a.intervals - b.intervals)[0]!
    // A quantum can leave no step fine enough for four intervals (a 0.9 mln
    // series printed in whole millions): take the finest step it allows.
    : candidates.filter((option) => option.intervals <= MAX_INTERVALS).sort((a, b) => a.step - b.step)[0]!;
  return { top: pick.top, bottom: pick.bottom, step: pick.step };
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
 * The 8-unit cushion absorbs glyph-width differences between platforms' font rendering
 * (Linux Chromium draws some labels ~1 unit wider than the estimate).
 */
export function axisLeftPaddingFor(labels: readonly string[], minimum: number, fontSize = 11): number {
  let widest = 0;
  for (const label of labels) widest = Math.max(widest, axisLabelWidth(label, fontSize));
  return Math.max(minimum, Math.ceil(widest + AXIS_LABEL_GAP + 8));
}

/**
 * The x positions that carry a label on a chart drawn at phone width (DESIGN.md
 * §8.3, narrow screens): always the first and the latest period, then every
 * `stride`-th calendar anchor (each year, or each January on a monthly axis) at
 * the smallest stride where no two labels come within `gap` of each other.
 * `extent` returns a label's [left, right] edges in the chart's own units, so
 * the caller's text anchoring and the real label widths decide what collides.
 */
export function fitAxisLabels(
  count: number,
  anchors: readonly number[],
  extent: (index: number) => readonly [number, number],
  gap = 8,
): number[] {
  if (count <= 0) return [];
  const last = count - 1;
  if (last === 0) return [0];
  const clear = (a: number, b: number) => {
    const [aLeft, aRight] = extent(a);
    const [bLeft, bRight] = extent(b);
    return aRight + gap <= bLeft || bRight + gap <= aLeft;
  };
  // Two labels that cannot sit side by side: the latest one wins.
  if (!clear(0, last)) return [last];

  const ordered = [...new Set(anchors)].filter((index) => index >= 0 && index <= last).sort((a, b) => a - b);
  // When the first period is itself an anchor the stride counts from it, so a
  // label crowding it means the stride is too short; otherwise (a monthly range
  // starting mid-year) the crowding anchor is dropped. A label crowding the
  // latest one is dropped either way, as on the desktop axis.
  const aligned = ordered[0] === 0;
  for (let stride = Math.max(1, Math.ceil(ordered.length / 12)); stride <= Math.max(1, ordered.length); stride += 1) {
    const regular = ordered.filter(
      (index, position) => position % stride === 0 && index !== 0 && index !== last && clear(index, last),
    );
    if (aligned && regular.length > 0 && !clear(0, regular[0]!)) continue;
    const kept = aligned ? regular : regular.filter((index) => clear(index, 0));
    if (kept.every((index, position) => position === 0 || clear(kept[position - 1]!, index))) {
      return [0, ...kept, last];
    }
  }
  return [0, last];
}

/** Calendar anchors of a period axis: every year, or each January of a monthly one. */
export function periodAnchors(periods: readonly number[], periodsPerYear = 1): number[] {
  const all = periods.map((_, index) => index);
  if (periodsPerYear === 1) return all;
  const starts = all.filter((index) => periods[index]! % periodsPerYear === 0);
  return starts.length >= 2 ? starts : all;
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

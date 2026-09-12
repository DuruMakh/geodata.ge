// Dot lattice pitch for the line chart (DESIGN.md §8.3). The field IS the grid:
// pitch is derived from the active scale so every third row sits on a labelled
// value and every second column on a year (or, on a monthly axis, on a calendar
// boundary).

export type DotLattice = { colPitch: number; rowPitch: number; colOffset: number };

const MIN_PITCH = 12;
const COLS_PER_YEAR = 2;
const ROWS_PER_STEP = 3;
// Sub-annual axes group periods into columns at calendar boundaries: the
// shortest span, from one month to a decade, whose pitch clears the floor.
const MONTH_SPANS = [1, 3, 6, 12, 24, 60, 120];

export function buildDotLattice(input: {
  plotWidth: number;
  plotHeight: number;
  yearCount: number;
  gridStepCount: number;
  /** Periods per calendar year on the x axis; 1 (years) unless monthly. */
  periodsPerYear?: number;
  /** The first plotted period, so month columns land on calendar boundaries. */
  firstPeriod?: number;
}): DotLattice | null {
  const { plotWidth, plotHeight, yearCount, gridStepCount, periodsPerYear = 1, firstPeriod = 0 } = input;
  if (plotWidth <= 0 || plotHeight <= 0 || yearCount <= 1 || gridStepCount <= 0) return null;

  const yearPitch = plotWidth / (yearCount - 1);
  const stepPitch = plotHeight / gridStepCount;

  // A dense domain (many gridline steps, or a long year axis) would turn the
  // subdivided lattice into a flat tone — fall back to one dot per interval.
  const rowPitch = stepPitch / ROWS_PER_STEP >= MIN_PITCH ? stepPitch / ROWS_PER_STEP : stepPitch;
  if (periodsPerYear === 1) {
    const colPitch = yearPitch / COLS_PER_YEAR >= MIN_PITCH ? yearPitch / COLS_PER_YEAR : yearPitch;
    return { colPitch, rowPitch, colOffset: 0 };
  }

  // On a sub-annual axis `yearCount` counts periods, so yearPitch is one period.
  const span = MONTH_SPANS.find((count) => yearPitch * count >= MIN_PITCH) ?? MONTH_SPANS.at(-1)!;
  const lead = (span - (((firstPeriod % span) + span) % span)) % span;
  return { colPitch: yearPitch * span, rowPitch, colOffset: lead * yearPitch };
}

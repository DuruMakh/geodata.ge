// Dot lattice pitch for the line chart (DESIGN.md §8.3). The field IS the grid:
// pitch is derived from the active scale so every third row sits on a labelled
// value and every second column on a year.

export type DotLattice = { colPitch: number; rowPitch: number };

const MIN_PITCH = 12;
const COLS_PER_YEAR = 2;
const ROWS_PER_STEP = 3;

export function buildDotLattice(input: {
  plotWidth: number;
  plotHeight: number;
  yearCount: number;
  gridStepCount: number;
}): DotLattice | null {
  const { plotWidth, plotHeight, yearCount, gridStepCount } = input;
  if (plotWidth <= 0 || plotHeight <= 0 || yearCount <= 1 || gridStepCount <= 0) return null;

  const yearPitch = plotWidth / (yearCount - 1);
  const stepPitch = plotHeight / gridStepCount;

  // A dense domain (many gridline steps, or a long year axis) would turn the
  // subdivided lattice into a flat tone — fall back to one dot per interval.
  const colPitch = yearPitch / COLS_PER_YEAR >= MIN_PITCH ? yearPitch / COLS_PER_YEAR : yearPitch;
  const rowPitch = stepPitch / ROWS_PER_STEP >= MIN_PITCH ? stepPitch / ROWS_PER_STEP : stepPitch;

  return { colPitch, rowPitch };
}

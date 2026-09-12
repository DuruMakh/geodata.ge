// Which x-axis positions carry a label (DESIGN.md §8.3). Years keep the original
// rule: every ceil(n/12)-th year plus the last, dropping a regular label that
// would crowd the last one. Monthly axes label calendar-year starts, thinned to
// at most twelve; a view shorter than two calendar years labels evenly spaced
// months instead, because it has at most one January to stand on.
export function periodLabelIndices(periods: readonly number[], periodsPerYear = 1): number[] {
  const n = periods.length;
  const all = Array.from({ length: n }, (_, index) => index);
  const spaced = (step: number) => all.filter((index) => index === n - 1 || (index % step === 0 && n - 1 - index >= step));
  if (periodsPerYear === 1) return spaced(Math.max(1, Math.ceil(n / 12)));

  const yearStarts = all.filter((index) => periods[index]! % periodsPerYear === 0);
  if (yearStarts.length >= 2) {
    const step = Math.max(1, Math.ceil(yearStarts.length / 12));
    return yearStarts.filter((_, position) => position % step === 0);
  }
  return spaced(Math.max(1, Math.ceil(n / 6)));
}

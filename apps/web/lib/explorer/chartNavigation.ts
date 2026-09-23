// Pointer and keyboard navigation for the period axis of the SVG charts.

/**
 * The period nearest a pointer, from its x position as a fraction of the SVG's
 * rendered width. Every x maps to a period, so hover never drops between columns.
 */
export function nearestPeriodIndex(
  pointerFraction: number,
  count: number,
  width: number,
  padLeft: number,
  padRight: number,
): number {
  if (count <= 1) return 0;
  const x = pointerFraction * width;
  const pitch = (width - padLeft - padRight) / (count - 1);
  return Math.min(count - 1, Math.max(0, Math.round((x - padLeft) / pitch)));
}

/** The active period after a key press: a number moves it, null clears it, undefined ignores the key. */
export function stepPeriodIndex(key: string, current: number | null, count: number): number | null | undefined {
  if (count === 0) return undefined;
  switch (key) {
    case "ArrowRight":
      return current === null ? 0 : Math.min(count - 1, current + 1);
    case "ArrowLeft":
      return current === null ? count - 1 : Math.max(0, current - 1);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    case "Escape":
      return null;
    default:
      return undefined;
  }
}

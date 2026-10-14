/**
 * The heatmap's colour step for a value: six equal-width bins from zero to the
 * maximum, drawn with the maps' six-step terracotta ramp (paper tint up to the
 * accent). The darkest bin is the full accent and carries paper text; the
 * lighter five keep ink text. Both pairings stay above 4.5:1.
 */
export function heatmapBin(value: number, maximum: number, steps: number): number {
  if (!(maximum > 0) || value <= 0) return 0;
  return Math.min(steps - 1, Math.floor((value / maximum) * steps));
}

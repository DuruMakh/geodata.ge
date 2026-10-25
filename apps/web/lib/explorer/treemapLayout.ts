// Squarified treemap layout (Bruls, Huizing and van Wijk), shared by the Analysis page's structure
// treemap (DOM tiles) and the homepage's spending treemap (canvas). Pure arithmetic, no React.

/** [x, y, width, height] */
export type TreemapRect = [x: number, y: number, w: number, h: number];

function worstRatio(row: number[], sum: number, side: number): number {
  const thickness = sum / side;
  let worst = 0;
  for (const value of row) {
    const length = value / thickness;
    const ratio = Math.max(thickness / length, length / thickness);
    if (ratio > worst) worst = ratio;
  }
  return worst;
}

/**
 * One rectangle per value, in input order, filling the w × h area at x, y with areas proportional to
 * value / total; rows are laid along the shorter side and keep the worst aspect ratio as low as they can.
 * `total` defaults to the sum of the positive values. A value of zero or less gets an empty rectangle
 * at x, y, as does every value when the total or the area is not positive.
 */
export function squarify(
  values: readonly number[],
  x: number,
  y: number,
  w: number,
  h: number,
  total = values.reduce((sum, value) => sum + Math.max(0, value), 0),
): TreemapRect[] {
  const rects: TreemapRect[] = values.map(() => [x, y, 0, 0]);
  if (total <= 0 || w <= 0 || h <= 0) return rects;
  let remaining = values.flatMap((value, index) => (value > 0 ? [{ index, v: (value / total) * w * h }] : []));

  while (remaining.length > 0) {
    const horizontal = w >= h;
    const side = horizontal ? h : w;
    const row = [remaining[0]];
    let sum = remaining[0].v;
    let count = 1;
    let worst = worstRatio(row.map((entry) => entry.v), sum, side);

    while (count < remaining.length) {
      const nextSum = sum + remaining[count].v;
      const nextWorst = worstRatio([...row.map((entry) => entry.v), remaining[count].v], nextSum, side);
      if (nextWorst > worst) break;
      row.push(remaining[count]);
      sum = nextSum;
      worst = nextWorst;
      count += 1;
    }

    const thickness = sum / side;
    let offset = 0;
    for (const entry of row) {
      const length = entry.v / thickness;
      rects[entry.index] = horizontal ? [x, y + offset, thickness, length] : [x + offset, y, length, thickness];
      offset += length;
    }

    if (horizontal) {
      x += thickness;
      w -= thickness;
    } else {
      y += thickness;
      h -= thickness;
    }
    remaining = remaining.slice(row.length);
  }

  return rects;
}

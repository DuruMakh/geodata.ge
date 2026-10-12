import { niceScale } from "./chartScale";

/** The pyramid's fixed measures, in CSS pixels (design spec §6). */
export const PYRAMID = { rowPitch: 22, bar: 18, gutter: 44, pad: 8, header: 26, axis: 22, minWidth: 320, serverWidth: 520 } as const;

/** The 65+ band: the five oldest of the 18 rows. */
const OLD_ROWS = 5;

export type PyramidGeometry = {
  width: number;
  height: number;
  /** The men's bars end here, the women's start at `centreRight`; the gutter between holds the age labels. */
  centreLeft: number;
  centreRight: number;
  scaleMax: number;
  /** Youngest first; `y` is the bar's top edge. */
  rows: { index: number; y: number; maleX: number; maleWidth: number; femaleWidth: number }[];
  ticks: { value: number; leftX: number; rightX: number }[];
  /** Stepped paths along the comparison year's outer bar ends; null without a comparison. */
  outline: { left: string; right: string } | null;
  oldBandY: number;
  oldBandHeight: number;
};

/** Value arrays are youngest first and already in the displayed measure (percent or persons). */
export function pyramidLayout({ width: requested, male, female, compare = null }: {
  width: number;
  male: number[];
  female: number[];
  compare?: { male: number[]; female: number[] } | null;
}): PyramidGeometry {
  const width = Math.max(requested, PYRAMID.minWidth);
  const half = (width - PYRAMID.gutter - 2 * PYRAMID.pad) / 2;
  const centreLeft = PYRAMID.pad + half;
  const centreRight = centreLeft + PYRAMID.gutter;
  const count = male.length;
  const height = PYRAMID.header + count * PYRAMID.rowPitch + PYRAMID.axis;

  const values = [...male, ...female, ...(compare ? [...compare.male, ...compare.female] : [])];
  const { top: scaleMax, step } = niceScale(0, Math.max(...values));
  const span = (value: number) => (value / scaleMax) * half;
  // Row 0 sits at the bottom of the plot; its pitch cell starts `cellTop`.
  const cellTop = (index: number) => PYRAMID.header + (count - 1 - index) * PYRAMID.rowPitch;
  const inset = (PYRAMID.rowPitch - PYRAMID.bar) / 2;

  const rows = male.map((value, index) => ({
    index,
    y: cellTop(index) + inset,
    maleX: centreLeft - span(value),
    maleWidth: span(value),
    femaleWidth: span(female[index]!),
  }));

  const ticks = Array.from({ length: Math.round(scaleMax / step) + 1 }, (_, index) => {
    const value = index === Math.round(scaleMax / step) ? scaleMax : step * index;
    return { value, leftX: centreLeft - span(value), rightX: centreRight + span(value) };
  });

  // From the bottom of row 0 up: out to each row's end, up its pitch cell, across to the next.
  const stepped = (series: number[], x: (value: number) => number) =>
    `M${x(series[0]!)} ${cellTop(0) + PYRAMID.rowPitch}` +
    series.map((value, index) => `${index === 0 ? "" : `H${x(value)}`}V${cellTop(index)}`).join("");
  const outline = compare
    ? {
        left: stepped(compare.male, (value) => centreLeft - span(value)),
        right: stepped(compare.female, (value) => centreRight + span(value)),
      }
    : null;

  return {
    width,
    height,
    centreLeft,
    centreRight,
    scaleMax,
    rows,
    ticks,
    outline,
    oldBandY: cellTop(count - 1),
    oldBandHeight: OLD_ROWS * PYRAMID.rowPitch,
  };
}

import { formatInUnit, UNIT_PERSONS } from "../../../lib/explorer/format";
import type { WageGapChapter } from "../../../lib/landing/chapters/types";
import { sparkPoints } from "./canvas";
import { DumbbellChart, type DumbbellLabels } from "./dumbbell-chart";
import { StatCard } from "./stat-card";

// Chapter 08: the wages by sector (women, men and the average) with four number cards beside it: the average wage
// with its history as a line, the median, women's wage as a share of men's, and the public sector against the rest.
// 8/4 columns from 1000px.

type StatText = { label: string; note: string };

export type WagesLabels = {
  chart: DumbbellLabels;
  average: StatText;
  median: StatText;
  ratio: StatText;
  publicSector: StatText;
};

const decimals = (value: number, places: number) => formatInUnit(value, { ...UNIT_PERSONS, decimals: places });

/** The cards' notes, each with the year of its own measure (the median may be older than the rest). */
export function wagesNotes(data: WageGapChapter, t: (key: string, values?: Record<string, string | number>) => string) {
  const { years, values } = data.history;
  if (!years.length) throw new Error("Wages chapter: no average wage history");
  return {
    average: t("landing.wages.average.note", { year: data.year, firstYear: years[0], first: decimals(values[0], 1) }),
    median: t("landing.wages.median.note", { year: data.median.year }),
    ratio: t("landing.wages.ratio.note", { year: data.year, women: decimals(data.women, 0), men: decimals(data.men, 0) }),
    publicSector: t("landing.wages.public.note", { year: data.year, nonPublic: decimals(data.nonPublic, 0) }),
  };
}

// The average wage's history as a server-rendered line (no tooltip): the plot area sits inside the 92px box with room
// for the first value at its left, the last at its right and the two years under it. Stretched to the width, so the
// stroke stays 2px and the end dot and the numbers are HTML.
function WageSpark({ history }: { history: WageGapChapter["history"] }) {
  const { years, values } = history;
  const plotHeight = 54;
  const points = sparkPoints(values, 1000, 2, plotHeight - 2);
  const [firstY, lastY] = [points[0][1], points[points.length - 1][1]];
  const label = "absolute -translate-y-1/2 font-[family-name:var(--font-numeric)] text-[11px]";
  return (
    <div aria-hidden="true" className="relative mt-[14px] h-[92px]">
      <div className="absolute bottom-[22px] left-10 right-[46px] top-4">
        <svg viewBox={`0 0 1000 ${plotHeight}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          <polyline
            points={points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}
            fill="none"
            stroke="var(--ink)"
            strokeWidth="2"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span className={`${label} right-full mr-1.5 font-medium text-[var(--muted)]`} style={{ top: `${(firstY / plotHeight) * 100}%` }}>
          {decimals(values[0], 1)}
        </span>
        <i
          className="absolute right-0 h-2 w-2 translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--paper)] bg-[var(--accent)] box-content"
          style={{ top: `${(lastY / plotHeight) * 100}%` }}
        />
        <span className={`${label} left-full ml-2 font-semibold text-[var(--ink)]`} style={{ top: `${(lastY / plotHeight) * 100}%` }}>
          {decimals(values[values.length - 1], 0)}
        </span>
      </div>
      <div className="absolute bottom-0 left-10 right-[46px] flex justify-between font-[family-name:var(--font-numeric)] text-[10.5px] font-medium text-[var(--muted)]">
        <span>{years[0]}</span>
        <span>{years[years.length - 1]}</span>
      </div>
    </div>
  );
}

export function WagesChapter({ data, labels }: { data: WageGapChapter; labels: WagesLabels }) {
  if (!data.sectors.length) throw new Error("Wages chapter: no sectors");
  return (
    <div className="mt-8 grid grid-cols-1 gap-10 min-[1000px]:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] min-[1000px]:gap-12">
      <DumbbellChart year={data.year} sectors={data.sectors} labels={labels.chart} />
      <div className="flex flex-col gap-[26px]">
        <StatCard label={labels.average.label} value={decimals(data.average, 0)} unit="₾" note={labels.average.note}>
          <WageSpark history={data.history} />
        </StatCard>
        <StatCard label={labels.median.label} value={decimals(data.median.value, 0)} unit="₾" note={labels.median.note} />
        <StatCard label={labels.ratio.label} value={decimals(data.ratio * 100, 0)} unit="%" note={labels.ratio.note} />
        <StatCard label={labels.publicSector.label} value={decimals(data.publicSector, 0)} unit="₾" note={labels.publicSector.note} />
      </div>
    </div>
  );
}

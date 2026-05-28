import { formatGel, formatPercent } from "../../lib/explorer/format";
import type { SnapshotItem } from "../../lib/explorer/types";

type BudgetRadarProps = {
  items: SnapshotItem[];
};

const SIZE = 320;
const CENTER = SIZE / 2;
const MAX_RADIUS = 118;

function pointFor(index: number, count: number, radius: number) {
  const angle = (Math.PI * 2 * index) / Math.max(count, 1) - Math.PI / 2;

  return {
    x: CENTER + Math.cos(angle) * radius,
    y: CENTER + Math.sin(angle) * radius,
  };
}

function polygonPoints(items: SnapshotItem[]) {
  const maxShare = Math.max(...items.map((item) => item.shareOfTotal), 0);

  return items
    .map((item, index) => {
      const radius = maxShare === 0 ? 0 : Math.max(18, (item.shareOfTotal / maxShare) * MAX_RADIUS);
      const point = pointFor(index, items.length, radius);
      return `${point.x},${point.y}`;
    })
    .join(" ");
}

export function BudgetRadar({ items }: BudgetRadarProps) {
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <section data-testid="budget-radar" className="min-w-0 rounded-[20px] border border-[var(--hairline)] bg-[var(--surface)] p-4">
      <h3 className="mb-3 text-lg font-semibold text-[var(--ink)]">{"\u10d1\u10d8\u10e3\u10ef\u10d4\u10e2\u10d8\u10e1 \u10e0\u10d0\u10d3\u10d0\u10e0\u10d8"}</h3>
      <div className="flex justify-center overflow-hidden rounded-[18px] bg-[var(--canvas)] p-4">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="ბიუჯეტის რადარი წილის მიხედვით" className="h-auto w-full max-w-[420px]">
          {rings.map((ring) => (
            <circle
              key={ring}
              cx={CENTER}
              cy={CENTER}
              r={MAX_RADIUS * ring}
              fill="none"
              stroke="var(--grid)"
              strokeWidth={1}
            />
          ))}
          {items.map((item, index) => {
            const outer = pointFor(index, items.length, MAX_RADIUS);
            const label = pointFor(index, items.length, MAX_RADIUS + 22);

            return (
              <g key={item.itemId}>
                <line x1={CENTER} y1={CENTER} x2={outer.x} y2={outer.y} stroke="var(--grid)" strokeWidth={1} />
                <text
                  x={label.x}
                  y={label.y}
                  textAnchor={label.x < CENTER - 12 ? "end" : label.x > CENTER + 12 ? "start" : "middle"}
                  dominantBaseline="middle"
                  fill="var(--mute)"
                  fontSize={10}
                  fontWeight={700}
                >
                  {item.kaLabel.length > 14 ? `${item.kaLabel.slice(0, 13)}...` : item.kaLabel}
                </text>
              </g>
            );
          })}
          <polygon points={polygonPoints(items)} fill="var(--primary)" fillOpacity={0.12} stroke="var(--primary)" strokeWidth={2} />
          {items.map((item, index) => {
            const maxShare = Math.max(...items.map((entry) => entry.shareOfTotal), 0);
            const radius = maxShare === 0 ? 0 : Math.max(18, (item.shareOfTotal / maxShare) * MAX_RADIUS);
            const point = pointFor(index, items.length, radius);

            return (
              <circle key={item.itemId} cx={point.x} cy={point.y} r={6} fill={item.color} stroke="var(--surface)" strokeWidth={2}>
                <title>{`${item.kaLabel}: ${formatGel(item.amountGel)} / ${formatPercent(item.shareOfTotal)}`}</title>
              </circle>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

import { formatGel, formatPercent } from "../../lib/explorer/format";
import type { SnapshotItem } from "../../lib/explorer/types";

type SpendingPetalsProps = {
  items: SnapshotItem[];
};

const CENTER = 150;
const VIEWBOX_SIZE = 300;
const BASE_RADIUS = 34;
const RADIUS_RANGE = 82;

export function SpendingPetals({ items }: SpendingPetalsProps) {
  const maxShare = Math.max(...items.map((item) => item.shareOfTotal), 0);

  return (
    <section data-testid="spending-petals" className="mt-4">
      <h3 className="mb-3 text-lg font-semibold text-white">ხარჯების ფურცლები</h3>
      <div className="grid gap-4 border border-cyan-400/20 bg-black/40 p-4 lg:grid-cols-[360px_1fr]">
        <svg viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`} role="img" aria-label="Spending petals by share of total" className="h-auto w-full max-w-[360px]">
          <circle cx={CENTER} cy={CENTER} r={28} fill="#05070b" stroke="rgba(34, 211, 238, 0.45)" strokeWidth={1.5} />
          {items.map((item, index) => {
            const angle = (Math.PI * 2 * index) / Math.max(items.length, 1) - Math.PI / 2;
            const normalizedShare = maxShare === 0 ? 0 : item.shareOfTotal / maxShare;
            const radius = BASE_RADIUS + normalizedShare * RADIUS_RANGE;
            const cx = CENTER + Math.cos(angle) * 58;
            const cy = CENTER + Math.sin(angle) * 58;
            const labelX = CENTER + Math.cos(angle) * 116;
            const labelY = CENTER + Math.sin(angle) * 116;
            const showLabel = item.shareOfTotal >= 0.08;

            return (
              <g key={item.itemId}>
                <ellipse
                  cx={cx}
                  cy={cy}
                  rx={Math.max(10, radius * 0.38)}
                  ry={Math.max(18, radius)}
                  fill={item.color}
                  fillOpacity={0.72}
                  stroke="rgba(244, 244, 245, 0.32)"
                  strokeWidth={1}
                  transform={`rotate(${(angle * 180) / Math.PI + 90} ${cx} ${cy})`}
                >
                  <title>{`${item.kaLabel}: ${formatGel(item.amountGel)} / ${formatPercent(item.shareOfTotal)}`}</title>
                </ellipse>
                {showLabel ? (
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor={labelX < CENTER ? "end" : labelX > CENTER ? "start" : "middle"}
                    dominantBaseline="middle"
                    fill="#f4f4f5"
                    fontSize={11}
                    fontWeight={700}
                  >
                    {item.kaLabel}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.itemId} className="flex items-center justify-between gap-3 border-b border-zinc-800/80 pb-2 text-sm last:border-b-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-3 w-3 shrink-0 border border-white/20" style={{ backgroundColor: item.color }} />
                <span className="truncate text-zinc-200">{item.kaLabel}</span>
              </div>
              <span className="shrink-0 font-mono text-cyan-100">{formatPercent(item.shareOfTotal)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

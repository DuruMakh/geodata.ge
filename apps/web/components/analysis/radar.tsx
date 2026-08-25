import type { SnapshotItem } from "../../lib/explorer/types";
import { formatShare } from "../../lib/explorer/format";
import { SwatchBar } from "../ui/editorial";

// Budget radar per DESIGN.md §9.5: one accent polygon over hairline rings, mono
// two-digit rim indices, and a numbered list beside the chart.

type BudgetRadarProps = {
  items: SnapshotItem[];
};

const CX = 210;
const CY = 158;
const RADIUS = 104;

export function BudgetRadar({ items }: BudgetRadarProps) {
  if (items.length === 0) return null;

  const numbered = items.map((item, index) => ({ ...item, num: String(index + 1).padStart(2, "0") }));
  const maxShare = Math.max(...numbered.map((item) => item.shareOfTotal), 0.001);
  const count = numbered.length;
  const angle = (index: number) => -Math.PI / 2 + (index * 2 * Math.PI) / count;
  const point = (index: number, radius: number): [number, number] => [
    CX + Math.cos(angle(index)) * radius,
    CY + Math.sin(angle(index)) * radius,
  ];
  const ringPath = (fraction: number) =>
    numbered
      .map((_, index) => {
        const [x, y] = point(index, RADIUS * fraction);
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ") + " Z";
  const polygon =
    numbered
      .map((item, index) => {
        const [x, y] = point(index, (item.shareOfTotal / maxShare) * RADIUS);
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ") + " Z";

  return (
    <div data-testid="budget-radar" className="mt-9 border-t border-[var(--hairline)] pt-6">
      <h2 className="mb-1 text-[13px] font-semibold text-[var(--ink)]">ბიუჯეტის რადარი</h2>
      <p className="mb-4 text-xs text-[var(--muted)]">წილები · ზედა კატეგორიები · მხოლოდ ვიზუალური</p>
      <div className="grid items-center gap-6 @min-[1100px]:grid-cols-[minmax(0,1fr)_300px] @min-[1100px]:gap-12">
        <svg viewBox="0 0 420 316" role="img" aria-label="ბიუჯეტის რადარი" className="block h-auto w-full max-w-[460px]">
          {[0.25, 0.5, 0.75, 1].map((fraction) => (
            <path key={fraction} d={ringPath(fraction)} fill="none" stroke="#E7DECF" strokeWidth={1} />
          ))}
          {numbered.map((item, index) => {
            const [x, y] = point(index, RADIUS);
            const [lx, ly] = point(index, RADIUS + 17);

            return (
              <g key={item.itemId}>
                <line x1={CX} y1={CY} x2={x} y2={y} stroke="#E7DECF" strokeWidth={1} />
                <text x={lx} y={ly + 3.5} fontSize={10.5} fill="#6A6050" textAnchor="middle" style={{ fontFamily: "var(--font-numeric)" }}>
                  {item.num}
                </text>
              </g>
            );
          })}
          <path d={polygon} fill="rgba(179,64,42,0.12)" stroke="#B3402A" strokeWidth={2} strokeLinejoin="round" />
          {numbered.map((item, index) => {
            const [x, y] = point(index, (item.shareOfTotal / maxShare) * RADIUS);

            return (
              <circle key={item.itemId} cx={x} cy={y} r={3} fill={item.color}>
                <title>{`${item.kaLabel} — ${formatShare(item.shareOfTotal)}`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="flex flex-col">
          {numbered.map((item) => (
            <div key={item.itemId} className="grid grid-cols-[24px_20px_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-[var(--hairline-soft)] py-1.5">
              <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">{item.num}</span>
              <SwatchBar color={item.color} />
              <span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium text-[var(--ink)]">
                {item.kaLabel}
              </span>
              <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
                {formatShare(item.shareOfTotal)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

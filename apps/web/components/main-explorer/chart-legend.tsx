import type { ExplorerItem } from "../../lib/explorer/types";

type ChartLegendProps = {
  items: ExplorerItem[];
};

export function ChartLegend({ items }: ChartLegendProps) {
  if (items.length === 0) return null;

  return (
    <div data-testid="chart-legend" className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] font-semibold text-[var(--body)]">
      {items.map((item) => (
        <span key={item.id} className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
          <span>{item.kaLabel}</span>
        </span>
      ))}
    </div>
  );
}

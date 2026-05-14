import type { Every100Item, ExplorerSide } from "../../lib/explorer/types";

type Every100GelProps = {
  items: Every100Item[];
  side: ExplorerSide;
};

type CellItem = Pick<Every100Item, "itemId" | "color" | "kaLabel">;

function buildCells(items: Every100Item[]): Array<CellItem | null> {
  const allocated = items.flatMap((item) =>
    Array.from({ length: item.gelFrom100 }, () => ({
      itemId: item.itemId,
      color: item.color,
      kaLabel: item.kaLabel,
    })),
  );

  return Array.from({ length: 100 }, (_, index) => allocated[index] ?? null);
}

export function Every100Gel({ items, side }: Every100GelProps) {
  const cells = buildCells(items);
  const ariaLabel = side === "expenditure" ? "Expenditure composition per 100 GEL" : "Revenue composition per 100 GEL";

  return (
    <section data-testid="every-100-gel" className="min-w-0 border border-cyan-400/20 bg-black/45 p-4">
      <h3 className="mb-3 text-lg font-semibold text-white">ყოველი 100 GEL</h3>
      <div className="grid min-w-0 gap-4 lg:grid-cols-[220px_1fr]">
        <div
          data-testid="every-100-grid"
          className="grid w-full max-w-[320px] gap-1 justify-self-start"
          role="img"
          aria-label={ariaLabel}
          style={{ gridTemplateColumns: "repeat(10, minmax(0, 1fr))" }}
        >
          {cells.map((item, index) => (
            <span
              key={`${item?.itemId ?? "empty"}-${index}`}
              className="aspect-square border border-black/40"
              title={item?.kaLabel}
              style={{ backgroundColor: item?.color ?? "rgba(39, 39, 42, 0.65)" }}
            />
          ))}
        </div>
        <div className="min-w-0 max-w-full space-y-2">
          {items.map((item) => (
            <div key={item.itemId} className="flex min-w-0 items-center justify-between gap-3 border-b border-zinc-800/80 pb-2 text-sm last:border-b-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-3 w-3 shrink-0 border border-white/20" style={{ backgroundColor: item.color }} />
                <span className="truncate text-zinc-200">{item.kaLabel}</span>
              </div>
              <span className="shrink-0 font-mono text-cyan-100">{item.gelFrom100} GEL</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

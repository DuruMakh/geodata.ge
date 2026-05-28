import type { Every100Item, ExplorerSide } from "../../lib/explorer/types";

type Every100GelProps = {
  items: Every100Item[];
  side: ExplorerSide;
};

type CellItem = Pick<Every100Item, "itemId" | "color" | "kaLabel" | "gelFrom100" | "exactShare">;

const largeSharePalette = ["#8fb7df", "#8accc6", "#e0b47b", "#d7ca72", "#9fcf8e"];
const smallSharePalette = ["#a3adb8", "#b9c1ca", "#cbd2d9", "#d8dde3", "#e1e5ea", "#e8ebef", "#eef1f4"];
const LARGE_SHARE_THRESHOLD = 8;

function buildCells(items: Every100Item[]): Array<CellItem | null> {
  const allocated = items.flatMap((item) =>
    Array.from({ length: item.gelFrom100 }, () => ({
      itemId: item.itemId,
      color: item.color,
      kaLabel: item.kaLabel,
      gelFrom100: item.gelFrom100,
      exactShare: item.exactShare,
    })),
  );

  return Array.from({ length: 100 }, (_, index) => allocated[index] ?? null);
}

export function Every100Gel({ items, side }: Every100GelProps) {
  const cells = buildCells(items);
  const ariaLabel = side === "expenditure" ? "Expenditure composition per 100 GEL" : "Revenue composition per 100 GEL";
  const colorByItemId = new Map(
    items.map((item, index) => {
      const smallIndex = Math.max(0, index - largeSharePalette.length);
      const palette = item.exactShare >= LARGE_SHARE_THRESHOLD ? largeSharePalette : smallSharePalette;
      const color = item.exactShare >= LARGE_SHARE_THRESHOLD ? palette[index % palette.length] : palette[smallIndex % palette.length];

      return [item.itemId, color];
    }),
  );

  return (
    <section data-testid="every-100-gel" className="min-w-0 rounded-[20px] border border-[var(--hairline)] bg-[var(--surface)] p-4">
      <h3 className="mb-3 text-lg font-semibold text-[var(--ink)]">{"\u10e7\u10dd\u10d5\u10d4\u10da\u10d8 100 \u10da\u10d0\u10e0\u10d8"}</h3>
      <div
        data-testid="every-100-grid"
        className="mx-auto grid w-full max-w-[420px] gap-1 rounded-[18px] bg-[var(--canvas)] p-3"
        role="img"
        aria-label={ariaLabel}
        style={{ gridTemplateColumns: "repeat(10, minmax(0, 1fr))" }}
      >
        {cells.map((item, index) => (
          <span
            key={`${item?.itemId ?? "empty"}-${index}`}
            data-cell="gel"
            aria-label={item ? `${item.kaLabel}: ${item.gelFrom100} GEL from every 100 GEL` : undefined}
            className="group relative aspect-square rounded-[5px] border border-[var(--surface)]"
            title={item ? `${item.kaLabel}: ${item.gelFrom100} GEL / ${item.exactShare.toFixed(1)}%` : undefined}
            style={{ backgroundColor: item ? colorByItemId.get(item.itemId) : "var(--soft)" }}
          >
            {item ? (
              <span
                data-testid="every-100-tooltip"
                className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-20 hidden w-max max-w-[220px] -translate-x-1/2 rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-left text-xs leading-4 text-[var(--ink)] shadow-xl group-hover:block"
              >
                <span className="block font-bold">{item.kaLabel}</span>
                <span className="mt-1 block text-[var(--body)]">
                  {item.gelFrom100} {"\u10da\u10d0\u10e0\u10d8"} / {item.exactShare.toFixed(1)}%
                </span>
              </span>
            ) : null}
          </span>
        ))}
      </div>
    </section>
  );
}

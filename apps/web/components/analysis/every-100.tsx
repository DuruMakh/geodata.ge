import type { Every100Item } from "../../lib/explorer/types";
import { SwatchBar } from "../ui/editorial";

// "ყოველი 100 ლარი" per DESIGN.md §9.4: exactly 100 flat cells in a 10×10 grid with
// a legend column beside it (wraps below on narrow screens).

type Every100Props = {
  items: Every100Item[];
};

export function Every100Gel({ items }: Every100Props) {
  const cells = items.flatMap((item) =>
    Array.from({ length: item.gelFrom100 }, (_, index) => ({
      key: `${item.itemId}-${index}`,
      color: item.color,
      title: `${item.kaLabel}: ${item.gelFrom100} ₾ / ${item.exactShare.toFixed(1)}%`,
    })),
  );
  const zeroCount = items.filter((item) => item.gelFrom100 === 0).length;

  return (
    <div data-testid="every-100-gel" className="mt-9 border-t border-[var(--hairline)] pt-6">
      <h3 className="mb-1 text-[13px] font-semibold text-[var(--ink)]">ყოველი 100 ლარი</h3>
      <p className="mb-4 text-xs text-[var(--muted)]">
        ზუსტად 100 უჯრა · მთელი ლარები, ჯამი — 100
        {zeroCount > 0 ? ` · ${zeroCount} კატეგორია მრგვალდება 0 ₾-მდე` : ""}
      </p>
      <div className="flex flex-wrap items-start gap-x-12 gap-y-6">
        <div data-testid="every-100-grid" className="grid w-[min(100%,560px)] flex-none grid-cols-10 gap-[5px]">
          {cells.map((cell) => (
            <span key={cell.key} data-cell="gel" title={cell.title} className="block aspect-square" style={{ background: cell.color }} />
          ))}
        </div>
        <div className="grid min-w-[260px] max-w-[420px] flex-[1_1_300px] content-start grid-cols-[minmax(0,1fr)]">
          {items
            .filter((item) => item.gelFrom100 > 0)
            .map((item) => (
              <div
                key={item.itemId}
                title={`${item.kaLabel} — ${item.exactShare.toFixed(1)}%`}
                className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-[var(--hairline-soft)] py-1.5"
              >
                <SwatchBar color={item.color} />
                <span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium text-[var(--ink)]">
                  {item.kaLabel}
                </span>
                <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">{item.gelFrom100} ₾</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

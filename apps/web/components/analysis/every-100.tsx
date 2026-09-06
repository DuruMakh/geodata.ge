import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { publicLabel } from "../../lib/i18n/labels";
import type { Every100Item } from "../../lib/explorer/types";
import { SwatchBar } from "../ui/editorial";

// "ყოველი 100 ლარი" per DESIGN.md §9.4: exactly 100 flat cells in a 10×10 grid with
// a legend column beside it (wraps below on narrow screens).

type Every100Props = {
  items: Every100Item[];
};

export function Every100Gel({ items }: Every100Props) {
  const { locale, messages, englishLabels } = useI18n();
  const labelFor = (item: Pick<Every100Item, "itemId" | "kaLabel">) => publicLabel(locale, item.itemId, item.kaLabel, englishLabels);
  const cells = items.flatMap((item) =>
    Array.from({ length: item.gelFrom100 }, (_, index) => ({
      key: `${item.itemId}-${index}`,
      color: item.color,
      title: message(messages, "analysis.every100Cell", { name: labelFor(item), amount: item.gelFrom100, share: item.exactShare.toFixed(1) }),
    })),
  );
  const zeroCount = items.filter((item) => item.gelFrom100 === 0).length;

  return (
    <div data-testid="every-100-gel" className="mt-9 border-t border-[var(--hairline)] pt-6">
      <h2 className="mb-1 text-[13px] font-semibold text-[var(--ink)]">{message(messages, "analysis.every100")}</h2>
      <p className="mb-4 text-xs text-[var(--muted)]">
        {message(messages, "analysis.every100Note")}
        {zeroCount > 0 ? message(messages, "analysis.every100Rounded", { count: zeroCount }) : ""}
      </p>
      <div className="flex flex-wrap items-start gap-x-12 gap-y-6">
        <div
          data-testid="every-100-grid"
          role="img"
          aria-label={message(messages, "analysis.every100Aria", { items: items
            .filter((item) => item.gelFrom100 > 0)
            .map((item) => message(messages, "analysis.every100Item", { name: labelFor(item), amount: item.gelFrom100 }))
            .join(", ") })}
          className="grid w-[min(100%,560px)] flex-none grid-cols-10 gap-[5px]"
        >
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
                title={`${labelFor(item)} — ${item.exactShare.toFixed(1)}%`}
                className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-[var(--hairline-soft)] py-1.5"
              >
                <SwatchBar color={item.color} />
                <span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium text-[var(--ink)]">
                  {labelFor(item)}
                </span>
                <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">{item.gelFrom100} {message(messages, "analysis.gelUnit")}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

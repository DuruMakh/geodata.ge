import { Message } from "../../lib/i18n/message";
import { useI18n } from "../../lib/i18n/provider";
import { publicLabel } from "../../lib/i18n/labels";
import type { SnapshotItem } from "../../lib/explorer/types";
import { formatAmount, formatShare } from "../../lib/explorer/format";
import { SwatchBar } from "../ui/editorial";

// Structure treemap per DESIGN.md §9.3: squarified layout over a 1000×430 unit area,
// tile fill on paper with a 3px category top bar; small categories fall back to a
// swatch legend below the map.

type TreemapRect = { item: SnapshotItem; x: number; y: number; w: number; h: number };

const AREA_W = 1000;
const AREA_H = 430;

function worstRatio(row: number[], sum: number, side: number): number {
  const thickness = sum / side;
  let worst = 0;
  for (const value of row) {
    const length = value / thickness;
    const ratio = Math.max(thickness / length, length / thickness);
    if (ratio > worst) worst = ratio;
  }
  return worst;
}

export function squarify(items: SnapshotItem[], totalValue: number): TreemapRect[] {
  const rects: TreemapRect[] = [];
  if (totalValue <= 0) return rects;
  let remaining = items.map((item) => ({ item, v: (item.amountGel / totalValue) * AREA_W * AREA_H }));
  let x = 0;
  let y = 0;
  let w = AREA_W;
  let h = AREA_H;

  while (remaining.length > 0) {
    const horizontal = w >= h;
    const side = horizontal ? h : w;
    const row = [remaining[0]];
    let sum = remaining[0].v;
    let count = 1;
    let worst = worstRatio(row.map((entry) => entry.v), sum, side);

    while (count < remaining.length) {
      const nextSum = sum + remaining[count].v;
      const nextWorst = worstRatio([...row.map((entry) => entry.v), remaining[count].v], nextSum, side);
      if (nextWorst > worst) break;
      row.push(remaining[count]);
      sum = nextSum;
      worst = nextWorst;
      count += 1;
    }

    const thickness = sum / side;
    let offset = 0;
    for (const entry of row) {
      const length = entry.v / thickness;
      if (horizontal) rects.push({ item: entry.item, x, y: y + offset, w: thickness, h: length });
      else rects.push({ item: entry.item, x: x + offset, y, w: length, h: thickness });
      offset += length;
    }

    if (horizontal) {
      x += thickness;
      w -= thickness;
    } else {
      y += thickness;
      h -= thickness;
    }
    remaining = remaining.slice(row.length);
  }

  return rects;
}

type StructureTreemapProps = {
  items: SnapshotItem[];
  title: string;
  yearLabel: string;
};

export function StructureTreemap({ items, title, yearLabel }: StructureTreemapProps) {
  const { locale, messages, englishLabels } = useI18n();
  const labelFor = (item: Pick<SnapshotItem, "itemId" | "kaLabel">) => publicLabel(locale, item.itemId, item.kaLabel, englishLabels);
  // Only positive rows have tile geometry; negative rows (real data: e.g.
  // revenue.other_taxes 2019-2020) stay visible in the ranking table instead.
  // Lay out over the drawn items' own sum so the tiles exactly fill the area.
  const drawn = items.filter((item) => item.amountGel > 0);
  const drawnTotal = drawn.reduce((sum, item) => sum + item.amountGel, 0);
  const rects = squarify(drawn, drawnTotal);
  const tinyLegend = drawn.filter((item) => item.shareOfTotal < 0.033);

  return (
    <div data-testid="snapshot-treemap" className="mt-9 border-t border-[var(--hairline)] pt-6">
      <h2 className="mb-1 text-[13px] font-semibold text-[var(--ink)]">{title}</h2>
      <p className="mb-4 text-xs text-[var(--muted)]">
        <Message messages={messages} id="analysis.treemapNote" values={{ year: <span className="font-[family-name:var(--font-numeric)]">{yearLabel}</span> }} />
      </p>
      {/* Phones (<768px): one 100% stacked bar plus a full-width list of the same
          items in the same order. At 350px wide the treemap's tiles are too small
          to name (DESIGN.md §9.3, mobile amendment approved 2026-10-07). */}
      <div data-testid="snapshot-structure-mobile" className="min-[768px]:hidden">
        <div data-testid="snapshot-structure-bar" aria-hidden className="flex h-4 w-full gap-px">
          {drawn.map((item) => (
            <span key={item.itemId} className="block h-full min-w-0" style={{ width: `${(item.amountGel / drawnTotal) * 100}%`, backgroundColor: item.color }} />
          ))}
        </div>
        <table className="mt-3 w-full border-collapse text-left">
          <caption className="sr-only">{`${title}, ${yearLabel}`}</caption>
          <tbody>
            {drawn.map((item) => (
              <tr key={item.itemId} data-testid="snapshot-structure-row" className="border-t border-[var(--hairline-soft)] align-top">
                <th scope="row" className="py-2 pr-2.5 font-normal">
                  <span className="flex min-w-0 items-start gap-2.5">
                    <SwatchBar color={item.color} className="mt-[8px]" />
                    <span className="min-w-0 text-[12.5px] font-medium leading-[1.4] text-[var(--ink)]">{labelFor(item)}</span>
                  </span>
                </th>
                <td className="py-2 pr-2.5 text-right font-[family-name:var(--font-numeric)] text-[12px] font-semibold whitespace-nowrap text-[var(--ink)]">
                  {formatShare(item.shareOfTotal)}
                </td>
                <td className="py-2 text-right font-[family-name:var(--font-numeric)] text-[11px] whitespace-nowrap text-[var(--muted)]">
                  {formatAmount(item.amountGel, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div data-testid="snapshot-structure-grid" className="relative hidden w-full min-[768px]:block" style={{ aspectRatio: `${AREA_W} / ${AREA_H}` }}>
        {rects.map(({ item, x, y, w, h }) => {
          const big = item.shareOfTotal >= 0.08;
          const mid = item.shareOfTotal >= 0.033;
          const small = item.shareOfTotal >= 0.014;

          return (
            <div
              key={item.itemId}
              data-testid="snapshot-structure-card"
              title={`${labelFor(item)} — ${formatShare(item.shareOfTotal)} · ${formatAmount(item.amountGel, locale)}`}
              className="absolute min-w-0 overflow-hidden border border-[var(--hairline)] bg-[var(--tile)] transition-colors duration-100 hover:bg-[var(--tint)]"
              style={{
                left: `${(x / AREA_W) * 100}%`,
                top: `${(y / AREA_H) * 100}%`,
                width: `${(w / AREA_W) * 100}%`,
                height: `${(h / AREA_H) * 100}%`,
                borderTop: `3px solid ${item.color}`,
              }}
            >
              {/* Padding lives on this inner box. With border-box sizing a padded tile
                  can never be narrower than its padding, so the thinnest tiles grew
                  past the treemap's right edge; the outer tile now clips this box. */}
              <div className="flex h-full flex-col justify-between px-[11px] py-[9px]">
                {small ? (
                  <span
                    className="font-[family-name:var(--font-display)] font-semibold leading-none tracking-[-0.01em]"
                    style={{ fontSize: big ? 22 : mid ? 16 : 12 }}
                  >
                    {formatShare(item.shareOfTotal)}
                  </span>
                ) : null}
                <span className="min-w-0">
                  {mid ? (
                    <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium text-[var(--ink)]">
                      {labelFor(item)}
                    </span>
                  ) : null}
                  {big ? (
                    <span className="mt-[3px] block font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
                      {formatAmount(item.amountGel, locale)}
                    </span>
                  ) : null}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {tinyLegend.length > 0 ? (
        <div className="mt-3 hidden flex-wrap gap-x-5 gap-y-2 min-[768px]:flex">
          {tinyLegend.map((item) => (
            <span key={item.itemId} className="inline-flex items-center gap-[7px] text-[11.5px] text-[var(--body)]">
              <SwatchBar color={item.color} className="!w-3" />
              {labelFor(item)}
              <span className="font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--muted)]">
                {formatShare(item.shareOfTotal)}
              </span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import type { TreemapRect } from "../../lib/explorer/treemapLayout";
import { TREEMAP_HEIGHT, TREEMAP_WIDTH } from "../../lib/yearReview/yearView";
import { pointerHover } from "./section";

// Section 03's "what the money buys" (spec §4): general-government spending by type as a squarified treemap. A tile
// of 3% or more carries its name, `amount · share` and change in white; the smaller ones are listed under the drawing.
// Two layouts, as on the board (`an-tm-a`, `an-tm-b`): wide from 640px of section width, tall below it. Tiles answer
// a pointer hover only: a spending type is not a budget category, so it has no chip by the ruler to clear a pin with.

// The share of the total from which a tile is labelled on the drawing (a ruling: the cut-off lives in the UI).
const LABEL_FROM = 0.03;
// The height (px: both layouts draw at their box's height) a labelled tile needs for its change line under a name of
// two lines and its amount; a shorter tile leaves the change line out rather than cut it off.
const CHANGE_FROM_HEIGHT = 112;
const WIDE = { width: TREEMAP_WIDTH, height: TREEMAP_HEIGHT };
/** The board's phone layout box; the caller squarifies the tiles into it (`tall`). */
export const TALL = { width: 335, height: 620 };

/** One tile in buysView's order (largest first), with its rect in buysView's wide box and in the tall one. */
export type BuysTile = {
  id: string;
  label: string;
  color: string;
  value: number;
  share: number;
  rect: TreemapRect;
  tall: TreemapRect;
  /** `amount · share`. */
  amount: string;
  /** The change line, or null when the type has no earlier year. */
  change: string | null;
};
type Placed = BuysTile & { at: TreemapRect };

function Layout({ tiles, box, focus, className, onFocus }: {
  tiles: Placed[];
  box: { width: number; height: number };
  focus: string | null;
  className: string;
  onFocus?: (id: string | null) => void;
}) {
  return (
    <div className={`relative ${className}`} style={{ height: box.height }}>
      {tiles.map((tile) => {
        const [x, y, w, h] = tile.at;
        const labelled = tile.share >= LABEL_FROM;
        const focused = focus === tile.id;
        const dim = focus !== null && !focused;
        return (
          <div
            key={tile.id}
            data-tile={tile.id}
            data-labelled={labelled ? "" : undefined}
            data-focus={focused ? "" : undefined}
            data-dim={dim ? "" : undefined}
            onPointerEnter={onFocus ? pointerHover(() => onFocus(tile.id)) : undefined}
            className={`absolute overflow-hidden border border-[var(--paper)] text-white transition-opacity duration-200 ${labelled ? "px-3 py-2.5" : ""} ${dim ? "opacity-25" : ""}`}
            style={{
              left: `${(x / box.width) * 100}%`,
              top: `${(y / box.height) * 100}%`,
              width: `${(w / box.width) * 100}%`,
              height: `${(h / box.height) * 100}%`,
              backgroundColor: tile.color,
              boxShadow: focused ? "inset 0 0 0 3px var(--ink)" : undefined,
            }}
          >
            {labelled ? (
              <>
                <b className="block text-[13.5px] font-semibold leading-[1.3]">{tile.label}</b>
                <span className="mt-1 block font-[family-name:var(--font-numeric)] text-[11.5px] leading-[1.35]">{tile.amount}</span>
                {tile.change && h >= CHANGE_FROM_HEIGHT ? <span className="mt-1 block font-[family-name:var(--font-numeric)] text-[11.5px] leading-[1.35]">{tile.change}</span> : null}
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function BuysTreemap({ tiles, focus, ariaLabel, onFocus }: {
  tiles: BuysTile[];
  focus: string | null;
  ariaLabel: string;
  onFocus?: (id: string | null) => void;
}) {
  const small = tiles.filter((tile) => tile.share < LABEL_FROM);
  return (
    <div className="mt-4">
      <div role="img" aria-label={ariaLabel} onPointerLeave={onFocus ? () => onFocus(null) : undefined}>
        <Layout tiles={tiles.map((tile) => ({ ...tile, at: tile.rect }))} box={WIDE} focus={focus} onFocus={onFocus} className="hidden @min-[640px]:block" />
        <Layout tiles={tiles.map((tile) => ({ ...tile, at: tile.tall }))} box={TALL} focus={focus} onFocus={onFocus} className="@min-[640px]:hidden" />
      </div>
      {small.length > 0 ? (
        <ul aria-hidden="true" className="m-0 mt-3 flex list-none flex-wrap gap-x-6 gap-y-1.5 p-0">
          {small.map((tile) => (
            <li
              key={tile.id}
              data-small-tile={tile.id}
              onPointerEnter={onFocus ? pointerHover(() => onFocus(tile.id)) : undefined}
              onPointerLeave={onFocus ? () => onFocus(null) : undefined}
              className={`flex items-baseline gap-2 font-[family-name:var(--font-numeric)] text-[11px] leading-[1.45] text-[var(--body)] transition-opacity duration-200 ${
                focus !== null && focus !== tile.id ? "opacity-25" : ""
              }`}
            >
              <i className="block size-2.5 flex-none self-center rounded-[2px]" style={{ backgroundColor: tile.color }} />
              <span>
                <b className="font-[family-name:var(--font-ui)] text-xs font-semibold text-[var(--ink)]">{tile.label}</b> {tile.amount}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

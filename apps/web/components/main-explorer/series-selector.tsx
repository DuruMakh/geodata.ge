"use client";

import { useMemo, useState } from "react";
import { isDerivedTotalItemId } from "../../lib/explorer/explorerData";
import { formatGel } from "../../lib/explorer/format";
import { MAX_CHART_SERIES, type ChartMode, type ExplorerItem, type ExplorerTableRow } from "../../lib/explorer/types";

type SeriesSelectorProps = {
  items: ExplorerItem[];
  selectedIds: string[];
  rows: ExplorerTableRow[];
  years: number[];
  chartMode: ChartMode;
  limitMessage: string | null;
  onToggle: (itemId: string) => void;
};

export function SeriesSelector({ items, selectedIds, rows, years, chartMode, limitMessage, onToggle }: SeriesSelectorProps) {
  const [query, setQuery] = useState("");
  const latestYear = years.at(-1);
  const values = useMemo(() => new Map(rows.map((row) => [row.itemId, row])), [rows]);
  const filteredItems = items.filter((item) => {
    const haystack = `${item.kaLabel} ${item.enLabel} ${item.id}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  return (
    <aside data-testid="series-selector" className="border border-cyan-400/20 bg-black/45 p-4 lg:sticky lg:top-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-white">სერიები</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {chartMode === "table" ? "ცხრილში ლიმიტი არ არის" : `გრაფიკზე მაქსიმუმ ${MAX_CHART_SERIES} სერია`}
          </p>
        </div>
        <span data-testid="selected-series-count" className="font-mono text-xs text-cyan-200">
          {selectedIds.length}
        </span>
      </div>

      <input
        data-testid="series-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="mt-4 h-10 w-full border border-zinc-700 bg-black px-3 text-sm text-zinc-100 placeholder:text-zinc-600"
        placeholder="ძებნა"
      />

      {limitMessage ? (
        <p data-testid="series-limit-message" className="mt-3 border border-amber-300/30 bg-amber-300/10 p-2 text-xs text-amber-100">
          {limitMessage}
        </p>
      ) : null}

      <div className="mt-4 flex max-h-[430px] flex-col gap-2 overflow-y-auto pr-1">
        {filteredItems.length === 0 ? (
          <div data-testid="series-no-results" className="border border-zinc-800 bg-zinc-950/75 p-3 text-sm text-zinc-400">
            ამ ძებნით სერია ვერ მოიძებნა.
          </div>
        ) : null}
        {filteredItems.map((item) => {
          const selected = selectedIds.includes(item.id);
          const disabled = chartMode === "stacked" && isDerivedTotalItemId(item.id);
          const row = values.get(item.id);
          const latest = latestYear === undefined ? null : row?.valuesByYear[latestYear] ?? null;

          return (
            <label
              key={item.id}
              className={`flex items-start gap-3 border p-3 transition ${
                disabled
                  ? "cursor-not-allowed border-zinc-900 bg-zinc-950/40 opacity-50"
                  : selected
                    ? "cursor-pointer border-cyan-300/70 bg-cyan-300/10 shadow-[0_0_18px_rgba(34,211,238,0.08)]"
                    : "cursor-pointer border-zinc-800 bg-zinc-950/75 hover:border-zinc-600"
              }`}
            >
              <input
                type="checkbox"
                checked={selected}
                disabled={disabled}
                onChange={() => onToggle(item.id)}
                className="mt-1 size-4 accent-cyan-300"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="size-2 shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="break-words text-sm text-zinc-100">{item.kaLabel}</span>
                </span>
                <span className="mt-1 block break-words font-mono text-[11px] text-zinc-500">{item.id}</span>
              </span>
              <span className="whitespace-nowrap font-mono text-xs text-zinc-400">{formatGel(latest)}</span>
            </label>
          );
        })}
      </div>
    </aside>
  );
}

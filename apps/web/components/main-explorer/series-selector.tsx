"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { isDerivedTotalItemId } from "../../lib/explorer/explorerData";
import { formatGel } from "../../lib/explorer/format";
import { MAX_CHART_SERIES, type ChartMode, type ExplorerItem, type ExplorerTableRow } from "../../lib/explorer/types";
import { StatusSurface } from "../ui/surfaces";

type SeriesSelectorProps = {
  items: ExplorerItem[];
  selectedIds: string[];
  rows: ExplorerTableRow[];
  years: number[];
  chartMode: ChartMode;
  limitMessage: string | null;
  headerControl?: ReactNode;
  onToggle: (itemId: string) => void;
  onDownloadCsv: () => void;
};

export function filterSeriesItems(items: ExplorerItem[], query: string): ExplorerItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return items;

  const matchedIds = new Set(
    items
      .filter((item) => {
        const haystack = `${item.kaLabel} ${item.enLabel} ${item.detailLabel ?? ""} ${item.id}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .map((item) => item.id),
  );

  for (const item of items) {
    if (matchedIds.has(item.id) && item.parentItemId) matchedIds.add(item.parentItemId);
  }

  return items.filter((item) => matchedIds.has(item.id));
}

export function SeriesSelector({ items, selectedIds, rows, years, chartMode, limitMessage, headerControl, onToggle, onDownloadCsv }: SeriesSelectorProps) {
  const [query, setQuery] = useState("");
  const latestYear = years.at(-1);
  const values = useMemo(() => new Map(rows.map((row) => [row.itemId, row])), [rows]);
  const filteredItems = filterSeriesItems(items, query);

  return (
    <aside data-testid="series-selector" className="order-2 min-w-0 max-w-full bg-[var(--surface)] lg:order-none lg:sticky lg:top-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-[-0.01em] text-[var(--ink)]">{"\u10e1\u10d4\u10e0\u10d8\u10d4\u10d1\u10d8"}</h2>
          <p className="sr-only">
            {chartMode === "table"
              ? "\u10ea\u10ee\u10e0\u10d8\u10da\u10e8\u10d8 \u10da\u10d8\u10db\u10d8\u10e2\u10d8 \u10d0\u10e0 \u10d0\u10e0\u10d8\u10e1"
              : `\u10d2\u10e0\u10d0\u10e4\u10d8\u10d9\u10d6\u10d4 \u10db\u10d0\u10e5\u10e1\u10d8\u10db\u10e3\u10db ${MAX_CHART_SERIES} \u10e1\u10d4\u10e0\u10d8\u10d0`}
          </p>
        </div>
        <span className="rounded-full bg-[var(--soft)] px-3 py-1 text-xs font-semibold text-[var(--primary)]">{selectedIds.length}</span>
      </div>
      {headerControl ? <div className="mt-4">{headerControl}</div> : null}

      <input
        data-testid="series-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="mt-4 h-11 w-full rounded-[12px] border border-[var(--hairline)] bg-[var(--canvas)] px-4 text-sm font-semibold text-[var(--ink)] placeholder:text-[var(--mute)]"
        placeholder={"\u10eb\u10d4\u10d1\u10dc\u10d0"}
      />

      {limitMessage ? (
        <div className="mt-3">
          <StatusSurface>{limitMessage}</StatusSurface>
        </div>
      ) : null}

      <div className="mt-5 flex max-h-[430px] flex-col gap-1 overflow-y-auto pr-1">
        {filteredItems.map((item) => {
          const selected = selectedIds.includes(item.id);
          const disabled = chartMode === "stacked" && isDerivedTotalItemId(item.id);
          const row = values.get(item.id);
          const latest = latestYear === undefined ? null : row?.valuesByYear[latestYear] ?? null;

          return (
            <label
              key={item.id}
              data-level={item.level}
              data-parent-id={item.parentItemId ?? undefined}
              className={`grid min-h-14 grid-cols-[auto_1fr] items-center gap-3 rounded-[10px] px-3 py-2 transition ${
                disabled
                  ? "cursor-not-allowed bg-[var(--soft)] opacity-50"
                  : selected
                    ? "cursor-pointer bg-[var(--canvas)]"
                    : "cursor-pointer bg-[var(--surface)] hover:bg-[var(--soft)]"
              }`}
            >
              <input
                type="checkbox"
                checked={selected}
                disabled={disabled}
                onChange={() => onToggle(item.id)}
                className="sr-only"
              />
              <span className="size-3 rounded-[4px]" style={{ backgroundColor: item.color }} />
              <span className="min-w-0" style={{ paddingLeft: item.parentItemId ? 16 : 0 }}>
                <span className="block break-words text-[13px] font-bold text-[var(--ink)]">{item.kaLabel}</span>
                {item.detailLabel ? <span className="block break-words text-[11px] font-semibold text-[var(--mute)]">{item.detailLabel}</span> : null}
                <span className="sr-only">{item.id}</span>
              </span>
              <span className="sr-only">{formatGel(latest)}</span>
            </label>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onDownloadCsv}
        className="mt-6 h-14 w-full rounded-[12px] bg-[var(--ink)] px-4 text-sm font-bold text-[var(--surface)] transition hover:opacity-90"
      >
        {"\u10db\u10dd\u10dc\u10d0\u10ea\u10d4\u10db\u10d4\u10d1\u10d8\u10e1 \u10e9\u10d0\u10db\u10dd\u10e2\u10d5\u10d8\u10e0\u10d7\u10d5\u10d0 CSV"}
      </button>
    </aside>
  );
}

"use client";

import { useState } from "react";
import type { ExplorerItem, ExplorerScope, ExplorerTableRow } from "../../lib/explorer/types";
import { MAX_CHART_SERIES, type ChartMode } from "../../lib/explorer/types";
import { formatAmount } from "../../lib/explorer/format";
import type { ExpenditureGrouping } from "../../lib/explorer/types";
import { Callout, SwatchBar, TextTab } from "../ui/editorial";

// Series aside per DESIGN.md §7.6–7.8: flat editorial rows with a checkbox square,
// swatch bar on selection, and (for ministries) caret-expandable major programs.

export type SeriesPanelRow = {
  item: ExplorerItem;
  isProgram: boolean;
  hasChildren: boolean;
  expanded: boolean;
  /** True while a search forces this row open (its programs matched) — the caret is inert then. */
  caretLocked: boolean;
};

function matches(item: ExplorerItem, query: string): boolean {
  return `${item.kaLabel} ${item.enLabel} ${item.id}`.toLowerCase().includes(query);
}

export function buildSeriesPanelRows(items: ExplorerItem[], query: string, expandedIds: string[]): SeriesPanelRow[] {
  const normalizedQuery = query.trim().toLowerCase();
  const total = items.find((item) => item.level === "total");
  const selectable = items.filter((item) => item.level !== "total");
  const categories = selectable.filter((item) => item.level !== "major_program");
  const programsByParent = new Map<string, ExplorerItem[]>();

  for (const item of selectable) {
    if (item.level !== "major_program") continue;
    const parentId = item.parentItemId ?? "";
    programsByParent.set(parentId, [...(programsByParent.get(parentId) ?? []), item]);
  }

  const rows: SeriesPanelRow[] = total
    ? [{ item: total, isProgram: false, hasChildren: false, expanded: false, caretLocked: false }]
    : [];

  for (const category of categories) {
    const programs = programsByParent.get(category.id) ?? [];
    const categoryMatches = !normalizedQuery || matches(category, normalizedQuery);
    const matchedPrograms = normalizedQuery ? programs.filter((program) => matches(program, normalizedQuery)) : programs;

    if (!categoryMatches && matchedPrograms.length === 0) continue;

    // While searching, ministries with matching programs auto-expand to the matches
    // (caret locked open); a name-matched ministry still honors the manual caret,
    // showing all its programs — the caret is never a silent no-op.
    const forcedOpen = Boolean(normalizedQuery) && matchedPrograms.length > 0;
    const expanded = forcedOpen || expandedIds.includes(category.id);

    rows.push({ item: category, isProgram: false, hasChildren: programs.length > 0, expanded, caretLocked: forcedOpen });

    if (expanded) {
      for (const program of forcedOpen ? matchedPrograms : programs) {
        rows.push({ item: program, isProgram: true, hasChildren: false, expanded: false, caretLocked: false });
      }
    }
  }

  return rows;
}

type SeriesPanelProps = {
  items: ExplorerItem[];
  rows: ExplorerTableRow[];
  scope: ExplorerScope;
  showGrouping: boolean;
  grouping: ExpenditureGrouping;
  selectedIds: string[];
  chartMode: ChartMode;
  endYear: number;
  limitMessage: string | null;
  expandedIds: string[];
  onGroupingChange: (grouping: ExpenditureGrouping) => void;
  onToggle: (itemId: string) => void;
  onToggleExpanded: (itemId: string) => void;
  onDownloadCsv: () => void;
};

export function SeriesPanel({
  items,
  rows,
  scope,
  showGrouping,
  grouping,
  selectedIds,
  chartMode,
  endYear,
  limitMessage,
  expandedIds,
  onGroupingChange,
  onToggle,
  onToggleExpanded,
  onDownloadCsv,
}: SeriesPanelProps) {
  // The query is panel-local so keystrokes re-render only this aside — the parent
  // keys this component by scope, which also resets the search on nav/grouping
  // switches consistently.
  const [query, setQuery] = useState("");
  const valuesByItem = new Map(rows.map((row) => [row.itemId, row]));
  const panelRows = buildSeriesPanelRows(items, query, expandedIds);
  const atLimit = chartMode !== "table" && selectedIds.length >= MAX_CHART_SERIES;
  const isMinistries = scope === "ministries";

  return (
    <aside
      aria-label="სერიები"
      data-testid="series-selector"
      className="min-w-0 max-w-full border-t-2 border-[var(--ink)] pt-[22px] @min-[1100px]:sticky @min-[1100px]:top-5 @min-[1100px]:border-t-0 @min-[1100px]:border-l @min-[1100px]:border-[var(--hairline)] @min-[1100px]:pt-0 @min-[1100px]:pl-[26px]"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">სერიები</h2>
        <span
          className="font-[family-name:var(--font-numeric)] text-[11px] font-medium"
          style={{ color: atLimit ? "var(--accent)" : "var(--ink)" }}
        >
          {chartMode === "table" ? String(selectedIds.length) : `${selectedIds.length} / ${MAX_CHART_SERIES}`}
        </span>
      </div>

      {showGrouping ? (
        <div className="mt-3.5 flex gap-[18px] border-b border-[var(--row-border)] pb-3">
          <TextTab label="სფეროები" active={grouping === "fields"} onClick={() => onGroupingChange("fields")} testId="grouping-fields" />
          <TextTab label="უწყებები" active={grouping === "ministries"} onClick={() => onGroupingChange("ministries")} testId="grouping-ministries" />
        </div>
      ) : null}

      <input
        data-testid="series-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={isMinistries ? "ძებნა — უწყება ან პროგრამა" : "ძებნა"}
        aria-label="ძებნა სერიებში"
        className="mt-3.5 h-[34px] w-full rounded-none border-0 border-b border-[var(--control)] bg-transparent px-0.5 text-[13px] text-[var(--ink)] placeholder:text-[var(--muted)]"
      />

      {limitMessage ? (
        <div className="mt-3">
          <Callout testId="series-limit-callout">{limitMessage}</Callout>
        </div>
      ) : null}

      {query.trim() && panelRows.length === 0 ? (
        <p className="mt-3.5 border-b border-[var(--row-border)] px-1 py-3 text-xs text-[var(--muted)]">
          0 შედეგი — შეცვალე საძიებო ტექსტი.
        </p>
      ) : null}

      <div className="mt-3.5 flex max-h-[430px] flex-col overflow-y-auto">
        {panelRows.map(({ item, isProgram, hasChildren, expanded, caretLocked }) => {
          const selected = selectedIds.includes(item.id);
          const latest = valuesByItem.get(item.id)?.valuesByYear[endYear] ?? null;
          const showRail = isProgram || (hasChildren && expanded);

          return (
            <div
              key={item.id}
              data-level={item.level}
              data-parent-id={item.parentItemId ?? undefined}
              className={`relative flex items-stretch border-b border-[var(--row-border)] transition-colors duration-100 hover:bg-[var(--tint)] ${
                selected ? "bg-[var(--tint)]" : "bg-transparent"
              }`}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute -top-px -bottom-px left-0 w-0.5"
                style={{ background: showRail ? "var(--accent)" : "transparent" }}
              />
              {isMinistries ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    // A search-forced row is already open to its matches; toggling
                    // hidden state now would only surface after clearing the search.
                    if (!caretLocked) onToggleExpanded(item.id);
                  }}
                  aria-expanded={expanded}
                  aria-label="ქვეპროგრამები"
                  aria-disabled={caretLocked || undefined}
                  className={`flex w-[22px] flex-none items-center justify-center text-base leading-none ${caretLocked ? "cursor-default" : "cursor-pointer"}`}
                  style={{ visibility: hasChildren ? "visible" : "hidden" }}
                  tabIndex={hasChildren && !caretLocked ? 0 : -1}
                >
                  <span style={{ color: expanded ? "var(--accent)" : "var(--ink)" }}>{expanded ? "▾" : "▸"}</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onToggle(item.id)}
                aria-pressed={selected}
                title={item.kaLabel}
                className={`flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 text-left ${
                  isProgram ? "py-[7px] pr-1.5 pl-0.5" : "py-[9px] pr-1.5 pl-1"
                }`}
              >
                <span
                  aria-hidden
                  className="mt-0.5 inline-flex size-3.5 flex-none items-center justify-center text-[9.5px] leading-none text-[var(--paper)]"
                  style={{
                    border: `1.5px solid ${selected ? "var(--accent)" : "var(--control)"}`,
                    background: selected ? "var(--accent)" : "transparent",
                  }}
                >
                  {selected ? "✓" : ""}
                </span>
                <span className="flex min-w-0 flex-1 items-start gap-2">
                  {selected ? <SwatchBar color={item.color} className="mt-[7px]" /> : null}
                  <span
                    className={`line-clamp-2 leading-[1.35] ${
                      isProgram
                        ? `text-[11.5px] font-normal text-[var(--body)]`
                        : `text-[12.5px] ${expanded && hasChildren ? "font-semibold" : "font-medium"} text-[var(--ink)]`
                    }`}
                  >
                    {item.kaLabel}
                  </span>
                </span>
                <span className="mt-0.5 flex-none font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
                  {formatAmount(latest)}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onDownloadCsv}
        className="mt-[18px] h-[38px] w-full cursor-pointer rounded-[2px] bg-[var(--ink)] text-[12.5px] font-semibold text-[var(--paper)] transition-opacity duration-150 hover:opacity-85"
      >
        CSV ჩამოტვირთვა
      </button>
    </aside>
  );
}

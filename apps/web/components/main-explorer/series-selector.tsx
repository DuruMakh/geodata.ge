"use client";

import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import type { FocusEvent, ReactNode } from "react";
import { SwatchBar } from "../ui/editorial";
import { withLari } from "../ui/lari";

/**
 * On a stacked (<1100px) layout, focusing a search field scrolls it to the top of the
 * viewport, so its results land above the on-screen keyboard instead of under it.
 * Wide layouts keep their position: the series aside is sticky there.
 */
export function revealSearchField(event: FocusEvent<HTMLInputElement>) {
  if (!window.matchMedia("(max-width: 1099.98px)").matches) return;
  event.currentTarget.scrollIntoView({ block: "start" });
}

/** Mobile keyboard hints shared by the site's search fields. */
export const SEARCH_FIELD_PROPS = { type: "search", enterKeyHint: "search", onFocus: revealSearchField } as const;

type SeriesSelectorProps = {
  controls?: ReactNode;
  query: string;
  onQueryChange: (query: string) => void;
  searchPlaceholder: string;
  countLabel?: string;
  selectedCount: number;
  totalCount: number;
  supplementalSelected?: { label: string; count: number };
  hasSelection: boolean;
  allSelected: boolean;
  onToggleAll: () => void;
  allowSelectAll?: boolean;
  hasVisibleMatches: boolean;
  /** Optional visible names for the row values, shown above the list. */
  listHeader?: ReactNode;
  children: ReactNode;
};

export function SeriesSelector({
  controls,
  query,
  onQueryChange,
  searchPlaceholder,
  countLabel,
  selectedCount,
  totalCount,
  supplementalSelected,
  hasSelection,
  allSelected,
  onToggleAll,
  allowSelectAll = true,
  hasVisibleMatches,
  listHeader,
  children,
}: SeriesSelectorProps) {
  const { messages } = useI18n();
  const bulkState: "false" | "mixed" | "true" =
    hasSelection && allSelected ? "true" : hasSelection ? "mixed" : "false";
  const bulkMark = bulkState === "true" ? "✓" : bulkState === "mixed" ? "—" : "";

  return (
    <div data-testid="series-selector">
      {controls ? <div data-selector-section="controls">{controls}</div> : null}

      <input
        data-testid="series-search"
        data-selector-section="search"
        {...SEARCH_FIELD_PROPS}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={searchPlaceholder}
        aria-label={message(messages, "controls.searchSeries")}
        className={`${controls ? "mt-3.5" : ""} h-[34px] w-full scroll-mt-3 appearance-none rounded-none border-0 border-b border-[var(--control)] bg-transparent px-0.5 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]`}
      />

      <div
        data-testid="series-actions"
        data-selector-section="actions"
        className="mt-3.5 flex items-center justify-between gap-4 pb-2.5"
      >
        {hasSelection || allowSelectAll ? (
          <button
            type="button"
            role="checkbox"
            data-testid="series-toggle-all"
            aria-checked={bulkState}
            onClick={onToggleAll}
            className="grid min-h-11 shrink-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-2 pr-1 pl-0.5 text-left"
          >
            <span
              aria-hidden
              data-testid="series-toggle-indicator"
              className="inline-flex size-3.5 items-center justify-center border-[1.5px] text-[9px] leading-none"
              style={{
                borderColor: bulkState === "false" ? "var(--control)" : "var(--ink)",
                backgroundColor: bulkState === "true" ? "var(--ink)" : "transparent",
                color: bulkState === "true" ? "var(--paper)" : "var(--ink)",
              }}
            >
              {bulkMark}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink)]">
              {message(messages, hasSelection ? "controls.clear" : "controls.selectAll")}
            </span>
          </button>
        ) : null}

        <span
          data-testid="series-status"
          className="ml-auto text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]"
        >
          <span className="inline-block whitespace-nowrap">
            {countLabel ?? message(messages, "controls.series")}{" "}
            <span className="font-[family-name:var(--font-numeric)] text-[11px] min-[768px]:text-[10.5px] font-normal text-[var(--faint)]">
              {selectedCount} / {totalCount}
            </span>
          </span>
          {supplementalSelected ? (
            <>
              {" · "}<span className="inline-block whitespace-nowrap">
                {supplementalSelected.label}{" "}
                <span className="font-[family-name:var(--font-numeric)] text-[11px] min-[768px]:text-[10.5px] font-normal text-[var(--faint)]">
                  {supplementalSelected.count}
                </span>
              </span>
            </>
          ) : null}
        </span>
      </div>

      {!hasVisibleMatches ? (
        <p className="border-b border-[var(--row-border)] px-1 py-3 text-xs text-[var(--muted)]">
          {message(messages, "controls.noMatches")}
        </p>
      ) : null}

      {listHeader}

      <div
        data-testid="series-list"
        data-selector-section="list"
        // The 430px inner scroll belongs to the sticky two-column aside; stacked under the
        // chart (owner decision D4, 2026-10-07) the list flows with the page, so a finger
        // swipe never gets caught inside it.
        // overflow-y clip keeps the last caret's downward hit extension inside the list.
        className="flex flex-col overflow-y-clip @min-[1100px]:max-h-[430px] @min-[1100px]:overflow-y-auto"
      >
        {children}
      </div>
    </div>
  );
}

type SeriesSelectorRowProps = {
  id: string;
  label: string;
  color: string;
  value: string;
  /** A second, quieter metric before the value (the category panel's basket share). */
  meta?: string;
  /** Names `meta` for a screen reader, so the row is not two unlabelled percentages. */
  metaLabel?: string;
  /** Optional decorative icon beside the label; the official text remains the accessible name. */
  art?: ReactNode;
  selected: boolean;
  level?: string;
  parentId?: string | null;
  showCaretColumn?: boolean;
  hasChildren?: boolean;
  expanded?: boolean;
  expansionLocked?: boolean;
  expansionLabel?: string;
  showRail?: boolean;
  isChild?: boolean;
  childLabelSize?: "compact" | "standard";
  wrapLabel?: boolean;
  swatch?: "solid" | "dashed";
  onToggle: () => void;
  onToggleExpanded?: () => void;
};

export function SeriesSelectorRow({
  id,
  label,
  color,
  value,
  meta,
  metaLabel,
  art,
  selected,
  level,
  parentId,
  showCaretColumn = false,
  hasChildren = false,
  expanded = false,
  expansionLocked = false,
  expansionLabel,
  showRail = false,
  isChild = false,
  childLabelSize = "compact",
  wrapLabel = false,
  swatch = "solid",
  onToggle,
  onToggleExpanded,
}: SeriesSelectorRowProps) {
  const { messages } = useI18n();
  return (
    <div
      data-testid="series-row"
      data-series-id={id}
      data-level={level}
      data-parent-id={parentId ?? undefined}
      className={`relative flex items-stretch border-b border-[var(--row-border)] transition-colors duration-100 hover:bg-[var(--tint)] ${selected ? "bg-[var(--tint)]" : "bg-transparent"}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-px -bottom-px left-0 w-0.5"
        style={{ background: showRail ? "var(--accent)" : "transparent" }}
      />

      {showCaretColumn ? (
        <button
          type="button"
          onClick={() => {
            if (!expansionLocked) onToggleExpanded?.();
          }}
          aria-expanded={hasChildren ? expanded : undefined}
          aria-label={expansionLabel ?? message(messages, "controls.subprogrammes")}
          aria-disabled={expansionLocked || undefined}
          // The caret keeps its 22px column; a transparent extension over the row button's
          // empty left padding makes the hit area 26px wide (WCAG 2.5.8 asks for 24px), and
          // 12px below the row it reaches 44px tall (D8). The extension only runs downward:
          // a following row's own caret paints over it, so it never steals that row's taps,
          // and it only lands in the empty caret gutter of a row without children.
          className={`relative z-[1] flex w-[22px] flex-none items-center justify-center text-base leading-none before:absolute before:top-0 before:-bottom-3 before:left-0 before:-right-1 before:content-[""] ${expansionLocked ? "cursor-default" : "cursor-pointer"}`}
          style={{ visibility: hasChildren ? "visible" : "hidden" }}
          tabIndex={hasChildren && !expansionLocked ? 0 : -1}
        >
          <span style={{ color: expanded ? "var(--accent)" : "var(--ink)" }}>{expanded ? "▾" : "▸"}</span>
        </button>
      ) : null}

      <button
        type="button"
        data-testid="series-row-toggle"
        onClick={onToggle}
        aria-pressed={selected}
        title={label}
        className={`flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 py-[7px] pr-1.5 text-left ${isChild ? "pl-0.5" : "pl-1"}`}
      >
        <span
          aria-hidden
          className="mt-0.5 inline-flex size-3.5 flex-none items-center justify-center border-[1.5px] text-[9.5px] leading-none text-[var(--paper)]"
          style={{ borderColor: selected ? color : "var(--control)", background: selected ? color : "transparent" }}
        >
          {selected ? "✓" : ""}
        </span>
        <span className="flex min-w-0 flex-1 items-start gap-2">
          <span data-testid="series-swatch" className="mt-[7px] flex-none">
            {swatch === "dashed" ? <DashedSwatch color={color} /> : <SwatchBar color={color} />}
          </span>
          {art ? <span className="-mt-1 flex-none" aria-hidden="true">{art}</span> : null}
          <span
            data-testid="series-label"
            className={`${wrapLabel ? "min-w-0 break-words" : "line-clamp-2"} leading-[1.35] ${isChild ? `${childLabelSize === "standard" ? "text-[12px]" : "text-[11.5px]"} font-normal text-[var(--body)]` : "text-[12.5px] font-medium text-[var(--ink)]"}`}
          >
            {label}
          </span>
        </span>
        {meta === undefined ? null : (
          <span className="mt-0.5 flex-none font-[family-name:var(--font-numeric)] text-[11px] min-[768px]:text-[10px] whitespace-nowrap text-[var(--muted)]">
            {metaLabel === undefined ? null : <span className="sr-only">{metaLabel} </span>}
            {meta}
          </span>
        )}
        <span className="mt-0.5 flex-none font-[family-name:var(--font-numeric)] text-[11px] min-[768px]:text-[10.5px] whitespace-nowrap text-[var(--muted)]">
          {withLari(value)}
        </span>
      </button>
    </div>
  );
}

// Reference rows (a target, not a series) match their dashed chart line.
function DashedSwatch({ color }: { color: string }) {
  return (
    <svg aria-hidden width={14} height={3} className="block flex-none">
      <line x1={0} y1={1.5} x2={14} y2={1.5} stroke={color} strokeWidth={3} strokeDasharray="4 2" />
    </svg>
  );
}

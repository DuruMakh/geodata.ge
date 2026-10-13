"use client";

import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { useRef, type FocusEvent, type ReactNode } from "react";
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

/** A series list with this many rows or fewer drops its search field: it is read at a glance. */
export const SEARCHABLE_MIN_ROWS = 10;

/** A series list with more rows than this scrolls inside its panel at every width (`listLayout="scroll"`). */
export const LONG_LIST_ROWS = 30;

/** Mobile keyboard hints shared by the site's search fields. */
export const SEARCH_FIELD_PROPS = { type: "search", enterKeyHint: "search", onFocus: revealSearchField } as const;

type SeriesSelectorProps = {
  controls?: ReactNode;
  controlsAfterSearch?: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  searchPlaceholder: string;
  /** False hides the search field: a list of ten rows or fewer is read at a glance. */
  searchable?: boolean;
  searchFocus?: "page" | "local";
  /** "scroll" caps a long list in its own scroller at every width and adds a "skip the list" button before it. */
  listLayout?: "aside" | "flow" | "scroll";
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
  controlsAfterSearch = false,
  query,
  onQueryChange,
  searchPlaceholder,
  searchable = true,
  searchFocus = "page",
  listLayout = "aside",
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
  const listEnd = useRef<HTMLSpanElement>(null);
  const bulkState: "false" | "mixed" | "true" =
    hasSelection && allSelected ? "true" : hasSelection ? "mixed" : "false";
  const bulkMark = bulkState === "true" ? "✓" : bulkState === "mixed" ? "—" : "";
  const selectorControls = controls ? <div data-selector-section="controls" className={controlsAfterSearch ? "mt-3.5 mb-1" : undefined}>{controls}</div> : null;

  return (
    <div data-testid="series-selector">
      {!controlsAfterSearch ? selectorControls : null}

      {searchable ? (
        <input
          data-testid="series-search"
          data-selector-section="search"
          {...SEARCH_FIELD_PROPS}
          onFocus={searchFocus === "page" ? revealSearchField : undefined}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={message(messages, "controls.searchSeries")}
          className={`${controls && !controlsAfterSearch ? "mt-3.5" : ""} h-[34px] w-full scroll-mt-3 appearance-none rounded-none border-0 border-b border-[var(--control)] bg-transparent px-0.5 text-[0.8125rem] text-[var(--ink)] outline-none placeholder:text-[var(--muted)]`}
        />
      ) : null}

      {controlsAfterSearch ? selectorControls : null}

      <div
        data-testid="series-actions"
        data-selector-section="actions"
        // The bulk toggle is the full 44px height of this row (D8 touch target); the
        // row's margins shrink by the same amount, so the list does not move.
        className="mt-1 flex flex-wrap items-center justify-between gap-x-4 pb-0.5"
      >
        {hasSelection || allowSelectAll ? (
          <button
            type="button"
            data-testid="series-toggle-all"
            // A plain action button named by its visible word (WCAG 2.5.3): a checkbox called
            // "Clear" that reports a mixed state confuses a screen reader. The square is decoration.
            data-state={bulkState}
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
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--ink)]">
              {message(messages, hasSelection ? "controls.clear" : "controls.selectAll")}
            </span>
          </button>
        ) : null}

        <span
          data-testid="series-status"
          className="ml-auto text-right text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]"
        >
          <span className="inline-block whitespace-nowrap">
            {countLabel ?? message(messages, "controls.series")}{" "}
            <span className="font-[family-name:var(--font-numeric)] text-[0.6875rem] min-[768px]:text-[10.5px] font-normal text-[var(--faint)]">
              {selectedCount} / {totalCount}
            </span>
          </span>
          {supplementalSelected ? (
            <>
              {" · "}<span className="inline-block whitespace-nowrap">
                {supplementalSelected.label}{" "}
                <span className="font-[family-name:var(--font-numeric)] text-[0.6875rem] min-[768px]:text-[10.5px] font-normal text-[var(--faint)]">
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

      {listLayout === "scroll" ? (
        // A button, not an in-page link: these pages keep their state in the URL hash.
        <button
          type="button"
          data-testid="series-skip-list"
          onClick={() => listEnd.current?.focus()}
          className="sr-only cursor-pointer text-[12px] font-semibold text-[var(--accent)] underline underline-offset-4 focus:not-sr-only focus:mb-1 focus:inline-flex focus:min-h-11 focus:items-center"
        >
          {message(messages, "controls.skipList")}
        </button>
      ) : null}

      <div
        data-testid="series-list"
        data-selector-section="list"
        // The 430px inner scroll belongs to the sticky two-column aside; stacked under the
        // chart (owner decision D4, 2026-10-07) the list flows with the page, so a finger
        // swipe never gets caught inside it. A list over LONG_LIST_ROWS rows ("scroll")
        // keeps its own scroller at every width, or it would push the rest of the page
        // thousands of pixels down (DESIGN §7.7).
        // overflow-y clip keeps the last caret's downward hit extension inside the list.
        className={listLayout === "scroll" ? "flex max-h-[min(430px,60svh)] flex-col overflow-y-auto" : listLayout === "aside" ? "flex flex-col overflow-y-clip @min-[1100px]:max-h-[430px] @min-[1100px]:overflow-y-auto" : "flex flex-col overflow-y-clip"}
      >
        {children}
      </div>
      {listLayout === "scroll" ? <span ref={listEnd} tabIndex={-1} className="outline-none" /> : null}
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
  selectionRole?: "button" | "checkbox";
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
  /** Keeps the row listed but inert and unticked (`aria-disabled`, no toggle); the reason is its tooltip. */
  disabledReason?: string;
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
  selectionRole = "button",
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
  disabledReason,
  onToggle,
  onToggleExpanded,
}: SeriesSelectorRowProps) {
  const { messages } = useI18n();
  const disabled = disabledReason !== undefined;
  const ticked = selected && !disabled;
  return (
    <div
      data-testid="series-row"
      data-series-id={id}
      data-level={level}
      data-parent-id={parentId ?? undefined}
      className={`relative flex items-stretch border-b border-[var(--row-border)] transition-colors duration-100 ${disabled ? "" : "hover:bg-[var(--tint)]"} ${ticked ? "bg-[var(--tint)]" : "bg-transparent"}`}
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
          aria-label={expansionLabel ?? message(messages, "controls.subitemsFor", { label })}
          aria-disabled={expansionLocked || undefined}
          // The caret's own box is 24px wide (WCAG 2.5.8, which axe measures on the element), and
          // a transparent extension 12px below the row makes it 44px tall (D8). The extension only runs downward:
          // a following row's own caret paints over it, so it never steals that row's taps,
          // and it only lands in the empty caret gutter of a row without children.
          className={`relative z-[1] flex w-6 flex-none items-center justify-center text-base leading-none before:absolute before:top-0 before:-bottom-3 before:inset-x-0 before:content-[""] ${expansionLocked ? "cursor-default" : "cursor-pointer"}`}
          style={{ visibility: hasChildren ? "visible" : "hidden" }}
          tabIndex={hasChildren && !expansionLocked ? 0 : -1}
        >
          <span style={{ color: expanded ? "var(--accent)" : "var(--ink)" }}>{expanded ? "▾" : "▸"}</span>
        </button>
      ) : null}

      <button
        type="button"
        data-testid="series-row-toggle"
        onClick={disabled ? undefined : onToggle}
        role={selectionRole === "checkbox" ? "checkbox" : undefined}
        aria-checked={selectionRole === "checkbox" ? ticked : undefined}
        aria-pressed={selectionRole === "button" ? ticked : undefined}
        aria-disabled={disabled || undefined}
        title={disabledReason ?? label}
        className={`flex min-w-0 flex-1 ${disabled ? "cursor-default opacity-55" : "cursor-pointer"} items-start gap-2.5 py-[7px] pr-1.5 text-left ${isChild ? "pl-0.5" : "pl-1"}`}
      >
        <span
          aria-hidden
          className="mt-0.5 inline-flex size-3.5 flex-none items-center justify-center border-[1.5px] text-[9.5px] leading-none text-[var(--paper)]"
          style={{ borderColor: ticked ? color : "var(--control)", background: ticked ? color : "transparent" }}
        >
          {ticked ? "✓" : ""}
        </span>
        <span className="flex min-w-0 flex-1 items-start gap-2">
          <span data-testid="series-swatch" className="mt-[7px] flex-none">
            {swatch === "dashed" ? <DashedSwatch color={color} /> : <SwatchBar color={color} />}
          </span>
          {art ? <span className="-mt-1 flex-none" aria-hidden="true">{art}</span> : null}
          <span
            data-testid="series-label"
            className={`${wrapLabel ? "min-w-0 break-words" : "min-w-0 break-words min-[768px]:line-clamp-2"} leading-[1.35] ${isChild ? `${childLabelSize === "standard" ? "text-[0.75rem]" : "text-[0.71875rem]"} font-normal text-[var(--body)]` : "text-[0.78125rem] font-medium text-[var(--ink)]"}`}
          >
            {label}
          </span>
        </span>
        {meta === undefined ? null : (
          <span className="mt-0.5 flex-none font-[family-name:var(--font-numeric)] text-[0.6875rem] min-[768px]:text-[10px] whitespace-nowrap text-[var(--muted)]">
            {metaLabel === undefined ? null : <span className="sr-only">{metaLabel} </span>}
            {meta}
          </span>
        )}
        <span className="mt-0.5 flex-none font-[family-name:var(--font-numeric)] text-[0.6875rem] min-[768px]:text-[10.5px] whitespace-nowrap text-[var(--muted)]">
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

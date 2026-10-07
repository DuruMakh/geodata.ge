"use client";

import type { ReactNode } from "react";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { SwatchBar } from "../ui/editorial";
import type { TooltipRow } from "./editorial-line-chart";

/**
 * Scroll instead of shrink on narrow screens: an unbounded w-full SVG scales its
 * text below the DESIGN.md §13 legibility floor on phones.
 *
 * Exception, 900–1019px: the shell's sidebar leaves the column under 720px, so the
 * floor would put a scrollbar under a desktop-width chart. There the chart shrinks
 * to fit instead — an approved trade of label size for a whole chart (DESIGN.md
 * §12). Below 900px the sidebar is a top bar and the column is wide again, so
 * phones keep the scroll. The inner box is `relative` so a tooltip can position.
 */
export function ChartScrollFrame({
  children,
  testId = "chart-frame",
}: {
  children: ReactNode;
  testId?: string;
}) {
  const { messages } = useI18n();
  return (
    <div
      data-testid={testId}
      role="region"
      tabIndex={0}
      aria-label={message(messages, "controls.chartScrollable")}
      className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
    >
      <div className="relative min-w-[720px] min-[900px]:max-[1020px]:min-w-0">{children}</div>
    </div>
  );
}

/** The bounded hover readout (DESIGN.md §8.3): absolutely positioned, so it never moves the page. */
export function ChartTooltip({
  leftPercent,
  header,
  headerRight = null,
  rows,
  hidden,
  formatValue,
  preliminaryLabel,
  testId = "chart-tooltip",
}: {
  leftPercent: number;
  header: string;
  headerRight?: string | null;
  rows: TooltipRow[];
  hidden: number;
  formatValue: (value: number) => string;
  preliminaryLabel?: string;
  testId?: string;
}) {
  const { messages } = useI18n();
  return (
    <div
      data-testid={testId}
      className="pointer-events-none absolute top-0 z-[2] flex max-h-full min-w-[200px] flex-col gap-1 overflow-hidden rounded-[3px] border border-[var(--hairline)] bg-[var(--tile)] px-2.5 py-2 shadow-[0_4px_16px_rgba(30,27,22,0.10)]"
      style={{
        left: `${leftPercent}%`,
        transform: leftPercent > 60 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
      }}
    >
      <div className="mb-0.5 flex justify-between gap-3 font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--muted)]">
        <span>{header}</span>
        {headerRight ? <span>{headerRight}</span> : null}
      </div>
      {rows.map((row) => (
        <div key={row.id} className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--body)]">
            <SwatchBar color={row.color} className="!w-3" />
            <span className="max-w-[190px] overflow-hidden text-ellipsis whitespace-nowrap">{row.label}</span>
          </span>
          <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--ink)]">
            {formatValue(row.value)}
            {row.preliminary && preliminaryLabel ? <sup className="ml-1 text-[9px]">{preliminaryLabel}</sup> : null}
          </span>
        </div>
      ))}
      {hidden > 0 ? (
        <div className="pt-0.5 text-[10.5px] text-[var(--muted)]">+{hidden} {message(messages, "controls.other")}</div>
      ) : null}
    </div>
  );
}

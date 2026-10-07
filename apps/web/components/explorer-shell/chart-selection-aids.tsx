"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatInUnit, formatShare, MISSING, type ValueUnit } from "../../lib/explorer/format";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { SwatchBar } from "../ui/editorial";

// Owner decision D4 (2026-10-07), phones only. Rendered directly under the chart (or
// table) inside its chart panel (the nearest [data-chart-panel] or <section>):
// - a compact legend of the selected lines, each with its latest value, when two or more
//   lines are drawn (below 768px of column width);
// - a floating "↑ chart" pill that appears when the selection changes while the chart is
//   off-screen (stacked layouts, below 1100px), and leads back to it.

export type AidSeries = { id: string; label: string; color: string; vals: (number | null)[] };

/** How long the pill waits for the next selection change before it leaves. */
export const RETURN_PILL_MS = 4000;
const SWATCH_CAP = 6;

/** The legend's value for a line: its value in the last period drawn, formatted like the chart. */
export function legendValue(
  vals: readonly (number | null)[],
  { share, unit, formatValue }: { share: boolean; unit: ValueUnit; formatValue?: (value: number) => string },
): string {
  const value = vals.at(-1);
  if (value === null || value === undefined) return MISSING;
  if (formatValue) return formatValue(value);
  return share ? formatShare(value / 100) : `${formatInUnit(value, unit)} ${unit.label}`.trim();
}

/** Whether `visible` px of a `height` px element are enough to call it in view on a `viewport` px screen. */
export function enoughInView(visible: number, height: number, viewport: number): boolean {
  return visible > 0 && visible >= Math.min(height, viewport) / 2;
}

// The chart (or table) is the element just before the aids; half of it, or half a
// screen of it, counts as in view.
function chartInView(anchor: HTMLElement | null): boolean {
  const target = anchor?.previousElementSibling ?? anchor?.closest("[data-chart-panel], section");
  if (!target) return true;
  const box = target.getBoundingClientRect();
  const visible = Math.min(box.bottom, window.innerHeight) - Math.max(box.top, 0);
  return enoughInView(visible, box.height, window.innerHeight);
}

export function ChartSelectionAids({
  series,
  chartShown,
  share,
  unit,
  formatValue,
}: {
  /** The selected series, in the chart's own units (shares ×100, as EditorialLineChart takes them). */
  series: AidSeries[];
  /** The chart, not the table, is showing: the legend belongs under it. */
  chartShown: boolean;
  share: boolean;
  unit: ValueUnit;
  formatValue?: (value: number) => string;
}) {
  const { messages } = useI18n();
  const anchor = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState(false);
  const selectionKey = series.map((line) => line.id).join(",");
  const previousKey = useRef(selectionKey);

  useEffect(() => {
    if (previousKey.current === selectionKey) return;
    previousKey.current = selectionKey;
    if (chartInView(anchor.current)) return;
    setPill(true);
    const timer = window.setTimeout(() => setPill(false), RETURN_PILL_MS);
    return () => window.clearTimeout(timer);
  }, [selectionKey]);

  useEffect(() => {
    if (!pill) return;
    const onScroll = () => {
      if (chartInView(anchor.current)) setPill(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pill]);

  const returnToChart = () => {
    setPill(false);
    const panel = anchor.current?.closest("[data-chart-panel], section") ?? anchor.current;
    if (!panel) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: panel.getBoundingClientRect().top + window.scrollY - 12, behavior: reduced ? "auto" : "smooth" });
  };

  const label = message(messages, chartShown ? "controls.backToChart" : "controls.backToTable");

  return (
    <div ref={anchor}>
      {chartShown && series.length >= 2 ? (
        <ul data-testid="chart-phone-legend" aria-label={message(messages, "controls.legend")} className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-[var(--muted)] @min-[768px]:hidden">
          {series.map((line) => (
            <li key={line.id} data-series-id={line.id} className="flex min-w-0 items-center gap-2">
              <SwatchBar color={line.color} />
              <span className="min-w-0 break-words">{line.label}</span>
              <span className="font-[family-name:var(--font-numeric)] whitespace-nowrap text-[var(--ink)]">{legendValue(line.vals, { share, unit, formatValue })}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(16px,env(safe-area-inset-bottom))] @min-[1100px]:hidden">
        {pill ? (
          <button
            type="button"
            data-testid="chart-return-pill"
            aria-label={`${label}, ${message(messages, "controls.backUp")}`}
            onClick={returnToChart}
            className="pointer-events-auto inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-full border border-[var(--ink)] bg-[var(--paper)] px-4 text-[13px] font-semibold text-[var(--ink)] shadow-[0_2px_12px_rgba(0,0,0,0.18)]"
          >
            {series.length > 0 ? (
              <span aria-hidden className="flex items-center gap-1">
                {series.slice(0, SWATCH_CAP).map((line) => <SwatchBar key={line.id} color={line.color} />)}
                {series.length > SWATCH_CAP ? <span className="font-[family-name:var(--font-numeric)] text-[11px] font-normal text-[var(--muted)]">+{series.length - SWATCH_CAP}</span> : null}
              </span>
            ) : null}
            <ArrowUp aria-hidden size={18} strokeWidth={1.5} />
            {label}
          </button>
        ) : null}
      </div>
    </div>
  );
}

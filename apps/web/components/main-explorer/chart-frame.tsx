"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { nearestPeriodIndex } from "../../lib/explorer/chartNavigation";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { SwatchBar } from "../ui/editorial";
import type { TooltipRow } from "./editorial-line-chart";

/** A copy of a chart's y-axis labels that stays put while the plot scrolls under it. */
export type StickyYAxis = {
  /** An svg sharing the chart's viewBox height, `widthPercent` of its width. */
  node: ReactNode;
  /** The axis column as a percentage of the chart's viewBox width. */
  widthPercent: number;
};

/**
 * Scroll instead of shrink on narrow screens: an unbounded w-full SVG scales its
 * text below the DESIGN.md §13 legibility floor on phones.
 *
 * Exception, 900–1019px: the shell's sidebar leaves the column under 720px, so the
 * floor would put a scrollbar under a desktop-width chart. There the chart shrinks
 * to fit instead — an approved trade of label size for a whole chart (DESIGN.md
 * §12). Below 900px the sidebar is a top bar and the column is wide again, so
 * phones keep the scroll. The inner box is `relative` so a tooltip can position.
 *
 * When it scrolls, the frame opens on the latest data (the right edge) and
 * re-opens there whenever `scrollKey` changes (range, series); a sticky copy of
 * the y axis keeps the values readable once the axis itself has scrolled away.
 */
export function ChartScrollFrame({
  children,
  testId = "chart-frame",
  scrollKey,
  yAxis,
  overlay,
}: {
  children: ReactNode;
  testId?: string;
  scrollKey?: string;
  yAxis?: StickyYAxis;
  /** Drawn over the visible part of the frame, whatever its scroll position (a tapped readout). */
  overlay?: ReactNode;
}) {
  const { messages } = useI18n();
  const scroller = useRef<HTMLDivElement>(null);
  // Starts false on the server and the client alike, so hydration matches; the
  // sticky axis only appears once the browser has measured an overflow.
  const [overflowing, setOverflowing] = useState(false);
  const [visibleWidth, setVisibleWidth] = useState(0);

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const measure = () => {
      setOverflowing(element.scrollWidth > element.clientWidth + 1);
      setVisibleWidth(element.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Layout effect: the jump to the latest data lands before the first paint
  // after hydration, not as a visible slide. A frame that fits has nothing to do.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (element && element.scrollWidth > element.clientWidth + 1) element.scrollLeft = element.scrollWidth;
  }, [scrollKey]);

  return (
    <div
      ref={scroller}
      data-testid={testId}
      role="region"
      tabIndex={0}
      aria-label={message(messages, "controls.chartScrollable")}
      className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
    >
      <div className="relative grid min-w-[720px] min-[900px]:max-[1020px]:min-w-0">
        <div className="col-start-1 row-start-1 min-w-0">{children}</div>
        {overflowing && yAxis ? (
          <div
            aria-hidden
            data-testid={`${testId}-y-axis`}
            className="pointer-events-none sticky left-0 z-[1] col-start-1 row-start-1 self-start bg-[var(--paper)]"
            style={{ width: `${yAxis.widthPercent}%` }}
          >
            {yAxis.node}
          </div>
        ) : null}
        {overlay ? (
          <div
            className="pointer-events-none sticky left-0 z-[3] col-start-1 row-start-1"
            style={{ width: visibleWidth > 0 ? `${visibleWidth}px` : "100%" }}
          >
            {overlay}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export type PinnedSide = "left" | "right";

/**
 * Pointer state shared by the SVG charts. A mouse reads the chart by hovering.
 * Touch has no hover, and a touch pointer "leaves" on every pointerup, so a tap
 * pins the readout instead: the tapped period stays active until the same period
 * is tapped again or a tap lands outside the chart. Drags are left to the
 * browser, so vertical page scrolling and the frame's sideways scroll still work.
 */
export function useChartPointer(count: number, width: number, padLeft: number, padRight: number) {
  const [hoverRaw, setHoverRaw] = useState<number | null>(null);
  const [pinnedRaw, setPinned] = useState<PinnedSide | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const lastPointerType = useRef("mouse");
  // The index survives range shrinks (no pointer event fires), so clamp it
  // instead of trusting it — a stale index would render a ghost tooltip.
  const hover = hoverRaw !== null && hoverRaw < count ? hoverRaw : null;
  const pinned = hover !== null && pinnedRaw ? pinnedRaw : null;
  const setState = (next: { index: number; pinned: PinnedSide | null } | null) => {
    setHoverRaw(next === null ? null : next.index);
    setPinned(next === null ? null : next.pinned);
  };

  useEffect(() => {
    if (pinned === null) return;
    const release = (event: PointerEvent) => {
      if (svgRef.current?.contains(event.target as Node)) return;
      setHoverRaw(null);
      setPinned(null);
    };
    document.addEventListener("pointerdown", release);
    return () => document.removeEventListener("pointerdown", release);
  }, [pinned]);

  const indexAt = (event: { clientX: number; currentTarget: Element }) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return nearestPeriodIndex((event.clientX - rect.left) / rect.width, count, width, padLeft, padRight);
  };

  const handlers = {
    onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => {
      lastPointerType.current = event.pointerType;
    },
    onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => {
      if (event.pointerType === "touch" || count === 0) return;
      const index = indexAt(event);
      if (index !== hover || pinned !== null) setState({ index, pinned: null });
    },
    onPointerLeave: (event: ReactPointerEvent<SVGSVGElement>) => {
      if (event.pointerType !== "touch") setState(null);
    },
    onClick: (event: ReactMouseEvent<SVGSVGElement>) => {
      if (lastPointerType.current !== "touch" || count === 0) return;
      const index = indexAt(event);
      if (pinned !== null && index === hover) {
        setState(null);
        return;
      }
      // The readout goes to the half of the visible frame the finger is not on.
      const visible = (event.currentTarget.closest('[role="region"]') ?? event.currentTarget).getBoundingClientRect();
      setState({ index, pinned: event.clientX - visible.left > visible.width / 2 ? "left" : "right" });
    },
  };

  return {
    svgRef,
    hover,
    pinned,
    setHover: (index: number | null) => setState(index === null ? null : { index, pinned: null }),
    handlers,
  };
}

/**
 * The bounded hover readout (DESIGN.md §8.3): absolutely positioned, so it never
 * moves the page. A pinned (tapped) readout sits in a top corner of the frame's
 * visible part instead of beside the guide, so a scrolled phone frame never cuts it.
 */
export function ChartTooltip({
  leftPercent,
  pinned = null,
  header,
  headerRight = null,
  rows,
  hidden,
  formatValue,
  preliminaryLabel,
  testId = "chart-tooltip",
}: {
  leftPercent: number;
  pinned?: PinnedSide | null;
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
      data-pinned={pinned ?? undefined}
      className="pointer-events-none absolute top-0 z-[2] flex max-h-full min-w-[200px] flex-col gap-1 overflow-hidden rounded-[3px] border border-[var(--hairline)] bg-[var(--tile)] px-2.5 py-2 shadow-[0_4px_16px_rgba(30,27,22,0.10)]"
      style={
        pinned === null
          ? {
              left: `${leftPercent}%`,
              transform: leftPercent > 60 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
            }
          : { [pinned]: "8px", maxWidth: "calc(100% - 16px)" }
      }
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

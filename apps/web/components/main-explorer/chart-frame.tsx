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
import { ArrowDown, ArrowUp } from "lucide-react";
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
 * Phones (DESIGN.md §12 mobile, <768px) draw the charts at the frame's own width
 * instead of shrinking or scrolling the 920-unit desktop drawing. The same query
 * runs in CSS (Tailwind `max-[768px]:`) and here, so both pick the same geometry.
 */
export const MOBILE_CHART_QUERY = "(width < 768px)";
/** The width the phone drawing assumes before the browser has measured the frame. */
export const MOBILE_PREVIEW_WIDTH = 340;
const MOBILE_MIN_WIDTH = 240;

/** Height of a phone drawing: proportional to its width, within bounds. */
export function mobileChartHeight(width: number, ratio: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, width * ratio)));
}

/**
 * Which geometry a chart draws. `undefined` until the browser has measured: the
 * server and the hydrating client then render BOTH drawings and CSS shows the
 * one that fits, so a phone never paints the desktop drawing first. After that
 * `null` means desktop and a number is the phone drawing's width in CSS pixels
 * (one viewBox unit per pixel, so 11-unit axis text renders at 11px).
 */
export function useChartLayout<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [mobileWidth, setMobileWidth] = useState<number | null | undefined>(undefined);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof window.matchMedia !== "function") {
      setMobileWidth(null);
      return;
    }
    const query = window.matchMedia(MOBILE_CHART_QUERY);
    const measure = () => setMobileWidth(query.matches ? Math.round(element.clientWidth) : null);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    query.addEventListener("change", measure);
    return () => {
      observer.disconnect();
      query.removeEventListener("change", measure);
    };
  }, []);

  return {
    ref,
    /** The phone drawing's width, or null on desktop (also while unmeasured: the preview width then applies). */
    mobileWidth: mobileWidth === undefined || mobileWidth === null ? mobileWidth : Math.max(MOBILE_MIN_WIDTH, mobileWidth),
  };
}

/** CSS that shows one of the two pre-measurement drawings. */
export const DESKTOP_ONLY = "max-[768px]:hidden";
export const MOBILE_ONLY = "hidden max-[768px]:block";

/**
 * Scroll instead of shrink on narrow screens: an unbounded w-full SVG scales its
 * text below the DESIGN.md §13 legibility floor on phones.
 *
 * Phones (<768px) no longer reach that floor: they draw a phone geometry that
 * fits the frame (`fit`), so nothing scrolls and the sticky axis and the
 * latest-first scroll below have nothing to do there.
 *
 * Exception, 900–1019px: the shell's sidebar leaves the column under 720px, so the
 * floor would put a scrollbar under a desktop-width chart. There the chart shrinks
 * to fit instead — an approved trade of label size for a whole chart (DESIGN.md
 * §12). The inner box is `relative` so a tooltip can position.
 *
 * When it scrolls (a desktop drawing in a frame under 720px, e.g. a 768px
 * tablet), the frame opens on the latest data (the right edge) and re-opens
 * there whenever `scrollKey` changes (range, series); a sticky copy of the y
 * axis keeps the values readable once the axis itself has scrolled away.
 */
export function ChartScrollFrame({
  children,
  testId = "chart-frame",
  scrollKey,
  yAxis,
  overlay,
  fit = false,
}: {
  children: ReactNode;
  testId?: string;
  scrollKey?: string;
  yAxis?: StickyYAxis;
  /** Drawn over the visible part of the frame, whatever its scroll position (a tapped readout). */
  overlay?: ReactNode;
  /** The chart is drawn at the frame's width (phones): no minimum width. */
  fit?: boolean;
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
      // Name the sideways scroll only when there is one (a phone chart fits its frame).
      aria-label={message(messages, overflowing ? "controls.chartScrollable" : "controls.chartRegion")}
      className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
    >
      <div className={fit ? "relative grid" : "relative grid min-w-[720px] max-[768px]:min-w-0 min-[900px]:max-[1020px]:min-w-0"}>
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

/** A row's leading mark: the colour bar, or an arrow in the row's colour when the row has a `marker`. */
function RowMark({ row, swatchClassName }: { row: TooltipRow; swatchClassName: string }) {
  if (row.marker === undefined) return <SwatchBar color={row.color} className={swatchClassName} />;
  const Arrow = row.marker === "up" ? ArrowUp : ArrowDown;
  return <Arrow aria-hidden size={13} strokeWidth={2} className="shrink-0" style={{ color: row.color }} />;
}

/** The visible name, hidden from assistive technology when `srLabel` supplies the full one. */
function RowLabel({ row, className }: { row: TooltipRow; className: string }) {
  return (
    <>
      <span className={className} aria-hidden={row.srLabel === undefined ? undefined : true}>{row.label}</span>
      {row.srLabel === undefined ? null : <span className="sr-only">{row.srLabel}</span>}
    </>
  );
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
  variant = "float",
  compact = false,
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
  /** "panel": the phone readout, in flow under the chart so it never covers the plot. */
  variant?: "float" | "panel";
  /** Float readout only: no row gap and a 14px line, for a readout of a dozen rows that must fit the plot's height. */
  compact?: boolean;
}) {
  const { messages } = useI18n();
  if (variant === "panel") {
    return (
      <div
        data-testid={testId}
        data-placement="panel"
        className="mt-2 flex flex-col gap-1 rounded-[3px] border border-[var(--hairline)] bg-[var(--tile)] px-3 py-2"
      >
        <div className="mb-0.5 flex justify-between gap-3 font-[family-name:var(--font-numeric)] text-[12px] text-[var(--muted)]">
          <span>{header}</span>
          {headerRight ? <span className="text-right">{headerRight}</span> : null}
        </div>
        {rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-3">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-[var(--body)]">
              <RowMark row={row} swatchClassName="!w-3 shrink-0" />
              <RowLabel row={row} className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap" />
            </span>
            <span className="shrink-0 font-[family-name:var(--font-numeric)] text-[12px] text-[var(--ink)]">
              {formatValue(row.value)}
              {row.preliminary && preliminaryLabel ? <sup className="ml-1 text-[11px] min-[768px]:text-[10px]">{preliminaryLabel}</sup> : null}
            </span>
          </div>
        ))}
        {hidden > 0 ? (
          <div className="pt-0.5 text-[12px] text-[var(--muted)]">+{hidden} {message(messages, "controls.other")}</div>
        ) : null}
      </div>
    );
  }
  return (
    <div
      data-testid={testId}
      data-pinned={pinned ?? undefined}
      className={`pointer-events-none absolute top-0 z-[2] flex max-h-full min-w-[200px] flex-col ${compact ? "gap-0" : "gap-1"} overflow-hidden rounded-[3px] border border-[var(--hairline)] bg-[var(--tile)] px-2.5 py-2 shadow-[0_4px_16px_rgba(30,27,22,0.10)]`}
      style={
        pinned === null
          ? {
              left: `${leftPercent}%`,
              transform: leftPercent > 60 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
            }
          : { [pinned]: "8px", maxWidth: "calc(100% - 16px)" }
      }
    >
      <div className="mb-0.5 flex justify-between gap-3 font-[family-name:var(--font-numeric)] text-[11px] min-[768px]:text-[10.5px] text-[var(--muted)]">
        <span>{header}</span>
        {headerRight ? <span>{headerRight}</span> : null}
      </div>
      {rows.map((row) => (
        <div key={row.id} className={`flex items-center justify-between gap-2${compact ? " leading-[14px]" : ""}`}>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--body)]">
            <RowMark row={row} swatchClassName="!w-3" />
            <RowLabel row={row} className="max-w-[190px] overflow-hidden text-ellipsis whitespace-nowrap" />
          </span>
          <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--ink)]">
            {formatValue(row.value)}
            {row.preliminary && preliminaryLabel ? <sup className="ml-1 text-[11px] min-[768px]:text-[9px]">{preliminaryLabel}</sup> : null}
          </span>
        </div>
      ))}
      {hidden > 0 ? (
        <div className="pt-0.5 text-[11px] min-[768px]:text-[10.5px] text-[var(--muted)]">+{hidden} {message(messages, "controls.other")}</div>
      ) : null}
    </div>
  );
}

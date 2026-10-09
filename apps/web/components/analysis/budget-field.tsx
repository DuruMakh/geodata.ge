"use client";

import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { publicLabel } from "../../lib/i18n/labels";
import { useEffect, useRef, useState } from "react";
import type { SnapshotItem } from "../../lib/explorer/types";
import { formatAmount, formatShare } from "../../lib/explorer/format";
import { axisLeftPaddingFor } from "../../lib/explorer/chartScale";
import { Callout } from "../ui/editorial";
import {
  DESKTOP_ONLY,
  MOBILE_ONLY,
  MOBILE_PREVIEW_WIDTH,
  mobileChartHeight,
  useChartLayout,
} from "../main-explorer/chart-frame";

// Budget field per DESIGN.md §9.6: bubble scatter — x share of total, y growth vs
// previous year, compact solid radius by amount; names live in hover tooltips.

type BudgetFieldProps = {
  items: SnapshotItem[];
};

const W = 920;
const H = 380;
const PAD_L = 52;
const PAD_R = 24;
const PAD_T = 18;
const PAD_B = 36;
// The phone drawing, one unit per CSS pixel, fits the frame instead of scrolling.
const MOBILE_PAD_L = 36;
const MOBILE_PAD_R = 12;

type Plot = { mobile: boolean; width: number; height: number; padLeft: number; padRight: number };

export function BudgetField({ items }: BudgetFieldProps) {
  const { locale, messages, englishLabels } = useI18n();
  const labelFor = (item: Pick<SnapshotItem, "itemId" | "kaLabel">) => publicLabel(locale, item.itemId, item.kaLabel, englishLabels);
  const { ref: layoutRef, mobileWidth } = useChartLayout();
  // Mouse hover and keyboard focus read a circle while they last; a tap pins it
  // until the same circle is tapped again or a tap lands outside the field.
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const lastPointerType = useRef("mouse");

  useEffect(() => {
    if (pinnedId === null) return;
    const release = (event: PointerEvent) => {
      if (svgRef.current?.contains(event.target as Node)) return;
      setPinnedId(null);
      setHoverId(null);
    };
    document.addEventListener("pointerdown", release);
    return () => document.removeEventListener("pointerdown", release);
  }, [pinnedId]);

  // Negative rows have no meaningful share/size geometry; growth from a
  // non-positive base is already null upstream, but guard the amount too.
  const withGrowth = items.filter(
    (item): item is SnapshotItem & { changeFromPreviousYear: number } =>
      item.changeFromPreviousYear !== null && item.amountGel > 0,
  );

  if (withGrowth.length === 0) {
    return (
      <div ref={layoutRef} data-testid="budget-field" className="mt-9 border-t border-[var(--hairline)] pt-6">
        <h2 className="mb-1 text-[13px] font-semibold text-[var(--ink)]">{message(messages, "analysis.budgetField")}</h2>
        <p className="mb-4 text-xs text-[var(--muted)]">{message(messages, "analysis.budgetFieldNote")}</p>
        <Callout>
          {message(messages, "analysis.budgetFieldEmpty")}
        </Callout>
      </div>
    );
  }

  const shares = withGrowth.map((item) => item.shareOfTotal * 100);
  const growths = withGrowth.map((item) => item.changeFromPreviousYear * 100);
  const xMax = Math.max(5, Math.ceil((Math.max(...shares) * 1.15) / 5) * 5);
  const growthMin = Math.min(0, ...growths);
  const growthMax = Math.max(0, ...growths);
  const yPad = Math.max(4, (growthMax - growthMin) * 0.15);
  const yMin = Math.floor((growthMin - yPad) / 10) * 10;
  const yMax = Math.ceil((growthMax + yPad) / 10) * 10;

  const ySpan = yMax - yMin;
  const roughYStep = ySpan / 8;
  const yMagnitude = 10 ** Math.floor(Math.log10(roughYStep));
  const normalizedYStep = roughYStep / yMagnitude;
  const yMultiplier = normalizedYStep <= 1 ? 1 : normalizedYStep <= 2 ? 2 : normalizedYStep <= 5 ? 5 : 10;
  const yStep = ySpan <= 100 ? 10 : Math.max(10, yMultiplier * yMagnitude);
  const yTicks: number[] = [];
  for (let tick = Math.ceil(yMin / yStep) * yStep; tick <= yMax; tick += yStep) yTicks.push(tick);
  const xStep = xMax <= 20 ? 5 : 10;
  const xTicks: number[] = [];
  for (let tick = xStep; tick <= xMax; tick += xStep) xTicks.push(tick);
  const yLabel = (tick: number) => (tick > 0 ? `+${tick}%` : `${tick}%`.replace("-", "−"));

  const maxAmount = Math.max(...withGrowth.map((item) => item.amountGel), 1);
  const byAmount = [...withGrowth].sort((a, b) => b.amountGel - a.amountGel);
  const activeId = pinnedId ?? hoverId;
  const activeItem = byAmount.find((item) => item.itemId === activeId) ?? null;

  const desktop: Plot = { mobile: false, width: W, height: H, padLeft: PAD_L, padRight: PAD_R };
  const phoneWidth = mobileWidth === null ? null : mobileWidth ?? MOBILE_PREVIEW_WIDTH;
  const phone: Plot | null =
    phoneWidth === null
      ? null
      : {
          mobile: true,
          width: phoneWidth,
          height: mobileChartHeight(phoneWidth, 0.85, 260, 380),
          padLeft: axisLeftPaddingFor(yTicks.map(yLabel), MOBILE_PAD_L),
          padRight: MOBILE_PAD_R,
        };
  const measured = mobileWidth !== undefined;
  const active = mobileWidth === null || mobileWidth === undefined ? desktop : phone!;
  const scales = (plot: Plot) => ({
    x: (share: number) => plot.padLeft + (share / xMax) * (plot.width - plot.padLeft - plot.padRight),
    y: (growth: number) => PAD_T + (1 - (growth - yMin) / (yMax - yMin)) * (plot.height - PAD_T - PAD_B),
  });
  const { x: activeXScale, y: activeYScale } = scales(active);
  const activeX = activeItem === null ? null : (activeXScale(activeItem.shareOfTotal * 100) / active.width) * 100;
  const activeY = activeItem === null ? null : (activeYScale(activeItem.changeFromPreviousYear * 100) / active.height) * 100;

  const readoutBody =
    activeItem === null ? null : (
      <>
        <div className={`${active.mobile ? "text-[12px]" : "text-[11px]"} font-medium text-[var(--body)]`}>{labelFor(activeItem)}</div>
        <div className={`mt-0.5 font-[family-name:var(--font-numeric)] ${active.mobile ? "text-[12px]" : "text-[11px]"} text-[var(--ink)]`}>
          {formatAmount(activeItem.amountGel, locale)}
        </div>
        {/* The y position in words: the growth the axis encodes. */}
        <div className={`mt-0.5 font-[family-name:var(--font-numeric)] ${active.mobile ? "text-[12px]" : "text-[11px]"} text-[var(--muted)]`}>
          {message(messages, "analysis.change")} {formatShare(activeItem.changeFromPreviousYear, true)}
        </div>
      </>
    );

  const renderSvg = (plot: Plot, className: string) => {
    const { x, y } = scales(plot);
    const { width, height, padLeft, padRight } = plot;
    return (
      <svg
        key={plot.mobile ? "mobile" : "desktop"}
        ref={plot === active ? svgRef : undefined}
        data-geometry={plot.mobile ? "mobile" : "desktop"}
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label={message(messages, "analysis.budgetField")}
        className={`h-auto w-full ${className}`}
      >
        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line x1={padLeft} x2={width - padRight} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? "#1E1B16" : "#E7DECF"} strokeWidth={1} />
            <text x={padLeft - 8} y={y(tick) + 3} fontSize={11} fill="#6A6050" textAnchor="end" style={{ fontFamily: "var(--font-numeric)" }}>
              {yLabel(tick)}
            </text>
          </g>
        ))}
        {xTicks.map((tick) => (
          <text key={`x-${tick}`} x={x(tick)} y={height - 14} fontSize={11} fill="#6A6050" textAnchor="middle" style={{ fontFamily: "var(--font-numeric)" }}>
            {tick}%
          </text>
        ))}
        <line x1={padLeft} x2={padLeft} y1={PAD_T} y2={height - PAD_B} stroke="#D9CFBE" strokeWidth={1} />
        {byAmount.map((item) => {
          const radius = 6 + Math.sqrt(item.amountGel / maxAmount) * 16;
          const cx = x(item.shareOfTotal * 100);
          const cy = y(item.changeFromPreviousYear * 100);
          // On a phone the readout sits under the field, so the circle it reads is ringed.
          const selected = plot.mobile && plot === active && item.itemId === activeId;

          return (
            <g key={item.itemId}>
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill={item.color}
                stroke={selected ? "var(--ink)" : "var(--paper)"}
                strokeWidth={2}
                role="img"
                tabIndex={0}
                aria-label={`${labelFor(item)} · ${formatAmount(item.amountGel, locale)}`}
                className="[&:focus:not(:focus-visible)]:outline-none"
                onPointerDown={(event) => {
                  lastPointerType.current = event.pointerType;
                }}
                onPointerEnter={(event) => {
                  if (event.pointerType !== "touch") setHoverId(item.itemId);
                }}
                onPointerLeave={(event) => {
                  if (event.pointerType !== "touch") setHoverId(null);
                }}
                onClick={() => {
                  if (lastPointerType.current !== "touch") return;
                  if (pinnedId === item.itemId) {
                    setPinnedId(null);
                    setHoverId(null);
                  } else {
                    setPinnedId(item.itemId);
                  }
                }}
                onFocus={() => setHoverId(item.itemId)}
                onBlur={() => setHoverId(null)}
              >
                <title>{`${labelFor(item)} · ${formatAmount(item.amountGel, locale)}`}</title>
              </circle>
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div ref={layoutRef} data-testid="budget-field" className="mt-9 border-t border-[var(--hairline)] pt-6">
      <h2 className="mb-1 text-[13px] font-semibold text-[var(--ink)]">{message(messages, "analysis.budgetField")}</h2>
      <p className="mb-4 text-xs text-[var(--muted)]">{message(messages, "analysis.budgetFieldNote")}</p>
      <div className={active.mobile ? "" : "overflow-x-auto"}>
      <div className={active.mobile ? "relative" : "relative min-w-[720px] max-[768px]:min-w-0"}>
      {measured ? (
        renderSvg(active, "block")
      ) : (
        <>
          {renderSvg(desktop, `block ${DESKTOP_ONLY}`)}
          {renderSvg(phone!, MOBILE_ONLY)}
        </>
      )}
      {!active.mobile && activeItem !== null && activeX !== null && activeY !== null ? (
        <div
          data-testid="budget-field-tooltip"
          className="pointer-events-none absolute z-[2] max-w-[240px] rounded-[3px] border border-[var(--hairline)] bg-[var(--tile)] px-2.5 py-2 shadow-[0_4px_16px_rgba(30,27,22,0.10)]"
          style={{
            left: `${activeX}%`,
            top: `${activeY}%`,
            transform: `${activeX > 60 ? "translateX(calc(-100% - 10px))" : "translateX(10px)"} ${activeY > 50 ? "translateY(calc(-100% - 10px))" : "translateY(10px)"}`,
          }}
        >
          {readoutBody}
        </div>
      ) : null}
      </div>
      </div>
      {active.mobile && activeItem !== null ? (
        <div
          data-testid="budget-field-tooltip"
          data-placement="panel"
          className="mt-2 rounded-[3px] border border-[var(--hairline)] bg-[var(--tile)] px-3 py-2"
        >
          {readoutBody}
        </div>
      ) : null}
    </div>
  );
}

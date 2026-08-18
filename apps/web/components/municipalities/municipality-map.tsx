"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MAP_NO_DATA_FILL, MAP_NO_DATA_STROKE, MAP_RAMP } from "../../lib/explorer/colors";
import { formatAmount, formatPerResidentGel } from "../../lib/explorer/format";
import type { MunicipalityMapModel } from "../../lib/explorer/municipalityMapData";

type MunicipalityMapProps = Omit<MunicipalityMapModel, "legendMinPerResidentGel" | "legendMaxPerResidentGel"> & {
  legendMin: string;
  legendMax: string;
  activeCode: string | null;
  onActiveCodeChange: (code: string | null) => void;
  onOpenMunicipality: (code: string) => void;
};

function isActivationKey(key: string): boolean {
  return key === "Enter" || key === " ";
}

function accessibleName(nameKa: string, budgetPerResidentGel: number, totalBudgetGel: number): string {
  return `${nameKa} · ${formatPerResidentGel(budgetPerResidentGel)} ერთ მოსახლეზე · ${formatAmount(totalBudgetGel)} მთლიანი ბიუჯეტი · მუნიციპალიტეტის გახსნა`;
}

type InteractionTarget = {
  key: `shape:${string}` | `marker:${string}`;
  code: string;
  nameKa: string;
  budgetPerResidentGel: number;
  totalBudgetGel: number;
  element: SVGGraphicsElement;
};

type TooltipPosition = {
  left: number;
  top: number;
};

const HATCH_ID = "municipality-map-no-data-hatch";
const TOOLTIP_ID = "municipality-map-tooltip";
const TOOLTIP_WIDTH = 220;
const TOOLTIP_HEIGHT = 70;
const TOOLTIP_GAP = 8;
const TOOLTIP_EDGE = 6;

function getTooltipPosition(svg: SVGSVGElement, target: SVGGraphicsElement): TooltipPosition {
  const svgBox = svg.getBoundingClientRect();
  const targetBox = target.getBoundingClientRect();
  const centeredLeft = targetBox.left - svgBox.left + targetBox.width / 2 - TOOLTIP_WIDTH / 2;
  const left = Math.min(
    Math.max(centeredLeft, TOOLTIP_EDGE),
    Math.max(TOOLTIP_EDGE, svgBox.width - TOOLTIP_WIDTH - TOOLTIP_EDGE),
  );
  const roomAbove = targetBox.top - svgBox.top;
  const preferredTop =
    roomAbove >= TOOLTIP_HEIGHT + TOOLTIP_GAP + TOOLTIP_EDGE
      ? roomAbove - TOOLTIP_HEIGHT - TOOLTIP_GAP
      : targetBox.bottom - svgBox.top + TOOLTIP_GAP;
  const top = Math.min(
    Math.max(preferredTop, TOOLTIP_EDGE),
    Math.max(TOOLTIP_EDGE, svgBox.height - TOOLTIP_HEIGHT - TOOLTIP_EDGE),
  );

  return { left, top };
}

export function MunicipalityMap({
  viewBox,
  shapes,
  markers,
  occupiedAreas,
  legendMin,
  legendMax,
  activeCode,
  onActiveCodeChange,
  onOpenMunicipality,
}: MunicipalityMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pointerTarget, setPointerTarget] = useState<InteractionTarget | null>(null);
  const [focusTarget, setFocusTarget] = useState<InteractionTarget | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const activeTarget = focusTarget ?? pointerTarget;
  const describedTarget =
    activeTarget?.code === activeCode && tooltipPosition !== null ? activeTarget : null;
  const orderedTargets = useMemo(
    () =>
      [
        ...shapes.map((shape) => ({ kind: "shape" as const, nameKa: shape.nameKa, shape })),
        ...markers.map((marker) => ({ kind: "marker" as const, nameKa: marker.nameKa, marker })),
      ].toSorted(
        (left, right) =>
          left.nameKa.localeCompare(right.nameKa, "ka") ||
          (left.kind === right.kind ? 0 : left.kind === "shape" ? -1 : 1),
      ),
    [markers, shapes],
  );

  const positionTooltip = (target: InteractionTarget) => {
    if (svgRef.current === null) return;
    setTooltipPosition(getTooltipPosition(svgRef.current, target.element));
  };

  const activatePointerTarget = (target: InteractionTarget) => {
    setPointerTarget(target);
    if (focusTarget === null) positionTooltip(target);
    onActiveCodeChange(focusTarget?.code ?? target.code);
  };

  const clearPointerTarget = () => {
    setPointerTarget(null);
    if (focusTarget === null) setTooltipPosition(null);
    else positionTooltip(focusTarget);
    onActiveCodeChange(focusTarget?.code ?? null);
  };

  const activateFocusTarget = (target: InteractionTarget) => {
    setFocusTarget(target);
    positionTooltip(target);
    onActiveCodeChange(target.code);
  };

  const clearFocusTarget = () => {
    setFocusTarget(null);
    if (pointerTarget === null) setTooltipPosition(null);
    else positionTooltip(pointerTarget);
    onActiveCodeChange(pointerTarget?.code ?? null);
  };

  useEffect(() => {
    if (activeTarget === null) return;

    const handleResize = () => {
      if (svgRef.current === null) return;
      setTooltipPosition(getTooltipPosition(svgRef.current, activeTarget.element));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [activeTarget]);

  return (
    <div data-testid="municipality-map">
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={viewBox}
          role="group"
          aria-label="საქართველოს მუნიციპალიტეტების 2025 წლის ბიუჯეტი ერთ მოსახლეზე"
          className="block h-auto w-full"
        >
          <defs>
            <pattern id={HATCH_ID} patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(35)">
              <rect width="7" height="7" fill={MAP_NO_DATA_FILL} />
              <path d="M 0 0 V 7" stroke={MAP_NO_DATA_STROKE} strokeWidth="1.2" />
            </pattern>
          </defs>

          {orderedTargets.map((target) => {
            if (target.kind === "shape") {
              const { shape } = target;
              const active = shape.code === activeCode;

              return (
                <path
                  key={`shape:${shape.code}`}
                  data-testid={`municipality-shape-${shape.code}`}
                  data-municipality-shape=""
                  data-municipality-map-target=""
                  data-municipality-code={shape.code}
                  data-active={active ? "true" : undefined}
                  d={shape.d}
                  fill={MAP_RAMP[shape.bucket]}
                  fillRule="evenodd"
                  clipRule="evenodd"
                  stroke={active ? "var(--ink)" : "var(--hairline-soft)"}
                  strokeWidth={active ? 2.2 : 0.7}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  tabIndex={0}
                  role="link"
                  aria-label={accessibleName(shape.nameKa, shape.budgetPerResidentGel, shape.totalBudgetGel)}
                  aria-describedby={describedTarget?.key === `shape:${shape.code}` ? TOOLTIP_ID : undefined}
                  className="cursor-pointer"
                  onMouseEnter={(event) => {
                    activatePointerTarget({
                      key: `shape:${shape.code}`,
                      code: shape.code,
                      nameKa: shape.nameKa,
                      budgetPerResidentGel: shape.budgetPerResidentGel,
                      totalBudgetGel: shape.totalBudgetGel,
                      element: event.currentTarget,
                    });
                  }}
                  onMouseLeave={clearPointerTarget}
                  onFocus={(event) => {
                    activateFocusTarget({
                      key: `shape:${shape.code}`,
                      code: shape.code,
                      nameKa: shape.nameKa,
                      budgetPerResidentGel: shape.budgetPerResidentGel,
                      totalBudgetGel: shape.totalBudgetGel,
                      element: event.currentTarget,
                    });
                  }}
                  onBlur={clearFocusTarget}
                  onClick={() => onOpenMunicipality(shape.code)}
                  onKeyDown={(event) => {
                    if (!isActivationKey(event.key)) return;
                    event.preventDefault();
                    onOpenMunicipality(shape.code);
                  }}
                />
              );
            }

            const { marker } = target;
            const active = marker.code === activeCode;

            return (
              <circle
                key={`marker:${marker.code}`}
                data-testid={`municipality-marker-${marker.code}`}
                data-municipality-marker=""
                data-municipality-map-target=""
                data-municipality-code={marker.code}
                data-active={active ? "true" : undefined}
                cx={marker.x}
                cy={marker.y}
                r={active ? 9.5 : 7.5}
                fill="var(--positive)"
                stroke="var(--tile)"
                strokeWidth={active ? 2.2 : 1.2}
                vectorEffect="non-scaling-stroke"
                tabIndex={0}
                role="link"
                aria-label={accessibleName(marker.nameKa, marker.budgetPerResidentGel, marker.totalBudgetGel)}
                aria-describedby={describedTarget?.key === `marker:${marker.code}` ? TOOLTIP_ID : undefined}
                className="cursor-pointer"
                onMouseEnter={(event) => {
                  activatePointerTarget({
                    key: `marker:${marker.code}`,
                    code: marker.code,
                    nameKa: marker.nameKa,
                    budgetPerResidentGel: marker.budgetPerResidentGel,
                    totalBudgetGel: marker.totalBudgetGel,
                    element: event.currentTarget,
                  });
                }}
                onMouseLeave={clearPointerTarget}
                onFocus={(event) => {
                  activateFocusTarget({
                    key: `marker:${marker.code}`,
                    code: marker.code,
                    nameKa: marker.nameKa,
                    budgetPerResidentGel: marker.budgetPerResidentGel,
                    totalBudgetGel: marker.totalBudgetGel,
                    element: event.currentTarget,
                  });
                }}
                onBlur={clearFocusTarget}
                onClick={() => onOpenMunicipality(marker.code)}
                onKeyDown={(event) => {
                  if (!isActivationKey(event.key)) return;
                  event.preventDefault();
                  onOpenMunicipality(marker.code);
                }}
              />
            );
          })}

          {occupiedAreas.map((area) => (
            <path
              key={area.key}
              data-testid={`occupied-overlay-${area.key}`}
              data-occupied-overlay=""
              d={area.d}
              fill={`url(#${HATCH_ID})`}
              fillRule="evenodd"
              clipRule="evenodd"
              stroke={MAP_NO_DATA_STROKE}
              strokeWidth="1.5"
              strokeDasharray="5 4"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
              aria-hidden="true"
            />
          ))}
        </svg>

        {describedTarget !== null && tooltipPosition !== null ? (
          <div
            id={TOOLTIP_ID}
            role="tooltip"
            data-testid="municipality-map-tooltip"
            className="pointer-events-none absolute z-[2] h-[70px] w-[220px] overflow-hidden rounded-[3px] border border-[var(--hairline)] bg-[var(--tile)] px-2.5 py-2 shadow-[0_4px_16px_rgba(30,27,22,0.10)]"
            style={{ left: tooltipPosition.left, top: tooltipPosition.top }}
          >
            <div className="truncate text-[12px] font-medium text-[var(--ink)]">
              {describedTarget.nameKa}
            </div>
            <div data-testid="municipality-map-tooltip-per-resident" className="mt-0.5 font-[family-name:var(--font-numeric)] text-[11px] text-[var(--ink)]">
              {formatPerResidentGel(describedTarget.budgetPerResidentGel)} ერთ მოსახლეზე
            </div>
            <div data-testid="municipality-map-tooltip-total" className="font-[family-name:var(--font-numeric)] text-[10px] text-[var(--muted)]">
              {formatAmount(describedTarget.totalBudgetGel)} მთლიანი ბიუჯეტი
            </div>
            <span aria-hidden className="absolute top-2 right-2.5 text-[12px] text-[var(--muted)]">→</span>
          </div>
        ) : null}
      </div>

      <div data-testid="municipality-map-legend" className="mt-2 flex flex-wrap items-center gap-3.5 border-t border-[var(--hairline-soft)] pt-2.5">
        <span className="font-[family-name:var(--font-numeric)] text-[10px] text-[var(--faint)]">{legendMin}</span>
        <span className="flex flex-none">
          {MAP_RAMP.map((fill) => (
            <span key={fill} aria-hidden className="h-[9px] w-8" style={{ backgroundColor: fill }} />
          ))}
        </span>
        <span className="font-[family-name:var(--font-numeric)] text-[10px] text-[var(--faint)]">{legendMax}</span>
        <span className="text-[10px] text-[var(--faint)]">ერთ მოსახლეზე</span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full border border-[var(--tile)] bg-[var(--positive)]" />
          <span className="text-[11px] text-[var(--faint)]">თვითმმართველი ქალაქები</span>
        </span>
      </div>
    </div>
  );
}

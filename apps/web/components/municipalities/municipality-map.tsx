"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MAP_NO_DATA_FILL, MAP_NO_DATA_STROKE, MAP_RAMP } from "../../lib/explorer/colors";
import { formatAmount } from "../../lib/explorer/format";
import type { MunicipalityMapModel } from "../../lib/explorer/municipalityMapData";

type MunicipalityMapProps = Omit<MunicipalityMapModel, "legendMinGel" | "legendMaxGel"> & {
  legendMin: string;
  legendMax: string;
  activeCode: string | null;
  onActiveCodeChange: (code: string | null) => void;
  onOpenMunicipality: (code: string) => void;
};

function isActivationKey(key: string): boolean {
  return key === "Enter" || key === " ";
}

function accessibleName(nameKa: string, valueGel: number): string {
  return `${nameKa} · ${formatAmount(valueGel)} · მუნიციპალიტეტის გახსნა`;
}

type InteractionTarget = {
  key: `shape:${string}` | `marker:${string}`;
  code: string;
  nameKa: string;
  valueGel: number;
  element: SVGGraphicsElement;
};

type TooltipPosition = {
  left: number;
  top: number;
};

const HATCH_ID = "municipality-map-no-data-hatch";
const TOOLTIP_ID = "municipality-map-tooltip";
const TOOLTIP_WIDTH = 200;
const TOOLTIP_HEIGHT = 50;
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
  const orderedShapes = useMemo(
    () => shapes.slice().sort((left, right) => left.nameKa.localeCompare(right.nameKa, "ka")),
    [shapes],
  );
  const orderedMarkers = useMemo(
    () => markers.slice().sort((left, right) => left.nameKa.localeCompare(right.nameKa, "ka")),
    [markers],
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
          aria-label="საქართველოს მუნიციპალიტეტების ბიუჯეტის რუკა"
          className="block h-auto w-full"
        >
          <defs>
            <pattern id={HATCH_ID} patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(35)">
              <rect width="7" height="7" fill={MAP_NO_DATA_FILL} />
              <path d="M 0 0 V 7" stroke={MAP_NO_DATA_STROKE} strokeWidth="1.2" />
            </pattern>
          </defs>

          {orderedShapes.map((shape) => {
            const active = shape.code === activeCode;

            return (
              <path
                key={shape.code}
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
                strokeWidth={active ? 1.8 : 0.7}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                tabIndex={0}
                role="link"
                aria-label={accessibleName(shape.nameKa, shape.valueGel)}
                aria-describedby={activeTarget?.key === `shape:${shape.code}` ? TOOLTIP_ID : undefined}
                className="cursor-pointer"
                onMouseEnter={(event) => {
                  activatePointerTarget({
                    key: `shape:${shape.code}`,
                    code: shape.code,
                    nameKa: shape.nameKa,
                    valueGel: shape.valueGel,
                    element: event.currentTarget,
                  });
                }}
                onMouseLeave={clearPointerTarget}
                onFocus={(event) => {
                  activateFocusTarget({
                    key: `shape:${shape.code}`,
                    code: shape.code,
                    nameKa: shape.nameKa,
                    valueGel: shape.valueGel,
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

          {orderedMarkers.map((marker) => {
            const active = marker.code === activeCode;

            return (
              <circle
                key={marker.code}
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
                aria-label={accessibleName(marker.nameKa, marker.valueGel)}
                aria-describedby={activeTarget?.key === `marker:${marker.code}` ? TOOLTIP_ID : undefined}
                className="cursor-pointer"
                onMouseEnter={(event) => {
                  activatePointerTarget({
                    key: `marker:${marker.code}`,
                    code: marker.code,
                    nameKa: marker.nameKa,
                    valueGel: marker.valueGel,
                    element: event.currentTarget,
                  });
                }}
                onMouseLeave={clearPointerTarget}
                onFocus={(event) => {
                  activateFocusTarget({
                    key: `marker:${marker.code}`,
                    code: marker.code,
                    nameKa: marker.nameKa,
                    valueGel: marker.valueGel,
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
        </svg>

        {activeTarget !== null && tooltipPosition !== null ? (
          <div
            id={TOOLTIP_ID}
            role="tooltip"
            data-testid="municipality-map-tooltip"
            className="pointer-events-none absolute z-[2] h-[50px] w-[200px] overflow-hidden rounded-[3px] border border-[var(--hairline)] bg-[var(--tile)] px-2.5 py-2 shadow-[0_4px_16px_rgba(30,27,22,0.10)]"
            style={{ left: tooltipPosition.left, top: tooltipPosition.top }}
          >
            <div className="flex items-center justify-between gap-2 text-[12px] font-medium text-[var(--ink)]">
              <span className="truncate">{activeTarget.nameKa}</span>
              <span aria-hidden>→</span>
            </div>
            <div className="mt-0.5 font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
              {formatAmount(activeTarget.valueGel)}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3.5 border-t border-[var(--hairline-soft)] pt-2.5">
        <span className="font-[family-name:var(--font-numeric)] text-[10px] text-[var(--faint)]">{legendMin}</span>
        <span className="flex flex-none">
          {MAP_RAMP.map((fill) => (
            <span key={fill} aria-hidden className="h-[9px] w-8" style={{ backgroundColor: fill }} />
          ))}
        </span>
        <span className="font-[family-name:var(--font-numeric)] text-[10px] text-[var(--faint)]">{legendMax}</span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full border border-[var(--tile)] bg-[var(--positive)]" />
          <span className="text-[11px] text-[var(--faint)]">თვითმმართველი ქალაქები</span>
        </span>
      </div>
    </div>
  );
}

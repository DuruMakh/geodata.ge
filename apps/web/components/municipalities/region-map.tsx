"use client";

import { useEffect, useRef, useState } from "react";
import { MAP_NO_DATA_FILL, MAP_NO_DATA_STROKE, MAP_RAMP } from "../../lib/explorer/colors";
import { formatAmount } from "../../lib/explorer/format";

// Region choropleth (DESIGN.md §6.4 rules: no cards, no shadows except the
// tooltip). Paths arrive already projected from the server, so this component
// ships ~15 KB of `d` strings rather than the coordinate table.
//
// Every colour comes from colors.ts. No hex is written here.

export type RegionMapShape = {
  shapeIso: string;
  regionId: string | null;
  nameKa: string;
  d: string;
  valueGel: number | null;
  /** 0-5 index into MAP_RAMP; -1 for a no-data shape. */
  bucket: number;
};

export type RegionMapCity = { code: string; nameKa: string; x: number; y: number; valueGel: number };

/** Per-shape accessible name: same "name · value" pairing the hover readout
 *  already shows a sighted user, so a screen-reader user gets the same
 *  information a click needs from the map itself, not just its aria-label. */
function accessibleShapeName(nameKa: string, valueGel: number | null): string {
  return `${nameKa} · ${formatAmount(valueGel)}`;
}

function isActivationKey(key: string): boolean {
  return key === "Enter" || key === " ";
}

type RegionMapProps = {
  viewBox: string;
  shapes: RegionMapShape[];
  cities: RegionMapCity[];
  legendMin: string;
  legendMax: string;
  onOpenRegion: (regionId: string) => void;
  onOpenMunicipality: (code: string) => void;
  hoveredRegionId: string | null;
  onHoverRegion: (regionId: string | null) => void;
};

type InteractionTarget = {
  shape: RegionMapShape;
  element: SVGPathElement;
};

type TooltipPosition = {
  left: number;
  top: number;
};

const TOOLTIP_ID = "region-map-tooltip";
const TOOLTIP_WIDTH = 200;
const TOOLTIP_HEIGHT = 50;
const TOOLTIP_GAP = 8;
const TOOLTIP_EDGE = 6;

function getTooltipPosition(svg: SVGSVGElement, target: SVGPathElement): TooltipPosition {
  const svgBox = svg.getBoundingClientRect();
  const shapeBox = target.getBoundingClientRect();
  const centeredLeft = shapeBox.left - svgBox.left + shapeBox.width / 2 - TOOLTIP_WIDTH / 2;
  const left = Math.min(
    Math.max(centeredLeft, TOOLTIP_EDGE),
    Math.max(TOOLTIP_EDGE, svgBox.width - TOOLTIP_WIDTH - TOOLTIP_EDGE),
  );
  const roomAbove = shapeBox.top - svgBox.top;
  const preferredTop =
    roomAbove >= TOOLTIP_HEIGHT + TOOLTIP_GAP + TOOLTIP_EDGE
      ? roomAbove - TOOLTIP_HEIGHT - TOOLTIP_GAP
      : shapeBox.bottom - svgBox.top + TOOLTIP_GAP;
  const top = Math.min(
    Math.max(preferredTop, TOOLTIP_EDGE),
    Math.max(TOOLTIP_EDGE, svgBox.height - TOOLTIP_HEIGHT - TOOLTIP_EDGE),
  );

  return { left, top };
}

export function RegionMap({
  viewBox,
  shapes,
  cities,
  legendMin,
  legendMax,
  onOpenRegion,
  onOpenMunicipality,
  hoveredRegionId,
  onHoverRegion,
}: RegionMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);
  const [pointerTarget, setPointerTarget] = useState<InteractionTarget | null>(null);
  const [focusTarget, setFocusTarget] = useState<InteractionTarget | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const activeTarget = focusTarget ?? pointerTarget;
  const activeRegionId = activeTarget?.shape.regionId ?? hoveredRegionId;
  const hovered = shapes.find((shape) => shape.regionId !== null && shape.regionId === activeRegionId) ?? null;

  const positionTooltip = (target: InteractionTarget) => {
    if (svgRef.current === null) return;
    setTooltipPosition(getTooltipPosition(svgRef.current, target.element));
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

  const readout =
    hovered === null
      ? "გადაატარე კურსორი რუკაზე"
      : `${hovered.nameKa} · ${formatAmount(hovered.valueGel)} · გახსნა →`;

  // Tab order follows DOM order, and the source geometry's order is an accident
  // of the upstream shapefile join (roughly ISO-code order, meaningless to a
  // user). Render in Georgian alphabetical order so keyboard focus moves
  // through shapes and city dots in a sequence a person can actually predict.
  const orderedShapes = shapes.slice().sort((a, b) => a.nameKa.localeCompare(b.nameKa, "ka"));
  const orderedCities = cities.slice().sort((a, b) => a.nameKa.localeCompare(b.nameKa, "ka"));

  return (
    <div data-testid="region-map">
      <div className="relative">
        <svg ref={svgRef} viewBox={viewBox} role="group" aria-label="საქართველოს რეგიონების ბიუჯეტის რუკა" className="block h-auto w-full">
          {orderedShapes.map((shape) => {
          const noData = shape.regionId === null;
          const active = !noData && shape.regionId === activeRegionId;

          return (
            <path
              key={shape.shapeIso}
              data-testid={`region-shape-${shape.shapeIso}`}
              data-no-data={noData ? "true" : undefined}
              d={shape.d}
              fill={noData ? MAP_NO_DATA_FILL : active ? "var(--ink)" : MAP_RAMP[shape.bucket]}
              stroke={noData ? MAP_NO_DATA_STROKE : active ? "var(--ink)" : "var(--hairline-soft)"}
              strokeWidth={active ? 1.6 : 0.7}
              strokeDasharray={noData ? "3 2.5" : undefined}
              strokeLinejoin="round"
              style={{ cursor: noData ? "default" : "pointer" }}
              // The occupied-territory shape has no data and no action: it must
              // stay out of the tab order rather than be a focus stop that does
              // nothing, so tabIndex/role/aria-label/data-focus-map are omitted
              // entirely. data-focus-map picks up globals.css's map-only focus
              // ring (opaque black — a translucent --accent disappears against
              // this shape's own ramp fill when it's the darkest step).
              tabIndex={noData ? undefined : 0}
              role={noData ? undefined : "button"}
              aria-label={noData ? undefined : accessibleShapeName(shape.nameKa, shape.valueGel)}
              aria-describedby={activeTarget?.shape.shapeIso === shape.shapeIso ? TOOLTIP_ID : undefined}
              data-focus-map={noData ? undefined : ""}
              onMouseEnter={(event) => {
                if (noData) return;
                const nextTarget = { shape, element: event.currentTarget };
                setPointerTarget(nextTarget);
                if (focusTarget === null) positionTooltip(nextTarget);
                onHoverRegion(focusTarget?.shape.regionId ?? shape.regionId);
              }}
              onMouseLeave={() => {
                if (noData) return;
                setPointerTarget(null);
                if (focusTarget === null) setTooltipPosition(null);
                else positionTooltip(focusTarget);
                onHoverRegion(focusTarget?.shape.regionId ?? null);
              }}
              onFocus={(event) => {
                if (noData) return;
                const nextTarget = { shape, element: event.currentTarget };
                setFocusTarget(nextTarget);
                positionTooltip(nextTarget);
                onHoverRegion(shape.regionId);
              }}
              onBlur={() => {
                if (noData) return;
                setFocusTarget(null);
                if (pointerTarget === null) setTooltipPosition(null);
                else positionTooltip(pointerTarget);
                onHoverRegion(pointerTarget?.shape.regionId ?? null);
              }}
              onClick={() => (shape.regionId === null ? undefined : onOpenRegion(shape.regionId))}
              onKeyDown={(event) => {
                if (shape.regionId === null) return;
                if (!isActivationKey(event.key)) return;
                // Space must not also scroll the page.
                event.preventDefault();
                onOpenRegion(shape.regionId);
              }}
            />
          );
          })}
          {orderedCities.map((city) => (
          <circle
            key={city.code}
            data-testid={`self-gov-city-${city.code}`}
            cx={city.x}
            cy={city.y}
            r={hoveredCity === city.code ? 9.5 : 7.5}
            fill={hoveredCity === city.code ? "var(--accent)" : "var(--positive)"}
            fillOpacity={hoveredCity === city.code ? 1 : 0.88}
            stroke="var(--tile)"
            strokeWidth={hoveredCity === city.code ? 2 : 1.2}
            style={{ cursor: "pointer" }}
            tabIndex={0}
            role="button"
            aria-label={accessibleShapeName(city.nameKa, city.valueGel)}
            data-focus-map=""
            onMouseEnter={() => setHoveredCity(city.code)}
            onMouseLeave={() => setHoveredCity(null)}
            onClick={() => onOpenMunicipality(city.code)}
            onKeyDown={(event) => {
              if (!isActivationKey(event.key)) return;
              event.preventDefault();
              onOpenMunicipality(city.code);
            }}
          >
            <title>{city.nameKa}</title>
          </circle>
          ))}
        </svg>

        {activeTarget !== null && tooltipPosition !== null ? (
          <div
            id={TOOLTIP_ID}
            role="tooltip"
            data-testid="region-map-tooltip"
            className="pointer-events-none absolute z-[2] h-[50px] w-[200px] overflow-hidden rounded-[3px] border border-[var(--hairline)] bg-[var(--tile)] px-2.5 py-2 shadow-[0_4px_16px_rgba(30,27,22,0.10)]"
            style={{ left: tooltipPosition.left, top: tooltipPosition.top }}
          >
            <div className="truncate text-[12px] font-medium text-[var(--ink)]">{activeTarget.shape.nameKa}</div>
            <div className="mt-0.5 font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
              {formatAmount(activeTarget.shape.valueGel)}
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
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[var(--positive)] opacity-[0.88]" />
          <span className="text-[11px] text-[var(--faint)]">თვითმმართველი ქალაქები</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-[9px] w-3.5 border border-dashed"
            style={{ borderColor: MAP_NO_DATA_STROKE, backgroundColor: MAP_NO_DATA_FILL }}
          />
          <span className="text-[11px] text-[var(--faint)]">ოკუპირებული ტერიტორია — მონაცემები არ არის</span>
        </span>
        <span
          data-testid="map-readout"
          className="ml-auto font-[family-name:var(--font-numeric)] text-[11px] text-[var(--ink)]"
        >
          {readout}
        </span>
      </div>
    </div>
  );
}

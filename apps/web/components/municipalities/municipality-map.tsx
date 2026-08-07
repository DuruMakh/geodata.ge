"use client";

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

const HATCH_ID = "municipality-map-no-data-hatch";

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
  const orderedShapes = shapes.slice().sort((left, right) => left.nameKa.localeCompare(right.nameKa, "ka"));
  const orderedMarkers = markers.slice().sort((left, right) => left.nameKa.localeCompare(right.nameKa, "ka"));

  return (
    <div data-testid="municipality-map">
      <svg
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
              data-municipality-code={shape.code}
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
              className="cursor-pointer outline-none"
              onMouseEnter={() => onActiveCodeChange(shape.code)}
              onMouseLeave={() => onActiveCodeChange(null)}
              onFocus={() => onActiveCodeChange(shape.code)}
              onBlur={() => onActiveCodeChange(null)}
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
              data-municipality-code={marker.code}
              cx={marker.x}
              cy={marker.y}
              r={active ? 9.5 : 7.5}
              fill="var(--positive)"
              stroke="var(--tile)"
              strokeWidth={active ? 2.5 : 1.2}
              vectorEffect="non-scaling-stroke"
              tabIndex={0}
              role="link"
              aria-label={accessibleName(marker.nameKa, marker.valueGel)}
              className="cursor-pointer outline-none"
              onMouseEnter={() => onActiveCodeChange(marker.code)}
              onMouseLeave={() => onActiveCodeChange(null)}
              onFocus={() => onActiveCodeChange(marker.code)}
              onBlur={() => onActiveCodeChange(null)}
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

"use client";

import { useMemo, useState } from "react";
import { MAP_NO_DATA_FILL, MAP_NO_DATA_STROKE, MAP_RAMP } from "../../lib/explorer/colors";
import type { RegionalEconomyMapModel } from "../../lib/explorer/regionalEconomyMap";
import { regionalEconomyHref } from "../../lib/explorer/regionalEconomyRoutes";
import { formatAmount } from "../../lib/explorer/format";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { publicLabel } from "../../lib/i18n/labels";
import { pageHref } from "../../lib/i18n/routes";

const HATCH_ID = "regional-economy-map-no-data-hatch";

type Props = {
  model: RegionalEconomyMapModel;
  activeRegionId: string | null;
  onActiveRegionChange: (regionId: string | null) => void;
};

export function RegionalEconomyMap({ model, activeRegionId, onActiveRegionChange }: Props) {
  const { locale, messages, englishLabels } = useI18n();
  const [rovingIndex, setRovingIndex] = useState(0);
  const byRegion = useMemo(() => new Map(model.regions.map((region) => [region.regionId, region])), [model.regions]);
  const active = activeRegionId ? byRegion.get(activeRegionId) ?? null : null;
  const move = (index: number, key: string) => {
    if (key === "ArrowRight" || key === "ArrowDown") return (index + 1) % model.regions.length;
    if (key === "ArrowLeft" || key === "ArrowUp") return (index - 1 + model.regions.length) % model.regions.length;
    if (key === "Home") return 0;
    if (key === "End") return model.regions.length - 1;
    return null;
  };

  return (
    <div data-testid="regional-economy-map">
      <svg
        viewBox={model.viewBox}
        role="group"
        aria-label={message(messages, "regionalEconomies.mapAria", { year: model.year })}
        className="block h-auto w-full"
      >
        <defs>
          <pattern id={HATCH_ID} patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(35)">
            <rect width="7" height="7" fill={MAP_NO_DATA_FILL} />
            <path d="M 0 0 V 7" stroke={MAP_NO_DATA_STROKE} strokeWidth="1.2" />
          </pattern>
        </defs>
        {model.regions.map((region, index) => {
          const selected = region.regionId === activeRegionId;
          return (
            <a
              key={region.regionId}
              href={pageHref(regionalEconomyHref(region.regionId), locale)}
              data-region-map-target=""
              data-region-id={region.regionId}
              data-active={selected ? "true" : undefined}
              tabIndex={index === rovingIndex ? 0 : -1}
              aria-label={message(messages, "regionalEconomies.mapEntityAria", {
                name: publicLabel(locale, region.regionId, region.nameKa, englishLabels),
                amount: formatAmount(region.totalGdpGel, locale),
                year: model.year,
              })}
              onMouseEnter={() => onActiveRegionChange(region.regionId)}
              onMouseLeave={() => onActiveRegionChange(null)}
              onFocus={() => { setRovingIndex(index); onActiveRegionChange(region.regionId); }}
              onBlur={() => onActiveRegionChange(null)}
              onKeyDown={(event) => {
                const next = move(index, event.key);
                if (next === null) return;
                event.preventDefault();
                setRovingIndex(next);
                event.currentTarget.parentElement
                  ?.querySelectorAll<SVGAElement>("[data-region-map-target]")[next]?.focus();
              }}
            >
              <path
                data-testid="regional-map-path"
                d={region.pathD}
                fill={MAP_RAMP[region.bucket]}
                fillRule="evenodd"
                clipRule="evenodd"
                stroke={selected ? "var(--ink)" : "var(--hairline-soft)"}
                strokeWidth={selected ? 2.2 : 0.7}
                strokeLinejoin="round"
              />
            </a>
          );
        })}
        {model.occupiedAreas.map((area) => (
          <path
            key={area.key}
            data-occupied-overlay=""
            d={area.pathD}
            fill={`url(#${HATCH_ID})`}
            fillRule="evenodd"
            clipRule="evenodd"
            stroke={MAP_NO_DATA_STROKE}
            strokeWidth="1.5"
            strokeDasharray="5 4"
            strokeLinejoin="round"
            pointerEvents="none"
            aria-hidden="true"
          />
        ))}
      </svg>
      {active ? (
        <div role="tooltip" data-testid="regional-map-tooltip" className="mt-2 flex items-baseline justify-between gap-3 border border-[var(--hairline)] bg-[var(--tile)] px-3 py-2 text-[12px]">
          <span>{publicLabel(locale, active.regionId, active.nameKa, englishLabels)}</span>
          <span className="font-[family-name:var(--font-numeric)]">{formatAmount(active.totalGdpGel, locale)} · {model.year}</span>
        </div>
      ) : null}
      <div data-testid="regional-map-legend" className="mt-2 flex flex-wrap items-center gap-3.5 border-t border-[var(--hairline-soft)] pt-2.5">
        <span className="font-[family-name:var(--font-numeric)] text-[10px] text-[var(--faint)]">{formatAmount(model.legendMinGel, locale)}</span>
        <span className="flex flex-none">{MAP_RAMP.map((fill) => <span key={fill} aria-hidden className="h-[9px] w-8" style={{ backgroundColor: fill }} />)}</span>
        <span className="font-[family-name:var(--font-numeric)] text-[10px] text-[var(--faint)]">{formatAmount(model.legendMaxGel, locale)}</span>
        <span className="text-[10px] text-[var(--faint)]">{message(messages, "regionalEconomies.legend")}</span>
      </div>
    </div>
  );
}

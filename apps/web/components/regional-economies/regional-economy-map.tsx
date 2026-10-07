"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { MAP_NO_DATA_FILL, MAP_NO_DATA_STROKE, MAP_RAMP } from "../../lib/explorer/colors";
import { mapTouchTargets, pathBounds } from "../../lib/explorer/mapTouchTargets";
import type { RegionalEconomyMapModel, RegionMapModel } from "../../lib/explorer/regionalEconomyMap";
import { regionalEconomyHref } from "../../lib/explorer/regionalEconomyRoutes";
import { formatAmount } from "../../lib/explorer/format";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { publicLabel } from "../../lib/i18n/labels";
import { pageHref } from "../../lib/i18n/routes";
import { useTouchPreview } from "../explorer-shell/use-touch-preview";

export type RegionMapMetric = {
  hrefForRegion: (id: string) => string;
  formatValue: (value: number) => string;
  mapAria: string;
  entityAria: (name: string, value: number, year: number) => string;
  legend: string;
  testId: string;
};
type Props = {
  model: RegionMapModel;
  activeRegionId: string | null;
  onActiveRegionChange: (regionId: string | null) => void;
  metric: RegionMapMetric;
};

export function regionalEconomyMapData(model: RegionalEconomyMapModel): RegionMapModel {
  return { ...model, regions: model.regions.map(region => ({ ...region, value: region.totalGdpGel })), legendMin: model.legendMinGel, legendMax: model.legendMaxGel };
}

export function RegionalEconomyMap({ model, activeRegionId, onActiveRegionChange }: Omit<Props, "model" | "metric"> & { model: RegionalEconomyMapModel }) {
  const { locale, messages } = useI18n();
  return <RegionMap model={regionalEconomyMapData(model)} activeRegionId={activeRegionId} onActiveRegionChange={onActiveRegionChange} metric={{
    hrefForRegion: regionalEconomyHref, formatValue: value => formatAmount(value, locale), mapAria: message(messages, "regionalEconomies.mapAria", { year: model.year }),
    entityAria: (name, value, year) => message(messages, "regionalEconomies.mapEntityAria", { name, amount: formatAmount(value, locale), year }),
    legend: message(messages, "regionalEconomies.legend"), testId: "regional-economy-map",
  }} />;
}

export function RegionMap({ model, activeRegionId, onActiveRegionChange, metric }: Props) {
  const { locale, englishLabels } = useI18n();
  const hatchId = `${metric.testId}-no-data-hatch`;
  const [rovingIndex, setRovingIndex] = useState(0);
  const pointerRegionId = useRef<string | null>(null);
  const focusedRegionId = useRef<string | null>(null);
  const preview = useTouchPreview();
  const hrefFor = (regionId: string) => pageHref(metric.hrefForRegion(regionId), locale);
  const labelFor = (region: RegionMapModel["regions"][number]) => publicLabel(locale, region.regionId, region.nameKa, englishLabels);
  const touchTargets = useMemo(
    () => mapTouchTargets(model.regions.map((region) => ({ id: region.regionId, bounds: pathBounds(region.pathD) })), Number(model.viewBox.split(" ")[2])),
    [model.regions, model.viewBox],
  );
  const previewRegion = model.regions.find((region) => region.regionId === preview.previewId) ?? null;
  const move = (index: number, key: string) => {
    if (key === "ArrowRight" || key === "ArrowDown") return (index + 1) % model.regions.length;
    if (key === "ArrowLeft" || key === "ArrowUp") return (index - 1 + model.regions.length) % model.regions.length;
    if (key === "Home") return 0;
    if (key === "End") return model.regions.length - 1;
    return null;
  };

  return (
    <div data-testid={metric.testId}>
      <svg
        viewBox={model.viewBox}
        role="group"
        aria-label={metric.mapAria}
        className="block h-auto w-full"
        onPointerDown={preview.onPointerDown}
      >
        <defs>
          <pattern id={hatchId} patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(35)">
            <rect width="7" height="7" fill={MAP_NO_DATA_FILL} />
            <path d="M 0 0 V 7" stroke={MAP_NO_DATA_STROKE} strokeWidth="1.2" />
          </pattern>
        </defs>
        {model.regions.map((region, index) => {
          const selected = region.regionId === activeRegionId || region.regionId === preview.previewId;
          return (
            <a
              key={region.regionId}
              href={hrefFor(region.regionId)}
              data-region-map-target=""
              data-region-id={region.regionId}
              data-active={selected ? "true" : undefined}
              tabIndex={index === rovingIndex ? 0 : -1}
              aria-label={metric.entityAria(labelFor(region), region.value, model.year)}
              onClick={(event) => { if (!preview.opens(region.regionId)) event.preventDefault(); }}
              onMouseEnter={() => { pointerRegionId.current = region.regionId; onActiveRegionChange(region.regionId); }}
              onMouseLeave={() => { pointerRegionId.current = null; onActiveRegionChange(focusedRegionId.current); }}
              onFocus={() => { focusedRegionId.current = region.regionId; setRovingIndex(index); onActiveRegionChange(region.regionId); }}
              onBlur={() => { focusedRegionId.current = null; onActiveRegionChange(pointerRegionId.current); }}
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
        {/* Fingertip-sized hit areas for regions smaller than 24px on a phone
            (Tbilisi). Coarse pointers only, so mouse hover and clicks are unchanged;
            hidden from assistive technology, which reaches the region's own link. */}
        {touchTargets.map((target) => (
          <circle
            key={target.id}
            data-map-touch-target={target.id}
            cx={target.cx}
            cy={target.cy}
            r={target.r}
            fill="transparent"
            aria-hidden="true"
            className="pointer-events-none pointer-coarse:pointer-events-auto"
            // A plain page load, as the region's own <a> link does.
            onClick={() => { if (preview.opens(target.id)) window.location.assign(hrefFor(target.id)); }}
          />
        ))}
        {model.occupiedAreas.map((area) => (
          <path
            key={area.key}
            data-occupied-overlay=""
            d={area.pathD}
            fill={`url(#${hatchId})`}
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
      <div aria-live="polite">
        {previewRegion ? (
          <Link
            href={hrefFor(previewRegion.regionId)}
            data-testid="map-touch-preview"
            className="mt-2 flex min-h-11 items-center justify-between gap-3 border-t border-[var(--hairline-soft)] text-[13px] text-[var(--ink)]"
          >
            <span className="min-w-0">
              <span className="font-semibold">{labelFor(previewRegion)}</span>
              {" · "}
              <span className="font-[family-name:var(--font-numeric)]">{metric.formatValue(previewRegion.value)}</span>
            </span>
            <span aria-hidden className="text-[var(--accent)]">→</span>
          </Link>
        ) : null}
      </div>
      <div data-testid="regional-map-legend" className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 border-t border-[var(--hairline-soft)] pt-2.5">
        {/* Minimum and maximum stay on one row at the ramp's two ends; the ramp
            narrows on a phone rather than pushing the maximum onto the next line. */}
        <span data-testid="regional-map-legend-scale" className="flex min-w-0 items-center gap-3.5">
          <span className="font-[family-name:var(--font-numeric)] text-[10px] whitespace-nowrap text-[var(--faint)]">{metric.formatValue(model.legendMin)}</span>
          <span className="flex min-w-12 flex-[0_1_192px]">{MAP_RAMP.map((fill) => <span key={fill} aria-hidden className="h-[9px] flex-1" style={{ backgroundColor: fill }} />)}</span>
          <span className="font-[family-name:var(--font-numeric)] text-[10px] whitespace-nowrap text-[var(--faint)]">{metric.formatValue(model.legendMax)}</span>
        </span>
        <span className="text-[10px] text-[var(--faint)]">{metric.legend}</span>
      </div>
    </div>
  );
}

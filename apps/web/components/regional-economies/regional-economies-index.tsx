"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { RegionalEconomyMapModel, RegionMapModel } from "../../lib/explorer/regionalEconomyMap";
import { regionalEconomyHref } from "../../lib/explorer/regionalEconomyRoutes";
import { formatAmount } from "../../lib/explorer/format";
import { matchesLabelQuery } from "../../lib/i18n/search";
import { publicLabel } from "../../lib/i18n/labels";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import { SourceNote } from "../ui/editorial";
import { RegionMap, regionalEconomyMapData, type RegionMapMetric } from "./regional-economy-map";

export function RegionalEconomiesIndex({ model, sourceNote }: { model: RegionalEconomyMapModel; sourceNote: string }) {
  const { locale, messages, englishLabels } = useI18n();
  const largest = model.regions[0];
  return <RegionIndex model={regionalEconomyMapData(model)} sourceNote={sourceNote} metric={{
    hrefForRegion: regionalEconomyHref, formatValue: value => formatAmount(value, locale), mapAria: message(messages, "regionalEconomies.mapAria", { year: model.year }),
    entityAria: (name, value, year) => message(messages, "regionalEconomies.mapEntityAria", { name, amount: formatAmount(value, locale), year }),
    legend: message(messages, "regionalEconomies.legend"), testId: "regional-economy-map",
  }} summary={[
    { label: message(messages, "regionalEconomies.regionCount"), value: String(model.regions.length), detail: message(messages, "regionalEconomies.currentPrices") },
    { label: message(messages, "regionalEconomies.largestRegion"), value: publicLabel(locale, largest.regionId, largest.nameKa, englishLabels), detail: formatAmount(largest.totalGdpGel, locale) },
    { label: message(messages, "regionalEconomies.period"), value: `${model.firstYear}–${model.year}`, detail: message(messages, "regionalEconomies.currentPrices") },
  ]} />;
}

export function RegionIndex({ model, sourceNote, metric, summary }: { model: RegionMapModel; sourceNote: string; metric: RegionMapMetric; summary: Array<{ label: string; value: string; detail: string }> }) {
  const { locale, messages, englishLabels } = useI18n();
  const [query, setQuery] = useState("");
  const [mapActive, setMapActive] = useState<string | null>(null);
  const [pointerActive, setPointerActive] = useState<string | null>(null);
  const [focusActive, setFocusActive] = useState<string | null>(null);
  const activeRegionId = focusActive ?? mapActive ?? pointerActive;
  const rows = useMemo(() => {
    const needle = query.trim();
    if (!needle) return model.regions;
    return model.regions.filter((region) => matchesLabelQuery(needle, [
      region.nameKa,
      publicLabel("en", region.regionId, region.nameKa, englishLabels),
    ]));
  }, [englishLabels, model.regions, query]);

  return (
    <>
      <div data-testid="regional-index-workspace" className="grid items-start gap-10 @min-[1100px]:grid-cols-[minmax(0,1fr)_336px]">
        <div className="min-w-0">
          <RegionMap model={model} metric={metric} activeRegionId={activeRegionId} onActiveRegionChange={setMapActive} />
          <div className="mt-8 border-t-2 border-[var(--ink)] pt-5">
            <h2 className="mb-[18px] font-[family-name:var(--font-display)] text-[22px] font-semibold">
              {message(messages, "regionalEconomies.summaryTitle")}
            </h2>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
              {summary.map((item) => (
                <div key={item.label} className="flex flex-col gap-[5px]">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">{item.label}</span>
                  <span className="font-[family-name:var(--font-display)] text-[25px] font-semibold leading-[1.1] tracking-[-0.02em]">{item.value}</span>
                  <span className="text-[11.5px] leading-snug text-[var(--muted)]">{item.detail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="min-w-0 border-t-2 border-[var(--ink)] pt-[22px] @min-[1100px]:border-t-0 @min-[1100px]:border-l @min-[1100px]:border-[var(--hairline)] @min-[1100px]:pt-0 @min-[1100px]:pl-[26px]">
          <div className="flex items-baseline justify-between gap-2.5 border-b-2 border-[var(--ink)] pb-2">
            <span className="font-[family-name:var(--font-display)] text-[19px] font-semibold">{message(messages, "regionalEconomies.regions")}</span>
            <span className="font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--faint)]">{model.year}</span>
          </div>
          <div className="flex items-center gap-2 pt-3 pb-1">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={message(messages, "regionalEconomies.search")}
              aria-label={message(messages, "regionalEconomies.search")}
              className="h-[38px] min-w-0 flex-1 rounded-[3px] border border-[var(--control)] bg-[var(--tile)] px-[11px] text-[13px] outline-none focus:border-[var(--ink)]"
            />
            <span className="font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--faint)]">{rows.length === model.regions.length ? rows.length : `${rows.length} / ${model.regions.length}`}</span>
          </div>
          {rows.length === 0 ? (
            <div className="px-1 py-[26px] text-center text-[13px] text-[var(--body)]">
              {message(messages, "regionalEconomies.empty")}
              <button type="button" onClick={() => setQuery("")} className="mt-3 block w-full text-[12px] text-[var(--accent)]">{message(messages, "regionalEconomies.clearSearch")}</button>
            </div>
          ) : (
            <div className="mt-1.5 max-h-[620px] overflow-y-auto">
              {rows.map((region) => (
                <Link
                  key={region.regionId}
                  href={pageHref(metric.hrefForRegion(region.regionId), locale)}
                  data-testid="regional-list-row"
                  data-region-id={region.regionId}
                  data-active={region.regionId === activeRegionId ? "true" : undefined}
                  onMouseEnter={() => setPointerActive(region.regionId)}
                  onMouseLeave={() => setPointerActive(null)}
                  onFocus={() => setFocusActive(region.regionId)}
                  onBlur={() => setFocusActive(null)}
                  className={`grid grid-cols-[22px_minmax(0,1fr)_112px_12px] items-center gap-[9px] border-b border-[var(--row-border)] py-[9px] pr-1 transition-colors hover:bg-[var(--tint)] ${region.regionId === activeRegionId ? "bg-[var(--tint)]" : "bg-transparent"}`}
                >
                  <span className="font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--faint)]">{String(region.rank).padStart(2, "0")}</span>
                  <span className="min-w-0 text-[12.5px] font-medium">{publicLabel(locale, region.regionId, region.nameKa, englishLabels)}</span>
                  <span className="text-right font-[family-name:var(--font-numeric)] text-[11.5px]">{metric.formatValue(region.value)}</span>
                  <span aria-hidden className="text-[var(--faint)]">→</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-9 border-t border-[var(--hairline)] pt-4">
        <SourceNote testId="regional-source-note">
          {sourceNote} {message(messages, "regionalEconomies.boundaries")} {" "}
          <a href="https://www.geoboundaries.org/" target="_blank" rel="noreferrer" className="underline underline-offset-2">geoBoundaries</a> (CC BY 3.0).
        </SourceNote>
      </div>
    </>
  );
}

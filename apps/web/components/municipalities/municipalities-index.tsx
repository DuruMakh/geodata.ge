"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { MunicipalKpi, MunicipalListRow } from "../../lib/explorer/municipalData";
import { formatAmount } from "../../lib/explorer/format";
import { parseMunicipalLevel } from "../../lib/explorer/urlState";
import { SourceNote, TabDivider, TextTab } from "../ui/editorial";
import { RegionMap, type RegionMapCity, type RegionMapShape } from "./region-map";

type MunicipalitiesIndexProps = {
  viewBox: string;
  shapes: RegionMapShape[];
  cities: RegionMapCity[];
  legendMin: string;
  legendMax: string;
  municipalities: MunicipalListRow[];
  regions: MunicipalListRow[];
  kpis: MunicipalKpi[];
  latestYear: number;
  sourceNote: string;
};

export function MunicipalitiesIndex(props: MunicipalitiesIndexProps) {
  const router = useRouter();
  const [level, setLevel] = useState<"muni" | "region">("muni");
  const [query, setQuery] = useState("");
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);

  // Restore the level from the URL hash once, after mount (the server render
  // always shows "muni"; an unknown value falls back to it in the parser).
  // The hash is a one-time external input on load, so the one extra render is
  // intended — same pattern as use-explorer-state.ts's hash restore.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLevel(parseMunicipalLevel(window.location.hash));
  }, []);

  useEffect(() => {
    try {
      // Clearing the hash must restore the path (and any query string), not
      // write a literal space or silently drop `?...`.
      history.replaceState(
        null,
        "",
        level === "region" ? "#lvl=region" : `${window.location.pathname}${window.location.search}`,
      );
    } catch {
      // History can be unavailable in embedded contexts; the UI still works.
    }
  }, [level]);

  const source = level === "region" ? props.regions : props.municipalities;
  const rows = useMemo(() => {
    const needle = query.trim();
    if (needle === "") return source;
    return source.filter((row) => row.nameKa.includes(needle) || row.subtitleKa.includes(needle));
  }, [source, query]);

  const max = source[0]?.valueGel ?? 1;
  const openMunicipality = (code: string) => router.push(`/explorer/municipalities/${code}`);
  const openRegion = (regionId: string) => router.push(`/explorer/municipalities/region/${regionId.replace("region.", "")}`);

  return (
    <>
      <div className="grid items-start gap-10 min-[1100px]:grid-cols-[minmax(0,1fr)_336px]">
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-3 border-b border-[var(--hairline)] pb-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              რეგიონები რუკაზე · {props.latestYear}
            </span>
          </div>
          <div className="mt-1.5">
            <RegionMap
              viewBox={props.viewBox}
              shapes={props.shapes}
              cities={props.cities}
              legendMin={props.legendMin}
              legendMax={props.legendMax}
              hoveredRegionId={hoveredRegionId}
              onHoverRegion={setHoveredRegionId}
              onOpenRegion={openRegion}
              onOpenMunicipality={openMunicipality}
            />
          </div>

          <div className="mt-8 border-t-2 border-[var(--ink)] pt-5">
            <h2 className="mb-[18px] font-[family-name:var(--font-display)] text-[22px] font-semibold">
              ძირითადი ინდიკატორები
            </h2>
            <div className="grid grid-cols-2 gap-8 min-[1100px]:grid-cols-4">
              {props.kpis.map((kpi) => (
                <div key={kpi.label} data-testid="index-kpi" className="flex flex-col gap-[5px]">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">
                    {kpi.label}
                  </span>
                  <span className="font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] whitespace-nowrap">
                    {kpi.value}
                  </span>
                  <span className="text-[11.5px] leading-snug text-[var(--muted)]">{kpi.detail}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 max-w-[640px]">
            <SourceNote testId="municipal-source-note">{props.sourceNote}</SourceNote>
          </div>
        </div>

        <div className="min-w-0 border-t-2 border-[var(--ink)] pt-[22px] min-[1100px]:border-t-0 min-[1100px]:border-l min-[1100px]:border-[var(--hairline)] min-[1100px]:pt-0 min-[1100px]:pl-[26px]">
          <div className="flex items-baseline justify-between gap-2.5 border-b-2 border-[var(--ink)] pb-2">
            <span className="flex items-baseline gap-3.5">
              <TextTab label="მუნიციპალიტეტები" active={level === "muni"} onClick={() => setLevel("muni")} testId="level-muni" />
              <TabDivider />
              <TextTab label="რეგიონები" active={level === "region"} onClick={() => setLevel("region")} testId="level-region" />
            </span>
            <span className="font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--faint)]">₾</span>
          </div>

          <div className="flex items-center gap-2 pt-3 pb-1">
            <input
              data-testid="municipal-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={level === "region" ? "ძებნა — რეგიონი" : "ძებნა — მუნიციპალიტეტი ან რეგიონი"}
              aria-label="ძებნა"
              className="h-[38px] min-w-0 flex-1 rounded-[3px] border border-[var(--control)] bg-[var(--tile)] px-[11px] text-[13px] text-[var(--ink)] outline-none focus:border-[var(--ink)]"
            />
            <span data-testid="row-count" className="font-[family-name:var(--font-numeric)] text-[10.5px] whitespace-nowrap text-[var(--faint)]">
              {rows.length === source.length ? `${source.length}` : `${rows.length} / ${source.length}`}
            </span>
          </div>

          {rows.length === 0 ? (
            <div data-testid="municipal-empty" className="px-1 py-[26px] text-center">
              <div className="text-[13px] text-[var(--body)]">ვერაფერი მოიძებნა</div>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-3 inline-flex h-[30px] cursor-pointer items-center rounded-[3px] border border-[var(--control)] px-3 text-[12px] text-[var(--accent)]"
              >
                ძებნის გასუფთავება
              </button>
            </div>
          ) : (
            <div className="mt-1.5 max-h-[620px] overflow-y-auto">
              {rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  data-testid="municipal-list-row"
                  onClick={() => (row.kind === "region" ? openRegion(row.id) : openMunicipality(row.id))}
                  onMouseEnter={() => setHoveredRegionId(row.regionId)}
                  onMouseLeave={() => setHoveredRegionId(null)}
                  onFocus={() => setHoveredRegionId(row.regionId)}
                  onBlur={() => setHoveredRegionId(null)}
                  className={`grid w-full grid-cols-[22px_minmax(0,1fr)_66px_12px] items-center gap-[9px] border-b border-[var(--row-border)] py-[7px] pr-1 text-left ${
                    row.regionId !== null && row.regionId === hoveredRegionId ? "bg-[var(--tint)]" : ""
                  }`}
                >
                  <span className="font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--faint)]">
                    {String(row.rank).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">
                    <span data-testid="municipal-row-name" className="block truncate text-[12.5px] font-medium">
                      {row.nameKa}
                    </span>
                    <span className="block truncate text-[10.5px] text-[var(--faint)]">{row.subtitleKa}</span>
                    <span className="mt-[5px] block h-[3px] bg-[var(--hairline-soft)]">
                      <span
                        data-testid="municipal-row-bar"
                        className="block h-[3px] bg-[var(--accent)]"
                        style={{ width: `${((row.valueGel / max) * 100).toFixed(1)}%` }}
                      />
                    </span>
                  </span>
                  <span className="text-right font-[family-name:var(--font-numeric)] text-[11.5px]">
                    {formatAmount(row.valueGel)}
                  </span>
                  <span aria-hidden className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--faint)]">
                    →
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

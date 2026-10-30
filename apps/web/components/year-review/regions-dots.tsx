"use client";

import { useMemo, useState } from "react";
import { POSITIVE } from "../../lib/explorer/colors";
import { formatAmount, formatInUnit, formatPerResidentGel, UNIT_PERSONS } from "../../lib/explorer/format";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import type { YearReviewData } from "../../lib/yearReview/types";
import { regionsView } from "../../lib/yearReview/yearView";
import { ChartShareButton } from "../explorer-shell/chart-share-button";
import { niceTicks } from "../landing/chapters/canvas";
import { withLari } from "../ui/lari";
import { ChartFoot, FOOT_NOTE, H3, H3_META, pointerHover } from "./section";
import { YearTag } from "./year-tag";

// Section 05's "by region" (board `an-dots`): one row per region, highest average first, each municipality a dot at
// its spending per resident, the region's average a tick in ink and the national median a dashed line. Hovering a
// region (or pressing its name) dims the others; hovering or tapping a dot names its municipality. The figures are
// the Municipalities page's own, in its year. A screen reader gets every municipality from the list under the chart.

const ROW_HEIGHT = 46;
// Dots closer than this (in % of the axis) move to the next lane, up or down from the row's middle (px).
const CROWDED = 1.8;
const LANES = [0, -8, 8, -16, 16];
// A dot's name flips to the left of it from here (% of the axis), so it stays inside the chart.
const LABEL_FLIP = 80;

/** Each dot's lane: the first one where no dot already placed sits within CROWDED of it. */
function lanes(xs: number[]): number[] {
  const placed: number[][] = LANES.map(() => []);
  return xs.map((x) => {
    let lane = 0;
    while (lane < LANES.length - 1 && placed[lane]!.some((other) => Math.abs(other - x) < CROWDED)) lane++;
    placed[lane]!.push(x);
    return LANES[lane]!;
  });
}

export function RegionsDots({ data, year }: { data: YearReviewData; year: number }) {
  const { locale, messages } = useI18n();
  const text = (key: string, values?: Record<string, string | number>) => message(messages, key, values);
  // The regions, each municipality's dot (x in % of the axis, lane offset in px), the axis and the ranked list follow
  // the data only, not a hover.
  const { view, domain, ticks, rows, ranked } = useMemo(() => {
    const view = regionsView(data);
    const { places } = data.municipal;
    // The axis runs a little past the highest municipality; its ticks are the round values inside it.
    const domain = Math.max(...places.map((place) => place.perResidentGel)) * 1.04;
    const rows = view.regions.map((region) => {
      const sorted = [...region.places].sort((left, right) => left.perResidentGel - right.perResidentGel);
      const xs = sorted.map((place) => (place.perResidentGel / domain) * 100);
      const offsets = lanes(xs);
      return { region, dots: sorted.map((place, index) => ({ place, x: xs[index]!, offset: offsets[index]! })) };
    });
    return {
      view,
      domain,
      ticks: niceTicks(domain, 5).ticks.filter((tick) => tick <= domain),
      rows,
      ranked: [...places].sort((left, right) => right.perResidentGel - left.perResidentGel),
    };
  }, [data]);
  const [regionHover, setRegionHover] = useState<string | null>(null);
  const [regionPin, setRegionPin] = useState<string | null>(null);
  const [placeHover, setPlaceHover] = useState<string | null>(null);
  const municipalYear = data.municipal.year;
  const at = (value: number) => (value / domain) * 100;
  const gel = (value: number) => formatPerResidentGel(value, locale);
  const lari = text("yearReview.lari");
  const heading = text("yearReview.rgH");
  const medianLabel = text("yearReview.medL", { v: gel(view.median) });

  const chart = (still: boolean) => {
    const active = still ? null : regionHover ?? regionPin;
    return (
      <div className="mt-4">
        <div aria-hidden="true" className="relative h-5 @min-[640px]:ml-[196px] @min-[1100px]:ml-[236px]">
          {ticks.map((tick, index) => (
            <span
              key={tick}
              className="absolute top-0 -translate-x-1/2 whitespace-nowrap font-[family-name:var(--font-numeric)] text-[11px] text-[var(--faint)] min-[768px]:text-[10.5px]"
              style={{ left: `${at(tick)}%` }}
            >
              {withLari(index === ticks.length - 1 && tick > 0 ? `${formatInUnit(tick, UNIT_PERSONS)} ${lari}` : formatInUnit(tick, UNIT_PERSONS))}
            </span>
          ))}
        </div>
        <div>
          {rows.map(({ region, dots }) => {
            const on = active === region.id;
            const dim = active !== null && !on;
            const name = (
              <>
                <b className={`text-[13px] font-semibold leading-[1.3] ${dim ? "text-[var(--muted)]" : ""}`}>{region.label}</b>
                <span className="mt-px font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">{withLari(gel(region.average))}</span>
              </>
            );
            const nameClass = "flex flex-col items-start justify-center pt-[9px] text-left @min-[640px]:min-h-[46px] @min-[640px]:py-1.5 @min-[640px]:pl-2";
            return (
              <div
                key={region.id}
                data-region-row={region.id}
                data-focus={on ? "" : undefined}
                data-dim={dim ? "" : undefined}
                className={`grid grid-cols-1 items-center border-t border-[var(--row-border)] transition-colors duration-150 last:border-b @min-[640px]:grid-cols-[180px_minmax(0,1fr)] @min-[640px]:gap-x-4 @min-[1100px]:grid-cols-[220px_minmax(0,1fr)] ${on ? "bg-[var(--tint)]" : ""}`}
              >
                {still ? (
                  <span className={nameClass}>{name}</span>
                ) : (
                  <button
                    type="button"
                    aria-pressed={regionPin === region.id}
                    aria-label={text(region.places.length === 1 ? "yearReview.rgAria1" : "yearReview.rgAria", { name: region.label, v: gel(region.average), n: region.places.length })}
                    onPointerEnter={pointerHover(() => setRegionHover(region.id))}
                    onPointerLeave={() => setRegionHover(null)}
                    onFocus={(event) => { if (event.currentTarget.matches(":focus-visible")) setRegionHover(region.id); }}
                    onBlur={() => setRegionHover(null)}
                    onClick={() => setRegionPin((current) => (current === region.id ? null : region.id))}
                    className={`${nameClass} cursor-pointer aria-pressed:underline @min-[640px]:aria-pressed:no-underline @min-[640px]:aria-pressed:shadow-[inset_3px_0_0_var(--ink)]`}
                  >
                    {name}
                  </button>
                )}
                <span aria-hidden="true" className="relative block" style={{ height: ROW_HEIGHT }} onPointerLeave={still ? undefined : () => setPlaceHover(null)}>
                  <i className="absolute inset-y-0 w-0 border-l border-dashed border-[var(--control)]" style={{ left: `${at(view.median)}%` }} />
                  <i
                    data-region-average=""
                    className={`absolute inset-y-[9px] -ml-px w-0 border-l-2 border-[var(--ink)] transition-opacity duration-200 ${dim ? "opacity-25" : ""}`}
                    style={{ left: `${at(region.average)}%` }}
                  />
                  {dots.map(({ place, x, offset }) => {
                    const top = ROW_HEIGHT / 2 + offset;
                    const named = !still && placeHover === place.code;
                    return (
                      <span key={place.code}>
                        <i
                          data-dot={place.code}
                          onPointerEnter={still ? undefined : pointerHover(() => setPlaceHover(place.code))}
                          onClick={still ? undefined : () => setPlaceHover(place.code)}
                          className={`absolute block size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-200 @min-[640px]:size-[11px] ${still ? "" : "cursor-pointer"} ${dim ? "opacity-25" : ""} ${named ? "z-[2]" : ""}`}
                          style={{
                            left: `${x}%`,
                            top,
                            backgroundColor: POSITIVE,
                            boxShadow: named ? "0 0 0 2px var(--paper), 0 0 0 3.5px var(--ink)" : "0 0 0 1.5px var(--paper)",
                          }}
                        />
                        {named ? (
                          <em
                            data-dot-label=""
                            className={`pointer-events-none absolute z-[3] whitespace-nowrap bg-[var(--ink)] px-[7px] py-[3px] text-[11.5px] font-semibold not-italic leading-[1.3] text-[var(--paper)] ${
                              x > LABEL_FLIP ? "translate-x-[calc(-100%+10px)]" : "-translate-x-1/2"
                            } -translate-y-[calc(100%+10px)]`}
                            style={{ left: `${x}%`, top }}
                          >
                            {withLari(`${place.label} · ${gel(place.perResidentGel)}`)}
                          </em>
                        ) : null}
                      </span>
                    );
                  })}
                </span>
              </div>
            );
          })}
        </div>
        <div aria-hidden="true" className="relative h-6 @min-[640px]:ml-[196px] @min-[1100px]:ml-[236px]">
          <p
            data-median-label=""
            className="absolute top-1.5 -translate-x-1/2 whitespace-nowrap font-[family-name:var(--font-numeric)] text-[11px] text-[var(--body)] min-[768px]:text-[10.5px]"
            style={{ left: `${at(view.median)}%` }}
          >
            {withLari(medianLabel)}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div data-panel="regions">
      <h3 className={`${H3} mt-10 min-[768px]:mt-[52px]`}>
        {heading} <span className={H3_META}>{text("yearReview.rgM")}</span>
        {year === municipalYear ? null : <span className="self-center"><YearTag year={municipalYear} /></span>}
      </h3>
      {chart(false)}
      <ol data-municipal-list="" className="sr-only">
        {ranked.map((place) => (
          <li key={place.code}>{text("yearReview.mpSr", { name: place.label, per: gel(place.perResidentGel), tot: formatAmount(place.totalGel, locale) })}</li>
        ))}
      </ol>
      <ChartFoot
        share={
          <ChartShareButton
            title={heading}
            caption={`${lari} ${text("yearReview.dbPer")} · ${municipalYear}`}
            source={`${data.sources.municipal} ${text("yearReview.mpNote")}`}
            chart={<div className="@container">{chart(true)}</div>}
            period={String(municipalYear)}
          />
        }
      >
        <p className={FOOT_NOTE}>{text("yearReview.mpNote")}</p>
      </ChartFoot>
    </div>
  );
}

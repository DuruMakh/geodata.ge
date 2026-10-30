"use client";

import { memo, useMemo } from "react";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import { formatPerResidentGel } from "../../lib/explorer/format";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { perResidentRows } from "../../lib/yearReview/yearView";
import { ChartShareButton } from "../explorer-shell/chart-share-button";
import { withLari } from "../ui/lari";
import { RegionsDots } from "./regions-dots";
import { ChartFoot, FOOT_NOTE, H3, Section, type YearReviewSectionProps } from "./section";
import { PlanTag, YearTag } from "./year-tag";

// Section 05, "Country and regions" (spec §4): the ledger of six GEL-per-resident figures for the chosen year, each
// from its own dataset in its nearest year (board `an-led`), then municipal spending per resident by region. Per
// resident divides by Geostat's population on 1 January of each year (spec §9.4).

/** Section 05 for the chosen year. */
export const CountryRegions = memo(function CountryRegions({ data, year }: Pick<YearReviewSectionProps, "data" | "year">) {
  const { locale, messages } = useI18n();
  const text = (key: string, values?: Record<string, string | number>) => message(messages, key, values);
  const rows = useMemo(() => perResidentRows(data, year), [data, year]);
  const largest = Math.max(...rows.map((row) => row.value));
  const heading = text("yearReview.ledH", { y: year });

  const ledger = (
    <ul data-ledger="" className="m-0 mt-3.5 list-none border-t border-[var(--hairline)] p-0">
      {rows.map((row) => (
        <li
          key={row.id}
          data-ledger-row={row.id}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-[7px] border-b border-[var(--row-border)] py-2.5 @min-[640px]:grid-cols-[minmax(0,240px)_minmax(0,1fr)_170px] @min-[640px]:gap-x-5 @min-[1100px]:grid-cols-[minmax(0,300px)_minmax(0,1fr)_190px]"
        >
          <span className="col-start-1 row-start-1 min-w-0">
            <b className="block text-sm font-semibold leading-[1.35]">{text(`yearReview.led.${row.id}.name`)}</b>
            <span className="mt-0.5 block font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">{text(`yearReview.led.${row.id}.scope`)}</span>
          </span>
          <span aria-hidden="true" className="col-span-2 row-start-2 block h-2.5 @min-[640px]:col-span-1 @min-[640px]:col-start-2 @min-[640px]:row-start-1 @min-[640px]:h-4">
            <i className="block h-full rounded-r-[2px] bg-[var(--ink)]" style={{ width: `${(row.value / largest) * 100}%` }} />
          </span>
          <span className="col-start-2 row-start-1 flex flex-col items-end gap-[3px] whitespace-nowrap @min-[640px]:col-start-3 @min-[640px]:flex-row @min-[640px]:items-center @min-[640px]:justify-end @min-[640px]:gap-2.5">
            {row.fallback ? <YearTag year={row.year} /> : null}
            {row.planned ? <PlanTag label={text(row.id === "svc" ? "yearReview.proj" : "yearReview.plan")} /> : null}
            <b className="font-[family-name:var(--font-display)] text-[19px] font-semibold tabular-nums @min-[640px]:text-[22px]">
              {withLari(formatPerResidentGel(row.value, locale))}
            </b>
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <Section
      number="05"
      id="year-review-country"
      heading={text("yearReview.h06")}
      meta={text("yearReview.m06", { count: data.municipal.places.length })}
    >
      <div data-panel="ledger">
        <h3 className={`${H3} mt-7`}>{heading}</h3>
        {ledger}
        <ChartFoot
          share={
            <ChartShareButton
              testId="per-resident-share"
              title={heading}
              caption={`${text("yearReview.lari")} ${text("yearReview.dbPer")} · ${year}`}
              source={text("yearReview.nSrc", { date: updatedDate(data.updatedAt, locale) })}
              chart={<div className="@container">{ledger}</div>}
              period={String(year)}
            />
          }
        >
          <p className={FOOT_NOTE}>{text("yearReview.ledNote")}</p>
        </ChartFoot>
      </div>
      <RegionsDots data={data} year={year} />
    </Section>
  );
});

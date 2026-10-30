"use client";

import { memo } from "react";
import { ACCENT, INK, OTHER_COLOR } from "../../lib/explorer/colors";
import { formatAmountParts, formatInUnit, formatShare, UNIT_PERSONS } from "../../lib/explorer/format";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { shortAmount } from "../../lib/yearReview/findings";
import { givesUpView, refundsView } from "../../lib/yearReview/yearView";
import { ChartShareButton } from "../explorer-shell/chart-share-button";
import { StackedColumnChart } from "../main-explorer/stacked-column-chart";
import { withLari } from "../ui/lari";
import { ChartFoot, FIG_KEY, FOOT_NOTE, Section, UNIT_LINE, type YearReviewSectionProps } from "./section";
import { YearTag } from "./year-tag";

// Section 02, "What the state gives up" (spec §4): what came in against what tax breaks cost, three columns either
// side of one waterline, then the tax refunds of the chosen year and every year. Each in its dataset's nearest year.

// The board's drawing, in CSS pixels: the waterline sits 236px down a 372px figure, the names take the bottom 70px.
const ICE_HEIGHT = 372;
const WATERLINE = 236;
const NAMES = 70;
const TALLEST = 200; // the largest collected column
const DEEPEST = ICE_HEIGHT - WATERLINE - NAMES - 6; // what a given-up column may take below the line
// The accent hatch of what was given up (the board's), lighter stripes over the accent.
const GIVEN_HATCH = "repeating-linear-gradient(135deg,rgba(247,242,233,.42) 0 2px,transparent 2px 5px)";
const SEA = "repeating-linear-gradient(180deg,rgba(30,27,22,.045) 0 1px,transparent 1px 7px)";

type IceColumn = { id: "vat" | "inc" | "all"; name: string; collected: number; given: number; per100: number };

/** Collected above the waterline in ink, given up below it hatched in accent, on one scale; `n ₾ per 100 ₾` under each. */
function IceChart({ columns, ariaLabel }: { columns: IceColumn[]; ariaLabel: string }) {
  const { messages } = useI18n();
  const scale = Math.min(TALLEST / Math.max(...columns.map((column) => column.collected)), DEEPEST / Math.max(...columns.map((column) => column.given)));
  return (
    <div role="img" aria-label={ariaLabel} className="relative mt-3" style={{ height: ICE_HEIGHT }}>
      <i aria-hidden="true" className="absolute right-0 left-0 block border-t-[1.5px] border-[var(--ink)]" style={{ top: WATERLINE, bottom: NAMES, backgroundImage: SEA }} />
      {columns.map((column, index) => (
        <div key={column.id} aria-hidden="true" data-ice={column.id} className="absolute top-0 bottom-0 w-1/3" style={{ left: `${(index * 100) / 3}%` }}>
          <span className="absolute left-0 w-[38px] rounded-t-[3px] min-[768px]:w-[54px]" style={{ bottom: ICE_HEIGHT - WATERLINE, height: column.collected * scale, backgroundColor: INK }}>
            <em className="absolute bottom-full left-0 mb-[5px] whitespace-nowrap font-[family-name:var(--font-numeric)] text-[11.5px] font-semibold not-italic">
              {shortAmount(column.collected, messages)}
            </em>
          </span>
          <span
            className="absolute left-0 w-[38px] rounded-b-[3px] min-[768px]:w-[54px]"
            style={{ top: WATERLINE, height: column.given * scale, backgroundColor: ACCENT, backgroundImage: GIVEN_HATCH }}
          >
            <em className="absolute top-0 left-full mt-1 ml-1.5 whitespace-nowrap font-[family-name:var(--font-numeric)] text-[11px] font-semibold text-[var(--accent)] not-italic min-[768px]:ml-2 min-[768px]:text-[11.5px]">
              {shortAmount(column.given, messages)}
            </em>
          </span>
          <span className="absolute right-2.5 bottom-0 left-0 flex flex-col gap-[3px]">
            <b className="text-[11.5px] font-semibold leading-[1.3] min-[768px]:text-[12.5px]">{column.name}</b>
            <span className="font-[family-name:var(--font-numeric)] text-[11px] leading-[1.3] text-[var(--muted)]">
              <strong className="block font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--accent)] min-[768px]:inline min-[768px]:text-xl">
                {withLari(`${formatInUnit(column.per100, UNIT_PERSONS)} ${message(messages, "yearReview.lari")}`)}
              </strong>{" "}
              {withLari(message(messages, "yearReview.per100s"))}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Section 02 for the chosen year. */
export const GivesUp = memo(function GivesUp({ data, year }: Pick<YearReviewSectionProps, "data" | "year">) {
  const { locale, messages } = useI18n();
  const text = (key: string, values?: Record<string, string | number>) => message(messages, key, values);
  const breaks = givesUpView(data, year);
  const refunds = refundsView(data, year);
  const { taxBreaks } = data;
  const refundYears = data.refunds.years;
  const [rfFrom, rfTo] = [refundYears[0]!, refundYears.at(-1)!];

  const { vat, income, all, per100 } = breaks.value;
  const columns: IceColumn[] = [
    { id: "vat", name: text("yearReview.iceCols.vat"), collected: vat[0], given: vat[1], per100: per100.vat },
    { id: "inc", name: text("yearReview.iceCols.inc"), collected: income[0], given: income[1], per100: per100.income },
    { id: "all", name: text("yearReview.iceCols.all"), collected: all[0], given: all[1], per100: per100.all },
  ];
  const iceAria = text("yearReview.iceAria", {
    y: breaks.year,
    items: columns
      .map((column) => text("yearReview.iceItem", {
        name: column.name,
        a: shortAmount(column.collected, messages),
        b: shortAmount(column.given, messages),
        r: formatInUnit(column.per100, UNIT_PERSONS),
      }))
      .join("; "),
  });
  const ice = <IceChart columns={columns} ariaLabel={iceAria} />;

  const big = formatAmountParts(refunds.value.value, false, locale, true);
  const refundsLine = [
    text("yearReview.rfS", { p: formatShare(refunds.value.shareOfTax), y: refunds.year }),
    ...(refunds.value.record ? [text("yearReview.rfRec", { from: rfFrom })] : []),
  ].join(" · ");
  const rfHeading = text("yearReview.rfH");
  // The chosen year's column in ink (spec §4, 02): its own one-value segment, the other years in sand.
  const refundBillions = (keep: (index: number) => boolean) =>
    data.refunds.values.map((value, index) => (value === null || !keep(index) ? null : value / 1e9));
  const usedIndex = refundYears.indexOf(refunds.year);
  const chosenLabel = `${rfHeading} · ${refunds.year}`;
  const refundSegments = [
    { id: "refunds", label: rfHeading, color: OTHER_COLOR, values: refundBillions((index) => index !== usedIndex) },
    { id: "refunds-chosen", label: chosenLabel, readoutLabel: rfHeading, color: INK, values: refundBillions((index) => index === usedIndex) },
  ];
  const refundsChart = (
    <StackedColumnChart
      periods={refundYears}
      periodsPerYear={1}
      segments={refundSegments}
      overlay={null}
      formatPeriod={String}
      formatValue={(value) => shortAmount(value * 1e9, messages)}
      ariaLabel={text("yearReview.rfAria", { from: rfFrom, to: rfTo, y: refunds.year, v: `${big.num} ${big.unit}` })}
      frameLabel={rfHeading}
      highlightPeriod={refunds.year}
      fitWidth
    />
  );

  return (
    <Section
      number="02"
      id="year-review-gives-up"
      heading={text("yearReview.h03")}
      meta={text("yearReview.m03", { a: breaks.year, b: refunds.year })}
    >
      <div className="mt-[26px] grid grid-cols-1 items-start gap-10 @min-[1100px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] @min-[1100px]:gap-14">
        <figure data-panel="gives-up" className="m-0 min-w-0">
          <p className={`${FIG_KEY} flex flex-wrap items-center gap-x-2 gap-y-1`}>
            <span>{text("yearReview.iceK", { y: breaks.year })}</span>
            {breaks.fallback ? <YearTag year={breaks.year} /> : null}
          </p>
          {ice}
          <ChartFoot
            share={
              <ChartShareButton
                title={text("yearReview.h03")}
                caption={`${text("yearReview.bn")} · ${breaks.year}`}
                legend={[{ label: text("yearReview.iceUp"), color: INK }, { label: text("yearReview.iceDown"), color: ACCENT }]}
                source={data.sources.taxBreaks}
                chart={ice}
                period={String(breaks.year)}
              />
            }
          />
        </figure>
        <figure data-panel="refunds" className="m-0 min-w-0">
          <p className={FIG_KEY}>{rfHeading}</p>
          <p data-refunds-big="" className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <b className="whitespace-nowrap font-[family-name:var(--font-display)] text-[30px] font-semibold tracking-[-0.02em] tabular-nums min-[768px]:text-4xl">
              {withLari(`${big.num} ${big.unit}`)}
            </b>
            <span className="font-[family-name:var(--font-numeric)] text-[11.5px] text-[var(--body)]">{refundsLine}</span>
            {refunds.fallback ? <span className="self-center"><YearTag year={refunds.year} /></span> : null}
          </p>
          <p className={`${UNIT_LINE} mt-3`}>{withLari(text("yearReview.bn"))}</p>
          <div className="mt-1">{refundsChart}</div>
          <ChartFoot
            share={
              <ChartShareButton
                title={rfHeading}
                caption={`${text("yearReview.bn")} · ${rfFrom}–${rfTo}`}
                legend={[{ label: rfHeading, color: OTHER_COLOR }, { label: chosenLabel, color: INK }]}
                source={data.sources.taxBreaks}
                chart={refundsChart}
                period={`${rfFrom}-${rfTo}`}
              />
            }
          />
        </figure>
      </div>
      <p className={`${FOOT_NOTE} mt-2.5`}>{text("yearReview.tbNote", { to: taxBreaks.years.at(-1)! })}</p>
    </Section>
  );
});

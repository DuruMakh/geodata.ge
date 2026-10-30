"use client";

import type { ReactNode } from "react";
import { ACCENT, DEBT_DOMESTIC, INK_LINE, NEGATIVE, POSITIVE } from "../../lib/explorer/colors";
import { formatAmount, formatAmountParts, formatInUnit, formatPerResidentGel, formatShare, UNIT_BN } from "../../lib/explorer/format";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { shortAmount } from "../../lib/yearReview/findings";
import { debtView, nearestYear, picked, sumAll, whereAll } from "../../lib/yearReview/yearView";
import { ChartShareButton } from "../explorer-shell/chart-share-button";
import { StackedColumnChart } from "../main-explorer/stacked-column-chart";
import { withLari } from "../ui/lari";
import { RateLines } from "./rate-lines";
import { FIG_KEY, FOOT_NOTE, Section, UNIT_LINE, type YearReviewSectionProps } from "./section";
import { PlanTag, YearTag } from "./year-tag";

// Section 04, "Deficit and debt" (spec §4): the balance every year with its projection hatched, the debt at the end
// of the chosen year (big number, external / domestic split, three figures, average rates) beside the debt by year,
// then repayments by year with the schedule of existing debt hatched. Each in its dataset's nearest year.

const H3 = "flex flex-wrap items-baseline gap-x-3 gap-y-1 font-[family-name:var(--font-display)] text-[18.5px] font-semibold leading-[1.3] tracking-[-0.005em] [text-wrap:balance] min-[768px]:text-[21px]";
const H3_META = "font-[family-name:var(--font-numeric)] text-[11.5px] font-normal tracking-normal text-[var(--muted)]";
// The board's projection swatch (as the homepage revenue chart's planned key): paper stripes over the bar sand.
const HATCH_SWATCH = "[background:repeating-linear-gradient(135deg,var(--paper)_0_1.5px,transparent_1.5px_4px),var(--control)]";

const billions = (values: (number | null)[]) => values.map((value) => (value === null ? null : value / 1e9));
const firstProjection = (years: number[], projection: boolean[]) => years.find((_, index) => projection[index]);
/** The column chart's projection props: both or neither. */
const hatchedFrom = (from: number | undefined, label: string): { projectionFrom: number; projectionLabel: string } | { projectionFrom?: undefined } =>
  from === undefined ? {} : { projectionFrom: from, projectionLabel: label };

/** The colour key under a chart (it carries its own figcaption, so this is for the eye); `projection` adds the hatch. */
function Key({ items, projection }: { items: { label: string; color: string }[]; projection?: string }) {
  return (
    <ul aria-hidden="true" className="flex flex-wrap gap-x-[18px] gap-y-1.5 text-xs text-[var(--body)]">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-[7px]">
          <i className="block h-2.5 w-3 rounded-[2px]" style={{ backgroundColor: item.color }} />
          {item.label}
        </li>
      ))}
      {projection ? (
        <li className="inline-flex items-center gap-[7px]">
          <i className={`block h-2.5 w-3 rounded-[2px] ${HATCH_SWATCH}`} />
          {projection}
        </li>
      ) : null}
    </ul>
  );
}

/** The row under a chart: its key or note on the left, the share button on the right. */
function Foot({ children, share }: { children?: ReactNode; share: ReactNode }) {
  return (
    <div className="mt-2.5 flex flex-wrap items-start justify-between gap-x-6 gap-y-2.5">
      <div className="min-w-0 flex-1">{children}</div>
      <div className="ml-auto flex-none">{share}</div>
    </div>
  );
}

/** Section 04 for the chosen year. */
export function DebtDeficit({ data, year }: Pick<YearReviewSectionProps, "data" | "year">) {
  const { locale, messages } = useI18n();
  const text = (key: string, values?: Record<string, string | number>) => message(messages, key, values);
  const { balance, debt: debtData } = data;
  const { stock, rates, service } = debtData;
  const range = (years: number[]) => ({ from: years[0]!, to: years.at(-1)! });
  const bal = range(balance.years);
  const st = range(stock.years);
  const rep = range(service.years);
  const rt = range(rates.years);
  const projection = text("yearReview.proj");

  // Deficit and surplus, % of GDP.
  const balUsed = picked("balance", balance.years, balance.pctGdp, year);
  const balValue = balance.pctGdp[balUsed.index]!;
  const balGel = balance.gel[balUsed.index] ?? null;
  const balProjected = balance.projection[balUsed.index]!;
  const deepest = balance.pctGdp.reduce<number>((low, value, index) => (value !== null && value < (balance.pctGdp[low] ?? Infinity) ? index : low), 0);
  const pct = (value: number) => formatShare(value / 100, true);
  const balProjFrom = firstProjection(balance.years, balance.projection);
  const dfHeading = text("yearReview.dfH");
  const surplusLabel = text("yearReview.dfSur");
  const deficitLabel = text("yearReview.dfDef");
  const deficitChart = (
    <StackedColumnChart
      periods={balance.years}
      periodsPerYear={1}
      segments={[
        { id: "surplus", label: surplusLabel, color: POSITIVE, values: balance.pctGdp.map((value) => (value !== null && value >= 0 ? value : null)) },
        { id: "deficit", label: deficitLabel, color: NEGATIVE, values: balance.pctGdp.map((value) => (value !== null && value < 0 ? value : null)) },
      ]}
      overlay={null}
      formatPeriod={String}
      formatValue={pct}
      ariaLabel={text("yearReview.dfAria", {
        from: bal.from,
        to: bal.to,
        y: balUsed.year,
        v: pct(balValue),
        my: balance.years[deepest]!,
        mv: pct(balance.pctGdp[deepest]!),
      })}
      frameLabel={dfHeading}
      highlightPeriod={balUsed.year}
      {...hatchedFrom(balProjFrom, projection)}
    />
  );
  const balGelParts = balGel === null ? null : formatAmountParts(balGel, true, locale, true);

  // Debt at year end.
  const debt = debtView(data, year);
  const { total, external, domestic, toGdp, perResident, rate } = debt.value;
  const externalLabel = text("yearReview.dbExt");
  const domesticLabel = text("yearReview.dbDom");
  const split = [
    { id: "external", label: externalLabel, value: external, color: INK_LINE },
    { id: "domestic", label: domesticLabel, value: domestic, color: DEBT_DOMESTIC },
  ];
  const facts = [
    { key: "yearReview.dbGdp", value: toGdp === null ? null : formatShare(toGdp) },
    { key: "yearReview.dbPer", value: perResident === null ? null : formatPerResidentGel(perResident, locale) },
    { key: "yearReview.dbRate", value: rate === null ? null : formatShare(rate / 100) },
  ].filter((fact): fact is { key: string; value: string } => fact.value !== null);

  const rtHeading = text("yearReview.rtH");
  const rateLines = [
    { id: "domestic", label: text("yearReview.rtN.dom"), color: DEBT_DOMESTIC, values: rates.domestic },
    { id: "total", label: text("yearReview.rtN.tot"), color: ACCENT, values: rates.total },
    { id: "external", label: text("yearReview.rtN.ext"), color: INK_LINE, values: rates.external },
  ];
  const rateLast = rateLines.flatMap((line) => {
    const index = line.values.findLastIndex((value) => value !== null);
    return index < 0 ? [] : [`${line.label}: ${formatShare(line.values[index]! / 100)} (${rates.years[index]})`];
  });
  const ratesChart = (
    <RateLines years={rates.years} lines={rateLines} year={year} ariaLabel={`${rtHeading}, ${rt.from}–${rt.to}. ${rateLast.join("; ")}`} />
  );
  // The nearest year with both the domestic and the external rate, for the line under the chart.
  const bothYear = nearestYear(rates.years, whereAll([rates.domestic, rates.external]), year);
  const rateIn = (values: (number | null)[], target: number) => values[rates.years.indexOf(target)]!;

  const stHeading = text("yearReview.stH");
  const stockChart = (
    <StackedColumnChart
      periods={stock.years}
      periodsPerYear={1}
      segments={[
        { id: "external", label: externalLabel, color: INK_LINE, values: billions(stock.external) },
        { id: "domestic", label: domesticLabel, color: DEBT_DOMESTIC, values: billions(stock.domestic) },
      ]}
      overlay={null}
      formatPeriod={String}
      formatValue={(value) => shortAmount(value * 1e9, messages)}
      ariaLabel={text("yearReview.stAria", { from: st.from, to: st.to, y: debt.year, v: formatAmount(total, locale) })}
      frameLabel={stHeading}
      highlightPeriod={debt.year}
      fitWidth
    />
  );

  // Repayments by year: principal and interest, the schedule of existing debt hatched.
  const serviceTotal = sumAll([service.principal, service.interest]);
  const peak = serviceTotal.reduce<number>((high, value, index) => (value !== null && value > (serviceTotal[high] ?? -Infinity) ? index : high), 0);
  const serviceYear = nearestYear(service.years, serviceTotal, year);
  const repProjFrom = firstProjection(service.years, service.projection);
  const projTo = service.years.findLast((_, index) => service.projection[index]);
  const wallHeading = text("yearReview.wallH");
  const principalLabel = text("yearReview.wallPri");
  const interestLabel = text("yearReview.wallInt");
  const wallChart = (
    <StackedColumnChart
      periods={service.years}
      periodsPerYear={1}
      segments={[
        { id: "principal", label: principalLabel, color: INK_LINE, values: billions(service.principal) },
        { id: "interest", label: interestLabel, color: ACCENT, values: billions(service.interest) },
      ]}
      overlay={null}
      formatPeriod={String}
      formatValue={(value) => shortAmount(value * 1e9, messages)}
      ariaLabel={text("yearReview.wallAria", {
        from: rep.from,
        to: rep.to,
        projFrom: repProjFrom ?? rep.to,
        y: service.years[peak]!,
        v: formatAmount(serviceTotal[peak]!, locale),
      })}
      frameLabel={wallHeading}
      {...(serviceYear === null ? {} : { highlightPeriod: serviceYear })}
      {...hatchedFrom(repProjFrom, projection)}
    />
  );

  return (
    <Section
      number="04"
      id="year-review-debt"
      heading={text("yearReview.h05")}
      meta={text("yearReview.m05", { balFrom: bal.from, balTo: bal.to, debtFrom: st.from, debtTo: st.to, repFrom: rep.from, repTo: rep.to })}
    >
      <div data-chart="deficit">
        <h3 className={`${H3} mt-7`}>
          {dfHeading}
          <span className={`${H3_META} inline-flex flex-wrap items-center gap-x-2 gap-y-1`}>
            <span>{withLari([`${balUsed.year}: ${pct(balValue)}`, ...(balGelParts ? [`${balGelParts.num} ${balGelParts.unit}`] : [])].join(" · "))}</span>
            {balProjected ? <PlanTag label={projection} /> : null}
            {balUsed.fallback ? <YearTag year={balUsed.year} /> : null}
          </span>
        </h3>
        <div className="mt-[18px]">{deficitChart}</div>
        <Foot
          share={
            <ChartShareButton
              title={dfHeading}
              caption={`${text("main.percentGdp")} · ${bal.from}–${bal.to}`}
              legend={[{ label: surplusLabel, color: POSITIVE }, { label: deficitLabel, color: NEGATIVE }]}
              source={data.sources.balance}
              chart={deficitChart}
              period={`${bal.from}-${bal.to}`}
            />
          }
        >
          <Key items={[{ label: surplusLabel, color: POSITIVE }, { label: deficitLabel, color: NEGATIVE }]} {...(balProjFrom === undefined ? {} : { projection: text("yearReview.dfProj") })} />
        </Foot>
      </div>

      <div className="mt-3 grid grid-cols-1 items-start gap-10 @min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] @min-[1100px]:gap-14">
        <div data-panel="debt" className="min-w-0">
          <h3 className={`${H3} mt-10 min-[768px]:mt-[52px]`}>
            {text("yearReview.dbH")}
            {debt.fallback ? <span className="self-center"><YearTag year={debt.year} /></span> : <span className={H3_META}>{debt.year}</span>}
          </h3>
          <p className="mt-3.5 flex items-baseline gap-2.5 font-[family-name:var(--font-display)] font-semibold leading-[0.95]">
            <b className="text-[50px] tracking-[-0.03em] tabular-nums min-[768px]:text-[64px]">{formatInUnit(total, UNIT_BN)}</b>
            <span className="text-xl">{withLari(text("yearReview.bn"))}</span>
          </p>
          <div aria-hidden="true" className="mt-5 flex h-3.5 gap-0.5">
            {split.map((part) => <i key={part.id} className="block min-w-0.5" style={{ flex: `${part.value} 1 0`, backgroundColor: part.color }} />)}
          </div>
          <ul className="mt-2.5 flex flex-wrap gap-x-6 gap-y-1.5 text-[12.5px] text-[var(--body)]">
            {split.map((part) => (
              <li key={part.id} className="inline-flex items-baseline gap-[7px]">
                <i aria-hidden="true" className="block h-2.5 w-2.5 self-center rounded-[2px]" style={{ backgroundColor: part.color }} />
                <b className="font-[family-name:var(--font-display)] text-[19px] font-semibold leading-none text-[var(--ink)]">{formatShare(part.value / total, false, 0)}</b>
                <span>{part.label} · {shortAmount(part.value, messages)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-[var(--hairline)] min-[768px]:grid-cols-3">
            {facts.map((fact) => (
              <div key={fact.key} className="flex flex-col-reverse pt-2.5">
                <dt className="mt-[3px] text-xs text-[var(--muted)]">{text(fact.key)}</dt>
                <dd className="font-[family-name:var(--font-numeric)] text-lg font-semibold">{withLari(fact.value)}</dd>
              </div>
            ))}
          </dl>
          <p className={`${FIG_KEY} mt-[26px]`}>{rtHeading}</p>
          {ratesChart}
          <Foot
            share={
              <ChartShareButton
                title={rtHeading}
                caption={`% · ${rt.from}–${rt.to}`}
                legend={rateLines.map(({ label, color }) => ({ label, color }))}
                source={data.sources.debt}
                chart={ratesChart}
                period={`${rt.from}-${rt.to}`}
              />
            }
          >
            {bothYear === null ? null : (
              <p className={FOOT_NOTE}>
                {text("yearReview.rtLine", { y: bothYear, d: formatShare(rateIn(rates.domestic, bothYear) / 100), e: formatShare(rateIn(rates.external, bothYear) / 100) })}
              </p>
            )}
          </Foot>
        </div>
        <figure data-chart="debt-stock" className="m-0 min-w-0 @min-[1100px]:mt-[52px]">
          <p className={FIG_KEY}>{stHeading}</p>
          <p className={`${UNIT_LINE} mt-4`}>{withLari(text("yearReview.bn"))}</p>
          <div className="mt-1">{stockChart}</div>
          <Foot
            share={
              <ChartShareButton
                title={stHeading}
                caption={`${text("yearReview.bn")} · ${st.from}–${st.to}`}
                legend={split.map(({ label, color }) => ({ label, color }))}
                source={data.sources.debt}
                chart={stockChart}
                period={`${st.from}-${st.to}`}
              />
            }
          >
            <Key items={split} />
          </Foot>
        </figure>
      </div>

      <div data-panel="repayments">
        <h3 className={`${H3} mt-10 min-[768px]:mt-[52px]`}>
          {wallHeading}
          <span className={H3_META}>{withLari(text("yearReview.wallM", { y: service.years[peak]!, v: shortAmount(serviceTotal[peak]!, messages) }))}</span>
        </h3>
        <p className={`${UNIT_LINE} mt-4`}>{withLari(text("yearReview.bn"))}</p>
        <div className="mt-1">{wallChart}</div>
        <Foot
          share={
            <ChartShareButton
              title={wallHeading}
              caption={`${text("yearReview.bn")} · ${rep.from}–${rep.to}`}
              legend={[{ label: principalLabel, color: INK_LINE }, { label: interestLabel, color: ACCENT }]}
              source={data.sources.debt}
              chart={wallChart}
              period={`${rep.from}-${rep.to}`}
            />
          }
        >
          <Key items={[{ label: principalLabel, color: INK_LINE }, { label: interestLabel, color: ACCENT }]} {...(repProjFrom === undefined ? {} : { projection: text("yearReview.dfProj") })} />
          {repProjFrom === undefined || projTo === undefined ? null : (
            <p className={`${FOOT_NOTE} mt-2.5`}>{text("yearReview.wallNote", { projFrom: repProjFrom, to: projTo })}</p>
          )}
        </Foot>
      </div>
    </Section>
  );
}

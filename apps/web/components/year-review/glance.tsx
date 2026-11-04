"use client";

import Link from "next/link";
import { useId, useMemo } from "react";
import { INK, PAPER } from "../../lib/explorer/colors";
import { formatAmountParts, formatInUnit, formatShare, UNIT_BN, UNIT_PERSONS } from "../../lib/explorer/format";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import type { Locale, Messages } from "../../lib/i18n/types";
import { buildFindings, shortAmount, type Finding, type FindingVisual } from "../../lib/yearReview/findings";
import type { Values, YearReviewData } from "../../lib/yearReview/types";
import { balanceRecord, glanceKpis, taxTotals, type GlanceKpi } from "../../lib/yearReview/yearView";
import { withLari } from "../ui/lari";
import { Sparkline } from "../ui/sparkline";
import { Section } from "./section";
import { PlanTag, YearTag } from "./year-tag";

// Section 01, "{year} at a glance" (spec §4): six headline numbers, each in its dataset's nearest year with a trend
// line and a dot on that year, then the six findings, each a card linking to its page.

const KPI_LABEL: Record<GlanceKpi["id"], string> = {
  spend: "yearReview.kSpend",
  tax: "yearReview.kTax",
  balance: "yearReview.kBal",
  debt: "yearReview.kDebt",
  breaks: "yearReview.kTB",
  perResident: "yearReview.kPer",
};
const TENTHS = { ...UNIT_PERSONS, decimals: 1 };

const at = (years: readonly number[], values: Values, year: number): number | null => values[years.indexOf(year)] ?? null;
const daysIn = (year: number) => ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365);

/** The words of one headline number: its value and unit, and the detail line under it. */
function kpiText(kpi: GlanceKpi, data: YearReviewData, messages: Messages, locale: Locale): { value: string; unit: string; detail: string } {
  const text = (key: string, values?: Record<string, string | number>) => message(messages, key, values);
  const { budget } = data;
  const gdp = at(budget.years, budget.gdp, kpi.year);
  const ofGdp = (value: number) => (gdp ? text("yearReview.ofGdp", { p: formatShare(value / gdp) }) : "");
  const billions = { value: formatInUnit(kpi.value, UNIT_BN), unit: text("yearReview.bn") };
  switch (kpi.id) {
    case "spend": {
      if (!kpi.previous) return { ...billions, detail: text("yearReview.firstYear") };
      // A plan compared with an actual year says so, as section 03's change line does (spec §7).
      const planVsActual = kpi.planned && !budget.planned[budget.years.indexOf(kpi.previous.year)];
      const against = planVsActual
        ? text("yearReview.planVsActual", { a: kpi.year, b: kpi.previous.year })
        : text("yearReview.vsPrev", { y: kpi.previous.year });
      return { ...billions, detail: `${formatShare(kpi.value / kpi.previous.value - 1, true)} · ${against}` };
    }
    case "tax":
      return { ...billions, detail: ofGdp(kpi.value) };
    case "balance": {
      const record = balanceRecord(data, kpi.year);
      const first = data.balance.years[0]!;
      const phrase =
        record.kind === "surplus" ? text("yearReview.surplus")
        : record.kind === "smallestSince" ? text(record.sinceSurplus ? "yearReview.balSmallSur" : "yearReview.balSmall", { y: record.since })
        : record.kind === "largestSince" ? text("yearReview.balLarge", { y: record.since })
        : record.kind === "smallestEver" ? text("yearReview.balMin", { from: first })
        : text("yearReview.balMax", { from: first });
      const gel = at(data.balance.years, data.balance.gel, kpi.year);
      // The precision section 04 gives the same amount (formatAmountParts with significant billions).
      const amount = gel === null ? null : formatAmountParts(gel, true, locale, true);
      return { value: formatShare(kpi.value / 100, true), unit: "", detail: amount === null ? phrase : `${amount.num} ${amount.unit} · ${phrase}` };
    }
    case "debt": {
      const external = at(data.debt.stock.years, data.debt.stock.external, kpi.year);
      const share = external === null ? "" : text("yearReview.extOf", { p: formatShare(external / kpi.value, false, 0) });
      return { ...billions, detail: [ofGdp(kpi.value), share].filter(Boolean).join(" · ") };
    }
    case "breaks": {
      const tax = at(budget.years, taxTotals(data), kpi.year);
      return { ...billions, detail: tax ? text("yearReview.per100", { n: formatInUnit((kpi.value / tax) * 100, UNIT_PERSONS) }) : "" };
    }
    case "perResident":
      return {
        value: formatInUnit(kpi.value, UNIT_PERSONS),
        unit: text("yearReview.lari"),
        detail: text("yearReview.perDay", { v: formatInUnit(kpi.value / daysIn(kpi.year), TENTHS) }),
      };
  }
}

function Kpi({ kpi, data }: { kpi: GlanceKpi; data: YearReviewData }) {
  const { locale, messages } = useI18n();
  const { value, unit, detail } = kpiText(kpi, data, messages, locale);
  const planLabel = message(messages, kpi.id === "balance" ? "yearReview.proj" : "yearReview.plan");
  return (
    <li
      data-kpi={kpi.id}
      className="-mt-px -ml-px flex min-w-0 flex-col border-t border-l border-[var(--hairline)] px-3 pt-3 pb-2.5 max-[767px]:odd:pl-0 min-[768px]:px-3.5 min-[768px]:pt-3.5 min-[768px]:pb-3 min-[768px]:@max-[1099px]:nth-[3n+1]:pl-0 @min-[1100px]:first:pl-0"
    >
      <p className="min-h-[2.8em] text-xs leading-[1.4] text-[var(--muted)]">{message(messages, KPI_LABEL[kpi.id])}</p>
      <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 font-[family-name:var(--font-display)] font-semibold leading-none">
        <b className="whitespace-nowrap text-[27px] tracking-[-0.02em] tabular-nums min-[768px]:text-[34px]">{value}</b>
        {unit ? <span className="font-[family-name:var(--font-numeric)] text-[13px] font-medium text-[var(--muted)]">{withLari(unit)}</span> : null}
        {kpi.fallback ? <span className="self-center"><YearTag year={kpi.year} /></span> : null}
        {kpi.planned ? <span className="self-center"><PlanTag label={planLabel} /></span> : null}
      </p>
      <p className="mt-2 mb-3 font-[family-name:var(--font-numeric)] text-xs leading-normal text-[var(--muted)]">{withLari(detail)}</p>
      <div className="mt-auto">
        <Sparkline values={kpi.spark} color={INK} width={120} height={30} area endDot dotIndex={kpi.sparkIndex} hollowEnd={kpi.planned} planFrom={kpi.sparkPlanFrom ?? undefined} />
      </div>
    </li>
  );
}

/** The two bars of a finding: each scaled to the larger, its short amount beside the name; a hatched bar is given up. */
function FindingBars({ rows }: { rows: Extract<FindingVisual, { kind: "bars" }>["rows"] }) {
  const { messages } = useI18n();
  // useId yields characters a url(#…) reference does not take.
  const hatchId = `finding-hatch-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const largest = Math.max(...rows.map((row) => row.value));
  return (
    <>
      {rows.map((row) => (
        <span key={row.label} className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2.5 gap-y-[3px] text-[11.5px] first:mt-0">
          <span className="truncate text-[var(--muted)]">{row.label}</span>
          <span className="whitespace-nowrap font-[family-name:var(--font-numeric)] text-[11px] font-semibold">{shortAmount(row.value, messages)}</span>
          <svg className="col-span-2 block h-[9px] w-full">
            {row.hatched ? (
              <defs>
                <pattern id={hatchId} patternUnits="userSpaceOnUse" width={4} height={4} patternTransform="rotate(45)">
                  <rect width={4} height={4} fill={PAPER} />
                  <rect width={2.4} height={4} fill={row.color} />
                </pattern>
              </defs>
            ) : null}
            <rect width={`${largest > 0 ? (Math.max(0, row.value) / largest) * 100 : 0}%`} height={9} fill={row.hatched ? `url(#${hatchId})` : row.color} />
          </svg>
        </span>
      ))}
    </>
  );
}

function FindingPicture({ visual }: { visual: FindingVisual }) {
  switch (visual.kind) {
    case "spark":
      return <Sparkline values={visual.values} color={visual.color} width={240} height={34} fluidOnMobile area endDot dotIndex={visual.index} />;
    case "bars":
      return <FindingBars rows={visual.rows} />;
    case "split":
      return (
        <span className="flex h-3.5 gap-0.5">
          {visual.parts.map((part, index) => (
            <span key={index} className="block min-w-0.5" style={{ flex: `${part.share} 1 0`, backgroundColor: part.color }} />
          ))}
        </span>
      );
  }
}

function FindingCard({ finding }: { finding: Finding }) {
  const { messages } = useI18n();
  return (
    <li className="flex">
      <Link
        href={finding.href}
        prefetch={false}
        data-finding={finding.id}
        className="flex w-full flex-col border border-[var(--hairline)] bg-[var(--tile)] px-4 pt-4 pb-3.5 transition-colors hover:border-[var(--ink)]"
      >
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-[family-name:var(--font-numeric)] text-[11px] font-semibold text-[var(--accent)]">
          <span>{finding.topic}</span>
          {finding.yearTag !== null ? <YearTag year={finding.yearTag} full /> : null}
          {finding.planned ? <PlanTag label={message(messages, "yearReview.plan")} /> : null}
        </span>
        <b className="mt-2 font-[family-name:var(--font-display)] text-base font-semibold leading-[1.38] text-[var(--ink)] [text-wrap:pretty] min-[768px]:text-[17px]">
          {finding.heading}
        </b>
        <span className="mt-1.5 font-[family-name:var(--font-numeric)] text-[11.5px] leading-normal text-[var(--body)]">{finding.detail}</span>
        {/* The amounts the bars print, for the link's name: the picture itself is hidden from assistive tech. */}
        {finding.visual.kind === "bars" ? (
          <span className="sr-only">{finding.visual.rows.map((row) => `${row.label}: ${shortAmount(row.value, messages)}`).join("; ")}</span>
        ) : null}
        <span aria-hidden="true" className="mt-auto block pt-3.5">
          <FindingPicture visual={finding.visual} />
        </span>
      </Link>
    </li>
  );
}

/** Section 01 for the chosen year. */
export function Glance({ data, year }: { data: YearReviewData; year: number }) {
  const { locale, messages } = useI18n();
  // Hovering a category elsewhere re-renders the page; the year's figures only change with the year or language.
  const kpis = useMemo(() => glanceKpis(data, year), [data, year]);
  const findings = useMemo(() => buildFindings(data, year, messages, locale), [data, year, messages, locale]);
  const fallback = kpis.some((kpi) => kpi.fallback) || findings.some((finding) => finding.yearTag !== null);
  return (
    <Section
      number="01"
      id="year-review-glance"
      first
      heading={message(messages, "yearReview.h01", { y: year })}
      meta={fallback ? message(messages, "yearReview.m01", { y: year }) : null}
    >
      <div className="mt-[22px] overflow-hidden border-t-[1.5px] border-b border-t-[var(--ink)] border-b-[var(--hairline)]">
        <ul className="grid grid-cols-2 min-[768px]:grid-cols-3 @min-[1100px]:grid-cols-6">
          {kpis.map((kpi) => <Kpi key={kpi.id} kpi={kpi} data={data} />)}
        </ul>
      </div>
      <h3 className="mt-10 font-[family-name:var(--font-display)] text-[18.5px] font-semibold leading-[1.3] min-[768px]:mt-[52px] min-[768px]:text-[21px]">
        {message(messages, "yearReview.findH")}
      </h3>
      <ol className="mt-4 grid grid-cols-1 gap-3 min-[768px]:grid-cols-2 @min-[1100px]:grid-cols-3">
        {findings.map((finding) => <FindingCard key={finding.id} finding={finding} />)}
      </ol>
    </Section>
  );
}

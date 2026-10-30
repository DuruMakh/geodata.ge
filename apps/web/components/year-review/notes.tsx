"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { updatedDate } from "../../lib/explorer/coverageLabel";
import { formatInUnit, UNIT_PERSONS } from "../../lib/explorer/format";
import { BUDGET_SECTIONS } from "../../lib/explorer/sections";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import type { Values, YearReviewData } from "../../lib/yearReview/types";
import { nearestYear, spendTotals } from "../../lib/yearReview/yearView";

// The page's "Notes and source" (spec §4, board `an-notes`): the board's list with every date, year range and
// population figure filled in from the data, then the links to the source pages and Methodology. Without a plan year
// or a negative "other taxes" year the budget and receipts notes keep their ranges and drop that clause; another note
// whose years the data does not have (no projection) is left out rather than shown with a gap. No footer line
// follows (spec §9.1).

const OTHER_TAXES_ID = "revenue.other_taxes";

type Range = { from: number; to: number };
/** The first and last year with a value, or null when there is none. */
function rangeOf(years: readonly number[], values: Values, keep: (value: number, index: number) => boolean = () => true): Range | null {
  const present = years.filter((_, index) => values[index] !== null && values[index] !== undefined && keep(values[index]!, index));
  return present.length ? { from: present[0]!, to: present.at(-1)! } : null;
}
/** The first and last year flagged in `flags`. */
const flagged = (years: readonly number[], flags: readonly boolean[]): Range | null => rangeOf(years, years.map((_, index) => (flags[index] ? 0 : null)));

/** The notes for the chosen year (the population figure is that year's, or the nearest one's). */
export function YearReviewNotes({ data, year }: { data: YearReviewData; year: number }) {
  const { locale, messages } = useI18n();
  const text = (key: string, values?: Record<string, string | number>) => message(messages, key, values);
  const { budget, taxBreaks, refunds, balance, debt, municipal } = data;

  const spend = spendTotals(data);
  const actual = rangeOf(budget.years, spend, (_, index) => !budget.planned[index]);
  const plan = flagged(budget.years, budget.planned);
  const anyReceipt = budget.years.map((_, index) => (budget.receipts.some((receipt) => receipt.values[index] !== null && receipt.values[index] !== undefined) ? 0 : null));
  const receipts = rangeOf(budget.years, anyReceipt);
  const otherTaxes = budget.receipts.find((receipt) => receipt.id === OTHER_TAXES_ID);
  const negative = otherTaxes ? rangeOf(budget.years, otherTaxes.values, (value) => value < 0) : null;
  const breaks = rangeOf(taxBreaks.years, taxBreaks.all);
  const refunded = rangeOf(refunds.years, refunds.values);
  const balanceActual = rangeOf(balance.years, balance.pctGdp, (_, index) => !balance.projection[index]);
  const balanceProjection = flagged(balance.years, balance.projection);
  const stock = rangeOf(debt.stock.years, debt.stock.total);
  const schedule = flagged(debt.service.years, debt.service.projection);
  const populationYear = nearestYear(budget.years, budget.population, year);
  const gdp = rangeOf(budget.years, budget.gdp);

  const notes = [
    text("yearReview.nSrc", { date: updatedDate(data.updatedAt, locale) }),
    text("yearReview.nScope"),
    actual === null
      ? null
      : plan
        ? text("yearReview.nBasisExp", { from: actual.from, to: actual.to, planYear: plan.from })
        : text("yearReview.nBasisExpActual", { from: actual.from, to: actual.to }),
    receipts === null
      ? null
      : negative
        ? text("yearReview.nRev", { from: receipts.from, to: receipts.to, negFrom: negative.from, negTo: negative.to })
        : text("yearReview.nRevBase", { from: receipts.from, to: receipts.to }),
    breaks && refunded ? text("yearReview.nTB", { tbFrom: breaks.from, tbTo: breaks.to, rfFrom: refunded.from, rfTo: refunded.to }) : null,
    balanceActual && balanceProjection
      ? text("yearReview.nDef", { from: balanceActual.from, actualTo: balanceActual.to, projFrom: balanceProjection.from, projTo: balanceProjection.to })
      : null,
    stock && schedule ? text("yearReview.nDebt", { from: stock.from, to: stock.to, projFrom: schedule.from, projTo: schedule.to }) : null,
    text("yearReview.nMun", { year: municipal.year }),
    populationYear === null
      ? null
      : text("yearReview.nPop", { y: populationYear, v: formatInUnit(budget.population[budget.years.indexOf(populationYear)], UNIT_PERSONS) }),
    gdp ? text("yearReview.nGdp", { prelim: gdp.to }) : null,
    text("yearReview.nRound"),
    text("yearReview.nNominal"),
  ].filter((note): note is string => note !== null);

  const links = [
    { key: "yearReview.lExp", href: BUDGET_SECTIONS.expenditure.href! },
    { key: "yearReview.lTypes", href: BUDGET_SECTIONS.expenditureTypes.href! },
    { key: "yearReview.lRev", href: BUDGET_SECTIONS.revenue.href! },
    { key: "yearReview.lTB", href: BUDGET_SECTIONS.taxBreaksRefunds.href! },
    { key: "yearReview.lMun", href: BUDGET_SECTIONS.municipalities.href! },
    { key: "yearReview.lDef", href: BUDGET_SECTIONS.deficit.href! },
    { key: "yearReview.lDebt", href: BUDGET_SECTIONS.debt.href! },
    { key: "common.methodology", href: "/methodology" },
  ];

  return (
    <section id="year-review-notes" aria-labelledby="year-review-notes-heading" className="mt-16 border-t border-[var(--hairline)] pt-3.5 min-[768px]:mt-[88px]">
      <h2 id="year-review-notes-heading" className="font-[family-name:var(--font-numeric)] text-xs font-semibold tracking-[0.03em] text-[var(--muted)]">
        {text("yearReview.notesH")}
      </h2>
      <ul className="m-0 mt-3 grid max-w-[900px] list-none gap-[7px] p-0">
        {notes.map((note) => (
          <li
            key={note}
            className="relative pl-4 text-[12.5px] leading-[1.6] text-[var(--body)] before:absolute before:top-[0.82em] before:left-0 before:w-[7px] before:border-t before:border-[var(--control)] before:content-['']"
          >
            {note}
          </li>
        ))}
      </ul>
      <p className="mt-[18px] flex flex-wrap gap-2">
        {links.map((link) => (
          <Link
            key={link.key}
            href={pageHref(link.href, locale)}
            prefetch={false}
            className="inline-flex min-h-9 items-center gap-1.5 border border-[var(--hairline)] px-3 text-[12.5px] font-semibold transition-colors duration-150 hover:border-[var(--ink)] hover:bg-[var(--tile)]"
          >
            {text(link.key)}
            <ArrowUpRight aria-hidden size={14} strokeWidth={1.75} className="text-[var(--accent)]" />
          </Link>
        ))}
      </p>
    </section>
  );
}

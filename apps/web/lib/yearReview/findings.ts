// The six findings of section 01: a sentence, a detail line and a small picture each, computed from one year's data
// by the rules of the spec's §7. Every word comes from the yearReview messages; numbers are filled in here.

import { ACCENT, INK, SPLIT_REST, SPLIT_SHADES } from "../explorer/colors";
import { formatInUnit, formatShare, UNIT_BN, UNIT_MLN, UNIT_PERSONS } from "../explorer/format";
import { BUDGET_SECTIONS } from "../explorer/sections";
import { message } from "../i18n/messages";
import { pageHref } from "../i18n/routes";
import type { Locale, Messages, TemplateValues } from "../i18n/types";
import type { Values, YearReviewData } from "./types";
import { givesUpView, onYears, picked, sumAll, taxTotals, whereAll, whereView } from "./yearView";

export type FindingVisual =
  | { kind: "spark"; values: Values; index: number; color: string }
  | { kind: "bars"; rows: { label: string; value: number; color: string; hatched?: boolean }[] }
  | { kind: "split"; parts: { share: number; color: string }[] };

export type Finding = {
  id: "taxes" | "breaks" | "debtRank" | "types" | "service" | "municipal";
  topic: string;
  href: string;
  yearTag: number | null; // the year used, when it is not the chosen year
  planned: boolean; // the figures come from a planned budget year or a projection
  heading: string;
  detail: string;
  visual: FindingVisual;
};

const DEBT_SERVICE_ID = "spending.debt_service";
// From here an amount reads in billions; just below it, millions would round up to "1,000".
const BILLIONS_FROM = 0.9995e9;

type Body = Omit<Finding, "id" | "topic" | "href">;
type Text = (key: string, values?: TemplateValues) => string;

/** Each position's value where the position before it has one too, else null: the years that can show a change. */
const withPrevious = (values: Values): Values => values.map((value, index) => (index > 0 && values[index - 1] !== null ? value : null));

/** Money in the board's short form: "12.3 bn" from a billion up, "456 mln" below. */
export function shortAmount(value: number, messages: Messages): string {
  return Math.abs(value) >= BILLIONS_FROM
    ? `${formatInUnit(value, UNIT_BN)} ${message(messages, "yearReview.bnS")}`
    : `${formatInUnit(value, UNIT_MLN)} ${message(messages, "yearReview.mlnS")}`;
}

/** "მე-4" in Georgian; "4th" in English, by the English ordinal plural rules (1st, 2nd, 3rd, 11th–13th). */
function ordinal(rank: number, text: Text, locale: Locale): string {
  return locale === "en" ? text(`yearReview.ordinal.${new Intl.PluralRules("en", { type: "ordinal" }).select(rank)}`, { n: rank }) : text("yearReview.ordinal", { n: rank });
}

/** Finding 1: among tax lines positive in both years, the one that fell, the largest fall, or the fastest growth. */
function taxes(data: YearReviewData, year: number, text: Text, amount: (value: number) => string): Body {
  const { years, receipts } = data.budget;
  const used = picked("tax revenue change", years, withPrevious(taxTotals(data)), year);
  const moves = receipts
    .filter((receipt) => receipt.tax)
    .flatMap((tax) => {
      const before = tax.values[used.index - 1] ?? null;
      const now = tax.values[used.index] ?? null;
      return before !== null && now !== null && before > 0 && now > 0 ? [{ tax, before, now }] : [];
    });
  const fell = moves.filter((move) => move.now < move.before).sort((left, right) => left.now - left.before - (right.now - right.before));
  const named = fell[0] ?? moves.toSorted((left, right) => right.now / right.before - left.now / left.before)[0];
  if (!named) throw new Error(`Year in review: no tax line has a value in ${years[used.index - 1]} and ${used.year}`);
  const key = fell.length === 1 ? "yearReview.f6one" : fell.length > 1 ? "yearReview.f6many" : "yearReview.f6none";
  return {
    yearTag: used.fallback ? used.year : null,
    planned: false,
    heading: text(key, { name: named.tax.label }),
    detail: text("yearReview.f6d", {
      a: amount(named.before),
      b: amount(named.now),
      p: formatShare(named.now / named.before - 1, true),
      y: years[used.index - 1]!,
    }),
    visual: { kind: "spark", values: named.tax.values, index: used.index, color: named.tax.color },
  };
}

/** Finding 2: VAT given up for every 100 GEL of VAT collected, against the first year of the tax-breaks report. */
function breaks(data: YearReviewData, year: number, text: Text, amount: (value: number) => string): Body {
  const view = givesUpView(data, year);
  const first = givesUpView(data, data.taxBreaks.years[0]!);
  const [collected, given] = view.value.vat;
  const whole = (value: number) => formatInUnit(value, UNIT_PERSONS);
  return {
    yearTag: view.fallback ? view.year : null,
    planned: false,
    heading: text("yearReview.f2h", { n: whole(view.value.per100.vat) }),
    detail: view.year > first.year
      ? text("yearReview.f2d", { y: first.year, n: whole(first.value.per100.vat) })
      : text("yearReview.f2d0", { a: amount(collected), b: amount(given) }),
    visual: {
      kind: "bars",
      rows: [
        { label: text("yearReview.fbIn"), value: collected, color: INK },
        { label: text("yearReview.fbOut"), value: given, color: ACCENT, hatched: true },
      ],
    },
  };
}

/** Finding 3: debt service's rank among the spending fields (fields in either grouping) and its gap to the neighbour. */
function debtRank(data: YearReviewData, year: number, text: Text, amount: (value: number) => string, locale: Locale): Body {
  const view = whereView(data, "fields", year);
  const rank = view.items.findIndex((item) => item.id === DEBT_SERVICE_ID);
  const self = view.items[rank];
  const other = view.items[rank === 0 ? 1 : rank - 1];
  if (!self || !other) throw new Error(`Year in review: ${DEBT_SERVICE_ID} and another field need values in ${year}`);
  const bar = (item: typeof self) => ({ label: item.label, value: item.value, color: item.color });
  const gap = Math.abs(other.value - self.value);
  return {
    yearTag: null,
    planned: view.planned,
    heading: rank === 0 ? text("yearReview.f1top") : text("yearReview.f1h", { r: ordinal(rank + 1, text, locale) }),
    detail: rank === 0
      ? text("yearReview.f1next", { name: other.label, gap: amount(gap) })
      : text(gap < 0.01 * view.total ? "yearReview.f1close" : "yearReview.f1far", { name: other.label, gap: amount(gap) }),
    visual: { kind: "bars", rows: rank === 0 ? [bar(self), bar(other)] : [bar(other), bar(self)] },
  };
}

/** Finding 4: the spending type that moved against all the others, else the largest percentage change. */
function types(data: YearReviewData, year: number, text: Text, amount: (value: number) => string): Body {
  const { years, total, types: all } = data.spendingTypes;
  const used = picked("spending by type change", years, withPrevious(total), year);
  const moves = all.flatMap((type) => {
    const before = type.values[used.index - 1] ?? null;
    const now = type.values[used.index] ?? null;
    return before !== null && now !== null && before > 0 ? [{ type, before, now, change: now / before - 1 }] : [];
  });
  const down = moves.filter((move) => move.change < 0);
  const up = moves.filter((move) => move.change > 0);
  const lone =
    down.length === 1 && up.length === moves.length - 1 ? { move: down[0]!, key: "yearReview.f3onlyDown" }
    : up.length === 1 && down.length === moves.length - 1 ? { move: up[0]!, key: "yearReview.f3onlyUp" }
    : null;
  const named = lone?.move ?? moves.toSorted((left, right) => Math.abs(right.change) - Math.abs(left.change))[0];
  if (!named) throw new Error(`Year in review: no spending type has a value in ${years[used.index - 1]} and ${used.year}`);
  return {
    yearTag: used.fallback ? used.year : null,
    planned: false,
    heading: text("yearReview.f3h", { name: named.type.label, p: formatShare(named.change, true), y: years[used.index - 1]! }),
    detail: lone ? text(lone.key, { n: moves.length }) : text("yearReview.f3d", { a: amount(named.before), b: amount(named.now) }),
    visual: { kind: "spark", values: named.type.values, index: used.index, color: named.type.color },
  };
}

/** Finding 5: debt repayments and interest as a share of tax revenue, in the nearest year that has both. */
function service(data: YearReviewData, year: number, text: Text, amount: (value: number) => string): Body {
  const { years, principal, interest, projection } = data.debt.service;
  const paid = sumAll([principal, interest]);
  const tax = onYears(years, data.budget.years, taxTotals(data));
  const used = picked("debt service against tax revenue", years, whereAll([paid, tax]), year);
  const [paidThen, taxThen] = [paid[used.index]!, tax[used.index]!];
  return {
    yearTag: used.fallback ? used.year : null,
    planned: projection[used.index] ?? false,
    heading: text("yearReview.f4h", { p: formatShare(paidThen / taxThen, false, 0) }),
    detail: text("yearReview.f4d", { a: amount(principal[used.index]!), b: amount(interest[used.index]!) }),
    visual: {
      kind: "bars",
      rows: [
        { label: text("yearReview.fbTax"), value: taxThen, color: INK },
        { label: text("yearReview.fbSvc"), value: paidThen, color: ACCENT },
      ],
    },
  };
}

/** Finding 6: the fewest municipalities, largest first, whose spending passes half of the municipal total. */
function municipal(data: YearReviewData, year: number, text: Text): Body {
  const { places, year: municipalYear } = data.municipal;
  const total = places.reduce((sum, place) => sum + place.totalGel, 0);
  const top: typeof places = [];
  let held = 0;
  for (const place of places.toSorted((left, right) => right.totalGel - left.totalGel)) {
    if (held > total / 2) break;
    top.push(place);
    held += place.totalGel;
  }
  const rest = (total - held) / total;
  return {
    yearTag: municipalYear === year ? null : municipalYear,
    planned: false,
    heading: text("yearReview.f5h", { p: formatShare(held / total, false, 0), k: top.length, count: places.length }),
    detail: [
      ...top.map((place) => `${place.label} ${formatShare(place.totalGel / total)}`),
      text("yearReview.f5rest", { n: places.length - top.length, p: formatShare(rest) }),
    ].join(" · "),
    visual: {
      kind: "split",
      parts: [
        ...top.map((place, index) => ({ share: place.totalGel / total, color: SPLIT_SHADES[Math.min(index, SPLIT_SHADES.length - 1)]! })),
        { share: rest, color: SPLIT_REST },
      ],
    },
  };
}

/** The six findings for the chosen year, each in its dataset's nearest year, linking to its topic page. */
export function buildFindings(data: YearReviewData, year: number, messages: Messages, locale: Locale): Finding[] {
  const text: Text = (key, values) => message(messages, key, values);
  const amount = (value: number) => shortAmount(value, messages);
  const card = (id: Finding["id"], topicKey: string, href: string, body: Body): Finding => ({
    id,
    topic: text(topicKey),
    href: pageHref(href, locale),
    ...body,
  });
  return [
    card("taxes", "yearReview.lRev", BUDGET_SECTIONS.revenue.href!, taxes(data, year, text, amount)),
    card("breaks", "yearReview.lTB", BUDGET_SECTIONS.taxBreaksRefunds.href!, breaks(data, year, text, amount)),
    card("debtRank", "yearReview.lExp", BUDGET_SECTIONS.expenditure.href!, debtRank(data, year, text, amount, locale)),
    card("types", "yearReview.lTypes", BUDGET_SECTIONS.expenditureTypes.href!, types(data, year, text, amount)),
    card("service", "yearReview.lDebt", BUDGET_SECTIONS.debt.href!, service(data, year, text, amount)),
    card("municipal", "yearReview.lMun", BUDGET_SECTIONS.municipalities.href!, municipal(data, year, text)),
  ];
}

import type { Presentation, TemplateValues } from "../i18n/types";
import { message } from "../i18n/messages";
import type {
  ServedBudgetFact,
  ServedGeneralGovernmentBalanceFact,
  ServedGovernmentDebtFact,
} from "../servedRows";
import { MUNICIPAL_COUNTRY_BUDGET_COUNT } from "./municipalData";
import { chooseActivePublicFacts } from "../data/activeFacts";
import { isDerivedTotalItemId, isPlannedYear } from "./explorerData";
import { formatAmount, formatShare } from "./format";
import { INK } from "./colors";
import { BUDGET_SECTIONS } from "./sections";
import { coverageRange } from "./coverageLabel";
import { annualSeries } from "./sparkline";
import type { PlaceEntry } from "./places/types";
import type { CardGraphic, CardLatest } from "./topicHub";

// Budget hub cards (DESIGN.md §6.7). Every figure is derived from the served
// facts at build time, so the hub can never drift from the pages behind it.

export type HubCardModel = {
  index: string;
  title: string;
  description: string;
  href: string | null;
  comingSoon: boolean;
  series: (number | null)[] | null;
  seriesColor: string | null;
  footer: string | null;
  /** The figure the footer prints, for the group pages' cards; absent on a card whose footer names only years. */
  latest?: CardLatest | null;
  /** The years the page covers, `2010–2025`. */
  years?: string;
  /** A card with no single figure whose years end in a plan year: that year as the plan (`2026 გეგმა`), which its footer names. */
  plan?: string;
  graphic?: CardGraphic;
  /** A Regions card's figures for its spread, where they follow the measure its page maps rather than the place index's (Housing: floor area). */
  spreadEntries?: PlaceEntry[];
};

// Mirrors what the destination pages do: sum the category rows, but let an
// explicit `<side>.total` row win for its year when the source carries one, the
// way singleYear.ts and explorerData.ts already do. Adding such a row to the sum
// instead of overriding with it would report the budget at several times its size.
function totalsByYear(facts: ServedBudgetFact[], side: "expenditure" | "revenue"): Map<number, number> {
  const totals = new Map<number, number>();
  const explicitTotals = new Map<number, number>();

  for (const fact of chooseActivePublicFacts(facts)) {
    if (fact.side !== side) continue;
    if (isDerivedTotalItemId(fact.itemId)) {
      explicitTotals.set(fact.year, fact.amountGel);
      continue;
    }
    totals.set(fact.year, (totals.get(fact.year) ?? 0) + fact.amountGel);
  }

  for (const [year, amountGel] of explicitTotals) {
    totals.set(year, amountGel);
  }

  return totals;
}

function categoryCount(facts: ServedBudgetFact[], side: "expenditure" | "revenue", year: number): number {
  const ids = new Set<string>();
  for (const fact of chooseActivePublicFacts(facts)) {
    if (fact.side !== side || fact.year !== year) continue;
    if (isDerivedTotalItemId(fact.itemId)) continue;
    ids.add(fact.itemId);
  }
  return ids.size;
}

export function buildHubCards(
  facts: ServedBudgetFact[],
  municipalTotals: Map<number, number>,
  debtFacts: ServedGovernmentDebtFact[],
  balanceFacts: ServedGeneralGovernmentBalanceFact[] = [],
  presentation?: Presentation,
  /** General-government total spending by year, from the spending-by-type page. */
  expenditureTypeTotals: Map<number, number> = new Map(),
  /** Tax refunds by year, from the tax breaks and refunds page. */
  refundTotals: Map<number, number> = new Map(),
  /** Each card also carries the figure its footer prints (`latest`), for the group pages' cards. */
  withLatest = false,
): HubCardModel[] {
  const locale = presentation?.locale ?? "ka";
  const translated = (key: string, originalKa: string, values?: TemplateValues) => presentation ? message(presentation.messages, key, values) : originalKa;
  const expenditure = totalsByYear(facts, "expenditure");
  const revenue = totalsByYear(facts, "revenue");

  const yearLabel = (year: number) => translated("main.plannedYear", `${year} გეგმა`, { year });
  const build = (totals: Map<number, number>, planned = false) => {
    const years = Array.from(totals.keys()).sort((a, b) => a - b);
    const first = years.at(0);
    const latest = years.at(-1) ?? null;
    // Walk the whole span rather than the keys that happen to exist: a year with
    // no facts has to arrive as a null the sparkline breaks on. Mapping the keys
    // drops it instead, which re-spaces every remaining point and quietly turns
    // the x axis into something other than time.
    const span =
      first === undefined || latest === null
        ? []
        : Array.from({ length: latest - first + 1 }, (_, index) => first + index);

    const amount = latest === null ? null : formatAmount(totals.get(latest) ?? 0, locale);
    return {
      series: span.length > 0 ? span.map((year) => totals.get(year) ?? null) : null,
      footer: latest === null ? null : `${planned ? yearLabel(latest) : latest} · ${amount}`,
      latest,
      // A planned latest year reads as the plan the Spending page's line names (`2026 გეგმა`), never as a bare year beside actuals.
      figure: !withLatest || amount === null || latest === null ? null : { value: amount, period: planned ? yearLabel(latest) : String(latest), ...(planned ? { planned } : {}) },
      years: first === undefined || latest === null ? undefined : coverageRange(first, latest),
    };
  };

  const spendIsPlanned = isPlannedYear(facts, "expenditure", Array.from(expenditure.keys()).sort((a, b) => a - b).at(-1) ?? null);
  const spend = build(expenditure, spendIsPlanned);
  const spendByType = build(expenditureTypeTotals);
  const revenues = build(revenue);
  const municipal = build(municipalTotals);
  const refunds = build(refundTotals);
  const debtTotals = new Map<number, number>();
  for (const fact of debtFacts) {
    if (fact.seriesId === "debt.stock.total" && fact.status === "actual" && fact.value !== null) {
      debtTotals.set(fact.year, fact.value);
    }
  }
  const debt = build(debtTotals);
  const actualBalanceFacts = balanceFacts.filter((fact) => fact.status === "actual");
  const balanceYears = actualBalanceFacts.map((fact) => fact.year).sort((a, b) => a - b);
  const latestBalance = actualBalanceFacts.find((fact) => fact.year === balanceYears.at(-1)) ?? null;
  const analysisYear = spend.latest;

  return [
    {
      index: "01",
      title: translated("common.expenditure", BUDGET_SECTIONS.expenditure.label),
      description: translated("hub.expenditureDescription", "ფუნქციონალური და უწყებრივი ჭრილი — რაში იხარჯება ბიუჯეტი."),
      href: BUDGET_SECTIONS.expenditure.href,
      comingSoon: BUDGET_SECTIONS.expenditure.href === null,
      series: spend.series,
      seriesColor: INK,
      footer: spend.footer,
      latest: spend.figure,
      years: spend.years,
    },
    {
      index: "02",
      title: translated("common.expenditureTypes", BUDGET_SECTIONS.expenditureTypes.label),
      description: translated("hub.expenditureTypesDescription", "ხელფასები, პროცენტი, სუბსიდიები, სოციალური უზრუნველყოფა და ინვესტიცია — რა სახის ხარჯებია."),
      href: BUDGET_SECTIONS.expenditureTypes.href,
      comingSoon: BUDGET_SECTIONS.expenditureTypes.href === null,
      series: spendByType.series,
      seriesColor: spendByType.series === null ? null : INK,
      footer: spendByType.footer,
      latest: spendByType.figure,
      years: spendByType.years,
    },
    {
      index: "03",
      title: translated("common.revenue", BUDGET_SECTIONS.revenue.label),
      description: translated("hub.revenueDescription", "გადასახადები, გრანტები და სხვა შემოსულობები წლების მიხედვით."),
      href: BUDGET_SECTIONS.revenue.href,
      comingSoon: BUDGET_SECTIONS.revenue.href === null,
      series: revenues.series,
      seriesColor: INK,
      footer: revenues.footer,
      latest: revenues.figure,
      years: revenues.years,
    },
    {
      index: "04",
      title: translated("common.taxBreaksRefunds", BUDGET_SECTIONS.taxBreaksRefunds.label),
      description: translated("hub.taxBreaksRefundsDescription", "რამდენ გადასახადს თმობს სახელმწიფო შეღავათებით და რამდენს უბრუნებს გადამხდელებს."),
      href: BUDGET_SECTIONS.taxBreaksRefunds.href,
      comingSoon: BUDGET_SECTIONS.taxBreaksRefunds.href === null,
      // The sparkline traces refunds, the page's longer total (tax breaks start in 2018).
      series: refunds.series,
      seriesColor: refunds.series === null ? null : INK,
      footer: refunds.latest === null
        ? null
        : translated("hub.taxBreaksRefundsFooter", `${refunds.latest} · დაბრუნება ${formatAmount(refundTotals.get(refunds.latest) ?? 0, locale)}`, { year: refunds.latest, amount: formatAmount(refundTotals.get(refunds.latest) ?? 0, locale) }),
      // The figure is refunds, as the footer says; the caption names them.
      latest: refunds.figure && { ...refunds.figure, caption: translated("hub.taxBreaksRefundsCaption", "დაბრუნება") },
      years: refunds.years,
    },
    {
      index: "05",
      title: translated("common.municipalities", BUDGET_SECTIONS.municipalities.label),
      // The figure beside this is countryTotalFacts — the national roll-up,
      // which carries five excluded budget units and the Adjara A.R. republican
      // payments on top of the 64 served municipalities. Naming those 64 here
      // overstated what they sum to by 8.6%; this is the wording the
      // destination page and buildIndexKpis already use.
      description: translated("hub.municipalDescription", `${MUNICIPAL_COUNTRY_BUDGET_COUNT} მუნიციპალური საბიუჯეტო ერთეული — რაში იხარჯება ადგილობრივი ბიუჯეტები.`, { count: MUNICIPAL_COUNTRY_BUDGET_COUNT }),
      href: BUDGET_SECTIONS.municipalities.href,
      comingSoon: BUDGET_SECTIONS.municipalities.href === null,
      series: municipal.series,
      // ink, not accent: the sparkline traces a side total, and DESIGN.md §4.2
      // gives every total series ink. #B3402A is a category token.
      seriesColor: municipal.series === null ? null : INK,
      footer: municipal.footer,
      latest: municipal.figure,
      years: municipal.years,
    },
    {
      index: "06",
      title: translated("common.analysis", BUDGET_SECTIONS.analysis.label),
      description: translated("hub.analysisDescription", "ერთი წლის სურათი — სტრუქტურა, რეიტინგი და ყოველი 100 ₾."),
      href: BUDGET_SECTIONS.analysis.href,
      comingSoon: BUDGET_SECTIONS.analysis.href === null,
      series: null,
      seriesColor: null,
      footer:
        analysisYear === null
          ? null
          : translated("hub.analysisFooter", `${spendIsPlanned ? yearLabel(analysisYear) : analysisYear} · ${categoryCount(facts, "expenditure", analysisYear)} კატეგორია`, { year: spendIsPlanned ? yearLabel(analysisYear) : analysisYear, count: categoryCount(facts, "expenditure", analysisYear) }),
      years: spend.years,
      ...(withLatest && spendIsPlanned && analysisYear !== null ? { plan: yearLabel(analysisYear) } : {}),
    },
    {
      index: "07",
      title: translated("common.debt", BUDGET_SECTIONS.debt.label),
      description: translated("hub.debtDescription", "მთავრობის ვალის მოცულობა, გადახდა და საპროცენტო განაკვეთები."),
      href: BUDGET_SECTIONS.debt.href,
      comingSoon: BUDGET_SECTIONS.debt.href === null,
      series: debt.series,
      seriesColor: debt.series === null ? null : INK,
      footer: debt.footer,
      latest: debt.figure,
      years: debt.years,
    },
    {
      index: "08",
      title: translated("common.deficit", BUDGET_SECTIONS.deficit.label),
      description: translated("hub.deficitDescription", "ზოგადი მთავრობის დეფიციტი ან პროფიციტი — მშპ-ის წილი და თანხა ლარში."),
      href: BUDGET_SECTIONS.deficit.href,
      comingSoon: BUDGET_SECTIONS.deficit.href === null,
      series: actualBalanceFacts.length > 0
        ? annualSeries(actualBalanceFacts.map((fact) => ({ year: fact.year, value: fact.generalGovernmentBalancePctGdp })))
        : null,
      seriesColor: actualBalanceFacts.length > 0 ? INK : null,
      footer: latestBalance === null
        ? null
        : translated("hub.deficitFooter", `${latestBalance.year} · ${formatShare(latestBalance.generalGovernmentBalancePctGdp / 100)} მშპ-ის`, { year: latestBalance.year, share: formatShare(latestBalance.generalGovernmentBalancePctGdp / 100) }),
      // The balance keeps its sign, as the page states it; "of GDP" says what the share is of, as the footer did.
      latest: !withLatest || latestBalance === null ? null : { value: formatShare(latestBalance.generalGovernmentBalancePctGdp / 100), period: String(latestBalance.year), caption: translated("hub.deficitCaption", "მშპ-ის") },
      years: balanceYears.length > 0 ? coverageRange(balanceYears[0], balanceYears.at(-1)!) : undefined,
    },
  ];
}

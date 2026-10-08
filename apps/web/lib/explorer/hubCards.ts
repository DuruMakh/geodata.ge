import type { Presentation, TemplateValues } from "../i18n/types";
import { message } from "../i18n/messages";
import type {
  ServedBudgetFact,
  ServedGeneralGovernmentBalanceFact,
  ServedGovernmentDebtFact,
} from "../servedRows";
import { MUNICIPAL_COUNTRY_BUDGET_COUNT } from "./municipalData";
import { chooseActivePublicFacts } from "../data/activeFacts";
import { isDerivedTotalItemId } from "./explorerData";
import { formatAmount, formatShare } from "./format";
import { INK } from "./colors";
import { BUDGET_SECTIONS } from "./sections";

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
): HubCardModel[] {
  const locale = presentation?.locale ?? "ka";
  const translated = (key: string, originalKa: string, values?: TemplateValues) => presentation ? message(presentation.messages, key, values) : originalKa;
  const expenditure = totalsByYear(facts, "expenditure");
  const revenue = totalsByYear(facts, "revenue");

  const build = (totals: Map<number, number>) => {
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

    return {
      series: span.length > 0 ? span.map((year) => totals.get(year) ?? null) : null,
      footer: latest === null ? null : `${latest} · ${formatAmount(totals.get(latest) ?? 0, locale)}`,
      latest,
    };
  };

  const spend = build(expenditure);
  const revenues = build(revenue);
  const municipal = build(municipalTotals);
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
    },
    {
      index: "02",
      title: translated("common.revenue", BUDGET_SECTIONS.revenue.label),
      description: translated("hub.revenueDescription", "გადასახადები, გრანტები და სხვა შემოსულობები წლების მიხედვით."),
      href: BUDGET_SECTIONS.revenue.href,
      comingSoon: BUDGET_SECTIONS.revenue.href === null,
      series: revenues.series,
      seriesColor: INK,
      footer: revenues.footer,
    },
    {
      index: "03",
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
    },
    {
      index: "04",
      title: translated("common.analysis", BUDGET_SECTIONS.analysis.label),
      description: translated("hub.analysisDescription", "ერთი წლის სურათი — სტრუქტურა, რეიტინგი და ყოველი 100 ₾."),
      href: BUDGET_SECTIONS.analysis.href,
      comingSoon: BUDGET_SECTIONS.analysis.href === null,
      series: null,
      seriesColor: null,
      footer:
        analysisYear === null
          ? null
          : translated("hub.analysisFooter", `${analysisYear} · ${categoryCount(facts, "expenditure", analysisYear)} კატეგორია`, { year: analysisYear, count: categoryCount(facts, "expenditure", analysisYear) }),
    },
    {
      index: "05",
      title: translated("common.debt", BUDGET_SECTIONS.debt.label),
      description: translated("hub.debtDescription", "მთავრობის ვალის მოცულობა, გადახდა და საპროცენტო განაკვეთები."),
      href: BUDGET_SECTIONS.debt.href,
      comingSoon: BUDGET_SECTIONS.debt.href === null,
      series: debt.series,
      seriesColor: debt.series === null ? null : INK,
      footer: debt.footer,
    },
    {
      index: "06",
      title: translated("common.deficit", BUDGET_SECTIONS.deficit.label),
      description: translated("hub.deficitDescription", "ზოგადი მთავრობის დეფიციტი ან პროფიციტი — მშპ-ის წილი და თანხა ლარში."),
      href: BUDGET_SECTIONS.deficit.href,
      comingSoon: BUDGET_SECTIONS.deficit.href === null,
      series: actualBalanceFacts.length > 0
        ? balanceYears.map((year) => actualBalanceFacts.find((fact) => fact.year === year)?.generalGovernmentBalancePctGdp ?? null)
        : null,
      seriesColor: actualBalanceFacts.length > 0 ? INK : null,
      footer: latestBalance === null
        ? null
        : translated("hub.deficitFooter", `${latestBalance.year} · ${formatShare(latestBalance.generalGovernmentBalancePctGdp / 100)} მშპ-ის`, { year: latestBalance.year, share: formatShare(latestBalance.generalGovernmentBalancePctGdp / 100) }),
    },
  ];
}

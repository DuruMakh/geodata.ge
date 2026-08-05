import type { ServedBudgetFact } from "../servedRows";
import { chooseActivePublicFacts } from "../data/activeFacts";
import { isDerivedTotalItemId } from "./explorerData";
import { formatAmount } from "./format";
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
): HubCardModel[] {
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
      footer: latest === null ? null : `${latest} · ${formatAmount(totals.get(latest) ?? 0)}`,
      latest,
    };
  };

  const spend = build(expenditure);
  const revenues = build(revenue);
  const municipal = build(municipalTotals);
  const analysisYear = spend.latest;

  return [
    {
      index: "01",
      title: BUDGET_SECTIONS.expenditure.label,
      description: "ფუნქციონალური და უწყებრივი ჭრილი — რაში იხარჯება ბიუჯეტი.",
      href: BUDGET_SECTIONS.expenditure.href,
      comingSoon: BUDGET_SECTIONS.expenditure.href === null,
      series: spend.series,
      seriesColor: INK,
      footer: spend.footer,
    },
    {
      index: "02",
      title: BUDGET_SECTIONS.revenue.label,
      description: "გადასახადები, გრანტები და სხვა შემოსულობები წლების მიხედვით.",
      href: BUDGET_SECTIONS.revenue.href,
      comingSoon: BUDGET_SECTIONS.revenue.href === null,
      series: revenues.series,
      seriesColor: INK,
      footer: revenues.footer,
    },
    {
      index: "03",
      title: BUDGET_SECTIONS.municipalities.label,
      description: "64 მუნიციპალიტეტი და 11 რეგიონი — რაში იხარჯება ადგილობრივი ბიუჯეტები.",
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
      title: BUDGET_SECTIONS.analysis.label,
      description: "ერთი წლის სურათი — სტრუქტურა, რეიტინგი და ყოველი 100 ₾.",
      href: BUDGET_SECTIONS.analysis.href,
      comingSoon: BUDGET_SECTIONS.analysis.href === null,
      series: null,
      seriesColor: null,
      footer:
        analysisYear === null
          ? null
          : `${analysisYear} · ${categoryCount(facts, "expenditure", analysisYear)} კატეგორია`,
    },
  ];
}

import type { BudgetFactImportRow } from "../data/importBudgetFacts";
import { chooseActivePublicFacts } from "../data/activeFacts";
import { isDerivedTotalItemId } from "./explorerData";
import { formatAmount } from "./format";
import { INK } from "./colors";

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

function totalsByYear(facts: BudgetFactImportRow[], side: "expenditure" | "revenue"): Map<number, number> {
  const totals = new Map<number, number>();
  for (const fact of chooseActivePublicFacts(facts)) {
    if (fact.side !== side) continue;
    if (isDerivedTotalItemId(fact.itemId)) continue;
    totals.set(fact.year, (totals.get(fact.year) ?? 0) + fact.amountGel);
  }
  return totals;
}

function categoryCount(facts: BudgetFactImportRow[], side: "expenditure" | "revenue", year: number): number {
  const ids = new Set<string>();
  for (const fact of chooseActivePublicFacts(facts)) {
    if (fact.side !== side || fact.year !== year) continue;
    if (isDerivedTotalItemId(fact.itemId)) continue;
    ids.add(fact.itemId);
  }
  return ids.size;
}

export function buildHubCards(facts: BudgetFactImportRow[]): HubCardModel[] {
  const expenditure = totalsByYear(facts, "expenditure");
  const revenue = totalsByYear(facts, "revenue");

  const build = (totals: Map<number, number>) => {
    const years = Array.from(totals.keys()).sort((a, b) => a - b);
    const latest = years.at(-1) ?? null;
    return {
      series: years.length > 0 ? years.map((year) => totals.get(year) ?? null) : null,
      footer: latest === null ? null : `${latest} · ${formatAmount(totals.get(latest) ?? 0)}`,
      latest,
    };
  };

  const spend = build(expenditure);
  const revenues = build(revenue);
  const analysisYear = spend.latest;

  return [
    {
      index: "01",
      title: "ხარჯები",
      description: "ფუნქციონალური და უწყებრივი ჭრილი — რაში იხარჯება ბიუჯეტი.",
      href: "/explorer/expenditure",
      comingSoon: false,
      series: spend.series,
      seriesColor: INK,
      footer: spend.footer,
    },
    {
      index: "02",
      title: "შემოსავლები",
      description: "გადასახადები, გრანტები და სხვა შემოსულობები წლების მიხედვით.",
      href: "/explorer/revenue",
      comingSoon: false,
      series: revenues.series,
      seriesColor: INK,
      footer: revenues.footer,
    },
    {
      index: "03",
      title: "მუნიციპალიტეტები",
      description: "მუნიციპალური ბიუჯეტების ჭრილი — მონაცემები მზადდება.",
      href: null,
      comingSoon: true,
      series: null,
      seriesColor: null,
      footer: null,
    },
    {
      index: "04",
      title: "ანალიზი",
      description: "ერთი წლის სურათი — სტრუქტურა, რეიტინგი და ყოველი 100 ₾.",
      href: "/explorer/analysis",
      comingSoon: false,
      series: null,
      seriesColor: null,
      footer:
        analysisYear === null
          ? null
          : `${analysisYear} · ${categoryCount(facts, "expenditure", analysisYear)} კატეგორია`,
    },
  ];
}

import type { TradeOverviewFact, TradeOverviewIndicator } from "../../data/tradeOverview/types";
import type { TradePartnersData } from "../../data/tradePartners/types";
import type { TradeProductsData } from "../../data/tradeProducts/types";
import { publicLabel } from "../../i18n/labels";
import type { Presentation } from "../../i18n/types";
import type { TradeChapter } from "./types";

// Chapter 09: what Georgia sells and buys abroad. Pure reading of the served
// goods-trade facts. The year is the latest with national exports; partners and
// products are read for that year only.

const PARTNER_LIMIT = 10;

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Trade chapter: no data for ${what}`);
  return value;
}

/** The chapter's year: the latest with national exports. */
export function tradeYear(overview: TradeOverviewFact[]): number {
  const exportYears = overview.filter((fact) => fact.indicatorId === "trade.exports").map((fact) => fact.year);
  return need(exportYears.length ? Math.max(...exportYears) : undefined, "national exports");
}

export function buildTradeChapter(input: { overview: TradeOverviewFact[]; partners: TradePartnersData; products: TradeProductsData }, presentation: Presentation): TradeChapter {
  const totals = new Map<string, number>();
  for (const fact of input.overview) totals.set(`${fact.indicatorId}:${fact.year}`, Number(fact.valueUsd));
  const total = (indicator: TradeOverviewIndicator, year: number) => need(totals.get(`${indicator}:${year}`), `${indicator} ${year}`);

  const year = tradeYear(input.overview);
  const exportsUsd = total("trade.exports", year);

  const years = [...new Set(input.overview.filter((fact) => fact.indicatorId === "trade.imports" && fact.year <= year && totals.has(`trade.exports:${fact.year}`)).map((fact) => fact.year))].sort((a, b) => a - b);

  const flows = new Map<string, number>();
  for (const fact of input.partners.facts) if (fact.year === year && fact.valueUsd !== null) flows.set(`${fact.entityId}:${fact.indicatorId}`, Number(fact.valueUsd));
  const partners = input.partners.entities
    .filter((entity) => entity.kind === "country")
    .flatMap((entity) => {
      const turnoverUsd = flows.get(`${entity.id}:trade.turnover`);
      if (turnoverUsd === undefined) return [];
      return [{
        id: entity.id,
        label: publicLabel(presentation.locale, entity.id, entity.labelKa, presentation.englishLabels),
        exportsUsd: flows.get(`${entity.id}:trade.exports`) ?? 0,
        importsUsd: flows.get(`${entity.id}:trade.imports`) ?? 0,
        turnoverUsd,
      }];
    })
    .sort((a, b) => b.turnoverUsd - a.turnoverUsd)
    .slice(0, PARTNER_LIMIT);

  const entities = new Map(input.products.entities.map((entity) => [entity.id, entity]));
  const ranked = input.products.facts
    .filter((fact) => fact.year === year && fact.indicatorId === "trade.exports" && fact.valueUsd !== null && entities.has(fact.entityId))
    .map((fact) => ({ entity: entities.get(fact.entityId)!, usd: Number(fact.valueUsd) }))
    .sort((a, b) => b.usd - a.usd);
  const label = (entity: (typeof ranked)[number]["entity"]) => publicLabel(presentation.locale, entity.id, entity.labelKa, presentation.englishLabels);
  const top = need(ranked[0], `product exports ${year}`);
  const second = ranked[1];

  return {
    year,
    exportsUsd,
    importsUsd: total("trade.imports", year),
    turnoverUsd: total("trade.turnover", year),
    balanceUsd: total("trade.balance", year),
    years,
    exports: years.map((when) => total("trade.exports", when)),
    imports: years.map((when) => total("trade.imports", when)),
    partners,
    topProduct: { label: label(top.entity), usd: top.usd, share: top.usd / exportsUsd },
    secondProduct: second ? { label: label(second.entity), usd: second.usd } : null,
  };
}

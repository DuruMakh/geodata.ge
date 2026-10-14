import type { ClientTradePartnersData, ClientTradePartnerFact } from "../../lib/data/tradePartners/importTradePartners";
import type { TradeCompositionClassification } from "../../lib/data/tradeComposition/types";
import { getMessages } from "../../lib/i18n/messages.server";

export function compositionFixture(classification: TradeCompositionClassification): ClientTradePartnersData {
  const count = classification === "sitc" ? 10 : 7;
  const entities = Array.from({ length: count }, (_, index) => {
    const sourceCode = String(index + (classification === "sitc" ? 0 : 1));
    return { id: `trade.${classification}1.${sourceCode}`, kind: "commodity_group" as const, sourceCode, labelKa: `ჯგუფი ${sourceCode}` };
  });
  return { dataset: "composition", classification, entities, measures: ["trade.exports", "trade.imports"],
    facts: entities.flatMap((_, index) => [2024, 2025].flatMap(year => [1, 2].map(measure => [index, year, measure, (index === 0 ? 25 : index + 1) * (measure === 2 ? 10 : 1)] as ClientTradePartnerFact))),
    nationalFacts: [2024, 2025].flatMap(year => (["trade.exports", "trade.imports"] as const).map(indicatorId => ({ year, indicatorId, valueUsd: (year === 2025 ? 100 : 200) * (indicatorId === "trade.imports" ? 10 : 1), publicationStatus: "unspecified" as const, role: "total" as const, lastReviewedAt: "2026-10-14", sourceId: "national" }))),
  };
}
export async function compositionPresentation(locale: "en" | "ka", data: ClientTradePartnersData) {
  return { locale, messages: await getMessages(locale, ["trade", "workbook", "format", "controls", "main", "common"]), englishLabels: Object.fromEntries(data.entities.map(e => [e.id, `Group ${e.sourceCode}`])) };
}

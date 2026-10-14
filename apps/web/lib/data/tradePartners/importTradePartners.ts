import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";
import { assertSameServedRows } from "../servedDataParity";
import { resolveServedDataSource } from "../servedDataSource";
import { toClientTradeOverviewFact } from "../tradeOverview/importTradeOverview";
import { TRADE_CHART_INDICATORS, type ClientTradeOverviewFact, type TradeOverviewFact, type TradeChartIndicator } from "../tradeOverview/types";
import { tradePartnerFactKey, type TradePartnerEntity, type TradePartnerFact, type TradePartnersData, type TradePartnersAcceptance } from "./types";
import { tradePartnersEnglishLabels, validateTradePartnersData } from "./validation";

/**
 * One partner observation as the page receives it: the entity's index in `entities`, the year, the measure's index in
 * TRADE_CHART_INDICATORS and the USD value (null when Geostat publishes none). 23,000 of these are inlined into the page,
 * so field names and unread metadata stay server-side; Products uses the same shape.
 */
export type ClientTradePartnerFact = [entityIndex: number, year: number, measureIndex: number, valueUsd: number | null];
export type ClientTradePartnerEntity = Omit<TradePartnerEntity, "kind"> & { kind: TradePartnerEntity["kind"] | "service_type" };
export type ClientTradePartnersData = { dataset?: "services"; entities: ClientTradePartnerEntity[]; facts: ClientTradePartnerFact[]; nationalFacts: ClientTradeOverviewFact[]; measures?: readonly TradeChartIndicator[] };
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");

export async function loadTradePartnersData(): Promise<TradePartnersData> {
  const [csv, catalogue, reportText, labelsText] = await Promise.all([
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/imports/trade-partners-annual.csv")),
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/taxonomy/trade-partners.json")),
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/reports/trade-partners-validation.json"), "utf8"),
    readFile(path.resolve(/* turbopackIgnore: true */ process.cwd(), "../../data/localization/en/labels.json"), "utf8"),
  ]);
  const report = JSON.parse(reportText) as TradePartnersAcceptance, entities = JSON.parse(catalogue.toString("utf8")) as TradePartnerEntity[];
  if (report.status !== "passed" || report.scope !== "annual_goods_partners" || report.canonicalSha256 !== hash(csv) || report.catalogueSha256 !== hash(catalogue) || report.englishLabelsSha256 !== hash(tradePartnersEnglishLabels(entities, JSON.parse(labelsText)))) throw new Error("Trade partners acceptance/catalogue/canonical fingerprint mismatch");
  const rows = parse(csv, { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[];
  const required = ["entity_id", "year", "indicator_id", "value_usd", "unit", "basis", "value_status", "publication_status", "role", "source_id", "source_refs", "source_value", "source_unit", "source_label", "source_number_format", "source_block", "last_reviewed_at"];
  if (!rows.length || rows.some(row => required.some(field => !(field in row)))) throw new Error("Trade partner canonical fields missing");
  const facts: TradePartnerFact[] = rows.map(row => ({
    entityId: row.entity_id, year: Number(row.year), indicatorId: row.indicator_id as TradePartnerFact["indicatorId"], valueUsd: row.value_usd === "" ? null : new Decimal(row.value_usd).toFixed(),
    unit: row.unit as "usd", basis: row.basis as "actual", valueStatus: row.value_status as TradePartnerFact["valueStatus"], publicationStatus: row.publication_status as "unspecified", role: row.role as TradePartnerFact["role"], sourceId: row.source_id, sourceRefs: row.source_refs,
    sourceValue: row.source_value || null, sourceUnit: row.source_unit || null, sourceLabel: row.source_label || null, sourceNumberFormat: row.source_number_format || null, sourceBlock: row.source_block, lastReviewedAt: row.last_reviewed_at,
  }));
  validateTradePartnersData({ entities, facts }, report);
  return { entities, facts };
}

export function assertTradePartnersParity(csv: TradePartnersData, mirror: TradePartnersData): void {
  assertSameServedRows("Trade partner catalogue", csv.entities, mirror.entities, entity => entity.id);
  const normalize = (facts: readonly TradePartnerFact[]) => facts.map(fact => ({ ...fact, valueUsd: fact.valueUsd === null ? null : new Decimal(fact.valueUsd).toFixed() }));
  assertSameServedRows("Trade partner facts", normalize(csv.facts), normalize(mirror.facts), tradePartnerFactKey);
}

let servedPromise: Promise<TradePartnersData> | null = null;
export function loadServedTradePartnersData(): Promise<TradePartnersData> {
  servedPromise ??= (async () => {
    const csv = await loadTradePartnersData();
    if (resolveServedDataSource() === "csv") return csv;
    const { loadTradePartnersDataFromDb } = await import("../../db/servedDataDb");
    const mirror = await loadTradePartnersDataFromDb();
    assertTradePartnersParity(csv, mirror);
    return mirror;
  })();
  return servedPromise;
}

export function toClientTradePartnersData(data: TradePartnersData, nationalFacts: readonly TradeOverviewFact[]): ClientTradePartnersData {
  // Countries' exports and imports add up to the national total of each year; groups overlap.
  const flows = [TRADE_CHART_INDICATORS.indexOf("trade.exports"), TRADE_CHART_INDICATORS.indexOf("trade.imports")];
  const rounded = roundTradeFactsToWholeDollars(packTradePartnerFacts(data.entities, data.facts), ([entity, year, measure]) => data.entities[entity]!.kind === "country" && flows.includes(measure) ? `${year}:${measure}` : null, ([entity]) => data.entities[entity]!.id);
  const facts = deriveFromRoundedInputs(rounded, ([entity, year, measure, valueUsd]) => [`${entity}:${year}`, TRADE_CHART_INDICATORS[measure]!, valueUsd], ([entity, year, measure], valueUsd): ClientTradePartnerFact => [entity, year, measure, valueUsd]);
  return { entities: data.entities, facts, nationalFacts: roundTradeTotalsToWholeDollars(nationalFacts.map(toClientTradeOverviewFact)) };
}

/** Packs partner facts into the compact client shape; the entities' order is the index the facts refer to. */
export function packTradePartnerFacts(entities: readonly { id: string }[], facts: readonly { entityId: string; year: number; indicatorId: TradeChartIndicator; valueUsd: string | number | null }[]): ClientTradePartnerFact[] {
  const indices = new Map(entities.map((entity, index) => [entity.id, index]));
  return facts.map(fact => [indices.get(fact.entityId)!, fact.year, TRADE_CHART_INDICATORS.indexOf(fact.indicatorId), fact.valueUsd === null ? null : Number(fact.valueUsd)]);
}

/**
 * Rounds packed facts to whole US dollars, the precision pages and their Excel workbooks receive (the platform review's
 * recommended default for Q1, pending owner confirmation); the reviewed CSVs and the database mirror keep the exact
 * decimals. Facts that share a `partition` key add up to a published total (one year's countries for one flow): they are
 * rounded together by largest remainder, so they still add up to the rounded total; an equal remainder goes to the
 * smaller `entityId`, whatever the row order. Every value moves by less than a dollar; null stays null.
 */
export function roundTradeFactsToWholeDollars<T extends ClientTradePartnerFact>(facts: readonly T[], partition: (fact: T) => string | null, entityId: (fact: T) => string): T[] {
  const rounded = facts.map(fact => fact[3] === null ? null : Math.floor(fact[3])), groups = new Map<string, number[]>();
  facts.forEach((fact, index) => {
    if (fact[3] === null) return;
    const key = partition(fact) ?? `fact:${index}`, group = groups.get(key);
    if (group) group.push(index); else groups.set(key, [index]);
  });
  for (const indices of groups.values()) {
    let missing = Math.round(indices.reduce((sum, index) => sum + facts[index]![3]!, 0)) - indices.reduce((sum, index) => sum + rounded[index]!, 0);
    const remainder = (index: number) => facts[index]![3]! - rounded[index]!;
    const id = (index: number) => entityId(facts[index]!);
    for (const index of [...indices].sort((a, b) => remainder(b) - remainder(a) || (id(a) < id(b) ? -1 : id(a) > id(b) ? 1 : 0))) {
      if (missing-- <= 0) break;
      rounded[index]! += 1;
    }
  }
  return facts.map((fact, index) => [fact[0], fact[1], fact[2], rounded[index]] as T);
}

/** National totals at the whole-dollar precision of the detail facts beside them; derived totals follow their rounded inputs. */
export function roundTradeTotalsToWholeDollars(facts: readonly ClientTradeOverviewFact[]): ClientTradeOverviewFact[] {
  const rounded = facts.map(fact => ({ ...fact, valueUsd: Math.round(fact.valueUsd) }));
  return deriveFromRoundedInputs(rounded, fact => [String(fact.year), fact.indicatorId, fact.valueUsd], (fact, valueUsd) => ({ ...fact, valueUsd }));
}

/** The formulas the workbooks state for derived amounts: [first input, second input, sign of the second]. */
const DERIVED_AMOUNTS: Partial<Record<TradeChartIndicator, readonly [TradeChartIndicator, TradeChartIndicator, 1 | -1]>> = {
  "trade.turnover": ["trade.exports", "trade.imports", 1], "trade.balance": ["trade.exports", "trade.imports", -1], "trade.reexports": ["trade.exports", "trade.domestic_exports", -1],
};
/**
 * Recomputes each derived amount from its rounded inputs of the same `key` (entity and year), so "turnover = exports +
 * imports" and the like hold to the dollar in a workbook. A derived amount whose inputs are not shipped beside it keeps
 * its own rounding.
 */
function deriveFromRoundedInputs<T>(items: readonly T[], read: (item: T) => [key: string, indicator: TradeChartIndicator, valueUsd: number | null], write: (item: T, valueUsd: number) => T): T[] {
  const amounts = new Map(items.map(item => { const [key, indicator, valueUsd] = read(item); return [`${key}:${indicator}`, valueUsd]; }));
  return items.map(item => {
    const [key, indicator, valueUsd] = read(item), formula = DERIVED_AMOUNTS[indicator];
    if (!formula || valueUsd === null) return item;
    const first = amounts.get(`${key}:${formula[0]}`), second = amounts.get(`${key}:${formula[1]}`);
    return typeof first === "number" && typeof second === "number" ? write(item, first + formula[2] * second) : item;
  });
}

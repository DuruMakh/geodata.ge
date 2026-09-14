import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { compare, type Comparison } from "../../lib/factQuery/compare";
import { rank, type RankData } from "../../lib/factQuery/rank";
import { queryMunicipal } from "../../lib/factQuery/queryMunicipal";
import { getSources } from "../../lib/factQuery/getSources";
import { CAVEAT_RULES } from "../../lib/factQuery/caveats";
import { serviceMessage } from "../../lib/factQuery/localization";
import type { FactQueryResponse, FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;
beforeAll(async () => { snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-05T00:00:00Z" }); });

function comparisons(response: FactQueryResponse): Comparison[] {
  if (response.kind !== "comparisons") throw Error(`Expected comparisons, got ${response.kind}`);
  return (response.data as { comparisons: Comparison[] }).comparisons;
}
function ranking(response: FactQueryResponse): RankData {
  if (response.kind !== "ranking") throw Error(`Expected ranking, got ${response.kind}`);
  return response.data as RankData;
}
function withoutEnglish(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (key, item) => key.endsWith("En") ? undefined : item));
}

describe("bilingual comparisons and evidence", () => {
  it.each([
    { target: { dataset: "national", side: "expenditure", seriesIds: ["spending.education"] }, fromYear: 2020, toYear: 2024, measure: "amount_gel" },
    { target: { dataset: "national", side: "revenue", seriesIds: ["revenue.total"] }, fromYear: 2004, toYear: 2005, measure: "amount_gel" },
    { target: { dataset: "municipal", entityIds: ["11"], seriesIds: ["municipal.total"] }, fromYear: 2024, toYear: 2025, measure: "amount_gel" },
    { target: { dataset: "municipal", entityIds: ["11"], seriesIds: ["municipal.total"] }, fromYear: 2015, toYear: 2025, measure: "amount_gel" },
    { target: { dataset: "ministries", level: "major_program", seriesIds: ["admin_program.24_14.6c3a02c8"] }, fromYear: 2014, toYear: 2024, measure: "amount_gel" },
    { target: { dataset: "debt", seriesIds: ["debt.rate.total"] }, fromYear: 2023, toYear: 2024, measure: "rate_percent" },
    { target: { dataset: "debt", seriesIds: ["debt.rate.domestic"] }, fromYear: 2024, toYear: 2025, measure: "rate_percent" },
  ])("keeps numerical decisions independent of English text: $target.dataset $fromYear–$toYear", input => {
    const original = compare(snapshot, input);
    const changed = structuredClone(snapshot);
    for (const id of Object.keys(changed.localization.labelsEn)) changed.localization.labelsEn[id] += " (reviewed)";
    for (const key of Object.keys(changed.localization.messages.en)) changed.localization.messages.en[key] += " [English review]";
    const translated = compare(changed, input);
    expect(withoutEnglish(translated)).toEqual(withoutEnglish(original));
    for (const row of comparisons(original)) {
      expect(row.entityLabelEn.trim()).not.toBe("");
      expect(row.seriesLabelEn.trim()).not.toBe("");
      expect(row.reasonsEn).toHaveLength(row.reasons.length);
      expect(row.reasonsEn.join(" ")).not.toMatch(/\p{Script=Georgian}/u);
      for (const endpoint of [row.from, row.to]) {
        expect(endpoint.valueDefinitionEn.trim()).not.toBe("");
        expect(endpoint.missingReasonEn === null).toBe(endpoint.missingReason === null);
        expect(`${endpoint.valueDefinitionEn} ${endpoint.missingReasonEn ?? ""}`).not.toMatch(/\p{Script=Georgian}/u);
      }
    }
  });

  it("resolves emitted caveat text from the snapshot and preserves a public English explanation", () => {
    const changed = structuredClone(snapshot);
    changed.localization.messages.en["caveats.adjara_consolidation_applied"] = "The reviewed net republican amount is included once.";
    const response = queryMunicipal(changed, { entityIds: ["region.adjara"], seriesIds: ["municipal.total"], years: [2025], measure: "amount_gel" });
    const caveat = response.meta.caveats.find(item => item.code === "adjara_consolidation_applied")!;
    expect(caveat.messageEn).toBe(changed.localization.messages.en["caveats.adjara_consolidation_applied"]);
    expect(caveat.methodologyRefEn).toBe("/en/methodology/municipalities");
    expect(caveat.methodologyRef).toBe("municipal-functional-annual-2015-2025.md");
  });

  it("retains every bilingual source field through narrowing and document defaults", () => {
    const response = queryMunicipal(snapshot, { entityIds: ["region.adjara"], seriesIds: ["municipal.total"], years: [2025], measure: "amount_gel" });
    expect(response.meta.sources.length).toBeGreaterThan(0);
    for (const source of response.meta.sources) {
      const original = snapshot.sources.find(item => item.sourceId === source.sourceId)!;
      expect(source.nameKa).toBe(original.nameKa);
      expect(source.nameEn).toBe(original.nameEn);
      expect(source.derivationEn).toBe(original.derivationEn);
      for (const document of source.documents) {
        const { sha256: _hash, byteSize: _size, ...expected } = original.documents.find(item => item.documentId === document.documentId)!;
        expect({ ...source.documentDefaults, ...document }).toEqual(expected);
      }
    }
    const sources = getSources(snapshot, { sourceIds: response.meta.sources.map(source => source.sourceId) });
    if (sources.kind !== "sources") throw Error("Expected source evidence");
    const rows = (sources.data as { sources: Array<{ sourceId: string; documents: unknown[] }> }).sources;
    for (const row of rows) expect(row.documents).toEqual(snapshot.sources.find(source => source.sourceId === row.sourceId)!.documents);
  });

  it("uses snapshot-owned source errors and declares English references for every caveat", () => {
    const changed = structuredClone(snapshot);
    changed.localization.messages.en["errors.unknownSource"] = "Unrecognised source: {unknownIds}.";
    const response = getSources(changed, { sourceIds: ["unknown-source"] });
    if (response.kind !== "error") throw Error("Expected unknown source");
    expect(response.error.messageEn).toBe("Unrecognised source: unknown-source.");
    for (const rule of CAVEAT_RULES) {
      expect(serviceMessage(snapshot, "en", rule.messageKey).trim()).not.toBe("");
      expect(rule.methodologyRefEn).toMatch(/^\/en\/(methodology\/(expenditure|revenue|municipalities|debt|gdp|economic-sectors|inflation)|explorer\/deficit)$/);
    }
  });
});

describe("bilingual rankings", () => {
  it("keeps declined municipalities grouped with aligned English explanations", () => {
    const request = { datasetId: "municipal-expenditure", dimension: "entities", entityType: "municipality", seriesId: "municipal.total", fromYear: 2024, toYear: 2025, measure: "amount_gel", metric: "percentage_change", limit: 100 };
    const original = rank(snapshot, request);
    const changed = structuredClone(snapshot);
    for (const id of Object.keys(changed.localization.labelsEn)) changed.localization.labelsEn[id] += " reviewed";
    expect(withoutEnglish(rank(changed, request))).toEqual(withoutEnglish(original));
    const result = ranking(original);
    expect(result.universe.descriptionEn).toContain("municipalities");
    expect(result.rankingDefinitionEn.trim()).not.toBe("");
    expect(result.exclusions.some(group => group.ids.includes("11"))).toBe(true);
    for (const group of result.exclusions) expect(group.reasonEn.trim()).not.toBe("");
    for (const entry of result.entries) expect(`${entry.entityLabelEn} ${entry.seriesLabelEn}`).not.toMatch(/\p{Script=Georgian}/u);
  });

  it("preserves the stable tie cutoff and translates the returned boundary entry", () => {
    const changed = structuredClone(snapshot);
    for (const fact of changed.national.facts) if (fact.year === 2025 && ["revenue.vat", "revenue.income_tax"].includes(fact.itemId)) fact.amountGel = 1e15;
    const result = ranking(rank(changed, { datasetId: "national-revenue", dimension: "series", year: 2025, measure: "amount_gel", metric: "value", order: "descending", limit: 1 }));
    expect(result.entries).toHaveLength(1);
    expect(result.universe.cutoffSplitsTie).toBe(true);
    expect(result.entries[0].tied).toBe(true);
    expect(result.entries[0].seriesId).toBe("revenue.income_tax");
    expect(result.entries[0].seriesLabelEn).toBe(snapshot.localization.labelsEn["revenue.income_tax"]);
  });
});

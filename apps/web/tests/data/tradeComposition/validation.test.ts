import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { buildTradeCompositionData } from "../../../lib/data/tradeComposition/prepareTradeComposition";
import { validateTradeCompositionData } from "../../../lib/data/tradeComposition/validation";

describe("composition canonical validation", () => {
  let result: Awaited<ReturnType<typeof buildTradeCompositionData>>, labels: Record<string, string>;
  beforeAll(async () => { result = await buildTradeCompositionData(path.resolve(process.cwd(), "../..")); labels = Object.fromEntries(result.data.entities.map(e => [e.id, e.labelEn])); }, 60_000);
  it("accepts the complete reviewed subset and ignores unrelated English labels", () => { expect(() => validateTradeCompositionData(result.data, result.report, { ...labels, unrelated: "Unrelated" })).not.toThrow(); });
  it.each(["entityId", "year", "indicatorId", "valueUsd", "unit", "basis", "valueStatus", "publicationStatus", "role", "sourceId", "sourceRefs", "sourceValue", "sourceUnit", "sourceLabel", "sourceNumberFormat", "sourceBlock", "lastReviewedAt"]) ("rejects changed fact field %s", field => {
    const data = structuredClone(result.data); Object.assign(data.facts[0], { [field]: field === "year" ? 1999 : "changed" });
    expect(() => validateTradeCompositionData(data, result.report, labels)).toThrow();
  });
  it.each(["id", "classification", "sourceCode", "labelKa", "labelEn"]) ("rejects changed catalogue field %s", field => {
    const data = structuredClone(result.data); Object.assign(data.entities[0], { [field]: "changed" }); expect(() => validateTradeCompositionData(data, result.report, labels)).toThrow();
  });
  it("rejects missing/duplicate facts, altered counts, holds and fingerprints", () => {
    for (const facts of [result.data.facts.slice(1), [...result.data.facts, result.data.facts[0]]]) expect(() => validateTradeCompositionData({ ...result.data, facts }, result.report, labels)).toThrow();
    const report = structuredClone(result.report); report.outsideScopeHolds[0].evidence = "changed"; expect(() => validateTradeCompositionData(result.data, report, labels)).toThrow();
    expect(() => validateTradeCompositionData(result.data, { ...result.report, controlObservations: 105 }, labels)).toThrow();
    const missing = structuredClone(result.report); delete missing.inputSha256[Object.keys(missing.inputSha256)[0]]; expect(() => validateTradeCompositionData(result.data, missing, labels)).toThrow();
  });
});

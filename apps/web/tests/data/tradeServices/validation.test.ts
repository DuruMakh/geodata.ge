import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { buildTradeServicesData } from "../../../lib/data/tradeServices/prepareTradeServices";
import { assertTradeServicesParity, loadTradeServicesData } from "../../../lib/data/tradeServices/importTradeServices";
import { validateTradeServicesData } from "../../../lib/data/tradeServices/validation";

describe("services canonical validation and loading", () => {
  let result: Awaited<ReturnType<typeof buildTradeServicesData>>, labels: Record<string, string>;
  beforeAll(async () => { result = await buildTradeServicesData(path.resolve(process.cwd(), "../..")); labels = Object.fromEntries(result.data.entities.map(e => [e.id, e.labelEn])); }, 60_000);
  it("accepts the complete verified catalogue and facts", () => { expect(() => validateTradeServicesData(result.data, result.report, labels)).not.toThrow(); });
  it.each(["entityId", "year", "indicatorId", "valueUsd", "unit", "basis", "valueStatus", "publicationStatus", "role", "sourceId", "sourceRefs", "sourceValue", "sourceUnit", "sourceLabel", "sourceNumberFormat", "sourceBlock", "lastReviewedAt"])("rejects changed fact field %s and mirror parity", field => {
    const changed = structuredClone(result.data);
    Object.assign(changed.facts[0], { [field]: field === "year" ? 2019 : "changed" });
    expect(() => validateTradeServicesData(changed, result.report, labels)).toThrow();
    expect(() => assertTradeServicesParity(result.data, changed)).toThrow();
  });
  it.each(["id", "kind", "labelKa", "labelEn"])("rejects changed catalogue field %s and mirror parity", field => {
    const changed = structuredClone(result.data); Object.assign(changed.entities[0], { [field]: "changed" });
    expect(() => validateTradeServicesData(changed, result.report, labels)).toThrow();
    expect(() => assertTradeServicesParity(result.data, changed)).toThrow();
  });
  it("rejects omitted, duplicate and invented facts, changed labels and acceptance counts", () => {
    for (const facts of [result.data.facts.slice(1), [...result.data.facts, result.data.facts[0]], [...result.data.facts, { ...result.data.facts[0], entityId: "goods.total" }]]) expect(() => validateTradeServicesData({ ...result.data, facts }, result.report, labels)).toThrow();
    expect(() => validateTradeServicesData(result.data, result.report, { ...labels, "services.total": "Goods total" })).toThrow();
    expect(() => validateTradeServicesData(result.data, { ...result.report, derivedObservations: 130 }, labels)).toThrow();
  });
  it("allows mirror decimal padding and order changes while preserving null and all native fields", () => {
    const mirror = structuredClone(result.data); mirror.entities.reverse(); mirror.facts.reverse();
    for (const fact of mirror.facts) if (fact.valueUsd !== null) fact.valueUsd = `${fact.valueUsd}${fact.valueUsd.includes(".") ? "0" : ".0"}`;
    expect(() => assertTradeServicesParity(result.data, mirror)).not.toThrow();
    const missing = mirror.facts.find(f => f.valueUsd === null)!; missing.valueUsd = "0";
    expect(() => assertTradeServicesParity(result.data, mirror)).toThrow();
  });
  it("rejects identity-swapped or reordered derivation references even with unchanged amounts", () => {
    for (const mutation of ["identity", "order"]) {
      const changed = structuredClone(result.data), fact = changed.facts.find(f => f.role === "derived" && f.entityId === "services.total")!;
      const refs = JSON.parse(fact.sourceRefs) as string[][];
      if (mutation === "identity") refs[0][2] = refs[0][2].replace("5", "10");
      else refs.reverse();
      fact.sourceRefs = JSON.stringify(refs);
      expect(() => validateTradeServicesData(changed, result.report, labels)).toThrow(/counterparts\/source/i);
    }
  });
  it("binds the hold evidence and complete input fingerprint inventory, and scopes English labels", () => {
    const report = structuredClone(result.report); report.outsideScopeHolds[0].evidence = "changed";
    expect(() => validateTradeServicesData(result.data, report, labels)).toThrow(/hold fingerprint/i);
    const missing = structuredClone(result.report); delete missing.inputSha256[Object.keys(missing.inputSha256)[0]];
    expect(() => validateTradeServicesData(result.data, missing, labels)).toThrow(/fingerprints missing/i);
    expect(() => validateTradeServicesData(result.data, result.report, { ...labels, "unrelated.new-label": "Unrelated new label" })).not.toThrow();
    expect(result.data.facts.some(f => f.valueUsd?.startsWith("-"))).toBe(true);
  });
  it("distinguishes numerical zero from unavailable amounts in parity", () => {
    const fact = { ...result.data.facts[0], valueUsd: "0" }, zero = { entities: result.data.entities, facts: [fact] };
    expect(() => assertTradeServicesParity(zero, { ...zero, facts: [{ ...fact, valueUsd: "0.0000" }] })).not.toThrow();
    expect(() => assertTradeServicesParity(zero, { ...zero, facts: [{ ...fact, valueUsd: null }] })).toThrow();
  });
  it("loads exactly the accepted canonical files without raw workbook dependencies", async () => {
    const loaded = await loadTradeServicesData();
    expect(loaded).toEqual(result.data);
  });
});

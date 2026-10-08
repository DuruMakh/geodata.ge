import { beforeAll, expect, test } from "vitest";
import { loadUnemploymentFacts } from "../../../lib/data/unemployment/importUnemployment";
import { assertCompleteUnemploymentCoverage, validateUnemploymentFacts } from "../../../lib/data/unemployment/validation";
import type { UnemploymentObservation } from "../../../lib/data/unemployment/types";

let facts: UnemploymentObservation[];
beforeAll(async () => { facts = await loadUnemploymentFacts(); });

test("serves all 3370 primary observations with official final-year headline precision", () => {
  expect(facts.filter(f => f.dimension === "education")).toHaveLength(216);
  expect(facts.filter(f => f.dimension === "long_term")).toHaveLength(54);
  expect(facts).toHaveLength(3370);
  expect(facts.filter(f => !["education", "long_term"].includes(f.dimension))).toHaveLength(3100);
  const national = facts.filter(f => f.dimension === "national" && f.year === 2025);
  expect(national.find(f => f.indicatorId === "unemployment_rate")?.publishedValue).toBe("13.9");
  expect(national.find(f => f.indicatorId === "unemployed")?.publishedValue).toBe("224.0");
  expect(facts.filter(f => f.dimension === "education" && (f.unit !== "percent" || f.groupId === "education.no_education"))).toEqual([]);
});

test("regional employment status covers all eleven modern regions only in 2020–2025", () => {
  const status = facts.filter(f => f.dimension === "region" && ["hired", "self_employed"].includes(f.indicatorId));
  expect(status).toHaveLength(132);
  expect(new Set(status.map(f => f.groupId))).toHaveLength(11);
  expect(status.every(f => f.role === "primary" && f.groupId.startsWith("region.") && f.sourceId === "geostat_lfs_annual_region")).toBe(true);
  for (const groupId of new Set(status.map(f => f.groupId))) for (const indicatorId of ["hired", "self_employed"]) {
    expect(status.filter(f => f.groupId === groupId && f.indicatorId === indicatorId).map(f => f.year).sort()).toEqual([2020, 2021, 2022, 2023, 2024, 2025]);
  }
  expect(status.find(f => f.groupId === "region.tbilisi" && f.year === 2025 && f.indicatorId === "hired")).toMatchObject({ value: "361.23065568749558", publishedValue: "361.2", sourceSheet: "1", sourceCell: "C286" });
  expect(status.find(f => f.groupId === "region.tbilisi" && f.year === 2025 && f.indicatorId === "self_employed")).toMatchObject({ value: "78.29143011189538", publishedValue: "78.3", sourceSheet: "1", sourceCell: "C287" });
});

test("regional employment-status coverage rejects a missing child or invented earlier year", () => {
  const child = facts.find(f => f.dimension === "region" && f.groupId === "region.tbilisi" && f.year === 2020 && f.indicatorId === "hired")!;
  expect(child).toBeDefined();
  expect(() => assertCompleteUnemploymentCoverage(facts.filter(f => f !== child))).toThrow(/coverage/i);
  expect(() => assertCompleteUnemploymentCoverage([...facts, { ...child, year: 2019 }])).toThrow(/coverage/i);
});

test("regional employment-status sums must reconcile with the corresponding national categories", () => {
  const child = facts.find(f => f.dimension === "region" && f.groupId === "region.tbilisi" && f.year === 2025 && f.indicatorId === "hired")!;
  expect(child).toBeDefined();
  const changed = facts.map(f => f === child ? { ...f, value: "361.33065568749558", publishedValue: "361.3" } : f);
  expect(() => validateUnemploymentFacts(changed)).toThrow(/region employment status sum/i);
});

test("rejects a missing entire historical group-year instead of inferring shorter coverage", () => {
  const missing = facts.filter(f => !(f.groupId === "age.15_24" && f.year === 2014));
  expect(() => assertCompleteUnemploymentCoverage(missing)).toThrow(/coverage/i);
});

test("rejects duplicate observation identities", () => {
  expect(() => validateUnemploymentFacts([...facts, facts[0]])).toThrow(/duplicate/i);
});

test("rejects exchanged long-term percentages with different denominators", () => {
  const rate = facts.find(f => f.dimension === "long_term" && f.groupId === "georgia" && f.year === 2025 && f.indicatorId === "long_term_unemployment_rate")!;
  const share = facts.find(f => f.dimension === "long_term" && f.groupId === "georgia" && f.year === 2025 && f.indicatorId === "long_term_unemployed_share")!;
  const changed = facts.map(f => f === rate ? { ...f, value: share.value, publishedValue: share.publishedValue } : f === share ? { ...f, value: rate.value, publishedValue: rate.publishedValue } : f);
  expect(() => validateUnemploymentFacts(changed)).toThrow(/long.term.*denominator/i);
});

test("rejects a count that no longer reconciles with its matching labour force", () => {
  const changed = facts.map(f => f.dimension === "national" && f.year === 2025 && f.indicatorId === "unemployed" ? { ...f, value: "225", publishedValue: "225.0" } : f);
  expect(() => validateUnemploymentFacts(changed)).toThrow(/identity|rate/i);
});

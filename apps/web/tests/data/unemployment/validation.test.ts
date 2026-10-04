import { beforeAll, expect, test } from "vitest";
import { loadUnemploymentFacts } from "../../../lib/data/unemployment/importUnemployment";
import { assertCompleteUnemploymentCoverage, validateUnemploymentFacts } from "../../../lib/data/unemployment/validation";
import type { UnemploymentObservation } from "../../../lib/data/unemployment/types";

let facts: UnemploymentObservation[];
beforeAll(async () => { facts = await loadUnemploymentFacts(); });

test("serves all 3142 primary observations with official final-year headline precision", () => {
  expect(facts.filter(f => f.dimension === "education")).toHaveLength(216);
  expect(facts.filter(f => f.dimension === "long_term")).toHaveLength(54);
  expect(facts.filter(f => !["education", "long_term"].includes(f.dimension))).toHaveLength(2872);
  const national = facts.filter(f => f.dimension === "national" && f.year === 2025);
  expect(national.find(f => f.indicatorId === "unemployment_rate")?.publishedValue).toBe("13.9");
  expect(national.find(f => f.indicatorId === "unemployed")?.publishedValue).toBe("224.0");
  expect(facts.filter(f => f.dimension === "education" && (f.unit !== "percent" || f.groupId === "education.no_education"))).toEqual([]);
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

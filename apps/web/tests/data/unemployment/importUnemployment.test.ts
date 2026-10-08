import { beforeAll, expect, test } from "vitest";
import { assertUnemploymentParity, loadUnemploymentFacts } from "../../../lib/data/unemployment/importUnemployment";
import type { UnemploymentObservation } from "../../../lib/data/unemployment/types";

let facts: UnemploymentObservation[];
beforeAll(async () => { facts = await loadUnemploymentFacts(); });
test("mirror equality is order independent and retains exact decimal strings", () => {
  expect(() => assertUnemploymentParity(facts, [...facts].reverse())).not.toThrow();
});
test.each(["value", "sourceCell", "sourceId", "sourceLabel", "lastReviewedAt"] as const)("rejects changed mirror field %s", field => {
  const changed = facts.map((f, i) => i === 0 ? { ...f, [field]: field === "value" ? String(Number(f.value) + 0.0000001) : "changed" } : f);
  expect(() => assertUnemploymentParity(facts, changed)).toThrow();
});
test("rejects missing mirror observations", () => {
  expect(() => assertUnemploymentParity(facts, facts.slice(1))).toThrow();
});

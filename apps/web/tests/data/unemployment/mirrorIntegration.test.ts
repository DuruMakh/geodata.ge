import Decimal from "decimal.js";
import { expect, test } from "vitest";
import { assertUnemploymentParity, loadUnemploymentFacts } from "../../../lib/data/unemployment/importUnemployment";
import { loadUnemploymentFactsFromMirror, unemploymentMirrorCreateRows, type MirrorClient } from "../../../lib/db/mirrorRows";
import { unemploymentObservationKey } from "../../../lib/data/unemployment/types";

test("import mapping round-trips all natural keys and refuses a lost row before transaction commit", async () => {
  const facts = await loadUnemploymentFacts();
  const rows = unemploymentMirrorCreateRows(facts, "run-1").map(row => ({ ...row, value: new Decimal(row.value as string), publishedValue: new Decimal(row.publishedValue as string) }));
  const client = { unemploymentFact: { findMany: async () => rows } } as unknown as MirrorClient;
  const mirror = await loadUnemploymentFactsFromMirror(client);
  expect(new Set(mirror.map(unemploymentObservationKey)).size).toBe(3142);
  expect(() => assertUnemploymentParity(facts, mirror)).not.toThrow();
  rows.pop();
  const incomplete = await loadUnemploymentFactsFromMirror(client);
  expect(() => assertUnemploymentParity(facts, incomplete)).toThrow(/missing unemployment indicator/i);
});

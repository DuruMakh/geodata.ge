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
  expect(new Set(mirror.map(unemploymentObservationKey)).size).toBe(3370);
  expect(mirror.find(f => f.groupId === "region.tbilisi" && f.year === 2025 && f.indicatorId === "hired")).toMatchObject({ value: "361.23065568749558", sourceCell: "C286" });
  expect(() => assertUnemploymentParity(facts, mirror)).not.toThrow();
  rows.pop();
  const incomplete = await loadUnemploymentFactsFromMirror(client);
  expect(() => assertUnemploymentParity(facts, incomplete)).toThrow(/missing unemployment indicator/i);
});

test("a sub-tenth published-value change is refused before mirror parity can accept it", async () => {
  const facts = await loadUnemploymentFacts();
  const rows = unemploymentMirrorCreateRows(facts, "run-1").map(row => ({ ...row, value: new Decimal(row.value as string), publishedValue: new Decimal(row.publishedValue as string) }));
  rows[0].publishedValue = rows[0].publishedValue.plus("0.01");
  const client = { unemploymentFact: { findMany: async () => rows } } as unknown as MirrorClient;
  await expect(loadUnemploymentFactsFromMirror(client).then(mirror => assertUnemploymentParity(facts, mirror))).rejects.toThrow(/published precision/i);
});

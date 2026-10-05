import Decimal from "decimal.js";
import { beforeAll, expect, test } from "vitest";
import { loadUnemploymentFacts } from "../../../lib/data/unemployment/importUnemployment";
import { loadUnemploymentFactsFromMirror, unemploymentMirrorCreateRows, type MirrorClient } from "../../../lib/db/mirrorRows";
import type { UnemploymentObservation } from "../../../lib/data/unemployment/types";

let facts: UnemploymentObservation[];
beforeAll(async () => { facts = await loadUnemploymentFacts(); });
test("mirror mapping preserves every source field and source precision through decimal database values", async () => {
  const rows = unemploymentMirrorCreateRows(facts, "run-1").map(row => ({ ...row, value: new Decimal(row.value as string), publishedValue: new Decimal(row.publishedValue as string) }));
  const client = { unemploymentFact: { findMany: async () => rows } } as unknown as MirrorClient;
  expect(await loadUnemploymentFactsFromMirror(client)).toEqual(facts);
  expect(rows[0].sourceDocumentId).toBe(`source.${facts[0].sourceId}`);
  expect(rows[0].importRunId).toBe("run-1");
});
test("rejects a mirror row bound to a different registered source", async () => {
  const [row] = unemploymentMirrorCreateRows(facts, "run-1");
  const client = { unemploymentFact: { findMany: async () => [{ ...row, sourceDocumentId: "source.wrong", value: new Decimal(row.value as string), publishedValue: new Decimal(row.publishedValue as string) }] } } as unknown as MirrorClient;
  await expect(loadUnemploymentFactsFromMirror(client)).rejects.toThrow(/source relation/i);
});

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, expect, test } from "vitest";
import { Prisma } from "../../../lib/generated/prisma/client";
import { assertExpenditureTypesParity, loadExpenditureTypeFacts } from "../../../lib/data/expenditureTypes/importExpenditureTypes";
import { expenditureTypesMirrorCreateRows, loadExpenditureTypeFactsFromMirror } from "../../../lib/db/mirrorRows";

const temporary: string[] = [];
afterAll(async () => { await Promise.all(temporary.map(dir => rm(dir, { recursive: true, force: true }))); });

async function mutated(transform: (lines: string[]) => string[]): Promise<string> {
  const lines = (await readFile(path.resolve(process.cwd(), "../../data/imports/expenditure-types-annual.csv"), "utf8")).split("\n");
  const dir = await mkdtemp(path.join(tmpdir(), "expenditure-types-import-"));
  temporary.push(dir);
  await writeFile(path.join(dir, "facts.csv"), transform(lines).join("\n"), "utf8");
  return path.join(dir, "facts.csv");
}

test("loads all 480 canonical observations", async () => {
  expect(await loadExpenditureTypeFacts()).toHaveLength(480);
});

test("rejects a duplicate row, an unknown series, a missing year and a preliminary amount", async () => {
  await expect(loadExpenditureTypeFacts(await mutated(lines => [...lines.slice(0, -1), lines[1], ""]))).rejects.toThrow(/Duplicate/);
  await expect(loadExpenditureTypeFacts(await mutated(lines => lines.map(l => l.replace(/^spending_type\.grants,/, "spending_type.loans,"))))).rejects.toThrow(/Unknown/);
  await expect(loadExpenditureTypeFacts(await mutated(lines => lines.filter(l => !l.startsWith("spending_type.interest,2010,nominal,"))))).rejects.toThrow(/Incomplete/);
  await expect(loadExpenditureTypeFacts(await mutated(lines => lines.map(l => l.startsWith("spending_type.total,2025,nominal,") ? l.replace(",published,published,", ",published,preliminary,") : l)))).rejects.toThrow(/Invalid status/);
});

test("the mirror round trip keeps every field, and parity catches a changed value", async () => {
  const facts = await loadExpenditureTypeFacts();
  const rows = expenditureTypesMirrorCreateRows(facts, "run");
  const db = { expenditureTypeFact: { findMany: async () => rows.map(row => ({ ...row, value: new Prisma.Decimal(String(row.value)), lastReviewedAt: row.lastReviewedAt as Date })) } };
  const mirror = await loadExpenditureTypeFactsFromMirror(db as never);
  expect(() => assertExpenditureTypesParity(facts, mirror)).not.toThrow();
  const changed = mirror.map(f => f.seriesId === "spending_type.interest" && f.year === 2025 && f.measure === "nominal" ? { ...f, value: "1" } : f);
  expect(() => assertExpenditureTypesParity(facts, changed)).toThrow();
});

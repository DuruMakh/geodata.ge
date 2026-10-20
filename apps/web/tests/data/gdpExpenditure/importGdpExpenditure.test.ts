import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, expect, test } from "vitest";
import { Prisma } from "../../../lib/generated/prisma/client";
import { assertGdpExpenditureParity, loadGdpExpenditureFacts } from "../../../lib/data/gdpExpenditure/importGdpExpenditure";
import { gdpExpenditureMirrorCreateRows, loadGdpExpenditureFactsFromMirror } from "../../../lib/db/mirrorRows";

const temporary: string[] = [];
afterAll(async () => { await Promise.all(temporary.map(dir => rm(dir, { recursive: true, force: true }))); });

async function mutated(transform: (lines: string[]) => string[]): Promise<string> {
  const lines = (await readFile(path.resolve(process.cwd(), "../../data/imports/gdp-expenditure-annual.csv"), "utf8")).split("\n");
  const dir = await mkdtemp(path.join(tmpdir(), "gdp-expenditure-import-"));
  temporary.push(dir);
  await writeFile(path.join(dir, "facts.csv"), transform(lines).join("\n"), "utf8");
  return path.join(dir, "facts.csv");
}

test("loads all 722 canonical observations", async () => {
  expect(await loadGdpExpenditureFacts()).toHaveLength(722);
});

test("rejects a duplicate row, an unknown series, a missing newest year and an unpublished measure", async () => {
  await expect(loadGdpExpenditureFacts(await mutated(lines => [...lines.slice(0, -1), lines[1], ""]))).rejects.toThrow(/Duplicate/);
  await expect(loadGdpExpenditureFacts(await mutated(lines => lines.map(l => l.replace(/^gdp_use\.npish,/, "gdp_use.other,"))))).rejects.toThrow(/Unknown/);
  await expect(loadGdpExpenditureFacts(await mutated(lines => lines.filter(l => !l.startsWith("gdp_use.exports,2025,"))))).rejects.toThrow(/Incomplete/);
  await expect(loadGdpExpenditureFacts(await mutated(lines => lines.map(l => l.replace(/^gdp_use\.households_npish,(\d+),real_growth/, "gdp_use.households,$1,real_growth"))))).rejects.toThrow(/Unpublished measure|Duplicate/);
});

test("the mirror round trip keeps every field, and parity catches a changed value", async () => {
  const facts = await loadGdpExpenditureFacts();
  const rows = gdpExpenditureMirrorCreateRows(facts, "run");
  const db = { gdpExpenditureFact: { findMany: async () => rows.map(row => ({ ...row, value: new Prisma.Decimal(String(row.value)), lastReviewedAt: row.lastReviewedAt as Date })) } };
  const mirror = await loadGdpExpenditureFactsFromMirror(db as never);
  expect(() => assertGdpExpenditureParity(facts, mirror)).not.toThrow();
  const changed = mirror.map(f => f.seriesId === "gdp_use.imports" && f.year === 2025 && f.measure === "nominal" ? { ...f, value: "1" } : f);
  expect(() => assertGdpExpenditureParity(facts, changed)).toThrow();
});

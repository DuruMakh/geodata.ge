import { expect, test } from "vitest";
import { foreignInvestmentEntities, foreignInvestmentFacts } from "./fixtures";
const modulePath = "../../../lib/data/externalFlows/foreignInvestmentValidation";

test("accepts negative values and Geostat's not-applicable cells without inventing values", async () => {
  const { validateForeignInvestmentData } = await import(modulePath);
  expect(() => validateForeignInvestmentData({ entities: foreignInvestmentEntities(), facts: foreignInvestmentFacts() })).not.toThrow();
});

test.each(["not applicable becomes zero", "numeric without value", "duplicate", "unknown entity", "sector with country source", "sector before 2016", "year after 2025", "too many decimals", "label without Georgian"])("rejects %s", async change => {
  const { validateForeignInvestmentData } = await import(modulePath), facts = foreignInvestmentFacts(), entities = foreignInvestmentEntities();
  if (change === "not applicable becomes zero") facts.find(f => f.valueStatus === "not_applicable")!.valueUsd = "0";
  if (change === "numeric without value") facts[1].valueUsd = null;
  if (change === "duplicate") facts.push({ ...facts[0] });
  if (change === "unknown entity") facts[1].entityId = "fdi.country.m49_999";
  if (change === "sector with country source") facts.find(f => f.entityId === "fdi.sector.k")!.sourceId = "source.geostat_fdi_by_countries";
  if (change === "sector before 2016") facts.find(f => f.entityId === "fdi.sector.k")!.year = 2015;
  if (change === "year after 2025") facts[1].year = 2026;
  if (change === "too many decimals") facts[1].valueUsd = "1.000000000000000000001";
  if (change === "label without Georgian") entities[1].labelKa = "United Kingdom";
  expect(() => validateForeignInvestmentData({ entities, facts })).toThrow();
});

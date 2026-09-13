import { beforeAll, expect, test } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { queryEconomicSectors } from "../../lib/factQuery/queryEconomicSectors";
import type { FactQuerySnapshot } from "../../lib/factQuery/types";
import type { Observation } from "../../lib/factQuery/observations";
import { describeCoverage } from "../../lib/factQuery/describeCoverage";
let snapshot: FactQuerySnapshot;
beforeAll(async()=>{ snapshot=await buildFactQuerySnapshot({releaseCommit:"test",generatedAt:"2026-09-11T00:00:00Z"}); });

test("stale sector versions tell both languages to refresh coverage, not change valid parameters", () => {
  const result = queryEconomicSectors(snapshot, { seriesIds: ["sector.a"], years: [2025], measure: "amount_gel", expectedDataVersion: "0".repeat(64) });
  if (result.kind !== "error") throw new Error("Expected version error");
  expect(result.error.code).toBe("data_version_changed");
  expect(result.error.messageKa).toContain("ვერსია შეიცვალა");
  expect(result.error.messageKa).toContain("განაახლეთ");
  expect(result.error.messageEn).toContain("refresh coverage");
});
test("sector query preserves all three units and preliminary source references",()=>{
  for (const measure of ["amount_gel","share_of_gdp_pct","real_growth_pct"]) {
    const result=queryEconomicSectors(snapshot,{seriesIds:["sector.a","economy.gdp_total"],years:[2025],measure});
    expect(result.status).toBe("ok");
    if (result.kind !== "observations") throw new Error("Expected observations");
    const observations=(result.data as {observations:Observation[]}).observations;
    expect(observations).toHaveLength(2);
    expect(observations.every(o=>o.basis==="preliminary"&&o.sourceIds.length&&o.documentIds.length)).toBe(true);
    expect(observations[0].unit).toBe(measure==="amount_gel"?"GEL":"percent");
    expect(observations[0].value).toBe(measure==="amount_gel"?5419971597.482003:measure==="real_growth_pct"?-5.67461791842112:Number(snapshot.economicSectors.facts.find(f=>f.seriesId==="sector.a"&&f.year===2025&&f.measure==="share_of_gdp")!.value));
  }
});
test("2010 growth remains explicitly missing while nominal is available",()=>{
  expect(queryEconomicSectors(snapshot,{seriesIds:["sector.a"],years:[2010],measure:"real_growth_pct"}).status).toBe("empty");
  expect(queryEconomicSectors(snapshot,{seriesIds:["sector.a"],years:[2010],measure:"amount_gel"}).status).toBe("ok");
});
test("national reference definitions and coverage explain the accounting boundaries",()=>{
  const result=queryEconomicSectors(snapshot,{seriesIds:["economy.gdp_total"],years:[2025],measure:"share_of_gdp_pct"});
  if(result.kind!=="observations") throw new Error("Expected observations");
  const row=(result.data as {observations:Observation[]}).observations[0];
  expect(row.valueDefinitionEn).toContain("GDP / same-year GDP");
  const coverage=describeCoverage(snapshot,{datasetId:"economic-sectors"});
  if(coverage.kind!=="catalogue") throw new Error("Expected catalogue");
  expect(JSON.stringify(coverage.data)).toContain("basic prices");
  expect(JSON.stringify(coverage.data)).toContain("საბაზისო");
});
test.each([
  {seriesIds:["unknown"],years:[2025],measure:"amount_gel"},
  {seriesIds:["sector.a"],years:[2009],measure:"amount_gel"},
  {seriesIds:["sector.a"],years:[2025],measure:"share_of_total_pct"},
  {seriesIds:["sector.a"],years:[2025],measure:"amount_gel",expectedDataVersion:"0".repeat(64)},
])("rejects unsupported requests %j",input=>expect(queryEconomicSectors(snapshot,input).status).toBe("error"));

import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { describeCoverage, type CoverageData } from "../../lib/factQuery/describeCoverage";
import { queryNational } from "../../lib/factQuery/queryNational";
import { queryMinistries } from "../../lib/factQuery/queryMinistries";
import { queryMunicipal } from "../../lib/factQuery/queryMunicipal";
import { queryDebt } from "../../lib/factQuery/queryDebt";
import { queryDeficit } from "../../lib/factQuery/queryDeficit";
import { observationSchema } from "../../lib/factQuery/schemas";
import { outputSchemaFor } from "../../lib/mcp/outputSchema";
import type { Observation } from "../../lib/factQuery/observations";
import type { Coverage, FactQueryResponse, FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;
beforeAll(async () => { snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-06T00:00:00Z" }); });
const rows = (response: FactQueryResponse) => {
  if (response.kind !== "observations") throw new Error(`Expected observations, received ${response.kind}`);
  return response.data as { observations: Observation[]; coverage: Coverage };
};

const cases = [
  ["query_national", queryNational, { side: "expenditure", seriesIds: ["spending.education", "expenditure.total"], years: [2004, 2025], measure: "amount_gel" }],
  ["query_national", queryNational, { side: "revenue", seriesIds: ["revenue.increase_liabilities", "revenue.total"], years: [2004, 2025], measure: "amount_gel" }],
  ["query_ministries", queryMinistries, { level: "major_program", seriesIds: ["admin_program.09_01.f5bec61a"], years: [2006, 2025], measure: "share_of_total_pct" }],
  ["query_municipal", queryMunicipal, { entityIds: ["11", "region.adjara", "country.georgia", "05"], seriesIds: ["municipal.total"], years: [2015, 2025], measure: "gel_per_resident" }],
  ["query_debt", queryDebt, { seriesIds: ["debt.rate.domestic", "debt.rate.total"], years: [2015, 2025], measure: "rate_percent" }],
  ["query_deficit", queryDeficit, { years: [2024, 2030], measure: "amount_gel" }],
] as const;

describe("bilingual observation contract", () => {
  it.each(cases)("adds English to %s without changing IDs, numbers, missingness or source evidence", (tool, query, input) => {
    const response = query(snapshot, input);
    const { observations, coverage } = rows(response);
    expect(observations.length).toBeGreaterThan(0);
    for (const observation of observations) {
      expect(observation.entityLabelEn.trim()).not.toBe("");
      expect(observation.seriesLabelEn.trim()).not.toBe("");
      expect([observation.entityLabelEn, observation.seriesLabelEn, observation.valueDefinitionEn, observation.missingReasonEn ?? ""].join(" ")).not.toMatch(/\p{Script=Georgian}/u);
      expect(observation.availability === "missing").toBe(observation.missingReasonEn !== null);
      expect(observationSchema.parse(observation)).toEqual(observation);
    }
    for (const cell of coverage.missingCells) expect(cell.reasonEn.trim()).not.toBe("");
    for (const entity of coverage.excludedEntities) expect(entity.reasonEn.trim()).not.toBe("");
    expect(outputSchemaFor(tool).parse(response)).toMatchObject({ data: { observations } });

    const edited = structuredClone(snapshot);
    for (const id of Object.keys(edited.localization.labelsEn)) edited.localization.labelsEn[id] = `Reviewed ${id}`;
    for (const key of Object.keys(edited.localization.messages.en)) edited.localization.messages.en[key] += " English review.";
    const changed = rows(query(edited, input)).observations;
    const originalFields = (values: Observation[]) => values.map(({ entityLabelEn: _entity, seriesLabelEn: _series, valueDefinitionEn: _definition, missingReasonEn: _missing, ...original }) => original);
    expect(originalFields(changed)).toEqual(originalFields(observations));
  });
  it("keeps the education figure and the unavailable 2004 liabilities distinction", () => {
    const education = rows(queryNational(snapshot, cases[0][2])).observations.find(row => row.seriesId === "spending.education" && row.year === 2025)!;
    expect(education.seriesLabelKa).toBe("განათლება");
    expect(education.seriesLabelEn).toBe("Education");
    const liabilities = rows(queryNational(snapshot, cases[1][2])).observations.find(row => row.seriesId === "revenue.increase_liabilities" && row.year === 2004)!;
    expect(liabilities.value).toBeNull();
    expect(liabilities.missingReasonEn).toContain("does not mean zero");
  });
  it("publishes reviewed English catalogue names and searches them alongside Georgian", () => {
    const response = describeCoverage(snapshot, { search: "Education" });
    if (response.kind !== "catalogue") throw new Error("Expected catalogue");
    expect((response.data as CoverageData).series?.some(series => series.seriesId === "spending.education")).toBe(true);
    const overview = describeCoverage(snapshot, {});
    if (overview.kind !== "catalogue") throw new Error("Expected catalogue");
    for (const dataset of (overview.data as CoverageData).datasets) {
      expect(dataset.labelEn.trim()).not.toBe("");
      const result = describeCoverage(snapshot, { datasetId: dataset.datasetId });
      if (result.kind !== "catalogue") throw new Error("Expected catalogue");
      const data = result.data as CoverageData;
      for (const entry of [...(data.series ?? []), ...(data.entities ?? [])]) expect(entry.labelEn.trim()).not.toBe("");
      for (const exclusion of data.exclusions) expect(exclusion.reasonEn).not.toMatch(/\p{Script=Georgian}/u);
      expect(outputSchemaFor("describe_coverage").parse(result)).toMatchObject({ data });
    }
  });
  it("keeps the existing strict request shape with no language parameter", () => {
    expect(queryNational(snapshot, cases[0][2]).kind).toBe("observations");
    expect(queryNational(snapshot, { ...cases[0][2], language: "en" }).kind).toBe("error");
  });
  it("rejects an output missing its declared English definition", () => {
    const response = queryNational(snapshot, cases[0][2]);
    const observation = rows(response).observations[0];
    delete (observation as unknown as Record<string, unknown>).valueDefinitionEn;
    expect(outputSchemaFor("query_national").safeParse(response).success).toBe(false);
  });
});

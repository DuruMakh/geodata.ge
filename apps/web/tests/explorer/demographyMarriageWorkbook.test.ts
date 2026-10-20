import { beforeAll, describe, expect, it } from "vitest";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { SOURCE_ID } from "../../lib/data/demography/series";
import { defaultMarriageState, MARRIAGE_SERIES, marriageFactsForPlace, type MarriageState } from "../../lib/explorer/demographyMarriage";
import { buildMarriageWorkbookExportModel, type MarriageWorkbookInput } from "../../lib/explorer/demographyMarriageWorkbook";
import { getPresentation } from "../../lib/i18n/presentation.server";
import { loadPopulationSources } from "../../lib/pages/demography-population";

let input: MarriageWorkbookInput;
let presentation: Awaited<ReturnType<typeof getPresentation>>;
beforeAll(async () => {
  const [{ facts }, sources] = await Promise.all([loadServedDemographyData(), loadPopulationSources("en")]);
  presentation = await getPresentation("en", ["demography", "workbook"], []);
  input = {
    place: marriageFactsForPlace(facts, "country.georgia", MARRIAGE_SERIES.map((series) => series.id)),
    state: defaultMarriageState(),
    labels: Object.fromEntries(MARRIAGE_SERIES.map((series) => [series.id, `label ${series.id}`])),
    sources,
    siteOrigin: "https://fiscal.ge",
    title: "Marriages and divorces · Georgia",
    scope: "georgia",
  };
});

const build = (state: Partial<MarriageState>) => buildMarriageWorkbookExportModel({ ...input, state: { ...input.state, ...state } }, presentation);
const cited = (model: ReturnType<typeof build>) => input.sources.filter((source) => model.sources.some((entry) => entry.downloadHref === source.downloadHref)).map((source) => source.sourceId).sort();

describe("marriages and divorces workbook", () => {
  it("writes the published counts and cites only their two tables", () => {
    const model = build({});

    expect(model.filename).toContain("marriages-divorces-georgia-1994-2025");
    expect(model.readable.rows.map((row) => row.label)).toEqual(["label marriages", "label divorces"]);
    expect(model.readable.rows[0]!.valuesByYear[2025]).toBe(22_285);
    expect(model.readable.numberFormat).toBe("#,##0");
    expect(model.analysis.rows).toHaveLength(2 * 32);
    expect(model.analysis.rows.at(-1)).toEqual([2025, "label divorces", 13_173, "number", "Published"]);
    expect(cited(model)).toEqual([SOURCE_ID.divorces, SOURCE_ID.marriages].sort());
  });

  it("writes rates to one decimal, marks them calculated and cites the mid-year population too", () => {
    const model = build({ measure: "per1000" });

    expect(model.filename).toContain("marriages-divorces-georgia-per-1000-1994-2025");
    expect(model.readable.rows[0]!.valuesByYear[2025]).toBe(5.7);
    expect(model.readable.numberFormat).toBe("#,##0.0");
    expect(model.analysis.rows.at(-1)!.slice(2)).toEqual([3.3, "per 1,000 residents", "Calculated by Fiscal.ge"]);
    expect(cited(model)).toEqual([SOURCE_ID.divorces, SOURCE_ID.marriages, SOURCE_ID.midYear].sort());
  });

  it("marks the 2025 rate column with the census re-base, and leaves the count columns plain", () => {
    expect(build({ measure: "per1000" }).readable.headerLabels?.columns.at(-1)).toBe("2025 · Census re-base");
    expect(build({ measure: "per1000" }).readable.headerLabels?.columns.at(-2)).toBe("2024");
    expect(build({}).readable.headerLabels).toBeUndefined();
    expect(build({ measure: "per1000", selectedIds: ["age_first_marriage_male"] }).readable.headerLabels).toBeUndefined();
  });

  it("writes the ages as published and cites the ages table", () => {
    const model = build({ selectedIds: ["age_first_marriage_male", "age_first_marriage_female"] });

    expect(model.readable.rows[1]!.valuesByYear[2025]).toBe(30.1);
    expect(model.analysis.rows.at(-1)!.slice(2)).toEqual([30.1, "years", "Published"]);
    expect(cited(model)).toEqual([SOURCE_ID.meanAgeSpouses]);
  });
});

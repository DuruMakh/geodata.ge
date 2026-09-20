import { describe, expect, it } from "vitest";
import { loadGdpOverviewFacts } from "../../lib/data/gdpOverview/importGdpOverview";
import { loadEconomicSectorFacts } from "../../lib/data/economicSectors/importEconomicSectors";
import {
  projectGdpObservation,
  projectSectorObservation,
  sourceIdByMeasure,
  sourceIdBySeriesYear,
} from "../../lib/explorer/clientData";

const gdpRows = async () =>
  (await loadGdpOverviewFacts()).map((fact) => ({ ...fact, value: Number(fact.value) }));
const sectorRows = async () =>
  (await loadEconomicSectorFacts()).map((fact) => ({ ...fact, value: Number(fact.value) }));

describe("client projections", () => {
  it("keeps only the fields the browser reads", async () => {
    const [gdp, sectors] = await Promise.all([gdpRows(), sectorRows()]);

    expect(Object.keys(projectGdpObservation(gdp[0]!)).sort()).toEqual([
      "seriesId", "status", "value", "year",
    ]);
    expect(Object.keys(projectSectorObservation(sectors[0]!)).sort()).toEqual([
      "measure", "seriesId", "status", "value", "year",
    ]);
  });

  it("hoists one source id per GDP series and year, and one per sector measure", async () => {
    const [gdp, sectors] = await Promise.all([gdpRows(), sectorRows()]);

    const bySeriesYear = sourceIdBySeriesYear(gdp);
    for (const fact of gdp) expect(bySeriesYear[`${fact.seriesId}:${fact.year}`]).toBe(fact.sourceId);

    const byMeasure = sourceIdByMeasure(sectors);
    for (const fact of sectors) expect(byMeasure[fact.measure]).toBe(fact.sourceId);
  });

  it("keeps the year in the GDP key: one series cites two Geostat vintages", async () => {
    const gdp = await loadGdpOverviewFacts();
    const nominalGel = new Set(
      gdp.filter((fact) => fact.seriesId === "nominal_gel").map((fact) => fact.sourceId),
    );

    // Keying the map by seriesId alone would drop one of these from the
    // workbook's source list for every range that spans the SNA 2008 switch.
    expect([...nominalGel].sort()).toEqual([
      "source.geostat_national_gdp_sna_1993",
      "source.geostat_national_gdp_sna_2008",
    ]);
  });
});

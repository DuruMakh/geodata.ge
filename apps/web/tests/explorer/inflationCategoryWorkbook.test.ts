import { beforeAll, describe, expect, it } from "vitest";
import { makePeriod } from "../../lib/data/inflation/periods";
import { buildInflationCategoryWorkbookExportModel } from "../../lib/explorer/inflationCategoryWorkbook";
import type { InflationWorkbookSource } from "../../lib/explorer/inflationWorkbook";
import { getMessages } from "../../lib/i18n/messages.server";
import type { Presentation } from "../../lib/i18n/types";
import { fixtureHeadline, fixtureIndex, fixtureState } from "./fixtures/inflationCategories";

const period = makePeriod(2026, 8);
const source = (sourceId: string, language: "ka" | "en"): InflationWorkbookSource => ({
  sourceId,
  language,
  years: Array.from({ length: 27 }, (_, offset) => 2000 + offset),
  title: `${sourceId} ${language}`,
  organization: "Geostat",
  downloadHref: `/downloads/methodology/inflation/files/${language}/${sourceId}.xlsx`,
  retrievedAt: "2026-09-12",
});
const sources = ["source.geostat_cpi_yoy", "source.geostat_cpi_mom", "source.geostat_basket_weights"].flatMap((id) => [
  source(id, "ka"),
  source(id, "en"),
]);

let presentation: Presentation;
let contribInput: Parameters<typeof buildInflationCategoryWorkbookExportModel>[0];

beforeAll(async () => {
  presentation = { locale: "ka", messages: await getMessages("ka", ["inflation"]), englishLabels: {} };
  contribInput = {
    index: fixtureIndex(),
    state: fixtureState({ tab: "contrib" }),
    range: { min: period, max: period, start: period, end: period },
    headline: fixtureHeadline,
    presentation,
    sources,
    siteOrigin: "https://fiscal.ge",
  };
});

describe("buildInflationCategoryWorkbookExportModel", () => {
  it("includes the residual row on the contribution tab", () => {
    const model = buildInflationCategoryWorkbookExportModel(contribInput);
    expect(model.readable.rows.some((row) => row.parentLabel === "დანარჩენი")).toBe(true);
  });

  it("omits the residual on a rate tab", () => {
    const model = buildInflationCategoryWorkbookExportModel({
      ...contribInput,
      state: { ...contribInput.state, tab: "yoy" },
    });
    expect(model.readable.rows.some((row) => row.parentLabel === "დანარჩენი")).toBe(false);
  });

  it("carries the COICOP code, level and weight on the analysis sheet", () => {
    const model = buildInflationCategoryWorkbookExportModel(contribInput);
    expect(model.analysis.headers).toContain("COICOP კოდი");
    expect(model.analysis.rows[0]).toHaveLength(model.analysis.headers.length);
    // The basket share is a fraction under Excel's own percent format, so the
    // two have to agree: an 11.4% share is 0.114, never 0.00114 and never 11.4.
    const transport = model.analysis.rows.find((row) => row[3] === "07")!;
    expect(transport[5]).toBeCloseTo(0.114, 6);
    expect(model.analysis.numericFormats?.[6]).toBe("0.0%");
  });

  it("names the file after the tab and range", () => {
    const model = buildInflationCategoryWorkbookExportModel(contribInput);
    expect(model.filename).toMatch(/^fiscal-inflation-categories-contrib-\d{4}-\d{2}-\d{4}-\d{2}\.xlsx$/);
  });

  it("lists the weights source only when contributions are exported", () => {
    const contrib = buildInflationCategoryWorkbookExportModel(contribInput);
    const rates = buildInflationCategoryWorkbookExportModel({
      ...contribInput,
      state: { ...contribInput.state, tab: "yoy" },
    });
    // The fixture titles its sources "<sourceId> <language>".
    expect(contrib.sources.some((row) => row.title.startsWith("source.geostat_basket_weights"))).toBe(true);
    expect(rates.sources.some((row) => row.title.startsWith("source.geostat_basket_weights"))).toBe(false);
  });

  it("says on the sheet that contributions are a Fiscal.ge calculation", () => {
    const model = buildInflationCategoryWorkbookExportModel(contribInput);
    expect(model.readable.subtitle).toContain("Fiscal.ge");
  });

  it("exports contributions as percentage points and rates as percent", () => {
    // A contribution is percentage points: it must never leave as a fraction
    // under a % format, which would print 1.7 pp as "1.7%".
    const contrib = buildInflationCategoryWorkbookExportModel(contribInput);
    expect(contrib.readable.numberFormat).not.toContain("%");
    expect(contrib.analysis.numericFormats?.[7]).toBe("0.00");
    const transport = contrib.readable.rows.find((row) => row.parentLabel === "ტრანსპორტი")!;
    // 15.2% change at an 11.4% basket share is 1.7328 pp, stored unscaled.
    expect(transport.valuesByYear[8]).toBeCloseTo(1.7328, 4);

    const rates = buildInflationCategoryWorkbookExportModel({
      ...contribInput,
      state: { ...contribInput.state, tab: "yoy" },
    });
    expect(rates.readable.numberFormat).toBe("0.0%");
    const rateRow = rates.readable.rows.find((row) => row.parentLabel === "ტრანსპორტი")!;
    expect(rateRow.valuesByYear[8]).toBeCloseTo(0.152, 6);
  });
});

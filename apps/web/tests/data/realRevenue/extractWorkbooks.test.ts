import { describe, expect, it } from "vitest";
import { extractOfficialWorkbookRevenueRows, realRevenuePdfSources } from "../../../lib/data/realRevenue/extractWorkbooks";

describe("extractOfficialWorkbookRevenueRows", () => {
  it("skips missing optional workbook comparison sources", () => {
    expect(() => extractOfficialWorkbookRevenueRows()).not.toThrow();
  });

  it("uses the reviewed text sidecar for 2005 revenue extraction", () => {
    expect(realRevenuePdfSources.find((source) => source.year === 2005)?.textPath).toBe(
      "../../docs/Raw Data/Revenue/text/2005-jan-dec-consolidated-revenue.txt",
    );
  });
});

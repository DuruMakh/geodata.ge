import { describe, expect, it } from "vitest";
import { extractOfficialWorkbookRevenueRows } from "../../../lib/data/realRevenue/extractWorkbooks";

describe("extractOfficialWorkbookRevenueRows", () => {
  it("skips missing optional workbook comparison sources", () => {
    expect(() => extractOfficialWorkbookRevenueRows()).not.toThrow();
  });
});
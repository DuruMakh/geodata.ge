import { describe, expect, it } from "vitest";
import { coverageLabel } from "../../lib/explorer/coverageLabel";
import { getMessages } from "../../lib/i18n/messages.server";

describe("coverageLabel", () => {
  it("formats every route's header the same way", async () => {
    const ka = await getMessages("ka", ["common"]);
    const en = await getMessages("en", ["common"]);
    expect(coverageLabel(ka, "ka", 2004, 2025, "2026-10-04")).toBe("2004–2025 · განახლდა 2026-10-04");
    expect(coverageLabel(en, "en", 2004, 2025, "2026-10-04")).toBe("2004–2025 · Updated 4 October 2026");
    // Month ranges use the same unspaced dash as year ranges.
    expect(coverageLabel(ka, "ka", "იან 2016", "აგვ 2026", "2026-09-13")).toBe("იან 2016–აგვ 2026 · განახლდა 2026-09-13");
  });

  it("drops a missing half instead of printing a guess", async () => {
    const ka = await getMessages("ka", ["common"]);
    expect(coverageLabel(ka, "ka", 2010, 2025)).toBe("2010–2025");
    expect(coverageLabel(ka, "ka", undefined, undefined, "2026-10-04")).toBe("განახლდა 2026-10-04");
    expect(coverageLabel(ka, "ka", 2025, 2025, "2026-10-04")).toBe("2025 · განახლდა 2026-10-04");
  });
});

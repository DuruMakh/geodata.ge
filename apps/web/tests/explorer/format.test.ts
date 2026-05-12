import { describe, expect, it } from "vitest";
import { formatGel, formatPercent, formatSignedPercent } from "../../lib/explorer/format";

describe("explorer formatters", () => {
  it("formats GEL values compactly", () => {
    expect(formatGel(22_500_000_000)).toBe("22.5B GEL");
    expect(formatGel(4_500_000)).toBe("4.5M GEL");
  });

  it("formats nullable percent values", () => {
    expect(formatPercent(0.183)).toBe("18.3%");
    expect(formatPercent(null)).toBe("n/a");
  });

  it("formats signed percent values", () => {
    expect(formatSignedPercent(0.12)).toBe("+12.0%");
    expect(formatSignedPercent(-0.04)).toBe("-4.0%");
    expect(formatSignedPercent(null)).toBe("n/a");
  });
});

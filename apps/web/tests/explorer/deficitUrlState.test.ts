import { describe, expect, it } from "vitest";
import { parseDeficitHash, serializeDeficitHash } from "../../lib/explorer/deficitUrlState";

describe("General-government deficit URL state", () => {
  it("serializes the shared explorer keys", () => {
    expect(serializeDeficitHash({
      chartMode: "table",
      percentage: false,
      rangeStart: 2001,
      rangeEnd: 2026,
      selected: true,
    })).toBe("m=table&sh=0&r=2001-2026&sel=deficit.general_government_balance");
  });

  it("parses valid state and preserves a deliberate clear", () => {
    expect(parseDeficitHash("#m=line&sh=1&r=1995-2031&sel=")).toEqual({
      chartMode: "line",
      percentage: true,
      range: { start: 1995, end: 2031 },
      selected: false,
    });
  });

  it("ignores unknown and malformed values", () => {
    expect(parseDeficitHash("#m=bars&sh=other&r=bad&sel=unknown")).toEqual({});
    expect(parseDeficitHash("#%%%" )).toEqual({});
  });
});

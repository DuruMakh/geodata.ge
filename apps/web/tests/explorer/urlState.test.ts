import { describe, expect, it } from "vitest";
import { parseExplorerHash, readLegacyNav, serializeExplorerHash, stripNavFromHash } from "../../lib/explorer/urlState";

describe("serializeExplorerHash", () => {
  it("never emits nav — the route owns it", () => {
    const hash = serializeExplorerHash({
      nav: "revenue",
      grouping: "fields",
      chartMode: "table",
      share: true,
      rangeStart: 2010,
      rangeEnd: 2020,
      selectedIds: ["revenue.vat"],
      analysisSide: "expenditure",
      analysisGrouping: "fields",
      analysisYear: null,
    });

    expect(hash).not.toContain("nav=");
    expect(hash).toContain("m=table");
    expect(hash).toContain("sh=1");
    expect(hash).toContain("r=2010-2020");
    expect(hash).toContain("sel=revenue.vat");
  });
});

describe("parseExplorerHash", () => {
  it("scopes the range and selection by the nav it is given", () => {
    const state = parseExplorerHash("#m=table&r=2010-2020&sel=revenue.vat", "revenue");

    expect(state.range).toEqual({ scope: "revenue", start: 2010, end: 2020 });
    expect(state.selection).toEqual({ scope: "revenue", ids: ["revenue.vat"] });
  });

  it("uses the ministries scope when the hash carries that grouping", () => {
    const state = parseExplorerHash("#g=ministries&sel=admin_spending.defence", "expenditure");

    expect(state.selection?.scope).toBe("ministries");
  });

  it("ignores a nav left over in the hash", () => {
    const state = parseExplorerHash("#nav=revenue&sel=spending.health", "expenditure");

    expect(state.selection?.scope).toBe("fields");
  });
});

describe("readLegacyNav", () => {
  it("reads a legacy nav for the redirect", () => {
    expect(readLegacyNav("#nav=analysis&ay=2024")).toBe("analysis");
    expect(readLegacyNav("#nav=revenue")).toBe("revenue");
  });

  it("returns null when there is nothing to redirect to", () => {
    expect(readLegacyNav("#m=table")).toBeNull();
    expect(readLegacyNav("")).toBeNull();
    expect(readLegacyNav("#nav=bogus")).toBeNull();
  });
});

describe("stripNavFromHash", () => {
  it("keeps the rest of the state intact", () => {
    expect(stripNavFromHash("#nav=revenue&m=table&sel=revenue.vat")).toBe("m=table&sel=revenue.vat");
  });

  it("returns an empty string when nav was all there was", () => {
    expect(stripNavFromHash("#nav=analysis")).toBe("");
  });
});

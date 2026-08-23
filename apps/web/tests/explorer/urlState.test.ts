import { describe, expect, it } from "vitest";
import {
  parseExplorerHash,
  parseMunicipalHash,
  parseMunicipalLevel,
  readLegacyNav,
  serializeExplorerHash,
  serializeMunicipalHash,
  stripNavFromHash,
} from "../../lib/explorer/urlState";

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

  it("deduplicates shared selections while preserving their first-seen order", () => {
    const state = parseExplorerHash(
      "#g=ministries&sel=admin_spending.total,admin_program.general_education,admin_spending.total",
      "expenditure",
    );

    expect(state.selection?.ids).toEqual(["admin_spending.total", "admin_program.general_education"]);
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

describe("municipal hash state", () => {
  it("round-trips an entity view", () => {
    const hash = serializeMunicipalHash({
      chartMode: "table",
      share: true,
      rangeStart: 2016,
      rangeEnd: 2024,
      selectedIds: ["municipal.health", "municipal.education"],
    });
    const parsed = parseMunicipalHash(`#${hash}`);
    expect(parsed.chartMode).toBe("table");
    expect(parsed.share).toBe(true);
    expect(parsed.range).toEqual({ start: 2016, end: 2024 });
    expect(parsed.selection).toEqual(["municipal.health", "municipal.education"]);
  });

  it("reuses the budget explorer's key vocabulary", () => {
    const hash = serializeMunicipalHash({
      chartMode: "line",
      share: false,
      rangeStart: 2015,
      rangeEnd: 2025,
      selectedIds: ["municipal.health"],
    });
    expect(hash).toBe("m=line&r=2015-2025&sel=municipal.health");
  });

  it("drops unknown values rather than trusting them", () => {
    const parsed = parseMunicipalHash("#m=pie&r=nope&sh=maybe");
    expect(parsed.chartMode).toBeUndefined();
    expect(parsed.range).toBeUndefined();
    expect(parsed.share).toBeUndefined();
  });

  it("restores a deliberately empty selection as empty", () => {
    expect(parseMunicipalHash("#sel=").selection).toEqual([]);
  });

  it("deduplicates repeated municipal selections", () => {
    expect(parseMunicipalHash("#sel=municipal.health,municipal.education,municipal.health").selection).toEqual([
      "municipal.health",
      "municipal.education",
    ]);
  });

  it("reads the index level, defaulting to municipalities", () => {
    expect(parseMunicipalLevel("#lvl=region")).toBe("region");
    expect(parseMunicipalLevel("#lvl=muni")).toBe("muni");
    expect(parseMunicipalLevel("#lvl=galaxy")).toBe("muni");
    expect(parseMunicipalLevel("")).toBe("muni");
  });

  it("survives a malformed hash", () => {
    expect(() => parseMunicipalHash("#%%%")).not.toThrow();
  });
});

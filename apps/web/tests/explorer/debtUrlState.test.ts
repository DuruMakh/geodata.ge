import { describe, expect, it } from "vitest";
import { parseDebtHash, serializeDebtHash } from "../../lib/explorer/debtUrlState";

describe("Government Debt URL state", () => {
  it("uses the debt-only family key alongside the shared hash keys", () => {
    expect(
      serializeDebtHash({
        family: "service",
        chartMode: "table",
        share: false,
        rangeStart: 2013,
        rangeEnd: 2030,
        selectedIds: ["debt.service.total", "debt.service.interest"],
      }),
    ).toBe("f=service&m=table&r=2013-2030&sel=debt.service.total%2Cdebt.service.interest");
  });

  it("keeps only valid, unique selection IDs from the resolved family", () => {
    expect(
      parseDebtHash("#f=stock&m=line&sh=1&r=2013-2025&sel=debt.stock.total,debt.service.total,debt.stock.total,unknown"),
    ).toEqual({
      family: "stock",
      chartMode: "line",
      share: true,
      range: { start: 2013, end: 2025 },
      selection: ["debt.stock.total"],
    });
  });

  it("uses the first valid selection family when a legacy hash omits f", () => {
    expect(parseDebtHash("#sel=debt.service.interest,debt.stock.total")).toEqual({
      family: "service",
      selection: ["debt.service.interest"],
    });
  });

  it("keeps an explicit empty selection in its current family", () => {
    expect(parseDebtHash("#f=rate&sel=")).toEqual({ family: "rate", selection: [] });
  });

  it("falls back safely when the hash is malformed or names an unknown family", () => {
    expect(parseDebtHash("#f=unknown&sel=nope")).toEqual({ family: "stock", selection: [] });
    expect(parseDebtHash("#%%%")).toEqual({ family: "stock" });
  });
});

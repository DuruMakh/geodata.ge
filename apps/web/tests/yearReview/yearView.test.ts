import { describe, expect, test } from "vitest";
import { loadYearReviewData } from "../../lib/yearReview/buildYearReviewData";
import type { YearReviewData } from "../../lib/yearReview/types";
import {
  balanceRecord,
  buysView,
  changeView,
  debtView,
  givesUpView,
  glanceKpis,
  hundredCells,
  longView,
  nearestYear,
  perResidentRows,
  refundsView,
  regionsView,
  whereView,
} from "../../lib/yearReview/yearView";

// A small synthetic year review: budget 2022–2025 actual and a 2026 plan; receipts end in 2025, with one
// negative tax line (2023) and a non-tax line missing in the first year; one institution appears in 2024.
function fixture(): YearReviewData {
  const category = (id: string, values: (number | null)[]) => ({ id, label: `label ${id}`, color: "#000000", values });
  return {
    budget: {
      years: [2022, 2023, 2024, 2025, 2026],
      planned: [false, false, false, false, true],
      defaultYear: 2025,
      fields: [
        category("spending.a", [58, 70, 80, 90, 100]),
        category("spending.b", [30, 20, 25, 30, 35]),
        category("spending.c", [12, 15, 10, 5, 8]),
      ],
      institutions: [
        category("admin.x", [50, 60, 70, 80, 90]),
        category("admin.y", [null, null, 20, 25, 30]),
        category("admin.z", [40, 30, 20, 10, 5]),
      ],
      receipts: [
        { ...category("revenue.vat", [40, 50, 60, 70, null]), tax: true },
        { ...category("revenue.income_tax", [20, 25, 30, 35, null]), tax: true },
        { ...category("revenue.increase_liabilities", [null, 10, 10, 10, null]), tax: false },
        { ...category("revenue.profit_tax", [10, 10, 10, 15, null]), tax: true },
        { ...category("revenue.other_taxes", [5, -5, 5, 5, null]), tax: true },
      ],
      gdp: [500, 550, 600, 650, null],
      population: [10, 10, 10, 10, 10],
    },
    spendingTypes: {
      years: [2023, 2024, 2025],
      total: [100, 110, 120],
      types: [
        category("spending_type.social_benefits", [40, 45, 50]),
        category("spending_type.investment", [30, 35, 30]),
        category("spending_type.interest", [25, 25, 37]),
        category("spending_type.other", [5, 5, 3]),
      ],
    },
    taxBreaks: { years: [2023, 2024], vat: [10, 14], income: [5, 7], all: [20, 28] },
    refunds: { years: [2022, 2023, 2024, 2025], values: [8, 6, 9, 7] },
    balance: {
      years: [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028],
      pctGdp: [-3, -5, -2, -4, -6, -1, -7, -2, 1],
      gel: [-30, -50, -20, -40, -60, -10, -70, -20, 10],
      projection: [false, false, false, false, false, false, true, true, true],
    },
    debt: {
      stock: { years: [2022, 2023, 2024, 2025], external: [30, 32, 34, 36], domestic: [20, 21, 22, 24], total: [50, 53, 56, 60] },
      rates: { years: [2023, 2024, 2025], total: [3, 4, 5], external: [2, 3, 4], domestic: [8, 9, 10] },
      service: {
        years: [2022, 2023, 2024, 2025, 2026, 2027, 2028],
        principal: [5, 6, 7, 8, 9, 10, 11],
        interest: [1, 1, 2, 2, 3, 3, 3],
        projection: [false, false, false, false, true, true, true],
      },
    },
    municipal: {
      year: 2025,
      regions: [{ id: "region.one", label: "One" }, { id: "region.two", label: "Two" }],
      places: [
        { code: "01", label: "p1", regionId: "region.one", totalGel: 100, perResidentGel: 50 },
        { code: "02", label: "p2", regionId: "region.one", totalGel: 300, perResidentGel: 100 },
        { code: "03", label: "p3", regionId: "region.two", totalGel: 60, perResidentGel: 20 },
        { code: "04", label: "p4", regionId: "region.two", totalGel: 40, perResidentGel: 40 },
      ],
    },
    updatedAt: "2026-10-30",
  };
}

describe("nearestYear", () => {
  const years = [2020, 2021, 2022, 2023, 2024];
  const values = [null, 5, null, 7, null];

  test("takes the chosen year when it has a value", () => {
    expect(nearestYear(years, values, 2023)).toBe(2023);
  });

  test("a missing year falls back to the nearest earlier value", () => {
    expect(nearestYear(years, values, 2022)).toBe(2021);
    expect(nearestYear(years, values, 2024)).toBe(2023);
    expect(nearestYear(years, values, 2030)).toBe(2023);
  });

  test("before the first value it takes the next one", () => {
    expect(nearestYear(years, values, 2020)).toBe(2021);
    expect(nearestYear(years, values, 2010)).toBe(2021);
  });

  test("a series without values gives null", () => {
    expect(nearestYear(years, [null, null, null, null, null], 2022)).toBeNull();
  });
});

describe("hundredCells", () => {
  test("whole cells that add up to 100", () => {
    expect(hundredCells([60, 30, 10])).toEqual([60, 30, 10]);
    expect(hundredCells([1, 1, 1])).toEqual([34, 33, 33]);
  });

  test("a negative value gets no cells and the rest still add up to 100", () => {
    expect(hundredCells([50, -5, 50])).toEqual([50, 0, 50]);
  });
});

describe("glanceKpis", () => {
  test("six numbers; a dataset that ends before the chosen year falls back to its last year", () => {
    const kpis = glanceKpis(fixture(), 2026);
    expect(kpis.map((kpi) => kpi.id)).toEqual(["spend", "tax", "balance", "debt", "breaks", "perResident"]);
    const byId = Object.fromEntries(kpis.map((kpi) => [kpi.id, kpi]));
    expect(byId.debt).toMatchObject({ year: 2025, fallback: true, value: 60, previous: { year: 2024, value: 56 }, sparkIndex: 3 });
    expect(byId.tax).toMatchObject({ year: 2025, fallback: true, value: 125, planned: false });
    expect(byId.breaks).toMatchObject({ year: 2024, fallback: true, value: 28 });
    expect(byId.spend).toMatchObject({ year: 2026, fallback: false, value: 143, planned: true, previous: { year: 2025, value: 125 }, sparkIndex: 4 });
    expect(byId.balance).toMatchObject({ year: 2026, fallback: false, value: -7, planned: true });
    expect(byId.perResident).toMatchObject({ year: 2026, value: 14.3, planned: true });
    expect(byId.spend!.spark).toEqual([100, 105, 115, 125, 143]);
  });

  test("the first year has no previous value", () => {
    const spend = glanceKpis(fixture(), 2022).find((kpi) => kpi.id === "spend")!;
    expect(spend.previous).toBeNull();
  });
});

describe("balanceRecord", () => {
  test("a deficit deeper than every earlier year is the largest ever", () => {
    expect(balanceRecord(fixture(), 2024)).toEqual({ kind: "largestEver" });
  });

  test("a projection year deeper than the chosen actual year does not count", () => {
    const data = fixture();
    data.balance.pctGdp[1] = -9;
    data.balance.projection[1] = true;
    expect(balanceRecord(data, 2024)).toEqual({ kind: "largestEver" });
  });

  test("names the last earlier year at least as deep or as shallow", () => {
    expect(balanceRecord(fixture(), 2023)).toEqual({ kind: "largestSince", since: 2021 });
    const data = fixture();
    data.balance.pctGdp[5] = -2.5;
    expect(balanceRecord(data, 2025)).toEqual({ kind: "smallestSince", since: 2022 });
    expect(balanceRecord(fixture(), 2025)).toEqual({ kind: "smallestEver" });
    expect(balanceRecord(fixture(), 2028)).toEqual({ kind: "surplus" });
  });
});

describe("whereView", () => {
  test("ranks the year's categories, 100 cells in rank order, shares of the true total", () => {
    const view = whereView(fixture(), "fields", 2025);
    expect(view.items.map((item) => item.id)).toEqual(["spending.a", "spending.b", "spending.c"]);
    expect(view.items.map((item) => item.cells)).toEqual([72, 24, 4]);
    expect(view.cells).toHaveLength(100);
    expect(view.cells.slice(70, 74)).toEqual(["spending.a", "spending.a", "spending.b", "spending.b"]);
    expect(view.total).toBe(125);
    expect(view.items[0]!.share).toBeCloseTo(0.72, 12);
    expect(view.items[2]!.change).toBeCloseTo(-0.5, 12);
    expect(view.thenYear).toBe(2022);
    expect(view.thenCells).toHaveLength(100);
    expect(view.planned).toBe(false);
  });

  test("in the first year the then grid shows the last actual year", () => {
    const view = whereView(fixture(), "fields", 2022);
    expect(view.thenYear).toBe(2025);
    expect(view.thenCells.slice(0, 72).every((id) => id === "spending.a")).toBe(true);
  });

  test("a year outside the state budget is an error", () => {
    expect(() => whereView(fixture(), "fields", 2030)).toThrow(/2030/);
    expect(() => changeView(fixture(), "fields", 2021)).toThrow(/2021/);
  });

  test("an institution without a value that year is left out of the ranking", () => {
    const view = whereView(fixture(), "institutions", 2022);
    expect(view.items.map((item) => item.id)).toEqual(["admin.x", "admin.z"]);
    expect(view.items[0]!.change).toBeNull();
  });
});

describe("changeView", () => {
  test("the first year has nothing to compare with", () => {
    expect(changeView(fixture(), "fields", 2022)).toEqual({ none: true });
  });

  test("a plan year compares the plan with the previous actual year", () => {
    const view = changeView(fixture(), "fields", 2026);
    if (view.none) throw new Error("expected a change view");
    expect(view).toMatchObject({ previousYear: 2025, basis: "planVsActual", total: 18, topUp: "spending.a", topDown: null });
    expect(view.totalPct).toBeCloseTo(18 / 125, 12);
    expect(view.upShare).toBeCloseTo(10 / 18, 12);
    expect(changeView(fixture(), "fields", 2025)).toMatchObject({ basis: "actual" });
  });

  test("rows sort by change; a category without a previous value has no change and sorts last", () => {
    const view = changeView(fixture(), "institutions", 2024);
    if (view.none) throw new Error("expected a change view");
    expect(view.rows.map((row) => [row.id, row.delta])).toEqual([["admin.x", 10], ["admin.z", -10], ["admin.y", null]]);
    expect(view.rows[2]!.pct).toBeNull();
    expect(view.rows[1]!.pct).toBeCloseTo(-1 / 3, 12);
    // The total compares every institution of each year, the new one included.
    expect(view).toMatchObject({ topUp: "admin.x", topDown: "admin.z", total: 20 });
  });
});

describe("buysView", () => {
  test("falls back to the last spending-types year and tiles the positive types", () => {
    const view = buysView(fixture(), 2026);
    expect(view).toMatchObject({ year: 2025, fallback: true });
    expect(view.value.total).toBe(120);
    expect(view.value.tiles.map((tile) => tile.id)).toEqual([
      "spending_type.social_benefits", "spending_type.interest", "spending_type.investment", "spending_type.other",
    ]);
    expect(view.value.tiles[1]!.change).toBeCloseTo(0.48, 12);
    const area = view.value.tiles.reduce((sum, tile) => sum + tile.rect[2] * tile.rect[3], 0);
    expect(area).toBeCloseTo(1000 * 430, 6);
  });
});

describe("givesUpView", () => {
  test("collected and given up in the latest tax-breaks year at or before the chosen year", () => {
    const view = givesUpView(fixture(), 2025);
    expect(view).toMatchObject({ year: 2024, fallback: true });
    expect(view.value).toMatchObject({ vat: [60, 14], income: [40, 7], all: [105, 28] });
    expect(view.value.per100.vat).toBeCloseTo((14 / 60) * 100, 12);
  });

  test("a year without the collected amount falls back to one that has every part", () => {
    const data = fixture();
    data.budget.receipts.find((receipt) => receipt.id === "revenue.profit_tax")!.values[2] = null;
    const view = givesUpView(data, 2024);
    expect(view).toMatchObject({ year: 2023, fallback: true });
    expect(view.value).toMatchObject({ vat: [50, 10], income: [35, 5] });
  });
});

describe("refundsView", () => {
  test("a record is higher than every earlier year", () => {
    const view = refundsView(fixture(), 2024);
    expect(view).toMatchObject({ year: 2024, fallback: false, value: { value: 9, record: true } });
    expect(view.value.shareOfTax).toBeCloseTo(9 / 105, 12);
    expect(refundsView(fixture(), 2025).value.record).toBe(false);
    expect(refundsView(fixture(), 2026)).toMatchObject({ year: 2025, fallback: true });
  });

  test("refunds of a year without tax revenue fall back to the last year that has both", () => {
    const data = fixture();
    data.refunds = { years: [2022, 2023, 2024, 2025, 2026], values: [8, 6, 9, 7, 10] };
    const view = refundsView(data, 2026);
    expect(view).toMatchObject({ year: 2025, fallback: true, value: { value: 7 } });
    expect(view.value.shareOfTax).toBeCloseTo(7 / 125, 12);
  });
});

describe("debtView", () => {
  test("the stock with its GDP share, per resident and average rate", () => {
    const view = debtView(fixture(), 2026);
    expect(view).toMatchObject({ year: 2025, fallback: true, value: { total: 60, external: 36, domestic: 24, perResident: 6, rate: 5 } });
    expect(view.value.toGdp).toBeCloseTo(60 / 650, 12);
    expect(debtView(fixture(), 2022).value.rate).toBeNull();
  });

  test("a year without the external/domestic split falls back to one that has it", () => {
    const data = fixture();
    data.debt.stock.external[3] = null;
    expect(debtView(data, 2025)).toMatchObject({ year: 2024, fallback: true, value: { total: 56, external: 34, domestic: 22 } });
  });
});

describe("perResidentRows", () => {
  test("six rows, each in its own nearest year", () => {
    const rows = perResidentRows(fixture(), 2026);
    expect(rows.map((row) => row.id)).toEqual(["spend", "tax", "debt", "svc", "soc", "mun"]);
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
    expect(byId.spend).toMatchObject({ year: 2026, fallback: false });
    expect(byId.spend!.value).toBeCloseTo(14.3, 12);
    expect(byId.tax).toMatchObject({ value: 12.5, year: 2025, fallback: true });
    expect(byId.debt).toMatchObject({ value: 6, year: 2025, fallback: true });
    expect(byId.svc).toMatchObject({ value: 1.2, year: 2026, fallback: false });
    expect(byId.soc).toMatchObject({ value: 5, year: 2025, fallback: true });
    expect(byId.mun).toMatchObject({ value: 45, year: 2025, fallback: true });
  });

  test("a value from the plan year or the debt-service schedule is planned", () => {
    const planned = Object.fromEntries(perResidentRows(fixture(), 2026).map((row) => [row.id, row.planned]));
    expect(planned).toEqual({ spend: true, tax: false, debt: false, svc: true, soc: false, mun: false });
    expect(perResidentRows(fixture(), 2025).every((row) => !row.planned)).toBe(true);
  });
});

describe("regionsView", () => {
  test("a region's average is its total over its population; the median of 4 is the mean of the middle two", () => {
    const view = regionsView(fixture());
    expect(view.median).toBe(45);
    expect(view.regions.map((region) => region.id)).toEqual(["region.one", "region.two"]);
    // region.one: 100 + 300 GEL over 100/50 + 300/100 = 5 residents.
    expect(view.regions[0]!.average).toBeCloseTo(400 / 5, 12);
    expect(view.regions[1]!.average).toBeCloseTo(100 / 4, 12);
    expect(view.regions[0]!.places.map((place) => place.code)).toEqual(["01", "02"]);
  });
});

describe("longView", () => {
  test("shares: every column sums to 1 with a negative item counted as 0", () => {
    const view = longView(fixture(), "fields", "revenue", "share");
    expect(view.years).toEqual([2022, 2023, 2024, 2025]);
    expect(view.planned).toEqual([false, false, false, false]);
    view.years.forEach((_, index) => {
      expect(view.bands.reduce((sum, band) => sum + band.values[index]!, 0)).toBeCloseTo(1, 9);
      expect(view.top[index]).toBeCloseTo(1, 9);
    });
    expect(view.bands.find((band) => band.id === "revenue.other_taxes")!.values[1]).toBe(0);
  });

  test("GEL: the plan year is marked; gain and loss compare the first and last actual year", () => {
    const view = longView(fixture(), "fields", "expenditure", "gel");
    expect(view.years).toEqual([2022, 2023, 2024, 2025, 2026]);
    expect(view.planned.at(-1)).toBe(true);
    expect(view.top).toEqual([100, 105, 115, 125, 143]);
    expect(view.gain).toEqual({ id: "spending.a", from: 0.58, to: 0.72 });
    expect(view.loss).toEqual({ id: "spending.c", from: 0.12, to: 0.04 });
  });

  test("expenditure bands follow the grouping; receipts ignore it", () => {
    expect(longView(fixture(), "institutions", "expenditure", "gel").bands.map((band) => band.id)).toEqual(["admin.x", "admin.y", "admin.z"]);
    expect(longView(fixture(), "institutions", "revenue", "gel")).toEqual(longView(fixture(), "fields", "revenue", "gel"));
  });
});

describe("every view over the served data", () => {
  test("every budget year, both groupings and both sides give finite numbers and full grids", async () => {
    const { data } = await loadYearReviewData("ka");
    const finite = (value: unknown) => expect(Number.isFinite(value)).toBe(true);
    for (const year of data.budget.years) {
      for (const grouping of ["fields", "institutions"] as const) {
        const where = whereView(data, grouping, year);
        expect(where.cells).toHaveLength(100);
        expect(where.thenCells).toHaveLength(100);
        const change = changeView(data, grouping, year);
        expect(change.none).toBe(year === data.budget.years[0]);
        if (!change.none) change.rows.forEach((row) => row.delta === null || finite(row.delta));
      }
      glanceKpis(data, year).forEach((kpi) => finite(kpi.value));
      perResidentRows(data, year).forEach((row) => finite(row.value));
      finite(buysView(data, year).value.total);
      Object.values(givesUpView(data, year).value.per100).forEach(finite);
      finite(refundsView(data, year).value.shareOfTax);
      finite(debtView(data, year).value.total);
      balanceRecord(data, year);
    }
    for (const side of ["expenditure", "revenue"] as const) {
      for (const grouping of ["fields", "institutions"] as const) {
        longView(data, grouping, side, "share").top.forEach((top) => expect(top).toBeCloseTo(1, 9));
      }
    }
  });
});

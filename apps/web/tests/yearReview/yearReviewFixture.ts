import type { YearReviewData } from "../../lib/yearReview/types";

// A small synthetic year review: budget 2022–2025 actual and a 2026 plan; receipts end in 2025, with one
// negative tax line (2023) and a non-tax line missing in the first year; one institution appears in 2024.
export function fixture(): YearReviewData {
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

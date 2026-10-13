import { describe, expect, it } from "vitest";
import { buildBudgetWorkbookInput, type BudgetWorkbookInput } from "../../lib/explorer/budgetWorkbook";
import type { ExplorerModel } from "../../lib/explorer/explorerData";
import type { ExplorerItem, ExplorerTableRow } from "../../lib/explorer/types";

const source = (name: string) => ({
  years: [2023, 2024],
  title: name,
  organization: "MoF",
  downloadHref: `/downloads/methodology/expenditure/files/${name}.pdf` as const,
  retrievedAt: "2026-06-09",
});
const sources = { budget: [source("budget")], admin: [source("admin")], gdp: [source("gdp")] };

const item = (id: string, level: ExplorerItem["level"], kaLabel: string, parentItemId: string | null = null): ExplorerItem => ({
  id, side: "expenditure", parentItemId, level, kaLabel, enLabel: kaLabel, color: "#000", sortOrder: 0,
});
const row = (base: ExplorerItem, values: Record<number, number | null>, extra: Partial<ExplorerTableRow> = {}): ExplorerTableRow => ({
  itemId: base.id, parentItemId: base.parentItemId, level: base.level, kaLabel: base.kaLabel, enLabel: base.enLabel, color: base.color,
  basisByYear: { 2023: "actual", 2024: "planned" }, valuesByYear: values, change: null, ...extra,
});

const total = item("expenditure.total", "total", "ხარჯები სულ");
const ministry = item("admin.ministry_health", "admin_category", "ჯანდაცვის სამინისტრო");
const program = item("admin.program_x", "major_program", "პროგრამა X", ministry.id);
const model = {
  years: [2023, 2024],
  items: [total, ministry, program],
  tableRows: [
    row(total, { 2023: 100, 2024: 120 }, { shareByYear: { 2023: 0.3, 2024: 0.31 } }),
    row(ministry, { 2023: 40, 2024: null }),
    row(program, { 2023: 10, 2024: 12 }, { basisByYear: { 2023: "actual" } }),
  ],
  totalRow: row(total, { 2023: 100, 2024: 120 }),
} as unknown as ExplorerModel;

const base: BudgetWorkbookInput = {
  model,
  presentation: { locale: "ka", englishLabels: {} },
  scope: "ministries",
  share: false,
  title: "სახელმწიფო ხარჯები",
  sources,
  siteOrigin: "https://fiscal.ge",
};

describe("buildBudgetWorkbookInput", () => {
  it("marks the total, groups and items, and names each row's parent", () => {
    const input = buildBudgetWorkbookInput(base);
    expect(input.series.map(({ id, kind, parentLabel, label }) => ({ id, kind, parentLabel, label }))).toEqual([
      { id: "expenditure.total", kind: "total", parentLabel: null, label: "ხარჯები სულ" },
      { id: "admin.ministry_health", kind: "group", parentLabel: null, label: "ჯანდაცვის სამინისტრო" },
      { id: "admin.program_x", kind: "item", parentLabel: "ჯანდაცვის სამინისტრო", label: "პროგრამა X" },
    ]);
    expect(input).toMatchObject({ locale: "ka", filenameBase: "ministries", title: "სახელმწიფო ხარჯები", totalId: "expenditure.total", years: [2023, 2024], siteOrigin: "https://fiscal.ge" });
  });

  it("keeps each year's basis and leaves missing values or bases empty", () => {
    const [totalSeries, ministrySeries, programSeries] = buildBudgetWorkbookInput(base).series;
    expect(totalSeries.pointsByYear).toEqual({
      2023: { amountGel: 100, measureValue: undefined, basis: "actual" },
      2024: { amountGel: 120, measureValue: undefined, basis: "planned" },
    });
    expect(ministrySeries.pointsByYear[2024]).toBeNull();
    expect(programSeries.pointsByYear[2024]).toBeNull();
  });

  it("amounts are in million GEL and cite the scope's own sources", () => {
    const ministries = buildBudgetWorkbookInput(base);
    expect(ministries.measure).toMatchObject({ kind: "amount", readableScale: 1_000_000 });
    expect(ministries.sources.map((entry) => entry.title)).toEqual(["admin"]);
    expect(buildBudgetWorkbookInput({ ...base, scope: "fields" }).sources.map((entry) => entry.title)).toEqual(["budget"]);
    expect(buildBudgetWorkbookInput({ ...base, scope: "revenue" }).sources.map((entry) => entry.title)).toEqual(["budget"]);
  });

  it("shares of GDP carry the share per year and add the GDP sources", () => {
    const input = buildBudgetWorkbookInput({ ...base, scope: "fields", share: true });
    expect(input.measure.kind).toBe("percentage");
    expect(input.series[0].pointsByYear[2024]).toEqual({ amountGel: 120, measureValue: 0.31, basis: "planned" });
    expect(input.sources.map((entry) => entry.title)).toEqual(["budget", "gdp"]);
  });

  it("names the group column and labels in the page language", () => {
    const english = { ...base, presentation: { locale: "en" as const, englishLabels: { "expenditure.total": "Total spending", "admin.ministry_health": "Ministry of Health", "admin.program_x": "Program X" } } };
    expect(buildBudgetWorkbookInput(english).series[2].label).toBe("Program X");
    expect(buildBudgetWorkbookInput(english).groupLabel).not.toBe(buildBudgetWorkbookInput(base).groupLabel);
    const groups = (["fields", "ministries", "revenue"] as const).map((scope) => buildBudgetWorkbookInput({ ...base, scope }).groupLabel);
    expect(new Set(groups).size).toBe(3);
  });
});

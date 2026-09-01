import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(process.cwd(), "../..");
const sourceDir = path.join(
  repoRoot,
  "docs/Raw Data/Debt/government-debt-annual/official",
);
const pdfTextModulePath = path.join(
  repoRoot,
  "apps/web/lib/data/governmentDebt/pdfText.ts",
);
const parserModulePath = path.join(
  repoRoot,
  "apps/web/lib/data/governmentDebt/parseDebtSources.ts",
);

describe("government debt source parsers", () => {
  it("reads approved PDF pages and preserves both Ministry number formats", async () => {
    expect(fs.existsSync(pdfTextModulePath)).toBe(true);
    expect(fs.existsSync(parserModulePath)).toBe(true);
    if (!fs.existsSync(pdfTextModulePath) || !fs.existsSync(parserModulePath)) {
      return;
    }

    const { readPdfPages, requirePageMarker } = await import(
      pathToFileURL(pdfTextModulePath).href
    );
    const { parseEnglishAmount, parseLegacyAmount, parsePercent } = await import(
      pathToFileURL(parserModulePath).href
    );
    const pages = await readPdfPages(
      path.join(sourceDir, "public-debt-bulletin-n25.pdf"),
      [26, 27],
    );

    expect(requirePageMarker(pages, 26, "17. Public Debt Stock")).toContain(
      "External Government Debt",
    );
    expect(
      requirePageMarker(pages, 27, "Net Flows & Net Transfers on Public Debt"),
    ).toContain("Domestic Government Debt");
    expect(() => requirePageMarker(pages, 26, "wrong marker")).toThrow(
      "Missing marker",
    );
    expect(parseEnglishAmount("24,231.3")).toBe(24231.3);
    expect(parseLegacyAmount("7 095,2")).toBe(7095.2);
    expect(parsePercent("9.20%")).toBe(9.2);
  });

  it("normalizes exact Government Debt stock components and derives totals", async () => {
    const { readPdfPages } = await import(pathToFileURL(pdfTextModulePath).href);
    const parserModule = await import(pathToFileURL(parserModulePath).href);
    expect(parserModule.parseGovernmentDebtStock).toBeTypeOf("function");
    if (typeof parserModule.parseGovernmentDebtStock !== "function") return;

    const n13Pages = await readPdfPages(
      path.join(sourceDir, "public-debt-bulletin-n13.pdf"),
      [31],
    );
    const n25Pages = await readPdfPages(
      path.join(sourceDir, "public-debt-bulletin-n25.pdf"),
      [26],
    );
    const rows = parserModule.parseGovernmentDebtStock({
      n13Page31: n13Pages.get(31)!,
      n25Page26: n25Pages.get(26)!,
    });
    const value = (year: number, debtScope: string) =>
      rows.find(
        (row: { year: number; debt_scope: string }) =>
          row.year === year && row.debt_scope === debtScope,
      );

    expect(rows).toHaveLength(39);
    expect(value(2013, "external")?.amount_million_gel).toBe(7095.2);
    expect(value(2013, "domestic")?.amount_million_gel).toBe(1337.8);
    expect(value(2013, "total")?.amount_million_gel).toBe(8433);
    expect(value(2014, "total")?.amount_million_gel).toBe(9622.9);
    expect(value(2019, "total")?.amount_million_gel).toBe(19915.7);
    expect(value(2022, "total")?.amount_million_gel).toBe(28587.3);
    expect(value(2025, "total")?.amount_million_gel).toBe(35934.4);
    expect(value(2019, "domestic")?.methodology_note_id).toBe(
      "government-domestic-2019-budget-organizations",
    );
    expect(value(2022, "domestic")?.methodology_note_id).toBe(
      "government-domestic-2022-general-government-soes",
    );

    for (let year = 2013; year <= 2025; year += 1) {
      expect(value(year, "total")?.amount_million_gel).toBeCloseTo(
        value(year, "domestic")!.amount_million_gel +
          value(year, "external")!.amount_million_gel,
        10,
      );
    }
  });

  it("normalizes actual Government Debt principal and interest without public-debt extras", async () => {
    const { readPdfPages } = await import(pathToFileURL(pdfTextModulePath).href);
    const parserModule = await import(pathToFileURL(parserModulePath).href);
    expect(parserModule.parseActualDebtService).toBeTypeOf("function");
    if (typeof parserModule.parseActualDebtService !== "function") return;

    const [n7, n13, n19, n25] = await Promise.all([
      readPdfPages(path.join(sourceDir, "public-debt-bulletin-n7.pdf"), [32]),
      readPdfPages(path.join(sourceDir, "public-debt-bulletin-n13.pdf"), [32]),
      readPdfPages(path.join(sourceDir, "public-debt-bulletin-n19.pdf"), [35]),
      readPdfPages(path.join(sourceDir, "public-debt-bulletin-n25.pdf"), [20, 27]),
    ]);
    const rows = parserModule.parseActualDebtService({
      n7Page32: n7.get(32)!,
      n13Page32: n13.get(32)!,
      n19Page35: n19.get(35)!,
      n25Page20: n25.get(20)!,
      n25Page27: n25.get(27)!,
    });
    const value = (year: number, debtScope: string) =>
      rows.find(
        (row: { year: number; debt_scope: string }) =>
          row.year === year && row.debt_scope === debtScope,
      );

    expect(rows).toHaveLength(39);
    expect(value(2013, "external")).toMatchObject({
      principal_paid_million_gel: 430.4,
      interest_paid_million_gel: 134.3,
    });
    expect(value(2022, "external")).toMatchObject({
      principal_paid_million_gel: 971.2,
      interest_paid_million_gel: 236.4,
    });
    expect(value(2025, "external")).toMatchObject({
      principal_paid_million_gel: 1359.1,
      interest_paid_million_gel: 718.7,
    });
    expect(value(2020, "domestic")).toMatchObject({
      principal_paid_million_gel: 1570.23,
      interest_paid_million_gel: 428.2,
    });
    expect(value(2025, "domestic")).toMatchObject({
      principal_paid_million_gel: 1377.4,
      interest_paid_million_gel: 914.3,
    });
    expect(value(2013, "total")).toMatchObject({
      principal_paid_million_gel: 692.2,
      interest_paid_million_gel: 232.9,
    });
    expect(value(2019, "total")).toMatchObject({
      principal_paid_million_gel: 2296.75,
      interest_paid_million_gel: 604.9,
    });
    expect(value(2022, "total")).toMatchObject({
      principal_paid_million_gel: 2504.39,
      interest_paid_million_gel: 753.3,
    });
    expect(value(2025, "total")).toMatchObject({
      principal_paid_million_gel: 2736.5,
      interest_paid_million_gel: 1633,
    });
  });

  it("builds the exact rate grid and leaves non-comparable component rates blank", async () => {
    const { readPdfPages } = await import(pathToFileURL(pdfTextModulePath).href);
    const parserModule = await import(pathToFileURL(parserModulePath).href);
    expect(parserModule.parseInterestRateGrid).toBeTypeOf("function");
    if (typeof parserModule.parseInterestRateGrid !== "function") return;

    const [monthly, strategy2019, strategy2022, strategy2023, strategy2025] =
      await Promise.all([
        readPdfPages(path.join(sourceDir, "monthly-debt-report-2026-07.pdf"), [3]),
        readPdfPages(
          path.join(sourceDir, "debt-management-strategy-2019-2021.pdf"),
          [14],
        ),
        readPdfPages(
          path.join(sourceDir, "debt-management-strategy-2022-2025.pdf"),
          [23],
        ),
        readPdfPages(
          path.join(sourceDir, "debt-management-strategy-2023-2026.pdf"),
          [24],
        ),
        readPdfPages(
          path.join(sourceDir, "debt-management-strategy-2025-2029.pdf"),
          [28],
        ),
      ]);
    const rows = parserModule.parseInterestRateGrid({
      monthlyPage3: monthly.get(3)!,
      strategy2019Page14: strategy2019.get(14)!,
      strategy2022Page23: strategy2022.get(23)!,
      strategy2023Page24: strategy2023.get(24)!,
      strategy2025Page28: strategy2025.get(28)!,
    });
    const value = (year: number, debtScope: string) =>
      rows.find(
        (row: { year: number; debt_scope: string }) =>
          row.year === year && row.debt_scope === debtScope,
      );

    expect(rows).toHaveLength(33);
    expect(rows.filter((row: { availability_status: string }) =>
      row.availability_status === "available")).toHaveLength(22);
    expect(rows.filter((row: { weighted_average_interest_rate_percent: number | null }) =>
      row.weighted_average_interest_rate_percent === null)).toHaveLength(11);
    expect(
      rows
        .filter((row: { debt_scope: string }) => row.debt_scope === "total")
        .map(
          (row: { weighted_average_interest_rate_percent: number | null }) =>
            row.weighted_average_interest_rate_percent,
        ),
    ).toEqual([3.1, 3.3, 3.2, 3.3, 3.2, 2.8, 2.5, 3.9, 5, 4.9, 4.7]);
    expect(value(2018, "domestic")?.weighted_average_interest_rate_percent).toBe(
      8.3,
    );
    expect(value(2024, "domestic")?.weighted_average_interest_rate_percent).toBe(
      8.84,
    );
    expect(value(2021, "external")?.weighted_average_interest_rate_percent).toBe(
      0.95,
    );
    expect(value(2024, "external")?.weighted_average_interest_rate_percent).toBe(
      3.12,
    );
    expect(value(2019, "external")).toMatchObject({
      weighted_average_interest_rate_percent: null,
      availability_status: "not_found_in_reviewed_sources",
    });
    expect(value(2025, "domestic")?.weighted_average_interest_rate_percent).toBeNull();
    expect(value(2025, "external")?.weighted_average_interest_rate_percent).toBeNull();
  });

  it("builds the five-year existing-portfolio schedule and reads control cells", async () => {
    const { readPdfPages } = await import(pathToFileURL(pdfTextModulePath).href);
    const parserModule = await import(pathToFileURL(parserModulePath).href);
    expect(parserModule.parseDebtServiceForecast).toBeTypeOf("function");
    expect(parserModule.readControlWorkbookValues).toBeTypeOf("function");
    if (
      typeof parserModule.parseDebtServiceForecast !== "function" ||
      typeof parserModule.readControlWorkbookValues !== "function"
    ) {
      return;
    }

    const n25 = await readPdfPages(
      path.join(sourceDir, "public-debt-bulletin-n25.pdf"),
      [7, 17, 22, 24],
    );
    const rows = parserModule.parseDebtServiceForecast({
      n25Page7: n25.get(7)!,
      n25Page17: n25.get(17)!,
      n25Page22: n25.get(22)!,
      n25Page24: n25.get(24)!,
    });
    const value = (year: number, debtScope: string) =>
      rows.find(
        (row: { payment_year: number; debt_scope: string }) =>
          row.payment_year === year && row.debt_scope === debtScope,
      );

    expect(rows).toHaveLength(15);
    expect(value(2026, "external")).toMatchObject({
      principal_source_amount: 1010.9,
      interest_source_amount: 237.6,
      source_currency: "USD",
      published_exchange_rate: 0.371,
      snapshot_date: "2025-12-31",
    });
    expect(value(2030, "external")).toMatchObject({
      principal_source_amount: 508.9,
      interest_source_amount: 181.5,
    });
    expect(value(2026, "external")?.principal_million_gel).toBeCloseTo(
      1010.9 / 0.371,
      10,
    );
    expect(value(2026, "domestic")).toMatchObject({
      principal_source_amount: 822.211,
      interest_source_amount: 973.4,
      total_service_million_gel: 1795.6,
      source_currency: "GEL",
    });
    expect(value(2030, "domestic")).toMatchObject({
      principal_source_amount: 1516.849,
      interest_source_amount: 342.3,
      total_service_million_gel: 1859.1,
    });

    for (let year = 2026; year <= 2030; year += 1) {
      expect(value(year, "total")?.principal_million_gel).toBeCloseTo(
        value(year, "domestic")!.principal_million_gel +
          value(year, "external")!.principal_million_gel,
        10,
      );
      expect(value(year, "total")?.interest_million_gel).toBeCloseTo(
        value(year, "domestic")!.interest_million_gel +
          value(year, "external")!.interest_million_gel,
        10,
      );
    }

    expect(
      parserModule.readControlWorkbookValues(
        path.join(sourceDir, "central-government-debt-liabilities-control.xlsx"),
      ),
    ).toEqual([
      {
        year: 2019,
        total_million_gel: 20569.7,
        domestic_million_gel: 4827,
        external_million_gel: 15742.7,
        source_cells: "Sheet2!AX6/AX9/AX15",
      },
      {
        year: 2022,
        total_million_gel: 28493.8,
        domestic_million_gel: 7105.1,
        external_million_gel: 21388.7,
        source_cells: "Sheet2!BJ6/BJ9/BJ15",
      },
    ]);
  });
});

import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import type {
  ControlYearComparison,
  DebtScope,
  GovernmentDebtActualServiceControlRow,
  GovernmentDebtActualServiceRow,
  GovernmentDebtForecastRow,
  GovernmentDebtInterestRateRow,
  GovernmentDebtSourceId,
  GovernmentDebtStockRow,
} from "./types";

function requireNonnegativeNumber(value: number, source: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid nonnegative source number: ${source}`);
  }
  return value;
}

export function parseEnglishAmount(source: string): number {
  const normalized = source.trim().replaceAll(",", "").replaceAll(" ", "");
  return requireNonnegativeNumber(Number(normalized), source);
}

export function parseLegacyAmount(source: string): number {
  const normalized = source.trim().replaceAll(" ", "").replace(",", ".");
  return requireNonnegativeNumber(Number(normalized), source);
}

export function parsePercent(source: string): number {
  return parseEnglishAmount(source.trim().replace(/%$/, ""));
}

export type StockSourcePages = {
  n13Page31: string;
  n25Page26: string;
};

function requireLine(text: string, prefix: string): string {
  const line = text
    .split(/\r?\n/)
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate.startsWith(prefix));
  if (!line) throw new Error(`Missing source row: ${prefix}`);
  return line;
}

function legacyNumberTokens(source: string): number[] {
  return (source.match(/\d{1,3}(?: \d{3})*(?:,\d+)?/g) ?? []).map(
    parseLegacyAmount,
  );
}

function englishNumberTokens(source: string): number[] {
  return (source.match(/\d{1,3}(?:,\d{3})*(?:\.\d+)?/g) ?? []).map(
    parseEnglishAmount,
  );
}

function gelValues(
  source: string,
  prefix: string,
  yearCount: number,
  tokenize: (value: string) => number[],
): number[] {
  const numbers = tokenize(requireLine(source, prefix).slice(prefix.length));
  if (numbers.length !== yearCount * 2) {
    throw new Error(
      `Expected ${yearCount * 2} USD/GEL values for ${prefix}; found ${numbers.length}`,
    );
  }
  return numbers.filter((_, index) => index % 2 === 1);
}

function methodologyNote(year: number, scope: DebtScope): string {
  if (scope === "external") return "";
  if (year === 2019) return "government-domestic-2019-budget-organizations";
  if (year === 2022) return "government-domestic-2022-general-government-soes";
  return "";
}

function stockRow(
  year: number,
  debtScope: DebtScope,
  amountMillionGel: number,
  sourceId: GovernmentDebtSourceId,
  sourceTable: string,
): GovernmentDebtStockRow {
  const isTotal = debtScope === "total";
  const sourceRowLabel = isTotal
    ? "External Government Debt + Domestic Government Debt"
    : `${debtScope === "domestic" ? "Domestic" : "External"} Government Debt`;
  return {
    year,
    debt_scope: debtScope,
    amount_million_gel: amountMillionGel,
    amount_gel: Math.round(amountMillionGel * 1_000_000),
    observation_date: `${year}-12-31`,
    status: "actual",
    source_id: sourceId,
    source_table: sourceTable,
    source_row_label: sourceRowLabel,
    source_unit: "Million GEL",
    transformation: isTotal
      ? "Exact sum of the published Domestic Government Debt and External Government Debt GEL components; the rounded published total is retained only as a validation control."
      : "Published year-end GEL component selected from the approved Government Debt stock row; no estimate.",
    methodology_note_id: methodologyNote(year, debtScope),
    last_reviewed_at: "2026-09-01",
  };
}

function stockRowsForYears(
  years: number[],
  domesticValues: number[],
  externalValues: number[],
  sourceId: GovernmentDebtSourceId,
  sourceTable: string,
): GovernmentDebtStockRow[] {
  return years.flatMap((year, index) => {
    const domestic = domesticValues[index]!;
    const external = externalValues[index]!;
    const total = Number((domestic + external).toFixed(10));
    return [
      stockRow(year, "total", total, sourceId, sourceTable),
      stockRow(year, "domestic", domestic, sourceId, sourceTable),
      stockRow(year, "external", external, sourceId, sourceTable),
    ];
  });
}

export function parseGovernmentDebtStock(
  sources: StockSourcePages,
): GovernmentDebtStockRow[] {
  const n13Years = [2013, 2014, 2015, 2016, 2017, 2018, 2019];
  const n13Domestic = gelValues(
    sources.n13Page31,
    "Domestic Government Debt",
    n13Years.length,
    legacyNumberTokens,
  );
  const n13External = gelValues(
    sources.n13Page31,
    "External Government Debt",
    n13Years.length,
    legacyNumberTokens,
  );

  const n25Years = Array.from({ length: 11 }, (_, index) => 2015 + index);
  const n25Domestic = gelValues(
    sources.n25Page26,
    "Domestic Government Debt",
    n25Years.length,
    englishNumberTokens,
  );
  const n25External = gelValues(
    sources.n25Page26,
    "External Government Debt",
    n25Years.length,
    englishNumberTokens,
  );

  return [
    ...stockRowsForYears(
      n13Years.slice(0, 2),
      n13Domestic.slice(0, 2),
      n13External.slice(0, 2),
      "mof_public_debt_bulletin_n13",
      "16. PUBLIC DEBT STOCK",
    ),
    ...stockRowsForYears(
      n25Years,
      n25Domestic,
      n25External,
      "mof_public_debt_bulletin_n25",
      "17. Public Debt Stock",
    ),
  ];
}

export type StockOverlapSourcePages = StockSourcePages & {
  n19Page34: string;
};

export function parseGovernmentDebtStockOverlapSources(
  sources: StockOverlapSourcePages,
): {
  n13: GovernmentDebtStockRow[];
  n19: GovernmentDebtStockRow[];
  n25: GovernmentDebtStockRow[];
} {
  const n13Years = Array.from({ length: 7 }, (_, index) => 2013 + index);
  const n19Years = Array.from({ length: 9 }, (_, index) => 2014 + index);
  const n25Years = Array.from({ length: 11 }, (_, index) => 2015 + index);

  return {
    n13: stockRowsForYears(
      n13Years,
      gelValues(
        sources.n13Page31,
        "Domestic Government Debt",
        n13Years.length,
        legacyNumberTokens,
      ),
      gelValues(
        sources.n13Page31,
        "External Government Debt",
        n13Years.length,
        legacyNumberTokens,
      ),
      "mof_public_debt_bulletin_n13",
      "16. PUBLIC DEBT STOCK",
    ),
    n19: stockRowsForYears(
      n19Years,
      gelValues(
        sources.n19Page34,
        "Domestic Government Debt *",
        n19Years.length,
        englishNumberTokens,
      ),
      gelValues(
        sources.n19Page34,
        "External Government Debt",
        n19Years.length,
        englishNumberTokens,
      ),
      "mof_public_debt_bulletin_n19",
      "17. PUBLIC DEBT STOCK",
    ),
    n25: stockRowsForYears(
      n25Years,
      gelValues(
        sources.n25Page26,
        "Domestic Government Debt",
        n25Years.length,
        englishNumberTokens,
      ),
      gelValues(
        sources.n25Page26,
        "External Government Debt",
        n25Years.length,
        englishNumberTokens,
      ),
      "mof_public_debt_bulletin_n25",
      "17. Public Debt Stock",
    ),
  };
}

export type ActualServiceSourcePages = {
  n7Page32: string;
  n13Page32: string;
  n19Page35: string;
  n25Page20: string;
  n25Page27: string;
};

type ServiceValue = {
  principal: number;
  interest: number;
  sourceId: GovernmentDebtSourceId;
  sourceTable: string;
  sourceRowLabel: string;
};

function requireCompactBlock(
  text: string,
  startMarker: string,
  endMarker: string,
): string {
  const compact = text.replace(/\s+/g, " ");
  const start = compact.indexOf(startMarker);
  if (start < 0) throw new Error(`Missing source block: ${startMarker}`);
  const contentStart = start + startMarker.length;
  const end = compact.indexOf(endMarker, contentStart);
  if (end < 0) throw new Error(`Missing source block end: ${endMarker}`);
  return compact.slice(contentStart, end);
}

function exactSeries(
  text: string,
  prefix: string,
  expectedCount: number,
): number[] {
  const numbers = englishNumberTokens(requireLine(text, prefix).slice(prefix.length));
  if (numbers.length !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} values for ${prefix}; found ${numbers.length}`,
    );
  }
  return numbers;
}

function externalServiceValues(
  text: string,
  years: number[],
  startMarker: string,
  endMarker: string,
  sourceId: GovernmentDebtSourceId,
  sourceTable: string,
): Map<number, ServiceValue> {
  const values = englishNumberTokens(
    requireCompactBlock(text, startMarker, endMarker),
  );
  if (values.length !== years.length * 5) {
    throw new Error(
      `Expected ${years.length * 5} external service values in ${sourceId}; found ${values.length}`,
    );
  }
  return new Map(
    years.map((year, index) => [
      year,
      {
        principal: values[index * 5 + 1]!,
        interest: values[index * 5 + 3]!,
        sourceId,
        sourceTable,
        sourceRowLabel: startMarker,
      },
    ]),
  );
}

function domesticServiceValues(n25Page20: string): Map<number, ServiceValue> {
  const years = Array.from({ length: 13 }, (_, index) => 2013 + index);
  const principal = exactSeries(n25Page20, "PRINCIPAL *", years.length);
  const interest = exactSeries(n25Page20, "INTEREST ", years.length);
  const budgetaryBlock = n25Page20.slice(
    n25Page20.indexOf("Loans of Budgetary Organizations **"),
    n25Page20.indexOf("*Amounts of treasury securities"),
  );
  if (!budgetaryBlock) {
    throw new Error("Missing Loans of Budgetary Organizations service block");
  }
  const budgetaryPrincipal = exactSeries(budgetaryBlock, "Principal", 7);
  const budgetaryInterest = exactSeries(budgetaryBlock, "Interest", 7);

  return new Map(
    years.map((year, index) => {
      const budgetaryIndex = year >= 2019 ? year - 2019 : -1;
      const principalAddition =
        budgetaryIndex >= 0 ? budgetaryPrincipal[budgetaryIndex]! : 0;
      const interestAddition =
        budgetaryIndex >= 0 ? budgetaryInterest[budgetaryIndex]! : 0;
      return [
        year,
        {
          principal: Number(
            (principal[index]! + principalAddition).toFixed(10),
          ),
          interest: Number(
            (interest[index]! + interestAddition).toFixed(10),
          ),
          sourceId: "mof_public_debt_bulletin_n25" as const,
          sourceTable: "12. Debt Service",
          sourceRowLabel:
            year >= 2019
              ? "PRINCIPAL / INTEREST + Loans of Budgetary Organizations"
              : "PRINCIPAL / INTEREST",
        },
      ];
    }),
  );
}

function actualServiceRow(
  year: number,
  debtScope: DebtScope,
  value: ServiceValue,
): GovernmentDebtActualServiceRow {
  const isTotal = debtScope === "total";
  return {
    year,
    debt_scope: debtScope,
    principal_paid_million_gel: value.principal,
    interest_paid_million_gel: value.interest,
    principal_paid_gel: Math.round(value.principal * 1_000_000),
    interest_paid_gel: Math.round(value.interest * 1_000_000),
    status: "actual",
    source_id: value.sourceId,
    source_table: value.sourceTable,
    source_row_label: value.sourceRowLabel,
    source_unit: "Million GEL",
    transformation: isTotal
      ? "Exact sum of the same-year normalized domestic and external Government Debt principal and interest rows; see component rows for complete source provenance."
      : debtScope === "domestic" && year >= 2019
        ? "Published domestic principal and interest plus the published loans-of-budgetary-organizations principal and interest for the same year; no estimate."
        : "Published Government Debt principal and interest selected from the approved source row; no estimate.",
    methodology_note_id: methodologyNote(year, debtScope),
    last_reviewed_at: "2026-09-01",
  };
}

export function parseActualDebtService(
  sources: ActualServiceSourcePages,
): GovernmentDebtActualServiceRow[] {
  const domestic = domesticServiceValues(sources.n25Page20);
  const external = new Map<number, ServiceValue>([
    ...externalServiceValues(
      sources.n7Page32,
      [2013, 2014, 2015, 2016],
      "o/w Government External Debt",
      "PUBLIC DOMESTIC DEBT",
      "mof_public_debt_bulletin_n7",
      "17. NET FLOWS & NET TRANSFERS ON PUBLIC DEBT",
    ),
    ...externalServiceValues(
      sources.n13Page32,
      [2017, 2018, 2019],
      "o/w Government External Debt",
      "PUBLIC DOMESTIC DEBT",
      "mof_public_debt_bulletin_n13",
      "17. NET FLOWS & NET TRANSFERS ON PUBLIC DEBT",
    ),
    ...externalServiceValues(
      sources.n19Page35,
      [2020, 2021, 2022],
      "o/w External Government Debt",
      "DOMESTIC PUBLIC DEBT",
      "mof_public_debt_bulletin_n19",
      "18. NET FLOWS & NET TRANSFERS ON PUBLIC DEBT",
    ),
    ...externalServiceValues(
      sources.n25Page27,
      [2023, 2024, 2025],
      "o/w External Government Debt",
      "DOMESTIC PUBLIC DEBT",
      "mof_public_debt_bulletin_n25",
      "18. Net Flows & Net Transfers on Public Debt",
    ),
  ]);

  return Array.from({ length: 13 }, (_, index) => 2013 + index).flatMap(
    (year) => {
      const domesticValue = domestic.get(year);
      const externalValue = external.get(year);
      if (!domesticValue || !externalValue) {
        throw new Error(`Missing Government Debt service component for ${year}`);
      }
      const totalValue: ServiceValue = {
        principal: Number(
          (domesticValue.principal + externalValue.principal).toFixed(10),
        ),
        interest: Number(
          (domesticValue.interest + externalValue.interest).toFixed(10),
        ),
        sourceId: "mof_public_debt_bulletin_n25",
        sourceTable: "Derived normalized components",
        sourceRowLabel: "Domestic Government Debt + External Government Debt",
      };
      return [
        actualServiceRow(year, "total", totalValue),
        actualServiceRow(year, "domestic", domesticValue),
        actualServiceRow(year, "external", externalValue),
      ];
    },
  );
}

export type DomesticServiceOverlapSourcePages = Pick<
  ActualServiceSourcePages,
  "n7Page32" | "n13Page32" | "n19Page35" | "n25Page27"
>;

function domesticServiceControlRows(
  text: string,
  years: number[],
  startMarker: string,
  endMarker: string,
  sourceId: GovernmentDebtActualServiceControlRow["source_id"],
  sourceTable: string,
  toleranceMillionGel: number,
): GovernmentDebtActualServiceControlRow[] {
  const values = externalServiceValues(
    text,
    years,
    startMarker,
    endMarker,
    sourceId,
    sourceTable,
  );
  return years.map((year) => {
    const value = values.get(year)!;
    return {
      year,
      principal_paid_million_gel: value.principal,
      interest_paid_million_gel: value.interest,
      tolerance_million_gel: toleranceMillionGel,
      source_id: sourceId,
      source_table: sourceTable,
      source_row_label: startMarker,
    };
  });
}

export function parseDomesticServiceOverlapControls(
  sources: DomesticServiceOverlapSourcePages,
): GovernmentDebtActualServiceControlRow[] {
  return [
    ...domesticServiceControlRows(
      sources.n7Page32,
      [2013, 2014, 2015, 2016],
      "PUBLIC DOMESTIC DEBT",
      "o/w Debt to NBG",
      "mof_public_debt_bulletin_n7",
      "17. NET FLOWS & NET TRANSFERS ON PUBLIC DEBT",
      0.5,
    ),
    ...domesticServiceControlRows(
      sources.n13Page32,
      [2017, 2018, 2019],
      "PUBLIC DOMESTIC DEBT",
      "o/w Debt to NBG",
      "mof_public_debt_bulletin_n13",
      "17. NET FLOWS & NET TRANSFERS ON PUBLIC DEBT",
      0.5,
    ),
    ...domesticServiceControlRows(
      sources.n19Page35,
      [2020, 2021, 2022],
      "Domestic Government Debt **",
      "*Exchange rate at day of transaction",
      "mof_public_debt_bulletin_n19",
      "18. NET FLOWS & NET TRANSFERS ON PUBLIC DEBT",
      0.1,
    ),
    ...domesticServiceControlRows(
      sources.n25Page27,
      [2023, 2024, 2025],
      "Domestic Government Debt **",
      "*Exchange rate at day of transaction",
      "mof_public_debt_bulletin_n25",
      "18. Net Flows & Net Transfers on Public Debt",
      0.1,
    ),
  ];
}

export type InterestRateSourcePages = {
  monthlyPage3: string;
  strategy2019Page14: string;
  strategy2022Page23: string;
  strategy2023Page24: string;
  strategy2025Page28: string;
};

type RateEvidence = {
  value: number | null;
  sourceId: GovernmentDebtSourceId;
  sourceTable: string;
  sourceRowLabel: string;
  gapReason?: string;
};

function percentTokens(source: string): number[] {
  return (source.match(/\d+(?:\.\d+)?%/g) ?? []).map(parsePercent);
}

function requirePercentSeries(
  source: string,
  prefix: string,
  expectedCount: number,
): number[] {
  const values = source
    .split(/\r?\n/)
    .map((candidate) => candidate.trim())
    .filter((candidate) => candidate.startsWith(prefix))
    .map((candidate) => percentTokens(candidate.slice(prefix.length)))
    .find((candidate) => candidate.length === expectedCount);
  if (!values) {
    throw new Error(`Expected ${expectedCount} percentage values for ${prefix}`);
  }
  return values;
}

function rateRow(
  year: number,
  debtScope: DebtScope,
  evidence: RateEvidence | undefined,
): GovernmentDebtInterestRateRow {
  const available = evidence?.value !== null && evidence?.value !== undefined;
  const scopeLabel =
    debtScope === "total"
      ? "Total Government Debt portfolio"
      : `${debtScope === "domestic" ? "Domestic" : "External"} Government Debt portfolio`;
  const gapReason =
    debtScope === "external" && year >= 2018 && year <= 2020
      ? "The reviewed component table excludes the Eurobond, so it is not normalized as the full External Government Debt portfolio rate."
      : "No exact comparable year-end component rate was found in the reviewed official sources; no estimate.";
  return {
    year,
    debt_scope: debtScope,
    weighted_average_interest_rate_percent: evidence?.value ?? null,
    observation_date: `${year}-12-31`,
    portfolio_scope: scopeLabel,
    rate_definition: "Year-end weighted-average annual interest rate",
    availability_status: available
      ? "available"
      : "not_found_in_reviewed_sources",
    source_id: evidence?.sourceId ?? "",
    source_table: evidence?.sourceTable ?? "",
    source_row_label: evidence?.sourceRowLabel ?? "",
    source_unit: "% p.a.",
    transformation: available
      ? "Exact published weighted-average portfolio interest rate; no calculation or chart-position digitization."
      : evidence?.gapReason ?? gapReason,
    last_reviewed_at: "2026-09-01",
  };
}

export function parseInterestRateGrid(
  sources: InterestRateSourcePages,
): GovernmentDebtInterestRateRow[] {
  const totalRateBlock = requireCompactBlock(
    sources.monthlyPage3,
    "Debt Redemption Profile",
    "0.0%",
  );
  const totalRateValues = percentTokens(totalRateBlock);
  if (totalRateValues.length !== 12) {
    throw new Error(
      `Expected 12 total Government Debt chart rates; found ${totalRateValues.length}`,
    );
  }

  const domestic2018 = requirePercentSeries(
    sources.strategy2019Page14,
    "Domestic Debt",
    2,
  )[0]!;
  const excludedExternal2018 = requirePercentSeries(
    sources.strategy2019Page14,
    "External Debt",
    2,
  );
  const separateEurobond2018 = requirePercentSeries(
    sources.strategy2019Page14,
    "Eurobond",
    1,
  );
  if (excludedExternal2018.length !== 2 || separateEurobond2018.length !== 1) {
    throw new Error("Missing separate 2018 external-debt and Eurobond rows");
  }
  const domestic2019And2020 = requirePercentSeries(
    sources.strategy2022Page23,
    "Domestic Debt",
    4,
  ).slice(0, 2);
  const excludedExternal2019And2020 = requirePercentSeries(
    sources.strategy2022Page23,
    "External Debt (excludes the Eurobond)",
    4,
  );
  if (excludedExternal2019And2020.length !== 4) {
    throw new Error("Missing explicit Eurobond exclusion in 2019-2020 rates");
  }
  const domestic2021And2022 = requirePercentSeries(
    sources.strategy2023Page24,
    "Domestic Debt",
    4,
  ).slice(0, 2);
  const external2021And2022 = requirePercentSeries(
    sources.strategy2023Page24,
    "External Debt",
    4,
  ).slice(0, 2);
  const strategy2025Percentages = percentTokens(sources.strategy2025Page28);
  const chartAxisStart = strategy2025Percentages.lastIndexOf(0);
  const chartAxis = strategy2025Percentages.slice(
    chartAxisStart,
    chartAxisStart + 5,
  );
  if (chartAxis.join(",") !== "0,2,4,6,8") {
    throw new Error("Missing 2023-2024 rate chart axis sequence");
  }
  const finalEight = strategy2025Percentages.slice(
    chartAxisStart - 8,
    chartAxisStart,
  );
  if (finalEight.length !== 8 || chartAxisStart < 8) {
    throw new Error("Missing 2023-2024 domestic/external rate chart values");
  }

  const totalEvidence = new Map<number, RateEvidence>(
    totalRateValues.slice(0, 11).map((value, index) => [
      2015 + index,
      {
        value,
        sourceId: "mof_monthly_debt_report_2026_07" as const,
        sourceTable: "ATM and Interest Rate",
        sourceRowLabel: "Weighted Average Interest Rate",
      },
    ]),
  );
  const domesticEvidence = new Map<number, RateEvidence>([
    [
      2018,
      {
        value: domestic2018,
        sourceId: "mof_debt_strategy_2019_2021",
        sourceTable:
          "Table 2: Weighted Average Interest Rates on General Government Domestic and External Debt",
        sourceRowLabel: "Domestic Debt",
      },
    ],
    ...domestic2019And2020.map(
      (value, index) =>
        [
          2019 + index,
          {
            value,
            sourceId: "mof_debt_strategy_2022_2025" as const,
            sourceTable:
              "Table 4.1: Weighted Average Interest Rates on the General Government Domestic and External Debt Portfolios",
            sourceRowLabel: "Domestic Debt",
          },
        ] as const,
    ),
    ...domestic2021And2022.map(
      (value, index) =>
        [
          2021 + index,
          {
            value,
            sourceId: "mof_debt_strategy_2023_2026" as const,
            sourceTable:
              "Table 4.1: Weighted Average Interest Rates on the General Government Domestic and External Debt Portfolios",
            sourceRowLabel: "Domestic Debt",
          },
        ] as const,
    ),
    [
      2023,
      {
        value: finalEight[0]!,
        sourceId: "mof_debt_strategy_2025_2029",
        sourceTable:
          "Weighted Average Interest Rates on the Government's Domestic and External Debt Portfolio",
        sourceRowLabel: "Domestic Debt - portfolio",
      },
    ],
    [
      2024,
      {
        value: finalEight[1]!,
        sourceId: "mof_debt_strategy_2025_2029",
        sourceTable:
          "Weighted Average Interest Rates on the Government's Domestic and External Debt Portfolio",
        sourceRowLabel: "Domestic Debt - portfolio",
      },
    ],
  ]);
  const externalEvidence = new Map<number, RateEvidence>([
    ...external2021And2022.map(
      (value, index) =>
        [
          2021 + index,
          {
            value,
            sourceId: "mof_debt_strategy_2023_2026" as const,
            sourceTable:
              "Table 4.1: Weighted Average Interest Rates on the General Government Domestic and External Debt Portfolios",
            sourceRowLabel: "External Debt",
          },
        ] as const,
    ),
    [
      2023,
      {
        value: finalEight[4]!,
        sourceId: "mof_debt_strategy_2025_2029",
        sourceTable:
          "Weighted Average Interest Rates on the Government's Domestic and External Debt Portfolio",
        sourceRowLabel: "External Debt - portfolio",
      },
    ],
    [
      2024,
      {
        value: finalEight[5]!,
        sourceId: "mof_debt_strategy_2025_2029",
        sourceTable:
          "Weighted Average Interest Rates on the Government's Domestic and External Debt Portfolio",
        sourceRowLabel: "External Debt - portfolio",
      },
    ],
  ]);
  const excludedExternalEvidence = new Map<number, RateEvidence>([
    [
      2018,
      {
        value: null,
        sourceId: "mof_debt_strategy_2019_2021",
        sourceTable:
          "Table 2: Weighted Average Interest Rates on General Government Domestic and External Debt",
        sourceRowLabel: "External Debt / Eurobond",
        gapReason:
          "The reviewed component table reports External Debt and Eurobond separately, so the External Debt row is not normalized as the full External Government Debt portfolio rate.",
      },
    ],
    ...[2019, 2020].map(
      (year) =>
        [
          year,
          {
            value: null,
            sourceId: "mof_debt_strategy_2022_2025" as const,
            sourceTable:
              "Table 4.1: Weighted Average Interest Rates on the General Government Domestic and External Debt Portfolios",
            sourceRowLabel: "External Debt (excludes the Eurobond)",
            gapReason:
              "The reviewed component table excludes the Eurobond, so it is not normalized as the full External Government Debt portfolio rate.",
          },
        ] as const,
    ),
  ]);

  return Array.from({ length: 11 }, (_, index) => 2015 + index).flatMap(
    (year) => [
      rateRow(year, "total", totalEvidence.get(year)),
      rateRow(year, "domestic", domesticEvidence.get(year)),
      rateRow(
        year,
        "external",
        externalEvidence.get(year) ?? excludedExternalEvidence.get(year),
      ),
    ],
  );
}

export type ForecastSourcePages = {
  n25Page7: string;
  n25Page17: string;
  n25Page22: string;
  n25Page24: string;
};

function externalForecastSeries(
  page17: string,
  sectionStart: string,
  sectionEnd: string,
): number[] {
  const section = requireCompactBlock(page17, sectionStart, sectionEnd);
  const values = englishNumberTokens(
    requireCompactBlock(
      section,
      "Government External Debt",
      "External Debt",
    ),
  );
  if (values.length !== 29) {
    throw new Error(
      `Expected 29 Government External Debt forecast values in ${sectionStart}; found ${values.length}`,
    );
  }
  return values.slice(1, 6);
}

function domesticPrincipalByYear(page24: string): Map<number, number> {
  const totals = new Map<number, number>();
  for (const rawLine of page24.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!/^\*?\s*GET[CD]/.test(line)) continue;
    const dates = line.match(/\d{2}\/\d{2}\/\d{4}/g) ?? [];
    const issuedAmount = line.match(
      /(\d{1,3}(?:,\d{3})*\.\d{2})\s+(?:Non-Benchmark|Benchmark)/,
    )?.[1];
    if (dates.length < 2 || !issuedAmount) {
      throw new Error(`Unable to parse Treasury security row: ${line}`);
    }
    const redemptionYear = Number(dates[1]!.slice(-4));
    if (redemptionYear < 2026 || redemptionYear > 2030) continue;
    const amountMillionGel = parseEnglishAmount(issuedAmount) / 1_000_000;
    totals.set(
      redemptionYear,
      Number(((totals.get(redemptionYear) ?? 0) + amountMillionGel).toFixed(10)),
    );
  }
  for (let year = 2026; year <= 2030; year += 1) {
    if (!totals.has(year)) {
      throw new Error(`Missing Treasury-security principal for ${year}`);
    }
  }
  return totals;
}

function domesticServiceByYear(page22: string): Map<number, number> {
  const compact = page22.replace(/\s+/g, " ");
  const marker = "Actual Projection";
  const start = compact.indexOf(marker);
  if (start < 0) throw new Error(`Missing source block: ${marker}`);
  const values = englishNumberTokens(compact.slice(start + marker.length));
  if (values.length < 12) {
    throw new Error(`Expected 12 Treasury-service values; found ${values.length}`);
  }
  return new Map(
    values.slice(0, 12).map((value, index) => [2025 + index, value]),
  );
}

function forecastRow(
  paymentYear: number,
  debtScope: DebtScope,
  principalSourceAmount: number,
  interestSourceAmount: number,
  sourceCurrency: "GEL" | "USD",
  publishedExchangeRate: number,
  exchangeRateToGel: number,
  publishedTotalService?: number,
): GovernmentDebtForecastRow {
  const principalMillionGel = Number(
    (principalSourceAmount * exchangeRateToGel).toFixed(10),
  );
  const interestMillionGel = Number(
    (interestSourceAmount * exchangeRateToGel).toFixed(10),
  );
  const isExternal = debtScope === "external";
  const isDomestic = debtScope === "domestic";
  return {
    snapshot_date: "2025-12-31",
    payment_year: paymentYear,
    debt_scope: debtScope,
    principal_source_amount: principalSourceAmount,
    interest_source_amount: interestSourceAmount,
    source_currency: sourceCurrency,
    published_exchange_rate: publishedExchangeRate,
    published_exchange_rate_definition: isExternal
      ? "1 GEL = 0.3710 USD at 2025-12-31"
      : "1 GEL = 1 GEL",
    source_exchange_rate_to_gel: exchangeRateToGel,
    principal_million_gel: principalMillionGel,
    interest_million_gel: interestMillionGel,
    total_service_million_gel:
      publishedTotalService ??
      Number((principalMillionGel + interestMillionGel).toFixed(10)),
    status: "projection_existing_portfolio",
    coverage_note:
      "Existing portfolio as of 2025-12-31. External covers External Government Debt; domestic covers the published Treasury-securities schedule. Future borrowing, refinancing, FX changes, variable-rate changes, and unscheduled domestic loan debt are excluded.",
    source_id: "mof_public_debt_bulletin_n25",
    source_table: isExternal
      ? "10. Projected External Public Debt Service (based on stock 31.12.2025)"
      : isDomestic
        ? "15. Treasury Securities Portfolio + 26. T-Bills/T-Bonds Service"
        : "Derived normalized forecast components",
    source_row_label: isExternal
      ? "Government External Debt"
      : isDomestic
        ? "Treasury-security principal + derived interest"
        : "Domestic + external Government Debt schedule",
    transformation: isExternal
      ? "Published USD principal and interest multiplied by the reciprocal of the published 2025-12-31 GEL/USD rate."
      : isDomestic
        ? "Principal is the sum of issued amounts by redemption year; interest is published total service less principal, rounded to the service chart's one-decimal precision."
        : "Exact sum of the GEL-normalized domestic and external forecast component rows.",
    last_reviewed_at: "2026-09-01",
  };
}

export function parseDebtServiceForecast(
  sources: ForecastSourcePages,
): GovernmentDebtForecastRow[] {
  const gelRates = exactSeries(sources.n25Page7, "GEL", 10);
  const publishedGelPerUsd = gelRates.at(-1)!;
  if (publishedGelPerUsd !== 0.371) {
    throw new Error(`Unexpected 2025-12-31 GEL/USD rate: ${publishedGelPerUsd}`);
  }
  const usdToGel = 1 / publishedGelPerUsd;
  const externalPrincipal = externalForecastSeries(
    sources.n25Page17,
    "PRINCIPAL PAYMENTS",
    "INTERST PAYMENTS",
  );
  const externalInterest = externalForecastSeries(
    sources.n25Page17,
    "INTERST PAYMENTS",
    "Exchange rates of all debt portfolio currencies vis-a-vis USD as of 31.12.2025",
  );
  const domesticPrincipal = domesticPrincipalByYear(sources.n25Page24);
  const domesticService = domesticServiceByYear(sources.n25Page22);

  return Array.from({ length: 5 }, (_, index) => 2026 + index).flatMap(
    (year, index) => {
      const principal = domesticPrincipal.get(year)!;
      const service = domesticService.get(year)!;
      const interest = Number((service - principal).toFixed(1));
      const domesticRow = forecastRow(
        year,
        "domestic",
        principal,
        interest,
        "GEL",
        1,
        1,
        service,
      );
      const externalRow = forecastRow(
        year,
        "external",
        externalPrincipal[index]!,
        externalInterest[index]!,
        "USD",
        publishedGelPerUsd,
        usdToGel,
      );
      const totalRow = forecastRow(
        year,
        "total",
        Number(
          (
            domesticRow.principal_million_gel +
            externalRow.principal_million_gel
          ).toFixed(10),
        ),
        Number(
          (
            domesticRow.interest_million_gel +
            externalRow.interest_million_gel
          ).toFixed(10),
        ),
        "GEL",
        1,
        1,
        Number(
          (
            domesticRow.total_service_million_gel +
            externalRow.total_service_million_gel
          ).toFixed(10),
        ),
      );
      return [totalRow, domesticRow, externalRow];
    },
  );
}

function controlCell(sheet: XLSX.WorkSheet, address: string): number {
  const value = sheet[address]?.v;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Missing numeric control cell Sheet2!${address}`);
  }
  return Number(value.toFixed(10));
}

export function readControlWorkbookValues(
  filePath: string,
): ControlYearComparison[] {
  const workbook = XLSX.read(readFileSync(filePath), {
    type: "buffer",
    cellDates: false,
  });
  const sheet = workbook.Sheets.Sheet2;
  if (!sheet) throw new Error("Missing control workbook sheet Sheet2");
  return [
    {
      year: 2019,
      total_million_gel: controlCell(sheet, "AX6"),
      domestic_million_gel: controlCell(sheet, "AX9"),
      external_million_gel: controlCell(sheet, "AX15"),
      source_cells: "Sheet2!AX6/AX9/AX15",
    },
    {
      year: 2022,
      total_million_gel: controlCell(sheet, "BJ6"),
      domestic_million_gel: controlCell(sheet, "BJ9"),
      external_million_gel: controlCell(sheet, "BJ15"),
      source_cells: "Sheet2!BJ6/BJ9/BJ15",
    },
  ];
}

export function parsePublishedGovernmentDebtGdpRatios(
  n25Page28: string,
): Map<number, number> {
  const values = requirePercentSeries(
    n25Page28,
    "Government Debt to GDP (SNA-2008)***",
    13,
  );
  return new Map(values.map((value, index) => [2013 + index, value]));
}

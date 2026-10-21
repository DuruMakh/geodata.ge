/** The 16 served series, in the page's list order: the tax-break total, its VAT and income parts, then refunds. */
export const TAX_BREAKS_REFUNDS_INDICATORS = [
  "tax_breaks.total",
  "tax_breaks.vat.total", "tax_breaks.vat.education", "tax_breaks.vat.health", "tax_breaks.vat.child_care", "tax_breaks.vat.gambling",
  "tax_breaks.vat.vehicles", "tax_breaks.vat.agriculture", "tax_breaks.vat.medicines", "tax_breaks.vat.other",
  "tax_breaks.income.total", "tax_breaks.income.personal", "tax_breaks.income.profit", "tax_breaks.income.old_profit", "tax_breaks.income.other",
  "tax_refunds.total",
] as const;
export type TaxBreaksRefundsIndicator = (typeof TAX_BREAKS_REFUNDS_INDICATORS)[number];
/** The Ministry's Georgian workbook and the Treasury chart data: the two files the observations are read from. */
export const TAX_BREAKS_REFUNDS_SOURCES = ["mof_tax_expenditure_report_2024_xlsx_ka", "treasury_tax_refunds_chart"] as const;
/** Every archived source: the served two plus the Ministry's English workbook and both PDF reports. */
export const TAX_BREAKS_REFUNDS_PUBLIC_SOURCES = [
  ...TAX_BREAKS_REFUNDS_SOURCES, "mof_tax_expenditure_report_2024_xlsx_en", "mof_tax_expenditure_report_2024_pdf_ka", "mof_tax_expenditure_report_2024_pdf_en",
] as const;
export const TAX_BREAKS_REFUNDS_PACKAGE = "docs/Raw Data/Revenue/tax-breaks-refunds";
export const TAX_BREAKS_REFUNDS_CSV_PATH = "data/imports/tax-breaks-refunds-annual.csv";
export const TAX_BREAKS_REFUNDS_REPORT_PATH = "data/reports/tax-breaks-refunds-validation.json";

export type TaxBreaksRefundsFact = {
  year: number;
  indicatorId: TaxBreaksRefundsIndicator;
  /** Exact decimal: the stored workbook token or the Treasury's printed figure, in million GEL. */
  value: string;
  /** The value rounded half-up to two decimals. */
  publishedValue: string;
  unit: "gel_million";
  basis: "actual";
  valueStatus: "official";
  sourceId: string;
  /** The sheet name, or `newChart.xml` for the Treasury. */
  sourceSheet: string;
  /** The cell address, or `series[0]/row[N]` (1-based) for the Treasury. */
  sourceCell: string;
  lastReviewedAt: string;
};
export type ClientTaxBreaksRefundsFact = Pick<TaxBreaksRefundsFact, "year" | "indicatorId" | "sourceId"> & { value: number; unit: "gel" };
export type TaxBreaksRefundsAcceptance = {
  status: "passed";
  years: { min: number; max: number };
  observations: number;
  canonicalSha256: string;
  reviewedAt: string;
};
export function taxBreaksRefundsFactKey(fact: Pick<TaxBreaksRefundsFact, "indicatorId" | "year">): string {
  return `${fact.indicatorId}:${fact.year}`;
}
export function taxBreaksRefundsSourceDocumentId(sourceId: string): string {
  return `source.${sourceId}`;
}

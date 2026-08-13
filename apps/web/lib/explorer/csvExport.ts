import { csvEscape } from "../data/csvEscape";
import type { ExplorerTableRow, GdpMetadata } from "./types";

const baseHeaders = [
  "year",
  "category_id",
  "parent_item_id",
  "level",
  "detail_label",
  "official_institution_label",
  "ka_label",
  "en_label",
  "amount_gel",
  "basis",
  "source_name",
  "source_url_or_file",
  "last_reviewed_at",
];

const gdpHeaders = [
  "gdp_current_prices_gel",
  "gdp_accounting_standard",
  "gdp_status",
  "gdp_source_name",
  "gdp_source_url_or_file",
  "gdp_last_reviewed_at",
  "share_of_gdp",
];

export function buildExplorerCsv(
  rows: ExplorerTableRow[],
  years: number[],
  gdpByYear?: Record<number, GdpMetadata>,
): string {
  const headers = gdpByYear === undefined ? baseHeaders : [...baseHeaders, ...gdpHeaders];
  const csvRows = [headers.join(",")];

  for (const row of rows) {
    for (const year of years) {
      const amount = row.valuesByYear[year];
      const source = row.sourceByYear[year];
      const basis = row.basisByYear[year];
      const gdp = gdpByYear?.[year];

      if (amount === null || amount === undefined || !source || !basis) continue;

      csvRows.push(
        [
          year,
          row.itemId,
          row.parentItemId ?? "",
          row.level,
          row.detailLabel ?? "",
          row.officialInstitutionLabelByYear?.[year] ?? "",
          row.kaLabel,
          row.enLabel,
          amount,
          basis,
          source.sourceName,
          source.sourceUrlOrFile,
          source.lastReviewedAt,
          ...(gdpByYear === undefined
            ? []
            : [
                gdp?.gdpCurrentPricesGel ?? "",
                gdp?.accountingStandard ?? "",
                gdp?.status ?? "",
                gdp?.source.sourceName ?? "",
                gdp?.source.sourceUrlOrFile ?? "",
                gdp?.source.lastReviewedAt ?? "",
                row.shareByYear?.[year] ?? "",
              ]),
        ]
          .map(csvEscape)
          .join(","),
      );
    }
  }

  return `\uFEFF${csvRows.join("\n")}`;
}

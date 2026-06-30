import type { ExplorerTableRow } from "./types";

const headers = [
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

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

export function buildExplorerCsv(rows: ExplorerTableRow[], years: number[]): string {
  const csvRows = [headers.join(",")];

  for (const row of rows) {
    for (const year of years) {
      const amount = row.valuesByYear[year];
      const source = row.sourceByYear[year];
      const basis = row.basisByYear[year];

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
        ]
          .map(csvCell)
          .join(","),
      );
    }
  }

  return csvRows.join("\n");
}

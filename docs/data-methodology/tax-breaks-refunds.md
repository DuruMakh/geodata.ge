# Tax breaks and refunds

Status: served at `/explorer/tax-breaks-refunds` (Budget hub). Design: `docs/superpowers/specs/2026-10-21-tax-breaks-refunds-design.md`.

## Scope and sources

Two different things on one page. They must never be added together.

- **Tax breaks** (the Ministry of Finance's term is "საგადასახადო დანახარჯები", tax expenditures): tax revenue the state gives up through exemptions, zero rates and special regimes, as estimated by the Ministry. The source is the Tax Expenditure Report, 2024 edition, which covers 2018–2024. The Georgian workbook `TER graphs GEO 2024.xlsx` is served. The English workbook and both PDF reports are archived but not served.
- **Tax refunds** ("საგადასახადო ზედმეტობების დაბრუნება"): overpaid tax, mostly VAT, that the State Treasury pays back. The source is the Treasury's chart data `newChart.xml`, captured on 2026-10-21. It covers 2007–2025 plus a year-to-date column ("09.2026").

The originals, their URLs, SHA-256 hashes, byte sizes and the reviewed cell mapping are in `docs/Raw Data/Revenue/tax-breaks-refunds/source-manifest.json`.

Why these choices:

- **Georgian workbook only.** The English workbook's "Figure 1" income row is out of date and does not add up to the total (2023: 406.1 against 432.1). The Georgian workbook and both PDFs agree.
- **Latest edition only.** Each edition revises earlier years. For example, VAT breaks for 2018 were 2,376.3 million in the 2023 edition and are 2,229.8 million in the 2024 edition.
- **Refunds start in 2008.** The Treasury lists 1 million GEL for 2007, which looks like an incomplete first year. It stays in the archived XML but is not served.
- **No 2026.** The year-to-date column is not read, because the site shows whole years only.

## Series and cell map

All values are in million GEL, read as the cell's stored number text. Year columns run 2018–2024 left to right.

| Series | Sheet | Row (label column) | Columns |
| --- | --- | --- | --- |
| `tax_breaks.total` | Figure 1 | 7 "სულ საგადასახადო დანახარჯები" (B) | C–I |
| `tax_breaks.vat.total` | Figure 1 | 6 "დღგ" | C–I |
| `tax_breaks.income.total` | Figure 1 | 5 "საშემოსავლო და მოგების გადასახადი" | C–I |
| `tax_breaks.vat.child_care` / `education` / `gambling` / `health` / `vehicles` | Table 4 | 11 / 12 / 13 / 14 / 15 (H), "A. Exempt" | J–P |
| `tax_breaks.vat.agriculture` / `medicines` | Table 4 | 19 / 20, "B. Zero-rated" | J–P |
| `tax_breaks.vat.other` | Table 4 | 24 "C. სხვა სექტორები" (the residual) | J–P |
| `tax_breaks.income.personal` | Table 3 | 22, personal income sub-total excluding memorandum items (G) | I–O |
| `tax_breaks.income.profit` | Table 3 | 26, II.A distributed profit tax | I–O |
| `tax_breaks.income.old_profit` | Table 3 | 43, II.B old corporate income tax regime | I–O |
| `tax_breaks.income.other` | Table 3 | 65, III other (small-business status, full deduction of assets) | I–O |
| `tax_refunds.total` | newChart.xml | `series[0]/row[2..19]` = 2008–2025 | — |

Notes on the source figures:

- The Ministry estimates each sector's VAT break one at a time, "other things equal". "Other sectors" is the remainder, so the rows add up to the VAT total.
- Memorandum items (foreign income of residents; tourist-zone enterprises) are excluded, because the Ministry excludes them from its totals.
- The Ministry's own note says VAT revenue is counted net of VAT refunds ("დღგ-ს შემოსავლები დათვლილია დღგ-ს დაბრუნებების გამორიცხვით").
- Known quirk: "Full deduction of assets" (Table 3, row 61) for 2024 repeats the 2018 figure exactly (9.41 million; personal 2.38, corporate 7.03). It sits inside `tax_breaks.income.other` and is served as published.

## Share of GDP

The page divides each amount by the same year's GDP from the site's national GDP file (`data/imports/national-gdp-annual-1996-2025.csv`), as the Revenue, Debt and Money pages do. This happens in the browser, so no share is stored. The Ministry printed 7.0% for total tax breaks in 2024 because it used GDP from before Geostat's revision. The site's figure is 6.9%. 2025 GDP is preliminary, and the page says so.

## Checks (the preparation fails otherwise)

- Every original's hash and size are checked before any parsing.
- Sheet names, row labels and year headers must match the manifest.
- The Treasury categories must be exactly 2007–2025 plus one `MM.YYYY` column, under one series with the Georgian label above.
- Each year from 2018 to 2024, within 0.01 million GEL:
  - VAT + income and profit = total;
  - the eight VAT rows = the VAT total;
  - the four income rows = the income total;
  - Table 4's grand total (row 26) and Table 3's grand total (row 67) equal the Figure 1 rows.
- Served rows: known ids, one row per series and year, complete coverage (tax breaks 2018–2024, refunds 2008–2025), non-negative values, and a published value equal to the value rounded to two decimals (`lib/data/taxBreaksRefunds/validation.ts`).

## Outputs and reproduction

- `data/imports/tax-breaks-refunds-annual.csv`: 123 rows (105 tax-break rows, 18 refund rows), UTF-8 with BOM, with the Money columns.
- `data/reports/tax-breaks-refunds-validation.json`: row count, years and the CSV's SHA-256.

From `apps/web`, `npm run data:prepare-tax-breaks-refunds` writes both files. `npm run data:check-tax-breaks-refunds` (part of `data:validate`) regenerates them in memory and fails on any byte difference.

Refresh:

- **Treasury:** the XML is rewritten every month, so save a new dated copy, update the manifest's file, hash, size and `fullYears`, and review the diff.
- **Ministry:** when a new edition appears, replace all four report files and re-check every row label and column, because each edition revises earlier years.

## Serving

The mirror table `TaxBreaksRefundsFact` holds the same 123 rows and is compared field by field inside the import transaction. The page is browse-only: it has no `/mcp` tool and no central JSON/CSV file.

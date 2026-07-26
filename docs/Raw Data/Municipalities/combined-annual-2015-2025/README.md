# Municipal annual expenditure data, 2015-2025

This folder contains the prepared municipality-level annual research dataset. It is not yet imported into the GeoData.ge application or serving database.

For normal review in Microsoft Excel, open `municipal-functional-annual-2015-2025.xlsx`. It contains four sheets:

- `Read me`
- `Main functions`
- `Selected details`
- `Total payments`

Use `municipal-total-payments-annual-2015-2025.csv` for the single annual headline value shown to the public. The `public_total_gel` field is the selected public measure.

Use `municipal-functional-main-annual-2015-2025.csv` for the ten comparable functional categories. Use `municipal-functional-selected-detail-annual-2015-2025.csv` for the six selected details available across the full period.

Do not add total-payment rows to functional rows. Do not sum `main` and `selected_detail` rows together because each selected detail is already included in its parent main function.

All Excel-facing CSV files use UTF-8 with BOM so that Windows Excel detects Georgian text correctly when opened by double-clicking.

Provenance is recorded in `source-manifest.csv` and in the 69-workbook manifest under `../mof-municipality-budget-history-2016-2025/`. Machine-readable checks are in `validation-report.json`.

Canonical methodology:

`docs/data-methodology/municipal-functional-annual-2015-2025.md`

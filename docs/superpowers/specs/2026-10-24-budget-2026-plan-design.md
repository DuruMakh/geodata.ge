# 2026 state budget plan on the Spending pages

Date: 2026-10-24
Status: Design agreed with Duru on 2026-10-24 (decision cards "Which Budget pages should show the 2026 plan?" → "Spending pages only", 19:26 Tbilisi; "Should the headline number show the 2026 plan or 2025 actual?" → "Show the 2026 plan, marked", 19:33 Tbilisi). Duru asked for "the latest 2026 budget plan" on the site (19:10 Tbilisi).

## 1. Intended result

Readers of the Spending pages see what the state plans to spend in 2026, next to the 2004–2025 results, in the two existing views: by spending area (health, education…) and by ministry. The one-year Analysis view can show 2026 too. 2026 is visibly a plan everywhere: hollow chart point, "plan" mark in the table and the Excel workbook, and a plan mark on the headline line and the Budget/home cards.

When the real 2026 results are imported (early 2027), the existing actual-over-planned rule replaces the plan with no code change. When Parliament amends the 2026 budget, the planned rows are regenerated from the amended law (§8).

Out of scope (Duru's choice): Revenue, Spending by type, Municipalities, Debt and Deficit stay as they are. The Revenue page shows the consolidated (state + municipal) budget and the law covers the state budget only, so it would need a separate merge of local budgets.

## 2. Source (checked 2026-10-24)

The latest official plan is the **Law of Georgia on the 2026 State Budget** (№1219-IVმს-XIმპ, adopted 10/12/2025, published 19/12/2025, in force 01/01/2026, matsne document 6701007). It has **not been amended**: matsne shows no consolidated versions, and the Ministry of Finance budget page lists only the original law. The Ministry announced a planned amendment in early September 2026 (bm.ge, 3 Sept 2026); none has been submitted or adopted as of this date.

Files (Ministry of Finance, https://mof.ge/ka/govbudget?year=2026, the "საქართველოს 2026 წლის სახელმწიფო ბიუჯეტის კანონი" block), archived with SHA-256 under `docs/Raw Data/Expenditure/mof.ge/budget-law-2026/`:

| Chapter | Content used | Format |
| --- | --- | --- |
| თავი I | Article 2 payments total (გადასახდელები) 30,881,358.0 thousand GEL, used as the reconciliation total | .DOC |
| თავი III | Article 9: functional classification of expenses + non-financial assets growth (COFOG codes 7.x), 27,311,597.0 thousand GEL | .DOC |
| თავი VI | Article 16: appropriations by institution / programme / sub-programme, with expenses, non-financial assets growth, financial assets growth and liabilities decrease lines | .DOCX |

Both `.DOC` chapters are converted once to `.docx` with LibreOffice (`soffice --headless --convert-to docx`); the converted files are generated intermediates under `data/staging/`, recorded with the source hash, never treated as raw.

The perimeter is the same as the live Spending pages: the site's 2024 spending total (25,946,342.9 thousand GEL) equals the law's own "2024 წლის ფაქტი" payments total, and the ministries total equals the spending total in every year.

## 3. How the 2026 numbers are made (reuse first)

The 2026 plan uses the same two-source method as the 2025 actuals (`docs/data-methodology/2025-expenditure-final-methodology.md`), with the law in place of the Treasury E11 PDF and the execution workbook:

- **Spending by area** = Article 9 functional rows mapped by `generateCompactPdfSpendingMappings` (unchanged COFOG→field rules) + financial assets growth and liabilities decrease taken from the Tavi VI programme rows by `extractFinancialAssetAndLiabilitySupplements` with the reviewed code/label mappings. Composition by `composeFinalExpenditureFacts`, which gains an optional `basis` (default `actual`, so every existing year is byte-identical).
- **Spending by ministry** = Tavi VI rows through `generateAdminSpendingFacts` (categories + major programmes ≥ 100 m GEL), basis `planned`.

| Reused as is | Small additive change | New |
| --- | --- | --- |
| COFOG→field mapping, supplement extraction, reconciliation, admin category/programme generation, `chooseActivePublicFacts`, chart/table/workbook plan marks, landing `planned`/`mixed` status, fact-query `planned_values` caveat, DB `basis` column | `composeFinalExpenditureFacts` optional `basis`; admin classification rules for the 2026 institution names; programme successions for renumbered 2026 codes; headline line plan mark | A small `.docx` table reader (fflate, already a dependency) that turns the law tables into the existing row shapes; the 2026 plan generator script; the planned CSVs |

No docx reader exists in the repo (the pipelines read `.xlsx` and `.pdf`); converting the law to PDF and reusing the Treasury PDF parsers was rejected because the law's column layout (2024 fact / 2025 plan / 2026 plan / budget funds / donor funds) differs from the Treasury forms.

### 3.1 2026 ministry restructuring

The 2026 law renumbers and splits institutions: `25 00` is now the Ministry of Infrastructure, `35 00` the new Ministry of Regional Development, `54 00` the general state payments (was `57 00`; `57 00` is now the Civil Service Bureau). Without changes both infrastructure ministries would fall into Other costs and the debt-service and transfer programmes would start new series. The plan therefore:

- routes "ინფრასტრუქტურის სამინისტრო" and "რეგიონული განვითარების სამინისტრო" to Regional development and infrastructure (verified no-op for 2004–2025);
- adds programme successions so 2026 programmes that continue a 2025 programme under a new code join its series (e.g. `57 01` → `54 01` external debt service); each succession is checked by label and amount scale and listed in the methodology doc.

## 4. Data files

- `data/imports/expenditure-facts-2026-planned.csv`: 13 field rows, basis `planned`, source `source.mof_2026_budget_law_planned`.
- 2026 planned rows appended by the admin generator to `data/imports/admin-spending-facts-2004-2025.csv`.
- `budget-facts-2004-2025.csv` / `expenditure-facts-2004-2025.csv` are composed with the planned rows appended.
- The three combined file names keep "2004-2025": renaming them touches the importer, the DB parity check, publications and tests for no reader benefit. Their year range is read from the rows, not the name.
- Source registry, source archive manifest and methodology doc updated; validation report written to `data/reports/`.

## 5. What the pages show

- **Spending page, by area and by ministry:** year range ends at 2026; 2026 is a hollow point, the table cell carries the plan mark, the Excel workbook marks 2026 "planned". Share-of-GDP has no 2026 point (no 2026 GDP yet), which the chart already shows as a gap.
- **Headline line:** `2026 გეგმა: სულ 30.9 მლრდ ₾ +11.4%` / `2026 plan: Total 30.9 bn GEL +11.4%`. It must stay one line at 375 px in both languages (DESIGN.md §17). The year-on-year change compares the 2026 plan with 2025 actual.
- **Analysis (one year):** 2026 is selectable on the expenditure side and labelled "Planned budget data" (existing message).
- **Budget hub card and home page:** the existing `planned`/`mixed` status shows the plan mark. The homepage redesign thread is told about the plan year so its new cards keep the mark.
- **/mcp and JSON/CSV publications:** planned rows appear with `basis = planned`; the existing `planned_values` caveat applies.

## 6. Validation (stop conditions)

1. Spending by area 2026 total = 30,881,358.0 thousand GEL (law Article 2 payments) within 1,000 GEL; functional part = Article 9 total; supplements = Tavi I financial assets growth (650,000.0) + liabilities decrease (2,919,761.0).
2. Ministries 2026 total = the same 30,881,358.0 thousand GEL; Tavi VI grand total "00 00" matches.
3. Cross-check: the law's own "2024 წლის ფაქტი" Article 9 column, mapped with the same rules, matches the shipped 2024 functional facts (method check, not shipped).
4. Every Tavi VI leaf row is counted exactly once; uncertain rows go to `spending.other_unclassified` with notes.
5. Existing 2004–2025 rows unchanged (diff of composed CSVs shows only added 2026 rows).
6. Reference fixture `tests/factQuery/reference.test.ts` passes unchanged; any disagreement is reported, not edited.

## 7. Testing

Unit tests for the docx table reader (fixture from the real law), the 2026 generator totals, the new admin classification rules (2004–2025 unchanged), and the headline plan mark; existing browser specs for the Spending page updated for the 2026 year; one browser assertion that the 2026 headline line fits on one line at 375 px in both languages.

## 8. When the law is amended

Download the amended chapters, archive them with new hashes and a new source id (`source.mof_2026_budget_law_amended_<date>_planned`), re-run the 2026 generator, and update the methodology doc. Only 2026 planned rows change.

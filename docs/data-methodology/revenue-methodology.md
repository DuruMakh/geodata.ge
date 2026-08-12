# Consolidated Revenue — Full Methodology (2005–2025)

**Status:** authoritative reference for the *revenue* (receipts) dataset — the revenue side of the
explorer. Covers what the data is, where each year comes from, how it is parsed, every mapping
decision with its rationale, the validation gates, and how the facts are promoted into
`data/imports/revenue-facts-2005-2025.csv`. Where this document disagrees with the code,
**the code is authoritative** (`apps/web/lib/data/realRevenue/*.ts`).

Last reviewed: 2026-07-13 (authored from the pipeline code and the shipped data during the July
2026 documentation audit; the shipped CSV was independently re-validated against the 21 source
PDFs in the 2026-07 data review, and the one defect found — a stale 2013 staging file — was fixed
by regenerating staging).

---

## 1. What this dataset is

GeoData.ge's revenue side shows Georgia's **consolidated budget receipts** (ნაერთი ბიუჯეტის
შემოსულობები) by top-level revenue category, annually for **2005–2025** (21 years), always on the
**actual** (cash-executed) basis. Planned figures are parsed where the source carries them but are
never published.

Each year carries exactly **11 facts** (21 × 11 = 231 rows in the CSV): seven tax categories,
grants, other revenue, and two financing-receipt categories (decrease in assets, increase in
liabilities). Summed, the 11 facts equal the official **final receipts** of the consolidated
budget for that year — receipts run from **≈ 3.29 B GEL (2005) to ≈ 32.37 B GEL (2025)**.

Two perimeter choices define the dataset (both detailed in §6):

1. **Consolidated budget, not state budget.** Every amount is the *consolidated* column of the
   source form — state budget plus territorial-unit budgets. (The expenditure datasets measure
   the *state* budget; see §9.1.)
2. **Net of internal flows.** Grants and other revenue are published net of the
   transfers-between-government-levels rows, so consolidation does not double-count money that
   merely moved between budget levels.

---

## 2. Source data & collection

### 2.1 One source family: Treasury "Form #1" receipts statements

Every year 2005–2025 is extracted from the same official document type: the State Treasury's
**Form #1** (ფორმა #1) January–December consolidated-budget receipts statement — a per-code table
titled "საქართველოს კონსოლიდირებული ბიუჯეტის შემოსავლები/შემოსულობები" with three amount columns
per row: **state budget, territorial-unit budgets, and total (consolidated)**. All 21 PDFs are
committed under `docs/Raw Data/Revenue/<year>-jan-dec-consolidated-revenue.pdf`.

The source list is generated, not hand-maintained: `realRevenuePdfSources` in
`apps/web/lib/data/realRevenue/extractWorkbooks.ts` maps `REVENUE_YEARS` (2005–2025, from
`lib/data/coverage.ts`; `REVENUE_START_YEAR = 2005`, end pinned to `APP_END_YEAR`) onto that fixed
path pattern and the source ID pattern `source.mof_<year>_revenue_form1_pdf`.

**Reviewed text sidecars.** Four years — **2005, 2006, 2007, 2015** — do not use live `pdf-parse`
text. For them a reviewed text export is committed under `docs/Raw Data/Revenue/text/…` and read
instead (`textPath` in the source entry). All other years are text-extracted from the PDF at run
time. The sidecar mechanism is locked by a test ("uses the reviewed text sidecar for 2005 revenue
extraction", `tests/data/realRevenue/extractWorkbooks.test.ts`).

**Registry.** All 21 PDFs are registered in `data/sources/source-documents.csv`
(review dates: 2005–2016 on 2026-06-28, 2017–2022 on 2026-06-09, 2023–2025 on 2026-05-13), and
`tests/data/sourceCoverage.test.ts` asserts every `REVENUE_SOURCE_YEARS` PDF exists on disk — and
that a 2004 PDF deliberately does **not** (§5.6). All 21 PDFs are also listed in
`data/methodology/source-archives/revenue.csv` with byte size and SHA-256, and archive generation
revalidates those current repository bytes. This publication registry was created from the
committed originals in 2026, so it is not contemporaneous proof of the bytes retrieved on the
earlier review dates (§9.6).

### 2.2 Secondary sources: tavi-1 workbook cross-checks (2023–2025)

`realRevenueSources` (same file) lists three MoF **Excel** sources whose "tavi 1" / balance sheet
carries the state-budget revenue table — `2023 12 tve saitistvis.xls` (sheet `ბალანსი`),
`2024 12 თვე საიტისთვის.xlsx` (sheet `I თავი`), `2025.xlsx` (sheet `tavi I` / `I თავი`), all under
`docs/Raw Data/Expenditure/mof.ge/`. They are **comparison sources only** — no published fact is
generated from them (§7). The registered source IDs (`source.mof_<year>_tavi1_actual`) resolve in
the registry, but the monthly workbook files themselves are **not committed**; the extractor
skips missing files silently (`existsSync` guard, locked by the "skips missing optional workbook
comparison sources" test), so in a fresh checkout the cross-check is dormant. One registry
wrinkle: the `tavi1_actual` registry rows point at the committed annual fact workbooks
(`excel-fact-files-2004-2025/<year>-fact.xlsx`), while the parser reads the uncommitted monthly
December exports named above — the registered path documents the reviewed source family, not the
exact file the comparison parser opens.

### 2.3 Four source-code eras

The Form #1 classification changed twice, and the PDF text layer's code style once more within
the modern classification, which splits the 21 years into four processing eras by code shape
(tallied from the staging CSV; parser behavior in §4–§5):

| Years | Row codes | Example | Notes |
|---|---|---|---|
| 2005–2006 | old fixed-width **12-digit** | `010300000000` (VAT) | pre-GFS classification |
| 2007 | old fixed-width **8-digit** | `01030000` (VAT) | same classification, shorter codes |
| 2008–2018 | GFS codes, **undotted** | `11411` (VAT) | dots dropped by the PDF text layer; 2012/2013/2016 labels mojibake (§5.1) |
| 2019–2025 | GFS codes, **dotted** | `1.1.4.1.1` (VAT) | 2019's labels mojibake (§5.1) |

### 2.4 Units and columns

Form #1 prints amounts in **GEL with two decimals** (grouped `1,234,567.89` or, in the 2015
layout, space-grouped with comma decimals `1 234 567,89` — both accepted by the amount regex).
The parser stores all three columns (`stateBudgetActualGel`, `territorialBudgetActualGel`,
`consolidatedActualGel`); published facts use the **consolidated** column, rounded to whole GEL.
Plan columns and execution % exist only in the tavi-1 workbook rows (thousand GEL) and are never
published.

---

## 3. Data model

### 3.1 The 11 published categories

Stable IDs live in `data/taxonomy/revenue-categories.json`; display labels (ka/en) in the
taxonomy and `data/glossary/category-glossary.csv`.

| ID | English | Definition (per generation code) |
|---|---|---|
| `revenue.vat` | VAT | source row 1.1.4.1.1 |
| `revenue.income_tax` | Income tax | 1.1.1.1.1 |
| `revenue.profit_tax` | Profit tax | 1.1.1.2.1 |
| `revenue.excise_tax` | Excise tax | 1.1.4.2 |
| `revenue.import_tax` | Import tax | 1.1.5.1 |
| `revenue.property_tax` | Property tax | 1.1.3 |
| `revenue.other_taxes` | Other taxes | 1.1.6, or a residual (§6.4) |
| `revenue.grants` | Grants | 1.3 **net of** internal grants 1.3.3 (§6.2) |
| `revenue.other_revenue` | Other revenue | 1.4 **net of** intra-government other revenue 1.4.1.1.3 (§6.2) |
| `revenue.asset_decrease` | Decrease in financial and non-financial assets | 31 + 32 combined (§6.3) |
| `revenue.increase_liabilities` | Increase in liabilities | 33 |

Three additional taxonomy IDs are **not** emitted into the shipped CSV: `revenue.taxes_total`
(used only inside the PDF-vs-workbook comparison report, §7) and the split receipt IDs
`revenue.decrease_non_financial_assets` / `revenue.decrease_financial_assets` (reserved; the
shipped dataset publishes the combined `revenue.asset_decrease` instead).

### 3.2 Fact shape

Facts use the shared 12-column budget-facts CSV schema (`lib/data/factCsv.ts`): `year`, `side`
(always `revenue`), `item_id`, `amount_gel` (whole GEL, integer-rounded), `basis` (always
`actual`), `source_id`, four empty expenditure-only columns, `mapping_confidence` (empty for
revenue), and `mapping_notes`. `mapping_notes` is the per-fact provenance trail — it names the
exact source row code(s) and any netting applied, e.g.
`Source row 1.3: გრანტები; net of Source row 1.3.3: სხვა დონის სახელმწიფო ერთეულებიდან მიღებული გრანტები`.

### 3.3 Negative revenue facts are legal

Revenue amounts may be negative (official correction entries); the loader forbids negative
*expenditure* only (`lib/data/importBudgetFacts.ts`). Exactly two shipped facts are negative —
**2019 and 2020 `revenue.other_taxes`** (−230,339,071 and −246,423,796 GEL, the treasury's own
printed 1.1.6 figures) — and the integration suite pins that exact set so a new negative row is a
conscious decision (`tests/data/pipelineIntegration.test.ts`, "has no negative actual amounts…").
The import report separately counts retained negative revenue rows as a warning
(`lib/data/importReport.ts`).

---

## 4. Pipeline architecture

```
Form #1 PDFs (+ 4 reviewed text sidecars)
        │  pdf-parse text (async)
        ▼
parseTreasuryPdfRows ──► OfficialRevenueRow[] (year, sourceCode, labelKa, section,
        │                 state/territorial/consolidated GEL)
        │
        ├── npm run data:extract-revenue  ──► data/staging/revenue-official-rows-2005-2025.csv   (review artifact)
        │
        └── npm run data:generate-revenue-facts
                ├─ generateRevenueFacts ──► 231 facts
                ├─ validateRealRevenueFacts ──► per-year receipts reconciliation (±10 GEL) — hard gate
                ├─ writes data/imports/revenue-facts-2005-2025.csv
                └─ writes data/reports/real-revenue-2005-2025-report.json
                          + revenue-pdf-vs-workbook-2005-2025-report.json

npm run data:compose-budget-facts ──► data/imports/budget-facts-2005-2025.csv (revenue + expenditure)
npm run data:validate             ──► coverage / referential-integrity / staleness gate
app build (app/page.tsx, the app/explorer routes) reads the composed CSV
```

All commands run from `apps/web`. Note one deliberate difference from the admin-spending
pipeline: the staging CSV is **write-only** — a human-review artifact. The fact generator
re-extracts from the PDFs/sidecars on every run; it never reads staging back, so staging can
never go stale *into* the facts (it can go stale as a review copy, which is what the 2026-07
review caught and regenerated).

### 4.1 Extraction (`extractOfficialRevenueRows`, async)

For each of the 21 sources: read the committed text sidecar if one is declared, otherwise extract
the PDF's text layer with `pdf-parse` (`PDFParse.getText()`); pass the text to
`parseTreasuryPdfRows`. The whole extraction is async (pdf-parse), which is why both entry-point
scripts are standalone `tsx` scripts rather than build-time code.

### 4.2 Parsing (`parseTreasuryPdfRows`)

The raw text is whitespace-normalized (incl. non-breaking spaces) into one line, then parsed by
one of two paths:

**Old-code path (2005–2007).** If fixed-width codes are present (`0[1-5]\d{6}` or `\d{12}`,
digit-boundary-guarded so wrapped/adjacent numbers don't create false codes), the text is split
at each code; each segment must contain **≥ 3 amounts** (else the row is skipped as a heading);
the first three amounts are taken **in fixed order: state, territorial, consolidated**; the label
is the text between the code and the first amount. Sections come from the code prefix: `01`/`02`/
`04` → revenues, `03` → non-financial assets, `05` → liabilities.

**Modern path (2008–2025).** GFS row codes are matched (`isLikelyBudgetCode`: dotted `1.1.4.2`
style; the receipt codes `31`/`32`/`33`/`41`; undotted `[1-5]\d{1,7}`; bare section digits 0–5),
with a guard that skips a "code" immediately followed by numeric/punctuation content — this is
what keeps dates ("01/01/**2015** -") and amounts from being read as codes. Page-furniture rows
are dropped by label filters (`of `, `--`, `გვერდი`…). Because some print years put the
consolidated column first and others last, `actualColumnsFromFirstThreeAmounts` detects the
order: if the first amount equals the sum of the next two (±1 GEL, second ≠ 0) the first is the
consolidated total; otherwise the order is state, territorial, consolidated. Sections come from
the code root: `1` / `1.x` / undotted `1…` → revenues, `2` / `2.x` → expenditures, `3` / `3.x` →
non-financial assets, `31` / `32` / `33` → the asset-decrease and liability rows, `41` → opening
balance, anything else → `other` (facts only ever pull the revenues section and the three receipt
codes, so unmapped sections are harmless).

Every parsed row becomes an `OfficialRevenueRow` (`lib/data/realRevenue/types.ts`) with
`sheetName: "form #1"`, the three GEL columns, and `actualThousandGel` set to the state-budget
column ÷ 1000 (used only by the state-budget-basis comparison, §7 — published facts read the
consolidated column).

### 4.3 Staging (`npm run data:extract-revenue`)

`scripts/extract-real-revenue.ts` writes every parsed row —
**9,603 rows** across the 21 years (≈ 370–820 per year) — to
`data/staging/revenue-official-rows-2005-2025.csv` (15 columns: year, source id, path, sheet,
row number, source code, label, section, plan/actual/execution, and the three actual-GEL
columns). This file is committed and is the reviewable middle product: eyeball it after any
parser or source change. The script also runs the tavi-1 workbook parser purely so its
warnings surface in the same run (workbook rows are not staged).

### 4.4 Fact generation (`npm run data:generate-revenue-facts`)

`scripts/generate-real-revenue-facts.ts` re-extracts, then:

1. **Generates the 231 facts** (`generateRevenueFacts`, `lib/data/realRevenue/generateFacts.ts`).
   Years containing old fixed-width codes take the old-code mapping (§5.4–§5.5); all other years
   take the modern mapping table (§3.1) with **undotted fallbacks** (`1.1.4.1.1` also matches
   `11411`, etc.) so 2008–2018 resolve through the same table, plus the netting and residual
   rules of §6. A missing required row **throws** — a year cannot silently ship incomplete.
2. **Prepends total-only fallbacks** for any revenue year outside `REVENUE_DETAILED_YEARS` —
   currently none (the detailed set is all of 2005–2025), so the single curated entry
   (2006 `revenue.total`, `lib/data/totalOnlyBudgetFacts.ts`) is filtered out of the CSV and
   survives only as the independent reconciliation anchor used by the integration tests (§8.3).
3. **Validates** (§8.1) and writes `data/reports/real-revenue-2005-2025-report.json`; if any year
   fails, the script **exits non-zero without shipping** — but note the CSV is written before the
   check, so never commit a red run's output.
4. **Writes the cross-check report** `data/reports/revenue-pdf-vs-workbook-2005-2025-report.json`
   (§7). Reports are gitignored (regenerated artifacts); the CSVs are committed.

`mapping_notes` are built from `sourceCodeDisplayLabels`, a fixed code→Georgian-label table, with
a glyph guard: if a source label contains mojibake glyphs (`ʰ–˿`, §5.1) and has no
table entry, the note falls back to `official revenue row <code>` — the budget-facts loader
rejects notes containing such glyphs, so this guard is what keeps mojibake years importable.

### 4.5 Composition and promotion

`npm run data:compose-budget-facts` (`scripts/compose-budget-facts.ts`) merges
`revenue-facts-2005-2025.csv` with the per-year expenditure CSVs into
`data/imports/budget-facts-2005-2025.csv` (sorted year → side → item), which is what the app
loads at build time (`app/page.tsx` for the landing figures, `app/explorer/page.tsx` for the
budget hub's card figures, and `app/explorer/{expenditure,revenue,analysis}/page.tsx` for the
explorer itself; the explorer synthesizes the "Total revenue / შემოსავლები სულ" series — there is
no stored total row for detailed years). `npm run data:validate` (`scripts/validate-data-files.ts`)
is the promotion gate: revenue years must equal `REVENUE_YEARS` exactly, every fact's `item_id`
must resolve in the taxonomy and its `source_id` in the source registry
(`lib/data/foundationValidation.ts`), every taxonomy item needs a glossary row, and the composed
file must exactly match a fresh recomposition of its two side files (staleness check — "Combined
budget facts are stale" means re-run compose). The row loader itself (`lib/data/importBudgetFacts.ts`)
enforces schema on every read: `revenue.*` item IDs on the revenue side, Decimal-parsed amounts,
the negative-expenditure ban / negative-revenue allowance, and the mojibake-glyph rejection.

### 4.6 Deferred database import (`npm run data:import`)

`scripts/import-budget-facts.ts` is the designed hand-off to a database and currently a **no-op
by intent**: it loads the composed `data/imports/budget-facts-2005-2025.csv` through the same
validating loader, builds the summary import report (`buildImportReport` — row counts,
revenue/expenditure totals, unclassified share, retained-negative-revenue warnings), prints the
report as JSON, and then prints "Database insert is intentionally deferred until Supabase
DATABASE_URL is configured." It performs **no writes** — no database connection is opened, and
the Prisma schema in the repo stays dormant. The app does not depend on it: production data flow
is CSV-at-build (§4.5), and this script exists so that when a Supabase `DATABASE_URL` is
eventually configured, the import path is already specified and validated.

---

## 5. Year-group handling

### 5.1 2019–2025 — dotted GFS codes (and the four mojibake print years)

The modern era proper: dotted codes (`1.1.4.1.1`) and consolidated-column detection. Four print
years — **2012, 2013, 2016** (undotted era) and **2019** (this era) — have a PDF text layer whose
Georgian labels decode as mojibake (the font maps Georgian letters into the `ʰ–˿`
spacing-modifier range, e.g. `ˀʬʳʵʹʨʭʲʬʩʰ` for შემოსავლები; every row of those four years, per
the staging CSV); all other years' labels extract as clean Georgian. Row **matching never uses
labels** in the GFS eras (codes only), and display labels come from the curated table (§4.4), so
the mojibake is cosmetic. 2019 and 2020 ship the printed **negative** 1.1.6 "other taxes" rows
unchanged (§3.3).

### 5.2 2008–2018 — undotted GFS codes

Same classification, but the text layer drops the dots, so rows match through the undotted
fallback codes (`11411`, `1142`, `1151`, `113`, `13`, `133`, `14`, `14111`, `11`…). Two
era-specific rules:

- **Other taxes is a residual** (§6.4): every one of these years prints a taxes total (`11`), and
  `other_taxes` is computed as `11` minus the six named tax rows rather than trusting the printed
  `116` line.
- **2013 prints no internal-grants row** (`133`): the pipeline accepts its absence because the
  external grant children (`131` + `132`) sum to the grants total (§6.2); the 2013 grants fact
  carries the explicit note "no internal grant source row; grant children reconcile to total
  grants".

### 5.3 2015 — reviewed text sidecar, space-grouped amounts

2015's committed sidecar uses the space-grouped/comma-decimal number format
(`1 234 567,89`), handled by the amount regex and locked by the "parses space-grouped amounts
with comma decimals from 2015 PDF text" test. Columns are state / territorial / total, as the
form header prints them.

### 5.4 2007 — old 8-digit codes

Fixed-width `0[1-5]\d{6}` codes. Mapping: income `01010000`, profit `01020000`, VAT `01030000`,
excise `01040000`, import `01050000`, **property `01070000`**, grants `04000000`, other revenue
`02000000`, asset decrease `03000000`, liabilities `05000000`; `other_taxes` = all top-level
`01xx0000` rows not in the named set (§6.4). 2007 reads from a reviewed text sidecar.

### 5.5 2005–2006 — old 12-digit codes

Fixed-width 12-digit codes, both years via reviewed text sidecars. Mapping as in 2007 with
12-digit codes, except **property tax is the sum of two rows** (`010600000000` +
`013000000000` — the pre-GFS classification split property taxation). `other_taxes` for 2005
aggregates 16 residual top-level tax rows (all listed in the fact's `mapping_notes`). The era
illustrates why the consolidated column is the published one: 2005 income tax is **−4,662 GEL**
in the state-budget column and 290,689,679 GEL in the territorial column — income tax then
accrued to territorial budgets — so only the consolidated 290,685,017 GEL is a meaningful
national figure. 2006 additionally has a curated official receipts total —
**4,537,916,325 GEL** (source PDF p. 22, `lib/data/totalOnlyBudgetFacts.ts`) — kept as an
independent cross-anchor (§8.3).

### 5.6 2004 — excluded (scope)

The revenue series deliberately starts at 2005 (`REVENUE_START_YEAR`). No 2004 Form #1 is
committed, and `tests/data/sourceCoverage.test.ts` asserts the absence ("intentionally excludes
2004 revenue"). This mirrors the expenditure scope decision (the repo's 2004 treasury source is
central-budget scoped; see `lib/data/coverage.ts` and the treasury-functional methodology §7.1).

---

## 6. Mapping decisions & rationale

### 6.1 Publish the consolidated column

Form #1 prints state, territorial, and consolidated amounts per row; facts always take
**consolidated** (`consolidatedGel()` in both the generator and the validator). Rationale: the
dataset's subject is national receipts, and for early years large taxes accrued to territorial
budgets (§5.5) — the state-budget column alone would misrepresent them. The state-budget column
is retained in staging and drives the workbook comparison (§7).

### 6.2 Net internal flows out of grants and other revenue

In a consolidated budget, a grant one government level pays another is not new revenue. Two
source rows are therefore subtracted:

- `revenue.grants` = row `1.3` − row `1.3.3` ("grants received from state units of other
  levels"). If a year prints no `1.3.3` row, the pipeline requires proof that no internal grants
  exist: the external children `1.3.1` (international organisations) + `1.3.2` (foreign
  governments) must sum to `1.3` within 10 GEL — else generation throws. Only 2013 uses this
  exemption (§5.2).
- `revenue.other_revenue` = row `1.4` − row `1.4.1.1.3` ("other revenue received from within the
  government sector"). This row is unconditionally required in modern years.

Old-code years (2005–2007) have **no netting** — their classification predates these internal
rows, and the validator treats their gross totals accordingly. Every netting is stated in the
fact's `mapping_notes`.

### 6.3 One combined asset-decrease category

Non-financial asset decrease (row `31`) and financial asset decrease (row `32`) are summed into
`revenue.asset_decrease` ("ფინანსური და არაფინანსური აქტივების კლება"); liabilities increase
(row `33`) stays its own category. Opening-balance rows (`41`, ნაშთი) are parsed and staged but
**never published** — receipts are flows, not carried balances. The split asset IDs exist in the
taxonomy (sortOrder 105/110) but are reserved, not emitted.

### 6.4 Other taxes: three era-specific definitions

- **2019–2025:** the printed `1.1.6` row, verbatim — including the negative 2019/2020 values
  (correction entries after the 2017+ abolition of most minor taxes).
- **2008–2018:** the **residual** `taxes total (11) − (VAT + income + profit + excise + import +
  property)`. The printed `116` row does not absorb every minor tax line in these prints (e.g.
  2015 prints 26,136,003 GEL while the residual is 26,454,877 GEL), and using the residual makes
  the seven tax facts sum *exactly* to the official taxes total. Caveat: the fact's
  `mapping_notes` still cites `Source row 116` without flagging the residual arithmetic (§9.4).
- **2005–2007:** the sum of all residual top-level old-code tax rows (16 rows in 2005), i.e.
  everything under the `01…` tax block outside the six named categories; the component codes are
  enumerated in `mapping_notes`.

### 6.5 Strict presence over silence

Every mapping row is **required**: a year missing any of its 11 source rows (or the internal-flow
evidence of §6.2) fails generation with `Missing required revenue row for <year>: <code>` rather
than shipping a partial year. The same completeness is re-asserted downstream (validator §8.1,
integration tests §8.3).

---

## 7. The tavi-1 workbook cross-check (2023–2025)

An independent second reading of the newest years. `extractOfficialWorkbookRevenueRows` parses
the MoF workbook "tavi 1" sheets (§2.2) with `parseTavi1Rows` — header-row discovery (the row
containing დასახელება + დამტკიცებული + დაზუსტებული + ფაქტი + შესრულება within the first 20 rows),
label-driven section classification with a financing-context memory (bare ზრდა/კლება rows inherit
the current assets/liabilities block), a stop at any repeated header (later summary tables are
not ingested), and warnings for any dropped row that carried amounts. Sheet selection is strict
allowlist (`pickSheetName` with `preferredNames` only, no fallback): revenue extraction must only
touch explicitly reviewed sheets, and an unexpected workbook layout throws rather than guessing.

The generator then builds **legacy aggregate facts** (`revenue.taxes_total`, `revenue.grants`,
`revenue.other_revenue` — `generateLegacyAggregateRevenueFacts`) from both readings and writes
the deltas to `data/reports/revenue-pdf-vs-workbook-2005-2025-report.json`. The comparison basis
is `state_budget_actual_gel` — the workbook is a *state-budget* execution report, so it is
compared against the PDF's state-budget column, not the published consolidated amounts. The
report is advisory (reviewed by eye); it does not gate the pipeline, and with the workbooks
absent from a fresh checkout it simply contains no rows (§2.2).

---

## 8. Reconciliation & validation

### 8.1 The per-year receipts identity (the hard gate)

`validateRealRevenueFacts` (`lib/data/realRevenue/validateRealRevenue.ts`) recomputes, per year,
from the *source rows*:

```
final receipts = (gross official revenue − internal flows removed)   # §6.2
              + asset decrease (31 + 32, or old 03)
              + liabilities increase (33, or old 05)
```

where gross official revenue is the printed `1` (შემოსავლები) total in modern years, or
`01 + 02 + 04` (taxes + other revenue + grants totals) in old-code years. The sum of the year's
11 generated facts must equal that figure within **10 GEL** (`roundingToleranceGel` — pure
rounding headroom on whole-GEL rounding of 11 facts). The validator also re-asserts presence: the
official total row, all 11 fact IDs, the internal-flow rows (or the 2013-style grant-children
evidence), and the receipt source rows. Any breach marks the year `failed`, is written into the
report's `warnings`, and `data:generate-revenue-facts` exits non-zero. The report
(`data/reports/real-revenue-2005-2025-report.json`) shows the full arithmetic per year: gross
totals, both internal-flow removals, net official revenue, asset/liability components, final
receipts vs. generated receipts, and per-year pass/fail.

Because the identity covers all 11 categories against an independently-printed total, a dropped
row, a mis-parsed amount, or an over-netting cannot pass. **Limitation:** like the expenditure
gates, it checks *sums* — two errors that cancel inside one year, or a value moved between two
tax categories, would pass the gate (§9.3); this is what the category-level source spot-checks in
the 2026-07 review were for.

### 8.2 Loader- and foundation-level gates

Re-run on every `npm run data:validate` and inside the test suite (§4.5): exact year coverage
(2005–2025, no gaps, no extras), `revenue.*` ID discipline, taxonomy/glossary/source-registry
referential integrity, negative-amount asymmetry, mojibake rejection in notes, and the
composed-file staleness check.

### 8.3 Test suite

Unit tests (`apps/web/tests/data/realRevenue/`) fix the parser and generator behaviors named
throughout: column-order detection, date/page-furniture immunity, wrapped 12-digit codes, the
8-digit and 12-digit mappings, the undotted fallback and other-taxes residual, the missing-`133`
exemption, sidecar usage, optional-workbook skipping, tavi-1 header/section/warning behavior, and
every validator failure mode. On top, `tests/data/pipelineIntegration.test.ts` gates the
**shipped CSVs** end-to-end with the same loaders the app uses: one fact per
(year, item, basis); a complete 11-category panel every year; the 2006 detailed sum reconciled to
the curated official total (±10 GEL); the exact set of negative revenue facts pinned; and the
derived explorer totals for the two most recent years pinned to the GEL ("INTENTIONAL REGRESSION
PINS" — update them consciously with any legitimate data refresh, never loosen).

---

## 9. Known limitations & caveats

1. **Perimeter asymmetry with the expenditure datasets.** Revenue measures the **consolidated**
   budget; the functional and ministries expenditure datasets measure the **state** budget
   payments concept. Revenue and expenditure totals are therefore not a deficit calculation.
2. **Net-of-internal-flows is a modelled adjustment** (§6.2): published grants / other revenue
   are smaller than the printed consolidated rows; the arithmetic is recorded per fact in
   `mapping_notes` and per year in the validation report.
3. **The gate checks year sums** — an intra-year offsetting mis-parse or a value swapped between
   categories would pass (§8.1); category-level changes should be spot-checked against the source
   PDF (as in the 2026-07 review).
4. **The 2008–2018 other-taxes residual is under-documented in its own notes** — `mapping_notes`
   cites `Source row 116` even though the amount is `11 − named taxes` (§6.4). Known cosmetic
   gap; the arithmetic itself is asserted by tests.
5. **Label mojibake in 2012, 2013, 2016, 2019** (§5.1): matching is code-based and display
   labels are curated, but staging-CSV labels for those four years are not human-readable.
6. **Publication hashes are complete; historical capture hashes were not recorded.** The public
   source manifest has byte sizes and SHA-256 hashes for all 21 current PDFs, but those hashes were
   created from the committed originals in 2026. Earlier review dates therefore have repository
   history, not a contemporaneous retrieval hash.
7. **The workbook cross-check is dormant in a fresh checkout** (§2.2 / §7): its monthly source
   workbooks are not committed, so the comparison report only carries rows on a machine that has
   them.
8. **The column-order heuristic** (§4.2) keys on `consolidated = state + territorial` (±1 GEL,
   state ≠ 0); a row violating that identity in its first three amounts would fall back to the
   state-first column order. The staging CSV exposes all three columns per row, so the identity
   is directly reviewable there after any extraction run.

---

## 10. How to extend / maintain (adding a year)

1. **Obtain the Form #1 PDF** for the new year and commit it as
   `docs/Raw Data/Revenue/<year>-jan-dec-consolidated-revenue.pdf` — the file-name pattern is
   load-bearing (§2.1).
2. **Register it** in `data/sources/source-documents.csv` as
   `source.mof_<year>_revenue_form1_pdf` with the review date.
3. **Widen coverage**: bump `APP_END_YEAR` in `lib/data/coverage.ts` (revenue, expenditure and
   admin-spending coverage all key off it — extend the other pipelines in the same change, or the
   `data:validate` year-coverage assertions will fail).
4. **Extract & review**: `npm run data:extract-revenue`; diff the staging CSV; check the new
   year's row count (~370–820), that its codes landed in the expected era shape, and that the
   three amount columns satisfy state + territorial = consolidated. If the PDF's text layer is
   unusable, commit a reviewed text sidecar under `docs/Raw Data/Revenue/text/` **and** add the
   year to the `textPath` year list in `extractWorkbooks.ts`.
5. **Generate & reconcile**: `npm run data:generate-revenue-facts` must pass its gate. A
   `Missing required revenue row` error means the parse (or the print) lost a mapped row — fix
   extraction; never paper over it. If the year legitimately lacks `1.3.3`, the grant children
   must reconcile (§6.2) — that is evidence, not a knob.
6. **Compose & validate**: `npm run data:compose-budget-facts`, then `npm run data:validate`.
7. **Tests**: `npm test` — update the two-latest-years pinned totals in
   `pipelineIntegration.test.ts` consciously, verifying the new numbers against the PDF; extend
   the negative-facts pin only if the source genuinely prints a negative row.
8. **Optional cross-check**: if the year's MoF workbook is on hand, add a `realRevenueSources`
   entry (exact reviewed sheet name) and eyeball the comparison report.
9. **Anomaly-scan** the 11 series for implausible jumps, and take any perimeter judgment (a new
   code appearing, a tax reform reshaping 1.1.6) to the owner rather than deciding unilaterally.

**Key files:** `apps/web/lib/data/realRevenue/{types,extractWorkbooks,parseTreasuryPdfRows,parseTavi1Rows,generateFacts,validateRealRevenue}.ts`,
`apps/web/scripts/{extract-real-revenue,generate-real-revenue-facts,compose-budget-facts,validate-data-files,import-budget-facts}.ts`,
`apps/web/lib/data/{coverage,factCsv,totalOnlyBudgetFacts,importBudgetFacts,importReport,foundationValidation}.ts`,
`apps/web/lib/data/parsing/cellUtils.ts`.
**Data:** `docs/Raw Data/Revenue/` (+ `text/` sidecars), `data/staging/revenue-official-rows-2005-2025.csv`,
`data/imports/revenue-facts-2005-2025.csv`, `data/imports/budget-facts-2005-2025.csv`,
`data/taxonomy/revenue-categories.json`, `data/sources/source-documents.csv`.
**Tests:** `apps/web/tests/data/realRevenue/*.test.ts`, `tests/data/pipelineIntegration.test.ts`,
`tests/data/sourceCoverage.test.ts`.
**Sibling methodologies:** `treasury-functional-expenditure-methodology-2004-2025.md` (functional
expenditure), `ministries-expenditure-methodology.md` (organizational expenditure).

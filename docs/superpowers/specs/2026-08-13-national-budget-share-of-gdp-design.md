# National budget share of GDP design

**Status:** Approved 2026-08-13

## 1. Purpose

GeoData's national expenditure and revenue explorers currently interpret `წილი` as each series' share of the corresponding budget total. The approved change makes that measure each annual budget amount's share of Georgia's nominal gross domestic product (GDP) in the same year.

This is a bounded budget-explorer enhancement. It adds a source-preserved national nominal-GDP denominator and changes the existing national multi-year measure. It does not create a GDP explorer, GDP route, GDP navigation item, GDP methodology category, or municipal GDP behavior.

## 2. Approved product decisions

- Preserve the longest official annual national nominal-GDP history available from Geostat: 1996–2025.
- Use GDP at market prices, at current prices, in GEL.
- Use the archived SNA 1993 series for 1996–2009 and the revised SNA 2008 series for 2010–2025.
- Preserve all official source rows in staging, including the 2010–2018 overlap, but publish one canonical annual denominator per year according to the precedence rule above.
- Mark the accounting-system handoff at 2010 in data and methodology.
- Mark 2025 as preliminary; do not silently present it as final.
- Apply GDP share only to the national expenditure and revenue multi-year explorers.
- Keep municipalities and single-year analysis unchanged.
- Keep the existing `sh=1` shared-link state working.
- Do not create estimates, interpolation, backcasts, or zero-filled missing values.

## 3. Scope

### 3.1 Included

- Immutable captures of the two official Geostat workbooks and their source metadata.
- A reviewed canonical annual national nominal-GDP dataset for 1996–2025.
- Source-to-staging and staging-to-canonical validation.
- CSV serving and Supabase/Prisma mirror parity for the canonical GDP facts.
- Same-year GDP-share calculations for expenditure fields, ministries, major programs, total expenditure, revenue categories, and total revenue.
- Clear GDP-share labels in the chart control, table, indicators, tooltips, and CSV.
- GDP denominator provenance in the existing expenditure and revenue methodology.
- Automated unit, data, integration, browser, and build verification.

### 3.2 Excluded

- A separate GDP explorer page or route.
- A GDP sidebar or header navigation item.
- A live `/methodology/gdp` page; the existing future GDP marker remains non-clickable.
- Quarterly GDP.
- Real or constant-price GDP, GDP growth, GDP deflator, GDP per capita, GDP in USD, regional GDP, municipal GDP, and GDP by economic activity or expenditure component.
- Any change to `/explorer/municipalities` or municipality and region detail pages.
- Any change to single-year analysis composition measures, including treemaps, rankings, Budget Radar, Budget Field, and Every 100 GEL.

## 4. Official sources and canonical series

Geostat is the authoritative publisher.

### 4.1 Archived SNA 1993 source

- Dataset: *Gross Domestic Product, at current prices*.
- Official workbook: `GDP-at-current-prices.xlsx`.
- Observed annual coverage: 1996–2018, with later source periods also containing preliminary quarterly values.
- Selected canonical use: annual `GDP at market prices` for 1996–2009 only.

### 4.2 Current SNA 2008 source

- Dataset: *Gross Domestic Product by Production Approach, at current prices*.
- Official workbook: `03_GDP-at-Current-Prices.xlsx`.
- Observed annual coverage: 2010–2025.
- Selected canonical use: annual `GDP at market prices` for 2010–2025.
- The 2025 annual value is preliminary and carries Geostat's published revision notice.

### 4.3 Handoff rule

The SNA 2008 series supersedes the archived SNA 1993 values wherever both exist. Therefore:

```text
1996–2009 -> SNA 1993 annual GDP at market prices
2010–2025 -> SNA 2008 annual GDP at market prices
```

The canonical series is continuous by year but contains a documented methodology handoff at 2010. The product must not imply that this handoff is an economic event, and validation must reject any accidental use of SNA 1993 values from 2010 onward.

## 5. Source preservation and normalized data

The source-preserved package lives under a dedicated national-GDP raw-data directory and contains:

- both official workbooks as immutable captures;
- a source manifest with exact official URL, retrieval date, byte size, SHA-256, source coverage, selected use, and notes;
- a staging extract retaining every observed annual source fact and its overlap;
- one canonical normalized CSV with exactly one row for each year 1996–2025;
- a validation report;
- a concise README and GDP-denominator methodology.

Each canonical GDP fact records at least:

```text
year
gdp_current_prices_gel
valuation = market_prices
accounting_standard = sna_1993 | sna_2008
status = final_as_published | preliminary
source_id
source_sheet
source_cell
source_unit
transformation
last_reviewed_at
```

Source values published in million GEL are converted mechanically to GEL. No precision is invented beyond that unit conversion. Human-facing Georgian CSV output uses UTF-8 with BOM.

## 6. Validation and serving

Generation and validation must fail on:

- source hash or byte-size changes;
- missing or duplicate years;
- a canonical coverage set other than every year from 1996 through 2025;
- non-positive, non-finite, or non-numeric GDP values;
- a source row other than annual GDP at market prices;
- a unit other than current-price million GEL before conversion;
- SNA 1993 selected after 2009;
- SNA 2008 absent from any year from 2010 onward;
- 2025 losing its preliminary status without an explicitly reviewed source update;
- staging values, normalized values, and recorded source cells failing exact reconciliation;
- database row-count, key, amount, status, or source parity with the reviewed canonical CSV.

Reviewed CSV remains the human-reviewed source of truth. The existing transactional import mirrors the canonical GDP facts into a dedicated Prisma model and proves parity. Static builds continue to work from either the CSV source or the database source.

## 7. Explorer calculation

For each national budget fact with year `y`:

```text
share_of_gdp(y) = budget_amount_gel(y) / nominal_gdp_gel(y)
```

The denominator is always Georgia's canonical national nominal GDP for the same calendar year. It is never:

- the sum of selected series;
- total expenditure;
- total revenue;
- the sum of regional GDP;
- real or constant-price GDP;
- a planned or forecast GDP value.

The calculation applies identically to actual and planned budget facts. Existing budget precedence still controls which budget fact is public: actual wins when planned and actual coexist. The GDP denominator retains its own status independently, including preliminary 2025.

The main explorer's internal measure identity changes from `share_of_total` to `share_of_gdp`. Single-year analysis keeps its separate composition fields such as `shareOfTotal` because those measures are intentionally unchanged.

If a future served budget year has no reviewed GDP denominator, its GDP-share value is `null`. The chart shows a gap, tables and indicators show `—`, CSV retains a blank calculated share, and data validation reports the missing denominator. The application must never substitute zero, an estimate, or the closest available year.

## 8. User interface behavior

### 8.1 Measure control

- The national expenditure and revenue explorer pill is labelled `% მშპ-ში`.
- Nominal mode remains the default.
- Activating the pill switches chart values and percent formatting to `share_of_gdp`.
- The existing URL hash `sh=1` restores GDP-share mode, preserving previously shared links even though their meaning is updated by this approved product change.

### 8.2 Chart and tooltip

- Every visible national series is plotted as a percentage of same-year GDP.
- Total expenditure and total revenue no longer become 100%; each shows its actual GDP ratio.
- Tooltips name the measure as `წილი მშპ-ში` and show the percentage with the existing one-decimal formatting unless a focused readability test justifies more precision for very small non-zero series.
- Missing GDP denominators create honest gaps using the existing missing-data behavior.

### 8.3 Table and indicators

- The table's final column is `წილი მშპ-ში {end-year}`.
- The total row's final cell is total expenditure or revenue divided by GDP, not `100.0%`.
- Category, ministry, and program cells use the same GDP denominator.
- The side indicator becomes `ყველაზე დიდი წილი მშპ-ში`; its value and sparkline both trace GDP share.
- Share-change comparisons use the difference between the start-year and end-year GDP shares.
- GEL growth indicators and nominal comparison tables remain nominal-GEL measures.

### 8.4 Unchanged surfaces

- Municipal `% წილი` continues to mean share of the applicable municipal public total.
- Single-year analysis continues to describe composition of the selected budget side.
- The landing page may continue to display the current nominal-GDP headline, but changing that landing content is outside this task unless required to remove duplicated or contradictory data loading.

## 9. CSV export

National expenditure and revenue explorer CSVs continue to export nominal budget facts and source metadata. Each exported budget row also includes:

```text
gdp_current_prices_gel
gdp_accounting_standard
gdp_status
gdp_source_name
gdp_source_url_or_file
gdp_last_reviewed_at
share_of_gdp
```

These columns are included in both nominal and GDP-share screen modes so a download is stable and each published percentage is reproducible. The export remains limited to the active national explorer scope, selected range, and visible dataset according to the current export contract.

The complete normalized 1996–2025 GDP CSV remains a reviewed project dataset. This task does not add a standalone public GDP download surface or route.

## 10. Methodology and canonical-document updates

Implementation updates the canonical owners in the same change:

- `Project_Definition.md` approves share of GDP for the national expenditure and revenue multi-year explorers while retaining the no-GDP-explorer boundary.
- `DESIGN.md` replaces the former share-of-budget contract for the main explorer with the approved GDP-share labels and behavior, while explicitly preserving municipal and single-year composition shares.
- A national nominal-GDP denominator methodology documents source coverage, accounting-standard handoff, status, unit conversion, validation, and limitations.
- Existing expenditure and revenue methodology pages identify Geostat nominal GDP as the denominator source and disclose the 2010 methodology handoff and preliminary 2025 value.
- The future GDP methodology marker remains non-clickable because there is no standalone GDP dataset page in this scope.

## 11. Component and data-flow boundaries

The implementation should remain small and explicit:

1. GDP source preparation reads immutable workbooks and emits reviewed staging, canonical, and validation artifacts.
2. The existing served-row layer loads canonical GDP facts from CSV or the parity-checked database mirror.
3. National expenditure and revenue routes pass GDP facts into the shared main explorer.
4. The explorer model resolves a year-indexed denominator and calculates GDP shares.
5. Existing chart, table, indicator, state, and CSV units render the resulting measure.

Do not build a generic indicator framework, a broad public-data abstraction, or a GDP page to support this one denominator.

## 12. Verification and acceptance criteria

### 12.1 Source and data proof

- Both official source captures match their reviewed hashes and byte sizes.
- Staging retains all observed annual source rows and the overlap.
- Canonical output contains exactly 30 unique years, 1996–2025 inclusive.
- Canonical years 1996–2009 come only from SNA 1993.
- Canonical years 2010–2025 come only from SNA 2008.
- The 2025 fact is preliminary.
- Every canonical amount reconciles to its recorded official source cell and unit conversion.
- Regeneration reaches a clean deterministic fixed point.
- CSV and database modes return exact key, value, status, and provenance parity.

### 12.2 Calculation proof

- A category amount divided by same-year GDP produces the plotted and tabular value.
- Total expenditure and revenue produce their GDP ratios rather than 100%.
- Selected-series changes do not change any series' GDP denominator.
- Expenditure grouping changes do not change the denominator.
- Start/end share comparisons use GDP share in both years.
- Missing GDP produces null, never zero or an estimate.
- Negative budget correction rows retain negative GDP shares.

### 12.3 Product proof

- Expenditure and revenue show `% მშპ-ში` and restore it from `sh=1`.
- The table and indicator labels clearly name GDP.
- Downloads contain reproducible GDP values, status, provenance, and calculated shares with UTF-8 BOM.
- Municipal explorers preserve their existing share behavior and labels.
- Single-year analysis preserves all budget-composition behavior.
- No GDP explorer route, navigation item, live methodology route, sitemap entry, or clickable future marker is created.
- Georgian labels, percent formatting, keyboard behavior, desktop layout, and mobile layout remain correct.

### 12.4 Engineering gates

- focused GDP preparation and validation tests;
- explorer model and CSV tests;
- full lint, TypeScript, unit, and data validation checks;
- production static build in CSV mode;
- database parity/import verification where credentials are available;
- browser tests for expenditure and revenue in nominal and GDP-share modes, shared-link restoration, downloads, desktop, and mobile;
- explicit regression checks for municipalities and single-year analysis;
- required hosted CI before merge;
- post-merge deployed-commit and live-route verification if GitHub delivery is authorized.

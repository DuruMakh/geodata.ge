# GDP overview

## Scope
Annual real GDP (1960–2025, World Bank constant 2015 USD), annual real GDP growth (1961–2025, published percent), and Geostat nominal GDP and GDP per person (1996–2025, GEL/USD). Exactly 251 observations in six source series. No regional, sector, population or forecast data.

## Sources and processing
Originals and capture manifest are in `docs/Raw Data/Economy/gdp-overview`. World Bank response release: 2026-07-13; files captured 2026-09-10; integration reviewed 2026-09-11. JSON country GEO and exact indicator codes are checked. The source does not describe year-by-year reconstruction of the earliest historic estimates; published observations are preserved without certification of those original estimates.

Geostat SNA1993 is selected for 1996–2009, SNA2008 for 2010–2025. This is not a uniformly revised historical series. Geostat 2025 is preliminary; scheduled revision 2026-11-16. USD and per-person amounts are the published cells, not a new currency conversion or population estimate.

Nominal total cells in millions are multiplied by one million, using Decimal arithmetic. Original underlying source precision is retained. The separate budget denominator CSV remains at its established one-decimal million GEL precision and is not modified. Real GDP is not spliced or custom-rebased. Growth source percent is converted to a fraction only at the display/export boundary.

## Validation and refresh
The four indicator summaries contain reviewed editorial figures. After any refresh, run `npx vitest run tests/i18n/gdpSummaryFigures.test.ts` from `apps/web`; it recomputes the figures from the canonical CSV and checks each summary for unchecked numeric claims. If it fails, update both languages in `lib/i18n/messages/{ka,en}/gdp.json` and re-review the wording against the approved GDP overview design.

`npm run data:prepare-gdp-overview` writes the canonical BOM CSV and validation report; `npm run data:check-gdp-overview` checks byte parity without writing. Both read archived originals offline. Source hashes, country/indicator, year uniqueness/coverage, units, status, finite values, FX and level/growth consistency are checked. Source updates require a reviewed replacement manifest; builds never fetch fresh upstream files.

Serving imports the pure observation validator without loading workbook preparation. The public GDP CSV is generated during prebuild and independently checked during postbuild, after it exists; canonical source validation remains available on a clean checkout before any build.

## Serving
`loadServedGdpOverviewData` supports reviewed CSV and db mirror modes. `GdpOverviewFact` stores exact decimals; the import checks every field inside its existing transaction. Browser data are numbers. RLS is enabled and no anonymous Data API access is granted. Migration/application to a live database is a delivery operation, not a local source-edit side effect.

## Presentation and downloads
One active indicator at a time, in both Georgian and English. GDP/nominal per-person currency controls use published GEL/USD. Real GDP remains constant2015 USD; growth is real annual percent. Preliminary is never treated as planned. Excel uses the established three-sheet style, the active range/measure and original-source hyperlinks, with no cumulative change column. The methodology's static CSV uses explicit units and source provenance; the explorer has one native XLSX action.


## MCP and bulk publication

`query_gdp` accepts one or more of the six canonical series IDs and a bounded year list. There is no implicit currency conversion: the series ID fixes the currency and price basis. Its `value` measure is the published number, with `unit` equal to GEL, USD, USD_2015, percent, GEL_per_person or USD_per_person. Growth 7.5 means 7.5%; only the human table and Excel percentage cells use fractions. Published and preliminary are distinct from actual/planned budget status.

The seventh dataset is `gdp-overview`. Discovery returns each series' exact observed years and bilingual names. Responses carry bilingual definitions, historical methodology/reconstruction caveats, preliminary status and original-source references. Requested gaps remain missing, never zero; years outside the overall dataset range are rejected. There is no GDP ranking or cumulative comparison operation. Long histories should be queried one series at a time to respect the existing MCP response-size cap.

The versioned snapshot retains canonical decimal strings plus the bilingual series definitions so either data or definition changes update dataVersion. `gdp-overview.json` publishes all six series over the full union of years (251 available observations and explicit missing cells). `gdp-overview.csv` preserves the exact reviewed decimals, units, status and source IDs with a UTF-8 BOM. Both are in the central manifest with byte hashes; `data:check-fact-query-publications` verifies the written CSV and JSON against the canonical-data snapshot.

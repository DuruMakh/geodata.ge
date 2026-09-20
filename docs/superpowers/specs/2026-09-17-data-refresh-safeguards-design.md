# Data-refresh safeguards for GDP, sectors and deficit: specification

Date: 2026-09-17
Status: Draft for user review. Scope and packaging were approved in conversation on 2026-09-17, after a reviewed audit of the work merged 2026-09-02..09-14.
Baseline: `main` at `c7451ceaf`. Line numbers refer to that commit. Paths are under `apps/web/` unless they start with `data/`, `docs/` or name a root document.
Series: audit remediation, spec 5 of 8. No dependency on the other specs. It changes query-service output (§5), so the reference fixture rule in CLAUDE.md applies as described there.

## 1. Outcome and scope

The next data refresh cannot leave stale figures or edition text behind:

- Geostat's revision of 2025 GDP is scheduled for 2026-11-16 (`docs/data-methodology/gdp-overview.md:9`).
- The next IMF WEO edition is due.

Every hard-coded figure or vintage either derives from data or fails a test when the data moves. Along the way, the two copies of public CSV writers collapse into one.

| § | Risk today | Safeguard |
|---|---|---|
| 2 | ~45 GDP summary figures per locale are fixed text | A test recomputes every figure from the CSV |
| 3 | Deficit forecast marker, edition text and workbook source are pinned to April 2026 | Derived from facts and the IMF manifest |
| 4 | Nominal GDP lives in three pipelines with 2025 hard-coded in code and runtime validators | One consistency check; preliminary years come from manifests |
| 5 | The same 2025 real GDP growth is "published" on the GDP page and "preliminary" on sectors | A registered caveat and page note disclose the preliminary basis |
| 6 | Two writers per public CSV, and a check that reads no files | One writer; a real output check |

### 1.1 User-approved decisions (2026-09-17)

- Packaging only.

### 1.2 Decisions taken in this spec

- **GDP summary text stays fixed,** as approved: "reviewed full-history editorial copy… review it with future dataset updates", `2026-09-10-gdp-overview-design.md:213`, `:217`. Editorial claims such as "roughly tripled" cannot be derived, so a test enforces the review instead.
- **Three nominal-GDP artifacts stay.** Each serves its own reviewed contract. The national series' 0.1 mln GEL rounding, which is the budget and debt denominator, does not change; changing it would move every served %-of-GDP figure.
- **Statuses stay publisher-faithful.** The World Bank marks nothing preliminary, so its 2025 values keep status `published` and the preliminary basis is disclosed instead.

## 2. GDP summary figures

Evidence:

- `components/gdp/gdp-summary.tsx` renders four summaries from `lib/i18n/messages/{ka,en}/gdp.json:37-68`. Period boundaries are hard-coded at `gdp-summary.tsx:26-31`. The summaries hold about 45 figures per locale, all correct at the baseline.
- The only tripwire is `tests/explorer/economyHub.test.tsx:20`, and only for the rounded 2025 real GDP.
- `npm run i18n:check` validates keys, not numbers (`lib/i18n/validation.ts:69-80`).
- The refresh steps in `docs/data-methodology/gdp-overview.md:13-14` do not mention the summaries.

Change: add `tests/i18n/gdpSummaryFigures.test.ts` with a reviewed table of `{ locale, key, token, compute }` entries.

- **Data:** `compute` recomputes each figure from `loadGdpOverviewFacts()` with the rounding used in the text.
- **Covered figures:**
  - real GDP: level and record, 5- and 10-year changes, the three period rows (total and CAGR), the 1985 peak, the 2023 recovery and the 1960–1990 CAGR
  - growth: 2025 vs 2024, the 2007 maximum, the negative years and the period table
  - nominal and per capita: levels, year-on-year change, 5- and 10-year changes, in GEL and USD
- **Completeness:** the test also asserts that every numeric token with a decimal point or a following `%`, `billion`/`მლრდ` or currency sign, in the listed message values, appears in the table. New numbers cannot be added unchecked.
- **Period boundaries:** the boundaries in `gdp-summary.tsx:26-31` are table entries too.

Refresh document: add a step to `gdp-overview.md`. After a refresh, run the test; on failure, update both locales and re-review the text against spec `:213` and `:217`.

## 3. Deficit vintage

Evidence:

- **Marker:** `components/deficit/deficit-explorer.tsx:231` hard-codes `marker={{ year: 2026 }}`.
- **Workbook source:** fixed in `lib/pages/deficit.tsx:18-24` (IMF URL, `1995 + index` for 37 years, `retrievedAt: "2026-09-04"`).
- **Copy:** `lib/i18n/messages/{ka,en}/deficit.json` fixes "2026–2031" and "1995–2025" (`:6`), "April 2026" (`:7`), "2026–2031 are IMF projections" (`:11`) and "April 2026" (`:14`). DESIGN.md:600 fixes "(2025)" and "2026–2031".
- **Pipeline and loader:** `lib/data/generalGovernmentBalance/prepareGeneralGovernmentBalance.ts:27` pins `EXPECTED_LATEST_ACTUAL_YEAR = 2025`, and the loader pins `max(2031)` and vintage literals (`importGeneralGovernmentBalance.ts:17`, `:21-34`).
- **Manifest:** `docs/Raw Data/Deficit/imf-weo-general-government-balance/source-manifest.csv` already carries `source_id`, `dataset_version`, `publication_date`, `retrieved_file_url`, `retrieved_at`, `year_min`, `year_max` and `latest_actual_year`.

Change:

1. **Marker:** the first `status === "projection"` year of the unfiltered facts, as debt does (`components/debt/debt-explorer.tsx:128-131`).
2. **Workbook sources:** a manifest-based loader beside `loadGdpWorkbookSources` (`lib/methodology/workbookSources.ts:222`). It reads the IMF manifest, and the edition name ("April 2026") is formatted from `publication_date` per locale.
3. **Copy:** the `deficit.json` messages take parameters — `{actualFirst}`, `{actualLast}`, `{projectionFirst}`, `{projectionLast}`, `{edition}` — filled from facts and the manifest. The rendered text is identical at the baseline, so `tests/explorer/deficitRoute.test.tsx:49` and `tests/browser/bilingual-debt-deficit.spec.ts:51` pass unchanged.
4. **Pipeline and loader:** `EXPECTED_LATEST_ACTUAL_YEAR`, the loader's `max(2031)` and its vintage literals read `latest_actual_year`, `year_max`, `source_id` and `dataset_version` from the manifest. The CSV-vs-manifest checks still fail loudly on a mismatch.
5. **DESIGN.md §8.6** states the rule — the deck reports the latest actual observation and projections render dashed from the first projection year — not the years.

Tests: a unit test for the marker year derived from facts, using a fixture whose first projection year is 2027; a loader test for manifest-based workbook sources; the existing deficit tests pass unchanged.

## 4. Nominal GDP in three pipelines

Evidence:

- **Three CSVs:** `data/imports/national-gdp-annual-1996-2025.csv` (rounded to 0.1 mln GEL), `data/imports/gdp-overview-annual.csv` (`nominal_gel`) and `data/imports/economic-sectors-annual.csv` (`economy.gdp_total`).
- **Three mirror models:** `prisma/schema.prisma:179`, `:402`, `:418`.
- **One workbook, two archives:** the same Geostat workbook is archived twice with sha256 `21A576C9…` and 50,098 bytes, at `docs/Raw Data/GDP/national-nominal-gdp/official/03_GDP-at-Current-Prices.xlsx` and `docs/Raw Data/Economy/gdp-overview/sources/geostat_nominal_current.xlsx`.
- **Chained checks:** the overview checks the national CSV (`lib/data/gdpOverview/prepareGdpOverview.ts:147-162`), and sectors check the overview CSV (`lib/data/economicSectors/prepareEconomicSectors.ts:119-133`).
- **2025 hard-coded:**
  - `lib/data/nationalGdp/prepareNationalGdp.ts:59`, `:61`, `:196`
  - `prepareGdpOverview.ts:47`, `:81`, `:106-107`, `:129`, `:139`
  - `prepareEconomicSectors.ts:28`, `:61`, `:62`, `:91`
  - runtime: `lib/data/gdpOverview/types.ts:2-7` (`last: 2025`), `lib/data/gdpOverview/validation.ts:18` and `lib/data/economicSectors/validation.ts:39`
- **Manifests:** the overview manifest (`docs/Raw Data/Economy/gdp-overview/source-manifest.json`) lists files and hashes only. The sectors manifest already carries `preliminaryYears`.

Change:

1. **Consistency check:** add `scripts/check-nominal-gdp-consistency.ts` as `npm run data:check-nominal-gdp-consistency`, added to `data:validate`. It asserts:
   - overview `nominal_gel` equals sectors `economy.gdp_total` nominal exactly, compared as Decimals
   - national `gdp_current_prices_gel` equals the overview value rounded to 0.1 mln GEL
   - the two archived workbook copies have identical sha256 in their manifests

   The chained prepare-time checks remain.
2. **Preliminary years from manifests:**
   - The overview manifest gains `preliminary_years` for its Geostat sources.
   - `prepareGdpOverview.ts` and `gdpOverview/validation.ts:18` read the status rule from it instead of `year === 2025`.
   - `prepareEconomicSectors.ts:61` compares against its own manifest's `preliminaryYears` instead of `[2025]`.
3. **Coverage from manifests:**
   - `gdpOverview/types.ts` `last` and `economicSectors/validation.ts:39` read coverage from the manifests at load time, instead of the literal 2025.
   - Prepare-time literals that pin a specific source edition (`prepareNationalGdp.ts:59`, `:61`, `:196`; `prepareEconomicSectors.ts:62`, `:91`) stay as deliberate edition guards. Each gets a comment naming the refresh step that must change it.
4. **Refresh order:** `gdp-overview.md`, `national-nominal-gdp.md` and `economic-sectors.md` state the order once — national, then overview, then sectors, in one change — with the consistency check as the gate.

Tests: the consistency script's unit test covers one mismatching value per rule and one differing hash; the existing prepare tests pass.

## 5. Preliminary basis of World Bank 2025 values

Evidence:

- `data/imports/gdp-overview-annual.csv:186` has `real_growth_percent,2025,7.46161504152039,…,published` (World Bank).
- `data/imports/economic-sectors-annual.csv:48` has `economy.gdp_total,2025,real_growth,7.46161492416432,…,preliminary` (Geostat).
- `query_gdp` returns basis `published`, while `query_economic_sectors` returns `preliminary` plus `sectors_preliminary`. The GDP page's real indicators say nothing.

Change:

- **Caveat:** register `gdp_world_bank_preliminary_basis` in `lib/factQuery/caveats/rules.gdp.ts` (severity `note`, `comparisonEffect` `none`). It applies to `real_usd_2015` and `real_growth_percent` cells whose year is in the Geostat `preliminary_years` from §4.
- **Messages:** ka and en in `data/localization/{ka,en}/service-messages.json`.
- **Documentation:** a section in `docs/data-methodology/ai-grounding-and-caveats.md`, with the registered count updated, as `tests/factQuery/caveats/documented.test.ts` requires.
- **Page:** the GDP overview source note adds the same sentence for the real indicators when the range includes such a year (new `gdp.json` key in both locales).
- **Reference fixture:** GDP intents that return 2025 real cells gain this caveat. This spec approves that change; the plan lists every intent whose expected caveats change, and no other expectation may change. Any other disagreement stays a stop condition.

## 6. Public CSV writers

Evidence:

- **Duplicate writers:**
  - `scripts/prepare-gdp-public.ts` writes `public/downloads/data/gdp-overview.csv`, and `scripts/prepare-economic-sectors-public.ts` writes `economic-sectors.csv`.
  - `lib/factQuery/publications.ts` (`buildAllPublications`) also writes and byte-checks both files.
  - Their npm entries are `package.json:101-102` and `:105-106`, and they are chained into `predev`, `prebuild` and `postbuild` (`:10`, `:12`, `:14`).
- **Wipe and misleading check:** `lib/data/publicDatasetExports.ts:189` deletes the whole output directory first. `data:check-public-datasets` (`:186-193`) validates inputs only and never reads the written files.
- **Stale comment:** `scripts/prepare-fact-query-publications.ts:30-32` still says "the three public CSVs" and "immediately before this script runs".

Change:

- Delete both scripts, their four npm entries and their chain references.
- Rename `data:check-public-datasets` to `data:validate-public-dataset-inputs`, with behaviour unchanged, still in `data:validate`. Add `data:check-public-datasets-output`, which byte-compares the five written CSVs, and run it in `postbuild`.
- Correct the comment: five CSVs, written by `preparePublicDatasets`, which must run before the publications script because it wipes the directory.

Tests: `tests/data/publicDatasetExports.test.ts` covers the output check with a missing file and a changed byte. `tests/factQuery/queryGdp.test.ts:91` already covers the surviving GDP CSV writer.

## 7. Non-goals

- Deriving GDP summary text.
- Changing national GDP rounding, or merging nominal-GDP artifacts.
- Changing World Bank statuses.
- Removing the edition-pinning guards in the prepare scripts.

## 8. Documents to update in the same change

- `docs/data-methodology/gdp-overview.md`: summary review step, preliminary years from the manifest, and refresh order.
- `docs/data-methodology/national-nominal-gdp.md` and `docs/data-methodology/economic-sectors.md`: refresh order and the consistency check.
- `docs/data-methodology/general-government-balance.md`: manifest-driven vintage.
- `docs/data-methodology/ai-grounding-and-caveats.md` and `docs/data-methodology/ai-reference-intents.md`: the new caveat and the changed intents.
- DESIGN.md §8.6: rule wording.

## 9. Verification and acceptance

Feedback while editing:

```bash
npx vitest run tests/i18n/gdpSummaryFigures.test.ts tests/explorer/deficitRoute.test.tsx tests/data/publicDatasetExports.test.ts tests/factQuery/caveats
```

```bash
npx vitest run tests/factQuery/reference.test.ts
```

Data: `npm run data:validate`, including the new consistency check.

Done-check: `npm run check`, `npm run build` (with the changed `prebuild` and `postbuild` chains) and `npm run test:browser` on the production-build recipe.

Acceptance:

- Changing any GDP figure in the CSV fails the summary test, and so does adding an unlisted number to the text.
- A fixture edition with a 2026 first projection year moves the deficit marker and the text.
- A one-unit change in any nominal GDP artifact fails `data:validate`.
- `query_gdp` 2025 real cells carry the new caveat.
- Each public CSV has one writer, and `postbuild` checks the files on disk.

## 10. Authority and next step

This spec owns the bounded decisions in §1. The methodology documents stay the owners of data behaviour and are updated in the same change. After user review, the next step is an implementation plan at `docs/superpowers/plans/2026-09-17-data-refresh-safeguards.md`.

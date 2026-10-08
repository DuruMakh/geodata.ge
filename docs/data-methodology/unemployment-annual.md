# Annual unemployment data collection and validation

## Purpose and status

This methodology governs the research package at `docs/Raw Data/Unemployment/geostat-labour-force-annual/`, collected on 2026-10-03, and its approved annual explorer integration. The three primary CSVs are promoted byte for byte to `data/imports/unemployment-annual.csv`, `unemployment-education-annual.csv` and `unemployment-long-term-annual.csv`. The research captures remain immutable. The bounded explorer design is `docs/superpowers/specs/2026-10-04-unemployment-reuse-explorer-design.md`; MCP and central machine-readable publication integration are excluded.

`npm run data:prepare-unemployment` promotes the reviewed files; `npm run data:check-unemployment` checks byte equality, all nine source fingerprints, every primary value against its original worksheet cell, complete independent coverage inventories, published precision and statistical identities. The latter runs inside `data:validate`. Loaders preserve exact decimal strings and normalize sex explicitly; the long-term workbook's `Total` label is preserved as provenance while the public reference uses Georgia. Counts display as thousand persons and rates to one decimal. Missing historic groups remain unavailable.

Geostat's Labour Force Survey is the sole statistical source. Seven annual workbooks cover the national total, breakdowns by sex, settlement type, age, region and educational attainment, and long-term unemployment. The source page and survey metadata are preserved alongside the original workbooks. Exact URLs, retrieval dates, hashes and byte sizes live in the source manifest.

The approved static hub is `/explorer/unemployment`, with four data pages under `/overview`, `/regions`, `/age` and `/gender`, mirrored under `/en`. Urban/rural, education and long-term unemployment are supporting tabs on the national overview; its Overview tab contains the national composition chart. Shared links to the former single explorer preserve their settings on the matching new page. `/methodology/unemployment` remains in both languages. Only an applicable published reference is selected by default. Education references are clipped to its own source coverage; historical age bands and combined regions remain separate. The national composition chart uses exact employed, unemployed and outside-labour-force counts. The existing Excel writer exports the active indicator, selected groups and years with correct units and source links. Database mode checks every observation against CSV and fails on missing/mismatched rows; it never falls back silently. This navigation change does not alter canonical observations, source files or serving parity.

The age-page presentation approved on 2026-10-07 is limited to the modern source-published age bands from 2020 onward, without a national reference. Its eight existing indicators retain their matching age-group denominators and original values. Historical age observations remain intact in the canonical CSV and source archive. The youngest available group is selected initially; saved settings drop obsolete groups and fit to the loaded 2020+ coverage. The age-by-year heatmap uses all modern groups, the selected indicator and active years independently of chart selection, with one shared scale, one-decimal labels and dashes for missing observations. Excel retains only the selected age groups and years. Hired/self-employed age rows are not added by this presentation change.

## Indicators, units and definitions

| Indicator ID | Meaning | Unit / denominator |
| --- | --- | --- |
| `population_15_plus` | Survey population aged 15 and older | Thousand persons |
| `labour_force` | Employed plus unemployed | Thousand persons |
| `employed` | People who worked for pay/profit for at least one hour in the reference week, or were temporarily absent from a job | Thousand persons |
| `hired` | Published hired employees, national and urban/rural in 2010–2025; regions in 2020–2025 | Thousand persons |
| `self_employed` | Published self-employed workers, national and urban/rural in 2010–2025; regions in 2020–2025 | Thousand persons |
| `unemployed` | People without employment who actively sought work in the preceding four weeks and were available to start within two weeks | Thousand persons |
| `outside_labour_force` | People neither employed nor meeting the unemployment definition | Thousand persons |
| `unemployment_rate` | `unemployed / labour_force * 100` | Percent of labour force |
| `participation_rate` | `labour_force / population_15_plus * 100` | Percent of survey population aged 15+ |
| `employment_rate` | `employed / population_15_plus * 100` | Percent of survey population aged 15+ |

The survey covers private households and excludes occupied territories and institutional households. Demographic population counts must not substitute for the survey's population denominator. An unemployment rate is neither the share of all residents without work nor the share outside employment. The rates for women, men, age bands and regions use the matching group's denominator. Do not average group rates to obtain a national rate.

All rows use `frequency=annual`, `basis=actual` and `value_status=survey_estimate`. Here, actual distinguishes observed survey results from forecasts; it does not mean a census count. The package creates no estimates, interpolation, imputation or gap filling of its own.

## Time and classification boundaries

The 2026-10-06 regional navigation amendment uses the existing reviewed region-only geometry from Economy. The map and searchable list show each modern region's latest published unemployment rate, not a population-weighted or averaged estimate. Eleven modern regions have separate static pages in Georgian and English. Each page filters to the exact region ID and derives its available years from those observations: Imereti and Racha-Lechkhumi/Kvemo Svaneti start in 2019; Guria, Mtskheta-Mtianeti and Samtskhe-Javakheti start in 2017. No earlier combined value is copied into those series.

Regional pages reuse the overview's checkbox indicators, omitting employment rate. Hired and self-employed counts expand beneath Employed for all eleven modern regions in 2020–2025, as published in `geostat_lfs_annual_region`, sheet `1`. Earlier regional employment-status values remain unavailable. The selected regional series determine the displayed coverage: Employed with its children retains the longer parent history and missing child values before 2020; children alone use 2020–2025. Rates and thousand-person counts cannot be selected together. Excel titles and filenames identify the selected region, and rows preserve the original observations, units, missing values and validated source links. The index's supporting comparison view retains the two historical combined groups and former shared multi-region links, with gaps preserved. The employment-status addition changes no database structure or source archives.

The principal dataset is 2010–2025. Its national, sex and urban/rural series are complete across that period. There are 359 primary group-year records and eight indicators per record, yielding 2,872 observations.

Geostat's original files contain older data: national, sex and settlement from 1998; age from 2002; region from 2003. All 2,409 extracted pre-2010 observations are retained in `source-observations.csv`, separately marked `methodology_epoch=ilo13`. The principal output contains only `ilo19_20`. Geostat's metadata explicitly says the periods before and after 2010 are not comparable. The original 2010–2019 values have already been recalculated by Geostat; no recalculation is performed here.

| Source classification | Exact handling |
| --- | --- |
| Age bands, 2010–2019 | Retain the published ten-year bands, plus 65+. |
| Age bands, 2020–2025 | Retain the published five-year bands, plus 65+. |
| `Imereti**`, through 2018 | Use `region.imereti_racha_lechkhumi_kvemo_svaneti`; never assign this combined value to Imereti alone. |
| Imereti and Racha-Lechkhumi/Kvemo Svaneti, from 2019 | Use their separate region IDs. |
| `The remaining regions***`, through 2016 | Use `region.samtskhe_javakheti_guria_mtskheta_mtianeti`; never distribute the combined value among its three members. |
| Samtskhe-Javakheti, Guria and Mtskheta-Mtianeti, from 2017 | Use their separate region IDs. |

Each core group has its own explicit year inventory in `coverage.csv`; supplemental groups use `supplemental-coverage.csv`. Values outside those inventories are unavailable, not zero. Education and long-term unemployment are the separately approved additions described below. Municipal unemployment values, quarterly data, forecasts, NEET and labour-underutilization measures remain outside this collection.

## Education and long-term unemployment, 2020–2025

The two added official workbooks cover only 2020–2025 and provide total, women and men. The education workbook uses sheets `Total`, `Women` and `Men`; the long-term workbook uses sheet `1`. No earlier year is inferred or filled.

### Education

The source publishes participation, employment and unemployment rates for four levels: Primary or Lower Secondary, Upper Secondary, Vocational and Higher. IDs are `education.primary_or_lower_secondary`, `education.upper_secondary`, `education.vocational` and `education.higher`. Each rate uses its matching education/sex group's denominator. The primary file has 216 rate observations: four groups × three sexes × six years × three measures. Its readable summary contains 72 records.

The source also publishes each education group's share of the labour force, employed, unemployed, people outside the labour force and survey population aged 15+. These five distributions include a fifth category, No education, with ID `education.no_education`. They are retained with repeated totals in the 810-row `education-source-observations.csv` as validation evidence. They measure composition within a labour-status group; they are different from that education group's employment/unemployment rates.

The No education category has no published participation, employment or unemployment rates. All 54 unavailable year/sex/metric combinations are explicitly inventoried in `supplemental-unpublished-rates.csv`. This is structural non-publication, not a blank numeric source cell or a zero rate. No absolute education counts or additional rates are generated as published observations.

For validation only, each distribution share is multiplied by the same-year national or sex total to reconstruct a temporary count control. These controls must reconcile labour-force/population identities, sex totals and the published education rates within the established tolerances. They never appear in the exported education datasets as official counts. Distribution shares and their source totals must sum to 100%, including No education; rates are never added or averaged across groups.

### Long-term unemployment

Long-term means unemployment lasting 12 months or more. The 54 source observations contain three measures for each year and sex:

| Indicator ID | Unit and denominator |
| --- | --- |
| `long_term_unemployed` | Thousand persons |
| `long_term_unemployment_rate` | `long_term_unemployed / matching labour_force * 100` |
| `long_term_unemployed_share` | `long_term_unemployed / matching unemployed * 100` |

The last two are percentages with different denominators. Each women's or men's row uses the corresponding totals in the preserved sex workbook. Women plus men must reproduce the total count; each long-term count must be no larger than its matching unemployed count. The source's 2025 total publishes 79.4 thousand, 4.9% of the labour force and 35.5% of all unemployed people. These are three distinct observations. The readable summary has 18 annual records.

Across the core and additions, serving datasets have 3,370 observations: the original 3,142 primary observations plus 96 national/urban/rural hired and self-employed observations for 2010–2025 and 132 regional observations (eleven regions × six years × two categories) for 2020–2025. These 228 additional rows are promoted from the existing source extract into `data/imports/unemployment-employment-status-annual.csv`, preserving every source column and decimal string with UTF-8 BOM. Regional repeated Georgia totals are controls and excluded from serving. Complete-coverage validation requires the regional status categories only from 2020; historical combined groups receive no invented components. Full source extracts retain 7,073 numeric values: 6,209 core, 810 education and 54 long-term. The original research CSV values and coverage remain unchanged.

The employed total includes a small published `unidentified_worker` component. Source preparation checks hired + self-employed + unidentified against the official employed total and checks every component against its archived workbook cell, including each regional component in 2020–2025. The visible two subcategories are therefore not forced to sum to the employed total. Serving validation also checks component bounds and urban + rural and regional hired/self-employed totals against their national counterparts in their published years. The existing transactional database import consumes the fourth CSV and applies the same complete-coverage and field-by-field parity requirements.

The Unemployment overview uses multiple indicator checkboxes with one unit at a time. Choosing a percentage clears people counts and choosing a people count clears percentages. Its national list omits employment rate; settlement parents select their unemployment rate and expand to other measures; long-term parent rows select Georgia, with only Men/Women beneath them. Education displays unemployment rate only, while the other two rates remain preserved in the data. Excel exports label each selected indicator/group pair and retain its exact value, correct unit, years and source links.

## Extraction and provenance

The original XLSX files are immutable captures. `prepare.py` and its `supplemental.py` helper read their worksheet XML using Python's standard library. They preserve the stored decimal token without converting it through a binary floating-point number. Each observation records its source ID, sheet, cell, source metric label, original group label and number format. The supplemental datasets also retain `sex` because education groups occur in three separate sheets.

`value` retains source calculation precision. `published_value` rounds that value to one decimal, matching the original one-decimal formats (`0.0`, `#,##0.0` or `#\ ##0.0`). Percent distribution totals can have tiny stored calculation tails above 100; the percentage tolerance of 0.000001 applies without altering the stored value. The readable summaries use published precision and retain source cell references. Source precision is not a claim about sampling accuracy.

Mappings are explicit. The English age workbook contains the Georgian total label `სულ` in some older blocks; it is treated as the same total as `Total` and retained in `source_group_label`. Region footnotes are preserved in the original group label, with combined regions given distinct IDs. There is no fuzzy matching.

The `source-observations.csv` file retains all 6,209 extracted core values, including employment components where available and repeated national totals from the age and regional workbooks. The repeated totals use `role=control` and are excluded from the primary output to prevent double counting. Education repeated totals also use `role=control`. The sex-specific education source headings contain the spelling `lavel` in one section; this exact alias is explicitly recognized and retained in the source label. All CSVs use UTF-8 with BOM.

## Validation and evidence

The package's `--check` command regenerates expected outputs in memory and compares their bytes with the saved CSVs and JSON report. It also validates:

1. Exactly one manifest entry for each of the nine required captures, and every capture's SHA-256 fingerprint and byte size.
2. The observed source year coverage, expected worksheet names and layouts, explicit labels, numeric types, non-negative counts and percentages within the stated tolerance of 0–100.
3. Unique source/year/group/indicator keys (including sex for education), the complete expected core observation inventory, and all published supplemental metrics. The core inventory independently requires each published year, group, repeated total, core indicator and employment component; missing whole sections fail validation rather than disappearing from inferred coverage.
4. `labour_force = employed + unemployed` and `population_15_plus = labour_force + outside_labour_force`.
5. All three rates against their matching numerator and denominator. Zero population or labour force is a validation failure, not a rate of zero.
6. Employment components against employed where all three components are published.
7. Sex, settlement, age and region count sums against the national workbook, plus repeated national controls for all eight core indicators.
8. Sixteen independent annual headline controls from the official source page: labour force, employed, unemployed and unemployment rate for 2022–2025. Mixed quarterly headings on that page are excluded.
9. Education distributions, total rates, temporary count controls and the correct long-term denominators, count bounds and sex sums.

The count tolerance is 0.000001 thousand persons (0.001 person). The rate tolerance is 0.000001 percentage points. Headline controls must match exactly at published precision. Missing, non-numeric or stale data fail validation; no missing input is silently converted to zero or omitted from a reconciliation.

The observed result is zero duplicate keys, zero missing published numeric values, zero missing required published indicators, zero imputed values and **5,312 passing reconciliations**: 4,400 in `reconciliation.csv` and 912 in `supplemental-reconciliation.csv`. The 54 unpublished No education rates remain a separate availability inventory. A separate reader checks all 7,073 extracted values against their original Excel cells and verifies rejection of altered captures, duplicate records, missing values and incorrect rates; its evidence is saved in `independent-validation.json`. Eight focused supplemental tests also exercise the added coverage, absence of unpublished rates, and rejection of missing, duplicated or incorrectly exchanged long-term percentages.

Five core regression tests additionally reject omitted annual breakdowns, an omitted historical year, a missing published employment component, a combined region relabelled as one member, and an omitted required capture. Run all 13 tests from the package directory with `python -m unittest discover -s . -p "test_*.py"`. Run `python verify_independent.py` with openpyxl to repeat the separate Excel comparison and core negative checks; it prints fresh evidence without changing saved package files, using only disposable fixtures under the repository's `.tmp/` directory.

## Statistical limitations and future use

The current metadata reports a 2025 national unemployment-rate standard error of 0.5 percentage points and a 95% confidence interval of 13.0%–14.8%. That interval is a national annual control, not a supplied uncertainty interval for every breakdown. This package does not establish statistical significance for changes or rankings.

Geostat used its Integrated Household Survey through 2016 and a separate Labour Force Survey from 2017. Its metadata documents the earlier census-based revisions and sampling frame. Those source-system changes should accompany later public methodology, even within the post-2010 definition.

Later integration must preserve the annual frequency, survey denominators, source precision, methodology boundary and changing group coverage. Any decision to combine later age bands or regions into a longer derived series requires a separately reviewed calculation; none is created here. Do not apply the budget dataset's municipal exclusion codes to these regional survey groups.

Original sources: [Geostat Employment and Unemployment](https://www.geostat.ge/en/modules/categories/683/Employment-Unemployment), its seven annual workbooks linked in the package README, and [Labour Force Survey metadata, updated 20 May 2026](https://www.geostat.ge/media/79111/0708_200526_EN.PDF).

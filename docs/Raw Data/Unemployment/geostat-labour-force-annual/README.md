# Geostat annual unemployment research package

Collected on **3 October 2026**. The user approved annual figures only.

This package establishes the data foundation for Fiscal.ge's unemployment statistics. It preserves seven official Geostat workbooks, their source page and current survey metadata. The core dataset covers **2010–2025**; the approved education and long-term unemployment additions cover **2020–2025**. The 2026-10-04 approved explorer integration promotes these three primary files unchanged into `data/imports/`, reuses the existing charts/tables/Excel writer and adds a private parity-checked serving mirror. Local verification is recorded in the explorer spec and plan. GitHub publication, live database migration/import and production deployment remain separate delivery operations; unemployment MCP and central dataset publications are excluded.

## What is ready

The core dataset contains **2,872 observations**, representing eight indicators for **359 group-year records**:

| Breakdown | Group-year records | Published coverage |
| --- | ---: | --- |
| Georgia total | 16 | 2010–2025 |
| Women and men | 32 | 2010–2025 |
| Urban and rural areas | 32 | 2010–2025 |
| Age groups | 126 | Wider age bands through 2019; narrower bands from 2020 |
| Regions and explicitly combined regional groups | 153 | Group composition changes in 2017 and 2019 |
| **Total** | **359** | **2010–2025** |

The indicators are the unemployed count and unemployment rate, with the population aged 15+, labour force, employed count, population outside the labour force, participation rate and employment rate retained to explain and check the unemployment figures.

**2025 national figures:** unemployment rate **13.9%**, unemployed **224.0 thousand**, labour force **1,613.7 thousand**, employed **1,389.7 thousand**. These are survey estimates at Geostat's published precision. The stored worksheet values have additional decimal places; those are retained for reconciliation, not presented as additional statistical accuracy.

### Education and long-term unemployment additions

Both additional official tables publish **2020–2025 only**, with Georgia total, women and men. Earlier years are unavailable in these captures and are not estimated.

| Addition | Published measures | Primary records / figures |
| --- | --- | ---: |
| Education | Unemployment, employment and labour-force participation rates for four education levels | 72 year/sex/education records; 216 figures |
| Long-term unemployment | People unemployed for 12 months or more, their rate relative to the labour force, and their share of all unemployed people | 18 year/sex records; 54 figures |

The four education levels are **primary or lower secondary**, **upper secondary**, **vocational**, and **higher**. The source publishes no absolute counts per education level. It also provides percentage distributions that include **No education**, but omits that group's three rates. Those 54 unpublished year/sex/rate combinations are recorded separately in `supplemental-unpublished-rates.csv`. No rate or education count is invented or substituted with zero.

For 2025, Geostat reports **79.4 thousand long-term unemployed people**, a **4.9% long-term unemployment rate**, and a **35.5% share of all unemployed people**. The last two percentages have different denominators. Each women/men figure uses its matching sex-specific denominator.

The combined primary datasets contain **3,142 figures**. All original numeric cells are retained separately: **6,209 core + 810 education + 54 long-term = 7,073 source values**. The education source's distributions and repeated totals support validation and are retained in `education-source-observations.csv`.

## Files to review

| File | Purpose |
| --- | --- |
| `unemployment-summary.csv` | Easy-to-read annual group records, using the same one-decimal presentation as the originals. Counts are thousand persons; rates are percentages. |
| `unemployment-annual.csv` | Main 2010–2025 dataset, one row per indicator, with original precision and Excel cell references. |
| `coverage.csv` | The exact available years for each group. A missing group outside its published coverage is not a zero. |
| `source-observations.csv` | All 6,209 core source observations, including older history, auxiliary employment categories and repeated national totals used as controls. |
| `education-summary.csv` | Readable rates for four education levels, by year and sex, for 2020–2025. |
| `education-annual.csv` | The 216 primary education rate observations with original precision and source cells. |
| `education-source-observations.csv` | All 810 published education percentages, including distribution shares and totals used for validation. |
| `long-term-unemployment-summary.csv` | Readable long-term counts, rates and shares by year and sex. |
| `long-term-unemployment-annual.csv` | All 54 long-term observations with original precision and source cells. |
| `supplemental-coverage.csv` | Published year ranges for the education and long-term groups. |
| `supplemental-unpublished-rates.csv` | Explicit inventory of unpublished rates for the No education group. |
| `source-manifest.csv` / `source-manifest.json` | Exact source URLs, retrieval date, local filenames, byte sizes and SHA-256 fingerprints. |
| `reconciliation.csv` | All 4,400 arithmetic and cross-file comparisons, their tolerances and results. |
| `supplemental-reconciliation.csv` | All 912 additional education and long-term comparisons. |
| `supplemental-validation-report.json` | Coverage, unavailable rates and validation results for the two additions. |
| `validation-report.json` | Coverage, source fingerprints, missing values, duplicates, validation results and limitations. |
| `independent-validation.json` | Separate Excel-cell comparison and tests that the checker rejects invalid or altered inputs. |
| `platform-verification.json` | Final local platform-check and build results, including the cleared image/font timeouts described below. |
| `official/` | Original Geostat files, preserved without editing. |
| `prepare.py` | Reproduces the CSVs and report from the preserved files; uses Python's standard library and makes no network requests. |
| `supplemental.py` | Reads and validates the two additional source layouts as part of `prepare.py`. |
| `test_supplemental.py` | Eight checks covering the additions, including missing values, duplicates and incorrectly exchanged percentages. |
| `test_validation.py` | Five regression tests rejecting omitted annual sections, whole historical years, missing employment components, incorrectly relabelled combined regions and omitted source captures. |
| `verify_independent.py` | Reruns the separate Excel-cell comparison and core negative tests without changing the saved package. Requires openpyxl. |

Every CSV uses UTF-8 with BOM so Georgian source text can be opened directly in Excel. `source_group_label` preserves original group labels, including Geostat's starred regional labels and the Georgian `სულ` total label found in the English age workbook.

## Comparisons that require care

1. **2010 is a methodology boundary.** Geostat recalculated 2010–2019 using the newer ILO employment standards. The 1998–2009 series uses an older definition and must not be joined to the main series as a continuous trend. Older observations remain in `source-observations.csv`, marked `methodology_epoch=ilo13`; the main dataset uses `ilo19_20`.
2. **Age groups change in 2020.** The 2010–2019 data use 15–24, 25–34, 35–44, 45–54, 55–64 and 65+. From 2020 the source publishes five-year bands from 15–19 through 60–64, plus 65+. No wider band was split or estimated. For example, the directly published 15–24 series ends in 2019.
3. **Imereti's earlier figures include another region.** Through 2018, `Imereti**` includes Racha-Lechkhumi and Kvemo Svaneti. Those values use a separate combined-group ID. Separate Imereti and Racha-Lechkhumi/Kvemo Svaneti figures begin in 2019.
4. **Three other regions were combined through 2016.** Samtskhe-Javakheti, Guria and Mtskheta-Mtianeti use one combined group until 2016 and separate groups from 2017. Their earlier individual figures are unavailable here.
5. **Unemployment is different from all people without work.** The unemployment rate is unemployed people divided by the labour force: employed plus unemployed. People outside the labour force are a separate category. Do not divide unemployment by total population or label everyone outside employment as unemployed.
6. **This is a household sample survey.** It covers people aged 15+ in private households and excludes institutional households and occupied territories. Demographic population tables and employer surveys have different coverage. They must not replace the survey's denominators.

The current metadata reports a **2025 national unemployment-rate 95% confidence interval of 13.0%–14.8%**. This describes survey uncertainty; it is not an interval supplied for every age group, sex or region. Small changes should not automatically be described as statistically significant.

## Validation results

- Nine source captures match their recorded fingerprints and byte sizes.
- The manifest must contain all nine required sources exactly once. Every expected core source/year/group/indicator combination must be present, including repeated totals and published employment components; entire missing sections cannot be skipped.
- All 7,073 source observations have unique keys within their dataset; the education key includes sex.
- Zero blank published source values, missing required published indicators or imputed values. Unpublished No education rates are recorded separately.
- All **5,312 reconciliations** pass: 4,400 core comparisons and 912 supplemental comparisons. Older core history is checked separately within its own definition.
- Labour force equals employed plus unemployed; population aged 15+ equals labour force plus people outside it.
- The three rates reproduce from their matching survey counts.
- Employment categories sum to employed where the source publishes those categories.
- Sex, settlement, age and regional counts reproduce the national totals in each available year. Repeated age/regional national totals agree with the national workbook.
- All 16 annual headline values on the preserved official page (four measures for 2022–2025) agree exactly at published precision. The page's quarterly columns are excluded.
- Education distribution shares sum to 100%, and total rates match the national and sex workbooks. Temporary count controls reconstructed from those shares reproduce the published rates and identities; they are never exported as official education counts.
- Long-term women and men sum to the total, counts never exceed the matching unemployed totals, and rates/shares reproduce using the correct denominators.
- A separate Excel reader matches all 7,073 numeric source cells, with no omitted cells. All eight supplemental tests pass.

Count reconciliations allow at most **0.000001 thousand persons (0.001 person)**; rate reconciliations allow **0.000001 percentage points**. These small allowances account for stored calculation precision. No values are altered to force a reconciliation.

### Supporting platform checks before explorer integration

The final local release checks on **4 October 2026** pass: `npm run check` includes style, type, data and translation checks, with **2,738 passing tests and seven skipped tests**; `npm run build` also passes. The earlier image/font timeouts cleared on an unchanged retry with normal network access. No application source changes were needed. The independent research comparison matches all 7,073 Excel cells, and all 13 research tests pass. Required GitHub checks and review remain mandatory before merging.

## Reproduce or verify

From this directory, using Python 3:

```text
python prepare.py
python prepare.py --check
python -m unittest discover -s . -p "test_*.py"
python verify_independent.py
```

The first command regenerates only the derived research files. The second checks them without writing. Both validate the complete source inventory, fingerprints, published observation coverage, numeric values and arithmetic, and exit with an error for a failed validation. The test command runs all 13 focused tests. Original captures and the manifest are never modified by these commands. Preserve any later Geostat revision as a separate capture and review it before replacing this dataset.

The independent command requires openpyxl, available in Codex's bundled Python. It prints fresh comparison results without rewriting the saved data or reports. Its altered-source test uses a temporary fixture under the repository's `.tmp/` directory and removes that fixture afterward. `independent-validation.json` preserves the recorded verification run; the command verifies the current files again.

## Official sources

Geostat's [Employment and Unemployment page](https://www.geostat.ge/en/modules/categories/683/Employment-Unemployment) supplies the seven annual workbooks:

- [National labour force indicators](https://geostat.ge/media/78735/01-Labour-Force-Indicators.xlsx)
- [Indicators by sex](https://geostat.ge/media/78736/02-Labour-Force-Indicators-by-sex.xlsx)
- [Indicators by urban/rural area](https://geostat.ge/media/78737/03-Labour-Force-Indicators-in-urban-rural-areas.xlsx)
- [Indicators by age group](https://geostat.ge/media/78738/04-Labour-Force-Indicators-by-age-groups.xlsx)
- [Indicators by region](https://geostat.ge/media/78739/05-Labour-Force-Indicators-by-regions.xlsx)
- [Indicators by educational attainment](https://geostat.ge/media/78747/13-Labour-force-indicators-by-education.xlsx)
- [Long-term unemployment](https://geostat.ge/media/78750/16-Long-term-unemployment.xlsx)

Definitions and survey limitations follow Geostat's [Labour Force Survey metadata, updated 20 May 2026](https://www.geostat.ge/media/79111/0708_200526_EN.PDF), especially sections 3.4, 3.6–3.8, 13.2, 15.2–15.3 and 18.1. The workbook footnotes identify the newer standards as the 19th and 20th ICLS; the metadata describes the 19th ICLS and the recalculation of 2010–2019.

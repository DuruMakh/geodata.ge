# Health and social protection hub: Pensions and social help pages

Date: 2026-10-20
Status: Draft for Duru's review.

How it was approved so far:

- On 2026-10-16 Duru picked social protection as the next data and asked to use the Social Service Agency (SSA) statistics.
- On 2026-10-19 Duru replied "okay continue" to the page set. That set was Pensions, Subsistence allowance and Social package, plus an overview of money paid by programme. Children and maternity and the IDP allowance come later. Funded pensions, care institutions and disability healthcare stay out.
- Duru then answered two questions:
  - **"A" for money:** a yearly money figure is the sum of SSA's 12 monthly "amount transferred" totals, and the methodology page says fiscal.ge added it up.
  - **"A" for the source:** people and money both come from SSA, and Geostat is used only as a cross-check.

This approval changes the scope. `Project_Definition.md` §2L says pensions and social help "may become later cards and are not shown now". This design records the owner's approval to show them.

## 1. Intended result

Readers of fiscal.ge should be able to see, year by year since 2013, how many people receive Georgia's main social benefits and how much money is paid. They should be able to see this for Georgia, each region and each municipality.

The pages answer five questions:

- **How much does the state pay in social benefits?** In 2025 SSA transferred 6.17 billion GEL across its programmes, against 1.62 billion in 2013. Pensions were 4.26 billion of that.
- **How many pensioners are there?** There were 888,518 in December 2025 and 686,675 in December 2013.
- **How big is the average pension, and has it kept up with prices?** It was 405 GEL a month in 2025 and 133 GEL in 2013. At 2025 prices, the 2013 pension is worth about 231 GEL.
- **How many families live on the subsistence allowance?** In December 2025, 129,506 families (463,122 people) received it, out of 397,144 families registered in the social assistance database. Another 54,842 families stayed on it through the public employment programme.
- **Where?** Every municipality's share of residents who receive a pension or live in a family on the allowance is shown on the municipality map, and each municipality has its own page.

The pages keep the production editorial look. They reuse the Population and Education place pages, the series list with headings, the municipality map, the table and the Excel download. No new chart type, chart library or visual direction is added.

## 2. Pages and navigation

| Page | Georgian path | English path | Georgian name (proposal) |
| --- | --- | --- | --- |
| Social payments | `/explorer/health/social-payments` | `/en/explorer/health/social-payments` | სოციალური გასაცემლები |
| Pensions (map index) | `/explorer/health/pensions` | `/en/explorer/health/pensions` | პენსიები |
| Pensions, Georgia | `/explorer/health/pensions/georgia` | `/en/…` | პენსიები — საქართველო |
| Pensions, region | `/explorer/health/pensions/region/[id]` | `/en/…` | პენსიები — {region} |
| Pensions, municipality | `/explorer/health/pensions/[slug]` | `/en/…` | პენსიები — {municipality} |
| Subsistence allowance (map index) | `/explorer/health/subsistence-allowance` | `/en/explorer/health/subsistence-allowance` | საარსებო შემწეობა |
| Subsistence allowance, Georgia / region / municipality | as Pensions, under `/subsistence-allowance` | `/en/…` | საარსებო შემწეობა — {place} |
| Social package | `/explorer/health/social-package` | `/en/explorer/health/social-package` | სოციალური პაკეტი |
| Methodology | `/methodology/social-protection` | `/en/methodology/social-protection` | სოციალური დაცვა |

- **Place pages** follow Population and Education exactly. There is a page for Georgia and for each of the 11 regions (`region/[id]`, using the site's region ids). The 63 municipalities other than Tbilisi use `[slug]`, the Budget slugs. Tbilisi is one place, `region/tbilisi`. That makes 75 place pages per page set and locale. An unknown id or slug returns a 404.
- **Hub.** The hub keeps its three Health cards and adds four cards after them, in this order:
  - Social payments
  - Pensions
  - Subsistence allowance
  - Social package

  Each card reuses the shared hub card with a sparkline of its default Georgia series, the latest figure and the coverage, all taken from served facts.
- **Sidebar.** The four pages appear under **Health and social protection**, after Causes of death.
- **Page furniture.** Breadcrumbs, headings, language links, metadata, Dataset JSON-LD and the sitemap follow the existing pattern.
- **Names.** The Georgian names are proposals for Duru's Georgian proofread. SSA's own names are «სახელმწიფო პენსია», «საარსებო შემწეობა» and «სოციალური პაკეტი».

## 3. Shared page rules

These rules apply to every page in this design:

- **Under the heading.** There is one short line from `LatestValueLine`, worded as each page below says, and it fits on one line on a phone. Nothing else sits under the heading. The only text under the chart is one short source line.
- **No tabs.** Measures sit under small headings in the right-hand series list. Every row is visible from the start, with no caret-hidden subcategories.
  - The one icon switch is on Social payments: million GEL or % of GDP, as on Money and banks. It is an alternate view of the same money.
- **One heading at a time.** As on the Business and Education area pages, the chart shows the rows of one heading. Ticking a row under another heading replaces the selection with that row. The chart, table, years and Excel follow the selection's heading. This reuses `lib/explorer/unitList.ts`.
- **Default selection.** Only the default series named for each page is selected on arrival. It stays first, selectable and removable, and selection is unlimited.
- **Series names.** They carry no prefixes. Outside the list (chart legend, tooltip, table, Excel) a row is named in full as `Heading — Row`, for example `Money paid — High-mountain supplement`.
- **Colours.** Every series has a fixed, distinguishable colour, and the default series is ink.
- **Missing values.** A year without a value is a gap in the chart, a dash in the table and a blank Excel cell, never zero.
- **Controls and URL.** Chart | Table, the year range, the selection (including an empty one) and Excel work as on Business. They live in the URL hash and survive a language change.
- **Years.** Every series runs from 2013, the first full year of SSA's current tables, to 2025.
  - 2026 is left out until its 12 months are published.
  - Series that start later begin in their first full year, for example the high-mountain supplements in 2016.
  - The share-of-residents rows start in 2014 (§9).
- **Source line.** It reads like the others, for example "Source: Social Service Agency · 2013–2025 · Methodology and sources".

### How a yearly figure is made

SSA publishes every figure month by month. A year is built as follows, the same way everywhere:

| Measure | Yearly figure | Published or calculated |
| --- | --- | --- |
| People, families | December count | As published by SSA |
| Money paid | Sum of the 12 monthly "amount transferred" totals | Added up by fiscal.ge |
| Average per month | Year's money ÷ sum of the 12 monthly counts, so it is what one recipient got in an average month | Calculated by fiscal.ge |
| Average at 2025 prices | Average × (2025 average consumer price index ÷ that year's average index), using Geostat's headline index already served on the Inflation pages | Calculated by fiscal.ge |
| Share of residents | December count ÷ residents on 1 January of the next year × 100 (the population date nearest to the December count), using Geostat's municipal population already served on the Population pages | Calculated by fiscal.ge |
| % of GDP | Year's money ÷ Geostat's nominal GDP already served on the site × 100 | Calculated by fiscal.ge |

- People are never added across programmes. A pensioner can also get a high-mountain supplement or live in a family on the subsistence allowance.
- Money can be added across programmes, and Social payments does so (§4).
- The methodology page says which figures are SSA's own and which fiscal.ge calculated.

## 4. Social payments page

This page covers Georgia as a whole, 2013–2025. The line under the heading reads "2025: 6.17 billion GEL paid in social benefits".

There is one list under one heading, **Money paid**, in million GEL. An icon switch reusing the Money and banks share-of-GDP icon (Lucide `ChartPie`) shows the same rows as % of GDP. The rows are:

- **All programmes** (selected). This is the sum of the rows below for each year. It is a total added up by fiscal.ge, and the methodology page says so.
- State pension.
- High-mountain pension supplement.
- Social package.
- High-mountain social package supplement.
- Subsistence allowance.
- IDP and refugee allowance.
- State compensation and academic stipend.
- Maternity, childcare and adoption benefit.
- Child benefit for the third and later child.
- High-mountain child benefit.
- Household utility subsidy.
- Electricity tariff subsidy.
- High-mountain electricity discount.
- Electricity subsidy for large families.
- Water and sewerage subsidy.
- High-mountain doctors' and nurses' supplement.
- Workplace-injury compensation.
- COVID-19 compensation, 2020–2021 only.

Notes on the rows:

- Pensioners with IDP status are part of the state pension. They are shown on the Pensions pages, not here, so they are not counted twice.
- A programme that ran for only part of a year shows its published months: COVID-19 compensation ran six months in each of 2020 and 2021, and workplace-injury compensation's 2013 figure covers nine months. The table marks such a year, and the methodology page lists them.

## 5. Pensions

**Index** (`/explorer/health/pensions`), following the Population and Education index:

- The line under the heading reads "2025: 888,518 pensioners".
- Below it are the shared `MunicipalitiesIndex` municipality map and list, shaded by **pensioners per 100 residents** in 2025, with the occupied-territory overlays.
- Georgia is the first, unranked row of the list.
- Every region and municipality, on the map or in the list, links to its own Pensions page. Tbilisi opens `region/tbilisi`.
- There is no chart workspace on the index. The one source line names the source and the map's year and carries the geoBoundaries credit.

**Place pages** follow the Education place pages. Each has:

- the `EntityHeading`, with the place picker and previous/next links;
- one line under the heading, for example "2025: 888,518 pensioners · Georgia";
- the chart workspace;
- on a region's page, the list of its municipalities ranked by pensioners.

The series list has four headings:

- **Pensioners**, in persons, December:
  - **State pension** (selected);
  - IDP-status pensioners;
  - High-mountain supplement, from 2016.
- **Share of residents**, in %, from 2014:
  - Pensioners per 100 residents.
- **Money paid**, in million GEL:
  - State pension;
  - IDP-status pensioners;
  - High-mountain supplement, from 2016.
- **Average per month**, in GEL:
  - Average pension;
  - Average pension at 2025 prices;
  - High-mountain supplement, from 2016.

Every place uses the same national price index for "at 2025 prices", and the methodology page says so. The high-mountain supplement is paid on top of the pension, so its average is not added to the pension.

## 6. Subsistence allowance

**Index** (`/explorer/health/subsistence-allowance`), as for Pensions:

- The line under the heading reads "2025: 129,506 families receive the allowance".
- The map is shaded by **people in receiving families per 100 residents** in 2025.

**Place pages**, as for Pensions, have one line under the heading, for example "2025: 129,506 families · Georgia". The series list has five headings:

- **Families**, December:
  - **Receiving the allowance** (selected);
  - Kept on it through the employment programme, from 2022;
  - Registered in the database.
- **People**, December:
  - In receiving families;
  - Registered in the database.
- **Share of residents**, in %, from 2014:
  - People in receiving families per 100 residents;
  - Registered people per 100 residents.
- **Money paid**, in million GEL:
  - Subsistence allowance, the total including employment-programme families;
  - Of which to employment-programme families, from 2022.
- **Average per month**, in GEL:
  - Average per receiving family. This covers regular recipients only, using the money paid to them and their monthly counts.

How the rows work:

- **"Registered in the database"** counts families and people who applied and were scored in the targeted social assistance database, whether or not they receive money. It comes from SSA's database table 1 (`tsa_db-01`). The research package reads its December municipal rows; today it extracts only the national total.
- **The employment programme.** From 2022, families who found work under the public employment programme keep their status and payment for up to four years. SSA counts them in a separate column, so from 2022 "Receiving the allowance" leaves them out.
  - This is recorded as a counting change at 2022 (§10), drawn as a "new counting" rule on the families, people and share rows.
  - The employment-programme families are their own row, so a reader can tick both.
  - The research package does not extract a people count for the employment-programme families by municipality, so there is no such people row.

## 7. Social package

This page covers Georgia as a whole, 2013–2025, with no map. SSA publishes the eligibility groups only nationally. The line under the heading reads "2025: 187,764 social package recipients".

The series list has three headings:

- **Recipients**, in persons, December:
  - **All recipients** (selected);
  - People with disabilities;
  - Children with disabilities, from 2017;
  - Severe disability, from 2017;
  - Significant disability, from 2017;
  - Moderate disability, from 2017;
  - Survivors (family members who lost a breadwinner);
  - War participants, from 2019;
  - Victims of political repression;
  - Other groups.
- **Money paid**, in million GEL: the same rows.
- **Average per month**, in GEL: All recipients.

SSA redesigned the group table in 2025: disability is split by severity there, and state-compensation recipients become a cross-cutting column. The mapping:

- People with disabilities: SSA's single 2013–2024 column. For 2025 it is the sum of SSA's four disability "total" columns (children, severe, significant, moderate). That is an exact sum of published totals, and the methodology page says so.
- The four disability rows: SSA's columns, 2017–2025.
- Survivors, war participants and political repression: SSA's matching columns in both designs.
- Other groups: the remaining columns in each design.
  - Up to 2024: compensation recipients, utility-subsidy recipients and "other".
  - From 2025: defence veterans and "social package by acquired right".
  - It is recorded as a counting change at 2025 (§10).
- Checks confirm that, every year, the groups add up to SSA's printed total.

## 8. Data foundation

### Sources

| Source | Used for | Years served |
| --- | --- | --- |
| SSA statistics, `ssa.moh.gov.ge/statistiklist.php`: pension tables 1, 2 and 4 | Pensioners, IDP-status pensioners, high-mountain supplement: December counts and monthly amounts by municipality | 2013–2025 (supplement 2016–) |
| SSA subsistence allowance tables 1 and 2 | Receiving families and people, employment-programme families, money (including the employment-programme part) by municipality | 2013–2025 |
| SSA database table 1 (`tsa_db-01`) | Registered families and people by municipality | 2013–2025 |
| SSA social package tables 1 and 2 | Recipients and money by eligibility group (national) | 2013–2025 |
| SSA tables for the other programmes in §4 | Monthly national amount transferred | 2013–2025, as published |
| Geostat municipal population (already served by Population) | Share of residents | 1 January 2015–2026 |
| Geostat headline consumer price index (already served by Inflation) | Average at 2025 prices | 2013–2025 |
| Geostat nominal GDP (already served) | % of GDP | 2013–2025 |
| Geostat social protection tables (category 55) | Cross-check only, not served | — |

- The SSA originals are already in the repository: `docs/Raw Data/Social/ssa-statistics/official/` holds all 1,027 workbooks for 13 topics, collected through Duru's Chrome on 16–18 October 2026. `MANIFEST.csv` gives each file's SHA-256, and every hash was checked again in the cloud on 2026-10-20.
- The research package next to them already has these files: `prepare.py`, `verify_independent.mjs`, the unit tests, `validation-report.json`, `independent-validation.json`, `area-mapping.csv`, `coverage.csv` and `source-findings.csv`.
- It produces `ssa-programmes-monthly.csv` and `ssa-programmes-areas-annual.csv`, and the yearly figures in this design come from it.
- The Geostat package next to it (`geostat-social-protection/`) holds the 46 December comparisons with SSA, all matching.
- **Source links.** SSA renames its files on every upload, so source links point to the SSA statistics topic page, not to a file. Each served value keeps the workbook, sheet and cell it came from in the canonical file.

### Places

- SSA's rows use old district ("რაიონი") names and five combined Tbilisi districts. They are matched to the site's municipality codes and region ids through the package's reviewed `area-mapping.csv`, which already maps every row from 2008 to 2026. A label the mapping does not know stops preparation.
- **Region values** are SSA's printed region subtotal rows, never sums computed by fiscal.ge. **Georgia's values** are SSA's printed national total row.
- **Excluded areas.** Abkhazia, Akhalgori and the other areas in municipal codes 05, 42, 43, 46 and 64 have their own SSA rows and are part of SSA's Georgia total. They are kept in the data with their own ids but are not places on the map and have no page, as on Budget and Population.
- `source-findings.csv` records where SSA's printed totals differ from the sum of its area rows. Those printed totals are served as printed. The checks allow exactly the recorded differences and no others.

### Canonical file

- **Prepare script.** `npm run data:prepare-social` reads the research package's generated CSVs and writes `data/imports/social-protection-annual.csv` (UTF-8 with BOM) and `data/reports/social-protection-validation.json`. With `--check` it reproduces both byte for byte, and it runs inside `data:validate`.
- **Row contents.** Each row keeps:
  - the indicator, area, year and unit (`persons`, `families`, `gel`, `gel_million`, `percent`);
  - `basis=actual`;
  - a value status: `official` for a December count or printed national figure, `calculated` for a 12-month sum, an average, a share, a value at 2025 prices, a % of GDP or a sum of programmes;
  - the number of months the value covers;
  - the source id, workbook and cell, or, for a 12-month sum, the 12 cells.
- **Stable IDs.** They are lowercase and follow `social.{programme}.{measure}`, for example:
  - `social.pension.recipients`, `social.pension.amount`, `social.pension.avg_monthly`, `social.pension.avg_monthly_real`, `social.pension.share_residents`;
  - `social.subsistence.families`, `social.subsistence.registered_families`, `social.subsistence.employment_families`;
  - `social.social_package.disability.recipients`;
  - `social.payments.total.amount`.
- **Rejected by validation:**
  - a changed value;
  - a missing, extra or duplicate observation;
  - a year outside 2013–2025;
  - a 12-month sum with fewer months than SSA published;
  - a zero where SSA's cell is blank.
- **Checked by validation, within rounding:**
  - each yearly money figure equals the sum of its monthly cells;
  - municipalities and excluded areas add up to their region, and regions add up to Georgia, except the differences recorded in `source-findings.csv`;
  - social package groups add up to SSA's total every year;
  - "All programmes" equals the sum of its rows;
  - SSA's December national counts equal Geostat's published figures for the 46 recorded comparisons;
  - these anchor values match:

| Measure | Value |
| --- | --- |
| Pensioners, December 2025 | 888,518 |
| Pensions paid, 2025 | 4,262,309,090 GEL |
| Average pension, 2025 | 405.13 GEL |
| Average pension, 2013 | 133.23 GEL |
| Receiving families, December 2025 | 129,506 |
| People in receiving families, December 2025 | 463,122 |
| Employment-programme families, December 2025 | 54,842 |
| Registered families, December 2025 | 397,144 |
| Subsistence allowance paid, 2025 | 855,291,818 GEL |
| Social package recipients, December 2025 | 187,764 |
| Social package paid, 2025 | 544,241,359 GEL |
| All programmes paid, 2025 | 6,166,123,811 GEL |

**Rough size.** Pensions and the subsistence allowance are about 78 areas (Georgia, 11 regions, 64 municipalities and the excluded areas) × 13 years × about 13 series. Social package and Social payments add about 700 values. That comes to about 14,000 served values; the plan fixes the exact count.

### Serving

- All pages stay prerendered. The CSV loader and numeric client projection follow Education.
- The private Supabase mirror gets a `SocialFact` table in one versioned migration, with RLS on and public grants revoked.
- The transactional `data:import` compares it field by field, and CSV and database modes must serve identical values.
- The live migration and import happen only when Duru merges, through the existing release pipeline.
- Like Health and Education, these pages are not added to the `/mcp` fact-query snapshot or the JSON publications.

## 9. Share of residents

- The share uses the population on 1 January of the next year (for December 2025, 1 January 2026), from `data/imports/demography-population-annual.csv`, for Georgia, each region and each municipality. That file starts on 1 January 2015, so shares run from 2014.
- A place without a population figure gets no share for that year: a gap, not zero.
- Excluded areas have no Geostat population and no share.
- SSA's database table prints its own share of registered people in the whole population. It is used only as a check that fiscal.ge's figure is close; the methodology page explains why fiscal.ge computes its own (one population source and one date rule for every year and place).

## 10. Counting changes (series breaks)

These are recorded in `data/imports/social-protection-series-breaks.csv` in the demography break format, and drawn with `EditorialLineChart` `breaks` and `ExplorerTable` `breakYears`.

| Break | Applies to | Year | What changed |
| --- | --- | --- | --- |
| `subsistence_employment_2022` | Receiving families, people in receiving families, their share of residents | 2022 | Families kept on the allowance through the public employment programme are counted separately from 2022. |
| `social_package_groups_2025` | Social package "Other groups" and People with disabilities | 2025 | SSA redesigned the group table: disability is split by severity, and state-compensation recipients become a cross-cutting column. |

The methodology page also notes these points without drawing them:

- The September 2012 redesign, when disability and survivor pensions moved to the social package. This is why the pages start in 2013.
- The 2020 electricity subsidies, which were barely paid in some COVID months.
- The two months where SSA left a national count blank, March 2020 for the two electricity programmes, which are used as blanks and not zeros.

## 11. Sources, Excel and methodology

- **Source archive.** SSA and Geostat files are listed in a new source archive, `data/methodology/source-archives/social-protection.csv`, pointing at the SSA topic pages. The methodology bundle must not pull the 219 MB of raw workbooks (the PR #170 rule).
- **Excel.** It reuses the three-sheet writer (Summary, Data, Sources) in the reader's language, with the active heading's selected series and years.
  - It has explicit units, blank missing cells and validated source links.
  - A "calculated by fiscal.ge" note sits on the Summary sheet when any calculated series is included.
  - It has no internal-identifier or cell-reference columns.
- **Methodology.** `/methodology/social-protection` explains in plain words:
  - who runs each programme and publishes the data (the Social Service Agency);
  - what each benefit is and who gets it;
  - the December rule for people and the 12-month sum for money;
  - how the average and the "at 2025 prices" figure are calculated;
  - the share of residents and its population date;
  - why people are never added across programmes;
  - the employment programme;
  - the 2025 social package redesign;
  - the 2012 redesign;
  - how SSA's old district names were matched to today's municipalities;
  - the excluded areas;
  - that SSA's figures match Geostat's;
  - that the pages state no causes or explanations.
- **Documents updated during implementation:**
  - `Project_Definition.md`: a new approved section for these pages, plus §2L's "not shown now" line updated;
  - `DESIGN.md`: the hub cards, the four pages and the place pages;
  - a new `docs/data-methodology/social-protection-annual.md`;
  - `docs/data-methodology/database-import.md`: the new table.

## 12. Out of scope

Each of these would need its own approval:

- children and maternity pages and the IDP allowance page (planned next);
- a table of the small programmes;
- funded (accumulative) pensions;
- care institutions;
- disability healthcare;
- pensions by age and sex;
- subsistence allowance by age, household size or score band;
- pre-2013 data;
- monthly figures;
- 2026 before its year is complete;
- budget comparisons;
- MCP tools and the JSON/CSV publications.

## 13. Verification

1. The canonical file reproduces every served value from the original cells. The independent verification passes, and CSV and database modes agree.
2. Defaults, headings, one-heading selection, gaps, counting-change marks, the map shading, place links and URL state behave as sections 3–10 describe, with the anchor values above.
3. Chart, table and Excel agree for the same settings, and the source links work.
4. Georgian and English work at 390, 768 and 1440 pixels, keyboard use and language switching keep the settings, and every line under a heading fits on one line on a phone.
5. Duru sees screenshots and a clickable preview first (branch pushed, no PR). After Duru's OK, run `npm run check`, `npm run build` and `npm run test:browser` once, then open the PR.

## 14. Reuse

- **Used as is:**
  - place pages and map: `MunicipalitiesIndex`, `municipality-map.tsx`, `buildMunicipalityValueMapModel`, `EntityHeading`, `EntityNeighbourLinks`, the place routes in `demographyPlaceRoutes.ts` (`placePageHref`, `placePagePaths`, `placeNeighbours`) and the Education place-page pattern;
  - page and chart parts: `ExplorerWorkspace`, `LatestValueLine`, `EditorialLineChart` (`breaks`), `ExplorerTable` (`breakYears`), `RangeStrip`, `FlatSeriesPanel` with its row `heading`, `SegmentedTabs` with icon options;
  - helpers and state: `unitList.ts`, the shared hash state;
  - downloads and checks: the three-sheet Excel writer, the source-archive and methodology components, the parity checks and the demography break format.
- **Small additions:**
  - the Health hub's section list and hub cards get the four new sections;
  - the sidebar, footer source note, sitemap, methodology catalogue and source inventory get the new pages;
  - the research package's `prepare.py` reads the December municipal rows of `tsa_db-01`;
  - the import script and mirror read and compare the new table;
  - browser-test page counts change.
- **New**, mirroring Education file by file, because those models are tied to their own indicators:
  - `scripts/prepare-social.ts`;
  - the Prisma model and migration;
  - `lib/data/social/*`;
  - `lib/explorer/social*.ts` (series, places, workbook, hub cards);
  - `components/social/*`;
  - `lib/pages/social*.tsx`, the routes and the messages;
  - the methodology content and its doc.
- **Shared calculations.** The share-of-residents calculation follows Crime's per-100,000 helper, and % of GDP follows Money and banks. The plan checks whether either can be called directly before writing a new helper.

## 15. Coordination

- **Branch.** `claude/project-thread-aa1to5`, from `main` after Education (PR #194). It already carries the research sources (commit 3785aed5).
- **Shared files.** These are shared with any hub built at the same time: the sidebar, sitemap, methodology catalogue, Prisma schema and migrations, import script and browser-test page counts. Whichever merges later re-merges `main` and re-tests them.

## 16. Decisions for Duru

Approve this design; the build plan comes next. Approving it does not authorize pushing code, a pull request, deployment or live database changes. Screenshots and a clickable preview come first.

Defaults picked here that Duru may want to change:

1. Social package is one national page with no map, because SSA publishes its groups only nationally.
2. Both maps show the share of residents, not raw counts, so Tbilisi doesn't dominate.
3. "At 2025 prices" uses the national price index for every place.
4. Social payments has a "% of GDP" icon, as on Money and banks.

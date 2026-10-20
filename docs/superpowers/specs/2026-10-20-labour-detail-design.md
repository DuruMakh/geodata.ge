# Jobs by industry, hours, informal work and young people (Unemployment hub)

Date: 2026-10-20
Status: Written for Duru's review. On 2026-10-20 Duru picked option 2 of the "more data" list (`/mnt/project-files/next-data/2026-10-20-more-data-options.md`: jobs by industry and informal work) and asked for it in its own thread. In the thread Duru was shown the four pages below, and on the card "Show the women and men split for each industry in the lists?" Duru picked "Every split". This document covers the data foundation and the pages.

## 1. Intended result

Readers of fiscal.ge should be able to see, year by year, where Georgia's workers work, how long they work, how many of them work informally, and how many young people are neither working nor studying. The new pages answer four questions:

- **In which industries do people work?** In 2025, 1,389,700 people were employed. Farming employed 289,500 in 2017 and 218,300 in 2025. Construction employed 84,300 and 122,600 in the same years, and education 168,100 in 2025. Women held 143,900 of the education jobs and 6,000 of the construction jobs.
- **How many hours do they work?** The usual working week in the main job was 41.0 hours in 2025: 38.0 for women and 43.5 for men, 42.6 in towns and 38.8 in villages. By industry it ran from 30.8 hours in education and 33.0 in farming to 46.5 in construction and 47.2 in transport.
- **How much work is informal?** In 2025, 28.3% of jobs outside farming were informal: 23.3% for women, 32.6% for men, 26.1% in towns and 33.0% in villages.
- **How many young people are neither working nor studying?** In 2025, 17.6% of people aged 15–24 were not in employment, education or training (28.5% in 2020), and 23.4% of those aged 15–29 (35.1% in 2020). For ages 15–29, the share for women was 26.1% and for men 21.0%.

The pages keep the production editorial look. They reuse the Education, Business and Crime and justice workspace: chart or table, years, the series list under headings with search, and the Excel download. No new chart type, chart library, map or visual direction is added. All four pages are national. Geostat publishes none of these tables by region (section 10).

## 2. Pages and navigation

The four pages join the existing Unemployment hub after its four current pages.

| Page | Georgian path | English path | Georgian name (proposal) |
| --- | --- | --- | --- |
| Jobs by industry | `/explorer/unemployment/industries` | `/en/explorer/unemployment/industries` | დასაქმება დარგების მიხედვით |
| Hours worked | `/explorer/unemployment/hours` | `/en/explorer/unemployment/hours` | სამუშაო საათები |
| Informal jobs | `/explorer/unemployment/informal` | `/en/explorer/unemployment/informal` | არაფორმალური დასაქმება |
| Young people not in work or study | `/explorer/unemployment/young-people` | `/en/explorer/unemployment/young-people` | ახალგაზრდები სწავლისა და დასაქმების გარეშე |

- The hub (`/explorer/unemployment`) gets four more clickable cards, numbered 05–08, after Gender. Each new card shows a sparkline of its page's default series, the latest figure and the coverage, all from served facts, as the Crime and justice cards do. The four existing cards do not change.
- In the sidebar, the Unemployment section lists the same eight pages in the same order.
- The hub keeps its name "უმუშევრობა" / "Unemployment". Breadcrumbs, headings, language links, metadata, Dataset JSON-LD, the sitemap and llms.txt follow the existing pattern. Each new page's breadcrumb is Home › Data › Unemployment › page.
- The Georgian names are proposals. The industry, group and measure names come from Geostat's Georgian tables (section 10). The final wording goes on Duru's proofread list.

## 3. Shared page rules

These rules apply to all four pages, as on Education and Crime and justice:

- **Text under the heading.** There is one short line from `LatestValueLine` in its "{measure} · {year}: {value}" form, worded per page in the sections below. It must fit on one line on a 375-pixel phone. Nothing else sits under the heading. The only text under the chart is one short source line.
- **No tabs and no icon switches.** Each page has one unit, so there is nothing to switch. Women, men, towns and villages are rows in the list, under their own headings (Duru's "Every split" choice).
- **One list per page.** Every row sits flat under a small heading (the `FlatSeriesPanel` `heading` label), with the page total first. Nothing is tucked under a caret. Row names carry no prefixes, so "Construction" appears under Everyone, Women and Men. Outside the list (chart legend and tooltip, table rows, Excel) a row is named with its heading, for example "Women — Construction", as Education does.
- **Search.** The list is searchable, as on Education. Search narrows the rows shown but never what the bulk actions select or count.
- **Default selection.** Only the page's total is selected on arrival. It stays first, selectable and removable, and selection is unlimited.
- **Years.** The year strip covers every year any selected row has. Rows that start later (women and men by industry from 2020) show gaps before their first year, never zeros.
- **Controls and URL.** Chart | Table, the year range and Excel work as on Education. The selection (including an empty one), the range and chart/table mode live in the URL hash and survive a language change.
- **Colours.** Every row has a fixed, distinguishable colour. The page total is drawn in ink. Industries keep the colour the Economy and Wages pages give their NACE section. Women, men, towns and villages rows reuse the same industry colour in the shade helper's lighter and darker steps, so "Construction" keeps its hue under every heading.
- **Missing values.** A year without a value is a gap in the chart, a dash in the table and a blank Excel cell, never zero. Geostat's `...` and empty cells in a row that has other years are unavailable values. A published `0` is kept as zero.
- **Numbers.** Thousands of people, hours and percentages all show with one decimal, as on the existing Unemployment pages.
- **Yearly values only.** The last year shown is 2025.
- **Source line.** For example: "Source: Geostat, Labour Force Survey · thousand persons · 2017–2025 · updated … · Methodology and sources". The methodology link opens `/methodology/unemployment`.

## 4. Jobs by industry page

- **Data:** Geostat table 07, "Distribution of employed persons by economic activity (NACE rev. 2)", sheets `NACE2` and `NACE2 sex`.
- **Unit:** thousand persons.
- **Latest line:** "დასაქმებული · 2025: 1,389.7 ათასი" / "Employed · 2025: 1,389.7 thousand".
- **List, under three headings:**
  - **Everyone** (2017–2025): the total (the page reference, selected by default), then 19 rows. These are 18 industries in Geostat's order: farming, industry (NACE B–E, which Geostat publishes as one row), construction, trade, transport, hotels and restaurants, information and communication, finance, real estate, professional services, administrative services, public administration, education, health, arts, other services, households as employers, and international organisations. The 19th row is "Not identified".
  - **Women** (2020–2025): the women's total and the same 19 rows.
  - **Men** (2020–2025): the men's total and the same 19 rows.
- 60 rows in all.

## 5. Hours worked page

- **Data:** Geostat tables 09 (by sex) and 10 (by towns and villages), sheet 1 of each: "Average number of usual weekly hours of work in the main job".
- **Unit:** hours per week.
- **Latest line:** "კვირაში ჩვეულებრივ ნამუშევარი საათები · 2025: 41.0" / "Usual weekly hours · 2025: 41.0". The Georgian wording is a proposal for the proofread list and must pass the one-line phone check.
- **List, under five headings, each with its total and the same 16 industries.** Geostat's hours tables leave out real estate, international organisations and "Not identified".
  - **Everyone** (the total is the page reference)
  - **Women**
  - **Men**
  - **Towns**
  - **Villages**
- All rows cover 2020–2025. The one exception is "Men — Households as employers", which Geostat does not publish (`...`). It stays in the list with no values, so the five headings stay parallel, and its row shows a dash.
- 85 rows in all.
- **Actual hours are left out.** Geostat's sheet 2 (hours actually worked in the last 7 days) stays only in the archived workbook. As agreed with Duru in the thread, it is almost the same as usual hours and would double the list.

## 6. Informal jobs page

- Owner removed the unused-labour rates from the page, 2026-10-20.
- **Data:** Geostat table 11, "Share of informal employment in non-agricultural employment". Table 12, "Indicators of the labour underutilization", stays in the archive and the reviewed CSV, validated but not shown.
- **Unit:** percent.
- **Latest line:** "არაფორმალური დასაქმების წილი · 2025: 28.3%" / "Informal jobs, share outside farming · 2025: 28.3%".
- **List, under one heading:**
  - **Informal jobs** (share of non-farm jobs): Georgia (the page reference, selected by default), Women, Men, Towns and Villages.
- All rows cover 2020–2025.
- 5 rows in all.

## 7. Young people not in work or study page

- **Data:** Geostat table 14, "Percentage of youth not in employment, education or training (NEETs)".
- **Unit:** percent.
- **Latest line:** "15–24 წლის, არ სწავლობს და არ მუშაობს · 2025: 17.6%" / "Aged 15–24, not in work or study · 2025: 17.6%".
- **List, under two headings:**
  - **Ages 15–24:** All (the page reference, selected by default), Women, Men.
  - **Ages 15–29:** All, Women, Men.
- The 15–24 total is the reference because it is the international headline measure (UN goal indicator 8.6.1).
- All rows cover 2020–2025.
- 6 rows in all.

## 8. Hub cards

| Card | Sparkline | Footer |
| --- | --- | --- |
| 05 Jobs by industry | Employed, 2017–2025 | 2025 · 1,389.7 thousand · 2017–2025 |
| 06 Hours worked | Usual weekly hours, 2020–2025 | 2025 · 41.0 hours · 2020–2025 |
| 07 Informal jobs | Informal share, 2020–2025 | 2025 · 28.3% · 2020–2025 |
| 08 Young people | Ages 15–24, 2020–2025 | 2025 · 17.6% · 2020–2025 |

Each card's one-line description comes from the page's summary message. The hub's own coverage line and last-reviewed date take both datasets into account.

## 9. Checks against what the site already shows

These are checks only. Each must hold within rounding:

- The 19 industry rows add up to the total every year, and the women's and men's 19 rows add up to their totals. This was checked in the 2025 file: the sums are exact.
- The Everyone, Women and Men totals equal the employed counts the Unemployment overview and Gender pages already serve (`unemployment-annual.csv`, `employed`): 1,389.7, 619.5 and 770.2 thousand in 2025.
- The Everyone block in table 10 (hours by towns and villages) equals the Everyone block in table 09. It is served once, from table 09.
- The unemployment rate row in table 12 equals the served national unemployment rate (13.9% in 2025).
- Anchor values: 2025 employed 1,389.7; farming 2017 289.5 and 2025 218.3; construction 2017 84.3 and 2025 122.6; usual hours 2025 41.0; informal 2025 28.3; composite unused labour 2020 39.5 and 2025 27.8; NEET 15–24 2025 17.6 and 15–29 2025 23.4.

## 10. Data foundation

### Sources

The files come from Geostat's Employment and Unemployment page (categories/683). They were downloaded from the cloud workspace on 2026-10-20, the English versions from `media/78741`, `78743`, `78744`, `78745`, `78746` and `78748`, and the Georgian versions from `media/78723`, `78725`, `78726`, `78727`, `78728` and `78730`.

| Geostat file | Used for | Years |
| --- | --- | --- |
| `07-Employment-by-branch-NACE_Eng.xlsx` | Jobs by industry (sheets `NACE2`, `NACE2 sex`) | 2017–2025; by sex 2020–2025 |
| `09-Hours-by-sex.xlsx` | Hours: Everyone, Women, Men (sheet 1) | 2020–2025 |
| `10-Hours-by-urban-rular-areas.xlsx` | Hours: Towns, Villages (sheet 1) | 2020–2025 |
| `11-Informal-Employment.xlsx` | Informal jobs | 2020–2025 |
| `12-Labour-underutilization.xlsx` | Unused labour: archived and validated, not shown on a page | 2020–2025 |
| `14-NEET_Eng.xlsx` | Young people | 2020–2025 |
| The six Georgian versions and both page captures | Georgian labels and provenance only | — |

The `NACE1` sheet of table 07 (the older NACE rev. 1.1 classification, 2017–2020) and sheet 2 of tables 09 and 10 (actual hours) are archived with their workbooks but not served.

Rough size is 1,014 values: jobs 420, hours 504, informal 30, unused labour 24 and young people 36. The plan fixes the exact count.

### Research package

`docs/Raw Data/Unemployment/geostat-labour-force-detail/` is a new folder beside the existing `geostat-labour-force-annual`, which stays untouched because its prepare step requires its exact source list. It follows the Crime package:

- The original files go under `official/`, with a source manifest giving each file's URL, retrieval time, SHA-256 and size.
- A transcription script records every used cell with its sheet and cell reference.
- An independent verification script, a validation report and a coverage file sit alongside.
- The originals are never edited.

Source IDs start with `geostat_lfs_`, like the existing Labour Force Survey sources, for example `geostat_lfs_jobs_industry` and `geostat_lfs_hours_sex`.

### Canonical file and checks

- **Prepare script.** `npm run data:prepare-labour` writes `data/imports/labour-annual.csv` (UTF-8 with BOM) and `data/reports/labour-validation.json`. With `--check` it reproduces both byte for byte, and it runs inside `data:validate`.
- **Row contents.** Each row keeps:
  - the exact workbook value and the one-decimal published value (rounded from the value to 15 significant digits, so 8.4499999999999993 rounds to 8.5);
  - the unit: `thousand_persons`, `hours` or `percent`;
  - `basis=actual` and value status `survey_estimate`, as the existing Unemployment rows have;
  - the source ID, sheet and cell.
- **Stable IDs.** They are lowercase and follow `labour.{topic}.{group}.{item}`:
  - `labour.jobs.all.total`, `labour.jobs.all.sector_a`, `labour.jobs.women.sector_b_e`, `labour.jobs.men.not_identified`
  - `labour.hours.all.total`, `labour.hours.rural.sector_f`
  - `labour.informal.total`, `labour.informal.urban`
  - `labour.underuse.unemployment_rate`, `labour.underuse.composite`
  - `labour.neet.age_15_24.total`, `labour.neet.age_15_29.women`
  - Industry codes follow NACE sections (`sector_a`, `sector_b_e`, `sector_f` … `sector_u`), as on the Business pages; "Not identified" is `not_identified`.
- **Validation rejects:** a changed value; a missing, extra or duplicate observation; a year outside each table's coverage; and a zero written where Geostat printed `...` or left a cell empty. It also runs every check in section 9. Where a breakdown misses its total, the difference is recorded exactly and never filled.

### Serving

- All pages stay prerendered. The CSV loader and the numeric client projection follow Crime and justice.
- The private Supabase mirror gets a `LabourFact` table in one versioned migration, with RLS on and public grants revoked. The transactional `data:import` compares it field by field, and CSV and database modes must serve identical values. The live migration and import happen only when Duru merges, through the existing release pipeline.
- Like the existing Unemployment data, these facts are not added to the `/mcp` fact-query snapshot or the JSON publications. The `source.geostat_lfs_` prefix is already kept out of the snapshot.

## 11. Sources, Excel and methodology

- **Source archive.** The 12 Geostat workbooks and two page captures are published through the existing Unemployment source archive (`data/methodology/source-archives/unemployment.csv`), with a source-inventory rule for the new folder. They total about 570 KB, so the methodology bundle stays small (the PR #170 rule).
- **Excel.** It reuses the three-sheet writer (Summary, Data, Sources) in the reader's language. It holds the selected rows, named with their headings, and the selected years, with explicit units, blank missing cells and validated source links. It has no internal-identifier or cell-reference columns.
- **Methodology.** `/methodology/unemployment` stays the one methodology page. It gains a section that explains in plain words:
  - that these figures come from the same household Labour Force Survey and are estimates;
  - how this survey's jobs differ from the Business hub's "Jobs" page: this survey counts people, including farmers, the self-employed and informal workers, while the Business page counts people working in firms;
  - that Geostat publishes "Industry" (NACE B–E) as one row;
  - what usual hours are, and that actual hours are archived but not shown;
  - what informal employment is, and that its share is of jobs outside farming;
  - that Geostat's labour-underuse table (workbook 12) is kept in the archive but not shown;
  - what "not in employment, education or training" means;
  - why there is no map;
  - that the pages state no causes.

## 12. Out of scope

The following are out of scope, and each would need its own approval:

- any regional view or map (Geostat publishes none of these tables by region);
- actual hours worked, and the NACE rev. 1.1 industry table;
- employment by ownership (table 06), occupation (08) and status (15), subsistence food producers (17), recent graduates (18), culture (19), ICT (20) and reasons for inactivity (21);
- quarterly values;
- causes, forecasts and comparisons with other countries;
- MCP tools and the JSON/CSV publications.

`Project_Definition.md` §2D says the Unemployment extension adds no NEET. This design amends §2D with Duru's approval of 2026-10-20 to add the four pages above, and nothing else in that list.

## 13. Verification

1. The canonical file reproduces every served value from the original cells. The independent verification and the section 9 checks pass, and CSV and database modes agree.
2. Defaults, headings, full row names outside the list, gaps, search and URL state behave as sections 3–7 describe, with the anchor values above.
3. Chart, table and Excel agree for the same settings, and the source links work.
4. Georgian and English work at 375, 768 and 1440 pixels, with each latest line on one line on a phone. Keyboard use and language switching keep the settings.
5. Duru sees screenshots and, if wanted, a clickable preview first (branch pushed, no PR). After Duru's OK, run `npm run check`, `npm run build` and `npm run test:browser` once, then open the PR.

During implementation, also:

- amend `Project_Definition.md` §2D;
- update `DESIGN.md` §27 (the Unemployment routes and sidebar) with the four pages;
- add `docs/data-methodology/labour-detail-annual.md` and add the new table to `docs/data-methodology/database-import.md`.

## 14. Reuse

- **Used as is:**
  - page and chart parts: `ExplorerWorkspace`, `ExplorerHeading`, `LatestValueLine`, `EditorialLineChart`, `ExplorerTable`, `RangeStrip`, `ChartSelectionAids`, `FlatSeriesPanel` with its `heading` label and search, `ModeTabs`, `SourceNote`, `ExcelDownloadButton`;
  - state and helpers: `useHashState`, `topicSeries` (`buildTopicModel`, `parseTopicHash`, `serializeTopicHash`), `listLatestByHeading`, the colour shade helper;
  - downloads, sources and methodology: the three-sheet Excel writer, the source-archive and methodology components, the hub-card model;
  - checks: the generated-artifact and served-rows parity checks.
- **Small additions:**
  - The Unemployment hub renderer appends the four new cards after its existing four, and the sidebar, sitemap, i18n page inventory and page-revision dates get the four paths.
  - The Unemployment methodology content, its source archive and the source inventory get the new files.
  - The import script and mirror read and compare the new table.
  - Route and sitemap counts in tests change, and the Unemployment browser test's card count goes from 4 to 8.
- **New:** these mirror their Education and Crime counterparts, because those models are tied to their own fact types and message scopes:
  - the research package and the `prepare-labour` script;
  - the Prisma model and migration;
  - `lib/data/labour/*`;
  - `lib/explorer/labour.ts`, `labourWorkbook.ts` and `labourHubCards.ts`;
  - `components/unemployment/labour-explorer.tsx`;
  - `lib/pages/labour.tsx`, the eight route files and the `labour` messages;
  - `docs/data-methodology/labour-detail-annual.md`.
- **Considered and not reused:**
  - `UnemploymentExplorer` is built around the Unemployment breakdowns and its percent-or-count rule, and it would need a second fact type.
  - `EducationExplorer` is the closest fit, with one unit, headings and full row names. Before writing `labour-explorer.tsx`, the plan checks whether it can take its model and labels as props instead of being copied. AGENTS.md "Reuse first" applies.

## 15. Coordination

- Social protection, transport, internet, environment, science and culture, GDP by spending, marriages and divorces and the farming page are being built at the same time in their own threads.
- The branch `claude/jobs-by-industry-pqe6dc` starts from the latest `main` (Education, PR #194).
- Several files are shared with those threads: the Prisma schema and migrations, the import script, `source-documents.csv`, the sitemap and route counts, and llms.txt. Whichever thread merges later re-merges `main` and re-tests them, as Duru decided on 2026-10-15.

## 16. Decision for Duru

Approve this design. The implementation plan comes next. Approving the design does not authorize pushing, a pull request, deployment or live database changes. Screenshots and a live preview come first.

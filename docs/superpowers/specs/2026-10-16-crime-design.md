# Crime and justice hub

Date: 2026-10-16
Status: Written for Duru's review. Duru asked for a crime thread on 2026-10-16 ("three threads for education, housing and crime"). On the "Choose which pages the Crime and justice hub gets" card, Duru picked "Five pages". On the "Approve this layout for the five crime pages?" card, Duru picked "Approve". This document covers both the data foundation and the pages.

**Amended while planning (2026-10-16).** Where the body below differs, this note wins. None of it changes what a reader sees:

- The per-100,000 figures are calculated on the page from the served counts and the served population, as Money and banks calculates its share of GDP (`moneyBanksViewFacts`), and marked calculated. They are not stored as rows, so `crime-annual.csv` and the `CrimeFact` table hold only Geostat's counts, every one with value status `official`, and there are no `.per_100k` IDs.
- The line under each heading uses the site's `LatestValueLine` form, "{measure} · {year}: {value}", for example "Recorded crimes · 2025: 54,134". Road accidents adds the killed as the line's note ("469 killed").
- The research package reads the old `.xls` workbooks with `xlrd` 2.0.1 in its Python transcription and with the repository's SheetJS (`xlsx`) in the TypeScript prepare step and the independent verifier. No production dependency is added.

## 1. Intended result

Readers of fiscal.ge should be able to see, year by year, how many crimes are recorded in Georgia and of what kind, how many people the courts convict and how they are sentenced, how many people are in prison, who the victims are, and how many road accidents there are and how many people they kill and injure. Every count can also be read per 100,000 people.

The pages answer five questions:

- How many crimes are recorded? 35,096 in 2015, 58,412 in 2018 and 54,134 in 2025. Of those in 2025, 17,251 were property crimes and 10,475 drug crimes.
- How many people are convicted? 8,897 in 2001 and 22,767 in 2025. In 2025, 5,793 were sentenced to prison and 11,305 got a suspended sentence.
- How many people are in prison? There were 7,618 at the end of 2001, 24,114 at the end of 2011, 9,093 at the end of 2013 and 11,153 at the end of 2025.
- Who are the victims? In 2025 there were 17,209 victims: 8,652 men and 8,545 women. Of them, 1,253 were under 17 and 1,522 were foreigners.
- How dangerous are the roads? In 2025 there were 5,969 road accidents. They killed 469 people and injured 8,191.

The pages keep the production editorial look. They reuse the Health, Business and Energy and food workspace, series list with headings, icon measure switch, table and Excel download. No new chart type, chart library or visual direction is added. There is no map: Geostat publishes none of these figures by region (section 10).

## 2. Pages and navigation

| Page | Georgian path | English path | Georgian name (proposal) |
| --- | --- | --- | --- |
| Hub | `/explorer/crime` | `/en/explorer/crime` | დანაშაული და მართლმსაჯულება |
| Recorded crimes | `/explorer/crime/recorded` | `/en/explorer/crime/recorded` | რეგისტრირებული დანაშაული |
| Convictions | `/explorer/crime/convictions` | `/en/explorer/crime/convictions` | მსჯავრდებულები |
| Prisons | `/explorer/crime/prisons` | `/en/explorer/crime/prisons` | პატიმრები |
| Victims | `/explorer/crime/victims` | `/en/explorer/crime/victims` | დაზარალებულები |
| Road accidents | `/explorer/crime/road-accidents` | `/en/explorer/crime/road-accidents` | საგზაო-სატრანსპორტო შემთხვევები |
| Methodology | `/methodology/crime` | `/en/methodology/crime` | დანაშაული და მართლმსაჯულება |

- The English hub name is "Crime and justice". Geostat calls the section "Criminal Justice Statistics" (სისხლის სამართლის სტატისტიკა); the shorter name reads better in the sidebar.
- The hub has five clickable cards in the order of the table, reusing the hub cards. Each shows a sparkline of its default series, the latest figure and the coverage, all from served facts.
- In the sidebar, **Crime and justice** sits directly after Health and social protection. Its five pages show beneath it when the section is open.
- Breadcrumbs, headings, language links, metadata, Dataset JSON-LD, the sitemap and llms.txt follow the existing pattern.
- The Georgian names are proposals taken from Geostat's Georgian tables. The final wording follows the bilingual catalogue conventions and goes on Duru's proofread list.

## 3. Shared page rules

These rules apply to every Crime and justice page, as on Health and Business:

- **Text under the heading.** There is one short line from `LatestValueLine`, worded per page in the sections below. Nothing else sits under the heading. The only text under the chart is one short source line.
- **No tabs.** No page has a tab row. The one icon-only measure switch (DESIGN.md §7.2a: `SegmentedTabs` with icon options and `ControlTooltip`) sits at the right of the chart controls row, after the unit caption. It offers two views of the same data:
  - **Number** (Lucide `Hash`, initial): the counts as published.
  - **Per 100,000 people** (Lucide `Users`): each count ÷ Georgia's population on 1 January of the same year × 100,000, to one decimal (section 8).
- **One list per page.** Breakdowns sit flat under small headings (the `FlatSeriesPanel` `heading` label that Business and Health use), with the total first. Nothing is tucked under a caret. Series names carry no prefixes.
- **One unit at a time.** Where a list mixes units (Road accidents: accidents and people), each unit's rows sit under a heading that names the unit, and the chart shows one unit at a time. Ticking a row of another unit replaces the selection with that row, as on Business and Health.
- **Default selection.** Only the page's total is selected on arrival. It stays first, selectable and removable, and selection is unlimited.
- **Controls and URL.** Chart | Table, the year range and Excel work as on Health. The measure, range, selection (including an empty one) and chart/table mode all live in the URL hash through `use-hash-explorer-state`, and they survive a language change.
- **Colours.** Every series has a fixed, distinguishable colour. The total is drawn in ink.
- **Missing values.** A year without a value is a gap in the chart, a dash in the table and a blank Excel cell, never zero. Geostat's `…` and `...` cells are unavailable values. A published `0` is a count of zero and is kept.
- **Yearly values only.** The last year shown is 2025. Geostat's "I-II quarters, 2026" columns are not served.
- **Counting changes.** Where a series was counted differently from a given year, the chart leaves a gap in the line at that year and draws a dashed rule labelled "new counting" (`EditorialLineChart` `breaks`), and the table marks the year (`ExplorerTable` `breakYears`), as Health and Population do. The breaks are listed in section 9.
- **Source line.** It reads like the others, for example "Source: Geostat, Ministry of Internal Affairs · crimes · 2015–2025 · Methodology and sources". It names the agency Geostat credits for that table.

## 4. Recorded crimes page

The line under the heading reads "2025: 54,134 crimes recorded".

One list, in crimes, 2015–2025:

- **All recorded crimes** (selected).
- **Type of crime** (heading), Geostat's 11 groups in Geostat's order: crimes against life; against health; against human rights and freedoms; against the family and minors; against property; against public safety and order; drug crimes; transport crimes; malfeasance in office; against the order of government; other crimes.

The figures cover every investigative agency in Georgia, not only the police (Geostat's note). The 2018 counting change (section 9) is drawn on every series. The 2001–2011 table is not served, because its groups (for example "heavy crimes", "theft", "hooliganism") cannot be matched to the current ones and 2012–2014 are missing. It is archived with the other sources.

## 5. Convictions page

The line under the heading reads "2025: 22,767 people convicted".

One list, in persons, 2001–2025. All four headings break down the same total:

- **People convicted** (selected).
- **Type of crime** (heading): intentional murder; aggravated murder; intentional injury; rape; larceny; robbery; theft; drug crimes (illegal production, purchase, storage and sale of drugs); hooliganism; traffic safety violations; other crimes.
- **Age** (heading): 14–17; 18–24; 25–29; 30–49; 50 and over.
- **Sex** (heading): women; men.
- **Sentence** (heading): prison; suspended sentence (Geostat's "suspended conviction", პირობითი მსჯავრი); fine; community work (public work); deferred sentence (Geostat's "suspended sentence", a handful of cases a year); corrective labour; other penalties.

The source is the Supreme Court of Georgia. The juvenile offenders table is not served, because the 14–17 age row already gives juveniles and its type split has very small counts.

## 6. Prisons page

The line under the heading reads "End of 2025: 11,153 prisoners".

One list, in persons at the end of each year, 2001–2025:

- **All prisoners** (selected).
- **Sex** (heading): women; men.
- **Age** (heading): adults; juveniles.
- **Status** (heading): sentenced; awaiting trial. These start in 2010; Geostat prints `...` before.

Geostat's women and men within adults, juveniles, sentenced and awaiting trial are kept in the data file but not listed, so the list stays short. The source changed from the Ministry of Justice (2001–2007) to the Ministry of Corrections (2008–2017) and back to the Ministry of Justice (from 2018); the methodology page says so, and it is not drawn as a break because Geostat does not call it one.

## 7. Victims page

The line under the heading reads "2025: 17,209 victims".

One list, in persons, 2007–2011 and 2015–2025. Geostat publishes nothing for 2012–2014, so those years are a visible gap on every line.

- **All victims** (selected).
- **Sex** (heading): men; women; not stated.
- **Age** (heading): under 17; 17–24; 25–44; 45 and over; not stated. These are Geostat's bands ("less than 17", "more than 44").
- **Citizenship** (heading): citizens of Georgia; foreigners; dual citizens; stateless; not stated.

The source is the Ministry of Internal Affairs for 2007–2011 and the Prosecutor's Office from 2015. The methodology page says so, and the gap already separates the two.

## 8. Road accidents page

The line under the heading reads "2025: 5,969 road accidents, 469 people killed".

One list, 2001–2025, under two headings that name their units:

- **Accidents** (heading, unit: accidents): **Road accidents** (selected); accidents caused by drunk driving.
- **People** (heading, unit: persons): people killed; people injured.

The chart shows one unit at a time (section 3). Geostat prints `…` for drunk-driving accidents in 2002, so that year is a gap. The 2025 drunk-driving change (section 9) is drawn on that series only.

### Per 100,000 people

- The rate is the count ÷ Georgia's population on 1 January of the same year × 100,000. The population is `demography.population_total` for `country.georgia`, which the Population pages already serve. The rate is computed once in the prepare step from the two canonical files and stored, so CSV and database modes serve the same numbers. Rates are shown to one decimal.
- The population starts on 1 January 2004, so 2001–2003 have no rate. They are gaps in the per-100,000 view, never zero.
- Geostat recalculated the 1 January 2025 population from the 2024 census (the existing `census_recalculation_2025` break). Every per-100,000 series therefore also shows that break at 2025, and the methodology page says the 2025 rates use the census-based population.
- For the prisons page the rate compares the end-of-year count with the population on 1 January of that year. The methodology page says so in one sentence.
- No other ratio is computed: no shares, no solved rates, no growth rates, no interpolation.

## 9. Counting changes (series breaks)

These are recorded in `data/imports/crime-series-breaks.csv` in the demography break format and drawn as section 3 describes:

| Break | Applies to | Year | Basis |
| --- | --- | --- | --- |
| `registration_2018` | All recorded-crime series | 2018 | Recorded crimes rose from 37,944 in 2017 to 58,412 in 2018 in almost every group. At the time the Interior Ministry said that from 2018 it no longer left minor offences, such as damage to property, out of the figures. One clear sign in Geostat's own data: from 2018 each suicide is registered as an "incitement to suicide" investigation (Criminal Code article 115: 1,119 of the 1,486 crimes against life in 2025, from the December 2025 Unified Report). The 2017 and 2018 values are therefore not comparable. The methodology page states this without claiming how much of the rise is real. During implementation an official Ministry or Geostat statement is looked for and quoted if found. Otherwise the page cites the Unified Report figure and names the Ministry's public explanation as the Ministry's. |
| `drunk_driving_coverage_2025` | Accidents caused by drunk driving | 2025 | Geostat: until 2024 the figure covers only the Patrol Police's jurisdiction; from 2025 it covers the whole territory, "accordingly, the 2025 data is not comparable with data from previous years." |
| `census_recalculation_2025` (existing) | Every per-100,000 series | 2025 | The population on 1 January 2025 is census-based (section 8). |

The methodology page also notes, without drawing them, Geostat's May 2005 procedure change (it applies only to the 2001–2011 table, which is not served) and the victims' change of source agency in 2015.

## 10. Data foundation

### Sources

The files come from Geostat's Criminal Justice Statistics page (categories/132), downloaded from the cloud workspace on 2026-10-16. Copies are in `/mnt/project-files/crime-sources/`, with the URLs in `source-urls.txt`.

| Geostat file | Used for | Years | Agency Geostat credits |
| --- | --- | --- | --- |
| `Number-of-Recorded-Crimes.xlsx` | Recorded crimes | 2015–2025 | Ministry of Internal Affairs (all investigative agencies) |
| `Number-of-Convicts-by-Types-of-Crime.xls` | Convictions by type | 2001–2025 | Supreme Court |
| `Composition-of-Convicts-by-Age-and-Sex.XLS` | Convictions by age and sex | 2001–2025 | Supreme Court |
| `Number-of-Convicts-and-Penalties-Prescribed-by-Court.XLS` | Convictions by sentence | 2001–2025 | Supreme Court |
| `Prison-Population.xls` | Prisons | 2001–2025 | Ministries of Justice and Corrections |
| `Data-on-Victim-Statistics.xlsx` | Victims | 2007–2011, 2015–2025 | Interior Ministry, then Prosecutor's Office |
| `Accidents.xlsx` | Road accidents | 2001–2025 | Ministry of Internal Affairs |
| `registrirebuli-danaSaulis-raodenoba.xlsx` and the other Georgian files | Georgian labels only | — | — |

These are archived for provenance but not served: the 2001–2011 recorded-crimes table, the juvenile offenders table, human trafficking (about 10 cases a year), and the December 2025 Unified Report on Criminal Justice Statistics (the PDF quoted in section 9).

Three files are old `.xls` workbooks, so the prepare step needs a reader for them. The plan picks one already in the repository, or a one-off Python transcription in the research package as other hubs do, and adds no new production dependency without saying so.

Rough size: recorded crimes 132 values, convictions about 625, prisons about 140, victims about 270 and road accidents about 100. That makes about 1,270 counts, and the same number again per 100,000 people, less the 2001–2003 years. The plan fixes the exact count.

### Research package

`docs/Raw Data/Crime/geostat-crime-annual/` follows the Health package:

- Original files go under `official/`, with a source manifest giving the URL, retrieval time, SHA-256 and size.
- A `prepare.py` script transcribes every used cell with its sheet and cell reference.
- An independent verification script, a validation report and a coverage file sit alongside.
- The originals are never edited.

### Canonical file and checks

- **Prepare script.** `npm run data:prepare-crime` writes `data/imports/crime-annual.csv` (UTF-8 with BOM) and `data/reports/crime-validation.json`. With `--check` it reproduces both byte for byte, and it runs inside `data:validate`.
- **Row contents.** Each row keeps:
  - the exact workbook value. Some cells hold numbers as text with a space, such as `'49 976'`; parsing accepts both and records the number exactly;
  - the unit: `crimes`, `persons` or `accidents` for counts, and `per_100k_population` for rates;
  - `basis=actual` and value status `official` for counts, and `derived` for rates;
  - the source ID, sheet and cell (for a rate, the count's cell and the population row it used).
- **Stable IDs.** They are lowercase and follow `crime.{topic}.{item}` for counts and `crime.{topic}.{item}.per_100k` for rates. Examples: `crime.recorded.total`, `crime.recorded.property`, `crime.convicted.total`, `crime.convicted.type_theft`, `crime.convicted.age_18_24`, `crime.convicted.sex_women`, `crime.convicted.sentence_prison`, `crime.prison.total`, `crime.prison.pretrial`, `crime.victims.total`, `crime.victims.citizenship_foreign`, `crime.road.accidents`, `crime.road.accidents_drunk`, `crime.road.killed` and `crime.road.injured`.
- **Validation rejects:** a changed value; a missing, extra or duplicate observation; a year outside each table's coverage; any 2026 or quarterly value; and a zero written where Geostat printed `…` or `...`.
- **Validation checks, within rounding:**
  - the 11 crime types add up to all recorded crimes every year;
  - for convictions, the crime types, the age bands, the two sexes and the sentences each add up to the total every year;
  - the three convictions files print the same total every year;
  - for prisons, women and men, adults and juveniles, and (from 2010) sentenced and awaiting trial each add up to the total;
  - for victims, sex, age and citizenship each add up to the total every year;
  - every rate equals its count ÷ population × 100,000;
  - a few anchor values match Geostat: recorded crimes 2015 35,096, 2018 58,412 and 2025 54,134; property crimes 2025 17,251; people convicted 2025 22,767; prison sentences 2025 5,793; prisoners end of 2025 11,153 and end of 2011 24,114; victims 2025 17,209; road accidents 2025 5,969, killed 469 and injured 8,191.
  Where a breakdown misses its total, the difference is recorded exactly and never filled.

### Serving

- All pages stay prerendered. The CSV loader and the numeric client projection follow Health.
- The private Supabase mirror gets a `CrimeFact` table in one versioned migration, with RLS on and public grants revoked. The transactional `data:import` compares it field by field, and CSV and database modes must serve identical values. The live migration and import happen only when Duru merges, through the existing release pipeline.
- Like Health, Crime and justice is not added to the `/mcp` fact-query snapshot or the JSON publications.

## 11. Sources, Excel and methodology

- The Geostat workbooks are published through the existing source archive (`data/methodology/source-archives/crime.csv`). The methodology bundle must not pull large data files (the PR #170 rule). The 8 MB December Unified Report PDF is not bundled; the methodology links to Geostat's copy.
- Excel reuses the three-sheet writer (Summary, Data, Sources) in the reader's language. It holds the active measure's selected series and years, explicit units, blank missing cells and validated source links. It has no internal-identifier or cell-reference columns. A per-100,000 workbook says in its Summary that the rates are calculated by fiscal.ge from Geostat's counts and population.
- `/methodology/crime` explains in plain words:
  - who collects each table: the Interior Ministry, the Supreme Court, the prison service and the Prosecutor's Office, published by Geostat;
  - what a recorded crime is (a crime on which an investigation was started, by any investigative agency), and that it is not the same as crime that actually happened;
  - the 2018 counting change (section 9);
  - what the sentence types mean, including the difference between a suspended conviction and a deferred sentence;
  - that prisoners are counted on 31 December and include people awaiting trial;
  - the victims' gap and change of agency;
  - the 2025 drunk-driving coverage change;
  - how the per-100,000 rates are calculated, the 2004 start and the 2025 census break;
  - why there is no map;
  - that the pages state no causes or explanations.

## 12. Out of scope

The following are out of scope, and each would need its own approval:

- any regional view or map. Geostat publishes none of these tables by region. The monthly Unified Report splits prosecutions and convictions by prosecutor's districts, which do not match the 11 regions;
- the share of crimes solved. Geostat's December reports give a full year only for 2023–2025 (64.9%, 64.3% and 70.0%);
- crimes by Criminal Code article, prosecutions, plea bargains, probation and other contents of the monthly Unified Report;
- hate crimes (yearly PDFs from 2020);
- the 2001–2011 recorded-crimes table, juvenile offenders by type, human trafficking;
- monthly or quarterly values, including the 2026 half-year;
- Interior Ministry pages outside Geostat (domestic violence, administrative offences and others);
- causes, forecasts and comparisons with other countries;
- MCP tools and the JSON/CSV publications.

## 13. Verification

1. The canonical file reproduces every served value from the original cells. The independent verification passes, and CSV and database modes agree.
2. Defaults, headings, the measure switch, one-unit-at-a-time switching, gaps, counting-change marks and URL state behave as sections 3–9 describe, with the anchor values above.
3. Chart, table and Excel agree for the same settings, and the source links work.
4. Georgian and English work at 390, 768 and 1440 pixels, and keyboard use and language switching keep the settings.
5. Duru sees screenshots and, if wanted, a clickable preview first (branch pushed, no PR). After Duru's OK, run `npm run check`, `npm run build` and `npm run test:browser` once, then open the PR.

During implementation, also:

- update `Project_Definition.md` section 2 with a new approved Crime and justice item;
- update `DESIGN.md` with the hub and its five pages;
- add a new `docs/data-methodology/crime-annual.md` and add the new table to `docs/data-methodology/database-import.md`.

## 14. Reuse

- **Used as is:**
  - page and chart parts: `ExplorerWorkspace`, `ExplorerHeading`, `LatestValueLine`, `EditorialLineChart` (with `breaks`), `ExplorerTable` (with `breakYears`), `RangeStrip`, `SeriesAside`, `FlatSeriesPanel` with its `heading` label, `SegmentedTabs` with icon options and `ControlTooltip`, `SourceNote`;
  - state and helpers: `use-hash-explorer-state` and the one-unit-at-a-time selection rule Business and Health use;
  - downloads and sources: the three-sheet Excel writer and `ExcelDownloadButton`, the source-archive and methodology components, and the hub cards;
  - checks and formats: the generated-artifact and served-rows parity checks, the demography series-break format, and the existing `census_recalculation_2025` break.
- **Small additions:**
  - The sidebar (`navTree.ts`), footer source note, sitemap, methodology catalogue and source inventory get the new hub.
  - The import script and mirror read and compare the new table.
  - Browser-test page and hub counts change.
- **New:** these mirror their Health counterparts file by file, because those models are tied to their own indicators:
  - the research package and the `prepare-crime` script;
  - the Prisma model and migration;
  - `lib/data/crime/*`;
  - `lib/explorer/crime.ts`, `crimeWorkbook.ts` and `crimeHubCards.ts`;
  - `components/crime/crime-explorer.tsx`;
  - `lib/pages/crime.tsx`, the routes and the messages;
  - the methodology content and `docs/data-methodology/crime-annual.md`.
- Before writing a new file, the plan checks whether the Health topic explorer (`components/health/health-explorer.tsx` and `lib/explorer/health.ts`) can serve these pages by taking its indicator list as an option rather than being copied. AGENTS.md "Reuse first" applies.

## 15. Coordination

- Education, Housing and Social protection are being designed or built at the same time in their own threads.
- The branch `claude/crime-hub-r6s42h` starts from the latest `main` (Health, PR #190).
- Some files are shared with those hubs: the sidebar, sitemap, methodology catalogue, Prisma schema and migrations, import script and browser-test counts. Whichever hub merges later re-merges `main` and re-tests them, as Duru decided on 2026-10-15.

## 16. Decision for Duru

Approve this design. The implementation plan comes next. Approving the design does not authorize pushing, a pull request, deployment or live database changes. Screenshots or a live preview come first.

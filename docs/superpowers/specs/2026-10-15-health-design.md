# Health and social protection hub: Health pages

Date: 2026-10-15
Status: Approved by Duru on 2026-10-15 ("Continue"). On 2026-10-15 Duru approved adding health data. On the "Where should the Health pages live on fiscal.ge?" card, Duru picked "New health hub". Duru then called the regional causes-of-death data "great" and replied "Great continue" to the three-page proposal (Doctors and hospitals, Illnesses, Causes of death). This document covers both the data foundation and the pages.

## 1. Intended result

Readers of fiscal.ge should be able to see, year by year, how Georgia's health system and the nation's health have changed. That means how many doctors, nurses, hospitals and beds there are, how many people fall ill and with what, and what people die of, for Georgia and for each region.

The pages answer four questions:

- How many doctors and nurses are there? In 2002 there were 20,225 doctors and 23,356 nurses. In 2025 there were 22,491 doctors and 21,262 nurses. The 2020 counting change sits between those two years.
- How many hospitals and beds? 251 hospitals and 18,290 beds in 2002; 232 hospitals and 15,232 beds in 2025.
- What do people fall ill with? In 2025 there were 500.4 thousand new cases of respiratory disease, 127.2 thousand of circulatory disease and 36.7 thousand of cancer. There were 933 new tuberculosis cases and 562 new HIV cases.
- What do people die of, and where? There were 44,319 deaths in 2025, of which 16,711 were from circulatory diseases and 6,877 from cancer. COVID-19 caused 11,286 deaths in 2021. Racha-Lechkhumi and Kvemo Svaneti has the highest death rate of any region, 19.7 per 1,000 people in 2025, against 11.3 for Georgia.

The pages keep the production editorial look. They reuse the Energy and food, Money and banks and Living standards workspace, series list, icon measure switch, map, table and Excel download. No new chart type, chart library or visual direction is added.

## 2. Pages and navigation

| Page | Georgian path | English path | Georgian name (proposal) |
| --- | --- | --- | --- |
| Hub | `/explorer/health` | `/en/explorer/health` | ჯანდაცვა და სოციალური დაცვა |
| Doctors and hospitals | `/explorer/health/doctors-hospitals` | `/en/explorer/health/doctors-hospitals` | ექიმები და საავადმყოფოები |
| Illnesses | `/explorer/health/illnesses` | `/en/explorer/health/illnesses` | დაავადებები |
| Causes of death | `/explorer/health/causes-of-death` | `/en/explorer/health/causes-of-death` | სიკვდილის მიზეზები |
| Area page (Georgia and 11 regions) | `/explorer/health/causes-of-death/regions/[id]` | `/en/explorer/health/causes-of-death/regions/[id]` | სიკვდილის მიზეზები — {area} |
| Methodology | `/methodology/health` | `/en/methodology/health` | ჯანდაცვა |

- The hub's English name is "Health and social protection", which is Geostat's own name for the section. For now it holds only the three Health pages. Pensions and social help can be added later as more cards without moving anything. No "coming soon" card is shown.
- The hub has three clickable cards in the order of the table. They reuse the hub cards: Doctors and hospitals and Illnesses each show a sparkline of their default series (doctors; respiratory diseases), the latest figure and coverage. Causes of death shows Georgia's total deaths.
- In the sidebar, **Health and social protection** sits directly after Living standards. Its three pages show beneath it when the section is open.
- Breadcrumbs, headings, language links, metadata, Dataset JSON-LD, the sitemap and llms.txt follow the existing pattern.
- The Georgian names are proposals. "დაავადებები" is used rather than Geostat's technical "ავადობა" (morbidity), because readers search for it. The final wording follows the bilingual catalogue conventions.

## 3. Shared page rules

These rules apply to every Health page, as on Money and banks and Business:

- **Text under the heading.** There is one short line from `LatestValueLine`, worded per page in the sections below. Nothing else sits under the heading. The only text under the chart is one short source line.
- **No tabs.** No page has a tab row. Different units switch with the icon-only measure switch of DESIGN.md §7.2a (`SegmentedTabs` with icon options and `ControlTooltip`). It sits at the right of the chart controls row, after the unit caption.
- **Default selection.** Only the default series named for each page is selected on arrival. It stays first, selectable and removable, and selection is unlimited.
- **Breakdowns.** Breakdowns nest under the total they break down, as caret-expanded subcategories, or sit under a heading. Series names carry no prefixes.
- **Controls and URL.** Chart | Table, the year range and Excel work as on Money and banks. The measure, range, selection (including an empty one) and chart/table mode all live in the URL hash through `use-hash-explorer-state`, and they survive a language change.
- **Colours.** Every series has a fixed, distinguishable colour. The reference series is drawn in ink.
- **Missing values.** A year without a value is a gap in the chart, a dash in the table and a blank Excel cell, never zero. Geostat's `…`, `...` and `-` cells are unavailable values, not zeros. The one exception is the causes-of-death table, where `0` is a published count.
- **Yearly values only.**
- **Counting changes.** When Geostat says a series was counted differently from a given year, the chart leaves a gap in the line at that year and draws a dashed rule labelled "new counting" (`EditorialLineChart` `breaks`), and the table marks the year (`ExplorerTable` `breakYears`). This reuses the way the Population pages mark the 2025 census change. The breaks are listed in section 8.
- **Source line.** It reads like the others, for example "Source: Geostat, healthcare · persons · 2002–2025 · Methodology and sources".

## 4. Doctors and hospitals page

The line under the heading reads "2025: 22,491 doctors".

The page covers 2002–2025 for Georgia as a whole. An icon measure switch offers two views (changed on 2026-10-16 after the owner's preview review: the four groups that end in 2011 are dropped, the lists are flat under headings, and beds and visits join the hospitals view):

- **Staff** (Lucide `Users`, initial), in persons, flat under two headings:
  - **Doctors**: **Doctors** (selected), then Geostat's 14 doctor specialities: internal medicine, surgeons, obstetrician-gynaecologists, paediatricians, eye, ear-nose-throat, neurologists, psychiatrists, tuberculosis doctors, skin and venereal disease doctors, radiologists, rehabilitation and sports medicine, dentists, and other doctors.
  - **Nursing staff**: Nursing staff, medical nurses and midwives. Doctor's assistants, laboratory assistants, X-ray assistants and others stop in 2011 (the 2012 definitions folded them into other groups); they stay in the data file but are not listed.
- **Hospitals and clinics** (Lucide `Hospital`), flat under three headings, one unit each: **Facilities**, as a count: **Hospitals** (selected) and Out-patient clinics; **Beds**, as a count: Hospital beds; **Visits · million**: Out-patient visits. A chart shows one unit at a time: ticking a row of another unit replaces the selection.

Each view selects its bold series when it is first chosen. Switching keeps the years. Doctor and nurse values come from the two staff tables in persons; the totals equal Geostat's "main characteristics" table, which the checks confirm.

## 5. Illnesses page

The line under the heading reads "2025: 500.4 thousand new cases of respiratory disease".

One list, in thousand people (new cases diagnosed in the year), 2002–2025:

- **Disease groups** (heading): Geostat's disease groups by ICD-10 class. These are infectious and parasitic; cancer; blood; endocrine and metabolism; mental and behavioural; nervous system; eye; ear; circulatory; respiratory; digestive; skin; musculoskeletal; urogenital; pregnancy and childbirth complications; conditions of the newborn period; congenital malformations; and injuries and poisonings.
  - Until 2005 Geostat published nervous system, eye and ear as one combined group. That group is a separate line covering 2002–2005, and the three separate groups start in 2006.
- **Single diseases** (heading):
  - tuberculosis (new cases);
  - HIV (new cases);
  - diabetes, from 2016;
  - anaemia, from 2016;
  - syphilis;
  - gonorrhoea.

Selected on arrival are the five largest disease groups in the latest year: respiratory, eye, musculoskeletal, circulatory and urogenital. This is the approved default (the AGENTS.md "only the applicable total" exception), because Geostat publishes no total of all new cases and fiscal.ge does not add one up. The groups are not mutually exclusive counts of people.

Disease groups are stored in thousands as Geostat prints them. Single diseases are stored in persons, as printed, and shown in thousands with three decimals (933 shows as 0.933). This is an exact unit conversion, so nothing is rounded away. The table shows the most decimals among the selected series, as Energy and food does.

## 6. Causes of death page and area pages

**Causes of death index** (`/explorer/health/causes-of-death`) follows the Living standards Income index:

- The line under the heading reads "2025: 11.3 deaths per 1,000 people in Georgia".
- Under it are the shared `RegionIndex` map and the ranked list of the 11 regions, coloured by Geostat's death rate per 1,000 people for the latest year, with the occupied-territory overlays.
- Georgia is the first, unranked row of the list. Georgia and every region, on the map or in the list, link to their own area page.
- There is no chart workspace and no measure switch on the index. The one source line is the `RegionIndex` footer, which names the source, unit and map year and carries the geoBoundaries credit.

**Area pages** (`/explorer/health/causes-of-death/regions/[id]`) are 12 pages: `georgia` and the 11 regions. They follow the Living standards area pages:

- The heading is `სიკვდილის მიზეზები — [გურია ▾]` / `Causes of death — [Guria ▾]`. The `RegionPicker` offers Georgia first plus an all-regions entry that returns to the index, and previous/next links sit on the right, in the order Georgia then the regions.
- The line under the heading reads, for example, "2025: 1,567 deaths · Guria". No map follows.
- One list of deaths in persons, 2014–2025:
  - **All deaths** (selected).
  - Then Geostat's causes by ICD-10 chapter, each named in plain words with its Roman numeral kept for reference only in the methodology. These are infectious; cancer; blood; endocrine; mental; nervous system; eye; ear; circulatory; respiratory; digestive; skin; musculoskeletal; urogenital; pregnancy and childbirth; newborn period; congenital; ill-defined causes; injuries, poisoning and external causes; and COVID-19 (from 2020).
- "Ill-defined causes" is Geostat's chapter XVIII ("symptoms, signs and abnormal findings, not elsewhere classified"). It is about one death in five, and the methodology page explains it.
- No measure switch. Geostat publishes the death rate per 1,000 only as a total, which the index map shows, and fiscal.ge calculates no rate per cause.

The Population pages already show total deaths and life expectancy. These pages add the causes and the regional death rate. The two pages are not cross-linked, and the methodology page says the totals are the same Geostat figures.

## 7. Data foundation

### Sources

The files come from Geostat's Healthcare page (categories/54) and Deaths page (categories/320), downloaded from the cloud workspace on 2026-10-15. Copies are in `/mnt/project-files/health-sources/` and `/mnt/project-files/health-sources/deaths/`.

| Geostat file | Used for | Years |
| --- | --- | --- |
| `Number-of-physicians-by-occupations.xlsx` | Doctors and specialities | 2002–2025 |
| `Number-of-paramedical-personnel-by-basic-specialities.xlsx` | Nurses and sub-groups | 2002–2025 |
| `Main-characteristics-of-public-health.xlsx` | Hospitals, out-patient clinics, beds, visits; check of the staff totals | 2002–2025 |
| `Morbidity-with-acute-and-chronic-diseases-by-main-disease-groups.xlsx` | Disease groups | 2002–2025 |
| `Morbidity-of-patients-with-tuberculosis.xlsx` | Tuberculosis new cases | 2002–2025 |
| `Morbidity-of-patients-with-HIV-AIDS.xlsx` | HIV new cases | 2002–2025 |
| `New-Cases-of-Diabetes-Mellitus.xlsx` | Diabetes (total) | 2016–2025 |
| `New-Cases-of-Anemia.xlsx` | Anaemia (total) | 2016–2025 |
| `Morbidity-of-patients-with-syphilis-and-gonorrheae.xlsx` | Syphilis, gonorrhoea | 2002–2025 |
| `23-2-deaths-by-chapters-regions.xlsx` | Deaths by cause, Georgia and 11 regions | 2014–2025 |
| `24-1-Crude-death-rate-by-regions.xlsx` | Death rate per 1,000, Georgia and 11 regions (map and index line) | 2014–2025 served (published from 1994) |

The other downloaded tables are archived for provenance but not served. These cover children's illnesses, infectious diseases by type, cancer screening, emergency calls, abortions, the 2020+ circulatory and respiratory tables, disability programmes, maternal, infant and under-5 deaths, suicide, and deaths by sex, age or urban/rural. The death rate is served from 2014 because Geostat says 1994–2013 are back-estimates and registered data start in 2014, which is also where the causes start.

Rough size: staff about 530 values, facilities about 100, illnesses about 590, deaths about 2,900 and death rates about 140. That is about 4,300 served values; the plan fixes the exact count.

### Research package

`docs/Raw Data/Health/geostat-health-annual/` follows the Energy and food package.

- Original files go under `official/`, with a source manifest giving the URL, retrieval time, SHA-256 and size.
- A `prepare.py` script transcribes every used cell with its sheet and cell reference.
- An independent verification script, a validation report and a coverage file sit alongside.
- The originals are never edited.

### Canonical file and checks

- **Prepare script.** `npm run data:prepare-health` writes `data/imports/health-annual.csv` (UTF-8 with BOM) and `data/reports/health-validation.json`. With `--check` it reproduces both byte for byte, and it runs inside `data:validate`.
- **Row contents.** Each row keeps:
  - the exact workbook value at its stored precision (the death-rate cells hold unrounded values such as 11.2605…);
  - the area (`georgia` or an existing `region.*` ID, as Living standards uses);
  - the unit, as Geostat prints it (`persons`, `persons_thousand`, `units`, `units_thousand` for beds, `visits_thousand` or `per_1000_population`);
  - `basis=actual` and value status `official`;
  - the source ID, sheet and cell.
- **Stable IDs.** They are lowercase and follow `health.{topic}.{item}`, for example `health.staff.doctors`, `health.staff.doctors_surgeons`, `health.facilities.hospitals`, `health.facilities.beds`, `health.visits.outpatient`, `health.illness.respiratory`, `health.illness.tuberculosis`, `health.deaths.total`, `health.deaths.circulatory`, `health.deaths.covid19` and `health.death_rate.total`.
- **Validation rejects:** a changed value; a missing, extra or duplicate observation; a year outside each table's coverage; and a zero written where Geostat printed `…`, `...` or `-`.
- **Validation checks, within rounding:**
  - doctors and nurses equal the "main characteristics" totals ×1,000 every year;
  - doctor specialities add up to doctors every year;
  - causes add up to all deaths for every area and year, COVID-19 included;
  - the 11 regions add up to Georgia for deaths every year;
  - Georgia's and each region's all-deaths values equal the `demography.deaths` values already served by the Population pages;
  - a few anchor values match Geostat: doctors 2025 22,491; nurses 2025 21,262; hospitals 2025 232; beds 2025 15.232 thousand; respiratory 2025 500.359 thousand; tuberculosis 2025 933; deaths 2025 44,319; circulatory deaths 2025 16,711; COVID-19 deaths 2021 11,286; and Georgia's death rate 2025 11.26 per 1,000.
- **Nothing derived.** Fiscal.ge calculates no shares, rates per cause, totals of new cases, growth rates or interpolation.

### Serving

- All pages stay prerendered. The CSV loader and the numeric client projection follow Energy and food.
- The private Supabase mirror gets a `HealthFact` table in one versioned migration, with RLS on and public grants revoked. The transactional `data:import` compares it field by field, and CSV and database modes must serve identical values. The live migration and import happen only when Duru merges, through the existing release pipeline.
- Like Energy and food, Health is not added to the `/mcp` fact-query snapshot or the JSON publications.

## 8. Counting changes (series breaks)

These are recorded in `data/imports/health-series-breaks.csv` in the demography break format, and drawn on the charts as section 3 describes:

| Break | Applies to | Year | What Geostat says |
| --- | --- | --- | --- |
| `staff_definitions_2012` | Doctors, specialities, nurses, nurse sub-groups | 2012 | Staff definitions were revised to the international ISCO-08 classification, and some nurse groups were regrouped. |
| `staff_register_2020` | Doctors, specialities, nurses, nurse sub-groups | 2020 | From 2020 staff come from a new personal register of health workers and are not comparable with 2002–2019. |
| `icd10_groups_2006` | Combined nervous system, eye and ear group; the three separate groups | 2006 | From 2006 ICD-10 splits that group into three. Shown as one series ending and three starting, so there's no extra rule. |
| `new_cases_electronic_2020` | Disease groups, diabetes | 2020 | From 2020 new cases are recorded in an electronic out-patient system; diabetes is counted from personal records. |

The methodology page also notes Geostat's other caveats without drawing them:

- the pregnancy and newborn registry from 2018;
- the 2008–2009 HIV reporting change, which Geostat applied back to earlier years;
- the 2015–2017 revision of causes of death.

## 9. Sources, Excel and methodology

- The Geostat workbooks are published through the existing source archive (`data/methodology/source-archives/health.csv`). The methodology bundle must not pull large data files (the PR #170 rule).
- Excel reuses the three-sheet writer (Summary, Data, Sources) in the reader's language. It holds the active measure's selected series and years, explicit units, blank missing cells and validated source links. It has no internal-identifier or cell-reference columns.
- `/methodology/health` explains in plain words:
  - who collects the data: the Ministry of Health and the National Center for Disease Control, published by Geostat;
  - what "doctors" and "nurses" count;
  - the 2012 and 2020 staff changes;
  - that new cases are diagnoses recorded by clinics, not the number of sick people, and the 2020 recording change;
  - why there is no total of all illnesses;
  - the ICD-10 chapters and what "ill-defined causes" means;
  - that the death rate is deaths per 1,000 residents as published by Geostat;
  - that the totals match the Population pages;
  - that the pages state no causes or explanations.

## 10. Out of scope

The following are out of scope, and each would need its own approval:

- pensions and social help (a later card in this hub);
- health spending, which is already in the Budget pages, and WHO's total health spending;
- NCDC yearbooks;
- children's illnesses;
- infectious diseases by type;
- cancer screening;
- emergency calls;
- abortions;
- disability programmes;
- infant, under-5 and maternal deaths;
- suicide;
- deaths by sex, age or urban/rural;
- causes of death below the ICD-10 chapter level;
- illnesses or staff by region (Geostat doesn't publish them);
- rates per 1,000 or 100,000 calculated by fiscal.ge;
- MCP tools and the JSON/CSV publications.

## 11. Verification

1. The canonical file reproduces every served value from the original cells. The independent verification passes, and CSV and database modes agree.
2. Defaults, nesting, headings, measure switching, gaps, counting-change marks and URL state behave as sections 3–8 describe, with the anchor values above.
3. Chart, table and Excel agree for the same settings, and the source links work.
4. Georgian and English work at 390, 768 and 1440 pixels, and keyboard use and language switching keep the settings.
5. Duru sees screenshots and, if wanted, a clickable preview first (branch pushed, no PR). After Duru's OK, run `npm run check`, `npm run build` and `npm run test:browser` once, then open the PR.

During implementation, also:

- update `Project_Definition.md` section 2 with a new approved Health item;
- update `DESIGN.md` with the hub, three pages and area pages;
- add a new `docs/data-methodology/health-annual.md` and the new table to `docs/data-methodology/database-import.md`.

## 12. Reuse

- **Used as is:**
  - page and chart parts: `ExplorerWorkspace`, `ExplorerHeading`, `LatestValueLine`, `EditorialLineChart` (with its `breaks` prop), `ExplorerTable` (with `breakYears`), `RangeStrip`, `SeriesAside`, `FlatSeriesPanel` with nested rows, `SegmentedTabs` with icon options and `ControlTooltip`, `SourceNote`;
  - map and region parts: `RegionIndex`, `RegionMap`, `buildLatestValueRegionMapModel`, `RegionPicker`, `EntityNeighbourLinks`, the Living standards area-page slugs (`georgia`, region ID without `region.`);
  - state and helpers: `use-hash-explorer-state`, the `topicSeries` helpers;
  - downloads and sources: the three-sheet Excel writer and `ExcelDownloadButton`, the source-archive and methodology components;
  - checks and formats: the generated-artifact and served-rows parity checks, and the demography series-break format.
- **Small additions:**
  - The Illnesses page needs the "Disease groups" and "Single diseases" headings. The Business plan adds an optional per-row `heading` label to `FlatSeriesPanel`, with the default output unchanged. If Business merges first, Health reuses it. If not, Health adds the same optional prop, and Business reuses it.
  - The sidebar (`navTree.ts`), footer source note, sitemap, methodology catalogue and source inventory get the new hub.
  - The import script and mirror read and compare the new table.
  - Browser-test page counts change.
- **New:** these mirror their Energy and food or Living standards counterparts file by file, because those models are tied to their own indicators:
  - the research package and the `prepare-health` script;
  - the Prisma model and migration;
  - `lib/data/health/*`;
  - `lib/explorer/health.ts`, `healthWorkbook.ts` and `healthHubCards.ts`;
  - `components/health/health-explorer.tsx`;
  - `lib/pages/health.tsx`, the routes and the messages;
  - the methodology content and `docs/data-methodology/health-annual.md`.
- Before writing a new file, the plan checks whether the Living standards area-page code can serve the causes-of-death index and area pages by adding an option rather than copying. AGENTS.md "Reuse first" applies.

## 13. Coordination

- Business (thread "What data to add next") and Foreign debt and Reserves (thread "Where reserves could fit") are being built at the same time.
- The branch `claude/health-data-4w8ujy` starts from the latest `main` (Trade composition, PR #186).
- Some files are shared with those hubs: the sidebar, sitemap, methodology catalogue, Prisma schema and migrations, import script, browser-test page counts and the `FlatSeriesPanel` heading. Whichever hub merges later re-merges `main` and re-tests them, as Duru decided on 2026-10-15.

## 14. Decision for Duru

Approve this design. The implementation plan comes next. Approving the design does not authorize pushing, a pull request, deployment or live database changes. Screenshots or a live preview come first.

# Science and culture hub

Date: 2026-10-20
Status: Draft for Duru's review. Duru asked for Science and culture in its own thread on 2026-10-20 (project chat, "sience and culture in diff thread"), picked "Four pages" on the card "Which pages should the Science and culture hub have?" and "Looks right" on the card "Approve this page layout for the Science and culture hub?" (layout note: `/mnt/project-files/science-culture-preview/page-design.md`). This document writes that design down. It covers the data foundation and the pages.

## 1. Intended result

Fiscal.ge readers should be able to see, year by year, how much research Georgia does, how many inventions it patents, and how many people visit its museums and theatres.

The pages answer four questions:

- How many people do research? 10,191 researchers in 2019, 14,046 in 2024 (7,732 women), in 66 institutions that spent 242.9 million ₾ on research in 2024 (140.2 million in 2019).
- How many inventions are patented? In 2025 Georgian applicants filed 79 invention applications through Sakpatenti's national route and were granted 41 patents; 85 applications came by the international route.
- Who visits museums, and where? 261 museums had 2.0 million visitors in 2025 (2.25 million in 2019, 310 thousand in Covid 2020). Tbilisi had 536.9 thousand, Shida Kartli 477.2 thousand.
- How many go to the theatre? 53 professional theatres played to 620.3 thousand people in 2025.

The pages keep the production editorial look and reuse the Housing and Business workspace, flat series list, region map and area pages, table and Excel download. No new chart type, chart library or visual direction is added.

## 2. Pages and navigation

| Page | Georgian path | English path | Georgian name (proposal) |
| --- | --- | --- | --- |
| Hub | `/explorer/science-culture` | `/en/explorer/science-culture` | მეცნიერება და კულტურა |
| Research | `/explorer/science-culture/research` | `/en/explorer/science-culture/research` | კვლევები |
| Patents | `/explorer/science-culture/patents` | `/en/explorer/science-culture/patents` | პატენტები |
| Museums (map index) | `/explorer/science-culture/museums` | `/en/explorer/science-culture/museums` | მუზეუმები |
| Museums area page (Georgia and 11 regions) | `/explorer/science-culture/museums/[id]` | `/en/…` | მუზეუმები — {area} |
| Theatres | `/explorer/science-culture/theatres` | `/en/explorer/science-culture/theatres` | თეატრები |
| Methodology | `/methodology/science-culture` | `/en/methodology/science-culture` | მეცნიერება და კულტურა |

- Area ids are `georgia` and the site's 11 region ids (the Business and Housing ids, through `areaRoutes`). An unknown id is a 404. That is 12 area pages per locale.
- The hub has four clickable cards in the order Research, Patents, Museums, Theatres, reusing the hub cards. Each shows a sparkline of its default Georgia series, the latest figure and coverage, all from served facts:
  - Research: "2024 · 14,046 · 2019–2024" (researchers);
  - Patents: "2025 · 79 · 2016–2025" (invention applications from Georgian applicants);
  - Museums: "2025 · 1,998.9 · 2005–2025" (visitors, thousand);
  - Theatres: "2025 · 620.3 · 2006–2025" (audience, thousand).
- The sidebar places **Science and culture** directly after Education, and its four pages show beneath it when the section is active.
- Breadcrumbs, headings, language links, metadata, Dataset JSON-LD and the sitemap follow the existing pattern.
- The Georgian names are proposals for Duru's Georgian proofread. Row labels follow Geostat's Georgian workbooks (archived under `ka/`), for example «მკვლევარები», «დამთვალიერებელთა რიცხოვნობა», «სასარგებლო მოდელი».

## 3. Shared page rules

These rules apply to every page, as on Housing:

- Under the heading there is one short line from `LatestValueLine`, as worded for each page below, and it fits one line at 375 px. Nothing else sits under the heading. The only text under the chart is one short source line.
- **No page has a tab row or an icon switch.** Each measure sits under a small heading in the right-hand list, every row visible from the start (nothing hidden under a collapsible parent). Series names carry no prefixes. Outside the list (legend, tooltip, table, Excel) a row is named in full, `Heading — Row`, as on Business.
- **One unit at a time** (the Business rule, `keepOneBusinessUnit`): the chart shows rows of one unit. Ticking a row of another unit replaces the selection with that row, and the chart, table, years and Excel follow the selection's unit. Headings that share a unit (all the people headings on Research; all four patent headings) can be charted together.
- Only the default series named for each page is selected on arrival. It stays first, selectable and removable, and selection is unlimited. The default is drawn in ink, and every other series has a fixed, distinguishable colour.
- Chart | Table, the year range, the selection (including an empty one) and Excel work as on Housing, kept in the URL hash and across a language change.
- **Yearly values only.** All four sources are calendar-year tables.
- A year without a value is a gap in the chart, a dash in the table and a blank Excel cell, never zero. Geostat's `…` and blank cells are unavailable values. Geostat's `-` means none (zero) in the researcher, R&D staff, patent and staff tables, where the rows add up only with it read as zero; in the theatre events rows before 2021 it means "not collected" and is a gap (§7).
- Counts are whole numbers. Visitors, group tours, theatre audience and seats are in thousands, as Geostat publishes them, shown to one decimal (stored exactly). Research spending is in million ₾ to one decimal.
- The source line reads like the others, for example: "Source: Geostat, museums · 2005–2025 · Methodology and sources".
- Fiscal.ge derives nothing: no totals, shares, ratios (Geostat's visitors per museum and attendance per event are not served), growth rates or interpolation.

## 4. Research page

Line under the heading: "2024: 14,046 researchers".

One list, Georgia, 2019–2024:

- **Researchers** (მკვლევარები): All researchers (selected), Women, Men.
- **By degree**: Doctorate (ISCED 8), Master's (ISCED 7), Bachelor's (ISCED 6), Short-cycle (ISCED 5/4).
- **By field**: Natural sciences, Engineering and technology, Medical and health sciences, Agricultural and veterinary sciences, Social sciences, Humanities and the arts, Not identified.
- **By age**: under 25, 25–34, 35–44, 45–54, 55–64, 65 and over.
- **All R&D staff**: All staff, Technicians, Other support staff, Not specified. (Researchers are the fourth group of this total; they are the row at the top of the list, not repeated.)
- **Institutions**: Institutions doing research.
- **Spending · million ₾**: Spending on research and development.

The first five headings count persons and can be charted together. Geostat also splits each degree, field, age and staff group by sex; those splits stay in the archived workbooks and are not served.

The methodology page says that Geostat ran the 2019 survey itself and that from 2020 the figures come from the Ministry of Education, Science and Youth; that the under-25 group rises from 170 in 2020 to 1,012 in 2021 as published; and that "Not identified" researchers fall to none from 2022.

## 5. Patents page

Line under the heading: "2025: 79 invention applications from Georgia".

One list, Georgia, 2016–2025, all counts, under four headings, each with the same three rows:

- **Invention applications** (გამოგონება — განცხადებები): Georgian applicants (selected), Foreign applicants, International route.
- **Invention patents granted**: Georgian, Foreign, International route.
- **Utility model applications**: Georgian, Foreign, International route.
- **Utility model patents granted**: Georgian, Foreign, International route.

"Georgian" and "Foreign" are Geostat's local and foreign applicants under the national procedure; "International route" is Geostat's international procedure column. The methodology page explains in plain words what a utility model is (a shorter, simpler patent) and the two routes, and credits Sakpatenti, the National Intellectual Property Center, as the source Geostat names.

Patents by region (2022–2025, sheet 3) are archived and not served.

## 6. Museums: map index and area pages

**Index** (`/explorer/science-culture/museums`), following the Housing Regions index:

- Line: "2025: 2.0 million museum visitors" (million to one decimal, from the Georgia visitors row).
- The shared `RegionIndex` map and ranked list of the 11 regions, coloured by each region's visitors in the latest year, with the occupied-territory overlays. Georgia is the list's first, unranked row. Georgia and every region, on the map or in the list, link to their own area page. There is no map switch.
- There is no chart workspace on the index. The one source line is the `RegionIndex` footer, naming the source, unit and map year with the geoBoundaries credit.

**Area pages** (`/explorer/science-culture/museums/[id]`), following the Housing area pages:

- The heading is `მუზეუმები — [გურია ▾]` / `Museums — [Guria ▾]`, with the `RegionPicker` (Georgia first, and an all-regions entry that returns to the index) and previous/next links in the order Georgia then the regions.
- One latest-value line, for example "2025: 164.9 thousand visitors · Samtskhe-Javakheti".
- One list, 2005–2025, under four headings, each one row on a region's page:
  - **Visitors · thousand**: Visitors (selected).
  - **Group tours · thousand**: Group tours (Geostat's excursions).
  - **Exhibitions**: Exhibitions.
  - **Museums**: Museums.
- Georgia's page adds the rows Geostat publishes only nationally:
  - under **Museums**: Memorial, History and local studies, Art, Museum-reserves, Literature, Other (2005–2025);
  - a fifth heading **Staff** (2020–2025): All staff, Women, Men, Permanent staff, On contract, Under 25, 25–54, 55 and over.
- A link to another area keeps the selection where the row exists there (Visitors stays Visitors); rows that exist only on Georgia's page fall back to the default, as Housing's area links do.

Georgia's visitors, group tours and exhibitions come from the by-region workbook's Georgia row (thousand, as published); the national workbook's million figures are a cross-check only. Museum counts by region come from Geostat's count-by-region workbook, Georgia's count and types from the national workbook. Geostat lists no museums for Abkhazia AR, and the 11 regions add up to Georgia.

## 7. Theatres page

Line under the heading: "2025: 620.3 thousand theatre-goers".

One list, Georgia, 2006–2025:

- **Audience · thousand** (მაყურებელი): Audience (selected).
- **Shows**: Shows in Georgia, of which away from the home stage, Shows abroad.
- **Events** (2021–2025): Events in Georgia, of which away from the home stage, Events abroad.
- **Theatres**: All theatres, Drama and musical comedy, Puppet, Opera and ballet, Children and youth.
- **Seats · thousand**: Seats (including rented halls, as Geostat notes).
- **Staff** (2020–2025): the same eight rows as museums.

Shows, Events and Theatres count units and can be charted together.

**Audience break.** Geostat's note says that its 2006–2020 audience covers performances only; from 2021 the audience is of all events held in the country. This is recorded as a series break `theatre_audience_2021` (§9): as on Crime, the chart leaves a gap in the line at 2021 and draws a dashed rule labelled "new counting" (`EditorialLineChart` `breaks`), the table marks the year (`ExplorerTable` `breakYears`), and the methodology page explains it. Geostat's events rows print `-` for 2006–2020; those years are gaps, not zeros.

Theatres by region and Geostat's lumped "remaining regions" are archived and not served (Duru's "Four pages" choice). Participants in events abroad (2021–2025, persons) is a single short row of a different kind and is archived, not served.

## 8. Hub page

The hub at `/explorer/science-culture` reuses the hub cards (§2), the hub page component and the hub card description messages. The hub carries no text beyond the existing hub pattern.

## 9. Data foundation

### Sources

The files come from Geostat's Science (category 194) and Culture (category 615) pages, downloaded in the cloud workspace on 2026-10-20 (copies in `/mnt/project-files/science-culture-sources/`). The research workbooks name "2019 – Geostat; from 2020 – Ministry of Education, Science and Youth"; the patent workbook names the National Intellectual Property Center of Georgia (Sakpatenti). Sakpatenti's own site is reachable from the cloud but publishes no statistical tables, so Geostat's copy is the source.

| Geostat file | Used for | Years |
| --- | --- | --- |
| `science/Researchers.xlsx`, sheets 1–3 | Researchers total/women/men; by degree, age, field (totals only) | 2019–2024 |
| `science/R&D-Personal.xlsx` | All R&D staff, technicians, support staff, not specified | 2019–2024 |
| `science/Institutions.xlsx` | Institutions; R&D spending, million GEL | 2019–2024 |
| `science/Invention-Utility-Model.xlsx`, sheets 1–2 | Patents: inventions and utility models | 2016–2025 |
| `culture/Main-charasteristics-of-Museums.xls` | Georgia museums and types; national visitors cross-check | 2005–2025 |
| `culture/Main-charasteristics-of-Museums-by-Regions.xls` | Visitors, group tours, exhibitions: Georgia and 11 regions | 2005–2025 |
| `culture/Number-of-Museums-by-Regions.xls` | Museums by region | 2005–2025 |
| `culture/Employed-Staff-in-Museums.xls` | Museum staff | 2020–2025 |
| `culture/Main-Indicators-Of-Professional-Theatres.xls` | Theatres by type; seats | 2006–2025 |
| `culture/Events.xls` | Audience, shows, events | 2006–2025 (events 2021–) |
| `culture/Employed-Staff-in-Theatres.xls` | Theatre staff | 2020–2025 |

The other downloads (publications, museum exhibits 2011, libraries 2001–2008, publishing 2005–2020, theatres by region, patents by region) and the Georgian workbooks are archived for provenance and labels, not served.

Rough size: Research 156 values, Patents 120, Museums about 1,180, Theatres about 260: about 1,720 served values. The plan fixes the exact count.

### Research package and canonical file

- `docs/Raw Data/ScienceCulture/geostat-science-culture-annual/` follows the Housing package: originals under `official/` (with the two Geostat category page captures) and a source manifest (URL, retrieval time, SHA-256, size), a `prepare.py` that transcribes every used cell with its sheet and cell reference, an independent verification script, a validation report and a coverage file. The originals are never edited.
- `npm run data:prepare-science-culture` writes `data/imports/science-culture-annual.csv` (UTF-8 with BOM) and `data/reports/science-culture-validation.json`, re-reading every value from its archived cell as Housing does. `--check` reproduces both byte for byte and runs in `data:validate`.
- Each row keeps the exact workbook value as text, the published (display-rounded) value, the year, the unit (`persons`, `persons_thousand`, `count`, `gel_million`), `basis=actual`, value status `official`, source ID, sheet and cell, in the Housing/Business CSV headers.
- The series break goes into `data/imports/science-culture-series-breaks.csv` in demography's break format: `theatre_audience_2021`.
- Stable lowercase IDs follow `science_culture.{measure}.{group}`. Measures: `researchers`, `rd_staff`, `institutions`, `rd_spending`, `invention_applications`, `invention_patents`, `utility_applications`, `utility_patents`, `museums`, `museum_visitors`, `museum_tours`, `museum_exhibitions`, `museum_staff`, `theatres`, `theatre_audience`, `theatre_shows`, `theatre_events`, `theatre_seats`, `theatre_staff`. Groups include `total`, `women`, `men`, `degree_*`, `field_*`, `age_*`, `technicians`, `support`, `not_specified`, `local`, `foreign`, `international`, `type_*`, `away`, `abroad`, `permanent`, `contract`, and the 11 region ids.

### Checks

Validation rejects a changed value, a missing, extra or duplicate observation, a year outside a table's coverage and an unknown row or region label (region labels such as "Adjar AR" and "Adjara AR" are matched through a reviewed mapping). It also checks, within each table's rounding:

- women plus men equals the total (researchers, R&D staff, museum and theatre staff);
- researchers' degrees, fields and age groups each add up to all researchers;
- researchers, technicians, support staff and not specified add up to all R&D staff, and the R&D staff table's researchers equal the researchers table;
- permanent plus contract staff, and the three age groups, each equal all staff;
- museum types add up to all museums, and theatre types to all theatres;
- the 11 regions add up to Georgia for museums, visitors and exhibitions exactly, and for group tours within 0.2 thousand (Geostat rounds those to one decimal in early years);
- the national museum visitors (million) match the by-region Georgia row (thousand) to the national file's precision;
- the theatre audience in `Events.xls` equals the by-region workbook's Georgia row;
- anchor values match Geostat: researchers 2024 14,046 (women 7,732); R&D staff 2024 16,191; institutions 2024 66; spending 2024 242.9; invention applications from Georgian applicants 2025 79, granted 41; museums 2025 261, visitors 1,998.924 thousand; theatres 2025 53, audience 620.322 thousand.

### Serving

- All pages stay prerendered. The CSV loader and numeric client projection follow Housing.
- The private Supabase mirror gets a `ScienceCultureFact` table in one versioned migration, with RLS on and public grants revoked, compared field by field in the transactional `data:import`. CSV and database modes must serve identical values. The live migration and import happen only on Duru's merge, through the existing release pipeline.
- About 34 new static pages (hub, 4 pages, 12 area pages, methodology, in two languages).

## 10. Sources, Excel and methodology

- The workbooks are published through the source archive (`data/methodology/source-archives/science-culture.csv`). The methodology bundle must not pull large data files (the PR #170 rule).
- Excel reuses the three-sheet writer (Summary, Data, Sources) in the reader's language, with the selected unit's series and years, explicit units, blank missing cells and validated source links, with no internal identifier or cell-reference columns.
- `/methodology/science-culture` explains in plain words:
  - who collects each table (Geostat, the Ministry of Education from 2020, Sakpatenti);
  - what researchers and R&D staff are, and the 2019/2020 change of collector;
  - patents and utility models, and the national and international routes;
  - what a museum visitor and a group tour count, and that the regions add up to Georgia;
  - the 2021 theatre audience break and that events are counted from 2021;
  - that `-` means none in these tables, except the events rows before 2021;
  - that the pages state no causes (for example of the 2020 fall).

## 11. Out of scope

Libraries, newspapers and print runs, museum collections (exhibits), publication counts, theatres by region, patents by region, sex splits of researcher and staff subgroups, participants in events abroad, Geostat's averages (visitors per museum, attendance per event), trademarks, designs and other Sakpatenti registers, sport, cinemas, culture spending (on the Budget pages), forecasts, causes, MCP tools and the central JSON/CSV publications. Each would need its own approval.

## 12. Verification

1. The canonical file reproduces every served value from the original cells. The independent verification passes, and CSV and database modes agree.
2. Defaults, headings, the one-unit rule, gaps, the theatre break and URL state behave as in sections 3–8, with the anchor values above.
3. Chart, table and Excel agree for the same settings, and the source links work.
4. Georgian and English work at 375/390, 768 and 1440 pixels, the latest-value lines fit one line on phones, and keyboard use and language switching keep the settings.
5. Duru sees screenshots and, if wanted, a clickable preview first (branch pushed, no PR). After Duru's OK, run `npm run check`, `npm run build` and `npm run test:browser` once, then open the PR.

During implementation, also update `Project_Definition.md` section 2 (a new approved Science and culture item), `DESIGN.md` (a new Science and culture surfaces section) and add `docs/data-methodology/science-culture-annual.md`.

## 13. Reuse

- **Used as is:** `RegionIndex`, the region map model helpers, `RegionPicker`, `areaRoutes`, `EntityHeading`, `ExplorerWorkspace`, `LatestValueLine`, `EditorialLineChart` with its `breaks` marks and `ExplorerTable` `breakYears` (as Crime uses them), `ExplorerTable`, `RangeStrip`, `SeriesAside`, `FlatSeriesPanel` with per-row headings, `keepOneBusinessUnit`, `topicSeries` colours, the hub cards and hub page, `SourceNote`, the hash state, the three-sheet Excel writer and `ExcelDownloadButton`, the source-archive and methodology components, `readVerifiedPackageFile`, `assertGeneratedArtifactMatches`, the parity checks and the series-break record format.
- **Small additions:** the sidebar (`navTree.ts`), footer source note, sitemap, methodology catalogue, source inventory, agent files (`llms.txt`) and dataset-hub list get the new section. The import script and mirror read and compare the new table. Browser-test page counts change.
- **New, each mirroring its Housing counterpart:** the research package and `prepare-science-culture` script, the Prisma model and migration, `lib/data/scienceCulture/*` (types, prepare, validation, import), `lib/explorer/scienceCulture*.ts` (series model, museum areas, region map, hub cards, workbook), `components/science-culture/*` (page explorer, museum index, museum area explorer), `lib/pages/science-culture*.tsx`, the routes and messages, the methodology content and `docs/data-methodology/science-culture-annual.md`. The plan names the Housing file each one mirrors and checks first whether an option on that file would serve instead (AGENTS.md "Reuse first").

## 14. Coordination

Transport and cars, Internet and digital life, Environment and climate, and Social protection are being built in parallel threads. The branch `claude/science-culture-hub-4wkqsn` starts from `main` at the Education merge (PR #194). Whichever hub merges later merges `main` and redoes the shared edits (sidebar, sitemap, methodology catalogue, DB setup, browser-test page counts, `DESIGN.md` and `Project_Definition.md` section numbers).

## 15. Decision for Duru

Approve this written spec. The implementation plan comes next. Approving the spec does not authorize pushing, a pull request, deployment or live database changes. Screenshots or a live preview come first.

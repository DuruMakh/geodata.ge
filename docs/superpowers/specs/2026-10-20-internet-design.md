# Internet and technology hub

Date: 2026-10-20
Status: Draft for Duru's review. Duru picked "Internet and digital life" as the next data on 2026-10-20 (project chat, "lets do both transport and cars and internet and digital file but in seperete thread") and chose "Approve" on the card "Approve this four-page layout for the Internet and technology hub?" (05:34Z, layout in `/mnt/project-files/internet-build/layout-proposal.md`). This document covers both the data foundation and the pages.

## 1. Intended result

Fiscal.ge readers should be able to see, year by year, how many Georgian homes are online, who uses the internet and who does not, what people do online, and who owns a phone, a smartphone or uses a computer, for towns and villages, women and men, and age groups, and for homes by region.

The pages answer four questions:

- How many homes are online, and where? 70.1% of homes had internet in 2016, 93.5% in 2026; Tbilisi 98.2%, villages 89.0%. Homes with a computer went from 63.8% to 57.9%.
- Who uses the internet? 58.5% of people aged 6 and older used it in the last three months in 2016, 89.6% in 2026; among people aged 60 and older, 14.6% and 70.8%. 9.7% have never used it.
- What do people do online? 38.6% of internet users aged 15 and older bought or ordered something online in 2026 (63.0% of 15–29 year olds), up from 18.6%. 61.0% of recent users bank online.
- Who has a phone or a computer? 93.3% of people aged 6 and older own a mobile phone, 86.6% a smartphone; 49.9% used a computer in the last three months.

Every value is a percentage Geostat published, copied exactly. Fiscal.ge calculates nothing. The pages keep the production editorial look and reuse the Housing workspace, flat series list, region map and area pages, table and Excel download. No new chart type, chart library or visual direction is added.

## 2. Pages and navigation

| Page | Georgian path | English path | Georgian name (proposal) | English name |
| --- | --- | --- | --- | --- |
| Hub | `/explorer/internet` | `/en/explorer/internet` | ინტერნეტი და ტექნოლოგიები | Internet and technology |
| Internet at home (map index) | `/explorer/internet/homes` | `/en/explorer/internet/homes` | ინტერნეტი სახლში | Internet at home |
| Area page (Georgia and 11 regions) | `/explorer/internet/homes/[id]` | `/en/explorer/internet/homes/[id]` | ინტერნეტი სახლში — {area} | Internet at home — {area} |
| Internet users | `/explorer/internet/users` | `/en/explorer/internet/users` | ინტერნეტის მომხმარებლები | Internet users |
| Shopping and services online | `/explorer/internet/online` | `/en/explorer/internet/online` | ონლაინ შესყიდვები და მომსახურება | Shopping and services online |
| Phones and computers | `/explorer/internet/devices` | `/en/explorer/internet/devices` | ტელეფონები და კომპიუტერები | Phones and computers |
| Methodology | `/methodology/internet` | `/en/methodology/internet` | ინტერნეტი და ტექნოლოგიები | Internet and technology |

- The hub has four clickable cards in the order of the table, reusing the hub cards. Each shows a sparkline of its page's default series (Georgia's homes with internet on the first card), the latest figure and coverage from served facts.
- The sidebar places **Internet and technology** directly after Crime and justice, and its four pages show beneath it when the section is active. The footer source note is the Geostat one.
- Breadcrumbs, headings, language links, metadata, Dataset JSON-LD and the sitemap follow the existing pattern.
- The Georgian names are proposals. Final row wording follows Geostat's Georgian workbooks (`ka/` copies), with plain-language shortening where a row is too long for the list.

## 3. Shared page rules

These rules apply to every page, as on Housing:

- Under the heading there is one short line from `LatestValueLine`, fitting on one line at 375 px. Nothing else sits under the heading, and the only text under the chart is one short source line.
- **No page has a tab row or a measure switch.** Rows sit under small headings that name the measure and who it counts (for example "Bought or ordered online · % of internet users aged 15+"). Every row is visible from the start; nothing is nested or collapsible; series names carry no prefixes.
- **On the three topic pages the chart shows one heading at a time.** The headings measure different things over different groups of people (everyone aged 6+, internet users aged 15+, recent users), so ticking a row under another heading replaces the selection with that row, and the years follow it. This is the Business and Housing one-unit rule with the heading as the unit. Area pages are different (section 7): all their rows are shares of homes, so they can be shown together.
- Only the default series named for each page is selected on arrival. It stays first, selectable and removable, and selection is unlimited within its heading.
- Chart | Table, the year range and Excel work as on Housing. Range, selection (including an empty one) and chart/table mode live in the URL hash and survive a language change.
- Each group wears one fixed colour on every heading and page (Towns, Villages, Women, Men and each age group), and **Everyone** is drawn in ink. Rows of the shopping page's activity and public-services headings take the palette by position.
- A year without a value is a gap in the chart, a dash in the table and a blank Excel cell, never zero. Geostat's `…` cells are unavailable values.
- **Yearly values only.** Geostat runs the survey once a year, in June or July; each year shows that survey. The 2026 survey is published and is shown.
- Values are percentages to one decimal, as Geostat prints them.
- The source line reads like the others, for example: "Source: Geostat, ICT usage in households survey · % · 2016–2026 · Methodology and sources".

The group rows, in this order, with stable ids: Everyone (`total`), Towns (`urban`), Villages (`rural`), Women (`female`), Men (`male`), 6–14 (`age_6_14`), 15–29 (`age_15_29`), 30–59 (`age_30_59`), 60 and older (`age_60_plus`). A heading measured on people aged 15 and older has no 6–14 row. Geostat's "15 years and older" column is not served (the three older age groups cover it).

## 4. Internet users page

Line under the heading: "2026: 89.6% used the internet in the last 3 months".

One list, 2016–2026, under three headings:

- **Used the internet in the last 3 months · % of people aged 6+**: Everyone (selected), then the eight groups (table 02, "Within last 3 months").
- **Never used the internet · % of people aged 6+**: the same nine rows (table 02, "Never used").
- **Online every day or almost every day · % of internet users aged 15+**: Everyone and seven groups (table 04; users are people who went online in the last 3 months).

## 5. Shopping and services online page

Line under the heading: "2026: 38.6% of internet users shopped online".

One list, 2016–2026, under three headings:

- **Bought or ordered online · % of internet users aged 15+**: Everyone (selected) and seven groups (table 05; users are people who went online in the last 12 months).
- **What internet users do online · % of users aged 15+** (Everyone only, table 03; users in the last 3 months): Social networks, Calls and video calls, Reading news, E-mail, Looking for health information, Looking up goods and services, Job search, Internet banking, Downloading software.
- **Public services online · % of people aged 15+** (Everyone only, table 16, last 12 months): Dealt with public services online, Got information from their websites, Downloaded official forms, Submitted completed forms.

## 6. Phones and computers page

Line under the heading: "2026: 93.3% own a mobile phone".

One list under three headings, each with Everyone and the eight groups:

- **Own a mobile phone · % of people aged 6+** (table 12, 2016–2026). Everyone selected.
- **Own a smartphone · % of people aged 6+** (table 14, 2019–2026).
- **Used a computer in the last 3 months · % of people aged 6+** (table 09, 2016–2026).

## 7. Internet at home: map index and area pages

**Index** (`/explorer/internet/homes`), following the Housing Regions index:

- One latest-value line: "2026: 93.5% of homes have internet". Under it is the shared `RegionIndex` map and ranked list of the 11 regions, coloured by each region's share of homes with internet in the latest year all 11 regions have (2026), with the occupied-territory overlays. There is no map switch.
- Georgia is the list's first, unranked row. Georgia and every region, on the map or in the list, are links to their own area page.
- There is no chart workspace on the index. The one source line is the `RegionIndex` footer, naming the source, unit and map year with the geoBoundaries credit.

**Area pages** (`/explorer/internet/homes/[id]`, 12 pages: `georgia` and the 11 regions), following the Housing area pages:

- The heading is `ინტერნეტი სახლში — [გურია ▾]` / `Internet at home — [Guria ▾]`, with the `RegionPicker` (Georgia first, and an all-regions entry that returns to the index) and previous/next links in the order Georgia then the regions.
- One latest-value line, for example "2026: 91.1% of homes have internet · Guria".
- A region's list has one heading, **Share of homes · %**, with two rows: With internet (selected, ink) and With a computer (ink, dashed).
- Georgia's list has two headings, **Homes with internet · %** and **Homes with a computer · %**, each with Georgia, Towns and Villages. Georgia's internet row is selected. A computer row wears its internet counterpart's colour with a dashed line.
- Rows of both headings can be shown together, since every row is a share of homes.
- A link to another area (picker, previous/next) carries the selection moved to that area: an internet row stays an internet row and a computer row a computer row; Towns and Villages, which a region page lacks, fall back to the region's own row of that kind.
- Years: Georgia, Towns, Villages, Tbilisi, Kakheti, Shida Kartli, Adjara, Samegrelo-Zemo Svaneti and Imereti from 2016; Kvemo Kartli, Samtskhe-Javakheti, Guria, Mtskheta-Mtianeti and Racha-Lechkhumi and Kvemo Svaneti from 2020 (Geostat: the sample was too small before 2020). Imereti's 2016–2019 values include Racha-Lechkhumi and Kvemo Svaneti, as on the Living standards pages; the methodology says so and the chart draws no marker. Geostat's "Other regions" column (2016–2019) is not served.

## 8. Data foundation

### Sources

Downloaded directly from Geostat, "ICT usage in households" (`https://www.geostat.ge/en/modules/categories/106`), in the cloud workspace on 2026-10-20. Copies of all 17 English tables and their 17 Georgian twins are in `/mnt/project-files/internet-sources/`.

| Geostat table | Used for | Years |
| --- | --- | --- |
| 01 Share of households with internet access | Internet at home, all areas | 2016–2026 |
| 08 Share of households with computer access | Computer at home, all areas | 2016–2026 |
| 02 Last internet use, aged 6+ | Used in the last 3 months; never used | 2016–2026 |
| 04 Frequency of internet use | Every day or almost every day | 2016–2026 |
| 05 E-commerce | Bought or ordered online | 2016–2026 |
| 03 Purposes of internet use | Nine activities, Everyone | 2016–2026 |
| 16 Interaction with public authorities | Four rows, Everyone | 2016–2026 |
| 12 Own a mobile phone | Own a mobile phone | 2016–2026 |
| 14 Own a smartphone | Own a smartphone | 2019–2026 |
| 09 Last computer use, aged 6+ | Used a computer in the last 3 months | 2016–2026 |

Archived for provenance but not served: tables 06 (mobile internet), 07 and 11 (number of internet and software activities, whose reference period changed in 2018 and 2025), 10 (computer frequency), 13 and 15 (uses a mobile phone or smartphone), 17 (digital skills, 2025–2026 only), the unserved rows and group columns of the served tables, the Georgian tables, and captures of the English and Georgian category pages.

Served values: homes 2 × (4 × 9 + 7 × 14) = 268; users 99 + 99 + 88 = 286; online 88 + 99 + 44 = 231; devices 99 + 72 + 99 = 270. About 1,055 in all; the plan fixes the exact count.

### Research package

`docs/Raw Data/Internet/geostat-ict-households-annual/` follows the Housing package. Original files go under `official/` with a source manifest (URL, retrieval time, SHA-256, size). A `prepare.py` transcribes every used cell with its sheet and cell reference, and an independent verification script, a validation report and a coverage file sit alongside. The originals are never edited.

### Canonical file and checks

- `npm run data:prepare-internet` writes `data/imports/internet-annual.csv` (UTF-8 with BOM) and `data/reports/internet-validation.json`. `--check` reproduces both byte for byte and runs in `data:validate`.
- Each row keeps the exact workbook value, the value as Geostat displays it (one decimal), `unit=percent`, `basis=actual`, value status `survey_estimate`, source ID, sheet and cell.
- Stable lowercase IDs follow `internet.{measure}.{group}`. Measures: `homes_internet`, `homes_computer`, `used_3m`, `never_used`, `daily`, `bought_online`, `activity_<id>` (`social`, `calls`, `news`, `email`, `health`, `goods_info`, `jobs`, `banking`, `software`), `egov_<id>` (`any`, `info`, `download_forms`, `submit_forms`), `own_mobile`, `own_smartphone`, `computer_3m`. Groups: section 3's ids, plus `georgia` and the site's 11 region ids for the homes measures.
- Rows are matched by their printed labels and columns by header text, never by position. The year is read from the row label ("June, 2016", "July, 2018").
- Validation rejects a changed value, a missing, extra or duplicate observation, a year outside each table's coverage, and a value where Geostat printed `…` or `x`. It also checks, within rounding:
  - within-3-months, more-than-3-months-ago and never-used add up to 100 for every group and year (tables 02 and 09; the middle row is read but not served);
  - every-day, weekly and less-than-weekly add up to 100 (table 04);
  - interacted and did-not-interact add up to 100 (table 16);
  - Georgia's value lies between Towns and Villages, and Everyone's between Women and Men;
  - each English table equals its Georgian twin cell for cell;
  - anchor values: homes with internet 2016 70.1 and 2026 93.5, Tbilisi 2026 98.2; used in the last 3 months 2026 89.6; bought online 2026 38.6 (15–29: 63.0); internet banking 2026 61.0; own a mobile phone 2026 93.3 (Geostat cell 93.34998…, so not 93.4).
- Fiscal.ge derives nothing: no averages, differences, growth rates or interpolation.

### Serving

- All pages stay prerendered. The CSV loader and numeric client projection follow Housing.
- The private Supabase mirror gets an `InternetFact` table in one versioned migration, with RLS on and public grants revoked, compared field by field in the transactional `data:import`. CSV and database modes must serve identical values. The live migration and import happen only on Duru's merge, through the existing release pipeline.

## 9. Sources, Excel and methodology

- The Geostat workbooks are published through the existing source archive (`data/methodology/source-archives/internet.csv`). The methodology bundle must not pull large data files (the PR #170 rule).
- Excel reuses the three-sheet writer (Summary, Data, Sources) in the reader's language: the selected series and years with their heading in each series name, percentages to one decimal, survey-estimate status, blank missing cells and validated source links, with no internal identifier or cell-reference columns.
- `/methodology/internet` explains in plain words:
  - that the figures come from Geostat's yearly household survey, run in June or July, and are estimates from a sample, so small differences between groups or years may not be meaningful;
  - who each heading counts: homes; people aged 6 and older; people aged 15 and older; internet users (in the last 3 or 12 months, as each table says);
  - that the regional sample was enlarged in 2020, which is why five regions start then, and that Imereti before 2020 includes Racha-Lechkhumi and Kvemo Svaneti;
  - that in 2016 Geostat asked the mobile-internet question differently (why that table is left out) and that it changed the reference period of the activity counts;
  - what each activity and public-services row means, from Geostat's table titles;
  - that the pages state no causes.

## 10. Out of scope

Group breakdowns of each online activity and public-services row; the archived tables in section 8; digital skills; firms' ICT use (a separate Geostat survey); internet prices, speeds or providers (not Geostat statistics); municipality data (none is published); quarterly values; MCP tools; and the central JSON/CSV publications. Each would need its own approval.

## 11. Verification

1. The canonical file reproduces every served value from the original cells. The independent verification passes, the checks in section 8 hold, and CSV and database modes agree.
2. Defaults, headings, the one-heading rule on topic pages, mixed rows on area pages, gaps, the region start years and URL state behave as in sections 3–7, with the anchor values above.
3. Chart, table and Excel agree for the same settings, and the source links work.
4. Georgian and English work at 390, 768 and 1440 pixels, keyboard use and language switching keep the settings, and every latest-value line fits on one line at 375 px.
5. Duru sees screenshots and, if wanted, a clickable preview first (branch pushed, no PR). After Duru's OK, merge main, run `npm run check`, `npm run build` and `npm run test:browser` once, then open the PR.

During implementation, also update `Project_Definition.md` section 2 (a new approved Internet and technology item), `DESIGN.md` (the hub, its four pages and area pages, and the sidebar order), and add `docs/data-methodology/internet-annual.md`.

## 12. Reuse

- **As is:** the explorer shell (`ExplorerHeading`, `ExplorerWorkspace`, `LatestValueLine`, `FlatSeriesPanel` with headings, `ModeTabs`, `RangeStrip`), `EditorialLineChart` (including dashed strokes), `ExplorerTable`, `ExcelDownloadButton` and the workbook writer, `topicSeries` (model, hash, coverage), the `unitList` one-unit helpers, `areaRoutes`, `RegionIndex`, `RegionPicker`, `EntityNeighbourLinks`, `buildLatestValueRegionMapModel` / `latestCompleteRegionYear` and the site's region ids, hub cards, navigation tree, sitemap and SEO helpers, the methodology catalogue and source-archive pipeline, the served-data CSV/DB parity framework.
- **Small additions:** an Internet entry in each registry Housing joined (navigation, messages, methodology catalogue, source inventory, sitemap, dataset vocabulary, `llms.txt`, mirror rows, import script, validate-all, Prisma schema, browser hub counts).
- **Genuinely new:** the Internet data module (types, prepare, validation, import), its prepare script, and the thin Internet page components and models that configure the shared shell, as every hub has. Housing's components are bound to `housing.*` messages and its own latest-line logic, so they are composed again from the shared parts rather than changed. The one-heading rule calls the existing `unitList` helpers with the heading as the unit, with no change to them.

## 13. Coordination

The "Transport and cars" hub and the social protection pages are being built in other threads at the same time. They touch the same shared files (navigation, methodology catalogue, sitemap, mirror files, browser-test page counts). Whichever merges second merges `main` in and redoes those edits.

# Education hub

Date: 2026-10-16
Status: Design approved by Duru on 2026-10-16. Duru asked for Education in its own thread on 2026-10-16, chose four pages ("Which pages should the new Education hub have?" card, option "All four") and approved the page design ("Does this Education page design look right?" card, option "Looks right"). This document writes that design down. It covers the data foundation and the pages.

## 1. Intended result

Fiscal.ge readers should be able to see, school year by school year, how many children and young people are in education in Georgia, where they study and who teaches them. That covers kindergartens, schools, vocational colleges and universities.

The pages answer five questions:

- How many children go to school? 716,700 pupils in 2000/01, 644,200 in 2025/26. Private schools went from 12,100 to 72,000 pupils.
- Where are they? Pupils, teachers and schools in Georgia, each of the 11 regions and each of the 63 municipalities. For example, Tbilisi had 232,134 pupils in 2025/26.
- How many children are in public kindergartens? 162,879 in 2017/18, 130,337 in 2025/26, in 1,717 kindergartens.
- How many people study at university, and what? 95,110 students in 2011/12, 195,426 in 2025/26. 58,554 were newly admitted in 2025/26, and 32,494 graduated in 2025.
- How many go to vocational colleges? 21,045 were admitted in 2013 and 19,690 in 2025, and 10,537 graduated in 2025.

The pages keep the production editorial look. They reuse the Population place pages, the Business series list and the shared chart, table, range strip and Excel download. No new chart type, chart library or visual direction is added.

## 2. Pages and navigation

| Page | Georgian path | English path | Georgian name (proposal) |
| --- | --- | --- | --- |
| Hub | `/explorer/education` | `/en/explorer/education` | განათლება |
| Schools (map index) | `/explorer/education/schools` | `/en/explorer/education/schools` | სკოლები |
| Schools, Georgia | `/explorer/education/schools/georgia` | `/en/…` | სკოლები — საქართველო |
| Schools, region | `/explorer/education/schools/region/[id]` | `/en/…` | სკოლები — {region} |
| Schools, municipality | `/explorer/education/schools/[slug]` | `/en/…` | სკოლები — {municipality} |
| Kindergartens (map index) | `/explorer/education/kindergartens` | `/en/explorer/education/kindergartens` | საბავშვო ბაღები |
| Kindergartens, Georgia / region / municipality | as Schools, under `/kindergartens` | `/en/…` | საბავშვო ბაღები — {place} |
| Universities | `/explorer/education/universities` | `/en/explorer/education/universities` | უნივერსიტეტები |
| Vocational colleges | `/explorer/education/vocational` | `/en/explorer/education/vocational` | პროფესიული კოლეჯები |
| Methodology | `/methodology/education` | `/en/methodology/education` | განათლება |

- Place pages follow Population exactly: Georgia, the 11 regions (`region/[id]`, the site's region ids) and the 63 municipalities other than Tbilisi (`[slug]`, the Budget slugs). Tbilisi is one place, `region/tbilisi`. That is 75 place pages per page set and locale, and an unknown id or slug is a 404.
- The hub has four clickable cards in the order Schools, Kindergartens, Universities, Vocational colleges, reusing the shared hub cards. Each shows a sparkline of its default national series (pupils, children, students, admitted), the latest figure and coverage, all from served facts.
- The sidebar places **Education** after Living standards (after Health, if that hub merges first), and its four pages show beneath it when the section is active.
- Breadcrumbs, headings, language links, metadata, Dataset JSON-LD and the sitemap follow the existing pattern.
- The Georgian names are proposals for Duru's Georgian proofread. Geostat's own section names are «ზოგადი განათლება», «სკოლამდელი განათლება», «უმაღლესი განათლება» and «პროფესიული განათლება».

## 3. Shared page rules

These rules apply to every Education page:

- Under the heading there is one short line from `LatestValueLine`, as worded for each page below. Nothing else sits under the heading. The only text under the chart is one short source line.
- **No page has a tab row or an icon measure switch.** Different measures sit under small headings in the right-hand series list, every row visible from the start (no caret-hidden subcategories).
- **One heading at a time** on the place pages, as on the Business area pages: the chart shows the rows of one heading. Ticking a row under another heading replaces the selection with that row. The chart, table, years and Excel follow the selection's heading. On Universities and Vocational colleges every row counts people, so rows from different headings can be charted together.
- Only the default series named for each page is selected on arrival. It stays first, selectable and removable, and selection is unlimited.
- Series names carry no prefixes. Outside the list (chart legend, tooltip, table, Excel) a row under a heading is named in full, `Heading — Row`, for example `Graduates — Women`, as on Business.
- Every series has a fixed, distinguishable colour. The default total is ink.
- **School years.** Schools, Kindergartens and Universities count by school year. A school year is stored as its starting year (2025 for 2025/26) and labelled `2025/26` on the chart axis, tooltip, table, range strip, latest-value line, hub card and Excel, through the existing `formatPeriod` and `yearLabel` options. Vocational colleges count by calendar year, as Geostat does, and are labelled `2025`.
- A year without a value is a gap in the chart, a dash in the table and a blank Excel cell, never zero. Geostat's text `…` and `-` cells and blank cells are unavailable values. A zero that Geostat's vocational sheet formats as a dash inside a field's years is stored and shown as 0 (see methodology "Gaps").
- Chart | Table, the year range, the selection (including an empty one) and Excel work as on Business, kept in the URL hash through the shared hash state and kept across a language change.
- Counts are whole numbers. The one exception is Georgia's pupils, which Geostat publishes in thousands with one decimal (§4).
- The source line reads like the others, for example: "Source: Geostat, general education · 2005/06–2025/26 · Methodology and sources".

## 4. Schools

**Index** (`/explorer/education/schools`), following the Population index:

- Line under the heading: "2025/26: 644.2 thousand pupils in 2,292 schools". Georgia's figures on every Schools page (index row, Georgia page, hub card) come from Geostat's national tables, so Georgia's pupils read in thousands everywhere; the municipal table's own Georgia row (644,243) is used only as a cross-check.
- The shared `MunicipalitiesIndex` municipality map and list, shaded by pupils in the latest school year, with the occupied-territory overlays. Georgia is the list's first, unranked row. Every region and municipality on the map or in the list links to its own Schools page, and Tbilisi opens `region/tbilisi`.
- There is no chart workspace on the index. The one source line names the source, the map's school year and the geoBoundaries credit, as on Population.

**Place pages** follow the Population place pages: the `EntityHeading` with the place picker and previous/next links, one latest-value line with the place's name ("2025/26: 13,743 pupils · Guria"), the chart workspace, and on a region's page the list of its municipalities ranked by pupils.

The series list has three headings:

- **Pupils** (მოსწავლეები): Pupils (selected).
- **Teachers** (მასწავლებლები): Teachers, Women, Men.
- **Schools** (სკოლები): Schools.

Georgia's page adds the public and private split that Geostat publishes only nationally:

- Pupils: Pupils (selected), Public schools, Private schools. In thousand pupils to one decimal, 2000/01–2025/26, from Geostat's national table.
- Teachers: Teachers, Public schools, Private schools (2006/07–2025/26), Women, Men (2016/17–2025/26).
- Schools: Schools, Public, Private (2000/01–2025/26).

Regions and municipalities run 2005/06–2025/26 for pupils and schools, and 2016/17–2025/26 for teachers.

Geostat marks 2010/11 with "as at 5 April 2011". The methodology page says so, and the table shows the year with no special mark. Teachers who work in more than one school are counted once per school (Geostat's note), and the methodology page says so too.

## 5. Kindergartens

The same index and place pages as Schools, under `/kindergartens`:

- Index line: "2025/26: 130,337 children, 1,717 public kindergartens". The map is shaded by children.
- The series list has three headings: **Children** (ბავშვები, selected), **Staff** (აღმზრდელები) and **Kindergartens** (ბაღები), each with one row.
- Every place, Georgia included, runs 2017/18–2025/26.
- These are public kindergartens only, the only ones Geostat publishes. The source line says "public kindergartens".
- **Staff break.** From 2020/21 Geostat counts assistant caregivers and inclusive-education teachers as well as caregiver-pedagogues and caregivers. This is recorded as a series break (§9): the line is drawn through and the methodology page explains it. No change across it is computed.

## 6. Universities

Line under the heading: "2025/26: 195,426 university students".

One series list, in persons, under three headings. Each heading holds the same 16 rows in this order:

- **Students** (სტუდენტები), **Newly admitted** (ჩარიცხულები), **Graduates** (კურსდამთავრებულები).
- Rows: All (the Students total is selected); Bachelor; Master; Professional programmes; Public universities; Private universities; Women; Men; then the 8 fields of study in Geostat's order: Education; Humanities and arts; Social sciences, business and law; Science; Engineering, manufacturing and construction; Agriculture; Health and welfare; Services.

Years: students and admissions 2011/12–2025/26. Geostat publishes graduates by the calendar year they graduated (2011–2025). Each graduate year is shown under the school year it ends: 2025 graduates under 2024/25, so graduates run 2010/11–2024/25. The methodology page says so.

"Master" follows Geostat's level, which from 2015/16 also includes certified physicians, veterinarians and residency (ISCED 2011). This is recorded as a series break on the Bachelor and Master rows. Doctoral students are in a separate Geostat table and are not shown.

The list holds 48 rows, so it shows the shared search box, as on Business. Search never limits the select-all action or the counts.

## 7. Vocational colleges

Line under the heading: "2025: 19,690 admitted to vocational colleges".

One series list, in persons, under two headings, **Admitted** (ჩარიცხულები) and **Graduates** (კურსდამთავრებულები). Each heading holds:

- All (the Admitted total is selected), Women, Men, 2013–2025.
- The 9 fields of study in Geostat's current list: Agriculture, forestry, fisheries and veterinary; Art and humanities; Business, administration and law; Education; Engineering, manufacturing and construction; Health and social welfare; ICT; Services; Social sciences, journalism and information. Each starts in the year Geostat first publishes it: 2019 for most, 2016 for Education and 2020 for Social sciences, journalism and information.

Geostat changed its list of fields in 2019 and phased the old one out over 2019–2022 (the last old-field graduates are in 2022). Following Duru's Health ruling, the 9 old fields (Agricultural sciences, Business administration, Engineering, Natural sciences, Inter-directional specialties, Law, Social sciences, Art, Health) stay in the data file and are not shown on the page or in Excel. The zeros Geostat prints for a field in years before or after its list was in use are not served as zeros. The methodology page explains that some students were still counted under the old fields, so the current fields add up to less than the total for admissions up to 2020 and for graduates up to 2022 (before 2019, Education is the only current field).

Age groups are archived, not shown.

## 8. Hub page

The hub at `/explorer/education` reuses the hub cards:

- **Schools**: pupils sparkline, "2025/26: 644,200 pupils · 2000/01–2025/26".
- **Kindergartens**: children sparkline, "2025/26: 130,337 children · 2017/18–2025/26".
- **Universities**: students sparkline, "2025/26: 195,426 students · 2011/12–2025/26".
- **Vocational colleges**: admitted sparkline, "2025: 19,690 admitted · 2013–2025".

## 9. Data foundation

### Sources

The files come from Geostat's Education pages (categories 58, 59, 60 and 61), downloaded from the cloud workspace on 2026-10-16. Copies are in `/mnt/project-files/education-sources/`. The school and vocational tables credit the Ministry of Education, Science and Youth of Georgia; the kindergarten and higher-education workbooks name no source.

| Geostat file | Used for | Years |
| --- | --- | --- |
| `general/01_Number-of-General-Education-Schools-and-Pupils-in-them.xlsx` | Georgia schools and pupils, public and private (pupils in thousands) | 2000/01–2025/26 |
| `general/06_Number-of-General-Education-School-Teachers.xlsx`, sheet 1 | Georgia teachers, public and private | 2006/07–2025/26 |
| `general/11_Number-of-schools_Pupils_Teachers-by-Municipalities.xlsx`, sheets schools, pupils, teachers | Region and municipality schools, pupils, teachers (total, women, men); Georgia teachers by sex | 2005/06–2025/26 (teachers 2016/17–) |
| `preschool/Indicators-on-Public-Preschool-Education-and-Care-(PEC)-Institutions.xlsx` | Kindergartens, children, staff by place | 2017/18–2025/26 |
| `higher/01Number-of-Students-Admission-Graduates-by-Programmes-and-Sex.xlsx`, sheets Admission, Number, Graduates | Universities: totals, levels, public and private, sex, 8 fields | 2011/12–2025/26 (graduates 2011–2025) |
| `vocational/Number-of-students-in-Public-and-Private-Vocational-Education-Institutions'-Education-Programs.xlsx` | Vocational admitted and graduates: total, sex, fields | 2013–2025 |

The other downloaded tables (grades and ages, dropouts, ICT, social status, enrolment rates, exam proficiency, school-to-VET transfers, foreign and doctoral students, professors, institutions by region, the 2000s secondary professional school tables) are archived for provenance and not served.

Rough size: Schools about 4,700 values, Kindergartens about 2,000, Universities about 2,200, Vocational about 500. That's about 9,500 served values. The plan fixes the exact count.

### Places

- Geostat's unit labels ("Keda Municipality", "City of Batumi", "TeTri tskaro Municipality") are matched to the site's municipality codes and region ids through a reviewed mapping file, as demography does. A label no reviewed file knows stops preparation.
- Abkhazia AR, Akhalgori, Eredvi, Tighva and Kurta have rows in Geostat's tables and are part of the region and Georgia totals. They are kept in the data with their own ids but are not places on the map and have no page, as on Budget and Population (municipal codes 05, 42, 43, 46 and 64 stay excluded).
- A region's value is Geostat's region row, never a sum computed by fiscal.ge.

### Research package and canonical file

- `docs/Raw Data/Education/geostat-education-annual/` follows the Business package: originals under `official/` with a source manifest (URL, retrieval time, SHA-256, size), a `prepare.py` that transcribes every used cell with its sheet and cell reference, an independent verification script, a validation report and a coverage file. The originals are never edited.
- `npm run data:prepare-education` writes `data/imports/education-annual.csv` (UTF-8 with BOM) and `data/reports/education-validation.json`. `--check` reproduces both byte for byte and runs in `data:validate`.
- Each row keeps the exact workbook value (numbers stored as text, such as `2 294`, are parsed and recorded exactly), the period kind (`school_year` or `calendar_year`), the stored year and its label, the unit (`persons`, `persons_thousand` or `institutions`), `basis=actual`, value status `official`, a shown flag (false for the old vocational fields), source ID, sheet and cell.
- Series breaks go into `data/imports/education-series-breaks.csv` in demography's break format: `kindergarten_staff_2020` (wider staff definition from 2020/21) and `he_levels_2015` (certified physicians, veterinarians and residency counted as master from 2015/16), with graduates in their own `he_levels_2015_graduates` dated a year earlier because they are stored under the school year they end.
- Stable lowercase IDs follow `education.{measure}.{group}`. Measures: `schools`, `pupils`, `teachers`, `kindergartens`, `kg_children`, `kg_staff`, `he_students`, `he_admitted`, `he_graduates`, `vet_admitted`, `vet_graduates`. Groups: `total`, `public`, `private`, `women`, `men`, `level_bachelor`, `level_master`, `level_professional`, `field_<id>`. Place-level rows add the geography id (`country.georgia`, `region.<id>` or the municipality code).

### Checks

Validation rejects a changed value, a missing, extra or duplicate observation, a year outside a table's coverage and an unknown place label. It also checks, within each table's rounding:

- public plus private equals the total (Georgia schools, pupils, teachers; universities for each measure);
- women plus men equals the total (teachers by place, universities, vocational);
- university levels and fields each add up to the total;
- vocational fields (old and current together) add up to the total every year, and the current fields alone from 2023; their shortfall in 2019–2022 is recorded exactly;
- municipalities and the kept non-map units add up to their region, and regions plus Abkhazia AR to Georgia, for schools, pupils, teachers and kindergartens;
- the municipal table's Georgia pupils, divided by 1,000, round to the national table's value;
- the municipal table's Georgia teachers equal the national teacher table from 2016/17;
- anchor values match Geostat: 2025/26 schools 2,292 (206 private), pupils 644.2 thousand and 644,243, teachers 66,328, kindergartens 1,717, children 130,337, staff 19,176, university students 195,426, admitted 58,554; 2025 university graduates 32,494; vocational 2025 admitted 19,690 and graduates 10,537.

Fiscal.ge derives nothing: no shares, ratios such as pupils per teacher, growth rates or interpolation.

### Serving

- All pages stay prerendered. The CSV loader and numeric client projection follow Business.
- The private Supabase mirror gets an `EducationFact` table in one versioned migration, with RLS on and public grants revoked, compared field by field in the transactional `data:import`. CSV and database modes must serve identical values. The live migration and import happen only on Duru's merge, through the existing release pipeline.
- About 300 new static pages (two place-page sets of 75 in two languages). The plan measures the build-time change.

## 10. Sources, Excel and methodology

- The six Geostat workbooks are published through the source archive (`data/methodology/source-archives/education.csv`). The methodology bundle must not pull large data files (the PR #170 rule).
- Excel reuses the three-sheet writer (Summary, Data, Sources) in the reader's language, with the selected heading's or headings' series and years, school-year labels, explicit units, blank missing cells and validated source links, with no internal identifier or cell-reference columns.
- `/methodology/education` explains in plain words:
  - that the figures come from the Ministry of Education through Geostat;
  - school years, and why graduates sit under the school year they end;
  - the 2010/11 "as at 5 April 2011" count;
  - that teachers in several schools are counted once per school;
  - public kindergartens only, and the 2020/21 staff definition change;
  - the 2015/16 change in what counts as a master's student;
  - the 2019 change in vocational fields, and why the old fields are not shown;
  - Abkhazia AR and the occupied-territory units in the totals;
  - that the pages state no causes.

## 11. Out of scope

Pupils by grade or age, dropouts, ICT, social status, enrolment rates, exam results, school-to-VET transfers, doctoral students, professors, foreign students, institutions by region, vocational age groups and the old secondary professional school tables (2000s); private kindergartens; fields by level or sex combined; education spending (already on the Budget pages); pupils per teacher or any other ratio; forecasts; causes; MCP tools; and the central JSON/CSV publications. Each would need its own approval.

## 12. Verification

1. The canonical file reproduces every served value from the original cells. The independent verification passes, and CSV and database modes agree.
2. Defaults, headings, the one-heading rule, gaps, school-year labels, breaks and URL state behave as in sections 3–8, with the anchor values above.
3. Chart, table and Excel agree for the same settings, and the source links work.
4. Georgian and English work at 390, 768 and 1440 pixels, and keyboard use and language switching keep the settings.
5. Duru sees screenshots and, if wanted, a clickable preview first (branch pushed, no PR). After Duru's OK, run `npm run check`, `npm run build` and `npm run test:browser` once, then open the PR.

During implementation, also update `Project_Definition.md` section 2 (a new approved Education item), `DESIGN.md` (a new Education surfaces section) and add `docs/data-methodology/education-annual.md`.

## 13. Reuse

- **Used as is:** `MunicipalitiesIndex`, `MunicipalityMap` (with its `wording` and `hrefForCode` options), `buildMunicipalityValueMapModel`, `EntityHeading`, `EntityWorkspaceShell`, `EntityMemberList`, the place picker helpers (`buildPickerCountry`, `pickerGroupsFromRows`), `ExplorerWorkspace`, `LatestValueLine`, `EditorialLineChart` (`formatPeriod`), `ExplorerTable` (`yearLabel`), `RangeStrip` (`formatPeriod`), `SeriesAside`, `FlatSeriesPanel` with its per-row `heading`, the Business one-unit selection rule, the hub cards, `SourceNote`, the hash state, the three-sheet Excel writer and `ExcelDownloadButton`, the source-archive and methodology components, the parity checks and the series-break record format.
- **Small additions:** the sidebar (`navTree.ts`), footer source note, sitemap, methodology catalogue and source inventory get the new section. The import script and mirror read and compare the new table. Browser-test page counts change. If the Population place routes (`demographyPlaceRoutes.ts`) or its place-page loader can take a base path as an option, Education uses that option instead of a copy, with the default leaving Population unchanged.
- **New:** the research package and `prepare-education` script, the Prisma model and migration, `lib/data/education/*`, `lib/explorer/education*.ts` (models, hub cards, workbook), the Education place explorer and the two chart-page components, `lib/pages/education*.tsx`, the routes and messages, the methodology content and `docs/data-methodology/education-annual.md`. Before writing any of them, the plan names the existing file it mirrors and checks whether an option on that file would do instead (AGENTS.md "Reuse first").

## 14. Coordination

Housing, Crime and Social protection hubs are being built in parallel threads, and Health is waiting to merge. The branch `claude/education-hub-ulwq3l` starts from `main` at the Business merge (PR #189). Whichever hub merges later merges `main` and redoes the shared edits (sidebar, sitemap, methodology catalogue, DB setup, browser-test page counts, `DESIGN.md` and `Project_Definition.md` section numbers).

## 15. Decision for Duru

Approve this written spec. The implementation plan comes next. Approving the spec does not authorize pushing, a pull request, deployment or live database changes. Screenshots or a live preview come first.

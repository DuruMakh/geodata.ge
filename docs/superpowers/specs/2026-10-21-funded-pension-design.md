# Health and social protection hub: Funded pension page

Date: 2026-10-21
Status: Draft for Duru's review.

How it was approved so far:

- On 2026-10-21 at 16:12 Tbilisi time, Duru picked the funded pension as one of four new data topics. The research report is `/mnt/project-files/next-data/2026-10-21-beyond-geostat-nbg.md`, item 4.
- On 2026-10-21 at 16:19 Tbilisi time, Duru chose the Health and social protection hub on the decision card. The card said that this choice also approves the rest of the proposal in `/mnt/project-files/funded-pension/design-proposal.md`, which this spec turns into a design.

This approval changes the scope. `Project_Definition.md` §2T and `docs/data-methodology/social-protection-annual.md` list "funded pensions" as excluded. This design records the owner's approval to show them on one page.

## 1. Intended result

Georgia's funded pension scheme (დაგროვებითი პენსია) started on 1 January 2019. Employees join automatically, and those who were 40 or older when the law took effect (6 August 2018) could leave in their first months. The employee pays 2% of their pay and the employer pays 2%. The state budget adds 2% for pay up to 24,000 GEL a year and 1% on pay between 24,000 and 60,000 GEL. The money goes into a personal account that the Pension Fund (საქართველოს საპენსიო ფონდი, called the Pension Agency until 1 May 2025) invests.

Readers should be able to see, year by year from 2019 to 2025:

- **How big the savings are.** Members' accounts held 8,237.5 million GEL at the end of 2025, against 508.0 million at the end of 2019. The fund's total net assets, which also count money not yet assigned to a person, were 8,365.4 million.
- **How much goes in, and how much of it is public money.** In 2025, contributions were 1,431.8 million GEL. Of that, 843.2 million came from private-sector employers and staff, 217.6 million from public-sector employers and staff, and 371.0 million from the state budget.
- **How the money earned.** Interest, gains on securities and dividends in GEL, and the fund's yearly return in % (11.8% in 2025).
- **How many people take part.** 1,705,365 people had joined by the end of 2025, and 145,780 employers had registered. The page also shows how many left the scheme and how many received a pension or their savings each year.

The page keeps the production editorial look. It is the Social package page's layout with a different series list. No new chart type, chart library or visual direction is added.

## 2. Page and navigation

| Page | Georgian path | English path | Georgian name (proposal) |
| --- | --- | --- | --- |
| Funded pension | `/explorer/health/funded-pension` | `/en/explorer/health/funded-pension` | დაგროვებითი პენსია |

- **Hub.** The hub gets an eighth card after Social package. It reuses the shared hub card, with a sparkline of the savings in members' accounts, the latest figure and the coverage, all taken from served facts. Its footer reads like the others, for example "2025 · 8,237.5 mln GEL · 2019–2025".
- **Sidebar.** The page is listed under **Health and social protection**, after Social package.
- **Page furniture.** Breadcrumbs, heading, language links, metadata, Dataset JSON-LD and the sitemap follow Social package.
- **Methodology.** There is no new methodology page. `/methodology/social-protection` gets a funded pension section (§8).
- **Names.** The Georgian names are proposals for Duru's Georgian proofread. The Fund's own terms are «დაგროვებითი საპენსიო სქემა», «საპენსიო შენატანი» and «საპენსიო აქტივები».

## 3. Page layout

The page follows the shared page rules of the social protection spec (`2026-10-20-social-protection-design.md` §3):

- **Under the heading** there is one short line: "2025: 8.24 billion GEL in pension savings". It must fit on one line on a phone. Nothing else sits under the heading. The only text under the chart is one short source line: "Source: Pension Fund of Georgia · 2019–2025 · Methodology and sources".
- **No tabs.** All rows are visible from the start under small headings in the right-hand list.
- **One heading at a time.** Ticking a row under another heading replaces the selection with that row. The chart, table, years and Excel follow the selection's heading.
- **Default selection.** "In members' accounts" is selected on arrival. It stays first, selectable and removable.
- **Series names** have no prefixes. Outside the list, a row is named in full, for example "Money in and out — State budget contribution".
- **Colours** are fixed and distinguishable. The first row of each heading is ink.
- **Missing values** are gaps, dashes and blank Excel cells, never zero.
- **Chart | Table, the year range, the selection and Excel** work as on Social package and live in the URL hash.
- **The % of GDP switch.** The two money headings get the Social payments icon switch (₾ or Lucide `ChartPie` for % of GDP). The switch appears only while the chart shows a money heading. Members, Employers and Return keep their own units.

### Series list

| Heading | Row | Unit | Years | Measure |
| --- | --- | --- | --- | --- |
| **Savings** (end of year) | **In members' accounts** (selected) | million GEL | 2019–2025 | Liabilities to scheme members, 31 December |
| | Total fund assets | million GEL | 2019–2025 | Net assets available for benefits, 31 December |
| **Money in and out** (during the year) | All contributions | million GEL | 2019–2025 | Total members' contributions |
| | Private-sector employers and staff | million GEL | 2019–2025 | |
| | Public-sector employers and staff | million GEL | 2019–2025 | |
| | State budget contribution | million GEL | 2019–2025 | |
| | Interest earned | million GEL | 2019–2025 | Interest income |
| | Gains or losses on securities | million GEL | 2022–2025 | Net gain or loss on trading securities; a loss is negative |
| | Dividends | million GEL | 2022–2025 | Dividend income |
| | Pensions and savings paid out | million GEL | 2019–2025 | Pensions and assets paid, including to members who left |
| **Members** | Joined since 2019 (end of year) | persons | 2019–2025 | Registered members, cumulative |
| | Left the scheme | persons | 2019–2025 | Left under Article 22 of the law, during the year |
| | Received a pension or their savings | persons | 2019–2025 | Pensions and payouts granted, during the year |
| **Employers** | Registered since 2019 (end of year) | employers | 2019–2025 | Registered employers, cumulative |
| **Return** | Annual return | % | 2019–2025 | The fund's nominal yearly return |

Notes on the rows:

- "All contributions" is the statement's printed total. The three rows below it add up to it exactly, and the checks confirm this every year.
- The Fund's annual reports split contributions into private and public sector only, with the state's 2% inside each. The page uses the audited statements, which show the state's 2% separately. The methodology page explains the difference.
- "Gains or losses on securities" and "Dividends" start in 2022, the first year the statements print them. Before 2022 the fund held deposits only.
- The table and Excel mark the members, employers and return rows as figures from the Fund's 2025 annual report, and the money rows as figures from the audited statements.
- The two savings rows are stocks at 31 December. "Money in and out" adds up flows during the year. The page never adds rows across headings.

## 4. Data foundation

### Sources

The Pension Fund publishes everything on pensions.ge. Its document list is the JSON at `https://site-api.pensions.ge/api/v1/embedded-doc/get-all`, and each document's file is served from `https://site-api.pensions.ge/`.

| Source | Used for | Years served |
| --- | --- | --- |
| Audited IFRS financial statements of the pension scheme, 2020 and 2022–2025 (`2020-IFRS.pdf`, `2022-IFRS-GE.pdf`, `2023-IFRS-GE.pdf`, `2024-IFRS-GE.pdf`, `2025-IFRS.pdf`) | Savings, total fund assets, contributions and their three parts, interest, gains on securities, dividends, payouts | 2019–2025 |
| Pension Fund annual report 2025 (`Annual_Rep_2025_geo.pdf`) | Members, people who left, people paid, employers, annual return | 2019–2025 |
| IFRS statements 2019 and 2021 and annual reports 2019–2024 | Cross-checks only, not served | — |
| Geostat nominal GDP (already served) | % of GDP | 2019–2025 |

**Which statement serves a year.** Every statement prints the year and the year before. A year is served from the latest statement that prints it as text:

- 2019 from the 2020 statement;
- 2020 from the 2020 statement, because the 2021 statement is a scanned image;
- 2021 from the 2022 statement;
- 2022 from the 2023 statement;
- 2023 from the 2024 statement;
- 2024 and 2025 from the 2025 statement.

Each year's own statement is compared with the served value. If any value was restated, the difference is recorded and the later value is served.

**Why the 2025 annual report for counts.** Each annual report repeats the history, and the Fund revises older counts slightly. For example, the 2020 report gave 1,106,683 members for 2020, and the 2025 report gives 1,105,041. The page serves the 2025 report's figures. The earlier reports' figures are compared and their differences recorded in the research package.

**The annual return.** The 2025 report prints the yearly returns only as labels on a chart, next to inflation. The labels are assigned to years by their position on the page. The return is the left bar of each pair, and the year labels sit under the pairs. Read this way, the returns for 2019–2025 are 6.1, 12.9, 9.5, 7.3, 12.3, 11.5 and 11.8%. The report's text confirms 11.8% for 2025. The 2024 report's text gave 11.6% for 2024 against 11.5% in this chart. That difference is recorded, and the methodology page mentions it.

### Research package

The originals and their extraction sit in a new research package beside SSA's, at `docs/Raw Data/Social/pension-fund/`:

- `official/` holds the PDFs used for serving and for cross-checks. The scanned 2021 statement is not kept.
- `source-manifest.json` lists each file's URL on pensions.ge, size, SHA-256 and retrieval date (2026-10-21).
- `extract.py` reads the PDFs with poppler's `pdftotext` (layout text, plus word positions for the return chart). It writes `pension-fund-annual.csv` with one row per value, its document, page and printed line, and `validation-report.json`. It runs once, offline. CI never runs it, because CI checks the committed outputs against the manifest.
- `README.md` explains the files, the serving rules above and the recorded differences.

**Checks in the package, which must all pass:**

- the three contribution parts add up to the printed total;
- each statement's increases less decreases equal its printed net change;
- each year's opening net assets plus the net change equal its closing net assets, and the closing figure equals the next year's opening figure;
- the members' accounts balance rolls forward the same way in the statement notes;
- the served value equals the value in the year's own statement, except recorded restatements;
- the counts in the 2025 report equal those in earlier reports, except recorded revisions;
- the 2025 return equals the report text, 11.8%.

### Canonical file and mirror

The page reuses the social protection data path. It adds no new table and no new database migration.

- **Prepare.** `npm run data:prepare-social` also reads the package's `pension-fund-annual.csv` and verifies every PDF it cites against the manifest. It then adds the values to `data/imports/social-protection-annual.csv`, in the same columns. `--check` reproduces the file byte for byte, as now.
- **Rows.**
  - Geography is `country.georgia`.
  - Money is stored in GEL: the statements print thousands of GEL, and the value is the printed figure × 1,000.
  - Counts are stored whole. The return is stored as printed, to one decimal.
  - Stocks and cumulative counts have `months = 1` (a 31 December position, like SSA's December count). Flows and the return have `months = 12`.
  - Every value has `valueStatus = official`, because each is one printed figure.
  - `sourceWorkbook` is the PDF's file name, `sourceSheet` the page number, and `sourceCell` the printed line label with its column year.
- **New units.** `SocialFact.unit` gains `employers` and `percent`. The column is free text in the mirror, so no migration is needed.
- **Stable IDs** follow `social.funded_pension.{measure}`:
  - `savings_amount`, `net_assets_amount`;
  - `contributions_amount`, `contributions_private_amount`, `contributions_public_amount`, `contributions_state_amount`;
  - `interest_amount`, `securities_gains_amount`, `dividends_amount`, `payouts_amount`;
  - `members`, `left`, `paid_persons`, `employers`, `return`.
- **Source IDs.** The new source IDs are `pension_fund_ifrs_{year}` and `pension_fund_report_2025`.
- **Rejected by validation:**
  - a changed value;
  - a missing, extra or duplicate observation;
  - a year outside 2019–2025;
  - a zero where the statement prints no line.
- **Checked by validation:**
  - the three contribution parts add up to All contributions every year;
  - the anchor values below.

| Measure | Value |
| --- | --- |
| In members' accounts, end of 2025 | 8,237,530,000 GEL |
| In members' accounts, end of 2019 | 508,031,000 GEL |
| Total fund assets, end of 2025 | 8,365,433,000 GEL |
| All contributions, 2025 | 1,431,780,000 GEL |
| State budget contribution, 2025 | 370,989,000 GEL |
| Gains or losses on securities, 2022 | −31,187,000 GEL |
| Members joined since 2019, end of 2025 | 1,705,365 |
| Members joined since 2019, end of 2019 | 958,226 |
| Employers registered, end of 2025 | 145,780 |
| Annual return, 2025 | 11.8% |

**Size.** There are 99 served values: 13 rows × 7 years, and 2 rows × 4 years. The import, the parity checks and the CSV and database modes treat them like every other `SocialFact` row.

## 5. Calculations

There is only one calculation. The % of GDP view divides each year's money by Geostat's nominal GDP for the same year, already served. This reuses Social payments' `shareOfGdp` path. A stock at 31 December is divided by that year's GDP, which is the usual way to report fund size. The methodology page says so. Values in this view are marked calculated in the table, tooltip and Excel.

## 6. Counting changes

None are drawn. The methodology page notes these without drawing them:

- 2019 was the joining year. Most people who left, 164,198, left in 2019, when people aged 40 or over could leave.
- In 2022 the fund started buying securities and shares, so the gains and dividends rows start then.
- The Pension Agency became the Pension Fund on 1 May 2025. The scheme and its statements continue.

## 7. Sources and Excel

- **Source archive.** `data/methodology/source-archives/social-protection.csv` gets one row per served PDF, pointing at its pensions.ge URL, following the existing row format. Whether the PDFs are also published as downloads follows the archive's size rules. The plan checks those rules and either publishes them or cites the URLs only. The methodology bundle must not pull the PDFs (the PR #170 rule).
- **Excel.** The page reuses the social workbook writer (Summary, Data, Sources) in the reader's language, with the active heading's selected rows and years. The Sources sheet lists the PDFs behind them, and in the % of GDP view, also Geostat's GDP files. It has no internal identifier or page-and-line columns.

## 8. Methodology and documents

`/methodology/social-protection` gets a section "Funded pension" in Georgian and English. It explains in plain words:

- what the scheme is, who joins, and who pays the three 2% shares;
- that the figures come from the Pension Fund's audited statements and its 2025 annual report, and which year comes from which document;
- the difference between savings in members' accounts and total fund assets;
- why the annual reports' private and public split differs from the statements' three parts;
- how the return was read from the chart, and the 2024 difference (11.5% against 11.6%);
- the % of GDP calculation;
- the points in §6;
- that the page states no causes, forecasts or advice.

These documents are updated in the same change:

- `Project_Definition.md`: a new short section for this page, with the next free letter after §2T (sibling threads may take 2U first), and "funded pensions" removed from §2T's exclusions;
- `DESIGN.md` §36: the eighth hub card, the sidebar entry and the page;
- `docs/data-methodology/social-protection-annual.md`: the funded pension sources, rules and checks, with the exclusion line updated;
- `docs/data-methodology/database-import.md`: a note that the `SocialFact` rows now include the funded pension. There is no new table.

## 9. Out of scope

Each of these would need its own approval:

- the three investment portfolios (conservative, balanced, dynamic), which exist only from August 2023;
- how the money is invested (deposits, bonds, shares), which is printed only as chart percentages;
- members by sector, because the older reports' sector counts do not add up to the total;
- payouts by reason (age, disability, leaving the country, heirs), and the Fund's own running costs;
- non-state (voluntary) pension schemes;
- monthly or half-year figures, anything before 2019, and 2026 until its statements are published;
- adding the state budget contribution to Social payments, which stays SSA-only;
- MCP tools and the JSON/CSV publications.

## 10. Verification

1. The package checks pass. `data:prepare-social --check` reproduces the canonical file, and the CSV and database modes agree.
2. The anchor values appear on the page, and the default, headings, one-heading selection, gaps, % of GDP switch and URL state behave as in §3.
3. The chart, table and Excel agree for the same settings, and the source links work.
4. Georgian and English work at 390, 768 and 1440 pixels. Keyboard use and language switching keep the settings, and the line under the heading fits on one line on a phone.
5. Duru first sees screenshots and a clickable preview: the branch is pushed with no PR. After Duru's OK, run `npm run check`, `npm run build` and `npm run test:browser` once, then open the PR. The merge waits until any other thread's release is live.

## 11. Reuse

- **Used as is:**
  - `SocialExplorer`, `FlatSeriesPanel` with headings, `EditorialLineChart`, `ExplorerTable` and `RangeStrip`;
  - `unitList.ts` and the shared hash state;
  - `shareOfGdp` and the national GDP facts;
  - the social workbook writer, the hub card and the source-archive and methodology components;
  - `readVerifiedPackageFile`, the `SocialFact` mirror and its import and parity checks.
- **Small additions:**
  - `SOCIAL_SECTIONS` and `SocialTopicId` gain `funded-pension`, and `socialTopicSeries` gets its rows;
  - `socialViews` gets `["amount", "gdp"]` for this page, with the switch shown only on money headings;
  - `socialUnitOf` and `socialDisplay` learn the `employers` and `percent` units and the `funded_pension` headings;
  - `SOCIAL_INDICATORS`, `SOCIAL_SOURCES` and `SocialFact.unit` get the new ids;
  - `prepareSocialData` reads the second package, and `validateSocialFacts` checks the funded pension rules;
  - the hub cards, sidebar, sitemap, messages, the methodology content and the source archive get the new page;
  - the browser-test page counts change.
- **New:**
  - the research package `docs/Raw Data/Social/pension-fund/` with its extraction script;
  - the two route files, Georgian and English, which call `renderSocialTopicPage`.

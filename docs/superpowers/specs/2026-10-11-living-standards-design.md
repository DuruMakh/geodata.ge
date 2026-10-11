# Living standards hub: household income and spending, with Poverty and Inequality

Date: 2026-10-11
Status: Design agreed in chat by Duru on 2026-10-11 ("Okay continue", "Household income and spending" thread). This spec is waiting for Duru's review.

Duru asked for household income and spending pages, and for the existing Poverty and Inequality pages to join them in one hub as separate cards rather than keeping a separate Poverty hub.

## 1. Intended result

Readers should be able to see how much an average household in Georgia earns and spends each month, where the money comes from, what it goes on, and how towns, villages and regions compare, every year Geostat publishes.

The new pages answer these questions:

- How much does an average household earn a month, and how has that changed? (224 ₾ in 2002, 955 ₾ in 2017, 2,025.8 ₾ in 2025.)
- Where does the income come from? (In 2025: wages 951.4 ₾, pensions and social help 423.6 ₾, self-employment 257.5 ₾.)
- What does a household spend on day-to-day living, and on what? (In 2025: 1,438.7 ₾, of which food, drinks and tobacco 519.6 ₾.)
- How do towns, villages and the regions compare?

Fiscal.ge does no calculation of its own. Every value shown is a figure Geostat published, exactly as the Poverty pages work today.

## 2. Pages and navigation

| Page | Georgian path | English path | Georgian name | English name |
| --- | --- | --- | --- | --- |
| Hub | `/explorer/living-standards` | `/en/explorer/living-standards` | ცხოვრების დონე | Living standards |
| Income (new) | `/explorer/living-standards/income` | `/en/…/income` | შემოსავლები | Income |
| Spending (new) | `/explorer/living-standards/spending` | `/en/…/spending` | ხარჯები | Spending |
| Poverty (moved) | `/explorer/living-standards/poverty` | `/en/…/poverty` | სიღარიბე | Poverty |
| Inequality (moved) | `/explorer/living-standards/inequality` | `/en/…/inequality` | უთანასწორობა | Inequality |
| Methodology (new) | `/methodology/household-income` | `/en/methodology/household-income` | შინამეურნეობების შემოსავლები და ხარჯები | Household income and spending |

- "ცხოვრების დონე" is Geostat's own name for this section of its site.
- The hub has four cards in this order: Income, Spending, Poverty, Inequality. The hub heading has one short line under it and nothing else. Each card has a small national chart built from served values, using the existing hub cards. The Income card shows total income per household, and the Spending card shows consumption spending per household. The Poverty and Inequality cards keep their current sparklines.
- In the sidebar, **Living standards** replaces **Poverty and inequality** in the same place, after Wages. Its four pages show beneath it when the section is active.
- The Poverty and Inequality pages keep their content, tabs, behaviour and Excel downloads unchanged. Only their address and breadcrumb change. Permanent redirects send the old addresses to the new ones: `/explorer/poverty` → `/explorer/living-standards`, `/explorer/poverty/rates` → `/explorer/living-standards/poverty` and `/explorer/poverty/inequality` → `/explorer/living-standards/inequality`, each with its `/en` twin. Redirects use the existing `next.config.ts` redirect list, and the part of a link after `#` (the chosen tab and series) carries over.
- `/methodology/poverty` keeps its address.
- The sitemap lists the new addresses and drops the old ones.

## 3. Income page

Under the heading there is one short line from `LatestValueLine`: "Average monthly household income · 2025: 2,025.8 ₾". It always shows Georgia per household, whatever is selected below. Nothing else sits under the heading.

Two centred text tabs follow, styled like the Poverty tabs:

**Where it comes from | Compare areas**

### Where it comes from

| Series in the list (selected first in bold) | Nested under it |
| --- | --- |
| **Total income** | Wages and salaries; Self-employment; Selling farm produce; Property income (rent, interest); Pensions, scholarships and social help; Money from abroad; Money received as gifts; Home-grown and in-kind income |
| Borrowing and selling property | Borrowing and using savings; Selling property |

- The nested rows of Total income are Geostat's parts of total income. Together they add up to it: the seven cash sources plus non-cash income.
- An **area** dropdown in the chart panel works like the Wages Industries group dropdown. Its options are Georgia, Towns, Villages and the 11 regions in Geostat's order. Georgia is the default.

### Compare areas

- The series list is **Georgia** (selected first), then Towns, Villages, and the 11 regions: Tbilisi, Adjara, Guria, Imereti, Kakheti, Mtskheta-Mtianeti, Racha-Lechkhumi and Kvemo Svaneti, Samegrelo-Zemo Svaneti, Samtskhe-Javakheti, Kvemo Kartli and Shida Kartli. Final order and names follow the existing region labels used by the Wages pages.
- Every series shows total income.

### Both tabs

- **Per household | Per person**: a switch next to Chart | Table. Per household is the default. Both are Geostat's published figures (`104–109` workbooks). Nothing is divided by us.
- Values are lari a month, shown to one decimal as Geostat prints them.
- Years: Georgia runs 2002–2025, towns and villages 2006–2025, and regions 2011–2025. Guria, Mtskheta-Mtianeti, Racha-Lechkhumi and Kvemo Svaneti, and Samtskhe-Javakheti start in 2019, because Geostat's sample was too small before then and their earlier cells are "…". Missing years are gaps in the chart, dashes in the table and blank Excel cells, never zero.
- The initial state is the first tab, Georgia, per household, chart mode and all years, with only Total income selected. The first series stays first, selectable and removable.
- Switching tab, area or per household / per person keeps the chart or table mode and the years, clamped to what the new choice covers. Switching tab selects that list's first series alone. Switching area or per household / per person keeps the ticked lines, because the list stays the same.
- Chart | Table, the year range, nested rows, search, the series count and Select all, Excel, and URL state all work as on the Poverty page. The URL stores tab, area, per household / per person, mode, selection and years, and they survive a language change.
- The source line reads: "Source: Geostat, Household Incomes and Expenditures Survey · ₾ a month per household · 2002–2025 · Methodology and sources".

## 4. Spending page

The line under the heading reads "Average monthly household consumption spending · 2025: 1,438.7 ₾".

It has the same two tabs (**What it's spent on | Compare areas**), the same area dropdown, per household / per person switch, years, defaults and behaviour as the Income page.

| Series in the list (selected first in bold) | Nested under it |
| --- | --- |
| **Consumption spending** | Food, drinks and tobacco; Clothes and shoes; Household goods; Health; Housing, water, electricity, gas and fuel; Transport; Education; Other consumption; Home-grown and in-kind consumption |
| Savings, lending and other payments | Saving and lending; Agriculture; Transfers to others; Buying property |

- The nested rows of Consumption spending add up to it: the eight cash categories plus non-cash consumption.
- Compare areas shows consumption spending for each area.

Final labels in both languages follow Geostat's Georgian and English workbook rows and the bilingual catalogue conventions. The English names above are plain-language proposals.

## 5. What is left out

- The whole-country totals in million GEL (workbooks `101–103`, `201–203`). Per household and per person are easier to read.
- Geostat's subtotal and grand-total lines that are simple sums of rows already shown: "Cash income and transfers", "Cash inflows, total" and "Cash and non-cash inflows, total" for income, and "Cash consumption expenditure", "Cash expenditure, total" and "Expenditure, total" for spending. Their source rows are still extracted and checked (section 6).
- The "Other regions" column, which before 2019 lumps Guria, Samtskhe-Javakheti and Mtskheta-Mtianeti together and is "x" from 2019.
- Shares or percentages (for example food as a share of spending), inflation adjustment, splits by rich or poor households, by household size or by age, maps, quarterly data, MCP tools and the central publications. Each would be a separate decision.

## 6. Data foundation

### Sources

The sources are 12 Geostat workbooks, retrieved on 2026-10-11 from "Households Incomes" (`https://www.geostat.ge/en/modules/categories/50`) and "Households Expenditures" (`…/categories/51`):

| Workbooks | Contents |
| --- | --- |
| `104`, `107` / `204`, `207` | Income / spending lines per household and per person, Georgia, 2002–2025 |
| `105`, `108` / `205`, `208` | The same for towns and villages, 2006–2025 |
| `106`, `109` / `206`, `209` | The same for the 11 regions plus "Other regions" and Georgia, 2011–2025 |

The research package also keeps the two source-page captures, the Georgian-language versions of the workbooks (for labels), and the household survey metadata (`0701_250526_EN.PDF`, already in the Poverty package). The other six workbooks (`101–103`, `201–203`) are archived as sources but not served.

### Served values

| | Income | Spending |
| --- | --- | --- |
| Lines served | 12 (total, 8 parts, borrowing and selling property with its 2 parts) | 15 (consumption, 9 parts, savings and other payments with its 4 parts) |
| Area-years | Georgia 24, towns and villages 40, regions 133 | same |
| Per household + per person | 2 × 12 × 197 = 4,728 | 2 × 15 × 197 = 5,910 |

That gives about 10,600 served values in total. The exact count is fixed by the extraction.

### Research package

`docs/Raw Data/Households/geostat-household-income-spending-annual/` follows the Poverty package. It holds the original files under `official/`, a source manifest (URL, retrieval date, SHA-256, size), a `prepare.py` that transcribes every cell with its sheet and cell reference and reuses the existing worksheet reader, an independent SheetJS verification, a validation report and a coverage file. The originals are never edited.

### Canonical file and checks

- `npm run data:prepare-household-income -- --write` writes `data/imports/household-income-spending-annual.csv` (UTF-8 with BOM) and `data/reports/household-income-spending-validation.json`. `npm run data:check-household-income` reproduces both byte for byte and runs in `data:validate`.
- Each row keeps the exact workbook value, the value as Geostat displays it (one decimal), `unit=gel_month`, `measure=per_household | per_capita`, `basis=actual`, `value_status=survey_estimate`, the source ID, sheet and cell.
- Stable lowercase IDs:
  - indicators `income.total`, `income.wages`, `income.self_employment`, `income.agriculture_sales`, `income.property`, `income.pensions_assistance`, `income.remittances`, `income.gifts`, `income.non_cash`, `income.other_inflows`, `income.borrowing_dissaving`, `income.property_disposal`;
  - `spending.consumption`, `spending.food`, `spending.clothing`, `spending.household_goods`, `spending.health`, `spending.housing_utilities`, `spending.transport`, `spending.education`, `spending.other_consumption`, `spending.non_cash`, `spending.non_consumption`, `spending.agriculture`, `spending.transfers`, `spending.saving_lending`, `spending.property`;
  - areas `georgia`, `settlement.urban`, `settlement.rural`, `region.<slug>` reusing the Wages region slugs.
- Validation rejects:
  1. a changed value, a missing, extra or duplicate observation, a year outside each workbook's coverage, a lost footnote, or a value where Geostat printed "…" or "x";
  2. parts that do not add up to their printed total within rounding, for every area, year and measure. This covers total income, cash income and transfers, other cash inflows, consumption spending, cash consumption and non-consumption spending, and the unserved sum lines;
  3. a Georgia value outside its towns and villages values;
  4. the Georgia column of the regional workbooks differing from the national workbook for the same line and year;
  5. a negative value;
  6. the 2025 Georgia per-household total income not rounding to 2,025.8 or consumption spending not rounding to 1,438.7.
- The two footnotes are kept as provenance: Imereti 2011–2018 includes Racha-Lechkhumi and Kvemo Svaneti, and "…" means the sample was too small before 2019.
- No estimates, interpolation, inflation adjustment, shares or other derived figures.

### Serving

- All pages stay prerendered. The CSV loader and numeric client projection follow Poverty.
- The private Supabase mirror gets a `HouseholdIncomeSpendingFact` table in one versioned migration, with RLS on and public grants revoked, compared field by field in the transactional `data:import`, like `PovertyFact`. CSV and database modes must serve identical values. The live migration and import happen only on Duru's merge, through the existing release pipeline.

## 7. Data rules readers see

These are mostly stated on the methodology page:

1. **Survey estimates.** About 13,000 households are interviewed each year. Small differences between regions, and short-term changes, may not be meaningful.
2. **Monthly averages per year.** Each value is the average month of that year, in current lari, not adjusted for inflation. This is stated in the methodology, not under the heading.
3. **One comparable series.** The survey changed in 2017, as on the Poverty pages. Geostat says the data are comparable, so no break is drawn.
4. **Imereti before 2019** includes Racha-Lechkhumi and Kvemo Svaneti, so its line steps down in 2019 for that reason. The methodology says so; the chart draws no marker.
5. **Income includes home-grown food and gifts in kind**, valued by Geostat at average prices. Borrowing and selling property are money coming in but not income, which is why they sit in their own line.
6. **No causes stated.**

## 8. Sources, Excel and methodology

- The 12 served workbooks, the six unserved ones, the two page captures and the metadata are published through the existing source archive (`data/methodology/source-archives/household-income.csv`). The methodology bundle must not pull in large data files (the PR #170 rule).
- Excel reuses the three-sheet writer (Summary, Data, Sources) in the reader's language. It covers the active tab's selected series and years, and names the area and per household / per person. It includes explicit units (₾ a month), survey-estimate status, blank missing cells and validated source links, with no internal ID or cell-reference columns.
- `/methodology/household-income` explains in plain words what the survey covers, the meaning of each income source and spending category (from Geostat's metadata), per household versus per person, and rules 1–6 above.

## 9. Verification

1. The canonical file reproduces every served value from the original cells. The independent verification passes, all rules in section 6 hold, and CSV and database modes agree.
2. Defaults, tabs, the area dropdown, the per household / per person switch, nesting, missing regional years and URL state behave as in sections 3–4. The 2025 values read 2,025.8 ₾ (income) and 1,438.7 ₾ (spending).
3. Chart, table and Excel agree for the same settings, and source links work.
4. The hub shows four cards. The old Poverty addresses redirect to the new ones and keep the settings after `#`. The sidebar, breadcrumbs and sitemap use the new names.
5. Georgian and English work at 390, 768 and 1440 pixels, with keyboard use and language switching keeping the settings.
6. A live preview goes to Duru first. After Duru approves, run `npm run check`, `npm run build` and `npm run test:browser` once, then push and open the PR.

During implementation, also update `Project_Definition.md` section 2 (section 2H becomes the Living standards hub), `DESIGN.md` (§32 and the route and sidebar lists), `docs/data-methodology/poverty-annual.md` (new page addresses) and a new `docs/data-methodology/household-income-spending-annual.md`.

## 10. Reuse

- **Used as is:**
  - the Poverty explorer's building blocks: `ExplorerWorkspace`, `ExplorerHeading`, `LatestValueLine`, `EditorialLineChart`, `ExplorerTable`, `RangeStrip`, `SeriesAside`, `SeriesSelector` / `SeriesSelectorRow` with nested rows, `SegmentedTabs`, `TextTab`, `SourceNote`
  - `BudgetHub` cards, the three-sheet Excel writer and the source archive
  - the methodology components and the served-rows parity check
- **Small additions:**
  - `POVERTY_SECTIONS` hrefs point at the new addresses
  - the Poverty breadcrumb names the new hub
  - the sidebar entry is renamed and gets four sections
  - `next.config.ts` redirects add three paths
  - the sitemap, methodology catalogue, source inventory, import script and mirror get the new table
- **New** (each mirrors its Poverty counterpart file by file; Poverty has no area dropdown or per household / per person switch, so its component cannot simply be pointed at this data):
  - the research package and `prepare-household-income` script
  - the Prisma model and migration
  - `lib/explorer/householdIncome.ts` (state and model), its workbook and hub-card builders
  - `components/household-income/household-income-explorer.tsx`, `lib/pages/living-standards.tsx` (the hub, replacing the Poverty hub page) and the routes and messages
  - the methodology content and data methodology doc

## 11. Coordination

The "Money and banks" hub is being built in another thread on its own branch. It touches some of the same shared files: sidebar, sitemap, methodology catalogue, mirror files and browser-test page counts. Whichever merges second merges `main` in and resolves them.

## 12. Decision for Duru

Approve this spec. The implementation plan comes next. Approving it does not authorize pushing, a pull request, deployment or live database changes; the live preview comes first.

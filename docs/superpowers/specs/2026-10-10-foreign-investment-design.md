# Foreign investment page

Date: 2026-10-10
Status: Draft for Duru's review. Duru chose the Countries, Sectors and Regions tabs on 2026-10-10. This is the second page in the External flows hub. It builds on the frozen research package described in `docs/superpowers/specs/2026-10-09-remittances-investment-data-design.md` and follows the approved Money from abroad page (`2026-10-10-money-from-abroad-design.md`).

## 1. Intended result

Readers should be able to see how much foreign direct investment (FDI) reaches Georgia each year, which countries it comes from, which sectors receive it, and which regions it goes to.

The page answers three questions:

- How has foreign direct investment into Georgia changed since 1996?
- Which countries, sectors and regions account for most of it, and how has that changed?
- What did the latest year look like? (In 2025 it was USD 1,900.4 million.)

The page keeps the production editorial look and copies the Money from abroad layout: a trends workspace first, and a ranking for the range's end year below it.

## 2. Page and navigation

- Page: `/explorer/external/foreign-investment`, and in English `/en/explorer/external/foreign-investment`. Its name is **Foreign investment** (`უცხოური ინვესტიციები`), the same name the hub card already uses.
- The hub's card 02 becomes clickable and shows a small chart of the yearly total, 1996–2025. Current account stays a non-clickable `მალე` card.
- The sidebar lists the page under External flows, after Money from abroad.
- The page reuses the existing breadcrumbs, headings, language links, metadata, Dataset JSON-LD and sitemap patterns.

## 3. Page layout

Under the heading there is one short line: "Annual foreign direct investment into Georgia, in nominal US dollars." Nothing else goes under the heading. There is no headline-number block and no notes under the chart.

Three centred text tabs come next, styled like Received | Sent on Money from abroad:

**By country | By sector | By region**

Each tab shows the same statistic, Geostat's yearly FDI inflow, broken down a different way. The total is the first series on every tab.

| Tab | Years | Series list | Ranking below |
| --- | --- | --- | --- |
| By country | 1996–2025 | Total, then the end year's top 10 countries, then **Other countries** | Top 10 countries, then Other countries (listed last, unranked) |
| By sector | 2016–2025 | Total, then all 18 published economic sectors (NACE Rev.2 sections) | All 18 sectors |
| By region | 2009–2025 | Total, then the 11 regions | All 11 regions |

- **Other countries** is the total minus the top 10. It therefore also includes Unknown, International organizations and Geostat's own remainder, and the list always adds up to the total. This matches Money from abroad.
- Sectors and regions are short, fixed lists, so they are shown in full. Each still has fewer than 20 rows.
- **Initial state:** By country, line chart, all years, and only the total selected. The total stays first, selectable and removable.
- **Switching tabs** resets the selection to the total and fits the year range to the tab's own years. The range, tab, selection and chart/table mode are stored in the URL and survive a language change.
- Search, Clear, Select all and the count follow the existing series-selector contract.
- Amounts are nominal USD on the existing million/billion scale. The ranking uses million USD and each row's share of that year's total.
- The ranking and selector colours follow the stable per-series colour rule used on Money from abroad.
- One short source line goes under the chart: "Source: Geostat · nominal USD · years · date · Methodology and sources".

## 4. Data rules readers see

These rules come from the research package. Each is shown in the data where it matters. None of them adds a note under the heading or the chart.

1. **Negative values are real.** A country, sector or region can be negative in a year when investors withdrew capital, made losses or repaid loans. (In 2025 Imereti was −USD 64.2 million and 14 countries were negative.) Negative values are kept and drawn below zero. In the ranking, a negative value shows its minus sign and share, and its bar is empty. Nothing is turned into zero.
2. **Regions.** Six regions have been published separately only since 2016: Guria, Samegrelo-Zemo Svaneti, Imereti, Racha-Lechkhumi and Kvemo Svaneti, Shida Kartli, and Mtskheta-Mtianeti. Before 2016 Geostat publishes them only in three combined pairs. Their lines start in 2016 and show a gap before that, a dash in the table and a blank Excel cell. The combined pairs are not shown, and nothing is split or backfilled. So for 2009–2015 the regions do not add up to the total. The table and chart state this by leaving those years missing, not by adding a note.
3. **Tbilisi's share is high** partly because Geostat assigns the whole financial sector to Tbilisi. Country means the direct investor's country, so holding locations such as Malta or the Netherlands rank high. Both points are explained on the methodology page, not under the chart.
4. **Geostat only.** The page shows Geostat's FDI figure. NBG's balance-of-payments figure differs in every year (by up to USD 192.6 million in 2023) and is not shown or mixed in. The methodology page says so.

Not on this page: the end-of-year investment stock (position), the equity / reinvested earnings / debt split, NBG's BPM6 lines, quarters, 2026 values, country groups (EU, CIS), maps, detail pages, MCP tools and bulk publications.

## 5. Data scope and serving

The page promotes one subset of the frozen research package (`docs/Raw Data/External/2026-10-10/fdi-flows-annual.csv`): Geostat's annual FDI inflow rows for the total, the countries, the sectors and the regions. It does not take the component rows, the BPM6 rows or the country groups.

- A new `npm run data:prepare-foreign-investment` follows `prepare-money-transfers`. It checks each input's SHA-256 against `artifact-manifest.csv`, requires current, passing independent verification and zero failed checks, then writes `data/imports/foreign-investment-annual.csv` (UTF-8 with BOM) and `data/reports/foreign-investment-validation.json`. `--check` reproduces both byte for byte and runs in `data:validate`.
- The catalogue `data/taxonomy/foreign-investment.json` gives each series a stable ID and Georgian label:
  - `fdi.total`
  - `fdi.country.m49_XXX` for the 78 published countries
  - `fdi.country.unknown`, `fdi.country.international_organizations` and `fdi.country.other_remainder`
  - `fdi.sector.a` through `fdi.sector.s` for the 18 published sections
  - `fdi.region.*` for the 11 regions

  Georgian and English labels are reused from `trade-partners.json` (matched by M49 code), `economic-sectors.json` and `municipal-regions.json`. Only Saint Kitts and Nevis needs a new reviewed Georgian label.
- Validation rejects:
  - a missing or extra year for any tab
  - an unreviewed identity
  - a blank or not-applicable value turned into zero
  - a value that differs from the research row
  - a country, sector or region set in a year that no longer adds up to that year's total within the package's recorded tolerance (regions only from 2016)

  The country, sector and region totals must equal the Geostat total for every year.
- Values keep their exact decimals, status, vintage and source cells. The private Supabase mirror gets `ForeignInvestmentEntity` and `ForeignInvestmentFact` tables, with RLS on and public grants revoked. They are compared field by field inside the existing import transaction, exactly like the money-transfer tables. Publishing, the live migration and the live import remain separate authorized operations.

## 6. Sources and Excel

The page publishes through the existing source archive:

- Geostat's FDI by country, by sector and by region workbooks
- the annual total table
- Geostat's FDI methodology note

The page reuses the three-sheet Excel writer (Summary, Data, Sources). The workbook is in the selected language and contains the selected tab, series and years, explicit USD units, blank missing cells and validated source links. It has no internal identifiers or cell-reference columns.

The methodology page `/methodology/external-flows` gains a short Foreign investment section. It covers what FDI is, Geostat compared with NBG, the meaning of country and immediate investor, the Tbilisi financial-sector rule, the 2016 region split and negative values.

## 7. Verification

1. The serving package matches the research package exactly. CSV and database modes agree, and a failed import rolls back.
2. The default view is By country with only the total selected. Switching to Sector or Region changes the list, the years and the ranking, and resets the selection to the total. Search, bulk actions, an empty selection and invalid saved settings follow the existing contract.
3. The region lines that start in 2016 show gaps before 2016. Negative values draw below zero and appear in the ranking with an empty bar. Nothing becomes zero.
4. The chart, table, ranking and Excel agree for the same tab, years and series. The top 10 plus Other countries add up to the total.
5. Check Georgian and English at 390, 768 and 1440 pixels. Keyboard use and language switching keep the settings.
6. Run `npm run check`, `npm run build` and `npm run test:browser` once at completion, after Duru approves the screenshots.

During implementation, also update `Project_Definition.md` section 2, `DESIGN.md` (the new page), and `docs/data-methodology/external-flows-annual.md` (the serving rules).

## 8. Reuse

- **Used as is:**
  - `ExplorerWorkspace`, `EditorialLineChart`, `ExplorerTable`, `RangeStrip`, `SeriesAside`, `SeriesSelector`, `TextTab`, `SourceNote`
  - the three-sheet Excel writer
  - the source archive and methodology components
  - `readVerifiedPackageFile`, `assertGeneratedArtifactMatches`, `assertSameServedRows`
  - the money-transfer state, hash and colour helpers' patterns
- **Small additions:**
  - the ranking component becomes shared by both pages, with an empty bar for a negative value (Money from abroad has no negative values, so its output is unchanged)
  - the hub card builder takes the second dataset
  - the import script and mirror read and compare the new tables
- **New:**
  - the FDI serving package, catalogue and validation
  - the Prisma models and migration
  - the page component, its state and its model (mirroring the Money from abroad files)
  - the route, the sidebar entry and the messages

## 9. Decision for Duru

Approve this page design. After approval, the implementation plan follows. Approving the design does not authorize pushing, a pull request, deployment or live database changes. Screenshots come first.

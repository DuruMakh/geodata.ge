# External flows hub and Money from abroad page

Date: 2026-10-10
Status: Draft for review. On 2026-10-10 Duru chose "Money from abroad" as the first page built on the external-flows research foundation (`docs/superpowers/specs/2026-10-09-remittances-investment-data-design.md`). Not yet approved.

## 1. Intended result

Help Fiscal.ge readers see how much money reaches Georgia from abroad each year, where it comes from, how much leaves, and how that compares with the official estimate of money sent home by people working abroad.

The page answers three questions:

- How has money coming into Georgia through transfer services changed since 2000?
- Which countries does it come from, and how has that changed?
- How does it compare with NBG's balance-of-payments estimate of personal transfers?

Keep the production editorial appearance and the existing explorer controls. The page follows the Trading partners pattern: a trends workspace first, an end-year ranking below.

## 2. Pages and navigation

- Hub: `/explorer/external`, English `/en/explorer/external`. Name: **External flows** (`საგარეო ნაკადები`). It follows Trade in the sidebar; Demography follows it.
- Page: `/explorer/external/money-from-abroad`, English `/en/explorer/external/money-from-abroad`. Name: **Money from abroad** (`ფული საზღვარგარეთიდან`).
- Methodology: `/methodology/external-flows`, mirrored in English, using the existing methodology and source-archive components.

The hub has one working card. Foreign investment and Current account appear as non-clickable `მალე` cards until each has its own approved design, data and methodology. Reuse the existing breadcrumbs, headings, language links, footer source note, metadata and sitemap patterns. The Georgian names above are proposals; final wording follows the bilingual catalogue conventions.

## 3. Trends workspace

Under the heading and a two-sentence explanation, place two joined measure choices:

**Received | Sent**

One measure is active at a time and applies to every selected line. Received is money arriving in Georgia; Sent is money leaving it.

The selector has two tabs over one shared, unlimited selection, reusing the Trading partners selector:

**Georgia | Countries**

| Tab | Series | Received | Sent |
| --- | --- | --- | --- |
| Georgia | Money transfers, all countries | NBG transfer inflow | NBG transfer outflow |
| Georgia | Personal transfers (official estimate) | BoP personal transfers, credit | BoP personal transfers, debit |
| Countries | Each published country and remainder (250 identities) | Inflow from that country | Outflow to that country |

- Initial state: Received, line chart, all loaded years (2000–2025), only "Money transfers, all countries" selected. It stays first, selectable and removable.
- Search, Clear and Select all follow the existing contract; search never scopes the bulk action or the count.
- Amounts are nominal USD with the existing million/billion scale. Years, measure, tab, selection and chart/table mode live in URL state and survive language changes.
- Reuse the stable series-colour approach. Labels and table names identify every series without colour.
- A missing value is a gap in the chart, a dash in the table and a blank Excel cell, never zero.

## 4. Coverage rules readers see

These come from the research package and are shown where they matter, not hidden in methodology:

1. **2000–2007 list 18 countries plus "Other countries".** Full country lists start in 2008. Other countries' lines start in 2008, and the two "Other countries" remainders are separate series, never joined or backfilled.
2. **2019 is incomplete for about 70 smaller countries.** February is blank in the source, so their 2019 value covers 11 months. The table and Excel mark it; the chart draws it with a hollow point and a note in the hover detail.
3. **Microfinance organizations are included from January 2010.** A thin marker on the chart and a table footnote mark the coverage break. It is not bridged or adjusted.
4. **Country means where the transfer came from or went to, not the sender's citizenship.** A short note explains that transfers include money sent by non-residents, which is why transfers from Russia peaked in 2022. No cause beyond NBG's own wording is stated.
5. **Transfers are not the official remittance figure.** Transfer services carry only part of the money people send home and also carry other payments. The official estimate (personal transfers) comes from household surveys and bank reports. In 2025 transfers received were USD 3,649.0 million and personal transfers USD 3,409.9 million; in 2022 they were USD 4,372 million and USD 2,907 million. The page shows both and never subtracts one from the other.

## 5. Below the workspace

### Four summary figures

For the last year in the selected range, independent of checkboxes:

- Money transfers received
- Money transfers sent
- Personal transfers received (official estimate)
- Money transfers received as a share of GDP (2025: 9.6%), using the nominal GDP already served on Fiscal.ge

A missing end-year value shows a dash.

### Country ranking

For the active measure and the last year in the range: the top ten countries with their USD amount and share of that year's all-country total, expandable to the full list. Remainders ("Other countries") are listed last, not ranked. The ranking is independent of the selected lines. Clicking a country does not open a page; it only toggles its checkbox, matching Trading partners. In 2025 the top five sources were the United States (USD 683 million), Italy (621), Russia (468), Germany (319) and Greece (294).

## 6. Data scope and serving

Promote from the frozen research package only:

- the money-transfer rows (`money-transfers-annual.csv`, 9,312 observations including 14 blanks and 140 partial-month values);
- the BoP personal-transfer credit and debit rows (52 observations);
- the money-transfer share of GDP (26 values), recomputed from the served GDP series and checked against the research file.

Into a reviewed canonical serving package and the private parity-checked database mirror, following the Trade partners loader. Preserve exact decimals, status, months reported, vintage and source references. Validation rejects omitted or extra years, an unreviewed country identity, a changed total-equals-parts identity, a blank turned into zero and a partial-month value without its count.

Not on this page: monthly data, 2026 values, transfer systems (REMS), workers' remittances and compensation of employees, FDI, the current account, growth rates, currency conversion, inflation adjustment, country detail pages, maps, MCP tools and bulk publications.

## 7. Sources and Excel

Publish through the existing source archive: NBG's money-transfers-by-country workbook, the BPM6 balance-of-payments workbook and NBG's two methodology notes. Reuse the three-sheet Excel writer (Summary, Data, Sources) in the selected language with the selected series, years and measure, explicit USD units, blank missing cells, the partial-month and 2010 coverage notes, and validated source links. No internal identifiers or cell references appear as columns.

## 8. Verification

1. The serving package matches the research package exactly; CSV and database modes agree; a failed import rolls back.
2. Default is Received with the all-country total only. Switching to Sent changes every line, the ranking and the figures. Adding Italy and the official estimate works; removing the total works; search, bulk actions, empty selection and invalid saved settings follow the existing contract.
3. 2000–2007 countries show gaps for unlisted countries; 2019 partial values are marked; the 2010 break is marked; nothing becomes zero.
4. Chart, table, ranking, figures and Excel agree for the same years and measure.
5. Georgian and English at 390, 768 and 1440 pixels, keyboard use and language switching keep settings.
6. Run `npm run check`, `npm run build` and `npm run test:browser` once at completion.

During implementation, update `Project_Definition.md` section 2, `DESIGN.md` for the new hub and page, and `docs/data-methodology/external-flows-annual.md` for the serving rules.

## 9. Reuse

- As is: `ExplorerWorkspace`, `EditorialLineChart`, `ExplorerTable`, `RangeStrip`, `SeriesAside`, `SeriesSelector` with tabs, the Trading partners ranking and measure toggle, the editorial summary figures, the three-sheet Excel writer, the section-hub, methodology and source-archive components, and the nominal GDP series.
- Small additions: a hollow-point or note for partial values and a coverage-break marker, if the line chart does not already support them; the serving loader for the new package.
- New: the External flows hub entry and route, the serving dataset and its validation.

## 10. Decisions for Duru

1. Approve the page as described.
2. Hub name: "External flows" (`საგარეო ნაკადები`) is the default. Any other name is a one-line change.

After approval, the implementation plan follows. Approval of this design does not authorize publishing, a pull request, deployment or live database changes.

# Remittances, foreign investment and the current account: research and hub proposal

Date: 2026-10-09

Status: Draft for review. Nothing in this document is approved. It proposes a reviewed annual data foundation first, the same way Trade started (`2026-10-07-trade-data-design.md`), and sketches the pages that could follow. No source has been captured yet; every coverage year marked "confirm at intake" must be checked against the downloaded file before it is relied on.

## 1. Outcome

Give Fiscal.ge readers a reviewed, source-preserving view of the money that flows between Georgia and the rest of the world outside trade in goods:

- **Money sent home** — money transfers from abroad and the balance-of-payments measure of personal transfers.
- **Foreign direct investment (FDI)** — how much foreign companies invest in Georgia each year, from which countries and into which sectors.
- **The current account** — the one-number summary that combines goods, services, income and transfers and says whether Georgia earns more from abroad than it spends.

These complete the picture Trade leaves open on purpose: the Trade foundation states that "remittances, investment income and the current-account balance are outside it" (`2026-10-07-trade-data-design.md` §2).

This first stage, if approved, delivers data, source evidence, methodology and validation only. Pages, navigation, charts, downloads, MCP tools, serving-database imports and deployment are separate decisions, exactly as for Trade.

## 2. Why this hub is worth building next

The three flows are among the largest numbers in Georgia's economy and are widely quoted without context:

- In 2024, USD 3.36 billion arrived through money transfer operators and USD 378.0 million left (NBG, *Balance of Payments of Georgia 2024*, Table 2.2.42 and text). Personal transfers in the balance of payments were USD 3.19 billion, of which workers' remittances were USD 2.19 billion.
- Russia's share of transfers into Georgia went from 19.3% in 2020 to 47.3% in 2022 and back to 16.1% in 2024 (same table). Without the definitions in §4 a reader will misread that spike.
- FDI into Georgia was USD 1,569.3 million in 2024 by Geostat's August 2025 release, and USD 1,900.4 million for 2025 by Geostat's 8 September 2026 release (2025 is now "adjusted"; 2026 quarters are preliminary).
- The current account deficit was USD 1,008.4 million in 2025, 2.6% of GDP, which NBG calls the lowest on record (NBG release, 31 March 2026). It was about USD 1.8 billion in 2024.

## 3. Proposed collection scope

| Family | Publisher | Content | Expected annual coverage |
| --- | --- | --- | --- |
| Money transfers | NBG (tables REMC, REMM, REMCY) | Inflows and outflows through money transfer operators, total and by country | Start year: confirm at intake; microfinance organizations included from January 2010 (coverage break) |
| Balance of payments, summary | NBG (table BoP, BPM6) | Current account and its parts: goods, services, primary income, secondary income (with personal transfers and workers' remittances), capital account, financial account by functional category | 2000 onwards on BPM6 (NBG recalculated 2000–2013); earlier BPM5 years are not mixed in |
| FDI flows | Geostat | Total by year (from quarters), by country, by economic sector (NACE Rev.2), by component (equity, reinvestment of earnings, debt instruments), by region | Quarterly file covers 1996–2026; country, sector and component start years: confirm at intake |
| FDI position (stock) | Geostat | End-of-year position by country and by sector, integrated format | Start year: confirm at intake (integrated format compiled since March 2018) |

Collect complete official workbooks without editing them. They contain monthly or quarterly values and preliminary 2026 figures; those stay archived as evidence. Prepared observations are complete calendar years only, and no 2026 annual estimate is produced. Sub-annual data stays out because v1 allows no sub-annual data other than monthly inflation (`AGENTS.md`); a monthly money-transfer page would need its own explicit approval.

Out of scope for this stage: the international investment position beyond FDI, gross external debt (NBG tables ED/EDS; government debt already has its own hub), official reserves, Georgia's own investment abroad as a separate family (it stays visible only as the BoP "net acquisition of assets" line), Geostat FDI by enterprise size, age and information source, the NBG Power BI dashboards, and any forecast.

## 4. Publisher definitions and important limits

These are the points a reader and the methodology page must get right.

1. **Money transfers are not the same as remittances.** NBG's money-transfer tables count every transfer through electronic wire systems (Western Union, MoneyGram and similar) reported by commercial banks and microfinance organizations. NBG states this category "includes both the compensation of employees and worker's remittances, also transactions between nonresidents". The 2022 Russia spike is largely money moved by people who were not Georgian migrants. Pages must never label the money-transfer series "remittances" or "migrant earnings".
2. **Personal transfers and workers' remittances are BPM6 estimates.** They come from the balance of payments, are estimated mainly from household-survey data with bank transfer reports as a supplement, and are revised. They are the right series for "money sent home", but they are estimates, not counts.
3. **Two publishers, two FDI numbers.** Geostat compiles FDI from its enterprise survey plus NBG and ministry sources; NBG's balance of payments shows FDI as "net incurrence of liabilities". For 2024 the two published figures differ (Geostat USD 1,569.3 million in August 2025; NBG USD 1,602.9 million in its 2024 BoP publication). The cause is not established here. Keep both, label each by publisher and vintage, and never mix them in one series. Proposal: Geostat is the FDI source for country, sector and region detail; NBG's figure appears only inside the balance-of-payments family.
4. **Revisions are regular and large for FDI.** NBG republishes annual BoP, investment-position and external-debt data every 30 September with Geostat's final enterprise survey; NBG says "the biggest changes are made to the Foreign Direct Investment to Georgia records". Geostat publishes adjusted FDI each August (next: 16 August 2027). Every value carries its publication vintage and status (preliminary, adjusted, unspecified); a later capture replaces an earlier one only through a reviewed refresh.
5. **Reinvested earnings can dominate and debt can be negative.** In 2024, NBG's FDI liabilities were USD 521.8 million equity, USD 1,346.4 million reinvested earnings and −USD 265.2 million other capital. Negative values are real, not errors, and must not be dropped or shown as zero.
6. **BPM6 signs.** Current and capital account credits and debits are both positive; the balance is credit minus debit. In the financial account, positive means an increase in assets or liabilities. Preserve published signs exactly and document them.
7. **BoP goods are not Trade goods.** BoP goods are recorded on change of ownership with exports and imports both FOB; Trade records border crossings with CIF imports. The two totals will not match and must not be reconciled into each other.
8. **Countries.** Money transfers are by the country the transfer came from or went to, not the sender's citizenship. FDI by country is the immediate investor's country; offshore and holding-company locations (for example Malta or the Netherlands) appear as investors. Keep publisher country labels and codes; no ultimate-owner reallocation.
9. **Units and currency.** BoP and FDI are in USD. Preserve million or thousand units as published; no GEL conversion in this stage.

## 5. Sources and intake

Primary sources:

- NBG [statistics data](https://nbg.gov.ge/en/statistics/statistics-data) (static Excel tables BoP, REMC, REMM, REMCY) and [advance release calendar](https://nbg.gov.ge/en/statistics/data-distribution): BoP quarterly; money transfers monthly, around the 15th.
- NBG [Balance of Payments of Georgia](https://nbg.gov.ge/en/publications/balance-of-payments) annual publications, for definitions and matching-year checks.
- Geostat [Foreign Direct Investments](https://www.geostat.ge/en/modules/categories/191/foreign-direct-investments): eleven Excel tables (by countries, sectors NACE Rev.2, sources, regions, components, size, age, quarters 1996–2026, position by countries and sectors, BPM6), quarterly releases.

Already archived and reusable: NBG's external-sector methodology (`external-sector-eng-bpm6updated.pdf`) and the 2024 BoP publication (`bop-2024-eng.pdf`) in `docs/Raw Data/Trade/geostat-external-trade/2026-10-07/official/`. Reference them from the new package rather than copying them.

The new package would live in `docs/Raw Data/External/` with the same manifest fields as Trade: original and resolved URL, publisher, UTC retrieval time, file name, SHA-256, byte size and content type.

Intake constraint: the cloud workspace used for this draft cannot reach `nbg.gov.ge` or `geostat.ge` (the network policy refuses both). The capture has to run on a machine that can, as the Trade capture did, or after those two hosts are allowed. NBG's statistics page loads its file list with JavaScript, so the exact NBG workbook URLs are recorded at capture time.

## 6. Prepared package, validation and reuse

Reuse as is: the Trade research-package pattern — a package-local `prepare.py` with `--write` and `--check`, exact decimals, `source-observations/`, `artifact-manifest.csv`, `coverage.csv`, UTF-8-with-BOM CSVs, and an independent `verify_independent.py` over `openpyxl`; the source-archive and methodology-page components; the nominal GDP series (`docs/data-methodology/national-nominal-gdp.md`) if shares of GDP are approved.

Small additions: a publication-vintage column, because these sources revise every year in a way Trade's do not.

Genuinely new: the research CSVs (`money-transfers-annual.csv`, `bop-annual.csv`, `fdi-flows-annual.csv`, `fdi-position-annual.csv`) and the methodology `docs/data-methodology/external-flows-annual.md`.

Reconcile, within USD 0.1 million unless a source shows otherwise:

- Money-transfer countries with the inflow and outflow totals, keeping any unallocated remainder explicit.
- BoP current account with goods + services + primary income + secondary income, and personal transfers within secondary income.
- Geostat FDI by country, by sector, by component and by region each with the same-year total; quarters with the annual total.
- NBG and Geostat FDI compared per year and reported as a difference with vintages, never forced to agree.

Focused failure tests reject an omitted year, a lost country or sector, a duplicate key, a sign flip, an invented zero, a changed source fingerprint and any 2026 value entering an annual file.

## 7. Pages this could become (separate approval)

Sketch only, to show the destination. Each page gets its own spec, reusing the existing line chart, table, range strip, series selector and Excel export:

1. **Hub** `/explorer/external` (working name "External flows"; Georgian name to be chosen with the methodology terminology).
2. **Current account** — the four parts and the balance, signed bars like Trade's balance chart.
3. **Money transfers** — inflows, outflows and net, with a country comparison like Trade's partners page, and personal transfers from the BoP as a separate, clearly labelled line.
4. **Foreign investment** — total, components, top countries and sectors, and the end-of-year position.

## 8. Decisions for Duru

1. **Scope of the first stage.** All three families together (recommended: they share one publisher calendar and the current account needs the other two for context), or money transfers alone first.
2. **Shares of GDP.** Show current account, transfers and FDI as a percentage of GDP using the existing GDP series (recommended: it is how NBG and Geostat headline them), or USD only like Trade.
3. **Where capture runs.** On your computer, as Trade was captured, or after allowing `nbg.gov.ge` and `geostat.ge` in the cloud workspace's network settings.

## 9. Acceptance and workflow

Unchanged from Trade: spec approval, then an implementation plan, then preparation, focused checks and the independent verifier, a review, and the repository completion gate once (`npm run check` and `npm run build`). No UI change is in this stage, so no browser tests. After approval, record the bounded research foundation in `Project_Definition.md` section 2 without authorizing pages. Publishing, PRs and merging need separate authorization.

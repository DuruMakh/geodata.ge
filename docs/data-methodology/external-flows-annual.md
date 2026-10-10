# Annual external flows research foundation: money transfers, FDI and the current account

Approved scope: 2026-10-10. This is a research package. Pages, downloads, MCP tools and serving-database imports need a separate approved design.

## Source capture and coverage

The frozen package is `docs/Raw Data/External/2026-10-10/`. `official/` holds 28 unedited files captured on 10 October 2026 from Geostat and the National Bank of Georgia (NBG), with `full-source-manifest.json` recording URLs, retrieval time, byte size and SHA-256. Preparation refuses to run if any fingerprint changes.

| Family | Publisher and table | Complete annual periods | Limits |
| --- | --- | --- | --- |
| Money transfers | NBG REMC (by country, monthly) | 2000–2025 | 2000–2007 lists 18 major countries plus Other Countries; full country lists from 2008. Microfinance organizations included from January 2010 |
| Balance of payments | NBG BOP-6 (BPM6) | 2000–2025 | NBG recalculated 2000–2013 to BPM6; BPM5 years are not mixed in |
| FDI flows | Geostat | Total 1996–2025; countries 1996; regions 2009; components 2013; NACE sections 2016 | Each breakdown keeps its own start year |
| FDI position | Geostat (integrated format) | 31 December 2015–2025 | By country and by NACE section |

Publication vintages: Geostat annual FDI tables 17 August 2026, quarterly totals and positions 8 September 2026, Geostat's BPM6 FDI table 30 September 2026; NBG balance of payments 30 September 2026; NBG money transfers 15 September 2026. Every value carries its vintage. Both publishers revise past years every summer and autumn, so figures quoted from earlier releases can differ. For example, NBG's March 2026 release gave a 2025 current-account deficit of USD 1,008.4 million, while the 30 September 2026 file gives USD 1,123.2 million.

Archived but not prepared: NBG REMM (used only as a check), REMS (by transfer system), IIP-6, and Geostat FDI by information source, enterprise size and enterprise age. NBG publishes no money-transfers-by-currency table.

## Definitions and preservation rules

**Money transfers are not remittances.** NBG's tables cover all money sent to and from Georgia through fast money-transfer systems (Western Union, MoneyGram, Zolotaia Korona and others), as reported by commercial banks and microfinance organizations. That includes transfers by non-residents, which explains Russia's 2022 peak. Country means the country a transfer came from or went to, not the sender's citizenship. NBG notes that the sharp fall from Russia in August 2026 follows sanctions on the Zolotaia Korona system. That month lies outside the prepared years.

**Personal transfers and workers' remittances** are BPM6 balance-of-payments estimates, built mainly from household-survey data with bank reports as a supplement. They are the measure of money sent home. In 2025, personal-transfer credit was USD 3,409.9 million and money-transfer inflows were USD 3,649.0 million.

**FDI has two publishers.** Geostat compiles FDI from its survey of enterprises' external economic activities, NBG reports on financial corporations and ministry privatization data, as equity, reinvestment of earnings and debt instruments by the non-resident's share (10% or more of equity or voting rights). Its annual release may adjust the previous five years. NBG's balance of payments shows direct-investment liabilities on the BPM6 asset/liability basis. The two totals differ every year, by up to USD 192.6 million in 2023. They are kept side by side, labelled by publisher, and never mixed in one series. Geostat's separate BPM6 table equals NBG's direct-investment lines exactly. FDI by country names the investing non-resident's country, so holding locations such as Malta or the Netherlands appear among the largest investors.

**Signs.** BPM6 current- and capital-account credits and debits are positive; balances are credit minus debit. Financial-account balances are assets minus liabilities, so a negative direct-investment balance means net inflow. FDI components, sectors, regions and countries can be negative (disinvestment, losses, loan repayments) and are preserved.

**Regions.** Geostat allocates FDI by enterprises' actual addresses and assigns the whole financial sector to Tbilisi. Three combined regions are published every year. Their parts (for example Samegrelo-Zemo Svaneti and Guria) are published from 2016; earlier years show `-`.

**Values and missingness.** Amounts are nominal USD. Source units (USD, thousand or million USD) and exact stored decimal tokens are kept, and arithmetic uses Decimal with precision 50. Blanks stay `blank` and Geostat's `-` stays `not_applicable`; neither becomes zero. An annual money-transfer value is the sum of its twelve published months. Where some months are blank (for example February 2019 for about 70 smaller countries), the value is the sum of the reported months, marked `partial_months` with the count. 2026 values and all sub-annual cells stay in the originals.

**Identities.** FDI countries use their published numeric codes (`m49_040` for Austria, leading zeros kept). NACE sections use their letters. Money-transfer labels changed spelling between NBG's period sheets. `money-transfer-country-identities.csv` joins 28 renamed or abbreviated labels (for example `USA`, `United States`, `United States of America`) to one identifier. It keeps remainders (`Other Countries`, `Areas not elsewhere specified`, `Other Territories`) and labels that exist in only one period (Saint Martin, Netherlands Antilles) separate.

**Shares of GDP.** `shares-of-gdp-annual.csv` divides four series by nominal GDP in USD from `data/imports/gdp-overview-annual.csv`: the current-account balance, personal-transfer credit, money-transfer inflow and Geostat FDI. Each share records both inputs. In 2025 the current account was −2.94% of GDP.

## Validation and reconciliation

All checks are in `prepared-reconciliation.csv`. A check passes within USD 1, or within the stored rounding of the compared values when that is coarser: half a unit of the last stored digit for each input. 1,003 checks pass and none fail.

- **Balance of payments:**
  - Every net equals credit minus debit, or assets minus liabilities.
  - The current account equals goods and services plus primary and secondary income.
  - Net lending equals the current plus capital account.
  - The financial account equals its five functional categories.
  - Errors and omissions equal the financial account minus net lending.
  - Direct-investment liabilities equal equity plus reinvested earnings plus debt.
- **FDI:**
  - Every group equals its countries and remainder.
  - The total equals the three groups plus Unknown and International Organizations.
  - Sectors, components and regions each sum to the total.
  - The four quarters sum to each annual total, and every table's total matches it. Geostat's display unit of 0.1 thousand USD and its rounding footnote are honoured.
  - Country and sector positions agree.
- **Money transfers:**
  - Countries and remainders sum to the total.
  - Recorded rather than forced: the REMC monthly sums are compared with NBG's published annual totals in REMM. They differ by at most USD 2,102. A difference above 0.001% would fail, which a missing month (about 8%) always exceeds. REMM has no 2024 column, so 2024 rests on REMC alone. Its inflow of USD 3,361.5 million matches NBG's 2024 publication.
- **Independent check:** `verify_independent.py` uses openpyxl and no preparation code. It walks the source tables itself, requires the same 14,851 source cells, and recomputes every prepared value. `prepare.py --check` accepts only current, passing independent evidence.
- **Failure tests:** `test_prepare.py` has 17 tests. They reject:
  - a changed fingerprint or vintage
  - an omitted year or month
  - an unreviewed or duplicated country identity
  - an altered value or an invented zero
  - a duplicate key

  They also pin blank and not-applicable handling, partial months, leading zeros, unit conversion and the 2024 REMM gap.

Reproduction commands are in the package README.

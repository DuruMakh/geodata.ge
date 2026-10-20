# Annual internet and technology data collection and validation

## Purpose and status

This methodology governs the research package at `docs/Raw Data/Internet/geostat-ict-households-annual/`, collected on 2026-10-20 from the National Statistics Office of Georgia (Geostat). The research captures are immutable. The 1,055 served values (102 indicators), all survey estimates, appear on the Internet and technology pages under the approved design `docs/superpowers/specs/2026-10-20-internet-design.md`; see [Serving on the Internet pages](#serving-on-the-internet-pages). Nothing is published through MCP or included in central machine-readable publications.

Geostat is the sole publisher. The package preserves 36 originals under `official/`: the 17 English tables of the survey "ICT usage in households" (category 106), their 17 Georgian editions under `official/ka/`, and captures of the English and Georgian category pages. Exact URLs, retrieval times, byte sizes and SHA-256 fingerprints live in `source-manifest.csv` and `source-manifest.json`; the package README holds the cell map. Ten English tables supply values; the Georgian editions are checked against them and, with the other seven tables and the page captures, are archived for provenance only.

## Survey

Geostat runs the survey once a year, in June or July; every table labels its rows "June, 2016", "July, 2018" and so on, 2016–2026 (June in 2016, 2017 and 2024–2026; July in 2018–2023). Each year served is one survey. Values are sample estimates, so small differences between groups or years may not be meaningful. All values are percentages, stored as full doubles with the cell format `0.0`.

## Indicators and definitions

| Indicator IDs | Meaning | Source | Coverage |
| --- | --- | --- | --- |
| `internet.homes_internet.*`, `internet.homes_computer.*` | Share of households with internet access, with computer access | tables 01, 08 | 2016–2026; five regions from 2020 |
| `internet.used_3m.*`, `internet.never_used.*` | Last internet use within the last 3 months, never used; people aged 6+ | table 02 | 2016–2026 |
| `internet.daily.*` | Uses the internet every day or almost every day; people aged 15+ who used it in the last 3 months | table 04 | 2016–2026 |
| `internet.bought_online.*` | Bought or ordered goods or services online; people aged 15+ who used the internet in the last 12 months | table 05 | 2016–2026 |
| `internet.activity_*.total` | Nine purposes of internet use; people aged 15+ who used it in the last 3 months | table 03 | 2016–2026 |
| `internet.egov_*.total` | Interaction with public authorities or public services over the internet for private purposes in the last 12 months, and its three kinds; people aged 15+ | table 16 | 2016–2026 |
| `internet.own_mobile.*`, `internet.own_smartphone.*` | Owns a mobile phone, a smartphone; people aged 6+ | tables 12, 14 | 2016–2026; smartphone 2019–2026 |
| `internet.computer_3m.*` | Last computer use within the last 3 months; people aged 6+ | table 09 | 2016–2026 |

Homes groups are `total` (Georgia), `urban`, `rural` and the 11 regions (`region_tbilisi`, …). People groups are `total`, `urban`, `rural`, `female`, `male`, `age_15_29`, `age_30_59`, `age_60_plus` and, for the aged-6+ tables only, `age_6_14`. Activities and public services are served for `total` only. Geostat's "15 years and older" column and the "Other regions" column of tables 01 and 08 are not served.

All rows use `basis=actual` and `value_status=survey_estimate`. Nothing is calculated, interpolated or imputed.

## Identifiers

Indicator IDs are stable lowercase ASCII names `internet.{measure}.{group}`; the 102 served IDs are listed in `coverage.csv`. Source IDs are `geostat_ict_*` (the registry adds the `source.` prefix; Georgian editions end in `_ka`). Georgian and English labels are display data, never identifiers. `data/imports/internet-annual.csv` has one row per indicator and year, with the columns `year`, `indicator_id`, `value`, `published_value`, `unit`, `basis`, `value_status`, `source_id`, `source_sheet`, `source_cell` and `last_reviewed_at`. `value` keeps the stored double's shortest round-trip text and `published_value` rounds it half-up to one decimal from the 15 significant digits Excel displays.

## What the pages cover

Annual figures on four pages and a page for Georgia and each of the 11 regions (12 area pages), plus `/methodology/internet`, each mirrored under `/en`: Internet at home (homes with internet and with a computer, on the region map), Internet users (used in the last 3 months, never used, daily use), Shopping and services online (bought online, nine activities, public services) and Phones and computers (own a mobile phone, own a smartphone, used a computer). Tables 06, 07, 10, 11, 13, 15 and 17 are not served.

## Who is counted

Homes: households (tables 01, 08). People aged 6 and older: tables 02, 09, 12 and 14. Internet users aged 15 and older who used it in the last 3 months: tables 03 and 04 ("The indicator is calculated for the population who used internet within the last 3 months."). Internet users aged 15 and older who used it in the last 12 months: table 05. People aged 15 and older and contact in the last 12 months: table 16. Every series row under a heading carries that heading's population.

## Regions and the larger sample from 2020

Tables 01 and 08 print `…` for Kvemo Kartli, Samtskhe-Javakheti, Guria, Mtskheta-Mtianeti and Racha-Lechkhumi and Kvemo Svaneti in 2016–2019: "The data is not available due to small sample size of the survey. Survey sample size has been increased since 2020." Those years produce no row and are gaps, never zero; the shared range clamps to each list's coverage, so those regions' pages and workbooks start in 2020. "The data of 2016-2019 includes Imereti, Racha-Lechkhumi and Kvemo Svaneti regions", so Imereti before 2020 is not the same area as from 2020. "Other regions" (2016–2019: Kvemo Kartli, Samtskhe-Javakheti, Guria and Mtskheta-Mtianeti) is archived, not served.

## Tables left out

Table 06 marks its 2016 value: "The indicator is calculated for the population who used mobile devices to access the wireless internet away from home or work." Tables 07 and 11 count activities ever carried out in 2016–2017 (sheet note "The indicator is calculated for the population who used internet ever."), within the last 12 months in 2018–2024 and within the last 3 months from 2025, on three sheets. Their series are not comparable across those years, so they are not served. Tables 10, 13 and 15 are kept for reference; table 17 (ICT skills) starts in 2025.

## Activities and public services

Table 03's rows: participating in social networks, telephoning or video calls over the internet, reading online news, sending or receiving e-mails, seeking health-related information, finding information about goods or services, looking for a job or sending a job application, internet banking, and downloading software other than games. Each is a share of users and people can do several, so they do not add up to 100. Table 16's rows: interacted over the internet, obtaining information from websites of public authorities, downloading official forms and submitting completed forms; one person can do several kinds, so they add up to more than the first row. The "did not interact" row is used only for the sum check.

## Values as Geostat publishes them

The pages show Geostat's published percentages to one decimal and calculate nothing: no averages, differences or totals, and no filled gaps. Missing years are gaps, dashes and blank Excel cells, never zero. The pages describe the figures and state no causes.

## Extraction and validation

`prepare.py` locates every column by its printed heading (footnote stars removed) and every row by its printed year and label, and keeps each observation's source ID, sheet and cell. `python3 -B prepare.py --check` rebuilds every output and rejects a changed value, a missing, extra or duplicate observation, a year outside an indicator's coverage, a published value that is not the stored value rounded, a distribution that does not add up to 100 within 0.01 points (last internet use, last computer use, frequency of internet use, interacted or not), Everyone outside the women–men or towns–villages range, Georgia's homes outside the towns–villages range, a served cell that differs from the Georgian edition (beyond 1e-9 or in published value), and an anchor differing from Geostat: homes with internet 70.1 (2016) and 93.5 (2026), Tbilisi 98.2, villages 89.0, Guria 91.1 (2026); used the internet in the last 3 months 89.6; bought online 38.6 (15–29: 63.0); internet banking 61.0; own a mobile phone 93.3 (all 2026). `node verify_independent.mjs` re-reads the ten served tables with SheetJS and checks all 1,055 rows, with negative controls. On every `data:check-internet` the site's own prepare step (`lib/data/internet/prepareInternet.ts`) re-reads every cell again with SheetJS, and its validation (`lib/data/internet/validation.ts`) also rejects a value outside 0–100.

## Serving on the Internet pages

`npm run data:prepare-internet` writes `data/imports/internet-annual.csv` (UTF-8 with BOM) and `data/reports/internet-validation.json`; `npm run data:check-internet` (part of `data:validate`) rebuilds both in memory and fails on any difference. The Prisma mirror table `InternetFact` (migration `20261020090000_internet`) is filled only by the transactional, parity-checked `npm run data:import`; CSV and database modes serve identical rows.

Routes are `/explorer/internet` with `/homes`, `/homes/[id]` (Georgia and the 11 regions), `/users`, `/online` and `/devices`, plus `/methodology/internet`, each mirrored under `/en`. Excel downloads hold Summary, Data and Sources sheets in the reader's language, with the selected series and years, percentages to one decimal, survey-estimate status, empty cells for missing values and validated links to the archived Geostat tables the exported values come from (`data/methodology/source-archives/internet.csv`); only the ten served tables are listed. Internal identifiers and cell references are not exported. `/methodology/internet` publishes all 36 originals; the HTML captures download as `.txt` files. The 36 `source.geostat_ict_*` rows of `data/sources/source-documents.csv` stay out of the fact-query snapshot.

## Statistical limitations and future use

Later integration must preserve annual frequency, survey-estimate status, the 2020 start of five regions and the pre-2020 Imereti area. The activity-count tables, the 2016 mobile internet value, tables 10, 13, 15 and 17, any regional figure for people, any calculated ratio and any statement of causes would each be a separately reviewed addition.

Original sources: Geostat's [ICT usage in households](https://www.geostat.ge/en/modules/categories/106/ict-usage-in-households) page ([Georgian](https://www.geostat.ge/ka/modules/categories/106)).

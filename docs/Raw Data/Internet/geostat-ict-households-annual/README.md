# Geostat ICT usage in households, annual research package

Reviewed source package for the fiscal.ge Internet and technology hub (spec `docs/superpowers/specs/2026-10-20-internet-design.md`).

## Source

National Statistics Office of Georgia (Geostat), "ICT usage in households", `https://www.geostat.ge/en/modules/categories/106` (Georgian: `/ka/modules/categories/106`). Geostat runs the survey once a year, in June or July; every table prints one row (or block of rows) per survey, labelled "June, 2016", "July, 2018" and so on, 2016–2026. All values are percentages, stored as full doubles with the cell format `0.0`.

All 17 English tables and their 17 Georgian editions were downloaded on 2026-10-20 between 05:40 and 05:41 UTC, with captures of both category pages. `source-manifest.csv` and `.json` give each file's URL, retrieval time, SHA-256 and size. The originals in `official/` are never edited. Table 16's English file is saved as `16_Interaction_with_public_authorities_over_the_internet.xlsx`; Geostat names it `16_Interaction_with_public_authorities_or_public_services_over_the_inter....xlsx`.

## Served

| Table | Source ID | Measures | Groups | Years |
| --- | --- | --- | --- | --- |
| 01 | `geostat_ict_homes_internet` | `homes_internet` | Georgia (`total`), Urban, Rural, 11 regions | 2016–2026; 5 regions from 2020 |
| 08 | `geostat_ict_homes_computer` | `homes_computer` | as 01 | as 01 |
| 02 | `geostat_ict_last_internet_use` | `used_3m` (Within last 3 months), `never_used` (Never used) | Total, Urban, Rural, Female, Male, 6–14, 15–29, 30–59, 60+ | 2016–2026 |
| 04 | `geostat_ict_internet_frequency` | `daily` (Every day or almost every day) | as 02 without 6–14 | 2016–2026 |
| 05 | `geostat_ict_ecommerce` | `bought_online` | as 04 | 2016–2026 |
| 03 | `geostat_ict_purposes` | nine `activity_*` rows | Total only | 2016–2026 |
| 16 | `geostat_ict_public_services` | `egov_any`, `egov_info`, `egov_download_forms`, `egov_submit_forms` | Total only | 2016–2026 |
| 12 | `geostat_ict_own_mobile` | `own_mobile` | as 02 | 2016–2026 |
| 14 | `geostat_ict_own_smartphone` | `own_smartphone` | as 02 | 2019–2026 |
| 09 | `geostat_ict_last_computer_use` | `computer_3m` (Within last 3 months) | as 02 | 2016–2026 |

1,055 observations in `internet-annual.csv`, one per indicator and year (`coverage.csv` lists each indicator's years). Columns are found by their printed heading (footnote stars removed) and rows by their printed year and label, never by position. Geostat's "15 years and older" column and the "Other regions" column of tables 01 and 08 are not served. Cells printed `…` produce no row, and only where expected.

`value` is the stored double's shortest round-trip text; `published_value` rounds it half-up to one decimal from the 15 significant digits Excel displays (93.34998070175611 publishes as 93.3).

Archived but not served: tables 06 (mobile internet), 07 and 11 (number of internet and software activities), 10 (frequency of computer use), 13 and 15 (uses a mobile phone or smartphone), 17 (digital skills, 2025–2026 only), every Georgian edition, and the two page captures.

## Geostat's notes

- Regional values: "The data is not available due to small sample size of the survey. Survey sample size has been increased since 2020." Kvemo Kartli, Samtskhe-Javakheti, Guria, Mtskheta-Mtianeti and Racha-Lechkhumi and Kvemo Svaneti start in 2020. Imereti 2016–2019 "includes Imereti, Racha-Lechkhumi and Kvemo Svaneti regions"; "Other regions" (2016–2019) is Kvemo Kartli, Samtskhe-Javakheti, Guria and Mtskheta-Mtianeti.
- Who is counted: tables 02, 09, 12 and 14 cover people aged 6 and older; 04 covers people aged 15+ who used the internet in the last 3 months; 03 the same users; 05 people aged 15+ who used the internet in the last 12 months; 16 people aged 15+ and contact in the last 12 months.
- Table 06's 2016 value counted mobile access away from home or work only; tables 07 and 11 changed their reference period (ever in 2016–2017, the last 12 months in 2018–2024, the last 3 months from 2025). These are why they are not served.

## Checks

`python3 prepare.py` rebuilds every generated file; `--check` fails if one differs. `python3 -m unittest test_validation -v` and `node verify_independent.mjs` (SheetJS, from `apps/web`) must pass. The checks:

- every value equals its source cell, every published value is its rounding, and the coverage is exactly the years above;
- the rows of each distribution add up to 100 within 0.01 points for every group and year (last internet and computer use; frequency of internet use; contact with public services, did or did not);
- Everyone lies between women and men and between towns and villages, and Georgia's homes between towns and villages;
- every served cell has the same value (within 1e-9, the editions differ in a few last digits) and the same published value in the Georgian edition;
- anchors: homes with internet 2016 70.1 and 2026 93.5, Tbilisi 98.2, villages 89.0, Guria 91.1; used the internet in the last 3 months 2026 89.6; bought online 2026 38.6 (15–29: 63.0); internet banking 2026 61.0; own a mobile phone 2026 93.3.

Nothing is imputed or calculated.

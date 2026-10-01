# Demography source review (Geostat, 2026-10)

Reviewed 2026-10-01. Source inspection is complete for the four families approved the same day: population, age and sex structure, vital events and international migration. No canonical data file, route or page exists yet. `source-manifest.csv` records the URL, retrieval date, bytes and SHA-256 of every archived file, and all 26 rows were re-verified against the files on disk. The decisions taken after this review, and those still open, are in §9.

## 1. What Geostat publishes, and what was archived

Geostat's [Population and Demography](https://www.geostat.ge/en/modules/categories/316/population-and-demography) page has sub-categories for the 2024 census results, Population, Births, Deaths, Natural Increase, Migration, Marriages and Divorces. Together they list 82 numbered XLSX tables (01–49, with sub-numbers). Geostat's PC-Axis database (`pc-axis.geostat.ge`) lists the same numbered tables for Population, Births, Deaths, Migration, Marriages and Divorces. Original XLSX files are the captures here, as in the earlier datasets. Marriages, divorces, citizenship changes and causes of death are outside the approved scope and were not archived.

| Family | Canonical inputs (proposed) | Validation only |
| --- | --- | --- |
| A. Population | 01 population on 1 January by region and municipality (reused capture) | 04 mid-year population; census table 2024 |
| B. Structure | 02 population by age group and sex | 06 median age; 07 share aged 65+; 08 dependency ratios. 02-1 (single years of age, 2015–2026, exact persons) is archived but not proposed for this stage |
| C. Vital events | 09 births, 19 deaths, 29 natural increase, 15 crude birth rate, 24 crude death rate, 16 fertility, 25 infant mortality rate, 28 life expectancy | 30 natural increase rate; 21 infant deaths; 27 abridged life tables |
| D. Migration | 31 net migration, 33 immigrants and emigrants by sex and citizenship | 32 immigrants and emigrants by age and sex (its totals must agree with 33) |

Every table was read at its **stored** cell value, not the displayed one (see §7). The Geostat sources reachable from the audit environment were `www.geostat.ge` and `pc-axis.geostat.ge`. `database.geostat.ge` (the interactive demographic portal) failed TLS verification from the audit environment and is not needed, because the same tables are published as XLSX.

## 2. The identity that holds the series together

Geostat builds the 1 January population by bookkeeping: population on 1 January of year t+1 equals population on 1 January of year t plus births minus deaths plus net migration of year t. Tested on tables 01, 09, 19 and 31 at stored precision, the residual is **0 persons in 31 of the 32 transitions from 1994→1995 through 2025→2026**. The one exception is 2024→2025.

| Year | Births | Deaths | Net migration | Components | Observed change | Residual |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2019 | 48,296 | 46,659 | −8,243 | −6,606 | −6,606 | 0 |
| 2020 | 46,520 | 50,537 | +15,732 | +11,715 | +11,715 | 0 |
| 2021 | 45,946 | 59,906 | −25,966 | −39,926 | −39,926 | 0 |
| 2022 | 42,319 | 49,118 | +54,509 | +47,710 | +47,710 | 0 |
| 2023 | 40,214 | 42,756 | −39,207 | −41,749 | −41,749 | 0 |
| 2024 | 39,483 | 43,971 | +14,386 | +9,898 | +235,820 | **+225,922** |
| 2025 | 37,867 | 44,319 | +17,127 | +10,675 | +10,675 | 0 |

So the ±40,000 swings in 2021–2023 are published migration and mortality counts, not errors. The +225,922 is the census recalculation: the pre-census 1 January 2025 value (3,694,608 + 9,898 = 3,704,506) against the census-based 3,930,428.

## 3. Breaks

| Break | Evidence | Affects | Does not affect |
| --- | --- | --- | --- |
| **1 January 2025: census recalculation.** Georgia 3,694,608 → 3,930,428 (+6.4%) | Footnote on tables 01, 02, 02-1, 06, 07, 08: "Based on the results of the 2024 population census, the population size and related data as of January 1, 2025 were recalculated." | Population at every level; age structure; mid-year population; every rate with a population denominator; life tables. At 2025: total fertility rate 1.67 → 1.53; life expectancy 74.9 → 76.0 (males 70.5 → 71.4, females 79.3 → 80.6); share aged 65+ 16.2% → 17.6%; old-age dependency 25.1 → 28.0; total dependency 55.5 → 59.3; crude birth rate 10.7 → 9.6 | Counts of registered births and deaths; border-police migration counts |
| **2013 → 2014: vital events change method.** | Footnote on tables 09, 15, 16, 19, 21, 24, 25, 27, 28, 29, 30: "1995-2013 based on the retro-projection; starting from 2014 based on the registered data" | Births 49,657 → 60,635 (+22.1%); total fertility rate 1.86 → 2.31; crude birth rate 13.4 → 16.3; natural increase rate +0.3 → +3.1; infant mortality 13.2 → 9.5. Deaths barely move (48,564 → 49,087, +1.1%) | Population stock |
| **2011 → 2012: migration changes method.** | Footnote on tables 31 and 32: retro-projection before 2012, "MIA Border Police data" from 2012. Net migration −35,982 → −21,521 | All migration series. Citizenship detail exists only from 2012; immigrants and emigrants by age and sex from 2002 | Population stock before the census |
| **2002: life-table method.** | Table 28: "Before 2002 presents an abridged life tables; Starting from 2002 presents an actuarial life table." | Life expectancy before 2002 | |

Within the approved depth, municipal and regional vital-event series start in 2015 and sit wholly on registered data, so they cross no method break. The Georgia series from 2004 cross the 2014 break for vital events (2004–2013 retro-projected) and the census break at 2025.

## 4. Revision practice and the expected re-estimation

Table 01, downloaded again on 2026-10-01, is **byte-identical** to the capture of 2026-08-03 (SHA-256 `8BD7A1B56E756E8D6BC92192095795B204B23FD18274AAFF39B78C0B0A487A57`, 34,994 bytes), and the key-figures table on Geostat's category page agrees with it. Geostat's 2026 calendar lists the 1 January 2026 and 1 January 2025 population releases together on 24 April 2026. So 2015–2024 are **not re-estimated**.

Geostat's population and births metadata describe the precedent: "The 2014 General Population Census results revealed the necessity of re-estimation of basic demographic data of previous years. In 2018, the Retro-projected results of the main demographic indicators for the period 1994-2014 became available." That was three to four years after the 2014 census. The population metadata, updated 2026-04-24, still describes the numbers as "based on the 2014 General Population Census". No re-estimation date has been announced.

## 5. Definitions confirmed from Geostat's metadata

Metadata PDFs 0901–0904 are archived under `official/metadata/`.

- **Population**: usual residents on 1 January; between censuses, the census base plus natural increase and net migration; occupied territories excluded.
- **Census** ([news note of 2025-08-26](https://www.geostat.ge/en/single-news/3530/information-on-the-processing-of-the-2024-population-census-results)): reference moment midnight between 13 and 14 November 2024; citizens permanently resident, plus foreign citizens and stateless persons resident more than 12 months. Preliminary results (2025-06-25) were 3,914 thousand, of whom at least 93.4% (3,657 thousand) citizens. The final count, read from Geostat's census table (`official/census-2024/`), is **3,929,581** at 14 November 2024 (1,881,004 males, 2,048,577 females).
- **Births and deaths**: counted when registered in the reference year, including events of Georgian citizens registered at Georgian representations abroad; occupied territories excluded. Sources are the Public Service Development Agency registers and National Center for Disease Control medical certification. Crude rates divide by mid-year population.
- **Migration**: an immigrant is recorded at the border, accumulates at least 183 days of residence in the following twelve months, and was not a usual resident before; an emigrant is the mirror case. Net migration is immigrants minus emigrants. Source: Ministry of Internal Affairs. Released about four months after the reference year.

## 6. Validation results

All checks below were run on the archived files on 2026-10-01.

| Check | Result |
| --- | --- |
| Natural increase equals births minus deaths | Exact in all 2,475 unit-year cells (Georgia, regions, municipalities, 1994–2025) |
| Georgia equals the sum of the 64 municipalities, population, at stored precision | 0 persons in every year 2015–2026 (starred city rows added for 2015–2017) |
| Each region row equals the sum of its municipalities, population | 0 persons, 2015–2026 |
| Same two checks for births, deaths and natural increase | Exact, 2014–2025 (starred city rows added for 2014–2016) |
| Age tables: ages sum to total; males plus females equal both sexes; single years rebuild the 5-year groups; totals equal table 01 | Exact in table 02 (1994–2026) and table 02-1 (2015–2026) |
| Migration totals: tables 32 and 33 agree; immigrants minus emigrants equal net migration (table 31); males plus females equal both sexes | Exact in every year 2012–2025; tables 32 and 31 also agree for 2002–2011 |
| Share aged 65+ and the three dependency ratios recomputed from table 02 | Within 0.0497 of Geostat's published values (rounded to one decimal; bound 0.05) |
| Crude birth, crude death, natural increase and net migration rates recomputed from counts and mid-year population | Within 0.049, 0.047, 0.045 and 0.048 (bound 0.05) |
| Infant mortality rate recomputed from infant deaths and live births | Within 0.044 (bound 0.05) |
| Total fertility rate equals 5 × the sum of the age-specific rates | Within 0.005 |
| Life expectancy: abridged table 27 against headline table 28 | Differs by up to 0.157 years (2009) because table 28 is actuarial from 2002. A method difference, not an error |
| Census anchor | 1 January 2025 value 3,930,428 less census count 3,929,581 = +847 persons over 48 days. All 58 municipalities matched to the census table are within ±1% of their census count (median −0.14%, largest 0.82%). This confirms the large 2024→2025 municipal moves (Khulo −42%, Ninotsminda +61%) are census counts |

Mid-year population equals the average of consecutive 1 January values in every year except 2024. Geostat publishes 3,699,557 for 2024, which is the average of 3,694,608 and the pre-census 3,704,506. Geostat's published 2024 rates therefore sit on the pre-census basis, and the 2025 rates on the census basis.

**Outside sources, compared once and not used.** On 2026-10-01 Geostat's figures were compared with Eurostat (`demo_pjan`, updated 2026-09-25), the World Bank (SP.POP.TOTL, release 2026-07-13) and UN World Population Prospects 2024. Eurostat and the World Bank mostly re-publish Geostat: Eurostat equals Geostat's 1 January population for 2018–2024, and the World Bank equals Geostat's mid-year population to within one person except in 2024. Neither has absorbed the census yet. Eurostat shows the pre-census 3,704,506 for 1 January 2025, and the World Bank's 2024 total (3,812,518) averages across the break. The UN model stays near 3.81 million for 2023–2026, so it cannot confirm Geostat's numbers. No file from these sources is archived, no value from them is used, and no check depends on them.

**Existing figures on the site.** The existing GDP per capita (`data/imports/gdp-overview-annual.csv`) implies 3,699.6k people for 2024 and 3,704.5k for 2025 (preliminary): Geostat's mid-year 2024 and the pre-census 1 January 2025. The shipped municipal budget-per-resident map uses the census-based 2025 values. Whether Geostat rebases per-capita GDP on the census is not stated; the repository already tracks a GDP revision scheduled for 2026-11-16.

## 7. Source anomalies and identity decisions for implementation

- **Stored precision against display.** Cells such as Tbilisi 2025 store `1335.671` (thousand) while the workbook's `#,##0.0` format displays `1,335.7`. Of 75 rows in 2025, 71 are stored to the person. Stored cells also carry float noise (Georgia 2025 is stored as `3930.4279999999999`); all 2,550 numeric cells of table 01 and 1,980 of table 02 are within 2×10⁻⁹ persons of a whole number, so converting thousands to integer persons by rounding is lossless. At stored precision the 64 municipalities sum to Georgia **exactly**, and the −0.3 to +0.5 thousand "published component rounding" recorded in `docs/data-methodology/municipal-population-regional-gdp.md` disappears. It comes from one-decimal values, not from Geostat's publication. The shipped `data/imports/municipal-population-2025.csv` holds one-decimal values (Tbilisi `1335.7`), a difference of up to 50 persons per municipality. It is unchanged by this audit. The demography reader must use stored values, with a test.
- **Four spelling variants** between table 01 (`Dedoplistsqaro`, `Tetritsqaro`, `Tqibuli`, `Tsqaltubo`) and tables 09, 19 and 29 (`Dedoplistskaro`, `Tetritskaro`, `Tkibuli`, `Tskaltubo`). The census table uses the second spelling and labels cities `C. Name`. Only reviewed aliases may bridge them; no fuzzy matching and no row-position joins, although the row order is identical across tables 01, 04, 09, 19 and 29.
- **Starred city rows** (Ozurgeti, Telavi, Mtskheta, Ambrolauri, Zugdidi, Akhaltsikhe, Gori) are published separately for population on 1 January 2015–2017, and for events during 2014–2016. In other years they are blank and the municipality row includes them. Events need their own component rule.
- **Stray zero**: table 29, `C. Gori*`, 2020, cell `AB85` holds `0` where births and deaths have no cell. Reviewed anomaly; it must not enter any total.
- **Rows outside the 64**: `Abkhazia A.R.`, `Ajara Municipality`, `Akhalgori`, `Eredvi`, `Tighva` and `Kurta` hold no values in 2014–2025 in the event tables and are not in the 64.
- **Infant mortality rate** is stored at full precision for early years and rounded to one decimal for recent years.
- **Citizenship rows change by year.** Table 33 lists 15 rows a year: `Total` and 14 categories. Nine labels appear in every year and 22 in at least one year (for example Armenia, India, China and Kazakhstan are listed in some years only), because only the countries large enough in that year are shown. `Other` therefore changes meaning from year to year, and a country missing from a year's list is inside `Other`, not zero. Store explicit rows only, never infer a zero, and do not treat `Other` as a comparable series.

## 8. Release calendar (Geostat, 2026)

| Date | Release |
| --- | --- |
| 27 March | Summary vital statistics 2025 (births, deaths, marriages, divorces) |
| 22 April | Population by region, municipality, urban-rural, sex and age, from the census results |
| 24 April | Population on 1 January 2026 and 2025 (recalculated); mid-year population 2025; international migration 2025; population by sex and age; main demographic indicators |
| 22 June | Results of the 2024 Population and Agricultural Census |
| 26 June | Deaths by causes 2025 |
| 11 September | Summary vital statistics, January–June 2026, preliminary (sub-annual, not collected) |
| 25 September | Publication "Vital Statistics Report 2025" |
| 16 October | Publication "Demographic Situation in Georgia 2025" (upcoming: check it for any statement on re-estimation) |

Refresh rhythm: vital events in late March, population and migration in April, each followed by the diff against the previous capture.

## 9. Decisions

Decided on 2026-10-01 after this review:

1. **Modelled years.** Start at the registered years: vital events from 2014 and migration from 2012. The 2014 and 2012 method changes become series start dates and do not appear inside the served data.
2. **Rates.** Carry total fertility rate, infant mortality rate, life expectancy and the crude birth and death rates. The natural increase rate, net migration rate, mid-year population and Geostat's published ratios stay validation inputs.
3. **Precision of the shipped municipal population file** (§7): left unchanged until the denominator policy is chosen.
4. **Single years of age** (table 02-1): stay as the original archived file; not in the dataset until a page needs school-age or pension-age groups.
5. **Population and age structure before 2015.** Geostat's metadata says the 2018 re-estimate covered "the main demographic indicators for the period 1994-2014", which includes the 1 January population, although table 01 carries no retro-projection footnote. Carried from 2004 with an explicit `retro_projection` flag for 1 January 2004–2014.
6. **Outside cross-checks dropped.** The Eurostat, World Bank and UN files were removed from the package and from the validation; §6 keeps a dated note. Geostat is the only source, and its Terms of Use (reviewed 2026-09-11) permit redistribution with credit.

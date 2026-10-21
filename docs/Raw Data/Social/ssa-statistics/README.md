# Social Service Agency (SSA) statistics: what is published

Surveyed on **16 October 2026** from the live statistics section of the Social Service Agency of Georgia (სსიპ სოციალური მომსახურების სააგენტო), <https://ssa.moh.gov.ge/statistiklist.php?lang=1&v=0>. The old address, ssa.gov.ge, now redirects there. Preliminary yearly money totals were added on 17 October 2026. Collection completed on **18 October 2026**: all **1,027 original workbooks** are preserved under `official/`. The extraction reports distinguish validation failures from inconsistencies already present in the published sources. Nothing here is served by the explorer.

## Collection and recovery status

`collection-status.json` records the current saved and missing file counts. `collection-inventory.csv` checks every table against the 1,027-file catalogue. `missing-files.csv` is now header-only: no downloads remain outstanding. Both CSVs use UTF-8 with BOM. Every file in `official/ssa-file-index.json` is marked `collected` after its saved bytes and fingerprint have been checked.

The recovery preserved 821 original workbooks and nine page captures from `ssa-statistics.zip`, byte for byte. `recovery-report.json` records the archive fingerprint and integrity check. The original ZIP manifest and index are retained under `official/recovery/`. Five `official/pages/ssa-links-*.json` files capture the remaining topics' links as observed in Chrome on 18 October; the historical topic was checked across all three pagination states. These are link inventories, not original HTML response captures.

`download-receipts.json` records subsequent Chrome downloads. Recovery fingerprints were calculated from the saved ZIP, and subsequent file fingerprints from the downloaded bytes; neither is represented as a fingerprint recorded by the earlier browser collector.

The previous chat stopped on 17 October at 14:30 Tbilisi time after reporting 856 downloaded files and requesting human verification. That browser count is not proof of files saved here. Only files present on disk and checked against their recorded fingerprints count as collected. The additional browser-storage copy has not been recovered.

The recovered archive supplied 821 workbooks; 206 subsequent Chrome downloads completed the collection. `recovery-validation.json`, `validation-report.json`, and `independent-validation.json` record separate source-integrity, extraction, and independent cell-comparison results. Do not substitute the older temporary-folder report for these package reports. The neighbouring Geostat package now has 46 comparisons with SSA's December national recipient figures, all matching; this is a bounded comparison, not a check of every Geostat cell.

Start with these files. The CSVs use UTF-8 with BOM, so they open correctly in Excel.

- `catalogue.csv` lists every table: Georgian and English title, first and last year, number of yearly files, layout, geography and breakdown.
- `browser-annual-amounts.csv` retains the original preliminary browser-read totals unchanged. The narrative figures below describe that research snapshot; use the generated tables and review notes for subsequent analysis.
- `annual-amounts.csv` contains 256 programme-year records for 22 programmes, with the number of observed months and the last recipient month retained.
- `ssa-national-annual.csv`, `ssa-programmes-monthly.csv`, and `ssa-programmes-areas-annual.csv` retain the broader national table values, monthly programme values with source columns, and annual area figures.
- `source-findings.csv` preserves differences between printed totals and sums of area rows, blank headings and working rows, the months where the social package people table's national row leaves a group cell blank or prints a total that differs from its groups (`sum_of_areas` then holds the groups' sum), and the rows where the subsistence allowance age bands (`tsa_allowance-03`) differ from `tsa_allowance-01`'s persons in the same month (`printed_total` holds the persons, `sum_of_areas` the bands: November 2023 Isani-Samgori, Tbilisi and Georgia are 1 above, and October 2014 Upper Abkhazia has no persons; no December differs); it does not replace official values with reconciled estimates.
- `reviewed-browser-differences.csv` documents five exact differences from the preliminary file, with the affected source cells and reasons. Validation rejects any changed or unused exception.

## Extraction decisions reviewed on 18 October 2026

- In the 2008 family-assistance count table, April–September add a money column after the recipient total. In the November 2011 state-assistance count table, copied category columns follow the total. Both recipient selectors now find the explicit `სულ` heading instead of assuming the final column is the total.
- Four source spellings are mapped explicitly in `area-mapping.csv`, with workbook, month and row evidence. The two misspellings of Ambrolauri refer to the former city; the municipality appears separately on the following row. Old Tbilisi variants remain district rows within Tbilisi.
- Excel's stored floating-point amounts are normalized to tetri before rounding annual programme totals to whole GEL. This resolves the one-lari difference for the 2025 large-family electricity subsidy without changing any source cell.
- March 2020 has a blank national recipient cell (`C86`) in both the high-mountain electricity and large-family electricity workbooks. Each has 11 observed recipient months and 12 money months. Blank is not zero. Average payments use only months with both observations, producing 11.94 GEL and 20.35 GEL respectively. The preliminary browser figures counted the missing month as zero; those four differences remain explicitly recorded.
- For 2011 state assistance, November's explicit recipient total is `E86 = 154`; the trailing `H86 = 66` is an "Other" category. Using 66 reproduces the preliminary annual average of 84.43 GEL. Using the total gives 138,463.79 GEL divided by 1,728 recipient-months, or 80.13 GEL. This fifth preliminary difference is documented separately.
- December 2008 subsistence allowance counts Akhalgori's 699 families inside the Mtskheta-Mtianeti subtotal (`B43:B47` sums to `B48 = 7,792`). Upper Abkhazia's 172 families (`B86`) are outside every regional subtotal. The regional sum of 131,010 plus 172 matches the national total of 131,182. The geographic check allows that documented coverage pattern without adding Akhalgori twice or relaxing its tolerance; municipal checks still include all excluded-area rows.
- Two extra source links have no usable year label: `ssa-pension-02-extra-20240408045112.xlsx` and `ssa-compensation-03-extra-20260908111729.xlsx`. They are preserved and fingerprinted but excluded from year-based extraction. Do not assign their years from upload timestamps.
- The independent SheetJS reader limits its scan to columns containing numeric cells. Some source sheets declare all 16,384 Excel columns as used; scanning every empty column caused the earlier long-running check. A controlled workbook test checks both successful verification and rejection of a changed value.

Reproduce the package with `python -B prepare.py`, then `node verify_independent.mjs --write`, and run `python -B -m unittest discover -p "test_*.py"`. `python -B prepare.py --check` checks that generated files match a fresh rebuild. Rebuild the neighbouring Geostat package afterwards to refresh `ssa-cross-check.csv`.

Source collection and successful extraction checks do not approve these data for the public explorer. Before choosing indicators or visualisations, review the relevant source findings, partial years, programme overlaps, the September 2012 pension-system break, and the two unlabelled source versions.

## Served file

`ssa-served-annual.csv` (UTF-8 with BOM) holds the 2013–2025 yearly values the Pensions, Subsistence allowance, Social package and Social payments pages are built from: 24,451 rows, one for each programme, measure, place and year. Every value keeps the workbook, sheet and cells it is read from. `prepare.py` writes it, `--check` covers it, and `verify_independent.mjs` reads every row's cells again with SheetJS.

| Column | Meaning |
| --- | --- |
| `programme` | The package's programme id, as in `annual-amounts.csv`, plus `tsa_registered` (families and persons registered in the targeted social assistance database, table `tsa_db-01`) and `social_package_group`. |
| `measure` | `recipients` (the December count; families for `subsistence_allowance` and `tsa_registered`), `persons`, `employment_families`, `amount` (the sum of the monthly "amount transferred"), `employment_amount`, `regular_amount`, `count_months_sum`, `regular_count_months_sum`, and `group.<group>.recipients` / `group.<group>.amount` / `group.<group>.count_months_sum`, and `age.<band>.persons` (subsistence allowance people by age band). |
| `geography_id` | The site's own ids. `country.georgia` is SSA's national total row. `region.<id>` is SSA's printed region subtotal row, and `region.tbilisi` SSA's Tbilisi total row. Two-digit municipality codes add up the SSA rows `area-mapping.csv` assigns to that municipality. `unit.akhalgori` covers both Akhalgori labels and `unit.upper_abkhazia` the Upper Abkhazia row. Tbilisi is never served as municipality `04`. |
| `months` | How many monthly sheets (or month columns) the value is read from: 1 for a December count. A year SSA published in part keeps its published months, for example workplace injury 2013 (9), COVID-19 compensation 2020 and 2021 (6 each) and the high-mountain supplements 2016 (4). |
| `value_status` | `official` for one printed cell, `calculated` for anything the package adds up: a 12-month sum, a month-count sum, a municipality made of several SSA rows, and the calculated social package groups. |
| `source_table`, `source_workbook` | The table id and the file in `official/workbooks/`. |
| `source_sheet`, `source_cell` | The sheet, or `*` for the monthly sheets. Cells joined with `+` are added. With `*`, `source_cell` is either the same cells on every monthly sheet or, where SSA moved them between months, `Sheet!cells` items separated by `;`. |

What is served:

- **Pensions** (`pension`, `pension_idp`, `pension_highmountain`) and **subsistence allowance**, nationally and for every region, municipality and unit. `tsa_registered`: `recipients` and `persons` for the same places. The registered counts are also in `ssa-programmes-areas-annual.csv`.
- Pensions: `recipients`, `amount`, and `count_months_sum`, which adds the monthly recipient counts over the months that also have money. The average monthly payment is `amount / count_months_sum`.
- Subsistence allowance: `recipients` and `persons` are the regular recipients. From 2022 `employment_families` counts the families kept on the allowance through the employment programme. `amount` includes the employment programme's money and `employment_amount` is that part. `regular_amount = amount - employment_amount`, and `regular_count_months_sum` adds the monthly regular family counts. The average per family is `regular_amount / regular_count_months_sum`.
- Subsistence allowance by age group: `age.<band>.persons`, the December count of the people in receiving families in each of SSA's eight bands in table `tsa_allowance-03` (`0_6`, `6_18`, `18_30`, `30_40`, `40_60`, `60_65`, `65_70`, and `70_plus` for "70 და მეტი"), for the same places. The bands are the same on every sheet from 2012 to 2026 and are matched by heading (`TSA_AGE_BANDS`); an unknown or missing band stops preparation. From December 2022 the employment-programme people have eight bands of their own, which are not read, as `persons` leaves them out. `validate_served` fails unless the eight bands add up to `persons` in every place and year; they do in every December.
- **Social package**, nationally: `recipients`, `amount` and `count_months_sum`, and the eligibility groups as `social_package_group`. Each group has `recipients`, `amount` and `count_months_sum`, which adds the group's monthly people counts over the months that also have its money, with the same column mapping as its December count. A group's average monthly benefit is `group.<group>.amount / group.<group>.count_months_sum`. `group.total.count_months_sum` equals `count_months_sum`.
- The **other programmes** on the Social payments page: national `amount` only. No recipient counts are served for them, so the two blank March 2020 counts of the electricity programmes are not used here.

**Social package groups.** SSA prints one column for each eligibility group. The groups `disability`, `survivors`, `war_participants`, `political_repression` and `other` partition SSA's printed total every year. The disability severity columns are parts of `disability` and are not added to the partition. The checks confirm both, in people and in money, and the partition also in the yearly month-count sums. Each SSA design maps as follows:

| Design (both tables) | Printed columns |
| --- | --- |
| January 2013 – September 2017 | People with disabilities (შეზღუდული შესაძლებლობის მქონე პირები) → `disability`; survivors (მარჩენალ დაკარგული ოჯახის წევრი) → `survivors`; political repression (პოლიტ. რეპრესირებულები) → `political_repression`; compensation recipients, utility-subsidy recipients and "other" (სახელმწიფო კომპესაციის მიმღებები, საყოფაცხოვრებო სუბსიდიის მიმღებები, სხვა) → `other`; სულ → `total`. |
| October 2017 – May 2019 | Four columns are printed before people with disabilities and add up to it: 0-18 წლამდე შშმ პირი → `disability_children`; მკვეთრად, მნიშვნელოვნად and ზომიერად გამოხატული ხარისხის მქონე შშმ პირი → `disability_severe`, `disability_significant`, `disability_moderate`. The rest as before. |
| June 2019 – December 2021 | War participants (ომის მონაწილეები) are added as their own part of the total, not a breakdown of another column → `war_participants`. |
| 2022 – 2024 | The utility-subsidy column is gone: `other` is compensation recipients and "other". |
| 2025 | Each group has breakdown columns (social package recipient, state compensation recipient, disabled from childhood) and a "/ სულ" total. Only the "/ სულ" columns are read. `disability` is the four severity "/ სულ" columns added (`calculated`; 2025 December: 18,819 + 32,151 + 73,514 + 5,998). `other` is defence veterans (თავდაცვის ძალების ვეტერანები) and social package by acquired right (სოციალური პაკეტი მოპოვებული უფლებით). |

Columns are matched by heading on every monthly sheet, because SSA changed the design in the middle of 2017 and 2019. A heading not in this mapping stops preparation. Five source points are handled explicitly:

- **2019 money headings (reviewed override).** In January–May 2019 the money table (`socpackage-02`) already prints the June design's heading "war participants" over column J. For the same column, the people table (`socpackage-01`) prints utility-subsidy recipients, and it has no war participants until June 2019. Column J's money is a steady 22.45 GEL a month per utility-subsidy recipient, and the money table has no other utility-subsidy column in those months. `HEADING_OVERRIDES` in `prepare.py` therefore uses the people table's heading for those five money sheets. The 746,479 GEL is in `other`, and `group.war_participants.amount` 2019 covers June–December (`months` 7). An override that no longer matches its sheet's printed heading stops preparation.
- **May 2022 money total.** SSA's printed total (`socpackage-02` L85, 27,464,062.75 GEL) is 56 GEL less than its own group columns F:K. That printed total is served. The partition check allows exactly this recorded difference, and no other.
- **2017 severity money** covers October–December only (`months` 3), because the columns start in October 2017. The December 2017 counts are complete.
- **May 2021 people total.** SSA's printed total (`socpackage-01` M91, 176,572) is 1 more than its own group columns F:L (176,571). The printed total is used, so the groups' 2021 month-count sums add up to 1 less than the total's. The partition check allows exactly this recorded difference (a `source-findings.csv` row).
- **July 2022 moderate disability count.** SSA's national row leaves the moderate-disability cell blank (`socpackage-01` July E85; the area rows above it are filled). Blank is not zero: `group.disability_moderate.count_months_sum` 2022 covers 11 months while its money covers 12, so no 2022 average is calculated for that group (a `source-findings.csv` row).

## In short

- **13 topics, 86 tables, 1,027 Excel files.** Every file is `.xlsx`. There are no CSV files, PDF reports, API or English versions. The English page of the statistics section is empty.
- **Monthly data from 2008 to September 2026.** Each yearly file has one sheet per month. The 2026 files run January–September. Most tables were last updated on **8 October 2026**, so SSA seems to publish about a week after each month ends.
- **Down to municipality level.** 74 of the 86 tables have one row per municipality (the old "რაიონი" names), with region subtotals and a national total. Eight are national by benefit type or age, one is by medical institution, and three were not checked.
- **Two kinds of number.** Counts of people or families, and money in lari per month. Money comes as the "amount required" (საჭირო თანხა), the "amount transferred" (გადარიცხული თანხა), or both.
- **The money adds up to about 6.0 billion GEL in 2025** across the eight main programmes. Pensions were 4.26 billion GEL, the social package 544 million GEL and the subsistence allowance 855 million GEL. In 2013 the same programmes came to 1.6 billion GEL. The yearly series are in "Money paid, by year".

## The 13 topics

| # | Topic (Georgian) | Topic (English) | Tables | Years | Files |
| --- | --- | --- | --- | --- | --- |
| 1 | სახელმწიფო პენსია | State pension | 5 | Sept 2012 – Sept 2026 | 59 |
| 2 | სოციალური პაკეტი | Social package (disability, survivor and other benefits) | 11 | 2012 – 2026 | 148 |
| 3 | შრომითი მოვალეობის შესრულებისას ... ზიანის ანაზღაურება | Workplace-injury compensation | 3 | 2013 – 2026 | 41 |
| 4 | სახელმწიფო კომპენსაცია და აკადემიური სტიპენდია | State compensation and academic stipend | 5 | 2008 – 2026 | 73 |
| 5 | საყოფაცხოვრებო სუბსიდია | Household (utility) subsidy | 5 | 2009 – 2026 | 85 |
| 6 | მიზნობრივი სოციალური დახმარების პროგრამის მონაცემთა ბაზა | Targeted social assistance database: registered families | 10 | 2008 – 2026 | 186 |
| 7 | საარსებო შემწეობა | Subsistence allowance (the TSA cash benefit) | 11 | 2008 – 2026 | 181 |
| 8 | დემოგრაფიული მდგომარეობის გაუმჯობესების ... პროგრამა | Demographic support (benefits for 3rd+ children, and for all children in high-mountain areas) | 4 | 2014 – 2026 | 48 |
| 9 | მაღალმთიან დასახლებაში მუდმივად მცხოვრები პირების დახმარება | High-mountain settlement support (doctors' and nurses' supplements, electricity discount) | 3 | 2016 – 2026 | 32 |
| 10 | იძულებით გადაადგილებული პირის ... და ლტოლვილის შემწეობა | IDP and refugee allowance | 3 | 2010 – 2026 | 47 |
| 11 | ორსულობის, მშობიარობის, ბავშვის მოვლის ... დახმარება | Maternity, childcare and adoption benefit | 3 | 2010 – 2026 | 21 |
| 12 | სხვა პროგრამები | Other programmes (electricity and water subsidies, COVID-19 compensation) | 5 | 2015 – 2026 | 29 |
| 13 | სტატისტიკა 2012 წლის 1 სექტემბრამდე | Archive: pensions and family assistance before 1 September 2012 | 18 | 2008 – Aug 2012 | 77 |

## What each topic contains

Breakdowns are listed in the order SSA shows the tables. See `catalogue.csv` for the exact years of each table.

**1. State pension.** Recipients with the amount required and the amount transferred, by municipality. The same for pensioners with IDP status. Recipients by age and sex. The high-mountain pension supplement (from 2016). High-mountain pensioners by age and sex (new, 2025–2026). The current pension tables start in **September 2012**. January 2008 – August 2012 is in topic 13, in a different table design: by pension type, plus suspensions by reason.

**2. Social package.** This is the benefit for people with disabilities, survivors and some other groups. Recipients and amounts by eligibility group (the legal basis of the award), and the same for IDP-status recipients. By sex and age. By monthly benefit amount, nationally and by municipality. The high-mountain supplement (from 2016). Recipients with disability status (new, 2025–2026).

**3. Workplace-injury compensation.** Beneficiaries by age group, by assigned-amount band (from 2014), and amount transferred. All by municipality.

**4. State compensation and academic stipend.** These are special payments to former employees of certain state bodies, and academic stipends. Recipients, monthly amount required and monthly amount transferred, by former employing agency. By sex and age (from 2014). By legal basis (2024–2026).

**5. Household (utility) subsidy.** Recipients and amount transferred by subsidy amount. By sex and age (from 2014). By subsidy category, which corresponds to the clause of the decree. The category tables start with an explanations sheet.

**6. Targeted social assistance database.** This is everyone who has applied and been scored, whether or not they receive money. Registered families and persons by age, by household size, by rating-score band, by sex and by disability. Also by registration period, and declarations filed by year (one sheet, years from 2005 as columns).

**7. Subsistence allowance.** This is the TSA cash benefit paid to families below the score threshold. Recipient families and persons. A separate column counts families kept on the benefit under the public-employment support programme. Amount transferred, split **urban / rural**. Recipients by age group, sex and household size. IDP recipients. Eligible families and persons who were *not* paid, with the reason (e.g. suspension). Recipients by rating-score band (from 2016), and children under 16 by score band (from 2017).

**8. Demographic support programme.** Families receiving the benefit for a third or later child, by parent's age. Those children by sex, with the amount transferred. The high-mountain version, which covers first and second children too (from 2016).

**9. High-mountain settlement support.** Doctors, nurses and village doctors or nurses receiving a salary supplement, by municipality and by employing medical institution. Residents receiving the electricity discount (from 2017).

**10. IDP and refugee allowance.** Recipients and amount transferred (from 2010). By sex and age (from 2014).

**11. Maternity, childcare and adoption benefit.** Cases by parent's age with the amount transferred (2014–2026). Cases and amounts by month for 2010–2013, one sheet with months as columns.

**12. Other programmes.** Subsidy for the electricity tariff increase (2015–2026). Electricity subsidy for parents of large families (2019–2026). Water and sewerage subsidy (2021–2026; last updated 8 July 2026, so it lags the rest). Two COVID-19 compensation tables (2020–2021), both finished.

**13. Archive before 1 September 2012.** Pensions by type, amount, sex, age group, district and suspension reason. The length-of-service supplement. Family assistance (საოჯახო დახმარება, the cash benefit TSA replaced) by category and transfer period. State assistance (55 and 110 GEL payments, 2011–2012).

## Headline figures, September 2026

Read directly from SSA's 2026 workbooks (national total row, last sheet):

- **State pension:** 905,183 recipients. 395.6 million GEL required and 398.0 million GEL transferred in the month.
- **Subsistence allowance:** 106,276 families and 405,462 people. Another 31,383 families and 141,653 people are counted under the public-employment support programme. For comparison, December 2008 had 131,182 families and 370,901 people.

These are single-month figures. They have not been reconciled with the budget or with Geostat.

## Money paid, by year

Yes: SSA publishes the money as well as the headcounts. Every programme has a monthly "amount transferred" (გადარიცხული თანხა). The pension tables also give the "amount required". The tables below add the 12 monthly national totals into a yearly total. They were built from every yearly file of the 36 money and recipient tables, 17 October 2026.

**Lari paid per year, in millions (amount transferred)**

| Year | Pension | Social package | Subsistence allowance | IDP & refugee | Compensation & stipend | Maternity | Utility subsidy | 3rd+ child | Sum of these |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2008 | 647.5† |  | 82.3 |  |  |  |  |  | 730 |
| 2009 | 741.7† |  | 136.8 |  | 7.11 (2 mo) |  | 7.04 (4 mo) |  | 893 |
| 2010 | 781.4† |  | 146.7 | 68.7 | 40.6 | 5.58 | 20.1 |  | 1,063 |
| 2011 | 829.8† |  | 139.6 | 70.6 | 38.7 | 4.93 | 18.6 |  | 1,102 |
| 2012 | 627.5† + 332.8 | 47.6 (4 mo) | 140.9 | 73.2 | 36.4 | 5.22 | 14.6 |  | 1,278 |
| 2013 | 1,094.7 | 164.1 | 214.0 | 75.8 | 54.4 | 5.47 | 8.09 |  | 1,617 |
| 2014 | 1,257.1 | 201.8 | 281.1 | 109.0 | 78.3 | 10.9 | 7.40 | 0.87 (6 mo) | 1,947 |
| 2015 | 1,303.7 | 205.1 | 253.6 | 121.5 | 95.8 | 12.7 | 6.74 | 6.80 | 2,006 |
| 2016 | 1,469.0 | 216.9 | 270.2 | 121.4 | 102.6 | 13.5 | 6.16 | 12.6 | 2,212 |
| 2017 | 1,579.1 | 224.8 | 257.8 | 123.8 | 107.2 | 13.1 | 5.66 | 13.5 | 2,325 |
| 2018 | 1,608.3 | 223.6 | 250.8 | 123.4 | 108.7 | 13.4 | 5.29 | 13.6 | 2,347 |
| 2019 | 1,824.0 | 250.6 | 319.6 | 122.8 | 113.9 | 13.5 | 4.98 | 13.5 | 2,663 |
| 2020 | 2,128.7 | 288.8 | 339.3 | 121.1 | 118.5 | 12.7 | 4.76 | 13.7 | 3,028 |
| 2021 | 2,450.1 | 300.0 | 440.7 | 117.0 | 122.0 | 13.4 | 4.53 | 15.4 | 3,463 |
| 2022 | 2,698.7 | 339.4 | 620.9 | 111.3 | 126.2 | 13.4 | 15.4 | 15.3 | 3,941 |
| 2023 | 3,303.6 | 416.4 | 749.3 | 106.6 | 133.8 | 24.5 | 16.1 | 13.9 | 4,764 |
| 2024 | 3,782.4 | 475.1 | 828.8 | 104.0 | 166.5 | 25.6 | 20.0 | 17.5 | 5,420 |
| 2025 | 4,262.3 | 544.2 | 855.3 | 101.0 | 193.8 | 25.0 | 21.1 | 20.5 | 6,023 |
| 2026, Jan–Sep | 3,544.5 | 449.5 | 575.8 | 77.2 | 154.4 | 18.0 | 16.6 | 13.2 | 4,849 |

"(n mo)" means SSA published only n months for that year, usually because the programme or table started mid-year. † Before September 2012 the pension figure covers **all pension types**: old-age, disability, survivor, political-repression and long-service pensions. From September 2012, disability and survivor payments moved to the social package, so the two series do not join. 2012 shows both parts.

**How much each group gets: 2025**

| Programme | Recipients, Dec 2025 | Average per recipient per month (GEL) | Paid in 2025 (million GEL) |
| --- | --- | --- | --- |
| State pension | 888,518 people | 405 | 4,262.3 |
| — of which IDP-status pensioners | 41,441 | 408 | 200.1 |
| — high-mountain pension supplement | 86,126 | 82 (on top of the pension) | 83.3 |
| Social package (disability, survivors, veterans, etc.) | 187,764 people | 243 | 544.2 |
| — high-mountain social package supplement | 15,793 | 52 (on top) | 9.8 |
| Subsistence allowance | 129,506 families (463,122 people) | 370 per family | 855.3 |
| State compensation and academic stipend | 23,238 people | 703 | 193.8 |
| IDP and refugee allowance | 185,389 people | 45 | 101.0 |
| Maternity, childcare and adoption | 12,737 cases in the year | 1,959 per case (one-off) | 25.0 |
| Utility subsidy | 22,539 people | 80 | 21.1 |
| Child benefit, 3rd and later child | 10,611 children | 155 | 20.5 |
| Electricity tariff subsidy | 183,482 subscribers | 6 | 16.4 |
| High-mountain electricity discount | 84,487 subscribers | 12 | 12.1 |
| High-mountain doctors' and nurses' supplement | 1,672 staff | 510 | 10.3 |
| High-mountain child benefit | 3,470 children | 148 | 6.4 |
| Water and sewerage subsidy | 23,369 subscribers | 10 | 2.8 |
| Electricity subsidy, large families | 4,989 | 18 | 1.0 |
| Workplace-injury compensation | 477 people | 125 | 0.7 |

How these figures were calculated (all are in `annual-amounts.csv`, one row per programme and year):

- **Money** (`amount_gel`) is the sum of the monthly "amount transferred" totals. `amount_months` says how many months it covers.
- **Recipients** is a December snapshot, or the latest month published that year (`recipients_month`). For maternity it is the year's total of cases, because each case is a one-off payment.
- **Average per month** (`avg_monthly_gel`) is the year's money divided by the year's total of monthly recipient counts. It is the average payment one recipient received per month. For maternity it is the average payment per case.
- **Subsistence allowance from 2022** adds a second group. Families who found work under the public-employment support programme keep their status and payments for up to four years. Their money is included in the yearly total and shown separately in `amount_emp_gel`: 280.8 million GEL in 2025, for 54,842 families in December. The family count and the 370 GEL average cover the regular recipients only.
- **2020 electricity subsidies** were barely paid in March–May and November–December 2020, when the state covered household electricity bills during COVID. So December 2020 recipient counts for the two electricity programmes look abnormally low. That is genuine, not an error.
- **COVID-19 payments** to socially vulnerable and disabled people were 90.8 million GEL in 2020 (6 months) and 102.2 million GEL in 2021 (6 months). They are in the CSV but not in the tables above.
- **Other things to know:**
  - Pre-2012 family assistance and state assistance are in the CSV as well.
  - Programme totals overlap: a pensioner can also get the high-mountain supplement or the subsistence allowance. Do not add recipients across programmes.
  - These are SSA's own monthly totals. They have not been reconciled with the treasury's budget execution figures, and the yearly sums are calculated here, not published by SSA.

## Things to know before using the data

1. **Monthly stocks and monthly flows mixed together.** Counts are the number of people paid in a month. Money is that month's payment. An annual figure needs a rule, such as December (or the average month) for counts and the sum of 12 months for money. That is a decision, and SSA does not publish one.
2. **"Required" and "transferred" differ.** In September 2026 the pension amount transferred was 2.4 million GEL more than the amount required. Pick one consistently. "Transferred" is closer to actual spending.
3. **A break in September 2012.** That is when SSA redesigned its tables. The 2012 files in the current section contain only September–December. The earlier months are in the archive topic in a different design, so the two do not join directly.
4. **Old Georgian font encoding.** At least the 2008 files use a pre-Unicode Georgian font, so text reads as `ÓÖË` instead of `სულ`. Files from 2010 onwards are normal Unicode. Converting the old files needs a font-mapping step.
5. **Layouts shift between years.** The number of header rows varies. Some files have an explanations sheet, and some have 23–24 sheets because month names appear twice, in Georgian and English. A few tables use months or years as columns instead of separate sheets. Each table will need its own reader, checked year by year.
6. **Geography is not the current municipality list.** Rows use old "rayon" names. Tbilisi is split into five combined districts (e.g. Gldani-Nadzaladevi, Vake-Saburtalo), not its ten current districts. Matching rows to `data/imports/municipalities.csv` needs a reviewed mapping.
7. **The site blocks automated downloads.** Cloudflare refuses plain scripts outright (HTTP 403) and blocked even a real browser after a few dozen quick requests, for about a minute. Collecting the 1,027 files needs a slow, browser-based download and source fingerprints, as the other research packages have.
8. **Filenames are not stable.** Each upload gets a timestamp prefix, such as `20261008024830-1.1.1-2026.xlsx`. The current year's file gets a new URL every month. Source links should point to the statistics page, or be refreshed on each import.
9. **Georgian only.** All titles and labels need English translations. The English titles in `catalogue.csv` are working translations, not official ones.

## Fit with Fiscal.ge

- The **Health and social protection** hub (`/explorer/health`, approved 2026-10-15) says pensions and social help "may become later cards and are not shown now" (`Project_Definition.md`). This catalogue is the source survey for that decision. Pensions and social help are outside the approved scope until the owner approves them.
- What the project already has nearby: budget spending on social protection (`spending.social_protection` and SSA's programme lines in the ministry spending data), Geostat's household income source `income.pensions_assistance`, and poverty rates. None of it has recipient counts or municipal detail. SSA is the only source here for those.
- The project rules allow only annual data (plus the approved monthly inflation set), so monthly SSA data would have to be turned into annual figures. That is the decision in point 1 above.

**Candidates for a first dataset**, if the owner wants one: state pension (recipients and amount), subsistence allowance (families, persons, amount), social package (recipients and amount), utility subsidy, and IDP allowance. Each is national and municipal, monthly from 2012 or earlier, and current to September 2026.

## How this survey was made

The statistics section was read in Chrome on 16 October 2026: its 13 topic pages, the title and yearly file links of every table, and the "updated" (განახლებულია) date. One recent workbook per table was opened in the browser to record its sheets, header row and whether rows are municipalities. The 2026 pension, subsistence-allowance, social-package and utility-subsidy workbooks were read for the latest month and totals. Older files were checked for 2008–2016 (encoding) and 2012 (sheet coverage). All 1,027 workbooks were later saved to `official/workbooks/` and checked against SSA's file index (see `official/ssa-file-index.json` and `../storage-verification.json`).

The money section was built on 17 October 2026 by reading every yearly file of 36 tables in Chrome: 378 workbooks, with one request every few seconds to stay under Cloudflare's limit. From each visible monthly sheet, the national total row (სულ) was taken. Hidden sheets were skipped: some files keep hidden copies of the previous year's months. Each month was counted once, including SSA's misspelled sheet names ("Jenuary", "Ferbuary", "Junly", "desember"). The column for each table was chosen from its headers, year by year. Three layout changes needed separate handling: the subsistence allowance money table (from December 2022), the doctors' and nurses' table (a paramedics column added in 2019), and the social package tables (columns by legal basis from 2025). The CSV was then checked against the in-browser totals for every programme: same row count, same money, recipient and average totals.

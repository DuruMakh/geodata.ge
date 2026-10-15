# Annual healthcare and causes of death (Geostat)

Research package for the Fiscal.ge Health hub. Approved design: `docs/superpowers/specs/2026-10-15-health-design.md` (sections 7 and 8). Everything here is reproducible from the files in `official/`, which are never edited.

## Sources

All were retrieved on 2026-10-15 from Geostat, the National Statistics Office of Georgia, with `curl -L` from the cloud workspace (the first request for `Main-characteristics-of-public-health.xlsx` was reset and succeeded on the retry). Each workbook was fetched again from its `geostat.ge/media` link and its bytes matched the copy first saved in the project's source folder (`/mnt/project-files/health-sources/`). Exact URLs, SHA-256 hashes and byte sizes are in `source-manifest.csv` and `source-manifest.json`. The two page captures are archival and are not compared byte for byte.

- **Healthcare page** (`https://www.geostat.ge/en/modules/categories/54`): 21 workbooks in `official/`, capture `official/health-page.html` (`geostat_health_page`).
- **Deaths page** (`https://www.geostat.ge/en/modules/categories/320`): 13 workbooks in `official/deaths/`, capture `official/deaths-page.html` (`geostat_deaths_page`).

Every workbook has one sheet, named `1`. Eleven are served; the other 23 are archived for provenance and no value is read from them, each under the ID `geostat_health_<file stem>` or `geostat_deaths_<file stem>` (lower case, every run of other characters becomes `_`).

| Source ID | Local file | Served |
| --- | --- | --- |
| `geostat_health_physicians` | `Number-of-physicians-by-occupations.xlsx` | doctors and 14 specialities, 2002-2025 |
| `geostat_health_nurses` | `Number-of-paramedical-personnel-by-basic-specialities.xlsx` | nurses and 6 sub-groups |
| `geostat_health_main` | `Main-characteristics-of-public-health.xlsx` | hospitals, out-patient clinics, beds, visits; its two staff rows (in thousands) are read only to check the staff totals |
| `geostat_health_morbidity_groups` | `Morbidity-with-acute-and-chronic-diseases-by-main-disease-groups.xlsx` | 19 disease groups |
| `geostat_health_tuberculosis`, `_hiv`, `_diabetes`, `_anaemia`, `_sti` | `Morbidity-of-patients-with-tuberculosis.xlsx`, `Morbidity-of-patients-with-HIV-AIDS.xlsx`, `New-Cases-of-Diabetes-Mellitus.xlsx`, `New-Cases-of-Anemia.xlsx`, `Morbidity-of-patients-with-syphilis-and-gonorrheae.xlsx` | new cases of each |
| `geostat_deaths_by_cause_region` | `deaths/23-2-deaths-by-chapters-regions.xlsx` | deaths by ICD-10 chapter, Georgia and 11 regions, 2014-2025 |
| `geostat_death_rate_region` | `deaths/24-1-Crude-death-rate-by-regions.xlsx` | crude death rate per 1,000, Georgia and 11 regions, 2014-2025 |

Archived only: abortions, emergency care, children's illnesses, infectious diseases by type, circulatory and respiratory systems (2020+), medicines, disability programmes, cancer screening, deaths by sex, urban/rural, age and cause, maternal, infant, under-5 and suicide tables. The 1994-2013 columns of the death-rate table are in the archived workbook but are not served: Geostat says they are retro-projections and registered data start in 2014, which is also where the causes of death start.

## Outputs

- `health-annual.csv`: the 4,204 served observations. Columns: `year, indicator_id, area_id, value, published_value, unit, basis, value_status, source_id, source_sheet, source_cell, source_number_format`.
  - `value` is the cell's exact stored decimal token (for example `500.35899999999998` and `11.260579422224215`). One cell is printed as text with footnote asterisks, `34***` (Georgia, pregnancy and childbirth deaths, 2021, `J20`): its `value` is `34` and the footnote is listed in `validation-report.json`.
  - `published_value` is the value at the precision Geostat prints, after cutting the stored value to 15 significant digits as Excel does:
    - **Counts** (`persons`, `units`) follow their zero-decimal format (`0`, `#\ ##0`, `##\ ###`, `#,##0`), half up. A `General` cell shows the stored value. Every served count is a whole number.
    - **The death rate** (`per_1000_population`) follows its `#,##0.0` format, half up. The cells hold unrounded doubles, so Georgia 2025 is `11.260579422224215` and publishes as `11.3`, and Racha-Lechkhumi and Kvemo Svaneti 2025 publishes as `19.7`.
    - **Figures in thousands** (`persons_thousand`, `units_thousand`, `visits_thousand`) keep the three decimals Geostat stores, which is one person, unit or visit: respiratory illness 2025 publishes as `500.359`, beds as `15.232` and visits as `16760.072`. Their cells carry `0.0` or `#\ ##0` formats that only trim the display, and the design spec's anchors (section 7) use the three-decimal figures. If the one-decimal display were wanted instead, the rule lives in `display()` in `prepare.py` and in `shown()` in `verify_independent.mjs`.
  - `unit` is `persons`, `persons_thousand`, `units`, `units_thousand`, `visits_thousand` or `per_1000_population`; `basis` is `actual`; `value_status` is `published`.
  - `area_id` is `georgia` or an existing `region.*` ID.
- `health-series-breaks.csv`: the four counting changes of design section 8, in the demography format (`break_id, applies_to, reference_date, reason, source_note`). `applies_to` is `;`-separated indicator IDs and each reason quotes the Geostat footnote.
- `coverage.csv`: for each indicator and area the first and last year, the count and the years the table's own year headings cover but no value is served for (for example `health.illness.nervous_sense_organs`: `2006-2025`, and the four older nurse groups: `2012-2025`).
- `validation-report.json` (from `prepare.py`) and `independent-validation.json` (from `verify_independent.mjs`).

Served rows by family: staff 472, facilities and visits 96, illness 540, deaths by cause 2,952, death rate 144, in all 4,204.

## Cell map

`prepare.py` finds every row by its printed label and every column by its year heading, never by fixed position. Labels are matched exactly after collapsing whitespace, so a stray space or non-breaking space does not matter but a different spelling does. The year columns are the heading row's year cells.

| Indicator IDs | Workbook, row | Area | Unit | Years | Rows |
| --- | --- | --- | --- | --- | --- |
| `health.staff.doctors`; `health.staff.doctors_{internal, surgery, obgyn, paediatrics, eye, ent, neurology, psychiatry, tuberculosis, dermatovenereology, radiology, rehabilitation, dentistry, other}` | physicians: `Physicians, total` and the 14 rows after `of which:` | georgia | persons | 2002-2025 | 360 |
| `health.staff.nurses`; `health.staff.nurses_{midwives, medical, doctor_assistants, lab_assistants, xray_assistants, other}` | nurses: `Total` and the 6 rows after `of which:` (Geostat's `obstetricians` are midwives) | georgia | persons | totals, midwives, medical 2002-2025; the other four 2002-2011 | 112 |
| `health.facilities.hospitals`, `health.facilities.outpatient_clinics` | main: `Number of hospitals and medical centers, unit`, `Number of medical institutions rendering out-patient services to population, unit` | georgia | units | 2002-2025 | 48 |
| `health.facilities.beds` | main: `Number of hospital beds, thsd.` | georgia | units_thousand | 2002-2025 | 24 |
| `health.visits.outpatient` | main: `Number of visits in medical institutions rendering out-patient services to population (including prophylactics), thsd.` | georgia | visits_thousand | 2002-2025 | 24 |
| `health.illness.{infectious, cancer, blood, endocrine, mental, nervous_sense_organs, nervous, eye, ear, circulatory, respiratory, digestive, skin, musculoskeletal, urogenital, pregnancy, perinatal, congenital, injuries}` | morbidity groups: the 19 rows in sheet order | georgia | persons_thousand | `nervous_sense_organs` 2002-2005; `nervous`, `eye`, `ear` 2006-2025; the other 15 2002-2025 | 424 |
| `health.illness.tuberculosis` | `of which new cases` (first occurrence) | georgia | persons | 2002-2025 | 24 |
| `health.illness.hiv` | `of which new cases from total number` | georgia | persons | 2002-2025 | 24 |
| `health.illness.diabetes`, `health.illness.anaemia` | each workbook's `Total` | georgia | persons | 2016-2025 | 20 |
| `health.illness.syphilis`, `health.illness.gonorrhoea` | `syphilis`, `gonorrheae` (first occurrence) | georgia | persons | 2002-2025 | 48 |
| `health.deaths.total`; `health.deaths.{infectious, cancer, blood, endocrine, mental, nervous, eye, ear, circulatory, respiratory, digestive, skin, musculoskeletal, urogenital, pregnancy, perinatal, congenital, ill_defined, external, covid19}` | 23-2: each area block's header row (the total), then chapters I-XIX and XXII by Roman numeral (XVIII is `ill_defined`, XIX `external`, XXII `covid19`) | georgia + 11 regions | persons | 2014-2025; `covid19` 2020-2025 | 2,952 |
| `health.death_rate.total` | 24-1: rows `Georgia` and the 11 regions | georgia + 11 regions | per_1000_population | 2014-2025 | 144 |

Area names, as Geostat prints them (both tables): `Georgia` -> `georgia`; `Tbilisi` (24-1 prints `C. Tbilisi`), `Adjara A.R.`, `Guria`, `Imereti`, `Kakheti`, `Mtskheta-Mtianeti`, `Racha-Lechkhumi and Kvemo Svaneti`, `Samegrelo-Zemo Svaneti`, `Samtskhe-Javakheti`, `Kvemo Kartli`, `Shida Kartli` -> `region.tbilisi`, `region.adjara`, `region.guria`, `region.imereti`, `region.kakheti`, `region.mtskheta_mtianeti`, `region.racha_lechkhumi_kvemo_svaneti`, `region.samegrelo_zemo_svaneti`, `region.samtskhe_javakheti`, `region.kvemo_kartli`, `region.shida_kartli`. The 24-1 row `Abkhazia A.R.` (a dash in every year from 2009) is not served; neither is any Abkhazia row.

**Geostat's spelling, matched as printed:** `ophtalmologists`, `neuropayhologists`, `gonorrheae`, `diseases of endocrin system`, `diseases of musculosceletal system and connective tissue`, `diseases of blood and blood forming organs` (and, not served, `Total numebr of registered patients`, `of wchich:`, `wich differrent`). Footnote markers stay in the label too: `neoplasms2)`, `diseases of the nervous system and sense organs3)`, `complications of pregnancy, childbirth and postnatal period4)`, `certain conditions originated in the perinatal period4)`; the cells' inner double spaces collapse (`diseases of the ear  and mastoid process`). `Physicians, total` carries a capital P and `Internal medicine doctors (therapeutists)` a capital I; the other physician rows are lower case.

## Checks

`prepare.py` rejects:

- a duplicate, missing or extra observation, and a served year outside a table's coverage (the numeric cells of each row must be exactly the served years);
- a `...`, `…` or `-` served as a value, and any other text in a year column except the one asterisk-marked number above, whose footnote must be printed on the sheet. The placeholders in the workbooks are in unserved cells: the morbidity-groups workbook uses both `...` and `…` (the nervous system, eye and ear rows before 2006 and the combined group from 2006), the four older nurse sub-groups are `…` from 2012, and the death-rate Abkhazia row is `-`;
- a published value that is not the stored value at the precision above, a negative value, and a unit, basis, status or source that differs from the cell map;
- a row that differs from a fresh read of its source cell address, stored token and number format;
- doctors or nurses differing from the main characteristics table's thousands x 1,000 in any year 2002-2025, after rounding that product to whole persons (the stored thousands carry double-precision noise such as `20.225000000000001`);
- the 14 doctor specialities not adding up to doctors in any year (tolerance 0);
- causes of death (chapters I-XIX and XXII, where COVID-19 is counted as 0 before 2020 inside this check only) not adding up to all deaths for Georgia and each region in any year (tolerance 0);
- the 11 regions not adding up to Georgia for all deaths and for each cause in any year (tolerance 0);
- a footnote quoted in `health-series-breaks.csv` that the named workbook does not print.

`test_validation.py` also checks the anchor values of the design spec (doctors 2025 22,491; nurses 21,262; hospitals 232; beds 15.232 thousand; visits 16,760.072 thousand; respiratory 500.359 thousand; tuberculosis 933; HIV 562; deaths 44,319; circulatory 16,711; COVID-19 2021 11,286; Guria deaths 2025 1,567; Racha-Lechkhumi and Kvemo Svaneti death rate 19.7), that all-deaths values equal `demography.deaths` in `data/imports/demography-vital-annual.csv` (Georgia 2014-2025 and the regions 2015-2025: the Population pages do not serve 2014 for regions, so those 11 values have no counterpart), the ICD-10 split, the nurse sub-group years, the manifest hashes and a self-closing-cell workbook built in memory. A patched value, a moved source cell, a +1 in one cause, a changed Georgia total, and a quoted footnote that is not printed each raise.

`verify_independent.mjs` re-reads the 11 served workbooks with SheetJS (the web app's own `xlsx` dependency), finds every cell again from its label tables written separately from `prepare.py` (it counts every numeric cell in a row's year columns, so the served year ranges are derived rather than copied) and compares stored value, cell, sheet, number format, unit, display text, source ID, basis and status for all rows. It repeats the staff-total, speciality, cause and region sums. Its negative controls must detect an altered value, an altered published value, an omitted row, a shifted year, a wrong cell, a wrong area, and a broken cause, regional or staff total.

Run them with:

```
python3 -B prepare.py --check && python3 -B -m unittest test_validation -v && node verify_independent.mjs
```

`python3 prepare.py` rebuilds the generated files and `node verify_independent.mjs --write` rewrites `independent-validation.json`. The verifier needs the `xlsx` package from `apps/web/node_modules`.

## Rules and notes

- **Nothing is derived.** No shares, rates per cause, totals of new cases, growth rates or interpolation. `imputed_values` and `calculated_values` are 0.
- **Real zeros are values.** Chapters VII and VIII (eye, ear) and other small causes have `0` in several areas and years, and COVID-19 is `0` for Georgia in 2025; they are published zeros, not placeholders.
- **COVID-19 (XXII)** has values from 2020. Its 2014-2019 cells are empty styled cells with no value, so the first value is in column `I` (2020), and `coverage.csv` lists 2014-2019 as unavailable. Years are always taken from the heading row, never from an offset after the label.
- **Chapters.** XVIII is "Symptoms, signs and abnormal clinical and laboratory findings, not elsewhere classified" (served as `ill_defined`) and XIX is injury, poisoning and other external causes (`external`). Chapters XX and XXI do not appear in the table.
- **Disease groups** are in thousands, as the table's title says; the 2002-2005 combined nervous system and sense organs group is replaced by three separate groups from 2006.
- **Other caveats.** Geostat's wider caveats (the 2018 pregnancy and newborn registry, the 2008-2009 HIV reporting change, and the rest) are quoted in the footnotes section below (pregnancy registry from 2018 under the disease groups, the 2008-2009 HIV change under HIV/AIDS, the 2015-2017 revision of causes of death under deaths by chapters and regions); only the four breaks of section 8 are recorded in `health-series-breaks.csv`.

## Footnotes Geostat prints under the served tables

Quoted as printed (spelling and all, with spaces collapsed). Every table also carries the line "Source: Ministry of Internally Displaced Persons From The Occupied Territories, Labour, Health and Social Affairs of Georgia, National Center for Disease Control and Public Health." (the 23-2 table says "from the Occupied Territories ... Levan Sakvarelidze National Center for Disease Control and Public Health").

- **Physicians** (title "Number of physicians by occupations (Main staff) (persons)"):
  - "Notice: In 2012 the health care human resources definitions were revised and classified in accordance with International Standard Classification of Occupations (ISCO-08)."
  - "Data from 2020 is based on a new system of personalized accounting for health care workers. Physicians staff numbers are estimated values by position and are calculated based on the percentage distribution of aggregated statistical reporting data obtained from medical institutions."
- **Nurses** (title "Number of nurses by basic specialities (persons)"):
  - "Note: In 2012 the health care human resources definitions were revised and classified in accordance with International Standard Classification of Occupations (ISCO-08). Positions were regrouped, wich are differrent to the current classification. Data 2012 doctor's assistants-laboratory assistants and X-ray-laboratory assistants are not included in paramedical personnel. Doctor's assistants are included in medical nurses category."
  - "Data from 2020 is based on a new system of personalized accounting for health care workers. Nursing staff numbers are estimated values by position and are calculated based on the percentage distribution of aggregated statistical reporting data obtained from medical institutions."
- **Main characteristics** (title "Main characteristics of public health (end of year)"):
  - "Note: In 2012, the definitions of medical personnel were revised and grouped according to the International Standard Classification of Occupations (ISCO-08). Fershal-Laboratories, X-ray Laboratories are no longer included in the category of secondary medical staff, while Fershals are included in the category of nurses."
  - "*Data from 2020 is based on the new system of personalized accounting of health workers. Accordingly, the 2020 data are not comparable to the 2002-2019 data."
- **Morbidity by disease groups** (title "Morbidity with acute and chronic diseases by main disease groups1) (thousand)"):
  - "1) Since 2020, an electronic system for recording new cases of diseases in outpatient facilities has been operating."
  - "2) ICD-10 Codes C00–D48."
  - "3) Since 2006, ICD-10 has been used, according to which diseases of the nervous system are presented in 3 classes: diseases of the nervous system, eyes and ears."
  - "4)An electronic registry for monitoring the health of pregnant women and newborns has been operating since 2018."
- **Tuberculosis** ("Morbidity of patients with tuberculosis (persons)") and **syphilis and gonorrheae** ("Morbidity of patients with syphilis and gonorrheae (the diagnosis set for the first time) (persons)"): the source line only.
- **HIV/AIDS** (title "Morbidity of patients with HIV/AIDS and Number of Deaths* (persons)"):
  - "* During 2008-2009 years Georgia joined the electronic system of European Center for Disease Control (ECDC) - HIV / AIDS surveillance (TESSy). Definition of HIV / AIDS has been modified along with methodology for reporting of HIV / AIDS cases. On the basis of evidence-based surveillance system, data was retrospectively revised."
  - "**Mortality data includes all registered HIV infected people. Data update is caused by the improvements to the person's identification database." (the death rows are not served)
- **Diabetes** (title "New Cases of Diabetes Mellitus by Age* (Persons)"): "* From 2020 - According to personalized data."
- **Anaemia** (title "New Cases of Anemia by Age (Persons)"): "Note: Aggregated data of the electronic system for registration of new cases of diseases in the facility providing outpatient services and the annual report of rural doctors."
- **Deaths by chapters and regions** (title "Number of deaths by chapters of the ICD-10 and regions (persons)"):
  - "Note: based on the registered data"
  - "* based on International Classification of Diseases, Tenth Revision (ICD-10)"
  - "** In case of death caused by injury or other external factors (chapter XIX), the external cause of the injury must be indicated as the primary cause of death (chapter XX)"
  - "The revision of causes of death for 2015-2017 is based on the information (Verbal Autopsy, Cancer Registry and Stationary Electronic System) from the National Center for Disease Control and Public Health" (printed in cell `B260`, with a trailing space, between the note and the asterisk footnotes)
  - "*** In 2021, 24 cases of maternal deaths are related to COVID-19" (attached to the Georgia pregnancy value `34***` in 2021)
- **Crude death rate** (title "Crude death rate (death per 1 000 population) by regions"):
  - "Note: 1995-2013 based on the retro-projection; starting from 2014 based on the registered data"
  - "- Occupied territories"

**1994-2013 death rates are retro-projections and are not served.** Fiscal.ge serves the death rate and the causes of death from 2014, the first year of registered data.

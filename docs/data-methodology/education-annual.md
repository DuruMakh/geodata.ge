# Annual education data collection and validation

## Purpose and status

This methodology governs the research package at `docs/Raw Data/Education/geostat-education-annual/`, collected on 2026-10-16 from Geostat's four education category pages. The research captures are immutable. The 8,815 values of `data/imports/education-annual.csv` (8,645 shown, 170 kept hidden) are served on the Education pages (Schools and Kindergartens with their index maps and place pages, Universities and Vocational colleges) under the approved design `docs/superpowers/specs/2026-10-16-education-design.md`. Nothing is published through MCP or included in central machine-readable publications, and the education sources are excluded from the fact-query snapshot.

Annual data only. Schools run 2000/01–2025/26 for Georgia and 2005/06–2025/26 for the regions and municipalities (teachers there from 2016/17); public kindergartens 2017/18–2025/26; universities 2011/12–2025/26 (graduates 2010/11–2024/25); vocational colleges 2013–2025. Pupils by grade or age, dropouts, ICT, social status, enrolment rates, exam results, school-to-VET transfers, doctoral students, professors, foreign students, institutions by region, vocational age groups, the 2000s secondary professional school tables and private kindergartens are excluded.

## Sources and coverage

Geostat publishes the figures on its early and preschool education (category 58), general education (category 59), professional education (category 60) and higher education (category 61) pages. Six workbooks supply values: general education tables 01 (schools and pupils), 06 (teachers) and 11 (schools, pupils and teachers by municipality); the indicators on public preschool education and care (PEC) institutions; higher education table 01 (admission, students and graduates by programme and sex); and the students in public and private vocational education programmes. Tables 01, 06, 11 and the vocational table end with "Source: Ministry of Education, Science and Youth of Georgia."; the kindergarten and higher education workbooks name no source.

Forty-five originals are preserved under `official/`: 41 workbooks and captures of the four category pages. The research manifest (`source-manifest.csv`, `source-manifest.json`) holds 46 source IDs because category 60 links one file twice: media 77194 ("Number of educational institutions, that conducted admission of students in vocational education programs", `geostat_education_vet_institutions`) and media 77212 ("Number of secondary professional schools by Regions", `geostat_education_secondary_professional_regions`) serve byte-identical files under the same name. Both IDs are registered in `data/sources/source-documents.csv`; the public archive `data/methodology/source-archives/education.csv` publishes the one file once, under `geostat_education_vet_institutions`, and names the other ID in the row's note. Each archive row is dated by the years it supplies (served workbooks) or prints (archived-only ones), school years by their starting year; nothing before 2000 is listed. The 35 archived-only workbooks are kept for provenance; no value is read from them.

## School years and graduates

Every school-year table counts at the beginning of the school year. A school year is stored as its starting year and labelled `2025/26` on every surface (axis, tooltip, table, range strip, latest line, hub card and Excel). Table 11 heads 2010/11 `2010/2011*` with the footnote "* As at 5 April 2011"; the year is served like any other. University graduates are published by calendar year ("2011 year" … "2025 year") and are stored under the school year they end (2010 … 2024, labelled 2010/11 … 2024/25). Vocational colleges are published and served by calendar year.

## Schools

Georgia's schools, pupils and teachers, total, public and private, come from tables 01 and 06; table 01 publishes pupils in thousands to one decimal (`persons_thousand`), and Georgia's pupils are shown that way on every page. Regions, municipalities and the kept units come from table 11 in whole persons. Table 11's GEORGIA row is a cross-check only (its pupils ÷ 1,000 round to table 01 in every year, its schools equal table 01 and its teachers equal table 06 from 2016/17), except Georgia's teachers by sex, which only table 11 prints (2016/17–). Geostat's note on tables 06 and 11: "Teachers employed at more than one school are counted as many times as the number of schools in which they teach."

## Kindergartens

The kindergarten table covers public preschool education and care institutions only; its footnote reads "1)Actually operating institutions during the accounting period." Its staff heading widens from 2020/21, from "The number of caregiver-pedagogues/caregivers" to "The number of caregiver-pedagogues/caregivers/assistant caregivers/Inclusive education special teachers". The change is recorded as `kindergarten_staff_2020` in `data/imports/education-series-breaks.csv` (demography's break format); no change is computed across it.

## Universities

Students, admitted students and graduates come from the Public-and-Private block of higher education table 01 (total, the three levels, female and male totals and the eight fields) and the total rows of its Public and Private blocks. Geostat's note: "From 2015-2016 school year in accordance with the International Standard Classification of Education (ISCED 2011), certified doctor (veterinarian) program, residency - are included in the Masters level." The level headings change at the same point. The change is recorded as `he_levels_2015` for the six bachelor's and master's series; graduates' new headings start in the "2015 year" column, stored as 2014 (2014/15).

## Vocational colleges

Admitted students and graduates come from the vocational table by calendar year, total, women, men and fields. Geostat replaced its list of fields in 2019 and phased the old list out by 2022 (last admissions 2020). The nine current fields are shown; the nine old fields are kept in the canonical CSV with `shown=false` and never reach a page, the client or Excel. Before 2019 Education (from 2016) is the only current field with figures. Until the old fields end, the shown fields therefore add up to less than the total: for admissions up to 2020, for graduates up to 2022; from 2021 for admissions and 2023 for graduates they add up to it (shortfall of admissions 5,696 in 2019 and 119 in 2020, of graduates 10,434, 2,079, 421 and 546 in 2019–2022, per `validation-report.json`). A field's zeros outside its active span (first to last year with a non-zero total) produce no row.

## Places

Places are Georgia (`country.georgia`), the 11 regions (`region.*`, Tbilisi as `region.tbilisi`) and the 63 municipalities (their two-digit codes). Abkhazia AR, Akhalgori, Eredvi, Tighva and Kurta are kept as `unit.abkhazia_ar`, `unit.akhalgori`, `unit.eredvi`, `unit.tighva` and `unit.kurta`: part of Geostat's region and Georgia rows, never drawn and with no page. Municipal codes 05, 42, 43, 46 and 64 stay excluded. Labels are mapped in `data/mappings/education/units.csv`.

## Geostat's own sums

Where Geostat's printed parts do not add up to its printed total, every row is served as printed and nothing is adjusted. The mismatches are recorded in `data/mappings/education/known-differences.csv` and each must recur with exactly its recorded difference: kindergarten children 2024/25, Samegrelo-Zemo Svaneti prints 9,836 while its municipalities add up to 9,436 (−400), so the 11 regions add up to 137,474, 400 above Georgia's 137,074; pupils 2022/23, Guria prints 14,490 while Lanchkhuti, Ozurgeti and Chokhatauri add up to 14,695 (+205), and Georgia's row agrees with Guria's.

## Gaps, dashes and zeros

A missing value is a gap in the chart, a dash in the table and a blank Excel cell, never zero. Geostat's `…`, `...` and `-` cells produce no row (for example table 06 private teachers 2010/11 and Abkhazia AR's kindergartens). A `0` inside a vocational field's active span is a published count and is served. Nothing is estimated, interpolated or derived.

## Indicators

IDs are stable lowercase ASCII `education.{measure}.{group}` with a `geography_id`; labels are display data. Units are `institutions` (schools, kindergartens), `persons_thousand` (Georgia's pupils) and `persons`. Every row has `basis=actual` and `value_status=official`, and keeps its source ID, sheet and cell.

## Validation and evidence

`python3 prepare.py --check`, `python3 -m unittest test_validation -v` and `node verify_independent.mjs` in the package rebuild every output, re-read every served cell (the second program with separately written label tables) and require: public + private = total, women + men = total, levels and fields = total, municipalities and kept units = their region, the 11 regions + Abkhazia AR = Georgia, old + current vocational fields = total, and table 11's Georgia row to agree with tables 01 and 06, except the recorded mismatches. Anchors: 2025/26 schools 2,292, pupils 644.2 thousand, teachers 66,328, kindergartens 1,717, children 130,337, staff 19,176, university students 195,426, admitted 58,554; graduates of 2025 32,494; vocational 2025 admitted 19,690, graduates 10,537.

## Serving on the Education pages

`npm run data:prepare-education` writes `data/imports/education-annual.csv` (UTF-8 with BOM), `data/imports/education-series-breaks.csv` and `data/reports/education-validation.json`; `npm run data:check-education` rebuilds them in memory and fails on any difference. The Prisma mirror `EducationFact` (migration `20261016170000_education`, row-level security on, public grants revoked) is filled only by the parity-checked `npm run data:import`, and `assertEducationParity` compares CSV and mirror field by field before a database-mode build serves. Pages are prerendered; no request-time read.

Excel downloads hold Summary, Data and Sources sheets in the reader's language, with the selected heading's series and years, school-year labels, explicit units, blank missing cells and validated links to the archived Geostat workbooks on fiscal.ge (`loadSourcedWorkbookSources("education", locale)`), listing only the sources of the years and series in the file. Internal cell references are not exported.

Original sources: [Early and preschool education](https://www.geostat.ge/en/modules/categories/58), [General education](https://www.geostat.ge/en/modules/categories/59), [Professional education](https://www.geostat.ge/en/modules/categories/60) and [Higher education](https://www.geostat.ge/en/modules/categories/61) (Geostat).

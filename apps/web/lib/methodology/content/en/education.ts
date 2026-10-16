import type { MethodologyContent } from "../../types";

const SCOPE = "Annual figures from Geostat on four pages. Schools: pupils, teachers and general education schools. Georgia’s figures start in 2000/01 (teachers in 2006/07) and are also split into public and private schools; those of the 11 regions and 63 municipalities start in 2005/06. Teachers by sex, and teachers in the regions and municipalities, are shown from 2016/17. Kindergartens: children, staff and public kindergartens for Georgia, each region and each municipality, 2017/18–2025/26. Universities: students and admitted students, 2011/12–2025/26, and graduates, 2010/11–2024/25, for Georgia, by level, public or private university, sex and eight fields of study. Vocational colleges: admitted students and graduates for Georgia, 2013–2025, by sex and nine fields of study. Pupils by grade or age, dropouts, enrolment rates, exam results, doctoral students, professors, private kindergartens and Geostat’s other education tables are not shown.";
const SOURCES = "Geostat publishes the figures on four pages of its website: early and preschool education (category 58), general education (category 59), professional education (category 60) and higher education (category 61). Fiscal.ge reads six of its workbooks. Schools come from tables of the general education page: 01 (schools and pupils), 06 (teachers) and 11 (schools, pupils and teachers by municipality); Kindergartens from the table of indicators on public preschool education and care institutions; Universities from table 01 of the higher education page (admission, students and graduates by programme and sex); Vocational colleges from the table of students in public and private vocational education programmes. The school tables and the vocational table end with “Source: Ministry of Education, Science and Youth of Georgia.”; the kindergarten and university tables name no source. Every value is shown as Geostat published it: Fiscal.ge adds no totals, shares, ratios or growth figures.";
const SCHOOL_YEARS = "Geostat counts pupils, teachers, schools, kindergartens and students at the beginning of each school year. The pages label a school year as Geostat does, shortened to 2025/26, and file it under the year in which it starts. In table 11 Geostat marks the 2010/11 school year “As at 5 April 2011”; that year is shown like the others. Geostat publishes university graduates by the calendar year in which they graduated. Each year’s graduates are shown under the school year that ends in it: the graduates of 2025 under 2024/25, and those of 2011, the first year, under 2010/11. So students start in 2011/12 and graduates in 2010/11. Vocational colleges are published by calendar year, and their page shows plain years, such as 2025.";
const SCHOOLS = "Geostat publishes Georgia’s pupils in table 01 in thousands with one decimal, and the pages show them that way: 644.2 thousand in 2025/26. Regions and municipalities come from table 11, which counts pupils one by one; for example, Tbilisi had 232,134 pupils in 2025/26. Table 11 also has a row for all of Georgia (644,243 pupils in 2025/26). It is used only as a check: in every year it matches table 01’s thousands after rounding, its schools equal table 01 and, from 2016/17, its teachers equal table 06. The pages take Georgia’s schools, pupils and teachers, by public and private schools, from tables 01 and 06, and only Georgia’s teachers by sex from table 11. Geostat’s teacher tables note: “Teachers employed at more than one school are counted as many times as the number of schools in which they teach.” So one teacher may be counted more than once.";
const KINDERGARTENS = "The Kindergartens page covers public kindergartens only: Geostat’s table is “Indicators on Public Preschool Education and Care (PEC) Institutions”, and its footnote says it counts “Actually operating institutions during the accounting period.” Private kindergartens are not in it. Staff are the people the table counts in its staff column, and that column widens from the 2020/21 school year. Up to 2019/20 it is headed “The number of caregiver-pedagogues/caregivers”; from 2020/21, “The number of caregiver-pedagogues/caregivers/assistant caregivers/Inclusive education special teachers”. So from 2020/21 the staff also include assistant caregivers and inclusive education special teachers, and the figures before and after the change are not directly comparable. The change is recorded with the data, and Fiscal.ge computes no change across it.";
const UNIVERSITIES = "The Universities page shows Geostat’s figures on students, admitted students and graduates in public and private higher education institutions, for Georgia only. The levels are Geostat’s three programme levels: bachelor’s, master’s and professional programmes. Geostat’s note on the table: “From 2015-2016 school year in accordance with the International Standard Classification of Education (ISCED 2011), certified doctor (veterinarian) program, residency - are included in the Masters level.” The level headings change at the same point: “Bachelor or Certified physician programme” and “Magistracy or Residency” become “Bachelor programme” and “Magistracy, Certified physician (Veterinarian) or Residency”. So bachelor’s and master’s figures before and after 2015/16 are not directly comparable; for graduates, whom Geostat counts the new way from its 2015 column, the change shows from 2014/15. The change is recorded with the data, and Fiscal.ge computes no change across it. The fields of study are Geostat’s eight groups; doctoral students are in a separate Geostat table and are not shown.";
const VOCATIONAL = "The Vocational colleges page shows students admitted to and graduating from public and private vocational education programmes, by calendar year, for Georgia. Geostat changed its list of fields of study in 2019. The pages show the nine current fields; most of them start in 2019, education in 2016 and social sciences, journalism and information in 2020, so before 2019 education is the only current field with figures. Geostat still counts some students under the nine old fields through 2022 (the last admissions in 2020). The old fields are kept in Fiscal.ge’s data file but not shown, so until then the fields shown add up to less than the total: for admissions up to 2020, for graduates up to 2022; from 2021 for admissions and 2023 for graduates they add up to it.";
const PLACES = "Geostat’s municipal and kindergarten tables also have a row for Abkhazia AR and, inside two regions, rows for Akhalgori (in Mtskheta-Mtianeti) and for Eredvi, Tighva and Kurta (in Shida Kartli). These rows are part of Geostat’s region and Georgia totals, so the pages’ totals include them, but they are not among the 63 municipalities on the map and have no page of their own. Geostat gives figures for them only in some years: Abkhazia AR’s schools and pupils in every year and its teachers from 2016/17; Akhalgori’s schools and pupils up to 2008/09 and its kindergartens from 2017/18; Eredvi’s up to 2010/11, and Tighva’s and Kurta’s up to 2007/08. Tbilisi is a region of its own and has one page.";
const SUMS = "Where Geostat’s printed parts do not match its printed total, the pages show each figure as printed and adjust nothing. Two such cases are recorded. Kindergarten children in 2024/25: Geostat prints 9,836 for Samegrelo-Zemo Svaneti, but its nine municipalities add up to 9,436; because of this the 11 regions add up to 137,474, 400 more than Georgia’s 137,074. Pupils in 2022/23: Geostat prints 14,490 for Guria, but Lanchkhuti (3,716), Ozurgeti (8,396) and Chokhatauri (2,583) add up to 14,695, 205 more; Georgia’s row agrees with Guria’s 14,490. Every other sum the checks compare adds up.";
const GAPS = "A missing value is a gap in the chart, a dash in the table and an empty cell in Excel, never zero. Geostat writes “…”, “...” or “-” where it gives no figure, for example for Georgia’s private-school teachers in the 2010/11 school year and for Abkhazia AR’s kindergartens, and these produce no value. For a vocational field Geostat writes 0 in the years before its first students and after its last; those zeros are not shown, so a field’s line covers only its own years. Inside them a 0 is a published count and is shown as 0. Nothing is estimated or filled in.";

export const EDUCATION_METHODOLOGY_CONTENT: MethodologyContent = {
  "id": "education",
  "slug": "education",
  "title": "Education",
  "summary": "Pupils, teachers and schools, public kindergartens, universities and vocational colleges in Georgia, its regions and municipalities, by school year, as Geostat publishes them.",
  "metaDescription": "Schools, kindergartens, universities and vocational colleges in Georgia: Geostat’s figures, sources, school years and counting changes.",
  "reviewedAt": "2026-10-16",
  "archiveManifestId": "education",
  "coverageSource": {
    "kind": "archive"
  },
  "canonicalDocuments": [
    "docs/data-methodology/education-annual.md"
  ],
  "disclosure": "All values are figures published by Geostat. The pages describe them and give no reasons; Fiscal.ge adds nothing up, computes no shares or ratios and estimates nothing.",
  "keyFacts": [
    {
      "label": "Coverage",
      "valueKind": "coverage"
    },
    {
      "label": "Frequency",
      "valueKind": "frequency",
      "value": "Annual"
    },
    {
      "label": "Basis",
      "valueKind": "basis",
      "value": "Actual"
    },
    {
      "label": "Units",
      "valueKind": "unit",
      "value": "Persons; thousand pupils; institutions"
    }
  ],
  "sections": [
    { "id": "scope", "kind": "scope", "title": "What do the pages cover?", "paragraphs": [SCOPE] },
    { "id": "sources", "kind": "sources", "title": "Where do the figures come from?", "paragraphs": [SOURCES] },
    { "id": "school-years", "kind": "classification", "title": "School years and graduates", "paragraphs": [SCHOOL_YEARS] },
    { "id": "schools", "kind": "classification", "title": "Pupils, teachers and schools", "paragraphs": [SCHOOLS] },
    { "id": "kindergartens", "kind": "classification", "title": "Public kindergartens and the 2020/21 staff change", "paragraphs": [KINDERGARTENS] },
    { "id": "universities", "kind": "classification", "title": "Universities and the 2015/16 change at master’s level", "paragraphs": [UNIVERSITIES] },
    { "id": "vocational", "kind": "classification", "title": "Vocational colleges and fields of study", "paragraphs": [VOCATIONAL] },
    { "id": "places", "kind": "classification", "title": "Regions, municipalities and Abkhazia", "paragraphs": [PLACES] },
    { "id": "sums", "kind": "limitations", "title": "Where Geostat’s own sums do not add up", "paragraphs": [SUMS] },
    { "id": "gaps", "kind": "classification", "title": "Gaps, dashes and zeros", "paragraphs": [GAPS] },
    {
      "id": "limitations",
      "kind": "limitations",
      "title": "What the pages leave out",
      "paragraphs": [
        "The pages describe the figures and state no causes or explanations for their changes. Fiscal.ge creates no totals, shares, pupils per teacher or other ratios, growth figures or forecasts. Pupils by grade or age, dropouts, information and communication technology, social status, enrolment rates, exam results, moves from school to vocational education, doctoral students, professors, foreign students, institutions by region, vocational age groups, the secondary professional school tables of the 2000s and private kindergartens are not shown. Education spending is on the Budget pages. Geostat’s other tables are kept with the original sources."
      ]
    },
    {
      "id": "validation",
      "kind": "validation",
      "title": "How are the figures checked?",
      "paragraphs": [
        "The data file holds 8,815 published values, 8,645 of them on the pages; the other 170 are the old vocational fields. Each value is read again from its cell in Geostat’s original workbook and compared with the cell’s stored value and number format, and the original files are checked against their recorded fingerprints. A second program, written separately, reads the six workbooks again and must find the same values. The checks also require: public and private to add up to the total for Georgia’s schools, pupils (in thousands, within rounding) and teachers and for each university measure; women and men to add up to the total for teachers and for each university and vocational measure; the levels and the fields to add up to the total for each university measure; the municipalities to add up to their region, and the regions with Abkhazia AR to Georgia, for schools, pupils, teachers and the three kindergarten measures; and the old and current vocational fields together to add up to the total. The only exceptions are Geostat’s own sums described above. Fixed values are compared too: in 2025/26, 2,292 schools, 644.2 thousand pupils, 66,328 teachers, 1,717 kindergartens, 130,337 children and 195,426 university students; 32,494 university graduates of 2025; and 19,690 students admitted to vocational colleges in 2025."
      ]
    },
    {
      "id": "archive",
      "kind": "archive",
      "title": "Original sources",
      "paragraphs": [
        "45 originals from Geostat, retrieved on 16 October 2026, are available: 41 workbooks from Geostat’s four education pages and captures of those four pages. Six workbooks supply the values on the pages; the others are kept for reference and no value is read from them. The professional education page links one workbook twice, as “Number of educational institutions, that conducted admission of students in vocational education programs” and as “Number of secondary professional schools by Regions”; the two downloads are identical, so one copy is kept for both. HTML pages download as text files. Excel follows the selected page, place, series and years and lists their source files."
      ]
    }
  ],
  "decisions": [
    { "id": "education.scope", "group": "education", "title": "What do the pages cover?", "statusLabel": "Fiscal.ge decision", "summary": SCOPE, "detail": [], "canonicalDecisionIds": ["education.scope"] },
    { "id": "education.sources", "group": "education", "title": "Where do the figures come from?", "statusLabel": "Fiscal.ge decision", "summary": SOURCES, "detail": [], "canonicalDecisionIds": ["education.sources"] },
    { "id": "education.school_years", "group": "education", "title": "School years and graduates", "statusLabel": "Fiscal.ge decision", "summary": SCHOOL_YEARS, "detail": [], "canonicalDecisionIds": ["education.school_years"] },
    { "id": "education.schools", "group": "education", "title": "Pupils, teachers and schools", "statusLabel": "Official fact", "summary": SCHOOLS, "detail": [], "canonicalDecisionIds": ["education.schools"] },
    { "id": "education.kindergartens", "group": "education", "title": "Public kindergartens and the 2020/21 staff change", "statusLabel": "Official fact", "summary": KINDERGARTENS, "detail": [], "canonicalDecisionIds": ["education.kindergartens"] },
    { "id": "education.universities", "group": "education", "title": "Universities and the 2015/16 change at master’s level", "statusLabel": "Official fact", "summary": UNIVERSITIES, "detail": [], "canonicalDecisionIds": ["education.universities"] },
    { "id": "education.vocational", "group": "education", "title": "Vocational colleges and fields of study", "statusLabel": "Fiscal.ge decision", "summary": VOCATIONAL, "detail": [], "canonicalDecisionIds": ["education.vocational"] },
    { "id": "education.places", "group": "education", "title": "Regions, municipalities and Abkhazia", "statusLabel": "Fiscal.ge decision", "summary": PLACES, "detail": [], "canonicalDecisionIds": ["education.places"] },
    { "id": "education.sums", "group": "education", "title": "Where Geostat’s own sums do not add up", "statusLabel": "Limitation", "summary": SUMS, "detail": [], "canonicalDecisionIds": ["education.sums"] },
    { "id": "education.gaps", "group": "education", "title": "Gaps, dashes and zeros", "statusLabel": "Fiscal.ge decision", "summary": GAPS, "detail": [], "canonicalDecisionIds": ["education.gaps"] }
  ],
  "technicalAppendix": [],
  "showTechnicalAppendix": false
};

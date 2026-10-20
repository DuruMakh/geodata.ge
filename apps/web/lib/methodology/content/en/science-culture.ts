import type { MethodologyContent } from "../../types";

const SCOPE = "Annual figures from Geostat on four pages, for Georgia as a whole unless regions are named. Research: researchers by sex, degree, field of science and age, all research and development (R&D) staff, the institutions doing research and their R&D spending, 2019–2024. Patents: applications for inventions and utility models and the patents registered, 2016–2025. Museums: visitors, group tours, exhibitions and museums for Georgia and each of the 11 regions, 2005–2025; for Georgia also the six types of museum and, from 2020, museum staff. Theatres: the audience, shows, professional theatres by type and their seats, 2006–2025, events from 2021 and staff from 2020.";
const SOURCES = "Geostat publishes the figures on two pages of its website: science (category 194) and culture (category 615). Fiscal.ge reads eleven of its workbooks: three on research (researchers, persons working on R&D, and institutions with their spending), one on inventions and utility models, four on museums (main characteristics, the number of museums by region, the main characteristics by region, and staff) and three on theatres (main indicators, events and staff). The research workbooks name their source: “2019 - GeoStat; From 2020 - Ministry of Education, Science and Youth of Georgia.” The patent workbook names the National Intellectual Property Center of Georgia, Sakpatenti. The museum and theatre workbooks name no other source. Every value is shown as Geostat published it.";
const RESEARCH = "The Research page follows Geostat’s tables. Researchers are shown in total and by sex, by degree (doctorate, master’s, bachelor’s and short-cycle), by field of science and by age group. All R&D staff is Geostat’s count of persons working on R&D by status: researchers, technicians and equivalent staff, other supporting staff and not specified; researchers are the first row of the list and are not repeated under it. Spending is Geostat’s total expenditure on R&D, in million GEL (242.9 million in 2024). Geostat collected the 2019 figures itself; from 2020 they come from the Ministry of Education, Science and Youth. The pages show both as published and compute no change across them. Two published changes stand out: researchers under 25 rise from 170 in 2020 to 1,012 in 2021, and researchers whose field is not identified number 88 in 2019, 37 in 2020 and 1 in 2021, and none from 2022. Geostat’s tables carry no note on either, and the pages give no reason. Geostat also splits each degree, field and age group by sex; those splits are not shown.";
const PATENTS = "The Patents page shows the figures of the National Intellectual Property Center of Georgia, Sakpatenti, as Geostat publishes them, 2016–2025. Geostat publishes inventions and utility models in two separate tables, each with the applications filed and the patents registered. Each is split by procedure: under the national procedure, local and foreign applicants are counted apart (shown as Georgian and Foreign); the international procedure is one figure (shown as International route). Geostat also publishes patents by region for 2022–2025; they are not shown.";
const MUSEUMS = "Geostat counts museums (museum unions) and museum reserves. The pages show the number of visitors and of group tours (Geostat’s “excursions”), both in thousands as Geostat publishes them, and the number of exhibitions and of museums. Georgia’s visitors, group tours and exhibitions come from the Georgia row of the by-region workbook; Georgia’s museums and their six types from the national workbook; each region’s museums from the workbook of museums by region. Geostat’s tables have no row for Abkhazia AR. The 11 regions add up to Georgia’s total for museums and exhibitions in every year, and for group tours within 0.2 thousand, because early years are rounded to one decimal. For visitors they add up exactly except in 2005, 2013 and 2023, when the regions come out 13, 19 and 30 visitors lower than Georgia’s total; Fiscal.ge shows both as Geostat published them. Museum staff, from 2020, are shown for Georgia only: in total, by sex, permanent or on contract, and in three age groups.";
const THEATRES = "The Theatres page covers Georgia’s professional theatres. Geostat’s note on the audience row reads: “*2006-2020 data includes only performances.” Up to 2020 the audience counts the people at performances only; from 2021 it counts the people at all events held in the country. So 2021 and later are not comparable with earlier years: the chart leaves a gap in the line at 2021 and marks it “new counting”, the table marks the year, and Fiscal.ge computes no change across it. Geostat counts events from 2021 only; before that its events rows print “-”, which there means they were not counted, so those years are gaps, not zeros. Geostat publishes the audience of 2006–2009 to one decimal (in thousands); the pages show every year to one decimal. Seats are Geostat’s seats in the hall, including rented halls. Theatre staff, from 2020, are shown as for museums.";
const GAPS = "A missing value is a gap in the chart, a dash in the table and an empty cell in Excel, never zero. In the researcher, R&D staff, patent and staff tables Geostat prints “-” where there are none; the rows add up only with it read as zero, so there it is shown as 0 (for example, invention patents registered for foreign applicants in 2018). In the theatre events rows before 2021 the same “-” means the events were not counted, and those years have no value. Geostat’s “…” and blank cells have no value either. Nothing is estimated or filled in.";

export const SCIENCE_CULTURE_METHODOLOGY_CONTENT: MethodologyContent = {
  "id": "science-culture",
  "slug": "science-culture",
  "title": "Science and culture",
  "summary": "Researchers and research spending, patents, museums and their visitors, and professional theatres in Georgia, year by year, as Geostat publishes them.",
  "metaDescription": "Research, patents, museums and theatres in Georgia: Geostat’s figures, sources, the 2020 change of collector and the 2021 theatre audience change.",
  "reviewedAt": "2026-10-20",
  "archiveManifestId": "science-culture",
  "coverageSource": {
    "kind": "archive"
  },
  "canonicalDocuments": [
    "docs/data-methodology/science-culture-annual.md"
  ],
  "disclosure": "All values are figures published by Geostat. The pages describe them and give no reasons; Fiscal.ge adds nothing up, computes no shares, ratios or growth rates and estimates nothing.",
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
      "value": "Persons; thousands; counts; million GEL"
    }
  ],
  "sections": [
    { "id": "scope", "kind": "scope", "title": "What do the pages cover?", "paragraphs": [SCOPE] },
    { "id": "sources", "kind": "sources", "title": "Where do the figures come from?", "paragraphs": [SOURCES] },
    { "id": "research", "kind": "classification", "title": "Researchers, R&D staff and the 2020 change of collector", "paragraphs": [RESEARCH] },
    { "id": "patents", "kind": "classification", "title": "Inventions, utility models and the two routes", "paragraphs": [PATENTS] },
    { "id": "museums", "kind": "classification", "title": "Museum visitors, group tours and the regions", "paragraphs": [MUSEUMS] },
    { "id": "theatres", "kind": "classification", "title": "Theatres and the 2021 audience change", "paragraphs": [THEATRES] },
    { "id": "gaps", "kind": "classification", "title": "Gaps, dashes and zeros", "paragraphs": [GAPS] },
    {
      "id": "limitations",
      "kind": "limitations",
      "title": "What the pages leave out",
      "paragraphs": [
        "The pages describe the figures and state no causes for their changes, for example for the fall in museum visitors and theatre audiences in 2020. Fiscal.ge computes no totals, shares, ratios, growth rates or forecasts; Geostat’s own averages, visitors per museum and audience per event, are not shown either. Also not shown: the split by sex of each degree, field and age group; patents by region (2022–2025); theatres by region and Geostat’s row for the remaining regions; participants in events abroad; and scientific publications (one year, 2021). Libraries (2001–2008), publishing and newspapers (2005–2020) and museum collections (2011 only) are left out because Geostat’s tables on them stop in those years. These tables are kept with the original sources."
      ]
    },
    {
      "id": "validation",
      "kind": "validation",
      "title": "How are the figures checked?",
      "paragraphs": [
        "The data file holds 1,733 published values. Each value is read again from its cell in Geostat’s original workbook and compared with the cell’s stored value and number format, and the original files are checked against their recorded fingerprints. A second program, written separately, reads the eleven workbooks again and must find the same values. The checks also require: women and men to add up to the total for researchers, R&D staff and museum and theatre staff; researchers’ degrees, fields and age groups each to add up to all researchers; researchers, technicians, other support staff and not specified to add up to all R&D staff; permanent and contract staff, and the three age groups, each to add up to all staff; the museum types and the regions to add up to all museums, and the theatre types to all theatres; the regions to add up to Georgia for exhibitions, for group tours within 0.2 thousand and for visitors except the three years above. Georgia’s visitors in the by-region workbook must match the national workbook’s visitors in million, and the audience in the events workbook must match the by-region theatre workbook. Fixed values are compared too: in 2024, 14,046 researchers (7,732 women), 16,191 R&D staff and 66 institutions spending 242.9 million GEL; in 2025, 79 invention applications from Georgian applicants and 41 invention patents registered for them, 261 museums with 1,998.9 thousand visitors and 53 theatres with an audience of 620.3 thousand."
      ]
    },
    {
      "id": "archive",
      "kind": "archive",
      "title": "Original sources",
      "paragraphs": [
        "33 originals from Geostat, retrieved on 20 October 2026, are available: 18 English workbooks from Geostat’s science and culture pages, the Georgian versions of 13 of them, and captures of the two pages. Eleven workbooks supply the values on the pages; the by-region theatre workbook is read only for a check, and the others are kept for reference. The Georgian workbooks are kept for their Georgian labels, and no value is read from them. HTML pages download as text files. Excel follows the selected page, area, series and years and lists their source files."
      ]
    }
  ],
  "decisions": [
    { "id": "science-culture.scope", "group": "science-culture", "title": "What do the pages cover?", "statusLabel": "Fiscal.ge decision", "summary": SCOPE, "detail": [], "canonicalDecisionIds": ["science-culture.scope"] },
    { "id": "science-culture.sources", "group": "science-culture", "title": "Where do the figures come from?", "statusLabel": "Fiscal.ge decision", "summary": SOURCES, "detail": [], "canonicalDecisionIds": ["science-culture.sources"] },
    { "id": "science-culture.research", "group": "science-culture", "title": "Researchers, R&D staff and the 2020 change of collector", "statusLabel": "Official fact", "summary": RESEARCH, "detail": [], "canonicalDecisionIds": ["science-culture.research"] },
    { "id": "science-culture.patents", "group": "science-culture", "title": "Inventions, utility models and the two routes", "statusLabel": "Official fact", "summary": PATENTS, "detail": [], "canonicalDecisionIds": ["science-culture.patents"] },
    { "id": "science-culture.museums", "group": "science-culture", "title": "Museum visitors, group tours and the regions", "statusLabel": "Official fact", "summary": MUSEUMS, "detail": [], "canonicalDecisionIds": ["science-culture.museums"] },
    { "id": "science-culture.theatres", "group": "science-culture", "title": "Theatres and the 2021 audience change", "statusLabel": "Official fact", "summary": THEATRES, "detail": [], "canonicalDecisionIds": ["science-culture.theatres"] },
    { "id": "science-culture.gaps", "group": "science-culture", "title": "Gaps, dashes and zeros", "statusLabel": "Fiscal.ge decision", "summary": GAPS, "detail": [], "canonicalDecisionIds": ["science-culture.gaps"] }
  ],
  "technicalAppendix": [],
  "showTechnicalAppendix": false
};

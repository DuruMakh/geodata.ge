import type { MethodologyContent } from "../../types";

const SCOPE = "Annual figures from Geostat on three pages. Doctors and hospitals: doctors and their 14 specialities, nurses and six groups within them, hospitals, out-patient clinics, hospital beds and out-patient visits for Georgia, 2002–2025. Illnesses: new cases in 19 disease groups and of six single diseases — tuberculosis, HIV/AIDS, diabetes, anaemia, syphilis and gonorrhoea — for Georgia, 2002–2025, with diabetes and anaemia from 2016. Causes of death: deaths by main group of causes and the death rate for Georgia and each of its 11 regions, 2014–2025. Monthly data, Abkhazia and Geostat’s other health tables are not shown.";
const SOURCES = "The figures are collected by the Ministry of Health and the National Center for Disease Control and Public Health and published by Geostat. Every Geostat table used here carries the line “Source: Ministry of Internally Displaced Persons From The Occupied Territories, Labour, Health and Social Affairs of Georgia, National Center for Disease Control and Public Health.” Fiscal.ge reads 11 of Geostat’s workbooks: nine from its Healthcare page and two from its Deaths page (deaths by cause and region, and the death rate by region). Every value is shown as Geostat published it: Fiscal.ge adds no totals, shares, rates per cause or growth figures.";
const STAFF = "Doctors are Geostat’s “Number of physicians by occupations (Main staff)”: all physicians, with 14 specialities that add up to the total in every year. Nurses are Geostat’s “Number of nurses by basic specialities”: the total, with midwives, medical nurses and, until 2011, doctors’ assistants, laboratory assistants, X-ray assistants and other nursing staff. Hospitals, out-patient clinics, hospital beds and out-patient visits (including preventive visits) come from Geostat’s “Main characteristics of public health (end of year)”. Geostat publishes beds, visits and disease-group cases in thousands. The pages show beds as a number of beds, visits in millions and the six single diseases in thousands next to the groups; each is Geostat’s figure with the decimal point moved, and Excel keeps Geostat’s own units. For the years from 2020 Geostat’s doctors table says: “Physicians staff numbers are estimated values by position and are calculated based on the percentage distribution of aggregated statistical reporting data obtained from medical institutions.”";
const STAFF_CHANGES = "Geostat changed how health staff are counted twice. Charts mark both years with a gap and a dashed “new counting” line, and tables mark the year. On 2012 Geostat writes: “In 2012 the health care human resources definitions were revised and classified in accordance with International Standard Classification of Occupations (ISCO-08).” Its nurses table adds: “Data 2012 doctor’s assistants-laboratory assistants and X-ray-laboratory assistants are not included in paramedical personnel. Doctor’s assistants are included in medical nurses category.” From 2012 Geostat prints “…” for the four older nurse groups, so they end in 2011. On 2020: “Data from 2020 is based on the new system of personalized accounting of health workers. Accordingly, the 2020 data are not comparable to the 2002-2019 data.” Figures on either side of a change are therefore not directly comparable, and Fiscal.ge computes no growth across them.";
const ILLNESS = "The Illnesses page counts new cases: illnesses diagnosed for the first time and recorded by clinics during the year. They are cases, not the number of people who are ill. Geostat groups them by the main disease groups of the international classification of diseases (ICD-10) and publishes them in thousands; the six single diseases come from Geostat’s separate tables and are counted in persons. Geostat’s note on the disease groups: “Since 2020, an electronic system for recording new cases of diseases in outpatient facilities has been operating.” On diabetes: “From 2020 - According to personalized data.” Charts mark 2020 as a new counting for the disease groups and diabetes. On the nervous system: “Since 2006, ICD-10 has been used, according to which diseases of the nervous system are presented in 3 classes: diseases of the nervous system, eyes and ears.” So the combined group ends in 2005 and the three groups start in 2006. On the pregnancy and newborn groups: “An electronic registry for monitoring the health of pregnant women and newborns has been operating since 2018.” On HIV/AIDS: “During 2008-2009 years Georgia joined the electronic system of European Center for Disease Control (ECDC) - HIV / AIDS surveillance (TESSy). Definition of HIV / AIDS has been modified along with methodology for reporting of HIV / AIDS cases. On the basis of evidence-based surveillance system, data was retrospectively revised.” The 2018 and 2008–2009 notes are not drawn on the charts.";
const NO_TOTAL = "Geostat’s disease-group table has no total row, and the six single diseases come from separate tables. Adding them up would be Fiscal.ge’s own calculation, which the pages never make, so no total of all illnesses is shown. The groups and diseases are compared side by side instead.";
const DEATHS = "Deaths are registered deaths; Geostat’s table is “based on the registered data”. They are grouped by the main classes of causes that Geostat calls the chapters of ICD-10, the international classification of diseases. The pages show all deaths and 20 classes: chapters I to XIX and chapter XXII, which holds COVID-19 from 2020. Before 2020 that chapter is empty in Geostat’s table, so it is a gap, not zero. Chapter XVIII, shown as “ill-defined causes”, is Geostat’s “Symptoms, signs and abnormal clinical and laboratory findings, not elsewhere classified”: deaths recorded with a symptom or finding rather than a defined disease. Chapter XIX is injury, poisoning and other external causes. Geostat also notes: “The revision of causes of death for 2015-2017 is based on the information (Verbal Autopsy, Cancer Registry and Stationary Electronic System) from the National Center for Disease Control and Public Health”. For 2021 Geostat prints Georgia’s pregnancy and childbirth deaths as “34***”, with the footnote “In 2021, 24 cases of maternal deaths are related to COVID-19”; Fiscal.ge shows the number, 34.";
const DEATH_RATE = "The death rate is Geostat’s crude death rate: deaths in the year per 1,000 population, as Geostat publishes it for Georgia and the 11 regions, with one decimal. Fiscal.ge does not calculate it. Geostat’s note on the table: “1995-2013 based on the retro-projection; starting from 2014 based on the registered data”. The pages therefore start in 2014, the first year of registered data, as the causes of death do. Geostat prints a dash for Abkhazia, marked “Occupied territories”, and Abkhazia is not shown. All deaths match the registered deaths on the Demography pages: for Georgia in every year 2014–2025, and for each region in 2015–2025, the years those pages show for regions.";
const GAPS = "A missing value is a gap in the chart, a dash in the table and an empty cell in Excel, never zero. Geostat’s “…” and “...” cells mean the figure is not available, and they produce no value. A 0 in the deaths table is a published count, for example COVID-19 deaths for Georgia in 2025 and deaths from eye diseases in some regions and years, and it is shown as 0. Nothing is estimated or filled in.";

export const HEALTH_METHODOLOGY_CONTENT: MethodologyContent = {
  "id": "health",
  "slug": "health",
  "title": "Healthcare and causes of death",
  "summary": "Doctors, nurses, hospitals and new cases of illness in Georgia, and deaths by cause and the death rate for Georgia and its regions, as Geostat publishes them.",
  "metaDescription": "Doctors, hospitals, new cases of illness, causes of death and the death rate in Georgia and its regions: Geostat’s figures, sources and counting changes.",
  "reviewedAt": "2026-10-15",
  "archiveManifestId": "health",
  "coverageSource": {
    "kind": "archive"
  },
  "canonicalDocuments": [
    "docs/data-methodology/health-annual.md"
  ],
  "disclosure": "All values are figures published by Geostat. The pages describe them and give no reasons; Fiscal.ge adds nothing up, shares nothing out and estimates nothing.",
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
      "value": "Persons; thousand new cases; units; deaths per 1,000 population"
    }
  ],
  "sections": [
    { "id": "scope", "kind": "scope", "title": "What do the pages cover?", "paragraphs": [SCOPE] },
    { "id": "sources", "kind": "sources", "title": "Where do the figures come from?", "paragraphs": [SOURCES] },
    { "id": "staff", "kind": "classification", "title": "Doctors, nurses and hospitals", "paragraphs": [STAFF] },
    { "id": "staff-changes", "kind": "classification", "title": "Counting changes for staff in 2012 and 2020", "paragraphs": [STAFF_CHANGES] },
    { "id": "illness", "kind": "classification", "title": "What new cases of illness mean", "paragraphs": [ILLNESS] },
    { "id": "no-total", "kind": "classification", "title": "Why there is no total of all illnesses", "paragraphs": [NO_TOTAL] },
    { "id": "deaths", "kind": "classification", "title": "Causes of death and ICD-10 chapters", "paragraphs": [DEATHS] },
    { "id": "death-rate", "kind": "classification", "title": "The death rate and the Demography pages", "paragraphs": [DEATH_RATE] },
    { "id": "gaps", "kind": "classification", "title": "Gaps, dashes and zeros", "paragraphs": [GAPS] },
    {
      "id": "limitations",
      "kind": "limitations",
      "title": "What the pages leave out",
      "paragraphs": [
        "The pages describe the figures and state no causes or explanations for their changes. Fiscal.ge creates no totals of new cases, shares, rates per cause, growth figures or forecasts. Monthly data, Abkhazia, the 1994–2013 death rates and Geostat’s other health tables are not shown: abortions, emergency care, children’s illnesses, infectious diseases by type, medicines and disability programmes, cancer screening, and deaths by sex, age and settlement type, maternal, infant and child deaths and suicides. Those tables are kept with the original sources."
      ]
    },
    {
      "id": "validation",
      "kind": "validation",
      "title": "How are the figures checked?",
      "paragraphs": [
        "4,204 values are published. Each is read again from its cell in Geostat’s original workbook and compared with the cell’s stored value, printed label and number format, and the original files are checked against their recorded fingerprints. A second program, written separately, reads every workbook again and must find the same values. The checks also require, in every year: the 14 specialities to add up exactly to all doctors; doctors and nurses to equal the staff rows of Geostat’s main characteristics table; the causes of death to add up exactly to all deaths, for Georgia and each region; the 11 regions to add up exactly to Georgia, for all deaths and for each cause; and all deaths to equal the registered deaths on the Demography pages. Fixed values are compared too: doctors in 2025 (22,491), deaths in 2025 (44,319) and the death rate in Racha-Lechkhumi and Kvemo Svaneti in 2025 (19.7). Values are shown as precisely as Geostat publishes them."
      ]
    },
    {
      "id": "archive",
      "kind": "archive",
      "title": "Original sources",
      "paragraphs": [
        "36 originals from Geostat, retrieved on 15 October 2026, are available: 21 workbooks from Geostat’s Healthcare page, 13 from its Deaths page and captures of both pages. 11 workbooks supply the values on the pages; the others are kept for reference and no value is read from them. HTML pages download as text files. Excel follows the selected series and years and lists their source files."
      ]
    }
  ],
  "decisions": [
    { "id": "health.scope", "group": "health", "title": "What do the pages cover?", "statusLabel": "Fiscal.ge decision", "summary": SCOPE, "detail": [], "canonicalDecisionIds": ["health.scope"] },
    { "id": "health.sources", "group": "health", "title": "Where do the figures come from?", "statusLabel": "Fiscal.ge decision", "summary": SOURCES, "detail": [], "canonicalDecisionIds": ["health.sources"] },
    { "id": "health.staff", "group": "health", "title": "Doctors, nurses and hospitals", "statusLabel": "Official fact", "summary": STAFF, "detail": [], "canonicalDecisionIds": ["health.staff"] },
    { "id": "health.staff_changes", "group": "health", "title": "Counting changes for staff in 2012 and 2020", "statusLabel": "Official fact", "summary": STAFF_CHANGES, "detail": [], "canonicalDecisionIds": ["health.staff_changes"] },
    { "id": "health.illness", "group": "health", "title": "What new cases of illness mean", "statusLabel": "Official fact", "summary": ILLNESS, "detail": [], "canonicalDecisionIds": ["health.illness"] },
    { "id": "health.no_total", "group": "health", "title": "Why there is no total of all illnesses", "statusLabel": "Fiscal.ge decision", "summary": NO_TOTAL, "detail": [], "canonicalDecisionIds": ["health.no_total"] },
    { "id": "health.deaths", "group": "health", "title": "Causes of death and ICD-10 chapters", "statusLabel": "Official fact", "summary": DEATHS, "detail": [], "canonicalDecisionIds": ["health.deaths"] },
    { "id": "health.death_rate", "group": "health", "title": "The death rate and the Demography pages", "statusLabel": "Official fact", "summary": DEATH_RATE, "detail": [], "canonicalDecisionIds": ["health.death_rate"] },
    { "id": "health.gaps", "group": "health", "title": "Gaps, dashes and zeros", "statusLabel": "Fiscal.ge decision", "summary": GAPS, "detail": [], "canonicalDecisionIds": ["health.gaps"] }
  ],
  "technicalAppendix": [],
  "showTechnicalAppendix": false
};

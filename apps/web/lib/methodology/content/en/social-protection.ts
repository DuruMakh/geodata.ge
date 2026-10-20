import type { MethodologyContent } from "../../types";

const SCOPE = "Annual figures from the Social Service Agency (SSA) on four pages, 2013–2025. Social payments: the money paid by each of SSA’s programmes and by all of them together, in million GEL or as % of GDP, for Georgia. Pensions: pensioners, IDP-status pensioners and the high-mountain supplement, the money paid and the average pension, for Georgia, each region and each municipality. Subsistence allowance: receiving families and the people in them, also by SSA’s eight age groups, families kept on the allowance through the employment programme, families and people registered in the database, and the money paid, for the same places. Social package: recipients, money and the average per month by eligibility group, for Georgia. 2026 is left out until its 12 months are published. Children and maternity pages, the IDP allowance page, funded pensions, care institutions, disability healthcare, pensions by age and sex, monthly figures and the years before 2013 are not shown.";
const SOURCES = "SSA runs these programmes and publishes their statistics on its website, ssa.moh.gov.ge, month by month: one workbook a year for each table, with one sheet or column for each month. SSA is the only source of the people and money shown. Fiscal.ge reads 24 of SSA’s tables: pension tables 1, 2 and 4; subsistence allowance tables 1, 2 and 3 (age groups); table 1 of the targeted social assistance database; social package tables 1, 2 and 10; and the tables of the other programmes on Social payments: two for the maternity, childcare and adoption benefit (table 01, and table 03 for 2013) and one for each of the rest. Geostat also publishes SSA’s December national counts in its social protection tables. For the 46 comparisons recorded, SSA’s figures and Geostat’s match; Geostat’s tables are used only as this check and are not shown. Three Geostat files already served on the site are used to calculate figures: the population on 1 January (Population pages), the consumer price index (Inflation pages) and nominal GDP (Economy pages).";
const PROGRAMMES = "The state pension is SSA’s monthly pension; IDP-status pensioners are the pensioners who also have internally displaced person status, and they are part of the state pension. The high-mountain supplement is paid on top of the pension to pensioners who live in high-mountain settlements, so its average is not added to the pension. The subsistence allowance is paid to families who applied and were scored in the targeted social assistance database: “registered in the database” counts every family and person scored, whether or not they receive money. The social package is paid to the eligibility groups SSA lists: people with disabilities, family members who lost a breadwinner, war participants, victims of political repression and other groups. The other rows of Social payments are SSA’s smaller programmes, such as the IDP and refugee allowance, state compensation and academic stipends, child benefits and utility subsidies, shown as money only.";
const YEARLY = "SSA publishes every figure month by month, and a year is built the same way everywhere. People and families are SSA’s December count, as published: the December 2025 count is the figure for 2025. Money paid is the sum of SSA’s 12 monthly “amount transferred” totals, added up by Fiscal.ge. A December count therefore says how many people received a benefit at the end of the year, and a year’s money says how much was paid in all 12 months.";
const CALCULATED = "These figures are SSA’s own: every December count and every monthly amount, for Georgia, each region and each municipality, and the social package groups. These are calculated by Fiscal.ge and marked “Calculated by Fiscal.ge” in Excel: each year’s money (the sum of 12 months); the average per month, the year’s money divided by the sum of its 12 monthly counts, so it is what one recipient got in an average month (for the subsistence allowance, per receiving family, from the money and counts of regular recipients; for a social package group, the money paid to the group divided by the group’s recipients summed over the 12 months); the average at 2025 prices, the average multiplied by 2025’s average consumer price index and divided by that year’s, using Geostat’s headline index for every place; the share of residents; Social payments as % of GDP, the year’s money divided by Geostat’s nominal GDP; All programmes, the sum of the programme rows; people with disabilities in 2025, the sum of SSA’s four printed disability totals; and a municipality for which SSA prints two rows, such as Telavi’s, which is their sum.";
const SHARE = "The share of residents is the December count divided by the population on 1 January of the next year, times 100: for December 2025, the population on 1 January 2026. That is the population date nearest to the December count. The population is Geostat’s, as the Population pages show it, for Georgia, each region and each municipality. It starts on 1 January 2015, so shares start in 2014. A place without a population figure has no share for that year: a gap, not zero. SSA’s database table also prints its own share of registered people in the whole population; Fiscal.ge calculates its own instead, so that one population source and one date rule apply to every year and place. Geostat recalculated the population on 1 January 2025 from the 2024 census, and the 2024 share divides by it. So shares from 2024 are not directly comparable with earlier years, and the chart and table mark 2024 as a new counting on every share.";
const NO_SUMS = "People are never added across programmes: a pensioner can also receive the high-mountain supplement or live in a family on the subsistence allowance, so adding the counts would count one person more than once. Money can be added across programmes, and Social payments does so in its All programmes row.";
const YEARS = "The pages start in 2013, the first full year of SSA’s current tables: in September 2012 SSA changed its tables, and disability and survivor pensions moved from the pension to the social package. A December count starts with its first December, and a money or average series starts in its first full 12-month year: the high-mountain pension supplement has pensioners from 2016 and money and an average from 2017; the disability severity groups of the social package have recipients from 2017 and money and an average from 2018; war participants have recipients from 2019 and money and an average from 2020. Social payments keeps every year SSA published, so a programme that ran for only part of a year shows the months published: workplace-injury compensation 9 months in 2013, the child benefit for the third and later child 6 months in 2014, the electricity tariff subsidy 5 months in 2015, the high-mountain pension and social package supplements 4 months each in 2016, the high-mountain child benefit 10 months and the high-mountain doctors’ and nurses’ supplement 3 months in 2016, the large-family electricity subsidy 6 months in 2019, and COVID-19 compensation 6 months in each of 2020 and 2021. The table marks these years. All programmes counts what was paid in each year, these months included.";
const SUBSISTENCE = "From 2022, families in which at least one member works under the state employment programme keep their place in the database and their payment for up to 4 years. SSA counts them in a column of their own, so from 2022 “receiving the allowance” and the people in receiving families leave them out; the chart and table mark 2022 as a new counting on those rows and their shares. The families kept on the allowance through the employment programme are their own row, from 2022. Their money is part of the subsistence allowance total and is also shown on its own; it starts in 2023, because SSA prints it only from the December 2022 table, so 2022 has no full year of it. No people count is shown for these families. The people in receiving families are also shown by SSA’s eight age groups (subsistence allowance table 3), as SSA prints them: 0–6, 6–18, 18–30, 30–40, 40–60, 60–65, 65–70, and 70 and over. SSA’s bands share their end ages and SSA does not say which band an age on an edge belongs to. The age groups leave out the employment-programme people too, carry the same 2022 new counting, and add up to the people in receiving families in every place and year. They have no share of residents.";
const PACKAGE = "SSA prints one column for each eligibility group of the social package, and the groups add up to SSA’s total every year. From October 2017 SSA splits people with disabilities into children with disabilities (aged 0–18) and severe, significant and moderate disability; these four rows are parts of people with disabilities and are not added to the other groups. In 2025 SSA redesigned the group table: disability is split by severity there, and state-compensation recipients become a column across the groups. So people with disabilities in 2025 is the sum of SSA’s four disability totals, and other groups means compensation recipients, utility-subsidy recipients and “other” up to 2024, and defence veterans and the social package by acquired right from 2025. The chart and table mark 2025 as a new counting on both rows. In January–May 2019 SSA’s money table heads one column “war participants” while its people table shows utility-subsidy recipients there; Fiscal.ge follows the people table, so that money is in other groups. War participants’ money in 2019 covers only June–December and is not shown, so the 2019 check that the groups’ money adds up to the total is made month by month in the research package.";
const PLACES = "SSA’s rows use old district names and, in some years, two rows for one of today’s municipalities. Every row is matched to today’s municipalities and regions through a reviewed list of SSA’s labels, and a label the list does not know stops the preparation. A region’s figure is SSA’s printed region total and Georgia’s is SSA’s printed national total, never sums made by Fiscal.ge. Tbilisi is one place, a region with one page. SSA also prints rows for Akhalgori and Upper Abkhazia; they are part of SSA’s Georgia total and are kept in the data file, but they are not places on the map, have no page and have no share. Municipal codes 05, 42, 43, 46 and 64 stay excluded, as on the Budget and Population pages.";
const DIFFERENCES = "Where SSA’s printed total differs from its own parts, the total is shown as printed and nothing is adjusted. Four such differences are recorded, and the checks allow exactly these. In May 2022 SSA’s printed social package money total is 56 GEL less than the sum of its group columns. In May 2021 SSA’s printed number of social package recipients is 1 more than the sum of its group columns, so the groups’ monthly counts for 2021 add up to 1 less than the total’s. In 2015 the municipalities’ money for IDP-status pensioners in Shida Kartli adds up to 404,686 GEL more than SSA’s region total, and in 2013 the municipalities’ subsistence allowance money in Kvemo Kartli adds up to 126 GEL less than the region total; the same differences appear in SSA’s Georgia total.";
const GAPS = "A missing value is a gap in the chart, a dash in the table and an empty cell in Excel, never zero. A blank cell in SSA’s tables is a blank, not zero: in March 2020 SSA left the national count blank for the high-mountain electricity discount and the large-family electricity subsidy, and the pages use only these programmes’ money. In July 2022 SSA left the national count of people with moderate disability blank, so that group has no 2022 average. In March–May and November–December 2020 SSA’s tables show far fewer electricity tariff subsidy recipients and much smaller payments than in the other months; the year’s money includes those months as published. Nothing is estimated or filled in.";

export const SOCIAL_PROTECTION_METHODOLOGY_CONTENT: MethodologyContent = {
  "id": "social-protection",
  "slug": "social-protection",
  "title": "Social protection",
  "summary": "Pensions, the subsistence allowance, the social package and the money paid in social benefits in Georgia, its regions and municipalities, from the Social Service Agency’s monthly statistics.",
  "metaDescription": "Pensions, subsistence allowance, social package and social payments in Georgia: Social Service Agency figures, yearly rules and what Fiscal.ge calculates.",
  "reviewedAt": "2026-10-20",
  "archiveManifestId": "social-protection",
  "coverageSource": {
    "kind": "archive"
  },
  "canonicalDocuments": [
    "docs/data-methodology/social-protection-annual.md"
  ],
  "disclosure": "Counts and monthly amounts are figures published by the Social Service Agency. Fiscal.ge adds up each year’s 12 monthly amounts and calculates the averages, the values at 2025 prices, the shares of residents and the shares of GDP; the pages give no reasons for changes.",
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
      "value": "Persons; families; GEL; %"
    }
  ],
  "sections": [
    { "id": "scope", "kind": "scope", "title": "What do the pages cover?", "paragraphs": [SCOPE] },
    { "id": "sources", "kind": "sources", "title": "Where do the figures come from?", "paragraphs": [SOURCES] },
    { "id": "programmes", "kind": "classification", "title": "The benefits and who gets them", "paragraphs": [PROGRAMMES] },
    { "id": "yearly-rule", "kind": "classification", "title": "December counts and 12-month sums", "paragraphs": [YEARLY] },
    { "id": "calculated", "kind": "classification", "title": "What SSA published and what Fiscal.ge calculated", "paragraphs": [CALCULATED] },
    { "id": "share", "kind": "classification", "title": "Share of residents and the 2024 census", "paragraphs": [SHARE] },
    { "id": "no-sums", "kind": "classification", "title": "Why people are never added across programmes", "paragraphs": [NO_SUMS] },
    { "id": "years", "kind": "classification", "title": "First years and partial years", "paragraphs": [YEARS] },
    { "id": "subsistence", "kind": "classification", "title": "The subsistence allowance and the employment programme", "paragraphs": [SUBSISTENCE] },
    { "id": "social-package", "kind": "classification", "title": "Social package groups and the 2025 redesign", "paragraphs": [PACKAGE] },
    { "id": "places", "kind": "classification", "title": "Districts, municipalities and excluded areas", "paragraphs": [PLACES] },
    { "id": "differences", "kind": "limitations", "title": "Where SSA’s own sums do not add up", "paragraphs": [DIFFERENCES] },
    { "id": "gaps", "kind": "classification", "title": "Gaps and blank months", "paragraphs": [GAPS] },
    {
      "id": "limitations",
      "kind": "limitations",
      "title": "What the pages leave out",
      "paragraphs": [
        "The pages describe the figures and state no causes or explanations for their changes. Fiscal.ge makes no forecasts and adds no growth figures. Not shown: children and maternity pages, the IDP allowance page, a table of the small programmes, funded pensions, care institutions, disability healthcare, pensions by age and sex, the subsistence allowance by sex, household size or score, monthly figures, the years before 2013, 2026 before its year is complete and comparisons with the budget. Social protection spending in the state budget is on the Budget pages."
      ]
    },
    {
      "id": "validation",
      "kind": "validation",
      "title": "How are the figures checked?",
      "paragraphs": [
        "The data file holds 21,988 values. Each is read again from its cells in SSA’s original workbooks by the research package and by a second program written separately, and the original files are checked against their recorded fingerprints. The checks reject a changed value, a missing, extra or duplicate value, a year outside 2013–2025, a 12-month sum with fewer months than SSA published and a zero where SSA’s cell is blank. They also require: each year’s money to equal the sum of its monthly cells; the municipalities and excluded areas to add up to their region and the regions to Georgia; the subsistence allowance age groups to add up to the people in receiving families; the social package groups to add up to SSA’s total; All programmes to equal the sum of its rows; and SSA’s December national counts to match Geostat’s for the 46 comparisons recorded. The only exceptions are SSA’s own sums described above. Fixed values are compared too: in 2025, 888,518 pensioners in December, 4,262,309,090 GEL paid in pensions, an average pension of 405.13 GEL (133.23 GEL in 2013), 129,506 receiving families with 463,122 people, 54,842 families on the employment programme, 397,144 registered families, 855,291,818 GEL of subsistence allowance, 187,764 social package recipients and 544,241,359 GEL paid to them, and 6,166,123,811 GEL across all programmes."
      ]
    },
    {
      "id": "archive",
      "kind": "archive",
      "title": "Original sources",
      "paragraphs": [
        "17 originals are available: captures of SSA’s statistics list and of 8 of its topic pages, retrieved on 16 October 2026; the links of 4 more topic pages, read on 18 October 2026; and Geostat’s population, consumer price index (in English and Georgian) and nominal GDP workbooks, which are also on the Demography, Inflation and GDP methodology pages. SSA renames its files with every upload, so the pages link each table to its topic page rather than to a single file. Fiscal.ge keeps all 1,027 SSA workbooks it collected, with their fingerprints, but does not republish them here. HTML pages download as text files. Excel follows the selected page, place, series and years and lists their sources."
      ]
    }
  ],
  "decisions": [
    { "id": "social_protection.scope", "group": "social-protection", "title": "What do the pages cover?", "statusLabel": "Fiscal.ge decision", "summary": SCOPE, "detail": [], "canonicalDecisionIds": ["social_protection.scope"] },
    { "id": "social_protection.sources", "group": "social-protection", "title": "Where do the figures come from?", "statusLabel": "Fiscal.ge decision", "summary": SOURCES, "detail": [], "canonicalDecisionIds": ["social_protection.sources"] },
    { "id": "social_protection.yearly_rule", "group": "social-protection", "title": "December counts and 12-month sums", "statusLabel": "Fiscal.ge decision", "summary": YEARLY, "detail": [], "canonicalDecisionIds": ["social_protection.yearly_rule"] },
    { "id": "social_protection.calculated", "group": "social-protection", "title": "What SSA published and what Fiscal.ge calculated", "statusLabel": "Fiscal.ge decision", "summary": CALCULATED, "detail": [], "canonicalDecisionIds": ["social_protection.calculated"] },
    { "id": "social_protection.share", "group": "social-protection", "title": "Share of residents and the 2024 census", "statusLabel": "Fiscal.ge decision", "summary": SHARE, "detail": [], "canonicalDecisionIds": ["social_protection.share"] },
    { "id": "social_protection.years", "group": "social-protection", "title": "First years and partial years", "statusLabel": "Fiscal.ge decision", "summary": YEARS, "detail": [], "canonicalDecisionIds": ["social_protection.years"] },
    { "id": "social_protection.subsistence", "group": "social-protection", "title": "The subsistence allowance and the employment programme", "statusLabel": "Official fact", "summary": SUBSISTENCE, "detail": [], "canonicalDecisionIds": ["social_protection.subsistence"] },
    { "id": "social_protection.social_package", "group": "social-protection", "title": "Social package groups and the 2025 redesign", "statusLabel": "Official fact", "summary": PACKAGE, "detail": [], "canonicalDecisionIds": ["social_protection.social_package"] },
    { "id": "social_protection.places", "group": "social-protection", "title": "Districts, municipalities and excluded areas", "statusLabel": "Fiscal.ge decision", "summary": PLACES, "detail": [], "canonicalDecisionIds": ["social_protection.places"] },
    { "id": "social_protection.differences", "group": "social-protection", "title": "Where SSA’s own sums do not add up", "statusLabel": "Limitation", "summary": DIFFERENCES, "detail": [], "canonicalDecisionIds": ["social_protection.differences"] }
  ],
  "technicalAppendix": [],
  "showTechnicalAppendix": false
};

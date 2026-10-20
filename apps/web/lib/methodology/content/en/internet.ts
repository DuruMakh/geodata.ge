import type { MethodologyContent } from "../../types";

const SCOPE = "Annual figures from Geostat’s survey of ICT usage in households, on four pages, and a page for Georgia and for each region. Internet at home: the share of homes with internet and with a computer, for Georgia, towns, villages and the 11 regions, 2016–2026. Internet users: who used the internet in the last 3 months, who has never used it and who goes online every day or almost every day, by group. Shopping and services online: who bought or ordered goods or services online, by group, what internet users do online and who dealt with public services over the internet. Phones and computers: who owns a mobile phone or a smartphone and who used a computer in the last 3 months, by group. The groups are everyone, towns, villages, women, men and four age groups. The number of activities people carry out online or with software, frequency of computer use, mobile phone and smartphone use, mobile internet away from home and digital skills are outside these pages.";
const SURVEY = "The figures come from Geostat’s yearly household survey of the use of information and communication technologies. Geostat runs it once a year, in June or July: its tables label each row “June, 2016”, “July, 2018” and so on. Each year on the pages is one survey. The figures are estimates from a sample of households and people, not a count of everyone, so a small difference between two groups or two years may not be meaningful. The pages read ten of the 17 tables Geostat publishes for the survey.";
const WHO_HOMES = "Internet at home counts households: the share of households with internet access and the share with computer access, as Geostat’s tables 01 and 08 title them.";
const WHO_PEOPLE = "Used the internet in the last 3 months, never used the internet, owns a mobile phone, owns a smartphone and used a computer in the last 3 months count people aged 6 and older (tables 02, 12, 14 and 09). The 6–14 age group appears only under these headings.";
const WHO_USERS = "Online every day or almost every day and what internet users do online count people aged 15 and older who used the internet in the last 3 months: Geostat’s note under tables 04 and 03 reads “The indicator is calculated for the population who used internet within the last 3 months.” Bought or ordered online counts people aged 15 and older who used the internet in the last 12 months, by the note under table 05. Public services online counts people aged 15 and older, and contact with public authorities or public services for private purposes in the last 12 months (table 16).";
const REGIONS_SAMPLE = "Regional figures cover homes only. Under tables 01 and 08 Geostat prints “…” for five regions in 2016–2019 and notes: “The data is not available due to small sample size of the survey. Survey sample size has been increased since 2020.” So Kvemo Kartli, Samtskhe-Javakheti, Guria, Mtskheta-Mtianeti and Racha-Lechkhumi and Kvemo Svaneti start in 2020, and their pages begin that year. Those years are gaps, not zero.";
const REGIONS_IMERETI = "Geostat’s note says: “The data of 2016-2019 includes Imereti, Racha-Lechkhumi and Kvemo Svaneti regions.” So Imereti’s figure before 2020 also covers Racha-Lechkhumi and Kvemo Svaneti, and from 2020 it covers Imereti alone. For 2016–2019 Geostat also prints an “Other regions” column for Kvemo Kartli, Samtskhe-Javakheti, Guria and Mtskheta-Mtianeti together; the pages do not show it.";
const EXCLUDED = "Two of Geostat’s tables are left out because what they count changed. In the mobile internet table (06) the 2016 value is marked with a note that it “is calculated for the population who used mobile devices to access the wireless internet away from home or work”, while later years count access from any location. The tables of the number of internet and software activities (07 and 11) count activities ever carried out in 2016–2017, in the last 12 months in 2018–2024 and in the last 3 months from 2025. The other tables kept for reference and not served are frequency of computer use (10), using a mobile phone or a smartphone (13 and 15) and digital skills (17), which starts in 2025.";
const ACTIVITIES = "The rows of What internet users do online follow Geostat’s table 03: participating in social networks; telephoning or video calls over the internet; reading online news sites, newspapers or news magazines; sending or receiving e-mails; seeking health-related information; finding information about goods or services; looking for a job or sending a job application; internet banking; and downloading software other than games. Each is a share of internet users, and one person can do several, so the rows do not add up to 100.";
const EGOV = "The rows of Public services online follow Geostat’s table 16: interacted with public authorities or public services over the internet; obtaining information from websites of public authorities; downloading official forms; and submitting completed forms. The first row is everyone who interacted with public authorities or public services over the internet; one person can do several of the three kinds, so they add up to more than it.";
const VALUES = "Fiscal.ge calculates nothing on these pages: no averages, differences or totals, and no gap is filled. Every value is Geostat’s percentage, shown to one decimal as Geostat’s cells display it. Geostat’s “15 years and older” column of the tables by age is not shown, since the pages show the age groups. A year without a value is a gap in the chart, a dash in the table and an empty Excel cell, never zero. The pages describe the figures and state no causes for their changes.";
const VALIDATION = "1,055 values are published, for 102 series. Each is read again from its cell in Geostat’s original table by two separate programs, and the original files are checked against their recorded fingerprints. Every served value is also found, with the same rounding, in Geostat’s Georgian edition of the table. The checks also require: the answers of each split to add up to 100 within 0.01 points for every group and year (last internet use, last computer use, frequency of internet use, and whether people dealt with public services online or not); everyone to lie between women and men and between towns and villages; Georgia’s homes to lie between towns and villages; every value to lie between 0 and 100; and the published anchors to match Geostat: homes with internet 70.1% in 2016 and 93.5% in 2026 (Tbilisi 98.2%, villages 89.0%, Guria 91.1%), 89.6% of people aged 6 and older using the internet in the last 3 months, 38.6% of internet users buying online (63.0% at ages 15–29), 61.0% using internet banking and 93.3% owning a mobile phone, all in 2026. The test runs show that altered, missing or extra values are caught.";
const ARCHIVE = "36 originals from Geostat, retrieved on 20 October 2026, are available: all 17 tables of the survey in English and in Georgian, and captures of Geostat’s English and Georgian pages that link them. Ten English tables supply the values on the pages; the Georgian editions were checked against them, and the other tables are kept for reference and no value is read from them. HTML pages download as text files. Excel follows the selected series and years and lists their source files.";

export const INTERNET_METHODOLOGY_CONTENT: MethodologyContent = {
  "id": "internet",
  "slug": "internet",
  "title": "Internet and technology",
  "summary": "Homes with internet and a computer, internet users, online shopping and services, and mobile phone, smartphone and computer use in Georgia, year by year, from Geostat’s household survey.",
  "metaDescription": "Internet at home by region, internet users, online shopping, public services, phones and computers, from Geostat’s yearly survey: who is counted and sources.",
  "reviewedAt": "2026-10-20",
  "archiveManifestId": "internet",
  "coverageSource": {
    "kind": "archive"
  },
  "canonicalDocuments": [
    "docs/data-methodology/internet-annual.md"
  ],
  "disclosure": "Each year is one survey, run in June or July. The figures are estimates from a sample, so small differences between groups or years may not be meaningful.",
  "keyFacts": [
    {
      "label": "Coverage",
      "valueKind": "coverage"
    },
    {
      "label": "Frequency",
      "valueKind": "frequency",
      "value": "Annual (one survey, June or July)"
    },
    {
      "label": "Basis",
      "valueKind": "basis",
      "value": "Survey estimate"
    },
    {
      "label": "Units",
      "valueKind": "unit",
      "value": "% of homes or of people"
    }
  ],
  "sections": [
    { "id": "scope", "kind": "scope", "title": "What do the pages cover?", "paragraphs": [SCOPE] },
    { "id": "sources", "kind": "sources", "title": "Where do the figures come from?", "paragraphs": [SURVEY] },
    { "id": "who", "kind": "classification", "title": "Who is counted under each heading?", "paragraphs": [WHO_HOMES, WHO_PEOPLE, WHO_USERS] },
    { "id": "regions", "kind": "limitations", "title": "Regions and the larger sample from 2020", "paragraphs": [REGIONS_SAMPLE, REGIONS_IMERETI] },
    { "id": "excluded", "kind": "limitations", "title": "Tables left out", "paragraphs": [EXCLUDED] },
    { "id": "activities", "kind": "classification", "title": "Activities and public services online", "paragraphs": [ACTIVITIES, EGOV] },
    { "id": "values", "kind": "classification", "title": "Values as Geostat publishes them", "paragraphs": [VALUES] },
    { "id": "validation", "kind": "validation", "title": "How are the figures checked?", "paragraphs": [VALIDATION] },
    { "id": "archive", "kind": "archive", "title": "Original sources", "paragraphs": [ARCHIVE] }
  ],
  "decisions": [
    { "id": "internet.scope", "group": "internet", "title": "What do the pages cover?", "statusLabel": "Fiscal.ge decision", "summary": SCOPE, "detail": [], "canonicalDecisionIds": ["internet.scope"] },
    { "id": "internet.survey", "group": "internet", "title": "Where do the figures come from?", "statusLabel": "Official fact", "summary": SURVEY, "detail": [], "canonicalDecisionIds": ["internet.survey"] },
    { "id": "internet.who", "group": "internet", "title": "Who is counted under each heading?", "statusLabel": "Official fact", "summary": `${WHO_HOMES} ${WHO_PEOPLE} ${WHO_USERS}`, "detail": [], "canonicalDecisionIds": ["internet.who"] },
    { "id": "internet.regions", "group": "internet", "title": "Regions and the larger sample from 2020", "statusLabel": "Limitation", "summary": `${REGIONS_SAMPLE} ${REGIONS_IMERETI}`, "detail": [], "canonicalDecisionIds": ["internet.regions"] },
    { "id": "internet.excluded", "group": "internet", "title": "Tables left out", "statusLabel": "Limitation", "summary": EXCLUDED, "detail": [], "canonicalDecisionIds": ["internet.excluded"] },
    { "id": "internet.activities", "group": "internet", "title": "Activities and public services online", "statusLabel": "Official fact", "summary": `${ACTIVITIES} ${EGOV}`, "detail": [], "canonicalDecisionIds": ["internet.activities"] },
    { "id": "internet.values", "group": "internet", "title": "Values as Geostat publishes them", "statusLabel": "Fiscal.ge decision", "summary": VALUES, "detail": [], "canonicalDecisionIds": ["internet.values"] }
  ],
  "technicalAppendix": [],
  "showTechnicalAppendix": false
};

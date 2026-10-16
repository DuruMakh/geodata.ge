import type { MethodologyContent } from "../../types";

const UNIFIED_REPORT = "https://geostat.ge/media/76844/Unified-Report-on-Criminal-Justice-Statistics-%28Dec%2C-2025%29.pdf";

const SCOPE = "Annual figures from Geostat on five pages. Recorded crimes: all recorded crimes and 11 types of crime, 2015–2025. Convictions: people convicted by the courts, by type of crime, age, sex and sentence, 2001–2025. Prisons: prisoners at the end of each year, by sex and age, 2001–2025, and sentenced or awaiting trial from 2010. Victims: victims of crime by sex, age and citizenship, 2007–2011 and 2015–2025. Road accidents: accidents, accidents caused by drunk driving, and the people killed and injured, 2001–2025. Every count can also be read per 100,000 people. Monthly and half-year figures, including Geostat’s January–June 2026 columns, are not shown.";
const SOURCES = "Geostat publishes the figures, and each table names the agency that collects them. Recorded crimes: “Source: Ministry of Internal Affairs Of Georgia”. Convictions: each of the three tables prints “Source: Supreme Court of Georgia.” Prisons: “Source: 2001-2007 Ministry of Justice of Georgia, 2008-2017 Ministry of Corrections of Georgia, from 2018 Ministry of Justice of Georgia.” Victims: “Source: 2007-2011 Ministry of Internal Affairs of Georgia. From 2015 Prosecutor's Office of Georgia.” Road accidents: “Source: Ministry of Internal Affairs of Georgia.” Fiscal.ge reads 7 of the workbooks on Geostat’s Criminal Justice Statistics page. Every count is shown as Geostat published it; the rates per 100,000 people are the only figures Fiscal.ge calculates.";
const RECORDED = "A recorded crime is a crime on which an investigation was started, by any investigative agency in Georgia and not only the police. Geostat’s note on the table: “Note: Includes all investigative agencies of Georgia.” The table counts crimes, not people, and it is not the same as the crime that actually happened: a crime that nobody reports, or on which no investigation is started, is not in it. The 11 types of crime add up exactly to all recorded crimes in every year. Geostat also publishes a table for 2001–2011 with older groups, such as “Heavy crimes”, “Theft” and “Hooliganizm”. They cannot be matched to the current types, and 2012–2014 are missing, so that table is kept with the original sources and not shown. Its footnote reads: “* Since May 2005, amendments were made to the Code of Criminal Procedure, envisaging abolishment of investigatory bodies and starting preliminary investigation immediately from the moment of committing crime. Due to this and other reasons the number of registered crimes is increased.”";
const REGISTRATION_2018 = "Recorded crimes rose from 37,944 in 2017 to 58,412 in 2018, in almost every type of crime. Counts from 2018 are not comparable with those for 2015–2017, and Fiscal.ge does not say how much of the rise is a real increase in crime. Charts leave a gap and draw a dashed “new counting” line at 2018 on every recorded-crime series, tables mark the year, and no change is calculated across it. For context, in Geostat’s data crimes against life rose from 1,013 in 2017 to 2,154 in 2018. In Geostat’s December 2025 Unified Report on Criminal Justice Statistics, the table of recorded crimes for 2025 lists 1,119 of the 1,486 crimes against life as “Incitement to suicide article 115 *”, and the table’s note reads: “* Data includes full details of the investigation initiated under Art. 115 and 116 of the Criminal Code (both the facts of suicide and cases of natural death, accidents, etc.);”.";
const SENTENCES = "Convictions count the people convicted by the courts in the year, as the Supreme Court of Georgia reports them. Geostat publishes them in three tables: by type of crime, by age and sex, and by sentence. All three print the same total every year, and each breakdown adds up exactly to it. The sentence is the penalty the court imposed. Prison is Geostat’s “Imprisonment”. “Suspended sentence” on these pages is the row Geostat’s English table calls “Suspended conviction”. “Deferred sentence” is the row it calls “Suspended sentence”; Geostat’s Georgian table says that the execution of the verdict was deferred. There were 50 deferred sentences in 2001 and 2 in 2025. Community work is Geostat’s “Public work”. A fine, corrective labour and other penalties complete the list.";
const PRISONS = "Prisoners are counted at the end of each year, on 31 December, and include people awaiting trial as well as those serving a sentence. Geostat splits them into sentenced and awaiting trial only from 2010 and prints “...” before, so those two series start in 2010. Geostat’s note on the table: “Note: According to the new „Code on Imprisonment” (which entered into force on 1st October, 2010), all persons incarcerated in penitentiary establishements are referred as „Pre-trial and Convicted Inmates”. The same category can also be referred with a general term „Inmates”.” The agency changed twice: the Ministry of Justice (2001–2007), the Ministry of Corrections (2008–2017) and the Ministry of Justice again (from 2018). Geostat does not mark this as a change of counting, so the charts do not either. Women and men, and adults and juveniles, each add up exactly to all prisoners, and from 2010 so do sentenced and awaiting trial. Geostat’s split of women and men within each group is kept in the original file and not listed.";
const VICTIMS = "Victims are the people a crime was committed against, counted by sex, age and citizenship. Each breakdown adds up exactly to all victims, and each has a group for people whose sex, age or citizenship is not stated. Geostat’s source line: “Source: 2007-2011 Ministry of Internal Affairs of Georgia. From 2015 Prosecutor's Office of Georgia.” Geostat publishes nothing for 2012–2014, so those years are a gap on every line, and the gap also separates the two agencies’ figures. The age groups are Geostat’s: under 17, 17–24, 25–44 and over 44.";
const ROAD = "Road accidents are the road traffic accidents recorded by the Ministry of Internal Affairs, with the people killed and injured in them. Geostat prints “…” for accidents caused by drunk driving in 2002, so that year is a gap. On those accidents Geostat notes: “*Data on road traffic accidents caused by drunk driving from 2001 to 2024 covers only the jurisdiction of the Patrol Police Department of the Ministry of Internal Affairs. However, starting from 2025, the data on road traffic accidents fully covers the entire territory of Georgia. Accordingly, the 2025 data is not comparable with data from previous years.” The chart therefore marks 2025 as a new counting on that series only, and the table marks the year: that value cannot be compared with 2001–2024.";
const PER_100K = "The per 100,000 people view is the only figure Fiscal.ge calculates. Each count is divided by Georgia’s population on 1 January of the same year, as Geostat publishes it and the Demography pages show it, and multiplied by 100,000. The result is shown to one decimal and marked as calculated in the Excel download. For prisons, the end-of-year count is compared with the population on 1 January of that year. The population starts on 1 January 2004, so 2001–2003 have no rate: they are gaps, never zero. Geostat recalculated the population on 1 January 2025 from the 2024 census, so the 2025 rates use the census-based population. Every rate series therefore marks 2025 as a new counting, and rates on either side of it are not directly comparable. Excel downloads of this view say that the rates are calculated by Fiscal.ge from Geostat’s counts and population.";
const NO_MAP = "Geostat publishes none of these tables by region, so the pages show Georgia as a whole and have no map. The monthly Unified Report splits prosecutions and convictions by prosecutor’s districts, which do not match the 11 regions, and Fiscal.ge does not convert them into regions.";
const GAPS = "A missing value is a gap in the chart, a dash in the table and an empty cell in Excel, never zero. Geostat prints “…” and “...” where it gives no figure: for accidents caused by drunk driving in 2002, and for sentenced and awaiting-trial prisoners before 2010. A 0 in Geostat’s tables is a published count of zero, for example corrective labour in many years, and it is shown as 0. Nothing is estimated or filled in. Only whole years are shown; Geostat’s January–June 2026 columns are left out.";

export const CRIME_METHODOLOGY_CONTENT: MethodologyContent = {
  "id": "crime",
  "slug": "crime",
  "title": "Crime and justice",
  "summary": "Recorded crimes, convictions, prisoners, victims and road accidents in Georgia, as Geostat publishes them, with each count also shown per 100,000 people.",
  "metaDescription": "Recorded crimes, convictions, prisons, victims and road accidents in Georgia: Geostat’s figures and sources, and the 2018 counting change.",
  "reviewedAt": "2026-10-16",
  "archiveManifestId": "crime",
  "coverageSource": {
    "kind": "archive"
  },
  "canonicalDocuments": [
    "docs/data-methodology/crime-annual.md"
  ],
  "disclosure": "All counts are figures published by Geostat. The pages describe them and give no reasons; the rates per 100,000 people are Fiscal.ge’s only calculation.",
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
      "value": "Crimes; persons; accidents; per 100,000 people"
    }
  ],
  "sections": [
    { "id": "scope", "kind": "scope", "title": "What do the pages cover?", "paragraphs": [SCOPE] },
    { "id": "sources", "kind": "sources", "title": "Where do the figures come from?", "paragraphs": [SOURCES] },
    { "id": "recorded", "kind": "classification", "title": "What a recorded crime is", "paragraphs": [RECORDED] },
    { "id": "registration-2018", "kind": "classification", "title": "The 2018 counting change", "paragraphs": [REGISTRATION_2018], "sourceLinks": [{ "href": UNIFIED_REPORT, "label": "Unified Report on Criminal Justice Statistics, December 2025 (Geostat, PDF)" }] },
    { "id": "sentences", "kind": "classification", "title": "Convictions and sentences", "paragraphs": [SENTENCES] },
    { "id": "prisons", "kind": "classification", "title": "Prisoners at the end of the year", "paragraphs": [PRISONS] },
    { "id": "victims", "kind": "classification", "title": "Victims: the 2012–2014 gap and the change of agency", "paragraphs": [VICTIMS] },
    { "id": "road", "kind": "classification", "title": "Road accidents and drunk driving", "paragraphs": [ROAD] },
    { "id": "per-100k", "kind": "classification", "title": "Per 100,000 people", "paragraphs": [PER_100K] },
    { "id": "no-map", "kind": "classification", "title": "Why there is no map", "paragraphs": [NO_MAP] },
    { "id": "gaps", "kind": "classification", "title": "Gaps, dashes and zeros", "paragraphs": [GAPS] },
    {
      "id": "limitations",
      "kind": "limitations",
      "title": "What the pages leave out",
      "paragraphs": [
        "The pages describe the figures and state no causes or explanations for their changes, and they compare Georgia with no other country. Fiscal.ge creates no shares, solved rates, growth figures or forecasts; the rates per 100,000 people are its only calculation. Not shown: monthly and half-year figures, any regional view, the share of crimes solved, crimes by article of the Criminal Code, prosecutions and the other contents of the monthly Unified Report, hate crimes, the 2001–2011 recorded-crimes table, juvenile offenders by type of offence and human trafficking. The last three tables are kept with the original sources."
      ]
    },
    {
      "id": "validation",
      "kind": "validation",
      "title": "How are the figures checked?",
      "paragraphs": [
        "1,262 counts in 63 series are published. Each is read again from its cell in Geostat’s original workbook and compared with the stored value, the printed row label and the year heading, and the original files are checked against their recorded fingerprints. A second program, written separately, reads every workbook again and must find the same values; it also compares the 10 Georgian workbooks with the English ones cell by cell. The checks also require, in every year: the 11 types of crime to add up exactly to all recorded crimes; for convictions, the types of crime, the age groups, the two sexes and the sentences each to add up exactly to the total, and the three convictions tables to print the same total; for prisons, women and men and adults and juveniles each to add up to all prisoners, and from 2010 sentenced and awaiting trial too; and for victims, sex, age and citizenship each to add up to the total. Fixed values are compared too: recorded crimes in 2015 (35,096), 2018 (58,412) and 2025 (54,134), people convicted in 2025 (22,767), prisoners at the end of 2025 (11,153), victims in 2025 (17,209) and road accidents in 2025 (5,969)."
      ]
    },
    {
      "id": "archive",
      "kind": "archive",
      "title": "Original sources",
      "paragraphs": [
        "22 originals from Geostat, retrieved on 16 October 2026, are available: the 10 English workbooks from Geostat’s Criminal Justice Statistics page, their 10 Georgian versions and captures of the page in both languages. 7 English workbooks supply the values on the pages. The Georgian versions hold the same numbers and are kept for their Georgian labels, and the 2001–2011 recorded crimes, juvenile offenders and human trafficking workbooks are kept for reference; no value is read from them. HTML pages download as text files. The December 2025 Unified Report is not stored here; the section on the 2018 counting change links to Geostat’s copy. Excel follows the selected series and years and lists their source files; in the per 100,000 people view it also lists Geostat’s population table."
      ]
    }
  ],
  "decisions": [
    { "id": "crime.scope", "group": "crime", "title": "What do the pages cover?", "statusLabel": "Fiscal.ge decision", "summary": SCOPE, "detail": [], "canonicalDecisionIds": ["crime.scope"] },
    { "id": "crime.sources", "group": "crime", "title": "Where do the figures come from?", "statusLabel": "Fiscal.ge decision", "summary": SOURCES, "detail": [], "canonicalDecisionIds": ["crime.sources"] },
    { "id": "crime.recorded", "group": "crime", "title": "What a recorded crime is", "statusLabel": "Official fact", "summary": RECORDED, "detail": [], "canonicalDecisionIds": ["crime.recorded"] },
    { "id": "crime.registration_2018", "group": "crime", "title": "The 2018 counting change", "statusLabel": "Limitation", "summary": REGISTRATION_2018, "detail": [], "canonicalDecisionIds": ["crime.registration_2018"] },
    { "id": "crime.sentences", "group": "crime", "title": "Convictions and sentences", "statusLabel": "Official fact", "summary": SENTENCES, "detail": [], "canonicalDecisionIds": ["crime.sentences"] },
    { "id": "crime.prisons", "group": "crime", "title": "Prisoners at the end of the year", "statusLabel": "Official fact", "summary": PRISONS, "detail": [], "canonicalDecisionIds": ["crime.prisons"] },
    { "id": "crime.victims", "group": "crime", "title": "Victims: the 2012–2014 gap and the change of agency", "statusLabel": "Official fact", "summary": VICTIMS, "detail": [], "canonicalDecisionIds": ["crime.victims"] },
    { "id": "crime.road", "group": "crime", "title": "Road accidents and drunk driving", "statusLabel": "Official fact", "summary": ROAD, "detail": [], "canonicalDecisionIds": ["crime.road"] },
    { "id": "crime.per_100k", "group": "crime", "title": "Per 100,000 people", "statusLabel": "Fiscal.ge decision", "summary": PER_100K, "detail": [], "canonicalDecisionIds": ["crime.per_100k"] },
    { "id": "crime.no_map", "group": "crime", "title": "Why there is no map", "statusLabel": "Fiscal.ge decision", "summary": NO_MAP, "detail": [], "canonicalDecisionIds": ["crime.no_map"] },
    { "id": "crime.gaps", "group": "crime", "title": "Gaps, dashes and zeros", "statusLabel": "Fiscal.ge decision", "summary": GAPS, "detail": [], "canonicalDecisionIds": ["crime.gaps"] }
  ],
  "technicalAppendix": [],
  "showTechnicalAppendix": false
};

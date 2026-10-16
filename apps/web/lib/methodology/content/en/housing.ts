import type { MethodologyContent } from "../../types";

const SCOPE = "Annual figures from Geostat on building permits, completed buildings and home prices, on four pages, and a page for Georgia and for each region. Building permits and Completed buildings: the number and floor area of permits issued and of buildings put into use, 2006–2025, in total and for each type of building. Home prices: Geostat’s home price index (2020 average = 100) for all homes, flats and detached houses, 2020–2025, and the asking price per m² of newly built flats and houses in Tbilisi’s ten districts, 2021–2025. Regions: permits and completed buildings for the 11 regions, with a page for Georgia and for each region that shows all buildings and residential buildings, 2006–2025. Municipalities, quarterly figures, 2026 and the construction cost index are outside these pages.";
const SOURCES = "The figures come from six Geostat workbooks. Permits and completed buildings: permits by region (0503EN020101), completed buildings by region (0503EN020103) and two yearly tables by type of building, one for permits (0503EN020102c) and one for completed buildings (0503EN020104b), which also give each region’s residential buildings. Home prices: the residential property price index compared with the 2020 average, and residential property prices in Tbilisi by district. Geostat’s metadata for permits and completed objects (certified 30 April 2026) says the survey covers all the municipal authorities that issue construction permits — local architectural services, urban planning services and supervisory bodies — and the whole territory of Georgia except the occupied regions, from 2006. The metadata says the data are based on the information these bodies provide. Geostat compiles them quarterly; the pages show its yearly figures.";
const DEFINITIONS_PERMIT = "Geostat’s metadata defines a construction permit as “An individual administrative-legal act issued by the authorized unit in accordance with the procedure and form set by the law.” The permit states, among other things, the date and schedule of the construction works, the purpose of the building and the construction terms. Geostat adds: “Building permits include both new construction and reconstruction.”";
const DEFINITIONS_COMPLETED = "Completion is, in Geostat’s words, “Final approval in a form of administrative-legal act issued by the authorized unit that the constructed object is fit for purpose and in line with the terms and conditions of respective construction permit.” Geostat adds: “Completed objects include only the objects that have been put into operation.” The pages call them completed buildings.";
const DEFINITIONS_AREA = "Floor area is the total area of the permits, or of the completed objects, in m², as Geostat prints it; the metadata does not define total area further. Residential buildings are the residential buildings column of Geostat’s tables. Geostat’s notes under the permits tables for 2022–2025 say: “Residential buildings include multufunctional residential complexes and individual residential buildings.”";
const DECLARED_DATA = "Geostat titles its permit and completed-building tables “the declared data”. Its metadata says the data are based on the information provided by the architecture and supervision bodies that issue the permits. Fiscal.ge shows the figures as Geostat publishes them and corrects nothing.";
const DECLARED_SPECIAL = "Under each yearly table of permits by type from 2012 to 2025 Geostat adds a note that another body issued permits for buildings of special significance: the Ministry of Economy and Sustainable Development in 2012–2015 (58, 54, 63 and 60 permits) and, from 2016, the Technical and Construction Supervision Agency (TCSA), a legal entity of public law, in 2016–2025 (75, 87, 87, 94, 74, 91, 73, 50, 61 and 69 permits). The note for 2025 reads: “LEPL Technical and Construction Supervision Agency (TCSA) has issued 69 permits for construction and reconstruction of special significance buildings in 2025.” The note gives the number but does not say outright whether the tables include these permits; Geostat’s Georgian edition of the note introduces the number with the words “in addition”. The pages add no figure of their own.";
const COMPARABILITY = "A permit and a completion are two different steps for a building. Geostat’s definition of a permit says it records the date and schedule of the construction works and the construction terms, and completion is the final approval of a finished building. So a building completed in one year may have been permitted in an earlier year, and a permit issued in one year may lead to a completion in a later one. Geostat counts each when it happens. The pages do not match permits with completions, do not subtract one from the other and do not compare them year for year.";
const TYPES_LIST = "Geostat splits permits and completed buildings into types of building. Its column order changes from year to year, so the pages match the types by name and list them in one order for every year: residential buildings, shops and trade, offices and administrative buildings, hotels, cafes and restaurants, industrial buildings and warehouses, farm buildings, fuel stations, car parks, schools and education, kindergartens, health facilities, sports buildings and grounds, cultural buildings, pharmacies, children’s holiday camps and other. For Georgia the pages show each type; for a region only its total and its residential buildings.";
const TYPES_GAPS = "Where Geostat printed no column for a type in a year, that year is a gap, not zero. Kindergartens (pre-school establishments) have no column in the permits table of 2008 and in the completed-buildings tables of 2006, 2009, 2011, 2012 and 2021; in those years the other types add up to Georgia’s total. Children’s holiday camps have a column in the permits tables of 2022 and 2023 only, and the completed-buildings tables have no such column, so that type is not listed on the Completed buildings page.";
const REGIONS_SUM = "The regions are Geostat’s 11: Tbilisi, Adjara, Guria, Imereti, Kakheti, Mtskheta-Mtianeti, Racha-Lechkhumi and Kvemo Svaneti, Samegrelo-Zemo Svaneti, Samtskhe-Javakheti, Kvemo Kartli and Shida Kartli. In every year they add up to Georgia’s figure: numbers exactly and floor area to within 1 m². In 2024 the difference is exactly 1 m²: the regions’ permitted floor area is 1 m² less than Georgia’s, and their completed floor area 1 m² more. Both are shown as Geostat prints them.";
const REGIONS_GAPS = "For some regions and years Geostat prints “…”, meaning no data, for residential buildings although it prints the region’s total: completed residential buildings in Kakheti and Samegrelo-Zemo Svaneti in 2006 and in Racha-Lechkhumi and Kvemo Svaneti in 2010 and 2011. Those years are gaps, not zero. A region’s residential buildings never exceed its total.";
const PRICE_INDEX = "Geostat’s residential property price index has the 2020 average as its base, 100, and covers all homes, flats and detached houses. Because the base is the 2020 average and not a single quarter, the fourth quarter of 2020 reads 107.2, not 100; the fourth quarter of 2025 reads 159.4.";
const PRICE_QUARTER = "Each year shows Geostat’s fourth-quarter value, not an average of the year’s four quarters. Geostat publishes the index and the district prices by quarter; the pages show only the fourth quarter of each year, copied exactly, and calculate nothing from the others. A year appears only once its fourth quarter is published, so 2026 is not shown until Geostat publishes it. The quarterly figures are on Geostat’s website.";
const ASKING_PRICES = "The Tbilisi district prices are asking prices, not sale prices. Geostat’s note under the table says it shows the median price of 1 m² of newly built flats (on the other sheet, detached houses) in Tbilisi by district, that the prices are so-called “offer prices”, and that the data are obtained using web scraping and calculating median prices. An offer price is the price at which a home is offered for sale, not the price it sold for.";
const ASKING_LIMITS = "The table covers newly built flats and houses in Tbilisi only. The pages show no price per m² for older homes or for places outside Tbilisi. The district prices and the price index are different Geostat series, one in lari per m² and one with a 2020 base, and the pages do not combine them. Prices are shown in whole lari, as Geostat’s cells display them.";
const VALUES = "Fiscal.ge calculates nothing on these pages: no averages, shares, growth rates, differences or totals, and no gap is filled. Every value is Geostat’s and has Geostat’s unit: numbers of permits and buildings as whole numbers; floor area in m², shown as thousand m² to one decimal in charts, tables and lists and as million m² in the line under a page’s heading and on the section cards; the price index to one decimal; prices in whole lari per m². A year without a value is a gap in the chart, a dash in the table and an empty Excel cell, never zero. Geostat’s January–June 2026 column and its quarterly tables are not shown. The pages describe the figures and state no causes for their changes.";
const VALIDATION = "3,222 values are published, for 181 series. Each is read again from its cell in Geostat’s original workbook by two separate programs, and the original files are checked against their recorded fingerprints. The checks also require, in every year: the 11 regions to add up to Georgia, and the types to add up to Georgia’s total, in numbers exactly and in floor area within 1 m²; each by-type table’s total to equal the regional workbook for Georgia and each region (960 cells); a region’s residential buildings never to exceed its total; and the published anchors to match Geostat: 11,578 permits for 11,397,190 m² and 3,393 completed buildings with 3,509,126 m² in 2025, a price index of 159.4 in the fourth quarter of 2025 and, in the same quarter, 5,874 lari per m² for flats in Vake. No value from 2026 or from a quarter other than the fourth is accepted. The test runs show that altered, shifted or swapped values are caught.";
const ARCHIVE = "21 originals from Geostat, retrieved on 16 October 2026, are available: the six workbooks the pages read, the two zip files that hold the by-type workbooks, the municipality workbook and the two quarterly by-type workbooks, the other two price-index workbooks, three construction cost index workbooks, two regional workbooks (construction by region and the infrastructure of dwellings) and captures of three Geostat pages that link most of these files. Six workbooks supply the values on the pages; the others are kept for reference and no value is read from them. Geostat’s metadata for permits and completed objects is linked above rather than archived. HTML pages download as text files. Excel follows the selected series and years and lists their source files.";

export const HOUSING_METHODOLOGY_CONTENT: MethodologyContent = {
  "id": "housing",
  "slug": "housing",
  "title": "Housing and construction",
  "summary": "Building permits and completed buildings in Georgia, the home price index and asking prices of new homes in Tbilisi’s districts, year by year, from Geostat data.",
  "metaDescription": "Building permits, completed buildings, the home price index and Tbilisi’s new-home asking prices, from Geostat: definitions, gaps and original files.",
  "reviewedAt": "2026-10-16",
  "archiveManifestId": "housing",
  "coverageSource": {
    "kind": "archive"
  },
  "canonicalDocuments": [
    "docs/data-methodology/housing-annual.md"
  ],
  "disclosure": "Each year shows one value: the yearly figure for permits and completed buildings, and the fourth quarter for prices. Quarterly figures, 2026, municipalities and the construction cost index are outside these pages.",
  "keyFacts": [
    {
      "label": "Coverage",
      "valueKind": "coverage"
    },
    {
      "label": "Frequency",
      "valueKind": "frequency",
      "value": "Annual (prices: fourth quarter)"
    },
    {
      "label": "Basis",
      "valueKind": "basis",
      "value": "Actual"
    },
    {
      "label": "Units",
      "valueKind": "unit",
      "value": "number; m²; index (2020 = 100); GEL per m²"
    }
  ],
  "sections": [
    { "id": "scope", "kind": "scope", "title": "What do the pages cover?", "paragraphs": [SCOPE] },
    {
      "id": "sources",
      "kind": "sources",
      "title": "Where do the figures come from?",
      "paragraphs": [SOURCES],
      "sourceLinks": [
        { "href": "https://www.geostat.ge/media/78697/0509_300426_GE.PDF", "label": "Geostat metadata in Georgian: permits granted for construction and completed objects" },
        { "href": "https://www.geostat.ge/media/78698/0509_300426_EN.PDF", "label": "Geostat metadata in English: permits granted for construction and completed objects" }
      ]
    },
    { "id": "definitions", "kind": "classification", "title": "What counts as a permit, a completed building and floor area?", "paragraphs": [DEFINITIONS_PERMIT, DEFINITIONS_COMPLETED, DEFINITIONS_AREA] },
    { "id": "declared", "kind": "classification", "title": "Declared data and permits of special significance", "paragraphs": [DECLARED_DATA, DECLARED_SPECIAL] },
    { "id": "comparability", "kind": "limitations", "title": "Permits and completed buildings are not matched year for year", "paragraphs": [COMPARABILITY] },
    { "id": "types", "kind": "classification", "title": "Types of building and gaps", "paragraphs": [TYPES_LIST, TYPES_GAPS] },
    { "id": "regions", "kind": "limitations", "title": "Regions", "paragraphs": [REGIONS_SUM, REGIONS_GAPS] },
    { "id": "price-index", "kind": "classification", "title": "The home price index and the fourth quarter", "paragraphs": [PRICE_INDEX, PRICE_QUARTER] },
    { "id": "asking-prices", "kind": "classification", "title": "Tbilisi prices are asking prices", "paragraphs": [ASKING_PRICES, ASKING_LIMITS] },
    { "id": "values", "kind": "classification", "title": "Values as Geostat publishes them", "paragraphs": [VALUES] },
    { "id": "validation", "kind": "validation", "title": "How are the figures checked?", "paragraphs": [VALIDATION] },
    { "id": "archive", "kind": "archive", "title": "Original sources", "paragraphs": [ARCHIVE] }
  ],
  "decisions": [
    { "id": "housing.scope", "group": "housing", "title": "What do the pages cover?", "statusLabel": "Fiscal.ge decision", "summary": SCOPE, "detail": [], "canonicalDecisionIds": ["housing.scope"] },
    { "id": "housing.declared_data", "group": "housing", "title": "Declared data and permits of special significance", "statusLabel": "Official fact", "summary": `${DECLARED_DATA} ${DECLARED_SPECIAL}`, "detail": [], "canonicalDecisionIds": ["housing.declared_data"] },
    { "id": "housing.definitions", "group": "housing", "title": "What counts as a permit, a completed building and floor area?", "statusLabel": "Official fact", "summary": `${DEFINITIONS_PERMIT} ${DEFINITIONS_COMPLETED} ${DEFINITIONS_AREA}`, "detail": [], "canonicalDecisionIds": ["housing.definitions"] },
    { "id": "housing.comparability", "group": "housing", "title": "Permits and completed buildings are not matched year for year", "statusLabel": "Limitation", "summary": COMPARABILITY, "detail": [], "canonicalDecisionIds": ["housing.comparability"] },
    { "id": "housing.types", "group": "housing", "title": "Types of building and gaps", "statusLabel": "Limitation", "summary": `${TYPES_LIST} ${TYPES_GAPS}`, "detail": [], "canonicalDecisionIds": ["housing.types"] },
    { "id": "housing.regions", "group": "housing", "title": "Regions", "statusLabel": "Limitation", "summary": `${REGIONS_SUM} ${REGIONS_GAPS}`, "detail": [], "canonicalDecisionIds": ["housing.regions"] },
    { "id": "housing.price_index", "group": "housing", "title": "The home price index and the fourth quarter", "statusLabel": "Official fact", "summary": `${PRICE_INDEX} ${PRICE_QUARTER}`, "detail": [], "canonicalDecisionIds": ["housing.price_index"] },
    { "id": "housing.asking_prices", "group": "housing", "title": "Tbilisi prices are asking prices", "statusLabel": "Limitation", "summary": `${ASKING_PRICES} ${ASKING_LIMITS}`, "detail": [], "canonicalDecisionIds": ["housing.asking_prices"] },
    { "id": "housing.values", "group": "housing", "title": "Values as Geostat publishes them", "statusLabel": "Fiscal.ge decision", "summary": VALUES, "detail": [], "canonicalDecisionIds": ["housing.values"] }
  ],
  "technicalAppendix": [],
  "showTechnicalAppendix": false
};

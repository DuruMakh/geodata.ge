import type { MethodologyContent } from "../../types";

const SCOPE = "Annual figures from Geostat on road vehicles, passenger and freight transport, and registered vehicles and roads by region, on five pages and a page for Georgia and for each region. Vehicles: Georgia’s road vehicle fleet by type (passenger cars, buses and minibuses, trucks and special vehicles), 2000–2025, and each type by fuel, 2017–2025. Vehicle age: each type by age, 2017–2025. Passengers: passenger-km by road, rail, metro, air and sea and per person, 2000–2025, and passengers carried by railway, metro, airports, Georgian airlines and sea ports. Freight: tonne-km by road, rail, air and sea, 2000–2025, and goods carried by railway, sea ports, airports and Georgian airlines. Regions: registered vehicles in the 11 regions, 2017–2025, with a page for Georgia and for each region that shows its registered vehicles by type, fuel, age and owner, and the length of its roads, 2011–2024. Quarterly figures, 2026, municipalities, taxi licences and technical inspections are outside these pages.";
const SOURCES = "The figures come from 13 Geostat workbooks. Geostat’s environmental indicator tables H-1 to H-4 give passenger-km, tonne-km and the road vehicle fleet by fuel and by age. Geostat’s railway, metro, air and maritime transport tables give the passengers and goods carried; each table names where Geostat takes its figures from: JSC Georgian Railway for the railway, LTD Tbilisi Transport Company for the metro, the Georgian Civil Aviation Agency for the airports and the Maritime Transport Agency of Georgia for the sea ports. Geostat’s road transport tables give registered vehicles by region, from the Ministry of Internal Affairs, and the length of roads, from the Roads Department of Georgia and municipal administrations. Geostat’s metadata for railway, air and maritime transport is linked below.";
const VEHICLES = "The vehicle tables H-3 and H-4 and the registered-vehicles workbook name the Ministry of Internal Affairs of Georgia as their source: the figures are vehicles in its register. The registered-vehicles workbook gives the number at the end of each year, in thousands. Geostat’s note under the vehicle tables reads: “Data for 2008-2025 years includes agricultural machinery.” So special vehicles include agricultural machinery from 2008 and not before, and their line is not counted the same way on either side of 2008. Geostat prints “…” (not available) for the totals of 2004 and 2005, for special vehicles also in 2006, and for every fuel and age row before 2017; those years are gaps, not zero.";
const AGE = "The Vehicle age page follows Geostat’s table H-4, whose age rows are cumulative: up to 2 years is part of up to 5 years, which is part of up to 10 years. The rows of one type therefore do not add up to its total; the total is up to 10 years plus over 10 years plus unknown age. The age bands on a region’s page come from the registered-vehicles workbook and are separate: up to 2 years, 2 to 5, 5 to 10, over 10 and unknown. They add up to the area’s registered vehicles.";
const TURNOVER = "Passenger-km and tonne-km measure transport work: one passenger-km is one passenger carried one kilometre, and one tonne-km is one tonne of goods carried one kilometre. Geostat’s air transport metadata defines passenger turnover as “The number of passengers multiplied by flight distance”; its railway metadata counts, for international journeys, only the distance travelled inside Georgia. Geostat’s note under H-1 and H-2 reads: “Data about road transport in 2005-2025 - according to statistical surveys and experts’ estimation.” Road passenger-km and tonne-km from 2005 are therefore estimates. Passenger-km per person is Geostat’s own row in H-1, in whole km.";
const CARRIED_AIR = "Airport figures and airline figures overlap and should not be added together. Geostat’s metadata counts at the airports the passengers served by Georgia’s airports, and counts transfer passengers twice, on arrival and on departure; for airlines it counts the passengers on board the flights of airlines registered in Georgia, wherever they fly. A passenger flying a Georgian airline from a Georgian airport is in both. Freight is the same: the airports count freight and mail loaded or unloaded in Georgia, the airlines the freight and mail on their cargo aircraft.";
const CARRIED_RAIL = "Geostat splits the goods carried by railway into national transport, goods leaving Georgia (exports), goods entering Georgia (imports) and transit. Transit is goods carried across Georgia by rail between other countries. Railway passengers are split into national and international journeys; Geostat’s metadata says the number of railway passengers is based on ticket sales. The figures start in 2018 for the railway, 2012 for the metro and Georgian airlines, 2015 for the airports and 2020 for the sea ports.";
const REGIONS_REGISTER = "The registered-vehicles workbook gives each of the 11 regions, Abkhazia and “region unknown”. Georgia’s total includes Abkhazia’s register and the vehicles whose region is unknown, so the 11 regions add up to less than Georgia. Abkhazia and region unknown have no page of their own. Three small columns of the workbook are not listed on the area pages: vehicles of unknown type (from 2022), diesel-gas and hybrid-diesel; they are part of the totals and of the checks.";
const REGIONS_ROADS = "Road length covers international, secondary and local roads, 2011–2024. Geostat’s note says Tbilisi’s roads are those “Managed by Roads Department of Georgia since 2012”, so Tbilisi’s road length is only the roads the Roads Department of Georgia manages. Geostat also notes that from 2021 local roads include the roads within the administrative boundaries of settlements and exclude self-governing cities, and that the 2024 data use the list of roads updated by the Prime Minister’s Decree No. 407 and updated municipal boundaries. Road length before and after 2021, and before and after 2024, is therefore not counted the same way. Georgia’s road length includes Abkhazia’s row.";
const NOT_LISTED = "Some rows of Geostat’s tables are not listed because they are nil or zero in every year: inland waterways passenger-km and tonne-km; in H-3, diesel-gas and hybrid-diesel vehicles of every type, hybrid and hybrid-gas buses, trucks and special vehicles, and gas-fuelled special vehicles; and in H-4, buses of unknown age. Every run of the checks confirms that they are still nil. Percentages, population, GDP and tonne-km per unit of GDP from H-1 and H-2 are not shown either.";
const VALUES = "Fiscal.ge calculates nothing on these pages: no averages, shares, growth rates or totals, and no gap is filled. Every value is Geostat’s and has Geostat’s unit: thousand vehicles, million passenger-km and tonne-km, thousand passengers, thousand tonnes and km of road, to one decimal, and passenger-km per person in whole km. The line under a page’s heading gives the latest figure in thousands, millions or billions. “…” is a gap. A dash “-” follows each table’s own legend: in H-1, H-4 and the railway, airport and sea port tables it means nil and is shown as 0; in H-2 it means “Data not available” and is a gap, as for sea tonne-km in 2009, 2010 and from 2013. A year without a value is a gap in the chart, a dash in the table and an empty Excel cell, never zero. Geostat’s 2026 quarterly figures are not shown. The pages describe the figures and state no causes for their changes.";
const VALIDATION = "4,301 values are published, for 452 series. Each is read again from its cell in Geostat’s original workbook by two separate programs, and the original files are checked against their recorded fingerprints. The checks also require that totals equal their parts (1,103 comparisons): the fuels of each vehicle type and H-4’s up to 10 years, over 10 years and unknown age; the modes of passenger-km and tonne-km; the railway’s directions and the sea ports’ types of cargo; the 11 regions with Abkhazia and region unknown; each area’s types, fuels, owners and age bands; and the road types and regions. Two differences of 0.2 thousand are Geostat’s rounding and are recorded exactly: buses’ fuels add up to 0.2 thousand more than their total in 2020, special vehicles’ to 0.2 thousand less in 2025. The anchors match Geostat: 1,650.0 thousand passenger cars in 2025 and 244.8 thousand in 2000; 11,262.1 million passenger-km in 2025; 1,914.9 thousand registered vehicles in Georgia and 855.0 thousand in Tbilisi in 2025; and 147,641.4 thousand metro passengers in 2025. No value from 2026 is accepted. The test runs show that altered, shifted or swapped values are caught.";
const ARCHIVE = "25 originals from Geostat, retrieved on 20 October 2026, are available: the 13 workbooks the pages read; seven workbooks kept for reference (railway freight turnover, railway infrastructure, goods by region of loading and unloading, air transport infrastructure, ships entering sea ports, Tbilisi taxi licences and technical inspections), from which no value is read; and captures of the five Geostat pages that link them. Geostat’s railway, air and maritime metadata is linked above rather than archived. HTML pages download as text files. Excel follows the selected series and years and lists their source files.";

export const TRANSPORT_METHODOLOGY_CONTENT: MethodologyContent = {
  "id": "transport",
  "slug": "transport",
  "title": "Transport",
  "summary": "Georgia’s road vehicle fleet by type, fuel and age, passenger and freight transport by road, rail, metro, air and sea, and registered vehicles and roads by region, year by year, from Geostat data.",
  "metaDescription": "Road vehicles, passenger-km, tonne-km, passengers and goods carried, and registered vehicles and roads by region, from Geostat: definitions, gaps, originals.",
  "reviewedAt": "2026-10-20",
  "archiveManifestId": "transport",
  "coverageSource": {
    "kind": "archive"
  },
  "canonicalDocuments": [
    "docs/data-methodology/transport-annual.md"
  ],
  "disclosure": "Each year shows Geostat’s yearly figure. Quarterly figures, 2026, municipalities, taxi licences and technical inspections are outside these pages.",
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
      "value": "thousand vehicles; million passenger-km and tonne-km; thousand passengers and tonnes; km"
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
        { "href": "https://www.geostat.ge/media/79116/0527_200526_EN.PDF", "label": "Geostat metadata in English: railway transport" },
        { "href": "https://www.geostat.ge/media/79115/0526_200526_EN.PDF", "label": "Geostat metadata in English: air transport" },
        { "href": "https://www.geostat.ge/media/79117/0532_200526_EN.PDF", "label": "Geostat metadata in English: maritime transport" }
      ]
    },
    { "id": "vehicles", "kind": "classification", "title": "Vehicles in the register", "paragraphs": [VEHICLES] },
    { "id": "age", "kind": "limitations", "title": "Age rows: cumulative on Vehicle age, separate on the region pages", "paragraphs": [AGE] },
    { "id": "turnover", "kind": "classification", "title": "Passenger-km and tonne-km", "paragraphs": [TURNOVER] },
    { "id": "carried", "kind": "limitations", "title": "Passengers and goods carried", "paragraphs": [CARRIED_AIR, CARRIED_RAIL] },
    { "id": "regions", "kind": "limitations", "title": "Regions and roads", "paragraphs": [REGIONS_REGISTER, REGIONS_ROADS] },
    { "id": "not-listed", "kind": "classification", "title": "Rows that are not listed", "paragraphs": [NOT_LISTED] },
    { "id": "values", "kind": "classification", "title": "Values as Geostat publishes them", "paragraphs": [VALUES] },
    { "id": "validation", "kind": "validation", "title": "How are the figures checked?", "paragraphs": [VALIDATION] },
    { "id": "archive", "kind": "archive", "title": "Original sources", "paragraphs": [ARCHIVE] }
  ],
  "decisions": [
    { "id": "transport.scope", "group": "transport", "title": "What do the pages cover?", "statusLabel": "Fiscal.ge decision", "summary": SCOPE, "detail": [], "canonicalDecisionIds": ["transport.scope"] },
    { "id": "transport.vehicles", "group": "transport", "title": "Vehicles in the register", "statusLabel": "Official fact", "summary": VEHICLES, "detail": [], "canonicalDecisionIds": ["transport.vehicles"] },
    { "id": "transport.age", "group": "transport", "title": "Age rows: cumulative on Vehicle age, separate on the region pages", "statusLabel": "Limitation", "summary": AGE, "detail": [], "canonicalDecisionIds": ["transport.age"] },
    { "id": "transport.turnover", "group": "transport", "title": "Passenger-km and tonne-km", "statusLabel": "Official fact", "summary": TURNOVER, "detail": [], "canonicalDecisionIds": ["transport.turnover"] },
    { "id": "transport.carried", "group": "transport", "title": "Passengers and goods carried", "statusLabel": "Limitation", "summary": `${CARRIED_AIR} ${CARRIED_RAIL}`, "detail": [], "canonicalDecisionIds": ["transport.carried"] },
    { "id": "transport.regions", "group": "transport", "title": "Regions and roads", "statusLabel": "Limitation", "summary": `${REGIONS_REGISTER} ${REGIONS_ROADS}`, "detail": [], "canonicalDecisionIds": ["transport.regions"] },
    { "id": "transport.not_listed", "group": "transport", "title": "Rows that are not listed", "statusLabel": "Fiscal.ge decision", "summary": NOT_LISTED, "detail": [], "canonicalDecisionIds": ["transport.not_listed"] },
    { "id": "transport.values", "group": "transport", "title": "Values as Geostat publishes them", "statusLabel": "Fiscal.ge decision", "summary": VALUES, "detail": [], "canonicalDecisionIds": ["transport.values"] }
  ],
  "technicalAppendix": [],
  "showTechnicalAppendix": false
};

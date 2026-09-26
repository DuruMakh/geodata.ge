import type { MethodologyContent } from "../../types";

export const INFLATION_METHODOLOGY_CONTENT: MethodologyContent = {
  id: "inflation",
  slug: "inflation",
  title: "Inflation",
  summary: "Georgia's consumer price index: annual and monthly inflation, the price index and core inflation, alongside the National Bank of Georgia's inflation target.",
  reviewedAt: "2026-09-26",
  archiveManifestId: "inflation",
  coverageSource: { kind: "archive" },
  canonicalDocuments: ["docs/data-methodology/inflation-cpi-national.md"],
  disclosure:
    "Figures are the values Geostat and the National Bank of Georgia publish; Fiscal.ge converts Geostat's published indices to percentage change and, on the categories page only, multiplies a published price change by a published basket weight to show each group's contribution to inflation. Nothing else is computed or adjusted.",
  keyFacts: [
    { label: "Coverage", valueKind: "coverage" },
    { label: "Frequency", valueKind: "frequency", value: "Monthly" },
    { label: "Unit", valueKind: "unit", value: "% / index, 2010 = 100" },
  ],
  sections: [
    {
      id: "scope",
      kind: "scope",
      title: "Coverage and indicators",
      paragraphs: [
        "The price index (2010 average = 100) from January 2000; annual and monthly inflation from January 2004; 12-month average inflation from January 2002; core inflation and core inflation excluding tobacco from January 2010. The latest month is set by the published files.",
        "Annual inflation compares a month's prices with the same month of the previous year; monthly inflation compares them with the previous month. The 12-month average compares the average level of the last 12 months with the average of the 12 months before; the December value is the calendar-year average inflation.",
        "Core inflation is calculated by excluding these groups from the consumer basket: food and non-alcoholic beverages; energy; regulated tariffs; transport (specific tariffs). The variant without tobacco also excludes tobacco (Geostat's definition).",
      ],
    },
    {
      id: "sources",
      kind: "sources",
      title: "Sources",
      paragraphs: [
        "Six Geostat consumer price index files: the national sheet (Georgia) and, in the annual, monthly and 12-month average files, one sheet for each of six cities. The English files are canonical; the Georgian files confirm that the values are identical.",
        "Geostat publishes annual, monthly and 12-month average change as indices (comparison period = 100); Fiscal.ge stores the percentage change, which is exactly the published index minus 100.",
        "Inflation target: National Bank of Georgia, Monetary Policy Strategy — 5% (2015–2016), 4% (2017), 3% (from 2018).",
        "Consumer basket weights: a separate Geostat file, refreshed once a year in January, covering 12 groups and 41 subgroups from 2012.",
      ],
    },
    {
      id: "categories",
      kind: "scope",
      title: "Categories and contribution to inflation",
      paragraphs: [
        "Category data comes from the same Geostat files the national series is read from: 12 groups and 43 subgroups under the COICOP classification. Annual change from January 2005, monthly change from January 2004. Some group series are not continuous — postal services ends in 2011, package holidays starts in 2020 — and those missing months are recorded rather than filled.",
        "Geostat does not publish a contribution to inflation. Fiscal.ge calculates it from two published quantities: a group's price change multiplied by its basket weight for that year. The parts are always completed by \"the rest\" — published headline inflation minus the selected groups' contributions — so the stack adds up exactly to the figure Geostat published.",
        "The basket is rebased every January, so an annual change spans two sets of weights and the calculation is an approximation: from 2013 the mean error is 0.08 percentage points and the largest is 0.585 (March 2021). That is why contributions start in January 2013, although weights are available from 2012.",
      ],
    },
    {
      id: "cities",
      kind: "scope",
      title: "Cities",
      paragraphs: [
        "Geostat records prices in six cities — Tbilisi, Kutaisi, Batumi, Gori, Telavi and Zugdidi — with the same consumer basket in each. The cities page shows each city's annual and monthly inflation from January 2016, overall and for the 12 COICOP groups, beside Georgia's national rate. Zugdidi's annual inflation starts in December 2016 and its 12-month average in December 2017, because Geostat began recording prices there in December 2015; those months are left empty, not filled.",
        "Some prices — fuel, medicines, cars, mobile tariffs, flights and train fares — are recorded once and applied to every city, so differences between cities in those items are not measured differences.",
        "The national index is a weighted average of the city indices. Geostat does not publish the city weights, and Fiscal.ge does not show them; it uses the published figures only to check that the six cities add up to the national index every year. The price index (2010 = 100) is not shown for cities: each city's index is relative to its own 2010 prices, so it cannot say which city is more expensive.",
      ],
    },
    {
      id: "validation",
      kind: "validation",
      title: "Validation and updates",
      paragraphs: [
        "Each file's size and SHA-256 are checked; the series are contiguous and monthly; every file ends in the same month; annual, monthly and 12-month average change are recomputed from the price index and agree within 0.2 percentage points.",
        "Geostat does not plan revisions to published figures. On a refresh, any change to an already published month stops the update for review. Updates are monthly and checked by hand.",
      ],
    },
    {
      id: "limitations",
      kind: "limitations",
      title: "Limitations",
      paragraphs: [
        "The national index is a weighted average of city indices. No index level is published for core inflation, so the core series do not appear on the price index tab. The COICOP classification changed in 2004; the national index is comparable from 2000.",
        "A numeric inflation target before 2015 has not yet been verified in a primary National Bank of Georgia source, so the target line starts in 2015.",
      ],
    },
    {
      id: "archive",
      kind: "archive",
      title: "Original sources",
      paragraphs: ["Geostat's Excel files (English and Georgian) and the National Bank of Georgia's Monetary Policy Strategy are available below."],
    },
  ],
  decisions: [],
  technicalAppendix: [],
  showTechnicalAppendix: false,
};

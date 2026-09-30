import type { MethodologyContent } from "../../types";

export const INFLATION_METHODOLOGY_CONTENT: MethodologyContent = {
  id: "inflation",
  slug: "inflation",
  title: "Inflation",
  summary: "Georgia's consumer price index, inflation categories and individual-product price changes, alongside the National Bank of Georgia's inflation target.",
  reviewedAt: "2026-09-29",
  archiveManifestId: "inflation",
  coverageSource: { kind: "archive" },
  canonicalDocuments: ["docs/data-methodology/inflation-cpi-national.md", "docs/data-methodology/inflation-products.md"],
  disclosure:
    "Figures come from Geostat and the National Bank of Georgia. Fiscal.ge converts published indices to percentage changes, derives category contributions from published changes and weights, and compounds published product monthly indices for selected-years cumulative change. Derived measures are labelled; underlying source values are not adjusted.",
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
        "Six Geostat consumer price index files, national sheet (Georgia) only. The English files are canonical; the Georgian files confirm that the values are identical.",
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
      id: "products",
      kind: "scope",
      title: "Individual products in the current basket",
      paragraphs: [
        "The product explorer includes every item in Geostat's current basket and excludes products that have left it. Reviewed public history starts in January 2015, or at a later verified first month. Names and groups can change; a historical series is linked only after reviewing the official English and Georgian labels and the source row. The illustrations are decorative cues, not identity evidence.",
        "Geostat publishes each product's same-month-of-prior-year index and previous-month index with comparison period = 100. Annual product inflation is the published annual index minus 100. Fiscal.ge calculates the selected-years cumulative percentage by multiplying every published previous-month index divided by 100, from January of the selected first year through December of the last complete year or the latest published month. The baseline is the December immediately before the selected start year. This cumulative figure is derived by Fiscal.ge, not published as a Geostat series.",
        "If a product entered after the selected start or any monthly index in that span is missing, the full-range cumulative value is unavailable (—); a shorter history is never silently substituted. The latest annual ranking always uses the newest published month, even when the selected years end earlier. These product indices are not GEL shop prices, product-level basket weights, city prices or contributions to headline inflation.",
        "Two conservative identity splits keep p0179 Coffee cup with saucer from 2019 and p0269 Tourist trip abroad from 2020. Earlier descriptions and annual arithmetic suggest statistical continuity, but do not prove the earlier and current goods/services are the same specification. Geostat's p0148 English label says Chipboard while its Georgian label describes plasterboard; both official labels are preserved and the discrepancy is disclosed. The four archived English/Georgian product-index workbooks are listed among the original sources below.",
      ],
    },
    {
      id: "validation",
      kind: "validation",
      title: "Validation and updates",
      paragraphs: [
        "Each file's size and SHA-256 are checked; the series are contiguous and monthly; every file ends in the same month; annual, monthly and 12-month average change are recomputed from the price index and agree within 0.2 percentage points.",
        "Geostat does not plan revisions to published figures. On a refresh, any change to an already published month stops the update for review. Updates are monthly and checked by hand.",
        "For the August 2026 product vintage, 41,830 published annual product indices reconcile with 12 monthly indices within 0.002 index points, including 3,157 checks using verified 2014 source months solely as validation input. The remaining 22 first-year annual cells belong to the two conservative identity splits and are reported as uncomparable, not counted as passes.",
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
      paragraphs: ["Geostat's national and detailed product Excel files (English and Georgian), and the National Bank of Georgia's Monetary Policy Strategy, are available below."],
    },
  ],
  decisions: [],
  technicalAppendix: [],
  showTechnicalAppendix: false,
};

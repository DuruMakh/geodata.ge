import type { MethodologyContent } from "../../types";

export const REGIONAL_ECONOMIES_METHODOLOGY: MethodologyContent = {
  id: "regional-economies",
  slug: "regional-economies",
  title: "Regional economies",
  summary: "Total GDP and 20 NACE Rev. 2 economic activities for Georgia’s 11 regions, 2010–2024.",
  reviewedAt: "2026-09-13",
  archiveManifestId: "regional-economies",
  coverageSource: { kind: "archive" },
  canonicalDocuments: ["docs/data-methodology/regional-economies.md"],
  disclosure: "Official annual Geostat observations. Fiscal.ge calculates each activity’s share of the region’s market-price GDP.",
  keyFacts: [
    { label: "Coverage", valueKind: "coverage" },
    { label: "Frequency", valueKind: "frequency", value: "Annual" },
    { label: "Unit", valueKind: "unit", value: "GEL / %" },
  ],
  sections: [
    { id: "scope", kind: "scope", title: "Coverage", paragraphs: ["The dataset covers 11 regions, 2010–2024, total regional GDP and 20 activities (A–T). It does not include 2025 or estimate missing values."] },
    { id: "sources", kind: "sources", title: "Sources and accounting", paragraphs: [
      "Source: Geostat, SNA 2008. Activity values are gross value added at basic prices; total regional GDP is at market prices.",
      "Activity share = activity value added / the same region and year’s market-price GDP × 100. Visible or selected series never change the denominator.",
      "Taxes on products and subsidies explain the difference between summed activities and market-price GDP. They are reconciliation controls, not economic sectors.",
    ] },
    { id: "validation", kind: "validation", title: "Validation", paragraphs: [
      "Original Excel hashes and byte sizes are fixed. Validation covers all 165 regional totals, 3,300 region-activity values and 495 reconciliation records.",
      "The separate national and regional sector publications contain seven allocation differences in 2020–2022. Regional shares always use the same regional publication.",
    ] },
    { id: "limitations", kind: "limitations", title: "Limitations", paragraphs: [
      "Current-price data provide neither real growth nor per-capita measures. Nominal change is never labelled as real economic growth.",
      "Municipal GDP, population, forecasts, a 2025 estimate and a region’s share of Georgia’s GDP are outside this page’s scope.",
    ] },
    { id: "archive", kind: "archive", title: "Original sources", paragraphs: ["Two untouched Geostat Excel files: regional GDP totals and regional GDP by economic activity."] },
  ],
  decisions: [],
  technicalAppendix: [],
  showTechnicalAppendix: false,
};

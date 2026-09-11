import type { MethodologyContent } from "../../types";
export const GDP_METHODOLOGY_CONTENT: MethodologyContent = {
  id: "gdp",
  slug: "gdp",
  title: "GDP overview",
  summary: "Georgia’s annual GDP, real growth and nominal GDP per person.",
  reviewedAt: "2026-09-11",
  archiveManifestId: "gdp",
  coverageSource: {
    kind: "archive",
  },
  canonicalDocuments: ["docs/data-methodology/gdp-overview.md"],
  disclosure: "Georgia’s annual GDP, real growth and nominal GDP per person.",
  keyFacts: [
    {
      label: "Coverage",
      valueKind: "coverage",
    },
    {
      label: "Frequency",
      valueKind: "frequency",
      value: "Annual",
    },
    {
      label: "Unit",
      valueKind: "unit",
      value: "GEL / USD / %",
    },
  ],
  sections: [
    {
      id: "scope",
      kind: "scope",
      title: "Coverage and measures",
      paragraphs: [
        "Real GDP: 1960–2025 (constant 2015 USD). Annual real growth: 1961–2025. Nominal GDP and GDP per person: 1996–2025 (GEL and USD).",
        "Economic output per person; not average income.",
      ],
    },
    {
      id: "sources",
      kind: "sources",
      title: "Methodology and sources",
      paragraphs: [
        "World Bank published annual series. Early historical reconstruction details are not specified in the source metadata.",
        "Geostat. SNA 1993 through 2009; SNA 2008 from 2010. 2025 is preliminary.",
        "Original observations are preserved; there is no source splicing or custom rebasing of real GDP. Nominal values use the currencies published by Geostat.",
      ],
    },
    {
      id: "limitations",
      kind: "limitations",
      title: "Limitations",
      paragraphs: [
        "2025 Geostat data are preliminary, with revision scheduled for 16 November 2026. USD values at current prices also reflect exchange-rate movements.",
      ],
    },
    {
      id: "archive",
      kind: "archive",
      title: "Original sources",
      paragraphs: [
        "Untouched World Bank JSON responses and Geostat Excel workbooks are available below.",
      ],
    },
  ],
  decisions: [],
  technicalAppendix: [],
  showTechnicalAppendix: false,
};

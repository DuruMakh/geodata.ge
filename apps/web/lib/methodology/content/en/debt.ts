import type { MethodologyContent } from "../../types";

// Reviewed English presentation; IDs, source references and coverage remain shared.
export const DEBT_METHODOLOGY_CONTENT: MethodologyContent = {
  "id": "debt",
  "slug": "debt",
  "title": "Government debt",
  "summary": "Georgia’s government debt stock, principal and interest payments, and the portfolio’s average interest rates.",
  "reviewedAt": "2026-09-01",
  "archiveManifestId": "debt",
  "coverageSource": {
    "kind": "governmentDebt"
  },
  "canonicalDocuments": [
    "docs/data-methodology/government-debt-annual.md"
  ],
  "disclosure": "This dataset measures government debt, not the broader concepts of public or state debt. Amounts and rates come from official Ministry of Finance documents. Fiscal.ge combines them into a comparable annual panel while respecting the boundaries published in each source.",
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
      "label": "Status",
      "valueKind": "basis",
      "value": "Actual values and conditional forecast"
    },
    {
      "label": "Unit",
      "valueKind": "unit",
      "value": "GEL / percent"
    }
  ],
  "sections": [
    {
      "id": "scope",
      "kind": "scope",
      "title": "What is counted",
      "paragraphs": [
        "The stock combines domestic and external government debt. From 2019, domestic government debt includes borrowing by budgetary organisations; from December 2022, it also includes borrowing by state-owned enterprises classified within the general government sector. These changes must be considered when comparing years."
      ]
    },
    {
      "id": "sources",
      "kind": "sources",
      "title": "Official sources",
      "paragraphs": [
        "Stock and debt-service figures come from Public Debt Statistical Bulletins. Average rates come from the Monthly Government Debt Report and debt management strategies. All ten reviewed official originals are available below."
      ]
    },
    {
      "id": "limitations",
      "kind": "limitations",
      "title": "Gaps and forecast",
      "paragraphs": [
        "Exact, comparable domestic rates are not published for 2015–2017 and 2025; external rates are not published for 2015–2020 and 2025. These cells are blank: values are replaced neither by zero nor by estimates.",
        "The principal and interest schedule for 2026–2030 reflects the portfolio outstanding on 2025-12-31. It excludes future borrowing, refinancing and other subsequent changes, and is not a complete forecast of future budgets."
      ]
    },
    {
      "id": "archive",
      "kind": "archive",
      "title": "Unchanged original sources",
      "paragraphs": [
        "The archive contains only reviewed official PDF and XLSX files. CSVs prepared by Fiscal.ge, working notes and internal validation files are not presented as original sources."
      ]
    }
  ],
  "decisions": [],
  "technicalAppendix": [],
  "showTechnicalAppendix": false
};

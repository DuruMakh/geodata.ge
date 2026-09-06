import type { MethodologyContent } from "../../types";

// Reviewed English presentation; IDs, source references and coverage remain shared.
export const REVENUE_METHODOLOGY_CONTENT: MethodologyContent = {
  "id": "revenue",
  "slug": "revenue",
  "title": "Budget receipts methodology",
  "summary": "How the 2004 annual report and Treasury Form No. 1 for 2005–2025 are combined into a comparable public series for the consolidated budget.",
  "reviewedAt": "2026-08-20",
  "archiveManifestId": "revenue",
  "coverageSource": {
    "kind": "budgetSide",
    "side": "revenue"
  },
  "canonicalDocuments": [
    "docs/data-methodology/revenue-methodology.md"
  ],
  "disclosure": "All 11 public categories are available for 2005–2025. The 2004 annual report contains ten official categories; a comparable increase in liabilities is unavailable and is excluded from the 2004 total. Fiscal.ge’s transformations are limited to aligning code periods, excluding internal flows and making documented aggregations. Shares in the multi-year chart use Geostat’s nominal GDP for the same year, at current prices. SNA 1993 is used for 1996–2009, and SNA 2008 from 2010 onward. GDP for 2025 is preliminary.",
  "keyFacts": [
    {
      "label": "Period",
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
      "value": "Actual cash execution"
    },
    {
      "label": "Unit",
      "valueKind": "unit",
      "value": "Nominal GEL"
    }
  ],
  "sections": [
    {
      "id": "scope",
      "kind": "scope",
      "title": "What it measures",
      "paragraphs": [
        "The data measures receipts actually collected by the consolidated budget during the year. Internal transfers between the state and territorial budgets are not counted again during consolidation."
      ]
    },
    {
      "id": "sources",
      "kind": "sources",
      "title": "Official sources",
      "paragraphs": [
        "The source for 2004 is the consolidated-budget revenue and grants table in the Ministry of Finance’s annual execution report. For 2005–2025, the source is the State Treasury’s January–December Form No. 1. Four difficult years use reviewed text copies of the same PDFs. Workbooks for the latest three years are used only as an independent comparison."
      ]
    },
    {
      "id": "journey",
      "kind": "journey",
      "title": "From source to data",
      "paragraphs": [
        "The ten categories for 2004 are added from the reviewed table after manual verification. For later years, the unchanged form is read using the relevant code period, the consolidated column is selected, 11 categories are constructed, internal flows are excluded and the result is reconciled with total receipts."
      ]
    },
    {
      "id": "decisions",
      "kind": "decisions",
      "title": "Complete decision record",
      "paragraphs": [
        "The record distinguishes official source facts, Fiscal.ge’s consolidation and cross-period rules, and known limitations."
      ]
    },
    {
      "id": "archive",
      "kind": "archive",
      "title": "Unchanged original sources",
      "paragraphs": [
        "The archive contains the 2004 annual report and unmodified Form No. 1 PDFs for 2005–2025. Supporting text copies and CSVs prepared by Fiscal.ge are not presented as official originals."
      ]
    }
  ],
  "decisions": [
    {
      "id": "revenue.scope.consolidated",
      "group": "Scope and measure",
      "title": "The public series measures consolidated-budget receipts",
      "statusLabel": "Official fact",
      "summary": "Amounts for 2005–2025 come from Form No. 1’s consolidated column. The ten categories for 2004 come from the consolidated-budget table in the Ministry of Finance’s annual execution report.",
      "detail": [],
      "canonicalDecisionIds": [
        "revenue.scope.consolidated"
      ]
    },
    {
      "id": "revenue.scope.2004_partial",
      "group": "Scope and measure",
      "title": "The increase in liabilities for 2004 is unavailable",
      "statusLabel": "Limitation",
      "summary": "The 2004 report provides consolidated-budget revenue and grants in full, but not a comparable amount for the increase in liabilities. The 2004 total therefore contains ten official categories; the increase in liabilities is published neither as zero nor as an estimate. The source table excludes social contributions of budgetary organisations, and the source does not establish exact scope comparability with Form No. 1 for 2005–2025. Other taxes for 2004 are the remainder of the official tax total of 1,811,195,900 GEL after deducting six categories, including property tax of 29,107,500 GEL: 459,781,200 GEL. This remainder includes the source’s other taxes, tax revenue of special state funds and all other remaining tax components.",
      "detail": [],
      "canonicalDecisionIds": [
        "revenue.scope.2004_partial"
      ]
    },
    {
      "id": "revenue.source.form1",
      "group": "Sources",
      "title": "The primary source is the Treasury’s January–December Form No. 1",
      "statusLabel": "Official fact",
      "summary": "Each annual panel for 2005–2025 uses the same official State Treasury form for annual consolidated-budget receipts.",
      "detail": [],
      "canonicalDecisionIds": [
        "revenue.source.form1"
      ]
    },
    {
      "id": "revenue.source.four_code_eras",
      "group": "Sources",
      "title": "Four code periods are read separately",
      "statusLabel": "Official fact",
      "summary": "The sources use old 12-digit codes, old 8-digit codes, GFS codes without dots and modern dotted GFS codes. Each has a strict mapping.",
      "detail": [],
      "canonicalDecisionIds": [
        "revenue.source.four_code_eras"
      ]
    },
    {
      "id": "revenue.basis.actual",
      "group": "Scope and measure",
      "title": "All published amounts are actual values",
      "statusLabel": "Official fact",
      "summary": "The data reflects cash execution. Planned columns in the source are not published in the public panel.",
      "detail": [],
      "canonicalDecisionIds": [
        "revenue.basis.actual"
      ]
    },
    {
      "id": "revenue.precedence.actual_over_planned",
      "group": "Scope and measure",
      "title": "Actual values take precedence over planned values",
      "statusLabel": "Fiscal.ge decision",
      "summary": "When planned and actual values exist for the same category and year, the actual value is used publicly.",
      "detail": [],
      "canonicalDecisionIds": [
        "revenue.precedence.actual_over_planned"
      ]
    },
    {
      "id": "revenue.negative_values_allowed",
      "group": "Data rules",
      "title": "Official negative revenue rows are retained",
      "statusLabel": "Official fact",
      "summary": "Adjustment entries can be negative. The negative other-tax values for 2019 and 2020 are preserved unchanged from the source.",
      "detail": [],
      "canonicalDecisionIds": [
        "revenue.negative_values_allowed"
      ]
    },
    {
      "id": "revenue.mapping.net_internal_grants",
      "group": "Classification",
      "title": "Grants are published excluding internal budget transfers",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Within the consolidated budget, a grant from one level of government to another is not new revenue. Row 1.3.3 is therefore deducted from 1.3; its absence is accepted only after reconciling the child rows.",
      "detail": [],
      "canonicalDecisionIds": [
        "revenue.mapping.net_internal_grants"
      ]
    },
    {
      "id": "revenue.mapping.net_internal_other_revenue",
      "group": "Classification",
      "title": "Other revenue is published excluding internal government flows",
      "statusLabel": "Fiscal.ge decision",
      "summary": "In modern years, the internal government row 1.4.1.1.3 is deducted from 1.4 other revenue so that consolidation does not count the same amount twice.",
      "detail": [],
      "canonicalDecisionIds": [
        "revenue.mapping.net_internal_other_revenue"
      ]
    },
    {
      "id": "revenue.mapping.combined_asset_decrease",
      "group": "Classification",
      "title": "Decreases in financial and non-financial assets are combined into one public category",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Official flows 31 and 32 are summed in `revenue.asset_decrease`; the increase in liabilities remains separate.",
      "detail": [],
      "canonicalDecisionIds": [
        "revenue.mapping.combined_asset_decrease"
      ]
    },
    {
      "id": "revenue.mapping.opening_balance_excluded",
      "group": "Classification",
      "title": "The opening balance is not included in receipts",
      "statusLabel": "Fiscal.ge decision",
      "summary": "The balance under code 41 is a stock, not a flow received during the year. It is read and retained for checks, but excluded from the published receipts total.",
      "detail": [],
      "canonicalDecisionIds": [
        "revenue.mapping.opening_balance_excluded"
      ]
    },
    {
      "id": "revenue.mapping.other_taxes_2019_2025",
      "group": "Classification",
      "title": "For 2019–2025, other taxes are the official row 1.1.6",
      "statusLabel": "Official fact",
      "summary": "The published row is used unchanged in the modern dotted-code period, including negative adjustments.",
      "detail": [],
      "canonicalDecisionIds": [
        "revenue.mapping.other_taxes_2019_2025"
      ]
    },
    {
      "id": "revenue.mapping.other_taxes_2008_2018",
      "group": "Classification",
      "title": "For 2008–2018, other taxes are calculated as a residual",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Six named taxes are deducted from the official tax total. The resulting seven tax categories therefore match the official total exactly.",
      "detail": [],
      "canonicalDecisionIds": [
        "revenue.mapping.other_taxes_2008_2018"
      ]
    },
    {
      "id": "revenue.mapping.other_taxes_2005_2007",
      "group": "Classification",
      "title": "For 2005–2007, other taxes are the remaining top-level rows under the old codes",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Old block 01 rows outside the six named taxes are summed, and their components are retained in the provenance record.",
      "detail": [],
      "canonicalDecisionIds": [
        "revenue.mapping.other_taxes_2005_2007"
      ]
    },
    {
      "id": "revenue.validation.strict_presence",
      "group": "Validation",
      "title": "A missing required row stops publication",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Sources for all eleven categories are required for 2005–2025. The sole documented exception is 2004: ten official categories are published, while the increase in liabilities, absent from the source, is omitted.",
      "detail": [],
      "canonicalDecisionIds": [
        "revenue.validation.strict_presence"
      ]
    },
    {
      "id": "revenue.crosscheck.workbook_2023_2025",
      "group": "Validation",
      "title": "The years 2023–2025 are independently checked against workbooks",
      "statusLabel": "Fiscal.ge decision",
      "summary": "The Ministry of Finance’s tavi-1 workbooks provide an advisory comparison of state-budget aggregates. They do not replace the published consolidated-budget facts.",
      "detail": [],
      "canonicalDecisionIds": [
        "revenue.crosscheck.workbook_2023_2025"
      ]
    },
    {
      "id": "revenue.validation.receipts_identity_10_gel",
      "group": "Validation",
      "title": "Published categories match the official total within 10 GEL",
      "statusLabel": "Official fact",
      "summary": "For 2005–2025, eleven facts reconcile with final receipts. The ten facts for 2004 match the report’s revenue and grants total of 2,283,035,800 GEL exactly.",
      "detail": [],
      "canonicalDecisionIds": [
        "revenue.validation.receipts_identity_10_gel"
      ]
    }
  ],
  "technicalAppendix": [
    {
      "id": "revenue.limitation.perimeter_asymmetry",
      "group": "Limitations",
      "title": "Receipts and expenditure have different scopes",
      "statusLabel": "Limitation",
      "summary": "Receipts measure the consolidated budget, while expenditure measures the state budget. Their difference is not a deficit measure.",
      "detail": [],
      "canonicalDecisionIds": [
        "revenue.limitation.perimeter_asymmetry"
      ]
    },
    {
      "id": "revenue.limitation.workbook_advisory",
      "group": "Limitations",
      "title": "The comparison with recent workbooks is advisory",
      "statusLabel": "Limitation",
      "summary": "The monthly comparison files may be absent from a fresh copy of the project. The comparison itself is not a mandatory publication gate.",
      "detail": [],
      "canonicalDecisionIds": [
        "revenue.limitation.workbook_advisory"
      ]
    },
    {
      "id": "revenue.limitation.legacy_hash_gap",
      "group": "Limitations",
      "title": "All 22 published PDFs have SHA-256 hashes; historical acquisition hashes are unavailable",
      "statusLabel": "Limitation",
      "summary": "The publication manifest records the byte size and SHA-256 of all 22 current PDFs. However, this register was created from the files currently in the repository; hashes recorded at the historical acquisition dates do not exist.",
      "detail": [],
      "canonicalDecisionIds": [
        "revenue.limitation.legacy_hash_gap"
      ]
    }
  ],
  "hiddenDecisionGroups": [
    "Validation"
  ],
  "showTechnicalAppendix": false
};

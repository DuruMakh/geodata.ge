import type { MethodologyContent } from "../../types";

// Reviewed English presentation; IDs, source references and coverage remain shared.
export const EXPENDITURE_METHODOLOGY_CONTENT: MethodologyContent = {
  "id": "expenditure",
  "slug": "expenditure",
  "title": "Expenditure methodology",
  "summary": "How actual state-budget payments are brought together into clear functions, institutions and major programmes.",
  "reviewedAt": "2026-08-20",
  "archiveManifestId": "expenditure",
  "coverageSource": {
    "kind": "budgetSide",
    "side": "expenditure"
  },
  "canonicalDocuments": [
    "docs/data-methodology/treasury-functional-expenditure-methodology-2004-2025.md",
    "docs/data-methodology/ministries-expenditure-methodology.md",
    "docs/data-methodology/ministries-drilldown-programs-methodology.md"
  ],
  "disclosure": "Annual amounts and total payments come from official sources. The public functions, consolidation of historical institutions and continuity of programmes follow Fiscal.ge’s reviewed classification. Shares in the multi-year chart use Geostat’s nominal GDP for the same year, at current prices. SNA 1993 is used for 1996–2009, and SNA 2008 from 2010 onward. GDP for 2025 is preliminary.",
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
      "value": "Actual execution for the full 12 months"
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
        "The series measures all state-budget payments actually executed during the year. Functional and institutional expenditure cover 2004–2025; the separate receipts series also covers 2004–2025, but the increase in liabilities for 2004 is unavailable in the source and is excluded from that year’s total."
      ]
    },
    {
      "id": "sources",
      "kind": "sources",
      "title": "Official sources",
      "paragraphs": [
        "The functional breakdown for 2004 comes from the full 2004 state-budget execution annex; the narrower central-budget Treasury E11 is used only as a supporting check. For 2005–2025, sources are Treasury E11 forms and documented supplementary Ministry of Finance reports or workbooks."
      ]
    },
    {
      "id": "journey",
      "kind": "journey",
      "title": "From source to data",
      "paragraphs": [
        "Each original source is preserved unchanged, read using its historical format, converted to a common unit and classified under reviewed rules. Results are published only after reconciliation with the annual total."
      ]
    },
    {
      "id": "decisions",
      "kind": "decisions",
      "title": "Complete decision record",
      "paragraphs": [
        "The record below explains the choice of official measure and every material Fiscal.ge classification decision, including its reasons."
      ]
    },
    {
      "id": "classification",
      "kind": "classification",
      "title": "Classification and transformation",
      "paragraphs": [
        "COFOG, the older 14-group classification, institutional succession and programme identities are handled under separate rules. No official amount is discarded because its classification is uncertain."
      ]
    },
    {
      "id": "validation",
      "kind": "validation",
      "title": "Validation and reconciliation",
      "paragraphs": [
        "Each year is reconciled with official payments within a tolerance of 1,000 GEL. Additional checks on sources, codes, coverage and unchanged results help prevent classification errors."
      ]
    },
    {
      "id": "limitations",
      "kind": "limitations",
      "title": "Limitations",
      "paragraphs": [
        "The public functions are not an official taxonomy. Programme continuity sometimes relies on a modelled link supported by source names and evidence of reorganisation. Matching the annual total alone cannot detect an incorrect allocation within that total."
      ]
    },
    {
      "id": "archive",
      "kind": "archive",
      "title": "Unchanged original sources",
      "paragraphs": [
        "The archive contains unmodified Treasury and Ministry of Finance files. CSVs prepared by Fiscal.ge are not labelled as original sources."
      ]
    }
  ],
  "decisions": [
    {
      "id": "expenditure.scope.2004_functional_full_state",
      "group": "Scope and measure",
      "title": "Functional expenditure for 2004 covers the full state budget",
      "statusLabel": "Official fact",
      "summary": "The 2004–2025 functional series starts with the full state-budget execution annex; its printed annual total is 1,930,210,300 GEL.",
      "detail": [
        "The annex’s rounded functional groups sum to 1,930,210,400 GEL. An adjustment of exactly -100 GEL is applied only to Other / unclassified to match the source’s printed total."
      ],
      "canonicalDecisionIds": [
        "expenditure.scope.2004_functional_full_state"
      ]
    },
    {
      "id": "expenditure.scope.2004_admin_included",
      "group": "Scope and measure",
      "title": "Institutional expenditure for 2004 is derived from 47 official institutions",
      "statusLabel": "Official fact",
      "summary": "The full annex’s 47 main official institutions are reconciled into 13 administrative categories. Their rounded sum is 1,930,210,400 GEL, exceeding the printed total by 100 GEL, which is within the permitted rounding tolerance.",
      "detail": [
        "Five source-based split components replace combined official finance and culture/sport rows. Major programmes for 2004 are not published."
      ],
      "canonicalDecisionIds": [
        "expenditure.scope.2004_admin_included"
      ]
    },
    {
      "id": "expenditure.source.2004_central_only_not_served",
      "group": "Scope and measure",
      "title": "The central-budget E11 PDF is archived but is not used in the published series",
      "statusLabel": "Limitation",
      "summary": "The Treasury E11 document covers only the central budget, approximately 1.5 billion GEL. It does not represent the full state budget and is not the source of any published amount for 2004.",
      "detail": [
        "E11 is used only to check scale and parent groups. Exact functional amounts and institutional rows come from the full execution annex."
      ],
      "canonicalDecisionIds": [
        "expenditure.source.2004_central_only_not_served"
      ]
    },
    {
      "id": "expenditure.basis.actual_payments",
      "group": "Scope and measure",
      "title": "The measure is actual payments for the full 12 months",
      "statusLabel": "Official fact",
      "summary": "Annual expenditure is based on total cash payments: expenses, increases in non-financial and financial assets, and decreases in liabilities.",
      "detail": [
        "Source amounts published in thousands of GEL are converted to GEL during import."
      ],
      "canonicalDecisionIds": [
        "expenditure.basis.actual_payments"
      ]
    },
    {
      "id": "expenditure.precedence.actual_over_planned",
      "group": "Scope and measure",
      "title": "Actual values take precedence over planned values",
      "statusLabel": "Fiscal.ge decision",
      "summary": "When both planned and actual values exist for the same item and year, actual execution is used as the public value.",
      "detail": [],
      "canonicalDecisionIds": [
        "expenditure.precedence.actual_over_planned"
      ]
    },
    {
      "id": "expenditure.disclosure.official_totals_geodata_categories",
      "group": "Transparency",
      "title": "Annual totals are official; public categories are Fiscal.ge’s classification",
      "statusLabel": "Fiscal.ge decision",
      "summary": "The official source determines the amounts and annual total. Their allocation to 13 clear public functions follows Fiscal.ge’s documented mapping.",
      "detail": [],
      "canonicalDecisionIds": [
        "expenditure.disclosure.official_totals_geodata_categories"
      ]
    },
    {
      "id": "expenditure.mapping.cofog",
      "group": "Classification",
      "title": "Functions for 2007–2025 are combined using COFOG codes",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Official functional codes map to stable public spending categories. Debt service, transfers, transport, environment, sport and culture are allocated under separate rules.",
      "detail": [],
      "canonicalDecisionIds": [
        "expenditure.mapping.cofog"
      ]
    },
    {
      "id": "expenditure.mapping.old_14_group",
      "group": "Classification",
      "title": "The older 14-group classification for 2004–2006 uses a separate mapping",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Pre-COFOG groups map to the closest public functions. Subcodes for sport, environment, debt and municipal transfers are separated from their main groups.",
      "detail": [],
      "canonicalDecisionIds": [
        "expenditure.mapping.old_14_group"
      ]
    },
    {
      "id": "expenditure.mapping.supplement_exact_then_keyword",
      "group": "Classification",
      "title": "Supplementary financial flows are allocated by exact matches first, then by reviewed keywords",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Financial-asset and liability rows are first matched against approved Georgian labels. The remaining rows use manually reviewed rules limited to specified years.",
      "detail": [],
      "canonicalDecisionIds": [
        "expenditure.mapping.supplement_exact_then_keyword"
      ]
    },
    {
      "id": "expenditure.mapping.unclassified_never_dropped",
      "group": "Classification",
      "title": "Uncertain amounts are retained",
      "statusLabel": "Fiscal.ge decision",
      "summary": "A row whose function cannot be reliably determined from its source remains in `spending.other_unclassified`, with an explanation, and is included in full in the annual total.",
      "detail": [],
      "canonicalDecisionIds": [
        "expenditure.mapping.unclassified_never_dropped"
      ]
    },
    {
      "id": "expenditure.validation.annual_reconciliation",
      "group": "Validation",
      "title": "Every year is reconciled with official payments",
      "statusLabel": "Official fact",
      "summary": "The annual sum of public categories must match independently published state-budget payments within a maximum difference of 1,000 GEL.",
      "detail": [
        "A mismatch stops preparation before publication. Matching the total does not, on its own, prove the internal classification is correct."
      ],
      "canonicalDecisionIds": [
        "expenditure.validation.annual_reconciliation"
      ]
    }
  ],
  "technicalAppendix": [
    {
      "id": "expenditure.decision.2009_tax_arrears",
      "group": "Historical decisions",
      "title": "The 2009 settlement of tax arrears is classified as general public services",
      "statusLabel": "Fiscal.ge decision",
      "summary": "The 182.9 million GEL row is treated as fiscal administration, not sovereign debt service.",
      "detail": [],
      "canonicalDecisionIds": [
        "expenditure.decision.2009_tax_arrears"
      ]
    },
    {
      "id": "expenditure.decision.2012_disaster_fund",
      "group": "Historical decisions",
      "title": "The 700,000 GEL for disaster relief in 2012 remains in Other / unclassified",
      "statusLabel": "Fiscal.ge decision",
      "summary": "The label does not reliably distinguish infrastructure spending from household assistance, so the amount is not allocated artificially.",
      "detail": [],
      "canonicalDecisionIds": [
        "expenditure.decision.2012_disaster_fund"
      ]
    },
    {
      "id": "expenditure.decision.donor_coordination",
      "group": "Historical decisions",
      "title": "GIZ/KfW regional projects are classified as infrastructure and regional development",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Reviewed rows for bilateral and interregional projects and KfW co-financing are combined in this function.",
      "detail": [],
      "canonicalDecisionIds": [
        "expenditure.decision.donor_coordination"
      ]
    },
    {
      "id": "expenditure.decision.2008_financial_aggregates",
      "group": "Historical decisions",
      "title": "The financial aggregates for 2008 are allocated to two functions",
      "statusLabel": "Fiscal.ge decision",
      "summary": "The aggregate for loans and equity contributions is allocated to economic affairs; external and domestic debt repayments are allocated to debt service.",
      "detail": [],
      "canonicalDecisionIds": [
        "expenditure.decision.2008_financial_aggregates"
      ]
    },
    {
      "id": "expenditure.decision.2011_arrears_court_fund",
      "group": "Historical decisions",
      "title": "The 2011 fund for arrears and court judgments is classified as public order and safety",
      "statusLabel": "Fiscal.ge decision",
      "summary": "The fund is classified consistently with comparable rows in later years.",
      "detail": [],
      "canonicalDecisionIds": [
        "expenditure.decision.2011_arrears_court_fund"
      ]
    },
    {
      "id": "expenditure.decision.2014_2016_residual_review",
      "group": "Historical decisions",
      "title": "Residual amounts for 2014–2016 were reviewed row by row",
      "statusLabel": "Fiscal.ge decision",
      "summary": "19 rows were reassigned using verified sector-specific evidence. Other / unclassified was reduced to zero for these years without changing the totals.",
      "detail": [],
      "canonicalDecisionIds": [
        "expenditure.decision.2014_2016_residual_review"
      ]
    },
    {
      "id": "expenditure.decision.2008_2011_residual_review",
      "group": "Historical decisions",
      "title": "Residual amounts for 2008–2011 were resolved under the same reviewed rules",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Enterprise management, energy, water and other rows were assigned to the relevant functions using documented evidence. Annual totals are unchanged.",
      "detail": [],
      "canonicalDecisionIds": [
        "expenditure.decision.2008_2011_residual_review"
      ]
    },
    {
      "id": "expenditure.admin.idp_health_social",
      "group": "Institutional classification",
      "title": "The agency for internally displaced persons and refugees is in the health and social protection group",
      "statusLabel": "Fiscal.ge decision",
      "summary": "The independent agency operating in 2005–2018 is assigned to the health and social protection administrative group based on the subsequent succession of its programmes.",
      "detail": [],
      "canonicalDecisionIds": [
        "expenditure.admin.idp_health_social"
      ]
    },
    {
      "id": "expenditure.admin.environment_agriculture",
      "group": "Institutional classification",
      "title": "The former environment agency is assigned to environment and agriculture",
      "statusLabel": "Fiscal.ge decision",
      "summary": "The environment and natural resources name used before 2017 is distinguished from the energy agency’s similar name.",
      "detail": [],
      "canonicalDecisionIds": [
        "expenditure.admin.environment_agriculture"
      ]
    },
    {
      "id": "expenditure.admin.sport_culture_demerger",
      "group": "Institutional classification",
      "title": "Sport and culture are separated by function within merged institutions",
      "statusLabel": "Fiscal.ge decision",
      "summary": "For 2018–2024, programme names restore continuous sport and culture series. Education and science programmes remain in the parent group.",
      "detail": [],
      "canonicalDecisionIds": [
        "expenditure.admin.sport_culture_demerger"
      ]
    },
    {
      "id": "expenditure.admin.penitentiary_justice",
      "group": "Institutional classification",
      "title": "Corrections are assigned to the justice group",
      "statusLabel": "Fiscal.ge decision",
      "summary": "The corrections agencies operating in 2009–2013 are assigned to the justice administrative group using a common text-matching rule.",
      "detail": [],
      "canonicalDecisionIds": [
        "expenditure.admin.penitentiary_justice"
      ]
    },
    {
      "id": "expenditure.admin.youth_education",
      "group": "Institutional classification",
      "title": "The 2005 Department of Youth Affairs is included in education",
      "statusLabel": "Fiscal.ge decision",
      "summary": "This follows the education, science and youth group in the modern administrative taxonomy.",
      "detail": [],
      "canonicalDecisionIds": [
        "expenditure.admin.youth_education"
      ]
    },
    {
      "id": "expenditure.admin.finance_three_way_split",
      "group": "Institutional classification",
      "title": "The historical finance institution total is split into three parts",
      "statusLabel": "Fiscal.ge decision",
      "summary": "For 2005–2009, core financial administration, debt principal, and transfers/reserves are allocated to separate groups to preserve comparability over time.",
      "detail": [],
      "canonicalDecisionIds": [
        "expenditure.admin.finance_three_way_split"
      ]
    },
    {
      "id": "expenditure.admin.culture_sport_split",
      "group": "Institutional classification",
      "title": "Historical institutions combining culture and sport are separated",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Reviewed internal rows for 2005–2009 distinguish sport from culture; youth affairs are assigned to education.",
      "detail": [],
      "canonicalDecisionIds": [
        "expenditure.admin.culture_sport_split"
      ]
    },
    {
      "id": "expenditure.admin.debt_service",
      "group": "Institutional classification",
      "title": "Debt service has its own administrative group",
      "statusLabel": "Fiscal.ge decision",
      "summary": "From 2010 onward, the source’s nationwide payment row is used. In earlier years, the part separated from the finance institution is included in the same category.",
      "detail": [],
      "canonicalDecisionIds": [
        "expenditure.admin.debt_service"
      ]
    },
    {
      "id": "expenditure.admin.other_costs",
      "group": "Institutional classification",
      "title": "Independent bodies and nationwide reserves are included in other costs",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Governors, state ministers’ offices, constitutionally independent bodies and general reserves remain in `other_costs`. Functional ministries are not hidden in that group.",
      "detail": [],
      "canonicalDecisionIds": [
        "expenditure.admin.other_costs"
      ]
    },
    {
      "id": "expenditure.program.threshold_100m_modern",
      "group": "Major programmes",
      "title": "The major-programme threshold in modern years is 100 million GEL",
      "statusLabel": "Fiscal.ge decision",
      "summary": "A series is shown if it reaches at least 100 million GEL in any year from 2017 onward. Once it qualifies, years with smaller amounts are retained too.",
      "detail": [],
      "canonicalDecisionIds": [
        "expenditure.program.threshold_100m_modern"
      ]
    },
    {
      "id": "expenditure.program.modern_presence",
      "group": "Major programmes",
      "title": "Only programmes that exist in the modern period are shown as separate series",
      "statusLabel": "Fiscal.ge decision",
      "summary": "A programme discontinued before 2017 is not published as a separate series, but its amount remains in the administrative category total.",
      "detail": [],
      "canonicalDecisionIds": [
        "expenditure.program.modern_presence"
      ]
    },
    {
      "id": "expenditure.program.semantic_eras",
      "group": "Major programmes",
      "title": "Reused codes are split into distinct periods of meaning",
      "statusLabel": "Fiscal.ge decision",
      "summary": "If a code represents a completely different programme, the relevant years retain a separate identity. A simple renaming does not interrupt the series.",
      "detail": [],
      "canonicalDecisionIds": [
        "expenditure.program.semantic_eras"
      ]
    },
    {
      "id": "expenditure.program.successions",
      "group": "Major programmes",
      "title": "Code changes for the same programme are combined into one continuous series",
      "statusLabel": "Fiscal.ge decision",
      "summary": "When ministries merge, programmes are renumbered or nationwide codes change, documented successor segments are combined under the latest code’s identity.",
      "detail": [],
      "canonicalDecisionIds": [
        "expenditure.program.successions"
      ]
    },
    {
      "id": "expenditure.program.perimeter_changes_not_joined",
      "group": "Major programmes",
      "title": "Programme series with changed scope are not combined",
      "statusLabel": "Fiscal.ge decision",
      "summary": "When a function is split or transferred to another unit and the series’ content changes, the old and new segments remain separate to avoid an artificial jump.",
      "detail": [],
      "canonicalDecisionIds": [
        "expenditure.program.perimeter_changes_not_joined"
      ]
    },
    {
      "id": "expenditure.program.legacy_joins",
      "group": "Major programmes",
      "title": "Some organisational rows from 2006–2011 are linked to modern programmes through reviewed decisions",
      "statusLabel": "Fiscal.ge decision",
      "summary": "For nine programmes, predecessor rows representing a continuous function are combined into modelled series. Their composition and exceptions are documented for each point.",
      "detail": [],
      "canonicalDecisionIds": [
        "expenditure.program.legacy_joins"
      ]
    },
    {
      "id": "expenditure.program.names_only",
      "group": "Major programmes",
      "title": "Public selectors show programme names, not unstable codes",
      "statusLabel": "Fiscal.ge decision",
      "summary": "The series follows the latest official Georgian name, with a reviewed English translation for English display. The source-year code is retained in provenance data.",
      "detail": [],
      "canonicalDecisionIds": [
        "expenditure.program.names_only"
      ]
    }
  ],
  "hiddenDecisionGroups": [
    "Historical decisions"
  ]
};

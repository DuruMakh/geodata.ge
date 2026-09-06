import type { MethodologyContent } from "../../types";

// Reviewed English presentation; IDs, source references and coverage remain shared.
export const MUNICIPALITIES_METHODOLOGY_CONTENT: MethodologyContent = {
  "id": "municipalities",
  "slug": "municipalities",
  "title": "Municipalities methodology",
  "summary": "How expenditure for 64 public municipalities, Adjara’s republican payments and the 69-series Georgia total are combined without counting internal transfers twice.",
  "reviewedAt": "2026-08-16",
  "archiveManifestId": "municipalities",
  "coverageSource": {
    "kind": "municipalTotals"
  },
  "canonicalDocuments": [
    "docs/data-methodology/municipal-functional-annual-2015-2025.md"
  ],
  "disclosure": "Municipal amounts and functional codes come from official sources. Adjara’s republican payments are added to the Adjara and Georgia totals after deducting transfers; the ten functions still reflect municipal classification. The public 64-code register and inclusion of five codes only in the Georgia total are reviewed Fiscal.ge decisions.",
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
      "value": "Actual execution"
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
        "The public view shows actual annual expenditure for 64 municipalities. Among the 11 regions, Adjara has a special consolidated total: actual republican-budget payments of the Autonomous Republic of Adjara are added to its six municipalities, and transfers to those municipalities are deducted.",
        "Codes 05, 42, 43, 46 and 64 are not published as separate territorial pages. Their series are included only in the Georgia total and are not presented as territorially attributable expenditure.",
        "The Georgia aggregate, `country.georgia`, combines 69 municipal series and the same net republican amount for Adjara. Rankings still cover 64 municipalities and 11 regions; the republic of Adjara is not a separate entity."
      ]
    },
    {
      "id": "sources",
      "kind": "sources",
      "title": "Official sources",
      "paragraphs": [
        "Functional data for 2015–2019 comes from the archived municipal portal; data for 2020–2025 comes from annual Ministry of Finance workbooks. Adjara’s republican payments come from the official 2015 table on Matsne and a reviewed workbook for 2016–2025. Transfers to municipalities come from Treasury annual consolidated revenue reports."
      ]
    },
    {
      "id": "journey",
      "kind": "journey",
      "title": "From source to data",
      "paragraphs": [
        "Original sources are preserved unchanged, amounts are converted to GEL and 64 municipal pages are created. Republican payments are then added to the Adjara and Georgia totals, with internal transfers deducted. Exact arithmetic, coverage for 2015–2025 and agreement between CSVs and the database are checked before publication."
      ]
    },
    {
      "id": "archive",
      "kind": "archive",
      "title": "Unchanged original sources",
      "paragraphs": [
        "The archive preserves approved official portal exports and Ministry of Finance workbooks byte for byte. Map geometry provenance is documented in the public methodology; prepared OSM/Natural Earth geometry copies and project artifacts are excluded from the downloadable archive. Prepared Fiscal.ge CSV/XLSX research files are not presented as official originals."
      ]
    }
  ],
  "decisions": [
    {
      "id": "municipalities.scope.2015_2025",
      "group": "Coverage",
      "title": "The municipal series contains annual data for 2015–2025",
      "statusLabel": "Official fact",
      "summary": "The served facts cover 11 consecutive years and publish only annual, nominal, actual amounts.",
      "detail": [],
      "canonicalDecisionIds": [
        "municipalities.scope.2015_2025"
      ]
    },
    {
      "id": "municipalities.scope.64_municipalities_11_regions",
      "group": "Coverage",
      "title": "The public view combines 64 municipalities and 11 regions with data",
      "statusLabel": "Fiscal.ge decision",
      "summary": "The reviewed public register links 64 municipalities to 11 semantic regions. Region is not a separate field in the sources.",
      "detail": [],
      "canonicalDecisionIds": [
        "municipalities.scope.64_municipalities_11_regions"
      ]
    },
    {
      "id": "municipalities.scope.ten_main_functions",
      "group": "Coverage",
      "title": "The public panel uses ten main functions",
      "statusLabel": "Fiscal.ge decision",
      "summary": "The ten main, mutually exclusive functional groups are published consistently for every served year.",
      "detail": [],
      "canonicalDecisionIds": [
        "municipalities.scope.ten_main_functions"
      ]
    },
    {
      "id": "municipalities.scope.selected_details_not_served",
      "group": "Coverage",
      "title": "Six selected detailed rows are excluded from public facts",
      "statusLabel": "Fiscal.ge decision",
      "summary": "These detailed rows are already included in their parent main functions. Importing them separately would duplicate amounts that cannot be added to their parents.",
      "detail": [],
      "canonicalDecisionIds": [
        "municipalities.scope.selected_details_not_served"
      ]
    },
    {
      "id": "municipalities.mapping.stable_function_ids",
      "group": "Classification",
      "title": "Official functional codes map to stable `municipal.*` identifiers",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Codes 7.1–7.10 map to ten public IDs independent of names, so a label change does not interrupt the time series.",
      "detail": [],
      "canonicalDecisionIds": [
        "municipalities.mapping.stable_function_ids"
      ]
    },
    {
      "id": "municipalities.mapping.reviewed_region_crosswalk",
      "group": "Geography",
      "title": "Regional membership uses a reviewed public mapping",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Each source municipality code is assigned a semantic region ID based on the official administrative division. Regional totals sum only the members of that mapping.",
      "detail": [],
      "canonicalDecisionIds": [
        "municipalities.mapping.reviewed_region_crosswalk"
      ]
    },
    {
      "id": "municipalities.exclusion.five_codes",
      "group": "Coverage",
      "title": "Codes 05, 42, 43, 46 and 64 are excluded from separate territorial views",
      "statusLabel": "Fiscal.ge decision",
      "summary": "These budgets belong to Georgian municipal authorities operating outside the occupied territories and serving displaced communities. Their reviewed series are included only in the 69-series Georgia total; the amounts cannot be attributed to expenditure within the named territories.",
      "detail": [],
      "canonicalDecisionIds": [
        "municipalities.exclusion.five_codes"
      ]
    },
    {
      "id": "municipalities.exclusion.abkhazia_region",
      "group": "Coverage",
      "title": "No Abkhazia region with served data is created in the public taxonomy",
      "statusLabel": "Fiscal.ge decision",
      "summary": "After code 05 is excluded, `region.abkhazia` has no served municipality. A territorial map layer is not converted into a data region.",
      "detail": [],
      "canonicalDecisionIds": [
        "municipalities.exclusion.abkhazia_region"
      ]
    },
    {
      "id": "municipalities.source.2015_2019_portal",
      "group": "Sources",
      "title": "Functions for 2015–2019 come from the archived municipal portal",
      "statusLabel": "Official fact",
      "summary": "For each preserved year, 12 months of ActualAmount are summed by municipality and function. Incomplete portal records for 2021–2022 are not used.",
      "detail": [],
      "canonicalDecisionIds": [
        "municipalities.source.2015_2019_portal"
      ]
    },
    {
      "id": "municipalities.source.2020_2025_workbooks",
      "group": "Sources",
      "title": "Functions for 2020–2025 come from annual Ministry of Finance workbooks",
      "statusLabel": "Official fact",
      "summary": "Comparable annual rows are converted from thousands of GEL to GEL and form one series from the current official release.",
      "detail": [],
      "canonicalDecisionIds": [
        "municipalities.source.2020_2025_workbooks"
      ]
    },
    {
      "id": "municipalities.total.2015_functional_fallback",
      "group": "Public total",
      "title": "The public total for 2015 uses the functional total as a substitute",
      "statusLabel": "Limitation",
      "summary": "The current Ministry of Finance historical total-payments column is unavailable for 2015, so the official actual functional total is used.",
      "detail": [],
      "canonicalDecisionIds": [
        "municipalities.total.2015_functional_fallback"
      ]
    },
    {
      "id": "municipalities.total.2016_2025_official_payments",
      "group": "Public total",
      "title": "For 2016–2025, the main measure is official total payments",
      "statusLabel": "Official fact",
      "summary": "Actual total payments from each municipality’s historical workbook are used for the public `Total budget` series.",
      "detail": [],
      "canonicalDecisionIds": [
        "municipalities.total.2016_2025_official_payments"
      ]
    },
    {
      "id": "municipalities.total.khulo_2024_fallback",
      "group": "Public total",
      "title": "Khulo’s total for 2024 uses an actual functional total as a substitute",
      "statusLabel": "Limitation",
      "summary": "The current historical workbook lacks an actual total-payments value for 2024. A planned amount is not substituted; the official actual functional total is used.",
      "detail": [],
      "canonicalDecisionIds": [
        "municipalities.total.khulo_2024_fallback"
      ]
    },
    {
      "id": "municipalities.total.adjara_consolidated",
      "group": "Public total",
      "title": "Adjara’s regional total combines republican and municipal budgets",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Actual republican-budget payments of the Autonomous Republic of Adjara are added to the public totals of its six municipalities. Transfers to the municipalities are deducted to avoid double counting.",
      "detail": [],
      "canonicalDecisionIds": [
        "municipalities.total.adjara_consolidated"
      ]
    },
    {
      "id": "municipalities.total.georgia_adjara_adjustment",
      "group": "Public total",
      "title": "Adjara’s net republican amount is added once to the Georgia total",
      "statusLabel": "Fiscal.ge decision",
      "summary": "The sum of 69 municipal budget series includes the same annual Adjara republican payments after deducting transfers. The republic of Adjara is not created as a separate public entity.",
      "detail": [],
      "canonicalDecisionIds": [
        "municipalities.total.georgia_adjara_adjustment"
      ]
    },
    {
      "id": "municipalities.total.functional_vs_public",
      "group": "Public total",
      "title": "The functional total and the public total budget are different measures",
      "statusLabel": "Official fact",
      "summary": "Total payments can include increases in financial assets and decreases in liabilities that are not fully distributed across the ten historical functions.",
      "detail": [],
      "canonicalDecisionIds": [
        "municipalities.total.functional_vs_public"
      ]
    },
    {
      "id": "municipalities.share.not_normalized",
      "group": "Public total",
      "title": "Functional shares use the official public total and are not normalised",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Each function is divided by `public_total_gel`. The ten shares can therefore sum to less or more than 100%; the `Total budget` line is always 100%.",
      "detail": [],
      "canonicalDecisionIds": [
        "municipalities.share.not_normalized"
      ]
    },
    {
      "id": "municipalities.share.no_forced_residual",
      "group": "Public total",
      "title": "No artificial residual category is created for reconciliation",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Functional amounts are not altered, and the difference is not allocated to an invented category. The two official measures remain separate.",
      "detail": [],
      "canonicalDecisionIds": [
        "municipalities.share.no_forced_residual"
      ]
    },
    {
      "id": "municipalities.geometry.osm_odbl",
      "group": "Geography",
      "title": "Municipal boundaries use OpenStreetMap data under the ODbL",
      "statusLabel": "Official fact",
      "summary": "60 reviewed polygons and five city markers cover exactly 64 served codes. The public source note preserves attribution to OpenStreetMap contributors and the ODbL licence.",
      "detail": [],
      "canonicalDecisionIds": [
        "municipalities.geometry.osm_odbl"
      ]
    },
    {
      "id": "municipalities.geometry.natural_earth_public_domain",
      "group": "Geography",
      "title": "Two non-interactive territorial overlays use public-domain Natural Earth geometry",
      "statusLabel": "Official fact",
      "summary": "These overlays are not data entities. They have no label, link, tooltip, keyboard focus or legend entry.",
      "detail": [],
      "canonicalDecisionIds": [
        "municipalities.geometry.natural_earth_public_domain"
      ]
    }
  ],
  "technicalAppendix": [
    {
      "id": "municipalities.population.not_imported",
      "group": "Limitations",
      "title": "The historical population column is not imported",
      "statusLabel": "Limitation",
      "summary": "The archived portal’s population series ends in 2021, and its provenance has not been fully reviewed. Historical per-resident measures are therefore not calculated from this source.",
      "detail": [],
      "canonicalDecisionIds": [
        "municipalities.population.not_imported"
      ]
    },
    {
      "id": "municipalities.limitation.adjara_functions",
      "group": "Limitations",
      "title": "Adjara’s republican amount is not allocated to the ten municipal functions",
      "statusLabel": "Limitation",
      "summary": "The republican source does not provide a comparable ten-function mapping for 2015–2025. The consolidated total is therefore complete, while the functional series retain the municipal classification; no artificial allocation is created.",
      "detail": [],
      "canonicalDecisionIds": [
        "municipalities.limitation.adjara_functions"
      ]
    },
    {
      "id": "municipalities.encoding.excel_bom",
      "group": "Data quality",
      "title": "Georgian CSVs intended for Excel are written with a UTF-8 BOM",
      "statusLabel": "Fiscal.ge decision",
      "summary": "The three-byte BOM signals the correct encoding to Windows Excel, protecting Georgian text and identifiers with leading zeros from corruption.",
      "detail": [],
      "canonicalDecisionIds": [
        "municipalities.encoding.excel_bom"
      ]
    },
    {
      "id": "municipalities.validation.coverage_reconciliation",
      "group": "Validation",
      "title": "Coverage, keys, totals, encoding and hashes are checked together",
      "statusLabel": "Official fact",
      "summary": "Validation checks the complete year-by-municipality panel, the absence of duplicate and negative amounts, reconciliation with source functional totals and total-payments components, and output-file hashes.",
      "detail": [],
      "canonicalDecisionIds": [
        "municipalities.validation.coverage_reconciliation"
      ]
    },
    {
      "id": "municipalities.limitation.source_transition",
      "group": "Limitations",
      "title": "The 2020 source transition and differences between 2016–2019 releases matter when reading trends",
      "statusLabel": "Limitation",
      "summary": "Functions for 2015–2019 come from the archived portal; from 2020 onward, they come from current annual workbooks. Earlier official totals may belong to a different release.",
      "detail": [],
      "canonicalDecisionIds": [
        "municipalities.limitation.source_transition"
      ]
    }
  ]
};

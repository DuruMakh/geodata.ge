import type { MethodologyContent } from "../../types";

export const TRADE_METHODOLOGY_CONTENT: MethodologyContent = {
  "id": "trade",
  "slug": "trade",
  "title": "External trade in goods",
  "summary": "Georgia’s annual goods exports, imports, total trade and trade balance nationally, by partner country and by country group in nominal USD.",
  "reviewedAt": "2026-10-08",
  "archiveManifestId": "trade",
  "coverageSource": {
    "kind": "archive"
  },
  "canonicalDocuments": [
    "docs/data-methodology/trade-annual.md"
  ],
  "disclosure": "The Overview and Trading partners pages use separately reviewed annual goods subsets. Services, partial-year data and other trade breakdowns remain outside these pages.",
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
      "label": "Publication status",
      "valueKind": "basis",
      "value": "Unspecified by the source"
    },
    {
      "label": "Units",
      "valueKind": "unit",
      "value": "Nominal USD"
    }
  ],
  "sections": [
    {
      "id": "scope",
      "kind": "scope",
      "title": "Which trade is covered?",
      "paragraphs": [
        "Annual national totals, individual partner countries and five published country groups are covered. Total exports include re-exports. Separate re-export, product, regional and services comparisons are excluded. The incomplete 2026 column is not served."
      ]
    },
    {
      "id": "formulas",
      "kind": "sources",
      "title": "How are the four indicators related?",
      "paragraphs": [
        "Exports and imports come directly from the national totals. Total trade = exports + imports. Trade balance = exports − imports. A negative balance means imports exceed exports; it does not by itself establish whether trade is beneficial or harmful."
      ]
    },
    {
      "id": "valuation",
      "kind": "classification",
      "title": "Values and comparability",
      "paragraphs": [
        "Values are nominal US dollars, without inflation adjustment or currency conversion. National source totals use million USD; partner sources use thousand USD. Fiscal.ge converts the exact values to USD. Exports use FOB valuation at the exporting border. Imports use CIF valuation, including transport and insurance to the importing border."
      ]
    },
    {
      "id": "partners",
      "kind": "classification",
      "title": "Partner countries and overlapping groups",
      "paragraphs": [
        "Export partners are final destinations; import partners are sending countries, which may differ from manufacturing origins. Exports include re-exports.",
        "EU, CIS, BSEC, OECD and GUAM use Geostat’s published totals for each year, rather than reconstructed present-day memberships. Country groups overlap. Their values and shares must not be added together or added to individual countries.",
        "Historical identities remain distinct: Serbia and Montenegro is not joined to its successors, and Netherlands Antilles is not joined to a successor territory. Blanks, dashes and an absent flow remain missing; a published numerical zero stays zero. Total trade and balance are derived only when both flows are numerical for the same partner and year.",
        "Shares use Georgia’s national total for the same year and measure. Country groups overlap. Balance is exports minus imports and has no percentage share."
      ]
    },
    {
      "id": "publication",
      "kind": "limitations",
      "title": "Annual data and publication status",
      "paragraphs": [
        "Actual annual observations describe recorded trade rather than planned amounts. The captured source does not explicitly assign final or preliminary status to these annual cells, so publication status remains unspecified. A complete calendar year is not treated as proof of finality."
      ]
    },
    {
      "id": "validation",
      "kind": "validation",
      "title": "How are the figures checked?",
      "paragraphs": [
        "The accepted Overview subset contains 62 original export/import observations and 62 derived totals/balances. Every year has all four indicators. Checks compare the original file fingerprint, exact source cell values, units, year/flow references and both formulas. Exact source decimals are retained; displayed figures use a common rounded USD scale. Missing values are shown as gaps or dashes.",
        "The accepted partner subset adds 212 country identities and five groups: 12,462 source observations and 10,530 derived amounts. Separate checks verify all four originals, exact cells, roles, units, source codes, missingness, formulas and declared reconciliations against the matching national totals. Groups are never summed. The two UK services source discrepancies remain unresolved outside this accepted goods subset."
      ]
    },
    {
      "id": "archive",
      "kind": "archive",
      "title": "Original sources",
      "paragraphs": [
        "Seven frozen Geostat originals are available: the national workbook, four partner-country/group workbooks, brief merchandise-trade methodology and external-trade metadata page, retrieved on 7 October 2026. The HTML captures download as plain-text attachments. Excel follows the chosen measure, years and all selected countries/groups, including selections from the other browsing tab; applicable originals accompany the figures."
      ]
    }
  ],
  "decisions": [
    {
      "id": "trade.scope",
      "group": "trade",
      "title": "Which trade is covered?",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Annual national totals, individual partner countries and five published country groups are covered. Total exports include re-exports. Separate re-export, product, regional and services comparisons are excluded. The incomplete 2026 column is not served.",
      "detail": [],
      "canonicalDecisionIds": [
        "trade.scope"
      ]
    },
    {
      "id": "trade.formulas",
      "group": "trade",
      "title": "How are the four indicators related?",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Exports and imports come directly from the national totals. Total trade = exports + imports. Trade balance = exports − imports. A negative balance means imports exceed exports; it does not by itself establish whether trade is beneficial or harmful.",
      "detail": [],
      "canonicalDecisionIds": [
        "trade.formulas"
      ]
    },
    {
      "id": "trade.valuation",
      "group": "trade",
      "title": "Values and comparability",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Values are nominal US dollars, without inflation adjustment or currency conversion. National source totals use million USD; partner sources use thousand USD. Fiscal.ge converts the exact values to USD. Exports use FOB valuation at the exporting border. Imports use CIF valuation, including transport and insurance to the importing border.",
      "detail": [],
      "canonicalDecisionIds": [
        "trade.valuation"
      ]
    },
    {
      "id": "trade.publication",
      "group": "trade",
      "title": "Annual data and publication status",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Actual annual observations describe recorded trade rather than planned amounts. The captured source does not explicitly assign final or preliminary status to these annual cells, so publication status remains unspecified. A complete calendar year is not treated as proof of finality.",
      "detail": [],
      "canonicalDecisionIds": [
        "trade.publication"
      ]
    }
  ],
  "technicalAppendix": [],
  "showTechnicalAppendix": false
};

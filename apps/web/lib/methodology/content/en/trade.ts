import type { MethodologyContent } from "../../types";

export const TRADE_METHODOLOGY_CONTENT: MethodologyContent = {
  "id": "trade",
  "slug": "trade",
  "title": "External trade in goods",
  "summary": "Georgia’s annual goods trade nationally, by partner country, country group and four-digit product code in nominal USD.",
  "reviewedAt": "2026-10-10",
  "archiveManifestId": "trade",
  "coverageSource": {
    "kind": "archive"
  },
  "canonicalDocuments": [
    "docs/data-methodology/trade-annual.md"
  ],
  "disclosure": "Overview, Trading partners and Products use separately reviewed annual goods subsets. Services and partial-year data remain outside these pages.",
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
        "Annual national totals, individual partner countries, five published country groups and four-digit products are covered. Total exports include re-exports. Separate re-export, regional and services comparisons are excluded. The incomplete 2026 column is not served."
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
        "Values are nominal US dollars, without inflation adjustment or currency conversion. National source totals use million USD; partner and product sources use thousand USD. Fiscal.ge converts the exact values to USD. Exports use FOB valuation at the exporting border. Imports use CIF valuation, including transport and insurance to the importing border."
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
      "id": "products",
      "kind": "classification",
      "title": "Products from 2020",
      "paragraphs": [
        "The Products page covers reviewed annual four-digit (HS4) exports and imports from 2020–2025. It shows 1,192 products once each, with their four-digit codes. The national reference, chart, table, ranking and downloads use the same period. Earlier product definitions remain preserved separately in the reviewed data and original archives; they are not joined to the current series.",
        "The eight browsing categories are navigation aids, not official aggregates; no category totals are invented. Georgian names and search aliases preserve the meaning of the historical source names. Blanks, dashes, absent flows and years outside a source block remain missing. Published numerical zero and negative values retain their signs.",
        "Products offer exports and imports separately. End-year shares use the matching national goods total. Ranking excludes missing values from numbered ranks; products without an end-year amount remain available for selection."
      ]
    },
    {
      "id": "validation",
      "kind": "validation",
      "title": "How are the figures checked?",
      "paragraphs": [
        "The accepted Overview subset contains 62 original export/import observations and 62 derived totals/balances. Every year has all four indicators. Checks compare the original file fingerprint, exact source cell values, units, year/flow references and both formulas. Exact source decimals are retained; displayed figures use a common rounded USD scale. Missing values are shown as gaps or dashes.",
        "The accepted partner subset adds 212 country identities and five groups: 12,462 source observations and 10,530 derived amounts. Separate checks verify all four originals, exact cells, roles, units, source codes, missingness, formulas and declared reconciliations against the matching national totals. Groups are never summed. The two UK services source discrepancies remain unresolved outside this accepted goods subset.",
        "The complete reviewed product archive retains 4,768 period-qualified identities and 69,624 detail observations. Six original workbooks and every canonical source cell are checked; 62 native total controls reconcile against national totals within USD 1. Exact source decimals and native cell references are retained. The public Products page selects only the 2020–2025 source block from this accepted package. No historical blocks are joined."
      ]
    },
    {
      "id": "archive",
      "kind": "archive",
      "title": "Original sources",
      "paragraphs": [
        "Thirteen frozen Geostat originals are available: the national workbook, four partner-country/group workbooks, six product workbooks, brief merchandise-trade methodology and external-trade metadata page, retrieved on 7 October 2026. HTML captures download as plain-text attachments. Excel includes the chosen measure, every selected year and all committed series, beyond the visible table page. Products downloads are limited to 2020 onward and follow the selected date range. Product codes, actual basis, unspecified publication status and applicable original-source links are retained. Missing amounts stay blank. Public workbooks do not expose internal cell metadata."
      ]
    }
  ],
  "decisions": [
    {
      "id": "trade.scope",
      "group": "trade",
      "title": "Which trade is covered?",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Annual national totals, individual partner countries, five published country groups and four-digit products are covered. Total exports include re-exports. Separate re-export, regional and services comparisons are excluded. The incomplete 2026 column is not served.",
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
      "summary": "Values are nominal US dollars, without inflation adjustment or currency conversion. National source totals use million USD; partner and product sources use thousand USD. Fiscal.ge converts the exact values to USD. Exports use FOB valuation at the exporting border. Imports use CIF valuation, including transport and insurance to the importing border.",
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

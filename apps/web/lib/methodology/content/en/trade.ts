import type { MethodologyContent } from "../../types";

export const TRADE_METHODOLOGY_CONTENT: MethodologyContent = {
  "id": "trade",
  "slug": "trade",
  "title": "External trade in goods",
  "summary": "Georgia’s annual national goods exports, imports, total trade and trade balance in nominal USD.",
  "reviewedAt": "2026-10-08",
  "archiveManifestId": "trade",
  "coverageSource": {
    "kind": "archive"
  },
  "canonicalDocuments": [
    "docs/data-methodology/trade-annual.md"
  ],
  "disclosure": "The Overview serves only the reviewed national goods totals. Services and other trade comparisons remain outside this page.",
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
        "Annual national goods totals from the captured Geostat workbook are used. Total exports include re-exports. Separate re-export, partner-country, product, regional and services comparisons are outside this Overview. The incomplete 2026 column is excluded."
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
        "Values are nominal US dollars, without inflation adjustment or currency conversion. The source publishes million USD; Fiscal.ge converts those exact values to USD. Exports use FOB valuation at the exporting border. Imports use CIF valuation, including transport and insurance to the importing border."
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
        "The accepted Overview subset contains 62 original export/import observations and 62 derived totals/balances. Every year has all four indicators. Checks compare the original file fingerprint, exact source cell values, units, year/flow references and both formulas. Exact source decimals are retained; displayed figures use a common rounded USD scale. Missing values are shown as gaps or dashes."
      ]
    },
    {
      "id": "archive",
      "kind": "archive",
      "title": "Original sources",
      "paragraphs": [
        "Three frozen Geostat originals are available: the goods workbook, brief merchandise-trade methodology and external-trade metadata page, retrieved on 7 October 2026. Older research captures and unresolved services comparisons do not expand this accepted subset. Excel contains only the selected indicators and years, with original-source links."
      ]
    }
  ],
  "decisions": [
    {
      "id": "trade.scope",
      "group": "trade",
      "title": "Which trade is covered?",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Annual national goods totals from the captured Geostat workbook are used. Total exports include re-exports. Separate re-export, partner-country, product, regional and services comparisons are outside this Overview. The incomplete 2026 column is excluded.",
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
      "summary": "Values are nominal US dollars, without inflation adjustment or currency conversion. The source publishes million USD; Fiscal.ge converts those exact values to USD. Exports use FOB valuation at the exporting border. Imports use CIF valuation, including transport and insurance to the importing border.",
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

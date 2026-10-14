import type { MethodologyContent } from "../../types";

export const TRADE_METHODOLOGY_CONTENT: MethodologyContent = {
  "id": "trade",
  "slug": "trade",
  "title": "External trade in goods and services",
  "summary": "Georgia’s annual goods trade and separately reviewed services trade in nominal USD.",
  "reviewedAt": "2026-10-14",
  "archiveManifestId": "trade",
  "coverageSource": {
    "kind": "archive"
  },
  "canonicalDocuments": [
    "docs/data-methodology/trade-annual.md"
  ],
  "disclosure": "Goods pages and Services trade use separately reviewed annual subsets. Services covers national totals and twelve types for 2020–2024; services countries and partial-year data remain excluded.",
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
        "Annual national totals, individual partner countries, five published country groups and four-digit products are covered. Total exports include re-exports. Domestic exports and supported national/country re-export comparisons are included; regional comparisons are excluded. A separate Services trade page covers national totals and twelve types for 2020–2024; services countries are deferred. The incomplete 2026 column is not served."
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
      "title": "Goods values and comparability",
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
      "id": "domestic-validation",
      "kind": "validation",
      "title": "How are domestic exports checked?",
      "paragraphs": [
        "Domestic exports add two originals checked against exact source cells, units, year headers, identities and national reconciliations. Re-exports require reviewed matching inputs and must reproduce the archived research calculations. This goods subset does not resolve or accept the two services discrepancies."
      ]
    },
    {
      "id": "domestic-exports",
      "kind": "classification",
      "title": "Domestic exports and re-exports",
      "paragraphs": [
        "The Domestic exports page compares total exports, domestic exports and calculated re-exports nationally for 2014–2025. Country comparisons show domestic exports and supported re-exports for the same years. All are goods exports in nominal USD on an FOB basis. Domestic exports include goods originating in Georgia and imported goods substantially processed here; they do not measure domestic value added.",
        "Re-exports equal total exports minus domestic exports only where identities and years have a reviewed match. The historical Macedonia (FYR) entry has no reviewed total-export counterpart, so its re-export figures remain unavailable. Missing figures stay gaps, dashes and blank workbook cells; source decimal differences are preserved.",
        "The product view covers 2020–2025 and retains 99 source-published products plus Other commodities. Omitted products are not zero, the remainder is not allocated, and no product re-exports are inferred. Shares use the matching national domestic-export total. Excel includes the entire selected comparison and its applicable originals."
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
      "id": "services",
      "kind": "classification",
      "title": "Services trade: national totals and types",
      "sourceLinks": [{ "href": "https://www.geostat.ge/en/modules/categories/766/international-trade-in-services", "label": "Geostat services trade source page" }],
      "paragraphs": [
        "Services trade covers annual transactions between Georgian residents and non-residents for 2020–2024. Exports are supplied by residents to non-residents; imports are received by residents from non-residents. Goods FOB/CIF valuation, domestic exports and re-exports do not apply to these series. Amounts are nominal USD: exact source decimals in thousand USD are converted to USD without inflation adjustment or currency conversion.",
        "Overview shows total services trade, exports, imports and balance; Service types retains all twelve published categories and the national services total. Travel keeps its complete published meaning; Telecommunications, computer, and information services is not an IT-only estimate. n.i.e. means “not included elsewhere”. Type shares use the matching same-year national services total; Balance has no share.",
        "Total services trade = exports + imports; services balance = exports − imports. Each calculation requires two numerical source counterparts for the same type and year. A positive balance means exports exceed imports. The published dash for maintenance and repair exports in 2020 remains unavailable, as do its turnover and balance. Neither the alternative joint table’s zero nor NBG’s rounded 0.0 replaces it. Other published zero and negative values are preserved. Missing workbook amounts remain blank; observed basis is actual and publication status unspecified.",
        "The separately accepted subset contains 13 identities, 130 original observations (129 numerical and one dash) and 128 numerical derivations: 258 facts. Checks verify both originals’ byte sizes and SHA-256, every selected cell, year header, identity, unit, role, format, exact decimal and source reference. The twelve types’ numerical sums reconcile against national exports and imports within USD 1.",
        "Services country comparisons are deferred: the two UK country-to-type-country import discrepancies for 2022 and 2024 remain unresolved. Accepting national and type figures does not accept the wider research package. Current account uses its separate NBG source and release vintage; its longer history is not used to backfill this page."
      ]
    },
    {
      "id": "composition",
      "kind": "classification",
      "title": "Trade composition: SITC and BEC",
      "paragraphs": [
        "Trade composition covers goods exports and imports for 2000–2025: ten SITC (Standard International Trade Classification) sections and seven published BEC (Broad Economic Categories) categories. In source labels, n.e.s. means ‘not elsewhere specified’. BEC is not a pure three-way capital/intermediate/consumer split. Capital goods includes its stated parts and accessories; transport equipment is separate.",
        "Amounts are nominal USD. Exports include re-exports and use FOB valuation; imports use CIF. End-year category shares use the matching same-year national exports or imports. A missing or zero denominator yields no share. Missing amounts stay gaps, dashes and blank workbook cells; published zero and negative values retain their meaning.",
        "The accepted subset has 17 identities and 884 original category observations (520 SITC and 364 BEC). Its 104 classification totals are validation controls, not selectable series. Four originals, exact source cells, years, codes, units and decimals are verified; category sums reconcile to classification totals and totals to national amounts within USD 1. Exact thousand-USD conversion uses Decimal precision 50. The private mirror preserves provenance and exact values through the parity-checked import.",
        "The first release offers Exports and Imports in USD only. Excel includes all committed series and selected years with applicable native originals, and omits percentage, publication-status and internal metadata columns. The two UK services discrepancies and wider research package remain unresolved; no country-by-product join or additional measure is accepted."
      ]
    },
    {
      "id": "archive",
      "kind": "archive",
      "title": "Original sources",
      "paragraphs": [
        "Twenty-two frozen Geostat originals are available: the national workbook, four partner-country/group workbooks, six product workbooks, two domestic-export workbooks, two services type workbooks, four SITC/BEC workbooks, services metadata PDF, brief merchandise-trade methodology and external-trade metadata page, retrieved on 7 October 2026. HTML captures download as plain-text attachments. Excel includes the chosen measure, every selected year and all committed series, beyond the visible table page. Products downloads are limited to 2020 onward and follow the selected date range. Product codes, actual basis, unspecified publication status and applicable original-source links are retained. Missing amounts stay blank. Public workbooks do not expose internal cell metadata."
      ]
    }
  ],
  "decisions": [
    {
      "id": "trade.scope",
      "group": "trade",
      "title": "Which trade is covered?",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Annual national totals, individual partner countries, five published country groups and four-digit products are covered. Total exports include re-exports. Domestic exports and supported national/country re-export comparisons are included; regional comparisons are excluded. A separate Services trade page covers national totals and twelve types for 2020–2024; services countries are deferred. The incomplete 2026 column is not served.",
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
      "title": "Goods values and comparability",
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

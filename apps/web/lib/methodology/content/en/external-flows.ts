import type { MethodologyContent } from "../../types";

export const EXTERNAL_FLOWS_METHODOLOGY_CONTENT: MethodologyContent = {
  "id": "external-flows",
  "slug": "external-flows",
  "title": "Money from abroad",
  "summary": "Money transfers into and out of Georgia by country, and NBG's estimate of personal transfers, annually in nominal USD.",
  "reviewedAt": "2026-10-10",
  "archiveManifestId": "external-flows",
  "coverageSource": {
    "kind": "archive"
  },
  "canonicalDocuments": [
    "docs/data-methodology/external-flows-annual.md"
  ],
  "disclosure": "The page uses a reviewed annual subset of the external-flows research package: money transfers by country and the balance-of-payments personal transfers. Monthly data, 2026, foreign direct investment and the current account are outside this page.",
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
      "value": "Actual; past years may be revised"
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
      "title": "What does the page cover?",
      "paragraphs": [
        "NBG's money transfers through fast transfer systems, 2000–2025: total inflow and outflow and every published country. Each annual value is the sum of the published months. Personal transfers from the balance of payments (credit and debit) are added alongside. Monthly data, 2026 months, transfers by system, foreign direct investment and the current account are excluded."
      ]
    },
    {
      "id": "transfers",
      "kind": "classification",
      "title": "Transfers are not the official remittance figure",
      "paragraphs": [
        "Money transfers cover all money sent through fast transfer systems (Western Union, MoneyGram, Zolotaia Korona and others) as reported by commercial banks and microfinance organizations. They include transfers by non-residents, which explains the rise in transfers from Russia in 2022.",
        "Personal transfers are a balance-of-payments (BPM6) estimate built mainly from household-survey data, with bank reports as a supplement. They are the official measure of money sent home. The page shows both and never subtracts or adds one to the other."
      ]
    },
    {
      "id": "countries",
      "kind": "classification",
      "title": "What does country mean?",
      "paragraphs": [
        "Country means the country a transfer came from or went to, not the sender's citizenship. NBG spells country names differently across its period sheets; a reviewed mapping joins 28 such labels into one identity. Remainders (Other countries, Areas not elsewhere specified, Other territories) stay separate series and appear last in the ranking, unranked. Ranking shares divide by that year's all-country total for the same direction."
      ]
    },
    {
      "id": "coverage",
      "kind": "limitations",
      "title": "Coverage limits",
      "paragraphs": [
        "For 2000–2007 NBG publishes 18 major countries plus Other countries; full country lists start in 2008. Earlier values for other countries are missing and are not filled with zero.",
        "In 2019 some months are blank in the source for about 70 smaller countries, mostly February alone. Their 2019 value is the sum of the published months: 11 in most cases, 5 to 9 in a few. It is marked as partial in the chart and the table, and the ranking and Excel show the number of months.",
        "From January 2010 the data include microfinance organizations. The break is marked on the chart and is not adjusted."
      ]
    },
    {
      "id": "revisions",
      "kind": "limitations",
      "title": "Vintages and revisions",
      "paragraphs": [
        "The money-transfer table is the 15 September 2026 release and the balance of payments the 30 September 2026 release. NBG revises past years regularly, so figures quoted from earlier releases can differ."
      ]
    },
    {
      "id": "validation",
      "kind": "validation",
      "title": "How are the figures checked?",
      "paragraphs": [
        "The accepted subset holds 9,312 money-transfer observations (14 blank and 140 partial-month values) and 52 personal-transfer observations. Preparation checks the research package's file fingerprints and its independent verification, compares each year's countries with the total, and rejects an omitted year, a duplicate, a blank turned into zero and a partial-month value without its month count."
      ]
    },
    {
      "id": "archive",
      "kind": "archive",
      "title": "Original sources",
      "paragraphs": [
        "Three unedited NBG files retrieved on 10 October 2026 are available: money transfers by country, the balance of payments (BPM6) and the external-sector statistics methodology. Excel follows the chosen direction, years and all selected series."
      ]
    }
  ],
  "decisions": [
    {
      "id": "external.scope",
      "group": "external",
      "title": "What does the page cover?",
      "statusLabel": "Fiscal.ge decision",
      "summary": "NBG's money transfers through fast transfer systems, 2000–2025: total inflow and outflow and every published country. Each annual value is the sum of the published months. Personal transfers from the balance of payments (credit and debit) are added alongside. Monthly data, 2026 months, transfers by system, foreign direct investment and the current account are excluded.",
      "detail": [],
      "canonicalDecisionIds": [
        "external.scope"
      ]
    },
    {
      "id": "external.transfers_not_remittances",
      "group": "external",
      "title": "Transfers are not the official remittance figure",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Money transfers cover all money sent through fast transfer systems (Western Union, MoneyGram, Zolotaia Korona and others) as reported by commercial banks and microfinance organizations. They include transfers by non-residents, which explains the rise in transfers from Russia in 2022. Personal transfers are a balance-of-payments (BPM6) estimate built mainly from household-survey data, with bank reports as a supplement. They are the official measure of money sent home. The page shows both and never subtracts or adds one to the other.",
      "detail": [],
      "canonicalDecisionIds": [
        "external.transfers_not_remittances"
      ]
    },
    {
      "id": "external.coverage",
      "group": "external",
      "title": "Coverage limits",
      "statusLabel": "Fiscal.ge decision",
      "summary": "For 2000–2007 NBG publishes 18 major countries plus Other countries; full country lists start in 2008. Earlier values for other countries are missing and are not filled with zero. In 2019 some months are blank in the source for about 70 smaller countries, mostly February alone. Their 2019 value is the sum of the published months: 11 in most cases, 5 to 9 in a few. It is marked as partial in the chart and the table, and the ranking and Excel show the number of months. From January 2010 the data include microfinance organizations. The break is marked on the chart and is not adjusted.",
      "detail": [],
      "canonicalDecisionIds": [
        "external.coverage"
      ]
    }
  ],
  "technicalAppendix": [],
  "showTechnicalAppendix": false
};

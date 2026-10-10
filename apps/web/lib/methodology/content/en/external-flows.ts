import type { MethodologyContent } from "../../types";

export const EXTERNAL_FLOWS_METHODOLOGY_CONTENT: MethodologyContent = {
  "id": "external-flows",
  "slug": "external-flows",
  "title": "External flows",
  "summary": "Money transfers and foreign direct investment, Georgia, annually in nominal USD.",
  "reviewedAt": "2026-10-10",
  "archiveManifestId": "external-flows",
  "coverageSource": {
    "kind": "archive"
  },
  "canonicalDocuments": [
    "docs/data-methodology/external-flows-annual.md"
  ],
  "disclosure": "The External flows pages use reviewed annual subsets of the external-flows research package: money transfers by country with the balance-of-payments personal transfers (Money from abroad), and Geostat's foreign direct investment by country, sector and region (Foreign investment). Monthly and quarterly data, 2026 and the current account are outside these pages.",
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
        "NBG's money transfers through fast transfer systems, 2000–2025: total inflow and outflow and every published country. Each annual value is the sum of the published months. Personal transfers from the balance of payments (credit and debit) are added alongside. Monthly data, 2026 months, transfers by system, foreign direct investment and the current account are excluded.",
        "Foreign investment shows Geostat's annual foreign direct investment into Georgia: the total for 1996–2025, by country for 1996–2025, by economic sector (NACE Rev.2 sections) for 2016–2025 and by region for 2009–2025. The investment stock, the split into equity, reinvested earnings and debt, and NBG's balance-of-payments direct-investment lines are not on the page."
      ]
    },
    {
      "id": "transfers",
      "kind": "classification",
      "title": "Transfers are not the official remittance figure",
      "paragraphs": [
        "Money transfers cover all money sent through fast transfer systems (Western Union, MoneyGram, Zolotaia Korona and others) as reported by commercial banks and microfinance organizations. They include transfers by non-residents, which explains the rise in transfers from Russia in 2022.",
        "Personal transfers are a balance-of-payments (BPM6) estimate built mainly from household-survey data, with bank reports as a supplement. They are the official measure of money sent home. The page shows money transfers only, not this estimate."
      ]
    },
    {
      "id": "countries",
      "kind": "classification",
      "title": "What does country mean?",
      "paragraphs": [
        "Country means the country a transfer came from or went to, not the sender's citizenship. NBG spells country names differently across its period sheets; a reviewed mapping joins 28 such labels into one identity. The page lists the end year's top 10 countries and one Other countries series: the all-country total less those ten, which also holds the remainders (Other countries, Areas not elsewhere specified, Other territories). It appears last in the ranking, unranked. Ranking shares divide by that year's all-country total for the same direction."
      ]
    },
    {
      "id": "coverage",
      "kind": "limitations",
      "title": "Coverage limits",
      "paragraphs": [
        "For 2000–2007 NBG publishes 18 major countries plus Other countries; full country lists start in 2008. Earlier values for other countries are missing and are not filled with zero.",
        "In 2019 some months are blank in the source for about 70 smaller countries, mostly February alone. Their 2019 value is the sum of the published months: 11 in most cases, 5 to 9 in a few. It is marked as partial in the chart and the table, and the ranking and Excel show the number of months.",
        "From January 2010 the data include microfinance organizations. The values are not adjusted for this change."
      ]
    },
    {
      "id": "revisions",
      "kind": "limitations",
      "title": "Vintages and revisions",
      "paragraphs": [
        "The money-transfer table is the 15 September 2026 release and the balance of payments the 30 September 2026 release. NBG revises past years regularly, so figures quoted from earlier releases can differ.",
        "Geostat's annual FDI tables are the 17 August 2026 release and the quarterly totals the 8 September 2026 release. Geostat's annual release may adjust the previous five years."
      ]
    },
    {
      "id": "validation",
      "kind": "validation",
      "title": "How are the figures checked?",
      "paragraphs": [
        "The accepted subset holds 9,312 money-transfer observations (14 blank and 140 partial-month values) and 52 personal-transfer observations. Preparation checks the research package's file fingerprints and its independent verification, compares each year's countries with the total, and rejects an omitted year, a duplicate, a blank turned into zero and a partial-month value without its month count.",
        "Foreign investment holds 2,707 observations. Preparation checks the same fingerprints and independent verification, requires every year of every country, sector and region, and checks that each breakdown adds up to Geostat's annual total within the package's recorded rounding tolerance (regions from 2016). Geostat's '-' stays missing and is never turned into zero."
      ]
    },
    {
      "id": "fdi-sources",
      "kind": "classification",
      "title": "Geostat's and NBG's investment figures",
      "paragraphs": [
        "Foreign direct investment is investment by a foreign investor who holds 10% or more of the shares or voting rights in an enterprise in Georgia, together with every later transaction between the two, such as reinvested earnings and loans.",
        "Geostat compiles foreign direct investment from its survey of enterprises, with NBG data on financial corporations and ministry privatization data. NBG's balance of payments shows direct investment on the BPM6 asset and liability basis. The two totals differ every year, by up to USD 192.6 million in 2023. Foreign investment uses Geostat's figure only and never mixes the two."
      ]
    },
    {
      "id": "fdi-breakdowns",
      "kind": "classification",
      "title": "Countries, sectors and regions",
      "paragraphs": [
        "Country means the direct investor's country, not the ultimate owner's, so holding locations such as Malta or the Netherlands can rank high. The country tab lists the end year's top 10 countries and one Other countries series: the total less those ten, which also holds Unknown, International organizations and Geostat's remainder.",
        "Geostat allocates investment by enterprises' actual addresses and assigns the whole financial sector to Tbilisi. Guria, Samegrelo-Zemo Svaneti, Imereti, Racha-Lechkhumi and Kvemo Svaneti, Shida Kartli and Mtskheta-Mtianeti are published separately only from 2016; their earlier years are missing, so regions do not add up to the total before 2016.",
        "Values can be negative when investors withdraw capital, make losses or repay loans. Negative values are kept, drawn below zero and shown with their sign in the ranking."
      ]
    },
    {
      "id": "archive",
      "kind": "archive",
      "title": "Original sources",
      "paragraphs": [
        "Three unedited NBG files retrieved on 10 October 2026 are available: money transfers by country, the balance of payments (BPM6) and the external-sector statistics methodology. Five Geostat files retrieved the same day cover foreign direct investment: the quarterly totals, the country, sector and region tables and Geostat's metadata. Excel follows the chosen direction or breakdown, years and all selected series."
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
      "summary": "Money transfers cover all money sent through fast transfer systems (Western Union, MoneyGram, Zolotaia Korona and others) as reported by commercial banks and microfinance organizations. They include transfers by non-residents, which explains the rise in transfers from Russia in 2022. Personal transfers are a balance-of-payments (BPM6) estimate built mainly from household-survey data, with bank reports as a supplement. They are the official measure of money sent home. The page shows money transfers only, not this estimate.",
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
      "summary": "For 2000–2007 NBG publishes 18 major countries plus Other countries; full country lists start in 2008. Earlier values for other countries are missing and are not filled with zero. In 2019 some months are blank in the source for about 70 smaller countries, mostly February alone. Their 2019 value is the sum of the published months: 11 in most cases, 5 to 9 in a few. It is marked as partial in the chart and the table, and the ranking and Excel show the number of months. From January 2010 the data include microfinance organizations. The values are not adjusted for this change.",
      "detail": [],
      "canonicalDecisionIds": [
        "external.coverage"
      ]
    }
  ],
  "technicalAppendix": [],
  "showTechnicalAppendix": false
};

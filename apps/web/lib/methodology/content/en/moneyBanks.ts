import type { MethodologyContent } from "../../types";

export const MONEY_BANKS_METHODOLOGY_CONTENT: MethodologyContent = {
  "id": "money",
  "slug": "money",
  "title": "Money and banks",
  "summary": "Georgia’s money supply, bank loans and deposits in lari and foreign currency, interest rates and bank-health measures, year by year, from National Bank of Georgia data.",
  "reviewedAt": "2026-10-11",
  "archiveManifestId": "money",
  "coverageSource": {
    "kind": "archive"
  },
  "canonicalDocuments": [
    "docs/data-methodology/money-banks-annual.md"
  ],
  "disclosure": "Each year shows one value. Exchange rates, monthly and quarterly figures and 2026 are outside these pages.",
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
      "label": "Basis",
      "valueKind": "basis",
      "value": "Actual"
    },
    {
      "label": "Units",
      "valueKind": "unit",
      "value": "million GEL; %"
    }
  ],
  "sections": [
    {
      "id": "scope",
      "kind": "scope",
      "title": "What do the pages cover?",
      "paragraphs": [
        "Annual figures from the National Bank of Georgia, on four pages. Money supply: broad money (M3), broad money in lari (M2), narrow money (M1) and cash outside banks (M0) since 1995, and all four as a percentage of GDP since 1996. Loans and deposits: bank loans since 2002 and deposits since 1996, each in total, in lari and in foreign currency; deposits of people since 2002 and of companies and organisations since 2015; and the share of loans and of deposits held in foreign currency. Interest rates: the National Bank rate since 2008 and the average rates on loans and on deposits since 1996, in total, in lari and in foreign currency. Bank health: bad loans as a share of all loans since 2003, return on assets and on equity since 2001, and the two capital ratios since 2014. Exchange rates, monthly and quarterly figures, 2026, and breakdowns by sector, region or maturity are not shown."
      ]
    },
    {
      "id": "sources",
      "kind": "sources",
      "title": "Where do the figures come from?",
      "paragraphs": [
        "All figures come from ten workbooks on the National Bank of Georgia’s statistics page: money aggregates and monetary ratios (M2.1), bank loans (L3.5), deposits by type (D3.17), deposits of individuals (D3.23) and of legal entities (D3.27), the monetary policy rate (MPR), the annual weighted average interest rates on loans (LWIR) and on deposits (DWIR), and the Financial Soundness Indicators (FSI) in an archive file and a current file. The percentage of GDP also uses Georgia’s gross domestic product at current prices from the National Statistics Office of Georgia (Geostat), the same GDP as on the budget and debt pages, described on the GDP methodology page. NBG compiles the tables from the monthly reports of all resident banks, both domestically and foreign-controlled; the money aggregates also cover the National Bank itself. NBG notes that its data were updated to include microbanks from January 2025. NBG converts foreign-currency amounts into lari at the official exchange rate at the end of each month; the pages show these lari amounts and no exchange rate."
      ]
    },
    {
      "id": "years",
      "kind": "classification",
      "title": "End of year and average rates",
      "paragraphs": [
        "Each year shows one value. Amounts, the comparisons with GDP, the foreign-currency shares and the bank-health measures show the position at the end of the year: the December value, or, for bank-health values taken from NBG’s quarterly archive file (2001–2021), the fourth-quarter value. The National Bank rate is the rate in force on 31 December, set by the last change that took effect on or before that day. The loan and deposit rates are what NBG publishes as annual weighted average interest rates: the yearly contractual rate of each loan or deposit, weighted by its amount, for the amounts outstanding at the end of the year. NBG leaves out loans and deposits with a zero rate, as well as loans and deposits between banks."
      ]
    },
    {
      "id": "aggregates",
      "kind": "classification",
      "title": "Money aggregates M0–M3",
      "paragraphs": [
        "NBG defines the aggregates as follows. Cash outside banks (M0) is currency in circulation, excluding cash in commercial banks’ vaults. Narrow money (M1) is M0 plus transferable deposits in lari of the resident non-financial sector and households, excluding deposits of the banking and government sectors. Broad money in lari (M2) is M1 plus term and savings deposits in lari of the resident non-financial sector, other financial corporations and households with commercial banks. Broad money (M3) is M2 plus the foreign-currency deposits of the same resident sectors. Deposit amounts include accrued interest. The % of GDP view divides each December amount by Fiscal.ge’s national GDP at current prices for the same year (the same GDP as on the budget and debt pages) and multiplies by 100; Fiscal.ge calculates these values and marks them as calculated. GDP for the latest year can be preliminary, and the page says so. NBG also publishes its own monetization coefficients for M3 and M2, which it describes as the inverse of the velocity of money. These coefficients rest on an earlier GDP estimate. Up to 2009 they match the values shown here; from 2010 they differ slightly, by 0.4 to 1.1 percentage points for M3 (for example 56.0% against 55.1% in 2025). The pages do not show NBG’s coefficients."
      ]
    },
    {
      "id": "loans-deposits",
      "kind": "classification",
      "title": "Loans, deposits and the foreign-currency share",
      "paragraphs": [
        "Loans (table L3.5) are loans granted by resident banks to all sectors and to non-residents, excluding loans to other banks: the amount outstanding at the end of the period, including overdue loans and accrued interest. Deposits (table D3.17) are all types of deposits placed by all sectors and non-residents, including other banks and the government. Deposits of people (table D3.23) are those of individuals and individual entrepreneurs, and deposits of companies and organisations (table D3.27) are those of legal entities, including other banks and the government; the latter table starts in November 2015.",
        "NBG publishes each deposit table as one sheet in lari and one in foreign currency. Fiscal.ge adds the two to get all deposits, deposits of people and deposits of companies and organisations, and marks these three totals as calculated. From 2015, deposits of people and of companies and organisations add up to all deposits. The share in foreign currency is the foreign-currency amount divided by the total amount, times 100: for loans from table L3.5 and for deposits from table D3.17. Fiscal.ge calculates it and marks it as calculated, so the share always agrees with the amounts shown on the page.",
        "NBG also publishes its own dollarization ratio of non-bank deposits: foreign-currency non-bank deposits placed with commercial banks, divided by all non-bank deposits. That ratio leaves out deposits of banks, which table D3.17 includes, so the two measure different sets of deposits: at the end of 2025 NBG’s ratio was 47.7% and the share shown on these pages 48.6%."
      ]
    },
    {
      "id": "rates",
      "kind": "classification",
      "title": "Interest rates",
      "paragraphs": [
        "The National Bank rate is NBG’s monetary policy rate (file MPR). NBG notes that until 20 August 2008 the 7-day certificate-of-deposit rate was used as the monetary policy rate, and that since then the 7-day refinancing instrument has been used for monetary policy operations. The file starts in January 2008, so the series starts in 2008; the 2008 value, 8%, in force from 25 December 2008, dates from after the change. The average rates on loans and on deposits are NBG’s annual weighted average interest rates (files LWIR and DWIR), in total, in lari and in foreign currency."
      ]
    },
    {
      "id": "bank-health",
      "kind": "classification",
      "title": "Bank-health measures",
      "paragraphs": [
        "The bank-health page uses NBG’s Financial Soundness Indicators for deposit takers, which cover resident banks and follow the International Monetary Fund’s (IMF) methodology. Values for 2001–2021 are fourth-quarter values from NBG’s archive file, and values for 2022–2025 are December values from the current file.",
        "Bad loans are NBG’s non-performing loans to total gross loans by the IMF methodology. NBG’s archive file describes non-performing loans as loans whose payments of principal and interest are past due by 90 days or more, and counts loans to other banks both in non-performing loans and in the total. The archive file’s second series, by NBG’s own methodology, is not shown. Return on assets is banks’ net income as a percentage of their assets, and return on equity is net income as a percentage of their capital; both can be negative, as in 2008. The capital ratio is regulatory capital divided by risk-weighted assets, and the Tier 1 ratio is Tier 1 capital, the primary source of regulatory capital, divided by risk-weighted assets. Both use the Basel III series, which starts in 2014; the archive file’s older Basel I series is not shown."
      ]
    },
    {
      "id": "breaks",
      "kind": "limitations",
      "title": "Two changes in the bank-health data",
      "paragraphs": [
        "Values to 2021 come from NBG’s archive file, which notes that it is calculated according to the IMF methodology, and values from 2022 from the current file, which notes that it follows the 2019 FSI methodology. For 2022 the two files give the same capital ratio (20.3%), Tier 1 ratio (17.1%) and return on assets (3.8%), but different values for bad loans (1.7% in the archive file, 1.5% in the current file) and return on equity (30.2% against 24.8%). Neither file explains the difference.",
        "Separately, the current file notes that, due to the implementation of IFRS, its data were reviewed from January 2023. In that file bad loans move from 1.5% in December 2022 to 3.1% in January 2023. The note covers the whole file, so this break is recorded for all five bank-health measures.",
        "Each measure is drawn as one line. Both breaks are recorded with the data, Fiscal.ge computes no change across them, and the pages describe the figures without explaining their causes."
      ]
    },
    {
      "id": "validation",
      "kind": "validation",
      "title": "How are the figures checked?",
      "paragraphs": [
        "730 values are served. Each is re-read from its cell in NBG’s original workbook, and the original files are checked against their recorded fingerprints. The checks require lari plus foreign currency to equal total loans every year (total deposits are that sum by construction), deposits of people and of companies and organisations to add up to all deposits from 2015, M0 ≤ M1 ≤ M2 ≤ M3 every year, and every percent to lie within 0–100 except return on assets and on equity. They also require the 2022 values of the two bank-health files to agree and differ as described above, and the 2025 values to match what NBG shows: broad money 57,680.2 million GEL, loans 72,453.0 million GEL, the National Bank rate 8.00% and bad loans 2.5%. Pages show percents to one decimal, the National Bank rate to two, and amounts in the site’s usual lari format."
      ]
    },
    {
      "id": "archive",
      "kind": "archive",
      "title": "Original sources",
      "paragraphs": [
        "Twenty NBG originals retrieved on 11 October 2026 are available: the ten workbooks, NBG’s four methodology notes on monetary statistics, loans, deposits and interest rates, the five file lists from NBG’s statistics service that the workbook links came from, and the statistics page. The HTML page downloads as a text file. Excel follows the chosen view, series and years, and lists the workbooks behind them; on % of GDP it also lists Geostat’s GDP files."
      ]
    }
  ],
  "decisions": [
    {
      "id": "money.scope",
      "group": "money",
      "title": "What do the pages cover?",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Annual figures from the National Bank of Georgia, on four pages. Money supply: broad money (M3), broad money in lari (M2), narrow money (M1) and cash outside banks (M0) since 1995, and all four as a percentage of GDP since 1996. Loans and deposits: bank loans since 2002 and deposits since 1996, each in total, in lari and in foreign currency; deposits of people since 2002 and of companies and organisations since 2015; and the share of loans and of deposits held in foreign currency. Interest rates: the National Bank rate since 2008 and the average rates on loans and on deposits since 1996, in total, in lari and in foreign currency. Bank health: bad loans as a share of all loans since 2003, return on assets and on equity since 2001, and the two capital ratios since 2014. Exchange rates, monthly and quarterly figures, 2026, and breakdowns by sector, region or maturity are not shown.",
      "detail": [],
      "canonicalDecisionIds": [
        "money.scope"
      ]
    },
    {
      "id": "money.year_values",
      "group": "money",
      "title": "End of year and average rates",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Each year shows one value. Amounts, the comparisons with GDP, the foreign-currency shares and the bank-health measures show the position at the end of the year: the December value, or, for bank-health values taken from NBG’s quarterly archive file (2001–2021), the fourth-quarter value. The National Bank rate is the rate in force on 31 December, set by the last change that took effect on or before that day. The loan and deposit rates are what NBG publishes as annual weighted average interest rates: the yearly contractual rate of each loan or deposit, weighted by its amount, for the amounts outstanding at the end of the year. NBG leaves out loans and deposits with a zero rate, as well as loans and deposits between banks.",
      "detail": [],
      "canonicalDecisionIds": [
        "money.year_values"
      ]
    },
    {
      "id": "money.calculated",
      "group": "money",
      "title": "Calculated values",
      "statusLabel": "Fiscal.ge decision",
      "summary": "Fiscal.ge calculates only these values: all deposits, deposits of people and deposits of companies and organisations (lari plus foreign currency); the share of loans and of deposits in foreign currency (the foreign-currency amount divided by the total, times 100); and M3, M2, M1 and M0 as a percentage of GDP (the December amount divided by Fiscal.ge’s national GDP at current prices, times 100). They are marked as calculated in Excel. Nothing else is interpolated, rebased or computed.",
      "detail": [],
      "canonicalDecisionIds": [
        "money.calculated"
      ]
    },
    {
      "id": "money.bank_health_breaks",
      "group": "money",
      "title": "Two changes in the bank-health data",
      "statusLabel": "Limitation",
      "summary": "Values to 2021 come from NBG’s archive file, which notes that it is calculated according to the IMF methodology, and values from 2022 from the current file, which notes that it follows the 2019 FSI methodology. For 2022 the two files give the same capital ratio (20.3%), Tier 1 ratio (17.1%) and return on assets (3.8%), but different values for bad loans (1.7% in the archive file, 1.5% in the current file) and return on equity (30.2% against 24.8%). Neither file explains the difference. Separately, the current file notes that, due to the implementation of IFRS, its data were reviewed from January 2023. In that file bad loans move from 1.5% in December 2022 to 3.1% in January 2023. The note covers the whole file, so this break is recorded for all five bank-health measures.",
      "detail": [],
      "canonicalDecisionIds": [
        "money.bank_health_breaks"
      ]
    }
  ],
  "technicalAppendix": [],
  "showTechnicalAppendix": false
};

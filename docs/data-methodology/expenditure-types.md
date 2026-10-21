# Spending by type (general government, economic classification), 2002–2025

Status: reviewed annual Ministry of Finance data, published at `/explorer/expenditure-types`.

## Public meaning

How much general government spends on each economic type of spending: compensation of employees, use of goods and services, interest, subsidies, grants, social benefits, other expense, and net acquisition of nonfinancial assets (investment). Total spending (GFS `2M`) = expense (`2`) + net acquisition of nonfinancial assets (`31`).

General government here is the state budget, the autonomous republics of Adjara and Abkhazia and the municipalities, consolidated (transfers between them are counted once).

## Source

Ministry of Finance, GFS data › General Government Operations, `general20022025.xlsx` (GFSM 2001 layout), sheet `Sheet4`, "TABLE 2A: Statement of Government Operations", million GEL, one decimal. Archived with its size and SHA-256 in `docs/Raw Data/Budget/expenditure-types/source-manifest.json`; source id `source.mof_gfs_general_government_2002_2025`.

| Series id | GFS code | Source row |
| --- | --- | --- |
| `spending_type.total` | 2M | Memorandum item: Total expenditure [2+31] |
| `spending_type.expense` | 2 | Expense |
| `spending_type.compensation` | 21 | Compensation of employees |
| `spending_type.goods_services` | 22 | Use of goods and services |
| `spending_type.interest` | 24 | Interest |
| `spending_type.subsidies` | 25 | Subsidies |
| `spending_type.grants` | 26 | Grants |
| `spending_type.social_benefits` | 27 | Social benefits |
| `spending_type.other` | 28 | Other expense |
| `spending_type.investment` | 31 | Net acquisition of nonfinancial assets |

Code 23 (consumption of fixed capital) is zero in every year and is not served.

## Why this file and not the GFSM 2014 file

The Ministry also publishes `ENGGAGFSM2014.xlsx` (GFSM 2014, 1995–2025). From 2013 it counts more public bodies: legal entities of public law with their own income, such as universities and agencies. Its 2025 total spending is 33,121.7 million GEL against 29,743.8 here, and the gap sits almost entirely in other revenue, wages and goods and services. Taxes are nearly equal in both files.

This file is used because:

- its tax revenue equals the site's Revenue page in every year 2008–2025. In 2004–2007 the two differ only by the old social tax, which GFS records as social contributions, not taxes;
- its 2025 lines equal Appendix 1.3 "General Government" of the Ministry's 2027 budget tables. The GFSM 2014 file is close to Appendix 1.7 "General Government Plus LEPL and Other Public NPI" instead.

## Relation to other pages

- **Spending page** (`/explorer/expenditure`): that page shows state-budget payments by purpose. It includes debt repayment and lending and leaves out the municipalities, so its total differs.
- **Deficit page** (`/explorer/deficit`): this file's net lending/borrowing (−1,275.3 million GEL in 2025) is not served. The Deficit page keeps the IMF figure, so the site shows one balance per year.

## Calculations

- Each cell's XML text is read and rounded to the file's one decimal. A cell that carries real extra precision fails. The amount is million GEL × 1,000,000 in decimal arithmetic.
- Share of GDP = amount ÷ same-year GDP (`data/imports/national-gdp-annual-1996-2025.csv`) × 100. A share is marked preliminary when that year's GDP is preliminary (2025). The amounts themselves are not marked preliminary. The Ministry may still revise past years.
- Real zeros (grants 2002–2004, other expense 2002–2003) are served as 0.

## Checks

The preparation fails unless every one of these holds:

- the file's size and hash, its sheet name, its titles, every row's code and label, and the year header 2002–2025 in columns C–Z are as reviewed;
- each year, 21 + 22 + 23 + 24 + 25 + 26 + 27 + 28 = 2 and 2 + 31 = 2M, within 0.05 million GEL (both hold exactly);
- code 23 is zero;
- every year has a GDP row;
- there is no missing, extra or duplicate observation.

The per-year identity differences are in `data/reports/expenditure-types-validation.json`.

## Reproduction

From `apps/web`:

```bash
npm run data:prepare-expenditure-types   # writes data/imports/expenditure-types-annual.csv and the report
npm run data:check-expenditure-types     # runs inside data:validate
```

For a refresh, download the new `general20022025.xlsx` (or its successor) from the Ministry page, archive it, update the manifest's hash, size, years and rows, and re-run the preparation.

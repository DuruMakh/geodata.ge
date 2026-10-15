# Gross external debt and official reserves (National Bank of Georgia)

Research package for the Fiscal.ge "Foreign debt" and "Reserves" pages. Approved design: `docs/superpowers/specs/2026-10-15-foreign-debt-reserves-design.md`. Everything here is reproducible from the files in `official/`, which are never edited.

## Sources

Both workbooks and the file listing were retrieved on 2026-10-15 (UTC, 10:48:01–10:48:05) from the National Bank of Georgia (NBG) statistics page, `https://nbg.gov.ge/en/statistics/statistics-data`. The page is rendered in the browser, so the file list comes from NBG's own API, `GET https://nbg.gov.ge/gw/api/ct/statistics/categories/24/data` (category 24 is the external sector), which returns `[]` unless the request carries the header `Accept-Language: en`. The listing is kept as `official/api-category-24.json`. Files are served from `https://nbg.gov.ge/fm/%E1%83%A1%E1%83%A2%E1%83%90%E1%83%A2%E1%83%98%E1%83%A1%E1%83%A2%E1%83%98%E1%83%99%E1%83%90/external_sector/eng/<file>` (the path segment is "statistika" in Georgian). Exact URLs, retrieval times, SHA-256 hashes and byte sizes are in `source-manifest.csv` and `source-manifest.json`. The two workbooks are byte-identical to the copies checked earlier the same day.

| Source ID | NBG code | Local file | Contents |
| --- | --- | --- | --- |
| `nbg_gross_external_debt_bpm6` | ED-6 | `official/edbpm6eng.xlsx` | Quarterly gross external debt position by sector, million USD, 2006-03-31 to 2026-06-30 (listing: updated 30/09/2026, next 30/12/2026). Sheet `ED-GEO-Tb1` |
| `nbg_official_reserve_assets` | OIR | `official/templatesection-ieng.xlsx` | Monthly gross international reserves, thousand USD, October 1995 to September 2026 (listing: updated 07/10/2026, next 06/11/2026). Sheet `GIR (eng) ` (the name ends in a space) |
| `nbg_api_category_24` | | `official/api-category-24.json` | The file listing the two workbook paths came from |

## Outputs

- `external-position-annual.csv`: the 254 served observations, one row per indicator and year, with columns `year,indicator_id,value,published_value,unit,period_end,basis,value_status,source_id,source_sheet,source_cell`. `value` is the exact decimal in million USD: for debt it is the number token stored in the cell; for reserves it is the stored token divided by 1000, computed exactly with Python's `decimal` (never a float). `published_value` is `value` rounded half-up to one decimal, using the value as Excel displays it (15 significant digits), so a cell stored just below a `.x5` boundary rounds as NBG's own display does. `unit` is always `usd_million`, `basis` always `actual`, `value_status` always `official`. `period_end` is `YYYY-12-31`, except `2026-06-30` (debt) and `2026-09-30` (reserves) for the 2026 rows. UTF-8 with BOM.
- `coverage.csv`: first and last year, the count and the latest period end for each indicator.
- `validation-report.json` (from `prepare.py`) and `independent-validation.json` (from `verify_independent.mjs`).
- `source-manifest.csv` and `source-manifest.json`.

## Cell map

`prepare.py` finds each debt row by the exact text in column A and each debt column by the date in row 3; it finds each reserves row by the date in column A and each reserves column by its printed heading. No cell is addressed by fixed position.

| Indicator ID | Source and sheet | Row label (column A, first match above "Memorandum Items") | Columns |
| --- | --- | --- | --- |
| `ext_debt.total` | ED-6 `ED-GEO-Tb1` (million USD, header row 3) | `Gross External Debt Position` | every 31 Dec from 2006 (2006–2025), plus the last column (2026-06-30) |
| `ext_debt.government` | same | `General Government` | same |
| `ext_debt.central_bank` | same | `Central Bank` | same |
| `ext_debt.banks` | same | `Deposit-Taking Corporations, except the Central Bank` | same |
| `ext_debt.companies` | same | `Other Sectors` | same |
| `ext_debt.intercompany` | same | `Direct Investment: Intercompany Lending` | same |

| Indicator ID | Source and sheet | Column heading | Rows |
| --- | --- | --- | --- |
| `reserves.total` | OIR `GIR (eng) ` (thousand USD; dates in column A from row 5) | row 3: "Official Reserve Assets" | every 31 Dec from 1995 (1995–2025), plus the last dated row (2026-09-30) |
| `reserves.fx` | same | row 4: "Foreign Currency Reserves" | same |
| `reserves.sdr` | same | row 4: "SDRs" | same |
| `reserves.gold` | same | row 4: "Gold" | same |

Layout notes, observed in the files of 2026-10-15:

- The debt labels repeat in the "Memorandum Items" block below the table (arrears and debt securities by sector); only the first match above that heading is used. The total row also differs from the sheet title ("Gross External Debt Position of Georgia by Sector"), which is not an exact match.
- Header dates in row 3 and the reserve dates in column A are Excel serial numbers. Debt columns are quarter ends; the last is 2026-06-30. Reserve rows are month ends; the last is 2026-09-30. Both files are in date order.
- In the reserves sheet "Foreign Currency Reserves" and "SDRs" sit in row 4 under "of which:"; the total is in row 3.

## Checks

`prepare.py` re-reads the original XML number token (through the worksheet reader shared with the unemployment and money packages, which parses cells with an XML parser and so handles empty self-closing cells) and rejects:

- a duplicate, missing or extra observation, or a year outside an indicator's coverage;
- a published value that is not the stored value rounded to one decimal, or a negative amount;
- any row not dated 31 December, other than the single latest point per workbook (2026-06-30 for debt, 2026-09-30 for reserves), and a latest point that is not the last period in the file;
- the five debt groups (government, central bank, banks, companies, intercompany lending) not adding up to the total within 0.05 million USD in any year (observed: below 1e-11);
- total reserves differing from foreign currency + gold + SDRs by more than 30 million USD in any year (observed range −2.5 to +13.1);
- the anchor values: gross external debt 27,046.9 million USD and general government 9,202.9 at the end of 2025, 28,166.2 at the end of June 2026; reserves 6,159.3 at the end of 2025, 196.2 at the end of 1995 and 8,166.9 at the end of September 2026;
- an API listing whose ED-6 and OIR entries do not point to the files in the manifest.

`verify_independent.mjs` re-reads both workbooks with SheetJS, not the Python XML reader. For every one of the 254 rows it checks the stored value (reserves divided by 1000), the rounding, the date of the row or column, the printed row label or column heading, and the period-end rule. It recomputes the debt-group and reserves-residual identities. Its negative controls must detect an altered debt value, an altered reserves value, a thousand-USD value left unconverted, an omitted row, a duplicated row, a shifted year, a neighbouring column (debt and reserves), a wrong period end, a wrong sheet and a mis-rounded published value.

Run them with:

```
python3 -B prepare.py --check && python3 -B -m unittest test_validation -v && node verify_independent.mjs
```

`python3 prepare.py` rebuilds the generated files. `node verify_independent.mjs` rewrites `independent-validation.json`. Treat the files in `official/` as data: nothing in them is executed.

## Notes

- **BPM6 only.** The ED-6 file (BPM6, from 2006) is the only debt series used. NBG's older BPM5 file (`edbpm5-eng.xlsx`, back to 1999) uses a different method, so combining them would put a break in the series; it is not archived or served.
- **Other Sectors** is made of two sub-sectors in the same table: "Other financial corporations" (35.7 million USD at the end of 2025) and "Nonfinancial corporations" (5,119.0), which together are the 5,154.7 shown. It is the sector outside government, the central bank and deposit-taking corporations. Its sub-sectors are not served separately.
- **Intercompany lending** (`Direct Investment: Intercompany Lending`) is debt between related companies, such as a foreign parent lending to its Georgian subsidiary. It has three lines: liabilities of direct investment enterprises to direct investors (all 2,452.9 million USD at the end of 2025), liabilities of direct investors to direct investment enterprises, and liabilities to fellow enterprises (both 0 at the end of 2025). It is a separate group in NBG's table, not part of "Other Sectors".
- **Two small reserve parts are left out.** The sheet also has "IMF Reserve Position" (about 0.03 million USD in recent years, 0.015 in 1995) and "Other Reserve Assets" (usually near zero but it can be negative: −2.6 million USD at the end of 2020, +13.1 at the end of 2022, −0.1 at the end of 2025). They are not served, so total reserves is not exactly the sum of the three served parts. For every year the two left-out parts account for the whole gap (checked to the thousand USD at the year-ends of 1995, 2000, 2010 and 2020–2026), and the gap stays within 30 million USD in every year (largest +13.1, in 2022); the validation rejects anything larger.
- **Gold** is 0 from 1995 to 2023 and above 0 from 2024 (598.7 million USD at the end of 2024, 1,002.3 at the end of 2025). A zero is NBG's published zero, not a gap.
- **Latest point.** Each indicator has one point beyond the year-ends: the latest period in its workbook, dated by `period_end` (2026-06-30 for debt, 2026-09-30 for reserves) and filed under year 2026. No year-end 2026 value exists yet. Nothing is interpolated, summed from months, or averaged, and every other year is the 31 December value of the file.
- **Units.** Debt is in million USD as published. Reserves are published in thousand USD and converted to million USD here, exactly. These are NBG's own US-dollar values: no exchange rate is used, served or archived, and no exchange-rate workbook is kept. Percent of GDP is not stored; it is calculated on the page from the served GDP.
- Everything excluded from the spec stays excluded: monthly and quarterly values, the short-term and long-term and currency splits, sub-sector detail, the IMF reserves template, and exchange rates.

# MoF 2004-2025 Final Fact Excel Validation Summary

Date: 2026-06-27

Scope:

- Source/final files: `docs/Raw Data/Expenditure/mof.ge/final-fact-files-2004-2025`
- Normalized Excel facts: `docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025`
- Generated audit files: `work/mof-validation-20260627`

No audit file was written inside the MoF raw/final folders.

## Techniques Used

1. Manifest coverage check
   - Verified exactly one manifest row for every year 2004-2025.
   - Result: 22 years present, no missing years, no duplicate years.

2. Source/output hash checks
   - For `copied_xlsx` years, compared source `.xlsx` and normalized `.xlsx` by SHA-256.
   - Result: all copied workbook outputs are byte-identical to their source workbook.

3. Preserved-source provenance hash check
   - Compared each current source file hash against preserved files in `mof.ge/old`.
   - Result: every current source file has at least one exact hash match in the preserved old/source tree.

4. Workbook integrity and numeric scan
   - Opened all 22 normalized `.xlsx` files with `openpyxl`.
   - Checked sheets, non-empty cells, numeric cells, formulas, and spreadsheet error literals.
   - Result: all workbooks open and contain data. Spreadsheet errors exist in 2020, 2021, 2022, 2024, and 2025, but they are `#DIV/0!` ratio/percentage artifacts inherited from the source or reproduced by conversion, not changed budget values.

5. PDF table re-extraction
   - Re-extracted PDF tables for 2004, 2012, and 2013 and compared the extracted matrix to the normalized `.xlsx`.
   - Result: 0 row mismatches for 2004, 2012, and 2013.

6. Word conversion replay
   - Copied 2014 and 2015 `.doc` files to the scratch folder, re-extracted Word tables with COM, and compared against the normalized `.xlsx`.
   - Result: 0 row mismatches for 2014 and 2015.

7. XLS conversion replay
   - Copied 2022 and 2023 `.xls` files to the scratch folder, re-saved them as `.xlsx` with Excel COM, and compared against the normalized `.xlsx`.
   - Result: 0 row mismatches for 2022 and 2023.

8. Programmatic PDF grounding for 2005-2011
   - Re-parsed preserved official PDFs for 2005-2011 and compared rows against the final normalized `.xlsx`.
   - Result:
     - 2005: 151 parsed rows, 0 mismatches.
     - 2006: 304 parsed rows, 0 mismatches.
     - 2007: 376 parsed rows, 0 mismatches.
     - 2008: 526 parsed rows, 1 OCR/parser artifact.
     - 2009: 578 parsed rows, 0 mismatches.
     - 2010: 333 parsed rows, 1 OCR/parser artifact.
     - 2011: 659 parsed rows, 0 mismatches.

## Suspicious Items Reviewed

### 2008 OCR artifact

Source PDF row:

- Year: 2008
- Page: 12
- Row: 41
- Code: `32 13 03 66`
- Label: `ssip - levan yanCavelis mcenareTa dacvis instituti`

The PDF text extraction returned a corrupted value `85 60P0a,0g0e` in the total-plan cell. Adjacent cells in the same row show `85 600,00` and `85 528,39`. The final workbook value is `85600`, which is consistent with the readable numeric cells, not a distortion introduced by the workbook.

### 2010 OCR artifact

Source PDF row:

- Year: 2010
- Page: 15
- Row: 11
- Code: `34 00`
- Label: `saqarTvelos okupirebuli teritoriebidan iZulebiT gadaadgilebul pirTa, gansaxlebisa da ltolvilTa saministtro`

The PDF text layer duplicated digits in the parent row. The final workbook row is internally supported by the immediately following detailed row:

- Final total plan: `2,841,912`
- Detail-row total plan components: `2,221,312 + 120,600 + 500,000 = 2,841,912`
- Final total actual: `2,178,544.79`
- Detail-row total actual components: `1,610,596.34 + 75,220.47 + 492,727.98 = 2,178,544.79`
- Final variance: `663,367.21`

This points to a PDF text-layer extraction artifact, not an Excel distortion.

## Conclusion

I did not find evidence that the normalized 2004-2025 Excel facts were distorted, manually changed away from their local official/source documents, or ungrounded.

Important limitation: this validation used the official/source files preserved in this repository and the repo's existing source provenance records. It did not live-fetch every source again from `mof.ge`.

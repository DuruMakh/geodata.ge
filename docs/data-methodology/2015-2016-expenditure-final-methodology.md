# 2015-2016 Expenditure Final Data Methodology

Status: implemented and reconciled (2026-07-04)

Scope: national budget expenditure, actual execution, 2015 and 2016

These two years extend the confirmed 2017-2025 process (see `2025-expenditure-final-methodology.md`) backwards. The E11 functional PDF side is identical to 2017-2025. The supplement side required a different official source, documented below.

## 1. Why these years needed a new supplement source

The confirmed process composes each year from two sources:

```text
final = mapped E11 functional PDF total
      + financial assets growth supplement (per program)
      + liabilities decrease supplement (per program)
```

For 2017-2025 the supplements come from the annual execution workbooks in
`docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/`.

For 2015 and 2016 the files with the same names in that folder are NOT
execution reports. They are budget-law annexes:

```text
2015-fact.xlsx  ->  2015 budget law annex: 2013 fact, 2014 fact, 2015 PLAN
2016-fact.xlsx  ->  2016 budget law annex (truncated): 2014 fact, 2015 fact, 2016 PLAN
```

Using them for supplements would silently mix plan data into actual facts.
The same caution applies to `final-fact-files-2004-2025/2015-fact.doc`
(same 2015 law annex in Word form).

## 2. Official actual supplement sources used

The Ministry of Finance annual budget execution reports ("სახელმწიფო
ბიუჯეტის შესრულების წლიური ანგარიში") publish Chapter VI — state budget
payments by programmatic classification — with approved plan, revised plan,
and actual execution columns per institution/program. These are the direct
analog of the 2017+ "VI TAVI" workbooks, published as PDFs.

The old mof.ge pages are no longer served after the site migration; the
files were retrieved from the Internet Archive captures of the original
mof.ge URLs:

```text
docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2015-annual-execution-tavi-VI-programmatic.pdf
  original: https://mof.ge/images/File/biuj2015/TAVI_VI.pdf
  landing page: https://mof.ge/shesrulebis_angarishi_2015
  archived copy used: http://web.archive.org/web/20250327123345/https://www.mof.ge/images/File/biuj2015/TAVI_VI.pdf
  SHA-256: FC2056952A81FB514D6CC90A81CCF8CEEB299A563EB2A3D962A6D959D1C0BED4

docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2016-annual-execution-tavi-VI-programmatic.pdf
  original: https://mof.ge/images/File/biuj2016_12tve/TAVI_VI_e.pdf
  landing page: https://mof.ge/shesrulebis_angarishi_2016_12tve
  archived copy used: http://web.archive.org/web/20221116100441/https://mof.ge/images/File/biuj2016_12tve/TAVI_VI_e.pdf
  SHA-256: 94206BA75B2ACB7F1F28CE88F69DB64E18617EA548537D195E055FE395436C7D
```

Independent cross-check: the truncated 2016 law annex republishes the 2015
actual aggregates, and they match the 2015 report exactly (ხარჯები
8,157,998.4k; არაფინანსური აქტივების ზრდა 680,173.3k; ფინანსური აქტივების
ზრდა 444,804.8k; ვალდებულებების კლება 420,150.6k; სულ 9,703,127.1k).

## 3. Pipeline pieces added or changed

```text
apps/web/lib/data/realExpenditurePdf/tavi6ProgrammaticPdf.ts
  New parser: Chapter VI programmatic PDF -> OfficialExpenditureRow[]
  (thousand-GEL amounts, three columns, wrapped labels, repeated page
  headers, trailing footnote markers "... 0.0 0.0 0.0 *").

apps/web/lib/data/realExpenditurePdf/phase1Pilot.ts
  - page-header flush also accepts dash timestamps ("21-03-2016 17:09");
  - collapses the 2015 E11 text-layer artifact where every label cell is
    repeated four times on a tab-separated line.

apps/web/lib/data/realExpenditurePdf/publicMapping.ts
  New reviewed rule: 7.4.8 (applied research in economic activity, present
  through 2015) -> spending.economic_affairs, medium confidence.

apps/web/scripts/extract-expenditure-pdf-pilot.ts
apps/web/scripts/generate-final-2025-expenditure-data.ts
  2015/2016 source entries use actualAmountIndex 3 (same column layout as
  2017/2018) and point workbookPath at the Chapter VI PDFs; both scripts
  parse a .pdf workbook path through the new parser.

apps/web/lib/data/coverage.ts
  EXPENDITURE_DETAILED_YEARS now starts at 2015. ADMIN_SPENDING_YEARS stays
  at 2017 (no execution workbooks with institution columns before that), so
  the functional-vs-admin reconciliation test covers the overlap years only.
```

Supplement mapping uses the same machinery as other pre-2023 years: exact
Georgian label propagation from the reviewed 2023-2025 mapping file first,
then the deterministic candidate rules (`candidateMapping.ts`). The final
report notes how many rows used generated candidates.

## 4. Reconciliation results

```text
2015
  E11 PDF mapped total:            8,838,171,764 GEL
  Supplements (fin.assets+liab.):    864,955,200 GEL
  Final total:                     9,703,126,964 GEL
  Official annual total:           9,703,127,100 GEL (thousand-GEL annex rounding)
  Difference:                                136 GEL (tolerance 1,000)

2016
  E11 PDF mapped total:            9,404,231,220 GEL
  Supplements (fin.assets+liab.):    888,003,400 GEL
  Final total:                    10,292,234,620 GEL
  Official annual total:          10,292,234,100 GEL
  Difference:                                520 GEL (tolerance 1,000)

spending.other_unclassified: 288,100 GEL (2015), 541,300 GEL (2016) —
supplement rows whose program labels matched no reviewed or candidate rule.
```

Regression pins for both totals live in
`apps/web/tests/data/pipelineIntegration.test.ts`.

## 5. Verification commands

```powershell
cd apps/web
npm run data:extract-expenditure-pdf-2015
npm run data:extract-expenditure-pdf-2016
npm run data:generate-final-2015-expenditure
npm run data:generate-final-2016-expenditure
npm run data:compose-budget-facts
npm run data:validate
npm test
```

## 6. Notes for older years (2006-2014 rollout)

- The `excel-fact-files-2004-2025/<year>-fact.xlsx` files for pre-2017 years
  are budget-law annexes (plan data, prior-year facts). Do not use them as
  actual-execution sources without checking the column headers.
- The mof.ge annual execution report packages exist back to at least 2011
  under the same URL family (`mof.ge/images/File/biuj<year>...`, landing
  pages `mof.ge/shesrulebis_angarishi_<year>...`), retrievable through the
  Internet Archive. Their Chapter VI annexes are the natural supplement
  source for Group 2-4 years (2008-2014), pending the same E11-side format
  adaptations described in the year-group analysis.

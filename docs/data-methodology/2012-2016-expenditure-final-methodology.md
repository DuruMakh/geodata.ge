# 2012-2016 Expenditure Final Data Methodology

Status: implemented and reconciled (2026-07-04)

Scope: national budget expenditure, actual execution, 2012-2016

These years extend the confirmed 2017-2025 process (see `2025-expenditure-final-methodology.md`) backwards. The E11 functional PDF side is structurally identical to 2017-2025, with two era quirks: 2012-2014 E11 PDFs embed a legacy non-Unicode Georgian font (section 3a), and 2012-2013 print classification codes without dots — 701 for 7.1, 21 for 2.1 — normalized by the parser behind a per-year flag (section 3b). The supplement side required a different official source, documented below.

## 1. Why these years needed a new supplement source

The confirmed process composes each year from two sources:

```text
final = mapped E11 functional PDF total
      + financial assets growth supplement (per program)
      + liabilities decrease supplement (per program)
```

For 2017-2025 the supplements come from the annual execution workbooks in
`docs/Raw Data/Expenditure/mof.ge/excel-fact-files-2004-2025/`.

For 2014-2016 the files with the same names in that folder are NOT
execution reports. They are budget-law annexes:

```text
2014-fact.xlsx  ->  2014 budget law annex: 2012 fact, 2013 fact, 2014 PLAN
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
docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2012-annual-execution-report.pdf
  Full 518-page 2012 annual execution report ("მიმოხილვა", mof.ge doc 10150
  from the old-site page mof.ge/5069, listed on mof.ge/4981 "შესრულების
  ანგარიშები" -> 2012 -> 12 თვე). The payments-by-program table lives on PDF
  pages 202-249 (config workbookPageRange). Total row reads "00 00 მხარჯავი
  დაწესებულებები".
  archived copy used: http://web.archive.org/web/20140812055540/http://mof.ge/common/get_doc.aspx?doc_id=10150
  SHA-256: FD0E3A36731FEC184A8907B04024457E77139F2823547AFC5AB560C696980829

docs/Raw Data/Expenditure/mof.ge/final-fact-files-2004-2025/2013-fact.pdf
  Already in the repo: this IS the 2013 annual execution report Chapter VI
  ("თავი VI ... პროგრამული კლასიფიკაციის მიხედვით", authored 2014-04-01).
  Used as the 2013 supplement workbook directly. Note the source PDF itself
  contains the header typo "დაზუსტბული", tolerated by the parser.

docs/Raw Data/Expenditure/mof.ge/annual-execution-reports/2014-annual-execution-tavi-VI-programmatic.pdf
  original: https://mof.ge/images/File/biuj2014_12tve/TAVI_VI.pdf
  landing page: https://mof.ge/shesrulebis_angarishi_2014
  archived copy used: http://web.archive.org/web/20250622055924/https://www.mof.ge/images/File/biuj2014_12tve/TAVI_VI.pdf
  (note: the 2022 capture of this URL is truncated at 1 MiB; the 2024+
  captures carry the full 2,987,605-byte file)
  SHA-256: 712B5B562E44F94A9A21547A3D47A684F8CF59AC1E5F79B3AF31514AD12F44E9

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
Likewise the 2015 law annex republishes the 2014 actual aggregates and they
match the 2014 report exactly (ხარჯები 7,479,426.2k; ფინანსური აქტივების
ზრდა 272,202.2k; ვალდებულებების კლება 559,733.7k; სულ 9,009,812.2k).

The 2012-2016 execution report PDFs use proper Unicode Georgian text (only
the treasury E11 PDFs for 2012-2014 carry the legacy font).

For 2012 and 2013 the official aggregates republished in later budget-law
annexes match the composed supplements exactly:

```text
2012 (from the 2014 law annex, 2012-fact column):
  ხარჯები 6,566,316.0k; არაფინანსური აქტივების ზრდა 728,465.6k;
  ფინანსური აქტივების ზრდა 372,654.2k; ვალდებულებების კლება 139,366.1k;
  სულ 7,806,801.8k
2013 (from the 2015 law annex, 2013-fact column):
  ხარჯები 6,545,615.2k; არაფინანსური აქტივების ზრდა 767,632.2k;
  ფინანსური აქტივების ზრდა 277,105.1k; ვალდებულებების კლება 513,865.1k;
  სულ 8,104,217.6k
```

## 3. Pipeline pieces added or changed

### 3a. Legacy-font E11 labels (2012-2014)

The 2012-2014 treasury E11 PDFs embed a legacy Georgian font: glyphs land in
IPA/spacing-modifier codepoints (for example `ˆʨʸˇʬʩʰ` for ხარჯები) and
word spaces are lost. Codes and amounts parse normally, so extraction and
mapping key on functional codes; only the display labels are affected.

`apps/web/lib/data/realExpenditurePdf/cofogCanonicalLabels.ts` carries the
canonical functional-code -> Georgian label table (96 entries sourced from
the reviewed 2017/2016/2015 E11 extractions; COFOG labels are standardized
across years — every 2014 code is covered). Years flagged with
`legacyEncodedLabels: true` in the script configs get labelKa/hierarchyPath
replaced with canonical text; rawRowText keeps the original extracted
evidence. All functional codes appearing in 2012-2014 are covered by the
canonical table.

### 3b. Non-dotted classification codes (2012-2013)

The 2012 and 2013 E11 PDFs print codes without dots: functional 701,
70111 (for 7.1, 7.1.1.1) and economic 21 (for 2.1). Source entries flagged
`nonDottedCodes: true` normalize codes before the functional-context logic
(COFOG division = two digits after the leading 7, then one digit per
level), after which mapping rules and canonical labels apply unchanged.

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
2012
  E11 PDF mapped total:            7,294,781,563 GEL
  Supplements (fin.assets+liab.):    512,020,400 GEL
  Final total:                     7,806,801,963 GEL
  Official annual total:           7,806,801,800 GEL (thousand-GEL annex rounding)
  Difference:                                163 GEL (tolerance 1,000)

2013
  E11 PDF mapped total:            7,313,247,452 GEL
  Supplements (fin.assets+liab.):    790,970,500 GEL
  Final total:                     8,104,217,952 GEL
  Official annual total:           8,104,217,600 GEL
  Difference:                                352 GEL (tolerance 1,000)

2014
  E11 PDF mapped total:            8,177,876,295 GEL
  Supplements (fin.assets+liab.):    831,935,900 GEL
  Final total:                     9,009,812,195 GEL
  Official annual total:           9,009,812,200 GEL (thousand-GEL annex rounding)
  Difference:                                  5 GEL (tolerance 1,000)

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

spending.other_unclassified: 0 GEL for 2013-2016; 700,000 GEL (0.009%)
for 2012 — a single reviewed row kept there deliberately (see below). The initial runs
left 19 supplement arrears rows unclassified (3,919,900 / 288,100 /
541,300 GEL); their program labels were individually reviewed (2026-07-04)
and the deterministic keyword rules in `candidateMapping.ts` were extended
to cover them: შეიარაღებული ძალ -> defence; პატიმრობ, სამართალშემოქმედ ->
public order; სასწავლო, საგანმანათლებლო, ახალგაზრდ -> education;
ეპიდზედამხედველ -> health; ფერმერ -> agriculture/environment;
უშიშროების საბჭო, საკანონმდებლო, სახელმწიფო მინისტრის აპარატ -> general
public services; აეროპორტ, საჰაერო ხომალდ -> infrastructure (the largest
2014 row, 2.5M GEL, is reimbursement of aircraft takeoff/landing services
at Georgian airports under treaty obligations — air transport, following
the same convention that maps functional 7.4.5 transport to
infrastructure_regional_development). Year totals are invariant under
reclassification; the regression pins did not change. Keyword additions for
2012-2013 rows: სახელმწიფო ზრუნვ -> social protection (the bare stem ზრუნვ
is forbidden — it is a substring of უზრუნველყოფა and hijacks unrelated
labels), საინვესტიციო პოლიტიკ -> economic affairs.

Owner-reviewed decisions (2026-07-04): the GIZ/KfW donor-coordination
rows (ორმხრივი, რეგიონალური და რეგიონთაშორისი პროექტები; KfW ოფისის
თანადაფინანსება) map to spending.infrastructure_regional_development
(keywords: რეგიონთაშორისი პროექტ, kfw). The 2012 disaster-fund
financial-assets row "სტიქიის შედეგების ლიკვიდაცია" (700,000 GEL) stays
in spending.other_unclassified by explicit owner decision — the label
alone does not determine whether it financed infrastructure restoration
or household support.
```

Regression pins for both totals live in
`apps/web/tests/data/pipelineIntegration.test.ts`.

## 5. Verification commands

```powershell
cd apps/web
npm run data:extract-expenditure-pdf-2012
npm run data:extract-expenditure-pdf-2013
npm run data:extract-expenditure-pdf-2014
npm run data:extract-expenditure-pdf-2015
npm run data:extract-expenditure-pdf-2016
npm run data:generate-final-2012-expenditure
npm run data:generate-final-2013-expenditure
npm run data:generate-final-2014-expenditure
npm run data:generate-final-2015-expenditure
npm run data:generate-final-2016-expenditure
npm run data:compose-budget-facts
npm run data:validate
npm test
```

## 6. Notes for older years (2006-2011 rollout)

- The `excel-fact-files-2004-2025/<year>-fact.xlsx` files for pre-2017 years
  are budget-law annexes (plan data, prior-year facts). Do not use them as
  actual-execution sources without checking the column headers.
- The mof.ge annual execution report packages exist back to at least 2011
  under the same URL family (`mof.ge/images/File/biuj<year>...`, landing
  pages `mof.ge/shesrulebis_angarishi_<year>...`), retrievable through the
  Internet Archive. Their Chapter VI annexes are the natural supplement
  source for the remaining Group 4 years (2008-2011). The old-site year
  pages live under mof.ge/4981 ("შესრულების ანგარიშები"): 2011 -> mof.ge/4983,
  2010 -> /4993, 2009 -> /5003, 2008 -> /5013, 2007 -> /5023, 2006 -> /5033,
  2005 -> /5037, 2004 -> /5039 (Wayback). The remaining E11-side adaptation
  is the 2008-2011 row shape described in the year-group analysis.
- Wayback captures of large files can be silently truncated (the 2022
  capture of the 2014 Chapter VI stops at exactly 1 MiB). Always compare
  the downloaded size against `x-archive-orig-content-length` or prefer the
  newest capture, and check the file ends with `%%EOF`.
